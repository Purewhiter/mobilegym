"""
X (Twitter) app state accessor.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from bench_env.task.base import BaseApp


_REPO_ROOT = Path(__file__).resolve().parents[3]
_X_DATA_DIR = _REPO_ROOT / "apps" / "X" / "data"

_X_USERS_JSON_PATH = _X_DATA_DIR / "users.json"
_X_POSTS_JSON_PATH = _X_DATA_DIR / "posts.json"

_X_USERS_JSON_CACHE: dict[str, dict[str, Any]] | None = None
_X_POSTS_JSON_CACHE: list[dict[str, Any]] | None = None
_X_POSTS_BY_ID_CACHE: dict[str, dict[str, Any]] | None = None

_AMBIGUOUS_HANDLES = {"@openai", "@elonmusk"}


def _normalize_id(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_handle(value: Any) -> str:
    handle = str(value or "").strip()
    if not handle:
        return ""
    return handle if handle.startswith("@") else f"@{handle}"


def _preview_text(text: Any, *, limit: int = 40) -> str:
    plain = str(text or "").strip().replace("\n", " ")
    if len(plain) <= limit:
        return plain
    return plain[: limit - 3] + "..."


def _pick_keyword(text: Any) -> str:
    plain = str(text or "").strip().replace("\n", " ")
    if not plain:
        return ""
    words = plain.split()
    if len(words) >= 3:
        return " ".join(words[: min(5, len(words))])
    return plain[: min(8, len(plain))]


def _merge_entity(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    result = dict(base)
    for key, value in patch.items():
        base_value = result.get(key)
        if isinstance(base_value, dict) and isinstance(value, dict):
            result[key] = _merge_entity(base_value, value)
        else:
            result[key] = value
    return result


def _load_users_json() -> dict[str, Any]:
    """
    加载 X 应用公共用户表。
    """
    global _X_USERS_JSON_CACHE
    if _X_USERS_JSON_CACHE is not None:
        return _X_USERS_JSON_CACHE

    try:
        with _X_USERS_JSON_PATH.open("r", encoding="utf-8") as f:
            users = json.load(f) or {}
        _X_USERS_JSON_CACHE = users if isinstance(users, dict) else {}
    except Exception:
        _X_USERS_JSON_CACHE = {}
    return _X_USERS_JSON_CACHE


def _load_posts_json() -> list[dict[str, Any]]:
    """
    加载 X 应用公共推文表。
    """
    global _X_POSTS_JSON_CACHE
    if _X_POSTS_JSON_CACHE is not None:
        return _X_POSTS_JSON_CACHE

    try:
        with _X_POSTS_JSON_PATH.open("r", encoding="utf-8") as f:
            posts = json.load(f) or []
        _X_POSTS_JSON_CACHE = posts if isinstance(posts, list) else []
    except Exception:
        _X_POSTS_JSON_CACHE = []
    return _X_POSTS_JSON_CACHE


def _load_posts_by_id() -> dict[str, dict[str, Any]]:
    global _X_POSTS_BY_ID_CACHE
    if _X_POSTS_BY_ID_CACHE is not None:
        return _X_POSTS_BY_ID_CACHE
    _X_POSTS_BY_ID_CACHE = {
        _normalize_id(post.get("id")): post
        for post in _load_posts_json()
        if isinstance(post, dict) and _normalize_id(post.get("id"))
    }
    return _X_POSTS_BY_ID_CACHE


X_POST_CHANGES = ["x.posts", "x.user.postIds"]


class X(BaseApp):
    """
    X state accessor.

    Usage:
        x = X(input.apps["x"])
        x.view_posts()
        x.conversations
        x.users
    """

    @staticmethod
    def _from_env_state(env_state: dict[str, Any]) -> "X":
        return X(BaseApp.get_by_path(env_state, "apps.x", {}) or {})

    @property
    def posts(self) -> list[dict[str, Any]]:
        """只读便捷别名；语义等同 view_posts()。"""
        return self.view_posts()

    def state_user(self) -> dict[str, Any]:
        user = self.get("user") or {}
        return user if isinstance(user, dict) else {}

    @property
    def state_posts(self) -> dict[str, Any]:
        posts = self.get("posts") or {}
        return posts if isinstance(posts, dict) else {}

    @property
    def base_posts(self) -> list[dict[str, Any]]:
        return _load_posts_json()

    def base_post(self, post_id: str) -> dict[str, Any] | None:
        return _load_posts_by_id().get(_normalize_id(post_id))

    def state_post(self, post_id: str) -> dict[str, Any] | None:
        table = self.state_posts
        if post_id in table:
            value = table[post_id]
        else:
            value = table.get(_normalize_id(post_id))
        return value if isinstance(value, dict) else None

    def state_post_entities(self) -> list[dict[str, Any]]:
        return [post for post in self.state_posts.values() if isinstance(post, dict)]

    def view_post(self, post_id: str) -> dict[str, Any] | None:
        table = self.state_posts
        key = str(post_id)
        normalized = _normalize_id(post_id)
        base = self.base_post(post_id)
        if key in table:
            value = table[key]
            if value is None:
                return None
            if isinstance(value, dict):
                post = _merge_entity(base, value) if base else value
                return self._with_relationship_derived_stats(post)
            return None
        if normalized in table:
            value = table[normalized]
            if value is None:
                return None
            if isinstance(value, dict):
                post = _merge_entity(base, value) if base else value
                return self._with_relationship_derived_stats(post)
            return None
        if not base:
            return None
        return self._with_relationship_derived_stats(base)

    def _runtime_comment_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for item in self.state_post_entities():
            thread_id = _normalize_id(item.get("threadId"))
            if thread_id:
                counts[thread_id] = counts.get(thread_id, 0) + 1
        return counts

    def _with_relationship_derived_stats(
        self,
        post: dict[str, Any],
        *,
        liked_ids: set[str] | None = None,
        retweeted_ids: set[str] | None = None,
        comment_counts: dict[str, int] | None = None,
    ) -> dict[str, Any]:
        stats = post.get("stats")
        if not isinstance(stats, dict):
            return post
        post_id = _normalize_id(post.get("id"))
        liked_ids = liked_ids if liked_ids is not None else self.liked_post_ids
        retweeted_ids = retweeted_ids if retweeted_ids is not None else self.retweeted_post_ids
        comment_counts = comment_counts if comment_counts is not None else self._runtime_comment_counts()
        runtime_comments = comment_counts.get(post_id, 0)
        likes_delta = 1 if post_id in liked_ids else 0
        retweets_delta = 1 if post_id in retweeted_ids else 0
        if not runtime_comments and not likes_delta and not retweets_delta:
            return post
        return {
            **post,
            "stats": {
                **stats,
                "comments": max(0, int(stats.get("comments") or 0) + runtime_comments),
                "likes": max(0, int(stats.get("likes") or 0) + likes_delta),
                "retweets": max(0, int(stats.get("retweets") or 0) + retweets_delta),
            },
        }

    def view_posts(self) -> list[dict[str, Any]]:
        table = self.state_posts
        tombstones = {
            _normalize_id(post_id)
            for post_id, value in table.items()
            if value is None
        }
        liked_ids = self.liked_post_ids
        retweeted_ids = self.retweeted_post_ids
        comment_counts = self._runtime_comment_counts()
        base_by_id = {_normalize_id(post.get("id")): post for post in self.base_posts if isinstance(post, dict)}
        combined = []
        for post_id, value in table.items():
            if value is None or not isinstance(value, dict):
                continue
            normalized = _normalize_id(post_id)
            base = base_by_id.get(normalized)
            combined.append(_merge_entity(base, value) if base else value)
        combined.extend(
            post for post in self.base_posts if _normalize_id(post.get("id")) not in tombstones
        )
        seen: set[str] = set()
        out: list[dict[str, Any]] = []
        for post in combined:
            pid = _normalize_id(post.get("id"))
            if not pid or pid in seen:
                continue
            seen.add(pid)
            out.append(
                self._with_relationship_derived_stats(
                    post,
                    liked_ids=liked_ids,
                    retweeted_ids=retweeted_ids,
                    comment_counts=comment_counts,
                )
            )
        return out

    def resolved_posts(self) -> list[dict[str, Any]]:
        out = self.view_posts()

        by_id = {_normalize_id(post.get("id")): post for post in out}
        retweet_shells = []
        emitted: set[str] = set()
        for post_id in reversed(list(self.retweeted_post_ids)):
            if not post_id or post_id in emitted:
                continue
            source = by_id.get(post_id)
            if not source:
                continue
            retweet_shells.append(
                {
                    "id": f"retweet_{source.get('id')}",
                    "authorId": self.get("user.id"),
                    "content": "",
                    "time": "刚刚",
                    "stats": source.get("stats") or {"comments": 0, "retweets": 0, "likes": 0, "views": 0},
                    "retweetedPostId": source.get("id"),
                }
            )
            emitted.add(post_id)
        return [*retweet_shells, *out]

    @property
    def conversations(self) -> list[dict[str, Any]]:
        return self.get_list("conversations")

    @property
    def users(self) -> dict[str, Any]:
        users = dict(_load_users_json())
        current_user = self.state_user()
        if isinstance(current_user, dict) and current_user.get("id"):
            users[str(current_user["id"])] = current_user
        return users

    @property
    def followed_user_ids(self) -> set[str]:
        return {_normalize_id(uid) for uid in (self.state_user().get("followedUserIds") or []) if _normalize_id(uid)}

    @property
    def liked_post_ids(self) -> set[str]:
        return {_normalize_id(pid) for pid in (self.state_user().get("likedPostIds") or []) if _normalize_id(pid)}

    @property
    def bookmarked_post_ids(self) -> set[str]:
        return {_normalize_id(pid) for pid in (self.state_user().get("bookmarkedPostIds") or []) if _normalize_id(pid)}

    @property
    def retweeted_post_ids(self) -> set[str]:
        return {_normalize_id(pid) for pid in (self.state_user().get("retweetedPostIds") or []) if _normalize_id(pid)}

    @property
    def user_post_ids(self) -> set[str]:
        return {_normalize_id(pid) for pid in (self.state_user().get("postIds") or []) if _normalize_id(pid)}

    @property
    def user_reply_ids(self) -> set[str]:
        return {_normalize_id(pid) for pid in (self.state_user().get("replyIds") or []) if _normalize_id(pid)}

    def get_new_ids(self, now_list: list[dict[str, Any]], init_list: list[dict[str, Any]]) -> set[str]:
        init_ids = {_normalize_id(item.get("id")) for item in init_list if _normalize_id(item.get("id"))}
        return {
            _normalize_id(item.get("id"))
            for item in now_list
            if _normalize_id(item.get("id")) and _normalize_id(item.get("id")) not in init_ids
        }

    def find_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        target = _normalize_id(user_id)
        for uid, user_obj in self.users.items():
            if _normalize_id(uid) == target:
                return user_obj
        return None

    def get_user_handle(self, user_id: str) -> str:
        user = self.find_user_by_id(user_id)
        if not user:
            return "@unknown"
        handle = _normalize_handle(user.get("handle") or user.get("screenName"))
        return handle or "@unknown"

    def find_user_id_by_handle(self, handle: str) -> str | None:
        target = _normalize_handle(handle).lower()
        if not target:
            return None

        for uid, user_obj in self.users.items():
            if not isinstance(user_obj, dict):
                continue
            user_handle = _normalize_handle(user_obj.get("handle") or user_obj.get("screenName")).lower()
            if user_handle == target:
                return str(uid)
        return None

    def find_post_by_id(self, post_id: str) -> dict[str, Any] | None:
        return self.view_post(post_id)

    def find_conversation_by_id(self, conversation_id: str) -> dict[str, Any] | None:
        target = _normalize_id(conversation_id)
        return next(
            (conversation for conversation in self.conversations if _normalize_id(conversation.get("id")) == target),
            None,
        )

    def new_posts_vs_init(self) -> list[dict[str, Any]]:
        if not self.has_init:
            raise ValueError("Init state required for X post diff")
        current_posts = self.state_post_entities()
        init_posts = self.init.state_post_entities()
        base_ids = {
            _normalize_id(post.get("id"))
            for post in self.base_posts
            if isinstance(post, dict) and _normalize_id(post.get("id"))
        }
        new_ids = self.get_new_ids(current_posts, init_posts) - base_ids
        new_post_ids = self.new_user_post_ids()
        new_reply_ids = self.new_user_reply_ids()
        out: list[dict[str, Any]] = []
        for post in current_posts:
            post_id = _normalize_id(post.get("id"))
            if post_id not in new_ids:
                continue
            if _normalize_id(post.get("threadId")):
                if post_id not in new_reply_ids:
                    continue
            elif post_id not in new_post_ids:
                continue
            out.append(post)
        return out

    def new_followed_user_ids(self) -> set[str]:
        if not self.has_init:
            raise ValueError("Init state required for X follow diff")
        return self.followed_user_ids - self.init.followed_user_ids

    def new_liked_post_ids(self) -> set[str]:
        if not self.has_init:
            raise ValueError("Init state required for X like diff")
        return self.liked_post_ids - self.init.liked_post_ids

    def new_bookmarked_post_ids(self) -> set[str]:
        if not self.has_init:
            raise ValueError("Init state required for X bookmark diff")
        return self.bookmarked_post_ids - self.init.bookmarked_post_ids

    def new_retweeted_post_ids(self) -> set[str]:
        if not self.has_init:
            raise ValueError("Init state required for X retweet diff")
        return self.retweeted_post_ids - self.init.retweeted_post_ids

    def new_user_post_ids(self) -> set[str]:
        if not self.has_init:
            raise ValueError("Init state required for X post index diff")
        return self.user_post_ids - self.init.user_post_ids

    def new_user_reply_ids(self) -> set[str]:
        if not self.has_init:
            raise ValueError("Init state required for X reply index diff")
        return self.user_reply_ids - self.init.user_reply_ids

    def new_messages_in_conversation(self, conversation_id: str) -> list[dict[str, Any]]:
        if not self.has_init:
            raise ValueError("Init state required for X conversation diff")

        current = self.find_conversation_by_id(conversation_id)
        initial = self.init.find_conversation_by_id(conversation_id)
        assert initial is not None, f"Conversation '{conversation_id}' not found in init state"
        assert current is not None, f"Conversation '{conversation_id}' not found in current state"

        current_messages = list(current.get("messages") or [])
        initial_messages = list(initial.get("messages") or [])
        return current_messages[len(initial_messages):]

    def _interaction_check(
        self,
        added_ids: set[str],
        *,
        keyword: str,
        field: str,
        action_label: str,
    ) -> dict[str, Any]:
        keyword_lower = str(keyword or "").lower().strip()
        assert keyword_lower, "keyword must not be empty"
        assert any(keyword_lower in str(post.get("content") or "").lower() for post in self.init.view_posts()), (
            f"Keyword '{keyword}' does not match any init X posts"
        )

        matched = [
            {"id": post.get("id"), "content": post.get("content")}
            for post in self.view_posts()
            if _normalize_id(post.get("id")) in added_ids
            and keyword_lower in str(post.get("content") or "").lower()
        ]
        return {
            "field": field,
            "expected": f"新增{action_label}的推文内容包含 {keyword!r}",
            "actual": matched or list(added_ids),
            "passed": bool(matched),
        }

    def check_new_post_contains(
        self,
        *keywords: str,
        field: str = "x_post",
    ) -> dict[str, Any]:
        actual = ""
        matched = False
        for post in self.new_posts_vs_init():
            text = str(post.get("content") or "")
            if all(keyword in text for keyword in keywords):
                actual = text
                matched = True
                break
        return {
            "field": field,
            "expected": f"new X post with {list(keywords)}",
            "actual": actual or "(none)",
            "passed": matched,
        }

    def check_created_quoted_post(
        self,
        post_id: str,
        content: str,
        *,
        field: str = "quoted_post_created",
    ) -> dict[str, Any]:
        target_post_id = _normalize_id(post_id)
        target_content = str(content or "").lower().strip()
        assert self.init.find_post_by_id(post_id) is not None, f"Post '{post_id}' not found in init state"
        assert target_content, "content must not be empty"

        matched = [
            {
                "id": post.get("id"),
                "quotedPostId": post.get("quotedPostId"),
                "content": post.get("content"),
            }
            for post in self.new_posts_vs_init()
            if _normalize_id(post.get("quotedPostId")) == target_post_id
            and target_content in str(post.get("content") or "").lower()
        ]
        return {
            "field": field,
            "expected": {"quotedPostId": post_id, "content_contains": content},
            "actual": matched or [
                {
                    "id": post.get("id"),
                    "quotedPostId": post.get("quotedPostId"),
                    "content": post.get("content"),
                }
                for post in self.new_posts_vs_init()
            ],
            "passed": bool(matched),
        }

    def check_sent_dm(
        self,
        conversation_id: str,
        content: str,
        *,
        field: str = "dm_sent",
    ) -> dict[str, Any]:
        target_content = str(content or "").strip()
        assert target_content, "content must not be empty"
        new_messages = self.new_messages_in_conversation(conversation_id)
        actual_tail = [message.get("content") for message in new_messages[-3:]]
        passed = bool(new_messages) and str(new_messages[-1].get("content") or "").strip() == target_content
        return {
            "field": field,
            "expected": target_content,
            "actual": actual_tail,
            "passed": passed,
        }

    def check_bookmarked_post_for_keyword(
        self,
        keyword: str,
        *,
        field: str = "bookmarked_post",
    ) -> dict[str, Any]:
        return self._interaction_check(
            self.new_bookmarked_post_ids(),
            keyword=keyword,
            field=field,
            action_label="书签",
        )

    def check_liked_post_for_keyword(
        self,
        keyword: str,
        *,
        field: str = "liked_post",
    ) -> dict[str, Any]:
        return self._interaction_check(
            self.new_liked_post_ids(),
            keyword=keyword,
            field=field,
            action_label="点赞",
        )

    def check_followed_user(
        self,
        user_handle: str,
        *,
        field: str = "followed_user",
    ) -> dict[str, Any]:
        user_id = self.init.find_user_id_by_handle(user_handle)
        assert user_id is not None, f"Handle '{user_handle}' not found in init state"
        normalized_user_id = _normalize_id(user_id)
        assert normalized_user_id not in self.init.followed_user_ids, (
            f"User '{user_handle}' was already followed in init state"
        )
        new_follows = self.new_followed_user_ids()
        return {
            "field": field,
            "expected": user_handle,
            "actual": list(new_follows),
            "passed": normalized_user_id in new_follows,
        }

    def check_liked_post_by_user(
        self,
        user_handle: str,
        *,
        field: str = "liked_post_by_user",
    ) -> dict[str, Any]:
        user_id = self.init.find_user_id_by_handle(user_handle)
        assert user_id is not None, f"Handle '{user_handle}' not found in init state"
        normalized_user_id = _normalize_id(user_id)

        matched = [
            {"id": post.get("id"), "content": post.get("content")}
            for post in self.view_posts()
            if _normalize_id(post.get("id")) in self.new_liked_post_ids()
            and _normalize_id(post.get("authorId")) == normalized_user_id
        ]
        return {
            "field": field,
            "expected": f"新增点赞来自 {user_handle}",
            "actual": matched or list(self.new_liked_post_ids()),
            "passed": bool(matched),
        }

    def check_replied_to_post(
        self,
        post_id: str,
        reply_content: str,
        *,
        field: str = "reply_created",
    ) -> dict[str, Any]:
        target_post_id = _normalize_id(post_id)
        target_content = str(reply_content or "").lower().strip()
        assert self.init.find_post_by_id(post_id) is not None, f"Post '{post_id}' not found in init state"
        assert target_content, "reply_content must not be empty"

        matched = [
            {"id": post.get("id"), "threadId": post.get("threadId"), "content": post.get("content")}
            for post in self.new_posts_vs_init()
            if _normalize_id(post.get("threadId")) == target_post_id
            and target_content in str(post.get("content") or "").lower()
        ]
        return {
            "field": field,
            "expected": {"threadId": post_id, "content_contains": reply_content},
            "actual": matched or [
                {"id": post.get("id"), "threadId": post.get("threadId"), "content": post.get("content")}
                for post in self.new_posts_vs_init()
            ],
            "passed": bool(matched),
        }

    def check_retweeted_post(
        self,
        post_id: str,
        *,
        field: str = "post_retweeted",
    ) -> dict[str, Any]:
        assert self.init.find_post_by_id(post_id) is not None, f"Post '{post_id}' not found in init state"
        new_retweets = self.new_retweeted_post_ids()
        return {
            "field": field,
            "expected": post_id,
            "actual": list(new_retweets),
            "passed": _normalize_id(post_id) in new_retweets,
        }

    def check_created_post(
        self,
        content: str,
        *,
        field: str = "post_created",
    ) -> dict[str, Any]:
        target_content = str(content or "").lower().strip()
        assert target_content, "content must not be empty"

        matched = [
            {"id": post.get("id"), "content": post.get("content")}
            for post in self.new_posts_vs_init()
            if not _normalize_id(post.get("threadId"))
            and target_content in str(post.get("content") or "").lower()
        ]
        return {
            "field": field,
            "expected": content,
            "actual": matched or [
                {"id": post.get("id"), "content": post.get("content")}
                for post in self.new_posts_vs_init()
                if not _normalize_id(post.get("threadId"))
            ],
            "passed": bool(matched),
        }

    def check_replied_to_new_post(
        self,
        original_content: str,
        reply_content: str,
        *,
        field: str = "reply_to_new_post",
    ) -> dict[str, Any]:
        original_lower = str(original_content or "").lower().strip()
        reply_lower = str(reply_content or "").lower().strip()
        assert original_lower, "original_content must not be empty"
        assert reply_lower, "reply_content must not be empty"

        new_top_level_posts = [
            post
            for post in self.new_posts_vs_init()
            if not _normalize_id(post.get("threadId"))
            and original_lower in str(post.get("content") or "").lower()
        ]
        if not new_top_level_posts:
            return {
                "field": field,
                "expected": {"original_content": original_content, "reply_content": reply_content},
                "actual": "原始新帖不存在",
                "passed": False,
            }

        original_post_id = _normalize_id(new_top_level_posts[0].get("id"))
        matched = [
            {"id": post.get("id"), "threadId": post.get("threadId"), "content": post.get("content")}
            for post in self.new_posts_vs_init()
            if _normalize_id(post.get("threadId")) == original_post_id
            and reply_lower in str(post.get("content") or "").lower()
        ]
        return {
            "field": field,
            "expected": {"original_content": original_content, "reply_content": reply_content},
            "actual": matched or [
                {"id": post.get("id"), "threadId": post.get("threadId"), "content": post.get("content")}
                for post in self.new_posts_vs_init()
                if _normalize_id(post.get("threadId")) == original_post_id
            ],
            "passed": bool(matched),
        }

    @staticmethod
    def _sample_post_reference_impl(
        env_state: dict[str, Any],
        rng: random.Random,
        *,
        exclude_retweeted: bool = False,
        profile_rank_limit: int = 40,
    ) -> dict[str, str]:
        app = X._from_env_state(env_state)
        posts = app.view_posts()
        if not posts:
            raise RuntimeError("未找到可采样的 X 推文目标")

        already_retweeted = app.retweeted_post_ids if exclude_retweeted else set()

        # Build per-author rank: only posts within the first `profile_rank_limit`
        # positions for their author are eligible — guarantees the post is visible
        # near the top of the author's profile page without heavy scrolling.
        author_rank: dict[str, int] = {}
        eligible: list[dict[str, Any]] = []
        for post in posts:
            pid = _normalize_id(post.get("id"))
            if not pid:
                continue
            if not str(post.get("content") or "").strip():
                continue
            if _normalize_id(post.get("threadId")):
                continue
            if pid in already_retweeted:
                continue
            author_id = str(post.get("authorId") or "")
            rank = author_rank.get(author_id, 0) + 1
            author_rank[author_id] = rank
            if rank <= profile_rank_limit:
                eligible.append(post)

        if not eligible:
            raise RuntimeError("未找到可采样的 X 推文目标")

        rng.shuffle(eligible)
        for post in eligible:
            author_handle = app.get_user_handle(str(post.get("authorId")))
            if author_handle == "@unknown":
                continue
            return {
                "post_id": str(post.get("id")),
                "author_handle": author_handle,
                "post_preview": _preview_text(post.get("content")),
            }

        raise RuntimeError("未找到可采样的 X 推文目标")

    @staticmethod
    def sample_post_reference(env_state: dict[str, Any], rng: random.Random) -> dict[str, str]:
        return X._sample_post_reference_impl(env_state, rng, exclude_retweeted=False)

    @staticmethod
    def sample_unretweeted_post_reference(
        env_state: dict[str, Any], rng: random.Random
    ) -> dict[str, str]:
        return X._sample_post_reference_impl(env_state, rng, exclude_retweeted=True)

    @staticmethod
    def sample_conversation_reference(env_state: dict[str, Any], rng: random.Random) -> dict[str, str]:
        app = X._from_env_state(env_state)
        candidates = []
        for conversation in app.conversations:
            conversation_id = str(conversation.get("id") or "").strip()
            participant_id = str(conversation.get("participantId") or "").strip()
            messages = list(conversation.get("messages") or [])
            handle = app.get_user_handle(participant_id)
            if not conversation_id or not messages or handle == "@unknown":
                continue
            candidates.append(
                {
                    "conversation_id": conversation_id,
                    "participant_handle": handle,
                    "last_message_preview": _preview_text(messages[-1].get("content"), limit=32),
                }
            )
        if not candidates:
            raise RuntimeError("未找到可采样的 X 私信会话")
        return rng.choice(candidates)

    @staticmethod
    def sample_search_keyword(env_state: dict[str, Any], rng: random.Random) -> dict[str, str]:
        app = X._from_env_state(env_state)
        keywords = []
        seen: set[str] = set()
        for post in app.view_posts():
            keyword = _pick_keyword(post.get("content"))
            keyword_lower = keyword.lower()
            if not keyword or keyword_lower in seen:
                continue
            seen.add(keyword_lower)
            keywords.append(keyword)
        if not keywords:
            raise RuntimeError("未找到可采样的 X 搜索关键词")
        return {"keyword": rng.choice(keywords)}

    @staticmethod
    def sample_search_keyword_pair(env_state: dict[str, Any], rng: random.Random) -> dict[str, str]:
        app = X._from_env_state(env_state)
        keywords = []
        seen: set[str] = set()
        for post in app.view_posts():
            keyword = _pick_keyword(post.get("content"))
            keyword_lower = keyword.lower()
            if not keyword or keyword_lower in seen:
                continue
            seen.add(keyword_lower)
            keywords.append(keyword)
            if len(keywords) >= 8:
                break
        if len(keywords) < 2:
            raise RuntimeError("未找到两个不同的 X 搜索关键词")
        picked = rng.sample(keywords, 2)
        return {"keyword1": picked[0], "keyword2": picked[1]}

    @staticmethod
    def sample_follow_target(env_state: dict[str, Any], rng: random.Random) -> dict[str, str]:
        app = X._from_env_state(env_state)
        followed = app.followed_user_ids
        handle_to_ids: dict[str, set[str]] = {}
        for uid, user_obj in app.users.items():
            if not isinstance(user_obj, dict):
                continue
            handle = _normalize_handle(user_obj.get("handle") or user_obj.get("screenName")).lower()
            if not handle:
                continue
            handle_to_ids.setdefault(handle, set()).add(_normalize_id(uid))

        posts = app.view_posts()
        if not posts:
            raise RuntimeError("未找到可采样的 X 关注目标")

        start = rng.randrange(len(posts))
        for offset in range(len(posts)):
            post = posts[(start + offset) % len(posts)]
            author_id = _normalize_id(post.get("authorId"))
            if not author_id or author_id in followed:
                continue
            user = app.find_user_by_id(author_id)
            if not user:
                continue
            handle = _normalize_handle(user.get("handle") or user.get("screenName"))
            canonical_handle = handle.lower()
            if not handle or canonical_handle in _AMBIGUOUS_HANDLES:
                continue
            if len(handle_to_ids.get(canonical_handle, set())) != 1:
                continue
            return {
                "user_handle": handle,
                "user_name": str(user.get("name") or "某位用户").strip() or "某位用户",
            }

        raise RuntimeError("未找到可采样的 X 关注目标")
