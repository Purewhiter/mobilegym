import type {
  AirQuality,
  City,
  MinutelyPrecipitation,
  WeatherBundle,
  WeatherDaily,
  WeatherHourly,
  WeatherIndex,
  WeatherNow,
  WeatherWarning,
  AirQualityForecastDay,
} from '../types';
import { netJson } from '../../../os/NetworkService';
import * as TimeService from '../../../os/TimeService';
import {
  findLibraryBundle,
  findLibraryHistorical,
  findLibraryAirForecast,
  saveToLibrary,
} from '../utils/weatherLibrary';

/**
 * Weather bundle request (client-side)
 *
 * Purpose:
 * - Deduplicate concurrent requests (inflight coalescing)
 *
 * Note:
 * - 不在这里做 localStorage 多 key 缓存（会污染 storage 且违反单键=appId 约定）
 * - Weather App 会把“最新一次成功请求结果”持久化到 localStorage 单键 `weather`
 *  （见 apps/Weather/utils/weatherStore.ts）
 */
const BUNDLE_INFLIGHT = new Map<string, Promise<WeatherBundle>>();

// 通过同源代理避免 CORS：/api/qweather/*
const QWEATHER_API_KEY = (import.meta as any).env?.VITE_QWEATHER_API_KEY as string | undefined;
const QWEATHER_HOST = (import.meta as any).env?.VITE_QWEATHER_HOST as string | undefined;

type QWeatherNowResponse = {
  now?: WeatherNow;
};

type QWeatherDailyResponse = {
  daily?: WeatherDaily[];
};

type QWeatherHourlyResponse = {
  hourly?: WeatherHourly[];
};

type QWeatherIndicesResponse = {
  daily?: WeatherIndex[];
};

type QWeatherWarningRaw = Partial<WeatherWarning>;

type QWeatherWarningResponse = {
  warning?: QWeatherWarningRaw[];
};

type QWeatherMinutelyResponse = {
  summary?: string;
  minutely?: MinutelyPrecipitation[];
};

type QWeatherAirQualityIndex = {
  aqi?: number | string;
  aqiDisplay?: string;
  level?: string;
  category?: string;
  primaryPollutant?: {
    name?: string;
    fullName?: string;
  };
};

type QWeatherAirQualityPollutant = {
  code?: string;
  concentration?: {
    value?: number | string;
  };
};

type QWeatherAirQualityResponse = {
  indexes?: QWeatherAirQualityIndex[];
  pollutants?: QWeatherAirQualityPollutant[];
};

type QWeatherAirQualityForecastDay = {
  forecastStartTime?: string;
  forecastEndTime?: string;
  indexes?: QWeatherAirQualityIndex[];
};

type QWeatherAirQualityDailyResponse = {
  days?: QWeatherAirQualityForecastDay[];
};

type QWeatherGeoLookupResponse = {
  location?: Array<{
    id?: string;
  }>;
};

type QWeatherHistoricalWeatherDaily = {
  date?: string;
  sunrise?: string;
  sunset?: string;
  moonrise?: string;
  moonset?: string;
  moonPhase?: string;
  tempMax?: string;
  tempMin?: string;
  humidity?: string;
  precip?: string;
  pressure?: string;
};

type QWeatherHistoricalWeatherHourly = {
  time?: string;
  temp?: string;
  icon?: string;
  text?: string;
  precip?: string;
  wind360?: string;
  windDir?: string;
  windScale?: string;
  windSpeed?: string;
  humidity?: string;
  pressure?: string;
};

type QWeatherHistoricalWeatherResponse = {
  weatherDaily?: QWeatherHistoricalWeatherDaily;
  weatherHourly?: QWeatherHistoricalWeatherHourly[];
};

export type { WeatherBundle, AirQualityForecastDay } from '../types';

type WeatherLookupOptions = {
  dailysteps?: number;
  hourlysteps?: number;
  alert?: boolean;
  cityId?: string;
};

const makeRequestKey = (lonLat: string, opts: { dailysteps?: number; hourlysteps?: number; alert?: boolean }) => {
  const d = opts.dailysteps ?? 15;
  const h = opts.hourlysteps ?? 24;
  const a = opts.alert ?? true;
  return `${lonLat}|d=${d}|h=${h}|a=${a ? 1 : 0}`;
};

const normalizeLibraryCityId = (cityId?: string): string | undefined => {
  const id = String(cityId ?? '').trim();
  return id && id !== 'located' ? id : undefined;
};

const splitLonLat = (lonLat: string): { lon: string; lat: string } => {
  const parts = lonLat.split(',').map(s => s.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`坐标格式错误，期望 "lon,lat"，实际: ${lonLat}`);
  }
  return { lon: parts[0], lat: parts[1] };
};

const fetchFromQWeather = async <T>(path: string, params: Record<string, string> = {}): Promise<T> => {
  const host = QWEATHER_HOST?.trim();
  if (!host) {
    throw new Error('缺少 VITE_QWEATHER_HOST：请在 `.env` 中设置');
  }
  if (!QWEATHER_API_KEY) {
    throw new Error('缺少 VITE_QWEATHER_API_KEY：请在 `.env` 中设置');
  }

  const url = new URL(`${host.replace(/\/+$/, '')}${path}`);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  return await netJson<T>(url.toString(), { headers: { 'X-QW-Api-Key': QWEATHER_API_KEY } });
};

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
};

const resolveDailyEndpoint = (days: number): '3d' | '7d' | '10d' | '15d' | '30d' => {
  if (days <= 3) return '3d';
  if (days <= 7) return '7d';
  if (days <= 10) return '10d';
  if (days <= 15) return '15d';
  return '30d';
};

// 和风返回的 windScale 常是区间值（如 1-3），
// UI 展示统一按 km/h 重新换算成单一蒲福风级。
export const beaufortScaleFromKmh = (kmh: number): string => {
  const thresholds = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118, 134, 150, 167, 184, 202];
  const speed = Math.abs(kmh);
  for (let i = 0; i < thresholds.length; i++) {
    if (speed < thresholds[i]) return String(i);
  }
  return '17';
};

const normalizeWarning = (warning: QWeatherWarningRaw): WeatherWarning => ({
  id: asString(warning.id),
  sender: asString(warning.sender),
  pubTime: asString(warning.pubTime),
  title: asString(warning.title),
  startTime: asString(warning.startTime),
  endTime: asString(warning.endTime),
  status: asString(warning.status || '预警中'),
  level: asString(warning.level),
  severity: asString(warning.severity),
  severityColor: asString(warning.severityColor || 'Blue'),
  type: asString(warning.type),
  typeName: asString(warning.typeName),
  text: asString(warning.text),
  related: asString(warning.related),
});

const getPollutantValue = (pollutants: QWeatherAirQualityPollutant[] | undefined, code: string): string => {
  const match = pollutants?.find(item => item.code?.toLowerCase() === code.toLowerCase());
  return asString(match?.concentration?.value);
};

const normalizeAirQualityIndexSummary = (index?: QWeatherAirQualityIndex | null) => ({
  aqi: asString(index?.aqiDisplay ?? index?.aqi),
  level: asString(index?.level),
  category: asString(index?.category),
  primaryPollutant: asString(index?.primaryPollutant?.fullName ?? index?.primaryPollutant?.name),
});

const normalizeAirQuality = (data: QWeatherAirQualityResponse): AirQuality | null => {
  const index = data.indexes?.[0];
  if (!index) return null;
  const summary = normalizeAirQualityIndexSummary(index);

  return {
    pubTime: TimeService.getDate().toISOString(),
    aqi: summary.aqi,
    level: summary.level,
    category: summary.category,
    primaryPollutant: summary.primaryPollutant,
    pm10: getPollutantValue(data.pollutants, 'pm10'),
    pm2p5: getPollutantValue(data.pollutants, 'pm2p5'),
    no2: getPollutantValue(data.pollutants, 'no2'),
    so2: getPollutantValue(data.pollutants, 'so2'),
    co: getPollutantValue(data.pollutants, 'co'),
    o3: getPollutantValue(data.pollutants, 'o3'),
  };
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDateParam = (date: Date) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;

const parseHistoricalHourTimestamp = (value?: string) => {
  if (!value) return 0;
  return TimeService.parseToTimestamp(value);
};

const pickNearestHistoricalHour = (
  hours: QWeatherHistoricalWeatherHourly[],
  fxDate: string,
  preferredHour: number
) => {
  const targetTs = TimeService.parseToTimestamp(`${fxDate}T${pad2(preferredHour)}:00:00`);
  if (!targetTs) return hours[0];
  let best = hours[0];
  let bestDiff = Math.abs(parseHistoricalHourTimestamp(best?.time) - targetTs);
  for (const hour of hours) {
    const diff = Math.abs(parseHistoricalHourTimestamp(hour?.time) - targetTs);
    if (diff < bestDiff) {
      best = hour;
      bestDiff = diff;
    }
  }
  return best;
};

const normalizeHistoricalDaily = (
  data: QWeatherHistoricalWeatherResponse,
): WeatherDaily | null => {
  const daily = data.weatherDaily;
  if (!daily?.date) return null;
  const hours = data.weatherHourly || [];
  const dayHour = hours.length ? pickNearestHistoricalHour(hours, daily.date, 14) : undefined;
  const nightHour = hours.length ? pickNearestHistoricalHour(hours, daily.date, 21) : undefined;
  const windSpeedDay = asString(dayHour?.windSpeed);
  const windSpeedNight = asString(nightHour?.windSpeed);

  return {
    fxDate: asString(daily.date),
    sunrise: asString(daily.sunrise),
    sunset: asString(daily.sunset),
    moonrise: asString(daily.moonrise),
    moonset: asString(daily.moonset),
    moonPhase: asString(daily.moonPhase),
    moonPhaseIcon: '',
    tempMax: asString(daily.tempMax),
    tempMin: asString(daily.tempMin),
    iconDay: asString(dayHour?.icon),
    textDay: asString(dayHour?.text),
    iconNight: asString(nightHour?.icon),
    textNight: asString(nightHour?.text),
    wind360Day: asString(dayHour?.wind360),
    windDirDay: asString(dayHour?.windDir),
    windScaleDay: Number.isFinite(Number.parseFloat(windSpeedDay))
      ? beaufortScaleFromKmh(Number.parseFloat(windSpeedDay))
      : asString(dayHour?.windScale),
    windSpeedDay,
    wind360Night: asString(nightHour?.wind360),
    windDirNight: asString(nightHour?.windDir),
    windScaleNight: Number.isFinite(Number.parseFloat(windSpeedNight))
      ? beaufortScaleFromKmh(Number.parseFloat(windSpeedNight))
      : asString(nightHour?.windScale),
    windSpeedNight,
    humidity: asString(daily.humidity),
    precip: asString(daily.precip),
    pressure: asString(daily.pressure),
    vis: '',
    cloud: '',
    uvIndex: '',
  };
};

const resolveLocationIdFromLonLat = async (lonLat: string): Promise<string> => {
  const data = await fetchFromQWeather<QWeatherGeoLookupResponse>('/geo/v2/city/lookup', { location: lonLat });
  const id = asString(data.location?.[0]?.id);
  if (!id) throw new Error(`未能通过坐标解析和风 LocationID: ${lonLat}`);
  return id;
};

const qw = {
  now: async (location: string): Promise<WeatherNow> => {
    const data = await fetchFromQWeather<QWeatherNowResponse>('/v7/weather/now', { location });
    if (!data.now) throw new Error('和风实时天气返回为空');
    return { ...data.now };
  },
  daily: async (location: string, days: number): Promise<WeatherDaily[]> => {
    const requestedDays = Math.max(1, Math.floor(days));
    const endpoint = resolveDailyEndpoint(requestedDays);
    const data = await fetchFromQWeather<QWeatherDailyResponse>(`/v7/weather/${endpoint}`, { location });
    return (data.daily || []).slice(0, requestedDays).map((day) => {
      const windSpeedDay = Number.parseFloat(asString(day.windSpeedDay));
      const windSpeedNight = Number.parseFloat(asString(day.windSpeedNight));
      return {
        ...day,
        windScaleDay: Number.isFinite(windSpeedDay)
          ? beaufortScaleFromKmh(windSpeedDay)
          : asString(day.windScaleDay),
        windScaleNight: Number.isFinite(windSpeedNight)
          ? beaufortScaleFromKmh(windSpeedNight)
          : asString(day.windScaleNight),
      };
    });
  },
  hourly: async (location: string, hourlySteps: number): Promise<WeatherHourly[]> => {
    const requestedSteps = Math.max(1, Math.floor(hourlySteps));
    const data = await fetchFromQWeather<QWeatherHourlyResponse>('/v7/weather/24h', { location });
    return (data.hourly || []).slice(0, requestedSteps).map((hour) => {
      const windSpeed = Number.parseFloat(asString(hour.windSpeed));
      const windScale = Number.isFinite(windSpeed)
        ? beaufortScaleFromKmh(windSpeed)
        : asString(hour.windScale);
      return { ...hour, windScale };
    });
  },
  indices: async (location: string, type: string = '1,2,3,5,9'): Promise<WeatherIndex[]> => {
    const data = await fetchFromQWeather<QWeatherIndicesResponse>('/v7/indices/1d', { location, type });
    return (data.daily || []).map(index => ({ ...index }));
  },
  warning: async (location: string): Promise<WeatherWarning[]> => {
    const data = await fetchFromQWeather<QWeatherWarningResponse>('/v7/warning/now', { location });
    return (data.warning || []).map(normalizeWarning);
  },
  minutely: async (lat: string, lon: string): Promise<{ summary: string; minutely: MinutelyPrecipitation[] } | null> => {
    const location = `${lon},${lat}`;
    const data = await fetchFromQWeather<QWeatherMinutelyResponse>('/v7/minutely/5m', { location });
    if (!data.summary) return null;
    return {
      summary: data.summary,
      minutely: (data.minutely || []).map(item => ({ ...item })),
    };
  },
  airQuality: async (lat: string, lon: string): Promise<AirQuality | null> => {
    const data = await fetchFromQWeather<QWeatherAirQualityResponse>(`/airquality/v1/current/${lat}/${lon}`);
    return normalizeAirQuality(data);
  },
};

export const getWeatherBundle = async (
  lonLat: string,
  opts: WeatherLookupOptions = {}
): Promise<WeatherBundle> => {
  const libraryCityId = normalizeLibraryCityId(opts.cityId);
  const cached = findLibraryBundle(lonLat, libraryCityId);
  if (cached) return cached;

  const requestKey = makeRequestKey(lonLat, opts);
  const inflight = BUNDLE_INFLIGHT.get(requestKey);
  if (inflight) {
    const bundle = await inflight;
    if (libraryCityId) saveToLibrary(lonLat, { bundle }, libraryCityId);
    return bundle;
  }

  const task = (async () => {
    const { lon, lat } = splitLonLat(lonLat);
    const qLocation = `${lon},${lat}`;
    const dailysteps = opts.dailysteps ?? 15;
    const hourlysteps = opts.hourlysteps ?? 24;
    const shouldFetchWarnings = opts.alert ?? true;

    const [now, daily, hourly, indices, warnings, airQuality] = await Promise.all([
      qw.now(qLocation),
      qw.daily(qLocation, dailysteps),
      qw.hourly(qLocation, hourlysteps),
      qw.indices(qLocation),
      shouldFetchWarnings ? qw.warning(qLocation) : Promise.resolve([]),
      qw.airQuality(lat, lon),
    ]);

    let minutely: WeatherBundle['minutely'] = null;
    try {
      minutely = await qw.minutely(lat, lon);
    } catch {
      minutely = null;
    }

    const bundle: WeatherBundle = { now, daily, hourly, indices, warnings, airQuality, minutely };
    saveToLibrary(lonLat, { bundle }, libraryCityId);
    return bundle;
  })();

  BUNDLE_INFLIGHT.set(requestKey, task);
  try {
    return await task;
  } finally {
    BUNDLE_INFLIGHT.delete(requestKey);
  }
};

export const getAirQualityDailyForecast = async (
  lonLat: string,
  cityId?: string,
): Promise<AirQualityForecastDay[]> => {
  const libraryCityId = normalizeLibraryCityId(cityId);
  const cached = findLibraryAirForecast(lonLat, libraryCityId);
  if (cached) return cached;

  const { lon, lat } = splitLonLat(lonLat);
  const data = await fetchFromQWeather<QWeatherAirQualityDailyResponse>(`/airquality/v1/daily/${lat}/${lon}`);
  const result = (data.days || []).map((day) => {
    const summary = normalizeAirQualityIndexSummary(day.indexes?.[0]);
    return {
      forecastStartTime: asString(day.forecastStartTime),
      forecastEndTime: asString(day.forecastEndTime),
      aqi: summary.aqi,
      level: summary.level,
      category: summary.category,
      primaryPollutant: summary.primaryPollutant,
    };
  }).filter((day) => day.category || day.aqi);
  saveToLibrary(lonLat, { airQualityForecast: result }, libraryCityId);
  return result;
};

export const getHistoricalWeatherDay = async (
  lonLat: string,
  date: Date,
  cityId?: string,
): Promise<WeatherDaily | null> => {
  const libraryCityId = normalizeLibraryCityId(cityId);
  const cached = findLibraryHistorical(lonLat, libraryCityId);
  if (cached) return cached;

  const locationId = await resolveLocationIdFromLonLat(lonLat);
  const data = await fetchFromQWeather<QWeatherHistoricalWeatherResponse>('/v7/historical/weather', {
    location: locationId,
    date: formatDateParam(date),
  });
  const result = normalizeHistoricalDaily(data);
  saveToLibrary(lonLat, { historicalYesterday: result }, libraryCityId);
  return result;
};

/**
 * 当前城市搜索仍使用本地预置城市列表。
 * 如需真实搜索能力，请接入地图服务的地理编码 API。
 */
export const searchCity = async (_location: string): Promise<City[]> => {
  return [];
};
