import React from 'react';
import { IcTabHome, IcTabCreate, IcTabChat, IcTabInbox } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRedditGestures } from '../hooks/useRedditGestures';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Reddit/${s}`; };

const ANSWERS_TAB_ICON_SRC = asset('tabbar/answers.png');

export const BottomTabBar: React.FC = () => {
  const { pathname } = useLocation();
  const { bindTap } = useRedditGestures();

  const getIconColor = (isActive: boolean) => isActive ? 'text-black' : 'text-app-text-muted';
  const getLabelClass = (isActive: boolean) => `text-[10px] mt-1 ${isActive ? 'text-black font-medium' : 'text-app-text-muted'}`;

  const isHome = pathname === '/';
  const isCommunities = pathname === '/communities';
  const isCreate = pathname === '/create';
  const isChat = pathname === '/chat';
  const isInbox = pathname === '/inbox';

  return (
    <div className="flex items-center justify-between px-2 py-2 bg-app-surface border-t border-app-border pb-5 relative z-[100] shadow-[0_-1px_3px_rgba(0,0,0,0.05)] shrink-0">
      {/* Home */}
      <div 
        {...bindTap('tab.home')}
        className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer active:bg-gray-100 transition-colors rounded-lg touch-manipulation"
      >
        <IcTabHome
          className={`w-6 h-6 ${getIconColor(isHome)} ${isHome ? 'fill-black' : ''}`}
          strokeWidth={2}
        />
        <span className={getLabelClass(isHome)}>Home</span>
      </div>

      {/* Communities */}
      <div 
        {...bindTap('tab.communities')}
        className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer active:bg-gray-100 transition-colors rounded-lg touch-manipulation"
      >
        <img
          src={ANSWERS_TAB_ICON_SRC}
          alt="Answers"
          className="w-9 h-9 object-contain"
          draggable={false}
          style={{
            opacity: isCommunities ? 1 : 0.55,
            filter: isCommunities ? 'none' : 'grayscale(1)',
          }}
          onError={(e) => {
            // if missing asset, don't show a broken icon
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className={getLabelClass(isCommunities)}>Answers</span>
      </div>

      {/* Create */}
      <div 
        {...bindTap('tab.create')}
        className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer active:bg-gray-100 transition-colors rounded-lg touch-manipulation"
      >
        <IcTabCreate className="w-8 h-8 text-app-text-muted font-light" strokeWidth={1.5} />
        <span className={getLabelClass(isCreate)}>Create</span>
      </div>

      {/* Chat */}
      <div 
        {...bindTap('tab.chat')}
        className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer active:bg-gray-100 transition-colors rounded-lg touch-manipulation"
      >
        <IcTabChat
          className={`w-6 h-6 ${getIconColor(isChat)} ${isChat ? 'fill-black' : ''}`}
          strokeWidth={2}
        />
        <span className={getLabelClass(isChat)}>Chat</span>
      </div>

      {/* Inbox */}
      <div 
        {...bindTap('tab.inbox')}
        className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer active:bg-gray-100 transition-colors rounded-lg touch-manipulation"
      >
        <IcTabInbox
          className={`w-6 h-6 ${getIconColor(isInbox)} ${isInbox ? 'fill-black' : ''}`}
          strokeWidth={2}
        />
        <span className={getLabelClass(isInbox)}>Inbox</span>
      </div>
    </div>
  );
};
