/**
 * System Location Service
 * 
 * Provides a centralized way to get device location.
 * Supports two modes:
 * 1. Real location: Uses browser's geolocation API
 * 2. Simulated location: Uses a manually specified location
 * 
 * All apps should use this service instead of directly calling navigator.geolocation
 */

import { netJson } from './NetworkService';
import { debouncedSetItem } from './debouncedPersist';
import { now as timeNow } from './TimeService';
import { realNow } from './TimeService';
import { SIMULATOR_CONFIG } from './data';
import { createVolatileOsStore } from './createOsStore';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface LocationError {
  code: 1 | 2 | 3; // PERMISSION_DENIED | POSITION_UNAVAILABLE | TIMEOUT
  message: string;
}

export interface LocationConfig {
  mode: 'real' | 'simulated';
  simulatedLocation?: LocationCoords | string; // Can be preset name or coordinates
  // Optional: simulate location error
  simulateError?: LocationError;
}

export type ReverseGeocodeResult = {
  formattedAddress: string;
  province?: string;
  city?: string;
  district?: string;
  township?: string;
  street?: string;
  streetNumber?: string;
  adcode?: string;
  citycode?: string;
  neighborhood?: string;
  building?: string;
  location: { latitude: number; longitude: number };
  source: 'amap';
  raw?: unknown;
};

// Preset locations for common cities
export const PRESET_LOCATIONS: Record<string, LocationCoords> = {
  // China
  beijing: { latitude: 39.9042, longitude: 116.4074, accuracy: 100 },
  shanghai: { latitude: 31.2304, longitude: 121.4737, accuracy: 100 },
  guangzhou: { latitude: 23.1291, longitude: 113.2644, accuracy: 100 },
  shenzhen: { latitude: 22.5431, longitude: 114.0579, accuracy: 100 },
  hangzhou: { latitude: 30.2741, longitude: 120.1551, accuracy: 100 },
  chengdu: { latitude: 30.5728, longitude: 104.0668, accuracy: 100 },
  wuhan: { latitude: 30.5928, longitude: 114.3055, accuracy: 100 },
  nanjing: { latitude: 32.0603, longitude: 118.7969, accuracy: 100 },
  xian: { latitude: 34.3416, longitude: 108.9398, accuracy: 100 },
  chongqing: { latitude: 29.4316, longitude: 106.9123, accuracy: 100 },
  tianjin: { latitude: 39.3434, longitude: 117.3616, accuracy: 100 },
  suzhou: { latitude: 31.2990, longitude: 120.5853, accuracy: 100 },
  hongkong: { latitude: 22.3193, longitude: 114.1694, accuracy: 100 },
  macau: { latitude: 22.1987, longitude: 113.5439, accuracy: 100 },
  taipei: { latitude: 25.0330, longitude: 121.5654, accuracy: 100 },
  // International
  tokyo: { latitude: 35.6762, longitude: 139.6503, accuracy: 100 },
  seoul: { latitude: 37.5665, longitude: 126.9780, accuracy: 100 },
  singapore: { latitude: 1.3521, longitude: 103.8198, accuracy: 100 },
  london: { latitude: 51.5074, longitude: -0.1278, accuracy: 100 },
  paris: { latitude: 48.8566, longitude: 2.3522, accuracy: 100 },
  newyork: { latitude: 40.7128, longitude: -74.0060, accuracy: 100 },
  losangeles: { latitude: 34.0522, longitude: -118.2437, accuracy: 100 },
  sydney: { latitude: -33.8688, longitude: 151.2093, accuracy: 100 },
};

// ── Zustand volatile store for observable location state ──

interface LocationServiceState {
  mode: 'real' | 'simulated';
  simulatedLocation: LocationCoords | null;
  simulateError: LocationError | null;
}

const _cfgLoc = SIMULATOR_CONFIG.location.simulatedLocation;
const _resolvedCfgLoc: LocationCoords | undefined =
  typeof _cfgLoc === 'string'
    ? PRESET_LOCATIONS[_cfgLoc.toLowerCase()]
    : _cfgLoc;

const useLocationStore = createVolatileOsStore<LocationServiceState>(
  'location',
  {
    mode: (SIMULATOR_CONFIG.location.mode ?? 'simulated') as 'real' | 'simulated',
    simulatedLocation: _resolvedCfgLoc ?? PRESET_LOCATIONS.beijing,
    simulateError: null,
  },
);

const REVERSE_GEOCODE_CACHE_L1 = new Map<string, { expiresAt: number; value: ReverseGeocodeResult }>();
const REVERSE_GEOCODE_CACHE_PREFIX = 'mobile-gym:geocode:regeo:';
const REVERSE_GEOCODE_DEFAULT_TTL_MS = 10 * 60 * 1000;

type AMapRegeoResponse = {
  status: '0' | '1';
  info: string;
  infocode: string;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      province?: string;
      city?: string | string[];
      district?: string;
      township?: string;
      neighborhood?: { name?: string };
      building?: { name?: string };
      streetNumber?: { street?: string; number?: string };
      adcode?: string;
      citycode?: string;
    };
  };
};

function geocodeNowMs() {
  return realNow();
}

function roundCoord(n: number, digits = 5) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function makeReverseGeocodeCacheKey(
  latitude: number,
  longitude: number,
  opts: { radius?: number; extensions?: 'base' | 'all' },
) {
  const lat = roundCoord(latitude, 5);
  const lon = roundCoord(longitude, 5);
  const radius = opts.radius ?? 1000;
  const ext = opts.extensions ?? 'base';
  return `${lon},${lat}|r=${radius}|ext=${ext}`;
}

function readReverseGeocodeCache(key: string): ReverseGeocodeResult | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null;
  try {
    const raw = window.localStorage.getItem(REVERSE_GEOCODE_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt: number; value: ReverseGeocodeResult };
    if (!parsed?.expiresAt || parsed.expiresAt <= geocodeNowMs()) {
      window.localStorage.removeItem(REVERSE_GEOCODE_CACHE_PREFIX + key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeReverseGeocodeCache(key: string, value: ReverseGeocodeResult, ttlMs: number) {
  if (typeof window === 'undefined' || !('localStorage' in window)) return;
  debouncedSetItem(
    REVERSE_GEOCODE_CACHE_PREFIX + key,
    JSON.stringify({ expiresAt: geocodeNowMs() + ttlMs, value }),
  );
}

function normalizeCity(city?: string | string[]) {
  if (!city) return undefined;
  if (Array.isArray(city)) return city[0];
  return city;
}

/**
 * Initialize the location service with a configuration
 */
export function initLocationService(config: LocationConfig): void {
  let resolvedLocation: LocationCoords | null = null;
  const simLoc = config.simulatedLocation;
  if (simLoc) {
    if (typeof simLoc === 'string') {
      resolvedLocation = PRESET_LOCATIONS[simLoc.toLowerCase()] ?? null;
    } else {
      resolvedLocation = simLoc;
    }
  }
  useLocationStore.setState({
    mode: config.mode,
    simulatedLocation: resolvedLocation,
    simulateError: config.simulateError ?? null,
  });
}

/**
 * Get the current location configuration
 */
export function getLocationConfig(): LocationConfig {
  const s = useLocationStore.getState();
  return {
    mode: s.mode,
    simulatedLocation: s.simulatedLocation ?? undefined,
    simulateError: s.simulateError ?? undefined,
  };
}

/**
 * Set location mode to real (uses browser geolocation)
 */
export function useRealLocation(): void {
  useLocationStore.setState({ mode: 'real', simulatedLocation: null, simulateError: null });
}

/**
 * Set location mode to simulated with specific coordinates
 * @param coords - LocationCoords object or preset name (e.g., 'beijing', 'shanghai')
 */
export function useSimulatedLocation(coords: LocationCoords | string): void {
  if (typeof coords === 'string') {
    const preset = PRESET_LOCATIONS[coords.toLowerCase()];
    if (preset) {
      useLocationStore.setState({ mode: 'simulated', simulatedLocation: preset, simulateError: null });
    } else {
      console.error(`Unknown location preset: ${coords}. Available: ${Object.keys(PRESET_LOCATIONS).join(', ')}`);
    }
  } else {
    useLocationStore.setState({ mode: 'simulated', simulatedLocation: coords, simulateError: null });
  }
}

/**
 * Simulate a location error
 * @param code - Error code: 1 (PERMISSION_DENIED), 2 (POSITION_UNAVAILABLE), 3 (TIMEOUT)
 * @param message - Optional error message
 */
export function simulateLocationError(code: 1 | 2 | 3, message?: string): void {
  const defaultMessages: Record<number, string> = {
    1: '用户拒绝了位置访问请求',
    2: '位置信息不可用',
    3: '获取位置信息超时',
  };
  useLocationStore.setState({
    mode: 'simulated',
    simulateError: { code, message: message || defaultMessages[code] },
  });
}

/**
 * Clear simulated error and return to normal simulated location
 */
export function clearSimulatedError(): void {
  const s = useLocationStore.getState();
  useLocationStore.setState({
    simulateError: null,
    simulatedLocation: s.simulatedLocation ?? PRESET_LOCATIONS.beijing,
  });
}

/**
 * Get current simulated coordinates (only works in simulated mode)
 * Returns null if in real mode or if error is being simulated
 */
export function getSimulatedCoords(): LocationCoords | null {
  const s = useLocationStore.getState();
  if (s.mode === 'simulated' && !s.simulateError && s.simulatedLocation) {
    return { ...s.simulatedLocation };
  }
  return null;
}

/**
 * Create a mock GeolocationPosition object from LocationCoords
 * Uses type assertion since we're creating a mock object
 */
function createPosition(coords: LocationCoords): GeolocationPosition {
  const position = {
    coords: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? 100,
      altitude: coords.altitude ?? null,
      altitudeAccuracy: coords.altitudeAccuracy ?? null,
      heading: coords.heading ?? null,
      speed: coords.speed ?? null,
      toJSON() {
        return {
          latitude: this.latitude,
          longitude: this.longitude,
          accuracy: this.accuracy,
          altitude: this.altitude,
          altitudeAccuracy: this.altitudeAccuracy,
          heading: this.heading,
          speed: this.speed,
        };
      },
    },
    timestamp: timeNow(),
    toJSON() {
      return {
        coords: this.coords.toJSON(),
        timestamp: this.timestamp,
      };
    },
  };
  return position as GeolocationPosition;
}

/**
 * Create a mock GeolocationPositionError object
 */
function createPositionError(error: LocationError): GeolocationPositionError {
  const PERMISSION_DENIED = 1;
  const POSITION_UNAVAILABLE = 2;
  const TIMEOUT = 3;

  return {
    code: error.code,
    message: error.message,
    PERMISSION_DENIED,
    POSITION_UNAVAILABLE,
    TIMEOUT,
  };
}

/**
 * Get current position - replacement for navigator.geolocation.getCurrentPosition
 * 
 * In simulated mode, immediately returns the configured location or error.
 * In real mode, delegates to the browser's geolocation API.
 */
export function getCurrentPosition(
  successCallback: PositionCallback,
  errorCallback?: PositionErrorCallback | null,
  options?: PositionOptions
): void {
  const s = useLocationStore.getState();
  if (s.mode === 'simulated') {
    if (s.simulateError) {
      if (errorCallback) {
        setTimeout(() => {
          errorCallback(createPositionError(s.simulateError!));
        }, 0);
      }
    } else {
      const coords = s.simulatedLocation ?? PRESET_LOCATIONS.beijing;
      setTimeout(() => {
        successCallback(createPosition(coords));
      }, 0);
    }
  } else {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(successCallback, errorCallback ?? undefined, options);
    } else {
      if (errorCallback) {
        errorCallback(createPositionError({
          code: 2,
          message: '浏览器不支持地理定位',
        }));
      }
    }
  }
}

/**
 * Watch position - replacement for navigator.geolocation.watchPosition
 * 
 * In simulated mode, returns the configured location once and doesn't update.
 * In real mode, delegates to the browser's geolocation API.
 */
export function watchPosition(
  successCallback: PositionCallback,
  errorCallback?: PositionErrorCallback | null,
  options?: PositionOptions
): number {
  const s = useLocationStore.getState();
  if (s.mode === 'simulated') {
    getCurrentPosition(successCallback, errorCallback, options);
    return -1;
  } else {
    if ('geolocation' in navigator) {
      return navigator.geolocation.watchPosition(successCallback, errorCallback ?? undefined, options);
    } else {
      if (errorCallback) {
        errorCallback(createPositionError({
          code: 2,
          message: '浏览器不支持地理定位',
        }));
      }
      return -1;
    }
  }
}

/**
 * Clear watch - replacement for navigator.geolocation.clearWatch
 */
export function clearWatch(watchId: number): void {
  if (watchId !== -1 && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  opts: { radius?: number; extensions?: 'base' | 'all' } = {},
): Promise<ReverseGeocodeResult> {
  const cacheKey = makeReverseGeocodeCacheKey(latitude, longitude, opts);
  const currentTime = geocodeNowMs();

  const hit1 = REVERSE_GEOCODE_CACHE_L1.get(cacheKey);
  if (hit1 && hit1.expiresAt > currentTime) return hit1.value;

  const hit2 = readReverseGeocodeCache(cacheKey);
  if (hit2) {
    REVERSE_GEOCODE_CACHE_L1.set(cacheKey, {
      expiresAt: currentTime + REVERSE_GEOCODE_DEFAULT_TTL_MS,
      value: hit2,
    });
    return hit2;
  }

  const amapKey = (import.meta as any).env?.VITE_AMAP_API_KEY as string | undefined;
  if (!amapKey) throw new Error('缺少 VITE_AMAP_API_KEY：请在 `.env` 中设置');

  const location = `${longitude},${latitude}`;
  const upstream = new URL('https://restapi.amap.com/v3/geocode/regeo');
  upstream.searchParams.set('key', amapKey);
  upstream.searchParams.set('location', location);
  upstream.searchParams.set('radius', String(opts.radius ?? 1000));
  upstream.searchParams.set('extensions', opts.extensions ?? 'base');
  upstream.searchParams.set('output', 'JSON');

  const data = await netJson<AMapRegeoResponse>(upstream.toString());
  if (data.status !== '1') {
    throw new Error(`反地理编码失败：${data.info || 'unknown error'} (${data.infocode || '-'})`);
  }

  const ac = data.regeocode?.addressComponent;
  const result: ReverseGeocodeResult = {
    formattedAddress: data.regeocode?.formatted_address || '',
    province: ac?.province,
    city: normalizeCity(ac?.city),
    district: ac?.district,
    township: ac?.township,
    street: ac?.streetNumber?.street,
    streetNumber: ac?.streetNumber?.number,
    adcode: ac?.adcode,
    citycode: ac?.citycode,
    neighborhood: ac?.neighborhood?.name,
    building: ac?.building?.name,
    location: { latitude, longitude },
    source: 'amap',
    raw: data,
  };

  REVERSE_GEOCODE_CACHE_L1.set(cacheKey, {
    expiresAt: currentTime + REVERSE_GEOCODE_DEFAULT_TTL_MS,
    value: result,
  });
  writeReverseGeocodeCache(cacheKey, result, REVERSE_GEOCODE_DEFAULT_TTL_MS);

  return result;
}

// Expose to window for Agent access
if (typeof window !== 'undefined') {
  window.__SIM_LOCATION__ = {
    getCurrentPosition,
    watchPosition,
    clearWatch,
    setRealLocation: useRealLocation,
    setSimulatedLocation: useSimulatedLocation,
    simulateError: simulateLocationError,
    clearError: clearSimulatedError,
    getConfig: getLocationConfig,
    getCoords: getSimulatedCoords,
    presets: PRESET_LOCATIONS,
  };
}
