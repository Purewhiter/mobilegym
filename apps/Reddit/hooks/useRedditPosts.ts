import { useMemo } from 'react';
import { useDeviceQuery } from '../../../os/device/deviceStore';
import { useRedditStore } from '../state';
import type { RedditPost } from '../types';
import { resolveRedditPosts } from '../utils/view';

// Stable empty fallback while the catalog query is loading.
const EMPTY_POSTS: RedditPost[] = Object.freeze([]) as readonly RedditPost[] as RedditPost[];

/** Catalog posts in feed order (no comment threads), from the device server. */
export function useFixturePosts(): RedditPost[] {
  const { data } = useDeviceQuery<RedditPost[]>('reddit', 'posts', {}, true, { catalog: true });
  return data ?? EMPTY_POSTS;
}

export function useRedditPosts(): RedditPost[] {
  const fixture = useFixturePosts();
  const postsOverlay = useRedditStore((state) => state.posts);
  const postIds = useRedditStore((state) => state.user.postIds);

  return useMemo(
    () => resolveRedditPosts(fixture, postsOverlay, postIds),
    [postIds, postsOverlay, fixture],
  );
}

export function useRedditPostById(id: string | null | undefined): RedditPost | null {
  const posts = useRedditPosts();

  return useMemo(() => {
    if (!id) return null;
    return posts.find((post) => post.id === id) ?? null;
  }, [id, posts]);
}
