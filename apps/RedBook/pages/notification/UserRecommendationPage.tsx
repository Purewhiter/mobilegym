import { useRedBookStrings } from '../../hooks/useRedBookStrings';
import React, { useState } from 'react';
import { IcNavBack, IcCheck } from '../../res/icons';
const ChevronLeft = IcNavBack, Check = IcCheck;
import { useRedBookGestures } from '../../hooks/useRedBookGestures';
const ListItem = ({ 
    label, 
    isSelected,
    isLast = false,
    ...props
}: { 
    label: string, 
    isSelected: boolean,
    isLast?: boolean
    [key: string]: any
}) => (
    <div 
      className={`flex items-center justify-between px-4 py-5 active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-50' : ''}`}
      {...props}
    >
        <span className="text-[16px] text-app-text">{label}</span>
        {isSelected && <Check size={20} className="text-app-primary" />}
    </div>
);

const UserRecommendationPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindBack, bindTap } = useRedBookGestures();
  const [selected, setSelected] = useState('none');

  const options = [
    { id: 'all', label: s.searchpage_all },
    { id: 'know', label: s.people_i_may_know_only },
    { id: 'like', label: s.authors_i_may_like_only },
    { id: 'none', label: s.notificationsettingspage_off },
  ];

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.user_recommendations}</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-3 pt-2"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="bg-app-surface rounded-xl mt-2 overflow-hidden">
          {options.map((opt, index) => (
            <ListItem
              label={opt.label}
              isSelected={selected === opt.id}
              {...(opt.id === 'all'
                ? bindTap({ kind: 'action', id: 'settings.notification.user.select.all' }, { onTrigger: () => setSelected('all') })
                : opt.id === 'know'
                  ? bindTap({ kind: 'action', id: 'settings.notification.user.select.know' }, { onTrigger: () => setSelected('know') })
                  : opt.id === 'like'
                    ? bindTap({ kind: 'action', id: 'settings.notification.user.select.like' }, { onTrigger: () => setSelected('like') })
                    : bindTap({ kind: 'action', id: 'settings.notification.user.select.none' }, { onTrigger: () => setSelected('none') }))}
              isLast={index === options.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserRecommendationPage;