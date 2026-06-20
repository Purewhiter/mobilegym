"""Generic scripted replay agent.

A deterministic, LLM-free agent that replays a per-task plan through the
*standard* GUI action space — the same ``env.step(Action(...))`` path every
other agent uses.

- **Control actions** (``HOME``, ``BACK``, ``AWAKE``, ``WAIT``, …) are emitted
  as-is — e.g. cross-app flows use ``AWAKE`` / ``home()`` like model agents that
  output ``Launch`` / ``AWAKE``, not desktop icon coordinates.
- **In-app pointer actions** use ``data-trigger`` / ``data-action``, explicit
  ``point``, or a ``selector`` locator; ``MobileGymEnv.step()`` resolves any
  ``selector`` to a ``point`` and executes via ``__SIM_INPUT__.tap`` (never
  Playwright DOM click), matching the coordinate path a vision agent takes.

This agent stays a plain synchronous "emit one Action per step" agent; it
differs from a model agent only in that ``act()`` reads the next scripted step
instead of calling an LLM.

Use it to prove a task is end-to-end solvable through the real GUI and that its
judge accepts the resulting state — complementary to store-level live tests
which bypass the UI.

In **grounded mode** (the default for bench and for ``test_scripted.py``), plans
must submit answers through the AnswerSheet app UI via ``grounded_answer`` /
``grounded_answer_repeatable`` — not the legacy ``ANSWER`` action.

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


def keypad_text(
    value: str,
    *,
    press_action: str,
    param: str = "digit",
    input_selector: str | None = None,
    toggle_action: str | None = None,
    summary: str | None = None,
) -> Step:
    """Enter a rendered value through an on-screen keypad action, one key at a time."""
    step: Step = {
        "op": "keypad_text",
        "value": value,
        "press_action": press_action,
        "param": param,
        "summary": summary or f"enter keypad text {value!r}",
    }
    if input_selector is not None:
        step["input_selector"] = input_selector
    if toggle_action is not None:
        step["toggle_action"] = toggle_action
    return step


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


def enter(*, summary: str | None = None) -> Step:
    """Dispatch Enter to the focused element (commits inputs with onKeyDown=Enter)."""
    return {"op": "enter", "summary": summary or "press enter"}


def home(*, summary: str | None = None) -> Step:
    return {"op": "home", "summary": summary or "home"}


def awake(app: str, *, summary: str | None = None) -> Step:
    """Launch an app by name/id — standard ``AWAKE`` action (same as model ``Launch``)."""
    return {"op": "awake", "app": app, "summary": summary or f"open {app}"}


def wait(seconds: float, *, summary: str | None = None) -> Step:
    return {"op": "wait", "seconds": seconds, "summary": summary or f"wait {seconds}s"}


def tap_at(selector: str, *, summary: str) -> Step:
    """Locate a visible component by selector; env resolves to a coordinate CLICK."""
    return {"op": "click", "selector": selector, "summary": summary}


# Back-compat alias used by suite plans.
click_selector = tap_at


def long_press_at(selector: str, *, summary: str, duration_ms: int = 800) -> Step:
    """Locate a visible component by selector; env resolves to a coordinate LONG_PRESS."""
    return {"op": "long_press", "selector": selector, "duration_ms": duration_ms, "summary": summary}


def swipe_up(*, x: int = 500, from_y: int = 750, to_y: int = 250, summary: str = "swipe up") -> Step:
    return swipe([x, from_y], [x, to_y], summary=summary)


def swipe_feed(*, times: int = 1, summary_prefix: str = "scroll discover feed") -> list[Step]:
    """Vertical swipes on the home discover feed (norm_0_1000 coordinates)."""
    return [swipe_up(summary=f"{summary_prefix} {i + 1}/{times}") for i in range(times)]


def tap_at_after_scroll(selector: str, *, swipes: int = 0, summary: str) -> list[Step]:
    """Optional feed scroll, then tap_at — same locate→coordinate path as a vision agent."""
    steps: list[Step] = swipe_feed(times=swipes) if swipes > 0 else []
    steps.append(tap_at(selector, summary=summary))
    return steps


def _answer_sheet_input(index: int) -> str:
    """One input per non-repeatable field block (Playwright resolves .first itself)."""
    return f'[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child({index + 1}) input'


def _answer_sheet_repeatable_input(row: int) -> str:
    """Input inside the first (repeatable) field block; ``row`` is 0-based."""
    return (
        f'[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child(1) '
        f'div.flex.items-center:nth-child({row + 1}) input'
    )


def open_answer_sheet() -> list[Step]:
    """Open AnswerSheet via standard ``AWAKE`` (grounded mode)."""
    return [
        home(summary="return to launcher"),
        awake("答题卡", summary="open AnswerSheet app"),
        wait(0.8, summary="wait for answer sheet UI"),
    ]


def submit_answer_sheet(*, summary: str | None = None) -> Step:
    return tap_at(
        'div[data-hide-on-keyboard] button.w-full.bg-blue-500:visible',
        summary=summary or "submit answer sheet",
    )


def _dismiss_answer_sheet_keyboard() -> Step:
    """System back dismisses the keyboard (BackDispatcher priority 700) without leaving the app."""
    return back(summary="dismiss keyboard to show submit bar")


def grounded_answer(*values: str, summary: str | None = None) -> list[Step]:
    """Fill one or more AnswerSheet fields and submit (grounded mode)."""
    steps = open_answer_sheet()
    for index, value in enumerate(values):
        steps.append(
            type_text(
                value,
                selector=_answer_sheet_input(index),
                clear=True,
                summary=f"fill answer field {index}: {value!r}",
            )
        )
    steps.append(_dismiss_answer_sheet_keyboard())
    steps.append(submit_answer_sheet(summary=summary))
    return steps


def grounded_answer_repeatable(*values: str, summary: str | None = None) -> list[Step]:
    """Fill a repeatable AnswerSheet field (one row per value) and submit."""
    add_row = 'button.border-dashed.border-slate-300:visible'
    steps = open_answer_sheet()
    for index, value in enumerate(values):
        # Repeatable fields start empty — each row must be created via "Add item".
        steps.append(tap_at(add_row, summary=f"add answer sheet row {index}"))
        steps.append(wait(0.2, summary="wait for repeatable row"))
        steps.append(
            type_text(
                value,
                selector=_answer_sheet_repeatable_input(index),
                clear=True,
                summary=f"fill repeatable answer row {index}: {value!r}",
            )
        )
    steps.append(_dismiss_answer_sheet_keyboard())
    steps.append(submit_answer_sheet(summary=summary))
    return steps


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


def _with_derived_params(task_id: str, params: dict[str, Any]) -> dict[str, Any]:
    """Add small UI-label aliases used by static scripted plans."""
    if not task_id.startswith("calendar."):
        return params
    try:
        from bench_env.task.calendar.app import (
            CALENDAR_ALLDAY_REMINDER_VALUES,
            CALENDAR_DEFAULT_REMINDER_VALUES,
            CALENDAR_EVENT_REMINDER_VALUES,
            CALENDAR_LATER_REMINDER_VALUES,
        )
    except Exception:
        return params

    derived = dict(params)

    def add_label(source: str, target: str, mapping: dict[str, Any]) -> None:
        if target in derived or source not in derived:
            return
        wanted = derived[source]
        for label, value in mapping.items():
            if value == wanted:
                derived[target] = label
                return

    add_label("reminder", "reminderLabel", CALENDAR_DEFAULT_REMINDER_VALUES)
    add_label("reminder", "reminderChoice", CALENDAR_EVENT_REMINDER_VALUES)
    add_label("r1", "r1Label", CALENDAR_DEFAULT_REMINDER_VALUES)
    add_label("r2", "r2Label", CALENDAR_ALLDAY_REMINDER_VALUES)
    add_label("r3", "r3Label", CALENDAR_LATER_REMINDER_VALUES)
    return derived


def _expand_step_macros(steps: list[Step]) -> list[Step]:
    expanded: list[Step] = []
    for step in steps:
        if step.get("op") == "wheel_scroll":
            current = int(step.get("current", 0))
            target = int(step.get("target", current))
            modulo = int(step.get("modulo", 0))
            selector = str(step["selector"])
            if modulo <= 0:
                delta = target - current
            else:
                delta = (target - current) % modulo
                if delta > modulo / 2 or (delta == modulo / 2 and step.get("prefer_reverse_half")):
                    delta -= modulo
            if delta == 0:
                continue
            start_y = float(step.get("start_y_fraction", 0.55))
            end_y = float(step.get("end_y_fraction", 0.416))
            reverse_start_y = float(step.get("reverse_start_y_fraction", 0.45))
            reverse_end_y = float(step.get("reverse_end_y_fraction", 0.584))
            max_delta_per_swipe = max(1, int(step.get("max_delta_per_swipe", 1)))
            delta_y_fraction = float(step.get("delta_y_fraction", abs(start_y - end_y)))
            remaining = abs(delta)
            index = 0
            while remaining > 0:
                chunk = min(max_delta_per_swipe, remaining)
                if delta > 0:
                    syf = start_y
                    eyf = max(0.02, start_y - delta_y_fraction * chunk)
                else:
                    syf = reverse_start_y
                    eyf = min(0.98, reverse_start_y + delta_y_fraction * chunk)
                expanded.append(
                    {
                        "op": "swipe",
                        "selector": selector,
                        "start_fraction": float(step.get("x_fraction", 0.5)),
                        "end_fraction": float(step.get("x_fraction", 0.5)),
                        "start_y_fraction": syf,
                        "end_y_fraction": eyf,
                        "duration_ms": int(step.get("duration_ms", 260)),
                        "inertia": bool(step.get("inertia", False)),
                        "summary": (
                            f"{step.get('summary') or 'scroll wheel'} "
                            f"{index + 1}/{abs(delta)}"
                        ),
                    }
                )
                index += chunk
                remaining -= chunk
            continue

        if step.get("op") != "keypad_text":
            expanded.append(step)
            continue

        value = str(step.get("value", ""))
        press_action = str(step["press_action"])
        param = str(step.get("param") or "digit")
        input_selector = step.get("input_selector")
        if input_selector:
            expanded.append(
                {
                    "op": "click",
                    "selector": str(input_selector),
                    "summary": step.get("focus_summary") or "focus keypad input",
                }
            )
        for index, char in enumerate(value, start=1):
            expanded.append(
                {
                    "op": "click",
                    "selector": f'[data-action="{press_action}"][data-action-params*=\'"{param}":"{char}"\']:visible',
                    "summary": f"{step.get('summary') or 'enter keypad text'} key {index}: {char}",
                }
            )
        toggle_action = step.get("toggle_action")
        if toggle_action:
            expanded.append(
                {
                    "op": "tap_action",
                    "id": str(toggle_action),
                    "summary": step.get("toggle_summary") or "hide keypad",
                }
            )
    return expanded


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
        self._task_params = _with_derived_params(self._task_id, dict(getattr(task, "params", {}) or {}))

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []
        self._cursor = 0

        raw = load_plan(self._task_id)
        if raw is None:
            self._steps = [abort(f"No scripted plan for task id={self._task_id!r}: {task}")]
            return
        rendered_steps = [_render(dict(step), self._task_params) for step in raw if isinstance(step, dict)]
        self._steps = _expand_step_macros(rendered_steps)

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
        elif op == "long_press":
            action = Action(
                ActionType.LONG_PRESS,
                {**_addressing(step), "duration": int(step.get("duration_ms", 800)), "semantic": semantic},
            )
        elif op == "type":
            data = {"value": str(step.get("value", "")), "clear": bool(step.get("clear", False)), "semantic": semantic}
            data.update(_addressing(step))
            action = Action(ActionType.TYPE, data)
        elif op == "swipe":
            data = {"point1": step.get("point1"), "point2": step.get("point2"), "semantic": semantic}
            if step.get("selector"):
                data["selector"] = str(step["selector"])
            for key in ("start_fraction", "end_fraction", "to_fraction", "y_fraction", "start_y_fraction", "end_y_fraction"):
                if step.get(key) is not None:
                    data[key] = float(step[key])
            if step.get("end_space") is not None:
                data["end_space"] = str(step["end_space"])
            if step.get("duration_ms") is not None:
                data["duration"] = int(step["duration_ms"])
            elif step.get("duration") is not None:
                data["duration"] = int(step["duration"])
            if step.get("inertia") is not None:
                data["inertia"] = bool(step["inertia"])
            if step.get("inertia_ms") is not None:
                data["inertia_ms"] = int(step["inertia_ms"])
            if step.get("inertia_decay") is not None:
                data["inertia_decay"] = float(step["inertia_decay"])
            action = Action(ActionType.SWIPE, data)
        elif op == "drag":
            data = {"point1": step.get("point1"), "point2": step.get("point2"), "semantic": semantic}
            if step.get("selector"):
                data["selector"] = str(step["selector"])
            for key in ("start_fraction", "end_fraction", "to_fraction", "y_fraction", "start_y_fraction", "end_y_fraction"):
                if step.get(key) is not None:
                    data[key] = float(step[key])
            if step.get("end_space") is not None:
                data["end_space"] = str(step["end_space"])
            if step.get("duration_ms") is not None:
                data["duration"] = int(step["duration_ms"])
            elif step.get("duration") is not None:
                data["duration"] = int(step["duration"])
            action = Action(ActionType.DRAG, data)
        elif op == "wait":
            action = Action.wait(float(step.get("seconds", 1.0)))
        elif op == "back":
            action = Action.back()
        elif op == "enter":
            action = Action(ActionType.ENTER, {"semantic": semantic})
        elif op == "home":
            action = Action.home()
        elif op == "awake":
            action = Action(ActionType.AWAKE, {"value": str(step.get("app", "")), "semantic": semantic})
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
