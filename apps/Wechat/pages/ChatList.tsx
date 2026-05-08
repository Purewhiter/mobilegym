
import React, { useMemo } from 'react';
import { dimens } from '../res/dimens';
import { IcBellOff } from '../res/icons';
import { useWechatStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { ChatSession } from '../types';
import * as TimeService from '../../../os/TimeService';
import { useWechatGestures } from '../hooks/useWechatGestures';
import { useWechatStrings } from '../hooks/useWechatStrings';

const ChatList: React.FC = () => {
  const { bindTap } = useWechatGestures();
  const t = useWechatStrings();
  const { chats, contacts } = useWechatStore(useShallow(s => ({
    chats: s.chats,
    contacts: s.contacts,
  })));

  const sortedChats = useMemo(() => {
    return chats
      .filter(chat => {
        const partner = contacts.find(c => c.wxid === chat.id);
        return partner ? !partner.isBlacklisted : true;
      })
      .sort((a, b) => {
        if (a.isSticky && !b.isSticky) return -1;
        if (!a.isSticky && b.isSticky) return 1;

        const aTime = a.messages && a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp : 0;
        const bTime = b.messages && b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp : 0;
        return bTime - aTime;
      });
  }, [chats, contacts]);

  const getChatPreview = (chat: ChatSession) => {
    if (!chat.messages || chat.messages.length === 0) return "";

    const contentMsgs = chat.messages.filter(m => m.type !== 'time');
    const lastMsg = contentMsgs[contentMsgs.length - 1];

    if (!lastMsg) return "";

    if (lastMsg.type === 'image') return t.chat_image_placeholder;
    if (lastMsg.type === 'file') return t.chat_file_placeholder;

    return lastMsg.content;
  };

  const getChatTime = (chat: ChatSession) => {
    if (!chat.messages || chat.messages.length === 0) return "";

    const lastMsg = chat.messages[chat.messages.length - 1];
    const date = TimeService.fromTimestamp(lastMsg.timestamp);
    const now = TimeService.getDate();

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (isSameDay(date, now)) {
      const hours = date.getHours().toString().padStart(2, '0');
      const mins = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${mins}`;
    }

    const yesterday = TimeService.fromTimestamp(now.getTime());
    yesterday.setDate(now.getDate() - 1);
    if (isSameDay(date, yesterday)) {
      return t.time_yesterday;
    }

    if (date.getFullYear() === now.getFullYear()) {
      return t.chat_list_date_format_month_day
        .replace('{{m}}', String(date.getMonth() + 1))
        .replace('{{d}}', String(date.getDate()));
    } else {
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  return (
    <div className="bg-app-surface min-h-full pb-16">
      {sortedChats.map((chat) => (
        <div
          key={chat.id}
          {...bindTap<HTMLDivElement>('chat.open', { params: { id: chat.id } })}
          className={`flex items-center px-4 py-3 active:bg-(--app-c-chat-list-item-bg-active) border-b border-gray-100/50 ${chat.isSticky ? '' : 'bg-app-surface'}`}
          style={chat.isSticky ? { backgroundColor: 'var(--app-c-chat-list-item-bg-sticky)' } : undefined}
        >
          <div className="relative">
            <img
              src={chat.user.avatar}
              alt={chat.user.name}
              className="w-(--app-chat-list-item-avatar-size) h-(--app-chat-list-item-avatar-size) rounded-[6px] object-cover bg-(--app-c-tw-bg-gray-50)"
              loading="lazy"
            />
          </div>
          <div className="flex-1 ml-3 min-w-0">
            <div className="flex justify-between items-center mb-0.5">
              <h3 className="text-(--app-settings-item-text-size) font-normal truncate" style={{ color: 'var(--app-c-chat-list-item-name)' }}>{chat.user.name}</h3>
              <span className="text-(--app-chat-list-item-time-size) text-(--app-c-tw-text-gray-400)">{getChatTime(chat)}</span>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400) truncate pr-4">{getChatPreview(chat)}</p>
              <div className="flex items-center gap-1">
                {chat.isAlert && <div className="w-2 h-2 rounded-full bg-red-500 mr-1" />}
                {chat.isMuted && <IcBellOff size={dimens.icSizeXs} className="text-(--app-c-tw-text-gray-300) flex-shrink-0" />}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatList;
