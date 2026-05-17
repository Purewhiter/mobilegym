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


class ChangeWallpaperAndAddWidget(BaseTask):
    """换桌面壁纸 + 添加大桔观小组件。"""

    templates = [
        "把桌面背景换一下，然后添加大桔观小组件",
    ]
    apps = []
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings", "nav"]
    parameters = {}
    expected_changes = ["os.launcher"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        launcher = Launcher(input.os, init=input.os_init)
        launcher_init = (input.os_init or {}).get("launcher") or {}
        launcher_now = (input.os or {}).get("launcher") or {}
        # 壁纸是否变化
        init_wp = launcher_init.get("wallpaper") or {}
        curr_wp = launcher_now.get("wallpaper") or {}
        wp_changed = init_wp != curr_wp
        dajuguan_id = "347f3ecf-cd69-414b-8e25-41223586fd2b"
        return [
            {
                "field": "wallpaper_changed",
                "expected": "壁纸已更换",
                "actual": {"init": init_wp, "curr": curr_wp},
                "passed": wp_changed,
            },
            launcher.check_wmr_widget_added(
                dajuguan_id,
                label="大桔观",
                field="widget_added",
            ),
        ]
