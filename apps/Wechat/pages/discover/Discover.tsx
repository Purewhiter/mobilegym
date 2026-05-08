
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcNavForward, IcSearch, IcAperture, IcInfinity, IcDisc, IcScan, IcMusic, IcSparkles, IcLocation, IcGamepad } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Wechat/${s}`; };

export const DiscoverPage = () => {
    const t = useWechatStrings();
    const settings = useWechatStore(s => s.settings.discover);
    const { bindTap } = useWechatGestures();

    // Helper components
    const DiscoveryItem = ({ icon, label, rightContent, isLast = false, tapProps }: any) => (
         <div
            {...tapProps}
            className={`bg-app-surface pl-4 active:bg-(--app-c-tw-bg-gray-100) ${tapProps ? 'cursor-pointer' : ''}`}
         >
             <div className={`flex items-center py-3.5 pr-4 ${!isLast ? 'border-b border-(--app-c-tw-border-gray-100)' : ''}`}>
                <div className="mr-4 text-2xl flex items-center justify-center w-6">
                    {icon}
                </div>
                <div className="min-w-0 flex-1 text-(--app-chat-bubble-text-size) text-(--app-c-settings-item-text) font-normal break-words [overflow-wrap:anywhere]">
                    {label}
                </div>
                <div className="flex items-center">
                    {rightContent}
                    <IcNavForward size={dimens.icSizeChevronSm} className="text-(--app-c-settings-item-chevron) ml-1" strokeWidth={dimens.icStrokeWidth} />
                </div>
             </div>
         </div>
    );

    const Group = ({ items }: { items: any[] }) => {
        const visibleItems = items.filter(item => settings[item.id as keyof typeof settings]?.visible);
        if (visibleItems.length === 0) return null;

        return (
            <div className="mb-2">
                {visibleItems.map((item, idx) => (
                    <DiscoveryItem 
                        key={item.id}
                        {...item}
                        isLast={idx === visibleItems.length - 1}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="bg-app-bg min-h-full pb-4 overflow-y-auto no-scrollbar">
            {/* Group 1: Moments */}
            <Group items={[
                {
                    id: 'moments',
                    label: t.discover_moments,
                    icon: <IcAperture size={dimens.icSizeToolbar} className="text-blue-500" />,
                    tapProps: bindTap<HTMLDivElement>('discover.moments.open'),
                }
            ]} />

            {/* Group 2: Channels & Live */}
            <Group items={[
                { id: 'channels', label: t.discover_channels, icon: <IcInfinity size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-collection)" /> },
                { 
                    id: 'live', 
                    label: t.discover_live, 
                    icon: <IcDisc size={dimens.icSizeToolbar} className="text-(--app-c-common-red)" />,
                    rightContent: (
                        <div className="flex items-center gap-2">
                            <span className="max-w-[9rem] text-right text-xs text-(--app-c-tw-text-gray-400) font-light leading-tight break-words [overflow-wrap:anywhere]">{t.discover_live_broadcast}</span>
                            <div className="w-8 h-4 bg-(--app-c-tw-bg-gray-200) flex items-center justify-center rounded-[1px]">
                                <span className="text-(--app-title-text-size-6) text-app-text font-bold">CCTV</span>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-red-500 ml-[-4px] mb-[12px] border border-white"></div>
                        </div>
                    )
                }
            ]} />

            {/* Group 3: Scan & Listen */}
            <Group items={[
                { id: 'scan', label: t.discover_scan, icon: <IcScan size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-settings)" />, tapProps: bindTap<HTMLDivElement>('scan.open') },
                { id: 'listen', label: t.discover_listen, icon: <IcMusic size={dimens.icSizeToolbar} className="text-(--app-c-common-red)" /> }
            ]} />

            {/* Group 4: Top Stories & Search */}
            <Group items={[
                { id: 'topStories', label: t.discover_watch, icon: <IcSparkles size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-stickers)" fill="#f6c444" /> },
                { id: 'search', label: t.discover_search, icon: <IcSearch size={dimens.icSizeToolbar} className="text-(--app-c-common-red)" /> }
            ]} />

            {/* Group 5: Nearby */}
            <Group items={[
                { id: 'nearby', label: t.discover_nearby, icon: <IcLocation size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-settings)" />, tapProps: bindTap<HTMLDivElement>('discover.nearby.open') }
            ]} />

            {/* Group 6: Games */}
            <Group items={[
                { 
                    id: 'games', 
                    label: t.discover_games, 
                    icon: <IcGamepad size={dimens.icSizeToolbar} className="text-(--app-c-me-icon-collection)" fill="currentColor" />,
                    rightContent: (
                        <div className="flex items-center gap-2">
                            <span className="max-w-[9rem] text-right text-xs text-(--app-c-tw-text-gray-400) font-light leading-tight break-words [overflow-wrap:anywhere]">{t.discover_game_bonus}</span>
                            <div className="relative">
                                <img src={asset('avatars/avatar_12.jpg')} className="w-8 h-8 rounded-[4px]" alt="Game" />
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></div>
                            </div>
                        </div>
                    )
                }
            ]} />
        </div>
    )
};
