import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, memo } from 'react';
import * as TimeService from '@/os/TimeService';
import { useParams } from 'react-router-dom';
import { IcNavBack, IcMore, IcRefresh } from '../res/icons';
const ChevronLeft = IcNavBack, MoreHorizontal = IcMore, RotateCcw = IcRefresh;
import { useRedBookStore } from '../state';
import { useRedBookView } from '../data/view';
import { useShallow } from 'zustand/react/shallow';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import { KeyboardService } from '../../../os/keyboard/KeyboardService';
import { useLocale } from '@/apps/RedBook/locale';

// Import assets
import voiceIcon from '../assets/chat/voice.png';
import emojiIcon from '../assets/chat/emoji.png';
import moreIcon from '../assets/chat/more.png';

type DisplayMessage = {
  id: string;
  text: string;
  isMe: boolean;
  time: string;
  type: 'text' | 'note';
  noteData?: { image: string; title: string; authorAvatar: string; author: string };
};

type MessageItemProps = {
  msg: DisplayMessage;
  targetUserAvatar: string;
  userAvatar: string;
};

const MessageItem = memo<MessageItemProps>(function MessageItem({ msg, targetUserAvatar, userAvatar }) {
  return (
    <div className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} items-start gap-2 relative`}>
      {!msg.isMe && (
        <img src={targetUserAvatar} className="w-9 h-9 rounded-full object-cover bg-gray-200 flex-shrink-0" />
      )}
      {!msg.isMe && msg.type === 'note' && (
        <div className="absolute left-[-30px] top-[50%] -translate-y-1/2">
          <div className="w-5 h-5 rounded-full bg-app-primary flex items-center justify-center shadow-sm">
            <RotateCcw size={12} className="text-white" />
          </div>
        </div>
      )}
      {msg.type === 'note' && msg.noteData ? (
        <div className="max-w-[240px] bg-[#f5f5f5] rounded-[12px] overflow-hidden shadow-sm border border-gray-50">
          <div className="relative aspect-[4/5] w-full">
            <img src={msg.noteData.image} className="w-full h-full object-cover" />
          </div>
          <div className="p-3 bg-[#f8f8f8]">
            <div className="text-[14px] text-app-text font-medium leading-snug mb-2 line-clamp-2">
              {msg.noteData.title}
            </div>
            <div className="flex items-center gap-1.5">
              <img src={msg.noteData.authorAvatar} className="w-4 h-4 rounded-full object-cover" />
              <span className="text-[11px] text-[#666]">{msg.noteData.author}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={`max-w-[70%] px-4 py-2.5 rounded-[16px] text-[15px] leading-relaxed ${
          msg.isMe
            ? 'bg-app-primary text-white rounded-br-sm'
            : 'bg-app-surface text-app-text border border-gray-100 rounded-bl-sm'
        }`}>
          {msg.text}
        </div>
      )}
      {msg.type === 'note' && (
        <div className="absolute right-[-45px] top-0">
          <div className="w-10 h-10 rounded-full bg-app-surface border border-gray-100 flex items-center justify-center shadow-sm">
            <span className="text-xl">🍕</span>
          </div>
        </div>
      )}
      {msg.isMe && (
        <img src={userAvatar} className="w-9 h-9 rounded-full object-cover bg-gray-200 flex-shrink-0" />
      )}
    </div>
  );
});

export const ChatPage: React.FC = () => {
  const s = useRedBookStrings();
  const locale = useLocale();
  const { userId } = useParams<{ userId: string }>();
  const { user, sendMessage, chats } = useRedBookStore(useShallow(s => ({
    user: s.user,
    sendMessage: s.sendMessage,
    chats: s.chats,
  })));
  const view = useRedBookView();
  const { bindTap, bindBack } = useRedBookGestures();
  const targetUser = userId ? (userId === user.id ? user : view.usersById[userId]) : undefined;
  
  // Find existing chat or start empty
  const currentChat = chats.find(c => c.userId === userId);
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
  };

  useLayoutEffect(() => {
    scrollToBottom(true);

  }, [currentChat?.messages]);

  useEffect(() => {
    return KeyboardService.subscribe(() => {
      if (KeyboardService.isVisible()) {
        setTimeout(() => scrollToBottom(true), 50);
      }
    });
  }, []);

  const handleSend = () => {
      if (!input.trim() || !userId) return;
      sendMessage(userId, input);
      setInput('');
      requestAnimationFrame(() => {
        try {
          inputRef.current?.focus({ preventScroll: true } as any);
        } catch {
          inputRef.current?.focus();
        }
      });
  };

  const displayMessages = useMemo(() => (currentChat?.messages || []).map(msg => ({
      id: msg.id,
      text: msg.content,
      isMe: msg.senderId === user.id,
      time: TimeService.fromTimestamp(msg.timestamp).toLocaleTimeString(locale === 'en' ? 'en-US' : undefined, { hour: '2-digit', minute: '2-digit' }),
      type: msg.type as 'text' | 'note',
      noteData: undefined as { image: string; title: string; authorAvatar: string; author: string } | undefined
  })), [currentChat?.messages, user.id]);

  if (!targetUser) return <div className="h-full flex items-center justify-center">{s.user_not_found}</div>;

  return (
    <div className="h-full flex flex-col bg-app-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-3 bg-app-surface border-b border-gray-100 flex-shrink-0 z-10 sticky top-0 pt-10 pb-2">
          <div className="flex items-center gap-2">
              <div className="-ml-1 cursor-pointer" {...bindBack()}>
                <ChevronLeft size={28} className="text-app-text" strokeWidth={1.5} />
              </div>
              <div className="flex items-center gap-2">
                  <img src={targetUser.avatar} className="w-9 h-9 rounded-full object-cover border border-gray-100" />
                  <span className="text-[16px] font-medium text-app-text ml-1">{targetUser.name}</span>
              </div>
          </div>
          <MoreHorizontal
              size={24}
              className="text-app-text cursor-pointer"
              strokeWidth={2}
              {...(bindTap('chat.settings.open', { params: { userId: userId || '' } }) as unknown as Record<string, unknown>)}
          />
      </div>

      {/* Message List */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-6 bg-app-surface"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
          {/* Time Stamp */}
          <div className="flex justify-center mt-2">
              <span className="text-[12px] text-[#ccc]">16:22</span>
          </div>

          {displayMessages.map(msg => (
              <MessageItem
                  key={msg.id}
                  msg={msg}
                  targetUserAvatar={targetUser.avatar}
                  userAvatar={user.avatar}
              />
          ))}
          
          <div ref={messagesEndRef} />
      </div>

      {/* Input Area — flex child, adjustResize handles keyboard offset */}
      <div
        className="flex-shrink-0 bg-app-surface border-t border-gray-100 px-3 py-2 flex items-center gap-3"
        data-keep-keyboard="true"
      >
          <div className="w-8 h-8 flex items-center justify-center">
               <img src={voiceIcon} className="w-7 h-7" alt="voice" />
          </div>
          <div className="flex-1 bg-[#f5f5f5] rounded-full h-[40px] px-4 flex items-center">
              <input
                  ref={inputRef}
                  className="w-full bg-transparent text-[15px] text-app-text outline-none placeholder-gray-400"
                  placeholder={s.message}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
          </div>
          <div className="flex items-center gap-3">
            <img src={emojiIcon} className="w-7 h-7" alt="emoji" />
            {input.trim().length > 0 ? (
              <button
                type="button"
                data-keep-keyboard="true"
                className="h-9 px-3 rounded-[6px] bg-app-primary text-white text-[15px] font-medium active:opacity-80"
                onMouseDown={(e) => {
                  // Keep focus on input so keyboard stays up.
                  e.preventDefault();
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                {s.detailpage_send}
              </button>
            ) : (
              <img src={moreIcon} className="w-7 h-7" alt="more" />
            )}
          </div>
      </div>
    </div>
  );
};
