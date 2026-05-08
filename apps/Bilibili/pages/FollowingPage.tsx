import React, { useMemo } from 'react';
import { IcEditSquare, IcAdd, IcPlay, IcMoreVertical, IcMessage, IcLike, IcHistory, IcForward } from '../res/icons';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useLocale } from '@/apps/Bilibili/locale';
import { useBilibiliStore } from '../state';
import { useAuthors, useVideos } from '../hooks/useData';
import { BILIBILI_CONFIG, resolveBilibiliAssetUrl } from '../data';
import type { UserInfo } from '../types';
import { useSystemTime } from '../../../os/useSystemTime';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { formatBilibiliRelativeTime, formatBilibiliStat } from '../utils/localize';

const SquarePen = IcEditSquare;
const Plus = IcAdd;
const Play = IcPlay;
const MoreVertical = IcMoreVertical;
const MessageSquare = IcMessage;
const ThumbsUp = IcLike;
const History = IcHistory;
const Forward = IcForward;
const DEFAULT_VIDEO_COVER = resolveBilibiliAssetUrl('./images/covers/default.svg') as string;

export const FollowingPage: React.FC = () => {
    const { bindTap } = useBilibiliGestures();
    const { pathname } = useLocation();
    const [searchParams] = useSearchParams();
    const locale = useLocale();
    const user = useBilibiliStore(s => s.user);
    const toggleFollow = useBilibiliStore(s => s.toggleFollow);
    const { now } = useSystemTime();
    const AUTHOR_DATA = useAuthors();
    const VIDEO_DATA = useVideos();
    const text = locale === 'en'
        ? {
            title: 'Following',
            all: 'All',
            video: 'Videos',
            mostVisited: 'Most visited',
            more: 'More',
            animeUpdates: 'My anime & drama updates',
            viewAll: 'View all',
            uploadedVideo: 'uploaded a video',
            plays: 'views',
            danmaku: 'danmaku',
            emptyTitle: 'You are not following any creators yet',
            emptyDesc: 'Follow more creators so you never miss great content.',
            recommended: 'Creators you may like',
            recommendedUp: 'Recommended creator',
            up: 'Creator',
            follow: 'Follow',
        }
        : {
            title: '关注',
            all: '全部',
            video: '视频',
            mostVisited: '最常访问',
            more: '更多',
            animeUpdates: '我的追番·追剧',
            viewAll: '全部',
            uploadedVideo: '投稿了视频',
            plays: '播放',
            danmaku: '弹幕',
            emptyTitle: '你还没有关注过UP主哦',
            emptyDesc: '关注更多的UP主，精彩内容不错过',
            recommended: '猜你喜欢的UP主',
            recommendedUp: '推荐UP主',
            up: 'UP主',
            follow: '关注',
        };

    const tabRaw = searchParams.get('tab');
    const activeTabFromUrl: 'all' | 'video' = tabRaw === 'video' ? 'video' : 'all';
    const activeTab = pathname === '/following' ? activeTabFromUrl : 'all';

    const recommendedUps = useMemo(() => {
        return BILIBILI_CONFIG.recommendedUp.map(rec => {
            const recId = Number(rec.id);
            const author = AUTHOR_DATA[recId];
            const fallback: UserInfo = {
                mid: recId,
                name: rec.name,
                face: '',
                sign: text.recommendedUp,
                level: 1,
                vip: { status: 0, label: '' },
                official: { role: 0, title: '', type: 0 },
                top_photo: '',
                live_room: null,
                follower: 0,
                following: 0,
                likes: 0,
                videos: [],
            };
            return author ?? fallback;
        });
    }, [AUTHOR_DATA, text.recommendedUp]);

    const feed = useMemo(() => {
        if (!user.followingList || user.followingList.length === 0) return [];

        const allVideos: any[] = [];
        user.followingList.forEach(follow => {
            const author = AUTHOR_DATA[Number(follow.mid)];
            if (author && author.videos) {
                author.videos.forEach(v => {
                    const fullVideo = VIDEO_DATA.find(vd => vd.id === v.id);
                    allVideos.push({
                        ...v,
                        ...fullVideo,
                        author: {
                            mid: author.mid,
                            name: author.name,
                            face: author.face,
                            official: author.official,
                        },
                    });
                });
            }
        });

        return allVideos.sort((a, b) => b.date - a.date);
    }, [AUTHOR_DATA, VIDEO_DATA, user.followingList]);

    const hasFollows = user.followingList && user.followingList.length > 0;
    const currentTime = now();

    return (
        <div className="flex flex-col h-full bg-app-bg">
            <div className="flex items-center justify-between px-4 pt-10 pb-2 bg-app-surface sticky top-0 z-40">
                <div className="w-8" />
                <h1 className="text-[17px] font-medium text-app-text">{text.title}</h1>
                <button className="w-8 flex justify-end text-[#505050]">
                    <SquarePen size={22} strokeWidth={1.5} />
                </button>
            </div>

            <div className="flex w-full bg-app-surface pb-2 border-b border-gray-100 z-30">
                <button
                    {...(activeTab === 'all' ? {} : bindTap('following.tab.switch', { params: { tab: 'all' } }))}
                    className="flex-1 flex flex-col items-center justify-center pt-2 pb-1 relative transition-colors"
                >
                    <span className={`text-[15px] font-medium ${activeTab === 'all' ? 'text-app-primary' : 'text-[#61666D]'}`}>
                        {text.all}
                    </span>
                    {activeTab === 'all' && <div className="w-8 h-0.5 bg-app-primary rounded-full mt-1.5" />}
                </button>
                <button
                    {...(activeTab === 'video' ? {} : bindTap('following.tab.switch', { params: { tab: 'video' } }))}
                    className="flex-1 flex flex-col items-center justify-center pt-2 pb-1 relative transition-colors"
                >
                    <span className={`text-[15px] font-medium ${activeTab === 'video' ? 'text-app-primary' : 'text-[#61666D]'}`}>
                        {text.video}
                    </span>
                    {activeTab === 'video' && <div className="w-8 h-0.5 bg-app-primary rounded-full mt-1.5" />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
                {hasFollows ? (
                    <div className="flex flex-col">
                        <div className="bg-app-surface mb-2 py-3 px-4">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[13px] font-bold text-app-text">{text.mostVisited}</span>
                                <span className="text-[11px] text-app-text-muted flex items-center">{text.more} <History size={10} className="ml-0.5" /></span>
                            </div>
                            <div className="flex gap-4 overflow-x-auto no-scrollbar">
                                {user.followingList?.slice(0, 10).map((u, idx) => {
                                    const author = AUTHOR_DATA[Number(u.mid)] || u;
                                    return (
                                        <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0 w-14" {...bindTap('user.open', { params: { mid: u.mid } })}>
                                            <div className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden border border-gray-100">
                                                {author.face ? (
                                                    <img src={author.face} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-sky-100 to-pink-100" />
                                                )}
                                            </div>
                                            <div className="text-[10px] text-app-text truncate w-full text-center">{author.name}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {activeTab === 'video' && user.subscribedAnime && user.subscribedAnime.length > 0 && (
                            <div className="bg-app-surface mb-2 py-3 px-4">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[13px] font-bold text-app-text">{text.animeUpdates}</span>
                                    <span className="text-[11px] text-app-text-muted">{text.viewAll} &gt;</span>
                                </div>
                                <div className="flex gap-3 overflow-x-auto no-scrollbar">
                                    {user.subscribedAnime.map(anime => {
                                        const videoInfo = VIDEO_DATA.find(v => v.id === anime.id);
                                        const cover = videoInfo?.raw?.ss_horizontal_cover || videoInfo?.cover || DEFAULT_VIDEO_COVER;
                                        const updateText = videoInfo?.raw?.new_ep?.index_show || (locale === 'en'
                                            ? `Episode ${Math.floor(Math.random() * 200)} now available`
                                            : `更新至第${Math.floor(Math.random() * 200)}话`);

                                        return (
                                            <div key={anime.id} className="flex flex-col gap-1.5 w-28 shrink-0" {...bindTap('video.open', { params: { bvid: anime.id } })}>
                                                <div className="w-full aspect-video bg-gray-800 rounded-lg overflow-hidden relative">
                                                    <img src={cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
                                                        <span className="text-[10px] text-white">{updateText}</span>
                                                    </div>
                                                </div>
                                                <div className="text-[11px] text-app-text truncate font-medium">
                                                    {anime.title}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            {feed.map((item: any, index) => (
                                <div key={`${item.id}_${index}`} className="bg-app-surface p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex gap-2" {...bindTap('user.open', { params: { mid: item.author.mid } })}>
                                            <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden relative border border-gray-50">
                                                <img src={item.author.face} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                {item.author.official?.role !== 0 && (
                                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-app-primary rounded-full border border-white flex items-center justify-center">
                                                        <span className="text-white text-[7px] font-bold">⚡</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="text-[13px] font-medium text-app-primary">{item.author.name}</div>
                                                <div className="text-[10px] text-app-text-muted flex items-center gap-1">
                                                    {formatBilibiliRelativeTime(item.date, currentTime, locale)} · {text.uploadedVideo}
                                                </div>
                                            </div>
                                        </div>
                                        <MoreVertical size={14} className="text-gray-300" />
                                    </div>

                                    <div className="text-[14px] text-app-text leading-6 mb-2 line-clamp-3">
                                        {item.desc || `Check out my new video: ${item.title}! Hope you like it.`}
                                    </div>

                                    <div
                                        className="aspect-video rounded-lg overflow-hidden relative bg-black/5 mb-3 group"
                                        {...bindTap('video.open', { params: { bvid: item.id } })}
                                    >
                                        <img src={item.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

                                        <div className="absolute bottom-2 left-2 text-white text-[12px] flex items-center gap-3 font-medium">
                                            <span>{item.duration || '04:20'}</span>
                                            <span>{formatBilibiliStat(item.plays, locale)} {text.plays}</span>
                                            <span>{formatBilibiliStat(item.danmaku || item.raw?.stat?.danmaku || 0, locale)} {text.danmaku}</span>
                                        </div>

                                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                                <Play size={20} className="text-white fill-white ml-1" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-[15px] text-app-text mb-3 leading-snug line-clamp-2 font-medium">
                                        {item.title}
                                    </div>

                                    <div className="flex items-center gap-16 text-gray-400 text-[13px] px-2">
                                        <div className="flex items-center gap-1.5"><Forward size={18} /> <span>{formatBilibiliStat(item.raw?.stat?.share || 0, locale)}</span></div>
                                        <div className="flex items-center gap-1.5"><MessageSquare size={18} /> <span>{formatBilibiliStat(item.raw?.stat?.reply || 0, locale)}</span></div>
                                        <div className="flex items-center gap-1.5"><ThumbsUp size={18} /> <span>{formatBilibiliStat(item.raw?.stat?.like || 0, locale)}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col min-h-full bg-app-surface">
                        <div className="flex flex-col items-center pt-12 pb-8">
                            <h2 className="text-[17px] font-bold text-app-text mb-2">{text.emptyTitle}</h2>
                            <p className="text-[13px] text-app-text-muted">{text.emptyDesc}</p>
                        </div>

                        <div className="px-4 pb-3">
                            <h3 className="text-[15px] font-bold text-app-text">{text.recommended}</h3>
                        </div>

                        <div className="pb-20">
                            {recommendedUps.map(author => (
                                <div key={author.mid} className="mb-6 last:mb-0">
                                    <div className="flex items-center justify-between px-4 mb-3">
                                        <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2" {...bindTap('user.open', { params: { mid: author.mid } })}>
                                            <div className="w-[42px] h-[42px] rounded-full bg-gray-100 overflow-hidden border border-gray-100 relative shrink-0">
                                                <img src={author.face} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                {author.official?.role !== 0 && (
                                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-app-primary rounded-full border-2 border-white flex items-center justify-center">
                                                        <span className="text-white text-[8px] font-bold">⚡</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="text-[14px] font-medium text-app-text leading-tight truncate">{author.name}</div>
                                                <div className="text-[11px] text-app-text-muted mt-0.5 leading-tight truncate">
                                                    {author.official?.title || (author.official?.role === 0 ? text.up : author.sign) || text.up}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            {...bindTap(
                                                { kind: 'action', id: 'following.recommendUp.follow.toggle' },
                                                {
                                                    stopPropagation: true,
                                                    params: { mid: String(author.mid) },
                                                    onTrigger: () => toggleFollow(String(author.mid)),
                                                },
                                            )}
                                            className="h-(--app-follow-btn-height) px-3.5 bg-app-surface border border-app-primary rounded-[4px] text-app-primary flex items-center justify-center gap-0.5 text-[13px] font-medium active:bg-pink-50 transition-colors shrink-0 whitespace-nowrap"
                                        >
                                            <Plus size={14} strokeWidth={2.5} /> {text.follow}
                                        </button>
                                    </div>

                                    <div className="flex gap-2.5 px-4 overflow-x-auto no-scrollbar">
                                        {author.videos?.slice(0, 3).map((video: any) => (
                                            <div
                                                key={video.id}
                                                className="w-[calc((100%-20px)/3)] shrink-0 flex flex-col gap-2 group active:opacity-90 transition-opacity"
                                                {...bindTap('video.open', { params: { bvid: video.id } })}
                                            >
                                                <div className="w-full aspect-video rounded-md overflow-hidden relative bg-gray-100">
                                                    <img
                                                        src={video.cover || VIDEO_DATA.find(v => v.id === video.id)?.cover}
                                                        className="w-full h-full object-cover"
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                                                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white/90">
                                                        <Play size={10} fill="currentColor" strokeWidth={0} />
                                                        <span className="text-[10px] font-medium leading-none mt-0.5">
                                                            {formatBilibiliStat(video.plays || VIDEO_DATA.find(v => v.id === video.id)?.plays, locale)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-[12px] text-app-text leading-[1.4] line-clamp-2 min-h-[2.8em]">
                                                    {video.title}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
