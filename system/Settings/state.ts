import { useCallback, useSyncExternalStore } from 'react';
import { createAppStoreWithActions, memoSelector } from '../../os/createAppStore';
import { ConnectivityManager } from '../../os/managers/ConnectivityManager';
import { routeGetPreference, routeSetPreference } from '../../os/managers/registry';
import { useOsStateStore } from '../../os/OsStateStore';
import { DEFAULT_SETTINGS_STATE } from './data/settingsConfig';
import { subscribeOsDataRevision } from '../../os/simState';
import { loadPages, type SettingsPagesData } from './data/loader';
import type { SettingsConfigState, SettingsValue, WifiSavedNetwork } from './types';
import * as TimeService from '../../os/TimeService';

// ── Types ──────────────────────────────────────────────────────────

interface SettingsState extends SettingsConfigState {
  _temp: {
    pagesData: SettingsPagesData | null;
    pagesLoading: boolean;
    pagesError: string | null;
  };
}

interface SettingsActions {
  // ── Pages data ──
  initPagesData: () => void;

  // ── WiFi ──
  addWifiSavedNetwork: (network: WifiSavedNetwork) => void;
  setWifiNetworkAutoJoin: (ssid: string, autoJoin: boolean) => void;
  forgetWifiSavedNetwork: (ssid: string) => void;
  connectWifi: (ssid: string) => void;
}

// ── Initial state ──────────────────────────────────────────────────

const initialState: SettingsState = {
  ...DEFAULT_SETTINGS_STATE,
  _temp: {
    pagesData: null,
    pagesLoading: false,
    pagesError: null,
  },
};

// ── Store ──────────────────────────────────────────────────────────

export const useSettingsStore = createAppStoreWithActions<SettingsState, SettingsActions>(
  'settings',
  initialState,
  (set, get) => ({
    // ── Pages data ──
    initPagesData: () => {
      const { _temp } = get();
      if (_temp.pagesData || _temp.pagesLoading) return;
      set((s) => ({ _temp: { ...s._temp, pagesLoading: true } }));
      loadPages()
        .then((data) => {
          set((s) => ({ _temp: { ...s._temp, pagesData: data, pagesLoading: false } }));
        })
        .catch((e) => {
          set((s) => ({ _temp: { ...s._temp, pagesError: e instanceof Error ? e.message : String(e), pagesLoading: false } }));
        });
    },

    // ── WiFi ──
    addWifiSavedNetwork: (network: WifiSavedNetwork) => {
      const ssid = network.ssid.trim();
      if (!ssid) return;
      set((state) => {
        const existingIdx = state.wifi.savedNetworks.findIndex((n) => n.ssid === ssid);
        const nextList = [...state.wifi.savedNetworks];
        if (existingIdx >= 0) {
          nextList[existingIdx] = { ...nextList[existingIdx], ...network, ssid };
        } else {
          nextList.unshift({ ...network, ssid });
        }
        return { wifi: { ...state.wifi, savedNetworks: nextList } };
      });
    },

    setWifiNetworkAutoJoin: (ssid: string, autoJoin: boolean) => {
      set((state) => {
        const nextList = state.wifi.savedNetworks.map((n) =>
          n.ssid === ssid ? { ...n, autoJoin } : n
        );
        return { wifi: { ...state.wifi, savedNetworks: nextList } };
      });
    },

    forgetWifiSavedNetwork: (ssid: string) => {
      const osConnected = useOsStateStore.getState().hardware.wifi.connectedSsid;
      const wasConnected = osConnected === ssid;
      set((state) => {
        const nextList = state.wifi.savedNetworks.filter((n) => n.ssid !== ssid);
        return { wifi: { ...state.wifi, savedNetworks: nextList } };
      });
      if (wasConnected) {
        ConnectivityManager.disconnectWifi();
      }
    },

    connectWifi: (ssid: string) => {
      const now = TimeService.now();
      set((state) => {
        const nextList = state.wifi.savedNetworks.map((n) =>
          n.ssid === ssid ? { ...n, lastConnectedAt: now } : n
        );
        return { wifi: { ...state.wifi, savedNetworks: nextList } };
      });
      ConnectivityManager.connectToAP(ssid);
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        if (k === '_temp') continue;
        result[k] = v;
      }
      return result as Partial<SettingsState>;
    },
  },
);

// ── Memoized selectors ─────────────────────────────────────────────

type SettingsStore = SettingsState & SettingsActions;

export const selectWifiSavedNetworks = memoSelector(
  (s: SettingsStore) => s.wifi.savedNetworks,
  (networks) => networks,
);

export const selectWifiConnectedSsid = (_s: SettingsStore) => {
  const os = useOsStateStore.getState();
  return os.settings.global.wifiEnabled ? os.hardware.wifi.connectedSsid : undefined;
};

export const selectPagesData = (s: SettingsStore) => s._temp.pagesData;
export const selectPagesLoading = (s: SettingsStore) => s._temp.pagesLoading;
export const selectPagesError = (s: SettingsStore) => s._temp.pagesError;

export function useWifiSavedNetworks() {
  return useSettingsStore(selectWifiSavedNetworks);
}

export function useWifiConnectedSsid() {
  return useSyncExternalStore(
    subscribeOsDataRevision,
    () => {
      const os = useOsStateStore.getState();
      return os.settings.global.wifiEnabled ? os.hardware.wifi.connectedSsid : undefined;
    },
  );
}

export function useWifiActions() {
  const addWifiSavedNetwork = useSettingsStore(s => s.addWifiSavedNetwork);
  const setWifiNetworkAutoJoin = useSettingsStore(s => s.setWifiNetworkAutoJoin);
  const forgetWifiSavedNetwork = useSettingsStore(s => s.forgetWifiSavedNetwork);
  const connectWifi = useSettingsStore(s => s.connectWifi);
  return { addWifiSavedNetwork, setWifiNetworkAutoJoin, forgetWifiSavedNetwork, connectWifi };
}

// ── Generic preference helpers (OS preference routing, not store-based) ──

export function getPreferenceValue(state: SettingsConfigState, key: string): SettingsValue | undefined {
  return state.preferences[key];
}

export function setPreferenceValue(prev: SettingsConfigState, key: string, value: SettingsValue): SettingsConfigState {
  return {
    ...prev,
    preferences: { ...prev.preferences, [key]: value },
  };
}

export function usePreferenceValue<T extends SettingsValue>(
  key: string,
  fallback: T,
): [T, (v: T) => void] {
  const value = useSyncExternalStore(
    subscribeOsDataRevision,
    () => {
      const v = routeGetPreference(key);
      return (v === undefined ? fallback : (v as T));
    },
  );

  const setValue = useCallback((v: T) => {
    routeSetPreference(key, v, { source: 'settings' });
  }, [key]);

  return [value as T, setValue];
}

export function useBooleanPreference(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = usePreferenceValue<boolean>(key, fallback);
  return [Boolean(v), (next) => setV(next)];
}

export function useNumberPreference(key: string, fallback: number): [number, (v: number) => void] {
  const [v, setV] = usePreferenceValue<number>(key, fallback);
  return [Number(v), (next) => setV(next)];
}

export function useStringPreference(key: string, fallback: string): [string, (v: string) => void] {
  const [v, setV] = usePreferenceValue<string>(key, fallback);
  return [String(v), (next) => setV(next)];
}
