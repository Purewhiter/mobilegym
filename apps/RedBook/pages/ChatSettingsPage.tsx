import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IcNavBack, IcNavForward } from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward;
import { useRedBookStore } from '../state';
import { useRedBookView } from '../data/view';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    actionProps?: React.HTMLAttributes<HTMLDivElement>;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, actionProps }) => {
    const { onClick: actionOnClick, ...restAction } = actionProps ?? {};
    return (
    <div
        className={`w-[44px] h-[24px] rounded-full relative transition-colors cursor-pointer ${checked ? 'bg-app-primary' : 'bg-[#e5e5e5]'}`}
        {...restAction}
        onClick={(e) => {
            if (actionOnClick) return actionOnClick(e);
            onChange(!checked);
        }}
    >
        <div className={`w-[20px] h-[20px] bg-app-surface rounded-full absolute top-[2px] transition-all shadow-sm ${checked ? 'left-[22px]' : 'left-[2px]'}`} />
    </div>
    );
};

export const ChatSettingsPage: React.FC = () => {
  const s = useRedBookStrings();
  const { userId } = useParams<{ userId: string }>();
  const me = useRedBookStore(s => s.user);
  const view = useRedBookView();
  const { bindBack, bindTap } = useRedBookGestures();
  const user = userId ? (userId === me.id ? me : view.usersById[userId]) : undefined;

  const [isPinned, setIsPinned] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isBlacklisted, setIsBlacklisted] = useState(false);

  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-[#f8f8f8]">
        {/* Header */}
        <div className="h-[44px] flex items-center px-3 bg-app-surface border-b border-gray-100 flex-shrink-0 z-10 sticky top-0 pt-10 pb-2 box-content">
            <div className="-ml-1 cursor-pointer" {...bindBack()}>
              <ChevronLeft size={28} className="text-app-text" strokeWidth={1.5} />
            </div>
        </div>

        <div
            className="flex-1 overflow-y-auto pb-8"
            data-scroll-container="main"
            data-scroll-direction="vertical"
        >
            {/* User Profile Info */}
            <div className="flex flex-col items-center pt-8 pb-8 bg-app-surface mb-2">
                <div className="w-[72px] h-[72px] rounded-full overflow-hidden mb-3">
                    <img src={user.avatar} className="w-full h-full object-cover" />
                </div>
                <h2 className="text-[18px] font-medium text-app-text mb-4">{user.name}</h2>
                <button className="px-6 py-1.5 border border-[#ddd] rounded-full text-[13px] text-[#666]">
                    {s.following_2}
                </button>
            </div>

            {/* Menu Items */}
            <div className="px-3 space-y-3">
                {/* Set Remark */}
                <div className="bg-app-surface rounded-[12px] px-4 flex items-center justify-between py-4 cursor-pointer active:scale-[0.99] transition-transform">
                    <span className="text-[15px] text-app-text">{s.set_nickname}</span>
                    <ChevronRight size={16} className="text-[#ccc]" />
                </div>

                {/* Search History */}
                <div className="bg-app-surface rounded-[12px] px-4 flex items-center justify-between py-4 cursor-pointer active:scale-[0.99] transition-transform">
                    <span className="text-[15px] text-app-text">{s.search_chat_history}</span>
                    <ChevronRight size={16} className="text-[#ccc]" />
                </div>

                {/* Toggle Group */}
                <div className="bg-app-surface rounded-[12px] px-4">
                    <div className="flex items-center justify-between py-3.5 border-b border-gray-50">
                        <span className="text-[15px] text-app-text">{s.chatsettingspage_pin}</span>
                        <Switch
                            checked={isPinned}
                            onChange={setIsPinned}
                            actionProps={bindTap({ kind: 'action', id: 'chat.settings.pinned.toggle' }, { params: { to: !isPinned }, onTrigger: () => setIsPinned(!isPinned) })}
                        />
                    </div>
                    <div className="flex items-center justify-between py-3.5 border-b border-gray-50">
                        <span className="text-[15px] text-app-text">{s.mute_notifications}</span>
                        <Switch
                            checked={isMuted}
                            onChange={setIsMuted}
                            actionProps={bindTap({ kind: 'action', id: 'chat.settings.muted.toggle' }, { params: { to: !isMuted }, onTrigger: () => setIsMuted(!isMuted) })}
                        />
                    </div>
                    <div className="flex items-center justify-between py-3.5">
                        <span className="text-[15px] text-app-text">{s.block}</span>
                        <Switch
                            checked={isBlacklisted}
                            onChange={setIsBlacklisted}
                            actionProps={bindTap({ kind: 'action', id: 'chat.settings.blacklist.toggle' }, { params: { to: !isBlacklisted }, onTrigger: () => setIsBlacklisted(!isBlacklisted) })}
                        />
                    </div>
                </div>

                {/* Report */}
                <div className="bg-app-surface rounded-[12px] px-4 flex items-center justify-between py-4 cursor-pointer active:scale-[0.99] transition-transform">
                    <span className="text-[15px] text-app-text">{s.report}</span>
                    <ChevronRight size={16} className="text-[#ccc]" />
                </div>

                {/* Clear History */}
                <div className="bg-app-surface rounded-[12px] px-4 flex items-center justify-center py-4 cursor-pointer active:scale-[0.99] transition-transform">
                    <span className="text-[15px] text-app-text">{s.clear_chat_history}</span>
                </div>
            </div>
        </div>
    </div>
  );
};
