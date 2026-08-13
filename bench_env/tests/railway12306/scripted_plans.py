"""Scripted validation plans for Railway 12306 tasks.

Sampling compatibility (``DERIVED_PARAMS``): every plan placeholder that is
not a declared task parameter (``answer*``, ``area_code``, ``city*``,
``verify_status``, ``return_*``, ``train_no``, ``date_day``, and ``date`` for
the tomorrow-fixed tasks) is computed at materialization time from the
episode's post-setup initial state, judge-homologously:

- **App-state values** go through the same ``Railway12306`` domain class the
  judges use — calculators build
  ``Railway12306(init_state["apps"]["railway12306"])`` exactly like judges
  build ``Railway12306(input.apps_init["railway12306"])``: passenger count /
  default-passenger name, student-verify route, trip cities, my-ticket
  train/price lookups, ``user.realNameVerified``, the latest-ticket return
  route, and the ``servicePhones`` area code (constants merged into the app
  state at store creation, present in ``apps_init`` just like the judge's
  ``.servicePhones[region={region}].areaCode`` path expects).
- **Train-schedule (catalog) values** import the judge module's own catalog
  helpers (``_catalog_route_candidates`` / ``_catalog_available_trains`` +
  ``Railway12306._pick_catalog_train``). The query-answer judges
  (``pick_trains``) read the *final* ``queryState.directTrains``, which the
  frontend renders from the same ``trainCatalog.json`` — that equivalence is
  regression-tested by the live suite. Seat availability is deterministic:
  ``_catalog_available_trains`` is the Python mirror of the frontend
  availabilityGenerator PRNG (fnv1a + mulberry32) seeded off *sim-today*, so
  the derived ``train_no`` / ``return_train`` picks are exactly the trains
  the UI marks bookable. Caveat: ``_pick_catalog_train``'s ``fastest`` key
  parses "H小时M分" durations and would crash on the catalog's "HH:MM"
  ``lishi`` field — ``_route_pick`` below parses HH:MM itself with the same
  tie-breaks (duration, then departure, then train code).
- **Dates**: tasks whose judge pins "tomorrow" (``tomorrow_ymd(input.os_init)``)
  derive ``{date}`` / ``{date_day}`` from the initial os time — never from
  the wall clock, so scenario-shifted sim time stays consistent.

Explicitly injected params always win over these calculators;
``test_scripted.py`` deliberately injects declared parameters only, so live
runs exercise this derivation path end to end.

Restricted ``Branch`` plans:

- ``OpenInvoice``: the add-header switch defaults to ON
  (AddInvoiceHeaderPage ``useState(true)``); the declared bool param
  ``make_default`` picks whether to tap it off — the two static arms differ
  by exactly that one tap.
- ``CheckRecentTripCities``: the repeatable answer sheet needs one row per
  unique city, and the default orders yield 3 from-cities but only 2
  to-cities; the pure pick sizes the static arm by the judge-homologous
  ``unique_trip_cities(direction)`` count.
- ``BuyTicketForPassenger`` / ``BuyTicketsForTwoPassengers`` /
  ``BuyTicketForNewPassenger`` / ``BuyReturnTicketFromLatestOrder``: the env
  never scrolls implicitly, but the sampled route/preference moves the target
  train card around the results list (e.g. 广州→深圳 earliest G6501 sits
  behind 7 C-train cards; latest targets live at the list tail until one tap
  on the 发时最早 sort button flips the order). The pure pick computes the
  target's index in the UI ordering mirror and selects sort-direction ×
  scroll-bucket arms (``_booking_locate_pick`` / ``_return_locate_pick``).

Hardcode exemptions (audited, deliberately not parameterized):

- ``CheckPassengerCount`` evidence anchors 赵宇轩/周子涵: the task declares no
  parameters and no sampler mutates ``passengers``, so the list is the static
  defaults; the head anchor is the default passenger, while the tail anchor
  depends on the frontend's pinyin group ordering, which bench cannot derive
  judge-homologously. These are B-type evidence asserts, not answer values.
- ``OpenInvoice`` tax number ``91310000MA1K000000``: required form input the
  judge never checks (criteria covers name / isDefault / invoiceEmail only).
- ``submit_order`` / service-grid swipe coordinates and the bilingual
  placeholder selectors are geometry / i18n facts, not task data.

Date-picker note: DateSelectPage renders the current + next month as full
grids where past / beyond-presale cells keep ``cursor-pointer`` and merely
append ``cursor-not-allowed``; ``date_cell`` therefore excludes disabled
cells, and within the 15-day selectable window a day number is unique, so
first-match stays safe even when the target date falls in the next month.
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_answer,
    assert_text,
    awake,
    back,
    complete,
    grounded_answer,
    grounded_answer_repeatable,
    home,
    swipe,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.task.railway12306.app import (
    Railway12306,
    _catalog_available_trains,
    _catalog_route_candidates,
)
from bench_env.task.utils import normalize_price, sim_today, tomorrow_ymd


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def open_railway() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("铁路12306", summary="launch Railway 12306"),
        wait(0.8, summary="wait for Railway 12306 home"),
    ]


def train_card(train_no: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'xpath=(//div[contains(@class,"rounded-lg") and contains(@class,"shadow-sm") '
        f'and .//span[normalize-space()="{train_no}"]]//div[contains(@class,"w-[66px]")])[1]',
        summary=summary or f"expand train {train_no}",
    )


def visible_button(text: str, *, summary: str | None = None) -> Step:
    return click_selector(f'button:has-text("{text}"):visible', summary=summary or f"tap {text}")


def station_result(name: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'xpath=(//div[contains(@class,"cursor-pointer") and ./span[1][normalize-space()="{name}"]])[1]',
        summary=summary or f"select station {name}",
    )


def passenger_row(name: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'xpath=(//div[contains(@class,"border-b") and contains(@class,"items-center") '
        f'and .//span[normalize-space()="{name}"]])[1]',
        summary=summary or f"select passenger {name}",
    )


def passenger_done(*, summary: str = "confirm selected passengers") -> Step:
    return click_selector(
        'xpath=(//button[normalize-space()="完成" or normalize-space()="Done" '
        'or .//*[normalize-space()="完成" or normalize-space()="Done"]])[1]',
        summary=summary,
    )


def date_cell(date_value: str, *, summary: str | None = None) -> Step:
    """Tap a selectable calendar day cell by its day-of-month number.

    The calendar renders the current + next month as full grids; past /
    beyond-presale cells stay in the DOM with ``cursor-pointer`` plus an
    appended ``cursor-not-allowed`` (tap is a silent no-op). Excluding
    disabled cells makes first-match safe: the 15-day selectable window
    cannot contain the same day number twice, so a next-month target can
    never be shadowed by the current month's (disabled) same-number cell.
    """
    day = "{date_day}" if "{" in date_value else str(int(date_value.rsplit("-", 1)[1]))
    return click_selector(
        f'xpath=(//div[contains(@class,"cursor-pointer") and not(contains(@class,"cursor-not-allowed")) '
        f'and .//span[normalize-space()="{day}"]])[1]',
        summary=summary or f"select date {date_value}",
    )


def select_station(trigger_id: str, station: str) -> list[Step]:
    """No transition waits: station search filters locally/synchronously and
    every follow-up step addresses by selector, which the env resolves with
    its own visibility wait (``_resolve_selector_point``, 8s) — keeping
    ``query_route`` inside the L3 45-step budget for the booking plans."""
    return [
        tap_trigger(trigger_id, summary=f"open station picker for {station}"),
        type_text(station, selector="input:visible", clear=True, summary=f"search station {station}"),
        station_result(station),
    ]


def select_date(date_value: str) -> list[Step]:
    return [
        tap_trigger("home.dateSelect", summary=f"open date picker for {date_value}"),
        date_cell(date_value),
    ]


def query_route(from_station: str, to_station: str, date_value: str) -> list[Step]:
    return [
        *open_railway(),
        *select_station("home.stationSelect.from", from_station),
        *select_station("home.stationSelect.to", to_station),
        *select_date(date_value),
        tap_trigger("home.queryResult", summary="query train tickets"),
        wait(1.5, summary="wait for train results"),
    ]


def open_my_account() -> list[Step]:
    return [
        *open_railway(),
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("my.account", summary="open account page"),
        wait(0.3, summary="wait for account page"),
    ]


def open_passenger_manager() -> list[Step]:
    return [
        *open_railway(),
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("my.passengers", summary="open passenger manager"),
        wait(0.3, summary="wait for passenger list"),
    ]


def open_my_tickets() -> list[Step]:
    return [
        *open_railway(),
        tap_trigger("tab.orders", summary="open Orders tab"),
        tap_trigger("orders.myTickets", summary="open my tickets page"),
        wait(0.5, summary="wait for my tickets list"),
    ]


def choose_passenger(name: str) -> list[Step]:
    """The 完成 tap returns to the order confirm page; the next step is a
    coordinate swipe (state-insensitive), so no settle wait is needed."""
    return [
        passenger_row(name, summary=f"select passenger {name}"),
        passenger_done(),
    ]


def reveal_passenger_list() -> Step:
    """Clamped inertia-free scroll to the bottom of the passenger selector.

    The select-mode list renders passengers in raw store order (no pinyin
    grouping — that exists only in manage mode), and the viewport cannot show
    all 9 default rows at once: unscrolled, the tail rows (e.g. sampled
    吴明德/周子涵) hide behind the fixed confirm bar; scrolled to the bottom,
    the head rows (e.g. the default passenger 赵宇轩) hide behind the sticky
    title bar. Plans therefore bucket by the target's judge-homologous list
    index (``_passenger_bucket``) and only emit this scroll for below-fold
    targets — the env never scrolls implicitly.
    """
    return {
        "op": "swipe",
        "point1": [500, 720],
        "point2": [500, 300],
        "inertia": False,
        "summary": "scroll passenger selector to bottom (clamped)",
    }


def reveal_seat_panel() -> Step:
    """Small inertia-free scroll after expanding a train card so the whole
    seat panel clears the bottom sort bar — a mid-viewport card (scroll1
    bucket targets) otherwise hides its lower seat rows (e.g. 一等 on
    广州→深圳 G6501), while a top-of-list card just shifts up harmlessly
    (clamped when the list is short)."""
    return {
        "op": "swipe",
        "point1": [500, 700],
        "point2": [500, 450],
        "inertia": False,
        "summary": "scroll expanded train card to reveal seat panel",
    }


def submit_order() -> list[Step]:
    return [
        swipe([500, 720], [500, 280], summary="scroll order confirmation toward submit button"),
        wait(0.2, summary="wait after order confirmation scroll"),
        swipe([500, 720], [500, 280], summary="scroll order confirmation to submit button"),
        visible_button("提交订单", summary="submit order"),
        wait(1.5, summary="wait for pending order page"),
    ]


def locate_train_steps(*, sort_latest: bool, scrolls: int) -> list[Step]:
    """Bring the target train card into the viewport before tapping it.

    The env never scrolls implicitly (scripted trajectories are ground-truth
    action traces), and the results list can hold the target G train behind
    slower C/D/K departures — e.g. 广州→深圳 earliest G6501 sits at index 7
    behind 7 intercity C trains. The Branch pick computes the target's index
    in the UI ordering mirror (``_ui_train_index``) and selects:

    - ``sort_latest``: one tap on the 发时最早 sort-bar button switches the
      list to depart-descending (the frontend toggles asc → desc), so a
      latest-preference target moves to the head of the list;
    - ``scrolls``: controlled swipes for targets beyond the ~4 cards visible
      under the sticky header. ``inertia=False`` is essential: the sim's
      default swipe adds a ~450ms inertia tail (~700 css px total) that
      overshoots a bucket-4..7 target right past the top edge; the inertia-free
      drag scrolls the geometric 400 css px ≈ 4 collapsed cards exactly.
    """
    steps: list[Step] = []
    if sort_latest:
        steps.append(visible_button("发时最早", summary="switch sort to latest departure first"))
        steps.append(wait(0.3, summary="wait for list to re-sort descending"))
    for i in range(scrolls):
        steps.append(
            {
                "op": "swipe",
                "point1": [500, 750],
                "point2": [500, 250],
                "inertia": False,
                "summary": f"scroll results toward target train {i + 1}/{scrolls}",
            }
        )
    return steps


def book_visible_train(train_no: str, seat_type: str, passenger_name: str) -> list[Step]:
    """Legacy book flow kept verbatim for cross-suite imports
    (``bench_env/tests/crossapp_life/scripted_plans.py``). railway12306's own
    plans use ``book_located_train`` instead, which adds the sort/scroll
    locate arms and drops the fixed sleeps that selector waits already cover.
    """
    return [
        train_card(train_no),
        click_selector(
            f'[data-trigger="trainDetail.book"][data-trigger-params*=\'"seat":"{seat_type}"\']:visible',
            summary=f"book {seat_type} on {train_no}",
        ),
        wait(0.5, summary="wait for order confirm page"),
        tap_trigger("orderConfirm.passengers", summary="open passenger selector"),
        wait(0.4, summary="wait for passenger selector"),
        passenger_row(passenger_name, summary=f"select passenger {passenger_name}"),
        passenger_done(),
        wait(0.4, summary="wait for order confirm"),
        *submit_order(),
    ]


def book_located_train(
    train_no: str,
    seat_type: str,
    passenger_name: str,
    *,
    sort_latest: bool,
    scrolls: int,
    passenger_scroll: bool,
) -> list[Step]:
    """Locate the target card, expand it, book the seat, pick the passenger,
    submit. The order-confirm / passenger-selector transitions rely on the
    next step's selector wait instead of fixed sleeps (step budget: the
    new-passenger variant peaks at 44 of the L3 45-step cap)."""
    return [
        *locate_train_steps(sort_latest=sort_latest, scrolls=scrolls),
        train_card(train_no),
        reveal_seat_panel(),
        click_selector(
            f'[data-trigger="trainDetail.book"][data-trigger-params*=\'"seat":"{seat_type}"\']:visible',
            summary=f"book {seat_type} on {train_no}",
        ),
        tap_trigger("orderConfirm.passengers", summary="open passenger selector"),
        wait(0.4, summary="wait for passenger selector"),
        *([reveal_passenger_list()] if passenger_scroll else []),
        *choose_passenger(passenger_name),
        *submit_order(),
    ]


def add_new_passenger(name: str, id_no: str, phone: str) -> list[Step]:
    return [
        tap_trigger("passengers.addPassenger", summary="open add passenger page"),
        wait(0.3, summary="wait for add passenger page"),
        type_text(name, selector="input:visible >> nth=0", clear=True, summary=f"enter passenger name {name}"),
        type_text(id_no, selector="input:visible >> nth=1", clear=True, summary="enter passenger ID"),
        back(summary="dismiss keyboard before passenger phone"),
        swipe([500, 720], [500, 330], summary="scroll add passenger form to phone field"),
        wait(0.2, summary="wait after scrolling to phone field"),
        type_text(
            phone,
            selector=(
                'input[placeholder="填写乘车人手机号码"]:visible, '
                'input[placeholder="Enter passenger mobile number"]:visible'
            ),
            clear=True,
            summary="enter passenger phone",
        ),
        back(summary="dismiss keyboard before submitting passenger form"),
        visible_button("提交", summary="submit passenger form"),
        wait(0.3, summary="wait for passenger confirmation dialog"),
        visible_button("确定", summary="confirm new passenger"),
        wait(0.5, summary="wait for passenger selector"),
    ]


def _answer_field_input(index: int) -> str:
    """AnswerSheet 第 index 个（0-based）字段块的输入框（同 scripted._answer_sheet_input）。"""
    return f'[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child({index + 1}) input'


def grounded_answer_four_fields(v1: str, v2: str, v3: str, v4: str, *, summary: str) -> list[Step]:
    """四字段答题卡：填最后一个字段前先收起键盘。

    键盘弹出后 adjustResize 压缩答题卡容器，第 4 个字段块会落到键盘下方，
    tap 命中失败（live 稳定复现）；中途 back 收键盘（BackDispatcher 键盘
    优先级高于 App，不会退出答题卡），让末字段在完整布局下解析。
    """
    return [
        home(summary="return to launcher"),
        awake("答题卡", summary="open AnswerSheet app"),
        wait(0.8, summary="wait for answer sheet UI"),
        type_text(v1, selector=_answer_field_input(0), clear=True, summary=f"fill answer field 0: {v1!r}"),
        type_text(v2, selector=_answer_field_input(1), clear=True, summary=f"fill answer field 1: {v2!r}"),
        type_text(v3, selector=_answer_field_input(2), clear=True, summary=f"fill answer field 2: {v3!r}"),
        back(summary="dismiss keyboard before last answer field"),
        type_text(v4, selector=_answer_field_input(3), clear=True, summary=f"fill answer field 3: {v4!r}"),
        back(summary="dismiss keyboard to show submit bar"),
        click_selector(
            'div[data-hide-on-keyboard] button.w-full.bg-blue-500:visible',
            summary=summary,
        ),
    ]


def answer_choice(value: str, *, summary: str) -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("答题卡", summary="open AnswerSheet app"),
        wait(0.8, summary="wait for answer sheet UI"),
        click_selector(
            f'xpath=(//div[@data-scroll-container="sheet-form"]//button[normalize-space()="{value}"])[1]',
            summary=f"select answer choice {value}",
        ),
        click_selector(
            'div[data-hide-on-keyboard] button.w-full.bg-blue-500:visible',
            summary=summary,
        ),
    ]


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (answer paths / get_answer /
# check_goals in bench_env/task/railway12306/tasks.py) through the same
# Railway12306 domain class / catalog helpers over the same initial state,
# so the typed/asserted values are judge-homologous by construction.

def _rail(state: dict[str, Any]) -> Railway12306:
    """Judge-homologous accessor: ``Railway12306(init_state["apps"]["railway12306"])``."""
    return Railway12306(state["apps"]["railway12306"])


def _sim_today_str(state: dict[str, Any]) -> str:
    """Sim-today ISO date — the same os-time source judges feed to the
    availability PRNG (never the wall clock)."""
    return sim_today(state.get("os") or {}).isoformat()


def _tomorrow(state: dict[str, Any]) -> str:
    """Mirror the judges' ``tomorrow_ymd(input.os_init)``."""
    return tomorrow_ymd(state.get("os") or {})


def _day_of(date_value: Any) -> str:
    """Day-of-month digits for the ``{date_day}`` calendar-cell placeholder."""
    return str(int(str(date_value).rsplit("-", 1)[1]))


def _hhmm_minutes(value: str) -> int:
    """Catalog ``lishi`` / ``startTime`` are "HH:MM" — parse to minutes."""
    hour, minute = str(value).split(":", 1)
    return int(hour) * 60 + int(minute)


def _duration_label(lishi: str) -> str:
    """Catalog "HH:MM" duration → the "H小时M分" text the UI renders and the
    judge's ``match_duration`` parses."""
    minutes = _hhmm_minutes(lishi)
    return f"{minutes // 60}小时{minutes % 60}分"


def _route_pick(from_station: str, to_station: str, pref: str) -> dict[str, Any]:
    """Pick from the full schedule candidates (all train types, sold-out
    included) — the same population ``pick_trains`` sees in the final
    ``directTrains``. Tie-breaks match ``Railway12306._pick_catalog_train``;
    ``fastest`` re-implements the duration key because the catalog's
    ``lishi`` is "HH:MM", not the "H小时M分" that helper expects."""
    trains = list(_catalog_route_candidates(str(from_station), str(to_station), False))
    if not trains:
        raise ValueError(f"no catalog trains for route {from_station}->{to_station}")

    def _start(train: dict[str, Any]) -> int:
        return Railway12306.parse_hhmm(str(train["startTime"]))

    if pref == "earliest":
        return min(trains, key=lambda t: (_start(t), str(t["trainCode"])))
    if pref == "latest":
        return min(trains, key=lambda t: (-_start(t), str(t["trainCode"])))
    if pref == "fastest":
        return min(trains, key=lambda t: (_hhmm_minutes(str(t["lishi"])), _start(t), str(t["trainCode"])))
    raise ValueError(f"unknown route pick preference: {pref!r}")


def _bookable_pick(
    state: dict[str, Any],
    from_station: Any,
    to_station: Any,
    date: Any,
    schedule_pref: Any,
) -> dict[str, Any]:
    """The booking judges' target train: high-speed candidates filtered by the
    deterministic availability PRNG for sim-today/date, then picked by
    ``schedule_pref`` — the same chain ``inspect_booking_target`` resolves
    against the final UI state."""
    trains = list(
        _catalog_available_trains(
            _sim_today_str(state), str(from_station), str(to_station), str(date), True
        )
    )
    picked = Railway12306._pick_catalog_train(trains, str(schedule_pref))
    if picked is None:
        raise ValueError(
            f"no bookable catalog train for {from_station}->{to_station} "
            f"on {date} (pref={schedule_pref!r})"
        )
    return picked


def _ui_train_index(
    state: dict[str, Any],
    from_station: Any,
    to_station: Any,
    date: Any,
    schedule_pref: Any,
) -> int:
    """0-based index of the booking target inside the UI results list mirror.

    The UI renders every route candidate (all train types, sold-out included)
    sorted by ``departTime`` with a *stable* sort (``localeCompare`` on
    zero-padded HH:MM ≡ numeric order); a latest-preference plan first flips
    the sort to descending, so the mirror sorts the same way. The target
    itself is the judge-homologous ``_bookable_pick``. Duplicate train codes
    (same code on several catalog segments of the route) are fine: the plan's
    ``train_card`` xpath taps the first same-code card, and the judge compares
    orders by train code / city-level stations only — so the first index is
    exactly the card the plan will tap.
    """
    target = str(_bookable_pick(state, from_station, to_station, date, schedule_pref)["trainCode"])
    cands = list(_catalog_route_candidates(str(from_station), str(to_station), False))
    if str(schedule_pref) == "latest":
        ordered = sorted(cands, key=lambda t: -_hhmm_minutes(str(t["startTime"])))
    else:
        ordered = sorted(cands, key=lambda t: _hhmm_minutes(str(t["startTime"])))
    for index, train in enumerate(ordered):
        if str(train["trainCode"]) == target:
            return index
    raise ValueError(
        f"target train {target!r} not in route candidates {from_station}->{to_station}"
    )


def _locate_bucket(index: int) -> str:
    """Scroll bucket for a results-list index: ~4 collapsed cards fit under
    the sticky header, one full swipe advances ~4 cards. Deeper targets than
    one swipe (index > 7) do not occur on the sampled hot routes — the pick
    then returns an undeclared branch key and materialization fails loudly
    (extend with a scroll2 arm if the catalog ever changes)."""
    if index <= 3:
        return "direct"
    if index <= 7:
        return "scroll1"
    return f"deep{index}"


def _passenger_index(state: dict[str, Any], name: Any) -> int:
    """Row index of ``name`` in the select-mode passenger list, which renders
    ``init_state`` passengers in raw store order (judge-homologous data, no
    pinyin grouping in select mode)."""
    for index, passenger in enumerate(state["apps"]["railway12306"]["passengers"]):
        if str(passenger.get("name")) == str(name):
            return index
    raise ValueError(f"passenger {name!r} not in initial passengers list")


# Rows 0..4 are tappable without scrolling (below the sticky header, above
# the fixed confirm bar); rows 5+ need the clamped bottom-scroll, after which
# the head rows hide behind the sticky header — hence the bucket split.
_PASSENGER_TOP_MAX_INDEX = 4


def _passenger_bucket(index: int) -> str:
    return "ptop" if index <= _PASSENGER_TOP_MAX_INDEX else "pbot"


def _booking_locate_pick(task: Any, state: dict[str, Any]) -> str:
    """Pure Branch pick for single-passenger BuyTicket* plans: sort direction
    from the declared ``schedule_pref``, scroll bucket from the
    judge-homologous target train's UI list index, passenger bucket from the
    target row's position in the selector list."""
    pref = "latest" if str(task.p.schedule_pref) == "latest" else "earliest"
    index = _ui_train_index(
        state, task.p.from_station, task.p.to_station, task.p.date, task.p.schedule_pref
    )
    passenger = _passenger_bucket(_passenger_index(state, task.p.name))
    return f"{pref}_{_locate_bucket(index)}_{passenger}"


def _two_passengers_pick(task: Any, state: dict[str, Any]) -> str:
    """Pure Branch pick for BuyTicketsForTwoPassengers: both rows above the
    fold → tap both; both below → scroll then tap both; split → tap the top
    row, scroll, tap the bottom row (placeholders ``{p_top}`` / ``{p_bottom}``
    order the two names by list index; selection is an order-insensitive
    toggle and the judge compares name sets)."""
    pref = "latest" if str(task.p.schedule_pref) == "latest" else "earliest"
    index = _ui_train_index(
        state, task.p.from_station, task.p.to_station, task.p.date, task.p.schedule_pref
    )
    low, high = sorted(
        (_passenger_index(state, task.p.name), _passenger_index(state, task.p.name2))
    )
    if high <= _PASSENGER_TOP_MAX_INDEX:
        passenger = "ptop"
    elif low > _PASSENGER_TOP_MAX_INDEX:
        passenger = "pbot"
    else:
        passenger = "psplit"
    return f"{pref}_{_locate_bucket(index)}_{passenger}"


def _ordered_passenger_pair(task: Any, state: dict[str, Any]) -> tuple[str, str]:
    """(top_name, bottom_name) — name/name2 ordered by selector list index."""
    pair = sorted(
        (str(task.p.name), str(task.p.name2)),
        key=lambda name: _passenger_index(state, name),
    )
    return pair[0], pair[1]


def _return_locate_pick(task: Any, state: dict[str, Any]) -> str:
    """Pure Branch pick for BuyReturnTicketFromLatestOrder: same bucket logic
    over the derived return route (earliest preference, tomorrow)."""
    return_from, return_to = _return_route(state)
    index = _ui_train_index(state, return_from, return_to, _tomorrow(state), "earliest")
    return _locate_bucket(index)


def _service_area_code(task: Any, state: dict[str, Any]) -> str:
    """Mirror the ``.servicePhones[region={region}].areaCode`` answer path."""
    region = str(task.p.region)
    for row in state["apps"]["railway12306"].get("servicePhones") or []:
        if str(row.get("region")) == region:
            return str(row["areaCode"])
    raise ValueError(f"servicePhones has no entry for region {region!r}")


def _trip_city(index: int) -> Callable[[Any, dict[str, Any]], str]:
    """City at ``index`` of the judge's ``unique_trip_cities(direction)``.

    Calculators run unconditionally for every DERIVED_PARAMS key, so an
    out-of-range index (e.g. ``city3`` when direction="to" yields 2 cities)
    returns "" — the two_cities Branch arm never references that placeholder.
    """

    def calc(task: Any, state: dict[str, Any]) -> str:
        cities = _rail(state).unique_trip_cities(str(task.p.direction))
        return str(cities[index]) if index < len(cities) else ""

    return calc


def _return_route(state: dict[str, Any]) -> tuple[str, str]:
    """Mirror BuyReturnTicketFromLatestOrder.check_goals: the return trip
    swaps the latest my-ticket's stations, reduced to city names."""
    ticket = _rail(state).my_latest_ticket
    return (
        Railway12306._station_to_city(str(ticket["toStation"])),
        Railway12306._station_to_city(str(ticket["fromStation"])),
    )


def _return_train(task: Any, state: dict[str, Any]) -> str:
    """Earliest bookable high-speed train on tomorrow's return route — the
    judge accepts any train (no expected_train_no), but the plan must expand
    a card the availability PRNG actually marks bookable."""
    return_from, return_to = _return_route(state)
    return str(_bookable_pick(state, return_from, return_to, _tomorrow(state), "earliest")["trainCode"])


def _my_ticket_price_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror CheckTicketPriceByDate.get_answer: sum + normalize_price."""
    tickets = _rail(state).my_tickets_on_date(str(task.p.date))
    return str(normalize_price(sum(float(t["price"]) for t in tickets)))


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "railway12306.OpenServicePhone": {"area_code": _service_area_code},
    "railway12306.CheckPassengerCount": {
        "answer": lambda task, state: str(len(_rail(state).passengers)),
    },
    "railway12306.CheckDefaultPassengerName": {
        "answer": lambda task, state: str(_rail(state).get_default_passenger()["name"]),
    },
    "railway12306.CheckStudentVerify": {
        "answer_from": lambda task, state: str(_rail(state).student_verify["from"]),
        "answer_to": lambda task, state: str(_rail(state).student_verify["to"]),
    },
    "railway12306.CheckRecentTripCities": {
        "city1": _trip_city(0),
        "city2": _trip_city(1),
        "city3": _trip_city(2),
    },
    "railway12306.CheckIdVerificationStatus": {
        # Mirror check_goals: expected = apps_init user.realNameVerified;
        # the two labels are exactly the answer_fields choice options.
        "verify_status": lambda task, state: (
            "核验成功" if _rail(state).real_name_verified else "未通过核验"
        ),
    },
    "railway12306.BuyReturnTicketFromLatestOrder": {
        "return_from": lambda task, state: _return_route(state)[0],
        "return_to": lambda task, state: _return_route(state)[1],
        "date": lambda task, state: _tomorrow(state),
        "date_day": lambda task, state: _day_of(_tomorrow(state)),
        "return_train": _return_train,
        "name": lambda task, state: str(_rail(state).user_name),
    },
    "railway12306.FindTrainByDate": {
        # Mirror get_answer: my_tickets_on_date(date)[0]["trainNo"].
        "answer": lambda task, state: str(
            _rail(state).my_tickets_on_date(str(task.p.date))[0]["trainNo"]
        ),
    },
    "railway12306.CheckTicketPriceByDate": {"answer": _my_ticket_price_answer},
    "railway12306.QueryAndCheckRoute": {
        # The task template says 明天; the judge pins tomorrow_ymd(os_init).
        "date": lambda task, state: _tomorrow(state),
        "date_day": lambda task, state: _day_of(_tomorrow(state)),
        "answer_train": lambda task, state: str(
            _route_pick(task.p.from_station, task.p.to_station, "latest")["trainCode"]
        ),
    },
    "railway12306.BuyTicketForPassenger": {
        "date_day": lambda task, state: _day_of(task.p.date),
        "train_no": lambda task, state: str(
            _bookable_pick(
                state, task.p.from_station, task.p.to_station, task.p.date, task.p.schedule_pref
            )["trainCode"]
        ),
    },
    "railway12306.BuyTicketsForTwoPassengers": {
        "date_day": lambda task, state: _day_of(task.p.date),
        "train_no": lambda task, state: str(
            _bookable_pick(
                state, task.p.from_station, task.p.to_station, task.p.date, task.p.schedule_pref
            )["trainCode"]
        ),
        # name/name2 ordered by selector-list row index — the split arm taps
        # the above-fold row before scrolling (selection is a toggle; the
        # judge compares the ticket name *set*).
        "p_top": lambda task, state: _ordered_passenger_pair(task, state)[0],
        "p_bottom": lambda task, state: _ordered_passenger_pair(task, state)[1],
    },
    "railway12306.BuyTicketForNewPassenger": {
        "date_day": lambda task, state: _day_of(task.p.date),
        "train_no": lambda task, state: str(
            _bookable_pick(
                state, task.p.from_station, task.p.to_station, task.p.date, task.p.schedule_pref
            )["trainCode"]
        ),
    },
    "railway12306.QueryFastestTrainDetails": {
        "date_day": lambda task, state: _day_of(task.p.date),
        "answer_train": lambda task, state: str(
            _route_pick(task.p.from_station, task.p.to_station, "fastest")["trainCode"]
        ),
        "answer_duration": lambda task, state: _duration_label(
            str(_route_pick(task.p.from_station, task.p.to_station, "fastest")["lishi"])
        ),
        "answer_from": lambda task, state: str(
            _route_pick(task.p.from_station, task.p.to_station, "fastest")["fromStation"]
        ),
        "answer_arrive": lambda task, state: str(
            _route_pick(task.p.from_station, task.p.to_station, "fastest")["arriveTime"]
        ),
    },
}


# ---------------------------------------------------------------------------
# Branch plan builders
# ---------------------------------------------------------------------------

def _open_invoice_branch(*, turn_off_default: bool) -> list[Step]:
    """Add an invoice header and set the invoice email; the add-header form's
    设为默认抬头 switch defaults to ON, so only the make_default=False arm
    taps it off."""
    steps: list[Step] = [
        *open_railway(),
        tap_trigger("tab.orders", summary="open Orders tab"),
        tap_trigger("orders.invoice", summary="open invoice page"),
        tap_trigger("invoice.invoiceHeaders", summary="open invoice header manager"),
        tap_trigger("invoice.addHeader", summary="open add invoice header"),
        type_text("{name}", selector="input:visible >> nth=0", clear=True, summary="enter invoice header name"),
        type_text("91310000MA1K000000", selector="input:visible >> nth=1", clear=True, summary="enter tax number"),
    ]
    if turn_off_default:
        steps.append(
            click_selector(
                'xpath=(//span[normalize-space()="设为默认抬头" or normalize-space()="Set as default"]/following-sibling::button)[1]',
                summary="turn off default invoice header switch",
            )
        )
    steps += [
        visible_button("保存", summary="save invoice header"),
        wait(0.4, summary="wait after saving invoice header"),
        back(summary="return to invoice home"),
        tap_trigger("invoice.emailSettings", summary="open invoice email settings"),
        type_text("{email}", selector="input:visible", clear=True, summary="enter invoice email"),
        visible_button("保存", summary="save invoice email"),
        wait(0.3, summary="wait for email success dialog"),
        visible_button("确定", summary="confirm email saved"),
        complete(),
    ]
    return steps


def _recent_trip_cities_branch(city_count: int) -> list[Step]:
    """Browse my tickets, then answer one repeatable row per unique city.

    车票卡片显示站名（如「杭州东」），答案是城市名（「杭州」）——判分 matcher
    的规整化包含恰好覆盖 城市名 ⊂ 站名；各城市逐一断言（repeatable 字段共用
    index 0）。
    """
    placeholders = [f"{{city{i}}}" for i in range(1, city_count + 1)]
    steps: list[Step] = [
        *open_my_tickets(),
        swipe([500, 720], [500, 280], summary="scroll my tickets to browse all recent trips"),
        wait(0.3, summary="wait after tickets scroll"),
    ]
    steps += [
        assert_answer(
            placeholder,
            field_index=0,
            summary=f"assert trip city {i} on my tickets list",
        )
        for i, placeholder in enumerate(placeholders, start=1)
    ]
    steps += [
        *grounded_answer_repeatable(*placeholders, summary="answer recent trip cities"),
        complete(),
    ]
    return steps


def _recent_trip_cities_pick(task: Any, state: dict[str, Any]) -> str:
    """Pure pick: arm size = judge-homologous unique-city count. An
    unsupported count returns a key outside ``branches`` — materialization
    then fails loudly instead of answering with a wrong row count."""
    count = len(_rail(state).unique_trip_cities(str(task.p.direction)))
    return {2: "two_cities", 3: "three_cities"}.get(count, f"unsupported_{count}_cities")


def _buy_ticket_branch(*, sort_latest: bool, scrolls: int, passenger_scroll: bool) -> list[Step]:
    return [
        *query_route("{from_station}", "{to_station}", "{date}"),
        *book_located_train(
            "{train_no}",
            "{seat_type}",
            "{name}",
            sort_latest=sort_latest,
            scrolls=scrolls,
            passenger_scroll=passenger_scroll,
        ),
        complete(),
    ]


def _buy_two_passengers_branch(*, sort_latest: bool, scrolls: int, passenger_mode: str) -> list[Step]:
    if passenger_mode == "ptop":
        pick_rows = [
            passenger_row("{p_top}", summary="select first passenger"),
            passenger_row("{p_bottom}", summary="select second passenger"),
        ]
    elif passenger_mode == "pbot":
        pick_rows = [
            reveal_passenger_list(),
            passenger_row("{p_top}", summary="select first passenger"),
            passenger_row("{p_bottom}", summary="select second passenger"),
        ]
    else:  # psplit: top row first, then scroll for the below-fold row
        pick_rows = [
            passenger_row("{p_top}", summary="select above-fold passenger"),
            reveal_passenger_list(),
            passenger_row("{p_bottom}", summary="select below-fold passenger"),
        ]
    return [
        *query_route("{from_station}", "{to_station}", "{date}"),
        *locate_train_steps(sort_latest=sort_latest, scrolls=scrolls),
        train_card("{train_no}"),
        reveal_seat_panel(),
        click_selector(
            '[data-trigger="trainDetail.book"][data-trigger-params*=\'"seat":"{seat_type}"\']:visible',
            summary="book requested seat",
        ),
        tap_trigger("orderConfirm.passengers", summary="open passenger selector"),
        wait(0.4, summary="wait for passenger selector"),
        *pick_rows,
        passenger_done(),
        *submit_order(),
        complete(),
    ]


def _buy_new_passenger_branch(*, sort_latest: bool, scrolls: int) -> list[Step]:
    return [
        *query_route("{from_station}", "{to_station}", "{date}"),
        *locate_train_steps(sort_latest=sort_latest, scrolls=scrolls),
        train_card("{train_no}"),
        reveal_seat_panel(),
        click_selector(
            '[data-trigger="trainDetail.book"][data-trigger-params*=\'"seat":"{seat_type}"\']:visible',
            summary="book requested seat",
        ),
        tap_trigger("orderConfirm.passengers", summary="open passenger selector"),
        wait(0.4, summary="wait for passenger selector"),
        *add_new_passenger("{name}", "{id_no}", "{phone}"),
        swipe([500, 720], [500, 320], summary="scroll passenger selector to newly added passenger"),
        wait(0.2, summary="wait after passenger selector scroll"),
        *choose_passenger("{name}"),
        *submit_order(),
        complete(),
    ]


def _single_passenger_branches() -> dict[str, list[Step]]:
    """schedule_pref direction × train scroll bucket × passenger bucket
    (see _booking_locate_pick)."""
    return {
        f"{pref}_{bucket}_{pmode}": _buy_ticket_branch(
            sort_latest=(pref == "latest"),
            scrolls=(1 if bucket == "scroll1" else 0),
            passenger_scroll=(pmode == "pbot"),
        )
        for pref in ("earliest", "latest")
        for bucket in ("direct", "scroll1")
        for pmode in ("ptop", "pbot")
    }


def _two_passengers_branches() -> dict[str, list[Step]]:
    """Same grid with the three-way passenger bucket (see _two_passengers_pick)."""
    return {
        f"{pref}_{bucket}_{pmode}": _buy_two_passengers_branch(
            sort_latest=(pref == "latest"),
            scrolls=(1 if bucket == "scroll1" else 0),
            passenger_mode=pmode,
        )
        for pref in ("earliest", "latest")
        for bucket in ("direct", "scroll1")
        for pmode in ("ptop", "pbot", "psplit")
    }


def _new_passenger_branches() -> dict[str, list[Step]]:
    """schedule_pref × train scroll bucket only — the newly added passenger
    always lands at the list tail, so its arm has a fixed selector scroll."""
    return {
        f"{pref}_{bucket}": _buy_new_passenger_branch(
            sort_latest=(pref == "latest"), scrolls=(1 if bucket == "scroll1" else 0)
        )
        for pref in ("earliest", "latest")
        for bucket in ("direct", "scroll1")
    }


def _new_passenger_pick(task: Any, state: dict[str, Any]) -> str:
    """Pure Branch pick for BuyTicketForNewPassenger — no passenger bucket:
    the target passenger does not exist in the initial list (the plan creates
    it, and the arm's fixed scroll reaches the appended tail row)."""
    pref = "latest" if str(task.p.schedule_pref) == "latest" else "earliest"
    index = _ui_train_index(
        state, task.p.from_station, task.p.to_station, task.p.date, task.p.schedule_pref
    )
    return f"{pref}_{_locate_bucket(index)}"


def _buy_return_branch(scrolls: int) -> list[Step]:
    """Return-trip booking: derived route/train (earliest, tomorrow), then the
    same locate-and-book flow; the judge accepts any train on the route."""
    return [
        # 返程路线 = 最新车票 to→from（派生同判分器 _station_to_city 口径）。
        *query_route("{return_from}", "{return_to}", "{date}"),
        *locate_train_steps(sort_latest=False, scrolls=scrolls),
        train_card("{return_train}", summary="expand return train"),
        wait(0.3, summary="wait for return train detail expansion"),
        click_selector('[data-trigger="trainDetail.book"]:visible', summary="book visible return train"),
        tap_trigger("orderConfirm.passengers", summary="open passenger selector"),
        wait(0.4, summary="wait for passenger selector"),
        *choose_passenger("{name}"),
        *submit_order(),
        complete(),
    ]


PLANS: dict[str, list[Step] | Branch] = {
    "railway12306.OpenAllApps": [
        *open_railway(),
        swipe([850, 620], [70, 620], summary="swipe service grid left to next page"),
        wait(0.2, summary="wait after service grid swipe"),
        swipe([850, 620], [70, 620], summary="swipe service grid left to all apps overscroll"),
        wait(0.8, summary="wait for all apps page"),
        complete(),
    ],
    "railway12306.OpenServicePhone": [
        *open_railway(),
        # 首页服务宫格「温馨服务」项（无 data-trigger，点文本 span 冒泡触发导航）；
        # 旧 div:has-text 会命中包含该文本的外层容器、点不到宫格项。
        click_selector('span:text-is("温馨服务"):visible', summary="open customer service phone page"),
        wait(0.4, summary="wait for service phone page"),
        # 客服电话表格每行 = 地区 | 长途区号 | 电话；区号列即答案来源。
        assert_answer("{area_code}", summary="assert area code visible in service phone table"),
        *grounded_answer("{area_code}", summary="answer service phone area code"),
        complete(),
    ],
    # Restricted Branch: the add-header 设为默认抬头 switch defaults to ON;
    # pick reads the declared bool param to decide whether to tap it off.
    "railway12306.OpenInvoice": Branch(
        pick=lambda task, state: (
            "keep_default_on" if bool(task.p.make_default) else "turn_off_default"
        ),
        branches={
            "keep_default_on": _open_invoice_branch(turn_off_default=False),
            "turn_off_default": _open_invoice_branch(turn_off_default=True),
        },
    ),
    "railway12306.CheckPassengerCount": [
        *open_passenger_manager(),
        # B类证据断言：乘车人数量（{answer}）本身不显示在屏幕上，直接断言数字会
        # 假阳性/必失败；改为断言列表首尾行可见，证明完整浏览了被计数的列表。
        # 首行 = 「当前用户」默认乘车人赵宇轩（swipe 前在视口内）。
        assert_text("赵宇轩", summary="assert passenger list head (default passenger) visible"),
        swipe([500, 720], [500, 280], summary="scroll passenger list to count everyone"),
        wait(0.3, summary="wait after passenger list scroll"),
        # 尾行 = 拼音分组最后一组（Z）末位乘车人周子涵（swipe 后进入视口）。
        # 首尾行合证列表完整浏览，收尾断言背书计数 {answer}。
        assert_text("周子涵", summary="assert passenger list tail (last passenger) visible", endorses=["answer"]),
        *grounded_answer("{answer}", summary="answer passenger count"),
        complete(),
    ],
    "railway12306.CheckDefaultPassengerName": [
        *open_passenger_manager(),
        # 乘车人管理页「当前用户」区块即默认乘车人，姓名就是答案。
        assert_answer("{answer}", summary="assert default passenger name on passenger list"),
        *grounded_answer("{answer}", summary="answer default passenger name"),
        complete(),
    ],
    "railway12306.CheckStudentVerify": [
        *open_my_account(),
        tap_trigger("account.studentVerify", summary="open student qualification page"),
        # 学生资质卡片显示优惠区间「{from} – {to}」，两个字段逐一断言在屏。
        assert_answer("{answer_from}", field_index=0, summary="assert student route from-station on screen"),
        assert_answer("{answer_to}", field_index=1, summary="assert student route to-station on screen"),
        *grounded_answer("{answer_from}", "{answer_to}", summary="answer student discount route"),
        complete(),
    ],
    # Restricted Branch: one repeatable answer row per unique city — the
    # default orders yield 3 from-cities / 2 to-cities (see pick above).
    "railway12306.CheckRecentTripCities": Branch(
        pick=_recent_trip_cities_pick,
        branches={
            "two_cities": _recent_trip_cities_branch(2),
            "three_cities": _recent_trip_cities_branch(3),
        },
    ),
    "railway12306.CheckIdVerificationStatus": [
        *open_railway(),
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("my.settings", summary="open settings"),
        tap_trigger("settings.idVerify", summary="open ID verification page"),
        # 人证核验页文案「您的人证信息核验成功。」包含选项值「核验成功」
        # （未通过时对应「未通过核验」）；{verify_status} 派生自初态
        # user.realNameVerified，与判分 check_goals 同源。
        assert_answer("{verify_status}", summary="assert id verification result message on screen"),
        *answer_choice("{verify_status}", summary="answer ID verification status"),
        complete(),
    ],
    # Restricted Branch: the derived return train may start below the fold
    # (e.g. 上海→杭州 earliest G7541 sits at list index 4 behind Z/D/K cards);
    # the pick buckets the UI list index into direct-tap vs one scroll.
    "railway12306.BuyReturnTicketFromLatestOrder": Branch(
        pick=_return_locate_pick,
        branches={
            "direct": _buy_return_branch(0),
            "scroll1": _buy_return_branch(1),
        },
    ),
    "railway12306.FindTrainByDate": [
        *open_my_tickets(),
        swipe([500, 720], [500, 280], summary="scroll my tickets to find the trip on the date"),
        wait(0.3, summary="wait after tickets scroll"),
        # 目标日期车票卡片中缝显示车次号（答案）。
        assert_answer("{answer}", summary="assert train number of the target-date trip on screen"),
        *grounded_answer("{answer}", summary="answer train by date"),
        complete(),
    ],
    "railway12306.CheckTicketPriceByDate": [
        *open_my_tickets(),
        swipe([500, 720], [500, 280], summary="scroll my tickets to the trip on the date"),
        wait(0.3, summary="wait after tickets scroll"),
        # 票价（number matcher）显示为卡片右下「¥58」；本人车票页其余独立数字
        # （其他票价/时刻）都不等于该值，短数字假阳性风险可接受。
        assert_answer("{answer}", summary="assert ticket price on my tickets list"),
        *grounded_answer("{answer}", summary="answer ticket price"),
        complete(),
    ],
    "railway12306.QueryAndCheckRoute": [
        *query_route("{from_station}", "{to_station}", "{date}"),
        # 查询结果列表整页渲染（无虚拟化），发车最晚车次的车次号必在结果 DOM 中。
        assert_answer("{answer_train}", summary="assert latest-departure train number in query results"),
        *grounded_answer("{answer_train}", summary="answer latest train"),
        complete(),
    ],
    # Restricted Branches (BuyTicket*): the sampled route/preference decides
    # where the target train card sits in the results list — the pick pairs
    # the declared schedule_pref (sort direction) with the judge-homologous
    # target's UI list index (scroll bucket). See _booking_locate_pick.
    "railway12306.BuyTicketForPassenger": Branch(
        pick=_booking_locate_pick,
        branches=_single_passenger_branches(),
    ),
    "railway12306.BuyTicketsForTwoPassengers": Branch(
        pick=_two_passengers_pick,
        branches=_two_passengers_branches(),
    ),
    "railway12306.BuyTicketForNewPassenger": Branch(
        pick=_new_passenger_pick,
        branches=_new_passenger_branches(),
    ),
    "railway12306.QueryFastestTrainDetails": [
        *query_route("{from_station}", "{to_station}", "{date}"),
        # 最快车次行内同时显示车次号/历时（H小时M分）/出发站/到达时间，四个答案字段逐一断言。
        assert_answer("{answer_train}", field_index=0, summary="assert fastest train number in query results"),
        assert_answer("{answer_duration}", field_index=1, summary="assert fastest train duration in query results"),
        assert_answer("{answer_from}", field_index=2, summary="assert fastest train from-station in query results"),
        assert_answer("{answer_arrive}", field_index=3, summary="assert fastest train arrive time in query results"),
        *grounded_answer_four_fields(
            "{answer_train}",
            "{answer_duration}",
            "{answer_from}",
            "{answer_arrive}",
            summary="answer fastest train details",
        ),
        complete(),
    ],
}
