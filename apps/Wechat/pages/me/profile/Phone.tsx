
import React, { useState } from 'react';
import { useWechatStrings } from '../../../hooks/useWechatStrings';
import { useWechatStore } from '../../../state';

export const PhonePage = () => {
    const t = useWechatStrings();
    const user = useWechatStore(s => s.user);
    const [showRealPhone, setShowRealPhone] = useState(false);
    
    // The actual phone number provided by the user
    const realPhone = "17366666695";
    // Masked version: 173 + ****** + 95
    const maskedPhone = "173******95";

    return (
        <div className="min-h-full bg-app-surface flex flex-col items-center pt-16 px-6">
            <div className="text-xl font-bold text-app-text mb-4 flex items-center">
                {t.profile_phone_bound}{showRealPhone ? realPhone : maskedPhone}
                <span 
                    className="text-(--app-c-address-link-text) text-(--app-settings-item-text-size) ml-3 cursor-pointer active:opacity-60 font-normal"
                    onClick={() => setShowRealPhone(!showRealPhone)}
                >
                    {showRealPhone ? t.profile_phone_hide : t.profile_phone_show}
                </span>
            </div>
            <p className="text-(--app-c-tw-text-gray-500) text-(--app-search-filter-text-size) px-6 text-center leading-relaxed">
                {t.profile_phone_hint}
            </p>

            <div className="mt-auto mb-24 w-full flex flex-col items-center space-y-4">
                <button className="w-full max-w-(--app-item-width-240) bg-app-primary text-white py-3 rounded-[8px] font-bold text-(--app-settings-item-text-size) active:opacity-80" style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}>
                    {t.profile_phone_view_contacts}
                </button>
                <button className="w-full max-w-(--app-item-width-240) bg-(--app-c-me-avatar-bg) text-app-text py-3 rounded-[8px] font-bold text-(--app-settings-item-text-size) active:bg-(--app-c-tw-bg-gray-200)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                    {t.profile_phone_change}
                </button>
            </div>
        </div>
    );
};
