import React, { useMemo, useRef, useState } from 'react';
import type { WorldCity } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { IcClose, IcSearch } from '../res/icons';
import { formatGmtLabel } from '../utils';

export const CitySelectorPage: React.FC<{
  cities: WorldCity[];
  selectedCityIds: string[];
  onSelect: (city: WorldCity) => void;
  onClose: () => void;
  onAlreadySelected?: () => void;
}> = ({ cities, selectedCityIds, onSelect, onClose, onAlreadySelected }) => {
  const s = useAppStrings(strings, stringsEn);
  const [query, setQuery] = useState('');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startY: 0 });
  const barRef = useRef<HTMLDivElement>(null);
  const DISMISS_THRESHOLD = 120;

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return cities;
    return cities.filter(city => `${city.name}${city.country}${formatGmtLabel(city.gmtOffsetMinutes)}`.includes(q));
  }, [cities, query]);

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

        <div className="flex items-center justify-between mb-3">
          <button className="w-10 h-10 flex items-center justify-center text-app-text-muted shrink-0" onClick={onClose}>
            <IcClose size={26} />
          </button>
          <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1 px-2">
            <span className="text-[20px] font-medium">{s.world_clock_select_city}</span>
            <span className="text-[14px] text-gray-400">{s.world_clock_gmt_label}</span>
          </div>
          <div className="w-10 shrink-0" />
        </div>

        <div className="bg-[#f2f2f2] rounded-full px-4 py-3 flex items-center gap-2 mb-4">
          <IcSearch size={18} className="text-gray-400 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={s.world_clock_search_placeholder}
            className="bg-transparent outline-none text-[16px] flex-1 placeholder:text-gray-400"
          />
          {query ? (
            <button className="text-app-primary text-[14px] shrink-0" onClick={() => setQuery('')}>
              {s.cancel}
            </button>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 flex gap-2">
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-2">
            {filtered.map(city => {
              const isSelected = selectedCityIds.includes(city.id);
              return (
                <button
                  key={city.id}
                  onClick={() => {
                    if (isSelected) {
                      onClose();
                      onAlreadySelected?.();
                    } else {
                      onSelect(city);
                    }
                  }}
                  className="w-full py-4 flex items-center justify-between text-left border-b border-gray-100 last:border-b-0"
                >
                  <div>
                    <div className="text-[16px] font-medium text-black">{city.name}</div>
                    <div className="text-[14px] text-gray-400 mt-0.5">
                      {city.country} {formatGmtLabel(city.gmtOffsetMinutes)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-[12px] text-gray-300 flex flex-col items-center justify-start gap-0.5 py-2 shrink-0 w-6">
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map(letter => (
              <span key={letter}>{letter}</span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
