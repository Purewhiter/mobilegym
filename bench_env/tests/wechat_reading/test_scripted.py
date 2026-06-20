"""Live scripted-plan verification for the WeChat Reading suite."""

from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from typing import Any, Callable

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
ROOT = Path(__file__).resolve().parents[3]
DEFAULTS = json.loads((ROOT / "apps" / "WechatReading" / "data" / "defaults.json").read_text(encoding="utf-8"))

_RELATIVE_RE = re.compile(r"(\d+)([wdhms])")
_WEEKDAY_ZH = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


def _book(title: str) -> dict[str, Any]:
    return next(book for book in DEFAULTS["store"] if book["title"] == title)


def _audiobook(title: str) -> dict[str, Any]:
    return next(book for book in DEFAULTS["audiobooks"] if book["title"] == title)


def _hot(rank: int) -> dict[str, Any]:
    return next(item for item in DEFAULTS["hotSearch"] if int(item["rank"]) == rank)


def _resolve_record_datetime(value: Any, *, now: dt.datetime | None = None) -> dt.datetime:
    now = now or dt.datetime.now()
    if isinstance(value, (int, float)):
        return dt.datetime.fromtimestamp(float(value) / 1000.0)
    text = str(value or "").strip()
    if text.startswith("-") or text.startswith("+"):
        sign = -1 if text.startswith("-") else 1
        delta = dt.timedelta()
        for amount, unit in _RELATIVE_RE.findall(text[1:]):
            n = int(amount)
            if unit == "w":
                delta += dt.timedelta(weeks=n)
            elif unit == "d":
                delta += dt.timedelta(days=n)
            elif unit == "h":
                delta += dt.timedelta(hours=n)
            elif unit == "m":
                delta += dt.timedelta(minutes=n)
            elif unit == "s":
                delta += dt.timedelta(seconds=n)
        return now + sign * delta
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return dt.datetime.fromisoformat(f"{text}T00:00:00")
    return dt.datetime.fromisoformat(text)


def _resolved_record_dates(*, now: dt.datetime | None = None) -> list[tuple[dt.date, int]]:
    now = now or dt.datetime.now()
    out: list[tuple[dt.date, int]] = []
    for record in DEFAULTS["readingRecords"]:
        stamp = _resolve_record_datetime(record["timestamp"], now=now)
        out.append((stamp.date(), int(record["duration"])))
    return out


def _month_reading_day_count(year: int, month: int) -> str:
    days = {d.day for d, _ in _resolved_record_dates() if d.year == year and d.month == month}
    return str(len(days))


def _best_reading_weekday() -> str:
    today = dt.datetime.now().date()
    start = today - dt.timedelta(days=6)
    totals: dict[dt.date, int] = {}
    for date_value, duration in _resolved_record_dates(now=dt.datetime.now()):
        if start <= date_value <= today:
            totals[date_value] = totals.get(date_value, 0) + duration
    best = max(totals.items(), key=lambda item: item[1])[0]
    return _WEEKDAY_ZH[best.weekday()]


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CheckCoinBalance", lambda: wechat_reading_tasks.CheckCoinBalance(answer=str(DEFAULTS["user"]["coinBalance"]))),
    ("CheckHotSearchRank", lambda: wechat_reading_tasks.CheckHotSearchRank(rank=1, answer=_hot(1)["title"])),
    ("CheckBookRating", lambda: wechat_reading_tasks.CheckBookRating(book_title="活着", answer=str(_book("活着")["recommendedValue"]))),
    ("AddBookToShelf", lambda: wechat_reading_tasks.AddBookToShelf(book_title="三体")),
    ("ManageShelf", lambda: wechat_reading_tasks.ManageShelf(book_title="苏菲的世界")),
    ("SearchBookAuthor", lambda: wechat_reading_tasks.SearchBookAuthor(book_title="活着", answer=_book("活着")["author"])),
    ("TogglePrivateReading", lambda: wechat_reading_tasks.TogglePrivateReading(book_title="苏菲的世界")),
    ("EditProfileName", lambda: wechat_reading_tasks.EditProfileName(new_name="阿青")),
    ("SetDarkMode", lambda: wechat_reading_tasks.SetDarkMode(dark_mode="深色")),
    ("FindAudiobookPlays", lambda: wechat_reading_tasks.FindAudiobookPlays(book_title="红楼梦", answer=_audiobook("红楼梦")["plays"])),
    ("AnalyzeReadingHabit", lambda: wechat_reading_tasks.AnalyzeReadingHabit(answer=_best_reading_weekday())),
    (
        "CheckCalendarMonthReading",
        lambda: wechat_reading_tasks.CheckCalendarMonthReading(
            year=2026,
            month=1,
            answer=_month_reading_day_count(2026, 1),
        ),
    ),
    ("CompareBookLengths", lambda: wechat_reading_tasks.CompareBookLengths(book1="三体", book2="活着")),
    ("FindHighestRatedBookInCategory", lambda: wechat_reading_tasks.FindHighestRatedBookInCategory(category="历史", answer="明朝那些事儿")),
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
