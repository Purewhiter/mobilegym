import React from 'react';
import { Header, SectionHeader } from '../../components/SettingsComponents';
import { SpotifyLogoIcon } from '../../res/icons';
import { useSpotifyStore } from '../../state';
import { useSpotifyStrings } from '../../hooks/useSpotifyStrings';

export const AccountPage: React.FC = () => {
  const s = useSpotifyStrings();
  const currentUser = useSpotifyStore((state) => state.currentUser);

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40">
      <Header title={s.account_title} />

      <SectionHeader title={s.account_details} />
      <div className="mb-6">
        <div className="text-white text-base font-medium mb-1">{s.account_username}</div>
        <div className="text-gray-400 text-sm break-all">{currentUser?.name || '316avvwz2ualIkpgmpmtuq4vc2ui'}</div>
      </div>

      <SectionHeader title={s.account_plan} />
      <div className="bg-[#242424] rounded-lg p-4 flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-app-surface flex items-center justify-center rounded">
            <SpotifyLogoIcon size={24} fill="white" />
          </div>
          <div>
            <div className="text-lg font-bold">{s.account_free_plan}</div>
            <div className="text-xs text-gray-400">{s.account_view_plan}</div>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-400 mt-auto">
        {s.account_delete_hint}
      </div>
    </div>
  );
};
