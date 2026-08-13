"""Live scripted-plan verification for the Alipay suite.

Single-source policy: answers and entity ids (``answer``, ``phone``,
``contact_id``, ``conversation_id``, ``font_slider_fraction``) are **not**
injected here — they come from ``scripted_plans.DERIVED_PARAMS``, computed at
materialization time from the episode's post-setup initial state through the
judge-homologous ``Alipay`` domain class. That is exactly the official
``--agent scripted`` sampling path, so these live cases regression-test the
derivation itself (the previous defaults.json disk replica of the runtime
fixture is gone — the real initial state already carries the enriched
absolute ``transferRecords`` timestamps that ``Alipay``'s bill arithmetic
expects, which raw defaults.json does not).

Only *declared* task parameters stay pinned below, for deterministic
coverage: fixed contact/conversation/month/keyword/level values keep the
expected answers and the browse geometry stable across live runs.
"""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.alipay import tasks as alipay_tasks
from bench_env.task.base import BaseTask
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "alipay"

SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("FindFriend", lambda: alipay_tasks.FindFriend(name="阿明")),
    (
        "MonthlyIncomeByCounterparty",
        lambda: alipay_tasks.MonthlyIncomeByCounterparty(month="2026-01", name="Hui"),
    ),
    ("CheckDailyIncome", lambda: alipay_tasks.CheckDailyIncome()),
    ("EnableDarkMode", lambda: alipay_tasks.EnableDarkMode()),
    ("CheckLatestMessageContent", lambda: alipay_tasks.CheckLatestMessageContent(name="正中")),
    ("SetPayOrderCcbYuebaoBalance", lambda: alipay_tasks.SetPayOrderCcbYuebaoBalance()),
    ("AnalyzeSpending", lambda: alipay_tasks.AnalyzeSpending()),
    ("CountLargeTransferIncomes", lambda: alipay_tasks.CountLargeTransferIncomes(amount=1000)),
    ("CheckUnreadMessageCount", lambda: alipay_tasks.CheckUnreadMessageCount()),
    ("CheckBalance", lambda: alipay_tasks.CheckBalance()),
    ("DisableAllNotifications", lambda: alipay_tasks.DisableAllNotifications()),
    ("ShowReceiveQRCode", lambda: alipay_tasks.ShowReceiveQRCode()),
    ("SearchTransferRecords", lambda: alipay_tasks.SearchTransferRecords(keyword="转账")),
    (
        "SendMessageToContact",
        lambda: alipay_tasks.SendMessageToContact(contact="老王(王建国)", text="发票抬头是XX公司"),
    ),
    ("ConfigureLanguageAndFastPay", lambda: alipay_tasks.ConfigureLanguageAndFastPay()),
    ("EnableRefreshSound", lambda: alipay_tasks.EnableRefreshSound()),
    ("SetFontSizeLevel", lambda: alipay_tasks.SetFontSizeLevel(font_size_level=4)),
    (
        "CalculateMonthlyExpenseTrend",
        lambda: alipay_tasks.CalculateMonthlyExpenseTrend(month1="2026-01", month2="2025-12"),
    ),
    ("FindLargestTransferPartner", lambda: alipay_tasks.FindLargestTransferPartner()),
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
