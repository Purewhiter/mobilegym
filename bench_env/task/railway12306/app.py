"""
Railway12306 app state accessor.
"""

from __future__ import annotations

from collections import defaultdict
import datetime
import functools
import json
from pathlib import Path
import re
from typing import Any, List, Literal, Optional

from bench_env.task.base import BaseApp
from bench_env.task.contacts.app import Contacts
from bench_env.task.utils import sim_datetime, sim_today


QueryPreference = Literal["earliest", "latest", "fastest"]
TripDirection = Literal["from", "to"]
BookingTargetStatus = Literal["bookable", "no_ticket", "not_ready"]

_UINT32_MASK = 0xFFFFFFFF
_PRESALE_DAYS = 15
_CATALOG_PATH = (
    Path(__file__).resolve().parents[3]
    / "apps"
    / "Railway12306"
    / "data"
    / "catalog"
    / "trainCatalog.json"
)
_BOOKABLE_TRIP_CACHE_PATH = (
    Path(__file__).resolve().parents[3]
    / "apps"
    / "Railway12306"
    / "data"
    / ".bench_bookable_trip_cache.json"
)
_BOOKABLE_TRIP_CACHE_SCHEMA_VERSION = 1
_SEAT_TIGHTNESS: dict[str, float] = {
    "businessSeat": 0.55,
    "premiumSeat": 0.50,
    "specialSeat": 0.50,
    "firstClass": 0.35,
    "secondClass": 0.15,
    "softSleeper": 0.45,
    "hardSleeper": 0.35,
    "softSeat": 0.20,
    "hardSeat": 0.18,
    "noSeat": 0.05,
    "motionSleeper": 0.35,
    "highMotionSleeper": 0.40,
    "firstSleeper": 0.40,
    "secondSleeper": 0.30,
    "preferredFirstClass": 0.35,
    "highSoftSleeper": 0.45,
}
_STATION_SALE_TIME: dict[str, str] = {
    "BJP": "14:00", "SHH": "14:00", "GZQ": "13:00", "SZQ": "13:00",
    "HZH": "07:00", "NJH": "14:00", "WHN": "14:00", "CDW": "14:30",
    "CQW": "08:00", "XAY": "15:00", "CSQ": "13:30", "ZZF": "14:00",
    "TJP": "15:30", "JNK": "15:30", "HFH": "15:00", "FZS": "13:30",
    "XMS": "13:30", "QDK": "15:30", "SYT": "16:00", "DLT": "16:00",
    "HBB": "08:00", "KMM": "08:00",
}
_FALLBACK_SALE_TIMES = ["05:00", "08:00", "10:00", "12:30", "14:00", "16:00", "18:00"]
_SEAT_TYPE_TO_KEY = {
    "商务": "businessSeat",
    "一等": "firstClass",
    "二等": "secondClass",
}


def _imul32(a: int, b: int) -> int:
    return ((a & _UINT32_MASK) * (b & _UINT32_MASK)) & _UINT32_MASK


def _fnv1a(text: str) -> int:
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = _imul32(h, 16777619)
    return h & _UINT32_MASK


def _mulberry32(seed: int):
    state = seed & _UINT32_MASK

    def _next() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & _UINT32_MASK
        t = state
        t = _imul32(t ^ (t >> 15), t | 1)
        t ^= (t + _imul32(t ^ (t >> 7), t | 61)) & _UINT32_MASK
        return ((t ^ (t >> 14)) & _UINT32_MASK) / 4294967296

    return _next


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _days_from_today(date_str: str, env_state: dict[str, Any]) -> int:
    try:
        query_date = datetime.date.fromisoformat(str(date_str))
    except ValueError:
        return -999
    today = sim_today(env_state.get("os") or {})
    return (query_date - today).days


def _days_from_sim_today(date_str: str, sim_today_str: str) -> int:
    try:
        query_date = datetime.date.fromisoformat(str(date_str))
        sim_today_date = datetime.date.fromisoformat(str(sim_today_str))
    except ValueError:
        return -999
    return (query_date - sim_today_date).days


def _weekday(date_str: str) -> int:
    return datetime.date.fromisoformat(str(date_str)).weekday()


def _compute_tightness(
    seat_key: str,
    train_code: str,
    days_until: int,
    weekday: int,
) -> float:
    seat_t = _SEAT_TIGHTNESS.get(seat_key, 0.4)
    if days_until == 0:
        day_f = 0.30
    elif days_until <= 3:
        day_f = 0.15
    elif days_until <= 7:
        day_f = 0.05
    else:
        day_f = 0.0
    weekday_factor = {4: 0.15, 5: 0.05, 6: 0.20}.get(weekday, 0.0)
    train_luck = (_fnv1a(train_code) % 40) / 100 - 0.20
    return _clamp(seat_t + day_f + weekday_factor + train_luck, 0.0, 1.0)


def _generate_seat_count(
    base_count: int,
    train_code: str,
    from_code: str,
    to_code: str,
    date_str: str,
    seat_key: str,
    env_state: dict[str, Any],
) -> int:
    sim_today_str = sim_today(env_state.get("os") or {}).isoformat()
    return _generate_seat_count_for_today(
        base_count,
        train_code,
        from_code,
        to_code,
        date_str,
        seat_key,
        sim_today_str,
    )


def _generate_seat_count_for_today(
    base_count: int,
    train_code: str,
    from_code: str,
    to_code: str,
    date_str: str,
    seat_key: str,
    sim_today_str: str,
) -> int:
    days_until = _days_from_sim_today(date_str, sim_today_str)
    if days_until < 0 or days_until > _PRESALE_DAYS:
        return 0

    tightness = _compute_tightness(
        seat_key=seat_key,
        train_code=train_code,
        days_until=days_until,
        weekday=_weekday(date_str),
    )
    seed_key = f"{train_code}|{from_code}|{to_code}|{date_str}|{seat_key}"
    rng = _mulberry32(_fnv1a(seed_key))

    if base_count == 0:
        sold_out_p = _clamp(0.92 + (tightness - 0.5) * 0.2, 0.85, 0.99)
        if rng() < sold_out_p:
            return 0
        return int(1 + rng() * 7)

    if base_count == -1 or base_count >= 3000:
        sold_out_p = tightness * 0.3
        if rng() < sold_out_p:
            return int(1 + rng() * 14)
        return -1

    sold_out_p = _clamp(tightness - 0.5 + (0.1 if base_count < 5 else 0.0), 0.0, 0.6)
    if rng() < sold_out_p:
        return 0

    if base_count <= 4:
        delta = round((rng() - 0.5) * 8)
        return max(1, base_count + delta)

    k = 0.4 + rng() * 1.0
    return max(1, round(base_count * k))


def _is_generated_count_sellable(count: int | None) -> bool:
    return count == -1 or (count is not None and count > 0)


@functools.lru_cache(maxsize=1)
def _load_train_catalog() -> dict[str, Any]:
    return json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))


def _catalog_station_name(code: str) -> str:
    return str(_load_train_catalog()["stationCodeMap"].get(code, code))


def _bookable_trip_cache_context() -> dict[str, int]:
    catalog_stat = _CATALOG_PATH.stat()
    app_stat = Path(__file__).stat()
    return {
        "schema_version": _BOOKABLE_TRIP_CACHE_SCHEMA_VERSION,
        "catalog_mtime_ns": catalog_stat.st_mtime_ns,
        "catalog_size": catalog_stat.st_size,
        "app_mtime_ns": app_stat.st_mtime_ns,
    }


def _bookable_trip_cache_key(
    sim_today_str: str,
    routes: tuple[tuple[str, str], ...],
    date_range_days: tuple[int, int],
    seat_types: tuple[str, ...],
    schedule_prefs: tuple[str, ...],
    only_high_speed: bool,
) -> str:
    return json.dumps(
        {
            "sim_today": sim_today_str,
            "routes": routes,
            "date_range_days": date_range_days,
            "seat_types": seat_types,
            "schedule_prefs": schedule_prefs,
            "only_high_speed": only_high_speed,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )


@functools.lru_cache(maxsize=1)
def _load_bookable_trip_file_cache() -> dict[str, Any]:
    try:
        raw = json.loads(_BOOKABLE_TRIP_CACHE_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"entries": {}}
    except (OSError, json.JSONDecodeError):
        return {"entries": {}}
    if not isinstance(raw, dict):
        return {"entries": {}}
    entries = raw.get("entries")
    if not isinstance(entries, dict):
        return {"entries": {}}
    return {"entries": entries}


def _write_bookable_trip_file_cache(payload: dict[str, Any]) -> None:
    _BOOKABLE_TRIP_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = _BOOKABLE_TRIP_CACHE_PATH.with_suffix(".tmp")
    tmp_path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    tmp_path.replace(_BOOKABLE_TRIP_CACHE_PATH)


def _load_bookable_trip_file_cache_entry(
    sim_today_str: str,
    routes: tuple[tuple[str, str], ...],
    date_range_days: tuple[int, int],
    seat_types: tuple[str, ...],
    schedule_prefs: tuple[str, ...],
    only_high_speed: bool,
) -> tuple[tuple[str, str, str, str, str], ...] | None:
    cache = _load_bookable_trip_file_cache()
    key = _bookable_trip_cache_key(
        sim_today_str,
        routes,
        date_range_days,
        seat_types,
        schedule_prefs,
        only_high_speed,
    )
    entry = cache["entries"].get(key)
    if not isinstance(entry, dict):
        return None
    if entry.get("context") != _bookable_trip_cache_context():
        return None
    candidates = entry.get("candidates")
    if not isinstance(candidates, list):
        return None
    try:
        return tuple(
            tuple(str(part) for part in item)
            for item in candidates
        )
    except TypeError:
        return None


def _store_bookable_trip_file_cache_entry(
    sim_today_str: str,
    routes: tuple[tuple[str, str], ...],
    date_range_days: tuple[int, int],
    seat_types: tuple[str, ...],
    schedule_prefs: tuple[str, ...],
    only_high_speed: bool,
    candidates: tuple[tuple[str, str, str, str, str], ...],
) -> None:
    cache = _load_bookable_trip_file_cache()
    entries = dict(cache.get("entries") or {})
    key = _bookable_trip_cache_key(
        sim_today_str,
        routes,
        date_range_days,
        seat_types,
        schedule_prefs,
        only_high_speed,
    )
    entries[key] = {
        "context": _bookable_trip_cache_context(),
        "candidates": [list(item) for item in candidates],
    }
    _write_bookable_trip_file_cache({"entries": entries})
    _load_bookable_trip_file_cache.cache_clear()


@functools.lru_cache(maxsize=None)
def _catalog_route_candidates(
    from_station: str,
    to_station: str,
    only_high_speed: bool,
) -> tuple[dict[str, Any], ...]:
    catalog = _load_train_catalog()
    candidates: list[dict[str, Any]] = []
    for item in catalog["availability"].values():
        train_code = str(item["trainCode"])
        if only_high_speed and not train_code.upper().startswith("G"):
            continue
        actual_from = _catalog_station_name(str(item["fromCode"]))
        actual_to = _catalog_station_name(str(item["toCode"]))
        if not Railway12306._station_matches(from_station, actual_from):
            continue
        if not Railway12306._station_matches(to_station, actual_to):
            continue
        candidates.append({
            "trainCode": train_code,
            "fromCode": str(item["fromCode"]),
            "toCode": str(item["toCode"]),
            "fromStation": actual_from,
            "toStation": actual_to,
            "startTime": str(item["startTime"]),
            "arriveTime": str(item["arriveTime"]),
            "lishi": str(item["lishi"]),
            "availability": dict(item.get("availability") or {}),
        })
    return tuple(candidates)


@functools.lru_cache(maxsize=None)
def _catalog_available_trains(
    sim_today_str: str,
    from_station: str,
    to_station: str,
    date: str,
    only_high_speed: bool,
) -> tuple[dict[str, Any], ...]:
    available_trains: list[dict[str, Any]] = []
    for item in _catalog_route_candidates(from_station, to_station, only_high_speed):
        generated: dict[str, int] = {}
        for seat_key, base_count in (item.get("availability") or {}).items():
            generated[str(seat_key)] = _generate_seat_count_for_today(
                int(base_count),
                str(item["trainCode"]),
                str(item["fromCode"]),
                str(item["toCode"]),
                date,
                str(seat_key),
                sim_today_str,
            )
        if not any(_is_generated_count_sellable(count) for count in generated.values()):
            continue
        available_trains.append({**item, "generatedAvailability": generated})
    return tuple(available_trains)


@functools.lru_cache(maxsize=None)
def _list_bookable_trips_cached(
    sim_today_str: str,
    routes: tuple[tuple[str, str], ...],
    date_range_days: tuple[int, int],
    seat_types: tuple[str, ...],
    schedule_prefs: tuple[str, ...],
    only_high_speed: bool,
) -> tuple[tuple[str, str, str, str, str], ...]:
    cached = _load_bookable_trip_file_cache_entry(
        sim_today_str,
        routes,
        date_range_days,
        seat_types,
        schedule_prefs,
        only_high_speed,
    )
    if cached is not None:
        return cached

    sim_today_date = datetime.date.fromisoformat(sim_today_str)
    start_day, end_day = date_range_days
    candidates: list[tuple[str, str, str, str, str]] = []

    for from_station, to_station in routes:
        for offset in range(start_day, end_day + 1):
            date = (sim_today_date + datetime.timedelta(days=offset)).isoformat()
            available_trains = list(_catalog_available_trains(
                sim_today_str,
                from_station,
                to_station,
                date,
                only_high_speed,
            ))
            if not available_trains:
                continue
            for schedule_pref in schedule_prefs:
                target_train = Railway12306._pick_catalog_train(available_trains, schedule_pref)
                if target_train is None:
                    continue
                generated = target_train.get("generatedAvailability") or {}
                for seat_type in seat_types:
                    seat_key = _SEAT_TYPE_TO_KEY.get(seat_type)
                    if seat_key is None:
                        continue
                    if _is_generated_count_sellable(generated.get(seat_key)):
                        candidates.append((
                            from_station,
                            to_station,
                            date,
                            schedule_pref,
                            seat_type,
                        ))
    result = tuple(candidates)
    _store_bookable_trip_file_cache_entry(
        sim_today_str,
        routes,
        date_range_days,
        seat_types,
        schedule_prefs,
        only_high_speed,
        result,
    )
    return result

# ── Shared parameter specs (used by multiple tasks) ────────────────
# values dict: {display_text: internal_value}

SCHEDULE_PREF_PARAM: dict[str, Any] = {
    "type": "enum",
    "values": {"最早": "earliest", "最晚": "latest"},
    "default": "earliest",
    "description": "班次偏好",
}

SEAT_TYPE_PARAM: dict[str, Any] = {
    "type": "enum",
    "values": {"商务座": "商务", "一等座": "一等", "二等座": "二等"},
    "default": "二等",
    "description": "席别",
}

HOT_ROUTE_CHOICES = [
    ("上海", "南京"),
    ("南京", "上海"),
    ("北京", "上海"),
    ("广州", "深圳"),
    ("杭州东", "上海虹桥"),
]

G_PREFIX_DISTRACTOR_ROUTE_CHOICES = [
    ("广州", "深圳"),   # C6751/C7001/C7005... + D7577 < G6501，最强 C 干扰
    ("天津", "北京"),   # D/K/Z + C2602/C2604/C2606 < G8852，有 C 干扰
    ("成都", "合肥"),   # 9 趟 D < G1888
    ("广州", "昆明"),   # 8 趟 D < G2966
    ("南京", "上海"),   # D + K/Z/数字混杂 < G7029
]

NEW_PASSENGER_PROFILES = [
    {"name": "周若涵", "id_no": "320106199612183428", "phone": "13912345678"},
    {"name": "陈景然", "id_no": "110101199904261713", "phone": "13712345678"},
    {"name": "林知远", "id_no": "440106199808073516", "phone": "13612345678"},
]

RAIL_QUERY_CHANGES = [
    "railway12306.searchForm",
    "railway12306.searchHistory",
    "railway12306.lastQuerySummary",
    "railway12306.queryState",
    "railway12306.stationSelectTarget",
    "railway12306.directTrains",
    "railway12306.from",
    "railway12306.to",
    "railway12306.date",
]
RAIL_BOOKING_CHANGES = RAIL_QUERY_CHANGES + [
    "railway12306.selectedTrain",
    "railway12306.lastPickedTrain",
    "railway12306.orders",
]


class Railway12306(BaseApp):
    """
    Railway12306 app state accessor.
    Wraps the raw state dictionary from the Railway12306 app context.
    """

    G_PREFIX_DISTRACTOR_ROUTE_CHOICES = G_PREFIX_DISTRACTOR_ROUTE_CHOICES

    # =========================================================================
    # Generic helpers
    # =========================================================================

    @staticmethod
    def _norm_text(value: str) -> str:
        text = value.strip().lower()
        text = re.sub(r"\s+", "", text)
        return text.replace("－", "-").replace("—", "-").replace("–", "-")

    @staticmethod
    def parse_hhmm(value: str) -> int:
        matched = re.fullmatch(r"(\d{1,2}):(\d{2})", value.strip())
        if not matched:
            raise ValueError(f"Invalid HH:MM format: {value!r}")
        hour = int(matched.group(1))
        minute = int(matched.group(2))
        # Allow 24:00 as a special boundary representing midnight (end of day).
        if hour == 24 and minute == 0:
            return 24 * 60
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError(f"Invalid time: {value!r}")
        return hour * 60 + minute

    @staticmethod
    def parse_duration_minutes(value: str) -> int:
        text = value.strip()
        hour_match = re.search(r"(\d+)\s*小时", text)
        minute_match = re.search(r"(\d+)\s*分", text)
        if not hour_match and not minute_match:
            raise ValueError(f"Invalid duration format: {value!r}")
        hours = int(hour_match.group(1)) if hour_match else 0
        minutes = int(minute_match.group(1)) if minute_match else 0
        return hours * 60 + minutes

    @staticmethod
    def extract_train_no(text: str) -> str:
        """Extract train number from text. Returns empty string if not found
        (expected when parsing Agent answers that may not contain a train number).
        """
        matched = re.search(r"([GDKTZC])\s*(\d{1,5})", text, flags=re.IGNORECASE)
        if not matched:
            return ""
        return f"{matched.group(1).upper()}{matched.group(2)}"

    @classmethod
    def _station_matches(cls, query: str, actual: str) -> bool:
        """站名匹配：城市名模糊匹配，具体站名精确匹配。

        - query="杭州", actual="杭州东"   → True  （城市级匹配）
        - query="上海", actual="上海松江" → True  （城市级匹配，区县站名）
        - query="杭州东", actual="杭州东" → True  （精确匹配）
        - query="杭州东", actual="杭州南" → False （具体站名不同）
        - query="杭州", actual="杭州"    → True
        """
        norm = cls._norm_text
        if norm(query) == norm(actual):
            return True
        query_city = cls._station_to_city(query)
        if norm(query) != norm(query_city):
            return False
        return actual.strip().startswith(query_city)

    @staticmethod
    def is_high_speed_train(train: dict[str, Any]) -> bool:
        """高铁 = G 字头。D（动车）和 C（城际）不算高铁。"""
        return str(train["trainType"]).upper() == "G"

    @staticmethod
    def sample_route_pair(env_state: dict[str, Any], rng) -> dict[str, str]:
        from_station, to_station = rng.choice(HOT_ROUTE_CHOICES)
        return {"from_station": from_station, "to_station": to_station}

    @staticmethod
    def sample_g_prefix_distractor_route(env_state: dict[str, Any], rng) -> dict[str, str]:
        from_city, to_city = rng.choice(G_PREFIX_DISTRACTOR_ROUTE_CHOICES)
        return {"from_city": from_city, "to_city": to_city}

    @staticmethod
    def _catalog_generated_seats(
        item: dict[str, Any],
        *,
        date: str,
        env_state: dict[str, Any],
    ) -> dict[str, int]:
        sim_today_str = sim_today(env_state.get("os") or {}).isoformat()
        generated: dict[str, int] = {}
        for seat_key, base_count in (item.get("availability") or {}).items():
            generated[seat_key] = _generate_seat_count_for_today(
                int(base_count),
                str(item["trainCode"]),
                str(item["fromCode"]),
                str(item["toCode"]),
                date,
                str(seat_key),
                sim_today_str,
            )
        return generated

    @staticmethod
    def _pick_catalog_train(
        trains: list[dict[str, Any]],
        preference: str,
    ) -> dict[str, Any] | None:
        if not trains:
            return None

        def _earliest_key(train: dict[str, Any]) -> tuple[int, str]:
            return (Railway12306.parse_hhmm(str(train["startTime"])), str(train["trainCode"]))

        def _latest_key(train: dict[str, Any]) -> tuple[int, str]:
            return (-Railway12306.parse_hhmm(str(train["startTime"])), str(train["trainCode"]))

        def _fastest_key(train: dict[str, Any]) -> tuple[int, int, str]:
            return (
                Railway12306.parse_duration_minutes(str(train["lishi"])),
                Railway12306.parse_hhmm(str(train["startTime"])),
                str(train["trainCode"]),
            )

        if preference == "earliest":
            return min(trains, key=_earliest_key)
        if preference == "latest":
            return min(trains, key=_latest_key)
        if preference == "fastest":
            return min(trains, key=_fastest_key)
        raise ValueError(f"Unknown preference: {preference!r}")

    @staticmethod
    def list_bookable_trips(
        env_state: dict[str, Any], *,
        routes: list[tuple[str, str]],
        date_range_days: tuple[int, int],
        seat_types: list[str],
        schedule_prefs: list[str],
        only_high_speed: bool = True,
    ) -> list[dict[str, str]]:
        """枚举在 catalog+PRNG 下可成功购票的参数组合。"""
        sim_today_str = sim_today(env_state.get("os") or {}).isoformat()
        cached = _list_bookable_trips_cached(
            sim_today_str,
            tuple(routes),
            date_range_days,
            tuple(seat_types),
            tuple(schedule_prefs),
            only_high_speed,
        )
        return [
            {
                "from_station": from_station,
                "to_station": to_station,
                "date": date,
                "schedule_pref": schedule_pref,
                "seat_type": seat_type,
            }
            for from_station, to_station, date, schedule_pref, seat_type in cached
        ]

    @staticmethod
    def is_trip_bookable(
        env_state: dict[str, Any],
        from_station: str,
        to_station: str,
        date: str,
        schedule_pref: str,
        seat_type: str,
        *,
        only_high_speed: bool = True,
    ) -> bool:
        """判定给定路线/日期/偏好/席别是否必然存在可下单目标车次。"""
        seat_key = _SEAT_TYPE_TO_KEY.get(seat_type)
        if seat_key is None:
            return False

        sim_today_str = sim_today(env_state.get("os") or {}).isoformat()
        available_trains = list(_catalog_available_trains(
            sim_today_str,
            from_station,
            to_station,
            date,
            only_high_speed,
        ))

        target_train = Railway12306._pick_catalog_train(
            available_trains,
            schedule_pref,
        )
        if target_train is None:
            return False
        return _is_generated_count_sellable(
            (target_train.get("generatedAvailability") or {}).get(seat_key)
        )

    @staticmethod
    def sample_bookable_trip(env_state: dict[str, Any], rng) -> dict[str, str]:
        candidates = Railway12306.list_bookable_trips(
            env_state,
            routes=HOT_ROUTE_CHOICES,
            date_range_days=(1, 14),
            seat_types=["商务", "一等", "二等"],
            schedule_prefs=["earliest", "latest"],
            only_high_speed=True,
        )
        if not candidates:
            raise RuntimeError("No bookable trip in HOT_ROUTE_CHOICES × 14 days")
        return rng.choice(candidates)

    @staticmethod
    def sample_my_ticket_date(env_state: dict[str, Any], rng) -> str:
        rail = Railway12306(env_state["apps"]["railway12306"])
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for ticket in rail.my_tickets():
            grouped[ticket["date"]].append(ticket)
        unique_dates = [date for date, tickets in grouped.items() if len(tickets) == 1]
        all_dates = list(grouped.keys())
        candidates = sorted(unique_dates, reverse=True) or sorted(all_dates, reverse=True)
        return rng.choice(candidates)

    @staticmethod
    def sample_future_travel_date(env_state: dict[str, Any], rng) -> str:
        """Sample a future travel date that is likely to be queryable in the app.

        We intentionally sample a wider window than the generic 1-14 days sampler,
        because some tasks use explicit dates like "4月1号" and the simulator
        is not restricted to a 14-day sale window (mock fallback works for any date).
        """
        base = sim_today((env_state.get("os") or {}))
        offset = rng.choice(range(1, 31))  # next 1-30 days
        return (base + datetime.timedelta(days=offset)).isoformat()

    @staticmethod
    def sample_passenger_pair(env_state: dict[str, Any], rng) -> dict[str, str]:
        rail = Railway12306(env_state["apps"]["railway12306"])
        picked = rng.sample(rail.passenger_names, 2)
        return {"name": picked[0], "name2": picked[1]}

    @staticmethod
    def sample_new_passenger_profile(env_state: dict[str, Any], rng) -> dict[str, str]:
        picked = rng.choice(NEW_PASSENGER_PROFILES)
        return {"name": picked["name"], "id_no": picked["id_no"], "phone": picked["phone"]}

    # =========================================================================
    # User / account
    # =========================================================================

    @property
    def user(self) -> dict[str, Any]:
        return self.get("user")

    @property
    def user_name(self) -> str:
        return self.user["name"]

    @property
    def account(self) -> dict[str, Any]:
        return self.get("account")

    @property
    def auth(self) -> dict[str, Any]:
        return self.get("auth")

    @property
    def login_user(self) -> dict[str, Any] | None:
        return self.get("loginUser")

    @property
    def is_logged_in(self) -> bool:
        return bool(self.get("isLoggedIn"))

    @property
    def account_username(self) -> str:
        personal = self.account["personalInfo"]
        return personal["username"].strip()

    def account_by_phone(self, phone: str) -> dict[str, Any] | None:
        target = str(phone)
        for account in self.auth["accounts"]:
            if str(account["phone"]) == target:
                return account
        return None

    def account_by_username(self, username: str) -> dict[str, Any] | None:
        target = str(username)
        for account in self.auth["accounts"]:
            if str(account["username"]) == target:
                return account
        return None

    @staticmethod
    def mask_name(raw: str) -> str:
        """12306 注册后姓名脱敏：保留首字 + '**'。"""
        s = re.sub(r"\s+", "", str(raw).strip())
        if len(s) <= 1:
            return f"{s}**" if s else ""
        return f"{s[:1]}**"

    @staticmethod
    def mask_phone(raw: str) -> str:
        """12306 注册后手机号脱敏：前3后4，中间 ****。"""
        digits = re.sub(r"\D+", "", str(raw))
        if len(digits) < 7:
            return digits
        return f"{digits[:3]}****{digits[-4:]}"

    @property
    def real_name_verified(self) -> bool:
        return bool(self.user["realNameVerified"])

    # =========================================================================
    # Search / query
    # =========================================================================

    @property
    def search_form(self) -> dict[str, Any]:
        return self.get("searchForm")

    @property
    def from_station(self) -> str:
        return self.search_form["from"]

    @property
    def to_station(self) -> str:
        return self.search_form["to"]

    @property
    def last_query_summary(self) -> dict[str, Any]:
        return self.get("lastQuerySummary")

    @classmethod
    def _search_station_matches(cls, expected: str, actual: str) -> bool:
        """Search-form station matching with city-level tolerance.

        This is stricter than generic route matching:
        - "南京"    vs "南京南"  -> True
        - "南京南"  vs "南京"    -> True
        - "南京南"  vs "南京西"  -> False
        """
        norm = cls._norm_text
        if norm(expected) == norm(actual):
            return True

        expected_city = cls._station_to_city(expected)
        actual_city = cls._station_to_city(actual)
        if norm(expected_city) != norm(actual_city):
            return False

        expected_is_city = norm(expected) == norm(expected_city)
        actual_is_city = norm(actual) == norm(actual_city)
        return expected_is_city or actual_is_city

    def has_searched(
        self,
        *,
        from_station: str | None = None,
        to_station: str | None = None,
        date: str | None = None,
    ) -> bool:
        """Agent 在本次任务中是否执行过车次查询。

        When route/date parameters are provided, the latest query must also
        match that search context. Station matching allows city-level searches
        to satisfy specific-station requests (e.g. task="南京南", searched="南京").
        """
        current = self.last_query_summary
        if not current:
            return False
        init = self.init.last_query_summary if self.init else None
        if not init:
            searched = True
        else:
            searched = current != init
        if not searched:
            return False

        if from_station is not None and not self._search_station_matches(
            from_station, str(current["from"])
        ):
            return False
        if to_station is not None and not self._search_station_matches(
            to_station, str(current["to"])
        ):
            return False
        if date is not None and str(current["date"]) != date:
            return False
        return True

    def check_searched(
        self,
        *,
        from_station: str,
        to_station: str,
        date: str,
        field: str = "query.searched",
    ) -> dict[str, Any]:
        """验证 Agent 是否查询了目标路线/日期。"""
        searched = self.has_searched(
            from_station=from_station, to_station=to_station, date=date,
        )
        expected = f"{from_station}→{to_station} {date}"
        return {
            "field": field,
            "expected": expected,
            "actual": expected if searched else "未查询目标路线/日期",
            "passed": searched,
        }

    @property
    def query_state(self) -> dict[str, Any]:
        return self.get("queryState")

    @property
    def direct_trains(self) -> List[dict[str, Any]]:
        return self.query_state["directTrains"]

    def pick_trains(
        self,
        preference: QueryPreference,
        *,
        only_high_speed: bool = False,
    ) -> list[dict[str, Any]]:
        """返回按 preference 并列最优的所有车次。

        - earliest / latest：按发车时刻
        - fastest：按历时

        并列车次全部返回（可能 1 个或多个），供判定层用
        ``build_best_match_answer_checks`` 接受任一并列答案。
        """
        trains = self.direct_trains
        if only_high_speed:
            trains = [t for t in trains if self.is_high_speed_train(t)]
        assert trains, (
            f"Task bug: no trains to pick from (preference={preference!r}, "
            f"only_high_speed={only_high_speed}); 任务参数采样不应出现无候选车次的路线"
        )

        def key_of(t: dict[str, Any]) -> int:
            if preference == "earliest":
                return self.parse_hhmm(t["departTime"])
            if preference == "latest":
                return -self.parse_hhmm(t["departTime"])
            if preference == "fastest":
                return self.parse_duration_minutes(t["duration"])
            raise ValueError(f"Unknown preference: {preference!r}")

        best = min(key_of(t) for t in trains)
        return [t for t in trains if key_of(t) == best]

    def nearest_departing_train(self, current_ms: int) -> dict[str, Any]:
        current_dt = sim_datetime({"time": current_ms})
        current_minutes = current_dt.hour * 60 + current_dt.minute
        trains = sorted(
            self.direct_trains,
            key=lambda train: (self.parse_hhmm(train["departTime"]), train["trainNo"]),
        )
        future_trains = [
            train for train in trains if self.parse_hhmm(train["departTime"]) >= current_minutes
        ]
        if future_trains:
            return future_trains[0]
        if trains:
            return trains[0]
        raise ValueError("No direct trains found in query state")

    def trains_for_route(
        self,
        from_station: str,
        to_station: str,
        *,
        only_high_speed: bool = False,
    ) -> list[dict[str, Any]]:
        """直达车次中按路线过滤的结果（城市级模糊匹配）。

        - "杭州" 匹配 "杭州东"（城市级）
        - "杭州东" 不匹配 "杭州南"（具体站名要精确）
        """
        trains = [
            t for t in self.direct_trains
            if self._station_matches(from_station, str(t.get("fromStation", "")))
            and self._station_matches(to_station, str(t.get("toStation", "")))
        ]
        if only_high_speed:
            trains = [t for t in trains if self.is_high_speed_train(t)]
        return trains

    @staticmethod
    def has_sellable_seat(
        train: dict[str, Any],
        seat_type: str | None = None,
    ) -> bool:
        """车次是否有可售席别（候补不算）。

        - ``seat_type=None``：只要任一席别可售即为 True（用于"整列售罄"过滤）
        - 传入 ``seat_type``：指定席别有票才为 True

        余票 ``count`` 字段编码（来自前端 SeatInfo，上游有多套来源）：
          - ``None``  → JS 侧 ``Infinity`` 经 JSON 序列化后的形式，表示余票充足
          - 正数      → 精确余票
          - ``0``     → 售罄（前端可能同时置 ``canWaitlist=true`` 表示可候补，此处一律不算可售）
          - ``-1``    → 候补（trainService fallback 路径遗留编码，同样不算可售）
        """
        for seat in train.get("seats") or []:
            if seat_type is not None and str(seat.get("type")) != seat_type:
                continue
            count = seat.get("count")
            if count is None or count > 0:
                return True
        return False

    def pick_train_for_route_strict(
        self,
        preference: QueryPreference,
        *,
        from_station: str,
        to_station: str,
        only_high_speed: bool = False,
    ) -> Optional[dict[str, Any]]:
        """按路线过滤 + 排除整列售罄后，按 preference 挑一个车次。

        Returns None when no trains match (route/high-speed filter 过滤后为空，
        或整列售罄后为空)。调用方可用 has_searched() 区分"没查"和"查了但无匹配"。
        """
        trains = [
            t for t in self.trains_for_route(
                from_station, to_station, only_high_speed=only_high_speed,
            )
            if self.has_sellable_seat(t)
        ]
        if not trains:
            return None

        def _earliest_key(train: dict[str, Any]) -> tuple[int, str]:
            return (self.parse_hhmm(train["departTime"]), train["trainNo"])

        def _latest_key(train: dict[str, Any]) -> tuple[int, str]:
            return (-self.parse_hhmm(train["departTime"]), train["trainNo"])

        def _fastest_key(train: dict[str, Any]) -> tuple[int, int, str]:
            return (
                self.parse_duration_minutes(train["duration"]),
                self.parse_hhmm(train["departTime"]),
                train["trainNo"],
            )

        if preference == "earliest":
            return min(trains, key=_earliest_key)
        if preference == "latest":
            return min(trains, key=_latest_key)
        if preference == "fastest":
            return min(trains, key=_fastest_key)
        raise ValueError(f"Unknown preference: {preference!r}")

    @staticmethod
    def train_seat_price(train: dict[str, Any], seat_type: str) -> float:
        """获取车次指定席别（如 ``二等``）的票价。缺失时抛错。"""
        target = str(seat_type).strip()
        for seat in train.get("seats") or []:
            if str(seat.get("type") or "").strip() == target:
                price = seat.get("price")
                if price is None:
                    break
                return float(price)
        raise ValueError(f"train {train.get('trainNo')} has no seat priced for {seat_type!r}")

    def earliest_high_speed_train(
        self,
        from_station: str,
        to_station: str,
        *,
        require_sellable: bool = False,
    ) -> dict[str, Any] | None:
        """direct_trains 中同路线最早 G 字头车次；可选过滤"有任意可售席别"。"""
        trains = self.trains_for_route(from_station, to_station, only_high_speed=True)
        if require_sellable:
            trains = [t for t in trains if self.has_sellable_seat(t)]
        if not trains:
            return None
        return min(
            trains,
            key=lambda t: (self.parse_hhmm(t["departTime"]), str(t["trainNo"])),
        )

    def cheapest_high_speed_seat_price(
        self,
        from_station: str,
        to_station: str,
        date: str,
    ) -> float | None:
        """返回指定路线/日期下可售高铁座位中的最低票价。"""
        summary = self.last_query_summary or {}
        if str(summary.get("date") or "") != str(date):
            return None
        trains = self.trains_for_route(from_station, to_station)
        prices = [
            float(seat["price"])
            for train in trains
            if self.is_high_speed_train(train)
            for seat in (train.get("seats") or [])
            if float(seat.get("price") or 0) > 0
            and (seat.get("count") is None or seat.get("count") > 0)
        ]
        if not prices:
            return None
        return min(prices)

    def inspect_booking_target(
        self,
        *,
        from_station: str,
        to_station: str,
        date: str,
        schedule_pref: QueryPreference,
        seat_type: str,
        only_high_speed: bool = True,
    ) -> tuple[BookingTargetStatus, Optional[dict[str, Any]]]:
        """Summarize booking availability for a task target.

        Returns:
        - "bookable": target query was searched and target seat has sellable tickets
        - "no_ticket": target query was searched but no matching sellable ticket exists
        - "not_ready": current query context cannot be trusted for no-ticket judgment
        """
        if not self.has_searched(
            from_station=from_station, to_station=to_station, date=date,
        ):
            return "not_ready", None

        target_train = self.pick_train_for_route_strict(
            schedule_pref,
            from_station=from_station,
            to_station=to_station,
            only_high_speed=only_high_speed,
        )
        if target_train is None:
            return "no_ticket", None

        if self.has_sellable_seat(target_train, seat_type=seat_type):
            return "bookable", target_train
        return "no_ticket", target_train

    def inspect_any_booking_target(
        self,
        *,
        from_station: str,
        to_station: str,
        date: str,
    ) -> BookingTargetStatus:
        """Check if ANY ticket is available (no train-type/seat/preference filter).

        Unlike inspect_booking_target, this does not filter by high-speed,
        schedule preference, or seat type — suitable for tasks like
        "buy any return ticket".
        """
        if not self.has_searched(
            from_station=from_station, to_station=to_station, date=date,
        ):
            return "not_ready"

        trains = self.trains_for_route(from_station, to_station)
        if not trains:
            return "no_ticket"
        if any(self.has_sellable_seat(t) for t in trains):
            return "bookable"
        return "no_ticket"

    # =========================================================================
    # Orders
    # =========================================================================

    @property
    def orders(self) -> List[dict[str, Any]]:
        return self.get_list("orders")

    @property
    def order_ids(self) -> List[str]:
        return [order["id"] for order in self.orders]

    def flat_tickets(self) -> List[dict[str, Any]]:
        """Flatten orders into per-ticket dicts with order-level fields merged in.

        Each returned dict has all OrderRecord fields (id, trainNo, fromStation,
        toStation, departTime, arriveTime, date, status, createTime) plus the
        TicketInfo fields (passengerName, ticketType, seatType, seatNo, price).
        """
        result: List[dict[str, Any]] = []
        for order in self.orders:
            base = {k: v for k, v in order.items() if k != "tickets"}
            for ticket in order["tickets"]:
                result.append({**base, **ticket})
        return result

    def my_tickets(self) -> List[dict[str, Any]]:
        """Return flat tickets belonging to the logged-in user, latest first."""
        name = self.user_name
        norm = self._norm_text
        tickets = [t for t in self.flat_tickets() if norm(t["passengerName"]) == norm(name)]
        tickets.sort(key=lambda t: (t["createTime"], t["id"]), reverse=True)
        return tickets

    @property
    def my_latest_ticket(self) -> dict[str, Any]:
        return self.my_tickets()[0]

    def my_tickets_on_date(self, date: str) -> List[dict[str, Any]]:
        """Return flat tickets belonging to the logged-in user on a specific date."""
        return [t for t in self.my_tickets() if t["date"] == date]

    def unique_trip_cities(self, direction: TripDirection) -> List[str]:
        field = "fromStation" if direction == "from" else "toStation"
        cities: List[str] = []
        seen: set[str] = set()
        for order in self.orders:
            city = self._station_to_city(str(order[field]))
            key = self._norm_text(city)
            if key not in seen:
                seen.add(key)
                cities.append(city)
        return cities

    @staticmethod
    def _station_to_city(station: str) -> str:
        """Convert station-like names to city-only names.

        Examples:
        - "上海虹桥" -> "上海"
        - "南京南" -> "南京"
        - "杭州东" -> "杭州"
        - "苏州站" -> "苏州"
        """
        s = str(station or "").strip()
        if not s:
            return s

        # Remove common trailing tokens. Iterate because some names may contain multiple
        # (e.g. "南京南站" → "南京南" → "南京"). Guard: Chinese city names are at least
        # 2 chars, so stop when remainder would be shorter — prevents stripping the
        # trailing char of cities like 济南, 海东, 云南, 淮南, 山南.
        suffixes = ("站", "东", "西", "南", "北", "虹桥")
        changed = True
        while changed:
            changed = False
            for suf in suffixes:
                if s.endswith(suf) and len(s) - len(suf) >= 2:
                    s = s[: -len(suf)]
                    changed = True
                    break
        return s.strip()

    def new_orders(self) -> List[dict[str, Any]]:
        init_ids = set(self.init.order_ids)
        return [order for order in self.orders if order["id"] not in init_ids]

    def new_pending_orders(self) -> List[dict[str, Any]]:
        return [o for o in self.new_orders() if o["status"] == "pending"]

    def find_new_pending_order(
        self,
        from_station: str,
        to_station: str,
        date: str,
        passenger_names: List[str],
        seat_type: str | None = None,
        train_no: str | None = None,
    ) -> Optional[dict[str, Any]]:
        target_names = sorted(passenger_names)
        norm = self._norm_text

        for order in self.new_orders():
            if order["status"] != "pending":
                continue
            if not self._station_matches(from_station, order["fromStation"]):
                continue
            if not self._station_matches(to_station, order["toStation"]):
                continue
            if order["date"] != date:
                continue
            if train_no and order["trainNo"] != train_no:
                continue
            tickets = order["tickets"]
            if len(tickets) != len(target_names):
                continue
            ticket_names = sorted(ticket["passengerName"] for ticket in tickets)
            if ticket_names != target_names:
                continue
            if seat_type and any(ticket["seatType"] != seat_type for ticket in tickets):
                continue
            return order
        return None

    # =========================================================================
    # Passengers
    # =========================================================================

    @property
    def passengers(self) -> List[dict[str, Any]]:
        return self.get_list("passengers")

    @property
    def passenger_names(self) -> List[str]:
        return [passenger["name"] for passenger in self.passengers]

    def get_default_passenger(self) -> dict[str, Any]:
        for passenger in self.passengers:
            if passenger["isDefault"]:
                return passenger
        raise ValueError("No default passenger")

    def new_passengers(self) -> List[dict[str, Any]]:
        init_keys = {
            (passenger["name"], passenger["idNo"])
            for passenger in self.init.passengers
        }
        return [
            passenger for passenger in self.passengers
            if (passenger["name"], passenger["idNo"]) not in init_keys
        ]

    # =========================================================================
    # Passenger checks / Settings / identity / invoice
    # =========================================================================

    def check_new_passenger(
        self,
        *,
        name: str,
        id_no: str,
        phone: str,
        field: str = "newPassenger.exists",
        ) -> dict[str, Any]:
        """检测是否新增了指定乘车人，且身份证与手机号匹配。"""
        # Sampler 契约：目标乘车人不应已存在于 init，否则 new_passengers() 会过滤掉
        # 导致 passed=False 冤枉 Agent。
        assert not any(
            p["name"] == name and p["idNo"] == id_no for p in self.init.passengers
        ), f"Sampler bug: passenger name={name!r} idNo={id_no!r} already exists in init"
        passenger = next(
            (
                item
                for item in self.new_passengers()
                if item["name"] == name
            ),
            None,
        )
        expected_phone = Contacts.normalize_phone(phone)
        actual_phone = (
            Contacts.normalize_phone(str(passenger.get("phone") or ""))
            if passenger is not None
            else ""
        )
        return {
            "field": field,
            "expected": f"{name} (身份证: {id_no}, 手机: {phone})",
            "actual": (
                f"{passenger['name']} (身份证: {passenger['idNo']}, 手机: {passenger['phone']})"
                if passenger else "未添加新乘车人"
            ),
            "passed": passenger is not None
            and passenger["idNo"] == id_no
            and actual_phone == expected_phone,
        }

    # =========================================================================
    # Settings / identity / invoice
    # =========================================================================

    @property
    def settings(self) -> dict[str, Any]:
        return self.get("settings")

    @property
    def font_size(self) -> str:
        return self.settings["fontSize"]

    @property
    def high_contrast(self) -> bool:
        return self.settings["highContrast"]

    @property
    def invoice_headers(self) -> List[dict[str, Any]]:
        return self.get_list("invoiceHeaders")

    @property
    def invoice_email(self) -> str:
        return self.get("invoiceEmail")

    @property
    def student_verify(self) -> dict[str, Any]:
        return self.get("studentVerify")

    # =========================================================================
    # Account checks (for task judge)
    # =========================================================================

    def check_login_success(
        self, username: str, *, field: str = "login.success",
    ) -> dict[str, Any]:
        """验证是否以指定用户名登录成功。"""
        user = self.login_user
        logged_user = str(user["username"]) if user else "(未登录)"
        passed = self.is_logged_in and user is not None and logged_user == str(username)
        return {
            "field": field,
            "expected": f"已登录 user={username}",
            "actual": f"loggedIn={self.is_logged_in}, user={logged_user}",
            "passed": passed,
        }

    def check_password_changed(
        self, new_password: str, *, field: str = "password.changed",
    ) -> dict[str, Any]:
        """验证 loginUser 和 auth.accounts 中的密码均已更新。"""
        user = self.login_user
        curr_pwd = str(user["password"]) if user else "(未登录)"
        username = str(user["username"]) if user else ""
        acc = self.account_by_username(username) if username else None
        acc_pwd = str(acc["password"]) if acc else "(无账号)"
        user_ok = user is not None and curr_pwd == str(new_password)
        acc_ok = acc is not None and acc_pwd == str(new_password)
        return {
            "field": field,
            "expected": f"密码={new_password} (loginUser + accounts 同步)",
            "actual": f"loginUser.pwd={curr_pwd}, accounts.pwd={acc_pwd}",
            "passed": user_ok and acc_ok,
        }

    def check_registration(
        self, *, username: str, password: str, name: str, phone: str,
        field: str = "registration",
    ) -> dict[str, Any]:
        """验证注册是否成功：账号存在、密码正确、已登录、profile 匹配。"""
        acc = self.account_by_username(username)
        user = self.login_user
        profile = self.user
        masked_name = self.mask_name(name)
        masked_phone = self.mask_phone(phone)

        acc_ok = acc is not None and str(acc["password"]) == str(password)
        login_ok = (
            self.is_logged_in
            and user is not None
            and str(user["username"]) == str(username)
        )
        name_ok = str(profile["name"]) == masked_name
        phone_ok = str(profile["phone"]) == masked_phone

        expected = f"注册 {username} (pwd={password}, name={masked_name}, phone={masked_phone})"
        if not acc_ok:
            actual = f"账号 {username} 未创建或密码不匹配"
        elif not login_ok:
            actual = f"账号已创建但未登录 (loggedIn={self.is_logged_in})"
        else:
            actual = f"已登录 {username}, name={profile['name']}, phone={profile['phone']}"
        passed = acc_ok and login_ok and name_ok and phone_ok
        return {
            "field": field, "expected": expected,
            "actual": actual, "passed": passed,
        }

    # =========================================================================
    # Order checks (for task judge)
    # =========================================================================

    NO_TICKET_REPLY = "没有符合条件的票"

    @staticmethod
    def describe_order(order: dict[str, Any]) -> str:
        tickets = order.get("tickets") or []
        names = ", ".join(t["passengerName"] for t in tickets)
        seat = tickets[0]["seatType"] if tickets else "?"
        return (
            f"{order['fromStation']}→{order['toStation']} {order['date']} "
            f"{order['trainNo']} {seat} ×{len(tickets)} ({names})"
        )

    def check_booking_order(
        self,
        *,
        from_station: str,
        to_station: str,
        date: str,
        passenger_names: list[str],
        expected_train_no: str | None = None,
        seat_type: str | None = None,
        field: str = "newPendingOrder",
    ) -> dict[str, Any]:
        """检测是否存在符合目标的新待支付订单。

        返回单条 check：expected 写期望订单摘要，actual 写实际订单摘要（或"未创建新订单"），
        让日志一眼能看出买对了还是哪里不对。
        """
        new_pending = self.new_pending_orders()

        expected_parts = [f"{from_station}→{to_station}", date]
        if expected_train_no:
            expected_parts.append(expected_train_no)
        if seat_type:
            expected_parts.append(seat_type)
        expected_parts.append(f"×{len(passenger_names)}")
        expected_parts.append(f"({', '.join(passenger_names)})")
        expected_summary = " ".join(expected_parts)

        if not new_pending:
            return {
                "field": field,
                "expected": expected_summary,
                "actual": "未创建新订单",
                "passed": False,
            }

        order = new_pending[0]

        route_ok = (
            self._station_matches(from_station, order["fromStation"])
            and self._station_matches(to_station, order["toStation"])
        )
        date_ok = order["date"] == date
        train_ok = (
            expected_train_no is None or order["trainNo"] == expected_train_no
        )
        seat_ok = True
        if seat_type:
            seat_ok = all(
                t["seatType"] == seat_type for t in order["tickets"]
            )
        count_ok = len(order["tickets"]) == len(passenger_names)
        names_ok = (
            sorted(t["passengerName"] for t in order["tickets"])
            == sorted(passenger_names)
        )

        return {
            "field": field,
            "expected": expected_summary,
            "actual": self.describe_order(order),
            "passed": route_ok and date_ok and train_ok and seat_ok and count_ok and names_ok,
        }

    def check_no_ticket(self, answer: str | None) -> dict[str, Any]:
        """no_ticket 场景：检查 agent 是否正确回复且未创建订单。"""
        said = re.sub(r"\s+", "", str(answer or ""))
        expected = re.sub(r"\s+", "", self.NO_TICKET_REPLY)
        new_pending = self.new_pending_orders()
        no_order = len(new_pending) == 0

        if no_order:
            actual_desc = f"回复: {answer or '(空)'}; 无新订单"
        else:
            actual_desc = f"回复: {answer or '(空)'}; 但创建了订单: {self.describe_order(new_pending[0])}"

        return {
            "field": "noTicket",
            "expected": f"回复: {self.NO_TICKET_REPLY}; 无新订单",
            "actual": actual_desc,
            "passed": said == expected and no_order,
        }

    # =========================================================================
    # Selected train
    # =========================================================================

    @property
    def selected_train(self) -> dict[str, Any]:
        return self.get("selectedTrain")

    def related_tickets(
        self,
        *,
        from_station: str,
        to_station: str,
        passenger_name: str,
        seat_type: str,
        seat_letter: str,
    ) -> list[dict[str, Any]]:
        expected_letter = str(seat_letter).strip().upper()
        return [
            ticket
            for ticket in self.flat_tickets()
            if str(ticket["fromStation"]) == str(from_station)
            and str(ticket["toStation"]) == str(to_station)
            and str(ticket["passengerName"]) == str(passenger_name)
            and str(ticket["seatType"]) == str(seat_type)
            and expected_letter in str(ticket["seatNo"]).upper()
        ]

    # ── setup helpers (§1.2.4) ──────────────────────────────────────

    @staticmethod
    def prepare_order(
        *,
        from_station: str,
        to_station: str,
        date: str,
        passenger_name: str,
        rng: Any,
        created_at_iso: str,
    ) -> dict[str, Any]:
        """构造一条完整的车票订单对象。"""
        return {
            "id": f"EK{rng.randint(10000000, 99999999)}",
            "trainNo": f"G{rng.randint(1000, 9999)}",
            "fromStation": from_station,
            "toStation": to_station,
            "departTime": "08:30",
            "arriveTime": "12:45",
            "date": date,
            "tickets": [
                {
                    "passengerName": passenger_name,
                    "ticketType": "成人票",
                    "seatType": "二等座",
                    "seatNo": f"{rng.randint(1, 16):02d}车 {rng.randint(1, 20):02d}A号",
                    "price": 150.0,
                }
            ],
            "status": "completed",
            "createTime": created_at_iso,
        }

    def prepare_state_with_order(self, *, order: dict[str, Any]) -> dict[str, Any]:
        """返回将 order 插入 orders 列表开头后的新 app state。"""
        next_state = dict(self.raw)
        orders = list(self.get_list("orders"))
        orders.insert(0, order)
        next_state["orders"] = orders
        return next_state
