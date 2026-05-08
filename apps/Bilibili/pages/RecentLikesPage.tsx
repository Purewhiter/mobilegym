import React from 'react';
import { IcNavBack, IcSearch, IcMoreVertical, IcMonitorPlay, IcMessageSquareText } from '../res/icons';
const ChevronLeft = IcNavBack, Search = IcSearch, MoreVertical = IcMoreVertical, MonitorPlay = IcMonitorPlay, MessageSquareText = IcMessageSquareText;
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useVideos } from '../hooks/useData';
// Helper for formatting stats numbers
const formatStat = (num: number | string | undefined) => {
    if (num === undefined || num === null) return '0';
    if (typeof num === 'string' && (num.includes('万') || num.includes('亿'))) {
        return num;
    }
    const val = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(val)) return '0';
    if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
    if (val >= 10000) return (val / 10000).toFixed(1) + '万';
    return val.toString();
};

const formatDuration = (val: number | string | undefined) => {
    if (!val) return '00:00';
    if (typeof val === 'string' && val.includes(':')) return val;

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

export const RecentLikesPage: React.FC = () => {
    const { bindBack, bindTap } = useBilibiliGestures();
    const user = useBilibiliStore(s => s.user);
    const VIDEO_DATA = useVideos();
    const likedVideos = VIDEO_DATA.filter(v => user.likedVideoIds?.includes(v.id));

    return (
        <div className="flex flex-col h-full bg-app-surface font-sans">
            {/* Header - Fixed with status bar padding */}
            <div className="sticky top-0 bg-app-surface z-50 border-b border-app-bg">
                <div className="h-10" /> {/* Status bar placeholder */}
                <div className="flex items-center justify-between px-4 pb-3">
                    <div className="flex items-center gap-4">
                        <button type="button" {...bindBack()} className="active:opacity-80">
                            <ChevronLeft size={24} className="text-app-text" />
                        </button>
                        <span className="text-[17px] text-app-text font-medium">最近点赞的视频</span>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto" data-scroll-container="main" data-scroll-direction="vertical">
                {likedVideos.map(video => (
                    <div key={video.id} className="flex gap-3 px-4 py-3 border-b border-app-bg active:bg-gray-50 transition-colors cursor-pointer" {...bindTap('video.open', { params: { bvid: video.id } })}>
                        {/* Thumbnail */}
                        <div className="w-[125px] aspect-video bg-app-bg rounded-[6px] overflow-hidden relative shrink-0">
                            <img src={video.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute bottom-1 right-1 text-white text-[10px] bg-black/40 px-1 rounded flex items-center h-[16px]">
                                {formatDuration(video.duration)}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex flex-col justify-between flex-1 py-0.5 relative">
                            <div className="text-[14px] text-app-text leading-[1.3] line-clamp-2 font-normal">
                                {video.title}
                            </div>

                            <div className="text-[11px] text-app-text-muted flex items-center gap-4 mt-auto">
                                <span className="flex items-center gap-1">
                                    <MonitorPlay size={12} className="text-app-text-muted" />
                                    {formatStat(video.plays)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MessageSquareText size={11} className="text-app-text-muted" />
                                    {formatStat(video.danmaku || 0)}
                                </span>
                            </div>

                            {/* Menu Icon (Absolute bottom right of container) */}
                            <div className="absolute bottom-0 right-0 text-app-text-muted p-1 -mr-2 -mb-2">
                                <MoreVertical size={16} />
                            </div>
                        </div>
                    </div>
                ))}

                {/* Footer Text */}
                <div className="py-10 text-center text-app-text-muted text-[12px] flex flex-col items-center gap-2">
                    <span className="opacity-50 tracking-widest">
                        ╮( 3 )╭  再怎么找也没有啦
                    </span>
                </div>
            </div>
        </div>
    );
};
