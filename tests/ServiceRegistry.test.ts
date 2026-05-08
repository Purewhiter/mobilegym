import { describe, it, expect } from 'vitest';
import {
  _testOnlyRegistry,
  resetAllOsStores,
  snapshotOsStores,
} from '../os/createOsStore';

function makeEntry(name: string, state: any = {}) {
  let current = { ...state };
  return {
    name,
    getState: () => current,
    reset: () => { current = { ...state }; },
  };
}

describe('OsStoreRegistry (inlined in createOsStore)', () => {
  it('register + get returns the same entry', () => {
    const entry = makeEntry('test_reg_1', { count: 0 });
    _testOnlyRegistry.register(entry);
    expect(_testOnlyRegistry.get('test_reg_1')).toBe(entry);
  });

  it('register silently ignores entries without a name', () => {
    const before = _testOnlyRegistry.size();
    _testOnlyRegistry.register({ name: '', getState: () => ({}), reset: () => {} });
    expect(_testOnlyRegistry.size()).toBe(before);
  });

  it('snapshot collects state from all registered entries', () => {
    _testOnlyRegistry.register(makeEntry('test_snap_1', { hello: 'world' }));
    const snap = snapshotOsStores();
    expect(snap).toHaveProperty('test_snap_1');
    expect(snap.test_snap_1).toEqual({ hello: 'world' });
  });

  it('resetAllOsStores calls reset on every registered entry', () => {
    const entry = makeEntry('test_reset_1', { n: 0 });
    let resetCalled = false;
    const origReset = entry.reset;
    entry.reset = () => { resetCalled = true; origReset(); };
    _testOnlyRegistry.register(entry);

    resetAllOsStores();
    expect(resetCalled).toBe(true);
  });

  it('register overwrites existing entry with same name', () => {
    const e1 = makeEntry('test_dup_1', { v: 1 });
    const e2 = makeEntry('test_dup_1', { v: 2 });
    _testOnlyRegistry.register(e1);
    _testOnlyRegistry.register(e2);
    expect(_testOnlyRegistry.get('test_dup_1')).toBe(e2);
  });
});
