"""Live scripted-plan verification for the Bilibili suite."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.bilibili import tasks as bilibili_tasks
from bench_env.task.bilibili.app import Bilibili, norm_ip_location
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "bilibili"
ROOT = Path(__file__).resolve().parents[3]
APP_DIR = ROOT / "apps" / "Bilibili" / "data"
DEFAULTS = json.loads((APP_DIR / "defaults.json").read_text(encoding="utf-8"))
BILI = Bilibili(DEFAULTS)


def _grounded(task: BaseTask, fields: list[dict]) -> BaseTask:
    """Add grounded fields for legacy AnswerTask definitions that lack them."""
    task.answer_fields = fields
    return task


def _bvid(title: str) -> str:
    return Bilibili.bvid_from_title(title)


def _video_tags(title: str) -> list[str]:
    tags = Bilibili.video_detail(_bvid(title))["tags"]
    return [str(tag) for tag in tags[:3]]


def _comment_answer(title: str, snippet: str) -> dict[str, str]:
    comment = Bilibili.comment_by_contains(_bvid(title), snippet)
    return {
        "uid": str(comment["mid"]),
        "location": norm_ip_location(comment["location"]),
    }


DEFAULT_TITLE = "盘点某国令人啼笑皆非的荒诞瞬间"
MUSIC_BOX_TITLE = "把老式音乐盒改造成 AI 作曲机：从硬件到算法全流程"
ANIME_TITLE = "鬼灭之刃 游郭篇 中配版"


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("OpenRankingTask", lambda: bilibili_tasks.OpenRankingTask()),
    (
        "ViewProfileStatTask",
        lambda: bilibili_tasks.ViewProfileStatTask(stat="coins", answer=str(BILI.profile_stat("coins"))),
    ),
    (
        "SubscribeTask",
        lambda: bilibili_tasks.SubscribeTask(up_name="流光视界", mid=Bilibili.mid_from_name("流光视界")),
    ),
    ("UpdateSignTask", lambda: bilibili_tasks.UpdateSignTask(new_sign="脚本验证签名")),
    (
        "CoinVideoTask",
        lambda: bilibili_tasks.CoinVideoTask(title=DEFAULT_TITLE, bvid=_bvid(DEFAULT_TITLE)),
    ),
    (
        "ViewMyUidTask",
        lambda: _grounded(
            bilibili_tasks.ViewMyUidTask(answer=DEFAULTS["user"]["uid"]),
            [{"type": "text", "label": "UID"}],
        ),
    ),
    ("UpdateNicknameTask", lambda: bilibili_tasks.UpdateNicknameTask(new_name="script_bili_2026")),
    (
        "VideoAnswerOnlineTask",
        lambda: bilibili_tasks.VideoAnswerOnlineTask(
            title=DEFAULT_TITLE,
            bvid=_bvid(DEFAULT_TITLE),
            answer=Bilibili.video_detail(_bvid(DEFAULT_TITLE))["online"],
        ),
    ),
    (
        "VideoAnswerTagsTask",
        lambda: bilibili_tasks.VideoAnswerTagsTask(
            title=DEFAULT_TITLE,
            bvid=_bvid(DEFAULT_TITLE),
            tag1=_video_tags(DEFAULT_TITLE)[0],
            tag2=_video_tags(DEFAULT_TITLE)[1],
            tag3=_video_tags(DEFAULT_TITLE)[2],
        ),
    ),
    (
        "ToggleAnimeSubscriptionTask",
        lambda: bilibili_tasks.ToggleAnimeSubscriptionTask(
            anime_title=ANIME_TITLE,
            anime_id="BVmg00000199",
        ),
    ),
    ("SetSexTask", lambda: bilibili_tasks.SetSexTask(sex="男")),
    (
        "ViewFavoritesFolderCountTask",
        lambda: bilibili_tasks.ViewFavoritesFolderCountTask(
            folder_title="默认收藏夹",
            folder_id="fav_default",
            answer=str(BILI.folder_video_count("默认收藏夹")),
        ),
    ),
    (
        "SearchUserFollowerCountTask",
        lambda: bilibili_tasks.SearchUserFollowerCountTask(
            up_name="流光视界",
            answer=Bilibili.author_follower_display("流光视界"),
        ),
    ),
    (
        "SanlianTask",
        lambda: bilibili_tasks.SanlianTask(title=DEFAULT_TITLE, bvid=_bvid(DEFAULT_TITLE)),
    ),
    (
        "FollowRecommendationTask",
        lambda: bilibili_tasks.FollowRecommendationTask(
            target_up_name="流光视界",
            target_mid=Bilibili.mid_from_name("流光视界"),
            other_up_name="视界观察员",
        ),
    ),
    ("UnfollowAndClearHistoryTask", lambda: bilibili_tasks.UnfollowAndClearHistoryTask(up_name="铁壁观察")),
    ("SetBirthdayTask", lambda: bilibili_tasks.SetBirthdayTask(month=1, day=1)),
    (
        "FavVideoAndCountTask",
        lambda: bilibili_tasks.FavVideoAndCountTask(
            partition="全站",
            rank=2,
            bvid=str(Bilibili.ranking_entry("全站", 2)["id"]),
            answer=str(BILI.folder_video_count("默认收藏夹") + 1),
        ),
    ),
    (
        "VideoCommentContainsAnswerUidTask",
        lambda: bilibili_tasks.VideoCommentContainsAnswerUidTask(
            title=DEFAULT_TITLE,
            bvid=_bvid(DEFAULT_TITLE),
            snippet="十二小时",
            answer=_comment_answer(DEFAULT_TITLE, "十二小时")["uid"],
        ),
    ),
    (
        "VideoCommentContainsAnswerLocationTask",
        lambda: bilibili_tasks.VideoCommentContainsAnswerLocationTask(
            title=MUSIC_BOX_TITLE,
            bvid=_bvid(MUSIC_BOX_TITLE),
            snippet="整活达人",
            answer=_comment_answer(MUSIC_BOX_TITLE, "整活达人")["location"],
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
