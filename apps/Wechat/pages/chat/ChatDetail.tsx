import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useParams, useLocation } from 'react-router-dom';
import {
  IcAudioLines, IcSmile, IcAddCircle, IcImage, IcCamera, IcVideo, IcLocation, IcMic, IcGift, IcWallet,
  IcTransfer, IcBookmark, IcUserCircle, IcFile, IcMusic, IcTicket,
} from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { KeyboardService } from '../../../../os/keyboard';
import { SIMULATOR_CONFIG } from '@/os/data';
import { dimens } from '../../res/dimens';
import { realNow } from '../../../../os/TimeService';
import { WechatSmartImage } from '../../components/WechatSmartImage';
import type { Message } from '../../types';
import { resolveChatPeerByWxid } from '../../utils/resolveChatPeer';

const { keyboardHeight } = SIMULATOR_CONFIG.framework;

function formatFileSize(bytes?: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type ChatBubbleProps = {
  msg: Message;
  chatUser?: { avatar: string; wxid: string };
  currentUser?: { avatar: string; wxid: string };
  buildAvatarGestureProps: (wxid: string) => Record<string, unknown>;
  buildImageGestureProps: (msg: Message) => Record<string, unknown>;
  buildFileGestureProps: (msg: Message) => Record<string, unknown>;
};

const ChatBubble = React.memo<ChatBubbleProps>(function ChatBubble({
  msg,
  chatUser,
  currentUser,
  buildAvatarGestureProps,
  buildImageGestureProps,
  buildFileGestureProps,
}) {
  if (msg.type === 'time') {
    return (
      <div key={msg.id} data-message-id={msg.id} className="flex justify-center my-4">
        <span className="text-(--app-chat-time-label-text-size) text-(--app-c-tw-text-gray-400) bg-black/5 px-2 py-0.5 rounded-[4px]">
          {msg.content}
        </span>
      </div>
    );
  }

  if (msg.type === 'system') {
    return (
      <div key={msg.id} data-message-id={msg.id} className="flex justify-center px-8 my-3">
        <span
          className="text-(--app-chat-system-msg-text-size) text-center leading-relaxed font-medium"
          style={{ color: 'var(--app-c-chat-system-msg-text)' }}
        >
          {msg.content}
        </span>
      </div>
    );
  }

  const isMe = Boolean(chatUser && currentUser && msg.senderId === currentUser.wxid);
  const avatar = isMe ? currentUser : chatUser;

  return (
    <div key={msg.id} data-message-id={msg.id} className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && avatar && (
        <img
          src={avatar.avatar}
          className="w-10 h-10 rounded-[4px] mr-3 flex-shrink-0 object-cover bg-app-surface active:opacity-70"
          alt=""
          {...buildAvatarGestureProps(avatar.wxid)}
        />
      )}

      {msg.type === 'image' ? (
        <button
          type="button"
          className="max-w-[40%] rounded-[4px] overflow-hidden shadow-sm active:opacity-90 bg-transparent"
          {...buildImageGestureProps(msg)}
        >
          <WechatSmartImage
            src={msg.content}
            className="block w-auto h-auto max-w-full max-h-[11rem] object-contain"
            alt=""
          />
        </button>
      ) : msg.type === 'file' ? (() => {
        const fileGestureProps = buildFileGestureProps(msg);
        const isClickable = Object.keys(fileGestureProps).length > 0;
        return (
          <button
            type="button"
            {...fileGestureProps}
            className={`relative max-w-[75%] px-3 py-2.5 rounded-[6px] shadow-sm flex items-center gap-3 text-left ${
              isClickable ? 'active:opacity-80 cursor-pointer' : 'cursor-default'
            } ${isMe ? 'bubble-tail-me' : 'bg-app-surface bubble-tail-other'}`}
            style={isMe ? { backgroundColor: 'var(--app-c-chat-bubble-me-bg)' } : undefined}
          >
            <div className="min-w-0 flex-1">
              <div className="text-(--app-chat-bubble-text-size) text-app-text font-medium truncate">
                {msg.fileName || msg.content.split('/').pop() || '文件'}
              </div>
              <div className="text-[11px] text-(--app-c-tw-text-gray-400) mt-0.5">
                {formatFileSize(msg.fileSize)}
              </div>
            </div>
            <div className={`w-10 h-10 shrink-0 rounded flex items-center justify-center ${
              isMe ? 'bg-white/70' : 'bg-(--app-c-search-result-divider)'
            }`}>
              <IcFile size={22} className="text-app-primary" />
            </div>
          </button>
        );
      })() : (
        <div
          className={`relative max-w-[70%] px-3 py-2.5 rounded-[6px] text-(--app-chat-bubble-text-size) leading-[1.5] break-all shadow-sm ${
            isMe ? 'bubble-tail-me' : 'bg-app-surface bubble-tail-other'
          }`}
          style={isMe ? { backgroundColor: 'var(--app-c-chat-bubble-me-bg)' } : undefined}
        >
          <span className="text-app-text">{msg.content}</span>
        </div>
      )}

      {isMe && avatar && (
        <img
          src={avatar.avatar}
          className="w-10 h-10 rounded-[4px] ml-3 flex-shrink-0 object-cover bg-app-surface active:opacity-70"
          alt=""
          {...buildAvatarGestureProps(avatar.wxid)}
        />
      )}
    </div>
  );
});

export const ChatDetail: React.FC = () => {
  const t = useWechatStrings();
  const { id: targetWxid } = useParams<{ id: string }>();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const previewMessageId = searchParams.get('view') === 'preview' ? searchParams.get('preview') : null;
  const { user, chats, contacts, sendMessage, sendPat } = useWechatStore(useShallow(s => ({
    user: s.user,
    chats: s.chats,
    contacts: s.contacts,
    sendMessage: s.sendMessage,
    sendPat: s.sendPat,
  })));
  const { bindDoubleTap, bindTap, bindBack, go } = useWechatGestures();

  const chat = useMemo(() => {
    if (!targetWxid) return null;
    const found = chats.find(c => c.id === targetWxid);
    if (found) return found;

    const peer = resolveChatPeerByWxid(targetWxid, contacts);
    if (peer) {
      return { id: peer.wxid, user: peer, messages: [] };
    }
    return null;
  }, [chats, contacts, targetWxid]);

  const previewMessage = useMemo(() => {
    if (!previewMessageId || !chat?.messages?.length) return null;
    return chat.messages.find(message => {
      if (message.id !== previewMessageId) return false;
      if (message.type === 'image') return true;
      if (message.type === 'file' && message.mimeType?.startsWith('image/')) return true;
      return false;
    }) ?? null;
  }, [chat?.messages, previewMessageId]);

  const [inputValue, setInputValue] = useState('');
  const [showChatPlusMenu, setShowChatPlusMenu] = useState(false);
  const [chatPlusMenuPage, setChatPlusMenuPage] = useState(0);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const panelTapStartRef = React.useRef<{ y: number; t: number } | null>(null);
  const panelScrollRef = React.useRef<HTMLDivElement>(null);

  const chatPlusMenuPages: { label: string; icon: React.ReactNode }[][] = [
    [
      { label: t.chat_album, icon: <IcImage size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: t.moments_shoot, icon: <IcCamera size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: t.chat_video_call, icon: <IcVideo size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: t.chat_location, icon: <IcLocation size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: t.chat_red_packet, icon: <IcWallet size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: t.chat_gift, icon: <IcGift size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: t.chat_transfer, icon: <IcTransfer size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: t.chat_voice_input, icon: <IcMic size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
    ],
    [
      { label: t.me_favorites, icon: <IcBookmark size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: '个人名片', icon: <IcUserCircle size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: t.chat_file, icon: <IcFile size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: t.chat_music, icon: <IcMusic size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
      { label: '卡券', icon: <IcTicket size={dimens.chat_plus_icon_size} style={{ color: 'var(--app-c-chat-plus-icon-color)' }} strokeWidth={1.8} /> },
    ],
  ];

  const scrollToBottom = (instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
  };

  useLayoutEffect(() => {
    const scrollToMessageId = (location.state as { scrollToMessageId?: string } | null)?.scrollToMessageId;
    if (scrollToMessageId && chat?.messages?.length) {
      const el = document.querySelector(`[data-message-id="${scrollToMessageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
        window.history.replaceState({}, '', location.pathname);
        return;
      }
    }
    scrollToBottom(true);
  }, [chat?.messages, location.pathname, location.state]);

  useEffect(() => {
    let wasVisible = false;
    return KeyboardService.subscribe(() => {
      const nowVisible = KeyboardService.isVisible();
      if (nowVisible && !wasVisible) {
        setTimeout(() => scrollToBottom(true), 50);
      }
      wasVisible = nowVisible;
    });
  }, []);

  useEffect(() => {
    if (showChatPlusMenu) {
      const timer = setTimeout(() => scrollToBottom(true), 50);
      return () => clearTimeout(timer);
    }
  }, [showChatPlusMenu]);

  useEffect(() => {
    if (!showChatPlusMenu) return;
    const id = requestAnimationFrame(() => {
      const el = panelScrollRef.current;
      if (!el) return;
      el.scrollLeft = chatPlusMenuPage * el.clientWidth;
    });
    return () => cancelAnimationFrame(id);
  }, [chatPlusMenuPage, showChatPlusMenu]);

  const handleSend = () => {
    if (!inputValue.trim() || !targetWxid) return;
    sendMessage(targetWxid, inputValue);
    setInputValue('');
    requestAnimationFrame(() => {
      try {
        inputRef.current?.focus({ preventScroll: true } as any);
      } catch {
        inputRef.current?.focus();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const buildAvatarGestureProps = useCallback((wxid: string) => {
    const userProfileTriggerProps = bindTap<HTMLImageElement>('userProfile.open', {
      params: { id: wxid },
    });

    const patActionProps = bindDoubleTap<HTMLImageElement>(
      { kind: 'action', id: 'chat.pat.send' },
      {
        params: targetWxid ? { id: targetWxid } : undefined,
        onTrigger: () => {
          if (targetWxid) {
            sendPat(targetWxid);
          }
        },
        onSingleTap: () => go('userProfile.open', { id: wxid }),
      },
    );

    return { ...userProfileTriggerProps, ...patActionProps };
  }, [bindDoubleTap, bindTap, go, sendPat, targetWxid]);

  const buildImageGestureProps = useCallback((msg: Message) => {
    if (!targetWxid) return {};
    return bindTap<HTMLButtonElement>('chat.imagePreview.open', {
      params: { id: targetWxid, preview: msg.id },
    });
  }, [bindTap, targetWxid]);

  const buildFileGestureProps = useCallback((msg: Message) => {
    if (!targetWxid) return {};
    const isImage = msg.mimeType?.startsWith('image/');
    if (!isImage) return {};
    return bindTap<HTMLButtonElement>('chat.imagePreview.open', {
      params: { id: targetWxid, preview: msg.id },
    });
  }, [bindTap, targetWxid]);

  if (!chat) {
    return <div className="min-h-screen bg-app-bg pt-20 text-center text-(--app-c-tw-text-gray-400)">未找到联系人</div>;
  }

  const bottomPanelHeight = keyboardHeight;

  return (
    <div
      className="relative flex flex-col h-full bg-app-bg overscroll-y-none"
      data-status-bar-foreground={previewMessage ? 'light' : undefined}
      data-status-bar-hidden={previewMessage ? 'true' : undefined}
      data-navigation-bar-foreground={previewMessage ? 'light' : undefined}
    >
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar"
        onPointerDown={showChatPlusMenu ? (e) => { panelTapStartRef.current = { y: e.clientY, t: realNow() }; } : undefined}
        onPointerUp={showChatPlusMenu ? (e) => {
          const start = panelTapStartRef.current;
          panelTapStartRef.current = null;
          if (!start) return;
          const dy = Math.abs(e.clientY - start.y);
          const dt = realNow() - start.t;
          if (dy < 8 && dt < 300) setShowChatPlusMenu(false);
        } : undefined}
      >
        {chat.messages?.map((msg) => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            chatUser={msg.type !== 'time' && msg.type !== 'system' ? chat.user : undefined}
            currentUser={msg.type !== 'time' && msg.type !== 'system' ? user : undefined}
            buildAvatarGestureProps={buildAvatarGestureProps}
            buildImageGestureProps={buildImageGestureProps}
            buildFileGestureProps={buildFileGestureProps}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="flex-shrink-0 border-t border-app-border px-3 py-2 flex items-center gap-3"
        style={{ backgroundColor: 'var(--app-c-chat-input-bar-bg)' }}
        data-keep-keyboard="true"
      >
        <IcAudioLines className="w-7 h-7 stroke-[1.5] active:opacity-50" style={{ color: 'var(--app-c-settings-item-text)' }} />
        <div className="flex-1">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowChatPlusMenu(false)}
            className="w-full bg-app-surface rounded-[6px] px-3 py-2 text-(--app-chat-bubble-text-size) focus:outline-none min-h-(--app-card-height-40) max-h-(--app-card-height-120) shadow-sm resize-none"
            style={{ lineHeight: '24px' }}
          />
        </div>
        <IcSmile className="w-7 h-7 stroke-[1.5] active:opacity-50" style={{ color: 'var(--app-c-settings-item-text)' }} />
        {inputValue.length > 0 ? (
          <button
            type="button"
            data-keep-keyboard="true"
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onPointerDown={(e) => {
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="bg-app-primary text-white px-3 h-9 rounded-[4px] text-(--app-search-filter-text-size) font-medium active:opacity-80"
            style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
          >
            {t.chat_send}
          </button>
        ) : (
          <button
            type="button"
            className="p-0 border-0 bg-transparent cursor-pointer flex items-center justify-center"
            onClick={() => {
              KeyboardService.hide();
              inputRef.current?.blur();
              setShowChatPlusMenu((v) => !v);
            }}
          >
            <IcAddCircle className="w-7 h-7 stroke-[1.5] active:opacity-50" style={{ color: 'var(--app-c-settings-item-text)' }} />
          </button>
        )}
      </div>

      {showChatPlusMenu && (
        <div
          className="flex-shrink-0 bg-(--app-c-search-result-divider) border-t border-app-border/80 flex flex-col"
          style={{ height: bottomPanelHeight }}
        >
          <div
            ref={panelScrollRef}
            className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onScroll={() => {
              const el = panelScrollRef.current;
              if (!el) return;
              const w = el.clientWidth;
              const page = Math.round(el.scrollLeft / w);
              setChatPlusMenuPage((p) => (p !== page ? page : p));
            }}
          >
            <div className="flex h-full" style={{ width: `${chatPlusMenuPages.length * 100}%` }}>
              {chatPlusMenuPages.map((pageItems, pageIndex) => (
                <div
                  key={pageIndex}
                  className="flex-shrink-0 snap-start flex flex-col pt-4 pb-3 px-2"
                  style={{ flexBasis: `${100 / chatPlusMenuPages.length}%` }}
                >
                  <div className="flex-1 grid grid-cols-4 gap-2 content-start">
                    {pageItems.map((item, i) => {
                      const isAlbumEntry = pageIndex === 0 && i === 0 && Boolean(targetWxid);
                      const isFileEntry = pageIndex === 1 && i === 2 && Boolean(targetWxid);
                      let entryProps: Record<string, any> = {};
                      if (isAlbumEntry && targetWxid) {
                        entryProps = bindTap<HTMLButtonElement>('chat.mediaPicker.open', {
                          params: { id: targetWxid, albumId: 'all' },
                        });
                      } else if (isFileEntry && targetWxid) {
                        entryProps = bindTap<HTMLButtonElement>('chat.selectFile.open', {
                          params: { id: targetWxid },
                        });
                      }

                      return (
                        <button
                          key={i}
                          type="button"
                          className="flex flex-col items-center justify-center gap-2 py-2 active:opacity-70"
                          {...entryProps}
                        >
                          <div className="w-12 h-12 rounded-xl bg-app-surface flex items-center justify-center shadow-sm border border-(--app-c-tw-border-gray-100)">
                            {item.icon}
                          </div>
                          <span className="text-(--app-chat-system-msg-text-size)" style={{ color: 'var(--app-c-chat-plus-icon-color)' }}>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center gap-1.5 py-2 shrink-0">
            {[0, 1].map((p) => (
              <button
                key={p}
                type="button"
                className="w-2 h-2 rounded-full"
                style={{
                  transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)',
                  backgroundColor: p === chatPlusMenuPage ? '#8e8e93' : '#c7c7cc',
                }}
                onClick={() => {
                  const el = panelScrollRef.current;
                  if (el) el.scrollTo({ left: p * el.clientWidth, behavior: 'smooth' });
                  setChatPlusMenuPage(p);
                }}
                aria-label={p === 0 ? '第一页' : '第二页'}
              />
            ))}
          </div>
        </div>
      )}

      {previewMessage && (
        <div
          {...bindBack<HTMLDivElement>({ stopPropagation: true })}
          className="fixed inset-0 z-[220] bg-black flex items-center justify-center"
          data-status-bar-foreground="light"
          data-status-bar-hidden="true"
          data-navigation-bar-foreground="light"
        >
          <WechatSmartImage
            src={previewMessage.content}
            className="max-w-full max-h-full object-contain"
            alt=""
          />
        </div>
      )}
    </div>
  );
};
