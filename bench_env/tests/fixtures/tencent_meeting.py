"""Shared Tencent Meeting base-state fixtures (extracted from tests/tencent_meeting/test_tasks.py)."""

from __future__ import annotations

import copy
import datetime
import json
import re
from pathlib import Path
from typing import Any

TEST_BASE_DT = datetime.datetime(2026, 3, 16, 9, 0, 0)
TEST_OS_STATE = {"time": {"timestamp": int(TEST_BASE_DT.timestamp() * 1000)}}


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "apps" / "TencentMeeting" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_relative_timestamp(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    if not isinstance(value, str):
        raise ValueError(f"Unsupported timestamp value: {value!r}")
    match = re.fullmatch(r"([+-])(\d+)([smhd])", value.strip())
    if match:
        sign, amount_str, unit = match.groups()
        amount = int(amount_str)
        multiplier = {
            "s": 1000,
            "m": 60 * 1000,
            "h": 60 * 60 * 1000,
            "d": 24 * 60 * 60 * 1000,
        }[unit]
        delta = amount * multiplier
        if sign == "-":
            return TEST_OS_STATE["time"]["timestamp"] - delta
        return TEST_OS_STATE["time"]["timestamp"] + delta
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return int(datetime.datetime.strptime(value, fmt).timestamp() * 1000)
        except ValueError:
            continue
    raise ValueError(f"Unsupported timestamp string: {value!r}")


def _normalized_defaults() -> dict[str, Any]:
    raw = _load_defaults()
    state = copy.deepcopy(raw)
    for meeting in state["history"]:
        meeting["startTime"] = _resolve_relative_timestamp(meeting["startTime"])
        if "endTime" in meeting:
            meeting["endTime"] = _resolve_relative_timestamp(meeting["endTime"])
        for participation in meeting.get("participations", []):
            participation["joinTime"] = _resolve_relative_timestamp(participation["joinTime"])
    for meeting in state["scheduledMeetings"]:
        meeting["startTime"] = _resolve_relative_timestamp(meeting["startTime"])
        meeting["createdAt"] = _resolve_relative_timestamp(meeting["createdAt"])
    for meeting in state["ongoingMeetings"]:
        meeting["startTime"] = _resolve_relative_timestamp(meeting["startTime"])
    state["activeMeeting"] = None
    state["currentScheduledMeeting"] = None
    return state


BASE_STATE = _normalized_defaults()


def _make_active_meeting(
    *,
    title: str,
    host_id: str,
    host_name: str,
    meeting_id: str = "419827365",
    user_name: str = "小明",
    is_muted: bool = True,
    is_video_on: bool = False,
    extra_messages: list[dict[str, Any]] | None = None,
    is_sharing: bool = False,
) -> dict[str, Any]:
    return {
        "id": "meeting_live_001",
        "meetingId": meeting_id,
        "title": title,
        "startTime": TEST_OS_STATE["time"]["timestamp"] - 15 * 60 * 1000,
        "duration": 90,
        "timezone": "(GMT+08:00) 中国标准时间",
        "hostId": host_id,
        "type": "quick",
        "participants": [
            {
                "id": host_id,
                "name": host_name,
                "isHost": True,
                "isMuted": True,
                "isVideoOn": False,
            },
            {
                "id": "user_001",
                "name": user_name,
                "avatar": "",
                "isHost": False,
                "isMuted": is_muted,
                "isVideoOn": is_video_on,
            },
        ],
        "joinTime": TEST_OS_STATE["time"]["timestamp"] - 10 * 60 * 1000,
        "settings": {
            "isMuted": is_muted,
            "isVideoOn": is_video_on,
            "isSharing": is_sharing,
        },
        "chatMessages": extra_messages or [],
    }


def _make_new_scheduled_meeting(
    *,
    topic: str,
    duration: int = 60,
    repeat_type: str = "none",
    password: str | None = None,
    invitees: list[dict[str, Any]] | None = None,
    calendar: bool = True,
    auto_use_overtime_card: bool | None = None,
) -> dict[str, Any]:
    settings = {
        "calendar": calendar,
        "waitingRoom": False,
        "enableSignUp": False,
        "allowBeforeHost": True,
        "muteOnJoin": "auto_after_6",
        "watermark": False,
        "allowMultiDevice": True,
        "forbidAddContact": False,
        "autoCloudRecord": False,
        "autoTranscribe": False,
        "allowUploadDoc": True,
    }
    if password is not None:
        settings["password"] = password
    if auto_use_overtime_card is not None:
        settings["autoUseOvertimeCard"] = auto_use_overtime_card
    return {
        "id": f"scheduled_{topic}",
        "meetingId": "888 666 1234",
        "title": topic,
        "startTime": TEST_OS_STATE["time"]["timestamp"] + 24 * 60 * 60 * 1000,
        "duration": duration,
        "timezone": "(GMT+08:00) 中国标准时间",
        "repeatType": repeat_type,
        "hostId": "user_001",
        "invitees": invitees or [],
        "settings": settings,
        "status": "pending",
        "createdAt": TEST_OS_STATE["time"]["timestamp"],
    }
