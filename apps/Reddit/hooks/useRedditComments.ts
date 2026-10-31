import { useMemo } from 'react';
import { useRedditStore } from '../state';
import type { Comment } from '../types';
import { useDeviceQuery } from '../../../os/device/deviceStore';
import { resolveRedditComments } from '../utils/view';

function isComment(value: Comment | null | undefined): value is Comment {
  return Boolean(value);
}

export function useRedditComments(postId: string | null | undefined): Comment[] {
  const { data: fixture } = useDeviceQuery<Comment[]>(
    'reddit', 'postComments', { postId }, Boolean(postId), { catalog: true },
  );
  const commentsTable = useRedditStore((state) => state.comments);

  return useMemo(
    () => (postId ? resolveRedditComments(Array.isArray(fixture) ? fixture : [], commentsTable, postId) : []),
    [fixture, commentsTable, postId],
  );
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
