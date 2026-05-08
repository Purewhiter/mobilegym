import BroadcastBus, { ACTION_STATUS_BAR_CHANGED } from './BroadcastBus';
import { memoSelector } from './createAppStore';
import { OS_DEFAULTS } from './data';
import { OsStateStore, useOsStateStore } from './OsStateStore';

export type MobileDataType = 'none' | 'e' | '3g' | '4g' | '4g_lte' | 'lte' | '5g';

export type StatusBarDynamicState = {
  wifiLevel: number;
  signalLevel: number;
  batteryPercent: number;
  charging: boolean;
  fastCharging: boolean;
  mobileDataType: MobileDataType;
  noSim: boolean;
  vpn: boolean;
  alarm: boolean;
  silent: boolean;
  headset: boolean;
};

const defaultState: StatusBarDynamicState = {
  wifiLevel: OS_DEFAULTS.hardware.wifi.level,
  signalLevel: OS_DEFAULTS.hardware.cellular.signalLevel,
  batteryPercent: OS_DEFAULTS.hardware.battery.percent,
  charging: OS_DEFAULTS.hardware.battery.charging,
  fastCharging: OS_DEFAULTS.hardware.battery.fastCharging,
  mobileDataType: OS_DEFAULTS.hardware.cellular.mobileDataType as MobileDataType,
  noSim: OS_DEFAULTS.hardware.cellular.noSim,
  vpn: OS_DEFAULTS.hardware.vpnEnabled,
  alarm: OS_DEFAULTS.hardware.alarmSet,
  silent: OS_DEFAULTS.settings.global.silentMode,
  headset: OS_DEFAULTS.hardware.headsetConnected,
};

const selectStatusBar = memoSelector(
  (state: ReturnType<typeof OsStateStore.getState>) => ({
    battery: state.hardware.battery,
    cellular: state.hardware.cellular,
    wifi: state.hardware.wifi,
    vpn: state.hardware.vpnEnabled,
    alarm: state.hardware.alarmSet,
    silent: state.settings.global.silentMode,
    headset: state.hardware.headsetConnected,
  }),
  ({ battery, cellular, wifi, vpn, alarm, silent, headset }): StatusBarDynamicState => ({
    wifiLevel: wifi.level,
    signalLevel: cellular.signalLevel,
    batteryPercent: battery.percent,
    charging: battery.charging,
    fastCharging: battery.fastCharging,
    mobileDataType: cellular.mobileDataType as MobileDataType,
    noSim: cellular.noSim,
    vpn,
    alarm,
    silent,
    headset,
  }),
);

export const StatusBarService = {
  getState(): StatusBarDynamicState {
    return selectStatusBar(OsStateStore.getState());
  },

  subscribe(listener: (state: StatusBarDynamicState) => void): () => void {
    return (useOsStateStore.subscribe as any)(selectStatusBar, listener, { fireImmediately: true });
  },

  reset(): void {
    OsStateStore.reset();
  },
};

export function useStatusBar(): StatusBarDynamicState {
  return useOsStateStore(selectStatusBar);
}

let lastBroadcastState: StatusBarDynamicState | null = null;

;(useOsStateStore.subscribe as any)(selectStatusBar, (next: StatusBarDynamicState) => {
  if (lastBroadcastState === next) return;
  lastBroadcastState = next;
  BroadcastBus.sendBroadcast({
    action: ACTION_STATUS_BAR_CHANGED,
    extras: { ...next },
  });
});

export default StatusBarService;
