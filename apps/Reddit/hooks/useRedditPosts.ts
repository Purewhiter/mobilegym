import { useMemo } from 'react';
import { useDeviceQuery } from '../../../os/device/deviceStore';
import { useRedditStore } from '../state';
import type { RedditPost } from '../types';

function isRedditPost(value: RedditPost | null | undefined): value is RedditPost {
  return Boolean(value);
}

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

  return useMemo(() => {
    const fixtureById = new Map(fixture.map((post) => [String(post.id), post]));
    const resolvePost = (id: string): RedditPost | null => {
      if (Object.prototype.hasOwnProperty.call(postsOverlay, id)) {
        return postsOverlay[id];
      }
      return fixtureById.get(id) ?? null;
    };
    const indexedPosts = postIds.map((id) => resolvePost(id)).filter(isRedditPost);
    const seen = new Set(indexedPosts.map((post) => post.id));
    const fixturePosts = fixture
      .map((post) => {
        const id = String(post.id);
        if (Object.prototype.hasOwnProperty.call(postsOverlay, id)) {
          const overlay = postsOverlay[id];
          if (overlay === null) return null;
          return overlay;
        }
        return post;
      })
      .filter(isRedditPost)
      .filter((post) => {
        if (seen.has(post.id)) return false;
        seen.add(post.id);
        return true;
      });
    return [...indexedPosts, ...fixturePosts];
  }, [postIds, postsOverlay, fixture]);
}

export function useRedditPostById(id: string | null | undefined): RedditPost | null {
  const posts = useRedditPosts();

  return useMemo(() => {
    if (!id) return null;
    return posts.find((post) => post.id === id) ?? null;
  }, [id, posts]);
}
