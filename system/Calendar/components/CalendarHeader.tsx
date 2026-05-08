import React from 'react';
import { IcAdd, IcMoreVert } from '../res/icons';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
interface CalendarHeaderProps {
    title: string;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({ title }) => {
    const { bindTap } = useCalendarGestures();

    return (
        <div className="flex flex-col bg-app-surface dark:bg-black pt-12">
            <div className="flex items-center justify-between px-6 py-2">
                <div className="flex flex-row items-center gap-1">
                    <h1 className="text-4xl font-normal text-black dark:text-white">
                        {title}
                    </h1>
                </div>

                <div className="flex items-center gap-5 text-black dark:text-white">
                    <button
                        {...bindTap('new-event.open')}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
                    >
                        <IcAdd size={32} strokeWidth={1.5} />
                    </button>
                    <button
                        {...bindTap('settings.open')}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
                    >
                        <IcMoreVert size={28} strokeWidth={1.5} />
                    </button>
                </div>
            </div>
            
            {/* Week Header - Moved here to be sticky/fixed with header if needed, but keeping in Grid is fine too if Grid is the scroll container. 
                However, usually the week header is fixed. 
                For now, I'll assume Grid handles it or I should move it here. 
                Let's move it here to match typical calendar apps where week days stay visible.
            */}
             <div className="grid grid-cols-7 px-2 mt-4 mb-2">
                {['一', '二', '三', '四', '五', '六', '日'].map(header => (
                    <div key={header} className="text-center text-sm font-medium text-gray-800 dark:text-gray-400 py-1">
                        {header}
                    </div>
                ))}
            </div>
        </div>
    );
};
