"""Live scripted-plan verification for the cross-app commerce suite.

Single-source policy: the whole-sentence reports ({wechat_message} /
{note_content} / {moment_content}), the {contact_wxid} chat locator and the
screen-text evidence values are **not** injected here — they come from
``scripted_plans.DERIVED_PARAMS``, computed at materialization time from the
episode's post-setup initial state through the judge-homologous Alipay /
Wechat / eBay accessors. That is exactly the official ``--agent scripted``
sampling path, so these live cases regression-test the derivation itself.
The previous test-side budgets (defaults.json replica with relative-timestamp
materialization, ``_seeded_balance_for_diff`` sampler-RNG replica, expect_top
sentence builders) are gone.

Only *declared* task parameters stay pinned below, for deterministic
coverage. Notable pins:

- ``EbayDualItemCompareToNotes`` pins two *different* items, exercising the
  dual search + re-sort path (a new query resets the eBay sort).
- ``EbayBalanceDiffToNotes`` no longer pins ``_seed``: the sampler injects a
  random balance and the derived note adapts to whatever was injected.
- ``EbayPriceBelowBudgetToNotes`` runs twice — once under budget (writes the
  note) and once over budget (电脑 ≈ 3756.76 > 1000: must NOT write a note),
  covering both arms of its restricted Branch.
"""

from __future__ import annotations

from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.crossapp_commerce import tasks as commerce_tasks
from bench_env.task.registry import TaskRegistry
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "crossapp_commerce"
CONTACT = "张伟"
QUERY = "电风扇"


def _task(name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{name}", **params)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    (
        "AlipayBalanceToWechat",
        lambda: commerce_tasks.AlipayBalanceToWechat(contact=CONTACT),
    ),
    (
        "AlipayMonthlySpendToWechat",
        lambda: commerce_tasks.AlipayMonthlySpendToWechat(contact=CONTACT),
    ),
    (
        "AlipayRecentTransactionsToNotes",
        lambda: commerce_tasks.AlipayRecentTransactionsToNotes(),
    ),
    (
        "EbayLowestPriceToNotes",
        lambda: commerce_tasks.EbayLowestPriceToNotes(query=QUERY),
    ),
    (
        "EbayProductShareToWechat",
        lambda: commerce_tasks.EbayProductShareToWechat(query=QUERY, contact=CONTACT),
    ),
    (
        "AlipayLargestExpenseToNotes",
        lambda: commerce_tasks.AlipayLargestExpenseToNotes(),
    ),
    (
        "EbayDualItemCompareToNotes",
        lambda: commerce_tasks.EbayDualItemCompareToNotes(item1="电风扇", item2="耳机"),
    ),
    (
        "AlipayLargestExpenseToMoments",
        lambda: commerce_tasks.AlipayLargestExpenseToMoments(),
    ),
    (
        "AlipayMonthlyToNotesAndWechat",
        lambda: commerce_tasks.AlipayMonthlyToNotesAndWechat(contact=CONTACT),
    ),
    (
        "EbayBalanceDiffToNotes",
        lambda: commerce_tasks.EbayBalanceDiffToNotes(query=QUERY),
    ),
    (
        "EbayDualItemBalanceToNotes",
        lambda: commerce_tasks.EbayDualItemBalanceToNotes(item1="电风扇", item2="耳机"),
    ),
    (
        "FullShoppingDecisionFlow",
        lambda: commerce_tasks.FullShoppingDecisionFlow(query=QUERY, contact=CONTACT),
    ),
    (
        "AlipayShareBillDetail",
        lambda: commerce_tasks.AlipayShareBillDetail(contact=CONTACT),
    ),
    (
        "FinancialReportToNotes",
        lambda: commerce_tasks.FinancialReportToNotes(),
    ),
    (
        "EbayPriceBelowBudgetToNotes",
        lambda: commerce_tasks.EbayPriceBelowBudgetToNotes(product=QUERY, price_limit=500.0),
    ),
    (
        "EbayPriceBelowBudgetToNotes_over",
        lambda: commerce_tasks.EbayPriceBelowBudgetToNotes(product="电脑", price_limit=1000.0),
    ),
    (
        "AlipayThankTopIncomeTransfer",
        lambda: _task("AlipayThankTopIncomeTransfer"),
    ),
    (
        "AlipayYearCompareTopExpenseToWechat",
        lambda: _task("AlipayYearCompareTopExpenseToWechat", contact=CONTACT),
    ),
    (
        "BillTypeYearSummaryToWechat",
        lambda: _task("BillTypeYearSummaryToWechat", bill_type="订单", contact=CONTACT),
    ),
    (
        "MonthCompareThenExplainToNote",
        lambda: _task("MonthCompareThenExplainToNote", month1="2026-01", month2="2025-12"),
    ),
    (
        "Top3ExpenseSummaryToWechat",
        lambda: _task("Top3ExpenseSummaryToWechat", contact="黄勇"),
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
