/**
 * Device-backed app stores.
 *
 * The app's data lives in the device server session; the Zustand store is a
 * mirror of what the server exports, so components and `__SIM__.getState()`
 * keep reading plain store fields. Actions call server commands and adopt the
 * returned state. `localKeys` stay page-only (UI scratch state such as
 * `_temp`) and are never sent to the server.
 *
 * The mirror is synced once per session (`ensureSynced`); commands, queries
 * and `__SIM__.setState` patches wait for that first, so a patch is always
 * applied to the session's real state, never to unsynced defaults.
 *
 * Every adopted server state bumps the app's data version; `useDeviceQuery`
 * re-runs its query when that version changes.
 */

import { useEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import { create, type StoreApi, type UseBoundStore } from 'zustand';

import { registerAppStore, registerStateSetter } from '../createAppStore';
import * as TimeService from '../TimeService';
import { DeviceClient, DeviceStaleError, type DeviceSessionApi } from './DeviceClient';

// ── Data versions ──────────────────────────────────────────────────

const versions = new Map<string, number>();
const versionListeners = new Map<string, Set<() => void>>();

/**
 * Two frames: long enough for React to commit and run the effects that
 * re-query. Hidden pages pause rAF, so a short timer caps the wait.
 */
const afterRerender = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    setTimeout(resolve, 50);
  });

function bumpVersion(appId: string): void {
  versions.set(appId, (versions.get(appId) ?? 0) + 1);
  // Keep the page "busy" until dependent queries are queued, so whenIdle() covers them.
  if (typeof requestAnimationFrame === 'function') DeviceClient.hold(afterRerender());
  for (const listener of versionListeners.get(appId) ?? []) listener();
}

/** Subscribe to "this app's data changed" (every adopted server state). */
export function subscribeDeviceData(appId: string, listener: () => void): () => void {
  let set = versionListeners.get(appId);
  if (!set) versionListeners.set(appId, (set = new Set()));
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}

const subscribeVersion = (appId: string) => (listener: () => void) => subscribeDeviceData(appId, listener);
const getVersion = (appId: string) => () => versions.get(appId) ?? 0;

/** Per-app sync hooks, used by queries. `force` re-syncs even if already synced. */
const readyHooks = new Map<string, (force?: boolean) => Promise<void>>();

const isUninitialized = (err: unknown) => (err as { status?: number })?.status === 409;

/**
 * Wait until `appId`'s session state is synced, for code that calls
 * `DeviceClient.query` directly instead of through `useDeviceQuery`.
 */
export async function ensureDeviceSynced(appId: string, force = false): Promise<void> {
  await readyHooks.get(appId)?.(force);
}

// ── Store ──────────────────────────────────────────────────────────

const isUiEvent = (value: unknown) =>
  typeof Event !== 'undefined'
  && (value instanceof Event || (typeof value === 'object' && value !== null && (value as { nativeEvent?: unknown }).nativeEvent instanceof Event));

/**
 * Store actions used to be synchronous and ignored extra arguments, so pages
 * pass some of them straight to `onClick`. Command args travel as JSON; a UI
 * event would fail to serialize and drop the command. Cut the args at the
 * first event.
 */
function commandArgs(appId: string, name: string, args: unknown[]): unknown[] {
  const index = args.findIndex(isUiEvent);
  if (index === -1) return args;
  console.warn(`[device] ${appId}.${name}: ignoring a UI event passed as a command argument`);
  return args.slice(0, index);
}

export interface DeviceStoreHelpers {
  /** Run a server command; resolves to the command's return value. */
  command: (name: string, ...args: unknown[]) => Promise<unknown>;
  /**
   * Show `apply` at once, then run the command. Until it settles, every server
   * state adopted in between (earlier commands' answers) gets the still-pending
   * updates re-applied on top, in order, so a quick second tap reads and keeps
   * the first one's value. A failed command drops its update again.
   */
  optimistic: (apply: (state: any) => Record<string, unknown>, name: string, ...args: unknown[]) => Promise<unknown>;
}

export function createDeviceAppStore<
  S extends Record<string, any>,
  A extends { [K in keyof A]: (...args: any[]) => any },
>(
  appId: string,
  initialState: S,
  options: { localKeys: (keyof S)[] },
  actionCreator: (
    helpers: DeviceStoreHelpers,
    set: StoreApi<S & A>['setState'],
    get: () => S & A,
  ) => A,
): UseBoundStore<StoreApi<S & A>> & { ensureSynced: () => Promise<void> } {
  const localKeys = new Set<string>(options.localKeys as string[]);

  const serverData = (state: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(state)) {
      if (typeof v !== 'function' && !localKeys.has(k)) out[k] = v;
    }
    return out;
  };

  const store = create<S & A>()((set, get) => ({
    ...initialState,
    ...actionCreator({
      command: (name, ...args) => runCommand(name, commandArgs(appId, name, args)),
      optimistic: (apply, name, ...args) => runOptimistic(apply, name, commandArgs(appId, name, args)),
    }, set, get),
  }));

  /** Local updates whose commands have not settled yet, oldest first. */
  let pending: { apply: (state: any) => Record<string, unknown> }[] = [];
  /** The last state the server sent (pending updates not applied). */
  let serverState: Record<string, unknown> | null = null;

  const reapplyPending = () => {
    for (const entry of pending) store.setState(entry.apply(store.getState()) as Partial<S & A>);
  };

  const adopt = (state: unknown) => {
    if (state && typeof state === 'object') {
      serverState = state as Record<string, unknown>;
      store.setState(state as Partial<S & A>);
      reapplyPending();
    }
    bumpVersion(appId);
  };

  /** Count `work` (requests + adopting their results) as busy for `whenIdle()`. */
  const busy = <T,>(work: Promise<T>): Promise<T> => {
    DeviceClient.hold(work);
    return work;
  };

  /** Seed an uninitialized session with the mirror (inside an exclusive slot). */
  const seed = (api: DeviceSessionApi) => api.putState(appId, serverData(store.getState()));

  // ── sync, once per session ──
  let synced: { sid: string; gen: number; promise: Promise<void> } | null = null;

  /** Adopt the session's state, or seed the session with this page's state. */
  const syncNow = () =>
    DeviceClient.exclusive(async (api) => {
      const current = await api.getState(appId);
      return current.initialized ? current.state : (await seed(api)).state;
    }).then(adopt);

  async function ensureSynced(force = false): Promise<void> {
    const gen = DeviceClient.generation();
    const sid = await DeviceClient.sessionId();
    if (force || !synced || synced.sid !== sid || synced.gen !== gen) {
      const promise = busy(syncNow());
      synced = { sid, gen, promise };
      promise.catch(() => {
        if (synced?.promise === promise) synced = null;
      });
    }
    return synced.promise;
  }
  readyHooks.set(appId, ensureSynced);

  // ── commands ──
  async function runCommandNow(name: string, args: unknown[], settle?: () => void): Promise<unknown> {
    await ensureSynced();
    // Command and its recovery share one slot, so later commands cannot overtake it.
    const response = await DeviceClient.exclusive(async (api) => {
      const call = () => api.command(appId, name, args, TimeService.now());
      try {
        return await call();
      } catch (err) {
        // The server lost this app's state (restart): reseed from the mirror, retry once.
        if (!isUninitialized(err)) throw err;
        await seed(api);
        return call();
      }
    });
    settle?.();
    adopt(response.state);
    return response.result;
  }

  function runCommand(name: string, args: unknown[], settle?: () => void): Promise<unknown> {
    return busy(runCommandNow(name, args, settle)).catch((err) => {
      // A reset abandoned this command along with its episode.
      if (err instanceof DeviceStaleError) return undefined;
      throw err;
    });
  }

  function runOptimistic(apply: (state: any) => Record<string, unknown>, name: string, args: unknown[]): Promise<unknown> {
    const entry = { apply };
    pending.push(entry);
    store.setState(apply(store.getState()) as Partial<S & A>);
    const drop = () => {
      pending = pending.filter((e) => e !== entry);
    };
    return runCommand(name, args, drop).catch((err) => {
      // Failed: drop this update and show the server's state plus what is still pending.
      drop();
      if (serverState) {
        store.setState(serverState as Partial<S & A>);
        reapplyPending();
        bumpVersion(appId);
      }
      throw err;
    });
  }

  registerAppStore(appId, store as unknown as StoreApi<any>, () => {
    synced = null;
    pending = [];
    serverState = null;
    store.setState({ ...initialState } as Partial<S & A>);
    bumpVersion(appId);
  });

  registerStateSetter(appId, (applyPatch) =>
    busy((async () => {
      // Patch the session's real state: sync first, then merge, then push.
      await ensureSynced();
      const current: Record<string, any> = {};
      for (const [k, v] of Object.entries(store.getState())) if (typeof v !== 'function') current[k] = v;
      const next = applyPatch(current);
      store.setState(next as Partial<S & A>);
      bumpVersion(appId);
      const pushed = await DeviceClient.putState(appId, serverData(store.getState()));
      adopt(pushed.state);
    })()),
  );

  return Object.assign(store, { ensureSynced: () => ensureSynced() });
}

// ── Queries ────────────────────────────────────────────────────────

interface QueryEntry {
  version: number;
  data: unknown;
  inflight?: Promise<void>;
}

const MAX_CACHED_QUERIES = 200;
const queryCache = new Map<string, QueryEntry>();
const queryListeners = new Map<string, Set<() => void>>();

function notifyQuery(key: string): void {
  for (const listener of queryListeners.get(key) ?? []) listener();
}

/** Drop the oldest unsubscribed entries beyond the cap; mounted queries stay. */
function evictQueries(): void {
  if (queryCache.size <= MAX_CACHED_QUERIES) return;
  for (const key of queryCache.keys()) {
    if (queryCache.size <= MAX_CACHED_QUERIES) break;
    if (queryListeners.get(key)?.size) continue;
    queryCache.delete(key);
  }
}

/** Data version a query depends on: catalog queries read only shared read-only data. */
const queryVersion = (appId: string, catalog: boolean) => (catalog ? 0 : versions.get(appId) ?? 0);

function fetchQuery(
  key: string,
  appId: string,
  name: string,
  args: Record<string, unknown>,
  version: number,
  catalog: boolean,
): void {
  const entry = queryCache.get(key);
  if (entry?.inflight || entry?.version === version) return;
  const run = async () => {
    const ready = readyHooks.get(appId);
    await ready?.();
    try {
      return await DeviceClient.query(appId, name, args);
    } catch (err) {
      // The session was replaced underneath us: sync it, then retry once.
      if (!isUninitialized(err) || !ready) throw err;
      await ready(true);
      return DeviceClient.query(appId, name, args);
    }
  };
  const inflight = run().then(
    (data) => {
      queryCache.delete(key);
      queryCache.set(key, { version, data });
      evictQueries();
      notifyQuery(key);
      // Rendering this result can start dependent queries (ids -> records):
      // stay busy until they are queued, so whenIdle() covers them.
      if (typeof requestAnimationFrame === 'function') DeviceClient.hold(afterRerender());
      // Data changed while this request was in flight: refresh again.
      const latest = queryVersion(appId, catalog);
      if (latest !== version) fetchQuery(key, appId, name, args, latest, catalog);
    },
    (err) => {
      if (!(err instanceof DeviceStaleError)) console.error(`[device] query ${appId}.${name} failed`, err);
      if (entry) queryCache.set(key, { ...entry, inflight: undefined });
      else queryCache.delete(key);
    },
  );
  DeviceClient.hold(inflight);
  queryCache.set(key, { version: entry?.version ?? -1, data: entry?.data, inflight });
}

/**
 * Load a query into the cache ahead of the first render that reads it, e.g.
 * from an app's `preload()`, so pages mount with their catalog data the way
 * they did when it was a bundled JSON file. Same key as `useDeviceQuery`.
 */
export function prefetchDeviceQuery(
  appId: string,
  name: string,
  args: Record<string, unknown> = {},
  options: { catalog?: boolean } = {},
): Promise<void> {
  const catalog = Boolean(options.catalog);
  const key = `${appId}|${name}|${JSON.stringify(args)}`;
  fetchQuery(key, appId, name, args, queryVersion(appId, catalog), catalog);
  return queryCache.get(key)?.inflight ?? Promise.resolve();
}

/**
 * Run a device query and re-run it whenever the app's data changes. While a
 * refresh is in flight the previous result stays visible (`loading` is true).
 *
 * `keepPrevious`: also keep showing the last result while *new arguments* load
 * (next page of a list), so a growing list never collapses to empty and loses
 * its scroll position. Leave it off where stale data would be wrong (opening a
 * different record).
 *
 * `catalog`: the query reads only the app's shared read-only catalog, never
 * session state, so app commands do not re-run it.
 */
export function useDeviceQuery<T>(
  appId: string,
  name: string,
  args: Record<string, unknown>,
  enabled = true,
  options: { keepPrevious?: boolean; catalog?: boolean } = {},
): { data: T | undefined; loading: boolean } {
  const catalog = Boolean(options.catalog);
  const dataVersion = useSyncExternalStore(subscribeVersion(appId), getVersion(appId));
  const version = catalog ? 0 : dataVersion;
  const key = `${appId}|${name}|${JSON.stringify(args)}`;
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let set = queryListeners.get(key);
    if (!set) queryListeners.set(key, (set = new Set()));
    set.add(rerender);
    return () => {
      set!.delete(rerender);
    };
  }, [key]);

  useEffect(() => {
    if (enabled) fetchQuery(key, appId, name, args, version, catalog);
    // `args` is captured through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version, enabled]);

  const entry = queryCache.get(key);
  const previous = useRef<unknown>(undefined);
  const hasData = entry !== undefined && entry.version >= 0;
  if (hasData) previous.current = entry.data;
  const showPrevious = options.keepPrevious && enabled && !hasData;
  return {
    data: (showPrevious ? previous.current : entry?.data) as T | undefined,
    loading: enabled && entry?.version !== version,
  };
}
