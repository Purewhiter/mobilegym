/**
 * Reddit posts and comments as the user sees them: the session's overlay
 * tables (an object replaces the catalog record, `null` hides it) over the
 * catalog. Pure; shared by the page hooks and the device server's `view*`
 * queries, which judges and samplers read.
 */

import type { Comment, RedditCommentsOverlay, RedditPost, RedditPostsOverlay } from '../types';

const has = (table: object, id: string) => Object.prototype.hasOwnProperty.call(table, id);

const isPresent = <T,>(value: T | null | undefined): value is T => Boolean(value);

/** One post; `null` when hidden or unknown. */
export function resolveRedditPost(
  overlay: RedditPostsOverlay,
  catalogById: Map<string, RedditPost>,
  id: string,
): RedditPost | null {
  if (has(overlay, id)) return overlay[id];
  return catalogById.get(id) ?? null;
}

/** The user's own posts (`postIds` order) first, then catalog posts in feed order. */
export function resolveRedditPosts(
  catalog: RedditPost[],
  overlay: RedditPostsOverlay,
  postIds: string[],
): RedditPost[] {
  const catalogById = new Map(catalog.map((post) => [String(post.id), post]));
  const seen = new Set<string>();
  const ownPosts = postIds
    .map((id) => resolveRedditPost(overlay, catalogById, id))
    .filter(isPresent)
    .filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  const feedPosts = catalog
    .map((post) => {
      const id = String(post.id);
      return has(overlay, id) ? overlay[id] : post;
    })
    .filter(isPresent)
    .filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  return [...ownPosts, ...feedPosts];
}

/** One comment; `null` when hidden or unknown. */
export function resolveRedditComment(
  overlay: RedditCommentsOverlay,
  catalogComment: Comment | undefined,
  id: string,
): Comment | null {
  if (has(overlay, id)) return overlay[id];
  return catalogComment ?? null;
}

/** A post's catalog comments (hidden ones dropped), then this session's comments on it. */
export function resolveRedditComments(
  catalog: Comment[],
  overlay: RedditCommentsOverlay,
  postId: string,
): Comment[] {
  const catalogComments = catalog
    .map((comment) => resolveRedditComment(overlay, comment, String(comment.id)))
    .filter(isPresent);
  const seen = new Set(catalogComments.map((comment) => comment.id));
  const sessionComments = Object.values(overlay)
    .filter((comment): comment is Comment => isPresent(comment) && comment.postId === postId)
    .filter((comment) => {
      if (seen.has(comment.id)) return false;
      seen.add(comment.id);
      return true;
    });
  return [...catalogComments, ...sessionComments];
}

// ── Search ──────────────────────────────────────────────────────────

/** Lowercase, without spaces, punctuation and symbols (for CJK and multi-word queries). */
const normalizeForSearch = (value: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');

/** Word-prefix match for ASCII queries, substring match on normalized text otherwise. */
export const matchesWord = (text: string, query: string): boolean => {
  if (!text || !query) return false;
  const trimmed = query.trim();
  if (!trimmed) return false;

  const hasNonAscii = /[^\x00-\x7F]/.test(trimmed);
  if (hasNonAscii || /\s/.test(trimmed)) {
    const normalizedText = normalizeForSearch(text);
    const normalizedQuery = normalizeForSearch(trimmed);
    return normalizedQuery.length > 0 && normalizedText.includes(normalizedQuery);
  }

  const escapedQuery = trimmed.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedQuery}`, 'i').test(text);
};

/** Posts whose title, body, author or community matches `query`, in order; at most `limit`. */
export function searchRedditPosts(posts: RedditPost[], query: string, limit = 50): RedditPost[] {
  const q = query.trim();
  if (!q) return [];
  const results: RedditPost[] = [];
  for (const post of posts) {
    if (
      matchesWord(post.title || '', q) ||
      matchesWord(post.content || '', q) ||
      matchesWord(post.author || '', q) ||
      matchesWord(post.subreddit || '', q)
    ) {
      results.push(post);
      if (results.length >= limit) break;
    }
  }
  return results;
}
