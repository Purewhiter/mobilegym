
import React from 'react';
import { IcNavBack, IcNavForward } from '../../res/icons';
import { dimens } from '../../res/dimens';
import { useWechatReadingStore } from '../../state';
import type { PrivacySettings } from '../../data/types';
import { useWechatReadingGestures } from '../../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../../hooks/useWechatReadingStrings';

const PrivacyPage: React.FC = () => {
    const { bindBack, bindTap } = useWechatReadingGestures();
    const privacy = useWechatReadingStore(s => s.settings.privacy);
    const updatePrivacy = useWechatReadingStore(s => s.updatePrivacy);
    const s = useWechatReadingStrings();

    const toggleSetting = (key: keyof Omit<PrivacySettings, 'profile'>) => {
        updatePrivacy({ [key]: !privacy[key] });
    };

    const ToggleItem = ({
        label,
        desc,
        settingKey,
        binding,
    }: {
        label: string,
        desc?: string,
        settingKey: keyof Omit<PrivacySettings, 'profile'>,
        binding: React.HTMLAttributes<HTMLDivElement> & { 'data-action': string, 'data-action-type': string },
    }) => (
        <div
            className="flex justify-between items-center py-4 border-b border-(--app-c-tw-border-slate-100) last:border-0 cursor-pointer"
            {...binding}
        >
            <div className="flex flex-col gap-1 flex-1 pr-4">
                <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{label}</span>
                {desc && <span className="text-xs text-(--app-c-tw-text-slate-400)">{desc}</span>}
            </div>
            <div className={`w-11 h-6 rounded-full relative flex-shrink-0 ${privacy[settingKey] ? 'bg-(--app-c-tw-bg-blue-500)' : 'bg-(--app-c-tw-bg-slate-200)'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-app-surface rounded-full shadow ${privacy[settingKey] ? 'translate-x-5' : 'translate-x-0'}`} style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }} />
            </div>
        </div>
    );

    const LinkItem = ({
        label,
        onClick,
        binding,
    }: {
        label: string,
        onClick?: () => void,
        binding?: React.HTMLAttributes<HTMLDivElement> & { 'data-trigger': string, 'data-trigger-type': string },
    }) => {
        const interactiveProps = binding ?? (onClick ? { onClick } : {});
        return (
            <div className="flex justify-between items-center py-4 border-b border-(--app-c-tw-border-slate-100) last:border-0 active:opacity-60 cursor-pointer" {...interactiveProps}>
                <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{label}</span>
                <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-tw-text-slate-300)" />
            </div>
        );
    };

    const Group = ({ children }: { children: React.ReactNode }) => (
        <div className="bg-app-surface rounded-xl px-4 mb-3">
            {children}
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-(--app-c-tw-bg-slate-100)">
            {/* Header */}
            <div className="flex items-center px-4 pt-10 pb-3 bg-app-surface sticky top-0 z-10">
                <div className="w-10 flex justify-start" {...bindBack()}>
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </div>
                <div className="flex-1 text-center font-bold text-(--app-modal-action-text-size) text-(--app-c-tw-text-slate-800)">{s.privacy_title}</div>
                <div className="w-10" />
            </div>

            <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar p-3">

                <Group>
                    <LinkItem label={s.privacy_personal_page} binding={bindTap<HTMLDivElement>('settings.privacy.profile.open')} />
                    <ToggleItem
                        label={s.privacy_require_follow_request}
                        desc={s.privacy_require_follow_request_desc}
                        settingKey="requireFollowRequest"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.privacy.requireFollowRequest.toggle' }, { onTrigger: () => toggleSetting('requireFollowRequest') })}
                    />
                    <ToggleItem
                        label={s.privacy_hide_vip_global}
                        desc={s.privacy_hide_vip_global_desc}
                        settingKey="hideVipGlobal"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.privacy.hideVipGlobal.toggle' }, { onTrigger: () => toggleSetting('hideVipGlobal') })}
                    />
                </Group>

                <Group>
                    <ToggleItem
                        label={s.privacy_auto_private_reading}
                        desc={s.privacy_auto_private_reading_desc}
                        settingKey="autoPrivateReading"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.privacy.autoPrivateReading.toggle' }, { onTrigger: () => toggleSetting('autoPrivateReading') })}
                    />
                    <ToggleItem
                        label={s.privacy_shelf_replacement}
                        desc={s.privacy_shelf_replacement_desc}
                        settingKey="shelfReplacement"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.privacy.shelfReplacement.toggle' }, { onTrigger: () => toggleSetting('shelfReplacement') })}
                    />
                </Group>

                <Group>
                    <ToggleItem
                        label={s.privacy_reject_stranger_msg}
                        settingKey="rejectStrangerMsg"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.privacy.rejectStrangerMsg.toggle' }, { onTrigger: () => toggleSetting('rejectStrangerMsg') })}
                    />
                    <LinkItem label={s.privacy_blacklist} />
                </Group>

                <Group>
                    <LinkItem label={s.privacy_wechat_articles} />
                </Group>

                <Group>
                    <LinkItem label={s.privacy_account} />
                </Group>

                <Group>
                    <ToggleItem
                        label={s.privacy_close_personalized_rec}
                        settingKey="closePersonalizedRec"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.privacy.closePersonalizedRec.toggle' }, { onTrigger: () => toggleSetting('closePersonalizedRec') })}
                    />
                    <ToggleItem
                        label={s.privacy_close_reading_rank}
                        settingKey="closeReadingRank"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.privacy.closeReadingRank.toggle' }, { onTrigger: () => toggleSetting('closeReadingRank') })}
                    />
                </Group>

                <Group>
                    <LinkItem label={s.privacy_get_account_copy} />
                    <LinkItem label={s.privacy_basic_policy} />
                    <LinkItem label={s.privacy_full_policy} />
                    <LinkItem label={s.privacy_personal_info_list} />
                    <LinkItem label={s.privacy_third_party_list} />
                </Group>

                <div className="h-10" />
            </div>
        </div>
    );
};

export default PrivacyPage;
