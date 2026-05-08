import type { PermissionStatus } from './permissions';
import { OS_DEFAULTS } from './data';
import type {
  BluetoothDevicePreset,
  DeviceBatteryExtraPreset,
  DeviceSettingsPreset,
  SimInfoPreset,
  WifiAccessPointPreset,
} from './data/types';
import { createOsStore } from './createOsStore';

export interface OsSystemSettings extends DeviceSettingsPreset {}

export interface OsGlobalSettings {
  wifiEnabled: boolean;
  mobileDataEnabled: boolean;
  bluetoothEnabled: boolean;
  airplaneModeEnabled: boolean;
  doNotDisturbEnabled: boolean;
  silentMode: boolean;
  flashlightEnabled: boolean;
  batterySaverEnabled: boolean;
  rotationLocked: boolean;
  locationEnabled: boolean;
  nfcEnabled: boolean;
  screenCastEnabled: boolean;
  autoBrightnessEnabled: boolean;
  eyeComfortEnabled: boolean;
  darkModeEnabled: boolean;
  language: string;
}

export interface OsBatteryState extends DeviceBatteryExtraPreset {
  percent: number;
  charging: boolean;
  fastCharging: boolean;
}

export interface OsCellularState {
  signalLevel: number;
  mobileDataType: string;
  noSim: boolean;
}

export interface OsWifiState {
  level: number;
  connectedSsid?: string;
  ipAddress?: string;
  macAddress?: string;
  linkSpeed?: number;
  frequency?: number;
}

export interface OsBluetoothState {
  name: string;
}

export interface OsStorageState {
  used: string;
}

export interface OsHotspotState {
  enabled: boolean;
  ssid: string;
  password: string;
}

export interface OsHardwareState {
  battery: OsBatteryState;
  cellular: OsCellularState;
  wifi: OsWifiState;
  bluetooth: OsBluetoothState;
  storage: OsStorageState;
  hotspot: OsHotspotState;
  vpnEnabled: boolean;
  headsetConnected: boolean;
  alarmSet: boolean;
  nearbyWifi: WifiAccessPointPreset[];
  nearbyBluetooth: BluetoothDevicePreset[];
}

export interface OsTelephonyState {
  sims: SimInfoPreset[];
  defaultDataSim: 1 | 2;
}

export interface OsState {
  settings: {
    system: OsSystemSettings;
    global: OsGlobalSettings;
  };
  hardware: OsHardwareState;
  permissions: Record<string, Record<string, PermissionStatus>>;
  preferences: Record<string, string | number | boolean | null>;
}

function createDefaultOsState(): OsState {
  return {
    settings: {
      system: structuredClone(OS_DEFAULTS.settings.system) as OsSystemSettings,
      global: structuredClone(OS_DEFAULTS.settings.global) as OsGlobalSettings,
    },
    hardware: structuredClone(OS_DEFAULTS.hardware) as OsHardwareState,
    permissions: {},
    preferences: {},
  };
}

export const defaultOsState = createDefaultOsState();

export const useOsStateStore = createOsStore<OsState>(
  'osState',
  defaultOsState,
  {
    persistName: 'os_state',
    registerToServiceRegistry: false,
  },
);

export const OsStateStore = {
  getState: useOsStateStore.getState,
  setState: useOsStateStore.setState,
  subscribe: useOsStateStore.subscribe,
  reset: () => useOsStateStore.setState(createDefaultOsState(), true),
};

export function mutateOsState(recipe: (state: OsState) => void): void {
  (useOsStateStore.setState as any)(recipe);
}

export const OS_TELEPHONY_DEFAULTS = OS_DEFAULTS.telephony as OsTelephonyState;
