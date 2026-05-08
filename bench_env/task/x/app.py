"""
X (Twitter) app state accessor.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from bench_env.task.base import BaseApp


_X_DEFAULT_USERS: dict[str, dict[str, Any]] | None = None

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


def _load_default_x_users() -> dict[str, Any]:
    """
    加载 X 应用的默认用户表。
    """
    global _X_DEFAULT_USERS
    if _X_DEFAULT_USERS is not None:
        return _X_DEFAULT_USERS

    try:
        repo_root = Path(__file__).resolve().parents[3]
        users_path = repo_root / "apps" / "X" / "data" / "users.json"
        if users_path.exists():
            with users_path.open("r", encoding="utf-8") as f:
                users = json.load(f) or {}
                if isinstance(users, dict):
                    _X_DEFAULT_USERS = users  # type: ignore[assignment]
                    return _X_DEFAULT_USERS

        defaults_path = repo_root / "apps" / "X" / "data" / "defaults.json"
        with defaults_path.open("r", encoding="utf-8") as f:
            data = json.load(f) or {}
        users = data.get("xUsers") or {}
        _X_DEFAULT_USERS = users if isinstance(users, dict) else {}
    except Exception:
        _X_DEFAULT_USERS = {}
    return _X_DEFAULT_USERS


X_POST_CHANGES = ["x.posts"]


class X(BaseApp):
    """
    X state accessor.

    Usage:
        x = X(input.apps["x"])
        x.posts
        x.conversations
        x.users
    """

    @staticmethod
    def _from_env_state(env_state: dict[str, Any]) -> "X":
        return X(BaseApp.get_by_path(env_state, "apps.x", {}) or {})

    @property
    def posts(self) -> list[dict[str, Any]]:
        return self.get_list("posts")

    @property
    def conversations(self) -> list[dict[str, Any]]:
        return self.get_list("conversations")

    @property
    def users(self) -> dict[str, Any]:
        users = self.get("users") or {}
        if not users:
            users = _load_default_x_users()
        return users

    @property
    def followed_user_ids(self) -> set[str]:
        return {_normalize_id(uid) for uid in (self.get("followedUserIds") or []) if _normalize_id(uid)}

    @property
    def liked_post_ids(self) -> set[str]:
        return {_normalize_id(pid) for pid in (self.get("likedPostIds") or []) if _normalize_id(pid)}

    @property
    def bookmarked_post_ids(self) -> set[str]:
        return {_normalize_id(pid) for pid in (self.get("bookmarkedPostIds") or []) if _normalize_id(pid)}

    @property
    def retweeted_post_ids(self) -> set[str]:
        return {_normalize_id(pid) for pid in (self.get("retweetedPostIds") or []) if _normalize_id(pid)}

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
        target = _normalize_id(post_id)
        return next((post for post in self.posts if _normalize_id(post.get("id")) == target), None)

    def find_conversation_by_id(self, conversation_id: str) -> dict[str, Any] | None:
        target = _normalize_id(conversation_id)
        return next(
            (conversation for conversation in self.conversations if _normalize_id(conversation.get("id")) == target),
            None,
        )

    def new_posts_vs_init(self) -> list[dict[str, Any]]:
        if not self.has_init:
            raise ValueError("Init state required for X post diff")
        new_ids = self.get_new_ids(self.posts, self.init.posts)
        return [post for post in self.posts if _normalize_id(post.get("id")) in new_ids]

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
        assert any(keyword_lower in str(post.get("content") or "").lower() for post in self.init.posts), (
            f"Keyword '{keyword}' does not match any init X posts"
        )

        matched = [
            {"id": post.get("id"), "content": post.get("content")}
            for post in self.posts
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
            for post in self.posts
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
        posts = app.posts
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
        for post in app.posts:
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
        for post in app.posts:
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

        posts = app.posts
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
