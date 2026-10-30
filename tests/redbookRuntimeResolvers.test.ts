import { describe, expect, it } from 'vitest';
import { resolveRedBookRuntimeUser } from '../apps/RedBook/utils/runtimeResolvers';
import type { User } from '../apps/RedBook/types';

const currentUser: User = {
  id: 'me',
  name: 'Me',
  avatar: '',
  followingIds: [],
  followerIds: [],
};

const baseUser: User = {
  id: 'author_1',
  name: 'Base Author',
  avatar: 'base-avatar.png',
  followers: 10,
  following: 1,
};

// Note/comment overlay semantics moved with the merge into the device module:
// see redbookDevice.test.ts.

describe('RedBook runtime user resolver', () => {
  it('uses runtime user overlay as a replacement instead of backfilling from base', () => {
    const user = resolveRedBookRuntimeUser(
      { author_1: { id: 'author_1', name: 'Overlay Author' } as any },
      { author_1: baseUser },
      currentUser,
      'author_1',
    ) as any;

    expect(user.name).toBe('Overlay Author');
    expect(user.avatar).toBeUndefined();
  });
});
