"""Shared Railway12306 base-state fixtures (extracted from tests/railway12306/test_tasks.py)."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any


def _load_defaults() -> dict[str, Any]:
    p = Path(__file__).resolve().parents[3] / "apps" / "Railway12306" / "data" / "defaults.json"
    return json.loads(p.read_text(encoding="utf-8"))


DEFAULTS = _load_defaults()


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
