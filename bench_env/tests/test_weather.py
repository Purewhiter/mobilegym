"""
Weather task correctness tests.
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
from bench_env.task.utils import format_date_natural, parse_date
from bench_env.task.weather.app import Weather
from bench_env.task.weather import tasks as _tasks_module
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
BASE_DATE = datetime.date.fromtimestamp(TEST_OS_STATE["time"]["timestamp"] / 1000.0)
DEFAULT_ROUTE = {"app": "weather", "path": "/"}
FORECAST_ROUTE = {"app": "weather", "path": "/forecast/daily"}


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "apps" / "Weather" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


DEFAULTS = _load_defaults()

CITY_CATALOG = {
    "北京": {"id": "beijing", "name": "北京市", "lon": 116.4074, "lat": 39.9042},
    "上海": {"id": "shanghai", "name": "上海市", "lon": 121.4737, "lat": 31.2304},
    "广州": {"id": "guangzhou", "name": "广州市", "lon": 113.2644, "lat": 23.1291},
    "深圳": {"id": "shenzhen", "name": "深圳市", "lon": 114.0579, "lat": 22.5431},
    "杭州": {"id": "hangzhou", "name": "杭州市", "lon": 120.1551, "lat": 30.2741},
    "成都": {"id": "chengdu", "name": "成都市", "lon": 104.0665, "lat": 30.5728},
    "南京": {"id": "nanjing", "name": "南京市", "lon": 118.7969, "lat": 32.0603},
    "武汉": {"id": "wuhan", "name": "武汉市", "lon": 114.3055, "lat": 30.5928},
    "三亚": {"id": "sanya", "name": "三亚市", "lon": 109.5119, "lat": 18.2528},
}

CITY_FIXTURES = {
    "beijing": {
        "short": "北京",
        "temp": 20,
        "feels": 18,
        "humidity": 40,
        "text": "晴",
        "wind_dir": "北风",
        "wind_scale": "3",
        "wind_speed": 12,
        "aqi": 82,
        "wash": "适宜",
        "dress": "舒适",
        "base_high": 20,
        "night_low": 11,
        "rainy": {3, 10},
        "cloudy": {1, 5, 8},
    },
    "shanghai": {
        "short": "上海",
        "temp": 28,
        "feels": 30,
        "humidity": 70,
        "text": "多云",
        "wind_dir": "东风",
        "wind_scale": "4",
        "wind_speed": 18,
        "aqi": 96,
        "wash": "较适宜",
        "dress": "较舒适",
        "base_high": 28,
        "night_low": 20,
        "rainy": {2, 4, 11},
        "cloudy": {0, 6, 7},
    },
    "guangzhou": {
        "short": "广州",
        "temp": 32,
        "feels": 35,
        "humidity": 80,
        "text": "小雨",
        "wind_dir": "南风",
        "wind_scale": "3",
        "wind_speed": 16,
        "aqi": 68,
        "wash": "不宜",
        "dress": "炎热",
        "base_high": 32,
        "night_low": 24,
        "rainy": {0, 1, 2, 5, 6, 7},
        "cloudy": {3, 4},
    },
    "shenzhen": {
        "short": "深圳",
        "temp": 30,
        "feels": 32,
        "humidity": 85,
        "text": "阴",
        "wind_dir": "东南风",
        "wind_scale": "2",
        "wind_speed": 10,
        "aqi": 55,
        "wash": "较适宜",
        "dress": "炎热",
        "base_high": 30,
        "night_low": 23,
        "rainy": {4, 9},
        "cloudy": {1, 2, 5},
    },
    "hangzhou": {
        "short": "杭州",
        "temp": 24,
        "feels": 23,
        "humidity": 55,
        "text": "晴",
        "wind_dir": "西风",
        "wind_scale": "2",
        "wind_speed": 9,
        "aqi": 72,
        "wash": "适宜",
        "dress": "舒适",
        "base_high": 24,
        "night_low": 15,
        "rainy": {6, 12},
        "cloudy": {0, 3, 4},
    },
    "chengdu": {
        "short": "成都",
        "temp": 18,
        "feels": 16,
        "humidity": 65,
        "text": "小雨",
        "wind_dir": "东北风",
        "wind_scale": "2",
        "wind_speed": 8,
        "aqi": 88,
        "wash": "不宜",
        "dress": "偏凉",
        "base_high": 18,
        "night_low": 8,
        "rainy": {0, 1, 8, 9, 10, 11},
        "cloudy": {2, 3, 4, 5},
    },
    "nanjing": {
        "short": "南京",
        "temp": 27,
        "feels": 29,
        "humidity": 60,
        "text": "多云",
        "wind_dir": "西南风",
        "wind_scale": "3",
        "wind_speed": 14,
        "aqi": 77,
        "wash": "较适宜",
        "dress": "舒适",
        "base_high": 27,
        "night_low": 18,
        "rainy": {5, 13},
        "cloudy": {2, 6, 7},
    },
    "wuhan": {
        "short": "武汉",
        "temp": 29,
        "feels": 31,
        "humidity": 75,
        "text": "晴",
        "wind_dir": "东南风",
        "wind_scale": "3",
        "wind_speed": 15,
        "aqi": 91,
        "wash": "较适宜",
        "dress": "较热",
        "base_high": 29,
        "night_low": 21,
        "rainy": {1, 8},
        "cloudy": {3, 4, 5},
    },
    "sanya": {
        "short": "三亚",
        "temp": 33,
        "feels": 36,
        "humidity": 78,
        "text": "晴",
        "wind_dir": "东风",
        "wind_scale": "4",
        "wind_speed": 22,
        "aqi": 42,
        "wash": "适宜",
        "dress": "炎热",
        "base_high": 33,
        "night_low": 25,
        "rainy": {14},
        "cloudy": {1},
    },
}


def _daily_entries(city_id: str) -> list[dict[str, Any]]:
    cfg = CITY_FIXTURES[city_id]
    pattern = [0, 2, 4, 5, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7]
    result = []
    for idx, delta in enumerate(pattern):
        date_value = BASE_DATE + datetime.timedelta(days=idx)
        text = "小雨" if idx in cfg["rainy"] else "多云" if idx in cfg["cloudy"] else "晴"
        high = cfg["base_high"] + delta
        low = high - 10
        precip = 6 if text == "小雨" else 1 if text == "多云" else 0
        result.append({
            "fxDate": date_value.isoformat(),
            "sunrise": "06:12",
            "sunset": "18:21",
            "moonrise": "19:00",
            "moonset": "06:00",
            "moonPhase": "盈凸月",
            "moonPhaseIcon": "801",
            "tempMax": str(high),
            "tempMin": str(low),
            "iconDay": "100",
            "textDay": text,
            "iconNight": "150",
            "textNight": text,
            "wind360Day": "90",
            "windDirDay": cfg["wind_dir"],
            "windScaleDay": cfg["wind_scale"],
            "windSpeedDay": str(cfg["wind_speed"]),
            "wind360Night": "90",
            "windDirNight": cfg["wind_dir"],
            "windScaleNight": cfg["wind_scale"],
            "windSpeedNight": str(max(cfg["wind_speed"] - 2, 1)),
            "humidity": str(cfg["humidity"]),
            "precip": str(precip),
            "pressure": "1012",
            "vis": "18",
            "cloud": "30",
            "uvIndex": "7" if text == "晴" else "4" if text == "多云" else "2",
        })
    return result



def _hourly_entries(city_id: str) -> list[dict[str, Any]]:
    cfg = CITY_FIXTURES[city_id]
    result = []
    for hour in range(24):
        if hour < 6:
            temp = cfg["night_low"] + max(0, hour - 2)
        elif hour < 12:
            temp = cfg["temp"] - 2 + (hour - 6)
        elif hour < 18:
            temp = cfg["temp"] + 4 - (hour - 12)
        else:
            temp = cfg["night_low"] + max(0, 23 - hour)
        text = "小雨" if hour in (19, 20) and city_id in {"guangzhou", "chengdu"} else cfg["text"]
        result.append({
            "fxTime": f"{BASE_DATE.isoformat()}T{hour:02d}:00+08:00",
            "temp": str(temp),
            "icon": "100",
            "text": text,
            "wind360": "90",
            "windDir": cfg["wind_dir"],
            "windScale": cfg["wind_scale"],
            "windSpeed": str(cfg["wind_speed"]),
            "humidity": str(cfg["humidity"]),
            "pop": "30" if text == "小雨" else "0",
            "precip": "2" if text == "小雨" else "0",
            "pressure": "1012",
            "cloud": "30",
            "dew": "10",
        })
    return result



def _indices_entries(city_id: str) -> list[dict[str, Any]]:
    cfg = CITY_FIXTURES[city_id]
    date_value = BASE_DATE.isoformat()
    return [
        {"date": date_value, "type": "1", "name": "运动", "level": "3", "category": "较适宜", "text": "适合轻度运动"},
        {"date": date_value, "type": "2", "name": "洗车", "level": "2", "category": cfg["wash"], "text": f"洗车指数{cfg['wash']}"},
        {"date": date_value, "type": "3", "name": "穿衣", "level": "2", "category": cfg["dress"], "text": f"穿衣指数{cfg['dress']}"},
        {"date": date_value, "type": "5", "name": "紫外线", "level": "3", "category": "中等", "text": "注意防晒"},
        {"date": date_value, "type": "9", "name": "感冒", "level": "1", "category": "少发", "text": "感冒风险低"},
    ]



def _air_quality_entry(city_id: str) -> dict[str, Any]:
    cfg = CITY_FIXTURES[city_id]
    aqi = cfg["aqi"]
    return {
        "pubTime": f"{BASE_DATE.isoformat()}T08:00+08:00",
        "aqi": str(aqi),
        "level": "2",
        "category": "良" if aqi <= 100 else "轻度",
        "primaryPollutant": "PM2.5",
        "pm10": str(aqi + 10),
        "pm2p5": str(aqi - 10),
        "no2": str(aqi - 20),
        "so2": str(aqi - 30),
        "co": "0.8",
        "o3": str(aqi - 15),
    }



def _bundle_entry(city_id: str) -> dict[str, Any]:
    catalog = next(item for item in CITY_CATALOG.values() if item["id"] == city_id)
    cfg = CITY_FIXTURES[city_id]
    return {
        "updatedAt": TEST_OS_STATE["time"]["timestamp"] - 60_000,
        "lonLat": f"{catalog['lon']},{catalog['lat']}",
        "locationName": cfg["short"],
        "bundle": {
            "now": {
                "obsTime": f"{BASE_DATE.isoformat()}T09:00+08:00",
                "temp": str(cfg["temp"]),
                "feelsLike": str(cfg["feels"]),
                "icon": "100",
                "text": cfg["text"],
                "wind360": "90",
                "windDir": cfg["wind_dir"],
                "windScale": cfg["wind_scale"],
                "windSpeed": str(cfg["wind_speed"]),
                "humidity": str(cfg["humidity"]),
                "precip": "0",
                "pressure": "1012",
                "vis": "18",
                "cloud": "30",
                "dew": "10",
            },
            "daily": _daily_entries(city_id),
            "hourly": _hourly_entries(city_id),
            "indices": _indices_entries(city_id),
            "warnings": [],
            "airQuality": _air_quality_entry(city_id),
            "minutely": None,
        },
    }


ALL_BUNDLES = {city_id: _bundle_entry(city_id) for city_id in CITY_FIXTURES}


def _build_base_state() -> dict[str, Any]:
    state = copy.deepcopy(DEFAULTS)
    state["version"] = 1
    state["selectedCityId"] = "beijing"
    state["bundlesByCityId"] = copy.deepcopy(ALL_BUNDLES)
    state["searchHistory"] = []
    return state


BASE_STATE = _build_base_state()


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
    ("DisableMorningAlert", lambda: _positive_operate_case(_tasks_module.DisableMorningAlert(), _with_settings(morningEveningAlert=False))),
    ("EnableNightDnd", lambda: _positive_operate_case(_tasks_module.EnableNightDnd(), _with_settings(nightDnd=True))),
    ("SwitchTempUnit", lambda: _positive_operate_case(_tasks_module.SwitchTempUnit(unit="fahrenheit"), _with_settings(tempUnit="fahrenheit"))),
    ("SwitchWindUnit", lambda: _positive_operate_case(_tasks_module.SwitchWindUnit(unit="ms"), _with_settings(windUnit="ms"))),
    ("AddCity", lambda: _positive_operate_case(_tasks_module.AddCity(city="南京"), _with_added_city("南京"))),
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
    ("ConfigureAllUnits", lambda: _positive_operate_case(_tasks_module.ConfigureAllUnits(), _with_settings(tempUnit="celsius", windUnit="ms", pressureUnit="hpa"))),
    ("AddCityAndFindWarmestDay", lambda: _positive_answer_case(_tasks_module.AddCityAndFindWarmestDay(city="南京"), _with_added_city("南京"))),
    ("ThreeCityRainCheck", lambda: _positive_answer_case(_tasks_module.ThreeCityRainCheck(city1="北京", city2="上海", city3="广州"), copy.deepcopy(BASE_STATE))),
    ("ConditionalAction", lambda: _positive_operate_case(_tasks_module.ConditionalAction(city="深圳", temp=30), _with_settings(warningAlert=False))),
    ("AddCityFullReport", lambda: _positive_answer_case(_tasks_module.AddCityFullReport(city="武汉"), _with_added_city("武汉"))),
    ("WeekendTempRange3City", lambda: _positive_answer_case(_tasks_module.WeekendTempRange3City(city1="北京", city2="上海", city3="杭州"), copy.deepcopy(BASE_STATE))),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("CheckCurrentTemp", lambda: _negative_answer_case(_tasks_module.CheckCurrentTemp(city="北京"), copy.deepcopy(BASE_STATE))),
    ("CheckCurrentWeather", lambda: _negative_answer_case(_tasks_module.CheckCurrentWeather(city="上海"), copy.deepcopy(BASE_STATE))),
    ("DisableMorningAlert", lambda: _negative_operate_case(_tasks_module.DisableMorningAlert())),
    ("EnableNightDnd", lambda: _negative_operate_case(_tasks_module.EnableNightDnd())),
    ("SwitchTempUnit", lambda: _negative_operate_case(_tasks_module.SwitchTempUnit(unit="fahrenheit"))),
    ("SwitchWindUnit", lambda: _negative_operate_case(_tasks_module.SwitchWindUnit(unit="ms"))),
    ("AddCity", lambda: _negative_operate_case(_tasks_module.AddCity(city="南京"))),
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
    ("ConfigureAllUnits", lambda: _negative_operate_case(_tasks_module.ConfigureAllUnits())),
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
