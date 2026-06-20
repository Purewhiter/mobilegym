"""Live scripted-plan verification for the Alipay suite."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.alipay.app import Alipay
from bench_env.task.alipay import tasks as alipay_tasks
from bench_env.task.base import BaseTask
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "alipay"
ROOT = Path(__file__).resolve().parents[3]
DEFAULTS = json.loads((ROOT / "apps" / "Alipay" / "data" / "defaults.json").read_text(encoding="utf-8"))


def _contact_by_name(name: str) -> dict[str, Any]:
    return next(c for c in DEFAULTS["contacts"] if name in str(c["name"]))


def _conversation_by_name(name: str) -> dict[str, Any]:
    return next(c for c in DEFAULTS["conversations"] if name in str(c["name"]))


def _count_search(keyword: str) -> int:
    return Alipay(DEFAULTS).count_bill_search_results(keyword)


def _monthly_income(month: str, name: str) -> str:
    total = 0.0
    for record in DEFAULTS["transferRecords"]:
        ts = str(record["timestamp"])
        if not ts.startswith(month):
            continue
        delta = float(record["delta"])
        if delta > 0 and name in str(record["counterpartyName"]):
            total += delta
    return f"{round(total, 2):g}"


def _latest_five_spending_total() -> str:
    # The first five records are the relative-time latest records in the runtime fixture.
    total = sum(abs(float(r["delta"])) for r in DEFAULTS["transferRecords"][:5] if float(r["delta"]) < 0)
    return f"{round(total, 2):g}"


def _large_transfer_income_count(amount: int) -> str:
    count = sum(
        1
        for record in DEFAULTS["transferRecords"]
        if float(record["delta"]) > amount and str(record["counterpartyName"]).startswith("转账")
    )
    return str(count)


def _monthly_expense(month: str) -> float:
    total = 0.0
    for record in DEFAULTS["transferRecords"]:
        ts = str(record["timestamp"])
        if ts.startswith(month) and float(record["delta"]) < 0:
            total += abs(float(record["delta"]))
    return total


def _higher_expense_month(month1: str, month2: str) -> str:
    exp1 = _monthly_expense(month1)
    exp2 = _monthly_expense(month2)
    if exp1 > exp2:
        return month1
    if exp2 > exp1:
        return month2
    return "一样"


def _largest_transfer_partner() -> str:
    totals: dict[str, float] = {}
    for record in DEFAULTS["transferRecords"]:
        name = str(record["counterpartyName"])
        totals[name] = totals.get(name, 0.0) + abs(float(record["delta"]))
    return max(totals, key=totals.get)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    (
        "FindFriend",
        lambda: alipay_tasks.FindFriend(
            name="阿明",
            contact_id=_contact_by_name("阿明")["id"],
            phone=_contact_by_name("阿明")["phone"],
        ),
    ),
    (
        "MonthlyIncomeByCounterparty",
        lambda: alipay_tasks.MonthlyIncomeByCounterparty(
            month="2026-01",
            name="Hui",
            answer=_monthly_income("2026-01", "Hui"),
        ),
    ),
    ("CheckDailyIncome", lambda: alipay_tasks.CheckDailyIncome(answer=str(DEFAULTS["balance"]["dailyIncome"]))),
    ("EnableDarkMode", lambda: alipay_tasks.EnableDarkMode()),
    (
        "CheckLatestMessageContent",
        lambda: alipay_tasks.CheckLatestMessageContent(
            name="正中",
            conversation_id=_conversation_by_name("正中")["id"],
            answer=_conversation_by_name("正中")["lastContent"],
        ),
    ),
    ("SetPayOrderCcbYuebaoBalance", lambda: alipay_tasks.SetPayOrderCcbYuebaoBalance()),
    ("AnalyzeSpending", lambda: alipay_tasks.AnalyzeSpending(answer=_latest_five_spending_total())),
    (
        "CountLargeTransferIncomes",
        lambda: alipay_tasks.CountLargeTransferIncomes(
            amount=1000,
            answer=_large_transfer_income_count(1000),
        ),
    ),
    ("CheckUnreadMessageCount", lambda: alipay_tasks.CheckUnreadMessageCount(answer="18")),
    ("CheckBalance", lambda: alipay_tasks.CheckBalance(answer=str(DEFAULTS["balance"]["total"]))),
    ("DisableAllNotifications", lambda: alipay_tasks.DisableAllNotifications()),
    ("ShowReceiveQRCode", lambda: alipay_tasks.ShowReceiveQRCode()),
    (
        "SearchTransferRecords",
        lambda: alipay_tasks.SearchTransferRecords(keyword="转账", answer=str(_count_search("转账"))),
    ),
    (
        "SendMessageToContact",
        lambda: alipay_tasks.SendMessageToContact(
            contact="老王(王建国)",
            contact_id=_contact_by_name("老王")["id"],
            text="发票抬头是XX公司",
        ),
    ),
    ("ConfigureLanguageAndFastPay", lambda: alipay_tasks.ConfigureLanguageAndFastPay()),
    ("EnableRefreshSound", lambda: alipay_tasks.EnableRefreshSound()),
    ("SetFontSizeLevel", lambda: alipay_tasks.SetFontSizeLevel(font_size_level=4)),
    (
        "CalculateMonthlyExpenseTrend",
        lambda: alipay_tasks.CalculateMonthlyExpenseTrend(
            month1="2026-01",
            month2="2025-12",
            answer=_higher_expense_month("2026-01", "2025-12"),
        ),
    ),
    ("FindLargestTransferPartner", lambda: alipay_tasks.FindLargestTransferPartner(answer=_largest_transfer_partner())),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(alipay_tasks)
    missing = declared - covered
    assert not missing, f"Alipay tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_alipay_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
