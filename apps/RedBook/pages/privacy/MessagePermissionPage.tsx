import { useRedBookStrings } from '../../hooks/useRedBookStrings';
import React, { useState } from 'react';
import { IcNavBack, IcCheck } from '../../res/icons';
const ChevronLeft = IcNavBack, Check = IcCheck;
import { useRedBookGestures } from '../../hooks/useRedBookGestures';
const MessagePermissionPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindBack, bindTap } = useRedBookGestures();
  const [selected, setSelected] = useState<'default' | 'following' | 'mutual' | 'none'>('following');

  const options = [
    { key: 'default', label: s.default },
    { key: 'following', label: s.people_i_follow },
    { key: 'mutual', label: s.mutual_followers },
    { key: 'none', label: s.disable_dm },
  ];

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.who_can_dm_me}</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="px-4 py-3 text-[12px] text-app-text-muted">
          {s.choose_who_can_dm_me}
        </div>
  
        <div className="bg-app-surface mx-3 rounded-xl overflow-hidden">
          {options.map((opt, idx) => (
              <div 
                  key={opt.key}
                  className={`flex items-center justify-between px-4 py-4 active:bg-gray-50 ${idx !== options.length - 1 ? 'border-b border-gray-50' : ''}`}
                  {...(opt.key === 'default'
                    ? bindTap({ kind: 'action', id: 'settings.privacy.messagePermission.select.default' }, { onTrigger: () => setSelected('default') })
                    : opt.key === 'following'
                      ? bindTap({ kind: 'action', id: 'settings.privacy.messagePermission.select.following' }, { onTrigger: () => setSelected('following') })
                      : opt.key === 'mutual'
                        ? bindTap({ kind: 'action', id: 'settings.privacy.messagePermission.select.mutual' }, { onTrigger: () => setSelected('mutual') })
                        : bindTap({ kind: 'action', id: 'settings.privacy.messagePermission.select.none' }, { onTrigger: () => setSelected('none') }))}
              >
                  <span className="text-[15px] text-app-text">{opt.label}</span>
                  {selected === opt.key && <Check size={20} className="text-app-primary" />}
              </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MessagePermissionPage;