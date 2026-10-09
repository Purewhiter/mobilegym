/**
 * App string wrapper hooks — 优化契约测试
 *
 * 契约：每个 App 的 useXxxStrings 包装 hook 必须
 *   1. 用 App 本地的 useLocale（../locale，尊重 App 内语言覆盖），
 *   2. 通过纯函数 resolveAppStrings 直接解析文案，
 *   3. 不调用 OS 级 useAppStrings（那会走 OS locale，绕过 App 覆盖）。
 *
 * 之前的写法在 node 环境直接调用 hook 函数并断言 mock 调用次数——
 * 一旦包装 hook 内部合法使用 React hooks（如 useMemo 缓存结果），
 * 脱离 React 渲染器直接调用就会崩（dispatcher 为 null）。
 * 因此这里不真实调用任何含 React hooks 的函数，改为：
 *   - 对 hook 源码做静态断言（import/调用形状）；
 *   - 对可纯调用的 resolveAppStrings 做行为断言。
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type WrapperCase = {
  /** 相对本测试文件的 hook 源码路径 */
  sourcePath: string;
  exportName: string;
};

const WRAPPER_CASES: WrapperCase[] = [
  { sourcePath: '../apps/Alipay/hooks/useAlipayStrings.ts', exportName: 'useAlipayStrings' },
  { sourcePath: '../apps/Map/hooks/useMapStrings.ts', exportName: 'useMapStrings' },
  { sourcePath: '../apps/Bilibili/hooks/useBilibiliStrings.ts', exportName: 'useBilibiliStrings' },
  { sourcePath: '../apps/RedBook/hooks/useRedBookStrings.ts', exportName: 'useRedBookStrings' },
];

function readWrapperSource(sourcePath: string): string {
  return fs.readFileSync(fileURLToPath(new URL(sourcePath, import.meta.url)), 'utf-8');
}

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

describe('App string hooks optimization', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
  });

  describe.each(WRAPPER_CASES)('$exportName', ({ sourcePath, exportName }) => {
    it('不引用 OS 级 useAppStrings，直接用 resolveAppStrings 解析', () => {
      const source = readWrapperSource(sourcePath);

      // 不得具名导入 useAppStrings（注意：import 路径本身包含 "useAppStrings" 字样，
      // 所以只检查花括号内的具名导入，而不是全文匹配）。
      expect(source).not.toMatch(/import\s*(?:type\s*)?\{[^}]*\buseAppStrings\b[^}]*\}/);
      // 不得调用 useAppStrings(...)（\b 保证不会误匹配 resolveAppStrings(...)）。
      expect(source).not.toMatch(/\buseAppStrings\s*\(/);

      // 必须从 os/useAppStrings 导入纯函数 resolveAppStrings 并调用它。
      expect(source).toMatch(
        /import\s*\{[^}]*\bresolveAppStrings\b[^}]*\}\s*from\s*['"](?:@\/os\/useAppStrings|[./]+os\/useAppStrings)['"]/,
      );
      expect(source).toMatch(/\bresolveAppStrings\s*\(/);
    });

    it('用 App 本地 useLocale（../locale）取语言', () => {
      const source = readWrapperSource(sourcePath);
      expect(source).toMatch(/import\s*\{[^}]*\buseLocale\b[^}]*\}\s*from\s*['"]\.\.\/locale['"]/);
      expect(source).toMatch(/\buseLocale\s*\(\s*\)/);
    });

    it('模块可在 node 环境加载且导出为函数（不调用 hook 本身）', async () => {
      const mod = await import(/* @vite-ignore */ sourcePath.replace(/\.ts$/, ''));
      expect(mod[exportName]).toBeTypeOf('function');
    });
  });

  it('resolveAppStrings 按 locale 解析：zh-Hans 返回 base，en 合并覆盖', async () => {
    const { resolveAppStrings } = await import('../os/useAppStrings');

    const base = { home: '首页', settings: '设置' };
    const en = { home: 'Home' };

    expect(resolveAppStrings(base, en, 'zh-Hans')).toBe(base);
    expect(resolveAppStrings(base, en, 'en')).toEqual({ home: 'Home', settings: '设置' });
    expect(resolveAppStrings(base, undefined, 'en')).toBe(base);
  });
});
