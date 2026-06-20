"""Live scripted-plan verification for the cross-app commerce suite."""

from __future__ import annotations

import datetime as dt
import json
import random
import re
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.alipay.app import Alipay
from bench_env.task.base import BaseTask
from bench_env.task.crossapp_commerce import tasks as commerce_tasks
from bench_env.task.ebay.app import EBAY_SEARCH_QUERY_PARAM, Ebay, expect_top
from bench_env.task.registry import TaskRegistry
from bench_env.task.wechat.app import Wechat
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "crossapp_commerce"
ROOT = Path(__file__).resolve().parents[3]
CONTACT = "张伟"
CONTACT_WXID = "wxid_zhangwei_888"
QUERY = "电风扇"
ITEM = "电风扇"
BALANCE_DIFF_SEED = 20260617


def _load_json(*parts: str) -> dict[str, Any]:
    return json.loads(ROOT.joinpath(*parts).read_text(encoding="utf-8"))


_RELATIVE_TIME_RE = re.compile(r"(\d+)([wdhms])")
_UNIT_MS = {
    "w": 7 * 24 * 60 * 60 * 1000,
    "d": 24 * 60 * 60 * 1000,
    "h": 60 * 60 * 1000,
    "m": 60 * 1000,
    "s": 1000,
}


def _now_ms() -> int:
    return int(dt.datetime.now().timestamp() * 1000)


def _parse_timestamp(value: Any, *, now_ms: int) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    if not isinstance(value, str):
        raise TypeError(f"Unsupported timestamp value: {value!r}")
    text = value.strip()
    if re.fullmatch(r"[+-]?(\d+[wdhms])+", text):
        total = 0
        for amount, unit in _RELATIVE_TIME_RE.findall(text):
            total += int(amount) * _UNIT_MS[unit]
        return now_ms - total if text.startswith("-") else now_ms + total
    return int(dt.datetime.strptime(text, "%Y-%m-%d %H:%M:%S").timestamp() * 1000)


def _alipay_state() -> dict[str, Any]:
    now_ms = _now_ms()
    state = _load_json("apps", "Alipay", "data", "defaults.json")
    for record in state["transferRecords"]:
        record["timestamp"] = _parse_timestamp(record["timestamp"], now_ms=now_ms)
    for item in state["notifications"]:
        item["timestamp"] = _parse_timestamp(item["timestamp"], now_ms=now_ms)
    for conv in state["conversations"]:
        conv["lastTimestamp"] = _parse_timestamp(conv["lastTimestamp"], now_ms=now_ms)
        conv["lastReadAt"] = _parse_timestamp(conv["lastReadAt"], now_ms=now_ms)
    for messages in state["chatHistory"].values():
        for msg in messages:
            msg["timestamp"] = _parse_timestamp(msg["timestamp"], now_ms=now_ms)
    return state


def _ali() -> Alipay:
    return Alipay(_alipay_state())


def _wechat() -> Wechat:
    return Wechat(_load_json("apps", "Wechat", "data", "defaults.json"))


def _fmt(value: float) -> str:
    return f"{float(value):.2f}"


def _monthly_expense() -> float:
    month = dt.datetime.now().strftime("%Y-%m")
    return round(_ali().monthly_expense(month), 2)


def _latest_transactions_note() -> str:
    ali = _ali()
    lines: list[str] = []
    for tx in ali.latest_n_transactions(5):
        label = ali.transaction_labels(tx)[0]
        amount = abs(float(tx["delta"]))
        lines.append(f"{label} {_fmt(amount)}")
    return "\n".join(lines)


def _largest_expense_note() -> str:
    ali = _ali()
    tx = ali.largest_expense()
    return f"{ali.transaction_primary_label(tx)} {_fmt(abs(float(tx['delta'])))}"


def _largest_expense_moment() -> str:
    ali = _ali()
    tx = ali.largest_expense()
    return f"这笔支出有点夸张：{ali.transaction_labels(tx)[0]} {_fmt(abs(float(tx['delta'])))}"


def _latest_bill_message() -> str:
    ali = _ali()
    return f"{ali.latest_expense_merchant()} {_fmt(ali.last_expense_amount())}"


def _seeded_balance_for_diff() -> float:
    rng = random.Random(BALANCE_DIFF_SEED)
    rng.choice(list(EBAY_SEARCH_QUERY_PARAM["values"]))
    return round(rng.uniform(5000, 10000), 2)


def _top(query: str = QUERY, *, condition: str | None = None):
    return expect_top(query=query, sort_id="priceLow", condition=condition, n=1)[0]


def _top_note(query: str = QUERY, *, condition: str | None = None) -> str:
    top = _top(query, condition=condition)
    return f"{top.title}\n{_fmt(top.total_cost)}"


def _compare_note() -> str:
    winner, _first, _second, diff = Ebay({}).compare_cheapest_products(query1=ITEM, query2=ITEM)
    return f"{ITEM} 和 {ITEM} 最低价相同，结果 {winner}，差价 {_fmt(diff)}"


def _dual_balance_note() -> str:
    ali = _ali()
    first = _top(ITEM)
    second = _top(ITEM)
    remain = float(ali.total_balance) - first.total_cost - second.total_cost
    return f"{first.title} {_fmt(first.total_cost)}\n{second.title} {_fmt(second.total_cost)}\n剩余余额 {_fmt(remain)}"


def _balance_diff_note(balance: float | None = None) -> str:
    top = _top(QUERY, condition="全新")
    remain = float(balance if balance is not None else _ali().total_balance) - top.total_cost
    return f"{top.title}\n价格 {_fmt(top.total_cost)}\n购买后余额 {_fmt(remain)}"


def _full_flow_note() -> str:
    top = _top(QUERY, condition="全新")
    remain = float(_ali().total_balance) - top.total_cost
    return f"{top.title}\n购买后余额 {_fmt(remain)}"


def _contact_params() -> dict[str, str]:
    assert _wechat().require_contact_wxid(CONTACT) == CONTACT_WXID
    return {"contact": CONTACT, "contact_wxid": CONTACT_WXID}


def _task(name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{name}", **params)


def _income_transfer_note() -> str:
    ali = _ali()
    top = ali.largest_incoming_transfer()
    return f"{ali.incoming_transfer_count()}\n{_fmt(float(top['delta']))}"


def _year_compare_message() -> str:
    ali = _ali()
    this_year = dt.date.today().year
    last_year = this_year - 1
    this_top = ali.yearly_largest_expense(this_year)
    last_top = ali.yearly_largest_expense(last_year)
    this_amt = abs(float(this_top["delta"]))
    last_amt = abs(float(last_top["delta"]))
    winner = this_top if this_amt > last_amt else last_top
    return f"{Alipay.transfer_counterparty_label(winner)} {_fmt(max(this_amt, last_amt))}"


def _bill_type_message(bill_type: str) -> str:
    count, spending = _ali().bill_type_year_summary(
        bill_type,
        dt.date.today().year,
        until_ms=_now_ms(),
    )
    return f"{bill_type} 今年共 {count} 笔，花费 {_fmt(spending)} 元"


def _month_display(month: str) -> str:
    year, month_num = month.split("-", 1)
    return f"{year}年{int(month_num)}月"


def _month_compare_note(month1: str, month2: str) -> str:
    ali = _ali()
    exp1 = round(ali.monthly_expense(month1), 2)
    exp2 = round(ali.monthly_expense(month2), 2)
    if exp1 > exp2:
        winner = _month_display(month1)
    elif exp2 > exp1:
        winner = _month_display(month2)
    else:
        winner = "一样"
    return (
        f"{_month_display(month1)} 花销 {_fmt(exp1)}\n"
        f"{_month_display(month2)} 花销 {_fmt(exp2)}\n"
        f"{winner} 花得更多\n"
        f"差额 {_fmt(abs(exp1 - exp2))}"
    )


def _top3_expense_message() -> str:
    ts_now = _now_ms()
    thirty_days_ago = ts_now - 30 * 86400 * 1000
    expenses = [
        tx
        for tx in _ali().transactions
        if float(tx["delta"]) < 0 and int(tx["timestamp"]) >= thirty_days_ago
    ]
    expenses.sort(key=lambda tx: abs(float(tx["delta"])), reverse=True)
    lines = []
    for tx in expenses[:3]:
        label = _ali().transaction_labels(tx)[0]
        lines.append(f"{label} {_fmt(abs(float(tx['delta'])))}")
    lines.append("我最近得省着点了")
    return "\n".join(lines)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    (
        "AlipayBalanceToWechat",
        lambda: commerce_tasks.AlipayBalanceToWechat(
            **_contact_params(),
            wechat_message=f"支付宝余额 {_fmt(_ali().total_balance)} 元",
        ),
    ),
    (
        "AlipayMonthlySpendToWechat",
        lambda: commerce_tasks.AlipayMonthlySpendToWechat(
            **_contact_params(),
            wechat_message=f"本月支付宝支出 {_fmt(_monthly_expense())} 元",
        ),
    ),
    (
        "AlipayRecentTransactionsToNotes",
        lambda: commerce_tasks.AlipayRecentTransactionsToNotes(note_content=_latest_transactions_note()),
    ),
    (
        "EbayLowestPriceToNotes",
        lambda: commerce_tasks.EbayLowestPriceToNotes(query=QUERY, note_content=_top_note(QUERY)),
    ),
    (
        "EbayProductShareToWechat",
        lambda: commerce_tasks.EbayProductShareToWechat(
            query=QUERY,
            **_contact_params(),
            wechat_message=f"{_top(QUERY, condition='全新').title} 总价 {_fmt(_top(QUERY, condition='全新').total_cost)}，你觉得怎么样？",
        ),
    ),
    (
        "AlipayLargestExpenseToNotes",
        lambda: commerce_tasks.AlipayLargestExpenseToNotes(note_content=_largest_expense_note()),
    ),
    (
        "EbayDualItemCompareToNotes",
        lambda: commerce_tasks.EbayDualItemCompareToNotes(
            item1=ITEM,
            item2=ITEM,
            query=ITEM,
            note_content=_compare_note(),
        ),
    ),
    (
        "AlipayLargestExpenseToMoments",
        lambda: commerce_tasks.AlipayLargestExpenseToMoments(moment_content=_largest_expense_moment()),
    ),
    (
        "AlipayMonthlyToNotesAndWechat",
        lambda: commerce_tasks.AlipayMonthlyToNotesAndWechat(
            **_contact_params(),
            note_content=f"本月支付宝总支出 {_fmt(_monthly_expense())} 元",
            wechat_message=f"支付宝这个月花了 {_fmt(_monthly_expense())} 元",
        ),
    ),
    (
        "EbayBalanceDiffToNotes",
        lambda: commerce_tasks.EbayBalanceDiffToNotes(
            _seed=BALANCE_DIFF_SEED,
            query=QUERY,
            note_content=_balance_diff_note(_seeded_balance_for_diff()),
        ),
    ),
    (
        "EbayDualItemBalanceToNotes",
        lambda: commerce_tasks.EbayDualItemBalanceToNotes(
            item1=ITEM,
            item2=ITEM,
            query=ITEM,
            note_content=_dual_balance_note(),
        ),
    ),
    (
        "FullShoppingDecisionFlow",
        lambda: commerce_tasks.FullShoppingDecisionFlow(
            query=QUERY,
            **_contact_params(),
            note_content=_full_flow_note(),
            wechat_message=f"一起看看这款：{_top(QUERY, condition='全新').title}",
        ),
    ),
    (
        "AlipayShareBillDetail",
        lambda: commerce_tasks.AlipayShareBillDetail(
            **_contact_params(),
            wechat_message=_latest_bill_message(),
        ),
    ),
    (
        "FinancialReportToNotes",
        lambda: commerce_tasks.FinancialReportToNotes(
            note_content=f"余额 {_fmt(_ali().total_balance)}\n最近一笔消费 {_fmt(_ali().last_expense_amount())}",
        ),
    ),
    (
        "EbayPriceBelowBudgetToNotes",
        lambda: commerce_tasks.EbayPriceBelowBudgetToNotes(
            product=QUERY,
            query=QUERY,
            price_limit=500.0,
            note_content=_top_note(QUERY),
        ),
    ),
    (
        "AlipayThankTopIncomeTransfer",
        lambda: _task(
            "AlipayThankTopIncomeTransfer",
            contact_wxid="wxid_若溪",
            note_content=_income_transfer_note(),
            wechat_message="谢谢你，这笔转账我收到了。",
        ),
    ),
    (
        "AlipayYearCompareTopExpenseToWechat",
        lambda: _task(
            "AlipayYearCompareTopExpenseToWechat",
            **_contact_params(),
            wechat_message=_year_compare_message(),
        ),
    ),
    (
        "BillTypeYearSummaryToWechat",
        lambda: _task(
            "BillTypeYearSummaryToWechat",
            bill_type="订单",
            **_contact_params(),
            wechat_message=_bill_type_message("订单"),
        ),
    ),
    (
        "MonthCompareThenExplainToNote",
        lambda: _task(
            "MonthCompareThenExplainToNote",
            month1="2026-01",
            month2="2025-12",
            note_content=_month_compare_note("2026-01", "2025-12"),
        ),
    ),
    (
        "Top3ExpenseSummaryToWechat",
        lambda: _task(
            "Top3ExpenseSummaryToWechat",
            contact="黄勇",
            contact_wxid=_wechat().require_contact_wxid("黄勇"),
            wechat_message=_top3_expense_message(),
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(commerce_tasks)
    missing = declared - covered
    assert not missing, f"crossapp_commerce tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_crossapp_commerce_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
