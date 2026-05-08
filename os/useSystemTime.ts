/**
 * useSystemTime Hook
 * 
 * A React hook that provides access to the system time service.
 * Use this hook in components that need to display or work with time.
 * 
 * Usage:
 * ```tsx
 * const { now, getDate, formatTime, formatDateCN } = useSystemTime();
 * const timestamp = now();
 * const displayTime = formatTime();
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import * as TimeService from './TimeService';

interface UseSystemTimeReturn {
    /** Get current timestamp (ms) */
    now: () => number;
    /** Get current Date object */
    getDate: () => Date;
    /** Get formatted time string (HH:MM) */
    formatTime: () => string;
    /** Get formatted date string (M月D日) */
    formatDateCN: () => string;
    /** Get today's date string (YYYY-MM-DD) */
    getToday: () => string;
    /** Get day of week in Chinese */
    getDayOfWeekCN: () => string;
    /** Current time string (auto-updating) */
    timeString: string;
    /** Current timestamp (auto-updating every second) */
    currentTime: number;
}

/**
 * Hook to access system time with auto-updating capabilities
 * @param autoUpdate - Whether to auto-update time every second (default: false)
 */
export function useSystemTime(autoUpdate: boolean = false): UseSystemTimeReturn {
    const [timeString, setTimeString] = useState(TimeService.formatTime());
    const [currentTime, setCurrentTime] = useState(TimeService.now());

    useEffect(() => {
        if (!autoUpdate) return;

        const update = () => {
            setTimeString(TimeService.formatTime());
            setCurrentTime(TimeService.now());
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [autoUpdate]);

    return {
        now: TimeService.now,
        getDate: TimeService.getDate,
        formatTime: TimeService.formatTime,
        formatDateCN: TimeService.formatDateCN,
        getToday: TimeService.getToday,
        getDayOfWeekCN: TimeService.getDayOfWeekCN,
        timeString,
        currentTime,
    };
}

export default useSystemTime;
