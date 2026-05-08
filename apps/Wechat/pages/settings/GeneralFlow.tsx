
import React from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsItem, SettingsToggle } from './Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';

// --- General Settings (通用) ---
export const General: React.FC = () => {
  const t = useWechatStrings();
    const { bindTap } = useWechatGestures();
    const { user, settings, updateSettings } = useWechatStore(useShallow(s => ({
        user: s.user,
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const { general } = settings;

    const update = (key: keyof typeof general, value: any) => {
        updateSettings({
                ...settings,
                general: { ...general, [key]: value }
        });
    };

    const SectionHeader = ({ title }: { title: string }) => (
        <div className="px-5 py-2.5 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) font-normal">{title}</div>
    );

    const getDarkModeStatus = () => {
        if (general.followSystem) return t.settings_follow_system;
        // 根据用户反馈：选择普通模式显示"已关闭"，选择深色模式显示"已开启"
        return general.darkMode ? t.general_on : t.general_off;
    };

    return (
        <div className="bg-app-bg min-h-full pb-10">
            {/* Group 1: Interface and Display */}
            <SectionHeader title={t.general_interface_display} />
            <div className="bg-app-surface">
                <SettingsItem 
                    label={t.settings_dark_mode} 
                    rightContent={<span className="text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{getDarkModeStatus()}</span>} 
                    tapProps={bindTap<HTMLDivElement>('settings.general.darkMode.open')}
                />
                <SettingsToggle
                  label={t.general_landscape_mode}
                  isOn={general.landscape}
                  onToggle={() => update('landscape', !general.landscape)}
                  actionProps={bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'settings.general.landscape.toggle' },
                    { onTrigger: () => update('landscape', !general.landscape) },
                  )}
                />
                <SettingsToggle
                  label={t.general_nfc}
                  isOn={general.nfc}
                  onToggle={() => update('nfc', !general.nfc)}
                  actionProps={bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'settings.general.nfc.toggle' },
                    { onTrigger: () => update('nfc', !general.nfc) },
                  )}
                />
                <SettingsItem label={t.general_auto_download} rightContent={<span className="text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{t.general_wifi_only}</span>} />
                <SettingsItem label={t.general_language} rightContent={<span className="text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{t.settings_follow_system}</span>} />
                <SettingsItem label={t.general_translation} tapProps={bindTap<HTMLDivElement>('settings.general.translation.open')} isLast />
            </div>

            {/* Group 2: Others */}
            <SectionHeader title={t.general_other} />
            <div className="bg-app-surface">
                <SettingsItem label={t.general_storage} />
                <SettingsItem label={t.general_font_size} />
                <SettingsItem label={t.topbar_media_files} tapProps={bindTap<HTMLDivElement>('settings.general.media.open')} />
                <SettingsItem label={t.discover_listen} tapProps={bindTap<HTMLDivElement>('settings.general.audio.open')} />
                <SettingsItem label={t.discover_management} tapProps={bindTap<HTMLDivElement>('settings.general.discover.open')} />
                <SettingsItem label={t.settings_accessibility} tapProps={bindTap<HTMLDivElement>('settings.general.accessibility.open')} isLast />
            </div>
        </div>
    );
};

// --- Chat Settings (聊天) ---
export const ChatSettings: React.FC = () => {
    const t = useWechatStrings();
    const { user, settings, updateSettings } = useWechatStore(useShallow(s => ({
        user: s.user,
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const { chat } = settings;
    const { bindTap } = useWechatGestures();

    const update = (key: keyof typeof chat, value: boolean) => {
        updateSettings({
                ...settings,
                chat: { ...chat, [key]: value }
        });
    };

    const SectionHeader = ({ title }: { title: string }) => (
        <div className="px-5 py-2.5 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) font-normal">{title}</div>
    );

    return (
        <div className="bg-app-bg min-h-full pb-10">
            {/* Group 1: Interaction and Content */}
             <div className="bg-app-surface">
                 <SettingsToggle
                  label={t.chat_settings_speaker_mode}
                  isOn={chat.speakerMode}
                  onToggle={() => update('speakerMode', !chat.speakerMode)}
                  actionProps={bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'settings.chat.speakerMode.toggle' },
                    { onTrigger: () => update('speakerMode', !chat.speakerMode) },
                  )}
                 />
                 <SettingsToggle 
                    label={t.chat_settings_send_button}
                    subLabel={t.chat_settings_send_button_hint} 
                    isOn={chat.sendButton} 
                    onToggle={() => update('sendButton', !chat.sendButton)}
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.chat.sendButton.toggle' },
                      { onTrigger: () => update('sendButton', !chat.sendButton) },
                    )} 
                 />
                 <SettingsItem label={t.chat_settings_background} />
                 <SettingsItem label={t.chat_settings_sticker_manage} isLast />
            </div>
            
            {/* Group 2: Chat History */}
            <SectionHeader title={t.chat_settings_history} />
            <div className="bg-app-surface">
                <SettingsItem label={t.chat_settings_manage} />
                <SettingsItem label={t.chat_settings_clear_history} isLast />
            </div>
        </div>
    );
};

// --- Notification Settings (通知) ---
export const NotificationSettings: React.FC = () => {
    const t = useWechatStrings();
    const { bindTap } = useWechatGestures();
    const { user, settings, updateSettings } = useWechatStore(useShallow(s => ({
        user: s.user,
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const { notifications } = settings;

    const update = (key: keyof typeof notifications, value: any) => {
        updateSettings({
                ...settings,
                notifications: { ...notifications, [key]: value }
        });
    };

    const displayLabels = {
        count: t.notification_display_count,
        name: t.notification_display_name,
        full: t.notification_display_full
    };

    const SectionHeader = ({ title }: { title: string }) => (
        <div className="px-5 py-2.5 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) font-normal">{title}</div>
    );

    return (
        <div className="bg-app-bg min-h-full pb-10">
            {/* Group 1: Master Toggles */}
             <div className="bg-app-surface">
                <SettingsToggle
                  label={t.notification_message}
                  isOn={notifications.message}
                  onToggle={() => update('message', !notifications.message)}
                  actionProps={bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'settings.notifications.message.toggle' },
                    { onTrigger: () => update('message', !notifications.message) },
                  )}
                />
                <SettingsToggle
                  label={t.notification_voice_video}
                  isOn={notifications.voiceVideo}
                  onToggle={() => update('voiceVideo', !notifications.voiceVideo)}
                  actionProps={bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'settings.notifications.voiceVideo.toggle' },
                    { onTrigger: () => update('voiceVideo', !notifications.voiceVideo) },
                  )}
                  isLast
                />
            </div>

            {/* Gray Spacer */}
            <div className="h-2 bg-app-bg"></div>

            {/* Group 2: Display Content */}
            <div className="bg-app-surface">
                <SettingsItem 
                    label={t.notification_display_content} 
                    subLabel={displayLabels[notifications.displayMode || 'full']} 
                    tapProps={bindTap<HTMLDivElement>('settings.notifications.display.open')}
                    isLast 
                />
            </div>

            {/* Group 3: Sound & Vibration Section */}
            <SectionHeader title={t.notification_sound_vibration} />
            <div className="bg-app-surface">
                <SettingsItem 
                    label={t.notification_message}
                    rightContent={<span className="text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{t.notification_system_settings}</span>} 
                />
                <SettingsItem 
                    label={t.notification_voice_video}
                    rightContent={<span className="text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{t.notification_system_settings}</span>} 
                    isLast 
                />
            </div>

            {/* Group 4: Ringtones Section */}
            <SectionHeader title={t.notification_ringtone_title} />
            <div className="bg-app-surface">
                <SettingsItem 
                    label={t.topbar_notification_sound}
                    rightContent={<span className="text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{notifications.notificationSound || t.settings_follow_system}</span>} 
                    tapProps={bindTap<HTMLDivElement>('settings.notifications.sound.open')}
                />
                <SettingsItem 
                    label={t.profile_ringtone}
                    rightContent={<span className="text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{notifications.incomingRingtone || t.common_wechat}</span>}
                    tapProps={bindTap<HTMLDivElement>('settings.notifications.ringtone.open')}
                    isLast 
                />
            </div>
        </div>
    );
};
