import { describe, expect, it, vi } from 'vitest';

// A device session that answers commands one at a time, each after a delay,
// so later taps happen while earlier commands are still in flight.
let serverState: Record<string, any> | null = null;
let failNext = false;
let queue: Promise<unknown> = Promise.resolve();

vi.mock('../os/device/DeviceClient', () => {
  const api = {
    getState: async () => ({ initialized: Boolean(serverState), state: serverState }),
    putState: async (_appId: string, state: Record<string, any>) => ({ state: (serverState = structuredClone(state)) }),
    command: async (_appId: string, _name: string, [patch]: [Record<string, unknown>]) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (failNext) {
        failNext = false;
        throw new Error('HTTP 503');
      }
      serverState = { ...serverState, settings: { ...serverState!.settings, ...patch } };
      return { state: structuredClone(serverState), result: undefined };
    },
  };
  return {
    DeviceClient: {
      generation: () => 0,
      sessionId: async () => 'test',
      hold: () => {},
      exclusive: <T,>(fn: (a: typeof api) => Promise<T>) => {
        const result = queue.then(() => fn(api));
        queue = result.catch(() => {});
        return result;
      },
    },
    DeviceStaleError: class extends Error {},
  };
});
vi.mock('../os/createAppStore', () => ({ registerAppStore() {}, registerStateSetter() {} }));

const { createDeviceAppStore } = await import('../os/device/deviceStore');

type S = { settings: { on: boolean } };
type A = { toggle: () => Promise<void> };

function makeStore(appId: string) {
  serverState = null;
  return createDeviceAppStore<S, A>(appId, { settings: { on: false } }, { localKeys: [] }, ({ optimistic }, _set, get) => ({
    toggle: async () => {
      const patch = { on: !get().settings.on };
      await optimistic((s) => ({ settings: { ...s.settings, ...patch } }), 'update', patch);
    },
  }));
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 15));

describe('device store optimistic updates', () => {
  it('keeps pending taps when earlier answers arrive', async () => {
    const store = makeStore('opt-a');
    await store.ensureSynced();
    const t1 = store.getState().toggle();
    const t2 = store.getState().toggle();
    await tick(); // first answer arrives while the second is pending
    const t3 = store.getState().toggle();
    await Promise.all([t1, t2, t3]);
    expect(store.getState().settings.on).toBe(true);
    expect(serverState!.settings.on).toBe(true);
  });

  it('drops a failed update and keeps the others', async () => {
    const store = makeStore('opt-b');
    await store.ensureSynced();
    failNext = true;
    await expect(store.getState().toggle()).rejects.toThrow('HTTP 503');
    expect(store.getState().settings.on).toBe(false);
    await store.getState().toggle();
    expect(store.getState().settings.on).toBe(true);
  });
});
