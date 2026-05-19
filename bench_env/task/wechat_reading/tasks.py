"""
微信读书（wechat_reading）bench 任务定义。

各 Task 类 docstring 遵循 bench_env/docs/task/CONVENTIONS.md §12：第一段概括验证目标；第二段「判定」说明
ground truth 来源、check 结构与匹配方式；第三段「注意」仅在边界非显然时补充。
实现仍须与 docstring 一致；代码是最终依据。
"""
# -- Task Index (auto-generated, do not edit) --
# 22 tasks | L1×4  L2×8  L3×9  L4×1
#
# [L1] CheckCoinBalance                微信读书里书币还有多少
# [L3] CheckHotSearchRank              微信读书热搜榜第{rank}名是什么书
# [L1] CheckBookRating                 帮我看看微信读书里《{book_title}》推荐值多少
# [L2] AddBookToShelf                  把《{book_title}》加到微信读书书架
# [L1] ManageShelf                     把微信读书书架里《{book_title}》移出去
# [L2] SearchBookAuthor                微信读书里《{book_title}》是谁写的
# [L3] TogglePrivateReading            把书架里的《{book_title}》设成私密阅读
# [L2] EditProfileName                 把微信读书的昵称改成{new_name}
# [L3] SetDarkMode                     把微信读书深色模式改成{dark_mode}
# [L2] FindAudiobookPlays              微信读书里《{book_title}》有声版播放量多少
# [L3] AnalyzeReadingHabit             最近一周在微信读书上哪天读的时间最长
# [L3] CheckCalendarMonthReading       微信读书{year}年{month}月总共读了多少天
# [L2] CompareBookLengths              对比微信读书里《{book1}》和《{book2}》的字数，告诉我字数多的那本，然后加到书架
# [L3] FindHighestRatedBookInCategory  微信读书{category}分类里评分最高的书是哪本
# [L2] ConfigureReaderSettings         把微信读书的阅读器字体大小调成{font_size}，翻页方式改成{style}
# [L1] UnfollowUser                    在微信读书取消关注{user_name}
# [L2] SetProfileVisibility            把微信读书主页可见范围改成{visibility}
# [L3] ReadBookProgress                把微信读书里《{book_title}》翻到{percentage}%的位置
# [L4] OrganizeShelfByRecommendation   整理微信读书书架，把推荐值不高于{recommendation}%的书都删掉
# [L2] AddBookAndReadTo                帮我在微信读书找到《{book_title}》加到书架，调整读书进度到{percentage}%
# [L3] FindLowestProgressAndRead       微信读书书架里哪本书我读的进度最低，帮我翻到{percentage}%的位置
# [L3] PrivacyAndThemeBundle           把微信读书的阅读颜色换成{theme_color}，开启"{privacy_label}"，再把翻页方式改成{style}
# -- End Task Index --


from __future__ import annotations

import datetime
import re
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask, build_answer_checks, match_duration
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import sim_today
from bench_env.task.wechat_reading.app import (
    WECHAT_READING_FONT_SIZE_VALUES,
    WECHAT_READING_PAGE_TURN_STYLE_VALUES,
    WECHAT_READING_PROFILE_NAME_VALUES,
    WECHAT_READING_PROFILE_VISIBILITY_VALUES,
    WECHAT_READING_THEME_COLOR_PARAM,
    WechatReading,
)


# =============================================================================
# L1 — 基础覆盖
# =============================================================================


class CheckCoinBalance(AnswerTask):
    """验证 Agent 能否正确读出当前用户书币余额。

    判定：宣告式 answer=.user.coinBalance；ground truth 来自 App state；
    AnswerTask 默认 match_value 比对回答中的数值。

    注意：objective=query，仅答案判定，无状态变更要求。
    """
    templates = ["微信读书里书币还有多少"]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["extract"]
    answer = ".user.coinBalance"
    answer_fields = [{"type": "number", "label": "书币余额"}]


class CheckHotSearchRank(AnswerTask):
    """验证 Agent 能否读出热搜榜指定名次对应的书名。

    判定：answer=.hotSearch[rank={rank}].title；单一路径、单值匹配。
    """
    templates = ["微信读书热搜榜第{rank}名是什么书"]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["extract"]
    parameters = {
        "rank": {
            "type": "integer",
            "default": 1,
            "description": "热搜排名",
        },
    }
    answer = ".hotSearch[rank={rank}].title"
    answer_fields = [{"type": "text", "label": "书名", "hint": "如：围城"}]


class CheckBookRating(AnswerTask):
    """验证 Agent 能否读出书城内某书的推荐值。

    判定：answer=.store[title={book_title}].recommendedValue；按 AnswerTask
    默认数值匹配（match_value 自动提取回答中的数字，容忍 % 后缀）。
    """
    templates = ["帮我看看微信读书里《{book_title}》推荐值多少"]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["extract"]
    parameters = {
        "book_title": {
            "type": "string",
            "source": "apps.wechat_reading.store[title]",
            "default": "活着",
            "description": "书籍标题",
        },
    }
    answer = ".store[title={book_title}].recommendedValue"
    answer_fields = [{"type": "number", "label": "推荐值（%）"}]


# =============================================================================
# L2 — 核心原子操作
# =============================================================================


class AddBookToShelf(BaseTask):
    """验证是否将初始不在架的书加入书架。

    判定：一项 check — WechatReading.check_on_shelf(book_title)，expected=True。

    注意：operate；expected_changes 含 shelf、bookProgress、readingBookIds、allProgressBookIds。
    """
    templates = [
        "把《{book_title}》加到微信读书书架",
        "Add 《{book_title}》 to my WeChat Read bookshelf",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "create"]
    parameters = {
        "book_title": {
            "type": "string",
            "default": "三体",
            "sampler": WechatReading.sample_book_title_not_on_shelf,
            "description": "书籍标题（必须初始不在书架中）",
        },
    }
    expected_changes = ["shelf", "bookProgress", "readingBookIds", "allProgressBookIds"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        return [wr.check_on_shelf(self.p.book_title)]


class ManageShelf(BaseTask):
    """验证是否将指定书从书架移出。

    判定：check_on_shelf(book_title, expected=False)。
    """
    templates = [
        "把微信读书书架里《{book_title}》移出去",
        "Remove 《{book_title}》 from my WeChat Read bookshelf",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["delete"]
    parameters = {
        "book_title": {
            "type": "string",
            "default": "红楼梦",
            "sampler": WechatReading.sample_shelf_title,
            "description": "书籍标题（必须初始在书架中）",
        },
    }
    expected_changes = ["shelf"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        return [wr.check_on_shelf(self.p.book_title, expected=False)]


class SearchBookAuthor(AnswerTask):
    """验证 Agent 能否答出某书的作者。

    判定：answer=.store[title={book_title}].author。
    """
    templates = ["微信读书里《{book_title}》是谁写的"]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "extract"]
    parameters = {
        "book_title": {
            "type": "string",
            "source": "apps.wechat_reading.store[title]",
            "default": "活着",
            "description": "书籍标题",
        },
    }
    answer = ".store[title={book_title}].author"
    answer_fields = [{"type": "text", "label": "作者", "hint": "如：鲁迅"}]


class TogglePrivateReading(BaseTask):
    """验证是否将书架上的书设为私密阅读。

    判定：check_private_reading(book_title)，校验 shelf 项 isPrivate。
    """
    templates = [
        "把书架里的《{book_title}》设成私密阅读",
        "Set 《{book_title}》 on my bookshelf to private reading",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings", "edit"]
    parameters = {
        "book_title": {
            "type": "string",
            "default": "苏菲的世界",
            "sampler": WechatReading.sample_public_shelf_title,
            "description": "书籍标题（必须初始在书架里且不是私密阅读）",
        },
    }
    expected_changes = ["shelf"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        return [wr.check_private_reading(self.p.book_title)]


class EditProfileName(CriteriaTask):
    """验证用户昵称是否被改为目标值。

    判定：criteria user.name == 参数 new_name；_post_sample 调用 _invert_criteria。
    """
    templates = [
        "把微信读书的昵称改成{new_name}",
        "Change my WeChat Read nickname to {new_name}",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["edit"]
    parameters = {
        "new_name": {
            "type": "enum",
            "values": WECHAT_READING_PROFILE_NAME_VALUES,
            "default": "阿青",
        },
    }
    criteria = {"user.name": "{new_name}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class SetDarkMode(CriteriaTask):
    """验证深色模式是否为浅色 / 深色 / 跟随系统之一。

    判定：criteria settings.darkMode == 参数内部值（模板展示为「深色模式」等，
    由 enum 映射到 store 值）；_post_sample：_invert_criteria。
    """
    templates = ["把微信读书深色模式改成{dark_mode}"]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    parameters = {
        "dark_mode": {
            "type": "enum",
            "values": {
                "深色模式": "深色",
                "浅色模式": "浅色",
                "跟随系统": "跟随系统",
            },
            "default": "深色",
        },
    }
    criteria = {"settings.darkMode": "{dark_mode}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class FindAudiobookPlays(AnswerTask):
    """验证 Agent 能否读出某有声书的播放量文案。

    判定：answer=.audiobooks[title={book_title}].plays（如「25万」）。
    """
    templates = ["微信读书里《{book_title}》有声版播放量多少"]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "extract"]
    parameters = {
        "book_title": {
            "type": "string",
            "source": "apps.wechat_reading.audiobooks[title]",
            "default": "红楼梦",
            "description": "有声书标题",
        },
    }
    answer = ".audiobooks[title={book_title}].plays"
    answer_fields = [{"type": "text", "label": "播放量", "hint": "如：8万"}]
    expected_changes = ["recommendedAudiobooks"]


# =============================================================================
# L3 — 多步推理与跨功能
# =============================================================================
class AnalyzeReadingHabit(BaseTask):
    """验证能否指出最近一周（7 天窗口）阅读时长最长的那一天。

    判定：best_reading_dates_in_last_week 返回所有并列最高日期；
    回答须命中其中任一日期的 date_labels（多日并列时答任一天均可）。

    注意：与 AnswerTask 不同，需自定义日期回答匹配（§4.6）。
    并列时 ground truth 为多个日期，无法用单一 answer 路径表达。
    """
    templates = [
        "最近一周在微信读书上哪天读的时间最长",
        "看看微信读书这一周的阅读记录里哪天读得最久",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    answer_fields = [{"type": "choice", "label": "阅读时间最长的一天",
                      "options": ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps_init["wechat_reading"])
        best_dates = wr.best_reading_dates_in_last_week(input.os_init)
        answer_text = re.sub(r"\s+", "", str(input.answer or ""))
        all_labels: list[str] = []
        for d in best_dates:
            all_labels.extend(WechatReading.date_labels(d, input.os_init))
        return [{
            "field": "answer",
            "expected": all_labels,
            "actual": input.answer,
            "passed": any(label in answer_text for label in all_labels),
        }]


class CheckCalendarMonthReading(AnswerTask):
    """验证指定自然月内有阅读记录的天数。

    判定：get_answer 为 month_reading_day_count(year, month)；按 readingRecords
    去重日期；返回 int。
    """
    templates = [
        "微信读书{year}年{month}月总共读了多少天",
        "查下{year}年{month}月我在微信读书上有几天阅读记录",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    parameters = {
        "year": {
            "type": "integer",
            "default": 2026,
            "description": "年份",
        },
        "month": {
            "type": "integer",
            "default": 1,
            "description": "月份",
        },
        "_record_month": {
            "sampler": WechatReading.sample_year_month_with_records,
            "fields": {"year": "year", "month": "month"},
        },
    }
    answer_fields = [{"type": "number", "label": "阅读天数"}]

    def get_answer(self, input: JudgeInput) -> Any:
        wr = WechatReading(input.apps_init["wechat_reading"])
        return wr.month_reading_day_count(self.p.year, self.p.month)


class CompareBookLengths(BaseTask):
    """对比两书字数，将字数更多的一本上架，并在回答中体现该书书名。

    判定：① check_on_shelf(字数多者)；② build_answer_checks(书名)。
    totalWords 来自 store；采样保证两书字数不等。

    注意：objective=hybrid；状态与回答均需通过。
    """
    templates = [
        "对比微信读书里《{book1}》和《{book2}》的字数，告诉我字数多的那本，然后加到书架",
        "告诉我《{book1}》和《{book2}》在微信读书里哪本更厚，帮我把厚的那本收到书架",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["extract", "reasoning", "create"]
    parameters = {
        "book1": {
            "type": "string",
            "default": "三体",
            "description": "书籍1",
        },
        "book2": {
            "type": "string",
            "default": "活着",
            "description": "书籍2",
        },
        "_book_pair": {
            "sampler": WechatReading.sample_two_books_unequal_word_counts,
            "fields": {"book1": "book1", "book2": "book2"},
        },
    }
    expected_changes = ["shelf", "bookProgress", "readingBookIds", "allProgressBookIds"]
    answer_fields = [{"type": "choice", "label": "字数更多的书名", "options": ["{book1}", "{book2}"]}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        b1 = wr.require_book_by_title(self.p.book1)
        b2 = wr.require_book_by_title(self.p.book2)
        w1, w2 = int(b1["totalWords"]), int(b2["totalWords"])
        thicker = self.p.book1 if w1 > w2 else self.p.book2
        checks = [wr.check_on_shelf(thicker, field="shelf_thicker_book")]
        checks.extend(build_answer_checks(thicker, input.answer))
        return checks


class FindHighestRatedBookInCategory(AnswerTask):
    """验证某分类下评分最高的书名（同分并列时多答案均可）。

    判定：get_answer 用 highest_rated_books_in_category；唯一最高返回 str，
    并列返回 re.Pattern 匹配任一书名（§4.3）。
    """
    templates = [
        "微信读书{category}分类里评分最高的书是哪本",
        "看看微信读书{category}类的书哪本评分最高",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    parameters = {
        "category": {
            "type": "string",
            "default": "文学",
            "sampler": WechatReading.sample_category_with_multiple_books,
            "description": "书籍分类",
        },
    }
    answer_fields = [{"type": "text", "label": "评分最高的书名", "hint": "如：围城"}]

    def get_answer(self, input: JudgeInput) -> Any:
        wr = WechatReading(input.apps_init["wechat_reading"])
        best_books = wr.highest_rated_books_in_category(self.p.category)
        if len(best_books) == 1:
            return str(best_books[0]["title"])
        return re.compile("|".join(re.escape(str(book["title"])) for book in best_books))

    def get_expected_response(self, input):
        wr = WechatReading(input.apps_init["wechat_reading"])
        best_books = wr.highest_rated_books_in_category(self.p.category)
        # In grounded mode, return the first tied book's title
        return [str(best_books[0]["title"])]


class ConfigureReaderSettings(CriteriaTask):
    """同时设置阅读器字号与系统级翻页方式。

    判定：criteria 同时检查 readerPrefs.fontSize 与 settings.pageTurnStyle；
    _post_sample：_invert_criteria。
    """
    templates = [
        "把微信读书的阅读器字体大小调成{font_size}，翻页方式改成{style}",
        "在微信读书里把阅读器字体大小改成{font_size}，顺便把翻页方式换成{style}",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "font_size": {
            "type": "enum",
            "values": WECHAT_READING_FONT_SIZE_VALUES,
            "default": 22,
        },
        "style": {
            "type": "enum",
            "values": WECHAT_READING_PAGE_TURN_STYLE_VALUES,
            "default": "仿真翻页",
        },
    }
    criteria = {
        "readerPrefs.fontSize": "{font_size}",
        "settings.pageTurnStyle": "{style}",
    }

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class UnfollowUser(BaseTask):
    """验证是否取消关注指定用户（初始为已关注）。

    判定：check_following(user_id, expected=False)。

    注意：user_id / user_name 由 sample_following_user 协同采样。
    """
    templates = [
        "在微信读书取消关注{user_name}",
        "帮我取关微信读书上的{user_name}",
        "Unfollow {user_name} on WeChat Read",
        "Stop following {user_name} on WeChat Read",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["edit"]
    parameters = {
        "user_id": {
            "type": "string",
            "default": "user_508",
        },
        "user_name": {
            "type": "string",
            "default": "508",
        },
        "_following_user": {
            "sampler": WechatReading.sample_following_user,
            "fields": {"user_id": "user_id", "user_name": "user_name"},
        },
    }
    expected_changes = ["user.following"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        return [wr.check_following(self.p.user_id, expected=False)]


class SetProfileVisibility(CriteriaTask):
    """验证主页可见范围是否为目标枚举（仅自己 / 互关 / 所有人）。

    判定：criteria settings.privacy.profile.visibility；_post_sample：_invert_criteria。
    """
    templates = [
        "把微信读书主页可见范围改成{visibility}",
        "微信读书的主页可见性帮我调成{visibility}",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "visibility": {
            "type": "enum",
            "values": WECHAT_READING_PROFILE_VISIBILITY_VALUES,
            "default": "仅自己可见",
        },
    }
    criteria = {"settings.privacy.profile.visibility": "{visibility}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ReadBookProgress(BaseTask):
    """验证是否将指定书阅读进度推进到不低于某百分比。

    判定：check_progress(book_title, min_pct)；进度由 bookProgress.charOffset
    与 store.totalWords 推导。
    """
    templates = [
        "把微信读书里《{book_title}》翻到{percentage}%的位置",
        "打开微信读书里的《{book_title}》读到{percentage}%左右",
        "Turn to the {percentage}% position of 《{book_title}》 in WeChat Read",
        "Read 《{book_title}》 on WeChat Read to about {percentage}%",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["edit"]
    parameters = {
        "book_title": {
            "type": "string",
            "default": "红楼梦",
            "description": "书籍标题（必须在书架中）",
        },
        "percentage": {
            "type": "integer",
            "default": 20,
            "description": "阅读进度百分比",
        },
        "_progress_target": {
            "sampler": WechatReading.sample_progress_target,
            "fields": {"book_title": "book_title", "percentage": "percentage"},
        },
    }
    expected_changes = ["bookProgress", "readingBookIds", "allProgressBookIds"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        return [wr.check_progress(self.p.book_title, self.p.percentage)]


# =============================================================================
# L4 — 复杂组合与条件分支
# =============================================================================


class OrganizeShelfByRecommendation(BaseTask):
    """按推荐值阈值清理书架：删除推荐值不高于阈值的书，保留更高推荐的书。

    判定：一项自定义 check — 当前书架 bookId 集合应等于初始架中
    recommendedValue > threshold 的子集（与 check_goals 实现一致）。

    注意：依赖 init 与 curr 快照对比，非单一 criteria。
    """
    templates = [
        "整理微信读书书架，把推荐值不高于{recommendation}%的书都删掉",
        "微信读书书架里推荐值不超过{recommendation}%的书帮我清理掉",
        "Clean up my WeChat Read bookshelf by removing all books with a recommendation score of {recommendation}% or below",
        "Organize my WeChat Read bookshelf and delete books with a recommendation value no higher than {recommendation}%",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["delete", "reasoning"]
    parameters = {
        "recommendation": {
            "type": "float",
            "default": 95.0,
            "description": "推荐值阈值（百分比）",
        },
    }
    expected_changes = ["shelf"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        init_wr = WechatReading(input.apps_init["wechat_reading"])
        curr_wr = WechatReading(input.apps["wechat_reading"])
        expected_ids = sorted(
            str(item["bookId"])
            for item in init_wr.shelf
            if float(init_wr.require_store_book(str(item["bookId"]))["recommendedValue"]) > self.p.recommendation
        )
        actual_ids = sorted(str(item["bookId"]) for item in curr_wr.shelf)
        return [{
            "field": "shelf",
            "expected": expected_ids,
            "actual": actual_ids,
            "passed": actual_ids == expected_ids,
        }]


class AddBookAndReadTo(BaseTask):
    """加书到架并将该书读到不低于目标进度。

    判定：① check_on_shelf；② check_progress；两项均须通过。

    注意：objective=hybrid；初始书不在架由采样保证。
    """
    templates = [
        "帮我在微信读书找到《{book_title}》加到书架，调整读书进度到{percentage}%",
        "Find 《{book_title}》 on WeChat Read, add it to my bookshelf, and set the reading progress to {percentage}%",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "create", "edit"]
    parameters = {
        "book_title": {
            "type": "string",
            "default": "三体",
            "description": "书籍标题（初始不在书架）",
        },
        "percentage": {
            "type": "integer",
            "default": 20,
            "description": "阅读进度百分比",
        },
        "_add_read": {
            "sampler": WechatReading.sample_add_book_and_read,
            "fields": {"book_title": "book_title", "percentage": "percentage"},
        },
    }
    expected_changes = ["shelf", "bookProgress", "readingBookIds", "allProgressBookIds"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        return [
            wr.check_on_shelf(self.p.book_title, field="shelf_after_add"),
            wr.check_progress(self.p.book_title, float(self.p.percentage), field="read_progress"),
        ]
class FindLowestProgressAndRead(BaseTask):
    """将书架中进度最低的书读到目标进度。

    判定：先在 **初始 state** 上用 WechatReading.shelf_book_title_with_lowest_progress()
    锁定「起始进度最低」的书名，然后在最终 state 上只检查这本书的进度
    >= percentage。并列最低时与 App 内 shelf 遍历顺序一致。

    注意：percentage 由 sample_percentage_for_lowest_progress_read 单独采样，
    保证相对采样时刻的最低进度书存在可达目标；判定时书名与初始 state 绑定，
    避免用户先把最低那本读高后判定目标“跳到下一本”。objective=operate。
    """
    templates = [
        "微信读书书架里哪本书我读的进度最低，帮我翻到{percentage}%的位置",
        "看看微信读书书架上我进度最落后的是哪本，翻到{percentage}%的位置",
        "Which book on my WeChat Read bookshelf has the lowest reading progress? Jump to the {percentage}% position for me",
        "Find the book with the lowest progress on my WeChat Read bookshelf and jump to the {percentage}% position",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["reasoning", "edit"]
    parameters = {
        "percentage": {
            "type": "integer",
            "default": 50,
            "description": "当前最低进度书需达到的目标百分比",
        },
        "_lowest_pct": {
            "sampler": WechatReading.sample_percentage_for_lowest_progress_read,
            "fields": {"percentage": "percentage"},
        },
    }
    expected_changes = [
        "bookProgress",
        "readingBookIds",
        "allProgressBookIds",
        "finishedBookIds",
        "homeFinishedBookIds",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        init_wr = WechatReading(input.apps_init["wechat_reading"])
        curr_wr = WechatReading(input.apps["wechat_reading"])
        title = init_wr.shelf_book_title_with_lowest_progress()
        return [curr_wr.check_progress(title, float(self.p.percentage))]


class PrivacyAndThemeBundle(CriteriaTask):
    """同时设置阅读器颜色（themeColor）、开启一项隐私开关、设置翻页方式。

    判定：criteria 三条 — readerPrefs.themeColor、settings.privacy.{setting_key}=True、
    settings.pageTurnStyle；隐私项由 sample_privacy_setting_bundle 采样。
    _post_sample：_invert_criteria。

    注意：与 App 阅读器「主题」面板首行「颜色」一致（readerPrefs.themeColor：
    white/yellow/green/dark），不是第二行「背景」（themeBg）。展示名白色/米黄/
    绿色/深色的内部值见 WECHAT_READING_THEME_COLOR_PARAM。
    """
    templates = [
        "把微信读书的阅读颜色换成{theme_color}，开启\"{privacy_label}\"，再把翻页方式改成{style}",
        "在微信读书里把阅读颜色调成{theme_color}、开启\"{privacy_label}\"、翻页方式设成{style}",
    ]
    apps = ["wechat_reading"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    parameters = {
        "theme_color": {
            "type": "enum",
            "values": WECHAT_READING_THEME_COLOR_PARAM,
            "default": "yellow",
        },
        "privacy_label": {
            "type": "string",
            "default": "关注你须获得你的同意",
        },
        "setting_key": {
            "type": "string",
            "default": "requireFollowRequest",
        },
        "style": {
            "type": "enum",
            "values": WECHAT_READING_PAGE_TURN_STYLE_VALUES,
            "default": "仿真翻页",
        },
        "_privacy_setting": {
            "sampler": WechatReading.sample_privacy_setting_bundle,
            "fields": {"privacy_label": "privacy_label", "setting_key": "setting_key"},
        },
    }
    criteria = {
        "readerPrefs.themeColor": "{theme_color}",
        "settings.privacy.{setting_key}": True,
        "settings.pageTurnStyle": "{style}",
    }

    async def _post_sample(self, env):
        await self._invert_criteria(env)
