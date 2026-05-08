
import React, { useEffect } from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useParams, useLocation } from 'react-router-dom';
import { IcUser, IcContacts } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const AuthorizationDetailPage: React.FC = () => {
  const t = useWechatStrings();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { bindTap, bindBack, back, go } = useWechatGestures();
  const { authorizedApps, deauthorizeApp } = useWechatStore(
    useShallow(s => ({
      authorizedApps: s.authorizedApps,
      deauthorizeApp: s.deauthorizeApp,
    })),
  );

  const app = authorizedApps.find(a => a.id === id);
  const searchParams = new URLSearchParams(location.search);
  const showConfirm = searchParams.get('menu') === 'confirm';

  useEffect(() => {
    if (!app) {
      go('settings.privacy.authorization.list.open');
    }
  }, [app, go]);

  if (!app) return null;

  const confirmMessage = t.auth_deauthorize_confirm.replace(/\{\{name\}\}/g, app.name);

  const handleDeauthorize = () => {
    deauthorizeApp(app.id);
    back(showConfirm ? 2 : 1);
  };

  return (
    <div className="bg-app-surface min-h-full relative flex flex-col">
      <div className="px-6 pt-12 flex flex-col items-start">
        <div className="flex items-center gap-3 mb-6">
          <img
            src={app.icon}
            className="w-12 h-12 rounded-[10px] bg-(--app-c-tw-bg-gray-50) object-cover"
            alt=""
          />
          <div className="flex flex-col">
            <div className="text-(--app-title-text-size-18) font-bold text-app-text">{app.name}</div>
            <div className="text-(--app-chat-time-label-text-size) text-(--app-c-tw-text-gray-400) bg-(--app-c-tw-bg-gray-100) px-1 rounded-[2px] self-start mt-0.5">
              {app.type}
            </div>
          </div>
        </div>

        <h3 className="text-(--app-title-text-size-18) font-bold text-app-text mb-8">{t.auth_detail_title}</h3>

        <div className="w-full space-y-0.5">
          {app.permissions.includes('昵称和头像') && (
            <div className="flex items-center py-4 border-t border-(--app-c-tw-border-gray-100)">
              <div className="w-10 flex items-center justify-center mr-2">
                <IcUser size={dimens.icSizeCheck} className="text-app-text" />
              </div>
              <span className="text-(--app-settings-item-text-size) text-app-text">{t.auth_permission_nickname_avatar}</span>
            </div>
          )}
          {app.permissions.includes('朋友关系') && (
            <div className="flex items-center py-4 border-t border-(--app-c-tw-border-gray-100)">
              <div className="w-10 flex items-center justify-center mr-2">
                <IcContacts size={dimens.icSizeCheck} className="text-app-text" />
              </div>
              <span className="text-(--app-settings-item-text-size) text-app-text">{t.auth_permission_friends}</span>
            </div>
          )}
          <div className="border-t border-(--app-c-tw-border-gray-100)"></div>
        </div>
      </div>

      <div className="mt-auto mb-16 flex justify-center w-full px-6">
        <button
          {...(id
            ? bindTap<HTMLButtonElement>('settings.privacy.authorization.menu.confirm.open', {
                params: { id },
              })
            : {})}
          className="w-full bg-(--app-c-me-avatar-bg) text-(--app-c-common-red) py-3 rounded-[8px] font-bold text-(--app-settings-item-text-size) active:bg-(--app-c-tw-bg-gray-200)"
        >
          {t.auth_deauthorize}
        </button>
      </div>

      {showConfirm && (
        <div className="absolute inset-0 z-[200] flex flex-col justify-end">
          <div
            {...bindBack<HTMLDivElement>({ stopPropagation: true })}
            className="absolute inset-0 bg-black/50"
            style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
          ></div>
          <div className="relative bg-(--app-c-chat-input-bar-bg) rounded-t-[12px] overflow-hidden animate-slide-up w-full">
            <div className="bg-app-surface px-6 py-8 text-center border-b border-(--app-c-tw-border-gray-100)">
              <p className="text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400) leading-relaxed">
                {confirmMessage}
              </p>
            </div>
            <button
              {...(id
                ? bindTap<HTMLButtonElement>(
                    { kind: 'action', id: 'settings.privacy.authorization.menu.confirm.submit' },
                    { params: { id }, onTrigger: handleDeauthorize },
                  )
                : { onClick: handleDeauthorize })}
              className="w-full bg-app-surface h-16 flex items-center justify-center text-(--app-c-common-red) text-(--app-settings-item-text-size) active:bg-(--app-c-tw-bg-gray-50) border-b border-(--app-c-tw-border-gray-100)"
            >
              {t.auth_deauthorize}
            </button>
            <div className="h-2 bg-(--app-c-chat-input-bar-bg)"></div>
            <button
              {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
              className="w-full bg-app-surface h-16 flex items-center justify-center text-app-text text-(--app-settings-item-text-size) font-medium active:bg-(--app-c-tw-bg-gray-50)"
            >
              {t.common_cancel}
            </button>
            <div className="h-6 bg-app-surface"></div>
          </div>
        </div>
      )}
    </div>
  );
};
