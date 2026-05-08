import type { QuickSettingsState } from './types';
import { shallow } from 'zustand/shallow';
import BroadcastBus, { ACTION_QUICK_SETTING_CHANGED } from './BroadcastBus';
import { memoSelector } from './createAppStore';
import { OS_DEFAULTS } from './data';
import { AudioManager } from './managers/AudioManager';
import { BatteryManager } from './managers/BatteryManager';
import { ConnectivityManager } from './managers/ConnectivityManager';
import { DisplayManager } from './managers/DisplayManager';
import { mutateOsState, OsStateStore, useOsStateStore } from './OsStateStore';

const defaultState: QuickSettingsState = { ...OS_DEFAULTS.settings.global } as QuickSettingsState;

const selectQuickSettings = memoSelector(
  (state: ReturnType<typeof OsStateStore.getState>) => ({
    wifiEnabled: state.settings.global.wifiEnabled,
    mobileDataEnabled: state.settings.global.mobileDataEnabled,
    bluetoothEnabled: state.settings.global.bluetoothEnabled,
    airplaneModeEnabled: state.settings.global.airplaneModeEnabled,
    doNotDisturbEnabled: state.settings.global.doNotDisturbEnabled,
    flashlightEnabled: state.settings.global.flashlightEnabled,
    batterySaverEnabled: state.settings.global.batterySaverEnabled,
    rotationLocked: state.settings.global.rotationLocked,
    locationEnabled: state.settings.global.locationEnabled,
    nfcEnabled: state.settings.global.nfcEnabled,
    screenCastEnabled: state.settings.global.screenCastEnabled,
    autoBrightnessEnabled: state.settings.global.autoBrightnessEnabled,
    eyeComfortEnabled: state.settings.global.eyeComfortEnabled,
    darkModeEnabled: state.settings.global.darkModeEnabled,
  }),
  (input) => input as QuickSettingsState,
);

function broadcastChanged(prev: QuickSettingsState, next: QuickSettingsState) {
  (Object.keys(defaultState) as Array<keyof QuickSettingsState>).forEach((key) => {
    if (prev[key] === next[key]) return;
    BroadcastBus.sendBroadcast({
      action: ACTION_QUICK_SETTING_CHANGED,
      extras: { key, value: next[key] },
    });
  });
}

function applyManagedQuickSetting<K extends keyof QuickSettingsState>(key: K, value: boolean): boolean {
  switch (key) {
    case 'wifiEnabled':
      ConnectivityManager.setWifiEnabled(value);
      return true;
    case 'mobileDataEnabled':
      ConnectivityManager.setMobileDataEnabled(value);
      return true;
    case 'bluetoothEnabled':
      ConnectivityManager.setBluetoothEnabled(value);
      return true;
    case 'airplaneModeEnabled':
      ConnectivityManager.setAirplaneModeEnabled(value);
      return true;
    case 'doNotDisturbEnabled':
      AudioManager.setDoNotDisturbEnabled(value);
      return true;
    case 'batterySaverEnabled':
      BatteryManager.setBatterySaverEnabled(value);
      return true;
    case 'autoBrightnessEnabled':
      DisplayManager.setAutoBrightnessEnabled(value);
      return true;
    case 'eyeComfortEnabled':
      DisplayManager.setEyeComfortEnabled(value);
      return true;
    case 'darkModeEnabled':
      DisplayManager.setDarkModeEnabled(value);
      return true;
    default:
      return false;
  }
}

export const QuickSettingsService = {
  getState(): QuickSettingsState {
    return selectQuickSettings(OsStateStore.getState());
  },

  subscribe(listener: (state: QuickSettingsState) => void): () => void {
    return (useOsStateStore.subscribe as any)(selectQuickSettings, listener, {
      equalityFn: shallow,
      fireImmediately: true,
    });
  },

  set(patch: Partial<QuickSettingsState>): void {
    if (!patch || typeof patch !== 'object') return;
    const prev = this.getState();
    const next: QuickSettingsState = { ...prev };
    let changed = false;
    (Object.keys(defaultState) as Array<keyof QuickSettingsState>).forEach((key) => {
      const v = (patch as any)[key];
      if (typeof v === 'boolean' && v !== next[key]) {
        next[key] = v;
        changed = true;
      }
    });
    if (!changed) return;
    (Object.keys(defaultState) as Array<keyof QuickSettingsState>).forEach((key) => {
      if (prev[key] === next[key]) return;
      if (applyManagedQuickSetting(key, next[key])) return;
      mutateOsState((state) => {
        state.settings.global[key] = next[key];
      });
    });
    broadcastChanged(prev, next);
  },

  toggle<K extends keyof QuickSettingsState>(key: K): void {
    const prev = this.getState();
    const next = { ...prev, [key]: !prev[key] } as QuickSettingsState;
    if (applyManagedQuickSetting(key, next[key])) {
      broadcastChanged(prev, next);
      return;
    }
    mutateOsState((state) => {
      state.settings.global[key] = next[key];
    });
    broadcastChanged(prev, next);
  },

  reset(): void {
    const prev = this.getState();
    mutateOsState((state) => {
      (Object.keys(defaultState) as Array<keyof QuickSettingsState>).forEach((key) => {
        state.settings.global[key] = defaultState[key];
      });
    });
    const next = this.getState();
    broadcastChanged(prev, next);
  },
};

export function useQuickSettings(): QuickSettingsState {
  return useOsStateStore(selectQuickSettings);
}

export function useQSWifiEnabled(): boolean {
  return useOsStateStore((state) => state.settings.global.wifiEnabled);
}

export default QuickSettingsService;
