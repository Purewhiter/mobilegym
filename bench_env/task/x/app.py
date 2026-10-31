"""
X (Twitter) app state accessor.

Posts and users as the user sees them (catalog plus this state's posts,
edits, likes, retweets and replies) come from the device server's X module
through `DeviceView`; this file never merges catalog and state itself.
"""

from __future__ import annotations

import random
from functools import cached_property
from typing import Any

from bench_env.env.device_view import DeviceView
from bench_env.task.base import BaseApp


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

    @cached_property
    def device(self) -> DeviceView:
        """This state as the device server's X module sees it."""
        return DeviceView("x", self.raw)

    def state_post(self, post_id: str) -> dict[str, Any] | None:
        value = self.state_posts.get(post_id)
        return value if isinstance(value, dict) else None

    def state_post_entities(self) -> list[dict[str, Any]]:
        return [post for post in self.state_posts.values() if isinstance(post, dict)]

    def view_post(self, post_id: str) -> dict[str, Any] | None:
        """A post as the user sees it (``None`` when absent or deleted)."""
        return self.device.query("viewPost", {"id": str(post_id)})

    def view_posts(self) -> list[dict[str, Any]]:
        """Every visible post: this state's posts first, then the catalog."""
        return self.device.query("viewPosts")

    @property
    def conversations(self) -> list[dict[str, Any]]:
        return self.get_list("conversations")

    @cached_property
    def users(self) -> dict[str, Any]:
        """Catalog users plus the current user, by id."""
        return self.device.query("viewUsers")

    @property
    def followed_user_ids(self) -> set[str]:
        return {uid for uid in (self.state_user().get("followedUserIds") or []) if uid}

    @property
    def liked_post_ids(self) -> set[str]:
        return {pid for pid in (self.state_user().get("likedPostIds") or []) if pid}

    @property
    def bookmarked_post_ids(self) -> set[str]:
        return {pid for pid in (self.state_user().get("bookmarkedPostIds") or []) if pid}

    @property
    def retweeted_post_ids(self) -> set[str]:
        return {pid for pid in (self.state_user().get("retweetedPostIds") or []) if pid}

    @property
    def user_post_ids(self) -> set[str]:
        return {pid for pid in (self.state_user().get("postIds") or []) if pid}

    @property
    def user_reply_ids(self) -> set[str]:
        return {pid for pid in (self.state_user().get("replyIds") or []) if pid}

    def get_new_ids(self, now_list: list[dict[str, Any]], init_list: list[dict[str, Any]]) -> set[str]:
        init_ids = {item.get("id") for item in init_list if item.get("id")}
        return {
            item.get("id")
            for item in now_list
            if item.get("id") and item.get("id") not in init_ids
        }

    def find_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        return self.users.get(user_id)

    def get_user_handle(self, user_id: str) -> str:
        """返回 @-prefixed handle (data contract: user.id 不带 @, handle = '@' + id)。"""
        if not self.find_user_by_id(user_id):
            return "@unknown"
        return f"@{user_id}"

    def find_user_id_by_handle(self, handle: str) -> str | None:
        """传入 '@xxx' 或 'xxx'; 返回 user.id (不带 @)。Case-sensitive 精确匹配。"""
        if not isinstance(handle, str):
            return None
        target = handle.lstrip("@")
        return target if target and target in self.users else None

    def find_post_by_id(self, post_id: str) -> dict[str, Any] | None:
        return self.view_post(post_id)

    def find_conversation_by_id(self, conversation_id: str) -> dict[str, Any] | None:
        return next(
            (c for c in self.conversations if c.get("id") == conversation_id),
            None,
        )

    def new_posts_vs_init(self) -> list[dict[str, Any]]:
        if not self.has_init:
            raise ValueError("Init state required for X post diff")
        current_posts = self.state_post_entities()
        init_posts = self.init.state_post_entities()
        new_ids = self.get_new_ids(current_posts, init_posts)
        new_ids -= set(self.device.query("catalogPostIds", {"ids": sorted(i for i in new_ids if i)}))
        new_post_ids = self.new_user_post_ids()
        new_reply_ids = self.new_user_reply_ids()
        out: list[dict[str, Any]] = []
        for post in current_posts:
            post_id = post.get("id")
            if post_id not in new_ids:
                continue
            if post.get("threadId"):
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
            if post.get("id") in added_ids
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
        target_post_id = post_id
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
            if post.get("quotedPostId") == target_post_id
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
        me_user_id = str(self.get("user.id") or "")
        new_messages = self.new_messages_in_conversation(conversation_id)
        actual_tail = [
            {"senderId": message.get("senderId"), "content": message.get("content")}
            for message in new_messages[-3:]
        ]
        # 必须是当前用户发的, 且最后一条内容匹配。避免对方刚好发了同样文本时巧合 pass。
        last = new_messages[-1] if new_messages else None
        passed = bool(last) \
            and str(last.get("senderId") or "") == me_user_id \
            and str(last.get("content") or "").strip() == target_content
        return {
            "field": field,
            "expected": {"senderId": me_user_id, "content": target_content},
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
        assert user_id not in self.init.followed_user_ids, (
            f"User '{user_handle}' was already followed in init state"
        )
        new_follows = self.new_followed_user_ids()
        return {
            "field": field,
            "expected": user_handle,
            "actual": list(new_follows),
            "passed": user_id in new_follows,
        }

    def check_liked_post_by_user(
        self,
        user_handle: str,
        *,
        field: str = "liked_post_by_user",
    ) -> dict[str, Any]:
        user_id = self.init.find_user_id_by_handle(user_handle)
        assert user_id is not None, f"Handle '{user_handle}' not found in init state"

        matched = [
            {"id": post.get("id"), "content": post.get("content")}
            for post in self.view_posts()
            if post.get("id") in self.new_liked_post_ids()
            and post.get("authorId") == user_id
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
        target_post_id = post_id
        target_content = str(reply_content or "").lower().strip()
        assert self.init.find_post_by_id(post_id) is not None, f"Post '{post_id}' not found in init state"
        assert target_content, "reply_content must not be empty"

        matched = [
            {"id": post.get("id"), "threadId": post.get("threadId"), "content": post.get("content")}
            for post in self.new_posts_vs_init()
            if post.get("threadId") == target_post_id
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
            "passed": post_id in new_retweets,
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
            if not post.get("threadId")
            and target_content in str(post.get("content") or "").lower()
        ]
        return {
            "field": field,
            "expected": content,
            "actual": matched or [
                {"id": post.get("id"), "content": post.get("content")}
                for post in self.new_posts_vs_init()
                if not post.get("threadId")
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
            if not post.get("threadId")
            and original_lower in str(post.get("content") or "").lower()
        ]
        if not new_top_level_posts:
            return {
                "field": field,
                "expected": {"original_content": original_content, "reply_content": reply_content},
                "actual": "原始新帖不存在",
                "passed": False,
            }

        original_post_id = new_top_level_posts[0].get("id")
        matched = [
            {"id": post.get("id"), "threadId": post.get("threadId"), "content": post.get("content")}
            for post in self.new_posts_vs_init()
            if post.get("threadId") == original_post_id
            and reply_lower in str(post.get("content") or "").lower()
        ]
        return {
            "field": field,
            "expected": {"original_content": original_content, "reply_content": reply_content},
            "actual": matched or [
                {"id": post.get("id"), "threadId": post.get("threadId"), "content": post.get("content")}
                for post in self.new_posts_vs_init()
                if post.get("threadId") == original_post_id
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
            pid = post.get("id")
            if not pid:
                continue
            if not str(post.get("content") or "").strip():
                continue
            if post.get("threadId"):
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
        """
        从可见 post 池里收集 "未关注 + 有 handle" 的作者作为候选, 均匀随机抽一个。
        要求未关注是因为任务模板是 "先关注 X 再点赞", check_followed_user 查
        new_followed_user_ids 增量, 已关注的用户无法形成增量。
        """
        app = X._from_env_state(env_state)
        followed = app.followed_user_ids

        candidates: list[dict[str, str]] = []
        seen_authors: set[str] = set()
        for post in app.view_posts():
            author_id = post.get("authorId")
            if not author_id or author_id in followed or author_id in seen_authors:
                continue
            seen_authors.add(author_id)
            user = app.find_user_by_id(author_id)
            if not user:
                continue
            candidates.append({
                "user_handle": f"@{author_id}",
                "user_name": str(user.get("name") or "某位用户").strip() or "某位用户",
            })

        if not candidates:
            raise RuntimeError("未找到可采样的 X 关注目标")
        return rng.choice(candidates)
