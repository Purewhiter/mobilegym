"""Python client for the device server (``/__device`` on the simulator host).

Each browser page owns one device session. Device-backed apps keep their data
there, so judges and setup code can read final records directly over HTTP
instead of serializing page state through CDP::

    device = await DeviceClient.for_env(env)
    note = device.record("redbook", "notes", note_id)   # likes/comments already applied
    hits = device.query("redbook", "searchNotes", {"keyword": "猫", "sort": "likes"})

Only the standard library is used; calls are synchronous and local (~1 ms).
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


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

    # ── transport ──────────────────────────────────────────────────

    def _request(self, method: str, path: str, body: Any = None) -> Any:
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"} if data is not None else {},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                message = json.loads(e.read().decode("utf-8")).get("error", e.reason)
            except Exception:
                message = e.reason
            raise DeviceError(e.code, str(message)) from None

    def _app(self, app_id: str) -> str:
        return (
            f"/sessions/{urllib.parse.quote(self.session_id)}"
            f"/apps/{urllib.parse.quote(app_id)}"
        )

    # ── reads ──────────────────────────────────────────────────────

    def state(self, app_id: str) -> dict[str, Any] | None:
        """The app's exported state (same shape as ``__SIM__.getState().apps[app_id]``)."""
        return self._request("GET", f"{self._app(app_id)}/state").get("state")

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
