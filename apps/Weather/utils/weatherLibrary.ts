/**
 * 天气数据库读写层。
 *
 * - 所有天气查询先查库，命中则 materialize（动态填充日期）后返回标准类型
 * - 未命中时由调用方走真实 API，API 返回后回填到库
 * - 库中日期字段无意义（daily[0] = 今天，[1] = 明天 …），读取时按 TimeService.now() 重写
 */
import type {
  WeatherBundle,
  WeatherDaily,
  AirQualityForecastDay,
  WeatherLibraryEntry,
} from '../types';
import * as TimeService from '../../../os/TimeService';
import { toLocalDateKey } from './dateFormat';
import { useWeatherStore } from '../state';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// ---------------------------------------------------------------------------
// Date materialisation
// ---------------------------------------------------------------------------

function nowIso(): string {
  return TimeService.getDate().toISOString();
}

function hourBaseTs(): number {
  const d = TimeService.getDate();
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

export function materializeBundle(raw: WeatherBundle): WeatherBundle {
  const now = TimeService.now();
  const today = toLocalDateKey(now);
  const nowStr = nowIso();
  const hBase = hourBaseTs();

  return {
    now: { ...raw.now, obsTime: nowStr },
    daily: raw.daily.map((day, i) => ({
      ...day,
      fxDate: toLocalDateKey(now + i * DAY_MS),
    })),
    hourly: raw.hourly.map((hour, i) => ({
      ...hour,
      fxTime: TimeService.fromTimestamp(hBase + i * HOUR_MS).toISOString(),
    })),
    indices: raw.indices.map((idx) => ({ ...idx, date: today })),
    warnings: raw.warnings.map((w) => ({
      ...w,
      pubTime: nowStr,
      startTime: w.startTime ? nowStr : '',
      endTime: w.endTime
        ? TimeService.fromTimestamp(now + DAY_MS).toISOString()
        : '',
    })),
    airQuality: raw.airQuality
      ? { ...raw.airQuality, pubTime: nowStr }
      : null,
    minutely: raw.minutely
      ? {
          summary: raw.minutely.summary,
          minutely: raw.minutely.minutely.map((m, i) => ({
            ...m,
            fxTime: TimeService.fromTimestamp(now + i * 5 * 60_000).toISOString(),
          })),
        }
      : null,
  };
}

export function materializeHistorical(
  raw: WeatherDaily | null | undefined,
): WeatherDaily | null {
  if (!raw) return null;
  return { ...raw, fxDate: toLocalDateKey(TimeService.now() - DAY_MS) };
}

export function materializeAirForecast(
  raw: AirQualityForecastDay[],
): AirQualityForecastDay[] {
  const now = TimeService.now();
  return raw.map((day, i) => {
    const dateKey = toLocalDateKey(now + i * DAY_MS);
    return {
      ...day,
      forecastStartTime: `${dateKey}T00:00:00`,
      forecastEndTime: `${dateKey}T23:59:59`,
    };
  });
}

// ---------------------------------------------------------------------------
// Coordinate matching
// ---------------------------------------------------------------------------

function coordsClose(a: string, b: string): boolean {
  const [aLon, aLat] = a.split(',').map(Number);
  const [bLon, bLat] = b.split(',').map(Number);
  if (!Number.isFinite(aLon) || !Number.isFinite(bLon)) return false;
  return Math.abs(aLon - bLon) < 0.01 && Math.abs(aLat - bLat) < 0.01;
}

function findRawEntry(
  lonLat: string,
): { key: string; entry: WeatherLibraryEntry } | null {
  const library = useWeatherStore.getState().weatherLibrary ?? {};
  for (const [key, entry] of Object.entries(library)) {
    if (entry.lonLat === lonLat || coordsClose(entry.lonLat, lonLat)) {
      return { key, entry };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public read API — returns materialised (date-filled) data
// ---------------------------------------------------------------------------

export function findLibraryBundle(lonLat: string): WeatherBundle | null {
  const found = findRawEntry(lonLat);
  return found?.entry.bundle ? materializeBundle(found.entry.bundle) : null;
}

export function findLibraryHistorical(lonLat: string): WeatherDaily | null {
  const found = findRawEntry(lonLat);
  return found ? materializeHistorical(found.entry.historicalYesterday) : null;
}

export function findLibraryAirForecast(
  lonLat: string,
): AirQualityForecastDay[] | null {
  const found = findRawEntry(lonLat);
  return found?.entry.airQualityForecast
    ? materializeAirForecast(found.entry.airQualityForecast)
    : null;
}

export function findLibraryLocationName(lonLat: string): string | null {
  const found = findRawEntry(lonLat);
  return found?.entry.locationName ?? null;
}

// ---------------------------------------------------------------------------
// Public write API — saves raw (un-materialised) data to the store
// ---------------------------------------------------------------------------

export function saveToLibrary(
  lonLat: string,
  data: Partial<Omit<WeatherLibraryEntry, 'lonLat'>>,
): void {
  useWeatherStore.setState((prev) => {
    const library = prev.weatherLibrary ?? {};
    let key: string | null = null;
    for (const [k, entry] of Object.entries(library)) {
      if (entry.lonLat === lonLat || coordsClose(entry.lonLat, lonLat)) {
        key = k;
        break;
      }
    }
    if (!key) key = lonLat;
    const existing = library[key] ?? { lonLat };
    return {
      ...prev,
      weatherLibrary: {
        ...library,
        [key]: { ...existing, ...data },
      },
    };
  }, true);
}
