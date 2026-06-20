"""Live scripted-plan verification for the Contacts suite.

Contacts currently has no concrete task classes; this harness preserves the
same coverage contract as the scripted suites and will catch future additions.
"""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task import contacts as contacts_tasks
from bench_env.task.base import BaseTask
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "contacts"

SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = []


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(contacts_tasks)
    missing = declared - covered
    assert not missing, f"Contacts tasks without a scripted case: {sorted(missing)}"
    assert not declared, "Contacts currently has no concrete BaseTask subclasses"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_contacts_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
