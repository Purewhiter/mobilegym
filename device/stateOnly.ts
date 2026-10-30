/**
 * Device module for an app whose pages own the state logic and write the
 * store directly (`createDeviceAppStore(..., { syncSetState: true })`): the
 * session keeps the app's state (snapshots, resets, `__SIM__.getState()`),
 * and the single `__replace` command stores the page's new state as a whole.
 * No catalog.
 */

import type { AppModule } from './engine';

export function createStateOnlyModule(appId: string): AppModule<Record<string, unknown>> {
  return {
    appId,
    loadCatalog: () => ({ collections: new Map(), extras: {} }),
    materialize() {},
    exportState: (ctx) => ctx.state,
    importState(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${appId} state must be an object`);
      return raw as Record<string, unknown>;
    },
    commands: {
      __replace(ctx, [state]) {
        if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error(`${appId} state must be an object`);
        ctx.state = state as Record<string, unknown>;
      },
    },
    queries: {},
  };
}
