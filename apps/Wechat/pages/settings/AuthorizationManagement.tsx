
import React from 'react';
import { dimens } from '../../res/dimens';
import { IcNavForward } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { strings } from '../../res/strings';

type WechatStrings = typeof strings;

function localizeAppType(t: WechatStrings, type: string) {
  if (type === '移动应用') return t.auth_app_type_mobile;
  if (type === '小程序') return t.auth_app_type_mini_program;
  return type;
}

function localizePermission(t: WechatStrings, permission: string) {
  if (permission === '昵称和头像') return t.auth_permission_nickname_avatar;
  if (permission === '朋友关系') return t.auth_permission_friends;
  return permission;
}

export const AuthorizationManagementPage: React.FC = () => {
  const t = useWechatStrings();
  const { bindTap } = useWechatGestures();
  const authorizedApps = useWechatStore(s => s.authorizedApps);

  return (
    <div className="bg-app-surface min-h-full flex flex-col">
      <div className="pt-20 pb-16 px-6 flex flex-col items-center">
        <h1 className="text-(--app-title-text-size-28) font-medium text-app-text">{t.auth_mgmt_title}</h1>
      </div>

      <div className="flex-1">
        {authorizedApps.map(app => (
          <div
            key={app.id}
            {...bindTap<HTMLDivElement>('settings.privacy.authorization.detail.open', {
              params: { id: app.id },
            })}
            className="px-6 py-4 flex items-center active:bg-(--app-c-tw-bg-gray-50) border-b border-(--app-c-tw-border-gray-100)"
          >
            <div className="flex-1 min-w-0">
              <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 break-words text-(--app-settings-item-text-size) font-normal text-app-text [overflow-wrap:anywhere]">
                  {app.name}
                </span>
                <span className="text-(--app-hint-text-size-10) text-(--app-c-tw-text-gray-400) bg-(--app-c-tw-bg-gray-100) px-1 rounded-[2px]">
                  {localizeAppType(t, app.type)}
                </span>
              </div>
              <div className="pr-4 text-(--app-settings-group-title-size) leading-normal text-(--app-c-tw-text-gray-400) break-words [overflow-wrap:anywhere]">
                {app.permissions.map(p => localizePermission(t, p)).join(t.auth_permission_list_separator)}
              </div>
            </div>
            <IcNavForward
              size={dimens.icSizeChevron}
              className="ml-3 shrink-0 text-(--app-c-me-chevron-color)"
              strokeWidth={dimens.icStrokeWidth}
            />
          </div>
        ))}
      </div>

      <div className="py-10 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-[0.5px] bg-(--app-c-tw-bg-gray-200)"></div>
          <span className="text-(--app-chat-time-label-text-size) text-(--app-c-tw-text-gray-400)">{t.auth_mgmt_footer}</span>
          <div className="w-8 h-[0.5px] bg-(--app-c-tw-bg-gray-200)"></div>
        </div>
      </div>
    </div>
  );
};
