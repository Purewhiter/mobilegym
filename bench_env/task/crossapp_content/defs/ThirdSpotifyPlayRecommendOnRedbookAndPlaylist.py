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


class ThirdSpotifyPlayRecommendOnRedbookAndPlaylist(BaseTask):
    """Spotify 第三首歌 → 小红书推荐 → 加入新歌单。"""

    templates = [
        '看一下我今天在Spotify听的第三首歌是什么，然后去小红书发一条推荐，正文里带上歌名和歌手；发完以后再把这首歌加进一个新歌单"{playlist}"。',
    ]
    apps = ["spotify", "redbook"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "create", "handoff"]
    parameters = {
        "playlist": {"type": "string", "default": "今天爱听"},
    }
    expected_changes = SPOTIFY_PLAYLIST_WITH_PLAYBACK_CHANGES + REDBOOK_PUBLISH_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sp = Spotify(input.apps["spotify"], init=input.apps_init["spotify"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        track = sp.init.nth_today_play(3)
        song_title = str(track["title"])
        artist = str(track["artist"])
        return [
            rb.check_note_published(
                text_keywords=(song_title, artist),
                new_only=True,
                field="redbook_post",
            ),
            sp.check_playlist_exists(self.p.playlist, field="playlist_exists"),
            sp.check_playlist_has_titles(
                self.p.playlist, [song_title], field="playlist_has_song",
            ),
        ]


# ══════════════════════════════════════════════════════════════════════════
# realistic.harder — 高难度复合任务
# ══════════════════════════════════════════════════════════════════════════
