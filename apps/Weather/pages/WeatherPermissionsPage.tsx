import React from 'react';
import { IcNavBack } from '../res/icons';
import { PreferenceCategory } from '../../../system/Settings/components/PreferenceCategory';
import { PreferenceItem } from '../../../system/Settings/components/PreferenceItem';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
const lightThemeOverrides: React.CSSProperties = {
    '--app-surface': '#ffffff',
    '--app-text': '#1c1c1e',
    '--app-text-muted': '#8e8e93',
    '--app-primary': '#34c759',
    '--app-border': '#e5e7eb',
} as React.CSSProperties;

const WeatherPermissionsPage: React.FC = () => {
    const { bindBack } = useWeatherGestures();
    const s = useAppStrings(strings, stringsEn);

    return (
        <div
            className="flex flex-col h-full bg-[#f4f4f4] dark:bg-black text-black dark:text-white pt-10"
            data-status-bar-foreground="dark"
            style={lightThemeOverrides}
        >
            {/* Header */}
            <div className="flex items-center px-4 py-3 bg-white dark:bg-[#1c1c1e] border-b border-gray-200 dark:border-white/10">
                <button
                    {...bindBack<HTMLButtonElement>()}
                    className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                >
                    <IcNavBack size={24} />
                </button>
                <h1 className="ml-2 text-xl font-medium">{s.permissions_title}</h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-8">
                <PreferenceCategory>
                    <PreferenceItem
                        title={s.permissions_location}
                        summary={s.permissions_location_summary}
                    />
                    <PreferenceItem
                        title={s.permissions_notification}
                        summary={s.permissions_notification_summary}
                    />
                </PreferenceCategory>
            </div>
        </div>
    );
};

export default WeatherPermissionsPage;
