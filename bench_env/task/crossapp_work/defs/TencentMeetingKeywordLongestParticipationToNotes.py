from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import NOTES_CREATE_CHANGES, Notes
from bench_env.task.tencent_meeting.app import TencentMeeting


class TencentMeetingKeywordLongestParticipationToNotes(BaseTask):
    """判定：新笔记同时包含（a）标题含 keyword 的会议数量，和（b）这些会议中参会时长最长一场的会议名称。

    参会时长指 participations[*].duration 之和（单位毫秒），与"预定时长 duration"不同。
    采样关键词默认为 "快速会议"。
    """

    templates = [
        "统计腾讯会议历史里名称包含“{keyword}”的会议数量，并把这些会议里参会时长最长的那场会议名一起写到笔记里。",
    ]
    apps = ["tencent_meeting", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "create", "handoff"]
    parameters = {
        "keyword": {
            "type": "enum",
            "values": {"快速会议": "快速会议"},
            "default": "快速会议",
            "description": "历史会议名称关键词",
        },
    }
    expected_changes = NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        tm = TencentMeeting(input.apps_init["tencent_meeting"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        count = tm.count_history_meetings_with_keyword(self.p.keyword)
        longest = tm.history_meeting_with_max_participation(self.p.keyword)
        title = str(longest["title"])
        return [
            notes.check_latest_norm_contains(str(count), title, field="keyword_longest_participation_note"),
        ]
