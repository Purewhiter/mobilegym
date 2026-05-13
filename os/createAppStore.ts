// os/createAppStore.ts
import { create, type StoreApi } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { debouncedSetItem, cancelPending, immediateSetItem } from './debouncedPersist';
import PackageManagerService from './PackageManagerService';

type AnyStore = StoreApi<any>;

// 内部注册表
const storeRegistry = new Map<string, AnyStore>();
// Reset 入口: 把 store 内存状态浅合并回 initialState (actions 保留)。
// `_resetStateCore` 在 cancelAllPendingPersistWrites + localStorage.clear 之前调用,
// 否则 page.goto 触发 beforeunload → flushAll 会把残留 setState 写回 localStorage,
// 导致新 task hydrate 时读到上一 task 末态 (例如 bookmark 仍标蓝).
const resetRegistry = new Map<string, () => void>();

// --- Reference-equality cache for getAllStoreStates() ---
// Zustand uses immutable updates: each setState produces a new reference.
// We cache the stripped (function-free) result keyed by the raw state reference,
// so unchanged stores skip adapter + Object.entries stripping on repeated reads.
const stateCache = new Map<string, { rawRef: any; state: Record<string, any> }>();

/**
 * JSON-based debounced localStorage storage for zustand persist.
 * Returns PersistStorage<any> because the implementation is type-agnostic
 * (pure JSON serialize/deserialize) and zustand's PersistStorage is invariant,
 * making it impossible to satisfy both partialize'd and non-partialize'd
 * callers with a single concrete generic parameter.
 */
export function createDebouncedStorage(): PersistStorage<any> {
  return {
    getItem(key: string) {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    setItem(key: string, value: StorageValue<any>) {
      debouncedSetItem(key, JSON.stringify(value));
    },
    removeItem(key: string) {
      cancelPending(key);
      localStorage.removeItem(key);
    },
  };
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function stripFunctions(state: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(state)) {
    if (typeof v !== 'function') result[k] = v;
  }
  return result;
}

function parsePersistedAppState(raw: string | null): Record<string, any> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    if ('state' in parsed) {
      const persisted = (parsed as { state?: unknown }).state;
      if (persisted && typeof persisted === 'object' && !Array.isArray(persisted)) {
        return persisted as Record<string, any>;
      }
      return undefined;
    }
    return parsed as Record<string, any>;
  } catch {
    return undefined;
  }
}

export function readPersistedAppState(appId: string): Record<string, any> | undefined {
  if (!hasLocalStorage()) return undefined;
  return parsePersistedAppState(localStorage.getItem(appId));
}

export function writePersistedAppState(appId: string, state: Record<string, any>): void {
  if (!hasLocalStorage()) return;
  immediateSetItem(appId, JSON.stringify({
    state: stripFunctions(state),
    version: 0,
  }));
}

/**
 * Zustand v5 persist 的 toThenable 对同步 storage 是同步链式调用（非微任务），
 * 导致 hydration 在 create() 内同步完成。若在 create() 返回后才注册
 * onFinishHydration 回调，回调永远不会触发。
 * 此工具函数安全地处理两种时序。
 */
function runAfterHydration(store: AnyStore, fn: () => void) {
  if ((store as any).persist?.hasHydrated?.()) {
    fn();
  } else {
    (store as any).persist?.onFinishHydration?.(fn);
  }
}

/**
 * 创建带 persist 的 App Store 并自动注册。
 * @param appId - 注册 ID（storeRegistry key），必须与 manifest.id 一致
 * @param initialState - 来自 APP_CONFIG 的初始状态
 * @param options.persistName - localStorage key，默认等于 appId
 * @param options.afterHydration - hydration 完成后执行（安全处理同步/异步时序）
 */
export function createAppStore<T extends Record<string, any>>(
  appId: string,
  initialState: T,
  options?: { persistName?: string; partialize?: (state: T) => Partial<T>; afterHydration?: () => void },
) {
  const persistName = options?.persistName ?? appId;
  const store = create<T>()(
    persist(() => ({ ...initialState }), {
      name: persistName,
      storage: createDebouncedStorage(),
      ...(options?.partialize ? { partialize: options.partialize } : {}),
    })
  );
  storeRegistry.set(appId, store as unknown as AnyStore);
  resetRegistry.set(appId, () => store.setState({ ...initialState }));
  if (options?.afterHydration) {
    runAfterHydration(store, options.afterHydration);
  }
  return store;
}

/** 创建不持久化的 Store（如 Calculator2 等纯内存 App） */
export function createVolatileAppStore<T extends Record<string, any>>(
  appId: string,
  initialState: T,
) {
  const store = create<T>()(() => ({ ...initialState }));
  storeRegistry.set(appId, store as unknown as AnyStore);
  resetRegistry.set(appId, () => store.setState({ ...initialState }));
  return store;
}

/**
 * 创建带 Actions 的 App Store。
 * Actions 通过 actionCreator 传入，persist 自动排除函数值（不持久化 actions）。
 * @param options.afterHydration - hydration 完成后执行（安全处理同步/异步时序）
 */
export function createAppStoreWithActions<
  S extends Record<string, any>,
  A extends { [K in keyof A]: (...args: any[]) => any },
>(
  appId: string,
  initialState: S,
  actionCreator: (
    set: (partial: Partial<S & A> | ((state: S & A) => Partial<S & A>)) => void,
    get: () => S & A,
  ) => A,
  options?: { persistName?: string; partialize?: (state: S & A) => Partial<S>; afterHydration?: () => void },
) {
  const persistName = options?.persistName ?? appId;
  const defaultPartialize = (state: S & A): Partial<S> => {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(state)) {
      if (typeof v !== 'function' && k !== '_temp') result[k] = v;
    }
    return result as Partial<S>;
  };
  const store = create<S & A>()(
    persist(
      (set, get) => ({
        ...initialState,
        ...actionCreator(set as any, get),
      }),
      {
        name: persistName,
        storage: createDebouncedStorage(),
        partialize: options?.partialize ?? defaultPartialize,
      },
    )
  );
  storeRegistry.set(appId, store as unknown as AnyStore);
  // Shallow merge initialState 回去, actions 不在 initialState 里所以保留。
  resetRegistry.set(appId, () => store.setState({ ...initialState } as any));
  if (options?.afterHydration) {
    runAfterHydration(store, options.afterHydration);
  }
  return store;
}

/**
 * 把所有 app store 内存状态重置回 initialState (actions 保留)。
 * 调用时机: `__SIM__.resetState` 内, 必须早于 `cancelAllPendingPersistWrites()`
 * + `localStorage.clear()`, 才能避免 reset 触发的 persist 写入在 page.goto 的
 * beforeunload 阶段被 flushAll 落回 localStorage。
 */
export function resetAllAppStores(): void {
  for (const [appId, reset] of resetRegistry) {
    try {
      reset();
    } catch (err) {
      console.error(`[AppStoreRegistry] reset failed: ${appId}`, err);
    }
  }
}

/**
 * Shallow comparison for memoSelector inputs.
 * Fast path: Object.is for primitives / same reference.
 * Slow path: if both are plain objects, compare own keys with Object.is.
 */
function shallowInputEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  // Array — element-wise Object.is
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }
  // Plain object — shallow key comparison
  const keysA = Object.keys(a);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.is((a as any)[key], (b as any)[key])) return false;
  }
  return true;
}

/**
 * 创建 memoized selector（类似 reselect）。
 * zustand v5 的 useSyncExternalStore 在 render 和 commit 阶段各调一次 getSnapshot()，
 * 如果 selector 每次返回新引用（.filter() / .map() / { ... }），Object.is 不通过 → 无限重渲染。
 * memoSelector 缓存上次结果：输入引用不变 → 返回同一引用。
 * 支持多字段 input：inputFn 返回 { a: s.a, b: s.b } 时会 shallow compare 每个字段。
 */
export function memoSelector<S, I, R>(
  inputFn: (state: S) => I,
  computeFn: (input: I) => R,
): (state: S) => R {
  let prevInput: I;
  let prevResult: R;
  let initialized = false;
  return (state: S) => {
    const input = inputFn(state);
    if (initialized && shallowInputEqual(input, prevInput)) return prevResult;
    initialized = true;
    prevInput = input;
    prevResult = computeFn(input);
    return prevResult;
  };
}

// --- State adapter（各 App 可在 state.ts 中注册，用于在 getState 输出时补齐/变形字段）---
const stateAdapters = new Map<string, (raw: any) => any>();

/**
 * 注册外部状态适配器。
 * 适配器在 getAllStoreStates() 读取时执行，将 store 内部状态转换为对外暴露的形状。
 * 用途：补齐派生字段、重组嵌套结构等，保持 getState() 向后兼容。
 */
export function registerStateAdapter(appId: string, adapter: (raw: any) => any) {
  stateAdapters.set(appId, adapter);
  stateCache.delete(appId);
}

/**
 * Invalidate the getAllStoreStates() cache for a specific app.
 * Call this when an adapter depends on external state that changed
 * independently of the app's own store.
 */
export function invalidateStateCache(appId: string) {
  stateCache.delete(appId);
}

// --- OS 层读取接口 ---

export function getStore(appId: string): AnyStore | undefined {
  return storeRegistry.get(appId);
}

export function getAllRegisteredAppIds(): string[] {
  return [...storeRegistry.keys()];
}

export function getAllStoreStates(): Record<string, any> {
  const states: Record<string, any> = {};
  for (const [appId, store] of storeRegistry) {
    try {
      const raw = store.getState();
      const cached = stateCache.get(appId);
      if (cached && cached.rawRef === raw) {
        states[appId] = cached.state;
        continue;
      }

      let adapted = raw;
      const adapter = stateAdapters.get(appId);
      if (adapter) adapted = adapter(raw);
      const state: Record<string, any> = {};
      for (const [k, v] of Object.entries(adapted)) {
        if (typeof v !== 'function') state[k] = v;
      }
      stateCache.set(appId, { rawRef: raw, state });
      states[appId] = state;
    } catch {
      states[appId] = { error: 'Failed to get state' };
    }
  }
  for (const manifest of PackageManagerService.getInstalledPackages()) {
    if (manifest.id in states) continue;
    const persisted = readPersistedAppState(manifest.id);
    if (persisted) states[manifest.id] = persisted;
  }
  return states;
}

// Dev-only: expose the live store registry so bench tests can dispatch real
// app actions via Playwright (e.g. window.__BENCH_STORES__.get('reddit').
// getState().deleteOwnComment(id)). The Map is bound once but stays live as
// new apps register, since later registrations mutate the same Map instance.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as any).__BENCH_STORES__ = storeRegistry;
}
