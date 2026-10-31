"""Python client for the device server (``/__device`` on the simulator host).

Each browser page owns one device session. Device-backed apps keep their data
there, so judges and setup code can read final records directly over HTTP
instead of serializing page state through CDP::

    device = await DeviceClient.for_env(env)
    note = device.record("redbook", "notes", note_id)   # likes/comments already applied
    hits = device.query("redbook", "searchNotes", {"keyword": "猫", "sort": "likes"})

Only the standard library is used; calls are synchronous and local (~1 ms).
Connections are kept alive (one per server and thread): judges issue
thousands of small queries, and a fresh TCP connection each would run the
host out of ephemeral ports.
"""

from __future__ import annotations

import http.client
import json
import ssl
import threading
import urllib.parse
from typing import Any

_local = threading.local()


def _connection(scheme: str, netloc: str, timeout: float) -> http.client.HTTPConnection:
    pool: dict[tuple[str, str], http.client.HTTPConnection] = getattr(_local, "pool", None) or {}
    _local.pool = pool
    conn = pool.get((scheme, netloc))
    if conn is None:
        if scheme == "https":
            # The local nginx gateway uses a self-signed certificate; the browser
            # side ignores HTTPS errors for the same reason.
            conn = http.client.HTTPSConnection(netloc, timeout=timeout, context=ssl._create_unverified_context())
        else:
            conn = http.client.HTTPConnection(netloc, timeout=timeout)
        pool[(scheme, netloc)] = conn
    conn.timeout = timeout
    if conn.sock is not None:
        conn.sock.settimeout(timeout)
    return conn


def _drop_connection(scheme: str, netloc: str) -> None:
    conn = (getattr(_local, "pool", None) or {}).pop((scheme, netloc), None)
    if conn is not None:
        conn.close()


class DeviceError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(f"device server {status}: {message}")
        self.status = status


class DeviceClient:
    def __init__(self, base_url: str, session_id: str, timeout: float = 10.0):
        self.base_url = base_url.rstrip("/") + "/__device"
        self.session_id = session_id
        self.timeout = timeout

    @classmethod
    async def for_env(cls, env: Any) -> "DeviceClient":
        """Client for the session of ``env.page`` (opens one if the page has none yet)."""
        session_id = await env.page.evaluate("() => window.__DEVICE__.sessionId()")
        return cls(env.url, session_id)

    @classmethod
    def open(cls, base_url: str, timeout: float = 30.0) -> "DeviceClient":
        """A new session of its own, not tied to any page."""
        probe = cls(base_url, "", timeout)
        return cls(base_url, probe._request("POST", "/sessions")["id"], timeout)

    def close(self) -> None:
        self._request("DELETE", f"/sessions/{urllib.parse.quote(self.session_id)}")

    # ── transport ──────────────────────────────────────────────────

    def _request(self, method: str, path: str, body: Any = None) -> Any:
        data = None if body is None else json.dumps(body).encode("utf-8")
        url = urllib.parse.urlsplit(self.base_url + path)
        target = url.path + (f"?{url.query}" if url.query else "")
        headers = {"Content-Type": "application/json"} if data is not None else {}
        # Only requests safe to repeat are retried: a lost response may mean the
        # server already acted (a new session, a command).
        retryable = method in ("GET", "PUT", "DELETE") or "/queries/" in url.path
        if not retryable:
            # A fresh connection, so an idle one the server already closed cannot eat it.
            _drop_connection(url.scheme, url.netloc)
        for attempt in (0, 1):
            conn = _connection(url.scheme, url.netloc, self.timeout)
            try:
                conn.request(method, target, body=data, headers=headers)
                resp = conn.getresponse()
                raw = resp.read()
                break
            except (http.client.RemoteDisconnected, BrokenPipeError, ConnectionResetError):
                # The server closed an idle keep-alive connection; retry once on a new one.
                _drop_connection(url.scheme, url.netloc)
                if attempt or not retryable:
                    raise
            except Exception:
                _drop_connection(url.scheme, url.netloc)
                raise
        if resp.status >= 400:
            try:
                message = json.loads(raw.decode("utf-8")).get("error", resp.reason)
            except Exception:
                message = resp.reason
            raise DeviceError(resp.status, str(message))
        return json.loads(raw.decode("utf-8"))

    def _app(self, app_id: str) -> str:
        return (
            f"/sessions/{urllib.parse.quote(self.session_id)}"
            f"/apps/{urllib.parse.quote(app_id)}"
        )

    # ── reads ──────────────────────────────────────────────────────

    def state(self, app_id: str) -> dict[str, Any] | None:
        """The app's exported state (same shape as ``__SIM__.getState().apps[app_id]``)."""
        return self._request("GET", f"{self._app(app_id)}/state").get("state")

    def put_state(self, app_id: str, state: dict[str, Any]) -> dict[str, Any]:
        """Replace the app's state in this session (as task setup and the page do)."""
        return self._request("PUT", f"{self._app(app_id)}/state", {"state": state}).get("state")

    def record(self, app_id: str, collection: str, record_id: str) -> dict[str, Any] | None:
        """One merged record: this session's changes applied over the catalog."""
        path = (
            f"{self._app(app_id)}/records/{urllib.parse.quote(collection)}"
            f"/{urllib.parse.quote(str(record_id))}"
        )
        return self._request("GET", path).get("record")

    def overlay(self, app_id: str, collection: str) -> dict[str, dict[str, Any] | None]:
        """Records this session changed relative to the catalog (``None`` = hidden)."""
        path = f"{self._app(app_id)}/overlay/{urllib.parse.quote(collection)}"
        return self._request("GET", path).get("overlay") or {}

    def query(self, app_id: str, name: str, args: dict[str, Any] | None = None) -> Any:
        path = f"{self._app(app_id)}/queries/{urllib.parse.quote(name)}"
        return self._request("POST", path, {"args": args or {}}).get("result")
