"""Shared Calendar base-state fixtures (extracted from tests/calendar/test_tasks.py)."""

from __future__ import annotations

import copy
import datetime
import json
from pathlib import Path
from typing import Any

from bench_env.task.calendar.app import Calendar

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "system" / "Calendar" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _make_base_state() -> dict[str, Any]:
    defaults = _load_defaults()
    return {
        "settings": copy.deepcopy(defaults["settings"]),
        "events": [],
        "selectedDateTs": TEST_OS_STATE["time"]["timestamp"],
    }


BASE_STATE = _make_base_state()


def _add_event(
    state: dict[str, Any],
    *,
    title: str,
    date_value: str,
    event_type: str = "event",
    start: str = "09:00",
    end: str = "10:00",
    all_day: bool = False,
    reminder: int | None = 15,
    alarm: bool = False,
    description: str = "",
) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    if all_day:
        start_ts = Calendar.start_of_day_ts(date_value)
        end_ts = Calendar.start_of_day_ts((Calendar.parse_ymd(date_value) + datetime.timedelta(days=1)).isoformat())
    else:
        start_ts = Calendar.timestamp(date_value, start)
        end_ts = Calendar.timestamp(date_value, end)
    next_state["events"].insert(
        0,
        {
            "id": f"test_{len(next_state['events']) + 1}",
            "type": event_type,
            "title": title,
            "description": description,
            "allDay": all_day,
            "startTs": start_ts,
            "endTs": end_ts,
            "reminderMinutesBefore": reminder,
            "alarmEnabled": alarm,
            "calendarAccount": "小米日历",
        },
    )
    next_state["selectedDateTs"] = Calendar.start_of_day_ts(date_value)
    return next_state
