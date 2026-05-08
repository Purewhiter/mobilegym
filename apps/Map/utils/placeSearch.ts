import { getPlaceTypeLabel } from '../constants';
import type { ShoppingItem } from '../types';
import { getDate as timeGetDate } from '../../../os/TimeService';
import { getLocale } from '../locale';
import { computeOpeningStatusFromPeriods, formatDistanceLabelMeters, googleLangCode } from './placeUtils';
import { cachePlaceResults, parseOfflinePageToken, searchPlacesOffline } from './offlinePlaceStore';

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingCount?: number;
  types: string[];
  primaryType?: string;
  primaryTypeDisplayName?: string;
  businessStatus?: string;
  formattedAddress: string;
  internationalPhoneNumber?: string;
  openNow?: boolean;
  closesAt?: string;
  opensNextLabel?: string;
  distanceMeters?: number;
}

export interface SearchPlacesByTextResult {
  results: PlaceSearchResult[];
  nextPageToken?: string;
}

interface SearchPlacesByTextOptions {
  textQuery: string;
  /** 用于 Places locationBias，决定搜索哪一片区域。 */
  searchCenter?: { lat: number; lng: number } | null;
  /** 用于结果展示距离，通常固定为当前位置。 */
  distanceOrigin?: { lat: number; lng: number } | null;
  pageSize?: number;
  pageToken?: string;
  language?: string;
}

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'places.formattedAddress',
  'places.internationalPhoneNumber',
  'places.regularOpeningHours',
  'nextPageToken',
].join(',');

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchPlacesByText({
  textQuery,
  searchCenter,
  distanceOrigin,
  pageSize = 20,
  pageToken,
  language,
}: SearchPlacesByTextOptions): Promise<SearchPlacesByTextResult> {
  const locale = getLocale();
  const resolvedLanguage = language || googleLangCode(locale);
  const effectiveDistanceOrigin = distanceOrigin ?? searchCenter;

  const offlineOffset = pageToken ? parseOfflinePageToken(pageToken) : null;
  if (!pageToken || offlineOffset !== null) {
    const { results: offlineResults, nextPageToken: offlineNext } = await searchPlacesOffline(
      textQuery,
      searchCenter,
      effectiveDistanceOrigin,
      locale,
      pageSize,
      offlineOffset ?? 0,
    );
    if (offlineResults.length > 0) {
      if (import.meta.env.DEV) {
        const tag = offlineOffset ? '[离线 loadMore]' : '[离线搜索]';
        console.log(
          `%c${tag} "${textQuery}" → ${offlineResults.length} 条${offlineNext ? ', hasMore ✓' : ''}`,
          'color:#16a34a;font-weight:bold',
        );
      }
      return { results: offlineResults, nextPageToken: offlineNext };
    }
  }

  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

  const body: Record<string, unknown> = {
    textQuery,
    languageCode: resolvedLanguage,
    pageSize,
  };

  if (searchCenter) {
    body.locationBias = {
      circle: {
        center: { latitude: searchCenter.lat, longitude: searchCenter.lng },
        radius: 5000,
      },
    };
  }
  if (pageToken) body.pageToken = pageToken;

  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(
      `Places API error: ${resp.status} ${resp.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`,
    );
  }

  const data = await resp.json();
  const places: any[] = data.places || [];

  const now = timeGetDate();
  const results = places
    .filter((p: any) => p.id && p.location)
    .map((p: any) => {
      const lat: number = p.location.latitude;
      const lng: number = p.location.longitude;

      let distanceMeters: number | undefined;
      if (effectiveDistanceOrigin) {
        distanceMeters = haversineDistance(
          effectiveDistanceOrigin.lat,
          effectiveDistanceOrigin.lng,
          lat,
          lng,
        );
      }

      const rawHrs = p.regularOpeningHours;
      const hasPeriods = Array.isArray(rawHrs?.periods) && rawHrs.periods.length > 0;
      const hoursStatus = hasPeriods ? computeOpeningStatusFromPeriods(rawHrs, now, locale) : null;

      return {
        placeId: p.id as string,
        name: (p.displayName?.text as string) || '',
        lat,
        lng,
        rating: p.rating ?? undefined,
        userRatingCount: p.userRatingCount ?? undefined,
        types: (p.types as string[]) || [],
        primaryType: (p.primaryType as string) || undefined,
        primaryTypeDisplayName: (p.primaryTypeDisplayName?.text as string) || undefined,
        businessStatus: (p.businessStatus as string) || undefined,
        formattedAddress: (p.formattedAddress as string) || '',
        internationalPhoneNumber: (p.internationalPhoneNumber as string) || undefined,
        openNow: hoursStatus?.isOpen,
        closesAt: hoursStatus?.closesAt ?? undefined,
        opensNextLabel: hoursStatus?.opensNextLabel ?? undefined,
        distanceMeters,
      } satisfies PlaceSearchResult;
    })
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

  if (import.meta.env.DEV) {
    const tag = pageToken ? '[在线 loadMore]' : '[在线搜索]';
    console.groupCollapsed(
      `${tag} "${textQuery}" → ${results.length} results${data.nextPageToken ? ', hasMore ✓' : ''}`,
    );
    console.table(
      results.map((r, i) => ({
        '#': i + 1,
        name: r.name,
        rating: r.rating ?? '-',
        reviews: r.userRatingCount ?? '-',
        dist: r.distanceMeters ? `${(r.distanceMeters / 1000).toFixed(1)}km` : '-',
        type: r.primaryTypeDisplayName || r.primaryType || '-',
        open: r.openNow === true ? '✓' : r.openNow === false ? '✗' : '-',
        lat: r.lat.toFixed(4),
        lng: r.lng.toFixed(4),
      })),
    );
    console.groupEnd();
  }

  if (!pageToken && results.length > 0) {
    const cacheKey = textQuery.trim();
    if (cacheKey) cachePlaceResults(cacheKey, searchCenter, results);
  }

  return { results, nextPageToken: data.nextPageToken || undefined };
}

export function placeSearchResultToShoppingItem(
  result: PlaceSearchResult,
  options?: { categoryOverride?: string },
): ShoppingItem {
  return {
    id: result.placeId,
    name: result.name,
    rating: result.rating,
    ratingCount: result.userRatingCount,
    category:
      options?.categoryOverride ??
      getPlaceTypeLabel(result.types, result.primaryType, result.primaryTypeDisplayName, getLocale()),
    types: result.types,
    primaryType: result.primaryType,
    distance: result.distanceMeters ?? 0,
    address: result.formattedAddress,
    status: result.businessStatus === 'OPERATIONAL' ? 'Open' : 'Closed',
    openNow: result.openNow,
    closesAt: result.closesAt,
    opensNextLabel: result.opensNextLabel,
    lat: result.lat,
    lng: result.lng,
  };
}

export function placeSearchResultToPlaceResult(
  result: PlaceSearchResult,
): google.maps.places.PlaceResult {
  return {
    place_id: result.placeId,
    name: result.name,
    geometry: {
      location: {
        lat: result.lat,
        lng: result.lng,
      } as unknown as google.maps.LatLng,
    },
    rating: result.rating,
    user_ratings_total: result.userRatingCount,
    types: result.types,
    formatted_address: result.formattedAddress,
    vicinity: result.formattedAddress,
    business_status: result.businessStatus as google.maps.places.BusinessStatus | undefined,
  };
}

export function placeSearchResultToSearchRecord(
  result: PlaceSearchResult,
): Record<string, any> {
  return {
    place_id: result.placeId,
    name: result.name,
    rating: result.rating,
    user_ratings_total: result.userRatingCount,
    formatted_address: result.formattedAddress,
    address: result.formattedAddress,
    formatted_phone_number: result.internationalPhoneNumber,
    distance_meters: result.distanceMeters,
    distance: formatDistanceLabelMeters(result.distanceMeters, getLocale()),
    types: result.types,
    primary_type: result.primaryType,
    primary_type_display_name: result.primaryTypeDisplayName,
    category: getPlaceTypeLabel(result.types, result.primaryType, result.primaryTypeDisplayName, getLocale()),
    business_status: result.businessStatus,
    open_now: result.openNow,
    closes_at: result.closesAt,
    opens_next_label: result.opensNextLabel,
    lat: result.lat,
    lng: result.lng,
  };
}
