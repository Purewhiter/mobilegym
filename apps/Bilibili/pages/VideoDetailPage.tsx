import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { IcNavBack, IcNavForward, IcExpand, IcMore, IcLike, IcDislike, IcCoins, IcStar, IcShare, IcAdd, IcMonitorPlay, IcPlay, IcPause, IcPlayCircle, IcPauseCircle, IcMessage, IcAlignLeft, IcSend, IcBan, IcMenu, IcLightning, IcClose, IcCheck, IcCircleDollarSign } from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward, ChevronDown = IcExpand, MoreHorizontal = IcMore, ThumbsUp = IcLike, ThumbsDown = IcDislike, Coins = IcCoins, Star = IcStar, Share2 = IcShare, Plus = IcAdd, MonitorPlay = IcMonitorPlay, Play = IcPlay, Pause = IcPause, PlayCircle = IcPlayCircle, PauseCircle = IcPauseCircle, MessageSquare = IcMessage, AlignLeft = IcAlignLeft, Send = IcSend, Ban = IcBan, Menu = IcMenu, Zap = IcLightning, X = IcClose, Check = IcCheck, CircleDollarSign = IcCircleDollarSign;
import { FavToast, FavSheet } from './FavSheet';
import { BILIBILI_CONFIG } from '../data';
import { RECOMMEND_DATA } from '../data/recommendData';
import { CommentsData, CommentReply } from '../types';
import { useVideos, useVideoTags, useVideoOnline, useVideoComments, useAuthors } from '../hooks/useData';
import { useSystemTime } from '../../../os/useSystemTime';
import { realNow } from '../../../os/TimeService';
import * as TimeService from '../../../os/TimeService';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { BilibiliDanmakuIcon } from '../res/icons';
import coinMascotImg from '../assets/22-coin.png';
// “你可能感兴趣”面板是本地子状态：绑定到同一个 history entry（idx），push/back 仍保留；entry 被 pop 后消失
const videoIntroLocalStateByEntryId = new Map<string, { suggestionsOpen: boolean }>();

let pendingNewFavFolderId: string | null = null;
export function setPendingNewFavFolder(id: string) {
    pendingNewFavFolderId = id;
}

const CommentItem: React.FC<{ comment: CommentReply }> = ({ comment }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { now } = useSystemTime();
    const { bindTap } = useBilibiliGestures();

    const formatCommentTime = (ctime: number) => {
        if (!ctime) return '';
        const current = now() / 1000;
        const diff = current - ctime;
        if (diff < 60) return '刚刚';
        if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
        if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}天前`;
        const date = TimeService.fromTimestamp(ctime * 1000);
        return `${date.getMonth() + 1}-${date.getDate()}`;
    };

    const showExpand = comment.message.length > 100;
    const displayMessage = isExpanded ? comment.message : comment.message.slice(0, 100);

    return (
        <div className="flex gap-3 mb-6">
            <div
                className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-gray-100 mt-1 relative cursor-pointer active:opacity-80 transition-opacity"
                {...bindTap('user.open', { params: { mid: comment.mid }, stopPropagation: true })}
            >
                <img src={comment.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                {comment.vip && (
                    <div className="absolute bottom-0 right-0 bg-app-primary text-white text-[8px] px-0.5 rounded-full border border-white">大</div>
                )}
            </div>

                <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span
                            className="text-[13px] font-medium text-gray-500 cursor-pointer active:opacity-60"
                            {...bindTap('user.open', { params: { mid: comment.mid }, stopPropagation: true })}
                        >
                            {comment.uname}
                        </span>
                        <span className="text-[9px] bg-app-primary text-white px-1 rounded-sm">LV{comment.level}</span>
                    </div>

                    <div className="text-[15px] text-app-text leading-normal mt-1">
                        {displayMessage}
                        {showExpand && !isExpanded && (
                            <>...<span onClick={() => setIsExpanded(true)} className="text-[#00A1D6] ml-1 text-sm cursor-pointer">展开</span></>
                        )}
                        {showExpand && isExpanded && (
                            <span onClick={() => setIsExpanded(false)} className="text-[#00A1D6] ml-1 text-sm cursor-pointer"> 收起</span>
                        )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                        <span>{formatCommentTime(comment.ctime)} {comment.location?.replace('IP属地：', '')}</span>
                        <span>回复</span>
                        <div className="flex items-center gap-4 ml-auto">
                            <div className="flex items-center gap-1">
                                <ThumbsUp size={14} />
                                <span>{comment.like || 0}</span>
                            </div>
                            <ThumbsDown size={14} />
                            <MoreHorizontal size={14} className="rotate-90" />
                        </div>
                    </div>

                    {(comment.rcount ?? 0) > 0 && (
                        <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2">
                            {comment.replies && comment.replies.length > 0 && (
                                <div className="text-[13px] text-app-text mb-2">
                                    <span
                                        className="text-[#00A1D6] mr-1 cursor-pointer active:opacity-60"
                                        {...bindTap('user.open', { params: { mid: comment.replies![0].mid }, stopPropagation: true })}
                                    >
                                        {comment.replies[0].uname}
                                    </span>
                                    {comment.replies[0].message.slice(0, 50)}{comment.replies[0].message.length > 50 ? '...' : ''}
                                </div>
                            )}
                            <div className="text-xs text-[#00A1D6] font-medium">
                                共{comment.rcount ?? 0}条回复 &gt;
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const parseDurationToSec = (raw: string | number | undefined | null): number => {
    if (raw == null) return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : 0;
    const s = String(raw);
    if (!s) return 0;
    if (!s.includes(':')) {
        const n = parseInt(s, 10);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }
    const parts = s.split(':').map(p => parseInt(p, 10));
    if (parts.some(p => Number.isNaN(p))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
};

const formatPlayTime = (sec: number): string => {
    const total = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatStat = (num: number | string | undefined) => {
    if (num === undefined || num === null) return '0';
    // If it's already formatted (contains non-numeric characters like Wan/Yi), return as is
    if (typeof num === 'string' && (num.includes('万') || num.includes('亿'))) {
        return num;
    }
    const val = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(val)) return '0';

    if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
    if (val >= 10000) return (val / 10000).toFixed(1) + '万';
    return val.toString();
};

const formatDate = (ts: number | undefined) => {
    if (!ts) {
        // Fallback to a default time if timestamp is missing
        return '2026年1月1日 18:30';
    }
    const date = TimeService.fromTimestamp(ts * 1000);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export const VideoDetailPage: React.FC = () => {
    const { bvid } = useParams<{ bvid: string }>();
    const { bindTap, bindLongPress, bindBack, go, back } = useBilibiliGestures();
    const [searchParams] = useSearchParams();
    const location = useLocation();

    const { now } = useSystemTime();

    const VIDEO_DATA = useVideos();
    const VIDEO_TAGS = useVideoTags();
    const VIDEO_ONLINE = useVideoOnline();
    const VIDEO_COMMENTS = useVideoComments();
    const AUTHOR_DATA = useAuthors();

    const toggleFollow = useBilibiliStore(s => s.toggleFollow);
    const biliUser = useBilibiliStore(s => s.user);
    const toggleLike = useBilibiliStore(s => s.toggleLike);
    const toggleDislike = useBilibiliStore(s => s.toggleDislike);
    const addCoin = useBilibiliStore(s => s.addCoin);
    const toggleFav = useBilibiliStore(s => s.toggleFav);
    const tripleAction = useBilibiliStore(s => s.tripleAction);
    const isFollowing = (id: string | number) => {
        const mid = String(id);
        return (biliUser.followingList || []).some(u => String(u.mid) === mid);
    };
    const checkInteractions = (vid: string) => ({
        liked: (biliUser.likedVideoIds || []).includes(vid),
        disliked: (biliUser.dislikedVideoIds || []).includes(vid),
        coined: ((biliUser.coinedVideoCoins || {})[vid] || 0) > 0,
        coinCount: (biliUser.coinedVideoCoins || {})[vid] || 0,
        favored: (biliUser.favoritesFolders || []).some(f => (f.videoIds || []).includes(vid)),
    });
    const setActiveVideoId = useBilibiliStore(s => s.setActiveVideoId);

    // Track active video
    useEffect(() => {
        setActiveVideoId(bvid || null);
        return () => setActiveVideoId(null);
    }, [bvid, setActiveVideoId]);

    // Tab Logic (URL Param)
    const activeTab = (searchParams.get('tab') as 'intro' | 'comment') || 'intro';

    const [comments, setComments] = useState<CommentReply[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [loadedBvid, setLoadedBvid] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [sortOrder, setSortOrder] = useState<'hot' | 'time'>('hot');
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentSec, setCurrentSec] = useState(0);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [hideTimerKey, setHideTimerKey] = useState(0);

    const [longPressProgress, setLongPressProgress] = useState(0);
    const animationFrameRef = useRef<any>(null);
    const isLongPressTriggeredRef = useRef(false);
    const isPressingRef = useRef(false);
    const [toast, setToast] = useState<{ show: boolean, msg: string }>({ show: false, msg: '' });

    const [showFavToast, setShowFavToast] = useState(false);
    const [showFavSheet, setShowFavSheet] = useState(false);
    const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);
    const favToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // URL Params Logic
    const showMenu = searchParams.get('menu') === 'true';
    // 推荐面板：不进入 URL；绑定到同一个 history entry（优先 idx，其次 location.key）
    const entryId = React.useMemo(() => {
        const rawIdx = (window.history.state as any)?.idx;
        const idx =
            typeof rawIdx === 'number'
                ? rawIdx
                : typeof rawIdx === 'string' && rawIdx.trim() !== ''
                    ? Number(rawIdx)
                    : NaN;
        if (Number.isFinite(idx)) {
            return `bili:video:idx:${idx}`;
        }
        // 兜底：idx 不可用时使用 location.key；但 replace（切 tab）会生成新 key，
        // 因此下面会在同一 bvid 下把旧 key 的状态迁移到新 key，避免丢失。
        return `bili:video:key:${location.key}`;
    }, [location.key, location.pathname, location.search]);

    const lastEntryIdRef = useRef<string | null>(null);
    const lastBvidRef = useRef<string | undefined>(undefined);

    const [showSuggestionPanel, setShowSuggestionPanel] = useState(() => {
        return videoIntroLocalStateByEntryId.get(entryId)?.suggestionsOpen ?? false;
    });

    useEffect(() => {
        const existing = videoIntroLocalStateByEntryId.get(entryId);
        if (existing) {
            setShowSuggestionPanel(existing.suggestionsOpen);
        } else {
            // 当 entryId 变化但仍在同一个 bvid（典型：replace 切 tab 导致 key 变化）时，迁移上一 entry 的状态
            const prevEntryId = lastEntryIdRef.current;
            const prevBvid = lastBvidRef.current;
            if (prevEntryId && prevBvid === bvid) {
                const prev = videoIntroLocalStateByEntryId.get(prevEntryId);
                if (prev) {
                    videoIntroLocalStateByEntryId.set(entryId, { suggestionsOpen: prev.suggestionsOpen });
                    setShowSuggestionPanel(prev.suggestionsOpen);
                } else {
                    setShowSuggestionPanel(false);
                }
            } else {
                setShowSuggestionPanel(false);
            }
        }

        lastEntryIdRef.current = entryId;
        lastBvidRef.current = bvid;
    }, [entryId, bvid]);

    useEffect(() => {
        videoIntroLocalStateByEntryId.set(entryId, { suggestionsOpen: showSuggestionPanel });
    }, [entryId, showSuggestionPanel]);

    // Find video info from consolidated data sources
    let video = VIDEO_DATA.find(v => v.id === bvid);

    // Final fallback
    if (!video) {
        video = VIDEO_DATA[0];
    }

    // 相关推荐：优先同分区视频，分区为空或不足时从 RECOMMEND_DATA 补足
    const relatedVideos = React.useMemo(() => {
        const exclude = new Set<string>([video.id]);
        const result: typeof VIDEO_DATA = [];
        const partition = video.partition;
        if (partition) {
            for (const v of VIDEO_DATA) {
                if (result.length >= 5) break;
                if (exclude.has(v.id) || v.partition !== partition) continue;
                result.push(v);
                exclude.add(v.id);
            }
        }
        if (result.length < 5) {
            const fullById = new Map(VIDEO_DATA.map(v => [v.id, v]));
            for (const r of RECOMMEND_DATA) {
                if (result.length >= 5) break;
                if (exclude.has(r.id)) continue;
                const full = fullById.get(r.id);
                if (full) {
                    result.push(full);
                    exclude.add(r.id);
                }
            }
        }
        return result;
    }, [video.id, video.partition, VIDEO_DATA]);

    // Get Author Data if available
    let mid = video.raw?.owner?.mid;

    // Fallback: search by author name if mid is missing
    if (!mid && video.author) {
        const foundAuthor = Object.values(AUTHOR_DATA).find(u => u.name === video.author);
        if (foundAuthor) {
            mid = foundAuthor.mid;
        }
    }

    const showToast = (msg: string) => {
        setToast({ show: true, msg });
        setTimeout(() => setToast({ show: false, msg: '' }), 2000);
    };


    // Ensure stats exist (Mock if missing)
    const stats = React.useMemo(() => {
        if (video?.stats) return video.stats;
        const plays = video?.plays || 10000;
        return {
            likes: Math.floor(plays * 0.08) || 123,
            coins: Math.floor(plays * 0.02) || 45,
            favorites: Math.floor(plays * 0.04) || 67,
            shares: Math.floor(plays * 0.01) || 12,
            favs: Math.floor(plays * 0.04) || 67
        };
    }, [video]);

    const { liked, disliked, coined, coinCount, favored } = checkInteractions(video!.id);
    const showCoinDialog = searchParams.get('coinDialog') === 'open';

    const handleLikeStart = (e: React.PointerEvent) => {
        // Prevent default browser actions if needed, but scrolling is important.
        // Usually Pointer Events are fine. 
        isLongPressTriggeredRef.current = false;
        isPressingRef.current = true;

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        const startTime = realNow();
        const duration = 800;

        const animate = () => {
            if (!isPressingRef.current) return;

            const elapsed = realNow() - startTime;
            const p = Math.min(100, (elapsed / duration) * 100);
            setLongPressProgress(p);

            if (p >= 100) {
                isLongPressTriggeredRef.current = true;
                isPressingRef.current = false; // Stop pressing
                const res = tripleAction(video!.id);
                showToast(res.msg);
                setLongPressProgress(0);
                return;
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        animationFrameRef.current = requestAnimationFrame(animate);
    };

    const handleLikeEnd = (e: React.PointerEvent) => {
        isPressingRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setLongPressProgress(0);

        // Click Logic
        if (!isLongPressTriggeredRef.current) {
            toggleLike(video!.id);
        }
        isLongPressTriggeredRef.current = false;
    };

    const handleLikeCancel = (e: React.PointerEvent) => {
        isPressingRef.current = false;
        isLongPressTriggeredRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setLongPressProgress(0);
    };

    const handleCoinClick = () => {
        go('video.coinDialog.open', {});
    };

    const [coinDialogSelected, setCoinDialogSelected] = useState(1);
    const [coinDialogAlsoLike, setCoinDialogAlsoLike] = useState(true);
    const coinDialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showCoinDialog) return;
        const el = coinDialogRef.current;
        if (!el) return;
        const prevent = (e: TouchEvent) => e.preventDefault();
        el.addEventListener('touchmove', prevent, { passive: false });
        return () => el.removeEventListener('touchmove', prevent);
    }, [showCoinDialog]);

    const coinTouchRef = useRef<{ startX: number, startY: number } | null>(null);
    const mascotTouchRef = useRef<{ startY: number, triggered: boolean } | null>(null);

    useEffect(() => {
        if (showCoinDialog) {
            setCoinDialogSelected(1);
            setCoinDialogAlsoLike(true);
        }
    }, [showCoinDialog]);

    const handleCoinSubmit = () => {
        const res = addCoin(video!.id, coinDialogSelected, coinDialogAlsoLike);
        back();
        if (!res.success) {
            showToast(res.msg);
        } else {
            showToast('投币成功');
        }
    };


    const handleCoinPointerDown = (e: React.PointerEvent) => {
        coinTouchRef.current = { startX: e.clientX, startY: e.clientY };
    };

    const handleCoinPointerMove = (e: React.PointerEvent) => {
        if (!coinTouchRef.current) return;
        const dx = e.clientX - coinTouchRef.current.startX;
        if (Math.abs(dx) > 30) {
            setCoinDialogSelected(dx < 0 ? 2 : 1);
            coinTouchRef.current.startX = e.clientX;
        }
    };

    const handleCoinPointerUp = () => {
        coinTouchRef.current = null;
    };

    const handleMascotPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        mascotTouchRef.current = { startY: e.clientY, triggered: false };
        try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch (_) {}
    };

    const handleMascotPointerMove = (e: React.PointerEvent) => {
        if (!mascotTouchRef.current || mascotTouchRef.current.triggered) return;
        const dy = e.clientY - mascotTouchRef.current.startY;
        if (dy < -50) {
            mascotTouchRef.current.triggered = true;
            handleCoinSubmit();
        }
    };

    const handleMascotPointerUp = (e: React.PointerEvent) => {
        if (!mascotTouchRef.current) return;
        try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch (_) {}
        mascotTouchRef.current = null;
    };

    const handleFav = useCallback(() => {
        const vid = video!.id;
        const wasFavored = (biliUser.favoritesFolders || []).some(f => (f.videoIds || []).includes(vid));
        toggleFav(vid);
        if (!wasFavored) {
            if (favToastTimerRef.current) clearTimeout(favToastTimerRef.current);
            setShowFavToast(true);
            favToastTimerRef.current = setTimeout(() => setShowFavToast(false), 3000);
        } else {
            setShowFavToast(false);
            if (favToastTimerRef.current) clearTimeout(favToastTimerRef.current);
        }
    }, [video, biliUser.favoritesFolders, toggleFav]);



    const handleOpenFavSheet = useCallback(() => {
        setShowFavToast(false);
        if (favToastTimerRef.current) clearTimeout(favToastTimerRef.current);
        setShowFavSheet(true);
    }, []);

    const handleCreateFolderFromSheet = useCallback(() => {
        setShowFavSheet(false);
        go('favCreate.open', {});
    }, [go]);

    useEffect(() => {
        if (pendingNewFavFolderId) {
            const id = pendingNewFavFolderId;
            pendingNewFavFolderId = null;
            setPendingFolderId(id);
            setShowFavSheet(true);
        }
    });

    useEffect(() => {
        return () => {
            if (favToastTimerRef.current) clearTimeout(favToastTimerRef.current);
        };
    }, []);


    const totalSec = React.useMemo(() => parseDurationToSec(video.duration), [video.duration]);

    // 切视频时重置播放状态（autoplay）
    useEffect(() => {
        setCurrentSec(0);
        setIsPlaying(true);
        setControlsVisible(true);
        setHideTimerKey(k => k + 1);
    }, [bvid]);

    // 模拟播放推进（用 realNow 测真实物理时间）
    useEffect(() => {
        if (!isPlaying || totalSec <= 0) return;
        const startedAt = realNow();
        const startedFrom = currentSec >= totalSec ? 0 : currentSec;
        if (currentSec >= totalSec) setCurrentSec(0);
        const id = setInterval(() => {
            const next = startedFrom + (realNow() - startedAt) / 1000;
            if (next >= totalSec) {
                setCurrentSec(totalSec);
                setIsPlaying(false);
                return;
            }
            setCurrentSec(next);
        }, 250);
        return () => clearInterval(id);
        // currentSec 故意不入 deps：仅在播放/暂停或换视频时重新启动 ticker
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying, totalSec]);

    // 控件层 3s 自动隐藏（仅播放中；暂停时常驻）
    useEffect(() => {
        if (!controlsVisible || !isPlaying) return;
        const t = setTimeout(() => setControlsVisible(false), 3000);
        return () => clearTimeout(t);
    }, [controlsVisible, isPlaying, hideTimerKey]);

    const handleTogglePlay = () => {
        if (!isPlaying && totalSec > 0 && currentSec >= totalSec) {
            setCurrentSec(0);
        }
        setIsPlaying(p => !p);
        setControlsVisible(true);
        setHideTimerKey(k => k + 1);
    };

    const handlePlayerSurfaceTap = () => {
        if (controlsVisible) {
            setControlsVisible(false);
        } else {
            setControlsVisible(true);
            setHideTimerKey(k => k + 1);
        }
    };

    // 进度条拖动：拖动时暂停 ticker，松手后按拖动前的 isPlaying 状态恢复
    const trackRef = useRef<HTMLDivElement>(null);
    const seekResumeRef = useRef<boolean>(false);
    const isSeekingRef = useRef(false); // 同步守卫，防止桌面端 hover 触发 move
    const [isSeeking, setIsSeeking] = useState(false);

    const seekFromClientX = (clientX: number) => {
        const el = trackRef.current;
        if (!el || totalSec <= 0) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        setCurrentSec(ratio * totalSec);
    };

    const handleSeekDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        if (totalSec <= 0) return;
        seekResumeRef.current = isPlaying;
        isSeekingRef.current = true;
        setIsSeeking(true);
        setIsPlaying(false);
        setControlsVisible(true);
        setHideTimerKey(k => k + 1);
        try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch (_) {}
        seekFromClientX(e.clientX);
    };

    const handleSeekMove = (e: React.PointerEvent) => {
        if (!isSeekingRef.current) return;
        e.stopPropagation();
        seekFromClientX(e.clientX);
    };

    const handleSeekUp = (e: React.PointerEvent) => {
        if (!isSeekingRef.current) return;
        e.stopPropagation();
        try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch (_) {}
        isSeekingRef.current = false;
        setIsSeeking(false);
        if (seekResumeRef.current) setIsPlaying(true);
        seekResumeRef.current = false;
        setHideTimerKey(k => k + 1);
    };

    const progressPct = totalSec > 0 ? Math.min(100, (currentSec / totalSec) * 100) : 0;

    // Load comments directly from consolidated data
    useEffect(() => {
        if (bvid && loadedBvid !== bvid) {
            const videoComments = VIDEO_COMMENTS[bvid];
            if (videoComments) {
                setComments(videoComments.comments);
                setCommentCount(videoComments.count);
            } else {
                setComments([]);
                setCommentCount(0);
            }
            setLoadedBvid(bvid);
        }
    }, [bvid, loadedBvid, VIDEO_COMMENTS]);

    const sortedComments = React.useMemo(() => {
        return [...comments].sort((a, b) => {
            if (sortOrder === 'hot') {
                return (b.like || 0) - (a.like || 0);
            } else {
                return (b.ctime || 0) - (a.ctime || 0);
            }
        });
    }, [comments, sortOrder]);

    // Mock data for UI elements not in the main config
    const upInfo = {
        name: video.author || 'UP主',
        face: video.face || '',
    };

    const authorProfile = mid ? AUTHOR_DATA[mid] : null;
    const realFans = authorProfile ? formatStat(authorProfile.follower) : '0';
    const realVideoCount = authorProfile ? authorProfile.videos.length : 0;

    const isFollowed = isFollowing(mid || '');

    return (
        // container-type：sticky 的 top 用 cqw 对齐播放器高度；避免用 vw（会按浏览器视口算，zoom 下与内容区宽度不一致导致简介 Tab 吸附错位、中间空白）
        <div className="flex flex-col h-full bg-app-surface" style={{ containerType: 'inline-size' }} data-status-bar-foreground="light">
            {/* 1. 播放器区域 */}
            {/* 修复状态栏遮挡: 给黑色容器添加 pt-10，使播放器下移，同时状态栏区域背景为黑 */}
            <div className="w-full bg-black sticky top-0 z-50 pt-10">
                <div className="aspect-video w-full relative bg-black overflow-hidden">
                    {/* 封面（充当画面）*/}
                    {video.cover ? (
                        <img
                            src={video.cover}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            loading="eager"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-neutral-900" />
                    )}

                    {/* 点击层：显隐控件层；不需要 data-trigger（仅装饰性） */}
                    <div
                        className="absolute inset-0 z-10 cursor-pointer"
                        onClick={handlePlayerSurfaceTap}
                    />

                    {/* 控件层：底部单行 = play + 时间 + 进度条 + 全屏；整体随 controlsVisible 显隐 */}
                    <div
                        aria-hidden={!controlsVisible}
                        className={`absolute inset-0 z-20 transition-opacity duration-200 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    >
                        {/* 顶/底部渐变（仅装饰，不拦截点击） */}
                        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

                        {/* 底部控制条 */}
                        <div
                            className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-2 pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-2.5 text-white">
                                {/* 播放/暂停（仅装饰，无 data-trigger） */}
                                <button
                                    aria-label={isPlaying ? '暂停' : '播放'}
                                    aria-pressed={isPlaying}
                                    className="w-7 h-7 flex items-center justify-center -ml-1 active:opacity-70"
                                    onClick={(e) => { e.stopPropagation(); handleTogglePlay(); }}
                                >
                                    {isPlaying
                                        ? <Pause size={22} fill="currentColor" strokeWidth={0} />
                                        : <Play size={22} fill="currentColor" strokeWidth={0} />}
                                </button>

                                {/* 时间合并显示 current/total */}
                                <span className="text-[11px] tabular-nums text-white/95 select-none">
                                    {formatPlayTime(currentSec)}/{formatPlayTime(totalSec)}
                                </span>

                                {/* 可拖动进度条 */}
                                <div
                                    ref={trackRef}
                                    className="flex-1 h-3 flex items-center cursor-pointer touch-none"
                                    onPointerDown={handleSeekDown}
                                    onPointerMove={handleSeekMove}
                                    onPointerUp={handleSeekUp}
                                    onPointerCancel={handleSeekUp}
                                >
                                    <div className={`relative w-full rounded-full bg-white/30 ${isSeeking ? 'h-1.5' : 'h-1'} transition-[height] duration-150`}>
                                        <div
                                            className="absolute inset-y-0 left-0 bg-app-primary rounded-full"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                        <div
                                            className={`absolute top-1/2 rounded-full bg-white shadow ${isSeeking ? 'w-3.5 h-3.5' : 'w-3 h-3'} transition-[width,height] duration-150`}
                                            style={{ left: `${progressPct}%`, transform: 'translate(-50%, -50%)' }}
                                        />
                                    </div>
                                </div>

                                {/* 全屏（仅装饰，没有 data-trigger） */}
                                <button
                                    aria-label="全屏"
                                    className="w-7 h-7 flex items-center justify-center -mr-1 active:opacity-70"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="4 9 4 4 9 4" />
                                        <polyline points="20 9 20 4 15 4" />
                                        <polyline points="4 15 4 20 9 20" />
                                        <polyline points="20 15 20 20 15 20" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 返回键（始终可见，不受控件层显隐影响） */}
                    <button
                        {...bindBack()}
                        className="absolute top-2 left-2 w-8 h-8 bg-black/50 rounded-full text-white flex items-center justify-center z-30"
                    >
                        <ChevronLeft size={20} />
                    </button>
                </div>
            </div>

            {/* 2. Tab 栏 (Sticky)：top = pt-10 + 16:9 区高度，与上方播放器同宽（cqw），勿用 vw */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-[calc(2.5rem+56.25cqw)] bg-app-surface z-40">
                <div className="flex gap-6 relative">
                    <button
                        {...(activeTab === 'intro' ? {} : bindTap('video.tab.switch', { params: { tab: 'intro' } }))}
                        className={`text-[15px] font-medium transition-colors ${activeTab === 'intro' ? 'text-app-primary' : 'text-gray-600'}`}
                    >
                        简介
                    </button>
                    <button
                        {...(activeTab === 'comment' ? {} : bindTap('video.tab.switch', { params: { tab: 'comment' } }))}
                        className={`text-[15px] font-medium transition-colors ${activeTab === 'comment' ? 'text-app-primary' : 'text-gray-600'}`}
                    >
                        评论 <span className="text-xs font-normal">{commentCount}</span>
                    </button>

                    {/* Animated Indicator */}
                    <div
                        className="absolute bottom-[-13px] h-0.5 bg-app-primary rounded-full"
                        style={{
                            width: '16px',
                            transform: `translateX(${activeTab === 'intro' ? '0px' : '62px'})`,
                            transition: 'all var(--app-duration-medium) var(--app-easing-decelerate)',
                        }}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-gray-100 px-3 py-1.5 rounded-full text-xs text-gray-400 w-28 text-center">
                        点我发弹幕
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <span className="text-xs">弹</span>
                    </div>
                </div>
            </div>

            {/* 3. 内容滚动区 (评论 Tab 时 pb-14 给底部留白) */}
            <div className={`flex-1 overflow-y-auto no-scrollbar min-h-0 ${activeTab === 'comment' ? 'pb-14' : 'pb-0'}`} data-scroll-container="main" data-scroll-direction="vertical">
                {activeTab === 'intro' ? (
                    <div className="p-4">
                        {/* UP 主信息栏 */}
                        <div className="flex items-center justify-between mb-4">
                            <div
                                className="flex items-center gap-2 cursor-pointer active:opacity-70 transition-opacity"
                                {...(mid ? bindTap('user.open', { params: { mid: String(mid) } }) : {})}
                            >
                                <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-100">
                                    <img src={upInfo.face} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[13px] font-medium text-app-primary">{upInfo.name}</span>
                                    <span className="text-[10px] text-gray-400">{realFans}粉丝 {realVideoCount}视频</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button className="h-7 px-3 rounded-full bg-app-surface border border-app-primary text-app-primary flex items-center justify-center gap-0.5 font-medium text-[12px] active:bg-app-primary/5 transition-colors">
                                    <Zap size={12} fill="currentColor" /> 充电
                                </button>
                                {isFollowed ? (
                                    <button
                                        className="h-7 px-3 rounded-full bg-[#E3E5E7] text-[#61666D] flex items-center justify-center gap-1 font-medium text-[12px] active:bg-[#d0d3d6] transition-colors"
                                        {...bindTap('video.menu.open')}
                                    >
                                        <Menu size={12} /> 已关注
                                    </button>
                                ) : (
                                    <button
                                        className="bg-app-primary text-white text-[12px] px-4 py-1.5 rounded-full flex items-center gap-0.5 font-medium active:bg-app-primary/90"
                                        {...(mid
                                            ? bindTap(
                                                { kind: 'action', id: 'video.intro.follow.submit' },
                                                {
                                                    onTrigger: () => {
                                                        toggleFollow(String(mid));
                                                        setShowSuggestionPanel(true);
                                                    },
                                                },
                                            )
                                            : {})}
                                    >
                                        <Plus size={12} strokeWidth={3} /> 关注
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Suggestion Panel */}
                        {showSuggestionPanel && (
                            <div className="mb-4">
                                <div className="flex justify-between items-center text-[12px] text-app-text-muted mb-2">
                                    <span>你可能感兴趣</span>
                                    <button
                                        type="button"
                                        {...bindTap(
                                            { kind: 'action', id: 'video.intro.suggestions.close' },
                                            { onTrigger: () => setShowSuggestionPanel(false) },
                                        )}
                                        className="text-app-text-muted active:opacity-70"
                                        aria-label="关闭"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                    {BILIBILI_CONFIG.recommendedUp.map(up => {
                                        const isUpFollowed = isFollowing(up.id);
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
                                                className="w-(--app-suggestion-card-width) bg-app-surface border border-[#E3E5E7] rounded-lg p-2 flex flex-col items-center shrink-0 relative shadow-sm active:opacity-90"
                                            >
                                                {face ? (
                                                    <img referrerPolicy="no-referrer" src={face} className="w-9 h-9 rounded-full mb-1.5 object-cover" loading="lazy" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full mb-1.5 bg-gradient-to-br from-sky-100 to-pink-100" />
                                                )}
                                                <div className="text-[12px] font-medium text-app-text mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{up.name}</div>
                                                <div className="text-[9px] text-app-text-muted mb-2 scale-90">{label}</div>
                                                <button
                                                    className={`w-full h-6 rounded-full text-[11px] flex items-center justify-center font-medium transition-colors ${isUpFollowed
                                                        ? 'bg-[#E3E5E7] text-app-text-muted'
                                                        : 'border border-app-primary text-app-primary active:bg-pink-50'
                                                        }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFollow(up.id);
                                                    }}
                                                >
                                                    {isUpFollowed ? '已关注' : '+ 关注'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 广告 Banner 模拟 (from screenshot) */}
                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg mb-4">
                            <div className="w-10 h-10 rounded bg-gradient-to-br from-sky-100 to-pink-100 flex items-center justify-center text-app-primary">
                                <Zap size={18} />
                            </div>
                            <div className="flex-1">
                                <div className="text-xs font-medium text-gray-800">不会做的题？千问帮你看看</div>
                                <div className="text-[10px] text-gray-400">广告 · 22.8万播放</div>
                            </div>
                            <button className="text-gray-300"><MoreHorizontal size={14} className="rotate-90" /></button>
                        </div>

                        {/* 视频标题与详情 */}
                        {/* 视频标题与详情 */}
                        <div className="mb-4">
                            <div className="flex justify-between items-start gap-2">
                                <h1 className={`text-[16px] font-medium text-app-text leading-snug ${isExpanded ? '' : 'line-clamp-2'}`}>
                                    {video.title}
                                </h1>
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="pt-0.5 text-gray-400 flex-shrink-0"
                                >
                                    <ChevronDown size={20} className={`${isExpanded ? 'rotate-180' : ''}`} style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-1.5 mt-2 text-xs text-gray-400">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1"><MonitorPlay size={12} /> {formatStat(video.plays)}</div>
                                    <div className="flex items-center gap-1"><BilibiliDanmakuIcon className="mt-0.5" /> {formatStat(video.danmaku)}</div>
                                    <span>{formatDate(video.raw?.pubdate || video.date)}</span>
                                    <span>{VIDEO_ONLINE[bvid ?? ''] || '0'}人正在看</span>
                                </div>
                            </div>

                            <div className={`grid ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}`} style={{ transition: 'all var(--app-duration-medium) var(--app-easing-standard)' }}>
                                <div className="overflow-hidden">
                                    <div className="text-xs text-gray-500 flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <span>{bvid}</span>
                                            {video.raw?.rights?.no_reprint === 1 && (
                                                <div className="flex items-center gap-1">
                                                    <Ban size={11} className="text-[#FF6699]" />
                                                    <span>未经作者授权禁止转载</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="leading-relaxed whitespace-pre-wrap select-text">
                                            {video.desc || '-'}
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {(VIDEO_TAGS[bvid ?? ''] || []).map(tag => (
                                                <span key={tag} className="bg-app-bg text-gray-500 px-2 py-1 rounded-full text-[11px]">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 一键三连操作栏 */}
                        <div className="flex items-center justify-around px-2 py-4 mb-2 select-none">
                            {/* Like & Long Press (triple) */}
                            <div
                                data-action="video.intro.like.toggle"
                                data-action-type="tap"
                                className="flex flex-col items-center gap-1.5 cursor-pointer relative active:scale-95 transition-transform select-none"
                                onPointerDown={handleLikeStart}
                                onPointerUp={handleLikeEnd}
                                onPointerLeave={handleLikeCancel}
                                onPointerCancel={handleLikeCancel}
                            >
                                <div className="relative w-7 h-7 flex items-center justify-center">
                                    <ThumbsUp
                                        size={24}
                                        className={`transition-colors ${liked ? 'fill-[#FB7299] text-app-primary' : 'text-[#61666D]'}`}
                                        strokeWidth={liked ? 0 : 1.5}
                                    />
                                    {liked && <div className="absolute inset-0 flex items-center justify-center animate-ping opacity-20"><ThumbsUp size={24} className="fill-[#FB7299] text-app-primary" /></div>}
                                </div>
                                <span className={`text-[11px] font-medium ${liked ? 'text-app-primary' : 'text-[#61666D]'}`}>
                                    {formatStat((stats.likes ?? 0) + (liked ? 1 : 0)) || '点赞'}
                                </span>
                            </div>

                            {/* Dislike */}
                            <div
                                className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                                {...bindTap(
                                    { kind: 'action', id: 'video.intro.dislike.toggle' },
                                    { onTrigger: () => toggleDislike(video!.id) },
                                )}
                            >
                                <div className="w-7 h-7 flex items-center justify-center">
                                    <ThumbsDown
                                        size={24}
                                        className={`transition-colors ${disliked ? 'fill-[#FB7299] text-app-primary' : 'text-[#61666D]'}`}
                                        strokeWidth={disliked ? 0 : 1.5}
                                    />
                                </div>
                                <span className={`text-[11px] font-medium ${disliked ? 'text-app-primary' : 'text-[#61666D]'}`}>
                                    {disliked ? '不喜欢' : '不喜欢'}
                                </span>
                            </div>

                            {/* Coin */}
                            <div
                                className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                                {...bindTap(
                                    { kind: 'action', id: 'video.intro.coin.open' },
                                    { onTrigger: handleCoinClick },
                                )}
                            >
                                <div className="relative w-7 h-7 flex items-center justify-center">
                                    {longPressProgress > 0 && (
                                        <svg className="absolute inset-[-6px] w-[40px] h-[40px] rotate-[-90deg] pointer-events-none" viewBox="0 0 36 36">
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#FB7299"
                                                strokeWidth="2.5"
                                                strokeDasharray={`${longPressProgress}, 100`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    )}
                                    <CircleDollarSign
                                        size={24}
                                        className={`transition-colors ${coined ? 'fill-[#FB7299] text-app-primary' : 'text-[#61666D]'}`}
                                        strokeWidth={coined ? 0 : 1.5}
                                    />
                                </div>
                                <span className={`text-[11px] font-medium ${coined ? 'text-app-primary' : 'text-[#61666D]'}`}>
                                    {formatStat((stats.coins ?? 0) + coinCount) || '投币'}
                                </span>
                            </div>

                            {/* Fav */}
                            <div
                                className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                                {...bindLongPress(
                                    { kind: 'action', id: 'video.intro.fav.longPress' },
                                    {
                                        onTrigger: () => handleOpenFavSheet(),
                                    },
                                )}
                                onClick={() => handleFav()}
                                data-action="video.intro.fav.toggle"
                            >
                                <div className="relative w-7 h-7 flex items-center justify-center">
                                    {longPressProgress > 0 && (
                                        <svg className="absolute inset-[-6px] w-[40px] h-[40px] rotate-[-90deg] pointer-events-none" viewBox="0 0 36 36">
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#FB7299"
                                                strokeWidth="2.5"
                                                strokeDasharray={`${longPressProgress}, 100`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    )}
                                    <Star
                                        size={24}
                                        className={`transition-colors ${favored ? 'fill-[#FB7299] text-app-primary' : 'text-[#61666D]'}`}
                                        strokeWidth={favored ? 0 : 1.5}
                                    />
                                </div>
                                <span className={`text-[11px] font-medium ${favored ? 'text-app-primary' : 'text-[#61666D]'}`}>
                                    {formatStat((stats.favs ?? stats.favorites ?? 0) + (favored ? 1 : 0)) || '收藏'}
                                </span>
                            </div>

                            {/* Share */}
                            <div className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform">
                                <div className="w-7 h-7 flex items-center justify-center">
                                    <Share2 size={24} className="text-[#61666D]" strokeWidth={1.5} />
                                </div>
                                <span className="text-[11px] text-[#61666D] font-medium">{formatStat(stats?.shares ?? 0) || '分享'}</span>
                            </div>
                        </div>

                        {/* Toast Overlay */}
                        {toast.show && (
                            <div className="fixed top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-5 py-2.5 rounded-lg text-[13px] z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                                {toast.msg}
                            </div>
                        )}

                        {/* 更多推荐 */}
                        <div className="border-t border-gray-100 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium">相关推荐</span>
                            </div>

                            <div className="flex flex-col gap-3">
                                {relatedVideos.map(v => (
                                    <div
                                        key={v.id}
                                        className="flex gap-3 h-20 relative cursor-pointer active:opacity-70 transition-opacity"
                                        {...bindTap('video.open.fromVideo', { params: { bvid: v.id } })}
                                    >
                                        <div className="relative w-36 h-full rounded-md bg-gray-200 overflow-hidden flex-shrink-0">
                                            <img src={v.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                                            <div className="absolute bottom-1 right-1 text-white text-[10px] bg-black/40 px-1 rounded">
                                                {v.duration}
                                            </div>
                                        </div>
                                        <div className="flex flex-col py-0.5 flex-1 min-w-0 gap-0.5">
                                            <h3 className="text-[13px] font-medium line-clamp-2 leading-tight text-app-text pr-6">
                                                {v.title}
                                            </h3>
                                            <div className="text-[11px] text-gray-400 flex flex-col gap-0.5 mt-auto">
                                                <div className="flex items-center gap-1">
                                                    <span className="border border-app-border rounded px-0.5 text-[9px] scale-90 origin-left">UP</span>
                                                    {v.author}
                                                </div>
                                                <div>{formatStat(v.plays)}播放 · {formatStat(v.danmaku)}弹幕</div>
                                            </div>
                                        </div>
                                        <div className="absolute top-0 right-0 py-1">
                                            <MoreHorizontal size={14} className="text-gray-300 rotate-90" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* 评论 Tab */
                    <div className="bg-app-surface min-h-full">
                        {/* 筛选栏 */}
                        <div className="flex justify-between items-center px-4 py-3">
                            <span className="text-sm text-gray-500 font-medium">
                                {sortOrder === 'hot' ? '热门评论' : '最新评论'}
                            </span>
                            <div
                                className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer active:opacity-60"
                                {...bindTap(
                                    { kind: 'action', id: 'video.comment.sort.toggle' },
                                    { onTrigger: () => setSortOrder(prev => (prev === 'hot' ? 'time' : 'hot')) },
                                )}
                            >
                                <AlignLeft size={14} />
                                <span>{sortOrder === 'hot' ? '按热度' : '按时间'}</span>
                            </div>
                        </div>

                        {/* 评论列表 */}
                        <div className="px-4 pb-20">
                            {sortedComments.length === 0 ? (
                                <div className="text-center text-gray-400 py-10">暂无评论</div>
                            ) : (
                                sortedComments.map(comment => (
                                    <CommentItem key={comment.rpid} comment={comment} />
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 4. 底部输入框 (仅在评论 Tab 显示) - flex-shrink-0 for adjustResize (keyboard) compatibility */}
            {activeTab === 'comment' && (
                <div className="flex-shrink-0 bg-app-surface border-t border-gray-100 flex items-center px-4 py-2 gap-3 pb-safe z-50" data-keep-keyboard="true">
                    <div className="flex-1 bg-gray-100 rounded-full h-9 flex items-center px-4 text-sm text-gray-400">
                        万水千山总是情，评论两句行不行
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                        <span className="text-xl">😊</span>
                    </div>
                </div>
            )}

            {/* Fav Toast & Sheet */}
            <FavToast visible={showFavToast && !showMenu} onModify={handleOpenFavSheet} />
            <FavSheet
                visible={showFavSheet}
                videoId={video!.id}
                onClose={() => { setShowFavSheet(false); setPendingFolderId(null); }}
                onCreateFolder={handleCreateFolderFromSheet}
                pendingNewFolderId={pendingFolderId}
            />

            {/* Coin Dialog */}
            {showCoinDialog && (() => {
                const maxAdd = Math.min(2 - coinCount, Math.floor(biliUser.coins));
                return (
                    <div 
                        ref={coinDialogRef}
                        className="fixed inset-0 z-[200] flex flex-col overflow-hidden touch-none"
                        onWheel={e => e.stopPropagation()}
                    >
                        {/* Upper half: tap to close */}
                        <div className="flex-1" {...bindBack()} />
                        
                        {/* Lower half: content area with swipe + bottom bar */}
                        <div
                            className="relative pb-[28%]"
                            onPointerDown={handleCoinPointerDown}
                            onPointerMove={handleCoinPointerMove}
                            onPointerUp={handleCoinPointerUp}
                            onPointerCancel={handleCoinPointerUp}
                        >
                            {/* Invisible scroll trap: let sim swipe hit this instead of the page below */}
                            <div className="absolute inset-0 overflow-scroll" aria-hidden="true">
                                <div className="w-[calc(100%+240px)] h-[calc(100%+240px)]" />
                            </div>

                            <div className="relative z-10 flex flex-col items-center select-none touch-none">
                                {/* Coins block container */}
                                <div className="flex items-center gap-4 mb-4">
                                    <ChevronLeft size={36} className="text-white/60 cursor-pointer active:opacity-60" strokeWidth={1.5} onClick={(e) => { e.stopPropagation(); setCoinDialogSelected(1); }} />

                                    <div className="flex items-end gap-5">
                                        {/* 1 Coin Block */}
                                        <div
                                            className={`relative rounded-xl border-[2px] border-[#A86B3E] bg-[#C28253] flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                coinDialogSelected === 1 ? 'w-[104px] h-[104px]' : 'w-[88px] h-[88px] opacity-90'
                                            }`}
                                            onClick={() => setCoinDialogSelected(1)}
                                        >
                                            {/* 4 dots */}
                                            <div className="absolute top-2 left-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute top-2 right-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute bottom-2 left-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute bottom-2 right-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />

                                            {/* Coin Icon */}
                                            <div className={`rounded-full bg-gradient-to-b from-[#E8E8E8] to-[#BDBDBD] border border-[#999] flex items-center justify-center shadow-inner mb-1.5 ${coinDialogSelected === 1 ? 'w-11 h-11' : 'w-9 h-9'}`}>
                                                <span className={`text-[#666] font-bold ${coinDialogSelected === 1 ? 'text-[15px]' : 'text-[13px]'}`}>币</span>
                                            </div>
                                            <span className={`text-white font-medium ${coinDialogSelected === 1 ? 'text-[15px]' : 'text-[13px]'}`}>1 硬币</span>
                                        </div>

                                        {/* 2 Coin Block */}
                                        <div
                                            className={`relative rounded-xl border-[2px] border-[#A86B3E] bg-[#C28253] flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                coinDialogSelected === 2 ? 'w-[104px] h-[104px]' : 'w-[88px] h-[88px] opacity-90'
                                            }`}
                                            onClick={() => setCoinDialogSelected(2)}
                                        >
                                            {/* 4 dots */}
                                            <div className="absolute top-2 left-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute top-2 right-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute bottom-2 left-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute bottom-2 right-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />

                                            {/* Two Coins Icon */}
                                            <div className={`relative mb-1.5 ${coinDialogSelected === 2 ? 'w-14 h-11' : 'w-11 h-9'}`}>
                                                <div className={`absolute top-0 left-0 rounded-full bg-gradient-to-b from-[#E8E8E8] to-[#BDBDBD] border border-[#999] flex items-center justify-center shadow-inner ${coinDialogSelected === 2 ? 'w-11 h-11' : 'w-9 h-9'}`}>
                                                    <span className={`text-[#666] font-bold ${coinDialogSelected === 2 ? 'text-[15px]' : 'text-[13px]'}`}>币</span>
                                                </div>
                                                <div className={`absolute top-0 right-0 rounded-full bg-gradient-to-b from-[#E8E8E8] to-[#BDBDBD] border border-[#999] flex items-center justify-center shadow-inner ${coinDialogSelected === 2 ? 'w-11 h-11' : 'w-9 h-9'}`}>
                                                    <span className={`text-[#666] font-bold ${coinDialogSelected === 2 ? 'text-[15px]' : 'text-[13px]'}`}>币</span>
                                                </div>
                                                {/* Sparkles if selected */}
                                                {coinDialogSelected === 2 && (
                                                    <>
                                                        <div className="absolute -top-1 -right-2 text-white text-[12px] rotate-12 z-10">✨</div>
                                                        <div className="absolute -bottom-1 -left-2 text-white text-[10px] -rotate-12 z-10">✨</div>
                                                    </>
                                                )}
                                            </div>
                                            <span className={`text-white font-medium ${coinDialogSelected === 2 ? 'text-[15px]' : 'text-[13px]'}`}>2 硬币</span>
                                        </div>
                                    </div>
                                    
                                    <ChevronRight size={36} className="text-white/60 cursor-pointer active:opacity-60" strokeWidth={1.5} onClick={(e) => { e.stopPropagation(); setCoinDialogSelected(2); }} />
                                </div>

                                {/* 22娘 & Text (Clickable to submit, swipe-up to submit) */}
                                <div
                                    className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform mt-2 touch-none"
                                    onPointerDown={handleMascotPointerDown}
                                    onPointerMove={handleMascotPointerMove}
                                    onPointerUp={handleMascotPointerUp}
                                    onPointerCancel={handleMascotPointerUp}
                                    {...bindTap(
                                        { kind: 'action', id: 'video.intro.coinDialog.submit' },
                                        { onTrigger: handleCoinSubmit },
                                    )}
                                >
                                    <img
                                        src={coinMascotImg}
                                        alt="22娘"
                                        className="w-[100px] h-[160px] object-contain pointer-events-none"
                                        draggable={false}
                                    />

                                    <div className="text-white text-[15px] mb-1.5">上划或点击22娘投硬币</div>
                                    <div className="text-white/60 text-[13px]">硬币余额：{biliUser.coins.toFixed(1)}</div>
                                </div>
                                {/* Bottom Bar */}
                                <div className="w-full px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-4 flex items-center justify-between text-white">
                                    <div
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={() => setCoinDialogAlsoLike(!coinDialogAlsoLike)}
                                    >
                                        <div className={`w-[18px] h-[18px] rounded-[3px] border-[1.5px] flex items-center justify-center transition-colors ${
                                            coinDialogAlsoLike ? 'bg-white border-white' : 'border-white/70'
                                        }`}>
                                            {coinDialogAlsoLike && <Check size={13} className="text-[#333]" strokeWidth={4} />}
                                        </div>
                                        <span className="text-[15px] tracking-wide">同时点赞内容</span>
                                    </div>

                                    <div className="flex items-center gap-2 cursor-pointer active:opacity-70">
                                        <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-white/70 flex items-center justify-center" {...bindBack()}>
                                            <X size={11} strokeWidth={2.5} className="text-white/90" />
                                        </div>
                                        <span className="text-[14px] text-white/90">如何获取硬币？</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Background overlay */}
                        <div className="absolute inset-0 bg-black/70 -z-10 pointer-events-none" />
                    </div>
                );
            })()}

            {/* Unfollow Menu */}
            {showMenu && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/50" {...bindBack()} />
                    <div className="bg-app-surface rounded-t-xl z-20 overflow-hidden text-[15px]">
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" {...bindBack()}>加入特别关注</div>
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" {...bindBack()}>设置分组</div>
                        <div
                            className="py-3.5 text-center text-app-primary border-b border-gray-100 active:bg-gray-50"
                            {...bindBack({ beforeTrigger: () => toggleFollow(String(mid || '')) })}
                        >
                            取消关注
                        </div>
                        <div className="h-1.5 bg-app-bg" />
                        <div className="py-3.5 text-center text-app-text active:bg-gray-50" {...bindBack()}>取消</div>
                    </div>
                </div>
            )}
        </div>
    );
};
