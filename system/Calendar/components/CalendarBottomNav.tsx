import React from 'react';
import { MaskIcon } from './MaskIcon';
import { getHyperosSymbolUrl, getHyperosDayIconName, IcSymbolMonths, IcSymbolWeeks, IcSymbolYears } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
export type CalendarViewType = 'year' | 'month' | 'week' | 'day';

interface CalendarBottomNavProps {
    activeView: CalendarViewType;
    onViewChange: (view: CalendarViewType) => void;
    dayNumber: number;
}

const CACHE_V = '2';

export const CalendarBottomNav: React.FC<CalendarBottomNavProps> = ({ activeView, onViewChange, dayNumber }) => {
    const s = useAppStrings(strings, stringsEn);
    const dayIconName = getHyperosDayIconName(dayNumber);

    const items: { id: CalendarViewType; label: string; icon: React.ReactNode }[] = [
        {
            id: 'year',
            label: s.tab_year,
            icon: <MaskIcon src={getHyperosSymbolUrl(IcSymbolYears, CACHE_V)} size={22} />,
        },
        {
            id: 'month',
            label: s.tab_month,
            icon: <MaskIcon src={getHyperosSymbolUrl(IcSymbolMonths, CACHE_V)} size={22} />,
        },
        {
            id: 'week',
            label: s.tab_week,
            icon: <MaskIcon src={getHyperosSymbolUrl(IcSymbolWeeks, CACHE_V)} size={22} />,
        },
        {
            id: 'day',
            label: s.tab_day,
            icon: <MaskIcon src={getHyperosSymbolUrl(dayIconName, CACHE_V)} size={22} />,
        },
    ];

    return (
        <div className="flex items-center justify-around py-1.5 border-t border-gray-100 dark:border-gray-800 bg-app-surface dark:bg-black shrink-0 pb-safe">
            {items.map((item) => {
                const active = activeView === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className="flex flex-col items-center justify-center gap-0.5 w-14 py-1"
                    >
                        <span className={active ? 'text-black dark:text-white' : 'text-gray-400'}>
                            {item.icon}
                        </span>
                        <span className={`text-[10px] ${active ? 'text-black dark:text-white font-medium' : 'text-gray-400'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
