from __future__ import annotations

import pytest

from bench_env.env.base import Action, ActionType, Observation, StepResult
from bench_env.env.stopwatch import StopWatch
from bench_env.runner.base import Controller


def _make_obs(step_idx: int = 0) -> Observation:
    return Observation(
        screenshot_base64="",
        route={"app": "demo", "path": "/"},
        state={"apps": {}, "os": {}},
        step_idx=step_idx,
    )


class _VaryingWaitAgent:
    """Emits WAIT actions with a different duration on every call, the way a real
    agent does when it picks the wait length itself."""

    name = "varying-wait"

    def __init__(self) -> None:
        self.history: list = []
        self._n = 0

    def reset(self, task: str) -> None:
        self.task = task

    def act(self, obs: Observation) -> Action:
        self._n += 1
        return Action.wait(seconds=self._n * 0.1)


class _WaitTrackingEnv:
    def __init__(self) -> None:
        self._agent_answer: str | None = None
        self._agent_message: str | None = None
        self.stopwatch = StopWatch()

    async def get_state(self, *, required_apps: list[str] | None = None) -> dict:
        return {}

    async def step(self, action: Action) -> StepResult:
        if action.action_type == ActionType.WAIT:
            return StepResult(observation=_make_obs(1), done=False, info={})
        raise AssertionError(f"unexpected action: {action.action_type}")

    @property
    def agent_answer(self) -> str | None:
        return self._agent_answer

    @property
    def agent_message(self) -> str | None:
        return self._agent_message


class _TaskForController:
    id = "demo.WaitTask"
    description = "等待"
    suite = "demo"
    apps: list[str] = []

    def teardown(self, env) -> None:
        return None


@pytest.mark.asyncio
async def test_controller_run_detects_repetitive_wait_despite_varying_duration() -> None:
    env = _WaitTrackingEnv()
    agent = _VaryingWaitAgent()
    task = _TaskForController()

    exec_result, *_ = await Controller.run(
        env,
        agent,
        task,
        _make_obs(),
        max_steps=5,
        recorder=None,
        loop_threshold=3,
    )

    assert exec_result.truncated is True
    assert exec_result.stop_reason == "REPETITIVE_LOOP"
    assert exec_result.steps == 3
