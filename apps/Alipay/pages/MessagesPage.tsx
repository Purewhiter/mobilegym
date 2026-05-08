import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcUserAdd, IcAdd, IcSearch, IcBell, IcHeadphone, IcGift, IcAt, IcCard, IcTransfer, IcBroom } from '../res/icons';
import { useAlipayStore, computeUnread } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import * as TimeService from '../../../os/TimeService';
import { useLocale } from '@/apps/Alipay/locale';
import { DefaultAvatar } from '../components/DefaultAvatar';

function formatConvTime(ts: number, isEnglish: boolean): string {
  const now = TimeService.now();
  const diff = now - ts;
  const MIN = 60_000, HOUR = 3_600_000;
  if (diff < MIN) return isEnglish ? 'Just now' : '刚刚';
  if (diff < HOUR) return isEnglish ? `${Math.floor(diff / MIN)}m ago` : `${Math.floor(diff / MIN)}分钟前`;
  const d = TimeService.fromTimestamp(ts);
  const today = TimeService.getDate();
  const sameDay = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
  if (sameDay) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const yesterday = TimeService.fromLocalParts(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.getFullYear() === yesterday.getFullYear()
    && d.getMonth() === yesterday.getMonth()
    && d.getDate() === yesterday.getDate()) return isEnglish ? 'Yesterday' : '昨天';
  const startOfWeek = TimeService.fromLocalParts(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  if (d.getTime() >= startOfWeek.getTime()) {
    const weekdays = isEnglish ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[d.getDay()];
  }
  if (d.getFullYear() === today.getFullYear()) return isEnglish ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export const MessagesPage: React.FC = () => {
  const conversations = useAlipayStore(s => s.conversations);
  const chatHistory = useAlipayStore(s => s.chatHistory);
  const markAllRead = useAlipayStore(s => s.markAllConversationsRead);
  const { bindTap } = useAlipayGestures();
  const s = useAlipayStrings();
  const locale = useLocale();
  const isEnglish = locale === 'en';

  const [query, setQuery] = React.useState('');

  const sorted = React.useMemo(() => {
    const sticky = conversations.filter(c => c.isSticky);
    const normal = conversations.filter(c => !c.isSticky);
    sticky.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    normal.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    return [...sticky, ...normal];
  }, [conversations]);

  const filtered = React.useMemo(() => {
    if (!query) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(c =>
      c.name.toLowerCase().includes(q) || c.lastContent.toLowerCase().includes(q),
    );
  }, [sorted, query]);

  const totalUnread = React.useMemo(
    () => conversations.reduce((sum, c) => sum + computeUnread(c, chatHistory), 0),
    [conversations, chatHistory],
  );
  const quickBrand = isEnglish ? 'A' : '支';

  return (
    <div className="bg-app-bg min-h-screen pb-4">
      {/* 固定顶部导航（标题 + 搜索框同行） */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-app-bg pt-12 pb-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xl font-bold text-gray-900 flex-shrink-0">
            {s.messages}{totalUnread > 0 && `(${totalUnread})`}
          </span>
          <button className="text-gray-500 flex-shrink-0" onClick={markAllRead}><IcBroom size={18} /></button>
          <div className="flex-1 bg-app-surface rounded-full flex items-center px-3 py-1.5">
            <IcSearch size={14} className="text-gray-400 mr-1.5" />
            <input
              type="text"
              placeholder={s.friends_etc}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs"
            />
          </div>
          <div className="flex items-center space-x-3 flex-shrink-0">
            <button className="text-gray-700" {...bindTap<HTMLButtonElement>('contacts.open')}><IcUserAdd size={22} /></button>
            <button className="text-gray-700"><IcAdd size={22} /></button>
          </div>
        </div>
      </div>

      {/* 滚动内容区（顶部留出 topbar 高度） */}
      <div className="pt-[80px] px-2.5">
        {/* 快捷入口 */}
        <div className="mt-3 flex items-start gap-6 px-1.5">
          <button className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-app-surface shadow flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-app-primary to-app-secondary flex items-center justify-center text-white font-bold">
                {quickBrand}
              </div>
            </div>
            <span className="text-xs text-gray-700 mt-2">{s.finance_circle}</span>
          </button>
          <button className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-app-surface shadow flex items-center justify-center">
              <div className="grid grid-cols-2 gap-1">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <div className="w-4 h-4 rounded-full bg-orange-400"></div>
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <div className="w-4 h-4 rounded-full bg-red-400"></div>
              </div>
            </div>
            <span className="text-xs text-gray-700 mt-2">{s.messagespage_all}</span>
          </button>
        </div>

      {/* 全部会话卡片 */}
      <div className="mt-4 bg-app-surface rounded-xl overflow-hidden">
        {/* 会话筛选行 */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800">{s.all_messages}</span>
          <div className="flex items-center gap-4 text-gray-400">
            <IcAt size={18} />
            <IcCard size={18} />
            <IcTransfer size={18} />
            <IcGift size={18} />
          </div>
        </div>

        {/* 消息列表 */}
        <div>
        {filtered.map((conv) => {
          const unread = computeUnread(conv, chatHistory);
          return (
            <div
              key={conv.id}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-100 active:bg-gray-50"
              {...bindTap('chat.open', { params: { id: conv.id, type: conv.kind } })}
            >
              <div className="flex items-center flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mr-3 overflow-hidden flex-shrink-0">
                  {conv.avatar ? (
                    <img src={conv.avatar} alt="" className="w-full h-full object-cover" />
                  ) : conv.kind === 'box' ? (
                    <div className="w-full h-full bg-app-primary flex items-center justify-center">
                      <IcBell size={22} className="text-white" />
                    </div>
                  ) : conv.kind === 'service' ? (
                    <div className="w-full h-full bg-app-primary flex items-center justify-center">
                      <IcHeadphone size={22} className="text-white" />
                    </div>
                  ) : conv.kind === 'birthday' ? (
                    <div className="w-full h-full bg-pink-100 flex items-center justify-center">
                      <span className="text-2xl">🎂</span>
                    </div>
                  ) : (
                    <DefaultAvatar iconSize={24} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{conv.name}</span>
                    <span className="text-xs text-gray-400">{formatConvTime(conv.lastTimestamp, isEnglish)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-500 truncate">{conv.lastContent}</div>
                    {unread > 0 && (
                      <span className="bg-red-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center leading-none shrink-0">
                        {conv.kind === 'box' && unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
      </div>
    </div>
  );
};
