import React from 'react';
import { getLunarFullInfo } from '../utils/calendarUtils';
import { AgendaEventItem } from './AgendaEventItem';

interface CalendarDayViewProps {
    date: Date;
    agendaItems?: Array<{
        title: string;
        subtitle?: string;
        isHoliday?: boolean;
        daysLeft?: string;
        onClick?: () => void;
    }>;
}

const WEEKDAY = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({ date, agendaItems = [] }) => {
    const lunar = getLunarFullInfo(date);

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-app-surface dark:bg-black">
            {/* ===== Scenic date card ===== */}
            <div className="mx-4 mt-1 rounded-3xl overflow-hidden relative" style={{ minHeight: '460px' }}>
                {/* Gradient background simulating mountain sunset */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(
                            170deg,
                            #c9a5a8 0%,
                            #d4a87c 18%,
                            #c8956a 30%,
                            #a07858 42%,
                            #6d6070 54%,
                            #4a5568 66%,
                            #3a4a5c 78%,
                            #2d3e50 100%
                        )`,
                    }}
                />
                {/* Bottom dark gradient for water reflection */}
                <div className="absolute bottom-0 left-0 right-0 h-2/5 bg-gradient-to-t from-[#2a3848]/70 to-transparent" />

                {/* Content overlay */}
                <div className="relative z-10 flex flex-col h-full p-6 text-white" style={{ minHeight: '460px' }}>
                    {/* Top row */}
                    <div className="flex justify-between items-start flex-1">
                        <div className="flex flex-col">
                            <span className="text-base opacity-80 tracking-widest">
                                {date.getFullYear()} / {date.getMonth() + 1}
                            </span>
                            <span className="text-[96px] font-extralight leading-none mt-1">
                                {date.getDate()}
                            </span>
                        </div>
                        <div className="flex flex-col items-end text-right mt-8">
                            <span className="text-base opacity-90">{WEEKDAY[date.getDay()]}</span>
                            <span className="text-base opacity-90 mt-0.5">{lunar.title}</span>
                            <span className="text-sm opacity-70 mt-0.5">
                                {lunar.subtitle}
                            </span>
                        </div>
                    </div>

                    {/* Caption at bottom */}
                    <span className="text-sm opacity-60 mt-auto">山湖夕照</span>
                </div>
            </div>

            {/* ===== Agenda items ===== */}
            <div className="px-4 py-4 flex flex-col gap-3">
                {agendaItems.map((item, idx) => (
                    <AgendaEventItem
                        key={idx}
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
