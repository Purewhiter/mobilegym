"""
Reddit app state accessor.
"""

from __future__ import annotations

import re
from typing import Any

from bench_env.task.base import BaseApp
from bench_env.task.utils import norm


def _post_text(post: dict[str, Any]) -> str:
    title = str(post.get("title", "") or "").strip()
    content = str(post.get("content", "") or "").strip()
    return f"{title}\n{content}".strip()


def _normalize_match_text(text: str) -> str:
    return re.sub(r"\s+", " ", norm(text)).strip()


class Reddit(BaseApp):
    """
    Reddit state accessor.

    Usage:
        reddit = Reddit(input.apps["reddit"])
        reddit.posts
    """

    # ---- 采样 ----

    @staticmethod
    def sample_deletable_chat_pair(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        """采样一对 (username, seed_message)：from=me 的聊天消息。"""
        threads = env_state["apps"]["reddit"]["chatThreadsByUsername"]
        candidates: list[tuple[str, str]] = []
        for username, msgs in threads.items():
            for m in msgs:
                if m["from"] == "me":
                    candidates.append((username, m["body"]))
        if not candidates:
            raise ValueError("Reddit state 中不存在 from=me 的聊天消息，无法采样")
        u, body = rng.choice(candidates)
        return {"username": u, "seed_message": body}

    # ---- 数据方法 ----

    def find_my_chat_message(self, username: str, body: str) -> dict[str, Any]:
        """在 chatThreadsByUsername[username] 中查找 from=me & body 匹配的消息。"""
        for m in self.raw["chatThreadsByUsername"][username]:
            if m["from"] == "me" and m["body"].strip() == body.strip():
                return m
        raise ValueError(f"chatThreadsByUsername[{username}] 中未找到 body={body!r} 的消息")

    def find_user_post_by_title(self, title: str) -> dict[str, Any]:
        """在 userPosts 中按标题查找帖子。"""
        for p in self.user_posts:
            if p["title"] == title:
                return p
        raise ValueError(f"userPosts 中未找到 title={title!r} 的帖子")

    # ---- check 方法 ----

    def check_chat_message_deleted(
        self, username: str, message_id: str, *, field: str = "chat_message_deleted",
    ) -> dict[str, Any]:
        """验证指定 ID 的聊天消息是否已被删除。"""
        msgs = self.raw["chatThreadsByUsername"].get(username, [])
        still_exists = any(m["id"] == message_id for m in msgs)
        return {
            "field": field,
            "expected": f"{username}/{message_id} deleted",
            "actual": "exists" if still_exists else "deleted",
            "passed": not still_exists,
        }

    def check_post_deleted(
        self, post_id: str, *, field: str = "post_deleted",
    ) -> dict[str, Any]:
        """验证指定 ID 的帖子是否已从 posts 和 userPosts 中删除。"""
        in_posts = any(p["id"] == post_id for p in self.posts)
        in_user_posts = any(p["id"] == post_id for p in self.user_posts)
        return {
            "field": field,
            "expected": f"post {post_id} deleted",
            "actual": {"in_posts": in_posts, "in_user_posts": in_user_posts},
            "passed": not in_posts and not in_user_posts,
        }

    @property
    def posts(self) -> list[dict[str, Any]]:
        return self.get_list("posts")

    @property
    def user_posts(self) -> list[dict[str, Any]]:
        return self.get_list("userPosts")

    @property
    def user_comments_by_post_id(self) -> dict[str, list[dict[str, Any]]]:
        return self.get("userCommentsByPostId", {}) or {}

    def new_posts(self) -> list[dict[str, Any]]:
        init_posts = self.init.get("userPosts", []) if self.init else []
        init_ids = {
            str(post.get("id"))
            for post in init_posts
            if isinstance(post, dict) and post.get("id") is not None
        }
        return [
            post
            for post in self.user_posts
            if isinstance(post, dict) and str(post.get("id")) not in init_ids
        ]

    def check_new_post_contains(
        self,
        *keywords: str,
        subreddit: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        if field is None:
            field = "reddit.new_post"
        target_subreddit = str(subreddit).strip() if subreddit is not None else None
        matched = None
        for post in self.new_posts():
            post_subreddit = str(post.get("subreddit", "") or "").strip()
            if target_subreddit is not None and post_subreddit != target_subreddit:
                continue
            text = _post_text(post)
            if all(keyword in text for keyword in keywords):
                matched = post
                break
        actual = _post_text(matched) if matched else "(none)"
        return {
            "field": field,
            "expected": {
                "subreddit": target_subreddit,
                "contains": list(keywords),
            },
            "actual": actual[:240],
            "passed": matched is not None,
        }

    def check_new_post_in_subreddit_contains(
        self,
        subreddit: str,
        *keywords: str,
        field: str | None = None,
    ) -> dict[str, Any]:
        """便利方法：subreddit 作为位置参数 + 自动生成 field。
        等价于 ``check_new_post_contains(*keywords, subreddit=subreddit)``。
        """
        if field is None:
            field = f"reddit.new_post.{subreddit}"
        return self.check_new_post_contains(
            *keywords,
            subreddit=subreddit,
            field=field,
        )

    def check_new_post_title_body_in_subreddit(
        self,
        subreddit: str,
        title_keyword: str,
        body_keyword: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """分字段校验：title_keyword 必须出现在帖子标题，body_keyword 必须出现在帖子正文。
        大小写不敏感。
        """
        if field is None:
            field = f"reddit.new_post.{subreddit}"
        target_subreddit = str(subreddit).strip()
        matched = None
        for post in self.new_posts():
            post_subreddit = str(post.get("subreddit", "") or "").strip()
            if post_subreddit != target_subreddit:
                continue
            post_title = str(post.get("title", "") or "").lower()
            post_content = str(post.get("content", "") or "").lower()
            if title_keyword.lower() in post_title and body_keyword.lower() in post_content:
                matched = post
                break
        actual = _post_text(matched) if matched else "(none)"
        return {
            "field": field,
            "expected": {
                "subreddit": target_subreddit,
                "title_contains": title_keyword,
                "body_contains": body_keyword,
            },
            "actual": actual[:240],
            "passed": matched is not None,
        }

    def check_new_post_or_comment_contains(
        self,
        *keywords: str,
        subreddit: str | None = None,
        field: str | None = None,
        normalize_match: bool = False,
    ) -> dict[str, Any]:
        if field is None:
            field = "reddit.new_post_or_comment"
        target_subreddit = str(subreddit or "").strip().lower().removeprefix("r/")

        def _subreddit_matches(value: str) -> bool:
            if not target_subreddit:
                return True
            return str(value or "").strip().lower().removeprefix("r/") == target_subreddit

        def _text_matches(text: str) -> bool:
            if normalize_match:
                normalized_text = _normalize_match_text(text)
                return all(
                    _normalize_match_text(keyword) in normalized_text
                    for keyword in keywords
                )
            return all(keyword in text for keyword in keywords)

        matched_text = ""
        for post in self.new_posts():
            if not _subreddit_matches(str(post.get("subreddit") or "")):
                continue
            text = _post_text(post)
            if _text_matches(text):
                matched_text = text
                break

        if not matched_text:
            init_map = self.init.get("userCommentsByPostId", {}) or {} if self.has_init else {}
            for post in self.posts:
                if not _subreddit_matches(str((post or {}).get("subreddit") or "")):
                    continue
                post_id = str((post or {}).get("id") or "")
                init_ids = {
                    str((comment or {}).get("id") or "")
                    for comment in (init_map.get(post_id) or [])
                    if isinstance(comment, dict)
                }
                for comment in self.user_comments_by_post_id.get(post_id) or []:
                    if not isinstance(comment, dict):
                        continue
                    comment_id = str(comment.get("id") or "")
                    if comment_id in init_ids:
                        continue
                    body = str(comment.get("body") or "")
                    if _text_matches(body):
                        matched_text = body
                        break
                if matched_text:
                    break

        return {
            "field": field,
            "expected": {
                "subreddit": subreddit,
                "contains": list(keywords),
            },
            "actual": matched_text[:240] if matched_text else "(none)",
            "passed": bool(matched_text),
        }
