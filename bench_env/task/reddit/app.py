"""
Reddit app state accessor.
"""

from __future__ import annotations

import re
import json
from functools import cached_property, lru_cache
from pathlib import Path
from typing import Any

from bench_env.task.base import BaseApp
from bench_env.task.utils import norm

_REDDIT_DATA_DIR = Path(__file__).resolve().parents[3] / "apps" / "Reddit" / "data"
_POSTS_JSON = _REDDIT_DATA_DIR / "posts.json"

REDDIT_CHAT_THREADS_CHANGES = ["chatThreads"]
REDDIT_CHAT_REPLIES_CHANGES = ["chatReplies"]
REDDIT_COMMENT_CREATE_CHANGES = ["comments", "user.commentIds"]
# deleteOwnComment 会同步清理被删评论上自己投过的票（state.ts:223-252），
# 因此 delete 的 fence 必须覆盖 user.commentVotes，否则一旦 init 含自投票即误判。
REDDIT_COMMENT_DELETE_CHANGES = ["comments", "user.commentIds", "user.commentVotes"]
REDDIT_COMMENT_UPDATE_CHANGES = ["comments"]
REDDIT_COMMENT_VOTE_CHANGES = ["user.commentVotes"]
REDDIT_JOIN_AND_POST_VOTE_CHANGES = ["user.joinedCommunityIds", "user.postVotes"]
REDDIT_POST_DELETE_CHANGES = ["posts", "user.postIds"]
REDDIT_POST_CREATE_CHANGES = ["posts", "user.postIds", "user.postVotes"]
REDDIT_POST_VOTE_CHANGES = ["user.postVotes"]
REDDIT_PROFILE_BIO_CHANGES = ["user.bio"]
REDDIT_SETTINGS_CHANGES = ["settings"]
REDDIT_DEEP_THREAD_REPLY_AND_DELETE_CHANGES = REDDIT_CHAT_REPLIES_CHANGES + REDDIT_CHAT_THREADS_CHANGES


@lru_cache(maxsize=1)
def load_reddit_posts() -> list[dict[str, Any]]:
    data = json.loads(_POSTS_JSON.read_text(encoding="utf-8"))
    posts = data.get("posts", []) if isinstance(data, dict) else data
    return posts if isinstance(posts, list) else []


@lru_cache(maxsize=1)
def _base_posts_by_id() -> dict[str, dict[str, Any]]:
    return {
        str(post["id"]): post
        for post in load_reddit_posts()
        if isinstance(post, dict) and post.get("id") is not None
    }


@lru_cache(maxsize=1)
def _base_comments_by_id() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for post in load_reddit_posts():
        if not isinstance(post, dict) or post.get("id") is None:
            continue
        post_id = str(post["id"])
        comments = post.get("commentsData") or []
        if not isinstance(comments, list):
            continue
        for comment in comments:
            if isinstance(comment, dict) and comment.get("id") is not None:
                out[str(comment["id"])] = {**comment, "postId": post_id}
    return out


def interleave_by_subreddit(posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for post in posts:
        key = str(post.get("subreddit") or "unknown")
        groups.setdefault(key, []).append(post)
    out: list[dict[str, Any]] = []
    keys = sorted(groups)
    added = True
    while added:
        added = False
        for key in keys:
            items = groups.get(key) or []
            if not items:
                continue
            out.append(items.pop(0))
            added = True
    return out


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
        reddit.view_posts_list()
    """

    # ---- 采样 ----

    @staticmethod
    def sample_deletable_chat_pair(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        """采样一对 (username, seed_message)：from=me 的聊天消息。"""
        threads = env_state["apps"]["reddit"]["chatThreads"]
        candidates: list[tuple[str, str]] = []
        for username, msgs in threads.items():
            for m in msgs:
                if m["from"] == "me":
                    candidates.append((username, m["body"]))
        if not candidates:
            raise ValueError("Reddit state 中不存在 from=me 的聊天消息，无法采样")
        u, body = rng.choice(candidates)
        return {"username": u, "seed_message": body}

    @staticmethod
    def sample_deep_thread_reply_and_delete_pair(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        """采样一组深层聊天任务参数：对方消息用于回复，己方消息用于删除。"""
        threads = env_state["apps"]["reddit"]["chatThreads"]
        candidates: list[dict[str, Any]] = []
        for username, msgs in threads.items():
            if not isinstance(msgs, list):
                continue
            source = next((m for m in msgs if isinstance(m, dict) and m.get("from") == "them"), None)
            delete = next((m for m in msgs if isinstance(m, dict) and m.get("from") == "me"), None)
            if not source or not delete:
                continue
            if source.get("id") is None or delete.get("id") is None:
                continue
            candidates.append({
                "username": str(username),
                "thread_source_message_id": str(source["id"]),
                "thread_seed_message": str(source.get("body", "")),
                "delete_message_id": str(delete["id"]),
                "delete_seed_message": str(delete.get("body", "")),
            })
        if not candidates:
            raise ValueError("Reddit state 中不存在可用于 deep thread reply/delete 的聊天对，无法采样")
        return rng.choice(candidates) if rng is not None else candidates[0]

    @staticmethod
    def sample_home_feed_post_rank_15(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        """
        Pick the fixture post at rank 15 (1-based) of the interleaved fixture feed.

        HomePage.tsx renders `posts.slice(0, displayCount)` where displayCount
        initial value is 20. 默认 state 还会把 user.postIds 里的 my_post_1 插到
        fixture posts 前面，因此该 fixture rank 15 在真实首页 UI 中通常是第 16 条；
        仍然落在初始 20 条窗口内，需要 Agent 滚动一段。Returns the post at that
        fixed fixture rank（fixture 不足时回退到最后一个）。
        """
        posts = interleave_by_subreddit(load_reddit_posts())
        if not posts:
            raise RuntimeError("任务设计错误：Reddit fixture posts 为空，无法采样首页帖子")

        feed_rank = min(15, len(posts))
        post = posts[feed_rank - 1]

        return {
            "feed_rank": feed_rank,
            "post_id": str(post["id"]),
            "post_title": str(post["title"]),
        }

    @staticmethod
    def fixture_post(index: int = 0) -> dict[str, Any]:
        posts = load_reddit_posts()
        if not posts:
            raise RuntimeError("任务设计错误：Reddit fixture posts 为空")
        return posts[index]

    @staticmethod
    def sample_fixture_post(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        """采样一个 base fixture 帖子作为评论/操作目标，返回 (post_id, post_title)。"""
        post = Reddit.fixture_post()
        return {"post_id": str(post["id"]), "post_title": str(post["title"])}

    # ---- setup helpers ----

    @staticmethod
    def prepare_seeded_comment(
        comment_id: str,
        post_id: str,
        author: str,
        body: str,
        *,
        score: int = 1,
        created_utc: int = 1710000000,
    ) -> dict[str, Any]:
        """构造标准 seeded comment dict，符合 reddit.comments 表的 schema。"""
        return {
            "id": comment_id,
            "postId": post_id,
            "author": author,
            "body": body,
            "score": score,
            "created_utc": created_utc,
        }

    def prepare_state_with_seeded_comment(
        self,
        comment_id: str,
        post_id: str,
        body: str,
        *,
        created_utc: int = 1710000000,
    ) -> dict[str, Any]:
        """返回注入 seeded comment 后的新 reddit state。

        若 comment_id 已存在则原样返回（幂等）。仅按 id 判重——不要再用 body
        子串匹配，否则用户先前留过包含相同子串的评论会让 _prepare 静默跳过，
        导致后续 check_deleted_comment / check_comment_body_contains 找不到目标。
        """
        author = str(self.user["username"])
        if comment_id in self.state_comments:
            return self.raw

        comment_ids = list(self.user["commentIds"])
        next_comments = {
            **self.state_comments,
            comment_id: self.prepare_seeded_comment(
                comment_id,
                post_id,
                author,
                body,
                created_utc=created_utc,
            ),
        }
        next_user = {
            **self.user,
            "commentIds": comment_ids if comment_id in comment_ids else [*comment_ids, comment_id],
        }
        return {**self.raw, "comments": next_comments, "user": next_user}

    # ---- 数据方法 ----

    @cached_property
    def chat_threads(self) -> dict[str, list[dict[str, Any]]]:
        value = self.get("chatThreads", {}) or {}
        return value if isinstance(value, dict) else {}

    @cached_property
    def chat_replies(self) -> dict[str, list[dict[str, Any]]]:
        value = self.get("chatReplies", {}) or {}
        return value if isinstance(value, dict) else {}

    # ---- 对比层（init vs current diff helpers）----

    def new_posts(self) -> list[dict[str, Any]]:
        """返回 current.user.postIds 中相对 init 新增的帖子实体列表。"""
        init_ids = {str(pid) for pid in self.init.user.get("postIds", [])}
        out: list[dict[str, Any]] = []
        for pid in self.user.get("postIds", []):
            post_id = str(pid)
            if post_id in init_ids:
                continue
            post = self.view_post(post_id)
            if isinstance(post, dict):
                out.append(post)
        return out

    def new_comments(self) -> list[dict[str, Any]]:
        """返回 current.comments 中相对 init 新增的评论实体列表。"""
        init_ids = {str(cid) for cid in self.init.state_comments.keys()}
        out: list[dict[str, Any]] = []
        for cid, comment in self.state_comments.items():
            if str(cid) not in init_ids and isinstance(comment, dict):
                out.append(comment)
        return out

    def new_chat_messages_to(self, username: str) -> list[dict[str, Any]]:
        """返回 current 中 username 线程比 init 新增的消息列表（按顺序）。"""
        init_ids = {m["id"] for m in self.init.chat_threads.get(username, [])}
        current = self.chat_threads.get(username, [])
        return [m for m in current if m["id"] not in init_ids]

    def new_chat_replies(self, username: str, source_id: str) -> list[dict[str, Any]]:
        """返回 current 中对 source_id 消息的新增回复列表。"""
        thread_key = f"{username}:{source_id}"
        init_ids = {m["id"] for m in self.init.chat_replies.get(thread_key, [])}
        current = self.chat_replies.get(thread_key, [])
        return [m for m in current if m["id"] not in init_ids]

    def new_joined_communities(self) -> list[str]:
        """返回 current 相对 init 新加入的社区 id 列表。"""
        init_ids = set(self.init.user.get("joinedCommunityIds", []))
        return [c for c in self.user.get("joinedCommunityIds", []) if c not in init_ids]

    def new_post_upvotes(self) -> list[str]:
        """返回 current 相对 init 新 upvote 的帖子 id 列表。"""
        init_votes = self.init.user.get("postVotes", {}) or {}
        current_votes = self.user.get("postVotes", {}) or {}
        return [
            str(pid)
            for pid, vote in current_votes.items()
            if vote == "up" and init_votes.get(str(pid)) != "up"
        ]

    def new_comment_upvotes(self) -> list[str]:
        """返回 current 相对 init 新 upvote 的 comment id 列表。"""
        init_votes = self.init.user.get("commentVotes", {}) or {}
        current_votes = self.user.get("commentVotes", {}) or {}
        out: list[str] = []
        for key, vote in current_votes.items():
            if vote != "up" or init_votes.get(str(key)) == "up":
                continue
            out.append(str(key).rsplit(":", 1)[-1])
        return out

    def removed_chat_message_ids(self, username: str) -> list[str]:
        """返回 init 中存在、current 中已消失的消息 id 列表。"""
        init_ids = [m["id"] for m in self.init.chat_threads.get(username, [])]
        current_ids = {m["id"] for m in self.chat_threads.get(username, [])}
        return [message_id for message_id in init_ids if message_id not in current_ids]

    def removed_post_ids(self) -> list[str]:
        """返回 init.user.postIds 中存在、current 中已消失的帖子 id 列表。"""
        init_ids = [str(pid) for pid in self.init.user.get("postIds", [])]
        current_ids = {str(pid) for pid in self.user.get("postIds", [])}
        return [post_id for post_id in init_ids if post_id not in current_ids]

    def removed_comment_ids(self) -> list[str]:
        """返回 init comments 中存在、current 中已消失的 comment id 列表。"""
        init_ids = [str(cid) for cid in self.init.state_comments.keys()]
        current_ids = {str(cid) for cid in self.state_comments.keys()}
        return [comment_id for comment_id in init_ids if comment_id not in current_ids]

    def find_my_chat_message(self, username: str, body: str) -> dict[str, Any]:
        """在 chatThreads[username] 中查找 from=me & body 精确匹配的消息。"""
        for m in self.chat_threads[username]:
            if m["from"] == "me" and m["body"].strip() == body.strip():
                return m
        raise ValueError(f"chatThreads[{username}] 中未找到 body={body!r} 的 from=me 消息")

    def find_chat_message(self, username: str, body_text: str) -> dict[str, Any]:
        """在 chatThreads[username] 中按 body 子串（大小写不敏感）查找消息，返回第一条匹配。
        不限 from（与 find_my_chat_message 的 from=me 精确匹配互补）。"""
        needle = body_text.strip().lower()
        for m in self.chat_threads[username]:
            if needle in m["body"].strip().lower():
                return m
        raise ValueError(f"chatThreads[{username}] 中未找到 body 包含 {body_text!r} 的消息")

    def find_user_post_by_title(self, title: str) -> dict[str, Any]:
        """在 posts 实体表中按标题查找帖子。"""
        for pid in self.user["postIds"]:
            p = self.state_post(str(pid))
            if isinstance(p, dict) and p["title"] == title:
                return p
        raise ValueError(f"posts 中未找到 title={title!r} 的帖子")

    # ---- 检查层（CRUD 对齐：增/删 走 diff helper，改 走 init→find→current→verify）----
    # 内含 sampler 契约 assert（失败 → judge_error，避免冤枉 Agent）

    # ---- 删（Delete）----

    def check_deleted_chat_message(
        self, username: str, message_id: str, *, field: str | None = None,
    ) -> dict[str, Any]:
        """验证 Agent 从 chatThreads[username] 中删除了 message_id。"""
        init_ids = {m["id"] for m in self.init.chat_threads.get(username, [])}
        assert message_id in init_ids, \
            f"sampler 契约违反：init.chatThreads[{username}] 中未找到 message_id={message_id}"
        if field is None:
            field = f"reddit.chatThreads.{username}.deleted.{message_id}"
        removed = self.removed_chat_message_ids(username)
        return {
            "field": field,
            "expected": f"删除 {username}/{message_id}",
            "actual": {"removed_ids": removed},
            "passed": message_id in removed,
        }

    def check_deleted_post(self, post_id: str, *, field: str | None = None) -> dict[str, Any]:
        """验证 Agent 从 user.postIds 中删除了 post_id（仅支持删除自己的帖子）。"""
        assert str(post_id) in self.init.user["postIds"], \
            f"sampler 契约违反：init.user.postIds 中未找到 post_id={post_id}（只能删除自己的帖子）"
        if field is None:
            field = f"reddit.posts.{post_id}.deleted"
        removed = self.removed_post_ids()
        return {
            "field": field,
            "expected": f"删除 post {post_id}",
            "actual": {"removed_ids": list(removed)},
            "passed": str(post_id) in removed,
        }

    def check_deleted_comment(self, comment_id: str, *, field: str | None = None) -> dict[str, Any]:
        """验证 Agent 从 user.commentIds 和 state.comments 中删除了 comment_id。"""
        assert comment_id in self.init.state_comments, \
            f"sampler 契约违反：init.comments 中未找到 comment_id={comment_id}"
        if field is None:
            field = f"reddit.comments.{comment_id}.deleted"
        removed_from_comments = comment_id in self.removed_comment_ids()
        in_user_comment_ids = comment_id in {str(cid) for cid in self.user.get("commentIds", [])}
        return {
            "field": field,
            "expected": f"删除 comment {comment_id}",
            "actual": {
                "in_comments": not removed_from_comments,
                "in_user_comment_ids": in_user_comment_ids,
            },
            "passed": removed_from_comments and not in_user_comment_ids,
        }

    # ---- 增（Create）----

    def check_new_post_upvote(self, post_id: str, *, field: str | None = None) -> dict[str, Any]:
        """验证 Agent 对 post_id 投了 'up' 票（init 时未投或非 up）。"""
        assert self.init.view_post(str(post_id)) is not None, \
            f"sampler 契约违反：init 中未找到 post_id={post_id}"
        init_vote = self.init.user.get("postVotes", {}).get(str(post_id))
        assert init_vote != "up", \
            f"sampler 契约违反：init.user.postVotes[{post_id}] 已是 'up'（无法验证新 upvote 操作）"
        if field is None:
            field = f"reddit.postVotes.{post_id}"
        new = self.new_post_upvotes()
        return {
            "field": field,
            "expected": f"对 post {post_id} 投 'up' 票",
            "actual": {"new_upvotes": list(new)},
            "passed": str(post_id) in new,
        }

    def check_joined_community(self, community: str, *, field: str | None = None) -> dict[str, Any]:
        """验证 Agent 加入了 community（subreddit 名，如 'r/memes'）。"""
        assert community not in self.init.user["joinedCommunityIds"], \
            f"sampler 契约违反：init.user.joinedCommunityIds 中已包含 {community}（无法验证加入操作）"
        if field is None:
            field = f"reddit.joinedCommunityIds.{community}"
        new = self.new_joined_communities()
        return {
            "field": field,
            "expected": f"加入 {community}",
            "actual": {"new_joined": list(new)},
            "passed": community in new,
        }

    def check_new_post_upvote_in_subreddit(
        self, community: str, *, field: str | None = None,
    ) -> dict[str, Any]:
        """验证 Agent 对 community 内任意帖子投了 'up' 票。"""
        if field is None:
            field = f"reddit.postVotes.new_upvote_in_{community}"
        new_ids = self.new_post_upvotes()
        target_ids = {
            str(post["id"])
            for post in self.init.view_posts_list()
            if post.get("subreddit") == community
        }
        matched = [
            pid for pid in new_ids
            if pid in target_ids
        ]
        return {
            "field": field,
            "expected": f"对 {community} 任意帖子投一次 'up' 票",
            "actual": {"matched_post_ids": matched},
            "passed": bool(matched),
        }

    def check_created_comment(
        self,
        post_id: str,
        *keywords: str,
        body_contains: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证 Agent 在 post_id 下创建了 body 包含所有 keywords 的新 comment。"""
        assert self.init.view_post(str(post_id)) is not None, \
            f"sampler 契约违反：init 中未找到 post_id={post_id}"
        if field is None:
            field = f"reddit.comments.{post_id}.new"

        def _matches(comment: dict[str, Any]) -> bool:
            body = str(comment.get("body", ""))
            body_lower = body.lower()
            if str(comment.get("postId")) != str(post_id):
                return False
            if body_contains is not None and body_contains.lower() not in body_lower:
                return False
            return all(kw.strip().lower() in body_lower for kw in keywords)

        matched = next(
            (c for c in self.new_comments()
             if _matches(c)),
            None,
        )
        return {
            "field": field,
            "expected": {"postId": str(post_id), "body_contains": body_contains, "contains": list(keywords)},
            "actual": matched["body"] if matched else "(none)",
            "passed": matched is not None,
        }

    def check_new_chat_message_to(
        self, username: str, *keywords: str, field: str | None = None,
    ) -> dict[str, Any]:
        """验证 Agent 在 chatThreads[username] 中新增了 from=me 且 body 包含所有 keywords 的消息。"""
        assert username in self.init.chat_threads, \
            f"sampler 契约违反：init.chatThreads 中未找到 {username}"
        if field is None:
            field = f"reddit.chatThreads.{username}.new"
        matched = next(
            (m for m in self.new_chat_messages_to(username)
             if m["from"] == "me"
             and all(kw.strip().lower() in str(m["body"]).strip().lower() for kw in keywords)),
            None,
        )
        return {
            "field": field,
            "expected": f"new message to {username} from me contains {list(keywords)}",
            "actual": matched["body"] if matched else "(none)",
            "passed": matched is not None,
        }

    def check_new_comment_upvote(
        self, comment_id: str | None = None, *, field: str | None = None,
    ) -> dict[str, Any]:
        """验证 Agent 对指定或任意 comment 投了 'up' 票。"""
        if comment_id is not None:
            assert self.init.view_comment(str(comment_id)) is not None, \
                f"sampler 契约违反：init 中未找到 comment_id={comment_id}"
        if field is None:
            field = f"reddit.commentVotes.{comment_id or 'new_upvote'}"
        new = self.new_comment_upvotes()
        passed = str(comment_id) in new if comment_id is not None else bool(new)
        return {
            "field": field,
            "expected": f"对 comment {comment_id} 投 'up' 票" if comment_id is not None else "对任意 comment 投一次 'up' 票",
            "actual": {"new_upvotes": new},
            "passed": passed,
        }

    def check_new_chat_reply(
        self, username: str, source_message_id: str, *keywords: str, field: str | None = None,
    ) -> dict[str, Any]:
        """验证 Agent 在 chatReplies[{username}:{source_message_id}] 中新增了
        from=me 且 body 包含所有 keywords 的 reply。"""
        init_ids = {m["id"] for m in self.init.chat_threads.get(username, [])}
        assert source_message_id in init_ids, \
            f"sampler 契约违反：init.chatThreads[{username}] 中未找到 source message_id={source_message_id}"
        thread_key = f"{username}:{source_message_id}"
        if field is None:
            field = f"reddit.chatReplies.{thread_key}.new"
        matched = next(
            (r for r in self.new_chat_replies(username, source_message_id)
             if r["from"] == "me"
             and all(kw.strip().lower() in str(r["body"]).strip().lower() for kw in keywords)),
            None,
        )
        return {
            "field": field,
            "expected": f"new reply to {thread_key} from me contains {list(keywords)}",
            "actual": matched["body"] if matched else "(none)",
            "passed": matched is not None,
        }

    # ---- 改（Modify）----

    def check_comment_body_contains(
        self, comment_id: str, text: str, *, field: str | None = None,
    ) -> dict[str, Any]:
        """验证 state.comments[comment_id].body 当前包含 text（大小写不敏感）。
        若 Agent 误删了该 comment，passed=False（不抛异常）。"""
        assert comment_id in self.init.state_comments, \
            f"sampler 契约违反：init.state_comments 中未找到 comment_id={comment_id}"
        if field is None:
            field = f"reddit.comments.{comment_id}.body"
        # Agent 行为判定：comment 可能被 Agent 误删
        comment = self.state_comment(comment_id)
        if comment is None:
            return {
                "field": field,
                "expected": f"包含 '{text}'",
                "actual": "(deleted)",
                "passed": False,
            }
        body = str(comment["body"])
        return {
            "field": field,
            "expected": f"包含 '{text}'",
            "actual": body,
            "passed": text.strip().lower() in body.strip().lower(),
        }

    def check_bio_contains(self, text: str, *, field: str | None = None) -> dict[str, Any]:
        """验证 user.bio 当前包含 text（大小写不敏感）。"""
        assert self.init.user, "sampler 契约违反：init.user 不存在"
        if field is None:
            field = "reddit.user.bio"
        if not self.user:
            return {
                "field": field,
                "expected": f"包含 '{text}'",
                "actual": None,
                "passed": False,
            }
        bio = str(self.user["bio"]).strip()
        return {
            "field": field,
            "expected": f"包含 '{text}'",
            "actual": bio,
            "passed": text.strip().lower() in bio.lower(),
        }

    @cached_property
    def state_posts(self) -> dict[str, Any]:
        value = self.get("posts", {}) or {}
        return value if isinstance(value, dict) else {}

    @cached_property
    def state_comments(self) -> dict[str, Any]:
        value = self.get("comments", {}) or {}
        return value if isinstance(value, dict) else {}

    @cached_property
    def user(self) -> dict[str, Any]:
        value = self.get("user", {}) or {}
        return value if isinstance(value, dict) else {}

    def base_post(self, post_id: str) -> dict[str, Any] | None:
        return _base_posts_by_id().get(str(post_id))

    def state_post(self, post_id: str) -> dict[str, Any] | None:
        post = self.state_posts.get(str(post_id))
        return post if isinstance(post, dict) else None

    def view_post(self, post_id: str) -> dict[str, Any] | None:
        pid = str(post_id)
        overlay = self.state_posts
        if pid in overlay:
            post = overlay.get(pid)
            if post is None:
                return None
            if not isinstance(post, dict):
                return None
            return post
        return self.base_post(pid)

    def base_comment(self, post_id: str, comment_id: str) -> dict[str, Any] | None:
        pid = str(post_id)
        cid = str(comment_id)
        post = self.base_post(pid)
        if not isinstance(post, dict):
            return None
        raw_comments = post.get("commentsData") or []
        if not isinstance(raw_comments, list):
            return None
        for comment in raw_comments:
            if isinstance(comment, dict) and str(comment.get("id")) == cid:
                return {**comment, "postId": pid}
        return None

    def state_comment(self, comment_id: str) -> dict[str, Any] | None:
        comment = self.state_comments.get(str(comment_id))
        return comment if isinstance(comment, dict) else None

    def view_comment(self, comment_id: str, post_id: str | None = None) -> dict[str, Any] | None:
        cid = str(comment_id)
        if cid in self.state_comments:
            comment = self.state_comments.get(cid)
            if comment is None:
                return None
            if not isinstance(comment, dict):
                return None
            return comment
        if post_id is not None:
            return self.base_comment(str(post_id), cid)
        return _base_comments_by_id().get(cid)

    def view_posts_list(self) -> list[dict[str, Any]]:
        seen: set[str] = set()
        out = []
        for indexed_id in self.user["postIds"]:
            post = self.view_post(str(indexed_id))
            if not isinstance(post, dict) or post.get("id") is None:
                continue
            pid = str(post["id"])
            if pid in seen:
                continue
            seen.add(pid)
            out.append(post)
        for post in load_reddit_posts():
            if not isinstance(post, dict) or post.get("id") is None:
                continue
            pid = str(post["id"])
            view = self.view_post(pid)
            if not isinstance(view, dict) or pid in seen:
                continue
            seen.add(pid)
            out.append(view)
        return out

    def view_comments_list(self, post_id: str) -> list[dict[str, Any]]:
        pid = str(post_id)
        post = self.base_post(pid)
        fixture_comments = []
        if isinstance(post, dict):
            raw_comments = post.get("commentsData") or []
            if isinstance(raw_comments, list):
                fixture_comments = [
                    self.view_comment(str(comment.get("id")), pid)
                    for comment in raw_comments
                    if isinstance(comment, dict) and comment.get("id") is not None
                ]
                fixture_comments = [comment for comment in fixture_comments if isinstance(comment, dict)]
        seen = {str(comment.get("id")) for comment in fixture_comments if isinstance(comment, dict)}
        runtime_comments = []
        for comment in self.state_comments.values():
            if not isinstance(comment, dict) or str(comment.get("postId")) != pid:
                continue
            cid = str(comment.get("id"))
            if not cid or cid in seen:
                continue
            seen.add(cid)
            runtime_comments.append(comment)
        return [*fixture_comments, *runtime_comments]

    def check_created_post(
        self,
        *keywords: str,
        subreddit: str | None = None,
        title_contains: str | None = None,
        body_contains: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证 Agent 创建了一个新帖子。过滤条件可组合：

        - keywords (位置参数): title+content 合并文本必须包含所有 keywords
        - subreddit: 限定 subreddit 名（如 'r/memes'）
        - title_contains: title 必须单独包含此子串
        - body_contains: body/content 必须单独包含此子串
        """
        if field is None:
            field = f"reddit.posts.new.{subreddit or 'any'}"
        matched = None
        for post in self.new_posts():
            if subreddit is not None and str(post["subreddit"]).strip() != subreddit.strip():
                continue
            if title_contains is not None and title_contains.strip().lower() not in str(post["title"]).lower():
                continue
            if body_contains is not None and body_contains.strip().lower() not in str(post["content"]).lower():
                continue
            text = _post_text(post).lower()
            if keywords and not all(kw.strip().lower() in text for kw in keywords):
                continue
            matched = post
            break
        return {
            "field": field,
            "expected": {
                "subreddit": subreddit,
                "title_contains": title_contains,
                "body_contains": body_contains,
                "contains": list(keywords),
            },
            "actual": _post_text(matched)[:240] if matched else "(none)",
            "passed": matched is not None,
        }

    def check_new_content_contains(
        self,
        *keywords: str,
        subreddit: str | None = None,
        normalize_match: bool = False,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证 Agent 在某 subreddit 创建了新帖子（title+content 含 keywords）
        或在该 subreddit 帖子下新增了评论（body 含 keywords）。
        normalize_match=True 时对关键词与文本同步做空白归一化。"""
        if field is None:
            field = f"reddit.new_content.{subreddit or 'any'}"
        target_subreddit = str(subreddit or "").strip().lower().removeprefix("r/")

        def _subreddit_matches(value: str) -> bool:
            if not target_subreddit:
                return True
            return str(value).strip().lower().removeprefix("r/") == target_subreddit

        def _text_matches(text: str) -> bool:
            if normalize_match:
                normalized = _normalize_match_text(text)
                return all(_normalize_match_text(kw) in normalized for kw in keywords)
            text_lower = text.lower()
            return all(kw.strip().lower() in text_lower for kw in keywords)

        matched_text = ""
        for post in self.new_posts():
            if not _subreddit_matches(str(post["subreddit"])):
                continue
            text = _post_text(post)
            if _text_matches(text):
                matched_text = text
                break

        if not matched_text:
            for comment in self.new_comments():
                post_for_comment = self.view_post(str(comment["postId"]))
                if post_for_comment is None or not _subreddit_matches(str(post_for_comment["subreddit"])):
                    continue
                body = str(comment["body"])
                if _text_matches(body):
                    matched_text = body
                    break

        return {
            "field": field,
            "expected": {"subreddit": subreddit, "contains": list(keywords)},
            "actual": matched_text[:240] if matched_text else "(none)",
            "passed": bool(matched_text),
        }
