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

describe('RedBook data loader hydration', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
    vi.stubGlobal('__SIM__', { _benchmarkPatchedApps: new Set<string>() });
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const raw = String(url);
      if (raw.endsWith('/users.json')) {
        return Response.json([
          {
            id: 'u_loader',
            name: 'Loader User',
            avatar: '',
            intro: '',
            location: '北京',
            followers: 1,
            following: 0,
            likesAndCollections: 0,
          },
        ]);
      }
      if (raw.endsWith('/notes.json')) {
        return Response.json([
          {
            id: 'n_loader',
            title: 'Loader Note',
            desc: 'loaded from JSON',
            content: 'loaded from JSON',
            authorId: 'u_loader',
            images: [],
            likes: 0,
            collections: 0,
            comments: 0,
            commentList: [],
            createdAt: 1,
          },
        ]);
      }
      return new Response('not found', { status: 404 });
    }));
  });

  it('hydrates RedBook store during benchmark data preload', async () => {
    const loader = await import('../apps/RedBook/data/loader');

    expect(loader.hydrateStore).toBeTypeOf('function');

    await loader.hydrateStore();

    const { useRedBookStore } = await import('../apps/RedBook/state');
    const state = useRedBookStore.getState();

    expect(state.entities.usersById.u_loader?.name).toBe('Loader User');
    expect(state.entities.notesById.n_loader?.title).toBe('Loader Note');
    expect(state.feedIds).toContain('n_loader');
    expect(state.userIds).toContain('u_loader');
  });
});
