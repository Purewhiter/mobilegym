import React, { useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SettingsHeader } from './SettingsHeader';
import { useAppNavigate } from '../navigation';
import { PreferenceItem } from './PreferenceItem';
import { Toast } from '@/os/components/Toast';
import { InputDialog } from './InputDialog';
import { useWifiConnectedSsid, useWifiSavedNetworks, useBooleanPreference, useWifiActions } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

export const WifiSavedNetworksPage: React.FC<{ title: string }> = ({ title }) => {
  const { go, back } = useAppNavigate();
  const { pageId } = useParams();
  const [searchParams] = useSearchParams();
  const s = useAppStrings(strings, stringsEn);
  const savedNetworks = useWifiSavedNetworks();
  const connectedSsid = useWifiConnectedSsid();
  const [wifiEnabled] = useBooleanPreference('wifi_enable', true);
  const { addWifiSavedNetwork } = useWifiActions();

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | undefined>(undefined);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1600);
  };

  const ssidDialogOpen = searchParams.get('addNetwork') === 'ssid';
  const pwdDialogOpen = searchParams.get('addNetwork') === 'password';
  const pendingSsidRef = useRef('');

  const list = useMemo(() => {
    // Keep stable ordering: connected first, then lastConnectedAt desc, then ssid
    return [...savedNetworks].sort((a, b) => {
      const aConn = a.ssid === connectedSsid ? 1 : 0;
      const bConn = b.ssid === connectedSsid ? 1 : 0;
      if (aConn !== bConn) return bConn - aConn;
      const aTs = a.lastConnectedAt || 0;
      const bTs = b.lastConnectedAt || 0;
      if (aTs !== bTs) return bTs - aTs;
      return a.ssid.localeCompare(b.ssid, 'zh-Hans-CN');
    });
  }, [savedNetworks, connectedSsid]);

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <SettingsHeader title={title} />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        {!wifiEnabled && (
          <div className="px-6 py-3 text-[12px] text-gray-400">
            {s.wlan_is_off_you_can_still_manage_saved_networks}
          </div>
        )}

        <div className="px-4 mt-2">
          <div className="bg-app-surface rounded-2xl overflow-hidden">
            <PreferenceItem
              title={s.add_network}
              summary={s.manually_add_a_wlan_network}
              showDivider={list.length > 0}
              showChevron={true}
              onClick={() => go('page.addNetwork.ssid.open', { pageId: pageId ?? '' })}
            />
            {list.map((n, idx) => {
              const isConnected = n.ssid === connectedSsid;
              const summaryParts = [
                n.security === 'OPEN' ? s.no_password : n.security,
                n.autoJoin === false ? s.dont_auto_join : s.auto_join,
              ];
              return (
                <PreferenceItem
                  key={n.ssid}
                  title={n.ssid}
                  summary={summaryParts.filter(Boolean).join(' · ')}
                  value={isConnected ? s.connected : undefined}
                  showDivider={idx < list.length - 1}
                  showChevron={true}
                  onClick={() => go('page.open', { pageId: `wifi_saved_network__${encodeURIComponent(n.ssid)}` })}
                />
              );
            })}
          </div>
        </div>
      </div>

      <InputDialog
        open={ssidDialogOpen}
        title={s.add_network}
        placeholder={s.network_name_ssid}
        onClose={() => back()}
        onConfirm={(ssid) => {
          pendingSsidRef.current = ssid;
          go('page.addNetwork.password.open', { pageId: pageId ?? '' });
        }}
      />
      <InputDialog
        open={pwdDialogOpen}
        title={s.enter_password_2}
        placeholder={s.leave_empty_for_open_networks}
        confirmText={s.add}
        allowEmpty={true}
        onClose={() => back()}
        onConfirm={(pwd) => {
          const ssid = pendingSsidRef.current;
          addWifiSavedNetwork({
            ssid,
            security: pwd ? 'WPA2' : 'OPEN',
            password: pwd || undefined,
            autoJoin: true,
          });
          showToast(s.added_to_saved_networks);
          // 弹出两级弹窗历史（ssid → password）回到列表
          back(2);
        }}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

