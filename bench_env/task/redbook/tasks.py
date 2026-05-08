"""
Redbook (小红书) task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 23 tasks | L1×1  L2×6  L3×9  L4×7
#
# [L1] CheckMyProfileField                 帮我看看我的小红书{field}
# [L2] ToggleGeneralSetting                {toggle}小红书设置里的"{setting}"
# [L2] ChangeLanguage                      把小红书语言改成{language}
# [L2] ClearStorageCache                   清理小红书缓存
# [L2] CheckSearchNoteField                在小红书搜"{keyword}"，告诉我第一篇笔记的{field}
# [L2] CollectSearchNote                   在小红书搜"{keyword}"，收藏排在最前面的那篇笔记
# [L2] LikeFirstFeedNote                   在小红书首页切到"{category}"这个分类，给这个分类里排最前面的笔记点个赞
# [L3] CheckSearchUserField                在小红书搜用户"{username}"，看看 TA 的{field}
# [L3] UncollectFirstCollectedNote         把我小红书收藏列表最前面的那篇笔记取消收藏
# [L3] DMFollowedUser                      给我关注的"{username}"发条私信"{message}"
# [L3] LikeRecommendedFeedNoteByKeyword    刷一刷小红书推荐页，给标题里有"{keyword}"的那篇笔记点个赞
# [L3] CommentOnFeedNote                   在小红书推荐页给标题含"{keyword}"的笔记评论一句"{comment}"
# [L3] PublishNoteWithTitleAndContent      发一篇小红书笔记，标题写"{title}"，正文写"{content}"
# [L3] LikeFeedNoteAndReportLikes          给小红书推荐页标题含"{keyword}"的笔记点赞，告诉我它一共多少赞
# [L3] CheckFollowingUserNoteCount         看看小红书我关注列表里的"{username}"发了多少篇笔记
# [L3] CheckFirstChatLastMessage           帮我看下小红书最新的那条对话最后发的是什么
# [L4] CheckFirstCollectedAuthorField      去我小红书【收藏】列表里排在最前面的那篇笔记，告诉我作者的{field}
# [L4] SearchFirstNoteAuthorTopLikedTitle  在小红书搜"{keyword}"，看看第一篇笔记的作者获赞最多的笔记标题是什么
# [L4] FollowAndCheckLocation              在小红书关注"{username}"，顺便告诉我 TA 的 IP 属地
# [L4] SearchCollectAndReportAuthor        搜索"{keyword}"，收藏第一篇笔记，告诉我作者有多少粉丝和获赞
# [L4] CollectFeedNoteAndDMAuthor          收藏推荐页标题含"{keyword}"的笔记，给作者发一句"{message}"
# [L4] PublishAndShareToFollowing          在小红书发一篇标题叫"{title}"的笔记，然后把这个标题私信给"{username}"
# [L4] ReplyToFeedNoteFirstComment         在小红书推荐页找标题含"{keyword}"的笔记，回复第一条评论"{reply}"
# -- End Task Index --

from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask, build_answer_checks
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import norm
from bench_env.task.redbook.app import (
    REDBOOK_COLLECTIBLE_KEYWORDS,
    REDBOOK_FEED_NOTE_KEYWORDS,
    REDBOOK_GENERAL_SETTING_VALUES,
    REDBOOK_LANGUAGE_VALUES,
    REDBOOK_REPLYABLE_FEED_NOTE_KEYWORDS,
    REDBOOK_SEARCH_KEYWORDS,
    Redbook,
)


SEARCH_VIEW_CHANGES = ["searchHistory", "history"]
MESSAGE_VIEW_CHANGES = ["chats", "history"]


# =============================================================================
# L1 — Atomic profile / landing-page queries
# =============================================================================


class CheckMyProfileField(AnswerTask):
    templates = [
        "帮我看看我的小红书{field}",
        "看看我小红书主页上的{field}是多少",
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["query"]
    parameters = {
        "field": {
            "type": "enum",
            "values": {
                "粉丝数": "followers",
                "关注数": "following",
                "获赞与收藏": "likesAndCollections",
            },
            "default": "followers",
            "description": "主页字段",
        },
    }
    answer = ".user.{field}"
    answer_fields = [{"type": "number", "label": "{field}"}]




# =============================================================================
# L2 — Settings / search / simple operate-query
# =============================================================================


class ToggleGeneralSetting(CriteriaTask):
    templates = [
        '{toggle}小红书设置里的"{setting}"',
        '把小红书设置里的"{setting}"{toggle}',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "settings"]
    parameters = {
        "toggle": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": True,
            "description": "开关目标状态",
        },
        "setting": {
            "type": "enum",
            "values": REDBOOK_GENERAL_SETTING_VALUES,
            "default": "mobileDownload",
            "description": "通用设置项",
        },
    }
    criteria = {"settings.general.{setting}": "{toggle}"}

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)


class ChangeLanguage(CriteriaTask):
    templates = [
        "把小红书语言改成{language}",
        "把小红书切换到{language}",
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "settings"]
    parameters = {
        "language": {
            "type": "enum",
            "values": REDBOOK_LANGUAGE_VALUES,
            "default": "zh-CN",
            "description": "目标语言",
        },
    }
    criteria = {"settings.language": "{language}"}

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)


class ClearStorageCache(CriteriaTask):
    templates = [
        "清理小红书缓存",
        "把小红书的缓存清掉",
        "Clear the RedNote cache",
        "Clean up RedNote's storage cache",
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "settings"]
    criteria = {"storage.cacheSizeBytes": 0}


class CheckSearchNoteField(AnswerTask):
    templates = [
        '在小红书搜"{keyword}"，告诉我第一篇笔记的{field}',
        '小红书搜索"{keyword}"后看看最前面的笔记{field}',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "query"]
    expected_changes = SEARCH_VIEW_CHANGES
    parameters = {
        "keyword": {
            "type": "enum",
            "values": REDBOOK_SEARCH_KEYWORDS,
            "default": "OOTD",
            "description": "搜索关键词",
        },
        "field": {
            "type": "enum",
            "values": {
                "标题": "title",
                "点赞数": "likes",
                "收藏数": "collections",
                "评论数": "comments",
                "作者名": "authorName",
            },
            "default": "title",
            "description": "第一篇笔记字段",
        },
    }
    _NUMERIC_NOTE_FIELDS = {"likes", "collections", "comments"}

    @property
    def answer_fields(self):  # type: ignore[override]
        field_val = getattr(self.p, "field", None)
        label = next((k for k, v in self.parameters["field"]["values"].items() if v == field_val), field_val or "")
        t = "number" if field_val in self._NUMERIC_NOTE_FIELDS else "text"
        return [{"type": t, "label": label}]

    def get_answer(self, input: JudgeInput) -> Any:
        return Redbook(input.apps_init["redbook"]).search_note_field(self.p.keyword, self.p.field)


class CollectSearchNote(BaseTask):
    templates = [
        '在小红书搜"{keyword}"，收藏排在最前面的那篇笔记',
        '小红书搜索"{keyword}"后把第一篇笔记收藏一下',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "social"]
    parameters = {
        "keyword": {
            "type": "enum",
            "values": REDBOOK_COLLECTIBLE_KEYWORDS,
            "default": "教程",
            "description": "用于搜索待收藏笔记的关键词",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        note_id = str(rb.first_search_note(self.p.keyword)["id"])
        return [{
            "field": "collect_search_note",
            "expected": note_id,
            "actual": rb.collected_notes,
            "passed": note_id in rb.added_to_collected(),
        }]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        rb = Redbook(input.apps["redbook"])
        note_id = str(rb.first_search_note(self.p.keyword)["id"])
        return [
            "user.collectedNotes",
            f"entities.notesById.{note_id}",
            "searchHistory",
            "history",
        ]


class LikeFirstFeedNote(BaseTask):
    templates = [
        '在小红书首页切到"{category}"这个分类，给这个分类里排最前面的笔记点个赞',
        '在小红书首页进入"{category}"分类，给第一篇笔记点个赞',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["social"]
    parameters = {
        "category": {
            "type": "enum",
            "values": {
                "视频": "video",
                "直播": "live",
                "短剧": "short_drama",
                "头像": "avatar",
                "穿搭": "fashion",
                "壁纸": "wallpaper",
                "美食": "food",
                "情感": "emotions",
                "音乐": "music",
                "美甲": "nails",
                "搞笑": "funny",
                "手工": "crafts",
                "旅行": "travel",
                "彩妆": "makeup",
                "发型": "hairstyle",
                "舞蹈": "dance",
                "绘画": "drawing",
                "读书": "reading",
                "明星": "celebrity",
                "影视": "movies_and_tv",
                "游戏": "games",
                "摄影": "photography",
            },
            "default": "food",
            "description": "首页分类（仅限我的频道里展示的分类，不包括推荐）",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        notes = rb.visible_discover_notes_for_category(self.p.category, limit=40)
        note_id = str(notes[0]["id"]) if notes else ""
        return [{
            "field": "like_first_feed_note",
            "expected": note_id,
            "actual": rb.liked_notes,
            "passed": bool(note_id) and note_id in rb.added_to_liked(),
        }]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        rb = Redbook(input.apps["redbook"])
        notes = rb.visible_discover_notes_for_category(self.p.category, limit=40)
        note_id = str(notes[0]["id"]) if notes else ""
        return [
            "user.likedNotes",
            # Switching the discover category updates homeState.activeCategory
            # (e.g. recommend -> music). This is part of the task behavior,
            # so it should not be treated as an "unexpected" state diff.
            "homeState.activeCategory",
            f"entities.notesById.{note_id}",
            "history",
        ]


# =============================================================================
# L3 — Multi-step social / privacy / sorted search
# =============================================================================


class CheckSearchUserField(AnswerTask):
    templates = [
        '在小红书搜用户"{username}"，看看 TA 的{field}'
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["search", "query"]
    expected_changes = SEARCH_VIEW_CHANGES
    parameters = {
        "username": {
            "type": "string",
            "default": "海边小橘子",
            "sampler": Redbook.sample_user_name,
            "description": "用户名",
        },
        "field": {
            "type": "enum",
            "values": {
                "IP属地": "location",
                "粉丝数": "followers",
                "获赞与收藏": "likesAndCollections",
            },
            "default": "location",
            "description": "用户主页字段",
        },
    }
    _NUMERIC_USER_FIELDS = {"followers", "likesAndCollections"}

    @property
    def answer_fields(self):  # type: ignore[override]
        field_val = getattr(self.p, "field", None)
        label = next((k for k, v in self.parameters["field"]["values"].items() if v == field_val), field_val or "")
        t = "number" if field_val in self._NUMERIC_USER_FIELDS else "text"
        return [{"type": t, "label": label}]

    def get_answer(self, input: JudgeInput) -> Any:
        return Redbook(input.apps_init["redbook"]).user_field_by_name(self.p.username, self.p.field)


class UncollectFirstCollectedNote(BaseTask):
    templates = [
        "把我小红书收藏列表最前面的那篇笔记取消收藏",
        "Remove the first post in my RedNote Favorites from the collection",
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "social"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        target = str(rb.init.first_collected_note()["id"])
        return [{
            "field": "uncollect_first_collected_note",
            "expected": target,
            "actual": rb.collected_notes,
            "passed": target in rb.removed_from_collected(),
        }]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        target = str(rb.init.first_collected_note()["id"])
        return [
            "user.collectedNotes",
            f"entities.notesById.{target}",
            "history",
        ]


class DMFollowedUser(BaseTask):
    templates = [
        '给我关注的"{username}"发条私信"{message}"',
        '在小红书里给我已关注的用户"{username}"发消息"{message}"',
        '帮我私信一下关注列表里的"{username}"，内容是"{message}"',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["social", "create"]
    parameters = {
        "username": {
            "type": "string",
            "default": "海边小橘子",
            "sampler": Redbook.sample_followed_user_name,
            "description": "目标用户名",
        },
        "message": {
            "type": "string",
            "default": "你好呀，最近更新很不错",
            "description": "私信内容",
        },
    }
    expected_changes = ["chats"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        target_user_id = str(rb.init.require_user_by_name(self.p.username)["id"])
        return [{
            "field": "dm_followed_user",
            "expected": self.p.message,
            "actual": rb.get_chat(target_user_id),
            "passed": rb.chat_has_message(target_user_id, self.p.message),
        }]


class LikeRecommendedFeedNoteByKeyword(BaseTask):
    templates = [
        '刷一刷小红书推荐页，给标题里有"{keyword}"的那篇笔记点个赞',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["explore", "social"]
    parameters = {
        "keyword": {
            "type": "string",
            "default": "分享",
            "sampler": Redbook.sample_feed_title_keyword,
            "description": "笔记标题关键词",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            str(n["id"])
            for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        liked_any = any(cid in rb.added_to_liked() for cid in candidates)
        return [{
            "field": "like_feed_note_by_keyword",
            "expected": candidates[0] if candidates else None,
            "actual": rb.liked_notes,
            "passed": liked_any,
        }]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            str(n["id"])
            for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        chosen = next((cid for cid in candidates if cid in rb.added_to_liked()), candidates[0] if candidates else "")
        return ["user.likedNotes", f"entities.notesById.{chosen}", "homeState.displayCount", "history"]


class CommentOnFeedNote(BaseTask):
    templates = [
        '在小红书推荐页给标题含"{keyword}"的笔记评论一句"{comment}"',
        '在小红书推荐页找到标题含"{keyword}"的那篇笔记，帮我评论"{comment}"',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["explore", "social", "create"]
    parameters = {
        "keyword": {
            "type": "string",
            "default": "分享",
            "sampler": Redbook.sample_feed_title_keyword,
            "description": "搜索关键词",
        },
        "comment": {
            "type": "string",
            "default": "这条内容很有参考价值",
            "description": "评论内容",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            str(n["id"])
            for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        passed = any(rb.note_has_comment(cid, self.p.comment) for cid in candidates)
        return [{
            "field": "comment_feed_note",
            "expected": self.p.comment,
            "actual": " | ".join(candidates),
            "passed": passed,
        }]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            str(n["id"])
            for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        chosen = next((cid for cid in candidates if rb.note_has_comment(cid, self.p.comment)), candidates[0] if candidates else "")
        return [
            f"entities.notesById.{chosen}",
            "user.commentList",
            "homeState.displayCount",
            "history",
        ]


class PublishNoteWithTitleAndContent(BaseTask):
    templates = [
        '发一篇小红书笔记，标题写"{title}"，正文写"{content}"',
        '帮我在小红书发布一条笔记，标题是"{title}"，内容是"{content}"',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["create"]
    parameters = {
        "title": {
            "type": "string",
            "default": "周末逛展记录",
            "description": "标题",
        },
        "content": {
            "type": "string",
            "default": "今天看了两个展，最喜欢第二个沉浸式空间，照片晚点整理。",
            "description": "正文",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        return [
            rb.check_note_published(
                title_pred=lambda title: title == self.p.title,
                content_pred=lambda content: self.p.content in content,
                new_only=True,
                field="publish_note",
            ),
        ]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        return [
            "entities.notesById",
            "feedIds",
            "user.publishedNoteIds",
            "publishDraft",
            "history",
        ]


class LikeFeedNoteAndReportLikes(BaseTask):
    templates = [
        '给小红书推荐页标题含"{keyword}"的笔记点赞，告诉我它一共多少赞',
        '在小红书推荐页找到标题里有"{keyword}"的笔记点个赞，再告诉我总点赞数',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["explore", "social", "query"]
    parameters = {
        "keyword": {
            "type": "string",
            "default": "分享",
            "sampler": Redbook.sample_feed_title_keyword,
            "description": "笔记标题关键词",
        },
    }
    answer_fields = [{"type": "number", "label": "点赞数"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            n for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        candidate_ids = [str(n["id"]) for n in candidates]
        liked_added = rb.added_to_liked()
        liked_ids = [cid for cid in candidate_ids if cid in liked_added]
        chosen = None
        for n in candidates:
            if str(n["id"]) in liked_ids:
                chosen = n
                break
        note_id = str((chosen or (candidates[0] if candidates else {})).get("id") or "")
        note_likes = (chosen or (candidates[0] if candidates else {})).get("likes") if candidates else None
        checks = [{
            "field": "like_feed_note_and_report_likes",
            "expected": note_id or (candidate_ids[0] if candidate_ids else None),
            "actual": rb.liked_notes,
            "passed": bool(liked_ids),
        }]
        if note_likes is not None:
            checks.extend(build_answer_checks(note_likes, input.answer))
        return checks

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            str(n["id"])
            for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        chosen = next((cid for cid in candidates if cid in rb.added_to_liked()), candidates[0] if candidates else "")
        return ["user.likedNotes", f"entities.notesById.{chosen}", "homeState.displayCount", "history"]


class CheckFollowingUserNoteCount(AnswerTask):
    templates = [
        '看看小红书我关注列表里的"{username}"发了多少篇笔记',
        '去我小红书关注的人里找"{username}"，告诉我 TA 发过几篇笔记',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["query"]
    expected_changes = ["history"]
    parameters = {
        "username": {
            "type": "string",
            "default": "西柚慢行",
            "sampler": Redbook.sample_followed_user_name_with_notes,
            "description": "关注列表用户名（笔记数 >= 3，避免任务退化）",
        },
    }
    answer_fields = [{"type": "number", "label": "笔记数"}]

    def get_answer(self, input: JudgeInput) -> int:
        return Redbook(input.apps_init["redbook"]).followed_user_note_count(self.p.username)


class CheckFirstChatLastMessage(AnswerTask):
    templates = [
        "帮我看下小红书最新的那条对话最后发的是什么",
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["query"]
    expected_changes = MESSAGE_VIEW_CHANGES
    answer_fields = [{"type": "text", "label": "最后一条消息内容", "hint": "如：谢谢"}]

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        redbook_state = state["apps"]["redbook"]
        if redbook_state["chats"]:
            return
        await env.set_state(
            {
                "apps": {
                    "redbook": {
                        "chats": Redbook.build_seed_chats(
                            redbook_state["entities"]["usersById"],
                            redbook_state["user"]["id"],
                            state["os"]["time"]["timestamp"],
                        )
                    }
                }
            },
            deep=True,
            reload=False,
        )

    def get_answer(self, input: JudgeInput) -> str:
        return Redbook(input.apps_init["redbook"]).first_chat_last_message()


# =============================================================================
# L4 — Deep-dive / hybrid social tasks
# =============================================================================


class CheckFirstCollectedAuthorField(AnswerTask):
    templates = [
        "去我小红书【收藏】列表里排在最前面的那篇笔记，告诉我作者的{field}",
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["nav", "query"]
    expected_changes = ["history"]
    parameters = {
        "field": {
            "type": "enum",
            "values": {
                "IP属地": "location",
                "粉丝数": "followers",
                "获赞与收藏": "likesAndCollections",
            },
            "default": "location",
            "description": "作者主页字段",
        },
    }
    _NUMERIC_AUTHOR_FIELDS = {"followers", "likesAndCollections"}

    @property
    def answer_fields(self):  # type: ignore[override]
        field_val = getattr(self.p, "field", None)
        label = "作者" + next((k for k, v in self.parameters["field"]["values"].items() if v == field_val), field_val or "")
        t = "number" if field_val in self._NUMERIC_AUTHOR_FIELDS else "text"
        return [{"type": t, "label": label}]

    def get_answer(self, input: JudgeInput) -> Any:
        return Redbook(input.apps_init["redbook"]).first_collected_author_field(self.p.field)


class SearchFirstNoteAuthorTopLikedTitle(AnswerTask):
    templates = [
        '在小红书搜"{keyword}"，看看第一篇笔记的作者获赞最多的笔记标题是什么',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "query", "reasoning"]
    parameters = {
        "keyword": {
            "type": "enum",
            "values": ["美食", "探店", "生活"],
            "default": "探店",
            "description": "搜索关键词",
        },
    }
    expected_changes = SEARCH_VIEW_CHANGES
    answer_fields = [{"type": "text", "label": "笔记标题"}]

    def get_answer(self, input: JudgeInput) -> str:
        rb = Redbook(input.apps_init["redbook"])
        note = rb.first_search_note(self.p.keyword)
        author_id = str(note["authorId"])
        author_notes = [
            item for item in rb.notes_by_id.values()
            if str(item["authorId"]) == author_id
        ]
        if not author_notes:
            raise RuntimeError(f"任务设计错误：作者 {author_id} 没有关联笔记")
        max_liked = max(author_notes, key=lambda item: rb.count_value(item["likes"]))
        return str(max_liked["title"])

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        # 与 crossapp_content（如 RedbookSearchTitleToWechat / RedbookFavoriteThenMoments）一致：
        # 用 norm 去掉标点/emoji 等噪声并统一大小写，再在用户答案的归一化串里做子串匹配。
        expected = str(self.get_answer(input) or "")
        actual = str(input.answer or "")
        title_norm = norm(expected)
        passed = bool(title_norm) and title_norm in norm(actual)
        return [{
            "field": "answer",
            "expected": expected,
            "actual": actual,
            "passed": passed,
        }]


class FollowAndCheckLocation(BaseTask):
    templates = [
        '在小红书关注"{username}"，顺便告诉我 TA 的 IP 属地',
        '在小红书搜索"{username}"并关注，看看 TA 在哪个城市',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "social", "query"]
    parameters = {
        "username": {
            "type": "string",
            "default": "安静岛",
            "sampler": Redbook.sample_unfollowed_user_name,
            "description": "待关注用户",
        },
    }
    answer_fields = [{"type": "text", "label": "IP属地", "hint": "如：浙江"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        user = rb.init.require_user_by_name(self.p.username)
        checks = [
            {
                "field": "follow_user",
                "expected": f"follow {self.p.username}",
                "actual": rb.followings,
                "passed": str(user["id"]) in rb.added_to_followings(),
            },
        ]
        checks.extend(build_answer_checks(str(user["location"]), input.answer))
        return checks

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        user_id = str(Redbook(input.apps_init["redbook"]).require_user_by_name(self.p.username)["id"])
        return [
            "user.followings",
            "user.following",
            f"entities.usersById.{user_id}",
            "searchHistory",
            "history",
        ]


class SearchCollectAndReportAuthor(BaseTask):
    templates = [
        '搜索"{keyword}"，收藏第一篇笔记，告诉我作者有多少粉丝和获赞',
        '在小红书搜"{keyword}"后收藏排最前面的笔记，然后看看作者的粉丝数和获赞数',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "social", "query"]
    parameters = {
        "keyword": {
            "type": "enum",
            "values": REDBOOK_COLLECTIBLE_KEYWORDS,
            "default": "读书",
            "description": "搜索关键词",
        },
    }
    answer_fields = [
        {"type": "number", "label": "粉丝数"},
        {"type": "number", "label": "获赞与收藏"},
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        note = rb.init.first_search_note(self.p.keyword)
        note_id = str(note["id"])
        author = rb.init.note_author(note)
        checks = [
            {
                "field": "collect_note",
                "expected": f"collect note {note_id}",
                "actual": rb.collected_notes,
                "passed": note_id in rb.added_to_collected(),
            },
        ]
        checks.extend(build_answer_checks(
            {
                "followers": author["followers"],
                "likes": author["likesAndCollections"],
            },
            input.answer,
        ))
        return checks

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        note_id = str(Redbook(input.apps_init["redbook"]).first_search_note(self.p.keyword)["id"])
        return [
            "user.collectedNotes",
            f"entities.notesById.{note_id}",
            "searchHistory",
            "history",
        ]


class CollectFeedNoteAndDMAuthor(BaseTask):
    templates = [
        '收藏推荐页标题含"{keyword}"的笔记，给作者发一句"{message}"',
        '在推荐页找到标题里有"{keyword}"的笔记，收藏后私信作者"{message}"',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["explore", "social", "create"]
    parameters = {
        "keyword": {
            "type": "string",
            "default": "分享",
            "sampler": Redbook.sample_feed_title_keyword,
            "description": "笔记标题关键词",
        },
        "message": {
            "type": "string",
            "default": "这篇内容很有启发，谢谢分享",
            "description": "私信内容",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            n for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        candidate_ids = [str(n["id"]) for n in candidates]
        collected_added = rb.added_to_collected()
        collected_ids = [cid for cid in candidate_ids if cid in collected_added]
        # Pass if any collected candidate also has a DM to its author
        passed = False
        chosen_note_id = collected_ids[0] if collected_ids else (candidate_ids[0] if candidate_ids else "")
        for n in candidates:
            nid = str(n["id"])
            if nid not in collected_added:
                continue
            author_id = str(rb.note_author(n).get("id"))
            if author_id and rb.chat_has_message(author_id, self.p.message):
                passed = True
                chosen_note_id = nid
                break
        return [
            {
                "field": "collect_feed_note",
                "expected": chosen_note_id or None,
                "actual": rb.collected_notes,
                "passed": bool(collected_ids),
            },
            {
                "field": "dm_author",
                "expected": self.p.message,
                "actual": " | ".join(collected_ids),
                "passed": passed,
            },
        ]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            str(n["id"])
            for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        chosen = next((cid for cid in candidates if cid in rb.added_to_collected()), candidates[0] if candidates else "")
        return [
            "user.collectedNotes",
            f"entities.notesById.{chosen}",
            "chats",
            "homeState.displayCount",
            "history",
        ]


class PublishAndShareToFollowing(BaseTask):
    templates = [
        '在小红书发一篇标题叫"{title}"的笔记，然后把这个标题私信给"{username}"',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["create", "social"]
    parameters = {
        "title": {
            "type": "string",
            "default": "春日散步计划",
            "description": "新笔记标题",
        },
        "username": {
            "type": "string",
            "default": "海边小橘子",
            "sampler": Redbook.sample_followed_user_name,
            "description": "消息接收人",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        target_user = rb.init.require_user_by_name(self.p.username)
        draft = rb.get("publishDraft", {}) or {}
        draft_title = str(draft.get("title") or "")
        title_action_ok = draft_title.strip() == str(self.p.title)
        return [
            rb.check_note_published(
                title_pred=lambda title: title == self.p.title,
                field="publish_note",
            ),
            {
                "field": "publish_title_entered",
                "expected": self.p.title,
                "actual": draft_title,
                "passed": title_action_ok,
            },
            {
                "field": "share_title_to_following",
                "expected": self.p.title,
                "actual": rb.get_chat(str(target_user["id"])),
                "passed": rb.chat_has_message(str(target_user["id"]), self.p.title),
            },
        ]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        return [
            "entities.notesById",
            "feedIds",
            "user.publishedNoteIds",
            "publishDraft",
            "chats",
            "history",
        ]


class ReplyToFeedNoteFirstComment(BaseTask):
    templates = [
        '在小红书推荐页找标题含"{keyword}"的笔记，回复第一条评论"{reply}"',
        '在小红书推荐页找到标题里有"{keyword}"的笔记，给第一条评论回复"{reply}"',
    ]
    apps = ["redbook"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["explore", "social", "create"]
    parameters = {
        "keyword": {
            "type": "string",
            "default": "分享",
            "sampler": Redbook.sample_replyable_feed_title_keyword,
            "description": "笔记标题关键词",
        },
        "reply": {
            "type": "string",
            "default": "这个回复我也很认同",
            "description": "回复内容",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            n for n in rb.visible_discover_replyable_notes("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        # Pass if any candidate has the reply (any root comment id for that note)
        passed = False
        for n in candidates:
            note_id = str(n["id"])
            try:
                first_root = rb.init.first_root_comment(note_id)
            except Exception:
                continue
            if rb.note_has_reply(note_id, self.p.reply, first_root["id"]):
                passed = True
                break
        return [{
            "field": "reply_first_feed_comment",
            "expected": self.p.reply,
            "actual": "candidates=" + " | ".join(str(n["id"]) for n in candidates),
            "passed": passed,
        }]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        kw = str(self.p.keyword or "")
        candidates = [
            n for n in rb.visible_discover_replyable_notes("recommend", limit=40)
            if kw and kw in str(n.get("title") or "")
        ]
        chosen_note_id = ""
        for n in candidates:
            note_id = str(n["id"])
            try:
                first_root = rb.init.first_root_comment(note_id)
            except Exception:
                continue
            if rb.note_has_reply(note_id, self.p.reply, first_root["id"]):
                chosen_note_id = note_id
                break
        if not chosen_note_id and candidates:
            chosen_note_id = str(candidates[0]["id"])
        return [
            f"entities.notesById.{chosen_note_id}",
            "user.commentList",
            "homeState.displayCount",
            "history",
        ]
