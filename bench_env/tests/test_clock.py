"""
Clock task correctness tests.
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
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.clock import tasks as _tasks_module
from bench_env.task.clock.app import Clock
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
DEFAULT_ROUTE = {"app": "clock", "path": "/alarm"}
STOPWATCH_ROUTE = {"app": "clock", "path": "/stopwatch"}
TIMER_ROUTE = {"app": "clock", "path": "/timer"}


def _load_defaults() -> dict[str, Any]:
    """Construct clock state mirroring frontend state-adapter output.

    Production merges the static city catalog into clock state at runtime
    (see system/Clock/state.ts registerStateAdapter). Offline tests bypass
    the browser, so we have to do the same merge here.
    """
    base_dir = Path(__file__).resolve().parents[2] / "system" / "Clock" / "data"
    defaults = json.loads((base_dir / "defaults.json").read_text(encoding="utf-8"))
    cities = json.loads((base_dir / "cities.json").read_text(encoding="utf-8"))
    defaults.setdefault("cities", cities)
    return defaults


DEFAULTS = _load_defaults()


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
        {"apps": {"clock": init_state}, "os": init_os or TEST_OS_STATE},
        {"apps": {"clock": curr_state}, "os": curr_os or TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        init_route=init_route,
        answer=answer,
    )


def _with_alarm_patch(state: dict[str, Any], alarm_id: str, **patch: Any) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    alarms = []
    for alarm in next_state["alarms"]:
        updated = dict(alarm)
        if str(alarm["id"]) == alarm_id:
            updated.update(patch)
        alarms.append(updated)
    next_state["alarms"] = alarms
    return next_state


def _without_alarm(state: dict[str, Any], alarm_id: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["alarms"] = [alarm for alarm in next_state["alarms"] if str(alarm["id"]) != alarm_id]
    return next_state


def _with_new_alarm(
    state: dict[str, Any],
    *,
    alarm_id: str,
    hour: int,
    minute: int,
    enabled: bool = False,
    repeat: str = "once",
    note: str | None = None,
    vibrate: bool = True,
    auto_delete: bool = False,
) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["alarms"] = [
        {
            "id": alarm_id,
            "hour": hour,
            "minute": minute,
            "enabled": enabled,
            "repeat": repeat,
            "note": note,
            "vibrate": vibrate,
            "autoDelete": auto_delete,
        },
        *next_state["alarms"],
    ]
    return next_state


def _with_added_city(state: dict[str, Any], city_id: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    if city_id not in next_state["selectedCityIds"]:
        next_state["selectedCityIds"].append(city_id)
    return next_state


def _with_removed_city(state: dict[str, Any], city_id: str) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["selectedCityIds"] = [item for item in next_state["selectedCityIds"] if item != city_id]
    return next_state


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "clock" in task.apps

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


class TestClockAccessor:
    @pytest.fixture
    def clock(self) -> Clock:
        return Clock(copy.deepcopy(DEFAULTS), init=copy.deepcopy(DEFAULTS))

    def test_alarm_accessors(self, clock: Clock):
        assert len(clock.alarms) == 7
        assert clock.find_alarm_by_id("a1")["hour"] == 4
        assert clock.find_alarm_by_time(6, 10)["id"] == "a4"
        assert clock.find_alarm_by_time(9, 10) is None

    def test_city_accessors(self, clock: Clock):
        assert clock.selected_city_ids == ["london", "newyork", "accra", "paris"]
        assert [city["name"] for city in clock.selected_cities] == ["伦敦", "纽约", "阿克拉", "巴黎"]
        assert clock.find_city("东京")["id"] == "tokyo"
        assert clock.find_city("tokyo")["name"] == "东京"
        assert clock.selected_city_matches("巴黎") is True
        assert clock.selected_city_matches("东京") is False

    def test_time_queries(self, clock: Clock):
        assert clock.city_time("巴黎", TEST_OS_STATE).count(":") == 1
        assert isinstance(clock.time_diff_hours("巴黎", "纽约"), int)
        assert isinstance(clock.city_local_diff_text("巴黎", TEST_OS_STATE), re.Pattern)
        assert clock.latest_city_name() == "巴黎"

    def test_sampling_helpers(self):
        env_state = {"apps": {"clock": copy.deepcopy(DEFAULTS)}, "os": TEST_OS_STATE}
        existing_alarm = Clock.sample_existing_alarm(env_state, random.Random(0))
        assert existing_alarm["alarm_id"].startswith("a")
        assert ":" in existing_alarm["time"]

        noted_alarm = Clock.sample_noted_alarm(env_state, random.Random(1))
        assert noted_alarm["alarm_id"] in {"a1", "a2", "a4", "a6", "a7"}

        new_time = Clock.sample_new_alarm_time(env_state, random.Random(2))
        assert new_time["time"] not in {"04:30", "05:00", "06:00", "06:10", "06:20", "07:00", "22:30"}

        pair = Clock.sample_selected_city_pair(env_state, random.Random(3))
        assert pair["city1"] != pair["city2"]

        addable = Clock.sample_addable_city(env_state, random.Random(4))
        selected_names = {
            c["name"] for c in DEFAULTS["cities"]
            if c["id"] in DEFAULTS["selectedCityIds"]
        }
        assert addable["city"] not in selected_names

    def test_check_no_new_alarms(self):
        unchanged = Clock(copy.deepcopy(DEFAULTS), init=copy.deepcopy(DEFAULTS))
        assert unchanged.check_no_new_alarms()["passed"] is True

        current = _with_new_alarm(
            copy.deepcopy(DEFAULTS),
            alarm_id="test_alarm",
            hour=7,
            minute=30,
        )
        changed = Clock(current, init=copy.deepcopy(DEFAULTS))
        check = changed.check_no_new_alarms(field="no_new_trip_alarm")
        assert check["field"] == "no_new_trip_alarm"
        assert check["passed"] is False


class TestInitCurrentGuards:
    def test_check_city_time_uses_init_os_not_current_os(self):
        init_os = {"time": {"timestamp": int(datetime.datetime(2026, 3, 15, 12, 0, 0).timestamp() * 1000)}}
        curr_os = {"time": {"timestamp": int(datetime.datetime(2026, 3, 15, 12, 20, 0).timestamp() * 1000)}}
        task = _tasks_module.CheckCityTime(city="巴黎")
        clock = Clock(copy.deepcopy(DEFAULTS))
        init_answer = clock.city_time("巴黎", init_os)
        curr_answer = clock.city_time("巴黎", curr_os)

        assert init_answer != curr_answer

        ok = task.evaluate(
            _make_task_input(
                copy.deepcopy(DEFAULTS),
                copy.deepcopy(DEFAULTS),
                answer=f"巴黎现在是 {init_answer}",
                init_os=init_os,
                curr_os=curr_os,
            )
        )
        assert ok.success, ok.issues

        bad = task.evaluate(
            _make_task_input(
                copy.deepcopy(DEFAULTS),
                copy.deepcopy(DEFAULTS),
                answer=f"巴黎现在是 {curr_answer}",
                init_os=init_os,
                curr_os=curr_os,
            )
        )
        assert not bad.success


OFFLINE_JUDGE_POSITIVE_CASES = [
    (
        "ToggleAlarm",
        lambda: (
            _tasks_module.ToggleAlarm(alarm_id="a1", time="04:30", toggle=False),
            _make_task_input(copy.deepcopy(DEFAULTS), _with_alarm_patch(DEFAULTS, "a1", enabled=False)),
        ),
    ),
    (
        "CountAlarms",
        lambda: (
            _tasks_module.CountAlarms(),
            _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="时钟里一共有7个闹钟"),
        ),
    ),
    (
        "AddAlarm",
        lambda: (
            _tasks_module.AddAlarm(time="07:10", hour=7, minute=10),
            _make_task_input(copy.deepcopy(DEFAULTS), _with_new_alarm(DEFAULTS, alarm_id="t_add", hour=7, minute=10)),
        ),
    ),
    (
        "DeleteAlarm",
        lambda: (
            _tasks_module.DeleteAlarm(alarm_id="a2", time="05:00"),
            _make_task_input(copy.deepcopy(DEFAULTS), _without_alarm(DEFAULTS, "a2")),
        ),
    ),
    (
        "SetAlarmRepeat",
        lambda: (
            _tasks_module.SetAlarmRepeat(alarm_id="a2", time="05:00", repeat="daily"),
            _make_task_input(copy.deepcopy(DEFAULTS), _with_alarm_patch(DEFAULTS, "a2", repeat="daily")),
        ),
    ),
    (
        "AddWorldCity",
        lambda: (
            _tasks_module.AddWorldCity(city="北京", city_id="beijing"),
            _make_task_input(copy.deepcopy(DEFAULTS), _with_added_city(DEFAULTS, "beijing")),
        ),
    ),
    (
        "RemoveWorldCity",
        lambda: (
            _tasks_module.RemoveWorldCity(city="伦敦", city_id="london"),
            _make_task_input(copy.deepcopy(DEFAULTS), _with_removed_city(DEFAULTS, "london")),
        ),
    ),
    (
        "CheckAlarmNote",
        lambda: (
            _tasks_module.CheckAlarmNote(alarm_id="a4", time="06:10"),
            _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="06:10 的闹钟备注是跑步"),
        ),
    ),
    (
        "AddAlarmWithSettings",
        lambda: (
            _tasks_module.AddAlarmWithSettings(time="07:10", hour=7, minute=10, repeat="daily", note="晨练"),
            _make_task_input(
                copy.deepcopy(DEFAULTS),
                _with_new_alarm(DEFAULTS, alarm_id="t_add2", hour=7, minute=10, repeat="daily", note="晨练"),
            ),
        ),
    ),
    (
        "EnableAllAlarms",
        lambda: (
            _tasks_module.EnableAllAlarms(),
            _make_task_input(
                copy.deepcopy(DEFAULTS),
                _with_alarm_patch(
                    _with_alarm_patch(
                        _with_alarm_patch(
                            _with_alarm_patch(
                                _with_alarm_patch(copy.deepcopy(DEFAULTS), "a2", enabled=True),
                                "a4",
                                enabled=True,
                            ),
                            "a5",
                            enabled=True,
                        ),
                        "a7",
                        enabled=True,
                    ),
                    "a1",
                    enabled=True,
                ),
            ),
        ),
    ),
    (
        "CheckCityTime",
        lambda: (
            task := _tasks_module.CheckCityTime(city="巴黎", city_id="paris"),
            _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer=f"巴黎现在是 {task.get_answer(_make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS)))}"),
        ),
    ),
    (
        "CompareCityTimeDiff",
        lambda: (
            _tasks_module.CompareCityTimeDiff(city1="巴黎", city2="纽约"),
            _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="巴黎和纽约现在相差6小时"),
        ),
    ),
    (
        "CityLocalTimeDiff",
        lambda: (
            _tasks_module.CityLocalTimeDiff(city="巴黎", city_id="paris"),
            _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="巴黎比本地慢了7个小时"),
        ),
    ),
    (
        "LatestTimezoneCity",
        lambda: (
            _tasks_module.LatestTimezoneCity(),
            _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="现在时间最晚的是巴黎"),
        ),
    ),
    (
        "AddCityAndCheckTime",
        lambda: (
            _tasks_module.AddCityAndCheckTime(city="北京", city_id="beijing"),
            _make_task_input(
                copy.deepcopy(DEFAULTS),
                _with_added_city(DEFAULTS, "beijing"),
                answer=f"北京现在是 {Clock(_with_added_city(DEFAULTS, 'beijing')).city_time('北京', TEST_OS_STATE)}",
            ),
        ),
    ),
    (
        "AddCityAndCompareTimeDiff",
        lambda: (
            _tasks_module.AddCityAndCompareTimeDiff(new_city="东京", existing_city="巴黎"),
            _make_task_input(copy.deepcopy(DEFAULTS), _with_added_city(DEFAULTS, "tokyo"), answer="东京和巴黎相差8小时"),
        ),
    ),
    (
        "ReorganizeWorldClock",
        lambda: (
            _tasks_module.ReorganizeWorldClock(remove_city="伦敦", add_city="东京", add_city_id="tokyo"),
            _make_task_input(copy.deepcopy(DEFAULTS), _with_added_city(_with_removed_city(DEFAULTS, "london"), "tokyo")),
        ),
    ),
    (
        "SetupMorningAlarms",
        lambda: (
            _tasks_module.SetupMorningAlarms(
                time1="07:10",
                h1=7,
                m1=10,
                time2="07:20",
                h2=7,
                m2=20,
                repeat1="daily",
                repeat2="weekday",
            ),
            _make_task_input(
                copy.deepcopy(DEFAULTS),
                _with_new_alarm(
                    _with_new_alarm(DEFAULTS, alarm_id="t1", hour=7, minute=10, repeat="daily"),
                    alarm_id="t2",
                    hour=7,
                    minute=20,
                    repeat="weekday",
                ),
            ),
        ),
    ),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("ToggleAlarm", lambda: (_tasks_module.ToggleAlarm(alarm_id="a1", time="04:30", toggle=False), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS)))),
    ("CountAlarms", lambda: (_tasks_module.CountAlarms(), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="时钟里一共有6个闹钟"))),
    ("AddAlarm", lambda: (_tasks_module.AddAlarm(time="07:10", hour=7, minute=10), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS)))),
    ("DeleteAlarm", lambda: (_tasks_module.DeleteAlarm(alarm_id="a2", time="05:00"), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS)))),
    ("SetAlarmRepeat", lambda: (_tasks_module.SetAlarmRepeat(alarm_id="a2", time="05:00", repeat="daily"), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS)))),
    ("AddWorldCity", lambda: (_tasks_module.AddWorldCity(city="北京", city_id="beijing"), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS)))),
    ("RemoveWorldCity", lambda: (_tasks_module.RemoveWorldCity(city="伦敦", city_id="london"), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS)))),
    ("CheckAlarmNote", lambda: (_tasks_module.CheckAlarmNote(alarm_id="a4", time="06:10"), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="06:10 的闹钟备注是开会"))),
    ("AddAlarmWithSettings", lambda: (_tasks_module.AddAlarmWithSettings(time="07:10", hour=7, minute=10, repeat="daily", note="晨练"), _make_task_input(copy.deepcopy(DEFAULTS), _with_new_alarm(DEFAULTS, alarm_id="t_add2", hour=7, minute=10, repeat="daily", note="看球")))),
    ("EnableAllAlarms", lambda: (_tasks_module.EnableAllAlarms(), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS)))),
    ("CheckCityTime", lambda: (_tasks_module.CheckCityTime(city="巴黎", city_id="paris"), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="巴黎现在是 12:34"))),
    ("CompareCityTimeDiff", lambda: (_tasks_module.CompareCityTimeDiff(city1="巴黎", city2="纽约"), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="巴黎和纽约现在相差5小时"))),
    ("CityLocalTimeDiff", lambda: (_tasks_module.CityLocalTimeDiff(city="巴黎", city_id="paris"), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="巴黎和本地一样"))),
    ("LatestTimezoneCity", lambda: (_tasks_module.LatestTimezoneCity(), _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="现在时间最晚的是纽约"))),
    ("AddCityAndCheckTime", lambda: (_tasks_module.AddCityAndCheckTime(city="北京", city_id="beijing"), _make_task_input(copy.deepcopy(DEFAULTS), _with_added_city(DEFAULTS, "beijing"), answer="北京现在是 12:34"))),
    ("AddCityAndCompareTimeDiff", lambda: (_tasks_module.AddCityAndCompareTimeDiff(new_city="东京", existing_city="巴黎"), _make_task_input(copy.deepcopy(DEFAULTS), _with_added_city(DEFAULTS, "tokyo"), answer="东京和巴黎相差7小时"))),
    ("ReorganizeWorldClock", lambda: (_tasks_module.ReorganizeWorldClock(remove_city="伦敦", add_city="东京", add_city_id="tokyo"), _make_task_input(copy.deepcopy(DEFAULTS), _with_added_city(DEFAULTS, "tokyo")))),
    ("SetupMorningAlarms", lambda: (_tasks_module.SetupMorningAlarms(time1="07:10", h1=7, m1=10, time2="07:20", h2=7, m2=20, repeat1="daily", repeat2="weekday"), _make_task_input(copy.deepcopy(DEFAULTS), _with_new_alarm(DEFAULTS, alarm_id="t1", hour=7, minute=10, repeat="daily")))),
]

HYBRID_EXTRA_NEGATIVE_CASES = [
    (
        "AddCityAndCheckTime_missing_state",
        lambda: (
            task := _tasks_module.AddCityAndCheckTime(city="北京", city_id="beijing"),
            _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer=f"北京现在是 {Clock(copy.deepcopy(DEFAULTS)).find_city('北京') and Clock(copy.deepcopy(DEFAULTS)).city_time('北京', TEST_OS_STATE)}"),
        ),
    ),
    (
        "AddCityAndCompareTimeDiff_missing_state",
        lambda: (
            _tasks_module.AddCityAndCompareTimeDiff(new_city="东京", existing_city="巴黎"),
            _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer="东京和巴黎相差8小时"),
        ),
    ),
    (
        "CountAlarms_empty_answer",
        lambda: (
            _tasks_module.CountAlarms(),
            _make_task_input(copy.deepcopy(DEFAULTS), copy.deepcopy(DEFAULTS), answer=None),
        ),
    ),
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

    @pytest.mark.parametrize(
        "task_name,builder",
        HYBRID_EXTRA_NEGATIVE_CASES,
        ids=[name for name, _ in HYBRID_EXTRA_NEGATIVE_CASES],
    )
    def test_extra_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} extra negative unexpectedly passed"
