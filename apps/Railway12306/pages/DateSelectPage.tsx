import React, { useMemo } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import * as TimeService from '../../../os/TimeService';
import { useLocale } from '../../../os/locale';

// 简化的农历数据（2026年2-3月关键日期）
const LUNAR_MAP: Record<string, { lunar: string; festival?: string; holiday?: 'rest' | 'work' }> = {
  '2026-02-01': { lunar: '十四' }, '2026-02-02': { lunar: '十五' }, '2026-02-03': { lunar: '十六' },
  '2026-02-04': { lunar: '十七' }, '2026-02-05': { lunar: '十八' }, '2026-02-06': { lunar: '十九' },
  '2026-02-07': { lunar: '二十' }, '2026-02-08': { lunar: '廿一' }, '2026-02-09': { lunar: '廿二' },
  '2026-02-10': { lunar: '今天' }, '2026-02-11': { lunar: '廿四' }, '2026-02-12': { lunar: '廿五' },
  '2026-02-13': { lunar: '廿六' }, '2026-02-14': { lunar: '廿七', holiday: 'work' },
  '2026-02-15': { lunar: '廿八', holiday: 'rest' }, '2026-02-16': { lunar: '除夕', festival: '除夕', holiday: 'rest' },
  '2026-02-17': { lunar: '春节', festival: '春节', holiday: 'rest' },
  '2026-02-18': { lunar: '初二', holiday: 'rest' }, '2026-02-19': { lunar: '初三', holiday: 'rest' },
  '2026-02-20': { lunar: '初四', holiday: 'rest' }, '2026-02-21': { lunar: '初五', holiday: 'rest' },
  '2026-02-22': { lunar: '初六', holiday: 'rest' }, '2026-02-23': { lunar: '初七', holiday: 'rest' },
  '2026-02-24': { lunar: '初八' }, '2026-02-25': { lunar: '初九' }, '2026-02-26': { lunar: '初十' },
  '2026-02-27': { lunar: '十一' }, '2026-02-28': { lunar: '十二', holiday: 'work' },
  '2026-03-01': { lunar: '十三' }, '2026-03-02': { lunar: '十四' },
  '2026-03-03': { lunar: '元宵节', festival: '元宵节' },
  '2026-03-04': { lunar: '十六' }, '2026-03-05': { lunar: '十七' },
};

const LUNAR_LABELS_EN: Record<string, string> = {
  十四: '14th',
  十五: '15th',
  十六: '16th',
  十七: '17th',
  十八: '18th',
  十九: '19th',
  二十: '20th',
  廿一: '21st',
  廿二: '22nd',
  廿四: '24th',
  廿五: '25th',
  廿六: '26th',
  廿七: '27th',
  廿八: '28th',
  初二: '2nd',
  初三: '3rd',
  初四: '4th',
  初五: '5th',
  初六: '6th',
  初七: '7th',
  初八: '8th',
  初九: '9th',
  初十: '10th',
  十一: '11th',
  十二: '12th',
  十三: '13th',
  今天: 'Today',
  除夕: 'Eve',
  春节: 'Spring',
  元宵节: 'Lantern',
};

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function localizeLunarLabel(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  return LUNAR_LABELS_EN[value] || value;
}

function getMonthDays(year: number, month: number) {
  const firstDay = TimeService.fromLocalParts(year, month, 1).getDay();
  const daysInMonth = TimeService.fromLocalParts(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

export const DateSelectPage: React.FC = () => {
  const selectedDate = useRailwayStore(s => s.date);
  const setDate = useRailwayStore(s => s.setDate);
  const { bindBack, back } = useRailwayGestures();
  const isEnglish = useLocale() === 'en';

  const { todayStr, maxSelectableDateStr } = useMemo(() => {
    const d = TimeService.getDate();
    d.setHours(0, 0, 0, 0);
    const maxDate = TimeService.fromTimestamp(d.getTime());
    maxDate.setDate(maxDate.getDate() + 14);
    const formatDate = (value: Date) => (
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    );
    return {
      todayStr: formatDate(d),
      maxSelectableDateStr: formatDate(maxDate),
    };
  }, []);

  const months = useMemo(() => {
    const now = TimeService.getDate();
    return [
      { year: now.getFullYear(), month: now.getMonth() },
      { year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), month: (now.getMonth() + 1) % 12 },
    ];
  }, []);

  const handleSelect = (dateStr: string) => {
    if (dateStr < todayStr || dateStr > maxSelectableDateStr) return;
    setDate(dateStr);
    back();
  };

  const weekdays = isEnglish ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="min-h-full bg-app-surface">
      {/* 顶栏 + 星期标题 — 整体 sticky */}
      <div className="sticky top-0 z-20">
        <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3">
          <button {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
          <span className="text-white text-lg font-medium flex-1 text-center pr-8">{isEnglish ? 'Select date' : '选择日期'}</span>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 text-center py-2 bg-app-surface border-b border-gray-100">
          {weekdays.map((d, i) => (
            <span key={d} className={`text-sm ${i === 0 || i === 6 ? 'text-app-primary' : 'text-gray-700'}`}>{d}</span>
          ))}
        </div>
      </div>

      {/* 月份日历 */}
      <div className="pb-20">
        {months.map(({ year, month }) => {
          const days = getMonthDays(year, month);
          const monthTitle = isEnglish ? `${MONTH_NAMES_EN[month]} ${year}` : `${year}年${month + 1}月`;
          return (
            <div key={`${year}-${month}`}>
              <div className="text-center py-3 bg-gray-50 text-sm font-medium text-gray-700">
                {monthTitle}
              </div>
              <div className="grid grid-cols-7 gap-y-1 px-1">
                {days.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isPast = dateStr < todayStr;
                  const isBeyondRange = dateStr > maxSelectableDateStr;
                  const isDisabled = isPast || isBeyondRange;
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === todayStr;
                  const lunarInfo = LUNAR_MAP[dateStr];
                  const isHoliday = lunarInfo?.holiday === 'rest';
                  const isWorkday = lunarInfo?.holiday === 'work';
                  const festival = lunarInfo?.festival;
                  const lunarText = festival || lunarInfo?.lunar || '';

                  return (
                    <div
                      key={dateStr}
                      className={`flex flex-col items-center py-1.5 cursor-pointer relative rounded-lg mx-0.5
                        ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'active:bg-gray-100'}
                        ${isSelected ? 'bg-app-primary text-white' : ''}
                        ${isToday && !isSelected ? 'bg-app-primary text-white' : ''}
                      `}
                      onClick={() => !isDisabled && handleSelect(dateStr)}
                    >
                      {/* 休/班标记 */}
                      {(isHoliday || isWorkday) && (
                        <span className={`absolute top-0 right-0 text-[8px] font-bold ${isHoliday ? 'text-red-500' : 'text-gray-500'}`}>
                          {isHoliday ? (isEnglish ? 'Off' : '休') : (isEnglish ? 'Work' : '班')}
                        </span>
                      )}
                      <span className={`text-base font-medium ${
                        isSelected || isToday ? 'text-white' :
                        isHoliday ? 'text-red-500' : 'text-gray-900'
                      }`}>
                        {day}
                      </span>
                      <span className={`text-[10px] ${
                        isSelected || isToday ? 'text-white/80' :
                        festival ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {isToday && !isSelected ? (isEnglish ? 'Today' : '今天') : localizeLunarLabel(lunarText, isEnglish)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
