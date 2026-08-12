"""Scripted validation plans for Clock tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    assert_answer,
    assert_visible,
    awake,
    back,
    complete,
    grounded_answer,
    home,
    type_text,
    wait,
    swipe,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def drag_point(point: list[int], *, summary: str) -> Step:
    return {"op": "drag", "point1": point, "point2": point, "summary": summary}


def open_clock() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("时钟", summary="open Clock"),
        wait(0.7, summary="wait for Clock"),
    ]


def open_alarm_tab() -> list[Step]:
    return [
        *open_clock(),
        click_selector('button:has-text("闹钟"):visible', summary="open Alarm tab"),
        wait(0.3, summary="wait for Alarm tab"),
    ]


def open_world_tab() -> list[Step]:
    return [
        *open_clock(),
        click_selector('button:has-text("世界时钟"):visible', summary="open World Clock tab"),
        wait(0.4, summary="wait for World Clock tab"),
    ]


def alarm_card(time_text: str) -> str:
    return f'xpath=//span[normalize-space()="{time_text}"]/ancestor::div[contains(@class,"rounded-2xl")][1]'


def alarm_switch(time_text: str) -> str:
    return f'{alarm_card(time_text)}//button[contains(@class,"rounded-full")]'


def toggle_alarm(time_text: str) -> list[Step]:
    return [
        *open_alarm_tab(),
        click_selector(alarm_switch(time_text), summary=f"toggle alarm {time_text}"),
        wait(0.3, summary="wait for alarm toggle"),
    ]


def open_add_alarm() -> list[Step]:
    return [
        *open_alarm_tab(),
        click_selector('xpath=//button[contains(@class,"bottom-[112px]")]', summary="open add alarm sheet"),
        wait(0.5, summary="wait for add alarm sheet"),
    ]


def open_alarm_editor(time_text: str) -> list[Step]:
    return [
        *open_alarm_tab(),
        click_selector(f'button:has-text("{time_text}"):visible', summary=f"open alarm {time_text} editor"),
        wait(0.4, summary="wait for quick edit modal"),
        click_selector('button:has-text("更多设置"):visible', summary="open full alarm settings"),
        wait(0.5, summary="wait for full alarm editor"),
    ]


def save_alarm_sheet() -> Step:
    return click_selector(
        'xpath=(//div[contains(@class,"z-40")]//button[contains(@class,"w-10")])[2]',
        summary="save alarm sheet",
    )


def set_repeat(label: str) -> list[Step]:
    return [
        click_selector('button:has-text("重复"):visible', summary="open repeat selector"),
        wait(0.3, summary="wait for repeat selector"),
        # Scope to the repeat sheet (.z-40) so :first doesn't match the alarm
        # editor's repeat summary row behind the sheet (covered -> untappable).
        click_selector(f'.z-40 button:has-text("{label}"):visible', summary=f"choose repeat {label}"),
        wait(0.2, summary="wait for repeat selection"),
        back(summary="close repeat selector"),
        wait(0.3, summary="wait for alarm editor"),
    ]


def add_default_alarm() -> list[Step]:
    return [
        *open_add_alarm(),
        save_alarm_sheet(),
        wait(0.6, summary="wait for alarm creation"),
    ]


def add_alarm_with_settings() -> list[Step]:
    return [
        *open_add_alarm(),
        type_text("{note}", selector='input[placeholder="输入内容"]:visible', clear=True, summary="enter alarm note"),
        save_alarm_sheet(),
        wait(0.6, summary="wait for alarm creation"),
    ]


def select_alarm_for_delete() -> list[Step]:
    return [
        *open_alarm_tab(),
        drag_point([500, 575], summary="long-press second alarm row for selection mode"),
        wait(0.8, summary="wait for alarm selection mode"),
    ]


def delete_selected() -> list[Step]:
    return [
        click_selector('button:has-text("删除"):visible', summary="delete selected item"),
        wait(0.5, summary="wait for deletion"),
    ]


def add_city(city: str) -> list[Step]:
    return [
        *open_world_tab(),
        click_selector('button[aria-label="添加"]:visible', summary="open city selector"),
        wait(0.4, summary="wait for city selector"),
        type_text(city, selector='input[placeholder="输入国家或城市名搜索"]:visible', clear=True, summary=f"search city {city}"),
        wait(0.3, summary="wait for city search"),
        click_selector(f'button:has-text("{city}"):visible', summary=f"add city {city}"),
        wait(0.5, summary="wait for city addition"),
    ]


def remove_first_world_city() -> list[Step]:
    return [
        *open_world_tab(),
        swipe([500, 850], [500, 250], summary="scroll world clock to city list"),
        wait(0.4, summary="wait for city list"),
        drag_point([500, 500], summary="long-press first world city for selection mode"),
        wait(0.8, summary="wait for world-city selection mode"),
        *delete_selected(),
    ]


def browse_alarm_list() -> list[Step]:
    """Open the alarm tab and scroll the list so every alarm card gets on screen."""
    return [
        *open_clock(),
        swipe([500, 820], [500, 260], summary="scroll through alarm list"),
        wait(0.3, summary="wait after scrolling alarm list"),
    ]


def open_world_city_list() -> list[Step]:
    """Open the world clock tab and scroll past the analog clock to the city rows."""
    return [
        *open_world_tab(),
        swipe([500, 850], [500, 250], summary="scroll world clock to city list"),
        wait(0.4, summary="wait for city list"),
    ]


def view_world_city_row(city: str) -> Step:
    """Tap the city row (a no-op outside selection mode) to prove it is visible.

    The row renders the city's current time on the right and the local-time
    difference in its subtitle, so resolving it verifies the queried info is
    actually reachable on screen.
    """
    return click_selector(
        f'div.rounded-2xl:has-text("{city}"):visible',
        summary=f"view {city} row in city list",
    )


def assert_world_city_row(city: str) -> Step:
    """Assert the city row card is on screen (in-viewport hit-test, zero side effects).

    Scoped to the row card (`div.rounded-2xl`) rather than a bare city-name
    text probe, so ancestor containers cannot satisfy the assert.
    """
    return assert_visible(
        f'div.rounded-2xl:has-text("{city}"):visible',
        summary=f"assert {city} row on screen",
    )


PLANS: dict[str, list[Step]] = {
    "clock.ToggleAlarm": [
        *toggle_alarm("{time}"),
        complete(),
    ],
    "clock.CountAlarms": [
        *browse_alarm_list(),
        # The count ("7") never renders on screen — the browse endpoint is the
        # evidence: the last default alarm card (a7, 22:30) proves the list was
        # scrolled to its end before answering.
        assert_visible(alarm_card("22:30"), summary="assert last alarm card 22:30 on screen"),
        *grounded_answer("{answer}", summary="answer alarm count"),
        complete(),
    ],
    "clock.AddAlarm": [
        *add_default_alarm(),
        complete(),
    ],
    "clock.DeleteAlarm": [
        *select_alarm_for_delete(),
        *delete_selected(),
        complete(),
    ],
    "clock.SetAlarmRepeat": [
        *open_alarm_editor("{time}"),
        *set_repeat("{repeatLabel}"),
        save_alarm_sheet(),
        wait(0.6, summary="wait for alarm repeat update"),
        complete(),
    ],
    "clock.AddWorldCity": [
        *add_city("{city}"),
        complete(),
    ],
    "clock.RemoveWorldCity": [
        *remove_first_world_city(),
        complete(),
    ],
    "clock.CheckAlarmNote": [
        # The note renders in the alarm card subtitle ("repeat｜note"); scrolling
        # the list brings the {time} card on screen.
        *browse_alarm_list(),
        assert_answer("{answer}", summary="assert alarm note on screen"),
        *grounded_answer("{answer}", summary="answer alarm note"),
        complete(),
    ],
    "clock.AddAlarmWithSettings": [
        *add_alarm_with_settings(),
        complete(),
    ],
    "clock.EnableAllAlarms": [
        *toggle_alarm("05:00"),
        click_selector(alarm_switch("06:10"), summary="toggle alarm 06:10"),
        click_selector(alarm_switch("06:20"), summary="toggle alarm 06:20"),
        swipe([500, 820], [500, 260], summary="scroll alarm list to late alarm"),
        wait(0.3, summary="wait after scrolling alarm list"),
        click_selector(alarm_switch("22:30"), summary="toggle alarm 22:30"),
        complete(),
    ],
    "clock.CheckCityTime": [
        *open_world_city_list(),
        view_world_city_row("{city}"),
        # Judge time matcher (±5 min) absorbs the render-vs-judge moment drift.
        assert_answer("{answer}", summary="assert {city} time on screen"),
        *grounded_answer("{answer}", summary="answer city time"),
        complete(),
    ],
    "clock.CompareCityTimeDiff": [
        *open_world_city_list(),
        view_world_city_row("{city1}"),
        view_world_city_row("{city2}"),
        # The hour difference ("差N小时") is computed, never rendered on screen —
        # the evidence is both city rows (name + current time) visible together.
        assert_world_city_row("{city1}"),
        assert_world_city_row("{city2}"),
        *grounded_answer("{answer}", summary="answer city time difference"),
        complete(),
    ],
    "clock.CityLocalTimeDiff": [
        # The "快X小时/慢X小时" text renders verbatim in the city row subtitle.
        *open_world_city_list(),
        view_world_city_row("{city}"),
        assert_answer("{answer}", summary="assert local time diff text on screen"),
        *grounded_answer("{answer}", summary="answer local city time difference"),
        complete(),
    ],
    "clock.LatestTimezoneCity": [
        # All four default city rows fit on screen once scrolled to the list.
        *open_world_city_list(),
        # The answer is the winning city's name, rendered in its row title.
        assert_answer("{answer}", summary="assert latest-timezone city on screen"),
        *grounded_answer("{answer}", summary="answer latest timezone city"),
        complete(),
    ],
    "clock.AddCityAndCheckTime": [
        *add_city("{city}"),
        # The selector closes back onto the world tab at its top — scroll past
        # the analog clock so the newly appended row is actually on screen.
        swipe([500, 850], [500, 250], summary="scroll world clock to city list"),
        wait(0.4, summary="wait for city list"),
        assert_world_city_row("{city}"),
        # Judge time matcher (±5 min) absorbs the render-vs-judge moment drift.
        assert_answer("{answer}", summary="assert {city} time on screen"),
        *grounded_answer("{answer}", summary="answer added city time"),
        complete(),
    ],
    "clock.AddCityAndCompareTimeDiff": [
        *add_city("{new_city}"),
        # The selector closes back onto the world tab at its top — scroll past
        # the analog clock so the newly appended row is actually on screen.
        swipe([500, 850], [500, 250], summary="scroll world clock to city list"),
        wait(0.4, summary="wait for city list"),
        # The hour difference ("差N小时") is computed, never rendered on screen —
        # the evidence is the new row plus the existing city row visible together.
        assert_world_city_row("{new_city}"),
        assert_world_city_row("{existing_city}"),
        *grounded_answer("{answer}", summary="answer added city time difference"),
        complete(),
    ],
    "clock.ReorganizeWorldClock": [
        *remove_first_world_city(),
        *add_city("{add_city}"),
        complete(),
    ],
    "clock.SetupMorningAlarms": [
        *add_default_alarm(),
        *add_default_alarm(),
        complete(),
    ],
}
