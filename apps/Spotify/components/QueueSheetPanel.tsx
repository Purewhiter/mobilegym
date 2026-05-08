import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useLocale } from '@/os/locale';
import { useSpotifyStore } from '../state';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useShallow } from 'zustand/react/shallow';
import { IcPlay, IcPause, IcMic, IcMore, IcShuffle, IcRepeat, IcTimer } from '../res/icons';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';

const DISMISS_THRESHOLD = 80;
const SNAP_THRESHOLD = 50;
const DRAG_START_THRESHOLD = 6;

interface QueueSheetPanelProps {
  backdropProps?: React.HTMLAttributes<HTMLDivElement>;
  coverOverride?: string;
  onClose?: () => void;
}

export const QueueSheetPanel: React.FC<QueueSheetPanelProps> = ({
  backdropProps,
  coverOverride,
  onClose,
}) => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const s = useSpotifyStrings();
  const { bindTap } = useSpotifyGestures();
  const displayText = (v: string | undefined) => localizeSpotifyText(v, isEnglish);

  const { currentTrack, isPlaying, queue, shuffle, repeat } = useSpotifyStore(
    useShallow(st => ({
      currentTrack: st.currentTrack,
      isPlaying: st.isPlaying,
      queue: st.queue,
      shuffle: st.shuffle,
      repeat: st.repeat,
    })),
  );
  const togglePlay = useSpotifyStore(st => st.togglePlay);
  const toggleShuffle = useSpotifyStore(st => st.toggleShuffle);
  const toggleRepeat = useSpotifyStore(st => st.toggleRepeat);
  const playTrack = useSpotifyStore(st => st.playTrack);

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragModeRef = useRef<'none' | 'pending' | 'expand' | 'collapse' | 'dismiss'>('none');
  const zoomRef = useRef(1);

  // Drag state in refs for stable pointer callbacks
  const isDraggingRef = useRef(false);
  const heightDeltaRef = useRef(0);
  const dismissOffsetRef = useRef(0);

  const [expanded, setExpanded] = useState(false);
  const [renderHeightDelta, setRenderHeightDelta] = useState(0);
  const [renderDismissOffset, setRenderDismissOffset] = useState(0);
  const [collapsedHeight, setCollapsedHeight] = useState(0);
  const [expandedHeight, setExpandedHeight] = useState(0);

  const expandRange = Math.max(0, expandedHeight - collapsedHeight);

  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const STATUS_BAR_VP_PX = 40;
    const measure = () => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;width:200px;height:0;visibility:hidden;pointer-events:none';
      el.appendChild(probe);
      const zoom = probe.getBoundingClientRect().width / 200 || 1;
      probe.remove();
      zoomRef.current = zoom;
      const maxH = (window.innerHeight - STATUS_BAR_VP_PX) / zoom;
      setCollapsedHeight(Math.round(maxH * 0.65));
      setExpandedHeight(Math.round(maxH));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    return () => ro?.disconnect();
  }, []);

  const resetDragState = useCallback(() => {
    isDraggingRef.current = false;
    heightDeltaRef.current = 0;
    dismissOffsetRef.current = 0;
    setRenderHeightDelta(0);
    setRenderDismissOffset(0);
    dragModeRef.current = 'none';
  }, []);

  const handleClose = useCallback(() => {
    resetDragState();
    if (onClose) {
      onClose();
    } else {
      backdropProps?.onClick?.(null as any);
    }
  }, [backdropProps, onClose, resetDragState]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragStartY.current = e.clientY;
    dragModeRef.current = 'pending';
    isDraggingRef.current = true;
    sheetRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const rawDy = e.clientY - dragStartY.current;
    const dy = rawDy / zoomRef.current;

    if (dragModeRef.current === 'pending') {
      if (Math.abs(dy) < DRAG_START_THRESHOLD) return;
      if (dy < 0 && !expanded) {
        dragModeRef.current = 'expand';
      } else if (dy > 0 && expanded) {
        dragModeRef.current = 'collapse';
      } else if (dy > 0 && !expanded) {
        dragModeRef.current = 'dismiss';
      } else {
        dragModeRef.current = 'none';
      }
    }

    if (dragModeRef.current === 'expand') {
      const v = Math.min(expandRange, Math.max(0, -dy));
      heightDeltaRef.current = v;
      dismissOffsetRef.current = 0;
      setRenderHeightDelta(v);
      setRenderDismissOffset(0);
    } else if (dragModeRef.current === 'collapse') {
      const v = -Math.min(expandRange, Math.max(0, dy));
      heightDeltaRef.current = v;
      dismissOffsetRef.current = 0;
      setRenderHeightDelta(v);
      setRenderDismissOffset(0);
    } else if (dragModeRef.current === 'dismiss') {
      const v = Math.max(0, dy);
      heightDeltaRef.current = 0;
      dismissOffsetRef.current = v;
      setRenderHeightDelta(0);
      setRenderDismissOffset(v);
    }
  }, [expandRange, expanded]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (sheetRef.current?.hasPointerCapture(e.pointerId)) {
      sheetRef.current.releasePointerCapture(e.pointerId);
    }
    if (!isDraggingRef.current) return;

    const mode = dragModeRef.current;
    const hd = heightDeltaRef.current;
    const doff = dismissOffsetRef.current;

    if (mode === 'expand') {
      if (hd >= SNAP_THRESHOLD || hd >= expandRange * 0.3) {
        setExpanded(true);
      }
    } else if (mode === 'collapse') {
      if (-hd >= SNAP_THRESHOLD || -hd >= expandRange * 0.3) {
        setExpanded(false);
      }
    } else if (mode === 'dismiss') {
      if (doff >= DISMISS_THRESHOLD) {
        handleClose();
        return;
      }
    }

    resetDragState();
  }, [expandRange, handleClose, resetDragState]);

  if (!currentTrack) return null;

  const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
  const nextTracks = queue.slice(currentIdx + 1);
  const coverSrc = coverOverride || currentTrack.cover;

  const baseHeight = expanded ? expandedHeight : collapsedHeight;
  const currentHeight = collapsedHeight > 0
    ? Math.max(100, Math.min(expandedHeight, baseHeight + renderHeightDelta))
    : 0;

  return (
    <>
      <div
        {...backdropProps}
        className={`absolute inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity ${backdropProps?.className ?? ''}`}
      />
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-app-surface text-white z-50 flex flex-col rounded-t-[20px] overflow-hidden shadow-2xl"
        style={{
          height: currentHeight > 0 ? `${currentHeight}px` : '65%',
          maxHeight: expandedHeight > 0 ? `${expandedHeight}px` : undefined,
          transform: `translateY(${renderDismissOffset}px)`,
          transition: !isDraggingRef.current
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
          className="w-full flex-shrink-0 flex items-center justify-center pt-3 pb-2 bg-app-surface cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        <div
          data-scroll-container="main"
          data-scroll-direction="vertical"
          className="flex-1 overflow-y-auto px-6 bg-app-surface"
        >
          <h2 className="text-lg font-bold mb-1">{s.player_queue_title}</h2>
          <p className="text-gray-400 text-xs mb-6">
            {s.player_queue_now_playing.replace('{artist}', displayText(currentTrack.artist))}
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
              <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-gray-800">
                {coverSrc ? (
                  <img src={coverSrc} className="w-full h-full object-cover" alt={displayText(currentTrack.title)} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700">
                    <IcMic size={20} className="text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-app-primary font-bold text-base truncate mb-1">
                  {displayText(currentTrack.title)}
                </div>
                <div className="text-gray-400 text-sm truncate">
                  {displayText(currentTrack.artist)}
                </div>
              </div>
              <button
                {...bindTap(
                  { kind: 'action', id: 'track.play.toggle' },
                  {
                    params: { trackId: currentTrack.id, to: !isPlaying },
                    onTrigger: togglePlay,
                    stopPropagation: true,
                  },
                )}
              >
                {isPlaying ? (
                  <IcPause size={24} fill="#1ED760" className="text-app-primary" />
                ) : (
                  <IcPlay size={24} fill="#1ED760" className="text-app-primary" />
                )}
              </button>
            </div>

            <h3 className="text-sm font-bold text-white mt-8 mb-4">{s.player_queue_up_next}</h3>
            {nextTracks.map((t, i) => (
              <div
                key={i}
                onClick={() => playTrack(t)}
                className="flex items-center gap-3 opacity-100 active:bg-white/10 p-2 rounded-lg transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded bg-gray-800 overflow-hidden flex-shrink-0">
                  {t.cover ? (
                    <img src={t.cover} alt={displayText(t.title)} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-700">
                      <IcMic size={20} className="text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold mb-1 truncate">{displayText(t.title)}</div>
                  <div className="text-gray-400 text-sm truncate">{displayText(t.artist)}</div>
                </div>
                <div className="text-gray-400"><IcMore size={20} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 pb-8 flex-shrink-0 grid grid-cols-3 gap-4 border-t border-white/10 bg-[#2A2A2A]">
          <button
            {...bindTap(
              { kind: 'action', id: 'player.shuffle.toggle' },
              { params: { to: !shuffle }, onTrigger: toggleShuffle },
            )}
            className="flex items-center justify-center gap-2 text-sm text-gray-300 font-bold bg-[#3E3E3E] py-3 rounded-lg active:scale-95 transition-transform"
          >
            <IcShuffle size={20} className={shuffle ? 'text-app-primary' : ''} />
            <span>{s.player_shuffle}</span>
          </button>
          <button
            {...bindTap(
              { kind: 'action', id: 'player.repeat.toggle' },
              { params: { to: repeat !== 'off' }, onTrigger: toggleRepeat },
            )}
            className="flex items-center justify-center gap-2 text-sm text-gray-300 font-bold bg-[#3E3E3E] py-3 rounded-lg active:scale-95 transition-transform"
          >
            <span className="relative">
              <IcRepeat size={20} className={repeat !== 'off' ? 'text-app-primary' : ''} />
              {repeat === 'track' && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] font-bold text-app-primary pt-px">1</span>}
            </span>
            <span>{repeat === 'track' ? s.player_repeat_one : s.player_repeat}</span>
          </button>
          <button
            {...bindTap('player.timer.open')}
            className="flex items-center justify-center gap-2 text-sm text-gray-300 font-bold bg-[#3E3E3E] py-3 rounded-lg active:scale-95 transition-transform"
          >
            <IcTimer size={20} />
            <span>{s.player_timer}</span>
          </button>
        </div>
      </div>
    </>
  );
};
