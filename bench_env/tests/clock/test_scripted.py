"""Live scripted-plan verification for the Clock suite."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.clock import tasks as clock_tasks
from bench_env.task.clock.app import Clock
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "clock"
ROOT = Path(__file__).resolve().parents[3]
APP_DIR = ROOT / "system" / "Clock" / "data"


def _clock_state() -> dict[str, Any]:
    defaults = json.loads((APP_DIR / "defaults.json").read_text(encoding="utf-8"))
    cities = json.loads((APP_DIR / "cities.json").read_text(encoding="utf-8"))
    return {**defaults, "cities": cities}


CLOCK = Clock(_clock_state())


def _os_state_now() -> dict[str, Any]:
    return {"time": {"timestamp": int(time.time() * 1000)}}


def _city_time(city: str) -> str:
    return CLOCK.city_time(city, _os_state_now())


def _local_diff_text(city: str) -> str:
    diff_minutes = int(CLOCK.find_city(city)["gmtOffsetMinutes"]) - Clock._local_offset_minutes(_os_state_now())
    if diff_minutes == 0:
        return "一样"
    sign = "快" if diff_minutes > 0 else "慢"
    abs_minutes = abs(diff_minutes)
    hours = abs_minutes // 60
    minutes = abs_minutes % 60
    parts: list[str] = []
    if hours:
        parts.append(f"{hours}小时")
    if minutes:
        parts.append(f"{minutes}分钟")
    return f"{sign}{''.join(parts)}"


async def _freeze_to_0710(env: Any) -> None:
    page = getattr(env, "page", None)
    if page is None:
        return
    await page.evaluate("() => window.__SIM_TIME__?.setSimulatedTime('2026-06-17T07:10:00', false)")


class FrozenAddAlarm(clock_tasks.AddAlarm):
    @property
    def name(self) -> str:
        return "AddAlarm"

    async def _post_sample(self, env: Any) -> None:
        await super()._post_sample(env)
        await _freeze_to_0710(env)


class FrozenAddAlarmWithSettings(clock_tasks.AddAlarmWithSettings):
    @property
    def name(self) -> str:
        return "AddAlarmWithSettings"

    async def _post_sample(self, env: Any) -> None:
        await super()._post_sample(env)
        await _freeze_to_0710(env)


class FrozenSetupMorningAlarms(clock_tasks.SetupMorningAlarms):
    @property
    def name(self) -> str:
        return "SetupMorningAlarms"

    async def _post_sample(self, env: Any) -> None:
        await super()._post_sample(env)
        await _freeze_to_0710(env)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("ToggleAlarm", lambda: clock_tasks.ToggleAlarm(alarm_id="a1", time="04:30", toggle=False)),
    ("CountAlarms", lambda: clock_tasks.CountAlarms(answer="7")),
    ("AddAlarm", lambda: FrozenAddAlarm(time="07:10", hour=7, minute=10)),
    ("DeleteAlarm", lambda: clock_tasks.DeleteAlarm(alarm_id="a2", time="05:00")),
    (
        "SetAlarmRepeat",
        lambda: clock_tasks.SetAlarmRepeat(
            alarm_id="a2",
            time="05:00",
            repeat="daily",
            repeatLabel="每天",
        ),
    ),
    ("AddWorldCity", lambda: clock_tasks.AddWorldCity(city="北京")),
    ("RemoveWorldCity", lambda: clock_tasks.RemoveWorldCity(city="伦敦")),
    ("CheckAlarmNote", lambda: clock_tasks.CheckAlarmNote(alarm_id="a4", time="06:10", answer="跑步")),
    (
        "AddAlarmWithSettings",
        lambda: FrozenAddAlarmWithSettings(
            time="07:10",
            hour=7,
            minute=10,
            repeat="once",
            note="晨练",
        ),
    ),
    ("EnableAllAlarms", lambda: clock_tasks.EnableAllAlarms()),
    ("CheckCityTime", lambda: clock_tasks.CheckCityTime(city="巴黎", answer=_city_time("巴黎"))),
    (
        "CompareCityTimeDiff",
        lambda: clock_tasks.CompareCityTimeDiff(city1="巴黎", city2="纽约", answer="6"),
    ),
    ("CityLocalTimeDiff", lambda: clock_tasks.CityLocalTimeDiff(city="巴黎", answer=_local_diff_text("巴黎"))),
    ("LatestTimezoneCity", lambda: clock_tasks.LatestTimezoneCity(answer="巴黎")),
    ("AddCityAndCheckTime", lambda: clock_tasks.AddCityAndCheckTime(city="北京", answer=_city_time("北京"))),
    (
        "AddCityAndCompareTimeDiff",
        lambda: clock_tasks.AddCityAndCompareTimeDiff(
            new_city="东京",
            existing_city="巴黎",
            answer="8",
        ),
    ),
    (
        "ReorganizeWorldClock",
        lambda: clock_tasks.ReorganizeWorldClock(remove_city="伦敦", add_city="东京"),
    ),
    (
        "SetupMorningAlarms",
        lambda: FrozenSetupMorningAlarms(
            time1="07:10",
            h1=7,
            m1=10,
            time2="07:10",
            h2=7,
            m2=10,
            repeat1="once",
            repeat2="once",
        ),
    ),
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
