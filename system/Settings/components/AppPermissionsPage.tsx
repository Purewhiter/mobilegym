import React, { useMemo, useSyncExternalStore } from 'react';
import { IcNavForward } from '../res/icons';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import { AppIcon } from '../../../os/components/AppIcon';
import { APP_REGISTRY, getLocalizedAppName } from '../../../os/data/appRegistry';
import { PermissionService } from '../../../os/PermissionService';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSettingsGestures } from '../hooks/useSettingsGestures';

const AppRow: React.FC<{
  appId: string;
  packageName: string;
  summary: string;
  showDivider: boolean;
  rowProps?: React.HTMLAttributes<HTMLDivElement>;
}> = ({ appId, packageName, summary, showDivider, rowProps }) => {
  const manifest = APP_REGISTRY.find((item) => item.id === appId);
  if (!manifest) return null;

  return (
    <div>
      <div
        className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-(--app-preference-item-min-height)"
        {...rowProps}
      >
        <div className="mr-3 flex-shrink-0">
          <AppIcon manifest={manifest} size={34} radius={10} showShadow />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-tight text-app-text">{getLocalizedAppName(appId)}</div>
          <div className="mt-0.5 line-clamp-1 text-[12px] leading-tight text-gray-400">{packageName}</div>
        </div>
        <div className="ml-2 flex flex-shrink-0 items-center">
          <span className="mr-1 text-[13px] text-gray-400">{summary}</span>
          <IcNavForward size={16} className="text-gray-300" />
        </div>
      </div>
      {showDivider ? <div className="ml-[60px] mr-4 h-px bg-gray-100" /> : null}
    </div>
  );
};

export const AppPermissionsPage: React.FC = () => {
  const { bindTap } = useSettingsGestures();
  const s = useAppStrings(strings, stringsEn);

  const snapshot = useSyncExternalStore(
    (onChange) => PermissionService.subscribe(() => onChange()),
    () => PermissionService.getState(),
  );

  const apps = useMemo(() => {
    const arr = [...APP_REGISTRY];
    arr.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'system' ? -1 : 1;
      return getLocalizedAppName(a.id).localeCompare(getLocalizedAppName(b.id), 'zh-Hans-CN');
    });
    return arr;
  }, []);

  const summaryByAppId = useMemo(() => {
    const map = new Map<string, string>();

    for (const app of apps) {
      const declared = PermissionService.getDeclaredPermissions(app.id);
      if (declared.length === 0) {
        map.set(app.id, s.no_permissions_declared);
        continue;
      }
      const results = PermissionService.checkPermissions(app.id, declared);
      const grantedCount = Object.values(results).filter((status) => status === 'granted').length;
      map.set(app.id, s.permissions_granted_count.replace('${count}', String(grantedCount)));
    }

    return map;
  }, [apps, s, snapshot.grants]);

  return (
    <div className="flex h-full flex-col bg-app-bg">
      <SettingsHeader title={s.permission_management} />
      <div className="no-scrollbar flex-1 overflow-y-auto pb-8">
        <PreferenceCategory title={s.app_permissions}>
          {apps.map((app, index) => (
            <AppRow
              key={app.id}
              appId={app.id}
              packageName={app.packageName}
              summary={summaryByAppId.get(app.id) || '—'}
              showDivider={index < apps.length - 1}
              rowProps={bindTap<HTMLDivElement>('page.open', {
                params: { pageId: `app_permission_detail__${encodeURIComponent(app.id)}` },
              })}
            />
          ))}
        </PreferenceCategory>
      </div>
    </div>
  );
};

export default AppPermissionsPage;
