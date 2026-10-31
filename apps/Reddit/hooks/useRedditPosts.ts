import { useMemo } from 'react';
import { useDeviceQuery } from '../../../os/device/deviceStore';
import type { RedditPost } from '../types';

// Posts come from the device server's views (apps/Reddit/device), already merged
// with this session's posts, edits and deletions (utils/view.ts); a page asks
// only for what it shows.

const EMPTY_POSTS: RedditPost[] = Object.freeze([]) as readonly RedditPost[] as RedditPost[];
const EMPTY_BY_ID: Record<string, RedditPost> = Object.freeze({}) as Record<string, RedditPost>;

/** The first `limit` feed posts (the user's own first) and the feed's length. */
export function useRedditFeed(limit: number): { posts: RedditPost[]; total: number } {
  const { data } = useDeviceQuery<{ posts: RedditPost[]; total: number }>(
    'reddit', 'feedPage', { limit }, true, { keepPrevious: true },
  );
  return data ?? { posts: EMPTY_POSTS, total: 0 };
}

/** Search hits (title, body, author or community), at most 50. */
export function useRedditSearchPosts(query: string): RedditPost[] {
  const q = query.trim();
  const { data } = useDeviceQuery<RedditPost[]>('reddit', 'searchPosts', { query: q }, Boolean(q), { keepPrevious: true });
  return q ? data ?? EMPTY_POSTS : EMPTY_POSTS;
}

export function useRedditPostById(id: string | null | undefined): RedditPost | null {
  const { data } = useDeviceQuery<RedditPost | null>('reddit', 'viewPost', { id: id ?? '' }, Boolean(id));
  return id ? data ?? null : null;
}

/** Posts by id (missing or deleted ones left out). */
export function useRedditPostsByIds(ids: string[]): Record<string, RedditPost> {
  const key = useMemo(() => [...new Set(ids.filter(Boolean))].sort(), [ids]);
  const { data } = useDeviceQuery<Record<string, RedditPost>>(
    'reddit', 'viewPostsByIds', { ids: key }, key.length > 0, { keepPrevious: true },
  );
  return key.length > 0 ? data ?? EMPTY_BY_ID : EMPTY_BY_ID;
}
