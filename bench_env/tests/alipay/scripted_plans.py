"""Scripted validation plans for Alipay tasks."""

from __future__ import annotations

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


def open_contact_profile(contact_id: str, *, summary: str) -> list[Step]:
    return [
        *open_contacts(),
        trigger_param("contacts.profile.open", "contactId", contact_id, summary=summary),
        wait(0.4, summary="wait for contact profile"),
    ]


def drag_pay_order_ccb_to_top() -> Step:
    # Payment methods start as yuebao, balance, ccb. Drag the third handle to the first row.
    return {
        "op": "drag",
        "point1": [841, 509],
        "point2": [841, 357],
        "duration_ms": 900,
        "summary": "drag CCB payment method to top",
    }


def set_font_level(level: str) -> list[Step]:
    return [
        *open_general_settings(),
        tap_trigger("settings.general.fontSize.open", summary="open font size settings"),
        wait(0.3, summary="wait for font size settings"),
        {"op": "drag", "point1": [500, 927], "point2": [999, 927], "summary": f"drag font slider to level {level}"},
        wait(0.3, summary="wait for font size update"),
    ]


PLANS: dict[str, list[Step]] = {
    "alipay.FindFriend": [
        *open_contact_profile("{contact_id}", summary="open requested contact profile"),
        # Evidence assert (format mismatch): the profile renders the phone
        # masked — first 3 digits + ****** + last 2 (maskPhone); the full
        # number never appears on screen, and the judge's check_goals accepts
        # the masked form too. Certify the masked string, rebuilt from the
        # injected {phone} via str.format char indexing.
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
        # searched counterparty). The number matcher absorbs the ¥ prefix.
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
        tap_trigger("tab.messages", summary="open Messages tab"),
        trigger_param("chat.open", "id", "{conversation_id}", summary="open requested conversation"),
        # Answer assert: the newest chat bubble carries the answer text
        # verbatim (text matcher = normalized containment).
        assert_answer("{answer}", summary="assert latest message text in chat"),
        *grounded_answer("{answer}", summary="answer latest message content"),
        complete(),
    ],
    "alipay.SetPayOrderCcbYuebaoBalance": [
        *open_payment_settings(),
        tap_trigger("settings.payment.order.open", summary="open payment order settings"),
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
        # five participating records are in view.
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
        # scroll range (~3000px), clamping at the list bottom.
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
        # separators ("100,023.46"); the judge's number matcher absorbs them.
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
        *open_contacts(),
        swipe([500, 850], [500, 520], summary="scroll contacts to target contact"),
        trigger_param("contacts.profile.open", "contactId", "{contact_id}", summary="open target contact profile"),
        wait(0.4, summary="wait for contact profile"),
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
        *set_font_level("{font_size_level}"),
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
