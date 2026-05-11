import { useEffect, useMemo, useState } from 'react';
import { useRedditStore } from '../state';
import type { RedditPost } from '../types';
import { getPostsSync, loadPosts } from '../data/loader';

function isRedditPost(value: RedditPost | null | undefined): value is RedditPost {
  return Boolean(value);
}

export function useFixturePosts(): RedditPost[] {
  const [posts, setPosts] = useState<RedditPost[]>(() => getPostsSync() ?? []);

  useEffect(() => {
    if (getPostsSync()) return;
    let cancelled = false;
    loadPosts().then((loaded) => {
      if (!cancelled) setPosts(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return posts;
}

export function useRedditPosts(): RedditPost[] {
  const fixture = useFixturePosts();
  const postsOverlay = useRedditStore((state) => state.posts);
  const postIds = useRedditStore((state) => state.user.postIds);

  return useMemo(() => {
    const myPosts = postIds.map((id) => postsOverlay[id]).filter(isRedditPost);
    const seen = new Set(myPosts.map((post) => post.id));
    const fixturePosts = fixture
      .map((post) => {
        const id = String(post.id);
        if (Object.prototype.hasOwnProperty.call(postsOverlay, id)) {
          const overlay = postsOverlay[id];
          if (overlay === null) return null;
          return { ...post, ...overlay };
        }
        return post;
      })
      .filter(isRedditPost)
      .filter((post) => {
        if (seen.has(post.id)) return false;
        seen.add(post.id);
        return true;
      });
    return [...myPosts, ...fixturePosts];
  }, [postIds, postsOverlay, fixture]);
}

export function useRedditPostById(id: string | null | undefined): RedditPost | null {
  const posts = useRedditPosts();

  return useMemo(() => {
    if (!id) return null;
    return posts.find((post) => post.id === id) ?? null;
  }, [id, posts]);
}
