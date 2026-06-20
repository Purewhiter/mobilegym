"""Scripted validation plans for Calendar tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    awake,
    back,
    complete,
    enter,
    grounded_answer,
    home,
    submit_answer_sheet,
    swipe,
    tap,
    type_text,
    wait,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_param(trigger_id: str, key: str, value: str, *, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{key}":"{value}"\']:visible',
        summary=summary,
    )


def answer_sheet_input(index: int) -> str:
    return f'[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child({index + 1}) input'


def grounded_choice_answer(choice: str, *values: str, summary: str | None = None) -> list[Step]:
    steps = [
        home(summary="return to launcher"),
        awake("答题卡", summary="open AnswerSheet app"),
        wait(0.8, summary="wait for answer sheet UI"),
        click_selector(f'button:has-text("{choice}"):visible', summary=f"choose answer {choice}"),
    ]
    for offset, value in enumerate(values, start=1):
        steps.append(
            type_text(
                value,
                selector=answer_sheet_input(offset),
                clear=True,
                summary=f"fill answer field {offset}: {value!r}",
            )
        )
    if values:
        steps.append(back(summary="dismiss keyboard to show submit bar"))
    steps.append(submit_answer_sheet(summary=summary))
    return steps


def open_calendar() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("日历", summary="open Calendar"),
        wait(0.7, summary="wait for Calendar home"),
    ]


def open_more_menu() -> list[Step]:
    return [
        click_selector('button[aria-label="更多"]:visible', summary="open Calendar more menu"),
        wait(0.3, summary="wait for Calendar action sheet"),
    ]


def open_settings() -> list[Step]:
    return [
        *open_calendar(),
        *open_more_menu(),
        click_selector('button:has-text("设置"):visible', summary="open Calendar settings"),
        wait(0.5, summary="wait for settings page"),
    ]


def setting_row(label: str) -> str:
    return f'xpath=//span[normalize-space()="{label}"]/ancestor::div[contains(@class,"min-h-[52px]")][1]'


def open_setting_sheet(label: str) -> Step:
    return click_selector(setting_row(label), summary=f"open setting row {label}")


def choose_sheet_option(label: str) -> Step:
    return click_selector(f'button:has-text("{label}"):visible', summary=f"choose sheet option {label}")


def set_setting_option(row_label: str, option_label: str) -> list[Step]:
    return [
        swipe([500, 820], [500, 340], summary=f"scroll settings toward {row_label}"),
        wait(0.2, summary="wait after settings scroll"),
        open_setting_sheet(row_label),
        wait(0.2, summary="wait for setting sheet"),
        choose_sheet_option(option_label),
        wait(0.3, summary="wait for setting sheet to close"),
    ]


def jump_to_date(date_value: str) -> list[Step]:
    return [
        *open_calendar(),
        *open_more_menu(),
        click_selector('button:has-text("日期跳转"):visible', summary="open date jump"),
        wait(0.4, summary="wait for date jump page"),
        type_text(date_value, selector='input[type="date"]:visible', clear=True, summary="enter target date"),
        click_selector('button:has-text("跳转"):visible', summary="jump to target date"),
        wait(0.5, summary="wait for Calendar home on target date"),
    ]


def open_new_event_on_date(date_value: str) -> list[Step]:
    return [
        *jump_to_date(date_value),
        click_selector('button[aria-label="新建"]:visible', summary="open new event page"),
        wait(0.5, summary="wait for event form"),
    ]


def save_event() -> Step:
    return click_selector('xpath=(//button[contains(@class,"p-2")])[2]', summary="save event form")


def set_event_title(title: str) -> Step:
    return type_text(
        title,
        selector='input[placeholder="请输入日程标题"]:visible',
        clear=True,
        summary="enter event title",
    )


def set_start_time(value: str) -> Step:
    return type_text(value, selector='input[placeholder="09:00"]:visible', clear=True, summary="enter start time")


def set_end_time(value: str) -> Step:
    return type_text(value, selector='input[placeholder="10:00"]:visible', clear=True, summary="enter end time")


def set_event_reminder(option_label: str) -> list[Step]:
    return [
        tap([500, 180], summary="tap form header area to dismiss keyboard"),
        wait(0.2, summary="wait after keyboard dismiss tap"),
        swipe([500, 820], [500, 360], summary="scroll event form toward reminder row"),
        wait(0.2, summary="wait after event form scroll"),
        click_selector(
            'xpath=//span[normalize-space()="提醒"]/ancestor::div[contains(@class,"justify-between")][1]//button',
            summary="open event reminder sheet",
        ),
        wait(0.2, summary="wait for reminder sheet"),
        choose_sheet_option(option_label),
        wait(0.3, summary="wait for reminder sheet to close"),
    ]


def create_event_on_date(date_value: str, title: str) -> list[Step]:
    return [
        *open_new_event_on_date(date_value),
        set_event_title(title),
        save_event(),
        wait(0.8, summary="wait for event creation"),
    ]


def create_birthday_event() -> list[Step]:
    return [
        *open_new_event_on_date("{date}"),
        click_selector('button:has-text("生日"):visible', summary="select birthday event type"),
        set_event_title("{title}"),
        save_event(),
        wait(0.8, summary="wait for birthday creation"),
    ]


def create_timed_event() -> list[Step]:
    return [
        *open_new_event_on_date("{date}"),
        set_event_title("{title}"),
        set_start_time("{start}"),
        set_end_time("{end}"),
        save_event(),
        wait(0.8, summary="wait for timed event creation"),
    ]


def create_event_with_reminder() -> list[Step]:
    return [
        *open_new_event_on_date("{date}"),
        set_event_title("{title}"),
        *set_event_reminder("{reminderChoice}"),
        save_event(),
        wait(0.8, summary="wait for event creation with reminder"),
    ]


def create_event_with_alarm_and_confirm() -> list[Step]:
    return [
        *open_new_event_on_date("{date}"),
        set_event_title("{title}"),
        set_start_time("18:30"),
        enter(summary="commit start time via Enter"),
        wait(0.2, summary="wait for start time to apply"),
        set_end_time("20:00"),
        enter(summary="commit end time via Enter"),
        wait(0.2, summary="wait for end time to apply"),
        *set_event_reminder("提前30分钟"),
        swipe([500, 760], [500, 500], summary="scroll event form to alarm row"),
        wait(0.2, summary="wait after alarm row scroll"),
        click_selector(
            'xpath=//span[normalize-space()="闹钟提醒"]/ancestor::div[contains(@class,"justify-between")][1]//div[contains(@class,"rounded-full")]',
            summary="enable event alarm",
        ),
        save_event(),
        wait(0.8, summary="wait for event creation with alarm"),
    ]


def open_search(keyword: str) -> list[Step]:
    return [
        *open_calendar(),
        click_selector('button[aria-label="搜索日程"]:visible', summary="open Calendar search"),
        wait(0.4, summary="wait for search page"),
        type_text(keyword, selector='input[placeholder="搜索日程"]:visible', clear=True, summary="enter search keyword"),
        wait(0.4, summary="wait for search results"),
        back(summary="dismiss search keyboard"),
        wait(0.2, summary="wait after dismissing keyboard"),
    ]


def open_event_from_search(keyword: str, event_id: str) -> list[Step]:
    return [
        *open_search(keyword),
        trigger_param("event.open", "eventId", event_id, summary=f"open event {event_id} from search"),
        wait(0.5, summary="wait for event detail"),
    ]


def delete_current_event() -> list[Step]:
    return [
        click_selector('button[aria-label="删除"]:visible', summary="open delete confirmation"),
        wait(0.3, summary="wait for delete dialog"),
        click_selector(
            'xpath=//div[contains(@class,"z-50")]//button[normalize-space()="删除"]',
            summary="confirm event deletion",
        ),
        wait(0.8, summary="wait for deletion navigation"),
    ]


def delete_search_event(keyword: str, event_id: str) -> list[Step]:
    # Deleting an event returns to the search page with the query CLEARED, so
    # re-enter the keyword each time. Kept lean (no per-step waits; the env's
    # delay_after_action covers settling) so 6 deletions + the answer fit the
    # task's MAX_STEPS budget. The delete-confirm handler auto-returns here.
    return [
        type_text(keyword, selector='input[placeholder="搜索日程"]:visible', clear=True, summary="re-enter search keyword"),
        back(summary="dismiss search keyboard"),
        trigger_param("event.open", "eventId", event_id, summary=f"open search result {event_id}"),
        click_selector('button[aria-label="删除"]:visible', summary="open delete confirmation"),
        click_selector(
            'xpath=//div[contains(@class,"z-50")]//button[normalize-space()="删除"]',
            summary="confirm event deletion",
        ),
    ]


def edit_event_time(keyword: str, event_id: str) -> list[Step]:
    return [
        *open_event_from_search(keyword, event_id),
        trigger_param("event.edit", "eventId", event_id, summary="open event editor"),
        wait(0.5, summary="wait for edit form"),
        set_start_time("{new_time}"),
        # The time input only commits via onKeyDown=Enter / onBlur; press Enter to
        # run applyStartTimeInput. Don't press back here — that would leave the
        # edit form; the save button sits in the top bar, above the keyboard.
        enter(summary="commit start time via Enter"),
        wait(0.3, summary="wait for time to apply"),
        save_event(),
        wait(0.8, summary="wait for event update"),
    ]


PLANS: dict[str, list[Step]] = {
    "calendar.ToggleShowWeekNumber": [
        *open_settings(),
        click_selector(setting_row("显示周数"), summary="toggle week-number setting"),
        wait(0.3, summary="wait for setting update"),
        complete(),
    ],
    "calendar.ChangeDefaultReminder": [
        *open_settings(),
        *set_setting_option("默认提前提醒时间", "{reminderLabel}"),
        complete(),
    ],
    "calendar.CreateEvent": [
        *create_event_on_date("{date}", "{title}"),
        complete(),
    ],
    "calendar.DeleteEvent": [
        *open_event_from_search("{title}", "{eventId}"),
        *delete_current_event(),
        complete(),
    ],
    "calendar.SearchEventTitle": [
        *grounded_answer("{answer}", summary="answer earliest matching event title"),
        complete(),
    ],
    "calendar.CreateBirthdayEvent": [
        *create_birthday_event(),
        complete(),
    ],
    "calendar.CreateTimedEvent": [
        *create_timed_event(),
        complete(),
    ],
    "calendar.CreateEventWithReminder": [
        *create_event_with_reminder(),
        complete(),
    ],
    "calendar.CreateEventWithAlarmAndConfirm": [
        *create_event_with_alarm_and_confirm(),
        complete(),
    ],
    "calendar.DateCalcForward": [
        *grounded_answer("{answer}", summary="answer calculated forward date"),
        complete(),
    ],
    "calendar.CalculateDateInterval": [
        *grounded_answer("{answer}", summary="answer date interval"),
        complete(),
    ],
    "calendar.QueryHolidayLength": [
        *grounded_answer("{answer}", summary="answer holiday length"),
        complete(),
    ],
    "calendar.QueryMakeupWorkday": [
        *grounded_answer("{answer}", summary="answer makeup workday"),
        complete(),
    ],
    "calendar.ConfigAllReminders": [
        *open_settings(),
        *set_setting_option("默认提前提醒时间", "{r1Label}"),
        *set_setting_option("默认全天提醒时间", "{r2Label}"),
        *set_setting_option("默认稍后提醒时间", "{r3Label}"),
        complete(),
    ],
    "calendar.EditEventTime": [
        *edit_event_time("{title}", "{eventId}"),
        complete(),
    ],
    "calendar.QueryFirstEventOnDate": [
        *grounded_answer("{answerTitle}", "{answerTime}", summary="answer first event and start time"),
        complete(),
    ],
    "calendar.DateCalcThenCreate": [
        *create_event_on_date("{targetDate}", "{title}"),
        *grounded_answer("{answer}", summary="answer calculated created date"),
        complete(),
    ],
    "calendar.MakeupDayReminder": [
        *grounded_choice_answer("{answerChoice}", summary="answer makeup reminder branch"),
        complete(),
    ],
    "calendar.SearchDeleteAll": [
        *open_search("{keyword}"),
        *delete_search_event("{keyword}", "seed_project_summary"),
        *delete_search_event("{keyword}", "seed_project_kickoff"),
        *delete_search_event("{keyword}", "seed_project_retro"),
        *delete_search_event("{keyword}", "seed_project_report"),
        *delete_search_event("{keyword}", "seed_team_dinner"),
        *delete_search_event("{keyword}", "seed_team_weekly"),
        *grounded_answer("{deletedCount}", summary="answer deleted event count"),
        complete(),
    ],
    "calendar.CompareScheduleDensity": [
        *grounded_choice_answer("{answerChoice}", summary="answer denser date"),
        complete(),
    ],
    "calendar.EditAndReportNewTime": [
        *edit_event_time("{title}", "{eventId}"),
        *grounded_answer("{answerEnd}", summary="answer updated end time"),
        complete(),
    ],
}
