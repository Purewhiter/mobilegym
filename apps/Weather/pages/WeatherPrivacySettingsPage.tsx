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

const WeatherPrivacySettingsPage: React.FC = () => {
    const { bindTap, bindBack } = useWeatherGestures();
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
                <h1 className="ml-2 text-xl font-medium">{s.privacy_title}</h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-8">
                <PreferenceCategory title={s.privacy_title}>
                    <PreferenceItem title={s.privacy_view_policy} />
                    <PreferenceItem title={s.privacy_third_party_data} />
                </PreferenceCategory>

                <PreferenceCategory title={s.privacy_category_permissions}>
                    <PreferenceItem
                        title={s.privacy_permissions_detail}
                        itemProps={bindTap<HTMLDivElement>('permissions.open')}
                    />
                </PreferenceCategory>

                <PreferenceCategory title={s.privacy_category_revoke}>
                    <PreferenceItem title={s.privacy_revoke_consent} />
                </PreferenceCategory>

                <div className="px-4 py-6 text-sm text-gray-400 text-center">
                    {s.privacy_customer_service}
                </div>
            </div>
        </div>
    );
};

export default WeatherPrivacySettingsPage;
