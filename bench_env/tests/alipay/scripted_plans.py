"""Scripted validation plans for Alipay tasks.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder (``answer``, ``phone``, ``contact_id``, ``conversation_id``,
``font_slider_fraction``) is computed at materialization time from the
episode's post-setup initial state via the *judge-homologous* domain class —
calculators build ``Alipay(init_state["apps"]["alipay"])`` exactly like
judges build ``Alipay(input.apps_init["alipay"])``, and both read the same
runner observation, so derived values cannot drift from the judge. This
matters doubly here: ``transferRecords`` timestamps are relative strings in
``defaults.json`` and only the runtime state carries the enriched absolute
milliseconds that ``Alipay``'s bill arithmetic expects. Explicit test
injections would still win over these calculators; ``test_scripted.py``
deliberately injects declared parameters only, exercising this derivation
path end to end.

Sampled-entity navigation: ``FindFriend`` / ``SendMessageToContact`` sample
any of the 30 contacts and ``CheckLatestMessageContent`` any of the 18
conversations, but the env resolves selectors without implicit scrolling —
below-the-fold rows would be untappable. Both pages ship a search box, so
the plans filter the list by the task param first (the matching row is then
guaranteed on screen), dismiss the keyboard via system back (BackDispatcher
priority 700 — stays on the page), and only then tap the id-addressed row.
No ``Branch`` is needed anywhere in this suite: search-filtering removes the
only would-be state-dependent fork (scroll vs no-scroll).

Fixed-defaults geometry (audited, deliberately *not* parameterized — none of
it depends on a sampled parameter):

- ``SetPayOrderCcbYuebaoBalance`` has ``parameters = {}``; the payment-method
  list always starts as yuebao/balance/ccb from defaults, so the toggle tap
  point and the drag endpoints are stable.
- ``browse_list`` swipe counts (transfer tab 4, conversations 2, search
  results 5, bill list 8/3) cover list lengths fixed by defaults.json;
  ``SearchTransferRecords.keyword`` and ``CalculateMonthlyExpenseTrend``'s
  months have no sampler/source, so the sampling path always uses their
  declared defaults and the scroll geometry cannot shift under sampling.
  The month-group layout does drift with the simulated date (relative-time
  records fill the current month) — a live-geometry concern shared with the
  pinned live cases, not a sampling one.
- ``CheckBalance``'s "100,023.46" below is a comment example only: the
  balance is fixed defaults data and the step itself renders ``{answer}``.
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Step,
    assert_answer,
    assert_text,
    assert_visible,
    back,
    complete,
    enter,
    grounded_answer,
    open_answer_sheet,
    submit_answer_sheet,
    swipe,
    tap_action,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.task.alipay.app import Alipay


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def grounded_choice_answer(choice: str, *, summary: str | None = None) -> list[Step]:
    steps = open_answer_sheet()
    steps.append(click_selector(f'button:has-text("{choice}"):visible', summary=f"choose answer {choice}"))
    steps.append(submit_answer_sheet(summary=summary))
    return steps


def trigger_param(trigger_id: str, key: str, value: str, *, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{key}":"{value}"\']:visible',
        summary=summary,
    )


def action_param(action_id: str, key: str, value: str | int, *, summary: str) -> Step:
    return click_selector(
        f'[data-action="{action_id}"][data-action-params*=\'"{key}":{value}\']:visible',
        summary=summary,
    )


def trigger_visible(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def action_visible(action_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-action="{action_id}"]:visible', summary=summary)


def browse_list(times: int, *, summary: str) -> list[Step]:
    """Best-effort downward scrolls so list-wide answer evidence enters the viewport."""
    return [swipe([500, 850], [500, 200], summary=f"{summary} {i + 1}/{times}") for i in range(times)]


def open_settings() -> list[Step]:
    return [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("settings.open", summary="open Alipay settings"),
        wait(0.3, summary="wait for settings page"),
    ]


def open_general_settings() -> list[Step]:
    return [
        *open_settings(),
        tap_trigger("settings.general.open", summary="open general settings"),
        wait(0.3, summary="wait for general settings"),
    ]


def open_payment_settings() -> list[Step]:
    return [
        *open_settings(),
        tap_trigger("settings.payment.open", summary="open payment settings"),
        wait(0.3, summary="wait for payment settings"),
    ]


def open_contacts() -> list[Step]:
    return [
        tap_trigger("tab.messages", summary="open Messages tab"),
        tap_trigger("contacts.open", summary="open contacts"),
        wait(0.3, summary="wait for contacts"),
    ]


def open_contact_profile(query: str, contact_id: str, *, summary: str) -> list[Step]:
    """Search-driven profile open — sampling-safe for any of the 30 contacts.

    The contacts list sits below 7 functional rows (first contact row ≈ y620
    css of 800), so an unfiltered sampled contact may start below the fold
    and the keyboard hides that region while typing. Filtering by the task
    param collapses the list to the target row; one system back dismisses
    the keyboard (priority 700, stays on the page) before the id-addressed
    tap.
    """
    return [
        *open_contacts(),
        type_text(query, selector="input:visible", clear=True, summary="search contact by task param"),
        wait(0.4, summary="wait for contact filter"),
        back(summary="dismiss keyboard to reveal filtered contact row"),
        wait(0.3, summary="wait for keyboard to hide"),
        trigger_param("contacts.profile.open", "contactId", contact_id, summary=summary),
        wait(0.4, summary="wait for contact profile"),
    ]


def open_conversation(query: str, conversation_id: str, *, summary: str) -> list[Step]:
    """Search-driven conversation open — sampling-safe for any conversation.

    The messages tab lists 18 conversations (~2 screens); the search box
    filters by name/lastContent so the sampled conversation's row is always
    rendered near the top of the list card before the id-addressed tap.
    """
    return [
        tap_trigger("tab.messages", summary="open Messages tab"),
        type_text(query, selector="input:visible", clear=True, summary="filter conversations by task param"),
        wait(0.4, summary="wait for conversation filter"),
        back(summary="dismiss keyboard to stabilize the list"),
        wait(0.3, summary="wait for keyboard to hide"),
        trigger_param("chat.open", "id", conversation_id, summary=summary),
        wait(0.4, summary="wait for chat page"),
    ]


def drag_pay_order_ccb_to_top() -> Step:
    # Payment methods start as yuebao, balance, ccb (fixed defaults; the task
    # declares no parameters). Drag the third handle to the first row.
    return {
        "op": "drag",
        "point1": [841, 509],
        "point2": [841, 357],
        "duration_ms": 900,
        "summary": "drag CCB payment method to top",
    }


def set_font_level() -> list[Step]:
    """Drag the 0–4 font slider to the sampled level.

    The OS ``Slider`` jumps to the pointer-down x and commits the pointer-up
    x (initial thumb position is irrelevant), so a selector-relative drag to
    ``end_fraction = level / 4`` — the derived ``{font_slider_fraction}`` —
    lands exactly on the target detent for every sampled level.

    ``end_space: "layout"`` is load-bearing: Alipay renders under
    ``designViewportWidth: 412`` (CSS zoom ≈ 0.874), and the Slider computes
    its ratio from raw pointer clientX against its *pre-zoom* layout rect —
    a visual-space endpoint therefore lands ≈ one detent short at the top
    (level 4 → 3). Layout-space endpoints match the Slider's own arithmetic;
    the level-4 endpoint sits past the visual viewport edge, but the env
    clamps it to the edge, which still exceeds the ≥ 7/8 detent threshold.
    """
    return [
        *open_general_settings(),
        tap_trigger("settings.general.fontSize.open", summary="open font size settings"),
        wait(0.3, summary="wait for font size settings"),
        {
            "op": "drag",
            "selector": '[data-action="fontSize.slider.input"]:visible',
            "start_fraction": 0.5,
            "end_fraction": "{font_slider_fraction}",
            "end_space": "layout",
            "duration_ms": 600,
            "summary": "drag font slider to level {font_size_level}",
        },
        wait(0.3, summary="wait for font size update"),
    ]


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (answer path / get_answer /
# get_expected_response in bench_env/task/alipay/tasks.py) through the same
# Alipay domain class over the same initial state, so the typed/asserted
# values are judge-homologous by construction.

def _alipay(state: dict[str, Any]) -> Alipay:
    """Judge-homologous accessor: ``Alipay(init_state["apps"]["alipay"])``."""
    return Alipay(state["apps"]["alipay"])


def _num(value: Any) -> str:
    """Numeric string as a human would type it (whole floats lose the .0)."""
    value = float(value)
    return str(int(value)) if value.is_integer() else str(value)


def _contact_by_param(state: dict[str, Any], name: str) -> dict[str, Any]:
    """Mirror the judge's ``[name={name}]`` list-find (_find_list_item_by_field):
    exact name match wins, else the first contact whose name contains it."""
    contacts = _alipay(state).contacts
    for contact in contacts:
        if str(contact.get("name")) == name:
            return contact
    for contact in contacts:
        if name in str(contact.get("name") or ""):
            return contact
    raise ValueError(f"Alipay contact matching {name!r} not found in initial state")


def _monthly_income_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror MonthlyIncomeByCounterparty.get_answer."""
    total = _alipay(state).monthly_income_from(str(task.p.month), task.p.name)
    return f"{round(total, 2):g}"


def _latest_five_spending_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror AnalyzeSpending.get_answer (latest 5 by timestamp, sum expenses)."""
    ali = _alipay(state)
    latest = sorted(ali.transactions, key=lambda x: x["timestamp"], reverse=True)[:5]
    total = sum(abs(float(t["delta"])) for t in latest if float(t["delta"]) < 0)
    return f"{round(total, 2):g}"


def _large_transfer_income_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror CountLargeTransferIncomes.get_answer."""
    count = 0
    for t in _alipay(state).transactions:
        if float(t["delta"]) > task.p.amount and str(t["counterpartyName"]).startswith("转账"):
            count += 1
    return str(count)


def _higher_expense_choice(task: Any, state: dict[str, Any]) -> str:
    """Mirror CalculateMonthlyExpenseTrend.get_expected_response — the choice
    buttons render the raw month options, so the tie returns "一样" and a
    winner returns the raw YYYY-MM param value."""
    ali = _alipay(state)
    exp1 = ali.monthly_expense(task.p.month1)
    exp2 = ali.monthly_expense(task.p.month2)
    if exp1 > exp2:
        return str(task.p.month1)
    if exp2 > exp1:
        return str(task.p.month2)
    return "一样"


def _largest_transfer_partner_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror FindLargestTransferPartner.get_answer (same iteration order,
    so ties resolve to the same first-inserted maximum)."""
    totals: dict[str, float] = {}
    for t in _alipay(state).transactions:
        name = str(t["counterpartyName"])
        totals[name] = totals.get(name, 0.0) + abs(float(t["delta"]))
    return max(totals, key=totals.get)  # type: ignore[arg-type]


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    # answer path ".contacts[name={name}].phone" — the same contact resolves
    # both the row to tap and the phone to certify/answer.
    "alipay.FindFriend": {
        "contact_id": lambda task, state: str(_contact_by_param(state, str(task.p.name))["id"]),
        "phone": lambda task, state: str(_contact_by_param(state, str(task.p.name))["phone"]),
    },
    "alipay.MonthlyIncomeByCounterparty": {"answer": _monthly_income_answer},
    # answer path ".balance.dailyIncome"
    "alipay.CheckDailyIncome": {
        "answer": lambda task, state: _num(_alipay(state).get("balance.dailyIncome")),
    },
    # get_answer: get_conversation_by_name(name)["lastContent"] — the same
    # conversation resolves both the row to tap and the answer text.
    "alipay.CheckLatestMessageContent": {
        "conversation_id": lambda task, state: str(
            _alipay(state).get_conversation_by_name(str(task.p.name))["id"]
        ),
        "answer": lambda task, state: str(
            _alipay(state).get_conversation_by_name(str(task.p.name))["lastContent"]
        ),
    },
    "alipay.AnalyzeSpending": {"answer": _latest_five_spending_answer},
    "alipay.CountLargeTransferIncomes": {"answer": _large_transfer_income_answer},
    # get_answer: Alipay(...).total_unread
    "alipay.CheckUnreadMessageCount": {
        "answer": lambda task, state: str(_alipay(state).total_unread),
    },
    # answer path ".balance.total"
    "alipay.CheckBalance": {
        "answer": lambda task, state: _num(_alipay(state).get("balance.total")),
    },
    # get_answer: count_bill_search_results(keyword)
    "alipay.SearchTransferRecords": {
        "answer": lambda task, state: str(
            _alipay(state).count_bill_search_results(str(task.p.keyword))
        ),
    },
    # The profile row is addressed by contactId; sendChatMessage keys the
    # (possibly new) conversation to the same contact, which is how the
    # judge's get_conversation_for_contact finds it afterwards.
    "alipay.SendMessageToContact": {
        "contact_id": lambda task, state: str(_contact_by_param(state, str(task.p.contact))["id"]),
    },
    "alipay.CalculateMonthlyExpenseTrend": {"answer": _higher_expense_choice},
    "alipay.FindLargestTransferPartner": {"answer": _largest_transfer_partner_answer},
    # UI-geometry derivation (not an answer): slider detent fraction = level/4.
    "alipay.SetFontSizeLevel": {
        "font_slider_fraction": lambda task, state: str(int(task.p.font_size_level) / 4),
    },
}


PLANS: dict[str, list[Step]] = {
    "alipay.FindFriend": [
        *open_contact_profile("{name}", "{contact_id}", summary="open requested contact profile"),
        # Evidence assert (format mismatch): the profile renders the phone
        # masked — first 3 digits + ****** + last 2 (maskPhone); the full
        # number never appears on screen, and the judge's check_goals accepts
        # the masked form too. Certify the masked string, rebuilt from the
        # derived {phone} via str.format char indexing.
        assert_text(
            "{phone[0]}{phone[1]}{phone[2]}******{phone[9]}{phone[10]}",
            summary="assert masked phone on contact profile",
        ),
        *grounded_answer("{phone}", summary="answer contact phone"),
        complete(),
    ],
    "alipay.MonthlyIncomeByCounterparty": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        tap_trigger("bill.search.open", summary="open bill search"),
        type_text("{name}", selector="input:visible", clear=True, summary="search income counterparty"),
        wait(0.5, summary="wait for bill search results"),
        # Answer assert: search results group by month, and each group header
        # shows "收入 ¥<sum of the group's positive records>" — for the target
        # month that sum equals the task answer (all matched records carry the
        # searched counterparty). The number matcher absorbs the ¥ prefix, and
        # the probe scans every rendered group, not just the viewport.
        assert_answer("{answer}", summary="assert monthly income sum in search results"),
        *grounded_answer("{answer}", summary="answer monthly counterparty income"),
        complete(),
    ],
    "alipay.CheckDailyIncome": [
        tap_trigger("tab.my", summary="open My tab"),
        # Yesterday income (balance.dailyIncome) renders on the total-assets page;
        # the Yu'ebao page is a static demo that always shows zero income.
        tap_trigger("assets.open", summary="open total assets"),
        # Answer assert: the blue assets card renders yesterday's income
        # verbatim (toFixed(2)).
        assert_answer("{answer}", summary="assert yesterday income on assets page"),
        *grounded_answer("{answer}", summary="answer daily income"),
        complete(),
    ],
    "alipay.EnableDarkMode": [
        *open_general_settings(),
        tap_trigger("settings.general.darkMode.open", summary="open dark mode settings"),
        tap_action("darkMode.mode.select.dark", summary="select dark mode"),
        complete(),
    ],
    "alipay.CheckLatestMessageContent": [
        *open_conversation("{name}", "{conversation_id}", summary="open requested conversation"),
        # Answer assert: the newest chat bubble carries the answer text
        # verbatim (text matcher = normalized containment); ChatPage renders
        # message content as-is for every conversation kind, falling back to
        # a lastContent bubble when the history is empty.
        assert_answer("{answer}", summary="assert latest message text in chat"),
        *grounded_answer("{answer}", summary="answer latest message content"),
        complete(),
    ],
    "alipay.SetPayOrderCcbYuebaoBalance": [
        *open_payment_settings(),
        tap_trigger("settings.payment.order.open", summary="open payment order settings"),
        # Fixed defaults geometry: parameters = {} and the order page layout
        # never varies, so the toggle point and drag endpoints are stable.
        {"op": "click", "point": [889, 254], "summary": "enable custom payment order"},
        wait(0.3, summary="wait for custom order list"),
        drag_pay_order_ccb_to_top(),
        wait(0.6, summary="wait for payment order drag"),
        complete(),
    ],
    "alipay.AnalyzeSpending": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        # Evidence assert (aggregate answer): the latest-5 spending total is
        # never rendered; certify the evidence rows instead. The bill list is
        # newest-first, so the 5th row being on the first screen proves all
        # five participating records are in view (fixed defaults: ~10
        # relative-time records always populate the current month).
        assert_visible(
            'xpath=(//button[@data-trigger="bill.detail.open"])[5]',
            summary="assert 5th latest bill row on screen",
        ),
        *grounded_answer("{answer}", summary="answer latest five spending total"),
        complete(),
    ],
    "alipay.CountLargeTransferIncomes": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        tap_trigger("bill.tab.transfer", summary="open transfer bill tab"),
        # Four browse swipes (~905px each) cover the transfer tab's full
        # scroll range (~3000px, fixed defaults — {amount} only changes the
        # threshold, never the list), clamping at the list bottom.
        *browse_list(4, summary="browse transfer records"),
        # Evidence assert (count answer): the qualifying-transfer count is
        # never rendered; counting requires seeing the whole transfer list, so
        # certify the browse reached the last transfer row.
        assert_visible(
            'xpath=(//button[@data-trigger="bill.detail.open"])[last()]',
            summary="assert last transfer row visible after browse",
        ),
        *grounded_answer("{answer}", summary="answer large transfer income count"),
        complete(),
    ],
    "alipay.CheckUnreadMessageCount": [
        tap_trigger("tab.messages", summary="open Messages tab"),
        *browse_list(2, summary="browse conversation unread badges"),
        # Evidence assert (count answer): the answer sums friend-conversation
        # unread badges only — the "消息(N)" header total also counts box and
        # service conversations, so no verbatim total exists on screen.
        # Certify the browse covered the whole conversation list.
        assert_visible(
            'xpath=(//div[@data-trigger="chat.open"])[last()]',
            summary="assert last conversation row visible after browse",
        ),
        *grounded_answer("{answer}", summary="answer unread message count"),
        complete(),
    ],
    "alipay.CheckBalance": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("assets.open", summary="open total assets"),
        # Answer assert: the assets card renders the total with thousands
        # separators ("100,023.46" with the fixed defaults balance); the
        # judge's number matcher absorbs them.
        assert_answer("{answer}", summary="assert total assets on screen"),
        *grounded_answer("{answer}", summary="answer total assets"),
        complete(),
    ],
    "alipay.DisableAllNotifications": [
        *open_settings(),
        tap_trigger("settings.notifications.open", summary="open notification settings"),
        tap_action("notification.tradeSecurity.toggle", summary="turn off trade security notifications"),
        tap_action("notification.service.toggle", summary="turn off service notifications"),
        tap_action("notification.activity.toggle", summary="turn off activity notifications"),
        tap_action("notification.friendReminder.toggle", summary="turn off friend reminders"),
        tap_action("notification.friendDetail.toggle", summary="turn off friend details"),
        tap_action("notification.sound.toggle", summary="turn off notification sound"),
        tap_action("notification.vibration.toggle", summary="turn off vibration"),
        complete(),
    ],
    "alipay.ShowReceiveQRCode": [
        tap_trigger("pay.open", summary="open pay page"),
        tap_trigger("receive.open", summary="open receive-money QR code"),
        complete(),
    ],
    "alipay.SearchTransferRecords": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        tap_trigger("bill.search.open", summary="open bill search"),
        type_text("{keyword}", selector="input:visible", clear=True, summary="search bill keyword"),
        wait(0.5, summary="wait for bill search results"),
        click_selector('button:has-text("搜索"):visible, button:has-text("Search"):visible', summary="save bill search keyword"),
        # Five browse swipes cover the ~25 default-keyword results; {keyword}
        # has no sampler/source, so the sampling path never changes the list.
        *browse_list(5, summary="browse search results"),
        # Evidence assert (count answer): no "N 条记录" total exists on
        # screen; counting requires seeing every result, so certify the
        # browse reached the last search-result row.
        assert_visible(
            'xpath=(//button[@data-trigger="bill.search.detail.open"])[last()]',
            summary="assert last search result row visible after browse",
        ),
        *grounded_answer("{answer}", summary="answer bill search result count"),
        complete(),
    ],
    "alipay.SendMessageToContact": [
        *open_contact_profile("{contact}", "{contact_id}", summary="open target contact profile"),
        tap_trigger("chat.open", summary="open chat from profile"),
        type_text("{text}", selector="input:visible", clear=True, summary="type chat message"),
        enter(summary="send chat message"),
        complete(),
    ],
    "alipay.ConfigureLanguageAndFastPay": [
        *open_general_settings(),
        tap_trigger("settings.general.language.open", summary="open language settings"),
        tap_action("language.select.en", summary="select English language"),
        tap_action("language.save.submit", summary="save language"),
        wait(0.5, summary="wait for language save"),
        back(summary="return to settings page"),
        wait(0.3, summary="wait for settings page"),
        tap_trigger("settings.payment.open", summary="open payment settings"),
        tap_trigger("settings.payment.fastPay.open", summary="open fast pay settings"),
        tap_action("fastPay.enabled.toggle", summary="enable fast pay"),
        wait(0.5, summary="wait for fast pay page"),
        tap_action("fastPay.easterEgg.toggle", summary="disable payment easter egg"),
        complete(),
    ],
    "alipay.EnableRefreshSound": [
        *open_general_settings(),
        swipe([500, 850], [500, 430], summary="scroll to refresh sound switch"),
        tap_action("general.refreshSound.toggle", summary="enable refresh sound"),
        complete(),
    ],
    "alipay.SetFontSizeLevel": [
        *set_font_level(),
        complete(),
    ],
    # The bill-analysis compare chart only renders the last 6 months, which
    # does NOT include {month1}/{month2} at the current sim date — the real
    # evidence lives in the bill list itself: every month group header shows
    # "支出 ¥<total> / 收入 ¥<total>" for that month.
    "alipay.CalculateMonthlyExpenseTrend": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        # Three browse swipes (~905px each) park the list where both compared
        # months' expense totals are on one screen: the sticky header pins the
        # {month1} summary while the {month2} group header is in the viewport.
        # {month1}/{month2} have no sampler/source (defaults 2026-01/2025-12
        # on the sampling path too), so this geometry only drifts with the
        # simulated date, not with sampling.
        *browse_list(3, summary="scroll to {month1}/{month2} bill groups"),
        # Evidence asserts (comparison answer): the "which month spent more"
        # verdict is never rendered; certify both months' expense summaries.
        # Current-year group labels render "N月" — the month's trailing digit
        # + 月 is always a substring of that label (2026-01 → "1月"); other
        # years render the raw "YYYY-MM" key, matching {month2} verbatim.
        assert_text("{month1[6]}月", summary="assert {month1} summary row on screen"),
        assert_text("{month2}", summary="assert {month2} group header on screen"),
        *grounded_choice_answer("{answer}", summary="answer higher expense month"),
        complete(),
    ],
    "alipay.FindLargestTransferPartner": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        *browse_list(8, summary="browse full bill list"),
        # Answer assert: the answer is the counterparty name itself and bill
        # rows render it verbatim; assert_answer scans every rendered row of
        # the foreground Activity, so the match is scroll-offset independent.
        assert_answer("{answer}", summary="assert largest partner name on bill list"),
        *grounded_answer("{answer}", summary="answer largest transfer partner"),
        complete(),
    ],
}
