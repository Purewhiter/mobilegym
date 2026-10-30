import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { flushAll } from '../os/debouncedPersist';
import * as Random from '../os/RandomService';

/** Minimal localStorage so the persisted counters can be exercised in node. */
function installLocalStorage(): Map<string, string> {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  return data;
}

describe('RandomService', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = installLocalStorage();
    Random._resetForTests();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    Random._resetForTests();
  });

  it('keyed streams depend only on seed and key, not on draw order', () => {
    Random.setSeed(42);
    const a = Random.stream('seat|order-1')();
    Random.next('noise');
    Random.stream('seat|order-2')();
    expect(Random.stream('seat|order-1')()).toBe(a);

    Random.setSeed(43);
    expect(Random.stream('seat|order-1')()).not.toBe(a);
  });

  it('scope sequences repeat for the same seed and restart when the seed changes', () => {
    Random.setSeed(7);
    const first = [Random.next('ids'), Random.next('ids'), Random.next('ids')];
    expect(new Set(first).size).toBe(3);

    Random.setSeed(8);
    Random.setSeed(7);
    expect([Random.next('ids'), Random.next('ids'), Random.next('ids')]).toEqual(first);
  });

  it('setting the same seed again does not restart sequences (no id reuse)', () => {
    Random.setSeed(5);
    const a = Random.next('ids');
    Random.setSeed(5);
    expect(Random.next('ids')).not.toBe(a);
  });

  it('counters survive a page reload, so new ids never repeat earlier ones', () => {
    Random.setSeed(11);
    const before = Random.base36(Random.nextStream('notes.note'), 8);
    flushAll();
    expect(storage.has('mg_random')).toBe(true);

    Random._resetForTests(); // simulate a reload: memory gone, localStorage kept
    expect(Random.getSeed()).toBe(11);
    const after = Random.base36(Random.nextStream('notes.note'), 8);
    expect(after).not.toBe(before);

    Random._resetForTests();
    storage.clear(); // simulate __SIM__.reset(): seed back to default, sequences restart
    expect(Random.getSeed()).toBe(Random.DEFAULT_SEED);
  });

  it('helpers stay in range', () => {
    const rng = Random.stream('helpers');
    for (let i = 0; i < 200; i++) {
      const v = Random.int(rng, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(7);
    }
    expect(Random.digits(Random.stream('d'), 6)).toMatch(/^\d{6}$/);
    expect(Random.base36(Random.stream('b'), 9)).toMatch(/^[0-9a-z]{9}$/);
    expect(Random.shuffle(Random.stream('s'), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
