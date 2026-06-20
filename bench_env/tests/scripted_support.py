"""Shared scripted-plan live verification helper.

Every suite replays ``PLANS`` through ``ScriptedAgent`` using the same
``BaseRunner.run_episode`` path as ``bench_env.run --agent scripted``:
grounded evaluation, ``COMPLETE`` termination, and ``EpisodeResult.success``
(``judge.passed`` = goal achieved with a clean diff).
"""

from __future__ import annotations

import json
from typing import Callable

from bench_env.agent.scripted import ScriptedAgent
from bench_env.config import RunnerConfig
from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.runner.base import BaseRunner, EpisodeResult, Evaluator
from bench_env.task.base import BaseTask
from bench_env.task.registry import TaskRegistry, suite_name_from_tasks_module

TaskFactory = Callable[[], BaseTask]


def suite_task_class_names(tasks_module) -> set[str]:
    """Every concrete ``BaseTask`` subclass declared in a suite's tasks module."""
    suite = suite_name_from_tasks_module(tasks_module)
    if suite:
        return set(TaskRegistry().list_tasks(suite))
    return {
        cls.__name__
        for cls in tasks_module.__dict__.values()
        if isinstance(cls, type)
        and issubclass(cls, BaseTask)
        and cls is not BaseTask
        and cls.__module__ == tasks_module.__name__
    }


def format_episode_result(result: EpisodeResult) -> str:
    payload = result.to_dict()
    return json.dumps(payload, ensure_ascii=False, indent=2, default=str)


def grounded_max_steps(task: BaseTask, *, explicit: int | None = None) -> int:
    """Step budget aligned with ``RunnerConfig.get_max_steps`` in grounded mode."""
    if explicit is not None:
        return explicit
    cfg = RunnerConfig(agent="scripted", model_name="scripted", eval_mode="grounded")
    return cfg.get_max_steps(task)


async def run_scripted(
    env: MobileGymEnv,
    task: BaseTask,
    *,
    suite: str,
    max_steps: int | None = None,
) -> EpisodeResult:
    """Run ``task`` through the full bench episode loop with ``ScriptedAgent``.

    Uses grounded evaluation (AnswerSheet UI) and returns the same
    ``EpisodeResult`` as ``bench_env.run --agent scripted``.
    """
    task._suite = suite
    agent = ScriptedAgent()
    evaluator = Evaluator(eval_mode="grounded")
    budget = grounded_max_steps(task, explicit=max_steps)
    return await BaseRunner.run_episode(
        env,
        agent,
        task,
        max_steps=budget,
        evaluator=evaluator,
    )
