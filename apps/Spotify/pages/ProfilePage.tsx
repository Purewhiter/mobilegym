import React from 'react';
import { useLocale } from '@/os/locale';
import { IcAdd, IcMoreVertical, IcMusic, IcNavBackArrow, IcSettings } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';
import { useSpotifyStore } from '../state';
import { SPOTIFY_CONFIG } from '../data';

export const ProfilePage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const s = useSpotifyStrings();
  const { bindTap, bindBack } = useSpotifyGestures();
  const customPlaylists = useSpotifyStore(s => s.customPlaylists);
  const user = SPOTIFY_CONFIG.user;

  return (
    <div
      data-scroll-container="main"
      data-scroll-direction="vertical"
      className="flex flex-col h-full bg-app-surface text-white p-4 pt-10 font-sans overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <button {...bindBack()} className="cursor-pointer">
          <IcNavBackArrow size={24} />
        </button>
        <div className="flex gap-4">
          <IcMoreVertical size={24} />
        </div>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className={`w-24 h-24 ${user.color || 'bg-amber-700'} rounded-full flex items-center justify-center text-4xl font-bold mb-4`}>
          {user.initial}
        </div>
        <h1 className="text-2xl font-bold mb-1">{user.name}</h1>
        <div className="text-gray-400 text-sm font-medium">
          {s.profile_followers_following.replace('{followers}', '0').replace('{following}', '3')}
        </div>
      </div>

      <div className="flex gap-4 justify-center mb-8">
        <button className="px-4 py-1.5 border border-gray-500 rounded-full text-sm font-bold active:scale-95 transition-transform">
          {s.profile_edit}
        </button>
        <button {...bindTap('settings.open')} className="px-4 py-1.5 border border-gray-500 rounded-full text-sm font-bold active:scale-95 transition-transform">
          <IcSettings size={18} />
        </button>
        <button className="px-4 py-1.5 border border-gray-500 rounded-full text-sm font-bold active:scale-95 transition-transform">
          <IcMoreVertical size={18} />
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-bold mb-4">{s.profile_playlists}</h2>

        {customPlaylists?.map((playlist) => (
          <div
            key={playlist.id}
            className="flex items-center gap-4 active:bg-white/10 p-2 -mx-2 rounded-lg transition-colors"
            {...bindTap('playlist.open', { params: { id: playlist.id } })}
          >
            <div className="w-12 h-12 bg-[#282828] flex items-center justify-center rounded">
              <span className="text-gray-400 text-lg font-bold">
                {localizeSpotifyText('title' in playlist ? playlist.title : playlist.name, isEnglish)?.[0] || <IcMusic size={20} />}
              </span>
            </div>
            <div>
              <div className="font-bold text-base">{localizeSpotifyText('title' in playlist ? playlist.title : playlist.name, isEnglish)}</div>
              <div className="text-gray-400 text-xs">{localizeSpotifyText('subtitle' in playlist ? playlist.subtitle : '', isEnglish)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-32 right-6">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-lg shadow-black/50 active:scale-95 transition-transform">
          <IcAdd size={24} />
        </div>
      </div>
    </div>
  );
};
