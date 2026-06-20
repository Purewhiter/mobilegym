"""Live scripted-plan verification for the Launcher suite."""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.registry import TaskRegistry
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
)

SUITE = "launcher"


def _task_class(name: str) -> type[BaseTask]:
    return TaskRegistry().get(SUITE, name)


def _suite_task_class_names() -> set[str]:
    return set(TaskRegistry()._load_suite_tasks(SUITE))


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("ChangeWallpaperAndAddWidget", lambda: _task_class("ChangeWallpaperAndAddWidget")()),
    ("DesktopAppsToFolder", lambda: _task_class("DesktopAppsToFolder")()),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = _suite_task_class_names()
    missing = declared - covered
    assert not missing, f"Launcher tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_launcher_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
