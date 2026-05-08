import React from 'react';
import { useLocale } from '@/os/locale';
import {
  IcAdd,
  IcDisc,
  IcHeart,
  IcMinusCircle,
  IcQrCode,
  IcQueue,
  IcRadio,
  IcShare,
  IcLyrics,
  IcTimer,
  IcTrend,
  IcUser,
  IcUsers,
  IcZap,
} from '../res/icons';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import type { SpotifyTrack } from '../types';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';

type TrackMenuVariant = 'search' | 'playlist' | 'ownPlaylist' | 'likedSongs';

interface TrackMenuSheetProps {
  track: SpotifyTrack;
  isOpen: boolean;
  liked?: boolean;
  variant?: TrackMenuVariant;
  onClose?: () => void;
  backdropProps?: React.HTMLAttributes<HTMLDivElement>;
  shareProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  lyricsProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  lyricsOn?: boolean;
  sleepTimerProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  likeProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  addToPlaylistProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  addToPlaylistLabel?: string;
  likedTrackMenuVariant?: 'default' | 'otherPlaylistsOnly';
  createJamProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  premiumProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  removeFromPlaylistProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  hideFromPlaylistProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  addToQueueProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  goToQueueProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  goToAlbumProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  goToArtistProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  removeFromTasteProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  goToSongRadioProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  viewProducersProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  showSpotifyCodeProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  albumTitle?: string;
}

const rowClass =
  'w-full px-6 py-3.5 flex items-center gap-4 text-white hover:bg-[#333] active:bg-[#333]';
const DISMISS_THRESHOLD = 120;
const SNAP_THRESHOLD = 48;
const DRAG_START_THRESHOLD = 8;

export const TrackMenuSheet: React.FC<TrackMenuSheetProps> = ({
  track,
  isOpen,
  liked = false,
  variant = 'search',
  onClose,
  backdropProps,
  shareProps,
  lyricsProps,
  lyricsOn = false,
  sleepTimerProps,
  likeProps,
  addToPlaylistProps,
  addToPlaylistLabel,
  likedTrackMenuVariant = 'default',
  createJamProps,
  premiumProps,
  removeFromPlaylistProps,
  hideFromPlaylistProps,
  addToQueueProps,
  goToQueueProps,
  goToAlbumProps,
  goToArtistProps,
  removeFromTasteProps,
  goToSongRadioProps,
  viewProducersProps,
  showSpotifyCodeProps,
  albumTitle,
}) => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const s = useSpotifyStrings();
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const dragStartY = React.useRef(0);
  const dragMode = React.useRef<'none' | 'pending' | 'expand' | 'collapse' | 'dismiss'>('none');
  const zoomRef = React.useRef(1);
  const [expanded, setExpanded] = React.useState(false);
  const [heightDelta, setHeightDelta] = React.useState(0);
  const [dismissOffset, setDismissOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [maxSheetHeight, setMaxSheetHeight] = React.useState(0);
  const [measuredCollapsedHeight, setMeasuredCollapsedHeight] = React.useState(0);
  const [measuredExpandedHeight, setMeasuredExpandedHeight] = React.useState(0);

  const isPlaylistVariant = variant === 'playlist' || variant === 'ownPlaylist' || variant === 'likedSongs';
  const isOwnVariant = variant === 'ownPlaylist' || variant === 'likedSongs';
  const hideLikedToggleRow =
    isOwnVariant || (liked && likedTrackMenuVariant === 'otherPlaylistsOnly');

  const STATUS_BAR_VP_PX = 40;
  const effectiveMax = maxSheetHeight > 0 ? maxSheetHeight : (window.innerHeight || 800) * 0.9;
  const collapsedHeight =
    measuredCollapsedHeight > 0
      ? Math.max(360, Math.min(effectiveMax, measuredCollapsedHeight))
      : Math.min(Math.max(effectiveMax * 0.56, 420), effectiveMax);
  const expandedHeight =
    measuredExpandedHeight > 0
      ? Math.min(Math.max(collapsedHeight, measuredExpandedHeight), effectiveMax)
      : Math.min(effectiveMax * 0.92, effectiveMax);
  const expandRange = Math.max(0, expandedHeight - collapsedHeight);

  React.useEffect(() => {
    if (isOpen) return;
    setExpanded(false);
    setHeightDelta(0);
    setDismissOffset(0);
    setIsDragging(false);
    dragMode.current = 'none';
    setMaxSheetHeight(0);
    setMeasuredCollapsedHeight(0);
    setMeasuredExpandedHeight(0);
  }, [isOpen]);

  React.useLayoutEffect(() => {
    if (!isOpen) return;

    const COLLAPSED_ITEM_COUNT = 7;

    const measure = () => {
      const el = sheetRef.current;
      if (!el) return;

      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;width:200px;height:0;visibility:hidden;pointer-events:none';
      el.appendChild(probe);
      const zoom = probe.getBoundingClientRect().width / 200 || 1;
      probe.remove();
      zoomRef.current = zoom;

      setMaxSheetHeight((window.innerHeight - STATUS_BAR_VP_PX) / zoom);

      const dragRect = dragRef.current?.getBoundingClientRect();
      const contentEl = contentRef.current;
      if (!dragRect || !contentEl) return;

      const contentRect = contentEl.getBoundingClientRect();
      const rows = contentEl.querySelectorAll(':scope > button');
      const lastRow = rows[rows.length - 1];
      const anchorRow = rows[COLLAPSED_ITEM_COUNT - 1] ?? lastRow;

      const contentStyles = window.getComputedStyle(contentEl);
      const contentPaddingBottom = Number.parseFloat(contentStyles.paddingBottom || '0');

      if (lastRow) {
        const expandedContentHeight = (lastRow.getBoundingClientRect().bottom - contentRect.top + contentPaddingBottom) / zoom;
        setMeasuredExpandedHeight(dragRect.height / zoom + expandedContentHeight);
      }

      if (anchorRow) {
        const collapsedContentHeight = (anchorRow.getBoundingClientRect().bottom - contentRect.top) / zoom;
        setMeasuredCollapsedHeight(dragRect.height / zoom + collapsedContentHeight);
      }
    };

    measure();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measure())
        : null;
    if (ro && dragRef.current) ro.observe(dragRef.current);
    if (ro && contentRef.current) ro.observe(contentRef.current);
    return () => ro?.disconnect();
  }, [hideLikedToggleRow, isOpen, likedTrackMenuVariant, removeFromPlaylistProps]);

  const defaultRow = React.useCallback(
    (props?: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      props ?? { onClick: () => onClose?.() },
    [onClose],
  );

  // 跳转类菜单项：先关闭 sheet（back），再执行导航
  const navigateRow = React.useCallback(
    (props?: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
      if (!props) return { onClick: () => onClose?.() };
      const { onClick: origClick, ...rest } = props;
      return {
        ...rest,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          // back() pop 掉 sheet 层，然后同步 push 导航目标
          // history: ...→ /?tab=all → /artist/xxx（sheet 已被 pop）
          onClose?.();
          origClick?.(e);
        },
      };
    },
    [onClose],
  );

  const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragStartY.current = e.clientY;
    dragMode.current = 'pending';
    setIsDragging(true);
    sheetRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dy = (e.clientY - dragStartY.current) / zoomRef.current;

    if (dragMode.current === 'pending') {
      if (Math.abs(dy) < DRAG_START_THRESHOLD) return;
      if (dy < 0 && !expanded) {
        dragMode.current = 'expand';
      } else if (dy > 0 && expanded) {
        dragMode.current = 'collapse';
      } else if (dy > 0 && !expanded) {
        dragMode.current = 'dismiss';
      } else {
        dragMode.current = 'none';
      }
    }

    if (dragMode.current === 'expand') {
      setHeightDelta(Math.min(expandRange, Math.max(0, -dy)));
      setDismissOffset(0);
      return;
    }

    if (dragMode.current === 'collapse') {
      setHeightDelta(-Math.min(expandRange, Math.max(0, dy)));
      setDismissOffset(0);
      return;
    }

    if (dragMode.current === 'dismiss') {
      setHeightDelta(0);
      setDismissOffset(Math.max(0, dy));
      return;
    }
  }, [expandRange, expanded, isDragging]);

  const resetDragState = React.useCallback(() => {
    setIsDragging(false);
    setHeightDelta(0);
    setDismissOffset(0);
    dragMode.current = 'none';
  }, []);

  const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (sheetRef.current?.hasPointerCapture(e.pointerId)) {
      sheetRef.current.releasePointerCapture(e.pointerId);
    }
    if (!isDragging) return;

    const mode = dragMode.current;
    if (mode === 'expand') {
      if (heightDelta >= SNAP_THRESHOLD || heightDelta >= expandRange * 0.3) {
        setExpanded(true);
      }
    } else if (mode === 'collapse') {
      if (-heightDelta >= SNAP_THRESHOLD || -heightDelta >= expandRange * 0.3) {
        setExpanded(false);
      }
    } else if (mode === 'dismiss') {
      if (dismissOffset >= DISMISS_THRESHOLD) {
        resetDragState();
        onClose?.();
        return;
      }
    }

    resetDragState();
  }, [dismissOffset, expandRange, heightDelta, isDragging, onClose, resetDragState]);

  const { className: backdropClassName, ...backdropRest } = backdropProps ?? {};
  const { className: shareClassName, ...shareRest } = defaultRow(shareProps);
  const { className: lyricsClassName, ...lyricsRest } = defaultRow(lyricsProps);
  const { className: sleepTimerClassName, ...sleepTimerRest } = defaultRow(sleepTimerProps);
  const { className: likeClassName, ...likeRest } = defaultRow(likeProps);
  const { className: addToPlaylistClassName, ...addToPlaylistRest } = defaultRow(addToPlaylistProps);
  const { className: removeFromPlaylistClassName, ...removeFromPlaylistRest } = removeFromPlaylistProps ?? {};
  const { className: hideFromPlaylistClassName, ...hideFromPlaylistRest } = defaultRow(hideFromPlaylistProps);
  const { className: addToQueueClassName, ...addToQueueRest } = defaultRow(addToQueueProps);
  const { className: goToQueueClassName, ...goToQueueRest } = defaultRow(goToQueueProps);
  const { className: goToAlbumClassName, ...goToAlbumRest } = navigateRow(goToAlbumProps);
  const { className: goToArtistClassName, ...goToArtistRest } = navigateRow(goToArtistProps);
  const { className: removeFromTasteClassName, ...removeFromTasteRest } = defaultRow(removeFromTasteProps);
  const { className: goToSongRadioClassName, ...goToSongRadioRest } = defaultRow(goToSongRadioProps);
  const { className: viewProducersClassName, ...viewProducersRest } = defaultRow(viewProducersProps);
  const { className: showSpotifyCodeClassName, ...showSpotifyCodeRest } = defaultRow(showSpotifyCodeProps);
  const createJamMerged = createJamProps ?? premiumProps ?? { onClick: () => onClose?.() };
  const { className: createJamMergedClassName, ...createJamMergedRest } = createJamMerged;

  const trackTitle = localizeSpotifyText(track.title, isEnglish);
  const trackArtist = localizeSpotifyText(track.artist, isEnglish);
  const albumLabel = localizeSpotifyText(albumTitle, isEnglish);
  const addToPlaylistRowLabel = isOwnVariant || liked
    ? (addToPlaylistLabel ?? s.track_menu_add_to_other_playlists)
    : (addToPlaylistLabel ?? s.track_menu_add_to_playlist);

  if (!isOpen) return null;

  const baseHeight = expanded ? expandedHeight : collapsedHeight;
  const currentHeight = Math.max(collapsedHeight, Math.min(expandedHeight, baseHeight + heightDelta));

  return (
    <>
      <div
        {...backdropRest}
        className={`fixed inset-0 bg-black/50 z-[70] ${backdropClassName ?? ''}`}
      />
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-[#282828] rounded-t-2xl z-[71] flex flex-col overflow-hidden shadow-2xl"
        style={{
          height: `${currentHeight}px`,
          maxHeight: `${expandedHeight}px`,
          transform: `translateY(${dismissOffset}px)`,
          transition:
            !isDragging
              ? 'height var(--app-duration-short) var(--app-easing-decelerate), transform var(--app-duration-short) var(--app-easing-decelerate)'
              : undefined,
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={e => e.buttons === 0 && handlePointerUp(e)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={dragRef}
          className="flex flex-col flex-shrink-0 touch-none"
          onPointerDown={handlePointerDown}
        >
          <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
            <div className="w-12 h-1 bg-gray-500 rounded-full" />
          </div>

          <div className="px-6 py-4 flex items-center gap-4 border-b border-gray-700">
            <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-700 flex-shrink-0">
              <img
                src={track.cover}
                alt={trackTitle}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-base truncate">{trackTitle}</div>
              <div className="text-gray-400 text-sm truncate">
                {albumLabel ? `${trackArtist} • ${albumLabel}` : trackArtist}
              </div>
            </div>
          </div>
        </div>

        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto py-2"
          data-scroll-container="track-menu"
          data-scroll-direction="vertical"
        >
          <button {...shareRest} className={`${rowClass} ${shareClassName ?? ''}`} style={{ touchAction: 'manipulation' }}>
            <IcShare size={20} />
            <span className="text-base">{s.track_menu_share}</span>
          </button>

          {lyricsProps && (
            <button {...lyricsRest} className={`${rowClass} ${lyricsClassName ?? ''}`} style={{ touchAction: 'manipulation' }}>
              <IcLyrics size={20} />
              <span className="text-base">{lyricsOn ? s.track_menu_lyrics_on : s.track_menu_lyrics_off}</span>
            </button>
          )}

          {!hideLikedToggleRow && (
            <button {...likeRest} className={`${rowClass} ${likeClassName ?? ''}`} style={{ touchAction: 'manipulation' }}>
              <IcHeart size={20} className={liked ? 'text-app-primary' : 'text-purple-500'} />
              <span className="text-base">{liked ? s.track_menu_remove_liked : s.track_menu_add_liked}</span>
            </button>
          )}

          <button
            {...addToPlaylistRest}
            className={`${rowClass} ${addToPlaylistClassName ?? ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <IcAdd size={20} className="text-white" />
            <span className="text-base">{addToPlaylistRowLabel}</span>
          </button>

          {removeFromPlaylistProps && (
            <button
              {...removeFromPlaylistRest}
              className={`${rowClass} ${removeFromPlaylistClassName ?? ''}`}
              style={{ touchAction: 'manipulation' }}
            >
              <IcMinusCircle size={20} />
              <span className="text-base">{s.track_menu_remove_from_playlist}</span>
            </button>
          )}

          {hideFromPlaylistProps && (
            <button
              {...hideFromPlaylistRest}
              className={`${rowClass} ${hideFromPlaylistClassName ?? ''}`}
              style={{ touchAction: 'manipulation' }}
            >
              <IcMinusCircle size={20} />
              <span className="text-base">{s.track_menu_hide_from_playlist}</span>
            </button>
          )}

          <button
            {...addToQueueRest}
            className={`${rowClass} ${addToQueueClassName ?? ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <IcAdd size={20} />
            <span className="text-base">{s.track_menu_add_to_queue}</span>
          </button>

          <button
            {...goToQueueRest}
            className={`${rowClass} ${goToQueueClassName ?? ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <IcQueue size={20} />
            <span className="text-base">{s.track_menu_go_to_queue}</span>
          </button>

          <button
            {...goToAlbumRest}
            className={`${rowClass} ${goToAlbumClassName ?? ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <IcDisc size={20} />
            <span className="text-base">{s.track_menu_go_to_album}</span>
          </button>

          <button
            {...goToArtistRest}
            className={`${rowClass} ${goToArtistClassName ?? ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <IcUser size={20} />
            <span className="text-base">{s.track_menu_go_to_artist}</span>
          </button>

          <button
            {...createJamMergedRest}
            className={`${rowClass} justify-between ${createJamMergedClassName ?? ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <div className="flex items-center gap-4">
              <IcZap size={20} />
              <span className="text-base">{s.track_menu_create_jam}</span>
            </div>
            <span className="text-app-accent text-sm font-semibold">Premium</span>
          </button>

          <button
            {...removeFromTasteRest}
            className={`${rowClass} ${removeFromTasteClassName ?? ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <IcTrend size={20} />
            <span className="text-base">{s.track_menu_remove_from_taste}</span>
          </button>

          {sleepTimerProps && (
            <button {...sleepTimerRest} className={`${rowClass} ${sleepTimerClassName ?? ''}`} style={{ touchAction: 'manipulation' }}>
              <IcTimer size={20} />
              <span className="text-base">{s.track_menu_sleep_timer}</span>
            </button>
          )}

          {!isPlaylistVariant && (
            <button
              {...goToSongRadioRest}
              className={`${rowClass} ${goToSongRadioClassName ?? ''}`}
              style={{ touchAction: 'manipulation' }}
            >
              <IcRadio size={20} />
              <span className="text-base">{s.track_menu_go_to_song_radio}</span>
            </button>
          )}

          <button
            {...viewProducersRest}
            className={`${rowClass} ${viewProducersClassName ?? ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <IcUsers size={20} />
            <span className="text-base">{s.track_menu_view_producers}</span>
          </button>

          <button
            {...showSpotifyCodeRest}
            className={`${rowClass} ${showSpotifyCodeClassName ?? ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <IcQrCode size={20} />
            <span className="text-base">{s.track_menu_show_spotify_code}</span>
          </button>
        </div>
      </div>
    </>
  );
};
