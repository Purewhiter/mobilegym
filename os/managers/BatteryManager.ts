import BroadcastBus, { ACTION_BATTERY_LOW, ACTION_BATTERY_OKAY } from '../BroadcastBus';
import { mutateOsState, useOsStateStore } from '../OsStateStore';
import { registerManager, type DeviceSetOptions, type DeviceSettingValue, type ManagerWithPreferences } from './registry';

const BATTERY_PREFERENCE_KEYS = [
  'battery_level',
  'battery_status',
  'battery_saver',
  'battery_info_cycle_count',
  'battery_info_manufacture_date',
  'battery_info_first_use_date',
] as const;

let batteryLowActive = false;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const next = typeof value === 'number' ? value : Number(String(value ?? '').replace('%', ''));
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(Math.round(next), min), max);
}

function emitBatteryStatusChange(): void {
  const battery = useOsStateStore.getState().hardware.battery;
  if (!batteryLowActive && battery.percent <= 15) {
    batteryLowActive = true;
    BroadcastBus.sendBroadcast({
      action: ACTION_BATTERY_LOW,
      extras: { percent: battery.percent, charging: battery.charging },
    });
    return;
  }
  if (batteryLowActive && battery.percent >= 20) {
    batteryLowActive = false;
    BroadcastBus.sendBroadcast({
      action: ACTION_BATTERY_OKAY,
      extras: { percent: battery.percent, charging: battery.charging },
    });
  }
}

function setBatteryPercent(value: number): void {
  mutateOsState((state) => {
    state.hardware.battery.percent = clampInt(value, 0, 100, state.hardware.battery.percent);
  });
  emitBatteryStatusChange();
}

function setChargingStatus(charging: boolean, fastCharging?: boolean): void {
  mutateOsState((state) => {
    state.hardware.battery.charging = charging;
    if (typeof fastCharging === 'boolean') {
      state.hardware.battery.fastCharging = fastCharging;
    }
  });
  emitBatteryStatusChange();
}

function setBatterySaverEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.settings.global.batterySaverEnabled = enabled;
  });
}

export const BatteryManager: ManagerWithPreferences & {
  setBatteryPercent: typeof setBatteryPercent;
  setChargingStatus: typeof setChargingStatus;
  setBatterySaverEnabled: typeof setBatterySaverEnabled;
} = {
  getPreference(key: string): DeviceSettingValue | undefined {
    const state = useOsStateStore.getState();
    switch (key) {
      case 'battery_level':
        return `${state.hardware.battery.percent}%`;
      case 'battery_status':
        return state.hardware.battery.charging
          ? (state.hardware.battery.fastCharging ? '快充中' : '充电中')
          : '未充电';
      case 'battery_saver':
        return state.settings.global.batterySaverEnabled;
      case 'battery_info_cycle_count':
        return state.hardware.battery.cycleCount;
      case 'battery_info_manufacture_date':
        return state.preferences.battery_info_manufacture_date ?? '2025-11';
      case 'battery_info_first_use_date':
        return state.preferences.battery_info_first_use_date ?? '2026-01';
      default:
        return undefined;
    }
  },

  setPreference(key: string, value: DeviceSettingValue, _options?: DeviceSetOptions): void {
    switch (key) {
      case 'battery_level':
        setBatteryPercent(clampInt(value, 0, 100, useOsStateStore.getState().hardware.battery.percent));
        return;
      case 'battery_status': {
        // Acceptable inputs (case-insensitive):
        //   - bool / numeric: true/false, 1/0
        //   - English: 'charging', 'fast charging' / 'fast-charging' / 'fastcharging' / 'quick charging',
        //              'not charging' / 'not-charging' / 'not_charging' / 'notcharging', 'discharging', 'no charge'
        //   - Chinese: '充电中', '快充中', '未充电' (matches BatteryManager.getPreference output)
        //
        // Negation must be checked BEFORE the positive `includes('charging')`
        // branch — 'not-charging' contains 'charging' as a substring and would
        // otherwise be silently dropped by the positive matcher.
        const text = String(value ?? '').trim().toLowerCase();
        const negated =
          text === '0' ||
          text === 'false' ||
          text === '未充电' ||
          text.includes('discharging') ||
          /\b(not|no)[\s\-_]*charg/.test(text);
        if (negated) {
          setChargingStatus(false, false);
          return;
        }
        const isFast =
          text.includes('快充') ||
          text.includes('fast') ||
          text.includes('quick');
        const isCharging =
          isFast ||
          text === '1' ||
          text === 'true' ||
          text === '充电中' ||
          text.includes('charging');
        if (isCharging) {
          setChargingStatus(true, isFast);
        }
        // Empty / unrecognized strings: leave state unchanged.
        return;
      }
      case 'battery_saver':
        setBatterySaverEnabled(Boolean(value));
        return;
      case 'battery_info_cycle_count':
        mutateOsState((state) => {
          state.hardware.battery.cycleCount = clampInt(value, 0, 9999, state.hardware.battery.cycleCount);
        });
        return;
      default:
        return;
    }
  },

  setBatteryPercent,
  setChargingStatus,
  setBatterySaverEnabled,
};

registerManager(BATTERY_PREFERENCE_KEYS, BatteryManager);
