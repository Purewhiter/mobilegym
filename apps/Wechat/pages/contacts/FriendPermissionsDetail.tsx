
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useParams } from 'react-router-dom';
import { IcCheck } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsToggle } from '../settings/Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const FriendPermissionsDetailPage: React.FC = () => {
  const t = useWechatStrings();
  const { id } = useParams<{ id: string }>();
  const { contacts, updateContactState } = useWechatStore(
    useShallow(s => ({
      contacts: s.contacts,
      updateContactState: s.updateContactState,
    })),
  );
  const { bindTap } = useWechatGestures();

  const contact = contacts.find(c => c.wxid === id);

  if (!contact) {
    return (
      <div className="bg-app-bg min-h-screen pt-20 text-center text-(--app-c-tw-text-gray-400)">{t.friend_not_found}</div>
    );
  }

  const mode = contact.permissionMode || 'all';

  const setMode = (newMode: 'all' | 'chatOnly') => {
    if (!id) return;
    updateContactState(id, { permissionMode: newMode });
  };

  const handleToggleHideMy = () => {
    if (!id) return;
    updateContactState(id, { hideMyMoments: !contact.hideMyMoments });
  };

  const handleToggleHideTheir = () => {
    if (!id) return;
    updateContactState(id, { hideTheirMoments: !contact.hideTheirMoments });
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="px-4 py-2.5 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) bg-app-bg font-normal">
      {title}
    </div>
  );

  return (
    <div className="bg-app-bg min-h-full pb-10">
      <SectionHeader title={t.friend_perm_section_title} />
      <div className="bg-app-surface">
        <div
          {...bindTap<HTMLDivElement>(
            { kind: 'action', id: 'friendPermissionsDetail.permissionMode.select.all' },
            { params: { id: id! }, onTrigger: () => setMode('all') },
          )}
          className="flex min-h-(--app-settings-item-height) justify-between items-center px-4 py-3 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer border-b border-(--app-c-tw-border-gray-100)"
        >
          <span className="pr-3 text-(--app-settings-item-text-size) leading-tight text-app-text break-words [overflow-wrap:anywhere]">
            {t.friend_permission_chat_all}
          </span>
          {mode === 'all' && <IcCheck size={dimens.icSizeCheck} className="text-app-primary" strokeWidth={2.5} />}
        </div>
        <div
          {...bindTap<HTMLDivElement>(
            { kind: 'action', id: 'friendPermissionsDetail.permissionMode.select.chatOnly' },
            { params: { id: id! }, onTrigger: () => setMode('chatOnly') },
          )}
          className="flex min-h-(--app-settings-item-height) justify-between items-center px-4 py-3 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer"
        >
          <span className="pr-3 text-(--app-settings-item-text-size) leading-tight text-app-text break-words [overflow-wrap:anywhere]">
            {t.chat_only}
          </span>
          {mode === 'chatOnly' && <IcCheck size={dimens.icSizeCheck} className="text-app-primary" strokeWidth={2.5} />}
        </div>
      </div>

      {mode === 'chatOnly' ? (
        <div className="px-4 py-2 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400)">
          {t.friend_perm_chat_only_hint}
        </div>
      ) : (
        <>
          <SectionHeader title={t.friend_perm_moments_status} />
          <div className="bg-app-surface">
            <SettingsToggle
              label={t.friend_perm_hide_my_moments}
              isOn={!!contact.hideMyMoments}
              onToggle={handleToggleHideMy}
              actionProps={
                id
                  ? bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'friendPermissionsDetail.item.hideMyMoments.toggle' },
                      { params: { id }, onTrigger: handleToggleHideMy },
                    )
                  : undefined
              }
            />
            <SettingsToggle
              label={t.friend_perm_hide_their_moments}
              isOn={!!contact.hideTheirMoments}
              onToggle={handleToggleHideTheir}
              actionProps={
                id
                  ? bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'friendPermissionsDetail.item.hideTheirMoments.toggle' },
                      { params: { id }, onTrigger: handleToggleHideTheir },
                    )
                  : undefined
              }
              isLast
            />
          </div>
        </>
      )}
    </div>
  );
};
