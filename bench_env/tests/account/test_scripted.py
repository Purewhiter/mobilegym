"""Live scripted-plan verification for the Account suite."""

from __future__ import annotations

from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.account import tasks as account_tasks
from bench_env.task.base import BaseTask
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "account"


async def _force_deterministic_sms_code(env: Any) -> None:
    page = getattr(env, "page", None)
    if page is None:
        return
    await page.evaluate("() => { Math.random = () => 0.1; }")


class DeterministicRegisterThenLogin(account_tasks.Railway12306RegisterThenLogin):
    @property
    def name(self) -> str:
        return "Railway12306RegisterThenLogin"

    async def _post_sample(self, env: Any) -> None:
        await super()._post_sample(env)
        await _force_deterministic_sms_code(env)


class DeterministicChangePassword(account_tasks.Railway12306ChangePassword):
    @property
    def name(self) -> str:
        return "Railway12306ChangePassword"

    async def _post_sample(self, env: Any) -> None:
        await super()._post_sample(env)
        await _force_deterministic_sms_code(env)


class DeterministicForgotPasswordReset(account_tasks.Railway12306ForgotPasswordReset):
    @property
    def name(self) -> str:
        return "Railway12306ForgotPasswordReset"

    async def _post_sample(self, env: Any) -> None:
        await super()._post_sample(env)
        await _force_deterministic_sms_code(env)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    (
        "Railway12306LoginWithAccount",
        lambda: account_tasks.Railway12306LoginWithAccount(
            noteTitle="12306账号密码",
            username="user_123",
            correctPassword="123456",
            otherPasswords="111111,888888,password",
        ),
    ),
    (
        "Railway12306RegisterThenLogin",
        lambda: DeterministicRegisterThenLogin(
            username="script_user_01",
            password="Reg2026x",
            name="张三",
            idNo="110101199001011234",
            phone="13800000000",
            email="script_user_01@example.com",
        ),
    ),
    (
        "Railway12306ChangePassword",
        lambda: DeterministicChangePassword(oldPassword="123456", newPassword="Abc_5678"),
    ),
    ("WechatAccountCancellation", lambda: account_tasks.WechatAccountCancellation()),
    (
        "Railway12306ForgotPasswordReset",
        lambda: DeterministicForgotPasswordReset(
            accountPhone="17366666695",
            idNo="110101199001011234",
            newPassword="NewP@ssw0rd123",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(account_tasks)
    missing = declared - covered
    assert not missing, f"Account tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_account_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
