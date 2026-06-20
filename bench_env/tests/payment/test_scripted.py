"""Live scripted-plan verification for the Payment suite."""

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
PAYMENT_MAX_STEPS = 180


CONTACT_IDS = {
    "浩杰(李浩杰)": "1",
    "锐(郭锐)": "2",
    "阿明(张明)": "3",
    "小丽(李丽)": "4",
    "老王(王建国)": "5",
    "于奶奶(于桂兰)": "8",
}

WECHAT_IDS = {
    "张伟": "wxid_zhangwei_888",
}

ALIPAY_START_BALANCE = 100_023.46


def _money(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _balances_after(amounts: list[float]) -> dict[str, str]:
    running = ALIPAY_START_BALANCE
    out: dict[str, str] = {}
    for index, amount in enumerate(amounts, start=1):
        running = max(0.0, running - amount)
        out[f"balance{index}"] = _money(running)
    return out


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
            contact1Id=CONTACT_IDS["锐(郭锐)"],
            amount1=10,
            contact2="于奶奶(于桂兰)",
            contact2Id=CONTACT_IDS["于奶奶(于桂兰)"],
            amount2=20,
            contact3="浩杰(李浩杰)",
            contact3Id=CONTACT_IDS["浩杰(李浩杰)"],
            amount3=30,
            contact4="老王(王建国)",
            contact4Id=CONTACT_IDS["老王(王建国)"],
            amount4=40,
            contact5="阿明(张明)",
            contact5Id=CONTACT_IDS["阿明(张明)"],
            amount5=50,
            noteTitle="脚本工资余额记录",
            password="123456",
            **_balances_after([10, 20, 30, 40, 50]),
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
            password="123456",
        ),
    ),
    (
        "AlipayChangePaymentPasswordThenPay",
        lambda: payment_tasks.AlipayChangePaymentPasswordThenPay(
            oldPassword="000000",
            newPassword="135790",
            contact="浩杰(李浩杰)",
            contactId=CONTACT_IDS["浩杰(李浩杰)"],
            amount=19.9,
        ),
    ),
    (
        "TransferToContactWithNote",
        lambda: payment_tasks.TransferToContactWithNote(
            name="浩杰(李浩杰)",
            contactId=CONTACT_IDS["浩杰(李浩杰)"],
            amount=150,
            note="书本费",
            password="123456",
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
            alipayContactId=CONTACT_IDS["浩杰(李浩杰)"],
            contact="张伟",
            wechatId=WECHAT_IDS["张伟"],
            amount=66,
            note="午饭AA",
            password="123456",
        ),
    ),
    (
        "WechatExtractAmountTransfer",
        lambda: payment_tasks.WechatExtractAmountTransfer(
            contact="张伟",
            wechatId=WECHAT_IDS["张伟"],
            alipay_contact="浩杰(李浩杰)",
            alipayContactId=CONTACT_IDS["浩杰(李浩杰)"],
            requestAmount=66,
            reply="已经转了",
            password="123456",
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
    res = await run_scripted(env, make_task(), suite=SUITE, max_steps=PAYMENT_MAX_STEPS)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
