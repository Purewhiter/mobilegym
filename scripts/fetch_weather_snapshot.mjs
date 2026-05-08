#!/usr/bin/env node
/**
 * 采集天气数据快照，写入 apps/Weather/data/weatherBundles.json。
 *
 * 用法:
 *   node scripts/fetch_weather_snapshot.mjs                  # 采集所有城市
 *   node scripts/fetch_weather_snapshot.mjs --cities beijing,shanghai  # 只采集指定城市
 *
 * 环境变量:
 *   VITE_QWEATHER_API_KEY — 和风天气 API Key（必须）
 *   VITE_QWEATHER_HOST    — 和风天气 API 地址（必须）
 *   VITE_AMAP_API_KEY     — 高德逆地理编码 Key（可选，用于 located 城市名）
 *
 * 输出: apps/Weather/data/weatherBundles.json
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// 手动解析 .env（避免依赖 dotenv）
const envPath = resolve(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const OUT_PATH = resolve(ROOT, 'apps/Weather/data/weatherBundles.json');
const DEFAULTS_PATH = resolve(ROOT, 'apps/Weather/data/defaults.json');
const SEARCHABLE_CITIES_PATH = resolve(ROOT, 'apps/Weather/data/searchableCities.json');
const WEATHER_APP_PY = resolve(ROOT, 'bench_env/task/weather/app.py');
const SIMULATOR_CONFIG_PATH = resolve(ROOT, 'os/data/simulatorConfig.ts');

const QWEATHER_API_KEY = process.env.VITE_QWEATHER_API_KEY;
const QWEATHER_HOST = process.env.VITE_QWEATHER_HOST;
const AMAP_API_KEY = process.env.VITE_AMAP_API_KEY;

if (!QWEATHER_HOST) {
  console.error('错误: 缺少 VITE_QWEATHER_HOST，请在 .env 中设置');
  process.exit(1);
}

if (!QWEATHER_API_KEY) {
  console.error('错误: 缺少 VITE_QWEATHER_API_KEY，请在 .env 中设置');
  process.exit(1);
}

// ─── 从项目文件读取城市列表 ──────────────────────────────────────────────────

const defaults = JSON.parse(readFileSync(DEFAULTS_PATH, 'utf-8'));
const searchableCities = JSON.parse(readFileSync(SEARCHABLE_CITIES_PATH, 'utf-8'));

// bench_env/task/weather/app.py 中的 WEATHER_NEW_CITIES
function parseNewCitiesFromAppPy() {
  const src = readFileSync(WEATHER_APP_PY, 'utf-8');
  const m = src.match(/WEATHER_NEW_CITIES\s*=\s*\[([^\]]+)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

// 按城市名在 searchableCities / defaults 中查找坐标
function lookupCity(name) {
  const key = name.replace(/[市省]$/, '');
  for (const c of [...defaults.savedCities, ...searchableCities]) {
    const cName = (c.name || '').replace(/[市省]$/, '');
    if (cName === key || cName === name) return c;
  }
  return null;
}

const newCityNames = parseNewCitiesFromAppPy();
const extraCities = newCityNames
  .map((name) => {
    const found = lookupCity(name);
    if (!found) {
      console.warn(`⚠ bench 城市 "${name}" 未在 searchableCities 中找到，跳过`);
      return null;
    }
    return { id: found.id, name: found.name, lon: found.lon, lat: found.lat };
  })
  .filter(Boolean);

// os/data/simulatorConfig.ts 中的默认定位坐标
function parseDefaultLocation() {
  const src = readFileSync(SIMULATOR_CONFIG_PATH, 'utf-8');
  const m = src.match(/simulatedLocation\s*:\s*\{\s*latitude\s*:\s*([\d.]+)\s*,\s*longitude\s*:\s*([\d.]+)/);
  if (!m) {
    console.warn('⚠ 未能从 simulatorConfig.ts 解析默认定位坐标，使用 Beijing fallback');
    return { lat: 39.9042, lon: 116.4074 };
  }
  return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
}

const defaultLocation = parseDefaultLocation();
const locatedCity = { id: 'located', name: '', lon: defaultLocation.lon, lat: defaultLocation.lat };

const ALL_CITIES = [...defaults.savedCities, ...extraCities, locatedCity];
console.log(`城市列表: ${ALL_CITIES.map((c) => c.id).join(', ')}`);

// ─── 请求工具 ────────────────────────────────────────────────────────────────

async function qweatherFetch(path, params = {}) {
  const url = new URL(`${QWEATHER_HOST.replace(/\/+$/, '')}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);
  const res = await fetch(url.toString(), {
    headers: { 'X-QW-Api-Key': QWEATHER_API_KEY },
  });
  if (!res.ok) throw new Error(`QWeather ${path} → ${res.status}`);
  return res.json();
}

async function amapReverseGeocode(lon, lat) {
  if (!AMAP_API_KEY) return null;
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_API_KEY}&location=${lon},${lat}&radius=1000&extensions=base&output=JSON`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const comp = data?.regeocode?.addressComponent;
  if (!comp) return null;
  const road = comp.street || comp.township || comp.neighborhood || '';
  const district = comp.district || '';
  if (road) return district ? `${district} ${road}` : road;
  if (district) return district;
  return comp.city || null;
}

// ─── 蒲福风级转换（与 weatherService.ts 一致） ──────────────────────────────

function beaufortScaleFromKmh(kmh) {
  const thresholds = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118, 134, 150, 167, 184, 202];
  const speed = Math.abs(kmh);
  for (let i = 0; i < thresholds.length; i++) {
    if (speed < thresholds[i]) return String(i);
  }
  return '17';
}

function normalizeWindScale(day, dayKey, nightKey, speedDayKey, speedNightKey) {
  const entry = { ...day };
  const wsDay = parseFloat(entry[speedDayKey] || '');
  const wsNight = parseFloat(entry[speedNightKey] || '');
  if (Number.isFinite(wsDay)) entry[dayKey] = beaufortScaleFromKmh(wsDay);
  if (Number.isFinite(wsNight)) entry[nightKey] = beaufortScaleFromKmh(wsNight);
  return entry;
}

// ─── 采集单城市 ──────────────────────────────────────────────────────────────

async function fetchCityBundle(city) {
  const location = `${city.lon},${city.lat}`;
  console.log(`  采集 ${city.name} (${city.id}) ...`);

  const [nowData, dailyData, hourlyData, indicesData, warningData, aqData] = await Promise.all([
    qweatherFetch('/v7/weather/now', { location }),
    qweatherFetch('/v7/weather/15d', { location }),
    qweatherFetch('/v7/weather/24h', { location }),
    qweatherFetch('/v7/indices/1d', { location, type: '1,2,3,5,9' }),
    qweatherFetch('/v7/warning/now', { location }),
    qweatherFetch(`/airquality/v1/current/${city.lat}/${city.lon}`).catch(() => null),
  ]);

  const now = nowData.now || {};
  const daily = (dailyData.daily || []).map((d) =>
    normalizeWindScale(d, 'windScaleDay', 'windScaleNight', 'windSpeedDay', 'windSpeedNight'),
  );
  const hourly = (hourlyData.hourly || []).map((h) => {
    const ws = parseFloat(h.windSpeed || '');
    return { ...h, windScale: Number.isFinite(ws) ? beaufortScaleFromKmh(ws) : (h.windScale || '') };
  });
  const indices = indicesData.daily || [];

  const warnings = (warningData.warning || []).map((w) => ({
    id: w.id || '',
    sender: w.sender || '',
    pubTime: w.pubTime || '',
    title: w.title || '',
    startTime: w.startTime || '',
    endTime: w.endTime || '',
    status: w.status || '预警中',
    level: w.level || '',
    severity: w.severity || '',
    severityColor: w.severityColor || 'Blue',
    type: w.type || '',
    typeName: w.typeName || '',
    text: w.text || '',
    related: w.related || '',
  }));

  let airQuality = null;
  if (aqData?.indexes?.[0]) {
    const idx = aqData.indexes[0];
    const pv = (code) => {
      const m = (aqData.pollutants || []).find((p) => (p.code || '').toLowerCase() === code.toLowerCase());
      return String(m?.concentration?.value ?? '');
    };
    airQuality = {
      pubTime: new Date().toISOString(),
      aqi: String(idx.aqiDisplay ?? idx.aqi ?? ''),
      level: String(idx.level ?? ''),
      category: String(idx.category ?? ''),
      primaryPollutant: String(idx.primaryPollutant?.fullName ?? idx.primaryPollutant?.name ?? ''),
      pm10: pv('pm10'),
      pm2p5: pv('pm2p5'),
      no2: pv('no2'),
      so2: pv('so2'),
      co: pv('co'),
      o3: pv('o3'),
    };
  }

  let minutely = null;
  try {
    const minutelyData = await qweatherFetch('/v7/minutely/5m', { location });
    if (minutelyData.summary) {
      minutely = { summary: minutelyData.summary, minutely: minutelyData.minutely || [] };
    }
  } catch { /* optional */ }

  const bundle = { now, daily, hourly, indices, warnings, airQuality, minutely };

  // 历史天气（昨天）
  let historicalYesterday = null;
  try {
    const geoData = await qweatherFetch('/geo/v2/city/lookup', { location });
    const locationId = geoData.location?.[0]?.id;
    if (locationId) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateParam = `${yesterday.getFullYear()}${String(yesterday.getMonth() + 1).padStart(2, '0')}${String(yesterday.getDate()).padStart(2, '0')}`;
      const histData = await qweatherFetch('/v7/historical/weather', {
        location: locationId,
        date: dateParam,
      });
      if (histData.weatherDaily?.date) {
        const hd = histData.weatherDaily;
        const hh = histData.weatherHourly || [];
        const pickHour = (hours, target) => {
          if (!hours.length) return undefined;
          let best = hours[0];
          let bestDiff = Infinity;
          for (const h of hours) {
            const m = h.time?.match(/T(\d{1,2}):/);
            if (m) {
              const diff = Math.abs(parseInt(m[1]) - target);
              if (diff < bestDiff) { best = h; bestDiff = diff; }
            }
          }
          return best;
        };
        const dayHour = pickHour(hh, 14);
        const nightHour = pickHour(hh, 21);
        const wsDay = String(dayHour?.windSpeed || '');
        const wsNight = String(nightHour?.windSpeed || '');
        historicalYesterday = {
          fxDate: String(hd.date || ''),
          sunrise: String(hd.sunrise || ''),
          sunset: String(hd.sunset || ''),
          moonrise: String(hd.moonrise || ''),
          moonset: String(hd.moonset || ''),
          moonPhase: String(hd.moonPhase || ''),
          moonPhaseIcon: '',
          tempMax: String(hd.tempMax || ''),
          tempMin: String(hd.tempMin || ''),
          iconDay: String(dayHour?.icon || ''),
          textDay: String(dayHour?.text || ''),
          iconNight: String(nightHour?.icon || ''),
          textNight: String(nightHour?.text || ''),
          wind360Day: String(dayHour?.wind360 || ''),
          windDirDay: String(dayHour?.windDir || ''),
          windScaleDay: Number.isFinite(parseFloat(wsDay)) ? beaufortScaleFromKmh(parseFloat(wsDay)) : '',
          windSpeedDay: wsDay,
          wind360Night: String(nightHour?.wind360 || ''),
          windDirNight: String(nightHour?.windDir || ''),
          windScaleNight: Number.isFinite(parseFloat(wsNight)) ? beaufortScaleFromKmh(parseFloat(wsNight)) : '',
          windSpeedNight: wsNight,
          humidity: String(hd.humidity || ''),
          precip: String(hd.precip || ''),
          pressure: String(hd.pressure || ''),
          vis: '',
          cloud: '',
          uvIndex: '',
        };
      }
    }
  } catch (e) {
    console.log(`    历史天气采集失败: ${e.message}`);
  }

  // 空气质量多日预报
  let airQualityForecast = null;
  try {
    const aqfData = await qweatherFetch(`/airquality/v1/daily/${city.lat}/${city.lon}`);
    if (aqfData.days?.length) {
      airQualityForecast = aqfData.days
        .map((day) => {
          const idx = day.indexes?.[0];
          if (!idx) return null;
          return {
            forecastStartTime: String(day.forecastStartTime || ''),
            forecastEndTime: String(day.forecastEndTime || ''),
            aqi: String(idx.aqiDisplay ?? idx.aqi ?? ''),
            level: String(idx.level ?? ''),
            category: String(idx.category ?? ''),
            primaryPollutant: String(idx.primaryPollutant?.fullName ?? idx.primaryPollutant?.name ?? ''),
          };
        })
        .filter(Boolean);
    }
  } catch { /* optional */ }

  // 逆地理编码（仅定位页需要，但也给所有城市备一份）
  let locationName = city.name.replace(/[市省]$/, '') || city.name;
  try {
    const amapName = await amapReverseGeocode(city.lon, city.lat);
    if (amapName) locationName = amapName;
  } catch { /* optional */ }

  return {
    lonLat: location,
    locationName,
    bundle,
    historicalYesterday,
    airQualityForecast,
  };
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const citiesArg = args.find((a) => a.startsWith('--cities='))?.split('=')[1];
  const cidx = args.indexOf('--cities');
  const citiesFilter = citiesArg
    ? citiesArg.split(',')
    : cidx >= 0 && args[cidx + 1]
      ? args[cidx + 1].split(',')
      : null;

  const cities = citiesFilter
    ? ALL_CITIES.filter((c) => citiesFilter.includes(c.id))
    : ALL_CITIES;

  if (!cities.length) {
    console.error('没有匹配的城市');
    process.exit(1);
  }

  const existing = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf-8')) : {};

  console.log(`采集 ${cities.length} 个城市的天气数据...`);
  for (const city of cities) {
    try {
      existing[city.id] = await fetchCityBundle(city);
      console.log(`  ✓ ${city.name}`);
    } catch (e) {
      console.error(`  ✗ ${city.name}: ${e.message}`);
    }
    // 限流：每个城市间隔 500ms
    await new Promise((r) => setTimeout(r, 500));
  }

  writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2), 'utf-8');
  console.log(`\n已写入 ${OUT_PATH}（${Object.keys(existing).length} 个城市）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
