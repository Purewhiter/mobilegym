"""Live scripted-plan verification for the Weather suite.

Single-source policy: answers, ``unit_action`` and ``city_id`` are **not**
injected here — they come from ``scripted_plans.DERIVED_PARAMS``, computed at
materialization time from the episode's post-setup initial state through the
judge-homologous ``Weather`` domain class. That is exactly the official
``--agent scripted`` sampling path, so these live cases regression-test the
derivation itself (the previous ``_weather_state()`` disk replica of the
frontend's date-shift bootstrap is gone — the real initial state already
carries sim-today-aligned ``weatherLibrary`` dates).

Only *declared* task parameters stay pinned below, for deterministic
coverage (fixed cities keep the manager-scroll geometry stable; ``date`` is
pinned mid-window so the forecast swipes stay representative).
"""

from __future__ import annotations

import datetime as dt
from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.weather import tasks as weather_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "weather"


def _day_after(days: int) -> str:
    """Sim time equals wall-clock in live runs (no scenario overrides)."""
    return (dt.date.today() + dt.timedelta(days=days)).isoformat()


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CheckCurrentTemp", lambda: weather_tasks.CheckCurrentTemp(city="北京")),
    ("CheckCurrentWeather", lambda: weather_tasks.CheckCurrentWeather(city="上海")),
    ("EnableNightDnd", lambda: weather_tasks.EnableNightDnd()),
    ("SwitchTempUnit", lambda: weather_tasks.SwitchTempUnit(unit="fahrenheit")),
    ("SwitchWindUnit", lambda: weather_tasks.SwitchWindUnit(unit="ms")),
    ("CompareCityTemp", lambda: weather_tasks.CompareCityTemp(city1="北京", city2="上海")),
    ("CheckDetailCard", lambda: weather_tasks.CheckDetailCard(city="北京", metric="humidity")),
    ("OpenDailyForecast", lambda: weather_tasks.OpenDailyForecast(city="北京", date=_day_after(9))),
    ("CheckAQIPollutant", lambda: weather_tasks.CheckAQIPollutant(city="上海", pollutant="pm2p5")),
    ("CheckLifeIndex", lambda: weather_tasks.CheckLifeIndex(city="杭州", index_type="洗车")),
    ("WarmestDayInWeek", lambda: weather_tasks.WarmestDayInWeek(city="深圳")),
    ("SwitchUnitAndReport", lambda: weather_tasks.SwitchUnitAndReport(city="上海")),
    ("FeelsLikeDiff", lambda: weather_tasks.FeelsLikeDiff(city="北京")),
    ("CompareTempRange", lambda: weather_tasks.CompareTempRange(city1="北京", city2="上海")),
    ("CompareHumidity", lambda: weather_tasks.CompareHumidity(city1="北京", city2="上海")),
    ("ColdestDayIn14", lambda: weather_tasks.ColdestDayIn14(city="成都")),
    ("NightLowTemp", lambda: weather_tasks.NightLowTemp(city="广州")),
    ("AddCityAndFindWarmestDay", lambda: weather_tasks.AddCityAndFindWarmestDay(city="南京")),
    (
        "ThreeCityRainCheck",
        lambda: weather_tasks.ThreeCityRainCheck(city1="北京", city2="上海", city3="广州"),
    ),
    ("ConditionalAction", lambda: weather_tasks.ConditionalAction(city="深圳", temp=30)),
    ("AddCityFullReport", lambda: weather_tasks.AddCityFullReport(city="武汉")),
    (
        "WeekendTempRange3City",
        lambda: weather_tasks.WeekendTempRange3City(city1="北京", city2="上海", city3="广州"),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(weather_tasks)
    missing = declared - covered
    assert not missing, f"Weather tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_weather_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
