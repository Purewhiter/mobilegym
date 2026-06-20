"""Live scripted-plan verification for the Calendar suite."""

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


def _add_days(date_value: str, days: int) -> str:
    return (dt.date.fromisoformat(date_value) + dt.timedelta(days=days)).isoformat()


def _end_answer(date_value: str, start_hhmm: str, duration_minutes: int) -> str:
    hour, minute = [int(part) for part in start_hhmm.split(":")]
    start = dt.datetime.combine(dt.date.fromisoformat(date_value), dt.time(hour, minute))
    end = start + dt.timedelta(minutes=duration_minutes)
    return f"{end.date().isoformat()} {end.hour:02d}:{end.minute:02d}"


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("ToggleShowWeekNumber", lambda: calendar_tasks.ToggleShowWeekNumber(toggle=True)),
    (
        "ChangeDefaultReminder",
        lambda: calendar_tasks.ChangeDefaultReminder(
            reminder="5_minutes_before",
            reminderLabel="5分钟前",
        ),
    ),
    (
        "CreateEvent",
        lambda: calendar_tasks.CreateEvent(date=_date_after(9), title="牙医复诊"),
    ),
    (
        "DeleteEvent",
        lambda: calendar_tasks.DeleteEvent(
            title="团队周会",
            eventId="seed_team_weekly",
        ),
    ),
    (
        "SearchEventTitle",
        lambda: calendar_tasks.SearchEventTitle(keyword="项目", answer="团队周会"),
    ),
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
            reminderChoice="提前30分钟",
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
        lambda: calendar_tasks.DateCalcForward(
            date=_date_after(1),
            days=35,
            answer=_add_days(_date_after(1), 35),
        ),
    ),
    (
        "CalculateDateInterval",
        lambda: calendar_tasks.CalculateDateInterval(
            date1=_date_after(5),
            date2=_date_after(50),
            answer="45",
        ),
    ),
    ("QueryHolidayLength", lambda: calendar_tasks.QueryHolidayLength(holiday="春节", answer="9")),
    (
        "QueryMakeupWorkday",
        lambda: calendar_tasks.QueryMakeupWorkday(holiday="春节", answer="2026-02-28"),
    ),
    (
        "ConfigAllReminders",
        lambda: calendar_tasks.ConfigAllReminders(
            r1="30_minutes_before",
            r2="start_of_day",
            r3="30_minutes",
            r1Label="30分钟前",
            r2Label="当天0:00",
            r3Label="30分钟后",
        ),
    ),
    (
        "EditEventTime",
        lambda: calendar_tasks.EditEventTime(
            title="项目汇报",
            eventId="seed_project_report",
            new_time="11:00",
        ),
    ),
    (
        "QueryFirstEventOnDate",
        lambda: calendar_tasks.QueryFirstEventOnDate(
            date=_date_after(3),
            answerTitle="团队周会",
            answerTime="09:00",
        ),
    ),
    (
        "DateCalcThenCreate",
        lambda: calendar_tasks.DateCalcThenCreate(
            date=_date_after(4),
            days=10,
            title="出发提醒",
            targetDate=_add_days(_date_after(4), 10),
            answer=_add_days(_date_after(4), 10),
        ),
    ),
    (
        "MakeupDayReminder",
        lambda: calendar_tasks.MakeupDayReminder(
            holiday="清明",
            title="补班提醒",
            answerChoice="不用补班",
        ),
    ),
    (
        "SearchDeleteAll",
        lambda: calendar_tasks.SearchDeleteAll(
            keyword="项目",
            deletedCount="6",
        ),
    ),
    (
        "CompareScheduleDensity",
        lambda: calendar_tasks.CompareScheduleDensity(
            date1=_date_after(3),
            date2=_date_after(14),
            answerChoice=_date_after(3),
        ),
    ),
    (
        "EditAndReportNewTime",
        lambda: calendar_tasks.EditAndReportNewTime(
            title="团队周会",
            eventId="seed_team_weekly",
            new_date=_date_after(3),
            new_time="10:30",
            answerEnd=_end_answer(_date_after(3), "10:30", 60),
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
