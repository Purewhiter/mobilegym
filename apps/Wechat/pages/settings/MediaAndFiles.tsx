
import React from 'react';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsToggle } from './Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const MediaAndFilesPage: React.FC = () => {
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

    const Spacer = () => <div className="h-2 bg-(--app-c-chat-input-bar-bg)"></div>;

    return (
        <div className="bg-(--app-c-chat-input-bar-bg) min-h-full">
            <div className="h-0.5 bg-(--app-c-chat-input-bar-bg)"></div>
            
            <div className="bg-app-surface">
                <SettingsToggle 
                    label="自动下载" 
                    isOn={general.mediaAutoDownload} 
                    onToggle={() => update('mediaAutoDownload', !general.mediaAutoDownload)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.media.mediaAutoDownload.toggle' },
                      { onTrigger: () => update('mediaAutoDownload', !general.mediaAutoDownload) },
                    )}
                    isLast
                />
            </div>
            <Description text="在其他设备查看的照片、视频和文件在手机上自动下载。" />

            <div className="bg-app-surface">
                <SettingsToggle 
                    label="照片" 
                    isOn={general.savePhotos} 
                    onToggle={() => update('savePhotos', !general.savePhotos)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.media.savePhotos.toggle' },
                      { onTrigger: () => update('savePhotos', !general.savePhotos) },
                    )}
                />
                <SettingsToggle 
                    label="视频" 
                    isOn={general.saveVideos} 
                    onToggle={() => update('saveVideos', !general.saveVideos)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.media.saveVideos.toggle' },
                      { onTrigger: () => update('saveVideos', !general.saveVideos) },
                    )}
                    isLast
                />
            </div>
            <Description text="拍摄或编辑后的内容保存到系统相册。" />

            <div className="bg-app-surface">
                <SettingsToggle 
                    label="聊天图片搜索" 
                    isOn={general.imageSearch} 
                    onToggle={() => update('imageSearch', !general.imageSearch)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.media.imageSearch.toggle' },
                      { onTrigger: () => update('imageSearch', !general.imageSearch) },
                    )}
                    isLast
                />
            </div>
            <Description text="开启后，可通过图片信息搜索聊天中的图片。" />

            <div className="bg-app-surface">
                <SettingsToggle 
                    label="保留查看过的原图原视频" 
                    isOn={general.keepOriginal} 
                    onToggle={() => update('keepOriginal', !general.keepOriginal)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.media.keepOriginal.toggle' },
                      { onTrigger: () => update('keepOriginal', !general.keepOriginal) },
                    )}
                    isLast
                />
            </div>
            <Description text="开启后，保留「已发送」和「已接收并查看」的原图原视频在微信。开启前的原图原视频不受影响。" />

            <div className="bg-app-surface">
                <SettingsToggle 
                    label="移动网络下视频自动播放" 
                    isOn={general.mobileAutoPlay} 
                    onToggle={() => update('mobileAutoPlay', !general.mobileAutoPlay)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.media.mobileAutoPlay.toggle' },
                      { onTrigger: () => update('mobileAutoPlay', !general.mobileAutoPlay) },
                    )}
                    isLast
                />
            </div>
            <Description text="开启后，朋友圈视频在移动网络下自动播放。" />

            <div className="bg-app-surface">
                <SettingsToggle 
                    label="使用移动网络改善语音质量" 
                    isOn={general.mobileVoiceQuality} 
                    onToggle={() => update('mobileVoiceQuality', !general.mobileVoiceQuality)} 
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.general.media.mobileVoiceQuality.toggle' },
                      { onTrigger: () => update('mobileVoiceQuality', !general.mobileVoiceQuality) },
                    )}
                    isLast
                />
            </div>
            <Description text="Wi-Fi下通话效果不佳时，使用移动网络改善语音质量，流量消耗约1M/分钟。" />
        </div>
    );
};
