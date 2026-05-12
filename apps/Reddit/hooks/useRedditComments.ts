import { useMemo } from 'react';
import { useRedditStore } from '../state';
import type { Comment } from '../types';
import { useFixturePosts } from './useRedditPosts';

function isComment(value: Comment | null | undefined): value is Comment {
  return Boolean(value);
}

export function useRedditComments(postId: string | null | undefined): Comment[] {
  const fixture = useFixturePosts();
  const commentsTable = useRedditStore((state) => state.comments);

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
            return overlay;
          }
          return { ...comment, postId };
        })
        .filter(isComment)
      : [];
    const seen = new Set(fixtureComments.map((comment) => comment.id));
    const runtimeComments = Object.values(commentsTable)
      .filter((comment): comment is Comment => isComment(comment) && comment.postId === postId)
      .filter((comment) => {
        if (seen.has(comment.id)) return false;
        seen.add(comment.id);
        return true;
      });
    return [...fixtureComments, ...runtimeComments];
  }, [fixture, commentsTable, postId]);
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
