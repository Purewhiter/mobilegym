import { WEATHER_CONFIG, type WeatherCityDefinition, type WeatherSettings } from '../data';
import type { WeatherBundle, WeatherDaily, WeatherLibrary } from '../types';
import * as TimeService from '../../../os/TimeService';
import { toLocalDateKey } from './dateFormat';
import defaultLibrary from '../data/weatherBundles.json';

export type WeatherCity = WeatherCityDefinition;

export type StoredWeatherBundle = {
  updatedAt: number;
  lonLat: string;
  /**
   * 仅定位页需要：用于城市名展示（主页面与城市管理页保持一致）。
   * 预设/已添加城市一般使用 city.name。
   */
  locationName?: string;
  bundle: WeatherBundle;
  historicalYesterday?: WeatherDaily | null;
};

export type WeatherStateV1 = {
  version: 1;
  /** 'located' 表示定位页；其他为 savedCities[].id */
  selectedCityId: string;
  savedCities: WeatherCity[];
  bundlesByCityId: Record<string, StoredWeatherBundle>;
  settings: WeatherSettings;
  /** 城市搜索历史（城市名列表，最新在前） */
  searchHistory?: string[];
  /**
   * 记录本次在 Weather App 中"实际查看/使用"的城市与 bundle 时间戳，
   * 供 bench 判定稳定读取，避免重复调用外部 API 带来的不一致。
   */
  lastAccess?: {
    cityId: string;
    bundleUpdatedAt?: number;
    at: number;
  };
  /**
   * 天气数据库：缓存层，所有天气查询优先从此处读取。
   * key 为城市 ID 或坐标字符串。数据中的日期字段无意义——
   * 读取时通过 materialize 按 TimeService.now() 动态填充。
   * bench 可通过 setState 预注入数据。
   */
  weatherLibrary?: WeatherLibrary;
};

export type WeatherState = WeatherStateV1;

const nowMs = () => TimeService.now();

const DAY_MS = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(.*)$/;

/**
 * 将 weatherBundles.json 中的所有日期字段整体平移到"以模拟当天为基准"。
 *
 * 快照是离线生成的静态数据，其中 daily[0] 代表生成当天，historicalYesterday
 * 代表生成前一天，hourly/indices/airQuality 等同理。读取时按当天为 day 0 整体
 * 平移偏移量 = 模拟今天 - 快照 day 0，可让前端显示和 bench 判定都看到正确日期。
 *
 * 只改写形如 `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm...` 的字符串，其他字段保持不变。
 */
function shiftDateString(value: string, offsetDays: number): string {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return value;
  const [, y, mo, d, rest] = m;
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const shifted = TimeService.fromTimestamp(base + offsetDays * DAY_MS);
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}${rest}`;
}

function shiftTreeDates<T>(node: T, offsetDays: number): T {
  if (typeof node === 'string') {
    return shiftDateString(node, offsetDays) as unknown as T;
  }
  if (Array.isArray(node)) {
    return node.map((item) => shiftTreeDates(item, offsetDays)) as unknown as T;
  }
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = shiftTreeDates(v, offsetDays);
    }
    return out as unknown as T;
  }
  return node;
}

function rehydrateLibraryDates(raw: WeatherLibrary): WeatherLibrary {
  // 以任意一个 entry 的 bundle.daily[0].fxDate 作为"快照 day 0"锚点
  let anchorKey: string | null = null;
  for (const entry of Object.values(raw)) {
    const first = entry?.bundle?.daily?.[0]?.fxDate;
    if (typeof first === 'string' && ISO_DATE_RE.test(first)) {
      anchorKey = first.slice(0, 10);
      break;
    }
  }
  if (!anchorKey) return raw;

  const todayKey = toLocalDateKey(nowMs());
  if (todayKey === anchorKey) return raw;

  const [ay, am, ad] = anchorKey.split('-').map(Number);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const offsetDays = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(ay, am - 1, ad)) / DAY_MS,
  );
  if (offsetDays === 0) return raw;
  return shiftTreeDates(raw, offsetDays);
}

function normalizeSelectedCityId(state: WeatherStateV1): string {
  const id = String(state.selectedCityId ?? '').trim();
  if (id === 'located') return 'located';
  if (id && state.savedCities.some((c) => c.id === id)) return id;
  return 'located';
}

export function getDefaultWeatherState(): WeatherStateV1 {
  return {
    version: 1,
    selectedCityId: WEATHER_CONFIG.defaultSelectedCityId,
    savedCities: [...WEATHER_CONFIG.savedCities],
    bundlesByCityId: {},
    settings: { ...WEATHER_CONFIG.settings },
    weatherLibrary: rehydrateLibraryDates(
      (defaultLibrary as unknown as WeatherLibrary) ?? {},
    ),
  };
}

export function upsertSavedCity(state: WeatherStateV1, city: WeatherCity): WeatherStateV1 {
  const existsIdx = state.savedCities.findIndex((c) => c.id === city.id);
  const savedCities = [...state.savedCities];
  if (existsIdx >= 0) {
    savedCities[existsIdx] = city;
  } else {
    savedCities.push(city);
  }
  const next: WeatherStateV1 = { ...state, savedCities };
  next.selectedCityId = normalizeSelectedCityId(next);
  return next;
}

export function removeSavedCity(state: WeatherStateV1, cityId: string): WeatherStateV1 {
  const id = String(cityId ?? '').trim();
  if (!id) return state;
  const savedCities = state.savedCities.filter((c) => c.id !== id);
  const bundlesByCityId = { ...state.bundlesByCityId };
  delete bundlesByCityId[id];
  const next: WeatherStateV1 = { ...state, savedCities, bundlesByCityId };
  next.selectedCityId = normalizeSelectedCityId(next);
  return next;
}

export function setSelectedCityId(state: WeatherStateV1, cityId: string): WeatherStateV1 {
  const id = String(cityId ?? '').trim();
  const next: WeatherStateV1 = { ...state, selectedCityId: id };
  next.selectedCityId = normalizeSelectedCityId(next);
  return next;
}

export function setStoredBundle(
  state: WeatherStateV1,
  cityId: string,
  payload: { lonLat: string; bundle: WeatherBundle; locationName?: string; updatedAt?: number }
): WeatherStateV1 {
  const id = String(cityId ?? '').trim();
  const lonLat = String(payload.lonLat ?? '').trim();
  if (!id || !lonLat) return state;
  const prevEntry = state.bundlesByCityId[id];
  const todayKey = toLocalDateKey(nowMs());
  const normalizedDaily = payload.bundle.daily.filter((day) => String(day.fxDate ?? '').trim() >= todayKey);
  const entry: StoredWeatherBundle = {
    updatedAt: payload.updatedAt ?? nowMs(),
    lonLat,
    locationName: payload.locationName ?? prevEntry?.locationName,
    bundle: {
      ...payload.bundle,
      daily: normalizedDaily,
    },
    historicalYesterday: prevEntry?.historicalYesterday,
  };
  return {
    ...state,
    bundlesByCityId: {
      ...state.bundlesByCityId,
      [id]: entry,
    },
  };
}

export function setHistoricalYesterday(
  state: WeatherStateV1,
  cityId: string,
  historicalYesterday: WeatherDaily | null,
): WeatherStateV1 {
  const id = String(cityId ?? '').trim();
  const prevEntry = state.bundlesByCityId[id];
  if (!id || !prevEntry) return state;
  return {
    ...state,
    bundlesByCityId: {
      ...state.bundlesByCityId,
      [id]: {
        ...prevEntry,
        historicalYesterday,
      },
    },
  };
}

export function isBundleFresh(entry: StoredWeatherBundle | undefined, ttlMs: number): boolean {
  if (!entry) return false;
  const ttl = Math.max(0, Number(ttlMs));
  if (!Number.isFinite(ttl)) return true;
  if (ttl === 0) return false;
  return nowMs() - entry.updatedAt <= ttl;
}

const MAX_SEARCH_HISTORY = 10;

export function addSearchHistory(state: WeatherStateV1, cityName: string): WeatherStateV1 {
  const name = cityName.trim();
  if (!name) return state;
  const prev = state.searchHistory ?? [];
  const filtered = prev.filter((n) => n !== name);
  return { ...state, searchHistory: [name, ...filtered].slice(0, MAX_SEARCH_HISTORY) };
}

export function clearSearchHistory(state: WeatherStateV1): WeatherStateV1 {
  return { ...state, searchHistory: [] };
}

export function setLastAccess(
  state: WeatherStateV1,
  cityId: string,
  bundleUpdatedAt?: number
): WeatherStateV1 {
  return {
    ...state,
    lastAccess: {
      cityId,
      bundleUpdatedAt,
      at: nowMs(),
    },
  };
}
