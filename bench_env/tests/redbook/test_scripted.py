"""Live scripted-plan verification for the Redbook (小红书) suite.

Each plan is replayed through ``ScriptedAgent`` via the same
``BaseRunner.run_episode`` path as ``bench_env.run --agent scripted`` (grounded
AnswerSheet, ``COMPLETE``, ``EpisodeResult.success`` = goal + clean diff).

Run against the gateway:
    pytest bench_env/tests/redbook/test_scripted.py --sim-url https://localhost:4180
"""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.redbook import tasks as redbook_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "redbook"

SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CheckMyProfileField", lambda: redbook_tasks.CheckMyProfileField(field="followers")),
    ("CheckSearchNoteField", lambda: redbook_tasks.CheckSearchNoteField(keyword="OOTD", field="authorName")),
    ("CollectSearchNote", lambda: redbook_tasks.CollectSearchNote(keyword="教程")),
    ("LikeFirstFeedNote", lambda: redbook_tasks.LikeFirstFeedNote(category="food")),
    ("CheckSearchUserField", lambda: redbook_tasks.CheckSearchUserField(username="海边小橘子", field="location")),
    ("UncollectFirstCollectedNote", lambda: redbook_tasks.UncollectFirstCollectedNote()),
    ("DMFollowedUser", lambda: redbook_tasks.DMFollowedUser(username="海边小橘子", message="你好呀，最近更新很不错")),
    (
        "PublishNoteWithTitleAndContent",
        lambda: redbook_tasks.PublishNoteWithTitleAndContent(
            title="周末逛展记录",
            content="今天看了两个展，最喜欢第二个沉浸式空间，照片晚点整理。",
        ),
    ),
    ("LikeFeedNoteAndReportLikes", lambda: redbook_tasks.LikeFeedNoteAndReportLikes(keyword="教程")),
    ("CheckFollowingUserNoteCount", lambda: redbook_tasks.CheckFollowingUserNoteCount(username="西柚慢行")),
    ("CheckFirstChatLastMessage", lambda: redbook_tasks.CheckFirstChatLastMessage()),
    ("CheckFirstCollectedAuthorField", lambda: redbook_tasks.CheckFirstCollectedAuthorField(field="location")),
    ("SearchFirstNoteAuthorTopLikedTitle", lambda: redbook_tasks.SearchFirstNoteAuthorTopLikedTitle(keyword="探店")),
    ("SearchCollectAndReportAuthor", lambda: redbook_tasks.SearchCollectAndReportAuthor(keyword="读书")),
    (
        "CollectFeedNoteAndDMAuthor",
        lambda: redbook_tasks.CollectFeedNoteAndDMAuthor(keyword="教程", message="这篇内容很有启发，谢谢分享"),
    ),
    (
        "PublishAndShareToFollowing",
        lambda: redbook_tasks.PublishAndShareToFollowing(title="春日散步计划", username="海边小橘子"),
    ),
    (
        "ReplyToFeedNoteFirstComment",
        lambda: redbook_tasks.ReplyToFeedNoteFirstComment(keyword="教程", reply="这个回复我也很认同"),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(redbook_tasks)
    missing = declared - covered
    assert not missing, f"Redbook tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_redbook_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
