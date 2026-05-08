"""
Tencent Meeting app state accessor.
"""

from __future__ import annotations

import datetime
import re
from typing import Any

from bench_env.task.base import BaseApp

TENCENT_MEETING_BOOL_ACTION_VALUES = {
    "打开": True,
    "关闭": False,
}

TENCENT_MEETING_MUTE_ACTION_VALUES = {
    "静音": True,
    "取消静音": False,
}

TENCENT_MEETING_REPEAT_TYPE_VALUES = {
    "每天": "daily",
    "每周": "weekly",
    "每两周": "biweekly",
    "每月": "monthly",
}

TENCENT_MEETING_HISTORY_DATE_VALUES = {
    "2月3日": "2026-02-03",
    "2月4日": "2026-02-04",
}

TENCENT_MEETING_HISTORY_TOPICS = [
    "小明的快速会议",
    "周例会",
    "王五的项目讨论",
    "长时间研讨会",
    "张三的快速会议",
    "李四的快速会议",
    "王五的快速会议",
    "项目周会",
]

TENCENT_MEETING_PARTICIPATION_TOPICS = [
    "小明的快速会议",
    "周例会",
    "王五的项目讨论",
    "长时间研讨会",
]

TENCENT_MEETING_SCHEDULED_TOPICS = [
    "项目例会",
    "月末总结",
]

TENCENT_MEETING_SCHEDULED_TOPIC_PARAM = {
    "type": "string",
    "source": "apps.tencent_meeting.scheduledMeetings[title]",
    "default": "项目例会",
    "description": "腾讯会议预约主题（须为默认 scheduledMeetings 中已有）",
}

TENCENT_MEETING_NEW_MEETING_TOPICS = [
    "预算评审会",
    "版本发布会",
    "客户沟通会",
]

TENCENT_MEETING_NEW_REGULAR_TOPICS = [
    "每周同步会",
    "月度复盘会",
    "项目例会",
]

TENCENT_MEETING_NEW_TEAM_TOPICS = [
    "跨组同步会",
    "需求评审会",
    "联调对齐会",
]


class TencentMeeting(BaseApp):
    """Tencent Meeting state accessor."""

    @staticmethod
    def sample_two_participation_topics(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        topic1, topic2 = rng.sample(TENCENT_MEETING_PARTICIPATION_TOPICS, 2)
        return {"topic1": topic1, "topic2": topic2}

    @staticmethod
    def parse_meeting_time(value: Any) -> datetime.datetime:
        if isinstance(value, str):
            for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
                try:
                    return datetime.datetime.strptime(value, fmt)
                except ValueError:
                    continue
            raise ValueError(
                f"无法解析会议时间字符串 {value!r}，"
                "期望格式: 'YYYY-MM-DD HH:MM' 或 'YYYY-MM-DD HH:MM:SS'"
            )
        return datetime.datetime.fromtimestamp(float(value) / 1000.0)

    @staticmethod
    def meeting_start_timestamp_ms(meeting: dict[str, Any]) -> int:
        st = meeting["startTime"]
        if isinstance(st, (int, float)):
            return int(st)
        dt = TencentMeeting.parse_meeting_time(st)
        return int(dt.timestamp() * 1000)

    @staticmethod
    def meeting_start_hh_mm(meeting: dict[str, Any]) -> str:
        """会议开始时间的 HH:MM（用于微信/答案与 match_time 对齐）。"""
        ms = TencentMeeting.meeting_start_timestamp_ms(meeting)
        dt = datetime.datetime.fromtimestamp(ms / 1000.0)
        return dt.strftime("%H:%M")

    @staticmethod
    def meeting_id_pattern(meeting_id: str) -> re.Pattern[str]:
        digits = re.sub(r"\s+", "", meeting_id)
        pattern = r"\s*".join(re.escape(ch) for ch in digits)
        return re.compile(pattern)

    @property
    def user(self) -> dict[str, Any]:
        return self.raw["user"]

    @property
    def user_name(self) -> str:
        return str(self.user["name"])

    @property
    def user_id(self) -> str:
        return str(self.user["id"])

    @property
    def contacts(self) -> list[dict[str, Any]]:
        contacts = self.raw["contacts"]
        if not isinstance(contacts, list):
            raise ValueError("tencent_meeting.contacts 不是 list")
        return contacts

    @property
    def settings(self) -> dict[str, Any]:
        return self.raw["settings"]

    @property
    def history(self) -> list[dict[str, Any]]:
        history = self.raw["history"]
        if not isinstance(history, list):
            raise ValueError("tencent_meeting.history 不是 list")
        return history

    @property
    def scheduled_meetings(self) -> list[dict[str, Any]]:
        meetings = self.raw["scheduledMeetings"]
        if not isinstance(meetings, list):
            raise ValueError("tencent_meeting.scheduledMeetings 不是 list")
        return meetings

    @property
    def ongoing_meetings(self) -> list[dict[str, Any]]:
        meetings = self.raw["ongoingMeetings"]
        if not isinstance(meetings, list):
            raise ValueError("tencent_meeting.ongoingMeetings 不是 list")
        return meetings

    @property
    def personal_room(self) -> dict[str, Any]:
        return self.raw["personalRoom"]

    @property
    def messages(self) -> list[dict[str, Any]]:
        messages = self.raw["messages"]
        if not isinstance(messages, list):
            raise ValueError("tencent_meeting.messages 不是 list")
        return messages

    @property
    def active_meeting(self) -> dict[str, Any] | None:
        return self.raw.get("activeMeeting")

    @property
    def is_in_meeting(self) -> bool:
        return self.active_meeting is not None

    def require_active_meeting(self) -> dict[str, Any]:
        meeting = self.active_meeting
        if meeting is None:
            raise ValueError("当前不在会议中")
        return meeting

    def check_active_meeting_exists(
        self,
        *,
        field: str = "activeMeeting.exists",
    ) -> dict[str, Any]:
        meeting = self.active_meeting
        return {
            "field": field,
            "expected": "已创建活跃会议",
            "actual": "已创建活跃会议" if meeting is not None else "未创建活跃会议",
            "passed": meeting is not None,
        }

    def check_active_meeting_room_source(
        self,
        *,
        use_personal_room: bool,
        field: str = "activeMeeting.meetingId",
    ) -> dict[str, Any]:
        meeting = self.active_meeting
        personal_room_id = re.sub(r"\s+", "", str(self.personal_room["meetingId"]))
        actual_meeting_id = (
            re.sub(r"\s+", "", str(meeting["meetingId"])) if meeting is not None else None
        )
        expected = (
            f"使用个人会议号 {self.personal_room['meetingId']}"
            if use_personal_room
            else f"不使用个人会议号 {self.personal_room['meetingId']}"
        )
        actual = actual_meeting_id or "未创建活跃会议"
        passed = meeting is not None and (
            actual_meeting_id == personal_room_id
            if use_personal_room
            else actual_meeting_id != personal_room_id
        )
        return {
            "field": field,
            "expected": expected,
            "actual": actual,
            "passed": passed,
        }

    @property
    def am_settings(self) -> dict[str, Any]:
        return self.require_active_meeting()["settings"]

    @property
    def am_mic_muted(self) -> bool:
        return bool(self.am_settings["isMuted"])

    @property
    def am_attendees(self) -> list[dict[str, Any]]:
        attendees = self.require_active_meeting()["participants"]
        if not isinstance(attendees, list):
            raise ValueError("activeMeeting.participants 不是 list")
        return attendees

    @property
    def am_chat_messages(self) -> list[dict[str, Any]]:
        messages = self.require_active_meeting().get("chatMessages", [])
        if not isinstance(messages, list):
            raise ValueError("activeMeeting.chatMessages 不是 list")
        return messages

    def get_attendee(self, name: str) -> dict[str, Any] | None:
        for attendee in self.am_attendees:
            if attendee["name"] == name:
                return attendee
        return None

    def find_history_meeting(self, topic: str) -> dict[str, Any]:
        for meeting in self.history:
            if meeting["title"] == topic:
                return meeting
        raise ValueError(f"历史会议中未找到主题 {topic!r}")

    def find_history_meeting_on_date(self, topic: str, date_iso: str) -> dict[str, Any]:
        for meeting in self.history:
            if meeting["title"] != topic:
                continue
            if self.history_display_date(meeting) == date_iso:
                return meeting
        raise ValueError(f"历史会议中未找到 {date_iso} 的 {topic!r}")

    def find_scheduled_meeting(self, topic: str) -> dict[str, Any]:
        for meeting in self.scheduled_meetings:
            if meeting["title"] == topic:
                return meeting
        raise ValueError(f"预约会议中未找到主题 {topic!r}")

    def new_scheduled_meeting_by_title(self, topic: str) -> dict[str, Any] | None:
        current_by_id = {meeting["id"]: meeting for meeting in self.scheduled_meetings}
        init_ids = {meeting["id"] for meeting in self.init.scheduled_meetings}
        for meeting_id, meeting in current_by_id.items():
            if meeting_id in init_ids:
                continue
            if meeting["title"] == topic:
                return meeting
        return None

    def any_new_scheduled_meeting(self) -> dict[str, Any] | None:
        current_by_id = {meeting["id"]: meeting for meeting in self.scheduled_meetings}
        init_ids = {meeting["id"] for meeting in self.init.scheduled_meetings}
        for meeting_id, meeting in current_by_id.items():
            if meeting_id not in init_ids:
                return meeting
        return None

    def find_meeting_at_time(
        self, target_dt: datetime.datetime
    ) -> dict[str, Any] | None:
        for meeting in [*self.scheduled_meetings, *self.history]:
            meeting_dt = self.parse_meeting_time(meeting["startTime"])
            if (
                meeting_dt.year,
                meeting_dt.month,
                meeting_dt.day,
                meeting_dt.hour,
                meeting_dt.minute,
            ) == (
                target_dt.year,
                target_dt.month,
                target_dt.day,
                target_dt.hour,
                target_dt.minute,
            ):
                return meeting
        return None

    def meeting_password(self, meeting: dict[str, Any]) -> str:
        settings = meeting.get("settings")
        if isinstance(settings, dict) and settings.get("password") not in (None, ""):
            return str(settings["password"])
        if meeting.get("password") not in (None, ""):
            return str(meeting["password"])
        if meeting.get("passcode") not in (None, ""):
            return str(meeting["passcode"])
        return ""

    def upcoming_or_ongoing(self) -> tuple[list[dict[str, Any]], str]:
        if self.scheduled_meetings:
            return self.scheduled_meetings, "upcoming"
        if self.ongoing_meetings:
            return self.ongoing_meetings, "ongoing"
        ongoing = [meeting for meeting in self.history if not meeting.get("endTime")]
        return ongoing, "ongoing"

    def history_display_time(self, meeting: dict[str, Any]) -> Any:
        participations = meeting.get("participations")
        if participations:
            return participations[-1]["joinTime"]
        return meeting["startTime"]

    def history_display_date(self, meeting: dict[str, Any]) -> str:
        return self.parse_meeting_time(self.history_display_time(meeting)).strftime("%Y-%m-%d")

    def history_meetings_on_date(self, date_iso: str) -> list[dict[str, Any]]:
        return [meeting for meeting in self.history if self.history_display_date(meeting) == date_iso]

    def history_meeting_start_and_duration(self, topic: str) -> dict[str, Any]:
        meeting = self.find_history_meeting(topic)
        start_dt = self.parse_meeting_time(meeting["startTime"])
        return {
            "start_time": start_dt.strftime("%H:%M"),
            "duration": int(meeting["duration"]),
        }

    def history_meeting_attendee_names(self, topic: str) -> list[str]:
        meeting = self.find_history_meeting(topic)
        return [str(participant["name"]) for participant in meeting["participants"]]

    def friend_hosted_history_meeting_count(self) -> int:
        friend_ids = {contact["id"] for contact in self.contacts}
        return sum(1 for meeting in self.history if meeting["hostId"] in friend_ids)

    def system_message_count(self) -> int:
        return sum(1 for message in self.messages if message["type"] == "system")

    def latest_system_message_content(self) -> str:
        for message in self.messages:
            if message["type"] == "system":
                return str(message["content"])
        raise ValueError("消息中心中没有系统消息")

    def count_history_meetings_on_date(self, date_iso: str) -> int:
        return len(self.history_meetings_on_date(date_iso))

    def total_participation_minutes(self, topic: str) -> int:
        meeting = self.find_history_meeting(topic)
        participations = meeting.get("participations")
        if not participations:
            raise ValueError(f"会议 {topic!r} 没有参会记录")
        total_ms = sum(int(participation["duration"]) for participation in participations)
        return total_ms // 60000

    def total_participation_minutes_on_date(self, date_iso: str) -> int:
        total_ms = 0
        for meeting in self.history_meetings_on_date(date_iso):
            participations = meeting.get("participations", [])
            total_ms += sum(int(participation["duration"]) for participation in participations)
        return total_ms // 60000

    def second_participation_time(self, topic: str) -> str:
        meeting = self.find_history_meeting(topic)
        participations = meeting.get("participations")
        if not participations or len(participations) < 2:
            raise ValueError(f"会议 {topic!r} 少于两次参会记录")
        second = sorted(participations, key=lambda item: item["joinTime"])[1]
        dt = self.parse_meeting_time(second["joinTime"])
        return dt.strftime("%H:%M")

    def longest_history_meeting(self) -> dict[str, Any]:
        """历史会议中预定时长最长的一场；数据保证唯一最长（并列即抛错）。"""
        if not self.history:
            raise ValueError("无历史会议记录")
        best = max(self.history, key=lambda meeting: int(meeting["duration"]))
        best_d = int(best["duration"])
        ties = [m for m in self.history if int(m["duration"]) == best_d]
        if len(ties) != 1:
            raise ValueError(
                f"历史会议预定时长最长一场存在并列（duration={best_d}），无法唯一确定"
            )
        return best

    def meeting_host_name(self, meeting: dict[str, Any]) -> str:
        """会议主持人姓名：优先 ``meeting.hostName``，依次回退到联系人表、会议自身的参与者，
        最后再比对当前用户。全部失败才抛 ``ValueError``（任务设计错误）。
        """
        host = str(meeting.get("hostName") or "").strip()
        if host:
            return host
        host_id = str(meeting.get("hostId") or "").strip()
        if not host_id:
            raise ValueError(f"无法确定会议 {meeting.get('title')!r} 的主持人姓名")
        for contact in self.contacts:
            if str(contact.get("id") or "") == host_id:
                name = str(contact.get("name") or "").strip()
                if name:
                    return name
        # 历史会议的 participants 列表通常同时带上主持人自己（见 defaults.json 的 user_leader）
        for participant in meeting.get("participants") or []:
            if str(participant.get("id") or "") == host_id:
                name = str(participant.get("name") or "").strip()
                if name:
                    return name
        if host_id == self.user_id:
            return self.user_name
        raise ValueError(f"无法确定会议 {meeting.get('title')!r} 的主持人姓名")

    def history_meetings_with_keyword(self, keyword: str) -> list[dict[str, Any]]:
        """历史会议中标题包含 keyword 的记录（大小写不敏感子串匹配）。"""
        target = str(keyword or "")
        if not target:
            return []
        return [m for m in self.history if target in str(m.get("title") or "")]

    def count_history_meetings_with_keyword(self, keyword: str) -> int:
        return len(self.history_meetings_with_keyword(keyword))

    def history_meeting_with_max_participation(self, keyword: str) -> dict[str, Any]:
        """历史会议中标题包含 keyword 的记录里参会总时长（分钟）最长的一场。

        参会时长 = 所有 participations 的 duration 之和（单位毫秒）。没有参会记录视为 0。
        """
        matches = self.history_meetings_with_keyword(keyword)
        if not matches:
            raise ValueError(f"没有标题包含 {keyword!r} 的历史会议")

        def _participation_ms(meeting: dict[str, Any]) -> int:
            return sum(int(p.get("duration") or 0) for p in meeting.get("participations") or [])

        best = max(matches, key=_participation_ms)
        best_ms = _participation_ms(best)
        ties = [m for m in matches if _participation_ms(m) == best_ms]
        if len(ties) != 1:
            raise ValueError(
                f"标题包含 {keyword!r} 的历史会议中存在多场并列最长参会时长，无法唯一确定"
            )
        return best

    def history_meeting_with_most_participants(self) -> dict[str, Any]:
        return max(self.history, key=lambda meeting: len(meeting["participants"]))

    def hosted_history_meeting_with_most_participants(self) -> dict[str, Any]:
        """只在「我创建/我主持」的历史会议里找参会人数最多的一场。"""
        hosted = [m for m in self.history if str(m.get("hostId")) == self.user_id]
        if not hosted:
            raise ValueError("没有找到我主持的历史会议")
        return max(hosted, key=lambda meeting: len(meeting.get("participants") or []))

    def scheduled_meeting_end_time(self, topic: str) -> str:
        """返回预约会议的结束时间 HH:MM（startTime + duration）。"""
        meeting = self.find_scheduled_meeting(topic)
        start_dt = self.parse_meeting_time(meeting["startTime"])
        duration_minutes = int(meeting["duration"])
        end_dt = start_dt + datetime.timedelta(minutes=duration_minutes)
        return end_dt.strftime("%H:%M")

    def check_topic_modified(
        self, old_topic: str, new_topic: str, *, field: str = "modified_topic"
    ) -> dict[str, Any]:
        """验证预约会议主题是否已从 old_topic 改为 new_topic。"""
        titles = [item["title"] for item in self.scheduled_meetings]
        new_exists = new_topic in titles
        old_gone = old_topic not in titles
        return {
            "field": field,
            "expected": f"rename {old_topic!r} → {new_topic!r}",
            "actual": titles,
            "passed": new_exists and old_gone,
        }

    def upcoming_scheduled_from_now(self, now_ms: int) -> list[dict[str, Any]]:
        """预约会议：开始时间不早于 now（允许 1 分钟容差）。"""
        out: list[dict[str, Any]] = []
        for m in self.scheduled_meetings:
            st = m.get("startTime")
            if isinstance(st, (int, float)) and int(st) >= int(now_ms) - 60 * 1000:
                out.append(m)
        out.sort(key=lambda x: int(x.get("startTime") or 0))
        return out

    def first_upcoming_scheduled(self, now_ms: int) -> dict[str, Any]:
        upcoming = self.upcoming_scheduled_from_now(now_ms)
        if not upcoming:
            raise ValueError("没有待开始的预约会议")
        return upcoming[0]

    def nearest_future_meeting_id(self, now_ms: int) -> str:
        """最近一场将开始的预约会议的会议号（短信提醒等场景）。"""
        m = self.first_upcoming_scheduled(now_ms)
        mid = str(m.get("meetingId") or "").strip()
        if not mid:
            raise ValueError("预约会议缺少 meetingId")
        return mid

    def longest_history_meeting_on_date(self, date_iso: str) -> dict[str, Any]:
        """指定日期历史会议中时长最长且唯一的一场。"""
        candidates = self.history_meetings_on_date(date_iso)
        if len(candidates) < 2:
            raise ValueError(f"{date_iso} 历史会议不足 2 场")
        best = max(candidates, key=lambda m: int(m["duration"]))
        best_d = int(best["duration"])
        ties = [m for m in candidates if int(m["duration"]) == best_d]
        if len(ties) != 1:
            raise ValueError(f"{date_iso} 最长时长并列，无法唯一确定")
        return best

    @staticmethod
    def format_duration_minutes_zh(total_minutes: int) -> str:
        h, m = divmod(int(total_minutes), 60)
        parts: list[str] = []
        if h:
            parts.append(f"{h}小时")
        if m:
            parts.append(f"{m}分")
        if not parts:
            return "0分钟"
        return "".join(parts)

    def check_scheduled_meeting_cancelled(self, topic: str, *, field: str | None = None) -> dict[str, Any]:
        """验证预约列表中指定主题已取消（不存在或 status='cancelled'）。"""
        if field is None:
            field = f"cancelled_{topic}"
        active = [
            str(x.get("title") or "")
            for x in self.scheduled_meetings
            if str(x.get("status") or "") != "cancelled"
        ]
        passed = topic not in active
        return {
            "field": field,
            "expected": f"预约中已取消 {topic!r}",
            "actual": active,
            "passed": passed,
        }

    def check_scheduled_meeting_present(self, topic: str, *, field: str | None = None) -> dict[str, Any]:
        """验证预约列表中仍存在指定主题且未被取消（status != 'cancelled'）。"""
        if field is None:
            field = f"keep_{topic}"
        active_titles = [
            str(x["title"])
            for x in self.scheduled_meetings
            if str(x.get("status") or "") != "cancelled"
        ]
        passed = topic in active_titles
        return {
            "field": field,
            "expected": f"保留 {topic!r}（非 cancelled）",
            "actual": active_titles,
            "passed": passed,
        }

    def check_no_new_scheduled_meeting(self, topic: str, *, field: str | None = None) -> dict[str, Any]:
        """验证没有新增指定主题的预约会议。"""
        if field is None:
            field = f"no_new_{topic}"
        meeting = self.new_scheduled_meeting_by_title(topic)
        return {
            "field": field,
            "expected": f"未新增主题为 {topic!r} 的预约会议",
            "actual": meeting,
            "passed": meeting is None,
        }

    def check_new_scheduled_title_matches(
        self,
        expected_title: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证新建的预约会议标题与期望一致。"""
        if field is None:
            field = "new_scheduled_title"
        meeting = self.new_scheduled_meeting_by_title(expected_title)
        if meeting is None:
            return {
                "field": field,
                "expected": expected_title,
                "actual": "未创建该主题会议",
                "passed": False,
            }
        actual_title = str(meeting["title"])
        return {
            "field": field,
            "expected": expected_title,
            "actual": actual_title,
            "passed": actual_title == expected_title,
        }

    def check_new_scheduled_start_time(
        self,
        title: str,
        target_ms: int,
        *,
        tolerance_ms: int = 5 * 60 * 1000,
        time_hhmm: str | None = None,
        field: str | None = None,
        expected_summary: str | None = None,
    ) -> dict[str, Any]:
        """验证新预约会议开始时间≈ target_ms。"""
        if field is None:
            field = "scheduled_start"
        meeting = self.new_scheduled_meeting_by_title(title)
        label = time_hhmm or "目标时刻"
        exp = expected_summary if expected_summary is not None else f"明日 {label}"
        if meeting is None:
            return {
                "field": field,
                "expected": exp,
                "actual": None,
                "passed": False,
            }
        st_ok = abs(TencentMeeting.meeting_start_timestamp_ms(meeting) - int(target_ms)) <= int(tolerance_ms)
        return {
            "field": field,
            "expected": exp,
            "actual": meeting["startTime"],
            "passed": st_ok,
        }

    def check_new_scheduled_start_and_duration(
        self,
        title: str,
        target_ms: int,
        duration_minutes: int,
        *,
        tolerance_ms: int = 5 * 60 * 1000,
        time_hhmm: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证新预约会议的开始时间与时长。"""
        if field is None:
            field = "scheduled_time_duration"
        meeting = self.new_scheduled_meeting_by_title(title)
        tlabel = time_hhmm or "目标时刻"
        if meeting is None:
            return {
                "field": field,
                "expected": f"明日 {tlabel}，时长 {duration_minutes} 分",
                "actual": "(无新会议)",
                "passed": False,
            }
        st_ok = abs(TencentMeeting.meeting_start_timestamp_ms(meeting) - int(target_ms)) <= int(tolerance_ms)
        dur_ok = int(meeting["duration"]) == int(duration_minutes)
        return {
            "field": field,
            "expected": f"明日 {tlabel}，时长 {duration_minutes} 分",
            "actual": f"start={meeting['startTime']} dur={meeting['duration']}",
            "passed": st_ok and dur_ok,
        }

    def check_new_scheduled_password(
        self,
        title: str,
        password: str,
        *,
        field: str = "scheduled_password",
    ) -> dict[str, Any]:
        meeting = self.new_scheduled_meeting_by_title(title)
        if meeting is None:
            return {
                "field": field,
                "expected": f"新预约 {title!r} 密码={password}",
                "actual": "未找到新会议",
                "passed": False,
            }
        pwd = self.meeting_password(meeting)
        return {
            "field": field,
            "expected": password,
            "actual": pwd,
            "passed": pwd == password,
        }

    def check_new_scheduled_has_invitee(
        self,
        title: str,
        invitee_name: str,
        *,
        field: str = "scheduled_invitee",
    ) -> dict[str, Any]:
        meeting = self.new_scheduled_meeting_by_title(title)
        if meeting is None:
            return {
                "field": field,
                "expected": f"新预约 {title!r} 含受邀 {invitee_name}",
                "actual": "未找到新会议",
                "passed": False,
            }
        invitees = meeting.get("invitees") or []
        names = [str(x.get("name") or "") for x in invitees if isinstance(x, dict)]
        passed = invitee_name in names
        return {
            "field": field,
            "expected": invitee_name,
            "actual": names,
            "passed": passed,
        }

    def find_ongoing_entry(self, host_name: str, topic: str) -> dict[str, Any]:
        for m in self.ongoing_meetings:
            if str(m.get("hostName") or "") == host_name and str(m.get("title") or "") == topic:
                return m
        raise ValueError(f"未找到 {host_name!r} 主持的 {topic!r} 进行中会议入口")

    def find_ongoing_entry_by_topic(self, topic: str) -> dict[str, Any]:
        for m in self.ongoing_meetings:
            if str(m.get("title") or "") == topic:
                return m
        raise ValueError(f"未找到主题为 {topic!r} 的进行中会议入口")

    def check_active_matches_ongoing(
        self,
        ongoing: dict[str, Any],
        *,
        field: str = "activeMeeting",
    ) -> dict[str, Any]:
        meeting = self.active_meeting
        exp_id = str(ongoing.get("meetingId") or "")
        act_id = str(meeting.get("meetingId") or "") if meeting else ""
        return {
            "field": field,
            "expected": f"会中 meetingId={exp_id}",
            "actual": act_id or "(未入会)",
            "passed": bool(meeting) and bool(exp_id) and act_id == exp_id,
        }

    def check_self_participant_name(self, expected_name: str, *, field: str = "participant_name") -> dict[str, Any]:
        meeting = self.active_meeting
        if meeting is None:
            return {
                "field": field,
                "expected": expected_name,
                "actual": "(未入会)",
                "passed": False,
            }
        uid = str(self.user_id)
        for p in meeting.get("participants") or []:
            if not isinstance(p, dict):
                continue
            if str(p.get("id")) == uid:
                actual = str(p.get("name") or "")
                return {
                    "field": field,
                    "expected": expected_name,
                    "actual": actual,
                    "passed": actual == expected_name,
                }
        return {
            "field": field,
            "expected": expected_name,
            "actual": "(未找到本人参会记录)",
            "passed": False,
        }

    def check_meeting_start_offset_minutes(
        self,
        meeting: dict[str, Any],
        now_ms: int,
        offset_minutes: int,
        *,
        field: str = "meeting_start",
        tolerance_minutes: int = 6,
    ) -> dict[str, Any]:
        """验证会议开始时间约为 now_ms + offset_minutes（绝对毫秒比较）。"""
        st = meeting.get("startTime")
        if not isinstance(st, (int, float)):
            return {
                "field": field,
                "expected": f"start ≈ now+{offset_minutes}min",
                "actual": st,
                "passed": False,
            }
        expected_ms = int(now_ms) + int(offset_minutes) * 60 * 1000
        diff_min = abs(int(st) - expected_ms) / 60000.0
        return {
            "field": field,
            "expected": f"与当前时间相差约 {offset_minutes} 分钟（±{tolerance_minutes}）",
            "actual": f"diff={diff_min:.1f}min",
            "passed": diff_min <= tolerance_minutes,
        }
