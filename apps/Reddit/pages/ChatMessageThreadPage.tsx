import React from 'react';
import { IcBell, IcNavBack, IcSend } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRedditStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { formatChatDateShort, formatChatMessageTime, getChatDayKey } from '../utils/chatTime';
import { getUserAvatar } from '../utils/userIdentity';

type ChatMessage = {
  id: string;
  from: 'me' | 'them';
  body: string;
  created_utc: number;
};

const pickAvatar = (usernameLike: string): string | undefined => getUserAvatar(usernameLike);

function getIdsFromPath(pathname: string): { username: string; messageId: string } | null {
  const m = pathname.match(/^\/chat\/([^/?#]+)\/thread\/([^/?#]+)/);
  if (!m) return null;
  return { username: decodeURIComponent(m[1]), messageId: decodeURIComponent(m[2]) };
}

function threadKey(username: string, messageId: string): string {
  return `${username}:${messageId}`;
}

export const ChatMessageThreadPage: React.FC = () => {
  const { chatThreads, chatReplies, user } = useRedditStore(useShallow((s) => ({
    chatThreads: s.chatThreads,
    chatReplies: s.chatReplies,
    user: s.user,
  })));
  const storeSendChatReply = useRedditStore((s) => s.sendChatReply);
  const { bindBack, bindTap } = useRedditGestures();
  const location = useLocation();
  const ids = getIdsFromPath(location.pathname);
  const username = ids?.username ?? null;
  const messageId = ids?.messageId ?? null;

  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const sourceMessage = React.useMemo(() => {
    if (!username || !messageId) return null;
    const list = chatThreads[username];
    const thread = Array.isArray(list) ? (list as ChatMessage[]) : [];
    return thread.find((m) => String(m.id) === String(messageId)) ?? null;
  }, [messageId, chatThreads, username]);

  const replies = React.useMemo(() => {
    if (!username || !messageId) return [];
    const k = threadKey(username, messageId);
    const list = chatReplies?.[k];
    return Array.isArray(list) ? (list as ChatMessage[]) : [];
  }, [messageId, chatReplies, username]);

  const canSend = draft.trim().length > 0 && !!username && !!messageId;

  const submit = React.useCallback(() => {
    if (!username || !messageId) return;
    const body = draft.trim();
    if (!body) return;

    storeSendChatReply(username, messageId, body);

    setDraft('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [draft, messageId, storeSendChatReply, username]);

  const repliesWithSeparators = React.useMemo(() => {
    const out: Array<{ kind: 'sep'; key: string; label: string } | { kind: 'msg'; msg: ChatMessage }> = [];
    let prevKey: string | null = null;
    for (const r of replies) {
      const k = getChatDayKey(r.created_utc);
      if (k !== prevKey) {
        out.push({ kind: 'sep', key: `sep_${k}`, label: formatChatDateShort(r.created_utc) });
        prevKey = k;
      }
      out.push({ kind: 'msg', msg: r });
    }
    return out;
  }, [replies]);

  if (!username || !messageId) {
    return (
      <div className="flex flex-col h-full bg-app-surface">
        <div className="px-4 pt-10">Invalid thread.</div>
      </div>
    );
  }

  const meName = user.username || 'Embarrassed_Fee8630';
  const avatarSrc = pickAvatar(username);
  const myAvatarSrc = user.avatar || pickAvatar(meName);
  const fromName = sourceMessage?.from === 'me' ? meName : username;
  const fromAvatar = sourceMessage?.from === 'me' ? myAvatarSrc : avatarSrc;
  const tsLabel = sourceMessage ? formatChatMessageTime(sourceMessage.created_utc) : '';

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
        <div className="flex-1 text-[18px] font-bold text-app-text">Thread</div>
        <div className="w-10 h-10" aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar bg-app-surface" data-scroll-container="main" data-scroll-direction="vertical">
        {/* Source message (match chat style) */}
        <div className="px-4 pt-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              <img
                src={fromAvatar}
                className="w-full h-full object-cover"
                alt=""
                draggable={false}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] text-gray-600">
                <span className="font-semibold text-app-text">{fromName}</span>{' '}
                <span className="text-gray-400">{tsLabel}</span>
              </div>
              <div className="text-[15px] text-app-text leading-relaxed whitespace-pre-wrap">
                {sourceMessage?.body ?? ''}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-[14px] text-app-text-muted font-semibold">
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </div>
            <button
              type="button"
              aria-label="Follow thread"
              onClick={() => {}}
              className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100 text-gray-700"
            >
              <IcBell className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="mt-2 h-px bg-gray-200" />

        {/* Replies list */}
        <div className="px-4 pt-3 pb-24">
          {repliesWithSeparators.map((item) => {
            if (item.kind === 'sep') {
              return (
                <div key={item.key} className="flex justify-center text-[12px] text-gray-400 py-3">
                  {item.label}
                </div>
              );
            }
            const r = item.msg;
            return (
              <div key={r.id} className="flex gap-3 py-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  <img
                    src={r.from === 'me' ? myAvatarSrc : avatarSrc}
                    className="w-full h-full object-cover"
                    alt=""
                    draggable={false}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] text-gray-600">
                    <span className="font-semibold text-app-text">{r.from === 'me' ? meName : username}</span>{' '}
                    <span className="text-gray-400">{formatChatMessageTime(r.created_utc)}</span>
                  </div>
                  <div className="text-[15px] text-app-text leading-relaxed whitespace-pre-wrap">{r.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom spacing for input */}
        <div className="h-28" />
      </div>

      {/* Reply input bar */}
      <div className="border-t border-app-border bg-app-surface px-4 py-3" data-keep-keyboard="true">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply"
            className="flex-1 h-11 px-4 rounded-full bg-gray-100 outline-none text-[15px] text-app-text placeholder-gray-500"
          />
          <button
            type="button"
            aria-label="Send reply"
            onPointerDown={(e) => e.preventDefault()}
            {...bindTap(
              { kind: 'action', id: 'chatThread.reply.submit' },
              { params: { username, messageId, body: draft }, onTrigger: submit },
            )}
            className={`w-11 h-11 rounded-full flex items-center justify-center ${
              canSend ? 'text-[#0045AC]' : 'text-gray-300'
            }`}
          >
            <IcSend className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
};
