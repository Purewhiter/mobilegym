"""Scripted validation plans for SMS tasks.

Layout facts the steps below rely on:

- Conversation rows are ``div.flex.items-start`` blocks (ConversationItem)
  whose header renders the sender name verbatim; unread rows carry an orange
  ``w-2 h-2 rounded-full`` dot. Default data keeps every sender string unique
  to its own row (no cross-mentions in previews), so ``:has-text(sender)``
  resolves to exactly one row.
- Long-pressing a row (≥500 ms pointer hold, ConversationListPage) opens the
  URL-driven context menu; ``__SIM_INPUT__.longPress`` deliberately dispatches
  no trailing click, so the menu stays open for the follow-up 删除 tap.
- Settings rows are ``div.px-5.py-3.5`` blocks whose title div equals the task
  enum's display label (constants.MAIN_SETTINGS / FREE_SMS_SETTINGS titles);
  toggle rows embed the switch ``button``. All main-settings rows fit one
  360x800 screen (the bottom 文字头像 row stays tap-hittable), so no scroll
  step is needed.
- The conversation detail page header renders ``conversation.sender``
  (ConversationDetailPage), so per-thread evidence asserts use
  ``assert_text(sender, exact=True)`` — exact match hits the header only,
  never a message bubble that merely mentions the brand.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder is computed at materialization time so the plans also work on the
official ``--agent scripted`` sampling path, where ``task.params`` carries
declared parameters only:

- state-derived values go through the *judge-homologous* ``Sms`` domain class
  over the same runner initial observation the judge receives —
  ``_sms_init(state)`` mirrors ``sms_init_from_input(input)``
  (``os.providers.sms``), so ``answer`` / ``target_sender`` cannot drift from
  ``get_answer`` / ``check_goals`` in bench_env/task/sms/tasks.py;
- UI-label lookups (``setting_label``, ``sender_label``) map the sampled enum
  *value* (e.g. ``show_avatar`` / ``china-telecom``) back to the display label
  the UI renders (settings row title / conversation sender), via the task's
  own enum schema or the init provider data.

Exemption note (plan-shape limitation, not a lint exemption):
``sms.FindAndReplySendersByKeyword`` replies to a *set* of senders whose size
depends on the data; a static plan cannot vary its step count, so
``_keyword_target_sender`` supports exactly one matching sender (true for the
default data: only 中国电信 mentions 套餐) and raises loudly — failing the
episode as ERROR instead of silently under-replying — if the data ever grows
more matches. ``keyword`` has no sampling space today (string param with only
a default), so the sampling path cannot hit the multi-sender case either.
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Step,
    assert_text,
    assert_visible,
    back,
    complete,
    grounded_answer,
    long_press_at,
    open_answer_sheet,
    submit_answer_sheet,
    swipe,
    type_text,
    wait,
)
from bench_env.task.sms.app import Sms


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def settings_button() -> Step:
    return click_selector('button:has(img[alt="action_bar_setting"]):visible', summary="open SMS settings")


def one_click_read_button() -> Step:
    return click_selector('button:has(img[alt="ic_one_click_button"]):visible', summary="mark all conversations read")


def conversation_row(text: str) -> str:
    return f'div.flex.items-start:has-text("{text}"):visible'


def row_with_text(text: str, *, summary: str | None = None) -> Step:
    return click_selector(conversation_row(text), summary=summary or f"open conversation {text}")


def settings_row_button(label: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'xpath=//div[contains(@class,"px-5") and contains(@class,"py-3.5") and .//div[normalize-space()="{label}"]]//button',
        summary=summary or f"toggle setting {label}",
    )


def settings_nav_row(label: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'xpath=//div[contains(@class,"px-5") and contains(@class,"py-3.5") and .//div[normalize-space()="{label}"]]',
        summary=summary or f"open setting row {label}",
    )


def send_reply(sender: str, content: str) -> list[Step]:
    return [
        row_with_text(sender, summary=f"open conversation with {sender}"),
        type_text(content, selector="input:visible", clear=True, summary=f"type reply {content!r}"),
        click_selector("button.bg-app-primary:visible", summary="send SMS reply"),
        wait(0.6, summary="wait for sent status update"),
    ]


def browse_thread(sender: str, *, endorses: list[str] | None = None) -> list[Step]:
    """Open a conversation, scroll toward its earliest message, certify the
    thread header on screen, and return to the list (``endorses`` — params
    whose values were gathered by browsing this thread)."""
    return [
        row_with_text(sender, summary=f"open {sender} conversation"),
        wait(0.5, summary=f"wait for {sender} thread"),
        swipe([500, 350], [500, 700], summary=f"scroll {sender} thread toward earliest message"),
        assert_text(sender, exact=True, summary=f"assert {sender} thread header on screen", endorses=endorses),
        back(summary="return to conversation list"),
        wait(0.3, summary="wait for conversation list"),
    ]


def grounded_choice_answer(choice: str, *, summary: str | None = None) -> list[Step]:
    steps = open_answer_sheet()
    steps.append(click_selector(f'button:has-text("{choice}"):visible', summary=f"choose answer {choice}"))
    steps.append(submit_answer_sheet(summary=summary))
    return steps


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each state-derived calculator mirrors its task's judge (get_answer /
# check_goals in bench_env/task/sms/tasks.py) through the same Sms domain
# class over the same initial state, so the typed values are judge-homologous
# by construction. Label lookups translate sampled enum values into the exact
# strings the UI renders.

def _sms_init(state: dict[str, Any]) -> Sms:
    """Judge-homologous init accessor: mirrors ``sms_init_from_input`` —
    ``Sms(os_init["providers"]["sms"])`` over the same runner initial
    observation the judge later receives as ``input.init_obs``."""
    providers = (state.get("os") or {}).get("providers") or {}
    return Sms(providers.get("sms") or {})


def _setting_label(task: Any, state: dict[str, Any]) -> str:
    """Settings row title for the sampled ``setting_key`` — reverse lookup of
    the task's own enum schema ({display label: value}); the label equals the
    SettingsItem row title (constants.MAIN_SETTINGS / FREE_SMS_SETTINGS)."""
    values = task.parameters["setting_key"]["values"]
    for label, value in values.items():
        if value == task.p.setting_key:
            return str(label)
    raise ValueError(
        f"setting_key {task.p.setting_key!r} not in schema values {sorted(values.values())}"
    )


def _conversation_sender(task: Any, state: dict[str, Any]) -> str:
    """Row text (sender) of the conversation whose id the task pins — read
    from the same init provider data the list page renders."""
    for conversation in _sms_init(state).conversations:
        if str(conversation.get("id")) == str(task.p.conversation_id):
            return str(conversation["sender"])
    raise ValueError(
        f"conversation id {task.p.conversation_id!r} not found in initial sms provider data"
    )


def _keyword_target_sender(task: Any, state: dict[str, Any]) -> str:
    """Mirror FindAndReplySendersByKeyword's judge (``senders_with_keyword``
    over incoming messages). Static plans cannot vary their step count, so
    exactly one matching sender is supported — see module docstring."""
    senders = _sms_init(state).senders_with_keyword(task.p.keyword)
    if len(senders) != 1:
        raise ValueError(
            f"static plan replies to exactly one sender, but keyword "
            f"{task.p.keyword!r} matches {senders!r}"
        )
    return senders[0]


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "sms.ToggleMainSetting": {"setting_label": _setting_label},
    "sms.OpenConversationBySender": {"sender_label": _conversation_sender},
    "sms.ReadUnreadConversationCount": {
        # Mirror ReadUnreadConversationCount.get_answer: init unread count.
        "answer": lambda task, state: str(_sms_init(state).unread_conversation_count),
    },
    "sms.ToggleFreeNetworkSetting": {"setting_label": _setting_label},
    "sms.CompareConversationMessageCount": {
        # Mirror CompareConversationMessageCount.get_answer — same method,
        # same tie behavior (a tie raises → loud episode ERROR, exactly like
        # the judge itself would error on get_answer).
        "answer": lambda task, state: _sms_init(state).sender_with_more_messages(
            task.p.sender1, task.p.sender2
        ),
    },
    "sms.ReplyToLatestUnread": {
        # Mirror ReplyToLatestUnread.check_goals target resolution.
        "target_sender": lambda task, state: _sms_init(state).latest_unread_sender(),
    },
    "sms.FindAndReplySendersByKeyword": {"target_sender": _keyword_target_sender},
}


PLANS: dict[str, list[Step]] = {
    "sms.ToggleMainSetting": [
        settings_button(),
        settings_row_button("{setting_label}"),
        complete(),
    ],
    "sms.OpenConversationBySender": [
        row_with_text("{sender_label}", summary="open {sender_label} conversation"),
        complete(),
    ],
    "sms.ReadUnreadConversationCount": [
        # Evidence probe: the unread count never renders as text — the list
        # marks unread rows with an orange dot (ConversationItem w-2 h-2
        # rounded-full). Assert an unread-marked row is on screen before
        # counting/answering; opening threads would dirty the diff.
        assert_visible(
            '[data-adjust-resize] div.flex.items-start:has(div.w-2.h-2.rounded-full):visible',
            summary="assert unread-marked conversation rows on screen",
            endorses=["answer"],
        ),
        *grounded_answer("{answer}", summary="answer unread conversation count"),
        complete(),
    ],
    "sms.ReplyToConversation": [
        *send_reply("{sender}", "{content}"),
        complete(),
    ],
    "sms.MarkAllConversationsRead": [
        one_click_read_button(),
        complete(),
    ],
    "sms.ToggleFreeNetworkSetting": [
        settings_button(),
        settings_nav_row("网络短信设置", summary="open free network SMS settings"),
        settings_row_button("{setting_label}"),
        complete(),
    ],
    "sms.CompareConversationMessageCount": [
        # Gather: list rows only show the latest-message preview (no counts), so
        # open both compared threads and browse them before answering. Opening a
        # thread marks it read — os.providers.sms.conversations is whitelisted in
        # the task's expected_changes, so this stays a clean diff.
        # The two thread-header asserts jointly prove both compared threads
        # were browsed; the closing one carries the verdict endorsement.
        *browse_thread("{sender1}"),
        *browse_thread("{sender2}", endorses=["answer"]),
        *grounded_choice_answer("{answer}", summary="answer conversation with more messages"),
        complete(),
    ],
    "sms.DeleteConversation": [
        long_press_at(conversation_row("{sender}"), summary="long-press {sender} conversation row"),
        click_selector('button:has-text("删除"):visible', summary="delete {sender} conversation"),
        complete(),
    ],
    "sms.ReplyToLatestUnread": [
        *send_reply("{target_sender}", "{content}"),
        complete(),
    ],
    "sms.FindAndReplySendersByKeyword": [
        *send_reply("{target_sender}", "{reply}"),
        complete(),
    ],
}
