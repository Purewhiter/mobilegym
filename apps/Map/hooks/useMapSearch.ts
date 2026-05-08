import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  useMapStore,
  selectCurrentLocation,
  selectCurrentView,
} from '../state';
import type { ShoppingItem } from '../types';
import {
  placeSearchResultToSearchRecord,
  placeSearchResultToShoppingItem,
  searchPlacesByText,
} from '../utils/placeSearch';

export interface MapSearchPrediction {
  kind: 'place' | 'query';
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  distance_meters?: number;
}

/** 与 `predictions` 对应的已防抖查询；传入可避免输入与建议不同步时预览错点 */
export function useMapSearch(
  query: string,
  predictions: MapSearchPrediction[],
  googleNs: typeof google | null | undefined,
  suggestionsSyncedQuery?: string,
  /** explore 页传来的地图视口中心，优先用于 locationBias（对齐真实 Google Maps 行为） */
  viewportCenter?: { lat: number; lng: number } | null,
) {
  const currentLocation = useMapStore(selectCurrentLocation);
  const currentView = useMapStore(selectCurrentView);
  const addSearchHistory = useMapStore((s) => s.addSearchHistory);
  const setSearchResults = useMapStore((s) => s.setSearchResults);
  const setActivePoi = useMapStore((s) => s.setActivePoi);

  const searchResults = currentView.searchResults || [];

  const [hasSubmitted, setHasSubmitted] = useState(false);
  /** textSearch 首包返回前为 true，用于立刻显示地图与「搜索中」 */
  const [searchBusy, setSearchBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const searchReqIdRef = useRef(0);
  const nextPageTokenRef = useRef<string | null>(null);
  const accumulatedRecordsRef = useRef<Record<string, any>[]>([]);
  const lastSearchCenterRef = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const lastDistanceOriginRef = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const lastQueryRef = useRef('');

  const invalidatePendingSearch = useCallback(() => {
    searchReqIdRef.current += 1;
    setSearchBusy(false);
  }, []);
  const [previewMarkers, setPreviewMarkers] = useState<
    Array<{ id: string; name: string; lat: number; lng: number }>
  >([]);
  const previewReqIdRef = useRef(0);
  const locationCacheRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  useEffect(() => {
    if (hasSubmitted || !query.trim()) {
      setPreviewMarkers([]);
      return;
    }
    if (
      suggestionsSyncedQuery !== undefined &&
      query.trim() !== suggestionsSyncedQuery.trim()
    ) {
      setPreviewMarkers([]);
      return;
    }
    let cancelled = false;
    const reqId = ++previewReqIdRef.current;

    const run = async () => {
      setPreviewMarkers([]);
      const top = predictions.filter((p) => p.kind === 'place').slice(0, 4);
      if (!top.length || !googleNs) return;

      const { Place } = (await googleNs.maps.importLibrary('places')) as google.maps.PlacesLibrary;
      if (!Place) return;

      type PreviewMarker = { id: string; name: string; lat: number; lng: number };
      const parts = await Promise.all(
        top.map(async (p): Promise<PreviewMarker | null> => {
          if (cancelled || reqId !== previewReqIdRef.current) return null;
          if (locationCacheRef.current.has(p.place_id)) {
            const cached = locationCacheRef.current.get(p.place_id)!;
            return {
              id: p.place_id,
              name: p.main_text || p.description,
              lat: cached.lat,
              lng: cached.lng,
            };
          }

          const placeInstance = new Place({ id: p.place_id });
          await placeInstance.fetchFields({
            fields: ['displayName', 'location'],
          });

          const loc = placeInstance.location;
          if (!loc || typeof loc.lat !== 'function') return null;
          const lat = loc.lat();
          const lng = loc.lng();
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          if (cancelled || reqId !== previewReqIdRef.current) return null;
          locationCacheRef.current.set(p.place_id, { lat, lng });
          return {
            id: p.place_id,
            name: placeInstance.displayName || p.main_text || p.description,
            lat,
            lng,
          };
        }),
      );

      if (cancelled) return;
      if (reqId !== previewReqIdRef.current) return;
      setPreviewMarkers(parts.filter((m): m is PreviewMarker => m !== null));
    };

    const t = window.setTimeout(run, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, predictions, googleNs, hasSubmitted, suggestionsSyncedQuery]);

  const submitSearch = useCallback(
    async (keyword: string) => {
      const q = keyword.trim();
      if (!q) return;

      const reqId = ++searchReqIdRef.current;

      setActivePoi(null);
      setSearchResults([]);
      nextPageTokenRef.current = null;
      accumulatedRecordsRef.current = [];
      flushSync(() => {
        setHasSubmitted(false);
        setSearchBusy(true);
      });

      const searchLat = viewportCenter?.lat ?? currentLocation.latitude;
      const searchLng = viewportCenter?.lng ?? currentLocation.longitude;
      const searchCenter =
        typeof searchLat === 'number' && typeof searchLng === 'number'
          ? { lat: searchLat, lng: searchLng }
          : undefined;
      const distanceOrigin =
        typeof currentLocation.latitude === 'number' &&
        typeof currentLocation.longitude === 'number'
          ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
          : undefined;

      lastSearchCenterRef.current = searchCenter;
      lastDistanceOriginRef.current = distanceOrigin;
      lastQueryRef.current = q;

      try {
        // 第一页
        const { results, nextPageToken } = await searchPlacesByText({
          textQuery: q,
          searchCenter,
          distanceOrigin,
        });

        if (reqId !== searchReqIdRef.current) return;

        const records = results.map(placeSearchResultToSearchRecord);
        accumulatedRecordsRef.current = records;
        nextPageTokenRef.current = nextPageToken ?? null;

        setSearchResults(records);
        addSearchHistory({ kind: 'query', text: q });
        setHasSubmitted(true);
        setSearchBusy(false);

        // 自动加载所有剩余页
        let currentToken: string | undefined = nextPageToken;
        while (currentToken && reqId === searchReqIdRef.current) {
          const { results: moreResults, nextPageToken: moreToken } = await searchPlacesByText({
            textQuery: q,
            searchCenter,
            distanceOrigin,
            pageToken: currentToken,
          });

          if (reqId !== searchReqIdRef.current) break;

          const moreRecords = moreResults.map(placeSearchResultToSearchRecord);
          accumulatedRecordsRef.current = [...accumulatedRecordsRef.current, ...moreRecords];
          currentToken = moreToken;
          nextPageTokenRef.current = currentToken ?? null;

          setSearchResults(accumulatedRecordsRef.current);
        }
      } catch {
        if (reqId !== searchReqIdRef.current) return;
        setSearchResults([]);
        nextPageTokenRef.current = null;
        addSearchHistory({ kind: 'query', text: q });
        setHasSubmitted(true);
        setSearchBusy(false);
      }
    },
    [
      viewportCenter?.lat,
      viewportCenter?.lng,
      currentLocation.latitude,
      currentLocation.longitude,
      setActivePoi,
      setSearchResults,
      addSearchHistory,
    ],
  );


  const guessedCategory = useMemo(() => {
    const q = query.trim();
    if (!q) return 'search_result';
    if (q.includes('公厕') || q.includes('厕所') || q.includes('卫生间')) return 'public_toilet';
    return 'search_result';
  }, [query]);

  const shoppingItems: ShoppingItem[] = useMemo(() => {
    return searchResults.map((r: Record<string, unknown>, idx: number) =>
      placeSearchResultToShoppingItem(
        {
          placeId: String(r?.place_id ?? r?.placeId ?? r?.id ?? idx),
          name: String(r?.name ?? ''),
          rating: typeof r?.rating === 'number' ? r.rating : undefined,
          userRatingCount: typeof r?.user_ratings_total === 'number' ? r.user_ratings_total : 0,
          formattedAddress: String(r?.formatted_address ?? r?.address ?? ''),
          distanceMeters: typeof r?.distance_meters === 'number' ? r.distance_meters : 0,
          types: (r?.types as string[] | undefined) || [],
          primaryType: r?.primary_type as string | undefined,
          primaryTypeDisplayName: r?.primary_type_display_name as string | undefined,
          businessStatus: r?.business_status as string | undefined,
          openNow: typeof r?.open_now === 'boolean' ? r.open_now : undefined,
          closesAt: typeof r?.closes_at === 'string' ? r.closes_at : undefined,
          opensNextLabel: typeof r?.opens_next_label === 'string' ? r.opens_next_label : undefined,
          lat: typeof r?.lat === 'number' ? r.lat : 0,
          lng: typeof r?.lng === 'number' ? r.lng : 0,
        },
        {
          categoryOverride:
            guessedCategory === 'public_toilet'
              ? '公厕'
              : undefined,
        },
      ),
    );
  }, [searchResults, guessedCategory]);

  const mapCenter = useMemo(() => {
    type LatLngPick = { lat: number; lng: number };
    const source: LatLngPick | null =
      hasSubmitted && shoppingItems.length > 0
        ? shoppingItems[0]
        : previewMarkers.length > 0
          ? previewMarkers[0]
          : null;

    if (source) {
      const { lat, lng } = source;
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !(lat === 0 && lng === 0)
      ) {
        return { lat, lng };
      }
    }

    return { lat: currentLocation.latitude, lng: currentLocation.longitude };
  }, [hasSubmitted, shoppingItems, previewMarkers, currentLocation.latitude, currentLocation.longitude]);

  const resetSubmit = useCallback(() => {
    setHasSubmitted(false);
  }, []);

  return {
    hasSubmitted,
    setHasSubmitted,
    resetSubmit,
    shoppingItems,
    previewMarkers,
    mapCenter,
    submitSearch,
    guessedCategory,
    searchBusy,
    invalidatePendingSearch,
  };
}
