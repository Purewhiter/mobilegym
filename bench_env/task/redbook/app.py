"""
Redbook (小红书) state accessor.

Provides convenient access to Redbook app state with comparison utilities.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Sequence

from bench_env.task.base import BaseApp
from bench_env.task.utils import norm


_DEFAULTS_PATH = Path(__file__).resolve().parents[3] / "apps" / "RedBook" / "data" / "defaults.json"
_DEFAULTS = json.loads(_DEFAULTS_PATH.read_text(encoding="utf-8"))

# HomePage category key → Chinese label mapping.
# Aligned with apps/RedBook/res/strings.ts — update here when categories change.
_CATEGORY_LABELS: dict[str, str] = {
    "recommend": "推荐",
    "video": "视频",
    "live": "直播",
    "short_drama": "短剧",
    "avatar": "头像",
    "fashion": "穿搭",
    "wallpaper": "壁纸",
    "food": "美食",
    "emotions": "情感",
    "music": "音乐",
    "nails": "美甲",
    "funny": "搞笑",
    "crafts": "手工",
    "travel": "旅行",
    "makeup": "彩妆",
    "hairstyle": "发型",
    "dance": "舞蹈",
    "drawing": "绘画",
    "reading": "读书",
    "home_decor": "家装",
    "celebrity": "明星",
    "movies_and_tv": "影视",
    "games": "游戏",
    "photography": "摄影",
    "anime": "动漫",
    "home_2": "家居",
    "cars": "汽车",
    "weight_loss": "减脂",
    "study": "学习",
    "skincare": "护肤",
    "wedding": "婚礼",
    "stationery": "文具",
    "sneakers": "潮鞋",
    "career": "职场",
    "culture": "文化",
    "pets": "萌宠",
    "tech": "科技",
    "fitness": "健身",
    "variety_shows": "综艺",
    "bags": "箱包",
    "science": "科学",
    "baby": "母婴",
    "homepage_art": "艺术",
    "psychology": "心理",
    "motorcycle": "机车",
    "campus": "校园",
    "sports": "体育",
    "outdoor": "户外",
    "figures": "潮玩",
    "camping": "露营",
    "social_science": "社科",
    "humanities": "人文",
}


REDBOOK_GENERAL_SETTING_VALUES = {
    "使用移动流量下载": "mobileDownload",
    "视频HDR效果": "videoHDR",
    "使用移动网络改善浏览体验": "mobileNetwork",
    "视频和直播默认静音": "muteVideo",
    "默认播放图文笔记声音": "playAudio",
}

REDBOOK_NOTIFICATION_SETTING_VALUES = {
    "赞和收藏": "likeCollect",
    "评论": "comment",
    "新增关注": "newFollow",
    "@我": "atMe",
    "购物及售后": "storeNotif",
}

REDBOOK_PRIVACY_SETTING_VALUES = {
    "一键防护": "oneClickProtect",
    "展示聊天标识": "showChatStatus",
    "只允许关注的人评论": "onlyFollowComment",
    "允许下载全部笔记": "allowDownload",
    "给我推荐可能认识的人": "recommendPeople",
}

REDBOOK_ONLINE_STATUS_VALUES = {
    "公开": "public",
    "好友": "friends",
    "关闭": "closed",
}

REDBOOK_LANGUAGE_VALUES = {
    "简体中文": "zh-CN",
    "英文": "en-US",
}

REDBOOK_SEARCH_SORT_VALUES = {
    "最新": "latest",
    "最多点赞": "likes",
    "最多评论": "comments",
    "最多收藏": "collects",
}

REDBOOK_SEARCH_KEYWORDS = [
    "OOTD",
    "护肤",
    "美食",
    "探店",
    "旅行",
    "教程",
    "读书",
]

REDBOOK_COLLECTIBLE_KEYWORDS = [
    "护肤",
    "教程",
    "读书",
    "家居",
]

REDBOOK_FEED_NOTE_KEYWORDS = [
    "博士生",
    "动物",
    "生日",
    "分享",
]

REDBOOK_REPLYABLE_FEED_NOTE_KEYWORDS = [
    "博士生",
    "动物",
    "生日",
    "分享",
]

REDBOOK_KEYWORD_PARAM = {
    "type": "enum",
    "values": ["数分", "美食", "探店", "分享"],
    "default": "数分",
}

REDBOOK_FOLLOWING_USER_PARAM = {
    "type": "enum",
    "values": ["西柚慢行", "安静岛"],
    "default": "西柚慢行",
}

REDBOOK_PUBLISH_CHANGES = [
    "redbook.user",
    "redbook.entities",
    "redbook.feedIds",
    "redbook.publishDraft",
]


def _parse_count(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).replace("+", "").strip()
    if not raw:
        return 0.0
    if "万" in raw:
        return (float(raw.replace("万", "")) if raw.replace("万", "") else 0.0) * 10000
    if raw.lower().endswith("w"):
        num = raw[:-1]
        return (float(num) if num else 0.0) * 10000
    try:
        return float(raw)
    except ValueError:
        return 0.0


class Redbook(BaseApp):
    """
    Redbook state accessor.
    
    Usage:
        rb = Redbook(input.apps["redbook"])
        rb.user_id
        rb.liked_notes
        
        # With init state for comparison
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        rb.removed_from_liked()
    """
    
    # =========================================================================
    # User properties
    # =========================================================================
    
    @property
    def user(self) -> dict[str, Any]:
        """Current user object."""
        return self.get("user", {})
    
    @property
    def user_id(self) -> str:
        return self.user.get("id", "")
    
    @property
    def user_name(self) -> str:
        return self.user.get("name", "")
    
    # =========================================================================
    # User interaction lists
    # =========================================================================
    
    @property
    def liked_notes(self) -> list[str]:
        """Note IDs the user has liked."""
        return self.user.get("likedNotes", [])
    
    @property
    def collected_notes(self) -> list[str]:
        """Note IDs the user has collected."""
        return self.user.get("collectedNotes", [])
    
    @property
    def followings(self) -> list[str]:
        """User IDs the user is following."""
        return self.user.get("followings", [])
    
    @property
    def published_notes(self) -> list[str]:
        """Note IDs the user has published."""
        return self.user.get("publishedNoteIds", [])

    @property
    def first_liked_note_id(self) -> str | None:
        liked = set(self.liked_notes)
        for note_id in self.feed_ids:
            if note_id in liked:
                return note_id
        return None

    @property
    def first_collected_note_id(self) -> str | None:
        collected = set(self.collected_notes)
        for note_id in self.feed_ids:
            if note_id in collected:
                return note_id
        return None
    
    # =========================================================================
    # Entity accessors
    # =========================================================================
    
    @property
    def entities(self) -> dict[str, Any]:
        """Entities container."""
        return self.get("entities", {})
    
    @property
    def notes_by_id(self) -> dict[str, dict]:
        """All notes by ID."""
        return self.entities.get("notesById", {})
    
    @property
    def users_by_id(self) -> dict[str, dict]:
        """All users by ID."""
        return self.entities.get("usersById", {})
    
    @property
    def feed_ids(self) -> list[str]:
        """Feed note IDs."""
        return self.get_list("feedIds")
    
    @property
    def chats(self) -> list[dict]:
        """Chat list."""
        return self.get_list("chats")

    @property
    def hot_search(self) -> list[dict[str, Any]]:
        """Search landing hot-search list from static config."""
        return list(_DEFAULTS.get("hotSearch", []) or [])
    
    # =========================================================================
    # Settings
    # =========================================================================
    
    @property
    def settings(self) -> dict[str, Any]:
        return self.get("settings", {})
    
    @property
    def general_settings(self) -> dict[str, Any]:
        return self.settings.get("general", {})

    def count_value(self, value: Any) -> float:
        return _parse_count(value)

    def require_note(self, note_id: str) -> dict[str, Any]:
        note = self.get_note(note_id)
        if note is None:
            raise ValueError(f"Note '{note_id}' not found in state")
        return note

    def first_feed_note(self) -> dict[str, Any]:
        if not self.feed_ids:
            raise ValueError("Feed is empty")
        return self.require_note(self.feed_ids[0])

    def first_feed_note_with_title_keyword(self, keyword: str) -> dict[str, Any]:
        for note_id in self.feed_ids:
            note = self.require_note(note_id)
            if str(keyword) in str(note["title"]):
                return note
        raise ValueError(f"No feed note with title containing '{keyword}'")

    def first_search_note(self, keyword: str) -> dict[str, Any]:
        note = self.find_note_by_keyword(keyword)
        if note is None:
            raise ValueError(f"No search result note for keyword '{keyword}'")
        return note

    def require_user_entity(self, user_id: str) -> dict[str, Any]:
        user = self.get_user_entity(user_id)
        if user is None and str(self.user.get("id") or "") == str(user_id):
            user = self.user
        if user is None:
            raise ValueError(f"User '{user_id}' not found in state")
        return user

    def require_user_by_name(self, name: str) -> dict[str, Any]:
        user = self.find_user_by_name(name)
        if user is None:
            raise ValueError(f"User '{name}' not found in state")
        return user

    def note_author(self, note: dict[str, Any]) -> dict[str, Any]:
        return self.require_user_entity(str(note["authorId"]))

    def note_field(self, note: dict[str, Any], field: str) -> Any:
        if field == "authorName":
            return self.note_author(note)["name"]
        return note[field]

    def search_note_field(self, keyword: str, field: str) -> Any:
        return self.note_field(self.first_search_note(keyword), field)

    def user_field_by_name(self, username: str, field: str) -> Any:
        return self.require_user_by_name(username)[field]

    def first_collected_note(self) -> dict[str, Any]:
        collected_id = self.first_collected_note_id
        if collected_id is None:
            raise ValueError("Collected notes list is empty")
        return self.require_note(collected_id)

    def first_collected_author_field(self, field: str) -> Any:
        return self.note_author(self.first_collected_note())[field]

    def user_note_count(self, user_id: str) -> int:
        return sum(1 for note in self.notes_by_id.values() if str(note["authorId"]) == str(user_id))

    def followed_user_note_count(self, username: str) -> int:
        return self.user_note_count(self.require_user_by_name(username)["id"])

    def user_notes(self, user_id: str) -> list[dict[str, Any]]:
        """指定用户发布的所有笔记（按 feedIds 顺序稳定返回）。"""
        target_id = str(user_id or "")
        seen: set[str] = set()
        notes: list[dict[str, Any]] = []
        # feedIds 顺序稳定，与 UI 主页笔记展示顺序一致
        for note_id in self.feed_ids:
            note = self.notes_by_id.get(note_id)
            if note is None:
                continue
            if str(note.get("authorId") or "") != target_id:
                continue
            seen.add(str(note.get("id") or ""))
            notes.append(note)
        # feedIds 以外的 notesById（例如 loader 根据 commentList 补入的）也一并返回
        for note_id, note in self.notes_by_id.items():
            if str(note.get("authorId") or "") != target_id:
                continue
            if str(note_id) in seen:
                continue
            notes.append(note)
        return notes

    def user_notes_by_name(self, username: str) -> list[dict[str, Any]]:
        return self.user_notes(self.require_user_by_name(username)["id"])

    def _sort_notes_by_metric(
        self,
        notes: list[dict[str, Any]],
        metric: str,
        *,
        ascending: bool,
    ) -> list[dict[str, Any]]:
        if metric == "likes":
            key = lambda n: _parse_count(n.get("likes"))
        elif metric in ("collections", "collects"):
            key = lambda n: _parse_count(n.get("collections"))
        elif metric == "comments":
            key = lambda n: _parse_count(n.get("comments"))
        else:
            raise ValueError(f"Unsupported metric: {metric!r}")
        ordered = sorted(notes, key=key, reverse=not ascending)
        return ordered

    def search_top_notes_by_likes(
        self, keyword: str, *, top_n: int = 2
    ) -> list[dict[str, Any]]:
        """搜索结果前若干篇按点赞数降序排序并截取前 top_n；候选不足时抛错以暴露数据设计问题。"""
        if int(top_n) <= 0:
            return []
        prefix = self.search_notes(keyword)[: max(int(top_n), 10)]
        ordered = self._sort_notes_by_metric(prefix, "likes", ascending=False)
        if len(ordered) < int(top_n):
            raise ValueError(
                f"Redbook search for {keyword!r} yielded only {len(ordered)} results; "
                f"expected ≥ {top_n}"
            )
        return ordered[: int(top_n)]

    def most_liked_search_note(self, keyword: str) -> dict[str, Any]:
        """搜索结果前 10 篇里点赞最多的一篇。"""
        top = self.search_top_notes_by_likes(keyword, top_n=1)
        if not top:
            raise ValueError(f"No search result for keyword '{keyword}'")
        return top[0]

    def user_max_liked_note(self, username: str) -> dict[str, Any]:
        notes = self.user_notes_by_name(username)
        if not notes:
            raise ValueError(f"User '{username}' has no notes")
        return self._sort_notes_by_metric(notes, "likes", ascending=False)[0]

    def user_min_collected_note(self, username: str) -> dict[str, Any]:
        notes = self.user_notes_by_name(username)
        if not notes:
            raise ValueError(f"User '{username}' has no notes")
        return self._sort_notes_by_metric(notes, "collections", ascending=True)[0]

    def user_max_collected_note(self, username: str) -> dict[str, Any]:
        notes = self.user_notes_by_name(username)
        if not notes:
            raise ValueError(f"User '{username}' has no notes")
        return self._sort_notes_by_metric(notes, "collections", ascending=False)[0]

    def user_best_worst_notes(self, username: str) -> tuple[dict[str, Any], dict[str, Any]]:
        """返回用户 (max-likes 笔记, min-collections 笔记)，且保证两者是不同笔记。"""
        top_liked = self.user_max_liked_note(username)
        min_collected = self.user_min_collected_note(username)
        if str(top_liked["id"]) == str(min_collected["id"]):
            raise ValueError(
                f"User {username!r} max-liked note == min-collected note; "
                "choose a different author for this task"
            )
        return top_liked, min_collected

    def first_root_comment(self, note_id: str) -> dict[str, Any]:
        note = self.require_note(note_id)
        for comment in note.get("commentList", []):
            if not comment.get("replyToId"):
                return comment
        raise ValueError(f"Note '{note_id}' has no root comment")

    def first_chat(self) -> dict[str, Any]:
        if not self.chats:
            raise ValueError("Chat list is empty")
        return self.chats[0]

    def first_chat_last_message(self) -> str:
        chat = self.first_chat()
        messages = chat.get("messages", [])
        if not messages:
            raise ValueError(f"Chat '{chat.get('userId')}' has no messages")
        return str(messages[-1]["content"])

    @staticmethod
    def build_seed_chats(
        users_by_id: dict[str, dict[str, Any]],
        current_user_id: str,
        now_ts: int,
    ) -> list[dict[str, Any]]:
        followings = list((_DEFAULTS.get("user") or {}).get("followings") or [])
        candidates: list[str] = [
            str(uid) for uid in followings
            if str(uid) in users_by_id and str(uid) != str(current_user_id)
        ]
        if len(candidates) < 2:
            for uid in users_by_id.keys():
                if str(uid) == str(current_user_id):
                    continue
                if str(uid) not in candidates:
                    candidates.append(str(uid))
                if len(candidates) >= 2:
                    break
        if len(candidates) < 2:
            return []

        first_user = users_by_id[candidates[0]]
        second_user = users_by_id[candidates[1]]
        return [
            {
                "userId": first_user["id"],
                "username": first_user["name"],
                "avatar": first_user["avatar"],
                "lastMessage": "周末要不要一起去逛逛？",
                "lastTime": now_ts - 60_000,
                "unreadCount": 1,
                "messages": [
                    {
                        "id": f"seed_chat_{first_user['id']}_1",
                        "senderId": first_user["id"],
                        "content": "你最近那篇笔记写得挺真实的",
                        "timestamp": now_ts - 180_000,
                        "type": "text",
                    },
                    {
                        "id": f"seed_chat_{first_user['id']}_2",
                        "senderId": current_user_id,
                        "content": "谢谢呀，下次也给你分享清单",
                        "timestamp": now_ts - 120_000,
                        "type": "text",
                    },
                    {
                        "id": f"seed_chat_{first_user['id']}_3",
                        "senderId": first_user["id"],
                        "content": "周末要不要一起去逛逛？",
                        "timestamp": now_ts - 60_000,
                        "type": "text",
                    },
                ],
            },
            {
                "userId": second_user["id"],
                "username": second_user["name"],
                "avatar": second_user["avatar"],
                "lastMessage": "我把清单发你啦",
                "lastTime": now_ts - 3_600_000,
                "unreadCount": 0,
                "messages": [
                    {
                        "id": f"seed_chat_{second_user['id']}_1",
                        "senderId": second_user["id"],
                        "content": "我把清单发你啦",
                        "timestamp": now_ts - 3_600_000,
                        "type": "text",
                    },
                ],
            },
        ]
    
    # =========================================================================
    # Note operations
    # =========================================================================
    
    def get_note(self, note_id: str) -> dict | None:
        """Get note by ID."""
        return self.notes_by_id.get(note_id)

    def search_notes(self, keyword: str) -> list[dict[str, Any]]:
        """Search notes in the same order as the app search result page."""
        k = str(keyword or "").lower().strip()
        if not k:
            return []
        results: list[dict[str, Any]] = []
        for note_id in self.feed_ids:
            note = self.get_note(note_id)
            if not note:
                continue
            title = str(note.get("title") or "").lower()
            content = str(note.get("content") or "").lower()
            category = str(note.get("category") or "").lower()
            if k in title or k in content or k in category:
                results.append(note)
        return results

    def sorted_search_notes(self, keyword: str, sort: str = "comprehensive") -> list[dict[str, Any]]:
        """Return notes ordered like the search result page."""
        notes = list(self.search_notes(keyword))
        if sort == "latest":
            notes.sort(key=lambda item: float(item.get("createdAt") or 0), reverse=True)
        elif sort == "likes":
            notes.sort(key=lambda item: _parse_count(item.get("likes")), reverse=True)
        elif sort == "comments":
            notes.sort(key=lambda item: _parse_count(item.get("comments")), reverse=True)
        elif sort == "collects":
            notes.sort(key=lambda item: _parse_count(item.get("collections")), reverse=True)
        return notes

    def find_note_by_keyword(self, keyword: str) -> dict | None:
        """Backward-compatible helper: first search result under default ordering."""
        notes = self.search_notes(keyword)
        return notes[0] if notes else None

    def find_note_by_keyword_sorted(self, keyword: str, sort: str) -> dict | None:
        notes = self.sorted_search_notes(keyword, sort)
        return notes[0] if notes else None
    
    def note_has_comment(self, note_id: str, content: str, user_id: str | None = None) -> bool:
        """
        Check if note has a specific comment.
        
        Args:
            note_id: Note ID
            content: Comment content to find
            user_id: Optional user ID (defaults to current user)
            
        Returns:
            True if comment exists
        """
        note = self.get_note(note_id)
        if not note:
            return False
        
        uid = user_id or self.user_id
        comments = note.get("commentList", [])
        
        return any(
            c.get("userId") == uid and c.get("content") == content
            for c in comments
        )
    
    def note_has_reply(
        self, note_id: str, content: str, reply_to_id: str, user_id: str | None = None
    ) -> bool:
        """
        Check if note has a specific reply comment.
        
        Args:
            note_id: Note ID
            content: Reply content
            reply_to_id: ID of comment being replied to
            user_id: Optional user ID
            
        Returns:
            True if reply exists
        """
        note = self.get_note(note_id)
        if not note:
            return False
        
        uid = user_id or self.user_id
        comments = note.get("commentList", [])
        
        return any(
            c.get("userId") == uid
            and c.get("content") == content
            and c.get("replyToId") == reply_to_id
            for c in comments
        )
    
    # =========================================================================
    # User operations
    # =========================================================================
    
    def get_user_entity(self, user_id: str) -> dict | None:
        """Get user by ID."""
        return self.users_by_id.get(user_id)
    
    def find_user_by_name(self, name: str) -> dict | None:
        """
        Find user by name (partial match, case insensitive).
        
        Args:
            name: Search name
            
        Returns:
            User dict or None
        """
        name_lower = name.lower()
        for uid in self.get_list("userIds"):
            user = self.users_by_id.get(uid, {})
            if name_lower in (user.get("name") or "").lower():
                return user
        return None
    
    def is_following(self, user_id: str) -> bool:
        """Check if current user follows given user."""
        return user_id in self.followings

    @staticmethod
    def sample_followed_user_name(env_state: dict[str, Any], rng: Any) -> str:
        rb = Redbook(env_state["apps"]["redbook"])
        preferred: list[str] = []
        fallback: list[str] = []
        for uid in rb.followings:
            if uid not in rb.users_by_id:
                continue
            user = rb.users_by_id[uid]
            name = user.get("name")
            if not name:
                continue
            fallback.append(name)
            loc = str(user.get("location") or "").strip()
            if loc and loc != "未知":
                preferred.append(name)
        names = preferred or fallback
        if not names:
            raise ValueError("No followed users found in redbook state")
        return rng.choice(names)

    @staticmethod
    def sample_followed_user_name_with_notes(env_state: dict[str, Any], rng: Any) -> str:
        """专给 CheckFollowingUserNoteCount 用：要求笔记数 >= 5，避免抽到 0/1 篇用户让任务退化为微不足道。"""
        MIN_NOTES = 5
        rb = Redbook(env_state["apps"]["redbook"])
        candidates: list[str] = []
        for uid in rb.followings:
            if uid not in rb.users_by_id:
                continue
            user = rb.users_by_id[uid]
            name = user.get("name")
            if not name:
                continue
            if rb.user_note_count(uid) < MIN_NOTES:
                continue
            candidates.append(name)
        if not candidates:
            raise ValueError(
                f"No followed users with >= {MIN_NOTES} notes (followings notes 太少, "
                "无法采样有意义的'数笔记'任务)"
            )
        return rng.choice(candidates)

    @staticmethod
    def sample_unfollowed_user_name(env_state: dict[str, Any], rng: Any) -> str:
        rb = Redbook(env_state["apps"]["redbook"])
        followed = set(rb.followings)
        preferred: list[str] = []
        fallback: list[str] = []
        for uid, user in rb.users_by_id.items():
            if uid in followed or uid == rb.user_id:
                continue
            name = user.get("name")
            if not name:
                continue
            fallback.append(name)
            loc = str(user.get("location") or "").strip()
            if loc and loc != "未知":
                preferred.append(name)
        names = preferred or fallback
        if not names:
            raise ValueError("No unfollowed users found in redbook state")
        return rng.choice(names)

    @staticmethod
    def sample_user_name(env_state: dict[str, Any], rng: Any) -> str:
        rb = Redbook(env_state["apps"]["redbook"])
        # Prefer users with non-zero likesAndCollections, so tasks like
        # "看看TA的获赞与收藏" don't default to an always-zero user.
        preferred: list[str] = []
        fallback: list[str] = []
        for uid, user in rb.users_by_id.items():
            if uid == rb.user_id:
                continue
            name = user.get("name")
            if not name:
                continue
            fallback.append(name)
            try:
                val = rb.count_value(user.get("likesAndCollections") or 0)
            except Exception:
                val = 0
            loc = str(user.get("location") or "").strip()
            # Prefer users that have both non-zero likesAndCollections and a valid location.
            if val > 0 and loc and loc != "未知":
                preferred.append(name)
        # Fallback order: non-zero likesAndCollections (even if location unknown) -> any user
        if not preferred:
            nonzero = []
            for uid, user in rb.users_by_id.items():
                if uid == rb.user_id:
                    continue
                name = user.get("name")
                if not name:
                    continue
                try:
                    val = rb.count_value(user.get("likesAndCollections") or 0)
                except Exception:
                    val = 0
                if val > 0:
                    nonzero.append(name)
            names = nonzero or fallback
        else:
            names = preferred
        if not names:
            raise ValueError("No users found in redbook state")
        return rng.choice(names)

    @staticmethod
    def _sample_keyword_from_title(title: str, rng: Any) -> str:
        raw = str(title or "").strip()
        if not raw:
            return ""
        # Split by common separators, prefer meaningful chunks.
        parts = [p.strip() for p in re.split(r"[｜|丨·•…—\\-–:：,，。.!！?？\\s]+", raw) if p.strip()]
        if parts:
            # Avoid returning a single very short punctuation-like chunk.
            cand = [p for p in parts if len(p) >= 2] or parts
            pick = rng.choice(cand)
            # Clamp overly long chunks for "包含关键字" tasks.
            return pick[:6]
        return raw[:4]

    @staticmethod
    def sample_feed_title_keyword(env_state: dict[str, Any], rng: Any) -> str:
        """Sample a keyword that appears in visible HomePage 'discover' feed titles."""
        rb = Redbook(env_state["apps"]["redbook"])
        titles = [
            str(n.get("title") or "").strip()
            for n in rb.visible_discover_notes_for_category("recommend", limit=40)
        ]
        titles = [t for t in titles if t]
        if not titles:
            raise ValueError("No feed note titles found in redbook state")
        for _ in range(10):
            kw = Redbook._sample_keyword_from_title(rng.choice(titles), rng)
            if kw:
                return kw
        return titles[0][:4]

    @staticmethod
    def sample_replyable_feed_title_keyword(env_state: dict[str, Any], rng: Any) -> str:
        """Sample a keyword from a visible discover note title that has a root comment."""
        rb = Redbook(env_state["apps"]["redbook"])
        titles = [
            str(n.get("title") or "").strip()
            for n in rb.visible_discover_replyable_notes("recommend", limit=40)
        ]
        if not titles:
            # Fall back to any feed title; task may still be solvable if comments exist elsewhere.
            return Redbook.sample_feed_title_keyword(env_state, rng)
        for _ in range(10):
            kw = Redbook._sample_keyword_from_title(rng.choice(titles), rng)
            if kw:
                return kw
        return titles[0][:4]

    def has_liked(self, note_id: str) -> bool:
        """Check if current user has liked given note."""
        return note_id in self.liked_notes
    
    def has_collected(self, note_id: str) -> bool:
        """Check if current user has collected given note."""
        return note_id in self.collected_notes

    # =========================================================================
    # Home (Discover) visibility helpers — mirror apps/RedBook/pages/HomePage.tsx
    # =========================================================================

    def visible_discover_notes_for_category(self, category_key: str, limit: int = 40) -> list[dict[str, Any]]:
        """Notes visible in HomePage 'discover' tab for a given category key."""
        home_state = self.get("homeState", {}) or {}
        display_count = int(home_state.get("displayCount") or 20)
        label = _CATEGORY_LABELS.get(str(category_key or ""))
        if not label:
            return []

        out: list[dict[str, Any]] = []
        for note_id in self.feed_ids:
            note = self.notes_by_id.get(note_id)
            if not note:
                continue
            if str(note.get("category") or "") != str(label):
                continue
            out.append(note)
            if len(out) >= min(limit, max(display_count, 1)):
                break
        return out

    def visible_discover_replyable_notes(self, category: str = "recommend", limit: int = 40) -> list[dict[str, Any]]:
        """Visible discover notes that have at least one root comment."""
        notes = self.visible_discover_notes_for_category(category, limit=limit)
        out: list[dict[str, Any]] = []
        for note in notes:
            comments = note.get("commentList") or []
            if not comments:
                continue
            if any(not c.get("replyToId") for c in comments):
                out.append(note)
        return out
    
    # =========================================================================
    # Chat operations
    # =========================================================================
    
    def get_chat(self, user_id: str) -> dict | None:
        """Get chat with specific user."""
        for chat in self.chats:
            if chat.get("userId") == user_id:
                return chat
        return None
    
    def chat_has_message(self, target_user_id: str, content: str) -> bool:
        """
        Check if chat contains a message with given content from current user.
        
        Args:
            target_user_id: Chat target user ID
            content: Message content
            
        Returns:
            True if message exists
        """
        chat = self.get_chat(target_user_id)
        if not chat:
            return False
        
        return any(
            m.get("senderId") == self.user_id and m.get("content") == content
            for m in chat.get("messages", [])
        )

    def check_chat_sent_to(
        self,
        username: str,
        *keywords: str,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证是否给指定用户发了包含所有关键词的私信。"""
        if field is None:
            field = f"dm_to_{username}"
        user = self.require_user_by_name(username)
        chat = self.get_chat(str(user["id"]))
        actual = ""
        if chat is not None:
            for message in reversed(chat.get("messages", [])):
                if str(message.get("senderId") or "") != self.user_id:
                    continue
                actual = str(message.get("content") or "")
                break
        passed = bool(actual) and all(keyword in actual for keyword in keywords)
        return {
            "field": field,
            "expected": f"dm to '{username}' with {list(keywords)}",
            "actual": actual or "(none)",
            "passed": passed,
        }
    
    # =========================================================================
    # Comparison helpers (require init state)
    # =========================================================================
    
    def added_to_liked(self) -> set[str]:
        """Notes liked since init."""
        return self.list_added("user.likedNotes")
    
    def removed_from_liked(self) -> set[str]:
        """Notes unliked since init."""
        return self.list_removed("user.likedNotes")
    
    def added_to_collected(self) -> set[str]:
        """Notes collected since init."""
        return self.list_added("user.collectedNotes")
    
    def removed_from_collected(self) -> set[str]:
        """Notes uncollected since init."""
        return self.list_removed("user.collectedNotes")
    
    def added_to_followings(self) -> set[str]:
        """Users followed since init."""
        return self.list_added("user.followings")
    
    def removed_from_followings(self) -> set[str]:
        """Users unfollowed since init."""
        return self.list_removed("user.followings")

    def check_note_collected(
        self,
        note_id: str,
        *,
        field: str = "collected",
    ) -> dict[str, Any]:
        """验证指定笔记在本次任务中被新收藏（init 未收藏 → current 已收藏，CRUD "增"用 diff）。

        调用方必须提供 init（`Redbook(state, init=...)`）；否则无法区分"Agent 新增"
        与"原本就存在"，与 CRUD 约束冲突。
        """
        if not self.has_init:
            raise ValueError(
                "Redbook.check_note_collected requires an init state — Create/Delete "
                "judgments must be done via diff (see JUDGE_DESIGN_PRINCIPLES §Create)"
            )
        note_id_str = str(note_id)
        assert not self.init.has_collected(note_id_str), (
            f"Upstream bug: note {note_id_str} already collected in init"
        )
        added = self.added_to_collected()
        passed = note_id_str in added
        return {
            "field": field,
            "expected": f"note {note_id_str} newly collected",
            "actual": sorted(added) if added else "(no new collected notes)",
            "passed": passed,
        }

    def has_new_published_note_contains(
        self, expected_substring: str
    ) -> tuple[bool, str]:
        expected_substring = str(expected_substring or "")
        for title, body, _actual in self._iter_publish_targets(
            new_only=True,
            allow_draft=True,
        ):
            in_body = expected_substring != "" and expected_substring in body
            in_title = expected_substring != "" and expected_substring in title
            if in_body or (in_title and body.strip() == ""):
                return True, (body if body.strip() != "" else title)
        draft = self.get("publishDraft", {}) or {}
        draft_text = str(draft.get("text") or "") if isinstance(draft, dict) else ""
        return False, draft_text or ""

    @staticmethod
    def _compact_norm(value: str) -> str:
        return norm(str(value or "")).replace(" ", "")

    @staticmethod
    def _fold_space(value: str) -> str:
        return re.sub(r"\s+", " ", str(value or "")).strip()

    def _new_published_note_ids(self) -> set[str]:
        if not self.has_init:
            return set()
        try:
            return {str(value) for value in (self.init.published_notes or [])}
        except Exception:
            return set()

    def _iter_publish_targets(
        self,
        *,
        new_only: bool = False,
        allow_draft: bool = False,
    ):
        initial_ids = self._new_published_note_ids() if new_only else set()
        for note_id in self.published_notes:
            note_id = str(note_id or "")
            if note_id and note_id in initial_ids:
                continue
            note = self.get_note(note_id)
            if not note:
                continue
            title = str(note.get("title") or "")
            body = str(note.get("desc") or note.get("content") or "")
            yield title, body, f"title={title}, desc={body[:40]}"
        if allow_draft:
            draft = self.get("publishDraft", {}) or {}
            if isinstance(draft, dict):
                title = str(draft.get("title") or "")
                body = str(draft.get("text") or "")
                yield title, body, body or title

    # =========================================================================
    # Check methods — return standard dict for check_goals
    # =========================================================================

    def check_following(
        self, user_id: str, *, expected: bool = True, field: str = "following"
    ) -> dict[str, Any]:
        """验证是否已关注指定用户。"""
        actual = self.is_following(user_id)
        user = self.users_by_id.get(user_id)
        name = str(user["name"]) if user else user_id
        return {
            "field": field,
            "expected": f"following {name}" if expected else f"not following {name}",
            "actual": "following" if actual else "not following",
            "passed": actual == expected,
        }

    def check_note_commented(
        self,
        note_id: str,
        comment: str,
        user_id: str | None = None,
        *,
        field: str = "comment",
    ) -> dict[str, Any]:
        """验证笔记下是否有指定评论。"""
        commented = self.note_has_comment(note_id, comment, user_id)
        return {
            "field": field,
            "expected": f"comment {comment!r} on {note_id}",
            "actual": "commented" if commented else "no comment",
            "passed": commented,
        }

    def check_note_published(
        self,
        title_pred=None,
        content_pred=None,
        *,
        title_exact: str | None = None,
        title_keywords: Sequence[str] = (),
        content_keywords: Sequence[str] = (),
        text_keywords: Sequence[str] = (),
        content_lines: Sequence[str] = (),
        new_only: bool = False,
        allow_draft: bool = False,
        field: str = "post_note",
    ) -> dict[str, Any]:
        """检查是否发了满足条件的小红书笔记。

        所有条件取 AND：同时传 title_exact + title_pred 时两者都必须满足，
        同时传 content_keywords + content_pred 时两者也都必须满足。
        只有全部条件通过的笔记才算匹配。

        Args:
            title_pred: ``(title: str) -> bool`` (optional)
            content_pred: ``(desc: str) -> bool`` (optional)
            title_exact: 标题精确匹配（去首尾空白后比较）
            title_keywords: 标题归一化后需包含的关键词列表
            content_keywords: 正文需包含的关键词列表
            text_keywords: 标题+正文合并后归一化需包含的关键词列表
            content_lines: 标题+正文折叠空白后需包含的多行内容
            new_only: 仅检查 init 之后新增的已发布笔记
            allow_draft: 允许草稿 `publishDraft` 作为 fallback
            field: check result 中的 field 名
        """
        expected: dict[str, Any] = {
            "published": True,
            "title_exact": title_exact,
            "title_keywords": list(title_keywords),
            "content_keywords": list(content_keywords),
            "text_keywords": list(text_keywords),
            "content_lines": list(content_lines),
            "new_only": new_only,
            "allow_draft": allow_draft,
            "uses_title_pred": title_pred is not None,
            "uses_content_pred": content_pred is not None,
        }
        for title_raw, desc, actual in self._iter_publish_targets(
            new_only=new_only,
            allow_draft=allow_draft,
        ):
            title = str(title_raw).strip()
            content_text = desc if desc.strip() else title
            combined = self._fold_space(f"{title} {desc}")
            title_exact_ok = title == str(title_exact).strip() if title_exact is not None else True
            title_keyword_missing = [
                kw for kw in title_keywords
                if self._compact_norm(kw) not in self._compact_norm(title)
            ]
            keyword_missing = [kw for kw in content_keywords if kw not in desc]
            text_keyword_missing = [
                kw for kw in text_keywords
                if self._compact_norm(kw) not in self._compact_norm(f"{title} {desc}")
            ]
            line_missing = [
                line for line in content_lines
                if self._fold_space(line) not in combined
            ]
            t_ok = (
                title_exact_ok
                and not title_keyword_missing
                and (title_pred(title) if title_pred else True)
            )
            c_ok = (
                (not keyword_missing)
                and (not text_keyword_missing)
                and (not line_missing)
                and (content_pred(desc) if content_pred else True)
            )
            if t_ok and c_ok:
                return {
                    "field": field,
                    "expected": expected,
                    "actual": actual,
                    "passed": True,
                }
        return {
            "field": field,
            "expected": expected,
            "actual": "no matching post",
            "passed": False,
        }
