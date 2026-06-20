"""Live scripted-plan verification for the FileManager suite."""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.registry import TaskRegistry
from bench_env.tests.scripted_support import format_episode_result, run_scripted

SUITE = "file_manager"


def _make_task(name: str) -> BaseTask:
    return TaskRegistry().get(SUITE, name)()


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CreateKeepFolderAndDeleteRawLogs", lambda: _make_task("CreateKeepFolderAndDeleteRawLogs")),
    ("CleanObsoleteHandoffFiles", lambda: _make_task("CleanObsoleteHandoffFiles")),
    ("RenameEvidenceFilesByDate", lambda: _make_task("RenameEvidenceFilesByDate")),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = set(TaskRegistry().list_tasks(SUITE))
    missing = declared - covered
    assert not missing, f"FileManager tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_file_manager_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
