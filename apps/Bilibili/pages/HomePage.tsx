import React, { useState, useEffect } from 'react';
import { IcSearch, IcGaming, IcMail, IcMenu, IcMonitorPlay, IcMute, IcMoreVertical, IcLike, IcAlignLeft } from '../res/icons';
const Search = IcSearch, Gamepad2 = IcGaming, Mail = IcMail, Menu = IcMenu, MonitorPlay = IcMonitorPlay, VolumeX = IcMute, MoreVertical = IcMoreVertical, ThumbsUp = IcLike, AlignLeft = IcAlignLeft;
import type { BilibiliVideo } from '../data';
import { useVideos } from '../hooks/useData';

import { RECOMMEND_DATA } from '../data/recommendData';
import { useBilibiliStore } from '../state';
import { LiveTab } from './home_tabs/LiveTab';
import { HotTab } from './home_tabs/HotTab';
import { AnimeTab } from './home_tabs/AnimeTab';
import { MovieTab } from './home_tabs/MovieTab';

import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { BilibiliDanmakuIcon } from '../res/icons';
import { useLocale } from '@/apps/Bilibili/locale';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';
import { formatBilibiliStat } from '../utils/localize';

const formatDuration = (val: number | string | undefined) => {
    if (!val) return '00:00';
    // If already formatted (contains colon), return as is
    if (typeof val === 'string' && val.includes(':')) return val;

    // Convert seconds to MM:SS or HH:MM:SS
    const seconds = typeof val === 'string' ? parseInt(val) : val;
    if (isNaN(seconds)) return '00:00';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const BigVideoCard: React.FC<{ video: BilibiliVideo; locale: 'zh-Hans' | 'en'; mockLikeCount: string }> = ({ video, locale, mockLikeCount }) => {
    const coverSrc = typeof video.cover === 'string' && !video.cover.startsWith('#') ? video.cover : '';
    const { bindTap } = useBilibiliGestures();

    return (
        <div
            className="bg-app-surface mx-2 mt-2 rounded-lg overflow-hidden shadow-sm active:scale-[0.98]"
            style={{ transition: 'transform var(--app-duration-quick) var(--app-easing-standard)' }}
            {...bindTap('video.open', { params: { bvid: video.id } })}
        >
            {/* Cover Area */}
            <div className="relative aspect-video bg-gray-200">
                {coverSrc ? (
                    <img
                        src={coverSrc}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-200" />
                )}

                {/* Overlays */}
                <div className="absolute bottom-2 left-3 flex items-center gap-3 text-white text-[11px] drop-shadow-md font-medium">
                    <div className="flex items-center gap-1.5">
                        <MonitorPlay size={14} className="fill-white/20" />
                        {formatBilibiliStat(video.plays, locale)}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <BilibiliDanmakuIcon className="scale-100" />
                        {formatBilibiliStat(video.danmaku || 999, locale)}
                    </div>
                </div>

                <div className="absolute bottom-2 right-3 flex items-center gap-3 text-white">
                    {/* Duration on Big Card usually isn't shown in the corner if it's "feed style", but let's add it if user wants standardization, or keep the existing buttons */}
                    <span className="text-[11px] font-medium">{formatDuration(video.duration)}</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-3 pb-2 flex justify-between items-start gap-2">
                <h2 className="text-[15px] font-medium leading-[1.4] text-app-text line-clamp-2 flex-1 tracking-tight">
                    {video.title}
                </h2>

                <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
                    <div className="flex flex-col items-center gap-0.5 text-gray-400 min-w-[32px]">
                        <ThumbsUp size={18} />
                        <span className="text-[10px] scale-90">{mockLikeCount}</span>
                    </div>
                    <MoreVertical size={16} className="text-gray-300" />
                </div>
            </div>
        </div>
    );
};



const VideoCard: React.FC<{ video: BilibiliVideo; locale: 'zh-Hans' | 'en'; adLabel: string }> = ({ video, locale, adLabel }) => {
    const coverSrc = typeof video.cover === 'string' && !video.cover.startsWith('#') ? video.cover : '';
    const { bindTap } = useBilibiliGestures();

    return (
        <div
            className="bg-app-surface rounded-lg overflow-hidden shadow-sm flex flex-col h-full active:scale-95"
            style={{ transition: 'transform var(--app-duration-quick) var(--app-easing-standard)' }}
            {...bindTap('video.open', { params: { bvid: video.id } })}
        >
            <div className="relative aspect-video bg-gray-200">
                {coverSrc ? (
                    <img
                        src={coverSrc}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-200" />
                )}

                <div className="absolute bottom-1 left-2 text-[10px] text-white flex items-center gap-2 drop-shadow-md">
                    <div className="flex items-center gap-0.5">
                        <MonitorPlay size={10} />
                        {formatBilibiliStat(video.plays, locale)}
                    </div>
                    <div className="flex items-center gap-0.5">
                        <BilibiliDanmakuIcon className="scale-75" />
                        {formatBilibiliStat(video.danmaku, locale)}
                    </div>
                </div>
                <div className="absolute bottom-1 right-2 text-[10px] text-white drop-shadow-md">
                    {formatDuration(video.duration)}
                </div>
            </div>
            <div className="p-2 flex flex-col flex-1 justify-between">
                <h3 className="text-sm font-medium line-clamp-2 text-app-text leading-snug">
                    {video.title}
                </h3>
                <div className="flex items-center justify-between mt-2 text-xs text-app-text-muted">
                    <div className="flex items-center gap-1">
                        {video.isAd && <span className="border border-[#9499A0] rounded px-0.5 text-[9px]">{adLabel}</span>}
                        <span className="truncate max-w-[80px]">{video.author}</span>
                    </div>
                    <button className="text-gray-400">
                        <MoreVertical size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};

interface HomePageProps {
    activeTab?: string;
}

export const HomePage: React.FC<HomePageProps> = ({ activeTab: urlTab = 'recommend' }) => {
    const user = useBilibiliStore(s => s.user);
    const { bindTap } = useBilibiliGestures();
    const VIDEO_DATA = useVideos();
    const locale = useLocale();
    const s = useBilibiliStrings();
    const text = {
        tabNewJourney: s.home_tab_new_journey,
        newYearComingSoon: s.home_newyear_coming,
        searchHint: s.home_search_hint,
        ad: s.common_ad,
    };
    const tabs: Array<{ key: string; label: string; disabled?: boolean }> = [
        { key: 'live', label: s.tab_live },
        { key: 'recommend', label: s.tab_recommended },
        { key: 'hot', label: s.tab_hot },
        { key: 'anime', label: s.tab_anime },
        { key: 'movie', label: s.tab_film_tv },
        { key: 'newyear', label: text.tabNewJourney, disabled: true },
    ];
    const activeTab = tabs.some((tab) => tab.key === urlTab) ? urlTab : 'recommend';

    const getUniqueVideos = () => {
        const sourceData = RECOMMEND_DATA.length > 0 ? RECOMMEND_DATA : VIDEO_DATA;
        return sourceData.map(v => VIDEO_DATA.find(vd => vd.id === v.id) || v);
    };

    const [videos, setVideos] = useState<BilibiliVideo[]>(getUniqueVideos());

    // Reset scroll when tab changes
    // ...

    useEffect(() => {
        if (activeTab === 'recommend') {
            setVideos(getUniqueVideos());
        } else if (activeTab === 'hot') {
            // 热门也用 V2 data，但在 HotTab 组件里处理展示逻辑
            setVideos(getUniqueVideos());
        }
    }, [activeTab, VIDEO_DATA]);

    const renderContent = () => {
        switch (activeTab) {
            case 'live': return <LiveTab />;
            case 'hot': return <HotTab />;
            case 'anime': return <AnimeTab />;
            case 'movie': return <MovieTab />;
            case 'newyear': return <div className="p-10 text-center text-gray-500">{text.newYearComingSoon}</div>;
            case 'recommend':
            default:
                const firstVideo = videos[0];
                const remainingVideos = videos.slice(1);

                return (
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        {/* Big Card for the first video */}
                        {firstVideo && <BigVideoCard video={firstVideo} locale={locale} mockLikeCount={s.home_mock_like_count} />}

                        {/* Grid for the rest */}
                        <div className="grid grid-cols-2 gap-2 p-2 pb-20">
                            {remainingVideos.map((video: BilibiliVideo) => (
                                <VideoCard key={video.id} video={video} locale={locale} adLabel={text.ad} />
                            ))}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col h-full bg-app-bg pt-0">
            {/* Top Header */}
            <div className="px-3 flex items-center gap-3 bg-app-surface pt-10 pb-2 text-[15px]">
                <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-100">
                    <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div
                    {...bindTap('search.open')}
                    className="flex-1 h-8 bg-gray-100 rounded-full flex items-center px-3 gap-2 text-gray-400 active:scale-95 transition-transform origin-center"
                >
                    <Search size={16} />
                    <span className="text-base truncate">{text.searchHint}</span>
                </div>
                <Gamepad2 size={24} className="text-gray-600" />
                <Mail size={24} className="text-gray-600" />
            </div>

            {/* Tabs */}
            <div className="bg-app-surface flex items-center border-b border-gray-100">
                <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                    <div className="flex items-center">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.key;
                            const isDisabled = Boolean(tab.disabled);
                            return (
                                <button
                                    key={tab.key}
                                    {...(isActive || isDisabled ? {} : bindTap('home.tab.switch', { params: { tab: tab.key } }))}
                                    className={`flex-shrink-0 px-3 py-2 text-[16px] font-medium whitespace-nowrap relative text-center ${isActive ? 'text-app-primary' : 'text-gray-600'} ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}
                                >
                                    {tab.label}
                                    {isActive && (
                                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-app-primary rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="px-2 text-gray-600 flex-none" {...bindTap('partitions.open')}>
                    <Menu size={20} />
                </div>
            </div>

            {/* Content Feed */}
            <div 
                className="flex-1 overflow-y-auto no-scrollbar bg-app-bg"
                data-scroll-container="main"
                data-scroll-direction="vertical"
            >
                {renderContent()}
            </div>
        </div>
    );
};
