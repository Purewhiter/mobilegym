import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  IcClock,
  IcClose,
  IcLocation,
  IcMic,
  IcNavBack,
} from '../../res/icons';
import { useLocale } from '../../locale';
import { googleLangCode } from '../../utils/placeUtils';
import { useMapBackHandler } from '../../hooks/useMapBackHandler';
import { useMapGestures } from '../../hooks/useMapGestures';
import { useMapStrings } from '../../hooks/useMapStrings';
import {
  useMapStore,
  selectCurrentLocation,
  selectGoogle,
  type MapSearchHistoryEntry,
} from '../../state';
import { formatDistanceLabelMeters } from '../../utils/placeUtils';
import { getAutocompleteOffline } from '../../utils/offlinePlaceStore';
import { hasGoogleMapsApiKey } from '../../utils/googleMapsConfig';
import { KeyboardService } from '@/os/keyboard';

type RouteSide = 'origin' | 'destination';

type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  distanceMeters?: number;
};

const AUTOCOMPLETE_DEBOUNCE_MS = 280;

export const RoutePointPickerOverlay: React.FC<{
  mode: RouteSide;
  initialQuery?: string;
  searchHistory: MapSearchHistoryEntry[];
  counterpart: { name: string } | null;
  continuationDuration?: string | null;
  viewportCenter?: { lat: number; lng: number } | null;
  onClose: () => void;
  onChooseOnMap: (side: RouteSide) => void;
  onSelectPlace: (placeId: string, title: string, subtitle?: string) => void;
}> = ({
  mode,
  initialQuery = '',
  searchHistory,
  counterpart,
  continuationDuration,
  viewportCenter,
  onClose,
  onChooseOnMap,
  onSelectPlace,
}) => {
  const { bindTap } = useMapGestures();
  const google = useMapStore(selectGoogle);
  const currentLocation = useMapStore(selectCurrentLocation);
  const locale = useLocale();
  const s = useMapStrings();

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useMapBackHandler(
    () => {
      onClose();
      return true;
    },
    { priority: 700 },
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), AUTOCOMPLETE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!google) return;
    void google.maps.importLibrary('places');
  }, [google]);

  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();
    if (!trimmedQuery) {
      setPredictions([]);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    setSuggestionsLoading(true);

    const run = async () => {
      const offline = await getAutocompleteOffline({
        input: trimmedQuery,
        locale,
        placesOnly: true,
      });
      if (cancelled) return;
      if (offline.source === 'autocomplete_index') {
        console.log(`[Map][离线] 路线选点提示: "${trimmedQuery}" 命中 autocomplete_index -> ${offline.predictions.length} 个地点`);
        setPredictions(
          offline.predictions.map((item) => ({
            placeId: item.place_id,
            mainText: item.main_text,
            secondaryText: item.secondary_text,
            distanceMeters: item.distance_meters,
          })),
        );
        setSuggestionsLoading(false);
        return;
      }

      if (!google || !hasGoogleMapsApiKey()) {
        const fallback = await getAutocompleteOffline({
          input: trimmedQuery,
          locale,
          placesOnly: true,
          allowSearchIndexFallback: true,
        });
        if (cancelled) return;
        if (fallback.predictions.length > 0) {
          console.log(`[Map][离线未命中] 路线选点提示: "${trimmedQuery}" 没有 autocomplete_index，Google key 不可用，使用 search_index 兜底 -> ${fallback.predictions.length} 个地点`);
          setPredictions(
            fallback.predictions.map((item) => ({
              placeId: item.place_id,
              mainText: item.main_text,
              secondaryText: item.secondary_text,
              distanceMeters: item.distance_meters,
            })),
          );
          setSuggestionsLoading(false);
          return;
        }
        console.log(`[Map][离线未命中] 路线选点提示: "${trimmedQuery}" 未命中 autocomplete_index/search_index，Google key 不可用`);
        setPredictions([]);
        setSuggestionsLoading(false);
        return;
      }

      console.log(`[Map][在线] 路线选点提示: "${trimmedQuery}" 离线未命中，调用 Google Place Autocomplete`);
      const service = new google.maps.places.AutocompleteService();
      const biasLat = viewportCenter?.lat ?? currentLocation.latitude;
      const biasLng = viewportCenter?.lng ?? currentLocation.longitude;
      const locationForBias =
        typeof biasLat === 'number' && typeof biasLng === 'number'
          ? new google.maps.LatLng(biasLat, biasLng)
          : undefined;

      const placeReq: google.maps.places.AutocompletionRequest = {
        input: debouncedQuery,
        language: googleLangCode(locale),
        ...(locationForBias
          ? { locationBias: { center: locationForBias, radius: 5000 }, origin: locationForBias }
          : {}),
      };

      service.getPlacePredictions(placeReq, (results, status) => {
        if (cancelled) return;
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          console.log(`[Map][离线未命中] 路线选点提示: "${trimmedQuery}" 在线提示失败或无结果 (${status})`);
          setPredictions([]);
          setSuggestionsLoading(false);
          return;
        }

        console.log(`[Map][在线] 路线选点提示: "${trimmedQuery}" -> ${results.length} 个地点`);
        setPredictions(
          results.map((item) => ({
            placeId: item.place_id,
            mainText: item.structured_formatting?.main_text ?? item.description ?? '',
            secondaryText: item.structured_formatting?.secondary_text ?? '',
            distanceMeters: item.distance_meters ?? undefined,
          })),
        );
        setSuggestionsLoading(false);
      });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, google, currentLocation.latitude, currentLocation.longitude, viewportCenter?.lat, viewportCenter?.lng, locale]);

  const placeHistory = useMemo(
    () =>
      searchHistory.filter(
        (item): item is MapSearchHistoryEntry & { kind: 'place'; placeId: string } =>
          item.kind === 'place' && typeof item.placeId === 'string' && item.placeId.length > 0,
      ),
    [searchHistory],
  );

  const placeholder = mode === 'origin' ? s.route_setup_select_start : s.route_setup_select_dest;

  const handleSelect = (placeId: string, title: string, subtitle?: string) => {
    KeyboardService.hide();
    inputRef.current?.blur();
    onSelectPlace(placeId, title, subtitle);
  };

  const showHistory = query.trim().length === 0;

  return (
    <div className="absolute inset-0 z-40 bg-app-surface pointer-events-auto">
      <div className="flex h-full flex-col pt-10">
        <div className="px-3 pb-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
              {...bindTap<HTMLButtonElement>(
                { kind: 'action', id: 'routePicker.close' },
                { onTrigger: onClose },
              )}
            >
              <IcNavBack size={24} />
            </button>
            <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-gray-100 px-4">
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={query}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-lg text-gray-900 outline-none placeholder:text-gray-500"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                    e.preventDefault();
                    if (predictions[0]) {
                      handleSelect(
                        predictions[0].placeId,
                        predictions[0].mainText,
                        predictions[0].secondaryText || undefined,
                      );
                    }
                  }
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="text-app-text-muted"
                  {...bindTap<HTMLButtonElement>(
                    { kind: 'action', id: 'routePicker.clearQuery' },
                    {
                      onTrigger: () => {
                        flushSync(() => {
                          setQuery('');
                          setDebouncedQuery('');
                        });
                        inputRef.current?.focus();
                      },
                    },
                  )}
                >
                  <IcClose size={22} />
                </button>
              ) : (
                <IcMic size={22} className="text-app-text-muted" />
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          {showHistory ? (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-4 px-4 py-4 text-left active:bg-gray-50"
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'routePicker.chooseOnMap' },
                  {
                    onTrigger: () => {
                      KeyboardService.hide();
                      inputRef.current?.blur();
                      onChooseOnMap(mode);
                    },
                  },
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-app-text-muted">
                  <IcLocation size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg text-gray-900">{s.select_on_map}</div>
                </div>
              </button>

              {placeHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-start gap-4 px-4 py-4 text-left active:bg-gray-50"
                  {...bindTap<HTMLButtonElement>(
                    { kind: 'action', id: 'routePicker.history.select' },
                    {
                      onTrigger: () => handleSelect(item.placeId, item.text, item.subtitle),
                    },
                  )}
                >
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-app-text-muted">
                    <IcClock size={18} />
                  </div>
                  <div className="min-w-0 flex-1 border-b border-gray-100 pb-4">
                    <div className="truncate text-[17px] font-medium text-gray-900">{item.text}</div>
                    {item.subtitle ? (
                      <div className="truncate text-sm text-app-text-muted">{item.subtitle}</div>
                    ) : null}
                  </div>
                </button>
              ))}
            </>
          ) : (
            <div className="py-1">
              {suggestionsLoading ? (
                <div className="p-8 text-center text-app-text-muted">{s.search_searching}</div>
              ) : predictions.length > 0 ? (
                predictions.map((item) => (
                  <button
                    key={item.placeId}
                    type="button"
                    className="flex w-full items-start gap-4 px-4 py-4 text-left active:bg-gray-50"
                    {...bindTap<HTMLButtonElement>(
                      { kind: 'action', id: 'routePicker.prediction.select' },
                      {
                        onTrigger: () => handleSelect(
                          item.placeId,
                          item.mainText,
                          item.secondaryText || undefined,
                        ),
                      },
                    )}
                  >
                    <div className="mt-1 flex min-w-[52px] shrink-0 flex-col items-center text-app-text-muted">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                        <IcLocation size={17} />
                      </div>
                      <span className="mt-1 text-xs text-gray-400">
                        {formatDistanceLabelMeters(item.distanceMeters, locale)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 border-b border-gray-100 pb-4">
                      <div className="truncate text-[17px] font-medium text-gray-900">{item.mainText}</div>
                      <div className="truncate text-sm text-app-text-muted">{item.secondaryText}</div>
                    </div>
                    <div className="pt-1 text-gray-500">
                      <IcNavBack size={18} className="rotate-180 -rotate-45" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-app-text-muted">{s.search_no_results}</div>
              )}
            </div>
          )}
        </div>

        {showHistory && counterpart ? (
          <div className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-app-surface px-4 py-4 shadow-up">
            <div className="text-[17px] font-medium text-gray-900">{s.route_continue_to}{counterpart.name}</div>
            {continuationDuration ? (
              <div className="mt-1 text-sm text-app-text-muted">{continuationDuration}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
