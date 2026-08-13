"""Live scripted-plan verification for the Railway 12306 suite.

Single-source policy: answers and execution-target values (``area_code``,
``answer*``, ``city*``, ``verify_status``, ``return_*``, ``train_no``,
``date_day``, and the tomorrow-fixed ``date``) are **not** injected here —
they come from ``scripted_plans.DERIVED_PARAMS``, computed at materialization
time from the episode's post-setup initial state through the judge-homologous
``Railway12306`` domain class and the judge module's own catalog helpers.
That is exactly the official ``--agent scripted`` sampling path, so these
live cases regression-test the derivation itself — including the equivalence
between the frontend availabilityGenerator PRNG and its Python mirror that
the catalog-based ``train_no`` / ``answer_train`` picks rely on.

Only *declared* task parameters stay pinned below, for deterministic
coverage: the 上海→南京 hot route keeps the station-picker and query-result
geometry stable; ``date`` (where declared) is pinned to tomorrow so the
date-picker cell sits in the first month view; ``make_default=False`` /
``direction="from"`` pin the Branch arms with the richer interaction
(switch tap / 3-row repeatable answer). Sim time equals wall clock in live
runs, so tomorrow-derived values agree with ``_date_after(1)``.
"""

from __future__ import annotations

import datetime as dt
from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.railway12306 import tasks as railway_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "railway12306"


def _date_after(days: int = 1) -> str:
    """Sim time equals wall-clock in live runs (no scenario overrides)."""
    return (dt.date.today() + dt.timedelta(days=days)).isoformat()


# Declared booking parameters shared by the BuyTicket* tasks: the hot
# 上海→南京 route with the earliest 二等 preference — the live-verified
# bookable geometry (availability PRNG keeps this combination sellable).
_BOOKING_PINS: dict[str, str] = {
    "from_station": "上海",
    "to_station": "南京",
    "schedule_pref": "earliest",
    "seat_type": "二等",
}


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("OpenAllApps", lambda: railway_tasks.OpenAllApps()),
    ("OpenServicePhone", lambda: railway_tasks.OpenServicePhone(region="上海铁路客户服务中心")),
    (
        "OpenInvoice",
        lambda: railway_tasks.OpenInvoice(
            name="赵宇轩", make_default=False, email="ticket_demo01@example.com"
        ),
    ),
    ("CheckPassengerCount", lambda: railway_tasks.CheckPassengerCount()),
    ("CheckDefaultPassengerName", lambda: railway_tasks.CheckDefaultPassengerName()),
    ("CheckStudentVerify", lambda: railway_tasks.CheckStudentVerify()),
    ("CheckRecentTripCities", lambda: railway_tasks.CheckRecentTripCities(direction="from")),
    ("CheckIdVerificationStatus", lambda: railway_tasks.CheckIdVerificationStatus()),
    ("BuyReturnTicketFromLatestOrder", lambda: railway_tasks.BuyReturnTicketFromLatestOrder()),
    # date is a declared (sampled) param; 2026-02-09 is the only single-ticket
    # date in the default orders, i.e. exactly what sample_my_ticket_date yields.
    ("FindTrainByDate", lambda: railway_tasks.FindTrainByDate(date="2026-02-09")),
    ("CheckTicketPriceByDate", lambda: railway_tasks.CheckTicketPriceByDate(date="2026-02-09")),
    (
        "QueryAndCheckRoute",
        lambda: railway_tasks.QueryAndCheckRoute(from_station="上海", to_station="南京"),
    ),
    (
        "BuyTicketForPassenger",
        lambda: railway_tasks.BuyTicketForPassenger(
            name="赵宇轩", date=_date_after(1), **_BOOKING_PINS
        ),
    ),
    (
        "BuyTicketsForTwoPassengers",
        lambda: railway_tasks.BuyTicketsForTwoPassengers(
            name="赵宇轩", name2="王思雨", date=_date_after(1), **_BOOKING_PINS
        ),
    ),
    (
        "BuyTicketForNewPassenger",
        lambda: railway_tasks.BuyTicketForNewPassenger(
            name="周若涵",
            id_no="320106199612183428",
            phone="13912345678",
            date=_date_after(1),
            **_BOOKING_PINS,
        ),
    ),
    (
        "QueryFastestTrainDetails",
        lambda: railway_tasks.QueryFastestTrainDetails(
            from_station="上海", to_station="南京", date=_date_after(1)
        ),
    ),
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
