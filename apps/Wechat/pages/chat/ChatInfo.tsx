
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useParams } from 'react-router-dom';
import { IcAdd, IcNavForward } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsToggle, SettingsItem } from '../settings/Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const ChatInfo: React.FC = () => {
  const t = useWechatStrings();
    const { id } = useParams<{ id: string }>();
    const { chats, contacts, updateChatSettings } = useWechatStore(useShallow(s => ({
        chats: s.chats,
        contacts: s.contacts,
        updateChatSettings: s.updateChatSettings,
    })));
    const { bindTap } = useWechatGestures();

    const chat = chats.find(c => c.id === id);
    const contact = contacts.find(c => c.wxid === id) || (chat ? chat.user : null);

    if (!contact) return <div className="bg-app-bg min-h-screen pt-20 text-center text-(--app-c-tw-text-gray-400)">{t.chat_info_not_found}</div>;

    const handleToggleMuted = () => {
        if (!id) return;
        updateChatSettings(id, { isMuted: !chat?.isMuted });
    };

    const handleToggleSticky = () => {
        if (!id) return;
        updateChatSettings(id, { isSticky: !chat?.isSticky });
    };

    const handleToggleAlert = () => {
        if (!id) return;
        updateChatSettings(id, { isAlert: !chat?.isAlert });
    };

    return (
        <div className="bg-app-bg min-h-full pb-10">
            {/* Members Section */}
            <div className="bg-app-surface px-4 pt-4 pb-6 mb-2 grid grid-cols-5 gap-y-4">
                <div 
                    className="flex flex-col items-center gap-1 active:opacity-60 cursor-pointer"
                    {...bindTap<HTMLDivElement>('userProfile.open', { params: { id: contact.wxid } })}
                >
                    <img src={contact.avatar} className="w-(--app-avatar-width-52) h-(--app-item-height-52) rounded-[6px] object-cover bg-(--app-c-tw-bg-gray-100)" alt="" />
                    <span className="text-(--app-chat-time-label-text-size) text-(--app-c-tw-text-gray-400) truncate w-full text-center">{contact.name}</span>
                </div>
                
                <div className="flex flex-col items-center gap-1 active:opacity-60 cursor-pointer">
                    <div className="w-(--app-avatar-width-52) h-(--app-item-height-52) rounded-[6px] border-[1px] border-dashed border-(--app-c-tw-border-gray-300) flex items-center justify-center">
                        <IcAdd size={dimens.icSizeNav} className="text-(--app-c-tw-text-gray-300)" strokeWidth={1} />
                    </div>
                    <div className="h-(--app-chat-chat-info-height-18)"></div>
                </div>
            </div>

            {/* Menu Sections */}
            <div className="bg-app-surface mb-2">
                <SettingsItem
                label={t.chat_info_search_history}
                tapProps={id ? bindTap<HTMLDivElement>('chatInfo.chatSearch.open', { params: { id } }) : undefined}
              />
            </div>

            <div className="bg-app-surface mb-2">
                <SettingsToggle
                  label={t.chat_info_mute_notifications}
                  isOn={chat?.isMuted || false}
                  onToggle={handleToggleMuted}
                  actionProps={id ? bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'chatInfo.item.muted.toggle' },
                    { params: { id }, onTrigger: handleToggleMuted },
                  ) : undefined}
                />
                <SettingsToggle
                  label={t.chat_info_pin_chat}
                  isOn={chat?.isSticky || false}
                  onToggle={handleToggleSticky}
                  actionProps={id ? bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'chatInfo.item.sticky.toggle' },
                    { params: { id }, onTrigger: handleToggleSticky },
                  ) : undefined}
                />
                <SettingsToggle
                  label={t.chat_info_alerts}
                  isOn={chat?.isAlert || false}
                  onToggle={handleToggleAlert}
                  actionProps={id ? bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'chatInfo.item.alert.toggle' },
                    { params: { id }, onTrigger: handleToggleAlert },
                  ) : undefined}
                  isLast
                />
            </div>

            <div className="bg-app-surface mb-2">
                <SettingsItem label={t.chat_info_set_background} onClick={() => {}} isLast />
            </div>

            <div className="bg-app-surface mb-2">
                <SettingsItem label={t.chat_info_clear_history} onClick={() => {}} isLast />
            </div>

            <div className="bg-app-surface mb-2">
                <SettingsItem label={t.chat_complaint} onClick={() => {}} isLast />
            </div>
        </div>
    );
};
