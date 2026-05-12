import { describe, expect, it } from 'vitest';

import { resolveXRuntimePost, resolveXRuntimePosts } from '../apps/X/utils/runtimePostResolver';

describe('X runtime post resolver', () => {
  it('treats a runtime object as a full override for the matching base post', () => {
    const base = {
      id: 'p1',
      authorId: 'u_base',
      content: 'base content',
      time: '1h',
      stats: { comments: 1, retweets: 2, likes: 3, views: 4 },
    };
    const override = { id: 'p1', content: 'override content' };

    expect(
      resolveXRuntimePost(
        { p1: override as any },
        new Map([['p1', base]]),
        'p1',
      ),
    ).toBe(override);
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

  it('keeps runtime overrides and tombstones in resolved post lists', () => {
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
    const override = { id: 'p1', content: 'override content' };

    expect(
      resolveXRuntimePosts(
        {
          p1: override as any,
          p2: null,
        },
        basePosts,
      ),
    ).toEqual([override]);
  });
});
