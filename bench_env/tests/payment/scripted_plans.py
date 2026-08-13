"""Scripted validation plans for Payment tasks.

All Alipay transfers go through the **transfer-to-account form** typing the
contact's full display name: ``TransferToAlipayPage.matchedContact`` matches
``contact.name === inputValue`` exactly (display names are unique in the
contacts table, and no name collides with another contact's phone /
bracket-stripped alias), so any sampled contact resolves deterministically.
The transfer-page contact list is *not* used for contact selection — it only
shows recent-transfer contacts inside a scroll container, so a sampled
contact deep in the list would sit outside the viewport and the
``transfer.amount.open`` trigger tap would time out (selector matches outside
the viewport are skipped by the env).

Sampling compatibility (``DERIVED_PARAMS``): every plan placeholder that is
not a declared task parameter is computed at materialization time from the
episode's post-setup initial state through the *judge-homologous* domain
classes — calculators build ``Alipay(init_state["apps"]["alipay"])`` /
``Wechat(init_state["apps"]["wechat"])`` exactly like judges build them from
``input.apps_init``, so derived values cannot drift from the judge:

- ``wechatId`` — WeChat contact display name → wxid (``chat.open`` trigger
  param), via the same ``require_contact_wxid`` lookup judges use.
- ``password`` / ``oldPassword`` — ``userInfo.paymentPassword`` from the
  initial state (task templates fix it to 123456; ChangePassword's
  ``_prepare`` pins 000000 before the episode starts).
- ``balance1..5`` — initial ``balance.total`` minus the running transfer sum
  (mirrors ``AlipayContinuousPaymentsToContactsRecordBalances.check_goals``:
  amounts rounded to 2 decimals, floored at 0).
- ``startBalanceText`` — initial balance rendered like the balance page
  (``toLocaleString('en-US', {minimumFractionDigits: 2})``).

Explicit test injections would still win over these calculators;
``test_scripted.py`` deliberately injects declared parameters only, so the
live cases regression-test this derivation path end to end.

Runtime values read from the screen (``read_text`` → ``{var:…}``):

- ``bind_bank_card`` no longer types a pinned SMS code: the code is generated
  *during* the episode via ``crypto.getRandomValues`` (os/SmsGateway.ts) and
  cannot be derived from the initial state (plans materialize once, on the
  first act()). The plan now opens the SMS app, reads the code off the
  conversation preview with ``read_text`` (extract regex ``验证码：(六位数字)``),
  returns to Alipay and types ``{var:…}`` — the same navigate-and-read
  detour a human/vision agent performs. This unblocks the plain
  ``--agent scripted`` sampling path for
  ``payment.AlipayBindMultipleCardsTransferAndRecordSuccessfulCards``; the
  live tests' ``DeterministicBindCards`` crypto patch stays for
  deterministic coverage and is simply read back as ``111111``.

Static literals kept on purpose (not derivable, recorded as exemptions):

- Step budget: the two L4 multi-transfer plans exceed the L4 difficulty
  default (``DIFFICULTY_MAX_STEPS[L4] == 60``) — ContinuousPayments needs
  141~166 steps at runtime (amount keypad expands per sampled digit),
  BindMultipleCards ~118 — so both tasks declare their own ``max_steps``
  (180 / 130), honored by ``RunnerConfig.get_max_steps`` on the plain
  ``--agent scripted`` sampling path and in the live tests alike; no
  ``--max-steps`` override needed.
- ``wechat_pay_password("123456")``: the WeChat pay sheet accepts any 6
  digits (PaymentConfirmationPage completes on length, no comparison) — a
  fixed keypad sequence, not task data.
- Bind-cards card names (建设银行/工商银行/农业银行) are task invariants fixed
  by the task's ``_prepare`` and the task template, not sampled parameters.
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Step,
    assert_text,
    awake,
    back,
    complete,
    enter,
    home,
    keypad_text,
    read_text,
    tap_action,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.task.alipay.app import Alipay
from bench_env.task.wechat.app import Wechat


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


def bind_bank_card(bank_name: str, *, code_var: str) -> list[Step]:
    """Bind a bank card, reading the runtime-generated SMS code off the screen.

    The verification page (AddBankCardVerifyPage) generates the code during
    the episode and delivers it to the SMS app as
    ``【中国{bank_name}】验证码：XXXXXX，5分钟内有效``. The plan switches to the
    SMS app, reads the code from that bank's conversation preview into the
    episode variable ``code_var`` (``read_text``), switches back and types
    ``{var:<code_var>}`` into the (plain input) code field — the backgrounded
    Alipay verify page keeps its expected code. Reading from the persistent
    SMS conversation, not the transient heads-up banner, keeps the step free
    of the banner's 3.8–5.2s auto-hide race; by the time the success page's
    top-right 完成 button is tapped the banner is long gone.
    """
    return [
        tap_trigger("bankCards.add.open", summary=f"open add-card page for {bank_name}"),
        wait(0.4, summary="wait for add-card page"),
        type_text(bank_name, selector='input:visible', clear=True, summary=f"filter bank list to {bank_name}"),
        click_selector(f'xpath=//div[contains(normalize-space(),"{bank_name}")]/ancestor::div[contains(@class,"px-4")][1]//button[contains(normalize-space(),"添加")]', summary=f"choose {bank_name} add"),
        click_selector('button:has-text("同意协议并添加"):visible, button:has-text("同意并添加"):visible', summary="agree and add selected bank card"),
        wait(0.8, summary="wait for SMS verification page and code delivery"),
        awake("短信", summary="open SMS app to read the verification code"),
        wait(0.5, summary="wait for SMS conversation list"),
        read_text(
            f'xpath=//p[contains(normalize-space(),"{bank_name}") and contains(normalize-space(),"验证码")]',
            var=code_var,
            extract=r"验证码：(\d{6})",
            summary=f"read {bank_name} SMS verification code into {{var:{code_var}}}",
        ),
        awake("Alipay", summary="return to Alipay verification page"),
        wait(0.5, summary="wait for verification page"),
        type_text("{var:" + code_var + "}", selector='input[type="tel"]:visible', clear=True, summary="enter SMS code read from the SMS app"),
        wait(0.8, summary="wait for card-added success"),
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


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (check_goals in
# bench_env/task/payment/tasks.py) through the same Alipay / Wechat domain
# classes over the same initial state, so the derived values are
# judge-homologous by construction.

def _alipay(state: dict[str, Any]) -> Alipay:
    """Judge-homologous accessor: ``Alipay(init_state["apps"]["alipay"])``."""
    return Alipay(state["apps"]["alipay"])


def _wechat(state: dict[str, Any]) -> Wechat:
    """Judge-homologous accessor: ``Wechat(init_state["apps"]["wechat"])``."""
    return Wechat(state["apps"]["wechat"])


def _alipay_password(task: Any, state: dict[str, Any]) -> str:
    """Current payment password (``userInfo.paymentPassword``) — 123456 from
    defaults for the fixed-password templates; 000000 where ``_prepare`` pins
    the old password (mirrors ``check_password_changed``'s old value)."""
    return _alipay(state).payment_password


def _wechat_chat_id(state: dict[str, Any], contact_name: Any) -> str:
    """``chat.open`` trigger param: contact wxid == chat id — the same
    ``require_contact_wxid`` lookup the WeChat judges use."""
    return _wechat(state).require_contact_wxid(str(contact_name))


def _money(value: float) -> str:
    """Amount as a human would write it in a note (no trailing zeros)."""
    return f"{float(value):.2f}".rstrip("0").rstrip(".")


def _balance_after(task: Any, state: dict[str, Any], count: int) -> str:
    """Balance after the first ``count`` transfers — mirrors the judge's
    ``expected_balances_seq``: start from initial ``balance.total``, subtract
    each amount rounded to 2 decimals, floor at 0."""
    running = float(_alipay(state).total_balance)
    for index in range(1, count + 1):
        running = max(0.0, running - round(float(getattr(task.p, f"amount{index}")), 2))
    return _money(running)


def _start_balance_display(task: Any, state: dict[str, Any]) -> str:
    """Initial balance as the balance page renders it —
    ``toLocaleString('en-US', {minimumFractionDigits: 2})`` (BalancePage.tsx)."""
    return f"{float(_alipay(state).total_balance):,.2f}"


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "payment.TransferToContactWithNote": {
        "password": _alipay_password,
    },
    "payment.AlipayContinuousPaymentsToContactsRecordBalances": {
        "password": _alipay_password,
        "startBalanceText": _start_balance_display,
        "balance1": lambda task, state: _balance_after(task, state, 1),
        "balance2": lambda task, state: _balance_after(task, state, 2),
        "balance3": lambda task, state: _balance_after(task, state, 3),
        "balance4": lambda task, state: _balance_after(task, state, 4),
        "balance5": lambda task, state: _balance_after(task, state, 5),
    },
    "payment.AlipayBindMultipleCardsTransferAndRecordSuccessfulCards": {
        "password": _alipay_password,
    },
    "payment.AlipayChangePaymentPasswordThenPay": {
        "oldPassword": _alipay_password,
    },
    "payment.AlipayTransferAndNotify": {
        "wechatId": lambda task, state: _wechat_chat_id(state, task.p.contact),
        "password": _alipay_password,
    },
    "payment.WechatExtractAmountTransfer": {
        "wechatId": lambda task, state: _wechat_chat_id(state, task.p.contact),
        "password": _alipay_password,
    },
}


PLANS: dict[str, list[Step]] = {
    "payment.TransferToContactWithNote": [
        *transfer_account_success("{name}", "{amount}", note="{note}"),
        complete(),
    ],
    "payment.AlipayContinuousPaymentsToContactsRecordBalances": [
        # Gather: read the starting balance once (Me tab → balance page) before
        # the first transfer; each post-transfer balance recorded in the note is
        # the start balance minus the running transfer total (task reasoning).
        awake("Alipay", summary="open Alipay"),
        wait(0.5, summary="wait for Alipay foreground"),
        tap_trigger("tab.my", summary="open Alipay Me tab"),
        wait(0.4, summary="wait for Me tab"),
        tap_trigger("balance.open", summary="open Alipay balance page"),
        wait(0.6, summary="wait for balance page"),
        assert_text("{startBalanceText}", summary="assert starting balance on screen"),
        back(summary="leave balance page"),
        wait(0.3, summary="wait for Me tab after balance page"),
        tap_trigger("tab.home", summary="return to Alipay home tab"),
        wait(0.3, summary="wait for Alipay home tab"),
        *transfer_account_success("{contact1}", "{amount1}", note="发工资"),
        *transfer_account_from_transfer_page_success("{contact2}", "{amount2}", note="发工资"),
        *transfer_account_from_transfer_page_success("{contact3}", "{amount3}", note="发工资"),
        *transfer_account_from_transfer_page_success("{contact4}", "{amount4}", note="发工资"),
        *transfer_account_from_transfer_page_success("{contact5}", "{amount5}", note="发工资"),
        *create_note(
            "{noteTitle}",
            "{balance1}\n{balance2}\n{balance3}\n{balance4}\n{balance5}",
        ),
        complete(),
    ],
    "payment.AlipayBindMultipleCardsTransferAndRecordSuccessfulCards": [
        *open_alipay_bank_cards(),
        *bind_bank_card("工商银行", code_var="icbcCode"),
        *bind_bank_card("农业银行", code_var="abcCode"),
        back(summary="return to Alipay Me tab after binding cards"),
        tap_trigger("tab.home", summary="open Alipay Home tab"),
        trigger_visible("transfer.open", summary="open Alipay transfer"),
        wait(0.4, summary="wait for transfer page"),
        *transfer_account_from_transfer_page_with_card("{targetAccount}", "{amount1}", "建设银行", expect_success=True),
        *transfer_account_from_transfer_page_with_card("{targetAccount}", "{amount2}", "工商银行", expect_success=False),
        *transfer_account_from_account_form_with_card("{targetAccount}", "{amount3}", "农业银行", expect_success=True),
        # Bank names only — no card tails: the newly bound cards get random
        # last4 digits (AddBankCardVerifyPage generate19Digits), so a literal
        # tail would be fabricated. The judge's marker groups accept the bank
        # name alone (successful_transfer_card_marker_groups_to_target markers
        # include bankName; 中国-prefix stripping is handled by the matcher).
        *create_note("{noteTitle}", "建设银行储蓄卡\n中国农业银行储蓄卡"),
        complete(),
    ],
    "payment.AlipayChangePaymentPasswordThenPay": [
        *change_alipay_password(),
        *transfer_account_success("{contact}", "{amount}", password="{newPassword}"),
        complete(),
    ],
    "payment.SubscribeMembershipAutoRenewThenCancelInWechat": [
        *subscribe_bilibili_via_wechat(),
        *cancel_wechat_subscription(),
        complete(),
    ],
    "payment.AlipayTransferAndNotify": [
        *transfer_account_success("{alipay_contact}", "{amount}", note="{note}"),
        *send_wechat_message("{wechatId}", "已转账{amount}元"),
        complete(),
    ],
    "payment.WechatExtractAmountTransfer": [
        awake("Wechat", summary="open WeChat to inspect latest request"),
        trigger_param("chat.open", "id", "{wechatId}", summary="open requester chat"),
        wait(0.5, summary="inspect latest requested amount"),
        home(summary="return to launcher after inspecting WeChat"),
        *transfer_account_success("{alipay_contact}", "{requestAmount}"),
        awake("Wechat", summary="open WeChat requester chat"),
        type_text("{reply}", selector="textarea:visible", clear=True, summary="enter WeChat reply"),
        click_selector('button:has-text("发送"):visible', summary="send WeChat reply"),
        wait(0.4, summary="wait for WeChat send"),
        complete(),
    ],
}
