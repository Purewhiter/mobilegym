import type { XPost } from '../types';

export type XRuntimePostTable = Record<string, Partial<XPost> | XPost | null | undefined>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function mergeEntity<T extends Record<string, any>>(base: T, patch: Partial<T>): T {
  const result: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const baseValue = result[key];
    result[key] = isPlainObject(baseValue) && isPlainObject(value)
      ? mergeEntity(baseValue, value)
      : value;
  }
  return result as T;
}

export function getXRuntimePostEntry(
  posts: XRuntimePostTable | undefined,
  postId: string,
): Partial<XPost> | XPost | null | undefined {
  if (!posts) return undefined;
  if (Object.prototype.hasOwnProperty.call(posts, postId)) return posts[postId];
  const normalized = String(postId || '').toLowerCase();
  if (normalized && Object.prototype.hasOwnProperty.call(posts, normalized)) return posts[normalized];
  return undefined;
}

export function resolveXRuntimePost(
  posts: XRuntimePostTable | undefined,
  basePostsById: Map<string, XPost>,
  postId: string,
): XPost | null {
  const patch = getXRuntimePostEntry(posts, postId);
  if (patch === null) return null;

  const base = basePostsById.get(postId) ?? basePostsById.get(String(postId || '').toLowerCase()) ?? null;
  if (patch && typeof patch === 'object') {
    return base ? mergeEntity(base, patch) : (patch as XPost);
  }
  return base;
}

export function resolveXRuntimePosts(
  posts: XRuntimePostTable | undefined,
  basePosts: XPost[],
): XPost[] {
  const basePostsById = new Map<string, XPost>();
  for (const post of basePosts) {
    if (!post?.id) continue;
    basePostsById.set(post.id, post);
    basePostsById.set(post.id.toLowerCase(), post);
  }

  const out: XPost[] = [];
  const seen = new Set<string>();
  const table = posts ?? {};

  for (const [id, patch] of Object.entries(table)) {
    if (patch === null) {
      seen.add(id.toLowerCase());
      continue;
    }
    const resolved = resolveXRuntimePost(table, basePostsById, id);
    if (!resolved?.id) continue;
    const normalized = resolved.id.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(resolved);
  }

  for (const post of basePosts) {
    if (!post?.id) continue;
    const normalized = post.id.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(post);
  }

  return out;
}
