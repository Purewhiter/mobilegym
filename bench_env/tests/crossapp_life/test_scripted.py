"""Live scripted-plan verification for the cross-app life suite."""

from __future__ import annotations

import datetime as dt
import json
import random
import re
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.map.app import Map
from bench_env.task.railway12306.app import Railway12306, _catalog_available_trains
from bench_env.task.registry import TaskRegistry
from bench_env.task.weather.app import WEATHER_SAVED_CITIES, Weather
from bench_env.task.wechat.app import Wechat
from bench_env.tests.crossapp_life.scripted_plans import PLANS
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "crossapp_life"
ROOT = Path(__file__).resolve().parents[3]
DAY_MS = 86_400_000
ISO_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(.*)$")
DEFAULT_ALARM_TIMES = ["04:30", "05:00", "06:00", "06:10", "06:20", "07:00", "22:30"]


def _load_json(*parts: str) -> dict[str, Any]:
    return json.loads(ROOT.joinpath(*parts).read_text(encoding="utf-8"))


def _wechat() -> Wechat:
    return Wechat(_load_json("apps", "Wechat", "data", "defaults.json"))


def _wxid(contact: str) -> str:
    return _wechat().require_contact_wxid(contact)


def _contact(contact: str = "张伟") -> dict[str, str]:
    return {"contact": contact, "contact_wxid": _wxid(contact)}


def _task(name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{name}", **params)


def _sim_today() -> dt.date:
    return dt.date.today()


def _date_after(days: int) -> str:
    return (_sim_today() + dt.timedelta(days=days)).isoformat()


def _next_saturday() -> str:
    today = _sim_today()
    days = (5 - today.weekday()) % 7 or 7
    return (today + dt.timedelta(days=days)).isoformat()


def _next_weekend_saturday() -> str:
    today = _sim_today()
    days_to_next_monday = (7 - today.weekday()) % 7 or 7
    return (today + dt.timedelta(days=days_to_next_monday + 5)).isoformat()


def _train(from_station: str, to_station: str, date_value: str, pref: str = "earliest") -> dict[str, Any]:
    trains = list(
        _catalog_available_trains(
            _sim_today().isoformat(),
            from_station,
            to_station,
            date_value,
            True,
        )
    )
    if pref == "fastest":
        def duration_minutes(train: dict[str, Any]) -> int:
            value = str(train.get("lishi") or "")
            if ":" in value:
                hours, minutes = value.split(":", 1)
                return int(hours) * 60 + int(minutes)
            return Railway12306.parse_duration_minutes(value)

        picked = min(trains, key=lambda train: (duration_minutes(train), str(train.get("startTime") or "")))
    else:
        picked = Railway12306._pick_catalog_train(trains, pref)
    assert picked is not None
    return picked


def _hhmm_parts(time_text: str) -> tuple[int, int]:
    hour, minute = str(time_text).split(":", 1)
    return int(hour), int(minute)


def _alarm_time_before(time_text: str, hours: int = 1) -> str:
    hour, minute = _hhmm_parts(time_text)
    value = dt.datetime(2000, 1, 1, hour, minute) - dt.timedelta(hours=hours)
    return value.strftime("%H:%M")


def _wheel_delta(current: int, target: int, modulo: int) -> int:
    delta = (target - current) % modulo
    if delta > modulo / 2:
        delta -= modulo
    return int(delta)


def _alarm_params(target_time: str) -> dict[str, str]:
    target_hour, target_minute = _hhmm_parts(target_time)

    def cost(source: str) -> int:
        source_hour, source_minute = _hhmm_parts(source)
        return abs(_wheel_delta(source_hour, target_hour, 24)) + abs(_wheel_delta(source_minute, target_minute, 60))

    source_time = min(DEFAULT_ALARM_TIMES, key=cost)
    source_hour, source_minute = _hhmm_parts(source_time)
    wheel_minute = target_minute
    if source_minute == 30 and target_minute == 45:
        wheel_minute = 44
    return {
        "alarm_time": target_time,
        "alarm_hour": str(target_hour),
        "alarm_minute": str(target_minute),
        "alarm_wheel_minute": str(wheel_minute),
        "alarm_source_time": source_time,
        "alarm_source_hour": str(source_hour),
        "alarm_source_minute": str(source_minute),
    }


def _rail_params(
    from_station: str,
    to_station: str,
    date_value: str,
    *,
    pref: str = "earliest",
) -> dict[str, Any]:
    train = _train(from_station, to_station, date_value, pref)
    alarm_time = _alarm_time_before(str(train["startTime"]))
    return {
        "from_station": from_station,
        "to_station": to_station,
        "from_city": from_station,
        "to_city": to_station,
        "date": date_value,
        "date_day": str(int(date_value.rsplit("-", 1)[1])),
        "train_no": str(train["trainCode"]),
        "seat_type": "二等",
        "passenger_name": "赵宇轩",
        "depart_time": str(train["startTime"]),
        "arrive_time": str(train["arriveTime"]),
        **_alarm_params(alarm_time),
    }


def _shift_date_string(value: str, offset_days: int) -> str:
    match = ISO_DATE_RE.match(value)
    if not match:
        return value
    year, month, day, rest = match.groups()
    shifted = dt.date(int(year), int(month), int(day)) + dt.timedelta(days=offset_days)
    return f"{shifted.isoformat()}{rest}"


def _shift_tree_dates(value: Any, offset_days: int) -> Any:
    if isinstance(value, str):
        return _shift_date_string(value, offset_days)
    if isinstance(value, list):
        return [_shift_tree_dates(item, offset_days) for item in value]
    if isinstance(value, dict):
        return {key: _shift_tree_dates(item, offset_days) for key, item in value.items()}
    return value


def _rehydrate_weather_library(raw: dict[str, Any]) -> dict[str, Any]:
    anchor: dt.date | None = None
    for entry in raw.values():
        if not isinstance(entry, dict):
            continue
        daily = (((entry.get("bundle") or {}).get("daily")) or [])
        if not daily:
            continue
        first = str((daily[0] or {}).get("fxDate") or "")
        if ISO_DATE_RE.match(first):
            anchor = dt.date.fromisoformat(first[:10])
            break
    if anchor is None:
        return raw
    offset_days = (_sim_today() - anchor).days
    if offset_days == 0:
        return raw
    return _shift_tree_dates(raw, offset_days)


def _weather() -> Weather:
    defaults = _load_json("apps", "Weather", "data", "defaults.json")
    library = _load_json("apps", "Weather", "data", "weatherBundles.json")
    return Weather(
        {
            "version": 1,
            "selectedCityId": "located",
            "savedCities": defaults["savedCities"],
            "bundlesByCityId": {},
            "settings": defaults["settings"],
            "weatherLibrary": _rehydrate_weather_library(library),
        }
    )


def _forecast_message(city: str, date_value: str) -> str:
    day = _weather().daily_by_date(city, date_value)
    return f"{date_value} {city} {day.get('textDay')} {int(round(float(day.get('tempMax', 0))))}/{int(round(float(day.get('tempMin', 0))))}度"


def _forecast_labels_message(city: str, date_value: str) -> str:
    day = _weather().daily_by_date(city, date_value)
    labels = [str(day.get(key) or "").strip() for key in ("textDay", "textNight")]
    return f"{date_value} {' '.join(label for label in labels if label)} 一起跑步"


def _non_rainy_note(city: str, days: int = 5) -> str:
    return "\n".join(_weather().non_rainy_dates(city, 1, days))


def _map_best_message(category: str, radius: int = 3000) -> str:
    best = Map.best_rated_from_results(Map.geo_search(category, limit=0), max_distance_meters=radius)
    return f"{best['name']} 评分{best['rating']} {Map.extract_address(best)}"


def _address_message(place: str) -> str:
    return Map.extract_address(Map.resolve_places(place)[0])


def _nearest_address_message(category: str) -> str:
    return Map.extract_address(Map.nearest_from_results(Map.geo_search(category, limit=0)))


def _trip_train_message(from_station: str, to_station: str, date_value: str, pref: str = "earliest") -> str:
    train = _train(from_station, to_station, date_value, pref)
    return f"{train['trainCode']} {train['startTime']} 出发"


def _trip_train_arrival_message(from_station: str, to_station: str, date_value: str, pref: str = "earliest") -> str:
    train = _train(from_station, to_station, date_value, pref)
    return f"{train['trainCode']} {train['arriveTime']} 到达"


def _is_rainy(city: str, date_value: str) -> bool:
    day = _weather().daily_by_date(city, date_value)
    return Weather.is_raining_text(str(day.get("textDay") or "")) or Weather.is_raining_text(
        str(day.get("textNight") or "")
    )


def _realistic_trip_message() -> str:
    date_value = _date_after(2)
    if _is_rainy("上海", date_value):
        return f"{_trip_train_message('杭州', '上海', date_value)} 带伞"
    return _trip_train_arrival_message("杭州", "上海", date_value)


def _weather_metric_message(city: str, metric: str) -> str:
    weather = _weather()
    if metric == "humidity":
        return weather.current_humidity_str(city)
    if metric == "tomorrow":
        high, low = weather.tomorrow_high_low_str(city)
        return f"{high} {low}"
    return f"{weather.current_temp_str(city)} {weather.current_feels_like_str(city)}"


def _railway_dest_weather_params(city: str, *, seed: int = 0) -> dict[str, Any]:
    rng = random.Random(seed)
    rng.choice(list(WEATHER_SAVED_CITIES))
    offset = rng.choice(range(1, 11))
    ticket_date = (_sim_today() + dt.timedelta(days=offset)).isoformat()
    day = _weather().daily_by_date(city, ticket_date)
    return {
        "_seed": seed,
        "city": city,
        "answer_weather": f"{day.get('textDay')} {day.get('textNight')}",
        "answer_high": str(int(round(float(day["tempMax"])))),
        "answer_low": str(int(round(float(day["tempMin"])))),
    }


def _railway_account_username() -> str:
    return str(
        _load_json("apps", "Railway12306", "data", "defaults.json")
        .get("account", {})
        .get("personalInfo", {})
        .get("username", "")
    )


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CalendarEventToWechat", lambda: _task("CalendarEventToWechat", **_contact(), wechat_message="项目评审 09:00")),
    ("CalendarFreeWeatherInvite", lambda: _task("CalendarFreeWeatherInvite", city="北京", **_contact(), wechat_message="下周末天气不错，一起出去玩")),
    (
        "FullTripPlanWeatherDriven",
        lambda: _task(
            "FullTripPlanWeatherDriven",
            city="上海",
            target_date=_weather().first_non_rainy_date("上海", 1, 14),
            **_rail_params("北京", "上海", _weather().first_non_rainy_date("上海", 1, 14)),
        ),
    ),
    ("MapNearbyBestToWechat", lambda: _task("MapNearbyBestToWechat", radius=3000, category="咖啡馆", **_contact(), wechat_message=_map_best_message("咖啡馆", 3000))),
    ("MapPlaceToWechat", lambda: _task("MapPlaceToWechat", place="中国国家博物馆", **_contact(), wechat_message=_address_message("中国国家博物馆"))),
    (
        "MapRatingConditionBuyTicket",
        lambda: _task(
            "MapRatingConditionBuyTicket",
            place="中国国家博物馆",
            tomorrow=_date_after(1),
            **_rail_params("上海", "北京", _date_after(1)),
        ),
    ),
    ("OpenedFridgeFoodsToMom", lambda: _task("OpenedFridgeFoodsToMom", mom_wxid="wxid_mom_home", wechat_message="牛奶 豆腐 西瓜 草莓 火腿 柠檬")),
    (
        "RailwayBalanceConditionalBuyNotify",
        lambda: _task(
            "RailwayBalanceConditionalBuyNotify",
            city="上海",
            **_contact(),
            wechat_message="我要去上海",
            **_rail_params("北京", "上海", _date_after(2)),
        ),
    ),
    ("RailwayDestWeatherQuery", lambda: _task("RailwayDestWeatherQuery", **_railway_dest_weather_params("上海"))),
    (
        "RailwayEarliestGTrainToWechat",
        lambda: _task(
            "RailwayEarliestGTrainToWechat",
            **_contact(),
            **_rail_params("上海", "南京", _date_after(1)),
            wechat_message=(
                f"{_train('上海', '南京', _date_after(1))['trainCode']} "
                "110"
            ),
        ),
    ),
    ("RailwayMyAccountToWechat", lambda: _task("RailwayMyAccountToWechat", **_contact(), wechat_message=_railway_account_username())),
    (
        "RailwayPriceVsBalance",
        lambda: _task(
            "RailwayPriceVsBalance",
            **_rail_params("上海", "南京", _date_after(1)),
            answer_price="110元",
            answer_afford="够",
        ),
    ),
    (
        "RailwayTomorrowMomBookingToWechat",
        lambda: _task(
            "RailwayTomorrowMomBookingToWechat",
            mom_wxid=Wechat(_load_json("apps", "Wechat", "data", "defaults.json"))
            .prepare_state_with_contact(name="母亲")["contacts"][-1]["wxid"],
            **_rail_params("上海", "南京", _date_after(1)),
            wechat_message=str(_train("上海", "南京", _date_after(1))["trainCode"]),
        ),
    ),
    (
        "RailwayTrainInfoToWechat",
        lambda: _task(
            "RailwayTrainInfoToWechat",
            **_contact(),
            **_rail_params("上海", "南京", _date_after(1)),
            wechat_message=_trip_train_message("上海", "南京", _date_after(1)),
        ),
    ),
    (
        "RailwayWeatherToWechat",
        lambda: _task(
            "RailwayWeatherToWechat",
            city="上海",
            **_contact(),
            **_rail_params("北京", "上海", _date_after(2)),
            wechat_message=f"{_trip_train_message('北京', '上海', _date_after(2))} {_forecast_message('上海', _date_after(2))}",
        ),
    ),
    (
        "RealisticTrip001",
        lambda: _task(
            "RealisticTrip001",
            **_contact(),
            target_date=_date_after(2),
            date_day=str(int(_date_after(2).rsplit("-", 1)[1])),
            note_content=f"{_trip_train_message('杭州', '上海', _date_after(2))} {_forecast_message('上海', _date_after(2))}",
            wechat_message=_realistic_trip_message(),
        ),
    ),
    ("RecommendMenuDishesToXiaozhou", lambda: _task("RecommendMenuDishesToXiaozhou", xiaozhou_wxid="wxid_xiaozhou_menu", wechat_message="清炒时蔬 番茄鸡蛋面 白切鸡")),
    (
        "RestaurantRatingInviteCalendar",
        lambda: _task(
            "RestaurantRatingInviteCalendar",
            restaurant="湘临天下酒楼",
            rating=4.0,
            **_contact(),
            today=_sim_today().isoformat(),
            wechat_message="今晚去湘临天下酒楼吃饭？",
        ),
    ),
    (
        "TopRatedNearbyPlaceConditionalWechatOrSmsInvite",
        lambda: _task(
            "TopRatedNearbyPlaceConditionalWechatOrSmsInvite",
            radius=3000,
            category="湘临天下酒楼",
            target="张伟",
            notify_to="王芳",
            sms_contact="张三",
            target_wxid=_wxid("张伟"),
            notify_wxid=_wxid("王芳"),
            wechat_message="湘临天下酒楼 要不要一起去",
            notify_message="湘临天下酒楼 要不要一起去",
        ),
    ),
    ("TravelPlanToWechat", lambda: _task("TravelPlanToWechat", dest="中国国家博物馆", weather_city="北京", **_contact(), wechat_message=f"{_address_message('中国国家博物馆')} {_weather().current_weather_text('北京')} {_weather().current_temp('北京')}")),
    (
        "TripClosedLoopNotify",
        lambda: _task(
            "TripClosedLoopNotify",
            **_contact(),
            **_rail_params("上海", "南京", _date_after(1)),
            wechat_message=_trip_train_message("上海", "南京", _date_after(1)),
        ),
    ),
    (
        "TripMemoAndNotify",
        lambda: _task(
            "TripMemoAndNotify",
            city="上海",
            **_contact(),
            **_rail_params("北京", "上海", _date_after(2)),
            note_content=f"{_trip_train_message('北京', '上海', _date_after(2), 'fastest')} {_forecast_message('上海', _date_after(2))}",
            wechat_message=_trip_train_arrival_message("北京", "上海", _date_after(2), "fastest"),
        ),
    ),
    (
        "WeatherCalendar_CreateEventIfNotSunny",
        lambda: _task(
            "WeatherCalendar_CreateEventIfNotSunny",
            city="成都",
            event_title="带伞",
            today=_sim_today().isoformat(),
            event_notes=f"{_weather().current_weather_text('成都')} {_weather().current_temp('成都')}度",
        ),
    ),
    ("WeatherFilterNonRainyDays", lambda: _task("WeatherFilterNonRainyDays", city="北京", note_content=_non_rainy_note("北京"))),
    (
        "WeatherFirstNonRainyDayBuyTicket",
        lambda: _task(
            "WeatherFirstNonRainyDayBuyTicket",
            city="上海",
            target_date=_weather().first_non_rainy_date("上海", 1, 3),
            **_rail_params("北京", "上海", _weather().first_non_rainy_date("上海", 1, 3)),
        ),
    ),
    (
        "WeatherFirstNonRainyToCalendarAndSms",
        lambda: _task(
            "WeatherFirstNonRainyToCalendarAndSms",
            city="北京",
            contact="张三",
            sms_contact="张三",
            target_date=_weather().first_non_rainy_date("北京", 1, 7),
            sms_message=_forecast_labels_message("北京", _weather().first_non_rainy_date("北京", 1, 7)),
        ),
    ),
    (
        "WeatherFirstSunnyDayCalendarAlarm",
        lambda: _task(
            "WeatherFirstSunnyDayCalendarAlarm",
            city="北京",
            target_date=_weather().first_non_rainy_date("北京", 1, 14),
        ),
    ),
    ("WeatherRainBranchNotify", lambda: _task("WeatherRainBranchNotify", city="北京", **_contact(), wechat_message="明天天气不错")),
    ("WeatherReportToNotes", lambda: _task("WeatherReportToNotes", city="北京", note_content=f"北京 {_weather().current_weather_text('北京')} {_weather().current_temp('北京')}度")),
    ("WeatherShareMetric", lambda: _task("WeatherShareMetric", city="北京", metric="temp_feels", **_contact(), wechat_message=_weather_metric_message("北京", "temp_feels"))),
    ("WechatFoodExtractMapSms", lambda: _task("WechatFoodExtractMapSms", **_contact("李娜"), brand="麦当劳", sms_contact="张三", sms_message=_nearest_address_message("麦当劳"))),
    (
        "WeekendShanghaiTripIfClearAndFree",
        lambda: _task(
            "WeekendShanghaiTripIfClearAndFree",
            **_contact(),
            target_date=_next_saturday(),
            **_rail_params("北京", "成都", _next_saturday()),
            note_content=f"{_trip_train_message('北京', '成都', _next_saturday())} {_forecast_message('成都', _next_saturday())}",
            wechat_message="那天见面方便吗",
        ),
    ),
    (
        "WeekendTripFullPlan",
        lambda: _task(
            "WeekendTripFullPlan",
            city="北京",
            destination="颐和园",
            **_contact(),
            target_date=_next_weekend_saturday(),
            wechat_message="下周六一起去颐和园出游",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(__import__("bench_env.task.crossapp_life.tasks", fromlist=["*"]))
    missing = declared - covered
    planned = {key.split(".", 1)[1] for key in PLANS if key.startswith(f"{SUITE}.")}
    unplanned = declared - planned
    assert not missing, f"crossapp_life tasks without a scripted case: {sorted(missing)}"
    assert not unplanned, f"crossapp_life tasks without a scripted plan: {sorted(unplanned)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_crossapp_life_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
