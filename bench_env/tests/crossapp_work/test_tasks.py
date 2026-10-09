"""
crossapp_work task correctness tests.

This suite has no dedicated app accessor (`bench_env/task/crossapp_work/app.py`),
so we cover:
1. task definition validation
2. cross-app metadata sanity checks from bench_env/docs/task/TASK_CODE_SPEC.md
3. offline judge positive/negative matrix
4. extra branch cases for conditional tasks
"""

from __future__ import annotations

import copy
import datetime
import importlib
import inspect
import json
import re
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.calendar.app import Calendar
from bench_env.task.clock.app import Clock
from bench_env.task.crossapp_work import tasks as _tasks_module
from bench_env.task.judge import JudgeInput
from bench_env.task.map.app import Map
from bench_env.task.sms.app import Sms
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.task.utils import parse_duration_to_minutes, sim_today
from bench_env.task.weather.app import Weather
from bench_env.task.wechat.app import Wechat
from bench_env.tests.conftest import make_judge_input
from bench_env.tests.fixtures.calendar import BASE_STATE as CALENDAR_BASE_STATE, _add_event
from bench_env.tests.fixtures.clock import DEFAULTS as CLOCK_BASE_STATE, _with_new_alarm
from bench_env.tests.fixtures.map import BASE_STATE as MAP_BASE_STATE, _with_new_search, _state as _map_state
from bench_env.tests.fixtures.notes import BASE_STATE as NOTES_BASE_STATE, _add_note
from bench_env.tests.fixtures.sms import (
    BASE_APP_STATE as SMS_APP_STATE,
    BASE_STATE as SMS_PROVIDER_STATE,
    _append_outgoing_message as _append_sms_outgoing,
)
from bench_env.tests.fixtures.tencent_meeting import (
    BASE_STATE as TM_BASE_STATE,
    TEST_OS_STATE,
    _make_active_meeting,
    _make_new_scheduled_meeting,
)
from bench_env.tests.fixtures.weather import BASE_STATE as WEATHER_BASE_STATE

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_ROUTE = {"app": "launcher", "path": "/"}


def _load_json(*parts: str) -> dict[str, Any]:
    path = ROOT.joinpath(*parts)
    return json.loads(path.read_text(encoding="utf-8"))


WECHAT_BASE_STATE = _load_json("apps", "Wechat", "data", "defaults.json")
CONTACTS_PROVIDER_STATE = _load_json("os", "providers", "defaults", "contacts.json")

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]


def _base_apps() -> dict[str, Any]:
    return {
        "calendar": copy.deepcopy(CALENDAR_BASE_STATE),
        "clock": copy.deepcopy(CLOCK_BASE_STATE),
        "map": copy.deepcopy(MAP_BASE_STATE),
        "notes": copy.deepcopy(NOTES_BASE_STATE),
        "sms": copy.deepcopy(SMS_APP_STATE),
        "tencent_meeting": copy.deepcopy(TM_BASE_STATE),
        "weather": copy.deepcopy(WEATHER_BASE_STATE),
        "wechat": copy.deepcopy(WECHAT_BASE_STATE),
    }


def _apps_state(**patches: dict[str, Any]) -> dict[str, Any]:
    apps = _base_apps()
    for key, value in patches.items():
        apps[key] = copy.deepcopy(value)
    return apps


def _base_os() -> dict[str, Any]:
    return {
        "time": copy.deepcopy(TEST_OS_STATE["time"]),
        "providers": {
            "contacts": copy.deepcopy(CONTACTS_PROVIDER_STATE),
            "sms": copy.deepcopy(SMS_PROVIDER_STATE),
        },
    }


def _make_input(
    init_apps: dict[str, Any],
    curr_apps: dict[str, Any],
    *,
    init_os: dict[str, Any] | None = None,
    curr_os: dict[str, Any] | None = None,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
) -> JudgeInput:
    return make_judge_input(
        {"apps": init_apps, "os": init_os or _base_os()},
        {"apps": curr_apps, "os": curr_os or _base_os()},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _ensure_wechat_chat(state: dict[str, Any], contact_name: str) -> dict[str, Any]:
    wechat = Wechat(state)
    wxid = wechat.require_contact_wxid(contact_name)
    chat = next((item for item in state["chats"] if str(item["id"]) == wxid), None)
    if chat is not None:
        return chat
    contact = wechat.contact_by_name(contact_name)
    chat = {
        "id": wxid,
        "user": {
            "wxid": wxid,
            "name": contact["name"],
            "avatar": contact.get("avatar", ""),
        },
        "isMuted": False,
        "isSticky": False,
        "isAlert": False,
        "messages": [],
    }
    state["chats"].insert(0, chat)
    return chat


def _append_wechat_outgoing(state: dict[str, Any], contact_name: str, content: str) -> None:
    chat = _ensure_wechat_chat(state, contact_name)
    chat["messages"].append(
        {
            "id": f"test_out_{len(chat['messages']) + 1}",
            "type": "text",
            "content": content,
            "senderId": state["user"]["wxid"],
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
        }
    )


def _append_wechat_incoming(state: dict[str, Any], contact_name: str, content: str) -> None:
    chat = _ensure_wechat_chat(state, contact_name)
    chat["messages"].append(
        {
            "id": f"test_in_{len(chat['messages']) + 1}",
            "type": "text",
            "content": content,
            "senderId": chat["user"]["wxid"],
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
        }
    )


def _map_search_state(query: str) -> dict[str, Any]:
    results = Map.geo_search(query, limit=0)
    if not results:
        raise ValueError(f"No map search results for {query!r}")
    return _with_new_search(_map_state(search_results=results, active_poi=results[0]), query)


def _tm_new_meeting(
    *,
    topic: str,
    start_ms: int,
    duration: int = 60,
    meeting_id: str = "888 666 1234",
    password: str | None = None,
    invitees: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    meeting = _make_new_scheduled_meeting(
        topic=topic,
        duration=duration,
        password=password,
        invitees=invitees,
    )
    meeting["startTime"] = start_ms
    meeting["createdAt"] = TEST_OS_STATE["time"]["timestamp"] + 1000
    meeting["meetingId"] = meeting_id
    return meeting


def _tm_with_added_meeting(state: dict[str, Any], meeting: dict[str, Any]) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["scheduledMeetings"] = [*next_state["scheduledMeetings"], copy.deepcopy(meeting)]
    return next_state


def _tm_without_topic(state: dict[str, Any], topic: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["scheduledMeetings"] = [
        item for item in next_state["scheduledMeetings"] if str(item["title"]) != topic
    ]
    return next_state


def _tm_with_active_meeting(
    state: dict[str, Any],
    *,
    host_name: str,
    topic: str,
    self_name: str,
) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    ongoing = TencentMeeting(next_state).find_ongoing_entry(host_name, topic)
    next_state["activeMeeting"] = _make_active_meeting(
        title=topic,
        host_id=str(ongoing["hostId"]),
        host_name=host_name,
        meeting_id=str(ongoing["meetingId"]),
        user_name=self_name,
    )
    return next_state


def _inject_sms_incoming(
    provider_state: dict[str, Any],
    sender: str,
    *,
    content: str,
    is_unread: bool = True,
) -> dict[str, Any]:
    return Sms(copy.deepcopy(provider_state)).prepare_state_with_incoming_message(
        sender,
        content,
        message_id=f"test_in_{sender.encode('utf-8').hex()[:16]}",
        timestamp="18:00",
        is_unread=is_unread,
    )


def _meeting_date_and_time(start_ms: int) -> tuple[str, str]:
    dt = datetime.datetime.fromtimestamp(start_ms / 1000.0)
    return dt.date().isoformat(), dt.strftime("%H:%M")


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert len(task.apps) >= 2

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": _base_os()}
        desc = task.description
        assert desc
        assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_required_class_attrs(self, cls):
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")
        assert isinstance(cls.capabilities, list) and cls.capabilities

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_expected_changes_use_scoped_paths(self, cls):
        for path in getattr(cls, "expected_changes", []):
            if path.startswith(("apps.", "os.")):
                continue
            assert "." in path, f"{cls.__name__}: cross-app expected_changes 必须使用 app.path 形式，收到 {path!r}"


class TestWechatInjectionHelpers:
    def test_prepare_state_with_incoming_text_creates_standard_message(self):
        state = copy.deepcopy(WECHAT_BASE_STATE)
        wechat = Wechat(state)
        updated = wechat.prepare_state_with_incoming_text(
            "陈静",
            "周末去中国国家博物馆怎么样？",
            message_id="crossapp_life_place_中国国家博物馆",
            timestamp=TEST_OS_STATE["time"]["timestamp"],
        )
        updated_wechat = Wechat(updated)
        assert updated_wechat.last_received_text_from("陈静") == "周末去中国国家博物馆怎么样？"
        chat = updated_wechat.get_chat_with("陈静")
        assert chat is not None
        assert chat["messages"][-1]["id"] == "crossapp_life_place_中国国家博物馆"


class TestSmsInjectionHelpers:
    def test_prepare_state_with_incoming_message_creates_contact_conversation(self):
        state = copy.deepcopy(SMS_PROVIDER_STATE)
        updated = Sms(state).prepare_state_with_incoming_message(
            "张三",
            "我是张三，明早九点前回我。",
            message_id="crossapp_work_sms_contact_zhangsan",
            timestamp="18:00",
            is_unread=True,
        )

        sms = Sms(updated)
        conv = sms.conversation_by_sender("张三")
        assert conv["isUnread"] is True
        assert sms.latest_incoming_content_from("张三") == "我是张三，明早九点前回我。"


class TestCrossAppAccessorHelpers:
    def test_tencent_meeting_any_new_scheduled_meeting(self):
        start_ms = Calendar.tomorrow_timestamp_ms_at_hh_mm(_base_os(), "15:00")
        curr_tm = _tm_with_added_meeting(
            TM_BASE_STATE,
            _tm_new_meeting(topic="临时同步会", start_ms=start_ms, meeting_id="777 888 999"),
        )
        tm = TencentMeeting(curr_tm, init=TM_BASE_STATE)

        meeting = tm.any_new_scheduled_meeting()

        assert meeting is not None
        assert meeting["title"] == "临时同步会"

    def test_tencent_meeting_check_no_new_scheduled_meeting(self):
        tm = TencentMeeting(copy.deepcopy(TM_BASE_STATE), init=copy.deepcopy(TM_BASE_STATE))

        result = tm.check_no_new_scheduled_meeting("临时协调会", field="busy_no_meeting")

        assert result["passed"] is True

    def test_calendar_check_no_event_created(self):
        calendar = Calendar(copy.deepcopy(CALENDAR_BASE_STATE), init=copy.deepcopy(CALENDAR_BASE_STATE))

        result = calendar.check_no_event_created("临时协调会", field="busy_no_calendar_event")

        assert result["passed"] is True

    def test_clock_check_no_new_alarm_at(self):
        clock = Clock(copy.deepcopy(CLOCK_BASE_STATE), init=copy.deepcopy(CLOCK_BASE_STATE))

        result = clock.check_no_new_alarm_at(3, 15, field="busy_no_alarm")

        assert result["passed"] is True

    def test_sms_check_no_new_sent_to(self):
        sms = Sms(copy.deepcopy(SMS_PROVIDER_STATE), init=copy.deepcopy(SMS_PROVIDER_STATE))

        result = sms.check_no_new_sent_to("张三", field="busy_no_sms")

        assert result["passed"] is True


class _FakeEnv:
    def __init__(self, state: dict[str, Any]):
        self.state = copy.deepcopy(state)

    async def get_state(self) -> dict[str, Any]:
        return copy.deepcopy(self.state)

    async def set_state(self, patch: dict[str, Any], *, deep: bool, reload: bool) -> None:
        assert deep is True
        assert reload is False
        self.state["os"]["providers"]["sms"] = copy.deepcopy(patch["os"]["providers"]["sms"])
def _existing_meeting_to_calendar_positive():
    task = _tasks_module.ExistingMeetingToCalendar(topic="项目例会")
    meeting = TencentMeeting(copy.deepcopy(TM_BASE_STATE)).find_scheduled_meeting(task.p.topic)
    date_value, time_value = _meeting_date_and_time(TencentMeeting.meeting_start_timestamp_ms(meeting))
    curr_calendar = _add_event(
        CALENDAR_BASE_STATE,
        title=task.p.topic,
        date_value=date_value,
        start=time_value,
        end="12:00",
    )
    return task, _make_input(_apps_state(), _apps_state(calendar=curr_calendar))


def _existing_meeting_to_calendar_negative():
    task = _tasks_module.ExistingMeetingToCalendar(topic="项目例会")
    curr_calendar = _add_event(
        CALENDAR_BASE_STATE,
        title=task.p.topic,
        date_value="2026-03-16",
        start="11:30",
        end="12:30",
    )
    return task, _make_input(_apps_state(), _apps_state(calendar=curr_calendar))
def _calendar_earliest_to_alarm_positive():
    task = _tasks_module.CalendarEarliestToAlarm()
    tomorrow = (sim_today(_base_os()) + datetime.timedelta(days=1)).isoformat()
    calendar_state = _add_event(CALENDAR_BASE_STATE, title="临时早会A", date_value=tomorrow, start="09:30", end="10:30")
    calendar_state = _add_event(calendar_state, title="临时早会B", date_value=tomorrow, start="11:00", end="12:00")
    clock_state = _with_new_alarm(CLOCK_BASE_STATE, alarm_id="test_earliest", hour=9, minute=0)
    return task, _make_input(
        _apps_state(calendar=calendar_state),
        _apps_state(calendar=calendar_state, clock=clock_state),
    )


def _calendar_earliest_to_alarm_negative():
    task = _tasks_module.CalendarEarliestToAlarm()
    tomorrow = (sim_today(_base_os()) + datetime.timedelta(days=1)).isoformat()
    calendar_state = _add_event(CALENDAR_BASE_STATE, title="临时早会A", date_value=tomorrow, start="09:30", end="10:30")
    calendar_state = _add_event(calendar_state, title="临时早会B", date_value=tomorrow, start="11:00", end="12:00")
    clock_state = _with_new_alarm(CLOCK_BASE_STATE, alarm_id="test_earliest", hour=8, minute=45)
    return task, _make_input(
        _apps_state(calendar=calendar_state),
        _apps_state(calendar=calendar_state, clock=clock_state),
    )


def _meeting_longest_info_to_wechat_positive():
    task = _tasks_module.MeetingLongestInfoToWechat(date="2026-02-03", contact="陈静")
    longest = TencentMeeting(copy.deepcopy(TM_BASE_STATE)).longest_history_meeting_on_date(task.p.date)
    mid = re.sub(r"\s+", "", str(longest["meetingId"]))
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"{task.p.date} 开得最久的是{longest['title']}，会议号 {mid}")
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))


def _meeting_longest_info_to_wechat_negative():
    task = _tasks_module.MeetingLongestInfoToWechat(date="2026-02-03", contact="陈静")
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "2026-02-03 开得最久的是长时间研讨会，会议号 111222333")
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))


def _meeting_duration_to_wechat_positive():
    task = _tasks_module.MeetingDurationToWechat(date="2026-02-03", contact="陈静")
    total = TencentMeeting(copy.deepcopy(TM_BASE_STATE)).total_participation_minutes_on_date(task.p.date)
    expected = TencentMeeting.format_duration_minutes_zh(total)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"{task.p.date} 这天我一共开了 {expected}")
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))


def _meeting_duration_to_wechat_negative():
    task = _tasks_module.MeetingDurationToWechat(date="2026-02-03", contact="陈静")
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"{task.p.date} 这天我一共开了 4小时8分")
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))
def _weather_conditional_cancel_meeting_positive():
    task = _tasks_module.WeatherConditionalCancelMeeting(city="北京", topic="项目例会")
    meeting = TencentMeeting(copy.deepcopy(TM_BASE_STATE)).find_scheduled_meeting(task.p.topic)
    start_ms = TencentMeeting.meeting_start_timestamp_ms(meeting)
    alarm_dt = datetime.datetime.fromtimestamp(start_ms / 1000.0) - datetime.timedelta(minutes=30)
    curr_clock = _with_new_alarm(
        CLOCK_BASE_STATE,
        alarm_id="weather_keep_alarm",
        hour=alarm_dt.hour,
        minute=alarm_dt.minute,
    )
    return task, _make_input(_apps_state(), _apps_state(clock=curr_clock))


def _weather_conditional_cancel_meeting_negative():
    task = _tasks_module.WeatherConditionalCancelMeeting(city="北京", topic="项目例会")
    curr_tm = _tm_without_topic(TM_BASE_STATE, task.p.topic)
    return task, _make_input(_apps_state(), _apps_state(tencent_meeting=curr_tm))
def _meeting_join_and_notify_sms_positive():
    task = _tasks_module.MeetingJoinAndNotifySms(
        host_name="老王",
        topic="老王的快速会议",
        name="访客小王",
        contact="张三",
    )
    curr_tm = _tm_with_active_meeting(TM_BASE_STATE, host_name=task.p.host_name, topic=task.p.topic, self_name=task.p.name)
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.contact, "我已经入会了")
    return task, _make_input(_apps_state(), _apps_state(tencent_meeting=curr_tm), curr_os=curr_os)


def _meeting_join_and_notify_sms_negative():
    task = _tasks_module.MeetingJoinAndNotifySms(
        host_name="老王",
        topic="老王的快速会议",
        name="访客小王",
        contact="张三",
    )
    curr_tm = _tm_with_active_meeting(TM_BASE_STATE, host_name=task.p.host_name, topic=task.p.topic, self_name="错误昵称")
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.contact, "我已经入会了")
    return task, _make_input(_apps_state(), _apps_state(tencent_meeting=curr_tm), curr_os=curr_os)


def _meeting_multi_channel_notify_positive():
    task = _tasks_module.MeetingMultiChannelNotify(contact1="陈静", contact2="张三")
    meeting = _tm_new_meeting(
        topic="临时同步会",
        start_ms=Calendar.tomorrow_timestamp_ms_at_hh_mm(_base_os(), "15:00"),
        meeting_id="777 888 999",
    )
    curr_tm = _tm_with_added_meeting(TM_BASE_STATE, meeting)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact1, f"会议号 {meeting['meetingId']}")
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.contact2, f"会议号 {meeting['meetingId']}")
    return task, _make_input(
        _apps_state(),
        _apps_state(tencent_meeting=curr_tm, wechat=curr_wechat),
        curr_os=curr_os,
    )


def _meeting_multi_channel_notify_negative():
    task = _tasks_module.MeetingMultiChannelNotify(contact1="陈静", contact2="张三")
    meeting = _tm_new_meeting(
        topic="临时同步会",
        start_ms=Calendar.tomorrow_timestamp_ms_at_hh_mm(_base_os(), "15:00"),
        meeting_id="777 888 999",
    )
    curr_tm = _tm_with_added_meeting(TM_BASE_STATE, meeting)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact1, f"会议号 {meeting['meetingId']}")
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.contact2, "会议号 111 222 333")
    return task, _make_input(
        _apps_state(),
        _apps_state(tencent_meeting=curr_tm, wechat=curr_wechat),
        curr_os=curr_os,
    )


def _meeting_route_eta_to_wechat_positive():
    task = _tasks_module.MeetingRouteEtaToWechat(place="中国国家博物馆", contact="陈静")
    route = Map.geo_route_to(task.p.place, "WALKING")
    duration = str(route["duration"])
    time_str = TencentMeeting(copy.deepcopy(TM_BASE_STATE)).meeting_start_hh_mm(
        TencentMeeting(copy.deepcopy(TM_BASE_STATE)).first_upcoming_scheduled(TEST_OS_STATE["time"]["timestamp"])
    )
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"走到{task.p.place}大概{duration}，会议 {time_str} 开始")
    curr_map = _map_search_state(task.p.place)
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, wechat=curr_wechat))


def _meeting_route_eta_to_wechat_negative():
    task = _tasks_module.MeetingRouteEtaToWechat(place="中国国家博物馆", contact="陈静")
    route = Map.geo_route_to(task.p.place, "WALKING")
    duration = str(route["duration"])
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"走到{task.p.place}大概{duration}")
    curr_map = _map_search_state(task.p.place)
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, wechat=curr_wechat))
def _meeting_full_flow_to_wechat_positive():
    task = _tasks_module.MeetingFullFlowToWechat(time="10:00", contact="陈静")
    start_ms = Calendar.tomorrow_timestamp_ms_at_hh_mm(_base_os(), task.p.time)
    date_value, time_value = _meeting_date_and_time(start_ms)
    meeting = _tm_new_meeting(topic=task.title_meeting, start_ms=start_ms, meeting_id="321 654 987")
    curr_tm = _tm_with_added_meeting(TM_BASE_STATE, meeting)
    curr_calendar = _add_event(
        CALENDAR_BASE_STATE,
        title=task.title_meeting,
        date_value=date_value,
        start=time_value,
        end="11:00",
        reminder=15,
        alarm=True,
    )
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"项目周会会议号 {meeting['meetingId']}")
    return task, _make_input(
        _apps_state(),
        _apps_state(tencent_meeting=curr_tm, calendar=curr_calendar, wechat=curr_wechat),
    )


def _meeting_full_flow_to_wechat_negative():
    task = _tasks_module.MeetingFullFlowToWechat(time="10:00", contact="陈静")
    start_ms = Calendar.tomorrow_timestamp_ms_at_hh_mm(_base_os(), task.p.time)
    date_value, time_value = _meeting_date_and_time(start_ms)
    meeting = _tm_new_meeting(topic=task.title_meeting, start_ms=start_ms, meeting_id="321 654 987")
    curr_tm = _tm_with_added_meeting(TM_BASE_STATE, meeting)
    curr_calendar = _add_event(
        CALENDAR_BASE_STATE,
        title=task.title_meeting,
        date_value=date_value,
        start=time_value,
        end="11:00",
        reminder=5,
        alarm=True,
    )
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"项目周会会议号 {meeting['meetingId']}")
    return task, _make_input(
        _apps_state(),
        _apps_state(tencent_meeting=curr_tm, calendar=curr_calendar, wechat=curr_wechat),
    )


def _full_meeting_conflict_check_broadcast_positive():
    task = _tasks_module.FullMeetingConflictCheckBroadcast(
        time="03:30",
        contact="陈静",
        contact2="张三",
        flow_topic="临时协调会",
    )
    start_ms = Calendar.tomorrow_timestamp_ms_at_hh_mm(_base_os(), task.p.time)
    date_value, time_value = _meeting_date_and_time(start_ms)
    meeting = _tm_new_meeting(topic=task.p.flow_topic, start_ms=start_ms, meeting_id="555 444 333")
    curr_tm = _tm_with_added_meeting(TM_BASE_STATE, meeting)
    curr_calendar = _add_event(
        CALENDAR_BASE_STATE,
        title=task.p.flow_topic,
        date_value=date_value,
        start=time_value,
        end="04:30",
        reminder=15,
        alarm=True,
    )
    curr_clock = _with_new_alarm(CLOCK_BASE_STATE, alarm_id="prep", hour=3, minute=15)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"会议号 {meeting['meetingId']}")
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.contact2, f"会议号 {meeting['meetingId']}")
    return task, _make_input(
        _apps_state(),
        _apps_state(
            calendar=curr_calendar,
            clock=curr_clock,
            tencent_meeting=curr_tm,
            wechat=curr_wechat,
        ),
        curr_os=curr_os,
    )


def _full_meeting_conflict_check_broadcast_negative():
    task = _tasks_module.FullMeetingConflictCheckBroadcast(
        time="03:30",
        contact="陈静",
        contact2="张三",
        flow_topic="临时协调会",
    )
    start_ms = Calendar.tomorrow_timestamp_ms_at_hh_mm(_base_os(), task.p.time)
    date_value, time_value = _meeting_date_and_time(start_ms)
    meeting = _tm_new_meeting(topic=task.p.flow_topic, start_ms=start_ms, meeting_id="555 444 333")
    curr_tm = _tm_with_added_meeting(TM_BASE_STATE, meeting)
    curr_calendar = _add_event(
        CALENDAR_BASE_STATE,
        title=task.p.flow_topic,
        date_value=date_value,
        start=time_value,
        end="04:30",
        reminder=15,
        alarm=True,
    )
    curr_clock = _with_new_alarm(CLOCK_BASE_STATE, alarm_id="prep", hour=3, minute=15)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"会议号 {meeting['meetingId']}")
    return task, _make_input(
        _apps_state(),
        _apps_state(
            calendar=curr_calendar,
            clock=curr_clock,
            tencent_meeting=curr_tm,
            wechat=curr_wechat,
        ),
    )
def _meeting_reminder_to_notes_positive():
    task = _tasks_module.MeetingReminderToNotes()
    tm = TencentMeeting(copy.deepcopy(TM_BASE_STATE))
    target_meetings, _ = tm.upcoming_or_ongoing()
    curr_notes = copy.deepcopy(NOTES_BASE_STATE)
    content = "\n".join(
        f"{meeting['title']} {tm.parse_meeting_time(meeting['startTime']).strftime('%H:%M')}"
        for meeting in target_meetings
    )
    _add_note(curr_notes, "会议提醒", content=content)
    return task, _make_input(
        _apps_state(),
        _apps_state(notes=curr_notes),
    )


def _meeting_reminder_to_notes_negative():
    task = _tasks_module.MeetingReminderToNotes()
    tm = TencentMeeting(copy.deepcopy(TM_BASE_STATE))
    target_meetings, _ = tm.upcoming_or_ongoing()
    curr_notes = copy.deepcopy(NOTES_BASE_STATE)
    content = "\n".join(f"{meeting['title']} 00:00" for meeting in target_meetings)
    _add_note(curr_notes, "会议提醒", content=content)
    return task, _make_input(
        _apps_state(),
        _apps_state(notes=curr_notes),
    )


def _sms_and_calendar_on_date_positive():
    task = _tasks_module.SmsAndCalendarOnDate(
        contact="张三",
        message="明天见",
        event_title="约会",
    )
    # tomorrow is derived from OS time: 2026-03-16 + 1 day = 2026-03-17
    tomorrow = "2026-03-17"
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.contact, task.p.message)
    curr_calendar = _add_event(
        CALENDAR_BASE_STATE,
        title=task.p.event_title,
        date_value=tomorrow,
        start="10:00",
        end="11:00",
    )
    return task, _make_input(
        _apps_state(),
        _apps_state(calendar=curr_calendar),
        curr_os=curr_os,
    )


def _sms_and_calendar_on_date_negative():
    task = _tasks_module.SmsAndCalendarOnDate(
        contact="张三",
        message="明天见",
        event_title="约会",
    )
    # wrong date: not tomorrow (2026-03-18 instead of 2026-03-17)
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.contact, task.p.message)
    curr_calendar = _add_event(
        CALENDAR_BASE_STATE,
        title=task.p.event_title,
        date_value="2026-03-18",
        start="10:00",
        end="11:00",
    )
    return task, _make_input(
        _apps_state(),
        _apps_state(calendar=curr_calendar),
        curr_os=curr_os,
    )


PRIMARY_POSITIVE_CASES = [
    ("ExistingMeetingToCalendar", _existing_meeting_to_calendar_positive),
    ("CalendarEarliestToAlarm", _calendar_earliest_to_alarm_positive),
    ("MeetingLongestInfoToWechat", _meeting_longest_info_to_wechat_positive),
    ("MeetingDurationToWechat", _meeting_duration_to_wechat_positive),
    ("WeatherConditionalCancelMeeting", _weather_conditional_cancel_meeting_positive),
    ("MeetingJoinAndNotifySms", _meeting_join_and_notify_sms_positive),
    ("MeetingMultiChannelNotify", _meeting_multi_channel_notify_positive),
    ("MeetingRouteEtaToWechat", _meeting_route_eta_to_wechat_positive),
    ("MeetingFullFlowToWechat", _meeting_full_flow_to_wechat_positive),
    ("FullMeetingConflictCheckBroadcast", _full_meeting_conflict_check_broadcast_positive),
    ("MeetingReminderToNotes", _meeting_reminder_to_notes_positive),
    ("SmsAndCalendarOnDate", _sms_and_calendar_on_date_positive),
]

PRIMARY_NEGATIVE_CASES = [
    ("ExistingMeetingToCalendar", _existing_meeting_to_calendar_negative),
    ("CalendarEarliestToAlarm", _calendar_earliest_to_alarm_negative),
    ("MeetingLongestInfoToWechat", _meeting_longest_info_to_wechat_negative),
    ("MeetingDurationToWechat", _meeting_duration_to_wechat_negative),
    ("WeatherConditionalCancelMeeting", _weather_conditional_cancel_meeting_negative),
    ("MeetingJoinAndNotifySms", _meeting_join_and_notify_sms_negative),
    ("MeetingMultiChannelNotify", _meeting_multi_channel_notify_negative),
    ("MeetingRouteEtaToWechat", _meeting_route_eta_to_wechat_negative),
    ("MeetingFullFlowToWechat", _meeting_full_flow_to_wechat_negative),
    ("FullMeetingConflictCheckBroadcast", _full_meeting_conflict_check_broadcast_negative),
    ("MeetingReminderToNotes", _meeting_reminder_to_notes_negative),
    ("SmsAndCalendarOnDate", _sms_and_calendar_on_date_negative),
]


EXTRA_POSITIVE_CASES = [
    (
        "WeatherConditionalCancelMeeting__rainy_branch",
        lambda: (
            task := _tasks_module.WeatherConditionalCancelMeeting(city="广州", topic="项目例会"),
            _make_input(
                _apps_state(),
                _apps_state(tencent_meeting=_tm_without_topic(TM_BASE_STATE, task.p.topic)),
            ),
        ),
    ),
    (
        "FullMeetingConflictCheckBroadcast__busy_branch",
        lambda: (
            task := _tasks_module.FullMeetingConflictCheckBroadcast(
                time="03:30",
                contact="陈静",
                contact2="张三",
                flow_topic="临时协调会",
            ),
            (
                lambda init_calendar: _make_input(
                    _apps_state(calendar=init_calendar),
                    _apps_state(
                        calendar=init_calendar,
                        wechat=(
                            lambda state: (
                                _append_wechat_outgoing(state, task.p.contact, "那个时间不行，日程有冲突") or state
                            )
                        )(copy.deepcopy(WECHAT_BASE_STATE)),
                    ),
                )
            )(
                _add_event(
                    CALENDAR_BASE_STATE,
                    title="占用的固定安排",
                    date_value=(sim_today(_base_os()) + datetime.timedelta(days=1)).isoformat(),
                    start="02:30",
                    end="05:30",
                )
            ),
        ),
    ),
]


EXTRA_NEGATIVE_CASES = [
    (
        "FullMeetingConflictCheckBroadcast__busy_branch_missing_reject",
        lambda: (
            task := _tasks_module.FullMeetingConflictCheckBroadcast(
                time="03:30",
                contact="陈静",
                contact2="张三",
                flow_topic="临时协调会",
            ),
            _make_input(
                _apps_state(
                    calendar=_add_event(
                        CALENDAR_BASE_STATE,
                        title="占用的固定安排",
                        date_value=(sim_today(_base_os()) + datetime.timedelta(days=1)).isoformat(),
                        start="02:30",
                        end="05:30",
                    )
                ),
                _apps_state(
                    calendar=_add_event(
                        CALENDAR_BASE_STATE,
                        title="占用的固定安排",
                        date_value=(sim_today(_base_os()) + datetime.timedelta(days=1)).isoformat(),
                        start="02:30",
                        end="05:30",
                    )
                ),
            ),
        ),
    ),
]


class TestTaskJudgeMatrixOffline:
    @pytest.mark.parametrize(
        "task_name,builder",
        PRIMARY_POSITIVE_CASES + EXTRA_POSITIVE_CASES,
        ids=[name for name, _ in PRIMARY_POSITIVE_CASES + EXTRA_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        PRIMARY_NEGATIVE_CASES + EXTRA_NEGATIVE_CASES,
        ids=[name for name, _ in PRIMARY_NEGATIVE_CASES + EXTRA_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"
