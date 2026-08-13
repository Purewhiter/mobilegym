"""Scripted validation plans for Clock tasks.

Sampling-compatible (Phase B): plans reference only declared task params or
``DERIVED_PARAMS`` entries computed from the episode's initial state, so the
official ``--agent scripted`` CLI path works without test-injected values.

Key mechanics documented inline:

- **Alarm-row visibility branches** — the alarm list shows rows 0-4 without
  scrolling; rows 5+ need one swipe (after which rows 0-1 leave the screen).
  Tasks targeting a sampled alarm use a ``Branch`` picked from the alarm's
  index in the initial state.
- **Wheel anchor (add-alarm family)** — the add-alarm draft initializes its
  hour/minute wheels to *sim now* at the moment the "+" button is tapped.
  ``wheelWait`` (a derived wait) parks the episode just past a minute boundary
  when the boundary is near, so ``wheelHour0``/``wheelMinute0`` (derived from
  the initial-state timestamp) deterministically equal the draft values.
- **Wheel swipes** — one wheel unit per swipe, ``duration_ms=0`` (all
  scrollBys land within ~1 frame, so the wheel's rounding rAF reads the final
  position once and its value-snap effect realigns scrollTop afterwards) and
  ``delta_y_fraction=0.2`` (≈42 layout px per swipe under the app's 412
  design-viewport zoom — inside the (24,48) px single-crossing band, biased
  high because observed failures are lost crossings, never doubles).
  Measured limits: slow/multi-unit gestures accumulate snap residue and
  drift; even this config can slip ±1 on long journeys when host load delays
  the wheel's React snap commit past the inter-step gap (the next swipe's
  pixels get overwritten). Open-loop plans have no feedback to correct a
  slipped wheel — see the migration report for quantified pass rates.
"""

from __future__ import annotations

import datetime
from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_answer,
    assert_visible,
    awake,
    back,
    complete,
    grounded_answer,
    home,
    long_press_at,
    type_text,
    wait,
    swipe,
)
from bench_env.task.clock.app import CLOCK_REPEAT_VALUES, Clock
from bench_env.task.utils import format_hhmm, now_ms


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


# ---------------------------------------------------------------------------
# Derived params — every calculator reads (task, init_state) only; state["os"]
# carries the simulated clock, state["apps"]["clock"] the judged app state
# (same domain class the judge uses — no disk defaults, no wall clock).
# ---------------------------------------------------------------------------

def _clock(state: dict) -> Clock:
    return Clock(state["apps"]["clock"])


def _alarms(state: dict) -> list[dict]:
    return state["apps"]["clock"]["alarms"]


def _count_alarms(task: Any, state: dict) -> int:
    return len(_alarms(state))


def _last_alarm_time(task: Any, state: dict) -> str:
    last = _alarms(state)[-1]
    return format_hhmm(int(last["hour"]), int(last["minute"]))


def _alarm_note(task: Any, state: dict) -> str:
    alarm = _clock(state).find_alarm_by_id(str(task.p.alarm_id))
    return str(alarm["note"])


def _city_time_answer(task: Any, state: dict) -> str:
    return _clock(state).city_time(str(task.p.city), state["os"])


def _city_pair_diff(task: Any, state: dict) -> int:
    return _clock(state).time_diff_hours(str(task.p.city1), str(task.p.city2))


def _new_pair_diff(task: Any, state: dict) -> int:
    return _clock(state).time_diff_hours(str(task.p.new_city), str(task.p.existing_city))


def _local_diff_text(task: Any, state: dict) -> str:
    """Mirror of ``CityLocalTimeDiff.get_expected_response`` (judge-same-source)."""
    clock = _clock(state)
    diff_minutes = int(clock.find_city(str(task.p.city))["gmtOffsetMinutes"]) - Clock._local_offset_minutes(state["os"])
    if diff_minutes == 0:
        return "一样"
    sign = "快" if diff_minutes > 0 else "慢"
    abs_minutes = abs(diff_minutes)
    hours, minutes = abs_minutes // 60, abs_minutes % 60
    parts = []
    if hours:
        parts.append(f"{hours}小时")
    if minutes:
        parts.append(f"{minutes}分钟")
    return f"{sign}{''.join(parts)}"


def _latest_city(task: Any, state: dict) -> str:
    """Mirror of ``LatestTimezoneCity.get_expected_response`` (first winner on ties)."""
    result = _clock(state).latest_city_name()
    if isinstance(result, str):
        return result
    cities = _clock(state).selected_cities
    max_off = max(int(c["gmtOffsetMinutes"]) for c in cities)
    return next(str(c["name"]) for c in cities if int(c["gmtOffsetMinutes"]) == max_off)


def _repeat_label(param: str) -> Callable[[Any, dict], str]:
    def calc(task: Any, state: dict) -> str:
        value = str(task.params[param])
        for label, val in CLOCK_REPEAT_VALUES.items():
            if val == value:
                return label
        raise ValueError(f"unknown clock repeat value {value!r} for param {param!r}")

    return calc


# ── Add-alarm wheel anchor ──
#
# The draft alarm is created with hour/minute = sim now at the "+" tap. The
# tap happens a few seconds after the initial observation, so a minute
# boundary inside that window would desynchronize the derived wheel origin.
# When the boundary is close, wait past it (landing ~2s in); otherwise the
# settle wait (0.7s) keeps the tap well inside the anchored minute.

_WHEEL_SYNC_THRESHOLD_S = 30.0
_WHEEL_SYNC_LAND_S = 2.0


def _wheel_anchor(state: dict) -> tuple[float, int, int]:
    ts_ms = now_ms(state["os"])
    sec = (ts_ms / 1000.0) % 60.0
    dt = datetime.datetime.fromtimestamp(ts_ms / 1000.0)  # host tz == sim display tz
    if sec <= _WHEEL_SYNC_THRESHOLD_S:
        return 0.7, dt.hour, dt.minute
    minute = dt.minute + 1
    return (60.0 - sec) + _WHEEL_SYNC_LAND_S, (dt.hour + minute // 60) % 24, minute % 60


def _wheel_wait(task: Any, state: dict) -> float:
    return round(_wheel_anchor(state)[0], 1)


def _wheel_hour0(task: Any, state: dict) -> int:
    return _wheel_anchor(state)[1]


def _wheel_minute0(task: Any, state: dict) -> int:
    return _wheel_anchor(state)[2]


_WHEEL_ANCHOR_PARAMS: dict[str, Callable[[Any, dict], Any]] = {
    "wheelWait": _wheel_wait,
    "wheelHour0": _wheel_hour0,
    "wheelMinute0": _wheel_minute0,
}


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict], Any]]] = {
    "clock.CountAlarms": {"answer": _count_alarms, "lastAlarmTime": _last_alarm_time},
    "clock.CheckAlarmNote": {"answer": _alarm_note},
    "clock.SetAlarmRepeat": {"repeatLabel": _repeat_label("repeat")},
    "clock.CheckCityTime": {"answer": _city_time_answer},
    "clock.CompareCityTimeDiff": {"answer": _city_pair_diff},
    "clock.CityLocalTimeDiff": {"answer": _local_diff_text},
    "clock.LatestTimezoneCity": {"answer": _latest_city},
    "clock.AddCityAndCheckTime": {"answer": _city_time_answer},
    "clock.AddCityAndCompareTimeDiff": {"answer": _new_pair_diff},
    "clock.AddAlarm": dict(_WHEEL_ANCHOR_PARAMS),
    "clock.AddAlarmWithSettings": {**_WHEEL_ANCHOR_PARAMS, "repeatLabel": _repeat_label("repeat")},
    "clock.SetupMorningAlarms": {
        **_WHEEL_ANCHOR_PARAMS,
        "repeat1Label": _repeat_label("repeat1"),
        "repeat2Label": _repeat_label("repeat2"),
    },
}


# ---------------------------------------------------------------------------
# Alarm-row visibility branch
# ---------------------------------------------------------------------------

# Rows 0-4 are tappable without scrolling; one list swipe brings rows 2-6 on
# screen (row 0-1 scroll off). Verified against the live viewport (360x800).
_ALARM_SCROLL_FROM_INDEX = 5


def _alarm_row_pick(task: Any, state: dict) -> str:
    target = str(task.p.alarm_id)
    idx = next((i for i, a in enumerate(_alarms(state)) if str(a.get("id")) == target), 0)
    return "scroll" if idx >= _ALARM_SCROLL_FROM_INDEX else "direct"


def _alarm_row_branch(build: Callable[[bool], list[Step]]) -> Branch:
    return Branch(pick=_alarm_row_pick, branches={"direct": build(False), "scroll": build(True)})


# ---------------------------------------------------------------------------
# Navigation / interaction helpers
# ---------------------------------------------------------------------------

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


def scroll_alarm_list() -> list[Step]:
    return [
        swipe([500, 820], [500, 260], summary="scroll alarm list down"),
        wait(0.4, summary="wait after scrolling alarm list"),
    ]


def alarm_card(time_text: str) -> str:
    return f'xpath=//span[normalize-space()="{time_text}"]/ancestor::div[contains(@class,"rounded-2xl")][1]'


def alarm_switch(time_text: str) -> str:
    return f'{alarm_card(time_text)}//button[contains(@class,"rounded-full")]'


def alarm_selection_card(time_text: str) -> str:
    """Alarm row card via its long-press action tag + exact time span."""
    return f'div[data-action="alarm.item.selection.enter"]:has(span:text-is("{time_text}"))'


def new_alarm_edit_button(position: int) -> str:
    """Edit button of the Nth alarm row (1-based). ``saveAlarm`` prepends new
    alarms, so rows 1..k are the k most recently created alarms (newest first)."""
    return (
        f'xpath=(//div[@data-action="alarm.item.selection.enter"])[{position}]'
        f'//button[contains(@class,"text-left")]'
    )


def open_add_alarm_sheet() -> Step:
    return click_selector('xpath=//button[contains(@class,"bottom-[112px]")]', summary="open add alarm sheet")


def open_alarm_editor(time_text: str) -> list[Step]:
    return [
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
        # Scope to the overlay (.z-40) so the alarm editor's repeat summary row
        # behind the sheet (covered -> untappable) never wins the resolution.
        click_selector(f'.z-40 button:has-text("{label}"):visible', summary=f"choose repeat {label}"),
        back(summary="close repeat selector"),
    ]


# ── Wheel steps (see module docstring for the timing/fraction rationale) ──

_WHEEL_DELTA_Y_FRACTION = 0.2


def clock_wheel(zh_label: str, en_label: str) -> str:
    return (
        f'xpath=(//span[normalize-space()="{zh_label}" or normalize-space()="{en_label}"]'
        f'/following-sibling::div[contains(@class,"overflow-y-scroll")])[1]'
    )


def wheel_scroll(selector: str, current: str, target: str, modulo: int, summary: str) -> Step:
    return {
        "op": "wheel_scroll",
        "selector": selector,
        "current": current,
        "target": target,
        "modulo": modulo,
        "max_delta_per_swipe": 1,
        "delta_y_fraction": _WHEEL_DELTA_Y_FRACTION,
        "start_y_fraction": 0.68,
        "reverse_start_y_fraction": 0.32,
        "prefer_reverse_half": modulo == 60,
        "duration_ms": 0,
        "summary": summary,
    }


def set_alarm_wheels(current_hour: str, current_minute: str, hour: str, minute: str) -> list[Step]:
    return [
        wheel_scroll(clock_wheel("时", "H"), current_hour, hour, 24, "set alarm hour"),
        wheel_scroll(clock_wheel("分", "M"), current_minute, minute, 60, "set alarm minute"),
    ]


# ── World clock helpers ──

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


def open_world_city_list() -> list[Step]:
    """Open the world clock tab and scroll past the analog clock to the city rows."""
    return [
        *open_world_tab(),
        swipe([500, 850], [500, 250], summary="scroll world clock to city list"),
        wait(0.4, summary="wait for city list"),
    ]


def world_city_card(city: str) -> str:
    """City row card via its long-press action tag (name rendered in the row)."""
    return f'div[data-action="world.city.selection.enter"]:has-text("{city}")'


def select_world_city(city: str) -> list[Step]:
    """Long-press the city row to enter selection mode with that row selected."""
    return [
        long_press_at(world_city_card(city), summary=f"long-press {city} row for selection mode"),
        wait(0.8, summary="wait for world-city selection mode"),
    ]


def delete_selected() -> list[Step]:
    return [
        click_selector('button:has-text("删除"):visible', summary="delete selected item"),
        wait(0.5, summary="wait for deletion"),
    ]


def remove_world_city(city: str) -> list[Step]:
    return [
        *open_world_city_list(),
        *select_world_city(city),
        *delete_selected(),
    ]


def browse_alarm_list() -> list[Step]:
    """Open the alarm tab and scroll the list so every alarm card gets on screen."""
    return [
        *open_clock(),
        *scroll_alarm_list(),
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


def assert_world_city_row(city: str, *, endorses: list[str] | None = None) -> Step:
    """Assert the city row card is on screen (in-viewport hit-test, zero side effects).

    Scoped to the row card (`div.rounded-2xl`) rather than a bare city-name
    text probe, so ancestor containers cannot satisfy the assert.
    """
    return assert_visible(
        f'div.rounded-2xl:has-text("{city}"):visible',
        summary=f"assert {city} row on screen",
        endorses=endorses,
    )


# ---------------------------------------------------------------------------
# Branch builders (alarm-row visibility)
# ---------------------------------------------------------------------------

def _toggle_alarm_plan(scroll: bool) -> list[Step]:
    # _post_sample forces enabled = (not toggle), so a single switch tap lands
    # on the target state for both toggle values — no on/off branch needed.
    return [
        *open_alarm_tab(),
        *(scroll_alarm_list() if scroll else []),
        click_selector(alarm_switch("{time}"), summary="toggle alarm {time}"),
        wait(0.3, summary="wait for alarm toggle"),
        complete(),
    ]


def _delete_alarm_plan(scroll: bool) -> list[Step]:
    return [
        *open_alarm_tab(),
        *(scroll_alarm_list() if scroll else []),
        long_press_at(alarm_selection_card("{time}"), summary="long-press alarm {time} for selection mode"),
        wait(0.8, summary="wait for alarm selection mode"),
        *delete_selected(),
        complete(),
    ]


def _set_alarm_repeat_plan(scroll: bool) -> list[Step]:
    return [
        *open_alarm_tab(),
        *(scroll_alarm_list() if scroll else []),
        *open_alarm_editor("{time}"),
        *set_repeat("{repeatLabel}"),
        wait(0.3, summary="wait for alarm editor"),
        save_alarm_sheet(),
        wait(0.6, summary="wait for alarm repeat update"),
        complete(),
    ]


def _check_alarm_note_plan(scroll: bool) -> list[Step]:
    # The note renders in the alarm card subtitle ("repeat｜note"); the branch
    # keeps the sampled {time} card on screen when the assert runs.
    return [
        *open_alarm_tab(),
        *(scroll_alarm_list() if scroll else []),
        assert_answer("{answer}", summary="assert alarm note on screen"),
        *grounded_answer("{answer}", summary="answer alarm note"),
        complete(),
    ]


# ---------------------------------------------------------------------------
# Add-alarm family (wheel anchor + trimmed step budget; see module docstring)
# ---------------------------------------------------------------------------

def _enter_add_alarm_sheet() -> list[Step]:
    """Awake -> anchored wait -> "+" with a minimal step budget.

    No home()/tab step: single-app setup leaves Clock foreground on the alarm
    tab (its default route), awake() is the cross-state safety net, and the
    "+" selector wait absorbs app settle. The anchored wait must be the last
    step before the "+" tap (the draft snapshots sim time at that moment).
    """
    return [
        awake("时钟", summary="open Clock"),
        wait("{wheelWait}", summary="settle + align to wheel anchor minute"),
        open_add_alarm_sheet(),
    ]


def _edit_new_alarm(position: int, hour: str, minute: str, repeat_label: str) -> list[Step]:
    """Retime + set repeat of a just-created alarm via its list position.

    The wheels of the quick-edit modal open at the alarm's saved time (the
    anchored creation minute), and 更多设置 hands the current wheel values to
    the full editor, so the wheel origin stays exactly {wheelHour0}:{wheelMinute0}.
    """
    return [
        click_selector(new_alarm_edit_button(position), summary=f"open new alarm #{position} quick editor"),
        click_selector('button:has-text("更多设置"):visible', summary="open full alarm settings"),
        *set_alarm_wheels("{wheelHour0}", "{wheelMinute0}", hour, minute),
        *set_repeat(repeat_label),
        save_alarm_sheet(),
    ]


PLANS: dict[str, list[Step] | Branch] = {
    "clock.ToggleAlarm": _alarm_row_branch(_toggle_alarm_plan),
    "clock.CountAlarms": [
        *browse_alarm_list(),
        # The count never renders on screen — the browse endpoint is the
        # evidence: the last alarm card (derived from the initial state)
        # proves the list was scrolled to its end before answering.
        assert_visible(
            alarm_card("{lastAlarmTime}"),
            summary="assert last alarm card on screen",
            endorses=["answer"],
        ),
        *grounded_answer("{answer}", summary="answer alarm count"),
        complete(),
    ],
    "clock.AddAlarm": [
        # Budget-critical (max_steps=30): 6 fixed steps + one swipe per wheel
        # unit — fits whenever |Δhour| + |Δminute| ≤ 24 (typical anchors; see
        # migration report for the open-loop worst-case limitation).
        *_enter_add_alarm_sheet(),
        *set_alarm_wheels("{wheelHour0}", "{wheelMinute0}", "{hour}", "{minute}"),
        save_alarm_sheet(),
        complete(),
    ],
    "clock.DeleteAlarm": _alarm_row_branch(_delete_alarm_plan),
    "clock.SetAlarmRepeat": _alarm_row_branch(_set_alarm_repeat_plan),
    "clock.AddWorldCity": [
        *add_city("{city}"),
        complete(),
    ],
    "clock.RemoveWorldCity": [
        *remove_world_city("{city}"),
        complete(),
    ],
    "clock.CheckAlarmNote": _alarm_row_branch(_check_alarm_note_plan),
    "clock.AddAlarmWithSettings": [
        *_enter_add_alarm_sheet(),
        *set_alarm_wheels("{wheelHour0}", "{wheelMinute0}", "{hour}", "{minute}"),
        *set_repeat("{repeatLabel}"),
        type_text("{note}", selector='input[placeholder="输入内容"]:visible', clear=True, summary="enter alarm note"),
        save_alarm_sheet(),
        wait(0.5, summary="wait for alarm creation"),
        complete(),
    ],
    "clock.EnableAllAlarms": [
        # No parameter space -> the initial state is always the default alarm
        # set; the four initially-disabled alarms (05:00/06:10/06:20/22:30)
        # are fixed by data, not sampling.
        *open_alarm_tab(),
        click_selector(alarm_switch("05:00"), summary="toggle alarm 05:00"),
        click_selector(alarm_switch("06:10"), summary="toggle alarm 06:10"),
        click_selector(alarm_switch("06:20"), summary="toggle alarm 06:20"),
        *scroll_alarm_list(),
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
        # the evidence is both city rows (name + current time) visible together;
        # the closing assert carries the {answer} endorsement.
        assert_world_city_row("{city1}"),
        assert_world_city_row("{city2}", endorses=["answer"]),
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
        # the evidence is the new row plus the existing city row visible together;
        # the closing assert carries the {answer} endorsement.
        assert_world_city_row("{new_city}"),
        assert_world_city_row("{existing_city}", endorses=["answer"]),
        *grounded_answer("{answer}", summary="answer added city time difference"),
        complete(),
    ],
    "clock.ReorganizeWorldClock": [
        *remove_world_city("{remove_city}"),
        # Deleting exits selection mode and resets the list scroll to the top,
        # where the toolbar 添加 button lives — add_city reopens from there.
        *add_city("{add_city}"),
        complete(),
    ],
    "clock.SetupMorningAlarms": [
        # Both drafts must snapshot the anchored minute, so create the two
        # alarms back-to-back inside the anchor window (both at
        # {wheelHour0}:{wheelMinute0}), then retime them one by one.
        # saveAlarm() prepends: row 1 = second-created, row 2 = first-created,
        # both at the top of the list (no scrolling, position-addressed — safe
        # even when the anchored time text collides with a default alarm's).
        *_enter_add_alarm_sheet(),
        save_alarm_sheet(),
        open_add_alarm_sheet(),
        save_alarm_sheet(),
        wait(0.5, summary="wait for alarm creation"),
        *_edit_new_alarm(1, "{h2}", "{m2}", "{repeat2Label}"),
        *_edit_new_alarm(2, "{h1}", "{m1}", "{repeat1Label}"),
        complete(),
    ],
}
