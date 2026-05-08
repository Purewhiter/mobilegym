import React, { useState } from 'react';
import {
    IcNavBack, IcSearch, IcMore, IcSkin,
    IcUpload, IcMedal, IcGraduationCap, IcExpand, IcMonitorPlay
} from '../res/icons';
const ChevronLeft = IcNavBack, Search = IcSearch, MoreHorizontal = IcMore, Shirt = IcSkin, Upload = IcUpload, Medal = IcMedal, GraduationCap = IcGraduationCap, ChevronDown = IcExpand, MonitorPlay = IcMonitorPlay;
import { useSearchParams } from 'react-router-dom';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useVideos } from '../hooks/useData';
import { BilibiliDanmakuIcon } from '../res/icons';
// Helper functions (matching HomePage)
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

export const SpacePage: React.FC = () => {
    const { bindBack, bindTap } = useBilibiliGestures();
    const [searchParams] = useSearchParams();
    const user = useBilibiliStore(s => s.user);
    const [isDetailExpanded, setIsDetailExpanded] = useState(false);
    const VIDEO_DATA = useVideos();

    const hasAnime = (user.subscribedAnime?.length || 0) > 0;
    const activeTabFromUrl = (searchParams.get('tab') as 'home' | 'videos' | 'fav' | 'anime') || 'home';
    const activeTab = activeTabFromUrl === 'anime' && !hasAnime ? 'home' : activeTabFromUrl;
    const tabs = [
        { key: 'home', label: '主页' },
        { key: 'videos', label: '投稿' },
        { key: 'fav', label: '收藏' },
        ...(hasAnime ? [{ key: 'anime', label: '追番' }] : [])
    ];

    // Helper: Get folder cover from most recently added video in folder
    const getFolderCover = (folder: { id: string; cover?: string; videoIds?: string[] }) => {
        if (folder.videoIds && folder.videoIds.length > 0) {
            const latestVideoId = folder.videoIds[folder.videoIds.length - 1];
            const video = VIDEO_DATA.find(v => v.id === latestVideoId);
            if (video) return video.cover;
        }
        return folder.cover;
    };

    // Helper: Get anime info from VIDEO_DATA by ID
    const getAnimeInfo = (anime: { id: string; title?: string; cover?: string; updateInfo?: string }) => {
        const videoData = VIDEO_DATA.find(v => v.id === anime.id) as any;
        if (videoData) {
            return {
                id: anime.id,
                title: anime.title || videoData.title,
                cover: anime.cover || videoData.cover,
                updateInfo: anime.updateInfo || videoData.raw?.new_ep?.index_show || ''
            };
        }
        return anime;
    };

    return (
        <div className="flex flex-col h-full bg-app-surface relative font-sans overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical" data-status-bar-foreground="light">
            {/* Top Navigation (Transparent/Floating) */}
            <div className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-4 pt-12 pb-2">
                <div {...bindBack()} className="bg-black/30 w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md active:scale-95 transition-transform text-white">
                    <ChevronLeft size={20} />
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-black/30 w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md active:scale-95 transition-transform text-white">
                        <Search size={18} />
                    </div>
                    <div className="bg-black/30 w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md active:scale-95 transition-transform text-white">
                        <MoreHorizontal size={18} />
                    </div>
                </div>
            </div>

            {/* Banner Background */}
            <div className="h-32 w-full bg-[#fdebf7] relative overflow-hidden shrink-0">
                {/* Abstract background shapes */}
                <div className="absolute top-10 right-0 w-64 h-64 bg-gradient-to-br from-pink-200/50 to-purple-200/50 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-100/50 rounded-full blur-2xl"></div>
                {/* 3D-like elements placeholders */}
                <div className="absolute top-12 left-12 w-16 h-16 bg-white/20 rotate-12 rounded-xl backdrop-blur-sm"></div>
                <div className="absolute top-8 right-20 w-12 h-12 bg-pink-300/20 -rotate-12 rounded-full backdrop-blur-sm"></div>

                {/* Shirt/Skin Button (Absolute Bottom Right of Banner) */}
                <div className="absolute bottom-3 right-3 z-20">
                    <button className="w-8 h-8 rounded-[4px] bg-[#61666D]/90 text-white flex items-center justify-center">
                        <Shirt size={18} />
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-app-surface relative z-10 flex flex-col">
                {/* Header Info Section */}
                <div className="px-4 pb-2 bg-app-surface rounded-t-xl -mt-3 pt-3 relative">
                    {/* Top Row: Avatar + Stats/Buttons */}
                    <div className="flex items-start mb-3">
                        {/* Avatar (Overlapping banner slightly by negative margin on container if needed, but here we are inside the white part) */}
                        {/* Actually, to overlap, we need the avatar to be positioned absolute or with negative margin relative to the white container top */}
                        <div className="relative -top-10 w-20 h-20 rounded-full border-[3px] border-white bg-gray-100 overflow-hidden z-20 shrink-0 shadow-sm mr-4">
                            {user.avatar ? (
                                <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="w-full h-full bg-[#E3E5E7]" />
                            )}
                        </div>

                        {/* Right Side (Stats & Button) - Layout: Stats row, then Button row */}
                        <div className="flex-1 pt-1 flex flex-col gap-3">
                            {/* Stats */}
                            <div className="flex justify-around items-center px-2">
                                <div
                                    className="flex flex-col items-center gap-0.5 active:opacity-60 cursor-pointer"
                                    {...bindTap('userRelation.open', { params: { tab: 'fans' } })}
                                >
                                    <span className="text-app-text text-[15px] font-medium">{user.followersList?.length || 0}</span>
                                    <span className="text-app-text-muted text-[11px]">粉丝</span>
                                </div>
                                <div className="w-[1px] h-3 bg-gray-200"></div>
                                <div
                                    className="flex flex-col items-center gap-0.5 active:opacity-60 cursor-pointer"
                                    {...bindTap('userRelation.open', { params: { tab: 'follow' } })}
                                >
                                    <span className="text-app-text text-[15px] font-medium">{user.followingList?.length || 0}</span>
                                    <span className="text-app-text-muted text-[11px]">关注</span>
                                </div>
                                <div className="w-[1px] h-3 bg-gray-200"></div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-app-text text-[15px] font-medium">0</span>
                                    <span className="text-app-text-muted text-[11px]">获赞</span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex px-2">
                                <button
                                    {...bindTap('profileEdit.open')}
                                    className="flex-1 h-8 border border-app-primary text-app-primary text-[13px] font-medium rounded-[4px] flex items-center justify-center active:bg-pink-50"
                                >
                                    编辑资料
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Name & Badges */}
                    <div className="mb-2 mt-1">
                        <div className="flex items-center gap-2 mb-1.5">
                            <h1 className="text-[18px] font-semibold text-app-text">
                                {user.name || "xiaoming-ai"}
                            </h1>
                            <span className="bg-[#9499A0] text-white text-[10px] px-1.5 py-[1px] rounded-[2px] font-medium scale-90 origin-left">
                                大会员
                            </span>
                            <div className="flex items-center gap-1">
                                <span className="border border-[#9499A0]/30 text-app-text-muted text-[10px] px-1 py-[1px] rounded-[2px] flex items-center gap-0.5 scale-90 origin-left">
                                    <Medal size={10} /> 粉丝勋章
                                </span>
                                <span className="border border-[#9499A0]/30 text-app-text-muted text-[10px] px-1 py-[1px] rounded-[2px] flex items-center gap-0.5 scale-90 origin-left">
                                    <Medal size={10} /> 成就勋章
                                </span>
                            </div>
                        </div>

                        {/* Level */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] bg-[#C0C4CC] text-white px-1 rounded-[2px] font-bold italic">LV{user.level || 0}</span>
                            <div className="h-1 w-24 bg-[#E3E5E7] rounded-full overflow-hidden">
                                <div className="h-full w-0 bg-[#F3CB2B]"></div>
                            </div>
                            <span className="text-[10px] text-app-text-muted">0/1</span>
                        </div>
                    </div>

                    {/* Bio & Details Toggle */}
                    <div className="flex justify-between items-start mb-3">
                        <p className={`text-[13px] text-app-text leading-snug ${!isDetailExpanded ? 'line-clamp-1' : ''}`}>
                            {user.sign || "你好"}
                        </p>
                        <span
                            className="text-[#00A1D6] text-[13px] whitespace-nowrap ml-4 cursor-pointer"
                            onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                        >
                            {isDetailExpanded ? '收起' : '详情'}
                        </span>
                    </div>

                    {/* IP & School & UID */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-[11px] text-app-text-muted">
                            <span className="flex items-center gap-1">
                                <span className="bg-app-bg px-1.5 py-0.5 rounded-[2px]">IP属地：{user.ipLocation || '未知'}</span>
                            </span>
                            {user.school ? (
                                <span
                                    className="flex items-center gap-1.5 bg-app-bg px-2 py-0.5 rounded-[2px] text-[11px] text-app-text-muted cursor-pointer active:opacity-60"
                                    {...bindTap('schoolInfo.open')}
                                >
                                    <GraduationCap size={12} />
                                    {user.school}
                                </span>
                            ) : (
                                <span
                                    className="flex items-center gap-1 bg-app-bg px-1.5 py-0.5 rounded-full border border-dashed border-[#9499A0]/30 cursor-pointer active:opacity-60"
                                    {...bindTap('schoolInfo.open')}
                                >
                                    <span className="text-lg leading-none pb-0.5">+</span> 添加学校信息
                                </span>
                            )}
                        </div>

                        {/* UID - Only visible when expanded */}
                        {isDetailExpanded && (
                            <div className="text-[11px] text-app-text-muted flex items-center gap-1 pl-1">
                                <span className="bg-app-bg px-0.5 rounded-[2px] text-[9px] scale-90 origin-left">UID</span>
                                {user.uid}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center border-b border-app-bg sticky top-[60px] bg-app-surface z-10 px-0 mt-2 relative">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <div
                                key={tab.key}
                                {...(isActive ? {} : bindTap('space.tab.switch', { params: { tab: tab.key } }))}
                                className={`flex-1 flex justify-center py-3 text-[15px] font-medium relative transition-colors cursor-pointer ${isActive ? 'text-app-primary' : 'text-[#61666D]'}`}
                            >
                                {tab.label}
                                {isActive && (
                                    <div className="absolute bottom-0 w-4 h-0.5 bg-app-primary rounded-full" />
                                )}
                            </div>
                        );
                    })}


                </div>

                <div className="flex-1 bg-app-surface min-h-[400px]">
                    {/* Home Tab */}
                    {activeTab === 'home' && (
                        <div className="p-4 flex flex-col gap-6">
                            {/* 1. 收藏 (Favorites Preview) */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-[15px] text-app-text font-medium">收藏 <span className="text-app-text-muted text-[12px] font-normal">{user.favoritesFolders?.length || 0}</span></h3>
                                    <div className="flex items-center gap-1 text-app-text-muted text-[12px]" {...bindTap('space.tab.switch', { params: { tab: 'fav' } })}>
                                        查看更多 <ChevronLeft size={12} className="rotate-180" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {user.favoritesFolders?.slice(0, 2).map(folder => (
                                        <div key={folder.id} className="bg-app-surface rounded-md overflow-hidden border border-app-bg pb-2 cursor-pointer" {...bindTap('favoritesDetail.open', { params: { folderId: folder.id } })}>
                                            <div className="aspect-video bg-app-bg relative">
                                                {getFolderCover(folder) && <img src={getFolderCover(folder)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                                                <div className="absolute bottom-1 right-1 bg-black/40 text-white text-[10px] px-1 rounded flex items-center gap-0.5">
                                                    <div className="w-2 h-2 border-[1px] border-white rounded-[1px] flex items-center justify-center">
                                                        <div className="w-[3px] h-[4px] bg-app-surface translate-x-[0.5px]"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-2 mt-2">
                                                <div className="text-[13px] text-app-text truncate">{folder.title}</div>
                                                <div className="text-[11px] text-app-text-muted mt-0.5">{folder.videoIds?.length || 0}个内容 · {folder.isPublic ? '公开' : '私密'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 2. 追番 (Anime Preview) */}
                            {hasAnime && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-[15px] text-app-text font-medium">追番 <span className="text-app-text-muted text-[12px] font-normal">{user.subscribedAnime?.length || 0}</span></h3>
                                        <div className="flex items-center gap-1 text-app-text-muted text-[12px]" {...bindTap('space.tab.switch', { params: { tab: 'anime' } })}>
                                            查看更多 <ChevronLeft size={12} className="rotate-180" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {user.subscribedAnime?.slice(0, 3).map(anime => {
                                            const info = getAnimeInfo(anime);
                                            return (
                                                <div key={anime.id} className="cursor-pointer">
                                                    <div className="aspect-[3/4] bg-app-bg rounded-md overflow-hidden relative mb-2">
                                                        <img src={info.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                        <div className="absolute top-1 right-1 bg-app-primary text-white text-[10px] px-1 rounded-sm">
                                                            在追
                                                        </div>
                                                    </div>
                                                    <div className="text-[13px] text-app-text leading-snug line-clamp-1">{info.title}</div>
                                                    <div className="text-[11px] text-app-text-muted mt-0.5 truncate">{info.updateInfo}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 3. 最近点赞 (Recent Liked) */}
                            {user.likedVideoIds && user.likedVideoIds.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-[15px] text-app-text font-medium">最近点赞的视频</h3>
                                    <div className="flex items-center gap-1 text-app-text-muted text-[12px] cursor-pointer" {...bindTap('recentLikes.open')}>
                                        查看更多 <ChevronLeft size={12} className="rotate-180" />
                                    </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {VIDEO_DATA.filter(v => user.likedVideoIds?.includes(v.id)).slice(0, 2).map(v => (
                                            <div key={v.id} className="bg-app-surface rounded-md overflow-hidden border border-app-bg pb-2 cursor-pointer" {...bindTap('video.open', { params: { bvid: v.id } })}>
                                                <div className="aspect-video bg-app-bg relative">
                                                    <img src={v.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    {/* Overlays */}
                                                    <div className="absolute bottom-0 left-0 right-0 p-1.5 pt-4 bg-gradient-to-t from-black/60 to-transparent flex justify-between items-end">
                                                        <div className="flex items-center gap-2 text-white text-[10px]">
                                                            <div className="flex items-center gap-0.5">
                                                                <MonitorPlay size={10} />
                                                                {formatStat(v.plays)}
                                                            </div>
                                                            <div className="flex items-center gap-0.5">
                                                                <BilibiliDanmakuIcon className="scale-75 text-white" />
                                                                {formatStat(v.danmaku)}
                                                            </div>
                                                        </div>
                                                        <div className="text-white text-[10px]">
                                                            {formatDuration(v.duration)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="px-2 mt-2">
                                                    <div className="text-[13px] text-app-text line-clamp-2 h-[38px] leading-snug">{v.title}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Videos Tab */}
                    {activeTab === 'videos' && (
                        <div className="flex flex-col items-center mt-20">
                            <div className="w-16 h-16 rounded-full bg-app-bg flex items-center justify-center text-app-text-muted mb-4">
                                <Upload size={28} />
                            </div>
                            <p className="text-app-text-muted text-[13px] mb-8">发布第一个视频，领新人福利</p>
                            <button className="px-10 py-2 border border-app-primary text-app-primary rounded-full text-[14px] font-medium mb-4">
                                我要投稿
                            </button>
                            <div className="text-[#00A1D6] text-[12px] flex items-center gap-0.5">
                                去创作中心领奖 <ChevronLeft size={10} className="rotate-180" />
                            </div>
                        </div>
                    )}

                    {/* Favorites Tab */}
                    {activeTab === 'fav' && (
                        <div>
                            <div className="bg-app-surface sticky top-[105px] z-10 px-4 py-3 flex items-center justify-between border-b border-app-bg">
                                <div className="flex items-center gap-1 text-[13px] text-app-text">
                                    <ChevronDown size={14} className="text-app-text" />
                                    我创建的收藏夹 <span className="text-app-text-muted text-[11px] ml-1">{user.favoritesFolders?.length || 0}</span>
                                </div>
                            </div>
                            <div className="px-4">
                                                {user.favoritesFolders?.map(folder => (
                                    <div key={folder.id} className="flex gap-3 py-3 border-b border-app-bg last:border-0 cursor-pointer" {...bindTap('favoritesDetail.open', { params: { folderId: folder.id } })}>
                                        <div className="w-28 aspect-video bg-app-bg rounded-[4px] overflow-hidden relative shrink-0">
                                            {getFolderCover(folder) && <img src={getFolderCover(folder)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                                        </div>
                                        <div className="flex flex-col justify-between py-0.5 flex-1">
                                            <div className="text-[14px] text-app-text">{folder.title}</div>
                                            <div className="text-[11px] text-app-text-muted">{folder.videoIds?.length || 0}个内容 · {folder.isPublic ? '公开' : '私密'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="h-2 bg-app-bg/50"></div>
                            <div className="bg-app-surface px-4 py-3 flex items-center gap-1 text-[13px] text-app-text opacity-60">
                                <ChevronDown size={14} className="-rotate-90" />
                                我的收藏与订阅 <span className="text-app-text-muted text-[11px] ml-1">0</span>
                            </div>
                        </div>
                    )}

                    {/* Anime Tab */}
                    {activeTab === 'anime' && (
                        <div className="p-3 grid grid-cols-3 gap-3">
                            {user.subscribedAnime?.map(anime => {
                                const info = getAnimeInfo(anime);
                                return (
                                    <div key={anime.id} className="cursor-pointer">
                                        <div className="aspect-[3/4] bg-app-bg rounded-md overflow-hidden relative mb-2">
                                            <img src={info.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            <div className="absolute top-1 right-1 bg-app-primary text-white text-[10px] px-1 rounded-sm">
                                                在追
                                            </div>
                                        </div>
                                        <div className="text-[13px] text-app-text leading-snug line-clamp-1">{info.title}</div>
                                        <div className="text-[11px] text-app-text-muted mt-0.5 truncate">{info.updateInfo}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
