/**
 * Maps MAML ContentProviderBinder URIs to app store data.
 */
import { getStore } from '../../createAppStore';
import ContentResolver from '../../ContentResolver';
import localeApi from '../../locale';
import { useOsStateStore } from '../../OsStateStore';
import { getEffectiveBuildInfo } from '../../managers/registry';
import QuickSettingsService from '../../QuickSettingsService';
import StatusBarService from '../../StatusBarService';
import { LAUNCHER_STORAGE_KEY, type LauncherWallpaper } from '../../launcher/types';
import { DEFAULT_WALLPAPER_CHOICES } from '../../launcher/layout';
import { getNextTrigger, pad2 } from '../../../system/Clock/utils';
import * as TimeService from '../../TimeService';
import BroadcastBus from '../../BroadcastBus';
import type { VarValue, MamlNode, MamlContentProviderBinder, MamlProviderDependencies } from './types';

/**
 * Map Chinese weather text to Xiaomi widget weather_id.
 *
 * Important:
 * - Background category / particle logic in the original MAML relies on these ids.
 * - 23/24 are haze/float-dust family, 22/25 are hail/freezing-rain family.
 */
function mapWeatherTextToId(text: string): number {
  const normalized = String(text ?? '').trim();
  if (!normalized) return 0;

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

type MemoryWidgetState = {
  cleanableMemory: number;
  lastCleanedMemorySize: number;
  lastUpdatedAt: number;
  lastCleanedAt: number;
};

const memoryWidgetState: MemoryWidgetState = {
  cleanableMemory: 0,
  lastCleanedMemorySize: 0,
  lastUpdatedAt: 0,
  lastCleanedAt: 0,
};

function parseClockTimeToMs(value: unknown, fallbackHours: number): number {
  if (typeof value !== 'string') return fallbackHours * 60 * 60 * 1000;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return fallbackHours * 60 * 60 * 1000;
  const hour = Math.max(0, Math.min(23, parseInt(match[1], 10) || fallbackHours));
  const minute = Math.max(0, Math.min(59, parseInt(match[2], 10) || 0));
  return (hour * 60 + minute) * 60 * 1000;
}

function parseNumericValue(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isFinite(num) ? num : fallback;
}

function parseDeviceMemoryBytes(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1024 ? raw : raw * 1024 * 1024 * 1024;
  }
  const text = String(raw ?? '').trim().toUpperCase();
  const match = /^([\d.]+)\s*(GB|G|MB|M|KB|K|B)?$/.exec(text);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2] ?? 'B';
  const factor = unit.startsWith('G')
    ? 1024 * 1024 * 1024
    : unit.startsWith('M')
      ? 1024 * 1024
      : unit.startsWith('K')
        ? 1024
        : 1;
  return Math.round(value * factor);
}

function normalizeProviderValue(value: unknown): VarValue {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value == null) return '';
  return String(value);
}

function estimateCleanableMemoryBytes(): number {
  const perfMemory = (typeof performance !== 'undefined' ? (performance as any).memory : null) as
    | { jsHeapSizeLimit?: number; usedJSHeapSize?: number; totalJSHeapSize?: number }
    | null;
  if (perfMemory?.jsHeapSizeLimit && perfMemory.usedJSHeapSize != null) {
    const headroom = Math.max(0, perfMemory.jsHeapSizeLimit - perfMemory.usedJSHeapSize);
    const reclaimable = Math.max(0, perfMemory.usedJSHeapSize - (perfMemory.totalJSHeapSize ?? perfMemory.usedJSHeapSize * 0.85));
    const estimated = Math.round(Math.min(Math.max(reclaimable, perfMemory.usedJSHeapSize * 0.08), headroom * 0.25));
    if (estimated > 0) return estimated;
  }

  const build = getEffectiveBuildInfo();
  const deviceBytes = parseDeviceMemoryBytes(build.ramTotal);
  if (deviceBytes > 0) {
    return Math.round(deviceBytes * 0.06);
  }

  const navigatorMemory = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : 0;
  if (typeof navigatorMemory === 'number' && navigatorMemory > 0) {
    return Math.round(navigatorMemory * 1024 * 1024 * 1024 * 0.06);
  }

  return 768 * 1024 * 1024;
}

function syncMemoryWidgetState(): void {
  const now = TimeService.realNow();
  if (memoryWidgetState.lastCleanedAt > 0 && now - memoryWidgetState.lastCleanedAt < 30_000) {
    return;
  }
  if (now - memoryWidgetState.lastUpdatedAt < 5_000) {
    return;
  }
  memoryWidgetState.cleanableMemory = estimateCleanableMemoryBytes();
  memoryWidgetState.lastUpdatedAt = now;
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

function normalizeWeatherCityId(
  requestedCityId: string | null | undefined,
  state: any,
): string {
  const fallbackCityId = state?.selectedCityId ?? '';
  if (!requestedCityId) return fallbackCityId;
  if (requestedCityId === 'located') return 'located';
  return state?.bundlesByCityId?.[requestedCityId] ? requestedCityId : fallbackCityId;
}

function getWeatherData(cityIdOverride?: string): { vars: Record<string, VarValue>; arrays: Record<string, VarValue[]> } {
  const vars: Record<string, VarValue> = {};
  const arrays: Record<string, VarValue[]> = {};
  const store = getStore('weather');
  if (!store) return { vars, arrays };

  const state = store.getState() as any;
  if (!state) return { vars, arrays };

  const cityId = normalizeWeatherCityId(cityIdOverride, state);
  const entry = state.bundlesByCityId?.[cityId];
  const savedCities: any[] = state.savedCities ?? [];
  const bundle = entry?.bundle;

  let cityName = '--';
  if (cityId === 'located') {
    cityName = entry?.locationName ?? '定位中';
  } else {
    const city = savedCities.find((c: any) => c.id === cityId);
    cityName = city?.name ?? '--';
  }

  const now = bundle?.now;
  const daily: any[] = bundle?.daily ?? [];
  const text = now?.text ?? '';
  const temp = now?.temp ?? '--';
  const humidity = now?.humidity ? parseInt(now.humidity, 10) : 0;
  const pressure = now?.pressure ? parseInt(now.pressure, 10) : 0;
  const wind = now?.windDir ? `${now.windDir}${now.windScale}级` : '';

  const weatherId = mapWeatherTextToId(text || daily[0]?.textDay || '');
  const airQuality = bundle?.airQuality;
  const aqi = parseNumericValue(airQuality?.aqi, 0);
  const today = daily[0];
  const temphighs = daily.map((d: any) => d.tempMax ?? '--');
  const templows = daily.map((d: any) => d.tempMin ?? '--');
  const weatherNames = daily.map((d: any) => d.textDay ?? '');
  const weatherTypes = [
    String(weatherId),
    ...daily.slice(1, 7).map((d: any) => String(mapWeatherTextToId(d.textDay ?? ''))),
  ];
  const sunrise = parseClockTimeToMs(today?.sunrise, 6);
  const sunset = parseClockTimeToMs(today?.sunset, 18);

  vars.weather_city_id = cityId;
  vars.weather_location = cityName;
  vars.weather_temperature = temp;
  vars.weather_id = weatherId;
  vars.weather_description = text;
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
  vars.weather_aqi_desc = airQuality?.category ?? '';
  vars.weather_minute_rain = buildMinuteRainPayload(bundle?.minutely, bundle?.forecastKeypoint);
  vars.hasweather = entry ? 1 : 0;
  vars.weather_temphigh_0 = temphighs[0] ?? '--';
  vars.weather_templow_0 = templows[0] ?? '--';

  // Arrays: forecast data
  arrays.weather_temphigh = temphighs;
  arrays.weather_templow = templows;
  arrays.weather_weathernamesfrom = weatherNames;
  arrays.weather_type = weatherTypes;

  return { vars, arrays };
}

function getWeatherColumnData(cityIdOverride?: string): Record<string, VarValue | VarValue[]> {
  const { vars, arrays } = getWeatherData(cityIdOverride);
  const temperature = typeof vars.weather_temperature === 'string'
    ? parseInt(vars.weather_temperature, 10) || 0
    : Number(vars.weather_temperature ?? 0);
  const highs = arrays.weather_temphigh ?? [];
  const lows = arrays.weather_templow ?? [];
  const weatherTypes = arrays.weather_type ?? [];
  const weatherNames = arrays.weather_weathernamesfrom ?? [];

  return {
    city_id: vars.weather_city_id ?? '',
    city_name: vars.weather_location ?? '--',
    weather_type: weatherTypes,
    aqilevel: vars.weather_aqi ?? 0,
    description: vars.weather_description ?? '',
    temperature,
    forecast_type: vars.weather_forecast_type ?? vars.weather_id ?? 0,
    tmphighs: highs,
    tmplows: lows,
    wind: vars.weather_wind ?? '',
    humidity: vars.weather_humidity ?? 0,
    sunrise: vars.weather_sunrise ?? 0,
    sunset: vars.weather_sunset ?? 0,
    pressure: vars.weather_pressure ?? 0,
    weathernamesfrom: weatherNames,
    publish_time: vars.weather_publish_time ?? '',
    temperature_range: `${highs[0] ?? '--'}/${lows[0] ?? '--'}`,
    temperature_unit: 1,
    minute_rain: vars.weather_minute_rain ?? buildMinuteRainPayload(null),
  };
}

function getWallpaperIsLight(): number {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LAUNCHER_STORAGE_KEY) : null;
    if (!raw) return 0;
    const layout = JSON.parse(raw) as { wallpaper?: LauncherWallpaper };
    const wallpaper = layout.wallpaper;
    if (!wallpaper) return 0;
    const choice = DEFAULT_WALLPAPER_CHOICES.find((item) => item.wallpaper.imageUrl === wallpaper.imageUrl);
    return choice && !choice.isDark ? 1 : 0;
  } catch {
    // ignore
  }
  return 0;
}

function getDeviceData(): { vars: Record<string, VarValue>; arrays: Record<string, VarValue[]> } {
  const vars: Record<string, VarValue> = {};
  const arrays: Record<string, VarValue[]> = {};
  const osState = useOsStateStore.getState();
  const statusBar = StatusBarService.getState();

  const batteryLevel = osState.hardware.battery.percent ?? statusBar.batteryPercent ?? 0;
  const charging = osState.hardware.battery.charging ?? statusBar.charging ?? false;
  const fastCharging = osState.hardware.battery.fastCharging ?? statusBar.fastCharging ?? false;

  vars.battery_level = batteryLevel;
  vars.battery_state = charging ? 1 : 0;
  vars.ChargeSpeed = fastCharging ? 2 : (charging ? 1 : 0);
  vars.applied_light_wallpaper = getWallpaperIsLight();
  vars.__miui_version_code = 14;

  return { vars, arrays };
}

function getClockData(): { vars: Record<string, VarValue>; arrays: Record<string, VarValue[]> } {
  const vars: Record<string, VarValue> = {};
  const arrays: Record<string, VarValue[]> = {};
  const store = getStore('clock');
  const alarms = ((store?.getState() as any)?.alarms ?? []) as Array<{
    hour: number;
    minute: number;
    enabled: boolean;
    repeat: string;
    note?: string;
  }>;

  const enabledAlarms = alarms.filter((alarm) => alarm.enabled);
  vars.hasAlarmClock = enabledAlarms.length;
  vars.AlarmDesk = enabledAlarms.length > 0 ? 1 : 0;
  vars.hassteps = 0;
  vars.step_today = 0;
  arrays.Mi_step = [];
  arrays.Mi_begin_time = [];
  arrays.Mi_end_time = [];

  if (enabledAlarms.length === 0) {
    vars.next_alarm_time = '';
    arrays.clock_message = [];
    arrays.clock_enabled = [];
    arrays.clock_hour = [];
    arrays.clock_minute = [];
    arrays.clock_alarmtime = [];
    arrays.clock_daysofweek = [];
    return { vars, arrays };
  }

  const now = TimeService.getDate();
  const nextWithTime = enabledAlarms
    .map((alarm) => ({
      alarm,
      triggerAt: getNextTrigger(alarm as any, now),
    }))
    .sort((a, b) => a.triggerAt - b.triggerAt);

  const weekLabel = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  if (localeApi.getLocale() === 'en') {
    weekLabel.splice(0, weekLabel.length, 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat');
  }
  const nextAlarm = nextWithTime[0];
  const nextDate = TimeService.fromTimestamp(nextAlarm.triggerAt);
  vars.next_alarm_time = `${weekLabel[nextDate.getDay()]} ${pad2(nextDate.getHours())}:${pad2(nextDate.getMinutes())}`;

  const sortedAlarms = nextWithTime.map((item) => item.alarm);
  arrays.clock_message = sortedAlarms.map((alarm) => alarm.note ?? '');
  arrays.clock_enabled = sortedAlarms.map(() => '1');
  arrays.clock_hour = sortedAlarms.map((alarm) => String(alarm.hour));
  arrays.clock_minute = sortedAlarms.map((alarm) => String(alarm.minute));
  arrays.clock_alarmtime = nextWithTime.map((item) => String(item.triggerAt));
  arrays.clock_daysofweek = sortedAlarms.map((alarm) => {
    switch (alarm.repeat) {
      case 'daily':
        return '127';
      case 'weekday':
      case 'workday':
        return '31';
      case 'holiday':
        return '96';
      case 'once':
      default:
        return '0';
    }
  });

  return { vars, arrays };
}

function getPowerProviderData(): Record<string, VarValue | VarValue[]> {
  const osState = useOsStateStore.getState();
  const statusBar = StatusBarService.getState();
  const qs = QuickSettingsService.getState();
  const charging = osState.hardware.battery.charging ?? statusBar.charging ?? false;
  const fastCharging = osState.hardware.battery.fastCharging ?? statusBar.fastCharging ?? false;

  return {
    leftChargeTime: charging ? 45 * 60 * 1000 : 0,
    enduranceTime: 8 * 60 * 60 * 1000,
    powerSaveModeStatus: qs.batterySaverEnabled ? 1 : 0,
    quickChargeStatus: fastCharging ? 1 : 0,
    chargestate: charging ? 1 : 0,
  };
}

function getMemoryProviderData(): Record<string, VarValue | VarValue[]> {
  syncMemoryWidgetState();
  return {
    memoryCleanable: memoryWidgetState.cleanableMemory,
    lastCleanedMemorySize: memoryWidgetState.lastCleanedMemorySize,
  };
}

function getAqiProviderData(): Record<string, VarValue | VarValue[]> {
  const { vars } = getWeatherData();
  return {
    aqi: vars.weather_aqi ?? 0,
    pm25: vars.weather_pm25 ?? 0,
    pm10: vars.weather_pm10 ?? 0,
    so2: vars.weather_so2 ?? 0,
    no2: vars.weather_no2 ?? 0,
    pub_time: vars.weather_publish_time ?? '',
    src: '',
    spot: '',
  };
}

function getWidgetHostFlags(): Record<string, VarValue> {
  const qs = QuickSettingsService.getState();
  const locale = localeApi.getLocale();
  const lang = locale === 'en' ? 'en_US' : 'zh_CN';
  return {
    lang,
    is_bo_cn: '0',
    isPreviewMode: 'false',
    wifi_state: qs.wifiEnabled ? 1 : 0,
    data_state: qs.mobileDataEnabled ? 1 : 0,
    __darkmode: qs.darkModeEnabled ? 1 : 0,
    enable_background_blur: 0,
  };
}

function getWeatherVersionData(): Record<string, VarValue | VarValue[]> {
  return { weather_version: '160004000' };
}

function getStepProviderData(): Record<string, VarValue | VarValue[]> {
  const now = TimeService.getDate();
  const dayStartDate = TimeService.fromTimestamp(now.getTime());
  dayStartDate.setHours(0, 0, 0, 0);
  const dayStart = dayStartDate.getTime();
  const elapsed = now.getTime() - dayStart;
  const totalSteps = 6800;
  const segments = Math.max(1, Math.floor(elapsed / (30 * 60 * 1000)));
  const ids: VarValue[] = [];
  const steps: VarValue[] = [];
  const beginTimes: VarValue[] = [];
  const endTimes: VarValue[] = [];
  const modes: VarValue[] = [];
  const perSegment = Math.floor(totalSteps / segments);
  for (let i = 0; i < segments; i++) {
    ids.push(String(i + 1));
    steps.push(String(i === segments - 1 ? totalSteps - perSegment * (segments - 1) : perSegment));
    beginTimes.push(String(dayStart + i * 30 * 60 * 1000));
    endTimes.push(String(dayStart + (i + 1) * 30 * 60 * 1000));
    modes.push('2');
  }
  return {
    _id: ids,
    _steps: steps,
    _begin_time: beginTimes,
    _end_time: endTimes,
    _mode: modes,
  };
}

function getAlarmProviderData(): Record<string, VarValue | VarValue[]> {
  const { arrays, vars } = getClockData();
  return {
    message: arrays.clock_message ?? [],
    enabled: arrays.clock_enabled ?? [],
    hour: arrays.clock_hour ?? [],
    minutes: arrays.clock_minute ?? [],
    alarmtime: arrays.clock_alarmtime ?? [],
    daysofweek: arrays.clock_daysofweek ?? [],
    hasAlarmClock: vars.hasAlarmClock ?? 0,
  };
}

function getCleanMasterProviderData(): Record<string, VarValue | VarValue[]> {
  const osState = useOsStateStore.getState();
  const build = getEffectiveBuildInfo();
  const totalStorage = parseDeviceMemoryBytes(build.storageTotal ?? '128GB');
  const usedStorage = parseDeviceMemoryBytes(osState.hardware.storage.used) || Math.round(totalStorage * 0.62);
  return {
    garbageSize: Math.round(totalStorage * 0.03),
    storageTotalSize: totalStorage,
    storageUsedSize: Math.min(usedStorage, totalStorage),
    storageAvailableSize: Math.max(0, totalStorage - usedStorage),
  };
}

function getNetworkAssistantProviderData(): Record<string, VarValue | VarValue[]> {
  return {
    _total_limit: [String(10 * 1024 * 1024 * 1024)],
    _used_data: [String(Math.round(3.2 * 1024 * 1024 * 1024))],
    _phone_balance: [''],
    _expire_date: [''],
  };
}

function queryGenericProviderColumns(binder: MamlContentProviderBinder): Record<string, VarValue | VarValue[]> {
  const uri = binder.uriFormat ?? binder.uri ?? '';
  if (!uri.startsWith('content://')) return {};

  try {
    const projection = binder.variables.map((variable) => variable.column).filter(Boolean);
    const cursor = ContentResolver.query<Record<string, unknown>>(uri, projection);
    const items = Array.isArray(cursor?.items) ? cursor.items : [];
    if (items.length === 0) return {};

    const columns: Record<string, VarValue | VarValue[]> = {};
    for (const variable of binder.variables) {
      const values = items.map((item) => normalizeProviderValue(item?.[variable.column]));
      columns[variable.column] = variable.type.endsWith('[]')
        ? values
        : (values[0] ?? '');
    }
    return columns;
  } catch {
    return {};
  }
}

function resolveWeatherCityOverride(ctx?: import('./variables').VarContext): string {
  const customEditLocalId = ctx?.getStr('customEditLocalId') ?? '';
  if (customEditLocalId) return customEditLocalId;
  const selectedCity = ctx?.getStr('selected_city') ?? '';
  if (selectedCity) return selectedCity;
  return '';
}

function getProviderColumns(
  binder: MamlContentProviderBinder,
  ctx?: import('./variables').VarContext,
): Record<string, VarValue | VarValue[]> {
  const generic = queryGenericProviderColumns(binder);
  if (Object.keys(generic).length > 0) return generic;

  const uri = binder.uriFormat ?? binder.uri ?? '';
  const weatherCityOverride = resolveWeatherCityOverride(ctx);
  if (uri.includes('weatherVersionData')) return getWeatherVersionData();
  if (uri.includes('hourlyData')) {
    const weather = getWeatherColumnData(weatherCityOverride);
    return {
      sunrise: weather.sunrise ?? 0,
      sunset: weather.sunset ?? 0,
      minute_rain: weather.minute_rain ?? buildMinuteRainPayload(null),
    };
  }
  if (uri.includes('weatherData') || uri.includes('actualWeatherData')) {
    return getWeatherColumnData(weatherCityOverride);
  }
  if (uri.includes('weatherinfo/aqi')) return getAqiProviderData();
  if (uri.includes('providers.steps') || uri.includes('provider.main/activity/steps')) return getStepProviderData();
  if (uri.includes('deskclock/alarm')) return getAlarmProviderData();
  if (uri.includes('widgetProvider/getPowerData')) return getPowerProviderData();
  if (uri.includes('widgetProvider/getMemoryData')) return getMemoryProviderData();
  if (uri.includes('widgetProvider/getCleanMasterData')) return getCleanMasterProviderData();
  if (uri.includes('networkassistant')) return getNetworkAssistantProviderData();
  if (uri.includes('realtimeLocalWeatherData')) return getWeatherColumnData(weatherCityOverride);
  return {};
}

function parseTrackDurationMs(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const parts = value.split(':').map((part) => parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return 0;
}

function getMusicData(): Record<string, VarValue> {
  const vars: Record<string, VarValue> = {};
  const store = getStore('spotify');
  const state = (store?.getState() as any) ?? null;
  const currentTrack = state?.currentTrack;

  if (!currentTrack) {
    vars['music_control.music_state'] = 0;
    return vars;
  }

  vars['music_control.music_state'] = state?.isPlaying ? 1 : 0;
  vars['music_control.music_position'] = 0;
  vars['music_control.music_duration'] = Math.max(1, parseTrackDurationMs(currentTrack.duration));
  vars['music_control.title'] = currentTrack.title ?? '';
  vars['music_control.artist'] = currentTrack.artist ?? '';
  vars['music_control.package'] = 'com.spotify.music';
  vars['music_control.class'] = 'com.spotify.music.MainActivity';
  return vars;
}

export function applyBinderData(ctx: import('./variables').VarContext, binder: MamlContentProviderBinder): void {
  const columns = getProviderColumns(binder, ctx);
  let maxCount = 0;
  for (const variable of binder.variables) {
    const source = columns[variable.column];
    if (source === undefined) continue;

    if (Array.isArray(source)) {
      const arraySource = source as VarValue[];
      maxCount = Math.max(maxCount, source.length);
      if (variable.type.endsWith('[]')) {
        ctx.setArray(variable.name, arraySource);
      } else {
        const row = variable.row ? Math.max(0, parseInt(variable.row, 10) || 0) : 0;
        ctx.set(
          variable.name,
          (arraySource[row] ?? (variable.type.startsWith('int') || variable.type.startsWith('number') ? 0 : '')) as VarValue,
        );
      }
      continue;
    }

    maxCount = Math.max(maxCount, 1);
    if (variable.type.endsWith('[]')) {
      ctx.setArray(variable.name, [source]);
    } else {
      ctx.set(variable.name, source);
    }
  }

  if (binder.countName) {
    ctx.set(binder.countName, maxCount);
  }
}

function walkBinders(nodes: MamlNode[], visit: (binder: MamlContentProviderBinder) => void): void {
  for (const node of nodes) {
    if (node.tag === 'ContentProviderBinder') {
      visit(node);
      continue;
    }
    if ('children' in node && Array.isArray((node as any).children)) {
      walkBinders((node as any).children, visit);
    }
    if ('normalChildren' in node && Array.isArray((node as any).normalChildren)) {
      walkBinders((node as any).normalChildren, visit);
    }
    if ('pressedChildren' in node && Array.isArray((node as any).pressedChildren)) {
      walkBinders((node as any).pressedChildren, visit);
    }
  }
}

export interface InjectProviderDataOptions {
  nodes?: MamlNode[];
  binders?: MamlContentProviderBinder[];
  dependencies?: Partial<MamlProviderDependencies>;
}

/**
 * Resolve all content provider data and inject into VarContext.
 */
export function injectProviderData(
  ctx: import('./variables').VarContext,
  options: InjectProviderDataOptions = {},
): void {
  const deps: MamlProviderDependencies = {
    weather: options.dependencies?.weather ?? true,
    device: options.dependencies?.device ?? true,
    clock: options.dependencies?.clock ?? true,
    music: options.dependencies?.music ?? true,
    hostFlags: options.dependencies?.hostFlags ?? true,
  };

  if (deps.weather) {
    const requestedCityId = resolveWeatherCityOverride(ctx);
    const weather = getWeatherData(requestedCityId);
    const resolvedCityId = String(weather.vars.weather_city_id ?? requestedCityId ?? 'located') || 'located';
    ctx.setProviderData(weather.vars);
    ctx.setProviderArrayData(weather.arrays);
    ctx.set('customEditLocalId', resolvedCityId);
    ctx.set('selected_city', resolvedCityId);
  }

  if (deps.device) {
    const device = getDeviceData();
    ctx.setProviderData(device.vars);
    ctx.setProviderArrayData(device.arrays);
  }

  if (deps.clock) {
    const clock = getClockData();
    ctx.setProviderData(clock.vars);
    ctx.setProviderArrayData(clock.arrays);
  }

  if (deps.music) {
    ctx.setProviderData(getMusicData());
  }

  if (deps.hostFlags) {
    ctx.setProviderData(getWidgetHostFlags());
  }

  if (options.binders?.length) {
    for (const binder of options.binders) {
      applyBinderData(ctx, binder);
    }
    return;
  }

  if (options.nodes) {
    walkBinders(options.nodes, (binder) => applyBinderData(ctx, binder));
  }
}

export function handleMamlHostBroadcast(
  action: string,
  extras?: Record<string, unknown>,
  valueHints?: Record<string, number>,
): boolean {
  if (action === 'com.miui.intent.action.CLEAN_MEMORY') {
    syncMemoryWidgetState();
    const hintedFreed = Math.max(
      parseNumericValue(extras?.memoryCleanable, 0),
      parseNumericValue(extras?.lastCleanedMemorySize, 0),
      parseNumericValue(valueHints?.cleanableMemory, 0),
      parseNumericValue(valueHints?.memoryCleanable, 0),
      parseNumericValue(valueHints?.memoryCleanableAniVal, 0),
    );
    const freed = Math.max(memoryWidgetState.cleanableMemory, hintedFreed);
    memoryWidgetState.lastCleanedMemorySize = freed;
    memoryWidgetState.cleanableMemory = 0;
    memoryWidgetState.lastCleanedAt = TimeService.realNow();
    memoryWidgetState.lastUpdatedAt = memoryWidgetState.lastCleanedAt;
    return true;
  }

  if (action === 'com.miui.intent.action.VIBRATE') {
    const vibrateMs = Math.max(0, parseNumericValue(extras?.vibrate_milli, 0));
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && vibrateMs > 0) {
      navigator.vibrate(vibrateMs);
    }
    return true;
  }

  if (action === 'miui.intent.action.MAML_WIDGET_ADDED') {
    return true;
  }

  if (action === 'com.miui.intent.action.CHANGE_POWER_SAVE_MODE') {
    const open = extras?.POWER_SAVE_MODE_OPEN;
    const shouldEnable = open === true || open === 1 || open === '1';
    const qs = QuickSettingsService.getState();
    if (qs.batterySaverEnabled !== shouldEnable) {
      QuickSettingsService.set({ batterySaverEnabled: shouldEnable });
    }
    BroadcastBus.sendBroadcast({
      action: 'miui.intent.action.POWER_SAVE_MODE_CHANGED',
      extras: { POWER_SAVE_MODE_OPEN: shouldEnable ? 1 : 0, POWER_SAVE_MODE_OPEN_MAML: shouldEnable ? 1 : 0 },
    });
    return true;
  }

  return false;
}
