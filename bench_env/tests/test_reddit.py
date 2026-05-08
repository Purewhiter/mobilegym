"""
Reddit task/accessor correctness tests.
"""

from __future__ import annotations

import copy
import inspect
import json
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.reddit import tasks as _tasks_module
from bench_env.task.reddit.app import Reddit
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]

TEST_OS_STATE = {"time": {"timestamp": 1773619200000}}
DEFAULT_ROUTE = {"app": "reddit", "path": "/"}


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "apps" / "Reddit" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _make_base_state() -> dict[str, Any]:
    defaults = _load_defaults()
    return {
        "user": copy.deepcopy(defaults["user"]),
        "communities": copy.deepcopy(defaults["communities"]),
        "settings": copy.deepcopy(defaults["settings"]),
        "posts": copy.deepcopy(defaults["samplePosts"]),
        "userPosts": copy.deepcopy(defaults["userPosts"]),
        "joinedCommunityIds": [],
        "postVotes": {},
        "commentVotes": {},
        "chatThreadsByUsername": copy.deepcopy(defaults["chatThreads"]),
        "chatThreadRepliesByKey": copy.deepcopy(defaults["chatReplies"]),
        "userCommentsByPostId": copy.deepcopy(defaults["userComments"]),
    }


BASE_STATE = _make_base_state()


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
):
    return make_judge_input(
        {"apps": {"reddit": init_state}, "os": TEST_OS_STATE},
        {"apps": {"reddit": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _append_user_post(
    state: dict[str, Any],
    *,
    post_id: str,
    subreddit: str,
    title: str,
    content: str,
) -> None:
    post = {
        "id": post_id,
        "subreddit": subreddit,
        "timeAgo": "just now",
        "title": title,
        "content": content,
        "upvotes": "1",
        "comments": "0",
        "shares": 0,
        "isAd": False,
        "url": "",
        "commentsData": [],
    }
    state["userPosts"].insert(0, post)
    state["posts"].insert(0, copy.deepcopy(post))
    state["postVotes"][post_id] = "up"


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "reddit" in task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": TEST_OS_STATE}
        desc = task.description
        assert desc
        has_runtime_sampled_param = any(
            (
                isinstance(schema, dict)
                and not name.startswith("_")
                and schema.get("default") is None
                and (schema.get("source") is not None or schema.get("sampler") is not None)
            )
            for name, schema in task.parameters.items()
        )
        if not has_runtime_sampled_param:
            assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_required_class_attrs(self, cls):
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid", "vague", "safety")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")


class TestRedditAccessor:
    def test_new_posts_diff(self):
        curr = copy.deepcopy(BASE_STATE)
        _append_user_post(
            curr,
            post_id="bench_new_post_1",
            subreddit="r/Games",
            title="Bench title",
            content="Bench body",
        )
        reddit = Reddit(curr, init=copy.deepcopy(BASE_STATE))
        new_posts = reddit.new_posts()
        assert len(new_posts) == 1
        assert new_posts[0]["id"] == "bench_new_post_1"

    def test_check_new_post_in_subreddit_contains_positive(self):
        curr = copy.deepcopy(BASE_STATE)
        _append_user_post(
            curr,
            post_id="bench_new_post_2",
            subreddit="r/Music",
            title="My Bench Title",
            content="Body with benchmark keywords",
        )
        reddit = Reddit(curr, init=copy.deepcopy(BASE_STATE))
        check = reddit.check_new_post_in_subreddit_contains(
            "r/Music",
            "Bench Title",
            "benchmark",
        )
        assert check["passed"] is True

    def test_check_new_post_in_subreddit_contains_negative(self):
        curr = copy.deepcopy(BASE_STATE)
        _append_user_post(
            curr,
            post_id="bench_new_post_3",
            subreddit="r/Games",
            title="My Bench Title",
            content="Body with benchmark keywords",
        )
        reddit = Reddit(curr, init=copy.deepcopy(BASE_STATE))
        check = reddit.check_new_post_in_subreddit_contains(
            "r/Music",
            "Bench Title",
            "benchmark",
        )
        assert check["passed"] is False

    def test_check_new_post_or_comment_contains_positive_for_comment(self):
        init = copy.deepcopy(BASE_STATE)
        curr = copy.deepcopy(BASE_STATE)
        target_post = next(
            post for post in curr["posts"]
            if str(post.get("subreddit") or "").strip().removeprefix("r/").lower() == "china_irl"
        )
        curr.setdefault("userCommentsByPostId", {})
        curr["userCommentsByPostId"].setdefault(str(target_post["id"]), []).append(
            {
                "id": "bench_comment_1",
                "body": "elonmusk: Mars base alpha is on schedule.",
            }
        )
        reddit = Reddit(curr, init=init)
        check = reddit.check_new_post_or_comment_contains(
            "elonmusk:",
            "Mars base alpha is on schedule.",
            subreddit="China_irl",
            normalize_match=True,
        )
        assert check["passed"] is True


def _create_post_positive_case():
    task = _tasks_module.Reddit_CreatePostToCommunity(
        community="r/Games",
        title="Bench post",
        body="This is a benchmark post body",
    )
    curr = copy.deepcopy(BASE_STATE)
    _append_user_post(
        curr,
        post_id="bench_new_post_4",
        subreddit="r/Games",
        title="A Bench post about RPG",
        content="This is a benchmark post body with extra text",
    )
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _create_post_negative_case():
    task = _tasks_module.Reddit_CreatePostToCommunity(
        community="r/Games",
        title="Bench post",
        body="This is a benchmark post body",
    )
    curr = copy.deepcopy(BASE_STATE)
    _append_user_post(
        curr,
        post_id="bench_new_post_5",
        subreddit="r/Music",
        title="A Bench post about RPG",
        content="This is a benchmark post body with extra text",
    )
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def test_create_post_title_keyword_in_body_fails():
    """P1 回归：标题关键词写在正文中不应通过（分字段校验）。"""
    task = _tasks_module.Reddit_CreatePostToCommunity(
        community="r/Games",
        title="Bench post",
        body="This is a benchmark post body",
    )
    curr = copy.deepcopy(BASE_STATE)
    # 故意把 title keyword 塞进正文，把 body keyword 塞进标题
    _append_user_post(
        curr,
        post_id="bench_swap_1",
        subreddit="r/Games",
        title="This is a benchmark post body as title",
        content="My Bench post is here",
    )
    task_input = _make_task_input(copy.deepcopy(BASE_STATE), curr)
    assert not task.is_successful(task_input)


def test_create_post_case_insensitive_passes():
    """P2 回归：大小写不同时仍应通过（大小写不敏感校验）。"""
    task = _tasks_module.Reddit_CreatePostToCommunity(
        community="r/Games",
        title="Bench Post",
        body="Benchmark Content",
    )
    curr = copy.deepcopy(BASE_STATE)
    _append_user_post(
        curr,
        post_id="bench_case_1",
        subreddit="r/Games",
        title="my bench post for the day",
        content="some benchmark content here",
    )
    task_input = _make_task_input(copy.deepcopy(BASE_STATE), curr)
    assert task.is_successful(task_input)


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("Reddit_CreatePostToCommunity", _create_post_positive_case),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("Reddit_CreatePostToCommunity", _create_post_negative_case),
]


class TestTaskJudgeMatrixOffline:
    @pytest.mark.parametrize("task_name,builder", OFFLINE_JUDGE_POSITIVE_CASES, ids=lambda item: item)
    def test_positive_cases(self, task_name: str, builder):
        task, input_data = builder()
        assert task.is_successful(input_data), task_name

    @pytest.mark.parametrize("task_name,builder", OFFLINE_JUDGE_NEGATIVE_CASES, ids=lambda item: item)
    def test_negative_cases(self, task_name: str, builder):
        task, input_data = builder()
        assert not task.is_successful(input_data), task_name
