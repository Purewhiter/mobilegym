"""
Cross-app Work & Productivity (crossapp_work).

办公协作：腾讯会议、日历、时钟、微信、短信、地图、天气。

详见各 Task 类 docstring；共享判定逻辑在对应 App 的 `app.py`（TencentMeeting / Calendar 等）。
"""
# -- Task Index (auto-generated, do not edit) --
# 12 tasks | L2×2  L3×5  L4×5
#
# [L4] ExistingMeetingToCalendar          查一下'{topic}'会议几点开始，帮我在日历里加个事件提醒,开始时间跟会议开始时间一致
# [L3] CalendarEarliestToAlarm            看看我明天日历上最早的日程几点开始，提前半小时帮我设个闹钟
# [L2] MeetingLongestInfoToWechat         帮我看看{date}腾讯会议哪场开得最久，把那场的会议号和主题用微信告诉{contact}
# [L3] MeetingDurationToWechat            查看腾讯会议{date}这天我一共开了多久的会，把总时长发给微信好友{contact}
# [L2] WeatherConditionalCancelMeeting    看{city}明天天气，如果有雨就在腾讯会议取消主题为'{topic}'的会议；如果不下雨就保留该会议并设置一个该会议开始前半小时的闹钟
# [L3] MeetingJoinAndNotifySms            加入'{topic}'会议，把昵称改成{name}，然后发短信给{contact}告知已入会
# [L4] MeetingMultiChannelNotify          帮我在腾讯会议创建一个会议，然后把会议号通过微信发给{contact1}，通过短信发给{contact2}
# [L3] MeetingRouteEtaToWechat            查一下我下一场腾讯会议几点开始，搜一下走到{place}要多久，发微信告诉{contact}我还有多久到和会议时间
# [L4] MeetingFullFlowToWechat            帮我在腾讯会议预约明天{time}的项目周会，在日历上加个日程提醒，日程设一个提前15分钟的闹钟，最后把会议号微信发给{contact}
# [L4] FullMeetingConflictCheckBroadcast  检查日历上明天{time}有没有安排，如果有空就在腾讯会议预约主题为「{flow_topic}」的会议，日历创建同名日程（开始时间与会议一致，设提前15分钟的提醒闹钟），会议号微信发给{contact}，短信发给{contact2}；有安排的话微信告诉{contact}那个时间不行
# [L4] MeetingReminderToNotes             看看腾讯会议有没有待开始的会议，把会议主题和开始时间记到笔记 APP里。如果没有待开的，就把进行中的记下来。
# [L3] SmsAndCalendarOnDate               给 {contact} 发短信 {message}，并在明天创建标题为 {event_title} 的日历日程。
# -- End Task Index --


from __future__ import annotations

import datetime
import random
import re
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.calendar.app import CALENDAR_EVENT_CHANGES, Calendar
from bench_env.task.clock.app import CLOCK_ALARM_CHANGES, Clock
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.judge import JudgeInput
from bench_env.task.map.app import MAP_SEARCH_CHANGES, PLACE_PARAM, Map
from bench_env.task.notes.app import NOTES_CREATE_CHANGES, Notes
from bench_env.task.sms.app import SMS_RECIPIENT_PARAM, SMS_SEND_CHANGES, SMS_UNREAD_SENDERS, Sms, sms_from_input
from bench_env.task.tencent_meeting.app import (
    TencentMeeting,
    TENCENT_MEETING_NEW_MEETING_TOPICS,
    TENCENT_MEETING_SCHEDULED_TOPIC_PARAM,
)
from bench_env.task.utils import now_ms, parse_date as _parse_date, parse_duration_to_minutes, sim_today, tomorrow_ymd
from bench_env.task.weather.app import Weather
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_SEND_CHANGES, Wechat


# ══════════════════════════════════════════════════════════════════════════
# L3
# ══════════════════════════════════════════════════════════════════════════


class ExistingMeetingToCalendar(BaseTask):
    """判定：日历新增与 {topic} 预约会议开始时间一致的日程（标题同主题）。"""

    templates = [
        "查一下'{topic}'会议几点开始，帮我在日历里加个事件提醒,开始时间跟会议开始时间一致",
    ]
    apps = ["tencent_meeting", "calendar"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["query", "create", "transfer"]
    parameters = {"topic": TENCENT_MEETING_SCHEDULED_TOPIC_PARAM}
    expected_changes = [
        "calendar.events",
        "calendar.selectedDateTs",
        "tencent_meeting.scheduledMeetings",
        "tencent_meeting.currentScheduledMeeting",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        cal = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        meeting = tm.find_scheduled_meeting(self.p.topic)
        target_ms = TencentMeeting.meeting_start_timestamp_ms(meeting)
        return [
            cal.check_event_start_aligns_ms(self.p.topic, target_ms, field="calendar_event_matches_meeting"),
        ]
class CalendarEarliestToAlarm(BaseTask):
    """判定：新增闹钟为「明日最早日程」开始前 30 分钟。"""

    templates = [
        "看看我明天日历上最早的日程几点开始，提前半小时帮我设个闹钟",
        "Check what time the earliest event on my calendar starts tomorrow and set an alarm 30 minutes before it",
    ]
    apps = ["calendar", "clock"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning", "create"]
    parameters = {}
    expected_changes = ["calendar.events", "calendar.selectedDateTs", "clock.alarms"]

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        tomorrow = sim_today(state["os"]) + datetime.timedelta(days=1)
        cur = int(state["os"]["time"]["timestamp"])
        calendar_state = Calendar(state["apps"]["calendar"]).prepare_state_with_event(
            event_id="crossapp_work_earliest_a",
            title="临时早会A",
            date_text=tomorrow.isoformat(),
            start_time="09:30",
            end_time="10:30",
            created_at=cur,
        )
        calendar_state = Calendar(calendar_state).prepare_state_with_event(
            event_id="crossapp_work_earliest_b",
            title="临时早会B",
            date_text=tomorrow.isoformat(),
            start_time="11:00",
            end_time="12:00",
            created_at=cur,
        )
        await env.set_state({"apps": {"calendar": calendar_state}}, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        cal = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        clk = Clock(input.apps["clock"], init=input.apps_init["clock"])
        tomorrow = sim_today(input.os) + datetime.timedelta(days=1)
        first = cal.init.first_event_on_date(tomorrow)
        start_ts = cal.coerce_ts(first["startTs"], tomorrow)
        if start_ts is None:
            raise ValueError("最早日程缺少 startTs")
        dt = datetime.datetime.fromtimestamp(start_ts / 1000.0) - datetime.timedelta(minutes=30)
        return [
            clk.check_alarm_at(dt.hour, dt.minute, field="alarm_before_first_event"),
        ]


class MeetingLongestInfoToWechat(BaseTask):
    """判定：{date} 时长最长且唯一的历史会议，其会议号与主题发到微信 {contact}。"""

    templates = [
        "帮我看看{date}腾讯会议哪场开得最久，把那场的会议号和主题用微信告诉{contact}",
    ]
    apps = ["tencent_meeting", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["query", "reasoning", "transfer"]
    parameters = {
        "date": {
            "type": "string",
            "display": "date_zh",
            "values": {"2月3日": "2026-02-03", "2月4日": "2026-02-04"},
            "default": "2026-02-03",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        longest = tm.longest_history_meeting_on_date(self.p.date)
        topic = str(longest["title"])
        mid = str(longest["meetingId"])
        return [
            wechat.check_new_sent_norm_contains(
                self.p.contact,
                mid,
                topic,
                field="wechat_longest_meeting",
            )
        ]


class MeetingDurationToWechat(BaseTask):
    """判定：微信新消息中的总时长与 {date} 当天历史会议参会时长之和用 match_duration 匹配。"""

    templates = [
        "查看腾讯会议{date}这天我一共开了多久的会，把总时长发给微信好友{contact}",
    ]
    apps = ["tencent_meeting", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning", "transfer"]
    parameters = {
        "date": {
            "type": "string",
            "display": "date_zh",
            "values": {"2月3日": "2026-02-03", "2月4日": "2026-02-04"},
            "default": "2026-02-03",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        total_m = tm.total_participation_minutes_on_date(self.p.date)
        expected = TencentMeeting.format_duration_minutes_zh(total_m)
        return [
            wechat.check_new_sent_match_duration(self.p.contact, expected, field="wechat_total_duration"),
        ]


# ══════════════════════════════════════════════════════════════════════════
# L4 — 条件 / 计算
# ══════════════════════════════════════════════════════════════════════════
class WeatherConditionalCancelMeeting(BaseTask):
    """有雨→取消会议；不下雨→保留会议 + 设会前 30 分钟闹钟。两个分支返回等长 check list。"""

    templates = [
        "看{city}明天天气，如果有雨就在腾讯会议取消主题为'{topic}'的会议；如果不下雨就保留该会议并设置一个该会议开始前半小时的闹钟",
    ]
    apps = ["weather", "tencent_meeting", "clock"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["query", "reasoning", "edit", "create"]
    parameters = {
        "city": {"type": "string", "source": "apps.weather.savedCities[name]", "default": "北京"},
        "topic": TENCENT_MEETING_SCHEDULED_TOPIC_PARAM,
    }
    expected_changes = [
        "tencent_meeting.scheduledMeetings",
        "tencent_meeting.currentScheduledMeeting",
        "weather.bundlesByCityId",
        "weather.selectedCityId",
        "clock.alarms",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        w = Weather(input.apps["weather"])
        tm = TencentMeeting(input.apps["tencent_meeting"])
        clk = Clock(input.apps["clock"], init=input.apps_init["clock"])
        rain = w.tomorrow_is_rainy(self.p.city)
        if rain:
            return [
                tm.check_scheduled_meeting_cancelled(self.p.topic, field="cancel_if_rain"),
                {"field": "alarm_before_meeting_if_dry", "passed": True,
                 "expected": "跳过（下雨分支）", "actual": "跳过（下雨分支）"},
            ]
        tm_init = TencentMeeting(input.apps_init["tencent_meeting"])
        meeting = tm_init.find_scheduled_meeting(self.p.topic)
        start_ms = TencentMeeting.meeting_start_timestamp_ms(meeting)
        alarm_dt = datetime.datetime.fromtimestamp(start_ms / 1000.0) - datetime.timedelta(minutes=30)
        return [
            tm.check_scheduled_meeting_present(self.p.topic, field="keep_if_dry"),
            clk.check_created_alarm(alarm_dt.hour, alarm_dt.minute, field="alarm_before_meeting_if_dry"),
        ]
# ══════════════════════════════════════════════════════════════════════════
# L4 — 创建 + 通知
# ══════════════════════════════════════════════════════════════════════════
class MeetingJoinAndNotifySms(BaseTask):
    """加入「{topic}」会议，改名 {name}，发短信表示已入会。"""

    templates = [
        "加入'{topic}'会议，把昵称改成{name}，然后发短信给{contact}告知已入会",
    ]
    apps = ["tencent_meeting", "sms"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["nav", "edit", "transfer"]
    parameters = {
        "topic": {
            "type": "enum",
            "values": {
                "老王的快速会议": "老王的快速会议",
                "产品需求讨论": "产品需求讨论",
                "技术方案评审": "技术方案评审",
            },
            "default": "老王的快速会议",
        },
        "name": {"type": "string", "default": "访客小王"},
        "contact": SMS_RECIPIENT_PARAM,
    }
    expected_changes = [
        "tencent_meeting.activeMeeting",
        "tencent_meeting.currentScheduledMeeting",
        "os.providers.sms",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"])
        sms = sms_from_input(input)
        entry = tm.find_ongoing_entry_by_topic(self.p.topic)
        active_chk = tm.check_active_matches_ongoing(entry)
        name_chk = tm.check_self_participant_name(self.p.name)
        sms_chk = sms.check_new_sent_to(self.p.contact, "入会", field="sms_joined")
        return [active_chk, name_chk, sms_chk]


# ══════════════════════════════════════════════════════════════════════════
# L4 — 3 App
# ══════════════════════════════════════════════════════════════════════════


class MeetingMultiChannelNotify(BaseTask):
    """新建会议后，微信与短信新消息均含同一会议号。"""

    templates = [
        "帮我在腾讯会议创建一个会议，然后把会议号通过微信发给{contact1}，通过短信发给{contact2}",
    ]
    apps = ["tencent_meeting", "wechat", "sms"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["create", "transfer"]
    parameters = {
        "contact1": {
            "type": "string",
            "source": "apps.wechat.contacts[name]",
            "default": "张伟",
        },
        "contact2": SMS_RECIPIENT_PARAM,
    }
    expected_changes = [
        "tencent_meeting.scheduledMeetings",
        "tencent_meeting.currentScheduledMeeting",
        "tencent_meeting.activeMeeting",
        "tencent_meeting.history",
    ] + WECHAT_SEND_CHANGES + ["os.providers.sms"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"], init=input.apps_init["tencent_meeting"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        sms = sms_from_input(input)
        # 优先查新预约会议，其次查快速会议（activeMeeting）
        new_m = tm.any_new_scheduled_meeting()
        mid: str | None = None
        if new_m is not None:
            mid = re.sub(r"\s+", "", str(new_m["meetingId"]))
        elif tm.active_meeting is not None:
            mid = re.sub(r"\s+", "", str(tm.active_meeting["meetingId"]))
        if not mid:
            return [
                {
                    "field": "multichannel_id",
                    "expected": "微信与短信均含新会议号",
                    "actual": "未创建新会议",
                    "passed": False,
                }
            ]
        w_chk = wechat.check_new_sent_meeting_id(self.p.contact1, mid, field="multichannel_wechat")
        s_chk = sms.check_new_outgoing_contains_meeting_id(self.p.contact2, mid, field="multichannel_sms")
        return [
            {
                "field": "multichannel_id",
                "expected": f"两端含会议号 {mid}",
                "actual": {"wechat": w_chk["actual"], "sms": s_chk["actual"]},
                "passed": w_chk["passed"] and s_chk["passed"],
            }
        ]


class MeetingRouteEtaToWechat(BaseTask):
    """微信消息同时含步行到 {place} 的路线时长与下一场会议开始时间。"""

    templates = [
        "查一下我下一场腾讯会议几点开始，搜一下走到{place}要多久，发微信告诉{contact}我还有多久到和会议时间",
    ]
    apps = ["tencent_meeting", "map", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "search", "reasoning", "transfer"]
    parameters = {
        "place": PLACE_PARAM,
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES + MAP_SEARCH_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        route = Map.geo_route_to(self.p.place, "WALKING")
        dur = str(route["duration"])
        meet = tm.first_upcoming_scheduled(now_ms(input.os_init))
        t_str = TencentMeeting.meeting_start_hh_mm(meet)
        return [
            wechat.check_new_sent_route_duration_and_meeting_time(
                self.p.contact,
                dur,
                t_str,
                field="wechat_eta_and_meeting",
            ),
        ]
# ══════════════════════════════════════════════════════════════════════════
# L4 — 长流程
# ══════════════════════════════════════════════════════════════════════════


class MeetingFullFlowToWechat(BaseTask):
    """明日 {time} 项目周会：腾讯会议预约 + 日历日程（提前 15 分钟提醒/闹钟）+ 微信会议号。

    判定以日历 `reminderMinutesBefore=15` 与 `alarmEnabled=True` 为准，不要求单独到时钟 App。
    """

    templates = [
        "帮我在腾讯会议预约明天{time}的项目周会，在日历上加个日程提醒，日程设一个提前15分钟的闹钟，最后把会议号微信发给{contact}",
    ]
    apps = ["tencent_meeting", "calendar", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["create", "transfer"]
    parameters = {
        "time": {"type": "string", "default": "10:00"},
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = [
        "tencent_meeting.scheduledMeetings",
        "tencent_meeting.currentScheduledMeeting",
    ] + CALENDAR_EVENT_CHANGES + WECHAT_SEND_CHANGES
    title_meeting = "项目周会"

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"], init=input.apps_init["tencent_meeting"])
        cal = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        target_ms = Calendar.tomorrow_timestamp_ms_at_hh_mm(input.os, self.p.time)
        meeting = tm.new_scheduled_meeting_by_title(self.title_meeting)
        tm_chk = tm.check_new_scheduled_start_time(
            self.title_meeting,
            target_ms,
            time_hhmm=self.p.time,
            field="flow_meeting",
            expected_summary=f"明日{self.p.time} {self.title_meeting}",
        )
        cal_chk = cal.check_event_start_reminder_alarm(
            self.title_meeting,
            target_ms,
            field="flow_calendar_alarm15",
        )
        if meeting is None:
            wx_chk = {
                "field": "flow_wechat",
                "expected": f"含 {self.title_meeting!r} 会议号",
                "actual": "(未创建新会议)",
                "passed": False,
            }
        else:
            mid = re.sub(r"\s+", "", str(meeting["meetingId"]))
            wx_chk = wechat.check_new_sent_meeting_id(self.p.contact, mid, field="flow_wechat")
        return [tm_chk, cal_chk, wx_chk]


class FullMeetingConflictCheckBroadcast(BaseTask):
    """明日 {time}：若日历该时段已有安排则仅微信告知不可；否则完整预约 + 日历（提前15分钟提醒）+ 微信 + 短信。

    冲突/空闲两分支：在 ``_post_sample`` 内用 ``Task`` 的 ``_seed`` 驱动是否注入占坑日程，
    **不**使用 ``parameters`` 或 ``TaskSampler``；判题只读日历上的真实时段重叠。
    """

    templates = [
        "检查日历上明天{time}有没有安排，如果有空就在腾讯会议预约主题为「{flow_topic}」的会议，日历创建同名日程（开始时间与会议一致，设提前15分钟的提醒闹钟），会议号微信发给{contact}，短信发给{contact2}；有安排的话微信告诉{contact}那个时间不行",
    ]
    apps = ["calendar", "tencent_meeting", "wechat", "sms"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["query", "reasoning", "create", "transfer"]
    parameters = {
        "time": {"type": "string", "default": "03:30", "description": "明日检查时刻 HH:MM"},
        "contact": WECHAT_CONTACT_PARAM,
        "contact2": SMS_RECIPIENT_PARAM,
        "flow_topic": {"type": "string", "default": "临时协调会"},
    }
    expected_changes = CALENDAR_EVENT_CHANGES + [
        "tencent_meeting.scheduledMeetings",
        "tencent_meeting.currentScheduledMeeting",
    ] + WECHAT_SEND_CHANGES + ["os.providers.sms"]

    async def _post_sample(self, env: Any) -> None:
        rng = random.Random((self._seed or 0) ^ 0xC001D00D)
        self._injected_conflict = rng.choice((False, True))
        if not self._injected_conflict:
            return
        state = await env.get_state()
        tomorrow = tomorrow_ymd(state["os"])
        h, m = Calendar.parse_hh_mm(self.p.time)
        cur = int(state["os"]["time"]["timestamp"])
        calendar_state = Calendar(state["apps"]["calendar"]).prepare_state_with_event(
            event_id="crossapp_work_conflict_block",
            title="占用的固定安排",
            date_text=tomorrow,
            start_time=f"{max(0, h - 1):02d}:{m:02d}",
            end_time=f"{min(23, h + 2):02d}:{m:02d}",
            created_at=cur,
            reminder_minutes_before=0,
        )
        await env.set_state({"apps": {"calendar": calendar_state}}, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        cal = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        tm = TencentMeeting(input.apps["tencent_meeting"], init=input.apps_init["tencent_meeting"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        sms = sms_from_input(input)
        tomorrow = sim_today(input.os) + datetime.timedelta(days=1)
        h, minute = Calendar.parse_hh_mm(self.p.time)
        has_conflict = cal.init.event_blocks_slot_on_date(tomorrow, h, minute)

        topic = str(self.p.flow_topic)

        if has_conflict:
            return [
                wechat.check_new_sent_any_of(
                    self.p.contact,
                    ["不行", "冲突", "排不开"],
                    field="reject_wechat",
                ),
                tm.check_no_new_scheduled_meeting(topic, field="busy_no_meeting"),
                cal.check_no_event_created(topic, field="busy_no_calendar_event"),
                sms.check_no_new_sent_to(self.p.contact2, field="busy_no_sms"),
            ]

        # --- free 分支：完整预约 + 日历（提前15分钟提醒）+ 微信 + 短信 ---
        target_ms = Calendar.tomorrow_timestamp_ms_at_hh_mm(input.os, self.p.time)
        meeting = tm.new_scheduled_meeting_by_title(topic)
        mid = re.sub(r"\s+", "", str(meeting["meetingId"])) if meeting else ""
        return [
            tm.check_new_scheduled_start_time(
                topic, target_ms,
                tolerance_ms=8 * 60 * 1000,
                time_hhmm=self.p.time,
                field="free_flow_meeting",
                expected_summary=f"新预约 {topic} @明日{self.p.time}",
            ),
            cal.check_event_start_reminder_alarm(
                topic, target_ms,
                tolerance_ms=8 * 60 * 1000,
                field="free_flow_calendar",
            ),
            wechat.check_new_sent_meeting_id(self.p.contact, mid, field="free_flow_wechat"),
            sms.check_new_outgoing_contains_meeting_id(self.p.contact2, mid, field="free_flow_sms"),
        ]
class MeetingReminderToNotes(BaseTask):
    """判定：把待开始或进行中的会议主题和开始时间记到备忘录。"""

    templates = [
        "看看腾讯会议有没有待开始的会议，把会议主题和开始时间记到笔记 APP里。如果没有待开的，就把进行中的记下来。",
        "Check if there are any upcoming meetings in Tencent Meeting and note down the topic and start time in Notes. If there are none upcoming, note down the ongoing ones instead.",
    ]
    apps = ["tencent_meeting", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["query", "create", "transfer"]
    parameters = {}
    expected_changes = [
        "tencent_meeting.scheduledMeetings",
        "tencent_meeting.currentScheduledMeeting",
    ] + NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        target_meetings, expected_type = tm.upcoming_or_ongoing()
        if not target_meetings:
            raise ValueError("No upcoming or ongoing meetings found in Tencent Meeting")
        keywords: list[str] = []
        for meeting in target_meetings:
            keywords.append(str(meeting["title"]))
            keywords.append(tm.parse_meeting_time(meeting["startTime"]).strftime("%H:%M"))
        note_chk = notes.check_latest_contains(*keywords, field="meeting_note")
        note_chk["expected"] = f"Note with all {expected_type} meetings ({len(target_meetings)})"
        return [note_chk]


class SmsAndCalendarOnDate(BaseTask):
    """判定：发送短信并在指定日期创建日历日程。"""

    templates = [
        "给 {contact} 发短信 {message}，并在明天创建标题为 {event_title} 的日历日程。",
        "Send an SMS to {contact} saying {message}, and create a calendar event titled {event_title} for tomorrow.",
    ]
    apps = ["sms", "calendar"]
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["create", "transfer"]
    parameters = {
        "contact": SMS_RECIPIENT_PARAM,
        "message": {"type": "string", "default": "明天见"},
        "event_title": {"type": "string", "default": "约会"},
    }
    expected_changes = SMS_SEND_CHANGES + CALENDAR_EVENT_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        tomorrow = (sim_today(input.os) + datetime.timedelta(days=1)).isoformat()
        return [
            sms.check_new_sent_to(self.p.contact, str(self.p.message), field="sms"),
            calendar.check_event_created(self.p.event_title, field="calendar_event_created"),
            calendar.check_event_on_date(self.p.event_title, tomorrow, field="calendar_event_date"),
        ]
