import { useRedBookStrings } from '../hooks/useRedBookStrings';

import React from 'react';
import { useLocation } from 'react-router-dom';
import { IcAdd } from '../res/icons';
const Plus = IcAdd;
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import homeIcon from '../assets/tabbar/home.png';
import homeActiveIcon from '../assets/tabbar/home_activate.png';
import shopIcon from '../assets/mall/shopCart_2x.png'; // Using shopCart as the closest match for Market
import addIcon from '../assets/tabbar/add-one.png';
import msgIcon from '../assets/tabbar/message.png';
import msgActiveIcon from '../assets/tabbar/message_activate.png';
import meIcon from '../assets/tabbar/people.png';
import meActiveIcon from '../assets/tabbar/people_activate.png';
import { routes } from '../routes';

export const TabBar: React.FC = () => {
  const location = useLocation();
  const { pathname } = location;
  const searchParams = new URLSearchParams(location.search);
  const showPublishSheet = searchParams.get('modal') === 'publish';
  const { bindNav, bindBack } = useRedBookGestures();
  const s = useRedBookStrings();

  const tabs = [
    {
      key: 'home',
      path: '/',
      icon: homeIcon,
      activeIcon: homeActiveIcon,
      label: s.home,
    },
    {
      key: 'market',
      path: '/market',
      icon: shopIcon,
      activeIcon: shopIcon, // No active state found for shopCart, using same icon
      label: s.shop,
    },
    {
      key: 'publish',
      path: '/publish',
      icon: addIcon,
      activeIcon: addIcon,
      label: s.post,
      isBig: true,
    },
    {
      key: 'message',
      path: '/message',
      icon: msgIcon,
      activeIcon: msgActiveIcon,
      label: s.messages,
    },
    {
      key: 'me',
      path: '/me',
      icon: meIcon,
      activeIcon: meActiveIcon,
      label: s.tabbar_me,
    },
  ];

  return (
    <>
    <div data-hide-on-keyboard className="flex-shrink-0 h-[85px] bg-app-surface border-t border-gray-100 flex items-center justify-around pb-[20px]">
      {tabs.map((tab) => {
        // Strict matching for root, partial matching for nested routes if needed
        const isActive = tab.path === '/'
            ? pathname === '/'
            : pathname === tab.path || pathname.startsWith(tab.path + '/');
        
        if (tab.isBig) {
          const openPublishProps =
            pathname === '/'
              ? bindNav(routes.home, { search: { modal: 'publish' }, keep: ['tab'] })
              : pathname === '/market'
                ? bindNav(routes.market, { search: { modal: 'publish' } })
                : pathname === '/message'
                  ? bindNav(routes.message, { search: { modal: 'publish' } })
                  : bindNav(routes.me, { search: { modal: 'publish' }, keep: ['tab', 'sub'] });

          return (
            <div
              key={tab.key}
              className="flex flex-col items-center justify-center w-[20%]"
              {...openPublishProps}
            >
              <div className="w-[48px] h-[34px] bg-app-primary rounded-[10px] flex items-center justify-center">
                <Plus className="text-white w-6 h-6" strokeWidth={3} />
              </div>
            </div>
          );
        }

        const tabTriggerProps =
          tab.key === 'home'
            ? bindNav(routes.home, { search: { tab: 'discover' }, replace: true })
            : tab.key === 'market'
              ? bindNav(routes.market, { replace: true })
              : tab.key === 'message'
                ? bindNav(routes.message, { replace: true })
                : bindNav(routes.me, { search: { tab: 'notes', sub: 'public' }, replace: true });

        return (
          <div
            key={tab.key}
            className="flex flex-col items-center justify-center w-[20%] active:scale-95 transition-transform"
            {...(!isActive ? tabTriggerProps : {})}
          >
            <span className={`text-[18px] ${isActive ? 'text-black font-bold' : 'text-gray-500 font-medium'}`}>
              {tab.label}
            </span>
          </div>
        );
      })}
    </div>

    {showPublishSheet && (
       <div className="fixed inset-0 z-[100]">
         <div className="absolute inset-0 bg-black/40" {...bindBack()} />
         <div className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-[16px] overflow-hidden">
           <div className="text-center py-4 text-[18px] text-app-text border-b border-gray-100">{s.choose_from_album}</div>
           <div className="text-center py-4 text-[18px] text-app-text border-b border-gray-100">{s.shoot_and_live}</div>
           <div
             className="text-center py-4 text-[18px] text-app-text border-b border-gray-100"
             {...bindNav(routes.publishText, { replace: true })}
           >
             {s.write_text}
           </div>
           <div className="text-center py-4 text-[18px] text-app-text" {...bindBack()}>{s.cancel}</div>
         </div>
       </div>
    )}
    </>
  );
};
