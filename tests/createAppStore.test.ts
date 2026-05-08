import { describe, it, expect } from 'vitest';
import {
  createVolatileAppStore,
  getAllStoreStates,
  registerStateAdapter,
  invalidateStateCache,
} from '../os/createAppStore';

let uid = 0;
function uniqueId() { return `test_app_${++uid}_${Date.now()}`; }

describe('getAllStoreStates caching', () => {
  it('returns cached result when store state has not changed', () => {
    const appId = uniqueId();
    createVolatileAppStore(appId, { count: 0 });

    const first = getAllStoreStates();
    const second = getAllStoreStates();

    expect(second[appId]).toBe(first[appId]);
  });

  it('returns fresh result after store state changes', () => {
    const appId = uniqueId();
    const store = createVolatileAppStore(appId, { count: 0 });

    const first = getAllStoreStates();
    expect(first[appId].count).toBe(0);

    store.setState({ count: 1 });
    const second = getAllStoreStates();
    expect(second[appId].count).toBe(1);
    expect(second[appId]).not.toBe(first[appId]);
  });

  it('strips function values from store state', () => {
    const appId = uniqueId();
    createVolatileAppStore(appId, {
      value: 42,
      action: () => {},
    } as any);

    const states = getAllStoreStates();
    expect(states[appId].value).toBe(42);
    expect(states[appId].action).toBeUndefined();
  });

  it('applies state adapter on cache miss', () => {
    const appId = uniqueId();
    createVolatileAppStore(appId, { base: 1 });

    registerStateAdapter(appId, (raw) => ({
      ...raw,
      derived: raw.base * 10,
    }));

    const states = getAllStoreStates();
    expect(states[appId].base).toBe(1);
    expect(states[appId].derived).toBe(10);
  });

  it('invalidates cache when adapter is registered after first read', () => {
    const appId = uniqueId();
    createVolatileAppStore(appId, { base: 1 });

    const before = getAllStoreStates();
    expect(before[appId].derived).toBeUndefined();

    registerStateAdapter(appId, (raw) => ({
      ...raw,
      derived: raw.base * 10,
    }));

    const after = getAllStoreStates();
    expect(after[appId].derived).toBe(10);
    expect(after[appId]).not.toBe(before[appId]);
  });

  it('caches adapted result until store changes', () => {
    const appId = uniqueId();
    const store = createVolatileAppStore(appId, { base: 1 });

    let adapterCallCount = 0;
    registerStateAdapter(appId, (raw) => {
      adapterCallCount++;
      return { ...raw, derived: raw.base * 10 };
    });

    getAllStoreStates();
    const countAfterFirst = adapterCallCount;

    getAllStoreStates();
    expect(adapterCallCount).toBe(countAfterFirst);

    store.setState({ base: 2 });
    getAllStoreStates();
    expect(adapterCallCount).toBe(countAfterFirst + 1);
  });

  it('invalidateStateCache forces re-evaluation even if store ref unchanged', () => {
    const appId = uniqueId();
    createVolatileAppStore(appId, { base: 1 });

    let externalValue = 'old';
    registerStateAdapter(appId, (raw) => ({
      ...raw,
      external: externalValue,
    }));

    const first = getAllStoreStates();
    expect(first[appId].external).toBe('old');

    externalValue = 'new';
    // Without invalidation, cache would still return 'old'
    const stale = getAllStoreStates();
    expect(stale[appId].external).toBe('old');

    invalidateStateCache(appId);
    const fresh = getAllStoreStates();
    expect(fresh[appId].external).toBe('new');
  });
});
