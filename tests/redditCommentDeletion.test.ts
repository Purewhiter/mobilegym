import { describe, expect, it } from 'vitest';

import { collectRedditCommentDeletionIds } from '../apps/Reddit/utils/commentTree';
import type { Comment } from '../apps/Reddit/types';

describe('Reddit comment deletion helpers', () => {
  it('collects an own comment and its own descendants only', () => {
    const comments: Record<string, Comment> = {
      root: {
        id: 'root',
        postId: 'post_1',
        author: 'me',
        body: 'root',
      },
      child: {
        id: 'child',
        postId: 'post_1',
        parentId: 'root',
        author: 'me',
        body: 'child',
      },
      grandchild: {
        id: 'grandchild',
        postId: 'post_1',
        parentId: 'child',
        author: 'me',
        body: 'grandchild',
      },
      otherUserChild: {
        id: 'otherUserChild',
        postId: 'post_1',
        parentId: 'root',
        author: 'someone_else',
        body: 'keep',
      },
    };

    expect(collectRedditCommentDeletionIds(comments, 'root', 'me')).toEqual([
      'root',
      'child',
      'grandchild',
    ]);
  });
});
