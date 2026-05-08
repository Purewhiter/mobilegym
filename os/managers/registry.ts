import * as TimeService from '../TimeService';
import { OS_DEFAULTS } from '../data';
import type { DeviceInfoPreset, SimInfoPreset } from '../data/types';
import { mutateOsState, useOsStateStore } from '../OsStateStore';
import { getLocale, setLocale, type Locale } from '../locale';

export type DeviceSettingValue = string | number | boolean | null;
export type DeviceSetOptions = { source?: 'os' | 'settings' | 'device' | 'external' };

export interface ManagerWithPreferences {
  getPreference(key: string): DeviceSettingValue | undefined;
  setPreference(key: string, value: DeviceSettingValue, options?: DeviceSetOptions): void;
}

type ChangeListener = () => void;
type BuildOverrides = Partial<DeviceInfoPreset>;
type TelephonyOverrides = Partial<{
  sims: SimInfoPreset[];
  defaultDataSim: 1 | 2;
}>;

const keyToManager = new Map<string, ManagerWithPreferences>();
const changeListeners = new Set<ChangeListener>();
const bootAtMs = TimeService.now();

const SCENARIO_OVERRIDES_KEY = '__os_scenario_overrides__';

interface ScenarioOverrides {
  build?: BuildOverrides;
  telephony?: TelephonyOverrides;
}

function loadPersistedJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore corrupt data */ }
  return fallback;
}

function persistScenarioOverrides(): void {
  try {
    const payload: ScenarioOverrides = {};
    if (Object.keys(buildOverrides).length > 0) payload.build = buildOverrides;
    if (Object.keys(telephonyOverrides).length > 0) payload.telephony = telephonyOverrides;
    if (Object.keys(payload).length > 0) {
      localStorage.setItem(SCENARIO_OVERRIDES_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(SCENARIO_OVERRIDES_KEY);
    }
  } catch { /* ignore quota errors */ }
}

function loadScenarioOverrides(): ScenarioOverrides {
  return loadPersistedJson<ScenarioOverrides>(SCENARIO_OVERRIDES_KEY, {});
}

const _loaded = loadScenarioOverrides();
let buildOverrides: BuildOverrides = _loaded.build ?? {};
let telephonyOverrides: TelephonyOverrides = _loaded.telephony ?? {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clampString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const next = value.trim();
  return next || fallback;
}

function getDefaultBrandedAccountName(): string {
  return getLocale() === 'en' ? 'Xiaomi User' : '小米用户';
}

function formatUptime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
}

function cloneSims(list: SimInfoPreset[]): SimInfoPreset[] {
  return list.map((sim) => ({ ...sim }));
}

function emitChange(): void {
  changeListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[PreferenceRegistry] listener failed', error);
    }
  });
}

function normalizeBuildOverrideValue<K extends keyof DeviceInfoPreset>(
  key: K,
  value: DeviceSettingValue,
): DeviceInfoPreset[K] | undefined {
  if (value == null) return undefined;
  if (key === 'cpuCores' || key === 'screenDensity' || key === 'refreshRate') {
    const next = Number(value);
    return (Number.isFinite(next) ? next : undefined) as DeviceInfoPreset[K];
  }
  if (key === 'hdrSupport') {
    return Boolean(value) as DeviceInfoPreset[K];
  }
  return String(value) as DeviceInfoPreset[K];
}

export function normalizePreferenceKey(key: string): string {
  const k = String(key ?? '').trim();
  if (!k) return '';

  if (k === '@string/preference_key_brightness_level') return 'brightness';
  if (k === '@string/preference_key_auto_brightness') return 'auto_brightness';

  if (k === 'wifi_enable') return 'wifi_enabled';
  if (k === 'bluetooth_enable') return 'bluetooth_enabled';
  if (k === 'mobile_data_enable') return 'mobile_data_enabled';
  if (k === 'airplane_mode') return 'airplane_mode_enabled';
  if (k === 'enable_wifi_ap' || k === 'wifi_hotspot_enable') return 'hotspot_enabled';
  if (k === 'battery_saver') return 'battery_saver';
  if (k === 'phone_language') return 'language';

  if (k === 'brightness') return 'brightness';
  if (k === 'auto_brightness' || k === 'brightness_auto_mode_enable') return 'auto_brightness';

  if (k === 'media_volume' || k === 'setting_volume') return 'volume_media';
  if (k === 'ring_volume') return 'volume_ring';
  if (k === 'alarm_volume') return 'volume_alarm';
  if (k === 'notification_volume') return 'volume_notification';
  if (k === 'separate_ring_volume') return 'volume_ring';
  if (k === 'call_volume') return 'volume_call';
  if (k === 'voice_assist_volume') return 'volume_voice_assist';

  if (k === 'silent_mode' || k === 'ringer_mode_setting') return 'silent';

  if (k === 'dark_ui_mode' || k === 'dark_mode_display_enable') return 'dark_mode';
  if (k === 'eye_comfort' || k === 'eye_comfort_mode' || k === 'eye_protection') return 'eye_comfort';
  if (k === 'paper_mode_enable') return 'eye_comfort';
  if (k === 'paper_mode_adjust_level' || k === 'adjust_paper_mode') return 'eye_comfort_level';
  if (k === 'key_do_not_disturb_mode' || k === 'do_not_disturb_mode' || k === 'zen_mode') return 'do_not_disturb';

  if (k === 'font_size') return 'font_size';
  if (k === 'display_size') return 'display_size';

  if (k === 'number') return 'phone_number';
  if (k === 'imei') return 'imei_info';
  if (k === 'icc_id' || k === 'iccid') return 'iccid';

  return k;
}

export function getEffectiveBuildInfo(): DeviceInfoPreset {
  return {
    ...(OS_DEFAULTS.build as DeviceInfoPreset),
    ...buildOverrides,
  };
}

export function getEffectiveTelephony(): { sims: SimInfoPreset[]; defaultDataSim: 1 | 2 } {
  const defaults = OS_DEFAULTS.telephony as { sims: SimInfoPreset[]; defaultDataSim: 1 | 2 };
  return {
    sims: cloneSims(telephonyOverrides.sims ?? defaults.sims),
    defaultDataSim: telephonyOverrides.defaultDataSim ?? defaults.defaultDataSim,
  };
}

export function setBuildOverrides(patch: Partial<DeviceInfoPreset>): void {
  if (!isRecord(patch)) return;
  let changed = false;
  const next: BuildOverrides = { ...buildOverrides };
  (Object.keys(patch) as Array<keyof DeviceInfoPreset>).forEach((key) => {
    const normalized = normalizeBuildOverrideValue(key, patch[key] as DeviceSettingValue);
    if (normalized === undefined) return;
    if (next[key] === normalized) return;
    (next as Record<string, unknown>)[key as string] = normalized;
    changed = true;
  });
  if (!changed) return;
  buildOverrides = next;
  persistScenarioOverrides();
  emitChange();
}

export function setTelephonyOverrides(patch: TelephonyOverrides): void {
  if (!isRecord(patch)) return;
  let changed = false;
  const next: TelephonyOverrides = { ...telephonyOverrides };
  if (Array.isArray(patch.sims)) {
    next.sims = cloneSims(patch.sims);
    changed = true;
  }
  if (patch.defaultDataSim === 1 || patch.defaultDataSim === 2) {
    next.defaultDataSim = patch.defaultDataSim;
    changed = true;
  }
  if (!changed) return;
  telephonyOverrides = next;
  persistScenarioOverrides();
  emitChange();
}

export function subscribePreferenceChanges(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function registerManager(keys: readonly string[], manager: ManagerWithPreferences): void {
  keys.forEach((key) => {
    const normalized = normalizePreferenceKey(key);
    if (normalized) {
      keyToManager.set(normalized, manager);
    }
  });
}



function getDefaultSim(): SimInfoPreset | undefined {
  const telephony = getEffectiveTelephony();
  const slot = telephony.defaultDataSim === 2 ? 2 : 1;
  return telephony.sims.find((sim) => sim.slot === slot) ?? telephony.sims[0];
}

function genericGetPreference(normalizedKey: string): DeviceSettingValue | undefined {
  const state = useOsStateStore.getState();
  const prefs = state.preferences;
  const build = getEffectiveBuildInfo();
  const telephony = getEffectiveTelephony();

  switch (normalizedKey) {
    case 'language':
      return getLocale();
    case 'device_miui_version':
      return build.hyperOSVersion;
    case 'firmware_version':
      return build.androidVersion;
    case 'security_patch':
      return build.securityPatch;
    case 'model_number':
    case 'hardware_info_device_model':
    case 'device_model':
      return build.model;
    case 'model_name':
      return build.marketName;
    case 'device_cpu':
      return build.processor;
    case 'device_memory':
    case 'key_storage_total_size':
      return build.ramTotal;
    case 'device_internal_memory':
      return build.storageTotal;
    case 'device_internal_memory_used':
      return useOsStateStore.getState().hardware.storage.used;
    case 'baseband_version':
      return build.basebandVersion;
    case 'kernel_version':
      return build.kernelVersion;
    case 'hardware_version':
    case 'hardware_info_device_revision':
      return prefs.hardware_version ?? 'V1.0';
    case 'hardware_info_device_serial':
      return build.serialNumber;
    case 'imei_info':
      return build.imei1;
    case 'bt_address':
      return build.bluetoothMac;
    case 'wifi_mac_address':
      return build.macAddress;
    case 'slot0_phone_number': {
      const sim = telephony.sims.find((item) => item.slot === 1);
      if (!sim) return '无 SIM';
      return sim.phoneNumber || '未设置';
    }
    case 'slot1_phone_number': {
      const sim = telephony.sims.find((item) => item.slot === 2);
      if (!sim) return '无 SIM';
      return sim.phoneNumber || '未设置';
    }
    case 'phone_number': {
      const sim = getDefaultSim();
      if (!sim) return '无 SIM';
      return sim.phoneNumber || '未设置';
    }
    case 'iccid': {
      const sim = getDefaultSim();
      if (!sim) return '无 SIM';
      return sim.iccid || '未设置';
    }
    case 'operator_name': {
      const sim = getDefaultSim();
      if (!sim) return '无 SIM';
      return sim.carrier || '未知运营商';
    }
    case 'roaming_state': {
      const sim = getDefaultSim();
      if (!sim) return '无 SIM';
      return sim.dataRoaming ? '已开启' : '已关闭';
    }
    case 'sim_status': {
      const sim = getDefaultSim();
      if (!sim) return '无 SIM';
      return `${sim.carrier} ${sim.networkType}`.trim();
    }
    case 'imei_sv':
      return prefs.imei_sv ?? '00';
    case 'up_time':
      return formatUptime(TimeService.now() - bootAtMs);
    case 'device_opcust_version':
      return prefs.device_opcust_version ?? build.buildNumber;
    case 'software_version':
      return build.buildNumber;
    case 'branded_account':
      return prefs.branded_account ?? getDefaultBrandedAccountName();
    case 'eid_info':
      return prefs.eid_info ?? '89***************';
    case 'fcc_equipment_id':
      return prefs.fcc_equipment_id ?? 'FCC ID: 2A********';
    case 'micare_expiry_time':
      return prefs.micare_expiry_time ?? '未知';
    default:
      return prefs[normalizedKey];
  }
}

function genericSetPreference(normalizedKey: string, value: DeviceSettingValue): void {
  switch (normalizedKey) {
    case 'language':
      if (typeof value === 'string') {
        setLocale(value as Locale);
      }
      return;
    case 'device_miui_version':
      setBuildOverrides({ hyperOSVersion: clampString(value, getEffectiveBuildInfo().hyperOSVersion) });
      return;
    case 'firmware_version':
      setBuildOverrides({ androidVersion: clampString(value, getEffectiveBuildInfo().androidVersion) });
      return;
    case 'security_patch':
      setBuildOverrides({ securityPatch: clampString(value, getEffectiveBuildInfo().securityPatch) });
      return;
    case 'model_number':
    case 'hardware_info_device_model':
    case 'device_model':
      setBuildOverrides({ model: clampString(value, getEffectiveBuildInfo().model) });
      return;
    case 'model_name':
      setBuildOverrides({ marketName: clampString(value, getEffectiveBuildInfo().marketName) });
      return;
    case 'device_cpu':
      setBuildOverrides({ processor: clampString(value, getEffectiveBuildInfo().processor) });
      return;
    case 'device_memory':
    case 'key_storage_total_size':
      setBuildOverrides({ ramTotal: clampString(value, getEffectiveBuildInfo().ramTotal) });
      return;
    case 'device_internal_memory':
      setBuildOverrides({ storageTotal: clampString(value, getEffectiveBuildInfo().storageTotal) });
      return;
    case 'device_internal_memory_used':
      mutateOsState((s) => { s.hardware.storage.used = clampString(value, s.hardware.storage.used); });
      return;
    case 'baseband_version':
      setBuildOverrides({ basebandVersion: clampString(value, getEffectiveBuildInfo().basebandVersion) });
      return;
    case 'kernel_version':
      setBuildOverrides({ kernelVersion: clampString(value, getEffectiveBuildInfo().kernelVersion) });
      return;
    case 'hardware_info_device_serial':
      setBuildOverrides({ serialNumber: clampString(value, getEffectiveBuildInfo().serialNumber) });
      return;
    case 'imei_info':
      setBuildOverrides({ imei1: clampString(value, getEffectiveBuildInfo().imei1) });
      return;
    case 'bt_address':
      setBuildOverrides({ bluetoothMac: clampString(value, getEffectiveBuildInfo().bluetoothMac) });
      return;
    case 'wifi_mac_address':
      setBuildOverrides({ macAddress: clampString(value, getEffectiveBuildInfo().macAddress) });
      return;
    case 'software_version':
      setBuildOverrides({ buildNumber: clampString(value, getEffectiveBuildInfo().buildNumber) });
      return;
    case 'slot0_phone_number':
    case 'slot1_phone_number':
    case 'phone_number':
    case 'iccid': {
      const current = getEffectiveTelephony();
      const sims = cloneSims(current.sims);
      const slot = normalizedKey === 'slot1_phone_number'
        ? 2
        : normalizedKey === 'slot0_phone_number'
          ? 1
          : current.defaultDataSim;
      const index = sims.findIndex((sim) => sim.slot === slot);
      const next = index >= 0
        ? { ...sims[index] }
        : {
            slot,
            carrier: '未知运营商',
            phoneNumber: '',
            iccid: '',
            networkType: '4G',
            dataRoaming: false,
            voLTE: true,
          } satisfies SimInfoPreset;
      if (normalizedKey === 'iccid') {
        next.iccid = String(value ?? '').trim();
      } else {
        next.phoneNumber = String(value ?? '').trim();
      }
      if (index >= 0) {
        sims[index] = next;
      } else {
        sims.push(next);
      }
      setTelephonyOverrides({ sims });
      return;
    }
    default:
      return;
  }
}

export function routeGetPreference(key: string): DeviceSettingValue | undefined {
  const normalized = normalizePreferenceKey(key);
  if (!normalized) return undefined;
  const manager = keyToManager.get(normalized);
  if (manager) {
    const value = manager.getPreference(normalized);
    if (value !== undefined) return value;
  }
  return genericGetPreference(normalized);
}

export function routeSetPreference(
  key: string,
  value: DeviceSettingValue,
  options?: DeviceSetOptions,
): void {
  const normalized = normalizePreferenceKey(key);
  if (!normalized) return;
  mutateOsState((state) => {
    const current = state.preferences[normalized];
    if (current === value) return;
    state.preferences[normalized] = value;
  });
  const manager = keyToManager.get(normalized);
  if (manager) {
    manager.setPreference(normalized, value, options);
    return;
  }
  genericSetPreference(normalized, value);
}
