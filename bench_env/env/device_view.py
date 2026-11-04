"""Merged app views for judges and samplers, computed by the device server.

Device-backed apps (RedBook, X, Reddit) keep a read-only catalog on the
server and the user's changes in the app state. Merging the two (an edited
post replacing the catalog one, a like adding one to the count, feed and
search order) is done in exactly one place: the app's device module. Python
never re-derives it.

A judge holds state snapshots (``input.apps[app_id]`` and its initial
counterpart), not a live session. ``DeviceView(app_id, state)`` imports the
snapshot into a scratch session and answers the module's queries from there,
so the initial and the final state are viewed the same way, and offline tests
need nothing but a device server::

    view = DeviceView("x", input.apps["x"])
    post = view.query("viewPost", {"id": post_id})

Results are cached per (server, app, state, query); treat them as read-only.

The server comes from ``MOBILE_GYM_DEVICE_URL`` or ``configure()``; failing
those, a view captures the simulator URL of its environment when created.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
from collections import OrderedDict
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator

from bench_env.env.device_client import DeviceClient, DeviceError

ENV_VAR = "MOBILE_GYM_DEVICE_URL"

_SESSION_LIMIT = 16
_RESULT_LIMIT = 512
# Generous for the first query of an app (the server loads its catalog then),
# short enough that an unreachable server fails a judge instead of hanging a run.
_TIMEOUT = 20.0

_configured_url: str | None = os.environ.get(ENV_VAR) or None
_env_url: ContextVar[str | None] = ContextVar("device_view_env_url", default=None)
_lock = threading.Lock()
_sessions: OrderedDict[tuple[str, str, str], DeviceClient] = OrderedDict()
_results: OrderedDict[tuple[str, str, str, str, str], Any] = OrderedDict()


def configure(base_url: str) -> None:
    """Use the device server mounted at ``base_url`` (the simulator URL)."""
    global _configured_url
    _configured_url = base_url.rstrip("/")


def use_env_url(base_url: str) -> None:
    """Called by each bench env: its simulator, unless one was configured explicitly."""
    _env_url.set(base_url.rstrip("/"))


@contextmanager
def using_env_url(url: str | None) -> Iterator[None]:
    """Bind setup and evaluation, including worker threads, to this environment."""
    if url is None:
        yield
        return
    token = _env_url.set(url.rstrip("/"))
    try:
        yield
    finally:
        _env_url.reset(token)


def is_configured() -> bool:
    return bool(_configured_url or _env_url.get())


def base_url() -> str:
    url = _configured_url or _env_url.get()
    if not url:
        raise RuntimeError(
            f"no device server configured: start the bench env or set {ENV_VAR} "
            "to a simulator URL (the device server answers at <url>/__device)"
        )
    return url


def _digest(state: Any) -> str:
    # Key order is kept: overlay tables are ordered (X lists this state's posts
    # in insertion order), so reordered states are different views.
    raw = json.dumps(state, ensure_ascii=False, separators=(",", ":"), default=str)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


class DeviceView:
    """Read-only view of one app state, answered by the device server."""

    def __init__(self, app_id: str, state: dict[str, Any] | None):
        self.app_id = app_id
        self._state = state if isinstance(state, dict) else {}
        self._url = _configured_url or _env_url.get()
        self._digest: str | None = None

    def query(self, name: str, args: dict[str, Any] | None = None) -> Any:
        if self._url is None:
            self._url = base_url()
        url = self._url
        if self._digest is None:
            self._digest = _digest(self._state)
        key = (url, self.app_id, self._digest, name, json.dumps(args or {}, sort_keys=True))
        with _lock:
            if key in _results:
                _results.move_to_end(key)
                return _results[key]
        for attempt in range(3):
            client = self._client(url)
            try:
                result = client.query(self.app_id, name, args)
                break
            except DeviceError as e:
                if e.status != 404 or "unknown session" not in str(e) or attempt == 2:
                    raise
                # The scratch session is gone (server restart, or evicted by
                # another thread's view meanwhile): seed a new one.
                with _lock:
                    if _sessions.get((url, self.app_id, self._digest)) is client:
                        del _sessions[(url, self.app_id, self._digest)]
        with _lock:
            _results[key] = result
            while len(_results) > _RESULT_LIMIT:
                _results.popitem(last=False)
        return result

    def _client(self, url: str) -> DeviceClient:
        key = (url, self.app_id, self._digest or "")
        with _lock:
            client = _sessions.get(key)
            if client is not None:
                _sessions.move_to_end(key)
                return client
        client = DeviceClient.open(url, timeout=_TIMEOUT)
        try:
            client.put_state(self.app_id, self._state)
        except Exception:
            _close_quietly(client)
            raise
        evicted: list[DeviceClient] = []
        with _lock:
            existing = _sessions.get(key)
            if existing is not None:  # another thread seeded the same state meanwhile
                evicted.append(client)
                client = existing
            else:
                _sessions[key] = client
                while len(_sessions) > _SESSION_LIMIT:
                    evicted.append(_sessions.popitem(last=False)[1])
        for old in evicted:
            _close_quietly(old)
        return client


def _close_quietly(client: DeviceClient) -> None:
    try:
        client.close()
    except Exception:
        pass
