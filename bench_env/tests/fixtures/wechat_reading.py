"""Shared WeChat Reading base-state fixtures (extracted from tests/wechat_reading/test_tasks.py)."""

from __future__ import annotations

import copy
import datetime
import json
import re
from pathlib import Path
from typing import Any

BASE_NOW = datetime.datetime(2026, 1, 27, 12, 0, 0)
TEST_OS_STATE = {"time": {"timestamp": int(BASE_NOW.timestamp() * 1000)}}

_RELATIVE_TIME_RE = re.compile(r"(\d+)([dhm])")


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "apps" / "WechatReading" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_time_like(value: Any) -> datetime.datetime:
    if isinstance(value, datetime.datetime):
        return value
    if not isinstance(value, str):
        raise TypeError(f"Unsupported datetime value: {value!r}")
    if value.startswith("-"):
        delta = datetime.timedelta()
        for amount, unit in _RELATIVE_TIME_RE.findall(value):
            n = int(amount)
            if unit == "d":
                delta += datetime.timedelta(days=n)
            elif unit == "h":
                delta += datetime.timedelta(hours=n)
            elif unit == "m":
                delta += datetime.timedelta(minutes=n)
        return BASE_NOW - delta
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return datetime.datetime.fromisoformat(f"{value}T00:00:00")
    return datetime.datetime.fromisoformat(value)


def _to_iso(dt: datetime.datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _derive_state(state: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(state)

    for item in normalized.get("shelf", []):
        item["addedAt"] = _to_iso(_parse_time_like(item["addedAt"]))

    for progress in normalized.get("bookProgress", {}).values():
        progress["lastReadAt"] = _to_iso(_parse_time_like(progress["lastReadAt"]))

    for record in normalized.get("readingRecords", []):
        dt = _parse_time_like(record["timestamp"])
        record["date"] = dt.date().isoformat()
        record["timestamp"] = _to_iso(dt)

    store_by_id = {str(book["id"]): book for book in normalized.get("store", [])}
    shelf_by_book_id = {str(item["bookId"]): item for item in normalized.get("shelf", [])}
    book_progress = normalized.get("bookProgress", {})
    all_progress_book_ids = [str(book_id) for book_id in book_progress.keys()]

    def _is_finished(book_id: str) -> bool:
        book = store_by_id.get(str(book_id))
        progress = book_progress.get(str(book_id))
        if book is None or progress is None:
            return False
        return int(progress["charOffset"]) >= int(book["totalWords"])

    finished_book_ids = [book_id for book_id in all_progress_book_ids if _is_finished(book_id)]
    reading_book_ids = [book_id for book_id in all_progress_book_ids if not _is_finished(book_id)]
    home_finished_book_ids = [
        book_id
        for book_id in finished_book_ids
        if not (shelf_by_book_id.get(str(book_id)) and shelf_by_book_id[str(book_id)]["isPrivate"] is True)
    ]

    normalized["allProgressBookIds"] = all_progress_book_ids
    normalized["readingBookIds"] = reading_book_ids
    normalized["finishedBookIds"] = finished_book_ids
    normalized["homeFinishedBookIds"] = home_finished_book_ids
    return normalized


DEFAULTS = _load_defaults()
BASE_STATE = _derive_state(DEFAULTS)
