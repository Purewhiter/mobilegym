import React, { useMemo, useSyncExternalStore } from 'react';
import { IcWifi, IcLock, IcUnlock } from '../res/icons';
import { useNavGestures } from '../../../os/navigation';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import { PreferenceItem } from './PreferenceItem';
import { Toast } from '@/os/components/Toast';
import { InputDialog } from './InputDialog';
import { usePageDialog } from '../hooks/usePageDialog';
import { useWifiSavedNetworks, useBooleanPreference, useWifiActions } from '../state';
import { useOsStateStore } from '../../../os/OsStateStore';
import { ConnectivityManager } from '../../../os/managers/ConnectivityManager';
import { routeGetPreference, routeSetPreference } from '../../../os/managers/registry';
import { getOsDataRevision, subscribeOsDataRevision } from '../../../os/simState';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { routes } from '../routes';
import { useTimedToast } from '../../../os/hooks/useTimedToast';
function bandLabel(freqMHz: number): string {
  if (!Number.isFinite(freqMHz)) return '';
  if (freqMHz >= 4900) return '5G';
  if (freqMHz >= 2400) return '2.4G';
  return '';
}

function securityLabel(sec: string): string {
  if (sec === 'OPEN') return 'OPEN_NO_PWD';
  return sec || '';
}

export const WifiNetworksPage: React.FC = () => {
  const { bindNav } = useNavGestures();
  const s = useAppStrings(strings, stringsEn);
  const [wifiEnabled, setWifiEnabled] = useBooleanPreference('wifi_enable', true);
  const savedNetworks = useWifiSavedNetworks();
  const { addWifiSavedNetwork, connectWifi } = useWifiActions();

  const osDataRevision = useSyncExternalStore(
    subscribeOsDataRevision,
    getOsDataRevision,
  );
  const osState = useOsStateStore.getState();
  const connectedSsid = osState.settings.global.wifiEnabled ? osState.hardware.wifi.connectedSsid : undefined;
  const nearby = useMemo(
    () => osState.hardware.nearbyWifi.map((ap) => ({
      ...ap,
      connected: Boolean(connectedSsid && ap.ssid === connectedSsid),
    })),
    [osDataRevision, connectedSsid, osState.hardware.nearbyWifi],
  );

  const { toast, showToast } = useTimedToast();

  const connectDialog = usePageDialog('connect');

  const list = useMemo(() => {
    const arr = [...nearby];
    arr.sort((a, b) => {
      const aConn = a.connected ? 1 : 0;
      const bConn = b.connected ? 1 : 0;
      if (aConn !== bConn) return bConn - aConn;
      if (a.signalLevel !== b.signalLevel) return (b.signalLevel ?? 0) - (a.signalLevel ?? 0);
      return a.ssid.localeCompare(b.ssid, 'zh-Hans-CN');
    });
    return arr;
  }, [nearby]);

  const connectTo = (ssid: string, security: string, password?: string) => {
    if (security !== 'OPEN') {
      const correct = routeGetPreference(`wifi_password__${ssid}`);
      if (typeof correct === 'string' && correct.length > 0) {
        const ok = String(password ?? '') === String(correct);
        if (!ok) {
          routeSetPreference('wifi_last_hint', 'wrong_password', { source: 'settings' });
          showToast(s.wrong_password);
          return;
        }
      }
    }
    // Persist to saved networks (Settings app)
    const sec = (security === 'WPA3' ? 'WPA3' : security === 'OPEN' ? 'OPEN' : 'WPA2') as any;
    addWifiSavedNetwork({
      ssid,
      security: sec,
      password: password || undefined,
      autoJoin: true,
    });
    connectWifi(ssid);
    routeSetPreference('wifi_last_hint', 'connected', { source: 'settings' });
    showToast(s.connected);
  };

  // A secured network with no saved password asks for one (?dialog=connect); every other tap acts in place.
  const needsPassword = (ssid: string, security: string) =>
    wifiEnabled && connectedSsid !== ssid && security !== 'OPEN'
    && !savedNetworks.find((n) => n.ssid === ssid)?.password;

  const handleTapNetwork = (ssid: string, security: string) => {
    if (!wifiEnabled) {
      showToast(s.please_enable_wlan_first);
      return;
    }
    if (connectedSsid === ssid) {
      ConnectivityManager.disconnectWifi();
      showToast(s.disconnected);
      return;
    }
    if (security === 'OPEN') {
      connectTo(ssid, security);
      return;
    }
    const saved = savedNetworks.find((n) => n.ssid === ssid);
    if (saved?.password) {
      connectTo(ssid, saved.security, saved.password);
      return;
    }
    connectDialog.open({ ssid, security });
  };

  const connectWithPassword = (pwd: string) => {
    connectDialog.close();
    connectTo(connectDialog.param('ssid'), connectDialog.param('security') || 'WPA2', pwd);
  };

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <SettingsHeader title="WLAN" />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        <PreferenceCategory title={s.toggle}>
          <PreferenceItem
            title="WLAN"
            summary={wifiEnabled ? (connectedSsid ? `${s.connected}：${connectedSsid}` : s.not_connected) : s.off_2}
            showChevron={false}
            showDivider={false}
            onClick={() => setWifiEnabled(!wifiEnabled)}
          >
            <div
              className={`w-(--app-switch-track-width) h-(--app-switch-track-height) rounded-full flex items-center p-(--app-switch-track-padding) transition-colors ${
                wifiEnabled ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'
              }`}
              style={{ transitionDuration: 'var(--app-duration-short)' }}
            >
              <div className="w-(--app-switch-thumb-size) h-(--app-switch-thumb-size) bg-app-surface rounded-full shadow-sm" />
            </div>
          </PreferenceItem>
        </PreferenceCategory>

        <PreferenceCategory title={s.available_networks}>
          {list.length === 0 ? (
            <div className="px-6 py-3 text-[13px] text-gray-400">{s.no_available_networks_found}</div>
          ) : (
            list.map((ap, idx) => {
              const locked = ap.security !== 'OPEN';
              const isConn = ap.connected;
              const summary = [ap.security === 'OPEN' ? s.no_password : (ap.security || ''), bandLabel(ap.frequency)].filter(Boolean).join(' · ');
              return (
                <PreferenceItem
                  key={ap.bssid || ap.ssid || idx}
                  title={ap.ssid || s.hidden_network}
                  summary={summary || undefined}
                  value={isConn ? s.connected : undefined}
                  showDivider={idx < list.length - 1}
                  showChevron={false}
                  itemProps={needsPassword(ap.ssid, ap.security)
                    ? connectDialog.bindOpen({ ssid: ap.ssid, security: ap.security })
                    : connectDialog.bindTap({ kind: 'action', id: 'settings.wifi.network.tap' }, { onTrigger: () => handleTapNetwork(ap.ssid, ap.security) })}
                >
                  <div className="flex items-center gap-2 mr-1">
                    {locked ? (
                      <IcLock size={14} className="text-gray-300" />
                    ) : (
                      <IcUnlock size={14} className="text-gray-300" />
                    )}
                    <IcWifi size={16} className={isConn ? 'text-app-primary' : 'text-gray-300'} />
                  </div>
                </PreferenceItem>
              );
            })
          )}
        </PreferenceCategory>

        <PreferenceCategory title={s.network_management}>
          <PreferenceItem
            title={s.saved_networks}
            summary={s.view_and_manage_saved_wlan_networks}
            showDivider={true}
            itemProps={bindNav(routes.page, { params: { pageId: 'saved_access_points' } })}
          />
          <PreferenceItem
            title={s.advanced_settings}
            summary={s.proxy_random_mac_network_preferences_etc}
            showDivider={false}
            itemProps={bindNav(routes.page, { params: { pageId: 'wifi_configure_settings' } })}
          />
        </PreferenceCategory>
      </div>

      <InputDialog
        open={connectDialog.isOpen()}
        title={`${s.connect} ${connectDialog.param('ssid')}`}
        placeholder={s.enter_password}
        inputType="password"
        allowEmpty={false}
        confirmText={s.connect}
        onClose={connectDialog.close}
        onConfirm={(pwd) => connectWithPassword(pwd)}
        cancelBind={connectDialog.cancelBind}
        bindConfirm={(pwd) => connectDialog.bindTap({ kind: 'action', id: 'settings.wifi.connect.confirm' }, {
          onTrigger: () => connectWithPassword(pwd),
        })}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default WifiNetworksPage;

