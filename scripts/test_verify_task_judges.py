#!/usr/bin/env python3
"""
verify_task_judges.py 的单元测试。

用 mock 任务类和 mock 数据验证各检查函数本身的正确性。

运行:
    python scripts/test_verify_task_judges.py
"""

from __future__ import annotations

import sys
import textwrap
import tempfile
from pathlib import Path
from typing import Any, ClassVar

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from bench_env.task.base import BaseTask, BaseApp
from bench_env.task.common_tasks import CriteriaTask, AnswerTask
from bench_env.task.judge import JudgeInput
from bench_env.env.base import Observation

from scripts.verify_task_judges import (
    Report, path_exists_in, set_by_path, make_observation,
    check_criteria_paths, check_criteria_negative, check_criteria_positive,
    check_answer_task, check_expected_changes_coverage, check_custom_goals_crash,
)


# ============================================================================
# Test infrastructure
# ============================================================================

passed = 0
failed = 0

def assert_eq(actual, expected, msg=""):
    global passed, failed
    if actual == expected:
        passed += 1
    else:
        failed += 1
        print(f"  FAIL: {msg}")
        print(f"    expected: {expected!r}")
        print(f"    actual:   {actual!r}")


def assert_true(cond, msg=""):
    assert_eq(cond, True, msg)


def assert_false(cond, msg=""):
    assert_eq(cond, False, msg)


def section(name):
    print(f"\n--- {name} ---")


# ============================================================================
# Mock defaults
# ============================================================================

MOCK_DEFAULTS = {
    "user": {"name": "小明", "pat": "", "wxid": "wxid_test"},
    "settings": {
        "general": {
            "darkMode": False,
            "followSystem": True,
            "mobileAutoPlay": True,
        },
        "privacy": {
            "friendConfirmation": True,
            "momentsRange": "全部",
            "addMeMethods": {"searchByPhone": True, "searchByWxid": True},
        },
        "discover": {
            "moments": {"visible": True},
        },
    },
    "contacts": [
        {"wxid": "wxid_a", "name": "张三"},
        {"wxid": "wxid_b", "name": "李四"},
    ],
    "moments": [],
    "chats": [
        {"id": "wxid_a", "messages": []},
    ],
}


# ============================================================================
# Mock task classes
# ============================================================================

class _MockCriteriaTaskPass(CriteriaTask):
    """A CriteriaTask whose criteria should become True after set_by_path."""
    template = "关闭好友验证"
    app = "mockapp"
    criteria = {"settings.privacy.friendConfirmation": False}


class _MockCriteriaTaskWithRoute(CriteriaTask):
    """CriteriaTask with route + state criteria."""
    template = "打开设置并关闭暗色模式"
    app = "mockapp"
    criteria = {
        "route": "/settings",
        "settings.general.darkMode": True,
    }


class _MockCriteriaTaskAlreadySatisfied(CriteriaTask):
    """Criteria that is already True in the default state."""
    template = "确认好友验证已开启"
    app = "mockapp"
    criteria = {"settings.privacy.friendConfirmation": True}


class _MockCriteriaTaskBadPath(CriteriaTask):
    """Criteria with a path that doesn't exist in defaults."""
    template = "设置不存在的路径"
    app = "mockapp"
    criteria = {"settings.nonexistent.deepPath": True}


class _MockCriteriaTaskTypeMismatch(CriteriaTask):
    """Criteria where expected type != actual type."""
    template = "类型不匹配"
    app = "mockapp"
    criteria = {"settings.general.darkMode": "yes"}  # actual is bool, expected is str


class _MockAnswerTaskOk(AnswerTask):
    """AnswerTask that works correctly."""
    template = "好友数量"
    app = "mockapp"
    answer = (".contacts", len)


class _MockAnswerTaskNone(AnswerTask):
    """AnswerTask whose get_answer returns None (bad path)."""
    template = "不存在的数据"
    app = "mockapp"
    answer = ".nonexistent.path"


class _MockAnswerTaskCrash(AnswerTask):
    """AnswerTask whose get_answer raises an exception."""
    template = "崩溃的任务"
    app = "mockapp"

    def get_answer(self, input):
        raise ValueError("Intentional crash for testing")


class _MockBaseTaskWithCriteria(BaseTask):
    """BaseTask (not CriteriaTask) with criteria dict — expected_changes check."""
    template = "自定义任务"
    app = "mockapp"
    criteria = {"settings.general.darkMode": True}
    expected_changes: ClassVar[list[str]] = []  # Missing coverage!


class _MockBaseTaskWithCriteriaOk(BaseTask):
    """BaseTask with proper expected_changes coverage."""
    template = "自定义任务OK"
    app = "mockapp"
    criteria = {"settings.general.darkMode": True}
    expected_changes: ClassVar[list[str]] = ["settings.general.darkMode"]


class _MockCustomGoalsTask(BaseTask):
    """BaseTask with custom check_goals that works."""
    template = "自定义判别"
    app = "mockapp"

    def check_goals(self, input):
        return [{"field": "test", "expected": True, "actual": False, "passed": False}]


class _MockCustomGoalsCrashTask(BaseTask):
    """BaseTask with custom check_goals that crashes."""
    template = "崩溃判别"
    app = "mockapp"

    def check_goals(self, input):
        raise RuntimeError("Intentional crash")


# ============================================================================
# Tests
# ============================================================================

def test_path_exists_in():
    section("path_exists_in")

    exists, val = path_exists_in(MOCK_DEFAULTS, "user.name")
    assert_true(exists, "user.name should exist")
    assert_eq(val, "小明", "user.name value")

    exists, val = path_exists_in(MOCK_DEFAULTS, "settings.privacy.friendConfirmation")
    assert_true(exists, "settings.privacy.friendConfirmation should exist")
    assert_eq(val, True, "friendConfirmation value")

    exists, val = path_exists_in(MOCK_DEFAULTS, "nonexistent.path")
    assert_false(exists, "nonexistent.path should not exist")

    exists, val = path_exists_in(MOCK_DEFAULTS, "contacts[0].name")
    assert_true(exists, "contacts[0].name should exist")
    assert_eq(val, "张三", "contacts[0].name value")

    exists, val = path_exists_in(MOCK_DEFAULTS, "contacts[99].name")
    assert_false(exists, "contacts[99].name should not exist (out of bounds)")

    # Edge: path to a falsy value (empty string)
    exists, val = path_exists_in(MOCK_DEFAULTS, "user.pat")
    # pat = "" → get_by_path returns "" → "" is not None → path_exists_in returns (True, "")
    assert_true(exists, "user.pat='' → should exist (empty string is not None)")

    # Edge: path to False boolean
    exists, val = path_exists_in(MOCK_DEFAULTS, "settings.general.darkMode")
    # darkMode = False → get_by_path returns False → our function says "not None" → exists
    # Wait: get_by_path returns `current if current is not None else default`
    # So False would be returned as False (not None). Let's check:
    assert_true(exists, "settings.general.darkMode=False should exist (False is not None)")
    assert_eq(val, False, "darkMode value is False")


def test_path_exists_in_false_value_bug():
    """Test that path_exists_in correctly handles False vs None vs empty string."""
    section("path_exists_in — 边界值测试")

    data = {"a": False, "b": 0, "c": "", "d": None, "e": []}

    exists_a, val_a = path_exists_in(data, "a")
    assert_true(exists_a, "False should be treated as existing (not None)")
    assert_eq(val_a, False, "value should be False")

    exists_b, val_b = path_exists_in(data, "b")
    # get_by_path returns 0 → 0 is not None → exists
    # But path_exists_in does `value is not None` → 0 is not None → True
    # Wait, actually: get_by_path returns `current if current is not None else default`
    # For 0: current=0, which is not None, so returns 0. Then path_exists_in: 0 is not None → True
    assert_true(exists_b, "0 should be treated as existing")
    assert_eq(val_b, 0, "value should be 0")

    exists_c, val_c = path_exists_in(data, "c")
    # "" is not None → should return True. But get_by_path: current="" → not None → returns ""
    # Then path_exists_in: "" is not None → True
    assert_true(exists_c, "'' should be treated as existing (not None)")

    exists_d, val_d = path_exists_in(data, "d")
    # None → get_by_path returns default (None) → path_exists_in: None is None → False
    assert_false(exists_d, "None should be treated as non-existing")

    exists_e, val_e = path_exists_in(data, "e")
    # [] is not None → True
    assert_true(exists_e, "[] should be treated as existing")


def test_set_by_path():
    section("set_by_path")
    import copy

    # Simple nested path
    data = copy.deepcopy(MOCK_DEFAULTS)
    set_by_path(data, "settings.privacy.friendConfirmation", False)
    assert_eq(data["settings"]["privacy"]["friendConfirmation"], False, "set nested bool")

    # Deep new path creation
    data2 = {"a": {}}
    set_by_path(data2, "a.b.c.d", 42)
    assert_eq(data2["a"]["b"]["c"]["d"], 42, "set deep new path")

    # Array index path
    data3 = {"items": [{"x": 1}, {"x": 2}]}
    set_by_path(data3, "items[0].x", 99)
    assert_eq(data3["items"][0]["x"], 99, "set array index path")

    # Overwrite non-dict with dict (intermediate)
    data4 = {"a": {"b": "string_value"}}
    set_by_path(data4, "a.b.c", True)
    assert_eq(data4["a"]["b"]["c"], True, "overwrite string intermediate with dict")


def test_check_criteria_paths():
    section("check_criteria_paths")

    # OK path
    report = Report()
    check_criteria_paths(report, _MockCriteriaTaskPass, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 0, "valid path should produce no issues")

    # Bad path
    report = Report()
    check_criteria_paths(report, _MockCriteriaTaskBadPath, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 1, "nonexistent path should produce 1 warning")
    assert_eq(report.issues[0].level, "WARN", "should be WARN level")
    assert_eq(report.issues[0].check, "path_exists", "check type should be path_exists")

    # Type mismatch
    report = Report()
    check_criteria_paths(report, _MockCriteriaTaskTypeMismatch, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 1, "type mismatch should produce 1 warning")
    assert_eq(report.issues[0].check, "type_mismatch", "check type should be type_mismatch")

    # Route key should be skipped
    report = Report()
    check_criteria_paths(report, _MockCriteriaTaskWithRoute, MOCK_DEFAULTS)
    # route is skipped, settings.general.darkMode exists (value is False) but criteria expects True
    # That's a value difference, not a path/type issue
    assert_eq(len(report.issues), 0,
              "route should be skipped, and darkMode path exists with matching bool type")


def test_check_criteria_negative():
    section("check_criteria_negative")

    # Task whose criteria differ from defaults → should NOT produce warning
    report = Report()
    task = _MockCriteriaTaskPass()
    check_criteria_negative(report, task, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 0, "criteria differ from defaults → no warning")

    # Task whose criteria already match defaults → should produce warning
    report = Report()
    task = _MockCriteriaTaskAlreadySatisfied()
    check_criteria_negative(report, task, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 1, "criteria already satisfied → should warn")
    assert_eq(report.issues[0].level, "WARN", "should be WARN")
    assert_eq(report.issues[0].check, "negative_test", "check type")


def test_check_criteria_positive():
    section("check_criteria_positive")

    # Task with simple state criteria → set_by_path should make it pass
    report = Report()
    task = _MockCriteriaTaskPass()
    check_criteria_positive(report, task, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 0, "setting criteria values should make evaluate pass")

    # Task with route + state criteria
    report = Report()
    task = _MockCriteriaTaskWithRoute()
    check_criteria_positive(report, task, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 0, "route + state criteria should pass after setting")


def test_check_criteria_positive_detects_real_failure():
    """A CriteriaTask with a callable checker that always fails should report ERROR."""
    section("check_criteria_positive — callable checker 总是失败")

    class _AlwaysFail(CriteriaTask):
        template = "test"
        app = "mockapp"
        criteria = {"settings.general.darkMode": lambda actual: actual == "impossible"}

    report = Report()
    task = _AlwaysFail()
    check_criteria_positive(report, task, MOCK_DEFAULTS)
    # callable checkers are skipped in set_by_path, so the value stays as default (False)
    # The lambda checks actual == "impossible" which fails
    assert_eq(len(report.errors), 1, "callable always-fail should produce an ERROR")
    assert_eq(report.errors[0].check, "positive_test", "check type")


def test_check_answer_task():
    section("check_answer_task")

    # OK: returns a valid number
    report = Report()
    task = _MockAnswerTaskOk()
    check_answer_task(report, task, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 0, "valid answer should produce no issues")

    # get_answer returns None
    report = Report()
    task = _MockAnswerTaskNone()
    check_answer_task(report, task, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 1, "None answer should produce 1 warning")
    assert_eq(report.issues[0].level, "WARN", "should be WARN")

    # get_answer crashes
    report = Report()
    task = _MockAnswerTaskCrash()
    check_answer_task(report, task, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 1, "crashing answer should produce 1 error")
    assert_eq(report.issues[0].level, "ERROR", "should be ERROR")
    assert_true("Intentional crash" in report.issues[0].message, "error message should contain exception text")


def test_check_expected_changes_coverage():
    section("check_expected_changes_coverage")

    # BaseTask with criteria but no expected_changes → should warn
    report = Report()
    check_expected_changes_coverage(report, _MockBaseTaskWithCriteria)
    assert_eq(len(report.issues), 1, "missing expected_changes coverage should warn")
    assert_eq(report.issues[0].check, "expected_changes", "check type")

    # BaseTask with proper coverage → no issues
    report = Report()
    check_expected_changes_coverage(report, _MockBaseTaskWithCriteriaOk)
    assert_eq(len(report.issues), 0, "proper coverage should produce no issues")

    # CriteriaTask → auto-generates expected_changes, so skip
    report = Report()
    check_expected_changes_coverage(report, _MockCriteriaTaskPass)
    assert_eq(len(report.issues), 0, "CriteriaTask should be skipped (auto-generates)")


def test_check_custom_goals_crash():
    section("check_custom_goals_crash")

    # Working custom goals → no issues
    report = Report()
    task = _MockCustomGoalsTask()
    check_custom_goals_crash(report, task, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 0, "working check_goals should produce no issues")

    # Crashing custom goals → ERROR
    report = Report()
    task = _MockCustomGoalsCrashTask()
    check_custom_goals_crash(report, task, MOCK_DEFAULTS)
    assert_eq(len(report.issues), 1, "crashing check_goals should produce 1 error")
    assert_eq(report.issues[0].level, "ERROR", "should be ERROR")


def test_check_custom_goals_skip_for_criteria_and_answer():
    """CriteriaTask and AnswerTask should be skipped by check_custom_goals_crash."""
    section("check_custom_goals_crash — 跳过 CriteriaTask/AnswerTask")

    report = Report()
    task = _MockCriteriaTaskPass()
    check_custom_goals_crash(report, task, MOCK_DEFAULTS)
    assert_eq(report.total_checks, 0, "CriteriaTask should be skipped, no checks added")

    report = Report()
    task = _MockAnswerTaskOk()
    check_custom_goals_crash(report, task, MOCK_DEFAULTS)
    assert_eq(report.total_checks, 0, "AnswerTask should be skipped, no checks added")


def test_make_observation():
    section("make_observation")

    state = {"apps": {"test": {"x": 1}}, "os": {}}
    route = {"path": "/settings", "appId": "test"}
    obs = make_observation(state, route)
    assert_eq(obs.route, route, "route should match")
    assert_eq(obs.state, state, "state should match")
    assert_eq(obs.screenshot_base64, "", "screenshot should be empty string")

    # Default route
    obs2 = make_observation(state)
    assert_eq(obs2.route, {"path": "/", "appId": ""}, "default route")


def test_judge_input_integration():
    """Integration: test that JudgeInput constructed from make_observation works correctly."""
    section("JudgeInput 集成测试")

    defaults = MOCK_DEFAULTS
    state = {"apps": {"mockapp": defaults}, "os": {}}
    init_obs = make_observation(state, {"path": "/", "appId": "mockapp"})
    last_obs = make_observation(state, {"path": "/settings", "appId": "mockapp"})
    ji = JudgeInput(init_obs=init_obs, last_obs=last_obs)

    assert_eq(ji.route.get("path"), "/settings", "last route path")
    assert_eq(ji.apps.get("mockapp", {}).get("user", {}).get("name"), "小明", "app state accessible")
    assert_eq(ji.apps_init.get("mockapp", {}).get("user", {}).get("name"), "小明", "init app state")


def test_criteria_positive_with_real_evaluate():
    """End-to-end: construct state matching criteria, run real evaluate(), check success."""
    section("端到端: CriteriaTask evaluate 正向验证")

    import copy
    defaults = copy.deepcopy(MOCK_DEFAULTS)
    task = _MockCriteriaTaskPass()

    # Build state where criteria is satisfied
    modified = copy.deepcopy(defaults)
    modified["settings"]["privacy"]["friendConfirmation"] = False

    env_state = {"apps": {"mockapp": modified}, "os": {}}
    init_state = {"apps": {"mockapp": defaults}, "os": {}}
    init_obs = make_observation(init_state, {"path": "/", "appId": "mockapp"})
    last_obs = make_observation(env_state, {"path": "/", "appId": "mockapp"})
    ji = JudgeInput(init_obs=init_obs, last_obs=last_obs)

    result = task.evaluate(ji)
    assert_true(result.success, "evaluate should succeed with matching state")


def test_criteria_negative_with_real_evaluate():
    """End-to-end: default state should NOT satisfy criteria."""
    section("端到端: CriteriaTask evaluate 反向验证")

    import copy
    defaults = copy.deepcopy(MOCK_DEFAULTS)
    task = _MockCriteriaTaskPass()

    env_state = {"apps": {"mockapp": defaults}, "os": {}}
    init_obs = make_observation(copy.deepcopy(env_state), {"path": "/", "appId": "mockapp"})
    last_obs = make_observation(env_state, {"path": "/", "appId": "mockapp"})
    ji = JudgeInput(init_obs=init_obs, last_obs=last_obs)

    result = task.evaluate(ji)
    assert_false(result.success, "evaluate should fail with default (unmodified) state")


def test_answer_task_with_real_evaluate():
    """End-to-end: AnswerTask evaluate with correct answer."""
    section("端到端: AnswerTask evaluate 验证")

    import copy
    defaults = copy.deepcopy(MOCK_DEFAULTS)
    task = _MockAnswerTaskOk()  # answer = (".contacts", len) → expects 2

    env_state = {"apps": {"mockapp": defaults}, "os": {}}
    init_obs = make_observation(copy.deepcopy(env_state), {"path": "/", "appId": "mockapp"})
    last_obs = make_observation(env_state, {"path": "/", "appId": "mockapp"})
    ji = JudgeInput(init_obs=init_obs, last_obs=last_obs, answer="2")

    result = task.evaluate(ji)
    assert_true(result.success, "evaluate should succeed with correct answer '2'")

    # Wrong answer
    ji_wrong = JudgeInput(init_obs=init_obs, last_obs=last_obs, answer="99")
    result_wrong = task.evaluate(ji_wrong)
    assert_false(result_wrong.success, "evaluate should fail with wrong answer '99'")


def test_set_by_path_edge_cases():
    """Test set_by_path with trickier cases."""
    section("set_by_path — 边界情况")

    import copy

    # Set into array that needs expansion
    data = {"items": []}
    set_by_path(data, "items[0].name", "hello")
    assert_eq(data["items"][0]["name"], "hello", "set into empty array with expansion")

    # Top-level key
    data2 = {}
    set_by_path(data2, "x", 42)
    assert_eq(data2["x"], 42, "set top-level key")

    # Multiple dots
    data3 = {}
    set_by_path(data3, "a.b.c", True)
    assert_eq(data3["a"]["b"]["c"], True, "set deeply nested new keys")


def test_path_exists_in_with_get_by_path_default_behavior():
    """
    Verify that path_exists_in correctly uses get_by_path's default=None.
    This catches a subtle bug: get_by_path returns default when path not found,
    and our function checks `value is not None`.
    """
    section("path_exists_in — get_by_path default 行为")

    data = {"a": {"b": None}}  # path exists but value is None
    exists, val = path_exists_in(data, "a.b")
    # get_by_path: current = None → returns default (None) → path_exists_in says False
    # This is a known limitation but acceptable: None values are treated as "path not found"
    assert_false(exists, "None value treated as non-existing (known limitation)")

    data2 = {"a": {"b": 0}}
    exists2, val2 = path_exists_in(data2, "a.b")
    assert_true(exists2, "0 is not None, should exist")


# ============================================================================
# Run all tests
# ============================================================================

if __name__ == "__main__":
    test_path_exists_in()
    test_path_exists_in_false_value_bug()
    test_set_by_path()
    test_set_by_path_edge_cases()
    test_make_observation()
    test_judge_input_integration()
    test_check_criteria_paths()
    test_check_criteria_negative()
    test_check_criteria_positive()
    test_check_criteria_positive_detects_real_failure()
    test_check_answer_task()
    test_check_expected_changes_coverage()
    test_check_custom_goals_crash()
    test_check_custom_goals_skip_for_criteria_and_answer()
    test_criteria_positive_with_real_evaluate()
    test_criteria_negative_with_real_evaluate()
    test_answer_task_with_real_evaluate()
    test_path_exists_in_with_get_by_path_default_behavior()

    print(f"\n{'=' * 60}")
    print(f"  结果: {passed} 通过, {failed} 失败")
    print(f"{'=' * 60}")
    sys.exit(1 if failed else 0)
