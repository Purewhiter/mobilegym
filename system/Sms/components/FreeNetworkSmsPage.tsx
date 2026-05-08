import React from 'react';
import { IcNavBack } from '../res/icons';
import { FREE_SMS_SETTINGS } from '../constants';
import { SettingsItem, SettingsCategory } from './SettingsItem';
import { isToggle } from '../types';
import { useSmsStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSmsGestures } from '../hooks/useSmsGestures';

export const FreeNetworkSmsPage: React.FC = () => {
    const { bindBack } = useSmsGestures();
    const { settings, updateSettings } = useSmsStore(useShallow(s => ({
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const s = useAppStrings(strings, stringsEn);

    return (
        <div className="h-full bg-app-bg flex flex-col overflow-y-auto no-scrollbar">
            {/* Status bar spacer */}
            <div className="h-12 flex-shrink-0" />

            {/* Header */}
            <div className="flex items-center px-4 h-12 flex-shrink-0">
                <button
                    className="w-10 h-10 -ml-2 flex items-center justify-center"
                    {...bindBack()}
                >
                    <IcNavBack size={24} className="text-app-text" />
                </button>
            </div>

            {/* Title */}
            <div className="px-6 pt-2 pb-4 flex-shrink-0">
                <h1 className="text-[28px] font-bold text-app-text leading-tight">{s.settings_cat_free_sms}</h1>
            </div>

            {/* Description */}
            <div className="px-6 pb-4">
                <p className="text-[16px] text-app-text font-medium leading-relaxed">
                    {s.free_sms_desc}
                </p>
                <p className="text-[14px] text-app-text-muted mt-1">
                    {s.free_sms_stats}
                </p>
            </div>

            {/* Settings */}
            <SettingsCategory>
                {FREE_SMS_SETTINGS.items.map((item, idx) => (
                    <SettingsItem
                        key={item.key}
                        item={item}
                        value={isToggle(item) ? Boolean(settings[item.key]) : undefined}
                        onValueChange={isToggle(item) ? (v) => updateSettings({ [item.key]: v }) : undefined}
                        showDivider={idx < FREE_SMS_SETTINGS.items.length - 1}
                    />
                ))}
            </SettingsCategory>

            {/* Bottom padding */}
            <div className="h-8 flex-shrink-0" />
        </div>
    );
};
