"""
X task correctness tests.
"""

from __future__ import annotations

import copy
import inspect
import json
import random
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import CriteriaTask
from bench_env.task.x import tasks as _tasks_module
from bench_env.task.x.app import X
from bench_env.tests.conftest import make_judge_input


def _load_base_state() -> dict[str, Any]:
    base_dir = Path(__file__).resolve().parents[2] / "apps" / "X" / "data"
    defaults = json.loads((base_dir / "defaults.json").read_text(encoding="utf-8"))
    users = json.loads((base_dir / "users.json").read_text(encoding="utf-8"))
    posts = json.loads((base_dir / "posts.json").read_text(encoding="utf-8"))

    state = copy.deepcopy(defaults)
    state["users"] = users
    state["posts"] = posts
    state["followedUserIds"] = [str(uid).lower() for uid in defaults.get("followedUserIds", [])]
    state.setdefault("likedPostIds", [])
    state.setdefault("bookmarkedPostIds", [])
    state.setdefault("retweetedPostIds", [])
    return state


BASE_STATE = _load_base_state()
ENV_STATE = {"apps": {"x": copy.deepcopy(BASE_STATE)}}
TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
DEFAULT_ROUTE = {"app": "x", "path": "/"}

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]


def _with_new_post(
    state: dict[str, Any],
    *,
    post_id: str,
    content: str,
    author_id: str | None = None,
    quoted_post_id: str | None = None,
    thread_id: str | None = None,
) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["posts"] = [
        {
            "id": post_id,
            "authorId": author_id or str(next_state["user"]["id"]),
            "content": content,
            "time": "刚刚",
            "stats": {"comments": 0, "retweets": 0, "likes": 0, "views": 0},
            "quotedPostId": quoted_post_id,
            "threadId": thread_id,
        },
        *next_state["posts"],
    ]
    return next_state


def _with_appended_message(state: dict[str, Any], conversation_id: str, content: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    updated_conversations: list[dict[str, Any]] = []
    for conversation in next_state["conversations"]:
        if str(conversation["id"]) != conversation_id:
            updated_conversations.append(conversation)
            continue
        messages = list(conversation.get("messages", []))
        messages.append(
            {
                "id": f"msg_{conversation_id}_new",
                "senderId": str(next_state["user"]["id"]),
                "receiverId": conversation["participantId"],
                "content": content,
                "time": "刚刚",
                "read": True,
            }
        )
        updated_conversations.append(
            {
                **conversation,
                "messages": messages,
                "lastMessageId": messages[-1]["id"],
            }
        )
    next_state["conversations"] = updated_conversations
    return next_state


def _with_added_id(state: dict[str, Any], key: str, value: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    existing = [str(item).lower() for item in next_state.get(key, [])]
    if str(value).lower() not in existing:
        next_state[key] = [*next_state.get(key, []), value]
    return next_state


def _keyword_snippet(text: str) -> str:
    stripped = str(text).strip().replace("\n", " ")
    return stripped[: min(8, len(stripped))]


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
):
    return make_judge_input(
        {"apps": {"x": init_state}, "os": TEST_OS_STATE},
        {"apps": {"x": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
    )


def _set_by_path(state: dict[str, Any], path: str, value: Any) -> None:
    current = state
    parts = path.split(".")
    for part in parts[:-1]:
        current = current[part]
    current[parts[-1]] = value


def _resolve_criteria_value(value: Any, params: dict[str, Any]) -> Any:
    if isinstance(value, str) and value.startswith("{") and value.endswith("}"):
        return params[value[1:-1]]
    return value


def _preview_for_post(post: dict[str, Any]) -> str:
    return _keyword_snippet(str(post.get("content") or "示例内容")) or "示例内容"


def _first_unfollowed_author_post() -> dict[str, Any]:
    followed = set(BASE_STATE["followedUserIds"])
    return next(post for post in BASE_STATE["posts"] if str(post["authorId"]).lower() not in followed)


def _first_two_distinct_keyword_posts() -> tuple[dict[str, Any], str, dict[str, Any], str]:
    for index, first in enumerate(BASE_STATE["posts"]):
        keyword1 = _keyword_snippet(str(first.get("content") or ""))
        if not keyword1:
            continue
        for second in BASE_STATE["posts"][index + 1:]:
            keyword2 = _keyword_snippet(str(second.get("content") or ""))
            if keyword2 and keyword2.lower() != keyword1.lower():
                return first, keyword1, second, keyword2
    raise AssertionError("No distinct keyword pair available in X defaults")


class TestXAccessor:
    def test_sample_post_reference(self):
        sampled = X.sample_post_reference(copy.deepcopy(ENV_STATE), random.Random(0))
        assert sampled["post_id"]
        assert sampled["author_handle"].startswith("@")
        assert sampled["post_preview"]

    def test_sample_conversation_reference(self):
        sampled = X.sample_conversation_reference(copy.deepcopy(ENV_STATE), random.Random(1))
        assert sampled["conversation_id"]
        assert sampled["participant_handle"].startswith("@")
        assert sampled["last_message_preview"]

    def test_sample_search_targets(self):
        sampled = X.sample_search_keyword(copy.deepcopy(ENV_STATE), random.Random(2))
        pair = X.sample_search_keyword_pair(copy.deepcopy(ENV_STATE), random.Random(3))
        assert sampled["keyword"]
        assert pair["keyword1"]
        assert pair["keyword2"]
        assert pair["keyword1"] != pair["keyword2"]

    def test_sample_search_keyword_pair_raises_with_one_post_even_if_trends_exist(self):
        env_state = {
            "apps": {
                "x": {
                    "posts": [
                        {"id": "p1", "content": "hello world", "authorId": "u1"},
                    ],
                    "trends": [
                        {"title": "Trend Alpha"},
                        {"title": "Trend Beta"},
                    ],
                    "users": {"u1": {"handle": "@u1", "name": "U1"}},
                    "followedUserIds": [],
                }
            }
        }

        with pytest.raises(RuntimeError, match="未找到两个不同的 X 搜索关键词"):
            X.sample_search_keyword_pair(env_state, random.Random(0))

    def test_search_and_bookmark_task_uses_fixed_keyword_instead_of_sampling(self):
        env_state = {
            "apps": {
                "x": {
                    "posts": [
                        {"id": "p1", "content": "hello world", "authorId": "u1"},
                    ],
                    "users": {"u1": {"handle": "@u1", "name": "U1"}},
                    "followedUserIds": [],
                }
            }
        }

        task = _tasks_module.SearchAndBookmark(_seed=0)
        sampled = task.sampler.sample(env_state, task=task).params
        assert "_search_target" not in task.parameters
        assert task.parameters["keyword"]["type"] == "enum"
        values = list(task.parameters["keyword"]["values"])
        assert len(values) >= 2
        assert sampled["keyword"] in values
        assert sampled["keyword"].lower() not in "hello world"

    def test_search_multiple_keywords_task_uses_fixed_keyword_sets_instead_of_sampling(self):
        env_state = {
            "apps": {
                "x": {
                    "posts": [
                        {"id": "p1", "content": "hello world", "authorId": "u1"},
                        {"id": "p2", "content": "grok launch news", "authorId": "u2"},
                    ],
                    "users": {
                        "u1": {"handle": "@u1", "name": "U1"},
                        "u2": {"handle": "@u2", "name": "U2"},
                    },
                    "followedUserIds": [],
                }
            }
        }

        task = _tasks_module.SearchMultipleKeywordsAndInteract(_seed=0)
        sampled = task.sampler.sample(env_state, task=task).params
        assert "_search_pair" not in task.parameters
        assert task.parameters["keyword1"]["type"] == "enum"
        assert task.parameters["keyword2"]["type"] == "enum"
        values1 = list(task.parameters["keyword1"]["values"])
        values2 = list(task.parameters["keyword2"]["values"])
        assert len(values1) >= 2
        assert len(values2) >= 2
        assert sampled["keyword1"] in values1
        assert sampled["keyword2"] in values2
        assert set(values1).isdisjoint(values2)

    def test_sample_follow_target(self):
        sampled = X.sample_follow_target(copy.deepcopy(ENV_STATE), random.Random(4))
        assert sampled["user_handle"].startswith("@")
        assert sampled["user_name"]

    def test_sample_unretweeted_post_reference_skips_already_retweeted(self):
        sampled = X.sample_unretweeted_post_reference(copy.deepcopy(ENV_STATE), random.Random(0))
        assert sampled["post_id"]

        base_state = copy.deepcopy(BASE_STATE)
        base_state["retweetedPostIds"] = [str(post["id"]) for post in base_state["posts"]]
        env_state = {"apps": {"x": base_state}}
        with pytest.raises(RuntimeError, match="未找到可采样的 X 推文目标"):
            X.sample_unretweeted_post_reference(env_state, random.Random(0))

    @pytest.mark.parametrize(
        "keyword",
        list(_tasks_module.SearchAndBookmark.parameters["keyword"]["values"]),
    )
    def test_search_and_bookmark_enum_keywords_have_init_posts(self, keyword):
        app = X(copy.deepcopy(BASE_STATE))
        kw_lower = keyword.lower()
        assert any(
            kw_lower in str(post.get("content") or "").lower()
            for post in app.posts
            if not str(post.get("threadId") or "")
        ), f"Enum keyword {keyword!r} has no matching top-level post in defaults"

    @pytest.mark.parametrize(
        "field",
        ["keyword1", "keyword2"],
    )
    def test_search_multiple_keywords_enum_values_have_init_posts(self, field):
        app = X(copy.deepcopy(BASE_STATE))
        values = _tasks_module.SearchMultipleKeywordsAndInteract.parameters[field]["values"]
        for keyword in values:
            kw_lower = keyword.lower()
            assert any(
                kw_lower in str(post.get("content") or "").lower()
                for post in app.posts
                if not str(post.get("threadId") or "")
            ), f"{field} enum value {keyword!r} has no matching top-level post in defaults"

    def test_sample_post_reference_stops_after_first_random_valid_post(self, monkeypatch):
        env_state = {
            "apps": {
                "x": {
                    "posts": [
                        {"id": f"p{i}", "content": f"post {i}", "authorId": f"u{i}"}
                        for i in range(20)
                    ],
                    "users": {
                        f"u{i}": {"handle": f"@user{i}", "name": f"User {i}"}
                        for i in range(20)
                    },
                }
            }
        }

        calls = {"count": 0}

        def fake_get_user_handle(self, user_id: str) -> str:
            calls["count"] += 1
            return f"@{user_id}"

        monkeypatch.setattr(X, "get_user_handle", fake_get_user_handle)

        sampled = X.sample_post_reference(env_state, random.Random(0))
        assert sampled["post_id"].startswith("p")
        assert calls["count"] == 1

    def test_sample_follow_target_stops_after_first_random_valid_post(self, monkeypatch):
        env_state = {
            "apps": {
                "x": {
                    "posts": [
                        {"id": f"p{i}", "content": f"post {i}", "authorId": f"u{i}"}
                        for i in range(20)
                    ],
                    "users": {
                        f"u{i}": {"handle": f"@user{i}", "name": f"User {i}"}
                        for i in range(20)
                    },
                    "followedUserIds": [],
                }
            }
        }

        calls = {"count": 0}

        def fake_find_user_by_id(self, user_id: str) -> dict[str, Any] | None:
            calls["count"] += 1
            return self.users.get(user_id)

        monkeypatch.setattr(X, "find_user_by_id", fake_find_user_by_id)

        sampled = X.sample_follow_target(env_state, random.Random(0))
        assert sampled["user_handle"].startswith("@user")
        assert calls["count"] == 1

    def test_check_created_quoted_post(self):
        target_post = BASE_STATE["posts"][0]
        curr = _with_new_post(
            BASE_STATE,
            post_id="new_quote_1",
            content="引用测试内容",
            quoted_post_id=str(target_post["id"]),
        )
        app = X(curr, init=copy.deepcopy(BASE_STATE))
        assert app.check_created_quoted_post(str(target_post["id"]), "引用测试内容")["passed"] is True

        wrong = _with_new_post(
            BASE_STATE,
            post_id="new_quote_2",
            content="引用测试内容",
            quoted_post_id="wrong_post_id",
        )
        assert X(wrong, init=copy.deepcopy(BASE_STATE)).check_created_quoted_post(
            str(target_post["id"]),
            "引用测试内容",
        )["passed"] is False

    def test_check_sent_dm(self):
        conversation_id = str(BASE_STATE["conversations"][0]["id"])
        curr = _with_appended_message(BASE_STATE, conversation_id, "这是新的私信")
        app = X(curr, init=copy.deepcopy(BASE_STATE))
        assert app.check_sent_dm(conversation_id, "这是新的私信")["passed"] is True

        wrong = _with_appended_message(BASE_STATE, conversation_id, "不是目标内容")
        assert X(wrong, init=copy.deepcopy(BASE_STATE)).check_sent_dm(
            conversation_id,
            "这是新的私信",
        )["passed"] is False

    def test_check_keyword_interactions(self):
        target_post = BASE_STATE["posts"][1]
        target_post_id = str(target_post["id"])
        keyword = _keyword_snippet(str(target_post["content"]))

        bookmarked = _with_added_id(BASE_STATE, "bookmarkedPostIds", target_post_id)
        liked = _with_added_id(BASE_STATE, "likedPostIds", target_post_id)

        assert X(bookmarked, init=copy.deepcopy(BASE_STATE)).check_bookmarked_post_for_keyword(
            keyword
        )["passed"] is True
        assert X(liked, init=copy.deepcopy(BASE_STATE)).check_liked_post_for_keyword(keyword)[
            "passed"
        ] is True

        wrong_post_id = str(BASE_STATE["posts"][2]["id"])
        wrong_bookmark = _with_added_id(BASE_STATE, "bookmarkedPostIds", wrong_post_id)
        assert X(wrong_bookmark, init=copy.deepcopy(BASE_STATE)).check_bookmarked_post_for_keyword(
            keyword
        )["passed"] is False

    def test_check_follow_and_like_user_post(self):
        author_post = next(
            post
            for post in BASE_STATE["posts"]
            if str(post["authorId"]).lower() not in set(BASE_STATE["followedUserIds"])
        )
        author_id = str(author_post["authorId"])
        author_handle = X(copy.deepcopy(BASE_STATE)).get_user_handle(author_id)

        followed = _with_added_id(BASE_STATE, "followedUserIds", author_id)
        followed_and_liked = _with_added_id(followed, "likedPostIds", str(author_post["id"]))
        app = X(followed_and_liked, init=copy.deepcopy(BASE_STATE))
        assert app.check_followed_user(author_handle)["passed"] is True
        assert app.check_liked_post_by_user(author_handle)["passed"] is True

        other_author_post = next(
            post
            for post in BASE_STATE["posts"]
            if str(post["authorId"]).lower() != str(author_id).lower()
        )
        wrong_like = _with_added_id(followed, "likedPostIds", str(other_author_post["id"]))
        assert X(wrong_like, init=copy.deepcopy(BASE_STATE)).check_liked_post_by_user(author_handle)[
            "passed"
        ] is False

    def test_check_reply_and_retweet_same_post(self):
        target_post_id = str(BASE_STATE["posts"][0]["id"])
        replied = _with_new_post(
            BASE_STATE,
            post_id="reply_target_1",
            content="这是一条回复",
            thread_id=target_post_id,
        )
        replied_and_retweeted = _with_added_id(replied, "retweetedPostIds", target_post_id)
        app = X(replied_and_retweeted, init=copy.deepcopy(BASE_STATE))
        assert app.check_replied_to_post(target_post_id, "这是一条回复")["passed"] is True
        assert app.check_retweeted_post(target_post_id)["passed"] is True

        wrong_reply = _with_new_post(
            BASE_STATE,
            post_id="reply_target_2",
            content="这是一条回复",
            thread_id=str(BASE_STATE["posts"][1]["id"]),
        )
        assert X(wrong_reply, init=copy.deepcopy(BASE_STATE)).check_replied_to_post(
            target_post_id,
            "这是一条回复",
        )["passed"] is False

    def test_check_created_post_and_reply(self):
        with_post = _with_new_post(
            BASE_STATE,
            post_id="new_post_1",
            content="原始发帖内容",
        )
        with_post_and_reply = _with_new_post(
            with_post,
            post_id="reply_to_new_post_1",
            content="回复新帖内容",
            thread_id="new_post_1",
        )
        app = X(with_post_and_reply, init=copy.deepcopy(BASE_STATE))
        assert app.check_created_post("原始发帖内容")["passed"] is True
        assert app.check_replied_to_new_post("原始发帖内容", "回复新帖内容")["passed"] is True

        wrong_reply = _with_new_post(
            with_post,
            post_id="reply_to_new_post_2",
            content="回复新帖内容",
            thread_id=str(BASE_STATE["posts"][0]["id"]),
        )
        assert X(wrong_reply, init=copy.deepcopy(BASE_STATE)).check_replied_to_new_post(
            "原始发帖内容",
            "回复新帖内容",
        )["passed"] is False


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "x" in task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"apps": {"x": copy.deepcopy(BASE_STATE)}, "os": TEST_OS_STATE}
        desc = task.description
        assert desc
        assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_required_class_attrs(self, cls):
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid", "vague", "safety")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema, f"{cls.__name__}.parameters['{key}'] missing default"


def _positive_criteria_case(task: CriteriaTask):
    curr = copy.deepcopy(BASE_STATE)
    for path, raw_value in task.criteria.items():
        _set_by_path(curr, path, _resolve_criteria_value(raw_value, task.params))
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _negative_criteria_case(task: CriteriaTask):
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _positive_search_multiple_case():
    post1, keyword1, post2, keyword2 = _first_two_distinct_keyword_posts()
    task = _tasks_module.SearchMultipleKeywordsAndInteract(
        keyword1=keyword1,
        keyword2=keyword2,
    )
    liked = _with_added_id(BASE_STATE, "likedPostIds", str(post1["id"]))
    curr = _with_added_id(liked, "bookmarkedPostIds", str(post2["id"]))
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _negative_search_multiple_case():
    post1, keyword1, _, keyword2 = _first_two_distinct_keyword_posts()
    task = _tasks_module.SearchMultipleKeywordsAndInteract(
        keyword1=keyword1,
        keyword2=keyword2,
    )
    curr = _with_added_id(BASE_STATE, "likedPostIds", str(post1["id"]))
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _positive_reply_and_retweet_same_post_case():
    """Maximal state: reply post + retweet shell + retweets stat bump.

    Mirrors X's registerStateAdapter output (_mergeLocalPosts injects a retweet
    shell into the snapshot on top of the store's reply post). Guards
    ``expected_changes`` from being reverted to ``posts[+1]``.
    """
    target = BASE_STATE["posts"][0]
    post_id = str(target["id"])
    task = _tasks_module.ReplyAndRetweetSamePost(
        post_id=post_id,
        author_handle=X(copy.deepcopy(BASE_STATE)).get_user_handle(str(target["authorId"])),
        post_preview=_preview_for_post(target),
        reply_content="这是一条回复",
    )

    curr = _with_new_post(
        BASE_STATE,
        post_id="reply_target_positive",
        content="这是一条回复",
        thread_id=post_id,
    )
    curr = _with_added_id(curr, "retweetedPostIds", post_id)
    curr["posts"] = [
        {
            "id": f"retweet_{post_id}",
            "authorId": str(curr["user"]["id"]),
            "content": "",
            "time": "刚刚",
            "stats": {"comments": 0, "retweets": 0, "likes": 0, "views": 0},
            "retweetedPostId": post_id,
        },
        *curr["posts"],
    ]
    for post in curr["posts"]:
        if str(post.get("id")) == post_id:
            post["stats"]["retweets"] = int(post["stats"]["retweets"]) + 1
            break

    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


OFFLINE_JUDGE_POSITIVE_CASES = [
    (
        "SetAudiencePrivacyBundle",
        lambda: _positive_criteria_case(
            _tasks_module.SetAudiencePrivacyBundle(
                private_posts=True,
                protect_videos=True,
                photo_tagging=False,
            )
        ),
    ),
    (
        "SetChatPrivacyBundle",
        lambda: _positive_criteria_case(
            _tasks_module.SetChatPrivacyBundle(
                dm_request_from="verified",
                debug_log=True,
            )
        ),
    ),
    (
        "SetCallPermissionsBundle",
        lambda: _positive_criteria_case(_tasks_module.SetCallPermissionsBundle()),
    ),
    (
        "SetPushNotificationMix",
        lambda: _positive_criteria_case(_tasks_module.SetPushNotificationMix()),
    ),
    (
        "QuotePostAndTweet",
        lambda: (
            target := BASE_STATE["posts"][0],
            task := _tasks_module.QuotePostAndTweet(
                post_id=str(target["id"]),
                author_handle=X(copy.deepcopy(BASE_STATE)).get_user_handle(str(target["authorId"])),
                post_preview=_preview_for_post(target),
                content="引用一下这条帖子",
            ),
            curr := _with_new_post(
                BASE_STATE,
                post_id="new_quote_positive",
                content="引用一下这条帖子",
                quoted_post_id=str(target["id"]),
            ),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
    (
        "SendDmToConversation",
        lambda: (
            conversation := BASE_STATE["conversations"][0],
            task := _tasks_module.SendDmToConversation(
                conversation_id=str(conversation["id"]),
                participant_handle=X(copy.deepcopy(BASE_STATE)).get_user_handle(str(conversation["participantId"])),
                last_message_preview=_keyword_snippet(str(conversation["messages"][-1]["content"])),
                content="这是新的私信",
            ),
            curr := _with_appended_message(BASE_STATE, str(conversation["id"]), "这是新的私信"),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
    (
        "SearchAndBookmark",
        lambda: (
            target := BASE_STATE["posts"][1],
            keyword := _keyword_snippet(str(target["content"])),
            task := _tasks_module.SearchAndBookmark(keyword=keyword),
            curr := _with_added_id(BASE_STATE, "bookmarkedPostIds", str(target["id"])),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
    (
        "FollowUserAndLikeTheirPost",
        lambda: (
            target := _first_unfollowed_author_post(),
            user := X(copy.deepcopy(BASE_STATE)).find_user_by_id(str(target["authorId"])),
            task := _tasks_module.FollowUserAndLikeTheirPost(
                user_handle=X(copy.deepcopy(BASE_STATE)).get_user_handle(str(target["authorId"])),
                user_name=str((user or {}).get("name") or "某位用户"),
            ),
            followed := _with_added_id(BASE_STATE, "followedUserIds", str(target["authorId"])),
            curr := _with_added_id(followed, "likedPostIds", str(target["id"])),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
    (
        "ReplyAndRetweetSamePost",
        _positive_reply_and_retweet_same_post_case,
    ),
    (
        "ComplexSettingsChain",
        lambda: _positive_criteria_case(_tasks_module.ComplexSettingsChain()),
    ),
    (
        "SearchMultipleKeywordsAndInteract",
        _positive_search_multiple_case,
    ),
    (
        "PostWithImageAndReply",
        lambda: (
            task := _tasks_module.PostWithImageAndReply(
                content="原始发帖内容",
                reply_content="回复新帖内容",
            ),
            with_post := _with_new_post(BASE_STATE, post_id="new_post_positive", content="原始发帖内容"),
            curr := _with_new_post(
                with_post,
                post_id="new_post_reply_positive",
                content="回复新帖内容",
                thread_id="new_post_positive",
            ),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
]


OFFLINE_JUDGE_NEGATIVE_CASES = [
    (
        "SetAudiencePrivacyBundle",
        lambda: _negative_criteria_case(
            _tasks_module.SetAudiencePrivacyBundle(
                private_posts=True,
                protect_videos=True,
                photo_tagging=False,
            )
        ),
    ),
    (
        "SetChatPrivacyBundle",
        lambda: _negative_criteria_case(
            _tasks_module.SetChatPrivacyBundle(
                dm_request_from="verified",
                debug_log=True,
            )
        ),
    ),
    (
        "SetCallPermissionsBundle",
        lambda: _negative_criteria_case(_tasks_module.SetCallPermissionsBundle()),
    ),
    (
        "SetPushNotificationMix",
        lambda: _negative_criteria_case(_tasks_module.SetPushNotificationMix()),
    ),
    (
        "QuotePostAndTweet",
        lambda: (
            target := BASE_STATE["posts"][0],
            task := _tasks_module.QuotePostAndTweet(
                post_id=str(target["id"]),
                author_handle=X(copy.deepcopy(BASE_STATE)).get_user_handle(str(target["authorId"])),
                post_preview=_preview_for_post(target),
                content="引用一下这条帖子",
            ),
            curr := _with_new_post(
                BASE_STATE,
                post_id="new_quote_negative",
                content="引用一下这条帖子",
                quoted_post_id="wrong_post_id",
            ),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
    (
        "SendDmToConversation",
        lambda: (
            conversation := BASE_STATE["conversations"][0],
            task := _tasks_module.SendDmToConversation(
                conversation_id=str(conversation["id"]),
                participant_handle=X(copy.deepcopy(BASE_STATE)).get_user_handle(str(conversation["participantId"])),
                last_message_preview=_keyword_snippet(str(conversation["messages"][-1]["content"])),
                content="这是新的私信",
            ),
            curr := _with_appended_message(BASE_STATE, str(conversation["id"]), "不是目标内容"),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
    (
        "SearchAndBookmark",
        lambda: (
            target := BASE_STATE["posts"][1],
            wrong := BASE_STATE["posts"][2],
            keyword := _keyword_snippet(str(target["content"])),
            task := _tasks_module.SearchAndBookmark(keyword=keyword),
            curr := _with_added_id(BASE_STATE, "bookmarkedPostIds", str(wrong["id"])),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
    (
        "FollowUserAndLikeTheirPost",
        lambda: (
            target := _first_unfollowed_author_post(),
            user := X(copy.deepcopy(BASE_STATE)).find_user_by_id(str(target["authorId"])),
            task := _tasks_module.FollowUserAndLikeTheirPost(
                user_handle=X(copy.deepcopy(BASE_STATE)).get_user_handle(str(target["authorId"])),
                user_name=str((user or {}).get("name") or "某位用户"),
            ),
            curr := _with_added_id(BASE_STATE, "followedUserIds", str(target["authorId"])),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
    (
        "ReplyAndRetweetSamePost",
        lambda: (
            target := BASE_STATE["posts"][0],
            task := _tasks_module.ReplyAndRetweetSamePost(
                post_id=str(target["id"]),
                author_handle=X(copy.deepcopy(BASE_STATE)).get_user_handle(str(target["authorId"])),
                post_preview=_preview_for_post(target),
                reply_content="这是一条回复",
            ),
            curr := _with_added_id(BASE_STATE, "retweetedPostIds", str(target["id"])),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
    (
        "ComplexSettingsChain",
        lambda: _negative_criteria_case(_tasks_module.ComplexSettingsChain()),
    ),
    (
        "SearchMultipleKeywordsAndInteract",
        _negative_search_multiple_case,
    ),
    (
        "PostWithImageAndReply",
        lambda: (
            task := _tasks_module.PostWithImageAndReply(
                content="原始发帖内容",
                reply_content="回复新帖内容",
            ),
            curr := _with_new_post(BASE_STATE, post_id="new_post_negative", content="原始发帖内容"),
            (task, _make_task_input(copy.deepcopy(BASE_STATE), curr)),
        )[-1],
    ),
]

OFFLINE_JUDGE_TASK_NAMES = {cls.__name__ for cls in ALL_TASK_CLASSES}


class TestTaskJudgeMatrixOffline:
    def test_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == OFFLINE_JUDGE_TASK_NAMES
        assert negative == OFFLINE_JUDGE_TASK_NAMES

    @pytest.mark.parametrize(
        "case_name,case_factory",
        OFFLINE_JUDGE_POSITIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES],
    )
    def test_positive_cases(self, case_name: str, case_factory):
        task, judge_input = case_factory()
        result = task.evaluate(judge_input)
        assert result.success, f"{case_name} should pass: {result.issues}"

    @pytest.mark.parametrize(
        "case_name,case_factory",
        OFFLINE_JUDGE_NEGATIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES],
    )
    def test_negative_cases(self, case_name: str, case_factory):
        task, judge_input = case_factory()
        result = task.evaluate(judge_input)
        assert not result.success, f"{case_name} should fail"
