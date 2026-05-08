import React from 'react';
import { TopBar } from '../components/TopBar';
import { REDDIT_CONFIG } from '../data';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { useLocation } from 'react-router-dom';

export const InboxPage: React.FC = () => {
  const { assets } = REDDIT_CONFIG;
  const { bindTap } = useRedditGestures();
  const location = useLocation();
  
  // Parse current tab from search params or default to notifications
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'notifications';
  
  const isNotifications = currentTab === 'notifications';

  return (
    <div className="flex flex-col h-full bg-app-surface">
      <TopBar title="Inbox" rightAction="more" />
      
      {/* Tabs */}
      <div className="flex border-b border-app-border">
         <div 
           className="flex-1 flex flex-col items-center cursor-pointer"
           {...bindTap('inbox.tab.switch', { params: { tab: 'notifications' } })}
         >
            <span className={`py-3 font-bold text-sm ${isNotifications ? 'text-black' : 'text-app-text-muted'}`}>
              Notifications
            </span>
            {isNotifications && <div className="w-full h-0.5 bg-[#0045AC]"></div>}
         </div>
         
         <div 
           className="flex-1 flex flex-col items-center cursor-pointer"
           {...bindTap('inbox.tab.switch', { params: { tab: 'messages' } })}
         >
            <span className={`py-3 font-bold text-sm ${!isNotifications ? 'text-black' : 'text-app-text-muted'}`}>
              Messages
            </span>
            {!isNotifications && <div className="w-full h-0.5 bg-[#0045AC]"></div>}
         </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center p-8 text-center pb-32"
        data-scroll-container="main" 
        data-scroll-direction="vertical"
      >
        <div className="w-24 h-24 mb-4 rounded-full bg-gray-200 overflow-hidden relative">
          <img
            src={assets.emptyInbox}
            className="absolute inset-0 w-full h-full object-cover scale-[1.18] opacity-60"
            alt="Empty inbox"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        
        <p className="text-app-text-muted text-sm">
           Wow, such empty
        </p>
      </div>
    </div>
  );
};
