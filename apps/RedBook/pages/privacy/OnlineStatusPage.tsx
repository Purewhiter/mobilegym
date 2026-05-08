import { useRedBookStrings } from '../../hooks/useRedBookStrings';
import React, { useState } from 'react';
import { IcNavBack, IcCheck } from '../../res/icons';
const ChevronLeft = IcNavBack, Check = IcCheck;
import { useRedBookStore } from '../../state';
import { useRedBookGestures } from '../../hooks/useRedBookGestures';
const OnlineStatusPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindBack, bindTap } = useRedBookGestures();
  const user = useRedBookStore(s => s.user);
  const [selected, setSelected] = useState<'public' | 'friends' | 'closed'>('friends');

  const options = [
    { key: 'public', label: s.public_visible_to_all },
    { key: 'friends', label: s.friends_visible_to_mutual_followers },
    { key: 'closed', label: s.off_hidden_from_everyone },
  ];

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.online_status}</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="flex flex-col items-center py-8">
          <div className="relative">
              <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-100">
                  <img src={user.avatar} className="w-full h-full object-cover" />
              </div>
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#00c853] rounded-full border-2 border-app-border"></div>
          </div>
          <p className="mt-6 px-6 text-[13px] text-app-text-muted text-center leading-relaxed">
              {s.both_can_see_online_status_group_chats_show}
          </p>
        </div>
  
        <div className="bg-app-surface mx-3 rounded-xl overflow-hidden">
          {options.map((opt, idx) => (
              <div 
                  key={opt.key}
                  className={`flex items-center justify-between px-4 py-4 active:bg-gray-50 ${idx !== options.length - 1 ? 'border-b border-gray-50' : ''}`}
                  {...(opt.key === 'public'
                    ? bindTap({ kind: 'action', id: 'settings.privacy.onlineStatus.select.public' }, { onTrigger: () => setSelected('public') })
                    : opt.key === 'friends'
                      ? bindTap({ kind: 'action', id: 'settings.privacy.onlineStatus.select.friends' }, { onTrigger: () => setSelected('friends') })
                      : bindTap({ kind: 'action', id: 'settings.privacy.onlineStatus.select.closed' }, { onTrigger: () => setSelected('closed') }))}
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

export default OnlineStatusPage;