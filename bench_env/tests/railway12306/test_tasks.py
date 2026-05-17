"""
Railway12306 task correctness tests.

Two layers:
  - Offline tests: No simulator required. Validate task definitions,
    accessor logic, and task judge positive/negative examples.
  - Live tests (marked @pytest.mark.live): Only cover tasks whose judge
    depends on simulator-backed setup/runtime state.

Run:
    pytest bench_env/tests/test_railway12306.py -v              # all
    pytest bench_env/tests/test_railway12306.py -v -m "not live" # offline only
    pytest bench_env/tests/test_railway12306.py -v -m live       # live only
"""

from __future__ import annotations

import asyncio
import copy
import datetime
import inspect
import json
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.railway12306.app import Railway12306
from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import tomorrow_ymd

from bench_env.tests.conftest import make_judge_input

# ═════════════════════════════════════════════════════════════════════
# Discover all task classes
# ═════════════════════════════════════════════════════════════════════

from bench_env.task.railway12306 import tasks as _tasks_module

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for name, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]

ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]

ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]


def _load_defaults() -> dict[str, Any]:
    p = Path(__file__).resolve().parents[3] / "apps" / "Railway12306" / "data" / "defaults.json"
    return json.loads(p.read_text(encoding="utf-8"))


DEFAULTS = _load_defaults()


# ═════════════════════════════════════════════════════════════════════
# OFFLINE TESTS — No simulator required
# ═════════════════════════════════════════════════════════════════════


class TestTaskDefinitions:
    """Validate task class definitions are well-formed."""

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        """Every task class can be instantiated with defaults."""
        task = cls()
        assert task.name == cls.__name__
        assert len(task.templates) > 0, f"{cls.__name__} has no templates"
        assert len(task.apps) > 0, f"{cls.__name__} has no apps"
        assert "railway12306" in task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        """Templates render without KeyError using default params."""
        task = cls()
        task._env_state = {"os": {"time": {"timestamp": 1742025600000}}}
        desc = task.description
        assert desc, f"{cls.__name__}.description is empty"
        assert "{" not in desc, (
            f"{cls.__name__}.description has unresolved placeholder: {desc}"
        )

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_required_class_attrs(self, cls):
        """Check taxonomy attributes are set."""
        assert cls.scope in ("S1", "S2", "S3"), f"{cls.__name__}.scope invalid"
        assert cls.objective in ("operate", "query", "hybrid", "vague", "safety")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        """Every non-underscore parameter has a default value."""
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema, (
                f"{cls.__name__}.parameters['{key}'] missing 'default'"
            )

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES,
                             ids=[c.__name__ for c in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer_or_get_answer(self, cls):
        """AnswerTask subclasses must define answer, override get_answer, or override check_goals."""
        has_answer_attr = cls.answer is not None
        has_get_answer_override = cls.get_answer is not AnswerTask.get_answer
        has_check_goals_override = cls.check_goals is not AnswerTask.check_goals
        assert has_answer_attr or has_get_answer_override or has_check_goals_override, (
            f"{cls.__name__} is AnswerTask but has no answer, get_answer, or check_goals override"
        )


class TestRailway12306Accessor:
    """Validate Railway12306 app accessor with defaults.json data."""

    @pytest.fixture
    def rail(self) -> Railway12306:
        return Railway12306(copy.deepcopy(DEFAULTS))

    def test_user_name(self, rail: Railway12306):
        assert rail.user_name == "赵宇轩"

    def test_account_username(self, rail: Railway12306):
        assert rail.account_username == "xuan123456"

    def test_passengers(self, rail: Railway12306):
        assert len(rail.passengers) == 9
        assert rail.passenger_names[0] == "赵宇轩"

    def test_default_passenger(self, rail: Railway12306):
        p = rail.get_default_passenger()
        assert p["name"] == "赵宇轩"
        assert p["isDefault"] is True

    def test_orders(self, rail: Railway12306):
        assert len(rail.orders) == 3

    def test_my_tickets(self, rail: Railway12306):
        tickets = rail.my_tickets()
        assert len(tickets) >= 1
        for t in tickets:
            assert t["passengerName"] == "赵宇轩"

    def test_my_latest_ticket(self, rail: Railway12306):
        ticket = rail.my_latest_ticket
        assert ticket["trainNo"] == "G7536"
        assert ticket["fromStation"] == "杭州东"
        assert ticket["toStation"] == "上海虹桥"

    def test_my_tickets_on_date(self, rail: Railway12306):
        tickets = rail.my_tickets_on_date("2026-02-09")
        assert len(tickets) == 1
        assert tickets[0]["trainNo"] == "G7536"

    def test_my_tickets_on_date_multiple(self, rail: Railway12306):
        tickets = rail.my_tickets_on_date("2026-02-08")
        assert len(tickets) == 2

    def test_settings(self, rail: Railway12306):
        assert rail.font_size == "medium"
        assert rail.high_contrast is False

    def test_student_verify(self, rail: Railway12306):
        sv = rail.student_verify
        assert sv["from"] == "上海"
        assert sv["to"] == "成都"

    def test_real_name_verified(self, rail: Railway12306):
        assert rail.real_name_verified is True

    def test_unique_trip_cities_from(self, rail: Railway12306):
        cities = rail.unique_trip_cities("from")
        assert "杭州" in cities
        assert "苏州" in cities
        assert "合肥" in cities

    def test_unique_trip_cities_to(self, rail: Railway12306):
        cities = rail.unique_trip_cities("to")
        assert "上海" in cities
        assert "南京" in cities

    def test_invoice_headers_empty(self, rail: Railway12306):
        assert rail.invoice_headers == []

    def test_invoice_email_not_present(self, rail: Railway12306):
        assert rail.invoice_email is None

    def test_new_orders_no_init(self, rail: Railway12306):
        """new_orders needs init state; without it, should raise."""
        with pytest.raises(ValueError):
            rail.new_orders()


class TestInitCurrentGuards:
    def test_buy_return_ticket_from_latest_order_uses_init_os_for_tomorrow(self):
        task = _tasks_module.BuyReturnTicketFromLatestOrder()
        init = copy.deepcopy(DEFAULTS)
        latest = Railway12306(init).my_latest_ticket
        from_city = Railway12306._station_to_city(latest["toStation"])
        to_city = Railway12306._station_to_city(latest["fromStation"])
        init_os = {"time": {"timestamp": int(datetime.datetime(2025, 3, 15, 12, 0, 0).timestamp() * 1000)}}
        curr_os = {"time": {"timestamp": int(datetime.datetime(2025, 3, 16, 12, 0, 0).timestamp() * 1000)}}
        curr = copy.deepcopy(DEFAULTS)
        curr["orders"] = init["orders"] + [
            _return_order(
                from_station=from_city + "南",
                to_station=to_city,
                date="2025-03-16",
                passenger_name=Railway12306(init).user_name,
            )
        ]

        result = task.evaluate(
            _make_task_input(
                init,
                curr,
                init_os=init_os,
                curr_os=curr_os,
            )
        )

        assert result.success, result.issues

    def test_cheapest_high_speed_seat_price(self):
        curr = copy.deepcopy(DEFAULTS)
        curr["queryState"] = _booking_query_state(direct_trains=[
            {
                "trainNo": "G7002",
                "trainType": "G",
                "fromStation": "上海",
                "toStation": "南京",
                "departTime": "08:30",
                "arriveTime": "10:00",
                "duration": "1小时30分",
                "seats": [
                    {"type": "二等", "price": 150, "count": 100},
                    {"type": "一等", "price": 240, "count": 0},
                ],
            },
            {
                "trainNo": "D1234",
                "trainType": "D",
                "fromStation": "上海",
                "toStation": "南京",
                "departTime": "09:00",
                "arriveTime": "11:00",
                "duration": "2小时",
                "seats": [{"type": "二等", "price": 99, "count": 100}],
            },
            {
                "trainNo": "G7010",
                "trainType": "G",
                "fromStation": "上海虹桥",
                "toStation": "南京南",
                "departTime": "12:00",
                "arriveTime": "13:30",
                "duration": "1小时30分",
                "seats": [{"type": "二等", "price": 160, "count": 80}],
            },
        ])
        curr["lastQuerySummary"] = {"from": "上海", "to": "南京", "date": "2026-03-20"}
        rail = Railway12306(curr)
        assert rail.cheapest_high_speed_seat_price("上海", "南京", date="2026-03-20") == 150.0
        assert rail.cheapest_high_speed_seat_price("上海", "南京", date="2026-03-21") is None


class TestAccessorWithInit:
    """Test accessor comparison features (init vs current state)."""

    def test_new_orders_detects_addition(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        new_order = {
            "id": "EK_NEW_001",
            "trainNo": "G100",
            "fromStation": "上海",
            "toStation": "南京",
            "departTime": "10:00",
            "arriveTime": "11:30",
            "date": "2026-03-20",
            "tickets": [
                {"passengerName": "赵宇轩", "ticketType": "成人票",
                 "seatType": "二等", "seatNo": "01车 01A号", "price": 150}
            ],
            "status": "pending",
            "createTime": "2026-03-15T10:00:00",
        }
        curr["orders"].append(new_order)
        rail = Railway12306(curr, init=init)
        new = rail.new_orders()
        assert len(new) == 1
        assert new[0]["id"] == "EK_NEW_001"

    def test_new_passengers_detects_addition(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        curr["passengers"].append({
            "id": "p_new",
            "name": "周若涵",
            "idType": "身份证",
            "idNo": "320106199612183428",
            "isDefault": False,
            "ticketType": "成人",
        })
        rail = Railway12306(curr, init=init)
        new_p = rail.new_passengers()
        assert len(new_p) == 1
        assert new_p[0]["name"] == "周若涵"

    def test_check_new_passenger_positive(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        curr["passengers"].append({
            "id": "p_new",
            "name": "周若涵",
            "idType": "身份证",
            "idNo": "320106199612183428",
            "phone": "13912345678",
            "isDefault": False,
            "ticketType": "成人",
        })
        rail = Railway12306(curr, init=init)

        check = rail.check_new_passenger(
            name="周若涵",
            id_no="320106199612183428",
            phone="13912345678",
        )

        assert check["field"] == "newPassenger.exists"
        assert check["passed"] is True
        assert check["actual"] == "周若涵 (身份证: 320106199612183428, 手机: 13912345678)"

    def test_check_new_passenger_accepts_formatted_phone(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        curr["passengers"].append({
            "id": "p_new",
            "name": "周若涵",
            "idType": "身份证",
            "idNo": "320106199612183428",
            "phone": "139-1234-5678",
            "isDefault": False,
            "ticketType": "成人",
        })
        rail = Railway12306(curr, init=init)
        check = rail.check_new_passenger(
            name="周若涵",
            id_no="320106199612183428",
            phone="13912345678",
        )
        assert check["passed"] is True

    def test_check_new_passenger_rejects_wrong_phone(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        curr["passengers"].append({
            "id": "p_new",
            "name": "周若涵",
            "idType": "身份证",
            "idNo": "320106199612183428",
            "phone": "13912345679",
            "isDefault": False,
            "ticketType": "成人",
        })
        rail = Railway12306(curr, init=init)

        check = rail.check_new_passenger(
            name="周若涵",
            id_no="320106199612183428",
            phone="13912345678",
        )

        assert check["passed"] is False
        assert check["actual"] == "周若涵 (身份证: 320106199612183428, 手机: 13912345679)"

    def test_find_new_pending_order(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        new_order = {
            "id": "EK_NEW_002",
            "trainNo": "G7002",
            "fromStation": "上海",
            "toStation": "南京",
            "departTime": "08:30",
            "arriveTime": "10:00",
            "date": "2026-03-20",
            "tickets": [
                {"passengerName": "赵宇轩", "ticketType": "成人票",
                 "seatType": "二等", "seatNo": "01车 01A号", "price": 150}
            ],
            "status": "pending",
            "createTime": "2026-03-15T10:00:00",
        }
        curr["orders"].append(new_order)
        rail = Railway12306(curr, init=init)

        found = rail.find_new_pending_order("上海", "南京", "2026-03-20", ["赵宇轩"])
        assert found is not None
        assert found["id"] == "EK_NEW_002"

        not_found = rail.find_new_pending_order("北京", "上海", "2026-03-20", ["赵宇轩"])
        assert not_found is None

    def test_has_searched_with_city_level_station_tolerance(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        curr["lastQuerySummary"] = {
            "from": "上海",
            "to": "南京",
            "date": "2026-03-20",
        }
        rail = Railway12306(curr, init=init)

        assert rail.has_searched(
            from_station="上海",
            to_station="南京南",
            date="2026-03-20",
        ) is True

    def test_has_searched_rejects_different_specific_station(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        curr["lastQuerySummary"] = {
            "from": "上海",
            "to": "南京西",
            "date": "2026-03-20",
        }
        rail = Railway12306(curr, init=init)

        assert rail.has_searched(
            from_station="上海",
            to_station="南京南",
            date="2026-03-20",
        ) is False

    def test_inspect_booking_target_bookable(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        curr["queryState"] = _booking_query_state()
        curr["lastQuerySummary"] = {
            "from": "上海",
            "to": "南京",
            "date": "2026-03-20",
        }
        rail = Railway12306(curr, init=init)

        status, target_train = rail.inspect_booking_target(
            from_station="上海",
            to_station="南京",
            date="2026-03-20",
            schedule_pref="earliest",
            seat_type="二等",
        )

        assert status == "bookable"
        assert target_train is not None
        assert target_train["trainNo"] == "G7002"

    def test_inspect_booking_target_not_ready_for_mismatched_query(self):
        init = copy.deepcopy(DEFAULTS)
        curr = copy.deepcopy(DEFAULTS)
        curr["queryState"] = _booking_query_state(direct_trains=[])
        curr["lastQuerySummary"] = {
            "from": "北京",
            "to": "上海",
            "date": "2026-03-20",
        }
        rail = Railway12306(curr, init=init)

        status, target_train = rail.inspect_booking_target(
            from_station="上海",
            to_station="南京",
            date="2026-03-20",
            schedule_pref="earliest",
            seat_type="二等",
        )

        assert status == "not_ready"
        assert target_train is None


DEFAULT_ROUTE = {"app": "railway12306", "path": "/"}
TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
TEST_TODAY = datetime.date.fromtimestamp(
    TEST_OS_STATE["time"]["timestamp"] / 1000.0
).isoformat()
TEST_TOMORROW = (
    datetime.date.fromtimestamp(TEST_OS_STATE["time"]["timestamp"] / 1000.0)
    + datetime.timedelta(days=1)
).isoformat()


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
    init_os: dict[str, Any] | None = None,
    curr_os: dict[str, Any] | None = None,
) -> JudgeInput:
    init_full = {
        "apps": {"railway12306": init_state},
        "os": init_os or {},
    }
    curr_full = {
        "apps": {"railway12306": curr_state},
        "os": curr_os if curr_os is not None else (init_os or {}),
    }
    return make_judge_input(
        init_full,
        curr_full,
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _service_phone_area_code(region: str) -> str:
    for item in DEFAULTS.get("servicePhones", []):
        if item["region"] == region:
            return item["areaCode"]
    fallback = {
        "北京铁路客户服务中心": "010",
        "上海铁路客户服务中心": "021",
        "广州铁路客户服务中心": "020",
        "武汉铁路客户服务中心": "027",
        "成都铁路客户服务中心": "028",
    }
    if region in fallback:
        return fallback[region]
    raise AssertionError(f"Missing service phone test data for region: {region}")


def _booking_query_state(
    *,
    direct_trains: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "directTrains": copy.deepcopy(direct_trains)
        if direct_trains is not None
        else [
            {
                "trainNo": "G7002",
                "trainType": "G",
                "fromStation": "上海",
                "toStation": "南京",
                "departTime": "08:30",
                "arriveTime": "10:00",
                "duration": "1小时30分",
                "seats": [{"type": "二等", "price": 150, "count": 100}],
            },
            {
                "trainNo": "G7010",
                "trainType": "G",
                "fromStation": "上海",
                "toStation": "南京",
                "departTime": "12:00",
                "arriveTime": "13:30",
                "duration": "1小时30分",
                "seats": [{"type": "二等", "price": 150, "count": 80}],
            },
        ],
        "transferPlans": [],
        "loading": False,
    }


def _booking_task_params() -> dict[str, Any]:
    return {
        "name": "赵宇轩",
        "from_station": "上海",
        "to_station": "南京",
        "date": "2026-03-20",
        "schedule_pref": "earliest",
        "seat_type": "二等",
    }


def _booking_order(
    order_id: str,
    *,
    train_no: str = "G7002",
    from_station: str = "上海",
    to_station: str = "南京",
    date: str = "2026-03-20",
    tickets: list[dict[str, Any]],
    status: str = "pending",
) -> dict[str, Any]:
    time_map = {
        "G7002": ("08:30", "10:00"),
        "G7010": ("12:00", "13:30"),
    }
    depart_time, arrive_time = time_map.get(train_no, ("10:00", "11:30"))
    return {
        "id": order_id,
        "trainNo": train_no,
        "fromStation": from_station,
        "toStation": to_station,
        "departTime": depart_time,
        "arriveTime": arrive_time,
        "date": date,
        "tickets": tickets,
        "status": status,
        "createTime": "2026-03-15T10:00:00",
    }


def _booking_curr_state(
    init_state: dict[str, Any],
    *,
    orders: list[dict[str, Any]] | None = None,
    passengers: list[dict[str, Any]] | None = None,
    query_state: dict[str, Any] | None = None,
    last_query_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    curr = copy.deepcopy(init_state)
    curr["queryState"] = query_state or _booking_query_state()
    curr["lastQuerySummary"] = last_query_summary or {
        "from": "上海",
        "to": "南京",
        "date": "2026-03-20",
    }
    if orders is not None:
        curr["orders"] = orders
    if passengers is not None:
        curr["passengers"] = passengers
    return curr


def _return_order(
    *,
    from_station: str,
    to_station: str,
    date: str,
    passenger_name: str,
) -> dict[str, Any]:
    return {
        "id": "EK_RETURN_001",
        "trainNo": "G8000",
        "fromStation": from_station,
        "toStation": to_station,
        "departTime": "10:00",
        "arriveTime": "11:30",
        "date": date,
        "tickets": [
            {
                "passengerName": passenger_name,
                "ticketType": "成人票",
                "seatType": "二等",
                "seatNo": "01车 01A号",
                "price": 150,
            }
        ],
        "status": "pending",
        "createTime": "2026-03-15T10:00:00",
    }
def _open_all_apps_positive_case():
    task = _tasks_module.OpenAllApps()
    return task, _make_task_input(
        DEFAULTS,
        DEFAULTS,
        route={"app": "railway12306", "path": "/all-apps"},
    )


def _open_all_apps_negative_case():
    task = _tasks_module.OpenAllApps()
    return task, _make_task_input(DEFAULTS, DEFAULTS)


def _open_service_phone_positive_case():
    region = "上海铁路客户服务中心"
    init = copy.deepcopy(DEFAULTS)
    init["servicePhones"] = [
        {"region": region, "areaCode": "021", "phone": "12306"}
    ]
    task = _tasks_module.OpenServicePhone(region=region)
    return task, _make_task_input(
        init,
        init,
        route={"app": "railway12306", "path": "/service-phone"},
        answer=_service_phone_area_code(region),
    )


def _open_service_phone_negative_case():
    region = "上海铁路客户服务中心"
    task = _tasks_module.OpenServicePhone(region=region)
    return task, _make_task_input(
        DEFAULTS,
        DEFAULTS,
        route={"app": "railway12306", "path": "/settings"},
    )


def _open_invoice_positive_case():
    task = _tasks_module.OpenInvoice(
        name="赵宇轩",
        make_default=True,
        email="ticket_demo01@example.com",
    )
    curr = copy.deepcopy(DEFAULTS)
    curr["invoiceHeaders"] = [{"name": "赵宇轩", "isDefault": True}]
    curr["invoiceEmail"] = "ticket_demo01@example.com"
    return task, _make_task_input(DEFAULTS, curr)


def _open_invoice_negative_case():
    task = _tasks_module.OpenInvoice(
        name="赵宇轩",
        make_default=True,
        email="ticket_demo01@example.com",
    )
    return task, _make_task_input(DEFAULTS, DEFAULTS)
def _check_passenger_count_positive_case():
    task = _tasks_module.CheckPassengerCount()
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="9")


def _check_passenger_count_negative_case():
    task = _tasks_module.CheckPassengerCount()
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="5")


def _check_default_passenger_name_positive_case():
    task = _tasks_module.CheckDefaultPassengerName()
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="赵宇轩")


def _check_default_passenger_name_negative_case():
    task = _tasks_module.CheckDefaultPassengerName()
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="王思雨")


def _find_order_by_train_positive_case():
    task = _tasks_module.FindTrainByDate(date="2026-02-09")
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="G7536")


def _find_order_by_train_negative_case():
    task = _tasks_module.FindTrainByDate(date="2026-02-09")
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="G100")


def _check_latest_order_price_positive_case():
    task = _tasks_module.CheckTicketPriceByDate(date="2026-02-09")
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="58")


def _check_latest_order_price_negative_case():
    task = _tasks_module.CheckTicketPriceByDate(date="2026-02-09")
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="100")


def _check_student_verify_route_positive_case():
    task = _tasks_module.CheckStudentVerify()
    return task, _make_task_input(
        DEFAULTS,
        DEFAULTS,
        route={"app": "railway12306", "path": "/student-verify"},
        answer="上海到成都",
    )


def _check_student_verify_route_negative_case():
    task = _tasks_module.CheckStudentVerify()
    return task, _make_task_input(
        DEFAULTS,
        DEFAULTS,
        route={"app": "railway12306", "path": "/student-verify"},
        answer="北京到广州",
    )


def _buy_ticket_for_passenger_positive_case():
    task = _tasks_module.BuyTicketForPassenger(**_booking_task_params())
    init = copy.deepcopy(DEFAULTS)
    curr = _booking_curr_state(
        init,
        orders=init["orders"]
        + [
            _booking_order(
                "EK_TEST_BUY",
                tickets=[
                    {
                        "passengerName": "赵宇轩",
                        "ticketType": "成人票",
                        "seatType": "二等",
                        "seatNo": "01车 01A号",
                        "price": 150,
                    }
                ],
            )
        ],
    )
    return task, _make_task_input(init, curr)


def _buy_ticket_for_passenger_negative_case():
    task = _tasks_module.BuyTicketForPassenger(**_booking_task_params())
    init = copy.deepcopy(DEFAULTS)
    curr = _booking_curr_state(init)
    return task, _make_task_input(init, curr)


def _buy_tickets_for_two_passengers_positive_case():
    task = _tasks_module.BuyTicketsForTwoPassengers(
        name="赵宇轩",
        name2="王思雨",
        from_station="上海",
        to_station="南京",
        date="2026-03-20",
        schedule_pref="earliest",
        seat_type="二等",
    )
    init = copy.deepcopy(DEFAULTS)
    curr = _booking_curr_state(
        init,
        orders=init["orders"]
        + [
            _booking_order(
                "EK_TEST_BUY2",
                tickets=[
                    {
                        "passengerName": "赵宇轩",
                        "ticketType": "成人票",
                        "seatType": "二等",
                        "seatNo": "01车 01A号",
                        "price": 150,
                    },
                    {
                        "passengerName": "王思雨",
                        "ticketType": "成人票",
                        "seatType": "二等",
                        "seatNo": "01车 01B号",
                        "price": 150,
                    },
                ],
            )
        ],
    )
    return task, _make_task_input(init, curr)


def _buy_tickets_for_two_passengers_negative_case():
    task = _tasks_module.BuyTicketsForTwoPassengers(
        name="赵宇轩",
        name2="王思雨",
        from_station="上海",
        to_station="南京",
        date="2026-03-20",
        schedule_pref="earliest",
        seat_type="二等",
    )
    init = copy.deepcopy(DEFAULTS)
    curr = _booking_curr_state(
        init,
        orders=init["orders"]
        + [
            _booking_order(
                "EK_ONE",
                tickets=[
                    {
                        "passengerName": "赵宇轩",
                        "ticketType": "成人票",
                        "seatType": "二等",
                        "seatNo": "01车 01A号",
                        "price": 150,
                    }
                ],
            )
        ],
    )
    return task, _make_task_input(init, curr)


def _buy_ticket_for_new_passenger_positive_case():
    task = _tasks_module.BuyTicketForNewPassenger(
        name="周若涵",
        id_no="320106199612183428",
        phone="13912345678",
        from_station="上海",
        to_station="南京",
        date="2026-03-20",
        schedule_pref="earliest",
        seat_type="二等",
    )
    init = copy.deepcopy(DEFAULTS)
    curr = _booking_curr_state(
        init,
        passengers=init["passengers"]
        + [
            {
                "id": "p_new",
                "name": "周若涵",
                "idType": "身份证",
                "idNo": "320106199612183428",
                "phone": "13912345678",
                "isDefault": False,
                "ticketType": "成人",
            }
        ],
        orders=init["orders"]
        + [
            _booking_order(
                "EK_TEST_NEWP",
                tickets=[
                    {
                        "passengerName": "周若涵",
                        "ticketType": "成人票",
                        "seatType": "二等",
                        "seatNo": "01车 01A号",
                        "price": 150,
                    }
                ],
            )
        ],
    )
    return task, _make_task_input(init, curr)


def _buy_ticket_for_new_passenger_negative_case():
    task = _tasks_module.BuyTicketForNewPassenger(
        name="周若涵",
        id_no="320106199612183428",
        phone="13912345678",
        from_station="上海",
        to_station="南京",
        date="2026-03-20",
        schedule_pref="earliest",
        seat_type="二等",
    )
    init = copy.deepcopy(DEFAULTS)
    curr = _booking_curr_state(
        init,
        orders=init["orders"]
        + [
            _booking_order(
                "EK_NP",
                tickets=[
                    {
                        "passengerName": "周若涵",
                        "ticketType": "成人票",
                        "seatType": "二等",
                        "seatNo": "01车 01A号",
                        "price": 150,
                    }
                ],
            )
        ],
    )
    return task, _make_task_input(init, curr)


def _check_recent_trip_cities_positive_case():
    task = _tasks_module.CheckRecentTripCities(direction="from")
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="杭州东、苏州、合肥南")


def _check_recent_trip_cities_negative_case():
    task = _tasks_module.CheckRecentTripCities(direction="from")
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="上海虹桥、南京")


def _buy_return_ticket_from_latest_order_positive_case():
    """正例：用同城市不同站名的返程订单（城市级匹配）。"""
    task = _tasks_module.BuyReturnTicketFromLatestOrder()
    init = copy.deepcopy(DEFAULTS)
    latest = Railway12306(init).my_latest_ticket
    from_city = Railway12306._station_to_city(latest["toStation"])
    to_city = Railway12306._station_to_city(latest["fromStation"])
    curr = copy.deepcopy(DEFAULTS)
    curr["orders"] = init["orders"] + [
        _return_order(
            from_station=from_city + "南",
            to_station=to_city,
            date=TEST_TOMORROW,
            passenger_name=Railway12306(init).user_name,
        )
    ]
    return task, _make_task_input(
        init,
        curr,
        init_os=TEST_OS_STATE,
    )


def _buy_return_ticket_from_latest_order_negative_case():
    task = _tasks_module.BuyReturnTicketFromLatestOrder()
    return task, _make_task_input(
        DEFAULTS,
        DEFAULTS,
        init_os=TEST_OS_STATE,
    )


def _check_id_verification_status_positive_case():
    task = _tasks_module.CheckIdVerificationStatus()
    return task, _make_task_input(
        DEFAULTS,
        DEFAULTS,
        route={"app": "railway12306", "path": "/id-verify"},
        answer="已通过核验",
    )


def _check_id_verification_status_negative_case():
    task = _tasks_module.CheckIdVerificationStatus()
    return task, _make_task_input(
        DEFAULTS,
        DEFAULTS,
        route={"app": "railway12306", "path": "/id-verify"},
        answer="未通过核验",
    )


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("OpenAllApps", _open_all_apps_positive_case),
    ("OpenServicePhone", _open_service_phone_positive_case),
    ("OpenInvoice", _open_invoice_positive_case),
    ("CheckPassengerCount", _check_passenger_count_positive_case),
    ("CheckDefaultPassengerName", _check_default_passenger_name_positive_case),
    ("FindTrainByDate", _find_order_by_train_positive_case),
    ("CheckTicketPriceByDate", _check_latest_order_price_positive_case),
    ("CheckStudentVerify", _check_student_verify_route_positive_case),
    ("BuyTicketForPassenger", _buy_ticket_for_passenger_positive_case),
    ("BuyTicketsForTwoPassengers", _buy_tickets_for_two_passengers_positive_case),
    ("BuyTicketForNewPassenger", _buy_ticket_for_new_passenger_positive_case),
    ("CheckRecentTripCities", _check_recent_trip_cities_positive_case),
    ("BuyReturnTicketFromLatestOrder", _buy_return_ticket_from_latest_order_positive_case),
    ("CheckIdVerificationStatus", _check_id_verification_status_positive_case),
]


OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("OpenAllApps", _open_all_apps_negative_case),
    ("OpenServicePhone", _open_service_phone_negative_case),
    ("OpenInvoice", _open_invoice_negative_case),
    ("CheckPassengerCount", _check_passenger_count_negative_case),
    ("CheckDefaultPassengerName", _check_default_passenger_name_negative_case),
    ("FindTrainByDate", _find_order_by_train_negative_case),
    ("CheckTicketPriceByDate", _check_latest_order_price_negative_case),
    ("CheckStudentVerify", _check_student_verify_route_negative_case),
    ("BuyTicketForPassenger", _buy_ticket_for_passenger_negative_case),
    ("BuyTicketsForTwoPassengers", _buy_tickets_for_two_passengers_negative_case),
    ("BuyTicketForNewPassenger", _buy_ticket_for_new_passenger_negative_case),
    ("CheckRecentTripCities", _check_recent_trip_cities_negative_case),
    ("BuyReturnTicketFromLatestOrder", _buy_return_ticket_from_latest_order_negative_case),
    ("CheckIdVerificationStatus", _check_id_verification_status_negative_case),
]


LIVE_JUDGE_TASK_NAMES = {"QueryAndCheckRoute", "QueryFastestTrainDetails"}
OFFLINE_JUDGE_TASK_NAMES = {
    cls.__name__ for cls in ALL_TASK_CLASSES
    if cls.__name__ not in LIVE_JUDGE_TASK_NAMES
}


class TestTaskJudgeMatrixOffline:
    """Judge matrix: every non-live Railway12306 task has one positive and one negative case."""

    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == OFFLINE_JUDGE_TASK_NAMES
        assert negative == OFFLINE_JUDGE_TASK_NAMES

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_POSITIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, (
            f"{task_name} positive case failed: "
            f"issues={result.issues}, warnings={result.warnings}"
        )

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_NEGATIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, (
            f"{task_name} negative case unexpectedly passed: "
            f"issues={result.issues}, warnings={result.warnings}"
        )

    def test_buy_return_ticket_city_level_station_match(self):
        """不同具体站名但同城市的返程订单应判定通过。"""
        task = _tasks_module.BuyReturnTicketFromLatestOrder()
        init = copy.deepcopy(DEFAULTS)
        latest = Railway12306(init).my_latest_ticket
        curr = copy.deepcopy(DEFAULTS)
        curr["orders"] = init["orders"] + [
            _return_order(
                from_station=latest["toStation"],
                to_station=latest["fromStation"],
                date=TEST_TOMORROW,
                passenger_name=Railway12306(init).user_name,
            )
        ]
        inp = _make_task_input(init, curr, init_os=TEST_OS_STATE)
        result = task.evaluate(inp)
        assert result.success, result.issues


# ═════════════════════════════════════════════════════════════════════
# LIVE TESTS — Require simulator at localhost:3000
# ═════════════════════════════════════════════════════════════════════


MOCK_TRAINS = [
    {
        "trainNo": "G7002", "trainType": "G",
        "fromStation": "上海虹桥", "toStation": "南京南",
        "departTime": "06:30", "arriveTime": "08:00",
        "duration": "1小时30分",
        "seats": [{"type": "二等", "price": 150, "count": 100}],
    },
    {
        "trainNo": "G7010", "trainType": "G",
        "fromStation": "上海虹桥", "toStation": "南京南",
        "departTime": "12:00", "arriveTime": "13:10",
        "duration": "1小时10分",
        "seats": [{"type": "二等", "price": 150, "count": 80}],
    },
    {
        "trainNo": "G7050", "trainType": "G",
        "fromStation": "上海虹桥", "toStation": "南京南",
        "departTime": "21:00", "arriveTime": "22:40",
        "duration": "1小时40分",
        "seats": [{"type": "二等", "price": 150, "count": 50}],
    },
]


LIVE_JUDGE_POSITIVE_CASES = [
    (
        "QueryAndCheckRoute",
        lambda: _tasks_module.QueryAndCheckRoute(from_station="上海", to_station="南京"),
        "G7050",
    ),
    (
        "QueryFastestTrainDetails",
        lambda: _tasks_module.QueryFastestTrainDetails(
            from_station="上海",
            to_station="南京",
            date="2026-03-20",
        ),
        "G7010，1小时10分，上海虹桥，13:10",
    ),
]


LIVE_JUDGE_NEGATIVE_CASES = [
    (
        "QueryAndCheckRoute",
        lambda: _tasks_module.QueryAndCheckRoute(from_station="上海", to_station="南京"),
        "G7010",
    ),
    (
        "QueryFastestTrainDetails",
        lambda: _tasks_module.QueryFastestTrainDetails(
            from_station="上海",
            to_station="南京",
            date="2026-03-20",
        ),
        "G7050，1小时10分，上海虹桥，13:10",
    ),
]


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
class TestLiveQueryTasks:
    """Judge matrix: live-only query tasks each have one positive and one negative case."""

    async def _inject_trains(self, env, task: BaseTask):
        """Inject mock train data into store."""
        date = getattr(task.p, "date", None)
        if date in (None, ""):
            state = await env.get_state()
            date = tomorrow_ymd(state["os"])
        await env.set_state({
            "apps": {
                "railway12306": {
                    "directTrains": MOCK_TRAINS,
                    "transferPlans": [],
                    "lastQuerySummary": {
                        "from": "上海", "to": "南京", "date": str(date),
                    },
                }
            }
        })
        await asyncio.sleep(0.5)

    async def _setup_query_task(self, env, task: BaseTask) -> JudgeInput:
        task._suite = "railway12306"
        init_obs = await task.setup(env)
        await self._inject_trains(env, task)
        last_obs = await env.get_observation()
        return JudgeInput(init_obs=init_obs, last_obs=last_obs)

    async def test_live_judge_matrix_complete(self):
        positive = {name for name, _, _ in LIVE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _, _ in LIVE_JUDGE_NEGATIVE_CASES}
        assert positive == LIVE_JUDGE_TASK_NAMES
        assert negative == LIVE_JUDGE_TASK_NAMES

    @pytest.mark.parametrize(
        "task_name,task_factory,answer",
        LIVE_JUDGE_POSITIVE_CASES,
        ids=[name for name, _, _ in LIVE_JUDGE_POSITIVE_CASES],
    )
    async def test_positive_case(self, env, task_name, task_factory, answer):
        task = task_factory()
        inp = await self._setup_query_task(env, task)
        result = task.evaluate(
            JudgeInput(
                init_obs=inp.init_obs,
                last_obs=inp.last_obs,
                answer=answer,
            )
        )
        assert result.success, f"{task_name} positive case failed: {result.issues}"

    @pytest.mark.parametrize(
        "task_name,task_factory,answer",
        LIVE_JUDGE_NEGATIVE_CASES,
        ids=[name for name, _, _ in LIVE_JUDGE_NEGATIVE_CASES],
    )
    async def test_negative_case(self, env, task_name, task_factory, answer):
        task = task_factory()
        inp = await self._setup_query_task(env, task)
        result = task.evaluate(
            JudgeInput(
                init_obs=inp.init_obs,
                last_obs=inp.last_obs,
                answer=answer,
            )
        )
        assert not result.success, (
            f"{task_name} negative case unexpectedly passed: {result.issues}"
        )

    @pytest.mark.parametrize(
        "answer",
        [
            "最快的车是G7010, 70分钟, 始发站上海虹桥, 下午1点10分到达",
            "G7010，70分钟，上海虹桥，下午1:10",
            "G7010，1小时10分钟，上海虹桥，13:10到",
        ],
        ids=["chinese_natural", "mixed_format", "minutes_suffix"],
    )
    async def test_fastest_train_flexible_answer_formats(self, env, answer):
        """Agent 以各种自然语言格式回答最快车次详情均应通过。"""
        task = _tasks_module.QueryFastestTrainDetails(
            from_station="上海", to_station="南京", date="2026-03-20",
        )
        inp = await self._setup_query_task(env, task)
        result = task.evaluate(
            JudgeInput(init_obs=inp.init_obs, last_obs=inp.last_obs, answer=answer)
        )
        assert result.success, f"Flexible format failed: {result.issues}"
