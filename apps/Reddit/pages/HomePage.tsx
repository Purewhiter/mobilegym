import React from 'react';
import { TopBar } from '../components/TopBar';
import type { RedditPost } from '../types';
import { useRedditStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedditPosts } from '../hooks/useRedditPosts';
import {
  IcUpvote,
  IcDownvote,
  IcMore,
  IcMoreVert,
  IcMedal,
  IcMessage,
  IcMail,
  IcComment,
  IcBell,
  IcBookmark,
  IcLanguage,
  IcSettings,
  IcFlag,
  IcEyeOff,
  IcHelp,
  IcCopy,
  IcShare,
} from '../res/icons';
import { useRedditGestures } from '../hooks/useRedditGestures';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Reddit/${s}`; };

/* ── helpers (module-level, stable) ── */

const normalizeUsername = (raw: unknown): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.startsWith('u/')) return s.slice(2);
  if (s.startsWith('/u/')) return s.slice(3);
  return s;
};

const parseCountToNumber = (raw: string): number | null => {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s.includes('万')) { const n = Number.parseFloat(s.replace('万', '')); return Number.isFinite(n) ? n * 10000 : null; }
  if (/[kK]$/.test(s)) { const n = Number.parseFloat(s.slice(0, -1)); return Number.isFinite(n) ? n * 1000 : null; }
  const n = Number.parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const formatCountWithK = (n: number): string => {
  const rounded = Math.max(0, Math.round(n));
  if (rounded < 1000) return String(rounded);
  const k = rounded / 1000;
  const str = rounded < 10000 ? k.toFixed(1) : k.toFixed(0);
  return `${str.endsWith('.0') ? str.slice(0, -2) : str}k`;
};

const formatVoteScore = (rawUpvotes: string, voted: 'up' | 'down' | undefined): string => {
  const n = parseCountToNumber(rawUpvotes);
  if (n === null) return rawUpvotes;
  return formatCountWithK(n + (voted === 'up' ? 1 : voted === 'down' ? -1 : 0));
};

const PAGE_SIZE = 20;

/* ── Multi-image carousel (rAF-throttled scroll) ── */
const PostImageCarousel: React.FC<{ images: string[] }> = React.memo(({ images }) => {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const rafRef = React.useRef(0);

  const handleScroll = React.useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      setActiveIdx(Math.min(Math.round(el.scrollLeft / el.clientWidth), images.length - 1));
    });
  }, [images.length]);

  React.useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <div className="px-4 relative">
      <div className="rounded-2xl overflow-hidden bg-gray-100 relative">
        <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar" onScroll={handleScroll}>
          {images.map((src, idx) => (
            <div key={`${src}-${idx}`} className="w-full flex-shrink-0 snap-center">
              <img src={src} loading="lazy" className="w-full h-auto object-cover max-h-(--app-post-image-max-height)" />
            </div>
          ))}
        </div>
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {images.map((_, idx) => (
            <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === activeIdx ? 'bg-white' : 'bg-white/40'}`} />
          ))}
        </div>
        <div className="absolute top-2 right-3 bg-black/50 rounded-full px-2 py-0.5">
          <span className="text-[11px] text-white font-bold">{activeIdx + 1}/{images.length}</span>
        </div>
      </div>
    </div>
  );
});

/* ── Memoized post card ── */

interface PostCardProps {
  post: RedditPost;
  voted: 'up' | 'down' | undefined;
  isJoined: boolean;
  onVote: (postId: string, dir: 'up' | 'down') => void;
  onToggleJoin: (communityId: string) => void;
  onMoreMenu: (postId: string) => void;
  onPostClick: (e: React.MouseEvent, postId: string) => void;
}

// 注意：bindTap 不能作为 prop 传入——`useTriggerGestures` 内的 bindTap 是普通函数
// 声明，每次 HomePage rerender 都是新引用，会让 React.memo 的浅比较失败导致全表卡片
// 重渲染。改为在卡片内部调用 useRedditGestures()，让 prop 集合保持稳定（post 引用
// 由 useRedditPosts useMemo 保证、voted/isJoined 是原始值、其他 callback 已 useCallback
// 化或是 Zustand action）。
const PostCard: React.FC<PostCardProps> = React.memo(({
  post, voted, isJoined, onVote, onToggleJoin, onMoreMenu, onPostClick,
}) => {
  const { bindTap } = useRedditGestures();
  const communityId = post.subreddit;
  return (
    <div
      className="bg-app-surface mb-2 pb-2 cursor-pointer"
      onClick={(e) => onPostClick(e, post.id)}
    >
      {/* Header */}
      <div className="flex items-center justify-between pl-4 pr-2 py-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 relative">
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-app-text-muted select-none">r</div>
            {post.subredditIcon && (
              <img src={post.subredditIcon} loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-sm text-black shrink-0">{post.subreddit}</span>
              <div className="flex items-center gap-1 text-app-text-muted text-xs min-w-0">
                <span className="shrink-0">•</span>
                <button
                  type="button"
                  aria-label="Open user profile"
                  {...bindTap('profile.user.open', { params: { username: normalizeUsername(post.author) } })}
                  className="w-4 h-4 rounded-full bg-gray-200 overflow-hidden relative flex-shrink-0"
                >
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-app-text-muted select-none">u</div>
                  {post.authorAvatar && (
                    <img src={post.authorAvatar} loading="lazy" className="absolute inset-0 w-full h-full object-cover" alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />
                  )}
                </button>
                <span className="truncate">{post.author}</span>
                <span className="shrink-0">•</span>
                <span className="shrink-0">{post.timeAgo}</span>
              </div>
            </div>
            {post.isAd && <span className="text-xs text-app-text-muted">Promoted</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {!post.isAd && (
            <button
              {...bindTap(
                { kind: 'action', id: 'homeFeed.item.join.toggle' },
                { params: { communityId }, onTrigger: () => onToggleJoin(communityId) },
              )}
              className={`px-3 py-1 rounded-full text-xs font-bold ${isJoined ? 'bg-gray-200 text-gray-700' : 'bg-[#0045AC] text-white'}`}
            >
              {isJoined ? 'Joined' : 'Join'}
            </button>
          )}
          {!post.isAd && (
            <button type="button" aria-label="Post menu" onClick={() => onMoreMenu(post.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 active:bg-gray-100">
              <IcMoreVert className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="px-4 pb-2">
        <h3 className="font-bold text-lg leading-snug text-black">{post.title}</h3>
      </div>

      {/* Images */}
      {(() => {
        const imgs = post.images ?? (post.image ? [post.image] : []);
        if (imgs.length === 0) return null;
        if (imgs.length === 1) {
          return (
            <div className="px-4">
              <div className="rounded-2xl overflow-hidden bg-gray-100">
                <img src={imgs[0]} loading="lazy" className="w-full h-auto object-cover max-h-(--app-post-image-max-height)" />
              </div>
            </div>
          );
        }
        return <PostImageCarousel images={imgs} />;
      })()}

      {/* Footer Actions */}
      {!post.isAd && (
        <div className="flex items-center justify-between px-4 mt-2 gap-2 overflow-hidden">
          <div className="flex items-center gap-1 border border-app-border rounded-full bg-app-surface shrink-0">
            <button {...bindTap({ kind: 'action', id: 'homeFeed.item.vote.select.up' }, { params: { postId: post.id }, onTrigger: () => onVote(post.id, 'up') })} className="p-1.5">
              <IcUpvote className={`w-6 h-6 ${voted === 'up' ? 'text-app-primary' : 'text-app-text-muted'}`} strokeWidth={1.5} />
            </button>
            <span className="text-sm font-bold text-gray-700 mx-1">{formatVoteScore(post.upvotes, voted)}</span>
            <div className="w-px h-6 bg-gray-200" />
            <button {...bindTap({ kind: 'action', id: 'homeFeed.item.vote.select.down' }, { params: { postId: post.id }, onTrigger: () => onVote(post.id, 'down') })} className="p-1.5">
              <IcDownvote className={`w-6 h-6 ${voted === 'down' ? 'text-[#7193FF]' : 'text-app-text-muted'}`} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <button type="button" {...bindTap('post.comments.open', { params: { postId: post.id } })} className="flex items-center gap-2 border border-app-border rounded-full px-3 py-1.5 bg-app-surface active:bg-gray-50">
              <img src={asset('basic/icon_comment.png')} alt="Comments" className="w-6 h-5 object-contain opacity-60" draggable={false} />
              <span className="text-sm font-bold text-gray-700">{post.comments}</span>
            </button>
            <div className="h-(--app-medal-btn-size) w-(--app-medal-btn-size) rounded-full border border-app-border bg-app-surface flex items-center justify-center" aria-hidden="true">
              <IcMedal className="w-(--app-medal-icon-size) h-(--app-medal-icon-size) text-app-text-muted" strokeWidth={1.8} />
            </div>
            <button {...bindTap({ kind: 'action', id: 'homeFeed.item.share' }, { params: { postId: post.id }, onTrigger: () => {} })} className="flex items-center gap-2 border border-app-border rounded-full px-3 py-1.5 bg-app-surface">
              <img src={asset('basic/icon_share.png')} alt="Share" className="w-6 h-5 object-contain opacity-60" draggable={false} />
              <span className="text-sm font-bold text-gray-700">{typeof post.shares === 'number' && post.shares > 0 ? String(post.shares) : 'Share'}</span>
            </button>
          </div>
        </div>
      )}

      {post.isAd && (
        <div className="px-4 mt-2"><div className="h-8 bg-gray-100 rounded" /></div>
      )}
    </div>
  );
});

/* ── Main page ── */

export const HomePage: React.FC = () => {
  const posts = useRedditPosts();
  const { joinedCommunityIds, postVotes } = useRedditStore(useShallow((s) => ({
    joinedCommunityIds: s.user.joinedCommunityIds,
    postVotes: s.user.postVotes,
  })));
  const votePost = useRedditStore((s) => s.votePost);
  const toggleJoin = useRedditStore((s) => s.toggleJoin);
  const { go } = useRedditGestures();
  const [postMoreMenuPostId, setPostMoreMenuPostId] = React.useState<string | null>(null);

  const [displayCount, setDisplayCount] = React.useState(PAGE_SIZE);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const loadingRef = React.useRef(false);

  const closePostMoreMenu = React.useCallback(() => { setPostMoreMenuPostId(null); }, []);

  const handlePostClick = React.useCallback(
    (e: React.MouseEvent, postId: string) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.('button, a, [data-trigger], [data-action], [data-comment-action]')) return;
      go('post.comments.open', { postId });
    },
    [go],
  );

  const openMoreMenu = React.useCallback((postId: string) => { setPostMoreMenuPostId(postId); }, []);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let rafId = 0;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (loadingRef.current || displayCount >= posts.length) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop - clientHeight < 800) {
          loadingRef.current = true;
          setDisplayCount(prev => Math.min(prev + PAGE_SIZE, posts.length));
          loadingRef.current = false;
        }
      });
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [displayCount, posts.length]);

  return (
    <div className="flex flex-col h-full bg-[#DAE0E6] relative">
      <TopBar isHome />

      {postMoreMenuPostId && (
        <div className="fixed inset-0 z-[250]">
          <div className="absolute inset-0 bg-black/40" aria-label="Close post menu" onClick={closePostMoreMenu} />
          <div
            className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-3xl px-4 pt-3 pb-8 shadow-[0_-12px_28px_rgba(0,0,0,0.18)]"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-3"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-2 pb-3">
              {[
                { bg: 'bg-gray-100', icon: <IcMessage className="w-6 h-6 text-blue-600" strokeWidth={2} /> },
                { bg: 'bg-gray-100', icon: <IcMail className="w-6 h-6 text-gray-700" strokeWidth={2} /> },
                { bg: 'bg-gray-100', icon: <IcComment className="w-6 h-6 text-green-600" strokeWidth={2} /> },
                { bg: 'bg-gray-100', icon: <IcMore className="w-6 h-6 text-gray-700" strokeWidth={2} /> },
              ].map((x, idx) => (
                <div key={idx} className={`w-14 h-14 rounded-full ${x.bg} flex items-center justify-center`} aria-hidden="true">{x.icon}</div>
              ))}
            </div>
            <div className="pt-2">
              {[
                { icon: IcBell, label: '关注帖子' },
                { icon: IcBookmark, label: '保存' },
                { icon: IcLanguage, label: '翻译' },
                { icon: IcSettings, label: '翻译设置' },
                { icon: IcFlag, label: '举报' },
                { icon: IcEyeOff, label: '减少显示此类帖子' },
                { icon: IcHelp, label: '为何向我推荐此内容？' },
                { icon: IcCopy, label: '复制文本' },
                { icon: IcShare, label: '转发到社区' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-4 py-3">
                    <Icon className="w-6 h-6 text-gray-800" strokeWidth={1.8} />
                    <span className="text-[16px] text-app-text">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {posts.slice(0, displayCount).map((post) => (
          <PostCard
            key={post.id}
            post={post}
            voted={postVotes[post.id]}
            isJoined={joinedCommunityIds.includes(post.subreddit)}
            onVote={votePost}
            onToggleJoin={toggleJoin}
            onMoreMenu={openMoreMenu}
            onPostClick={handlePostClick}
          />
        ))}

        {displayCount < posts.length && (
          <div className="flex justify-center items-center py-6">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-[#FF4500] rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};
