import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const clock = vi.hoisted(() => ({ value: 1_790_000_000_000 }));
vi.mock('../os/TimeService', () => ({ realNow: () => clock.value }));

let storage: Map<string, string>;
let requests: string[];
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  clock.value = 1_790_000_000_000;
  vi.setSystemTime(clock.value);
  storage = new Map();
  requests = [];
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    addEventListener: vi.fn(),
  });
  vi.stubGlobal('Image', class {
    onerror?: () => void;
    onload?: () => void;
    set src(url: string) {
      requests.push(url);
      queueMicrotask(() => this.onerror?.());
    }
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('WMR negative resource cache', () => {
  it('expires a confirmed 404 within the same page', async () => {
    const cache = await import('../os/wmr/engine/imageCache');
    cache.rememberFailedUrl('/review/strings.xml');
    expect(cache.isKnownFailedUrl('/review/strings.xml')).toBe(true);
    clock.value += 6 * 60 * 60 * 1000 + 1;
    vi.setSystemTime(clock.value);
    expect(cache.isKnownFailedUrl('/review/strings.xml')).toBe(false);
  });

  it('retries transient image errors and does not persist them', async () => {
    const cache = await import('../os/wmr/engine/imageCache');
    const first = cache.loadImage('/review/image.png');
    await vi.runAllTicks();
    await first;
    expect(cache.isImageLoadFailed('/review/image.png')).toBe(true);
    expect(storage.size).toBe(0);
    clock.value += 5001;
    vi.setSystemTime(clock.value);
    const retry = cache.loadImage('/review/image.png');
    await vi.runAllTicks();
    await retry;
    expect(requests).toEqual(['/review/image.png', '/review/image.png']);
  });

  it('a fresh inventory allows an image previously listed as missing', async () => {
    const cache = await import('../os/wmr/engine/imageCache');
    cache.registerAssetIndexFiles('/review/', []);
    await cache.loadImage('/review/new.png');
    expect(requests).toEqual([]);
    cache.registerAssetIndexFiles('/review/', ['new.png']);
    const load = cache.loadImage('/review/new.png');
    await vi.runAllTicks();
    await load;
    expect(requests).toEqual(['/review/new.png']);
  });
});
