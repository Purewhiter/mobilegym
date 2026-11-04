import React, { useMemo, useSyncExternalStore } from 'react';
import { IcBluetooth, IcLink, IcLinkOff, IcEdit } from '../res/icons';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import { PreferenceItem } from './PreferenceItem';
import { Toast } from '@/os/components/Toast';
import { InputDialog } from './InputDialog';
import { usePageDialog } from '../hooks/usePageDialog';
import { useBooleanPreference } from '../state';
import { useOsStateStore } from '../../../os/OsStateStore';
import { ConnectivityManager } from '../../../os/managers/ConnectivityManager';
import { getEffectiveBuildInfo } from '../../../os/managers/registry';
import { getOsDataRevision, subscribeOsDataRevision } from '../../../os/simState';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSettingsGestures } from '../hooks/useSettingsGestures';
import { routes } from '../routes';
import { useTimedToast } from '../../../os/hooks/useTimedToast';
export const BluetoothDevicesPage: React.FC = () => {
  const { bindNav } = useSettingsGestures();
  const s = useAppStrings(strings, stringsEn);
  const [btEnabled, setBtEnabled] = useBooleanPreference('bluetooth_enable', true);

  const osDataRevision = useSyncExternalStore(
    subscribeOsDataRevision,
    getOsDataRevision,
  );
  const osState = useOsStateStore.getState();
  const build = getEffectiveBuildInfo();
  const nearbyBluetooth = useMemo(
    () => osState.hardware.nearbyBluetooth.map((device) => ({
      ...device,
      connected: osState.settings.global.bluetoothEnabled ? Boolean(device.connected) : false,
    })),
    [osDataRevision, osState.hardware.nearbyBluetooth, osState.settings.global.bluetoothEnabled],
  );

  const { toast, showToast } = useTimedToast();

  const nameDialog = usePageDialog('btName');

  const btName = osState.hardware.bluetooth.name || build.model;

  const paired = useMemo(
    () => nearbyBluetooth.filter((d) => d.paired),
    [nearbyBluetooth]
  );
  const available = useMemo(
    () => nearbyBluetooth.filter((d) => !d.paired),
    [nearbyBluetooth]
  );

  const toggleConnect = (mac: string, connected: boolean) => {
    if (!btEnabled) {
      showToast(s.please_enable_bluetooth_first);
      return;
    }
    if (connected) {
      ConnectivityManager.disconnectBluetooth(mac);
      showToast(s.disconnected);
    } else {
      ConnectivityManager.connectBluetooth(mac);
      showToast(s.connected);
    }
  };

  const pairAndConnect = (mac: string) => {
    if (!btEnabled) {
      showToast(s.please_enable_bluetooth_first);
      return;
    }
    const ok = ConnectivityManager.connectBluetooth(mac);
    showToast(ok ? s.paired_and_connected : s.pair_failed);
  };

  const rename = (v: string) => {
    const name = String(v ?? '').trim();
    if (!name) {
      showToast(s.name_cannot_be_empty);
      return;
    }
    ConnectivityManager.setDeviceName(name);
    nameDialog.close();
    showToast(s.updated);
  };

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <SettingsHeader title={s.bluetooth} />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        <PreferenceCategory title={s.toggle}>
          <PreferenceItem
            title={s.bluetooth}
            summary={btEnabled ? s.on_2 : s.off_2}
            showChevron={false}
            showDivider={false}
            onClick={() => setBtEnabled(!btEnabled)}
          >
            <div
              className={`w-(--app-switch-track-width) h-(--app-switch-track-height) rounded-full flex items-center p-(--app-switch-track-padding) transition-colors ${
                btEnabled ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'
              }`}
              style={{ transitionDuration: 'var(--app-duration-short)' }}
            >
              <div className="w-(--app-switch-thumb-size) h-(--app-switch-thumb-size) bg-app-surface rounded-full shadow-sm" />
            </div>
          </PreferenceItem>
        </PreferenceCategory>

        <PreferenceCategory title={s.this_device}>
          <PreferenceItem
            title={s.device_name}
            value={btName}
            showChevron={false}
            showDivider={false}
            itemProps={nameDialog.bindOpen()}
          >
            <IcEdit size={16} className="text-gray-300" />
          </PreferenceItem>
        </PreferenceCategory>

        <PreferenceCategory title={s.paired_devices}>
          {paired.length === 0 ? (
            <div className="px-6 py-3 text-[13px] text-gray-400">{s.no_paired_devices}</div>
          ) : (
            paired.map((d, idx) => (
              <PreferenceItem
                key={d.mac}
                title={d.name}
                summary={d.type === 'audio' ? s.audio_device : d.type === 'watch' ? s.wearable_device : s.bluetooth_device}
                value={d.connected ? s.connected : undefined}
                showDivider={idx < paired.length - 1}
                showChevron={false}
                itemProps={nameDialog.bindTap({ kind: 'action', id: 'settings.bluetooth.device.toggle' }, { onTrigger: () => toggleConnect(d.mac, d.connected) })}
              >
                <div className="flex items-center gap-2 mr-1">
                  <IcBluetooth size={16} className={d.connected ? 'text-app-primary' : 'text-gray-300'} />
                  {d.connected ? <IcLink size={14} className="text-gray-300" /> : <IcLinkOff size={14} className="text-gray-300" />}
                </div>
              </PreferenceItem>
            ))
          )}
        </PreferenceCategory>

        <PreferenceCategory title={s.available_devices_2}>
          {available.length === 0 ? (
            <div className="px-6 py-3 text-[13px] text-gray-400">{s.no_available_devices}</div>
          ) : (
            available.map((d, idx) => (
              <PreferenceItem
                key={d.mac}
                title={d.name}
                summary={d.type === 'audio' ? s.audio_device : d.type === 'watch' ? s.wearable_device : s.bluetooth_device}
                showDivider={idx < available.length - 1}
                showChevron={false}
                itemProps={nameDialog.bindTap({ kind: 'action', id: 'settings.bluetooth.device.pair' }, { onTrigger: () => pairAndConnect(d.mac) })}
              >
                <IcBluetooth size={16} className="text-gray-300" />
              </PreferenceItem>
            ))
          )}
        </PreferenceCategory>

        <PreferenceCategory title={s.more_settings}>
          <PreferenceItem
            title={s.advanced_settings}
            summary={s.quick_connect_connection_notifications_icon}
            showDivider={false}
            itemProps={bindNav(routes.page, { params: { pageId: 'bluetooth_advanced_settings' } })}
          />
        </PreferenceCategory>
      </div>

      <InputDialog
        open={nameDialog.isOpen()}
        title={s.device_name}
        placeholder={s.enter_bluetooth_name}
        defaultValue={btName}
        onClose={nameDialog.close}
        cancelBind={nameDialog.cancelBind}
        bindConfirm={(v) => nameDialog.bindTap({ kind: 'action', id: 'settings.bluetooth.name.confirm' }, { onTrigger: () => rename(v) })}
        onConfirm={(v) => rename(v)}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default BluetoothDevicesPage;
