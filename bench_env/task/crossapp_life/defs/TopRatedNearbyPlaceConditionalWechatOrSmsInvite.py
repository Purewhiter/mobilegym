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


class TopRatedNearbyPlaceConditionalWechatOrSmsInvite(BaseTask):
    """找附近最高评分地点 → 条件微信/短信通知。"""

    templates = [
        "帮我找附近{radius}内评分最高的{category}，评分相同优先选距离近的；如果开车不到2公里，就微信问{target}和{notify_to}要不要一起去；如果太远，就把地址发短信给{sms_contact}问TA要不要去。",
    ]
    apps = ["map", "wechat", "sms"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "reasoning", "handoff"]
    parameters = {
        "radius": {**RADIUS_PARAM, "default": 3000},
        "category": {**CATEGORY_PARAM, "default": "肯德基"},
        "target": {**WECHAT_CONTACT_PARAM, "default": "李娜"},
        "notify_to": {
            "type": "string",
            "default": "杨杰",
            "source": "apps.wechat.contacts[name]",
            "description": "第二个微信联系人",
        },
        "_contact_pair": {
            "sampler": Wechat.sample_two_friend_names,
            "fields": {"target": "target", "notify_to": "notify_to"},
        },
        "sms_contact": SMS_RECIPIENT_PARAM,
    }
    expected_changes = MAP_SEARCH_CHANGES + WECHAT_SEND_CHANGES + SMS_SEND_CHANGES

    async def _post_sample(self, env: Any) -> None:
        Map.require_rated_in_radius(self.p.category, float(self.p.radius))
        best = Map.best_rated_from_results(
            Map.geo_search(self.p.category, limit=0),
            max_distance_meters=float(self.p.radius),
        )
        Map.geo_route_from_current(str(best["place_id"]), "DRIVING")

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        map_app = Map(input.apps["map"], init=input.apps_init["map"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        sms = sms_from_input(input)
        search_check = map_app.check_searched(category=self.p.category, field="map_search_best")
        if not search_check["passed"]:
            return [search_check, {"field": "rest", "expected": "需先完成搜索", "actual": "未搜索", "passed": False}]
        best = Map.best_rated_from_results(
            Map.geo_search(self.p.category, limit=0),
            max_distance_meters=float(self.p.radius),
        )
        best_name = str(best["name"])
        address = Map.extract_address(best)
        route = Map.geo_route_from_current(str(best["place_id"]), "DRIVING")
        distance = float(route["distance_meters"])
        if distance < 2000:
            return [
                search_check,
                wechat.check_new_sent_any_of(
                    self.p.target,
                    ["一起", "去", "要不要"],
                    field="wechat_invite1",
                ),
                wechat.check_new_sent_norm_contains(
                    self.p.target,
                    best_name,
                    field="wechat_invite_place1",
                ),
                wechat.check_new_sent_any_of(
                    self.p.notify_to,
                    ["一起", "去", "要不要"],
                    field="wechat_invite2",
                ),
                wechat.check_new_sent_norm_contains(
                    self.p.notify_to,
                    best_name,
                    field="wechat_invite_place2",
                ),
                sms.check_no_new_sent_to(self.p.sms_contact, field="sms_no_extra"),
            ]
        else:
            return [
                search_check,
                sms.check_new_sent_to(self.p.sms_contact, address, field="sms_address"),
                wechat.check_no_new_sent_to(self.p.target, field="wechat_no_invite1"),
                wechat.check_no_new_sent_to(self.p.notify_to, field="wechat_no_invite2"),
            ]


# ══════════════════════════════════════════════════════════════════════════
# realistic.work — 会议预约
# ══════════════════════════════════════════════════════════════════════════
