import React, { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { IcClose } from '../res/icons';
import { EXPLORE_CATEGORIES } from '../constants';
import { useMapGestures } from '../hooks/useMapGestures';
import { useCategorySearch } from '../hooks/useCategorySearch';
import { useMapBackHandler } from '../hooks/useMapBackHandler';
import { isCurrentLocationRoutePoint, useRouting } from '../hooks/useRouting';
import {
  useMapStore,
  selectCurrentLocation,
  selectLocationLoading,
  selectGoogle,
  selectSearchHistory,
  selectPendingPlaceSelection,
} from '../state';
import { GoogleMap } from '../components/GoogleMap';
import { MapMarker } from '../components/MapMarker';
import { PlaceResultsSheet } from '../components/PlaceResultsSheet';
import { MapLayerSheet, type MapBaseTypeId, type MapDetailToggles } from '../components/MapLayerSheet';
import {
  formatDistanceLabelMeters,
  toPoiSnapshot,
  toSearchResultSnapshot,
} from '../utils/placeUtils';
import { fetchPlaceDetailWithOfflineFirst, getLatLngFromPlaceDetailResult } from '../utils/placeDetailFetch';
import { useDraggableSheet } from '../hooks/useDraggableSheet';
import { computeExplorePulseSheetSnaps } from '../utils/mapSheetSnaps';
import {
  clientPointToLatLng,
  getMapVisibleRectAboveBottomSheet,
  isClickOccludedBySheet,
  isLatLngOccludedBySheet,
  panLatLngToVisibleCenter,
  panLatLngToVisibleRectCenter,
  panScreenPointToVisibleCenter,
} from '../utils/mapViewport';
import { applyPlaceResultsDisplay } from '../utils/placeResultsFilters';
import { makeLatLngLike, readLatLngLike } from '../utils/latLng';
import {
  PinPickerFooter,
  PinPickerHeader,
  PinPickerMapCenterIcon,
} from '../components/explore/PinPickerOverlay';
import { SelectedPlaceFloatingBar } from '../components/explore/SelectedPlaceFloatingBar';
import { ExploreCategoryHeader } from '../components/explore/ExploreCategoryHeader';
import { ExploreSearchBar } from '../components/explore/ExploreSearchBar';
import { RoutingTopBar } from '../components/explore/RoutingTopBar';
import { ExplorePulseSheet } from '../components/explore/ExplorePulseSheet';
import { RouteDetailSheet } from '../components/explore/RouteDetailSheet';
import { RouteLoadingSheet } from '../components/explore/RouteLoadingSheet';
import { PlaceDetailSheet } from '../components/explore/PlaceDetailSheet';
import { NavigationOverlay } from '../components/explore/NavigationOverlay';
import { MapLayerFloatingButton, MapFloatingActionColumn } from '../components/explore/MapExploreChrome';
import { RouteSetupOverlay } from '../components/explore/RouteSetupOverlay';
import { RoutePointPickerOverlay } from '../components/explore/RoutePointPickerOverlay';
import { useMapStrings } from '../hooks/useMapStrings';
import { useLocale } from '../locale';
import type { PlaceSelectionFallback } from '../types';

const PLACE_RESULTS_SHEET_CATEGORIES = [
  'shopping_mall',
  'restaurant',
  'clothing_store',
  'cafe',
  'tourist_attraction',
  'lodging',
  'gas_station',
  'grocery_store',
] as const;

export const ExplorePage: React.FC = () => {
  const routerLocation = useLocation();
  const s = useMapStrings();
  const locale = useLocale();
  /** 仅「探索」首页：隐藏与 Tab 页 Sheet 冲突的脉搏/探索周边占位；搜索栏等仍显示 */
  const isExploreMapHome = routerLocation.pathname === '/';

  const { bindTap, go, replaceState } = useMapGestures();
  const currentLocation = useMapStore(selectCurrentLocation);
  const locationLoading = useMapStore(selectLocationLoading);
  const google = useMapStore(selectGoogle);
  const searchHistory = useMapStore(selectSearchHistory);
  const pendingPlaceSelection = useMapStore(selectPendingPlaceSelection);
  const setSearchResults = useMapStore((s) => s.setSearchResults);
  const setActivePoi = useMapStore((s) => s.setActivePoi);
  const setRouteSetupOpen = useMapStore((s) => s.setRouteSetupOpen);
  const clearPendingPlaceSelection = useMapStore((s) => s.clearPendingPlaceSelection);

  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [initialCenter, setInitialCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [viewState, setViewState] = useState<{ center: google.maps.LatLngLiteral; zoom: number } | null>(null);

  const [selectedPlace, _setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [isSelectedPlaceLoading, setIsSelectedPlaceLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'about'>('overview');
  const setSelectedPlace = useCallback((p: google.maps.places.PlaceResult | null) => {
    _setSelectedPlace(p);
    if (p) setDetailTab('overview');
    setIsSelectedPlaceLoading(false);
  }, []);
  const showSelectedPlaceLoading = useCallback((p: google.maps.places.PlaceResult) => {
    _setSelectedPlace(p);
    setDetailTab('overview');
    setIsSelectedPlaceLoading(true);
  }, []);

  const {
    activeCategory,
    setActiveCategory,
    categorySheetLoading,
    markers,
    setMarkers,
    shoppingItems,
    setShoppingItems,
    allItems,
    setAllItems,
    getMarkerIcon,
    searchNearby,
    closeCategorySearch,
  } = useCategorySearch({ google, mapInstance, currentLocation, setSelectedPlace });

  // 分类搜索：前端虚拟分页
  const CATEGORY_PAGE_SIZE = 20;
  const [categorySort, setCategorySort] = useState<'relevance' | 'distance'>('relevance');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [categoryVisibleCount, setCategoryVisibleCount] = useState(CATEGORY_PAGE_SIZE);

  // activeCategory 变化时重置分页和排序
  useEffect(() => {
    setCategorySort('relevance');
    setCategoryFilters([]);
    setCategoryVisibleCount(CATEGORY_PAGE_SIZE);
  }, [activeCategory]);

  const processedCategoryItems = useMemo(
    () => applyPlaceResultsDisplay(allItems, categorySort, categoryFilters),
    [allItems, categorySort, categoryFilters],
  );

  const displayCategoryItems = useMemo(
    () => processedCategoryItems.slice(0, categoryVisibleCount),
    [processedCategoryItems, categoryVisibleCount],
  );

  const categoryHasMore = categoryVisibleCount < processedCategoryItems.length;
  const [categoryLoadingMore, setCategoryLoadingMore] = useState(false);

  const handleCategoryLoadMore = useCallback(() => {
    if (categoryLoadingMore || !categoryHasMore) return;
    setCategoryLoadingMore(true);
    requestAnimationFrame(() => {
      setCategoryVisibleCount((prev) => prev + CATEGORY_PAGE_SIZE);
      setCategoryLoadingMore(false);
    });
  }, [categoryLoadingMore, categoryHasMore]);

  const {
    destination,
    location,
    origin,
    setOrigin,
    anchorSide,
    setAnchorSide,
    selectionMode,
    setSelectionMode,
    isPinPicking,
    setIsPinPicking,
    routeInfo,
    setRouteInfo,
    routeError,
    setRouteError,
    routeSteps,
    currentStepIndex,
    setCurrentStepIndex,
    routeEndLocation,
    setRouteEndLocation,
    travelMode,
    setTravelMode,
    selectedTransportMode,
    setSelectedTransportMode,
    modeDurations,
    isNavigating,
    setIsNavigating,
    clearRoutePolyline,
    handleSwapRoute,
    handlePinPickerConfirm,
    modes,
  } = useRouting({ mapInstance, currentLocation });

  const [distanceString, setDistanceString] = useState<string>('');
  const pendingSelectedPlaceRequestRef = useRef<string | null>(null);
  const latestRouteStateRef = useRef(location.state);
  latestRouteStateRef.current = location.state;
  const selectedPlaceIdFromRouteState =
    typeof location.state?.selectedPlaceId === 'string' ? location.state.selectedPlaceId : undefined;
  const selectedPlaceModeFromRouteState =
    location.state?.mode === 'origin' || location.state?.mode === 'destination'
      ? location.state.mode
      : undefined;
  const selectedPlaceFallbackFromRouteState =
    location.state?.placeFallback && typeof location.state.placeFallback === 'object'
      ? (location.state.placeFallback as PlaceSelectionFallback)
      : undefined;
  const selectedPlaceIdFromState = pendingPlaceSelection?.placeId ?? selectedPlaceIdFromRouteState;
  const selectedPlaceModeFromState = pendingPlaceSelection?.mode ?? selectedPlaceModeFromRouteState;
  const selectedPlaceFallbackFromState = pendingPlaceSelection?.fallback ?? selectedPlaceFallbackFromRouteState;
  const pendingPlaceSelectionRequestId = pendingPlaceSelection?.requestId;

  // Calculate distance to selected place
  useEffect(() => {
    const toLatLng = readLatLngLike(selectedPlace?.geometry?.location);
    if (
      !toLatLng ||
      !Number.isFinite(currentLocation?.latitude) ||
      !Number.isFinite(currentLocation?.longitude) ||
      !google?.maps.geometry?.spherical
    ) {
      setDistanceString('');
      return;
    }

    const from = new google.maps.LatLng(currentLocation.latitude, currentLocation.longitude);
    const to = new google.maps.LatLng(toLatLng.lat, toLatLng.lng);
    const distMeters = google.maps.geometry.spherical.computeDistanceBetween(from, to);
    setDistanceString(formatDistanceLabelMeters(distMeters, locale));
  }, [selectedPlace, currentLocation, google, locale]);

  useEffect(() => {
    setSearchResults(shoppingItems.map(toSearchResultSnapshot));
  }, [shoppingItems, setSearchResults]);

  useEffect(() => {
    setActivePoi(isSelectedPlaceLoading ? null : toPoiSnapshot(selectedPlace, distanceString));
  }, [selectedPlace, distanceString, setActivePoi, isSelectedPlaceLoading]);

  // Restore map center if refreshing
  useEffect(() => {
    const saved = sessionStorage.getItem('restoreMapCenter');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.lat && parsed.lng) {
                setInitialCenter(parsed);
                setViewState({ center: parsed, zoom: 17 });
            }
        } catch (e) {}
        sessionStorage.removeItem('restoreMapCenter');
    }
  }, []);

  // Sync viewState with currentLocation when no other view override is active.
  // Now safe because state.ts initializes DEFAULT_LOCATION from LocationService
  // synchronously, so currentLocation is correct from the very first render.
  useEffect(() => {
      if (currentLocation.latitude && !selectedPlace && !initialCenter && !viewState) {
          setViewState({ 
              center: { lat: currentLocation.latitude, lng: currentLocation.longitude },
              zoom: 17
          });
      }
  }, [currentLocation, selectedPlace, initialCenter, viewState]);

  useEffect(() => {
    if (!selectedPlaceIdFromState) {
      pendingSelectedPlaceRequestRef.current = null;
      return;
    }

    const requestKey = pendingPlaceSelectionRequestId != null
      ? `pending:${pendingPlaceSelectionRequestId}`
      : `route:${selectedPlaceIdFromState}:${selectedPlaceModeFromState ?? 'detail'}`;
    if (pendingSelectedPlaceRequestRef.current === requestKey) return;
    pendingSelectedPlaceRequestRef.current = requestKey;

    const placeId = selectedPlaceIdFromState;
    const mode = selectedPlaceModeFromState;
    const fallback = selectedPlaceFallbackFromState;
    const selectionRequestId = pendingPlaceSelectionRequestId;
    if (selectionRequestId != null) {
      clearPendingPlaceSelection(selectionRequestId);
    }

    const snapshotRouteStateWithoutSelection = () => {
      const snapshot = { ...((latestRouteStateRef.current || {}) as Record<string, unknown>) };
      delete snapshot.selectedPlaceId;
      delete snapshot.mode;
      delete snapshot.placeFallback;
      return snapshot;
    };

    const fetchAndSet = async () => {
      try {
        if (mode !== 'origin' && mode !== 'destination') {
          showSelectedPlaceLoading({
            place_id: placeId,
            name: s.place_detail_title,
            types: [],
          } as google.maps.places.PlaceResult);
        }
        const result = await fetchPlaceDetailWithOfflineFirst({
          placeId,
          google,
          fallback,
        });
        const latLng = getLatLngFromPlaceDetailResult(result);

        if (mode === 'origin') {
          if (latLng) {
            const newOrigin = {
              lat: latLng.lat,
              lng: latLng.lng,
              name: String(result.name ?? ''),
            };
            setOrigin(newOrigin);
            replaceState({
              ...snapshotRouteStateWithoutSelection(),
              origin: newOrigin,
            });
          }
        } else if (mode === 'destination') {
          if (latLng) {
            replaceState({
              ...snapshotRouteStateWithoutSelection(),
              destination: {
                lat: latLng.lat,
                lng: latLng.lng,
                name: String(result.name ?? ''),
                address: (result.formatted_address as string | undefined) || undefined,
              },
            });
          }
        } else {
          setSelectedPlace(result as google.maps.places.PlaceResult);
          if (latLng && mapInstance) {
            mapInstance.setZoom(17);
            mapInstance.panTo(latLng);
            setViewState({ center: latLng, zoom: 17 });
          } else if (latLng) {
            setViewState({ center: latLng, zoom: 17 });
          }
          replaceState(snapshotRouteStateWithoutSelection());
        }
      } catch (e) {
        console.warn('Failed to fetch place details', e);
        // Allow the user (or upstream state) to retry the same place; without
        // this reset the dedup ref would permanently block re-fetches of the
        // same (placeId, mode) pair after a transient failure.
        pendingSelectedPlaceRequestRef.current = null;
        if (mode !== 'origin' && mode !== 'destination') {
          setIsSelectedPlaceLoading(false);
        }
      }
    };

    fetchAndSet();
  }, [
    google,
    mapInstance,
    replaceState,
    s.place_detail_title,
    selectedPlaceIdFromState,
    selectedPlaceModeFromState,
    selectedPlaceFallbackFromState,
    pendingPlaceSelectionRequestId,
    clearPendingPlaceSelection,
    setOrigin,
    setSelectedPlace,
    showSelectedPlaceLoading,
  ]);

  useEffect(() => {
    if (google && mapInstance && currentLocation.latitude) {
      // Set minZoom globally to avoid infinite shrink issue
      mapInstance.setOptions({ minZoom: 10 });
    }
  }, [google, mapInstance, currentLocation]);

  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);
  const bikeLayerRef = useRef<google.maps.BicyclingLayer | null>(null);
  const [layerSheetOpen, setLayerSheetOpen] = useState(false);
  const [mapBaseType, setMapBaseType] = useState<MapBaseTypeId>('roadmap');
  const basemapIdleListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const [mapLayerDetails, setMapLayerDetails] = useState<MapDetailToggles>({
    transit: false,
    traffic: false,
    biking: false,
    threeD: false,
    streetView: false,
    wildfire: false,
    airQuality: false,
  });

  const handleBaseMapTypeChange = useCallback(
    (t: MapBaseTypeId) => {
      setMapBaseType(t);
      if (!mapInstance || !google) return;
      mapInstance.setMapTypeId(t);
      if (basemapIdleListenerRef.current) {
        google.maps.event.removeListener(basemapIdleListenerRef.current);
        basemapIdleListenerRef.current = null;
      }
      basemapIdleListenerRef.current = google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
        basemapIdleListenerRef.current = null;
      });
    },
    [mapInstance, google],
  );

  useEffect(() => {
    return () => {
      if (basemapIdleListenerRef.current && google) {
        google.maps.event.removeListener(basemapIdleListenerRef.current);
        basemapIdleListenerRef.current = null;
      }
    };
  }, [google]);

  useEffect(() => {
    if (!mapInstance || !google) return;
    if (!trafficLayerRef.current) trafficLayerRef.current = new google.maps.TrafficLayer();
    trafficLayerRef.current.setMap(mapLayerDetails.traffic ? mapInstance : null);
  }, [mapInstance, google, mapLayerDetails.traffic]);

  useEffect(() => {
    if (!mapInstance || !google) return;
    if (!transitLayerRef.current) transitLayerRef.current = new google.maps.TransitLayer();
    transitLayerRef.current.setMap(mapLayerDetails.transit ? mapInstance : null);
  }, [mapInstance, google, mapLayerDetails.transit]);

  useEffect(() => {
    if (!mapInstance || !google) return;
    if (!bikeLayerRef.current) bikeLayerRef.current = new google.maps.BicyclingLayer();
    bikeLayerRef.current.setMap(mapLayerDetails.biking ? mapInstance : null);
  }, [mapInstance, google, mapLayerDetails.biking]);

  useEffect(() => {
    if (!mapInstance || isNavigating) return;
    mapInstance.setTilt(mapLayerDetails.threeD ? 45 : 0);
  }, [mapInstance, mapLayerDetails.threeD, isNavigating]);

  const categoryLabel = (fallback = '') => {
    const c = EXPLORE_CATEGORIES.find(c => c.searchType === activeCategory);
    return c ? s[c.labelKey] : fallback;
  };

  const buildClickFallback = (
    placeId: string | null | undefined,
    clickLatLng: google.maps.LatLngLiteral | null,
  ): { placeId: string; fallback: PlaceSelectionFallback } | null => {
    const resolvedPlaceId = placeId?.trim() || '';
    if (!resolvedPlaceId) return null;
    return {
      placeId: resolvedPlaceId,
      fallback: {
        name: s.place_detail_title,
        ...(clickLatLng ? { location: clickLatLng } : {}),
        types: [],
      },
    };
  };

  const openResolvedMapPlace = async (
    resolved: { placeId: string; fallback: PlaceSelectionFallback },
    clickX?: number,
    clickY?: number,
  ) => {
    const cRect = containerRef.current?.getBoundingClientRect();
    const sheetRatio = snapPoints.half / (containerRef.current?.clientHeight || 1);
    const willBeOccluded = clickY != null && cRect
      ? isClickOccludedBySheet(clickY, cRect, sheetRatio)
      : false;

    showSelectedPlaceLoading({
      place_id: resolved.placeId,
      name: resolved.fallback.name || s.place_detail_title,
      formatted_address: resolved.fallback.formattedAddress,
      geometry: resolved.fallback.location ? { location: resolved.fallback.location } : undefined,
      types: resolved.fallback.types || [],
    } as google.maps.places.PlaceResult);

    if (
      willBeOccluded &&
      mapInstance &&
      clickX != null &&
      clickY != null &&
      cRect
    ) {
      panScreenPointToVisibleCenter(mapInstance, clickX, clickY, cRect, sheetRatio);
    }

    try {
      const result = await fetchPlaceDetailWithOfflineFirst({
        placeId: resolved.placeId,
        google,
        fallback: resolved.fallback,
      });
      setSelectedPlace(result as google.maps.places.PlaceResult);
    } catch (error) {
      console.warn('Failed to fetch place details on click', error);
      setIsSelectedPlaceLoading(false);
    }
  };

  // Handle Map Click
  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    // If active category is open, ignore all map clicks to prevent interaction
    if (activeCategory) {
        e.stop();
        return;
    }
    if (!google) return;

    const placeId = (e as google.maps.MapMouseEvent & { placeId?: string }).placeId;
    const domEvent = (e as unknown as { domEvent?: MouseEvent }).domEvent;
    const clickX = domEvent?.clientX;
    const clickY = domEvent?.clientY;
    const clickLatLng = mapInstance && clickX != null && clickY != null
      ? clientPointToLatLng(mapInstance, clickX, clickY)
      : readLatLngLike(e.latLng);
    const resolved = buildClickFallback(placeId, clickLatLng);

    if (resolved) {
      e.stop();
      await openResolvedMapPlace(resolved, clickX, clickY);
    } else {
      setSelectedPlace(null); // Deselect if clicking empty space
    }
  };

  // Handle Long Press
  const handleLongPress = (e: google.maps.MapMouseEvent) => {
    // If active category is open, ignore all interactions
    if (activeCategory) {
        e.stop();
        return;
    }
    if (!google) return;

    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      const pressX = (e as unknown as { domEvent?: MouseEvent }).domEvent?.clientX;
      const pressY = (e as unknown as { domEvent?: MouseEvent }).domEvent?.clientY;
      const cRect = containerRef.current?.getBoundingClientRect();
      const sheetRatio = snapPoints.half / (containerRef.current?.clientHeight || 1);
      const willBeOccluded = pressY != null && cRect
        ? isClickOccludedBySheet(pressY, cRect, sheetRatio)
        : false;

      showSelectedPlaceLoading({
        name: s.dropped_pin,
        geometry: { location: e.latLng },
        types: ['point_of_interest'],
        vicinity: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      } as google.maps.places.PlaceResult);

      if (willBeOccluded && mapInstance) {
        if (pressX != null && pressY != null && cRect) {
          panScreenPointToVisibleCenter(mapInstance, pressX, pressY, cRect, sheetRatio);
        } else {
          panLatLngToVisibleCenter(mapInstance, { lat, lng }, sheetRatio);
        }
      }

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
           const place = results[0];
           const placeResult: google.maps.places.PlaceResult = {
             place_id: place.place_id,
             name: s.dropped_pin,
             formatted_address: place.formatted_address,
             geometry: place.geometry,
             types: ['point_of_interest'],
             vicinity: place.formatted_address,
           };
           setSelectedPlace(placeResult);
        } else {
           const placeResult: google.maps.places.PlaceResult = {
             name: s.dropped_pin,
             geometry: {
               location: e.latLng ?? undefined,
               viewport: null as any
             },
             vicinity: `${lat.toFixed(5)}, ${lng.toFixed(5)}`
           };
           setSelectedPlace(placeResult);
        }

      });
    }
  };


  const sheetRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [snapPoints, setSnapPoints] = useState({ collapsed: 210, half: 400, full: 700 });
  /** 本地生活脉搏：三档 peek（默认露头）/ 约 20% 高度 / 顶满盖住搜索栏 */
  const [explorePulseSnaps, setExplorePulseSnaps] = useState({
    peek: 72,
    middle: 160,
    full: 700,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      setSnapPoints({
        collapsed: 210,
        half: h * 0.55,
        full: h - 48,
      });
      setExplorePulseSnaps(computeExplorePulseSheetSnaps(h));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const detailSnapArray = useMemo(
    () => [snapPoints.collapsed, snapPoints.half, snapPoints.full],
    [snapPoints.collapsed, snapPoints.half, snapPoints.full],
  );

  const {
    height: sheetHeight,
    setHeight: setSheetHeight,
    isDragging,
    pointerHandlers: detailSheetPointerHandlers,
  } = useDraggableSheet({
    snapPoints: detailSnapArray,
    initialHeight: 210,
    minHeight: 100,
    maxHeight: snapPoints.full,
  });

  useLayoutEffect(() => {
    if (selectedPlace) {
      setSheetHeight(snapPoints.half);
    }
  }, [selectedPlace, snapPoints.half, setSheetHeight]);

  useLayoutEffect(() => {
    if (!selectedPlace || !mapInstance || destination) return undefined;

    const latLng = readLatLngLike(selectedPlace.geometry?.location);
    if (!latLng) return undefined;

    let frame = 0;
    const timers: number[] = [];
    let idleListener: google.maps.MapsEventListener | null = null;

    const syncSelectedPlaceViewport = () => {
      const visibleRect = getMapVisibleRectAboveBottomSheet(
        mapInstance,
        sheetRef.current,
        sheetHeight,
      );
      if (!visibleRect) return;

      const center = panLatLngToVisibleRectCenter(mapInstance, latLng, visibleRect);
      setViewState({ center, zoom: mapInstance.getZoom() ?? 17 });
    };

    frame = window.requestAnimationFrame(syncSelectedPlaceViewport);
    [80, 180, 360, 520].forEach((delay) => {
      timers.push(window.setTimeout(syncSelectedPlaceViewport, delay));
    });
    idleListener = google?.maps.event.addListenerOnce(mapInstance, 'idle', syncSelectedPlaceViewport) ?? null;

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      idleListener?.remove();
    };
  }, [selectedPlace, mapInstance, destination, sheetHeight, google]);

  // Route Setup Overlay (after second FAB)
  const [showRouteSetup, setShowRouteSetup] = useState(false);
  const [routePickerMode, setRoutePickerMode] = useState<'origin' | 'destination' | null>(null);
  const [routePickerInitialQuery, setRoutePickerInitialQuery] = useState('');
  const [pinPickerReturnMode, setPinPickerReturnMode] = useState<'origin' | 'destination' | null>(null);
  const usesPlaceResultsSheet = Boolean(
    activeCategory && PLACE_RESULTS_SHEET_CATEGORIES.includes(activeCategory as typeof PLACE_RESULTS_SHEET_CATEGORIES[number]),
  );

  const openRoutePointPicker = useCallback(
    (mode: 'origin' | 'destination', initialQuery = '') => {
      setAnchorSide(mode);
      setRoutePickerInitialQuery(initialQuery);
      setRoutePickerMode(mode);
    },
    [setAnchorSide],
  );

  const selectRoutePointPlace = useCallback(
    (mode: 'origin' | 'destination', placeId: string) => {
      setAnchorSide(mode);
      setRoutePickerInitialQuery('');
      setRoutePickerMode(null);
      replaceState({
        ...(location.state || {}),
        selectedPlaceId: placeId,
        mode,
      });
    },
    [location.state, replaceState, setAnchorSide],
  );

  const routeSetupModes = useMemo(
    () => modes.map(({ key, icon }) => ({ key, icon })),
    [modes],
  );

  const explorePulseSnapArray = useMemo(
    () => [explorePulseSnaps.peek, explorePulseSnaps.middle, explorePulseSnaps.full],
    [explorePulseSnaps.peek, explorePulseSnaps.middle, explorePulseSnaps.full],
  );

  const {
    height: exploreSheetHeight,
    setHeight: setExploreSheetHeight,
    isDragging: isExploreDragging,
    pointerHandlers: exploreSheetPointerHandlers,
  } = useDraggableSheet({
    snapPoints: explorePulseSnapArray,
    initialHeight: explorePulseSnaps.peek,
    minHeight: 56,
    maxHeight: explorePulseSnaps.full,
  });


  const ROUTE_SNAP_COLLAPSED = 155;
  const ROUTE_SNAP_MEDIUM = 300;
  const ROUTE_SNAP_EXPANDED = window.innerHeight - 100;

  const {
    height: routeSheetHeight,
    setHeight: setRouteSheetHeight,
    isDragging: isRouteDragging,
    pointerHandlers: routeSheetPointerHandlers,
  } = useDraggableSheet({
    snapPoints: [ROUTE_SNAP_COLLAPSED, ROUTE_SNAP_MEDIUM, ROUTE_SNAP_EXPANDED],
    initialHeight: 380,
    minHeight: 100,
    maxHeight: window.innerHeight - 20,
  });

  const isCollapsed = routeSheetHeight < (ROUTE_SNAP_MEDIUM + ROUTE_SNAP_COLLAPSED) / 2;
  const isExpanded = routeSheetHeight > (ROUTE_SNAP_MEDIUM + ROUTE_SNAP_EXPANDED) / 2;

  // Reset sheet height when route changes or is found
  useEffect(() => {
      if (routeInfo) {
          setRouteSheetHeight(ROUTE_SNAP_MEDIUM);
      }
  }, [routeInfo]);

  useEffect(() => {
    if (showRouteSetup && destination) {
      setShowRouteSetup(false);
    }
  }, [destination, showRouteSetup]);

  useEffect(() => {
    if (routePickerMode && selectionMode) {
      setRoutePickerMode(null);
      setRoutePickerInitialQuery('');
    }
  }, [routePickerMode, selectionMode]);

  useEffect(() => {
    if (!isPinPicking && !selectionMode) {
      setPinPickerReturnMode(null);
    }
  }, [isPinPicking, selectionMode]);

  useEffect(() => {
    setRouteSetupOpen(showRouteSetup && isExploreMapHome);
    return () => setRouteSetupOpen(false);
  }, [isExploreMapHome, setRouteSetupOpen, showRouteSetup]);

  const handleExitNavigation = useCallback(() => {
    setIsNavigating(false);
    if (mapInstance) {
      mapInstance.setTilt(0);
      mapInstance.setZoom(17);
      if (origin) {
        mapInstance.panTo({ lat: origin.lat, lng: origin.lng });
      }
    }
  }, [mapInstance, origin, setIsNavigating]);

  useMapBackHandler(
    () => {
      setShowRouteSetup(false);
      return true;
    },
    { enabled: showRouteSetup && isExploreMapHome, priority: 650 },
  );

  useMapBackHandler(
    () => {
      closeCategorySearch(false);
      return true;
    },
    {
      enabled: Boolean(activeCategory && !usesPlaceResultsSheet && !destination && !selectedPlace),
      priority: 390,
    },
  );

  const isExplorePulseVisible = Boolean(
    isExploreMapHome &&
      !destination &&
      !selectedPlace &&
      !activeCategory &&
      !selectionMode &&
      !isPinPicking &&
      !showRouteSetup,
  );

  useMapBackHandler(
    () => {
      // 真机语义：只有本地生活脉搏顶满时，返回才先把它收回首页默认露头态。
      setExploreSheetHeight(explorePulseSnaps.peek);
      return true;
    },
    {
      enabled:
        isExplorePulseVisible &&
        !isExploreDragging &&
        exploreSheetHeight >= explorePulseSnaps.full - 1,
      priority: 320,
    },
  );

  const showPinPickerChrome = Boolean(isPinPicking && selectionMode);
  const mapCenter = useMemo(
    () => viewState?.center || initialCenter || { lat: currentLocation.latitude, lng: currentLocation.longitude },
    [viewState, initialCenter, currentLocation.latitude, currentLocation.longitude],
  );
  const mapZoom = viewState?.zoom || 17;

  const handlePinPickerClose = () => {
    const returnMode = pinPickerReturnMode;
    setIsPinPicking(false);
    setSelectionMode(null);
    if (returnMode) {
      setRoutePickerInitialQuery('');
      setRoutePickerMode(returnMode);
      setPinPickerReturnMode(null);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-gray-100 relative overflow-hidden">
      {/* Map */}
      <div
        className={
          showPinPickerChrome
            ? 'absolute inset-0 z-0 flex flex-col bg-gray-100 pt-10'
            : 'absolute inset-0 z-0'
        }
      >
        {showPinPickerChrome && selectionMode ? (
          <PinPickerHeader selectionMode={selectionMode} onClose={handlePinPickerClose} />
        ) : null}
        <div
          className={
            showPinPickerChrome ? 'flex min-h-0 flex-1 flex-col px-3 pb-1 pt-1' : 'h-full w-full'
          }
        >
          <div
            className={
              showPinPickerChrome
                ? 'relative min-h-0 flex-1 overflow-hidden rounded-[20px] shadow-md ring-1 ring-black/5'
                : 'relative h-full w-full'
            }
        >
        <GoogleMap
          center={mapCenter}
          zoom={mapZoom}
          className="w-full h-full"
          onMapLoad={(map) => {
              setMapInstance(map);
              // If we restored center, we might want to restore zoom too if saved
              // But for now center is enough
          }}
          onClick={handleMapClick}
          onLongPress={handleLongPress}
          options={{
            disableDefaultUI: true,
            zoomControl: false,
            fullscreenControl: false,
            clickableIcons: true,
          }}
        />

        {/* Current Location Blue Dot */}
        {currentLocation.latitude && !locationLoading && (
            <MapMarker
                map={mapInstance}
                position={{ lat: currentLocation.latitude, lng: currentLocation.longitude }}
                title={s.my_location}
                icon={google ? {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#4285F4',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2.5,
                } : undefined}
                zIndex={999}
            />
        )}

        {/* Render Route Markers (Origin and Destination) */}
        {destination && origin && (
            <>
                {/* Origin - Blue Circle for Current Location, White/Gray for others */}
                <MapMarker
                    map={mapInstance}
                    position={{ lat: origin.lat, lng: origin.lng }}
                    icon={isCurrentLocationRoutePoint(origin) ? {
                        path: google?.maps?.SymbolPath?.CIRCLE,
                        scale: 8,
                        fillColor: "#4285F4",
                        fillOpacity: 1,
                        strokeColor: "white",
                        strokeWeight: 2,
                    } : {
                        path: google?.maps?.SymbolPath?.CIRCLE,
                        scale: 6,
                        fillColor: "white",
                        fillOpacity: 1,
                        strokeColor: "#666666",
                        strokeWeight: 2,
                    } as any}
                    title={origin.name}
                    zIndex={isCurrentLocationRoutePoint(origin) ? 2 : 1}
                />
                
                {/* Destination - Red Pin for Places, Blue Circle if it is 'Your Location' */}
                <MapMarker
                    map={mapInstance}
                    position={{ lat: destination.lat, lng: destination.lng }}
                    title={destination.name}
                    icon={undefined}
                    zIndex={isCurrentLocationRoutePoint(destination) ? 2 : 1}
                />


            </>
        )}

        {/* Render Markers (Only when not pin picking) */}
        {!isPinPicking && markers.map((place) => (
          place.geometry?.location && (
            <MapMarker 
              key={place.place_id} 
              map={mapInstance} 
              position={(() => {
                const loc = place.geometry.location;
                if (typeof (loc as google.maps.LatLng).lat === 'function') {
                  return { lat: (loc as google.maps.LatLng).lat(), lng: (loc as google.maps.LatLng).lng() };
                }
                return loc as unknown as { lat: number; lng: number };
              })()} 
              title={place.name}
              icon={activeCategory ? getMarkerIcon(activeCategory, place.rating) : undefined}
              onClick={(event) => {
                setSelectedPlace(place);
                if (mapInstance && place.geometry?.location) {
                  const loc = place.geometry.location;
                  const latLng = typeof (loc as google.maps.LatLng).lat === 'function'
                    ? { lat: (loc as google.maps.LatLng).lat(), lng: (loc as google.maps.LatLng).lng() }
                    : loc as unknown as { lat: number; lng: number };
                  const sheetRatio = snapPoints.half / (containerRef.current?.clientHeight || 1);
                  if (google && isLatLngOccludedBySheet(mapInstance, latLng, sheetRatio)) {
                    const clickX = (event as unknown as { domEvent?: MouseEvent })?.domEvent?.clientX;
                    const clickY = (event as unknown as { domEvent?: MouseEvent })?.domEvent?.clientY;
                    const cRect = containerRef.current?.getBoundingClientRect();
                    if (clickX != null && clickY != null && cRect) {
                      panScreenPointToVisibleCenter(mapInstance, clickX, clickY, cRect, sheetRatio);
                    } else {
                      panLatLngToVisibleCenter(mapInstance, latLng, sheetRatio);
                    }
                  }
                }
              }}
            />
          )
        ))}

        {/* Selected Place Marker (From IcSearch or Click) */}
        {!isPinPicking && selectedPlace && selectedPlace.geometry?.location && (
             <MapMarker 
                 map={mapInstance}
                 position={(() => {
                 const loc = selectedPlace.geometry!.location;
                 if (typeof (loc as google.maps.LatLng).lat === 'function') {
                   return { lat: (loc as google.maps.LatLng).lat(), lng: (loc as google.maps.LatLng).lng() };
                 }
                 return loc as unknown as { lat: number; lng: number };
               })()}
                 title={selectedPlace.name}
             />
        )}
        
        {/* Pin Picker Center Marker */}
        {isPinPicking && <PinPickerMapCenterIcon />}
          </div>
        </div>
        {showPinPickerChrome ? <PinPickerFooter onConfirm={handlePinPickerConfirm} /> : null}
      </div>

      {showRouteSetup && !destination && !routePickerMode && !selectionMode && !isPinPicking && (
        <RouteSetupOverlay
          origin={origin}
          anchorSide={anchorSide}
          searchHistory={searchHistory}
          selectedTransportMode={selectedTransportMode}
          setAnchorSide={setAnchorSide}
          setSelectedTransportMode={setSelectedTransportMode}
          modes={routeSetupModes}
          onOpenPointPicker={openRoutePointPicker}
          onSelectHistoryPlace={(placeId, side) => selectRoutePointPlace(side, placeId)}
        />
      )}

      {routePickerMode && !selectionMode && !isPinPicking && (
        <RoutePointPickerOverlay
          mode={routePickerMode}
          initialQuery={routePickerInitialQuery}
          searchHistory={searchHistory}
          counterpart={routePickerMode === 'origin' ? destination ?? null : origin}
          continuationDuration={routeInfo?.duration ?? null}
          viewportCenter={(() => {
            const center = mapInstance?.getCenter();
            return center ? { lat: center.lat(), lng: center.lng() } : null;
          })()}
          onClose={() => {
            setRoutePickerMode(null);
            setRoutePickerInitialQuery('');
          }}
          onChooseOnMap={(side) => {
            setRoutePickerMode(null);
            setRoutePickerInitialQuery('');
            setPinPickerReturnMode(side);
            setAnchorSide(side);
            setSelectionMode(side);
            setIsPinPicking(true);
          }}
          onSelectPlace={(placeId) => {
            selectRoutePointPlace(routePickerMode, placeId);
          }}
        />
      )}

      {selectedPlace && !destination && (
        <SelectedPlaceFloatingBar
          selectedPlace={selectedPlace}
          onClear={() => {
            setSelectedPlace(null);
            replaceState({});
          }}
        />
      )}

      {/* Top UI Area (Hidden during selection) */}
      {!selectionMode && !isPinPicking && (
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        
        {activeCategory && !destination && (
          <ExploreCategoryHeader
            title={categoryLabel(s.search_results)}
            onClose={() => closeCategorySearch(true)}
            onSearchThisArea={() => {
              if (activeCategory) searchNearby(activeCategory);
            }}
          />
        )}

        {!destination && !selectedPlace && !activeCategory && (
          <ExploreSearchBar
            mapInstance={mapInstance}
            go={go}
            profileTriggerProps={bindTap('profile.open') as unknown as Record<string, unknown>}
            searchNearby={searchNearby}
          />
        )}

        {destination && !isNavigating && (
          <RoutingTopBar
            origin={origin}
            destination={destination}
            anchorSide={anchorSide}
            onSwapRoute={handleSwapRoute}
          onOpenPointPicker={openRoutePointPicker}
          />
        )}
      </div>
      )}

      {/* Bottom UI Area：仅探索首页显示「本地生活脉搏」；我/贡献 有各自 Tab Sheet，避免双 Sheet */}
      
      {isExploreMapHome &&
        !destination &&
        !selectedPlace &&
        !activeCategory &&
        !selectionMode &&
        !isPinPicking &&
        !showRouteSetup && (
        <ExplorePulseSheet
          exploreSheetHeight={exploreSheetHeight}
          isExploreDragging={isExploreDragging}
          exploreSnapPeek={explorePulseSnaps.peek}
          pointerHandlers={exploreSheetPointerHandlers}
        />
      )}

      {destination && routeInfo && !isNavigating && !selectionMode && !isPinPicking && !showRouteSetup && (
        <RouteDetailSheet
          routeSheetHeight={routeSheetHeight}
          isRouteDragging={isRouteDragging}
          routeSheetPointerHandlers={routeSheetPointerHandlers}
          selectedTransportMode={selectedTransportMode}
          setSelectedTransportMode={setSelectedTransportMode}
          modes={modes}
          modeDurations={modeDurations}
          routeError={routeError}
          routeInfo={routeInfo}
          isCollapsed={isCollapsed}
          isExpanded={isExpanded}
          destination={destination}
          routeSteps={routeSteps}
          origin={origin}
          mapInstance={mapInstance}
          clearRoutePolyline={clearRoutePolyline}
          setRouteEndLocation={setRouteEndLocation}
          setRouteInfo={setRouteInfo}
          setOrigin={setOrigin}
          setTravelMode={setTravelMode}
          replaceState={replaceState}
          setIsNavigating={setIsNavigating}
        />
      )}

      {destination && (!routeInfo || routeError) && !isNavigating && !selectionMode && !isPinPicking && !showRouteSetup && (
        <RouteLoadingSheet
          selectedTransportMode={selectedTransportMode}
          setSelectedTransportMode={setSelectedTransportMode}
          modeDurations={modeDurations}
          routeError={routeError}
          modes={modes}
          onCloseRoute={() => {
            setRouteError(null);
            setRouteInfo(null);
            setOrigin(null);
            setTravelMode('DRIVING' as any);
            replaceState({});
          }}
        />
      )}

      {selectedPlace && !destination && (
        <PlaceDetailSheet
          sheetRef={sheetRef}
          sheetHeight={sheetHeight}
          isDragging={isDragging}
          isLoading={isSelectedPlaceLoading}
          detailSheetPointerHandlers={detailSheetPointerHandlers}
          selectedPlace={selectedPlace as google.maps.places.PlaceResult & Record<string, unknown>}
          setSelectedPlace={setSelectedPlace}
          replaceState={replaceState}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
        />
      )}

      {/* Category Bottom Sheet */}
      {!destination && !selectedPlace && activeCategory && (
        ['shopping_mall', 'restaurant', 'clothing_store', 'cafe', 'tourist_attraction', 'lodging', 'gas_station', 'grocery_store'].includes(activeCategory) ? (
            <PlaceResultsSheet
                layoutRootRef={containerRef}
                title={categoryLabel(s.search_results)}
                category={activeCategory}
                items={displayCategoryItems}
                loading={categorySheetLoading}
                onLoadMore={handleCategoryLoadMore}
                loadingMore={categoryLoadingMore}
                hasMore={categoryHasMore}
                onClose={() => closeCategorySearch(false)}
                onSortChange={(sort) => {
                    setCategorySort(sort);
                    setCategoryVisibleCount(CATEGORY_PAGE_SIZE);
                }}
                onFilterChange={(filters) => {
                    setCategoryFilters(filters);
                    setCategoryVisibleCount(CATEGORY_PAGE_SIZE);
                }}
                onNavigate={(item) => {
                    // Direct navigation to route
                    const newDestination = {
                        lat: item.lat,
                        lng: item.lng,
                        name: item.name,
                        address: item.address,
                    };
                    
                    replaceState({
                            ...(location.state || {}),
                            destination: newDestination
                        });

                    closeCategorySearch(true);
                }}
                onItemClick={async (item) => {
                     const latLng = { lat: item.lat, lng: item.lng };
                     showSelectedPlaceLoading({
                       place_id: item.id,
                       name: item.name,
                       geometry: {
                         location: google
                           ? new google.maps.LatLng(item.lat, item.lng)
                           : makeLatLngLike(item.lat, item.lng),
                       },
                       rating: item.rating,
                       user_ratings_total: item.ratingCount,
                       types: activeCategory ? [activeCategory] : [],
                       vicinity: item.address,
                       formatted_address: item.address,
                       business_status: item.status === 'Open' ? 'OPERATIONAL' : 'CLOSED_TEMPORARILY',
                     } as google.maps.places.PlaceResult);
                     mapInstance?.setZoom(17);

                     if (mapInstance) {
                       const sheetRatio = snapPoints.half / (containerRef.current?.clientHeight || 1);
                       panLatLngToVisibleCenter(mapInstance, latLng, sheetRatio);
                     }

                     try {
                       const result = await fetchPlaceDetailWithOfflineFirst({
                         placeId: item.id,
                         google,
                         fallback: {
                           name: item.name,
                           formattedAddress: item.address,
                           location: { lat: item.lat, lng: item.lng },
                           types: activeCategory ? [activeCategory] : [],
                         },
                       });
                       setSelectedPlace(result as google.maps.places.PlaceResult);
                     } catch {
                       const fallback: any = {
                         place_id: item.id,
                         name: item.name,
                         geometry: {
                           location: google
                             ? new google.maps.LatLng(item.lat, item.lng)
                             : makeLatLngLike(item.lat, item.lng),
                         },
                         rating: item.rating,
                         user_ratings_total: item.ratingCount,
                         types: [activeCategory],
                         vicinity: item.address,
                         formatted_address: item.address,
                         business_status: item.status === 'Open' ? 'OPERATIONAL' : 'CLOSED_TEMPORARILY',
                       };
                       setSelectedPlace(fallback);
                     }
                }}
            />
        ) : (
        <div className="absolute bottom-0 left-0 right-0 bg-app-surface rounded-t-2xl shadow-up p-4 pb-safe z-10 pointer-events-auto" style={{ display: (selectionMode || isPinPicking || showRouteSetup) ? 'none' : undefined }}>
           <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
           <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-xl">{categoryLabel()}</div>
              <button 
                  className="p-1 text-app-text-muted"
                  onClick={() => closeCategorySearch(false)}
              >
                  <IcClose size={24} />
              </button>
           </div>
           
           {categorySheetLoading ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-10">
                <div
                  className="h-11 w-11 rounded-full border-2 border-gray-200 border-t-teal-600 animate-spin"
                  role="status"
                  aria-label={s.filter_loading}
                />
                <span className="text-sm text-app-text-muted">{s.search_loading_results}</span>
              </div>
           ) : (
           <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
               <button className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium text-gray-700 whitespace-nowrap">
                   {s.filter_relevance} <span className="text-[10px]">▼</span>
               </button>
               <button className="bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium text-gray-700 whitespace-nowrap">
                   {s.filter_open_now}
               </button>
               {(activeCategory === 'restaurant' || activeCategory === 'cafe') && (
                   <>
                       <button className="bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium text-gray-700 whitespace-nowrap">
                           {s.filter_top_rated}
                       </button>
                       <button className="bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium text-gray-700 whitespace-nowrap">
                           {s.filter_reviews_3_plus}
                       </button>
                   </>
               )}
               <button className="bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium text-blue-600 whitespace-nowrap">
                   {s.filter_more}
               </button>
           </div>
           )}
        </div>
        )
      )}

      {/* 3. Default Bottom Sheet (Collapsed) - 仅探索首页 */}
      {isExploreMapHome &&
        !destination &&
        !selectedPlace &&
        !activeCategory &&
        !selectionMode &&
        !isPinPicking &&
        !showRouteSetup && (
        <div className="absolute bottom-0 left-0 right-0 bg-app-surface rounded-t-2xl shadow-up p-4 pb-safe z-10 transform translate-y-[calc(100%-65px)] hover:translate-y-0" style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }}>
           <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
           <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-xl">{s.explore_nearby}</div>
              <div className="bg-gray-100 rounded-full px-3 py-1 text-sm text-gray-700 flex items-center gap-1">
                  <span className="text-amber-500">☀️</span> 23°
              </div>
           </div>
           
           <div className="h-40 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 text-sm border border-gray-100 border-dashed">
             {s.explore_nearby_placeholder}
           </div>
        </div>
      )}

      {!isNavigating &&
        !isPinPicking &&
        !selectionMode &&
        !showRouteSetup &&
        !selectedPlace && (
          <MapLayerFloatingButton
            activeCategory={activeCategory}
            destination={destination}
            onOpenLayers={() => setLayerSheetOpen(true)}
          />
        )}

      <MapLayerSheet
        open={layerSheetOpen}
        onClose={() => setLayerSheetOpen(false)}
        baseMapType={mapBaseType}
        onBaseMapChange={handleBaseMapTypeChange}
        details={mapLayerDetails}
        onDetailChange={(key, value) => setMapLayerDetails((d) => ({ ...d, [key]: value }))}
      />

      {!destination && (
        <MapFloatingActionColumn
          activeCategory={activeCategory}
          onRecenter={() => {
            if (currentLocation.latitude) {
              const center = { lat: currentLocation.latitude, lng: currentLocation.longitude };
              setInitialCenter(null);
              setViewState({ center, zoom: 17 });
              if (mapInstance) {
                mapInstance.panTo(center);
                const current = mapInstance.getZoom() ?? 15;
                if (current < 15) mapInstance.setZoom(15);
              }
            }
          }}
          onOpenRouteSetup={() => {
            setActiveCategory(null);
            setSelectedPlace(null);
            setMarkers([]);
            setAnchorSide('destination');
            setShowRouteSetup(true);
          }}
        />
      )}

      {isNavigating && (
        <NavigationOverlay
          currentStepIndex={currentStepIndex}
          routeSteps={routeSteps}
          routeInfo={routeInfo}
          onExit={handleExitNavigation}
        />
      )}

    </div>
  );
};
