/**
 * Utility functions for Calendar app.
 * Week starts on Monday (一).
 * All lunar / festival / solar-term data comes from calendarData2026.
 */

import { getCalendarDateInfo, resolveLunarDate, ganZhiYear, zodiacAnimal, type CalendarDateInfo } from '../data/calendarData2026';
import * as TimeService from '@/os/TimeService';
import type { CalendarEvent } from '../types';

// ============================================================
//  Types
// ============================================================
export interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
}

export interface WeekDay {
    date: Date;
    weekDay: string;
    isToday: boolean;
    lunarLabel: string;
}

type CalendarEventTimeRange = Pick<CalendarEvent, 'startTs' | 'endTs'>;

// ============================================================
//  Month grid generation (Monday start)
// ============================================================
export const generateMonthDays = (
    year: number,
    month: number,
    weekStartDay: 'monday' | 'sunday' = 'monday',
): CalendarDay[] => {
    const firstDayOfMonth = TimeService.fromLocalParts(year, month, 1);
    const lastDayOfMonth = TimeService.fromLocalParts(year, month + 1, 0);

    // Monday = 0 … Sunday = 6
    const firstDayOfWeek =
        weekStartDay === 'sunday'
            ? firstDayOfMonth.getDay()
            : (firstDayOfMonth.getDay() + 6) % 7;

    const days: CalendarDay[] = [];

    // Previous month padding
    const prevLast = TimeService.fromLocalParts(year, month, 0);
    for (let i = firstDayOfWeek; i > 0; i--) {
        const date = TimeService.fromLocalParts(year, month - 1, prevLast.getDate() - i + 1);
        days.push({ date, isCurrentMonth: false, isToday: isToday(date) });
    }

    // Current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
        const date = TimeService.fromLocalParts(year, month, i);
        days.push({ date, isCurrentMonth: true, isToday: isToday(date) });
    }

    // Next month padding
    const totalCells = Math.ceil(days.length / 7) * 7;
    for (let i = 1; days.length < totalCells; i++) {
        const date = TimeService.fromLocalParts(year, month + 1, i);
        days.push({ date, isCurrentMonth: false, isToday: isToday(date) });
    }

    return days;
};

// ============================================================
//  Week days generation (Monday start)
// ============================================================
const DEFAULT_WEEKDAY_LABELS_MON = ['一', '二', '三', '四', '五', '六', '日'];
const DEFAULT_WEEKDAY_LABELS_SUN = ['日', '一', '二', '三', '四', '五', '六'];

export const generateWeekDays = (
    currentDate: Date,
    weekStartDay: 'monday' | 'sunday' = 'monday',
    weekLabels?: string[],
): WeekDay[] => {
    const dayOfWeek =
        weekStartDay === 'sunday'
            ? currentDate.getDay()
            : (currentDate.getDay() + 6) % 7; // Mon=0
    const weekStart = TimeService.fromTimestamp(currentDate.getTime());
    weekStart.setDate(currentDate.getDate() - dayOfWeek);

    const defaultLabels = weekStartDay === 'sunday' ? DEFAULT_WEEKDAY_LABELS_SUN : DEFAULT_WEEKDAY_LABELS_MON;
    const labels = weekLabels ?? defaultLabels;
    const days: WeekDay[] = [];

    for (let i = 0; i < 7; i++) {
        const date = TimeService.fromTimestamp(weekStart.getTime());
        date.setDate(weekStart.getDate() + i);
        const info = getCalendarDateInfo(date);
        days.push({
            date,
            weekDay: labels[i],
            isToday: isToday(date),
            lunarLabel: info.label,
        });
    }
    return days;
};

// ============================================================
//  ISO week number
// ============================================================
export const getWeekNumber = (date: Date): number => {
    const d = TimeService.fromTimestamp(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = TimeService.fromTimestamp(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

// ============================================================
//  Date helpers
// ============================================================
export const isToday = (d: Date): boolean => {
    const now = TimeService.getDate();
    return isSameDay(d, now);
};

export const isSameDay = (d1: Date, d2: Date): boolean =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

export const formatCalendarDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const buildEventDateKeySet = (events: CalendarEventTimeRange[]): Set<string> => {
    const keys = new Set<string>();

    for (const event of events) {
        const startDay = TimeService.fromTimestamp(event.startTs);
        startDay.setHours(0, 0, 0, 0);

        // `endTs` 视为开区间边界；减 1ms 可避免整天事件误标到下一天。
        const endInclusiveTs = Math.max(event.startTs, event.endTs - 1);
        const endDay = TimeService.fromTimestamp(endInclusiveTs);
        endDay.setHours(0, 0, 0, 0);

        for (
            const cursor = TimeService.fromTimestamp(startDay.getTime());
            cursor.getTime() <= endDay.getTime();
            cursor.setDate(cursor.getDate() + 1)
        ) {
            keys.add(formatCalendarDateKey(cursor));
        }
    }

    return keys;
};

// ============================================================
//  Public API used by components (delegates to calendarData2026)
// ============================================================

/**
 * Returns display info for a single calendar cell.
 * This is the main function used by CalendarGrid, WeekView etc.
 */
export const getLunarInfo = (date: Date): CalendarDateInfo => {
    return getCalendarDateInfo(date);
};

/**
 * Lunar full info for the Agenda panel (selected date).
 */
export const getLunarFullInfo = (date: Date) => {
    const lunar = resolveLunarDate(date);

    const title = `${lunar.monthName}${lunar.dayLabel}`;
    const gz = ganZhiYear(lunar.lunarYear);
    const animal = zodiacAnimal(lunar.lunarYear);
    const subtitle = `${gz}${animal}年`;

    return { title, subtitle };
};

export const formatChineseDate = (date: Date): string => `${date.getMonth() + 1}月`;
