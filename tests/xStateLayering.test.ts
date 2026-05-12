import { describe, expect, it } from 'vitest';
import { getAllStoreStates } from '../os/createAppStore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import defaults from '../apps/X/data/defaults.json';
import posts from '../apps/X/data/posts.json';
import users from '../apps/X/data/users.json';
import { useXStore } from '../apps/X/state';

describe('X state layering', () => {
  it('does not expose derived follow counts in raw getState output', () => {
    const x = getAllStoreStates().x;

    expect(x.user.followedUserIds).toEqual(expect.any(Array));
    expect(x.user.followerUserIds).toEqual(expect.any(Array));
    expect(x.user.following).toBeUndefined();
    expect(x.user.followers).toBeUndefined();
  });

  it('clears pending quoted post after addPost consumes it', () => {
    act(() => {
      useXStore.setState({ pendingQuotedPostId: 'p_quote_target', posts: {}, user: defaults.user as any });
    });

    act(() => {
      useXStore.getState().addPost('first post');
    });

    const state = useXStore.getState();
    const created = Object.values(state.posts).find((post: any) => post?.content === 'first post') as any;
    expect(created?.quotedPostId).toBe('p_quote_target');
    expect(state.pendingQuotedPostId).toBeNull();
  });

  it('keeps defaults references aligned with base X datasets', () => {
    const userTable = users as Record<string, unknown>;
    const postTable = new Set((posts as Array<{ id?: string }>).map(post => post.id).filter(Boolean));
    const xDefaults = defaults as any;

    expect(xDefaults.suggestedFollowingIds).toEqual(expect.any(Array));
    for (const id of xDefaults.suggestedFollowingIds) {
      expect(userTable[id], `suggestedFollowingIds contains missing user id ${id}`).toBeTruthy();
    }

    for (const notification of xDefaults.notifications ?? []) {
      if (notification.postId) {
        expect(postTable.has(notification.postId), `notification ${notification.id} has missing postId ${notification.postId}`).toBe(true);
      }
    }
  });

  it('keeps profile and reply pages on focused X data hooks', () => {
    const profile = readFileSync(resolve('apps/X/pages/ProfilePage.tsx'), 'utf8');
    const reply = readFileSync(resolve('apps/X/pages/ReplyPage.tsx'), 'utf8');

    expect(profile).toContain('useXUserProfilePosts');
    expect(profile).not.toContain('useXHydratedPosts');
    expect(reply).toContain('useXRepliesForPost');
    expect(reply).not.toContain('useXHydratedPosts');
  });
});
