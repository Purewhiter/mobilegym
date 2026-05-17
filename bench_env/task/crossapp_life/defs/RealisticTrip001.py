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


class RealisticTrip001(BaseTask):
    """后天去上海：查高铁+天气 → 条件写备忘/微信通知。"""

    templates = [
        '我后天想去上海出差，你先帮我看那天杭州到上海最早的高铁，再看看上海天气。如果不下雨，就把车次和天气写进一个标题为 上海出差备忘 的笔记里，再微信告诉{contact}我几点到，让她安排接站；如果下雨，就在消息里提醒她来时带伞。',
    ]
    apps = ["railway12306", "weather", "notes", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "reasoning", "create", "handoff"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = RAIL_QUERY_CHANGES + WEATHER_QUERY_CHANGES + NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        today = sim_today(input.os_init)
        target_date = (today + datetime.timedelta(days=2)).isoformat()
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        weather = Weather(input.apps["weather"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        searched = rail.check_searched(
            from_station="杭州", to_station="上海", date=target_date, field="query.searched",
        )
        if not searched["passed"]:
            return [searched, {"field": "rest", "expected": "需先完成查询", "actual": "未查询", "passed": False}]
        train = rail.pick_train_for_route_strict(
            "earliest", from_station="杭州", to_station="上海", only_high_speed=True,
        )
        if train is None:
            raise ValueError("No high-speed train found for 杭州→上海")
        weather_day = weather.daily_by_date("上海", target_date)
        is_rainy = Weather.is_raining_text(str(weather_day.get("textDay") or "")) or \
                   Weather.is_raining_text(str(weather_day.get("textNight") or ""))
        checks = [searched]
        if not is_rainy:
            checks.append(notes.check_note_with_title_contains(
                "上海出差备忘", str(train["trainNo"]), field="memo_train",
            ))
            checks.append(wechat.check_new_sent_match_time(
                self.p.contact, str(train["arriveTime"]), field="wechat_arrive",
            ))
        else:
            checks.append(wechat.check_new_sent_contains(
                self.p.contact, "伞", field="wechat_umbrella",
            ))
        return checks


# ══════════════════════════════════════════════════════════════════════════
# realistic.social — 社交约饭
# ══════════════════════════════════════════════════════════════════════════
