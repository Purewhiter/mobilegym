"""
Clock app state accessor.
"""

from __future__ import annotations

import datetime
import re
from typing import Any

from bench_env.task.base import BaseApp
from bench_env.task.utils import norm, now_ms, format_hhmm
from bench_env.task.common_tasks import match_time




CLOCK_SELECTED_CITIES = ["伦敦", "纽约", "阿克拉", "巴黎"]
CLOCK_NEW_CITIES = ["阿比让", "阿德莱德", "阿尔伯克基", "阿尔及尔", "阿克套", "阿拉木图", "阿姆斯特丹", "北京", "东京", "洛杉矶", "悉尼"]
CLOCK_COMPARE_NEW_CITIES = ["阿比让", "阿尔伯克基", "阿尔及尔", "阿克套", "阿拉木图", "阿姆斯特丹", "北京", "东京", "洛杉矶", "悉尼"]
CLOCK_LATEST_NEW_CITIES = ["北京", "东京", "悉尼"]

CLOCK_REPEAT_VALUES = {
    "只响一次": "once",
    "每天": "daily",
    "法定工作日": "workday",
    "法定节假日": "holiday",
    "周一至周五": "weekday",
}

CLOCK_NOTE_VALUES = ["晨练", "看球", "学习", "接人", "出差提醒"]

ALARM_TIME_PARAM = ["04:30", "05:00", "06:00", "06:10", "06:20", "07:00", "22:30"]

NEW_ALARM_CANDIDATES = [
    {"hour": 7, "minute": 10},
    {"hour": 7, "minute": 20},
    {"hour": 7, "minute": 30},
    {"hour": 7, "minute": 40},
    {"hour": 7, "minute": 50},
    {"hour": 8, "minute": 10},
    {"hour": 8, "minute": 20},
    {"hour": 8, "minute": 30},
    {"hour": 8, "minute": 40},
    {"hour": 8, "minute": 50},
    {"hour": 9, "minute": 10},
    {"hour": 9, "minute": 20},
]

CLOCK_ALARM_CHANGES = ["clock.alarms"]





class Clock(BaseApp):
    """
    Clock state accessor.

    Usage:
        clock = Clock(input.apps["clock"])
        clock.alarms
    """

    @staticmethod
    def _city_lookup(cities: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        return {str(city["id"]): city for city in cities}

    @staticmethod
    def _find_city(cities: list[dict[str, Any]], name_or_id: str) -> dict[str, Any]:
        target = norm(name_or_id)
        for city in cities:
            if target in {norm(str(city["id"])), norm(str(city["name"]))}:
                return dict(city)
        raise ValueError(f"Clock city '{name_or_id}' not found")

    @staticmethod
    def _local_offset_minutes(os_state: dict[str, Any]) -> int:
        ts = now_ms(os_state)
        local_dt = datetime.datetime.fromtimestamp(ts / 1000.0, datetime.timezone.utc).astimezone()
        offset = local_dt.utcoffset()
        if offset is None:
            raise ValueError("Clock local timezone offset is unavailable")
        return int(round(offset.total_seconds() / 60))

    @staticmethod
    def sample_existing_alarm(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        alarms = env_state["apps"]["clock"]["alarms"]
        picked = rng.choice(alarms)
        return {
            "alarm_id": str(picked["id"]),
            "time": format_hhmm(int(picked["hour"]), int(picked["minute"])),
            "hour": int(picked["hour"]),
            "minute": int(picked["minute"]),
        }

    @staticmethod
    def sample_noted_alarm(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        alarms = [alarm for alarm in env_state["apps"]["clock"]["alarms"] if str(alarm.get("note") or "").strip()]
        picked = rng.choice(alarms)
        return {
            "alarm_id": str(picked["id"]),
            "time": format_hhmm(int(picked["hour"]), int(picked["minute"])),
            "hour": int(picked["hour"]),
            "minute": int(picked["minute"]),
        }

    @staticmethod
    def sample_new_alarm_time(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        existing = {
            format_hhmm(int(alarm["hour"]), int(alarm["minute"]))
            for alarm in env_state["apps"]["clock"]["alarms"]
        }
        available = [item for item in NEW_ALARM_CANDIDATES if format_hhmm(item["hour"], item["minute"]) not in existing]
        picked = rng.choice(available)
        return {
            "time": format_hhmm(picked["hour"], picked["minute"]),
            "hour": picked["hour"],
            "minute": picked["minute"],
        }

    @staticmethod
    def sample_existing_alarm_and_new_time(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        picked_alarm = Clock.sample_existing_alarm(env_state, rng)
        picked_time = Clock.sample_new_alarm_time(env_state, rng)
        return {
            "alarm_id": picked_alarm["alarm_id"],
            "old_time": picked_alarm["time"],
            "old_hour": picked_alarm["hour"],
            "old_minute": picked_alarm["minute"],
            "new_time": picked_time["time"],
            "new_hour": picked_time["hour"],
            "new_minute": picked_time["minute"],
        }

    @staticmethod
    def sample_two_new_alarm_times(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        existing = {
            format_hhmm(int(alarm["hour"]), int(alarm["minute"]))
            for alarm in env_state["apps"]["clock"]["alarms"]
        }
        available = [item for item in NEW_ALARM_CANDIDATES if format_hhmm(item["hour"], item["minute"]) not in existing]
        first, second = rng.sample(available, 2)
        if (first["hour"], first["minute"]) > (second["hour"], second["minute"]):
            first, second = second, first
        return {
            "time1": format_hhmm(first["hour"], first["minute"]),
            "h1": first["hour"],
            "m1": first["minute"],
            "time2": format_hhmm(second["hour"], second["minute"]),
            "h2": second["hour"],
            "m2": second["minute"],
        }

    @staticmethod
    def sample_selected_city(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        city = rng.choice(Clock._selected_cities_from_env(env_state))
        return {"city": str(city["name"])}

    @staticmethod
    def sample_selected_city_pair(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        selected = Clock._selected_cities_from_env(env_state)
        pairs = [
            (city1, city2)
            for city1 in selected
            for city2 in selected
            if city1["id"] != city2["id"]
            and int(city1["gmtOffsetMinutes"]) != int(city2["gmtOffsetMinutes"])
            and abs(int(city1["gmtOffsetMinutes"]) - int(city2["gmtOffsetMinutes"])) % 60 == 0
        ]
        city1, city2 = rng.choice(pairs)
        return {"city1": str(city1["name"]), "city2": str(city2["name"])}

    @staticmethod
    def sample_addable_city(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        selected_ids = set(env_state["apps"]["clock"]["selectedCityIds"])
        all_cities = env_state["apps"]["clock"]["cities"]
        candidates = [city for city in all_cities if str(city["id"]) not in selected_ids]
        picked = rng.choice(candidates)
        return {"city": str(picked["name"])}

    @staticmethod
    def sample_compare_addable_city(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        selected_ids = set(env_state["apps"]["clock"]["selectedCityIds"])
        all_cities = env_state["apps"]["clock"]["cities"]
        candidates = [
            city for city in all_cities
            if str(city["id"]) not in selected_ids and str(city["name"]) in CLOCK_COMPARE_NEW_CITIES
        ]
        picked = rng.choice(candidates)
        return {"city": str(picked["name"])}

    @staticmethod
    def sample_latest_addable_city(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        selected_ids = set(env_state["apps"]["clock"]["selectedCityIds"])
        all_cities = env_state["apps"]["clock"]["cities"]
        candidates = [
            city for city in all_cities
            if str(city["id"]) not in selected_ids and str(city["name"]) in CLOCK_LATEST_NEW_CITIES
        ]
        picked = rng.choice(candidates)
        return {"city": str(picked["name"])}

    @staticmethod
    def sample_remove_add_city(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        remove_city = rng.choice(Clock._selected_cities_from_env(env_state))
        add_city = Clock.sample_addable_city(env_state, rng)
        return {"remove_city": str(remove_city["name"]), "add_city": add_city["city"]}

    @staticmethod
    def sample_compare_city_pair_with_new(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        new_city = Clock.sample_compare_addable_city(env_state, rng)
        selected = Clock._selected_cities_from_env(env_state)
        all_cities = env_state["apps"]["clock"]["cities"]
        new_offset = int(Clock._find_city(all_cities, new_city["city"])["gmtOffsetMinutes"])
        existing_choices = [
            city for city in selected
            if abs(new_offset - int(city["gmtOffsetMinutes"])) % 60 == 0
            and new_offset != int(city["gmtOffsetMinutes"])
        ]
        existing_city = rng.choice(existing_choices)
        return {"new_city": new_city["city"], "existing_city": str(existing_city["name"])}

    @staticmethod
    def sample_city_not_local_offset(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        local_offset = Clock._local_offset_minutes(env_state["os"])
        choices = [
            city for city in Clock._selected_cities_from_env(env_state)
            if int(city["gmtOffsetMinutes"]) != local_offset
        ]
        picked = rng.choice(choices)
        return {"city": str(picked["name"])}

    @staticmethod
    def _selected_cities_from_env(env_state: dict[str, Any]) -> list[dict[str, Any]]:
        clock_state = env_state["apps"]["clock"]
        selected_ids = clock_state.get("selectedCityIds", [])
        all_cities = clock_state.get("cities", [])
        lookup = Clock._city_lookup(all_cities)
        return [dict(lookup[str(city_id)]) for city_id in selected_ids if str(city_id) in lookup]

    @property
    def all_cities(self) -> list[dict[str, Any]]:
        cities = self.get("cities")
        if not isinstance(cities, list):
            raise ValueError("clock.cities is not a list")
        return cities

    @property
    def alarms(self) -> list[dict[str, Any]]:
        alarms = self.get("alarms")
        if not isinstance(alarms, list):
            raise ValueError("clock.alarms is not a list")
        return alarms

    @property
    def selected_city_ids(self) -> list[str]:
        selected_ids = self.get("selectedCityIds")
        if not isinstance(selected_ids, list):
            raise ValueError("clock.selectedCityIds is not a list")
        return [str(city_id) for city_id in selected_ids]

    @property
    def selected_cities(self) -> list[dict[str, Any]]:
        state_selected = self.get("selectedCities")
        if isinstance(state_selected, list) and state_selected:
            return state_selected
        lookup = Clock._city_lookup(self.all_cities)
        result = []
        for city_id in self.selected_city_ids:
            if city_id not in lookup:
                raise ValueError(f"Clock selected city id '{city_id}' not found in catalog")
            result.append(dict(lookup[city_id]))
        return result

    def find_alarm_by_id(self, alarm_id: str) -> dict[str, Any] | None:
        for alarm in self.alarms:
            if str(alarm.get("id")) == str(alarm_id):
                return alarm
        return None

    def find_alarm_by_time(self, hour: int, minute: int) -> dict[str, Any] | None:
        for alarm in self.alarms:
            alarm_hour = alarm.get("hour")
            alarm_minute = alarm.get("minute")
            if alarm_hour is None or alarm_minute is None:
                continue
            if int(alarm_hour) == int(hour) and int(alarm_minute) == int(minute):
                return alarm
        return None

    def find_alarm_at(
        self, hour: int, minute: int, *, note: str | None = None
    ) -> dict[str, Any] | None:
        for alarm in self.alarms:
            alarm_hour = alarm.get("hour")
            alarm_minute = alarm.get("minute")
            if alarm_hour is None or alarm_minute is None:
                continue
            if int(alarm_hour) != int(hour):
                continue
            if int(alarm_minute) != int(minute):
                continue
            if note is not None and norm(str(alarm.get("note") or "")) != norm(note):
                continue
            return alarm
        return None

    def check_alarm_at(
        self,
        hour: int,
        minute: int,
        *,
        note: str | None = None,
        field: str = "alarm",
    ) -> dict[str, Any]:
        alarm = self.find_alarm_at(hour, minute, note=note)
        expected: dict[str, Any] = {"time": format_hhmm(hour, minute)}
        if note is not None:
            expected["note"] = note
        actual = None
        if alarm is not None:
            actual = {
                "time": format_hhmm(int(alarm["hour"]), int(alarm["minute"])),
                "note": str(alarm.get("note") or ""),
            }
        return {
            "field": field,
            "expected": expected,
            "actual": actual,
            "passed": alarm is not None,
        }

    # ---- 对比层（需要 init）----

    def new_alarms(self) -> list[dict[str, Any]]:
        """init 后新增的闹钟（按 ID 差集）"""
        init_ids = {str(a["id"]) for a in self.init.alarms}
        return [a for a in self.alarms if str(a["id"]) not in init_ids]

    def removed_alarm_ids(self) -> set[str]:
        """init 后被删除的闹钟 ID 集合"""
        curr_ids = {str(a["id"]) for a in self.alarms}
        return {str(a["id"]) for a in self.init.alarms} - curr_ids

    # ---- 检查层（返回 check dict，内含 assert）----

    def check_created_alarm(
        self, hour: int, minute: int, *,
        field: str = "alarm_created", **attrs: Any,
    ) -> dict[str, Any]:
        """增：在新增闹钟中查找匹配时间+属性的项。"""
        assert self.init.find_alarm_by_time(hour, minute) is None, \
            f"Sampler bug: alarm {format_hhmm(hour, minute)} already in init"
        new = self.new_alarms()
        match = next(
            (a for a in new
             if int(a["hour"]) == hour and int(a["minute"]) == minute
             and all(str(a.get(k)) == str(v) for k, v in attrs.items())),
            None,
        )
        expected: dict[str, Any] = {"time": format_hhmm(hour, minute)}
        expected.update(attrs)
        return {"field": field, "expected": expected,
                "actual": match, "passed": match is not None}

    def check_deleted_alarm(
        self, alarm_id: str, *, field: str = "alarm_deleted",
    ) -> dict[str, Any]:
        """删：确认目标 ID 在已删除集合中。"""
        assert self.init.find_alarm_by_id(alarm_id) is not None, \
            f"Sampler bug: alarm '{alarm_id}' not in init"
        removed = self.removed_alarm_ids()
        return {"field": field, "expected": alarm_id,
                "actual": removed, "passed": str(alarm_id) in removed}

    def check_alarm_fields(
        self, alarm_id: str, *, field: str | None = None, **expected: Any,
    ) -> dict[str, Any]:
        """改：用 current 验证修改结果。"""
        assert self.init.find_alarm_by_id(alarm_id) is not None, \
            f"Sampler bug: alarm '{alarm_id}' not in init"
        alarm = self.find_alarm_by_id(alarm_id)
        fld = field or f"alarm_{alarm_id}"
        if alarm is None:
            return {"field": fld, "expected": expected,
                    "actual": None, "passed": False}
        passed = all(str(alarm.get(k)) == str(v) for k, v in expected.items())
        return {"field": fld, "expected": expected,
                "actual": {k: alarm.get(k) for k in expected}, "passed": passed}

    def check_no_new_alarm_at(
        self,
        hour: int,
        minute: int,
        *,
        note: str | None = None,
        field: str = "alarm_not_created",
    ) -> dict[str, Any]:
        init_alarm = self.init.find_alarm_at(hour, minute, note=note)
        curr_alarm = self.find_alarm_at(hour, minute, note=note)
        return {
            "field": field,
            "expected": {
                "time": format_hhmm(hour, minute),
                "note": note,
                "created": False,
            },
            "actual": {"init": init_alarm, "curr": curr_alarm},
            "passed": curr_alarm == init_alarm,
        }

    def check_no_new_alarms(
        self, *, field: str = "no_new_alarms"
    ) -> dict[str, Any]:
        """确认本次任务没有新增任何闹钟。"""
        new = self.new_alarms()
        preview = [
            {
                "id": alarm.get("id"),
                "time": format_hhmm(int(alarm["hour"]), int(alarm["minute"])),
                "note": str(alarm.get("note") or ""),
            }
            for alarm in new[:5]
        ]
        return {
            "field": field,
            "expected": "不新增任何闹钟",
            "actual": {"addedCount": len(new), "addedPreview": preview},
            "passed": len(new) == 0,
        }

    def find_city(self, name_or_id: str) -> dict[str, Any]:
        return Clock._find_city(self.all_cities, name_or_id)

    def selected_city_matches(self, name_or_id: str) -> bool:
        target = norm(name_or_id)
        return any(
            target in {norm(str(city["id"])), norm(str(city["name"]))}
            for city in self.selected_cities
        )

    def city_time(self, name_or_id: str, os_state: dict[str, Any]) -> str:
        city = self.find_city(name_or_id)
        utc_dt = datetime.datetime.fromtimestamp(now_ms(os_state) / 1000.0, datetime.timezone.utc)
        city_dt = utc_dt + datetime.timedelta(minutes=int(city["gmtOffsetMinutes"]))
        return f"{city_dt.hour:02d}:{city_dt.minute:02d}"

    def check_city_time_answer(
        self, name_or_id: str, os_state: dict[str, Any],
        answer: Any, *, field: str = "answer",
    ) -> dict[str, Any]:
        """验证 Agent 回答是否包含城市当前时间（±5 分钟容忍）。"""

        expected = self.city_time(name_or_id, os_state)
        return {
            "field": field,
            "expected": expected,
            "actual": answer,
            "passed": match_time(expected, answer),
        }

    def city_local_diff_text(self, name_or_id: str, os_state: dict[str, Any]) -> re.Pattern:
        city = self.find_city(name_or_id)
        diff_minutes = int(city["gmtOffsetMinutes"]) - Clock._local_offset_minutes(os_state)
        if diff_minutes == 0:
            return re.compile(r"一样|相同|没有(?:时)?差")
        sign = "快" if diff_minutes > 0 else "慢"
        abs_minutes = abs(diff_minutes)
        hours = abs_minutes // 60
        minutes = abs_minutes % 60
        # 构建容忍助词（了、个、约 等）的正则
        parts: list[str] = []
        if hours > 0:
            parts.append(rf"{hours}\s*(?:个)?小时")
        if minutes > 0:
            parts.append(rf"{minutes}\s*(?:个)?分(?:钟)?")
        time_part = r"\s*".join(parts)
        return re.compile(rf"{sign}\S{{0,3}}{time_part}")

    def time_diff_hours(self, city1: str, city2: str) -> int:
        first = self.find_city(city1)
        second = self.find_city(city2)
        diff_minutes = abs(int(first["gmtOffsetMinutes"]) - int(second["gmtOffsetMinutes"]))
        if diff_minutes % 60 != 0:
            raise ValueError(f"Clock city diff between '{city1}' and '{city2}' is not an integer hour")
        return diff_minutes // 60

    def latest_city_name(self, city_names: list[str] | None = None) -> Any:
        """时区最靠东：``gmtOffsetMinutes`` 最大（相对格林尼治向东偏移最大）。

        若有多个城市同偏移并列，返回可同时匹配任一城市名的正则。
        """
        if city_names is None:
            cities = self.selected_cities
        else:
            cities = [self.find_city(name) for name in city_names]
        if not cities:
            raise ValueError("Clock selected cities are empty")
        max_off = max(int(city["gmtOffsetMinutes"]) for city in cities)
        winners = [str(city["name"]) for city in cities if int(city["gmtOffsetMinutes"]) == max_off]
        if len(winners) == 1:
            return winners[0]
        return re.compile("|".join(re.escape(name) for name in winners))
