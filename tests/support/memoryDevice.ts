/**
 * In-memory stand-in for `os/device/DeviceClient`, running real app modules'
 * commands, so store tests exercise the device-backed stores without a server:
 *
 *   vi.mock('@/os/device/DeviceClient', async () =>
 *     (await import('./support/memoryDevice')).memoryDeviceClient([createXModule({ cdnBase: '/cdn' })]));
 *
 * `serverState` / `patchServerState` read and change the session behind the
 * store (then `await store.ensureSynced(true)` to adopt it); `resetServerStates`
 * starts each test from an unseeded session.
 */

import type { AppModule } from '../../device/engine';

// On globalThis: `vi.resetModules()` gives the mock and the test separate copies of this module.
const g = globalThis as { __memoryDeviceStates?: Map<string, any> };
const states = (g.__memoryDeviceStates ??= new Map<string, any>());

export const serverState = (appId: string) => states.get(appId);

/** Forget every session (call in `beforeEach`; mock factories are not re-run per test). */
export const resetServerStates = () => states.clear();

export function patchServerState(appId: string, patch: Record<string, unknown>): void {
  states.set(appId, { ...states.get(appId), ...structuredClone(patch) });
}

export function memoryDeviceClient(modules: AppModule<any>[]) {
  states.clear();
  const byId = new Map(modules.map((m) => [m.appId, m]));
  let queue: Promise<unknown> = Promise.resolve();
  const api = {
    getState: async (appId: string) => ({ initialized: states.has(appId), state: structuredClone(states.get(appId)) }),
    putState: async (appId: string, next: unknown) => {
      states.set(appId, structuredClone(next));
      return { state: structuredClone(next) };
    },
    command: async (appId: string, name: string, args: unknown[], now: number) => {
      const ctx: any = { state: states.get(appId) };
      const result = byId.get(appId)!.commands[name]!(ctx, structuredClone(args), { now });
      states.set(appId, ctx.state);
      return { state: structuredClone(ctx.state), result: structuredClone(result) };
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
}
