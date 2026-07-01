import { createAppStoreWithActions, registerStateAdapter } from '../../os/createAppStore';
import { MAP_CONFIG } from './data';
import * as LocationService from '../../os/LocationService';
import { now as timeNow } from '../../os/TimeService';
import type { PendingPlaceSelection } from './types';


// ── Types ──────────────────────────────────────────────────────────

interface LocationCoords {
  latitude: number;
  longitude: number;
}

const _sysCoords = LocationService.getSimulatedCoords();
const DEFAULT_COORDS: LocationCoords = {
  latitude: _sysCoords?.latitude ?? 39.9042,
  longitude: _sysCoords?.longitude ?? 116.4074,
};

export interface AppDisplayPrefs {
  wlanOnly: boolean;
  satelliteView: boolean;
  accessibility: boolean;
  shakeFeedback: boolean;
  language: string | null;
  theme: string;
  distanceUnit: string;
  scaleBar: string;
  videoAutoplay: string;
}

export interface NavigationPrefs {
  muteState: string;
  voiceVolume: string;
  playVoiceOverBluetooth: boolean;
  playVoiceDuringCalls: boolean;
  playAudioCues: boolean;
  showMediaControls: boolean;
  trafficAlerts: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  fuelEfficient: boolean;
  colorScheme: string;
  distanceUnits: string;
  keepMapNorthUp: boolean;
  showRoutePreview: boolean;
  speedometer: boolean;
  drivingNotifications: boolean;
  bluetoothTunnelBeacon: boolean;
}

export interface LocationPrivacyPrefs {
  saveRecentSearches: boolean;
}

export interface OfflineMapPrefs {
  autoUpdate: boolean;
  autoDownloadRecommended: boolean;
  downloadPreference: string;
}

export interface TrafficNotificationPrefs {
  offlineMaps: string;
  nearbyTraffic: string;
  publicTransport: string;
  parkingLocation: string;
  desktopDirections: string;
}

export interface RecNotificationPrefs {
  nearbyPlaces: string;
  newPlaces: string;
}

export interface NotificationPrefs {
  traffic: TrafficNotificationPrefs;
  recommendations: RecNotificationPrefs;
}

export interface SettingsState {
  appDisplay: AppDisplayPrefs;
  navigation: NavigationPrefs;
  locationPrivacy: LocationPrivacyPrefs;
  offlineMaps: OfflineMapPrefs;
  notifications: NotificationPrefs;
}

export interface CurrentViewState {
  searchResults: Record<string, any>[];
  poi: Record<string, any> | null;
  route: Record<string, any> | null;
  routeModes: Record<string, any>;
  autocomplete: {
    query: string;
    suggestions: Record<string, any>[];
  } | null;
  /** 地点结果底部 Sheet（PlaceResultsSheet）打开时为 true，用于 MapApp 隐藏 TabBar */
  placeResultsSheetOpen: boolean;
  /** 路线底部 Sheet（RouteLoading/RouteDetail）打开时为 true，用于 MapApp 隐藏 TabBar */
  routeSheetOpen: boolean;
  /** 路线设置整页打开时为 true，用于 MapApp 隐藏 TabBar */
  routeSetupOpen: boolean;
}

/** 地图搜索最近记录：关键词搜索 vs 点选建议地点 */
export type MapSearchHistoryKind = 'place' | 'query';

export interface MapSearchHistoryEntry {
  id: string;
  kind: MapSearchHistoryKind;
  /** 主文案：地点名或搜索关键词 */
  text: string;
  /** kind === 'place' 时存在 */
  placeId?: string;
  subtitle?: string;
}

export type MapSearchHistoryInput =
  | { kind: 'query'; text: string }
  | { kind: 'place'; text: string; placeId: string; subtitle?: string };

interface MapState {
  user: typeof MAP_CONFIG.user;
  searchHistory: MapSearchHistoryEntry[];
  settings: SettingsState;
  currentLocation: LocationCoords;
  currentView: CurrentViewState;
  _temp: {
    locationLoading: boolean;
    locationError: string | null;
    isLoaded: boolean;
    loadError: Error | undefined;
    google: typeof google | undefined;
    pendingPlaceSelection: PendingPlaceSelection | null;
  };
}

interface MapActions {
  refreshLocation: () => void;
  setGoogleLoaded: (g: typeof google) => void;
  setGoogleLoadError: (e: Error) => void;
  updateAppDisplay: <K extends keyof AppDisplayPrefs>(key: K, value: AppDisplayPrefs[K]) => void;
  updateNavPrefs: <K extends keyof NavigationPrefs>(key: K, value: NavigationPrefs[K]) => void;
  updateLocationPrivacy: <K extends keyof LocationPrivacyPrefs>(key: K, value: LocationPrivacyPrefs[K]) => void;
  updateOfflineMapPrefs: <K extends keyof OfflineMapPrefs>(key: K, value: OfflineMapPrefs[K]) => void;
  updateTrafficNotifications: <K extends keyof TrafficNotificationPrefs>(key: K, value: TrafficNotificationPrefs[K]) => void;
  setAllTrafficNotifications: (value: string) => void;
  updateRecNotifications: <K extends keyof RecNotificationPrefs>(key: K, value: RecNotificationPrefs[K]) => void;
  setAllRecNotifications: (value: string) => void;
  addSearchHistory: (entry: MapSearchHistoryInput) => void;
  clearSearchHistory: () => void;
  setSearchResults: (results: Record<string, any>[]) => void;
  setActivePoi: (poi: Record<string, any> | null) => void;
  setActiveRoute: (route: Record<string, any> | null) => void;
  setRouteModes: (routeModes: Record<string, any>) => void;
  setAutocomplete: (query: string, suggestions: Record<string, any>[]) => void;
  setPendingPlaceSelection: (selection: Omit<PendingPlaceSelection, 'requestId'>) => void;
  clearPendingPlaceSelection: (requestId?: number) => void;
  setPlaceResultsSheetOpen: (open: boolean) => void;
  setRouteSheetOpen: (open: boolean) => void;
  setRouteSetupOpen: (open: boolean) => void;
  clearCurrentView: () => void;
}

function normalizeSearchHistoryFromConfig(raw: unknown): MapSearchHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: MapSearchHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const text = String(o.text ?? '').trim();
    if (!text) continue;
    const idRaw = String(o.id ?? '').trim();
    const id = idRaw || `h${timeNow()}_m${out.length}`;
    const subtitle = typeof o.subtitle === 'string' ? o.subtitle : undefined;
    const placeId = typeof o.placeId === 'string' ? o.placeId : undefined;
    const kindRaw = o.kind;
    if (kindRaw === 'place' && placeId) {
      out.push({ id, kind: 'place', text, placeId, subtitle });
    } else {
      out.push({ id, kind: 'query', text, subtitle });
    }
  }
  return out;
}

let pendingPlaceSelectionSeq = 0;

// ── Initial state ──────────────────────────────────────────────────

const initialState: MapState = {
  user: MAP_CONFIG.user,
  searchHistory: normalizeSearchHistoryFromConfig(MAP_CONFIG.searchHistory),
  settings: MAP_CONFIG.settings as SettingsState,
  currentLocation: DEFAULT_COORDS,
  currentView: {
    searchResults: [],
    poi: null,
    route: null,
    routeModes: {},
    autocomplete: null,
    placeResultsSheetOpen: false,
    routeSheetOpen: false,
    routeSetupOpen: false,
  },
  _temp: {
    locationLoading: true,
    locationError: null,
    isLoaded: false,
    loadError: undefined,
    google: undefined,
    pendingPlaceSelection: null,
  },
};

// ── Store ──────────────────────────────────────────────────────────

const mapStore = createAppStoreWithActions<MapState, MapActions>(
  'map',
  initialState,
  (set) => ({
    refreshLocation: () => {
      set((s) => ({
        currentLocation: { ...DEFAULT_COORDS },
        _temp: { ...s._temp, locationLoading: true, locationError: null },
      }));

      LocationService.getCurrentPosition(
        (position) => {
          set((s) => ({
            currentLocation: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            _temp: { ...s._temp, locationLoading: false, locationError: null },
          }));
        },
        (error) => {
          let errorMsg = '无法获取位置信息';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = '位置访问被拒绝';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = '位置信息不可用';
              break;
            case error.TIMEOUT:
              errorMsg = '获取位置信息超时';
              break;
          }
          console.warn('Map location error:', errorMsg);
          set((s) => ({
            _temp: { ...s._temp, locationLoading: false, locationError: errorMsg },
          }));
        },
        { timeout: 10000, enableHighAccuracy: true },
      );
    },

    setGoogleLoaded: (g: typeof google) => {
      set((s) => ({ _temp: { ...s._temp, google: g, isLoaded: true, loadError: undefined } }));
    },

    setGoogleLoadError: (e: Error) => {
      set((s) => ({ _temp: { ...s._temp, google: undefined, isLoaded: false, loadError: e } }));
    },

    updateAppDisplay: <K extends keyof AppDisplayPrefs>(key: K, value: AppDisplayPrefs[K]) => {
      set((state) => ({
        settings: {
          ...state.settings,
          appDisplay: { ...state.settings.appDisplay, [key]: value },
        },
      }));
    },

    updateNavPrefs: <K extends keyof NavigationPrefs>(key: K, value: NavigationPrefs[K]) => {
      set((state) => ({
        settings: {
          ...state.settings,
          navigation: { ...state.settings.navigation, [key]: value },
        },
      }));
    },

    updateLocationPrivacy: <K extends keyof LocationPrivacyPrefs>(key: K, value: LocationPrivacyPrefs[K]) => {
      set((state) => ({
        settings: {
          ...state.settings,
          locationPrivacy: { ...state.settings.locationPrivacy, [key]: value },
        },
      }));
    },

    updateOfflineMapPrefs: <K extends keyof OfflineMapPrefs>(key: K, value: OfflineMapPrefs[K]) => {
      set((state) => ({
        settings: {
          ...state.settings,
          offlineMaps: { ...state.settings.offlineMaps, [key]: value },
        },
      }));
    },

    updateTrafficNotifications: <K extends keyof TrafficNotificationPrefs>(key: K, value: TrafficNotificationPrefs[K]) => {
      set((state) => ({
        settings: {
          ...state.settings,
          notifications: {
            ...state.settings.notifications,
            traffic: { ...state.settings.notifications.traffic, [key]: value },
          },
        },
      }));
    },

    setAllTrafficNotifications: (value: string) => {
      set((state) => ({
        settings: {
          ...state.settings,
          notifications: {
            ...state.settings.notifications,
            traffic: {
              offlineMaps: value, nearbyTraffic: value, publicTransport: value,
              parkingLocation: value, desktopDirections: value,
            },
          },
        },
      }));
    },

    updateRecNotifications: <K extends keyof RecNotificationPrefs>(key: K, value: RecNotificationPrefs[K]) => {
      set((state) => ({
        settings: {
          ...state.settings,
          notifications: {
            ...state.settings.notifications,
            recommendations: { ...state.settings.notifications.recommendations, [key]: value },
          },
        },
      }));
    },

    setAllRecNotifications: (value: string) => {
      set((state) => ({
        settings: {
          ...state.settings,
          notifications: {
            ...state.settings.notifications,
            recommendations: { nearbyPlaces: value, newPlaces: value },
          },
        },
      }));
    },

    addSearchHistory: (entry: MapSearchHistoryInput) => {
      if (entry.kind === 'query') {
        const trimmed = entry.text.trim();
        if (!trimmed) return;
        set((state) => {
          const newId = `h${timeNow()}`;
          const existing = state.searchHistory.filter(
            (h) => !(h.kind === 'query' && h.text === trimmed),
          );
          const row: MapSearchHistoryEntry = { id: newId, kind: 'query', text: trimmed };
          return {
            searchHistory: [row, ...existing].slice(0, 20),
          };
        });
        return;
      }

      const text = entry.text.trim();
      const placeId = entry.placeId.trim();
      if (!text || !placeId) return;
      const subtitle = entry.subtitle?.trim() || undefined;
      set((state) => {
        const newId = `h${timeNow()}`;
        const existing = state.searchHistory.filter(
          (h) => !(h.kind === 'place' && h.placeId === placeId),
        );
        const row: MapSearchHistoryEntry = {
          id: newId,
          kind: 'place',
          text,
          placeId,
          ...(subtitle ? { subtitle } : {}),
        };
        return {
          searchHistory: [row, ...existing].slice(0, 20),
        };
      });
    },

    clearSearchHistory: () => {
      set({ searchHistory: [] });
    },

    setSearchResults: (results: Record<string, any>[]) => {
      set((state) => ({
        currentView: {
          ...state.currentView,
          searchResults: Array.isArray(results) ? results : [],
        },
      }));
    },

    setActivePoi: (poi: Record<string, any> | null) => {
      set((state) => ({
        currentView: {
          ...state.currentView,
          poi: poi ?? null,
        },
      }));
    },

    setActiveRoute: (route: Record<string, any> | null) => {
      set((state) => ({
        currentView: {
          ...state.currentView,
          route: route ?? null,
        },
      }));
    },

    setRouteModes: (routeModes: Record<string, any>) => {
      set((state) => ({
        currentView: {
          ...state.currentView,
          routeModes: routeModes && typeof routeModes === 'object' ? routeModes : {},
        },
      }));
    },

    setAutocomplete: (query: string, suggestions: Record<string, any>[]) => {
      set((state) => ({
        currentView: {
          ...state.currentView,
          autocomplete: {
            query: String(query || ''),
            suggestions: Array.isArray(suggestions) ? suggestions : [],
          },
        },
      }));
    },

    setPendingPlaceSelection: (selection) => {
      const placeId = selection.placeId.trim();
      if (!placeId) return;
      pendingPlaceSelectionSeq += 1;
      set((state) => ({
        _temp: {
          ...state._temp,
          pendingPlaceSelection: {
            ...selection,
            placeId,
            requestId: pendingPlaceSelectionSeq,
          },
        },
      }));
    },

    clearPendingPlaceSelection: (requestId) => {
      set((state) => {
        const current = state._temp.pendingPlaceSelection;
        if (!current) return {};
        if (requestId !== undefined && current.requestId !== requestId) return {};
        return {
          _temp: {
            ...state._temp,
            pendingPlaceSelection: null,
          },
        };
      });
    },

    setPlaceResultsSheetOpen: (open: boolean) => {
      set((state) => ({
        currentView: {
          ...state.currentView,
          placeResultsSheetOpen: Boolean(open),
        },
      }));
    },

    setRouteSheetOpen: (open: boolean) => {
      set((state) => ({
        currentView: {
          ...state.currentView,
          routeSheetOpen: Boolean(open),
        },
      }));
    },

    setRouteSetupOpen: (open: boolean) => {
      set((state) => ({
        currentView: {
          ...state.currentView,
          routeSetupOpen: Boolean(open),
        },
      }));
    },

    clearCurrentView: () => {
      set((state) => ({
        currentView: {
          ...state.currentView,
          searchResults: [],
          poi: null,
          route: null,
          routeModes: {},
          autocomplete: null,
          placeResultsSheetOpen: false,
          routeSheetOpen: false,
          routeSetupOpen: false,
        },
      }));
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        if (k === '_temp' || k === 'currentLocation' || k === 'currentView') continue;
        result[k] = v;
      }
      return result as Partial<MapState>;
    },
    afterHydration: () => {
      // persist 可能在 create 期间同步完成，此时 `const mapStore = …` 尚未赋值，不能直接引用 mapStore
      queueMicrotask(() => {
        mapStore.setState((s) => ({
          searchHistory: normalizeSearchHistoryFromConfig(s.searchHistory),
        }));
      });
    },
  },
);

export const useMapStore = mapStore;

// ── Selectors ──────────────────────────────────────────────────────

type MapStore = MapState & MapActions;

export const selectUser = (s: MapStore) => s.user;
export const selectSearchHistory = (s: MapStore) => s.searchHistory;
export const selectSettings = (s: MapStore) => s.settings;
export const selectCurrentLocation = (s: MapStore) => s.currentLocation;
export const selectCurrentView = (s: MapStore) => s.currentView;
export const selectLocationLoading = (s: MapStore) => s._temp.locationLoading;
export const selectLocationError = (s: MapStore) => s._temp.locationError;
export const selectIsLoaded = (s: MapStore) => s._temp.isLoaded;
export const selectLoadError = (s: MapStore) => s._temp.loadError;
export const selectGoogle = (s: MapStore) => s._temp.google;
export const selectPendingPlaceSelection = (s: MapStore) => s._temp.pendingPlaceSelection;
export const selectRefreshLocation = (s: MapStore) => s.refreshLocation;

// ── State adapter: strip _temp from exported state (contains google SDK with circular refs) ──
registerStateAdapter('map', (raw: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k !== '_temp') out[k] = v;
  }
  return out;
});
