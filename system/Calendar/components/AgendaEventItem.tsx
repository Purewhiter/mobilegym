import React from 'react';

export interface AgendaEventItemProps {
    title: string;
    subtitle?: string;
    color?: string;
    isHoliday?: boolean;
    daysLeft?: string;
    onClick?: () => void;
}

export const AgendaEventItem: React.FC<AgendaEventItemProps> = ({
    title,
    subtitle,
    daysLeft,
    onClick,
}) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full text-left flex items-center bg-app-surface dark:bg-[#2c2c2e] px-4 py-3.5 rounded-2xl active:bg-black/5 dark:active:bg-white/5"
        >
            <div className="flex-1 min-w-0">
                <h3 className="text-[17px] font-normal text-black dark:text-white truncate">{title}</h3>
                {subtitle && (
                    <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
                )}
            </div>

            {daysLeft && (
                <div className="flex items-baseline gap-0.5 ml-4 shrink-0">
                    <span className="text-3xl font-light text-black dark:text-white">{daysLeft}</span>
                    <span className="text-sm text-gray-400">天</span>
                </div>
            )}
        </button>
    );
};
