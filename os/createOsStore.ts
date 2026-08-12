import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist, subscribeWithSelector, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { cancelPending, debouncedSetItem } from './debouncedPersist';
import { safeParseJSON } from './utils/safeParseJSON';
import { deepMergeWithArrayOps } from './utils/deepMergeWithArrayOps';

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

/**
 * 把某一 scope（service / provider）的失败 store 名单同步到 window 上的检测标志。
 * 只替换本 scope 的条目，保留其他 scope；整体为空时删除标志（避免陈旧值误导 bench）。
 */
function publishWindowFailures(
  windowKey: '__OS_RESET_FAILURES__' | '__OS_SNAPSHOT_FAILURES__',
  scope: 'service' | 'provider',
  failures: string[],
): void {
  if (typeof window === 'undefined') return;
  const prev = window[windowKey];
  const rest = (Array.isArray(prev) ? prev : []).filter((n) => !n.startsWith(`${scope}:`));
  const next = [...rest, ...failures.map((n) => `${scope}:${n}`)];
  if (next.length > 0) {
    window[windowKey] = next;
  } else {
    delete window[windowKey];
  }
}

export function resetAllOsStores(): void {
  const serviceFailures: string[] = [];
  const providerFailures: string[] = [];
  for (const entry of _registry.values()) {
    try {
      entry.reset();
    } catch (err) {
      serviceFailures.push(entry.name);
      console.error(`[OsStoreRegistry] reset failed: ${entry.name}`, err);
    }
  }
  for (const entry of _providerRegistry.values()) {
    try {
      entry.reset();
    } catch (err) {
      providerFailures.push(entry.name);
      console.error(`[OsStoreRegistry] provider reset failed: ${entry.name}`, err);
    }
  }
  publishWindowFailures('__OS_RESET_FAILURES__', 'service', serviceFailures);
  publishWindowFailures('__OS_RESET_FAILURES__', 'provider', providerFailures);
}

export function snapshotOsStores(): Record<string, any> {
  const out: Record<string, any> = {};
  const failures: string[] = [];
  for (const [name, entry] of _registry) {
    try {
      out[name] = entry.getState();
    } catch (err) {
      failures.push(name);
      console.error(`[OsStoreRegistry] snapshot failed: ${name}`, err);
    }
  }
  publishWindowFailures('__OS_SNAPSHOT_FAILURES__', 'service', failures);
  return out;
}

export function snapshotProviders(): Record<string, any> {
  const out: Record<string, any> = {};
  const failures: string[] = [];
  for (const [name, entry] of _providerRegistry) {
    try {
      out[name] = entry.getState();
    } catch (err) {
      failures.push(name);
      console.error(`[OsStoreRegistry] provider snapshot failed: ${name}`, err);
    }
  }
  publishWindowFailures('__OS_SNAPSHOT_FAILURES__', 'provider', failures);
  return out;
}

export function patchProviders(patch: Record<string, any>, deep: boolean): string[] {
  const patched: string[] = [];
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
      const merged = deepMergeWithArrayOps(currentData, providerPatch);
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
      // 惰性序列化：JSON.stringify 挪进防抖回调执行（zustand 状态不可变，闭包引用安全），
      // 避免 300ms 窗口内被覆盖的写入白白付出序列化成本。
      debouncedSetItem(key, () => JSON.stringify(value));
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
