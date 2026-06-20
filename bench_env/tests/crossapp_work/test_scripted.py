"""Live scripted-plan verification for the cross-app work suite."""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.map.app import Map
from bench_env.task.registry import TaskRegistry
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.task.utils import now_ms, sim_datetime, sim_today, tomorrow_ymd
from bench_env.task.wechat.app import Wechat
from bench_env.tests.crossapp_work.scripted_plans import PLANS
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)
from bench_env.tests.tencent_meeting.test_tasks import BASE_STATE as TM_BASE_STATE, TEST_OS_STATE

SUITE = "crossapp_work"
ROOT = Path(__file__).resolve().parents[3]
SCRIPTED_MAX_STEPS = {
    "OrganizePdfReportsToWechat": 120,
    "ScheduleReleaseMeetingAndNotifyViaNotesWechatSms": 75,
}


def _load_json(*parts: str) -> dict[str, Any]:
    return json.loads(ROOT.joinpath(*parts).read_text(encoding="utf-8"))


def _wechat() -> Wechat:
    return Wechat(_load_json("apps", "Wechat", "data", "defaults.json"))


def _wxid(contact: str) -> str:
    return _wechat().require_contact_wxid(contact)


def _contact(contact: str = "张伟") -> dict[str, str]:
    return {"contact": contact, "contact_wxid": _wxid(contact)}


def _task(task_name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{task_name}", **params)


def _tm() -> TencentMeeting:
    return TencentMeeting(TM_BASE_STATE)


def _sim_today() -> dt.date:
    return dt.date.today()


def _tomorrow() -> str:
    return (_sim_today() + dt.timedelta(days=1)).isoformat()


def _meeting_id(topic: str) -> str:
    for meeting in TM_BASE_STATE["ongoingMeetings"]:
        if str(meeting.get("title")) == topic:
            return str(meeting["meetingId"])
    raise AssertionError(f"Missing ongoing meeting {topic!r}")


def _scheduled(topic: str) -> dict[str, Any]:
    return _tm().find_scheduled_meeting(topic)


def _scheduled_date_time(topic: str) -> dict[str, str]:
    meeting = _scheduled(topic)
    start = dt.datetime.fromtimestamp(int(meeting["startTime"]) / 1000)
    end = start + dt.timedelta(minutes=int(meeting.get("duration", 60)))
    return {"date": start.date().isoformat(), "start": start.strftime("%H:%M"), "end": end.strftime("%H:%M")}


def _route_duration(place: str) -> str:
    return str(Map.geo_route_to(place, "WALKING")["duration"])


def _longest_history_message() -> str:
    longest = _tm().longest_history_meeting()
    return f"{longest['meetingId']} {longest['title']}"


def _duration_message(date_value: str) -> str:
    total = _tm().total_participation_minutes_on_date(date_value)
    return TencentMeeting.format_duration_minutes_zh(total)


def _upcoming_note() -> str:
    meetings, _kind = _tm().upcoming_or_ongoing()
    return "\n".join(
        f"{meeting['title']} {_tm().parse_meeting_time(meeting['startTime']).strftime('%H:%M')}"
        for meeting in meetings
    )


def _time_after(time_text: str, minutes: int) -> str:
    h, m = [int(part) for part in time_text.split(":", 1)]
    value = dt.datetime(2000, 1, 1, h, m) + dt.timedelta(minutes=minutes)
    return value.strftime("%H:%M")


def _default_schedule_start(os_state: dict[str, Any]) -> dt.datetime:
    now = sim_datetime(os_state)
    rounded_minutes = ((now.minute + 30 + 4) // 5) * 5
    base = now.replace(second=0, microsecond=0)
    return base + dt.timedelta(minutes=rounded_minutes - now.minute)


def _schedule_params(state: dict[str, Any], target_time: str, *, duration_minutes: int | None = None) -> dict[str, str]:
    default_start = _default_schedule_start(state["os"])
    today = sim_today(state["os"])
    target_hour, target_minute = [int(part) for part in target_time.split(":", 1)]
    out = {
        "schedule_date_index_current": str((default_start.date() - today).days),
        "schedule_date_index_target": "1",
        "schedule_hour_current": str(default_start.hour),
        "schedule_hour_target": str(target_hour),
        "schedule_minute_index_current": str(default_start.minute // 5),
        "schedule_minute_index_target": str(target_minute // 5),
    }
    if duration_minutes is not None:
        out.update(
            {
                "schedule_duration_hour_current": "0",
                "schedule_duration_hour_target": str(duration_minutes // 60),
                "schedule_duration_minute_index_current": "6",
                "schedule_duration_minute_index_target": str((duration_minutes % 60) // 5),
            }
        )
    return out


def _with_dynamic_params(task: BaseTask, builder: Callable[[dict[str, Any], BaseTask], dict[str, Any]]) -> BaseTask:
    original_post_sample = task._post_sample

    async def _post_sample(env: MobileGymEnv) -> None:
        await original_post_sample(env)
        state = await env.get_state(required_apps=task.apps or None)
        task.params.update(builder(state, task))

    task._post_sample = _post_sample  # type: ignore[method-assign]
    return task


def _with_meeting_calendar_params(task: BaseTask) -> BaseTask:
    def build(state: dict[str, Any], current_task: BaseTask) -> dict[str, str]:
        meeting = TencentMeeting(state["apps"]["tencent_meeting"]).find_scheduled_meeting(current_task.params["topic"])
        start = dt.datetime.fromtimestamp(TencentMeeting.meeting_start_timestamp_ms(meeting) / 1000)
        end = start + dt.timedelta(minutes=int(meeting.get("duration", 60)))
        return {"date": start.date().isoformat(), "start": start.strftime("%H:%M"), "end": end.strftime("%H:%M")}

    return _with_dynamic_params(task, build)


def _with_route_message(task: BaseTask) -> BaseTask:
    def build(state: dict[str, Any], current_task: BaseTask) -> dict[str, str]:
        tm = TencentMeeting(state["apps"]["tencent_meeting"])
        meeting = tm.first_upcoming_scheduled(now_ms(state["os"]))
        return {
            "wechat_message": (
                f"{_route_duration(current_task.params['place'])} "
                f"{meeting['title']} {TencentMeeting.meeting_start_hh_mm(meeting)}"
            )
        }

    return _with_dynamic_params(task, build)


def _with_live_upcoming_note(task: BaseTask) -> BaseTask:
    def build(state: dict[str, Any], _current_task: BaseTask) -> dict[str, str]:
        tm = TencentMeeting(state["apps"]["tencent_meeting"])
        meetings, _kind = tm.upcoming_or_ongoing()
        return {
            "note_content": "\n".join(
                f"{meeting['title']} {tm.parse_meeting_time(meeting['startTime']).strftime('%H:%M')}"
                for meeting in meetings
            )
        }

    return _with_dynamic_params(task, build)


def _with_alarm_before_meeting(task: BaseTask) -> BaseTask:
    def build(state: dict[str, Any], current_task: BaseTask) -> dict[str, str]:
        meeting = TencentMeeting(state["apps"]["tencent_meeting"]).find_scheduled_meeting(current_task.params["topic"])
        start_ms = TencentMeeting.meeting_start_timestamp_ms(meeting)
        alarm = dt.datetime.fromtimestamp(start_ms / 1000) - dt.timedelta(minutes=30)
        source = sim_datetime(state["os"])
        wheel_minute = (alarm.minute + 3) % 60 if (alarm.minute - source.minute) % 60 == 30 else alarm.minute
        return {
            "alarm_hour": str(alarm.hour),
            "alarm_minute": str(alarm.minute),
            "alarm_wheel_minute": str(wheel_minute),
            "alarm_source_time": source.strftime("%H:%M"),
            "alarm_source_hour": str(source.hour),
            "alarm_source_minute": str(source.minute),
        }

    return _with_dynamic_params(task, build)


def _with_today_inspector(task: BaseTask) -> BaseTask:
    def build(state: dict[str, Any], current_task: BaseTask) -> dict[str, str]:
        inspector = current_task.inspector_for_os(state["os"])  # type: ignore[attr-defined]
        return {"inspector_wxid": _wxid(inspector)}

    return _with_dynamic_params(task, build)


def _with_schedule_params(task: BaseTask, *, time_param: str = "time", duration_minutes: int | None = None) -> BaseTask:
    def build(state: dict[str, Any], current_task: BaseTask) -> dict[str, Any]:
        target_time = str(current_task.params[time_param])
        return {
            **_schedule_params(state, target_time, duration_minutes=duration_minutes),
            "tomorrow": tomorrow_ymd(state["os"]),
            "end_time": _time_after(target_time, duration_minutes or 30),
        }

    return _with_dynamic_params(task, build)


def _with_free_conflict_flow_params(task: BaseTask) -> BaseTask:
    def build(state: dict[str, Any], current_task: BaseTask) -> dict[str, Any]:
        target_time = str(current_task.params["time"])
        message = f"{current_task.params['flow_topic']} 8886661234"
        return {
            **_schedule_params(state, target_time),
            "tomorrow": tomorrow_ymd(state["os"]),
            "end_time": _time_after(target_time, 30),
            "wechat_message": message,
            "sms_message": message,
        }

    return _with_dynamic_params(task, build)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CalendarEarliestToAlarm", lambda: _task("CalendarEarliestToAlarm")),
    ("CountCurrentLogErrorsToWechat", lambda: _task("CountCurrentLogErrorsToWechat", boss_wxid=_wxid("Boss"), wechat_message="当前日志错误 23 个")),
    ("CountOpenWorkOrdersFromPhotosToWechat", lambda: _task("CountOpenWorkOrdersFromPhotosToWechat", chenjing_wxid=_wxid("陈静"), wechat_message="未闭环工单共27个，拍过照12个：WO-A-001 WO-A-002 WO-A-006 WO-A-008 WO-A-012 WO-A-015 WO-A-019 WO-A-020 WO-A-025 WO-A-027 WO-A-032 WO-A-033 WO-B-002 WO-B-006 WO-B-008 WO-B-012 WO-B-019 WO-B-027 WO-B-032 WO-C-002 WO-C-006 WO-C-012 WO-C-019 WO-C-027 WO-C-032 WO-D-002 WO-D-012")),
    ("ExistingMeetingToCalendar", lambda: _with_meeting_calendar_params(_task("ExistingMeetingToCalendar", topic="项目例会", **_scheduled_date_time("项目例会")))),
    ("FullMeetingConflictCheckBroadcast", lambda: _with_free_conflict_flow_params(_task("FullMeetingConflictCheckBroadcast", time="03:30", flow_topic="临时协调会", **_contact(), contact2="中国联通", busy_message="那个时间不行，有冲突"))),
    ("InspectionReportToWechat", lambda: _with_today_inspector(_task("InspectionReportToWechat", boss_wxid=_wxid("Boss"), wechat_message="NET-04 端口丢包；DB-11 备份延迟"))),
    ("MeetingDurationToWechat", lambda: _task("MeetingDurationToWechat", date="2026-02-03", **_contact(), wechat_message=_duration_message("2026-02-03"))),
    (
        "MeetingFullFlowToWechat",
        lambda: _with_schedule_params(_task(
            "MeetingFullFlowToWechat",
            topic="项目周会",
            pin="123456",
            time="10:00",
            end_time="11:00",
            tomorrow=_tomorrow(),
            **_contact(),
            wechat_message="项目周会 8886661234",
        )),
    ),
    ("MeetingJoinAndNotifySms", lambda: _task("MeetingJoinAndNotifySms", topic="老王的快速会议", meeting_id=_meeting_id("老王的快速会议"), name="访客小王", contact="张三", sms_message="我已入会")),
    ("MeetingLongestInfoToWechat", lambda: _task("MeetingLongestInfoToWechat", date="2026-02-03", **_contact(), wechat_message=_longest_history_message())),
    ("MeetingMultiChannelNotify", lambda: _task("MeetingMultiChannelNotify", topic="快速会议", pin="123456", contact1="张伟", contact1_wxid=_wxid("张伟"), contact2="张三", wechat_message="会议号 8886661234", sms_message="会议号 8886661234")),
    ("MeetingReminderToNotes", lambda: _with_live_upcoming_note(_task("MeetingReminderToNotes", note_content=_upcoming_note()))),
    ("MeetingRouteEtaToWechat", lambda: _with_route_message(_task("MeetingRouteEtaToWechat", place="中国国家博物馆", **_contact(), wechat_message=f"{_route_duration('中国国家博物馆')} 项目例会 11:00"))),
    ("OrganizeMeetingMaterialsToWechat", lambda: _task("OrganizeMeetingMaterialsToWechat", boss_wxid=_wxid("Boss"), wechat_message="会议附件_03.xlsx 会议附件_04.png 会议附件_05.txt 已整理")),
    ("OrganizePdfReportsToWechat", lambda: _task("OrganizePdfReportsToWechat", boss_wxid=_wxid("Boss"), wechat_message="项目进展报告.pdf 验收报告.pdf 阶段总结报告.pdf 测试报告.pdf 已整理")),
    ("OrganizeReimbursementPhotosToWechat", lambda: _task("OrganizeReimbursementPhotosToWechat", boss_wxid=_wxid("Boss"), wechat_message="报销照片已整理，合计359.70")),
    ("ScheduleReleaseMeetingAndNotifyViaNotesWechatSms", lambda: _with_schedule_params(_task("ScheduleReleaseMeetingAndNotifyViaNotesWechatSms", topic="版本发布会", pin="123456", time="09:00", **_contact(), sms_contact="张三", note_content="版本发布会 8886661234 密码123456", wechat_message="版本发布会 8886661234 密码123456", sms_message="版本发布会 8886661234 密码123456"), duration_minutes=15)),
    ("SmsAndCalendarOnDate", lambda: _task("SmsAndCalendarOnDate", contact="张三", message="明天见", event_title="约会", tomorrow=_tomorrow())),
    ("SubmitRequestedAttachmentsToBoss", lambda: _task("SubmitRequestedAttachmentsToBoss", boss_wxid=_wxid("Boss"), wechat_message="供应商盖章确认.pdf 流水截图_A.png 已提交")),
    ("TencentMeetingKeywordLongestParticipationToNotes", lambda: _task("TencentMeetingKeywordLongestParticipationToNotes", keyword="快速会议", note_content="6 小明的快速会议")),
    ("TencentMeetingLongestPlannedToWechat", lambda: _task("TencentMeetingLongestPlannedToWechat", **_contact(), wechat_message=f"{_tm().longest_history_meeting()['title']} {_tm().meeting_host_name(_tm().longest_history_meeting())}")),
    ("WeatherConditionalCancelMeeting", lambda: _with_alarm_before_meeting(_task("WeatherConditionalCancelMeeting", city="北京", topic="月末总结"))),
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
