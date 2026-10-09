# Network Service

`os/NetworkService.ts` is the device-like network surface. Apps and OS services that need to talk to external HTTP servers must go through it instead of calling `fetch()` directly. Same-origin static asset fetches (e.g. `loader.ts` loading bundled JSON via `new URL('./posts.json', import.meta.url)`) are an explicit exception — the gateway is only for cross-origin traffic.

## API

```ts
import { netFetch, netJson, netText } from '@/os/NetworkService';

await netFetch(input, init?);             // → Response
await netJson<T>(input, init?);            // → T  (auto JSON.parse; throws on non-2xx)
await netText(input, init?);               // → string
```

| Helper | Behavior |
|---|---|
| `netFetch` | Returns the raw `Response`. Caller handles body and status. |
| `netJson<T>(...)` | Calls `netFetch`, throws on `!res.ok` (error message includes the response text's first 200 chars for diagnostics), otherwise `res.json()`. |
| `netText(...)` | Same as `netJson` but returns text. |

`init` is the standard `RequestInit` plus one extra option:

```ts
interface NetFetchOptions extends RequestInit {
  forceGateway?: boolean;   // route through the local gateway even for same-origin URLs
}
```

## URL routing

`netFetch` inspects the URL to decide whether to hit the gateway:

| URL shape | Route |
|---|---|
| Relative path (`/foo`, `data/index.ts`) | Same-origin direct `fetch` (no gateway). |
| Path under `/api/gw/...` | Direct (already gateway). |
| Absolute `http(s)://...` | Gateway. |
| `forceGateway: true` | Gateway, even for same-origin URLs (useful when you want cookie-jar behavior on a relative endpoint). |

Image / video resources should be loaded with `<img src>` / `<video src>` directly — the gateway is for code-driven `fetch` calls, not for the browser's resource pipeline.

### Gateway endpoints

The gateway runs as part of `vite.config.ts`'s dev server and exposes two paths:

| Endpoint | When | Body |
|---|---|---|
| `POST /api/gw/fetch` | `init.body` is a string (or absent) | JSON envelope `{ url, method, headers, body }`. The gateway issues the upstream request and returns the response with body inline. |
| `/api/gw/proxy?url=...` | `init.body` is `FormData` / `Blob` / `ArrayBuffer` / a stream | Streaming pass-through. Headers and body are forwarded, the upstream response is streamed back. |

`netFetch` picks the right endpoint automatically from the `body` type — callers don't need to think about which gateway route to hit.

## Per-session cookie jar

The gateway maintains a per-session cookie jar so multiple App tabs/scenarios don't share `Set-Cookie` state.

- Session id: a UUID stored in `localStorage` under `mobile-gym:gw:session`, generated lazily on first call.
- Every gateway request includes header `x-gw-session: <uuid>`.
- The gateway parses upstream `Set-Cookie` into the jar keyed by that session id, and on subsequent requests auto-prepends `Cookie:` from the jar.
- If the caller explicitly sets a `Cookie` header in `init.headers`, the gateway **respects it** and does not auto-prepend — explicit beats jar.

This is the main reason apps cannot bypass `NetworkService`: a bare `fetch()` skips the jar, so logins / session-dependent endpoints break.

## Header forwarding policy (server-side)

The gateway strips hop-by-hop headers (`connection`, `transfer-encoding`, `upgrade`, `host`, etc.) and forces `accept-encoding: identity` upstream. It **does not forward `content-encoding` or `content-length` from upstream responses** to the browser, because Vite's dev server decompresses on the way in but the original headers would still claim `gzip`, leading to spurious `Failed to fetch`. `content-disposition` is explicitly allowed through (for downloads).

If a downstream request appears to "hang" or the response body looks corrupted, check whether the upstream is sending an encoding the gateway then re-encodes — those are the classic symptoms.

## Same-origin exceptions

Three explicit exceptions to "go through NetworkService":

1. **`loader.ts` loading bundled JSON** via `new URL('./xxx.json', import.meta.url)`. The URL is same-origin, Vite serves it directly, and the cookie jar is irrelevant for static assets.
2. **Vite dev-server endpoints** that already live under `/api/...`. These resolve same-origin and don't go through the cross-origin gateway path.
3. **`<img src>` / `<video src>`** for CDN-hosted media. The browser's resource pipeline already handles caching, range requests, and decoding; routing it through the gateway would force everything to RAM-buffer.

Direct `fetch()` calls anywhere else are bugs — a few known legacy violators remain (Spotify, Map); they should be migrated, not imitated.

## What's not implemented

- **Timeout / retry**: `netFetch` only forwards `init.signal`. No default timeout, no exponential backoff. Callers must wire their own `AbortController`.
- **Network mocks / bench scenario injection**: there's no `__SIM_NET__`-style global to intercept outbound traffic per task.
- **Gateway-side response cache**: only the 404 cache exists. App-level caches (Weather 5-min, geocoding 10-min) are app responsibility.

These are deliberate gaps — file an issue if one of them ever becomes a blocker.

## Related Docs

- Service index → [README.md](README.md)
- Loader pattern (the same-origin exception) → [`../../state/model.md`](../../state/model.md#large-world-data-the-loaderts-pattern)
