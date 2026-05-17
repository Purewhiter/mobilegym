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


class Top3ExpenseSummaryToWechat(BaseTask):
    """最近30天 top3 支出 → 微信发送。"""

    templates = [
        '去支付宝看看最近30天里金额最大的3笔支出分别是什么，把交易标题和金额发微信告诉{contact}，最后一句加上"我最近得省着点了"。',
    ]
    apps = ["alipay", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "handoff"]
    parameters = {"contact": {**WECHAT_CONTACT_PARAM, "default": "黄勇"}}
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps_init["alipay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        ts_now = now_ms(input.os_init)
        thirty_days_ago = ts_now - 30 * 86400 * 1000
        expenses = [
            tx for tx in ali.transactions
            if float(tx["delta"]) < 0 and int(tx["timestamp"]) >= thirty_days_ago
        ]
        expenses.sort(key=lambda tx: abs(float(tx["delta"])), reverse=True)
        top3 = expenses[:3]
        checks: list[dict[str, Any]] = []
        for i, tx in enumerate(top3):
            amount = round(abs(float(tx["delta"])), 2)
            checks.append(wechat.check_new_sent_contains_number(
                self.p.contact, amount, field=f"wechat_top{i+1}_amount",
            ))
        checks.append(wechat.check_new_sent_contains(
            self.p.contact, "省着点", field="wechat_closing",
        ))
        return checks


# ══════════════════════════════════════════════════════════════════════════
# Calendar 衍生任务
# ══════════════════════════════════════════════════════════════════════════
