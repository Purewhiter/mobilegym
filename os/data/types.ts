export type WifiSecurity = 'OPEN' | 'WPA2' | 'WPA3' | 'WEP';

export type BluetoothDeviceType =
  | 'audio'
  | 'watch'
  | 'phone'
  | 'computer'
  | 'peripheral'
  | 'unknown';

export interface WifiAccessPointPreset {
  ssid: string;
  bssid: string;
  security: WifiSecurity;
  /** 0..4 */
  signalLevel: number;
  /** MHz, e.g. 2437 / 5180 */
  frequency: number;
}

export interface BluetoothDevicePreset {
  name: string;
  mac: string;
  type: BluetoothDeviceType;
  paired: boolean;
  connected: boolean;
  pairable?: boolean;
  /** 0..100 */
  batteryLevel?: number;
}

export interface DeviceInfoPreset {
  brand: string;
  marketName: string;
  model: string;
  manufacturer: string;

  processor: string;
  cpuCores: number;
  cpuMaxFreq: string;
  gpu: string;

  ramTotal: string;
  storageTotal: string;

  screenSize: string;
  screenResolution: string;
  screenDensity: number;
  refreshRate: number;
  hdrSupport: boolean;

  rearCamera: string;
  frontCamera: string;

  batteryCapacity: string;
  chargingSpeed: string;

  androidVersion: string;
  hyperOSVersion: string;
  securityPatch: string;
  buildNumber: string;
  kernelVersion: string;
  basebandVersion: string;

  imei1: string;
  imei2: string;
  serialNumber: string;
  macAddress: string;
  bluetoothMac: string;
}

export interface SimInfoPreset {
  slot: 1 | 2;
  carrier: string;
  phoneNumber: string;
  iccid: string;
  networkType: string;
  dataRoaming: boolean;
  voLTE: boolean;
}

export interface DeviceNetworkExtraPreset {
  sims: SimInfoPreset[];
  defaultDataSim: 1 | 2;
  wifiConnectedSsid?: string;
  wifiIpAddress?: string;
  wifiMacAddress?: string;
  wifiLinkSpeed?: number;
  wifiFrequency?: number;
  bluetoothName: string;
  hotspotEnabled: boolean;
  hotspotSsid: string;
  hotspotPassword: string;
  vpnEnabled: boolean;
}

export interface DeviceBatteryExtraPreset {
  chargingType?: 'usb' | 'ac' | 'wireless';
  temperature: number;
  voltage: number;
  health: 'good' | 'overheat' | 'dead' | 'cold';
  technology: string;
  cycleCount: number;
  estimatedRemaining: string;
}

export interface DeviceSettingsPreset {
  /** 0..100 */
  brightness: number;
  /** 0..100 */
  mediaVolume: number;
  /** 0..100 (用于计算 fontScale) */
  fontSizePct: number;
  /** 0..100 (用于计算 displayScale) */
  displaySizePct: number;
  /** 0..100 */
  eyeComfortLevel: number;
}
