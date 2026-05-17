"""
crossapp_commerce task correctness tests.
"""

from __future__ import annotations

import copy
import inspect
import json
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.alipay.app import Alipay
from bench_env.task.base import BaseTask
from bench_env.task.crossapp_commerce import tasks as _tasks_module
from bench_env.task.ebay.app import expect_top
from bench_env.task.judge import JudgeInput
from bench_env.task.wechat.app import Wechat
from bench_env.tests.conftest import make_judge_input
from bench_env.tests.alipay.test_tasks import BASE_STATE as ALIPAY_BASE_STATE, TEST_OS_STATE
from bench_env.tests.notes.test_tasks import BASE_STATE as NOTES_BASE_STATE, _add_note

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_ROUTE = {"app": "launcher", "path": "/"}


def _load_json(*parts: str) -> dict[str, Any]:
    return json.loads(ROOT.joinpath(*parts).read_text(encoding="utf-8"))


WECHAT_BASE_STATE = _load_json("apps", "Wechat", "data", "defaults.json")
EBAY_BASE_STATE = _load_json("apps", "Ebay", "data", "defaults.json")

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]


def _base_apps() -> dict[str, Any]:
    return {
        "alipay": copy.deepcopy(ALIPAY_BASE_STATE),
        "ebay": copy.deepcopy(EBAY_BASE_STATE),
        "notes": copy.deepcopy(NOTES_BASE_STATE),
        "wechat": copy.deepcopy(WECHAT_BASE_STATE),
    }


def _apps_state(**patches: dict[str, Any]) -> dict[str, Any]:
    apps = _base_apps()
    for key, value in patches.items():
        apps[key] = copy.deepcopy(value)
    return apps


def _make_input(
    init_apps: dict[str, Any],
    curr_apps: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
) -> JudgeInput:
    os_state = {"time": copy.deepcopy(TEST_OS_STATE["time"]), "providers": {}}
    return make_judge_input(
        {"apps": init_apps, "os": os_state},
        {"apps": curr_apps, "os": os_state},
        route=route or DEFAULT_ROUTE,
    )


def _ensure_wechat_chat(state: dict[str, Any], contact_name: str) -> dict[str, Any]:
    wechat = Wechat(state)
    wxid = wechat.require_contact_wxid(contact_name)
    chat = next((item for item in state["chats"] if str(item["id"]) == wxid), None)
    if chat is not None:
        return chat
    contact = wechat.contact_by_name(contact_name)
    chat = {
        "id": wxid,
        "user": {
            "wxid": wxid,
            "name": contact["name"],
            "avatar": contact.get("avatar", ""),
        },
        "isMuted": False,
        "isSticky": False,
        "isAlert": False,
        "messages": [],
    }
    state["chats"].insert(0, chat)
    return chat


def _append_wechat_outgoing(state: dict[str, Any], contact_name: str, content: str) -> None:
    chat = _ensure_wechat_chat(state, contact_name)
    chat["messages"].append(
        {
            "id": f"wx_out_{len(chat['messages']) + 1}",
            "type": "text",
            "content": content,
            "senderId": state["user"]["wxid"],
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
        }
    )


def _append_wechat_moment(state: dict[str, Any], content: str) -> None:
    state["moments"].insert(
        0,
        {
            "id": f"mo_test_{len(state['moments']) + 1}",
            "wxid": state["user"]["wxid"],
            "userName": state["user"]["name"],
            "userAvatar": state["user"]["avatar"],
            "content": content,
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
            "images": [],
        },
    )


def _set_ebay_search(
    state: dict[str, Any],
    *,
    query: str,
    conditions: list[str] | None = None,
    sort_option: str | None = None,
) -> None:
    snapshot = {
        "query": query,
        "categoryId": "",
        "brand": "",
        "buyingFormat": "",
        "conditions": list(conditions or []),
        "location": "",
        "freeShippingOnly": False,
        "priceMin": "",
        "priceMax": "",
        "sortOption": sort_option or "",
        "resultsCount": 20,
    }
    state["search"]["current"] = snapshot
    state["search"]["history"].append(copy.deepcopy(snapshot))
    state["recentSearches"] = [query, *[item for item in state["recentSearches"] if item != query]]


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.templates
        assert len(task.apps) >= 2

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": {"time": copy.deepcopy(TEST_OS_STATE["time"])}}
        desc = task.description
        assert desc
        assert "{" not in desc


def test_alipay_balance_to_wechat_positive():
    task = _tasks_module.AlipayBalanceToWechat(contact="陈静")
    curr_apps = _apps_state()
    balance = Alipay(curr_apps["alipay"]).total_balance
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", f"支付宝余额还有 {balance:.2f} 元")
    checks = task.check_goals(_make_input(_apps_state(), curr_apps))
    assert all(item["passed"] for item in checks)


def test_alipay_balance_to_wechat_accepts_number_adjacent_to_chinese_text():
    task = _tasks_module.AlipayBalanceToWechat(contact="陈静")
    curr_apps = _apps_state()
    balance = Alipay(curr_apps["alipay"]).total_balance
    _append_wechat_outgoing(
        curr_apps["wechat"],
        "陈静",
        f"我的支付宝余额是{balance:.2f}元",
    )
    checks = task.check_goals(_make_input(_apps_state(), curr_apps))
    assert all(item["passed"] for item in checks)


def test_alipay_balance_to_wechat_negative():
    task = _tasks_module.AlipayBalanceToWechat(contact="陈静")
    curr_apps = _apps_state()
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", "支付宝余额还有 1.23 元")
    checks = task.check_goals(_make_input(_apps_state(), curr_apps))
    assert not all(item["passed"] for item in checks)


def test_alipay_recent_transactions_to_notes_positive():
    task = _tasks_module.AlipayRecentTransactionsToNotes()
    init_apps = _apps_state()
    curr_apps = _apps_state()
    ali = Alipay(init_apps["alipay"])
    txs = sorted(ali.transactions, key=lambda item: int(item["timestamp"]), reverse=True)[:5]
    lines = []
    for tx in txs:
        label = str(tx.get("displayTitle") or tx.get("counterpartyName") or "")
        amount = abs(float(tx["delta"]))
        lines.append(f"{label} {amount:.2f}")
    _add_note(curr_apps["notes"], "最近5笔交易", content="\n".join(lines))
    checks = task.check_goals(_make_input(init_apps, curr_apps))
    assert all(item["passed"] for item in checks)


def test_ebay_lowest_price_to_notes_positive():
    task = _tasks_module.EbayLowestPriceToNotes(query="耳机")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    _set_ebay_search(curr_apps["ebay"], query="耳机")
    top = expect_top(query="耳机", sort_id="priceLow", n=1)[0]
    _add_note(curr_apps["notes"], "耳机最低价", content=f"{top.title}\n{top.total_cost:.2f}")
    checks = task.check_goals(_make_input(init_apps, curr_apps))
    assert all(item["passed"] for item in checks)


def test_ebay_price_below_budget_to_notes_positive():
    task = _tasks_module.EbayPriceBelowBudgetToNotes(product="耳机", price_limit=500.0)
    init_apps = _apps_state()
    curr_apps = _apps_state()
    top = expect_top(query="耳机", sort_id="priceLow", n=1)[0]
    _set_ebay_search(curr_apps["ebay"], query="耳机", sort_option="priceLow")
    curr_apps["ebay"]["search"]["current"]["firstTotalCents"] = int(round(top.total_cost * 100))
    curr_apps["ebay"]["search"]["history"][-1]["firstTotalCents"] = int(round(top.total_cost * 100))
    _add_note(curr_apps["notes"], "预算记录", content=f"{top.title}\n{top.total_cost:.2f}")
    checks = task.check_goals(_make_input(init_apps, curr_apps))
    assert all(item["passed"] for item in checks)


def test_ebay_price_below_budget_only_history_not_current_fails():
    """历史里有正确快照、但 current 已切到无关商品时，应判定失败。"""
    task = _tasks_module.EbayPriceBelowBudgetToNotes(product="耳机", price_limit=500.0)
    init_apps = _apps_state()
    curr_apps = _apps_state()
    top = expect_top(query="耳机", sort_id="priceLow", n=1)[0]
    # 历史里写入正确快照
    correct_snapshot = {
        "query": "耳机", "sortOption": "priceLow",
        "firstTotalCents": int(round(top.total_cost * 100)),
        "conditions": [], "categoryId": "", "brand": "",
    }
    curr_apps["ebay"]["search"]["history"].append(correct_snapshot)
    # 但 current 已经切到无关商品
    _set_ebay_search(curr_apps["ebay"], query="电视", sort_option="bestMatch")
    _add_note(curr_apps["notes"], "预算记录", content=f"{top.title}\n{top.total_cost:.2f}")
    checks = task.check_goals(_make_input(init_apps, curr_apps))
    assert any(
        check["field"] in ("ebay_query", "ebay_cheapest") and check["passed"] is False
        for check in checks
    ), checks


def test_financial_report_to_notes_positive():
    task = _tasks_module.FinancialReportToNotes()
    init_apps = _apps_state()
    curr_apps = _apps_state()
    alipay = Alipay(curr_apps["alipay"])
    _add_note(
        curr_apps["notes"],
        "财务记录",
        content=f"余额 {alipay.total_balance:.2f}\n最近支出 {alipay.last_expense_amount():.2f}",
    )
    checks = task.check_goals(_make_input(init_apps, curr_apps))
    assert all(item["passed"] for item in checks)


def test_ebay_balance_diff_to_notes_uses_current_ebay_and_alipay_state():
    task = _tasks_module.EbayBalanceDiffToNotes(query="耳机")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    _set_ebay_search(curr_apps["ebay"], query="耳机", conditions=["全新"])
    curr_apps["alipay"]["balance"]["total"] = 5000.0
    top = expect_top(query="耳机", condition="全新", sort_id="priceLow", n=1)[0]
    remain = curr_apps["alipay"]["balance"]["total"] - top.total_cost
    _add_note(
        curr_apps["notes"],
        "购物差价记录",
        content=f"{top.title}\n{top.total_cost:.2f}\n剩余余额 {remain:.2f}",
    )
    checks = task.check_goals(_make_input(init_apps, curr_apps))
    assert all(item["passed"] for item in checks), checks


def test_alipay_largest_expense_to_moments_positive():
    task = _tasks_module.AlipayLargestExpenseToMoments()
    init_apps = _apps_state()
    curr_apps = _apps_state()
    ali = Alipay(curr_apps["alipay"])
    tx = ali.largest_expense()
    labels = ali.transaction_labels(tx)
    amount = round(abs(float(tx["delta"])), 2)
    label = next((l for l in labels if l), str(amount))
    _append_wechat_moment(curr_apps["wechat"], f"{label} 花了{amount}元，太心疼了")
    checks = task.check_goals(_make_input(init_apps, curr_apps))
    assert all(item["passed"] for item in checks)


def test_full_shopping_decision_flow_positive():
    task = _tasks_module.FullShoppingDecisionFlow(query="耳机", contact="陈静")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    _set_ebay_search(curr_apps["ebay"], query="耳机", conditions=["全新"])
    top = expect_top(query="耳机", condition="全新", sort_id="priceLow", n=1)[0]
    remain = Alipay(curr_apps["alipay"]).total_balance - top.total_cost
    _add_note(
        curr_apps["notes"],
        "购物决策",
        content=f"{top.title}\n{top.total_cost:.2f}\n购买后余额 {remain:.2f}",
    )
    _append_wechat_outgoing(
        curr_apps["wechat"],
        "陈静",
        f"{top.title} 现在最便宜，总价 {top.total_cost:.2f}，你要不要一起买？",
    )
    checks = task.check_goals(_make_input(init_apps, curr_apps))
    assert all(item["passed"] for item in checks)
