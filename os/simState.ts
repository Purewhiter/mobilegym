import { getAllAppStates } from './AppStateRegistry';
import type { AppId } from './types';
import type { OSNotificationSnapshot, SystemShadeSnapshot } from './types';
import { mutateOsState, useOsStateStore } from './OsStateStore';
import { snapshotOsStores, snapshotProviders, patchProviders } from './createOsStore';
import ContentResolver from './ContentResolver';
import { BatteryManager } from './managers/BatteryManager';
import { ConnectivityManager } from './managers/ConnectivityManager';
import { AudioManager } from './managers/AudioManager';
import { DisplayManager } from './managers/DisplayManager';
import { snapshotFileSystem } from './FileSystemService';
import {
  routeSetPreference,
  subscribePreferenceChanges,
  getEffectiveBuildInfo,
  getEffectiveTelephony,
  setBuildOverrides,
  setTelephonyOverrides,
  type DeviceSetOptions,
  type DeviceSettingValue,
} from './managers/registry';

type RuntimeSnapshot = {
  tasks: unknown[];
  activeTaskId: string | null;
  isLauncherVisible: boolean;
  isRecentsVisible: boolean;
  runningApps: AppId[];
  activeAppId: AppId | null;
  locale: string;
  time: Record<string, unknown>;
  location: Record<string, unknown>;
  installedApps: Array<{ id: string; name: string; type: string }>;
  clipboard: unknown;
  notifications: OSNotificationSnapshot;
  shade: SystemShadeSnapshot;
  launcher: unknown;
};

const EXCLUDED_SERVICE_KEYS = new Set([
  'notifications',
  'clipboard',
]);

const ARRAY_MATCH_RE = /^(\w+)\[(\w+)=(.+)\]$/;
const ARRAY_PUSH_RE = /^(\w+)\[\]$/;

function mergeIntoDraft(target: any, source: any): void {
  if (!source || typeof source !== 'object') return;
  Object.entries(source).forEach(([key, value]) => {
    // arr[field=value] — update or delete matched array elements
    const matchM = key.match(ARRAY_MATCH_RE);
    if (matchM) {
      const [, arrKey, matchField, matchVal] = matchM;
      const arr = target[arrKey];
      if (Array.isArray(arr)) {
        if (value === null || value === undefined) {
          target[arrKey] = arr.filter(
            (item: any) => !(item && typeof item === 'object' && String(item[matchField]) === matchVal)
          );
        } else {
          target[arrKey] = arr.map((item: any) => {
            if (item && typeof item === 'object' && String(item[matchField]) === matchVal) {
              const patched = { ...item };
              mergeIntoDraft(patched, value);
              return patched;
            }
            return item;
          });
        }
      }
      return;
    }

    // arr[] — append element(s)
    const pushM = key.match(ARRAY_PUSH_RE);
    if (pushM) {
      const arrKey = pushM[1];
      const existing = Array.isArray(target[arrKey]) ? target[arrKey] : [];
      target[arrKey] = Array.isArray(value) ? [...existing, ...value] : [...existing, value];
      return;
    }

    if (Array.isArray(value)) {
      target[key] = structuredClone(value);
      return;
    }
    if (value && typeof value === 'object') {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      mergeIntoDraft(target[key], value);
      return;
    }
    target[key] = value;
  });
}

let osDataRevision = 0;
const osDataListeners = new Set<() => void>();

function bumpOsDataRevision(): void {
  osDataRevision += 1;
  osDataListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[simState] os data listener failed', error);
    }
  });
}

useOsStateStore.subscribe(() => {
  bumpOsDataRevision();
});

subscribePreferenceChanges(() => {
  bumpOsDataRevision();
});

export function getOsDataRevision(): number {
  return osDataRevision;
}

export function subscribeOsDataRevision(listener: () => void): () => void {
  osDataListeners.add(listener);
  return () => {
    osDataListeners.delete(listener);
  };
}

function snapshotRuntimeServices(): Record<string, unknown> {
  const all = snapshotOsStores();
  const result: Record<string, unknown> = {};
  Object.entries(all).forEach(([key, value]) => {
    if (EXCLUDED_SERVICE_KEYS.has(key)) return;
    result[key] = value;
  });
  return result;
}

// Fields in settings.global that have constraint / side-effect logic in Managers
const MANAGED_GLOBAL_KEYS = new Set([
  'airplaneModeEnabled', 'wifiEnabled', 'mobileDataEnabled', 'bluetoothEnabled',
  'doNotDisturbEnabled', 'silentMode',
]);

// Fields in settings.system that must go through Manager for clamp / callback
const MANAGED_SYSTEM_KEYS = new Set([
  'brightness', 'mediaVolume', 'fontSizePct', 'displaySizePct', 'eyeComfortLevel',
]);

const MANAGED_BATTERY_KEYS = new Set(['percent', 'charging', 'fastCharging']);
const MANAGED_HW_TOP_KEYS = new Set(['battery', 'nearbyWifi', 'nearbyBluetooth', 'vpnEnabled', 'hotspot']);

function filterOutKeys(obj: Record<string, any>, exclude: Set<string>): Record<string, any> | null {
  const result: Record<string, any> = {};
  let has = false;
  for (const key of Object.keys(obj)) {
    if (!exclude.has(key)) { result[key] = obj[key]; has = true; }
  }
  return has ? result : null;
}

function applySettingsPatch(patch: Record<string, any>, options?: DeviceSetOptions): void {
  const globalPatch = patch.global;
  const systemPatch = patch.system;

  if (globalPatch && typeof globalPatch === 'object') {
    // Airplane mode first — cascades WiFi / BT / cellular off
    if (typeof globalPatch.airplaneModeEnabled === 'boolean') ConnectivityManager.setAirplaneModeEnabled(globalPatch.airplaneModeEnabled);
    if (typeof globalPatch.wifiEnabled === 'boolean') ConnectivityManager.setWifiEnabled(globalPatch.wifiEnabled);
    if (typeof globalPatch.mobileDataEnabled === 'boolean') ConnectivityManager.setMobileDataEnabled(globalPatch.mobileDataEnabled);
    if (typeof globalPatch.bluetoothEnabled === 'boolean') ConnectivityManager.setBluetoothEnabled(globalPatch.bluetoothEnabled);
    // DND first — syncs silentMode
    if (typeof globalPatch.doNotDisturbEnabled === 'boolean') AudioManager.setDoNotDisturbEnabled(globalPatch.doNotDisturbEnabled);
    if (typeof globalPatch.silentMode === 'boolean') AudioManager.setSilentMode(globalPatch.silentMode);

    const rest = filterOutKeys(globalPatch, MANAGED_GLOBAL_KEYS);
    if (rest) mutateOsState((s) => { mergeIntoDraft(s.settings.global, rest); });
  }

  if (systemPatch && typeof systemPatch === 'object') {
    if (typeof systemPatch.brightness === 'number') DisplayManager.setBrightness(systemPatch.brightness, options);
    if (typeof systemPatch.mediaVolume === 'number') AudioManager.setMediaVolume(systemPatch.mediaVolume, options);
    if (typeof systemPatch.fontSizePct === 'number') DisplayManager.setFontSizePct(systemPatch.fontSizePct);
    if (typeof systemPatch.displaySizePct === 'number') DisplayManager.setDisplaySizePct(systemPatch.displaySizePct);
    if (typeof systemPatch.eyeComfortLevel === 'number') DisplayManager.setEyeComfortLevel(systemPatch.eyeComfortLevel);

    const rest = filterOutKeys(systemPatch, MANAGED_SYSTEM_KEYS);
    if (rest) mutateOsState((s) => { mergeIntoDraft(s.settings.system, rest); });
  }
}

function applyHardwarePatch(patch: Record<string, any>): void {
  const bat = patch.battery;
  if (bat && typeof bat === 'object') {
    if (typeof bat.percent === 'number') BatteryManager.setBatteryPercent(bat.percent);
    if (typeof bat.charging === 'boolean' || typeof bat.fastCharging === 'boolean') {
      BatteryManager.setChargingStatus(
        typeof bat.charging === 'boolean' ? bat.charging : useOsStateStore.getState().hardware.battery.charging,
        typeof bat.fastCharging === 'boolean' ? bat.fastCharging : undefined,
      );
    }
    const batRest = filterOutKeys(bat, MANAGED_BATTERY_KEYS);
    if (batRest) mutateOsState((s) => { mergeIntoDraft(s.hardware.battery, batRest); });
  }

  if (Array.isArray(patch.nearbyWifi)) ConnectivityManager.setNearbyWifi(patch.nearbyWifi);
  if (Array.isArray(patch.nearbyBluetooth)) ConnectivityManager.setNearbyBluetooth(patch.nearbyBluetooth);
  if (typeof patch.vpnEnabled === 'boolean') ConnectivityManager.setVpnEnabled(patch.vpnEnabled);

  const hotspot = patch.hotspot;
  if (hotspot && typeof hotspot === 'object') {
    if (typeof hotspot.enabled === 'boolean') ConnectivityManager.setHotspotEnabled(hotspot.enabled);
    const hsRest = filterOutKeys(hotspot, new Set(['enabled']));
    if (hsRest) mutateOsState((s) => { mergeIntoDraft(s.hardware.hotspot, hsRest); });
  }

  const hwRest = filterOutKeys(patch, MANAGED_HW_TOP_KEYS);
  if (hwRest) mutateOsState((s) => { mergeIntoDraft(s.hardware, hwRest); });
}

export function applyOsStatePatch(osPatch: Record<string, any>, options?: DeviceSetOptions): void {
  if (!osPatch || typeof osPatch !== 'object') return;
  if (osPatch.build && typeof osPatch.build === 'object') {
    setBuildOverrides(osPatch.build);
  }
  if (osPatch.telephony && typeof osPatch.telephony === 'object') {
    setTelephonyOverrides(osPatch.telephony);
  }
  if (osPatch.settings && typeof osPatch.settings === 'object') {
    applySettingsPatch(osPatch.settings, options);
  }
  if (osPatch.hardware && typeof osPatch.hardware === 'object') {
    applyHardwarePatch(osPatch.hardware);
  }
  if (osPatch.permissions && typeof osPatch.permissions === 'object') {
    mutateOsState((state) => {
      mergeIntoDraft(state.permissions, osPatch.permissions);
    });
  }
  if (osPatch.preferences && typeof osPatch.preferences === 'object') {
    Object.entries(osPatch.preferences).forEach(([key, value]) => {
      routeSetPreference(key, value as DeviceSettingValue, options);
    });
  }
  if (osPatch.providers && typeof osPatch.providers === 'object') {
    const patchedNames = patchProviders(osPatch.providers as Record<string, any>, true);
    for (const name of patchedNames) {
      try { ContentResolver.notifyChange(`content://${name}`); } catch { /* noop */ }
    }
  }
}

export function buildSimState(runtime: RuntimeSnapshot): { os: Record<string, unknown>; apps: Record<string, unknown> } {
  const osState = useOsStateStore.getState();
  return {
    os: {
      // Task runtime
      tasks: runtime.tasks,
      activeTaskId: runtime.activeTaskId,
      isLauncherVisible: runtime.isLauncherVisible,
      isRecentsVisible: runtime.isRecentsVisible,
      runningApps: runtime.runningApps,
      activeAppId: runtime.activeAppId,

      // Runtime singletons
      locale: runtime.locale,
      time: runtime.time,
      location: runtime.location,
      installedApps: runtime.installedApps,
      clipboard: runtime.clipboard,
      notifications: runtime.notifications,
      shade: runtime.shade,
      launcher: runtime.launcher,

      // Android data model (OsStateStore: settings/hardware/permissions/preferences)
      settings: osState.settings,
      hardware: osState.hardware,
      permissions: osState.permissions,
      preferences: osState.preferences,
      build: getEffectiveBuildInfo(),
      telephony: getEffectiveTelephony(),

      // Layer B services + providers
      services: snapshotRuntimeServices(),
      providers: snapshotProviders(),
      fileSystem: snapshotFileSystem(),
    },
    apps: getAllAppStates(),
  };
}
