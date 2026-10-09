"""Shared Clock base-state fixtures (extracted from tests/clock/test_tasks.py)."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any


def _load_defaults() -> dict[str, Any]:
    """Construct clock state mirroring frontend state-adapter output.

    Production merges the static city catalog into clock state at runtime
    (see system/Clock/state.ts registerStateAdapter). Offline tests bypass
    the browser, so we have to do the same merge here.
    """
    base_dir = Path(__file__).resolve().parents[3] / "system" / "Clock" / "data"
    defaults = json.loads((base_dir / "defaults.json").read_text(encoding="utf-8"))
    cities = json.loads((base_dir / "cities.json").read_text(encoding="utf-8"))
    defaults.setdefault("cities", cities)
    return defaults


DEFAULTS = _load_defaults()


def _with_new_alarm(
    state: dict[str, Any],
    *,
    alarm_id: str,
    hour: int,
    minute: int,
    enabled: bool = False,
    repeat: str = "once",
    note: str | None = None,
    vibrate: bool = True,
    auto_delete: bool = False,
) -> dict[str, Any]:
    next_state = copy.deepcopy(state)
    next_state["alarms"] = [
        {
            "id": alarm_id,
            "hour": hour,
            "minute": minute,
            "enabled": enabled,
            "repeat": repeat,
            "note": note,
            "vibrate": vibrate,
            "autoDelete": auto_delete,
        },
        *next_state["alarms"],
    ]
    return next_state
