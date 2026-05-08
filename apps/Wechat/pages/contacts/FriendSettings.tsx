
import React from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useLocation, useParams } from 'react-router-dom';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsToggle, SettingsItem } from '../settings/Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const FriendSettingsPage: React.FC = () => {
  const t = useWechatStrings();
  const { id } = useParams<{ id: string }>();
  const { contacts, updateContactState } = useWechatStore(
    useShallow(s => ({
      contacts: s.contacts,
      updateContactState: s.updateContactState,
    })),
  );
  const location = useLocation();
  const { bindTap, bindBack, go, back } = useWechatGestures();
  const searchParams = new URLSearchParams(location.search);
  const showBlacklistModal = searchParams.get('menu') === 'blacklistConfirm';

  const contact = contacts.find(c => c.wxid === id);

  if (!contact) {
    return (
      <div className="bg-app-bg min-h-screen pt-20 text-center text-(--app-c-tw-text-gray-400)">{t.friend_settings_not_found}</div>
    );
  }

  const handleToggleStar = () => {
    if (!id) return;
    updateContactState(id, { isStarred: !contact.isStarred });
  };

  const removeFromBlacklist = () => {
    if (!id) return;
    updateContactState(id, { isBlacklisted: false });
  };

  const openBlacklistConfirm = () => {
    if (!id) return;
    go('friendSettings.menu.blacklistConfirm.open', { id });
  };

  const confirmBlacklist = () => {
    if (!id) return;
    updateContactState(id, { isBlacklisted: true });
    back();
  };

  return (
    <div className="bg-app-bg min-h-full pb-10 relative">
      <div className="bg-app-surface mb-2">
        <SettingsItem
          label={t.friend_settings_edit_info}
          tapProps={id ? bindTap<HTMLDivElement>('friendInfo.open', { params: { id } }) : undefined}
        />
        <SettingsItem
          label={t.discover_friend_permission}
          tapProps={id ? bindTap<HTMLDivElement>('friendPermissionsDetail.open', { params: { id } }) : undefined}
          isLast
        />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsItem label={t.friend_settings_recommend} />
        <SettingsItem label={t.friend_settings_add_home} isLast />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsToggle
          label={t.friend_settings_star}
          isOn={contact.isStarred || false}
          onToggle={handleToggleStar}
          actionProps={
            id
              ? bindTap<HTMLDivElement>(
                  { kind: 'action', id: 'friendSettings.item.star.toggle' },
                  { params: { id }, onTrigger: handleToggleStar },
                )
              : undefined
          }
          isLast
        />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsToggle
          label={t.friend_settings_blacklist}
          isOn={contact.isBlacklisted || false}
          onToggle={contact.isBlacklisted ? removeFromBlacklist : openBlacklistConfirm}
          actionProps={
            id
              ? contact.isBlacklisted
                ? bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'friendSettings.item.blacklist.toggle' },
                    { params: { id }, onTrigger: removeFromBlacklist },
                  )
                : bindTap<HTMLDivElement>('friendSettings.menu.blacklistConfirm.open', {
                    params: { id },
                  })
              : undefined
          }
          isLast
        />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsItem label={t.chat_complaint} isLast />
      </div>

      <div className="mt-2 bg-app-surface h-(--app-settings-item-height) flex items-center justify-center text-(--app-c-common-red) text-(--app-settings-item-text-size) font-medium active:bg-(--app-c-tw-bg-gray-50) cursor-pointer">
        {t.common_delete}
      </div>

      {showBlacklistModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-8">
          <div className="absolute inset-0 bg-black/50"></div>

          <div className="relative bg-app-surface w-full max-w-(--app-card-width-320) rounded-[12px] overflow-hidden flex flex-col shadow-2xl animate-fade-in">
            <div className="px-6 pt-8 pb-6 flex flex-col items-center">
              <h3 className="text-(--app-title-text-size-18) font-bold text-app-text text-center mb-3">{t.friend_settings_blacklist_title}</h3>
              <p className="text-(--app-chat-bubble-text-size) text-(--app-c-settings-item-extra-text) text-center leading-[1.6] px-2">
                {t.friend_settings_blacklist_desc}
              </p>
            </div>

            <div className="border-t border-(--app-c-tw-border-gray-100) flex h-(--app-settings-item-height)">
              <button
                {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
                className="flex-1 text-(--app-settings-item-text-size) font-bold text-app-text active:bg-(--app-c-tw-bg-gray-50) border-r border-(--app-c-tw-border-gray-100)"
              >
                {t.common_cancel}
              </button>
              <button
                {...(id
                  ? bindTap<HTMLButtonElement>(
                      { kind: 'action', id: 'friendSettings.menu.blacklistConfirm.submit' },
                      {
                        params: { id },
                        onTrigger: confirmBlacklist,
                        stopPropagation: true,
                      },
                    )
                  : { onClick: confirmBlacklist })}
                className="flex-1 text-(--app-settings-item-text-size) font-bold text-(--app-c-address-link-text) active:bg-(--app-c-tw-bg-gray-50)"
              >
                {t.common_confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
