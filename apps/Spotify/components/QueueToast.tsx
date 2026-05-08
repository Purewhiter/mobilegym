import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpotifyStore } from '../state';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { QueueSheetPanel } from './QueueSheetPanel';

const TOAST_DURATION = 5000;

export const QueueToastBanner: React.FC = () => {
  const s = useSpotifyStrings();
  const [, setSearchParams] = useSearchParams();
  const queueToast = useSpotifyStore(st => st._temp.queueToast);
  const currentTrack = useSpotifyStore(st => st.currentTrack);
  const clearQueueToast = useSpotifyStore(st => st.clearQueueToast);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!queueToast) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      clearQueueToast();
    }, TOAST_DURATION);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [queueToast, clearQueueToast]);

  if (!queueToast) return null;

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
        <span className="truncate text-sm font-semibold">
          {s.queue_toast_added}
        </span>
        <button
          onClick={() => {
            clearQueueToast();
            setSearchParams(p => { p.set('overlay', 'queue'); return p; });
          }}
          className="flex-shrink-0 text-sm font-bold text-[#1DB954]"
        >
          {s.queue_toast_open}
        </button>
      </div>
    </div>
  );
};

export const QueueSheet: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { bindBack, back } = useSpotifyGestures();

  const isOpen = searchParams.get('overlay') === 'queue';
  if (!isOpen) return null;

  const backProps = bindBack({ stopPropagation: true });

  return (
    <div className="absolute inset-0 z-[80]">
      <QueueSheetPanel
        backdropProps={backProps}
        onClose={() => back()}
      />
    </div>
  );
};
