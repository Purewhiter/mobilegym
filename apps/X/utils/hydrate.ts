/**
 * X view 层的纯函数视图合并 / hydrate 工具。
 *
 * 所有函数都是纯函数 — 输入 base dataset + runtime slice, 输出视图对象。
 * 不读模块全局 (loader cache / store), 不持外部状态; data/view.ts 负责把 hook
 * 订阅源 (useSyncExternalStore + useXStore) 与这些函数串起来。
 */
import type { XPost, XUser } from '../types';
import { normalizeXPostTemporalFields, getJustNowLabel } from './formatTime';
import { resolveXRuntimePosts, type XRuntimePostTable } from './runtimePostResolver';

const REPLY_ROOT_ID_PATTERN = /^r_(p_[0-9]+)/;

/** Runtime slice of the me user that participates in view-time stat derivation. */
export interface XRuntimeMeSlice {
  id: string;
  likedPostIds: string[];
  retweetedPostIds: string[];
  followedUserIds: string[];
  followerUserIds: string[];
}

export function buildRetweetShell(meUserId: string, source: XPost): XPost {
  return {
    id: `retweet_${source.id}`,
    authorId: meUserId,
    content: '',
    time: getJustNowLabel(),
    stats: { ...source.stats },
    retweetedPostId: source.id,
  };
}

export function runtimeCommentCounts(posts: XRuntimePostTable | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of Object.values(posts ?? {})) {
    if (!post || typeof post.id !== 'string') continue;
    const threadId = post.threadId;
    if (!threadId) continue;
    counts.set(threadId, (counts.get(threadId) ?? 0) + 1);
  }
  return counts;
}

/**
 * 把 me 的 like / retweet / 新增 comment 量叠加到 post.stats 上,
 * 给 UI 显示"当前用户的互动也算进去"的体感。
 */
function withRelationshipDerivedStats(
  post: XPost,
  me: XRuntimeMeSlice,
  commentCounts: Map<string, number>,
): XPost {
  const stats = post.stats;
  if (!stats) return post;

  const likesDelta = me.likedPostIds.includes(post.id) ? 1 : 0;
  const retweetsDelta = me.retweetedPostIds.includes(post.id) ? 1 : 0;
  const commentsDelta = commentCounts.get(post.id) ?? 0;

  if (!likesDelta && !retweetsDelta && !commentsDelta) return post;

  return {
    ...post,
    stats: {
      ...stats,
      likes: Math.max(0, (stats.likes ?? 0) + likesDelta),
      retweets: Math.max(0, (stats.retweets ?? 0) + retweetsDelta),
      comments: Math.max(0, (stats.comments ?? 0) + commentsDelta),
    },
  };
}

/**
 * 合并 base posts + runtime overlay, 应用 relationship-derived stats,
 * 并把 me 的 retweet shell 排在最前。返回扁平 post list 给 timeline 使用。
 */
export function mergeLocalPosts(
  runtimePosts: XRuntimePostTable,
  me: XRuntimeMeSlice,
  basePosts: XPost[],
): XPost[] {
  const combined = resolveXRuntimePosts(runtimePosts, basePosts);
  const commentCounts = runtimeCommentCounts(runtimePosts);
  const seen = new Set<string>();
  const unique: XPost[] = [];

  for (const p of combined) {
    if (!p || typeof p.id !== 'string' || seen.has(p.id)) continue;
    seen.add(p.id);
    unique.push(withRelationshipDerivedStats(p, me, commentCounts));
  }

  const byId = new Map<string, XPost>();
  for (const p of unique) byId.set(p.id, p);

  const retweetShells: XPost[] = [];
  const emitted = new Set<string>();
  for (let i = me.retweetedPostIds.length - 1; i >= 0; i -= 1) {
    const sourceId = me.retweetedPostIds[i];
    if (!sourceId || emitted.has(sourceId)) continue;
    const source = byId.get(sourceId);
    if (!source) continue;
    retweetShells.push(buildRetweetShell(me.id, source));
    emitted.add(sourceId);
  }

  return [...retweetShells, ...unique];
}

export function buildPostIndex(
  basePosts: XPost[],
  runtimePosts: XRuntimePostTable = {},
): Map<string, XPost> {
  const m = new Map<string, XPost>();
  for (const p of resolveXRuntimePosts(runtimePosts, basePosts)) m.set(p.id, p);
  return m;
}

// ---- Hydration (post -> view-model with author/quotedPost/parent inline) ----

function hydrateInlinePost(
  post: XPost | undefined,
  users: Record<string, XUser>,
  postIndex: Map<string, XPost>,
): any {
  if (!post) return undefined;

  const normalizedPost = normalizeXPostTemporalFields(post);
  const author = users[normalizedPost.authorId];

  const quotedPost = normalizedPost.quotedPostId ? postIndex.get(normalizedPost.quotedPostId) : undefined;
  const quotedAuthor = quotedPost ? users[quotedPost.authorId] : undefined;

  const parentPost = normalizedPost.threadId ? postIndex.get(normalizedPost.threadId) : undefined;
  const replyToUser = parentPost ? users[parentPost.authorId] : undefined;

  return {
    ...normalizedPost,
    author: {
      id: author?.id ?? normalizedPost.authorId,
      name: author?.name || 'Unknown',
      avatar: author?.avatar,
      verified: author?.verified,
      banner: author?.banner,
      bio: author?.bio,
      location: author?.location,
      joinDate: author?.joinDate,
      following: author?.following,
      followers: author?.followers,
    },
    replyToUserId: replyToUser?.id,
    quotedPost: quotedPost
      ? {
          ...normalizeXPostTemporalFields(quotedPost),
          author: {
            id: quotedAuthor?.id ?? quotedPost.authorId,
            name: quotedAuthor?.name || 'Unknown',
            avatar: quotedAuthor?.avatar,
            verified: quotedAuthor?.verified,
          },
        }
      : undefined,
  };
}

export function hydratePost(
  post: XPost,
  users: Record<string, XUser>,
  postIndex: Map<string, XPost>,
): any {
  return {
    ...hydrateInlinePost(post, users, postIndex),
    retweetedPost: post.retweetedPostId
      ? hydrateInlinePost(postIndex.get(post.retweetedPostId), users, postIndex)
      : undefined,
  };
}

export function hydrateReplyTree(post: XPost, allUsers: Record<string, XUser>): XPost {
  const hydrate = (p: XPost): XPost => {
    const normalizedPost = normalizeXPostTemporalFields(p);
    const author = allUsers[p.authorId];
    const nested = Array.isArray((p as any).replies)
      ? ((p as any).replies as XPost[]).map(hydrate)
      : undefined;
    return {
      ...normalizedPost,
      author: {
        id: author?.id ?? p.authorId,
        name: author?.name || 'Unknown',
        avatar: author?.avatar,
        verified: author?.verified,
      },
      replies: nested,
    } as any;
  };
  return hydrate(post);
}

// ---- Replies lookup (replies.json indexed by root post id) ----

function findReplyInTree(replies: XPost[] | undefined, targetId: string): XPost | null {
  if (!Array.isArray(replies)) return null;
  for (const reply of replies) {
    if (!reply) continue;
    if (reply.id === targetId) return reply;
    const nested = findReplyInTree(reply.replies, targetId);
    if (nested) return nested;
  }
  return null;
}

export function resolveRawReplyById(
  replies: Record<string, XPost[]>,
  postId: string,
): XPost | null {
  const match = REPLY_ROOT_ID_PATTERN.exec(postId);
  if (!match) return null;
  const rootReplies = replies[match[1]];
  return Array.isArray(rootReplies) ? findReplyInTree(rootReplies, postId) : null;
}

export function resolveReplyById(
  replies: Record<string, XPost[]>,
  postId: string,
  allUsers: Record<string, XUser>,
): XPost | null {
  const resolved = resolveRawReplyById(replies, postId);
  return resolved ? hydrateReplyTree(resolved, allUsers) : null;
}
