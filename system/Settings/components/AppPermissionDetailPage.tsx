import React, { useMemo, useSyncExternalStore } from 'react';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import { SettingsIcon } from './SettingsIcon';
import { AppIcon } from '../../../os/components/AppIcon';
import { getAppManifest, getLocalizedAppName, isValidAppId } from '../../../os/data/appRegistry';
import { PermissionService } from '../../../os/PermissionService';
import {
  getPermissionDisplayName,
  getPermissionGroup,
  PERMISSION_GROUPS,
  type PermissionId,
} from '../../../os/permissions';
import type { AppId } from '../../../os/types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

const GroupSwitchRow: React.FC<{
  iconName: string;
  title: string;
  summary: string;
  checked: boolean;
  showDivider: boolean;
  onToggle: () => void;
}> = ({ iconName, title, summary, checked, showDivider, onToggle }) => {
  return (
    <div>
      <div className="flex min-h-(--app-preference-item-min-height) items-center px-4 py-3.5 active:bg-gray-50" onClick={onToggle}>
        <div className="mr-3 flex-shrink-0">
          <SettingsIcon name={iconName} size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-tight text-app-text">{title}</div>
          <div className="mt-0.5 line-clamp-2 text-[12px] leading-tight text-gray-400">{summary}</div>
        </div>
        <div className="ml-3 flex-shrink-0">
          <div
            className={`flex h-(--app-switch-track-height) w-(--app-switch-track-width) items-center rounded-full p-(--app-switch-track-padding) transition-colors ${
              checked ? 'justify-end bg-emerald-500' : 'justify-start bg-gray-300'
            }`}
            style={{ transitionDuration: 'var(--app-duration-short)' }}
          >
            <div className="h-(--app-switch-thumb-size) w-(--app-switch-thumb-size) rounded-full bg-app-surface shadow-sm" />
          </div>
        </div>
      </div>
      {showDivider ? <div className="ml-[60px] mr-4 h-px bg-gray-100" /> : null}
    </div>
  );
};

export const AppPermissionDetailPage: React.FC<{ appId: string }> = ({ appId }) => {
  const s = useAppStrings(strings, stringsEn);

  useSyncExternalStore(
    (onChange) => PermissionService.subscribe(() => onChange()),
    () => PermissionService.getState(),
  );

  const manifest = isValidAppId(appId) ? getAppManifest(appId as AppId) : undefined;
  const resolvedAppId = isValidAppId(appId) ? (appId as AppId) : null;

  const declared = useMemo(
    () => (resolvedAppId ? PermissionService.getDeclaredPermissions(resolvedAppId) : []),
    [resolvedAppId],
  );

  const grouped = useMemo(() => {
    const orderMap = new Map(PERMISSION_GROUPS.map((group, idx) => [group.id, idx]));
    const groups = new Map<string, { id: string; iconName: string; title: string; description: string; permissions: PermissionId[] }>();

    for (const permissionId of declared) {
      const group = getPermissionGroup(permissionId);
      if (!group) {
        const fallbackId = `RAW__${permissionId}`;
        if (!groups.has(fallbackId)) {
          groups.set(fallbackId, {
            id: fallbackId,
            iconName: 'ic_privacy_settings',
            title: getPermissionDisplayName(permissionId),
            description: getPermissionDisplayName(permissionId),
            permissions: [],
          });
        }
        groups.get(fallbackId)!.permissions.push(permissionId);
        continue;
      }

      if (!groups.has(group.id)) {
        groups.set(group.id, {
          id: group.id,
          iconName: group.iconName,
          title: group.displayName,
          description: group.description,
          permissions: [],
        });
      }
      groups.get(group.id)!.permissions.push(permissionId);
    }

    return Array.from(groups.values()).sort((a, b) => {
      const ao = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const bo = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      return ao - bo;
    });
  }, [declared]);

  if (!manifest || !resolvedAppId) {
    return (
      <div className="flex h-full flex-col bg-app-bg">
        <SettingsHeader title={s.app_permissions} />
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="text-center text-gray-400">
            <div className="mb-1 text-[14px] font-medium text-app-text-muted">{s.app_not_found}</div>
            <div className="text-[12px] text-gray-400">{s.app_id_label}{appId || '—'}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-app-bg">
      <SettingsHeader title={s.app_permissions} />
      <div className="no-scrollbar flex-1 overflow-y-auto pb-8">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <AppIcon manifest={manifest} size={42} radius={12} showShadow />
          <div className="min-w-0">
            <div className="truncate text-[18px] font-semibold text-app-text">{getLocalizedAppName(resolvedAppId)}</div>
            <div className="mt-0.5 truncate text-[12px] text-gray-400">{manifest.packageName}</div>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="px-4 py-6 text-[13px] text-gray-400">{s.no_permissions_declared_for_app}</div>
        ) : (
          <PreferenceCategory title={s.permissions}>
            {grouped.map((group, index) => {
              const statuses = PermissionService.checkPermissions(resolvedAppId, group.permissions);
              const checked = Object.values(statuses).some((status) => status === 'granted');

              return (
                <GroupSwitchRow
                  key={group.id}
                  iconName={group.iconName}
                  title={group.title}
                  summary={group.description}
                  checked={checked}
                  showDivider={index < grouped.length - 1}
                  onToggle={() => {
                    if (!checked) {
                      for (const permissionId of group.permissions) {
                        PermissionService.grantPermission(resolvedAppId, permissionId);
                      }
                    } else {
                      for (const permissionId of group.permissions) {
                        PermissionService.revokePermission(resolvedAppId, permissionId);
                      }
                    }
                  }}
                />
              );
            })}
          </PreferenceCategory>
        )}
      </div>
    </div>
  );
};

export default AppPermissionDetailPage;
