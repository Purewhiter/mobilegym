import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { IcAdd, IcBell, IcCompose, IcHistory, IcSettings, IcTrend, IcZap } from '../res/icons';
import { useSpotifyStore } from '../state';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  backdropProps: React.HTMLAttributes<HTMLDivElement>;
  profileOpenProps: React.HTMLAttributes<HTMLDivElement>;
  addAccountProps: React.HTMLAttributes<HTMLDivElement>;
  whatsNewOpenProps: React.HTMLAttributes<HTMLDivElement>;
  historyOpenProps: React.HTMLAttributes<HTMLDivElement>;
  settingsOpenProps: React.HTMLAttributes<HTMLDivElement>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  backdropProps,
  profileOpenProps,
  addAccountProps,
  whatsNewOpenProps,
  historyOpenProps,
  settingsOpenProps,
}) => {
  const s = useSpotifyStrings();
  const { currentUser, accounts } = useSpotifyStore(useShallow((state) => ({
    currentUser: state.currentUser,
    accounts: state.accounts ?? [],
  })));
  const switchAccount = useSpotifyStore((state) => state.switchAccount);

  const handleSwitch = (userId: string) => {
    switchAccount(userId);
    onClose();
  };

  const { className: backdropClassName, ...backdropRest } = backdropProps ?? {};
  const { className: profileOpenClassName, ...profileOpenRest } = profileOpenProps ?? {};
  const { className: addAccountClassName, ...addAccountRest } = addAccountProps ?? {};
  const { className: whatsNewClassName, ...whatsNewRest } = whatsNewOpenProps ?? {};
  const { className: historyClassName, ...historyRest } = historyOpenProps ?? {};
  const { className: settingsClassName, ...settingsRest } = settingsOpenProps ?? {};

  return (
    <>
      <div
        {...backdropRest}
        className={`fixed inset-0 bg-black/50 z-[90] ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${backdropClassName ?? ''}`}
        style={{ transition: 'opacity var(--app-duration-medium) var(--app-easing-standard)' }}
      />

      <div
        className={`fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-[#191919] z-[100] transform shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-decelerate)' }}
      >
        <div className="flex flex-col h-full text-white p-6 pt-12 overflow-y-auto">
          {/* User profile section */}
          <div
            {...profileOpenRest}
            className={`flex items-center gap-4 mb-2 ${profileOpenClassName ?? ''}`}
          >
            <div className={`w-12 h-12 ${currentUser?.color || 'bg-amber-700'} rounded-full flex items-center justify-center text-xl font-bold`}>
              {currentUser?.initial || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg">{currentUser?.name || 'User'}</div>
              <div className="text-gray-400 text-xs">{s.sidebar_view_profile}</div>
            </div>
            <div className="px-3 py-1.5 rounded-full border border-white/30 text-xs text-white/80 whitespace-nowrap">
              {s.sidebar_activity_off}
            </div>
          </div>

          <div className="w-full h-[1px] bg-white/10 my-6" />

          {/* Multi-account section */}
          {accounts.length > 1 && (
            <div className="mb-6 overflow-x-auto scrollbar-hide">
              <div className="flex items-start gap-4 h-[90px]">
                {accounts.filter((user) => user.id !== currentUser?.id).map((user) => (
                  <div key={user.id} className="flex flex-col items-center gap-2 min-w-[60px]" onClick={() => handleSwitch(user.id)}>
                    <div className={`w-10 h-10 rounded-full ${user.color || 'bg-gray-600'} flex items-center justify-center text-sm font-bold border border-transparent active:scale-95 transition-transform`}>
                      {user.initial}
                    </div>
                    <div className="text-[10px] text-gray-300 text-center leading-tight truncate w-14">
                      {user.name}
                    </div>
                  </div>
                ))}

                <div
                  {...addAccountRest}
                  className={`flex flex-col items-center gap-2 min-w-[60px] ${addAccountClassName ?? ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#3E3E3E] flex items-center justify-center text-white active:scale-95 transition-transform">
                    <IcAdd size={20} />
                  </div>
                  <div className="text-[10px] text-gray-300 text-center leading-tight">
                    {s.sidebar_add_account}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Menu items */}
          <div className="space-y-1">
            {accounts.length <= 1 && (
              <div
                {...addAccountRest}
                className={`flex items-center gap-5 active:bg-white/5 py-3 px-2 -mx-2 rounded transition-colors ${addAccountClassName ?? ''}`}
              >
                <IcAdd size={28} strokeWidth={1.5} />
                <span className="text-[15px] font-medium">{s.sidebar_add_account}</span>
              </div>
            )}

            <div
              {...whatsNewRest}
              className={`flex items-center gap-5 active:bg-white/5 py-3 px-2 -mx-2 rounded transition-colors ${whatsNewClassName ?? ''}`}
            >
              <IcZap size={28} />
              <span className="text-[15px] font-medium">{s.sidebar_whats_new}</span>
            </div>

            <div className="flex items-center gap-5 active:bg-white/5 py-3 px-2 -mx-2 rounded transition-colors">
              <IcTrend size={28} />
              <span className="text-[15px] font-medium">{s.sidebar_listening_stats}</span>
            </div>

            <div
              {...historyRest}
              className={`flex items-center gap-5 active:bg-white/5 py-3 px-2 -mx-2 rounded transition-colors ${historyClassName ?? ''}`}
            >
              <IcHistory size={28} />
              <span className="text-[15px] font-medium">{s.sidebar_recent_played}</span>
            </div>

            <div className="flex items-center gap-5 active:bg-white/5 py-3 px-2 -mx-2 rounded transition-colors">
              <IcBell size={28} />
              <span className="text-[15px] font-medium">{s.sidebar_your_updates}</span>
            </div>

            <div
              {...settingsRest}
              className={`flex items-center gap-5 active:bg-white/5 py-3 px-2 -mx-2 rounded transition-colors ${settingsClassName ?? ''}`}
            >
              <IcSettings size={28} />
              <span className="text-[15px] font-medium">{s.sidebar_settings_privacy}</span>
            </div>
          </div>

          {/* Messages section */}
          <div className="mt-8">
            <div className="text-xl font-bold mb-2">{s.sidebar_messages}</div>
            <div className="text-sm text-gray-400 leading-relaxed mb-5">
              {s.sidebar_messages_desc}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#3E3E3E] flex items-center justify-center">
                <IcCompose size={20} />
              </div>
              <span className="text-sm font-medium">{s.sidebar_new_message}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
