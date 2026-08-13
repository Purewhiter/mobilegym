"""Live scripted-plan verification for the WeChat Reading suite.

Single-source policy: answers, ``book_id``, action-id lookups and slider
fractions are **not** injected here — they come from
``scripted_plans.DERIVED_PARAMS``, computed at materialization time from the
episode's post-setup initial state through the judge-homologous
``WechatReading`` domain class. That is exactly the official
``--agent scripted`` sampling path, so these live cases regression-test the
derivation itself (the previous defaults.json disk replica — relative-date
resolution, best-weekday and month-day-count recomputation — is gone; the
real initial state already carries absolute ``readingRecords`` dates).

Only *declared* task parameters stay pinned below, for deterministic
coverage (fixed titles keep the search/shelf geometry stable; 2026-01 keeps
the month-view branch on a mid-range "previous month" tap count).
"""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.wechat_reading import tasks as wechat_reading_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "wechat_reading"

SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CheckCoinBalance", lambda: wechat_reading_tasks.CheckCoinBalance()),
    ("CheckHotSearchRank", lambda: wechat_reading_tasks.CheckHotSearchRank(rank=1)),
    ("CheckBookRating", lambda: wechat_reading_tasks.CheckBookRating(book_title="活着")),
    ("AddBookToShelf", lambda: wechat_reading_tasks.AddBookToShelf(book_title="三体")),
    ("ManageShelf", lambda: wechat_reading_tasks.ManageShelf(book_title="苏菲的世界")),
    ("SearchBookAuthor", lambda: wechat_reading_tasks.SearchBookAuthor(book_title="活着")),
    ("TogglePrivateReading", lambda: wechat_reading_tasks.TogglePrivateReading(book_title="苏菲的世界")),
    ("EditProfileName", lambda: wechat_reading_tasks.EditProfileName(new_name="阿青")),
    ("SetDarkMode", lambda: wechat_reading_tasks.SetDarkMode(dark_mode="深色")),
    ("FindAudiobookPlays", lambda: wechat_reading_tasks.FindAudiobookPlays(book_title="红楼梦")),
    ("AnalyzeReadingHabit", lambda: wechat_reading_tasks.AnalyzeReadingHabit()),
    ("CheckCalendarMonthReading", lambda: wechat_reading_tasks.CheckCalendarMonthReading(year=2026, month=1)),
    ("CompareBookLengths", lambda: wechat_reading_tasks.CompareBookLengths(book1="三体", book2="活着")),
    ("FindHighestRatedBookInCategory", lambda: wechat_reading_tasks.FindHighestRatedBookInCategory(category="历史")),
    ("ConfigureReaderSettings", lambda: wechat_reading_tasks.ConfigureReaderSettings(font_size=24, style="仿真翻页")),
    ("UnfollowUser", lambda: wechat_reading_tasks.UnfollowUser(user_id="user_508", user_name="508")),
    ("SetProfileVisibility", lambda: wechat_reading_tasks.SetProfileVisibility(visibility="仅自己可见")),
    ("ReadBookProgress", lambda: wechat_reading_tasks.ReadBookProgress(book_title="红楼梦", percentage=20)),
    ("OrganizeShelfByRecommendation", lambda: wechat_reading_tasks.OrganizeShelfByRecommendation(recommendation=95.0)),
    ("AddBookAndReadTo", lambda: wechat_reading_tasks.AddBookAndReadTo(book_title="三体", percentage=20)),
    ("FindLowestProgressAndRead", lambda: wechat_reading_tasks.FindLowestProgressAndRead(percentage=50)),
    (
        "PrivacyAndThemeBundle",
        lambda: wechat_reading_tasks.PrivacyAndThemeBundle(
            theme_color="yellow",
            privacy_label="关注你须获得你的同意",
            setting_key="requireFollowRequest",
            style="仿真翻页",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(wechat_reading_tasks)
    missing = declared - covered
    assert not missing, f"WeChat Reading tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_wechat_reading_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
