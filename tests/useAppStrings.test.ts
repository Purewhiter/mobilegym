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

describe('useAppStrings', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
  });

  it('允许应用语言覆盖系统语言', async () => {
    const mod = await import('../os/useAppStrings');
    const resolveAppStrings = (mod as any).resolveAppStrings;

    expect(resolveAppStrings).toBeTypeOf('function');

    const base = {
      home: '首页',
      settings: '设置',
    };
    const en = {
      home: 'Home',
    };

    expect(resolveAppStrings(base, en, 'zh-Hans')).toEqual(base);
    expect(resolveAppStrings(base, en, 'en')).toEqual({
      home: 'Home',
      settings: '设置',
    });
  });

  it('即使传入 localeOverride 也会无条件调用 useLocale', async () => {
    const useLocaleMock = vi.fn(() => 'en');
    vi.doMock('../os/locale', async () => {
      const actual = await vi.importActual<typeof import('../os/locale')>('../os/locale');
      return {
        ...actual,
        useLocale: useLocaleMock,
      };
    });

    const { useAppStrings } = await import('../os/useAppStrings');
    const base = {
      home: '首页',
    };
    const en = {
      home: 'Home',
    };

    expect(useAppStrings(base, en, 'zh-Hans')).toEqual(base);
    expect(useLocaleMock).toHaveBeenCalledTimes(1);
  });
});

describe('App locale resolve — null 回退系统语言', () => {
  it('resolveAlipayLocale: 具体值返回对应 locale，null/undefined 返回 zh-Hans', async () => {
    const { resolveAlipayLocale } = await import('../apps/Alipay/locale');
    expect(resolveAlipayLocale('en')).toBe('en');
    expect(resolveAlipayLocale('zh-CN')).toBe('zh-Hans');
    expect(resolveAlipayLocale('zh-TW')).toBe('zh-Hans');
    expect(resolveAlipayLocale(null)).toBe('zh-Hans');
    expect(resolveAlipayLocale(undefined)).toBe('zh-Hans');
  });

  it('resolveBilibiliLocale: 具体值返回对应 locale，null/undefined 返回 zh-Hans', async () => {
    const { resolveBilibiliLocale } = await import('../apps/Bilibili/locale');
    expect(resolveBilibiliLocale('en')).toBe('en');
    expect(resolveBilibiliLocale('zh')).toBe('zh-Hans');
    expect(resolveBilibiliLocale(null)).toBe('zh-Hans');
    expect(resolveBilibiliLocale(undefined)).toBe('zh-Hans');
  });

  it('resolveRedBookLocale: 具体值返回对应 locale，null/undefined 返回 zh-Hans', async () => {
    const { resolveRedBookLocale } = await import('../apps/RedBook/locale');
    expect(resolveRedBookLocale('en-US')).toBe('en');
    expect(resolveRedBookLocale('zh-CN')).toBe('zh-Hans');
    expect(resolveRedBookLocale(null)).toBe('zh-Hans');
    expect(resolveRedBookLocale(undefined)).toBe('zh-Hans');
  });
});
