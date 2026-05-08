import BroadcastBus, { ACTION_CONNECTIVITY_CHANGE } from '../BroadcastBus';
import type { MobileDataType } from '../StatusBarService';
import { mutateOsState, useOsStateStore } from '../OsStateStore';
import type { BluetoothDevicePreset, SimInfoPreset, WifiAccessPointPreset } from '../data/types';
import {
  getEffectiveBuildInfo,
  getEffectiveTelephony,
  registerManager,
  type DeviceSetOptions,
  type DeviceSettingValue,
  type ManagerWithPreferences,
} from './registry';

const CONNECTIVITY_PREFERENCE_KEYS = [
  'wifi_enabled',
  'mobile_data_enabled',
  'bluetooth_enabled',
  'airplane_mode_enabled',
  'hotspot_enabled',
  'vpn_enabled',
  'wifi_ip_address',
  'device_name',
  'network_type',
  'signal_strength',
  'latest_area_info',
  'service_state',
  'data_state',
] as const;

let lastConnectivitySignature: string | null = null;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const next = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(Math.round(next), min), max);
}

function clampString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const next = value.trim();
  return next || fallback;
}

function getDefaultSim(): SimInfoPreset | undefined {
  const telephony = getEffectiveTelephony();
  const slot = telephony.defaultDataSim === 2 ? 2 : 1;
  return telephony.sims.find((sim) => sim.slot === slot) ?? telephony.sims[0];
}

function emitConnectivityChange(): void {
  const state = useOsStateStore.getState();
  const extras = {
    wifiEnabled: state.settings.global.wifiEnabled,
    mobileDataEnabled: state.settings.global.mobileDataEnabled,
    airplaneModeEnabled: state.settings.global.airplaneModeEnabled,
    wifiConnectedSsid: state.settings.global.wifiEnabled ? state.hardware.wifi.connectedSsid : undefined,
    wifiSignalLevel: state.hardware.wifi.level,
    signalLevel: state.hardware.cellular.signalLevel,
    mobileDataType: state.hardware.cellular.mobileDataType,
  };
  const signature = JSON.stringify(extras);
  if (signature === lastConnectivitySignature) return;
  lastConnectivitySignature = signature;
  BroadcastBus.sendBroadcast({
    action: ACTION_CONNECTIVITY_CHANGE,
    extras,
  });
}

function ensureWifiPasswords(list: WifiAccessPointPreset[]): void {
  mutateOsState((state) => {
    let changed = false;
    list.forEach((ap) => {
      if (!ap || ap.security === 'OPEN') return;
      const ssid = clampString(ap.ssid, '');
      if (!ssid) return;
      const key = `wifi_password__${ssid}`;
      if (typeof state.preferences[key] === 'string' && state.preferences[key]) return;
      state.preferences[key] = '12345678';
      changed = true;
    });
    if (!changed) return;
  });
}

function setWifiEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.settings.global.wifiEnabled = enabled;
    if (!enabled) {
      state.hardware.wifi.level = 0;
    } else if (state.hardware.wifi.connectedSsid) {
      const ap = state.hardware.nearbyWifi.find((item) => item.ssid === state.hardware.wifi.connectedSsid);
      if (ap) {
        state.hardware.wifi.level = clampInt(ap.signalLevel, 0, 4, state.hardware.wifi.level || 4);
      }
    }
  });
  emitConnectivityChange();
}

function setMobileDataEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.settings.global.mobileDataEnabled = enabled;
    if (!enabled && state.hardware.cellular.signalLevel > 0) {
      state.hardware.cellular.mobileDataType = 'none';
    }
  });
  emitConnectivityChange();
}

function setBluetoothEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.settings.global.bluetoothEnabled = enabled;
  });
  emitConnectivityChange();
}

function setAirplaneModeEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.settings.global.airplaneModeEnabled = enabled;
    if (enabled) {
      state.settings.global.wifiEnabled = false;
      state.settings.global.bluetoothEnabled = false;
      state.settings.global.mobileDataEnabled = false;
      state.hardware.wifi.level = 0;
      state.hardware.cellular.signalLevel = 0;
      state.hardware.cellular.mobileDataType = 'none';
    }
  });
  emitConnectivityChange();
}

function setHotspotEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.hardware.hotspot.enabled = enabled;
  });
  emitConnectivityChange();
}

function setVpnEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.hardware.vpnEnabled = enabled;
  });
}

function setWifiIpAddress(value: string): void {
  mutateOsState((state) => {
    state.hardware.wifi.ipAddress = value || undefined;
  });
}

function setDeviceName(value: string): void {
  mutateOsState((state) => {
    state.hardware.bluetooth.name = value || getEffectiveBuildInfo().marketName;
  });
}

function setNearbyWifi(list: WifiAccessPointPreset[]): void {
  if (!Array.isArray(list)) return;
  mutateOsState((state) => {
    state.hardware.nearbyWifi = list.map((item) => ({ ...item }));
    const connected = state.hardware.wifi.connectedSsid;
    if (connected) {
      const ap = list.find((item) => item.ssid === connected);
      if (ap) {
        state.hardware.wifi.level = clampInt(ap.signalLevel, 0, 4, state.hardware.wifi.level || 4);
        state.hardware.wifi.frequency = ap.frequency;
      }
    }
  });
  ensureWifiPasswords(list);
  emitConnectivityChange();
}

function setNearbyBluetooth(list: BluetoothDevicePreset[]): void {
  if (!Array.isArray(list)) return;
  mutateOsState((state) => {
    state.hardware.nearbyBluetooth = list.map((item) => ({ ...item }));
  });
}

function connectToAP(ssid: string): void {
  const nextSsid = clampString(ssid, '');
  if (!nextSsid) return;
  mutateOsState((state) => {
    const ap = state.hardware.nearbyWifi.find((item) => item.ssid === nextSsid);
    state.settings.global.wifiEnabled = true;
    state.hardware.wifi.connectedSsid = nextSsid;
    state.hardware.wifi.level = clampInt(ap?.signalLevel, 0, 4, ap ? ap.signalLevel : 4);
    state.hardware.wifi.frequency = ap?.frequency ?? state.hardware.wifi.frequency;
    state.hardware.wifi.linkSpeed = state.hardware.wifi.linkSpeed ?? 866;
    state.hardware.wifi.ipAddress = state.hardware.wifi.ipAddress ?? '192.168.31.105';
  });
  emitConnectivityChange();
}

function disconnectWifi(): void {
  mutateOsState((state) => {
    state.hardware.wifi.connectedSsid = undefined;
    state.hardware.wifi.level = 0;
  });
  emitConnectivityChange();
}

function connectBluetooth(mac: string): boolean {
  const targetMac = clampString(mac, '');
  if (!targetMac) return false;
  let pairable = true;
  mutateOsState((state) => {
    state.settings.global.bluetoothEnabled = true;
    state.hardware.nearbyBluetooth = state.hardware.nearbyBluetooth.map((device) => {
      if (device.mac !== targetMac) return device;
      if (device.pairable === false) {
        pairable = false;
        return device;
      }
      return { ...device, paired: true, connected: true };
    });
  });
  if (!pairable) {
    return false;
  }
  emitConnectivityChange();
  return true;
}

function disconnectBluetooth(mac: string): void {
  const targetMac = clampString(mac, '');
  if (!targetMac) return;
  mutateOsState((state) => {
    state.hardware.nearbyBluetooth = state.hardware.nearbyBluetooth.map((device) =>
      device.mac === targetMac ? { ...device, connected: false } : device
    );
  });
}

export const ConnectivityManager: ManagerWithPreferences & {
  setWifiEnabled: typeof setWifiEnabled;
  setMobileDataEnabled: typeof setMobileDataEnabled;
  setBluetoothEnabled: typeof setBluetoothEnabled;
  setAirplaneModeEnabled: typeof setAirplaneModeEnabled;
  setHotspotEnabled: typeof setHotspotEnabled;
  setVpnEnabled: typeof setVpnEnabled;
  setWifiIpAddress: typeof setWifiIpAddress;
  setDeviceName: typeof setDeviceName;
  setNearbyWifi: typeof setNearbyWifi;
  setNearbyBluetooth: typeof setNearbyBluetooth;
  connectToAP: typeof connectToAP;
  disconnectWifi: typeof disconnectWifi;
  connectBluetooth: typeof connectBluetooth;
  disconnectBluetooth: typeof disconnectBluetooth;
} = {
  getPreference(key: string): DeviceSettingValue | undefined {
    const state = useOsStateStore.getState();
    const sim = getDefaultSim();
    switch (key) {
      case 'wifi_enabled':
        return state.settings.global.wifiEnabled;
      case 'mobile_data_enabled':
        return state.settings.global.mobileDataEnabled;
      case 'bluetooth_enabled':
        return state.settings.global.bluetoothEnabled;
      case 'airplane_mode_enabled':
        return state.settings.global.airplaneModeEnabled;
      case 'hotspot_enabled':
        return state.hardware.hotspot.enabled;
      case 'vpn_enabled':
        return state.hardware.vpnEnabled;
      case 'wifi_ip_address':
        return state.hardware.wifi.ipAddress || '未连接';
      case 'device_name':
        return state.hardware.bluetooth.name || getEffectiveBuildInfo().marketName;
      case 'network_type':
        return sim?.networkType || String(state.hardware.cellular.mobileDataType || '').toUpperCase() || '未知';
      case 'signal_strength': {
        if (state.settings.global.airplaneModeEnabled) return '飞行模式';
        if (state.hardware.cellular.noSim) return '无服务';
        const level = clampInt(state.hardware.cellular.signalLevel, 0, 5, 0);
        const dbm = -113 + level * 10;
        return `${dbm} dBm`;
      }
      case 'latest_area_info':
        return sim ? `${sim.carrier || '未知运营商'} / ${sim.networkType || ''}`.trim() : '无 SIM';
      case 'service_state':
        if (state.settings.global.airplaneModeEnabled) return '飞行模式';
        if (state.hardware.cellular.noSim) return '无服务';
        return '已注册';
      case 'data_state':
        if (state.settings.global.airplaneModeEnabled) return '飞行模式';
        if (state.hardware.cellular.noSim) return '无 SIM';
        return state.settings.global.mobileDataEnabled ? '已连接' : '已断开';
      default:
        return undefined;
    }
  },

  setPreference(key: string, value: DeviceSettingValue, _options?: DeviceSetOptions): void {
    switch (key) {
      case 'wifi_enabled':
        setWifiEnabled(Boolean(value));
        return;
      case 'mobile_data_enabled':
        setMobileDataEnabled(Boolean(value));
        return;
      case 'bluetooth_enabled':
        setBluetoothEnabled(Boolean(value));
        return;
      case 'airplane_mode_enabled':
        setAirplaneModeEnabled(Boolean(value));
        return;
      case 'hotspot_enabled':
        setHotspotEnabled(Boolean(value));
        return;
      case 'vpn_enabled':
        setVpnEnabled(Boolean(value));
        return;
      case 'wifi_ip_address':
        setWifiIpAddress(String(value ?? '').trim());
        return;
      case 'device_name':
        setDeviceName(String(value ?? '').trim());
        return;
      default:
        return;
    }
  },

  setWifiEnabled,
  setMobileDataEnabled,
  setBluetoothEnabled,
  setAirplaneModeEnabled,
  setHotspotEnabled,
  setVpnEnabled,
  setWifiIpAddress,
  setDeviceName,
  setNearbyWifi,
  setNearbyBluetooth,
  connectToAP,
  disconnectWifi,
  connectBluetooth,
  disconnectBluetooth,
};

registerManager(CONNECTIVITY_PREFERENCE_KEYS, ConnectivityManager);

ensureWifiPasswords(useOsStateStore.getState().hardware.nearbyWifi);
