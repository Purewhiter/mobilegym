import { describe, expect, it } from 'vitest';

import { resolveXRuntimePost, resolveXRuntimePosts } from '../apps/X/utils/runtimePostResolver';

describe('X runtime post resolver', () => {
  it('merges a runtime patch with the matching base post', () => {
    const base = {
      id: 'p1',
      authorId: 'u_base',
      content: 'base content',
      time: '1h',
      stats: { comments: 1, retweets: 2, likes: 3, views: 4 },
    };

    expect(
      resolveXRuntimePost(
        { p1: { id: 'p1', content: 'patched content' } },
        new Map([['p1', base]]),
        'p1',
      ),
    ).toEqual({
      ...base,
      content: 'patched content',
    });
  });

  it('returns null when a runtime tombstone hides a base post', () => {
    const base = {
      id: 'p1',
      authorId: 'u_base',
      content: 'base content',
      time: '1h',
      stats: { comments: 1, retweets: 2, likes: 3, views: 4 },
    };

    expect(resolveXRuntimePost({ p1: null }, new Map([['p1', base]]), 'p1')).toBeNull();
  });

  it('keeps patched base posts and tombstones in resolved post lists', () => {
    const basePosts = [
      {
        id: 'p1',
        authorId: 'u_base',
        content: 'base content',
        time: '1h',
        stats: { comments: 1, retweets: 2, likes: 3, views: 4 },
      },
      {
        id: 'p2',
        authorId: 'u_base',
        content: 'hidden content',
        time: '2h',
        stats: { comments: 0, retweets: 0, likes: 0, views: 0 },
      },
    ];

    expect(
      resolveXRuntimePosts(
        {
          p1: { id: 'p1', content: 'patched content' },
          p2: null,
        },
        basePosts,
      ),
    ).toEqual([
      {
        ...basePosts[0],
        content: 'patched content',
      },
    ]);
  });
});
