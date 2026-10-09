/**
 * 离线路线快照：routes.json + localStorage 增量；起终点需在快照区域内匹配。
 */
import type { Locale } from '../../../os/locale';
import type { OfflinePlaceRow } from './offlinePlaceStore';
import { OFFLINE_SNAPSHOT_MAX_M, loadPlacesSnapshot } from './offlinePlaceStore';

/** 内部双语文本对 */
type BiText = { zh: string; en: string };

function pickText(field: string | BiText | undefined | null, locale: Locale): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return locale === 'en' ? (field.en || field.zh || '') : (field.zh || field.en || '');
}

/** 消费方看到的纯 string 路线结果 */
export type OfflineRoutePayload = {
  mode: string;
  duration: string;
  distance: string;
  distance_meters: number;
  duration_seconds: number;
  encodedPolyline: string | null;
  endLocation: { lat: number; lng: number } | null;
  routeLabels?: string[];
  steps: Array<{
    instruction: string;
    distance: string;
    distanceMeters: number;
    maneuver?: string;
  }>;
};

export type RouteTravelModeLike =
  | google.maps.TravelMode
  | 'DRIVING'
  | 'WALKING'
  | 'TRANSIT'
  | 'BICYCLING';

/** 快照/缓存中的原始存储类型（字段可能是 BiText） */
type OfflineRoutePayloadRaw = {
  mode: string;
  duration: string | BiText;
  distance: string | BiText;
  distance_meters: number;
  duration_seconds: number;
  encodedPolyline: string | null;
  endLocation: { lat: number; lng: number } | null;
  routeLabels?: string[];
  steps: Array<{
    instruction: string | BiText;
    distance: string | BiText;
    distanceMeters: number;
    maneuver?: string;
  }>;
};

function resolveRoutePayload(raw: OfflineRoutePayloadRaw, locale: Locale): OfflineRoutePayload {
  return {
    mode: raw.mode,
    duration: pickText(raw.duration, locale),
    distance: pickText(raw.distance, locale),
    distance_meters: raw.distance_meters,
    duration_seconds: raw.duration_seconds,
    encodedPolyline: raw.encodedPolyline,
    endLocation: raw.endLocation,
    routeLabels: raw.routeLabels,
    steps: (raw.steps || []).map((s) => ({
      instruction: pickText(s.instruction, locale),
      distance: pickText(s.distance, locale),
      distanceMeters: s.distanceMeters,
      maneuver: s.maneuver,
    })),
  };
}

const LS_ROUTES_KEY = 'map_offline_routes';
const NEAR_POI_MATCH_M = 50;

type RoutesSnapshot = {
  location: { lat: number; lng: number };
  routes: Record<string, OfflineRoutePayloadRaw>;
};

let routesSnapshotPromise: Promise<RoutesSnapshot | null> | null = null;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// routes.json 体积大（约 8MB），用 fetch 加载以避开 Vite ESM 转换管线
// （否则会被打进 JS chunk），模式同 apps/Bilibili/data/loader.ts。
const routesJsonUrl = new URL('../data/routes.json', import.meta.url).href;

async function loadRoutesSnapshot(): Promise<RoutesSnapshot | null> {
  if (!routesSnapshotPromise) {
    routesSnapshotPromise = fetch(routesJsonUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${routesJsonUrl}`);
        return r.json();
      })
      .then(
        (data) => data as RoutesSnapshot,
        () => null,
      );
  }
  return routesSnapshotPromise;
}

async function loadPlacesForMatch(): Promise<Record<string, OfflinePlaceRow> | null> {
  // 复用 offlinePlaceStore 的 fetch 加载器：places.json 全局只拉取一份，
  // 与原先两处 `import('../data/places.json')` 共享 ES 模块缓存的行为一致。
  const snap = await loadPlacesSnapshot();
  return snap?.places ?? null;
}

function readRouteCache(): Record<string, OfflineRoutePayloadRaw> {
  try {
    const raw = localStorage.getItem(LS_ROUTES_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as { routes?: Record<string, OfflineRoutePayloadRaw> };
    return p.routes ?? {};
  } catch {
    return {};
  }
}

function writeRouteCache(routes: Record<string, OfflineRoutePayloadRaw>) {
  try {
    localStorage.setItem(LS_ROUTES_KEY, JSON.stringify({ routes }));
  } catch {
    /* quota */
  }
}

export function cacheRouteByKey(routeKey: string, payload: OfflineRoutePayload) {
  const prev = readRouteCache();
  prev[routeKey] = payload;
  writeRouteCache(prev);
}

function findNearestPlaceId(
  lat: number,
  lng: number,
  places: Record<string, OfflinePlaceRow>,
): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [id, p] of Object.entries(places)) {
    const d = haversineMeters(lat, lng, p.lat, p.lng);
    if (d < NEAR_POI_MATCH_M && d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

function travelModeToRouteKey(mode: RouteTravelModeLike): 'WALKING' | 'DRIVING' | null {
  const normalized = String(mode).toUpperCase();
  if (normalized === 'WALKING') return 'WALKING';
  if (normalized === 'DRIVING') return 'DRIVING';
  return null;
}

/**
 * 若起点在快照中心 200m 内且能匹配终点 POI，用 current>destId>MODE；
 * 否则若起终点均能匹配 POI，用 originId>destId>MODE。
 * locale 参数控制返回结果中 duration/distance/steps 的语言。
 */
export async function getOfflineRoutePayload(options: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  travelMode: RouteTravelModeLike;
  locale: Locale;
}): Promise<OfflineRoutePayload | null> {
  const { origin, destination, travelMode, locale } = options;
  const modeKey = travelModeToRouteKey(travelMode);
  if (!modeKey) return null;

  const places = await loadPlacesForMatch();
  if (!places) return null;

  const destId = findNearestPlaceId(destination.lat, destination.lng, places);
  if (!destId) return null;

  const snap = await loadRoutesSnapshot();
  const cache = readRouteCache();

  const pick = (k: string): OfflineRoutePayload | null => {
    const raw = cache[k] ?? snap?.routes?.[k] ?? null;
    return raw ? resolveRoutePayload(raw, locale) : null;
  };

  if (snap?.location) {
    const originNearSnap =
      haversineMeters(origin.lat, origin.lng, snap.location.lat, snap.location.lng) <= OFFLINE_SNAPSHOT_MAX_M;
    if (originNearSnap) {
      const r = pick(`current>${destId}>${modeKey}`);
      if (r) return r;
    }
  }

  const originId = findNearestPlaceId(origin.lat, origin.lng, places);
  if (!originId) return null;
  return pick(`${originId}>${destId}>${modeKey}`);
}

export function makePointPairRouteCacheKey(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: RouteTravelModeLike,
): string | null {
  const modeKey = travelModeToRouteKey(mode);
  if (!modeKey) return null;
  return `pt:${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}>${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}>${modeKey}`;
}
