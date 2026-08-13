"""Live scripted-plan verification for the cross-app work suite.

Single-source policy: wxid mappings, schedule/alarm wheel indices (with their
minute-anchor waits), calendar day-cell texts, predicted meeting ids and the
full report messages are **not** injected here — they come from
``scripted_plans.DERIVED_PARAMS``, computed at materialization time from the
episode's post-setup initial state through the judge-homologous domain
classes. That is exactly the official ``--agent scripted`` sampling path, so
these live cases regression-test the derivation itself (the former
``_with_dynamic_params`` post-sample monkeypatches are gone).

Only *declared* task parameters stay pinned below, for deterministic
coverage. Branch notes:

- ``FullMeetingConflictCheckBroadcast``: with no test seed the task's
  ``_post_sample`` conflict draw is deterministic (``Random(0 ^ 0xC001D00D)``
  → False), so the live case always exercises the **free** arm; the busy arm
  runs on seeded CLI sampling.
- ``WeatherConditionalCancelMeeting``: 北京 tomorrow is dry in the static
  weather library, so the live case exercises the **dry** (keep + alarm) arm;
  rainy sampled cities take the cancel arm on the CLI path.
- ``MeetingLongestInfoToWechat`` / ``MeetingDurationToWechat`` pin the
  5-meeting 2026-02-03 date arm (sampling also covers 2026-02-04).
"""

from __future__ import annotations

from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.registry import TaskRegistry
from bench_env.tests.crossapp_work.scripted_plans import PLANS
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "crossapp_work"
SCRIPTED_MAX_STEPS = {
    # 排程时间滚轮的滑动步数随当前时刻变化（含锚定等待步，最坏 ~65 步 > L4 默认 60）。
    "FullMeetingConflictCheckBroadcast": 80,
    # 同上（预约 + 日历 + 微信）。
    "MeetingFullFlowToWechat": 80,
    # 日历读两场会议详情 + 文件整理 + 微信汇报（≈67 步 > L4 默认 60）。
    "OrganizeMeetingMaterialsToWechat": 80,
    "OrganizePdfReportsToWechat": 120,
    # 相册逐张核对 6 张候选照片 + 文件整理 + 微信发图（≈73 步 > L4 默认 60）。
    "OrganizeReimbursementPhotosToWechat": 90,
    # 排程滚轮 + 时长滚轮 + 笔记/微信/短信三端通知。
    "ScheduleReleaseMeetingAndNotifyViaNotesWechatSms": 80,
    # 13 场历史会议逐场进详情比较预定时长（≈58 步 > 任务预算 45）。
    "TencentMeetingLongestPlannedToWechat": 75,
    # 干燥分支闹钟分钟轮最坏 30 格 + 小时轮 12 格（随当前时刻变化）。
    "WeatherConditionalCancelMeeting": 75,
}


def _task(task_name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{task_name}", **params)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CalendarEarliestToAlarm", lambda: _task("CalendarEarliestToAlarm")),
    ("CountCurrentLogErrorsToWechat", lambda: _task("CountCurrentLogErrorsToWechat")),
    ("CountOpenWorkOrdersFromPhotosToWechat", lambda: _task("CountOpenWorkOrdersFromPhotosToWechat")),
    ("ExistingMeetingToCalendar", lambda: _task("ExistingMeetingToCalendar", topic="项目例会")),
    (
        "FullMeetingConflictCheckBroadcast",
        lambda: _task(
            "FullMeetingConflictCheckBroadcast",
            time="03:30",
            flow_topic="临时协调会",
            contact="张伟",
            contact2="张三",
        ),
    ),
    ("InspectionReportToWechat", lambda: _task("InspectionReportToWechat")),
    ("MeetingDurationToWechat", lambda: _task("MeetingDurationToWechat", date="2026-02-03", contact="张伟")),
    ("MeetingFullFlowToWechat", lambda: _task("MeetingFullFlowToWechat", time="10:00", contact="张伟")),
    (
        "MeetingJoinAndNotifySms",
        lambda: _task("MeetingJoinAndNotifySms", topic="老王的快速会议", name="访客小王", contact="张三"),
    ),
    ("MeetingLongestInfoToWechat", lambda: _task("MeetingLongestInfoToWechat", date="2026-02-03", contact="张伟")),
    ("MeetingMultiChannelNotify", lambda: _task("MeetingMultiChannelNotify", contact1="张伟", contact2="张三")),
    ("MeetingReminderToNotes", lambda: _task("MeetingReminderToNotes")),
    # contact 固定为"无既有会话"的李娜 → 确定性覆盖微信路径 Branch 的 contacts 臂
    # （其余用例的张伟有会话线程，覆盖 chat 臂）。
    ("MeetingRouteEtaToWechat", lambda: _task("MeetingRouteEtaToWechat", place="中国国家博物馆", contact="李娜")),
    ("OrganizeMeetingMaterialsToWechat", lambda: _task("OrganizeMeetingMaterialsToWechat")),
    ("OrganizePdfReportsToWechat", lambda: _task("OrganizePdfReportsToWechat")),
    ("OrganizeReimbursementPhotosToWechat", lambda: _task("OrganizeReimbursementPhotosToWechat")),
    (
        "ScheduleReleaseMeetingAndNotifyViaNotesWechatSms",
        lambda: _task("ScheduleReleaseMeetingAndNotifyViaNotesWechatSms", contact="张伟", sms_contact="张三"),
    ),
    (
        "SmsAndCalendarOnDate",
        lambda: _task("SmsAndCalendarOnDate", contact="张三", message="明天见", event_title="约会"),
    ),
    ("SubmitRequestedAttachmentsToBoss", lambda: _task("SubmitRequestedAttachmentsToBoss")),
    (
        "TencentMeetingKeywordLongestParticipationToNotes",
        lambda: _task("TencentMeetingKeywordLongestParticipationToNotes", keyword="快速会议"),
    ),
    ("TencentMeetingLongestPlannedToWechat", lambda: _task("TencentMeetingLongestPlannedToWechat", contact="张伟")),
    ("WeatherConditionalCancelMeeting", lambda: _task("WeatherConditionalCancelMeeting", city="北京", topic="月末总结")),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(__import__("bench_env.task.crossapp_work.tasks", fromlist=["*"]))
    missing = declared - covered
    planned = {key.split(".", 1)[1] for key in PLANS if key.startswith(f"{SUITE}.")}
    unplanned = declared - planned
    assert not missing, f"crossapp_work tasks without a scripted case: {sorted(missing)}"
    assert not unplanned, f"crossapp_work tasks without a scripted plan: {sorted(unplanned)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_crossapp_work_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE, max_steps=SCRIPTED_MAX_STEPS.get(name))
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
