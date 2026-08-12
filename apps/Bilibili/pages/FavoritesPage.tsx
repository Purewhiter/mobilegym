import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    IcNavBack, IcSearch, IcAdd, IcList, IcMonitorPlay, IcMessageSquareText,
    IcNavForward, IcStar,
} from '../res/icons';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useVideos } from '../hooks/useData';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';
import { useLocale } from '../locale';
import { formatBilibiliStat } from '../utils/localize';
import { BilibiliDanmakuIcon } from '../res/icons';
import type { BilibiliVideo } from '../types';

const Lock: React.FC<{ size?: number; className?: string }> = ({ size = 14, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

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

const FolderCard: React.FC<{
    folder: { id: string; title: string; isPublic?: boolean; videoIds?: string[] };
    videos: BilibiliVideo[];
    onTap: any;
}> = ({ folder, videos, onTap }) => {
    const s = useBilibiliStrings();
    const folderVideos = folder.videoIds
        ? videos.filter(v => folder.videoIds!.includes(v.id)).slice(0, 3)
        : [];
    const count = folder.videoIds?.length || 0;

    return (
        <div className="mb-6" {...onTap}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-medium text-app-text">{folder.title}</h3>
                </div>
                <div className="flex items-center gap-1 text-[12px] text-app-text-muted">
                    {!folder.isPublic && <Lock size={12} className="text-app-text-muted" />}
                    <span>· {s.stat_item_count.replace('{n}', String(count))}</span>
                    <IcNavForward size={14} className="text-gray-300" />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(i => (
                    <div key={i} className="aspect-[4/3] bg-[#F5F5F5] rounded-md overflow-hidden">
                        {folderVideos[i] && (
                            <img
                                src={folderVideos[i].cover}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        )}
                    </div>
                ))}
            </div>
            {folderVideos.length > 0 && (
                <div className="flex gap-2 mt-1.5">
                    {folderVideos.map(v => (
                        <div key={v.id} className="flex-1 min-w-0">
                            <p className="text-[11px] text-app-text-muted truncate">{v.title}</p>
                        </div>
                    ))}
                    {folderVideos.length < 3 && Array.from({ length: 3 - folderVideos.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="flex-1" />
                    ))}
                </div>
            )}
        </div>
    );
};

const VideoListItem: React.FC<{
    video: BilibiliVideo;
    onTap: any;
}> = ({ video, onTap }) => {
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
        <div className="flex flex-col justify-between flex-1 py-0.5 min-w-0">
            <div className="text-[14px] text-app-text leading-snug line-clamp-2">{video.title}</div>
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
        </div>
    </div>
    );
};

type FavTab = 'folders' | 'all' | 'video' | 'article';

export const FavoritesPage: React.FC = () => {
    const { bindBack, bindTap } = useBilibiliGestures();
    const s = useBilibiliStrings();
    const [searchParams] = useSearchParams();
    const user = useBilibiliStore(st => st.user);
    const VIDEO_DATA = useVideos();

    const activeTab = (searchParams.get('tab') as FavTab) || 'folders';

    const allVideoIds = new Set<string>();
    user.favoritesFolders?.forEach(f => f.videoIds?.forEach(id => allVideoIds.add(id)));
    const allFavVideos = VIDEO_DATA.filter(v => allVideoIds.has(v.id));

    const SUB_TABS: { key: FavTab; label: string }[] = [
        { key: 'folders', label: s.fav_tab_folders },
        { key: 'all', label: s.fav_tab_all },
        { key: 'video', label: s.fav_tab_video },
        { key: 'article', label: s.fav_tab_article },
    ];

    return (
        <div className="flex flex-col h-full bg-app-surface font-sans">
            {/* Header */}
            <div className="flex-shrink-0 bg-app-surface z-20">
                <div className="h-10" />
                <div className="flex items-center justify-center px-4 pb-1 relative">
                    <div {...bindBack()} className="absolute left-4 active:opacity-60 cursor-pointer">
                        <IcNavBack size={24} className="text-app-text" />
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-[17px] font-bold text-app-primary">{s.fav_title}</span>
                        <span className="text-[17px] text-app-text-muted">{s.fav_chase}</span>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex items-center px-4 pt-2 pb-1 border-b border-app-bg">
                    <div className="flex items-center gap-0 flex-1">
                        {SUB_TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            return (
                                <div
                                    key={tab.key}
                                    className={`px-3 py-2 text-[13px] font-medium rounded-full cursor-pointer transition-colors ${
                                        isActive
                                            ? 'bg-app-primary/10 text-app-primary'
                                            : 'text-app-text-muted'
                                    }`}
                                    {...(isActive ? {} : bindTap('favorites.tab.switch', { params: { tab: tab.key } }))}
                                >
                                    {tab.label}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-4 text-[#61666D] ml-2">
                        <IcSearch size={20} />
                        <IcAdd size={20} />
                        <IcList size={20} />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
                {activeTab === 'folders' && (
                    <div className="px-4 pt-4">
                        {user.favoritesFolders?.map(folder => (
                            <FolderCard
                                key={folder.id}
                                folder={folder}
                                videos={VIDEO_DATA}
                                onTap={bindTap('favFolderDetail.open', { params: { folderId: folder.id } })}
                            />
                        ))}
                    </div>
                )}

                {(activeTab === 'all' || activeTab === 'video') && (
                    <div>
                        {allFavVideos.length > 0 ? (
                            allFavVideos.map(video => (
                                <VideoListItem
                                    key={video.id}
                                    video={video}
                                    onTap={bindTap('video.open', { params: { bvid: video.id } })}
                                />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center pt-32 text-app-text-muted">
                                <IcStar size={48} className="mb-4 text-gray-200" />
                                <p className="text-[14px]">{s.fav_empty}</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'article' && (
                    <div className="flex flex-col items-center justify-center pt-32 text-app-text-muted">
                        <IcStar size={48} className="mb-4 text-gray-200" />
                        <p className="text-[14px]">{s.fav_empty_article}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
