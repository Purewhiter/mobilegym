import React from 'react';
import { CalendarDay, formatCalendarDateKey, getLunarInfo, getWeekNumber, isSameDay } from '../utils/calendarUtils';
import * as TimeService from '../../../os/TimeService';

interface CalendarGridProps {
    days: CalendarDay[];
    onDayClick?: (day: CalendarDay) => void;
    selectedDate?: Date;
    showExtendMonth?: boolean;
    showWeekNumber?: boolean;
    eventDateKeys?: ReadonlySet<string>;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
    days,
    onDayClick,
    selectedDate,
    showExtendMonth = false,
    showWeekNumber = false,
    eventDateKeys,
}) => {
    const rows = days.length / 7;

    return (
        <div
            className="grid w-full"
            style={{
                gridTemplateColumns: showWeekNumber ? '28px repeat(7, 1fr)' : 'repeat(7, 1fr)',
                gridTemplateRows: `repeat(${rows}, 1fr)`,
            }}
        >
            {Array.from({ length: rows }).map((_, row) => {
                const rowDays = days.slice(row * 7, row * 7 + 7);
                const weekNum = getWeekNumber(rowDays[0]?.date ?? TimeService.getDate());
                return (
                    <React.Fragment key={row}>
                        {showWeekNumber && (
                            <div className="flex items-center justify-center text-[10px] text-gray-300 dark:text-gray-600">
                                {weekNum}
                            </div>
                        )}
                        {rowDays.map((day, i) => {
                            const lunar = getLunarInfo(day.date);
                            const selected = selectedDate && isSameDay(day.date, selectedDate);
                            const today = day.isToday;
                            const isOtherMonth = !day.isCurrentMonth;
                            const hasEvent = eventDateKeys?.has(formatCalendarDateKey(day.date)) ?? false;

                            if (isOtherMonth && !showExtendMonth) {
                                return <div key={i} />;
                            }

                            return (
                                <div
                                    key={i}
                                    onClick={() => onDayClick?.(day)}
                                    className="relative flex flex-col items-center justify-center cursor-pointer"
                                >
                                    {/* 班 / 休 badge — top-right corner */}
                                    {lunar.isWorkDay && !selected && (
                                        <span className="absolute top-0.5 right-0.5 text-[8px] font-bold text-orange-400 leading-none">班</span>
                                    )}
                                    {lunar.isRestDay && !selected && (
                                        <span className="absolute top-0.5 right-0.5 text-[8px] font-bold text-blue-400 leading-none">休</span>
                                    )}

                                    {/* Circle + content */}
                                    <div
                                        className={`flex flex-col items-center justify-center rounded-full transition-colors
                                            ${selected ? 'bg-app-primary w-11 h-11' : 'w-11 h-11'}`}
                                        style={isOtherMonth && !selected ? { opacity: 0.35 } : undefined}
                                    >
                                        {/* Date number */}
                                        <span
                                            className={`text-[17px] leading-tight
                                                ${selected
                                                    ? 'text-white font-medium'
                                                    : today
                                                        ? 'text-app-primary font-medium'
                                                        : lunar.isHoliday
                                                            ? 'text-orange-500'
                                                            : 'text-black dark:text-white'
                                                }`}
                                        >
                                            {day.date.getDate()}
                                        </span>

                                        {/* Lunar label */}
                                        <span
                                            className={`text-[9px] leading-none mt-px
                                                ${selected
                                                    ? 'text-white/80'
                                                    : lunar.isFestival
                                                        ? 'text-orange-500'
                                                        : lunar.isSolarTerm || lunar.isSpecial
                                                            ? 'text-teal-600'
                                                            : 'text-gray-400'
                                                }`}
                                        >
                                            {lunar.label}
                                        </span>

                                        <span
                                            aria-hidden="true"
                                            className={`mt-0.5 block h-1 w-1 rounded-full ${selected ? 'bg-white/75' : 'bg-gray-300'}`}
                                            style={{ opacity: hasEvent ? (isOtherMonth && !selected ? 0.75 : 1) : 0 }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
