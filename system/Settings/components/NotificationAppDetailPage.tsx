import React, { useRef, useState } from 'react';
import { IcNavForward } from '../res/icons';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import { PreferenceItem } from './PreferenceItem';
import { Toast } from '@/os/components/Toast';
import { useBooleanPreference } from '../state';
import NotificationService from '../../../os/NotificationService';
import { AppIcon } from '../../../os/components/AppIcon';
import { getAppManifest, getLocalizedAppName, isValidAppId } from '../../../os/data/appRegistry';
import type { AppId } from '../../../os/types';
import type { AppManifest } from '../../../os/types/manifest';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
function prefKey(appId: string, field: string): string {
  return `notif.app.${appId}.${field}`;
}

const SwitchRow: React.FC<{
  title: string;
  summary?: string;
  settingKey: string;
  defaultChecked?: boolean;
  showDivider?: boolean;
  onChanged?: (next: boolean) => void;
}> = ({ title, summary, settingKey, defaultChecked = false, showDivider = true, onChanged }) => {
  const [checked, setChecked] = useBooleanPreference(settingKey, defaultChecked);

  return (
    <div>
      <div
        className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-(--app-preference-item-min-height)"
        onClick={() => {
          const next = !checked;
          setChecked(next);
          onChanged?.(next);
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-app-text leading-tight">{title}</div>
          {summary ? (
            <div className="text-[12px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
              {summary}
            </div>
          ) : null}
        </div>
        <div className="ml-3 flex-shrink-0">
          <div
            className={`w-(--app-switch-track-width) h-(--app-switch-track-height) rounded-full flex items-center p-(--app-switch-track-padding) transition-colors ${
              checked ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'
            }`}
            style={{ transitionDuration: 'var(--app-duration-short)' }}
          >
            <div className="w-(--app-switch-thumb-size) h-(--app-switch-thumb-size) bg-app-surface rounded-full shadow-sm" />
          </div>
        </div>
      </div>
      {showDivider ? <div className="h-px bg-gray-100 ml-4 mr-4" /> : null}
    </div>
  );
};

export const NotificationAppDetailPage: React.FC<{ appId: string }> = ({ appId }) => {
  const s = useAppStrings(strings, stringsEn);
  const manifest = (isValidAppId(appId) ? getAppManifest(appId) : undefined) as AppManifest | undefined;
  const resolvedAppId = (isValidAppId(appId) ? (appId as AppId) : null);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | undefined>(undefined);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1600);
  };

  if (!manifest || !resolvedAppId) {
    return (
      <div className="h-full bg-app-bg flex flex-col">
        <SettingsHeader title={s.app_notifications} />
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center text-gray-400">
            <div className="text-[14px] font-medium text-app-text-muted mb-1">{s.app_not_found}</div>
            <div className="text-[12px] text-gray-400">appId：{appId || s.empty}</div>
          </div>
        </div>
      </div>
    );
  }

  const enabledKey = prefKey(resolvedAppId, 'enabled');
  const badgeKey = prefKey(resolvedAppId, 'badge');
  const soundKey = prefKey(resolvedAppId, 'sound');
  const vibrateKey = prefKey(resolvedAppId, 'vibrate');

  return (
    <div className="h-full bg-app-bg flex flex-col">
        <SettingsHeader title={s.app_notifications} />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <AppIcon manifest={manifest} size={42} radius={12} showShadow />
          <div className="min-w-0">
            <div className="text-[18px] font-semibold text-app-text truncate">{resolvedAppId ? getLocalizedAppName(resolvedAppId) : manifest.displayName}</div>
            {manifest.packageName ? (
              <div className="text-[12px] text-gray-400 mt-0.5 truncate">{manifest.packageName}</div>
            ) : null}
          </div>
        </div>

        <PreferenceCategory title={s.notification_permission}>
          <SwitchRow
            title={s.allow_notifications}
            summary={s.when_off_this_app_cannot_send_system_notifications}
            settingKey={enabledKey}
            defaultChecked={true}
            showDivider={true}
            onChanged={(next) => {
              if (!next) {
                NotificationService.clearForApp(resolvedAppId);
                showToast(s.notifications_disabled_and_cleared);
              } else {
                showToast(s.notifications_enabled);
              }
            }}
          />
          <PreferenceItem
            title={s.clear_all_notifications_for_this_app}
            summary={s.remove_this_apps_notifications_from_the}
            showChevron={false}
            showDivider={false}
            onClick={() => {
              NotificationService.clearForApp(resolvedAppId);
              showToast(s.cleared);
            }}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.home_screen_and_alerts}>
          <SwitchRow
            title={s.badge}
            summary={s.show_unread_count_on_home_screen_icon}
            settingKey={badgeKey}
            defaultChecked={true}
            showDivider={false}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.sound_and_vibration_simulated}>
          <SwitchRow
            title={s.notification_sound}
            summary={s.simulation_only_saves_toggle_state}
            settingKey={soundKey}
            defaultChecked={true}
            showDivider={true}
          />
          <SwitchRow
            title={s.vibration_2}
            summary={s.simulation_only_saves_toggle_state}
            settingKey={vibrateKey}
            defaultChecked={true}
            showDivider={false}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.debug}>
          <PreferenceItem
            title={s.send_test_notification}
            summary={s.for_testing_notification_toggle_badge_sync}
            showChevron={false}
            showDivider={false}
            onClick={() => {
              NotificationService.push({
                appId: resolvedAppId,
                title: resolvedAppId ? getLocalizedAppName(resolvedAppId) : manifest.displayName,
                body: s.this_is_a_test_notification,
                importance: 'default',
                read: false,
              });
              showToast(s.sent);
            }}
          >
            <IcNavForward size={16} className="text-gray-300 opacity-0" />
          </PreferenceItem>
        </PreferenceCategory>
      </div>
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default NotificationAppDetailPage;
