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

describe('Map locale', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
  });

  it('应用语言优先，未设置时回退系统语言', async () => {
    const mapLocale = await import('../apps/Map/locale');
    const osLocale = await import('../os/locale');
    const { useMapStore } = await import('../apps/Map/state');

    expect(mapLocale.getLocale()).toBe('zh-Hans');

    useMapStore.setState((state) => ({
      settings: {
        ...state.settings,
        appDisplay: {
          ...state.settings.appDisplay,
          language: 'en',
        },
      },
    }));
    expect(mapLocale.getLocale()).toBe('en');

    osLocale.setLocale('en');
    useMapStore.setState((state) => ({
      settings: {
        ...state.settings,
        appDisplay: {
          ...state.settings.appDisplay,
          language: null,
        },
      },
    }));
    expect(mapLocale.getLocale()).toBe('en');
  });
});
