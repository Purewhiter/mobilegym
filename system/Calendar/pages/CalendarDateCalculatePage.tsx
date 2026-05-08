import React from 'react';
import { MaskIcon } from '../components/MaskIcon';
import { useCalendarStore, selectSelectedDate } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import * as TimeService from '@/os/TimeService';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

type Tab = 'calculate' | 'interval';

const pad2 = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const CalendarDateCalculatePage: React.FC = () => {
  const { bindBack } = useCalendarGestures();
  const selectedDate = useCalendarStore(selectSelectedDate);
  const s = useAppStrings(strings, stringsEn);

  const [tab, setTab] = React.useState<Tab>('calculate');

  // calculate
  const [startYmd, setStartYmd] = React.useState(() => toYmd(selectedDate));
  const [days, setDays] = React.useState('1');
  const [direction, setDirection] = React.useState<'after' | 'before'>('after');
  const [calcResult, setCalcResult] = React.useState<string>('');

  // interval
  const [fromYmd, setFromYmd] = React.useState(() => toYmd(selectedDate));
  const [toYmdValue, setToYmdValue] = React.useState(() => toYmd(selectedDate));
  const [intervalResult, setIntervalResult] = React.useState<string>('');

  const doCalculate = () => {
    const start = TimeService.fromTimestamp(TimeService.parseToTimestamp(`${startYmd}T00:00:00`));
    const n = Number(days);
    if (Number.isNaN(start.getTime()) || !Number.isFinite(n)) return;
    const delta = Math.max(0, Math.trunc(n));
    const next = TimeService.fromTimestamp(start.getTime());
    next.setDate(start.getDate() + (direction === 'after' ? delta : -delta));
    setCalcResult(`${toYmd(next)}（${next.getMonth() + 1}月${next.getDate()}日）`);
  };

  const doInterval = () => {
    const a = TimeService.fromTimestamp(TimeService.parseToTimestamp(`${fromYmd}T00:00:00`));
    const b = TimeService.fromTimestamp(TimeService.parseToTimestamp(`${toYmdValue}T00:00:00`));
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return;
    const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
    setIntervalResult(`${s.calculate_interval_result_prefix}${diff} ${s.day_unit}`);
  };

  return (
    <div className="flex flex-col h-full bg-app-surface dark:bg-black text-black dark:text-white pt-10">
      {/* Header */}
      <div className="flex items-center px-4 py-3 shrink-0">
        <button
          {...bindBack()}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200"
        >
          <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
        </button>
        <h1 className="ml-2 text-[17px] font-medium">{s.date_calculate}</h1>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-2 pb-3 shrink-0">
        <div className="inline-flex bg-app-bg dark:bg-[#1c1c1e] rounded-full p-1">
          <button
            onClick={() => setTab('calculate')}
            className={`px-4 py-2 rounded-full text-[13px] ${
              tab === 'calculate'
                ? 'bg-app-surface dark:bg-black text-app-text dark:text-gray-100 shadow-sm'
                : 'text-app-text-muted dark:text-gray-400'
            }`}
          >
            {s.calculate_tab_calc}
          </button>
          <button
            onClick={() => setTab('interval')}
            className={`px-4 py-2 rounded-full text-[13px] ${
              tab === 'interval'
                ? 'bg-app-surface dark:bg-black text-app-text dark:text-gray-100 shadow-sm'
                : 'text-app-text-muted dark:text-gray-400'
            }`}
          >
            {s.calculate_tab_interval}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {tab === 'calculate' ? (
          <div className="flex flex-col gap-4">
            <div className="bg-app-bg dark:bg-[#1c1c1e] rounded-2xl p-4">
              <div className="text-[13px] text-app-text-muted dark:text-gray-400 mb-2">{s.calculate_start_date}</div>
              <input
                type="date"
                value={startYmd}
                onChange={(e) => setStartYmd(e.target.value)}
                className="w-full bg-transparent outline-none text-[16px] text-app-text dark:text-gray-100"
              />
            </div>

            <div className="bg-app-bg dark:bg-[#1c1c1e] rounded-2xl p-4">
              <div className="text-[13px] text-app-text-muted dark:text-gray-400 mb-2">{s.calculate_input_days}</div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[16px] text-app-text dark:text-gray-100"
                />
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'after' | 'before')}
                  className="bg-transparent outline-none text-[14px] text-gray-600 dark:text-gray-300"
                >
                  <option value="after">{s.calculate_days_after}</option>
                  <option value="before">{s.calculate_days_before}</option>
                </select>
              </div>
            </div>

            <button
              onClick={doCalculate}
              className="mt-2 w-full bg-[#3482FF] text-white rounded-2xl py-3 text-[16px] active:opacity-90"
            >
              {s.calculate_start}
            </button>

            {calcResult && (
              <div className="mt-2 bg-app-surface dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/10 rounded-2xl p-4">
                <div className="text-[13px] text-app-text-muted dark:text-gray-400">{s.calculate_result}</div>
                <div className="mt-1 text-[16px] text-app-text dark:text-gray-100">{calcResult}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-app-bg dark:bg-[#1c1c1e] rounded-2xl p-4">
              <div className="text-[13px] text-app-text-muted dark:text-gray-400 mb-2">{s.calculate_start_date}</div>
              <input
                type="date"
                value={fromYmd}
                onChange={(e) => setFromYmd(e.target.value)}
                className="w-full bg-transparent outline-none text-[16px] text-app-text dark:text-gray-100"
              />
            </div>

            <div className="bg-app-bg dark:bg-[#1c1c1e] rounded-2xl p-4">
              <div className="text-[13px] text-app-text-muted dark:text-gray-400 mb-2">{s.calculate_end_date}</div>
              <input
                type="date"
                value={toYmdValue}
                onChange={(e) => setToYmdValue(e.target.value)}
                className="w-full bg-transparent outline-none text-[16px] text-app-text dark:text-gray-100"
              />
            </div>

            <button
              onClick={doInterval}
              className="mt-2 w-full bg-[#3482FF] text-white rounded-2xl py-3 text-[16px] active:opacity-90"
            >
              {s.calculate_start}
            </button>

            {intervalResult && (
              <div className="mt-2 bg-app-surface dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/10 rounded-2xl p-4">
                <div className="text-[13px] text-app-text-muted dark:text-gray-400">{s.calculate_result}</div>
                <div className="mt-1 text-[16px] text-app-text dark:text-gray-100">{intervalResult}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
