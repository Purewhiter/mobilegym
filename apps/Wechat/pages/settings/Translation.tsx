
import React from 'react';
import { IcLanguages, IcNavForward } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsItem, SettingsToggle } from './Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const TranslationPage: React.FC = () => {
    const t = useWechatStrings();
    const { user, settings, updateSettings } = useWechatStore(useShallow(s => ({
        user: s.user,
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const { bindTap } = useWechatGestures();
    const { general } = settings;

    const update = (key: keyof typeof general, value: any) => {
        updateSettings({
                ...settings,
                general: { ...general, [key]: value }
        });
    };

    return (
        <div className="bg-app-surface min-h-full flex flex-col items-center">
            {/* Top Icon & Title Area */}
            <div className="mt-16 mb-12 flex flex-col items-center">
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute top-0 right-0 w-12 h-12 border-2 border-(--app-c-tw-border-gray-300) rounded-[10px] flex items-center justify-center bg-app-surface z-10">
                        <span className="text-(--app-c-tw-text-gray-400) text-xl font-medium">A</span>
                    </div>
                    <div className="absolute bottom-0 left-0 w-12 h-12 border-2 border-(--app-c-tw-border-gray-300) rounded-[10px] flex items-center justify-center bg-app-surface">
                        <span className="text-(--app-c-tw-text-gray-400) text-xl font-medium">文</span>
                    </div>
                </div>
                <h1 className="text-(--app-title-text-size-24) font-bold text-app-text mt-8">{t.translation_title}</h1>
            </div>

            {/* Content Groups */}
            <div className="w-full px-5">
                {/* Group 1: Language Target */}
                <div className="bg-(--app-c-chat-input-bar-bg) rounded-xl overflow-hidden mb-3">
                    <SettingsItem 
                        label={t.translation_target_label} 
                        rightContent={<span className="text-(--app-c-tw-text-gray-400) text-(--app-settings-item-text-size)">{general.translationLanguage}</span>}
                        isLast
                    />
                </div>
                <div className="px-4 mb-8 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400) leading-relaxed text-center sm:text-left">
                    {t.translation_description}
                </div>

                {/* Group 2: Auto Translation */}
                <div className="bg-(--app-c-chat-input-bar-bg) rounded-xl overflow-hidden mb-3">
                    <SettingsToggle 
                        label={t.translation_auto_label} 
                        isOn={general.autoTranslate} 
                        onToggle={() => update('autoTranslate', !general.autoTranslate)}
                        actionProps={bindTap<HTMLDivElement>(
                          { kind: 'action', id: 'settings.general.translation.autoTranslate.toggle' },
                          { onTrigger: () => update('autoTranslate', !general.autoTranslate) },
                        )}
                        isLast
                    />
                </div>
                <div className="px-4 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400) leading-relaxed text-center sm:text-left">
                    {t.translation_auto_description}
                </div>
            </div>
        </div>
    );
};
