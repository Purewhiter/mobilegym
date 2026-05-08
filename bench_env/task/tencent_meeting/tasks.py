"""
Tencent Meeting task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 29 tasks | L1×4  L2×11  L3×9  L4×5
#
# [L1] ConfigAudioSettings              帮我设置一下腾讯会议，入会时麦克风{mic_on}，扬声器{speaker_on}
# [L1] CheckPersonalRoomId              我的腾讯会议个人会议室号是多少
# [L1] CheckContactCount                我腾讯会议的通讯录里有多少位好友
# [L1] ToggleNotification               帮我把腾讯会议的消息通知{notifications}
# [L2] FindMeetingHistory               帮我查一下历史会议里{topic}的开始时间和预定的会议时长
# [L2] StartFastMeeting                 帮我开一个快速会议，{video_on}视频，麦克风{mute_on}，{use_personal_room}个人会议号
# [L2] ConfigGeneralSettings            帮我设置一下，安全驾驶模式{safe_drive}，深色模式跟随系统{dark_mode}
# [L2] ConfigVideoSettings              帮我把视频镜像{mirror}，视频预览{preview}
# [L2] ChatInMeeting                    进入{host_name}的{topic}会议，在群里发一条消息：{message}
# [L2] ConfigPrivacySettings            帮我设置一下，隐藏非视频参会者{hide_non_video}，隐藏自己{hide_self}
# [L2] ConfigShowIdentity               帮我设置一下，对外展示认证身份{show_identity}
# [L2] CheckPendingMeetingId            帮我查一下预约会议{topic}的会议号是多少
# [L2] CountOngoingMeetings             腾讯会议首页现在有几场正在进行的会议
# [L2] ModifyScheduledMeetingTopic      帮我把腾讯会议里主题为{old_topic}的预约会议改成{new_topic}
# [L2] CheckScheduledMeetingEndTime     帮我看看预约会议{topic}几点结束
# [L3] JoinMeetingAndRename             加入{host_name}的{topic}会议，把昵称改成{name}，麦克风{mute_on}
# [L3] CheckMeetingAttendees            帮我看看小明2月4日那场快速会议都有哪些人
# [L3] ScheduleMeeting                  帮我预约一个会议，主题是{topic}，时长{duration}分钟，密码设为{pin}，然后告诉我会议号
# [L3] ScheduleRegularMeeting           帮我预约一个周期性会议，主题是{topic}，重复频率是{repeat_type}
# [L3] CountFriendMeetings              历史会议里有多少场是我腾讯会议的通讯录好友发起的
# [L3] GetSecondParticipationTime       帮我查一下{topic}这场会议我第二次加入是几点
# [L3] FindLongestMeeting               历史会议里开得最久的是哪一场
# [L3] FindMeetingWithMostParticipants  历史会议里我开的哪一场会议参加的人最多，总共有多少人
# [L3] CountMeetingsByDate              帮我数一下{date}这天有多少场历史会议
# [L4] ShareScreenAndConfirm            加入{host_name}的{topic}会议，先共享屏幕，然后给所有人发消息：{message}
# [L4] ChatWithSpecificUser             进入{host_name}的{topic}会议，单独给{target_user}发一条消息：{message}
# [L4] ScheduleTeamMeeting              帮我预约一场主题为{topic}的会议，邀请张三和李四，关掉日历提醒，打开自动使用加时卡
# [L4] CalculateTotalMeetingDuration    帮我算一下{date}这天我一共开了多久会议，多少分钟
# [L4] CompareParticipationDurations    {topic1}和{topic2}这两场会议，我哪一场参加的时间更长
# -- End Task Index --

from __future__ import annotations

import re
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import (
    AnswerTask,
    CriteriaTask,
    build_answer_checks,
    match_duration,
    match_time,
    match_value,
)
from bench_env.task.judge import JudgeInput
from bench_env.task.tencent_meeting.app import (
    TENCENT_MEETING_BOOL_ACTION_VALUES,
    TENCENT_MEETING_HISTORY_DATE_VALUES,
    TENCENT_MEETING_HISTORY_TOPICS,
    TENCENT_MEETING_MUTE_ACTION_VALUES,
    TENCENT_MEETING_NEW_MEETING_TOPICS,
    TENCENT_MEETING_NEW_REGULAR_TOPICS,
    TENCENT_MEETING_NEW_TEAM_TOPICS,
    TENCENT_MEETING_REPEAT_TYPE_VALUES,
    TENCENT_MEETING_SCHEDULED_TOPICS,
    TencentMeeting,
)


# =============================================================================
# L1 — Atomic operations & simple queries
# =============================================================================


class ConfigAudioSettings(CriteriaTask):
    templates = ["帮我设置一下腾讯会议，入会时麦克风{mic_on}，扬声器{speaker_on}"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "mic_on": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": True,
            "description": "是否打开入会麦克风",
        },
        "speaker_on": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": False,
            "description": "是否打开入会扬声器",
        },
    }
    criteria = {
        "settings.micOnJoin": "{mic_on}",
        "settings.speakerOnJoin": "{speaker_on}",
    }

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class CheckPersonalRoomId(AnswerTask):
    templates = ["我的腾讯会议个人会议室号是多少"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["query"]
    answer_fields = [{"type": "text", "label": "个人会议室号", "hint": "如：987 654 321"}]

    def get_answer(self, input: JudgeInput) -> Any:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        return TencentMeeting.meeting_id_pattern(tm.personal_room["meetingId"])

    def get_expected_response(self, input: JudgeInput) -> list:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        return [str(tm.personal_room["meetingId"])]


class CheckContactCount(AnswerTask):
    templates = ["我腾讯会议的通讯录里有多少位好友"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["query"]
    answer_fields = [{"type": "number", "label": "好友数量"}]
    answer = (".contacts", len)


class ToggleNotification(CriteriaTask):
    templates = ["帮我把腾讯会议的消息通知{notifications}"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "notifications": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": False,
            "description": "是否打开消息通知",
        },
    }
    criteria = {"settings.notifications": "{notifications}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


# =============================================================================
# L2 — Multi-step operations & queries
# =============================================================================


class FindMeetingHistory(AnswerTask):
    templates = ["帮我查一下历史会议里{topic}的开始时间和预定的会议时长"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["query"]
    answer_fields = [
        {"type": "text", "label": "开始时间", "hint": "如：10:00", "matcher": "time"},
        {"type": "text", "label": "预定的会议时长", "hint": "如：10分钟", "matcher": "duration"},
    ]
    parameters = {
        "topic": {
            "type": "enum",
            "values": TENCENT_MEETING_HISTORY_TOPICS,
            "default": "小明的快速会议",
            "description": "历史会议主题",
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        return tm.history_meeting_start_and_duration(self.p.topic)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        """
        The agent may answer duration in many equivalent formats:
        - 60 / 60分钟 / 1小时 / 1小时0分 / 1:00
        So we match start time and duration using specialized matchers.
        """
        expected = self.get_answer(input) or {}
        answer_text = str(input.answer or "")

        expected_start = expected.get("start_time")
        expected_duration = expected.get("duration")

        duration_expected_text = None
        if isinstance(expected_duration, (int, float)):
            duration_expected_text = f"{int(expected_duration)}分钟"
        elif expected_duration is not None:
            duration_expected_text = str(expected_duration)

        return [
            {
                "field": "answer.start_time",
                "expected": expected_start,
                "actual": input.answer,
                "passed": match_time(str(expected_start), answer_text) if expected_start is not None else False,
            },
            {
                "field": "answer.duration",
                "expected": expected_duration,
                "actual": input.answer,
                "passed": match_duration(duration_expected_text, answer_text)
                if duration_expected_text is not None
                else False,
            },
        ]


class StartFastMeeting(CriteriaTask):
    templates = ["帮我开一个快速会议，{video_on}视频，麦克风{mute_on}，{use_personal_room}个人会议号"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["create"]
    parameters = {
        "video_on": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": True,
            "description": "是否打开视频",
        },
        "mute_on": {
            "type": "boolean",
            "values": TENCENT_MEETING_MUTE_ACTION_VALUES,
            "default": True,
            "description": "是否静音麦克风",
        },
        "use_personal_room": {
            "type": "boolean",
            "values": {
                "使用": True,
                "不使用": False,
            },
            "default": False,
            "description": "是否使用个人会议号",
        },
    }
    criteria = {
        "activeMeeting.settings.isVideoOn": "{video_on}",
        "activeMeeting.settings.isMuted": "{mute_on}",
    }
    expected_changes = ["activeMeeting"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"])
        checks = self._check_criteria(input)
        checks.append(tm.check_active_meeting_exists())
        checks.append(
            tm.check_active_meeting_room_source(
                use_personal_room=self.p.use_personal_room,
            )
        )
        return checks


class ConfigGeneralSettings(CriteriaTask):
    templates = ["帮我设置一下，安全驾驶模式{safe_drive}，深色模式跟随系统{dark_mode}"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "safe_drive": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": False,
            "description": "是否打开安全驾驶模式",
        },
        "dark_mode": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": False,
            "description": "是否跟随系统深色模式",
        },
    }
    criteria = {
        "settings.safeDrive": "{safe_drive}",
        "settings.darkModeFollow": "{dark_mode}",
    }

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ConfigVideoSettings(CriteriaTask):
    templates = ["帮我把视频镜像{mirror}，视频预览{preview}"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "mirror": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": False,
            "description": "是否打开视频镜像",
        },
        "preview": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": True,
            "description": "是否打开视频预览",
        },
    }
    criteria = {
        "settings.videoMirror": "{mirror}",
        "settings.showPreview": "{preview}",
    }

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ChatInMeeting(BaseTask):
    templates = [
        "进入{host_name}的{topic}会议，在群里发一条消息：{message}",
        "Join {host_name}'s {topic} meeting and send a message to the group: {message}",
    ]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["social"]
    parameters = {
        "host_name": {"type": "string", "default": "老王", "description": "会议主持人"},
        "topic": {"type": "string", "default": "老王的快速会议", "description": "会议主题"},
        "message": {"type": "string", "default": "大家好，我到了", "description": "聊天内容"},
    }
    expected_changes = ["activeMeeting"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"])
        meeting = tm.active_meeting
        sent = None
        if meeting is not None:
            for message in tm.am_chat_messages:
                if (
                    message["text"] == self.p.message
                    and message["senderId"] == tm.user_id
                    and message["toId"] == "all"
                ):
                    sent = message
                    break
        return [
            {
                "field": "activeMeeting.title",
                "expected": self.p.topic,
                "actual": meeting["title"] if meeting is not None else None,
                "passed": meeting is not None and meeting["title"] == self.p.topic,
            },
            {
                "field": "activeMeeting.chatMessages",
                "expected": f"message to all: {self.p.message}",
                "actual": sent,
                "passed": sent is not None,
            },
        ]


class ConfigPrivacySettings(CriteriaTask):
    templates = ["帮我设置一下，隐藏非视频参会者{hide_non_video}，隐藏自己{hide_self}"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "hide_non_video": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": True,
            "description": "是否隐藏非视频参会者",
        },
        "hide_self": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": True,
            "description": "是否隐藏自己",
        },
    }
    criteria = {
        "settings.hideNonVideo": "{hide_non_video}",
        "settings.hideSelf": "{hide_self}",
    }

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ConfigShowIdentity(CriteriaTask):
    templates = ["帮我设置一下，对外展示认证身份{show_identity}"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "show_identity": {
            "type": "boolean",
            "values": TENCENT_MEETING_BOOL_ACTION_VALUES,
            "default": True,
            "description": "是否展示认证身份",
        },
    }
    criteria = {"settings.showIdentity": "{show_identity}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class CheckPendingMeetingId(AnswerTask):
    templates = ["帮我查一下预约会议{topic}的会议号是多少"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["query"]
    answer_fields = [{"type": "text", "label": "会议号", "hint": "如：987 654 321"}]
    # Querying a scheduled meeting may update the "currently selected" meeting in app state.
    expected_changes = ["currentScheduledMeeting"]
    parameters = {
        "topic": {
            "type": "enum",
            "values": TENCENT_MEETING_SCHEDULED_TOPICS,
            "default": "项目例会",
            "description": "预约会议主题",
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        meeting = tm.find_scheduled_meeting(self.p.topic)
        return TencentMeeting.meeting_id_pattern(meeting["meetingId"])

    def get_expected_response(self, input: JudgeInput) -> list:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        meeting = tm.find_scheduled_meeting(self.p.topic)
        return [str(meeting["meetingId"])]


class CountOngoingMeetings(AnswerTask):
    templates = ["腾讯会议首页现在有几场正在进行的会议"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["query"]
    answer_fields = [{"type": "number", "label": "正在进行的会议数"}]

    def get_answer(self, input: JudgeInput) -> Any:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        history_ids = {h["meetingId"] for h in tm.history}
        return sum(1 for m in tm.ongoing_meetings if m["meetingId"] in history_ids)


class ModifyScheduledMeetingTopic(BaseTask):
    """验证 Agent 是否将预约会议的主题从 old_topic 修改为 new_topic。

    判定：使用 TencentMeeting.check_topic_modified 验证
    scheduledMeetings 中 old_topic 消失且 new_topic 出现。
    """

    templates = [
        "帮我把腾讯会议里主题为{old_topic}的预约会议改成{new_topic}",
        "把腾讯会议预约的{old_topic}会议主题改成{new_topic}",
        "Help me change the topic of the scheduled meeting {old_topic} to {new_topic} in Tencent Meeting",
        "Rename the scheduled Tencent Meeting {old_topic} to {new_topic}",
    ]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["edit"]
    parameters = {
        "old_topic": {
            "type": "enum",
            "values": TENCENT_MEETING_SCHEDULED_TOPICS,
            "default": "项目例会",
            "description": "原会议主题",
        },
        "new_topic": {
            "type": "string",
            "default": "产品需求评审",
            "description": "新会议主题",
        },
    }
    expected_changes = ["scheduledMeetings", "currentScheduledMeeting"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"])
        return [tm.check_topic_modified(self.p.old_topic, self.p.new_topic)]


class CheckScheduledMeetingEndTime(AnswerTask):
    """查询预约会议的结束时间（startTime + duration 推导）。

    判定：使用 match_time 做时间语义匹配，覆盖 "15:00" / "下午3点" 等变体。
    """

    templates = [
        "帮我看看预约会议{topic}几点结束",
        "查一下腾讯会议里{topic}这场预约会议的结束时间",
    ]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["query"]
    answer_fields = [{"type": "text", "label": "结束时间", "hint": "如：11:00", "matcher": "time"}]
    expected_changes = ["currentScheduledMeeting"]
    parameters = {
        "topic": {
            "type": "enum",
            "values": TENCENT_MEETING_SCHEDULED_TOPICS,
            "default": "项目例会",
            "description": "预约会议主题",
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        return tm.scheduled_meeting_end_time(self.p.topic)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        expected = self.get_answer(input)
        return [{
            "field": "answer.end_time",
            "expected": expected,
            "actual": input.answer,
            "passed": match_time(str(expected), str(input.answer or "")),
        }]


# =============================================================================
# L3 — Complex reasoning & hybrid tasks
# =============================================================================


class JoinMeetingAndRename(BaseTask):
    templates = ["加入{host_name}的{topic}会议，把昵称改成{name}，麦克风{mute_on}"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["edit"]
    parameters = {
        "host_name": {"type": "string", "default": "李四", "description": "会议主持人"},
        "topic": {"type": "string", "default": "技术方案评审", "description": "会议主题"},
        "name": {"type": "string", "default": "小明-北京", "description": "新的会议昵称"},
        "mute_on": {
            "type": "boolean",
            "values": TENCENT_MEETING_MUTE_ACTION_VALUES,
            "default": True,
            "description": "是否静音自己的麦克风",
        },
    }
    expected_changes = ["activeMeeting"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"])
        meeting = tm.active_meeting
        renamed_me = None
        if meeting is not None:
            for participant in tm.am_attendees:
                if participant["id"] == tm.user_id:
                    renamed_me = participant
                    break
        return [
            {
                "field": "activeMeeting.title",
                "expected": self.p.topic,
                "actual": meeting["title"] if meeting is not None else None,
                "passed": meeting is not None and meeting["title"] == self.p.topic,
            },
            {
                "field": "activeMeeting.participants.me.name",
                "expected": self.p.name,
                "actual": renamed_me["name"] if renamed_me is not None else None,
                "passed": renamed_me is not None and renamed_me["name"] == self.p.name,
            },
            {
                "field": "activeMeeting.participants.me.isMuted",
                "expected": self.p.mute_on,
                "actual": renamed_me["isMuted"] if renamed_me is not None else None,
                "passed": renamed_me is not None and renamed_me["isMuted"] == self.p.mute_on,
            },
        ]


class CheckMeetingAttendees(AnswerTask):
    templates = ["帮我看看小明2月4日那场快速会议都有哪些人"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "explore"]
    answer_fields = [{"type": "text", "label": "参会人员", "hint": "如：王五, 赵六", "repeatable": True}]

    def get_answer(self, input: JudgeInput) -> Any:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        return ", ".join(tm.history_meeting_attendee_names("小明的快速会议"))

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        expected_names = tm.history_meeting_attendee_names("小明的快速会议")
        answer_text = str(input.answer or "")
        return [{
            "field": "answer",
            "expected": expected_names,
            "actual": input.answer,
            "passed": all(name in answer_text for name in expected_names),
        }]


class ScheduleMeeting(BaseTask):
    templates = ["帮我预约一个会议，主题是{topic}，时长{duration}分钟，密码设为{pin}，然后告诉我会议号"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["create", "query"]
    answer_fields = [{"type": "text", "label": "会议号", "hint": "如：987 654 321"}]
    parameters = {
        "topic": {
            "type": "enum",
            "values": TENCENT_MEETING_NEW_MEETING_TOPICS,
            "default": "预算评审会",
            "description": "新预约会议主题",
        },
        "duration": {
            "type": "enum",
            "values": [30, 60, 90],
            "default": 60,
            "description": "会议时长（分钟）",
        },
        "pin": {
            "type": "string",
            "default": "2468",
            "description": "4位会议密码",
        },
    }
    expected_changes = ["scheduledMeetings", "currentScheduledMeeting"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"], init=input.apps_init["tencent_meeting"])
        new_meeting = tm.new_scheduled_meeting_by_title(self.p.topic)
        checks = [
            {
                "field": "scheduledMeetings.new.title",
                "expected": self.p.topic,
                "actual": new_meeting["title"] if new_meeting is not None else None,
                "passed": new_meeting is not None and new_meeting["title"] == self.p.topic,
            },
            {
                "field": "scheduledMeetings.new.duration",
                "expected": self.p.duration,
                "actual": new_meeting["duration"] if new_meeting is not None else None,
                "passed": new_meeting is not None and new_meeting["duration"] == self.p.duration,
            },
            {
                "field": "scheduledMeetings.new.password",
                "expected": self.p.pin,
                "actual": new_meeting["settings"].get("password") if new_meeting is not None else None,
                "passed": (
                    new_meeting is not None
                    and new_meeting["settings"].get("password") == self.p.pin
                ),
            },
        ]
        if new_meeting is not None:
            checks.extend(build_answer_checks(
                TencentMeeting.meeting_id_pattern(new_meeting["meetingId"]),
                input.answer,
            ))
        else:
            checks.append({
                "field": "answer",
                "expected": "新会议号",
                "actual": input.answer,
                "passed": False,
            })
        return checks


class ScheduleRegularMeeting(BaseTask):
    templates = ["帮我预约一个周期性会议，主题是{topic}，重复频率是{repeat_type}"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["create"]
    parameters = {
        "topic": {
            "type": "enum",
            "values": TENCENT_MEETING_NEW_REGULAR_TOPICS,
            "default": "每周同步会",
            "description": "新周期会议主题",
        },
        "repeat_type": {
            "type": "enum",
            "values": {
                "每周": "weekly",
                "每月": "monthly",
            },
            "default": "weekly",
            "description": "重复频率",
        },
    }
    expected_changes = ["scheduledMeetings", "currentScheduledMeeting"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"], init=input.apps_init["tencent_meeting"])
        new_meeting = tm.new_scheduled_meeting_by_title(self.p.topic)
        return [
            {
                "field": "scheduledMeetings.new.title",
                "expected": self.p.topic,
                "actual": new_meeting["title"] if new_meeting is not None else None,
                "passed": new_meeting is not None and new_meeting["title"] == self.p.topic,
            },
            {
                "field": "scheduledMeetings.new.repeatType",
                "expected": self.p.repeat_type,
                "actual": new_meeting["repeatType"] if new_meeting is not None else None,
                "passed": new_meeting is not None and new_meeting["repeatType"] == self.p.repeat_type,
            },
        ]


class CountFriendMeetings(AnswerTask):
    templates = ["历史会议里有多少场是我腾讯会议的通讯录好友发起的"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning"]
    answer_fields = [{"type": "number", "label": "好友发起的会议数"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return TencentMeeting(input.apps_init["tencent_meeting"]).friend_hosted_history_meeting_count()


class GetSecondParticipationTime(AnswerTask):
    templates = ["帮我查一下{topic}这场会议我第二次加入是几点"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning"]
    answer_fields = [{"type": "text", "label": "第二次加入时间", "hint": "如：10:00", "matcher": "time"}]
    parameters = {
        "topic": {
            "type": "enum",
            "values": ["长时间研讨会"],
            "default": "长时间研讨会",
            "description": "历史会议主题",
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        return TencentMeeting(input.apps_init["tencent_meeting"]).second_participation_time(self.p.topic)


class FindLongestMeeting(AnswerTask):
    templates = ["历史会议里开得最久的是哪一场"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning"]
    answer_fields = [{"type": "text", "label": "最久会议主题"}]

    def get_answer(self, input: JudgeInput) -> Any:
        meeting = TencentMeeting(input.apps_init["tencent_meeting"]).longest_history_meeting()
        return str(meeting["title"])


class FindMeetingWithMostParticipants(AnswerTask):
    templates = ["历史会议里我开的哪一场会议参加的人最多，总共有多少人"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning"]
    answer_fields = [
        {"type": "text", "label": "会议主题"},
        {"type": "number", "label": "参会人数"},
    ]

    def get_answer(self, input: JudgeInput) -> Any:
        meeting = TencentMeeting(input.apps_init["tencent_meeting"]).hosted_history_meeting_with_most_participants()
        return {
            "title": meeting["title"],
            "count": len(meeting["participants"]),
        }


class CountMeetingsByDate(AnswerTask):
    templates = ["帮我数一下{date}这天有多少场历史会议"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning"]
    answer_fields = [{"type": "number", "label": "历史会议数"}]
    parameters = {
        "date": {
            "type": "enum",
            "values": TENCENT_MEETING_HISTORY_DATE_VALUES,
            "default": "2026-02-03",
            "description": "历史会议日期",
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        return TencentMeeting(input.apps_init["tencent_meeting"]).count_history_meetings_on_date(self.p.date)


# =============================================================================
# L4 — Deep multi-step & complex reasoning
# =============================================================================


class ShareScreenAndConfirm(BaseTask):
    templates = [
        "加入{host_name}的{topic}会议，先共享屏幕，然后给所有人发消息：{message}",
        "Join {host_name}'s {topic} meeting, share your screen, then broadcast the message '{message}' to everyone",
    ]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["social"]
    parameters = {
        "host_name": {"type": "string", "default": "张三", "description": "会议主持人"},
        "topic": {"type": "string", "default": "产品需求讨论", "description": "会议主题"},
        "message": {"type": "string", "default": "我开始共享屏幕了", "description": "群发消息内容"},
    }
    expected_changes = ["activeMeeting"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"])
        meeting = tm.active_meeting
        sent = None
        if meeting is not None:
            for message in tm.am_chat_messages:
                if (
                    message["text"] == self.p.message
                    and message["senderId"] == tm.user_id
                    and message["toId"] == "all"
                ):
                    sent = message
                    break
        settings = meeting["settings"] if meeting is not None else None
        return [
            {
                "field": "activeMeeting.title",
                "expected": self.p.topic,
                "actual": meeting["title"] if meeting is not None else None,
                "passed": meeting is not None and meeting["title"] == self.p.topic,
            },
            {
                "field": "activeMeeting.settings.isSharing",
                "expected": True,
                "actual": settings.get("isSharing") if settings is not None else None,
                "passed": settings is not None and settings.get("isSharing", False) is True,
            },
            {
                "field": "activeMeeting.chatMessages.broadcast",
                "expected": f"message to all: {self.p.message}",
                "actual": sent,
                "passed": sent is not None,
            },
        ]


class ChatWithSpecificUser(BaseTask):
    templates = [
        "进入{host_name}的{topic}会议，单独给{target_user}发一条消息：{message}",
        "Join {host_name}'s {topic} meeting and send a private message to {target_user}: {message}",
    ]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["social"]
    parameters = {
        "host_name": {"type": "string", "default": "李四", "description": "会议主持人"},
        "topic": {"type": "string", "default": "技术方案评审", "description": "会议主题"},
        "target_user": {"type": "string", "default": "李四", "description": "私聊对象"},
        "message": {"type": "string", "default": "我单独发你一下", "description": "聊天内容"},
    }
    expected_changes = ["activeMeeting"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"])
        meeting = tm.active_meeting
        sent = None
        if meeting is not None:
            for message in tm.am_chat_messages:
                if (
                    message["text"] == self.p.message
                    and message["senderId"] == tm.user_id
                    and message["to"] == self.p.target_user
                    and message["toId"] != "all"
                ):
                    sent = message
                    break
        return [
            {
                "field": "activeMeeting.title",
                "expected": self.p.topic,
                "actual": meeting["title"] if meeting is not None else None,
                "passed": meeting is not None and meeting["title"] == self.p.topic,
            },
            {
                "field": "activeMeeting.chatMessages.private",
                "expected": f"{self.p.target_user}: {self.p.message}",
                "actual": sent,
                "passed": sent is not None,
            },
        ]


class ScheduleTeamMeeting(BaseTask):
    templates = [
        "帮我预约一场主题为{topic}的会议，邀请张三和李四，关掉日历提醒，打开自动使用加时卡",
        "Schedule a meeting with topic {topic}, invite 张三 and 李四, turn off calendar reminders, and turn on auto-use overtime card",
    ]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["create"]
    parameters = {
        "topic": {
            "type": "enum",
            "values": TENCENT_MEETING_NEW_TEAM_TOPICS,
            "default": "跨组同步会",
            "description": "团队会议主题",
        },
    }
    expected_changes = ["scheduledMeetings", "currentScheduledMeeting"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps["tencent_meeting"], init=input.apps_init["tencent_meeting"])
        new_meeting = tm.new_scheduled_meeting_by_title(self.p.topic)
        invitees = [invitee["name"] for invitee in new_meeting["invitees"]] if new_meeting is not None else None
        settings = new_meeting["settings"] if new_meeting is not None else None
        return [
            {
                "field": "scheduledMeetings.new.title",
                "expected": self.p.topic,
                "actual": new_meeting["title"] if new_meeting is not None else None,
                "passed": new_meeting is not None and new_meeting["title"] == self.p.topic,
            },
            {
                "field": "scheduledMeetings.new.invitees",
                "expected": ["张三", "李四"],
                "actual": invitees,
                "passed": invitees is not None and "张三" in invitees and "李四" in invitees,
            },
            {
                "field": "scheduledMeetings.new.settings.calendar",
                "expected": False,
                "actual": settings.get("calendar") if settings is not None else None,
                "passed": settings is not None and settings.get("calendar") is False,
            },
            {
                "field": "scheduledMeetings.new.settings.autoUseOvertimeCard",
                "expected": True,
                "actual": settings.get("autoUseOvertimeCard") if settings is not None else None,
                "passed": settings is not None and settings.get("autoUseOvertimeCard") is True,
            },
        ]


class CalculateTotalMeetingDuration(AnswerTask):
    templates = ["帮我算一下{date}这天我一共开了多久会议，多少分钟"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["query", "reasoning"]
    answer_fields = [{"type": "number", "label": "总时长（分钟）"}]
    parameters = {
        "date": {
            "type": "enum",
            "values": TENCENT_MEETING_HISTORY_DATE_VALUES,
            "default": "2026-02-03",
            "description": "历史会议日期",
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        return tm.total_participation_minutes_on_date(self.p.date)


class CompareParticipationDurations(AnswerTask):
    templates = ["{topic1}和{topic2}这两场会议，我哪一场参加的时间更长"]
    apps = ["tencent_meeting"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["query", "reasoning"]
    answer_fields = [{"type": "choice", "label": "参加时间更长的会议", "options": ["{topic1}", "{topic2}", "一样长"]}]
    parameters = {
        "topic1": {"type": "string", "default": "小明的快速会议", "description": "会议主题1"},
        "topic2": {"type": "string", "default": "长时间研讨会", "description": "会议主题2"},
        "_topics": {
            "sampler": TencentMeeting.sample_two_participation_topics,
            "fields": {"topic1": "topic1", "topic2": "topic2"},
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        duration1 = tm.total_participation_minutes(self.p.topic1)
        duration2 = tm.total_participation_minutes(self.p.topic2)
        if duration1 > duration2:
            return self.p.topic1
        if duration2 > duration1:
            return self.p.topic2
        return re.compile(r"一样|相同|差不多")

    def get_expected_response(self, input: JudgeInput) -> list:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        d1 = tm.total_participation_minutes(self.p.topic1)
        d2 = tm.total_participation_minutes(self.p.topic2)
        if d1 > d2:
            return [self.p.topic1]
        if d2 > d1:
            return [self.p.topic2]
        return ["一样长"]
