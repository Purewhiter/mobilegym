/**
 * Browser side of the device server (`/__device`, see device/http.ts).
 *
 * One page = one session. The session id lives in sessionStorage, so a reload
 * keeps the same phone while every page (and every bench worker) gets its
 * own. Requests to one session are serialized: a state push followed by a
 * command always reaches the server in that order. `exclusive()` runs several
 * requests in one queue slot when they must not be interleaved.
 *
 * `resetSession()` starts a new generation: work queued or in flight for the
 * old session is dropped (it rejects with `DeviceStaleError`), so nothing from
 * the previous episode can land in the new one.
 *
 * `pending()` counts in-flight requests; `whenIdle()` resolves once all of
 * them settle — the signal screenshots and judges wait on.
 */

const SESSION_KEY = 'mg_device_session';
const SESSION_OWNER_KEY = 'mg_device_session_owner';
const SESSION_OWNER_MARKER = /(?:^|;)__MG_DEVICE_SESSION__=([^;]*);/;
const BASE = `${(import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')}/__device`;
const REQUEST_TIMEOUT_MS = 60_000;
const DELETE_TIMEOUT_MS = 5_000;

let generation = 0;
let sessionPromise: Promise<string> | null = null;
/** Resolved session id, for building URLs synchronously (null until opened). */
let currentSession: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
let controller = new AbortController();
let inFlight = 0;
const idleWaiters = new Set<() => void>();

export class DeviceRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** The session was reset while this work was queued or running; its result is void. */
export class DeviceStaleError extends Error {
  constructor() {
    super('device session was reset');
  }
}

function requestSignal(signal?: AbortSignal, timeoutMs = REQUEST_TIMEOUT_MS): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: requestSignal(signal, method === 'DELETE' ? DELETE_TIMEOUT_MS : REQUEST_TIMEOUT_MS),
  });
  if (res.ok) return await res.json() as T;
  const json = await res.json().catch(() => ({}));
  throw new DeviceRequestError(res.status, json?.error || `HTTP ${res.status} ${path}`);
}

function readStoredSession(): string | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored || typeof window === 'undefined') return stored;
    const owner = window.name.match(SESSION_OWNER_MARKER)?.[1];
    if (owner === stored) return stored;
    // A popup can inherit sessionStorage from its opener, but has its own window.name.
    // Adopt a pre-existing session from before the owner marker in an ordinary tab.
    return !sessionStorage.getItem(SESSION_OWNER_KEY) && !window.opener ? stored : null;
  } catch {
    return null;
  }
}

function storeSession(id: string | null): void {
  try {
    if (id) {
      sessionStorage.setItem(SESSION_KEY, id);
      sessionStorage.setItem(SESSION_OWNER_KEY, id);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_OWNER_KEY);
    }
    if (typeof window !== 'undefined') {
      const name = window.name.replace(SESSION_OWNER_MARKER, (match) => match.startsWith(';') ? ';' : '');
      window.name = id ? `__MG_DEVICE_SESSION__=${id};${name}` : name;
    }
  } catch {
    // Storage blocked: the session just won't survive a reload.
  }
}

const deleteSession = (sid: string) =>
  request('DELETE', `/sessions/${encodeURIComponent(sid)}`).catch(() => undefined);

async function openSession(gen: number): Promise<string> {
  const stored = readStoredSession();
  if (stored) {
    storeSession(stored);
    return (currentSession = stored);
  }
  const { id } = await request<{ id: string }>('POST', '/sessions', undefined, controller.signal);
  if (gen !== generation) {
    // A reset happened while this session was being created: discard it.
    void deleteSession(id);
    throw new DeviceStaleError();
  }
  storeSession(id);
  return (currentSession = id);
}

function session(): Promise<string> {
  const gen = generation;
  sessionPromise ??= openSession(gen).catch((err) => {
    if (gen === generation) sessionPromise = null;
    throw err;
  });
  return sessionPromise;
}

const settleOne = (gen: number) => {
  if (gen !== generation) return;
  inFlight -= 1;
  if (inFlight === 0) for (const resolve of [...idleWaiters]) resolve();
};

const isUnknownSession = (err: unknown) =>
  err instanceof DeviceRequestError && err.status === 404 && /unknown session/.test(err.message);

/**
 * Run `fn` after every earlier request to this session has settled. `origin`:
 * the generation the work started in, when it awaited something before
 * getting here; work from an earlier generation is abandoned, not run in the
 * next episode's session.
 */
function enqueue<T>(fn: (sid: string, signal: AbortSignal) => Promise<T>, origin = generation): Promise<T> {
  const gen = origin;
  if (gen !== generation) return Promise.reject(new DeviceStaleError());
  const { signal } = controller;
  inFlight += 1;
  const run = queue.then(async () => {
    if (gen !== generation) throw new DeviceStaleError();
    const sid = await session();
    if (gen !== generation) throw new DeviceStaleError();
    let result: T;
    try {
      result = await fn(sid, signal);
    } catch (err) {
      if (!isUnknownSession(err) || gen !== generation) throw err;
      // The server forgot the session (restart): open a fresh one and retry once.
      storeSession(null);
      sessionPromise = null;
      currentSession = null;
      const nextSid = await session();
      if (gen !== generation) throw new DeviceStaleError();
      result = await fn(nextSid, signal);
    }
    if (gen !== generation) throw new DeviceStaleError();
    return result;
  }).catch((err) => {
    if (gen !== generation) throw new DeviceStaleError();
    throw err;
  });
  const settle = () => settleOne(gen);
  queue = run.then(settle, settle);
  return run;
}

const appPath = (sid: string, appId: string) => `/sessions/${encodeURIComponent(sid)}/apps/${encodeURIComponent(appId)}`;

export interface DeviceStateResponse<S> {
  initialized: boolean;
  version: number;
  state: S | null;
}

export interface DeviceCommandResponse<S> {
  result: unknown;
  version: number;
  state: S;
}

/** Requests bound to one session, for use inside `exclusive()`. */
export interface DeviceSessionApi {
  getState<S>(appId: string): Promise<DeviceStateResponse<S>>;
  putState<S>(appId: string, state: S): Promise<{ version: number; state: S }>;
  command<S>(appId: string, name: string, args: unknown[], now: number): Promise<DeviceCommandResponse<S>>;
  query<T>(appId: string, name: string, args: Record<string, unknown>): Promise<T>;
}

function sessionApi(sid: string, signal: AbortSignal): DeviceSessionApi {
  return {
    getState: appId => request('GET', `${appPath(sid, appId)}/state`, undefined, signal),
    putState: (appId, state) => request('PUT', `${appPath(sid, appId)}/state`, { state }, signal),
    command: (appId, name, args, now) =>
      request('POST', `${appPath(sid, appId)}/commands/${encodeURIComponent(name)}`, { args, now }, signal),
    query: <T,>(appId: string, name: string, args: Record<string, unknown>) =>
      request<{ result: T }>('POST', `${appPath(sid, appId)}/queries/${encodeURIComponent(name)}`, { args }, signal)
        .then(r => r.result),
  };
}

export const DeviceClient = {
  sessionId: () => session(),

  /** The open session's id, or null before the first request resolves. */
  currentSessionId: () => currentSession,

  /** Bumped by every `resetSession()`. */
  generation: () => generation,

  /** URL of a session blob, usable directly as an <img>/<video> src. */
  blobUrl(blobId: string): string | null {
    return currentSession ? `${BASE}/sessions/${encodeURIComponent(currentSession)}/blobs/${encodeURIComponent(blobId)}` : null;
  },

  /** Upload bytes once; commands then reference them by the returned id. */
  putBlob(blob: Blob): Promise<{ id: string; size: number; type: string }> {
    return enqueue(async (sid, signal) => {
      const res = await fetch(`${BASE}/sessions/${encodeURIComponent(sid)}/blobs`, {
        method: 'PUT',
        headers: { 'Content-Type': blob.type || 'application/octet-stream' },
        body: blob,
        signal: requestSignal(signal),
      });
      if (res.ok) return await res.json();
      const json = await res.json().catch(() => ({}));
      throw new DeviceRequestError(res.status, json?.error || `HTTP ${res.status} PUT blob`);
    });
  },

  /**
   * Several requests in one queue slot: nothing else for this session runs in
   * between. `origin`: the generation the caller started in (see `enqueue`).
   */
  exclusive<T>(fn: (api: DeviceSessionApi, sid: string) => Promise<T>, origin?: number): Promise<T> {
    return enqueue((sid, signal) => fn(sessionApi(sid, signal), sid), origin);
  },

  getState<S>(appId: string): Promise<DeviceStateResponse<S>> {
    return DeviceClient.exclusive(api => api.getState<S>(appId));
  },

  putState<S>(appId: string, state: S): Promise<{ version: number; state: S }> {
    return DeviceClient.exclusive(api => api.putState(appId, state));
  },

  command<S>(appId: string, name: string, args: unknown[], now: number): Promise<DeviceCommandResponse<S>> {
    return DeviceClient.exclusive(api => api.command<S>(appId, name, args, now));
  },

  query<T>(appId: string, name: string, args: Record<string, unknown>): Promise<T> {
    return DeviceClient.exclusive(api => api.query<T>(appId, name, args));
  },

  /**
   * Drop this page's session; the next request opens a fresh one. Work queued
   * for the old session is abandoned (rejects with DeviceStaleError).
   */
  async resetSession(): Promise<void> {
    generation += 1;
    controller.abort();
    controller = new AbortController();
    queue = Promise.resolve();
    inFlight = 0;
    for (const resolve of [...idleWaiters]) resolve();
    const sid = readStoredSession() ?? currentSession;
    storeSession(null);
    sessionPromise = null;
    currentSession = null;
    if (sid) await deleteSession(sid);
  },

  /**
   * Count `work` as in flight until it settles. Used for gaps the request queue
   * cannot see, e.g. between a data change and the re-render that issues the
   * follow-up queries.
   */
  hold(work: Promise<unknown>): void {
    const gen = generation;
    inFlight += 1;
    const settle = () => settleOne(gen);
    work.then(settle, settle);
  },

  pending: () => inFlight,

  whenIdle(): Promise<void> {
    if (inFlight === 0) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => {
        idleWaiters.delete(done);
        resolve();
      };
      idleWaiters.add(done);
    });
  },
};

if (typeof window !== 'undefined') {
  (window as any).__DEVICE__ = DeviceClient;
}
