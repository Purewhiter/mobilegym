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

  // updateUser's filtering of derived counts runs on the device server now:
  // see redbookDevice.test.ts.
});
