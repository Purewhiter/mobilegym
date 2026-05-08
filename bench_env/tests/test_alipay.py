"""
Alipay task correctness tests.
"""

from __future__ import annotations

import copy
import datetime
import inspect
import json
import re
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.alipay.app import Alipay, TxMatch
from bench_env.task.alipay import tasks as _tasks_module
from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

BASE_NOW = datetime.datetime(2026, 3, 9, 12, 0, 0)
TEST_OS_STATE = {"time": {"timestamp": int(BASE_NOW.timestamp() * 1000)}}
DEFAULT_ROUTE = {"app": "alipay", "path": "/"}

_RELATIVE_TIME_RE = re.compile(r"(\d+)([dhm])")
_PATH_TOKEN_RE = re.compile(r"([^\.\[\]]+)|\[(\d+)\]")


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "apps" / "Alipay" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_timestamp(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    if not isinstance(value, str):
        raise TypeError(f"Unsupported timestamp value: {value!r}")
    if value.startswith("-"):
        delta_ms = 0
        for amount, unit in _RELATIVE_TIME_RE.findall(value):
            n = int(amount)
            if unit == "d":
                delta_ms += n * 24 * 60 * 60 * 1000
            elif unit == "h":
                delta_ms += n * 60 * 60 * 1000
            elif unit == "m":
                delta_ms += n * 60 * 1000
        return TEST_OS_STATE["time"]["timestamp"] - delta_ms
    return int(datetime.datetime.strptime(value, "%Y-%m-%d %H:%M:%S").timestamp() * 1000)


def _normalize_alipay_state(state: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(state)
    for record in normalized["transferRecords"]:
        record["timestamp"] = _parse_timestamp(record["timestamp"])
    for item in normalized["notifications"]:
        item["timestamp"] = _parse_timestamp(item["timestamp"])
    for conv in normalized["conversations"]:
        conv["lastTimestamp"] = _parse_timestamp(conv["lastTimestamp"])
        conv["lastReadAt"] = _parse_timestamp(conv["lastReadAt"])
    for messages in normalized["chatHistory"].values():
        for msg in messages:
            msg["timestamp"] = _parse_timestamp(msg["timestamp"])
    return normalized


DEFAULTS = _load_defaults()
BASE_STATE = _normalize_alipay_state(DEFAULTS)


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
):
    return make_judge_input(
        {"apps": {"alipay": init_state}, "os": TEST_OS_STATE},
        {"apps": {"alipay": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _format_answer(expected: Any) -> str:
    if isinstance(expected, float) and expected.is_integer():
        return str(int(expected))
    return str(expected)


def _parse_path(path: str) -> list[str | int]:
    tokens: list[str | int] = []
    for name, index in _PATH_TOKEN_RE.findall(path):
        tokens.append(name if name else int(index))
    return tokens


def _set_by_path(state: dict[str, Any], path: str, value: Any) -> None:
    tokens = _parse_path(path)
    current: Any = state
    for token in tokens[:-1]:
        current = current[token]
    current[tokens[-1]] = value


def _resolve_criteria_value(value: Any, params: dict[str, Any]) -> Any:
    if isinstance(value, str):
        match = re.fullmatch(r"\{(\w+)\}", value)
        if match:
            return params[match.group(1)]
    return value


def _positive_answer_case(
    task: BaseTask,
    curr_state: dict[str, Any] | None = None,
    *,
    route: dict[str, Any] | None = None,
):
    curr = copy.deepcopy(curr_state) if curr_state is not None else copy.deepcopy(BASE_STATE)
    inp = _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)
    expected = task.get_answer(inp)  # type: ignore[attr-defined]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route, answer=_format_answer(expected))


def _negative_answer_case(
    task: BaseTask,
    curr_state: dict[str, Any] | None = None,
    *,
    route: dict[str, Any] | None = None,
):
    curr = copy.deepcopy(curr_state) if curr_state is not None else copy.deepcopy(BASE_STATE)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route, answer="错误答案")


def _positive_criteria_case(task: CriteriaTask):
    curr = copy.deepcopy(BASE_STATE)
    route = DEFAULT_ROUTE
    for path, raw_value in task.criteria.items():
        value = _resolve_criteria_value(raw_value, task.params)
        if path == "route":
            route = {"app": "alipay", "path": str(value)}
            continue
        _set_by_path(curr, path, value)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)


def _negative_criteria_case(task: CriteriaTask):
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _next_chat_timestamp(state: dict[str, Any]) -> int:
    return (
        max(int(msg["timestamp"]) for messages in state["chatHistory"].values() for msg in messages)
        + 1000
    )


def _find_contact(state: dict[str, Any], *, name: str | None = None, account: str | None = None) -> dict[str, Any]:
    for contact in state["contacts"]:
        if name is not None and contact["name"] == name:
            return contact
        if account is not None and (contact["account"] == account or contact["phone"] == account):
            return contact
    raise AssertionError(f"Missing contact fixture: name={name!r}, account={account!r}")


def _find_conversation_for_contact(state: dict[str, Any], contact_name: str) -> dict[str, Any]:
    for conv in state["conversations"]:
        if conv["kind"] != "person":
            continue
        if contact_name in conv["name"]:
            return conv
        contact = next((c for c in state["contacts"] if c["id"] == conv.get("contactId")), None)
        if contact is not None and contact_name in contact["name"]:
            return conv
    raise AssertionError(f"Missing conversation fixture for contact: {contact_name}")


def _with_sent_message(contact_name: str, text: str) -> dict[str, Any]:
    curr = copy.deepcopy(BASE_STATE)
    conv = _find_conversation_for_contact(curr, contact_name)
    ts = _next_chat_timestamp(curr)
    curr["chatHistory"][conv["id"]] = curr["chatHistory"].get(conv["id"], []) + [{
        "id": "cm_test_send",
        "senderId": "self",
        "type": "text",
        "content": text,
        "timestamp": ts,
    }]
    for idx, item in enumerate(curr["conversations"]):
        if item["id"] == conv["id"]:
            curr["conversations"][idx] = {
                **item,
                "lastContent": text,
                "lastTimestamp": ts,
                "lastReadAt": ts,
            }
            break
    return curr


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "alipay" in task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": TEST_OS_STATE}
        desc = task.description
        assert desc
        assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_required_class_attrs(self, cls):
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid", "vague", "safety")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[c.__name__ for c in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer_or_get_answer(self, cls):
        has_answer_attr = cls.answer is not None
        has_get_answer_override = cls.get_answer is not AnswerTask.get_answer
        assert has_answer_attr or has_get_answer_override


class TestAlipayAccessor:
    @pytest.fixture
    def alipay(self) -> Alipay:
        return Alipay(copy.deepcopy(BASE_STATE))

    def test_balance_and_transactions(self, alipay: Alipay):
        assert alipay.total_balance == pytest.approx(100023.46)
        assert alipay.transactions[0]["id"] == "tr_today_1"

    def test_monthly_aggregations(self, alipay: Alipay):
        assert alipay.monthly_expense("2026-01") == pytest.approx(2878.01)
        assert alipay.monthly_income_from("2026-01", "Hui") == pytest.approx(3700.0)

    def test_incoming_transfer_aggregations(self, alipay: Alipay):
        top = alipay.largest_incoming_transfer()
        assert alipay.incoming_transfer_count() == 4
        assert top["id"] == "tr_20260112_2"
        assert float(top["delta"]) == pytest.approx(2500.0)

    def test_bill_type_year_summary_uses_quick_filter_semantics(self, alipay: Alipay):
        count, spending = alipay.bill_type_year_summary("订单", 2026)
        assert count == 12
        assert spending == pytest.approx(534.06)

    def test_count_matching_transfers(self, alipay: Alipay):
        matched, details = Alipay.count_matching_transfers(
            alipay.transactions,
            [TxMatch(counterparty="浩杰", amount=520, note="转账")],
            since_ms=0,
        )
        assert matched == 1
        assert details[0]["passed"] is True

    def test_contacts_conversations_and_chat_history(self, alipay: Alipay):
        assert len(alipay.contacts) == 30
        assert any(conv["id"] == "conv_p_6" for conv in alipay.conversations)
        assert alipay.chat_history["conv_p_6"][-1]["content"] == "我到了，你下楼吗？"

    def test_total_unread(self, alipay: Alipay):
        assert alipay.total_unread == 18

    def test_find_contact_name_by_account(self, alipay: Alipay):
        assert alipay.find_contact_name_by_account("13856785678") == "小丽(李丽)"
        with pytest.raises(ValueError):
            alipay.find_contact_name_by_account("00000000000")

    def test_get_conversation_by_name(self, alipay: Alipay):
        conv = alipay.get_conversation_by_name("正中")
        assert conv["id"] == "conv_p_6"
        with pytest.raises(ValueError):
            alipay.get_conversation_by_name("不存在的人")

    def test_get_conversation_for_contact(self, alipay: Alipay):
        conv = alipay.get_conversation_for_contact("老王")
        assert conv is not None
        assert conv["id"] == "conv_p_5"
        assert alipay.get_conversation_for_contact("完全不存在") is None

    def test_get_last_chat_message(self, alipay: Alipay):
        assert alipay.get_last_chat_message("conv_p_6")["content"] == "我到了，你下楼吗？"
        assert alipay.get_last_chat_message("missing_conv") is None


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("FindFriend", lambda: _positive_answer_case(_tasks_module.FindFriend())),
    ("MonthlyIncomeByCounterparty", lambda: _positive_answer_case(_tasks_module.MonthlyIncomeByCounterparty())),
    ("CheckDailyIncome", lambda: _positive_answer_case(_tasks_module.CheckDailyIncome())),
    ("EnableDarkMode", lambda: _positive_criteria_case(_tasks_module.EnableDarkMode())),
    ("CheckLatestMessageContent", lambda: _positive_answer_case(_tasks_module.CheckLatestMessageContent())),
    ("SetPaymentOrderMode", lambda: _positive_criteria_case(_tasks_module.SetPaymentOrderMode())),
    ("SetPayOrderCcbYuebaoBalance", lambda: _positive_criteria_case(_tasks_module.SetPayOrderCcbYuebaoBalance())),
    ("AnalyzeSpending", lambda: _positive_answer_case(_tasks_module.AnalyzeSpending())),
    ("CountLargeTransferIncomes", lambda: _positive_answer_case(_tasks_module.CountLargeTransferIncomes())),
    ("CheckUnreadMessageCount", lambda: _positive_answer_case(_tasks_module.CheckUnreadMessageCount())),
    ("CheckBalance", lambda: _positive_answer_case(_tasks_module.CheckBalance())),
    ("DisableAllNotifications", lambda: _positive_criteria_case(_tasks_module.DisableAllNotifications())),
    ("ShowReceiveQRCode", lambda: _positive_criteria_case(_tasks_module.ShowReceiveQRCode())),
    ("SearchTransferRecords", lambda: _positive_answer_case(_tasks_module.SearchTransferRecords())),
    ("SendMessageToContact", lambda: (
        _tasks_module.SendMessageToContact(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_sent_message("老王(王建国)", "发票抬头是XX公司"),
            route={"app": "alipay", "path": "/chat"},
        ),
    )),
    ("ConfigureLanguageAndFastPay", lambda: _positive_criteria_case(_tasks_module.ConfigureLanguageAndFastPay())),
    ("EnableRefreshSound", lambda: _positive_criteria_case(_tasks_module.EnableRefreshSound())),
    ("SetFontSizeLevel", lambda: _positive_criteria_case(_tasks_module.SetFontSizeLevel(font_size_level=4))),
    ("CalculateMonthlyExpenseTrend", lambda: _positive_answer_case(_tasks_module.CalculateMonthlyExpenseTrend())),
    ("FindLargestTransferPartner", lambda: _positive_answer_case(_tasks_module.FindLargestTransferPartner())),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("FindFriend", lambda: _negative_answer_case(_tasks_module.FindFriend())),
    ("MonthlyIncomeByCounterparty", lambda: _negative_answer_case(_tasks_module.MonthlyIncomeByCounterparty())),
    ("CheckDailyIncome", lambda: _negative_answer_case(_tasks_module.CheckDailyIncome())),
    ("EnableDarkMode", lambda: _negative_criteria_case(_tasks_module.EnableDarkMode())),
    ("CheckLatestMessageContent", lambda: _negative_answer_case(_tasks_module.CheckLatestMessageContent())),
    ("SetPaymentOrderMode", lambda: _negative_criteria_case(_tasks_module.SetPaymentOrderMode())),
    ("SetPayOrderCcbYuebaoBalance", lambda: _negative_criteria_case(_tasks_module.SetPayOrderCcbYuebaoBalance())),
    ("AnalyzeSpending", lambda: _negative_answer_case(_tasks_module.AnalyzeSpending())),
    ("CountLargeTransferIncomes", lambda: _negative_answer_case(_tasks_module.CountLargeTransferIncomes())),
    ("CheckUnreadMessageCount", lambda: _negative_answer_case(_tasks_module.CheckUnreadMessageCount())),
    ("CheckBalance", lambda: _negative_answer_case(_tasks_module.CheckBalance())),
    ("DisableAllNotifications", lambda: _negative_criteria_case(_tasks_module.DisableAllNotifications())),
    ("ShowReceiveQRCode", lambda: _negative_criteria_case(_tasks_module.ShowReceiveQRCode())),
    ("SearchTransferRecords", lambda: _negative_answer_case(_tasks_module.SearchTransferRecords())),
    ("SendMessageToContact", lambda: (
        _tasks_module.SendMessageToContact(),
        _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)),
    )),
    ("ConfigureLanguageAndFastPay", lambda: _negative_criteria_case(_tasks_module.ConfigureLanguageAndFastPay())),
    ("EnableRefreshSound", lambda: _negative_criteria_case(_tasks_module.EnableRefreshSound())),
    ("SetFontSizeLevel", lambda: _negative_criteria_case(_tasks_module.SetFontSizeLevel(font_size_level=4))),
    ("CalculateMonthlyExpenseTrend", lambda: _negative_answer_case(_tasks_module.CalculateMonthlyExpenseTrend())),
    ("FindLargestTransferPartner", lambda: _negative_answer_case(_tasks_module.FindLargestTransferPartner())),
]

OFFLINE_JUDGE_TASK_NAMES = {cls.__name__ for cls in ALL_TASK_CLASSES}


class TestTaskJudgeMatrixOffline:
    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == OFFLINE_JUDGE_TASK_NAMES
        assert negative == OFFLINE_JUDGE_TASK_NAMES

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_POSITIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_NEGATIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"
