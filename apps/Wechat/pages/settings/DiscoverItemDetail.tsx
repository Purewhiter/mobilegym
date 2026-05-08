
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useParams } from 'react-router-dom';
import { IcExpand, IcAperture, IcInfinity, IcDisc, IcScan, IcMusic, IcSparkles, IcSearch, IcLocation, IcGamepad } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsToggle } from './Shared';
import { UserSettings } from '../../types';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const DiscoverItemDetailPage: React.FC = () => {
    const t = useWechatStrings();
    // Fixed: useParams type constraint error by using simple string access or casting
    const params = useParams();
    const id = params.id as keyof UserSettings['discover'];
    const { bindBack, bindTap } = useWechatGestures();
    const { settings: allSettings, updateSettings } = useWechatStore(useShallow(s => ({
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const discoverSettings = allSettings.discover;

    if (!id || !discoverSettings[id]) return null;

    const itemConfig = {
        moments: { label: t.discover_moments, icon: <IcAperture size={dimens.icSizePlaceholder} className="text-(--app-c-me-icon-collection)" /> },
        channels: { label: t.discover_channels, icon: <IcInfinity size={dimens.icSizePlaceholder} className="text-(--app-c-me-icon-collection)" /> },
        live: { label: t.discover_live, icon: <IcDisc size={dimens.icSizePlaceholder} className="text-(--app-c-common-red)" /> },
        scan: { label: t.discover_scan, icon: <IcScan size={dimens.icSizePlaceholder} className="text-(--app-c-me-icon-settings)" /> },
        listen: { label: t.discover_listen, icon: <IcMusic size={dimens.icSizePlaceholder} className="text-(--app-c-common-red)" /> },
        topStories: { label: t.discover_watch, icon: <IcSparkles size={dimens.icSizePlaceholder} className="text-(--app-c-me-icon-stickers)" fill="currentColor" /> },
        search: { label: t.discover_search, icon: <IcSearch size={dimens.icSizePlaceholder} className="text-(--app-c-common-red)" /> },
        nearby: { label: t.discover_nearby, icon: <IcLocation size={dimens.icSizePlaceholder} className="text-(--app-c-me-icon-settings)" /> },
        games: { label: t.discover_games, icon: <IcGamepad size={dimens.icSizePlaceholder} className="text-(--app-c-me-icon-collection)" fill="currentColor" /> },
    }[id];

    const currentSetting = discoverSettings[id];

    const update = (field: string, value: boolean) => {
        updateSettings({
                ...allSettings,
                discover: {
                    ...discoverSettings,
                    [id]: { ...currentSetting, [field]: value }
                }
        });
    };

    return (
        <div className="bg-app-surface min-h-full flex flex-col items-center px-5 relative overflow-hidden">
            {/* Close Chevron */}
            <button 
                {...bindBack<HTMLButtonElement>()}
                className="absolute top-4 left-5 p-2 active:opacity-60"
            >
                <IcExpand size={dimens.icSizeNav} className="text-app-text" />
            </button>

            {/* Icon and Title Section */}
            <div className="mt-20 flex flex-col items-center mb-16">
                <div className="mb-6">
                    {itemConfig?.icon}
                </div>
                <h2 className="text-(--app-me-username-size) font-bold text-app-text">{itemConfig?.label}</h2>
            </div>

            {/* Toggles Group */}
            <div className="w-full bg-(--app-c-chat-input-bar-bg) rounded-xl overflow-hidden">
                <SettingsToggle 
                    label="在发现页中显示该功能" 
                    isOn={currentSetting.visible} 
                    onToggle={() => update('visible', !currentSetting.visible)}
                    actionProps={id ? bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'settings.discover.item.visible.toggle' },
                      { params: { id: String(id) }, onTrigger: () => update('visible', !currentSetting.visible) },
                    ) : undefined}
                    isLast={!('notify' in currentSetting)}
                />
                
                {'notify' in currentSetting && (
                    <SettingsToggle 
                        label="有新内容时提醒我" 
                        isOn={!!currentSetting.notify} 
                        onToggle={() => update('notify', !currentSetting.notify)}
                        actionProps={id ? bindTap<HTMLDivElement>(
                          { kind: 'action', id: 'settings.discover.item.notify.toggle' },
                          { params: { id: String(id) }, onTrigger: () => update('notify', !currentSetting.notify) },
                        ) : undefined}
                        isLast={id !== 'nearby'}
                    />
                )}

                {/* Fix: Cast currentSetting to any or specific interface to access showNearbyPeople property */}
                {id === 'nearby' && (
                    <SettingsToggle 
                        label="显示附近的人" 
                        isOn={!!(currentSetting as any).showNearbyPeople} 
                        onToggle={() => update('showNearbyPeople', !(currentSetting as any).showNearbyPeople)}
                        actionProps={id ? bindTap<HTMLDivElement>(
                          { kind: 'action', id: 'settings.discover.item.showNearbyPeople.toggle' },
                          { params: { id: String(id) }, onTrigger: () => update('showNearbyPeople', !(currentSetting as any).showNearbyPeople) },
                        ) : undefined}
                        isLast
                    />
                )}
            </div>
        </div>
    );
};
