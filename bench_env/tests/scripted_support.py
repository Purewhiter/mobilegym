"""Shared scripted-plan live verification helper.

Every suite verifies identically: ``ScriptedAgent`` reads the suite's ``PLANS``
(``bench_env/tests/<suite>/scripted_plans.py``), replays them through the real
GUI, and the task judge grades the resulting state. Suites supply only task
factories + plans; this drive loop is fixed here so no suite can get it subtly
wrong.
"""

from __future__ import annotations

import json
from typing import Callable

from bench_env.agent.scripted import ScriptedAgent
from bench_env.env.base import ActionType, Observation
from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput, JudgeResult

TaskFactory = Callable[[], BaseTask]


def suite_task_class_names(tasks_module) -> set[str]:
    """Every concrete ``BaseTask`` subclass declared in a suite's tasks module."""
    return {
        cls.__name__
        for cls in tasks_module.__dict__.values()
        if isinstance(cls, type)
        and issubclass(cls, BaseTask)
        and cls is not BaseTask
        and cls.__module__ == tasks_module.__name__
    }


def format_result(res: JudgeResult) -> str:
    return json.dumps(res.to_dict(), ensure_ascii=False, indent=2)


async def run_scripted(env: MobileGymEnv, task: BaseTask, *, suite: str, max_steps: int = 40) -> JudgeResult:
    """Drive ``task`` through the GUI via ScriptedAgent and return the judge result.

    Raises ``AssertionError`` if the plan aborts or never terminates — those are
    plan bugs, distinct from a judge rejection (which comes back as
    ``res.success is False``).
    """
    task._suite = suite  # so task.id == "<suite>.<ClassName>"
    init_obs = await task.setup(env)

    agent = ScriptedAgent()
    agent.set_task_context(task)
    agent.reset(task.description)

    obs = init_obs
    answer: str | None = None
    for _ in range(max_steps):
        action = agent.act(obs)
        at = action.action_type
        if at == ActionType.ANSWER:
            answer = str(action.data.get("value", ""))
            continue
        if at == ActionType.COMPLETE:
            break
        if at == ActionType.ABORT:
            raise AssertionError(f"[{task.id}] plan aborted: {action.summary}")
        obs = (await env.step(action)).observation
    else:
        raise AssertionError(f"[{task.id}] plan did not terminate within {max_steps} steps")

    curr_state = await env.get_state(required_apps=task.apps or None)
    curr_obs = Observation(state=curr_state, route=obs.route, step_idx=1)
    return task.evaluate(JudgeInput(init_obs=init_obs, last_obs=curr_obs, answer=answer))
