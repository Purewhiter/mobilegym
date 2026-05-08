import React, { useRef } from 'react';
import { useLocale } from '@/os/locale';
import { IcAdd, IcHeart, IcAddCircle, IcLikedIndicator } from '../res/icons';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import type { SpotifyPlaylist, SpotifyTrack } from '../types';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';

interface Props {
  isOpen: boolean;
  track: SpotifyTrack;
  /** 与「加入歌单」同一套 UI；`saveLocation` 仅替换标题文案（如搜索页已保存曲目） */
  titleVariant?: 'default' | 'saveLocation';
  backdropProps?: React.HTMLAttributes<HTMLDivElement>;
  onSelect: (name: string) => void;
  onRemoveFromPlaylist?: (name: string) => void;
  onLike?: () => void;
  onClose: () => void;
}

export const AddToPlaylistSheet: React.FC<Props> = ({
  isOpen, track, titleVariant = 'default', backdropProps, onSelect, onRemoveFromPlaylist, onLike, onClose,
}) => {
  const dragStartY = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);
  const { go } = useSpotifyGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const s = useSpotifyStrings();

  // Drag state lives in refs so pointer callbacks stay stable
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef(0);
  const [renderDragOffset, setRenderDragOffset] = React.useState(0);

  const DISMISS_THRESHOLD = 80;

  // Subscribe to store directly for live updates
  const customPlaylists = useSpotifyStore(s => s.customPlaylists);
  const likedSongIds = useSpotifyStore(selectLikedSongIds);
  const toggleLike = useSpotifyStore(s => s.toggleLike);
  const addTrackToPlaylist = useSpotifyStore(s => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = useSpotifyStore(s => s.removeTrackFromPlaylist);

  const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);

  const trackLiked = likedSongIds.has(track.id, track);

  const unique = (() => {
    const s = new Set<string>();
    return (customPlaylists || []).filter(pl => {
      const k = (pl as any).title || pl.id;
      if (s.has(k)) return false;
      s.add(k);
      return true;
    }) as SpotifyPlaylist[];
  })();

  const checkInPlaylist = (title: string): boolean => {
    const pl = (customPlaylists || []).find(p => (p as any).title === title) as any;
    if (!pl) return false;
    const ids: string[] = pl.trackIds || [];
    const stored: any[] = pl.storedTracks || [];
    const tN = track.title.trim().toLowerCase();
    const aN = track.artist.trim().toLowerCase();
    return ids.includes(track.id) || stored.some((t: any) => t.title?.trim().toLowerCase() === tN && t.artist?.trim().toLowerCase() === aN);
  };

  const containingPlaylists = unique.filter(pl => checkInPlaylist((pl as any).title));
  const otherPlaylists = unique.filter(pl => !checkInPlaylist((pl as any).title));

  const handlePlaylistClick = (pl: SpotifyPlaylist) => {
    const title = (pl as any).title;
    if (checkInPlaylist(title)) {
      // Find the actual stored track ID (might differ from track.id due to title+artist match)
      const plData = (customPlaylists || []).find(p => (p as any).title === title) as any;
      const ids: string[] = plData?.trackIds || [];
      const stored: any[] = plData?.storedTracks || [];
      const tN = track.title.trim().toLowerCase();
      const aN = track.artist.trim().toLowerCase();
      // Remove by exact ID first, then by title+artist match
      let idToRemove = ids.includes(track.id) ? track.id : '';
      if (!idToRemove) {
        const matched = stored.find((t: any) => t.title?.trim().toLowerCase() === tN && t.artist?.trim().toLowerCase() === aN);
        if (matched) idToRemove = matched.id;
      }
      if (idToRemove) removeTrackFromPlaylist(title, idToRemove);
      onRemoveFromPlaylist?.(title);
    } else {
      addTrackToPlaylist(title, track);
      onSelect(title);
    }
  };

  const handleCreateNew = () => {
    useSpotifyStore.setState({ pendingPlaylistTrack: track });
    go('create.naming.directOpen');
  };

  const handleLike = () => {
    toggleLike(track);
    onLike?.();
  };

  const onPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    isDraggingRef.current = true;
    dragOffsetRef.current = 0;
    barRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    const maxOffset = typeof window !== 'undefined' ? window.innerHeight : 1000;
    const clamped = Math.min(dy, maxOffset);
    dragOffsetRef.current = clamped;
    setRenderDragOffset(clamped);
  }, []);

  const onPointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (barRef.current?.hasPointerCapture(e.pointerId)) {
      barRef.current.releasePointerCapture(e.pointerId);
    }
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const offset = dragOffsetRef.current;
    dragOffsetRef.current = 0;
    setRenderDragOffset(0);
    if (offset >= DISMISS_THRESHOLD) {
      onClose();
    }
  }, [onClose]);

  React.useEffect(() => {
    if (isOpen) return;
    isDraggingRef.current = false;
    dragOffsetRef.current = 0;
    setRenderDragOffset(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const PlaylistRow = ({ pl, inPlaylist }: { pl: SpotifyPlaylist; inPlaylist: boolean }) => (
    <button
      onClick={() => handlePlaylistClick(pl)}
      className={`w-full flex items-center justify-between py-3 active:bg-white/5 rounded px-2 text-white ${inPlaylist ? 'border-b border-gray-700/30' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded overflow-hidden bg-gray-700 flex-shrink-0">
          {pl.cover ? <img src={pl.cover} alt={displayText((pl as any).title)} className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
        </div>
        <div className="text-left">
          <div className="text-base font-medium">{displayText((pl as any).title)}</div>
          <div className="text-xs text-gray-400">{displayText((pl as any).subtitle) || s.add_to_playlist_default_subtitle}</div>
        </div>
      </div>
      {inPlaylist
        ? <IcLikedIndicator size={28} />
        : <IcAddCircle size={28} className="text-gray-400" strokeWidth={1.5} />
      }
    </button>
  );

  return (
    <>
      <div {...backdropProps} className="fixed inset-0 bg-black/60 z-[70] backdrop-blur-sm transition-opacity" />
      <div
        className="fixed bottom-0 left-0 right-0 h-[90%] bg-app-surface z-[71] flex flex-col rounded-t-[20px] overflow-hidden shadow-2xl"
        style={{
          transform: `translateY(${renderDragOffset}px)`,
          transition: !isDraggingRef.current ? 'transform var(--app-duration-short) var(--app-easing-decelerate)' : undefined,
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={e => e.buttons === 0 && onPointerUp(e)}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Drag handle */}
        <div
          ref={barRef}
          className="w-full flex cursor-grab items-center justify-center pt-3 pb-2"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 flex items-center justify-between">
          <div className="text-xl font-bold text-white">
            {titleVariant === 'saveLocation' ? s.save_location_title : s.add_to_playlist_title}
          </div>
          <button
            onClick={handleCreateNew}
            className="text-app-accent text-sm font-bold"
          >
            {isEnglish ? 'New playlist' : '新建歌单'}
          </button>
        </div>

        {/* Playlist list */}
        <div className="flex-1 overflow-y-auto px-6 pt-2 space-y-0">
          {/* Playlists containing the track (on top) */}
          {containingPlaylists.map(pl => (
            <PlaylistRow key={pl.id} pl={pl} inPlaylist={true} />
          ))}

          {containingPlaylists.length > 0 && (otherPlaylists.length > 0 || onLike) && (
            <div className="border-b border-gray-700/50 my-1" />
          )}

          {/* Liked songs row */}
          {onLike && (
            <button
              onClick={handleLike}
              className="w-full flex items-center justify-between py-3 active:bg-white/5 rounded px-2 text-white"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#4a3fc7] to-[#7b68ee] flex items-center justify-center">
                  <IcHeart size={24} fill="white" className="text-white" />
                </div>
                <div className="text-left">
                  <div className="text-base font-medium">{s.liked_songs_title}</div>
                </div>
              </div>
              {trackLiked
                ? <IcLikedIndicator size={28} />
                : <IcAddCircle size={28} className="text-gray-400" strokeWidth={1.5} />
              }
            </button>
          )}

          {/* Other playlists */}
          {otherPlaylists.map(pl => (
            <PlaylistRow key={pl.id} pl={pl} inPlaylist={false} />
          ))}

          {/* New playlist row */}
          <button
            onClick={handleCreateNew}
            className="w-full flex items-center py-3 active:bg-white/5 rounded px-2 text-white gap-4"
          >
            <div className="w-14 h-14 rounded bg-[#2A2A2A] flex items-center justify-center flex-shrink-0">
              <IcAdd size={28} className="text-gray-400" />
            </div>
            <div className="text-base font-medium">{isEnglish ? 'New playlist' : '新建歌单'}</div>
          </button>
        </div>
      </div>
    </>
  );
};
