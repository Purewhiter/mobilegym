"""Live scripted-plan verification for the Railway 12306 suite."""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.railway12306 import tasks as railway_tasks
from bench_env.task.railway12306.app import (
    Railway12306,
    _catalog_available_trains,
    _catalog_route_candidates,
)
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "railway12306"
ROOT = Path(__file__).resolve().parents[3]
DEFAULTS = json.loads((ROOT / "apps" / "Railway12306" / "data" / "defaults.json").read_text(encoding="utf-8"))


def _rail() -> Railway12306:
    return Railway12306(DEFAULTS)


def _date_after(days: int = 1) -> str:
    return (dt.date.today() + dt.timedelta(days=days)).isoformat()


def _date_day(date_value: str) -> str:
    return str(int(date_value.rsplit("-", 1)[1]))


def _sim_today() -> str:
    return dt.date.today().isoformat()


def _catalog_train(from_station: str, to_station: str, date: str, pref: str) -> dict[str, Any]:
    trains = list(_catalog_available_trains(_sim_today(), from_station, to_station, date, True))
    picked = Railway12306._pick_catalog_train(trains, pref)
    assert picked is not None
    return picked


def _duration_minutes(value: str) -> int:
    hour, minute = value.split(":", 1)
    return int(hour) * 60 + int(minute)


def _duration_label(value: str) -> str:
    minutes = _duration_minutes(value)
    return f"{minutes // 60}小时{minutes % 60}分"


def _route_candidate_train(from_station: str, to_station: str, pref: str) -> dict[str, Any]:
    trains = list(_catalog_route_candidates(from_station, to_station, False))
    assert trains

    def _start_minutes(train: dict[str, Any]) -> int:
        return Railway12306.parse_hhmm(str(train["startTime"]))

    if pref == "earliest":
        return min(trains, key=lambda t: (_start_minutes(t), str(t["trainCode"])))
    if pref == "latest":
        return min(trains, key=lambda t: (-_start_minutes(t), str(t["trainCode"])))
    if pref == "fastest":
        return min(trains, key=lambda t: (_duration_minutes(str(t["lishi"])), _start_minutes(t), str(t["trainCode"])))
    raise ValueError(f"unknown route candidate preference: {pref!r}")


def _query_params(
    from_station: str = "上海",
    to_station: str = "南京",
    date: str | None = None,
    *,
    answer_pref: str = "latest",
) -> dict[str, str]:
    date = date or _date_after(1)
    answer_train = _route_candidate_train(from_station, to_station, answer_pref)
    fastest = _route_candidate_train(from_station, to_station, "fastest")
    return {
        "from_station": from_station,
        "to_station": to_station,
        "date": date,
        "date_day": _date_day(date),
        "answer_train": str(answer_train["trainCode"]),
        "answer_duration": _duration_label(str(fastest["lishi"])),
        "answer_from": str(fastest["fromStation"]),
        "answer_arrive": str(fastest["arriveTime"]),
    }


def _booking_params(**overrides: str) -> dict[str, str]:
    base = {
        **_query_params(),
        "schedule_pref": "earliest",
        "seat_type": "二等",
        "train_no": str(_catalog_train("上海", "南京", _date_after(1), "earliest")["trainCode"]),
    }
    base.update(overrides)
    return base


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("OpenAllApps", lambda: railway_tasks.OpenAllApps()),
    ("OpenServicePhone", lambda: railway_tasks.OpenServicePhone(region="上海铁路客户服务中心", area_code="021")),
    ("OpenInvoice", lambda: railway_tasks.OpenInvoice(name="赵宇轩", make_default=False, email="ticket_demo01@example.com")),
    ("CheckPassengerCount", lambda: railway_tasks.CheckPassengerCount(answer=str(len(_rail().passengers)))),
    ("CheckDefaultPassengerName", lambda: railway_tasks.CheckDefaultPassengerName(answer=_rail().get_default_passenger()["name"])),
    (
        "CheckStudentVerify",
        lambda: railway_tasks.CheckStudentVerify(
            answer_from=_rail().student_verify["from"],
            answer_to=_rail().student_verify["to"],
        ),
    ),
    (
        "CheckRecentTripCities",
        lambda: railway_tasks.CheckRecentTripCities(
            direction="from",
            city1="杭州",
            city2="苏州",
            city3="合肥",
        ),
    ),
    ("CheckIdVerificationStatus", lambda: railway_tasks.CheckIdVerificationStatus()),
    (
        "BuyReturnTicketFromLatestOrder",
        lambda: railway_tasks.BuyReturnTicketFromLatestOrder(
            date=_date_after(1),
            date_day=_date_day(_date_after(1)),
            return_train=str(_catalog_train("上海", "杭州", _date_after(1), "earliest")["trainCode"]),
            name=_rail().user_name,
        ),
    ),
    ("FindTrainByDate", lambda: railway_tasks.FindTrainByDate(date="2026-02-09", answer="G7536")),
    ("CheckTicketPriceByDate", lambda: railway_tasks.CheckTicketPriceByDate(date="2026-02-09", answer="58")),
    ("QueryAndCheckRoute", lambda: railway_tasks.QueryAndCheckRoute(**_query_params(answer_pref="latest"))),
    ("BuyTicketForPassenger", lambda: railway_tasks.BuyTicketForPassenger(name="赵宇轩", **_booking_params())),
    (
        "BuyTicketsForTwoPassengers",
        lambda: railway_tasks.BuyTicketsForTwoPassengers(
            name="赵宇轩",
            name2="王思雨",
            **_booking_params(),
        ),
    ),
    (
        "BuyTicketForNewPassenger",
        lambda: railway_tasks.BuyTicketForNewPassenger(
            name="周若涵",
            id_no="320106199612183428",
            phone="13912345678",
            **_booking_params(),
        ),
    ),
    ("QueryFastestTrainDetails", lambda: railway_tasks.QueryFastestTrainDetails(**_query_params(answer_pref="fastest"))),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(railway_tasks)
    missing = declared - covered
    assert not missing, f"Railway12306 tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_railway12306_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
