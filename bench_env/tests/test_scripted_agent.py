"""Offline unit tests for the scripted replay agent (no browser).

Verify that plan steps compile to the right Actions and that plan discovery /
strict param rendering behave — including the lazy first-act materialization
(``Branch`` pick → ``DERIVED_PARAMS`` → render → macro expansion). Live,
per-suite verification uses ``scripted_support.run_scripted`` (full
``run_episode``, grounded mode).
"""

from __future__ import annotations

import pytest

from bench_env.agent.scripted import (
    Branch,
    ScriptedAgent,
    _render,
    assert_answer,
    assert_text,
    assert_visible,
    complete,
    load_derived_params,
    load_plan,
    tap_action,
    tap_trigger,
    type_text,
)
from bench_env.env.base import ActionType, Observation
from bench_env.env.mobile_gym import _scripted_answer_text_match


def _obs() -> Observation:
    return Observation(screenshot_base64="", route={}, state={}, step_idx=0)


class _FakeTask:
    def __init__(self, task_id: str, params: dict | None = None, answer_fields=None):
        self.id = task_id
        self.params = params or {}
        self.answer_fields = answer_fields


def _agent_with_fields(answer_fields) -> ScriptedAgent:
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("fake.AnswerTask", answer_fields=answer_fields))
    return agent


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


# ── assert steps (in-place self-verification) ───────────────────────

def test_assert_visible_step_structure():
    step = assert_visible('[data-trigger="pay.submit"]', summary="pay button on screen")
    assert step == {
        "op": "assert_visible",
        "selector": '[data-trigger="pay.submit"]',
        "timeout_ms": 3000,
        "summary": "pay button on screen",
    }
    assert assert_visible("input", timeout_ms=500, summary="s")["timeout_ms"] == 500


def test_assert_text_builds_scoped_text_selector():
    step = assert_text("时钟")
    assert step["op"] == "assert_visible"
    assert step["selector"] == '[data-adjust-resize] :text("时钟"):visible'
    assert step["timeout_ms"] == 3000
    assert step["summary"] == "assert on-screen: '时钟'"
    assert assert_text("首页", scope="#root")["selector"] == '#root :text("首页"):visible'


def test_assert_text_exact_switches_to_text_is():
    assert ':text-is("确定")' in assert_text("确定", exact=True)["selector"]
    assert ':text("确定")' in assert_text("确定", exact=False)["selector"]


def test_assert_text_escapes_playwright_quotes():
    step = assert_text('say "hi" \\ end')
    assert step["selector"] == '[data-adjust-resize] :text("say \\"hi\\" \\\\ end"):visible'


def test_assert_visible_compiles_to_noop_probe():
    action = ScriptedAgent()._compile_step(assert_visible("#ok", timeout_ms=1500, summary="ok visible"))
    assert action.action_type == ActionType.NOOP
    assert action.data["selector"] == "#ok"
    assert action.data["assert_timeout_ms"] == 1500
    assert action.data["semantic"] == "assert_visible"
    assert action.data.get("point") is None  # env resolves selector at step() time
    assert action.summary == "ok visible"


def test_assert_text_renders_params_via_first_act(monkeypatch):
    import bench_env.agent.scripted as scripted_mod

    plan = [assert_text("联系人 {name}"), complete()]
    monkeypatch.setattr(scripted_mod, "load_plan", lambda task_id: plan)
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("fake.AssertPlan", {"name": "张三"}))
    agent.reset("desc")
    action = agent.act(_obs())  # first act materializes + emits step 0
    assert action.action_type == ActionType.NOOP
    assert action.data["selector"] == '[data-adjust-resize] :text("联系人 张三"):visible'
    assert action.data["semantic"] == "assert_visible"


# ── assert_answer (judge-matcher reuse) ─────────────────────────────

def test_assert_answer_step_structure():
    step = assert_answer("100023.46")
    assert step == {
        "op": "assert_answer",
        "value": "100023.46",
        "field_index": 0,
        "scope": "[data-adjust-resize]",
        "summary": "assert answer on-screen: '100023.46'",
    }
    custom = assert_answer("x", field_index=2, scope="#root", summary="s")
    assert (custom["field_index"], custom["scope"], custom["summary"]) == (2, "#root", "s")


def test_assert_answer_compiles_with_derived_number_kind():
    agent = _agent_with_fields([{"type": "number", "label": "总资产"}])
    action = agent._compile_step(assert_answer("100023.46"))
    assert action.action_type == ActionType.NOOP
    assert action.data == {
        "assert_answer_value": "100023.46",
        "assert_matcher_kind": "number",
        "assert_scope": "[data-adjust-resize]",
        "assert_timeout_ms": 3000,
        "semantic": "assert_visible",
    }
    assert "selector" not in action.data and action.data.get("point") is None


def test_assert_answer_kind_prefers_explicit_matcher_key():
    agent = _agent_with_fields([
        {"type": "text", "label": "结束时间", "matcher": "time"},
        {"type": "text", "label": "日期", "matcher": "date"},
    ])
    assert agent._compile_step(assert_answer("11:00")).data["assert_matcher_kind"] == "time"
    assert (
        agent._compile_step(assert_answer("2026-08-13", field_index=1)).data["assert_matcher_kind"]
        == "date"
    )


def test_assert_answer_kind_defaults_by_field_type():
    agent = _agent_with_fields([
        {"type": "text", "label": "天气状况"},
        {"type": "choice", "label": "选项", "options": ["a", "b"]},
    ])
    assert agent._compile_step(assert_answer("阴")).data["assert_matcher_kind"] == "exact"
    assert agent._compile_step(assert_answer("a", field_index=1)).data["assert_matcher_kind"] == "exact"


def test_assert_answer_supports_dict_answer_fields_format():
    agent = _agent_with_fields(
        {"question": "余额是多少？", "fields": [{"type": "number", "label": "余额"}]}
    )
    assert agent._compile_step(assert_answer("42")).data["assert_matcher_kind"] == "number"


def test_assert_answer_without_answer_fields_raises():
    agent = _agent_with_fields(None)
    with pytest.raises(ValueError, match="declares none"):
        agent._compile_step(assert_answer("42"))


def test_assert_answer_field_index_out_of_range_raises():
    agent = _agent_with_fields([{"type": "number", "label": "x"}])
    with pytest.raises(ValueError, match="out of range"):
        agent._compile_step(assert_answer("42", field_index=1))


def test_assert_answer_non_numeric_value_for_number_field_raises():
    agent = _agent_with_fields([{"type": "number", "label": "x"}])
    with pytest.raises(ValueError, match="not numeric"):
        agent._compile_step(assert_answer("26°C"))
    # Thousands separators are accepted for number values.
    assert agent._compile_step(assert_answer("100,023.46")).data["assert_answer_value"] == "100,023.46"


def test_assert_answer_renders_params_via_first_act(monkeypatch):
    import bench_env.agent.scripted as scripted_mod

    plan = [assert_answer("{amount}"), complete()]
    monkeypatch.setattr(scripted_mod, "load_plan", lambda task_id: plan)
    agent = ScriptedAgent()
    agent.set_task_context(
        _FakeTask("fake.AnswerPlan", {"amount": "88.5"}, answer_fields=[{"type": "number"}])
    )
    agent.reset("desc")
    action = agent.act(_obs())  # first act materializes + emits step 0
    assert action.data["assert_answer_value"] == "88.5"
    assert action.data["semantic"] == "assert_visible"


# ── assert_answer matcher dispatch (env-side pure function) ─────────

def test_answer_match_number_tolerates_thousands_separators_and_units():
    assert _scripted_answer_text_match("number", "100023.46", "总资产 100,023.46 元")
    assert _scripted_answer_text_match("number", "100,023.46", "100023.46")
    assert _scripted_answer_text_match("number", "26", "26°C")
    assert not _scripted_answer_text_match("number", "999999", "总资产 100,023.46 元")
    assert not _scripted_answer_text_match("number", "100023.46", "余额 ****")


def test_answer_match_time_reuses_judge_tolerance():
    assert _scripted_answer_text_match("time", "3:59", "当前时间 03:59")
    assert _scripted_answer_text_match("time", "03:59", "3:59")
    assert _scripted_answer_text_match("time", "13:10", "下午1点10分")
    assert _scripted_answer_text_match("time", "10:00", "10:03")  # judge ±5min
    assert not _scripted_answer_text_match("time", "03:59", "16:00")


def test_answer_match_date_uses_absolute_labels():
    assert _scripted_answer_text_match("date", "2026-08-13", "8月13日 周四 晴")
    assert _scripted_answer_text_match("date", "2026-08-13", "2026-08-13")
    assert _scripted_answer_text_match("date", "8月13日", "8月13日 多云")
    assert not _scripted_answer_text_match("date", "2026-08-13", "8月14日 晴")
    # Digit boundary: "1日" label must not hit "11日".
    assert not _scripted_answer_text_match("date", "2026-08-01", "8月11日")


def test_answer_match_duration_normalizes_units():
    assert _scripted_answer_text_match("duration", "1小时30分", "时长 90分钟")
    assert _scripted_answer_text_match("duration", "90分钟", "1小时30分")
    assert _scripted_answer_text_match("duration", "59分", "0小时59分")
    assert not _scripted_answer_text_match("duration", "30分钟", "1小时")


def test_answer_match_exact_is_normalized_containment():
    assert _scripted_answer_text_match("exact", "阴", "今天 多云转阴 26°C")
    assert _scripted_answer_text_match("exact", "3小时", "三小时后提醒")  # Chinese numerals
    assert _scripted_answer_text_match("exact", "夜 曲", "夜曲 - 周杰伦")  # whitespace-tolerant
    assert not _scripted_answer_text_match("exact", "晴", "阴天")
    assert not _scripted_answer_text_match("exact", "阴", "")


def test_answer_match_exact_tc_converts_traditional():
    assert _scripted_answer_text_match("exact_tc", "陈奕迅", "陳奕迅 Eason Chan")
    assert not _scripted_answer_text_match("exact_tc", "周杰伦", "陳奕迅")


# ── plan discovery + param rendering ────────────────────────────────

def test_first_act_materializes_real_plan():
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("spotify.CreateNewPlaylist", {"name": "MyList"}))
    agent.reset("desc")
    assert agent._steps is None  # raw plan loaded, nothing rendered yet
    agent.act(_obs())
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


# ── lazy materialization (sampling-path compatibility) ──────────────

def _state_obs(state: dict) -> Observation:
    return Observation(screenshot_base64="", route={}, state=state, step_idx=0)


def test_reset_defers_materialization_to_first_act(monkeypatch):
    import bench_env.agent.scripted as scripted_mod

    calls = {"derived": 0}

    def counting_derived(task_id):
        calls["derived"] += 1
        return {}

    monkeypatch.setattr(scripted_mod, "load_plan", lambda tid: [type_text("{name}"), complete()])
    monkeypatch.setattr(scripted_mod, "load_derived_params", counting_derived)
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("fake.Lazy", {"name": "N1"}))
    agent.reset("desc")
    assert agent._steps is None  # nothing rendered at reset time

    first = agent.act(_obs())
    assert first.data["value"] == "N1"
    materialized = agent._steps
    assert materialized is not None and calls["derived"] == 1

    second = agent.act(_obs())
    assert second.action_type == ActionType.COMPLETE
    assert agent._steps is materialized and calls["derived"] == 1  # materialize ran once


def test_materialization_missing_param_raises_loudly(monkeypatch):
    import bench_env.agent.scripted as scripted_mod

    monkeypatch.setattr(scripted_mod, "load_plan", lambda tid: [type_text("{missing}")])
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("fake.Missing"))
    agent.reset("desc")  # lazy: reset itself must not raise
    # The runner catches act() exceptions and ends the episode as ERROR —
    # same loud-failure semantics render errors had in reset().
    with pytest.raises(ValueError, match="cannot be rendered"):
        agent.act(_obs())


# ── DERIVED_PARAMS channel ───────────────────────────────────────────

def test_derived_params_computed_from_task_and_initial_state(monkeypatch):
    import bench_env.agent.scripted as scripted_mod

    plan = [type_text("{answer}"), type_text("{extra}"), complete()]
    derived = {
        "answer": lambda task, state: f"{state['apps']['clock']['count']}",
        "extra": lambda task, state: f"{task.id}-extra",
    }
    monkeypatch.setattr(scripted_mod, "load_plan", lambda tid: plan)
    monkeypatch.setattr(scripted_mod, "load_derived_params", lambda tid: dict(derived))
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("fake.Derived"))
    agent.reset("desc")
    obs = _state_obs({"apps": {"clock": {"count": 7}}})
    assert agent.act(obs).data["value"] == "7"  # computed from first-act obs.state
    assert agent.act(obs).data["value"] == "fake.Derived-extra"  # task object reaches fn


def test_injected_params_win_over_derived(monkeypatch):
    import bench_env.agent.scripted as scripted_mod

    def must_not_run(task, state):
        raise AssertionError("calculator must be skipped when the param is injected")

    monkeypatch.setattr(scripted_mod, "load_plan", lambda tid: [type_text("{answer}"), complete()])
    monkeypatch.setattr(scripted_mod, "load_derived_params", lambda tid: {"answer": must_not_run})
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("fake.Injected", {"answer": "injected"}))
    agent.reset("desc")
    assert agent.act(_obs()).data["value"] == "injected"


def test_load_derived_params_discovery_and_instance_suffix(monkeypatch):
    import sys
    import types

    def fn(task, state):
        return "v"

    mod = types.ModuleType("bench_env.tests.fakesuite.scripted_plans")
    mod.DERIVED_PARAMS = {"fakesuite.Foo": {"answer": fn}}
    monkeypatch.setitem(sys.modules, "bench_env.tests.fakesuite.scripted_plans", mod)

    assert load_derived_params("fakesuite.Foo") == {"answer": fn}
    assert load_derived_params("fakesuite.Foo_i2") == {"answer": fn}  # _i{n} fallback
    assert load_derived_params("fakesuite.Bar") == {}
    assert load_derived_params("nosuchsuite.Foo") == {}


def test_suites_without_derived_params_table_yield_empty():
    assert load_derived_params("spotify.CreateNewPlaylist") == {}


# ── Branch (restricted conditional plans) ────────────────────────────

def _branch_plan() -> Branch:
    return Branch(
        pick=lambda task, state: "on" if state.get("flag") else "off",
        branches={
            "on": [type_text("enabled-{name}"), complete()],
            "off": [type_text("disabled-{name}"), complete()],
        },
    )


def test_load_plan_returns_branch_raw(monkeypatch):
    import sys
    import types

    branch = _branch_plan()
    mod = types.ModuleType("bench_env.tests.fakesuite.scripted_plans")
    mod.PLANS = {"fakesuite.Foo": branch}
    monkeypatch.setitem(sys.modules, "bench_env.tests.fakesuite.scripted_plans", mod)
    assert load_plan("fakesuite.Foo") is branch
    assert load_plan("fakesuite.Foo_i3") is branch


def test_branch_pick_routes_on_initial_state(monkeypatch):
    import bench_env.agent.scripted as scripted_mod

    monkeypatch.setattr(scripted_mod, "load_plan", lambda tid: _branch_plan())
    for flag, expected in ((True, "enabled-X"), (False, "disabled-X")):
        agent = ScriptedAgent()
        agent.set_task_context(_FakeTask("fake.Branchy", {"name": "X"}))
        agent.reset("desc")
        assert agent.act(_state_obs({"flag": flag})).data["value"] == expected


def test_branch_key_audited_on_first_action_only(monkeypatch):
    import bench_env.agent.scripted as scripted_mod

    monkeypatch.setattr(scripted_mod, "load_plan", lambda tid: _branch_plan())
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("fake.Branchy", {"name": "X"}))
    agent.reset("desc")
    obs = _state_obs({"flag": True})
    first = agent.act(obs)
    assert first.raw_response.endswith("[branch=on]")
    assert agent.history[-1].llm_response.endswith("[branch=on]")  # lands in trajectory
    second = agent.act(obs)
    assert "[branch=" not in second.raw_response


def test_branch_pick_unknown_key_fails_loudly(monkeypatch):
    import bench_env.agent.scripted as scripted_mod

    bad = Branch(pick=lambda task, state: "nope", branches={"on": [complete()]})
    monkeypatch.setattr(scripted_mod, "load_plan", lambda tid: bad)
    agent = ScriptedAgent()
    agent.set_task_context(_FakeTask("fake.Branchy"))
    agent.reset("desc")
    with pytest.raises(ValueError, match="not one of"):
        agent.act(_obs())
