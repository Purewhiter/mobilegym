"""
Reddit task/accessor correctness tests.
"""

from __future__ import annotations

import copy
import inspect
import json
import ast
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.reddit import tasks as _tasks_module
from bench_env.task.reddit.app import Reddit, load_reddit_posts
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
TASKS_SOURCE = Path(_tasks_module.__file__).read_text(encoding="utf-8")
TASKS_AST = ast.parse(TASKS_SOURCE)

TEST_OS_STATE = {"time": {"timestamp": 1773619200000}}
DEFAULT_ROUTE = {"app": "reddit", "path": "/"}


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "apps" / "Reddit" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _make_base_state() -> dict[str, Any]:
    defaults = _load_defaults()
    return {
        "user": {
            **copy.deepcopy(defaults["user"]),
            "postIds": copy.deepcopy(defaults["user"].get("postIds", [])),
            "commentIds": copy.deepcopy(defaults["user"].get("commentIds", [])),
            "savedPostIds": copy.deepcopy(defaults["user"].get("savedPostIds", [])),
            "joinedCommunityIds": copy.deepcopy(defaults["user"].get("joinedCommunityIds", [])),
            "postVotes": copy.deepcopy(defaults["user"].get("postVotes", {})),
            "commentVotes": copy.deepcopy(defaults["user"].get("commentVotes", {})),
        },
        "settings": copy.deepcopy(defaults["settings"]),
        "posts": copy.deepcopy(defaults.get("posts", {})),
        "comments": copy.deepcopy(defaults.get("comments", {})),
        "chatThreads": copy.deepcopy(defaults["chatThreads"]),
        "chatReplies": copy.deepcopy(defaults["chatReplies"]),
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
    state["posts"][post_id] = post
    state["user"]["postIds"].append(post_id)
    state["user"]["postVotes"][post_id] = "up"


def _append_user_comment(
    state: dict[str, Any],
    *,
    post_id: str,
    comment_id: str,
    body: str,
    author: str | None = None,
) -> None:
    state["comments"][comment_id] = {
        "id": comment_id,
        "postId": post_id,
        "author": author or state["user"]["username"],
        "body": body,
        "score": 1,
        "created_utc": 1710000003,
    }
    state["user"]["commentIds"].append(comment_id)


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

    def test_expected_changes_are_app_constants(self):
        violations = []
        for node in ast.walk(TASKS_AST):
            if isinstance(node, ast.Assign):
                if not any(isinstance(target, ast.Name) and target.id == "expected_changes" for target in node.targets):
                    continue
                if any(isinstance(child, ast.List) for child in ast.walk(node.value)):
                    violations.append(node.lineno)
        assert violations == []

    def test_tasks_do_not_read_reddit_fixture_loader_directly(self):
        violations = []
        for node in ast.walk(TASKS_AST):
            if isinstance(node, ast.Name) and node.id == "load_reddit_posts":
                violations.append(node.lineno)
        assert violations == []


class TestRedditAccessor:
    def test_sample_deep_thread_pair_uses_current_state_text_and_ids(self):
        sample = Reddit.sample_deep_thread_reply_and_delete_pair(
            {"apps": {"reddit": copy.deepcopy(BASE_STATE)}},
            rng=None,
        )
        thread = BASE_STATE["chatThreads"]["Objective-Skill-2591"]

        assert sample["username"] == "Objective-Skill-2591"
        assert sample["thread_source_message_id"] == thread[0]["id"]
        assert sample["thread_seed_message"] == thread[0]["body"]
        assert sample["delete_message_id"] == thread[1]["id"]
        assert sample["delete_seed_message"] == thread[1]["body"]

    def test_deep_thread_task_uses_sampled_message_ids_in_judge(self):
        init = copy.deepcopy(BASE_STATE)
        curr = copy.deepcopy(BASE_STATE)
        curr["chatReplies"]["Objective-Skill-2591:ct_obj_1"].append({
            "id": "bench_reply_1",
            "from": "me",
            "body": "哈哈同感！我也觉得他们家辣度刚刚好，下次一起去试试新菜。",
            "created_utc": 1710000200,
        })
        curr["chatThreads"]["Objective-Skill-2591"] = [
            m for m in curr["chatThreads"]["Objective-Skill-2591"]
            if m["id"] != "ct_obj_2"
        ]
        task = _tasks_module.Reddit_DeepThreadReplyAndDeleteSeedMessage(
            username="Objective-Skill-2591",
            thread_seed_message=init["chatThreads"]["Objective-Skill-2591"][0]["body"],
            thread_source_message_id="ct_obj_1",
            delete_seed_message=init["chatThreads"]["Objective-Skill-2591"][1]["body"],
            delete_message_id="ct_obj_2",
        )

        assert task.is_successful(_make_task_input(init, curr))

    def test_view_posts_list_respects_tombstone_and_user_insert_order(self):
        curr = copy.deepcopy(BASE_STATE)
        base_post = next(post for post in load_reddit_posts() if isinstance(post, dict) and post.get("id"))
        base_id = str(base_post["id"])
        curr["posts"][base_id] = None
        _append_user_post(
            curr,
            post_id="bench_overlay_post_1",
            subreddit="r/Games",
            title="Overlay title",
            content="Overlay body",
        )

        reddit = Reddit(curr)

        assert reddit.base_post(base_id)["id"] == base_id
        assert reddit.state_post(base_id) is None
        assert reddit.view_post(base_id) is None
        ids = [str(post.get("id")) for post in reddit.view_posts_list()]
        assert "bench_overlay_post_1" in ids[:len(curr["user"]["postIds"])]
        assert base_id not in ids

    def test_view_post_treats_runtime_object_as_full_base_override(self):
        curr = copy.deepcopy(BASE_STATE)
        base_post = next(post for post in load_reddit_posts() if isinstance(post, dict) and post.get("id"))
        base_id = str(base_post["id"])
        override = {
            "id": base_id,
            "title": "Runtime override title",
        }
        curr["posts"][base_id] = override

        reddit = Reddit(curr)

        assert reddit.view_post(base_id) == override
        assert "subreddit" not in reddit.view_post(base_id)
        assert "author" not in reddit.view_post(base_id)

    def test_view_comments_list_respects_tombstone_and_user_comments(self):
        curr = copy.deepcopy(BASE_STATE)
        base_post = next(
            post
            for post in load_reddit_posts()
            if isinstance(post, dict) and post.get("id") and isinstance(post.get("commentsData"), list) and post["commentsData"]
        )
        post_id = str(base_post["id"])
        base_comment = next(comment for comment in base_post["commentsData"] if isinstance(comment, dict) and comment.get("id"))
        base_comment_id = str(base_comment["id"])
        curr["comments"][base_comment_id] = None
        _append_user_comment(
            curr,
            post_id=post_id,
            comment_id="bench_overlay_comment_1",
            body="Overlay comment body",
        )

        reddit = Reddit(curr)

        assert reddit.base_comment(post_id, base_comment_id)["id"] == base_comment_id
        assert reddit.state_comment(base_comment_id) is None
        assert reddit.view_comment(base_comment_id, post_id) is None
        comments = reddit.view_comments_list(post_id)
        ids = [str(comment.get("id")) for comment in comments]
        assert base_comment_id not in ids
        assert "bench_overlay_comment_1" in ids

    def test_view_comments_list_includes_runtime_comment_not_owned_by_current_user(self):
        curr = copy.deepcopy(BASE_STATE)
        base_post = next(
            post
            for post in load_reddit_posts()
            if isinstance(post, dict) and post.get("id")
        )
        post_id = str(base_post["id"])
        curr["comments"]["bench_injected_comment_1"] = {
            "id": "bench_injected_comment_1",
            "postId": post_id,
            "author": "ScenarioUser",
            "body": "Injected scene comment body",
            "score": 3,
            "created_utc": 1710000010,
        }

        reddit = Reddit(curr)

        comments = reddit.view_comments_list(post_id)
        ids = [str(comment.get("id")) for comment in comments]
        assert "bench_injected_comment_1" in ids

    def test_view_posts_list_uses_view_post_for_user_indexed_base_post(self):
        curr = copy.deepcopy(BASE_STATE)
        base_post = next(post for post in load_reddit_posts() if isinstance(post, dict) and post.get("id"))
        base_id = str(base_post["id"])
        curr["user"]["postIds"].insert(0, base_id)

        reddit = Reddit(curr)

        posts = reddit.view_posts_list()
        assert str(posts[0]["id"]) == base_id
        assert posts.count(reddit.view_post(base_id)) == 1

    def test_view_comment_treats_runtime_object_as_full_base_override(self):
        curr = copy.deepcopy(BASE_STATE)
        base_post = next(
            post
            for post in load_reddit_posts()
            if isinstance(post, dict) and post.get("id") and isinstance(post.get("commentsData"), list) and post["commentsData"]
        )
        post_id = str(base_post["id"])
        base_comment = next(comment for comment in base_post["commentsData"] if isinstance(comment, dict) and comment.get("id"))
        base_comment_id = str(base_comment["id"])
        override = {
            "id": base_comment_id,
            "body": "Runtime override comment",
        }
        curr["comments"][base_comment_id] = override

        reddit = Reddit(curr)

        assert reddit.view_comment(base_comment_id, post_id) == override
        assert "postId" not in reddit.view_comment(base_comment_id, post_id)
        assert "author" not in reddit.view_comment(base_comment_id, post_id)

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

    def test_check_created_post_positive(self):
        curr = copy.deepcopy(BASE_STATE)
        _append_user_post(
            curr,
            post_id="bench_new_post_2",
            subreddit="r/Music",
            title="My Bench Title",
            content="Body with benchmark keywords",
        )
        reddit = Reddit(curr, init=copy.deepcopy(BASE_STATE))
        check = reddit.check_created_post(
            "Bench Title", "benchmark",
            subreddit="r/Music",
        )
        assert check["passed"] is True

    def test_check_created_post_negative(self):
        curr = copy.deepcopy(BASE_STATE)
        _append_user_post(
            curr,
            post_id="bench_new_post_3",
            subreddit="r/Games",
            title="My Bench Title",
            content="Body with benchmark keywords",
        )
        reddit = Reddit(curr, init=copy.deepcopy(BASE_STATE))
        check = reddit.check_created_post(
            "Bench Title", "benchmark",
            subreddit="r/Music",
        )
        assert check["passed"] is False

    def test_check_new_content_contains_positive_for_comment(self):
        init = copy.deepcopy(BASE_STATE)
        curr = copy.deepcopy(BASE_STATE)
        reddit = Reddit(curr, init=init)
        target_post = next(
            post for post in reddit.view_posts_list()
            if str(post.get("subreddit") or "").strip().removeprefix("r/").lower() == "askreddit"
        )
        _append_user_comment(
            curr,
            post_id=str(target_post["id"]),
            comment_id="bench_comment_1",
            body="elonmusk: Mars base alpha is on schedule.",
        )
        check = reddit.check_new_content_contains(
            "elonmusk:",
            "Mars base alpha is on schedule.",
            subreddit="AskReddit",
            normalize_match=True,
        )
        assert check["passed"] is True

    def test_check_deleted_comment_requires_comment_id_removed_from_user_index(self):
        init = copy.deepcopy(BASE_STATE)
        curr = copy.deepcopy(BASE_STATE)
        _append_user_comment(
            init,
            post_id="post_1rfdbcx",
            comment_id="bench_delete_comment_1",
            body="delete me",
        )
        curr["user"]["commentIds"].append("bench_delete_comment_1")
        reddit = Reddit(curr, init=init)

        check = reddit.check_deleted_comment("bench_delete_comment_1")

        assert check["passed"] is False
        assert check["actual"]["in_comments"] is False
        assert check["actual"]["in_user_comment_ids"] is True


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
