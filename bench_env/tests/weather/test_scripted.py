"""Live scripted-plan verification for the Weather suite."""

from __future__ import annotations

import copy
import datetime as dt
import json
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.weather import tasks as weather_tasks
from bench_env.task.weather.app import Weather
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "weather"
ROOT = Path(__file__).resolve().parents[3]
APP_DIR = ROOT / "apps" / "Weather" / "data"
DAY_MS = 86_400_000


def _shift_date_string(value: str, offset_days: int) -> str:
    if len(value) < 10:
        return value
    try:
        base = dt.date.fromisoformat(value[:10])
    except ValueError:
        return value
    shifted = base + dt.timedelta(days=offset_days)
    return shifted.isoformat() + value[10:]


def _shift_dates(node: Any, offset_days: int) -> Any:
    if isinstance(node, str):
        return _shift_date_string(node, offset_days)
    if isinstance(node, list):
        return [_shift_dates(item, offset_days) for item in node]
    if isinstance(node, dict):
        return {key: _shift_dates(value, offset_days) for key, value in node.items()}
    return node


def _weather_state() -> dict[str, Any]:
    defaults = json.loads((APP_DIR / "defaults.json").read_text(encoding="utf-8"))
    library = json.loads((APP_DIR / "weatherBundles.json").read_text(encoding="utf-8"))
    anchor = next(
        entry["bundle"]["daily"][0]["fxDate"][:10]
        for entry in library.values()
        if entry.get("bundle", {}).get("daily")
    )
    offset_days = (dt.date.today() - dt.date.fromisoformat(anchor)).days
    return {
        "version": 1,
        "selectedCityId": "located",
        "savedCities": defaults["savedCities"],
        "bundlesByCityId": {},
        "settings": defaults["settings"],
        "weatherLibrary": _shift_dates(copy.deepcopy(library), offset_days),
    }


WEATHER = Weather(_weather_state())


def _num(value: Any) -> str:
    value = float(value)
    return str(int(value)) if value.is_integer() else str(value)


def _date_label(date_value: str) -> str:
    d = dt.date.fromisoformat(date_value)
    return f"{d.month}月{d.day}日"


def _day_after(days: int) -> str:
    return (dt.date.today() + dt.timedelta(days=days)).isoformat()


def _warmer(city1: str, city2: str) -> str:
    winner, _, _ = WEATHER.hotter_city(city1, city2)
    return "一样热" if winner == "一样" else winner


def _larger_tomorrow_range(city1: str, city2: str) -> str:
    day1 = WEATHER.daily_range(city1, 1, 1)[0]
    day2 = WEATHER.daily_range(city2, 1, 1)[0]
    range1 = float(day1["tempMax"]) - float(day1["tempMin"])
    range2 = float(day2["tempMax"]) - float(day2["tempMin"])
    if range1 > range2:
        return city1
    if range2 > range1:
        return city2
    return "一样大"


def _more_humid(city1: str, city2: str) -> str:
    h1 = WEATHER.current_humidity(city1)
    h2 = WEATHER.current_humidity(city2)
    if h1 > h2:
        return city1
    if h2 > h1:
        return city2
    return "一样"


def _least_rainy(city1: str, city2: str, city3: str) -> str:
    counts = {
        city: Weather.count_rainy_days(WEATHER.daily_range(city, 1, 7))
        for city in (city1, city2, city3)
    }
    best = min(counts.values())
    winners = [city for city, days in counts.items() if days == best]
    return "差不多" if len(winners) > 1 else winners[0]


def _smallest_weekend_range(city1: str, city2: str, city3: str) -> str:
    ranges = {
        city: Weather.temp_range_of_days(WEATHER.weekend_daily(city)[:2])
        for city in (city1, city2, city3)
    }
    best = min(ranges.values())
    winners = [city for city, value in ranges.items() if value == best]
    return "差不多" if len(winners) > 1 else winners[0]


def _warmest_day(city: str, *, days: int) -> dict[str, str]:
    forecast = WEATHER.daily_range(city, 1, days)
    best = max(float(day["tempMax"]) for day in forecast)
    picked = next(day for day in forecast if float(day["tempMax"]) == best)
    return {
        "date": _date_label(str(picked["fxDate"])),
        "temp": _num(best),
        "weather": Weather.day_text(picked),
    }


def _coldest_day(city: str, *, days: int) -> dict[str, str]:
    forecast = WEATHER.daily_range(city, 1, days)
    best = min(float(day["tempMin"]) for day in forecast)
    picked = next(day for day in forecast if float(day["tempMin"]) == best)
    return {"date": _date_label(str(picked["fxDate"])), "temp": _num(best)}


def _night_low(city: str) -> str:
    temps: list[float] = []
    for item in WEATHER.weather_hourly(city):
        hour = Weather.hour_from_fx_time(item["fxTime"])
        if hour is not None and (hour >= 18 or hour < 4):
            temps.append(float(item["temp"]))
    return _num(min(temps))


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CheckCurrentTemp", lambda: weather_tasks.CheckCurrentTemp(city="北京", answer=_num(WEATHER.current_temp("北京")))),
    ("CheckCurrentWeather", lambda: weather_tasks.CheckCurrentWeather(city="上海", answer=WEATHER.current_weather_text("上海"))),
    ("EnableNightDnd", lambda: weather_tasks.EnableNightDnd()),
    (
        "SwitchTempUnit",
        lambda: weather_tasks.SwitchTempUnit(unit="fahrenheit", unit_action="settings.tempUnit.select.fahrenheit"),
    ),
    (
        "SwitchWindUnit",
        lambda: weather_tasks.SwitchWindUnit(unit="ms", unit_action="settings.windUnit.select.ms"),
    ),
    ("CompareCityTemp", lambda: weather_tasks.CompareCityTemp(city1="北京", city2="上海", answer=_warmer("北京", "上海"))),
    (
        "CheckDetailCard",
        lambda: weather_tasks.CheckDetailCard(city="北京", metric="humidity", answer=_num(WEATHER.current_humidity("北京"))),
    ),
    (
        "OpenDailyForecast",
        lambda: weather_tasks.OpenDailyForecast(
            city="北京",
            date=_day_after(9),
            answer=Weather.day_text(WEATHER.daily_by_date("北京", _day_after(9))),
        ),
    ),
    (
        "CheckAQIPollutant",
        lambda: weather_tasks.CheckAQIPollutant(
            city="上海",
            pollutant="pm2p5",
            answer=_num(int(float(WEATHER.pollutant_value("上海", "pm2p5")) + 0.5)),
        ),
    ),
    (
        "CheckLifeIndex",
        lambda: weather_tasks.CheckLifeIndex(
            city="杭州",
            index_type="洗车",
            answer=str(WEATHER.life_index_by_name("杭州", "洗车")["category"]).strip(),
        ),
    ),
    (
        "WarmestDayInWeek",
        lambda: weather_tasks.WarmestDayInWeek(
            city="深圳",
            answer_date=_warmest_day("深圳", days=5)["date"],
            answer_temp=_warmest_day("深圳", days=5)["temp"],
            answer_weather=_warmest_day("深圳", days=5)["weather"],
        ),
    ),
    (
        "SwitchUnitAndReport",
        lambda: weather_tasks.SwitchUnitAndReport(
            city="上海",
            unit_action="settings.tempUnit.select.fahrenheit",
            answer=_num(round(WEATHER.current_temp("上海") * 9 / 5 + 32)),
        ),
    ),
    ("FeelsLikeDiff", lambda: weather_tasks.FeelsLikeDiff(city="北京", answer=_num(abs(WEATHER.current_feels_like("北京") - WEATHER.current_temp("北京"))))),
    (
        "CompareTempRange",
        lambda: weather_tasks.CompareTempRange(city1="北京", city2="上海", answer=_larger_tomorrow_range("北京", "上海")),
    ),
    ("CompareHumidity", lambda: weather_tasks.CompareHumidity(city1="北京", city2="上海", answer=_more_humid("北京", "上海"))),
    (
        "ColdestDayIn14",
        lambda: weather_tasks.ColdestDayIn14(
            city="成都",
            answer_date=_coldest_day("成都", days=14)["date"],
            answer_temp=_coldest_day("成都", days=14)["temp"],
        ),
    ),
    ("NightLowTemp", lambda: weather_tasks.NightLowTemp(city="广州", answer=_night_low("广州"))),
    (
        "AddCityAndFindWarmestDay",
        lambda: weather_tasks.AddCityAndFindWarmestDay(
            city="南京",
            city_id="nanjing",
            answer_date=_warmest_day("南京", days=7)["date"],
        ),
    ),
    (
        "ThreeCityRainCheck",
        lambda: weather_tasks.ThreeCityRainCheck(
            city1="北京",
            city2="上海",
            city3="广州",
            answer=_least_rainy("北京", "上海", "广州"),
        ),
    ),
    ("ConditionalAction", lambda: weather_tasks.ConditionalAction(city="深圳", temp=30)),
    (
        "AddCityFullReport",
        lambda: weather_tasks.AddCityFullReport(
            city="武汉",
            city_id="wuhan",
            answer_temp=_num(WEATHER.current_temp("武汉")),
            answer_humidity=_num(WEATHER.current_humidity("武汉")),
            answer_aqi=_num(float(WEATHER.air_quality("武汉")["aqi"])),
        ),
    ),
    (
        "WeekendTempRange3City",
        lambda: weather_tasks.WeekendTempRange3City(
            city1="北京",
            city2="上海",
            city3="广州",
            answer=_smallest_weekend_range("北京", "上海", "广州"),
        ),
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
