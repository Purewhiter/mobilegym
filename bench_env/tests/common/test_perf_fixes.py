"""Regression tests for the 64/128-concurrency performance fixes.

Covers (offline, no simulator needed):
- waitForData([]) semantics: task.setup must pass ``apps=[]`` through to
  ``env.reset(app_ids=[])`` unchanged (skip preload), instead of collapsing
  it to None (full preload) — the frontend contract is
  undefined/null=all, []=skip, [ids]=targeted.
- _get_state gz payload decode helper (b64 + gunzip + json.loads).
- Console listener noise reduction: verbose=False only records warning/error.
- screenshot_wire_scale: validation + passthrough to page.screenshot(scale=...).
- CLI topology guard: warn (only) when pages/contexts puts >8 pages on one browser.
"""

from __future__ import annotations

import base64
import gzip
import json

import pytest

from bench_env.env.base import Observation
from bench_env.env.mobile_gym import MobileGymEnv, _decode_gz_state
from bench_env.env.stopwatch import StopWatch
from bench_env.run import _topology_warning
from bench_env.task.base import BaseTask


# ── waitForData([]) call-chain semantics ──────────────────────────────


class _StubEnv:
    """Minimal env satisfying BaseTask.setup() (no sampler, no warm)."""

    supports_state_injection = True

    def __init__(self, apps_in_state: list[str] | None = None):
        self.stopwatch = StopWatch()
        self.reset_calls: list[list[str] | None] = []
        self.opened_apps: list[str] = []
        self._apps_in_state = apps_in_state or []

    async def reset(self, app_ids: list[str] | None = None) -> None:
        self.reset_calls.append(app_ids)

    async def open_app(self, app_name: str, timeout_ms: int = 8000, wait_stable: bool = False) -> None:
        self.opened_apps.append(app_name)

    async def get_state(self, *, required_apps: list[str] | None = None) -> dict:
        return {"os": {}, "apps": {app: {} for app in self._apps_in_state}}

    async def get_observation(self) -> Observation:
        return Observation(screenshot_bytes=b"", route={}, state={}, step_idx=0)


class _NoAppsTask(BaseTask):
    templates = ["stub task with no apps"]
    apps = []

    def check_goals(self, input):  # pragma: no cover - never judged here
        return []


class _OneAppTask(BaseTask):
    templates = ["stub task with one app"]
    apps = ["wechat"]

    def check_goals(self, input):  # pragma: no cover - never judged here
        return []


async def test_setup_passes_empty_apps_through_to_reset() -> None:
    """apps=[] must reach env.reset as [] (skip preload), not None (full preload)."""
    env = _StubEnv()

    await _NoAppsTask().setup(env)

    assert env.reset_calls == [[]]


async def test_setup_passes_nonempty_apps_through_to_reset() -> None:
    env = _StubEnv(apps_in_state=["wechat"])

    await _OneAppTask().setup(env)

    assert env.reset_calls == [["wechat"]]
    assert env.opened_apps == ["wechat"]


# ── _get_state gz decode (moved off the event loop) ──────────────────


def _gz_b64(payload: dict) -> str:
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return base64.b64encode(gzip.compress(raw)).decode("ascii")


def test_decode_gz_state_roundtrip() -> None:
    payload = {"os": {"time": 1}, "apps": {"wechat": {"contacts": ["张三"]}}}

    assert _decode_gz_state(_gz_b64(payload)) == payload


async def test_get_state_decodes_gz_payload_via_thread() -> None:
    payload = {"os": {}, "apps": {"redbook": {"posts": list(range(10))}}}

    class _FakePage:
        async def evaluate(self, script, arg=None):
            return {"mode": "gz", "data": _gz_b64(payload)}

    env = MobileGymEnv(url="http://localhost", verbose=False)
    env._page = _FakePage()  # type: ignore[assignment]

    assert await env._get_state() == payload


async def test_get_state_raw_mode_unchanged() -> None:
    payload = {"os": {}, "apps": {}}

    class _FakePage:
        async def evaluate(self, script, arg=None):
            return {"mode": "raw", "data": json.dumps(payload)}

    env = MobileGymEnv(url="http://localhost", verbose=False)
    env._page = _FakePage()  # type: ignore[assignment]

    assert await env._get_state() == payload


# ── Console listener noise reduction ──────────────────────────────────


class _RecordingLogger:
    def __init__(self):
        self.lines: list[str] = []

    def debug(self, msg):
        self.lines.append(msg)

    def info(self, msg):
        self.lines.append(msg)

    def warning(self, msg):
        self.lines.append(msg)


class _ListenerPage:
    def __init__(self):
        self.handlers: dict[str, object] = {}

    def on(self, event, cb):
        self.handlers[event] = cb


class _ConsoleMsg:
    def __init__(self, type_: str, text: str):
        self.type = type_
        self.text = text


def _emit_console(verbose: bool) -> list[str]:
    env = MobileGymEnv(url="http://localhost", verbose=verbose)
    page = _ListenerPage()
    env._page = page  # type: ignore[assignment]
    env._browser_logger = _RecordingLogger()  # type: ignore[assignment]
    env._attach_page_listeners()
    on_console = page.handlers["console"]
    for t in ("log", "info", "debug", "warning", "error"):
        on_console(_ConsoleMsg(t, f"msg-{t}"))
    return env._browser_logger.lines  # type: ignore[union-attr]


def test_console_listener_quiet_mode_records_only_warning_and_error() -> None:
    lines = _emit_console(verbose=False)

    assert len(lines) == 2
    assert any("console.warning" in l for l in lines)
    assert any("console.error" in l for l in lines)
    assert not any("console.log" in l or "console.info" in l or "console.debug" in l for l in lines)


def test_console_listener_verbose_mode_records_everything() -> None:
    lines = _emit_console(verbose=True)

    assert len(lines) == 5


# ── screenshot_wire_scale ─────────────────────────────────────────────


class _ScreenshotPage:
    def __init__(self):
        self.screenshot_kwargs: dict | None = None

    async def screenshot(self, **kwargs) -> bytes:
        self.screenshot_kwargs = kwargs
        return b"\xff\xd8fake-jpeg"

    async def evaluate(self, script, arg=None):
        return None  # _get_route → {}


async def test_screenshot_wire_scale_default_is_device() -> None:
    env = MobileGymEnv(url="http://localhost", verbose=False)
    page = _ScreenshotPage()
    env._page = page  # type: ignore[assignment]

    obs = await env._get_observation(include_state=False)

    assert page.screenshot_kwargs == {"type": "jpeg", "quality": 80, "scale": "device"}
    assert obs.screenshot_bytes == b"\xff\xd8fake-jpeg"


async def test_screenshot_wire_scale_css_is_passed_to_page_screenshot() -> None:
    env = MobileGymEnv(url="http://localhost", verbose=False, screenshot_wire_scale="css")
    page = _ScreenshotPage()
    env._page = page  # type: ignore[assignment]

    await env._get_observation(include_state=False)

    assert page.screenshot_kwargs["scale"] == "css"


def test_screenshot_wire_scale_rejects_invalid_value() -> None:
    with pytest.raises(ValueError, match="screenshot_wire_scale"):
        MobileGymEnv(url="http://localhost", verbose=False, screenshot_wire_scale="half")


# ── CLI topology guard (warning only) ─────────────────────────────────


def test_topology_warning_fires_for_single_browser_overload() -> None:
    warn = _topology_warning(parallel=64, processes=1, isolation="pages", num_browsers=0)

    assert warn is not None
    assert "--processes 8 --browsers 8" in warn
    assert "KNOWN_ISSUES.md §2" in warn


def test_topology_warning_respects_explicit_browsers() -> None:
    assert _topology_warning(parallel=64, processes=1, isolation="pages", num_browsers=8) is None


def test_topology_warning_counts_auto_browsers_per_process() -> None:
    # processes=8, browsers auto → 1 browser per shard = 8 total → 64/8 = 8 OK
    assert _topology_warning(parallel=64, processes=8, isolation="pages", num_browsers=0) is None


def test_topology_warning_ignores_browsers_isolation() -> None:
    assert _topology_warning(parallel=64, processes=1, isolation="browsers", num_browsers=0) is None


def test_topology_warning_ok_at_or_below_eight_pages() -> None:
    assert _topology_warning(parallel=8, processes=1, isolation="pages", num_browsers=0) is None
    assert _topology_warning(parallel=9, processes=1, isolation="contexts", num_browsers=0) is not None
