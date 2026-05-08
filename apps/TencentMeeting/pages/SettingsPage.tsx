import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';

import React from 'react';
import { IcNavForward, IcAudio, IcVideo, IcMessage, IcSettings } from '../res/icons';
import { useMeetingStore } from '../state';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { ActionSpec } from '../../../os/hooks/useTriggerGestures';
export const SettingsPage: React.FC = () => {
    const settings = useMeetingStore(s => s.settings);
    const updateSettings = useMeetingStore(s => s.updateSettings);
    const { bindBack, bindTap } = useMeetingGestures();
    const s = useTencentMeetingStrings();

    const Toggle = ({ value, actionId, onChange }: { value: boolean; actionId: string; onChange: () => void }) => (
        <div
            className={`w-11 h-6 rounded-full relative transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}
            {...(bindTap as any)(
                { kind: 'action', id: actionId } as ActionSpec,
                { onTrigger: onChange, stopPropagation: true }
            )}
        >
            <div className={`absolute top-0.5 w-5 h-5 bg-app-surface rounded-full transition-transform shadow-sm ${value ? 'left-[22px]' : 'left-0.5'}`}></div>
        </div>
    );

    const Item = ({ label, icon: Icon, right, subLabel, isLink = false, border = true, actionProps }: any) => {
        const { className: actionClassName, ...restProps } = actionProps || {};
        return (
            <div
                {...restProps}
                className={`flex items-center justify-between gap-3 py-3.5 px-4 bg-app-surface active:bg-gray-50 ${border ? 'border-b border-gray-50' : ''} ${actionClassName || ''}`}
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {Icon && <Icon size={18} className="text-gray-500" />}
                    <div className="min-w-0">
                        <span className="block text-[15px] text-gray-900 leading-snug break-words">{label}</span>
                        {subLabel && <span className="block text-gray-400 text-sm leading-snug">{subLabel}</span>}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {right}
                    {isLink && <IcNavForward size={16} className="text-gray-400" />}
                </div>
            </div>
        );
    };

    const SectionHeader = ({ icon: Icon, label }: any) => (
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-gray-500 text-[13px]">
            {Icon && <Icon size={14} />}
            <span>{label}</span>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#f6f7f9]">
            {/* Status bar background + Header */}
            <div className="bg-app-surface pt-10 shrink-0 sticky top-0 z-10">
                <div className="flex items-center px-2 py-2">
                    <button className="p-2" {...bindBack()}>
                        <IcNavForward size={24} className="text-gray-900 transform rotate-180" />
                    </button>
                    <div className="flex-1 text-center pr-10">
                        <h1 className="text-[17px] font-medium text-gray-900">{s.settings_title}</h1>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-8" data-scroll-container="main" data-scroll-direction="vertical">
                {/* Notifications */}
                <div className="mt-3 bg-app-surface mb-3">
                    <Item
                        label={s.settings_notifications}
                        subLabel="ⓘ"
                        border={false}
                        right={<Toggle value={settings.notifications} actionId="settings.notifications.toggle" onChange={() => updateSettings({ notifications: !settings.notifications })} />}
                    />
                </div>

                <div className="bg-app-surface mb-3">
                    <Item
                        label={s.menu_account_security}
                        isLink={true}
                        border={false}
                        actionProps={bindTap('settings.account_security.open')}
                    />
                </div>

                {/* Audio */}
                <SectionHeader icon={IcAudio} label={s.settings_section_audio} />
                <div className="bg-app-surface mb-3">
                    <Item label={s.settings_mic_on_join} right={<Toggle value={settings.micOnJoin} actionId="settings.audio.micOnJoin.toggle" onChange={() => updateSettings({ micOnJoin: !settings.micOnJoin })} />} />
                    <Item label={s.settings_speaker_on_join} right={<Toggle value={settings.speakerOnJoin} actionId="settings.audio.speakerOnJoin.toggle" onChange={() => updateSettings({ speakerOnJoin: !settings.speakerOnJoin })} />} />
                    <Item label={s.settings_mic_floating} right={<Toggle value={settings.micFloating} actionId="settings.audio.micFloating.toggle" onChange={() => updateSettings({ micFloating: !settings.micFloating })} />} />
                    <Item label={s.settings_mic_sound} right={<Toggle value={settings.micSound} actionId="settings.audio.micSound.toggle" onChange={() => updateSettings({ micSound: !settings.micSound })} />} />
                    <Item label={s.settings_audio_enhancement} isLink={true} border={false} />
                </div>

                {/* Video */}
                <SectionHeader icon={IcVideo} label={s.settings_section_video} />
                <div className="bg-app-surface mb-3">
                    <Item label={s.settings_camera_on_join} right={<Toggle value={settings.cameraOnJoin} actionId="settings.video.cameraOnJoin.toggle" onChange={() => updateSettings({ cameraOnJoin: !settings.cameraOnJoin })} />} />
                    <Item label={s.settings_virtual_bg} isLink={true} />
                    <Item label={s.settings_beauty} right={<span className="text-gray-500 text-sm">{s.settings_beauty_status}</span>} isLink={true} />
                    <Item label={s.settings_virtual_avatar} isLink={true} />
                    <Item label={s.settings_name_badge} isLink={true} />
                    <Item label={s.settings_video_mirror} right={<Toggle value={settings.videoMirror} actionId="settings.video.videoMirror.toggle" onChange={() => updateSettings({ videoMirror: !settings.videoMirror })} />} />
                    <Item label={s.settings_hide_non_video} subLabel="ⓘ" right={<Toggle value={settings.hideNonVideo} actionId="settings.video.hideNonVideo.toggle" onChange={() => updateSettings({ hideNonVideo: !settings.hideNonVideo })} />} />
                    <Item label={s.settings_hide_self} subLabel="ⓘ" right={<Toggle value={settings.hideSelf} actionId="settings.video.hideSelf.toggle" onChange={() => updateSettings({ hideSelf: !settings.hideSelf })} />} />
                    <Item label={s.settings_show_preview} subLabel="ⓘ" right={<Toggle value={settings.showPreview} actionId="settings.video.showPreview.toggle" onChange={() => updateSettings({ showPreview: !settings.showPreview })} />} />
                    <Item label={s.settings_advanced_video} isLink={true} border={false} />
                </div>

                {/* Chat */}
                <SectionHeader icon={IcMessage} label={s.settings_section_chat} />
                <div className="bg-app-surface mb-3">
                    <Item label={s.settings_danmu} right={<Toggle value={settings.danmu} actionId="settings.chat.danmu.toggle" onChange={() => updateSettings({ danmu: !settings.danmu })} />} />
                    <Item label={s.settings_new_msg_reminder} right={<span className="text-gray-500 text-sm">{s.settings_new_msg_reminder_value}</span>} isLink={true} border={false} />
                </div>

                {/* General */}
                <SectionHeader icon={IcSettings} label={s.settings_section_general} />
                <div className="bg-app-surface mb-3">
                    <Item label={s.settings_sync_calendar} isLink={true} />
                    <Item label={s.settings_auto_cloud_record} right={<span className="text-gray-500 text-sm">{s.settings_auto_cloud_record_off}</span>} isLink={true} />
                    <Item label={s.settings_cloud_record} right={<div className="w-2 h-2 rounded-full bg-red-500"></div>} isLink={true} />
                    <Item label={s.settings_subtitle_transcribe} isLink={true} />
                    <Item label={s.settings_show_duration} right={<Toggle value={settings.showDuration} actionId="settings.general.showDuration.toggle" onChange={() => updateSettings({ showDuration: !settings.showDuration })} />} />
                    <Item label={s.settings_nearby_discovery} subLabel="ⓘ" right={<Toggle value={settings.nearbyDiscovery} actionId="settings.general.nearbyDiscovery.toggle" onChange={() => updateSettings({ nearbyDiscovery: !settings.nearbyDiscovery })} />} />
                    <div className="px-4 pb-2 text-blue-600 text-xs bg-app-surface">{s.settings_learn_more}</div>
                    <Item label={s.settings_voice_excitation} subLabel="ⓘ" right={<Toggle value={settings.voiceExcitation} actionId="settings.general.voiceExcitation.toggle" onChange={() => updateSettings({ voiceExcitation: !settings.voiceExcitation })} />} />
                    <Item label={s.settings_shortcut_float} subLabel="ⓘ" right={<Toggle value={settings.shortcutFloat} actionId="settings.general.shortcutFloat.toggle" onChange={() => updateSettings({ shortcutFloat: !settings.shortcutFloat })} />} />
                    <Item label={s.settings_safe_drive} subLabel="ⓘ" right={<Toggle value={settings.safeDrive} actionId="settings.general.safeDrive.toggle" onChange={() => updateSettings({ safeDrive: !settings.safeDrive })} />} />
                    <Item label={s.settings_dark_mode_follow} subLabel="ⓘ" right={<Toggle value={settings.darkModeFollow} actionId="settings.general.darkModeFollow.toggle" onChange={() => updateSettings({ darkModeFollow: !settings.darkModeFollow })} />} />
                    <Item label={s.settings_language} right={<span className="text-gray-500 text-sm">{s.settings_language_follow}</span>} isLink={true} border={false} />
                </div>

                {/* Others */}
                <div className="bg-app-surface mb-6">
                    <Item label={s.settings_network_check} isLink={true} />
                    <Item label={s.settings_proxy} right={<span className="text-gray-500 text-sm">{s.settings_proxy_off}</span>} isLink={true} />
                    <Item label={s.settings_cache_clear} isLink={true} />
                    <Item label={s.menu_privacy} isLink={true} />
                    <Item
                        label={s.menu_about}
                        right={<span className="text-gray-500 text-sm">{s.settings_about_version}</span>}
                        isLink={true}
                        border={false}
                        actionProps={bindTap('settings.about.open' as any)}
                    />
                </div>
            </div>
        </div>
    );
};
