
import React from 'react';
import { dimens } from '../../res/dimens';
import { IcCheck } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
export const NotificationDisplayPage: React.FC = () => {
    const { user, settings, updateSettings } = useWechatStore(useShallow(s => ({
        user: s.user,
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const { notifications } = settings;
    const currentMode = notifications.displayMode || 'full';

    const setMode = (mode: 'count' | 'name' | 'full') => {
        updateSettings({
                ...settings,
                notifications: {
                    ...notifications,
                    displayMode: mode
                }
        });
    };

    const Option = ({ mode, label, isLast = false }: { mode: 'count' | 'name' | 'full', label: string, isLast?: boolean }) => (
        <div 
            onClick={() => setMode(mode)}
            className="bg-app-surface pl-5 active:bg-(--app-c-tw-bg-gray-100) cursor-pointer"
        >
            <div className={`flex justify-between items-center py-4 pr-5 ${!isLast ? 'border-b border-(--app-c-tw-border-gray-100)' : ''}`}>
                <span className="text-(--app-settings-item-text-size) text-(--app-c-settings-item-text) font-normal">{label}</span>
                {currentMode === mode && <IcCheck size={dimens.icSizeCheck} className="text-app-primary" strokeWidth={2.5} />}
            </div>
        </div>
    );

    return (
        <div className="bg-app-bg min-h-full">
            <div className="h-0.5 bg-app-bg"></div>
            <div className="bg-app-surface">
                <Option mode="count" label="仅显示「你收到了 1 条消息」" />
                <Option mode="name" label="显示朋友名称、群聊名" />
                <Option mode="full" label="显示朋友名称、群聊名及消息内容" isLast />
            </div>
        </div>
    );
};
