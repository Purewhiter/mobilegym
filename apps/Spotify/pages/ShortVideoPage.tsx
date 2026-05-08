import React from 'react';
import { useLocale } from '@/os/locale';
import { useParams } from 'react-router-dom';
import { IcHeart, IcMessage, IcMoreVertical, IcMusicNote, IcNavBackArrow, IcShare } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

export const ShortVideoPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindBack } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const { id } = useParams<{ id: string }>();

  const videoData = isEnglish
    ? {
        author: 'Evelyn Xu',
        fans: '8K',
        tags: ['#Mandopop', '#mood', '#TaiwanPop'],
        bg: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=800&q=80',
        track: {
          title: 'Across the Remembered Sea',
          artist: 'Evelyn Xu',
          cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&q=80',
        },
      }
    : {
        author: '徐隐翎',
        fans: '8K',
        tags: ['#华语流行音乐', '#情绪', '#台湾流行音乐'],
        bg: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=800&q=80',
        track: {
          title: '记忆之后海',
          artist: '徐隐翎',
          cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&q=80',
        },
      };

  return (
    <div className="relative h-full w-full bg-app-bg text-white overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={videoData.bg} className="w-full h-full object-cover opacity-80" alt="Video Background" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
      </div>

      <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
        <button {...bindBack()}><IcNavBackArrow size={28} /></button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold opacity-80">{s.video_now_playing}</span>
          <span className="text-base font-bold">{videoData.tags[0]}</span>
        </div>
        <div />
      </div>

      <div className="absolute bottom-32 right-4 z-20 flex flex-col gap-6 items-center">
        <div className="flex flex-col items-center gap-1">
          <IcHeart size={32} />
          <span className="text-xs">82K</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <IcMessage size={32} />
          <span className="text-xs">1024</span>
        </div>
        <IcShare size={32} />
        <IcMoreVertical size={32} />
      </div>

      <div className="absolute bottom-8 left-4 right-16 z-20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80" alt="avatar" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-bold flex items-center gap-2">
              {videoData.author}
              <button className="px-2 py-0.5 rounded border border-white/50 text-xs text-white/90">{s.video_follow}</button>
            </div>
            <div className="text-xs text-gray-300">{videoData.fans} {s.video_fans_suffix}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm font-bold mb-4 opacity-90">
          {videoData.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-lg p-2 pr-4 w-full max-w-xs">
          <img src={videoData.track.cover} className="w-10 h-10 rounded" alt="cover" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{videoData.track.title}</div>
            <div className="text-xs text-gray-300 truncate">{videoData.track.artist}</div>
          </div>
          <div className="rounded-full border border-white p-1">
            <IcMusicNote size={16} />
          </div>
        </div>
      </div>
    </div>
  );
};
