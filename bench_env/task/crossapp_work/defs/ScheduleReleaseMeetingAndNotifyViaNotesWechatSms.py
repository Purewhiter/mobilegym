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


class ScheduleReleaseMeetingAndNotifyViaNotesWechatSms(BaseTask):
    """创建腾讯会议 → 笔记 → 微信+短信通知。"""

    templates = [
        "帮我建一个明天早上 9 点的 版本发布会 ，时长15分钟，密码123456；建好以后把会议信息记进笔记，再微信发给{contact}，短信发给{sms_contact}。",
    ]
    apps = ["tencent_meeting", "notes", "wechat", "sms"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["create", "handoff"]
    parameters = {
        "contact": WECHAT_CONTACT_PARAM,
        "sms_contact": SMS_RECIPIENT_PARAM,
    }
    expected_changes = [
        "tencent_meeting.scheduledMeetings",
        "tencent_meeting.currentScheduledMeeting",
    ] + NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES + SMS_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"], init=input.apps_init["tencent_meeting"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        sms = sms_from_input(input)
        topic = "版本发布会"
        target_ms = Calendar.tomorrow_timestamp_ms_at_hh_mm(input.os, "09:00")
        pwd_chk = tm.check_new_scheduled_password(topic, "123456")
        st_dur_chk = tm.check_new_scheduled_start_and_duration(
            topic, target_ms, 15, time_hhmm="09:00", field="scheduled_time_duration",
        )
        meeting = tm.new_scheduled_meeting_by_title(topic)
        if meeting is None:
            return [
                pwd_chk, st_dur_chk,
                {"field": "notes", "expected": "会议信息", "actual": "(无新会议)", "passed": False},
            ]
        mid = str(meeting["meetingId"])
        return [
            pwd_chk,
            st_dur_chk,
            notes.check_latest_contains_meeting_id_and_password(
                mid, "123456", field="notes_meeting",
            ),
            wechat.check_new_sent_meeting_id_and_password(
                self.p.contact, mid, "123456", field="wechat_meeting",
            ),
            sms.check_new_outgoing_contains_meeting_id_and_password(
                self.p.sms_contact, mid, "123456", field="sms_meeting",
            ),
        ]


# ══════════════════════════════════════════════════════════════════════════
# realistic.content — 内容创作
# ══════════════════════════════════════════════════════════════════════════
