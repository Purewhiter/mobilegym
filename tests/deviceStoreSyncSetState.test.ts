import { beforeEach, describe, expect, it, vi } from 'vitest';

// A device session whose answers can be held back, with resettable
// generations, so writes happen while syncs, saves and injections are in
// flight and while the episode is reset.
let remote: Record<string, any> | null = null;
let generation = 0;
let failNext = false;
let hold: Promise<void> | null = null;
let holdSeed: (() => Promise<void>) | null = null;
let queue: Promise<unknown> = Promise.resolve();

class Stale extends Error {}

const answer = async () => {
  await new Promise((resolve) => setTimeout(resolve, 2));
  if (hold) await hold;
};

vi.mock('../os/device/DeviceClient', () => {
  const api = {
    getState: async () => {
      await answer();
      return { initialized: Boolean(remote), state: structuredClone(remote) };
    },
    putState: async (_appId: string, state: Record<string, any>) => {
      await holdSeed?.();
      await answer();
      remote = structuredClone(state);
      return { state: structuredClone(remote) };
    },
    command: async (_appId: string, name: string, args: any[]) => {
      await answer();
      if (failNext) {
        failNext = false;
        throw new Error('HTTP 503');
      }
      if (name === '__replace') remote = structuredClone(args[0]);
      else if (name === 'set') remote = { ...remote, ...structuredClone(args[0]) };
      return { state: structuredClone(remote), result: undefined };
    },
  };
  return {
    DeviceClient: {
      generation: () => generation,
      sessionId: async () => `s${generation}`,
      hold: () => {},
      exclusive: <T,>(fn: (a: typeof api) => Promise<T>, origin = generation) => {
        const result = queue.then(() => {
          if (origin !== generation) throw new Stale();
          return fn(api);
        });
        queue = result.catch(() => {});
        return result;
      },
    },
    DeviceStaleError: Stale,
  };
});

let resetHook: (() => void) | null = null;
let inject: ((patch: (s: any) => any) => Promise<void>) | null = null;
vi.mock('../os/createAppStore', () => ({
  registerAppStore: (_id: string, _store: unknown, reset: () => void) => {
    resetHook = reset;
  },
  registerStateSetter: (_id: string, setter: (patch: (s: any) => any) => Promise<void>) => {
    inject = setter;
  },
}));

const { createDeviceAppStore } = await import('../os/device/deviceStore');

type S = { items: string[]; a: number; b: number; flag: boolean; draft: string };
const initial: S = { items: [], a: 0, b: 0, flag: false, draft: '' };
let n = 0;

function pageStore() {
  return createDeviceAppStore<S, { add: (item: string) => void }>(
    `page-${++n}`, initial, { localKeys: ['draft'], syncSetState: true },
    (_d, set, get) => ({ add: (item) => set({ items: [...get().items, item] }) }),
  );
}

function normalizedStore() {
  return createDeviceAppStore<S, Record<never, never>>(
    `norm-${++n}`, initial,
    { localKeys: ['draft'], syncSetState: true, normalize: (st) => (Array.isArray(st.items) ? null : { items: [] }) },
    () => ({}),
  );
}

function commandStore() {
  return createDeviceAppStore<S, { toggle: () => Promise<unknown> }>(
    `cmd-${++n}`, initial, { localKeys: ['draft'] },
    ({ optimistic }, _set, get) => ({
      toggle: () => {
        const patch = { flag: !get().flag };
        return optimistic((s) => ({ ...s, ...patch }), 'set', patch);
      },
    }),
  );
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

beforeEach(() => {
  remote = null;
  generation = 0;
  failNext = false;
  hold = null;
  holdSeed = null;
});

describe('device store, page-authoritative (syncSetState)', () => {
  it('saves what the page shows, coalescing quick writes and never replaying them', async () => {
    const store = pageStore();
    await store.ensureSynced();
    store.getState().add('x');
    store.setState((s) => ({ a: s.a + 1 }));
    store.getState().add('y');
    store.setState({ draft: 'local only' });
    expect(store.getState().items).toEqual(['x', 'y']); // synchronous, as before
    await settle();
    expect(remote).toEqual({ items: ['x', 'y'], a: 1, b: 0, flag: false });
  });

  it('keeps writes made while the first sync is in flight', async () => {
    remote = { items: [], a: 9, b: 0, flag: false };
    const gate = deferred();
    hold = gate.promise;
    const store = pageStore(); // syncs on creation
    store.setState({ b: 1 });
    gate.release();
    hold = null;
    await settle();
    expect(store.getState()).toMatchObject({ a: 9, b: 1 });
    expect(remote).toMatchObject({ a: 9, b: 1 });
  });

  it('keeps writes made while an injection is in flight', async () => {
    const store = pageStore();
    await store.ensureSynced();
    const gate = deferred();
    hold = gate.promise;
    const injected = inject!((s) => ({ ...s, a: 5 }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    store.setState({ b: 1 });
    gate.release();
    hold = null;
    await injected;
    await settle();
    expect(store.getState()).toMatchObject({ a: 5, b: 1 });
    expect(remote).toMatchObject({ a: 5, b: 1 });
  });

  it('a failed save is followed by the next one carrying the page state', async () => {
    const store = pageStore();
    await store.ensureSynced();
    failNext = true;
    store.setState({ a: 1 });
    await settle();
    store.setState({ b: 1 });
    await settle();
    expect(remote).toMatchObject({ a: 1, b: 1 });
  });

  it('a functional write before the first sync of a new session lands once', async () => {
    const gate = deferred();
    hold = gate.promise;
    const store = pageStore(); // session not initialized: this sync seeds it
    store.getState().add('x');
    store.setState((s) => ({ draft: s.draft + '!' })); // page-only, functional
    gate.release();
    hold = null;
    await settle();
    expect(store.getState().items).toEqual(['x']);
    expect(store.getState().draft).toBe('!');
    expect(remote?.items).toEqual(['x']);
  });

  it('saves writes made after the initial seed was sent', async () => {
    const started = deferred();
    const gate = deferred();
    holdSeed = () => {
      started.release();
      return gate.promise;
    };
    const store = pageStore();
    await started.promise;
    store.setState((s) => ({ a: s.a + 1 }));
    gate.release();
    await settle();
    expect(store.getState().a).toBe(1);
    expect(remote?.a).toBe(1);
  });

  it('a save that fails after a reset does not carry its writes into the next episode', async () => {
    const store = pageStore();
    await store.ensureSynced();
    const gate = deferred();
    hold = gate.promise;
    failNext = true;
    store.setState({ a: 7 });
    await new Promise((resolve) => setTimeout(resolve, 5)); // the save is in flight
    generation += 1;
    resetHook?.();
    remote = null;
    gate.release();
    hold = null;
    await settle();
    await store.ensureSynced();
    await settle();
    expect(store.getState().a).toBe(0);
    expect(remote?.a ?? 0).toBe(0);
  });

  it('injected state is normalized', async () => {
    const store = normalizedStore();
    await store.ensureSynced();
    await inject!((s) => ({ ...s, items: null }));
    await settle();
    expect(store.getState().items).toEqual([]);
    expect(remote?.items).toEqual([]);
  });

  it('drops writes queued before a reset', async () => {
    const store = pageStore();
    await store.ensureSynced();
    store.setState({ a: 7 });
    generation += 1;
    resetHook?.();
    remote = null;
    await settle();
    expect(remote?.a).not.toBe(7);
    expect(store.getState().a).toBe(0);
  });
});

describe('device store, optimistic commands', () => {
  it('two taps before the first sync toggle twice and seed the session once', async () => {
    const store = commandStore();
    const t1 = store.getState().toggle();
    const t2 = store.getState().toggle();
    await Promise.all([t1, t2]);
    await settle();
    expect(store.getState().flag).toBe(false);
    expect(remote?.flag).toBe(false);
  });

  it('an injection keeps pending taps visible and applies them once', async () => {
    const store = commandStore();
    await store.ensureSynced();
    const gate = deferred();
    hold = gate.promise;
    const injected = inject!((s) => ({ ...s, b: 5 }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const t1 = store.getState().toggle(); // false -> true, queued behind the injection
    expect(store.getState().flag).toBe(true);
    const t2 = store.getState().toggle(); // sees true -> false
    gate.release();
    hold = null;
    await Promise.all([injected, t1, t2]);
    await settle();
    expect(store.getState()).toMatchObject({ b: 5, flag: false });
    expect(remote).toMatchObject({ b: 5, flag: false });
  });

  it('a command started before a reset does not run in the next session', async () => {
    const store = commandStore();
    const gate = deferred();
    hold = gate.promise; // first sync is held
    const tap = store.getState().toggle();
    generation += 1;
    resetHook?.();
    remote = null;
    gate.release();
    hold = null;
    await tap;
    await settle();
    expect(remote?.flag ?? false).toBe(false);
    expect(store.getState().flag).toBe(false);
  });
});
