import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpotifyStore } from '../state';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { AddToPlaylistSheet } from './AddToPlaylistSheet';
import type { SpotifyTrack } from '../types';

const TOAST_DURATION = 5000;

export const LikedToastBanner: React.FC = () => {
  const s = useSpotifyStrings();
  const [, setSearchParams] = useSearchParams();
  const likedToast = useSpotifyStore(st => st._temp.likedToast);
  const currentTrack = useSpotifyStore(st => st.currentTrack);
  const clearLikedToast = useSpotifyStore(st => st.clearLikedToast);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!likedToast) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      clearLikedToast();
    }, TOAST_DURATION);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [likedToast, clearLikedToast]);

  if (!likedToast) return null;

  return (
    <div
      data-hide-on-keyboard
      className="fixed left-2 right-2 z-[68]"
      style={{
        bottom: currentTrack
          ? 'calc(var(--app-bottom-player-bottom) + 76px)'
          : 'calc(var(--app-tab-bar-height) + 12px)',
      }}
    >
      <div className="flex h-11 items-center justify-between rounded-lg bg-white px-4 text-black shadow-2xl">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-lg leading-none">💚</span>
          <span className="truncate text-sm font-semibold">
            {s.liked_toast_added}
          </span>
        </div>
        <button
          onClick={() => {
            const trackId = likedToast.id;
            clearLikedToast();
            setSearchParams(p => { p.set('overlay', 'save_location'); p.set('overlayTrackId', trackId); return p; });
          }}
          className="flex-shrink-0 text-sm font-bold text-[#1DB954]"
        >
          {s.liked_toast_change}
        </button>
      </div>
    </div>
  );
};

export const SaveLocationSheet: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { bindBack, back } = useSpotifyGestures();

  const isOpen = searchParams.get('overlay') === 'save_location';
  const trackId = searchParams.get('overlayTrackId');

  const track = useSpotifyStore(st => {
    if (!trackId) return null;
    const inLiked = st.likedSongs.find(t => t.id === trackId);
    if (inLiked) return inLiked;
    const inQueue = st.queue.find(t => t.id === trackId);
    if (inQueue) return inQueue;
    if (st.currentTrack?.id === trackId) return st.currentTrack;
    return null;
  });

  if (!isOpen || !track) return null;

  return (
    <AddToPlaylistSheet
      isOpen
      track={track}
      titleVariant="saveLocation"
      backdropProps={bindBack({ stopPropagation: true })}
      onSelect={() => {}}
      onRemoveFromPlaylist={() => {}}
      onLike={() => {}}
      onClose={() => back()}
    />
  );
};

export function openSaveLocation(
  track: SpotifyTrack,
  setSearchParams: (fn: (p: URLSearchParams) => URLSearchParams) => void,
) {
  setSearchParams(p => { p.set('overlay', 'save_location'); p.set('overlayTrackId', track.id); return p; });
}
