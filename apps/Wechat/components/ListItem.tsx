import React from 'react';
import { IcNavForward } from '../res/icons';
import { dimens } from '../res/dimens';
import { DiscoverItem } from '../types';
interface ListItemProps {
  item: DiscoverItem;
  last?: boolean;
}

const ListItem: React.FC<ListItemProps> = ({ item, last }) => {
  return (
    <div className={`flex items-center bg-app-surface px-4 py-3.5 active:bg-(--app-c-tw-bg-gray-100) cursor-pointer ${!last ? 'border-b border-(--app-c-tw-border-gray-100)' : ''}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
      <div className="mr-4 relative">
        <div className={`w-6 h-6 flex items-center justify-center`}>
            {/* We use inline styles or specific generic coloring classes because Tailwind needs full classes at compile time */}
             <item.icon
                size={dimens.icSizeToolbar}
                className={`${item.iconColor}`}
                fill={item.name === "Moments" ? "none" : "currentColor"}
                stroke={item.name === "Moments" ? "currentColor" : "none"}
                strokeWidth={1.5}
            />
        </div>
      </div>
      
      <div className="flex-1 flex justify-between items-center">
        <span className="text-(--app-chat-bubble-text-size) text-app-text font-normal">{item.name}</span>
        <div className="flex items-center gap-2">
            {item.extraText && (
                <span className="text-(--app-c-tw-text-gray-400) text-sm">{item.extraText}</span>
            )}
            {item.notificationAvatar && (
                 <div className="relative">
                     <img src={item.notificationAvatar} alt="Notif" className="w-8 h-8 rounded-md" />
                     <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                 </div>
            )}
            {item.isNew && (
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-500 text-white text-(--app-hint-text-size-10) rounded-full">NEW</span>
                </div>
            )}
           <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-tw-text-gray-400) opacity-70" />
        </div>
      </div>
    </div>
  );
};

export default ListItem;
