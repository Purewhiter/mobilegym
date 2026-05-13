import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist, subscribeWithSelector, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { cancelPending, debouncedSetItem } from './debouncedPersist';
import { safeParseJSON } from './utils/safeParseJSON';

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

export function patchProviders(patch: Record<string, any>, deep: boolean): string[] {
  const patched: string[] = [];
  const deepMerge = (target: any, source: any): any => {
    if (source === undefined) return target;
    if (source === null) return null;
    if (typeof source !== 'object' || Array.isArray(source)) return source;
    if (typeof target !== 'object' || target === null || Array.isArray(target)) return source;
    const result = { ...target };
    for (const key of Object.keys(source)) {
      result[key] = deepMerge(target[key], source[key]);
    }
    return result;
  };

  for (const [providerName, providerPatch] of Object.entries(patch)) {
    if (providerPatch === undefined || providerPatch === null) continue;
    const store = _providerStoreRefs.get(providerName);
    if (!store) {
      console.warn(`[patchProviders] unknown provider '${providerName}', registered:`, [..._providerStoreRefs.keys()]);
      continue;
    }
    if (deep) {
      const current = store.getState();
      const currentData: Record<string, any> = {};
      for (const [k, v] of Object.entries(current as Record<string, any>)) {
        if (typeof v !== 'function') currentData[k] = v;
      }
      const merged = deepMerge(currentData, providerPatch);
      (store.setState as any)(merged, true);
    } else {
      (store.setState as any)(providerPatch, true);
    }
    patched.push(providerName);
  }
  return patched;
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
