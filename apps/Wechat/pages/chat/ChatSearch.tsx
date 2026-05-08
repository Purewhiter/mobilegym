import React, { useState, useMemo, useEffect } from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useParams, useSearchParams } from 'react-router-dom';
import { IcSearch, IcClose } from '../../res/icons';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import * as TimeService from '../../../../os/TimeService';
import type { Message } from '../../types';
const CATEGORY_KEYS = [
  'search_date', 'search_photo_video', 'search_file', 'search_link',
  'search_music_audio', 'search_transaction', 'search_mini_program',
  'search_channels', 'search_contact_card', 'search_location',
  'search_note', 'search_product', 'search_gift',
] as const;

const FILTER_TAB_KEYS = [
  { key: 'all', labelKey: 'search_all' },
  { key: 'image', labelKey: 'search_photo' },
  { key: 'file', labelKey: 'search_file' },
  { key: 'link', labelKey: 'search_link' },
  { key: 'music', labelKey: 'search_music_audio' },
  { key: 'transaction', labelKey: 'search_transaction' },
  { key: 'miniprogram', labelKey: 'search_mini_program' },
  { key: 'video', labelKey: 'search_channels' },
  { key: 'card', labelKey: 'search_contact_card' },
  { key: 'location', labelKey: 'search_location' },
  { key: 'note', labelKey: 'search_note' },
  { key: 'product', labelKey: 'search_product' },
  { key: 'gift', labelKey: 'search_gift' },
] as const;

type DayOfWeekStrings = [string, string, string, string, string, string, string];

function formatResultTime(timestamp: number, dayOfWeek: DayOfWeekStrings, yesterdayStr: string): string {
  const date = TimeService.fromTimestamp(timestamp);
  const now = TimeService.getDate();
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
  const yesterday = TimeService.fromTimestamp(now.getTime());
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  if (isSameDay(date, yesterday)) return yesterdayStr;
  const weekAgo = TimeService.fromTimestamp(now.getTime());
  weekAgo.setDate(now.getDate() - 7);
  if (date > weekAgo) return dayOfWeek[date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <span key={i} className="text-app-primary bg-transparent">{part}</span>
    ) : (
      part
    )
  );
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const ChatSearch: React.FC = () => {
  const t = useWechatStrings();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { bindBack, go } = useWechatGestures();
  const { user, chats, contacts } = useWechatStore(useShallow(s => ({
    user: s.user,
    chats: s.chats,
    contacts: s.contacts,
  })));
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '');
  const [filterTab, setFilterTab] = useState<string>('all');

  const CATEGORIES = useMemo(() => CATEGORY_KEYS.map(k => t[k]), [t]);
  const FILTER_TABS = useMemo(() => FILTER_TAB_KEYS.map(item => ({ key: item.key, label: t[item.labelKey] })), [t]);
  const dayOfWeek: DayOfWeekStrings = useMemo(() => [
    t.time_sunday, t.time_monday, t.time_tuesday, t.time_wednesday,
    t.time_thursday, t.time_friday, t.time_saturday
  ], [t]);

  // 搜索词变化时同步到 URL，返回后仍停留在搜索结果页且保留搜索词
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (keyword === current) return;
    if (keyword) {
      setSearchParams({ q: keyword }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [keyword]);

  const chat = useMemo(() => {
    if (!id) return null;
    const found = chats.find(c => c.id === id);
    if (found) return found;
    const contact = user.wxid === id ? user : contacts.find(c => c.wxid === id);
    if (contact) {
      return {
        id: contact.wxid,
        user: { wxid: contact.wxid, name: contact.name, avatar: contact.avatar },
        messages: [] as Message[],
      };
    }
    return null;
  }, [id, chats, contacts, user]);

  const searchResults = useMemo(() => {
    if (!chat || !keyword.trim()) return [];
    const kw = keyword.trim().toLowerCase();
    const list = (chat.messages || [])
      .filter(
        (m): m is Message =>
          (m.type === 'text' || m.type === 'image') &&
          m.content.toLowerCase().includes(kw)
      )
      .filter(m => {
        if (filterTab === 'all') return true;
        if (filterTab === 'image') return m.type === 'image';
        // 其余 Tab（文件/链接/音乐/交易等）暂无对应类型，按全部展示
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }, [chat, keyword, filterTab]);

  const showResults = keyword.trim().length > 0;

  return (
    <div
      className="min-h-full flex flex-col"
      style={{ backgroundColor: 'var(--app-c-search-bar-bg)' }}
    >
      {/* 搜索栏 */}
      <div
        className="px-4 pt-10 pb-3 flex items-center gap-3 flex-shrink-0"
        style={{ backgroundColor: 'var(--app-c-search-bar-bg)' }}
      >
        <div className="flex-1 h-(--app-item-height-36) bg-app-surface rounded-[8px] flex items-center px-3 gap-2">
          <IcSearch size={dimens.icSizeAction} className="flex-shrink-0" style={{ color: 'var(--app-c-search-icon-color)' }} />
          <input
            type="text"
            placeholder={t.common_search}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="flex-1 min-w-0 bg-transparent outline-none text-(--app-chat-bubble-text-size) placeholder:text-(--app-c-tw-text-gray-400)"
            style={{ color: 'var(--app-c-settings-item-text)' }}
            autoFocus
          />
          {keyword.length > 0 && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="p-1 rounded-full active:bg-(--app-c-tw-bg-gray-100) flex-shrink-0"
              aria-label={t.search_clear}
            >
              <IcClose size={dimens.icSizeChevronSm} style={{ color: 'var(--app-c-search-icon-color)' }} />
            </button>
          )}
        </div>
        <button
          type="button"
          {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
          className="text-(--app-chat-bubble-text-size) font-normal flex-shrink-0 py-2 px-1 active:opacity-70"
          style={{ color: 'var(--app-c-search-cancel-text)' }}
        >
          {t.common_cancel}
        </button>
      </div>

      {showResults ? (
        <>
          {/* 筛选 Tab：可左右滑动，浅灰与上方一致，无分割线 */}
          <div
            className="flex-shrink-0 overflow-x-auto overflow-y-hidden no-scrollbar"
            style={{ backgroundColor: 'var(--app-c-search-bar-bg)' }}
          >
            <div className="flex items-center flex-nowrap">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className="relative flex max-w-[7.5rem] min-w-[5rem] flex-shrink-0 flex-col items-center justify-center px-3 py-3"
                >
                  <span
                    className="text-(--app-search-filter-text-size) text-center leading-tight whitespace-normal break-words [overflow-wrap:anywhere]"
                    style={{ color: 'var(--app-c-search-filter-tab-text)' }}
                  >
                    {tab.label}
                  </span>
                  {filterTab === tab.key && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--app-c-search-filter-tab-active-indicator)' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 搜索结果列表 */}
          <div className="flex-1 overflow-auto bg-app-surface">
            {searchResults.length === 0 ? (
              <div
                className="py-12 text-center text-(--app-search-filter-text-size)"
                style={{ color: 'var(--app-c-search-empty-text)' }}
              >
                {t.search_no_results}
              </div>
            ) : (
              <div>
                {searchResults.map((msg, index) => {
                  const isMe = msg.senderId === user.wxid;
                  const senderName = isMe ? user.name : chat!.user.name;
                  const avatar = isMe ? user.avatar : chat!.user.avatar;
                  const contentDisplay =
                    msg.type === 'image'
                      ? t.search_image_placeholder
                      : highlightKeyword(msg.content, keyword.trim());
                  const isLast = index === searchResults.length - 1;
                  return (
                    <div
                      key={msg.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (id) {
                          go('chatSearch.openChat', { id }, {
                            state: { scrollToMessageId: msg.id },
                          });
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (id) {
                            go('chatSearch.openChat', { id }, {
                              state: { scrollToMessageId: msg.id },
                            });
                          }
                        }
                      }}
                      className="relative flex items-start gap-3 px-4 py-2.5 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer"
                    >
                      <img
                        src={avatar}
                        alt=""
                        className="w-10 h-10 rounded-[4px] flex-shrink-0 object-cover bg-(--app-c-tw-bg-gray-100)"
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-(--app-search-filter-text-size) font-normal truncate"
                          style={{ color: 'var(--app-c-settings-item-text)' }}
                        >
                          {senderName}
                        </div>
                        <div
                          className="text-(--app-search-filter-text-size) mt-0.5 leading-relaxed break-words pb-0.5"
                          style={{ color: 'var(--app-c-settings-item-text)' }}
                        >
                          {contentDisplay}
                        </div>
                      </div>
                      <div
                        className="text-(--app-chat-time-label-text-size) flex-shrink-0 mt-0.5"
                        style={{ color: 'var(--app-c-search-icon-color)' }}
                      >
                        {formatResultTime(msg.timestamp, dayOfWeek, t.time_yesterday)}
                      </div>
                      {/* 分割线：从文字左对齐延伸到屏幕最右端 */}
                      {!isLast && (
                        <div
                          className="absolute bottom-0 h-px"
                          style={{
                            left: '4.25rem',
                            right: '-1rem',
                            backgroundColor: 'var(--app-c-search-result-divider)',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* 未输入时：搜索指定内容 */
        <div className="flex-1 overflow-auto px-4 pt-8 pb-8">
          <div
            className="text-(--app-search-filter-text-size) mb-4 text-center"
            style={{ color: 'var(--app-c-search-filter-tab-text)' }}
          >
            {t.search_specific_content}
          </div>
          <div
            className="rounded-[4px] overflow-hidden"
            style={{ backgroundColor: 'var(--app-c-search-bar-bg)' }}
          >
            <div className="grid grid-cols-3">
              {CATEGORIES.map(label => (
                <div
                  key={label}
                  className="flex items-center justify-center min-h-(--app-item-height-52) py-3 px-4 cursor-pointer outline-none"
                >
                  <span
                    className="text-(--app-search-filter-text-size) text-center"
                    style={{ color: 'var(--app-c-search-category-link-text)' }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
