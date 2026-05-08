import React, { useState, useEffect } from 'react';
import * as TimeService from '../TimeService';
import { SIMULATOR_CONFIG } from '../data';
import { useLocale } from '../locale';
const { clockFontSize } = SIMULATOR_CONFIG.framework;

export const HomeClockWidget: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
    const locale = useLocale();
    const [timeStr, setTimeStr] = useState(TimeService.formatTime());
    const [dateStr, setDateStr] = useState(TimeService.formatDate());
    const [dayOfWeek, setDayOfWeek] = useState(TimeService.getDayOfWeek());

    useEffect(() => {
        const update = () => {
            setTimeStr(TimeService.formatTime());
            setDateStr(TimeService.formatDate());
            setDayOfWeek(TimeService.getDayOfWeek());
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setDateStr(TimeService.formatDate());
        setDayOfWeek(TimeService.getDayOfWeek());
    }, [locale]);

    return (
        <div className="flex flex-col items-center mb-6">
            <div className="text-gray-200 text-sm mb-1">
                {dateStr} {dayOfWeek}
            </div>
            <div
                role={onClick ? 'button' : undefined}
                className={`text-white font-extralight leading-none ${onClick ? 'cursor-pointer active:opacity-80 transition-opacity' : ''}`}
                style={{ fontSize: `${clockFontSize}px` }}
                onClick={onClick}
            >
                {timeStr}
            </div>
        </div>
    );
};
