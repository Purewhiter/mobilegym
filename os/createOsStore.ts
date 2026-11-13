import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist, subscribeWithSelector, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { cancelPending, debouncedSetItem } from './debouncedPersist';
import { safeParseJSON } from './utils/safeParseJSON';
import { mergeIntoDraft } from './utils/statePatch';

type WritableState = Record<string, any>;
type BoundStore<S extends WritableState> = UseBoundStore<StoreApi<S>>;

export interface CreateOsStoreOptions<S extends WritableState> {
  persistName?: string;
  registerToServiceRegistry?: boolean;
  /** Register this store as a Provider (snapshot under os.providers) */
  registerToProviderRegistry?: boolean;
  useImmer?: boolean;
  validate?: (raw: unknown, defaults: S) => S;
}

// ---------------------------------------------------------------------------
// Internal store registry (replaces the former ServiceRegistry.ts singleton)
// ---------------------------------------------------------------------------

interface RegisteredStore {
  name: string;
  getState: () => any;
  reset: () => void;
}

const _registry = new Map<string, RegisteredStore>();
const _providerRegistry = new Map<string, RegisteredStore>();
const _providerStoreRefs = new Map<string, BoundStore<any>>();

export function resetAllOsStores(): void {
  for (const entry of _registry.values()) {
    try {
      entry.reset();
    } catch (err) {
      console.error(`[OsStoreRegistry] reset failed: ${entry.name}`, err);
    }
  }
  for (const entry of _providerRegistry.values()) {
    try {
      entry.reset();
    } catch (err) {
      console.error(`[OsStoreRegistry] provider reset failed: ${entry.name}`, err);
    }
  }
}

export function snapshotOsStores(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [name, entry] of _registry) {
    try {
      out[name] = entry.getState();
    } catch (err) {
      console.error(`[OsStoreRegistry] snapshot failed: ${name}`, err);
    }
  }
  return out;
}

export function snapshotProviders(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [name, entry] of _providerRegistry) {
    try {
      out[name] = entry.getState();
    } catch (err) {
      console.error(`[OsStoreRegistry] provider snapshot failed: ${name}`, err);
    }
  }
  return out;
}

/** Patches a provider whose data lives in the device session (os/providers/providerStore.ts). */
type ProviderSetter = (applyPatch: (current: Record<string, any>) => Record<string, any>) => Promise<void>;
const _providerSetters = new Map<string, ProviderSetter>();

/**
 * List a provider store created elsewhere (device-backed: its data is in the
 * device session, not in localStorage). It takes part in `os.providers`
 * snapshots, resets and patches like one made by `createOsStore`.
 */
export function registerProviderStore(
  key: string,
  store: { getState: () => any },
  reset: () => void,
  setter: ProviderSetter,
): void {
  _providerRegistry.set(key, { name: key, getState: store.getState, reset });
  _providerSetters.set(key, setter);
}

/**
 * Merge `patch` into the named providers. `patched`: the ones changed at once
 * (the caller tells their observers). `pending`: for providers kept in the
 * device session, promises that resolve once the session holds the patch; they
 * sync with it first, so the patch lands on real data, and tell their observers
 * themselves.
 */
export function patchProviders(patch: Record<string, any>, deep: boolean): { patched: string[]; pending: Promise<void>[] } {
  const patched: string[] = [];
  const pending: Promise<void>[] = [];
  for (const [providerName, providerPatch] of Object.entries(patch)) {
    if (providerPatch === undefined || providerPatch === null) continue;
    const setter = _providerSetters.get(providerName);
    if (setter) {
      pending.push(setter((current) => {
        if (!deep) return providerPatch;
        // Same merge as app patches, including `arr[field=value]` / `arr[]` keys.
        const merged = structuredClone(current);
        mergeIntoDraft(merged, providerPatch);
        return merged;
      }));
      continue;
    }
    const store = _providerStoreRefs.get(providerName);
    if (!store) {
      console.warn(`[patchProviders] unknown provider '${providerName}', registered:`, [..._providerRegistry.keys()]);
      continue;
    }
    if (deep) {
      const current = store.getState();
      const currentData: Record<string, any> = {};
      for (const [k, v] of Object.entries(current as Record<string, any>)) {
        if (typeof v !== 'function') currentData[k] = v;
      }
      // Same merge as app patches, including `arr[field=value]` / `arr[]` keys.
      const merged = structuredClone(currentData);
      mergeIntoDraft(merged, providerPatch);
      (store.setState as any)(merged, true);
    } else {
      (store.setState as any)(providerPatch, true);
    }
    patched.push(providerName);
  }
  return { patched, pending };
}

/** @internal — exposed only for unit tests */
export const _testOnlyRegistry = {
  register(entry: RegisteredStore): void {
    if (!entry?.name) return;
    _registry.set(entry.name, entry);
  },
  get(name: string): RegisteredStore | undefined {
    return _registry.get(name);
  },
  size(): number {
    return _registry.size;
  },
};

// ---------------------------------------------------------------------------
// Store factory helpers
// ---------------------------------------------------------------------------

function cloneState<S>(value: S): S {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as S;
}

function createStorage<S extends WritableState>(
  validate?: (raw: unknown, defaults: S) => S,
  defaults?: S,
): PersistStorage<S> {
  return {
    getItem(key: string): StorageValue<S> | null {
      const parsed = safeParseJSON<any>(localStorage.getItem(key));
      if (parsed == null) return null;

      if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) return null;

      const state = validate && defaults ? validate(parsed.state, defaults) : parsed.state;
      return {
        state,
        version: typeof parsed.version === 'number' ? parsed.version : 0,
      };
    },
    setItem(key: string, value: StorageValue<S>) {
      debouncedSetItem(key, JSON.stringify(value));
    },
    removeItem(key: string) {
      cancelPending(key);
      localStorage.removeItem(key);
    },
  };
}

function registerStore<S extends WritableState>(
  name: string,
  store: BoundStore<S>,
  getDefaultState: () => S,
  registry: Map<string, RegisteredStore> = _registry,
) {
  registry.set(name, {
    name,
    getState: store.getState,
    reset: () => store.setState(getDefaultState(), true),
  });
}

// ---------------------------------------------------------------------------
// Public factory functions
// ---------------------------------------------------------------------------

export function createOsStore<S extends WritableState>(
  name: string,
  defaultState: S,
  options?: CreateOsStoreOptions<S>,
): BoundStore<S> {
  const useImmer = options?.useImmer ?? true;
  const registerService = options?.registerToServiceRegistry ?? true;
  const registerProvider = options?.registerToProviderRegistry ?? false;
  const getDefaultState = () => cloneState(defaultState);
  const storage = createStorage(options?.validate, defaultState);
  const initializer = () => getDefaultState();

  const store = (
    useImmer
      ? create<S>()(subscribeWithSelector(persist(immer(initializer as any), {
          name: options?.persistName ?? name,
          storage,
        })))
      : create<S>()(subscribeWithSelector(persist(initializer, {
          name: options?.persistName ?? name,
          storage,
        })))
  ) as BoundStore<S>;

  if (registerProvider) {
    const providerKey = name.startsWith('provider.') ? name.slice('provider.'.length) : name;
    registerStore(providerKey, store, getDefaultState, _providerRegistry);
    _providerStoreRefs.set(providerKey, store);
  } else if (registerService) {
    registerStore(name, store, getDefaultState);
  }

  return store;
}

export function createVolatileOsStore<S extends WritableState>(
  name: string,
  defaultState: S,
  options?: Pick<CreateOsStoreOptions<S>, 'registerToServiceRegistry' | 'useImmer'>,
): BoundStore<S> {
  const useImmer = options?.useImmer ?? true;
  const register = options?.registerToServiceRegistry ?? true;
  const getDefaultState = () => cloneState(defaultState);
  const initializer = () => getDefaultState();

  const store = (
    useImmer
      ? create<S>()(subscribeWithSelector(immer(initializer as any)))
      : create<S>()(subscribeWithSelector(initializer))
  ) as BoundStore<S>;

  if (register) {
    registerStore(name, store, getDefaultState);
  }

  return store;
}
