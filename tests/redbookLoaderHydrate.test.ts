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

  it('populates the loader-level base dataset cache and notifies subscribers', async () => {
    const loader = await import('../apps/RedBook/data/loader');

    expect(loader.hydrateStore).toBeTypeOf('function');
    expect(loader.getBaseDataset()).toBeNull();

    const notifications: number[] = [];
    const unsubscribe = loader.subscribeBaseDataset(() => {
      notifications.push(1);
    });

    await loader.hydrateStore();

    const base = loader.getBaseDataset();
    expect(base?.usersById.u_loader?.name).toBe('Loader User');
    expect(base?.notesById.n_loader?.title).toBe('Loader Note');
    expect(base?.feedIds).toContain('n_loader');
    expect(base?.userIds).toContain('u_loader');
    expect(notifications.length).toBe(1);

    unsubscribe();
  });

  it('does not introduce base dataset fields into the Zustand store state', async () => {
    const loader = await import('../apps/RedBook/data/loader');
    await loader.hydrateStore();

    const { useRedBookStore } = await import('../apps/RedBook/state');
    const state: any = useRedBookStore.getState();

    expect(state.entities).toBeUndefined();
    expect(state.feedIds).toBeUndefined();
    expect(state.userIds).toBeUndefined();
  });
});
