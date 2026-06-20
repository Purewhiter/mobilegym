"""Live scripted-plan verification for the Reddit suite."""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.reddit import tasks as reddit_tasks
from bench_env.task.reddit.app import Reddit
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "reddit"

FIXTURE_POST = Reddit.fixture_post()
FIXTURE_POST_WITH_COMMENTS = {
    "post_id": "post_1rev3pa",
    "comment_id": "o7ftmd0",
}
RANK_15_POST = {
    "post_id": "post_1rf829s",
    "post_title": "Canadian man in ICE custody says he thought agents were only focusing on ‘criminals and murderers’",
    "feed_rank": 15,
}


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("Reddit_DisableCommunityThemes", lambda: reddit_tasks.Reddit_DisableCommunityThemes()),
    ("Reddit_AdvancedPrivacyToggles", lambda: reddit_tasks.Reddit_AdvancedPrivacyToggles()),
    ("Reddit_TurnOffMatureContentButKeepUnblurred", lambda: reddit_tasks.Reddit_TurnOffMatureContentButKeepUnblurred()),
    ("Reddit_OpenLinksOutsideApp", lambda: reddit_tasks.Reddit_OpenLinksOutsideApp()),
    ("Reddit_JoinCommunityFromFeed", lambda: reddit_tasks.Reddit_JoinCommunityFromFeed(community="r/memes")),
    (
        "Reddit_UpvoteSpecificFeedPost",
        lambda: reddit_tasks.Reddit_UpvoteSpecificFeedPost(**RANK_15_POST),
    ),
    (
        "Reddit_CreatePostToCommunity",
        lambda: reddit_tasks.Reddit_CreatePostToCommunity(
            community="r/China_irl",
            title="Bench scripted Reddit title",
            body="Bench scripted Reddit body",
        ),
    ),
    (
        "Reddit_AddCommentToPost",
        lambda: reddit_tasks.Reddit_AddCommentToPost(
            post_id=str(FIXTURE_POST["id"]),
            post_title=str(FIXTURE_POST["title"]),
            comment="scripted reddit comment",
        ),
    ),
    (
        "Reddit_DeleteSeededOwnComment",
        lambda: reddit_tasks.Reddit_DeleteSeededOwnComment(
            post_title=str(FIXTURE_POST["title"]),
            seed_comment="我也遇到过类似情况，先从每天提前 10 分钟开始会更容易坚持。",
        ),
    ),
    (
        "Reddit_SendChatMessage",
        lambda: reddit_tasks.Reddit_SendChatMessage(
            username="Intelligent_Drama_46",
            message="scripted chat hello",
        ),
    ),
    (
        "Reddit_DeleteSeededChatMessage",
        lambda: reddit_tasks.Reddit_DeleteSeededChatMessage(
            username="Objective-Skill-2591",
            seed_message="我等下去把快递拿一下,晚点回你。",
            message_id="ct_obj_2",
        ),
    ),
    ("Reddit_UpvoteAnyComment", lambda: reddit_tasks.Reddit_UpvoteAnyComment(**FIXTURE_POST_WITH_COMMENTS)),
    (
        "Reddit_EditSeededOwnComment",
        lambda: reddit_tasks.Reddit_EditSeededOwnComment(
            seed_comment="补充一点：晚上早点放下手机真的有用。",
            new_comment="scripted edit keeps this comment deterministic",
        ),
    ),
    (
        "Reddit_UpdateProfileBio",
        lambda: reddit_tasks.Reddit_UpdateProfileBio(bio="scripted reddit bio"),
    ),
    (
        "Reddit_DeleteSeededOwnPost",
        lambda: reddit_tasks.Reddit_DeleteSeededOwnPost(seed_title="有没有人也会半夜突然想整理房间?"),
    ),
    (
        "Reddit_DeepThreadReplyAndDeleteSeedMessage",
        lambda: reddit_tasks.Reddit_DeepThreadReplyAndDeleteSeedMessage(
            username="Objective-Skill-2591",
            thread_source_message_id="ct_obj_1",
            thread_seed_message="你上次推荐的那家店我去了,味道确实不错!",
            delete_message_id="ct_obj_2",
            delete_seed_message="我等下去把快递拿一下,晚点回你。",
            reply="scripted deep thread reply",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(reddit_tasks)
    missing = declared - covered
    assert not missing, f"Reddit tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_reddit_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
