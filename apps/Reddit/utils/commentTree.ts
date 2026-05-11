import type { Comment, RedditCommentsOverlay } from '../types';

function isComment(value: Comment | null | undefined): value is Comment {
  return Boolean(value);
}

export function collectRedditCommentDeletionIds(
  comments: RedditCommentsOverlay,
  rootCommentId: string,
  ownAuthor: string,
): string[] {
  const root = comments[rootCommentId];
  if (!isComment(root) || String(root.author) !== ownAuthor) return [];

  const deletionIds: string[] = [rootCommentId];
  const queued = new Set<string>(deletionIds);
  let cursor = 0;

  while (cursor < deletionIds.length) {
    const parentId = deletionIds[cursor];
    cursor += 1;

    for (const comment of Object.values(comments)) {
      if (!isComment(comment)) continue;
      if (queued.has(comment.id)) continue;
      if (String(comment.author) !== ownAuthor) continue;
      if (String(comment.parentId ?? '') !== parentId) continue;

      queued.add(comment.id);
      deletionIds.push(comment.id);
    }
  }

  return deletionIds;
}
