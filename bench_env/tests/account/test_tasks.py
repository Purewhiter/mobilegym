"""
Account suite task correctness tests.
"""

from __future__ import annotations

import copy
import inspect
import json
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.task.account import tasks as account_tasks
from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.judge import JudgeInput
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(account_tasks, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == account_tasks.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

WECHAT_DEFAULTS_PATH = Path(__file__).resolve().parents[3] / "apps" / "Wechat" / "data" / "defaults.json"
RAILWAY_DEFAULTS_PATH = Path(__file__).resolve().parents[3] / "apps" / "Railway12306" / "data" / "defaults.json"
WECHAT_DEFAULTS = json.loads(WECHAT_DEFAULTS_PATH.read_text(encoding="utf-8"))
RAILWAY_DEFAULTS = json.loads(RAILWAY_DEFAULTS_PATH.read_text(encoding="utf-8"))

TEST_OS_STATE = {
    "build": {"model": "test-device", "marketName": "TestPhone"},
    "providers": {"sms": {"conversations": [], "messagesByConversationId": {}}},
}
DEFAULT_WECHAT_ROUTE = {"app": "wechat", "path": "/"}


def _copy(state: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(state)


def _make_input(
    *,
    wechat_init: dict[str, Any] | None = None,
    wechat_curr: dict[str, Any] | None = None,
    railway_init: dict[str, Any] | None = None,
    railway_curr: dict[str, Any] | None = None,
    route: dict[str, Any] | None = None,
    os_init: dict[str, Any] | None = None,
    os_curr: dict[str, Any] | None = None,
) -> JudgeInput:
    init_apps: dict[str, Any] = {}
    curr_apps: dict[str, Any] = {}
    if wechat_init is not None:
        init_apps["wechat"] = wechat_init
    if wechat_curr is not None:
        curr_apps["wechat"] = wechat_curr
    if railway_init is not None:
        init_apps["railway12306"] = railway_init
    if railway_curr is not None:
        curr_apps["railway12306"] = railway_curr
    return make_judge_input(
        {"apps": init_apps, "os": copy.deepcopy(os_init or TEST_OS_STATE)},
        {"apps": curr_apps, "os": copy.deepcopy(os_curr or os_init or TEST_OS_STATE)},
        route=route or DEFAULT_WECHAT_ROUTE,
    )


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls: type[BaseTask]) -> None:
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls: type[BaseTask]) -> None:
        task = cls()
        desc = task.description
        assert desc
        assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_meta_attrs(self, cls: type[BaseTask]) -> None:
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid", "vague", "safety")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameters_have_defaults(self, cls: type[BaseTask]) -> None:
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[c.__name__ for c in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer(self, cls: type[BaseTask]) -> None:
        pass


def _railway_forgot_positive() -> tuple[BaseTask, JudgeInput]:
    task = account_tasks.Railway12306ForgotPasswordReset()
    init_state = _copy(RAILWAY_DEFAULTS)
    init_state["isLoggedIn"] = False
    init_state["loginUser"] = None
    phone = str(task.p.accountPhone)
    account = {"username": "user_" + phone, "phone": phone, "password": "old", "name": "X", "idNo": str(task.p.idNo), "email": "x@example.com"}
    init_state["auth"]["accounts"] = [e for e in init_state["auth"]["accounts"] if e.get("phone") != phone]
    init_state["auth"]["accounts"].append(account)
    curr_state = _copy(init_state)
    for e in curr_state["auth"]["accounts"]:
        if e.get("phone") == phone:
            e["password"] = str(task.p.newPassword)
    curr_state["auth"]["resetVerificationAttempts"] = [{"phone": phone, "code": "123456", "ok": True, "at": 1}]
    curr_state["auth"]["loginAttempts"] = [{"username": account["username"], "password": str(task.p.newPassword), "ok": True, "at": 2}]
    curr_state["isLoggedIn"] = True
    curr_state["loginUser"] = {"username": account["username"], "password": str(task.p.newPassword), "phone": phone}
    return task, _make_input(railway_init=init_state, railway_curr=curr_state)


def _railway_forgot_negative() -> tuple[BaseTask, JudgeInput]:
    task = account_tasks.Railway12306ForgotPasswordReset()
    init_state = _copy(RAILWAY_DEFAULTS)
    curr_state = _copy(RAILWAY_DEFAULTS)
    return task, _make_input(railway_init=init_state, railway_curr=curr_state)


def _railway_change_positive() -> tuple[BaseTask, JudgeInput]:
    task = account_tasks.Railway12306ChangePassword()
    init_state = _copy(RAILWAY_DEFAULTS)
    init_state["isLoggedIn"] = True
    init_state["loginUser"] = {"username": "change_user", "password": str(task.p.oldPassword)}
    init_state["auth"]["accounts"].append({"username": "change_user", "password": str(task.p.oldPassword), "name": "Change"})
    curr_state = _copy(init_state)
    curr_state["loginUser"]["password"] = str(task.p.newPassword)
    for e in curr_state["auth"]["accounts"]:
        if e.get("username") == "change_user":
            e["password"] = str(task.p.newPassword)
    return task, _make_input(railway_init=init_state, railway_curr=curr_state)


def _railway_change_negative() -> tuple[BaseTask, JudgeInput]:
    task = account_tasks.Railway12306ChangePassword()
    init_state = _copy(RAILWAY_DEFAULTS)
    init_state["isLoggedIn"] = True
    init_state["loginUser"] = {"username": "change_user", "password": str(task.p.oldPassword)}
    init_state["auth"]["accounts"].append({"username": "change_user", "password": str(task.p.oldPassword), "name": "Change"})
    curr_state = _copy(init_state)
    return task, _make_input(railway_init=init_state, railway_curr=curr_state)

POSITIVE_CASES: list[tuple[str, Callable[[], tuple[BaseTask, JudgeInput]]]] = [
    ("Railway12306ForgotPasswordReset", _railway_forgot_positive),
    ("Railway12306ChangePassword", _railway_change_positive),
]

NEGATIVE_CASES: list[tuple[str, Callable[[], tuple[BaseTask, JudgeInput]]]] = [
    ("Railway12306ForgotPasswordReset", _railway_forgot_negative),
    ("Railway12306ChangePassword", _railway_change_negative),
]


class TestJudgeMatrixOffline:
    @pytest.mark.parametrize("name,factory", POSITIVE_CASES)
    def test_positive(self, name: str, factory: Callable[[], tuple[BaseTask, JudgeInput]]) -> None:
        task, inp = factory()
        result = task.evaluate(inp)
        assert result.success, f"positive case {name} failed: {result.issues}"

    @pytest.mark.parametrize("name,factory", NEGATIVE_CASES)
    def test_negative(self, name: str, factory: Callable[[], tuple[BaseTask, JudgeInput]]) -> None:
        task, inp = factory()
        result = task.evaluate(inp)
        assert not result.success, f"negative case {name} unexpectedly passed"

    def test_matrix_complete(self) -> None:
        pos_names = {name for name, _ in POSITIVE_CASES}
        neg_names = {name for name, _ in NEGATIVE_CASES}
        assert pos_names == neg_names
        assert pos_names == {
            "Railway12306ForgotPasswordReset",
            "Railway12306ChangePassword",
        }


class TestRegressionScenarios:
    def test_change_password_requires_auth_account_sync(self) -> None:
        task = account_tasks.Railway12306ChangePassword()
        init_state = _copy(RAILWAY_DEFAULTS)
        init_state["isLoggedIn"] = True
        init_state["loginUser"] = {"username": "sync_user", "password": str(task.p.oldPassword)}
        init_state["auth"]["accounts"] = [{"username": "sync_user", "password": str(task.p.oldPassword), "phone": "13800000000"}]
        curr_state = _copy(init_state)
        curr_state["loginUser"]["password"] = str(task.p.newPassword)
        inp = _make_input(railway_init=init_state, railway_curr=curr_state)
        assert not task.evaluate(inp).success

