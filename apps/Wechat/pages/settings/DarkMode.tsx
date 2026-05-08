import React, { useState, useEffect, useRef } from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcCheck } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsToggle } from './Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';
export const DarkModePage: React.FC = () => {
  const t = useWechatStrings();
    const { user, settings, updateSettings, setRightAction } = useWechatStore(useShallow(s => ({
        user: s.user,
        settings: s.settings,
        updateSettings: s.updateSettings,
        setRightAction: s.setRightAction,
    })));
    const { back, bindTap } = useWechatGestures();
    const { general } = settings;
    
    // Local state for the form
    const [followSystem, setFollowSystem] = useState(general.followSystem);
    const [isDarkMode, setIsDarkMode] = useState(general.darkMode);

    // Update refs for the save callback
    const stateRef = useRef({ followSystem, isDarkMode });
    useEffect(() => {
        stateRef.current = { followSystem, isDarkMode };
    }, [followSystem, isDarkMode]);

    useEffect(() => {
        // Register save action
        setRightAction({
            id: 'settings.general.darkMode.submit',
            onTrigger: () => {
            updateSettings({
                    ...settings,
                    general: {
                        ...general,
                        followSystem: stateRef.current.followSystem,
                        darkMode: stateRef.current.isDarkMode
                    }
            });
            back();
            },
        });
        return () => setRightAction(null);
    }, [updateSettings, setRightAction, general, settings, back]);

    return (
        <div className="bg-app-bg min-h-full">
            <div className="h-0.5 bg-app-bg"></div>
            
            {/* Group 1: Follow System Toggle */}
            <div className="bg-app-surface">
                <SettingsToggle 
                    label={t.settings_follow_system} 
                    subLabel="开启后，将跟随系统打开或关闭深色模式"
                    isOn={followSystem}
                    onToggle={() => setFollowSystem(!followSystem)}
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.darkMode.followSystem.toggle' },
                      { onTrigger: () => setFollowSystem(!followSystem) },
                    )}
                    isLast
                />
            </div>

            {/* Group 2: Manual Selection (Conditional) */}
            {!followSystem && (
                <>
                    <div className="px-5 py-2.5 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) font-normal">手动选择</div>
                    <div className="bg-app-surface">
                        <div 
                            {...bindTap<HTMLDivElement>(
                              { kind: 'action', id: 'settings.general.darkMode.mode.select.light' },
                              { onTrigger: () => setIsDarkMode(false) },
                            )}
                            className="flex justify-between items-center px-5 h-(--app-settings-item-height) bg-app-surface active:bg-(--app-c-tw-bg-gray-50) cursor-pointer border-b border-(--app-c-tw-border-gray-100)"
                        >
                            <span className="text-(--app-settings-item-text-size) text-(--app-c-settings-item-text) font-normal">普通模式</span>
                            {!isDarkMode && <IcCheck size={dimens.icSizeCheck} className="text-app-primary" strokeWidth={2.5} />}
                        </div>
                        <div 
                            {...bindTap<HTMLDivElement>(
                              { kind: 'action', id: 'settings.general.darkMode.mode.select.dark' },
                              { onTrigger: () => setIsDarkMode(true) },
                            )}
                            className="flex justify-between items-center px-5 h-(--app-settings-item-height) bg-app-surface active:bg-(--app-c-tw-bg-gray-100) cursor-pointer"
                        >
                            <span className="text-(--app-settings-item-text-size) text-(--app-c-settings-item-text) font-normal">{t.settings_dark_mode}</span>
                            {isDarkMode && <IcCheck size={dimens.icSizeCheck} className="text-app-primary" strokeWidth={2.5} />}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};