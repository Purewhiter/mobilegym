import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { EXPLORE_CATEGORIES } from '../constants';
import { selectGoogle, useMapStore } from '../state';
import type { ShoppingItem } from '../types';
import { getLocale } from '../locale';
import {
  applySearchResultsViewport,
  captureViewport,
  restoreViewport,
  type SavedViewport,
} from '../utils/mapViewport';
import {
  placeSearchResultToPlaceResult,
  placeSearchResultToShoppingItem,
  searchPlacesByText,
} from '../utils/placeSearch';
import { getMapStrings } from '../utils/placeUtils';

type GoogleMapsApi = NonNullable<ReturnType<typeof selectGoogle>>;

export type UseCategorySearchOptions = {
  google: GoogleMapsApi | null | undefined;
  mapInstance: google.maps.Map | null;
  currentLocation: { latitude: number; longitude: number };
  setSelectedPlace: (place: google.maps.places.PlaceResult | null) => void;
};

/**
 * 分类附近搜索、标记与 PlaceResultsSheet 数据；含滚轮穿透拦截与分类开启时地图交互禁用。
 */
export function useCategorySearch({
  google,
  mapInstance,
  currentLocation,
  setSelectedPlace,
}: UseCategorySearchOptions) {
  const addSearchHistory = useMapStore((s) => s.addSearchHistory);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categorySheetLoading, setCategorySheetLoading] = useState(false);
  const [markers, setMarkers] = useState<google.maps.places.PlaceResult[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [allItems, setAllItems] = useState<ShoppingItem[]>([]);
  const nearbySearchReqIdRef = useRef(0);
  const savedViewportRef = useRef<SavedViewport | null>(null);
  const nextPageTokenRef = useRef<string | null>(null);
  const lastSearchCenterRef = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const lastDistanceOriginRef = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const lastTextQueryRef = useRef('');


  const getMarkerIcon = useCallback(
    (category: string, rating?: number) => {
      if (!google) return undefined;

      const color = '#DC2626';

      const icons: Record<string, string> = {
        restaurant:
          'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
        cafe:
          'M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z',
        shopping_mall:
          'M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 14c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z',
        clothing_store:
          'M21.96 6.74c-.28-.73-.83-1.33-1.54-1.69l-8.6-4.3a1.99 1.99 0 0 0-1.64 0l-8.6 4.3c-.71.36-1.26.96-1.54 1.69a2.003 2.003 0 0 0 .15 1.76l2.06 3.66c.26.46.75.75 1.28.75.25 0 .5-.06.72-.17l1.75-.87V20c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-8.13l1.75.87c.22.11.47.17.72.17.53 0 1.02-.29 1.28-.75l2.06-3.66c.35-.61.41-1.35.15-1.76zM7.5 5.5l4.5-2.25 4.5 2.25V7H7.5V5.5z',
        lodging:
          'M4 7c0-1.66 1.34-3 3-3h10c1.66 0 3 1.34 3 3v10h-2v-3H6v3H4V7zm4 1c-1.1 0-2 .9-2 2v1h10v-1c0-1.1-.9-2-2-2H8z',
        gas_station:
          'M6 3h6v18H6V3zm9 2v5.59l-1.3 1.3c-.19.19-.3.44-.3.71V21h4v-8l1.29-1.29c.18-.18.29-.43.29-.71V8.83c0-.53-.21-1.04-.59-1.41L16 3h-1z',
        grocery_store:
          'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.16 14h8.96c.83 0 1.54-.5 1.85-1.24L21 7H7.21L6.27 4.5 4 4v2h1l2.6 6.59L7.16 14z',
        tourist_attraction:
          'M4 18h16l-5-8-4 6-2-3zM6 8c1.66 0 3-1.34 3-3S7.66 2 6 2 3 3.34 3 5s1.34 3 3 3z',
      };

      const path = icons[category] || icons.restaurant;

      if ((category === 'restaurant' || category === 'cafe') && rating) {
        const svg = `
        <svg width="60" height="40" viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="16" fill="${color}" stroke="white" stroke-width="2"/>
            <g transform="translate(10, 10) scale(0.8)">
                <path fill="white" d="${path}"/>
            </g>
            <g transform="translate(30, 10)">
                <rect x="0" y="0" width="28" height="20" rx="10" fill="white" stroke="#E5E7EB" stroke-width="1"/>
                <text x="14" y="14" font-family="Arial" font-size="12" font-weight="bold" fill="#1F2937" text-anchor="middle" dominant-baseline="central">${rating.toFixed(1)}</text>
            </g>
        </svg>`;
        return {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(60, 40),
          anchor: new google.maps.Point(20, 20),
        };
      }

      const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="16" fill="${color}" stroke="white" stroke-width="2"/>
        <g transform="translate(10, 10) scale(0.8)">
            <path fill="white" d="${path}"/>
        </g>
    </svg>`;

      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20),
      };
    },
    [google],
  );

  const searchNearby = useCallback(
    async (type: string) => {
      if (!google) return;

      const mapCenter = mapInstance?.getCenter();
      const searchLat = mapCenter ? mapCenter.lat() : currentLocation.latitude;
      const searchLng = mapCenter ? mapCenter.lng() : currentLocation.longitude;
      if (typeof searchLat !== 'number' || typeof searchLng !== 'number') return;

      const reqId = ++nearbySearchReqIdRef.current;

      flushSync(() => {
        setCategorySheetLoading(true);
        setActiveCategory(type);
      });
      setMarkers([]);
      setSelectedPlace(null);
      setShoppingItems([]);
      nextPageTokenRef.current = null;

      const center = new google.maps.LatLng(searchLat, searchLng);
      const searchCenter = { lat: searchLat, lng: searchLng };
      const distanceOrigin =
        typeof currentLocation.latitude === 'number' &&
        typeof currentLocation.longitude === 'number'
          ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
          : searchCenter;

      try {
        const catDef = EXPLORE_CATEGORIES.find((c) => c.searchType === type);
        const localizedStrings = getMapStrings(getLocale());
        const textQuery = catDef ? localizedStrings[catDef.labelKey] : type;

        lastSearchCenterRef.current = searchCenter;
        lastDistanceOriginRef.current = distanceOrigin;
        lastTextQueryRef.current = textQuery;

        // 第一页
        const { results, nextPageToken } = await searchPlacesByText({
          textQuery,
          searchCenter,
          distanceOrigin,
        });

        if (reqId !== nearbySearchReqIdRef.current) return;

        nextPageTokenRef.current = nextPageToken ?? null;

        const placeResults = results.map(placeSearchResultToPlaceResult);
        const items: ShoppingItem[] = results.map((result) => placeSearchResultToShoppingItem(result));

        setShoppingItems(items);
        setAllItems(items);
        setMarkers(placeResults);
        addSearchHistory({ kind: 'query', text: textQuery });

        if (mapInstance && placeResults.length > 0) {
          if (!savedViewportRef.current) {
            savedViewportRef.current = captureViewport(mapInstance);
          }

          applySearchResultsViewport({
            map: mapInstance,
            biasCenter: center,
            locations: results.map((result) => ({ lat: result.lat, lng: result.lng })),
          });
        }

        setCategorySheetLoading(false);

        // 自动加载所有剩余页
        let currentToken: string | undefined = nextPageToken;
        let allResults = [...results];
        while (currentToken && reqId === nearbySearchReqIdRef.current) {
          const { results: moreResults, nextPageToken: moreToken } = await searchPlacesByText({
            textQuery,
            searchCenter,
            distanceOrigin,
            pageToken: currentToken,
          });

          if (reqId !== nearbySearchReqIdRef.current) break;

          allResults = [...allResults, ...moreResults];
          currentToken = moreToken;
          nextPageTokenRef.current = currentToken ?? null;

          const allPlaceResults = allResults.map(placeSearchResultToPlaceResult);
          const allItems: ShoppingItem[] = allResults.map((result) => placeSearchResultToShoppingItem(result));

          setShoppingItems(allItems);
          setAllItems(allItems);
          setMarkers(allPlaceResults);
        }
      } catch (err) {
        console.warn('Places searchNearby failed', err);
        if (reqId !== nearbySearchReqIdRef.current) return;
        nextPageTokenRef.current = null;
        const catDef = EXPLORE_CATEGORIES.find((c) => c.searchType === type);
        const localizedStrings = getMapStrings(getLocale());
        const textQuery = catDef ? localizedStrings[catDef.labelKey] : type;
        addSearchHistory({ kind: 'query', text: textQuery });
      } finally {
        if (reqId === nearbySearchReqIdRef.current) {
          setCategorySheetLoading(false);
        }
      }
    },
    [google, mapInstance, currentLocation.latitude, currentLocation.longitude, setSelectedPlace, addSearchHistory],
  );

  /** 关闭分类面板：可选是否清空当前选中地点（与顶部「关闭」行为一致时传 true） */
  const closeCategorySearch = useCallback(
    (clearSelectedPlace: boolean) => {
      nearbySearchReqIdRef.current += 1;
      setCategorySheetLoading(false);
      setActiveCategory(null);
      setMarkers([]);
      setShoppingItems([]);
      nextPageTokenRef.current = null;
      if (clearSelectedPlace) setSelectedPlace(null);

      if (savedViewportRef.current && mapInstance) {
        restoreViewport(mapInstance, savedViewportRef.current);
        savedViewportRef.current = null;
      }
    },
    [setSelectedPlace, mapInstance],
  );

  useEffect(() => {
    const preventWheel = (e: WheelEvent) => {
      if (activeCategory) {
        const target = e.target as HTMLElement;

        const scrollable = target.closest('.place-results-sheet-scrollable');

        if (scrollable) {
          const el = scrollable as HTMLElement;
          const { scrollTop, scrollHeight, clientHeight } = el;
          const delta = e.deltaY;
          const isScrollable = scrollHeight > clientHeight;

          if (!isScrollable) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          const atBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1.5;
          if (delta > 0 && atBottom) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          if (delta < 0 && scrollTop <= 0) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          return;
        }

        if (target.closest('.place-results-sheet-container')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener('wheel', preventWheel, { capture: true, passive: false });

    if (!mapInstance) {
      return () => {
        window.removeEventListener('wheel', preventWheel, { capture: true });
      };
    }

    if (activeCategory) {
      mapInstance.setOptions({
        scrollwheel: false,
        gestureHandling: 'none',
      });
    } else {
      mapInstance.setOptions({
        scrollwheel: false,
        gestureHandling: 'none',
      });

      let restoreTimer: ReturnType<typeof setTimeout>;

      const restoreMap = () => {
        if (!mapInstance) return;
        mapInstance.setOptions({
          scrollwheel: true,
          gestureHandling: 'greedy',
        });
        window.removeEventListener('wheel', blockAndDetect, { capture: true });
      };

      const blockAndDetect = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        clearTimeout(restoreTimer);
        restoreTimer = setTimeout(restoreMap, 250);
      };

      window.addEventListener('wheel', blockAndDetect, { capture: true, passive: false });

      restoreTimer = setTimeout(restoreMap, 500);

      return () => {
        clearTimeout(restoreTimer);
        window.removeEventListener('wheel', blockAndDetect, { capture: true });
        window.removeEventListener('wheel', preventWheel, { capture: true });
      };
    }

    return () => {
      window.removeEventListener('wheel', preventWheel, { capture: true });
    };
  }, [activeCategory, mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;

    const disableOptions: google.maps.MapOptions = {
      gestureHandling: 'none',
      scrollwheel: false,
      draggable: false,
      zoomControl: false,
      keyboardShortcuts: false,
      clickableIcons: false,
      disableDoubleClickZoom: true,
    };

    const enableOptions: google.maps.MapOptions = {
      gestureHandling: 'greedy',
      scrollwheel: true,
      draggable: true,
      zoomControl: false,
      keyboardShortcuts: true,
      clickableIcons: true,
      disableDoubleClickZoom: false,
    };

    mapInstance.setOptions(activeCategory ? disableOptions : enableOptions);
  }, [activeCategory, mapInstance]);

  return {
    activeCategory,
    setActiveCategory,
    categorySheetLoading,
    setCategorySheetLoading,
    markers,
    setMarkers,
    shoppingItems,
    setShoppingItems,
    allItems,
    setAllItems,
    nearbySearchReqIdRef,
    getMarkerIcon,
    searchNearby,
    closeCategorySearch,
  };
}
