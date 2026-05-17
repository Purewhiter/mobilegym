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


class WeeklyReadingAndLikedSpotifySongsToMoment(BaseTask):
    """微信读书最久一天 + Spotify 已点赞歌 → 朋友圈。"""

    templates = [
        '帮我看微信读书最近一周哪天读得最久，再把Spotify今天听过且已经点赞的歌的歌名和作者汇总一下，最后发条朋友圈，把"最近阅读最投入的一天"和"现在在听的歌"都带上。',
    ]
    apps = ["wechat_reading", "spotify", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["create", "reasoning", "social", "handoff"]
    parameters = {}
    expected_changes = WECHAT_MOMENT_CHANGES + ["apps.spotify"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps_init["wechat_reading"])
        sp = Spotify(input.apps_init["spotify"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        best_date, minutes = wr.best_reading_day_and_duration(input.os_init)
        liked_recent = sp.liked_recent_intersection()
        date_labels = WechatReading.date_labels(best_date, input.os_init)
        # 朋友圈应包含阅读相关信息和歌曲信息
        checks: list[dict[str, Any]] = []
        # 验证朋友圈包含阅读日期
        moment_content = wechat._latest_new_moment_content()
        reading_mentioned = any(label in moment_content for label in date_labels)
        checks.append({
            "field": "moment_reading",
            "expected": f"朋友圈包含阅读日 {date_labels[:3]}",
            "actual": moment_content[:200] or "(none)",
            "passed": bool(moment_content) and reading_mentioned,
        })
        if liked_recent:
            first_song = str(liked_recent[0]["title"])
            checks.append(wechat.check_new_moment_contains(first_song, field="moment_song"))
        else:
            checks.append({
                "field": "moment_exists",
                "expected": "新朋友圈",
                "actual": len(wechat.new_moments_by_me()),
                "passed": len(wechat.new_moments_by_me()) > 0,
            })
        return checks
