
import React from 'react';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsToggle } from './Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const AudioSettingsPage: React.FC = () => {
    const { user, settings, updateSettings } = useWechatStore(useShallow(s => ({
        user: s.user,
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const { bindTap } = useWechatGestures();
    const { general } = settings;

    const update = (key: keyof typeof general, value: any) => {
        updateSettings({
                ...settings,
                general: { ...general, [key]: value }
        });
    };

    const Description = ({ text }: { text: string }) => (
        <div className="px-5 py-3 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400) leading-normal bg-(--app-c-chat-input-bar-bg)">
            {text}
        </div>
    );

    return (
        <div className="bg-(--app-c-chat-input-bar-bg) min-h-full">
            <div className="h-0.5 bg-(--app-c-chat-input-bar-bg)"></div>
            
            <div className="bg-app-surface">
                <SettingsToggle 
                    label="个性化推荐" 
                    isOn={general.personalizedAudio} 
                    onToggle={() => update('personalizedAudio', !general.personalizedAudio)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.audio.personalizedAudio.toggle' },
                      { onTrigger: () => update('personalizedAudio', !general.personalizedAudio) },
                    )}
                    isLast
                />
            </div>
            <Description text="开启后，将为你推荐兴趣相关度更高的音乐内容" />

            <div className="bg-app-surface">
                <SettingsToggle 
                    label="优先使用无损音质播放" 
                    isOn={general.losslessAudio} 
                    onToggle={() => update('losslessAudio', !general.losslessAudio)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.audio.losslessAudio.toggle' },
                      { onTrigger: () => update('losslessAudio', !general.losslessAudio) },
                    )}
                    isLast
                />
            </div>
            <Description text="开启后，具备无损音质音源的歌曲始终以无损音质播放，移动网络下将消耗更多数据流量；功能仅对QQ音乐会员生效" />

            <div className="bg-app-surface">
                <SettingsToggle 
                    label="在「最近」中显示该功能" 
                    isOn={general.showAudioInRecent} 
                    onToggle={() => update('showAudioInRecent', !general.showAudioInRecent)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.audio.showAudioInRecent.toggle' },
                      { onTrigger: () => update('showAudioInRecent', !general.showAudioInRecent) },
                    )}
                    isLast
                />
            </div>
        </div>
    );
};
