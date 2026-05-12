import { useMemo, useSyncExternalStore } from 'react';
import { useRedditStore } from '../state';
import type { RedditPost } from '../types';
import { getPostsSync, subscribePosts } from '../data/loader';

function isRedditPost(value: RedditPost | null | undefined): value is RedditPost {
  return Boolean(value);
}

// Stable empty fallback so useSyncExternalStore's snapshot identity stays
// fixed before loadPosts() resolves — otherwise React would re-render on
// every commit (different `[]` reference each call).
const EMPTY_POSTS: RedditPost[] = Object.freeze([]) as readonly RedditPost[] as RedditPost[];

const getFixtureSnapshot = (): RedditPost[] => getPostsSync() ?? EMPTY_POSTS;

export function useFixturePosts(): RedditPost[] {
  return useSyncExternalStore(subscribePosts, getFixtureSnapshot, getFixtureSnapshot);
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
