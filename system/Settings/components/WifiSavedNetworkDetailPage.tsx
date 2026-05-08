import React, { useMemo, useRef, useState } from 'react';
import { SettingsHeader } from './SettingsHeader';
import { useAppNavigate } from '../navigation';
import { PreferenceCategory } from './PreferenceCategory';
import { PreferenceItem } from './PreferenceItem';
import { Toast } from '@/os/components/Toast';
import {
  useWifiConnectedSsid,
  useWifiSavedNetworks,
  useBooleanPreference,
  useWifiActions,
} from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

export const WifiSavedNetworkDetailPage: React.FC<{ ssid: string }> = ({ ssid }) => {
  const { back } = useAppNavigate();
  const s = useAppStrings(strings, stringsEn);
  const savedNetworks = useWifiSavedNetworks();
  const connectedSsid = useWifiConnectedSsid();
  const [wifiEnabled] = useBooleanPreference('wifi_enable', true);
  const { setWifiNetworkAutoJoin, connectWifi, forgetWifiSavedNetwork } = useWifiActions();

  const network = useMemo(() => savedNetworks.find((n) => n.ssid === ssid), [savedNetworks, ssid]);
  const isConnected = connectedSsid === ssid;

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | undefined>(undefined);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1600);
  };

  if (!network) {
    return (
      <div className="h-full bg-app-bg flex flex-col">
        <SettingsHeader title={s.network_details} />
        <div className="flex-1 flex items-center justify-center px-6 text-[13px] text-gray-400">
          {s.this_network_does_not_exist_or_has_been_removed}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <SettingsHeader title={ssid} />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        <PreferenceCategory title={s.status}>
          <PreferenceItem
            title={s.security_2}
            value={network.security === 'OPEN' ? s.none : network.security}
            showChevron={false}
            showDivider={true}
          />
          <PreferenceItem
            title={s.connection_status}
            value={isConnected ? s.connected : s.not_connected}
            showChevron={false}
            showDivider={false}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.options}>
          <PreferenceItem
            title={s.auto_join}
            value={network.autoJoin === false ? s.off_2 : s.on_2}
            showChevron={false}
            showDivider={true}
            onClick={() => {
              setWifiNetworkAutoJoin(ssid, network.autoJoin === false);
            }}
          />
          <PreferenceItem
            title={isConnected ? s.reconnect : s.connect}
            summary={!wifiEnabled ? s.wlan_is_off : undefined}
            showChevron={false}
            showDivider={true}
            onClick={() => {
              if (!wifiEnabled) {
                showToast(s.please_enable_wlan_first);
                return;
              }
              connectWifi(ssid);
              showToast(s.connected);
            }}
          />
          <PreferenceItem
            title={s.forget_network_2}
            summary={s.remove_from_saved_networks}
            showChevron={false}
            showDivider={false}
            onClick={() => {
              forgetWifiSavedNetwork(ssid);
              showToast(s.removed);
              setTimeout(() => back(), 250);
            }}
          />
        </PreferenceCategory>
      </div>
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

