"""
Tencent Meeting task correctness tests.
"""

from __future__ import annotations

import copy
import datetime
import inspect
import json
import random
import re
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.task.tencent_meeting import tasks as _tasks_module
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

TEST_BASE_DT = datetime.datetime(2026, 3, 16, 9, 0, 0)
TEST_OS_STATE = {"time": {"timestamp": int(TEST_BASE_DT.timestamp() * 1000)}}
DEFAULT_ROUTE = {"app": "tencent_meeting", "path": "/"}


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "apps" / "TencentMeeting" / "data" / "defaults.json"
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


def _full_state(app_state: dict[str, Any]) -> dict[str, Any]:
    return {"apps": {"tencent_meeting": app_state}, "os": TEST_OS_STATE}


def _make_input(
    init_app_state: dict[str, Any],
    curr_app_state: dict[str, Any],
    *,
    answer: str | None = None,
    route: dict[str, Any] | None = None,
) -> Any:
    return make_judge_input(
        _full_state(init_app_state),
        _full_state(curr_app_state),
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _clone_state() -> dict[str, Any]:
    return copy.deepcopy(BASE_STATE)


def _set_nested(state: dict[str, Any], path: str, value: Any) -> None:
    parts = path.split(".")
    current = state
    for part in parts[:-1]:
        current = current[part]
    current[parts[-1]] = value


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


def _matching_answer(task: BaseTask, expected: Any, curr_state: dict[str, Any]) -> str:
    if isinstance(expected, dict):
        if (
            task.__class__.__name__ == "FindMeetingHistory"
            and isinstance(expected.get("duration"), (int, float))
        ):
            return f"{expected['start_time']} {int(expected['duration'])}分钟"
        return " ".join(str(value) for value in expected.values())
    if isinstance(expected, re.Pattern):
        tm = TencentMeeting(curr_state)
        if task.__class__.__name__ == "CheckPersonalRoomId":
            return tm.personal_room["meetingId"]
        if task.__class__.__name__ == "CheckPendingMeetingId":
            return tm.find_scheduled_meeting(task.p.topic)["meetingId"]
        raise ValueError(f"Unhandled regex answer task: {task.__class__.__name__}")
    if isinstance(expected, (int, float)):
        return str(expected)
    return str(expected)


def _positive_answer_case(task: BaseTask, curr_state: dict[str, Any]) -> tuple[BaseTask, Any]:
    init_state = _clone_state()
    probe_input = _make_input(init_state, curr_state)
    expected = task.get_answer(probe_input)
    answer = _matching_answer(task, expected, curr_state)
    return task, _make_input(init_state, curr_state, answer=answer)


def _negative_answer_case(task: BaseTask, curr_state: dict[str, Any]) -> tuple[BaseTask, Any]:
    return task, _make_input(_clone_state(), curr_state, answer="完全错误的答案")


def _positive_criteria_case(task: CriteriaTask) -> tuple[BaseTask, Any]:
    init_state = _clone_state()
    curr_state = _clone_state()
    for key, value in task.criteria.items():
        resolved = task._format_value(value)
        _set_nested(curr_state, key, resolved)
    return task, _make_input(init_state, curr_state)


def _negative_criteria_case(task: CriteriaTask) -> tuple[BaseTask, Any]:
    state = _clone_state()
    return task, _make_input(state, state)


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "tencent_meeting" in task.apps

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
            assert "default" in schema

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[c.__name__ for c in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer_or_get_answer(self, cls):
        has_answer_attr = cls.answer is not None
        has_get_answer_override = cls.get_answer is not AnswerTask.get_answer
        assert has_answer_attr or has_get_answer_override


class TestTencentMeetingAccessor:
    @pytest.fixture
    def tm(self) -> TencentMeeting:
        return TencentMeeting(_clone_state(), init=_clone_state())

    def test_sampling_helper(self):
        pair = TencentMeeting.sample_two_participation_topics({}, random.Random(0))
        assert pair["topic1"] != pair["topic2"]

    def test_meeting_id_pattern(self):
        pattern = TencentMeeting.meeting_id_pattern("123 456 7890")
        assert pattern.search("1234567890")
        assert pattern.search("123 456 7890")

    def test_history_lookup(self, tm: TencentMeeting):
        result = tm.history_meeting_start_and_duration("长时间研讨会")
        assert result == {"start_time": "14:00", "duration": 180}
        assert tm.history_meeting_attendee_names("小明的快速会议") == ["小明", "测试用户1"]

    def test_message_and_contact_counts(self, tm: TencentMeeting):
        assert tm.system_message_count() == 2
        assert tm.latest_system_message_content() == "专业版新权益：会中展示认证身份"
        assert tm.friend_hosted_history_meeting_count() == 8

    def test_history_aggregations(self, tm: TencentMeeting):
        assert tm.count_history_meetings_on_date("2026-02-03") == 5
        assert tm.count_history_meetings_on_date("2026-02-04") == 3
        assert tm.total_participation_minutes("长时间研讨会") == 105
        assert tm.total_participation_minutes_on_date("2026-02-03") == 249
        assert tm.second_participation_time("长时间研讨会") == "15:00"

    def test_extreme_meetings(self, tm: TencentMeeting):
        assert tm.longest_history_meeting()["title"] == "长时间研讨会"
        top = tm.history_meeting_with_most_participants()
        assert top["title"] == "项目周会"
        assert len(top["participants"]) == 4

    def test_new_scheduled_meeting_lookup(self, tm: TencentMeeting):
        curr = _clone_state()
        curr["scheduledMeetings"] = [
            _make_new_scheduled_meeting(topic="预算评审会"),
            *curr["scheduledMeetings"],
        ]
        tm_curr = TencentMeeting(curr, init=_clone_state())
        assert tm_curr.new_scheduled_meeting_by_title("预算评审会") is not None
        assert tm_curr.new_scheduled_meeting_by_title("不存在") is None

    def test_active_meeting_checks(self):
        curr = _clone_state()
        curr["activeMeeting"] = _make_active_meeting(
            title="小明的快速会议",
            host_id="user_001",
            host_name="小明",
            meeting_id=curr["personalRoom"]["meetingId"],
            is_muted=True,
            is_video_on=True,
        )
        tm_curr = TencentMeeting(curr, init=_clone_state())
        assert tm_curr.check_active_meeting_exists()["passed"]
        assert tm_curr.check_active_meeting_room_source(use_personal_room=True)["passed"]
        assert not tm_curr.check_active_meeting_room_source(use_personal_room=False)["passed"]


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("ConfigAudioSettings", lambda: _positive_criteria_case(_tasks_module.ConfigAudioSettings(mic_on=False, speaker_on=False))),
    ("CheckPersonalRoomId", lambda: _positive_answer_case(_tasks_module.CheckPersonalRoomId(), _clone_state())),
    ("CheckContactCount", lambda: _positive_answer_case(_tasks_module.CheckContactCount(), _clone_state())),
    ("ToggleNotification", lambda: _positive_criteria_case(_tasks_module.ToggleNotification(notifications=False))),
    ("FindMeetingHistory", lambda: _positive_answer_case(_tasks_module.FindMeetingHistory(topic="长时间研讨会"), _clone_state())),
    ("StartFastMeeting", lambda: (
        _tasks_module.StartFastMeeting(video_on=True, mute_on=True, use_personal_room=True),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "activeMeeting": _make_active_meeting(
                    title="小明的快速会议",
                    host_id="user_001",
                    host_name="小明",
                    meeting_id=_clone_state()["personalRoom"]["meetingId"],
                    is_muted=True,
                    is_video_on=True,
                ),
            },
        ),
    )),
    ("ConfigGeneralSettings", lambda: _positive_criteria_case(_tasks_module.ConfigGeneralSettings(safe_drive=False, dark_mode=False))),
    ("ConfigVideoSettings", lambda: _positive_criteria_case(_tasks_module.ConfigVideoSettings(mirror=False, preview=True))),
    ("ChatInMeeting", lambda: (
        _tasks_module.ChatInMeeting(host_name="老王", topic="老王的快速会议", message="大家好，我到了"),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "activeMeeting": _make_active_meeting(
                    title="老王的快速会议",
                    host_id="host_laowang",
                    host_name="老王",
                    extra_messages=[{
                        "id": "msg_001",
                        "text": "大家好，我到了",
                        "sender": "小明",
                        "senderId": "user_001",
                        "time": TEST_OS_STATE["time"]["timestamp"],
                        "to": "所有人",
                        "toId": "all",
                    }],
                ),
            },
        ),
    )),
    ("ConfigPrivacySettings", lambda: _positive_criteria_case(_tasks_module.ConfigPrivacySettings(hide_non_video=True, hide_self=True))),
    ("ConfigShowIdentity", lambda: _positive_criteria_case(_tasks_module.ConfigShowIdentity(show_identity=True))),
    ("CheckPendingMeetingId", lambda: _positive_answer_case(_tasks_module.CheckPendingMeetingId(topic="项目例会"), _clone_state())),
    ("CountOngoingMeetings", lambda: _positive_answer_case(_tasks_module.CountOngoingMeetings(), _clone_state())),
    ("ModifyScheduledMeetingTopic", lambda: (
        _tasks_module.ModifyScheduledMeetingTopic(old_topic="项目例会", new_topic="产品需求评审"),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "scheduledMeetings": [
                    {
                        **meeting,
                        "title": "产品需求评审",
                    }
                    if meeting["title"] == "项目例会" else meeting
                    for meeting in _clone_state()["scheduledMeetings"]
                ],
            },
        ),
    )),
    ("CheckScheduledMeetingEndTime", lambda: _positive_answer_case(_tasks_module.CheckScheduledMeetingEndTime(topic="项目例会"), _clone_state())),
    ("JoinMeetingAndRename", lambda: (
        _tasks_module.JoinMeetingAndRename(host_name="李四", topic="技术方案评审", name="小明-北京", mute_on=True),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "activeMeeting": _make_active_meeting(
                    title="技术方案评审",
                    host_id="user_lisi",
                    host_name="李四",
                    user_name="小明-北京",
                    is_muted=True,
                ),
            },
        ),
    )),
    ("CheckMeetingAttendees", lambda: _positive_answer_case(_tasks_module.CheckMeetingAttendees(), _clone_state())),
    ("ScheduleMeeting", lambda: (
        _tasks_module.ScheduleMeeting(topic="预算评审会", duration=60, pin="2468"),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "scheduledMeetings": [
                    _make_new_scheduled_meeting(topic="预算评审会", duration=60, password="2468"),
                    *_clone_state()["scheduledMeetings"],
                ],
            },
            answer="888 666 1234",
        ),
    )),
    ("ScheduleRegularMeeting", lambda: (
        _tasks_module.ScheduleRegularMeeting(topic="每周同步会", repeat_type="weekly"),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "scheduledMeetings": [
                    _make_new_scheduled_meeting(topic="每周同步会", repeat_type="weekly"),
                    *_clone_state()["scheduledMeetings"],
                ],
            },
        ),
    )),
    ("CountFriendMeetings", lambda: _positive_answer_case(_tasks_module.CountFriendMeetings(), _clone_state())),
    ("GetSecondParticipationTime", lambda: _positive_answer_case(_tasks_module.GetSecondParticipationTime(topic="长时间研讨会"), _clone_state())),
    ("FindLongestMeeting", lambda: _positive_answer_case(_tasks_module.FindLongestMeeting(), _clone_state())),
    ("FindMeetingWithMostParticipants", lambda: _positive_answer_case(_tasks_module.FindMeetingWithMostParticipants(), _clone_state())),
    ("CountMeetingsByDate", lambda: _positive_answer_case(_tasks_module.CountMeetingsByDate(date="2026-02-03"), _clone_state())),
    ("ShareScreenAndConfirm", lambda: (
        _tasks_module.ShareScreenAndConfirm(host_name="张三", topic="产品需求讨论", message="共享结束了"),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "activeMeeting": _make_active_meeting(
                    title="产品需求讨论",
                    host_id="user_zhangsan",
                    host_name="张三",
                    extra_messages=[{
                        "id": "msg_002",
                        "text": "共享结束了",
                        "sender": "小明",
                        "senderId": "user_001",
                        "time": TEST_OS_STATE["time"]["timestamp"],
                        "to": "所有人",
                        "toId": "all",
                    }],
                    is_sharing=True,
                ),
            },
        ),
    )),
    ("ChatWithSpecificUser", lambda: (
        _tasks_module.ChatWithSpecificUser(host_name="李四", topic="技术方案评审", target_user="李四", message="我单独发你一下"),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "activeMeeting": _make_active_meeting(
                    title="技术方案评审",
                    host_id="user_lisi",
                    host_name="李四",
                    extra_messages=[{
                        "id": "msg_003",
                        "text": "我单独发你一下",
                        "sender": "小明",
                        "senderId": "user_001",
                        "time": TEST_OS_STATE["time"]["timestamp"],
                        "to": "李四",
                        "toId": "user_lisi",
                    }],
                ),
            },
        ),
    )),
    ("ScheduleTeamMeeting", lambda: (
        _tasks_module.ScheduleTeamMeeting(topic="跨组同步会"),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "scheduledMeetings": [
                    _make_new_scheduled_meeting(
                        topic="跨组同步会",
                        invitees=[{"id": "user_zhangsan", "name": "张三"}, {"id": "user_lisi", "name": "李四"}],
                        calendar=False,
                        auto_use_overtime_card=True,
                    ),
                    *_clone_state()["scheduledMeetings"],
                ],
            },
        ),
    )),
    ("CalculateTotalMeetingDuration", lambda: _positive_answer_case(_tasks_module.CalculateTotalMeetingDuration(date="2026-02-03"), _clone_state())),
    ("CompareParticipationDurations", lambda: _positive_answer_case(_tasks_module.CompareParticipationDurations(topic1="小明的快速会议", topic2="长时间研讨会"), _clone_state())),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("ConfigAudioSettings", lambda: _negative_criteria_case(_tasks_module.ConfigAudioSettings(mic_on=False, speaker_on=False))),
    ("CheckPersonalRoomId", lambda: _negative_answer_case(_tasks_module.CheckPersonalRoomId(), _clone_state())),
    ("CheckContactCount", lambda: _negative_answer_case(_tasks_module.CheckContactCount(), _clone_state())),
    ("ToggleNotification", lambda: _negative_criteria_case(_tasks_module.ToggleNotification(notifications=False))),
    ("FindMeetingHistory", lambda: _negative_answer_case(_tasks_module.FindMeetingHistory(topic="长时间研讨会"), _clone_state())),
    ("StartFastMeeting", lambda: (
        _tasks_module.StartFastMeeting(video_on=True, mute_on=True, use_personal_room=True),
        _make_input(
            _clone_state(),
            {
                **_clone_state(),
                "activeMeeting": _make_active_meeting(
                    title="小明的快速会议",
                    host_id="user_001",
                    host_name="小明",
                    meeting_id="419827365",
                    is_muted=True,
                    is_video_on=True,
                ),
            },
        ),
    )),
    ("ConfigGeneralSettings", lambda: _negative_criteria_case(_tasks_module.ConfigGeneralSettings(safe_drive=False, dark_mode=False))),
    ("ConfigVideoSettings", lambda: _negative_criteria_case(_tasks_module.ConfigVideoSettings(mirror=False, preview=True))),
    ("ChatInMeeting", lambda: (_tasks_module.ChatInMeeting(host_name="老王", topic="老王的快速会议", message="大家好，我到了"), _make_input(_clone_state(), {**_clone_state(), "activeMeeting": _make_active_meeting(title="老王的快速会议", host_id="host_laowang", host_name="老王")}))),
    ("ConfigPrivacySettings", lambda: _negative_criteria_case(_tasks_module.ConfigPrivacySettings(hide_non_video=True, hide_self=True))),
    ("ConfigShowIdentity", lambda: _negative_criteria_case(_tasks_module.ConfigShowIdentity(show_identity=True))),
    ("CheckPendingMeetingId", lambda: _negative_answer_case(_tasks_module.CheckPendingMeetingId(topic="项目例会"), _clone_state())),
    ("CountOngoingMeetings", lambda: _negative_answer_case(_tasks_module.CountOngoingMeetings(), _clone_state())),
    ("ModifyScheduledMeetingTopic", lambda: (
        _tasks_module.ModifyScheduledMeetingTopic(old_topic="项目例会", new_topic="产品需求评审"),
        _make_input(_clone_state(), _clone_state()),
    )),
    ("CheckScheduledMeetingEndTime", lambda: _negative_answer_case(_tasks_module.CheckScheduledMeetingEndTime(topic="项目例会"), _clone_state())),
    ("JoinMeetingAndRename", lambda: (_tasks_module.JoinMeetingAndRename(host_name="李四", topic="技术方案评审", name="小明-北京", mute_on=True), _make_input(_clone_state(), {**_clone_state(), "activeMeeting": _make_active_meeting(title="技术方案评审", host_id="user_lisi", host_name="李四", user_name="小明", is_muted=False)}))),
    ("CheckMeetingAttendees", lambda: _negative_answer_case(_tasks_module.CheckMeetingAttendees(), _clone_state())),
    ("ScheduleMeeting", lambda: (_tasks_module.ScheduleMeeting(topic="预算评审会", duration=60, pin="2468"), _make_input(_clone_state(), _clone_state(), answer="888 666 1234"))),
    ("ScheduleRegularMeeting", lambda: (_tasks_module.ScheduleRegularMeeting(topic="每周同步会", repeat_type="weekly"), _make_input(_clone_state(), _clone_state()))),
    ("CountFriendMeetings", lambda: _negative_answer_case(_tasks_module.CountFriendMeetings(), _clone_state())),
    ("GetSecondParticipationTime", lambda: _negative_answer_case(_tasks_module.GetSecondParticipationTime(topic="长时间研讨会"), _clone_state())),
    ("FindLongestMeeting", lambda: _negative_answer_case(_tasks_module.FindLongestMeeting(), _clone_state())),
    ("FindMeetingWithMostParticipants", lambda: _negative_answer_case(_tasks_module.FindMeetingWithMostParticipants(), _clone_state())),
    ("CountMeetingsByDate", lambda: _negative_answer_case(_tasks_module.CountMeetingsByDate(date="2026-02-03"), _clone_state())),
    ("ShareScreenAndConfirm", lambda: (_tasks_module.ShareScreenAndConfirm(host_name="张三", topic="产品需求讨论", message="共享结束了"), _make_input(_clone_state(), {**_clone_state(), "activeMeeting": _make_active_meeting(title="产品需求讨论", host_id="user_zhangsan", host_name="张三", is_sharing=True)}))),
    ("ChatWithSpecificUser", lambda: (_tasks_module.ChatWithSpecificUser(host_name="李四", topic="技术方案评审", target_user="李四", message="我单独发你一下"), _make_input(_clone_state(), {**_clone_state(), "activeMeeting": _make_active_meeting(title="技术方案评审", host_id="user_lisi", host_name="李四", extra_messages=[{"id": "msg_004", "text": "我单独发你一下", "sender": "小明", "senderId": "user_001", "time": TEST_OS_STATE["time"]["timestamp"], "to": "所有人", "toId": "all"}])}))),
    ("ScheduleTeamMeeting", lambda: (_tasks_module.ScheduleTeamMeeting(topic="跨组同步会"), _make_input(_clone_state(), _clone_state()))),
    ("CalculateTotalMeetingDuration", lambda: _negative_answer_case(_tasks_module.CalculateTotalMeetingDuration(date="2026-02-03"), _clone_state())),
    ("CompareParticipationDurations", lambda: _negative_answer_case(_tasks_module.CompareParticipationDurations(topic1="小明的快速会议", topic2="长时间研讨会"), _clone_state())),
]

OFFLINE_JUDGE_TASK_NAMES = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}


class TestTaskJudgeMatrixOffline:
    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == OFFLINE_JUDGE_TASK_NAMES
        assert negative == OFFLINE_JUDGE_TASK_NAMES
        assert positive == {cls.__name__ for cls in ALL_TASK_CLASSES}

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_POSITIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_NEGATIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"
