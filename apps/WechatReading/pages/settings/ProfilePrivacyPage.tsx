
import React from 'react';
import { IcNavBack, IcNavForward } from '../../res/icons';
import { dimens } from '../../res/dimens';
import { useWechatReadingStore } from '../../state';
import type { PrivacyProfileSettings } from '../../data/types';
import { useWechatReadingGestures } from '../../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../../hooks/useWechatReadingStrings';

const ProfilePrivacyPage: React.FC = () => {
    const { bindBack, bindTap } = useWechatReadingGestures();
    const profile = useWechatReadingStore(s => s.settings.privacy.profile);
    const updateProfilePrivacy = useWechatReadingStore(s => s.updateProfilePrivacy);
    const s = useWechatReadingStrings();

    const toggleSetting = (key: keyof PrivacyProfileSettings) => {
        updateProfilePrivacy({ [key]: !profile[key] });
    };

    const ToggleItem = ({
        label,
        settingKey,
        binding,
    }: {
        label: string,
        settingKey: keyof PrivacyProfileSettings,
        binding: React.HTMLAttributes<HTMLDivElement> & { 'data-action': string; 'data-action-type': string },
    }) => (
        <div
            className="flex justify-between items-center py-4 border-b border-(--app-c-tw-border-slate-100) last:border-0 cursor-pointer"
            {...binding}
        >
            <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{label}</span>
            <div className={`w-11 h-6 rounded-full relative ${profile[settingKey] ? 'bg-(--app-c-tw-bg-blue-500)' : 'bg-(--app-c-tw-bg-slate-200)'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-app-surface rounded-full shadow ${profile[settingKey] ? 'translate-x-5' : 'translate-x-0'}`} style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }} />
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
            <div
                className="flex justify-between items-center py-4 border-b border-(--app-c-tw-border-slate-100) last:border-0 active:opacity-60 cursor-pointer"
                {...interactiveProps}
            >
                <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{label}</span>
                <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-tw-text-slate-300)" />
            </div>
        );
    };

    const Group = ({ title, children }: { title?: string, children: React.ReactNode }) => (
        <div className="mb-3">
            {title && <div className="px-4 py-2 text-xs text-(--app-c-tw-text-slate-400)">{title}</div>}
            <div className="bg-app-surface rounded-xl px-4">
                {children}
            </div>
        </div>
    );

    const VisibilityRow = ({
        label,
        value,
        binding,
    }: {
        label: string;
        value: '仅自己可见' | '互关可见' | '关注我的人可见' | '所有人可见';
        binding: React.HTMLAttributes<HTMLDivElement> & { 'data-action': string; 'data-action-type': string };
    }) => {
        const isSelected = profile.visibility === value;
        return (
            <div
                className="flex justify-between items-center py-4 border-b border-(--app-c-tw-border-slate-100) last:border-0 cursor-pointer"
                {...binding}
            >
                <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{label}</span>
                {isSelected && <div className="text-(--app-c-tw-text-blue-500) font-bold text-sm">✓</div>}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-(--app-c-tw-bg-slate-100)">
            {/* Header */}
            <div className="flex items-center px-4 pt-10 pb-3 bg-app-surface sticky top-0 z-10">
                <div className="w-10 flex justify-start" {...bindBack()}>
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </div>
                <div className="flex-1 text-center font-bold text-(--app-modal-action-text-size) text-(--app-c-tw-text-slate-800)">{s.profile_privacy_title}</div>
                <div className="w-10" />
            </div>

            <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar p-3">
                <Group>
                    <LinkItem label={s.profile_privacy_edit_profile} binding={bindTap<HTMLDivElement>('profile.edit.open')} />
                </Group>

                <Group title={s.profile_privacy_display_modules}>
                    <ToggleItem
                        label={s.profile_privacy_shelf}
                        settingKey="showShelf"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.profilePrivacy.showShelf.toggle' }, { onTrigger: () => toggleSetting('showShelf') })}
                    />
                    <ToggleItem
                        label={s.profile_privacy_liked_books}
                        settingKey="showLiked"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.profilePrivacy.showLiked.toggle' }, { onTrigger: () => toggleSetting('showLiked') })}
                    />
                    <ToggleItem
                        label={s.profile_privacy_book_lists}
                        settingKey="showLists"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.profilePrivacy.showLists.toggle' }, { onTrigger: () => toggleSetting('showLists') })}
                    />
                    <ToggleItem
                        label={s.profile_privacy_badges}
                        settingKey="showBadge"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.profilePrivacy.showBadge.toggle' }, { onTrigger: () => toggleSetting('showBadge') })}
                    />
                    <ToggleItem
                        label={s.profile_privacy_thoughts}
                        settingKey="showThought"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.profilePrivacy.showThought.toggle' }, { onTrigger: () => toggleSetting('showThought') })}
                    />
                </Group>

                <Group title={s.profile_privacy_visibility}>
                    <VisibilityRow
                        label={s.profile_privacy_self_only}
                        value="仅自己可见"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.profilePrivacy.visibility.select.self' }, { onTrigger: () => updateProfilePrivacy({ visibility: '仅自己可见' }) })}
                    />
                    <VisibilityRow
                        label={s.profile_privacy_mutual_only}
                        value="互关可见"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.profilePrivacy.visibility.select.mutual' }, { onTrigger: () => updateProfilePrivacy({ visibility: '互关可见' }) })}
                    />
                    <VisibilityRow
                        label={s.profile_privacy_followers_only}
                        value="关注我的人可见"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.profilePrivacy.visibility.select.follower' }, { onTrigger: () => updateProfilePrivacy({ visibility: '关注我的人可见' }) })}
                    />
                    <VisibilityRow
                        label={s.profile_privacy_everyone}
                        value="所有人可见"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.profilePrivacy.visibility.select.all' }, { onTrigger: () => updateProfilePrivacy({ visibility: '所有人可见' }) })}
                    />
                </Group>

                <div className="h-10" />
            </div>
        </div>
    );
};

export default ProfilePrivacyPage;
