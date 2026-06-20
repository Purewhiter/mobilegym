"""Live scripted-plan verification for the SMS suite."""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.sms import tasks as sms_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "sms"

SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("ToggleMainSetting", lambda: sms_tasks.ToggleMainSetting(setting_key="show_avatar", enabled=False)),
    ("OpenConversationBySender", lambda: sms_tasks.OpenConversationBySender(conversation_id="china-telecom")),
    ("ReadUnreadConversationCount", lambda: sms_tasks.ReadUnreadConversationCount()),
    ("ReplyToConversation", lambda: sms_tasks.ReplyToConversation(sender="中国联通", content="稍后联系")),
    ("MarkAllConversationsRead", lambda: sms_tasks.MarkAllConversationsRead()),
    ("ToggleFreeNetworkSetting", lambda: sms_tasks.ToggleFreeNetworkSetting(setting_key="block_strangers", enabled=False)),
    (
        "CompareConversationMessageCount",
        lambda: sms_tasks.CompareConversationMessageCount(sender1="中国电信", sender2="中国联通"),
    ),
    ("DeleteConversation", lambda: sms_tasks.DeleteConversation(sender="建设银行")),
    ("ReplyToLatestUnread", lambda: sms_tasks.ReplyToLatestUnread(content="好的收到")),
    ("FindAndReplySendersByKeyword", lambda: sms_tasks.FindAndReplySendersByKeyword(keyword="套餐", reply="拒收")),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(sms_tasks)
    missing = declared - covered
    assert not missing, f"SMS tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_sms_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
