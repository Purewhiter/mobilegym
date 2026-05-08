import { realNow } from './TimeService';

export type StorageIsolationMode = 'off' | 'tab' | 'load';

/**
 * Storage isolation for the whole simulator.
 *
 * Goals:
 * - "tab": each browser tab gets its own persistent namespace (via sessionStorage),
 *          so opening the site in a new tab always starts from a clean default state.
 * - "load": each page load gets a new namespace (no persistence across reloads).
 * - "off": current behavior (shared localStorage/IndexedDB per origin).
 *
 * This file is loaded early (before React). Only depends on TimeService (pure TS, no React).
 */

const SESSION_NS_KEY = '__MG_STORAGE_NS__';
const DEFAULT_MODE: StorageIsolationMode = 'tab';
const WINDOW_NAME_PREFIX = '__MG_NS__=';

let cachedMode: StorageIsolationMode | null = null;
let cachedNamespace: string | null | undefined = undefined;

function readNamespaceFromWindowName(): string | null {
  try {
    const name = String(window.name || '');
    const idx = name.indexOf(WINDOW_NAME_PREFIX);
    if (idx === -1) return null;
    const rest = name.slice(idx + WINDOW_NAME_PREFIX.length);
    const end = rest.indexOf(';');
    const ns = (end === -1 ? rest : rest.slice(0, end)).trim();
    return ns || null;
  } catch {
    return null;
  }
}

function writeNamespaceToWindowName(ns: string): void {
  try {
    const name = String(window.name || '');
    const idx = name.indexOf(WINDOW_NAME_PREFIX);
    if (idx === -1) {
      // Prepend our token; keep existing window.name tail (if any) for compatibility.
      window.name = `${WINDOW_NAME_PREFIX}${ns};${name}`;
      return;
    }

    const before = name.slice(0, idx);
    const afterStart = idx + WINDOW_NAME_PREFIX.length;
    const rest = name.slice(afterStart);
    const end = rest.indexOf(';');
    const after = end === -1 ? '' : rest.slice(end); // includes ';' and tail
    window.name = `${before}${WINDOW_NAME_PREFIX}${ns}${after}`;
  } catch {
    // ignore
  }
}

function safeGetEnvMode(): string | null {
  try {
    const raw = (import.meta as any)?.env?.VITE_STORAGE_ISOLATION_MODE;
    return typeof raw === 'string' ? raw : null;
  } catch {
    return null;
  }
}

function parseMode(raw: string | null): StorageIsolationMode | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'off' || v === '0' || v === 'false' || v === 'disabled') return 'off';
  if (v === 'tab' || v === '1' || v === 'true' || v === 'enabled' || v === 'isolate') return 'tab';
  if (v === 'load' || v === 'fresh') return 'load';
  return null;
}

function parseModeFromUrl(): StorageIsolationMode | null {
  try {
    const url = new URL(window.location.href);
    const qp = url.searchParams;

    // Explicit override: ?storageIsolation=off|tab|load
    const explicit = parseMode(qp.get('storageIsolation'));
    if (explicit) return explicit;

    // Convenience flags:
    // - ?fresh=1  -> load isolation (new namespace every reload)
    // - ?isolate=1 -> tab isolation
    // - ?isolate=0 -> off
    const fresh = qp.get('fresh');
    if (fresh === '1' || fresh === 'true') return 'load';

    const isolate = qp.get('isolate');
    if (isolate === '1' || isolate === 'true') return 'tab';
    if (isolate === '0' || isolate === 'false') return 'off';

    return null;
  } catch {
    return null;
  }
}

export function getStorageIsolationMode(): StorageIsolationMode {
  if (cachedMode) return cachedMode;
  const fromUrl = parseModeFromUrl();
  if (fromUrl) {
    cachedMode = fromUrl;
    return cachedMode;
  }
  const fromEnv = parseMode(safeGetEnvMode());
  cachedMode = fromEnv ?? DEFAULT_MODE;
  return cachedMode;
}

function genNamespace(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `ns_${realNow().toString(36)}_${rand}`;
}

/**
 * Returns a stable namespace for the current page lifetime.
 * - In "tab" mode: stored in sessionStorage so it survives reloads within the tab.
 * - In "load" mode: generated once per load.
 */
export function getStorageNamespace(): string | null {
  if (cachedNamespace !== undefined) return cachedNamespace;

  const mode = getStorageIsolationMode();
  if (mode === 'off') {
    cachedNamespace = null;
    return cachedNamespace;
  }

  if (mode === 'tab') {
    // 1) Prefer sessionStorage (should survive reloads in the same tab)
    try {
      const existing = window.sessionStorage.getItem(SESSION_NS_KEY);
      if (existing) {
        // Best-effort: keep window.name in sync as fallback in case sessionStorage is later cleared.
        writeNamespaceToWindowName(existing);
        cachedNamespace = existing;
        return cachedNamespace;
      }
    } catch {
      // ignore and fall back
    }

    // 2) Fallback: window.name (also survives reloads in the same tab)
    const fromName = readNamespaceFromWindowName();
    if (fromName) {
      try {
        window.sessionStorage.setItem(SESSION_NS_KEY, fromName);
      } catch {
        // ignore
      }
      cachedNamespace = fromName;
      return cachedNamespace;
    }

    // 3) Create new namespace and persist to both stores (best-effort)
    const ns = genNamespace();
    try {
      window.sessionStorage.setItem(SESSION_NS_KEY, ns);
    } catch {
      // ignore
    }
    writeNamespaceToWindowName(ns);
    cachedNamespace = ns;
    return cachedNamespace;
  }

  // mode === 'load'
  cachedNamespace = genNamespace();
  return cachedNamespace;
}

export function makeNamespacedKey(key: string): string {
  const ns = getStorageNamespace();
  if (!ns) return key;
  return `mg:${ns}:${key}`;
}

const PATCH_MARK = '__MG_LOCALSTORAGE_NS_PATCH__';

/**
 * Monkey-patch Storage methods so all existing code that uses localStorage
 * automatically becomes namespaced, without touching every app.
 *
 * Notes:
 * - We only namespace *localStorage*. sessionStorage remains untouched.
 * - We don't patch key()/length enumeration (currently unused in this repo).
 */
export function installLocalStorageNamespacing(): { mode: StorageIsolationMode; namespace: string | null } {
  const mode = getStorageIsolationMode();
  const namespace = getStorageNamespace();

  if (mode === 'off' || !namespace) return { mode, namespace };

  const proto = Storage.prototype as any;
  if (proto[PATCH_MARK]) return { mode, namespace };

  const originalGetItem = proto.getItem;
  const originalSetItem = proto.setItem;
  const originalRemoveItem = proto.removeItem;
  const originalClear = proto.clear;
  const originalKey = proto.key;

  const prefix = `mg:${namespace}:`;

  proto.getItem = function (this: Storage, key: string) {
    if (this === window.localStorage) return originalGetItem.call(this, prefix + String(key));
    return originalGetItem.call(this, String(key));
  };

  proto.setItem = function (this: Storage, key: string, value: string) {
    if (this === window.localStorage) return originalSetItem.call(this, prefix + String(key), String(value));
    return originalSetItem.call(this, String(key), String(value));
  };

  proto.removeItem = function (this: Storage, key: string) {
    if (this === window.localStorage) return originalRemoveItem.call(this, prefix + String(key));
    return originalRemoveItem.call(this, String(key));
  };

  proto.clear = function (this: Storage) {
    if (this !== window.localStorage) return originalClear.call(this);

    // Only clear current-namespace keys; do NOT wipe other tabs' namespaces.
    const keysToRemove: string[] = [];
    try {
      const len = this.length;
      for (let i = 0; i < len; i++) {
        const k = originalKey.call(this, i);
        if (k && String(k).startsWith(prefix)) keysToRemove.push(String(k));
      }
      for (const k of keysToRemove) originalRemoveItem.call(this, k);
    } catch {
      // Fallback: if something goes wrong, preserve safety (don't wipe everything).
    }
  };

  proto[PATCH_MARK] = {
    installedAt: realNow(),
    namespace,
    mode,
  };

  return { mode, namespace };
}

export function getNamespacedIndexedDbName(baseName: string): string {
  const ns = getStorageNamespace();
  if (!ns) return baseName;
  return `mg_${ns}__${baseName}`;
}

