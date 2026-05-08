import React from 'react';
import { MaskIcon } from '../components/MaskIcon';
import { useCalendarStore, selectSelectedDate } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import * as TimeService from '@/os/TimeService';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

const toYmd = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const CalendarDateJumpPage: React.FC = () => {
  const { go, bindBack } = useCalendarGestures();
  const selectedDate = useCalendarStore(selectSelectedDate);
  const setSelectedDate = useCalendarStore(s => s.setSelectedDate);
  const s = useAppStrings(strings, stringsEn);
  const [ymd, setYmd] = React.useState(() => toYmd(selectedDate));

  const apply = () => {
    const next = TimeService.fromTimestamp(TimeService.parseToTimestamp(`${ymd}T00:00:00`));
    if (Number.isNaN(next.getTime())) return;
    setSelectedDate(next);
    go('home.open');
  };

  return (
    <div className="flex flex-col h-full bg-app-surface dark:bg-black text-black dark:text-white pt-10">
      <div className="flex items-center px-4 py-3 shrink-0">
        <button
          {...bindBack()}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200"
        >
          <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
        </button>
        <h1 className="ml-2 text-[17px] font-medium">{s.date_jump}</h1>
      </div>

      <div className="px-5 pt-5">
        <div className="text-[13px] text-app-text-muted dark:text-gray-400 mb-2">{s.calculate_select_date}</div>
        <div className="bg-app-bg dark:bg-[#1c1c1e] rounded-2xl px-4 py-3">
          <input
            type="date"
            value={ymd}
            onChange={(e) => setYmd(e.target.value)}
            className="w-full bg-transparent outline-none text-[16px] text-app-text dark:text-gray-100"
          />
        </div>

        <button
          onClick={apply}
          className="mt-6 w-full bg-[#3482FF] text-white rounded-2xl py-3 text-[16px] active:opacity-90"
        >
          {s.calculate_jump}
        </button>
      </div>
    </div>
  );
};
