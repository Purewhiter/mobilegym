"""Offline unit tests for the scripted replay agent (no browser).

Verify that plan steps compile to the right Actions and that plan discovery /
strict param rendering behave. Live, per-suite verification uses
``scripted_support.run_scripted`` (full ``run_episode``, grounded mode).
"""

from __future__ import annotations

import pytest

from bench_env.agent.scripted import (
    ScriptedAgent,
    _render,
    load_plan,
    tap_action,
    tap_trigger,
    type_text,
)
from bench_env.env.base import ActionType, Observation


def _obs() -> Observation:
    return Observation(screenshot_base64="", route={}, state={}, step_idx=0)


class _FakeTask:
    def __init__(self, task_id: str, params: dict | None = None):
        self.id = task_id
        self.params = params or {}


# ── compilation ─────────────────────────────────────────────────────

def test_tap_trigger_compiles_to_selector_click():
    action = ScriptedAgent()._compile_step(tap_trigger("create.open"))
    assert action.action_type == ActionType.CLICK
    assert action.data["selector"] == '[data-trigger="create.open"]'
    assert action.data.get("point") is None  # env resolves selector at step() time


def test_tap_action_compiles_to_action_selector():
    action = ScriptedAgent()._compile_step(tap_action("create.playlist.submit"))
    assert action.action_type == ActionType.CLICK
    assert action.data["selector"] == '[data-action="create.playlist.submit"]'


def test_type_text_carries_selector_and_clear():
    action = ScriptedAgent()._compile_step(type_text("hello", clear=True))
    assert action.action_type == ActionType.TYPE
    assert action.data["value"] == "hello"
    assert action.data["clear"] is True
    assert action.data["selector"] == "input"


def test_explicit_point_beats_selector():
    action = ScriptedAgent()._compile_step(type_text("x", point=[100, 200]))
    assert action.data["point"] == [100, 200]
    assert "selector" not in action.data


# ── plan discovery + param rendering ────────────────────────────────

def test_reset_loads_and_renders_plan():
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("spotify.CreateNewPlaylist", {"name": "MyList"}))
    agent.reset("desc")
    typed = [agent._compile_step(s) for s in agent._steps if s.get("op") == "type"]
    assert typed and typed[0].data["value"] == "MyList"


def test_missing_plan_yields_abort():
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("spotify.NoSuchTask"))
    agent.reset("desc")
    action = agent.act(_obs())
    assert action.action_type == ActionType.ABORT


def test_home_compiles_to_home_action():
    action = ScriptedAgent()._compile_step({"op": "home", "summary": "home"})
    assert action.action_type == ActionType.HOME


def test_unknown_suite_yields_none():
    assert load_plan("doesnotexist.Foo") is None


def test_render_is_strict_on_missing_param():
    with pytest.raises(ValueError):
        _render({"value": "{missing}"}, {"name": "x"})


def test_render_leaves_plain_strings_untouched():
    assert _render("no placeholder", {}) == "no placeholder"
