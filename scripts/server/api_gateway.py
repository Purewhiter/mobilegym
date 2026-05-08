#!/usr/bin/env python3
"""
API gateway backend for mobile-gym (Nginx companion).

Feature parity with Vite apiGatewayPlugin:
- POST /api/gw/fetch  — JSON body CORS proxy (cookie jar + streaming)
- *    /api/gw/proxy  — Transparent streaming proxy (header forwarding + retry)
- Per-session cookie jar (x-gw-session header)
- 404 response cache for proxy GET (5 min TTL, max 500 entries)
- Force accept-encoding: identity to upstream

Usage (single worker, dev):
    python scripts/server/api_gateway.py --port 4181

Usage (multi-worker, production):
    uvicorn scripts.server.api_gateway:app --host 127.0.0.1 --port 4181 --workers 8
"""

import argparse
import asyncio
import json
import time
from collections import OrderedDict
from http.cookies import SimpleCookie
from urllib.parse import urlparse

import httpx
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response, StreamingResponse
from starlette.routing import Route

# ── Per-worker HTTP client (created lazily) ───────────────────────────────

_client: httpx.AsyncClient | None = None


async def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=5.0),
            follow_redirects=True,
            limits=httpx.Limits(
                max_connections=100,
                max_keepalive_connections=20,
            ),
        )
    return _client


# ── Cookie Jar (per session, per worker) ──────────────────────────────────

_cookie_jars: dict[str, dict[str, dict[str, dict]]] = {}
# session_id -> host -> cookie_name -> {value, expires_at?}


def _get_session_id(request: Request) -> str:
    return request.headers.get("x-gw-session", "anon")


def _store_cookies(session_id: str, host: str, set_cookies: list[str]):
    if not set_cookies:
        return
    jar = _cookie_jars.setdefault(session_id, {})
    host_map = jar.setdefault(host, {})
    now = time.time()
    for sc in set_cookies:
        cookie = SimpleCookie(sc)
        for name, morsel in cookie.items():
            expires_at = None
            if morsel["max-age"]:
                try:
                    expires_at = now + int(morsel["max-age"])
                except ValueError:
                    pass
            if expires_at is not None and expires_at <= now:
                host_map.pop(name, None)
            else:
                host_map[name] = {"value": morsel.value, "expires_at": expires_at}


def _build_cookie_header(session_id: str, host: str) -> str | None:
    jar = _cookie_jars.get(session_id)
    if not jar:
        return None
    host_map = jar.get(host)
    if not host_map:
        return None
    now = time.time()
    pairs = []
    expired = []
    for name, entry in host_map.items():
        if entry.get("expires_at") is not None and entry["expires_at"] <= now:
            expired.append(name)
            continue
        pairs.append(f"{name}={entry['value']}")
    for name in expired:
        del host_map[name]
    return "; ".join(pairs) if pairs else None


# ── Proxy 404 Cache ──────────────────────────────────────────────────────

_PROXY_404_MAX = 500
_PROXY_404_TTL = 300  # 5 min

_proxy_404_cache: OrderedDict[str, float] = OrderedDict()


def _proxy_404_get(url: str) -> bool:
    expires_at = _proxy_404_cache.get(url)
    if expires_at is None:
        return False
    if time.time() > expires_at:
        _proxy_404_cache.pop(url, None)
        return False
    return True


def _proxy_404_set(url: str):
    _proxy_404_cache[url] = time.time() + _PROXY_404_TTL
    while len(_proxy_404_cache) > _PROXY_404_MAX:
        _proxy_404_cache.popitem(last=False)


# ── Hop-by-hop headers to strip ──────────────────────────────────────────

_SKIP_REQUEST_HEADERS = frozenset({
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade", "host",
    "origin", "referer",
    "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user",
    "x-gw-session",
})

_FORWARD_RESPONSE_HEADERS = frozenset({
    "content-type", "cache-control", "expires", "etag",
    "last-modified", "vary",
})

_TRANSIENT_ERRORS = frozenset({
    "ConnectError", "RemoteProtocolError",
    "ReadError", "WriteError",
})


# ── Handler: POST /api/gw/fetch ──────────────────────────────────────────

async def handle_fetch(request: Request) -> Response:
    """POST /api/gw/fetch — JSON body CORS proxy with cookie jar."""
    if request.method != "POST":
        return JSONResponse({"error": "Use POST"}, status_code=405)

    try:
        payload = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    target = payload.get("url")
    if not target or not isinstance(target, str):
        return JSONResponse({"error": "Missing payload.url"}, status_code=400)

    parsed = urlparse(target)
    if parsed.scheme not in ("http", "https"):
        return JSONResponse(
            {"error": "Only http/https protocols are allowed"}, status_code=400
        )

    session_id = _get_session_id(request)
    method = (payload.get("method") or "GET").upper()
    headers = payload.get("headers") or {}
    body = payload.get("body")

    # Force identity encoding
    header_keys_lower = {k.lower() for k in headers}
    if "accept-encoding" not in header_keys_lower:
        headers["accept-encoding"] = "identity"

    # Cookie jar: inject stored cookies if caller didn't set Cookie
    if "cookie" not in header_keys_lower:
        cookie = _build_cookie_header(session_id, parsed.netloc)
        if cookie:
            headers["cookie"] = cookie

    client = await get_client()
    try:
        resp = await client.request(
            method, target, headers=headers,
            content=body.encode() if isinstance(body, str) else body,
        )

        # Store Set-Cookie
        set_cookies = resp.headers.get_list("set-cookie")
        if set_cookies:
            _store_cookies(session_id, parsed.netloc, set_cookies)

        # Build response headers
        resp_headers: dict[str, str] = {}
        for h in _FORWARD_RESPONSE_HEADERS:
            v = resp.headers.get(h)
            if v:
                resp_headers[h] = v

        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=resp_headers,
        )
    except Exception as e:
        etype = type(e).__name__
        msg = str(e)
        print(f"[gw/fetch] upstream error: {etype}: {msg} url={target}")
        return JSONResponse({"error": msg, "type": etype, "url": target}, status_code=502)


# ── Handler: /api/gw/proxy ───────────────────────────────────────────────

async def handle_proxy(request: Request) -> Response:
    """GET/POST /api/gw/proxy?url=... — streaming proxy with header forwarding."""
    target = request.query_params.get("url")
    if not target:
        return JSONResponse({"error": "Missing url param"}, status_code=400)

    parsed = urlparse(target)
    if parsed.scheme not in ("http", "https"):
        return JSONResponse(
            {"error": "Only http/https protocols are allowed"}, status_code=400
        )

    method = request.method
    if method == "GET" and _proxy_404_get(target):
        return Response(status_code=404)

    session_id = _get_session_id(request)

    # Build upstream headers: forward incoming, strip hop-by-hop
    upstream_headers: dict[str, str] = {}
    for k, v in request.headers.items():
        if k.lower() not in _SKIP_REQUEST_HEADERS:
            upstream_headers[k.lower()] = v
    upstream_headers["accept-encoding"] = "identity"

    # Cookie jar
    if "cookie" not in upstream_headers:
        cookie = _build_cookie_header(session_id, parsed.netloc)
        if cookie:
            upstream_headers["cookie"] = cookie

    # Read request body for non-GET/HEAD
    req_body = None
    if method not in ("GET", "HEAD"):
        req_body = await request.body()

    client = await get_client()

    async def do_fetch():
        return await client.request(
            method, target, headers=upstream_headers, content=req_body,
        )

    # Try with one retry for transient errors
    try:
        try:
            resp = await do_fetch()
        except httpx.HTTPError as e:
            etype = type(e).__name__
            if etype in _TRANSIENT_ERRORS:
                print(f"[gw/proxy] upstream failed, retrying: {etype}: {e}")
                await asyncio.sleep(0.12)
                resp = await do_fetch()
            else:
                raise
    except Exception as e:
        etype = type(e).__name__
        msg = str(e)
        print(f"[gw/proxy] upstream error: {etype}: {msg} url={target}")
        return JSONResponse(
            {"error": msg, "type": etype, "url": target}, status_code=502
        )

    if method == "GET" and resp.status_code == 404:
        _proxy_404_set(target)

    # Store Set-Cookie
    set_cookies = resp.headers.get_list("set-cookie")
    if set_cookies:
        _store_cookies(session_id, parsed.netloc, set_cookies)

    resp_headers: dict[str, str] = {}
    has_encoding = resp.headers.get("content-encoding")
    for h in _FORWARD_RESPONSE_HEADERS:
        v = resp.headers.get(h)
        if v:
            resp_headers[h] = v
    # Only forward content-length when no content-encoding
    if not has_encoding:
        cl = resp.headers.get("content-length")
        if cl:
            resp_headers["content-length"] = cl

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
    )


# ── App Setup ─────────────────────────────────────────────────────────────

async def on_shutdown():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
    _client = None


app = Starlette(
    routes=[
        Route("/api/gw/fetch", handle_fetch, methods=["POST"]),
        Route("/api/gw/proxy", handle_proxy, methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
    ],
    on_shutdown=[on_shutdown],
)


def main():
    import uvicorn
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4174)
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()

    print(f"[api_gateway] API gateway on :{args.port} (workers={args.workers})")
    uvicorn.run(
        "scripts.server.api_gateway:app",
        host="127.0.0.1",
        port=args.port,
        workers=args.workers,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
