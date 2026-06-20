"""Scripted validation plans for Payment tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    awake,
    back,
    complete,
    enter,
    home,
    keypad_text,
    tap_action,
    tap_trigger,
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


def action_param(action_id: str, key: str, value: str, *, summary: str) -> Step:
    return click_selector(
        f'[data-action="{action_id}"][data-action-params*=\'"{key}":"{value}"\']:visible',
        summary=summary,
    )


def trigger_visible(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def action_visible(action_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-action="{action_id}"]:visible', summary=summary)


def amount_input() -> str:
    return 'input[placeholder="请输入金额"]:visible, input[placeholder="Enter amount"]:visible'


def note_input() -> str:
    return 'input[maxlength="50"]:visible'


def alipay_password(password: str = "{password}") -> list[Step]:
    if password.startswith("{") and password.endswith("}") and password.count("{") == 1 and password.count("}") == 1:
        field = password[1:-1]
        digits = [f"{{{field}[{idx}]}}" for idx in range(6)]
    else:
        digits = list(password)
    return [
        action_param("transferPassword.keypad.press", "digit", digit, summary=f"enter Alipay password digit {idx}")
        for idx, digit in enumerate(digits, start=1)
    ]


def wechat_pay_password(password: str = "123456") -> list[Step]:
    return [tap_action(f"wechat.pay.num.{digit}", summary=f"enter WeChat Pay digit {idx}") for idx, digit in enumerate(password, start=1)]


def open_alipay_transfer() -> list[Step]:
    return [
        awake("Alipay", summary="open Alipay"),
        trigger_visible("transfer.open", summary="open Alipay transfer"),
        wait(0.4, summary="wait for transfer page"),
    ]


def start_transfer_to_contact(contact_id: str) -> list[Step]:
    return [
        *open_alipay_transfer(),
        trigger_param("transfer.amount.open", "contactId", contact_id, summary=f"open transfer amount for contact {contact_id}"),
        wait(0.3, summary="wait for amount page"),
    ]


def start_transfer_to_contact_from_transfer_page(contact_id: str) -> list[Step]:
    return [
        trigger_param("transfer.amount.open", "contactId", contact_id, summary=f"open transfer amount for contact {contact_id}"),
        wait(0.3, summary="wait for amount page"),
    ]


def start_transfer_to_account(account: str) -> list[Step]:
    return [
        *open_alipay_transfer(),
        tap_trigger("transfer.toAccount.open", summary="open transfer-to-account form"),
        type_text(account, selector='[data-action="transferToAccount.account.input"]:visible', clear=True, summary=f"enter target account {account}"),
        trigger_visible("transfer.amount.open", summary="confirm matched Alipay account"),
        wait(0.3, summary="wait for amount page"),
    ]


def start_transfer_to_account_from_transfer_page(account: str) -> list[Step]:
    return [
        tap_trigger("transfer.toAccount.open", summary="open transfer-to-account form"),
        type_text(account, selector='[data-action="transferToAccount.account.input"]:visible', clear=True, summary=f"enter target account {account}"),
        trigger_visible("transfer.amount.open", summary="confirm matched Alipay account"),
        wait(0.3, summary="wait for amount page"),
    ]


def start_transfer_to_account_from_account_form(account: str) -> list[Step]:
    return [
        type_text(account, selector='[data-action="transferToAccount.account.input"]:visible', clear=True, summary=f"enter target account {account}"),
        trigger_visible("transfer.amount.open", summary="confirm matched Alipay account"),
        wait(0.3, summary="wait for amount page"),
    ]


def enter_amount_and_note(amount: str, note: str | None = None) -> list[Step]:
    steps: list[Step] = [
        keypad_text(
            amount,
            press_action="transferAmount.keypad.press",
            input_selector=amount_input(),
            toggle_action="transferAmount.keypad.toggle",
            summary=f"enter amount {amount}",
        ),
    ]
    if note is not None:
        steps.extend(
            [
                type_text(note, selector=note_input(), clear=True, summary=f"enter note {note}"),
                enter(summary="commit note input"),
                back(summary="dismiss note keyboard before opening password sheet"),
                wait(0.3, summary="wait for transfer button after note keyboard dismiss"),
            ]
        )
    return steps


def finish_transfer(password: str = "{password}") -> list[Step]:
    return [
        tap_trigger("transferAmount.password.open", summary="open Alipay password sheet"),
        wait(0.4, summary="wait for password sheet"),
        *alipay_password(password),
        wait(0.8, summary="wait for transfer result"),
    ]


def transfer_contact(contact_id: str, amount: str, *, note: str | None = None, password: str = "{password}") -> list[Step]:
    return [
        *start_transfer_to_contact(contact_id),
        *enter_amount_and_note(amount, note),
        *finish_transfer(password),
    ]


def transfer_contact_from_transfer_page(contact_id: str, amount: str, *, note: str | None = None, password: str = "{password}") -> list[Step]:
    return [
        *start_transfer_to_contact_from_transfer_page(contact_id),
        *enter_amount_and_note(amount, note),
        *finish_transfer(password),
    ]


def transfer_contact_success(contact_id: str, amount: str, *, note: str | None = None, password: str = "{password}") -> list[Step]:
    return [
        *transfer_contact(contact_id, amount, note=note, password=password),
        tap_trigger("transfer.success.done", summary="finish successful transfer"),
        wait(0.4, summary="return to transfer page"),
    ]


def transfer_contact_from_transfer_page_success(contact_id: str, amount: str, *, note: str | None = None, password: str = "{password}") -> list[Step]:
    return [
        *transfer_contact_from_transfer_page(contact_id, amount, note=note, password=password),
        tap_trigger("transfer.success.done", summary="finish successful transfer"),
        wait(0.4, summary="return to transfer page"),
    ]


def transfer_account_success(account: str, amount: str, *, note: str | None = None, password: str = "{password}") -> list[Step]:
    return [
        *start_transfer_to_account(account),
        *enter_amount_and_note(amount, note),
        *finish_transfer(password),
        tap_trigger("transfer.success.done", summary="finish successful account transfer"),
        wait(0.4, summary="return to transfer page"),
    ]


def transfer_account_from_transfer_page_success(account: str, amount: str, *, note: str | None = None, password: str = "{password}") -> list[Step]:
    return [
        *start_transfer_to_account_from_transfer_page(account),
        *enter_amount_and_note(amount, note),
        *finish_transfer(password),
        tap_trigger("transfer.success.done", summary="finish successful account transfer"),
        wait(0.4, summary="return to transfer page"),
    ]


def transfer_account_with_card(account: str, amount: str, card_text: str, *, expect_success: bool) -> list[Step]:
    steps: list[Step] = [
        *start_transfer_to_account(account),
        *enter_amount_and_note(amount, None),
        tap_trigger("transferAmount.password.open", summary=f"open password sheet for {card_text}"),
        wait(0.4, summary="wait for password sheet"),
        click_selector("button.w-full.flex.items-center.justify-center.py-2:visible", summary="expand payment methods"),
        click_selector(f'button:has-text("{card_text}"):visible', summary=f"select payment card {card_text}"),
        *alipay_password("{password}"),
        wait(0.8, summary="wait for transfer attempt result"),
    ]
    if expect_success:
        steps.extend(
            [
                tap_trigger("transfer.success.done", summary="finish successful card transfer"),
                wait(0.4, summary="return to transfer page"),
            ]
        )
    else:
        steps.extend(
            [
                back(summary="leave failed transfer amount page"),
                wait(0.3),
                back(summary="return to transfer page after failed attempt"),
                wait(0.3),
            ]
        )
    return steps


def transfer_account_from_transfer_page_with_card(account: str, amount: str, card_text: str, *, expect_success: bool) -> list[Step]:
    steps: list[Step] = [
        *start_transfer_to_account_from_transfer_page(account),
        *enter_amount_and_note(amount, None),
        tap_trigger("transferAmount.password.open", summary=f"open password sheet for {card_text}"),
        wait(0.4, summary="wait for password sheet"),
        click_selector("button.w-full.flex.items-center.justify-center.py-2:visible", summary="expand payment methods"),
        click_selector(f'button:has-text("{card_text}"):visible', summary=f"select payment card {card_text}"),
        *alipay_password("{password}"),
        wait(0.8, summary="wait for transfer attempt result"),
    ]
    if expect_success:
        steps.extend(
            [
                tap_trigger("transfer.success.done", summary="finish successful card transfer"),
                wait(0.4, summary="return to transfer page"),
            ]
        )
    else:
        steps.extend(
            [
                back(summary="leave failed transfer amount page"),
                wait(0.3),
                back(summary="return to transfer page after failed attempt"),
                wait(0.3),
            ]
        )
    return steps


def transfer_account_from_account_form_with_card(account: str, amount: str, card_text: str, *, expect_success: bool) -> list[Step]:
    steps: list[Step] = [
        *start_transfer_to_account_from_account_form(account),
        *enter_amount_and_note(amount, None),
        tap_trigger("transferAmount.password.open", summary=f"open password sheet for {card_text}"),
        wait(0.4, summary="wait for password sheet"),
        click_selector("button.w-full.flex.items-center.justify-center.py-2:visible", summary="expand payment methods"),
        click_selector(f'button:has-text("{card_text}"):visible', summary=f"select payment card {card_text}"),
        *alipay_password("{password}"),
        wait(0.8, summary="wait for transfer attempt result"),
    ]
    if expect_success:
        steps.extend(
            [
                tap_trigger("transfer.success.done", summary="finish successful card transfer"),
                wait(0.4, summary="return to transfer page"),
            ]
        )
    else:
        steps.extend(
            [
                back(summary="leave failed transfer amount page"),
                wait(0.3),
                back(summary="return to transfer page after failed attempt"),
                wait(0.3),
            ]
        )
    return steps


def create_note(title: str, content: str) -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("Notes", summary="open Notes app"),
        click_selector('button[aria-label="新建笔记"]:visible, button[aria-label="New note"]:visible', summary="create new note"),
        wait(0.4, summary="wait for note editor"),
        type_text(title, selector='input[placeholder="标题"]:visible', clear=True, summary=f"enter note title {title}"),
        enter(summary="commit note title"),
        back(summary="dismiss title keyboard before entering note content"),
        wait(0.3, summary="wait for note content area after title keyboard dismiss"),
        type_text(content, selector="textarea:visible", clear=True, summary="enter note content"),
        click_selector('button[aria-label="完成"]:visible, button[aria-label="Done"]:visible', summary="save and leave note editor"),
        wait(1.0, summary="wait for note autosave"),
    ]


def bind_bank_card(bank_name: str) -> list[Step]:
    return [
        tap_trigger("bankCards.add.open", summary=f"open add-card page for {bank_name}"),
        wait(0.4, summary="wait for add-card page"),
        type_text(bank_name, selector='input:visible', clear=True, summary=f"filter bank list to {bank_name}"),
        click_selector(f'xpath=//div[contains(normalize-space(),"{bank_name}")]/ancestor::div[contains(@class,"px-4")][1]//button[contains(normalize-space(),"添加")]', summary=f"choose {bank_name} add"),
        click_selector('button:has-text("同意协议并添加"):visible, button:has-text("同意并添加"):visible', summary="agree and add selected bank card"),
        wait(0.8, summary="wait for SMS verification page"),
        type_text("111111", selector='input[type="tel"]:visible', clear=True, summary="enter deterministic bank SMS code"),
        wait(0.8, summary="wait for card-added success"),
        {"op": "click", "point": [500, 80], "summary": "open SMS notification to consume heads-up"},
        wait(0.5, summary="wait for SMS app"),
        awake("Alipay", summary="return to Alipay card success page"),
        wait(0.5, summary="wait for success page"),
        click_selector('button:has-text("完成"):visible', summary="finish card binding"),
        wait(0.5, summary="return to bank cards"),
    ]


def open_alipay_bank_cards() -> list[Step]:
    return [
        awake("Alipay", summary="open Alipay"),
        tap_trigger("tab.my", summary="open Alipay Me tab"),
        tap_trigger("bankCards.open", summary="open bank cards"),
        wait(0.4, summary="wait for bank cards page"),
    ]


def change_alipay_password() -> list[Step]:
    return [
        awake("Alipay", summary="open Alipay"),
        tap_trigger("tab.my", summary="open Alipay Me tab"),
        tap_trigger("settings.open", summary="open Alipay settings"),
        tap_trigger("settings.payment.open", summary="open Alipay payment settings"),
        click_selector(
            'xpath=//span[normalize-space()="支付密码"]/ancestor::div[contains(@class,"items-center")][1]',
            summary="open payment password page",
        ),
        wait(0.4, summary="wait for payment password page"),
        click_selector('xpath=//button[normalize-space()="记得"]', summary="choose remembered current password"),
        type_text("{oldPassword}", selector='input[type="tel"]:visible', clear=True, summary="enter current payment password"),
        wait(0.5, summary="wait for new-password step"),
        type_text("{newPassword}", selector='input[type="tel"]:visible', clear=True, summary="enter new payment password"),
        wait(1.2, summary="wait for password change to return"),
        back(summary="return to Alipay settings after changing password"),
        wait(0.3, summary="wait for settings page"),
        back(summary="return to Alipay Me tab after changing password"),
        wait(0.3, summary="wait for Me tab"),
        tap_trigger("tab.home", summary="open Alipay Home tab after changing password"),
        wait(0.3, summary="wait for Alipay Home"),
    ]


def send_wechat_message(chat_id: str, text: str) -> list[Step]:
    return [
        awake("Wechat", summary="open WeChat"),
        trigger_param("chat.open", "id", chat_id, summary=f"open WeChat chat {chat_id}"),
        type_text(text, selector="textarea:visible", clear=True, summary=f"enter WeChat message {text}"),
        click_selector('button:has-text("发送"):visible', summary="send WeChat message"),
        wait(0.4, summary="wait for WeChat send"),
    ]


def subscribe_bilibili_via_wechat() -> list[Step]:
    return [
        awake("Bilibili", summary="open Bilibili"),
        tap_trigger("tab.me", summary="open Bilibili Me tab"),
        tap_trigger("vip.open", summary="open Bilibili VIP center"),
        click_selector('xpath=//div[normalize-space()="连续包月"]/ancestor::div[contains(@class,"flex-shrink-0")][1]', summary="select monthly auto-renew package"),
        click_selector(
            'xpath=//div[contains(@class,"rounded-lg") and contains(@class,"p-3") and contains(normalize-space(.),"使用") and contains(normalize-space(.),"支付宝")]',
            summary="open payment method selector",
        ),
        click_selector('span:has-text("微信支付"):visible', summary="select WeChat Pay"),
        tap_trigger("vip.pay.confirm", summary="confirm VIP payment"),
        wait(1.0, summary="wait for WeChat Pay activity"),
        tap_action("wechat.pay.confirm", summary="confirm WeChat Pay"),
        wait(0.4, summary="wait for WeChat password sheet"),
        *wechat_pay_password(),
        wait(2.0, summary="wait for payment to finish and return"),
    ]


def cancel_wechat_subscription() -> list[Step]:
    return [
        awake("Wechat", summary="open WeChat"),
        tap_trigger("tab.me", summary="open WeChat Me tab"),
        tap_trigger("me.services.open", summary="open WeChat services"),
        tap_trigger("wallet.open", summary="open WeChat wallet"),
        tap_trigger("paymentSettings.open", summary="open payment settings"),
        tap_trigger("paymentSettings.subscriptions.open", summary="open auto-renew subscriptions"),
        tap_trigger("subscription.detail.open", summary="open new subscription detail"),
        tap_trigger("subscription.cancel", summary="open cancel subscription dialog"),
        tap_action("subscription.cancel.confirm", summary="confirm cancel subscription"),
        wait(0.5, summary="wait for subscription cancellation"),
    ]


PLANS: dict[str, list[Step]] = {
    "payment.TransferToContactWithNote": [
        *transfer_contact_success("{contactId}", "{amount}", note="{note}"),
        complete(),
    ],
    "payment.AlipayContinuousPaymentsToContactsRecordBalances": [
        *transfer_account_success("13867891288", "{amount1}", note="发工资"),
        *transfer_account_from_transfer_page_success("13945678909", "{amount2}", note="发工资"),
        *transfer_account_from_transfer_page_success("13256784311", "{amount3}", note="发工资"),
        *transfer_account_from_transfer_page_success("15990129012", "{amount4}", note="发工资"),
        *transfer_account_from_transfer_page_success("13512341234", "{amount5}", note="发工资"),
        *create_note(
            "{noteTitle}",
            "{balance1}\n{balance2}\n{balance3}\n{balance4}\n{balance5}",
        ),
        complete(),
    ],
    "payment.AlipayBindMultipleCardsTransferAndRecordSuccessfulCards": [
        *open_alipay_bank_cards(),
        *bind_bank_card("工商银行"),
        *bind_bank_card("农业银行"),
        back(summary="return to Alipay Me tab after binding cards"),
        tap_trigger("tab.home", summary="open Alipay Home tab"),
        trigger_visible("transfer.open", summary="open Alipay transfer"),
        wait(0.4, summary="wait for transfer page"),
        *transfer_account_from_transfer_page_with_card("{targetAccount}", "{amount1}", "建设银行", expect_success=True),
        *transfer_account_from_transfer_page_with_card("{targetAccount}", "{amount2}", "工商银行", expect_success=False),
        *transfer_account_from_account_form_with_card("{targetAccount}", "{amount3}", "农业银行", expect_success=True),
        *create_note("{noteTitle}", "建设银行储蓄卡（5445）\n中国农业银行储蓄卡（0504）"),
        complete(),
    ],
    "payment.AlipayChangePaymentPasswordThenPay": [
        *change_alipay_password(),
        *transfer_contact_success("{contactId}", "{amount}", password="{newPassword}"),
        complete(),
    ],
    "payment.SubscribeMembershipAutoRenewThenCancelInWechat": [
        *subscribe_bilibili_via_wechat(),
        *cancel_wechat_subscription(),
        complete(),
    ],
    "payment.AlipayTransferAndNotify": [
        *transfer_contact_success("{alipayContactId}", "{amount}", note="{note}"),
        *send_wechat_message("{wechatId}", "已转账{amount}元"),
        complete(),
    ],
    "payment.WechatExtractAmountTransfer": [
        awake("Wechat", summary="open WeChat to inspect latest request"),
        trigger_param("chat.open", "id", "{wechatId}", summary="open requester chat"),
        wait(0.5, summary="inspect latest requested amount"),
        home(summary="return to launcher after inspecting WeChat"),
        *transfer_contact_success("{alipayContactId}", "{requestAmount}"),
        awake("Wechat", summary="open WeChat requester chat"),
        type_text("{reply}", selector="textarea:visible", clear=True, summary="enter WeChat reply"),
        click_selector('button:has-text("发送"):visible', summary="send WeChat reply"),
        wait(0.4, summary="wait for WeChat send"),
        complete(),
    ],
}
