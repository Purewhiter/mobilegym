/**
 * X view assembly: merge the catalog with the session's posts and attach
 * authors, quoted / retweeted posts and reply trees.
 *
 * Pure: the device server's view queries run these. Display times depend on
 * the page's clock and locale, so they stay out of here: callers pass the
 * "just now" label, and the page fills in times on the result
 * (`withDisplayTimes` in data/view.ts).
 */
import type { XPost, XUser } from '../types';
import {
  resolveXRuntimePosts,
  runtimeCommentCounts,
  withRelationshipDerivedStats,
  type XRuntimeMeSlice,
  type XRuntimePostTable,
} from './runtimePostResolver';

export type { XRuntimeMeSlice };

const REPLY_ROOT_ID_PATTERN = /^r_(p_[0-9]+)/;

export function buildRetweetShell(meUserId: string, source: XPost, justNow: string): XPost {
  return {
    id: `retweet_${source.id}`,
    authorId: meUserId,
    content: '',
    time: justNow,
    stats: { ...source.stats },
    retweetedPostId: source.id,
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
  justNow: string,
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
    retweetShells.push(buildRetweetShell(me.id, source, justNow));
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

  const author = users[post.authorId];

  const quotedPost = post.quotedPostId ? postIndex.get(post.quotedPostId) : undefined;
  const quotedAuthor = quotedPost ? users[quotedPost.authorId] : undefined;

  const parentPost = post.threadId ? postIndex.get(post.threadId) : undefined;
  const replyToUser = parentPost ? users[parentPost.authorId] : undefined;

  return {
    ...post,
    author: {
      id: author?.id ?? post.authorId,
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
          ...quotedPost,
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
    const author = allUsers[p.authorId];
    const nested = Array.isArray((p as any).replies)
      ? ((p as any).replies as XPost[]).map(hydrate)
      : undefined;
    return {
      ...p,
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
