"""Regression tests for ParallelRunner._run_with_repeat failure handling.

Offline — uses fake env/agent/task, no simulator or browser required.

Covers:
1. task.setup() raising with repeat_n > 1 must produce exactly ONE error
   record whose error message is the original exception. A missing
   ``nonlocal`` on the pbar counters used to raise UnboundLocalError inside
   the setup-failure branch, which was re-caught by the outer handler and
   recorded the same (task, trial) twice with a bogus error message.
2. When every worker dies before draining the queue (agent_factory raises),
   the runner must fail fast with the original exception instead of
   deadlocking forever on ``queue.join()``.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from bench_env.config import RunnerConfig
from bench_env.runner.parallel import ParallelRunner


# ── Fakes ───────────────────────────────────────────────────────────


class _FakeEnv:
    def __init__(self) -> None:
        self.task_ids: list[str] = []

    def set_current_task(self, task_id: str) -> None:
        self.task_ids.append(task_id)


class _FakePool:
    """Minimal stand-in for EnvPool: only __getitem__ is exercised."""

    def __init__(self, n: int) -> None:
        self._envs = [_FakeEnv() for _ in range(n)]

    def __getitem__(self, idx: int) -> _FakeEnv:
        return self._envs[idx]


class _FakeAgent:
    def __init__(self) -> None:
        self.reset_history_calls = 0

    def reset_history(self) -> None:
        self.reset_history_calls += 1


class _SetupFailTask:
    """Task whose setup() always raises before touching the env."""

    id = "fake.setup_fail"
    suite = "fake"
    description = "task that always fails in setup"
    apps: list[str] = []
    params: dict[str, Any] = {}

    def __init__(self) -> None:
        self.teardown_calls = 0

    async def setup(self, env: Any) -> Any:
        raise RuntimeError("setup boom")

    def teardown(self, env: Any) -> None:
        self.teardown_calls += 1


def _make_config(repeat_n: int) -> RunnerConfig:
    return RunnerConfig(
        agent="test", model_name="test", quiet=True, repeat_n=repeat_n,
    )


# ── Tests ───────────────────────────────────────────────────────────


async def test_setup_failure_records_single_error_with_original_exception():
    """repeat_n>1 + setup() raising → exactly one error record, original message."""
    repeat_n = 3
    task = _SetupFailTask()
    agent = _FakeAgent()
    runner = ParallelRunner(
        env_pool=_FakePool(1),
        agent_factory=lambda: agent,
        tasks=[task],
        config=_make_config(repeat_n),
        recorder=None,
    )

    results = await asyncio.wait_for(
        runner._run_with_repeat(1, repeat_n, pbar=None), timeout=30
    )

    # Exactly ONE record for the failed setup — no duplicate from a
    # secondary UnboundLocalError being re-caught by the outer handler.
    assert len(results) == 1, (
        f"expected exactly 1 error record, got {len(results)}: "
        f"{[(r.task_id, r.trial_id, r.error) for r in results]}"
    )

    r = results[0]
    assert r.task_id == task.id
    assert r.trial_id == 0
    assert r.execution.stop_reason == "ERROR"
    # The recorded error must be the ORIGINAL setup exception, not a
    # follow-up artifact such as "UnboundLocalError: ...".
    assert r.error == "RuntimeError: setup boom"
    assert task.teardown_calls == 1


async def test_all_workers_dead_fails_fast_instead_of_deadlocking():
    """agent_factory raising in every worker must not hang queue.join()."""

    def _broken_agent_factory() -> Any:
        raise RuntimeError("no agent")

    runner = ParallelRunner(
        env_pool=_FakePool(2),
        agent_factory=_broken_agent_factory,
        tasks=[_SetupFailTask()],
        config=_make_config(2),
        recorder=None,
    )

    with pytest.raises(RuntimeError, match="no agent"):
        # Pre-fix this deadlocked forever; wait_for turns a regression into
        # a clean test failure instead of a hung test session.
        await asyncio.wait_for(runner._run_with_repeat(2, 2, pbar=None), timeout=30)
