import React from 'react';
import {
  IcClose,
  IcSearch,
  IcFilter,
  IcMoreVert,
  IcSend,
  IcReply,
  IcMedal,
  IcUpvote,
  IcDownvote,
  IcShare,
  IcBookmark,
  IcComment,
  IcLanguage,
  IcSettings,
  IcBell,
  IcCopy,
  IcExpandAll,
  IcUserBlock,
  IcFlag,
  IcDelete,
  IcEdit,
} from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRedditStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { getUserAvatar } from '../utils/userIdentity';
import { useRedditComments } from '../hooks/useRedditComments';
import { useRedditPostById } from '../hooks/useRedditPosts';
import type { Comment } from '../types';

type CommentItem = Comment;

function pickAvatar(usernameLike: string): string | undefined {
  return getUserAvatar(usernameLike);
}

function getPostIdFromPath(pathname: string): string | null {
  // /post/:postId
  const m = pathname.match(/^\/post\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function buildCommentKey(postId: string, commentId: string): string {
  return `${postId}:${commentId}`;
}

function normalizeUsername(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.startsWith('u/')) return s.slice(2);
  if (s.startsWith('/u/')) return s.slice(3);
  return s;
}

function parseCompactCount(raw: unknown): number | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  if (Number.isFinite(n)) return n;
  const m = s.match(/^(\d+(?:\.\d+)?)([km])$/);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const mult = m[2] === 'm' ? 1_000_000 : 1_000;
  return Math.round(base * mult);
}

function formatCompactCount(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const v = Math.round((abs / 1_000_000) * 10) / 10;
    return `${sign}${v}m`;
  }
  if (abs >= 1_000) {
    const v = Math.round((abs / 1_000) * 10) / 10;
    return `${sign}${v}k`;
  }
  return `${n}`;
}

/* ── Multi-image carousel (comments) ── */
const CommentsImageCarousel: React.FC<{ images: string[] }> = ({ images }) => {
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
    <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 bg-black relative">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
        onScroll={handleScroll}
      >
        {images.map((src, idx) => (
          <div key={`${src}-${idx}`} className="w-full flex-shrink-0 snap-center">
            <img src={src} className="w-full h-auto object-cover" alt="" draggable={false} loading="lazy" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
        {images.map((_, idx) => (
          <div
            key={idx}
            className={`w-1.5 h-1.5 rounded-full ${idx === activeIdx ? 'bg-app-surface' : 'bg-white/40'}`}
          />
        ))}
      </div>
      <div className="absolute top-2 right-3 bg-black/50 rounded-full px-2 py-0.5">
        <span className="text-[11px] text-white font-bold">{activeIdx + 1}/{images.length}</span>
      </div>
    </div>
  );
};

export const PostCommentsPage: React.FC = () => {
  const { joinedCommunityIds, commentsTable, commentVotes, postVotes, user } = useRedditStore(useShallow((s) => ({
    joinedCommunityIds: s.user.joinedCommunityIds,
    commentsTable: s.comments,
    commentVotes: s.user.commentVotes,
    postVotes: s.user.postVotes,
    user: s.user,
  })));
  const storeVotePost = useRedditStore((s) => s.votePost);
  const storeToggleJoin = useRedditStore((s) => s.toggleJoin);
  const storeVoteComment = useRedditStore((s) => s.voteComment);
  const storeAddComment = useRedditStore((s) => s.addComment);
  const storeDeleteOwnComment = useRedditStore((s) => s.deleteOwnComment);
  const { bindBack, bindTap, go } = useRedditGestures();
  const location = useLocation();
  const postId = getPostIdFromPath(location.pathname);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = React.useState('');
  const [moreMenu, setMoreMenu] = React.useState<{ comment: CommentItem } | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<{ comment: CommentItem } | null>(null);
  const [selectedOwnCommentId, setSelectedOwnCommentId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const post = useRedditPostById(postId);
  const allComments = useRedditComments(postId);

  const displayPostUpvotes = React.useMemo(() => {
    const base = parseCompactCount(post?.upvotes);
    if (base === null) return String(post?.upvotes ?? '');
    const v = postId ? postVotes?.[postId] : undefined;
    const delta = v === 'up' ? 1 : v === 'down' ? -1 : 0;
    return formatCompactCount(base + delta);
  }, [post, postId, postVotes]);

  const communityIdForPost = React.useMemo(() => {
    const name = String(post?.subreddit ?? '').trim();
    return name || null;
  }, [post]);

  const isJoined = React.useMemo(() => {
    if (!communityIdForPost) return false;
    return Array.isArray(joinedCommunityIds) && joinedCommunityIds.includes(communityIdForPost);
  }, [communityIdForPost, joinedCommunityIds]);

  const displayPostCommentsCount = React.useMemo(() => {
    return String(allComments.length);
  }, [allComments.length]);

  const commentChildren = React.useMemo(() => {
    const m = new Map<string, CommentItem[]>();
    for (const c of allComments) {
      const key = c.parentId ? String(c.parentId) : '__root__';
      const arr = m.get(key) ?? [];
      arr.push(c);
      m.set(key, arr);
    }
    // Keep stable order: base comments first (already), then user comments by created_utc asc
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => (a.created_utc ?? 0) - (b.created_utc ?? 0));
      m.set(k, arr);
    }
    return m;
  }, [allComments]);

  const rootComments = commentChildren.get('__root__') ?? [];

  const targetCommentId = React.useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const id = sp.get('commentId');
    return id ? String(id) : null;
  }, [location.search]);

  const canSend = draft.trim().length > 0 && !!postId;

  // If opened with ?commentId=..., scroll to that comment after render.
  React.useEffect(() => {
    if (!targetCommentId) return;
    if (!scrollRef.current) return;
    if (!postId) return;
    if (allComments.length === 0) return;

    const escapeAttrValue = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const run = () => {
      const root = scrollRef.current;
      if (!root) return;
      const el = root.querySelector(
        `[data-comment-id="${escapeAttrValue(targetCommentId)}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      // Ensure comment is visible within the scroll container.
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
    };

    // Two frames to ensure DOM + layout ready.
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(run);
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [allComments.length, postId, targetCommentId]);

  const isOwnUserComment = React.useCallback(
    (c: CommentItem): boolean => {
      // 仅认 runtime overlay 中作者为当前用户的评论：deleteOwnComment 的前置条件
      // 要求 commentId 在 user.commentIds 且 state.comments 有条目，fixture-only
      // 评论不满足，因此不该露出删除/编辑入口。
      const created = commentsTable[c.id];
      if (!created) return false;
      const me = String(user.username || 'Embarrassed_Fee8630');
      return String(created.author) === me;
    },
    [commentsTable, user.username],
  );

  const openMoreMenuFor = React.useCallback((c: CommentItem) => {
    setMoreMenu({ comment: c });
  }, []);

  const deleteOwnComment = React.useCallback(
    (c: CommentItem) => {
      if (!postId) return;
      if (!isOwnUserComment(c)) return;
      storeDeleteOwnComment(c.id);
    },
    [isOwnUserComment, postId, storeDeleteOwnComment],
  );

  const voteComment = React.useCallback(
    (commentId: string, dir: 'up' | 'down') => {
      if (!postId) return;
      storeVoteComment(buildCommentKey(postId, commentId), dir);
    },
    [postId, storeVoteComment],
  );

  const votePost = React.useCallback(
    (dir: 'up' | 'down') => {
      if (!postId) return;
      storeVotePost(postId, dir);
    },
    [postId, storeVotePost],
  );

  const getDisplayScore = React.useCallback(
    (comment: CommentItem): number => {
      if (!postId) return comment.score ?? 0;
      const key = buildCommentKey(postId, comment.id);
      const voted = commentVotes[key];
      const base = typeof comment.score === 'number' ? comment.score : 0;
      const delta = voted === 'up' ? 1 : voted === 'down' ? -1 : 0;
      return base + delta;
    },
    [postId, commentVotes],
  );

  const submit = React.useCallback(() => {
    if (!postId) return;
    const body = draft.trim();
    if (!body) return;

    storeAddComment(postId, body);

    setDraft('');
    // keep keyboard
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [draft, postId, storeAddComment]);

  const renderComment = (c: CommentItem, depth: number) => {
    const children = commentChildren.get(String(c.id)) ?? [];
    const voted = postId ? commentVotes[buildCommentKey(postId, c.id)] : undefined;
    const displayScore = getDisplayScore(c);
    const isOwn = isOwnUserComment(c);
    const isSelected = isOwn && selectedOwnCommentId === c.id;
    return (
      <div key={c.id} className="w-full">
        <div
          data-comment-id={c.id}
          className={`flex gap-3 py-4 border-b border-gray-100 ${depth > 0 ? 'pl-6' : ''} ${
            isSelected ? 'bg-gray-50' : ''
          }`}
          onClick={(e) => {
            // Only "select" own comments when tapping the content area, not action buttons.
            const el = e.target as HTMLElement | null;
            if (el?.closest?.('[data-comment-action]')) return;
            if (isOwn) setSelectedOwnCommentId(c.id);
          }}
        >
          <button
            type="button"
            aria-label="Open user profile"
            {...bindTap('profile.user.open', { params: { username: normalizeUsername(c.author) } })}
            className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0"
          >
            <img
              src={pickAvatar(c.author)}
              className="w-full h-full object-cover"
              alt=""
              draggable={false}
              loading="lazy"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[13px] text-gray-600">
              <span
                className="font-bold text-app-text truncate cursor-pointer"
                {...bindTap('profile.user.open', { params: { username: normalizeUsername(c.author) } })}
              >
                {c.author}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-app-text-muted">{displayScore} points</span>
            </div>
            <div className="mt-1 text-[15px] text-app-text leading-relaxed whitespace-pre-wrap">
              {c.body}
            </div>
            {/* Action bar (right-bottom): ... / reply / medal / up-score-down */}
            <div
              className="mt-2 flex items-center justify-end gap-2 text-[13px] text-app-text-muted"
              data-comment-action
            >
              <button
                type="button"
                {...bindTap(
                  { kind: 'action', id: 'postComments.item.more.open' },
                  {
                    params: { postId: postId ?? '', commentId: c.id },
                    onTrigger: () => {
                      if (isOwn) setSelectedOwnCommentId(c.id);
                      setMoreMenu({ comment: c });
                    },
                  },
                )}
                className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
                aria-label="More"
              >
                <IcMoreVert className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
              </button>

              <button
                type="button"
                {...bindTap('comment.reply.open', { params: { postId: postId ?? '', commentId: c.id } })}
                className="h-9 px-2 rounded-full flex items-center justify-center gap-1.5 active:bg-gray-100"
                aria-label="Reply"
              >
                <IcReply className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
                <span className="text-[13px] font-semibold text-gray-600">Reply</span>
              </button>

              <button
                type="button"
                onClick={() => {}}
                className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
                aria-label="Medal"
              >
                <IcMedal className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
              </button>

              <div className="flex items-center gap-1">
                {isSelected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {}}
                      className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
                      aria-label="Upvote (disabled)"
                    >
                      <IcUpvote className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                    </button>
                    <span className="min-w-[28px] text-center text-app-text-muted font-semibold">Vote</span>
                    <button
                      type="button"
                      onClick={() => {}}
                      className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
                      aria-label="Downvote (disabled)"
                    >
                      <IcDownvote className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      {...bindTap(
                        { kind: 'action', id: 'postComments.item.vote.select.up' },
                        { params: { postId: postId ?? '', commentId: c.id }, onTrigger: () => voteComment(c.id, 'up') },
                      )}
                      className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
                      aria-label="Upvote"
                    >
                      <IcUpvote
                        className={`w-5 h-5 ${voted === 'up' ? 'text-app-primary' : 'text-app-text-muted'}`}
                        strokeWidth={1.5}
                      />
                    </button>
                    <span className="min-w-[18px] text-center text-gray-700 font-semibold">
                      {displayScore}
                    </span>
                    <button
                      type="button"
                      {...bindTap(
                        { kind: 'action', id: 'postComments.item.vote.select.down' },
                        { params: { postId: postId ?? '', commentId: c.id }, onTrigger: () => voteComment(c.id, 'down') },
                      )}
                      className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
                      aria-label="Downvote"
                    >
                      <IcDownvote
                        className={`w-5 h-5 ${voted === 'down' ? 'text-[#7193FF]' : 'text-app-text-muted'}`}
                        strokeWidth={1.5}
                      />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {children.length > 0 && (
          <div className="w-full">
            {children.map((child) => renderComment(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-app-surface">
      {/* Blue header like screenshot */}
      <div className="flex items-center justify-between px-3 pt-10 pb-2 bg-[#0B5CAD] text-white">
        <button
          type="button"
          aria-label="Close"
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10"
          {...bindBack()}
        >
          <IcClose className="w-6 h-6" strokeWidth={2} />
        </button>

        <div className="flex items-center gap-2">
          <button type="button" aria-label="Search" onClick={() => {}} className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10">
            <IcSearch className="w-6 h-6" strokeWidth={2} />
          </button>
          <button type="button" aria-label="Filter" onClick={() => {}} className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10">
            <IcFilter className="w-6 h-6" strokeWidth={2} />
          </button>
          <button type="button" aria-label="More" onClick={() => {}} className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10">
            <IcMoreVert className="w-6 h-6" strokeWidth={2} />
          </button>

          {/* Avatar (visual) */}
          <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden">
            <img
              src={pickAvatar(`viewer:${postId ?? 'unknown'}`)}
              className="w-full h-full object-cover"
              alt=""
              draggable={false}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar bg-app-surface"
        data-scroll-container="main"
        data-scroll-direction="vertical"
        ref={scrollRef}
      >
        {/* Post content */}
        <div className="bg-app-surface border-b border-gray-100">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-app-text-muted">r</div>
                  {post?.subredditIcon && (
                    <img
                      src={post.subredditIcon}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                      alt=""
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-[15px] text-app-text truncate">{post?.subreddit ?? 'r/unknown'}</span>
                  </div>
                  <div className="text-[13px] text-app-text-muted truncate">
                    <span>{post?.author ?? ''}</span>
                    <span className="mx-1">·</span>
                    <span>{post?.timeAgo ?? ''}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                aria-label="Join"
                disabled={!communityIdForPost}
                {...(communityIdForPost
                  ? bindTap(
                      { kind: 'action', id: 'postComments.community.join' } as any,
                      {
                        params: { communityId: communityIdForPost },
                        onTrigger: () => storeToggleJoin(communityIdForPost),
                      },
                    )
                  : {})}
                className={`h-9 px-4 rounded-full text-[14px] font-bold flex items-center justify-center ${
                  isJoined ? 'bg-gray-200 text-app-text' : 'bg-[#0B5CAD] text-white'
                } ${!communityIdForPost ? 'opacity-40' : 'active:opacity-90'}`}
              >
                {isJoined ? 'Joined' : 'Join'}
              </button>
            </div>

            <div className="mt-2 text-[20px] font-extrabold text-app-text leading-snug">
              {post?.title ?? 'Post'}
            </div>

            {(() => {
              const imgs = post?.images ?? (post?.image ? [post.image] : []);
              if (imgs.length === 0) return null;
              if (imgs.length === 1) {
                return (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 bg-black">
                    <img
                      src={imgs[0]}
                      className="w-full h-auto object-cover"
                      alt=""
                      draggable={false}
                      loading="lazy"
                      onError={(e: any) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                );
              }
              return <CommentsImageCarousel images={imgs} />;
            })()}

            {/* Post action row */}
            <div className="mt-3">
              <div className="w-full flex items-center justify-around text-app-text-muted">
                <button
                  type="button"
                  aria-label="Upvote post"
                  {...bindTap(
                    { kind: 'action', id: 'postComments.post.vote.select.up' },
                    { params: { postId: postId ?? '' }, onTrigger: () => votePost('up') },
                  )}
                  className="flex items-center gap-1.5 active:opacity-70"
                >
                  <IcUpvote
                    className={`w-5 h-5 ${postId && postVotes?.[postId] === 'up' ? 'text-app-primary' : 'text-app-text-muted'}`}
                    strokeWidth={1.5}
                  />
                  <span className="text-[13px] font-semibold text-gray-700">{displayPostUpvotes}</span>
                </button>

                <button
                  type="button"
                  aria-label="Downvote post"
                  {...bindTap(
                    { kind: 'action', id: 'postComments.post.vote.select.down' },
                    { params: { postId: postId ?? '' }, onTrigger: () => votePost('down') },
                  )}
                  className="flex items-center justify-center active:opacity-70"
                >
                  <IcDownvote
                    className={`w-5 h-5 ${postId && postVotes?.[postId] === 'down' ? 'text-[#7193FF]' : 'text-app-text-muted'}`}
                    strokeWidth={1.5}
                  />
                </button>

                <button
                  type="button"
                  aria-label="Comments"
                  onClick={() => {}}
                  className="flex items-center gap-1.5 active:opacity-70"
                >
                  <IcComment className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
                  <span className="text-[13px] font-semibold text-gray-700">{displayPostCommentsCount}</span>
                </button>

                <button
                  type="button"
                  aria-label="Award"
                  onClick={() => {}}
                  className="flex items-center justify-center active:opacity-70"
                >
                  <IcMedal className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
                </button>

                <button
                  type="button"
                  aria-label="Share"
                  onClick={() => {}}
                  className="flex items-center gap-1.5 active:opacity-70"
                >
                  <IcShare className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
                  {typeof post?.shares === 'number' && (
                    <span className="text-[13px] font-semibold text-gray-700">{post.shares}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-app-surface">
          {rootComments.length === 0 ? (
            <div className="px-4 py-10 text-center text-app-text-muted text-sm">No comments.</div>
          ) : (
            <div className="px-4 py-2">
              {rootComments.map((c) => renderComment(c, 0))}
            </div>
          )}
        </div>

        {/* Bottom spacing for input bar */}
        <div className="h-32" />
      </div>

      {/* Input bar (send comment / reply) */}
      <div className="border-t border-app-border bg-app-surface px-4 py-3" data-keep-keyboard="true">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-11 rounded-full bg-gray-100 flex items-center px-4">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Join the conversation"
              className="w-full bg-transparent outline-none text-[15px] text-app-text placeholder-gray-500"
            />
          </div>
          <button
            type="button"
            aria-label="Send"
            onPointerDown={(e) => e.preventDefault()}
            {...bindTap(
              { kind: 'action', id: 'postComments.comment.submit' },
              {
                params: {
                  postId: postId ?? '',
                  parentId: '',
                  body: draft,
                },
                onTrigger: submit,
              },
            )}
            className={`w-11 h-11 rounded-full flex items-center justify-center ${
              canSend ? 'bg-[#0045AC] text-white' : 'bg-gray-200 text-gray-400'
            }`}
          >
            <IcSend className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Comment "more" bottom sheet */}
      {moreMenu && (
        <div
          className="fixed inset-0 z-[500] bg-black/45 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          onClick={() => setMoreMenu(null)}
        >
          {/* Comment preview card in shadow area */}
          <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <div className="bg-app-surface rounded-2xl px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)] text-[14px] text-gray-800 leading-relaxed line-clamp-4">
              {moreMenu.comment.body}
            </div>
          </div>

          {/* Short white line between preview and sheet */}
          <div className="flex justify-center pb-2" aria-hidden="true">
            <div className="w-12 h-1 rounded-full bg-white/95" />
          </div>

          {/* sheet */}
          <div
            className="bg-app-surface rounded-t-3xl shadow-[0_-12px_28px_rgba(0,0,0,0.22)] pb-6"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="pt-2">
              {isOwnUserComment(moreMenu.comment) && (
                <MoreMenuItem
                  icon={<IcEdit className="w-5 h-5" strokeWidth={2} />}
                  label="Edit"
                  onClick={() => {
                    // Close sheet first for a cleaner transition.
                    setMoreMenu(null);
                    setSelectedOwnCommentId(null);
                    go('comment.edit.open', {
                      postId: postId ?? '',
                      commentId: moreMenu.comment.id,
                    });
                  }}
                />
              )}
              <MoreMenuItem icon={<IcShare className="w-5 h-5" strokeWidth={2} />} label="Share" />
              <MoreMenuItem icon={<IcShare className="w-5 h-5" strokeWidth={2} />} label="Share as post" />
              <MoreMenuItem icon={<IcBookmark className="w-5 h-5" strokeWidth={2} />} label="Save" />
              <MoreMenuItem icon={<IcLanguage className="w-5 h-5" strokeWidth={2} />} label="Translate" />
              <MoreMenuItem icon={<IcSettings className="w-5 h-5" strokeWidth={2} />} label="Translation settings" />
              <MoreMenuItem icon={<IcBell className="w-5 h-5" strokeWidth={2} />} label="Follow comment" />
              <MoreMenuItem icon={<IcCopy className="w-5 h-5" strokeWidth={2} />} label="Copy text" />
              <MoreMenuItem icon={<IcExpandAll className="w-5 h-5" strokeWidth={2} />} label="Collapse thread" />
              <MoreMenuItem icon={<IcUserBlock className="w-5 h-5" strokeWidth={2} />} label="Block account" />
              <MoreMenuItem icon={<IcFlag className="w-5 h-5" strokeWidth={2} />} label="Report" />
              {isOwnUserComment(moreMenu.comment) && (
                <MoreMenuItem
                  icon={<IcDelete className="w-5 h-5" strokeWidth={2} />}
                  label="Delete"
                  onClick={() => {
                    setMoreMenu(null);
                    setConfirmDelete({ comment: moreMenu.comment });
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal (own comments only) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[600] bg-black/35 flex items-center justify-center px-5">
          <div
            className="w-full max-w-[420px] bg-app-surface rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.30)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5">
              <div className="text-[22px] font-extrabold text-app-text">Are you sure?</div>
              <div className="mt-2 text-[14px] text-gray-600">
                You cannot restore comments that have been deleted.
              </div>
            </div>
            <div className="px-5 pb-5 pt-5 flex gap-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 h-12 rounded-full bg-gray-200 text-gray-400 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteOwnComment(confirmDelete.comment);
                  setConfirmDelete(null);
                  setSelectedOwnCommentId(null);
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

const MoreMenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  tone?: 'normal' | 'danger';
  onClick?: () => void;
}> = ({ icon, label, tone = 'normal', onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick ?? (() => {})}
      className="w-full flex items-center gap-4 px-5 py-3 text-left active:bg-gray-50"
    >
      <div className={`w-6 h-6 flex items-center justify-center ${tone === 'danger' ? 'text-[#E11D48]' : 'text-gray-800'}`}>
        {icon}
      </div>
      <div className={`text-[16px] ${tone === 'danger' ? 'text-[#E11D48] font-semibold' : 'text-app-text'}`}>
        {label}
      </div>
    </button>
  );
};
