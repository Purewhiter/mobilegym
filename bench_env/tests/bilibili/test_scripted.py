"""Live scripted-plan verification for the Bilibili suite.

Single-source policy: answers, ``bvid`` / ``mid`` / ``anime_id`` /
``folder_id`` / ``tag1-3`` and the ranking scroll depth are **not** injected
here — they come from ``scripted_plans.DERIVED_PARAMS``, computed at
materialization time from the episode's post-setup initial state (and the
same static data files the judges read) through the judge-homologous
``Bilibili`` domain class. That is exactly the official ``--agent scripted``
sampling path, so these live cases regression-test the derivation itself.

Only *declared* task parameters stay pinned below, for deterministic
coverage (fixed titles/UP names keep the search geometry stable; ``rank=9``
exercises the derived ranking-scroll path; ``month=8, day=13`` exercises the
calendar-navigation Branch arm).

Known exception: ``ViewMyUidTask`` declares no ``answer_fields``, so
``_grounded`` patches them onto the *instance* — a task-definition patch
(without it the grounded runner never configures the AnswerSheet), not a
parameter injection. On the pure CLI sampling path this task cannot pass
until the task class itself declares ``answer_fields`` (out of scope here).
"""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.bilibili import tasks as bilibili_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "bilibili"


def _grounded(task: BaseTask, fields: list[dict]) -> BaseTask:
    """Add grounded fields for legacy AnswerTask definitions that lack them."""
    task.answer_fields = fields
    return task


DEFAULT_TITLE = "盘点某国令人啼笑皆非的荒诞瞬间"
MUSIC_BOX_TITLE = "把老式音乐盒改造成 AI 作曲机：从硬件到算法全流程"
ANIME_TITLE = "鬼灭之刃 游郭篇 中配版"


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("OpenRankingTask", lambda: bilibili_tasks.OpenRankingTask()),
    ("ViewProfileStatTask", lambda: bilibili_tasks.ViewProfileStatTask(stat="coins")),
    ("SubscribeTask", lambda: bilibili_tasks.SubscribeTask(up_name="流光视界")),
    ("UpdateSignTask", lambda: bilibili_tasks.UpdateSignTask(new_sign="脚本验证签名")),
    ("CoinVideoTask", lambda: bilibili_tasks.CoinVideoTask(title=DEFAULT_TITLE)),
    (
        "ViewMyUidTask",
        lambda: _grounded(
            bilibili_tasks.ViewMyUidTask(),
            [{"type": "text", "label": "UID"}],
        ),
    ),
    ("UpdateNicknameTask", lambda: bilibili_tasks.UpdateNicknameTask(new_name="script_bili_2026")),
    ("VideoAnswerOnlineTask", lambda: bilibili_tasks.VideoAnswerOnlineTask(title=DEFAULT_TITLE)),
    ("VideoAnswerTagsTask", lambda: bilibili_tasks.VideoAnswerTagsTask(title=DEFAULT_TITLE)),
    (
        "ToggleAnimeSubscriptionTask",
        lambda: bilibili_tasks.ToggleAnimeSubscriptionTask(anime_title=ANIME_TITLE),
    ),
    ("SetSexTask", lambda: bilibili_tasks.SetSexTask(sex="男")),
    (
        "ViewFavoritesFolderCountTask",
        lambda: bilibili_tasks.ViewFavoritesFolderCountTask(folder_title="默认收藏夹"),
    ),
    (
        "SearchUserFollowerCountTask",
        lambda: bilibili_tasks.SearchUserFollowerCountTask(up_name="流光视界"),
    ),
    ("SanlianTask", lambda: bilibili_tasks.SanlianTask(title=DEFAULT_TITLE)),
    (
        "FollowRecommendationTask",
        lambda: bilibili_tasks.FollowRecommendationTask(target_up_name="流光视界"),
    ),
    ("UnfollowAndClearHistoryTask", lambda: bilibili_tasks.UnfollowAndClearHistoryTask(up_name="铁壁观察")),
    ("SetBirthdayTask", lambda: bilibili_tasks.SetBirthdayTask(month=8, day=13)),
    ("FavVideoAndCountTask", lambda: bilibili_tasks.FavVideoAndCountTask(partition="全站", rank=9)),
    (
        "VideoCommentContainsAnswerUidTask",
        lambda: bilibili_tasks.VideoCommentContainsAnswerUidTask(
            title=DEFAULT_TITLE,
            snippet="十二小时",
        ),
    ),
    (
        "VideoCommentContainsAnswerLocationTask",
        lambda: bilibili_tasks.VideoCommentContainsAnswerLocationTask(
            title=MUSIC_BOX_TITLE,
            snippet="整活达人",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(bilibili_tasks)
    missing = declared - covered
    assert not missing, f"Bilibili tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_bilibili_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
