import type { XPost } from '../types';

/**
 * Runtime post overlay 表:
 *   - 值为 XPost: 整条 post 完整覆盖 base (id 必须存在且 case-sensitive 匹配 base)
 *   - 值为 null: tombstone, 隐藏对应 base post
 *   - 缺 key: 走 base 默认值
 *
 * Contract: post id 永远 case-sensitive 精确匹配, 不做任何 lowercase 归一。
 */
export type XRuntimePostTable = Record<string, XPost | null | undefined>;

export function getXRuntimePostEntry(
  posts: XRuntimePostTable | undefined,
  postId: string,
): XPost | null | undefined {
  if (!posts) return undefined;
  return Object.prototype.hasOwnProperty.call(posts, postId) ? posts[postId] : undefined;
}

export function resolveXRuntimePost(
  posts: XRuntimePostTable | undefined,
  basePostsById: Map<string, XPost>,
  postId: string,
): XPost | null {
  const patch = getXRuntimePostEntry(posts, postId);
  if (patch === null) return null;
  if (patch && typeof patch === 'object') return patch;
  return basePostsById.get(postId) ?? null;
}

export function resolveXRuntimePosts(
  posts: XRuntimePostTable | undefined,
  basePosts: XPost[],
): XPost[] {
  const basePostsById = new Map<string, XPost>();
  for (const post of basePosts) {
    if (post?.id) basePostsById.set(post.id, post);
  }

  const out: XPost[] = [];
  const seen = new Set<string>();
  const table = posts ?? {};

  for (const [id, patch] of Object.entries(table)) {
    if (patch === null) {
      seen.add(id);
      continue;
    }
    const resolved = resolveXRuntimePost(table, basePostsById, id);
    if (!resolved?.id || seen.has(resolved.id)) continue;
    seen.add(resolved.id);
    out.push(resolved);
  }

  for (const post of basePosts) {
    if (!post?.id || seen.has(post.id)) continue;
    seen.add(post.id);
    out.push(post);
  }

  return out;
}
