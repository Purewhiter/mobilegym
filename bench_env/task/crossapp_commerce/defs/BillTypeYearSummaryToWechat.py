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


class BillTypeYearSummaryToWechat(BaseTask):
    """按账单类型统计今年笔数和花费 → 微信通知。"""

    templates = [
        '去支付宝账单里查一下"{bill_type}"类型今年一共有多少笔，花了多少钱，微信告诉{contact}。',
    ]
    apps = ["alipay", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "handoff"]
    parameters = {
        "bill_type": {
            "type": "string",
            "default": "订单",
            "description": "账单类型关键词",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps_init["alipay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        year = sim_today(input.os_init).year
        count, spending = ali.bill_type_year_summary(
            str(self.p.bill_type),
            year,
            until_ms=now_ms(input.os_init),
        )
        return [
            wechat.check_new_sent_contains(
                self.p.contact,
                str(self.p.bill_type),
                field="wechat_bill_type",
            ),
            wechat.check_new_sent_contains_number(
                self.p.contact,
                count,
                tolerance=0.01,
                field="wechat_bill_count",
            ),
            wechat.check_new_sent_contains_number(
                self.p.contact,
                spending,
                tolerance=0.02,
                field="wechat_bill_spending",
            ),
        ]
