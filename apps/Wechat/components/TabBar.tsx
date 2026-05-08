import React from 'react';
import { useWechatStrings } from '../hooks/useWechatStrings';
import { IcTabWechat, IcTabContacts, IcTabDiscover, IcTabMe } from '../res/icons';
import { dimens } from '../res/dimens';
import { useLocation } from 'react-router-dom';
import { useWechatGestures } from '../hooks/useWechatGestures';
const TabBar: React.FC = () => {
  const t = useWechatStrings();
  const location = useLocation();
  const { bindTap, go } = useWechatGestures();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const showTabs = ['/', '/contacts', '/discover', '/me'].includes(currentPath);

  if (!showTabs) return null;

  const activeColor = "text-app-primary";
  const inactiveColor = "text-(--app-c-common-text-primary)";

  const handleTabClick = (path: string, transitionId: 'tab.wechat' | 'tab.contacts' | 'tab.discover' | 'tab.me') => {
    if (currentPath === path) return;
    go(transitionId);
  };

  return (
    <div className="h-(--app-item-height-65) bg-(--app-c-chat-input-bar-bg) border-t border-(--app-c-tw-border-gray-300) flex justify-around items-start w-full pt-2 absolute bottom-0 left-0 right-0 z-[90]">
      <div
        {...bindTap<HTMLDivElement>('tab.wechat', { onTrigger: () => handleTabClick('/', 'tab.wechat') })}
        className={`flex flex-col items-center justify-start w-full space-y-[2px] cursor-pointer`}
      >
        <div className={`relative ${isActive('/') ? activeColor : inactiveColor}`}>
          <IcTabWechat size={dimens.icSizeTab} fill={isActive('/') ? "currentColor" : "none"} strokeWidth={isActive('/') ? 0 : 1.5} />
        </div>
        <span className={`text-(--app-hint-text-size-10) ${isActive('/') ? activeColor : 'text-(--app-c-tw-text-gray-500)'}`}>{t.tab_wechat}</span>
      </div>

      <div
        {...bindTap<HTMLDivElement>('tab.contacts', { onTrigger: () => handleTabClick('/contacts', 'tab.contacts') })}
        className={`flex flex-col items-center justify-start w-full space-y-[2px] cursor-pointer`}
      >
        <div className={`${isActive('/contacts') ? activeColor : inactiveColor}`}>
          <IcTabContacts size={dimens.icSizeTab} fill={isActive('/contacts') ? "currentColor" : "none"} strokeWidth={isActive('/contacts') ? 0 : 1.5} />
        </div>
        <span className={`text-(--app-hint-text-size-10) ${isActive('/contacts') ? activeColor : 'text-(--app-c-tw-text-gray-500)'}`}>{t.tab_contacts}</span>
      </div>

      <div
        {...bindTap<HTMLDivElement>('tab.discover', { onTrigger: () => handleTabClick('/discover', 'tab.discover') })}
        className={`flex flex-col items-center justify-start w-full space-y-[2px] cursor-pointer`}
      >
        <div className={`${isActive('/discover') ? activeColor : inactiveColor}`}>
          <IcTabDiscover size={dimens.icSizeTab} fill={isActive('/discover') ? "currentColor" : "none"} strokeWidth={isActive('/discover') ? 0 : 1.5} />
        </div>
        <span className={`text-(--app-hint-text-size-10) ${isActive('/discover') ? activeColor : 'text-(--app-c-tw-text-gray-500)'}`}>{t.tab_discover}</span>
      </div>

      <div
        {...bindTap<HTMLDivElement>('tab.me', { onTrigger: () => handleTabClick('/me', 'tab.me') })}
        className={`flex flex-col items-center justify-start w-full space-y-[2px] cursor-pointer`}
      >
        <div className={`${isActive('/me') ? activeColor : inactiveColor}`}>
          <IcTabMe size={dimens.icSizeTab} fill={isActive('/me') ? "currentColor" : "none"} strokeWidth={isActive('/me') ? 0 : 1.5} />
        </div>
        <span className={`text-(--app-hint-text-size-10) ${isActive('/me') ? activeColor : 'text-(--app-c-tw-text-gray-500)'}`}>{t.tab_me}</span>
      </div>
    </div>
  );
};

export default TabBar;