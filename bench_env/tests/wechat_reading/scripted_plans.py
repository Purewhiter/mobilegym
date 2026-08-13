"""Scripted validation plans for WeChat Reading tasks.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder (``answer``, ``book_id``, ``*_action``, slider fractions,
``thinner_* / thicker_*``) is computed at materialization time from the
episode's post-setup initial state through the *judge-homologous*
``WechatReading`` domain class — calculators build
``WechatReading(init_state["apps"]["wechat_reading"])`` exactly like judges
build ``WechatReading(input.apps_init["wechat_reading"])``, so derived values
cannot drift from the judge. ``readingRecords`` relative dates ("-3h", "-5d…")
are resolved to absolute ``YYYY-MM-DD`` strings once at store creation
(apps/WechatReading/data/index.ts), so the runtime state both sides read is
already absolute. Explicit test injections would still win over these
calculators; ``test_scripted.py`` deliberately injects declared parameters
only, exercising the derivation path end to end.

Restricted ``Branch`` plans (step *count* depends on the initial state, which
``{param}`` rendering cannot express):

- ``CheckCalendarMonthReading`` — the month stats view opens on the current
  sim month; reaching {year}-{month} takes N taps on the untagged "previous
  month" button, N = month distance from ``sim_today(init_state["os"])``.
  Arms ``back_0..back_36`` (3 years of wall-clock drift headroom); an
  out-of-range distance misses the branch table and fails loudly.
- ``FindHighestRatedBookInCategory`` — the category grid (2-column, ~120px
  row pitch, ~6 rows per screen; order mirrors CategoryListPage
  ``TOP_CATEGORIES``) needs 0/1/2 full-screen swipes before the {category}
  tile is tappable (the env never scrolls implicitly). The pick maps the
  category's grid row to an arm via ``_CATEGORY_GRID_INDEX``.
- ``CompareBookLengths`` — the pair sampler only guarantees unequal word
  counts, so the thicker book may already sit on the shelf (the judge's
  ``check_on_shelf`` is then trivially true); its detail page shows
  已加入书架 instead of the add action, so the "tap add" step only exists
  in the ``add_to_shelf`` arm.

Static-by-design residuals (NOT parameterized, on purpose):

- ``OrganizeShelfByRecommendation`` removes bookIds 4/30/65/66/67: the
  ``recommendation`` float param has no sampler/min/max (always 95.0) and no
  sampler mutates the initial shelf, so the id set is fixed; deriving it
  would also change the step *count* per id. Revisit only if the param gains
  a sampler.
- ``ConfigureReaderSettings`` / ``PrivacyAndThemeBundle`` open the reader on
  shelf book 4 (苏菲的世界): readerPrefs are app-global — any initially
  shelved book works, and the initial shelf is fixed on every path.
- UI-geometry constants (font-size slider stops, theme-button order,
  category grid order) mirror the App source; see the comments at each site.
"""

from __future__ import annotations

import datetime
from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_answer,
    assert_text,
    back,
    complete,
    enter,
    grounded_answer,
    open_answer_sheet,
    submit_answer_sheet,
    swipe,
    type_text,
    wait,
)
from bench_env.task.utils import sim_today
from bench_env.task.wechat_reading.app import WechatReading


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_visible(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def action_visible(action_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-action="{action_id}"]:visible', summary=summary)


def trigger_param(trigger_id: str, value: str, *, param: str, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{param}":"{value}"\']:visible',
        summary=summary,
    )


def action_param(action_id: str, value: str, *, param: str, summary: str) -> Step:
    return click_selector(
        f'[data-action="{action_id}"][data-action-params*=\'"{param}":"{value}"\']:visible',
        summary=summary,
    )


def grounded_choice_answer(choice: str, *, summary: str | None = None) -> list[Step]:
    steps = open_answer_sheet()
    steps.append(click_selector(f'button:has-text("{choice}"):visible', summary=f"choose answer {choice}"))
    steps.append(submit_answer_sheet(summary=summary))
    return steps


def open_search_result(book_title: str, book_id: str) -> list[Step]:
    return [
        trigger_visible("search.open", summary="open WeChat Reading search"),
        type_text(book_title, selector="input:visible", clear=True, summary=f"search for {book_title}"),
        wait(0.5, summary="wait for search results"),
        back(summary="dismiss search keyboard"),
        trigger_param("book.detail.open", book_id, param="bookId", summary=f"open book detail {book_id}"),
        wait(0.4, summary="wait for book detail"),
    ]


def open_reader_from_bookshelf(book_id: str) -> list[Step]:
    return [
        trigger_visible("tab.bookshelf", summary="open Bookshelf tab"),
        trigger_param("reader.open", book_id, param="bookId", summary=f"open reader for shelf book {book_id}"),
        wait(0.8, summary="wait for reader"),
    ]


def show_reader_menu() -> Step:
    return {"op": "click", "point": [500, 500], "summary": "tap reader center to show menu"}


def drag_reader_progress(fraction: str) -> Step:
    """Drag the reader progress slider to ``fraction`` (0..1) of its track.

    The slider maps pointer x linearly to ``Math.round(pct * 100)``
    (LocalizedReaderUI.tsx), so an exact-fraction drag lands on the exact
    percent. ``fraction`` may be a ``{placeholder}`` — the compile step
    coerces the rendered string back to float.
    """
    return {
        "op": "drag",
        "selector": "[data-task-progress]:visible",
        "start_fraction": 0.02,
        "end_fraction": fraction,
        "y_fraction": 0.5,
        "end_space": "layout",
        "duration_ms": 500,
        "summary": "drag reader progress slider to target percent",
    }


def drag_font_size() -> Step:
    """Drag the font-size slider to the ``{font_fraction}`` stop position.

    The slider snaps to the nearest of the 12 ``FONT_SIZE_STOPS``
    (Math.round over the track fraction), so dragging to
    ``index / (stops - 1)`` selects the stop exactly.
    """
    return {
        "op": "drag",
        "selector": "[data-task-fontsize]:visible",
        "start_fraction": 0.02,
        "end_fraction": "{font_fraction}",
        "y_fraction": 0.5,
        "end_space": "layout",
        "duration_ms": 500,
        "summary": "drag reader font size slider to target stop",
    }


def set_reader_progress(book_id: str, fraction: str) -> list[Step]:
    return [
        *open_reader_from_bookshelf(book_id),
        show_reader_menu(),
        trigger_visible("reader.progress.open", summary="open reader progress panel"),
        wait(0.3, summary="wait for progress panel"),
        drag_reader_progress(fraction),
        wait(0.3, summary="wait for progress update"),
    ]


def add_book_from_search(book_title: str, book_id: str) -> list[Step]:
    return [
        *open_search_result(book_title, book_id),
        action_param("bookDetail.item.shelf.add.submit", book_id, param="bookId", summary=f"add book {book_id} to shelf"),
        wait(0.3, summary="wait for shelf add"),
    ]


def select_shelf_books(*book_ids: str) -> list[Step]:
    steps: list[Step] = [
        trigger_visible("tab.bookshelf", summary="open Bookshelf tab"),
        trigger_visible("bookshelf.select.enter.tap", summary="enter bookshelf select mode"),
        wait(0.3, summary="wait for select mode"),
    ]
    for book_id in book_ids:
        steps.append(
            action_param("bookshelf.item.select.toggle", book_id, param="bookId", summary=f"select shelf book {book_id}")
        )
    return steps


def remove_selected_books(*book_ids: str) -> list[Step]:
    return [
        *select_shelf_books(*book_ids),
        trigger_visible("bookshelf.modal.confirm_remove.open", summary="open remove confirmation"),
        action_visible("bookshelf.removeSelected.submit", summary="confirm removing selected shelf books"),
        wait(0.4, summary="wait for shelf removal"),
    ]


def set_page_turn_style() -> list[Step]:
    """Select the target page-turn style — action id derived from {style}."""
    return [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.pageTurn.open", summary="open page turn settings"),
        action_visible("{style_action}", summary="select target page turn style"),
        wait(0.2, summary="wait for page turn update"),
    ]


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (answer path / get_answer /
# get_expected_response / check_goals in bench_env/task/wechat_reading/
# tasks.py) through the same WechatReading domain class over the same initial
# state, so the typed/asserted values are judge-homologous by construction.

def _wr(state: dict[str, Any]) -> WechatReading:
    """Judge-homologous accessor: ``WechatReading(init_state["apps"]["wechat_reading"])``."""
    return WechatReading(state["apps"]["wechat_reading"])


def _num(value: Any) -> str:
    """Numeric string as a human would type it (whole floats lose the .0)."""
    value = float(value)
    return str(int(value)) if value.is_integer() else str(value)


def _store_book(task: Any, state: dict[str, Any]) -> dict[str, Any]:
    return _wr(state).require_book_by_title(task.p.book_title)


def _store_book_id(task: Any, state: dict[str, Any]) -> str:
    """bookId for the declared {book_title} — search-result / shelf tap target."""
    return str(_store_book(task, state)["id"])


def _hot_search_title(task: Any, state: dict[str, Any]) -> str:
    """Mirror the CheckHotSearchRank answer path ``.hotSearch[rank={rank}].title``."""
    for item in _wr(state).hot_search:
        if str(item.get("rank")) == str(task.p.rank):
            return str(item["title"])
    raise ValueError(f"hotSearch rank {task.p.rank} not found")


_WEEKDAY_ZH = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


def _best_weekday_choice(task: Any, state: dict[str, Any]) -> str:
    """Mirror AnalyzeReadingHabit.check_goals: the judge accepts the
    ``date_match_labels`` of *any* tied best date (which include 星期X); the
    plan answers the first tied date's weekday — always one of the sheet's
    choice options."""
    best = _wr(state).best_reading_dates_in_last_week(state["os"])[0]
    return _WEEKDAY_ZH[datetime.date.fromisoformat(best).weekday()]


def _words_label(total_words: Any) -> str:
    """Mirror formatWechatReadingWords (zh): >=1万 → '9.2万字', else '9200字'."""
    words = int(total_words)
    if words >= 10000:
        return f"{words / 10000:.1f}万字"
    return f"{words}字"


def _length_pair(task: Any, state: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """(thinner, thicker) — thicker mirrors CompareBookLengths.check_goals
    (``book1 if w1 > w2 else book2``; sampling guarantees unequal counts)."""
    wr = _wr(state)
    b1 = wr.require_book_by_title(task.p.book1)
    b2 = wr.require_book_by_title(task.p.book2)
    if int(b1["totalWords"]) > int(b2["totalWords"]):
        return b2, b1
    return b1, b2


def _lowest_progress_book_id(task: Any, state: dict[str, Any]) -> str:
    """Mirror FindLowestProgressAndRead.check_goals: the target book is bound
    to the *initial* state's lowest-progress shelf title."""
    wr = _wr(state)
    return str(wr.require_book_by_title(wr.shelf_book_title_with_lowest_progress())["id"])


def _progress_fraction(task: Any, state: dict[str, Any]) -> float:
    """Slider track fraction for the declared {percentage} target."""
    return int(task.p.percentage) / 100


# Mirror of apps/WechatReading/constants.ts FONT_SIZE_STOPS (slider geometry);
# the task's font_size enum values [16, 20, 24, 30] are all stops.
_FONT_SIZE_STOPS = [16, 17, 18, 19, 20, 22, 24, 27, 30, 33, 36, 40]


def _font_fraction(task: Any, state: dict[str, Any]) -> float:
    return _FONT_SIZE_STOPS.index(int(task.p.font_size)) / (len(_FONT_SIZE_STOPS) - 1)


# Declared enum value → App action id (SettingsPage sub-pages).
_PAGE_TURN_ACTION = {
    "仿真翻页": "settings.pageTurnStyle.select.simulation",
    "上下滚动": "settings.pageTurnStyle.select.scroll",
    "覆盖翻页": "settings.pageTurnStyle.select.cover",
}
# 跟随系统 is a toggle row, 浅色/深色 are select rows only rendered while the
# toggle is off — safe unconditionally: _invert_criteria always resets the
# initial darkMode to the *first differing* enum value (深色 or 浅色, never
# 跟随系统), so the select rows are always present when needed.
_DARK_MODE_ACTION = {
    "深色": "settings.darkMode.select.dark",
    "浅色": "settings.darkMode.select.light",
    "跟随系统": "settings.darkMode.followSystem.toggle",
}
_VISIBILITY_ACTION = {
    "仅自己可见": "settings.profilePrivacy.visibility.select.self",
    "互关可见": "settings.profilePrivacy.visibility.select.mutual",
    "所有人可见": "settings.profilePrivacy.visibility.select.all",
}
# Reader theme panel 「颜色」 row button order (LocalizedReaderUI.tsx):
# white, yellow, green, dark → :nth-of-type(1..4).
_THEME_BUTTON_INDEX = {"white": 1, "yellow": 2, "green": 3, "dark": 4}


def _mapped(table: dict[str, Any], key: str, what: str) -> Any:
    try:
        return table[key]
    except KeyError:
        raise ValueError(f"no {what} mapping for param value {key!r}") from None


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "wechat_reading.CheckCoinBalance": {
        # answer path .user.coinBalance; CoinsPage renders toFixed(2) — the
        # number matcher treats "50" and on-screen "50.00" as equal.
        "answer": lambda task, state: _num(_wr(state).user["coinBalance"]),
    },
    "wechat_reading.CheckHotSearchRank": {"answer": _hot_search_title},
    "wechat_reading.CheckBookRating": {
        "book_id": _store_book_id,
        # answer path .store[title].recommendedValue（屏显带 % 后缀，number 匹配）
        "answer": lambda task, state: _num(_store_book(task, state)["recommendedValue"]),
    },
    "wechat_reading.AddBookToShelf": {"book_id": _store_book_id},
    "wechat_reading.ManageShelf": {"book_id": _store_book_id},
    "wechat_reading.SearchBookAuthor": {
        "book_id": _store_book_id,
        "answer": lambda task, state: str(_store_book(task, state)["author"]),
    },
    "wechat_reading.TogglePrivateReading": {"book_id": _store_book_id},
    "wechat_reading.SetDarkMode": {
        "dark_mode_action": lambda task, state: _mapped(
            _DARK_MODE_ACTION, str(task.p.dark_mode), "darkMode action"
        ),
    },
    "wechat_reading.FindAudiobookPlays": {
        "book_id": lambda task, state: str(
            _wr(state).require_audiobook_by_title(task.p.book_title)["id"]
        ),
        # answer path .audiobooks[title].plays（如 "25万"，text 精确匹配；
        # 详情页文案含它 → assert 的规整化包含成立）
        "answer": lambda task, state: str(
            _wr(state).require_audiobook_by_title(task.p.book_title)["plays"]
        ),
    },
    "wechat_reading.AnalyzeReadingHabit": {"answer": _best_weekday_choice},
    "wechat_reading.CheckCalendarMonthReading": {
        # get_answer = month_reading_day_count(year, month)（按日期去重计数）
        "answer": lambda task, state: str(
            _wr(state).month_reading_day_count(int(task.p.year), int(task.p.month))
        ),
    },
    "wechat_reading.CompareBookLengths": {
        "thinner_title": lambda task, state: str(_length_pair(task, state)[0]["title"]),
        "thinner_id": lambda task, state: str(_length_pair(task, state)[0]["id"]),
        "thinner_words": lambda task, state: _words_label(_length_pair(task, state)[0]["totalWords"]),
        "thicker_title": lambda task, state: str(_length_pair(task, state)[1]["title"]),
        "thicker_id": lambda task, state: str(_length_pair(task, state)[1]["id"]),
        "thicker_words": lambda task, state: _words_label(_length_pair(task, state)[1]["totalWords"]),
    },
    "wechat_reading.FindHighestRatedBookInCategory": {
        # Mirror get_expected_response: first tied best title (the judge's
        # get_answer accepts any tied title, so the first always passes).
        "answer": lambda task, state: str(
            _wr(state).best_book_in_category(str(task.p.category))["title"]
        ),
    },
    "wechat_reading.ConfigureReaderSettings": {
        "font_fraction": _font_fraction,
        "style_action": lambda task, state: _mapped(
            _PAGE_TURN_ACTION, str(task.p.style), "pageTurnStyle action"
        ),
    },
    "wechat_reading.SetProfileVisibility": {
        "visibility_action": lambda task, state: _mapped(
            _VISIBILITY_ACTION, str(task.p.visibility), "visibility action"
        ),
    },
    "wechat_reading.ReadBookProgress": {
        "book_id": _store_book_id,
        "progress_fraction": _progress_fraction,
    },
    "wechat_reading.AddBookAndReadTo": {
        "book_id": _store_book_id,
        "progress_fraction": _progress_fraction,
    },
    "wechat_reading.FindLowestProgressAndRead": {
        "book_id": _lowest_progress_book_id,
        "progress_fraction": _progress_fraction,
    },
    "wechat_reading.PrivacyAndThemeBundle": {
        # theme_color 参数值为内部值（white/yellow/green/dark）→ 主题面板按钮序号
        "theme_button": lambda task, state: str(
            _mapped(_THEME_BUTTON_INDEX, str(task.p.theme_color), "themeColor button")
        ),
        "style_action": lambda task, state: _mapped(
            _PAGE_TURN_ACTION, str(task.p.style), "pageTurnStyle action"
        ),
    },
}


# ---------------------------------------------------------------------------
# wechat_reading.CheckCalendarMonthReading — restricted Branch（上一月点按次数）
# ---------------------------------------------------------------------------

def _calendar_month_pick(task: Any, state: dict[str, Any]) -> str:
    """Taps on the untagged "previous month" button = month distance between
    the sim current month (the month view's default) and {year}-{month} —
    the same ``sim_today(os)`` clock the judge's date helpers use."""
    today = sim_today(state["os"])
    delta = (today.year * 12 + today.month) - (int(task.p.year) * 12 + int(task.p.month))
    return f"back_{delta}"


def _calendar_month_arm(taps: int) -> list[Step]:
    """首页 heroCarousel 挂载后 scrollLeft=128，月阅读卡被滚出视口（hit-test
    不允许隐式滚动），改从 Me 页进周视图再切月 Tab；统计页 Tab 与上/下月切换
    按钮均未打 data-trigger，用文本/结构选择器定位。"""
    return [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("myReading.open.week", summary="open reading stats"),
        wait(0.5, summary="wait for reading stats page"),
        click_selector('button:text-is("月"):visible', summary="switch to month view"),
        wait(0.4, summary="wait for month view"),
        *[
            click_selector(
                "div.flex.items-center.gap-2 > button:nth-child(1):visible",
                summary=f"go to previous month ({i + 1}/{taps})",
            )
            for i in range(taps)
        ],
        wait(0.4, summary="wait for target month stats"),
        # 计数类答案：断带语义标签的证据行"阅读{answer}天"，防纯短数字误匹配
        assert_text("阅读{answer}天", summary="assert monthly reading day count on screen"),
        *grounded_answer("{answer}", summary="answer month reading day count"),
        complete(),
    ]


# ---------------------------------------------------------------------------
# wechat_reading.CompareBookLengths — restricted Branch（厚书是否已在架）
# ---------------------------------------------------------------------------

def _compare_lengths_pick(task: Any, state: dict[str, Any]) -> str:
    """Mirror check_goals' effective precondition: if the thicker book is
    already shelved the judge's check_on_shelf holds without any action —
    and its detail page renders 已加入书架 with no add action to tap."""
    wr = _wr(state)
    thicker = _length_pair(task, state)[1]
    return "already_on_shelf" if wr.is_book_on_shelf(str(thicker["id"])) else "add_to_shelf"


def _compare_lengths_arm(*, add: bool) -> list[Step]:
    """先开字数较少的一本核对字数，再重搜字数较多的一本 —— 访问顺序固定为
    thinner→thicker，thicker 由派生参数按判分器同一比较式算出，屏显字数
    文案（"9.2万字"）同源自 store.totalWords。"""
    steps: list[Step] = [
        *open_search_result("{thinner_title}", "{thinner_id}"),
        assert_text("{thinner_words}", summary="assert thinner book word count on screen"),
        back(summary="back to search page"),
        # 返回搜索页（重置为热搜态）后直接重搜另一本
        type_text("{thicker_title}", selector="input:visible", clear=True, summary="search for thicker book"),
        wait(0.5, summary="wait for search results"),
        back(summary="dismiss search keyboard"),
        trigger_param("book.detail.open", "{thicker_id}", param="bookId", summary="open thicker book detail"),
        wait(0.4, summary="wait for book detail"),
        assert_text("{thicker_words}", summary="assert thicker book word count on screen"),
    ]
    if add:
        steps += [
            action_param("bookDetail.item.shelf.add.submit", "{thicker_id}", param="bookId", summary="add thicker book to shelf"),
            wait(0.3, summary="wait for shelf add"),
        ]
    else:
        # 已在架：详情页按钮文案即为状态证据，无加架 action 可点
        steps.append(assert_text("已加入书架", summary="assert thicker book already on shelf"))
    steps += [
        *grounded_choice_answer("{thicker_title}", summary="answer thicker book"),
        complete(),
    ]
    return steps


# ---------------------------------------------------------------------------
# wechat_reading.FindHighestRatedBookInCategory — restricted Branch（分类网格滚动）
# ---------------------------------------------------------------------------

# CategoryListPage TOP_CATEGORIES 顺序（2 列网格的展示序号）。只收录任务可能
# 采样到的 UI 分类（WECHAT_READING_UI_TO_DATA 的键）；表外值 → pick 返回
# "unknown" → 分支缺失，episode 大声失败。
_CATEGORY_GRID_INDEX = {
    "历史": 4,
    "精品小说": 5,
    "文学": 6,
    "社会小说": 7,
    "个人成长": 9,
    "经济理财": 10,
    "心理": 11,
    "哲学宗教": 12,
    "悬疑推理": 14,
    "人物传记": 15,
    "医学健康": 17,
    "政治军事": 18,
    "情感小说": 20,
    "科幻小说": 21,
    "科学技术": 22,
    "计算机": 23,
    "童书": 24,
    "生活百科": 26,
}


def _category_scroll_pick(task: Any, state: dict[str, Any]) -> str:
    """Grid row (2 tiles/row, ~120px pitch, ~6 rows on screen) → swipe count:
    rows 0-5 visible, rows 6-9 after one full swipe (~480px), deeper rows
    after two."""
    index = _CATEGORY_GRID_INDEX.get(str(task.p.category), -1)
    if index < 0:
        return "unknown"
    row = index // 2
    if row <= 5:
        return "visible"
    if row <= 9:
        return "scroll_1"
    return "scroll_2"


def _category_arm(swipes: int) -> list[Step]:
    steps: list[Step] = [
        trigger_visible("categories.open", summary="open category list"),
        wait(0.4, summary="wait for category list"),
    ]
    steps += [
        swipe([500, 850], [500, 250], summary=f"scroll category grid {i + 1}/{swipes}")
        for i in range(swipes)
    ]
    if swipes:
        steps.append(wait(0.3, summary="wait for category grid scroll"))
    steps += [
        trigger_param("category.detail.open", "{category}", param="categoryName", summary="open category detail"),
        wait(0.4, summary="wait for category detail"),
        # 分类页按评分降序排列 → 评分最高的书名总在列表首屏可见
        assert_answer("{answer}", summary="assert highest rated book title on screen"),
        *grounded_answer("{answer}", summary="answer highest rated category book"),
        complete(),
    ]
    return steps


PLANS: dict[str, list[Step] | Branch] = {
    "wechat_reading.CheckCoinBalance": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("wallet.coins.open", summary="open coin wallet page"),
        wait(0.4, summary="wait for coin balance page"),
        # 余额大字在屏（number matcher：50 与屏显 50.00 数值相等）
        assert_answer("{answer}", summary="assert coin balance on screen"),
        *grounded_answer("{answer}", summary="answer coin balance"),
        complete(),
    ],
    "wechat_reading.CheckHotSearchRank": [
        trigger_visible("search.open", summary="open WeChat Reading search"),
        wait(0.4, summary="wait for hot search list"),
        # 热搜榜第 {rank} 名书名在榜单首屏可见（rank 无 sampler，恒为默认 1）
        assert_answer("{answer}", summary="assert hot search title on screen"),
        *grounded_answer("{answer}", summary="answer hot search title"),
        complete(),
    ],
    "wechat_reading.CheckBookRating": [
        *open_search_result("{book_title}", "{book_id}"),
        # 详情页"微信读书推荐值 92%"（number matcher 容忍 % 后缀）
        assert_answer("{answer}", summary="assert book recommendation value on screen"),
        *grounded_answer("{answer}", summary="answer book recommendation value"),
        complete(),
    ],
    "wechat_reading.AddBookToShelf": [
        *add_book_from_search("{book_title}", "{book_id}"),
        complete(),
    ],
    "wechat_reading.ManageShelf": [
        *remove_selected_books("{book_id}"),
        complete(),
    ],
    "wechat_reading.SearchBookAuthor": [
        *open_search_result("{book_title}", "{book_id}"),
        # 详情页作者行"余华 >"在屏
        assert_answer("{answer}", summary="assert book author on screen"),
        *grounded_answer("{answer}", summary="answer book author"),
        complete(),
    ],
    "wechat_reading.TogglePrivateReading": [
        *select_shelf_books("{book_id}"),
        trigger_visible("bookshelf.modal.private.open", summary="open private reading confirmation"),
        action_visible("bookshelf.privateReading.enable.submit", summary="enable private reading"),
        wait(0.4, summary="wait for private reading update"),
        complete(),
    ],
    "wechat_reading.EditProfileName": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("profile.edit.open", summary="open profile editor"),
        type_text(
            "{new_name}",
            selector='[data-action="profile.edit.name.input"]:visible',
            clear=True,
            summary="type new profile name",
        ),
        enter(summary="commit inline profile name input"),
        complete(),
    ],
    "wechat_reading.SetDarkMode": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.darkMode.open", summary="open dark mode settings"),
        # 深色/浅色 → select 行；跟随系统 → toggle 行（见 _DARK_MODE_ACTION 注释）
        action_visible("{dark_mode_action}", summary="apply target dark mode"),
        complete(),
    ],
    "wechat_reading.FindAudiobookPlays": [
        # 搜索结果的图书/有声书条目共用 book.detail.open（bookId=audio_*）
        *open_search_result("{book_title}", "{book_id}"),
        # 有声书详情页"听过 25万次"在屏（text matcher 规整化包含）
        assert_answer("{answer}", summary="assert audiobook play count on screen"),
        *grounded_answer("{answer}", summary="answer audiobook play count"),
        complete(),
    ],
    "wechat_reading.AnalyzeReadingHabit": [
        trigger_visible("myReading.open.week", summary="open weekly reading stats"),
        wait(0.5, summary="wait for weekly stats page"),
        # 答案（星期几）需综合最近 7 天记录推理，窗口可跨自然周，周视图单屏
        # 不直接给出该结论文本；断"阅读时长分布"图表卡可见作为读屏证据。
        assert_text("阅读时长分布", summary="assert weekly duration chart visible"),
        *grounded_choice_answer("{answer}", summary="answer longest reading weekday"),
        complete(),
    ],
    "wechat_reading.CheckCalendarMonthReading": Branch(
        pick=_calendar_month_pick,
        branches={f"back_{n}": _calendar_month_arm(n) for n in range(0, 37)},
    ),
    "wechat_reading.CompareBookLengths": Branch(
        pick=_compare_lengths_pick,
        branches={
            "add_to_shelf": _compare_lengths_arm(add=True),
            "already_on_shelf": _compare_lengths_arm(add=False),
        },
    ),
    "wechat_reading.FindHighestRatedBookInCategory": Branch(
        pick=_category_scroll_pick,
        branches={
            "visible": _category_arm(0),
            "scroll_1": _category_arm(1),
            "scroll_2": _category_arm(2),
        },
    ),
    "wechat_reading.ConfigureReaderSettings": [
        # readerPrefs 为全局设置，任意在架书均可；固定用初始书架的 bookId 4
        #（苏菲的世界）—— 初始书架在采样路径上不变。
        *open_reader_from_bookshelf("4"),
        show_reader_menu(),
        trigger_visible("reader.typography.open", summary="open typography panel"),
        wait(0.3, summary="wait for typography panel"),
        drag_font_size(),
        wait(0.3, summary="wait for font size update"),
        back(summary="close reader tool panel"),
        wait(0.2, summary="wait for reader tool close"),
        back(summary="return to bookshelf"),
        wait(0.3, summary="wait for bookshelf"),
        *set_page_turn_style(),
        complete(),
    ],
    "wechat_reading.UnfollowUser": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("following.open.following", summary="open following list"),
        action_param("following.item.unfollow.toggle", "{user_id}", param="userId", summary="unfollow target user"),
        complete(),
    ],
    "wechat_reading.SetProfileVisibility": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.privacy.open", summary="open privacy settings"),
        trigger_visible("settings.privacy.profile.open", summary="open profile privacy settings"),
        action_visible("{visibility_action}", summary="select target profile visibility"),
        complete(),
    ],
    "wechat_reading.ReadBookProgress": [
        *set_reader_progress("{book_id}", "{progress_fraction}"),
        complete(),
    ],
    "wechat_reading.OrganizeShelfByRecommendation": [
        # 静态豁免：recommendation 无 sampler（恒 95.0）、初始书架固定，
        # 故待删集合恒为 {4,30,65,66,67}（推荐值 ≤95 的在架书，判分器同式）；
        # 逐书选择步数是结构性的，参数化无收益。见模块 docstring。
        *remove_selected_books("4", "30", "65", "66", "67"),
        complete(),
    ],
    "wechat_reading.AddBookAndReadTo": [
        *add_book_from_search("{book_title}", "{book_id}"),
        # hybrid 无 answer_fields（不能用 assert_answer）；断详情页按钮文案
        # 变为"已加入书架"作为加架成功的状态证据。
        assert_text("已加入书架", summary="assert book added to shelf"),
        trigger_param("reader.open", "{book_id}", param="bookId", summary="open reader for added book"),
        wait(0.8, summary="wait for added book reader"),
        show_reader_menu(),
        trigger_visible("reader.progress.open", summary="open reader progress panel"),
        wait(0.3, summary="wait for progress panel"),
        drag_reader_progress("{progress_fraction}"),
        wait(0.3, summary="wait for progress update"),
        complete(),
    ],
    "wechat_reading.FindLowestProgressAndRead": [
        *set_reader_progress("{book_id}", "{progress_fraction}"),
        complete(),
    ],
    "wechat_reading.PrivacyAndThemeBundle": [
        # 阅读器宿主书为固定默认（bookId 4，见 ConfigureReaderSettings 注释）
        *open_reader_from_bookshelf("4"),
        show_reader_menu(),
        trigger_visible("reader.theme.open", summary="open reader theme panel"),
        wait(0.3, summary="wait for theme panel"),
        click_selector(
            'div[data-task-theme] button:nth-of-type({theme_button}):visible',
            summary="select target reader theme color",
        ),
        wait(0.2, summary="wait for theme update"),
        back(summary="close reader tool panel"),
        wait(0.2, summary="wait for reader tool close"),
        back(summary="return to bookshelf"),
        wait(0.3, summary="wait for bookshelf"),
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.privacy.open", summary="open privacy settings"),
        action_visible("settings.privacy.{setting_key}.toggle", summary="enable target privacy setting"),
        back(summary="return to settings"),
        trigger_visible("settings.pageTurn.open", summary="open page turn settings"),
        action_visible("{style_action}", summary="select target page turn style"),
        complete(),
    ],
}
