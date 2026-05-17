"""Reclassified derived task definition."""

from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.alipay.app import Alipay
from bench_env.task.base import BaseTask
from bench_env.task.calendar.app import CALENDAR_EVENT_CHANGES, Calendar
from bench_env.task.clock.app import CLOCK_ALARM_CHANGES, Clock
from bench_env.task.launcher.app import Launcher
from bench_env.task.judge import JudgeInput
from bench_env.task.map.app import CATEGORY_PARAM, RADIUS_PARAM, Map, MAP_SEARCH_CHANGES
from bench_env.task.notes.app import NOTES_CREATE_CHANGES, Notes
from bench_env.task.railway12306.app import RAIL_QUERY_CHANGES, Railway12306
from bench_env.task.redbook.app import REDBOOK_PUBLISH_CHANGES, Redbook
from bench_env.task.sms.app import SMS_RECIPIENT_PARAM, SMS_SEND_CHANGES, sms_from_input
from bench_env.task.spotify.app import SPOTIFY_PLAYLIST_WITH_PLAYBACK_CHANGES, Spotify
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.task.utils import (
    default_tomorrow,
    now_ms,
    sim_today,
)
from bench_env.task.weather.app import WEATHER_QUERY_CHANGES, Weather
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_MOMENT_CHANGES, WECHAT_SEND_CHANGES, Wechat
from bench_env.task.wechat_reading.app import WechatReading


class WeekendShanghaiTripIfClearAndFree(BaseTask):
    """下周末成都行：查高铁+天气+日历 → 条件笔记+闹钟+微信。"""

    templates = [
        '我想把下周末的成都行先大概定下来。你先查下周六北京到成都最早的高铁和成都当天的天气，再看看我日历那天上午有没有别的安排；如果天气不是雨天而且日历不冲突，就把车次、天气、出发时间写进一个"周末成都计划"的笔记，再给我设一个出发前1小时的闹钟，最后微信发给{contact}，问她那天见面方不方便。',
    ]
    apps = ["railway12306", "weather", "calendar", "clock", "notes", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "reasoning", "create", "handoff"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = (
        RAIL_QUERY_CHANGES
        + WEATHER_QUERY_CHANGES
        + CALENDAR_EVENT_CHANGES
        + NOTES_CREATE_CHANGES
        + CLOCK_ALARM_CHANGES
        + WECHAT_SEND_CHANGES
    )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        today = sim_today(input.os_init)
        days_until_sat = (5 - today.weekday()) % 7
        if days_until_sat == 0:
            days_until_sat = 7
        next_sat = today + datetime.timedelta(days=days_until_sat)
        target_date = next_sat.isoformat()
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        weather = Weather(input.apps["weather"])
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        searched = rail.check_searched(
            from_station="北京", to_station="成都", date=target_date, field="query.searched",
        )
        if not searched["passed"]:
            return [searched, {"field": "rest", "expected": "需先完成查询", "actual": "未查询", "passed": False}]
        train = rail.pick_train_for_route_strict(
            "earliest", from_station="北京", to_station="成都", only_high_speed=True,
        )
        if train is None:
            raise ValueError("No high-speed train found for 北京→成都")
        weather_day = weather.daily_by_date("成都", target_date)
        is_rainy = Weather.is_raining_text(str(weather_day.get("textDay") or "")) or \
                   Weather.is_raining_text(str(weather_day.get("textNight") or ""))
        has_conflict = calendar.init.count_events_on_date(next_sat) > 0
        if is_rainy or has_conflict:
            # 条件不满足：模板没有要求通知，只应停在查询结果，不新增输出产物。
            return [
                searched,
                notes.check_no_new_notes(field="no_weekend_trip_note"),
                calendar.check_no_new_events(field="no_weekend_trip_event"),
                clock.check_no_new_alarms(field="no_weekend_trip_alarm"),
                wechat.check_no_new_sent_to(
                    self.p.contact,
                    field="no_weekend_trip_message",
                    summary="条件不满足时不应微信通知联系人",
                ),
            ]
        dh, dm = map(int, str(train["departTime"]).split(":"))
        alarm_dt = datetime.datetime(2000, 1, 1, dh, dm) - datetime.timedelta(hours=1)
        return [
            searched,
            notes.check_note_with_title_contains(
                "周末成都计划", str(train["trainNo"]), field="memo_train",
            ),
            clock.check_alarm_at(alarm_dt.hour, alarm_dt.minute, field="alarm"),
            wechat.check_new_sent_contains(self.p.contact, field="wechat_ask"),
        ]

# ══════════════════════════════════════════════════════════════════════════
# 桌面定制任务
# ══════════════════════════════════════════════════════════════════════════
