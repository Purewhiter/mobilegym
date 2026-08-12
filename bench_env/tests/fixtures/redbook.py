"""Shared RedBook base-state fixtures (extracted from tests/redbook/test_tasks.py)."""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any

from bench_env.task.redbook.app import Redbook

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
_RELATIVE_PATTERN = re.compile(r"^-(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$")


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "apps" / "RedBook" / "data" / "defaults.json"
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


def _collect_note(state: dict[str, Any], note_id: str) -> None:
    if note_id not in state["user"]["collectedNotes"]:
        state["user"]["collectedNotes"].append(note_id)


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
