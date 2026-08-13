"""Live scripted-plan verification for the Tencent Meeting suite.

Single-source policy: answers, ``meeting_id`` and the schedule-duration wheel
targets are **not** injected here — they come from
``scripted_plans.DERIVED_PARAMS``, computed at materialization time from the
episode's post-setup initial state through the judge-homologous
``TencentMeeting`` domain class. That is exactly the official
``--agent scripted`` sampling path, so these live cases regression-test the
derivation itself.

Only *declared* task parameters stay pinned below, for deterministic
coverage: topics keep the historical live-test values;
``ScheduleMeeting.duration=60`` deliberately differs from the form's 30-min
default so the duration-picker wheel steps are exercised (30 would expand to
zero swipes); ``CalculateTotalMeetingDuration.date`` pins the 5-meeting
2026-02-03 branch (the sampling runs cover 2026-02-04).
"""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.tencent_meeting import tasks as meeting_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "tencent_meeting"


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("ConfigAudioSettings", lambda: meeting_tasks.ConfigAudioSettings(mic_on=False, speaker_on=False)),
    ("CheckPersonalRoomId", lambda: meeting_tasks.CheckPersonalRoomId()),
    ("CheckContactCount", lambda: meeting_tasks.CheckContactCount()),
    ("ToggleNotification", lambda: meeting_tasks.ToggleNotification(notifications=False)),
    ("FindMeetingHistory", lambda: meeting_tasks.FindMeetingHistory(topic="长时间研讨会")),
    (
        "StartFastMeeting",
        lambda: meeting_tasks.StartFastMeeting(video_on=True, mute_on=True, use_personal_room=False),
    ),
    (
        "ChatInMeeting",
        lambda: meeting_tasks.ChatInMeeting(
            host_name="老王",
            topic="老王的快速会议",
            message="大家好，我到了",
        ),
    ),
    ("ConfigPrivacySettings", lambda: meeting_tasks.ConfigPrivacySettings(hide_non_video=True, hide_self=True)),
    ("ConfigShowIdentity", lambda: meeting_tasks.ConfigShowIdentity(show_identity=True)),
    ("CheckPendingMeetingId", lambda: meeting_tasks.CheckPendingMeetingId(topic="项目例会")),
    ("CheckScheduledMeetingEndTime", lambda: meeting_tasks.CheckScheduledMeetingEndTime(topic="项目例会")),
    (
        "JoinMeetingAndRename",
        lambda: meeting_tasks.JoinMeetingAndRename(
            host_name="李四",
            topic="技术方案评审",
            name="小明-北京",
            mute_on=True,
        ),
    ),
    (
        "ScheduleMeeting",
        # duration=60 ≠ 表单默认 30：确定性走一遍时长滚轮（小时 0→1、分钟 30→0）。
        lambda: meeting_tasks.ScheduleMeeting(topic="预算评审会", duration=60, pin="2468"),
    ),
    ("CountFriendMeetings", lambda: meeting_tasks.CountFriendMeetings()),
    ("GetSecondParticipationTime", lambda: meeting_tasks.GetSecondParticipationTime(topic="长时间研讨会")),
    ("FindLongestMeeting", lambda: meeting_tasks.FindLongestMeeting()),
    ("FindMeetingWithMostParticipants", lambda: meeting_tasks.FindMeetingWithMostParticipants()),
    (
        "ShareScreenAndConfirm",
        lambda: meeting_tasks.ShareScreenAndConfirm(
            host_name="张三",
            topic="产品需求讨论",
            message="我开始共享屏幕了",
        ),
    ),
    (
        "ChatWithSpecificUser",
        lambda: meeting_tasks.ChatWithSpecificUser(
            host_name="李四",
            topic="技术方案评审",
            target_user="李四",
            message="我单独发你一下",
        ),
    ),
    ("CalculateTotalMeetingDuration", lambda: meeting_tasks.CalculateTotalMeetingDuration(date="2026-02-03")),
    (
        "CompareParticipationDurations",
        lambda: meeting_tasks.CompareParticipationDurations(
            topic1="小明的快速会议",
            topic2="长时间研讨会",
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
