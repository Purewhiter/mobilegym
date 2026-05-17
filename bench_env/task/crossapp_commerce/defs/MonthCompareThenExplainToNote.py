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


class MonthCompareThenExplainToNote(BaseTask):
    """支付宝两月支出对比 → 差额计算 → 笔记记录。"""

    templates = [
        '你去支付宝看一下，{month1}和{month2}哪个月总花销更高，顺便把差额也算出来。然后在笔记新建一条"月度花销对比"，写上两个月的各自花销、哪个月花得更多、差多少。',
    ]
    apps = ["alipay", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "create"]
    parameters = {
        "month1": {
            "type": "string",
            "default": "2026-01",
            "description": "月份1",
            "display": "month_zh",
        },
        "month2": {
            "type": "string",
            "default": "2025-12",
            "description": "月份2",
            "display": "month_zh",
        },
    }
    expected_changes = NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps_init["alipay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        exp1 = ali.monthly_expense(self.p.month1)
        exp2 = ali.monthly_expense(self.p.month2)
        diff = round(abs(exp1 - exp2), 2)
        checks = [
            notes.check_note_title_exists("月度花销对比", field="note_title"),
            notes.check_latest_contains_all_numbers(
                [round(exp1, 2), round(exp2, 2), diff],
                field="note_numbers",
            ),
        ]
        if exp1 > exp2:
            winner = self.p.month1
        elif exp2 > exp1:
            winner = self.p.month2
        else:
            winner = "一样"
        parts = str(winner).split("-")
        expected_winner = f"{parts[0]}年{int(parts[1])}月" if len(parts) == 2 else winner
        checks.append(notes.check_latest_contains(expected_winner, field="note_winner"))
        return checks
