import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useEffect } from 'react';
import * as TimeService from '@/os/TimeService';
import { useRedBookStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { IcNavBack, IcHeart, IcStar } from '../res/icons';
const ChevronLeft = IcNavBack, Heart = IcHeart, Star = IcStar;
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import { useLocale } from '@/apps/RedBook/locale';
export const LikesAndCollectionsPage: React.FC = () => {
  const s = useRedBookStrings();
  const locale = useLocale();
  const { notifications, markNotificationsAsRead } = useRedBookStore(useShallow(s => ({ notifications: s.notifications, markNotificationsAsRead: s.markNotificationsAsRead })));
  const { bindBack } = useRedBookGestures();
  
  useEffect(() => {
      markNotificationsAsRead('like_note');
  }, []);

  const list = notifications.filter(n => n.type === 'like_note' || n.type === 'collect_note' || n.type === 'like_comment');

  return (
    <div className="h-full flex flex-col bg-app-surface">
      <div className="pt-10 px-4 pb-3 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-app-surface z-10">
        <div className="w-8 flex items-center justify-start active:opacity-60" {...bindBack()}>
            <ChevronLeft size={24} className="text-gray-900" />
        </div>
        <span className="text-[16px] font-medium text-gray-900">{s.likes_and_saves}</span>
        <div className="w-8" />
      </div>
      <div
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {list.map(item => (
            <div key={item.id} className="flex p-4 gap-3 border-b border-gray-50">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <img src={item.userAvatar} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-medium text-gray-900">{item.username}</span>
                        <span className="text-[12px] text-gray-400">{TimeService.fromTimestamp(item.timestamp).toLocaleDateString(locale === 'en' ? 'en-US' : undefined)}</span>
                    </div>
                    <div className="text-[14px] text-gray-600 flex items-center gap-1">
                        {item.type === 'like_note' && <>{s.liked_your_note} <Heart size={14} className="text-app-primary" fill="currentColor" stroke="none" /></>}
                        {item.type === 'collect_note' && <>{s.collected_your_note} <Star size={14} fill="#f6c444" stroke="none" /></>}
                        {item.type === 'like_comment' && <>{s.liked_your_comment} <Heart size={14} className="text-app-primary" fill="currentColor" stroke="none" /></>}
                    </div>
                </div>
                {item.noteCover && (
                    <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-100">
                        <img src={item.noteCover} className="w-full h-full object-cover" />
                    </div>
                )}
            </div>
        ))}
        {list.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                <span>{s.no_messages}</span>
            </div>
        )}
      </div>
    </div>
  );
};
