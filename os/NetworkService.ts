/**
 * System Network Service
 *
 * Goal:
 * - Give every app a single, stable way to do network requests
 * - In browser runtime, transparently avoid CORS by routing cross-origin HTTP(S) requests
 *   through the system gateway endpoint: POST /api/gw/fetch
 *
 * How it works:
 * - Relative URLs (same-origin) use native fetch directly
 * - Absolute URLs (http/https) are automatically proxied through /api/gw/fetch
 *
 * Notes:
 * - This is a "system service" abstraction. Real mobile OS has no CORS; this is our Web equivalent.
 * - For binary payloads (images/video), prefer using <img>/<video> direct src when possible.
 */

import { immediateSetItem } from './debouncedPersist';
import { realNow } from './TimeService';

export type NetFetchOptions = RequestInit & {
  /**
   * Force routing through gateway even for same-origin URLs.
   */
  forceGateway?: boolean;
};

type GatewayFetchPayload = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

function isAbsoluteHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function normalizeInput(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  // Request object
  if ((input as any)?.url) return (input as any).url as string;
  return input.toString();
}

function toHeadersObject(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((v, k) => (obj[k] = v));
    return obj;
  }
  if (Array.isArray(headers)) {
    const obj: Record<string, string> = {};
    for (const [k, v] of headers) obj[k] = v;
    return obj;
  }
  return headers as Record<string, string>;
}

function getGatewaySessionId() {
  const key = 'mobile-gym:gw:session';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto?.randomUUID ? crypto.randomUUID() : String(realNow()) + Math.random().toString(16).slice(2);
    immediateSetItem(key, id);
    return id;
  } catch {
    return 'anon';
  }
}

async function gatewayFetch(url: string, init: NetFetchOptions = {}) {
  const payload: GatewayFetchPayload = {
    url,
    method: init.method || 'GET',
    headers: toHeadersObject(init.headers),
  };

  // Body: support string payloads (JSON/text). For FormData/Blob/ArrayBuffer, caller should stringify or avoid.
  const bodyAny = init.body as any;
  if (typeof bodyAny === 'string') payload.body = bodyAny;

  const resp = await fetch('/api/gw/fetch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-gw-session': getGatewaySessionId(),
    },
    body: JSON.stringify(payload),
    signal: init.signal,
  });

  // The gateway returns upstream status + body. We keep it as-is.
  return resp;
}

async function gatewayProxy(url: string, init: NetFetchOptions = {}) {
  // For non-string bodies (FormData/Blob/ArrayBuffer/ReadableStream), we tunnel the request body
  // through same-origin endpoint to avoid CORS while keeping streaming.
  const u = new URL('/api/gw/proxy', window.location.origin);
  u.searchParams.set('url', url);
  return fetch(u.toString(), {
    ...init,
    headers: {
      ...(toHeadersObject(init.headers) || {}),
      'x-gw-session': getGatewaySessionId(),
    },
  });
}

/**
 * Unified fetch for apps.
 */
export async function netFetch(input: RequestInfo | URL, init: NetFetchOptions = {}) {
  const url = normalizeInput(input);

  // If already routed to gateway explicitly, don't wrap again.
  if (url.startsWith('/api/gw/')) {
    return fetch(url, init);
  }

  if (init.forceGateway || isAbsoluteHttpUrl(url)) {
    const bodyAny = init.body as any;
    // Use proxy tunnel for non-string bodies to preserve streaming compatibility.
    if (bodyAny != null && typeof bodyAny !== 'string') {
      return gatewayProxy(url, init);
    }
    return gatewayFetch(url, init);
  }

  return fetch(input as any, init);
}

export async function netJson<T = any>(input: RequestInfo | URL, init: NetFetchOptions = {}): Promise<T> {
  const resp = await netFetch(input, init);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Network error: ${resp.status} ${resp.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`);
  }
  return (await resp.json()) as T;
}

export async function netText(input: RequestInfo | URL, init: NetFetchOptions = {}): Promise<string> {
  const resp = await netFetch(input, init);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Network error: ${resp.status} ${resp.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`);
  }
  return await resp.text();
}
