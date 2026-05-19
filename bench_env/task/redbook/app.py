"""
Redbook (小红书) state accessor.

Provides convenient access to Redbook app state with comparison utilities.
"""

from __future__ import annotations

import json
import re
from functools import cached_property
from pathlib import Path
from typing import Any, Sequence

from bench_env.task.base import BaseApp
from bench_env.task.utils import norm


_DEFAULTS_PATH = Path(__file__).resolve().parents[3] / "apps" / "RedBook" / "data" / "defaults.json"
_REDBOOK_DATA_DIR = _DEFAULTS_PATH.parent
_REDBOOK_USERS_JSON_PATH = _REDBOOK_DATA_DIR / "users.json"
_REDBOOK_NOTES_JSON_PATH = _REDBOOK_DATA_DIR / "notes.json"
_DEFAULTS = json.loads(_DEFAULTS_PATH.read_text(encoding="utf-8"))
_REDBOOK_USERS_JSON_CACHE: dict[str, dict[str, Any]] | None = None
_REDBOOK_NOTES_JSON_CACHE: list[dict[str, Any]] | None = None
_REDBOOK_NOTES_BY_ID_CACHE: dict[str, dict[str, Any]] | None = None

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
    "redbook.user.publishedNoteIds",
    "redbook.notes",
    "redbook.publishDraft",
]


# JS `parseFloat` leading-numeric-prefix grammar: optional sign, then
#   - integer or fractional part (with optional decimal point and digits), or .digits
#   - optional exponent (e/E with optional sign and digits)
_PARSE_FLOAT_PREFIX_RE = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")


def _parse_float_prefix(raw: str) -> float:
    """Match JS `parseFloat` semantics: parse the leading numeric prefix, ignoring trailing junk.

    `parseFloat("1.2.3") === 1.2`; `parseFloat("1e3") === 1000`; `parseFloat("abc") === NaN`
    (returned as 0.0 here).
    """
    m = _PARSE_FLOAT_PREFIX_RE.match(raw)
    if not m:
        return 0.0
    try:
        return float(m.group(0))
    except ValueError:
        return 0.0


def _strip_first(raw: str, ch: str) -> str:
    """Remove the first occurrence of `ch` from `raw` (case-insensitive when `ch` is ASCII).

    Mirrors JS `String.prototype.replace(literal, '')` which replaces ONLY the first match.
    """
    idx = raw.lower().find(ch.lower()) if ch.isascii() else raw.find(ch)
    if idx < 0:
        return raw
    return raw[:idx] + raw[idx + len(ch):]


def _parse_count(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value) if (value == value) else 0.0  # filters NaN
    raw = str(value).replace("+", "").strip()
    if not raw:
        return 0.0
    # Match the TS `parseRedBookCount`: substring test + first-occurrence strip, then ×10000.
    if "万" in raw:
        return _parse_float_prefix(_strip_first(raw, "万")) * 10000
    if "w" in raw.lower():
        return _parse_float_prefix(_strip_first(raw, "w")) * 10000
    return _parse_float_prefix(raw)


def _load_users_json() -> dict[str, dict[str, Any]]:
    global _REDBOOK_USERS_JSON_CACHE
    if _REDBOOK_USERS_JSON_CACHE is not None:
        return _REDBOOK_USERS_JSON_CACHE
    try:
        raw = json.loads(_REDBOOK_USERS_JSON_PATH.read_text(encoding="utf-8")) or []
        users = raw if isinstance(raw, list) else []
    except Exception:
        users = []
    _REDBOOK_USERS_JSON_CACHE = {
        str(user.get("id")): user
        for user in users
        if isinstance(user, dict) and user.get("id")
    }
    return _REDBOOK_USERS_JSON_CACHE


def _load_notes_json() -> list[dict[str, Any]]:
    global _REDBOOK_NOTES_JSON_CACHE
    if _REDBOOK_NOTES_JSON_CACHE is not None:
        return _REDBOOK_NOTES_JSON_CACHE
    try:
        raw = json.loads(_REDBOOK_NOTES_JSON_PATH.read_text(encoding="utf-8")) or []
        _REDBOOK_NOTES_JSON_CACHE = raw if isinstance(raw, list) else []
    except Exception:
        _REDBOOK_NOTES_JSON_CACHE = []
    return _REDBOOK_NOTES_JSON_CACHE


def _load_notes_by_id() -> dict[str, dict[str, Any]]:
    global _REDBOOK_NOTES_BY_ID_CACHE
    if _REDBOOK_NOTES_BY_ID_CACHE is not None:
        return _REDBOOK_NOTES_BY_ID_CACHE
    _REDBOOK_NOTES_BY_ID_CACHE = {
        str(note.get("id")): note
        for note in _load_notes_json()
        if isinstance(note, dict) and note.get("id")
    }
    return _REDBOOK_NOTES_BY_ID_CACHE


_REDBOOK_BASE_PARSED_COUNTS_CACHE: dict[str, tuple[int, int, int]] | None = None
_REDBOOK_BASE_COMMENT_TO_NOTE_CACHE: dict[str, str] | None = None
_REDBOOK_BASE_FEED_IDS_CACHE: tuple[str, ...] | None = None
_REDBOOK_BASE_USER_IDS_CACHE: tuple[str, ...] | None = None

# Sentinel used by `view_note` to distinguish "key not in state" from "key present with value None".
_MISSING: Any = object()


def _load_base_comment_to_note() -> dict[str, str]:
    """Reverse index: base comment id → its parent note id.

    Used for two things:
    - Filtering `state.comments` entries that are *patches* on base comments
      (handled in the base commentList loop) vs. runtime-only new comments.
    - Inverting the "which base notes are touched by state.comments?" query
      from O(F·C) full-scan to O(|state.comments|) dict lookup.
    """
    global _REDBOOK_BASE_COMMENT_TO_NOTE_CACHE
    if _REDBOOK_BASE_COMMENT_TO_NOTE_CACHE is not None:
        return _REDBOOK_BASE_COMMENT_TO_NOTE_CACHE
    out: dict[str, str] = {}
    for note in _load_notes_json():
        if not isinstance(note, dict) or not note.get("id"):
            continue
        nid = str(note["id"])
        for c in note.get("commentList") or []:
            if isinstance(c, dict) and c.get("id") is not None:
                out[str(c["id"])] = nid
    _REDBOOK_BASE_COMMENT_TO_NOTE_CACHE = out
    return out


def _load_base_feed_ids() -> tuple[str, ...]:
    """Module-cached base feed order. Returns an immutable tuple."""
    global _REDBOOK_BASE_FEED_IDS_CACHE
    if _REDBOOK_BASE_FEED_IDS_CACHE is not None:
        return _REDBOOK_BASE_FEED_IDS_CACHE
    _REDBOOK_BASE_FEED_IDS_CACHE = tuple(
        str(note["id"]) for note in _load_notes_json()
        if isinstance(note, dict) and note.get("id")
    )
    return _REDBOOK_BASE_FEED_IDS_CACHE


def _load_base_user_ids() -> tuple[str, ...]:
    """Module-cached base user-id list. Returns an immutable tuple."""
    global _REDBOOK_BASE_USER_IDS_CACHE
    if _REDBOOK_BASE_USER_IDS_CACHE is not None:
        return _REDBOOK_BASE_USER_IDS_CACHE
    _REDBOOK_BASE_USER_IDS_CACHE = tuple(_load_users_json().keys())
    return _REDBOOK_BASE_USER_IDS_CACHE


def _load_base_parsed_counts() -> dict[str, tuple[int, int, int]]:
    """Pre-parse base note count fields once.

    Base notes' likes/collections/comments are often Chinese-formatted strings
    like '1.2万'. Without pre-parsing we re-run `_parse_count` on every
    `view_note` call (4000+ notes × 3 fields = ~12K regex/string ops per
    materialization). Pre-parsing turns this into one dict lookup.
    """
    global _REDBOOK_BASE_PARSED_COUNTS_CACHE
    if _REDBOOK_BASE_PARSED_COUNTS_CACHE is not None:
        return _REDBOOK_BASE_PARSED_COUNTS_CACHE
    out: dict[str, tuple[int, int, int]] = {}
    for nid, note in _load_notes_by_id().items():
        out[nid] = (
            int(_parse_count(note.get("likes"))),
            int(_parse_count(note.get("collections"))),
            int(_parse_count(note.get("comments"))),
        )
    _REDBOOK_BASE_PARSED_COUNTS_CACHE = out
    return out


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
    #
    # `state_*`, `user`, `liked_notes`, etc. are all `@cached_property` because
    # `BaseApp.get(path)` walks the state via regex-based path parsing — calling
    # it 4000+ times in a single `view_notes_by_id` materialization dominates
    # the profile. Caching once per Redbook instance is safe because the
    # backing state is treated as immutable for the lifetime of the instance
    # (see docstring on `view_notes_by_id`).
    #
    @cached_property
    def user(self) -> dict[str, Any]:
        """Current user object."""
        return self.state_user()

    def state_user(self) -> dict[str, Any]:
        user = self.get("user", {})
        return user if isinstance(user, dict) else {}

    @property
    def user_id(self) -> str:
        return self.user.get("id", "")

    @property
    def user_name(self) -> str:
        return self.user.get("name", "")

    # =========================================================================
    # User interaction lists
    # =========================================================================

    @cached_property
    def liked_notes(self) -> list[str]:
        """Note IDs the user has liked."""
        return self.user.get("likedNotes", [])

    @cached_property
    def collected_notes(self) -> list[str]:
        """Note IDs the user has collected."""
        return self.user.get("collectedNotes", [])

    @cached_property
    def following_ids(self) -> list[str]:
        """User IDs the user is following."""
        return self.user.get("followingIds", [])

    @cached_property
    def follower_ids(self) -> list[str]:
        """User IDs following the current user."""
        return self.user.get("followerIds", [])

    @cached_property
    def published_notes(self) -> list[str]:
        """Note IDs the user has published."""
        return self.user.get("publishedNoteIds", [])

    # ── Set-shaped lookups (hot path in view_note) ─────────────────────
    @cached_property
    def _liked_notes_set(self) -> set[str]:
        return {str(nid) for nid in self.liked_notes}

    @cached_property
    def _collected_notes_set(self) -> set[str]:
        return {str(nid) for nid in self.collected_notes}

    @cached_property
    def _following_ids_set(self) -> set[str]:
        return {str(uid) for uid in self.following_ids}

    @cached_property
    def _liked_comments_by_note(self) -> dict[str, set[str]]:
        raw = self.user.get("likedCommentsByNote") or {}
        return {
            str(nid): {str(cid) for cid in (cids or [])}
            for nid, cids in raw.items()
        }

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
    
    @cached_property
    def state_notes(self) -> dict[str, Any]:
        notes = self.get("notes", {})
        return notes if isinstance(notes, dict) else {}

    @cached_property
    def state_comments(self) -> dict[str, Any]:
        comments = self.get("comments", {})
        return comments if isinstance(comments, dict) else {}

    @cached_property
    def state_users(self) -> dict[str, Any]:
        users = self.get("users", {})
        return users if isinstance(users, dict) else {}

    @cached_property
    def _state_comment_keys(self) -> set[str]:
        """All comment ids that have a state.comments entry (patch or tombstone)."""
        return set(self.state_comments.keys())

    @cached_property
    def _state_comments_by_note_id(self) -> dict[str, list[dict[str, Any]]]:
        """Bucket state.comments entries by their declared `noteId`.

        We DO NOT filter patches on base comments here — instead `view_note` filters
        per-note using THAT note's base commentList ids. This preserves the prior
        semantic that an entry whose id matches a base comment of note B but whose
        `noteId` points to note A still appears as a runtime comment under A.
        """
        out: dict[str, list[dict[str, Any]]] = {}
        for cid, comment in self.state_comments.items():
            if not isinstance(comment, dict):
                continue
            nid = str(comment.get("noteId") or "")
            if not nid:
                continue
            cid_str = str(cid)
            # Prefer the entry's own `id` field; fall back to the dict key when missing.
            if comment.get("id"):
                normalized = comment
            else:
                normalized = {**comment, "id": cid_str}
            out.setdefault(nid, []).append(normalized)
        return out

    @cached_property
    def _base_notes_with_comment_overlay(self) -> set[str]:
        """Base note IDs whose `commentList` has at least one comment touched by `state.comments`.

        Uses the module-cached `_load_base_comment_to_note` reverse index, so the cost
        is O(|state.comments|) (typically tiny) instead of O(F·C) full-scan.
        """
        state_keys = self._state_comment_keys
        if not state_keys:
            return set()
        comment_to_note = _load_base_comment_to_note()
        return {
            comment_to_note[str(cid)]
            for cid in state_keys
            if str(cid) in comment_to_note
        }

    @property
    def base_notes_by_id(self) -> dict[str, dict[str, Any]]:
        return _load_notes_by_id()

    @property
    def base_users_by_id(self) -> dict[str, dict[str, Any]]:
        return _load_users_json()

    @property
    def base_feed_ids(self) -> tuple[str, ...]:
        return _load_base_feed_ids()

    @property
    def base_user_ids(self) -> tuple[str, ...]:
        return _load_base_user_ids()
    
    @property
    def notes_by_id(self) -> dict[str, dict]:
        """All visible notes by ID, using base + runtime view semantics."""
        return self.view_notes_by_id
    
    @property
    def users_by_id(self) -> dict[str, dict]:
        """All visible users by ID, using base + runtime view semantics."""
        return self.view_users_by_id
    
    @cached_property
    def feed_ids(self) -> list[str]:
        """Visible public feed note IDs.

        Order mirrors the frontend `buildRedBookView` semantics: runtime-only notes
        (newly published or seeded via `defaults.notes`) come first, sorted by
        `createdAt` desc; then `base.feedIds` in declared order, with tombstoned
        entries removed.

        Cached on the instance — do not reuse a `Redbook` after mutating its
        backing `state`; construct a new instance instead.
        """
        base_feed = [str(nid) for nid in self.base_feed_ids if nid]
        base_feed_set = set(base_feed)
        tombstones: set[str] = set()
        runtime_only: list[tuple[str, float]] = []
        for note_id, value in self.state_notes.items():
            nid = str(note_id)
            if not nid:
                continue
            if value is None:
                tombstones.add(nid)
                continue
            if nid in base_feed_set:
                continue
            created_at = 0.0
            if isinstance(value, dict):
                try:
                    created_at = float(value.get("createdAt") or 0)
                except (TypeError, ValueError):
                    created_at = 0.0
            runtime_only.append((nid, created_at))
        runtime_only.sort(key=lambda item: item[1], reverse=True)

        out: list[str] = []
        seen: set[str] = set()
        for nid, _ in runtime_only:
            if nid in seen:
                continue
            seen.add(nid)
            out.append(nid)
        for nid in base_feed:
            if nid in seen or nid in tombstones:
                continue
            seen.add(nid)
            out.append(nid)
        return out
    
    @property
    def chats(self) -> list[dict]:
        """Chat list."""
        return self.get_list("chats")

    @property
    def hot_search(self) -> list[dict[str, Any]]:
        """Search landing hot-search list from runtime state."""
        return self.get_list("hotSearch") or list(_DEFAULTS.get("hotSearch", []) or [])
    
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
        """指定用户发布的所有笔记。当前用户按 publishedNoteIds 顺序返回。"""
        target_id = str(user_id or "")
        if target_id == self.user_id:
            return [
                note
                for note_id in self.published_notes
                if (note := self.view_note(str(note_id))) is not None
            ]

        notes: list[dict[str, Any]] = []
        for note_id in self.feed_ids:
            note = self.notes_by_id.get(note_id)
            if note is None:
                continue
            if str(note.get("authorId") or "") != target_id:
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

    # =========================================================================
    # Note operations
    # =========================================================================

    @cached_property
    def view_notes_by_id(self) -> dict[str, dict[str, Any]]:
        """All visible notes by ID. `feed_ids` already merges runtime-only notes.

        Cached on the instance — do not reuse a `Redbook` after mutating its
        backing `state`; construct a new instance instead.
        """
        out: dict[str, dict[str, Any]] = {}
        for note_id in self.feed_ids:
            note = self.view_note(str(note_id))
            if note is not None:
                out[str(note["id"])] = note
        return out

    @cached_property
    def view_users_by_id(self) -> dict[str, dict[str, Any]]:
        """All visible users by ID. Cached on the instance — see `view_notes_by_id`."""
        user_ids = [self.user_id, *self.base_user_ids, *self.state_users.keys()]
        out: dict[str, dict[str, Any]] = {}
        for user_id in user_ids:
            user = self.view_user(str(user_id))
            if user is not None:
                out[str(user["id"])] = user
        return out

    def base_note(self, note_id: str) -> dict[str, Any] | None:
        return self.base_notes_by_id.get(str(note_id))

    def state_note(self, note_id: str) -> dict[str, Any] | None:
        if str(note_id) not in self.state_notes:
            return None
        value = self.state_notes.get(str(note_id))
        return value if isinstance(value, dict) else None

    def base_user(self, user_id: str) -> dict[str, Any] | None:
        return self.base_users_by_id.get(str(user_id))

    def state_user_entity(self, user_id: str) -> dict[str, Any] | None:
        if str(user_id) not in self.state_users:
            return None
        value = self.state_users.get(str(user_id))
        return value if isinstance(value, dict) else None

    def view_note(self, note_id: str) -> dict[str, Any] | None:
        """Resolve a single note for the view.

        Hot path (~99% of notes when user has no interactions): a clean base note with
        no overlay returns the base reference unmodified — no dict clone, no derivation.
        Treat the returned dict as **read-only**; callers must not mutate it.

        Slow path: clone base + state overlay, derive counts from user truth fields,
        merge runtime comments + apply comment patches/tombstones/likes.
        """
        note_id = str(note_id)
        state_notes = self.state_notes
        state_value = state_notes.get(note_id) if note_id in state_notes else _MISSING
        if state_value is None:  # tombstone
            return None
        base = self.base_notes_by_id.get(note_id)

        # ── Fast path ─────────────────────────────────────────────────────────
        if (
            state_value is _MISSING
            and base is not None
            and note_id not in self._liked_notes_set
            and note_id not in self._collected_notes_set
            and not self._liked_comments_by_note.get(note_id)
            and note_id not in self._state_comments_by_note_id
            and note_id not in self._base_notes_with_comment_overlay
        ):
            return base

        # ── Slow path ─────────────────────────────────────────────────────────
        # 不变量: store/seed 写 `state.notes` 时必须保持 `state.notes[id]["id"] == id`
        # (`apps/RedBook/state.ts` 的 `addNote` 与 bench `_publish_note` 都遵守)。
        # 因此用 `note_id` (dict key) 作为唯一锚点查 liked/collected/runtime-comments，
        # 与 `view_notes_by_id` 用 dict key 作为索引保持一致 —— 调用方拿 feed id 来 lookup
        # 不会 miss。若调用方违反不变量，feedIds 与 view_notes_by_id 会以不同 id 索引。
        merged_source = state_value if isinstance(state_value, dict) else base
        if merged_source is None:
            return None
        note = dict(merged_source)

        liked_comment_ids = self._liked_comments_by_note.get(note_id, frozenset())
        state_comments = self.state_comments
        base_comments_out: list[Any] = []
        hidden_base_comments = 0
        # Track ids claimed by THIS note's base commentList; runtime-only entries
        # carrying the same id are patches handled here, not separate comments.
        this_note_base_comment_ids: set[str] = set()
        for comment in note.get("commentList") or []:
            if not isinstance(comment, dict):
                base_comments_out.append(comment)
                continue
            comment_id = str(comment.get("id") or "")
            if comment_id:
                this_note_base_comment_ids.add(comment_id)
            state_comment = state_comments.get(comment_id, _MISSING) if comment_id else _MISSING
            if state_comment is None:
                hidden_base_comments += 1
                continue
            if isinstance(state_comment, dict):
                merged_comment = {"id": comment_id, **state_comment}
            else:
                merged_comment = comment
            if str(merged_comment.get("id")) in liked_comment_ids:
                merged_comment = {**merged_comment, "likes": _parse_count(merged_comment.get("likes")) + 1}
            base_comments_out.append(merged_comment)

        runtime_comments_raw = self._state_comments_by_note_id.get(note_id, [])
        runtime_comments = [
            rc for rc in runtime_comments_raw
            if str(rc.get("id") or "") not in this_note_base_comment_ids
        ]
        if liked_comment_ids and runtime_comments:
            runtime_comments = [
                {**rc, "likes": _parse_count(rc.get("likes")) + 1}
                if str(rc.get("id")) in liked_comment_ids
                else rc
                for rc in runtime_comments
            ]

        # Use pre-parsed base counts when the note has no state overlay; otherwise
        # parse from the (likely numeric) state value.
        if state_value is _MISSING:
            parsed = _load_base_parsed_counts().get(note_id)
            if parsed is not None:
                base_likes, base_collections, base_comments_n = parsed
            else:
                base_likes = int(_parse_count(merged_source.get("likes")))
                base_collections = int(_parse_count(merged_source.get("collections")))
                base_comments_n = int(_parse_count(merged_source.get("comments")))
        else:
            base_likes = int(_parse_count(merged_source.get("likes")))
            base_collections = int(_parse_count(merged_source.get("collections")))
            base_comments_n = int(_parse_count(merged_source.get("comments")))

        liked = note_id in self._liked_notes_set
        collected = note_id in self._collected_notes_set
        note["likes"] = base_likes + (1 if liked else 0)
        note["collections"] = base_collections + (1 if collected else 0)
        note["comments"] = max(0, base_comments_n - hidden_base_comments + len(runtime_comments))
        note["commentList"] = [*runtime_comments, *base_comments_out]
        return note

    def view_user(self, user_id: str) -> dict[str, Any] | None:
        user_id = str(user_id)
        if user_id == self.user_id:
            user = dict(self.user)
            user["following"] = len(self.following_ids)
            user["followers"] = len(user.get("followerIds") or [])
            return user

        state_has_key = user_id in self.state_users
        state_value = self.state_users.get(user_id)
        if state_has_key and state_value is None:
            return None
        base = self.base_user(user_id)
        if isinstance(state_value, dict):
            user = dict(state_value)
        elif base:
            user = dict(base)
        else:
            return None
        if user_id in {str(item) for item in self.following_ids}:
            user["followers"] = int(_parse_count(user.get("followers")) + 1)
        return user
    
    def get_note(self, note_id: str) -> dict | None:
        """Get visible note by ID."""
        return self.view_note(note_id)

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
        """Get visible user by ID."""
        return self.view_user(user_id)
    
    def find_user_by_name(self, name: str) -> dict | None:
        """
        Find user by name (partial match, case insensitive).
        
        Args:
            name: Search name
            
        Returns:
            User dict or None
        """
        name_lower = name.lower()
        for uid in self.base_user_ids:
            user = self.view_user(uid) or {}
            if name_lower in (user.get("name") or "").lower():
                return user
        for uid, user in self.view_users_by_id.items():
            if uid in self.base_user_ids:
                continue
            if name_lower in (user.get("name") or "").lower():
                return user
        return None
    
    def is_following(self, user_id: str) -> bool:
        """Check if current user follows given user."""
        return user_id in self.following_ids

    @staticmethod
    def sample_followed_user_name(env_state: dict[str, Any], rng: Any) -> str:
        rb = Redbook(env_state["apps"]["redbook"])
        preferred: list[str] = []
        fallback: list[str] = []
        for uid in rb.following_ids:
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
        for uid in rb.following_ids:
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
                f"No followed users with >= {MIN_NOTES} notes (followingIds notes 太少, "
                "无法采样有意义的'数笔记'任务)"
            )
        return rng.choice(candidates)

    @staticmethod
    def sample_unfollowed_user_name(env_state: dict[str, Any], rng: Any) -> str:
        rb = Redbook(env_state["apps"]["redbook"])
        followed = set(rb.following_ids)
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
    def sample_uncollected_feed_title_keyword(env_state: dict[str, Any], rng: Any) -> str:
        """采样 keyword：来自当前可见 feed 中**尚未收藏**的笔记标题。

        用于 "收藏含关键词的笔记" 这类任务，避免命中 seed 已收藏的笔记导致 diff 永远为空。
        若所有可见 feed 笔记都已收藏（极端情况），抛错让上游意识到 seed 配置异常。
        """
        rb = Redbook(env_state["apps"]["redbook"])
        collected = set(rb.user.get("collectedNotes") or [])
        titles = [
            str(n.get("title") or "").strip()
            for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if str(n.get("id")) not in collected
        ]
        titles = [t for t in titles if t]
        if not titles:
            raise ValueError("No uncollected feed note titles found in redbook state")
        for _ in range(10):
            kw = Redbook._sample_keyword_from_title(rng.choice(titles), rng)
            if kw:
                return kw
        return titles[0][:4]

    @staticmethod
    def sample_unliked_feed_title_keyword(env_state: dict[str, Any], rng: Any) -> str:
        """采样 keyword：来自当前可见 feed 中**尚未点赞**的笔记标题。

        与 `sample_uncollected_feed_title_keyword` 对称，避免 "点赞含关键词的笔记"
        类任务命中 seed 已点赞笔记。
        """
        rb = Redbook(env_state["apps"]["redbook"])
        liked = set(rb.user.get("likedNotes") or [])
        titles = [
            str(n.get("title") or "").strip()
            for n in rb.visible_discover_notes_for_category("recommend", limit=40)
            if str(n.get("id")) not in liked
        ]
        titles = [t for t in titles if t]
        if not titles:
            raise ValueError("No unliked feed note titles found in redbook state")
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
        """Notes visible in HomePage 'discover' tab for a given category key.

        `displayCount` 已经从 state 移除（UI 滚动状态进了 React 本地 useState），
        这里维持原先 limit=40 / display_count=20 的语义，bench 视角永远取 top-20。
        category 现住在 `_temp.activeCategory`，但本函数只按 category_key 参数过滤，
        不再依赖 state 里的 active category 字段。
        """
        display_count = 20
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

    def check_chat_exact_message_to(
        self,
        username: str,
        message: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证是否给指定用户发过**内容精确等于 message** 的私信（不要求是最后一条）。

        与 `check_chat_sent_to` 的差异：
        - 前者: keyword 子串匹配 + **只看最后一条**本人消息
        - 后者(本方法): 精确等于 + **遍历所有**本人消息（任一条匹配即通过）

        当任务要求"发一句 X"（X 是完整内容，不是子串），用本方法。
        """
        if field is None:
            field = f"dm_to_{username}"
        user = self.require_user_by_name(username)
        passed = self.chat_has_message(str(user["id"]), str(message))
        chat = self.get_chat(str(user["id"]))
        last_actual = ""
        if chat is not None:
            for m in reversed(chat.get("messages", [])):
                if str(m.get("senderId") or "") == self.user_id:
                    last_actual = str(m.get("content") or "")
                    break
        return {
            "field": field,
            "expected": str(message),
            "actual": last_actual or "(no message from me)",
            "passed": passed,
        }

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
    
    def added_to_following_ids(self) -> set[str]:
        """Users followed since init."""
        return self.list_added("user.followingIds")
    
    def removed_from_following_ids(self) -> set[str]:
        """Users unfollowed since init."""
        return self.list_removed("user.followingIds")

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
                "judgments must be done via diff (see bench_env/docs/task/IMPLEMENTATION.md §2.5)"
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

    def check_note_liked(
        self,
        note_id: str,
        *,
        field: str = "liked",
    ) -> dict[str, Any]:
        """验证指定笔记在本次任务中被新点赞（init 未点赞 → current 已点赞，diff 判定）。

        与 `check_note_collected` 对称——要求 init，断言 init 未点赞该笔记
        （否则 sampler 上游让"已点赞笔记"作为目标，任务无解，应直接报上游 bug）。
        """
        if not self.has_init:
            raise ValueError(
                "Redbook.check_note_liked requires an init state — Create/Delete "
                "judgments must be done via diff"
            )
        note_id_str = str(note_id)
        assert not self.init.has_liked(note_id_str), (
            f"Upstream bug: note {note_id_str} already liked in init"
        )
        added = self.added_to_liked()
        passed = note_id_str in added
        return {
            "field": field,
            "expected": f"note {note_id_str} newly liked",
            "actual": sorted(added) if added else "(no new liked notes)",
            "passed": passed,
        }

    def check_note_uncollected(
        self,
        note_id: str,
        *,
        field: str = "uncollected",
    ) -> dict[str, Any]:
        """验证指定笔记在本次任务中被取消收藏（init 已收藏 → current 未收藏，diff 判定）。

        与 `check_note_collected` 互为反向。要求 init，断言 init 已收藏该笔记
        （上游若让"未收藏笔记"作为"取消收藏"目标也是 bug）。
        """
        if not self.has_init:
            raise ValueError(
                "Redbook.check_note_uncollected requires an init state — diff judgment needs init"
            )
        note_id_str = str(note_id)
        assert self.init.has_collected(note_id_str), (
            f"Upstream bug: note {note_id_str} was not collected in init, cannot uncollect"
        )
        removed = self.removed_from_collected()
        passed = note_id_str in removed
        return {
            "field": field,
            "expected": f"note {note_id_str} uncollected",
            "actual": sorted(removed) if removed else "(no uncollected notes)",
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
