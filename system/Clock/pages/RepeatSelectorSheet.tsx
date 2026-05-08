import React, { useRef, useState } from 'react';
import type { AlarmRepeat } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { IcNavBack, IcNavForward, IcCheck } from '../res/icons';

type RepeatOption = { id: AlarmRepeat; label: string; subLabel?: string };

export const RepeatSelectorSheet: React.FC<{
  value: AlarmRepeat;
  onSelect: (repeat: AlarmRepeat) => void;
  onClose: () => void;
}> = ({ value, onSelect, onClose }) => {
  const s = useAppStrings(strings, stringsEn);
  const repeatOptions: RepeatOption[] = [
    { id: 'once', label: s.alarm_repeat_once },
    { id: 'daily', label: s.alarm_repeat_daily },
    { id: 'workday', label: s.alarm_repeat_workday, subLabel: s.alarm_repeat_workday_sub },
    { id: 'holiday', label: s.alarm_repeat_holiday, subLabel: s.alarm_repeat_holiday_sub },
    { id: 'weekday', label: s.alarm_repeat_weekday },
  ];
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startY: 0 });
  const barRef = useRef<HTMLDivElement>(null);
  const DISMISS_THRESHOLD = 120;

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current.startY = e.clientY;
    setIsDragging(true);
    barRef.current?.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dy = e.clientY - dragRef.current.startY;
    const maxOffset = typeof window !== 'undefined' ? window.innerHeight : 1000;
    if (dy > 0) setDragOffset(Math.min(dy, maxOffset));
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    barRef.current?.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    if (dragOffset >= DISMISS_THRESHOLD) {
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  return (
    <div className="absolute inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="absolute top-10 left-0 right-0 bottom-0 bg-app-bg rounded-t-[24px] px-5 pt-4 pb-6 flex flex-col"
        style={{ transform: `translateY(${dragOffset}px)`, transition: !isDragging ? 'transform var(--app-duration-short) var(--app-easing-decelerate)' : undefined }}
        onPointerMove={handlePointerMove}
        onPointerLeave={e => e.buttons === 0 && handlePointerUp(e)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={barRef}
          className="flex justify-center pt-2 pb-3 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handlePointerDown}
        >
          <div className="w-16 h-1 rounded-full bg-gray-300 -mt-1.5" aria-hidden />
        </div>
        <div className="flex items-center justify-between mb-4">
          <button className="w-10 h-10 flex items-center justify-center text-app-text-muted shrink-0" onClick={onClose}>
            <IcNavBack size={26} />
          </button>
          <span className="text-[20px] font-medium flex-1 text-center">{s.alarm_repeat}</span>
          <div className="w-10 shrink-0" />
        </div>

        <div className="bg-app-surface rounded-2xl overflow-hidden mb-3">
          {repeatOptions.map(option => (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className="w-full px-4 py-5 flex items-center justify-between text-left"
            >
              <span className={`text-[16px] ${value === option.id ? 'text-app-primary font-medium' : 'text-black'}`}>
                {option.subLabel ? `${option.label}（${option.subLabel}）` : option.label}
              </span>
              {value === option.id ? <IcCheck size={22} className="text-app-primary shrink-0" /> : null}
            </button>
          ))}
        </div>

        <div className="bg-app-surface rounded-2xl overflow-hidden">
          <div className="px-4 py-5 flex items-center justify-between text-gray-400">
            <span className="text-[16px] text-black">{s.alarm_shift}</span>
            <IcNavForward size={18} />
          </div>
          <div className="px-4 py-5 flex items-center justify-between text-gray-400">
            <span className="text-[16px] text-black">{s.alarm_custom}</span>
            <IcNavForward size={18} />
          </div>
        </div>
      </div>
    </div>
  );
};
