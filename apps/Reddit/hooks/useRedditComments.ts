import { useEffect, useMemo, useState } from 'react';
import { useRedditStore } from '../state';
import type { Comment, RedditPost } from '../types';
import { getPostsSync, loadPosts } from '../data/loader';

function isComment(value: Comment | null | undefined): value is Comment {
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

export function useRedditComments(postId: string | null | undefined): Comment[] {
  const fixture = useFixturePosts();
  const commentsTable = useRedditStore((state) => state.comments);
  const commentIds = useRedditStore((state) => state.user.commentIds);

  return useMemo(() => {
    if (!postId) return [];
    const post = fixture.find((item) => item.id === postId);
    const fixtureComments = Array.isArray(post?.commentsData)
      ? post.commentsData
        .map((comment) => {
          const id = String(comment.id);
          if (Object.prototype.hasOwnProperty.call(commentsTable, id)) {
            const overlay = commentsTable[id];
            if (overlay === null) return null;
            return { ...comment, ...overlay, postId: overlay.postId ?? postId };
          }
          return { ...comment, postId };
        })
        .filter(isComment)
      : [];
    const seen = new Set(fixtureComments.map((comment) => comment.id));
    const myComments = commentIds
      .map((id) => commentsTable[id])
      .filter((comment): comment is Comment => isComment(comment) && comment.postId === postId)
      .filter((comment) => {
        if (seen.has(comment.id)) return false;
        seen.add(comment.id);
        return true;
      });
    return [...fixtureComments, ...myComments];
  }, [fixture, commentsTable, commentIds, postId]);
}

export function useMyRedditComments(): Comment[] {
  const commentsTable = useRedditStore((state) => state.comments);
  const commentIds = useRedditStore((state) => state.user.commentIds);

  return useMemo(
    () => commentIds
      .map((id) => commentsTable[id])
      .filter(isComment)
      .sort((a, b) => (b.created_utc ?? 0) - (a.created_utc ?? 0)),
    [commentIds, commentsTable],
  );
}
