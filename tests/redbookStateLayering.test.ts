import { beforeEach, describe, expect, it, vi } from 'vitest';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('RedBook runtime state layering', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
  });

  it('does not expose relationship counts as raw getState user fields', async () => {
    await import('../apps/RedBook/state');
    const { getAllStoreStates } = await import('../os/createAppStore');

    const redbook = getAllStoreStates().redbook;

    expect(redbook.user.followingIds).toEqual(expect.any(Array));
    expect(redbook.user.followerIds).toEqual(expect.any(Array));
    expect(redbook.user.following).toBeUndefined();
    expect(redbook.user.followers).toBeUndefined();
  });

  it('filters derived relationship count fields from updateUser writes', async () => {
    const { useRedBookStore } = await import('../apps/RedBook/state');
    const { getAllStoreStates } = await import('../os/createAppStore');

    useRedBookStore.getState().updateUser({
      intro: '新的简介',
      following: 999,
      followers: 888,
    } as any);

    const rawUser = useRedBookStore.getState().user as any;
    const exportedUser = getAllStoreStates().redbook.user as any;

    expect(rawUser.intro).toBe('新的简介');
    expect(rawUser.following).toBeUndefined();
    expect(rawUser.followers).toBeUndefined();
    expect(exportedUser.following).toBeUndefined();
    expect(exportedUser.followers).toBeUndefined();
  });
});
