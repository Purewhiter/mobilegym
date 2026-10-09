"""
WeChat Reading task correctness tests.
"""

from __future__ import annotations

import copy
import datetime
import inspect
import json
import random
import re
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.task.wechat_reading.app import WechatReading
from bench_env.task.wechat_reading import tasks as _tasks_module
from bench_env.tests.conftest import make_judge_input
from bench_env.tests.fixtures.wechat_reading import (
    BASE_NOW,
    BASE_STATE,
    DEFAULTS,
    TEST_OS_STATE,
    _derive_state,
    _parse_time_like,
    _to_iso,
)

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

DEFAULT_ROUTE = {"app": "wechat_reading", "path": "/"}

_PATH_TOKEN_RE = re.compile(r"([^\.\[\]]+)|\[(\d+)\]")


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
    init_os: dict[str, Any] | None = None,
    curr_os: dict[str, Any] | None = None,
):
    return make_judge_input(
        {"apps": {"wechat_reading": init_state}, "os": init_os or TEST_OS_STATE},
        {"apps": {"wechat_reading": curr_state}, "os": curr_os or TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _format_answer(expected: Any) -> str:
    if isinstance(expected, re.Pattern):
        if "一样" in expected.pattern:
            return "一样"
        return expected.pattern
    if isinstance(expected, float):
        return f"答案是{expected:g}"
    if isinstance(expected, int):
        return f"答案是{expected}"
    return f"答案是{expected}"


def _parse_path(path: str) -> list[str | int]:
    tokens: list[str | int] = []
    for name, index in _PATH_TOKEN_RE.findall(path):
        tokens.append(name if name else int(index))
    return tokens


def _set_by_path(state: dict[str, Any], path: str, value: Any) -> None:
    tokens = _parse_path(path)
    current: Any = state
    for token in tokens[:-1]:
        current = current[token]
    current[tokens[-1]] = value


def _resolve_template(value: Any, params: dict[str, Any]) -> Any:
    if isinstance(value, str) and "{" in value:
        matched = re.fullmatch(r"\{(\w+)\}", value.strip())
        if matched:
            return params[matched.group(1)]
        return value.format(**params)
    return value


def _positive_answer_case(
    task: BaseTask,
    curr_state: dict[str, Any] | None = None,
    *,
    route: dict[str, Any] | None = None,
):
    curr = copy.deepcopy(curr_state) if curr_state is not None else copy.deepcopy(BASE_STATE)
    inp = _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)
    expected = task.get_answer(inp)  # type: ignore[attr-defined]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route, answer=_format_answer(expected))


def _negative_answer_case(
    task: BaseTask,
    curr_state: dict[str, Any] | None = None,
    *,
    route: dict[str, Any] | None = None,
):
    curr = copy.deepcopy(curr_state) if curr_state is not None else copy.deepcopy(BASE_STATE)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route, answer="错误答案")


def _positive_criteria_case(task: CriteriaTask):
    curr = copy.deepcopy(BASE_STATE)
    route = DEFAULT_ROUTE
    for raw_path, raw_value in task.criteria.items():
        path = _resolve_template(raw_path, task.params)
        value = _resolve_template(raw_value, task.params)
        if path == "route":
            route = {"app": "wechat_reading", "path": str(value)}
            continue
        _set_by_path(curr, path, value)
    curr = _derive_state(curr)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)


def _negative_criteria_case(task: CriteriaTask):
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _book_by_title(state: dict[str, Any], title: str) -> dict[str, Any]:
    for book in state["store"]:
        if book["title"] == title:
            return book
    raise AssertionError(f"Missing book fixture: {title}")


def _with_book_on_shelf(title: str) -> dict[str, Any]:
    curr = copy.deepcopy(BASE_STATE)
    book = _book_by_title(curr, title)
    book_id = str(book["id"])
    if not any(str(item["bookId"]) == book_id for item in curr["shelf"]):
        curr["shelf"].append({"bookId": book_id, "isPrivate": False, "addedAt": _to_iso(BASE_NOW)})
    if book_id not in curr["bookProgress"]:
        curr["bookProgress"][book_id] = {"bookId": book_id, "charOffset": 0, "lastReadAt": _to_iso(BASE_NOW)}
    return _derive_state(curr)


def _with_book_private(title: str, *, is_private: bool) -> dict[str, Any]:
    curr = copy.deepcopy(BASE_STATE)
    book = _book_by_title(curr, title)
    book_id = str(book["id"])
    for item in curr["shelf"]:
        if str(item["bookId"]) == book_id:
            item["isPrivate"] = is_private
            return _derive_state(curr)
    raise AssertionError(f"Book is not on shelf: {title}")


def _without_shelf_book(title: str) -> dict[str, Any]:
    curr = copy.deepcopy(BASE_STATE)
    book = _book_by_title(curr, title)
    book_id = str(book["id"])
    curr["shelf"] = [item for item in curr["shelf"] if str(item["bookId"]) != book_id]
    return _derive_state(curr)


def _with_progress(title: str, percentage: int) -> dict[str, Any]:
    curr = copy.deepcopy(BASE_STATE)
    book = _book_by_title(curr, title)
    book_id = str(book["id"])
    curr["bookProgress"][book_id] = {
        "bookId": book_id,
        "charOffset": int(int(book["totalWords"]) * percentage / 100),
        "lastReadAt": _to_iso(BASE_NOW),
    }
    return _derive_state(curr)


def _with_all_shelf_books_at_percentage(pct: int) -> dict[str, Any]:
    """书架上的书进度全部设为 pct%，保证「当前最低进度书 >= pct」判定的正例。"""
    curr = copy.deepcopy(BASE_STATE)
    store_by_id = {str(b["id"]): b for b in curr["store"]}
    for item in curr["shelf"]:
        book_id = str(item["bookId"])
        book = store_by_id[book_id]
        tw = int(book["totalWords"])
        curr["bookProgress"][book_id] = {
            "bookId": book_id,
            "charOffset": int(tw * pct / 100),
            "lastReadAt": _to_iso(BASE_NOW),
        }
    return _derive_state(curr)


def _with_shelf_book_progress(title: str, percentage: int) -> dict[str, Any]:
    """Shelf 包含该书且阅读进度达到 percentage（用于 AddBookAndReadTo 正例）。"""
    curr = copy.deepcopy(BASE_STATE)
    book = _book_by_title(curr, title)
    book_id = str(book["id"])
    if not any(str(item["bookId"]) == book_id for item in curr["shelf"]):
        curr["shelf"].append({"bookId": book_id, "isPrivate": False, "addedAt": _to_iso(BASE_NOW)})
    curr["bookProgress"][book_id] = {
        "bookId": book_id,
        "charOffset": int(int(book["totalWords"]) * percentage / 100),
        "lastReadAt": _to_iso(BASE_NOW),
    }
    return _derive_state(curr)


def _with_unfollowed(user_id: str) -> dict[str, Any]:
    curr = copy.deepcopy(BASE_STATE)
    curr["user"]["following"] = [uid for uid in curr["user"]["following"] if uid != user_id]
    return _derive_state(curr)


def _with_followed_user(user_id: str) -> dict[str, Any]:
    curr = copy.deepcopy(BASE_STATE)
    fol = list(curr["user"]["following"])
    if user_id not in fol:
        fol.append(user_id)
        curr["user"]["following"] = fol
    return _derive_state(curr)


def _with_filtered_shelf_by_recommendation(threshold: float) -> dict[str, Any]:
    curr = copy.deepcopy(BASE_STATE)
    store_by_id = {str(book["id"]): book for book in curr["store"]}
    curr["shelf"] = [
        item
        for item in curr["shelf"]
        if float(store_by_id[str(item["bookId"])]["recommendedValue"]) > threshold
    ]
    return _derive_state(curr)


def _find_lowest_progress_and_read_positive() -> tuple[Any, Any]:
    env_state = {"apps": {"wechat_reading": copy.deepcopy(BASE_STATE)}, "os": TEST_OS_STATE}
    t = WechatReading.sample_percentage_for_lowest_progress_read(env_state, random.Random(0))
    pct = t["percentage"]
    return (
        _tasks_module.FindLowestProgressAndRead(percentage=pct),
        _make_task_input(copy.deepcopy(BASE_STATE), _with_all_shelf_books_at_percentage(pct)),
    )


def _find_lowest_progress_and_read_negative() -> tuple[Any, Any]:
    env_state = {"apps": {"wechat_reading": copy.deepcopy(BASE_STATE)}, "os": TEST_OS_STATE}
    t = WechatReading.sample_percentage_for_lowest_progress_read(env_state, random.Random(0))
    return (
        _tasks_module.FindLowestProgressAndRead(percentage=t["percentage"]),
        _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)),
    )


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "wechat_reading" in task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": TEST_OS_STATE}
        desc = task.description
        assert desc
        assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_required_class_attrs(self, cls):
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[c.__name__ for c in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer_or_get_answer(self, cls):
        has_answer_attr = cls.answer is not None
        has_get_answer_override = cls.get_answer is not AnswerTask.get_answer
        assert has_answer_attr or has_get_answer_override


class TestWechatReadingAccessor:
    @pytest.fixture
    def wr(self) -> WechatReading:
        return WechatReading(copy.deepcopy(BASE_STATE))

    def test_sampling_helpers(self):
        env_state = {"apps": {"wechat_reading": copy.deepcopy(BASE_STATE)}, "os": TEST_OS_STATE}
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        on_shelf_titles = {wr.require_store_book(str(item["bookId"]))["title"] for item in wr.shelf}
        public_shelf_titles = {
            wr.require_store_book(str(item["bookId"]))["title"]
            for item in wr.shelf
            if item.get("isPrivate") is False
        }
        progress_eligible_titles: list[str] = []
        for item in wr.shelf:
            book = wr.require_store_book(str(item["bookId"]))
            current_pct = wr.get_progress(str(book["id"]))
            if any(pct for pct in (10, 20, 30, 50, 70, 90) if pct > current_pct + 5):
                progress_eligible_titles.append(book["title"])

        addable_title = WechatReading.sample_book_title_not_on_shelf(env_state, random.Random(0))
        assert addable_title not in on_shelf_titles
        assert WechatReading.sample_public_shelf_title(env_state, random.Random(1)) in public_shelf_titles
        progress_target = WechatReading.sample_progress_target(env_state, random.Random(2))
        assert progress_target["book_title"] in progress_eligible_titles
        assert progress_target["percentage"] > 0
        pair = WechatReading.sample_two_distinct_book_titles(env_state, random.Random(3))
        assert pair["book1"] != pair["book2"]
        month_ref = WechatReading.sample_year_month_with_records(env_state, random.Random(4))
        assert isinstance(month_ref["year"], int)
        assert isinstance(month_ref["month"], int)
        follow_user = WechatReading.sample_following_user(env_state, random.Random(5))
        assert follow_user == {"user_id": "user_508", "user_name": "508"}
        privacy_setting = WechatReading.sample_privacy_setting(env_state, random.Random(6))
        assert privacy_setting["setting_key"] in {
            "requireFollowRequest",
            "hideVipGlobal",
            "autoPrivateReading",
            "shelfReplacement",
            "rejectStrangerMsg",
            "closePersonalizedRec",
            "closeReadingRank",
        }
        category = WechatReading.sample_category_with_multiple_books(env_state, random.Random(7))
        assert len(WechatReading(copy.deepcopy(BASE_STATE)).get_books_by_category(category)) >= 2
        wpair = WechatReading.sample_two_books_unequal_word_counts(env_state, random.Random(8))
        assert wpair["book1"] != wpair["book2"]
        rpair = WechatReading.sample_two_books_unequal_ratings(env_state, random.Random(9))
        assert rpair["book1"] != rpair["book2"]
        add_read = WechatReading.sample_add_book_and_read(env_state, random.Random(10))
        assert add_read["percentage"] > 0
        low = WechatReading.sample_percentage_for_lowest_progress_read(env_state, random.Random(11))
        assert low["percentage"] > 0
        assert WechatReading(env_state["apps"]["wechat_reading"]).shelf_book_title_with_lowest_progress()
        WechatReading.sample_conditional_follow_decision(env_state, random.Random(12))

    def test_date_labels(self):
        labels = WechatReading.date_labels("2026-01-27", TEST_OS_STATE)
        assert "2026-01-27" in labels
        assert "1月27号" in labels
        assert "今天" in labels

    def test_book_and_shelf_queries(self, wr: WechatReading):
        assert wr.shelf_book_title_with_lowest_progress()
        assert wr.require_book_by_title("活着")["author"] == "余华"
        assert wr.require_store_book("20")["title"] == "活着"
        assert wr.is_book_on_shelf("20") is False
        assert wr.is_book_on_shelf("4") is True
        assert wr.is_private_reading("60") is True
        assert wr.get_progress("60") == pytest.approx(6.25)
        assert set(wr.finished_book_ids) == {"1", "58"}

    def test_reading_aggregations(self, wr: WechatReading):
        assert wr.reading_minutes_on(datetime.date(2026, 1, 24)) == 81
        assert wr.month_reading_day_count(2026, 1) > 0
        assert "2026-01-22" in wr.best_reading_dates_in_last_week(TEST_OS_STATE)

    def test_user_and_audiobook_queries(self, wr: WechatReading):
        assert wr.require_user_by_id("user_508")["name"] == "508"
        assert wr.require_user_by_name("508")["readingTimeMinutes"] == 62882
        assert wr.require_audiobook_by_title("红楼梦")["plays"] == "25万"
        assert wr.is_following("user_508") is True

    def test_highest_rated_books_in_category(self, wr: WechatReading):
        books = wr.highest_rated_books_in_category("历史")
        assert [book["title"] for book in books] == ["明朝那些事儿"]


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("AddBookToShelf", lambda: (_tasks_module.AddBookToShelf(book_title="三体"), _make_task_input(copy.deepcopy(BASE_STATE), _with_book_on_shelf("三体")))),
    ("TogglePrivateReading", lambda: (_tasks_module.TogglePrivateReading(book_title="苏菲的世界"), _make_task_input(copy.deepcopy(BASE_STATE), _with_book_private("苏菲的世界", is_private=True)))),
    ("SearchBookAuthor", lambda: _positive_answer_case(_tasks_module.SearchBookAuthor(book_title="活着"))),
    ("CheckHotSearchRank", lambda: _positive_answer_case(_tasks_module.CheckHotSearchRank(rank=1))),
    ("ReadBookProgress", lambda: (_tasks_module.ReadBookProgress(book_title="红楼梦", percentage=20), _make_task_input(copy.deepcopy(BASE_STATE), _with_progress("红楼梦", 20)))),
    ("ManageShelf", lambda: (_tasks_module.ManageShelf(book_title="苏菲的世界"), _make_task_input(copy.deepcopy(BASE_STATE), _without_shelf_book("苏菲的世界")))),
    ("AnalyzeReadingHabit", lambda: (_tasks_module.AnalyzeReadingHabit(), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="1月22日读的时间最长"))),
    ("CheckCalendarMonthReading", lambda: _positive_answer_case(_tasks_module.CheckCalendarMonthReading(year=2026, month=1))),
    (
        "CompareBookLengths",
        lambda: (
            _tasks_module.CompareBookLengths(book1="三体", book2="活着"),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _with_book_on_shelf("三体"),
                answer="答案是三体",
            ),
        ),
    ),
    ("CheckCoinBalance", lambda: _positive_answer_case(_tasks_module.CheckCoinBalance())),
    ("FindAudiobookPlays", lambda: _positive_answer_case(_tasks_module.FindAudiobookPlays(book_title="红楼梦"))),
    ("OrganizeShelfByRecommendation", lambda: (_tasks_module.OrganizeShelfByRecommendation(recommendation=95.0), _make_task_input(copy.deepcopy(BASE_STATE), _with_filtered_shelf_by_recommendation(95.0)))),
    ("ConfigureReaderSettings", lambda: _positive_criteria_case(_tasks_module.ConfigureReaderSettings(font_size=22, style="仿真翻页"))),
    ("SetDarkMode", lambda: _positive_criteria_case(_tasks_module.SetDarkMode(dark_mode="深色"))),
    ("EditProfileName", lambda: _positive_criteria_case(_tasks_module.EditProfileName(new_name="阿青"))),
    ("SetProfileVisibility", lambda: _positive_criteria_case(_tasks_module.SetProfileVisibility(visibility="仅自己可见"))),
    ("UnfollowUser", lambda: (_tasks_module.UnfollowUser(user_id="user_508", user_name="508"), _make_task_input(copy.deepcopy(BASE_STATE), _with_unfollowed("user_508")))),
    ("CheckBookRating", lambda: _positive_answer_case(_tasks_module.CheckBookRating(book_title="活着"))),
    ("FindHighestRatedBookInCategory", lambda: _positive_answer_case(_tasks_module.FindHighestRatedBookInCategory(category="历史"))),
    (
        "AddBookAndReadTo",
        lambda: (
            _tasks_module.AddBookAndReadTo(book_title="三体", percentage=20),
            _make_task_input(copy.deepcopy(BASE_STATE), _with_shelf_book_progress("三体", 20)),
        ),
    ),
    ("FindLowestProgressAndRead", _find_lowest_progress_and_read_positive),
    (
        "PrivacyAndThemeBundle",
        lambda: _positive_criteria_case(
            _tasks_module.PrivacyAndThemeBundle(
                theme_color="yellow",
                privacy_label="关注你须获得你的同意",
                setting_key="requireFollowRequest",
                style="仿真翻页",
            )
        ),
    ),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("AddBookToShelf", lambda: (_tasks_module.AddBookToShelf(book_title="三体"), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)))),
    ("TogglePrivateReading", lambda: (_tasks_module.TogglePrivateReading(book_title="苏菲的世界"), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)))),
    ("SearchBookAuthor", lambda: _negative_answer_case(_tasks_module.SearchBookAuthor(book_title="活着"))),
    ("CheckHotSearchRank", lambda: _negative_answer_case(_tasks_module.CheckHotSearchRank(rank=1))),
    ("ReadBookProgress", lambda: (_tasks_module.ReadBookProgress(book_title="红楼梦", percentage=20), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)))),
    ("ManageShelf", lambda: (_tasks_module.ManageShelf(book_title="苏菲的世界"), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)))),
    ("AnalyzeReadingHabit", lambda: _negative_answer_case(_tasks_module.AnalyzeReadingHabit())),
    ("CheckCalendarMonthReading", lambda: _negative_answer_case(_tasks_module.CheckCalendarMonthReading(year=2026, month=1))),
    (
        "CompareBookLengths",
        lambda: (
            _tasks_module.CompareBookLengths(book1="三体", book2="活着"),
            _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="错误"),
        ),
    ),
    ("CheckCoinBalance", lambda: _negative_answer_case(_tasks_module.CheckCoinBalance())),
    ("FindAudiobookPlays", lambda: _negative_answer_case(_tasks_module.FindAudiobookPlays(book_title="红楼梦"))),
    ("OrganizeShelfByRecommendation", lambda: (_tasks_module.OrganizeShelfByRecommendation(recommendation=95.0), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)))),
    ("ConfigureReaderSettings", lambda: _negative_criteria_case(_tasks_module.ConfigureReaderSettings(font_size=22, style="仿真翻页"))),
    ("SetDarkMode", lambda: _negative_criteria_case(_tasks_module.SetDarkMode(dark_mode="深色"))),
    ("EditProfileName", lambda: _negative_criteria_case(_tasks_module.EditProfileName(new_name="阿青"))),
    ("SetProfileVisibility", lambda: _negative_criteria_case(_tasks_module.SetProfileVisibility(visibility="仅自己可见"))),
    ("UnfollowUser", lambda: (_tasks_module.UnfollowUser(user_id="user_508", user_name="508"), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)))),
    ("CheckBookRating", lambda: _negative_answer_case(_tasks_module.CheckBookRating(book_title="活着"))),
    ("FindHighestRatedBookInCategory", lambda: _negative_answer_case(_tasks_module.FindHighestRatedBookInCategory(category="历史"))),
    (
        "AddBookAndReadTo",
        lambda: (
            _tasks_module.AddBookAndReadTo(book_title="三体", percentage=20),
            _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)),
        ),
    ),
    ("FindLowestProgressAndRead", _find_lowest_progress_and_read_negative),
    (
        "PrivacyAndThemeBundle",
        lambda: _negative_criteria_case(
            _tasks_module.PrivacyAndThemeBundle(
                theme_color="yellow",
                privacy_label="关注你须获得你的同意",
                setting_key="requireFollowRequest",
                style="仿真翻页",
            )
        ),
    ),
]

OFFLINE_JUDGE_TASK_NAMES = {cls.__name__ for cls in ALL_TASK_CLASSES}


class TestTaskJudgeMatrixOffline:
    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == OFFLINE_JUDGE_TASK_NAMES
        assert negative == OFFLINE_JUDGE_TASK_NAMES

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_POSITIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_NEGATIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"
