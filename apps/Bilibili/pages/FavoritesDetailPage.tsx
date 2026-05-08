import React from 'react';
import { IcNavBack, IcSearch, IcMore, IcMoreVertical, IcPlay, IcMonitorPlay, IcMessageSquareText } from '../res/icons';
const ChevronLeft = IcNavBack, Search = IcSearch, MoreHorizontal = IcMore, MoreVertical = IcMoreVertical, Play = IcPlay, MonitorPlay = IcMonitorPlay, MessageSquareText = IcMessageSquareText;
import { useParams } from 'react-router-dom';
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

export const FavoritesDetailPage: React.FC = () => {
    const { bindBack, bindTap } = useBilibiliGestures();
    const { folderId } = useParams();
    const user = useBilibiliStore(s => s.user);
    const VIDEO_DATA = useVideos();

    // Get folder data
    const folder = user.favoritesFolders?.find(f => f.id === folderId) || user.favoritesFolders?.[0];

    // Get videos
    const videos = folder?.videoIds
        ? VIDEO_DATA.filter(v => folder.videoIds!.includes(v.id))
        : [];

    // Folder cover
    const folderCover = (folder?.videoIds && folder.videoIds.length > 0)
        ? VIDEO_DATA.find(v => v.id === folder.videoIds![folder.videoIds!.length - 1])?.cover
        : folder?.cover;

    return (
        <div className="flex flex-col h-full bg-app-surface font-sans relative">
            {/* Header */}
            <div className="sticky top-0 bg-app-surface z-50">
                <div className="h-10" /> {/* Status bar placeholder */}
                <div className="flex items-center justify-between px-4 pb-3">
                    <div className="flex items-center gap-4">
                        <button type="button" {...bindBack()} className="active:opacity-80">
                            <ChevronLeft size={24} className="text-app-text" />
                        </button>
                        {/* Title is hidden in header, shown in body */}
                    </div>
                    <div className="flex items-center gap-5 text-[#61666D]">
                        <Search size={22} />
                        <MoreVertical size={22} />
                    </div>
                </div>
            </div>

            {/* Folder Info Header */}
            <div className="px-4 pb-2">
                <div className="flex gap-3 mb-2">
                    <div className="w-[125px] aspect-video bg-app-bg rounded-[6px] overflow-hidden shrink-0 relative">
                        {folderCover ? (
                            <img src={folderCover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">无封面</div>
                        )}
                        {/* Optional: Add video count or something on cover if needed, but not in screenshot */}
                    </div>
                    <div className="flex flex-col py-0.5">
                        <h1 className="text-[17px] text-app-text font-medium leading-tight mb-2">{folder?.title || '收藏夹'}</h1>
                        <div className="text-[12px] text-app-text-muted">创建者：{user.name}</div>
                    </div>
                </div>
                {/* Count section */}
                <div className="text-[12px] text-app-text-muted mt-3 pb-2 border-b border-app-bg">
                    {videos.length}个内容
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pb-20" data-scroll-container="main" data-scroll-direction="vertical">
                {videos.map(video => (
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

                            <div className="mt-auto">
                                <div className="text-[11px] text-app-text-muted flex items-center gap-1 mb-1">
                                    <span className="border border-[#9499A0]/30 rounded-[2px] px-0.5 text-[9px] scale-90 origin-left">UP</span>
                                    {video.author || "UP主"}
                                </div>
                                <div className="text-[11px] text-app-text-muted flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <MonitorPlay size={12} className="text-app-text-muted" />
                                        {formatStat(video.plays)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MessageSquareText size={11} className="text-app-text-muted" />
                                        {formatStat(video.danmaku || 0)}
                                    </span>
                                </div>
                            </div>

                            {/* Menu Icon (Absolute bottom right of container) */}
                            <div className="absolute bottom-0 right-0 text-app-text-muted p-1 -mr-2 -mb-2">
                                <MoreVertical size={16} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating Play Button */}
            <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-app-bg px-4 py-3 z-50">
                <button className="w-full h-10 bg-app-primary text-white rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm">
                    <MonitorPlay size={16} className="fill-white" />
                    <span className="text-[14px] font-medium">播放全部</span>
                </button>
            </div>
        </div>
    );
};
