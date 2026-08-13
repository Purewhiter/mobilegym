"""Scripted replay plans for cross-app work tasks.

Sampling compatibility (Phase B): plans reference only declared task params or
``DERIVED_PARAMS`` entries computed at materialization time from the episode's
post-setup initial state, so the official ``--agent scripted`` CLI path works
without any test-injected values. Every calculator mirrors its task's judge
(check_goals in ``bench_env/task/crossapp_work/``) through the same domain
classes (TencentMeeting / Calendar / Weather / Wechat / Map) over the same
initial state, so derived values are judge-homologous by construction.

Time-sensitive wheel origins (minute-anchor pattern, mirrored from the clock
suite):

- **Tencent Meeting schedule form** — the form's default start time is
  captured at *form mount* (``ScheduleRegularMeetingPage`` useState:
  ``ceil((now.minute + 30) / 5) * 5``), which fixes the start-time picker's
  current wheel indices. ``{schedule_anchor_wait}`` (a derived wait placed
  right before the form-mount tap) parks the episode just past a minute
  boundary when one is near, so the ``schedule_*_current`` indices derived
  from the initial-state timestamp deterministically equal the mounted
  form's defaults.
- **Clock add-alarm draft** — initialized to sim now at the "+" tap;
  ``{alarm_anchor_wait}`` anchors it the same way so
  ``{alarm_source_time}`` (the row text ``set_alarm_time`` reopens) and the
  wheel origins stay in sync. The duration picker needs no anchor: its
  form default is the fixed 30 minutes (hour wheel index 0, minute wheel
  index 6).

Restricted ``Branch`` plans (pure pick over task + initial state):

- ``FullMeetingConflictCheckBroadcast`` — ``_post_sample`` seeds a calendar
  conflict from the task seed (50/50 on the sampling path); pick mirrors the
  judge's ``event_blocks_slot_on_date`` over the initial calendar state.
- ``WeatherConditionalCancelMeeting`` — pick mirrors the judge's
  ``tomorrow_is_rainy({city})`` (rain → cancel the meeting, dry → keep it
  and set the pre-meeting alarm).
- ``MeetingLongestInfoToWechat`` / ``MeetingDurationToWechat`` — the ``date``
  enum selects which fixed history group to walk (same pattern as
  ``tencent_meeting.CalculateTotalMeetingDuration``).
- **WeChat path arms (chat / contacts)** — the chat list only renders
  contacts with an existing thread (blank./张伟/王芳/Boss in the default
  data); every plan whose report target is a *sampled* contact branches on
  "does the initial state hold a chat with {contact}": existing thread →
  chat-list ``chat.open``, otherwise contacts tab → one scroll →
  ``userProfile.open`` → 发消息 (single-scroll geometry verified: rows 2-11
  tappable after one swipe; rows 0-1 are exactly the threaded blank./Boss).
"""

from __future__ import annotations

import datetime
from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    awake,
    back,
    complete,
    enter,
    home,
    swipe,
    type_text,
    wait,
)
from bench_env.task.calendar.app import Calendar
from bench_env.task.map.app import Map
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.task.utils import now_ms, sim_today, tomorrow_ymd
from bench_env.task.weather.app import Weather
from bench_env.task.wechat.app import Wechat
from bench_env.tests.map.scripted_plans import _PLACE_PICK_PARAMS, route_to_place
from bench_env.tests.tencent_meeting.scripted_plans import (
    HISTORY_TOPICS_2026_02_03,
    HISTORY_TOPICS_2026_02_04,
    HISTORY_TOPICS_DISPLAY_ORDER,
    join_meeting,
    open_history_list,
    open_scheduled_meeting_detail,
    rename_meeting_self,
    scroll_history_list,
    search_history,
    visit_history_details,
)


def click_selector(selector: str, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def click_point(point: list[int], summary: str) -> Step:
    return {"op": "click", "point": point, "summary": summary}


def long_press_point(point: list[int], summary: str, *, duration_ms: int = 900) -> Step:
    return {"op": "long_press", "point": point, "duration_ms": duration_ms, "summary": summary}


def wheel_scroll(
    selector: str,
    current: str,
    target: str,
    modulo: int,
    summary: str,
    *,
    max_delta_per_swipe: int = 1,
    delta_y_fraction: float = 0.134,
    prefer_reverse_half: bool | str = False,
    duration_ms: int | None = None,
) -> Step:
    step: Step = {
        "op": "wheel_scroll",
        "selector": selector,
        "current": current,
        "target": target,
        "modulo": modulo,
        "summary": summary,
        "max_delta_per_swipe": max_delta_per_swipe,
        "delta_y_fraction": delta_y_fraction,
        "prefer_reverse_half": prefer_reverse_half,
    }
    if duration_ms is not None:
        step["duration_ms"] = duration_ms
    step.update(
        {
            "start_y_fraction": 0.68,
            "reverse_start_y_fraction": 0.32,
        }
    )
    return step


def open_app(app: str, *, home_first: bool = True, settle: float = 0.8) -> list[Step]:
    steps: list[Step] = []
    if home_first:
        steps.append(home(summary="return to launcher"))
    steps.append(awake(app, summary=f"launch {app}"))
    if settle > 0:
        steps.append(wait(settle, summary=f"wait for {app} foreground"))
    return steps


def trigger_param(trigger_id: str, key: str, value: str, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{key}":"{value}"\']:visible',
        summary,
    )


def scroll_wechat_contacts_down(summary: str = "scroll WeChat contacts") -> Step:
    return {
        "op": "swipe",
        "selector": '[data-scroll-container="main"][data-scroll-direction="vertical"]:visible',
        "start_fraction": 0.5,
        "end_fraction": 0.5,
        "start_y_fraction": 0.78,
        "end_y_fraction": 0.34,
        "duration_ms": 300,
        "summary": summary,
    }


def open_wechat_chat(contact_wxid: str, *, summary: str = "read chat messages") -> list[Step]:
    """Open a WeChat contact chat just to read its incoming messages."""
    return [
        *open_app("WeChat"),
        back(summary="normalize WeChat to chat list"),
        awake("WeChat", summary="return to WeChat chat list"),
        wait(0.3, summary="wait for WeChat chat list"),
        trigger_param("chat.open", "id", contact_wxid, "open WeChat contact chat"),
        wait(0.6, summary=summary),
    ]


def send_wechat_message(
    content: str,
    *,
    contact_wxid: str = "{contact_wxid}",
    via_contacts: bool = False,
    ensure_root: bool = True,
) -> list[Step]:
    steps = [*open_app("WeChat")]
    if ensure_root:
        steps.extend(
            [
                back(summary="normalize WeChat to chat list"),
                awake("WeChat", summary="return to WeChat chat list"),
                wait(0.3, summary="wait for WeChat chat list"),
            ]
        )
    if via_contacts:
        steps.extend(
            [
                click_selector('[data-trigger="tab.contacts"]:visible', "open WeChat contacts tab"),
                wait(0.4, summary="wait for WeChat contacts"),
                scroll_wechat_contacts_down("scroll to later WeChat contacts"),
                wait(0.2, summary="wait for contacts scroll"),
                trigger_param("userProfile.open", "id", contact_wxid, "open WeChat contact profile"),
                wait(0.4, summary="wait for contact profile"),
            ]
        )
    steps.extend(
        [
            trigger_param("chat.open", "id", contact_wxid, "open WeChat contact chat"),
            wait(0.5, summary="wait for chat"),
            type_text(content, selector="textarea:visible", clear=True, summary="type WeChat message"),
            click_selector("button.bg-app-primary:visible", "send WeChat message"),
            wait(0.5, summary="wait for WeChat send"),
        ]
    )
    return steps


def send_wechat_images(
    *image_names: str,
    contact_wxid: str = "{contact_wxid}",
) -> list[Step]:
    steps = [
        *open_app("WeChat"),
        back(summary="normalize WeChat to chat list"),
        awake("WeChat", summary="return to WeChat chat list"),
        wait(0.3, summary="wait for WeChat chat list"),
        trigger_param("chat.open", "id", contact_wxid, "open WeChat contact chat"),
        wait(0.5, summary="wait for chat"),
        click_selector("xpath=(//textarea/following::button)[1]", "open WeChat chat plus menu"),
        wait(0.3, summary="wait for chat plus menu"),
        trigger_param("chat.mediaPicker.open", "id", contact_wxid, "open WeChat album picker"),
        wait(0.8, summary="wait for WeChat album picker"),
    ]
    for image_name in image_names:
        steps.append(
            click_selector(
                f'xpath=//img[@alt="{image_name}"]/following-sibling::button[1]',
                f"select WeChat album image {image_name}",
            )
        )
    steps.extend(
        [
            click_selector('[data-action="chat.mediaPicker.base.send"]:visible', "send selected WeChat images"),
            wait(0.8, summary="wait for image send"),
        ]
    )
    return steps


def send_wechat_message_and_images(
    content: str,
    *image_names: str,
    contact_wxid: str = "{contact_wxid}",
) -> list[Step]:
    steps = [
        *open_app("WeChat"),
        back(summary="normalize WeChat to chat list"),
        awake("WeChat", summary="return to WeChat chat list"),
        wait(0.3, summary="wait for WeChat chat list"),
        trigger_param("chat.open", "id", contact_wxid, "open WeChat contact chat"),
        wait(0.5, summary="wait for chat"),
        type_text(content, selector="textarea:visible", clear=True, summary="type WeChat message"),
        click_selector("button.bg-app-primary:visible", "send WeChat message"),
        wait(0.5, summary="wait for WeChat send"),
        click_selector("xpath=(//textarea/following::button)[1]", "open WeChat chat plus menu"),
        wait(0.3, summary="wait for chat plus menu"),
        trigger_param("chat.mediaPicker.open", "id", contact_wxid, "open WeChat album picker"),
        wait(0.8, summary="wait for WeChat album picker"),
    ]
    for image_name in image_names:
        steps.append(
            click_selector(
                f'xpath=//img[@alt="{image_name}"]/following-sibling::button[1]',
                f"select WeChat album image {image_name}",
            )
        )
    steps.extend(
        [
            click_selector('[data-action="chat.mediaPicker.base.send"]:visible', "send selected WeChat images"),
        ]
    )
    return steps


def send_sms_message(content: str, *, recipient: str = "{sms_contact}") -> list[Step]:
    return [
        *open_app("短信"),
        back(summary="normalize SMS to conversation list"),
        awake("短信", summary="return to SMS conversation list"),
        wait(0.3, summary="wait for SMS conversation list"),
        click_selector("button.absolute.bottom-6.right-6:visible", "open SMS composer"),
        type_text(recipient, selector="input:visible", clear=True, summary="type SMS recipient"),
        click_selector(f'button:has-text("{recipient}"):visible', "select SMS contact suggestion"),
        type_text(content, selector='input:visible >> nth=1', clear=True, summary="type SMS body"),
        click_selector("button[aria-disabled=false]:visible", "send SMS"),
        wait(0.6, summary="wait for SMS send"),
    ]


def create_note(title: str, content: str) -> list[Step]:
    return [
        *open_app("Notes"),
        click_selector('button[aria-label="新建笔记"]:visible', "create new note"),
        wait(0.4, summary="wait for note editor"),
        type_text(title, selector='input[placeholder="标题"]:visible', clear=True, summary="type note title"),
        type_text(content, selector="textarea:visible", clear=True, summary="type note content"),
        back(summary="leave note editor"),
        wait(0.8, summary="wait for note autosave"),
    ]


def jump_calendar_to_date(date_value: str) -> list[Step]:
    """Open Calendar and jump the month view to ``date_value`` (agenda visible)."""
    return [
        *open_app("日历"),
        click_selector('button[aria-label="更多"]:visible', "open Calendar more menu"),
        wait(0.3, summary="wait for Calendar action sheet"),
        click_selector('button:has-text("日期跳转"):visible', "open date jump"),
        wait(0.4, summary="wait for date jump page"),
        type_text(date_value, selector='input[type="date"]:visible', clear=True, summary="enter target date"),
        click_selector('button:has-text("跳转"):visible', "jump to target date"),
        wait(0.5, summary="wait for Calendar home on target date"),
    ]


def open_calendar_event_form(date_value: str) -> list[Step]:
    return [
        *jump_calendar_to_date(date_value),
        click_selector('button[aria-label="新建"]:visible', "open new event page"),
        wait(0.5, summary="wait for event form"),
    ]


def save_calendar_event() -> Step:
    return click_selector(
        'xpath=(//h1[normalize-space()="创建日程" or normalize-space()="Create Event"]'
        '/preceding::button[contains(@class,"p-2")][1])',
        "save event form",
    )


def set_event_reminder(option_label: str) -> list[Step]:
    return [
        click_selector(
            'xpath=//span[normalize-space()="提醒"]/ancestor::div[contains(@class,"justify-between")][1]//button',
            "open event reminder sheet",
        ),
        wait(0.2, summary="wait for reminder sheet"),
        click_selector(f'button:has-text("{option_label}"):visible', f"choose reminder {option_label}"),
        wait(0.3, summary="wait for reminder sheet to close"),
    ]


def toggle_calendar_alarm() -> Step:
    return click_selector(
        'xpath=//span[normalize-space()="闹钟提醒"]/ancestor::div[contains(@class,"justify-between")][1]//div[contains(@class,"rounded-full")]',
        "enable calendar alarm",
    )


def create_calendar_event(
    date_value: str,
    title: str,
    *,
    start: str = "09:00",
    end: str = "10:00",
    reminder: str | None = None,
    alarm: bool = False,
) -> list[Step]:
    steps = [
        *open_calendar_event_form(date_value),
        type_text(title, selector='input[placeholder="请输入日程标题"]:visible', clear=True, summary="type event title"),
        type_text(start, selector='input[placeholder="09:00"]:visible', clear=True, summary="type event start"),
        enter(summary="commit start time"),
        type_text(end, selector='input[placeholder="10:00"]:visible', clear=True, summary="type event end"),
        enter(summary="commit end time"),
    ]
    if reminder:
        steps.extend(set_event_reminder(reminder))
    if alarm:
        steps.append(toggle_calendar_alarm())
    steps.extend([save_calendar_event(), wait(0.8, summary="wait for calendar event save")])
    return steps


def calendar_month_cell(day_text: str) -> str:
    """Month-grid cell whose date number equals ``day_text`` (e.g. "13").

    数字格文本在当月唯一；showExtendMonth 的邻月格只出现月头/月尾几天，
    与测试运行日（非月界日）不冲突。
    """
    return f'div.cursor-pointer:has(span:text-is("{day_text}")):visible'


def select_calendar_day(day_text: str, *, summary: str) -> list[Step]:
    return [
        click_selector(calendar_month_cell(day_text), f"select day {day_text} on month grid"),
        wait(0.4, summary=summary),
    ]


def open_calendar_agenda_event(title: str, *, summary: str) -> list[Step]:
    """Open an event's detail page from the agenda panel below the month grid."""
    return [
        click_selector(f'button:has-text("{title}"):visible', f"open calendar event {title}"),
        wait(0.4, summary=summary),
    ]


def open_gallery_album(album_name: str) -> list[Step]:
    return [
        *open_app("相册"),
        click_selector('button[aria-label="相册"]:visible', "open Gallery albums tab"),
        wait(0.4, summary="wait for albums grid"),
        click_selector(f'button:has-text("{album_name}"):visible', f"open {album_name} album"),
        wait(0.8, summary="wait for album photo grid"),
    ]


def view_gallery_photos(*names: str) -> list[Step]:
    """Open each photo in the viewer (by grid thumbnail alt), read it, and go back."""
    steps: list[Step] = []
    for name in names:
        steps.extend(
            [
                click_selector(f'img[alt="{name}"]:visible', f"open photo {name}"),
                wait(0.4, summary=f"view photo {name}"),
                back(summary=f"close photo {name}"),
            ]
        )
    return steps


def swipe_gallery_viewer_next(summary: str) -> Step:
    """Swipe left inside the photo viewer to show the next (older) photo."""
    return swipe([750, 500], [250, 500], summary=summary)


def view_gallery_photo_run(first_name: str, *followup_names: str) -> list[Step]:
    """Open ``first_name`` from the grid, then page through ``followup_names`` in the viewer.

    查看器内 allItems 按 createdAt 倒序，左滑 = 下一张（更旧）；调用方需保证
    这些照片在该排序下连续（带日期文件名的照片 createdAt 由文件名推断，确定性成立）。
    """
    steps: list[Step] = [
        click_selector(f'img[alt="{first_name}"]:visible', f"open photo {first_name}"),
        wait(0.5, summary=f"view photo {first_name}"),
    ]
    for name in followup_names:
        steps.append(swipe_gallery_viewer_next(f"swipe to next photo {name}"))
    steps.append(back(summary="leave photo viewer"))
    return steps


def add_default_alarm(*, anchor_wait: str | None = None) -> list[Step]:
    """Create an alarm at the add-sheet default time (sim now at the "+" tap).

    时钟 App 根路由重定向到 /alarm（闹钟页即默认页），无需 tab 步。
    ``anchor_wait`` (a ``{param}``-rendered seconds value) goes right before
    the "+" tap when the caller derives the created alarm's time from the
    initial state — see the minute-anchor note in the module docstring.
    """
    steps = [*open_app("时钟")]
    if anchor_wait is not None:
        steps.append(wait(anchor_wait, summary="align to alarm-draft anchor minute"))
    steps.extend(
        [
            click_selector('xpath=//button[contains(@class,"bottom-[112px]")]', "open add alarm sheet"),
            wait(0.5, summary="wait for add alarm sheet"),
            click_selector('xpath=(//div[contains(@class,"z-40")]//button[contains(@class,"w-10")])[2]', "save alarm sheet"),
            wait(0.6, summary="wait for alarm creation"),
        ]
    )
    return steps


def alarm_list_scroll_down(summary: str = "scroll alarm list down") -> Step:
    return {
        "op": "swipe",
        "selector": "div.h-full.overflow-y-auto.no-scrollbar:visible",
        "start_fraction": 0.5,
        "end_fraction": 0.5,
        "start_y_fraction": 0.78,
        "end_y_fraction": 0.42,
        "duration_ms": 260,
        "summary": summary,
    }


def alarm_time_button(time_text: str) -> str:
    return f'button:visible:has(span:text-is("{time_text}"))'


def newest_alarm_edit_button() -> str:
    """列表第 1 行（saveAlarm 前插 → 最新建闹钟）的编辑按钮。

    按位置寻址而非时间文本：锚定分钟可能与默认闹钟（如 06:00）的时间文本
    撞车，text-is 会解析到错误的行（clock 套件同款结论）。
    """
    return 'xpath=(//div[@data-action="alarm.item.selection.enter"])[1]//button[contains(@class,"text-left")]'


def first_alarm_time_button() -> str:
    return 'button:visible:has(span[class*="text-[26px]"])'


def _clock_wheel_by_label(zh_label: str, en_label: str) -> str:
    return (
        f'xpath=(//span[normalize-space()="{zh_label}" or normalize-space()="{en_label}"]'
        f'/following-sibling::div[contains(@class,"overflow-y-scroll")])[1]'
    )


def set_alarm_time(
    source_time: str,
    target_hour: str,
    target_minute: str,
    *,
    source_hour: str,
    source_minute: str,
    source_selector: str | None = None,
    scroll_to_source: bool = False,
    minute_mid: str | None = None,
) -> list[Step]:
    selector = source_selector or alarm_time_button(source_time)
    # 时钟根路由即闹钟页；调用场景都在 add_default_alarm 之后（已在闹钟页）。
    steps = [*open_app("时钟", home_first=False)]
    if scroll_to_source:
        steps.extend(
            [
                alarm_list_scroll_down(f"scroll to alarm {source_time}"),
                wait(0.2, summary="wait for alarm list scroll"),
            ]
        )
    steps.extend(
        [
            click_selector(selector, f"open alarm {source_time} editor"),
            wait(0.4, summary="wait for quick alarm editor"),
            click_selector('button:has-text("更多设置"):visible', "open full alarm settings"),
            wait(0.5, summary="wait for full alarm editor"),
            # 时钟轮几何采用 clock 套件实测可靠值（duration_ms=0 + 0.17/格）：
            # 旧 0.134/260ms 在 ~30 格行程上系统性多滑 ~3 格（探针复测 0/5 命中，
            # 原 monkeypatch 的 target+3 hack 正是它的漂移补偿器）。
            wheel_scroll(
                _clock_wheel_by_label("时", "H"),
                source_hour,
                target_hour,
                24,
                "set alarm hour",
                delta_y_fraction=0.17,
                duration_ms=0,
            ),
        ]
    )
    # 分钟轮长行程（结构性 ≈30 格）按派生中点拆两段、段间落定，缩短单次
    # 连滑并给 wrap 重排留出恢复点（见 _weather_alarm_calcs._journey 注释）。
    minute_legs = [(source_minute, target_minute)] if minute_mid is None else [
        (source_minute, minute_mid),
        (minute_mid, target_minute),
    ]
    for index, (leg_from, leg_to) in enumerate(minute_legs):
        if index:
            steps.append(wait(0.35, summary="settle between minute wheel legs"))
        steps.append(
            wheel_scroll(
                _clock_wheel_by_label("分", "M"),
                leg_from,
                leg_to,
                60,
                "set alarm minute" if len(minute_legs) == 1 else f"set alarm minute (leg {index + 1}/2)",
                delta_y_fraction=0.17,
                duration_ms=0,
            )
        )
    steps.extend(
        [
            wait(0.4, summary="wait for wheel snap settle"),
            click_selector('xpath=(//div[contains(@class,"z-40")]//button[contains(@class,"w-10")])[2]', "save alarm time"),
            wait(0.6, summary="wait for alarm update"),
        ]
    )
    return steps


def open_tencent_meeting() -> list[Step]:
    return open_app("腾讯会议")


def _schedule_picker_column(index: int) -> str:
    return (
        'xpath=(//div[contains(@class,"fixed") and contains(@class,"z-50")]'
        '//div[contains(@class,"overflow-y-auto") and contains(@class,"no-scrollbar")])'
        f'[{index}]'
    )


def _schedule_picker_confirm() -> Step:
    return click_selector(
        'xpath=(//div[contains(@class,"fixed") and contains(@class,"z-50")]//button)[2]',
        "confirm Tencent Meeting picker",
    )


def set_schedule_start_time() -> list[Step]:
    """Dial the start-time picker from the form's mount-time defaults to the target.

    Current wheel indices come from ``DERIVED_PARAMS`` (minute-anchored form
    defaults — see module docstring); the date target is always index 1
    (tomorrow of the mount day) for this suite's schedule tasks.
    """
    return [
        click_selector(
            'xpath=//span[normalize-space()="开始时间" or normalize-space()="Start time"]'
            '/ancestor::div[contains(@class,"px-4") and contains(@class,"py-4")][1]',
            "open Tencent Meeting start time picker",
        ),
        wait(0.3, summary="wait for start time picker"),
        wheel_scroll(
            _schedule_picker_column(1),
            "{schedule_date_index_current}",
            "1",
            0,
            "set meeting date",
            max_delta_per_swipe=3,
            delta_y_fraction=0.2,
        ),
        wheel_scroll(
            _schedule_picker_column(2),
            "{schedule_hour_current}",
            "{schedule_hour_target}",
            0,
            "set meeting hour",
            max_delta_per_swipe=3,
            delta_y_fraction=0.2,
        ),
        wheel_scroll(
            _schedule_picker_column(3),
            "{schedule_minute_index_current}",
            "{schedule_minute_index_target}",
            0,
            "set meeting minute",
            max_delta_per_swipe=3,
            delta_y_fraction=0.2,
        ),
        _schedule_picker_confirm(),
        wait(0.3, summary="wait for start time update"),
    ]


def set_schedule_duration(duration_minutes: int) -> list[Step]:
    """Dial 会议时长 from the fixed 30-min form default to ``duration_minutes``.

    表单默认时长固定 30 分钟（ScheduleRegularMeetingPage 的 useState(30)），
    即小时轮 index 0、分钟轮 index 6（5 分钟/格）——current/target 都是
    plan 构建期常量，无需派生参数。
    """
    hour_target = str(duration_minutes // 60)
    minute_index_target = str((duration_minutes % 60) // 5)
    return [
        click_selector(
            'xpath=//span[normalize-space()="会议时长" or normalize-space()="Duration"]'
            '/ancestor::div[contains(@class,"px-4") and contains(@class,"py-4")][1]',
            "open Tencent Meeting duration picker",
        ),
        wait(0.3, summary="wait for duration picker"),
        wheel_scroll(
            _schedule_picker_column(1),
            "0",
            hour_target,
            0,
            "set meeting duration hour",
            max_delta_per_swipe=3,
            delta_y_fraction=0.2,
        ),
        wheel_scroll(
            _schedule_picker_column(2),
            "6",
            minute_index_target,
            0,
            "set meeting duration minute",
            max_delta_per_swipe=3,
            delta_y_fraction=0.2,
        ),
        _schedule_picker_confirm(),
        wait(0.3, summary="wait for duration update"),
    ]


def schedule_meeting(
    topic: str,
    *,
    pin: str | None = "123456",
    set_time: bool = False,
    duration_minutes: int | None = None,
) -> list[Step]:
    steps = [
        *open_tencent_meeting(),
        click_selector('[data-trigger="home.schedule.open"]:visible', "open schedule entry"),
    ]
    if set_time:
        # 表单挂载瞬间捕获默认开始时间（滚轮 current 的来源）——挂载前锚定分钟，
        # 保证与 DERIVED_PARAMS 从初始状态推出的 schedule_*_current 一致。
        steps.append(wait("{schedule_anchor_wait}", summary="align to schedule-form anchor minute"))
    steps.extend(
        [
            click_selector('[data-trigger="schedule.regular.open"]:visible', "choose regular meeting"),
            wait(0.4, summary="wait for schedule form"),
            type_text(topic, selector="input:visible", clear=True, summary="enter meeting topic"),
            back(summary="dismiss keyboard after entering meeting topic"),
        ]
    )
    if set_time:
        steps.extend(set_schedule_start_time())
    if duration_minutes is not None:
        steps.extend(set_schedule_duration(duration_minutes))
    if pin is not None:
        steps.extend(
            [
            click_selector(
                'xpath=//span[normalize-space()="入会密码" or normalize-space()="Meeting Password"]'
                '/ancestor::div[contains(@class,"justify-between")][1]//div[contains(@class,"w-11")]',
                "enable meeting password",
            ),
            wait(0.3, summary="wait for password input"),
            type_text(
                pin,
                selector='input[placeholder="请输入4-6位数字密码"]:visible, input[placeholder="Enter 4-6 digit password"]:visible',
                clear=True,
                summary="enter meeting password",
            ),
            back(summary="dismiss keyboard after entering meeting password"),
            ]
        )
    steps.extend(
        [
            click_selector('[data-trigger="schedule.complete"]:visible', "complete scheduled meeting"),
            wait(0.8, summary="wait for meeting detail"),
        ]
    )
    return steps



def _text_literal(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def path_row(path: str) -> str:
    name = _text_literal(path.rsplit("/", 1)[-1])
    return (
        f'[data-trigger-params*=\'"path":"{path}"\']:visible, '
        f'[data-action-params*=\'"path":"{path}"\']:visible, '
        f'button:has-text("{name}"):visible'
    )


def folder_path(path: str) -> str:
    return f'[data-trigger="folder.open"][data-trigger-params*=\'"path":"{path}"\']:visible'


def root_folder_button(name: str) -> str:
    return f'div.px-6.relative button:visible:has(span:text-is("{name}"))'


def scroll_file_manager_main_down(summary: str = "scroll File Manager main list") -> Step:
    return {
        "op": "swipe",
        "selector": '[data-scroll-container="main"][data-scroll-direction="vertical"]:visible',
        "start_fraction": 0.5,
        "end_fraction": 0.5,
        "start_y_fraction": 0.78,
        "end_y_fraction": 0.36,
        "duration_ms": 300,
        "summary": summary,
    }


def open_file_folder(path: str) -> list[Step]:
    parts = [part for part in path.split("/") if part][1:]
    steps = [
        *open_app("文件管理"),
        back(summary="normalize File Manager one level up"),
        back(summary="normalize File Manager to root"),
        back(summary="leave File Manager if already at root"),
        awake("文件管理", summary="return to File Manager root"),
        wait(0.4, summary="wait for File Manager root"),
    ]
    if not parts:
        return steps
    steps.append(scroll_file_manager_main_down("scroll to File Manager storage folders"))
    steps.append(wait(0.2, summary="wait for File Manager storage scroll"))
    steps.append(click_selector(root_folder_button(parts[0]), f"open {parts[0]} folder"))
    steps.append(wait(0.4, summary="wait for folder"))
    current = f"/sdcard/{parts[0]}"
    for part in parts[1:]:
        current = f"{current}/{part}"
        steps.extend(
            [
                click_selector(folder_path(current), f"open {current}"),
                wait(0.4, summary="wait for nested folder"),
            ]
        )
    return steps


def text_file_trigger(path: str) -> str:
    return f'[data-trigger="file.text.open"][data-trigger-params*=\'"path":"{path}"\']:visible'


def open_text_file(path: str, *, read_summary: str | None = None, scrolls: int = 0) -> list[Step]:
    """Open a .txt/.log file in the text preview, optionally scroll through it, then back."""
    name = path.rsplit("/", 1)[-1]
    steps: list[Step] = [
        click_selector(text_file_trigger(path), f"open text file {name}"),
        wait(0.5, summary=read_summary or f"read {name}"),
    ]
    for index in range(scrolls):
        step = scroll_file_manager_main_down(f"scroll {name} ({index + 1}/{scrolls})")
        step["inertia"] = True
        steps.append(step)
    steps.append(back(summary=f"leave {name} preview"))
    return steps


def create_folder(name: str) -> list[Step]:
    return [
        click_selector('button[aria-label="新建文件夹"]:visible', "open new folder dialog"),
        wait(0.3, summary="wait for new folder dialog"),
        type_text(name, selector="input:visible", clear=True, summary="type folder name"),
        back(summary="dismiss keyboard"),
        click_selector('div.fixed.inset-0 button:has-text("创建"):visible', "create folder"),
        wait(0.5, summary="wait for folder creation"),
    ]


def enter_select_mode(first_path: str) -> list[Step]:
    return [
        {"op": "long_press", "selector": path_row(first_path), "duration_ms": 900, "summary": "long-press first file row"},
        wait(0.8, summary="wait for selection mode"),
    ]


def select_rows(*paths: str) -> list[Step]:
    return [click_selector(path_row(path), f"select {path}") for path in paths]


def move_selected_to(target_folder: str) -> list[Step]:
    folder_name = target_folder.rsplit("/", 1)[-1]
    transfer_list = 'div[data-scroll-container="transfer"]'
    return [
        click_selector('div.absolute.bottom-0 button:has-text("移动"):visible', "open move target sheet"),
        wait(0.4, summary="wait for transfer sheet"),
        click_selector(f'{transfer_list} button:has-text("Documents"):visible, {transfer_list} button:has-text("文档"):visible', "open Documents in transfer sheet"),
        wait(0.4, summary="wait for Documents in transfer sheet"),
        click_selector(f'{transfer_list} button:has-text("{folder_name}"):visible', "open target folder in transfer sheet"),
        wait(0.4, summary="wait for target folder in transfer sheet"),
        click_selector('button[aria-label="确定"]:visible', "confirm move target"),
        wait(0.8, summary="wait for file move"),
    ]


def prepare_target_folder(target_folder: str) -> list[Step]:
    parent = target_folder.rsplit("/", 1)[0]
    name = target_folder.rsplit("/", 1)[-1]
    return [
        *open_file_folder(parent),
        *create_folder(name),
    ]


def move_files(source_dir: str, target_dir: str, *source_paths: str) -> list[Step]:
    if not source_paths:
        return []
    return [
        *prepare_target_folder(target_dir),
        *move_files_to_existing(source_dir, target_dir, *source_paths),
    ]


def move_files_to_existing(
    source_dir: str,
    target_dir: str,
    *source_paths: str,
    pre_select_scrolls: int = 0,
) -> list[Step]:
    if not source_paths:
        return []
    steps = [*open_file_folder(source_dir)]
    for index in range(pre_select_scrolls):
        steps.extend(
            [
                scroll_file_manager_main_down(f"scroll source folder to target files {index + 1}/{pre_select_scrolls}"),
                wait(0.2, summary="wait for source folder scroll"),
            ]
        )
    steps.extend(
        [
            *enter_select_mode(source_paths[0]),
            *select_rows(*source_paths[1:]),
            *move_selected_to(target_dir),
        ]
    )
    return steps


def select_current_files_to_existing(
    target_dir: str,
    *source_paths: str,
    pre_select_scrolls: int = 0,
) -> list[Step]:
    if not source_paths:
        return []
    steps: list[Step] = []
    for index in range(pre_select_scrolls):
        steps.extend(
            [
                scroll_file_manager_main_down(f"scroll source folder to target files {index + 1}/{pre_select_scrolls}"),
                wait(0.2, summary="wait for source folder scroll"),
            ]
        )
    steps.extend(
        [
            *enter_select_mode(source_paths[0]),
            *select_rows(*source_paths[1:]),
            *move_selected_to(target_dir),
        ]
    )
    return steps


def open_camera_from_current_documents() -> list[Step]:
    return [
        click_selector(
            'button:visible:has-text("内部存储设备"), button:visible:has-text("Internal storage")',
            "return to internal storage breadcrumb",
        ),
        wait(0.3, summary="wait for internal storage folder"),
        click_selector(folder_path("/sdcard/DCIM"), "open DCIM folder"),
        wait(0.4, summary="wait for folder"),
        click_selector(folder_path("/sdcard/DCIM/Camera"), "open /sdcard/DCIM/Camera"),
        wait(0.4, summary="wait for nested folder"),
    ]


def documents_breadcrumb() -> Step:
    return click_selector('button:visible:has-text("Documents")', "return to Documents breadcrumb")


def move_current_folder_file_to_existing(target_dir: str, source_path: str) -> list[Step]:
    return [
        *enter_select_mode(source_path),
        *move_selected_to(target_dir),
    ]


def move_pdf_reports_to_final_folder() -> list[Step]:
    target_dir = "/sdcard/Documents/final_reports"
    return [
        *prepare_target_folder(target_dir),
        click_selector(folder_path("/sdcard/Documents/客户资料"), "open /sdcard/Documents/客户资料"),
        wait(0.4, summary="wait for nested folder"),
        *move_current_folder_file_to_existing(target_dir, "/sdcard/Documents/客户资料/项目进展报告.pdf"),
        documents_breadcrumb(),
        wait(0.3, summary="wait for Documents folder"),
        click_selector(folder_path("/sdcard/Documents/验收材料"), "open /sdcard/Documents/验收材料"),
        wait(0.4, summary="wait for nested folder"),
        *move_current_folder_file_to_existing(target_dir, "/sdcard/Documents/验收材料/验收报告.pdf"),
        documents_breadcrumb(),
        wait(0.3, summary="wait for Documents folder"),
        click_selector(folder_path("/sdcard/Documents/研发归档"), "open /sdcard/Documents/研发归档"),
        wait(0.4, summary="wait for nested folder"),
        *move_current_folder_file_to_existing(target_dir, "/sdcard/Documents/研发归档/阶段总结报告.pdf"),
        click_selector(folder_path("/sdcard/Documents/研发归档/二期"), "open /sdcard/Documents/研发归档/二期"),
        wait(0.4, summary="wait for nested folder"),
        *move_current_folder_file_to_existing(target_dir, "/sdcard/Documents/研发归档/二期/测试报告.pdf"),
    ]


def move_camera_reimbursement_files() -> list[Step]:
    return [
        *prepare_target_folder("/sdcard/Documents/reimburse_photos"),
        *open_camera_from_current_documents(),
        *select_current_files_to_existing(
            "/sdcard/Documents/reimburse_photos",
            "/sdcard/DCIM/Camera/IMG_20260417_184226.jpg",
            "/sdcard/DCIM/Camera/IMG_20260418_093000.jpg",
            pre_select_scrolls=2,
        ),
    ]


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Judge-homologous accessors: calculators build the same domain classes over
# the same post-setup initial state the judges receive as ``apps_init`` /
# ``os_init``.

# MeetingMultiChannelNotify 不参数化会议主题；plan 与会议号预测共用同一常量。
_MULTICHANNEL_TOPIC = "快速会议"


def _tm_state(state: dict[str, Any]) -> TencentMeeting:
    return TencentMeeting(state["apps"]["tencent_meeting"])


def _wechat_state(state: dict[str, Any]) -> Wechat:
    return Wechat(state["apps"]["wechat"])


def _wxid_of(name_of: Callable[[Any, dict[str, Any]], str]) -> Callable[[Any, dict[str, Any]], str]:
    """联系人名 → wxid 的派生器工厂（同 judge 按名称解析联系人）。"""

    def calc(task: Any, state: dict[str, Any]) -> str:
        return _wechat_state(state).require_contact_wxid(name_of(task, state))

    return calc


_boss_wxid = _wxid_of(lambda task, state: "Boss")
_contact_wxid = _wxid_of(lambda task, state: str(task.p.contact))


def _time_after(time_text: str, minutes: int) -> str:
    hour, minute = Calendar.parse_hh_mm(time_text)
    value = datetime.datetime(2000, 1, 1, hour, minute) + datetime.timedelta(minutes=minutes)
    return value.strftime("%H:%M")


def _tomorrow(task: Any, state: dict[str, Any]) -> str:
    return tomorrow_ymd(state["os"])


def _day_of_month(offset_days: int) -> Callable[[Any, dict[str, Any]], str]:
    """月视图日期格的"几号"文本（sim-today ± offset 天）。"""

    def calc(task: Any, state: dict[str, Any]) -> str:
        return str((sim_today(state["os"]) + datetime.timedelta(days=offset_days)).day)

    return calc


# ── Minute anchor（时间敏感滚轮的等待+起点派生，模式同 clock 套件）──
#
# 派生计算发生在首帧 act()，而滚轮 current 取决于之后某一步（排程表单挂载 /
# 时钟"+"点击）时刻的模拟时间。若该时刻距分钟边界太近，中间的步数会让分钟
# 跨界、current 失准。锚定策略：秒数 ≤40 时只等 0.7s（余量 ≥17s 覆盖前置
# 步骤耗时，且尽量保持"锚定分钟==建店分钟"以避开分钟轮 wrap 穿越，见下）；
# 否则等到下一分钟边界后 ~2s，用锚定后的分钟推导 current。

_ANCHOR_THRESHOLD_S = 40.0
_ANCHOR_LAND_S = 2.0


def _minute_anchor(state: dict[str, Any]) -> tuple[float, datetime.datetime]:
    """返回 (锚定等待秒数, 锚定后的模拟时刻)。宿主时区 == 模拟显示时区。"""
    ts_ms = now_ms(state["os"])
    sec = (ts_ms / 1000.0) % 60.0
    now = datetime.datetime.fromtimestamp(ts_ms / 1000.0)
    if sec <= _ANCHOR_THRESHOLD_S:
        return 0.7, now
    landed = now.replace(second=0, microsecond=0) + datetime.timedelta(minutes=1)
    return (60.0 - sec) + _ANCHOR_LAND_S, landed


def _default_schedule_start(anchored: datetime.datetime) -> datetime.datetime:
    """镜像 ScheduleRegularMeetingPage 挂载时的默认开始时间：ceil((分+30)/5)*5。"""
    rounded_minutes = ((anchored.minute + 30 + 4) // 5) * 5
    base = anchored.replace(second=0, microsecond=0)
    return base + datetime.timedelta(minutes=rounded_minutes - anchored.minute)


def _schedule_wheel_calcs(time_of: Callable[[Any], str]) -> dict[str, Callable[[Any, dict[str, Any]], Any]]:
    """开始时间三列滚轮的派生器：锚定等待 + current（表单默认）+ target（任务时刻）。

    current 列语义（与表单挂载时的三列 index 一致）：日期列 index 0 = 挂载日
    当天；小时列 index = 小时；分钟列 index = 分钟/5（默认值已是 5 的倍数）。
    """

    def anchor_wait(task: Any, state: dict[str, Any]) -> float:
        return round(_minute_anchor(state)[0], 1)

    def date_index_current(task: Any, state: dict[str, Any]) -> str:
        _, anchored = _minute_anchor(state)
        return str((_default_schedule_start(anchored).date() - anchored.date()).days)

    def hour_current(task: Any, state: dict[str, Any]) -> str:
        return str(_default_schedule_start(_minute_anchor(state)[1]).hour)

    def minute_index_current(task: Any, state: dict[str, Any]) -> str:
        return str(_default_schedule_start(_minute_anchor(state)[1]).minute // 5)

    def hour_target(task: Any, state: dict[str, Any]) -> str:
        return str(Calendar.parse_hh_mm(time_of(task))[0])

    def minute_index_target(task: Any, state: dict[str, Any]) -> str:
        return str(Calendar.parse_hh_mm(time_of(task))[1] // 5)

    return {
        "schedule_anchor_wait": anchor_wait,
        "schedule_date_index_current": date_index_current,
        "schedule_hour_current": hour_current,
        "schedule_minute_index_current": minute_index_current,
        "schedule_hour_target": hour_target,
        "schedule_minute_index_target": minute_index_target,
    }


# 注：原 monkeypatch 对"分钟轮 Δ 恰为半圈（30）"有一个 target+3 的规避 hack，
# 会把闹钟设到偏 3 分钟的位置——check_created_alarm 是精确匹配，命中该护栏
# 必然判分失败（live 复现：源 05:38 → 目标 08:08，Δ=30 → 设成 08:11 被拒）。
# 迁移时移除：wheel_scroll 宏的 prefer_reverse_half 已确定性消解半圈方向歧义
# （Δ=30 时反向 30 格，精确落在目标上）。


def _meeting_alarm_dt(task: Any, state: dict[str, Any]) -> datetime.datetime:
    """{topic} 会议开始前 30 分钟——镜像 WeatherConditionalCancelMeeting 干燥分支判定。"""
    meeting = _tm_state(state).find_scheduled_meeting(str(task.p.topic))
    start_ms = TencentMeeting.meeting_start_timestamp_ms(meeting)
    return datetime.datetime.fromtimestamp(start_ms / 1000.0) - datetime.timedelta(minutes=30)


def _weather_alarm_calcs() -> dict[str, Callable[[Any, dict[str, Any]], Any]]:
    """WeatherConditionalCancelMeeting 干燥分支的闹钟派生器。

    新闹钟草稿 = "+"点击时刻的模拟 HH:MM（锚定后与 alarm_source_* 一致）；
    随后按 source→target 拨轮。target 分钟带半圈护栏（见上）。
    """

    def anchor_wait(task: Any, state: dict[str, Any]) -> float:
        return round(_minute_anchor(state)[0], 1)

    def source_time(task: Any, state: dict[str, Any]) -> str:
        return _minute_anchor(state)[1].strftime("%H:%M")

    def source_hour(task: Any, state: dict[str, Any]) -> str:
        return str(_minute_anchor(state)[1].hour)

    def source_minute(task: Any, state: dict[str, Any]) -> str:
        return str(_minute_anchor(state)[1].minute)

    def alarm_hour(task: Any, state: dict[str, Any]) -> str:
        return str(_meeting_alarm_dt(task, state).hour)

    def alarm_minute(task: Any, state: dict[str, Any]) -> str:
        return str(_meeting_alarm_dt(task, state).minute)

    def _journey(task: Any, state: dict[str, Any]) -> tuple[int, int, int]:
        """(源分钟, 中点分钟, 目标分钟)。

        会议 = 建店时刻 + 3h（分钟保留）→ 分钟轮 Δ 结构性 ≈ 半圈（30）。
        长连滑存在偶发 1 格失格（WheelColumn wrap 重排/滑动竞态，实测穿
        wrap 反向 2/10 漂移、不穿正向 0/10）——两道防线：
        (a) 方向选不穿 00 wrap 的一侧：源分钟 <30 正向（+30 不越 59），
            ≥30 反向（-30 不越 0）；
        (b) 行程按中点拆半（两段 ≤15 格，段间落定等待），缩短单次连滑。
        中点取值同时编码方向：每段的 (current→target) 短路径即所选方向。
        """
        source = _minute_anchor(state)[1].minute
        target = _meeting_alarm_dt(task, state).minute
        delta = (target - source) % 60
        # delta 30：<30 的源正向不越界，≥30 的源反向不越界；
        # 其余 delta（跨分钟锚定角落 29）：沿宏的短路径方向取中点。
        forward = source < 30 if delta == 30 else delta < 30
        half = (delta if forward else 60 - delta) // 2
        mid = (source + half) % 60 if forward else (source - half) % 60
        return source, mid, target

    def alarm_mid_minute(task: Any, state: dict[str, Any]) -> str:
        return str(_journey(task, state)[1])

    return {
        "alarm_anchor_wait": anchor_wait,
        "alarm_source_time": source_time,
        "alarm_source_hour": source_hour,
        "alarm_source_minute": source_minute,
        "alarm_hour": alarm_hour,
        "alarm_minute": alarm_minute,
        "alarm_mid_minute": alarm_mid_minute,
    }


def _earliest_tomorrow_alarm_dt(state: dict[str, Any]) -> datetime.datetime:
    """明日最早日程开始前 30 分钟——镜像 CalendarEarliestToAlarm 判定。"""
    tomorrow = sim_today(state["os"]) + datetime.timedelta(days=1)
    first = Calendar(state["apps"]["calendar"]).first_event_on_date(tomorrow)
    start_ts = Calendar.coerce_ts(first["startTs"], tomorrow)
    if start_ts is None:
        raise ValueError("明日最早日程缺少 startTs")
    return datetime.datetime.fromtimestamp(start_ts / 1000.0) - datetime.timedelta(minutes=30)


def _cal_alarm_hour(task: Any, state: dict[str, Any]) -> str:
    return str(_earliest_tomorrow_alarm_dt(state).hour)


def _cal_alarm_minute(task: Any, state: dict[str, Any]) -> str:
    return str(_earliest_tomorrow_alarm_dt(state).minute)


# ── 整句消息 / 笔记内容派生器（各自镜像任务 check_goals 的期望值）──

def _scheduled_meeting_times(task: Any, state: dict[str, Any]) -> dict[str, str]:
    meeting = _tm_state(state).find_scheduled_meeting(str(task.p.topic))
    start = datetime.datetime.fromtimestamp(TencentMeeting.meeting_start_timestamp_ms(meeting) / 1000.0)
    end = start + datetime.timedelta(minutes=int(meeting.get("duration", 60)))
    return {"date": start.date().isoformat(), "start": start.strftime("%H:%M"), "end": end.strftime("%H:%M")}


def _longest_on_date_message(task: Any, state: dict[str, Any]) -> str:
    longest = _tm_state(state).longest_history_meeting_on_date(str(task.p.date))
    return f"{longest['meetingId']} {longest['title']}"


def _duration_on_date_message(task: Any, state: dict[str, Any]) -> str:
    total = _tm_state(state).total_participation_minutes_on_date(str(task.p.date))
    return TencentMeeting.format_duration_minutes_zh(total)


def _route_eta_message(task: Any, state: dict[str, Any]) -> str:
    meeting = _tm_state(state).first_upcoming_scheduled(now_ms(state["os"]))
    duration = str(Map.geo_route_to(str(task.p.place), "WALKING")["duration"])
    return f"{duration} {meeting['title']} {TencentMeeting.meeting_start_hh_mm(meeting)}"


def _upcoming_note_content(task: Any, state: dict[str, Any]) -> str:
    tm = _tm_state(state)
    meetings, _kind = tm.upcoming_or_ongoing()
    return "\n".join(
        f"{meeting['title']} {tm.parse_meeting_time(meeting['startTime']).strftime('%H:%M')}"
        for meeting in meetings
    )


def _longest_planned_message(task: Any, state: dict[str, Any]) -> str:
    tm = _tm_state(state)
    longest = tm.longest_history_meeting()
    return f"{longest['title']} {tm.meeting_host_name(longest)}"


def _keyword_participation_note(task: Any, state: dict[str, Any]) -> str:
    tm = _tm_state(state)
    count = tm.count_history_meetings_with_keyword(str(task.p.keyword))
    longest = tm.history_meeting_with_max_participation(str(task.p.keyword))
    return f"{count} {longest['title']}"


def _predicted_meeting_message(topic_of: Callable[[Any], str], template: str) -> Callable[[Any, dict[str, Any]], str]:
    """新会议号由主题确定性派生（App 端 generateMeetingId 同款算法），创建前可预测。"""

    def calc(task: Any, state: dict[str, Any]) -> str:
        topic = topic_of(task)
        return template.format(topic=topic, meeting_id=TencentMeeting.predicted_meeting_id(topic))

    return calc


def _log_error_count_message(task: Any, state: dict[str, Any]) -> str:
    return f"当前日志错误 {task.expected_error_count_for_os(state['os'])} 个"


def _work_order_message(task: Any, state: dict[str, Any]) -> str:
    return (
        f"未闭环工单共{task.target_count}个，拍过照{task.photographed_count}个："
        f"{' '.join(task.target_work_order_ids)}"
    )


def _inspector_wxid(task: Any, state: dict[str, Any]) -> str:
    return _wechat_state(state).require_contact_wxid(task.inspector_for_os(state["os"]))


def _organized_files_message(attr: str, suffix: str) -> Callable[[Any, dict[str, Any]], str]:
    """文件整理类汇报消息：任务类属性里的固定文件名清单 + 结语。"""

    def calc(task: Any, state: dict[str, Any]) -> str:
        return f"{' '.join(getattr(task, attr))} {suffix}"

    return calc


def _reimbursement_message(task: Any, state: dict[str, Any]) -> str:
    return f"报销照片已整理，合计{task.target_total:.2f}"


# ---------------------------------------------------------------------------
# Branch picks + arm builders
# ---------------------------------------------------------------------------

# ── 微信路径两臂（chat / contacts）──
#
# 聊天列表只渲染已有会话线程的联系人（默认数据仅 blank./张伟/王芳/Boss 四人），
# 采样出的其余联系人走 chat.open 会选择器超时。无会话联系人改走通讯录路径
# （tab.contacts → 单次滚动 → userProfile.open → 发消息）。布局事实（实测）：
# 通讯录 12 人按字母分组，单次滚动后第 2-11 行全部可点，第 0-1 行（blank./
# Boss）滚出屏——而这两位恰好都有会话线程，永远走 chat 臂，两臂恰好全覆盖。

def _wechat_path_pick(contact_param: str) -> Callable[[Any, dict[str, Any]], str]:
    def pick(task: Any, state: dict[str, Any]) -> str:
        name = str(getattr(task.p, contact_param))
        return "chat" if _wechat_state(state).get_chat_with(name) else "contacts"

    return pick


def _wechat_path_branch(
    build: Callable[[bool], list[Step]], *, contact_param: str = "contact"
) -> Branch:
    """两臂 Branch：build(via_contacts) 生成完整 plan（唯一差异是微信入口路径）。"""
    return Branch(
        pick=_wechat_path_pick(contact_param),
        branches={"chat": build(False), "contacts": build(True)},
    )


def _history_date_arm(date_label: str, topics: tuple[str, ...], via_contacts: bool) -> list[Step]:
    """按日期分组逐场进详情读信息，再微信汇报（分组成员随 defaults.json 固定）。"""
    return [
        *open_history_list(),
        *scroll_history_list(2, summary=f"locate the {date_label} group"),
        *visit_history_details(*topics),
        *send_wechat_message("{wechat_message}", via_contacts=via_contacts),
        complete(),
    ]


def _history_date_branch() -> Branch:
    """{date} 枚举 × 微信路径 的四臂组合。"""
    date_pick = _wechat_path_pick("contact")

    def pick(task: Any, state: dict[str, Any]) -> str:
        return f"{task.p.date}|{date_pick(task, state)}"

    topics_by_date = {
        "2026-02-03": HISTORY_TOPICS_2026_02_03,
        "2026-02-04": HISTORY_TOPICS_2026_02_04,
    }
    return Branch(
        pick=pick,
        branches={
            f"{date}|{path}": _history_date_arm(date, topics, path == "contacts")
            for date, topics in topics_by_date.items()
            for path in ("chat", "contacts")
        },
    )


def _conflict_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 FullMeetingConflictCheckBroadcast.check_goals 的冲突判定（初始日历态），
    并叠加微信路径臂（{contact} 是否已有会话）。"""
    tomorrow = sim_today(state["os"]) + datetime.timedelta(days=1)
    hour, minute = Calendar.parse_hh_mm(str(task.p.time))
    blocked = Calendar(state["apps"]["calendar"]).event_blocks_slot_on_date(tomorrow, hour, minute)
    return f"{'busy' if blocked else 'free'}|{_wechat_path_pick('contact')(task, state)}"


def _rain_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 WeatherConditionalCancelMeeting.check_goals 的下雨判定（天气库随 episode 静态）。"""
    return "rain" if Weather(state["apps"]["weather"]).tomorrow_is_rainy(str(task.p.city)) else "dry"


def cancel_scheduled_meeting(topic: str) -> list[Step]:
    """从首页会议卡进详情，经右上角操作弹窗取消该预约会议（无二次确认）。"""
    return [
        *open_scheduled_meeting_detail(topic),
        click_selector('[data-trigger="meeting.detail.actions.open"]:visible', "open meeting actions sheet"),
        wait(0.3, summary="wait for meeting actions sheet"),
        click_selector('button.text-red-500:has-text("取消会议"):visible', "cancel the scheduled meeting"),
        wait(0.6, summary="wait for meeting cancellation"),
    ]


PLANS: dict[str, list[Step] | Branch] = {
    "crossapp_work.ExistingMeetingToCalendar": [
        *open_tencent_meeting(),
        *create_calendar_event("{date}", "{topic}", start="{start}", end="{end}"),
        complete(),
    ],
    "crossapp_work.CalendarEarliestToAlarm": [
        # 月视图点明天的日期格，日程面板即显示最早日程（_prepare 固定注入
        # "临时早会A 09:30"）；闹钟目标 = 该日程 -30 分钟（判分同源派生）。
        # 源闹钟为默认数据固定的 07:00 项（时 7 / 分 0），无需锚定。
        *open_app("日历"),
        *select_calendar_day("{tomorrow_day}", summary="read tomorrow's earliest event in agenda"),
        *add_default_alarm(),
        *set_alarm_time(
            "07:00",
            "{cal_alarm_hour}",
            "{cal_alarm_minute}",
            source_hour="7",
            source_minute="0",
            scroll_to_source=True,
        ),
        complete(),
    ],
    # {date} 枚举（2026-02-03 / 2026-02-04）选择要走的历史分组；该分组逐场进
    # 详情读时间段（时长=结束-开始），汇报消息按 {date} 判分同源派生。
    "crossapp_work.MeetingLongestInfoToWechat": _history_date_branch(),
    # 同上，但读的是"参会时长"并求和。
    "crossapp_work.MeetingDurationToWechat": _history_date_branch(),
    "crossapp_work.WeatherConditionalCancelMeeting": Branch(
        pick=_rain_pick,
        branches={
            # 不下雨：保留会议并设"会前 30 分钟"闹钟（源=锚定分钟的新闹钟草稿）。
            "dry": [
                *open_app("天气"),
                *open_tencent_meeting(),
                *add_default_alarm(anchor_wait="{alarm_anchor_wait}"),
                *set_alarm_time(
                    "{alarm_source_time}",
                    "{alarm_hour}",
                    "{alarm_minute}",
                    source_hour="{alarm_source_hour}",
                    source_minute="{alarm_source_minute}",
                    # 判分要求"新增"闹钟精确命中 → 必须改到刚建的草稿行；
                    # 按位置寻址（第 1 行），时间文本会与默认 06:00 等撞车。
                    source_selector=newest_alarm_edit_button(),
                    # 结构性 ≈30 格行程拆两段（方向沿不穿 wrap 路径，中点派生）。
                    minute_mid="{alarm_mid_minute}",
                ),
                complete(),
            ],
            # 下雨：取消 {topic} 会议即止——正确轨迹不打开时钟（不设闹钟），
            # R3 覆盖不适用，见 LINT_EXEMPT。
            "rain": [
                *open_app("天气"),
                *cancel_scheduled_meeting("{topic}"),
                complete(),
            ],
        },
    ),
    "crossapp_work.MeetingJoinAndNotifySms": [
        *open_tencent_meeting(),
        *join_meeting("{meeting_id}"),
        *rename_meeting_self("{name}"),
        # 判分只要求短信含"入会"字样——固定文案。
        *send_sms_message("我已入会", recipient="{contact}"),
        complete(),
    ],
    # 任务不参数化主题；会议号消息由同一常量主题判分同源预测。
    # {contact1} 采样自全部微信联系人 → 微信路径两臂。
    "crossapp_work.MeetingMultiChannelNotify": _wechat_path_branch(
        lambda via: [
            *schedule_meeting(_MULTICHANNEL_TOPIC),
            *send_wechat_message("{wechat_message}", contact_wxid="{contact1_wxid}", via_contacts=via),
            *send_sms_message("{sms_message}", recipient="{contact2}"),
            complete(),
        ],
        contact_param="contact1",
    ),
    "crossapp_work.MeetingRouteEtaToWechat": _wechat_path_branch(
        lambda via: [
            *open_tencent_meeting(),
            # 目的地选点词/预测行占位符由 map 套件的验证三元组表按 {place} 派生。
            *route_to_place(mode="walking"),
            *send_wechat_message("{wechat_message}", via_contacts=via),
            complete(),
        ]
    ),
    # {topic} 派生自任务类属性 title_meeting（"项目周会"）；密码不判分，固定文案。
    "crossapp_work.MeetingFullFlowToWechat": _wechat_path_branch(
        lambda via: [
            *schedule_meeting("{topic}", pin="123456", set_time=True),
            *create_calendar_event("{tomorrow}", "{topic}", start="{time}", end="{end_time}", reminder="提前15分钟", alarm=True),
            *send_wechat_message("{wechat_message}", via_contacts=via),
            complete(),
        ]
    ),
    "crossapp_work.FullMeetingConflictCheckBroadcast": Branch(
        pick=_conflict_pick,
        branches={
            # 明天 {time} 空闲：完整预约 + 日历（提前15分钟提醒+闹钟）+ 微信 + 短信。
            # 短信走新建会话（composer）路径——{contact2} 为采样枚举联系人，
            # 不保证已有会话，不能用回复流。
            **{
                f"free|{path}": [
                    *schedule_meeting("{flow_topic}", pin=None, set_time=True),
                    *create_calendar_event("{tomorrow}", "{flow_topic}", start="{time}", end="{end_time}", reminder="提前15分钟", alarm=True),
                    *send_wechat_message("{wechat_message}", ensure_root=False, via_contacts=path == "contacts"),
                    *send_sms_message("{sms_message}", recipient="{contact2}"),
                    complete(),
                ]
                for path in ("chat", "contacts")
            },
            # 已有安排：日历跳明天核实冲突 → 微信告知不可（判分查"不行/冲突/
            # 排不开"字样，并要求会议/日历/短信零新增）——正确轨迹不打开
            # 腾讯会议与短信，R3 覆盖不适用，见 LINT_EXEMPT。
            **{
                f"busy|{path}": [
                    *jump_calendar_to_date("{tomorrow}"),
                    *send_wechat_message("明天{time}不行，有冲突", via_contacts=path == "contacts"),
                    complete(),
                ]
                for path in ("chat", "contacts")
            },
        },
    ),
    "crossapp_work.MeetingReminderToNotes": [
        *open_tencent_meeting(),
        *create_note("会议提醒", "{note_content}"),
        complete(),
    ],
    "crossapp_work.SmsAndCalendarOnDate": [
        *send_sms_message("{message}", recipient="{contact}"),
        *create_calendar_event("{tomorrow}", "{event_title}"),
        complete(),
    ],
    "crossapp_work.TencentMeetingLongestPlannedToWechat": _wechat_path_branch(
        lambda via: [
            # 预定时长只在详情页时间行可见：通览列表后 13 场逐场进详情比较（搜索式行定位压步数）。
            *open_history_list(),
            *scroll_history_list(2, summary="survey history list"),
            *visit_history_details(*HISTORY_TOPICS_DISPLAY_ORDER),
            *send_wechat_message("{wechat_message}", via_contacts=via),
            complete(),
        ]
    ),
    "crossapp_work.TencentMeetingKeywordLongestParticipationToNotes": [
        # 先搜索 {keyword} 看匹配数量（6 场），再逐场进详情读"参会时长"比较。
        *open_history_list(),
        search_history("{keyword}"),
        wait(0.4, summary="count keyword-matching meetings"),
        *visit_history_details(
            "小明的快速会议",
            "老王的快速会议",
            "张三的快速会议",
            "李四的快速会议",
            "王五的快速会议",
            "孙七的快速会议",
        ),
        *create_note("参会统计", "{note_content}"),
        complete(),
    ],
    "crossapp_work.ScheduleReleaseMeetingAndNotifyViaNotesWechatSms": _wechat_path_branch(
        lambda via: [
            # 主题/时刻/密码/时长均为判分硬编码值（版本发布会、明日 09:00、123456、15 分钟）。
            *schedule_meeting("版本发布会", pin="123456", set_time=True, duration_minutes=15),
            *create_note("发布会议", "{note_content}"),
            *send_wechat_message("{wechat_message}", via_contacts=via),
            *send_sms_message("{sms_message}", recipient="{sms_contact}"),
            complete(),
        ]
    ),
    "crossapp_work.CountCurrentLogErrorsToWechat": [
        # 当前日志 = 排障包下 5 个 .log（archive/ 为上月归档、README/error_codes 非日志，无需打开）。
        *open_file_folder("/sdcard/Download/排障包"),
        *open_text_file("/sdcard/Download/排障包/app.log", read_summary="count ERROR lines in app.log"),
        *open_text_file("/sdcard/Download/排障包/network.log", read_summary="count ERROR lines in network.log"),
        click_selector(folder_path("/sdcard/Download/排障包/system"), "open system logs folder"),
        wait(0.4, summary="wait for system folder"),
        *open_text_file("/sdcard/Download/排障包/system/boot.log", read_summary="count ERROR lines in boot.log"),
        *open_text_file("/sdcard/Download/排障包/system/auth.log", read_summary="count ERROR lines in auth.log"),
        *open_text_file("/sdcard/Download/排障包/system/debug.log", read_summary="count ERROR lines in debug.log"),
        *send_wechat_message("{wechat_message}", contact_wxid="{boss_wxid}"),
        complete(),
    ],
    "crossapp_work.CountOpenWorkOrdersFromPhotosToWechat": [
        # 先看陈静的口径消息，再到相册-相机逐张查看 6 张工单表照片，最后回复统计结果。
        *open_wechat_chat("{chenjing_wxid}", summary="read 陈静's counting criteria message"),
        *open_gallery_album("相机"),
        *view_gallery_photos(
            "IMG_8041.jpg",
            "IMG_8042.jpg",
            "IMG_8043.jpg",
            "IMG_8044.jpg",
            "IMG_8045.jpg",
            "IMG_8046.jpg",
        ),
        *send_wechat_message("{wechat_message}", contact_wxid="{chenjing_wxid}"),
        complete(),
    ],
    "crossapp_work.InspectionReportToWechat": [
        # 巡检记录.txt 中昨天记录段在文件末尾（前面是 14 天历史），惯性滚动翻到；值班表看今日巡检人。
        # 昨日未处理异常固定为 NET-04 端口丢包 / DB-11 备份延迟（seed 数据与
        # check_goals 字面量同源）；巡检人按模拟日期星期派生。
        *open_file_folder("/sdcard/Download/巡检记录"),
        *open_text_file(
            "/sdcard/Download/巡检记录/巡检记录.txt",
            read_summary="read yesterday's inspection records",
            scrolls=4,
        ),
        *open_text_file("/sdcard/Download/巡检记录/值班表.txt", read_summary="read today's inspector on roster"),
        *send_wechat_message("NET-04 端口丢包；DB-11 备份延迟", contact_wxid="{boss_wxid}"),
        *send_wechat_message("NET-04 端口丢包；DB-11 备份延迟", contact_wxid="{inspector_wxid}", via_contacts=True),
        complete(),
    ],
    "crossapp_work.OrganizePdfReportsToWechat": [
        *move_pdf_reports_to_final_folder(),
        *send_wechat_message("{wechat_message}", contact_wxid="{boss_wxid}"),
        complete(),
    ],
    "crossapp_work.SubmitRequestedAttachmentsToBoss": [
        # 文件清单 = 任务 seed 固定数据（move_map 同源）；汇报消息按 target_files 派生。
        *move_files(
            "/sdcard/Download/待提交",
            "/sdcard/Documents/submission",
            "/sdcard/Download/待提交/供应商盖章确认.pdf",
            "/sdcard/Download/待提交/流水截图_A.png",
        ),
        *send_wechat_message("{wechat_message}", contact_wxid="{boss_wxid}"),
        complete(),
    ],
    "crossapp_work.OrganizeMeetingMaterialsToWechat": [
        # 日历点昨天：日程面板同时显示"支付回调复盘会"（描述指向老板要资料）和"客服排班同步"
        # （描述指向陈静，干扰项），逐个进详情读描述后再整理文件。
        # 文件清单 = 任务 seed 固定数据（move_map 同源）；汇报消息按 target_files 派生。
        *open_app("日历"),
        *select_calendar_day("{yesterday_day}", summary="read yesterday's meetings in agenda"),
        *open_calendar_agenda_event("支付回调复盘会", summary="read description: materials owed to boss"),
        back(summary="back to calendar agenda"),
        *open_calendar_agenda_event("客服排班同步", summary="confirm this one is for 陈静, not boss"),
        *move_files(
            "/sdcard/Download/会议资料",
            "/sdcard/Documents/meeting_pack",
            "/sdcard/Download/会议资料/会议附件_03.xlsx",
            "/sdcard/Download/会议资料/会议附件_04.png",
            "/sdcard/Download/会议资料/会议附件_05.txt",
        ),
        *send_wechat_message("{wechat_message}", contact_wxid="{boss_wxid}"),
        complete(),
    ],
    "crossapp_work.OrganizeReimbursementPhotosToWechat": [
        # 相册-相机逐张核对 6 张候选照片（4/17-4/23，按拍摄时间倒序连续，左滑翻页），
        # 识别出吃饭（IMG_20260417_184226）和打车（IMG_20260418_093000）两张报销发票。
        # 照片清单 = 任务 seed 固定数据；汇报消息（合计金额）按 target_total 派生。
        *open_gallery_album("相机"),
        *view_gallery_photo_run(
            "IMG_20260423_191032.jpg",
            "IMG_20260418_093000.jpg",
            "IMG_20260418_091544.jpg",
            "IMG_20260417_184226.jpg",
            "IMG_20260417_181500.jpg",
            "IMG_20260417_181200.jpg",
        ),
        *move_camera_reimbursement_files(),
        *send_wechat_message_and_images(
            "{wechat_message}",
            "IMG_20260417_184226.jpg",
            "IMG_20260418_093000.jpg",
            contact_wxid="{boss_wxid}",
        ),
        complete(),
    ],
}


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "crossapp_work.ExistingMeetingToCalendar": {
        # 日历日程的日期/起止 = {topic} 预约会议的开始时间（判分只校验开始对齐）。
        "date": lambda task, state: _scheduled_meeting_times(task, state)["date"],
        "start": lambda task, state: _scheduled_meeting_times(task, state)["start"],
        "end": lambda task, state: _scheduled_meeting_times(task, state)["end"],
    },
    "crossapp_work.CalendarEarliestToAlarm": {
        "tomorrow_day": _day_of_month(1),
        "cal_alarm_hour": _cal_alarm_hour,
        "cal_alarm_minute": _cal_alarm_minute,
    },
    "crossapp_work.MeetingLongestInfoToWechat": {
        "contact_wxid": _contact_wxid,
        "wechat_message": _longest_on_date_message,
    },
    "crossapp_work.MeetingDurationToWechat": {
        "contact_wxid": _contact_wxid,
        "wechat_message": _duration_on_date_message,
    },
    "crossapp_work.WeatherConditionalCancelMeeting": _weather_alarm_calcs(),
    "crossapp_work.MeetingJoinAndNotifySms": {
        "meeting_id": lambda task, state: str(
            _tm_state(state).find_ongoing_entry_by_topic(str(task.p.topic))["meetingId"]
        ),
    },
    "crossapp_work.MeetingMultiChannelNotify": {
        "contact1_wxid": _wxid_of(lambda task, state: str(task.p.contact1)),
        "wechat_message": _predicted_meeting_message(
            lambda task: _MULTICHANNEL_TOPIC, "会议号 {meeting_id}"
        ),
        "sms_message": _predicted_meeting_message(
            lambda task: _MULTICHANNEL_TOPIC, "会议号 {meeting_id}"
        ),
    },
    "crossapp_work.MeetingRouteEtaToWechat": {
        "contact_wxid": _contact_wxid,
        "wechat_message": _route_eta_message,
        **_PLACE_PICK_PARAMS,
    },
    "crossapp_work.MeetingFullFlowToWechat": {
        "topic": lambda task, state: str(task.title_meeting),
        "tomorrow": _tomorrow,
        "end_time": lambda task, state: _time_after(str(task.p.time), 30),
        "contact_wxid": _contact_wxid,
        "wechat_message": _predicted_meeting_message(
            lambda task: str(task.title_meeting), "{topic} {meeting_id}"
        ),
        **_schedule_wheel_calcs(lambda task: str(task.p.time)),
    },
    "crossapp_work.FullMeetingConflictCheckBroadcast": {
        "tomorrow": _tomorrow,
        "end_time": lambda task, state: _time_after(str(task.p.time), 30),
        "contact_wxid": _contact_wxid,
        "wechat_message": _predicted_meeting_message(
            lambda task: str(task.p.flow_topic), "{topic} {meeting_id}"
        ),
        "sms_message": _predicted_meeting_message(
            lambda task: str(task.p.flow_topic), "{topic} {meeting_id}"
        ),
        **_schedule_wheel_calcs(lambda task: str(task.p.time)),
    },
    "crossapp_work.MeetingReminderToNotes": {"note_content": _upcoming_note_content},
    "crossapp_work.SmsAndCalendarOnDate": {"tomorrow": _tomorrow},
    "crossapp_work.TencentMeetingLongestPlannedToWechat": {
        "contact_wxid": _contact_wxid,
        "wechat_message": _longest_planned_message,
    },
    "crossapp_work.TencentMeetingKeywordLongestParticipationToNotes": {
        "note_content": _keyword_participation_note,
    },
    "crossapp_work.ScheduleReleaseMeetingAndNotifyViaNotesWechatSms": {
        "contact_wxid": _contact_wxid,
        # 会议信息三端同文：主题 + 预测会议号 + 密码（判分校验号与密码字样）。
        "note_content": _predicted_meeting_message(
            lambda task: "版本发布会", "{topic} {meeting_id} 密码123456"
        ),
        "wechat_message": _predicted_meeting_message(
            lambda task: "版本发布会", "{topic} {meeting_id} 密码123456"
        ),
        "sms_message": _predicted_meeting_message(
            lambda task: "版本发布会", "{topic} {meeting_id} 密码123456"
        ),
        # 目标时刻为判分硬编码的明日 09:00。
        **_schedule_wheel_calcs(lambda task: "09:00"),
    },
    "crossapp_work.CountCurrentLogErrorsToWechat": {
        "boss_wxid": _boss_wxid,
        "wechat_message": _log_error_count_message,
    },
    "crossapp_work.CountOpenWorkOrdersFromPhotosToWechat": {
        "chenjing_wxid": _wxid_of(lambda task, state: "陈静"),
        "wechat_message": _work_order_message,
    },
    "crossapp_work.InspectionReportToWechat": {
        "boss_wxid": _boss_wxid,
        "inspector_wxid": _inspector_wxid,
    },
    "crossapp_work.OrganizePdfReportsToWechat": {
        "boss_wxid": _boss_wxid,
        "wechat_message": _organized_files_message("target_names", "已整理"),
    },
    "crossapp_work.SubmitRequestedAttachmentsToBoss": {
        "boss_wxid": _boss_wxid,
        "wechat_message": _organized_files_message("target_files", "已提交"),
    },
    "crossapp_work.OrganizeMeetingMaterialsToWechat": {
        "yesterday_day": _day_of_month(-1),
        "boss_wxid": _boss_wxid,
        "wechat_message": _organized_files_message("target_files", "已整理"),
    },
    "crossapp_work.OrganizeReimbursementPhotosToWechat": {
        "boss_wxid": _boss_wxid,
        "wechat_message": _reimbursement_message,
    },
}


LINT_EXEMPT: dict[str, str] = {
    "crossapp_work.FullMeetingConflictCheckBroadcast": (
        "条件分支任务（已 Branch 化）：busy 分支判分要求会议/日历事件/短信零新增"
        "（busy_no_meeting / busy_no_calendar_event / busy_no_sms），正确轨迹只查"
        "日历+微信告知，不打开腾讯会议与短信，R3 覆盖不适用"
    ),
    "crossapp_work.WeatherConditionalCancelMeeting": (
        "条件分支任务（已 Branch 化）：rain 分支判分只要求取消会议（cancel_if_rain），"
        "正确轨迹查天气+取消会议即止，不打开时钟，R3 覆盖不适用"
    ),
}
