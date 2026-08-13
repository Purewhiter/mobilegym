"""Scripted validation plans for Calendar tasks.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder (``answer*``, ``eventId``, ``deletedCount``, ``targetDate``, the
reminder sheet labels, the holiday view dates…) is computed at materialization
time from the episode's post-setup initial state via the *judge-homologous*
domain class — calculators build ``Calendar(init_state["apps"]["calendar"])``
exactly like judges build ``Calendar(input.apps_init["calendar"])``, and the
holiday calculators import the same ``HOLIDAY_REST_DAYS`` /
``HOLIDAY_MAKEUP_DAYS`` / ``HOLIDAY_FIRST_REST`` tables the judges read, so
derived values cannot drift from the judge. Explicit test injections would
still win over these calculators; ``test_scripted.py`` deliberately injects
declared parameters only, exercising this derivation path end to end.

UI-label maps: the settings 默认提前提醒 / 稍后提醒 sheets reuse the judge-side
display names, so ``{reminderLabel}`` / ``{r1Label}`` / ``{r3Label}`` reverse
the judge tables directly. The event-form reminder sheet（提前30分钟…）and the
all-day sheet（当天0:00…）use *different copy* than the judge-side display
aliases（30分钟前 / 当天零点…）, so those two maps mirror the frontend strings
(system/Calendar/res/strings.ts: ``remind_*`` / ``settings_allday_*``)
explicitly. This replaces the former agent-side ``_with_derived_params``
calendar special case, whose judge-table-derived labels did not match the
actual sheet copy for exactly those two maps.

Holiday view dates: the month-grid selected cell hides its own 班/休 badge
(CalendarGrid renders badges with ``!selected``), so jump targets for the
badge-evidence asserts are derived *badge-free* days inside the holiday /
makeup month — see ``_holiday_view_date`` / ``_makeup_view_date``.

Restricted ``Branch`` plans:

- ``calendar.MakeupDayReminder`` mirrors its judge's top-level split
  (``holiday in HOLIDAY_MAKEUP_DAYS``): the has-makeup arm views the makeup
  month (evidence asserts) and creates the {title} event on the makeup day,
  the no-makeup arm views the holiday rest month and answers 不用补班.
- ``calendar.SearchDeleteAll`` picks on the declared ``{keyword}``: the two
  sampled keywords match different *sets* of seed events (项目 → 6, 团队 → 2),
  so each arm carries its keyword's static delete blocks.
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_answer,
    assert_text,
    assert_visible,
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
from bench_env.task.calendar.app import (
    CALENDAR_DEFAULT_REMINDER_VALUES,
    CALENDAR_LATER_REMINDER_VALUES,
    HOLIDAY_FIRST_REST,
    HOLIDAY_MAKEUP_DAYS,
    HOLIDAY_REST_DAYS,
    Calendar,
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


def open_date_calculate() -> list[Step]:
    return [
        *open_calendar(),
        *open_more_menu(),
        click_selector('button:has-text("日期推算"):visible', summary="open date calculate page"),
        wait(0.4, summary="wait for date calculate page"),
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
    # Commit each time via Enter + settle wait (same as
    # create_event_with_alarm_and_confirm): applying the start time rewrites
    # the end input (syncTimeInputs keeps the duration), so typing the end
    # value while that React update is pending gets clobbered under load.
    return [
        *open_new_event_on_date("{date}"),
        set_event_title("{title}"),
        set_start_time("{start}"),
        enter(summary="commit start time via Enter"),
        wait(0.2, summary="wait for start time to apply"),
        set_end_time("{end}"),
        enter(summary="commit end time via Enter"),
        wait(0.2, summary="wait for end time to apply"),
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


def selected_day_cell(day_placeholder: str) -> str:
    """The month-grid selected-date circle (the only ``bg-app-primary`` element
    on the month home page); its first child span is the bare day number."""
    return f'div.bg-app-primary > span:text-is("{day_placeholder}")'


# ---------------------------------------------------------------------------
# UI label maps — sheet option copy the plans click on
# ---------------------------------------------------------------------------
# The settings 默认提前提醒/稍后提醒 sheets render exactly the judge-side display
# names, so those maps reverse the judge tables. The event-form reminder sheet
# and the all-day sheet use different copy (strings.ts remind_* /
# settings_allday_*), mirrored here explicitly.

_SETTINGS_REMINDER_LABELS = {value: label for label, value in CALENDAR_DEFAULT_REMINDER_VALUES.items()}
_LATER_REMINDER_LABELS = {value: label for label, value in CALENDAR_LATER_REMINDER_VALUES.items()}
_EVENT_REMINDER_SHEET_LABELS = {
    0: "开始时",
    5: "提前5分钟",
    15: "提前15分钟",
    30: "提前30分钟",
    60: "提前1小时",
    24 * 60: "提前1天",
}
_ALLDAY_REMINDER_SHEET_LABELS = {
    "start_of_day": "当天0:00",
    "9_am_on_day": "当天9:00",
    "9_am_day_before": "前一天9:00",
}


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (get_answer / get_expected_response
# / check_goals in bench_env/task/calendar/tasks.py) through the same Calendar
# domain class over the same initial state (seed events are planted by the
# tasks' _prepare before the first observation), so the typed/asserted values
# are judge-homologous by construction.

def _calendar(state: dict[str, Any]) -> Calendar:
    """Judge-homologous accessor: ``Calendar(init_state["apps"]["calendar"])``."""
    return Calendar(state["apps"]["calendar"])


def _seed_event_id(task: Any, state: dict[str, Any]) -> str:
    """Search-result trigger param for the seeded {title} event — the same
    find-by-title lookup the judges use."""
    event = _calendar(state).find_event_by_title(task.p.title)
    if event is None:
        raise ValueError(f"seed event {task.p.title!r} not found in the initial state")
    return str(event["id"])


def _earliest_keyword_match_title(task: Any, state: dict[str, Any]) -> str:
    """Mirror SearchEventTitle.get_answer: matches sort startTs-desc, take last."""
    matches = _calendar(state).find_events_by_keyword(task.p.keyword)
    if not matches:
        raise ValueError(f"keyword {task.p.keyword!r} matches no seed event")
    return str(matches[-1]["title"])


def _keyword_match_count(task: Any, state: dict[str, Any]) -> str:
    """Mirror SearchDeleteAll's judge: deleting *all* matches means the answered
    count equals the initial match count."""
    return str(len(_calendar(state).find_events_by_keyword(task.p.keyword)))


def _forward_target_iso(task: Any, state: dict[str, Any]) -> str:
    """Mirror DateCalcForward / DateCalcThenCreate: {date} + {days}, answered as
    the ISO label (accepted by the judge's date matcher)."""
    target = Calendar.parse_ymd(task.p.date) + dt.timedelta(days=int(task.p.days))
    return target.isoformat()


def _interval_days(task: Any, state: dict[str, Any]) -> str:
    """Mirror CalculateDateInterval.get_answer."""
    delta = Calendar.parse_ymd(task.p.date2) - Calendar.parse_ymd(task.p.date1)
    return str(abs(delta.days))


def _first_event_on_date(task: Any, state: dict[str, Any]) -> dict[str, Any]:
    return _calendar(state).first_event_on_date(Calendar.parse_ymd(task.p.date))


def _first_event_start_hhmm(task: Any, state: dict[str, Any]) -> str:
    event = _first_event_on_date(task, state)
    start_ts = Calendar.coerce_ts(event["startTs"])
    if start_ts is None:
        raise ValueError(f"seed event {event['title']!r} missing startTs")
    return Calendar.hhmm(start_ts)


def _denser_date_choice(task: Any, state: dict[str, Any]) -> str:
    """Mirror CompareScheduleDensity.get_expected_response (tie → 一样多)."""
    calendar = _calendar(state)
    count1 = calendar.count_events_on_date(Calendar.parse_ymd(task.p.date1))
    count2 = calendar.count_events_on_date(Calendar.parse_ymd(task.p.date2))
    if count1 > count2:
        return str(task.p.date1)
    if count2 > count1:
        return str(task.p.date2)
    return "一样多"


def _edited_end_ms(task: Any, state: dict[str, Any]) -> int:
    """Mirror EditAndReportNewTime.check_goals: the seed event's duration is
    preserved, so the new end is {new_date} {new_time} + seed duration."""
    original = _calendar(state).find_event_by_title(task.p.title)
    if original is None:
        raise ValueError(f"seed event {task.p.title!r} not found in the initial state")
    duration_ms = int(original["endTs"]) - int(original["startTs"])
    return Calendar.timestamp(task.p.new_date, task.p.new_time) + duration_ms


def _edited_end_answer(task: Any, state: dict[str, Any]) -> str:
    end = dt.datetime.fromtimestamp(_edited_end_ms(task, state) / 1000.0)
    return f"{end.date().isoformat()} {end.hour:02d}:{end.minute:02d}"


def _edited_end_hhmm(task: Any, state: dict[str, Any]) -> str:
    return Calendar.hhmm(_edited_end_ms(task, state))


# -- holiday month geometry --------------------------------------------------

def _holiday_rest_span(holiday: str) -> list[dt.date]:
    first = dt.date.fromisoformat(HOLIDAY_FIRST_REST[holiday])
    return [first + dt.timedelta(days=i) for i in range(int(HOLIDAY_REST_DAYS[holiday]))]


_ALL_MAKEUP_DATES = frozenset(dt.date.fromisoformat(d) for d in HOLIDAY_MAKEUP_DAYS.values())


def _month_label(iso_date: str) -> str:
    """Month-view title as the home page renders it: ``{viewMonth + 1}月``."""
    return f"{dt.date.fromisoformat(iso_date).month}月"


def _holiday_view_date(holiday: str) -> str:
    """A badge-free day inside the holiday's rest month to park the selected
    cell on: the selected month-grid cell hides its own 班/休 badge
    (CalendarGrid renders badges with ``!selected``). The judge tables cover
    rest + post-holiday makeup days; the two pre-holiday makeup cells in
    WORK_REST_2026 (02-14, 09-20) sit at distance 1 / 5 from the rest span, so
    scanning outward from distance 2 never lands on one (春节 → 02-13,
    中秋 → 09-23)."""
    rest = _holiday_rest_span(holiday)
    first, last = rest[0], rest[-1]
    blocked = set(rest) | set(_ALL_MAKEUP_DATES)
    for offset in range(2, 12):
        for candidate in (first - dt.timedelta(days=offset), last + dt.timedelta(days=offset)):
            if candidate.month == first.month and candidate not in blocked:
                return candidate.isoformat()
    raise ValueError(f"no badge-free view day found in the rest month of {holiday!r}")


def _makeup_view_date(holiday: str) -> str:
    """The first badge-free day after the holiday inside the makeup-workday
    month (春节 → 02-24, matching the previously pinned live geometry), so the
    班 cell stays unselected and its badge visible."""
    makeup = dt.date.fromisoformat(HOLIDAY_MAKEUP_DAYS[holiday])
    rest = _holiday_rest_span(holiday)
    blocked = set(rest) | set(_ALL_MAKEUP_DATES)
    for offset in range(1, 12):
        candidate = rest[-1] + dt.timedelta(days=offset)
        if candidate.month == makeup.month and candidate not in blocked:
            return candidate.isoformat()
    raise ValueError(f"no badge-free view day found in the makeup month of {holiday!r}")


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "calendar.ChangeDefaultReminder": {
        "reminderLabel": lambda task, state: _SETTINGS_REMINDER_LABELS[task.p.reminder],
    },
    "calendar.DeleteEvent": {"eventId": _seed_event_id},
    "calendar.SearchEventTitle": {"answer": _earliest_keyword_match_title},
    "calendar.CreateEventWithReminder": {
        "reminderChoice": lambda task, state: _EVENT_REMINDER_SHEET_LABELS[int(task.p.reminder)],
    },
    "calendar.DateCalcForward": {"answer": _forward_target_iso},
    "calendar.CalculateDateInterval": {"answer": _interval_days},
    "calendar.QueryHolidayLength": {
        "answer": lambda task, state: str(HOLIDAY_REST_DAYS[task.p.holiday]),
        "holidayViewDate": lambda task, state: _holiday_view_date(task.p.holiday),
        "holidayMonthLabel": lambda task, state: _month_label(HOLIDAY_FIRST_REST[task.p.holiday]),
    },
    "calendar.QueryMakeupWorkday": {
        "answer": lambda task, state: HOLIDAY_MAKEUP_DAYS[task.p.holiday],
        "makeupViewDate": lambda task, state: _makeup_view_date(task.p.holiday),
        "makeupMonthLabel": lambda task, state: _month_label(HOLIDAY_MAKEUP_DAYS[task.p.holiday]),
    },
    "calendar.ConfigAllReminders": {
        "r1Label": lambda task, state: _SETTINGS_REMINDER_LABELS[task.p.r1],
        "r2Label": lambda task, state: _ALLDAY_REMINDER_SHEET_LABELS[task.p.r2],
        "r3Label": lambda task, state: _LATER_REMINDER_LABELS[task.p.r3],
    },
    "calendar.EditEventTime": {"eventId": _seed_event_id},
    "calendar.QueryFirstEventOnDate": {
        "answerTitle": lambda task, state: str(_first_event_on_date(task, state)["title"]),
        "answerTime": _first_event_start_hhmm,
    },
    "calendar.DateCalcThenCreate": {
        "targetDate": _forward_target_iso,
        "answer": _forward_target_iso,
    },
    # All calculators must be total over the 7 sampled holidays (they all run at
    # materialization regardless of the picked branch): makeup* fall back to ""
    # for the no-makeup holidays, whose arm never renders them.
    "calendar.MakeupDayReminder": {
        "makeupDate": lambda task, state: HOLIDAY_MAKEUP_DAYS.get(task.p.holiday, ""),
        "makeupViewDate": lambda task, state: (
            _makeup_view_date(task.p.holiday) if task.p.holiday in HOLIDAY_MAKEUP_DAYS else ""
        ),
        "makeupMonthLabel": lambda task, state: (
            _month_label(HOLIDAY_MAKEUP_DAYS[task.p.holiday]) if task.p.holiday in HOLIDAY_MAKEUP_DAYS else ""
        ),
        "holidayViewDate": lambda task, state: _holiday_view_date(task.p.holiday),
        "holidayMonthLabel": lambda task, state: _month_label(HOLIDAY_FIRST_REST[task.p.holiday]),
    },
    "calendar.SearchDeleteAll": {"deletedCount": _keyword_match_count},
    "calendar.CompareScheduleDensity": {
        "answerChoice": _denser_date_choice,
        "date1Day": lambda task, state: str(Calendar.parse_ymd(task.p.date1).day),
        "date2Day": lambda task, state: str(Calendar.parse_ymd(task.p.date2).day),
    },
    "calendar.EditAndReportNewTime": {
        "eventId": _seed_event_id,
        "answerEnd": _edited_end_answer,
        "newEndHhmm": _edited_end_hhmm,
    },
}


# ---------------------------------------------------------------------------
# calendar.MakeupDayReminder — restricted Branch (judge-homologous split)
# ---------------------------------------------------------------------------

def _makeup_day_reminder_pick(task: Any, state: dict[str, Any]) -> str:
    """Mirror MakeupDayReminder.check_goals' top-level split: the judge branches
    on ``holiday in HOLIDAY_MAKEUP_DAYS``."""
    return "has_makeup" if task.p.holiday in HOLIDAY_MAKEUP_DAYS else "no_makeup"


_MAKEUP_REMINDER_HAS_MAKEUP: list[Step] = [
    # Month-view inspection first: land on a badge-free day in the makeup month
    # so the 班 cell stays unselected, and prove the evidence on screen.
    *jump_to_date("{makeupViewDate}"),
    assert_text("{makeupMonthLabel}", exact=True, summary="assert month view is on the makeup month"),
    assert_text("班", summary="assert 班 makeup badge visible in month grid"),
    # Then create the {title} event on the makeup day itself (the judge checks
    # check_event_on_date against HOLIDAY_MAKEUP_DAYS[{holiday}]).
    *create_event_on_date("{makeupDate}", "{title}"),
    # 需要补班 must not trip the judge's 不用补班 regex — the choice text is the
    # answer_fields option verbatim.
    *grounded_choice_answer("需要补班", summary="answer makeup reminder: needed"),
    complete(),
]

_MAKEUP_REMINDER_NO_MAKEUP: list[Step] = [
    # No post-holiday makeup: view the holiday rest month instead. The branch
    # verdict rests on the *absence* of a 班 badge after the holiday, and
    # negative asserts are unsupported — prove the context (right month + the
    # rest badges the agent must inspect) and answer without creating events.
    *jump_to_date("{holidayViewDate}"),
    assert_text("{holidayMonthLabel}", exact=True, summary="assert month view is on the holiday month"),
    assert_text("休", summary="assert holiday rest badges visible in month grid"),
    *grounded_choice_answer("不用补班", summary="answer makeup reminder: not needed"),
    complete(),
]


# ---------------------------------------------------------------------------
# calendar.SearchDeleteAll — restricted Branch (per-keyword seed match sets)
# ---------------------------------------------------------------------------

def _search_delete_all_arm(event_ids: list[str]) -> list[Step]:
    steps: list[Step] = [*open_search("{keyword}")]
    for event_id in event_ids:
        steps.extend(delete_search_event("{keyword}", event_id))
    steps.extend(
        [
            # Evidence assert (B): the deleted *count* is never rendered anywhere,
            # so it stays judge-derived ({deletedCount} = initial match count).
            # Re-run the search (the last deletion cleared the query) and assert
            # the empty state — the on-screen counterpart of the judge's "no
            # matches remain" check.
            type_text("{keyword}", selector='input[placeholder="搜索日程"]:visible', clear=True, summary="re-enter keyword to verify empty"),
            assert_text("未找到相关日程", summary="assert all matching events deleted", endorses=["deletedCount"]),
            *grounded_answer("{deletedCount}", summary="answer deleted event count"),
            complete(),
        ]
    )
    return steps


# Seed events matching each sampled keyword (title or description), in the
# search list's startTs-desc order — mirrors Calendar.find_events_by_keyword
# over bench_env/task/calendar/app.py's build_seed_events.
_SEARCH_DELETE_IDS_BY_KEYWORD: dict[str, list[str]] = {
    "项目": [
        "seed_project_summary",
        "seed_project_kickoff",
        "seed_project_retro",
        "seed_project_report",
        "seed_team_dinner",
        "seed_team_weekly",
    ],
    "团队": [
        "seed_team_dinner",
        "seed_team_weekly",
    ],
}


PLANS: dict[str, list[Step] | Branch] = {
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
        # Search results (with dates) are the answer page for "earliest event".
        *open_search("{keyword}"),
        # Earliest match sorts last (results are startTs-desc) but all seed
        # matches fit one screen; prove the answer title is read off the list.
        assert_answer("{answer}", field_index=0, summary="assert earliest event title in results"),
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
        # Compute on the 日期推算 tab (default direction is 往后/after), then read
        # the on-page result before answering.
        *open_date_calculate(),
        type_text("{date}", selector='input[type="date"]:visible', clear=True, summary="enter start date"),
        type_text("{days}", selector='input[type="number"]:visible', clear=True, summary="enter day count"),
        click_selector('button:has-text("开始推算"):visible', summary="run forward calculation"),
        wait(0.4, summary="wait for calculation result"),
        # Result card renders "YYYY-MM-DD（M月D日）"; the date matcher hits the
        # ISO label of the derived answer date.
        assert_answer("{answer}", field_index=0, summary="assert calculated date in result card"),
        *grounded_answer("{answer}", summary="answer calculated forward date"),
        complete(),
    ],
    "calendar.CalculateDateInterval": [
        # Compute on the 日期间隔 tab ("相差 N 天"), then answer.
        *open_date_calculate(),
        click_selector('button:has-text("日期间隔"):visible', summary="switch to interval tab"),
        wait(0.3, summary="wait for interval tab"),
        type_text("{date1}", selector='xpath=(//input[@type="date"])[1]', clear=True, summary="enter interval start date"),
        type_text("{date2}", selector='xpath=(//input[@type="date"])[2]', clear=True, summary="enter interval end date"),
        click_selector('button:has-text("开始推算"):visible', summary="run interval calculation"),
        wait(0.4, summary="wait for interval result"),
        # Result card renders "相差 N 天"; the number matcher extracts N.
        assert_answer("{answer}", field_index=0, summary="assert interval days in result card"),
        *grounded_answer("{answer}", summary="answer date interval"),
        complete(),
    ],
    "calendar.QueryHolidayLength": [
        # {holidayViewDate}: derived badge-free day in the holiday rest month
        # (the selected cell hides its own badge), so every 休 badge stays
        # visible after the jump.
        *jump_to_date("{holidayViewDate}"),
        # Evidence asserts (B): the answer is a *count* of 休 badges — a bare
        # assert_answer would false-positive on the day-number grid, so prove
        # the context instead: the month-view title matches the holiday month
        # and at least one 休 badge is rendered. The count itself stays
        # actor-derived (the probe cannot count elements).
        assert_text("{holidayMonthLabel}", exact=True, summary="assert month view is on the holiday month"),
        assert_text("休", summary="assert 休 rest badge visible in month grid", endorses=["answer"]),
        *grounded_answer("{answer}", summary="answer holiday length"),
        complete(),
    ],
    "calendar.QueryMakeupWorkday": [
        # {makeupViewDate}: first badge-free day after the holiday inside the
        # makeup month (春节 → 02-24, the previously pinned geometry), keeping
        # the 班 badge cell unselected.
        *jump_to_date("{makeupViewDate}"),
        # Evidence asserts (B, weak): the answer date renders as a bare day
        # number in its cell (no "M月D日" text), so the date matcher has nothing
        # to hit. Prove the context instead: makeup-month title + a 班 badge on
        # screen. Weak because a month may show a pre-holiday 班 too (Feb 2026:
        # 02-14) and the probe cannot tell which cell carries the badge.
        assert_text("{makeupMonthLabel}", exact=True, summary="assert month view is on the makeup month"),
        assert_text("班", summary="assert 班 makeup badge visible in month grid", endorses=["answer"]),
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
        # After the jump, the home agenda panel lists that day's events sorted by
        # start time (title + HH:mm), so the first row is the answer.
        *jump_to_date("{date}"),
        # Derived from the same seed events the judge reads — safe from clock
        # rollover (seeds are planted relative to sim-today by _prepare).
        assert_answer("{answerTitle}", field_index=0, summary="assert first event title in agenda"),
        assert_answer("{answerTime}", field_index=1, summary="assert first event start time in agenda"),
        *grounded_answer("{answerTitle}", "{answerTime}", summary="answer first event and start time"),
        complete(),
    ],
    "calendar.DateCalcThenCreate": [
        # create_event_on_date expanded so the assert can sit inside the form:
        # the start-time row renders "YYYY年M月D日周X" for the jump target, so the
        # date matcher proves the calculated target date is on screen where the
        # event is being created (before the keyboard opens for the title).
        *open_new_event_on_date("{targetDate}"),
        assert_answer("{answer}", field_index=0, summary="assert target date visible in event form"),
        set_event_title("{title}"),
        save_event(),
        wait(0.8, summary="wait for event creation"),
        *grounded_answer("{answer}", summary="answer calculated created date"),
        complete(),
    ],
    # Restricted Branch mirroring the judge's own conditional: holidays with a
    # post-holiday makeup day create the reminder on it, the rest answer 不用补班.
    "calendar.MakeupDayReminder": Branch(
        pick=_makeup_day_reminder_pick,
        branches={
            "has_makeup": _MAKEUP_REMINDER_HAS_MAKEUP,
            "no_makeup": _MAKEUP_REMINDER_NO_MAKEUP,
        },
    ),
    # Restricted Branch on the declared {keyword}: each sampled keyword matches
    # a different static set of seed events, deleted one block per event.
    "calendar.SearchDeleteAll": Branch(
        pick=lambda task, state: str(task.p.keyword),
        branches={
            keyword: _search_delete_all_arm(event_ids)
            for keyword, event_ids in _SEARCH_DELETE_IDS_BY_KEYWORD.items()
        },
    ),
    "calendar.CompareScheduleDensity": [
        # View each date's agenda list on the home page in turn, then answer.
        # Evidence asserts (B): the compared *counts* are never rendered as
        # numbers, and a sampled date may carry zero events (its agenda may even
        # swap 暂无日程 for a festival/solar-term card), so the deterministic
        # per-date evidence is the month-grid *selected day cell* — the unique
        # bg-app-primary circle whose day number must match the jumped date,
        # with that date's agenda rendered right below.
        # The pair jointly proves both agendas were viewed; the closing assert
        # carries the {answerChoice} endorsement.
        *jump_to_date("{date1}"),
        assert_visible(selected_day_cell("{date1Day}"), summary="assert date1 selected in month grid"),
        *jump_to_date("{date2}"),
        assert_visible(
            selected_day_cell("{date2Day}"),
            summary="assert date2 selected in month grid",
            endorses=["answerChoice"],
        ),
        *grounded_choice_answer("{answerChoice}", summary="answer denser date"),
        complete(),
    ],
    "calendar.EditAndReportNewTime": [
        # The event form has no date control (CalendarNewEventPage renders the
        # date as read-only text), so moving {title} to {new_date} goes the only
        # GUI way: delete the seeded event, recreate it on {new_date} with the
        # seed duration preserved ({newEndHhmm} = {new_time} + duration), then
        # reopen it and read the new end time off the detail page.
        *open_event_from_search("{title}", "{eventId}"),
        *delete_current_event(),  # confirm handler auto-returns to the search page
        back(summary="back from search to Calendar home"),
        wait(0.3, summary="wait for Calendar home"),
        *open_new_event_on_date("{new_date}"),
        set_event_title("{title}"),
        set_start_time("{new_time}"),
        enter(summary="commit start time via Enter"),
        wait(0.2, summary="wait for start time to apply"),
        set_end_time("{newEndHhmm}"),
        enter(summary="commit end time via Enter"),
        wait(0.2, summary="wait for end time to apply"),
        save_event(),
        wait(0.8, summary="wait for event creation"),
        # Saving the create form returns home with the event's day selected;
        # its agenda row (exact title) opens the detail page, whose time row
        # renders "YYYY年M月D日 … HH:MM - HH:MM" — the time matcher (±5min)
        # hits the new end time (seed durations ≥ 60min keep start out of
        # tolerance).
        click_selector('[data-adjust-resize] :text-is("{title}"):visible', summary="open recreated event from agenda"),
        wait(0.5, summary="wait for event detail"),
        assert_answer("{answerEnd}", field_index=0, summary="assert updated end time on detail page"),
        *grounded_answer("{answerEnd}", summary="answer updated end time"),
        complete(),
    ],
}
