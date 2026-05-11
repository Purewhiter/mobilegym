import React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAppStrings } from '@/os/useAppStrings';
import {
  IcArrowBack, IcUpvote, IcDownvote, IcSearch, IcShare, IcMore, IcMoreVert,
  IcNavForward, IcFilter, IcEye, IcSend, IcMedal,
  IcBell, IcBookmark, IcDelete, IcFlag, IcCopy, IcMessage, IcMail, IcComment, IcAddCircle,
  IcClose, IcSettings, IcUser, IcPen, IcClock, IcShirt, IcSquareAsterisk,
} from '../res/icons';
import { useRedditStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useMyRedditComments } from '../hooks/useRedditComments';
import { useRedditPosts } from '../hooks/useRedditPosts';
import type { RedditPost } from '../types';
import * as TimeService from '../../../os/TimeService';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Reddit/${s}`; };

type ProfileTabKey = 'posts' | 'comments' | 'about';

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const formatCompactInt = (n: number): string => {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\\.0$/, '')}k`;
  return `${Math.round(n / 1000)}k`;
};

const toMs = (createdUtc: number): number => {
  // Support seconds or milliseconds.
  return createdUtc < 1e12 ? createdUtc * 1000 : createdUtc;
};

const formatAgo = (createdUtc: number): string => {
  const now = TimeService.now();
  const created = toMs(createdUtc);
  const diff = Math.max(0, now - created);
  if (diff < 60_000) return 'now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

/* ── Multi-image carousel (profile) ── */
const ProfilePostImageCarousel: React.FC<{ images: string[] }> = ({ images }) => {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const rafRef = React.useRef(0);

  const handleScroll = React.useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.min(Math.round(el.scrollLeft / el.clientWidth), images.length - 1);
      setActiveIdx((prev) => (prev === idx ? prev : idx));
    });
  }, [images.length]);

  React.useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="w-full rounded-xl overflow-hidden mb-2 relative bg-gray-100">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
        onScroll={handleScroll}
      >
        {images.map((src, idx) => (
          <div key={`${src}-${idx}`} className="w-full flex-shrink-0 snap-center">
            <img src={src} className="w-full h-auto object-contain max-h-[300px]" loading="lazy" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
        {images.map((_, idx) => (
          <div
            key={idx}
            className={`w-1.5 h-1.5 rounded-full ${
              idx === activeIdx ? 'bg-gray-800' : 'bg-gray-800/30'
            }`}
          />
        ))}
      </div>
      <div className="absolute top-2 right-2 bg-black/50 rounded-full px-2 py-0.5">
        <span className="text-[10px] text-white font-bold">{activeIdx + 1}/{images.length}</span>
      </div>
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const posts = useRedditPosts();
  const { user, postsTable, commentsTable, postVotes, joinedCommunityIds } = useRedditStore(useShallow((st) => ({
    user: st.user,
    postsTable: st.posts,
    commentsTable: st.comments,
    postVotes: st.user.postVotes,
    joinedCommunityIds: st.user.joinedCommunityIds,
  })));
  const votePost = useRedditStore((st) => st.votePost);
  const toggleJoin = useRedditStore((st) => st.toggleJoin);
  const storeDeletePost = useRedditStore((st) => st.deleteOwnPost);
  const location = useLocation();
  const { bindTap, bindBack, back } = useRedditGestures();
  const [moreMenuPostId, setMoreMenuPostId] = React.useState<string | null>(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = React.useState<string | null>(null);
  const [searchParamsProfile, setSearchParamsProfile] = useSearchParams();
  const showAccountMenu = searchParamsProfile.get('sheet') === 'account';

  const sp = new URLSearchParams(location.search);
  const tabRaw = sp.get('tab') as ProfileTabKey | null;
  const tab: ProfileTabKey = tabRaw === 'comments' || tabRaw === 'about' ? tabRaw : 'posts';

  const karma = 1 + (hashString(user.username) % 9999);
  const postKarma = Math.max(1, karma % 10);
  const commentKarma = 0;
  const activeIn = 1 + (hashString(`active:${user.username}`) % 9);
  const accountAge = `${10 + (hashString(`age:${user.username}`) % 50)}d`;
  const achievements = 5;

  const myPosts = React.useMemo(() => {
    return user.postIds
      .map((id) => postsTable[id])
      .filter((post): post is RedditPost => Boolean(post));
  }, [postsTable, user.postIds]);
  const myComments = useMyRedditComments();

  const isOwnPost = React.useCallback(
    (postId: string): boolean => {
      return user.postIds.includes(postId) && Boolean(postsTable[postId]);
    },
    [postsTable, user.postIds],
  );

  const deletePost = React.useCallback(
    (postId: string) => {
      storeDeletePost(postId);
    },
    [storeDeletePost],
  );

  const vote = (postId: string, dir: 'up' | 'down') => {
    votePost(postId, dir);
  };

  const parseCountToNumber = (raw: string): number | null => {
    const txt = String(raw ?? '').trim();
    if (!txt) return null;
    if (/[kK]$/.test(txt)) {
      const n = Number.parseFloat(txt.slice(0, -1));
      return Number.isFinite(n) ? n * 1000 : null;
    }
    const n = Number.parseFloat(txt.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  const formatCountWithK = (n: number): string => {
    const rounded = Math.max(0, Math.round(n));
    if (rounded < 1000) return String(rounded);
    const k = rounded / 1000;
    const fmt = rounded < 10000 ? k.toFixed(1) : k.toFixed(0);
    return fmt.endsWith('.0') ? `${fmt.slice(0, -2)}k` : `${fmt}k`;
  };

  const formatVoteScore = (rawUpvotes: string, voted: 'up' | 'down' | undefined): string => {
    const n = parseCountToNumber(rawUpvotes);
    if (n === null) return rawUpvotes;
    const delta = voted === 'up' ? 1 : voted === 'down' ? -1 : 0;
    return formatCountWithK(n + delta);
  };

  const commentFeed = React.useMemo(() => {
    const postById = new Map(posts.map((p) => [p.id, p]));
    const all = myComments.map((comment) => ({ postId: comment.postId, comment }));

    const findContextBody = (postId: string, comment: (typeof all)[number]['comment']): string => {
      const post = postById.get(postId);
      if (!post) return '';

      // Reply to a comment: show the parent comment body (black text).
      if (comment.parentId) {
        const parentFromDataset = post.commentsData?.find((x) => x.id === comment.parentId);
        if (parentFromDataset?.body) return parentFromDataset.body;

        const parentFromUser = Object.values(commentsTable).find((x) => x && x.postId === postId && x.id === comment.parentId);
        if (parentFromUser?.body) return parentFromUser.body;
      }

      // Direct reply under a post: show the post content/title (black text).
      return post.content?.trim() || post.title?.trim() || '';
    };

    const rows = all
      .map(({ postId, comment }) => {
        const post = postById.get(postId);
        const contextBody = findContextBody(postId, comment);
        const score = typeof comment.score === 'number' ? comment.score : 0;
        const ago = typeof comment.created_utc === 'number' ? formatAgo(comment.created_utc) : '';
        const views = 1 + (hashString(`views:${postId}:${comment.id}`) % 25);
        return {
          key: `${postId}:${comment.id}`,
          postId,
          commentId: comment.id,
          contextBody,
          meta: post ? `${post.subreddit} • ${ago || post.timeAgo} • ↑ ${score}` : `${ago} • ↑ ${score}`,
          myBody: comment.body,
          created: typeof comment.created_utc === 'number' ? toMs(comment.created_utc) : 0,
          views,
        };
      })
      .filter((x) => (x.contextBody || x.myBody).trim().length > 0)
      .sort((a, b) => b.created - a.created);

    return rows;
  }, [commentsTable, myComments, posts]);

  return (
    <div className="flex flex-col h-full bg-app-surface">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3 bg-[#0B2D5C]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Back"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10"
            {...bindBack()}
          >
            <IcArrowBack className="w-6 h-6 text-white" strokeWidth={2} />
          </button>
          <div className="text-[16px] font-semibold text-white truncate">
            {user.username}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Search"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10"
          >
            <IcSearch className="w-5 h-5 text-white" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Share"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10"
          >
            <IcShare className="w-5 h-5 text-white" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="More"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10"
            onClick={() => setSearchParamsProfile(p => { p.set('sheet', 'account'); return p; })}
          >
            <IcMore className="w-5 h-5 text-white" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar bg-app-surface"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* 上半屏：深蓝背景（头像/ID/统计） */}
        <div className={`relative overflow-hidden px-5 pt-4 pb-5 ${user.bannerImage ? '' : 'bg-gradient-to-b from-[#0B2D5C] via-[#08346B] to-[#061A36]'}`}>
          {user.bannerImage && (
            <>
              <img src={user.bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
              <div className="absolute inset-0 bg-black/40" />
            </>
          )}
          <div className="relative">
          <div className="flex flex-col items-start min-w-0">
            <div className="w-(--app-profile-avatar-size) h-(--app-profile-avatar-size) rounded-full bg-white/10 p-(--app-profile-avatar-ring)">
              <div className="w-full h-full rounded-full bg-[#2EE6A5] overflow-hidden">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : null}
              </div>
            </div>

            <div className="mt-4 min-w-0">
              <div className="flex items-baseline gap-3 min-w-0">
                <div className="text-(--app-profile-username-size) font-black text-white truncate">{user.username}</div>
                <button
                  type="button"
                  className="text-[14px] font-semibold text-white/80 active:opacity-80"
                  {...bindTap('profile.edit.open')}
                >
                  Edit
                </button>
              </div>
              <div className="mt-1 text-[13px] text-white/70">
                {`u/${user.username}`} • 0 followers
              </div>
              {user.bio ? (
                <div className="mt-2 text-[14px] text-white/90 leading-snug">
                  {user.bio}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[14px] text-white/85">
            <button type="button" className="flex items-center gap-2 active:opacity-90">
              <span className="font-semibold">Add social link</span>
              <IcNavForward className="w-4 h-4 text-white/70" />
            </button>

            <button type="button" className="flex items-center gap-2 active:opacity-90">
              <div className="flex -space-x-1">
                <div className="w-5 h-5 rounded-full bg-[#2EE6A5] border border-white/30" />
                <div className="w-5 h-5 rounded-full bg-[#FFD24A] border border-white/30" />
                <div className="w-5 h-5 rounded-full bg-[#FF4500] border border-white/30" />
              </div>
              <span className="font-semibold">{achievements} achievements</span>
              <IcNavForward className="w-4 h-4 text-white/70" />
            </button>
          </div>

          <div className="mt-4 h-px bg-white/15" />

          <div className="mt-4 grid grid-cols-4 divide-x divide-white/15">
            {[
              { label: 'Karma', value: formatCompactInt(karma) },
              { label: 'Contributions', value: '0' },
              { label: 'Account Age', value: accountAge },
              { label: 'Active In', value: String(activeIn) },
            ].map((item) => (
              <div key={item.label} className="px-2 text-center">
                <div className="text-[18px] font-black text-white leading-none">{item.value}</div>
                <div className="mt-1 text-[12px] text-white/70">{item.label}</div>
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* 下半屏：白底（Tabs + 内容） */}
        <div className="bg-app-surface">
          {/* Tabs */}
          <div className="px-4 border-b border-app-border">
            <div className="flex items-end gap-10">
              {(
                [
                  { key: 'posts' as const, label: 'Posts' },
                  { key: 'comments' as const, label: 'Comments' },
                  { key: 'about' as const, label: 'About' },
                ] as const
              ).map((t) => {
                const active = tab === t.key;
                return (
                  <div
                    key={t.key}
                    className="flex flex-col items-center cursor-pointer select-none"
                    {...bindTap('profile.tab.switch', { params: { tab: t.key } })}
                  >
                    <div className={`py-3 text-[15px] font-bold ${active ? 'text-black' : 'text-gray-400'}`}>
                      {t.label}
                    </div>
                    {active && <div className="w-[60px] h-0.5 bg-black rounded-full" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content */}
          {tab === 'posts' && (
            <div className="px-4 py-10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-10 px-4 rounded-full border border-app-border bg-app-surface text-[14px] font-semibold text-gray-700 active:bg-gray-50 flex items-center gap-2"
                >
                  <IcFilter className="w-4 h-4" strokeWidth={2} />
                  Feed Options
                </button>
              </div>

              <div className="mt-4 border border-app-border rounded-2xl bg-app-surface overflow-hidden">
                <button
                  type="button"
                  className="w-full px-4 py-4 flex items-center justify-between active:bg-gray-50"
                >
                  <div className="flex items-center gap-3 text-[14px] text-gray-700">
                    <IcEye className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
                    <span className="font-semibold">Showing all posts</span>
                  </div>
                  <IcNavForward className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {myPosts.length === 0 ? (
                <div className="mt-10 relative flex flex-col items-center text-center">
                  <button
                    type="button"
                    aria-label="Quick action"
                    className="absolute right-0 top-2 w-12 h-12 rounded-full bg-gray-200/80 flex items-center justify-center text-app-text-muted active:bg-gray-200"
                  >
                    <IcSend className="w-6 h-6 -rotate-[12deg]" strokeWidth={2} />
                  </button>
                  <div className="w-[210px] h-[150px] flex items-center justify-center overflow-hidden">
                    <img
                      src={asset('others/profile_posts_empty.png')}
                      alt=""
                      className="w-full h-full object-contain"
                      draggable={false}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  <div className="mt-8 text-[30px] font-black text-app-text leading-tight">
                    You don&apos;t have any posts yet
                  </div>
                  <div className="mt-3 text-[15px] text-app-text-muted leading-relaxed max-w-[320px]">
                    Once you post to a community, it&apos;ll show up here. If you&apos;d rather hide your posts, update your
                    settings.
                  </div>
                  <button
                    type="button"
                    className="mt-8 h-12 px-10 rounded-full bg-[#0045AC] text-white font-black text-[16px] shadow-sm active:opacity-95"
                  >
                    Update Settings
                  </button>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-gray-100">
                  {myPosts.map((post) => {
                    const voted = postVotes[post.id];
                    const communityId = post.subreddit;
                    const isJoined = joinedCommunityIds.includes(communityId);
                    const views = 1 + (hashString(`views:profile:${post.id}`) % 25);
                    return (
                      <div key={post.id} className="py-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden relative flex-shrink-0">
                              <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-app-text-muted select-none">r</div>
                              {post.subredditIcon && (
                                <img
                                  src={post.subredditIcon}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              )}
                            </div>
                            <span className="text-xs font-bold text-gray-700">{post.subreddit}</span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-400">{post.timeAgo}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleJoin(communityId)}
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                isJoined ? 'bg-gray-200 text-gray-700' : 'bg-[#0045AC] text-white'
                              }`}
                            >
                              {isJoined ? 'Joined' : 'Join'}
                            </button>
                            <button
                              type="button"
                              aria-label="Post menu"
                              onClick={() => setMoreMenuPostId(post.id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 active:bg-gray-100"
                            >
                              <IcMoreVert className="w-5 h-5" strokeWidth={2} />
                            </button>
                          </div>
                        </div>

                        {/* Title */}
                        <h3
                          className="font-bold text-base leading-snug text-black mb-1 cursor-pointer"
                          {...bindTap('post.comments.open', { params: { postId: post.id } })}
                        >
                          {post.title}
                        </h3>

                        {/* Content preview */}
                        {post.content && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{post.content}</p>
                        )}

                        {/* Images */}
                        {(() => {
                          const imgs = post.images ?? (post.image ? [post.image] : []);
                          if (imgs.length === 0) return null;
                          if (imgs.length === 1) {
                            return (
                              <div className="w-full rounded-xl overflow-hidden mb-2">
                                <img src={imgs[0]} className="w-full h-auto object-contain max-h-[300px]" loading="lazy" />
                              </div>
                            );
                          }
                          return <ProfilePostImageCarousel images={imgs} />;
                        })()}

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <div className="flex items-center gap-1 border border-app-border rounded-full bg-app-surface">
                            <button
                              className="p-1.5"
                              onClick={() => vote(post.id, 'up')}
                            >
                              <IcUpvote
                                className={`w-5 h-5 ${voted === 'up' ? 'text-[#FF4500]' : 'text-app-text-muted'}`}
                                strokeWidth={1.5}
                              />
                            </button>
                            <span className="text-xs font-bold text-gray-700 mx-0.5">
                              {formatVoteScore(post.upvotes, voted)}
                            </span>
                            <div className="w-px h-5 bg-gray-200" />
                            <button
                              className="p-1.5"
                              onClick={() => vote(post.id, 'down')}
                            >
                              <IcDownvote
                                className={`w-5 h-5 ${voted === 'down' ? 'text-[#7193FF]' : 'text-app-text-muted'}`}
                                strokeWidth={1.5}
                              />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              {...bindTap('post.comments.open', { params: { postId: post.id } })}
                              className="flex items-center gap-1 border border-app-border rounded-full px-2.5 py-1 bg-app-surface active:bg-gray-50"
                            >
                              <img
                                src={asset('basic/icon_comment.png')}
                                alt="Comments"
                                className="w-5 h-4 object-contain opacity-60"
                                draggable={false}
                              />
                              <span className="text-xs font-bold text-gray-700">{post.comments}</span>
                            </button>

                            <div className="h-[30px] w-[30px] rounded-full border border-app-border bg-app-surface flex items-center justify-center">
                              <IcMedal className="w-4 h-4 text-app-text-muted" strokeWidth={1.8} />
                            </div>

                            <button className="flex items-center gap-1 border border-app-border rounded-full px-2.5 py-1 bg-app-surface">
                              <img
                                src={asset('basic/icon_share.png')}
                                alt="Share"
                                className="w-5 h-4 object-contain opacity-60"
                                draggable={false}
                              />
                              <span className="text-xs font-bold text-gray-700">Share</span>
                            </button>
                          </div>
                        </div>

                        {/* Post to a different community */}
                        <div className="mt-3 border border-app-border rounded-2xl overflow-hidden">
                          <button
                            type="button"
                            className="w-full px-4 py-3 flex items-center justify-between active:bg-gray-50"
                          >
                            <div className="flex items-center gap-3 text-[14px] text-gray-700">
                              <IcAddCircle className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
                              <span className="font-semibold">Post to a different community</span>
                            </div>
                            <IcNavForward className="w-5 h-5 text-gray-400" />
                          </button>
                        </div>

                        {/* Views / Insights */}
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[14px] text-gray-600">
                            <IcEye className="w-4 h-4 text-app-text-muted" strokeWidth={2} />
                            <span className="font-semibold">{views} {views === 1 ? 'view' : 'views'}</span>
                          </div>
                          <button
                            type="button"
                            className="text-[14px] font-bold text-[#0045AC] active:opacity-90"
                          >
                            See More Insights
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'comments' && (
            <div className="px-4 py-8">
              <div className="border border-app-border rounded-2xl bg-app-surface overflow-hidden">
                <button
                  type="button"
                  className="w-full px-4 py-4 flex items-center justify-between active:bg-gray-50"
                >
                  <div className="flex items-center gap-3 text-[14px] text-gray-700">
                    <IcEye className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
                    <span className="font-semibold">Showing all comments</span>
                  </div>
                  <IcNavForward className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {commentFeed.length === 0 ? (
                <div className="px-1 py-16 text-center">
                  <div className="text-[22px] font-black text-app-text">No comments yet</div>
                  <div className="mt-2 text-[14px] text-app-text-muted">Your comments will show up here.</div>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
                  {commentFeed.map((row) => (
                    <div
                      key={row.key}
                      className="py-4 cursor-pointer"
                      {...bindTap('post.comments.open', { params: { postId: row.postId, commentId: row.commentId } })}
                    >
                      <div className="text-[16px] font-semibold text-app-text leading-snug line-clamp-2">
                        {row.contextBody}
                      </div>
                      <div className="mt-2 text-[13px] text-app-text-muted flex items-center gap-2">
                        <span className="truncate">{row.meta}</span>
                      </div>
                      <div className="mt-2 text-[15px] text-app-text leading-snug line-clamp-3">
                        {row.myBody}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[14px] text-gray-600">
                          <IcEye className="w-4 h-4 text-app-text-muted" strokeWidth={2} />
                          <span className="font-semibold">{row.views} views</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="text-[14px] font-bold text-[#0045AC] active:opacity-90"
                        >
                          See More Insights
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'about' && (
            <div className="bg-app-surface">
              <div className="px-5 py-6">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-(--app-profile-username-size) font-black text-app-text leading-none">
                      {formatCompactInt(postKarma)}
                    </div>
                    <div className="mt-2 text-[14px] text-app-text-muted">Post Karma</div>
                  </div>
                  <div>
                    <div className="text-(--app-profile-username-size) font-black text-app-text leading-none">
                      {formatCompactInt(commentKarma)}
                    </div>
                    <div className="mt-2 text-[14px] text-app-text-muted">Comment Karma</div>
                  </div>
                </div>
              </div>

              {user.bio ? (
                <div className="px-5 py-4">
                  <div className="text-[16px] text-app-text leading-relaxed whitespace-pre-wrap">
                    {user.bio}
                  </div>
                </div>
              ) : null}

              <div className="h-3 bg-gray-100" />

              <div className="px-5 py-4 bg-gray-100">
                <div className="text-[13px] font-black tracking-wider text-app-text-muted">TROPHIES</div>
              </div>

              {/* 留白：无需实现其他 */}
              <div className="h-[420px] bg-app-surface" />
            </div>
          )}
        </div>
      </div>
      {/* Post more menu bottom sheet */}
      {moreMenuPostId && (
        <div className="fixed inset-0 z-[250]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreMenuPostId(null)}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-3xl px-4 pt-3 pb-8 shadow-[0_-12px_28px_rgba(0,0,0,0.18)]"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-3">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Share icons row */}
            <div className="flex items-center justify-between px-6 pb-3">
              {[
                { bg: 'bg-gray-100', icon: <IcMessage className="w-6 h-6 text-blue-600" strokeWidth={2} /> },
                { bg: 'bg-gray-100', icon: <IcMail className="w-6 h-6 text-gray-700" strokeWidth={2} /> },
                { bg: 'bg-gray-100', icon: <IcComment className="w-6 h-6 text-green-600" strokeWidth={2} /> },
                { bg: 'bg-gray-100', icon: <IcMore className="w-6 h-6 text-gray-700" strokeWidth={2} /> },
              ].map((x, idx) => (
                <div
                  key={idx}
                  className={`w-14 h-14 rounded-full ${x.bg} flex items-center justify-center`}
                  aria-hidden="true"
                >
                  {x.icon}
                </div>
              ))}
            </div>

            <div className="px-2 pb-3 text-[13px] text-app-text-muted">
              Your username stays hidden when you share outside of Reddit.
            </div>

            <div className="h-px bg-gray-200 mb-1" />

            <div className="pt-1">
              <ProfileMoreMenuItem icon={<IcBell className="w-5 h-5" strokeWidth={2} />} label="Follow post" />
              <ProfileMoreMenuItem icon={<IcBookmark className="w-5 h-5" strokeWidth={2} />} label="Save" />
              {isOwnPost(moreMenuPostId) && (
                <ProfileMoreMenuItem
                  icon={<IcDelete className="w-5 h-5" strokeWidth={2} />}
                  label="Delete"
                  onClick={() => {
                    setMoreMenuPostId(null);
                    setConfirmDeletePostId(moreMenuPostId);
                  }}
                />
              )}
              <ProfileMoreMenuItem icon={<IcFlag className="w-5 h-5" strokeWidth={2} />} label="Report" />
              <ProfileMoreMenuItem icon={<IcCopy className="w-5 h-5" strokeWidth={2} />} label="Copy text" />
            </div>
          </div>
        </div>
      )}

      {/* Account menu bottom sheet */}
      {showAccountMenu && (
        <div className="fixed inset-0 z-[250]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => back()}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-3xl shadow-[0_-12px_28px_rgba(0,0,0,0.18)]"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <span className="text-[18px] font-black text-app-text">{s.profile_account_title}</span>
              <button
                type="button"
                aria-label="Close"
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
                onClick={() => back()}
              >
                <IcClose className="w-5 h-5 text-gray-600" strokeWidth={2} />
              </button>
            </div>

            {/* Menu items */}
            <div className="px-2 pb-8">
              <AccountMenuItem
                icon={<IcSettings className="w-5 h-5" strokeWidth={2} />}
                label={s.profile_settings}
                triggerProps={bindTap('profile.settings.open')}
              />
              <AccountMenuItem
                icon={<IcUser className="w-5 h-5" strokeWidth={2} />}
                label={s.profile_manage_profile}
              />
              <AccountMenuItem
                icon={<IcPen className="w-5 h-5" strokeWidth={2} />}
                label={s.profile_drafts}
                trailing={<span className="text-[14px] text-gray-400 font-semibold bg-gray-100 rounded-full w-7 h-7 flex items-center justify-center">0</span>}
              />
              <AccountMenuItem
                icon={<IcClock className="w-5 h-5" strokeWidth={2} />}
                label={s.profile_history}
              />
              <AccountMenuItem
                icon={<IcBookmark className="w-5 h-5" strokeWidth={2} />}
                label={s.profile_saved}
              />
              <AccountMenuItem
                icon={<div className="w-5 h-5 rounded-full border-2 border-gray-800 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-gray-800" /></div>}
                label={s.profile_online_status}
                trailing={
                  <div className={`w-11 h-6 rounded-full relative transition-colors ${user.isOnline ? 'bg-[#0045AC]' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-app-surface shadow transition-all ${user.isOnline ? 'right-0.5' : 'left-0.5'}`}>
                      {user.isOnline && (
                        <svg className="w-5 h-5 text-[#0045AC] p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                }
              />
              <AccountMenuItem
                icon={<IcShirt className="w-5 h-5" strokeWidth={2} />}
                label={s.profile_style_avatar}
              />
              <AccountMenuItem
                icon={<IcSquareAsterisk className="w-5 h-5" strokeWidth={2} />}
                label={s.profile_add_to_custom_feed}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {confirmDeletePostId && (
        <div className="fixed inset-0 z-[600] bg-black/35 flex items-center justify-center px-5">
          <div
            className="w-full max-w-[420px] bg-app-surface rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.30)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5">
              <div className="text-[22px] font-extrabold text-app-text">Delete post?</div>
              <div className="mt-2 text-[14px] text-gray-600">
                Once you delete this post, it can&apos;t be restored.
              </div>
            </div>
            <div className="px-5 pb-5 pt-5 flex gap-4">
              <button
                type="button"
                onClick={() => setConfirmDeletePostId(null)}
                className="flex-1 h-12 rounded-full bg-gray-200 text-gray-600 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePost(confirmDeletePostId);
                  setConfirmDeletePostId(null);
                }}
                className="flex-1 h-12 rounded-full bg-[#E11D48] text-white font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProfileMoreMenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick ?? (() => {})}
    className="w-full flex items-center gap-4 px-4 py-3 text-left active:bg-gray-50"
  >
    <div className="w-6 h-6 flex items-center justify-center text-gray-800">{icon}</div>
    <div className="text-[16px] text-app-text">{label}</div>
  </button>
);

const AccountMenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  triggerProps?: Record<string, any>;
}> = ({ icon, label, trailing, onClick, triggerProps }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-gray-50 rounded-xl"
    {...triggerProps}
  >
    <div className="w-6 h-6 flex items-center justify-center text-gray-800">{icon}</div>
    <div className="flex-1 text-[16px] text-app-text">{label}</div>
    {trailing && <div className="shrink-0">{trailing}</div>}
  </button>
);
