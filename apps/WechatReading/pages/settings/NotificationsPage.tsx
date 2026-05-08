
import React from 'react';
import { IcNavBack } from '../../res/icons';
import { dimens } from '../../res/dimens';
import { useWechatReadingStore } from '../../state';
import type { NotificationSettings } from '../../data/types';
import { useWechatReadingGestures } from '../../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../../hooks/useWechatReadingStrings';

const NotificationsPage: React.FC = () => {
    const { bindBack, bindTap } = useWechatReadingGestures();
    const notifications = useWechatReadingStore(s => s.settings.notifications);
    const updateNotifications = useWechatReadingStore(s => s.updateNotifications);
    const s = useWechatReadingStrings();

    const toggleSetting = (key: keyof NotificationSettings) => {
        updateNotifications({ [key]: !notifications[key] });
    };

    const ToggleItem = ({
        label,
        description,
        settingKey,
        binding,
    }: {
        label: string,
        description: string,
        settingKey: keyof NotificationSettings,
        binding: React.HTMLAttributes<HTMLDivElement> & { 'data-action': string; 'data-action-type': string },
    }) => (
        <div
            className="flex justify-between items-start py-4 border-b border-(--app-c-tw-border-slate-100) last:border-0 cursor-pointer"
            {...binding}
        >
            <div className="flex-1 mr-4">
                <div className="text-(--app-modal-action-text-size) text-(--app-c-tw-text-slate-900) mb-1">{label}</div>
                <div className="text-(--app-settings-item-value-size) text-(--app-c-tw-text-slate-400) leading-relaxed">{description}</div>
            </div>
            <div className={`w-11 h-6 rounded-full relative shrink-0 mt-1 ${notifications[settingKey] ? 'bg-(--app-c-tw-bg-blue-500)' : 'bg-(--app-c-tw-bg-slate-200)'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-app-surface rounded-full shadow ${notifications[settingKey] ? 'translate-x-5' : 'translate-x-0'}`} style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }} />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-app-bg">
            {/* Header */}
            <div className="flex items-center px-4 pt-10 pb-3 bg-app-bg sticky top-0 z-10">
                <div className="w-10 flex justify-start" {...bindBack()}>
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </div>
                <div className="flex-1 text-center font-medium text-(--app-modal-action-text-size) text-(--app-c-tw-text-slate-800)">{s.notifications_title}</div>
                <div className="w-10" />
            </div>

            <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar px-4 py-2">
                <div className="bg-app-surface rounded-xl px-5">
                    <ToggleItem
                        label={s.notifications_new_follower}
                        description={s.notifications_new_follower_desc}
                        settingKey="newFollower"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.notifyNewFollower.toggle' }, { onTrigger: () => toggleSetting('newFollower') })}
                    />
                    <ToggleItem
                        label={s.notifications_wechat_friend}
                        description={s.notifications_wechat_friend_desc}
                        settingKey="newWechatFriend"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.notifyNewWechatFriend.toggle' }, { onTrigger: () => toggleSetting('newWechatFriend') })}
                    />
                    <ToggleItem
                        label={s.notifications_activity_welfare}
                        description={s.notifications_activity_welfare_desc}
                        settingKey="activityWelfare"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.notifyActivityWelfare.toggle' }, { onTrigger: () => toggleSetting('activityWelfare') })}
                    />
                </div>
            </div>
        </div>
    );
};

export default NotificationsPage;
