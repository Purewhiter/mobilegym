import React from 'react';
import { useLocale } from '@/os/locale';
import { useSearchParams } from 'react-router-dom';
import { IcPlay, IcPause, IcMic, IcAddCircle, IcLikedIndicator } from '../res/icons';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useShallow } from 'zustand/react/shallow';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';
import { openSaveLocation } from './LikedToast';

export const BottomPlayer: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [, setSearchParams] = useSearchParams();
  const { currentTrack, isPlaying } = useSpotifyStore(useShallow(s => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying })));
  const togglePlay = useSpotifyStore(s => s.togglePlay);
  const toggleLike = useSpotifyStore(s => s.toggleLike);
  const likedSongIds = useSpotifyStore(selectLikedSongIds);
  const isLiked = (trackId: string, track?: { title: string; artist: string }) => likedSongIds.has(trackId, track);
  const { bindTap } = useSpotifyGestures();

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id, currentTrack);
  const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);

  return (
    <div data-hide-on-keyboard className="absolute left-2 right-2 bottom-(--app-bottom-player-bottom) z-[65]" {...bindTap('player.open')}>
      <div className="bg-[#302b28] text-white rounded-lg flex items-center px-4 py-3 gap-3 shadow-2xl overflow-hidden relative">
        <div className="flex-1 min-w-0 flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-700 flex-shrink-0">
            <img src={currentTrack.cover} alt={displayText(currentTrack.title)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-base font-bold truncate">{displayText(currentTrack.title)}</div>
            <div className="text-xs text-gray-400 truncate">{displayText(currentTrack.artist)}</div>
          </div>
        </div>
        <div className="flex items-center gap-5 pr-1">
          <IcMic size={32} className="text-white" strokeWidth={1.5} />

          <button
            {...bindTap(
              { kind: 'action', id: 'track.like.toggle' },
              {
                params: { trackId: currentTrack.id, to: !liked },
                onTrigger: () => {
                  if (liked) {
                    openSaveLocation(currentTrack!, setSearchParams);
                  } else {
                    toggleLike(currentTrack!);
                  }
                },
                stopPropagation: true,
              },
            )}
          >
            {liked ? (
              <IcLikedIndicator size={32} />
            ) : (
              <IcAddCircle size={32} className="text-white" strokeWidth={1.5} />
            )}
          </button>

          <button
            {...bindTap(
              { kind: 'action', id: 'track.play.toggle' },
              {
                params: { trackId: currentTrack.id, to: !isPlaying },
                onTrigger: () => togglePlay(),
                stopPropagation: true,
              },
            )}
            className="text-white active:scale-95 flex-shrink-0"
          >
            {isPlaying ? <IcPause size={32} fill="white" /> : <IcPlay size={32} fill="white" />}
          </button>
        </div>

        {/* Progress Bar fixed to bottom edge */}
        <div className="absolute left-2 right-2 bottom-0 h-(--app-bottom-player-progress-height) bg-white/10 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-white w-1/3 rounded-full" />
        </div>
      </div>
    </div>
  );
};
