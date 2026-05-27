/**
 * Weather widget data source.
 *
 * Responsibilities
 * ----------------
 * 1. {@link WeatherProvider} responds to explicit `<ContentProviderBinder>`
 *    URIs the bundle declares (`apps/Weather/wmr/weather-app-bg/manifest.xml`):
 *    - `content://weather/weatherVersionData` → bundle compat version
 *    - `content://weather/weatherData/4/<cityId>` → current + 7-day forecast
 *      (multi-row cursor: scalar columns repeat, per-day columns differ)
 *    - `content://weather/hourlyData/4/<cityId>` → sunrise/sunset for the day
 *
 * 2. A side-effect call to `registerAmbientAdapter('weather', ...)` populates
 *    the WMR engine's ambient registry with this app's adapter. The adapter
 *    returns the full `weather_*` var/array set the bundle uses without
 *    declaring binders for every name.
 *
 * Loading
 * -------
 * Auto-discovered by `os/ContentResolver.ts:132`'s eager glob
 * (`apps/* /providers/*.ts`). No explicit bootstrap import is needed.
 *
 * Localization
 * ------------
 * All locale-dependent strings (city name, weather description, AQI category,
 * wind label) are formatted inside this module using `apps/Weather/utils/*`.
 * Locale is read fresh on every adapter invocation via `localeApi.getLocale()`
 * — never memoize localized output across calls (see ambientAdapters.ts).
 */
import ContentProvider from '../../../os/ContentProvider';
import ContentResolver from '../../../os/ContentResolver';
import type { ContentUri, ContentValues, Cursor } from '../../../os/types/content';
import { getStore } from '../../../os/createAppStore';
import localeApi, { type Locale } from '../../../os/locale';
import {
  registerAmbientAdapter,
  type WmrAmbientAdapterResult,
} from '../../../os/wmr/engine/ambientAdapters';
import type { VarValue } from '../../../os/wmr/engine/types';
import type { VarContext } from '../../../os/wmr/engine/variables';
import { resolveAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import type { WeatherCityDefinition } from '../types';
import { getAqiLevelLabel, normalizeAqiLevel, type AqiLevel } from '../utils/airQuality';
import { getLocalizedLocationName, getLocalizedWeatherCityName } from '../utils/cityNames';
import { getLocalizedWeatherText, getLocalizedWindDirection } from '../utils/localizedText';

const WEATHER_AUTHORITY = 'weather';
const WEATHER_VERSION_CONSTANT = '160004000';
const FORECAST_DAYS_VISIBLE = 7;

function getProviderStrings(locale: Locale) {
  return resolveAppStrings(strings, stringsEn, locale);
}

// ---------------------------------------------------------------------------
// Weather text → widget weather_id mapping
// ---------------------------------------------------------------------------
//
// The WMR background category / particle logic depends on these ids.
// 23/24 are haze/float-dust family, 22/25 are hail/freezing-rain family.

function mapWeatherTextToWidgetId(text: string): number {
  const normalized = String(text ?? '').trim();
  if (!normalized) return 0;
  const lower = normalized.toLowerCase();

  if (/[a-z]/i.test(normalized)) {
    if (lower.includes('thunder')) return 4;
    if (lower.includes('torrential')) return 6;
    if (lower.includes('heavy') && lower.includes('rain')) return 9;
    if (lower.includes('moderate') && lower.includes('rain')) return 10;
    if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower')) return 8;
    if (lower.includes('blizzard')) return 13;
    if (lower.includes('heavy') && lower.includes('snow')) return 15;
    if (lower.includes('moderate') && lower.includes('snow')) return 16;
    if (lower.includes('snow')) return 17;
    if (lower.includes('sandstorm')) return 18;
    if (lower.includes('dust')) return 23;
    if (lower.includes('haze')) return 24;
    if (lower.includes('sand')) return 20;
    if (lower.includes('fog') || lower.includes('mist')) return 3;
    if (lower.includes('overcast')) return 2;
    if (lower.includes('cloud')) return 1;
    if (lower.includes('clear') || lower.includes('sunny')) return 0;
  }

  if (normalized.includes('雷') && normalized.includes('雨')) return 4;
  if (normalized.includes('特大暴雨')) return 4;
  if (normalized.includes('大暴雨')) return 5;
  if (normalized.includes('暴雨')) return 6;
  if (normalized.includes('大雨')) return 9;
  if (normalized.includes('中雨')) return 10;
  if (normalized.includes('冻雨')) return 25;
  if (normalized.includes('冰雹')) return 22;
  if (normalized.includes('雨夹雪')) return 25;
  if (normalized.includes('阵雨') || normalized.includes('小雨') || normalized.includes('毛毛雨')) return 8;

  if (normalized.includes('暴雪')) return 13;
  if (normalized.includes('大雪')) return 15;
  if (normalized.includes('中雪')) return 16;
  if (normalized.includes('阵雪')) return 14;
  if (normalized.includes('小雪')) return 17;

  if (normalized.includes('强沙尘暴')) return 19;
  if (normalized.includes('沙尘暴')) return 18;
  if (normalized.includes('浮尘') || normalized.includes('扬尘')) return 23;
  if (normalized.includes('霾')) return 24;
  if (normalized.includes('扬沙') || normalized.includes('沙')) return 20;

  if (normalized.includes('浓雾') || normalized.includes('雾')) return 3;
  if (normalized.includes('阴')) return 2;
  if (normalized.includes('多云') || normalized.includes('少云')) return 1;
  if (normalized.includes('晴')) return 0;

  return 0;
}

// ---------------------------------------------------------------------------
// Localization helpers (moved from apps/Weather/wmr/providerLocalization.ts)
// ---------------------------------------------------------------------------

type CityInput = {
  cityId: string;
  rawCityName: string;
  city?: Pick<WeatherCityDefinition, 'id' | 'name'>;
};

// Conservative ASCII-only check: accepts pure Latin city names that can be
// displayed verbatim under English locale (e.g. "Tokyo", "New York").
// Accented characters and apostrophes intentionally fall through to
// formatIdLabel(cityId) — the raw value in those cases is almost always
// still Chinese in the localized stores.
function isAsciiLabel(raw: string): boolean {
  return /^[A-Za-z0-9\s,./_()-]+$/.test(raw);
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

function formatIdLabel(value: string): string {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(' ');
}

function localizeCityName(input: CityInput, locale: Locale): string {
  const s = getProviderStrings(locale);
  const rawCityName = String(input.rawCityName ?? '').trim();

  if (input.cityId === 'located') {
    return getLocalizedLocationName(rawCityName, s);
  }

  if (input.city) {
    return getLocalizedWeatherCityName(input.city, s);
  }

  if (locale !== 'en') {
    return rawCityName || s.unknown_city;
  }

  if (rawCityName && rawCityName !== '--' && isAsciiLabel(rawCityName)) {
    return rawCityName;
  }

  return formatIdLabel(input.cityId) || s.unknown_city;
}

function localizeWeatherText(text: string | undefined, locale: Locale): string {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  return getLocalizedWeatherText(raw, getProviderStrings(locale));
}

function inferAqiLevelByValue(aqi: number): AqiLevel | null {
  if (!Number.isFinite(aqi) || aqi <= 0) return null;
  if (aqi <= 50) return 'excellent';
  if (aqi <= 100) return 'good';
  if (aqi <= 150) return 'light';
  if (aqi <= 200) return 'moderate';
  if (aqi <= 300) return 'heavy';
  return 'severe';
}

function localizeAqiCategory(
  category: string | undefined,
  level: string | undefined,
  aqi: number,
  locale: Locale,
): string {
  const raw = String(category ?? '').trim();
  const aqiLevel = normalizeAqiLevel(raw, level) ?? inferAqiLevelByValue(aqi);
  if (!aqiLevel) return raw;
  return getAqiLevelLabel(aqiLevel, getProviderStrings(locale));
}

function localizeWind(
  windDir: string | undefined,
  windScale: string | undefined,
  locale: Locale,
): string {
  const dir = String(windDir ?? '').trim();
  const scale = String(windScale ?? '').trim();
  if (!dir) return '';

  const s = getProviderStrings(locale);
  const localizedDir = getLocalizedWindDirection(dir, s);
  if (!scale) return localizedDir;

  if (locale === 'en') return `${localizedDir} Force ${scale}`;
  return `${localizedDir}${scale}${s.wind_scale_suffix}`;
}

// ---------------------------------------------------------------------------
// Shared store accessors
// ---------------------------------------------------------------------------

function parseNumericValue(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isFinite(num) ? num : fallback;
}

function parseClockTimeToMs(value: unknown, fallbackHours: number): number {
  if (typeof value !== 'string') return fallbackHours * 60 * 60 * 1000;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return fallbackHours * 60 * 60 * 1000;
  const hour = Math.max(0, Math.min(23, parseInt(match[1], 10) || fallbackHours));
  const minute = Math.max(0, Math.min(59, parseInt(match[2], 10) || 0));
  return (hour * 60 + minute) * 60 * 1000;
}

function buildMinuteRainPayload(
  minutely: { summary: string; minutely: Array<{ precip: string }> } | null | undefined,
  fallbackSummary?: string,
): string {
  const values = (minutely?.minutely ?? [])
    .slice(0, 20)
    .map((item) => ({ value: parseNumericValue(item?.precip, 0) }));
  while (values.length < 20) values.push({ value: 0 });

  return JSON.stringify({
    isShow: minutely ? 'true' : 'false',
    description: minutely?.summary || fallbackSummary || '一小时后无雨',
    values,
  });
}

function normalizeWeatherCityId(requestedCityId: string | null | undefined, state: any): string {
  const fallbackCityId = state?.selectedCityId ?? '';
  if (!requestedCityId) return fallbackCityId;
  if (requestedCityId === 'located') return 'located';
  return state?.bundlesByCityId?.[requestedCityId] ? requestedCityId : fallbackCityId;
}

type WeatherSnapshot = {
  cityId: string;
  cityName: string;
  city?: Pick<WeatherCityDefinition, 'id' | 'name'>;
  bundle: any;
  hasEntry: boolean;
};

function getWeatherSnapshot(cityIdOverride?: string): WeatherSnapshot | null {
  const store = getStore('weather');
  if (!store) return null;
  const state = store.getState() as any;
  if (!state) return null;

  const cityId = normalizeWeatherCityId(cityIdOverride, state);
  const entry = state.bundlesByCityId?.[cityId];
  const savedCities: any[] = state.savedCities ?? [];

  let cityName = '--';
  let city: Pick<WeatherCityDefinition, 'id' | 'name'> | undefined;
  if (cityId === 'located') {
    cityName = entry?.locationName ?? '定位中';
  } else {
    city = savedCities.find((c: any) => c.id === cityId);
    cityName = city?.name ?? '--';
  }

  return {
    cityId,
    cityName,
    city,
    bundle: entry?.bundle,
    hasEntry: Boolean(entry),
  };
}

// ---------------------------------------------------------------------------
// Ambient adapter — populates every weather_* var the bundle uses without
// requiring an explicit binder.
// ---------------------------------------------------------------------------

function resolveWeatherCityOverrideFromCtx(ctx: VarContext): string {
  const customEditLocalId = ctx.getStr('customEditLocalId') ?? '';
  if (customEditLocalId) return customEditLocalId;
  const selectedCity = ctx.getStr('selected_city') ?? '';
  if (selectedCity) return selectedCity;
  return '';
}

function getWeatherAmbient(ctx: VarContext): WmrAmbientAdapterResult {
  const vars: Record<string, VarValue> = {};
  const arrays: Record<string, VarValue[]> = {};

  const locale = localeApi.getLocale();
  const requestedCityId = resolveWeatherCityOverrideFromCtx(ctx);
  const snap = getWeatherSnapshot(requestedCityId);
  if (!snap) return { vars, arrays };

  const { cityId, cityName, city, bundle, hasEntry } = snap;
  const now = bundle?.now;
  const daily: any[] = bundle?.daily ?? [];
  const text = now?.text ?? '';
  const temp = now?.temp ?? '--';
  const humidity = now?.humidity ? parseInt(now.humidity, 10) : 0;
  const pressure = now?.pressure ? parseInt(now.pressure, 10) : 0;
  const wind = localizeWind(now?.windDir, now?.windScale, locale);

  const weatherId = mapWeatherTextToWidgetId(text || daily[0]?.textDay || '');
  const airQuality = bundle?.airQuality;
  const aqi = parseNumericValue(airQuality?.aqi, 0);
  const today = daily[0];
  const temphighs = daily.map((d: any) => d.tempMax ?? '--');
  const templows = daily.map((d: any) => d.tempMin ?? '--');
  const weatherNames = daily.map((d: any) => localizeWeatherText(d.textDay ?? '', locale));
  const weatherTypes: VarValue[] = [
    String(weatherId),
    ...daily.slice(1, FORECAST_DAYS_VISIBLE).map((d: any) => String(mapWeatherTextToWidgetId(d.textDay ?? ''))),
  ];
  const sunrise = parseClockTimeToMs(today?.sunrise, 6);
  const sunset = parseClockTimeToMs(today?.sunset, 18);

  vars.weather_city_id = cityId;
  vars.weather_location = localizeCityName({ cityId, rawCityName: cityName, city }, locale);
  vars.weather_temperature = temp;
  vars.weather_id = weatherId;
  vars.weather_description = localizeWeatherText(text, locale);
  vars.weather_aqi = aqi;
  vars.weather_humidity = humidity;
  vars.weather_pressure = pressure;
  vars.weather_wind = wind;
  vars.weather_sunrise = sunrise;
  vars.weather_sunset = sunset;
  vars.weather_forecast_type = weatherId;
  vars.weather_publish_time = airQuality?.pubTime ?? now?.obsTime ?? '';
  vars.weather_pm25 = parseNumericValue(airQuality?.pm2p5, 0);
  vars.weather_no2 = parseNumericValue(airQuality?.no2, 0);
  vars.weather_pm10 = parseNumericValue(airQuality?.pm10, 0);
  vars.weather_so2 = parseNumericValue(airQuality?.so2, 0);
  vars.weather_aqi_desc = localizeAqiCategory(airQuality?.category, airQuality?.level, aqi, locale);
  vars.weather_minute_rain = buildMinuteRainPayload(bundle?.minutely, bundle?.forecastKeypoint);
  vars.hasweather = hasEntry ? 1 : 0;
  vars.weather_temphigh_0 = temphighs[0] ?? '--';
  vars.weather_templow_0 = templows[0] ?? '--';

  arrays.weather_temphigh = temphighs;
  arrays.weather_templow = templows;
  arrays.weather_weathernamesfrom = weatherNames;
  arrays.weather_type = weatherTypes;

  // Pin the resolved city id so downstream binders that depend on
  // customEditLocalId/selected_city see the same value (matches the legacy
  // behavior in injectProviderData).
  const resolvedCityId = String(vars.weather_city_id ?? requestedCityId ?? 'located') || 'located';
  ctx.set('customEditLocalId', resolvedCityId);
  ctx.set('selected_city', resolvedCityId);

  return { vars, arrays };
}

// ---------------------------------------------------------------------------
// ContentProvider — handles the three explicit URIs the bundle declares.
// ---------------------------------------------------------------------------

function pickProjection<T extends Record<string, any>>(
  item: T,
  projection?: string[],
): Record<string, any> {
  if (!projection || projection.length === 0) return item;
  const out: Record<string, any> = {};
  for (const key of projection) {
    if (key in item) out[key] = item[key];
  }
  return out;
}

// Parse paths like "/weatherData/4/<cityId>" or "/hourlyData/4/<cityId>" —
// the "4" segment is a legacy MIUI widget-version marker we don't otherwise
// care about. Returns the decoded cityId, or empty string if the cityId
// segment is missing/empty (caller should fall back to the store's currently
// selected city). Returns null only when the path doesn't even match the
// expected shape.
//
// We deliberately accept an empty cityId because the WMR renderer runs
// binders BEFORE `reevaluateVars()`, so `uriParas="@localId_dm231d"` (a Var
// that reads `@customEditLocalId`) still evaluates to '' on first render
// even after the weather ambient adapter has set `customEditLocalId` on ctx.
// Treating that as "use the store default" matches the pre-refactor behavior
// where `getWeatherColumnData(resolveWeatherCityOverride(ctx))` short-circuited
// the same way via `normalizeWeatherCityId('', state)`.
function parseCityScopedPath(path: string, op: 'weatherData' | 'hourlyData'): string | null {
  const match = new RegExp(`^/${op}(?:/\\d+)?(?:/(.*))?$`).exec(path);
  if (!match) return null;
  return match[1] ? decodeURIComponent(match[1]) : '';
}

function buildWeatherDataRows(snap: WeatherSnapshot, locale: Locale): Array<Record<string, any>> {
  const { cityId, cityName, city, bundle, hasEntry } = snap;

  // No bundle yet: still return a single placeholder row so the binder's
  // countName="hasweather" sets hasweather >= 1, which the bundle's no-data
  // group (`#hasweather==0`) reads to decide between layout-with-placeholders
  // and the "tap to fetch weather" empty state. Matches the pre-refactor
  // hardcoded-dispatch behavior in `getWeatherColumnData`, which always
  // returned a non-empty record regardless of bundle presence.
  if (!hasEntry) {
    return [{
      city_id: cityId,
      city_name: localizeCityName({ cityId, rawCityName: cityName, city }, locale),
      temperature: 0,
      description: '',
      aqilevel: 0,
      weather_type: '0',
      tmphighs: '--',
      tmplows: '--',
    }];
  }

  const now = bundle?.now;
  const daily: any[] = bundle?.daily ?? [];
  const text = now?.text ?? '';
  const weatherId = mapWeatherTextToWidgetId(text || daily[0]?.textDay || '');
  const temphighs = daily.map((d: any) => d.tempMax ?? '--');
  const templows = daily.map((d: any) => d.tempMin ?? '--');
  const weatherTypes = [
    String(weatherId),
    ...daily.slice(1, FORECAST_DAYS_VISIBLE).map((d: any) =>
      String(mapWeatherTextToWidgetId(d.textDay ?? '')),
    ),
  ];

  const cityNameLocalized = localizeCityName({ cityId, rawCityName: cityName, city }, locale);
  const description = localizeWeatherText(text, locale);
  const temperature = parseNumericValue(now?.temp, 0);
  const aqi = parseNumericValue(bundle?.airQuality?.aqi, 0);
  const rowCount = Math.max(weatherTypes.length, temphighs.length, templows.length, 1);

  const rows: Array<Record<string, any>> = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({
      city_id: cityId,
      city_name: cityNameLocalized,
      temperature,
      description,
      aqilevel: aqi,
      weather_type: weatherTypes[i] ?? weatherTypes[0] ?? '0',
      tmphighs: temphighs[i] ?? temphighs[0] ?? '--',
      tmplows: templows[i] ?? templows[0] ?? '--',
    });
  }
  return rows;
}

function buildHourlyDataRow(snap: WeatherSnapshot): Record<string, any> {
  // Always return a row, even with no bundle. `parseClockTimeToMs` falls back
  // to 6h/18h defaults when the day data is missing — the bundle's render-time
  // expressions (`#weather_sunrise_dm231d+#time0_dm231d` etc.) need real ms
  // values to avoid producing a malformed sky-background timeline.
  const today = snap.hasEntry ? snap.bundle?.daily?.[0] : undefined;
  return {
    sunrise: parseClockTimeToMs(today?.sunrise, 6),
    sunset: parseClockTimeToMs(today?.sunset, 18),
  };
}

export class WeatherProvider extends ContentProvider {
  query(uri: ContentUri, projection?: string[]): Cursor<any> {
    const parsed = ContentResolver.parseUri(uri);
    const locale = localeApi.getLocale();

    if (parsed.path === '/weatherVersionData' || parsed.path === '/weatherVersionData/') {
      const row = { weather_version: WEATHER_VERSION_CONSTANT };
      return { items: [pickProjection(row, projection)], count: 1 };
    }

    const weatherCityId = parseCityScopedPath(parsed.path, 'weatherData');
    if (weatherCityId !== null) {
      const snap = getWeatherSnapshot(weatherCityId);
      if (!snap) return { items: [], count: 0 };
      const rows = buildWeatherDataRows(snap, locale);
      return { items: rows.map((r) => pickProjection(r, projection)), count: rows.length };
    }

    const hourlyCityId = parseCityScopedPath(parsed.path, 'hourlyData');
    if (hourlyCityId !== null) {
      const snap = getWeatherSnapshot(hourlyCityId);
      if (!snap) return { items: [], count: 0 };
      const row = buildHourlyDataRow(snap);
      return { items: [pickProjection(row, projection)], count: 1 };
    }

    return { items: [], count: 0 };
  }

  insert(_uri: ContentUri, _values: ContentValues): ContentUri {
    throw new Error('[WeatherProvider] insert is not supported');
  }

  update(_uri: ContentUri, _values: ContentValues, _where?: string): number {
    return 0;
  }

  delete(_uri: ContentUri, _where?: string): number {
    return 0;
  }

  getType(uri: ContentUri): string {
    const parsed = ContentResolver.parseUri(uri);
    if (parsed.path === '/weatherVersionData') {
      return 'vnd.android.cursor.item/weather-version';
    }
    if (parsed.path.startsWith('/weatherData/')) {
      return 'vnd.android.cursor.dir/weather';
    }
    if (parsed.path.startsWith('/hourlyData/')) {
      return 'vnd.android.cursor.item/weather-hourly';
    }
    return 'vnd.android.cursor.unknown';
  }
}

// ---------------------------------------------------------------------------
// Side-effect registration (runs at module load via ContentResolver glob).
// ---------------------------------------------------------------------------

const weatherProvider = new WeatherProvider();
ContentResolver.registerProvider(WEATHER_AUTHORITY, weatherProvider);
registerAmbientAdapter('weather', getWeatherAmbient);

export default WeatherProvider;
