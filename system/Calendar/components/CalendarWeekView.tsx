import React from 'react';
import { generateWeekDays, getWeekNumber, getLunarInfo, isSameDay } from '../utils/calendarUtils';
import * as TimeService from '../../../os/TimeService';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

interface CalendarWeekViewProps {
    currentDate: Date;
    onDayClick?: (date: Date) => void;
    weekStartDay?: 'monday' | 'sunday';
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({ currentDate, onDayClick, weekStartDay = 'monday' }) => {
    const s = useAppStrings(strings, stringsEn);
    const weekLabelsMon = [s.weekday_mon, s.weekday_tue, s.weekday_wed, s.weekday_thu, s.weekday_fri, s.weekday_sat, s.weekday_sun];
    const weekLabelsSun = [s.weekday_sun, s.weekday_mon, s.weekday_tue, s.weekday_wed, s.weekday_thu, s.weekday_fri, s.weekday_sat];
    const weekLabels = weekStartDay === 'sunday' ? weekLabelsSun : weekLabelsMon;
    const weekDays = generateWeekDays(currentDate, weekStartDay, weekLabels);
    const weekNum = getWeekNumber(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const now = TimeService.getDate();
    const curH = now.getHours();
    const curM = now.getMinutes();

    return (
        <div className="flex flex-col h-full bg-app-surface dark:bg-black">
            {/* ===== Week strip ===== */}
            <div className="flex items-stretch border-b border-gray-100 dark:border-gray-800 shrink-0">
                {/* Week number column */}
                <div className="w-10 flex flex-col items-center justify-center">
                    <span className="text-[11px] text-gray-400">{weekNum}</span>
                </div>

                {/* 7 day columns */}
                <div className="flex-1 grid grid-cols-7 py-2">
                    {weekDays.map((day, idx) => {
                        const selected = isSameDay(day.date, currentDate);
                        const lunar = getLunarInfo(day.date);

                        return (
                            <div
                                key={idx}
                                className="flex flex-col items-center gap-0.5 cursor-pointer"
                                onClick={() => onDayClick?.(day.date)}
                            >
                                {/* Weekday label */}
                                <span className="text-xs text-app-text-muted">{day.weekDay}</span>

                                {/* Date number */}
                                <div
                                    className={`w-8 h-8 flex items-center justify-center rounded-full text-[15px]
                                        ${selected
                                            ? 'bg-app-primary text-white font-medium'
                                            : day.isToday
                                                ? 'text-app-primary font-medium'
                                                : 'text-black dark:text-white'
                                        }`}
                                >
                                    {day.date.getDate()}
                                </div>

                                {/* Lunar */}
                                <span className={`text-[9px] leading-none ${selected ? 'text-app-primary' : 'text-gray-400'}`}>
                                    {lunar.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ===== Hourly time grid ===== */}
            <div className="flex-1 overflow-y-auto relative">
                <div className="relative" style={{ height: `${24 * 60}px` }}>
                    {/* Hour rows */}
                    {hours.map((h) => (
                        <div
                            key={h}
                            className="absolute w-full flex"
                            style={{ top: `${h * 60}px` }}
                        >
                            <div className="w-14 text-[11px] text-gray-400 text-right pr-2 -mt-[7px] shrink-0">
                                {String(h).padStart(2, '0')}:00
                            </div>
                            <div className="flex-1 border-t border-gray-100 dark:border-gray-800" />
                        </div>
                    ))}

                    {/* Current time red line */}
                    <div
                        className="absolute left-0 right-0 z-20 flex items-center"
                        style={{ top: `${curH * 60 + curM}px` }}
                    >
                        <div className="bg-red-500 text-white text-[9px] px-1 py-0.5 rounded ml-1 leading-none shrink-0">
                            {String(curH).padStart(2, '0')}:{String(curM).padStart(2, '0')}
                        </div>
                        <div className="flex-1 border-t-2 border-red-500" />
                    </div>
                </div>
            </div>
        </div>
    );
};
