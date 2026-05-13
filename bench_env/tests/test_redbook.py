"""RedBook task correctness tests."""

from __future__ import annotations

import copy
import inspect
import json
import re
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.task.redbook import tasks as _tasks_module
from bench_env.task.redbook.app import REDBOOK_PUBLISH_CHANGES, Redbook
from bench_env.task.utils import int_to_chinese
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
DEFAULT_ROUTE = {"app": "redbook", "path": "/"}
_RELATIVE_PATTERN = re.compile(r"^-(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$")


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "apps" / "RedBook" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _load_base_notes() -> list[dict[str, Any]]:
    path = Path(__file__).resolve().parents[2] / "apps" / "RedBook" / "data" / "notes.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_relative_ts(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    raw = str(value or "")
    match = _RELATIVE_PATTERN.fullmatch(raw)
    if not match:
        return TEST_OS_STATE["time"]["timestamp"]
    days = int(match.group(1) or 0)
    hours = int(match.group(2) or 0)
    minutes = int(match.group(3) or 0)
    delta_ms = (((days * 24) + hours) * 60 + minutes) * 60 * 1000
    return TEST_OS_STATE["time"]["timestamp"] - delta_ms


def _make_base_state() -> dict[str, Any]:
    defaults = copy.deepcopy(_load_defaults())
    for note in defaults.get("notes", {}).values():
        note["createdAt"] = _resolve_relative_ts(note["createdAt"])
        note.setdefault("commentList", [])
        for comment in note["commentList"]:
            comment["time"] = _resolve_relative_ts(comment["time"])
    for comment in defaults.get("comments", {}).values():
        comment["time"] = _resolve_relative_ts(comment["time"])
    for chat in defaults.get("chats", []) or []:
        chat["lastTime"] = _resolve_relative_ts(chat["lastTime"])
        for message in chat.get("messages", []) or []:
            message["timestamp"] = _resolve_relative_ts(message["timestamp"])
    defaults.setdefault("notes", {})
    defaults.setdefault("comments", {})
    defaults.setdefault("users", {})
    defaults.setdefault("chats", [])
    defaults.setdefault("notifications", [])
    defaults.setdefault("history", [])
    defaults.setdefault("publishDraft", {"text": "", "templateId": "basic", "title": "", "images": []})
    # `_temp` is ephemeral nav state — initialized in TS, not defaults.json.
    # Tests that simulate "user switched to category X" need to mutate it,
    # so seed it here to match the runtime store shape.
    defaults.setdefault("_temp", {"activeCategory": "recommend", "citySubTab": "recommend"})
    return defaults


BASE_STATE = _make_base_state()


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
):
    return make_judge_input(
        {"apps": {"redbook": init_state}, "os": TEST_OS_STATE},
        {"apps": {"redbook": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _set_by_path(state: dict[str, Any], path: str, value: Any) -> None:
    current = state
    parts = path.split(".")
    for part in parts[:-1]:
        current = current[part]
    current[parts[-1]] = value


def _resolve_criteria_value(value: Any, params: dict[str, Any]) -> Any:
    if isinstance(value, str):
        match = re.fullmatch(r"\{(\w+)\}", value)
        if match:
            return params[match.group(1)]
    return value


def _realistic_answer(expected: Any) -> str:
    if isinstance(expected, dict):
        if "followers" in expected and "likes" in expected:
            return f"作者有{expected['followers']}粉丝，获赞{expected['likes']}"
        return "，".join(f"{key}是{value}" for key, value in expected.items())
    if isinstance(expected, (int, float)):
        return f"答案是{expected}"
    if isinstance(expected, str):
        return f"答案是：{expected}"
    return str(expected)


def _wrong_answer(expected: Any) -> str:
    if isinstance(expected, dict):
        wrong_parts = []
        for key, value in expected.items():
            if isinstance(value, (int, float)):
                wrong_parts.append(f"{key}是{value + 1}")
            else:
                wrong_parts.append(f"{key}是错误值")
        return "，".join(wrong_parts)
    if isinstance(expected, (int, float)):
        return f"答案是{expected + 1}"
    if isinstance(expected, str):
        return "答案是错误内容"
    return "错误答案"


def _append_chat_message(state: dict[str, Any], target_user_id: str, content: str) -> None:
    chats = state["chats"]
    chat = next((item for item in chats if item["userId"] == target_user_id), None)
    message = {
        "id": f"msg_{len(chats) + 1}",
        "senderId": state["user"]["id"],
        "content": content,
        "timestamp": TEST_OS_STATE["time"]["timestamp"],
        "type": "text",
    }
    if chat is None:
        target_user = Redbook(state).require_user_entity(target_user_id)
        chats.insert(0, {
            "userId": target_user_id,
            "username": target_user["name"],
            "avatar": target_user["avatar"],
            "lastMessage": content,
            "lastTime": TEST_OS_STATE["time"]["timestamp"],
            "unreadCount": 0,
            "messages": [message],
        })
        return
    chat["messages"].append(message)
    chat["lastMessage"] = content
    chat["lastTime"] = TEST_OS_STATE["time"]["timestamp"]


def _follow_user(state: dict[str, Any], user_id: str) -> None:
    if user_id not in state["user"]["followingIds"]:
        state["user"]["followingIds"].append(user_id)


def _collect_note(state: dict[str, Any], note_id: str) -> None:
    if note_id not in state["user"]["collectedNotes"]:
        state["user"]["collectedNotes"].append(note_id)


def _like_note(state: dict[str, Any], note_id: str) -> None:
    if note_id not in state["user"]["likedNotes"]:
        state["user"]["likedNotes"].append(note_id)


def _remove_like(state: dict[str, Any], note_id: str) -> None:
    if note_id in state["user"]["likedNotes"]:
        state["user"]["likedNotes"] = [item for item in state["user"]["likedNotes"] if item != note_id]


def _add_comment(state: dict[str, Any], note_id: str, content: str, reply_to_id: str | None = None) -> None:
    note = Redbook(state).require_note(note_id)
    comment = {
        "id": f"c_test_{len(state.setdefault('comments', {})) + 1}",
        "noteId": note_id,
        "userId": state["user"]["id"],
        "username": state["user"]["name"],
        "avatar": state["user"]["avatar"],
        "content": content,
        "time": TEST_OS_STATE["time"]["timestamp"],
        "likes": 0,
        "replyToId": reply_to_id,
        "location": state["user"]["location"],
    }
    state.setdefault("comments", {})[comment["id"]] = comment
    state["user"].setdefault("commentIds", []).append(comment["id"])


def _publish_note(state: dict[str, Any], title: str, content: str) -> None:
    note_id = f"note_test_{len(state.setdefault('notes', {})) + 1}"
    state["notes"][note_id] = {
        "id": note_id,
        "title": title,
        "content": content,
        "authorId": state["user"]["id"],
        "images": [],
        "likes": 0,
        "collections": 0,
        "comments": 0,
        "commentList": [],
        "createdAt": TEST_OS_STATE["time"]["timestamp"],
        "category": "测试",
    }
    state["user"]["publishedNoteIds"].insert(0, note_id)


def _keyword_candidates(text: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"[｜|丨·•…—\\-–:：,，。.!！?？\\s]+", str(text or "")) if p.strip()]
    seen: set[str] = set()
    candidates: list[str] = []
    for part in parts:
        for candidate in (part, part[:6], part[:4], part[:2]):
            candidate = candidate.strip()
            if len(candidate) < 2 or candidate in seen:
                continue
            seen.add(candidate)
            candidates.append(candidate)
    return candidates


def _current_search_keyword() -> str:
    rb = Redbook(BASE_STATE)
    for note in rb.notes_by_id.values():
        for candidate in _keyword_candidates(str(note.get("category") or "")) + _keyword_candidates(str(note.get("title") or "")):
            if rb.find_note_by_keyword(candidate):
                return candidate
    raise AssertionError("No searchable keyword found in current Redbook defaults")


def _current_uncollected_search_keyword() -> str:
    rb = Redbook(BASE_STATE)
    collected = set(rb.collected_notes)
    for note in rb.notes_by_id.values():
        note_id = str(note["id"])
        if note_id in collected:
            continue
        for candidate in _keyword_candidates(str(note.get("category") or "")) + _keyword_candidates(str(note.get("title") or "")):
            found = rb.find_note_by_keyword(candidate)
            if found and str(found["id"]) == note_id:
                return candidate
    raise AssertionError("No searchable uncollected note found in current Redbook defaults")


def _current_followed_username(*, require_notes: bool = False) -> str:
    rb = Redbook(BASE_STATE)
    for user_id in rb.following_ids:
        user = rb.require_user_entity(str(user_id))
        if require_notes and rb.user_note_count(str(user_id)) <= 0:
            continue
        return str(user["name"])
    raise AssertionError("No followed user available in current Redbook defaults")


def _current_searchable_username() -> str:
    rb = Redbook(BASE_STATE)
    for user in rb.users_by_id.values():
        if str(user.get("id")) == rb.user_id:
            continue
        if str(user.get("name") or "").strip():
            return str(user["name"])
    raise AssertionError("No searchable user available in current Redbook defaults")


def _current_unfollowed_username_with_location() -> str:
    rb = Redbook(BASE_STATE)
    followed = set(rb.following_ids)
    for user_id, user in rb.users_by_id.items():
        if user_id in followed or user_id == rb.user_id:
            continue
        if str(user.get("location") or "").strip():
            return str(user["name"])
    raise AssertionError("No unfollowed user with location available in current Redbook defaults")


def _current_recommend_note() -> dict[str, Any]:
    rb = Redbook(BASE_STATE)
    notes = rb.visible_discover_notes_for_category("recommend", limit=40)
    if not notes:
        raise AssertionError("No recommend notes available in current Redbook defaults")
    return notes[0]


def _current_recommend_keyword() -> str:
    note = _current_recommend_note()
    for candidate in _keyword_candidates(str(note.get("title") or "")):
        if candidate in str(note.get("title") or ""):
            return candidate
    raise AssertionError("No recommend keyword available in current Redbook defaults")


def _current_replyable_recommend_keyword() -> str:
    rb = Redbook(BASE_STATE)
    notes = rb.visible_discover_replyable_notes("recommend", limit=40)
    if not notes:
        raise AssertionError("No replyable recommend notes available in current Redbook defaults")
    for candidate in _keyword_candidates(str(notes[0].get("title") or "")):
        if candidate in str(notes[0].get("title") or ""):
            return candidate
    raise AssertionError("No replyable recommend keyword available in current Redbook defaults")


def _remove_initial_like(state: dict[str, Any], note_id: str) -> None:
    if note_id not in state["user"]["likedNotes"]:
        return
    state["user"]["likedNotes"] = [item for item in state["user"]["likedNotes"] if item != note_id]


def _remove_initial_collection(state: dict[str, Any], note_id: str) -> None:
    if note_id not in state["user"]["collectedNotes"]:
        return
    state["user"]["collectedNotes"] = [item for item in state["user"]["collectedNotes"] if item != note_id]


def _positive_answer_case(
    task: AnswerTask,
    *,
    init_state: dict[str, Any] | None = None,
    curr_state: dict[str, Any] | None = None,
    answer_text: str | None = None,
):
    init = copy.deepcopy(init_state or BASE_STATE)
    curr = copy.deepcopy(curr_state or init)
    probe = _make_task_input(copy.deepcopy(init), copy.deepcopy(curr))
    expected = task.get_answer(probe)
    return task, _make_task_input(init, curr, answer=answer_text or _realistic_answer(expected))


def _negative_answer_case(
    task: AnswerTask,
    *,
    init_state: dict[str, Any] | None = None,
    curr_state: dict[str, Any] | None = None,
    answer_text: str | None = None,
):
    init = copy.deepcopy(init_state or BASE_STATE)
    curr = copy.deepcopy(curr_state or init)
    probe = _make_task_input(copy.deepcopy(init), copy.deepcopy(curr))
    expected = task.get_answer(probe)
    return task, _make_task_input(init, curr, answer=answer_text if answer_text is not None else _wrong_answer(expected))


def _positive_criteria_case(task: CriteriaTask):
    curr = copy.deepcopy(BASE_STATE)
    route = DEFAULT_ROUTE
    for raw_key, raw_value in task.criteria.items():
        key = raw_key.format(**task.params) if "{" in raw_key else raw_key
        value = _resolve_criteria_value(raw_value, task.params)
        if key == "route":
            route = {"app": "redbook", "path": str(value)}
            continue
        _set_by_path(curr, key, value)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)


def _negative_criteria_case(task: CriteriaTask):
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "redbook" in task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": TEST_OS_STATE}
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

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[cls.__name__ for cls in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer_or_get_answer(self, cls):
        has_answer_attr = cls.answer is not None
        has_get_answer_override = cls.get_answer is not AnswerTask.get_answer
        assert has_answer_attr or has_get_answer_override


class TestRedbookAccessor:
    @pytest.fixture
    def redbook(self) -> Redbook:
        return Redbook(copy.deepcopy(BASE_STATE))

    def test_defaults_are_runtime_schema_not_public_content(self):
        defaults = _load_defaults()
        assert "sampleNotes" not in defaults
        assert isinstance(defaults.get("notes"), dict)
        assert isinstance(defaults.get("comments"), dict)
        assert isinstance(defaults.get("users"), dict)
        assert {"note_0", "note_1"}.issubset(defaults["notes"].keys())
        assert set(defaults["user"]["publishedNoteIds"]) == {"note_0", "note_1"}
        assert "following" not in defaults["user"]
        assert "followers" not in defaults["user"]
        assert "followings" not in defaults["user"]
        assert "commentList" not in defaults["user"]
        assert isinstance(defaults["user"]["followingIds"], list)
        assert isinstance(defaults["user"]["followerIds"], list)
        assert isinstance(defaults["user"]["commentIds"], list)

    def test_default_notifications_live_in_runtime_defaults(self):
        defaults = _load_defaults()
        notifications = defaults.get("notifications")
        assert isinstance(notifications, list)
        assert len(notifications) >= 6
        assert {item["id"] for item in notifications[:6]} == {"n1", "n2", "n3", "n4", "n5", "n6"}
        assert all(not str(item.get("userId", "")).startswith("seed_user_") for item in notifications)

    def test_view_note_uses_full_runtime_overlay_and_derives_relationship_counts(self):
        base_note = _load_base_notes()[0]
        base_id = str(base_note["id"])
        state = copy.deepcopy(_load_defaults())
        state.setdefault("notes", {})
        state.setdefault("comments", {})
        state["notes"][base_id] = {**base_note, "title": "运行态覆盖标题"}
        state["comments"]["runtime_comment_1"] = {
            "id": "runtime_comment_1",
            "noteId": base_id,
            "userId": state["user"]["id"],
            "username": state["user"]["name"],
            "avatar": state["user"]["avatar"],
            "content": "运行态评论",
            "time": TEST_OS_STATE["time"]["timestamp"],
            "likes": 0,
            "location": state["user"]["location"],
        }
        state["user"]["likedNotes"] = [base_id]
        state["user"]["collectedNotes"] = [base_id]
        state["user"]["commentIds"] = ["runtime_comment_1"]

        note = Redbook(state).view_note(base_id)

        assert note is not None
        assert note["title"] == "运行态覆盖标题"
        assert note["authorId"] == base_note["authorId"]
        assert note["likes"] == int(base_note["likes"]) + 1
        assert note["collections"] == int(base_note["collections"]) + 1
        assert note["comments"] == int(base_note["comments"]) + 1
        assert note["commentList"][0]["id"] == "runtime_comment_1"

    def test_base_entity_overlay_does_not_backfill_missing_fields(self):
        base_note = _load_base_notes()[0]
        base_id = str(base_note["id"])
        state = copy.deepcopy(_load_defaults())
        state["notes"][base_id] = {"id": base_id, "title": "缺字段 overlay"}

        note = Redbook(state).view_note(base_id)

        assert note is not None
        assert note["title"] == "缺字段 overlay"
        assert "authorId" not in note

    def test_base_user_overlay_does_not_backfill_missing_fields(self):
        state = copy.deepcopy(_load_defaults())
        base_user_id = next(iter(Redbook(state).base_users_by_id.keys()))
        state["users"][base_user_id] = {"id": base_user_id, "name": "缺字段用户 overlay"}

        user = Redbook(state).view_user(base_user_id)

        assert user is not None
        assert user["name"] == "缺字段用户 overlay"
        assert "avatar" not in user

    def test_view_note_tombstone_hides_base_note(self):
        base_id = str(_load_base_notes()[0]["id"])
        state = copy.deepcopy(_load_defaults())
        state.setdefault("notes", {})
        state["notes"][base_id] = None

        assert Redbook(state).view_note(base_id) is None

    def test_view_note_replaces_and_hides_base_comments(self):
        base_note = next(note for note in _load_base_notes() if note.get("commentList"))
        base_id = str(base_note["id"])
        patched_comment = base_note["commentList"][0]
        hidden_comment = base_note["commentList"][1]
        state = copy.deepcopy(_load_defaults())
        state.setdefault("comments", {})
        state["comments"][patched_comment["id"]] = {
            **patched_comment,
            "id": patched_comment["id"],
            "content": "运行态覆盖评论",
            "likes": 8,
        }
        state["comments"][hidden_comment["id"]] = None

        note = Redbook(state).view_note(base_id)

        assert note is not None
        visible_comments = {comment["id"]: comment for comment in note["commentList"]}
        assert visible_comments[patched_comment["id"]]["content"] == "运行态覆盖评论"
        assert hidden_comment["id"] not in visible_comments
        assert note["comments"] == int(base_note["comments"]) - 1

    def test_base_comment_overlay_does_not_backfill_missing_fields(self):
        base_note = next(note for note in _load_base_notes() if note.get("commentList"))
        base_id = str(base_note["id"])
        base_comment = base_note["commentList"][0]
        state = copy.deepcopy(_load_defaults())
        state["comments"][base_comment["id"]] = {
            "id": base_comment["id"],
            "noteId": base_id,
            "content": "缺字段评论 overlay",
        }

        note = Redbook(state).view_note(base_id)

        assert note is not None
        visible_comments = {comment["id"]: comment for comment in note["commentList"]}
        assert visible_comments[base_comment["id"]]["content"] == "缺字段评论 overlay"
        assert "username" not in visible_comments[base_comment["id"]]

    def test_basic_properties(self, redbook: Redbook):
        defaults = _load_defaults()
        user = defaults["user"]
        assert redbook.user_id == "xiaoming"
        assert redbook.user_name == "小明"
        assert redbook.general_settings["mobileNetwork"] is True
        assert redbook.settings["language"] == "zh-CN"
        # Seed runtime-only notes (defaults.notes.note_0/note_1) sit at the front of
        # `feed_ids` (createdAt desc, before any base-feed entry). Note: these seeds
        # don't carry a `category`, so HomePage 推荐 tab filters them out in the UI —
        # they only surface via MePage 我的笔记 / 消息中心 / DetailPage. This assertion
        # is about store-level feed ordering, not UI visibility on any specific tab.
        assert redbook.feed_ids[0] == "note_0"
        assert set(redbook.following_ids) == set(user["followingIds"])
        assert set(redbook.follower_ids) == set(user["followerIds"])
        assert redbook.view_user(redbook.user_id)["following"] == len(user["followingIds"])
        assert redbook.view_user(redbook.user_id)["followers"] == len(user["followerIds"])
        assert set(redbook.liked_notes) == set(user["likedNotes"])
        assert set(redbook.collected_notes) == set(user["collectedNotes"])
        assert set(redbook.published_notes) == set(user["publishedNoteIds"])

    def test_ignores_obsolete_entities_feed_and_user_id_state(self):
        state = copy.deepcopy(BASE_STATE)
        state["entities"] = {
            "notesById": {
                "obsolete_note": {
                    "id": "obsolete_note",
                    "title": "不应读取的旧结构笔记",
                    "content": "",
                    "authorId": "obsolete_user",
                    "images": [],
                    "likes": 0,
                    "collections": 0,
                    "comments": 0,
                    "commentList": [],
                    "createdAt": TEST_OS_STATE["time"]["timestamp"],
                }
            },
            "usersById": {
                "obsolete_user": {
                    "id": "obsolete_user",
                    "name": "不应读取的旧结构用户",
                    "avatar": "",
                }
            },
        }
        state["feedIds"] = ["obsolete_note"]
        state["userIds"] = ["obsolete_user"]

        redbook = Redbook(state)

        assert "obsolete_note" not in redbook.base_notes_by_id
        assert "obsolete_note" not in redbook.feed_ids
        assert "obsolete_user" not in redbook.base_users_by_id
        assert "obsolete_user" not in redbook.base_user_ids
        with pytest.raises(ValueError):
            redbook.require_note("obsolete_note")
        with pytest.raises(ValueError):
            redbook.require_user_entity("obsolete_user")

    def test_publish_expected_changes_do_not_allow_entire_user_object(self):
        assert "redbook.user" not in REDBOOK_PUBLISH_CHANGES
        assert "redbook.user.publishedNoteIds" in REDBOOK_PUBLISH_CHANGES
        assert "redbook.notes" in REDBOOK_PUBLISH_CHANGES

    def test_newly_published_note_surfaces_in_feed_and_user_view(self):
        curr = copy.deepcopy(BASE_STATE)
        curr["notes"]["note_new"] = {
            "id": "note_new",
            "title": "新发布的搜索测试",
            "content": "刚刚发布",
            "authorId": curr["user"]["id"],
            "images": [],
            "cover": "",
            "likes": 0,
            "collections": 0,
            "comments": 0,
            "commentList": [],
            "createdAt": TEST_OS_STATE["time"]["timestamp"],
            "category": "生活",
        }
        curr["user"]["publishedNoteIds"] = ["note_new", *curr["user"]["publishedNoteIds"]]

        redbook = Redbook(curr)
        # Runtime-only notes (newly published) are prepended to feed by createdAt desc,
        # so they appear at the top of Home/Search/UserPage feeds — matching the prior
        # `addNote` prepend semantics.
        assert redbook.feed_ids[0] == "note_new"
        assert redbook.user_notes(redbook.user_id)[0]["id"] == "note_new"

    def test_note_and_profile_helpers(self, redbook: Redbook):
        defaults = _load_defaults()
        user = defaults["user"]
        assert redbook.first_liked_note_id == str(user["likedNotes"][0])
        assert redbook.first_collected_note_id == str(user["collectedNotes"][0])
        assert redbook.hot_search[0]["keyword"] == "贺娇龙因意外坠马逝世"
        assert redbook.count_value("1.2万") == pytest.approx(12000)
        # Search helper should return a valid note and author name.
        first_base_note = _load_base_notes()[0]
        keyword = str(first_base_note.get("category") or first_base_note.get("title") or "")[:2]
        note = redbook.first_search_note(keyword)
        assert isinstance(note.get("id"), str)
        assert isinstance(redbook.note_author(note).get("name"), str)
        # First collected author field should be retrievable.
        assert redbook.first_collected_author_field("location") is not None
        # Followed user note count should be non-negative.
        followed_name = redbook.require_user_entity(str(user["followingIds"][0]))["name"]
        assert redbook.followed_user_note_count(followed_name) >= 0

    def test_seeded_chat_helpers(self):
        # BASE_STATE 已经从 defaults.json 加载到两条 seed chats，无需手动注入。
        redbook = Redbook(copy.deepcopy(BASE_STATE))
        defaults = _load_defaults()
        assert redbook.first_chat()["userId"] in set(defaults["user"]["followingIds"])
        assert redbook.first_chat_last_message() == "周末要不要一起去逛逛？"

    def test_require_helpers_raise(self, redbook: Redbook):
        with pytest.raises(ValueError):
            redbook.first_feed_note_with_title_keyword("不存在的标题")
        # `first_chat_last_message` should raise on a chat-less state; BASE_STATE
        # now has seed chats from defaults.json, so construct an empty state for the assertion.
        empty_chat_state = copy.deepcopy(BASE_STATE)
        empty_chat_state["chats"] = []
        with pytest.raises(ValueError):
            Redbook(empty_chat_state).first_chat_last_message()

    def test_comment_and_diff_helpers(self):
        curr = copy.deepcopy(BASE_STATE)
        base_notes = _load_base_notes()
        target_note_id = str(base_notes[0]["id"])
        _add_comment(curr, target_note_id, "测试评论")
        another_note = next(note for note in base_notes if note.get("commentList"))
        another_note_id = str(another_note["id"])
        first_root = another_note["commentList"][0]["id"]
        _add_comment(curr, another_note_id, "测试回复", reply_to_id=first_root)
        redbook = Redbook(curr)
        assert redbook.note_has_comment(target_note_id, "测试评论") is True
        assert redbook.note_has_reply(another_note_id, "测试回复", first_root) is True

    def test_chat_and_diff_helpers(self):
        curr = copy.deepcopy(BASE_STATE)
        defaults = _load_defaults()
        followed_user_id = str(defaults["user"]["followingIds"][0])
        _append_chat_message(curr, followed_user_id, "你好")
        # follow someone not already followed
        unfollowed = next(uid for uid in Redbook(curr).users_by_id.keys() if uid not in set(curr["user"]["followingIds"]) and uid != "xiaoming")
        _follow_user(curr, unfollowed)
        collected = set(curr["user"]["collectedNotes"])
        liked = set(curr["user"]["likedNotes"])
        note_id = next(str(note["id"]) for note in _load_base_notes() if str(note["id"]) not in collected and str(note["id"]) not in liked)
        _collect_note(curr, note_id)
        _like_note(curr, note_id)
        redbook = Redbook(curr, init=copy.deepcopy(BASE_STATE))
        assert redbook.chat_has_message(followed_user_id, "你好") is True
        assert unfollowed in redbook.added_to_following_ids()
        assert note_id in redbook.added_to_collected()
        assert note_id in redbook.added_to_liked()

    def test_removed_helpers(self):
        curr = copy.deepcopy(BASE_STATE)
        defaults = _load_defaults()
        removed_like_id = str(defaults["user"]["likedNotes"][0])
        _remove_like(curr, removed_like_id)
        # remove collected by overwriting to a subset
        curr["user"]["collectedNotes"] = [str(defaults["user"]["collectedNotes"][-1])]
        # remove one following by overwriting to a subset
        curr["user"]["followingIds"] = [str(defaults["user"]["followingIds"][0])]
        redbook = Redbook(curr, init=copy.deepcopy(BASE_STATE))
        assert removed_like_id in redbook.removed_from_liked()
        assert str(defaults["user"]["collectedNotes"][0]) in redbook.removed_from_collected()
        assert str(defaults["user"]["followingIds"][1]) in redbook.removed_from_following_ids()

    def test_publish_helpers(self):
        curr = copy.deepcopy(BASE_STATE)
        _publish_note(curr, "测试标题", "测试正文")
        redbook = Redbook(curr, init=copy.deepcopy(BASE_STATE))
        ok, actual = redbook.has_new_published_note_contains("测试正文")
        assert ok is True
        assert "测试正文" in actual
        check = redbook.check_note_published(
            title_pred=lambda title: title == "测试标题",
            content_pred=lambda content: "测试正文" in content,
        )
        assert check["passed"] is True
        check_with_named_args = redbook.check_note_published(
            title_exact="测试标题",
            content_keywords=("测试", "正文"),
        )
        assert check_with_named_args["passed"] is True

    def test_check_note_published_named_args_and_content_predicate(self):
        curr = copy.deepcopy(BASE_STATE)
        _publish_note(curr, "周末徒步", "路线2小时，记得带水")
        redbook = Redbook(curr, init=copy.deepcopy(BASE_STATE))
        assert redbook.check_note_published(
            title_exact="周末徒步",
            content_keywords=("2小时", "带水"),
        )["passed"] is True
        assert redbook.check_note_published(
            title_exact="周末徒步",
            content_keywords=("2小时",),
            content_pred=lambda content: "带水" in content and "路线" in content,
        )["passed"] is True
        assert redbook.check_note_published(
            title_exact="周末徒步",
            content_keywords=("不存在",),
        )["passed"] is False

    def test_check_note_published_supports_normalized_title_and_new_only(self):
        init = copy.deepcopy(BASE_STATE)
        curr = copy.deepcopy(BASE_STATE)
        _publish_note(curr, "最便宜 电风扇!!! 2026", "这款最便宜，值得买")
        redbook = Redbook(curr, init=init)
        check = redbook.check_note_published(
            text_keywords=("最便宜电风扇2026",),
            new_only=True,
        )
        assert check["passed"] is True

    def test_check_note_published_supports_content_lines_and_draft_fallback(self):
        curr = copy.deepcopy(BASE_STATE)
        curr["publishDraft"]["text"] = "购物清单 牛奶  面包\n明天记得买水果"
        redbook = Redbook(curr, init=copy.deepcopy(BASE_STATE))
        check = redbook.check_note_published(
            content_lines=("购物清单 牛奶 面包", "明天记得买水果"),
            new_only=True,
            allow_draft=True,
        )
        assert check["passed"] is True
def _collect_search_positive_case():
    task = _tasks_module.CollectSearchNote(keyword=_current_uncollected_search_keyword())
    curr = copy.deepcopy(BASE_STATE)
    note_id = Redbook(curr).first_search_note(task.p.keyword)["id"]
    _collect_note(curr, note_id)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _collect_search_negative_case():
    task = _tasks_module.CollectSearchNote(keyword=_current_uncollected_search_keyword())
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _like_first_feed_positive_case():
    task = _tasks_module.LikeFirstFeedNote(category="food")
    curr = copy.deepcopy(BASE_STATE)
    note_id = Redbook(curr).visible_discover_notes_for_category(task.p.category, limit=40)[0]["id"]
    _like_note(curr, note_id)
    curr["_temp"]["activeCategory"] = task.p.category
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _like_first_feed_negative_case():
    task = _tasks_module.LikeFirstFeedNote(category="food")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _uncollect_positive_case():
    task = _tasks_module.UncollectFirstCollectedNote()
    curr = copy.deepcopy(BASE_STATE)
    target = Redbook(curr).first_collected_note()["id"]
    curr["user"]["collectedNotes"] = [item for item in curr["user"]["collectedNotes"] if item != target]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _uncollect_negative_case():
    task = _tasks_module.UncollectFirstCollectedNote()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _dm_positive_case():
    task = _tasks_module.DMFollowedUser(
        username=_current_followed_username(),
        message="你好呀，最近更新很不错",
    )
    curr = copy.deepcopy(BASE_STATE)
    user_id = Redbook(curr).require_user_by_name(task.p.username)["id"]
    _append_chat_message(curr, user_id, task.p.message)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _dm_negative_case():
    task = _tasks_module.DMFollowedUser(
        username=_current_followed_username(),
        message="你好呀，最近更新很不错",
    )
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))
def _publish_positive_case():
    task = _tasks_module.PublishNoteWithTitleAndContent(
        title="周末逛展记录",
        content="今天看了两个展，最喜欢第二个沉浸式空间，照片晚点整理。",
    )
    curr = copy.deepcopy(BASE_STATE)
    _publish_note(curr, task.p.title, task.p.content)
    curr["publishDraft"]["title"] = task.p.title
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _publish_negative_case():
    task = _tasks_module.PublishNoteWithTitleAndContent(
        title="周末逛展记录",
        content="今天看了两个展，最喜欢第二个沉浸式空间，照片晚点整理。",
    )
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _like_feed_report_positive_case():
    task = _tasks_module.LikeFeedNoteAndReportLikes(keyword=_current_recommend_keyword())
    init = copy.deepcopy(BASE_STATE)
    note_id = str(_current_recommend_note()["id"])
    _remove_initial_like(init, note_id)
    curr = copy.deepcopy(init)
    _like_note(curr, note_id)
    likes = Redbook(curr).view_note(note_id)["likes"]
    return task, _make_task_input(init, curr, answer=f"现在一共有{likes}个赞")


def _like_feed_report_negative_case():
    task = _tasks_module.LikeFeedNoteAndReportLikes(keyword=_current_recommend_keyword())
    init = copy.deepcopy(BASE_STATE)
    note_id = str(_current_recommend_note()["id"])
    _remove_initial_like(init, note_id)
    curr = copy.deepcopy(init)
    _like_note(curr, note_id)
    return task, _make_task_input(init, curr, answer="现在一共有1个赞")


def _like_feed_report_negative_state_case():
    task = _tasks_module.LikeFeedNoteAndReportLikes(keyword=_current_recommend_keyword())
    base = copy.deepcopy(BASE_STATE)
    likes = _current_recommend_note()["likes"]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), base, answer=f"现在一共有{likes}个赞")


def _first_chat_positive_case():
    task = _tasks_module.CheckFirstChatLastMessage()
    # BASE_STATE 已经从 defaults.json seed 出两条 chat，不再需要 _seed_chats 助手。
    return _positive_answer_case(task)


def _first_chat_negative_case():
    task = _tasks_module.CheckFirstChatLastMessage()
    return _negative_answer_case(task)
def _collect_report_positive_case():
    task = _tasks_module.SearchCollectAndReportAuthor(keyword=_current_uncollected_search_keyword())
    curr = copy.deepcopy(BASE_STATE)
    rb = Redbook(curr)
    note = rb.first_search_note(task.p.keyword)
    author = rb.note_author(note)
    _collect_note(curr, note["id"])
    return task, _make_task_input(
        copy.deepcopy(BASE_STATE),
        curr,
        answer=f"作者有{author['followers']}粉丝，获赞{author['likesAndCollections']}",
    )


def _collect_report_negative_case():
    task = _tasks_module.SearchCollectAndReportAuthor(keyword=_current_uncollected_search_keyword())
    curr = copy.deepcopy(BASE_STATE)
    note = Redbook(curr).first_search_note(task.p.keyword)
    _collect_note(curr, note["id"])
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer="作者有1粉丝，获赞2")


def _collect_report_negative_state_case():
    task = _tasks_module.SearchCollectAndReportAuthor(keyword=_current_uncollected_search_keyword())
    rb = Redbook(BASE_STATE)
    note = rb.first_search_note(task.p.keyword)
    author = rb.note_author(note)
    return task, _make_task_input(
        copy.deepcopy(BASE_STATE),
        copy.deepcopy(BASE_STATE),
        answer=f"作者有{author['followers']}粉丝，获赞{author['likesAndCollections']}",
    )


def _collect_feed_dm_positive_case():
    task = _tasks_module.CollectFeedNoteAndDMAuthor(
        keyword=_current_recommend_keyword(),
        message="这篇内容很有启发，谢谢分享",
    )
    init = copy.deepcopy(BASE_STATE)
    note = _current_recommend_note()
    _remove_initial_collection(init, str(note["id"]))
    curr = copy.deepcopy(init)
    rb = Redbook(curr)
    author = rb.note_author(note)
    _collect_note(curr, note["id"])
    _append_chat_message(curr, author["id"], task.p.message)
    return task, _make_task_input(init, curr)


def _collect_feed_dm_negative_case():
    task = _tasks_module.CollectFeedNoteAndDMAuthor(
        keyword=_current_recommend_keyword(),
        message="这篇内容很有启发，谢谢分享",
    )
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _publish_share_positive_case():
    task = _tasks_module.PublishAndShareToFollowing(
        title="春日散步计划",
        username=_current_followed_username(),
    )
    curr = copy.deepcopy(BASE_STATE)
    _publish_note(curr, task.p.title, "今天打算沿着河边慢慢走一圈。")
    curr["publishDraft"]["title"] = task.p.title
    target_user_id = Redbook(curr).require_user_by_name(task.p.username)["id"]
    _append_chat_message(curr, target_user_id, task.p.title)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _publish_share_negative_case():
    task = _tasks_module.PublishAndShareToFollowing(
        title="春日散步计划",
        username=_current_followed_username(),
    )
    curr = copy.deepcopy(BASE_STATE)
    _publish_note(curr, task.p.title, "今天打算沿着河边慢慢走一圈。")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _reply_feed_positive_case():
    task = _tasks_module.ReplyToFeedNoteFirstComment(
        keyword=_current_replyable_recommend_keyword(),
        reply="这个回复我也很认同",
    )
    curr = copy.deepcopy(BASE_STATE)
    note = Redbook(curr).visible_discover_replyable_notes("recommend", limit=40)[0]
    first_root = Redbook(curr).first_root_comment(note["id"])
    _add_comment(curr, note["id"], task.p.reply, reply_to_id=first_root["id"])
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _reply_feed_negative_case():
    task = _tasks_module.ReplyToFeedNoteFirstComment(
        keyword=_current_replyable_recommend_keyword(),
        reply="这个回复我也很认同",
    )
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _search_note_empty_answer_case():
    task = _tasks_module.CheckSearchNoteField(keyword=_current_search_keyword(), field="authorName")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer=None)


def _following_user_note_count_chinese_positive_case():
    username = _current_followed_username(require_notes=True)
    task = _tasks_module.CheckFollowingUserNoteCount(username=username)
    expected = Redbook(BASE_STATE).followed_user_note_count(username)
    return _positive_answer_case(task, answer_text=f"TA 一共发了{int_to_chinese(expected)}篇笔记")


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("CheckMyProfileField", lambda: _positive_answer_case(_tasks_module.CheckMyProfileField(field="followers"))),
    ("CheckSearchNoteField", lambda: _positive_answer_case(_tasks_module.CheckSearchNoteField(keyword=_current_search_keyword(), field="authorName"))),
    ("CollectSearchNote", _collect_search_positive_case),
    ("LikeFirstFeedNote", _like_first_feed_positive_case),
    ("CheckSearchUserField", lambda: _positive_answer_case(_tasks_module.CheckSearchUserField(username=_current_searchable_username(), field="followers"))),
    ("UncollectFirstCollectedNote", _uncollect_positive_case),
    ("DMFollowedUser", _dm_positive_case),
    ("PublishNoteWithTitleAndContent", _publish_positive_case),
    ("LikeFeedNoteAndReportLikes", _like_feed_report_positive_case),
    ("CheckFollowingUserNoteCount", lambda: _positive_answer_case(_tasks_module.CheckFollowingUserNoteCount(username=_current_followed_username(require_notes=True)))),
    ("CheckFirstChatLastMessage", _first_chat_positive_case),
    ("CheckFirstCollectedAuthorField", lambda: _positive_answer_case(_tasks_module.CheckFirstCollectedAuthorField(field="location"))),
    ("SearchFirstNoteAuthorTopLikedTitle", lambda: _positive_answer_case(_tasks_module.SearchFirstNoteAuthorTopLikedTitle(keyword="美食"))),
    ("SearchCollectAndReportAuthor", _collect_report_positive_case),
    ("CollectFeedNoteAndDMAuthor", _collect_feed_dm_positive_case),
    ("PublishAndShareToFollowing", _publish_share_positive_case),
    ("ReplyToFeedNoteFirstComment", _reply_feed_positive_case),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("CheckMyProfileField", lambda: _negative_answer_case(_tasks_module.CheckMyProfileField(field="followers"))),
    ("CheckSearchNoteField", lambda: _negative_answer_case(_tasks_module.CheckSearchNoteField(keyword=_current_search_keyword(), field="authorName"))),
    ("CollectSearchNote", _collect_search_negative_case),
    ("LikeFirstFeedNote", _like_first_feed_negative_case),
    ("CheckSearchUserField", lambda: _negative_answer_case(_tasks_module.CheckSearchUserField(username=_current_searchable_username(), field="followers"))),
    ("UncollectFirstCollectedNote", _uncollect_negative_case),
    ("DMFollowedUser", _dm_negative_case),
    ("PublishNoteWithTitleAndContent", _publish_negative_case),
    ("LikeFeedNoteAndReportLikes", _like_feed_report_negative_case),
    ("CheckFollowingUserNoteCount", lambda: _negative_answer_case(_tasks_module.CheckFollowingUserNoteCount(username=_current_followed_username(require_notes=True)))),
    ("CheckFirstChatLastMessage", _first_chat_negative_case),
    ("CheckFirstCollectedAuthorField", lambda: _negative_answer_case(_tasks_module.CheckFirstCollectedAuthorField(field="location"))),
    ("SearchFirstNoteAuthorTopLikedTitle", lambda: _negative_answer_case(_tasks_module.SearchFirstNoteAuthorTopLikedTitle(keyword="美食"))),
    ("SearchCollectAndReportAuthor", _collect_report_negative_case),
    ("CollectFeedNoteAndDMAuthor", _collect_feed_dm_negative_case),
    ("PublishAndShareToFollowing", _publish_share_negative_case),
    ("ReplyToFeedNoteFirstComment", _reply_feed_negative_case),
]

EXTRA_POSITIVE_CASES = [
    (
        "CheckFollowingUserNoteCount_chinese_num",
        _following_user_note_count_chinese_positive_case,
    ),
]

EXTRA_NEGATIVE_CASES = [
    ("LikeFeedNoteAndReportLikes_wrong_state", _like_feed_report_negative_state_case),
    ("SearchCollectAndReportAuthor_wrong_state", _collect_report_negative_state_case),
    ("CheckSearchNoteField_empty_answer", _search_note_empty_answer_case),
]


class TestTaskJudgeMatrixOffline:
    @pytest.mark.parametrize("task_name,builder", OFFLINE_JUDGE_POSITIVE_CASES, ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES])
    def test_positive_case(self, task_name: str, builder):
        task, judge_input = builder()
        result = task.evaluate(judge_input)
        assert result.passed, f"{task_name} should pass, got issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize("task_name,builder", OFFLINE_JUDGE_NEGATIVE_CASES, ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES])
    def test_negative_case(self, task_name: str, builder):
        task, judge_input = builder()
        result = task.evaluate(judge_input)
        assert not result.success, f"{task_name} should fail"

    @pytest.mark.parametrize("task_name,builder", EXTRA_POSITIVE_CASES, ids=[name for name, _ in EXTRA_POSITIVE_CASES])
    def test_extra_positive_case(self, task_name: str, builder):
        task, judge_input = builder()
        result = task.evaluate(judge_input)
        assert result.passed, f"{task_name} should pass"

    @pytest.mark.parametrize("task_name,builder", EXTRA_NEGATIVE_CASES, ids=[name for name, _ in EXTRA_NEGATIVE_CASES])
    def test_extra_negative_case(self, task_name: str, builder):
        task, judge_input = builder()
        result = task.evaluate(judge_input)
        assert not result.success, f"{task_name} should fail"

    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == set(ALL_TASK_IDS)
        assert negative == set(ALL_TASK_IDS)
