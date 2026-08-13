"""Live scripted-plan verification for the Payment suite.

Single-source policy: contact ids, account/phone numbers, payment passwords,
the running note balances and the balance-page assert text are **not**
injected here — they come from ``scripted_plans.DERIVED_PARAMS``, computed at
materialization time from the episode's post-setup initial state through the
judge-homologous ``Alipay`` / ``Wechat`` domain classes. That is exactly the
official ``--agent scripted`` sampling path, so these live cases
regression-test the derivation itself (the previous ``ALIPAY_START_BALANCE``
disk replica of defaults.json and the ``CONTACT_IDS`` / ``WECHAT_IDS`` lookup
tables are gone).

Only *declared* task parameters stay pinned below, for deterministic
coverage. ``DeterministicBindCards`` additionally pins the bank-card SMS
verification code (a runtime-generated value the plan cannot derive from the
initial state — see the scripted_plans module docstring).
"""

from __future__ import annotations

from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.payment import tasks as payment_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "payment"


async def _force_deterministic_bank_sms_code(env: Any) -> None:
    page = getattr(env, "page", None)
    if page is None:
        return
    await page.evaluate(
        """() => {
            try {
                Object.defineProperty(window.crypto, 'getRandomValues', {
                    configurable: true,
                    value: (array) => {
                        for (let i = 0; i < array.length; i += 1) array[i] = 1;
                        return array;
                    },
                });
            } catch {}
            try {
                Object.defineProperty(Crypto.prototype, 'getRandomValues', {
                    configurable: true,
                    value: (array) => {
                        for (let i = 0; i < array.length; i += 1) array[i] = 1;
                        return array;
                    },
                });
            } catch {}
        }"""
    )


class DeterministicBindCards(payment_tasks.AlipayBindMultipleCardsTransferAndRecordSuccessfulCards):
    @property
    def name(self) -> str:
        return "AlipayBindMultipleCardsTransferAndRecordSuccessfulCards"

    async def _post_sample(self, env: Any) -> None:
        await super()._post_sample(env)
        await _force_deterministic_bank_sms_code(env)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    (
        "AlipayContinuousPaymentsToContactsRecordBalances",
        lambda: payment_tasks.AlipayContinuousPaymentsToContactsRecordBalances(
            contact1="锐(郭锐)",
            amount1=10,
            contact2="于奶奶(于桂兰)",
            amount2=20,
            contact3="浩杰(李浩杰)",
            amount3=30,
            contact4="老王(王建国)",
            amount4=40,
            contact5="阿明(张明)",
            amount5=50,
            noteTitle="脚本工资余额记录",
        ),
    ),
    (
        "AlipayBindMultipleCardsTransferAndRecordSuccessfulCards",
        lambda: DeterministicBindCards(
            targetAccount="13856785678",
            amount1=3500,
            amount2=4500,
            amount3=6500,
            noteTitle="脚本银行卡转账结果",
        ),
    ),
    (
        "AlipayChangePaymentPasswordThenPay",
        lambda: payment_tasks.AlipayChangePaymentPasswordThenPay(
            newPassword="135790",
            contact="浩杰(李浩杰)",
            amount=19.9,
        ),
    ),
    (
        "TransferToContactWithNote",
        lambda: payment_tasks.TransferToContactWithNote(
            name="浩杰(李浩杰)",
            amount=150,
            note="书本费",
        ),
    ),
    (
        "SubscribeMembershipAutoRenewThenCancelInWechat",
        lambda: payment_tasks.SubscribeMembershipAutoRenewThenCancelInWechat(
            membershipType="哔哩哔哩大会员",
            price=15,
            billingCycle="月",
        ),
    ),
    (
        "AlipayTransferAndNotify",
        lambda: payment_tasks.AlipayTransferAndNotify(
            alipay_contact="浩杰(李浩杰)",
            contact="张伟",
            amount=66,
            note="午饭AA",
        ),
    ),
    (
        "WechatExtractAmountTransfer",
        lambda: payment_tasks.WechatExtractAmountTransfer(
            contact="张伟",
            alipay_contact="浩杰(李浩杰)",
            requestAmount=66,
            reply="已经转了",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(payment_tasks)
    missing = declared - covered
    assert not missing, f"Payment tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_payment_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    # 不放宽步数：预算取任务自身声明（长流程任务已声明 max_steps）/难度默认，
    # 与官方 --agent scripted 采样路径完全一致。
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
