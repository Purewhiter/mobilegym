import type { AppId } from './types';
import { getAppManifest } from './data/appRegistry';
import {
  isPermissionId,
  PERMISSION_IDS,
  type PermissionId,
  type PermissionRequestOptions,
  type PermissionSnapshot,
  type PermissionStatus,
} from './permissions';
import { mutateOsState, useOsStateStore } from './OsStateStore';
import { now as timeNow } from './TimeService';

type Listener = (snapshot: PermissionSnapshot) => void;

/** Partial map — not every PermissionId key is required. */
type PermissionResultMap = Partial<Record<PermissionId, PermissionStatus>>;

interface PermissionRequestResultDetail {
  requestId: string;
  results?: PermissionResultMap;
}

interface PendingRequest {
  appId: AppId;
  permIds: PermissionId[];
  baseResults: PermissionResultMap;
  resolve: (results: PermissionResultMap) => void;
}

export const PERMISSION_REQUEST_OPEN_EVENT = 'permission-request-open';
export const PERMISSION_REQUEST_RESULT_EVENT = 'permission-request-result';
export const PERMISSION_REQUEST_BACK_EVENT = 'permission-request-back';

const VALID_STATUSES: PermissionStatus[] = ['not_requested', 'granted', 'denied', 'denied_forever'];

const listeners = new Set<Listener>();
const pendingRequests = new Map<string, PendingRequest>();
let requestQueue: Promise<void> = Promise.resolve();
let cachedSnapshot: PermissionSnapshot | null = null;

function normalizeStatus(value: unknown): PermissionStatus | null {
  if (typeof value !== 'string') return null;
  return VALID_STATUSES.includes(value as PermissionStatus) ? (value as PermissionStatus) : null;
}

function uniqPermissionIds(permIds: PermissionId[]): PermissionId[] {
  return Array.from(new Set(permIds));
}

function getGrants(): PermissionSnapshot['grants'] {
  return useOsStateStore.getState().permissions as PermissionSnapshot['grants'];
}

function readStatus(appId: AppId, permissionId: PermissionId): PermissionStatus {
  return getGrants()[appId]?.[permissionId] ?? 'not_requested';
}

function writeStatus(appId: AppId, permissionId: PermissionId, status: PermissionStatus): boolean {
  const prev = readStatus(appId, permissionId);
  if (prev === status) return false;
  const current = getGrants();
  const appGrants = { ...(current[appId] || {}) };
  appGrants[permissionId] = status;
  mutateOsState((state) => {
    state.permissions = {
      ...current,
      [appId]: appGrants,
    };
  });
  return true;
}

function computeSnapshot(): PermissionSnapshot {
  return { grants: getGrants() };
}

function normalizeRequestPermissionIds(permIds: PermissionId[]): PermissionId[] {
  const valid = permIds.filter((permId): permId is PermissionId => PERMISSION_IDS.includes(permId));
  return uniqPermissionIds(valid);
}

function genRequestId(): string {
  try {
    const c = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    // ignore
  }
  return `perm_${timeNow()}_${Math.random().toString(16).slice(2)}`;
}

function resolvePermissionRequest(detail: PermissionRequestResultDetail | undefined) {
  if (!detail?.requestId) return;

  const pending = pendingRequests.get(detail.requestId);
  if (!pending) return;
  pendingRequests.delete(detail.requestId);

  const mergedResults: PermissionResultMap = { ...pending.baseResults };
  let changed = false;

  for (const permId of pending.permIds) {
    const prev = readStatus(pending.appId, permId);
    const fromDialog = detail.results?.[permId];
    const normalized = normalizeStatus(fromDialog);
    let next: PermissionStatus = normalized || 'denied';

    if (next === 'not_requested') next = 'denied';
    if (next === 'denied' && prev === 'denied') {
      next = 'denied_forever';
    }

    if (writeStatus(pending.appId, permId, next)) {
      changed = true;
    }
    mergedResults[permId] = next;
  }

  pending.resolve(mergedResults);
}

async function requestPermissionsInternal(
  appId: AppId,
  permIds: PermissionId[],
  options?: PermissionRequestOptions,
): Promise<PermissionResultMap> {
  const normalizedPermIds = normalizeRequestPermissionIds(permIds);
  const instantResults: PermissionResultMap = {};
  const needPrompt: PermissionId[] = [];

  for (const permId of normalizedPermIds) {
    const status = readStatus(appId, permId);
    if (status === 'granted' || status === 'denied_forever') {
      instantResults[permId] = status;
      continue;
    }
    needPrompt.push(permId);
  }

  if (needPrompt.length === 0) {
    return instantResults;
  }

  const requestId = genRequestId();
  const PERMISSION_TIMEOUT_MS = 60_000;

  return new Promise((resolve) => {
    pendingRequests.set(requestId, {
      appId,
      permIds: needPrompt,
      baseResults: instantResults,
      resolve,
    });

    setTimeout(() => {
      const pending = pendingRequests.get(requestId);
      if (!pending) return; // already resolved
      pendingRequests.delete(requestId);

      const results: PermissionResultMap = { ...pending.baseResults };
      let changed = false;
      for (const permId of pending.permIds) {
        if (!(permId in results)) {
          const prev = readStatus(pending.appId, permId);
          const next: PermissionStatus = prev === 'denied' ? 'denied_forever' : 'denied';
          if (writeStatus(pending.appId, permId, next)) changed = true;
          results[permId] = next;
        }
      }
      void changed;
      pending.resolve(results);
    }, PERMISSION_TIMEOUT_MS);

    window.dispatchEvent(
      new CustomEvent(PERMISSION_REQUEST_OPEN_EVENT, {
        detail: {
          requestId,
          appId,
          permIds: needPrompt,
          rationale: options?.rationale,
        },
      }),
    );
  });
}

function enqueueRequest<T>(task: () => Promise<T>): Promise<T> {
  const nextRun = requestQueue.then(task, task);
  requestQueue = nextRun.then(
    () => undefined,
    () => undefined,
  );
  return nextRun;
}

if (typeof window !== 'undefined') {
  window.addEventListener(PERMISSION_REQUEST_RESULT_EVENT, (event: Event) => {
    resolvePermissionRequest((event as CustomEvent<PermissionRequestResultDetail>).detail);
  });
}

;(useOsStateStore.subscribe as any)(
  (state: { permissions: PermissionSnapshot['grants'] }) => state.permissions,
  (permissions: PermissionSnapshot['grants']) => {
    cachedSnapshot = { grants: permissions as PermissionSnapshot['grants'] };
    for (const listener of listeners) listener(cachedSnapshot);
  },
);

export const PermissionService = {
  getState(): PermissionSnapshot {
    if (!cachedSnapshot) cachedSnapshot = computeSnapshot();
    return cachedSnapshot;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(this.getState());
    return () => listeners.delete(listener);
  },

  checkPermission(appId: AppId, permissionId: PermissionId): PermissionStatus {
    return readStatus(appId, permissionId);
  },

  checkPermissions(appId: AppId, permissionIds: PermissionId[]): PermissionResultMap {
    const results: PermissionResultMap = {};
    for (const permissionId of normalizeRequestPermissionIds(permissionIds)) {
      results[permissionId] = readStatus(appId, permissionId);
    }
    return results;
  },

  requestPermissions(
    appId: AppId,
    permissionIds: PermissionId[],
    options?: PermissionRequestOptions,
  ): Promise<PermissionResultMap> {
    return enqueueRequest(() => requestPermissionsInternal(appId, permissionIds, options));
  },

  grantPermission(appId: AppId, permissionId: PermissionId): void {
    if (!writeStatus(appId, permissionId, 'granted')) return;
  },

  revokePermission(appId: AppId, permissionId: PermissionId): void {
    if (!writeStatus(appId, permissionId, 'denied')) return;
  },

  revokeAll(appId: AppId): void {
    const existing = getGrants()[appId] || {};
    const declared = this.getDeclaredPermissions(appId);
    const all = uniqPermissionIds([
      ...(Object.keys(existing).filter(isPermissionId) as PermissionId[]),
      ...declared,
    ]);
    if (all.length === 0) return;

    let changed = false;
    for (const permissionId of all) {
      if (writeStatus(appId, permissionId, 'denied')) changed = true;
    }
    if (!changed) return;
  },

  getAppsWithPermissions(): AppId[] {
    const grants = getGrants();
    return Object.keys(grants).filter((appId) => {
      const appGrants = grants[appId as AppId];
      return !!appGrants && Object.keys(appGrants).length > 0;
    });
  },

  getDeclaredPermissions(appId: AppId): PermissionId[] {
    const manifest = getAppManifest(appId);
    const declared = manifest?.permissions ?? [];
    return normalizeRequestPermissionIds(declared);
  },
};

export default PermissionService;
