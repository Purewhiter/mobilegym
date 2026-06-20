"""Live scripted-plan verification for the Tencent Meeting suite."""

from __future__ import annotations

import datetime as dt
from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.tencent_meeting import tasks as meeting_tasks
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)
from bench_env.tests.tencent_meeting.test_tasks import _clone_state

SUITE = "tencent_meeting"


def _tm() -> TencentMeeting:
    return TencentMeeting(_clone_state())


def _meeting_id(topic: str) -> str:
    for meeting in _clone_state()["ongoingMeetings"]:
        if meeting["title"] == topic:
            return str(meeting["meetingId"])
    raise AssertionError(f"Missing ongoing meeting {topic!r}")


def _scheduled_end_time_after(hours: int) -> str:
    return (dt.datetime.now() + dt.timedelta(hours=hours)).strftime("%H:%M")


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("ConfigAudioSettings", lambda: meeting_tasks.ConfigAudioSettings(mic_on=False, speaker_on=False)),
    ("CheckPersonalRoomId", lambda: meeting_tasks.CheckPersonalRoomId(answer=_tm().personal_room["meetingId"])),
    ("CheckContactCount", lambda: meeting_tasks.CheckContactCount(answer=str(len(_tm().contacts)))),
    ("ToggleNotification", lambda: meeting_tasks.ToggleNotification(notifications=False)),
    (
        "FindMeetingHistory",
        lambda: meeting_tasks.FindMeetingHistory(
            topic="长时间研讨会",
            answer_start=_tm().history_meeting_start_and_duration("长时间研讨会")["start_time"],
            answer_duration="180分钟",
        ),
    ),
    (
        "StartFastMeeting",
        lambda: meeting_tasks.StartFastMeeting(video_on=True, mute_on=True, use_personal_room=False),
    ),
    (
        "ChatInMeeting",
        lambda: meeting_tasks.ChatInMeeting(
            host_name="老王",
            topic="老王的快速会议",
            meeting_id=_meeting_id("老王的快速会议"),
            message="大家好，我到了",
        ),
    ),
    ("ConfigPrivacySettings", lambda: meeting_tasks.ConfigPrivacySettings(hide_non_video=True, hide_self=True)),
    ("ConfigShowIdentity", lambda: meeting_tasks.ConfigShowIdentity(show_identity=True)),
    ("CheckPendingMeetingId", lambda: meeting_tasks.CheckPendingMeetingId(topic="项目例会", answer="836 291 475")),
    (
        "CheckScheduledMeetingEndTime",
        lambda: meeting_tasks.CheckScheduledMeetingEndTime(
            topic="项目例会",
            answer=_scheduled_end_time_after(3),
        ),
    ),
    (
        "JoinMeetingAndRename",
        lambda: meeting_tasks.JoinMeetingAndRename(
            host_name="李四",
            topic="技术方案评审",
            meeting_id=_meeting_id("技术方案评审"),
            name="小明-北京",
            mute_on=True,
        ),
    ),
    (
        "ScheduleMeeting",
        lambda: meeting_tasks.ScheduleMeeting(
            topic="预算评审会",
            duration=30,
            pin="2468",
            answer="888 666 1234",
        ),
    ),
    ("CountFriendMeetings", lambda: meeting_tasks.CountFriendMeetings(answer=str(_tm().friend_hosted_history_meeting_count()))),
    ("GetSecondParticipationTime", lambda: meeting_tasks.GetSecondParticipationTime(topic="长时间研讨会", answer="15:00")),
    ("FindLongestMeeting", lambda: meeting_tasks.FindLongestMeeting(answer=_tm().longest_history_meeting()["title"])),
    (
        "FindMeetingWithMostParticipants",
        lambda: meeting_tasks.FindMeetingWithMostParticipants(
            answer_title=_tm().hosted_history_meeting_with_most_participants()["title"],
            answer_count=str(len(_tm().hosted_history_meeting_with_most_participants()["participants"])),
        ),
    ),
    (
        "ShareScreenAndConfirm",
        lambda: meeting_tasks.ShareScreenAndConfirm(
            host_name="张三",
            topic="产品需求讨论",
            meeting_id=_meeting_id("产品需求讨论"),
            message="我开始共享屏幕了",
        ),
    ),
    (
        "ChatWithSpecificUser",
        lambda: meeting_tasks.ChatWithSpecificUser(
            host_name="李四",
            topic="技术方案评审",
            meeting_id=_meeting_id("技术方案评审"),
            target_user="李四",
            message="我单独发你一下",
        ),
    ),
    (
        "CalculateTotalMeetingDuration",
        lambda: meeting_tasks.CalculateTotalMeetingDuration(date="2026-02-03", answer=str(_tm().total_participation_minutes_on_date("2026-02-03"))),
    ),
    (
        "CompareParticipationDurations",
        lambda: meeting_tasks.CompareParticipationDurations(
            topic1="小明的快速会议",
            topic2="长时间研讨会",
            answer="长时间研讨会",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(meeting_tasks)
    missing = declared - covered
    assert not missing, f"Tencent Meeting tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_tencent_meeting_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
