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

import { readPersistedAppState, registerAppStore, registerStateSetter } from '../createAppStore';
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
const pageSaves = new Map<string, { retry: () => void; isDirty: () => boolean }>();

/** Wait for server commands and confirm that browser-authoritative writes reached the session. */
export async function waitForStateCommit(): Promise<void> {
  const generation = DeviceClient.generation();
  const wait = async () => {
    await DeviceClient.whenIdle();
    if (DeviceClient.generation() !== generation) throw new DeviceStaleError();
  };
  await wait();
  for (const save of pageSaves.values()) {
    if (save.isDirty()) save.retry();
  }
  await wait();
  const dirtyApps = [...pageSaves].filter(([, save]) => save.isDirty()).map(([appId]) => appId);
  if (dirtyApps.length) throw new Error(`Device state was not saved for: ${dirtyApps.join(', ')}`);
  // A rejected state patch or missing data invalidates the episode, even if
  // the caller caught the error and continued.
  const failed = deviceQueryFailures();
  if (failed.length) {
    const shown = failed.slice(0, 5).map((f) => `${f.query} (${f.message})`).join('; ');
    throw new Error(`Device data was missing during this episode: ${shown}${failed.length > 5 ? `; and ${failed.length - 5} more` : ''}`);
  }
}

// ── Data failures of this episode ──────────────────────────────────

export interface DeviceQueryFailure {
  /** The failed operation, e.g. `appId.queryName`, `appId.setState`, or `providers.sync`. */
  query: string;
  message: string;
}

let queryFailures: { generation: number; list: DeviceQueryFailure[] } = { generation: -1, list: [] };

/**
 * Record that the page went without data it needed. It counts against the
 * episode `generation` the work started in; work left over from an earlier
 * episode is dropped.
 */
export function recordDeviceFailure(what: string, err: unknown, generation = DeviceClient.generation()): void {
  if (generation !== DeviceClient.generation()) return;
  if (queryFailures.generation !== generation) queryFailures = { generation, list: [] };
  queryFailures.list.push({ query: what, message: err instanceof Error ? err.message : String(err) });
}

function recordQueryFailure(appId: string, name: string, err: unknown): void {
  recordDeviceFailure(`${appId}.${name}`, err);
}

/**
 * Data failures since the last reset: failed queries, rejected state patches,
 * and shared data an app opened without (`awaitLaunchData`).
 * `waitForStateCommit()` fails the episode on any.
 */
export function deviceQueryFailures(): DeviceQueryFailure[] {
  return queryFailures.generation === DeviceClient.generation() ? [...queryFailures.list] : [];
}

/**
 * Wait for shared data an app reads on its first render, at most `ms`. A
 * request that never answers must not hold up the launch, so the app opens
 * anyway (the load goes on and its readers re-read when it lands), but it
 * opened without that data: the episode records it like a failed query.
 * A reset while waiting abandons the load and records nothing.
 */
export async function awaitLaunchData(what: string, load: Promise<unknown>, ms: number): Promise<void> {
  const generation = DeviceClient.generation();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failure = await Promise.race([
    load.then(
      () => null,
      (err: unknown) => (err instanceof DeviceStaleError ? null : err ?? new Error('failed')),
    ),
    new Promise<Error>((resolve) => {
      timer = setTimeout(() => resolve(new Error(`not loaded within ${ms}ms`)), ms);
    }),
  ]);
  clearTimeout(timer);
  if (!failure) return;
  console.error(`[device] app launched without ${what}`, failure);
  recordDeviceFailure(what, failure, generation);
}

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

/** Patches a store from outside: gets a function that applies the caller's patch to a given state. */
export type DeviceStateSetter = (applyPatch: (current: Record<string, any>) => Record<string, any>) => Promise<void>;

export interface DeviceStoreRegistrar {
  store: (id: string, store: StoreApi<any>, reset: () => void) => void;
  setter: (id: string, setter: DeviceStateSetter) => void;
}

const appRegistrar: DeviceStoreRegistrar = { store: registerAppStore, setter: registerStateSetter };

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
  options: {
    localKeys: (keyof S)[];
    /**
     * For apps whose state logic stays on the page (device/stateOnly.ts): the
     * page is the authority and the session stores what it shows. Every write
     * -- `useXStore.setState(fn)` from a page, or `set` inside an action --
     * applies here at once (actions stay synchronous) and schedules a save;
     * the save sends the server fields as they are when it runs (`__replace`),
     * so writes in quick succession are coalesced and never replayed. The
     * store also syncs on creation, so readers outside the app (widgets,
     * `__SIM__.getState()`) see the session's state after a reload.
     */
    syncSetState?: boolean;
    /** Fix up state adopted from the session (old or injected snapshots). */
    normalize?: (state: S) => Partial<S> | null;
    /** Move state from the old localStorage key into the session. */
    migrateLocalStorage?: boolean;
    /**
     * Where the store is listed for reset and for external patches. App stores
     * go in the app registry (the default, `__SIM__.getState().apps`); other
     * owners of session state (content providers) pass their own.
     */
    register?: DeviceStoreRegistrar;
  },
  actionCreator: (
    helpers: DeviceStoreHelpers,
    set: StoreApi<S & A>['setState'],
    get: () => S & A,
  ) => A,
): UseBoundStore<StoreApi<S & A>> & { ensureSynced: (force?: boolean) => Promise<void> } {
  const localKeys = new Set<string>(options.localKeys as string[]);
  const registrar = options.register ?? appRegistrar;

  const serverData = (state: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(state)) {
      if (typeof v !== 'function' && !localKeys.has(k)) out[k] = v;
    }
    return out;
  };

  /** With `syncSetState`: apply here, then save what the page shows. */
  const syncedSet = ((partial: unknown, replace?: boolean) => {
    const before = store.getState() as Record<string, unknown>;
    localSet(partial as Partial<S & A>, replace as false);
    // A write that touched only page-only keys (a sheet opening, a loading
    // flag) changes nothing the session holds: no save, and a sync keeps it anyway.
    const after = store.getState() as Record<string, unknown>;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    let changed = false;
    for (const key of keys) {
      if (localKeys.has(key) || Object.is(before[key], after[key])) continue;
      if (typeof before[key] === 'function' && typeof after[key] === 'function') continue;
      changed = true;
      break;
    }
    if (!changed) return;
    // Until a save takes it in, a sync would overwrite this write with the
    // session's state: keep it to apply again on top of that.
    unsaved.push({ partial, replace: Boolean(replace) });
    scheduleSave();
  }) as StoreApi<S & A>['setState'];

  const store = create<S & A>()((set, get) => ({
    ...initialState,
    ...actionCreator({
      command: (name, ...args) => runCommand(name, commandArgs(appId, name, args)),
      optimistic: (apply, name, ...args) => runOptimistic(apply, name, commandArgs(appId, name, args)),
    }, options.syncSetState ? syncedSet : set, get),
  }));

  /** The store's own setter: changes the mirror only. */
  const localSet = store.setState;

  /** Local updates whose commands have not settled yet, oldest first. */
  let pending: { apply: (state: any) => Record<string, unknown> }[] = [];
  /** The last state the server sent (pending updates not applied). */
  let serverState: Record<string, unknown> | null = null;
  /** syncSetState: page writes no save has taken in yet, oldest first. */
  let unsaved: { partial: unknown; replace: boolean }[] = [];

  const applyWrites = (state: Record<string, any>, writes: typeof unsaved) => {
    let next = state;
    for (const { partial, replace } of writes) {
      const update = typeof partial === 'function' ? partial(next) : partial;
      next = replace ? update : { ...next, ...update };
    }
    return next;
  };

  const plain = (state: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(state)) if (typeof v !== 'function') out[k] = v;
    return out;
  };

  const reapplyPending = () => {
    for (const entry of pending) localSet(entry.apply(store.getState()) as Partial<S & A>);
  };

  const adopt = (state: unknown) => {
    if (state && typeof state === 'object') {
      serverState = state as Record<string, unknown>;
      localSet(state as Partial<S & A>);
      const fixed = options.normalize?.(store.getState());
      if (fixed) localSet(fixed as Partial<S & A>);
      reapplyPending();
    }
    bumpVersion(appId);
  };

  /** Count `work` (requests + adopting their results) as busy for `whenIdle()`. */
  const busy = <T,>(work: Promise<T>): Promise<T> => {
    DeviceClient.hold(work);
    return work;
  };

  /**
   * What an uninitialized session is seeded with: the page's state when the
   * page is the authority (syncSetState); otherwise the last server state
   * (initially the defaults), never optimistic updates whose commands are
   * still to run -- they would be applied twice.
   */
  const seedState = () =>
    (options.syncSetState ? serverData(store.getState()) : serverState ?? serverData(initialState));
  const seed = (api: DeviceSessionApi) => api.putState(appId, seedState());

  // ── sync, once per session ──
  let synced: { sid: string; gen: number; promise: Promise<void> } | null = null;

  /** Adopt the session's state, or seed the session with this page's state. */
  const syncNow = (gen: number) =>
    DeviceClient.exclusive(async (api) => {
      const current = await api.getState<S>(appId);
      let legacy: Record<string, any> | undefined;
      if (options.migrateLocalStorage) {
        try { legacy = readPersistedAppState(appId); } catch { /* Storage may be disabled. */ }
      }
      const clearLegacy = () => {
        if (legacy && DeviceClient.generation() === gen) {
          try { localStorage.removeItem(appId); } catch { /* Storage may be disabled. */ }
        }
      };
      if (current.initialized && !legacy) return current.state;
      // Seeding saves the writes included when the PUT is sent. Writes made
      // while it is in flight still need to be replayed and saved.
      const seededWrites = unsaved.length;
      let response;
      if (legacy) {
        const restored = applyWrites({ ...store.getInitialState(), ...current.state, ...serverData(legacy) }, unsaved);
        const normalized = { ...restored, ...options.normalize?.(restored as S) };
        response = await api.putState(appId, serverData(normalized));
      } else {
        response = await seed(api);
      }
      if (DeviceClient.generation() !== gen) throw new DeviceStaleError();
      clearLegacy();
      unsaved = unsaved.slice(seededWrites);
      return response.state;
    }, gen).then((state) => {
      adopt(state);
      if (!unsaved.length) return;
      // Page writes not saved yet are not in the session: apply them again on
      // top of it. Page-only keys kept their values through the adoption, so
      // they must not be written a second time.
      const pageOnly: Record<string, unknown> = {};
      for (const key of localKeys) pageOnly[key] = (store.getState() as Record<string, unknown>)[key];
      for (const write of unsaved) localSet(write.partial as Partial<S & A>, write.replace as false);
      localSet(pageOnly as Partial<S & A>);
      scheduleSave();
    });

  async function ensureSynced(force = false): Promise<void> {
    const gen = DeviceClient.generation();
    const sid = await DeviceClient.sessionId();
    // Reset while waiting: `sid` is the next episode's session, not ours to sync.
    if (DeviceClient.generation() !== gen) throw new DeviceStaleError();
    if (force || !synced || synced.sid !== sid || synced.gen !== gen) {
      const promise = busy(syncNow(gen));
      synced = { sid, gen, promise };
      promise.catch(() => {
        if (synced?.promise === promise) synced = null;
      });
    }
    return synced.promise;
  }
  readyHooks.set(appId, ensureSynced);

  /**
   * Every request below carries the generation its operation started in
   * (`exclusive(fn, gen)`), so a reset at any `await` abandons it instead of
   * letting it run in the next episode's session.
   */
  async function syncedFor(gen: number): Promise<void> {
    if (DeviceClient.generation() !== gen) throw new DeviceStaleError();
    await ensureSynced();
    if (DeviceClient.generation() !== gen) throw new DeviceStaleError();
  }

  // ── commands ──
  async function runCommandNow(name: string, args: unknown[], gen: number, settle?: () => void): Promise<unknown> {
    await syncedFor(gen);
    // Command and its recovery share one slot, so later commands cannot overtake it.
    const response = await DeviceClient.exclusive(async (api) => {
      const call = () => api.command(appId, name, args, TimeService.now());
      try {
        return await call();
      } catch (err) {
        // The server lost this app's state (restart): reseed, retry once.
        if (!isUninitialized(err)) throw err;
        await seed(api);
        return call();
      }
    }, gen);
    settle?.();
    adopt(response.state);
    return response.result;
  }

  function runCommand(name: string, args: unknown[], settle?: () => void, gen = DeviceClient.generation()): Promise<unknown> {
    return busy(runCommandNow(name, args, gen, settle)).catch((err) => {
      // A reset abandoned this command along with its episode.
      if (err instanceof DeviceStaleError) return undefined;
      throw err;
    });
  }

  function runOptimistic(apply: (state: any) => Record<string, unknown>, name: string, args: unknown[]): Promise<unknown> {
    const gen = DeviceClient.generation();
    const entry = { apply };
    pending.push(entry);
    localSet(apply(store.getState()) as Partial<S & A>);
    const drop = () => {
      pending = pending.filter((e) => e !== entry);
    };
    return runCommand(name, args, drop, gen).then((result) => {
      drop(); // also when a reset abandoned it
      return result;
    }, (err) => {
      // Failed: drop this update and show the server's state plus what is still pending.
      drop();
      if (serverState) {
        localSet(serverState as Partial<S & A>);
        reapplyPending();
        bumpVersion(appId);
      }
      throw err;
    });
  }

  // ── saves (syncSetState) ──
  let saveQueued = false;

  /** Save the page's state once the queue gets there; later writes ride along. */
  function scheduleSave(): void {
    if (saveQueued) return;
    saveQueued = true;
    const gen = DeviceClient.generation();
    const save = (async () => {
      await syncedFor(gen);
      await DeviceClient.exclusive(async (api) => {
        saveQueued = false; // writes from here on need another save
        const snapshot = serverData(store.getState());
        const taken = unsaved;
        unsaved = [];
        try {
          try {
            await api.command(appId, '__replace', [snapshot], TimeService.now());
          } catch (err) {
            if (!isUninitialized(err)) throw err;
            await api.putState(appId, snapshot);
          }
        } catch (err) {
          // Still not in the session -- unless a reset dropped them along with it.
          if (gen === DeviceClient.generation()) unsaved = [...taken, ...unsaved];
          throw err;
        }
      }, gen);
    })();
    busy(save).catch((err) => {
      if (gen === DeviceClient.generation()) saveQueued = false;
      if (err instanceof DeviceStaleError) return;
      console.error(`[device] ${appId}: could not save state`, err);
    });
  }

  registrar.store(appId, store as unknown as StoreApi<any>, () => {
    synced = null;
    saveQueued = false;
    unsaved = [];
    pending = [];
    serverState = null;
    localSet({ ...initialState } as Partial<S & A>);
    bumpVersion(appId);
  });

  registrar.setter(appId, (applyPatch) =>
    busy((async () => {
      // Patch the session's real state: sync first, then merge and push in one
      // queue slot, after the commands queued before it have been adopted.
      const gen = DeviceClient.generation();
      const patch = (state: Record<string, any>) => {
        const next = { ...state, ...applyPatch(state) };
        return { ...next, ...options.normalize?.(next as S) };
      };
      const localChanges = new Map<string, unknown>();
      const prepare = () => {
        const before = store.getState();
        const view = plain(before);
        const next = patch(view);
        for (const [key, value] of Object.entries(next)) {
          if ((options.syncSetState || localKeys.has(key)) && !Object.is(view[key], value)) {
            localChanges.set(key, value);
          }
        }
        // Pending optimistic commands will apply their own changes.
        const payload = options.syncSetState || !pending.length || !serverState
          ? next
          : patch({ ...view, ...serverState });
        // Page-only writes can happen during the PUT without scheduling a save.
        const unsubscribe = store.subscribe((current, previous) => {
          for (const key of localChanges.keys()) {
            if (localKeys.has(key) && !Object.is(current[key], previous[key])) localChanges.delete(key);
          }
        });
        return { payload: serverData(payload), unsubscribe, before, queuedWrites: unsaved.length };
      };
      let prepared: ReturnType<typeof prepare> | undefined;
      try {
        await syncedFor(gen);
        const pushed = await DeviceClient.exclusive((api) => {
          // A replacement session receives the same snapshot on retry.
          prepared ??= prepare();
          return api.putState(appId, prepared.payload);
        }, gen);
        if (DeviceClient.generation() !== gen) throw new DeviceStaleError();
        const laterWrites = prepared ? unsaved.slice(prepared.queuedWrites) : [];
        if (prepared && localChanges.size && laterWrites.length) {
          // Rebase page writes that ran against the old mirror. In particular,
          // two appends to the same array both survive. Their save is queued.
          const current = store.getState();
          const next = applyWrites({ ...prepared.before, ...Object.fromEntries(localChanges) }, laterWrites);
          for (const key of localKeys) {
            if (!localChanges.has(key)) (next as Record<string, unknown>)[key] = current[key];
          }
          localSet(next as S & A, true);
        } else if (localChanges.size) {
          localSet(Object.fromEntries(localChanges) as Partial<S & A>);
        }
        if (options.syncSetState) bumpVersion(appId);
        else adopt(pushed.state);
      } catch (err) {
        recordDeviceFailure(`${appId}.setState`, err, gen);
        throw err;
      } finally {
        prepared?.unsubscribe();
      }
    })()),
  );

  if (options.syncSetState) {
    pageSaves.set(appId, { retry: scheduleSave, isDirty: () => unsaved.length > 0 });
    store.setState = syncedSet;
    void ensureSynced().catch(() => {});
  }

  return Object.assign(store, { ensureSynced: (force?: boolean) => ensureSynced(force) });
}

// ── Queries ────────────────────────────────────────────────────────

interface QueryEntry {
  version: number;
  data: unknown;
  inflight?: Promise<void>;
  /** Why the last fetch failed, and the data version it was for. */
  error?: { cause: unknown; version: number };
}

/** Waits before a failed query is tried again; after the last one the error is shown. */
const QUERY_RETRY_DELAYS_MS = [200, 800];

/** A request the server refused as wrong (unknown query, bad arguments): trying again gives the same answer. */
const isRejectedRequest = (err: unknown) => {
  const status = (err as { status?: number })?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
};

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
  const generation = DeviceClient.generation();
  const attempt = async () => {
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
  const run = async () => {
    for (let tries = 0; ; tries += 1) {
      try {
        return await attempt();
      } catch (err) {
        const delay = QUERY_RETRY_DELAYS_MS[tries];
        if (err instanceof DeviceStaleError || isRejectedRequest(err) || delay === undefined) throw err;
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (DeviceClient.generation() !== generation) throw new DeviceStaleError();
      }
    }
  };
  /** The data moved on (or the session was reset) while this request ran: fetch again if a page still shows it. */
  const refreshIfBehind = () => {
    const latest = queryVersion(appId, catalog);
    if (latest !== version && queryListeners.get(key)?.size) fetchQuery(key, appId, name, args, latest, catalog);
  };
  const discardStale = () => {
    if (entry) queryCache.set(key, { ...entry, inflight: undefined });
    else queryCache.delete(key);
    refreshIfBehind();
  };
  const inflight = run().then(
    (data) => {
      if (generation !== DeviceClient.generation()) {
        discardStale();
        return;
      }
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
      if (err instanceof DeviceStaleError || generation !== DeviceClient.generation()) {
        discardStale();
        return;
      }
      console.error(`[device] query ${appId}.${name} failed`, err);
      recordQueryFailure(appId, name, err);
      // Keep what was shown, and tell the pages: they stop loading and can show the failure.
      queryCache.set(key, { version: entry?.version ?? -1, data: entry?.data, error: { cause: err, version } });
      notifyQuery(key);
      refreshIfBehind();
    },
  );
  DeviceClient.hold(inflight);
  // The failure of an earlier fetch stays visible until this one answers.
  queryCache.set(key, { version: entry?.version ?? -1, data: entry?.data, error: entry?.error, inflight });
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
 *
 * A fetch that fails is tried again twice; after that `error` is set and
 * `loading` is false (the last result, if any, stays in `data`). It is fetched
 * again when the app's data changes, when the page is shown again, or on `retry()`.
 */
export function useDeviceQuery<T>(
  appId: string,
  name: string,
  args: Record<string, unknown>,
  enabled = true,
  options: { keepPrevious?: boolean; catalog?: boolean } = {},
): { data: T | undefined; loading: boolean; error: unknown; retry: () => void } {
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
  // A failure counts while nothing newer is on its way or has arrived.
  const failed = enabled && !entry?.inflight && entry?.error?.version === version && entry.version !== version;
  const latest = useRef({ key, appId, name, args, version, catalog });
  latest.current = { key, appId, name, args, version, catalog };
  const retry = useRef(() => {
    const q = latest.current;
    fetchQuery(q.key, q.appId, q.name, q.args, q.version, q.catalog);
    notifyQuery(q.key);
  }).current;
  return {
    data: (showPrevious ? previous.current : entry?.data) as T | undefined,
    loading: enabled && entry?.version !== version && !failed,
    error: failed ? entry!.error!.cause : undefined,
    retry,
  };
}
