"""
Weather task correctness tests.
"""

from __future__ import annotations

import copy
import datetime
import inspect
import random
import re
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.utils import format_date_natural, parse_date
from bench_env.task.weather.app import Weather
from bench_env.task.weather import tasks as _tasks_module
from bench_env.tests.conftest import make_judge_input
from bench_env.tests.fixtures.weather import (
    ALL_BUNDLES,
    BASE_DATE,
    BASE_STATE,
    CITY_CATALOG,
    CITY_FIXTURES,
    TEST_OS_STATE,
)

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

DEFAULT_ROUTE = {"app": "weather", "path": "/"}
FORECAST_ROUTE = {"app": "weather", "path": "/forecast/daily"}

def _make_weather_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
):
    return make_judge_input(
        {"apps": {"weather": init_state}, "os": TEST_OS_STATE},
        {"apps": {"weather": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )



def _fmt(v: Any) -> str:
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def _date_label(date_str: str) -> str:
    return format_date_natural(date_str, {"os": TEST_OS_STATE})


def _realistic_answer(task: BaseTask, expected: Any) -> str:
    """Wrap ground truth into a realistic agent response sentence."""
    cls = type(task).__name__

    if cls == "CheckCurrentTemp":
        return f"{task.p.city}现在{_fmt(expected)}度"
    if cls == "CheckCurrentWeather":
        return f"{task.p.city}今天天气{expected}"
    if cls == "CompareCityTemp":
        if isinstance(expected, re.Pattern):
            return f"{task.p.city1}和{task.p.city2}现在温度差不多"
        return f"{expected}现在更热一些"
    if cls == "CheckDetailCard":
        if isinstance(expected, dict):
            return f"{task.p.city}现在{expected['dir']}，风力{expected['scale']}级"
        return f"{task.p.city}当前值是{_fmt(expected)}"
    if cls == "OpenDailyForecast":
        return f"{task.p.city}那天天气{expected}"
    if cls == "CheckAQIPollutant":
        return f"{task.p.city}当前该污染物指数是{_fmt(expected)}"
    if cls == "CheckLifeIndex":
        return f"{task.p.city}今天该指数{expected}"
    if cls == "WarmestDayInWeek":
        return (
            f"{task.p.city}未来五天{_date_label(expected['dates'][0])}最暖和，"
            f"最高温{_fmt(expected['temp'])}度，天气{expected['weather'][0]}"
        )
    if cls == "SwitchUnitAndReport":
        return f"{task.p.city}现在华氏{_fmt(expected)}度"
    if cls == "FeelsLikeDiff":
        return f"{task.p.city}体感温度和实际温度差了{_fmt(expected)}度"
    if cls == "CompareTempRange":
        if isinstance(expected, re.Pattern):
            return f"{task.p.city1}和{task.p.city2}明天温差差不多"
        return f"{expected}明天温差更大"
    if cls == "CompareHumidity":
        if isinstance(expected, re.Pattern):
            return f"{task.p.city1}和{task.p.city2}湿度相同"
        return f"{expected}现在更潮湿"
    if cls == "ColdestDayIn14":
        return (
            f"{task.p.city}未来两周{_date_label(expected['dates'][0])}最冷，"
            f"最低温{_fmt(expected['temp'])}度"
        )
    if cls == "NightLowTemp":
        return f"{task.p.city}今晚最低降到{_fmt(expected)}度"
    if cls == "AddCityAndFindWarmestDay":
        return f"{task.p.city}未来一周{_date_label(expected['date'])}最暖和"
    if cls == "ThreeCityRainCheck":
        if isinstance(expected, re.Pattern):
            return "三个城市下雨概率差不多"
        return f"三个城市里{expected}未来一周最不容易下雨"
    if cls == "AddCityFullReport":
        return (
            f"{task.p.city}现在温度{_fmt(expected['temp'])}度，"
            f"湿度{_fmt(expected['humidity'])}%，空气质量指数{_fmt(expected['aqi'])}"
        )
    if cls == "WeekendTempRange3City":
        if isinstance(expected, re.Pattern):
            return "三个城市周末温差都差不多"
        return f"周末{expected}温差更小"
    raise ValueError(f"No realistic answer template for {cls}")


def _positive_answer_case(task: BaseTask, curr_state: dict[str, Any], *, route=None):
    inp = _make_weather_input(BASE_STATE, curr_state, route=route)
    expected = task.get_answer(inp)  # type: ignore[attr-defined]
    return task, _make_weather_input(BASE_STATE, curr_state, route=route, answer=_realistic_answer(task, expected))



def _negative_answer_case(task: BaseTask, curr_state: dict[str, Any], *, route=None):
    return task, _make_weather_input(BASE_STATE, curr_state, route=route, answer="错误答案")



def _positive_operate_case(task: BaseTask, curr_state: dict[str, Any], *, route=None, answer=None):
    return task, _make_weather_input(BASE_STATE, curr_state, route=route, answer=answer)



def _negative_operate_case(task: BaseTask, *, route=None, answer=None):
    return task, _make_weather_input(BASE_STATE, copy.deepcopy(BASE_STATE), route=route, answer=answer)



def _with_settings(**updates: Any) -> dict[str, Any]:
    state = copy.deepcopy(BASE_STATE)
    state["settings"].update(updates)
    return state



def _with_added_city(city_name: str) -> dict[str, Any]:
    state = copy.deepcopy(BASE_STATE)
    city = CITY_CATALOG[city_name]
    state["savedCities"].append(copy.deepcopy(city))
    state["selectedCityId"] = city["id"]
    state["searchHistory"] = [city_name]
    state["lastAccess"] = {
        "cityId": city["id"],
        "bundleUpdatedAt": ALL_BUNDLES[city["id"]]["updatedAt"],
        "at": TEST_OS_STATE["time"]["timestamp"],
    }
    return state


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "weather" in task.apps

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
        assert cls.objective in ("operate", "query", "hybrid")
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


class TestWeatherAccessor:
    @pytest.fixture
    def weather(self) -> Weather:
        return Weather(copy.deepcopy(BASE_STATE))

    def test_sampling_helpers(self):
        rng = random.Random(0)
        sampled_date = Weather.sample_forecast_date_7_to_14({"os": TEST_OS_STATE}, rng)
        assert 7 <= (parse_date(sampled_date) - BASE_DATE).days <= 14
        pair = Weather.sample_two_saved_cities({}, random.Random(1))
        assert pair["city1"] != pair["city2"]
        triplet = Weather.sample_three_saved_cities({}, random.Random(2))
        assert len({triplet["city1"], triplet["city2"], triplet["city3"]}) == 3

    def test_date_labels_without_os(self):
        labels = Weather.date_labels(BASE_DATE.isoformat())
        assert BASE_DATE.isoformat() in labels
        assert f"{BASE_DATE.month}月{BASE_DATE.day}号" in labels
        assert f"{BASE_DATE.day}号" in labels
        wd = ["一", "二", "三", "四", "五", "六", "日"][BASE_DATE.weekday()]
        assert f"周{wd}" in labels
        assert f"星期{wd}" in labels

    def test_date_labels_with_os(self):
        labels = Weather.date_labels(BASE_DATE.isoformat(), TEST_OS_STATE)
        assert "今天" in labels
        tomorrow = (BASE_DATE + datetime.timedelta(days=1)).isoformat()
        assert "明天" in Weather.date_labels(tomorrow, TEST_OS_STATE)
        day_after = (BASE_DATE + datetime.timedelta(days=2)).isoformat()
        assert "后天" in Weather.date_labels(day_after, TEST_OS_STATE)
        two_days_after = (BASE_DATE + datetime.timedelta(days=3)).isoformat()
        assert "大后天" in Weather.date_labels(two_days_after, TEST_OS_STATE)

    def test_saved_and_selected_city_matching(self, weather: Weather):
        assert weather.saved_city_matches("北京") is True
        assert weather.selected_city_matches("北京") is True
        assert weather.selected_city_matches("上海") is False

    def test_city_identity_lookup(self, weather: Weather):
        assert weather.city_id_for_name("北京") == "beijing"
        assert weather.city_name_for("北京") == "北京"

    def test_bundle_sections(self, weather: Weather):
        assert weather.weather_bundle("北京")["now"]["temp"] == "20"
        assert weather.weather_now("北京")["text"] == "晴"
        assert len(weather.weather_daily("北京")) == 15
        assert len(weather.weather_hourly("北京")) == 24
        assert len(weather.weather_indices("北京")) == 5

    def test_current_metrics(self, weather: Weather):
        assert weather.current_temp("北京") == 20
        assert weather.current_weather_text("北京") == "晴"
        assert weather.current_feels_like("北京") == 18
        assert weather.current_humidity("北京") == 40
        assert weather.current_wind_info("北京") == {"dir": "北风", "scale": "3", "speed": 12.0}

    def test_today_cards(self, weather: Weather):
        assert weather.today_forecast("北京")["sunrise"] == "06:12"
        assert weather.today_sunrise("北京") == "06:12"
        assert weather.today_uv_index("北京") == "7"

    def test_daily_queries(self, weather: Weather):
        target_date = (BASE_DATE + datetime.timedelta(days=7)).isoformat()
        assert len(weather.daily_range("北京", 1, 5)) == 5
        assert weather.daily_by_date("北京", target_date)["fxDate"] == target_date
        assert weather.is_rainy_on_date("广州", BASE_DATE, BASE_DATE) is True
        assert weather.is_rainy_on_date("北京", BASE_DATE, BASE_DATE) is False

    def test_air_quality_and_indices(self, weather: Weather):
        air = weather.air_quality("上海")
        assert air["aqi"] == "96"
        assert weather.pollutant_value("上海", "pm2p5") == "86"
        assert weather.life_index_by_name("杭州", "洗车")["category"] == CITY_FIXTURES["hangzhou"]["wash"]

    def test_city_summary_and_tomorrow_range(self, weather: Weather):
        bundle_now = weather.city_bundle_now("北京")
        assert bundle_now["cityId"] == "beijing"
        assert bundle_now["city"] == "北京"
        assert bundle_now["temp"] == 20
        tomorrow = weather.city_tomorrow_high_low("北京", TEST_OS_STATE["time"]["timestamp"])
        assert tomorrow["cityId"] == "beijing"
        assert tomorrow["high"] == 22
        assert tomorrow["low"] == 12

    def test_weather_text_helpers(self):
        assert Weather.is_raining_text("小雨") is True
        assert Weather.is_cloudy_text("多云") is True
        assert Weather.is_known_weather_text("雾") is True
        assert Weather.is_known_weather_text("sandstorm") is True
        assert Weather.is_known_weather_text("") is False
        assert Weather.is_known_weather_text("天气不错") is False
        assert Weather.is_non_sunny_text("小雨") is True
        assert Weather.is_non_sunny_text("阴") is True
        assert Weather.is_non_sunny_text("多云") is True
        assert Weather.is_non_sunny_text("晴") is False
        assert Weather.is_non_sunny_text("unknown") is False
        assert Weather.is_non_sunny_text("") is False
        assert Weather.hour_from_fx_time(f"{BASE_DATE.isoformat()}T19:00+08:00") == 19
        assert Weather.hour_from_fx_time("05:00") == 5


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("CheckCurrentTemp", lambda: _positive_answer_case(_tasks_module.CheckCurrentTemp(city="北京"), copy.deepcopy(BASE_STATE))),
    ("CheckCurrentWeather", lambda: _positive_answer_case(_tasks_module.CheckCurrentWeather(city="上海"), copy.deepcopy(BASE_STATE))),
    ("EnableNightDnd", lambda: _positive_operate_case(_tasks_module.EnableNightDnd(), _with_settings(nightDnd=True))),
    ("SwitchTempUnit", lambda: _positive_operate_case(_tasks_module.SwitchTempUnit(unit="fahrenheit"), _with_settings(tempUnit="fahrenheit"))),
    ("SwitchWindUnit", lambda: _positive_operate_case(_tasks_module.SwitchWindUnit(unit="ms"), _with_settings(windUnit="ms"))),
    ("CompareCityTemp", lambda: _positive_answer_case(_tasks_module.CompareCityTemp(city1="北京", city2="上海"), copy.deepcopy(BASE_STATE))),
    ("CheckDetailCard", lambda: _positive_answer_case(_tasks_module.CheckDetailCard(city="北京", metric="humidity"), copy.deepcopy(BASE_STATE))),
    ("OpenDailyForecast", lambda: _positive_answer_case(_tasks_module.OpenDailyForecast(city="北京", date=(BASE_DATE + datetime.timedelta(days=7)).isoformat()), copy.deepcopy(BASE_STATE), route=FORECAST_ROUTE)),
    ("CheckAQIPollutant", lambda: _positive_answer_case(_tasks_module.CheckAQIPollutant(city="上海", pollutant="pm2p5"), copy.deepcopy(BASE_STATE))),
    ("CheckLifeIndex", lambda: _positive_answer_case(_tasks_module.CheckLifeIndex(city="杭州", index_type="洗车"), copy.deepcopy(BASE_STATE))),
    ("WarmestDayInWeek", lambda: _positive_answer_case(_tasks_module.WarmestDayInWeek(city="深圳"), copy.deepcopy(BASE_STATE))),
    ("SwitchUnitAndReport", lambda: _positive_answer_case(_tasks_module.SwitchUnitAndReport(city="上海"), _with_settings(tempUnit="fahrenheit"))),
    ("FeelsLikeDiff", lambda: _positive_answer_case(_tasks_module.FeelsLikeDiff(city="北京"), copy.deepcopy(BASE_STATE))),
    ("CompareTempRange", lambda: _positive_answer_case(_tasks_module.CompareTempRange(city1="北京", city2="上海"), copy.deepcopy(BASE_STATE))),
    ("CompareHumidity", lambda: _positive_answer_case(_tasks_module.CompareHumidity(city1="北京", city2="广州"), copy.deepcopy(BASE_STATE))),
    ("ColdestDayIn14", lambda: _positive_answer_case(_tasks_module.ColdestDayIn14(city="成都"), copy.deepcopy(BASE_STATE), route=FORECAST_ROUTE)),
    ("NightLowTemp", lambda: _positive_answer_case(_tasks_module.NightLowTemp(city="广州"), copy.deepcopy(BASE_STATE))),
    ("AddCityAndFindWarmestDay", lambda: _positive_answer_case(_tasks_module.AddCityAndFindWarmestDay(city="南京"), _with_added_city("南京"))),
    ("ThreeCityRainCheck", lambda: _positive_answer_case(_tasks_module.ThreeCityRainCheck(city1="北京", city2="上海", city3="广州"), copy.deepcopy(BASE_STATE))),
    ("ConditionalAction", lambda: _positive_operate_case(_tasks_module.ConditionalAction(city="深圳", temp=30), _with_settings(warningAlert=False))),
    ("AddCityFullReport", lambda: _positive_answer_case(_tasks_module.AddCityFullReport(city="武汉"), _with_added_city("武汉"))),
    ("WeekendTempRange3City", lambda: _positive_answer_case(_tasks_module.WeekendTempRange3City(city1="北京", city2="上海", city3="杭州"), copy.deepcopy(BASE_STATE))),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("CheckCurrentTemp", lambda: _negative_answer_case(_tasks_module.CheckCurrentTemp(city="北京"), copy.deepcopy(BASE_STATE))),
    ("CheckCurrentWeather", lambda: _negative_answer_case(_tasks_module.CheckCurrentWeather(city="上海"), copy.deepcopy(BASE_STATE))),
    ("EnableNightDnd", lambda: _negative_operate_case(_tasks_module.EnableNightDnd())),
    ("SwitchTempUnit", lambda: _negative_operate_case(_tasks_module.SwitchTempUnit(unit="fahrenheit"))),
    ("SwitchWindUnit", lambda: _negative_operate_case(_tasks_module.SwitchWindUnit(unit="ms"))),
    ("CompareCityTemp", lambda: _negative_answer_case(_tasks_module.CompareCityTemp(city1="北京", city2="上海"), copy.deepcopy(BASE_STATE))),
    ("CheckDetailCard", lambda: _negative_answer_case(_tasks_module.CheckDetailCard(city="北京", metric="humidity"), copy.deepcopy(BASE_STATE))),
    ("OpenDailyForecast", lambda: _negative_answer_case(_tasks_module.OpenDailyForecast(city="北京", date=(BASE_DATE + datetime.timedelta(days=7)).isoformat()), copy.deepcopy(BASE_STATE), route=DEFAULT_ROUTE)),
    ("CheckAQIPollutant", lambda: _negative_answer_case(_tasks_module.CheckAQIPollutant(city="上海", pollutant="pm2p5"), copy.deepcopy(BASE_STATE))),
    ("CheckLifeIndex", lambda: _negative_answer_case(_tasks_module.CheckLifeIndex(city="杭州", index_type="洗车"), copy.deepcopy(BASE_STATE))),
    ("WarmestDayInWeek", lambda: _negative_answer_case(_tasks_module.WarmestDayInWeek(city="深圳"), copy.deepcopy(BASE_STATE))),
    ("SwitchUnitAndReport", lambda: _negative_answer_case(_tasks_module.SwitchUnitAndReport(city="上海"), copy.deepcopy(BASE_STATE))),
    ("FeelsLikeDiff", lambda: _negative_answer_case(_tasks_module.FeelsLikeDiff(city="北京"), copy.deepcopy(BASE_STATE))),
    ("CompareTempRange", lambda: _negative_answer_case(_tasks_module.CompareTempRange(city1="北京", city2="上海"), copy.deepcopy(BASE_STATE))),
    ("CompareHumidity", lambda: _negative_answer_case(_tasks_module.CompareHumidity(city1="北京", city2="广州"), copy.deepcopy(BASE_STATE))),
    ("ColdestDayIn14", lambda: _negative_answer_case(_tasks_module.ColdestDayIn14(city="成都"), copy.deepcopy(BASE_STATE), route=DEFAULT_ROUTE)),
    ("NightLowTemp", lambda: _negative_answer_case(_tasks_module.NightLowTemp(city="广州"), copy.deepcopy(BASE_STATE))),
    ("AddCityAndFindWarmestDay", lambda: _negative_operate_case(_tasks_module.AddCityAndFindWarmestDay(city="南京"), answer="错误答案")),
    ("ThreeCityRainCheck", lambda: _negative_answer_case(_tasks_module.ThreeCityRainCheck(city1="北京", city2="上海", city3="广州"), copy.deepcopy(BASE_STATE))),
    ("ConditionalAction", lambda: _negative_operate_case(_tasks_module.ConditionalAction(city="深圳", temp=30))),
    ("AddCityFullReport", lambda: _negative_operate_case(_tasks_module.AddCityFullReport(city="武汉"), answer="错误答案")),
    ("WeekendTempRange3City", lambda: _negative_answer_case(_tasks_module.WeekendTempRange3City(city1="北京", city2="上海", city3="杭州"), copy.deepcopy(BASE_STATE))),
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
