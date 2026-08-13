"""Live scripted-plan verification for the Calendar suite.

Single-source policy: answers, ``eventId``, ``deletedCount``, ``targetDate``,
the reminder-sheet labels and the holiday view dates are **not** injected here
— they come from ``scripted_plans.DERIVED_PARAMS``, computed at
materialization time from the episode's post-setup initial state through the
judge-homologous ``Calendar`` domain class and the judge-side holiday tables.
That is exactly the official ``--agent scripted`` sampling path, so these live
cases regression-test the derivation itself.

Only *declared* task parameters stay pinned below, for deterministic
coverage:

- ``MakeupDayReminder`` pins 清明 (no post-holiday makeup → the ``no_makeup``
  Branch arm); the ``has_makeup`` arm is exercised on the CLI sampling path
  (holidays 元旦/春节/五一/国庆).
- ``SearchDeleteAll`` pins 项目 (the 6-deletion Branch arm); the 团队 arm (2
  deletions) is exercised via sampling.
- ``EditAndReportNewTime`` pins ``new_date`` on a *different* day than the
  seeded 团队周会 (today+5 vs seed today+3) so the date-move path
  (delete + recreate — the event form has no date control) is proven live.
"""

from __future__ import annotations

import datetime as dt
from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.calendar import tasks as calendar_tasks
from bench_env.task.registry import TaskRegistry
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "calendar"


def _task(name: str, **params) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{name}", **params)


def _date_after(days: int) -> str:
    return (dt.date.today() + dt.timedelta(days=days)).isoformat()


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("ToggleShowWeekNumber", lambda: calendar_tasks.ToggleShowWeekNumber(toggle=True)),
    (
        "ChangeDefaultReminder",
        lambda: calendar_tasks.ChangeDefaultReminder(reminder="5_minutes_before"),
    ),
    (
        "CreateEvent",
        lambda: calendar_tasks.CreateEvent(date=_date_after(9), title="牙医复诊"),
    ),
    ("DeleteEvent", lambda: calendar_tasks.DeleteEvent(title="团队周会")),
    ("SearchEventTitle", lambda: calendar_tasks.SearchEventTitle(keyword="项目")),
    (
        "CreateBirthdayEvent",
        lambda: calendar_tasks.CreateBirthdayEvent(date=_date_after(10), title="爸爸生日"),
    ),
    (
        "CreateTimedEvent",
        lambda: calendar_tasks.CreateTimedEvent(
            date=_date_after(11),
            title="面试",
            start="14:00",
            end="15:00",
        ),
    ),
    (
        "CreateEventWithReminder",
        lambda: calendar_tasks.CreateEventWithReminder(
            date=_date_after(12),
            title="出差提醒",
            reminder=30,
        ),
    ),
    (
        "CreateEventWithAlarmAndConfirm",
        lambda: _task(
            "CreateEventWithAlarmAndConfirm",
            date=_date_after(13),
            title="面试",
        ),
    ),
    (
        "DateCalcForward",
        lambda: calendar_tasks.DateCalcForward(date=_date_after(1), days=35),
    ),
    (
        "CalculateDateInterval",
        lambda: calendar_tasks.CalculateDateInterval(
            date1=_date_after(5),
            date2=_date_after(50),
        ),
    ),
    ("QueryHolidayLength", lambda: calendar_tasks.QueryHolidayLength(holiday="春节")),
    ("QueryMakeupWorkday", lambda: calendar_tasks.QueryMakeupWorkday(holiday="春节")),
    (
        "ConfigAllReminders",
        lambda: calendar_tasks.ConfigAllReminders(
            r1="30_minutes_before",
            r2="start_of_day",
            r3="30_minutes",
        ),
    ),
    (
        "EditEventTime",
        lambda: calendar_tasks.EditEventTime(title="项目汇报", new_time="11:00"),
    ),
    (
        "QueryFirstEventOnDate",
        lambda: calendar_tasks.QueryFirstEventOnDate(date=_date_after(3)),
    ),
    (
        "DateCalcThenCreate",
        lambda: calendar_tasks.DateCalcThenCreate(
            date=_date_after(4),
            days=10,
            title="出发提醒",
        ),
    ),
    (
        "MakeupDayReminder",
        lambda: calendar_tasks.MakeupDayReminder(holiday="清明", title="补班提醒"),
    ),
    ("SearchDeleteAll", lambda: calendar_tasks.SearchDeleteAll(keyword="项目")),
    (
        "CompareScheduleDensity",
        lambda: calendar_tasks.CompareScheduleDensity(
            date1=_date_after(3),
            date2=_date_after(14),
        ),
    ),
    (
        "EditAndReportNewTime",
        lambda: calendar_tasks.EditAndReportNewTime(
            title="团队周会",
            new_date=_date_after(5),
            new_time="10:30",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(calendar_tasks)
    missing = declared - covered
    assert not missing, f"Calendar tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_calendar_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
