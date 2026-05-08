
import React from 'react';
import { IcNavBack, IcCheck } from '../../res/icons';
import { dimens } from '../../res/dimens';
import { useWechatReadingStore } from '../../state';
import { useWechatReadingGestures } from '../../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../../hooks/useWechatReadingStrings';

const DarkModePage: React.FC = () => {
    const { bindBack, bindTap } = useWechatReadingGestures();
    const settings = useWechatReadingStore(s => s.settings);
    const updateSettings = useWechatReadingStore(s => s.updateSettings);
    const s = useWechatReadingStrings();

    const isSystem = settings.darkMode === '跟随系统';

    const handleSystemToggle = () => {
        if (isSystem) {
            updateSettings({ darkMode: '浅色' }); // Default to light when turning off
        } else {
            updateSettings({ darkMode: '跟随系统' });
        }
    };

    return (
        <div className="flex flex-col h-full bg-(--app-c-tw-bg-slate-100)">
            {/* Header */}
            <div className="flex items-center px-4 pt-10 pb-3 bg-app-surface sticky top-0 z-10">
                <div className="w-10 flex justify-start" {...bindBack()}>
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </div>
                <div className="flex-1 text-center font-bold text-(--app-modal-action-text-size) text-(--app-c-tw-text-slate-800)">{s.dark_mode_title}</div>
                <div className="w-10" />
            </div>

            <div className="p-4 flex flex-col gap-3">
                {/* System Toggle */}
                <div className="bg-app-surface rounded-xl p-4 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                        <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800) font-bold">{s.dark_mode_follow_system}</span>
                        <span className="text-xs text-(--app-c-tw-text-slate-400)">{s.dark_mode_follow_system_desc}</span>
                    </div>
                    <div
                        className={`w-11 h-6 rounded-full relative cursor-pointer ${isSystem ? 'bg-(--app-c-tw-bg-blue-500)' : 'bg-(--app-c-tw-bg-slate-200)'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                        {...bindTap<HTMLDivElement>(
                            { kind: 'action', id: 'settings.darkMode.followSystem.toggle' },
                            { onTrigger: handleSystemToggle },
                        )}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-app-surface rounded-full shadow ${isSystem ? 'translate-x-5' : 'translate-x-0'}`} style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }} />
                    </div>
                </div>

                {/* Manual Options */}
                {!isSystem && (
                    <>
                        <div className="text-xs text-(--app-c-tw-text-slate-400) px-1 mt-1">{s.dark_mode_manual_select}</div>
                        <div className="bg-app-surface rounded-xl overflow-hidden">
                            <div
                                className="flex justify-between items-center px-5 py-4 border-b border-(--app-c-tw-border-gray-50) active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                                {...bindTap<HTMLDivElement>(
                                    { kind: 'action', id: 'settings.darkMode.select.light' },
                                    { onTrigger: () => updateSettings({ darkMode: '浅色' }) },
                                )}
                            >
                                <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{s.dark_mode_light}</span>
                                {settings.darkMode === '浅色' && <IcCheck size={dimens.icSizeAction} className="text-(--app-c-tw-text-blue-500)" />}
                            </div>
                            <div
                                className="flex justify-between items-center px-5 py-4 last:border-0 active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                                {...bindTap<HTMLDivElement>(
                                    { kind: 'action', id: 'settings.darkMode.select.dark' },
                                    { onTrigger: () => updateSettings({ darkMode: '深色' }) },
                                )}
                            >
                                <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{s.dark_mode_dark}</span>
                                {settings.darkMode === '深色' && <IcCheck size={dimens.icSizeAction} className="text-(--app-c-tw-text-blue-500)" />}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DarkModePage;
