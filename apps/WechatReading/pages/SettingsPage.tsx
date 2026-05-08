
import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingStore } from '../state';
import type { Settings } from '../data/types';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import {
    localizeWechatReadingDarkModeValue,
    localizeWechatReadingPageTurnStyle,
} from '../utils/localization';

type TopLevelSettingKey = Exclude<keyof Settings, 'privacy' | 'notifications'>;

const SettingsPage: React.FC = () => {
    const { bindBack, bindTap } = useWechatReadingGestures();
    const settings = useWechatReadingStore(s => s.settings);
    const updateSettings = useWechatReadingStore(s => s.updateSettings);
    const s = useWechatReadingStrings();

    const toggleSetting = (key: TopLevelSettingKey) => {
        const val = settings[key];
        if (typeof val === 'boolean') {
            updateSettings({ [key]: !val });
        }
    };

    const ToggleItem = ({
        label,
        settingKey,
        binding,
    }: {
        label: string,
        settingKey: TopLevelSettingKey,
        binding: React.HTMLAttributes<HTMLDivElement> & { 'data-action': string; 'data-action-type': string },
    }) => (
        <div
            className="flex justify-between items-center py-4 border-b border-(--app-c-tw-border-slate-100) last:border-0 cursor-pointer"
            {...binding}
        >
            <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{label}</span>
            <div className={`w-11 h-6 rounded-full relative ${settings[settingKey] ? 'bg-(--app-c-tw-bg-blue-500)' : 'bg-(--app-c-tw-bg-slate-200)'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-app-surface rounded-full shadow ${settings[settingKey] ? 'translate-x-5' : 'translate-x-0'}`} style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }} />
            </div>
        </div>
    );

    const LinkItem = ({
        label,
        value,
        onClick,
        binding,
    }: {
        label: string,
        value?: string,
        onClick?: () => void,
        binding?: React.HTMLAttributes<HTMLDivElement> & { 'data-trigger': string; 'data-trigger-type': string };
    }) => {
        const interactiveProps = binding ?? (onClick ? { onClick } : {});
        return (
            <div
                className="flex justify-between items-center py-4 border-b border-(--app-c-tw-border-slate-100) last:border-0 active:opacity-60 cursor-pointer"
                {...interactiveProps}
            >
            <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{label}</span>
            <div className="flex items-center gap-1">
                {value && <span className="text-(--app-settings-item-value-size) text-(--app-c-tw-text-slate-400)">{value}</span>}
                <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-tw-text-slate-300)" />
            </div>
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
                <div className="flex-1 text-center font-bold text-(--app-modal-action-text-size) text-(--app-c-tw-text-slate-800)">{s.settings_title}</div>
                <div className="w-10" />
            </div>

            {/* Content */}
            <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar p-3">

                <Group>
                    <ToggleItem
                        label={s.settings_no_auto_lock}
                        settingKey="autoLock"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.reader.autoLock.toggle' }, { onTrigger: () => toggleSetting('autoLock') })}
                    />
                    <ToggleItem
                        label={s.settings_allow_landscape}
                        settingKey="allowLandscape"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.reader.allowLandscape.toggle' }, { onTrigger: () => toggleSetting('allowLandscape') })}
                    />
                    <ToggleItem
                        label={s.settings_hide_thoughts}
                        settingKey="hideThought"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.reader.hideThought.toggle' }, { onTrigger: () => toggleSetting('hideThought') })}
                    />
                    <ToggleItem
                        label={s.settings_show_time_battery}
                        settingKey="showTimeBattery"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.reader.showTimeBattery.toggle' }, { onTrigger: () => toggleSetting('showTimeBattery') })}
                    />
                    <ToggleItem
                        label={s.settings_volume_key_turn}
                        settingKey="volumeKeyTurn"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.reader.volumeKeyTurn.toggle' }, { onTrigger: () => toggleSetting('volumeKeyTurn') })}
                    />
                    <ToggleItem
                        label={s.settings_first_line_indent}
                        settingKey="firstLineIndent"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.reader.firstLineIndent.toggle' }, { onTrigger: () => toggleSetting('firstLineIndent') })}
                    />
                    <ToggleItem
                        label={s.settings_click_left_next}
                        settingKey="clickLeftNext"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.reader.clickLeftNext.toggle' }, { onTrigger: () => toggleSetting('clickLeftNext') })}
                    />
                    <ToggleItem
                        label={s.settings_block_web_novels}
                        settingKey="blockWebNovels"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.reader.blockWebNovels.toggle' }, { onTrigger: () => toggleSetting('blockWebNovels') })}
                    />
                    <ToggleItem
                        label={s.settings_mix_audio}
                        settingKey="mixAudio"
                        binding={bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.reader.mixAudio.toggle' }, { onTrigger: () => toggleSetting('mixAudio') })}
                    />

                    <LinkItem label={s.settings_auto_download} binding={bindTap<HTMLDivElement>('settings.autoDownload.open')} />
                    <LinkItem
                        label={s.settings_page_turn_style}
                        value={localizeWechatReadingPageTurnStyle(settings.pageTurnStyle, s)}
                        binding={bindTap<HTMLDivElement>('settings.pageTurn.open')}
                    />
                    <LinkItem
                        label={s.settings_dark_mode}
                        value={localizeWechatReadingDarkModeValue(settings.darkMode, s)}
                        binding={bindTap<HTMLDivElement>('settings.darkMode.open')}
                    />
                </Group>

                <Group>
                    <LinkItem label={s.settings_privacy} binding={bindTap<HTMLDivElement>('settings.privacy.open')} />
                    <LinkItem label={s.settings_student_auth} value={s.settings_student_auth_desc} />
                    <LinkItem label={s.settings_teen_mode} value={s.settings_teen_mode_status} />
                    <LinkItem label={s.settings_notifications} binding={bindTap<HTMLDivElement>('settings.notifications.open')} />
                    <LinkItem label={s.settings_login_devices} />
                    <LinkItem label={s.settings_clear_cache} />
                </Group>

                <Group>
                    <LinkItem label={s.settings_publish_on_weread} value={s.settings_publish_desc} />
                    <LinkItem label={s.settings_business_cooperation} />
                </Group>

                <Group>
                    <LinkItem label={s.settings_about_weread} />
                    <LinkItem label={s.settings_follow_wechat_account} />
                    <LinkItem label={s.settings_help_feedback} />
                </Group>

                <div className="bg-app-surface rounded-xl py-4 mb-8 flex justify-center items-center active:opacity-60 cursor-pointer">
                    <span className="text-(--app-settings-item-text-size) font-bold text-red-500">{s.settings_logout}</span>
                </div>

                <div className="h-10" />
            </div>
        </div>
    );
};

export default SettingsPage;
