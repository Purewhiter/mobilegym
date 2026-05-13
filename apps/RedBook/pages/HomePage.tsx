import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRedBookStore } from '../state';
import { useRedBookView, useRedBookAuthor, useIsNoteLiked, useIsFollowingUser } from '../data/view';
import { useShallow } from 'zustand/react/shallow';
import { REDBOOK_CONFIG } from '../data';
import { Note } from '../types';
import { IcShare, IcScan, IcExpand, IcCollapse, IcNavForward, IcMenu, IcSearch } from '../res/icons';
const Share2 = IcShare, ScanLine = IcScan, ChevronDown = IcExpand, ChevronUp = IcCollapse, ChevronRight = IcNavForward, Menu = IcMenu, Search = IcSearch;
import { Drawer } from '../components/Drawer';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import { strings, type StringKey } from '../res/strings';
import { RedBookPlayIcon, RedBookHeartFilledIcon, RedBookHeartOutlineIcon, RedBookHeartIcon, RedBookCommentIcon, RedBookPeopleIcon } from '../res/icons';
import * as TimeService from '../../../os/TimeService';
// Helper to parse likes/count string to number
const parseCount = (count: number | string): number => {
    if (typeof count === 'number') return count;
    if (!count) return 0;
    
    let str = count.toString().replace(/\+/g, '');
    if (str.includes('万')) {
        return parseFloat(str.replace('万', '')) * 10000;
    }
    if (str.includes('w')) {
        return parseFloat(str.replace('w', '')) * 10000;
    }
    return parseFloat(str) || 0;
};

// Format time helper
const formatTime = (timestamp: number, s: typeof strings) => {
    const now = TimeService.now();
    const diff = now - timestamp;
    const date = TimeService.fromTimestamp(timestamp);
    const nowYear = TimeService.getDate().getFullYear();
    const dateYear = date.getFullYear();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return s.just_now;
    if (hours < 1) return `${minutes}${s.min_ago}`;
    if (hours < 24) return `${hours}${s.hr_ago}`;
    if (days <= 7) return `${days}${s.days_ago}`;
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (dateYear !== nowYear) {
        return `${dateYear}-${month}-${day}`;
    } else {
        return `${month}-${day}`;
    }
};

const getFeedTextCardClass = (text: string) => {
  const len = (text || '').trim().length;
  if (len <= 8) return 'text-[28px] leading-[1.2]';
  if (len <= 16) return 'text-[24px] leading-[1.25]';
  if (len <= 30) return 'text-[20px] leading-[1.3]';
  if (len <= 50) return 'text-[18px] leading-[1.35]';
  return 'text-[16px] leading-[1.4]';
};

const NoteItemImpl: React.FC<{ note: Note; showTime?: boolean }> = ({ note, showTime }) => {
  const { bindTap } = useRedBookGestures();
  // 细粒度订阅：toggleLike 是稳定 ref，author/isLiked 通过 useRedBookAuthor/useIsNoteLiked
  // 直接订阅它们对应的字段——避免之前 useRedBookView 让卡片被任何 store change 触发重渲染。
  const toggleLike = useRedBookStore(s => s.toggleLike);
  const author = useRedBookAuthor(note.authorId);
  const isLiked = useIsNoteLiked(note.id);
  const s = useRedBookStrings();
  const hasCoverImage = !!(note.images && note.images[0]);
  const showTextCard = !hasCoverImage && !note.video;
  const textCardValue = note.content || note.title || s.write_a_post;

  if (!author) return null;

  // Advanced Resource Preloader
  const preloadNoteResources = () => {
      if (!(REDBOOK_CONFIG as any).useLocalData) return;
      
      const resourcesToLoad: string[] = [];
      
      // 1. Note Images
      note.images?.forEach(img => resourcesToLoad.push(img));
      
      // 2. Author Avatar
      if (author?.avatar) resourcesToLoad.push(author.avatar);
      
      // 3. Comment Avatars (All of them)
      note.commentList?.forEach(c => {
          if (c.avatar) resourcesToLoad.push(c.avatar);
      });

      // Execute Preload
      resourcesToLoad.forEach(url => {
          const img = new Image();
          // Use low priority decoding to avoid blocking UI thread
          img.decoding = 'async';
          img.src = url;
      });
  };

  return (
    <div
        className="break-inside-avoid bg-app-surface rounded-[8px] overflow-hidden shadow-[0_0_8px_rgba(0,0,0,0.04)] active:opacity-90 transition-opacity cursor-pointer"
        {...bindTap('note.open', {
            params: { id: note.id },
            beforeTrigger: () => {
                // Start preloading in next idle frame to avoid blocking navigation animation
                if ('requestIdleCallback' in window) {
                    window.requestIdleCallback(preloadNoteResources);
                } else {
                    setTimeout(preloadNoteResources, 0);
                }
            }
        })}
        // Preload on touch/hover for faster reaction
        onTouchStart={preloadNoteResources}
        onMouseEnter={preloadNoteResources}
    >
      {/* 图片高度自适应：不限制 max-height，避免裁切 */}
      <div className="relative w-full overflow-hidden bg-gray-100">
        {showTextCard ? (
          <div className="w-full aspect-[3/4] flex items-center justify-center p-4 bg-[#fffbe6]">
            <div className={`w-[86%] mx-auto text-left overflow-hidden font-semibold text-[#333] whitespace-pre-wrap break-words ${getFeedTextCardClass(textCardValue)}`}>
              {textCardValue}
            </div>
          </div>
        ) : hasCoverImage ? (
          <>
            <img
              src={note.images[0]}
              alt={note.title}
              className="w-full h-auto object-contain block"
              loading="lazy"
            />
            {note.video && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-black/30 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <RedBookPlayIcon />
                </div>
            )}
          </>
        ) : (
          <div className="w-full h-32 flex items-center justify-center text-gray-400 bg-gray-200 text-xs">
             {s.no_image}
          </div>
        )}
      </div>
      <div className="p-2.5">
        {note.title && (
          <h3 className="text-[14px] font-bold leading-[1.4] line-clamp-2 mb-2 text-app-text">
              {note.title}
          </h3>
        )}
        <div className="flex items-center justify-between">
            <div
                className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                {...bindTap('user.open', { params: { userId: author.id }, stopPropagation: true })}
            >
                <img src={author.avatar} className="w-5 h-5 rounded-full bg-gray-200 object-cover flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-[#666] truncate leading-tight">{author.name}</span>
                    {showTime && (
                        <span className="text-[10px] text-app-text-muted truncate leading-tight scale-90 origin-left mt-0.5">
                            {formatTime(note.createdAt, s)}
                        </span>
                    )}
                </div>
            </div>
            <div
                className="flex items-center gap-1 flex-shrink-0 ml-2 cursor-pointer active:scale-95 transition-transform"
                {...bindTap(
                    { kind: 'action', id: 'note.item.like.toggle' },
                    { params: { noteId: note.id, to: !isLiked }, stopPropagation: true, onTrigger: () => toggleLike(note.id) },
                )}
            >
                {isLiked ? (
                    <RedBookHeartFilledIcon className="text-app-primary" />
                ) : (
                    <RedBookHeartOutlineIcon />
                )}
                <span className="text-[11px] text-[#666]">
                    {typeof note.likes === 'number'
                        ? (note.likes > 9999 ? (note.likes / 10000).toFixed(1) + 'w' : note.likes)
                        : note.likes}
                </span>
            </div>
        </div>
      </div>
    </div>
  );
};

// memo: feed 卡片随父组件 (HomePage) 频繁重渲染（滚动期间 homeState.displayCount 变化）会导致
// 全部 sibling NoteItem 跟着重渲染。note 引用在 fast path 下稳定，showTime 是基本类型，
// memo 直接挡掉 sibling 串扰。NoteItem 自己订阅的 store 字段变化时仍正常 re-render。
export const NoteItem = React.memo(NoteItemImpl);

const FollowNoteItemImpl: React.FC<{ note: Note }> = ({ note }) => {
    const { bindTap } = useRedBookGestures();
    const followUser = useRedBookStore(s => s.followUser);
    const author = useRedBookAuthor(note.authorId);
    const isFollowing = useIsFollowingUser(note.authorId);
    const s = useRedBookStrings();
    const hasCoverImage = !!(note.images && note.images[0]);
    const showTextCard = !hasCoverImage && !note.video;
    const textCardValue = note.content || note.title || s.write_a_post;

    if (!author) return null;

    return (
        <div className="bg-app-surface mb-2 p-4 border-b border-gray-100" {...bindTap('note.open', { params: { id: note.id } })}>
            <div className="flex items-center justify-between mb-3">
                <div
                    className="flex items-center gap-3 cursor-pointer"
                    {...bindTap('user.open', { params: { userId: author.id }, stopPropagation: true })}
                >
                    <img src={author.avatar} className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
                    <div>
                        <div className="text-[14px] font-medium text-app-text">{author.name}</div>
                        <div className="text-[11px] text-app-text-muted">{formatTime(note.createdAt, s)}</div>
                    </div>
                </div>
                <button
                    className="text-[12px] text-app-text-muted border border-[#eee] px-3 py-1 rounded-full"
                    {...bindTap(
                        { kind: 'action', id: 'home.follow.userFollow.toggle' },
                        { params: { userId: author.id, to: !isFollowing }, stopPropagation: true, onTrigger: () => followUser(author.id) }
                    )}
                >
                    {isFollowing ? s.following_2 : s.following}
                </button>
            </div>
            {/* 关注流图片高度自适应：不使用固定 4:3 裁切框 */}
            <div className="w-full bg-gray-100 rounded-lg overflow-hidden mb-3 relative">
                {showTextCard ? (
                    <div className="w-full aspect-[3/4] flex items-center justify-center p-4 bg-[#fffbe6]">
                        <div className={`w-[86%] mx-auto text-left overflow-hidden font-semibold text-[#333] whitespace-pre-wrap break-words ${getFeedTextCardClass(textCardValue)}`}>
                            {textCardValue}
                        </div>
                    </div>
                ) : hasCoverImage ? (
                    <>
                        <img src={note.images[0]} className="w-full h-auto object-contain block" />
                        {note.video && (
                             <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md">
                                    <RedBookPlayIcon size={24} />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-32 flex items-center justify-center text-gray-400 text-xs">{s.no_image}</div>
                )}
            </div>
            {note.title && <h3 className="text-[15px] font-bold leading-[1.4] mb-2 text-app-text">{note.title}</h3>}
            <div className="flex items-center justify-between text-app-text-muted text-[12px]">
                 <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        <RedBookHeartIcon />
                        {note.likes}
                    </span>
                    <span className="flex items-center gap-1">
                        <RedBookCommentIcon />
                        {note.comments}
                    </span>
                 </div>
                 <Share2 size={14} />
            </div>
        </div>
    )
}

const FollowNoteItem = React.memo(FollowNoteItemImpl);

export const DiscoveryFeed: React.FC<{ feed: Note[]; showTime?: boolean }> = ({ feed, showTime }) => {
    const [col1, col2] = useMemo(() => {
        const c1: Note[] = [];
        const c2: Note[] = [];
        // The feed passed here should already be filtered by the parent
        feed.forEach((note, i) => {
            if (i % 2 === 0) c1.push(note);
            else c2.push(note);
        });
        return [c1, c2];
    }, [feed]);

    return (
        <div className="flex gap-[5px] items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
                {col1.map(note => <NoteItem key={note.id} note={note} showTime={showTime} />)}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
                {col2.map(note => <NoteItem key={note.id} note={note} showTime={showTime} />)}
            </div>
        </div>
    );
};

const FollowUpdates: React.FC = () => {
    const currentUser = useRedBookStore(s => s.user);
    const view = useRedBookView();
    const { bindTap } = useRedBookGestures();
    const s = useRedBookStrings();
    
    const followedUsers = useMemo(() => {
        const set = new Set(currentUser.followingIds || []);
        return view.userIds.map(id => view.usersById[id]).filter(Boolean).filter(u => set.has(u.id));
    }, [view.usersById, view.userIds, currentUser.followingIds]);

    return (
        <div className="bg-app-surface mb-2 pt-3 pb-3">
             <div className="flex overflow-x-auto no-scrollbar gap-4 px-4">
                 {followedUsers.map(u => (
                     <div
                        key={u.id}
                        className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
                        {...bindTap('user.open', { params: { userId: u.id }, stopPropagation: true })}
                     >
                         <div className="w-(--app-follow-story-avatar-size) h-(--app-follow-story-avatar-size) rounded-full p-[2px] border-[2px] border-app-primary relative">
                             <img src={u.avatar} className="w-full h-full rounded-full object-cover bg-gray-100" />
                         </div>
                         <span className="text-[11px] text-app-text w-(--app-follow-story-avatar-size) text-center truncate">{u.name}</span>
                     </div>
                 ))}
                 {/* Add more button or suggested users */}
                 <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer">
                     <div className="w-(--app-follow-story-avatar-size) h-(--app-follow-story-avatar-size) rounded-full flex items-center justify-center bg-gray-50 border border-dashed border-gray-300">
                         <span className="text-gray-400 text-xl">+</span>
                     </div>
                     <span className="text-[11px] text-app-text-muted w-(--app-follow-story-avatar-size) text-center">{s.homepage_more}</span>
                 </div>
             </div>
        </div>
    );
};

const FollowFeed: React.FC<{ feed: Note[] }> = ({ feed }) => {
    const { user: currentUser } = useRedBookStore(useShallow(s => ({ user: s.user })));
    const s = useRedBookStrings();
    const followedUserIds = useMemo(() => currentUser.followingIds || [], [currentUser.followingIds]);
    
    const followedNotes = useMemo(() => {
        // Mock: if no followed notes, show some random ones to simulate the screenshot look
        const realNotes = feed.filter(note => followedUserIds.includes(note.authorId));
        return realNotes.length > 0 ? realNotes : feed.slice(0, 6);
    }, [feed, followedUserIds]);
    
    return (
        <div className="flex flex-col">
            <FollowUpdates />
            {followedNotes.length > 0 ? (
                <DiscoveryFeed feed={followedNotes} showTime={true} />
            ) : (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <RedBookPeopleIcon />
                    </div>
                    <p className="text-sm">{s.follow_people_you_like_to_see_their_posts}</p>
                </div>
            )}
            <div className="py-8 text-center text-xs text-gray-300">
                {s.no_more_following_content}
            </div>
        </div>
    );
}

const HotFeed: React.FC<{ feed: Note[] }> = ({ feed }) => {
     return <DiscoveryFeed feed={feed} />;
}

const initialMyChannels: StringKey[] = ['recommend', 'video', 'live', 'short_drama', 'avatar', 'fashion', 'wallpaper', 'food', 'emotions', 'music', 'nails', 'funny', 'crafts', 'travel', 'makeup', 'hairstyle', 'dance', 'drawing', 'reading', 'home_decor', 'celebrity', 'movies_and_tv', 'games', 'photography'];
const initialRecChannels: StringKey[] = ['anime', 'home_2', 'cars', 'weight_loss', 'study', 'skincare', 'wedding', 'stationery', 'sneakers', 'career', 'culture', 'pets', 'tech', 'fitness', 'variety_shows', 'bags', 'science', 'baby', 'homepage_art', 'psychology', 'motorcycle', 'campus', 'sports', 'outdoor', 'figures', 'camping', 'social_science', 'humanities'];

// Beijing City Data
const cityTabs: StringKey[] = ['recommend', 'food', 'popular_spots', 'weekend_trips', 'nearby_travel', 'attractions'];
const districts: StringKey[] = ['popular_areas', 'dongcheng', 'chaoyang', 'haidian', 'tongzhou', 'daxing', 'xicheng', 'fengtai'];
const areas: StringKey[] = ['sanlitun', 'wangjing', 'liyuan', 'yaojiayuan', 'jianwai_ave', 'dawang_rd', 'hongmiao', 'xiyuan'];

export const HomePage: React.FC = () => {
  const { tempNav, updateHomeState, user: currentUser } = useRedBookStore(useShallow(s => ({
    tempNav: s._temp,
    updateHomeState: s.updateHomeState,
    user: s.user,
  })));
  const view = useRedBookView();
  const { activeCategory, citySubTab } = tempNav;
  // displayCount 是纯 UI 滚动状态（"已展开的卡片数"），不属于 app data：
  // - 刷新页面后 React tree 重置、用户重新进入 → 列表当然也从首批开始展开，没必要持久化
  // - 不进 Zustand store 后 bench `__SIM__.getState()` 不再含此字段，任务 diff 不再
  //   误把"用户滚了几下"当成"用户改了 state"
  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;
  const feed = useMemo(() => view.feedIds.map(id => view.notesById[id]).filter(Boolean), [view.feedIds, view.notesById]);
  const s = useRedBookStrings();

  // Memoize hot feed to avoid re-sorting on tab switch
  const hotFeed = useMemo(() => {
      return [...feed].sort((a, b) => parseCount(b.likes) - parseCount(a.likes));
  }, [feed]);
  
  const location = useLocation();
  // HomePage is rendered with a persistent-mount layout (display none/block).
  // When user navigates to other routes (e.g. /me?tab=notes), location.search changes,
  // but HomePage should NOT interpret non-home query params as its own UI state.
  // So we snapshot the last-known home search string only when pathname === '/'.
  const isHomePath = location.pathname === '/';
  const lastHomeSearchRef = React.useRef<string>('?tab=discover');
  if (isHomePath) {
    lastHomeSearchRef.current = location.search || '?tab=discover';
  }
  const homeSearchParams = new URLSearchParams(lastHomeSearchRef.current);
  const isDrawerOpen = homeSearchParams.get('menu') === 'drawer';

  const tabParamRaw = homeSearchParams.get('tab');
  const activeTab: 'follow' | 'discover' | 'city' =
    tabParamRaw === 'follow' || tabParamRaw === 'discover' || tabParamRaw === 'city'
      ? tabParamRaw
      : 'discover';
  const { bindTap, back, go } = useRedBookGestures();

  // Local state for UI only
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [myChannels, setMyChannels] = useState(initialMyChannels);
  const [recChannels, setRecChannels] = useState(initialRecChannels);
  
  // City Dropdown State
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<StringKey>('popular_areas');

  // Each home tab gets its own scroll container so switching tabs never mutates/clamps scrollTop
  // (single shared container would be clamped when switching to a shorter tab).
  const discoverScrollRef = React.useRef<HTMLDivElement>(null);
  const followScrollRef = React.useRef<HTMLDivElement>(null);
  const cityScrollRef = React.useRef<HTMLDivElement>(null);

  // NOTE: 首页入口由 MemoryRouter initialEntries 与 onNavigate 规范化保证带 tab=discover

  // Reset pagination when category changes (but not when restoring state)
  // We might want to persist displayCount too, but let's keep it simple for now (resetting list length might jump scroll)
  // Ideally, if we restore scroll, we should restore list length too.
  // For now, let's just ensure we have enough items if scroll position is deep?
  // Or just rely on "Load More" triggering if we scroll down?
  // 注意：不要在 tab/category 变化时重置滚动或分页长度（产品要求：任何切换都不影响滚动）。

  const setActiveTab = (tab: 'follow' | 'discover' | 'city') => {
      // URL 驱动 tab。按产品要求：无论首页内部怎么切换（tab/category/subTab），
      // 都不应主动修改滚动位置或分页长度（否则会造成“回到之前位置丢失/跳动”）。
      // 如需做 UI-only 的收起/关闭逻辑，请用本地 state（不影响 scrollTop）。
  };
  const setActiveCategory = (cat: string) => {
      updateHomeState({ activeCategory: cat });
  };
  const setCitySubTab = (tab: string) => updateHomeState({ citySubTab: tab });

  // 注意：不要在这里（或任何 effect）主动设置 scrollTop=0。
  // 首页使用 Layout 的常驻挂载模式，应让 DOM 自己维持滚动位置。

  // rAF 节流 + 200ms gate：
  // - scroll 事件 ~100Hz；rAF 把多次 dispatch 收敛到每帧一次
  // - 200ms gate 进一步防止"接近底部但分类过滤后已无更多可见 feed 时"持续触发空 dispatch
  //   （例如 discover 按 category 过滤剩 80 条，displayCount 涨到 80+ 后还会一直触发，
  //    用 feed.length 当上限挡不住——filtered length 在父组件外推算成本高）
  const scrollRafRef = React.useRef<number | null>(null);
  // -Infinity：让首次触底永远满足 `now - last > 200`（初值 0 会在页面 mount 后前 200ms 内
  // 不可达——理论上 performance.now() 已远大于 200ms，但语义更稳）。
  const lastLoadMoreAtRef = React.useRef<number>(-Infinity);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (scrollRafRef.current != null) return;
      const el = e.currentTarget;
      scrollRafRef.current = requestAnimationFrame(() => {
          scrollRafRef.current = null;
          const { scrollTop, scrollHeight, clientHeight } = el;
          if (scrollHeight - scrollTop - clientHeight < 800 && displayCount < feed.length) {
              const now = performance.now();
              if (now - lastLoadMoreAtRef.current > 200) {
                  lastLoadMoreAtRef.current = now;
                  setDisplayCount(c => Math.min(c + PAGE_SIZE, feed.length));
              }
          }
      });
  };
  React.useEffect(() => () => {
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
  }, []);

  // 图片预加载：只在 (displayCount, feed.length) 组合变化时跑一次。
  // 用组合 key 而不是单 displayCount——首屏 feed 从 [] → N 条时 displayCount 不变，
  // 但需要触发首批预加载；单 displayCount guard 会漏掉这种情况。
  const lastPreloadedKeyRef = React.useRef<string>('');
  React.useEffect(() => {
      const key = `${displayCount}:${feed.length}`;
      if (lastPreloadedKeyRef.current === key) return;
      lastPreloadedKeyRef.current = key;
      const nextNotes = feed.slice(displayCount, displayCount + 10);
      const localMode = (REDBOOK_CONFIG as any).useLocalData;
      for (const n of nextNotes) {
          if (n.images?.[0]) {
              const img = new Image();
              img.src = n.images[0];
          }
          if (!localMode) continue;
          const author = n.authorId
            ? (n.authorId === currentUser.id ? currentUser : view.usersById[n.authorId])
            : undefined;
          if (author?.avatar) {
              const av = new Image();
              av.src = author.avatar;
          }
          if (n.commentList?.length) {
              const preloadComments = () => {
                  (n.commentList ?? []).forEach(c => {
                      if (c.avatar) {
                          const cAvatar = new Image();
                          cAvatar.src = c.avatar;
                      }
                  });
              };
              if ('requestIdleCallback' in window) window.requestIdleCallback(preloadComments);
              else setTimeout(preloadComments, 0);
          }
      }
  }, [displayCount, feed, currentUser, view.usersById]);

  return (
    <div className="h-full flex flex-col bg-[#f8f8f8] relative">
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-app-surface pt-10 px-3 pb-0">
        <div className="flex items-center justify-between h-(--app-home-nav-height)">
            <div className="w-8 flex items-center justify-start" {...bindTap('home.drawer.open')}>
                 <Menu className="w-6 h-6 text-app-text" strokeWidth={2} />
            </div>

            <div className="flex items-center gap-6">
                <div
                    className="flex flex-col items-center cursor-pointer"
                    {...bindTap('home.tab.switch', {
                        params: { tab: 'follow' },
                        // 不能传 onTrigger（会覆盖 execute 导致不导航）；用 beforeTrigger 做本地状态准备
                        beforeTrigger: () => setActiveTab('follow'),
                    })}
                >
                    <span className={`text-[17px] transition-all ${activeTab === 'follow' ? 'font-bold text-app-text' : 'font-medium text-app-text-muted'}`}>{s.following}</span>
                    {activeTab === 'follow' && <div className="w-8 h-[2px] bg-app-primary rounded-full mt-1"></div>}
                </div>

                <div
                    className="flex flex-col items-center cursor-pointer"
                    {...bindTap('home.tab.switch', {
                        params: { tab: 'discover' },
                        beforeTrigger: () => setActiveTab('discover'),
                    })}
                >
                    <span className={`text-[17px] transition-all ${activeTab === 'discover' ? 'font-bold text-app-text' : 'font-medium text-app-text-muted'}`}>{s.explore}</span>
                    {activeTab === 'discover' && <div className="w-8 h-[2px] bg-app-primary rounded-full mt-1"></div>}
                </div>

                <div
                    className="flex flex-col items-center cursor-pointer"
                    {...bindTap('home.tab.switch', {
                        params: { tab: 'city' },
                        beforeTrigger: () => setActiveTab('city'),
                    })}
                >
                    <span className={`text-[17px] transition-all ${activeTab === 'city' ? 'font-bold text-app-text' : 'font-medium text-app-text-muted'}`}>{s.nearby}</span>
                    {activeTab === 'city' && <div className="w-8 h-[2px] bg-app-primary rounded-full mt-1"></div>}
                </div>
            </div>

            <div className="w-8 flex items-center justify-end cursor-pointer" {...bindTap('search.open')}>
                <Search className="w-6 h-6 text-app-text" strokeWidth={2} />
            </div>
        </div>

        {/* Beijing City Sub-tabs & Dropdown */}
        {activeTab === 'city' && (
            <div className="relative mt-2">
                <div className="flex items-center h-[40px] bg-app-surface px-3 border-b border-gray-50">
                    <div className="flex items-center gap-1 mr-6 cursor-pointer" onClick={() => setShowCityDropdown(!showCityDropdown)}>
                        <span className={`text-[16px] ${showCityDropdown ? 'font-bold text-app-text' : 'text-app-text'}`}>{s.homepage_all}</span>
                        <ChevronDown size={14} className={`text-app-text transition-transform ${showCityDropdown ? 'rotate-180' : ''}`} style={{ transitionDuration: 'var(--app-duration-short)' }} />
                    </div>
                    <div className="flex-1 overflow-x-auto no-scrollbar flex gap-8">
                        {cityTabs.map(tab => (
                            <span
                                key={tab}
                                className={`text-[16px] whitespace-nowrap cursor-pointer ${citySubTab === tab ? 'text-app-text font-bold' : 'text-app-text-muted'}`}
                                onClick={() => setCitySubTab(tab)}
                            >
                                {s[tab]}
                            </span>
                        ))}
                    </div>
                </div>

                {/* City Dropdown Overlay */}
                {showCityDropdown && (
                    <div className="absolute top-[40px] left-0 right-0 bottom-[-100vh] bg-app-surface z-50 flex flex-col h-[calc(100vh-120px)]">
                        {/* Map Banner */}
                        <div className="px-3 py-2">
                            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-app-text font-medium text-[14px]">
                                    <ScanLine size={16} className="text-blue-500" />
                                    {s.map_explore} <ChevronRight size={12} className="text-gray-400" />
                                </div>
                                <div className="bg-gray-200 px-2 py-1 rounded text-[11px] text-[#666]">{s.nearby_2}</div>
                            </div>
                        </div>

                        {/* Distance Filter */}
                        <div className="px-3 mb-2">
                            <div className="text-[12px] text-app-text-muted mb-2">{s.distance}</div>
                            <div className="flex gap-3">
                                {[s.whole_city, '1km', '3km', '5km'].map((d, idx) => (
                                    <div key={d} className={`flex-1 h-[32px] flex items-center justify-center rounded-[4px] text-[13px] ${idx === 0 ? 'bg-app-primary/5 text-app-primary border border-app-primary' : 'bg-gray-50 text-app-text'}`}>
                                        {d}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* District Selector */}
                        <div className="flex-1 flex border-t border-gray-100">
                            {/* Sidebar */}
                            <div className="w-(--app-city-sidebar-width) bg-gray-50 overflow-y-auto">
                                {districts.map(d => (
                                    <div
                                        key={d}
                                        className={`h-(--app-city-sidebar-item-height) flex items-center justify-center text-[13px] cursor-pointer ${selectedDistrict === d ? 'bg-app-surface font-bold text-app-primary border-l-[3px] border-l-app-primary' : 'text-[#666]'}`}
                                        onClick={() => setSelectedDistrict(d)}
                                    >
                                        {s[d]}
                                    </div>
                                ))}
                            </div>
                            {/* Content */}
                            <div className="flex-1 bg-app-surface overflow-y-auto p-4">
                                <div className="text-[12px] text-app-primary mb-3 font-medium">{s[selectedDistrict]}</div>
                                <div className="flex flex-col gap-4">
                                    {areas.map(area => (
                                        <div key={area} className="text-[14px] text-app-text cursor-pointer hover:text-app-primary">{s[area]}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Category dropdown overlay — fixed above scroll content */}
      {activeTab === 'discover' && showCategoryDropdown && (
        <div className="fixed top-[76px] left-0 right-0 bottom-0 z-50 bg-app-surface flex flex-col">
             <div className="flex items-center justify-between px-3 py-2 bg-app-surface">
                <div className="text-[14px] text-app-text font-bold">{s.my_channels} <span className="text-[11px] font-normal text-app-text-muted ml-2">{s.tap_to_enter_channel}</span></div>
                <div className="flex items-center gap-3">
                    <button className="bg-gray-100 text-app-text text-[11px] px-3 py-1 rounded-full">{s.homepage_edit}</button>
                    <ChevronUp size={20} className="text-gray-400" onClick={() => setShowCategoryDropdown(false)} />
                </div>
             </div>
             <div className="flex-1 overflow-y-auto px-3 pb-20">
                <div className="grid grid-cols-4 gap-3 mb-6">
                    {myChannels.map(c => (
                        <div
                            key={c}
                            className={`h-(--app-channel-item-height) flex items-center justify-center text-[13px] rounded-[4px] cursor-pointer ${activeCategory === c ? 'text-app-primary font-bold bg-app-surface border border-app-primary' : 'bg-gray-50 text-app-text'}`}
                            onClick={() => { setActiveCategory(c); setShowCategoryDropdown(false); }}
                        >
                            {s[c]}
                        </div>
                    ))}
                </div>
                
                <div className="text-[14px] text-app-text font-bold mb-3">{s.recommended_channels} <span className="text-[11px] font-normal text-app-text-muted ml-2">{s.tap_to_add_channel}</span></div>
                <div className="grid grid-cols-4 gap-3">
                    {recChannels.map(c => (
                        <div key={c} className="bg-app-surface border border-gray-100 h-(--app-channel-item-height) flex items-center justify-center text-[13px] text-app-text rounded-[4px] relative cursor-pointer active:bg-gray-50">
                            <span className="text-app-text-muted mr-1 text-[16px] leading-none">+</span> {s[c]}
                        </div>
                    ))}
                </div>
             </div>
        </div>
      )}

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden">
        {/* Discover */}
        <div
          id="redbook-home-scroll-discover"
          ref={discoverScrollRef}
          data-scroll-container="main"
          data-scroll-direction="vertical"
          className="h-full overflow-y-auto no-scrollbar px-[5px] pb-4 pt-[76px]"
          style={{ display: activeTab === 'discover' ? 'block' : 'none' }}
          onScroll={handleScroll}
        >
          {/* Category bar — scrolls with content, hidden behind topbar when scrolled down */}
          {!showCategoryDropdown && (
            <div className="bg-app-surface -mx-[5px] px-3 mb-1">
                <div className="flex items-center">
                    <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar gap-6 pb-2 px-1 pt-1 flex">
                        {myChannels.map((cat) => (
                            <span
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`text-[16px] whitespace-nowrap flex-shrink-0 transition-all cursor-pointer ${
                                    activeCategory === cat
                                    ? 'text-app-text font-bold'
                                    : 'text-app-text-muted font-normal'
                                }`}
                            >
                                {s[cat]}
                            </span>
                        ))}
                    </div>
                    <div
                        className="flex-shrink-0 w-8 flex items-center justify-center cursor-pointer pb-2"
                        onClick={() => setShowCategoryDropdown(true)}
                    >
                        <ChevronDown size={16} className="text-gray-500" />
                    </div>
                </div>
            </div>
          )}
          <DiscoveryFeed
            feed={feed
              .filter(note => {
                // activeCategory is a StringKey (e.g. 'recommend'); note.category is Chinese (e.g. '推荐').
                // Map the key to its Chinese label and compare.
                const activeCategoryLabel = strings[activeCategory as StringKey];
                if (!activeCategoryLabel) return true;
                return note.category === activeCategoryLabel;
              })
              .slice(0, displayCount)}
          />
          <div className="py-4 text-center text-xs text-gray-300">- THE END -</div>
        </div>

        {/* Follow */}
        <div
          id="redbook-home-scroll-follow"
          ref={followScrollRef}
          data-scroll-container="main"
          data-scroll-direction="vertical"
          className="h-full overflow-y-auto no-scrollbar px-[5px] pb-4 pt-[76px]"
          style={{ display: activeTab === 'follow' ? 'block' : 'none' }}
        >
          <FollowFeed feed={feed} />
        </div>

        {/* City */}
        <div
          id="redbook-home-scroll-city"
          ref={cityScrollRef}
          data-scroll-container="main"
          data-scroll-direction="vertical"
          className="h-full overflow-y-auto no-scrollbar px-[5px] pb-4 pt-[76px]"
          style={{ display: activeTab === 'city' ? 'block' : 'none' }}
          onScroll={handleScroll}
        >
          <HotFeed feed={hotFeed.slice(0, displayCount)} />
        </div>
      </div>

      {/* Drawer Menu */}
      <Drawer isOpen={isDrawerOpen} />
    </div>
  );
};
