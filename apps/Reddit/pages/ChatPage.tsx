import React from 'react';
import { TopBar } from '../components/TopBar';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { IcNavForward, IcAddPost, IcTelescope } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRedditStore } from '../state';
import * as TimeService from '../../../os/TimeService';
import { formatChatListTime } from '../utils/chatTime';
import { getUserAvatar } from '../utils/userIdentity';

const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Reddit/${s}`; };

const CHAT_TOPBAR_ICON_HOME_CHECK_SRC = asset('topbar/chat_home_check.png');
const CHAT_TOPBAR_ICON_SETTINGS_SRC = asset('topbar/chat_settings.png');

type ChatFilterKey = 'group' | 'direct' | 'modmail';
type ChatTabKey = 'messages' | 'unread' | 'requests' | 'threads';

const pickAvatar = (usernameLike: string): string | undefined => getUserAvatar(usernameLike);

export const ChatPage: React.FC = () => {
  const chatThreads = useRedditStore((s) => s.chatThreads);
  const storeSeedChatThread = useRedditStore((s) => s.seedChatThread);
  const { bindTap } = useRedditGestures();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const currentTab = (searchParams.get('tab') as ChatTabKey | null) ?? 'messages';
  const [isMarkAllReadOpen, setIsMarkAllReadOpen] = React.useState(false);
  const [isFilterChatsOpen, setIsFilterChatsOpen] = React.useState(false);
  const [filters, setFilters] = React.useState<Record<ChatFilterKey, boolean>>({
    group: true,
    direct: true,
    modmail: true,
  });

  const closeMarkAllRead = React.useCallback(() => {
    setIsMarkAllReadOpen(false);
  }, []);

  const closeFilterChats = React.useCallback(() => {
    setIsFilterChatsOpen(false);
  }, []);

  const toggleFilter = React.useCallback((key: ChatFilterKey) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const seedUsers = React.useMemo(
    () =>
      [
        { username: 'Objective-Skill-2591', seedBody: "well,it's so funny" },
        { username: 'Intelligent_Drama_46', seedBody: 'hello' },
      ] as const,
    [],
  );

  // Ensure demo threads exist with stable timestamps (seed once, persisted in localStorage).
  React.useEffect(() => {
    const needsSeed = seedUsers.some((u) => {
      const list = chatThreads[u.username];
      return !Array.isArray(list) || list.length === 0;
    });
    if (!needsSeed) return;

    for (const u of seedUsers) {
      const existing = chatThreads[u.username];
      if (Array.isArray(existing) && existing.length > 0) continue;
      storeSeedChatThread(u.username, u.seedBody);
    }
  }, [seedUsers, storeSeedChatThread, chatThreads]);

  const chatRows = React.useMemo(() => {
    return seedUsers.map((u) => {
      const list = chatThreads[u.username];
      const thread = Array.isArray(list) ? list : [];
      const last = thread.length ? thread[thread.length - 1] : null;
      const preview = last ? `${last.from === 'me' ? 'You' : u.username}: ${last.body}` : `You: ${u.seedBody}`;
      const ts = last?.created_utc ?? Math.floor(TimeService.now() / 1000);
      return {
        username: u.username,
        preview,
        ts,
      };
    });
  }, [seedUsers, chatThreads]);

  const isTopAlignedTab = currentTab === 'requests' || currentTab === 'messages';

  return (
    <div className="flex flex-col h-full bg-app-surface relative">
      <TopBar
        title="Chats"
        rightAction="none"
        rightSlot={
          <>
            <button
              type="button"
              aria-label="Mark all as read"
              onClick={() => {}}
              className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
            >
              <img
                src={CHAT_TOPBAR_ICON_HOME_CHECK_SRC}
                alt=""
                className="w-9 h-9 object-contain"
                draggable={false}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>

            <button
              type="button"
              aria-label="Chat settings"
              onClick={() => {}}
              className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
            >
              <img
                src={CHAT_TOPBAR_ICON_SETTINGS_SRC}
                alt=""
                className="w-9 h-9 object-contain"
                draggable={false}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>
          </>
        }
      />

      {/* Tabs: Messages / Unread / Requests / Threads */}
      <div className="border-b border-gray-100">
        <div className="flex items-end gap-6 px-4 pt-2 overflow-x-auto no-scrollbar">
          {(
            [
              { key: 'messages', label: 'Messages' },
              { key: 'unread', label: 'Unread' },
              { key: 'requests', label: 'Requests' },
              { key: 'threads', label: 'Threads' },
            ] as const
          ).map((t) => {
            const active = currentTab === t.key;
            return (
              <div
                key={t.key}
                className="flex flex-col items-center cursor-pointer min-w-max"
                {...bindTap('chat.tab.switch', { params: { tab: t.key } })}
              >
                <span className={`pb-3 text-[15px] font-semibold ${active ? 'text-black' : 'text-gray-400'}`}>
                  {t.label}
                </span>
                {active && <div className="w-[54px] h-0.5 bg-black rounded-full" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom sheet: Mark all as read */}
      {isMarkAllReadOpen && (
        <div className="fixed inset-0 z-[400]">
          {/* overlay */}
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/50"
            onClick={closeMarkAllRead}
          />

          {/* sheet */}
          <div
            className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-3xl shadow-[0_-12px_28px_rgba(0,0,0,0.20)] px-5 pt-4 pb-6"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-[18px] font-bold text-app-text">
                Mark all messages as read?
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeMarkAllRead}
                className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100 text-gray-700"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="mt-2 text-[14px] text-gray-600 leading-relaxed">
              Are you sure you’d like to mark all unread messages as read?
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={closeMarkAllRead}
                className="w-full h-12 rounded-full bg-[#0045AC] text-white font-bold shadow-sm active:opacity-95"
              >
                Mark All as Read
              </button>

              <button
                type="button"
                onClick={closeMarkAllRead}
                className="w-full h-12 rounded-full bg-gray-200 text-gray-800 font-bold active:opacity-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom sheet: Filter chats */}
      {isFilterChatsOpen && (
        <div className="fixed inset-0 z-[400]">
          {/* overlay */}
          <button
            type="button"
            aria-label="Close filter"
            className="absolute inset-0 bg-black/50"
            onClick={closeFilterChats}
          />

          {/* sheet */}
          <div
            className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-3xl shadow-[0_-12px_28px_rgba(0,0,0,0.20)] px-5 pt-4 pb-6"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-[18px] font-bold text-app-text">Filter chats</div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeFilterChats}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 text-gray-700"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="mt-4 space-y-6">
              {[
                { key: 'group' as const, label: 'Group chats' },
                { key: 'direct' as const, label: 'Direct chats' },
                { key: 'modmail' as const, label: 'Mod mail' },
              ].map((item) => {
                const checked = filters[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleFilter(item.key)}
                    className="w-full flex items-center justify-between py-1"
                  >
                    <span className="text-[16px] text-app-text">{item.label}</span>
                    <span
                      className={`w-7 h-7 rounded-md border flex items-center justify-center ${
                        checked ? 'bg-[#0045AC] border-[#0045AC]' : 'bg-app-surface border-gray-300'
                      }`}
                      aria-hidden="true"
                    >
                      {checked ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M20 6L9 17l-5-5"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={closeFilterChats}
                className="w-full h-12 rounded-full bg-[#0045AC] text-white font-bold shadow-sm active:opacity-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div 
        className={`flex-1 overflow-y-auto no-scrollbar flex flex-col ${
          isTopAlignedTab ? 'items-stretch justify-start' : 'items-center justify-center'
        } ${
          currentTab === 'requests'
            ? 'pt-2'
            : currentTab === 'messages'
              ? 'pt-0'
              : 'p-8 text-center'
        }`}
        data-scroll-container="main" 
        data-scroll-direction="vertical"
      >
        {currentTab === 'unread' && (
          <div className="w-full flex flex-col items-center justify-center">
            <div className="text-[30px] font-black text-app-text leading-tight">
              You don&apos;t have any unread
              <br />
              chats
            </div>
            <div className="mt-3 text-[15px] text-app-text-muted">When you do, they&apos;ll show up here.</div>
            <button
              type="button"
              {...bindTap('chat.tab.switch', { params: { tab: 'messages' } })}
              className="mt-6 h-11 px-8 rounded-full bg-[#0045AC] text-white font-bold shadow-sm active:opacity-95"
            >
              Go to Messages
            </button>
          </div>
        )}

        {currentTab === 'threads' && (
          <div className="w-full flex flex-col items-center justify-center">
            <div className="text-[30px] font-black text-app-text leading-tight">
              You don&apos;t have any threads yet
            </div>
            <div className="mt-3 text-[15px] text-app-text-muted">When you do, they&apos;ll show up here.</div>
            <button
              type="button"
              {...bindTap('chat.tab.switch', { params: { tab: 'messages' } })}
              className="mt-6 h-11 px-8 rounded-full bg-[#0045AC] text-white font-bold shadow-sm active:opacity-95"
            >
              Go to Messages
            </button>
          </div>
        )}

        {currentTab === 'requests' && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => {}}
              className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-100"
            >
              <span className="text-[16px] text-app-text">Additional requests</span>
              <span className="flex items-center gap-3 text-gray-700">
                <span className="text-[16px]">0</span>
                <IcNavForward className="w-5 h-5 text-gray-400" />
              </span>
            </button>
            <div className="mt-6 text-center text-[14px] text-app-text-muted">
              You don&apos;t have any message requests yet.
            </div>
          </div>
        )}

        {currentTab === 'messages' && (
          <div className="w-full self-stretch">
            {chatRows.map((c) => (
              <button
                key={c.username}
                type="button"
                {...bindTap('chat.thread.open', { params: { username: c.username } })}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 active:bg-gray-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    <img
                      src={pickAvatar(c.username)}
                      className="w-full h-full object-cover"
                      alt=""
                      draggable={false}
                      loading="lazy"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold text-app-text truncate text-left">
                      {c.username}
                    </div>
                    <div className="mt-0.5 text-[14px] text-app-text-muted truncate text-left">
                      {c.preview.trimStart()}
                    </div>
                  </div>
                </div>
                <div className="text-[12px] text-gray-400 flex-shrink-0">
                  {formatChatListTime(c.ts)}
                </div>
              </button>
            ))}

            {/* keep the same empty-space feel as screenshot */}
            <div className="h-[420px]" />
          </div>
        )}
      </div>
      
      {/* FAB */}
      <div className="absolute bottom-6 right-4">
         <button 
           {...bindTap('chat.new.open')}
           className="w-14 h-14 bg-[#0045AC] rounded-full flex items-center justify-center shadow-lg text-white"
         >
            <IcAddPost className="w-7 h-7" />
         </button>
      </div>
    </div>
  );
};
