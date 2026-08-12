"""Shared Alipay base-state fixtures (extracted from tests/alipay/test_tasks.py)."""

from __future__ import annotations

import copy
import datetime
import json
import re
from pathlib import Path
from typing import Any

BASE_NOW = datetime.datetime(2026, 3, 9, 12, 0, 0)
TEST_OS_STATE = {"time": {"timestamp": int(BASE_NOW.timestamp() * 1000)}}

_RELATIVE_TIME_RE = re.compile(r"(\d+)([dhm])")


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "apps" / "Alipay" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_timestamp(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    if not isinstance(value, str):
        raise TypeError(f"Unsupported timestamp value: {value!r}")
    if value.startswith("-"):
        delta_ms = 0
        for amount, unit in _RELATIVE_TIME_RE.findall(value):
            n = int(amount)
            if unit == "d":
                delta_ms += n * 24 * 60 * 60 * 1000
            elif unit == "h":
                delta_ms += n * 60 * 60 * 1000
            elif unit == "m":
                delta_ms += n * 60 * 1000
        return TEST_OS_STATE["time"]["timestamp"] - delta_ms
    return int(datetime.datetime.strptime(value, "%Y-%m-%d %H:%M:%S").timestamp() * 1000)


def _normalize_alipay_state(state: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(state)
    for record in normalized["transferRecords"]:
        record["timestamp"] = _parse_timestamp(record["timestamp"])
    for item in normalized["notifications"]:
        item["timestamp"] = _parse_timestamp(item["timestamp"])
    for conv in normalized["conversations"]:
        conv["lastTimestamp"] = _parse_timestamp(conv["lastTimestamp"])
        conv["lastReadAt"] = _parse_timestamp(conv["lastReadAt"])
    for messages in normalized["chatHistory"].values():
        for msg in messages:
            msg["timestamp"] = _parse_timestamp(msg["timestamp"])
    return normalized


DEFAULTS = _load_defaults()
BASE_STATE = _normalize_alipay_state(DEFAULTS)
