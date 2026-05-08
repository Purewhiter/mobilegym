import React, { useMemo } from 'react';
import { IcNavBack, IcShare, IcSearch, IcDownload, IcMonitorPlay, IcMessageSquareText, IcHeart } from '../res/icons';
const ChevronLeft = IcNavBack, Share2 = IcShare, Search = IcSearch, Download = IcDownload, MonitorPlay = IcMonitorPlay, MessageSquareText = IcMessageSquareText, Heart = IcHeart;
import { useSearchParams } from 'react-router-dom';
import type { RankingVideo, BilibiliVideo } from '../data';
import { useVideos, useRankings } from '../hooks/useData';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useVirtualList } from '../../../os/hooks/useVirtualList';
const TABS = [
    '全站', '番剧', '国创', '纪录片', '电影', '电视剧', '动画', '游戏', '鬼畜', '音乐', '舞蹈',
    '影视', '娱乐', '知识', '科技数码', '美食', '汽车',
    '时尚美妆', '体育运动', '动物'
];

interface RankingItemProps {
    video: RankingVideo;
    index: number;
    videoById: Map<string, BilibiliVideo>;
    isLast: boolean;
}

const formatCount = (count: number | string | undefined) => {
    if (count === undefined || count === null) return '0';
    if (typeof count === 'string' && (count.includes('万') || count.includes('亿'))) {
        return count;
    }
    const num = typeof count === 'string' ? parseFloat(count) : count;
    if (isNaN(num)) return '0';

    if (num >= 100000000) {
        return (num / 100000000).toFixed(1) + '亿';
    } else if (num >= 10000) {
        return (num / 10000).toFixed(1) + '万';
    }
    return Math.floor(num).toString();
};

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

const RankingItem: React.FC<RankingItemProps> = ({ video, index, videoById, isLast }) => {
    const { bindTap } = useBilibiliGestures();

    // Hydrate from primary data source
    const displayVideo = { ...video, ...(videoById.get(video.id) || {}) };
    
    const rank = index + 1;
    let rankColor = 'text-gray-500';
    let badgeColor = 'bg-gray-400';

    if (rank === 1) {
        rankColor = 'text-[#FFD700]'; // Goldish
        badgeColor = 'bg-[#FFD700]';
    } else if (rank === 2) {
        rankColor = 'text-[#C0C0C0]'; // Silver
        badgeColor = 'bg-[#C0C0C0]';
    } else if (rank === 3) {
        rankColor = 'text-[#CD7F32]'; // Bronze
        badgeColor = 'bg-[#CD7F32]';
    }

    const isPGC = ['番剧', '国创', '纪录片', '电影', '电视剧'].includes(displayVideo.partition);

    // Subtitle logic
    let subtitle = displayVideo.author;
    if (isPGC) {
        if  (displayVideo.partition === '电影' && displayVideo.danmaku) {
            subtitle = `${formatCount(displayVideo.danmaku)}弹幕`;
        } else if (displayVideo.raw?.new_ep?.index_show) {
            subtitle = displayVideo.raw.new_ep.index_show;
        } else if (displayVideo.desc) {
            subtitle = displayVideo.desc.slice(0, 15);
        } else {
            subtitle = '哔哩哔哩' + displayVideo.partition;
        }
    }

    // Stats logic
    const stat1Icon = <MonitorPlay size={12} />;
    const stat1Value = formatCount(displayVideo.plays);

    let stat2Icon = <MessageSquareText size={12} />;
    let stat2Value = formatCount(displayVideo.danmaku);

    if (isPGC) {
        stat2Icon = <Heart size={12} />;
        // Try to find follow or like count in raw data
        const follow = displayVideo.raw?.stat?.follow || displayVideo.raw?.stat?.series_follow || displayVideo.raw?.stat?.like || 0;
        stat2Value = formatCount(follow);
    }

    return (
        <div
            className={`flex gap-3 py-3 active:bg-gray-50 ${isLast ? '' : 'border-b border-gray-100'}`}
            {...bindTap('video.open', { params: { bvid: displayVideo.id } })}
        >
            {/* Rank badge on image/absolute or just separate? Screenshot shows badge ON image top-left */}
            <div className="relative w-[160px] h-[100px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                {displayVideo.cover ? (
                    <img
                        src={displayVideo.cover}
                        alt={displayVideo.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                        暂无封面
                    </div>
                )}

                {/* Rank Badge */}
                <div className={`absolute top-0 left-0 px-2 py-0.5 rounded-br-lg ${rank <= 3 ? badgeColor : 'bg-transparent'} flex items-center justify-center`}>
                    <span className={`text-sm font-bold ${rank <= 3 ? 'text-white' : 'text-transparent'}`}>
                        {rank}
                    </span>
                </div>
                {/* If rank > 3, maybe just a text overlay? Screenshot shows consistent badge style but maybe color differs. 
                   Actually look at screenshot: 1, 2, 3 have colored backgrounds. 4, 5, 6 seem to have gray backgrounds?
                   Let's stick to a colored badge for all for visibility, or gray for >3.
                */}
                {rank > 3 && (
                    <div className="absolute top-0 left-0 px-2 py-0.5 rounded-br-lg bg-gray-400/80 flex items-center justify-center">
                        <span className="text-sm font-bold text-white">{rank}</span>
                    </div>
                )}

                {/* Duration */}
                {displayVideo.duration && (
                    <div className="absolute bottom-1 right-1 bg-black/60 px-1 rounded text-xs text-white">
                        {formatDuration(displayVideo.duration)}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                <div>
                    <h3 className="text-[15px] text-app-text leading-snug line-clamp-2  mb-1">
                        {displayVideo.title}
                    </h3>
                </div>

                <div className="flex flex-col gap-1">
                    {/* Subtitle / Author / Update info */}
                    <div className="flex items-center gap-1 text-[12px] text-gray-400">
                        {!isPGC && <span className="p-0.5 rounded border border-app-border text-[10px] scale-90 origin-left">UP</span>}
                        <span className="truncate">{subtitle}</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-[12px] text-gray-400">
                        <div className="flex items-center gap-1">
                            {stat1Icon}
                            <span>{stat1Value}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {stat2Icon}
                            <span>{stat2Value}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col justify-end pb-1">
                <button className="text-gray-300 p-1">⋮</button>
            </div>
        </div>
    );
};

export const RankingPage: React.FC = () => {
    const { bindBack, bindTap } = useBilibiliGestures();
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || '全站';
    const VIDEO_DATA = useVideos();
    const RANKING_DATA = useRankings();
    const videoById = useMemo(() => new Map(VIDEO_DATA.map(video => [video.id, video])), [VIDEO_DATA]);

    // Safely get data, fallback to empty array
    const videos = RANKING_DATA[activeTab] || [];
    const { parentRef, virtualItems, totalSize } = useVirtualList({
        items: videos,
        estimateSize: () => 124,
        overscan: 5,
        paddingEnd: 40,
        getItemKey: (index, item) => item.id || `rank-item-${index}`,
    });

    return (
        <div className="flex flex-col h-full bg-app-surface pt-10">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-app-surface">
                <div className="flex items-center gap-4">
                    <button {...bindBack()} className="p-1 -ml-2">
                        <ChevronLeft size={24} className="text-gray-700" />
                    </button>
                    <span className="text-lg font-medium">全区排行榜</span>
                </div>
                <div className="flex items-center gap-4">
                    <button>
                        <Download size={22} className="text-gray-600" />
                    </button>
                    <button>
                        <Search size={22} className="text-gray-600" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center overflow-x-auto no-scrollbar border-b border-gray-100 bg-app-surface sticky top-0 z-10 px-2">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        {...(activeTab === tab ? {} : bindTap('ranking.tab.switch', { params: { tab } }))}
                        className={`flex-shrink-0 px-4 py-2.5 text-[15px] font-medium transition-colors relative ${activeTab === tab ? 'text-app-primary' : 'text-gray-600'
                            }`}
                    >
                        {tab}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-app-primary rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* List */}
            <div 
                key={activeTab}
                ref={parentRef}
                className="flex-1 overflow-y-auto px-3 bg-app-surface"
                data-scroll-container="main"
                data-scroll-direction="vertical"
            >
                {videos.length > 0 ? (
                    <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
                        {virtualItems.map((vItem) => {
                            const item = videos[vItem.index];
                            if (!item) return null;
                            return (
                                <div
                                    key={vItem.key}
                                    data-index={vItem.index}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${vItem.start}px)`,
                                    }}
                                >
                                    <RankingItem
                                        video={item}
                                        index={vItem.index}
                                        videoById={videoById}
                                        isLast={vItem.index === videos.length - 1}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <p>暂无数据</p>
                    </div>
                )}
            </div>
        </div>
    );
};
