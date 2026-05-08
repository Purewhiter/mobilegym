"""
Shared pytest fixtures for bench_env task testing.

Usage:
    # Run offline tests only (no simulator needed):
    pytest bench_env/tests/ -m "not live"

    # Run all tests (simulator must be running at localhost:3000):
    pytest bench_env/tests/

    # Override simulator URL:
    pytest bench_env/tests/ --sim-url http://localhost:3001
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.env.base import Observation
from bench_env.task.judge import JudgeInput


# ── CLI options ─────────────────────────────────────────────────────

def pytest_addoption(parser):
    parser.addoption(
        "--sim-url",
        default="http://localhost:3000",
        help="Simulator URL (default: http://localhost:3000)",
    )


# ── Markers ─────────────────────────────────────────────────────────

def pytest_configure(config):
    config.addinivalue_line("markers", "live: requires running simulator")


# ── Environment fixture (shared browser for all live tests) ────────────

@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def env(request) -> MobileGymEnv:
    url = request.config.getoption("--sim-url")
    e = MobileGymEnv(
        url=url,
        headless=True,
        coord_space="norm_0_1000",
        delay_after_action=0.3,
        verbose=False,
        viewport_size=(360, 800),
        physical_size=(1080, 2400),
        device_scale_factor=3,
    )
    await e.start()
    yield e
    await e.close()


# ── Defaults.json (for offline tests) ──────────────────────────────

@pytest.fixture(scope="session")
def railway_defaults() -> dict[str, Any]:
    p = Path(__file__).resolve().parents[2] / "apps" / "Railway12306" / "data" / "defaults.json"
    return json.loads(p.read_text(encoding="utf-8"))


# ── Helpers ─────────────────────────────────────────────────────────

def make_judge_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    init_route: dict[str, Any] | None = None,
    answer: str | None = None,
) -> JudgeInput:
    """Build a JudgeInput from raw state dicts.

    States should already contain the full structure, e.g.:
        {"apps": {"railway12306": {...}}, "os": {...}}

    ``route`` sets the *current* (last_obs) route.
    ``init_route`` sets the *initial* (init_obs) route; defaults to ``{}``
    so that init and curr routes are independent.
    """
    init_obs = Observation(
        screenshot_base64="",
        route=init_route or {},
        state=init_state,
        step_idx=0,
    )
    curr_obs = Observation(
        screenshot_base64="",
        route=route or {},
        state=curr_state,
        step_idx=1,
    )
    return JudgeInput(init_obs=init_obs, last_obs=curr_obs, answer=answer)
