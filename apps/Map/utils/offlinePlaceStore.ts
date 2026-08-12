/**
 * 离线 POI：查询顺序为 **localStorage 增量（搜索 + 详情）→ 静态 places.json → 在线**（由调用方处理在线）。
 * 与快照中心距离超过 OFFLINE_SNAPSHOT_MAX_M 时不使用离线搜索，避免错误区域结果。
 */
import { getDate as timeGetDate } from '../../../os/TimeService';
import type { Locale } from '../../../os/locale';
import type { PlaceSearchResult } from './placeSearch';
import { computeOpeningStatusFromPeriods } from './placeUtils';

export const OFFLINE_SNAPSHOT_MAX_M = 200;
const L2_SEARCH_REUSE_MAX_M = 200;

const LS_SEARCH_KEY = 'map_offline_places';

/** 内部双语文本对，不向外暴露 */
type BiText = { zh: string; en: string };

function pickText(field: string | BiText | undefined | null, locale: Locale): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return locale === 'en' ? (field.en || field.zh || '') : (field.zh || field.en || '');
}

/**
 * 离线行原始类型：name / formattedAddress / details 内部字段可能是 BiText
 * 这个类型仅用于 JSON 反序列化和 localStorage 缓存，不向消费方暴露 BiText
 */
export type OfflinePlaceRow = {
  placeId: string;
  name: string | BiText;
  lat: number;
  lng: number;
  rating?: number;
  userRatingCount?: number;
  types: string[];
  primaryType?: string;
  formattedAddress: string | BiText;
  internationalPhoneNumber?: string;
  distanceMeters?: number;
  details?: Record<string, unknown> | null;
};

export type PlacesSnapshot = {
  location: { lat: number; lng: number };
  generated_at?: string;
  places: Record<string, OfflinePlaceRow>;
  search_index: Record<string, string[]>;
  autocomplete_index?: Record<string, OfflineAutocompletePrediction[]>;
};

export type OfflineAutocompletePrediction = {
  kind: 'place' | 'query';
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  distance_meters?: number;
};

export type OfflineAutocompleteSource =
  | 'autocomplete_index'
  | 'search_index_fallback'
  | 'miss';

export type OfflineAutocompleteLookup = {
  predictions: OfflineAutocompletePrediction[];
  source: OfflineAutocompleteSource;
};

let placesSnapshotPromise: Promise<PlacesSnapshot | null> | null = null;

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

// places.json 体积大（约 3MB），用 fetch 加载以避开 Vite ESM 转换管线
// （否则会被打进 JS chunk），模式同 apps/Bilibili/data/loader.ts。
// new URL(..., import.meta.url) 在 dev 下解析为源码静态路径、build 下由 Vite
// 发射为独立资源文件，两种模式均可达。
const placesJsonUrl = new URL('../data/places.json', import.meta.url).href;

/**
 * 加载 places 快照（模块级单份缓存）。
 * offlineRouteStore 的 POI 匹配也复用此加载器，保持与原先两处 `import()`
 * 共享 ES 模块缓存一致的"全局只加载一份"行为。
 * 失败时清除 inflight Promise 允许下次重试，对外仍以 null 表示快照不可用。
 */
export async function loadPlacesSnapshot(): Promise<PlacesSnapshot | null> {
  if (!placesSnapshotPromise) {
    placesSnapshotPromise = fetch(placesJsonUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${placesJsonUrl}`);
        return r.json() as Promise<PlacesSnapshot>;
      })
      .catch(() => {
        placesSnapshotPromise = null;
        return null;
      });
  }
  return placesSnapshotPromise;
}

type PlacesL2Cache = {
  searches: Record<string, CachedSearchEntry[]>;
  placeDetails?: Record<string, OfflinePlaceRow>;
};

type CachedSearchEntry = {
  searchCenter: { lat: number; lng: number };
  results: PlaceSearchResult[];
};

function isLatLngLike(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.lat === 'number' && typeof record.lng === 'number';
}

function isPlaceSearchResultLike(value: unknown): value is PlaceSearchResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.placeId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.lat === 'number' &&
    typeof record.lng === 'number'
  );
}

function normalizeCachedSearchEntry(value: unknown): CachedSearchEntry | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isLatLngLike(record.searchCenter)) return null;
  if (!Array.isArray(record.results)) return null;
  const results = record.results.filter(isPlaceSearchResultLike);
  if (results.length !== record.results.length) return null;
  return {
    searchCenter: record.searchCenter,
    results,
  };
}

function normalizeCachedSearches(raw: unknown): Record<string, CachedSearchEntry[]> {
  if (!raw || typeof raw !== 'object') return {};
  const searches = raw as Record<string, unknown>;
  const out: Record<string, CachedSearchEntry[]> = {};
  for (const [key, value] of Object.entries(searches)) {
    if (Array.isArray(value)) {
      out[key] = value
        .map(normalizeCachedSearchEntry)
        .filter((entry): entry is CachedSearchEntry => entry !== null);
      continue;
    }
    const entry = normalizeCachedSearchEntry(value);
    out[key] = entry ? [entry] : [];
  }
  return out;
}

function pickReusableCachedSearch(
  entries: CachedSearchEntry[] | undefined,
  searchCenter: { lat: number; lng: number },
): CachedSearchEntry | null {
  if (!entries?.length) return null;
  let best: CachedSearchEntry | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    const distance = haversineMeters(
      searchCenter.lat,
      searchCenter.lng,
      entry.searchCenter.lat,
      entry.searchCenter.lng,
    );
    if (distance <= L2_SEARCH_REUSE_MAX_M && distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }
  return best;
}

function readPlacesL2Cache(): PlacesL2Cache {
  try {
    const raw = localStorage.getItem(LS_SEARCH_KEY);
    if (!raw) return { searches: {} };
    const p = JSON.parse(raw) as Partial<PlacesL2Cache>;
    return {
      searches: normalizeCachedSearches(p.searches),
      placeDetails: p.placeDetails && typeof p.placeDetails === 'object' ? p.placeDetails : undefined,
    };
  } catch {
    return { searches: {} };
  }
}

function writePlacesL2Cache(cache: PlacesL2Cache) {
  try {
    const payload: Record<string, unknown> = { searches: cache.searches };
    if (cache.placeDetails && Object.keys(cache.placeDetails).length > 0) {
      payload.placeDetails = cache.placeDetails;
    }
    localStorage.setItem(LS_SEARCH_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

/** 在线搜索成功后合并写入缓存 */
export function cachePlaceResults(
  cacheKey: string,
  searchCenter: { lat: number; lng: number } | null | undefined,
  results: PlaceSearchResult[],
) {
  const k = cacheKey.trim();
  if (!k || !results.length || !searchCenter) return;
  const prev = readPlacesL2Cache();
  const nextEntry: CachedSearchEntry = { searchCenter, results };
  const siblings = prev.searches[k] ?? [];
  prev.searches[k] = [
    nextEntry,
    ...siblings.filter((entry) => {
      if (!entry.searchCenter) return false;
      return (
        haversineMeters(
          searchCenter.lat,
          searchCenter.lng,
          entry.searchCenter.lat,
          entry.searchCenter.lng,
        ) > L2_SEARCH_REUSE_MAX_M
      );
    }),
  ].slice(0, 5);
  writePlacesL2Cache(prev);
}

/** 在线拉取详情成功后写入（供下次离线命中） */
export function cachePlaceDetail(row: OfflinePlaceRow) {
  if (!row.placeId?.trim()) return;
  if (!row.details || typeof row.details !== 'object') return;
  const prev = readPlacesL2Cache();
  const placeDetails = { ...prev.placeDetails, [row.placeId]: row };
  writePlacesL2Cache({ searches: prev.searches, placeDetails });
}

/** 将离线行转为 PlaceSearchResult，BiText 在此解析为当前语言，距离始终基于 distanceOrigin。 */
function rowToPlaceSearchResult(
  row: OfflinePlaceRow,
  distanceOrigin: { lat: number; lng: number } | null | undefined,
  locale: Locale,
): PlaceSearchResult {
  const distanceMeters = distanceOrigin
    ? Math.round(haversineMeters(distanceOrigin.lat, distanceOrigin.lng, row.lat, row.lng))
    : undefined;
  const rawHrs = row.details?.regularOpeningHours as { periods?: unknown[] } | undefined;
  const hasPeriods = Array.isArray(rawHrs?.periods) && rawHrs!.periods!.length > 0;
  const hoursStatus = hasPeriods ? computeOpeningStatusFromPeriods(rawHrs as { periods: any[] }, timeGetDate(), locale) : null;

  const d = row.details;
  let primaryTypeDisplayName: string | undefined;
  if (d?.primaryTypeDisplayName) {
    primaryTypeDisplayName = pickText(d.primaryTypeDisplayName as string | BiText, locale);
  }

  return {
    placeId: row.placeId,
    name: pickText(row.name, locale),
    lat: row.lat,
    lng: row.lng,
    rating: row.rating,
    userRatingCount: row.userRatingCount,
    types: row.types || [],
    primaryType: row.primaryType,
    primaryTypeDisplayName,
    businessStatus: (d?.businessStatus as string | undefined) ?? undefined,
    formattedAddress: pickText(row.formattedAddress, locale) || '',
    internationalPhoneNumber: row.internationalPhoneNumber ?? (d?.internationalPhoneNumber as string | undefined),
    openNow: hoursStatus?.isOpen,
    closesAt: hoursStatus?.closesAt ?? undefined,
    opensNextLabel: hoursStatus?.opensNextLabel ?? undefined,
    distanceMeters,
  };
}

export interface OfflineSearchResult {
  results: PlaceSearchResult[];
  nextPageToken?: string;
}

const OFFLINE_TOKEN_PREFIX = 'offline:';

export function parseOfflinePageToken(token: string): number | null {
  if (!token.startsWith(OFFLINE_TOKEN_PREFIX)) return null;
  const offset = parseInt(token.slice(OFFLINE_TOKEN_PREFIX.length), 10);
  return Number.isFinite(offset) ? offset : null;
}

/**
 * 离线搜索：默认 searchCenter 必须在快照中心 200m 内；无 searchCenter 时不使用离线。
 * 结果里的 distanceMeters 由 distanceOrigin 决定，避免把“搜哪儿”和“离我多远”混为一谈。
 * 支持分页：pageSize 控制每页条数，offset 控制起始位置。
 *
 * options.allowAcrossSnapshot:
 *   - false（默认）：严格 200m gate，远视口直接返回空，留给在线 Places 兜底。
 *   - true：放宽 gate，跨快照区域也返回 search_index 命中。
 *     **仅在没有在线 fallback（即未配置 Google Maps API key）时使用**：此时返回
 *     可能"地理错位"的快照结果，也好过完全空白。代价：类目类查询（餐厅、咖啡）
 *     在远视口下会拿到 snapshot 中心附近的结果，名字类查询（圆明园、故宫）依然正确。
 */
export async function searchPlacesOffline(
  textQuery: string,
  searchCenter: { lat: number; lng: number } | null | undefined,
  distanceOrigin: { lat: number; lng: number } | null | undefined,
  locale: Locale,
  pageSize = 20,
  offset = 0,
  options: { allowAcrossSnapshot?: boolean } = {},
): Promise<OfflineSearchResult> {
  if (!searchCenter) return { results: [] };

  const snap = await loadPlacesSnapshot();
  if (!snap?.location) return { results: [] };

  const distToSnap = haversineMeters(
    searchCenter.lat,
    searchCenter.lng,
    snap.location.lat,
    snap.location.lng,
  );
  if (distToSnap > OFFLINE_SNAPSHOT_MAX_M && !options.allowAcrossSnapshot) {
    return { results: [] };
  }

  const indexKey = textQuery.trim();
  if (!indexKey) return { results: [] };

  const cache = readPlacesL2Cache();
  const cached = pickReusableCachedSearch(cache.searches[indexKey], searchCenter);
  if (cached?.results.length) {
    const effectiveDistanceOrigin = distanceOrigin ?? searchCenter;
    const page = cached.results.slice(offset, offset + pageSize).map((c) => ({
      ...c,
      distanceMeters: effectiveDistanceOrigin
        ? Math.round(haversineMeters(effectiveDistanceOrigin.lat, effectiveDistanceOrigin.lng, c.lat, c.lng))
        : undefined,
    }));
    const nextOffset = offset + pageSize;
    return {
      results: page,
      nextPageToken: nextOffset < cached.results.length ? `${OFFLINE_TOKEN_PREFIX}${nextOffset}` : undefined,
    };
  }

  const ids = snap.search_index[indexKey];
  if (!ids?.length) return { results: [] };

  const pageIds = ids.slice(offset, offset + pageSize);
  const out: PlaceSearchResult[] = [];
  for (const id of pageIds) {
    const row = snap.places[id];
    if (!row) continue;
    out.push(rowToPlaceSearchResult(row, distanceOrigin ?? searchCenter, locale));
  }

  const nextOffset = offset + pageSize;
  return {
    results: out,
    nextPageToken: nextOffset < ids.length ? `${OFFLINE_TOKEN_PREFIX}${nextOffset}` : undefined,
  };
}

/** 地点详情：localStorage 增量 → 静态快照（不受距离限制） */
export async function getPlaceDetailOffline(placeId: string): Promise<OfflinePlaceRow | null> {
  const l2 = readPlacesL2Cache();
  const fromLs = l2.placeDetails?.[placeId];
  if (fromLs) return fromLs;

  const snap = await loadPlacesSnapshot();
  const row = snap?.places?.[placeId];
  if (!row) return null;
  return row as OfflinePlaceRow;
}

/** 从 OfflinePlaceRow 获取已解析语言的名称 */
export function getOfflinePlaceRowName(row: OfflinePlaceRow, locale: Locale): string {
  return pickText(row.name, locale);
}

function normalizeAutocompletePrediction(value: unknown): OfflineAutocompletePrediction | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (kind !== 'place' && kind !== 'query') return null;
  const mainText = String(record.main_text ?? record.mainText ?? '').trim();
  const description = String(record.description ?? mainText).trim();
  if (!mainText && !description) return null;
  const placeId = String(record.place_id ?? record.placeId ?? '').trim();
  if (kind === 'place' && !placeId) return null;
  const distance = record.distance_meters ?? record.distanceMeters;
  return {
    kind,
    place_id: placeId,
    description: description || mainText,
    main_text: mainText || description,
    secondary_text: String(record.secondary_text ?? record.secondaryText ?? ''),
    distance_meters: typeof distance === 'number' && Number.isFinite(distance) ? distance : undefined,
  };
}

function buildFallbackAutocomplete(
  snap: PlacesSnapshot,
  input: string,
  locale: Locale,
  placesOnly: boolean,
  limit: number,
): OfflineAutocompletePrediction[] {
  const q = input.trim();
  if (!q) return [];

  const out: OfflineAutocompletePrediction[] = [];
  const seen = new Set<string>();
  const keys = Object.keys(snap.search_index || {})
    .filter((key) => key.startsWith(q) || key.includes(q))
    .slice(0, limit);

  for (const key of keys) {
    if (!placesOnly && !seen.has(`q:${key}`)) {
      out.push({
        kind: 'query',
        place_id: '',
        description: key,
        main_text: key,
        secondary_text: '',
      });
      seen.add(`q:${key}`);
    }

    for (const id of snap.search_index[key] || []) {
      const row = snap.places[id];
      if (!row) continue;
      const name = getOfflinePlaceRowName(row, locale);
      if (!name || seen.has(`p:${id}`)) continue;
      out.push({
        kind: 'place',
        place_id: id,
        description: name,
        main_text: name,
        secondary_text: pickText(row.formattedAddress, locale),
        distance_meters: row.distanceMeters,
      });
      seen.add(`p:${id}`);
      break;
    }

    if (out.length >= limit) break;
  }

  return out.slice(0, limit);
}

export async function getAutocompleteOffline(options: {
  input: string;
  locale: Locale;
  placesOnly?: boolean;
  limit?: number;
  allowSearchIndexFallback?: boolean;
}): Promise<OfflineAutocompleteLookup> {
  const q = options.input.trim();
  if (!q) return { predictions: [], source: 'miss' };

  const snap = await loadPlacesSnapshot();
  if (!snap) return { predictions: [], source: 'miss' };

  const placesOnly = options.placesOnly === true;
  const limit = options.limit ?? 10;
  const autocompleteIndex = snap.autocomplete_index || {};
  if (Object.prototype.hasOwnProperty.call(autocompleteIndex, q)) {
    const cached = (autocompleteIndex[q] || [])
      .map(normalizeAutocompletePrediction)
      .filter((p): p is OfflineAutocompletePrediction => p !== null)
      .filter((p) => !placesOnly || p.kind === 'place')
      .slice(0, limit);
    return { predictions: cached, source: 'autocomplete_index' };
  }

  if (options.allowSearchIndexFallback) {
    const fallback = buildFallbackAutocomplete(snap, q, options.locale, placesOnly, limit);
    return {
      predictions: fallback,
      source: fallback.length > 0 ? 'search_index_fallback' : 'miss',
    };
  }

  return { predictions: [], source: 'miss' };
}
