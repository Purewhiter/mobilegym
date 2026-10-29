import React, { useId, useSyncExternalStore } from 'react';
import type { QuickSettingsState } from '../types';
import type { StatusBarDynamicState } from '../StatusBarService';
import { NotificationService } from '../NotificationService';
import { getAppManifest } from '../data/appRegistry';
import { AppIcon } from '../components/AppIcon';
import { useOsStateStore } from '../OsStateStore';
import type { DeviceChromeProfile } from './profiles';
import { REDMI_CHROME_ASSETS as assets, REDMI_CHROME_ASSET_METRICS as metrics } from './nativeAssets';
import './nativeChrome.css';

type AssetName = keyof typeof assets;
const asset = (name: string) => assets[name as AssetName];
const iconName = (name: string, light: boolean) => `${name}${light ? '' : '_darkmode'}`;

function NativeBattery({ state, saver, light }: { state: StatusBarDynamicState; saver: boolean; light: boolean }) {
  const id = useId().replace(/:/g, '');
  const level = Math.round(Math.max(0, Math.min(100, state.batteryPercent)));
  const charged = state.charging || state.fastCharging;
  const low = level < 20;
  const special = charged || saver || low;
  const progress = charged ? 'charging' : saver ? 'power_save' : low ? 'low' : `normal${light ? '' : '_dark'}`;
  const background = asset(`hollow_battery_meter_normal${light ? '' : '_dark'}`);
  // Shipped getRealCornerRadiusTranX casts the physical-pixel translation to int.
  const translate = Math.trunc((1 - level / 100) * -69) * (level === 0 ? 2 : 1) / 3;
  const text = <text x={(28 - 4 / 3) / 2} y={13.6576} textAnchor="middle" style={{ fontFamily: 'NativeChromeMiSans', fontSize: 9.599976, fontVariationSettings: "'wght' 620", fontWeight: 400 }}>{level}</text>;
  return <svg data-native-battery="true" width={28} height={20} viewBox="0 0 28 20" aria-label={`battery ${level}`}>
    <defs>
      <mask id={`${id}progress`} maskUnits="userSpaceOnUse" x="0" y="0" width="28" height="20"><image href={assets.hollow_battery_meter_radius} x={translate} width="28" height="20" /></mask>
      <mask id={`${id}outside`} maskUnits="userSpaceOnUse" x="0" y="0" width="28" height="20"><rect width="28" height="20" fill="white" /><image href={assets.hollow_battery_meter_radius} x={translate} width="28" height="20" style={{ filter: 'brightness(0)' }} /></mask>
      <mask id={`${id}digits`} maskUnits="userSpaceOnUse" x="0" y="0" width="28" height="20"><rect width="28" height="20" fill="white" /><g fill={special ? 'white' : 'black'}>{text}</g></mask>
    </defs>
    <g mask={`url(#${id}digits)`}>
      <image href={background} width="28" height="20" mask={`url(#${id}outside)`} />
      <image href={asset(`hollow_battery_meter_progress_${progress}`)} width="28" height="20" mask={`url(#${id}progress)`} />
    </g>
    <g fill={special ? '#fff' : light ? '#ffffff1a' : '#0000001a'}>{text}</g>
  </svg>;
}

/** Shipped SystemUI drawables with the captured Redmi window's physical geometry / 3. */
export function DeviceStatusBar({ profile, time, light, quickSettings: qs, state, zIndex }: {
  profile: DeviceChromeProfile; time: string; light: boolean; quickSettings: QuickSettingsState; state: StatusBarDynamicState; zIndex: number;
}) {
  const notifications = useSyncExternalStore(NotificationService.subscribe, NotificationService.getState, NotificationService.getState);
  const wifiStandard = useOsStateStore(s => s.hardware.wifi.standard);
  const metric = profile.statusBar;
  const foreground = light ? '#ffffffe6' : '#000000bf';
  const seenOwners = new Set<string>();
  const notificationIcons = notifications.items.filter(notification => {
    if (notification.read || !notification.appId || seenOwners.has(notification.appId)) return false;
    seenOwners.add(notification.appId);
    return true;
  }).map(notification => ({ notification, manifest: getAppManifest(notification.appId!) }))
    .filter(({ notification, manifest }) => notification.smallIcon || manifest);
  const renderIcon = (name: string, key = name) => {
    const nativeName = asset(iconName(name, light)) ? iconName(name, light) : name;
    const size = metrics[nativeName as keyof typeof metrics] ?? { width: 20, height: 20 };
    return <img key={key} data-native-icon={name} src={asset(nativeName)} alt="" width={size.width} height={size.height} style={{ width: size.width, height: size.height, flexShrink: 0, ...(name === 'stat_sys_branded_vpn' ? { filter: light ? 'brightness(0) invert(1)' : 'brightness(0)', opacity: light ? 230 / 255 : 191 / 255 } : {}) }} />;
  };
  const mobileTypeVisible = !qs.airplaneModeEnabled && !state.noSim && qs.mobileDataEnabled && state.mobileDataType !== 'none';
  const mobileType = { e: 'E', '3g': '3G', '4g': '4G', '4g_lte': '4G', lte: 'LTE', '5g': '5G', none: '' }[state.mobileDataType];
  return <div data-device-chrome-profile={profile.id} data-native-status-bar="true" className="absolute top-0 w-full pointer-events-none" style={{ height: metric.height, zIndex, color: foreground }}>
    <div style={{ position: 'absolute', left: metric.clockLeft, top: metric.clockTop, height: metric.clockHeight, display: 'flex', alignItems: 'center' }}>
      <span data-native-clock="true" style={{ position: 'relative', display: 'inline-block', fontFamily: 'NativeChromeMiSans', fontSize: metric.clockFontSize, fontVariationSettings: "'wght' 425", fontWeight: 400, lineHeight: `${metric.clockHeight}px`, whiteSpace: 'nowrap' }}>
        <span aria-hidden="true" style={{ visibility: 'hidden' }}>{time.replace(/^0(?=\d:)/, '')}</span>
        <svg width="100%" height={metric.clockHeight} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}><text x="0" y={56 / 3} fill="currentColor">{time.replace(/^0(?=\d:)/, '')}</text></svg>
      </span>
      {(notificationIcons.length > 0 || notifications.statusBarOverflow) && <div data-native-notification-icons="true" style={{ display: 'flex', alignItems: 'center', marginLeft: 3, gap: 0 }}>
        {notificationIcons.slice(0, 3).map(({ notification, manifest }) => <span key={notification.appId} style={{ width: 18, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{notification.smallIcon ? <img data-native-notification-owner={notification.appId} src={notification.smallIcon} alt="" width={40 / 3} height={40 / 3} style={{ objectFit: 'contain' }} /> : manifest ? <AppIcon manifest={manifest} size={40 / 3} radius={4} showShadow={false} /> : null}</span>)}
        {(notifications.statusBarOverflow || notificationIcons.length > 3) && <svg data-native-notification-overflow="true" width="18" height="20" viewBox="0 0 54 60" fill="currentColor"><circle cx="15" cy="26.666667" r="3.333333"/><circle cx="28" cy="26.666667" r="3.333333"/><circle cx="41" cy="26.666667" r="3.333333"/></svg>}
      </div>}
    </div>
    <div data-native-system-icons="true" style={{ position: 'absolute', right: metric.rightInset, top: metric.iconsTop, height: metric.iconSide, display: 'flex', alignItems: 'center' }}>
      {state.vpn && renderIcon('stat_sys_branded_vpn')}
      {state.alarm && renderIcon('stat_sys_alarm')}
      {state.headset && renderIcon('stat_sys_headset')}
      {state.silent && renderIcon('stat_sys_ringer_silent')}
      {qs.nfcEnabled && renderIcon('stat_sys_nfc')}
      {qs.bluetoothEnabled && renderIcon('stat_sys_data_bluetooth')}
      {qs.airplaneModeEnabled ? renderIcon('stat_sys_signal_flightmode') : state.noSim ? renderIcon('stat_sys_no_sim') : <div data-native-mobile="true" style={{ position: 'relative', width: mobileTypeVisible ? 70 / 3 : 20, height: 20 }}>
        {mobileTypeVisible && <svg data-native-mobile-type="true" width={29 / 3} height={19 / 3} viewBox="0 0 29 19" style={{ position: 'absolute', top: 5 / 3, left: 0, overflow: 'visible' }}><text x="0" y="19" fill="currentColor" style={{ fontFamily: 'NativeChromeMiSans', fontSize: 21, fontVariationSettings: "'wght' 660", fontWeight: 400 }}>{mobileType}</text></svg>}
        <img data-native-icon="signal" src={asset(iconName(`stat_sys_signal_${Math.max(0, Math.min(4, state.signalLevel))}`, light))} alt="" style={{ position: 'absolute', right: 0, top: 0, width: 20, height: 20 }} />
      </div>}
      {qs.wifiEnabled && <div data-native-wifi="true" style={{ width: 20, height: 20, position: 'relative' }}>
        <img data-native-icon="wifi" src={asset(iconName(`stat_sys_wifi_signal_${Math.max(0, Math.min(3, state.wifiLevel))}`, light))} alt="" width="20" height="20" />
        {wifiStandard !== undefined && wifiStandard >= 4 && wifiStandard <= 7 && <svg data-native-wifi-standard="true" width={22 / 3} height={34 / 3} viewBox="0 0 22 34" style={{ position: 'absolute', left: 38 / 3, top: 26 / 3 }}><text x="0" y="23" fill="currentColor" style={{ fontFamily: 'NativeChromeMiSans', fontSize: 17, fontVariationSettings: "'wght' 660", fontWeight: 400 }}>{wifiStandard}</text></svg>}
      </div>}
      <NativeBattery state={state} saver={qs.batterySaverEnabled} light={light} />
      {(state.charging || state.fastCharging) && <img data-native-charging="true" src={asset(`hollow_battery_meter_${state.fastCharging ? 'quick_charging' : 'charging'}${light ? '' : '_dark'}`)} alt="" style={{ width: metric.chargeWidth, height: metric.batteryHeight }} />}
    </div>
  </div>;
}
