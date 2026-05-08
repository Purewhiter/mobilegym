import React from 'react';
import { IcNavBack } from '../res/icons';
import { ADVANCED_SETTINGS } from '../constants';
import { SettingsItem, SettingsCategory } from './SettingsItem';
import { isToggle } from '../types';
import { useSmsStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSmsGestures } from '../hooks/useSmsGestures';

export const AdvancedSettingsPage: React.FC = () => {
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
                <h1 className="text-[28px] font-bold text-app-text leading-tight">{s.advanced_settings_title}</h1>
            </div>

            {/* Settings categories */}
            {ADVANCED_SETTINGS.map((category, catIdx) => (
                <SettingsCategory key={catIdx} title={category.title}>
                    {category.items.map((item, itemIdx) => (
                        <SettingsItem
                            key={item.key}
                            item={item}
                            value={isToggle(item) ? Boolean(settings[item.key]) : undefined}
                            onValueChange={isToggle(item) ? (v) => updateSettings({ [item.key]: v }) : undefined}
                            showDivider={itemIdx < category.items.length - 1}
                        />
                    ))}
                </SettingsCategory>
            ))}

            {/* Bottom padding */}
            <div className="h-8 flex-shrink-0" />
        </div>
    );
};
