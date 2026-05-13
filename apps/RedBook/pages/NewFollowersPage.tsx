import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useEffect } from 'react';
import * as TimeService from '@/os/TimeService';
import { useRedBookStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { IcNavBack } from '../res/icons';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import { useLocale } from '@/apps/RedBook/locale';

const ChevronLeft = IcNavBack;

export const NewFollowersPage: React.FC = () => {
  const s = useRedBookStrings();
  const locale = useLocale();
  const { notifications, followUser, user, markNotificationsAsRead } = useRedBookStore(
    useShallow((store) => ({
      notifications: store.notifications,
      followUser: store.followUser,
      user: store.user,
      markNotificationsAsRead: store.markNotificationsAsRead,
    })),
  );
  const { bindBack } = useRedBookGestures();

  useEffect(() => {
    markNotificationsAsRead('follow');
  }, [markNotificationsAsRead]);

  const list = notifications.filter((notification) => notification.type === 'follow');
  const isFollowed = (userId: string) => (user.followingIds || []).includes(userId);

  return (
    <div className="h-full flex flex-col bg-app-surface">
      <div className="pt-10 px-4 pb-3 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-app-surface z-10">
        <div className="w-8 flex items-center justify-start active:opacity-60" {...bindBack()}>
          <ChevronLeft size={24} className="text-gray-900" />
        </div>
        <span className="text-[16px] font-medium text-gray-900">{s.new_followers}</span>
        <div className="w-8" />
      </div>
      <div className="flex-1 overflow-y-auto" data-scroll-container="main" data-scroll-direction="vertical">
        {list.map((item) => (
          <div key={item.id} className="flex items-center p-4 gap-3 border-b border-gray-50">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <img src={item.userAvatar} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-medium text-gray-900 mb-1">{item.username}</div>
              <div className="text-[12px] text-gray-400">
                {s.followed_you} · {TimeService.fromTimestamp(item.timestamp).toLocaleDateString(locale === 'en' ? 'en-US' : undefined)}
              </div>
            </div>
            <button
              className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                isFollowed(item.userId) ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-app-primary text-white'
              }`}
              onClick={() => followUser(item.userId)}
            >
              {isFollowed(item.userId) ? s.mutual : s.follow_back}
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
            <span>{s.no_new_followers}</span>
          </div>
        )}
      </div>
    </div>
  );
};
