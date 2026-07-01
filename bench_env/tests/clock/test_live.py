"""
Live judge verification for Clock tasks.

Drives the simulator through ``window.__SIM__.setState()`` and evaluates
against the full browser ``__SIM__.getState()`` snapshot. This specifically
covers OS-level derived mirrors such as ``os.services.alarm_manager`` that
offline Clock tests do not construct.

Requires the Vite dev server running at ``--sim-url`` (default
``http://localhost:3000``). Skip with ``pytest -m 'not live'``.
"""

from __future__ import annotations

import json
from typing import Awaitable, Callable

import pytest

from bench_env.env.base import Observation
from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.clock import tasks as clock_tasks
from bench_env.task.clock.app import Clock
from bench_env.task.judge import JudgeInput, JudgeResult


pytestmark = [pytest.mark.live, pytest.mark.asyncio(loop_scope="session")]


Driver = Callable[[MobileGymEnv, BaseTask], Awaitable[None]]


def _format(res: JudgeResult) -> str:
    return json.dumps(res.to_dict(), ensure_ascii=False, indent=2)


async def _read_clock_state(env: MobileGymEnv) -> dict:
    state = await env.get_state(required_apps=["clock"])
    return state["apps"]["clock"]


async def _set_clock(env: MobileGymEnv, patch: dict) -> None:
    await env.set_state({"apps": {"clock": patch}}, deep=True, reload=False)


def _city_id(clock_state: dict, name_or_id: str) -> str:
    return str(Clock(clock_state).find_city(name_or_id)["id"])


def _new_alarm(
    alarm_id: str,
    hour: int,
    minute: int,
    *,
    enabled: bool = True,
    repeat: str = "once",
    note: str = "",
) -> dict:
    return {
        "id": alarm_id,
        "hour": hour,
        "minute": minute,
        "enabled": enabled,
        "repeat": repeat,
        "vibrate": True,
        "autoDelete": False,
        "note": note,
    }


async def _assert_alarm_manager_contains(env: MobileGymEnv, alarm_id: str) -> None:
    state = await env.get_state(required_apps=["clock"])
    alarms = state["os"]["services"]["alarm_manager"]["alarms"]
    key = f"com.android.deskclock:{alarm_id}"
    assert key in alarms, f"alarm_manager did not derive {key}; keys={list(alarms)}"


async def _run(
    env: MobileGymEnv,
    task: BaseTask,
    drive: Driver,
    *,
    answer: str | None = None,
) -> JudgeResult:
    init_obs = await task.setup(env)
    await drive(env, task)
    curr_state = await env.get_state(required_apps=task.apps or None)
    curr_obs = Observation(state=curr_state, route=init_obs.route, step_idx=1)
    if answer is None:
        answer = _answer_for(task, init_obs, curr_obs)
    return task.evaluate(JudgeInput(init_obs=init_obs, last_obs=curr_obs, answer=answer))


def _answer_for(task: BaseTask, init_obs: Observation, curr_obs: Observation) -> str | None:
    if not getattr(task, "answer_fields", None):
        return None

    proxy = JudgeInput(init_obs=init_obs, last_obs=curr_obs)
    if isinstance(task, clock_tasks.AddCityAndCompareTimeDiff):
        val = Clock(curr_obs.state["apps"]["clock"]).time_diff_hours(task.p.new_city, task.p.existing_city)
        return str(val)

    values = task.get_expected_response(proxy)
    return " ".join(str(value) for value in values)


async def _noop(_env: MobileGymEnv, _task: BaseTask) -> None:
    pass


async def _drive_toggle_alarm(env: MobileGymEnv, task: BaseTask) -> None:
    await _set_clock(env, {f"alarms[id={task.p.alarm_id}]": {"enabled": bool(task.p.toggle)}})


async def _drive_add_alarm(env: MobileGymEnv, task: BaseTask) -> None:
    alarm_id = f"live_add_{task.p.hour}_{task.p.minute}"
    await _set_clock(env, {"alarms[]": _new_alarm(alarm_id, task.p.hour, task.p.minute)})
    await _assert_alarm_manager_contains(env, alarm_id)


async def _drive_delete_alarm(env: MobileGymEnv, task: BaseTask) -> None:
    await _set_clock(env, {f"alarms[id={task.p.alarm_id}]": None})


async def _drive_set_alarm_repeat(env: MobileGymEnv, task: BaseTask) -> None:
    await _set_clock(env, {f"alarms[id={task.p.alarm_id}]": {"repeat": task.p.repeat}})


async def _drive_add_world_city(env: MobileGymEnv, task: BaseTask) -> None:
    clock_state = await _read_clock_state(env)
    await _set_clock(env, {"selectedCityIds[]": _city_id(clock_state, task.p.city)})


async def _drive_remove_world_city(env: MobileGymEnv, task: BaseTask) -> None:
    clock_state = await _read_clock_state(env)
    remove_id = _city_id(clock_state, task.p.city)
    selected = [city_id for city_id in clock_state["selectedCityIds"] if str(city_id) != remove_id]
    await _set_clock(env, {"selectedCityIds": selected})


async def _drive_add_alarm_with_settings(env: MobileGymEnv, task: BaseTask) -> None:
    alarm_id = f"live_add_settings_{task.p.hour}_{task.p.minute}"
    await _set_clock(env, {
        "alarms[]": _new_alarm(
            alarm_id,
            task.p.hour,
            task.p.minute,
            repeat=task.p.repeat,
            note=task.p.note,
        )
    })
    await _assert_alarm_manager_contains(env, alarm_id)


async def _drive_enable_all_alarms(env: MobileGymEnv, _task: BaseTask) -> None:
    clock_state = await _read_clock_state(env)
    alarms = [dict(alarm, enabled=True) for alarm in clock_state["alarms"]]
    await _set_clock(env, {"alarms": alarms})


async def _drive_add_city_and_answer(env: MobileGymEnv, task: BaseTask) -> None:
    city = task.params["city"] if "city" in task.params else task.params["new_city"]
    clock_state = await _read_clock_state(env)
    await _set_clock(env, {"selectedCityIds[]": _city_id(clock_state, city)})


async def _drive_reorganize_world_clock(env: MobileGymEnv, task: BaseTask) -> None:
    clock_state = await _read_clock_state(env)
    remove_id = _city_id(clock_state, task.p.remove_city)
    add_id = _city_id(clock_state, task.p.add_city)
    selected = [city_id for city_id in clock_state["selectedCityIds"] if str(city_id) != remove_id]
    if add_id not in {str(city_id) for city_id in selected}:
        selected.append(add_id)
    await _set_clock(env, {"selectedCityIds": selected})


async def _drive_setup_morning_alarms(env: MobileGymEnv, task: BaseTask) -> None:
    alarm1 = f"live_morning_{task.p.h1}_{task.p.m1}"
    alarm2 = f"live_morning_{task.p.h2}_{task.p.m2}"
    await _set_clock(env, {
        "alarms[]": [
            _new_alarm(alarm1, task.p.h1, task.p.m1, repeat=task.p.repeat1),
            _new_alarm(alarm2, task.p.h2, task.p.m2, repeat=task.p.repeat2),
        ]
    })
    await _assert_alarm_manager_contains(env, alarm1)
    await _assert_alarm_manager_contains(env, alarm2)


POSITIVE_CASES: list[tuple[str, Callable[[], BaseTask], Driver]] = [
    (
        "ToggleAlarm",
        lambda: clock_tasks.ToggleAlarm(alarm_id="a1", time="04:30", toggle=False),
        _drive_toggle_alarm,
    ),
    ("CountAlarms", lambda: clock_tasks.CountAlarms(), _noop),
    (
        "AddAlarm",
        lambda: clock_tasks.AddAlarm(time="07:10", hour=7, minute=10),
        _drive_add_alarm,
    ),
    (
        "DeleteAlarm",
        lambda: clock_tasks.DeleteAlarm(alarm_id="a2", time="05:00"),
        _drive_delete_alarm,
    ),
    (
        "SetAlarmRepeat",
        lambda: clock_tasks.SetAlarmRepeat(alarm_id="a2", time="05:00", repeat="daily"),
        _drive_set_alarm_repeat,
    ),
    ("AddWorldCity", lambda: clock_tasks.AddWorldCity(city="北京"), _drive_add_world_city),
    ("RemoveWorldCity", lambda: clock_tasks.RemoveWorldCity(city="伦敦"), _drive_remove_world_city),
    (
        "CheckAlarmNote",
        lambda: clock_tasks.CheckAlarmNote(alarm_id="a4", time="06:10"),
        _noop,
    ),
    (
        "AddAlarmWithSettings",
        lambda: clock_tasks.AddAlarmWithSettings(
            time="07:10",
            hour=7,
            minute=10,
            repeat="daily",
            note="晨练",
        ),
        _drive_add_alarm_with_settings,
    ),
    ("EnableAllAlarms", lambda: clock_tasks.EnableAllAlarms(), _drive_enable_all_alarms),
    ("CheckCityTime", lambda: clock_tasks.CheckCityTime(city="巴黎"), _noop),
    (
        "CompareCityTimeDiff",
        lambda: clock_tasks.CompareCityTimeDiff(city1="巴黎", city2="纽约"),
        _noop,
    ),
    ("CityLocalTimeDiff", lambda: clock_tasks.CityLocalTimeDiff(city="巴黎"), _noop),
    ("LatestTimezoneCity", lambda: clock_tasks.LatestTimezoneCity(), _noop),
    ("AddCityAndCheckTime", lambda: clock_tasks.AddCityAndCheckTime(city="北京"), _drive_add_city_and_answer),
    (
        "AddCityAndCompareTimeDiff",
        lambda: clock_tasks.AddCityAndCompareTimeDiff(new_city="东京", existing_city="巴黎"),
        _drive_add_city_and_answer,
    ),
    (
        "ReorganizeWorldClock",
        lambda: clock_tasks.ReorganizeWorldClock(remove_city="伦敦", add_city="东京"),
        _drive_reorganize_world_clock,
    ),
    (
        "SetupMorningAlarms",
        lambda: clock_tasks.SetupMorningAlarms(
            time1="07:10",
            h1=7,
            m1=10,
            time2="07:20",
            h2=7,
            m2=20,
            repeat1="daily",
            repeat2="weekday",
        ),
        _drive_setup_morning_alarms,
    ),
]


@pytest.mark.parametrize("name,task_factory,driver", POSITIVE_CASES, ids=[case[0] for case in POSITIVE_CASES])
async def test_positive(env: MobileGymEnv, name: str, task_factory: Callable[[], BaseTask], driver: Driver) -> None:
    result = await _run(env, task_factory(), driver)
    assert result.passed, f"[{name}] positive must pass (success+clean):\n{_format(result)}"


@pytest.mark.parametrize("name,task_factory,_driver", POSITIVE_CASES, ids=[case[0] for case in POSITIVE_CASES])
async def test_negative_noop(env: MobileGymEnv, name: str, task_factory: Callable[[], BaseTask], _driver: Driver) -> None:
    result = await _run(env, task_factory(), _noop, answer="")
    assert not result.success, f"[{name}] noop negative unexpectedly passed:\n{_format(result)}"
