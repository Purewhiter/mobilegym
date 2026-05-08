import React from 'react';
import { generateMonthDays, isSameDay } from '../utils/calendarUtils';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

interface CalendarYearViewProps {
    year: number;
    selectedDate: Date;
    onMonthClick: (month: number) => void;
    weekStartDay?: 'monday' | 'sunday';
}

export const CalendarYearView: React.FC<CalendarYearViewProps> = ({ year, selectedDate, onMonthClick, weekStartDay = 'monday' }) => {
    const s = useAppStrings(strings, stringsEn);
    const months = Array.from({ length: 12 }, (_, i) => i);

    // Build month names from string keys
    const monthNames = [
        s.month_1, s.month_2, s.month_3, s.month_4,
        s.month_5, s.month_6, s.month_7, s.month_8,
        s.month_9, s.month_10, s.month_11, s.month_12,
    ];

    // Build weekday labels in Mon-start and Sun-start orders from string keys
    const WEEK_LABELS_MON = [s.weekday_mon, s.weekday_tue, s.weekday_wed, s.weekday_thu, s.weekday_fri, s.weekday_sat, s.weekday_sun];
    const WEEK_LABELS_SUN = [s.weekday_sun, s.weekday_mon, s.weekday_tue, s.weekday_wed, s.weekday_thu, s.weekday_fri, s.weekday_sat];
    const labels = weekStartDay === 'sunday' ? WEEK_LABELS_SUN : WEEK_LABELS_MON;

    return (
        <div className="flex-1 overflow-y-auto px-3 pt-2 pb-6">
            <div className="grid grid-cols-3 gap-y-7 gap-x-3">
                {months.map((month) => {
                    const days = generateMonthDays(year, month, weekStartDay);
                    const isCurrent = year === selectedDate.getFullYear() && month === selectedDate.getMonth();

                    return (
                        <div
                            key={month}
                            onClick={() => onMonthClick(month)}
                            className="flex flex-col cursor-pointer"
                        >
                            {/* Month name */}
                            <h3 className={`text-base font-semibold mb-1.5 ${isCurrent ? 'text-app-primary' : 'text-black dark:text-white'}`}>
                                {monthNames[month]}
                            </h3>

                            {/* Weekday header */}
                            <div className="grid grid-cols-7 mb-0.5">
                                {labels.map((d, i) => (
                                    <div key={i} className="text-[7px] text-gray-400 text-center">{d}</div>
                                ))}
                            </div>

                            {/* Mini day grid */}
                            <div className="grid grid-cols-7 gap-y-0.5">
                                {days.map((day, idx) => {
                                    if (!day.isCurrentMonth) return <div key={idx} className="h-[14px]" />;

                                    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                                    const isSelected = isSameDay(day.date, selectedDate);

                                    return (
                                        <div key={idx} className="flex justify-center items-center h-[14px]">
                                            {isSelected ? (
                                                <div className="w-[14px] h-[14px] bg-app-primary rounded-full flex items-center justify-center">
                                                    <span className="text-[8px] text-white leading-none">{day.date.getDate()}</span>
                                                </div>
                                            ) : (
                                                <span className={`text-[9px] leading-none ${isWeekend ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {day.date.getDate()}
                                                </span>
                                            )}
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
