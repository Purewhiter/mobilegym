"""Scripted validation plans for Alipay tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
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
        *grounded_answer("{phone}", summary="answer contact phone"),
        complete(),
    ],
    "alipay.MonthlyIncomeByCounterparty": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        tap_trigger("bill.search.open", summary="open bill search"),
        type_text("{name}", selector="input:visible", clear=True, summary="search income counterparty"),
        wait(0.5, summary="wait for bill search results"),
        *grounded_answer("{answer}", summary="answer monthly counterparty income"),
        complete(),
    ],
    "alipay.CheckDailyIncome": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("yuebao.open", summary="open Yu'ebao"),
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
        *grounded_answer("{answer}", summary="answer latest five spending total"),
        complete(),
    ],
    "alipay.CountLargeTransferIncomes": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        tap_trigger("bill.tab.transfer", summary="open transfer bill tab"),
        *grounded_answer("{answer}", summary="answer large transfer income count"),
        complete(),
    ],
    "alipay.CheckUnreadMessageCount": [
        tap_trigger("tab.messages", summary="open Messages tab"),
        *grounded_answer("{answer}", summary="answer unread message count"),
        complete(),
    ],
    "alipay.CheckBalance": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("assets.open", summary="open total assets"),
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
    "alipay.CalculateMonthlyExpenseTrend": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        tap_trigger("bill.analysis.open", summary="open bill analysis"),
        *grounded_choice_answer("{answer}", summary="answer higher expense month"),
        complete(),
    ],
    "alipay.FindLargestTransferPartner": [
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("bill.open", summary="open bills"),
        *grounded_answer("{answer}", summary="answer largest transfer partner"),
        complete(),
    ],
}
