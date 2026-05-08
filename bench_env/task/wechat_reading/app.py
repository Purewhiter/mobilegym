"""
WeChat Reading app state accessor.
"""

from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.base import BaseApp
from bench_env.task.utils import date_match_labels, sim_today

WECHAT_READING_FONT_SIZE_VALUES = [16, 20, 24, 30]
WECHAT_READING_PAGE_TURN_STYLE_VALUES = ["仿真翻页", "上下滚动", "覆盖翻页"]
WECHAT_READING_DARK_MODE_VALUES = ["浅色", "深色", "跟随系统"]
# 阅读器主题面板首行「颜色」→ readerPrefs.themeColor（与第二行「背景」themeBg 无关）
WECHAT_READING_THEME_COLOR_PARAM: dict[str, str] = {
    "白色": "white",
    "米黄": "yellow",
    "绿色": "green",
    "深色": "dark",
}
WECHAT_READING_CATEGORY_PARAM = {
    "type": "enum",
    "values": ["历史", "文学", "心理", "悬疑推理", "科学技术"],
    "default": "历史",
}

# UI 分类名 → 数据 category 字段值列表（对应 CategoryListPage.tsx 的 dataCategories，仅收录非空映射）
WECHAT_READING_UI_TO_DATA: dict[str, list[str]] = {
    "历史": ["历史"],
    "精品小说": ["小说"],
    "文学": ["文学", "散文"],
    "社会小说": ["小说"],
    "个人成长": ["成长", "励志"],
    "经济理财": ["经济", "理财", "经管", "商业"],
    "心理": ["心理"],
    "哲学宗教": ["哲学"],
    "悬疑推理": ["悬疑"],
    "人物传记": ["传记"],
    "医学健康": ["健康"],
    "政治军事": ["政治", "军事"],
    "情感小说": ["治愈"],
    "科幻小说": ["科幻"],
    "科学技术": ["科技", "科普", "数学"],
    "计算机": ["科技"],
    "童书": ["童话"],
    "生活百科": ["生活"],
}

WECHAT_READING_BOOK_PARAM = {
    "type": "enum",
    "values": ["纳瓦尔宝典", "原则", "中国通史", "明朝那些事儿"],
    "default": "纳瓦尔宝典",
}

WECHAT_READING_PROFILE_NAME_VALUES = ["阿青", "书山有路", "读书人K"]
WECHAT_READING_PROFILE_VISIBILITY_VALUES = ["仅自己可见", "互关可见", "所有人可见"]
WECHAT_READING_PRIVACY_SETTING_OPTIONS = [
    {"label": "关注你须获得你的同意", "key": "requireFollowRequest"},
    {"label": "全局隐藏资深会员", "key": "hideVipGlobal"},
    {"label": "加入书架后自动开启私密阅读", "key": "autoPrivateReading"},
    {"label": "替身书架", "key": "shelfReplacement"},
    {"label": "不接收未关注人的私信", "key": "rejectStrangerMsg"},
    {"label": "关闭个性化推荐", "key": "closePersonalizedRec"},
    {"label": "关闭读书排行榜", "key": "closeReadingRank"},
]


def format_words(total_words: int) -> str:
    """把 totalWords 转为 UI 显示格式（与前端 localization.ts 一致）。

    前端: if (count >= 10000) return `${(count / 10000).toFixed(1)}万字`;
    """
    if total_words >= 10000:
        v = total_words / 10000
        return f"{v:.1f}万"
    return str(total_words)


class WechatReading(BaseApp):
    """WeChat Reading app state accessor."""

    @staticmethod
    def parse_record_date(value: Any) -> datetime.date:
        text = str(value or "").strip()
        if "T" in text:
            text = text.split("T", 1)[0].strip()
        if not text:
            raise ValueError("wechat_reading.readingRecords.date is empty")
        return datetime.date.fromisoformat(text)

    @staticmethod
    def date_labels(date_value: str, os_state: dict | None = None) -> list[str]:
        return date_match_labels(date_value, os_state)

    @staticmethod
    def sample_book_title_not_on_shelf(env_state: dict[str, Any], rng: Any) -> str:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        on_shelf_ids = {str(item["bookId"]) for item in wr.shelf}
        candidates = [book["title"] for book in wr.store if str(book["id"]) not in on_shelf_ids]
        if not candidates:
            raise ValueError("No addable books found in wechat_reading.store")
        return rng.choice(candidates)

    @staticmethod
    def sample_public_shelf_title(env_state: dict[str, Any], rng: Any) -> str:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        candidates = [
            wr.require_store_book(str(item["bookId"]))["title"]
            for item in wr.shelf
            if item.get("isPrivate") is False
        ]
        if not candidates:
            raise ValueError("No public shelf books found")
        return rng.choice(candidates)

    @staticmethod
    def sample_shelf_title(env_state: dict[str, Any], rng: Any) -> str:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        candidates = [wr.require_store_book(str(item["bookId"]))["title"] for item in wr.shelf]
        if not candidates:
            raise ValueError("No shelf books found")
        return rng.choice(candidates)

    @staticmethod
    def sample_progress_target(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        options: list[dict[str, Any]] = []
        for item in wr.shelf:
            book = wr.require_store_book(str(item["bookId"]))
            current_pct = wr.get_progress(str(book["id"]))
            candidates = [pct for pct in [10, 20, 30, 50, 70, 90] if pct > current_pct + 5]
            if candidates:
                options.append({
                    "book_title": book["title"],
                    "percentage": rng.choice(candidates),
                })
        if not options:
            raise ValueError("No readable shelf books found for progress task")
        return rng.choice(options)

    @staticmethod
    def sample_year_month_with_records(env_state: dict[str, Any], rng: Any) -> dict[str, int]:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        seen_pairs = {
            (date_value.year, date_value.month)
            for date_value in (wr.parse_record_date(record["date"]) for record in wr.reading_records)
        }
        if not seen_pairs:
            raise ValueError("No reading record month available")
        year, month = rng.choice(sorted(seen_pairs))
        return {"year": year, "month": month}

    @staticmethod
    def sample_two_distinct_book_titles(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        titles = [str(book["title"]) for book in wr.store]
        if len(titles) < 2:
            raise ValueError("Not enough store books for pair sampling")
        book1, book2 = rng.sample(titles, 2)
        return {"book1": book1, "book2": book2}

    @staticmethod
    def sample_two_books_unequal_word_counts(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        pairs: list[tuple[str, str]] = []
        for i, b1 in enumerate(wr.store):
            for b2 in wr.store[i + 1 :]:
                if int(b1["totalWords"]) != int(b2["totalWords"]):
                    pairs.append((str(b1["title"]), str(b2["title"])))
        if not pairs:
            raise ValueError("No book pair with unequal word counts")
        book1, book2 = rng.choice(pairs)
        return {"book1": book1, "book2": book2}

    @staticmethod
    def sample_two_books_unequal_ratings(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        pairs: list[tuple[str, str]] = []
        for i, b1 in enumerate(wr.store):
            for b2 in wr.store[i + 1 :]:
                if float(b1["rating"]) != float(b2["rating"]):
                    pairs.append((str(b1["title"]), str(b2["title"])))
        if not pairs:
            raise ValueError("No book pair with unequal ratings")
        book1, book2 = rng.choice(pairs)
        return {"book1": book1, "book2": book2}

    @staticmethod
    def sample_add_book_and_read(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        title = WechatReading.sample_book_title_not_on_shelf(env_state, rng)
        percentage = int(rng.choice([10, 15, 20, 25, 30, 40, 50]))
        return {"book_title": title, "percentage": percentage}

    def shelf_book_title_with_lowest_progress(self) -> str:
        """书架中当前阅读进度最低的书籍标题（并列时取 shelf 遍历顺序中先出现的那本）。"""
        if not self.shelf:
            raise ValueError("No shelf books for lowest-progress resolution")
        best_title: str | None = None
        min_progress = 200.0
        for item in self.shelf:
            book_id = str(item["bookId"])
            p = self.get_progress(book_id)
            if p < min_progress:
                min_progress = p
                best_title = str(self.require_store_book(book_id)["title"])
        if best_title is None:
            raise ValueError("Could not resolve lowest-progress shelf book")
        return best_title

    @staticmethod
    def sample_percentage_for_lowest_progress_read(env_state: dict[str, Any], rng: Any) -> dict[str, int]:
        """为「最低进度书读到 X%」任务采样目标百分比：基于当前书架最低进度书，保证目标高于当前进度且可达。"""
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        title = wr.shelf_book_title_with_lowest_progress()
        book = wr.require_book_by_title(title)
        book_id = str(book["id"])
        min_progress = wr.get_progress(book_id)
        total_words = float(book["totalWords"])
        max_pct = min(95, int((total_words - 1) / total_words * 100)) if total_words > 0 else 90
        candidates = [pct for pct in [10, 20, 30, 50, 70, 90] if pct > min_progress + 3 and pct <= max_pct]
        if not candidates:
            candidates = [min(max_pct, int(min_progress) + 10)]
        percentage = int(rng.choice(candidates))
        return {"percentage": percentage}

    @staticmethod
    def sample_conditional_follow_decision(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        following = set(wr.current_following_ids)
        candidates: list[tuple[str, str, int, float]] = []
        for user in wr.users:
            uid = str(user["id"])
            if uid in following:
                continue
            minutes = int(user.get("readingTimeMinutes", 0))
            hours = minutes / 60.0
            candidates.append((uid, str(user["name"]), minutes, hours))
        if not candidates:
            raise ValueError("No non-followed users available for conditional follow task")
        want_follow = rng.choice([True, False])
        if want_follow:
            pool = [c for c in candidates if c[3] > 1.0]
            if not pool:
                pool = candidates
            uid, name, minutes, hours = rng.choice(pool)
            threshold = round(max(0.5, hours - rng.uniform(2, max(5.0, hours * 0.4))), 1)
        else:
            pool = [c for c in candidates if c[3] < 500.0]
            if not pool:
                pool = candidates
            uid, name, minutes, hours = rng.choice(pool)
            threshold = round(hours + rng.uniform(5, 80), 1)
        return {"user_id": uid, "user_name": name, "threshold_hours": threshold}

    @staticmethod
    def sample_following_user(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        candidates = []
        for user_id in wr.current_following_ids:
            user = wr.require_user_by_id(user_id)
            candidates.append({"user_id": user["id"], "user_name": user["name"]})
        if not candidates:
            raise ValueError("Current user is not following anyone")
        return rng.choice(candidates)

    @staticmethod
    def sample_privacy_setting(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        candidates = [
            option
            for option in WECHAT_READING_PRIVACY_SETTING_OPTIONS
            if wr.privacy_settings.get(option["key"]) is False
        ]
        if not candidates:
            raise ValueError("No disabled privacy setting available")
        chosen = rng.choice(candidates)
        return {"setting_label": chosen["label"], "setting_key": chosen["key"]}

    @staticmethod
    def sample_privacy_setting_bundle(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        """同 sample_privacy_setting，但模板参数名为 privacy_label。"""
        base = WechatReading.sample_privacy_setting(env_state, rng)
        return {"privacy_label": base["setting_label"], "setting_key": base["setting_key"]}

    @staticmethod
    def sample_category_with_multiple_books(env_state: dict[str, Any], rng: Any) -> str:
        wr = WechatReading(env_state["apps"]["wechat_reading"])
        candidates = [
            ui_name for ui_name in WECHAT_READING_UI_TO_DATA
            if len(wr.get_books_by_category(ui_name)) >= 2
        ]
        if not candidates:
            raise ValueError("No UI category with multiple books found")
        return rng.choice(candidates)

    @property
    def user(self) -> dict[str, Any]:
        return self.get("user", {})

    @property
    def users(self) -> list[dict[str, Any]]:
        return self.get_list("users")

    @property
    def current_following_ids(self) -> list[str]:
        return [str(user_id) for user_id in self.user.get("following", [])]

    @property
    def settings(self) -> dict[str, Any]:
        return self.get("settings", {})

    @property
    def privacy_settings(self) -> dict[str, Any]:
        return self.get("settings.privacy", {})

    @property
    def profile_privacy(self) -> dict[str, Any]:
        return self.get("settings.privacy.profile", {})

    @property
    def notification_settings(self) -> dict[str, Any]:
        return self.get("settings.notifications", {})

    @property
    def reader_prefs(self) -> dict[str, Any]:
        return self.get("readerPrefs", {})

    @property
    def font_size(self) -> int:
        return int(self.reader_prefs.get("fontSize", 16))

    @property
    def dark_mode(self) -> str:
        return str(self.settings.get("darkMode", ""))

    @property
    def store(self) -> list[dict[str, Any]]:
        return self.get_list("store")

    def get_store_book(self, book_id: str) -> dict[str, Any] | None:
        for book in self.store:
            if str(book.get("id")) == str(book_id):
                return book
        return None

    def require_store_book(self, book_id: str) -> dict[str, Any]:
        book = self.get_store_book(book_id)
        if book is None:
            raise ValueError(f"Store book not found: {book_id}")
        return book

    def get_book_by_title(self, title: str) -> dict[str, Any] | None:
        for book in self.store:
            if str(book.get("title")) == title:
                return book
        return None

    def require_book_by_title(self, title: str) -> dict[str, Any]:
        book = self.get_book_by_title(title)
        if book is None:
            raise ValueError(f"Book not found by title: {title}")
        return book

    def get_books_by_category(self, ui_category: str) -> list[dict[str, Any]]:
        data_cats = WECHAT_READING_UI_TO_DATA.get(ui_category)
        if data_cats is not None:
            return [book for book in self.store if str(book.get("category")) in data_cats]
        # fallback：直接用原始字段匹配（兼容旧调用）
        return [book for book in self.store if str(book.get("category")) == ui_category]

    def highest_rated_books_in_category(self, category: str) -> list[dict[str, Any]]:
        books = self.get_books_by_category(category)
        if not books:
            raise ValueError(f"No books found in category: {category}")
        max_rating = max(float(book["rating"]) for book in books)
        return [book for book in books if float(book["rating"]) == max_rating]

    def best_book_in_category(self, category: str) -> dict[str, Any]:
        """分类中评分最高的第一本书。"""
        return self.highest_rated_books_in_category(category)[0]

    @staticmethod
    def get_book_title_from_store(store: list[dict[str, Any]], book_id: Any) -> str:
        for book in store:
            if str(book.get("id")) == str(book_id):
                return str(book.get("title", ""))
        return ""

    def get_book_title(self, book_id: Any) -> str:
        return self.get_book_title_from_store(self.store, book_id)

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        if str(self.user.get("id")) == str(user_id) or str(user_id) == "user_me":
            return self.user
        for user in self.users:
            if str(user.get("id")) == str(user_id):
                return user
        return None

    def require_user_by_id(self, user_id: str) -> dict[str, Any]:
        user = self.get_user_by_id(user_id)
        if user is None:
            raise ValueError(f"User not found: {user_id}")
        return user

    def get_user_by_name(self, user_name: str) -> dict[str, Any] | None:
        if str(self.user.get("name")) == user_name:
            return self.user
        for user in self.users:
            if str(user.get("name")) == user_name:
                return user
        return None

    def require_user_by_name(self, user_name: str) -> dict[str, Any]:
        user = self.get_user_by_name(user_name)
        if user is None:
            raise ValueError(f"User not found by name: {user_name}")
        return user

    @property
    def shelf(self) -> list[dict[str, Any]]:
        return self.get_list("shelf")

    def get_shelf_item(self, book_id: str) -> dict[str, Any] | None:
        for item in self.shelf:
            if str(item.get("bookId")) == str(book_id):
                return item
        return None

    def is_book_on_shelf(self, book_id: str) -> bool:
        return self.get_shelf_item(book_id) is not None

    def is_private_reading(self, book_id: str) -> bool:
        item = self.get_shelf_item(book_id)
        return bool(item and item.get("isPrivate") is True)

    @property
    def book_progress(self) -> dict[str, dict[str, Any]]:
        return self.get("bookProgress", {})

    def get_progress(self, book_id: str) -> float:
        progress = self.book_progress.get(str(book_id))
        if not progress:
            return 0.0
        book = self.require_store_book(str(book_id))
        total_words = float(book["totalWords"])
        if total_words <= 0:
            raise ValueError(f"Book totalWords must be positive: {book_id}")
        return float(progress.get("charOffset", 0)) / total_words * 100.0

    @property
    def finished_book_ids(self) -> list[str]:
        return [str(book_id) for book_id in self.book_progress if self.get_progress(str(book_id)) >= 99.9]

    def reading_book_titles(self) -> list[str]:
        store_map = {str(book["id"]): book for book in self.store}
        reading_items: list[tuple[str, float]] = []
        for book_id, progress in self.book_progress.items():
            book = store_map.get(str(book_id))
            if book is None:
                continue
            total_words = float(book["totalWords"])
            char_offset = float(progress.get("charOffset", 0))
            if total_words > 0 and char_offset >= total_words:
                continue
            title = str(book.get("title") or "").strip()
            if title:
                raw_last_read = progress.get("lastReadAt", 0)
                try:
                    last_read = float(raw_last_read)
                except (ValueError, TypeError):
                    from datetime import datetime
                    try:
                        last_read = datetime.fromisoformat(str(raw_last_read)).timestamp()
                    except Exception:
                        last_read = 0.0
                reading_items.append((title, last_read))
        # Sort by lastReadAt descending so the most recently read book comes first
        reading_items.sort(key=lambda item: item[1], reverse=True)
        return [title for title, _ in reading_items]

    def find_shelf_book_by_title(
        self, title_substring: str
    ) -> tuple[str, dict[str, Any]]:
        target = str(title_substring).strip()
        if not target:
            raise ValueError("title_substring is empty")
        for item in self.shelf:
            book_id = str(item["bookId"])
            book = self.require_store_book(book_id)
            if target in str(book["title"]):
                return book_id, book
        raise ValueError(f"Shelf book containing '{title_substring}' not found")

    @property
    def reading_records(self) -> list[dict[str, Any]]:
        return self.get_list("readingRecords")

    def reading_minutes_on(self, date_value: datetime.date) -> int:
        total = 0
        for record in self.reading_records:
            if self.parse_record_date(record["date"]) == date_value:
                total += int(record["duration"])
        return total

    def month_reading_day_count(self, year: int, month: int) -> int:
        seen_days = {
            self.parse_record_date(record["date"]).day
            for record in self.reading_records
            if (
                self.parse_record_date(record["date"]).year == year
                and self.parse_record_date(record["date"]).month == month
            )
        }
        return len(seen_days)

    def best_reading_dates_in_last_week(self, os_state: dict[str, Any]) -> list[str]:
        """Return ISO dates with the highest total reading duration in the last 7 days.

        Multiple dates are returned when there is a tie for the maximum.
        """
        today = sim_today(os_state)
        start_date = today - datetime.timedelta(days=6)
        totals: dict[str, int] = {}
        for record in self.reading_records:
            record_date = self.parse_record_date(record["date"])
            if start_date <= record_date <= today:
                iso = record_date.isoformat()
                totals[iso] = totals.get(iso, 0) + int(record["duration"])
        if not totals:
            raise ValueError("No reading records in the last week")
        max_duration = max(totals.values())
        return [date for date, dur in totals.items() if dur == max_duration]

    def best_reading_day_and_duration(self, os_state: dict[str, Any]) -> tuple[str, int]:
        """最近一周阅读时长最高的一天及分钟数。"""
        best_dates = self.best_reading_dates_in_last_week(os_state)
        best_date = best_dates[0]
        minutes = self.reading_minutes_on(datetime.date.fromisoformat(best_date))
        return best_date, minutes

    def today_reading_duration(self, os_state: dict[str, Any] | None = None) -> int:
        """Return total reading minutes for today (sim date). Sums all records matching today's date."""
        if not self.reading_records:
            return 0
        today = sim_today(os_state) if os_state else None
        total = 0
        for record in self.reading_records:
            try:
                record_date = self.parse_record_date(record["date"])
            except (ValueError, KeyError):
                continue
            if today is None or record_date == today:
                total += int(record.get("duration", 0))
        # If no os_state provided and no records matched, fall back to 0
        return total

    @property
    def hot_search(self) -> list[dict[str, Any]]:
        return self.get_list("hotSearch")

    def first_hot_search_title(self) -> str:
        if not self.hot_search:
            raise ValueError("wechat_reading.hotSearch is empty")
        return str(self.hot_search[0]["title"])

    @property
    def audiobooks(self) -> list[dict[str, Any]]:
        return self.get_list("audiobooks")

    def get_audiobook_by_title(self, title: str) -> dict[str, Any] | None:
        for book in self.audiobooks:
            if str(book.get("title")) == title:
                return book
        return None

    def require_audiobook_by_title(self, title: str) -> dict[str, Any]:
        book = self.get_audiobook_by_title(title)
        if book is None:
            raise ValueError(f"Audiobook not found by title: {title}")
        return book

    def is_following(self, user_id: str) -> bool:
        return str(user_id) in self.current_following_ids

    def higher_rated_book(self, book1: str, book2: str) -> dict[str, Any]:
        """比较两本书评分，返回评分更高的书。"""
        first = self.require_book_by_title(book1)
        second = self.require_book_by_title(book2)
        return first if float(first["rating"]) > float(second["rating"]) else second

    def higher_recommended_book(self, book1: str, book2: str) -> dict[str, Any]:
        """比较两本书推荐值，返回推荐值更高的书。"""
        first = self.require_book_by_title(book1)
        second = self.require_book_by_title(book2)
        return (
            first
            if float(first["recommendedValue"]) > float(second["recommendedValue"])
            else second
        )

    # -- Check methods (§1.2.2: return single dict) -------------------------

    def check_following(self, user_id: str, *, expected: bool = True,
                        field: str | None = None) -> dict[str, Any]:
        following = self.is_following(user_id)
        passed = following if expected else not following
        default_field = "following" if expected else "unfollowed"
        return {"field": field or default_field, "expected": expected,
                "actual": following, "passed": passed}

    def check_on_shelf(self, book_title: str, *, expected: bool = True,
                       field: str | None = None) -> dict[str, Any]:
        book = self.require_book_by_title(book_title)
        on_shelf = self.is_book_on_shelf(str(book["id"]))
        passed = on_shelf if expected else not on_shelf
        actual_desc = on_shelf if expected else not on_shelf
        expected_desc = book_title if expected else f"{book_title} removed"
        return {"field": field or "shelf", "expected": expected_desc,
                "actual": actual_desc, "passed": passed}

    def check_private_reading(self, book_title: str, *, field: str | None = None) -> dict[str, Any]:
        book = self.require_book_by_title(book_title)
        is_private = self.is_private_reading(str(book["id"]))
        return {"field": field or "privateReading", "expected": True,
                "actual": is_private, "passed": is_private}

    def check_progress(self, book_title: str, min_pct: float, *,
                       field: str | None = None) -> dict[str, Any]:
        book = self.require_book_by_title(book_title)
        progress = self.get_progress(str(book["id"]))
        return {"field": field or "bookProgress", "expected": f">= {min_pct}%",
                "actual": progress, "passed": progress >= min_pct}
