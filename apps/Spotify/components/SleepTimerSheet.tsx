import React, { useCallback, useRef, useState } from 'react';
import { IcCheck, IcClose } from '../res/icons';
import { useSpotifyStore } from '../state';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60] as const;
const DISMISS_THRESHOLD = 80;

export interface SleepTimerSheetProps {
  backdropProps?: React.HTMLAttributes<HTMLDivElement>;
  onClose: () => void;
}

/**
 * 睡眠定时器底部面板：播放器 overlay 与队列内嵌共用同一实现。
 * 状态来自 `settings.playback`，与 store 单一数据源一致。
 */
export const SleepTimerSheet: React.FC<SleepTimerSheetProps> = ({ backdropProps, onClose }) => {
  const s = useSpotifyStrings();
  const { bindTap } = useSpotifyGestures();
  const sleepTimer = useSpotifyStore(st => st.settings.playback.sleepTimer);
  const sleepFade = useSpotifyStore(st => st.settings.playback.sleepFade);
  const updateSettings = useSpotifyStore(st => st.updateSettings);

  const dragStartY = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    setIsDragging(true);
    barRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const dy = Math.max(0, e.clientY - dragStartY.current);
      setDragOffsetY(dy);
    },
    [isDragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (barRef.current?.hasPointerCapture(e.pointerId)) {
        barRef.current.releasePointerCapture(e.pointerId);
      }
      if (!isDragging) return;
      setIsDragging(false);
      if (dragOffsetY >= DISMISS_THRESHOLD) {
        setDragOffsetY(0);
        onClose();
        return;
      }
      setDragOffsetY(0);
    },
    [dragOffsetY, isDragging, onClose],
  );

  return (
    <>
      <div {...backdropProps} className="absolute inset-0 bg-black/60 z-[55] backdrop-blur-sm transition-opacity" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-[#2A2A2A] text-white z-[56] rounded-t-[20px] pb-12 animate-in slide-in-from-bottom duration-300"
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition: !isDragging ? 'transform var(--app-duration-short) var(--app-easing-decelerate)' : undefined,
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={e => e.buttons === 0 && onPointerUp(e)}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={barRef}
          className="w-full flex cursor-grab items-center justify-center pt-3 pb-2"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        <div className="px-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold">{s.player_sleep_timer}</h2>
            <button type="button" onClick={onClose}>
              <IcClose size={24} className="text-gray-400" />
            </button>
          </div>

          <div className="space-y-2">
            {TIMER_OPTIONS.map(min => (
              <div
                key={min}
                {...bindTap(
                  { kind: 'action', id: 'player.timer.set' },
                  {
                    params: { minutes: min },
                    onTrigger: () => {
                      updateSettings('playback', { sleepTimer: min });
                      onClose();
                    },
                  },
                )}
                className="flex justify-between items-center py-3 active:bg-white/5 rounded px-2 cursor-pointer"
              >
                <span>
                  {min} {s.player_minutes}
                </span>
                {sleepTimer === min && <IcCheck size={20} className="text-app-primary" />}
              </div>
            ))}
            <div
              {...bindTap(
                { kind: 'action', id: 'player.timer.set' },
                {
                  params: { minutes: 0 },
                  onTrigger: () => {
                    updateSettings('playback', { sleepTimer: 0 });
                    onClose();
                  },
                },
              )}
              className="flex justify-between items-center py-3 active:bg-white/5 rounded px-2 cursor-pointer"
            >
              <span>{s.player_close_timer}</span>
              {sleepTimer === 0 && <IcCheck size={20} className="text-app-primary" />}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-base font-medium">{s.player_fade_music}</div>
                <div className="text-xs text-gray-400">{s.player_fade_music_desc}</div>
              </div>
              <div
                {...bindTap(
                  { kind: 'action', id: 'player.timer.fade.toggle' },
                  {
                    params: { to: !sleepFade },
                    onTrigger: () => {
                      updateSettings('playback', { sleepFade: !sleepFade });
                    },
                  },
                )}
                className={`w-12 h-7 rounded-full relative transition-colors cursor-pointer ${sleepFade ? 'bg-app-primary' : 'bg-gray-600'}`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${sleepFade ? 'left-6' : 'left-1'}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
