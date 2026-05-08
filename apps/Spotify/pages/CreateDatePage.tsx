import React, { useEffect, useRef, useState } from 'react';
import * as TimeService from '../../../os/TimeService';
import { IcNavBack } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

const ScrollPicker = ({
  items,
  selected,
  onSelect,
  label,
}: {
  items: string[] | number[];
  selected: string | number;
  onSelect: (value: any) => void;
  label: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40;

  useEffect(() => {
    if (containerRef.current) {
      const index = items.indexOf(selected as never);
      if (index !== -1) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    }
  }, [items, selected]);

  return (
    <div className="flex flex-col items-center h-48 overflow-hidden relative w-1/3">
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-app-surface via-app-surface/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-app-surface via-app-surface/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute top-1/2 -translate-y-1/2 w-full h-[40px] border-y border-white/20 z-0 pointer-events-none" />

      <div
        ref={containerRef}
        className="w-full overflow-y-scroll scrollbar-hide snap-y snap-mandatory py-[76px]"
        onScroll={(e) => {
          const index = Math.round(e.currentTarget.scrollTop / itemHeight);
          if (items[index] !== undefined) onSelect(items[index]);
        }}
      >
        {items.map((item) => (
          <div
            key={item}
            className={`h-[40px] flex items-center justify-center snap-center text-lg font-bold transition-opacity ${item === selected ? 'text-white scale-110' : 'text-[#7f7f7f] scale-90'}`}
          >
            {item}
            {label && <span className="text-xs ml-1">{label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CreateDatePage: React.FC = () => {
  const { bindBack, bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();

  const currentYear = TimeService.getDate().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const [year, setYear] = useState(2000);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);

  useEffect(() => {
    const daysInMonth = TimeService.fromLocalParts(year, month, 0).getDate();
    if (day > daysInMonth) setDay(daysInMonth);
  }, [day, month, year]);

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-10 animate-in fade-in duration-300 relative">
      <div className="flex items-center justify-center relative w-full pt-6 mb-8">
        <button
          {...bindBack()}
          className="absolute left-0 p-1 -ml-2"
        >
          <IcNavBack className="text-white" size={32} />
        </button>
        <h1 className="text-base font-bold text-white">{s.create_account_title}</h1>
      </div>

      <div className="flex flex-col gap-2 mt-4 flex-1">
        <h2 className="text-3xl font-bold mb-8">{s.create_date_title}</h2>

        <div className="flex justify-center items-center w-full px-4 gap-4">
          <ScrollPicker items={years} selected={year} onSelect={setYear} label={s.create_date_year} />
          <ScrollPicker items={months} selected={month} onSelect={setMonth} label={s.create_date_month} />
          <ScrollPicker items={days} selected={day} onSelect={setDay} label={s.create_date_day} />
        </div>

        <div className="flex items-center justify-center mt-12 mb-8">
          <button
            className="px-8 py-3 rounded-full text-base font-bold bg-white text-black transition-transform active:scale-95"
            {...bindTap('auth.signup.gender.open')}
          >
            {s.create_account_next}
          </button>
        </div>
      </div>
    </div>
  );
};
