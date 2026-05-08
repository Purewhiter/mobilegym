import React, { useMemo, useSyncExternalStore } from 'react';
import { IcNavForward } from '../res/icons';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import NotificationService from '../../../os/NotificationService';
import { AppIcon } from '../../../os/components/AppIcon';
import { APP_REGISTRY, getLocalizedAppName } from '../../../os/data/appRegistry';
import { useOsStateStore } from '../../../os/OsStateStore';
import type { AppId } from '../../../os/types';
import type { AppManifest } from '../../../os/types/manifest';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSettingsGestures } from '../hooks/useSettingsGestures';
function prefKey(appId: string, field: string): string {
  return `notif.app.${appId}.${field}`;
}

function getBoolPref(prefs: Record<string, any>, key: string, fallback: boolean): boolean {
  const v = prefs[key];
  return typeof v === 'boolean' ? v : fallback;
}

const AppRow: React.FC<{
  manifest: AppManifest;
  value?: string;
  showDivider: boolean;
  rowProps?: React.HTMLAttributes<HTMLDivElement>;
}> = ({ manifest, value, showDivider, rowProps }) => {
  return (
    <div>
      <div
        className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-(--app-preference-item-min-height)"
        {...rowProps}
      >
        <div className="mr-3 flex-shrink-0">
          <AppIcon manifest={manifest} size={34} radius={10} showShadow />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-app-text leading-tight">{getLocalizedAppName(manifest.id)}</div>
          {manifest.packageName ? (
            <div className="text-[12px] text-gray-400 mt-0.5 leading-tight line-clamp-1">
              {manifest.packageName}
            </div>
          ) : null}
        </div>
        <div className="flex items-center ml-2 flex-shrink-0">
          {value ? <span className="text-[13px] text-gray-400 mr-1">{value}</span> : null}
          <IcNavForward size={16} className="text-gray-300" />
        </div>
      </div>
      {showDivider ? <div className="h-px bg-gray-100 ml-[60px] mr-4" /> : null}
    </div>
  );
};

export const NotificationManagingPage: React.FC = () => {
  const { bindTap } = useSettingsGestures();
  const s = useAppStrings(strings, stringsEn);
  const prefs = useOsStateStore((state) => state.preferences);

  const snapshot = useSyncExternalStore(
    (onChange) => NotificationService.subscribe(() => onChange()),
    () => NotificationService.getState(),
  );

  const unreadByApp = useMemo(() => {
    const map = new Map<AppId, number>();
    for (const it of snapshot.items) {
      if (!it.appId) continue;
      if (it.read) continue;
      map.set(it.appId, (map.get(it.appId) || 0) + 1);
    }
    return map;
  }, [snapshot.items]);

  const apps = useMemo(() => {
    const arr = [...APP_REGISTRY];
    arr.sort((a, b) => {
      // System apps first, then by name.
      if (a.type !== b.type) return a.type === 'system' ? -1 : 1;
      return getLocalizedAppName(a.id).localeCompare(getLocalizedAppName(b.id), 'zh-Hans-CN');
    });
    return arr;
  }, []);

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <SettingsHeader title={s.notification_management} />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        <PreferenceCategory title={s.app_notifications}>
          {apps.map((app, idx) => {
            const enabled = getBoolPref(prefs, prefKey(app.id, 'enabled'), true);
            const unread = unreadByApp.get(app.id) || 0;
            const value = enabled ? (unread > 0 ? `${unread} ${s.unread_count_suffix}` : s.on_2) : s.off_2;
            return (
              <AppRow
                key={app.id}
                manifest={app}
                value={value}
                showDivider={idx < apps.length - 1}
                rowProps={bindTap<HTMLDivElement>('page.open', {
                  params: { pageId: `notification_app__${encodeURIComponent(app.id)}` },
                })}
              />
            );
          })}
        </PreferenceCategory>
      </div>
    </div>
  );
};

export default NotificationManagingPage;
