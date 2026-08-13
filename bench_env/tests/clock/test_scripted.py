"""Live scripted-plan verification for the Clock suite.

Single-source note (Phase B): answer-class values (city times, alarm notes,
counts, repeat labels) are **not** injected here anymore — the suite's
``DERIVED_PARAMS`` (bench_env/tests/clock/scripted_plans.py) computes them
from the episode's initial state, exactly as on the official
``--agent scripted`` sampling path. These cases only pin entity-selecting
params (alarm ids, city names) so the fixed live matrix stays deterministic.

Add-alarm targets are pinned to *near-now* times: sim time is the real clock
and the add-alarm draft opens at "now", so a nearby target keeps the wheel
journey short and deterministic while still exercising the real anchored
wheel path (sync wait + hour/minute wheels + save). CLI sampling covers the
long-journey space; its limits are documented in the migration report.
"""

from __future__ import annotations

import datetime
from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.clock import tasks as clock_tasks
from bench_env.task.clock.app import ALARM_TIME_PARAM
from bench_env.task.utils import format_hhmm
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "clock"


def _near_future_alarm(offset_minutes: int) -> dict[str, int | str]:
    """time/hour/minute params ``offset_minutes`` from now, avoiding default alarms.

    The episode's add-alarm draft opens at sim "now" (= real clock), so this
    keeps the wheel journey to a few deterministic swipes. Bump by one minute
    while the slot collides with a default alarm time (judge asserts the
    target is not already present in the initial state).
    """
    when = datetime.datetime.now() + datetime.timedelta(minutes=offset_minutes)
    hour, minute = when.hour, when.minute
    while format_hhmm(hour, minute) in ALARM_TIME_PARAM:
        minute += 1
        hour, minute = (hour + minute // 60) % 24, minute % 60
    return {"time": format_hhmm(hour, minute), "hour": hour, "minute": minute}


def _make_add_alarm() -> BaseTask:
    return clock_tasks.AddAlarm(**_near_future_alarm(3))


def _make_add_alarm_with_settings() -> BaseTask:
    return clock_tasks.AddAlarmWithSettings(
        **_near_future_alarm(4),
        repeat="daily",  # != the add-sheet draft default (once): exercises set_repeat
        note="晨练",
    )


def _make_setup_morning_alarms() -> BaseTask:
    first = _near_future_alarm(3)
    second = _near_future_alarm(16)  # ~13-minute wheel journey for the second alarm
    return clock_tasks.SetupMorningAlarms(
        time1=first["time"],
        h1=first["hour"],
        m1=first["minute"],
        time2=second["time"],
        h2=second["hour"],
        m2=second["minute"],
        repeat1="once",
        repeat2="daily",
    )


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("ToggleAlarm", lambda: clock_tasks.ToggleAlarm(alarm_id="a1", time="04:30", toggle=False)),
    ("CountAlarms", lambda: clock_tasks.CountAlarms()),
    ("AddAlarm", _make_add_alarm),
    ("DeleteAlarm", lambda: clock_tasks.DeleteAlarm(alarm_id="a2", time="05:00")),
    ("SetAlarmRepeat", lambda: clock_tasks.SetAlarmRepeat(alarm_id="a2", time="05:00", repeat="daily")),
    ("AddWorldCity", lambda: clock_tasks.AddWorldCity(city="北京")),
    ("RemoveWorldCity", lambda: clock_tasks.RemoveWorldCity(city="伦敦")),
    ("CheckAlarmNote", lambda: clock_tasks.CheckAlarmNote(alarm_id="a4", time="06:10")),
    ("AddAlarmWithSettings", _make_add_alarm_with_settings),
    ("EnableAllAlarms", lambda: clock_tasks.EnableAllAlarms()),
    ("CheckCityTime", lambda: clock_tasks.CheckCityTime(city="巴黎")),
    ("CompareCityTimeDiff", lambda: clock_tasks.CompareCityTimeDiff(city1="巴黎", city2="纽约")),
    ("CityLocalTimeDiff", lambda: clock_tasks.CityLocalTimeDiff(city="巴黎")),
    ("LatestTimezoneCity", lambda: clock_tasks.LatestTimezoneCity()),
    ("AddCityAndCheckTime", lambda: clock_tasks.AddCityAndCheckTime(city="北京")),
    (
        "AddCityAndCompareTimeDiff",
        lambda: clock_tasks.AddCityAndCompareTimeDiff(new_city="东京", existing_city="巴黎"),
    ),
    (
        "ReorganizeWorldClock",
        lambda: clock_tasks.ReorganizeWorldClock(remove_city="伦敦", add_city="东京"),
    ),
    ("SetupMorningAlarms", _make_setup_morning_alarms),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(clock_tasks)
    missing = declared - covered
    assert not missing, f"Clock tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_clock_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
