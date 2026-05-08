"""
Calendar app state accessor.
"""

from __future__ import annotations

import datetime
import re
from collections import Counter
from typing import Any

from bench_env.task.base import BaseApp
from bench_env.task.utils import date_match_labels, day_bounds_ms, extract_numbers, sim_datetime, sim_today

CALENDAR_WEEK_START_VALUES = {"周一": "monday", "周日": "sunday"}

CALENDAR_DEFAULT_REMINDER_VALUES = {
    "开始时": "0_minutes_before",
    "5分钟前": "5_minutes_before",
    "15分钟前": "15_minutes_before",
    "30分钟前": "30_minutes_before",
    "1小时前": "60_minutes_before",
    "1天前": "1_day_before",
}

CALENDAR_ALLDAY_REMINDER_VALUES = {
    "当天零点": "start_of_day",
    "当天早上九点": "9_am_on_day",
    "前一天早上九点": "9_am_day_before",
}

CALENDAR_LATER_REMINDER_VALUES = {
    "5分钟后": "5_minutes",
    "10分钟后": "10_minutes",
    "30分钟后": "30_minutes",
    "1小时后": "60_minutes",
}

CALENDAR_EVENT_REMINDER_VALUES = {
    "开始时": 0,
    "5分钟前": 5,
    "15分钟前": 15,
    "30分钟前": 30,
    "1小时前": 60,
    "1天前": 24 * 60,
}

CALENDAR_EVENT_TYPE_VALUES = {
    "日程": "event",
    "生日": "birthday",
    "纪念日": "anniversary",
    "倒数日": "countdown",
}

SEED_DAY_OFFSETS = [3, 4, 7, 8]
SEED_BIRTHDAY_OFFSET = 14

CALENDAR_SEARCH_KEYWORDS = ["团队", "项目"]
CALENDAR_DELETE_TITLES = ["团队周会", "客户拜访", "项目复盘"]
CALENDAR_EDIT_TITLES = ["团队周会", "客户拜访", "项目汇报"]


HOLIDAY_REST_DAYS = {
    "元旦": 3,
    "春节": 9,
    "清明": 3,
    "五一": 5,
    "端午": 3,
    "中秋": 3,
    "国庆": 7,
}

HOLIDAY_FIRST_REST = {
    "元旦": "2026-01-01",
    "春节": "2026-02-15",
    "清明": "2026-04-04",
    "五一": "2026-05-01",
    "端午": "2026-06-19",
    "中秋": "2026-09-25",
    "国庆": "2026-10-01",
}

# 记录每个假期结束后（最后一天休假之后）第一个补班日；对应模拟器日历中 WORK_REST_2026。
# 假期前的补班不计。清明、端午、中秋 2026 均不涉及假期后补班（假期与周末相邻，不需调休），故未列入。
# QueryMakeupWorkday 用 regex search 判定，Agent 回答包含该日期即通过。
HOLIDAY_MAKEUP_DAYS = {
    "元旦": "2026-01-04",
    "春节": "2026-02-28",
    "五一": "2026-05-09",
    "国庆": "2026-10-10",
}

CALENDAR_HOLIDAY_VALUES = list(HOLIDAY_REST_DAYS.keys())
CALENDAR_HOLIDAY_WITH_MAKEUP_VALUES = list(HOLIDAY_MAKEUP_DAYS.keys())


def _ts(date_text: str, time_text: str = "00:00") -> int:
    date_value = datetime.date.fromisoformat(date_text)
    hour, minute = [int(part) for part in time_text.split(":")]
    dt = datetime.datetime(date_value.year, date_value.month, date_value.day, hour, minute)
    return int(dt.timestamp() * 1000)



def build_seed_events(today: datetime.date) -> list[dict[str, Any]]:
    """Build seed events relative to today, always in the future."""
    day_a = (today + datetime.timedelta(days=SEED_DAY_OFFSETS[0])).isoformat()
    day_b = (today + datetime.timedelta(days=SEED_DAY_OFFSETS[1])).isoformat()
    day_c = (today + datetime.timedelta(days=SEED_DAY_OFFSETS[2])).isoformat()
    day_d = (today + datetime.timedelta(days=SEED_DAY_OFFSETS[3])).isoformat()
    day_bday = (today + datetime.timedelta(days=SEED_BIRTHDAY_OFFSET)).isoformat()
    day_bday_end = (today + datetime.timedelta(days=SEED_BIRTHDAY_OFFSET + 1)).isoformat()
    return [
    {
        "id": "seed_team_weekly",
        "type": "event",
        "title": "团队周会",
        "description": "每周同步项目进度",
        "allDay": False,
        "startTs": _ts(day_a, "09:00"),
        "endTs": _ts(day_a, "10:00"),
        "reminderMinutesBefore": 15,
        "alarmEnabled": True,
        "calendarAccount": "小米日历",
    },
    {
        "id": "seed_product_review",
        "type": "event",
        "title": "产品评审",
        "description": "确认版本交付范围",
        "allDay": False,
        "startTs": _ts(day_a, "14:00"),
        "endTs": _ts(day_a, "16:00"),
        "reminderMinutesBefore": 30,
        "alarmEnabled": False,
        "calendarAccount": "小米日历",
    },
    {
        "id": "seed_client_visit",
        "type": "event",
        "title": "客户拜访",
        "description": "去浦东见客户",
        "allDay": False,
        "startTs": _ts(day_b, "10:00"),
        "endTs": _ts(day_b, "11:30"),
        "reminderMinutesBefore": 15,
        "alarmEnabled": False,
        "calendarAccount": "小米日历",
    },
    {
        "id": "seed_team_dinner",
        "type": "event",
        "title": "团队聚餐",
        "description": "项目阶段庆功",
        "allDay": False,
        "startTs": _ts(day_b, "18:00"),
        "endTs": _ts(day_b, "20:00"),
        "reminderMinutesBefore": 30,
        "alarmEnabled": False,
        "calendarAccount": "小米日历",
    },
    {
        "id": "seed_project_report",
        "type": "event",
        "title": "项目汇报",
        "description": "向管理层汇报进展",
        "allDay": False,
        "startTs": _ts(day_c, "09:30"),
        "endTs": _ts(day_c, "11:00"),
        "reminderMinutesBefore": 15,
        "alarmEnabled": True,
        "calendarAccount": "小米日历",
    },
    {
        "id": "seed_project_retro",
        "type": "event",
        "title": "项目复盘",
        "description": "整理项目风险与总结",
        "allDay": False,
        "startTs": _ts(day_c, "14:00"),
        "endTs": _ts(day_c, "15:30"),
        "reminderMinutesBefore": 30,
        "alarmEnabled": False,
        "calendarAccount": "小米日历",
    },
    {
        "id": "seed_project_kickoff",
        "type": "event",
        "title": "项目启动会",
        "description": "项目正式启动",
        "allDay": False,
        "startTs": _ts(day_d, "10:00"),
        "endTs": _ts(day_d, "12:00"),
        "reminderMinutesBefore": 15,
        "alarmEnabled": False,
        "calendarAccount": "小米日历",
    },
    {
        "id": "seed_project_summary",
        "type": "event",
        "title": "部门项目总结",
        "description": "季度项目盘点",
        "allDay": False,
        "startTs": _ts(day_d, "15:00"),
        "endTs": _ts(day_d, "16:30"),
        "reminderMinutesBefore": 30,
        "alarmEnabled": False,
        "calendarAccount": "小米日历",
    },
    {
        "id": "seed_mom_birthday",
        "type": "birthday",
        "title": "妈妈生日",
        "description": "记得准备蛋糕",
        "allDay": True,
        "startTs": _ts(day_bday, "00:00"),
        "endTs": _ts(day_bday_end, "00:00"),
        "reminderMinutesBefore": 24 * 60,
        "alarmEnabled": False,
        "calendarAccount": "小米日历",
    },
]


CALENDAR_EVENT_CHANGES = ["calendar.events", "calendar.selectedDateTs"]


class Calendar(BaseApp):
    """
    Calendar state accessor.

    Seed event setup:
        state = await env.get_state()
        today = sim_today(state["os"])
        patch = Calendar.prepare_state_with_seed_events(today)
        await env.set_state({"apps": {"calendar": patch}}, deep=True, reload=False)
    """

    @staticmethod
    def prepare_state_with_seed_events(today: datetime.date) -> dict[str, Any]:
        """Return a calendar state patch with dynamic seed events."""
        return {"events": build_seed_events(today)}

    @staticmethod
    def parse_ymd(date_text: str) -> datetime.date:
        return datetime.date.fromisoformat(date_text)

    @staticmethod
    def timestamp(date_text: str, time_text: str = "00:00") -> int:
        return _ts(date_text, time_text)

    @staticmethod
    def start_of_day_ts(date_text: str) -> int:
        return _ts(date_text, "00:00")

    @staticmethod
    def prepare_event(
        *,
        event_id: str,
        title: str,
        date_text: str,
        start_time: str,
        end_time: str,
        created_at: int,
        description: str = "",
        reminder_minutes_before: int = 15,
        alarm_enabled: bool = False,
        event_type: str = "event",
        all_day: bool = False,
        calendar_account: str = "小米日历",
    ) -> dict[str, Any]:
        return {
            "id": event_id,
            "type": event_type,
            "title": title,
            "description": description,
            "startTs": _ts(date_text, start_time),
            "endTs": _ts(date_text, end_time),
            "allDay": all_day,
            "alarmEnabled": alarm_enabled,
            "reminderMinutesBefore": reminder_minutes_before,
            "calendarAccount": calendar_account,
            "createdAt": int(created_at),
            "updatedAt": int(created_at),
        }

    def prepare_state_with_event(
        self,
        *,
        event_id: str,
        title: str,
        date_text: str,
        start_time: str,
        end_time: str,
        created_at: int,
        description: str = "",
        reminder_minutes_before: int = 15,
        alarm_enabled: bool = False,
        event_type: str = "event",
        all_day: bool = False,
        calendar_account: str = "小米日历",
    ) -> dict[str, Any]:
        next_state = dict(self.raw)
        next_state["events"] = list(self.get_list("events"))
        next_state["events"].append(
            Calendar.prepare_event(
                event_id=event_id,
                title=title,
                date_text=date_text,
                start_time=start_time,
                end_time=end_time,
                created_at=created_at,
                description=description,
                reminder_minutes_before=reminder_minutes_before,
                alarm_enabled=alarm_enabled,
                event_type=event_type,
                all_day=all_day,
                calendar_account=calendar_account,
            )
        )
        return next_state

    @staticmethod
    def date_answer_pattern(date_value: str, os_state: dict[str, Any] | None = None) -> re.Pattern[str]:
        labels = date_match_labels(date_value, os_state)
        return re.compile("|".join(re.escape(label) for label in labels))

    @staticmethod
    def hhmm(timestamp_ms: int) -> str:
        dt = datetime.datetime.fromtimestamp(timestamp_ms / 1000.0)
        return f"{dt.hour:02d}:{dt.minute:02d}"

    @staticmethod
    def sample_future_date(env_state: dict[str, Any], rng: Any) -> str:
        """Sample a future date 3-14 days from sim_today."""
        today = sim_today(env_state.get("os", {}))
        offset = rng.choice(range(3, 15))
        return (today + datetime.timedelta(days=offset)).isoformat()

    @staticmethod
    def sample_seed_date(env_state: dict[str, Any], rng: Any) -> str:
        """Sample a date with seed events (non-birthday)."""
        today = sim_today(env_state.get("os", {}))
        offset = rng.choice(SEED_DAY_OFFSETS)
        return (today + datetime.timedelta(days=offset)).isoformat()

    @staticmethod
    def sample_seed_date_with_birthday(env_state: dict[str, Any], rng: Any) -> str:
        """Sample a date with seed events (including birthday)."""
        today = sim_today(env_state.get("os", {}))
        offset = rng.choice(SEED_DAY_OFFSETS + [SEED_BIRTHDAY_OFFSET])
        return (today + datetime.timedelta(days=offset)).isoformat()

    @staticmethod
    def sample_seed_date_pair(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        """Sample two dates with guaranteed different event counts.

        All SEED_DAY_OFFSETS dates have 2 events each, so picking two of
        those always yields equal density. Instead, pair one dense seed date
        (2 events) with a sparser date: the birthday date (1 event) or a
        non-seed future date (0 events).
        """
        today = sim_today(env_state.get("os", {}))
        dense_offset = rng.choice(SEED_DAY_OFFSETS)
        # birthday = 1 event, 30-day-out = 0 events
        sparse_offset = rng.choice([SEED_BIRTHDAY_OFFSET, 30])
        dates = [
            (today + datetime.timedelta(days=dense_offset)).isoformat(),
            (today + datetime.timedelta(days=sparse_offset)).isoformat(),
        ]
        rng.shuffle(dates)
        return {"date1": dates[0], "date2": dates[1]}

    @staticmethod
    def sample_interval_pair(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        """Sample two future dates for interval calculation.

        覆盖 date1 和 date2 两个参数。gap 保证 ≥30 天。
        """
        today = sim_today(env_state.get("os", {}))
        start_offset = rng.randint(1, 30)
        gap = rng.randint(30, 100)
        d1 = (today + datetime.timedelta(days=start_offset)).isoformat()
        d2 = (today + datetime.timedelta(days=start_offset + gap)).isoformat()
        return {"date1": d1, "date2": d2}

    @staticmethod
    def sample_calc_forward(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        """Sample a future date and day count for forward calculation.

        覆盖 date 和 days 两个参数；参数 schema 上的 min/max 不生效。
        """
        today = sim_today(env_state.get("os", {}))
        offset = rng.randint(1, 30)
        days = rng.randint(30, 100)
        return {"date": (today + datetime.timedelta(days=offset)).isoformat(), "days": days}

    @staticmethod
    def sample_future_holiday(env_state: dict[str, Any], rng: Any) -> str:
        """Sample a holiday whose first rest day is still in the future."""
        today = sim_today(env_state.get("os", {}))
        future = [h for h, d in HOLIDAY_FIRST_REST.items()
                  if datetime.date.fromisoformat(d) > today]
        if not future:
            return rng.choice(list(HOLIDAY_FIRST_REST.keys()))
        return rng.choice(future)

    @staticmethod
    def sample_future_holiday_with_makeup(env_state: dict[str, Any], rng: Any) -> str:
        """Sample a holiday with makeup workday still in the future."""
        today = sim_today(env_state.get("os", {}))
        future = [h for h, d in HOLIDAY_MAKEUP_DAYS.items()
                  if datetime.date.fromisoformat(d) > today]
        if not future:
            return rng.choice(list(HOLIDAY_MAKEUP_DAYS.keys()))
        return rng.choice(future)

    @staticmethod
    def sample_time_range(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        return rng.choice(
            [
                {"start": "09:00", "end": "10:30"},
                {"start": "14:00", "end": "15:00"},
                {"start": "18:30", "end": "20:00"},
            ]
        )

    @property
    def events(self) -> list[dict[str, Any]]:
        events = self.get("events")
        if not isinstance(events, list):
            raise ValueError("calendar.events is not a list")
        return events

    @staticmethod
    def _match_title(actual: str, expected: str, fuzzy: bool = False) -> bool:
        """Compare event title. When fuzzy=True, check if expected is contained in actual."""
        a = str(actual).strip()
        e = expected.strip()
        if not fuzzy:
            return a == e
        # Fuzzy match: check if expected keywords are contained in actual
        return e in a

    def count_events_with_title(self, title: str, *, fuzzy: bool = False) -> int:
        return sum(1 for event in self.events if self._match_title(event["title"], title, fuzzy))

    @staticmethod
    def coerce_ts(value: Any, day: datetime.date | None = None) -> int | None:
        if isinstance(value, (int, float)) and float(value) > 0:
            return int(value)
        text = str(value).strip()
        if not text:
            return None
        if re.fullmatch(r"\d{12,}", text):
            return int(text)
        matched = re.fullmatch(r"(\d{1,2}):(\d{2})", text)
        if matched and day:
            hour = int(matched.group(1))
            minute = int(matched.group(2))
            dt = datetime.datetime(day.year, day.month, day.day, hour, minute, 0)
            return int(dt.timestamp() * 1000)
        dt = datetime.datetime.fromisoformat(text.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)

    def find_events_on_date(self, day: datetime.date) -> list[dict[str, Any]]:
        """返回指定日期的日历事件。"""
        start_ms, end_ms = day_bounds_ms(day)
        events: list[dict[str, Any]] = []
        for event in self.events:
            start_ts = self.coerce_ts(event["startTs"], day)
            end_ts = self.coerce_ts(event["endTs"], day)
            if start_ts is None:
                raise ValueError(f"calendar event {event['id']} missing startTs")
            if end_ts is None:
                if start_ms <= start_ts < end_ms:
                    events.append(event)
                continue
            if start_ts < end_ms and end_ts > start_ms:
                events.append(event)
        events.sort(key=lambda event: self.coerce_ts(event["startTs"], day) or 0)
        return events

    def count_events_on_date(self, day: datetime.date) -> int:
        return len(self.find_events_on_date(day))

    def first_event_on_date(self, day: datetime.date) -> dict[str, Any]:
        events = self.find_events_on_date(day)
        if not events:
            raise ValueError(f"no events found on {day.isoformat()}")
        return events[0]

    def find_event_by_title(self, title: str, *, fuzzy: bool = False) -> dict[str, Any] | None:
        for event in self.events:
            if self._match_title(event["title"], title, fuzzy):
                return event
        return None

    def find_events_by_keyword(self, keyword: str) -> list[dict[str, Any]]:
        lowered = keyword.strip().lower()
        matches = [
            event
            for event in self.events
            if lowered in str(event["title"]).lower()
            or lowered in str(event.get("description", "")).lower()
        ]
        matches.sort(key=lambda event: self.coerce_ts(event["startTs"]) or 0, reverse=True)
        return matches

    def check_event_created(self, title: str, *, field: str = "event_created", fuzzy: bool = False) -> dict[str, Any]:
        init_count = self.init.count_events_with_title(title, fuzzy=fuzzy)
        curr_count = self.count_events_with_title(title, fuzzy=fuzzy)
        return {
            "field": field,
            "expected": f"新增标题为 {title} 的日程",
            "actual": {"initCount": init_count, "currCount": curr_count},
            "passed": curr_count > init_count,
        }

    def check_no_event_created(
        self, title: str, *, field: str = "event_not_created", fuzzy: bool = False
    ) -> dict[str, Any]:
        init_count = self.init.count_events_with_title(title, fuzzy=fuzzy)
        curr_count = self.count_events_with_title(title, fuzzy=fuzzy)
        return {
            "field": field,
            "expected": f"不新增标题为 {title} 的日程",
            "actual": {"initCount": init_count, "currCount": curr_count},
            "passed": curr_count == init_count,
        }

    @staticmethod
    def _event_identity(event: dict[str, Any]) -> str:
        return str(event["id"])

    def check_no_new_events(self, *, field: str = "no_new_events") -> dict[str, Any]:
        """检查是否没有新增任何日程事件（基于实体身份，非纯数量）。"""
        init_counter = Counter(self._event_identity(e) for e in self.init.events)
        curr_counter = Counter(self._event_identity(e) for e in self.events)
        added = list((curr_counter - init_counter).elements())
        return {
            "field": field,
            "expected": "不新增任何日程",
            "actual": {"addedCount": len(added), "addedPreview": added[:5]},
            "passed": len(added) == 0,
        }

    def check_event_deleted(self, title: str, *, field: str = "event_deleted") -> dict[str, Any]:
        init_count = self.init.count_events_with_title(title)
        curr_count = self.count_events_with_title(title)
        return {
            "field": field,
            "expected": f"删除标题为 {title} 的日程",
            "actual": {"initCount": init_count, "currCount": curr_count},
            "passed": curr_count < init_count,
        }

    def check_event_on_date(self, title: str, date_value: str, *, field: str = "event_date", fuzzy: bool = False) -> dict[str, Any]:
        event = self.find_event_by_title(title, fuzzy=fuzzy)
        expected_start = self.start_of_day_ts(date_value)
        actual_start = None if event is None else self.coerce_ts(event["startTs"])
        passed = event is not None and actual_start is not None and expected_start <= actual_start < expected_start + 86400000
        actual_date = None
        if actual_start is not None:
            actual_date = datetime.datetime.fromtimestamp(actual_start / 1000.0).strftime("%Y-%m-%d")
        return {
            "field": field,
            "expected": date_value,
            "actual": actual_date,
            "passed": passed,
        }

    def check_event_time(
        self,
        title: str,
        start_ts: int,
        end_ts: int,
        *,
        field: str = "event_time",
    ) -> dict[str, Any]:
        event = self.find_event_by_title(title)
        actual = None if event is None else {
            "startTs": self.coerce_ts(event["startTs"]),
            "endTs": self.coerce_ts(event["endTs"]),
        }
        passed = event is not None and actual == {"startTs": start_ts, "endTs": end_ts}
        return {
            "field": field,
            "expected": {"startTs": start_ts, "endTs": end_ts},
            "actual": actual,
            "passed": passed,
        }

    def check_event_type(self, title: str, event_type: str, *, field: str = "event_type", fuzzy: bool = False) -> dict[str, Any]:
        event = self.find_event_by_title(title, fuzzy=fuzzy)
        actual = None if event is None else event["type"]
        return {
            "field": field,
            "expected": event_type,
            "actual": actual,
            "passed": event is not None and actual == event_type,
        }

    def check_event_reminder(self, title: str, reminder_minutes: int | None, *, field: str = "event_reminder") -> dict[str, Any]:
        event = self.find_event_by_title(title)
        actual = None if event is None else event.get("reminderMinutesBefore")
        return {
            "field": field,
            "expected": reminder_minutes,
            "actual": actual,
            "passed": event is not None and actual == reminder_minutes,
        }

    def check_event_all_day(self, title: str, *, field: str = "event_all_day") -> dict[str, Any]:
        event = self.find_event_by_title(title)
        actual = None if event is None else event["allDay"]
        return {
            "field": field,
            "expected": True,
            "actual": actual,
            "passed": event is not None and actual is True,
        }

    def check_event_alarm(self, title: str, enabled: bool, *, field: str = "event_alarm") -> dict[str, Any]:
        event = self.find_event_by_title(title)
        actual = None if event is None else event.get("alarmEnabled")
        return {
            "field": field,
            "expected": enabled,
            "actual": actual,
            "passed": event is not None and actual == enabled,
        }

    def check_event_description_contains(
        self, title: str, *keywords: str,
        field: str = "event_description", fuzzy: bool = False,
    ) -> dict[str, Any]:
        """检查事件备注/描述是否包含所有关键词。"""
        event = self.find_event_by_title(title, fuzzy=fuzzy)
        desc = str(event.get("description", "") or "") if event is not None else ""
        missing = [kw for kw in keywords if kw not in desc]
        return {
            "field": field,
            "expected": f"备注包含 {list(keywords)}",
            "actual": desc[:200] or "(none)",
            "passed": event is not None and not missing,
        }

    def check_event_description_contains_number(
        self, title: str, expected: float, *,
        tolerance: float = 1.0, field: str = "event_description_number",
        fuzzy: bool = False,
    ) -> dict[str, Any]:
        """检查事件备注/描述是否包含指定数值（±tolerance）。"""
        event = self.find_event_by_title(title, fuzzy=fuzzy)
        desc = str(event.get("description", "") or "") if event is not None else ""
        numbers = extract_numbers(desc)
        passed = event is not None and any(
            abs(num - float(expected)) <= tolerance for num in numbers
        )
        return {
            "field": field,
            "expected": {"number": float(expected), "tolerance": tolerance},
            "actual": {"desc": desc[:200] or "(none)", "numbers": numbers[:10]},
            "passed": passed,
        }

    def check_event_start_aligns_ms(
        self,
        title: str,
        target_start_ms: int,
        *,
        tolerance_ms: int = 3 * 60 * 1000,
        field: str | None = None,
    ) -> dict[str, Any]:
        """日程标题存在且 startTs 与目标毫秒时间差在容差内（跨 App 对齐会议开始）。"""
        if field is None:
            field = "calendar_event_matches_meeting"
        ev = self.find_event_by_title(title)
        if ev is None:
            return {
                "field": field,
                "expected": f"日历新增「{title}」，startTs ≈ 会议开始 ({target_start_ms})",
                "actual": "event=无, startTs=None",
                "passed": False,
            }
        actual_ms = self.coerce_ts(ev["startTs"])
        time_ok = isinstance(actual_ms, int) and abs(actual_ms - int(target_start_ms)) <= int(tolerance_ms)
        return {
            "field": field,
            "expected": f"日历新增「{title}」，startTs ≈ 会议开始 ({target_start_ms})",
            "actual": f"event=存在, startTs={actual_ms}",
            "passed": time_ok,
        }

    def check_event_start_reminder_alarm(
        self,
        title: str,
        target_start_ms: int,
        *,
        reminder_minutes_before: int = 15,
        alarm_enabled: bool = True,
        tolerance_ms: int = 5 * 60 * 1000,
        field: str | None = None,
    ) -> dict[str, Any]:
        """日程开始时间对齐，且提醒分钟数与闹钟开关满足期望。"""
        if field is None:
            field = f"flow_calendar_{title}"
        ev = self.find_event_by_title(title)
        if not ev:
            return {
                "field": field,
                "expected": f"日程提前{reminder_minutes_before}分钟提醒且闹钟={alarm_enabled}",
                "actual": None,
                "passed": False,
            }
        est = self.coerce_ts(ev["startTs"])
        cal_ok = (
            isinstance(est, int)
            and abs(est - int(target_start_ms)) <= int(tolerance_ms)
            and ev["alarmEnabled"] is alarm_enabled
            and int(ev["reminderMinutesBefore"]) == int(reminder_minutes_before)
        )
        cal_actual = {
            "alarmEnabled": ev["alarmEnabled"],
            "reminder": ev["reminderMinutesBefore"],
            "startTs": ev["startTs"],
        }
        return {
            "field": field,
            "expected": f"日程提前{reminder_minutes_before}分钟提醒且闹钟={alarm_enabled}",
            "actual": cal_actual,
            "passed": cal_ok,
        }

    def check_event_title_updated(self, old_title: str, new_title: str, *, field: str = "event_title") -> dict[str, Any]:
        old_curr = self.count_events_with_title(old_title)
        old_init = self.init.count_events_with_title(old_title)
        new_curr = self.count_events_with_title(new_title)
        new_init = self.init.count_events_with_title(new_title)
        return {
            "field": field,
            "expected": {"old": old_title, "new": new_title},
            "actual": {
                "oldInit": old_init,
                "oldCurr": old_curr,
                "newInit": new_init,
                "newCurr": new_curr,
            },
            "passed": old_curr < old_init and new_curr > new_init,
        }

    def event_blocks_slot_on_date(
        self,
        day: datetime.date,
        hour: int,
        minute: int,
        *,
        slot_duration_minutes: int = 60,
    ) -> bool:
        """某日是否存在与 [day HH:MM, +slot_duration) 重叠的日程。"""
        slot_ms = self.timestamp(day.isoformat(), f"{hour:02d}:{minute:02d}")
        slot_end = slot_ms + int(slot_duration_minutes) * 60 * 1000
        for ev in self.find_events_on_date(day):
            st = self.coerce_ts(ev["startTs"], day)
            if st is None:
                continue
            et = self.coerce_ts(ev["endTs"], day)
            if et is None:
                et = st + 3600000
            if st < slot_end and et > slot_ms:
                return True
        return False

    def tomorrow_blocks_slot(
        self,
        os_state: dict[str, Any],
        hour: int,
        minute: int,
        *,
        slot_duration_minutes: int = 60,
    ) -> bool:
        day = sim_today(os_state) + datetime.timedelta(days=1)
        return self.event_blocks_slot_on_date(day, hour, minute, slot_duration_minutes=slot_duration_minutes)

    @staticmethod
    def parse_hh_mm(time_text: str) -> tuple[int, int]:
        matched = re.fullmatch(r"(\d{1,2}):(\d{2})", str(time_text).strip())
        if not matched:
            raise ValueError(f"时间格式应为 HH:MM，收到 {time_text!r}")
        return int(matched.group(1)), int(matched.group(2))

    @staticmethod
    def tomorrow_datetime_at_hh_mm(os_state: dict, time_hhmm: str) -> datetime.datetime:
        """模拟「明天」在 HH:MM 的本地时间（用于跨 App 会议预约判题）。"""
        hour, minute = Calendar.parse_hh_mm(time_hhmm)
        base = sim_datetime(os_state) + datetime.timedelta(days=1)
        return base.replace(hour=hour, minute=minute, second=0, microsecond=0)

    @staticmethod
    def tomorrow_timestamp_ms_at_hh_mm(os_state: dict, time_hhmm: str) -> int:
        return int(Calendar.tomorrow_datetime_at_hh_mm(os_state, time_hhmm).timestamp() * 1000)
