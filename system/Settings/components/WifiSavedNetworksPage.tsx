import React, { useMemo } from 'react';
import { SettingsHeader } from './SettingsHeader';
import { useNavGestures } from '../../../os/navigation';
import { PreferenceItem } from './PreferenceItem';
import { Toast } from '@/os/components/Toast';
import { InputDialog } from './InputDialog';
import { useWifiConnectedSsid, useWifiSavedNetworks, useBooleanPreference, useWifiActions } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { routes } from '../routes';
import { usePageDialog } from '../hooks/usePageDialog';
import { useTimedToast } from '../../../os/hooks/useTimedToast';

export const WifiSavedNetworksPage: React.FC<{ title: string }> = ({ title }) => {
  const { bindNav } = useNavGestures();
  const s = useAppStrings(strings, stringsEn);
  const savedNetworks = useWifiSavedNetworks();
  const connectedSsid = useWifiConnectedSsid();
  const [wifiEnabled] = useBooleanPreference('wifi_enable', true);
  const { addWifiSavedNetwork } = useWifiActions();

  const { toast, showToast } = useTimedToast();

  const ssidDialog = usePageDialog('ssid');
  const pwdDialog = usePageDialog('password');

  const addNetwork = (pwd: string) => {
    addWifiSavedNetwork({
      ssid: pwdDialog.param('ssid'),
      security: pwd ? 'WPA2' : 'OPEN',
      password: pwd || undefined,
      autoJoin: true,
    });
    pwdDialog.close();
    showToast(s.added_to_saved_networks);
  };

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
              itemProps={ssidDialog.bindOpen()}
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
                  itemProps={bindNav(routes.page, { params: { pageId: `wifi_saved_network__${encodeURIComponent(n.ssid)}` } })}
                />
              );
            })}
          </div>
        </div>
      </div>

      <InputDialog
        open={ssidDialog.isOpen()}
        title={s.add_network}
        placeholder={s.network_name_ssid}
        onClose={ssidDialog.close}
        onConfirm={(ssid) => ssidDialog.replaceWith('password', { ssid })}
        cancelBind={ssidDialog.cancelBind}
        bindConfirm={(ssid) => ssidDialog.bindTap({ kind: 'action', id: 'settings.wifiSaved.ssid.confirm' }, {
          onTrigger: () => ssidDialog.replaceWith('password', { ssid }),
        })}
      />
      <InputDialog
        open={pwdDialog.isOpen()}
        title={s.enter_password_2}
        placeholder={s.leave_empty_for_open_networks}
        confirmText={s.add}
        allowEmpty={true}
        onClose={pwdDialog.close}
        onConfirm={(pwd) => addNetwork(pwd)}
        cancelBind={pwdDialog.cancelBind}
        bindConfirm={(pwd) => pwdDialog.bindTap({ kind: 'action', id: 'settings.wifiSaved.add.confirm' }, { onTrigger: () => addNetwork(pwd) })}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

