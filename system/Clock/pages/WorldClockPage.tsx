import React, { useEffect, useRef, useState } from 'react';
import type { WorldCity } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { getDate } from '../../../os/TimeService';
import { useClockGestures } from '../hooks/useClockGestures';
import { CollapsingToolbar, ToolbarIconButton, TOOLBAR_SPACER_HEIGHT } from '../../../os/components/CollapsingToolbar';
import { IcClose, IcCheck, IcList, IcMoreVert, IcAdd, IcGripVertical } from '../res/icons';
import { pad2, getCityTime, formatCityDiff, formatCityDate } from '../utils';

const AnalogClock: React.FC<{ date: Date }> = ({ date }) => {
  const hours = date.getHours() % 12;
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;

  const cx = 110;
  const cy = 110;
  const rInner = 98;
  const rOuter = 105;
  const tickLines = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
    const isHour = i % 5 === 0;
    return {
      x1: cx + rInner * Math.cos(angle),
      y1: cy + rInner * Math.sin(angle),
      x2: cx + rOuter * Math.cos(angle),
      y2: cy + rOuter * Math.sin(angle),
      isHour,
    };
  });

  return (
    <div className="relative w-[220px] h-[220px] rounded-full bg-[#2c2c2c] shadow-lg flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 220 220">
        {tickLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.isHour ? 'white' : 'rgba(255,255,255,0.45)'}
            strokeWidth={line.isHour ? 2.5 : 1.2}
            strokeLinecap="round"
          />
        ))}
      </svg>
      {Array.from({ length: 12 }, (_, i) => i + 1).map(num => {
        const angle = (num / 12) * 360;
        return (
          <div
            key={num}
            className="absolute text-white text-[16px] font-medium"
            style={{
              transform: `rotate(${angle}deg) translateY(-88px) rotate(-${angle}deg)`,
            }}
          >
            {num}
          </div>
        );
      })}
      <div
        className="absolute left-1/2 top-1/2 w-1 h-14 bg-app-surface rounded-full origin-bottom"
        style={{ transform: `translate(-50%, -100%) rotate(${hourAngle}deg)` }}
      />
      <div
        className="absolute left-1/2 top-1/2 w-0.5 h-20 bg-app-surface rounded-full origin-bottom"
        style={{ transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)` }}
      />
      <div
        className="absolute left-1/2 top-1/2 w-0.5 h-24 bg-app-primary rounded-full origin-bottom"
        style={{ transform: `translate(-50%, -100%) rotate(${secondAngle}deg)` }}
      />
      <div className="absolute w-2.5 h-2.5 rounded-full bg-app-primary" />
    </div>
  );
};

const WorldClockCityItem: React.FC<{
  city: WorldCity;
  cityTime: Date;
  now: Date;
  selectionMode: boolean;
  selected: boolean;
  onSelectToggle: () => void;
  onSelectionStart: () => void;
}> = ({ city, cityTime, now, selectionMode, selected, onSelectToggle, onSelectionStart }) => {
  const s = useAppStrings(strings, stringsEn);
  const { bindLongPress } = useClockGestures();

  return (
    <div
      className={`bg-app-surface rounded-2xl px-4 py-5 flex items-center justify-between ${selectionMode && selected ? 'bg-blue-50' : ''}`}
      {...bindLongPress({ kind: 'action', id: 'world.city.selection.enter' }, { duration: 450, onTrigger: () => onSelectionStart() })}
      onClick={() => { if (selectionMode) onSelectToggle(); }}
      onContextMenu={(e) => {
        if (!selectionMode) {
          e.preventDefault();
          onSelectionStart();
        }
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {selectionMode && (
          <div className="shrink-0 text-gray-400">
            <IcGripVertical size={20} strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[16px] font-medium text-black">{city.name}</div>
          <div className="text-[15px] text-gray-400">
            {formatCityDate(cityTime, s.month_suffix, s.day_suffix)}｜{formatCityDiff(city.gmtOffsetMinutes, now, s.world_clock_local_time)}
          </div>
        </div>
      </div>
      {selectionMode ? (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${selected ? 'bg-app-primary text-white' : 'border border-gray-300 text-transparent'}`}>
          <IcCheck size={16} />
        </div>
      ) : (
        <div className="text-[22px] font-medium text-black shrink-0">
          {pad2(cityTime.getHours())}:{pad2(cityTime.getMinutes())}
        </div>
      )}
    </div>
  );
};

export const WorldClockPage: React.FC<{
  selectedCities: WorldCity[];
  onOpenAdd: () => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onSelectToggle: (id: string) => void;
  onSelectionStart: (id: string) => void;
  onExitSelection: () => void;
  onToggleSelectAll: () => void;
}> = ({
  selectedCities,
  onOpenAdd,
  selectionMode,
  selectedIds,
  onSelectToggle,
  onSelectionStart,
  onExitSelection,
  onToggleSelectAll,
}) => {
  const s = useAppStrings(strings, stringsEn);
  const [now, setNow] = useState(() => getDate());
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clockContainerRef = useRef<HTMLDivElement>(null);
  const [snapHeight, setSnapHeight] = useState(260);
  const prevSelectionMode = useRef(selectionMode);
  const isAllSelected = selectedCities.length > 0 && selectedIds.size === selectedCities.length;

  useEffect(() => {
    const el = clockContainerRef.current;
    if (!el) return;
    const update = () => setSnapHeight(el.offsetHeight);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [selectionMode]);

  useEffect(() => {
    const timer = setInterval(() => setNow(getDate()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (prevSelectionMode.current && !selectionMode) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setScrollTop(0);
    }
    prevSelectionMode.current = selectionMode;
  }, [selectionMode]);

  const t = snapHeight > 0 ? Math.min(1, scrollTop / snapHeight) : 0;
  const timeFontSize = selectionMode ? 56 : 28 + (56 - 28) * t;

  return (
    <div className="h-full w-full bg-app-bg flex flex-col">
      <CollapsingToolbar
        title={selectionMode ? `${s.selected_count_prefix}${selectedIds.size}${s.selected_count_suffix}` : s.world_clock_tab}
        alwaysShowSmallTitle={selectionMode}
        bgClass="bg-app-bg"
        leftContent={selectionMode ? (
          <button className="w-10 h-10 flex items-center justify-center -ml-2 active:opacity-60" onClick={onExitSelection}>
            <IcClose size={28} className="text-app-text" />
          </button>
        ) : undefined}
        rightContent={selectionMode ? (
          <button onClick={onToggleSelectAll} className="w-10 h-10 flex items-center justify-center active:opacity-60">
            <IcList size={28} className={isAllSelected ? 'text-app-primary' : 'text-gray-400'} />
          </button>
        ) : (
          <>
            <ToolbarIconButton icon={IcAdd} onClick={onOpenAdd} label={s.toolbar_add} />
            <ToolbarIconButton icon={IcMoreVert} label={s.toolbar_more} />
          </>
        )}
      />
      <div className="shrink-0" style={{ height: TOOLBAR_SPACER_HEIGHT }} aria-hidden />
      <div className="px-[26px] pb-2">
        <h1 className="text-[32px] font-normal text-app-text">
          {selectionMode ? `${s.selected_count_prefix}${selectedIds.size}${s.selected_count_suffix}` : s.world_clock_tab}
        </h1>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
        onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        {!selectionMode && (
          <div
            ref={clockContainerRef}
            className="flex flex-col items-center justify-center gap-3 pb-4 pt-4 shrink-0"
            style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            <AnalogClock date={now} />
          </div>
        )}

        <div className="shrink-0" style={{ minHeight: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>
          <div className="sticky top-0 z-10 bg-app-bg pt-2 pb-6 flex flex-col items-center">
            <div
              className="font-medium text-black tracking-tight"
              style={{ fontSize: timeFontSize }}
            >
              {pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}
            </div>
            <div className="text-[18px] text-gray-400 mt-1">{s.world_clock_local_time}{formatCityDate(now, s.month_suffix, s.day_suffix)}</div>
          </div>

          <div className="px-4 pb-32 flex flex-col gap-3">
          {selectedCities.map(city => {
            const cityTime = getCityTime(city.gmtOffsetMinutes, now);
            const selected = selectedIds.has(city.id);
            return (
              <WorldClockCityItem
                key={city.id}
                city={city}
                cityTime={cityTime}
                now={now}
                selectionMode={selectionMode}
                selected={selected}
                onSelectToggle={() => onSelectToggle(city.id)}
                onSelectionStart={() => onSelectionStart(city.id)}
              />
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
};
