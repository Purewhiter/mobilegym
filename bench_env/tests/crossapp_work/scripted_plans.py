"""Scripted replay plans for cross-app work tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    awake,
    back,
    complete,
    enter,
    home,
    type_text,
    wait,
)
from bench_env.tests.map.scripted_plans import route_to_place
from bench_env.tests.tencent_meeting.scripted_plans import join_meeting, rename_meeting_self


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
    prefer_reverse_half: bool = False,
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


def send_sms_reply(content: str, *, recipient: str) -> list[Step]:
    return [
        *open_app("短信"),
        click_selector(f'div.flex.items-start:has-text("{recipient}"):visible', f"open SMS conversation {recipient}"),
        type_text(content, selector="input:visible", clear=True, summary="type SMS reply"),
        click_selector("button.bg-app-primary:visible", "send SMS reply"),
        wait(0.6, summary="wait for SMS reply send"),
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


def open_calendar_event_form(date_value: str) -> list[Step]:
    return [
        *open_app("日历"),
        click_selector('button[aria-label="更多"]:visible', "open Calendar more menu"),
        wait(0.3, summary="wait for Calendar action sheet"),
        click_selector('button:has-text("日期跳转"):visible', "open date jump"),
        wait(0.4, summary="wait for date jump page"),
        type_text(date_value, selector='input[type="date"]:visible', clear=True, summary="enter target date"),
        click_selector('button:has-text("跳转"):visible', "jump to target date"),
        wait(0.5, summary="wait for Calendar home on target date"),
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


def add_default_alarm() -> list[Step]:
    return [
        *open_app("时钟"),
        click_selector('button:has-text("闹钟"):visible', "open Alarm tab"),
        wait(0.3, summary="wait for Alarm tab"),
        click_selector('xpath=//button[contains(@class,"bottom-[112px]")]', "open add alarm sheet"),
        wait(0.5, summary="wait for add alarm sheet"),
        click_selector('xpath=(//div[contains(@class,"z-40")]//button[contains(@class,"w-10")])[2]', "save alarm sheet"),
        wait(0.6, summary="wait for alarm creation"),
    ]


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
) -> list[Step]:
    selector = source_selector or alarm_time_button(source_time)
    steps = [
        *open_app("时钟", home_first=False),
        click_selector('button:has-text("闹钟"):visible', "open Alarm tab"),
        wait(0.3, summary="wait for Alarm tab"),
    ]
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
            wheel_scroll(_clock_wheel_by_label("时", "H"), source_hour, target_hour, 24, "set alarm hour"),
            wheel_scroll(
                _clock_wheel_by_label("分", "M"),
                source_minute,
                target_minute,
                60,
                "set alarm minute",
                prefer_reverse_half=True,
            ),
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
            "{schedule_date_index_target}",
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


def set_schedule_duration() -> list[Step]:
    return [
        click_selector(
            'xpath=//span[normalize-space()="会议时长" or normalize-space()="Duration"]'
            '/ancestor::div[contains(@class,"px-4") and contains(@class,"py-4")][1]',
            "open Tencent Meeting duration picker",
        ),
        wait(0.3, summary="wait for duration picker"),
        wheel_scroll(
            _schedule_picker_column(1),
            "{schedule_duration_hour_current}",
            "{schedule_duration_hour_target}",
            0,
            "set meeting duration hour",
            max_delta_per_swipe=3,
            delta_y_fraction=0.2,
        ),
        wheel_scroll(
            _schedule_picker_column(2),
            "{schedule_duration_minute_index_current}",
            "{schedule_duration_minute_index_target}",
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
    set_duration: bool = False,
) -> list[Step]:
    steps = [
        *open_tencent_meeting(),
        click_selector('[data-trigger="home.schedule.open"]:visible', "open schedule entry"),
    ]
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
    if set_duration:
        steps.extend(set_schedule_duration())
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


PLANS: dict[str, list[Step]] = {
    "crossapp_work.ExistingMeetingToCalendar": [
        *open_tencent_meeting(),
        *create_calendar_event("{date}", "{topic}", start="{start}", end="{end}"),
        complete(),
    ],
    "crossapp_work.CalendarEarliestToAlarm": [
        *open_app("日历"),
        *add_default_alarm(),
        *set_alarm_time("07:00", "9", "0", source_hour="7", source_minute="0", scroll_to_source=True),
        complete(),
    ],
    "crossapp_work.MeetingLongestInfoToWechat": [
        *open_tencent_meeting(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_work.MeetingDurationToWechat": [
        *open_tencent_meeting(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_work.WeatherConditionalCancelMeeting": [
        *open_app("天气"),
        *open_tencent_meeting(),
        *add_default_alarm(),
        *set_alarm_time(
            "{alarm_source_time}",
            "{alarm_hour}",
            "{alarm_wheel_minute}",
            source_hour="{alarm_source_hour}",
            source_minute="{alarm_source_minute}",
        ),
        complete(),
    ],
    "crossapp_work.MeetingJoinAndNotifySms": [
        *open_tencent_meeting(),
        *join_meeting("{meeting_id}"),
        *rename_meeting_self("{name}"),
        *send_sms_message("{sms_message}", recipient="{contact}"),
        complete(),
    ],
    "crossapp_work.MeetingMultiChannelNotify": [
        *schedule_meeting("快速会议"),
        *send_wechat_message("{wechat_message}", contact_wxid="{contact1_wxid}"),
        *send_sms_message("{sms_message}", recipient="{contact2}"),
        complete(),
    ],
    "crossapp_work.MeetingRouteEtaToWechat": [
        *open_tencent_meeting(),
        *route_to_place("{place}", mode="walking"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_work.MeetingFullFlowToWechat": [
        *schedule_meeting("{topic}", pin="{pin}", set_time=True),
        *create_calendar_event("{tomorrow}", "项目周会", start="{time}", end="{end_time}", reminder="提前15分钟", alarm=True),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_work.FullMeetingConflictCheckBroadcast": [
        *schedule_meeting("{flow_topic}", pin=None, set_time=True),
        *create_calendar_event("{tomorrow}", "{flow_topic}", start="{time}", end="{end_time}", reminder="提前15分钟", alarm=True),
        *send_wechat_message("{wechat_message}", ensure_root=False),
        *send_sms_reply("{sms_message}", recipient="{contact2}"),
        complete(),
    ],
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
    "crossapp_work.TencentMeetingLongestPlannedToWechat": [
        *open_tencent_meeting(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_work.TencentMeetingKeywordLongestParticipationToNotes": [
        *open_tencent_meeting(),
        *create_note("参会统计", "{note_content}"),
        complete(),
    ],
    "crossapp_work.ScheduleReleaseMeetingAndNotifyViaNotesWechatSms": [
        *schedule_meeting("{topic}", pin="123456", set_time=True, set_duration=True),
        *create_note("发布会议", "{note_content}"),
        *send_wechat_message("{wechat_message}"),
        *send_sms_message("{sms_message}", recipient="{sms_contact}"),
        complete(),
    ],
    "crossapp_work.CountCurrentLogErrorsToWechat": [
        *send_wechat_message("{wechat_message}", contact_wxid="{boss_wxid}"),
        complete(),
    ],
    "crossapp_work.CountOpenWorkOrdersFromPhotosToWechat": [
        *send_wechat_message("{wechat_message}", contact_wxid="{chenjing_wxid}"),
        complete(),
    ],
    "crossapp_work.InspectionReportToWechat": [
        *send_wechat_message("{wechat_message}", contact_wxid="{boss_wxid}"),
        *send_wechat_message("{wechat_message}", contact_wxid="{inspector_wxid}", via_contacts=True),
        complete(),
    ],
    "crossapp_work.OrganizePdfReportsToWechat": [
        *move_pdf_reports_to_final_folder(),
        *send_wechat_message("{wechat_message}", contact_wxid="{boss_wxid}"),
        complete(),
    ],
    "crossapp_work.SubmitRequestedAttachmentsToBoss": [
        *move_files(
            "/sdcard/Download/待提交",
            "/sdcard/Documents/submission",
            "/sdcard/Download/待提交/供应商盖章确认.pdf",
            "/sdcard/Download/待提交/流水截图_A.png",
        ),
        *send_wechat_message("供应商盖章确认.pdf 流水截图_A.png 已提交", contact_wxid="wxid_boss_007"),
        complete(),
    ],
    "crossapp_work.OrganizeMeetingMaterialsToWechat": [
        *move_files(
            "/sdcard/Download/会议资料",
            "/sdcard/Documents/meeting_pack",
            "/sdcard/Download/会议资料/会议附件_03.xlsx",
            "/sdcard/Download/会议资料/会议附件_04.png",
            "/sdcard/Download/会议资料/会议附件_05.txt",
        ),
        *send_wechat_message("会议附件_03.xlsx 会议附件_04.png 会议附件_05.txt 已整理", contact_wxid="wxid_boss_007"),
        complete(),
    ],
    "crossapp_work.OrganizeReimbursementPhotosToWechat": [
        *move_camera_reimbursement_files(),
        *send_wechat_message_and_images(
            "报销照片已整理，合计359.70",
            "IMG_20260417_184226.jpg",
            "IMG_20260418_093000.jpg",
            contact_wxid="wxid_boss_007",
        ),
        complete(),
    ],
}
