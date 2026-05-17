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


class CreateEventWithAlarmAndConfirm(BaseTask):
    """创建日程 + 提前30分钟提醒。"""

    templates = [
        '{date}的晚上6点半到8点，帮我在日历里安排一个日程叫"{title}"，再顺手加个提前30分钟提醒，闹钟提醒打开。',
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["create", "settings"]
    parameters = {
        "date": {
            "type": "string",
            "sampler": Calendar.sample_future_date,
            "default": default_tomorrow,
            "display": "date_hao",
        },
        "title": {"type": "string", "default": "面试"},
    }
    expected_changes = ["calendar.events", "calendar.selectedDateTs"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        start_ts = Calendar.timestamp(self.p.date, "18:30")
        end_ts = Calendar.timestamp(self.p.date, "20:00")
        return [
            calendar.check_event_created(self.p.title),
            calendar.check_event_time(self.p.title, start_ts, end_ts),
            calendar.check_event_start_reminder_alarm(
                self.p.title, start_ts,
                reminder_minutes_before=30,
                field="reminder_30min",
            ),
        ]

# ══════════════════════════════════════════════════════════════════════════
# realistic.trip — 出行规划
# ══════════════════════════════════════════════════════════════════════════
