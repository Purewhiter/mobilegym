import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../os/TimeService', () => ({ realNow: () => 1000 }));
afterEach(() => vi.unstubAllGlobals());

async function openTab(shared: Map<string, string>, namespace: string) {
  // Each tab has its own Storage prototype, but shares origin localStorage.
  class TabStorage {
    constructor(private values: Map<string, string>) {}
    get length() { return this.values.size; }
    key(index: number) { return [...this.values.keys()][index] ?? null; }
    getItem(key: string) { return this.values.get(key) ?? null; }
    setItem(key: string, value: string) { this.values.set(key, value); }
    removeItem(key: string) { this.values.delete(key); }
    clear() { this.values.clear(); }
  }
  const local = new TabStorage(shared);
  const session = new TabStorage(new Map([['__MG_STORAGE_NS__', namespace]]));
  vi.resetModules();
  vi.stubGlobal('Storage', TabStorage);
  vi.stubGlobal('window', {
    localStorage: local, sessionStorage: session, name: '',
    location: { href: 'http://localhost/?storageIsolation=tab' },
  });
  const { installLocalStorageNamespacing } = await import('../os/storageIsolation');
  installLocalStorageNamespacing();
  return local;
}

describe('tab storage persistence', () => {
  it('opening and reloading another tab preserves each tab data', async () => {
    const shared = new Map<string, string>();
    const first = await openTab(shared, 'ns_first');
    first.setItem('wechat', 'first saved state');
    const second = await openTab(shared, 'ns_second');
    second.setItem('wechat', 'second saved state');
    expect(shared.get('mg:ns_first:wechat')).toBe('first saved state');
    const reloaded = await openTab(shared, 'ns_first');
    expect(reloaded.getItem('wechat')).toBe('first saved state');
    expect(shared.get('mg:ns_second:wechat')).toBe('second saved state');
    reloaded.clear();
    expect(shared.get('mg:ns_second:wechat')).toBe('second saved state');
  });
});
