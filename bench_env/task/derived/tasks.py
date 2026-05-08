"""
Derived task definitions — 组合已有 App 能力的跨 App 复合任务。

覆盖：支付宝账单分析+笔记/微信、转账+余额+通知、日历改期+答题卡、
出行规划、社交约饭、会议预约、内容创作、设备设置+桌面定制等场景。
"""

from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.alipay.app import Alipay
from bench_env.task.base import BaseTask
from bench_env.task.calendar.app import CALENDAR_EVENT_CHANGES, Calendar
from bench_env.task.clock.app import CLOCK_ALARM_CHANGES, Clock
from bench_env.task.hard.app import Launcher
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

# ══════════════════════════════════════════════════════════════════════════
# Alipay 衍生任务
# ══════════════════════════════════════════════════════════════════════════

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
    capabilities = ["query", "reasoning", "create"]
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
    capabilities = ["query", "reasoning", "transfer"]
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
    capabilities = ["query", "reasoning", "transfer"]
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


class RealisticTrip001(BaseTask):
    """后天去上海：查高铁+天气 → 条件写备忘/微信通知。"""

    templates = [
        '我后天想去上海出差，你先帮我看那天杭州到上海最早的高铁，再看看上海天气。如果不下雨，就把车次和天气写进一个标题为 上海出差备忘 的笔记里，再微信告诉{contact}我几点到，让她安排接站；如果下雨，就在消息里提醒她来时带伞。',
    ]
    apps = ["railway12306", "weather", "notes", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "query", "reasoning", "create", "transfer"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = RAIL_QUERY_CHANGES + WEATHER_QUERY_CHANGES + NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        today = sim_today(input.os_init)
        target_date = (today + datetime.timedelta(days=2)).isoformat()
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        weather = Weather(input.apps["weather"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        searched = rail.check_searched(
            from_station="杭州", to_station="上海", date=target_date, field="query.searched",
        )
        if not searched["passed"]:
            return [searched, {"field": "rest", "expected": "需先完成查询", "actual": "未查询", "passed": False}]
        train = rail.pick_train_for_route_strict(
            "earliest", from_station="杭州", to_station="上海", only_high_speed=True,
        )
        if train is None:
            raise ValueError("No high-speed train found for 杭州→上海")
        weather_day = weather.daily_by_date("上海", target_date)
        is_rainy = Weather.is_raining_text(str(weather_day.get("textDay") or "")) or \
                   Weather.is_raining_text(str(weather_day.get("textNight") or ""))
        checks = [searched]
        if not is_rainy:
            checks.append(notes.check_note_with_title_contains(
                "上海出差备忘", str(train["trainNo"]), field="memo_train",
            ))
            checks.append(wechat.check_new_sent_match_time(
                self.p.contact, str(train["arriveTime"]), field="wechat_arrive",
            ))
        else:
            checks.append(wechat.check_new_sent_contains(
                self.p.contact, "伞", field="wechat_umbrella",
            ))
        return checks


# ══════════════════════════════════════════════════════════════════════════
# realistic.social — 社交约饭
# ══════════════════════════════════════════════════════════════════════════


class TopRatedNearbyPlaceConditionalWechatOrSmsInvite(BaseTask):
    """找附近最高评分地点 → 条件微信/短信通知。"""

    templates = [
        "帮我找附近{radius}内评分最高的{category}，评分相同优先选距离近的；如果开车不到2公里，就微信问{target}和{notify_to}要不要一起去；如果太远，就把地址发短信给{sms_contact}问TA要不要去。",
    ]
    apps = ["map", "wechat", "sms"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "reasoning", "transfer"]
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
    capabilities = ["create", "transfer"]
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
    capabilities = ["query", "reasoning", "social"]
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
    capabilities = ["query", "create", "transfer"]
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


class WeekendShanghaiTripIfClearAndFree(BaseTask):
    """下周末成都行：查高铁+天气+日历 → 条件笔记+闹钟+微信。"""

    templates = [
        '我想把下周末的成都行先大概定下来。你先查下周六北京到成都最早的高铁和成都当天的天气，再看看我日历那天上午有没有别的安排；如果天气不是雨天而且日历不冲突，就把车次、天气、出发时间写进一个"周末成都计划"的笔记，再给我设一个出发前1小时的闹钟，最后微信发给{contact}，问她那天见面方不方便。',
    ]
    apps = ["railway12306", "weather", "calendar", "clock", "notes", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "query", "reasoning", "create", "transfer"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = (
        RAIL_QUERY_CHANGES
        + WEATHER_QUERY_CHANGES
        + CALENDAR_EVENT_CHANGES
        + NOTES_CREATE_CHANGES
        + CLOCK_ALARM_CHANGES
        + WECHAT_SEND_CHANGES
    )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        today = sim_today(input.os_init)
        days_until_sat = (5 - today.weekday()) % 7
        if days_until_sat == 0:
            days_until_sat = 7
        next_sat = today + datetime.timedelta(days=days_until_sat)
        target_date = next_sat.isoformat()
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        weather = Weather(input.apps["weather"])
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        searched = rail.check_searched(
            from_station="北京", to_station="成都", date=target_date, field="query.searched",
        )
        if not searched["passed"]:
            return [searched, {"field": "rest", "expected": "需先完成查询", "actual": "未查询", "passed": False}]
        train = rail.pick_train_for_route_strict(
            "earliest", from_station="北京", to_station="成都", only_high_speed=True,
        )
        if train is None:
            raise ValueError("No high-speed train found for 北京→成都")
        weather_day = weather.daily_by_date("成都", target_date)
        is_rainy = Weather.is_raining_text(str(weather_day.get("textDay") or "")) or \
                   Weather.is_raining_text(str(weather_day.get("textNight") or ""))
        has_conflict = calendar.init.count_events_on_date(next_sat) > 0
        if is_rainy or has_conflict:
            # 条件不满足：模板没有要求通知，只应停在查询结果，不新增输出产物。
            return [
                searched,
                notes.check_no_new_notes(field="no_weekend_trip_note"),
                calendar.check_no_new_events(field="no_weekend_trip_event"),
                clock.check_no_new_alarms(field="no_weekend_trip_alarm"),
                wechat.check_no_new_sent_to(
                    self.p.contact,
                    field="no_weekend_trip_message",
                    summary="条件不满足时不应微信通知联系人",
                ),
            ]
        dh, dm = map(int, str(train["departTime"]).split(":"))
        alarm_dt = datetime.datetime(2000, 1, 1, dh, dm) - datetime.timedelta(hours=1)
        return [
            searched,
            notes.check_note_with_title_contains(
                "周末成都计划", str(train["trainNo"]), field="memo_train",
            ),
            clock.check_alarm_at(alarm_dt.hour, alarm_dt.minute, field="alarm"),
            wechat.check_new_sent_contains(self.p.contact, field="wechat_ask"),
        ]

# ══════════════════════════════════════════════════════════════════════════
# 桌面定制任务
# ══════════════════════════════════════════════════════════════════════════


class ChangeWallpaperAndAddWidget(BaseTask):
    """换桌面壁纸 + 添加大桔观小组件。"""

    templates = [
        "把桌面背景换一下，然后添加大桔观小组件",
    ]
    apps = []
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
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
