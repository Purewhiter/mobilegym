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
