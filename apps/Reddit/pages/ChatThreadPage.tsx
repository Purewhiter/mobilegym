import React from 'react';
import { IcNavBack, IcMoreVert, IcSend, IcReply, IcCopy, IcShare, IcDelete, IcAdd } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRedditStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { formatChatDateShort, formatChatMessageTime, getChatDayKey } from '../utils/chatTime';
import { getUserAvatar } from '../utils/userIdentity';
import { KeyboardService } from '@/os/keyboard';
import { ClipboardService } from '@/os/clipboard';

type ChatMessage = {
  id: string;
  from: 'me' | 'them';
  body: string;
  created_utc: number;
};

const pickAvatar = (usernameLike: string): string | undefined => getUserAvatar(usernameLike);

function getUsernameFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/chat\/([^/?#]+)/);
  if (!m) return null;
  const u = decodeURIComponent(m[1]);
  if (!u || u === 'new') return null;
  return u;
}

export const ChatThreadPage: React.FC = () => {
  const { chatThreads, chatReplies, user } = useRedditStore(useShallow((s) => ({
    chatThreads: s.chatThreads,
    chatReplies: s.chatReplies,
    user: s.user,
  })));
  const storeSeedChatThread = useRedditStore((s) => s.seedChatThread);
  const storeSendChatMessage = useRedditStore((s) => s.sendChatMessage);
  const storeDeleteChatMessage = useRedditStore((s) => s.deleteChatMessage);
  const { bindBack, bindTap, bindLongPress } = useRedditGestures();
  const location = useLocation();
  const username = getUsernameFromPath(location.pathname);

  const [draft, setDraft] = React.useState('');
  const [longPressMenu, setLongPressMenu] = React.useState<ChatMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<ChatMessage | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToBottom = React.useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
  }, []);

  const thread = React.useMemo(() => {
    if (!username) return [];
    const list = chatThreads[username];
    return Array.isArray(list) ? (list as ChatMessage[]) : [];
  }, [chatThreads, username]);

  // Seed initial message for the demo chats, if empty.
  React.useEffect(() => {
    if (!username) return;
    const existing = chatThreads[username];
    if (Array.isArray(existing) && existing.length > 0) return;

    const seedBody = username === 'Objective-Skill-2591' ? "well,it's so funny" : 'hello';
    storeSeedChatThread(username, seedBody);
  }, [storeSeedChatThread, chatThreads, username]);

  // 消息变化时滚到底部
  React.useLayoutEffect(() => {
    scrollToBottom(true);
  }, [thread]);

  // 键盘弹出时瞬间滚到底部，避免最新消息被遮挡
  React.useEffect(() => {
    let wasVisible = false;
    return KeyboardService.subscribe(() => {
      const nowVisible = KeyboardService.isVisible();
      if (nowVisible && !wasVisible) {
        setTimeout(() => scrollToBottom(true), 50);
      }
      wasVisible = nowVisible;
    });
  }, []);

  const canSend = draft.trim().length > 0 && !!username;

  const closeLongPressMenu = React.useCallback(() => setLongPressMenu(null), []);

  const copyText = React.useCallback((text: string) => {
    ClipboardService.copyText(String(text ?? ''));
  }, []);

  const deleteMessage = React.useCallback((messageId: string) => {
    if (!username) return;
    storeDeleteChatMessage(username, messageId);
  }, [storeDeleteChatMessage, username]);

  const send = React.useCallback(() => {
    if (!username) return;
    const body = draft.trim();
    if (!body) return;
    storeSendChatMessage(username, body);
    setDraft('');
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.overflow = 'hidden';
        inputRef.current.focus();
      }
    });
  }, [draft, storeSendChatMessage, username]);

  const getThreadInfo = React.useCallback(
    (messageId: string): { count: number; lastFrom: 'me' | 'them' } => {
      if (!username) return { count: 0, lastFrom: 'me' };
      const k = `${username}:${messageId}`;
      const list = chatReplies?.[k];
      if (!Array.isArray(list) || list.length === 0) return { count: 0, lastFrom: 'me' };
      const last = list[list.length - 1] as ChatMessage;
      return { count: list.length, lastFrom: last?.from ?? 'me' };
    },
    [chatReplies, username],
  );

  if (!username) {
    return (
      <div className="flex flex-col h-full bg-app-surface">
        <div className="px-4 pt-10">Invalid chat.</div>
      </div>
    );
  }

  const avatarSrc = pickAvatar(username);
  const meName = user.username || 'Embarrassed_Fee8630';
  const myAvatarSrc = user.avatar || pickAvatar(meName);

  return (
    <div className="flex flex-col h-full bg-app-surface">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-2 pt-10 pb-2 border-b border-gray-100">
        <button
          type="button"
          aria-label="Back"
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100"
          {...bindBack()}
        >
          <IcNavBack className="w-6 h-6 text-gray-800" strokeWidth={2} />
        </button>

        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
          <img
            src={avatarSrc}
            className="w-full h-full object-cover"
            alt=""
            draggable={false}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold text-app-text truncate">{username}</div>
        </div>

        <button
          type="button"
          aria-label="More"
          onClick={() => {}}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100"
        >
          <IcMoreVert className="w-6 h-6 text-gray-700" strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar bg-app-surface" data-scroll-container="main" data-scroll-direction="vertical">
        <div className="min-h-full flex flex-col">
          {/* Profile header like screenshot */}
          <div className="pt-8 pb-10 flex flex-col items-center">
            <div className="w-28 h-28 rounded-full bg-gray-200 overflow-hidden">
              <img
                src={avatarSrc}
                className="w-full h-full object-cover"
                alt=""
                draggable={false}
                loading="lazy"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
            <div className="mt-4 text-[18px] font-semibold text-app-text">{username}</div>
            <div className="mt-1 text-[13px] text-app-text-muted">531 karma • redditor for 1y 10m</div>
            <button
              type="button"
              onClick={() => {}}
              className="mt-4 h-10 px-6 rounded-full bg-gray-100 text-app-text font-semibold"
            >
              View profile
            </button>
          </div>

          {/* Message list (stick to bottom when few) */}
          <div className="mt-auto px-4 pb-2">
            {thread.map((m, idx) => {
              const currentKey = getChatDayKey(m.created_utc);
              const prevKey = idx > 0 ? getChatDayKey(thread[idx - 1].created_utc) : null;
              const showDay = idx === 0 || currentKey !== prevKey;
              const threadInfo = getThreadInfo(m.id);
              const replyCount = threadInfo.count;
              const openThreadProps = bindTap('chatThread.message.thread.open', {
                params: { username, messageId: m.id },
              });
              return (
                <React.Fragment key={m.id}>
                  {showDay && (
                    <div className="flex justify-center text-[12px] text-gray-400 mb-4">
                      {formatChatDateShort(m.created_utc)}
                    </div>
                  )}

                  <div
                    className="flex gap-3 mb-4"
                    {...bindLongPress(
                      { kind: 'action', id: 'chatThread.message.longPress.open' },
                      {
                        duration: 600,
                        params: { username, messageId: m.id },
                        onTrigger: () => setLongPressMenu(m),
                      },
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      <img
                        src={m.from === 'me' ? myAvatarSrc : avatarSrc}
                        className="w-full h-full object-cover"
                        alt=""
                        draggable={false}
                        loading="lazy"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                    <div className="min-w-0 flex-1" {...openThreadProps}>
                      <div className="text-[13px] text-gray-600">
                        <span className="font-semibold text-app-text">{m.from === 'me' ? meName : username}</span>{' '}
                        <span className="text-gray-400">{formatChatMessageTime(m.created_utc)}</span>
                      </div>
                      <div className="text-[15px] text-app-text leading-relaxed whitespace-pre-wrap">{m.body}</div>

                      {replyCount > 0 && (
                        <button
                          type="button"
                          {...openThreadProps}
                          className="mt-2 flex items-center gap-2 text-[14px] font-semibold text-[#0045AC] active:opacity-90"
                          aria-label="Open thread"
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                            <img
                              src={threadInfo.lastFrom === 'me' ? myAvatarSrc : avatarSrc}
                              className="w-full h-full object-cover"
                              alt=""
                              draggable={false}
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          </div>
                          <span>
                            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-app-border bg-app-surface px-4 py-3" data-keep-keyboard="true">
        <div className="flex items-center gap-3">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message"
            className="flex-1 min-h-[44px] max-h-[120px] px-4 py-2.5 rounded-[22px] bg-gray-100 outline-none text-[15px] text-app-text placeholder-gray-500 resize-none leading-[22px]"
            style={{ height: 'auto', overflow: 'hidden' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              el.style.overflow = el.scrollHeight > 120 ? 'auto' : 'hidden';
            }}
          />
          <button
            type="button"
            aria-label="Send"
            onPointerDown={(e) => e.preventDefault()}
            {...bindTap(
              { kind: 'action', id: 'chatThread.message.submit' },
              { params: { username, body: draft }, onTrigger: send },
            )}
            className={`w-11 h-11 rounded-full flex items-center justify-center ${
              canSend ? 'bg-[#0045AC] text-white' : 'bg-gray-200 text-gray-400'
            }`}
          >
            <IcSend className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Long-press menu overlay */}
      {longPressMenu && (
        <div className="fixed inset-0 z-[700]">
          <button
            type="button"
            aria-label="Close message menu"
            className="absolute inset-0 bg-black/55"
            onClick={closeLongPressMenu}
          />

          {/* content */}
          <div className="absolute left-0 right-0 bottom-0 pb-6">
            {/* preview bubble */}
            <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              <div className="bg-app-surface rounded-2xl px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    <img
                      src={longPressMenu.from === 'me' ? myAvatarSrc : avatarSrc}
                      className="w-full h-full object-cover"
                      alt=""
                      draggable={false}
                      loading="lazy"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] text-gray-700">
                      <span className="font-semibold text-app-text">
                        {longPressMenu.from === 'me' ? meName : username}
                      </span>{' '}
                      <span className="text-gray-400">{formatChatMessageTime(longPressMenu.created_utc)}</span>
                    </div>
                    <div className="mt-1 text-[15px] text-app-text leading-relaxed whitespace-pre-wrap">
                      {longPressMenu.body}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* emoji row (visual) */}
            <div className="px-4 pb-3">
              <div
                className="bg-app-surface rounded-2xl px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  {[
                    { id: 'like', emoji: '👍', label: 'Like' },
                    { id: 'love', emoji: '❤️', label: 'Love' },
                    { id: 'laugh', emoji: '😂', label: 'Funny' },
                    { id: 'surprised', emoji: '😮', label: 'Wow' },
                    { id: 'sad', emoji: '😢', label: 'Sad' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-11 h-11 rounded-full bg-gray-100 flex flex-col items-center justify-center active:bg-gray-200"
                      aria-label={item.label}
                    >
                      <span className="text-[20px] leading-none">{item.emoji}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
                    aria-label="More reactions"
                  >
                    <IcAdd className="w-6 h-6 text-gray-700" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>

            {/* action sheet */}
            <div
              className="bg-app-surface rounded-t-3xl shadow-[0_-12px_28px_rgba(0,0,0,0.20)]"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {[
                {
                  id: 'chatThread.message.menu.reply',
                  icon: <IcReply className="w-6 h-6" strokeWidth={2} />,
                  label: 'Reply',
                  onTrigger: () => {
                    // Open thread page (same UI as screenshot), then close menus.
                    setConfirmDelete(null);
                    setLongPressMenu(null);
                  },
                },
                {
                  id: 'chatThread.message.menu.copy',
                  icon: <IcCopy className="w-6 h-6" strokeWidth={2} />,
                  label: 'Copy text',
                  onTrigger: async () => {
                    await copyText(longPressMenu.body);
                    closeLongPressMenu();
                  },
                },
                {
                  id: 'chatThread.message.menu.share',
                  icon: <IcShare className="w-6 h-6" strokeWidth={2} />,
                  label: 'Share',
                  onTrigger: () => {
                    // Visual-only for now
                    closeLongPressMenu();
                  },
                },
                {
                  id: 'chatThread.message.menu.delete',
                  icon: <IcDelete className="w-6 h-6" strokeWidth={2} />,
                  label: 'Delete message',
                  onTrigger: () => {
                    // Open confirm dialog (do not delete immediately)
                    setConfirmDelete(longPressMenu);
                  },
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  {...(item.id === 'chatThread.message.menu.reply'
                    ? bindTap('chatThread.message.thread.open', {
                        params: { username, messageId: longPressMenu.id },
                        beforeTrigger: () => {
                          // Close overlays before navigating.
                          setConfirmDelete(null);
                          setLongPressMenu(null);
                        },
                      })
                    : bindTap(
                        { kind: 'action', id: item.id },
                        {
                          params: { username, messageId: longPressMenu.id },
                          onTrigger: item.onTrigger,
                        },
                      ))}
                  className="w-full flex items-center gap-4 px-6 py-4 text-left active:bg-gray-50"
                >
                  <div className="w-7 h-7 flex items-center justify-center text-gray-800">{item.icon}</div>
                  <div className="text-[18px] text-app-text">{item.label}</div>
                </button>
              ))}
              <div className="h-3" />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog (shown above long-press menu) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[820] flex items-center justify-center px-5">
          <button
            type="button"
            aria-label="Close delete dialog"
            className="absolute inset-0 bg-black/35"
            onClick={() => setConfirmDelete(null)}
          />
          <div
            className="relative w-full max-w-[420px] bg-app-surface rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.30)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6">
              <div className="text-[24px] font-black text-app-text">Delete this message?</div>
              <div className="mt-3 text-[15px] text-gray-600 leading-relaxed">
                It will be removed for everyone in this chat.
              </div>
            </div>

            <div className="px-6 pb-6 pt-6 space-y-3">
              <button
                type="button"
                className="w-full h-12 rounded-full bg-[#0045AC] text-white font-black active:opacity-95"
                onClick={() => {
                  deleteMessage(confirmDelete.id);
                  setConfirmDelete(null);
                  setLongPressMenu(null);
                }}
              >
                Yes, Delete
              </button>

              <button
                type="button"
                className="w-full h-12 rounded-full bg-gray-200 text-gray-800 font-black active:opacity-95"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
