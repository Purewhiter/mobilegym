"""Scripted validation plans for SMS tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    back,
    complete,
    grounded_answer,
    open_answer_sheet,
    submit_answer_sheet,
    type_text,
    wait,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def hold_at(point: list[int], *, summary: str) -> Step:
    return {"op": "drag", "point1": point, "point2": point, "summary": summary}


def settings_button() -> Step:
    return click_selector('button:has(img[alt="action_bar_setting"]):visible', summary="open SMS settings")


def one_click_read_button() -> Step:
    return click_selector('button:has(img[alt="ic_one_click_button"]):visible', summary="mark all conversations read")


def row_with_text(text: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'div.flex.items-start:has-text("{text}"):visible',
        summary=summary or f"open conversation {text}",
    )


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


def answer_sheet_input(index: int) -> str:
    return f'[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child({index + 1}) input'


def grounded_choice_answer(choice: str, *, summary: str | None = None) -> list[Step]:
    steps = open_answer_sheet()
    steps.append(click_selector(f'button:has-text("{choice}"):visible', summary=f"choose answer {choice}"))
    steps.append(submit_answer_sheet(summary=summary))
    return steps


PLANS: dict[str, list[Step]] = {
    "sms.ToggleMainSetting": [
        settings_button(),
        settings_row_button("列表中显示头像"),
        complete(),
    ],
    "sms.OpenConversationBySender": [
        row_with_text("中国电信", summary="open 中国电信 conversation"),
        complete(),
    ],
    "sms.ReadUnreadConversationCount": [
        *grounded_answer("5", summary="answer unread conversation count"),
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
        settings_row_button("屏蔽陌生人的网络短信"),
        complete(),
    ],
    "sms.CompareConversationMessageCount": [
        *grounded_choice_answer("中国电信", summary="answer conversation with more messages"),
        complete(),
    ],
    "sms.DeleteConversation": [
        hold_at([500, 705], summary="long-press 建设银行 conversation"),
        click_selector('button:has-text("删除"):visible', summary="delete 建设银行 conversation"),
        complete(),
    ],
    "sms.ReplyToLatestUnread": [
        *send_reply("华为云", "{content}"),
        complete(),
    ],
    "sms.FindAndReplySendersByKeyword": [
        *send_reply("中国电信", "{reply}"),
        complete(),
    ],
}
