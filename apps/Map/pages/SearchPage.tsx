import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { IcNavBack, IcMic, IcLocation, IcClock, IcClose, IcSearch } from '../res/icons';
import { googleLangCode } from '../utils/placeUtils';
import { useLocation } from 'react-router-dom';
import { useMapGestures } from '../hooks/useMapGestures';
import { useLocale } from '../locale';
import { useMapSearch, type MapSearchPrediction } from '../hooks/useMapSearch';
import {
  useMapStore,
  selectGoogle,
  selectCurrentLocation,
  selectSearchHistory,
  type MapSearchHistoryEntry,
} from '../state';
import { PlaceResultsSheet } from '../components/PlaceResultsSheet';
import { GoogleMap } from '../components/GoogleMap';
import { MapMarker } from '../components/MapMarker';
import { KeyboardService } from '@/os/keyboard';
import { formatDistanceLabelMeters } from '../utils/placeUtils';
import { applySearchResultsViewport } from '../utils/mapViewport';
import { applyPlaceResultsDisplay } from '../utils/placeResultsFilters';
import { getAutocompleteOffline } from '../utils/offlinePlaceStore';
import { hasGoogleMapsApiKey } from '../utils/googleMapsConfig';
import type { ShoppingItem } from '../types';
import { useMapStrings } from '../hooks/useMapStrings';
import type { PlaceSelectionFallback } from '../types';

const AUTOCOMPLETE_DEBOUNCE_MS = 280;

function getQueryPredictionMainText(prediction: google.maps.places.QueryAutocompletePrediction): string {
  return prediction.terms?.[0]?.value ?? prediction.description ?? '';
}

function getQueryPredictionSecondaryText(
  prediction: google.maps.places.QueryAutocompletePrediction,
): string {
  return prediction.terms.slice(1).map((term) => term.value).join(' ');
}

export const SearchPage: React.FC = () => {
  const google = useMapStore(selectGoogle);
  const currentLocation = useMapStore(selectCurrentLocation);
  const searchHistory = useMapStore(selectSearchHistory);
  const addSearchHistory = useMapStore((s) => s.addSearchHistory);
  const setAutocomplete = useMapStore((s) => s.setAutocomplete);
  const setPendingPlaceSelection = useMapStore((s) => s.setPendingPlaceSelection);
  const location = useLocation();
  const { go, bindBack } = useMapGestures();
  const initialQuery = location.state?.initialQuery || '';
  const viewportCenter = location.state?.viewportCenter as { lat: number; lng: number } | undefined;
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [predictions, setPredictions] = useState<MapSearchPrediction[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pageRootRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const locale = useLocale();
  const s = useMapStrings();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), AUTOCOMPLETE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const {
    hasSubmitted,
    setHasSubmitted,
    shoppingItems,
    mapCenter,
    submitSearch: rawSubmitSearch,
    guessedCategory,
    searchBusy,
    invalidatePendingSearch,
  } = useMapSearch(query, predictions, google, debouncedQuery, viewportCenter);

  const searchVersionRef = useRef(0);
  const submitSearch = useCallback(
    (keyword: string) => {
      searchVersionRef.current += 1;
      return rawSubmitSearch(keyword);
    },
    [rawSubmitSearch],
  );

  /** 全量结果 + 排序/筛选 + 前端虚拟分页 */
  const [allSearchItems, setAllSearchItems] = useState<ShoppingItem[]>([]);
  const [sheetSort, setSheetSort] = useState<'relevance' | 'distance'>('relevance');
  const [sheetFilters, setSheetFilters] = useState<string[]>([]);
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const lastSyncedVersionRef = useRef(0);

  // 全量数据更新时同步
  useEffect(() => {
    if (!hasSubmitted) return;
    const isNewSearch = searchVersionRef.current !== lastSyncedVersionRef.current;
    lastSyncedVersionRef.current = searchVersionRef.current;
    setAllSearchItems(shoppingItems);
    if (isNewSearch) {
      setSheetSort('relevance');
      setSheetFilters([]);
      setVisibleCount(PAGE_SIZE);
    }
  }, [shoppingItems, hasSubmitted]);

  // 排序/筛选后的全量结果
  const processedSearchItems = useMemo(
    () => applyPlaceResultsDisplay(allSearchItems, sheetSort, sheetFilters),
    [allSearchItems, sheetSort, sheetFilters],
  );

  // 前端虚拟分页：只展示前 visibleCount 条
  const displaySearchItems = useMemo(
    () => processedSearchItems.slice(0, visibleCount),
    [processedSearchItems, visibleCount],
  );

  const searchHasMore = visibleCount < processedSearchItems.length;
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);

  const buildPlaceFallbackState = useCallback((item: ShoppingItem): PlaceSelectionFallback | undefined => {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return undefined;
    return {
      name: item.name,
      formattedAddress: item.address,
      location: { lat: item.lat, lng: item.lng },
      types: item.types,
    };
  }, []);

  const handleSearchLoadMore = useCallback(() => {
    if (searchLoadingMore || !searchHasMore) return;
    setSearchLoadingMore(true);
    // 模拟短暂延迟使 loading 动画可见
    requestAnimationFrame(() => {
      setVisibleCount((prev) => prev + PAGE_SIZE);
      setSearchLoadingMore(false);
    });
  }, [searchLoadingMore, searchHasMore]);

  const placeResultsSheetKey = useMemo(
    () => (hasSubmitted ? `${sheetSort}-${sheetFilters.join(',')}-${allSearchItems.length}` : 'idle'),
    [hasSubmitted, sheetSort, sheetFilters, allSearchItems.length],
  );

  const handlePlaceResultsSortChange = useCallback(
    (sort: 'relevance' | 'distance') => {
      setSheetSort(sort);
      setVisibleCount(PAGE_SIZE);
    },
    [],
  );

  const handlePlaceResultsFilterChange = useCallback(
    (filters: string[]) => {
      setSheetFilters(filters);
      setVisibleCount(PAGE_SIZE);
    },
    [],
  );

  useEffect(() => {
    if (!google) return;
    void google.maps.importLibrary('places');
  }, [google]);

  const mode = location.state?.mode as 'origin' | 'destination' | undefined;

  const suggestionsSynced = query.trim() === debouncedQuery.trim();
  const waitingForDebounce =
    query.trim().length > 0 &&
    !suggestionsSynced &&
    !hasSubmitted &&
    !searchBusy;
  const showResultMap = hasSubmitted || searchBusy;

  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();
    if (!trimmedQuery) {
      setPredictions([]);
      setAutocomplete(debouncedQuery, []);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    setSuggestionsLoading(true);

    const run = async () => {
      const offline = await getAutocompleteOffline({ input: trimmedQuery, locale });
      if (cancelled) return;
      if (offline.source === 'autocomplete_index') {
        const queryCount = offline.predictions.filter((item) => item.kind === 'query').length;
        const placeCount = offline.predictions.length - queryCount;
        console.log(
          `[Map][离线] 搜索提示: "${trimmedQuery}" 命中 autocomplete_index -> ${offline.predictions.length} 条 (${queryCount} 搜索词, ${placeCount} 地点)`,
        );
        setPredictions(offline.predictions);
        setAutocomplete(debouncedQuery, offline.predictions);
        setSuggestionsLoading(false);
        return;
      }

      if (!google || !hasGoogleMapsApiKey()) {
        const fallback = await getAutocompleteOffline({
          input: trimmedQuery,
          locale,
          allowSearchIndexFallback: true,
        });
        if (cancelled) return;
        if (fallback.predictions.length > 0) {
          const queryCount = fallback.predictions.filter((item) => item.kind === 'query').length;
          const placeCount = fallback.predictions.length - queryCount;
          console.log(
            `[Map][离线未命中] 搜索提示: "${trimmedQuery}" 没有 autocomplete_index，Google key 不可用，使用 search_index 兜底 -> ${fallback.predictions.length} 条 (${queryCount} 搜索词, ${placeCount} 地点)`,
          );
          setPredictions(fallback.predictions);
          setAutocomplete(debouncedQuery, fallback.predictions);
          setSuggestionsLoading(false);
          return;
        }
        console.log(`[Map][离线未命中] 搜索提示: "${trimmedQuery}" 未命中 autocomplete_index/search_index，Google key 不可用，使用本地搜索词兜底`);
        const offlineQueryPredictions: MapSearchPrediction[] = [
          {
            kind: 'query',
            place_id: '',
            description: trimmedQuery,
            main_text: trimmedQuery,
            secondary_text: '',
          },
        ];
        setPredictions(offlineQueryPredictions);
        setAutocomplete(debouncedQuery, offlineQueryPredictions);
        setSuggestionsLoading(false);
        return;
      }

      console.log(`[Map][在线] 搜索提示: "${trimmedQuery}" 离线未命中，调用 Google AutocompleteService`);
      const service = new google.maps.places.AutocompleteService();
      const locationForBias =
        currentLocation.latitude
          ? new google.maps.LatLng(currentLocation.latitude, currentLocation.longitude)
          : undefined;

      const queryReq: google.maps.places.QueryAutocompletionRequest = {
        input: debouncedQuery,
        ...(locationForBias ? { locationBias: { center: locationForBias, radius: 5000 } } : {}),
      } as google.maps.places.QueryAutocompletionRequest;
      const placeReq: google.maps.places.AutocompletionRequest = {
        input: debouncedQuery,
        language: googleLangCode(locale),
        ...(locationForBias
          ? { locationBias: { center: locationForBias, radius: 5000 }, origin: locationForBias }
          : {}),
      };

      const queryPromise = new Promise<MapSearchPrediction[]>((resolve) => {
        service.getQueryPredictions(queryReq, (results, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !results
          ) {
            resolve([]);
            return;
          }
          const q = debouncedQuery.trim();
          resolve(
            results
              .filter((r) => !r.place_id || getQueryPredictionMainText(r) === q)
              .map((r) => ({
                kind: 'query' as const,
                place_id: '',
                description: r.description ?? '',
                main_text: getQueryPredictionMainText(r),
                secondary_text: getQueryPredictionSecondaryText(r),
                distance_meters: undefined,
              })),
          );
        });
      });

      const placePromise = new Promise<MapSearchPrediction[]>((resolve) => {
        service.getPlacePredictions(placeReq, (results, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !results
          ) {
            resolve([]);
            return;
          }
          resolve(
            results.map((r) => ({
              kind: 'place' as const,
              place_id: r.place_id,
              description: r.description ?? '',
              main_text:
                r.structured_formatting?.main_text ?? r.description ?? '',
              secondary_text:
                r.structured_formatting?.secondary_text ?? '',
              distance_meters: r.distance_meters ?? undefined,
            })),
          );
        });
      });

      try {
        const [queryPreds, placePreds] = await Promise.all([queryPromise, placePromise]);
        if (cancelled) return;
        const seen = new Set<string>();
        const dedupedQueryPreds = queryPreds.filter((p) => {
          if (seen.has(p.main_text)) return false;
          seen.add(p.main_text);
          return true;
        });
        const results = [...dedupedQueryPreds, ...placePreds];
        console.log(
          `[Map][在线] 搜索提示: "${trimmedQuery}" -> ${results.length} 条 (${dedupedQueryPreds.length} 搜索词, ${placePreds.length} 地点)`,
        );
        setPredictions(results);
        setAutocomplete(debouncedQuery, results);
      } catch {
        if (!cancelled) {
          console.log(`[Map][离线未命中] 搜索提示: "${trimmedQuery}" 在线提示请求失败，返回空结果`);
          setPredictions([]);
          setAutocomplete(debouncedQuery, []);
        }
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, google, currentLocation, setAutocomplete, locale]);

  const handleResultClick = (
    placeId: string,
    titleText: string,
    subtitle?: string,
    fallback?: PlaceSelectionFallback,
  ) => {
    addSearchHistory({
      kind: 'place',
      text: titleText,
      placeId,
      ...(subtitle ? { subtitle } : {}),
    });
    setPendingPlaceSelection({
      placeId,
      ...(mode ? { mode } : {}),
      ...(fallback ? { fallback } : {}),
    });
    const nextRouteState = {
      ...((location.state || {}) as Record<string, unknown>),
    };
    delete nextRouteState.selectedPlaceId;
    delete nextRouteState.placeFallback;
    go('tab.explore', {}, { state: nextRouteState, mode: 'replace' });
  };

  const sheetTitle = useMemo(() => {
    const q = query.trim();
    if (!q) return s.search_results;
    return q;
  }, [query, s]);

  const mapZoom = hasSubmitted ? 15 : 14;

  const handleHistoryClick = (item: MapSearchHistoryEntry) => {
    if (item.kind === 'place' && item.placeId) {
      KeyboardService.hide();
      inputRef.current?.blur();
      handleResultClick(item.placeId, item.text, item.subtitle);
      return;
    }
    invalidatePendingSearch();
    flushSync(() => {
      setQuery(item.text);
      setDebouncedQuery(item.text);
    });
    KeyboardService.hide();
    inputRef.current?.blur();
    void submitSearch(item.text);
  };

  const showResultsSheet = query && (hasSubmitted || searchBusy);

  useEffect(() => {
    if (!google || !mapInstance || !hasSubmitted || displaySearchItems.length === 0) return;
    try {
      const biasCenter = viewportCenter
        ? new google.maps.LatLng(viewportCenter.lat, viewportCenter.lng)
        : currentLocation.latitude && currentLocation.longitude
          ? new google.maps.LatLng(currentLocation.latitude, currentLocation.longitude)
          : null;
      applySearchResultsViewport({
        map: mapInstance,
        biasCenter,
        locations: displaySearchItems.map((item) => ({ lat: item.lat, lng: item.lng })),
      });
    } catch (e) {
      console.warn('[Map SearchPage] applySearchResultsViewport failed:', e);
    }
  }, [
    google,
    mapInstance,
    hasSubmitted,
    displaySearchItems,
    viewportCenter?.lat,
    viewportCenter?.lng,
    currentLocation.latitude,
    currentLocation.longitude,
  ]);

  return (
    <div ref={pageRootRef} className="flex flex-col h-full bg-app-surface relative overflow-hidden">
      {showResultMap && (
        <div className="absolute inset-0 z-0">
          <GoogleMap
            center={mapCenter}
            zoom={mapZoom}
            className="w-full h-full"
            onMapLoad={(map) => setMapInstance(map)}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              fullscreenControl: false,
              clickableIcons: true,
            }}
          />

          {hasSubmitted &&
            displaySearchItems.map((item) => {
              const lat = item.lat;
              const lng = item.lng;
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              if (lat === 0 && lng === 0) return null;
              return (
                <MapMarker
                  key={item.id}
                  map={mapInstance}
                  position={{ lat, lng }}
                  title={item.name}
                  zIndex={10}
                  onClick={() => handleResultClick(item.id, item.name, undefined, buildPlaceFallbackState(item))}
                />
              );
            })}
        </div>
      )}

      <div className="pt-12 px-4 pb-2 flex items-center gap-3 relative z-10">
        <button className="text-gray-600 p-1" {...bindBack()}>
          <IcNavBack size={24} />
        </button>
        <div className="flex-1 h-12 bg-gray-100 rounded-full flex items-center px-4 gap-2 group focus-within:bg-app-surface focus-within:shadow-md focus-within:border focus-within:border-app-border transition-all border border-transparent">
          <input
            ref={inputRef}
            type="text"
            placeholder={s.search_placeholder}
            autoFocus
            value={query}
            onChange={(e) => {
              invalidatePendingSearch();
              setHasSubmitted(false);
              setQuery(e.target.value);
            }}
            className="flex-1 bg-transparent text-lg outline-none placeholder-gray-500 text-gray-900"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                e.preventDefault();
                KeyboardService.hide();
                inputRef.current?.blur();
                submitSearch(query);
              }
            }}
          />
          {query ? (
            <button
              onClick={() => {
                invalidatePendingSearch();
                setHasSubmitted(false);
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-app-text-muted"
            >
              <IcClose size={24} />
            </button>
          ) : (
            <div className="relative w-6 h-6 flex items-center justify-center">
              <IcMic size={24} className="text-gray-600" />
            </div>
          )}
        </div>
      </div>

      <div
        className={`flex-1 overflow-y-auto no-scrollbar relative z-10 ${showResultMap ? 'bg-transparent' : 'bg-app-surface'} ${showResultsSheet ? 'pointer-events-none' : ''}`}
      >
        {!query && (
          <div className="flex flex-col">
            <div className="px-4 py-4 flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">{s.search_recent}</span>
              <button className="p-1 text-gray-400" type="button" />
            </div>

            {searchHistory.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 px-4 py-4 active:bg-gray-50"
                onClick={() => handleHistoryClick(item)}
              >
                <div className="mt-1 shrink-0 text-app-text-muted">
                  {item.kind === 'place' ? <IcLocation size={24} /> : <IcClock size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-gray-900 truncate">{item.text}</div>
                  {item.subtitle ? (
                    <div className="text-sm text-app-text-muted truncate">{item.subtitle}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="p-2 text-gray-400"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <IcClose size={20} />
                </button>
              </div>
            ))}

            <div className="mt-8 mx-4 p-4 bg-app-surface">
              <div className="text-base font-bold text-gray-900 mb-2">{s.search_typing_hint_title}</div>
              <div className="text-sm text-gray-600 mb-4 leading-relaxed">
                {s.search_typing_hint_desc}
              </div>
              <button
                type="button"
                className="bg-teal-50 text-teal-800 font-bold text-sm px-6 py-2 rounded-full"
              >
                {s.search_login_save}
              </button>
            </div>
          </div>
        )}

        {query && !hasSubmitted && !searchBusy && (
          <div className="py-2">
            {waitingForDebounce && (
              <div className="p-4 text-center text-sm text-app-text-muted">{s.search_loading_suggestions}</div>
            )}
            {!waitingForDebounce && suggestionsLoading && (
              <div className="p-8 text-center text-app-text-muted">{s.search_searching}</div>
            )}
            {!waitingForDebounce && !suggestionsLoading &&
              predictions.map((item, idx) =>
                item.kind === 'query' ? (
                  <div
                    key={`q-${idx}`}
                    className="flex items-center gap-4 px-4 py-4 active:bg-gray-50 border-b border-gray-50 last:border-0"
                    onClick={() => {
                      invalidatePendingSearch();
                      flushSync(() => {
                        setQuery(item.main_text);
                        setDebouncedQuery(item.main_text);
                      });
                      KeyboardService.hide();
                      inputRef.current?.blur();
                      void submitSearch(item.main_text);
                    }}
                  >
                    <div className="shrink-0 flex items-center justify-center w-8 h-8">
                      <IcSearch size={20} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-gray-900 truncate">{item.main_text}</div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 p-2 text-gray-400 -rotate-45"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuery(item.main_text);
                        inputRef.current?.focus();
                      }}
                    >
                      <IcNavBack size={20} className="rotate-180" />
                    </button>
                  </div>
                ) : (
                  <div
                    key={item.place_id}
                    className="flex items-start gap-4 px-4 py-4 active:bg-gray-50 border-b border-gray-50 last:border-0"
                    onClick={() =>
                      handleResultClick(
                        item.place_id,
                        item.main_text || item.description,
                        item.secondary_text || undefined,
                      )
                    }
                  >
                    <div className="mt-1 shrink-0 text-app-text-muted flex flex-col items-center min-w-[50px]">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-1">
                        <IcLocation size={18} className="text-app-text-muted" />
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDistanceLabelMeters(item.distance_meters, locale)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <div className="text-base font-bold text-gray-900 truncate">{item.main_text}</div>
                      </div>
                      <div className="text-sm text-app-text-muted truncate mt-0.5">{item.secondary_text}</div>
                    </div>
                    <button
                      type="button"
                      className="mt-1 shrink-0 p-2 text-gray-400 -rotate-45"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuery(item.main_text || item.description);
                        inputRef.current?.focus();
                      }}
                    >
                      <IcNavBack size={20} className="rotate-180" />
                    </button>
                  </div>
                ),
              )}

            {!waitingForDebounce && !suggestionsLoading && predictions.length === 0 && (
              <div className="p-8 text-center text-app-text-muted">{s.search_no_results}</div>
            )}
          </div>
        )}

      </div>

      {showResultsSheet && (
        <PlaceResultsSheet
          key={placeResultsSheetKey}
          layoutRootRef={pageRootRef}
          title={sheetTitle}
          category={guessedCategory}
          items={hasSubmitted ? displaySearchItems : []}
          loading={searchBusy && !hasSubmitted}
          onLoadMore={handleSearchLoadMore}
          loadingMore={searchLoadingMore}
          hasMore={searchHasMore}
          hideCallButton={guessedCategory === 'public_toilet'}
          onClose={() => {
            invalidatePendingSearch();
            setHasSubmitted(false);
          }}
          onItemClick={(item) => handleResultClick(item.id, item.name, undefined, buildPlaceFallbackState(item))}
          onSortChange={handlePlaceResultsSortChange}
          onFilterChange={handlePlaceResultsFilterChange}
          onNavigate={(item) => {
            if (!item) return;
            go('tab.explore', {}, {
              state: {
                destination: {
                  lat: item.lat,
                  lng: item.lng,
                  name: item.name,
                  address: item.address,
                },
              },
            });
          }}
        />
      )}
    </div>
  );
};
