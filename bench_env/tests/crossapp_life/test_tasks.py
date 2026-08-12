"""
crossapp_life task correctness tests.

This suite has no dedicated app accessor (`bench_env/task/crossapp_life/app.py`),
so we cover:
1. task definition validation
2. offline judge positive/negative matrix
3. extra hybrid-path negatives and representative answer edge cases
"""

from __future__ import annotations

import copy
import datetime
import inspect
import json
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.crossapp_life import tasks as _tasks_module
from bench_env.task.calendar.app import Calendar
from bench_env.task.contacts.app import Contacts
from bench_env.task.map.app import Map
from bench_env.task.notes.app import Notes
from bench_env.task.railway12306.app import Railway12306
from bench_env.task.weather.app import Weather
from bench_env.task.wechat.app import Wechat
from bench_env.tests.conftest import make_judge_input
from bench_env.tests.fixtures.alipay import BASE_STATE as ALIPAY_BASE_STATE
from bench_env.tests.fixtures.calendar import BASE_STATE as CALENDAR_BASE_STATE, _add_event
from bench_env.tests.fixtures.clock import DEFAULTS as CLOCK_BASE_STATE, _with_new_alarm
from bench_env.tests.fixtures.map import (
    BASE_STATE as MAP_BASE_STATE,
    MUSEUM_RESULTS,
    NATIONAL_MUSEUM,
    _place,
    _state as _map_state,
    _with_new_search,
)
from bench_env.tests.fixtures.notes import BASE_STATE as NOTES_BASE_STATE, _add_note
from bench_env.tests.fixtures.railway12306 import (
    DEFAULTS as RAILWAY_DEFAULTS,
    _booking_curr_state,
    _booking_order,
    _booking_query_state,
)
from bench_env.tests.fixtures.sms import (
    BASE_APP_STATE as SMS_APP_STATE,
    BASE_STATE as SMS_PROVIDER_STATE,
    _append_outgoing_message as _append_sms_outgoing,
)
from bench_env.tests.fixtures.weather import (
    BASE_DATE,
    BASE_STATE as WEATHER_BASE_STATE,
    TEST_OS_STATE,
)

ROOT = Path(__file__).resolve().parents[3]


def _load_json(*parts: str) -> dict[str, Any]:
    path = ROOT.joinpath(*parts)
    return json.loads(path.read_text(encoding="utf-8"))


WECHAT_BASE_STATE = _load_json("apps", "Wechat", "data", "defaults.json")
CONTACTS_PROVIDER_STATE = _load_json("os", "providers", "defaults", "contacts.json")
DEFAULT_ROUTE = {"app": "launcher", "path": "/"}

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]


def _base_apps() -> dict[str, Any]:
    return {
        "weather": copy.deepcopy(WEATHER_BASE_STATE),
        "map": copy.deepcopy(MAP_BASE_STATE),
        "notes": copy.deepcopy(NOTES_BASE_STATE),
        "wechat": copy.deepcopy(WECHAT_BASE_STATE),
        "railway12306": copy.deepcopy(RAILWAY_DEFAULTS),
        "calendar": copy.deepcopy(CALENDAR_BASE_STATE),
        "clock": copy.deepcopy(CLOCK_BASE_STATE),
        "alipay": copy.deepcopy(ALIPAY_BASE_STATE),
        "sms": copy.deepcopy(SMS_APP_STATE),
    }


def _apps_state(**patches: dict[str, Any]) -> dict[str, Any]:
    apps = _base_apps()
    for key, value in patches.items():
        apps[key] = copy.deepcopy(value)
    return apps


def _base_os() -> dict[str, Any]:
    return {
        "time": copy.deepcopy(TEST_OS_STATE["time"]),
        "providers": {
            "contacts": copy.deepcopy(CONTACTS_PROVIDER_STATE),
            "sms": copy.deepcopy(SMS_PROVIDER_STATE),
        },
    }


def _make_input(
    init_apps: dict[str, Any],
    curr_apps: dict[str, Any],
    *,
    init_os: dict[str, Any] | None = None,
    curr_os: dict[str, Any] | None = None,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
):
    return make_judge_input(
        {"apps": init_apps, "os": init_os or _base_os()},
        {"apps": curr_apps, "os": curr_os or _base_os()},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _contact_phone(contact_name: str) -> str:
    contact = next(
        item
        for item in CONTACTS_PROVIDER_STATE["contacts"]
        if str(item.get("displayName") or "") == str(contact_name)
    )
    return str(contact["phones"][0]["number"])


def _normalized_contact_phone(contact_name: str) -> str:
    return Contacts.normalize_phone(_contact_phone(contact_name))


def _ensure_wechat_chat(state: dict[str, Any], contact_name: str) -> dict[str, Any]:
    wechat = Wechat(state)
    wxid = wechat.require_contact_wxid(contact_name)
    chat = next((item for item in state["chats"] if str(item["id"]) == wxid), None)
    if chat is not None:
        return chat
    contact = wechat.contact_by_name(contact_name)
    chat = {
        "id": wxid,
        "user": {
            "wxid": wxid,
            "name": contact["name"],
            "avatar": contact.get("avatar", ""),
        },
        "isMuted": False,
        "isSticky": False,
        "isAlert": False,
        "messages": [],
    }
    state["chats"].insert(0, chat)
    return chat


def _append_wechat_outgoing(state: dict[str, Any], contact_name: str, content: str) -> None:
    chat = _ensure_wechat_chat(state, contact_name)
    chat["messages"].append(
        {
            "id": f"test_out_{len(chat['messages']) + 1}",
            "type": "text",
            "content": content,
            "senderId": state["user"]["wxid"],
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
        }
    )


def _append_wechat_incoming(state: dict[str, Any], contact_name: str, content: str) -> None:
    chat = _ensure_wechat_chat(state, contact_name)
    chat["messages"].append(
        {
            "id": f"test_in_{len(chat['messages']) + 1}",
            "type": "text",
            "content": content,
            "senderId": chat["user"]["wxid"],
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
        }
    )


def _rail_query_state(*, from_station: str, to_station: str, date: str) -> dict[str, Any]:
    # 构造 2 趟高铁直达车次，车站与入参对齐，避免 task
    # cheapest_high_speed_seat_price 因路线不匹配而找不到 priced seat。
    direct_trains = [
        {
            "trainNo": "G7002",
            "trainType": "G",
            "fromStation": from_station,
            "toStation": to_station,
            "departTime": "08:30",
            "arriveTime": "10:00",
            "duration": "1小时30分",
            "seats": [{"type": "二等", "price": 150, "count": 100}],
        },
        {
            "trainNo": "G7010",
            "trainType": "G",
            "fromStation": from_station,
            "toStation": to_station,
            "departTime": "12:00",
            "arriveTime": "13:30",
            "duration": "1小时30分",
            "seats": [{"type": "二等", "price": 150, "count": 80}],
        },
    ]
    return _booking_curr_state(
        copy.deepcopy(RAILWAY_DEFAULTS),
        query_state=_booking_query_state(direct_trains=direct_trains),
        last_query_summary={
            "from": from_station,
            "to": to_station,
            "date": date,
        },
    )


def _rail_new_order_state(
    *,
    from_station: str,
    to_station: str,
    date: str,
    passenger_names: list[str],
    train_no: str = "G7002",
    seat_type: str = "二等",
) -> dict[str, Any]:
    init = copy.deepcopy(RAILWAY_DEFAULTS)
    tickets = [
        {
            "passengerName": name,
            "ticketType": "成人票",
            "seatType": seat_type,
            "seatNo": f"01车 0{idx + 1}A号",
            "price": 150,
        }
        for idx, name in enumerate(passenger_names)
    ]
    route_trains = [
        {
            "trainNo": train_no,
            "trainType": train_no[0],
            "fromStation": from_station,
            "toStation": to_station,
            "departTime": "08:30",
            "arriveTime": "10:00",
            "duration": "1小时30分",
            "seats": [{"type": seat_type, "price": 150, "count": 100}],
        },
    ]
    return _booking_curr_state(
        init,
        orders=init["orders"] + [
            _booking_order(
                f"EK_{train_no}_{date}_{len(passenger_names)}",
                train_no=train_no,
                from_station=from_station,
                to_station=to_station,
                date=date,
                tickets=tickets,
            )
        ],
        last_query_summary={
            "from": from_station,
            "to": to_station,
            "date": date,
        },
        query_state=_booking_query_state(direct_trains=route_trains),
    )


def _tomorrow_date() -> str:
    return (BASE_DATE + datetime.timedelta(days=1)).isoformat()


def _weather_day_text(city: str, date_value: str) -> str:
    return Weather(copy.deepcopy(WEATHER_BASE_STATE)).day_text(
        Weather(copy.deepcopy(WEATHER_BASE_STATE)).daily_by_date(city, date_value)
    )


def _map_search_state(query: str) -> dict[str, Any]:
    results = Map.geo_search(query, limit=0)
    if not results:
        raise ValueError(f"No map search results for {query!r}")
    return _with_new_search(
        _map_state(search_results=results, active_poi=results[0]),
        query,
    )


def _rail_specific_query_state(*, from_station: str, to_station: str, date: str) -> dict[str, Any]:
    direct_trains = [
        {
            "trainNo": "G7002",
            "trainType": "G",
            "fromStation": from_station,
            "toStation": to_station,
            "departTime": "08:30",
            "arriveTime": "10:00",
            "duration": "1小时30分",
            "seats": [{"type": "二等", "price": 150, "count": 100}],
        },
        {
            "trainNo": "G7010",
            "trainType": "G",
            "fromStation": from_station,
            "toStation": to_station,
            "departTime": "12:00",
            "arriveTime": "13:10",
            "duration": "1小时10分",
            "seats": [{"type": "二等", "price": 160, "count": 80}],
        },
    ]
    return _booking_curr_state(
        copy.deepcopy(RAILWAY_DEFAULTS),
        query_state={"directTrains": direct_trains, "transferPlans": [], "loading": False},
        last_query_summary={"from": from_station, "to": to_station, "date": date},
    )


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert len(task.apps) >= 2

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
        assert isinstance(cls.capabilities, list) and cls.capabilities

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[cls.__name__ for cls in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer_or_get_answer(self, cls):
        has_answer_attr = cls.answer is not None
        has_get_answer_override = cls.get_answer is not AnswerTask.get_answer
        has_check_goals_override = cls.check_goals is not AnswerTask.check_goals
        assert has_answer_attr or has_get_answer_override or has_check_goals_override
def _map_place_to_wechat_positive():
    task = _tasks_module.MapPlaceToWechat(place="中国国家博物馆", contact="陈静")
    curr_map = _map_search_state(task.p.place)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    address = Map.extract_address(Map.resolve_places(task.p.place)[0])
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"{task.p.place}的地址是{address}")
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, wechat=curr_wechat))


def _map_place_to_wechat_negative():
    task = _tasks_module.MapPlaceToWechat(place="中国国家博物馆", contact="陈静")
    curr_map = _map_search_state(task.p.place)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"{task.p.place}在错误地址")
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, wechat=curr_wechat))
def _weather_share_metric_positive():
    task = _tasks_module.WeatherShareMetric(city="北京", metric="temp_feels", contact="陈静")
    weather = Weather(copy.deepcopy(WEATHER_BASE_STATE))
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(
        curr_wechat,
        task.p.contact,
        f"北京现在{weather.current_temp_str(task.p.city)}度，体感{weather.current_feels_like_str(task.p.city)}度",
    )
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))


def _weather_share_metric_negative():
    task = _tasks_module.WeatherShareMetric(city="北京", metric="temp_feels", contact="陈静")
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "北京今天风挺大")
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))


def _weather_report_to_notes_positive():
    task = _tasks_module.WeatherReportToNotes(city="北京")
    weather = Weather(copy.deepcopy(WEATHER_BASE_STATE))
    curr_notes = copy.deepcopy(NOTES_BASE_STATE)
    _add_note(
        curr_notes,
        "北京天气记录",
        content=f"北京现在{weather.current_weather_text(task.p.city)}，气温{weather.current_temp_str(task.p.city)}度",
    )
    return task, _make_input(_apps_state(), _apps_state(notes=curr_notes))


def _weather_report_to_notes_negative():
    task = _tasks_module.WeatherReportToNotes(city="北京")
    curr_notes = copy.deepcopy(NOTES_BASE_STATE)
    _add_note(curr_notes, "北京天气记录", content="北京今天挺舒服")
    return task, _make_input(_apps_state(), _apps_state(notes=curr_notes))


def _append_wechat_moment(state: dict[str, Any], content: str, *, images: list[str] | None = None) -> None:
    state["moments"].insert(
        0,
        {
            "id": f"mo_test_{len(state['moments']) + 1}",
            "wxid": state["user"]["wxid"],
            "userName": state["user"]["name"],
            "userAvatar": state["user"]["avatar"],
            "content": content,
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
            "images": list(images or []),
        },
    )
def _weather_filter_non_rainy_days_positive():
    task = _tasks_module.WeatherFilterNonRainyDays(city="北京")
    weather = Weather(copy.deepcopy(WEATHER_BASE_STATE))
    curr_notes = copy.deepcopy(NOTES_BASE_STATE)
    dates = weather.non_rainy_dates(task.p.city, 1, 5)
    _add_note(curr_notes, "适合出行的日子", content="\n".join(dates))
    return task, _make_input(_apps_state(), _apps_state(notes=curr_notes))


def _weather_filter_non_rainy_days_negative():
    task = _tasks_module.WeatherFilterNonRainyDays(city="北京")
    weather = Weather(copy.deepcopy(WEATHER_BASE_STATE))
    curr_notes = copy.deepcopy(NOTES_BASE_STATE)
    dates = weather.non_rainy_dates(task.p.city, 1, 5)
    _add_note(curr_notes, "适合出行的日子", content="\n".join(dates[:-1]))
    return task, _make_input(_apps_state(), _apps_state(notes=curr_notes))
def _weather_rain_branch_notify_positive():
    task = _tasks_module.WeatherRainBranchNotify(city="广州", contact="陈静")
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "明天广州下雨，记得带伞")
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))


def _weather_rain_branch_notify_negative():
    task = _tasks_module.WeatherRainBranchNotify(city="广州", contact="陈静")
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "明天天气不错")
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))


def _railway_train_info_to_wechat_positive():
    date_value = "2025-03-16"
    task = _tasks_module.RailwayTrainInfoToWechat(
        from_station="上海",
        to_station="南京",
        date=date_value,
        contact="陈静",
    )
    curr_rail = _rail_query_state(from_station=task.p.from_station, to_station=task.p.to_station, date=task.p.date)
    earliest = Railway12306(curr_rail, init=copy.deepcopy(RAILWAY_DEFAULTS)).pick_train_for_route_strict(
        "earliest",
        from_station=task.p.from_station,
        to_station=task.p.to_station,
        only_high_speed=True,
    )
    assert earliest is not None
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(
        curr_wechat,
        task.p.contact,
        f"最早的高铁是{earliest['trainNo']}，{earliest['departTime']}发车",
    )
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail, wechat=curr_wechat))


def _railway_train_info_to_wechat_negative():
    date_value = "2025-03-16"
    task = _tasks_module.RailwayTrainInfoToWechat(
        from_station="上海",
        to_station="南京",
        date=date_value,
        contact="陈静",
    )
    curr_rail = _rail_query_state(from_station=task.p.from_station, to_station=task.p.to_station, date=task.p.date)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "最早的是G7010，12:00发车")
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail, wechat=curr_wechat))


def _railway_price_vs_balance_positive():
    date_value = "2025-03-16"
    task = _tasks_module.RailwayPriceVsBalance(from_station="上海", to_station="南京", date=date_value)
    curr_rail = _rail_query_state(from_station=task.p.from_station, to_station=task.p.to_station, date=task.p.date)
    cheapest = Railway12306(curr_rail).cheapest_high_speed_seat_price(
        task.p.from_station, task.p.to_station, date=task.p.date,
    )
    return task, _make_input(
        _apps_state(),
        _apps_state(railway12306=curr_rail),
        answer=f"最便宜的票价是 {cheapest} 元，支付宝余额够买",
    )


def _railway_price_vs_balance_negative():
    date_value = "2025-03-16"
    task = _tasks_module.RailwayPriceVsBalance(from_station="上海", to_station="南京", date=date_value)
    curr_rail = _rail_query_state(from_station=task.p.from_station, to_station=task.p.to_station, date=task.p.date)
    return task, _make_input(
        _apps_state(),
        _apps_state(railway12306=curr_rail),
        answer="余额不够买",
    )


def _railway_dest_weather_query_positive():
    ticket_date = _tomorrow_date()
    task = _tasks_module.RailwayDestWeatherQuery(city="上海")
    rail_init = copy.deepcopy(RAILWAY_DEFAULTS)
    rail_curr = copy.deepcopy(rail_init)
    user_name = Railway12306(rail_init).user_name
    rail_curr["orders"] = rail_init["orders"] + [
        _booking_order(
            "EK_DEST_SHANGHAI",
            train_no="G7002",
            from_station="北京",
            to_station="上海",
            date=ticket_date,
            tickets=[
                {
                    "passengerName": user_name,
                    "ticketType": "成人票",
                    "seatType": "二等",
                    "seatNo": "01车 01A号",
                    "price": 150,
                }
            ],
        )
    ]
    weather = Weather(copy.deepcopy(WEATHER_BASE_STATE))
    day = weather.daily_by_date(task.p.city, ticket_date)
    answer = f"{task.p.city}{Weather.day_text(day)}，最高温{int(round(float(day['tempMax'])))}度，最低温{int(round(float(day['tempMin'])))}度"
    return task, _make_input(_apps_state(), _apps_state(railway12306=rail_curr), answer=answer)


def _railway_dest_weather_query_negative():
    ticket_date = _tomorrow_date()
    task = _tasks_module.RailwayDestWeatherQuery(city="上海")
    rail_init = copy.deepcopy(RAILWAY_DEFAULTS)
    rail_curr = copy.deepcopy(rail_init)
    user_name = Railway12306(rail_init).user_name
    rail_curr["orders"] = rail_init["orders"] + [
        _booking_order(
            "EK_DEST_SHANGHAI",
            train_no="G7002",
            from_station="北京",
            to_station="上海",
            date=ticket_date,
            tickets=[
                {
                    "passengerName": user_name,
                    "ticketType": "成人票",
                    "seatType": "二等",
                    "seatNo": "01车 01A号",
                    "price": 150,
                }
            ],
        )
    ]
    return task, _make_input(_apps_state(), _apps_state(railway12306=rail_curr), answer="上海晴，10度")
def _map_nearby_best_to_wechat_positive():
    task = _tasks_module.MapNearbyBestToWechat(radius=2000, category="咖啡馆", contact="陈静")
    best = Map.best_rated_from_results(Map.geo_search(task.p.category, limit=0), max_distance_meters=float(task.p.radius))
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(
        curr_wechat,
        task.p.contact,
        f"{best['name']}评分{best['rating']}，地址{best['formatted_address']}",
    )
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))


def _map_nearby_best_to_wechat_negative():
    task = _tasks_module.MapNearbyBestToWechat(radius=2000, category="咖啡馆", contact="陈静")
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "我推荐另一家，评分4.0，地址错误")
    return task, _make_input(_apps_state(), _apps_state(wechat=curr_wechat))
def _calendar_event_to_wechat_positive():
    task = _tasks_module.CalendarEventToWechat(contact="陈静")
    tomorrow = BASE_DATE + datetime.timedelta(days=1)
    curr_calendar = _add_event(
        copy.deepcopy(CALENDAR_BASE_STATE),
        title="项目评审",
        date_value=tomorrow.isoformat(),
        start="09:00",
        end="10:00",
    )
    event = Calendar(curr_calendar).first_event_on_date(tomorrow)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(
        curr_wechat,
        task.p.contact,
        f"{event['title']}，开始时间{Calendar.hhmm(event['startTs'])}",
    )
    return task, _make_input(_apps_state(), _apps_state(calendar=curr_calendar, wechat=curr_wechat))


def _calendar_event_to_wechat_negative():
    task = _tasks_module.CalendarEventToWechat(contact="陈静")
    tomorrow = BASE_DATE + datetime.timedelta(days=1)
    curr_calendar = _add_event(
        copy.deepcopy(CALENDAR_BASE_STATE),
        title="项目评审",
        date_value=tomorrow.isoformat(),
        start="09:00",
        end="10:00",
    )
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "项目评审，开始时间10:30")
    return task, _make_input(_apps_state(), _apps_state(calendar=curr_calendar, wechat=curr_wechat))
def test_calendar_free_weather_invite_accepts_specific_valid_day():
    task = _tasks_module.CalendarFreeWeatherInvite(city="北京", contact="陈静")
    today = BASE_DATE
    saturday = today + datetime.timedelta(days=(5 - today.weekday()) % 7 or 7)
    sunday = saturday + datetime.timedelta(days=1)
    init_calendar = _add_event(
        copy.deepcopy(CALENDAR_BASE_STATE),
        title="周六已有安排",
        date_value=saturday.isoformat(),
    )
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(
        curr_wechat,
        task.p.contact,
        f"{sunday.month}月{sunday.day}日一起出去玩吧",
    )
    checks = task.check_goals(
        _make_input(
            _apps_state(calendar=init_calendar),
            _apps_state(calendar=init_calendar, wechat=curr_wechat),
        )
    )
    assert all(item["passed"] for item in checks)


def test_weekend_trip_full_plan_positive_with_map_search_state():
    task = _tasks_module.WeekendTripFullPlan(city="北京", contact="陈静")
    today = BASE_DATE
    saturday = today + datetime.timedelta(days=(5 - today.weekday()) % 7 or 7)
    curr_calendar = _add_event(
        copy.deepcopy(CALENDAR_BASE_STATE),
        title="周末出游",
        date_value=saturday.isoformat(),
    )
    curr_map = _map_search_state(task.p.destination)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "周六天气不错，一起去出游吧")
    checks = task.check_goals(
        _make_input(
            _apps_state(),
            _apps_state(map=curr_map, calendar=curr_calendar, wechat=curr_wechat),
        )
    )
    assert all(item["passed"] for item in checks)


def _weather_first_non_rainy_day_buy_ticket_positive():
    task = _tasks_module.WeatherFirstNonRainyDayBuyTicket(city="上海", from_station="北京")
    target_date = Weather(copy.deepcopy(WEATHER_BASE_STATE)).first_non_rainy_date(task.p.city, 1, 3)
    curr_rail = _rail_new_order_state(
        from_station=task.p.from_station,
        to_station=task.p.city,
        date=target_date,
        passenger_names=[Railway12306(copy.deepcopy(RAILWAY_DEFAULTS)).user_name],
    )
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail))


def _weather_first_non_rainy_day_buy_ticket_negative():
    task = _tasks_module.WeatherFirstNonRainyDayBuyTicket(city="上海", from_station="北京")
    target_date = Weather(copy.deepcopy(WEATHER_BASE_STATE)).first_non_rainy_date(task.p.city, 1, 3)
    wrong_date = (datetime.date.fromisoformat(target_date) + datetime.timedelta(days=1)).isoformat()
    curr_rail = _rail_new_order_state(
        from_station=task.p.from_station,
        to_station=task.p.city,
        date=wrong_date,
        passenger_names=[Railway12306(copy.deepcopy(RAILWAY_DEFAULTS)).user_name],
    )
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail))


def _map_rating_condition_buy_ticket_positive():
    task = _tasks_module.MapRatingConditionBuyTicket(place="中国国家博物馆", from_station="上海")
    curr_map = _map_search_state(task.p.place)
    rating = float(Map.resolve_places(task.p.place)[0]["rating"])
    if rating > 4.0:
        curr_rail = _rail_new_order_state(
            from_station=task.p.from_station,
            to_station="北京",
            date=_tomorrow_date(),
            passenger_names=[Railway12306(copy.deepcopy(RAILWAY_DEFAULTS)).user_name],
        )
    else:
        curr_rail = copy.deepcopy(RAILWAY_DEFAULTS)
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, railway12306=curr_rail))


def _map_rating_condition_buy_ticket_negative():
    task = _tasks_module.MapRatingConditionBuyTicket(place="中国国家博物馆", from_station="上海")
    curr_map = _map_search_state(task.p.place)
    rating = float(Map.resolve_places(task.p.place)[0]["rating"])
    if rating > 4.0:
        curr_rail = copy.deepcopy(RAILWAY_DEFAULTS)
    else:
        curr_rail = _rail_new_order_state(
            from_station=task.p.from_station,
            to_station="北京",
            date=_tomorrow_date(),
            passenger_names=[Railway12306(copy.deepcopy(RAILWAY_DEFAULTS)).user_name],
        )
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, railway12306=curr_rail))
def _railway_weather_to_wechat_positive():
    date_value = _tomorrow_date()
    task = _tasks_module.RailwayWeatherToWechat(city="上海", from_station="北京", date=date_value, contact="陈静")
    curr_rail = _rail_specific_query_state(
        from_station=task.p.from_station,
        to_station=task.p.city,
        date=task.p.date,
    )
    train = Railway12306(curr_rail, init=copy.deepcopy(RAILWAY_DEFAULTS)).pick_train_for_route_strict(
        "earliest",
        from_station=task.p.from_station,
        to_station=task.p.city,
        only_high_speed=True,
    )
    assert train is not None
    weather_text = _weather_day_text(task.p.city, task.p.date)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(
        curr_wechat,
        task.p.contact,
        f"{train['trainNo']} {train['departTime']}发车，{task.p.city}{weather_text}",
    )
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail, wechat=curr_wechat))


def _railway_weather_to_wechat_negative():
    date_value = _tomorrow_date()
    task = _tasks_module.RailwayWeatherToWechat(city="上海", from_station="北京", date=date_value, contact="陈静")
    curr_rail = _rail_specific_query_state(
        from_station=task.p.from_station,
        to_station=task.p.city,
        date=task.p.date,
    )
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "G7002 08:30发车，但天气说错了")
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail, wechat=curr_wechat))
def _weather_first_sunny_day_calendar_alarm_positive():
    task = _tasks_module.WeatherFirstSunnyDayCalendarAlarm(city="上海")
    target_date = Weather(copy.deepcopy(WEATHER_BASE_STATE)).first_non_rainy_date(task.p.city, 1, 5)
    curr_calendar = _add_event(copy.deepcopy(CALENDAR_BASE_STATE), title="户外运动", date_value=target_date)
    curr_clock = _with_new_alarm(
        copy.deepcopy(CLOCK_BASE_STATE),
        alarm_id="cross_alarm",
        hour=8,
        minute=0,
        enabled=True,
    )
    return task, _make_input(_apps_state(), _apps_state(calendar=curr_calendar, clock=curr_clock))


def _weather_first_sunny_day_calendar_alarm_negative():
    task = _tasks_module.WeatherFirstSunnyDayCalendarAlarm(city="上海")
    target_date = Weather(copy.deepcopy(WEATHER_BASE_STATE)).first_non_rainy_date(task.p.city, 1, 5)
    wrong_date = (datetime.date.fromisoformat(target_date) + datetime.timedelta(days=1)).isoformat()
    curr_calendar = _add_event(copy.deepcopy(CALENDAR_BASE_STATE), title="户外运动", date_value=wrong_date)
    curr_clock = _with_new_alarm(
        copy.deepcopy(CLOCK_BASE_STATE),
        alarm_id="cross_alarm",
        hour=8,
        minute=30,
        enabled=True,
    )
    return task, _make_input(_apps_state(), _apps_state(calendar=curr_calendar, clock=curr_clock))
def _railway_balance_conditional_buy_notify_positive():
    date_value = _tomorrow_date()
    task = _tasks_module.RailwayBalanceConditionalBuyNotify(
        city="上海",
        from_station="北京",
        date=date_value,
        contact="陈静",
    )
    curr_rail = _rail_query_state(from_station=task.p.from_station, to_station=task.p.city, date=task.p.date)
    rail = Railway12306(curr_rail, init=copy.deepcopy(RAILWAY_DEFAULTS))
    prices = [
        float(seat["price"])
        for train in rail.direct_trains
        if rail.is_high_speed_train(train)
        for seat in train.get("seats") or []
        if float(seat.get("price") or 0) > 0
    ]
    cheapest = min(prices)
    balance = float(ALIPAY_BASE_STATE["balance"]["total"])
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    if balance >= cheapest:
        queried_route_state = copy.deepcopy(curr_rail["queryState"])
        curr_rail = _rail_new_order_state(
            from_station=task.p.from_station,
            to_station=task.p.city,
            date=task.p.date,
            passenger_names=[Railway12306(copy.deepcopy(RAILWAY_DEFAULTS)).user_name],
        )
        curr_rail["queryState"] = queried_route_state
        _append_wechat_outgoing(curr_wechat, task.p.contact, f"我已经买好票了，要去{task.p.city}")
    else:
        diff = round(cheapest - balance, 2)
        _append_wechat_outgoing(curr_wechat, task.p.contact, f"没钱了，还差{diff:.2f}元")
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail, wechat=curr_wechat))


def _railway_balance_conditional_buy_notify_negative():
    date_value = _tomorrow_date()
    task = _tasks_module.RailwayBalanceConditionalBuyNotify(
        city="上海",
        from_station="北京",
        date=date_value,
        contact="陈静",
    )
    curr_rail = _rail_query_state(from_station=task.p.from_station, to_station=task.p.city, date=task.p.date)
    rail = Railway12306(curr_rail, init=copy.deepcopy(RAILWAY_DEFAULTS))
    prices = [
        float(seat["price"])
        for train in rail.direct_trains
        if rail.is_high_speed_train(train)
        for seat in train.get("seats") or []
        if float(seat.get("price") or 0) > 0
    ]
    cheapest = min(prices)
    balance = float(ALIPAY_BASE_STATE["balance"]["total"])
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    if balance >= cheapest:
        _append_wechat_outgoing(curr_wechat, task.p.contact, f"我要去{task.p.city}")
    else:
        curr_rail = _rail_new_order_state(
            from_station=task.p.from_station,
            to_station=task.p.city,
            date=task.p.date,
            passenger_names=[Railway12306(copy.deepcopy(RAILWAY_DEFAULTS)).user_name],
        )
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail, wechat=curr_wechat))


def test_railway_balance_conditional_buy_notify_uses_current_alipay_balance_for_branch():
    date_value = _tomorrow_date()
    task = _tasks_module.RailwayBalanceConditionalBuyNotify(
        city="上海",
        from_station="北京",
        date=date_value,
        contact="陈静",
    )
    init_apps = _apps_state()
    curr_apps = _apps_state()
    curr_apps["railway12306"] = _rail_query_state(
        from_station=task.p.from_station,
        to_station=task.p.city,
        date=task.p.date,
    )
    rail = Railway12306(curr_apps["railway12306"], init=copy.deepcopy(RAILWAY_DEFAULTS))
    cheapest = min(
        float(seat["price"])
        for train in rail.direct_trains
        if rail.is_high_speed_train(train)
        for seat in train.get("seats") or []
        if float(seat.get("price") or 0) > 0
    )
    curr_apps["alipay"]["balance"]["total"] = round(cheapest - 10.0, 2)
    _append_wechat_outgoing(
        curr_apps["wechat"],
        task.p.contact,
        f"没钱了，还差{(cheapest - curr_apps['alipay']['balance']['total']):.2f}元",
    )
    checks = task.check_goals(_make_input(init_apps, curr_apps))
    assert all(item["passed"] for item in checks), checks


def _calendar_free_weather_invite_positive():
    task = _tasks_module.CalendarFreeWeatherInvite(city="北京", contact="陈静")
    today = BASE_DATE
    saturday = today + datetime.timedelta(days=(5 - today.weekday()) % 7)
    init_calendar = _add_event(copy.deepcopy(CALENDAR_BASE_STATE), title="周六已有安排", date_value=saturday.isoformat())
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "周日有空，一起出去玩吧")
    return task, _make_input(
        _apps_state(calendar=init_calendar),
        _apps_state(calendar=init_calendar, wechat=curr_wechat),
    )


def _calendar_free_weather_invite_negative():
    task = _tasks_module.CalendarFreeWeatherInvite(city="北京", contact="陈静")
    today = BASE_DATE
    saturday = today + datetime.timedelta(days=(5 - today.weekday()) % 7)
    init_calendar = _add_event(copy.deepcopy(CALENDAR_BASE_STATE), title="周六已有安排", date_value=saturday.isoformat())
    return task, _make_input(
        _apps_state(calendar=init_calendar),
        _apps_state(calendar=init_calendar),
    )


def _wechat_food_extract_map_sms_positive():
    task = _tasks_module.WechatFoodExtractMapSms(contact="陈静", brand="麦当劳", sms_contact="张三")
    base_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_incoming(base_wechat, task.p.contact, f"好想吃{task.p.brand}")
    best = Map.nearest_from_results(Map.geo_search(task.p.brand, limit=0))
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.sms_contact, Map.extract_address(best))
    return task, _make_input(
        _apps_state(wechat=base_wechat),
        _apps_state(wechat=base_wechat),
        curr_os=curr_os,
    )


def _wechat_food_extract_map_sms_negative():
    task = _tasks_module.WechatFoodExtractMapSms(contact="陈静", brand="麦当劳", sms_contact="张三")
    base_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_incoming(base_wechat, task.p.contact, f"好想吃{task.p.brand}")
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.sms_contact, "错误地址")
    return task, _make_input(
        _apps_state(wechat=base_wechat),
        _apps_state(wechat=base_wechat),
        curr_os=curr_os,
    )


def _wechat_food_extract_map_sms_kfc_positive():
    task = _tasks_module.WechatFoodExtractMapSms(contact="陈静", brand="肯德基", sms_contact="张三")
    base_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_incoming(base_wechat, task.p.contact, f"好想吃{task.p.brand}")
    best = Map.nearest_from_results(Map.geo_search(task.p.brand, limit=0))
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], task.p.sms_contact, Map.extract_address(best))
    return task, _make_input(
        _apps_state(wechat=base_wechat),
        _apps_state(wechat=base_wechat),
        curr_os=curr_os,
    )


def _restaurant_rating_invite_calendar_positive():
    task = _tasks_module.RestaurantRatingInviteCalendar(restaurant="眉州东坡酒楼", rating=4.0, contact="陈静")
    places = Map.resolve_places(task.p.restaurant)
    poi = places[0]
    curr_map = _with_new_search(_map_state(search_results=places, active_poi=poi), task.p.restaurant)
    rating = float(poi["rating"])
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    curr_calendar = copy.deepcopy(CALENDAR_BASE_STATE)
    if rating > float(task.p.rating):
        _append_wechat_outgoing(curr_wechat, task.p.contact, f"今晚一起去吃{task.p.restaurant}")
        curr_calendar = _add_event(curr_calendar, title=f"{task.p.restaurant}聚餐", date_value=BASE_DATE.isoformat())
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, wechat=curr_wechat, calendar=curr_calendar))


def _restaurant_rating_invite_calendar_negative():
    task = _tasks_module.RestaurantRatingInviteCalendar(restaurant="眉州东坡酒楼", rating=4.0, contact="陈静")
    places = Map.resolve_places(task.p.restaurant)
    poi = places[0]
    curr_map = _with_new_search(_map_state(search_results=places, active_poi=poi), task.p.restaurant)
    rating = float(poi["rating"])
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    curr_calendar = copy.deepcopy(CALENDAR_BASE_STATE)
    if rating > float(task.p.rating):
        _append_wechat_outgoing(curr_wechat, task.p.contact, f"今晚一起去吃{task.p.restaurant}")
    else:
        curr_calendar = _add_event(curr_calendar, title=f"{task.p.restaurant}聚餐", date_value=BASE_DATE.isoformat())
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, wechat=curr_wechat, calendar=curr_calendar))


def _trip_closed_loop_notify_positive():
    date_value = _tomorrow_date()
    task = _tasks_module.TripClosedLoopNotify(
        from_station="上海",
        to_station="南京",
        date=date_value,
        contact="陈静",
    )
    curr_rail = _rail_query_state(from_station=task.p.from_station, to_station=task.p.to_station, date=task.p.date)
    train = Railway12306(curr_rail, init=copy.deepcopy(RAILWAY_DEFAULTS)).pick_train_for_route_strict(
        "earliest",
        from_station=task.p.from_station,
        to_station=task.p.to_station,
        only_high_speed=True,
    )
    assert train is not None
    depart_hour, depart_minute = map(int, str(train["departTime"]).split(":"))
    alarm_dt = datetime.datetime(2000, 1, 1, depart_hour, depart_minute) - datetime.timedelta(hours=1)
    curr_calendar = _add_event(copy.deepcopy(CALENDAR_BASE_STATE), title="出行", date_value=task.p.date)
    curr_clock = _with_new_alarm(
        copy.deepcopy(CLOCK_BASE_STATE),
        alarm_id="trip_alarm",
        hour=alarm_dt.hour,
        minute=alarm_dt.minute,
    )
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"{train['trainNo']}，{train['departTime']}发车")
    return task, _make_input(
        _apps_state(),
        _apps_state(railway12306=curr_rail, calendar=curr_calendar, clock=curr_clock, wechat=curr_wechat),
    )


def _trip_closed_loop_notify_negative():
    date_value = _tomorrow_date()
    task = _tasks_module.TripClosedLoopNotify(
        from_station="上海",
        to_station="南京",
        date=date_value,
        contact="陈静",
    )
    return task, _make_input(_apps_state(), _apps_state())


def _full_trip_plan_weather_driven_positive():
    task = _tasks_module.FullTripPlanWeatherDriven(city="上海", from_station="北京")
    weather = Weather(copy.deepcopy(WEATHER_BASE_STATE))
    target_date = next(
        fx_date
        for fx_date in weather.non_rainy_dates(task.p.city, 1, 5)
        if Calendar(copy.deepcopy(CALENDAR_BASE_STATE)).count_events_on_date(datetime.date.fromisoformat(fx_date)) == 0
    )
    curr_rail = _rail_new_order_state(
        from_station=task.p.from_station,
        to_station=task.p.city,
        date=target_date,
        passenger_names=[Railway12306(copy.deepcopy(RAILWAY_DEFAULTS)).user_name],
    )
    order = Railway12306(curr_rail, init=copy.deepcopy(RAILWAY_DEFAULTS)).new_pending_orders()[0]
    depart_hour, depart_minute = map(int, str(order["departTime"]).split(":"))
    alarm_dt = datetime.datetime(2000, 1, 1, depart_hour, depart_minute) - datetime.timedelta(hours=1)
    curr_clock = _with_new_alarm(
        copy.deepcopy(CLOCK_BASE_STATE),
        alarm_id="full_trip_alarm",
        hour=alarm_dt.hour,
        minute=alarm_dt.minute,
    )
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail, clock=curr_clock))


def _full_trip_plan_weather_driven_negative():
    task = _tasks_module.FullTripPlanWeatherDriven(city="上海", from_station="北京")
    return task, _make_input(_apps_state(), _apps_state())


def _weekend_trip_full_plan_positive():
    task = _tasks_module.WeekendTripFullPlan(city="北京", contact="陈静")
    today = BASE_DATE
    saturday = today + datetime.timedelta(days=(5 - today.weekday()) % 7 or 7)
    curr_calendar = _add_event(copy.deepcopy(CALENDAR_BASE_STATE), title="周末出游", date_value=saturday.isoformat())
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, "周六天气不错，一起去出游吧")
    curr_map = _map_search_state(task.p.destination)
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, calendar=curr_calendar, wechat=curr_wechat))


def _weekend_trip_full_plan_negative():
    task = _tasks_module.WeekendTripFullPlan(city="北京", contact="陈静")
    return task, _make_input(_apps_state(), _apps_state())


def _trip_memo_and_notify_positive():
    date_value = _tomorrow_date()
    task = _tasks_module.TripMemoAndNotify(city="上海", from_station="北京", date=date_value, contact="陈静")
    curr_rail = _rail_specific_query_state(
        from_station=task.p.from_station,
        to_station=task.p.city,
        date=task.p.date,
    )
    train = Railway12306(curr_rail, init=copy.deepcopy(RAILWAY_DEFAULTS)).pick_train_for_route_strict(
        "fastest",
        from_station=task.p.from_station,
        to_station=task.p.city,
        only_high_speed=True,
    )
    assert train is not None
    weather_text = _weather_day_text(task.p.city, task.p.date)
    curr_notes = copy.deepcopy(NOTES_BASE_STATE)
    _add_note(curr_notes, "出行备忘", content=f"{train['trainNo']}\n{weather_text}")
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"{train['trainNo']}，{train['arriveTime']}到达")
    return task, _make_input(
        _apps_state(),
        _apps_state(railway12306=curr_rail, notes=curr_notes, wechat=curr_wechat),
    )


def _trip_memo_and_notify_negative():
    date_value = _tomorrow_date()
    task = _tasks_module.TripMemoAndNotify(city="上海", from_station="北京", date=date_value, contact="陈静")
    curr_rail = _rail_query_state(from_station=task.p.from_station, to_station=task.p.city, date=task.p.date)
    curr_notes = copy.deepcopy(NOTES_BASE_STATE)
    _add_note(curr_notes, "出行备忘", content="只有天气，没有车次")
    return task, _make_input(_apps_state(), _apps_state(railway12306=curr_rail, notes=curr_notes))


def _travel_plan_to_wechat_positive():
    task = _tasks_module.TravelPlanToWechat(dest="中国国家博物馆", contact="陈静")
    places = Map.resolve_places(task.p.dest)
    poi = places[0]
    address = Map.extract_address(poi)
    city = Map.city_from_address(address)
    curr_map = _with_new_search(
        _map_state(search_results=places, active_poi=poi),
        task.p.dest,
    )
    weather = Weather(copy.deepcopy(WEATHER_BASE_STATE))
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"{task.p.dest}的详细地址是{address}")
    _append_wechat_outgoing(
        curr_wechat,
        task.p.contact,
        f"那边现在{weather.current_weather_text(city)}，{weather.current_temp_str(city)}度",
    )
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, wechat=curr_wechat))


def _travel_plan_to_wechat_negative():
    task = _tasks_module.TravelPlanToWechat(dest="中国国家博物馆", contact="陈静")
    places = Map.resolve_places(task.p.dest)
    poi = places[0]
    curr_map = _with_new_search(
        _map_state(search_results=places, active_poi=poi),
        task.p.dest,
    )
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_outgoing(curr_wechat, task.p.contact, f"{task.p.dest}的详细地址是{Map.extract_address(poi)}")
    return task, _make_input(_apps_state(), _apps_state(map=curr_map, wechat=curr_wechat))


def _weather_calendar_create_event_if_not_sunny_positive():
    task = _tasks_module.WeatherCalendar_CreateEventIfNotSunny(city="广州")
    curr_calendar = _add_event(
        copy.deepcopy(CALENDAR_BASE_STATE),
        title=task.p.event_title,
        date_value=BASE_DATE.isoformat(),
        all_day=True,
        description="广州 32 雨",
    )
    return task, _make_input(_apps_state(), _apps_state(calendar=curr_calendar))


def _weather_calendar_create_event_if_not_sunny_negative():
    task = _tasks_module.WeatherCalendar_CreateEventIfNotSunny(city="广州")
    return task, _make_input(_apps_state(), _apps_state())


PRIMARY_POSITIVE_CASES = [
    ("MapPlaceToWechat", _map_place_to_wechat_positive),
    ("WeatherShareMetric", _weather_share_metric_positive),
    ("WeatherReportToNotes", _weather_report_to_notes_positive),
    ("WeatherFilterNonRainyDays", _weather_filter_non_rainy_days_positive),
    ("WeatherRainBranchNotify", _weather_rain_branch_notify_positive),
    ("RailwayTrainInfoToWechat", _railway_train_info_to_wechat_positive),
    ("RailwayPriceVsBalance", _railway_price_vs_balance_positive),
    ("RailwayDestWeatherQuery", _railway_dest_weather_query_positive),
    ("MapNearbyBestToWechat", _map_nearby_best_to_wechat_positive),
    ("CalendarEventToWechat", _calendar_event_to_wechat_positive),
    ("WeatherFirstNonRainyDayBuyTicket", _weather_first_non_rainy_day_buy_ticket_positive),
    ("MapRatingConditionBuyTicket", _map_rating_condition_buy_ticket_positive),
    ("RailwayWeatherToWechat", _railway_weather_to_wechat_positive),
    ("WeatherFirstSunnyDayCalendarAlarm", _weather_first_sunny_day_calendar_alarm_positive),
    ("RailwayBalanceConditionalBuyNotify", _railway_balance_conditional_buy_notify_positive),
    ("CalendarFreeWeatherInvite", _calendar_free_weather_invite_positive),
    ("WechatFoodExtractMapSms", _wechat_food_extract_map_sms_positive),
    ("RestaurantRatingInviteCalendar", _restaurant_rating_invite_calendar_positive),
    ("TripClosedLoopNotify", _trip_closed_loop_notify_positive),
    ("FullTripPlanWeatherDriven", _full_trip_plan_weather_driven_positive),
    ("WeekendTripFullPlan", _weekend_trip_full_plan_positive),
    ("TripMemoAndNotify", _trip_memo_and_notify_positive),
    ("TravelPlanToWechat", _travel_plan_to_wechat_positive),
    ("WeatherCalendar_CreateEventIfNotSunny", _weather_calendar_create_event_if_not_sunny_positive),
]

PRIMARY_NEGATIVE_CASES = [
    ("MapPlaceToWechat", _map_place_to_wechat_negative),
    ("WeatherShareMetric", _weather_share_metric_negative),
    ("WeatherReportToNotes", _weather_report_to_notes_negative),
    ("WeatherFilterNonRainyDays", _weather_filter_non_rainy_days_negative),
    ("WeatherRainBranchNotify", _weather_rain_branch_notify_negative),
    ("RailwayTrainInfoToWechat", _railway_train_info_to_wechat_negative),
    ("RailwayPriceVsBalance", _railway_price_vs_balance_negative),
    ("RailwayDestWeatherQuery", _railway_dest_weather_query_negative),
    ("MapNearbyBestToWechat", _map_nearby_best_to_wechat_negative),
    ("CalendarEventToWechat", _calendar_event_to_wechat_negative),
    ("WeatherFirstNonRainyDayBuyTicket", _weather_first_non_rainy_day_buy_ticket_negative),
    ("MapRatingConditionBuyTicket", _map_rating_condition_buy_ticket_negative),
    ("RailwayWeatherToWechat", _railway_weather_to_wechat_negative),
    ("WeatherFirstSunnyDayCalendarAlarm", _weather_first_sunny_day_calendar_alarm_negative),
    ("RailwayBalanceConditionalBuyNotify", _railway_balance_conditional_buy_notify_negative),
    ("CalendarFreeWeatherInvite", _calendar_free_weather_invite_negative),
    ("WechatFoodExtractMapSms", _wechat_food_extract_map_sms_negative),
    ("RestaurantRatingInviteCalendar", _restaurant_rating_invite_calendar_negative),
    ("TripClosedLoopNotify", _trip_closed_loop_notify_negative),
    ("FullTripPlanWeatherDriven", _full_trip_plan_weather_driven_negative),
    ("WeekendTripFullPlan", _weekend_trip_full_plan_negative),
    ("TripMemoAndNotify", _trip_memo_and_notify_negative),
    ("TravelPlanToWechat", _travel_plan_to_wechat_negative),
    ("WeatherCalendar_CreateEventIfNotSunny", _weather_calendar_create_event_if_not_sunny_negative),
]

EXTRA_NEGATIVE_CASES = [
    (
        "RailwayPriceVsBalance__empty_answer",
        lambda: (
            task := _tasks_module.RailwayPriceVsBalance(from_station="上海", to_station="南京", date="2025-03-16"),
            _make_input(
                _apps_state(),
                _apps_state(
                    railway12306=_rail_query_state(
                        from_station=task.p.from_station,
                        to_station=task.p.to_station,
                        date=task.p.date,
                    )
                ),
                answer=None,
            ),
        ),
    ),
]

EXTRA_POSITIVE_CASES = [
    ("WechatFoodExtractMapSms__kfc_filtered_brand", _wechat_food_extract_map_sms_kfc_positive),
]


class TestTaskJudgeMatrixOffline:
    @pytest.mark.parametrize(
        "task_name,builder",
        PRIMARY_POSITIVE_CASES + EXTRA_POSITIVE_CASES,
        ids=[name for name, _ in PRIMARY_POSITIVE_CASES + EXTRA_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        PRIMARY_NEGATIVE_CASES + EXTRA_NEGATIVE_CASES,
        ids=[name for name, _ in PRIMARY_NEGATIVE_CASES + EXTRA_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"
