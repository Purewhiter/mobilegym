"""Shared Notes base-state fixtures (extracted from tests/notes/test_tasks.py)."""

from __future__ import annotations

import copy
import datetime
import json
from pathlib import Path
from typing import Any


def _parse_timestamp(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    return int(datetime.datetime.fromisoformat(str(value)).timestamp() * 1000)


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "system" / "Notes" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _make_base_state() -> dict[str, Any]:
    defaults = _load_defaults()
    notes = [
        {**note, "updatedAt": _parse_timestamp(note["updatedAt"])}
        for note in defaults["sampleNotes"]
    ]
    todos = [
        {**todo, "updatedAt": _parse_timestamp(todo["updatedAt"])}
        for todo in defaults["sampleTodos"]
    ]
    return {
        "notes": notes,
        "todos": todos,
        "folders": [
            {"id": "all", "name": "全部", "system": True},
            {"id": "call", "name": "通话笔记", "system": True},
            {"id": "unfiled", "name": "未分类", "system": True},
        ],
        "selectedFolderId": "all",
        "settings": copy.deepcopy(defaults["settings"]),
    }


BASE_STATE = _make_base_state()


def _add_note(
    state: dict[str, Any],
    title: str,
    *,
    content: str = "",
    folder_id: str = "unfiled",
    pinned: bool = False,
    is_private: bool = False,
    trashed_at: int | None = None,
    alarm_at: int | None = None,
) -> dict[str, Any]:
    next_ts = max(int(note.get("updatedAt", 0) or 0) for note in state["notes"]) + 1000
    note = {
        "id": f"test_note_{len(state['notes']) + 1}",
        "title": title,
        "content": content,
        "updatedAt": next_ts,
        "folderId": folder_id,
    }
    if pinned:
        note["pinned"] = True
    if is_private:
        note["isPrivate"] = True
    if trashed_at is not None:
        note["trashedAt"] = trashed_at
    if alarm_at is not None:
        note["alarmAt"] = alarm_at
    state["notes"].insert(0, note)
    return note
