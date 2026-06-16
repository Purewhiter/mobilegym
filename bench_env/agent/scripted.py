"""Generic scripted replay agent.

A deterministic, LLM-free agent that replays a per-task plan through the
*standard* GUI action space — the same ``env.step(Action(...))`` path every
other agent uses. Plans address controls by their stable ``data-trigger`` /
``data-action`` attributes (or by explicit normalized points); the environment
resolves a selector to a coordinate at ``step()`` time, so this agent stays a
plain synchronous "emit one Action per step" agent. It differs from a model
agent only in that ``act()`` reads the next scripted step instead of calling an
LLM.

Use it to prove a task is end-to-end solvable through the real GUI and that its
judge accepts the resulting state — complementary to store-level live tests
which bypass the UI.

Plans currently live as test assets under
``bench_env/tests/<suite>/scripted_plans.py`` (a module-level ``PLANS`` dict
keyed by full ``task.id``). Conceptually a task's script should ship with the
task; this location is temporary, so plan discovery is isolated in
``load_plan()`` below — only that function changes when the scripts move.
"""

from __future__ import annotations

import importlib
from typing import Any

from bench_env.agent.base import AgentConfig, AgentStepRecord, BaseAgent
from bench_env.env.base import Action, ActionType, Observation

Point = list[int]
Step = dict[str, Any]


# ---------------------------------------------------------------------------
# Plan authoring DSL — imported by tests/<suite>/scripted_plans.py
# ---------------------------------------------------------------------------

def tap_trigger(trigger_id: str, *, summary: str | None = None) -> Step:
    return {"op": "tap_trigger", "id": trigger_id, "summary": summary or f"tap trigger {trigger_id}"}


def tap_action(action_id: str, *, summary: str | None = None) -> Step:
    return {"op": "tap_action", "id": action_id, "summary": summary or f"tap action {action_id}"}


def tap(point: Point, *, summary: str | None = None) -> Step:
    return {"op": "click", "point": point, "summary": summary or f"tap {point}"}


def type_text(
    value: str,
    *,
    selector: str = "input",
    point: Point | None = None,
    clear: bool = False,
    summary: str | None = None,
) -> Step:
    step: Step = {"op": "type", "value": value, "clear": clear, "summary": summary or f"type {value!r}"}
    if point is None:
        step["selector"] = selector
    else:
        step["point"] = point
    return step


def swipe(point1: Point, point2: Point, *, summary: str | None = None) -> Step:
    return {"op": "swipe", "point1": point1, "point2": point2, "summary": summary or "swipe"}


def back(*, summary: str | None = None) -> Step:
    return {"op": "back", "summary": summary or "back"}


def wait(seconds: float, *, summary: str | None = None) -> Step:
    return {"op": "wait", "seconds": seconds, "summary": summary or f"wait {seconds}s"}


def answer(value: str, *, summary: str | None = None) -> Step:
    return {"op": "answer", "value": value, "summary": summary or "answer"}


def complete(message: str = "scripted task complete") -> Step:
    return {"op": "complete", "message": message, "summary": "complete"}


def abort(reason: str) -> Step:
    return {"op": "abort", "reason": reason, "summary": "abort"}


# ---------------------------------------------------------------------------
# Plan discovery + param rendering
# ---------------------------------------------------------------------------

def load_plan(task_id: str) -> list[Step] | None:
    """Return the scripted steps for ``task_id``, or ``None`` if none exist.

    ``task_id`` is ``"<suite>.<ClassName>"``; the suite selects the plan module
    ``bench_env.tests.<suite>.scripted_plans``, which must expose a module-level
    ``PLANS: dict[str, list[Step]]`` keyed by full task id.
    """
    suite = task_id.split(".", 1)[0] if task_id else ""
    if not suite:
        return None
    try:
        module = importlib.import_module(f"bench_env.tests.{suite}.scripted_plans")
    except ModuleNotFoundError:
        return None
    plans = getattr(module, "PLANS", None)
    if not isinstance(plans, dict):
        return None
    steps = plans.get(task_id)
    return list(steps) if isinstance(steps, list) else None


def _render(value: Any, params: dict[str, Any]) -> Any:
    """Recursively substitute ``{param}`` placeholders from ``task.params``.

    Strict on purpose: a missing/typo'd placeholder raises rather than silently
    leaving the literal ``{name}`` in the action — a validation agent must fail
    loudly when its plan and the task params disagree.
    """
    if isinstance(value, str):
        if "{" not in value:
            return value
        try:
            return value.format(**params)
        except (KeyError, IndexError, ValueError) as exc:
            raise ValueError(
                f"scripted plan placeholder {value!r} cannot be rendered "
                f"from params {sorted(params)}: {exc}"
            ) from exc
    if isinstance(value, list):
        return [_render(v, params) for v in value]
    if isinstance(value, dict):
        return {k: _render(v, params) for k, v in value.items()}
    return value


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class ScriptedAgent(BaseAgent):
    """Replay a per-task plan through the normal environment action space."""

    REQUIRES_LLM = False

    @property
    def name(self) -> str:
        return "scripted"

    def __init__(self, config: AgentConfig | None = None):
        super().__init__(config)
        self._task_id = ""
        self._task_params: dict[str, Any] = {}
        self._steps: list[Step] = []
        self._cursor = 0

    def set_task_context(self, task: Any) -> None:
        self._task_id = str(getattr(task, "id", "") or "")
        self._task_params = dict(getattr(task, "params", {}) or {})

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []
        self._cursor = 0

        raw = load_plan(self._task_id)
        if raw is None:
            self._steps = [abort(f"No scripted plan for task id={self._task_id!r}: {task}")]
            return
        self._steps = [_render(dict(step), self._task_params) for step in raw if isinstance(step, dict)]

    def build_messages(self, obs: Observation) -> list[dict]:
        return []  # No LLM prompt.

    def parse_response(self, response_text: str) -> Action:
        return Action.abort("ScriptedAgent.parse_response is not used")

    def _compile_step(self, step: Step) -> Action:
        op = str(step.get("op") or "").strip()
        summary = str(step.get("summary") or op or "scripted step")
        semantic = str(step.get("semantic") or op)

        if op == "tap_trigger":
            action = Action(ActionType.CLICK, {"selector": f'[data-trigger="{step["id"]}"]', "semantic": semantic})
        elif op == "tap_action":
            action = Action(ActionType.CLICK, {"selector": f'[data-action="{step["id"]}"]', "semantic": semantic})
        elif op in {"click", "tap"}:
            action = Action(ActionType.CLICK, {**_addressing(step), "semantic": semantic})
        elif op == "type":
            data = {"value": str(step.get("value", "")), "clear": bool(step.get("clear", False)), "semantic": semantic}
            data.update(_addressing(step))
            action = Action(ActionType.TYPE, data)
        elif op == "swipe":
            action = Action(ActionType.SWIPE, {"point1": step.get("point1"), "point2": step.get("point2"), "semantic": semantic})
        elif op == "drag":
            action = Action(ActionType.DRAG, {"point1": step.get("point1"), "point2": step.get("point2"), "semantic": semantic})
        elif op == "wait":
            action = Action.wait(float(step.get("seconds", 1.0)))
        elif op == "back":
            action = Action.back()
        elif op == "answer":
            action = Action.answer(str(step.get("value", "")))
        elif op == "complete":
            action = Action.complete(str(step.get("message", "scripted task complete")))
        elif op == "abort":
            action = Action.abort(str(step.get("reason", "scripted abort")))
        else:
            action = Action.abort(f"Unknown scripted op: {op!r}")

        action.summary = summary
        action.raw_response = f"[scripted] {summary}"
        return action

    def act(self, obs: Observation) -> Action:
        if self._cursor >= len(self._steps):
            step: Step = {"op": "abort", "reason": "Script exhausted before completion"}
        else:
            step = self._steps[self._cursor]
            self._cursor += 1

        action = self._compile_step(step)
        self._history.append(
            AgentStepRecord(
                step_idx=len(self._history) + 1,
                observation=obs,
                action=action,
                llm_response=action.raw_response,
                llm_prompt=[],
            )
        )
        return action


def _addressing(step: Step) -> dict[str, Any]:
    """Addressing for a tap/type step: an explicit point wins over a selector."""
    if step.get("point") is not None:
        return {"point": step["point"]}
    if step.get("selector"):
        return {"selector": str(step["selector"])}
    return {}
