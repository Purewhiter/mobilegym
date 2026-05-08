from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_SEND_CHANGES, Wechat


class TencentMeetingLongestPlannedToWechat(BaseTask):
    """判定：微信消息包含历史会议里预定时长（duration）最长一场的标题和主持人姓名。

    注意区分"预定时长 duration"（会议记录自带字段）与"参会时长"（participations 累计）。
    采样保证历史会议 duration 无并列最高。
    """

    templates = [
        "在腾讯会议历史会议里，找预定时长最长的一场，把会议名称和主持人姓名发给微信联系人“{contact}”。",
    ]
    apps = ["tencent_meeting", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["query", "reasoning", "transfer"]
    parameters = {
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        # longest_history_meeting 会在存在并列最长的情况下主动 raise（见 tencent_meeting/app.py）
        longest = tm.longest_history_meeting()
        host = tm.meeting_host_name(longest)
        return [
            wechat.check_new_sent_norm_contains(
                self.p.contact,
                str(longest["title"]),
                host,
                field="longest_history_share",
            ),
        ]
