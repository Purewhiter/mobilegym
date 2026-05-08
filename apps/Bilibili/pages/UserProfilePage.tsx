import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
    IcNavBack, IcSearch, IcMore, IcLightning, IcLightningOff, IcLocation, IcBadgeCheck, IcCheckCircle, IcExpand, IcClose,
    IcMonitorPlay, IcMessageSquareText, IcVideo, IcPlay, IcForward, IcLike, IcMessage,
    IcPlayCircle, IcFilter, IcPlaySquare, IcMoreVertical
} from '../res/icons';
const ChevronLeft = IcNavBack, Search = IcSearch, MoreHorizontal = IcMore, Zap = IcLightning, ZapOff = IcLightningOff, MapPin = IcLocation, BadgeCheck = IcBadgeCheck, CheckCircle2 = IcCheckCircle, ChevronDown = IcExpand, X = IcClose, MonitorPlay = IcMonitorPlay, MessageSquareText = IcMessageSquareText, Video = IcVideo, Play = IcPlay, Forward = IcForward, ThumbsUp = IcLike, MessageSquare = IcMessage, PlayCircle = IcPlayCircle, ListFilter = IcFilter, PlaySquare = IcPlaySquare, MoreVertical = IcMoreVertical;
import { useAuthors, useCommenters, useVideos } from '../hooks/useData';
import { useBilibiliStore } from '../state';
import { BILIBILI_CONFIG } from '../data';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import * as TimeService from '../../../os/TimeService';
const formatTime = (ts: number) => {
    const date = TimeService.fromTimestamp(ts * 1000);
    const now = TimeService.getDate();
    const diff = now.getTime() - date.getTime();

    // Less than 24 hours
    if (diff < 24 * 3600 * 1000) {
        if (date.getDate() === now.getDate()) return '今天';
        return '昨天';
    }
    // Less than 1 year
    if (now.getFullYear() === date.getFullYear()) {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

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

export const UserProfilePage: React.FC = () => {
    const { mid } = useParams<{ mid: string }>();
    const { bindBack, bindTap, back } = useBilibiliGestures();
    const [searchParams] = useSearchParams();

    const AUTHOR_DATA = useAuthors();
    const COMMENTER_DATA = useCommenters();
    const VIDEO_DATA = useVideos();

    const toggleFollow = useBilibiliStore(s => s.toggleFollow);
    const biliUser = useBilibiliStore(s => s.user);
    const toggleLike = useBilibiliStore(s => s.toggleLike);
    const checkIsFollowing = (targetMid: string) => {
        const m = String(targetMid || '');
        if (!m) return false;
        return (biliUser.followingList || []).some(u => String(u.mid) === m);
    };
    const isFollowed = checkIsFollowing(String(mid || ''));
    const [isScrolled, setIsScrolled] = useState(false);

    // “你可能感兴趣”面板：不进入 URL（localState/effects），由本地 state 驱动展示
    const [showSuggestionPanel, setShowSuggestionPanel] = useState(false);
    const showMenu = searchParams.get('menu') === 'true';

    const tabFromUrl = searchParams.get('tab');
    const activeTabKey: 'home' | 'dynamic' | 'works' | 'shop' =
        tabFromUrl === 'home' || tabFromUrl === 'dynamic' || tabFromUrl === 'works' || tabFromUrl === 'shop'
            ? tabFromUrl
            : 'works';

    const bindCloseSuggestions = () => {
        if (activeTabKey === 'home') {
            return bindTap({ kind: 'action', id: 'user.home.suggestions.close' }, { onTrigger: () => setShowSuggestionPanel(false) });
        }
        if (activeTabKey === 'dynamic') {
            return bindTap({ kind: 'action', id: 'user.dynamic.suggestions.close' }, { onTrigger: () => setShowSuggestionPanel(false) });
        }
        if (activeTabKey === 'shop') {
            return bindTap({ kind: 'action', id: 'user.shop.suggestions.close' }, { onTrigger: () => setShowSuggestionPanel(false) });
        }
        return bindTap({ kind: 'action', id: 'user.works.suggestions.close' }, { onTrigger: () => setShowSuggestionPanel(false) });
    };

    const bindFollowSubmit = (options?: { stopPropagation?: boolean; targetMid?: string }) => {
        const target = options?.targetMid ?? (mid || '');
        const stopPropagation = options?.stopPropagation ?? false;
        if (activeTabKey === 'home') {
            return bindTap(
                { kind: 'action', id: 'user.home.follow.submit' },
                { stopPropagation, onTrigger: () => { toggleFollow(target); setShowSuggestionPanel(true); } },
            );
        }
        if (activeTabKey === 'dynamic') {
            return bindTap(
                { kind: 'action', id: 'user.dynamic.follow.submit' },
                { stopPropagation, onTrigger: () => { toggleFollow(target); setShowSuggestionPanel(true); } },
            );
        }
        if (activeTabKey === 'shop') {
            return bindTap(
                { kind: 'action', id: 'user.shop.follow.submit' },
                { stopPropagation, onTrigger: () => { toggleFollow(target); setShowSuggestionPanel(true); } },
            );
        }
        return bindTap(
            { kind: 'action', id: 'user.works.follow.submit' },
            { stopPropagation, onTrigger: () => { toggleFollow(target); setShowSuggestionPanel(true); } },
        );
    };

    const closeMenu = () => back();

    const handleUnfollow = () => {
        toggleFollow(mid || '');
        closeMenu();
    };

    const author = AUTHOR_DATA[Number(mid)] || COMMENTER_DATA[Number(mid)];

    // Handle scroll for header transparency
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setIsScrolled(e.currentTarget.scrollTop > 50);
    };

    if (!author) {
        return (
            <div className="flex flex-col h-full bg-app-surface items-center justify-center">
                <div className="text-gray-400">正在获取用户信息...</div>
                <button
                    {...bindBack()}
                    className="mt-4 px-4 py-2 bg-gray-100 rounded-full text-sm"
                >
                    返回
                </button>
            </div>
        );
    }

    const { name, face, sign, level, vip, official, follower, following, likes, videos, live_room } = author;

    // Enrich videos with full stats from VIDEO_DATA
    const enrichedVideos = videos.map(v => {
        const fullVideo = VIDEO_DATA.find(vd => vd.id === v.id);
        if (fullVideo) {
            return { ...v, ...fullVideo };
        }
        return v;
    });

    const banner = author.top_photo?.startsWith('/cdn/') ? author.top_photo : '';

    return (
        <div className="flex flex-col h-full bg-app-surface relative" data-status-bar-foreground="light" onScroll={handleScroll}>
            {/* Header (Sticky/Fixed) */}
            <div
                className={`fixed top-0 left-0 right-0 z-50 pt-10 px-4 pb-2 flex items-center justify-between ${isScrolled ? 'bg-app-surface text-black shadow-sm' : 'bg-transparent text-white'
                    }`}
                style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
            >
                <button {...bindBack()} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-sm">
                    <ChevronLeft size={24} className="text-white" />
                </button>
                <div className="flex items-center gap-3">
                    <button className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-sm">
                        <Search size={20} className="text-white" />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-sm">
                        <MoreHorizontal size={20} className="text-white" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
                {/* Banner */}
                <div className="h-32 w-full relative">
                    {banner ? (
                        <img src={banner} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-sky-300 via-cyan-200 to-pink-200" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />
                </div>

                <div className="px-4 relative">
                    {/* Top Section: Avatar (Left) vs Stats/Buttons (Right) */}
                    <div className="flex justify-between items-start pb-2">
                        {/* Avatar (Overlapping Banner) */}
                        <div className="relative -mt-4">
                            <div className="w-20 h-20 rounded-full border-[3px] border-white overflow-hidden bg-app-surface relative z-10">
                                <img src={face} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                {vip?.status === 1 && (
                                    <div className="absolute bottom-0 right-0 w-6 h-6 bg-app-surface rounded-full flex items-center justify-center">
                                        <Zap size={14} className="text-app-primary fill-current" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Stats & Buttons */}
                        <div className="flex flex-col items-end gap-3 pt-2">
                            {/* Stats */}
                            <div className="flex items-center gap-5 text-app-text">
                                <div className="flex flex-col items-center">
                                    <span className="text-[15px] font-medium">{formatStat(follower)}</span>
                                    <span className="text-[11px] text-app-text-muted">粉丝</span>
                                </div>
                                <div className="w-[1px] h-3 bg-[#E3E5E7]" />
                                <div className="flex flex-col items-center">
                                    <span className="text-[15px] font-medium">{formatStat(following)}</span>
                                    <span className="text-[11px] text-app-text-muted">关注</span>
                                </div>
                                <div className="w-[1px] h-3 bg-[#E3E5E7]" />
                                <div className="flex flex-col items-center">
                                    <span className="text-[15px] font-medium">{formatStat(likes)}</span>
                                    <span className="text-[11px] text-app-text-muted">获赞</span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-2">
                                <button className="h-8 px-5 rounded-full bg-app-surface border border-app-primary text-app-primary flex items-center justify-center gap-1 font-medium text-[13px] active:bg-app-primary/5 transition-colors">
                                    <Zap size={14} fill="currentColor" /> 充电
                                </button>
                                {isFollowed ? (
                                    <div className="flex gap-1 h-8">
                                        <button
                                            className="h-full px-6 rounded-[4px] bg-[#E3E5E7] text-[#61666D] font-medium text-[13px] flex items-center justify-center active:bg-[#d0d3d6] transition-colors"
                                            {...bindTap('user.menu.open')}
                                        >
                                            已关注
                                        </button>
                                        <button
                                            className="h-full w-8 rounded-[4px] bg-[#E3E5E7] text-[#61666D] flex items-center justify-center active:bg-[#d0d3d6] transition-colors"
                                            {...(showSuggestionPanel
                                                ? bindCloseSuggestions()
                                                : { onClick: () => setShowSuggestionPanel(true) })}
                                        >
                                            <ChevronDown size={16} className={`${showSuggestionPanel ? 'rotate-180' : ''}`} style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="h-8 px-8 rounded-full bg-app-primary text-white flex items-center justify-center font-medium text-[13px] active:bg-app-primary/90 transition-colors shadow-sm shadow-[#FB7299]/20"
                                        {...bindFollowSubmit()}
                                    >
                                        关注
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Suggestion Panel */}
                    {showSuggestionPanel && (
                        <div className="mb-4 px-2">
                            <div className="flex justify-between items-center text-[13px] text-app-text-muted mb-2 px-1">
                                <span>你可能感兴趣</span>
                            </div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                {BILIBILI_CONFIG.recommendedUp.map(up => {
                                    const isUpFollowed = checkIsFollowing(up.id);
                                    const author = AUTHOR_DATA[Number(up.id)];
                                    const face = (author as any)?.face || '';
                                    const label =
                                        (author as any)?.official?.title ||
                                        (author as any)?.sign ||
                                        'UP主';
                                    return (
                                        <div
                                            key={up.name}
                                            {...bindTap('user.open', { params: { mid: up.id } })}
                                            className="w-[130px] bg-app-surface border border-[#E3E5E7] rounded-lg p-3 flex flex-col items-center shrink-0 relative shadow-sm active:opacity-90 transition-opacity"
                                        >
                                            {face ? (
                                                <img referrerPolicy="no-referrer" src={face} className="w-10 h-10 rounded-full mb-2 object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full mb-2 bg-gradient-to-br from-sky-100 to-pink-100" />
                                            )}
                                            <div className="text-[13px] font-medium text-app-text mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{up.name}</div>
                                            <div className="text-[10px] text-app-text-muted mb-3">{label}</div>
                                            <button
                                                className={`w-full h-7 rounded-full text-[12px] flex items-center justify-center font-medium transition-colors ${isUpFollowed
                                                    ? 'bg-[#E3E5E7] text-app-text-muted'
                                                    : 'border border-app-primary text-app-primary active:bg-pink-50'
                                                    }`}
                                                {...bindFollowSubmit({ stopPropagation: true, targetMid: up.id })}
                                            >
                                                {isUpFollowed ? '已关注' : '+ 关注'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Name & Badges & Info */}
                    <div className="flex flex-col gap-1 mb-4">
                        <div className="flex items-center gap-2">
                            <span className={`text-[19px] font-bold ${vip?.status === 1 ? 'text-app-primary' : 'text-app-text'}`}>
                                {name}
                            </span>
                            <span className={`text-[9px] px-1 rounded-sm text-white ${level >= 6 ? 'bg-[#FF0000]' : 'bg-app-primary'}`}>
                                LV{level}
                            </span>
                            {vip?.label && (
                                <span className="bg-app-primary text-white text-[10px] px-1.5 py-0.5 rounded-sm scale-90 origin-left">
                                    {vip.label}
                                </span>
                            )}
                        </div>

                        {/* Official / Auth */}
                        {official?.title && (
                            <div className="flex items-start gap-1 text-[12px] text-app-text">
                                <BadgeCheck size={14} className="text-[#F6B32D] mt-0.5 flex-shrink-0" fill="#F6B32D" color="white" />
                                <span className="leading-snug">bilibili UP主认证: {official.title}</span>
                            </div>
                        )}

                        {/* Desc */}
                        <div className="text-[12px] text-app-text-muted leading-relaxed whitespace-pre-wrap mt-1">
                            {sign || '这个人很懒，什么都没有写'}
                        </div>

                        {/* IP / UID */}
                        <div className="flex items-center gap-3 text-[11px] text-app-text-muted mt-1">
                            <div className="flex items-center gap-0.5">
                                <MapPin size={10} />
                                <span className="mr-0.5">IP属地:</span>{author.location || '未知'}
                            </div>
                            <div className="flex items-center gap-0.5">
                                <span>UID: {mid}</span>
                            </div>
                        </div>
                    </div>



                    {/* Tabs */}
                    <div className="flex items-center border-b border-[#E3E5E7] sticky top-0 bg-app-surface z-10 pt-1">
                        {[
                            { key: 'home', label: '主页' },
                            { key: 'dynamic', label: '动态' },
                            { key: 'works', label: '投稿' },
                            { key: 'shop', label: '小店' },
                        ].map(tab => {
                            const isActive = activeTabKey === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    {...(isActive ? {} : bindTap('user.tab.switch', { params: { tab: tab.key } }))}
                                    className={`flex-1 py-3 text-[14px] font-medium relative ${isActive ? 'text-app-primary' : 'text-[#61666D]'
                                        }`}
                                >
                                    {tab.label}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-app-primary rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content Area */}
                    <div className="bg-app-surface min-h-[500px]">
                        {activeTabKey === 'home' && (
                            <div className="pb-10">
                                {/* Video Section Header */}
                                <div
                                    className="px-3 py-3 flex justify-between items-center"
                                    {...bindTap('user.tab.switch', { params: { tab: 'works' } })}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-[15px] font-medium text-app-text">视频</span>
                                        <span className="text-[12px] text-app-text-muted bg-app-bg px-1.5 rounded-full">{enrichedVideos.length}</span>
                                    </div>
                                    <div className="text-[12px] text-app-text-muted flex items-center">
                                        查看更多 <ChevronLeft size={12} className="rotate-180" />
                                    </div>
                                </div>

                                {/* Video Grid */}
                                <div className="grid grid-cols-2 gap-2 px-2">
                                    {enrichedVideos.slice(0, 4).map(v => (
                                        <div key={v.id} className="flex flex-col gap-2" {...bindTap('video.open', { params: { bvid: v.id } })}>
                                            <div className="aspect-video rounded-lg overflow-hidden relative bg-gray-100">
                                                <img src={v.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                <div className="absolute bottom-1 left-1 text-white text-[10px] flex items-center gap-2 drop-shadow-md">
                                                    <div className="flex items-center gap-0.5">
                                                        <MonitorPlay size={10} />
                                                        <span>{formatStat(v.plays)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-0.5">
                                                        <MessageSquareText size={10} />
                                                        <span>{formatStat(v.raw?.stat?.reply || 0)}</span>
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-1 right-1 text-white text-[10px] bg-black/40 px-1 rounded">
                                                    {v.duration}
                                                </div>
                                            </div>
                                            <div className="text-[13px] text-app-text leading-snug line-clamp-2 h-[34px]">
                                                {v.title}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Live Status */}
                                <div className="mx-3 mt-6 mb-4 p-3 bg-[#F6F7F8] rounded-lg flex items-center justify-center gap-2 text-app-text-muted text-[13px]">
                                    <Video size={16} />
                                    <span>TA现在并没有直播，去订阅TA的直播</span>
                                </div>
                            </div>
                        )}

                        {activeTabKey === 'dynamic' && (
                            <div className="bg-app-bg">
                                {enrichedVideos.map(v => (
                                    <div key={v.id} className="bg-app-surface mb-2 p-4" {...bindTap('video.open', { params: { bvid: v.id } })}>
                                        {/* Header */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <img src={face} className="w-10 h-10 rounded-full border border-gray-100" referrerPolicy="no-referrer" />
                                            <div>
                                                <div className="text-[14px] font-medium text-app-primary">{name}</div>
                                                <div className="text-[11px] text-app-text-muted flex items-center gap-1">
                                                    {formatTime(v.date || (TimeService.now() / 1000))} · 投稿了视频
                                                </div>
                                            </div>
                                            <button className="ml-auto text-gray-300"><MoreHorizontal size={16} /></button>
                                        </div>

                                        {/* Video Cover */}
                                        <div className="aspect-video rounded-lg overflow-hidden relative bg-black/5 mb-3">
                                            <img src={v.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

                                            <div className="absolute bottom-2 left-2 text-white text-[12px] flex items-center gap-3 font-medium">
                                                <span>{v.duration}</span>
                                                <span>{formatStat(v.plays)}播放</span>
                                                <span>{formatStat(v.danmaku || v.raw?.stat?.danmaku || 0)}弹幕</span>
                                            </div>

                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100">
                                                <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                                    <Play size={20} className="text-white fill-white ml-1" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Title */}
                                        <div className="text-[15px] text-app-text mb-3 leading-snug line-clamp-1 font-medium">
                                            {v.title}
                                        </div>

                                        {/* Footer Stats */}
                                        <div className="flex items-center gap-16 text-gray-400 text-[13px]">
                                            <div className="flex items-center gap-1.5"><Forward size={18} /> <span>{formatStat(v.raw?.stat?.share || 0)}</span></div>
                                            <div className="flex items-center gap-1.5"><MessageSquare size={18} /> <span>{formatStat(v.raw?.stat?.reply || 0)}</span></div>
                                            <div 
                                                className="flex items-center gap-1.5 cursor-pointer active:scale-90 transition-transform"
                                                {...bindTap({ kind: 'action', id: 'user.dynamic.like.toggle' }, { stopPropagation: true, onTrigger: () => toggleLike(v.id) })}
                                            >
                                                <ThumbsUp size={18} /> <span>{formatStat(v.raw?.stat?.like || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTabKey === 'works' && (
                            <div>
                                {/* Action Bar */}
                                <div className="flex items-center justify-between px-4 py-2 border-b border-app-bg">
                                    <button className="flex items-center gap-1 text-app-primary text-[13px] font-medium">
                                        <PlayCircle size={16} /> 播放全部
                                    </button>
                                    <button className="flex items-center gap-1 text-[#61666D] text-[12px]">
                                        <ListFilter size={14} /> 最新发布
                                    </button>
                                </div>

                                {/* Video List */}
                                <div className="flex flex-col">
                                    {enrichedVideos.map(v => (
                                        <div key={v.id} className="flex gap-3 px-3 py-3 border-b border-app-bg active:bg-gray-50 bg-app-surface" {...bindTap('video.open', { params: { bvid: v.id } })}>
                                            {/* Left: Thumbnail */}
                                            <div className="relative w-[140px] h-[88px] rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                <img src={v.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                <div className="absolute bottom-1 right-1 text-white text-[10px] bg-black/40 px-1 rounded">
                                                    {v.duration}
                                                </div>
                                            </div>

                                            {/* Right: Info */}
                                            <div className="flex-1 flex flex-col min-w-0">
                                                <div className="text-[14px] text-app-text leading-snug line-clamp-2 mb-1 font-medium">
                                                    {v.title}
                                                </div>
                                                <div className="mt-auto flex flex-col gap-1">
                                                    <div className="text-[11px] text-app-text-muted">
                                                        {formatTime(v.date || (TimeService.now() / 1000))}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[11px] text-app-text-muted">
                                                        <div className="flex items-center gap-1">
                                                            <PlaySquare size={12} />
                                                            {formatStat(v.plays)}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <MessageSquareText size={12} />
                                                            {formatStat(v.raw?.stat?.reply || 0)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>


                                            <div className="pt-1">
                                                <MoreVertical size={14} className="text-gray-300" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTabKey === 'shop' && (
                            <div className="p-10 text-center text-gray-400 text-sm">暂无商品</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Unfollow Menu */}
            {showMenu && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/50" onClick={closeMenu} />
                    <div className="bg-app-surface rounded-t-xl z-20 overflow-hidden text-[15px]">
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" onClick={closeMenu}>加入特别关注</div>
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" onClick={closeMenu}>设置分组</div>
                        <div className="py-3.5 text-center text-app-primary border-b border-gray-100 active:bg-gray-50" onClick={handleUnfollow}>取消关注</div>
                        <div className="h-1.5 bg-app-bg" />
                        <div className="py-3.5 text-center text-app-text active:bg-gray-50" onClick={closeMenu}>取消</div>
                    </div>
                </div>
            )}
        </div>
    );
};
