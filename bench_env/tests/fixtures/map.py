"""Shared Map base-state fixtures (extracted from tests/map/test_tasks.py)."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "apps" / "Map" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _base_state() -> dict[str, Any]:
    state = copy.deepcopy(_load_defaults())
    state["currentLocation"] = {"latitude": 39.9042, "longitude": 116.4074}
    state["currentView"] = {
        "searchResults": [],
        "poi": None,
        "route": None,
        "routeModes": {},
        "autocomplete": None,
    }
    return state


DEFAULTS = _load_defaults()
BASE_STATE = _base_state()


def _deep_update(target: dict[str, Any], patch: dict[str, Any]) -> None:
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _deep_update(target[key], value)
        else:
            target[key] = value


def _state(
    *,
    search_results: list[dict[str, Any]] | None = None,
    active_poi: dict[str, Any] | None = None,
    route: dict[str, Any] | None = None,
    route_modes: dict[str, Any] | None = None,
    autocomplete: dict[str, Any] | None = None,
    settings_patch: dict[str, Any] | None = None,
    user_patch: dict[str, Any] | None = None,
) -> dict[str, Any]:
    state = copy.deepcopy(BASE_STATE)
    if search_results is not None:
        state["currentView"]["searchResults"] = copy.deepcopy(search_results)
    if active_poi is not None:
        state["currentView"]["poi"] = copy.deepcopy(active_poi)
    if route is not None:
        state["currentView"]["route"] = copy.deepcopy(route)
    if route_modes is not None:
        state["currentView"]["routeModes"] = copy.deepcopy(route_modes)
    if autocomplete is not None:
        state["currentView"]["autocomplete"] = copy.deepcopy(autocomplete)
    if settings_patch is not None:
        _deep_update(state["settings"], copy.deepcopy(settings_patch))
    if user_patch is not None:
        _deep_update(state["user"], copy.deepcopy(user_patch))
    return state


def _place(
    name: str,
    *,
    address: str,
    rating: float | None = None,
    review_count: int | None = None,
    phone: str | None = None,
    distance: str | None = None,
    distance_meters: int | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "name": name,
        "address": address,
        "formatted_address": address,
    }
    if rating is not None:
        result["rating"] = rating
    if review_count is not None:
        result["user_ratings_total"] = review_count
    if phone is not None:
        result["formatted_phone_number"] = phone
    if distance is not None:
        result["distance"] = distance
    if distance_meters is not None:
        result["distance_meters"] = distance_meters
    return result


NATIONAL_MUSEUM = _place(
    "中国国家博物馆",
    address="北京市东城区东长安街16号",
    rating=4.8,
    review_count=1280,
    phone="010-65116400",
    distance="1.2公里",
    distance_meters=1200,
)


def _with_new_search(state: dict[str, Any], keyword: str = "测试搜索") -> dict[str, Any]:
    """Add a new searchHistory entry so check_searched passes."""
    state = copy.deepcopy(state)
    history = state.setdefault("searchHistory", [])
    history.append({"id": "test_new_search", "kind": "query", "text": keyword})
    return state


MUSEUM_RESULTS = [NATIONAL_MUSEUM]
