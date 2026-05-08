"""
Calendar task correctness tests.
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
from bench_env.task.calendar import tasks as _tasks_module
from bench_env.task.calendar.app import (
    SEED_DAY_OFFSETS,
    HOLIDAY_FIRST_REST,
    HOLIDAY_MAKEUP_DAYS,
    HOLIDAY_REST_DAYS,
    Calendar,
    build_seed_events,
)
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
TEST_TODAY = datetime.date.fromtimestamp(TEST_OS_STATE["time"]["timestamp"] / 1000)
# Seed event dates (from SEED_DAY_OFFSETS relative to TEST_TODAY)
SEED_A = (TEST_TODAY + datetime.timedelta(days=SEED_DAY_OFFSETS[0])).isoformat()  # 团队周会, 产品评审
SEED_B = (TEST_TODAY + datetime.timedelta(days=SEED_DAY_OFFSETS[1])).isoformat()  # 客户拜访, 团队聚餐
SEED_C = (TEST_TODAY + datetime.timedelta(days=SEED_DAY_OFFSETS[2])).isoformat()  # 项目汇报, 项目复盘
SEED_D = (TEST_TODAY + datetime.timedelta(days=SEED_DAY_OFFSETS[3])).isoformat()  # 项目启动会, 部门项目总结
NO_EVENT_DATE = (TEST_TODAY + datetime.timedelta(days=100)).isoformat()  # A future date with no seed events
DEFAULT_ROUTE = {"app": "calendar", "path": "/"}


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "system" / "Calendar" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _make_base_state() -> dict[str, Any]:
    defaults = _load_defaults()
    return {
        "settings": copy.deepcopy(defaults["settings"]),
        "events": [],
        "selectedDateTs": TEST_OS_STATE["time"]["timestamp"],
    }


BASE_STATE = _make_base_state()


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    init_route: dict[str, Any] | None = None,
    answer: str | None = None,
    init_os: dict[str, Any] | None = None,
    curr_os: dict[str, Any] | None = None,
):
    return make_judge_input(
        {"apps": {"calendar": init_state}, "os": init_os or TEST_OS_STATE},
        {"apps": {"calendar": curr_state}, "os": curr_os or TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        init_route=init_route,
        answer=answer,
    )


def _seed_state() -> dict[str, Any]:
    state = copy.deepcopy(BASE_STATE)
    state["events"] = build_seed_events(TEST_TODAY)
    return state


SEEDED_STATE = _seed_state()


def _set_by_path(state: dict[str, Any], path: str, value: Any) -> None:
    current = state
    parts = path.split(".")
    for part in parts[:-1]:
        current = current[part]
    current[parts[-1]] = value


def _resolve_criteria_value(value: Any, params: dict[str, Any]) -> Any:
    if isinstance(value, str):
        matched = re.fullmatch(r"\{(\w+)\}", value)
        if matched:
            return params[matched.group(1)]
    return value


def _different_value(task: CriteriaTask, raw_value: Any, expected: Any) -> Any:
    if isinstance(expected, bool):
        return not expected
    if isinstance(raw_value, str):
        matched = re.fullmatch(r"\{(\w+)\}", raw_value)
        if matched:
            spec = task.parameters[matched.group(1)]
            values = spec.get("values")
            if isinstance(values, dict):
                for candidate in values.values():
                    if candidate != expected:
                        return candidate
            if isinstance(values, list):
                for candidate in values:
                    if candidate != expected:
                        return candidate
    raise ValueError(f"cannot derive different value for {task.__class__.__name__}")


def _pattern_example(pattern: re.Pattern[str]) -> str:
    choices = [re.sub(r"\\(.)", r"\1", part) for part in pattern.pattern.split("|") if part]
    for choice in choices:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", choice):
            continue
        if any(marker in choice for marker in ("月", "日", "号", "周", "天")):
            return choice
    return choices[0]


def _natural_answer(expected: Any) -> str:
    if isinstance(expected, dict):
        return "，".join(_pattern_example(v) if isinstance(v, re.Pattern) else str(v) for v in expected.values())
    if isinstance(expected, re.Pattern):
        return f"答案是{_pattern_example(expected)}"
    if isinstance(expected, float):
        return f"答案是{expected:g}"
    if isinstance(expected, int):
        return f"答案是{expected}"
    return f"答案是{expected}"


def _wrong_answer(expected: Any) -> str:
    if isinstance(expected, float):
        return f"答案是{expected + 1:g}"
    if isinstance(expected, int):
        return f"答案是{expected + 1}"
    return "答案是错误内容"


def _require_event(state: dict[str, Any], title: str) -> dict[str, Any]:
    for event in state["events"]:
        if str(event["title"]).strip() == title.strip():
            return event
    raise ValueError(f"event not found: {title}")


def _add_event(
    state: dict[str, Any],
    *,
    title: str,
    date_value: str,
    event_type: str = "event",
    start: str = "09:00",
    end: str = "10:00",
    all_day: bool = False,
    reminder: int | None = 15,
    alarm: bool = False,
    description: str = "",
) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    if all_day:
        start_ts = Calendar.start_of_day_ts(date_value)
        end_ts = Calendar.start_of_day_ts((Calendar.parse_ymd(date_value) + datetime.timedelta(days=1)).isoformat())
    else:
        start_ts = Calendar.timestamp(date_value, start)
        end_ts = Calendar.timestamp(date_value, end)
    next_state["events"].insert(
        0,
        {
            "id": f"test_{len(next_state['events']) + 1}",
            "type": event_type,
            "title": title,
            "description": description,
            "allDay": all_day,
            "startTs": start_ts,
            "endTs": end_ts,
            "reminderMinutesBefore": reminder,
            "alarmEnabled": alarm,
            "calendarAccount": "小米日历",
        },
    )
    next_state["selectedDateTs"] = Calendar.start_of_day_ts(date_value)
    return next_state


def _remove_title(state: dict[str, Any], title: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["events"] = [event for event in next_state["events"] if str(event["title"]).strip() != title.strip()]
    return next_state


def _rename_title(state: dict[str, Any], old_title: str, new_title: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    event = _require_event(next_state, old_title)
    event["title"] = new_title
    start_ts = int(event["startTs"])
    start_date = datetime.datetime.fromtimestamp(start_ts / 1000.0).date().isoformat()
    next_state["selectedDateTs"] = Calendar.start_of_day_ts(start_date)
    return next_state


def _move_event(state: dict[str, Any], title: str, new_date: str, new_time: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    event = _require_event(next_state, title)
    duration = int(event["endTs"]) - int(event["startTs"])
    new_start = Calendar.timestamp(new_date, new_time)
    event["startTs"] = new_start
    event["endTs"] = new_start + duration
    next_state["selectedDateTs"] = Calendar.start_of_day_ts(new_date)
    return next_state


def _set_selected_date(state: dict[str, Any], date_value: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["selectedDateTs"] = Calendar.start_of_day_ts(date_value)
    return next_state


def _delete_keyword_matches(state: dict[str, Any], keyword: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["events"] = [
        event
        for event in next_state["events"]
        if keyword not in str(event["title"]) and keyword not in str(event.get("description", ""))
    ]
    return next_state


def _positive_criteria_case(task: CriteriaTask):
    init_state = copy.deepcopy(BASE_STATE)
    curr_state = copy.deepcopy(BASE_STATE)
    for path, raw_value in task.criteria.items():
        if path == "route":
            continue
        expected = _resolve_criteria_value(raw_value, task.params)
        wrong = _different_value(task, raw_value, expected)
        _set_by_path(init_state, path, wrong)
        _set_by_path(curr_state, path, expected)
    return task, _make_task_input(init_state, curr_state)


def _negative_criteria_case(task: CriteriaTask):
    init_state = copy.deepcopy(BASE_STATE)
    curr_state = copy.deepcopy(BASE_STATE)
    for path, raw_value in task.criteria.items():
        if path == "route":
            continue
        expected = _resolve_criteria_value(raw_value, task.params)
        wrong = _different_value(task, raw_value, expected)
        _set_by_path(init_state, path, wrong)
        _set_by_path(curr_state, path, wrong)
    return task, _make_task_input(init_state, curr_state)


def _positive_answer_case(task: AnswerTask, state: dict[str, Any]):
    probe = _make_task_input(copy.deepcopy(state), copy.deepcopy(state))
    expected = task.get_answer(probe)
    return task, _make_task_input(copy.deepcopy(state), copy.deepcopy(state), answer=_natural_answer(expected))


def _negative_answer_case(task: AnswerTask, state: dict[str, Any]):
    probe = _make_task_input(copy.deepcopy(state), copy.deepcopy(state))
    expected = task.get_answer(probe)
    return task, _make_task_input(copy.deepcopy(state), copy.deepcopy(state), answer=_wrong_answer(expected))


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "calendar" in task.apps

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


class TestInitCurrentGuards:
    def test_date_calc_forward_uses_init_os_for_relative_labels(self):
        init_os = {"time": {"timestamp": int(datetime.datetime(2026, 3, 20, 12, 0, 0).timestamp() * 1000)}}
        curr_os = {"time": {"timestamp": int(datetime.datetime(2026, 3, 21, 12, 0, 0).timestamp() * 1000)}}
        task = _tasks_module.DateCalcForward(date="2026-03-20", days=1)

        ok = task.evaluate(
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                copy.deepcopy(BASE_STATE),
                answer="答案是明天",
                init_os=init_os,
                curr_os=curr_os,
            )
        )
        assert ok.success, ok.issues

        bad = task.evaluate(
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                copy.deepcopy(BASE_STATE),
                answer="答案是今天",
                init_os=init_os,
                curr_os=curr_os,
            )
        )
        assert not bad.success


class TestCalendarAccessor:
    @pytest.fixture
    def calendar(self) -> Calendar:
        return Calendar(copy.deepcopy(SEEDED_STATE), init=copy.deepcopy(BASE_STATE))

    def test_event_queries(self, calendar: Calendar):
        assert calendar.count_events_with_title("团队周会") == 1
        assert calendar.find_event_by_title("项目汇报")["id"] == "seed_project_report"
        assert [event["title"] for event in calendar.find_events_by_keyword("项目")][:2] == ["部门项目总结", "项目启动会"]
        seed_day_a = TEST_TODAY + datetime.timedelta(days=SEED_DAY_OFFSETS[0])
        assert calendar.count_events_on_date(seed_day_a) == 2
        assert calendar.first_event_on_date(seed_day_a)["title"] == "团队周会"

    def test_holiday_named_user_event_counts_as_event(self):
        updated = Calendar(copy.deepcopy(BASE_STATE)).prepare_state_with_event(
            event_id="user_event_named_national_day",
            title="国庆",
            date_text="2026-10-01",
            start_time="09:00",
            end_time="10:00",
            created_at=TEST_OS_STATE["time"]["timestamp"],
            event_type="event",
        )
        calendar = Calendar(updated)

        assert calendar.find_events_on_date(datetime.date(2026, 10, 1))[0]["title"] == "国庆"
        assert calendar.count_events_on_date(datetime.date(2026, 10, 1)) == 1

    def test_answer_pattern_and_time_helpers(self):
        pattern = Calendar.date_answer_pattern("2026-03-20", TEST_OS_STATE)
        assert pattern.search("3月20日")
        assert Calendar.hhmm(Calendar.timestamp("2026-03-20", "09:30")) == "09:30"

    def test_sampling_helpers(self):
        env_state = {"apps": {"calendar": BASE_STATE}, "os": TEST_OS_STATE}
        assert set(Calendar.sample_interval_pair(env_state, random.Random(0)).keys()) == {"date1", "date2"}
        assert set(Calendar.sample_calc_forward(env_state, random.Random(1)).keys()) == {"date", "days"}
        assert set(Calendar.sample_time_range(env_state, random.Random(2)).keys()) == {"start", "end"}

    def test_prepare_state_with_event(self):
        updated = Calendar(copy.deepcopy(BASE_STATE)).prepare_state_with_event(
            event_id="test_event",
            title="项目评审",
            date_text="2026-03-20",
            start_time="09:00",
            end_time="10:00",
            created_at=TEST_OS_STATE["time"]["timestamp"],
            description="讨论版本范围",
            reminder_minutes_before=30,
            alarm_enabled=True,
            event_type="schedule",
        )
        calendar = Calendar(updated)
        event = calendar.find_event_by_title("项目评审")
        assert event is not None
        assert event["id"] == "test_event"
        assert event["startTs"] == Calendar.timestamp("2026-03-20", "09:00")
        assert event["endTs"] == Calendar.timestamp("2026-03-20", "10:00")
        assert event["type"] == "schedule"
        assert event["reminderMinutesBefore"] == 30
        assert event["alarmEnabled"] is True
        assert event["createdAt"] == TEST_OS_STATE["time"]["timestamp"]
        assert event["updatedAt"] == TEST_OS_STATE["time"]["timestamp"]

    def test_check_methods(self):
        created = Calendar(copy.deepcopy(_add_event(BASE_STATE, title="测试创建", date_value="2026-03-20")), init=copy.deepcopy(BASE_STATE))
        assert created.check_event_created("测试创建")["passed"] is True
        assert created.check_event_on_date("测试创建", "2026-03-20")["passed"] is True

        deleted = Calendar(copy.deepcopy(_remove_title(SEEDED_STATE, "团队周会")), init=copy.deepcopy(SEEDED_STATE))
        assert deleted.check_event_deleted("团队周会")["passed"] is True

        renamed = Calendar(copy.deepcopy(_rename_title(SEEDED_STATE, "团队周会", "团队例会")), init=copy.deepcopy(SEEDED_STATE))
        assert renamed.check_event_title_updated("团队周会", "团队例会")["passed"] is True

        reminded = Calendar(
            copy.deepcopy(_add_event(BASE_STATE, title="测试提醒", date_value="2026-03-21", reminder=30, alarm=True)),
            init=copy.deepcopy(BASE_STATE),
        )
        assert reminded.check_event_reminder("测试提醒", 30)["passed"] is True
        assert reminded.check_event_alarm("测试提醒", True)["passed"] is True


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("ToggleShowWeekNumber", lambda: _positive_criteria_case(_tasks_module.ToggleShowWeekNumber(toggle=True))),
    ("ChangeDefaultReminder", lambda: _positive_criteria_case(_tasks_module.ChangeDefaultReminder(reminder="60_minutes_before"))),
    (
        "CreateEvent",
        lambda: (
            _tasks_module.CreateEvent(title="牙医复诊", date="2026-03-20"),
            _make_task_input(copy.deepcopy(BASE_STATE), _add_event(BASE_STATE, title="牙医复诊", date_value="2026-03-20")),
        ),
    ),
    (
        "DeleteEvent",
        lambda: (
            _tasks_module.DeleteEvent(title="团队周会"),
            _make_task_input(copy.deepcopy(SEEDED_STATE), _remove_title(SEEDED_STATE, "团队周会")),
        ),
    ),
    ("SearchEventTitle", lambda: _positive_answer_case(_tasks_module.SearchEventTitle(keyword="项目"), SEEDED_STATE)),
    ("CalculateDateInterval", lambda: _positive_answer_case(_tasks_module.CalculateDateInterval(date1="2026-03-20", date2="2026-03-25"), BASE_STATE)),
    (
        "CreateBirthdayEvent",
        lambda: (
            _tasks_module.CreateBirthdayEvent(title="爸爸生日", date="2026-04-15"),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="爸爸生日", date_value="2026-04-15", event_type="birthday", all_day=True, reminder=24 * 60),
            ),
        ),
    ),
    (
        "CreateTimedEvent",
        lambda: (
            _tasks_module.CreateTimedEvent(title="面试", date="2026-03-18", start="09:00", end="10:30"),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="面试", date_value="2026-03-18", start="09:00", end="10:30"),
            ),
        ),
    ),
    (
        "CreateEventWithReminder",
        lambda: (
            _tasks_module.CreateEventWithReminder(title="出差提醒", date="2026-03-20", reminder=30),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="出差提醒", date_value="2026-03-20", reminder=30),
            ),
        ),
    ),
    ("DateCalcForward", lambda: _positive_answer_case(_tasks_module.DateCalcForward(date="2026-03-20", days=5), BASE_STATE)),
    ("QueryHolidayLength", lambda: _positive_answer_case(_tasks_module.QueryHolidayLength(holiday="春节"), BASE_STATE)),
    ("QueryMakeupWorkday", lambda: _positive_answer_case(_tasks_module.QueryMakeupWorkday(holiday="春节"), BASE_STATE)),
    ("ConfigAllReminders", lambda: _positive_criteria_case(_tasks_module.ConfigAllReminders(r1="60_minutes_before", r2="9_am_on_day", r3="5_minutes"))),
    (
        "EditEventTime",
        lambda: (
            _tasks_module.EditEventTime(title="项目汇报", new_time="11:00"),
            _make_task_input(copy.deepcopy(SEEDED_STATE), _move_event(SEEDED_STATE, "项目汇报", SEED_C, "11:00")),
        ),
    ),
    ("QueryFirstEventOnDate", lambda: _positive_answer_case(_tasks_module.QueryFirstEventOnDate(date=SEED_A), SEEDED_STATE)),
    (
        "DateCalcThenCreate",
        lambda: (
            _tasks_module.DateCalcThenCreate(date="2026-03-20", days=5, title="出发提醒"),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="出发提醒", date_value="2026-03-25"),
                answer="是3月25日",
            ),
        ),
    ),
    (
        "MakeupDayReminder",
        lambda: (
            _tasks_module.MakeupDayReminder(holiday="春节", title="补班提醒"),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="补班提醒", date_value="2026-02-28"),
                answer="补班是在2月28日",
            ),
        ),
    ),
    (
        "MakeupDayReminder__no_makeup",
        lambda: (
            _tasks_module.MakeupDayReminder(holiday="端午", title="补班提醒"),
            _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="这次不用补班"),
        ),
    ),
    (
        "SearchDeleteAll",
        lambda: (
            _tasks_module.SearchDeleteAll(keyword="项目"),
            _make_task_input(copy.deepcopy(SEEDED_STATE), _delete_keyword_matches(SEEDED_STATE, "项目"), answer="一共删了6个"),
        ),
    ),
    ("CompareScheduleDensity", lambda: _positive_answer_case(_tasks_module.CompareScheduleDensity(date1=SEED_A, date2=NO_EVENT_DATE), SEEDED_STATE)),
    (
        "EditAndReportNewTime",
        lambda: (
            _tasks_module.EditAndReportNewTime(title="团队周会", new_date="2026-03-25", new_time="10:30"),
            _make_task_input(
                copy.deepcopy(SEEDED_STATE),
                _move_event(SEEDED_STATE, "团队周会", "2026-03-25", "10:30"),
                answer="改好了，结束时间是3月25日11:30",
            ),
        ),
    ),
]


OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("ToggleShowWeekNumber", lambda: _negative_criteria_case(_tasks_module.ToggleShowWeekNumber(toggle=True))),
    ("ChangeDefaultReminder", lambda: _negative_criteria_case(_tasks_module.ChangeDefaultReminder(reminder="60_minutes_before"))),
    (
        "CreateEvent",
        lambda: (
            _tasks_module.CreateEvent(title="牙医复诊", date="2026-03-20"),
            _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE)),
        ),
    ),
    (
        "DeleteEvent",
        lambda: (
            _tasks_module.DeleteEvent(title="团队周会"),
            _make_task_input(copy.deepcopy(SEEDED_STATE), copy.deepcopy(SEEDED_STATE)),
        ),
    ),
    ("SearchEventTitle", lambda: _negative_answer_case(_tasks_module.SearchEventTitle(keyword="项目"), SEEDED_STATE)),
    ("CalculateDateInterval", lambda: _negative_answer_case(_tasks_module.CalculateDateInterval(date1="2026-03-20", date2="2026-03-25"), BASE_STATE)),
    (
        "CreateBirthdayEvent",
        lambda: (
            _tasks_module.CreateBirthdayEvent(title="爸爸生日", date="2026-04-15"),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="爸爸生日", date_value="2026-04-15", event_type="event"),
            ),
        ),
    ),
    (
        "CreateTimedEvent",
        lambda: (
            _tasks_module.CreateTimedEvent(title="面试", date="2026-03-18", start="09:00", end="10:30"),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="面试", date_value="2026-03-18", start="09:00", end="11:00"),
            ),
        ),
    ),
    (
        "CreateEventWithReminder",
        lambda: (
            _tasks_module.CreateEventWithReminder(title="出差提醒", date="2026-03-20", reminder=30),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="出差提醒", date_value="2026-03-20", reminder=15),
            ),
        ),
    ),
    ("DateCalcForward", lambda: _negative_answer_case(_tasks_module.DateCalcForward(date="2026-03-20", days=5), BASE_STATE)),
    ("QueryHolidayLength", lambda: _negative_answer_case(_tasks_module.QueryHolidayLength(holiday="春节"), BASE_STATE)),
    ("QueryMakeupWorkday", lambda: _negative_answer_case(_tasks_module.QueryMakeupWorkday(holiday="春节"), BASE_STATE)),
    ("ConfigAllReminders", lambda: _negative_criteria_case(_tasks_module.ConfigAllReminders(r1="60_minutes_before", r2="9_am_on_day", r3="5_minutes"))),
    (
        "EditEventTime",
        lambda: (
            _tasks_module.EditEventTime(title="项目汇报", new_time="11:00"),
            _make_task_input(copy.deepcopy(SEEDED_STATE), _move_event(SEEDED_STATE, "项目汇报", SEED_C, "15:30")),
        ),
    ),
    ("QueryFirstEventOnDate", lambda: _negative_answer_case(_tasks_module.QueryFirstEventOnDate(date=SEED_A), SEEDED_STATE)),
    (
        "DateCalcThenCreate",
        lambda: (
            _tasks_module.DateCalcThenCreate(date="2026-03-20", days=5, title="出发提醒"),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="出发提醒", date_value="2026-03-25"),
                answer="是3月26日",
            ),
        ),
    ),
    (
        "DateCalcThenCreate__wrong_state",
        lambda: (
            _tasks_module.DateCalcThenCreate(date="2026-03-20", days=5, title="出发提醒"),
            _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="是3月25日"),
        ),
    ),
    (
        "MakeupDayReminder",
        lambda: (
            _tasks_module.MakeupDayReminder(holiday="春节", title="补班提醒"),
            _make_task_input(
                copy.deepcopy(BASE_STATE),
                _add_event(BASE_STATE, title="补班提醒", date_value="2026-02-28"),
                answer="不用补班",
            ),
        ),
    ),
    (
        "MakeupDayReminder__wrong_state",
        lambda: (
            _tasks_module.MakeupDayReminder(holiday="春节", title="补班提醒"),
            _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="补班是在2月28日"),
        ),
    ),
    (
        "MakeupDayReminder__no_makeup_wrong_answer",
        lambda: (
            _tasks_module.MakeupDayReminder(holiday="端午", title="补班提醒"),
            _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="补班是在6月19日"),
        ),
    ),
    (
        "SearchDeleteAll",
        lambda: (
            _tasks_module.SearchDeleteAll(keyword="项目"),
            _make_task_input(copy.deepcopy(SEEDED_STATE), _delete_keyword_matches(SEEDED_STATE, "项目"), answer="一共删了5个"),
        ),
    ),
    (
        "SearchDeleteAll__wrong_state",
        lambda: (
            _tasks_module.SearchDeleteAll(keyword="项目"),
            _make_task_input(copy.deepcopy(SEEDED_STATE), copy.deepcopy(SEEDED_STATE), answer="一共删了6个"),
        ),
    ),
    ("CompareScheduleDensity", lambda: _negative_answer_case(_tasks_module.CompareScheduleDensity(date1=SEED_A, date2=NO_EVENT_DATE), SEEDED_STATE)),
    (
        "EditAndReportNewTime",
        lambda: (
            _tasks_module.EditAndReportNewTime(title="团队周会", new_date="2026-03-25", new_time="10:30"),
            _make_task_input(
                copy.deepcopy(SEEDED_STATE),
                _move_event(SEEDED_STATE, "团队周会", "2026-03-25", "10:30"),
                answer="改到3月26日11:30了",
            ),
        ),
    ),
    (
        "EditAndReportNewTime__wrong_state",
        lambda: (
            _tasks_module.EditAndReportNewTime(title="团队周会", new_date="2026-03-25", new_time="10:30"),
            _make_task_input(copy.deepcopy(SEEDED_STATE), copy.deepcopy(SEEDED_STATE), answer="改到3月25日11:30了"),
        ),
    ),
]


class TestTaskJudgeMatrixOffline:
    @pytest.mark.parametrize("case_name,case_factory", OFFLINE_JUDGE_POSITIVE_CASES, ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES])
    def test_positive_cases(self, case_name, case_factory):
        task, judge_input = case_factory()
        result = task.evaluate(judge_input)
        assert result.success, f"{case_name} should succeed: {result.issues}"
        assert result.clean, f"{case_name} should be clean: {result.warnings}"

    @pytest.mark.parametrize("case_name,case_factory", OFFLINE_JUDGE_NEGATIVE_CASES, ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES])
    def test_negative_cases(self, case_name, case_factory):
        task, judge_input = case_factory()
        result = task.evaluate(judge_input)
        assert not result.success, f"{case_name} should fail"

    def test_offline_judge_matrix_complete(self):
        positive = {name.split("__", 1)[0] for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name.split("__", 1)[0] for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == set(ALL_TASK_IDS)
        assert negative == set(ALL_TASK_IDS)

    def test_holiday_ground_truth(self):
        assert HOLIDAY_REST_DAYS["春节"] == 9
        assert HOLIDAY_MAKEUP_DAYS["春节"] == "2026-02-28"
        assert HOLIDAY_FIRST_REST["国庆"] == "2026-10-01"
