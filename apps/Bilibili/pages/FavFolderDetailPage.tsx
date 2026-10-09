import React from 'react';
import {
    IcNavBack, IcSearch, IcMoreVertical, IcMonitorPlay, IcMessageSquareText,
    IcLike, IcStar, IcShare, IcList,
} from '../res/icons';
import { useParams } from 'react-router-dom';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useVideos } from '../hooks/useData';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';
import { useLocale } from '../locale';
import { formatBilibiliStat } from '../utils/localize';
import { BilibiliDanmakuIcon } from '../res/icons';
import type { BilibiliVideo } from '../types';

const formatDuration = (val: number | string | undefined) => {
    if (!val) return '00:00';
    if (typeof val === 'string' && val.includes(':')) return val;
    const seconds = typeof val === 'string' ? parseInt(val) : val;
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const VideoItem: React.FC<{ video: BilibiliVideo; onTap: any }> = ({ video, onTap }) => {
    const s = useBilibiliStrings();
    const locale = useLocale();
    const formatStat = (num: number | string | undefined) => formatBilibiliStat(num, locale);
    return (
    <div className="flex gap-3 px-4 py-3 active:bg-gray-50 transition-colors cursor-pointer" {...onTap}>
        <div className="w-[140px] aspect-video bg-app-bg rounded-md overflow-hidden relative shrink-0">
            <img src={video.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute bottom-1 right-1 text-white text-[10px] bg-black/50 px-1 rounded">
                {formatDuration(video.duration)}
            </div>
        </div>
        <div className="flex flex-col justify-between flex-1 py-0.5 min-w-0 relative">
            <div className="text-[14px] text-app-text leading-snug line-clamp-2 pr-4">{video.title}</div>
            <div className="mt-auto">
                <div className="text-[11px] text-app-text-muted flex items-center gap-1 mb-1">
                    <span className="border border-[#9499A0]/30 rounded-[2px] px-0.5 text-[9px] scale-90 origin-left">UP</span>
                    {video.author || s.common_up_badge}
                </div>
                <div className="text-[11px] text-app-text-muted flex items-center gap-3">
                    <span className="flex items-center gap-0.5">
                        <IcMonitorPlay size={12} />
                        {formatStat(video.plays)}
                    </span>
                    <span className="flex items-center gap-0.5">
                        <BilibiliDanmakuIcon size={11} />
                        {formatStat(video.danmaku || 0)}
                    </span>
                </div>
            </div>
            <div className="absolute bottom-0 right-0 text-app-text-muted p-1 -mr-1">
                <IcMoreVertical size={16} />
            </div>
        </div>
    </div>
    );
};

export const FavFolderDetailPage: React.FC = () => {
    const { bindBack, bindTap } = useBilibiliGestures();
    const s = useBilibiliStrings();
    const { folderId } = useParams();
    const user = useBilibiliStore(st => st.user);
    const VIDEO_DATA = useVideos();

    const folder = user.favoritesFolders?.find(f => f.id === folderId) || user.favoritesFolders?.[0];
    const videos = folder?.videoIds
        ? VIDEO_DATA.filter(v => folder.videoIds!.includes(v.id))
        : [];

    return (
        <div className="flex flex-col h-full bg-app-surface font-sans">
            {/* Header */}
            <div className="flex-shrink-0 bg-app-surface z-20">
                <div className="h-10" />
                <div className="flex items-center justify-between px-4 pb-2">
                    <div {...bindBack()} className="active:opacity-60 cursor-pointer">
                        <IcNavBack size={24} className="text-app-text" />
                    </div>
                    <div className="flex items-center gap-5 text-[#61666D]">
                        <IcSearch size={22} />
                        <IcList size={20} />
                        <IcMoreVertical size={22} />
                    </div>
                </div>
            </div>

            {/* Folder Info */}
            <div className="px-4 pt-5 pb-3 border-b border-app-bg">
                <h1 className="text-[20px] font-bold text-app-text mb-1">{folder?.title || s.fav_folder_default}</h1>
                <div className="flex items-center justify-between">
                    <div className="flex flex-col text-[12px] text-app-text-muted">
                        <span>{s.fav_folder_creator.replace('{name}', user.name)}</span>
                        <span>{s.stat_item_count.replace('{n}', String(videos.length))}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:opacity-60">
                            <IcLike size={20} className="text-[#61666D]" />
                            <span className="text-[10px] text-app-text-muted">{s.action_like}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:opacity-60">
                            <IcStar size={20} className="text-[#61666D]" />
                            <span className="text-[10px] text-app-text-muted">{s.action_fav}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:opacity-60">
                            <IcShare size={20} className="text-[#61666D]" />
                            <span className="text-[10px] text-app-text-muted">{s.action_share}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Video List */}
            <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
                {videos.map(video => (
                    <VideoItem
                        key={video.id}
                        video={video}
                        onTap={bindTap('video.open', { params: { bvid: video.id } })}
                    />
                ))}
                {videos.length === 0 && (
                    <div className="flex flex-col items-center justify-center pt-32 text-app-text-muted">
                        <IcStar size={48} className="mb-4 text-gray-200" />
                        <p className="text-[14px]">{s.fav_folder_empty}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
