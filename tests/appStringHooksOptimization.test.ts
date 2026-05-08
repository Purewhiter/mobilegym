import { beforeEach, describe, expect, it, vi } from 'vitest';

type WrapperCase = {
  modulePath: string;
  localeModulePath: string;
  exportName: string;
  osStringsModulePath: string;
};

async function expectWrapperResolvesStringsDirectly({
  modulePath,
  localeModulePath,
  exportName,
  osStringsModulePath,
}: WrapperCase) {
  const useLocaleMock = vi.fn(() => 'en');
  const useAppStringsMock = vi.fn(() => ({ source: 'useAppStrings' }));
  const resolveAppStringsMock = vi.fn(() => ({ source: 'resolveAppStrings' }));

  vi.doMock(osStringsModulePath, () => ({
    useAppStrings: useAppStringsMock,
    resolveAppStrings: resolveAppStringsMock,
  }));
  vi.doMock(localeModulePath, async () => {
    const actual = await vi.importActual<Record<string, unknown>>(localeModulePath);
    return {
      ...actual,
      useLocale: useLocaleMock,
    };
  });

  const mod = await import(modulePath);
  const hook = mod[exportName] as () => unknown;

  expect(hook()).toEqual({ source: 'resolveAppStrings' });
  expect(useLocaleMock).toHaveBeenCalledTimes(1);
  expect(resolveAppStringsMock).toHaveBeenCalledTimes(1);
  expect(useAppStringsMock).not.toHaveBeenCalled();
}

describe('App string hooks optimization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('useAlipayStrings 直接按 app locale 解析文案', async () => {
    await expectWrapperResolvesStringsDirectly({
      modulePath: '../apps/Alipay/hooks/useAlipayStrings',
      localeModulePath: '../apps/Alipay/locale',
      exportName: 'useAlipayStrings',
      osStringsModulePath: '@/os/useAppStrings',
    });
  });

  it('useMapStrings 直接按 app locale 解析文案', async () => {
    await expectWrapperResolvesStringsDirectly({
      modulePath: '../apps/Map/hooks/useMapStrings',
      localeModulePath: '../apps/Map/locale',
      exportName: 'useMapStrings',
      osStringsModulePath: '../os/useAppStrings',
    });
  });

  it('useBilibiliStrings 直接按 app locale 解析文案', async () => {
    await expectWrapperResolvesStringsDirectly({
      modulePath: '../apps/Bilibili/hooks/useBilibiliStrings',
      localeModulePath: '../apps/Bilibili/locale',
      exportName: 'useBilibiliStrings',
      osStringsModulePath: '@/os/useAppStrings',
    });
  });

  it('useRedBookStrings 直接按 app locale 解析文案', async () => {
    await expectWrapperResolvesStringsDirectly({
      modulePath: '../apps/RedBook/hooks/useRedBookStrings',
      localeModulePath: '../apps/RedBook/locale',
      exportName: 'useRedBookStrings',
      osStringsModulePath: '@/os/useAppStrings',
    });
  });
});
