import React from 'react';
import { useLocation } from 'react-router-dom';
import { useXStore, selectUser } from '../state';
import { useXMentionNotifications, useXNotifications } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage } from '../components/XMedia';

export const NotificationsPage: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const notifications = useXNotifications();
  const mentionNotifications = useXMentionNotifications();
  const user = useXStore(selectUser);
  const location = useLocation();
  const { bindTap } = useXGestures(isActive);
  const s = useXStrings();

  const searchParams = new URLSearchParams(location.search);
  const tab = (searchParams.get('tab') || 'all') as 'all' | 'verified' | 'mentions';
  const activeTab: 'all' | 'verified' | 'mentions' = tab;
  const displayNotifications = activeTab === 'mentions' ? mentionNotifications : notifications;

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <span className="text-pink-600">♥</span>;
      case 'retweet':
        return <span className="text-green-500">↻</span>;
      case 'follow':
        return <span className="text-blue-500">+</span>;
      case 'mention':
        return <span className="text-blue-500">@</span>;
      default:
        return <span className="text-blue-500">•</span>;
    }
  };

  return (
    <div className="flex flex-col pt-10 bg-app-bg min-h-full text-app-text">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden cursor-pointer" {...bindTap('notifications.drawer.open')}>
          {user.avatar && isActive ? (
            <XImage src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold">
              {user.name[0]}
            </div>
          )}
        </div>
        <div className="font-bold text-lg">{s.notifications_title}</div>
        <div className="w-6 text-center">⋯</div>
      </div>

      <div className="flex border-b border-app-border">
        <div className={`flex-1 text-center py-3 cursor-pointer hover:bg-black/5 transition relative ${activeTab === 'all' ? 'font-bold' : 'text-gray-500'}`} {...bindTap('notifications.tab.toAll')}>
          {s.notifications_tab_all}
          {activeTab === 'all' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-blue-500 rounded-full" />}
        </div>
        <div className={`flex-1 text-center py-3 cursor-pointer hover:bg-black/5 transition relative ${activeTab === 'verified' ? 'font-bold' : 'text-gray-500'}`} {...bindTap('notifications.tab.toVerified')}>
          {s.notifications_tab_verified}
          {activeTab === 'verified' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-blue-500 rounded-full" />}
        </div>
        <div className={`flex-1 text-center py-3 cursor-pointer hover:bg-black/5 transition relative ${activeTab === 'mentions' ? 'font-bold' : 'text-gray-500'}`} {...bindTap('notifications.tab.toMentions')}>
          {s.notifications_tab_mentions}
          {activeTab === 'mentions' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-blue-500 rounded-full" />}
        </div>
      </div>

      <div className="flex-1">
        {displayNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{s.notifications_empty}</div>
        ) : (
          displayNotifications.map(notification => (
            <div key={notification.id} className="border-b border-app-border p-4 flex gap-3">
              <div className="text-2xl w-8 text-right shrink-0 pt-1">{getIcon(notification.type)}</div>
              <div className="flex-1">
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mb-2">
                  {notification.actor.avatar && <img src={notification.actor.avatar} alt={notification.actor.name} className="w-full h-full object-cover" />}
                </div>
                <div className="text-app-text mb-1">
                  <span className="font-bold">{notification.actor.name}</span>
                  <span className="text-gray-500 ml-1">{notification.time}</span>
                </div>
                <div className="text-gray-300">{notification.content}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="fixed bottom-20 right-4 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-3xl shadow-lg cursor-pointer z-50">
        +
      </div>
    </div>
  );
};
