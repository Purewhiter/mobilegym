
import React from 'react';
import { dimens } from '../../res/dimens';
import { IcPlay } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const IncomingRingtonePage: React.FC = () => {
    const t = useWechatStrings();
    const notifications = useWechatStore(s => s.settings.notifications);
    const currentRingtone = notifications.incomingRingtone || '微信';

    return (
        <div className="bg-app-bg min-h-full flex flex-col px-5 pt-8">
            {/* Main Ringtone Card */}
            <div className="bg-app-surface rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8 flex flex-col items-center">
                {/* Play Icon Area */}
                <div className="w-(--app-item-width-100) h-(--app-item-height-100) bg-(--app-c-chat-bubble-me-bg) rounded-[24px] flex items-center justify-center mb-10 mt-2 relative cursor-pointer active:opacity-90">
                    <div className="w-(--app-item-width-36) h-(--app-item-height-36) bg-app-surface rounded-full flex items-center justify-center pl-1">
                        <IcPlay size={dimens.icSizeAction} fill="#95ec69" className="text-(--app-c-chat-bubble-me-bg)" />
                    </div>
                    {/* Inner note decoration */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-(--app-contacts-user-profile-width-50) h-(--app-settings-incoming-ringtone-height-50) border border-white/30 rounded-full"></div>
                </div>

                {/* Ringtone Name */}
                <div className="text-(--app-settings-item-text-size) text-(--app-c-settings-item-extra-text) font-normal mb-10">
                    {currentRingtone}
                </div>

                {/* Change Button */}
                <button className="w-full bg-(--app-c-me-avatar-bg) text-app-text font-bold py-3.5 rounded-xl text-(--app-settings-item-text-size) active:bg-(--app-c-tw-bg-gray-200)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                    {t.notification_change}
                </button>
            </div>

            {/* Bottom Exclusive Link */}
            <div className="mt-8 text-center">
                <span className="text-(--app-c-address-link-text) text-(--app-chat-bubble-text-size) font-medium cursor-pointer active:opacity-60">
                    {t.notification_custom_friend_ringtone}
                </span>
            </div>
        </div>
    );
};
