"""Live scripted-plan verification for the cross-app content suite.

Single-source policy: whole-sentence messages (``wechat_message`` /
``sms_message`` / ``moment_content`` / ``redbook_content`` …), target ids
(``note_id`` / ``bvid`` / ``track_id`` / ``contact_wxid`` …) and on-screen
assert values are **not** injected here — they come from
``scripted_plans.DERIVED_PARAMS``, computed at materialization time from the
episode's post-setup initial state through the judge-homologous domain
classes. That is exactly the official ``--agent scripted`` sampling path, so
these live cases regression-test the derivation itself (the previous
disk-defaults replicas of the frontend bootstrap — ``_spotify_state`` /
``_wechat_reading_state`` / ``_notes_state`` — are gone: the real initial
state already carries the bootstrapped values).

Only *declared* task parameters stay pinned below, for deterministic
coverage (fixed keyword/category/partition keep scroll geometry and Branch
arms stable; ``contact`` pins a fixed WeChat contact).
"""

from __future__ import annotations

from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.crossapp_content import tasks as content_tasks
from bench_env.task.registry import TaskRegistry
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "crossapp_content"
CONTACT = "张伟"

# 不再放宽步数：全部 plan 均须在任务自身预算（难度默认 / task.max_steps）内
# 完成，与官方 --agent scripted 采样路径的预算完全一致。
SCRIPTED_MAX_STEPS: dict[str, int] = {}


def _task(name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{name}", **params)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    (
        "SpotifyNowPlayingToWechat",
        lambda: content_tasks.SpotifyNowPlayingToWechat(contact=CONTACT),
    ),
    (
        "BilibiliRankingToWechat",
        lambda: content_tasks.BilibiliRankingToWechat(partition="全站", rank=1, contact=CONTACT),
    ),
    (
        "RedbookSearchTitleToWechat",
        lambda: content_tasks.RedbookSearchTitleToWechat(keyword="数分", contact=CONTACT),
    ),
    (
        "SpotifyTodayNthPlayToRedbook",
        lambda: content_tasks.SpotifyTodayNthPlayToRedbook(nth=2),
    ),
    (
        "WechatReadingBestBookToWechat",
        lambda: content_tasks.WechatReadingBestBookToWechat(category="历史", contact=CONTACT),
    ),
    (
        "WechatReadingStatsToWechat",
        lambda: content_tasks.WechatReadingStatsToWechat(contact=CONTACT),
    ),
    (
        # keyword=数分 的首篇作者初始已关注 → 走 already_following 臂；
        # 其余关键词的 follow_first 臂由 CLI 采样路径覆盖。
        "RedbookAuthorFollowersToWechat",
        lambda: content_tasks.RedbookAuthorFollowersToWechat(keyword="数分", contact=CONTACT),
    ),
    (
        "XLatestPostToReddit_WithTitleFormat",
        lambda: content_tasks.XLatestPostToReddit_WithTitleFormat(
            user="elonmusk", subreddit="China_irl"
        ),
    ),
    (
        "RedbookFollowingNoteCountToSms",
        lambda: content_tasks.RedbookFollowingNoteCountToSms(username="西柚慢行", contact="张三"),
    ),
    (
        "SpotifySongFullDetailsToRedbook",
        lambda: content_tasks.SpotifySongFullDetailsToRedbook(song="搁浅"),
    ),
    (
        "BilibiliTripleLikeThenMoments",
        lambda: content_tasks.BilibiliTripleLikeThenMoments(partition="全站", rank=1),
    ),
    (
        "RedbookDmThenWechatReport",
        lambda: content_tasks.RedbookDmThenWechatReport(
            username="西柚慢行", message="你好呀", contact=CONTACT
        ),
    ),
    (
        "NotesContentToRedbookAndX",
        lambda: content_tasks.NotesContentToRedbookAndX(topic="AI代理"),
    ),
    (
        "DailyLogToMoments",
        lambda: content_tasks.DailyLogToMoments(),
    ),
    (
        "CulturalChecklistToRedbook",
        lambda: content_tasks.CulturalChecklistToRedbook(),
    ),
    (
        "EbayCheapToRedbook",
        lambda: content_tasks.EbayCheapToRedbook(product="电风扇"),
    ),
    (
        "SpotifySaveCurrentSongToNotes",
        lambda: content_tasks.SpotifySaveCurrentSongToNotes(),
    ),
    (
        "WechatReadingShareBookList",
        lambda: content_tasks.WechatReadingShareBookList(n=3, contact=CONTACT),
    ),
    (
        "ReadingPlanToNotes",
        lambda: content_tasks.ReadingPlanToNotes(),
    ),
    (
        "FileManagerSendFileToWechatContact",
        lambda: content_tasks.FileManagerSendFileToWechatContact(contact=CONTACT),
    ),
    (
        "NotesToWechatAndRedbook",
        lambda: content_tasks.NotesToWechatAndRedbook(text_keyword="今天心情很好", contact=CONTACT),
    ),
    (
        "BilibiliRankAuthorLastNovToWechat",
        lambda: _task("BilibiliRankAuthorLastNovToWechat", category="舞蹈", rank=10, contact=CONTACT),
    ),
    (
        "BilibiliRankTop3FolderAndWechat",
        lambda: _task(
            "BilibiliRankTop3FolderAndWechat",
            category="娱乐",
            rank=20,
            folder="热门视频",
            contact=CONTACT,
        ),
    ),
    (
        "FavoriteWaterSceneryPhotos",
        lambda: _task("FavoriteWaterSceneryPhotos", contact=CONTACT),
    ),
    (
        "RedbookAuthorTopCollectToWechat",
        lambda: _task("RedbookAuthorTopCollectToWechat", query="旅行", contact=CONTACT),
    ),
    (
        "RedbookTopLikedToNotes",
        lambda: _task("RedbookTopLikedToNotes", query="旅行"),
    ),
    (
        "RedbookUserBestWorstToNotes",
        lambda: _task("RedbookUserBestWorstToNotes", user="铁铁健身日记"),
    ),
    (
        "RedbookUserTopCollectToWechat",
        lambda: _task("RedbookUserTopCollectToWechat", user="铁铁健身日记", contact=CONTACT),
    ),
    (
        "ThirdSpotifyPlayRecommendOnRedbookAndPlaylist",
        lambda: _task("ThirdSpotifyPlayRecommendOnRedbookAndPlaylist", playlist="今天爱听"),
    ),
    (
        "WeeklyReadingAndLikedSpotifySongsToMoment",
        lambda: _task("WeeklyReadingAndLikedSpotifySongsToMoment"),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(content_tasks)
    missing = declared - covered
    assert not missing, f"crossapp_content tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_crossapp_content_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE, max_steps=SCRIPTED_MAX_STEPS.get(name))
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
