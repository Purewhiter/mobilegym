"""Live scripted-plan verification for the X suite."""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.x import tasks as x_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "x"

PRIMARY_POST = {
    "post_id": "p_1879539450872778943",
    "author_handle": "@yuyy614893671",
    "post_preview": "扣除食物和能源的核心CPI意外下降 哈哈哈哈哈",
}


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    (
        "SetAudiencePrivacyBundle",
        lambda: x_tasks.SetAudiencePrivacyBundle(
            private_posts=True,
            protect_videos=True,
            photo_tagging=False,
        ),
    ),
    ("SetCallPermissionsBundle", lambda: x_tasks.SetCallPermissionsBundle()),
    ("SetPushNotificationMix", lambda: x_tasks.SetPushNotificationMix()),
    (
        "QuotePostAndTweet",
        lambda: x_tasks.QuotePostAndTweet(
            **PRIMARY_POST,
            content="scripted quote from x",
        ),
    ),
    (
        "SendDmToConversation",
        lambda: x_tasks.SendDmToConversation(
            conversation_id="c1",
            participant_handle="@waylybaye",
            last_message_preview="Indie dev life is hard bro",
            content="scripted dm from x",
        ),
    ),
    ("SearchAndBookmark", lambda: x_tasks.SearchAndBookmark(keyword="Tesla")),
    (
        "FollowUserAndLikeTheirPost",
        lambda: x_tasks.FollowUserAndLikeTheirPost(
            user_handle="@yuyy614893671",
            user_name="金融汪",
        ),
    ),
    (
        "ReplyAndRetweetSamePost",
        lambda: x_tasks.ReplyAndRetweetSamePost(
            **PRIMARY_POST,
            reply_content="scripted reply from x",
        ),
    ),
    ("ComplexSettingsChain", lambda: x_tasks.ComplexSettingsChain()),
    (
        "SearchMultipleKeywordsAndInteract",
        lambda: x_tasks.SearchMultipleKeywordsAndInteract(
            keyword1="Grok",
            keyword2="Linux",
        ),
    ),
    (
        "PostWithImageAndReply",
        lambda: x_tasks.PostWithImageAndReply(
            content="scripted original x post",
            reply_content="scripted self reply",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(x_tasks)
    missing = declared - covered
    assert not missing, f"X tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_x_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
