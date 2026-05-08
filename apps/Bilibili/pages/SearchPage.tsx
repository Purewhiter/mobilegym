// ----- Imports -----
import React, { useState, useMemo, useEffect } from 'react';
import { IcNavBack, IcNavForward, IcSearch, IcClose, IcDelete, IcRefresh, IcEye, IcFlame, IcPlayCircle, IcHeart, IcMenu } from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward, Search = IcSearch, X = IcClose, Trash2 = IcDelete, RefreshCw = IcRefresh, Eye = IcEye, Flame = IcFlame, PlayCircle = IcPlayCircle, Heart = IcHeart, Menu = IcMenu;
import { useLocation, useSearchParams } from 'react-router-dom';
import { useVideos, useAuthors, useRankings } from '../hooks/useData';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useVirtualList } from '../../../os/hooks/useVirtualList';
import { useLocale } from '@/apps/Bilibili/locale';
import { formatBilibiliSearchDate, formatBilibiliStat } from '../utils/localize';
// ----- Utils -----
// ----- Utils -----
const formatDuration = (d: any) => {
    if (!d) return '00:00';
    if (typeof d === 'number') {
        const m = Math.floor(d / 60);
        const s = d % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    if (typeof d === 'string' && !d.includes(':')) {
        const sec = parseInt(d);
        if (!isNaN(sec)) {
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        }
    }
    return d;
};

// ----- Icons -----
const NewIcon: React.FC<{ label: string }> = ({ label }) => (
    <span className="bg-[#FF6699] text-white text-[10px] px-1 rounded-[2px] ml-1">{label}</span>
);

const HotIcon: React.FC<{ label: string }> = ({ label }) => (
    <span className="bg-[#FF4D4F] text-white text-[10px] px-1 rounded-[2px] ml-1">{label}</span>
);

// ----- Mock Data -----
const HOT_SEARCHES = [
    { query: '湖人双杀灰熊', titleZh: '湖人双杀灰熊', titleEn: 'Lakers sweep the Grizzlies', tag: 'new' },
    { query: '我国首次航天员洞穴训练', titleZh: '我国首次航天员洞穴训练', titleEn: 'China holds its first astronaut cave drill', tag: 'hot' },
    { query: '曼城1-1切尔西', titleZh: '曼城1-1切尔西', titleEn: 'Manchester City 1-1 Chelsea', tag: '' },
    { query: '高中生一命速通学考', titleZh: '高中生一命速通学考', titleEn: 'Student speedruns the school exam', tag: 'new' },
    { query: '印度空气污染有多严重', titleZh: '印度空气污染有多严重', titleEn: 'How bad is India\'s air pollution?', tag: 'hot' },
    { query: '美国为何觊觎委内瑞拉石油', titleZh: '美国为何觊觎委内瑞拉石油', titleEn: 'Why the US wants Venezuela\'s oil', tag: '' },
    { query: 'B站AI大赛开始了', titleZh: 'B站AI大赛开始了', titleEn: 'The Bilibili AI contest is live', tag: 'new' },
    { query: '樊振东收获留洋生涯首冠', titleZh: '樊振东收获留洋生涯首冠', titleEn: 'Fan Zhendong wins his first overseas title', tag: '' },
    { query: '宇树机器人空翻踢爆气球', titleZh: '宇树机器人空翻踢爆气球', titleEn: 'Unitree robot flips and pops a balloon', tag: '' },
    { query: '玩机器 2025玩LTV', titleZh: '玩机器 2025玩LTV', titleEn: 'Wanjiji 2025 plays LTV', tag: 'meme' },
];

const DISCOVERY_ITEMS = [
    { query: '君茹呀', titleZh: '君茹呀', titleEn: 'Junruya', infoZh: '3天前更新', infoEn: 'Updated 3 days ago' },
    { query: '何同学工作室', titleZh: '何同学工作室', titleEn: 'Mr. He Studio', infoZh: '3天前更新', infoEn: 'Updated 3 days ago' },
    { query: '探马-再见', titleZh: '探马-再见', titleEn: 'Tanma - Goodbye', infoZh: '7小时前更新', infoEn: 'Updated 7 hours ago' },
    { query: '食贫道', titleZh: '食贫道', titleEn: 'Shipindao', infoZh: '2天前更新', infoEn: 'Updated 2 days ago' },
    { query: '10年暴跌180亿', titleZh: '10年暴跌180亿', titleEn: '180 billion lost in 10 years', infoZh: '营养快线...', infoEn: 'Nutrient Express...' },
    { query: '幻梦动力', titleZh: '幻梦动力', titleEn: 'Dream Motion', infoZh: '19小时前更新', infoEn: 'Updated 19 hours ago' },
    { query: '马督工', titleZh: '马督工', titleEn: 'Ma Dugong', infoZh: '19小时前更新', infoEn: 'Updated 19 hours ago' },
    { query: '夹逼定理证明', titleZh: '夹逼定理证明', titleEn: 'Squeeze theorem proof', infoZh: '', infoEn: '' },
];

// ----- Helper Components -----

const MediaResultItem: React.FC<{ item: any; type: 'anime' | 'movie' }> = ({ item, type }) => {
    const { bindTap } = useBilibiliGestures();
    const locale = useLocale();
    const toggleAnime = useBilibiliStore(s => s.toggleAnime);
    const toggleDrama = useBilibiliStore(s => s.toggleDrama);
    const biliUser = useBilibiliStore(s => s.user);
    const isAnimeSubscribed = (id: string) => (biliUser.subscribedAnime || []).some(a => a.id === id);
    const isDramaSubscribed = (id: string) => (biliUser.subscribedDramas || []).some(d => d.id === id);

    const score = item.score ? (typeof item.score === 'number' ? item.score.toFixed(1) : item.score) : '9.4';
    const participation = item.danmaku
        ? `${formatBilibiliStat(item.danmaku, locale)}${locale === 'en' ? ' participating' : '人参与'}`
        : (locale === 'en' ? '12K participating' : '1.2万人参与');

    // Use real badge if available
    const badgeTextRaw = item.raw?.badge || item.partition || (type === 'anime' ? '番剧' : '电影');
    const badgeText = locale === 'en'
        ? ({
            '番剧': 'Anime',
            '电影': 'Movie',
            '电视剧': 'TV',
            '纪录片': 'Documentary',
            '国创': 'C-animation',
          } as Record<string, string>)[badgeTextRaw] ?? badgeTextRaw
        : badgeTextRaw;
    const badgeColor = item.raw?.badge_info?.bg_color || '#FB7299';

    // Mock Tags/Year/Region (not consistently present in raw data)
    const tags = locale === 'en'
        ? (type === 'anime' ? 'Original / Action / Fantasy' : 'Drama / Adventure / Sci-fi')
        : (type === 'anime' ? '原创/热血/奇幻/战斗' : '剧情/冒险/科幻');
    const year = '2025';
    const region = locale === 'en' ? 'Mainland China' : '中国大陆';

    // Check if subscribed
    const isSubscribed = type === 'anime' ? isAnimeSubscribed(item.id) : isDramaSubscribed(item.id);

    return (
        <div
            {...bindTap('video.open', { params: { bvid: item.id } })}
            className="flex gap-3 px-4 py-3 border-b border-gray-100 bg-app-surface items-start"
        >
            <div className="relative w-[85px] aspect-[3/4] rounded-[4px] overflow-hidden shrink-0 bg-gray-100">
                <img referrerPolicy="no-referrer" src={item.cover} className="w-full h-full object-cover" />
                <div
                    className="absolute top-0 right-0 text-white text-[10px] px-1.5 py-0.5 rounded-bl-[4px] font-medium"
                    style={{ backgroundColor: badgeColor }}
                >
                    {badgeText}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 h-[113px] justify-between py-0.5">
                <div>
                    <h3 className="text-[14px] font-bold text-app-text leading-snug mb-1 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: item.highlightedTitle || item.title }}
                    />
                    <div className="text-[11px] text-app-text-muted leading-normal flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                            <span className="border border-[#23C9ED] text-[#23C9ED] text-[9px] px-0.5 rounded-[2px] leading-none">{locale === 'en' ? 'Official' : '出品'}</span>
                            <span>{year} | {region}</span>
                        </div>
                        <div>{tags}</div>
                    </div>
                </div>

                <div className="flex items-end gap-1">
                    <span className="text-[#FF6600] text-[16px] font-bold leading-none">{score}{locale === 'en' ? '' : '分'}</span>
                    <span className="text-app-text-muted text-[11px] relative top-[1px]">{participation}</span>
                </div>
            </div>

            <div className="flex flex-col gap-2 justify-center shrink-0 self-center">
                <button className="bg-app-primary text-white text-[12px] w-[72px] h-(--app-follow-btn-height) rounded-full font-medium flex items-center justify-center">
                    {locale === 'en' ? 'Watch now' : '立即观看'}
                </button>
                <button
                    {...bindTap(
                        { kind: 'action', id: 'search.media.subscribe.toggle' },
                        {
                            stopPropagation: true,
                            params: { id: item.id, type },
                            onTrigger: () => {
                                if (type === 'anime') {
                                    toggleAnime(item.id, item.title);
                                } else {
                                    toggleDrama(item.id, item.title);
                                }
                            },
                        },
                    )}
                    className={`text-[12px] w-[72px] h-(--app-follow-btn-height) rounded-full font-medium flex items-center justify-center gap-1 transition-colors ${isSubscribed
                        ? 'bg-[#F6F7F8] text-app-text-muted border border-[#E3E5E7]'
                        : 'border border-app-primary text-app-primary'
                        }`}
                >
                    <Heart size={12} className={isSubscribed ? 'fill-[#9499A0]' : ''} />
                    {isSubscribed
                        ? (type === 'anime' ? (locale === 'en' ? 'Following anime' : '已追番') : (locale === 'en' ? 'Following drama' : '已追剧'))
                        : (type === 'anime' ? (locale === 'en' ? 'Follow anime' : '追番') : (locale === 'en' ? 'Follow drama' : '追剧'))}
                </button>
            </div>
        </div>
    );
};

const RichUserCard: React.FC<{ user: any; videoById: Map<string, any> }> = ({ user, videoById }) => {
    const { bindTap } = useBilibiliGestures();
    const locale = useLocale();
    const toggleFollow = useBilibiliStore(s => s.toggleFollow);
    const biliUser = useBilibiliStore(s => s.user);
    const isFollowing = (id: string | number) => {
        const mid = String(id);
        return (biliUser.followingList || []).some(u => String(u.mid) === mid);
    };
    const [showMenu, setShowMenu] = useState(false);

    // Hydrate videos
    const recentVideos = (user.videos || []).slice(0, 3).map((v: any) => {
        const fullVideo = videoById.get(v.id);
        return fullVideo || v;
    });

    return (
        <div className="border-b border-gray-100 pb-4 mb-2 bg-app-surface relative">
            {/* User Header */}
            <div
                {...bindTap('user.open', { params: { mid: user.mid } })}
                className="flex items-center justify-between p-4 active:bg-gray-50"
            >
                <div className="flex items-center gap-3">
                    <div className="w-[54px] h-[54px] rounded-full overflow-hidden border border-gray-100 relative shrink-0">
                        <img referrerPolicy="no-referrer" src={user.face} className="w-full h-full object-cover" />
                        {user.official?.role === 1 && (
                            <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#FDB025] rounded-full border-2 border-white flex items-center justify-center">
                                <span className="text-white text-[9px] font-bold">⚡</span>
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[17px] text-app-primary font-medium" dangerouslySetInnerHTML={{ __html: user.highlightedName || user.name }}></span>
                            <span className={`text-[9px] px-1 rounded-[2px] border ${user.level >= 6 ? 'border-[#FF0000] text-[#FF0000]' : 'border-[#9499A0] text-app-text-muted'}`}>
                                LV{user.level}
                            </span>
                        </div>
                        <div className="text-[12px] text-app-text-muted mb-0.5">
                            {formatBilibiliStat(user.follower, locale)}{locale === 'en' ? ' followers' : '粉丝'} · {user.videos?.length || 0}{locale === 'en' ? ' videos' : '个视频'}
                        </div>
                        <div className="text-[12px] text-app-text-muted">
                            {user.official?.title || user.sign || (locale === 'en' ? 'Notable bilibili creator' : 'bilibili 知名UP主')}
                        </div>
                    </div>
                </div>

                {isFollowing(user.mid) ? (
                    <button
                        {...bindTap(
                            { kind: 'action', id: 'search.user.menu.open' },
                            { stopPropagation: true, onTrigger: () => setShowMenu(true) },
                        )}
                        className="h-8 w-[92px] rounded-full bg-[#E3E5E7] text-[#61666D] flex items-center justify-center gap-1 font-medium text-[13px] whitespace-nowrap leading-none active:bg-[#d0d3d6] transition-colors flex-none"
                    >
                        <Menu size={14} />
                        <span style={{ writingMode: 'horizontal-tb' }}>{locale === 'en' ? 'Following' : '已关注'}</span>
                    </button>
                ) : (
                    <button
                        {...bindTap(
                            { kind: 'action', id: 'search.user.follow.toggle' },
                            {
                                stopPropagation: true,
                                params: { mid: String(user.mid) },
                                onTrigger: () => toggleFollow(String(user.mid)),
                            },
                        )}
                    className="h-8 w-[92px] rounded-full bg-app-primary text-white flex items-center justify-center font-medium text-[13px] whitespace-nowrap leading-none active:bg-app-primary/90 shadow-sm shadow-[#FB7299]/20 flex-none"
                >
                    <span style={{ writingMode: 'horizontal-tb' }}>{locale === 'en' ? '+ Follow' : '+ 关注'}</span>
                </button>
            )}
            </div>

            {/* Videos Row */}
            {recentVideos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 px-3">
                    {recentVideos.map((v: any) => (
                        <div
                            key={v.id}
                            {...bindTap('video.open', { params: { bvid: v.id } })}
                            className="flex flex-col gap-1.5"
                        >
                            <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden bg-gray-100">
                                <img
                                    referrerPolicy="no-referrer"
                                    src={v.cover || user.top_photo || user.avatar}
                                    className="w-full h-full object-cover"
                                />
                                {/* Bottom Left: Play Count (No Duration on Bottom Right) */}
                                <div className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded-[2px] bg-black/40 backdrop-blur-[1px]">
                                    <PlayCircle size={10} className="text-white" />
                                    <span className="text-white text-[10px] leading-none">{formatBilibiliStat(v.plays, locale)}</span>
                                </div>
                            </div>
                            <div className="text-[13px] text-app-text leading-snug line-clamp-2 h-[38px]">
                                {v.title}
                            </div>
                            <div className="text-[11px] text-app-text-muted">
                                {formatBilibiliSearchDate(v.date, locale)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* View All */}
            <div
                {...bindTap('user.open', { params: { mid: user.mid } })}
                className="flex items-center justify-center gap-1 text-[13px] text-app-text-muted mt-3 active:bg-gray-50 py-2"
            >
                {locale === 'en' ? `View all ${user.videos?.length || 0} videos` : `查看全部${user.videos?.length || 0}个视频`}
                <ChevronRight size={14} />
            </div>

            {/* Unfollow Menu Overlay */}
            {showMenu && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end text-base">
                    <div
                        className="absolute inset-0 bg-black/50"
                        {...bindTap(
                            { kind: 'action', id: 'search.user.menu.close' },
                            { stopPropagation: true, onTrigger: () => setShowMenu(false) },
                        )}
                    />
                    <div className="bg-app-surface rounded-t-xl z-20 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" onClick={() => setShowMenu(false)}>{locale === 'en' ? 'Add to special follows' : '加入特别关注'}</div>
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" onClick={() => setShowMenu(false)}>{locale === 'en' ? 'Set group' : '设置分组'}</div>
                        <div
                            className="py-3.5 text-center text-app-primary border-b border-gray-100 active:bg-gray-50"
                            {...bindTap(
                                { kind: 'action', id: 'search.user.follow.toggle' },
                                {
                                    onTrigger: () => {
                                        toggleFollow(String(user.mid));
                                        setShowMenu(false);
                                    },
                                },
                            )}
                        >
                            {locale === 'en' ? 'Unfollow' : '取消关注'}
                        </div>
                        <div className="h-1.5 bg-app-bg" />
                        <div className="py-3.5 text-center text-app-text active:bg-gray-50" onClick={() => setShowMenu(false)}>{locale === 'en' ? 'Cancel' : '取消'}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

const VideoResultItem: React.FC<{ video: any; authorByName: Map<string, any> }> = ({ video, authorByName }) => {
    const { bindTap } = useBilibiliGestures();
    const locale = useLocale();

    // Find author info if possible, otherwise use video.author
    const authorInfo = authorByName.get(video.author || '');
    const authorFace = authorInfo?.face || video.face || '';

    return (
        <div
            {...bindTap('video.open', { params: { bvid: video.id } })}
            className="flex gap-3 py-3 border-b border-gray-100 active:bg-gray-50 px-4"
        >
            <div className="relative w-[140px] h-(--app-video-card-thumbnail-height) rounded-md overflow-hidden shrink-0">
                <img referrerPolicy="no-referrer" src={video.cover} className="w-full h-full object-cover" />
                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded-[2px]">
                    {formatDuration(video.duration)}
                </div>
            </div>
            <div className="flex-1 flex flex-col justify-between py-0.5">
                <h3 className="text-[14px] text-app-text line-clamp-2 leading-snug" dangerouslySetInnerHTML={{ __html: video.highlightedTitle || video.title }}></h3>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-app-text-muted">
                        {authorFace && <img referrerPolicy="no-referrer" src={authorFace} className="w-3.5 h-3.5 rounded-full" />}
                        <span>{video.author}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-app-text-muted">
                        <span>{formatBilibiliStat(video.plays, locale)} {locale === 'en' ? 'views' : '播放'}</span>
                        <span>·</span>
                        <span>{formatBilibiliSearchDate(video.date || video.pubdate, locale)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const UserResultItem: React.FC<{ user: any }> = ({ user }) => {
    const { bindTap } = useBilibiliGestures();
    const locale = useLocale();
    const toggleFollow = useBilibiliStore(s => s.toggleFollow);
    const biliUser = useBilibiliStore(s => s.user);
    const isFollowing = (id: string | number) => {
        const mid = String(id);
        return (biliUser.followingList || []).some(u => String(u.mid) === mid);
    };
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div
            {...bindTap('user.open', { params: { mid: user.mid } })}
            className="flex items-center justify-between py-4 border-b border-gray-100 px-4 active:bg-gray-50 relative"
        >
            <div className="flex items-center gap-3">
                <div className="w-[50px] h-[50px] rounded-full overflow-hidden border border-gray-100 relative">
                    <img referrerPolicy="no-referrer" src={user.face} className="w-full h-full object-cover" />
                    {user.official?.role === 1 && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-app-primary rounded-full border-2 border-white flex items-center justify-center">
                            <span className="text-white text-[8px] font-bold">⚡</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[15px] text-app-text font-medium" dangerouslySetInnerHTML={{ __html: user.highlightedName || user.name }}></span>
                        <span className={`text-[9px] px-1 rounded-[2px] border ${user.level >= 6 ? 'border-[#FF0000] text-[#FF0000]' : 'border-[#9499A0] text-app-text-muted'}`}>
                            LV{user.level}
                        </span>
                    </div>
                    <div className="text-[11px] text-app-text-muted">
                        <span>{formatBilibiliStat(user.follower, locale)}{locale === 'en' ? ' followers' : '粉丝'}</span>
                        <span className="mx-1">·</span>
                        <span>{user.videos?.length || 0}{locale === 'en' ? ' videos' : '个视频'}</span>
                    </div>
                    {user.sign && (
                        <div className="text-[11px] text-app-text-muted line-clamp-1 w-[180px]">
                            {user.sign}
                        </div>
                    )}
                </div>
            </div>

            {isFollowing(user.mid) ? (
                <button
                    {...bindTap(
                        { kind: 'action', id: 'search.user.menu.open' },
                        { stopPropagation: true, onTrigger: () => setShowMenu(true) },
                    )}
                    className="h-7 w-[86px] rounded-full bg-[#E3E5E7] text-[#61666D] flex items-center justify-center gap-1 font-medium text-[12px] whitespace-nowrap leading-none active:bg-[#d0d3d6] transition-colors flex-none"
                >
                    <Menu size={12} />
                    <span style={{ writingMode: 'horizontal-tb' }}>{locale === 'en' ? 'Following' : '已关注'}</span>
                </button>
            ) : (
                <button
                    {...bindTap(
                        { kind: 'action', id: 'search.user.follow.toggle' },
                        {
                            stopPropagation: true,
                            params: { mid: String(user.mid) },
                            onTrigger: () => toggleFollow(String(user.mid)),
                        },
                    )}
                    className="h-7 w-[86px] rounded-full bg-app-primary text-white flex items-center justify-center font-medium text-[12px] whitespace-nowrap leading-none active:bg-app-primary/90 shadow-sm shadow-[#FB7299]/20 flex-none"
                >
                    <span style={{ writingMode: 'horizontal-tb' }}>{locale === 'en' ? '+ Follow' : '+ 关注'}</span>
                </button>
            )}

            {/* Unfollow Menu Overlay */}
            {showMenu && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end text-base cursor-default">
                    <div
                        className="absolute inset-0 bg-black/50"
                        {...bindTap(
                            { kind: 'action', id: 'search.user.menu.close' },
                            { stopPropagation: true, onTrigger: () => setShowMenu(false) },
                        )}
                    />
                    <div className="bg-app-surface rounded-t-xl z-20 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" onClick={() => setShowMenu(false)}>{locale === 'en' ? 'Add to special follows' : '加入特别关注'}</div>
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" onClick={() => setShowMenu(false)}>{locale === 'en' ? 'Set group' : '设置分组'}</div>
                        <div
                            className="py-3.5 text-center text-app-primary border-b border-gray-100 active:bg-gray-50"
                            {...bindTap(
                                { kind: 'action', id: 'search.user.follow.toggle' },
                                {
                                    onTrigger: () => {
                                        toggleFollow(String(user.mid));
                                        setShowMenu(false);
                                    },
                                },
                            )}
                        >
                            {locale === 'en' ? 'Unfollow' : '取消关注'}
                        </div>
                        <div className="h-1.5 bg-app-bg" />
                        <div className="py-3.5 text-center text-app-text active:bg-gray-50" onClick={() => setShowMenu(false)}>{locale === 'en' ? 'Cancel' : '取消'}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SearchNotFound: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex flex-col items-center justify-center pt-20 text-app-text-muted">
        <div className="w-[160px] h-[110px] opacity-60 mb-4 rounded-2xl bg-gradient-to-br from-sky-100 to-pink-100 flex items-center justify-center">
            <Search size={40} className="text-app-primary/60" />
        </div>
        <p className="text-[13px]">{text}</p>
    </div>
);

const AnimeResultsPane: React.FC<{ items: any[] }> = ({ items }) => {
    const locale = useLocale();
    const animeVirtual = useVirtualList({
        items,
        estimateSize: () => 136,
        overscan: 5,
        paddingEnd: 40,
        getItemKey: (index, item) => item.id || `search-anime-${index}`,
    });

    return (
        <div
            ref={animeVirtual.parentRef}
            className="flex-1 overflow-y-auto bg-app-surface"
            data-scroll-container="main"
            data-scroll-direction="vertical"
        >
            {items.length === 0 ? (
                <SearchNotFound text={locale === 'en' ? 'No matching anime found' : '没有找到相关番剧'} />
            ) : (
                <div style={{ height: animeVirtual.totalSize, width: '100%', position: 'relative' }}>
                    {animeVirtual.virtualItems.map((vItem) => {
                        const item = items[vItem.index];
                        if (!item) return null;
                        return (
                            <div
                                key={vItem.key}
                                ref={animeVirtual.virtualizer.measureElement}
                                data-index={vItem.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${vItem.start}px)`,
                                }}
                            >
                                <MediaResultItem item={item} type="anime" />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const MovieResultsPane: React.FC<{ items: any[] }> = ({ items }) => {
    const locale = useLocale();
    const movieVirtual = useVirtualList({
        items,
        estimateSize: () => 136,
        overscan: 5,
        paddingEnd: 40,
        getItemKey: (index, item) => item.id || `search-movie-${index}`,
    });

    return (
        <div
            ref={movieVirtual.parentRef}
            className="flex-1 overflow-y-auto bg-app-surface"
            data-scroll-container="main"
            data-scroll-direction="vertical"
        >
            {items.length === 0 ? (
                <SearchNotFound text={locale === 'en' ? 'No matching movies or TV found' : '没有找到相关影视'} />
            ) : (
                <div style={{ height: movieVirtual.totalSize, width: '100%', position: 'relative' }}>
                    {movieVirtual.virtualItems.map((vItem) => {
                        const item = items[vItem.index];
                        if (!item) return null;
                        return (
                            <div
                                key={vItem.key}
                                ref={movieVirtual.virtualizer.measureElement}
                                data-index={vItem.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${vItem.start}px)`,
                                }}
                            >
                                <MediaResultItem item={item} type="movie" />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const UserResultsPane: React.FC<{ items: any[] }> = ({ items }) => {
    const locale = useLocale();
    const userVirtual = useVirtualList({
        items,
        estimateSize: () => 96,
        overscan: 5,
        paddingEnd: 40,
        getItemKey: (index, item) => `${item.mid || 'search-user'}-${index}`,
    });

    return (
        <div
            ref={userVirtual.parentRef}
            className="flex-1 overflow-y-auto bg-app-surface"
            data-scroll-container="main"
            data-scroll-direction="vertical"
        >
            {items.length > 0 && (
                <div style={{ height: userVirtual.totalSize, width: '100%', position: 'relative' }}>
                    {userVirtual.virtualItems.map((vItem) => {
                        const item = items[vItem.index];
                        if (!item) return null;
                        return (
                            <div
                                key={vItem.key}
                                ref={userVirtual.virtualizer.measureElement}
                                data-index={vItem.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${vItem.start}px)`,
                                }}
                            >
                                <UserResultItem user={item} />
                            </div>
                        );
                    })}
                </div>
            )}
            {items.length === 0 && (
                <div className="text-center py-10 text-app-text-muted text-[13px]">{locale === 'en' ? 'No matching users found' : '没有找到相关用户'}</div>
            )}
        </div>
    );
};

const ComprehensiveResultsPane: React.FC<{
    videos: any[];
    users: any[];
    videoById: Map<string, any>;
    authorByName: Map<string, any>;
}> = ({ videos, users, videoById, authorByName }) => {
    const locale = useLocale();
    const comprehensiveVirtual = useVirtualList({
        items: videos,
        estimateSize: () => 104,
        overscan: 5,
        paddingEnd: 40,
        getItemKey: (index, item) => item.id || `search-video-${index}`,
    });

    return (
        <div
            ref={comprehensiveVirtual.parentRef}
            className="flex-1 overflow-y-auto bg-app-surface"
            data-scroll-container="main"
            data-scroll-direction="vertical"
        >
            <div className="flex items-center gap-2 px-4 py-2 text-[12px] text-[#61666D] overflow-x-auto">
                {locale === 'en' ? (
                    <>
                        <span className="bg-app-bg px-3 py-1 rounded-full text-app-primary font-medium">All</span>
                        <span className="bg-app-bg px-3 py-1 rounded-full">Movies</span>
                        <span className="bg-app-bg px-3 py-1 rounded-full">Songs</span>
                        <span className="bg-app-bg px-3 py-1 rounded-full">Nexus</span>
                        <span className="bg-app-bg px-3 py-1 rounded-full">Yan Shuangying</span>
                    </>
                ) : (
                    <>
                        <span className="bg-app-bg px-3 py-1 rounded-full text-app-primary font-medium">全部</span>
                        <span className="bg-app-bg px-3 py-1 rounded-full">电影</span>
                        <span className="bg-app-bg px-3 py-1 rounded-full">歌曲</span>
                        <span className="bg-app-bg px-3 py-1 rounded-full">奈克瑟斯</span>
                        <span className="bg-app-bg px-3 py-1 rounded-full">燕双鹰</span>
                    </>
                )}
            </div>

            {users.length > 0 && (
                <RichUserCard user={users[0]} videoById={videoById} />
            )}

            {videos.length > 0 && (
                <div style={{ height: comprehensiveVirtual.totalSize, width: '100%', position: 'relative' }}>
                    {comprehensiveVirtual.virtualItems.map((vItem) => {
                        const item = videos[vItem.index];
                        if (!item) return null;
                        return (
                            <div
                                key={vItem.key}
                                ref={comprehensiveVirtual.virtualizer.measureElement}
                                data-index={vItem.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${vItem.start}px)`,
                                }}
                            >
                                <VideoResultItem video={item} authorByName={authorByName} />
                            </div>
                        );
                    })}
                </div>
            )}
            {videos.length === 0 && (
                <div className="text-center py-10 text-app-text-muted text-[13px]">{locale === 'en' ? 'No matching videos found' : '没有找到相关视频'}</div>
            )}
        </div>
    );
};

// ----- Page Component -----
export const SearchPage: React.FC = () => {
    const { bindBack, bindTap, go } = useBilibiliGestures();
    const { pathname } = useLocation();
    const locale = useLocale();
    const [searchParams] = useSearchParams();
    const VIDEO_DATA = useVideos();
    const AUTHOR_DATA = useAuthors();
    const RANKING_DATA = useRankings();
    const authorList = useMemo(() => Object.values(AUTHOR_DATA), [AUTHOR_DATA]);
    const videoById = useMemo(() => new Map(VIDEO_DATA.map(video => [video.id, video])), [VIDEO_DATA]);
    const authorByName = useMemo(() => {
        const map = new Map<string, any>();
        for (const author of authorList) {
            if (!map.has(author.name)) {
                map.set(author.name, author);
            }
        }
        return map;
    }, [authorList]);

    type SearchTabKey = 'comprehensive' | 'anime' | 'live' | 'user' | 'movie' | 'article';
    const isResultsPage = pathname === '/search/results';
    const activeTab = (searchParams.get('tab') as SearchTabKey) || 'comprehensive';

    const committedQuery = searchParams.get('q') || '';
    const isSearching = isResultsPage;
    const text = locale === 'en'
        ? {
            search: 'Search',
            placeholder: '180 billion lost in 10 years... why?',
            hotSearches: 'bilibili trending',
            fullList: 'Full list',
            meme: 'Meme',
            history: 'Search history',
            discovery: 'Discover',
            tabs: {
                comprehensive: 'Comprehensive',
                anime: 'Anime',
                live: 'Live',
                user: 'Users',
                movie: 'Movies & TV',
                article: 'Articles',
            },
        }
        : {
            search: '搜索',
            placeholder: '10年暴跌180亿! 营养快线 为啥...',
            hotSearches: 'bilibili热搜',
            fullList: '完整榜单',
            meme: '梗',
            history: '搜索历史',
            discovery: '搜索发现',
            tabs: {
                comprehensive: '综合',
                anime: '番剧',
                live: '直播',
                user: '用户',
                movie: '影视',
                article: '图文',
            },
        };

    const [draftQuery, setDraftQuery] = useState(committedQuery);
    const searchHistory = useBilibiliStore(s => s.user.searchHistory || []);
    const addSearchHistory = useBilibiliStore(s => s.addSearchHistory);
    const clearSearchHistory = useBilibiliStore(s => s.clearSearchHistory);

    // Keep input value synced with committed query in URL
    useEffect(() => {
        setDraftQuery(committedQuery);
    }, [committedQuery]);

    const submitSearch = (q: string) => {
        const trimmed = q.trim();
        if (!trimmed) {
            if (isResultsPage) {
                go('search.results.close');
            }
            return;
        }
        addSearchHistory(trimmed);
        if (isResultsPage) {
            go('search.results.query.submit', { q: trimmed });
        } else {
            go('search.results.open', { q: trimmed });
        }
    };

    // ----- Search Logic -----
    const searchResults = useMemo(() => {
        if (!committedQuery) return { videos: [], users: [], animes: [], movies: [] };
        const q = committedQuery.toLowerCase();

        const highlight = (text: string) => text.replace(new RegExp(committedQuery, 'gi'), match => `<span class="text-app-primary">${match}</span>`);

        // Search Videos
        const videos = VIDEO_DATA.filter(v =>
            (v.title ?? '').toLowerCase().includes(q) ||
            v.author?.toLowerCase().includes(q)
        ).map(v => ({
            ...v,
            highlightedTitle: highlight(v.title ?? '')
        }));

        // Search Users
        const users = authorList.filter(u =>
            u.name.toLowerCase().includes(q)
        ).map(u => ({
            ...u,
            highlightedName: highlight(u.name)
        }));

        // Search Anime (番剧, 国创)
        const animeSource = [
            ...(RANKING_DATA['番剧'] || []),
            ...(RANKING_DATA['国创'] || [])
        ];
        const animes = animeSource.filter(v =>
            v.title?.toLowerCase().includes(q)
        ).map(v => {
            const hydration = videoById.get(v.id);
            const fullItem = { ...v, ...(hydration || {}), highlightedTitle: highlight(v.title || '') };
            return fullItem;
        });

        // Search Movie (电影, 电视剧, 纪录片)
        const movieSource = [
            ...(RANKING_DATA['电影'] || []),
            ...(RANKING_DATA['电视剧'] || []),
            ...(RANKING_DATA['纪录片'] || [])
        ];
        const movies = movieSource.filter(v =>
            v.title?.toLowerCase().includes(q)
        ).map(v => {
            const hydration = videoById.get(v.id);
            const fullItem = { ...v, ...(hydration || {}), highlightedTitle: highlight(v.title || '') };
            return fullItem;
        });

        return { videos, users, animes, movies };
    }, [committedQuery, VIDEO_DATA, authorList, videoById, RANKING_DATA]);

    // ----- Renders -----

        const renderHeader = () => (
        <div className="bg-app-surface flex items-center gap-3 px-3 pt-10 pb-2 border-b border-gray-100 sticky top-0 z-50">
            <button {...(isResultsPage ? bindBack() : bindBack())}>
                <ChevronLeft size={24} className="text-[#61666D]" />
            </button>
            <div className="flex-1 h-9 bg-app-bg rounded-full flex items-center px-3 gap-2">
                <Search size={16} className="text-app-text-muted" />
                <input
                    autoFocus={!isSearching}
                    className="flex-1 bg-transparent border-none outline-none text-[14px] text-app-text placeholder-[#9499A0]"
                    placeholder={text.placeholder}
                    value={draftQuery}
                    onChange={(e) => setDraftQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitSearch(draftQuery)}
                />
                {draftQuery && (
                    <button
                        {...(isResultsPage
                            ? bindTap('search.results.close', { beforeTrigger: () => setDraftQuery('') })
                            : { onClick: () => setDraftQuery('') })}
                    >
                        <X size={16} className="text-app-text-muted bg-[#C0C4CC] rounded-full p-0.5 text-white" />
                    </button>
                )}
            </div>
            <button
                className="text-[15px] text-app-primary font-medium"
                {...(draftQuery.trim()
                    ? bindTap(isResultsPage ? 'search.results.query.submit' : 'search.results.open', {
                        params: { q: draftQuery.trim() },
                        beforeTrigger: () => addSearchHistory(draftQuery.trim()),
                    })
                    : (isResultsPage ? bindTap('search.results.close') : { onClick: () => {} }))}
            >
                {text.search}
            </button>
        </div>
    );

    const renderInitialContent = () => (
        <div className="flex-1 overflow-y-auto no-scrollbar bg-app-surface pb-10" data-scroll-container="main" data-scroll-direction="vertical">
            {/* Hot Search */}
            <div className="mt-4 px-4">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-[15px] font-bold text-app-text">{text.hotSearches}</h2>
                    <span className="text-[12px] text-app-text-muted flex items-center">{text.fullList} <ChevronLeft size={12} className="rotate-180" /></span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {HOT_SEARCHES.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-2 truncate"
                            {...bindTap(isResultsPage ? 'search.results.query.submit' : 'search.results.open', {
                                params: { q: item.query },
                                beforeTrigger: () => {
                                    setDraftQuery(item.query);
                                    addSearchHistory(item.query);
                                },
                            })}
                        >
                            <span className={`text-[13px] ${idx < 3 ? 'font-bold' : ''} w-4 text-center ${idx === 0 ? 'text-[#FED152]' : idx === 1 ? 'text-[#C0C4CC]' : idx === 2 ? 'text-[#ECA575]' : 'text-app-text-muted'}`}>
                                {idx + 1}
                            </span>
                            <span className="text-[14px] text-app-text truncate flex-1">{locale === 'en' ? item.titleEn : item.titleZh}</span>
                            {item.tag === 'new' && <NewIcon label={locale === 'en' ? 'New' : '新'} />}
                            {item.tag === 'hot' && <HotIcon label={locale === 'en' ? 'Hot' : '热'} />}
                            {item.tag === 'meme' && <span className="bg-app-primary text-white text-[10px] px-1 rounded-[2px] ml-1">{text.meme}</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* History */}
            {searchHistory.length > 0 && (
                <div className="mt-8 px-4">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-[14px] font-bold text-app-text">{text.history}</h2>
                        <Trash2 size={16} className="text-app-text-muted" onClick={clearSearchHistory} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {searchHistory.map((h, i) => (
                            <span
                                key={i}
                                {...bindTap(isResultsPage ? 'search.results.query.submit' : 'search.results.open', {
                                    params: { q: h },
                                    beforeTrigger: () => {
                                        setDraftQuery(h);
                                        addSearchHistory(h);
                                    },
                                })}
                                className="bg-[#F6F7F8] text-app-text text-[13px] px-3 py-1.5 rounded-[4px] max-w-full truncate"
                            >
                                {h}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Discovery */}
            <div className="mt-8 px-4">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-[14px] font-bold text-app-text">{text.discovery}</h2>
                    <div className="flex items-center gap-4 text-app-text-muted">
                        <RefreshCw size={16} />
                        <Eye size={16} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {DISCOVERY_ITEMS.map((item, i) => (
                        <div
                            key={i}
                            className="bg-[#F6F7F8] p-2 rounded-[4px] flex flex-col justify-center"
                            {...bindTap(isResultsPage ? 'search.results.query.submit' : 'search.results.open', {
                                params: { q: item.query },
                                beforeTrigger: () => {
                                    setDraftQuery(item.query);
                                    addSearchHistory(item.query);
                                },
                            })}
                        >
                            <div className="text-[13px] text-app-text truncate">{locale === 'en' ? item.titleEn : item.titleZh}</div>
                            {(locale === 'en' ? item.infoEn : item.infoZh) && <div className="text-[11px] text-app-text-muted mt-0.5 truncate">{locale === 'en' ? item.infoEn : item.infoZh}</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderTabs = () => {
        const tabs = [
            { id: 'comprehensive', label: text.tabs.comprehensive },
            { id: 'anime', label: text.tabs.anime },
            { id: 'live', label: text.tabs.live },
            { id: 'user', label: text.tabs.user },
            { id: 'movie', label: text.tabs.movie },
            { id: 'article', label: text.tabs.article },
        ];

        return (
            <div className="flex items-center overflow-x-auto px-2 border-b border-gray-100 bg-app-surface sticky top-[53px] z-40">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        {...(activeTab === tab.id
                            ? {}
                            : bindTap('search.results.tab.switch', { params: { tab: tab.id } }))}
                        className={`px-4 py-2.5 text-[14px] whitespace-nowrap relative transition-colors ${activeTab === tab.id ? 'text-app-primary font-bold' : 'text-[#61666D]'}`}
                    >
                        {tab.label}
                        {activeTab === tab.id && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-app-primary rounded-full" />}
                    </div>
                ))}
            </div>
        );
    };

    const renderResults = () => {
        if (activeTab === 'anime') {
            return <AnimeResultsPane key={activeTab} items={searchResults.animes} />;
        }

        if (activeTab === 'movie') {
            return <MovieResultsPane key={activeTab} items={searchResults.movies} />;
        }

        if (activeTab === 'user') {
            return <UserResultsPane key={activeTab} items={searchResults.users} />;
        }

        return (
            <ComprehensiveResultsPane
                key={activeTab}
                videos={searchResults.videos}
                users={searchResults.users}
                videoById={videoById}
                authorByName={authorByName}
            />
        );
    };

    return (
        <div className="flex flex-col h-full bg-app-bg font-sans relative">
            {renderHeader()}

            {!isSearching ? (
                renderInitialContent()
            ) : (
                <>
                    {renderTabs()}
                    {renderResults()}
                </>
            )}
        </div>
    );
};
