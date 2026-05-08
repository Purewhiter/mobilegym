import React from 'react';
import { Header, LinkRow } from '../../components/SettingsComponents';
import { useSpotifyStrings } from '../../hooks/useSpotifyStrings';

export const NotificationsPage: React.FC = () => {
  const s = useSpotifyStrings();

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40">
      <Header title={s.notifications_title} />

      <div className="bg-[#242424] rounded-lg p-4 mb-6">
        <div className="text-white font-bold text-lg mb-2">{s.notifications_disabled_title}</div>
        <div className="text-gray-400 text-sm mb-4">{s.notifications_disabled_desc}</div>
        <button className="bg-app-accent text-black font-bold text-sm px-4 py-2 rounded-full active:scale-95 transition-transform">
          {s.notifications_go_to_settings}
        </button>
      </div>

      <div className="text-gray-400 text-sm mb-4">{s.notifications_choose_desc}</div>

      <div className="space-y-1">
        <LinkRow title={s.notifications_music_artists} desc={s.notifications_off} />
        <LinkRow title={s.notifications_podcasts_shows} desc={s.notifications_off} />
        <LinkRow title={s.notifications_new_episodes} desc={s.notifications_new_episodes_desc} />
        <LinkRow title={s.notifications_audiobooks} desc={s.notifications_off} />
        <LinkRow title={s.notifications_privacy_features} desc={s.notifications_privacy_features_desc} />
        <LinkRow title={s.notifications_concerts} desc={s.notifications_off} />
        <LinkRow title={s.notifications_virtual_events} desc={s.notifications_off} />
      </div>
    </div>
  );
};
