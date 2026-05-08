
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcAperture, IcInfinity, IcDisc, IcScan, IcMusic, IcSparkles, IcSearch, IcLocation, IcGamepad } from '../../res/icons';
import { SettingsItem } from './Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';
export const DiscoverManagementPage: React.FC = () => {
  const t = useWechatStrings();
    const { bindTap } = useWechatGestures();

    const items = [
        { id: 'moments', label: t.discover_moments, icon: <IcAperture size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-collection)" /> },
        { id: 'channels', label: t.discover_channels, icon: <IcInfinity size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-collection)" /> },
        { id: 'live', label: t.discover_live, icon: <IcDisc size={dimens.icSizeToolbar} className="text-(--app-c-common-red)" /> },
        { id: 'scan', label: t.discover_scan, icon: <IcScan size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-settings)" /> },
        { id: 'listen', label: t.discover_listen, icon: <IcMusic size={dimens.icSizeToolbar} className="text-(--app-c-common-red)" /> },
        { id: 'topStories', label: t.discover_watch, icon: <IcSparkles size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-stickers)" fill="currentColor" /> },
        { id: 'search', label: t.discover_search, icon: <IcSearch size={dimens.icSizeToolbar} className="text-(--app-c-common-red)" /> },
        { id: 'nearby', label: t.discover_nearby, icon: <IcLocation size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-settings)" /> },
        { id: 'games', label: t.discover_games, icon: <IcGamepad size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-collection)" fill="currentColor" />, isLast: true },
    ];

    return (
        <div className="bg-app-surface min-h-full flex flex-col">
            {/* Header Area */}
            <div className="pt-16 pb-12 px-6 flex flex-col items-center">
                <h1 className="text-(--app-title-text-size-24) font-bold text-app-text mb-4">{t.discover_management}</h1>
                <p className="text-(--app-chat-bubble-text-size) text-app-text text-center leading-relaxed max-w-(--app-modal-width-280)">
                    你可以指定出现在「发现」页面内的功能以及提醒方式。
                </p>
            </div>

            {/* List Area */}
            <div className="border-t border-(--app-c-tw-border-gray-100)">
                {items.map((item) => (
                    <SettingsItem 
                        key={item.id}
                        label={item.label}
                        icon={item.icon} // 图标放在左侧
                        tapProps={bindTap<HTMLDivElement>('settings.discover.item.open', { params: { id: item.id } })}
                        isLast={item.isLast}
                    />
                ))}
            </div>
        </div>
    );
};
