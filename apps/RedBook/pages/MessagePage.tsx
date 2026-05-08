import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useState } from 'react';
import * as TimeService from '@/os/TimeService';
import { useRedBookStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { REDBOOK_CONFIG } from '../data';
import { IcBell, IcHeart, IcContacts, IcMessage, IcSearch, IcAddCircle } from '../res/icons';
const Bell = IcBell, Heart = IcHeart, Users = IcContacts, MessageSquare = IcMessage, Search = IcSearch, PlusCircle = IcAddCircle;
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import { useLocale } from '@/apps/RedBook/locale';
export const MessagePage: React.FC = () => {
  const { chats, notifications } = useRedBookStore(useShallow(s => ({ chats: s.chats, notifications: s.notifications })));
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const { bindTap } = useRedBookGestures();
  const s = useRedBookStrings();
  const locale = useLocale();

  // DO NOT CHANGE THIS SECTION AGAIN.
  // Icons must be Pink, Blue, Green as requested.
  const tabs = [
    {
        id: 1,
        label: s.likes_and_saves,
        Icon: Heart,
        color: '#ffffff', // White Icon
        bgColor: '#ff2442', // Solid Pink
        count: 12
    },
    {
        id: 2,
        label: s.new_followers,
        Icon: Users,
        color: '#ffffff', // White Icon
        bgColor: '#3b82f6', // Solid Blue
        count: 5
    },
    {
        id: 3,
        label: s.comments_and_at,
        Icon: MessageSquare,
        color: '#ffffff', // White Icon
        bgColor: '#22c55e', // Solid Green
        count: 0
    },
  ];

  const likesCount = notifications.filter(n => !n.isRead && (n.type === 'like_note' || n.type === 'collect_note' || n.type === 'like_comment')).length;
  const followersCount = notifications.filter(n => !n.isRead && n.type === 'follow').length;
  const commentsCount = notifications.filter(n => !n.isRead && (n.type === 'comment' || n.type === 'reply')).length;

  const getCount = (id: number) => {
      if (id === 1) return likesCount;
      if (id === 2) return followersCount;
      if (id === 3) return commentsCount;
      return 0;
  };

  return (
    <div className="h-full flex flex-col bg-app-surface">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 flex items-center justify-center border-b border-gray-100 bg-app-surface sticky top-0 z-10 relative">
        <span className="text-[18px] font-medium text-app-text">{s.messages}</span>
        <div className="absolute right-4 flex items-center gap-5">
            <Search className="w-6 h-6 text-app-text" strokeWidth={1.5} />
            <PlusCircle className="w-6 h-6 text-app-text" strokeWidth={1.5} />
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* Action Icons Grid */}
        <div className="flex justify-around py-5 pb-6 border-b border-gray-50">
            {tabs.map(tab => {
                const Icon = tab.Icon;
                const tapProps =
                    tab.id === 1
                    ? bindTap('message.likes.open')
                    : tab.id === 2
                      ? bindTap('message.followers.open')
                      : bindTap('message.comments.open');
                return (
                    <div
                        key={tab.id}
                        className="flex flex-col items-center gap-2 active:opacity-80 transition-opacity relative cursor-pointer"
                        {...tapProps}
                    >
                        <div
                            className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center relative overflow-visible shadow-sm"
                            style={{ backgroundColor: tab.bgColor }}
                        >
                             <Icon size={24} color={tab.color} fill={tab.id === 1 ? tab.color : 'none'} strokeWidth={2.5} />
                             {getCount(tab.id) > 0 && (
                                 <div className="absolute top-[-4px] right-[-4px] bg-app-primary text-white text-[10px] px-1.5 py-0.5 rounded-full border border-white z-10 min-w-[16px] text-center shadow-sm">
                                     {getCount(tab.id)}
                                 </div>
                             )}
                        </div>
                        <span className="text-[12px] text-app-text font-medium">{tab.label}</span>
                    </div>
                );
            })}
        </div>

        {/* Message List */}
        <div>
            {(chats || []).map((chat, index) => {
                 // Generate different background colors for avatars
                 const colors = ['bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-purple-100 text-purple-600', 'bg-pink-100 text-pink-600', 'bg-orange-100 text-orange-600', 'bg-cyan-100 text-cyan-600'];
                 const colorClass = colors[index % colors.length];

                 return (
                     <div
                        key={chat.userId}
                        className="px-4 flex items-start gap-3 active:bg-gray-50 py-3 relative group overflow-hidden cursor-pointer"
                        {...bindTap('chat.open', { params: { userId: chat.userId } })}
                     >
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 relative">
                            {chat.avatar ? (
                                 <img src={chat.avatar} className="w-full h-full object-cover" />
                            ) : (
                                 <div className={`w-full h-full flex items-center justify-center font-bold text-sm ${colorClass}`}>
                                     {chat.username[0]}
                                 </div>
                            )}
                             {chat.unreadCount > 0 && (
                                 <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-app-primary rounded-full border border-white"></div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 border-b border-gray-50 pb-4 pt-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[15px] font-medium text-app-text">{chat.username}</span>
                                <span className="text-[11px] text-app-text-muted">{chat.lastTime ? (locale === 'en' ? TimeService.fromTimestamp(chat.lastTime).toLocaleString('en-US', {month: '2-digit', day: '2-digit'}) : `${TimeService.fromTimestamp(chat.lastTime).getMonth() + 1}${s.month_suffix}${TimeService.fromTimestamp(chat.lastTime).getDate()}${s.day_suffix}`) : ''}</span>
                            </div>
                            <p className="text-[13px] text-[#666] line-clamp-1 pr-4 truncate">
                                {chat.lastMessage}
                            </p>
                        </div>
                    </div>
                 );
            })}
        </div>
      </div>
    </div>
  );
};
