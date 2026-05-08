import React from 'react';
import { AgendaEventItem } from './AgendaEventItem';

interface AgendaItem {
    id?: string;
    title: string;
    subtitle: string;
    description?: string;
    daysLeft?: string;
    isHoliday?: boolean;
    color?: string;
    onClick?: () => void;
}

interface AgendaPanelProps {
    lunarTitle: string;
    lunarSubtitle: string;
    items: AgendaItem[];
}

export const AgendaPanel: React.FC<AgendaPanelProps> = ({ lunarTitle, lunarSubtitle, items }) => {
    return (
        <div className="flex flex-col min-h-0 flex-1 px-5 pt-5 pb-4 bg-[#f5f5f5] dark:bg-[#1a1a1a] rounded-t-[24px]">
            {/* Lunar date heading */}
            <div className="mb-3 shrink-0">
                <h2 className="text-2xl font-semibold text-[#e67a45]">{lunarTitle}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{lunarSubtitle}</p>
            </div>

            {/* Event cards */}
            <div className="flex flex-col gap-2.5 overflow-y-auto min-h-0">
                {items.map((item, i) => (
                    <AgendaEventItem
                        key={item.id ?? i}
                        title={item.title}
                        subtitle={item.subtitle}
                        daysLeft={item.daysLeft}
                        isHoliday={item.isHoliday}
                        onClick={item.onClick}
                    />
                ))}
            </div>
        </div>
    );
};
