import React from 'react';
import { IcTabHome, IcTabMe, IcSearch, IcTabBell, IcTabSell } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useEbayGestures } from '../navigation';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useEbayStrings } from '../hooks/useEbayStrings';

const TabBar: React.FC<{ visible?: boolean }> = ({ visible: visibleProp }) => {
  const location = useLocation();
  const { bindTap } = useEbayGestures();
  const s = useEbayStrings();
  const currentPath = location.pathname;
  const isVisibleFromHook = useScrollDirection();
  const isVisible = visibleProp !== undefined ? visibleProp : isVisibleFromHook;

  const isActive = (path: string) => currentPath === path;
  
  // Only show tabs on main pages
  const showTabs = ['/', '/me', '/search', '/inbox', '/sell', '/categories'].includes(currentPath);

  if (!showTabs) return null;

  const activeColor = "text-blue-600";
  const inactiveColor = "text-app-text";

  return (
    <div 
        data-hide-on-keyboard
        className={`h-[60px] bg-app-surface border-t border-app-border flex justify-around items-center w-full pb-2 absolute bottom-0 left-0 right-0 z-[90] ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }}
    >
      <div
        {...bindTap('tab.home')}
        className={`flex flex-col items-center justify-center w-full cursor-pointer`}
      >
        <IcTabHome size={24} className={isActive('/') ? activeColor : inactiveColor} strokeWidth={isActive('/') ? 2.5 : 2} />
        <span className={`text-[10px] mt-1 ${isActive('/') ? activeColor : 'text-app-text-muted'}`}>{s.tab_home}</span>
      </div>

      <div
        {...bindTap('tab.me')}
        className={`flex flex-col items-center justify-center w-full cursor-pointer`}
      >
        <IcTabMe size={24} className={isActive('/me') ? activeColor : inactiveColor} strokeWidth={isActive('/me') ? 2.5 : 2} />
        <span className={`text-[10px] mt-1 ${isActive('/me') ? activeColor : 'text-app-text-muted'}`}>{s.tab_me}</span>
      </div>

      <div
        {...bindTap('tab.search')}
        className={`flex flex-col items-center justify-center w-full cursor-pointer`}
      >
        <IcSearch size={24} className={isActive('/search') ? activeColor : inactiveColor} strokeWidth={isActive('/search') ? 2.5 : 2} />
        <span className={`text-[10px] mt-1 ${isActive('/search') ? activeColor : 'text-app-text-muted'}`}>{s.tab_search}</span>
      </div>

      <div
        {...bindTap('tab.inbox')}
        className={`flex flex-col items-center justify-center w-full cursor-pointer`}
      >
        <IcTabBell size={24} className={isActive('/inbox') ? activeColor : inactiveColor} strokeWidth={isActive('/inbox') ? 2.5 : 2} />
        <span className={`text-[10px] mt-1 ${isActive('/inbox') ? activeColor : 'text-app-text-muted'}`}>{s.tab_inbox}</span>
      </div>

      <div
        {...bindTap('tab.sell')}
        className={`flex flex-col items-center justify-center w-full cursor-pointer`}
      >
        <IcTabSell size={24} className={isActive('/sell') ? activeColor : inactiveColor} strokeWidth={isActive('/sell') ? 2.5 : 2} />
        <span className={`text-[10px] mt-1 ${isActive('/sell') ? activeColor : 'text-app-text-muted'}`}>{s.tab_sell}</span>
      </div>
    </div>
  );
};

export default TabBar;
