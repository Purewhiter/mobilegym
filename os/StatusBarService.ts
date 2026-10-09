import BroadcastBus, { ACTION_STATUS_BAR_CHANGED } from './BroadcastBus';
import { memoSelector } from './createAppStore';
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
