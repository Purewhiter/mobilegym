"""
Payment specialized task definitions.

覆盖支付、绑卡、转账、充值、购票支付、退款等付款链路。
"""
# -- Task Index (auto-generated, do not edit) --
# 7 tasks | L3×2  L4×5
#
# [L4] AlipayContinuousPaymentsToContactsRecordBalances         我的密码是123456。帮我用支付宝连续给{contact1}、{contact2}、{contact3}、{contact4}、{contact5}转账，金额依次是{amount1}、{amount2}、{amount3}、{amount4}、{amount5}，备注都写“发工资”，并把每次转账后的余额记到标题为{noteTitle}的备忘录里
# [L4] AlipayBindMultipleCardsTransferAndRecordSuccessfulCards  我的支付宝密码是123456。帮我在支付宝绑定工商银行储蓄卡和农业银行储蓄卡，再按银行卡绑定顺序用三张银行卡分别向{targetAccount}转账{amount1}、{amount2}、{amount3}，并把转账成功的银行卡记到标题为{noteTitle}的备忘录里
# [L4] AlipayChangePaymentPasswordThenPay                       我现在的密码是000000。帮我把支付宝支付密码改成{newPassword}，然后马上转账{amount}元给{contact}
# [L3] TransferToContactWithNote                                我的密码是123456。请你用支付宝给{name}转{amount}元，备注写“{note}”
# [L4] SubscribeMembershipAutoRenewThenCancelInWechat           帮我使用微信支付开通哔哩哔哩大会员连月自动续费，然后到微信把这项自动续费关闭
# [L3] AlipayTransferAndNotify                                  我的支付宝密码是123456。请你用支付宝给{alipay_contact}转{amount}元，备注写“{note}”，然后在微信里把这笔转账告知{contact}
# [L4] WechatExtractAmountTransfer                              看看微信里{contact}最近发来的消息，对方让你转多少钱，你就用支付宝转给{alipay_contact}多少，然后回复{reply}
# -- End Task Index --


from __future__ import annotations

import random
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.alipay.app import Alipay, TxMatch as _TxMatch
from bench_env.task.bilibili.app import Bilibili
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import Notes
from bench_env.task.utils import extract_numbers, now_ms
from bench_env.task.wechat.app import Wechat


def _quantize_money2(params: dict[str, Any], keys: tuple[str, ...]) -> None:
    """将转账类金额统一为最多两位小数（用户入参与采样结果均适用）。"""
    for k in keys:
        if k in params:
            params[k] = round(float(params[k]), 2)


def _distinct_alipay_contact_names(env_state: dict[str, Any]) -> list[str]:
    contacts = (env_state.get("apps") or {}).get("alipay", {}).get("contacts") or []
    out: list[str] = []
    seen: set[str] = set()
    for c in contacts:
        if isinstance(c, dict) and c.get("name"):
            n = str(c["name"]).strip()
            if n and n not in seen:
                seen.add(n)
                out.append(n)
    return out


def _reassign_five_distinct_contacts(
    params: dict[str, Any],
    user_param_keys: set[str],
    pool: list[str],
    seed: int | None,
) -> None:
    """保证 contact1..5 互不相同；优先保留用户显式传入且不重复的联系人。"""
    keys = [f"contact{i}" for i in range(1, 6)]
    if len(pool) < 5:
        return
    rng = random.Random(int(seed) if seed is not None else 0)
    slots: list[str | None] = [None] * 5
    used: set[str] = set()
    for i, k in enumerate(keys):
        if k not in user_param_keys:
            continue
        n = str(params.get(k, "")).strip()
        if n and n not in used:
            slots[i] = n
            used.add(n)
    avail = [n for n in pool if n not in used]
    rng.shuffle(avail)
    ai = 0
    for i in range(5):
        if slots[i] is not None:
            continue
        while ai < len(avail):
            n = avail[ai]
            ai += 1
            if n not in used:
                slots[i] = n
                used.add(n)
                break
    for i in range(5):
        if slots[i] is None:
            for n in pool:
                if n not in used:
                    slots[i] = n
                    used.add(n)
                    break
    for i, k in enumerate(keys):
        if slots[i] is not None:
            params[k] = slots[i]


class AlipayContinuousPaymentsToContactsRecordBalances(BaseTask):
    """判定：5 笔转账都命中，最终余额正确，且目标备忘录按顺序记录每次转账后的余额。

    五个收款联系人必须互不相同；若参数采样出现重复，会在 post_sample 阶段从支付宝通讯录内重选补齐。
    备忘录标题由模板固定提供，judge 可据此稳定定位唯一产物，不依赖具体写法。
    """
    templates = [
        "我的密码是123456。帮我用支付宝连续给{contact1}、{contact2}、{contact3}、{contact4}、{contact5}转账，金额依次是{amount1}、{amount2}、{amount3}、{amount4}、{amount5}，备注都写“发工资”，并把每次转账后的余额记到标题为{noteTitle}的备忘录里",
        'My password is 123456. Use Alipay to transfer money to {contact1}, {contact2}, {contact3}, {contact4}, and {contact5} in order, with amounts {amount1}, {amount2}, {amount3}, {amount4}, and {amount5} respectively. Write "发工资" as the note for each transfer, and record the balance after each transfer in a note titled {noteTitle}',
    ]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["finance", "handoff", "create", "reasoning"]
    apps = ["alipay", "notes"]
    expected_changes = [
        "apps.alipay.transferRecords",
        "apps.alipay.balance",
        "apps.alipay.lastPaymentHint",
        "apps.alipay.transferDraft",
        "apps.alipay.transferReceipt",
        "apps.notes.notes",
    ]
    parameters = {
        "amount1": {"type": "float", "default": 88.0, "min": 1, "max": 9999, "round": 2, "description": "第1笔金额"},
        "amount2": {"type": "float", "default": 120.0, "min": 1, "max": 9999, "round": 2, "description": "第2笔金额"},
        "amount3": {"type": "float", "default": 96.0, "min": 1, "max": 9999, "round": 2, "description": "第3笔金额"},
        "amount4": {"type": "float", "default": 156.0, "min": 1, "max": 9999, "round": 2, "description": "第4笔金额"},
        "amount5": {"type": "float", "default": 110.0, "min": 1, "max": 9999, "round": 2, "description": "第5笔金额"},
        "contact1": {"type": "string", "source": "apps.alipay.contacts[name]", "default": "锐(郭锐)", "description": "第1个联系人显示名"},
        "contact2": {"type": "string", "source": "apps.alipay.contacts[name]", "default": "于奶奶(于桂兰)", "description": "第2个联系人显示名"},
        "contact3": {"type": "string", "source": "apps.alipay.contacts[name]", "default": "浩杰(李浩杰)", "description": "第3个联系人显示名"},
        "contact4": {"type": "string", "source": "apps.alipay.contacts[name]", "default": "老王(王建国)", "description": "第4个联系人显示名"},
        "contact5": {"type": "string", "source": "apps.alipay.contacts[name]", "default": "阿明(张明)", "description": "第5个联系人显示名"},
        "noteTitle": {"type": "string", "default": "工资支付记录", "description": "备忘录标题"},
    }

    async def _post_sample(self, env: Any) -> None:
        _quantize_money2(
            self.params,
            ("amount1", "amount2", "amount3", "amount4", "amount5"),
        )
        contact_keys = tuple(f"contact{i}" for i in range(1, 6))
        if len({str(self.params[k]) for k in contact_keys}) < 5:
            state = await env.get_state()
            _reassign_five_distinct_contacts(
                self.params,
                self._user_params,
                _distinct_alipay_contact_names(state),
                self._seed,
            )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali_init = Alipay(input.apps_init["alipay"])
        ali = Alipay(input.apps["alipay"])
        notes = Notes(input.apps["notes"])

        amounts = [
            round(float(self.p.amount1), 2),
            round(float(self.p.amount2), 2),
            round(float(self.p.amount3), 2),
            round(float(self.p.amount4), 2),
            round(float(self.p.amount5), 2),
        ]
        start_balance = float(ali_init.total_balance)
        expected_balance = max(0.0, start_balance - float(sum(amounts)))
        since_ms = now_ms(input.os_init)
        contacts = [
            str(self.p.contact1),
            str(self.p.contact2),
            str(self.p.contact3),
            str(self.p.contact4),
            str(self.p.contact5),
        ]
        matches = [
            _TxMatch(counterparty=contact, amount=amount, note="发工资")
            for contact, amount in zip(contacts, amounts, strict=True)
        ]

        expected_balances_seq = []
        running = start_balance
        for amt in amounts:
            running = max(0.0, running - float(amt))
            expected_balances_seq.append(running)

        return [
            ali.check_matching_transfers(matches, since_ms=since_ms),
            ali.check_total_balance(expected_balance),
            notes.check_note_title_exists(str(self.p.noteTitle)),
            notes.check_note_with_title_has_number_sequence(
                str(self.p.noteTitle),
                expected_balances_seq,
                field="notes.balances.sequence",
            ),
        ]


class AlipayBindMultipleCardsTransferAndRecordSuccessfulCards(BaseTask):
    """判定：两张新卡已绑定，向目标账户发起了 3 次银行卡转账尝试，其中成功的卡被记入指定备忘录。

    初始额度：建行/农行足够覆盖采样金额（≤9999）；工行额度低于最小第二笔金额，第二笔按「绑定顺序」用工行时会余额不足，
    从而形成「第 1、3 笔成功、第 2 笔失败」等符合 max_count=2 的 Human 可完成路径。judge 仍只要求成功笔数 1～2 笔且三卡均有尝试。
    """
    templates = [
        "我的支付宝密码是123456。帮我在支付宝绑定工商银行储蓄卡和农业银行储蓄卡，再按银行卡绑定顺序用三张银行卡分别向{targetAccount}转账{amount1}、{amount2}、{amount3}，并把转账成功的银行卡记到标题为{noteTitle}的备忘录里",
        "My Alipay password is 123456. Bind the ICBC debit card and ABC debit card in Alipay, then use the three bank cards in binding order to transfer {amount1}, {amount2}, and {amount3} to {targetAccount}, and record the successfully transferred bank cards in a note titled {noteTitle}",
    ]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["finance", "handoff", "create"]
    apps = ["alipay", "notes"]
    expected_changes = [
        "apps.alipay.transferRecords",
        "apps.alipay.balance",
        "apps.alipay.bankCards",
        "apps.alipay.lastPaymentHint",
        "apps.alipay.transferDraft",
        "apps.alipay.transferReceipt",
        "apps.notes.notes",
        # 绑卡短信验证会写入系统短信与通知（Human Mode 常见）
        "os.notifications",
        "os.providers.sms",
    ]
    parameters = {
        "targetAccount": {"type": "string", "default": "13856785678", "description": "收款账户"},
        "amount1": {"type": "int", "default": 3500, "min": 1000, "max": 9999, "description": "第1笔转账金额（建行，额度充足）"},
        "amount2": {"type": "int", "default": 4500, "min": 1000, "max": 9999, "description": "第2笔转账金额（工行额度低于此范围最小值时会失败）"},
        "amount3": {"type": "int", "default": 6500, "min": 1000, "max": 9999, "description": "第3笔转账金额（农行，额度充足）"},
        "noteTitle": {"type": "string", "default": "银行卡转账结果", "description": "备忘录标题"},
    }

    async def _prepare(self, env: Any) -> None:
        await env.set_state(
            {
                "apps": {
                    "alipay": {
                        "balance": {"total": 200.0},
                        "bankCards": [
                            {
                                "id": "ccb",
                                "bankCode": "ccb",
                                "bankName": "建设银行储蓄卡",
                                "cardNumber": "6227000000000005445",
                                "last4": "5445",
                                "bound": True,
                                "available": 20000,
                            },
                            {
                                "id": "icbc",
                                "bankCode": "icbc",
                                "bankName": "工商银行储蓄卡",
                                "cardNumber": "6222000000000001234",
                                "last4": "1234",
                                "bound": False,
                                "available": 500,
                            },
                            {
                                "id": "abc",
                                "bankCode": "abc",
                                "bankName": "农业银行储蓄卡",
                                "cardNumber": "6228480000000006789",
                                "last4": "6789",
                                "bound": False,
                                "available": 20000,
                            },
                        ],
                        "transferRecords": [],
                        "lastPaymentHint": "",
                    }
                }
            },
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps["alipay"], init=input.apps_init["alipay"])
        notes = Notes(input.apps["notes"])
        amounts = [round(float(self.p.amount1), 2), round(float(self.p.amount2), 2), round(float(self.p.amount3), 2)]
        since_ms = now_ms(input.os_init)
        target_account = str(self.p.targetAccount)

        return [
            ali.check_successful_transfer_count_to_target(
                target_account,
                since_ms=since_ms,
                min_count=1,
                max_count=2,
            ),
            ali.check_successful_transfer_amounts_to_target(
                target_account,
                amounts,
                since_ms=since_ms,
            ),
            ali.check_bound_card_count_at_least(3),
            ali.check_transfer_attempted_card_count_to_target(
                target_account,
                since_ms=since_ms,
                expected_count=3,
            ),
            notes.check_note_with_title_mentions_groups(
                str(self.p.noteTitle),
                ali.successful_transfer_card_marker_groups_to_target(
                    target_account,
                    since_ms=since_ms,
                ),
                field="notes.success.bank_cards.recorded",
            ),
            notes.check_note_title_exists(str(self.p.noteTitle)),
        ]


class AlipayChangePaymentPasswordThenPay(BaseTask):
    """判定：支付密码已改为新值，且本次任务后新增了一笔对应金额的扣款记录。

    初始密码固定注入为旧值，避免“本来就是目标密码”导致空操作误过。
    """
    templates = [
        "我现在的密码是000000。帮我把支付宝支付密码改成{newPassword}，然后马上转账{amount}元给{contact}",
        "My current password is 000000. Change the Alipay payment password to {newPassword}, then immediately transfer {amount} yuan to {contact}",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["finance", "settings"]
    apps = ["alipay"]
    expected_changes = [
        "apps.alipay.userInfo",
        "apps.alipay.transferRecords",
        "apps.alipay.balance",
        "apps.alipay.lastPaymentHint",
        "apps.alipay.transferDraft",
        "apps.alipay.transferReceipt",
    ]
    parameters = {
        "newPassword": {"type": "string", "default": "123456", "pattern": r"\d{6}", "description": "新支付密码（6位数字）"},
        "contact": {
            "type": "string",
            "source": "apps.alipay.contacts[name]",
            "default": "浩杰(李浩杰)",
            "description": "收款方（须为通讯录已有联系人）",
        },
        "amount": {"type": "float", "default": 19.9, "min": 1, "max": 9999, "round": 2, "description": "支付金额"},
    }

    async def _prepare(self, env: Any) -> None:
        await env.set_state(
            {"apps": {"alipay": {"userInfo": {"paymentPassword": "000000"}}}},
            deep=True,
            reload=False,
        )

    async def _post_sample(self, env: Any) -> None:
        _quantize_money2(self.params, ("amount",))

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps["alipay"], init=input.apps_init["alipay"])
        return [
            ali.check_password_changed(str(self.p.newPassword), "000000"),
            ali.check_new_negative_transaction_amount(round(float(self.p.amount), 2)),
        ]


class TransferToContactWithNote(BaseTask):
    """判定：支付宝里新增了一笔联系人、金额、备注都匹配的转账记录。"""
    templates = [
        "我的密码是123456。请你用支付宝给{name}转{amount}元，备注写“{note}”",
        "我的密码是123456。帮我在支付宝向{name}转账{amount}元，并添加备注“{note}”",
        'My password is 123456. Use Alipay to transfer {amount} yuan to {name} with the note "{note}"',
        'My password is 123456. Send {amount} yuan to {name} in Alipay and add the note "{note}"',
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["finance", "handoff"]
    apps = ["alipay"]
    expected_changes = [
        "apps.alipay.transferRecords",
        "apps.alipay.balance",
        "apps.alipay.transferDraft",
        "apps.alipay.transferReceipt",
        "apps.alipay.lastPaymentHint",
    ]
    parameters = {
        "name": {
            "type": "string",
            "source": "apps.alipay.contacts[name]",
            "default": "浩杰(李浩杰)",
            "description": "联系人显示名（从通讯录采样）",
        },
        "amount": {
            "type": "float",
            "default": 150.0,
            "round": 2,
            "description": "转账金额",
        },
        "note": {
            "type": "string",
            "default": "书本费",
            "description": "短备注文本",
        },
    }

    async def _post_sample(self, env: Any) -> None:
        _quantize_money2(self.params, ("amount",))

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps["alipay"], init=input.apps_init["alipay"])
        return [
            ali.check_new_transfer_to_counterparty(
                str(self.p.name),
                amount=round(float(self.p.amount), 2),
                note=str(self.p.note),
                field="alipay.transfer.with_note",
            )
        ]


class SubscribeMembershipAutoRenewThenCancelInWechat(BaseTask):
    """判定：B 站会员已开通，且微信里新增的该项自动续费记录最终处于关闭状态。"""
    templates = [
        "帮我使用微信支付开通哔哩哔哩大会员连月自动续费，然后到微信把这项自动续费关闭",
        "Subscribe to Bilibili Premium monthly auto-renewal using WeChat Pay, then go to WeChat and cancel this auto-renewal",
    ]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["finance", "settings", "handoff"]
    apps = ["bilibili", "wechat"]
    expected_changes = ["apps.wechat.subscriptions", "apps.bilibili.user"]
    parameters = {
        "membershipType": {"type": "string", "default": "哔哩哔哩大会员", "description": "会员类型"},
        "price": {"type": "float", "default": 15.0, "min": 1, "max": 9999, "description": "订阅价格"},
        "billingCycle": {"type": "string", "default": "月", "description": "计费周期"},
    }

    async def _prepare(self, env: Any) -> None:
        await env.set_state({"apps": {"wechat": {"subscriptions": []}}}, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        bili = Bilibili(input.apps["bilibili"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        membership_name = str(self.p.membershipType)

        return [
            bili.check_vip_opened(),
            wechat.check_new_subscription_created(membership_name),
            wechat.check_new_subscription_auto_renew(
                membership_name,
                expected=False,
                field="wechat.subscription.cancelled",
            ),
        ]


class AlipayTransferAndNotify(BaseTask):
    """判定：支付宝确有目标转账，且微信新消息明确提到已转账并包含对应金额。"""
    templates = [
        "我的支付宝密码是123456。请你用支付宝给{alipay_contact}转{amount}元，备注写“{note}”，然后在微信里把这笔转账告知{contact}",
        'My Alipay password is 123456. Use Alipay to transfer {amount} yuan to {alipay_contact} with the note "{note}", then notify {contact} about this transfer on WeChat',
    ]
    apps = ["alipay", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["finance", "handoff"]
    expected_changes = [
        "apps.alipay.transferRecords",
        "apps.alipay.balance",
        "apps.alipay.lastPaymentHint",
        "apps.alipay.transferDraft",
        "apps.alipay.transferReceipt",
        "apps.wechat.chats",
    ]
    parameters = {
        "alipay_contact": {"type": "string", "default": "浩杰(李浩杰)", "description": "支付宝联系人"},
        "contact": {"type": "string", "default": "张伟", "description": "微信联系人"},
        "amount": {"type": "float", "default": 66.0, "min": 1, "max": 9999, "round": 2, "description": "转账金额"},
        "note": {"type": "string", "default": "午饭AA", "description": "转账备注"},
    }

    async def _post_sample(self, env: Any) -> None:
        _quantize_money2(self.params, ("amount",))

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps["alipay"], init=input.apps_init["alipay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        amount = round(float(self.p.amount), 2)
        return [
            ali.check_new_transfer_to_counterparty(
                str(self.p.alipay_contact),
                amount=amount,
                note=str(self.p.note),
            ),
            wechat.check_new_transfer_notification(str(self.p.contact), amount),
        ]


class WechatExtractAmountTransfer(BaseTask):
    """判定：从对方来信中提取「要你转的金额」，再核对支付宝新转账金额一致；若对方后来又发了不含金额的回复，仍向上追溯含金额的那条。

    注入：_post_sample 预置一条含金额的请求消息。
    """
    templates = [
        "看看微信里{contact}最近发来的消息，对方让你转多少钱，你就用支付宝转给{alipay_contact}多少，然后回复{reply}",
        "Check the latest message from {contact} on WeChat, figure out how much they want you to transfer, then transfer that amount to {alipay_contact} on Alipay and reply {reply}",
    ]
    apps = ["wechat", "alipay"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "finance"]
    expected_changes = [
        "apps.alipay.transferRecords",
        "apps.alipay.balance",
        "apps.alipay.lastPaymentHint",
        "apps.alipay.transferDraft",
        "apps.alipay.transferReceipt",
        "apps.wechat.chats",
    ]
    parameters = {
        "contact": {"type": "string", "default": "张伟", "description": "微信联系人"},
        "alipay_contact": {"type": "string", "default": "浩杰(李浩杰)", "description": "支付宝联系人"},
        "requestAmount": {"type": "float", "default": 66.0, "min": 1, "max": 9999, "round": 2, "description": "微信消息中的目标转账金额（用于任务初始化）"},
        "reply": {"type": "string", "default": "已经转了", "description": "回复内容"},
    }

    async def _post_sample(self, env: Any) -> None:
        _quantize_money2(self.params, ("requestAmount",))
        state = await env.get_state()
        amount = float(self.p.requestAmount)
        ts = now_ms(state.get("os") or {})
        next_wechat = Wechat(state["apps"]["wechat"]).prepare_state_with_incoming_text(
            str(self.p.contact),
            f"麻烦你转账给我一个朋友{amount:g}元，转后跟我说一声，我改日还你。",
            message_id=f"task_req_{ts}",
            timestamp=ts,
        )
        await env.set_state({"apps": {"wechat": next_wechat}}, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        ali = Alipay(input.apps["alipay"], init=input.apps_init["alipay"])
        try:
            incoming = wechat.last_received_text_with_amount_from(str(self.p.contact))
        except ValueError as exc:
            raise RuntimeError(f"任务设计错误：{exc}") from exc
        nums = extract_numbers(incoming)
        expected_amount = round(float(nums[-1]), 2)
        return [
            ali.check_new_transfer_to_counterparty(
                str(self.p.alipay_contact),
                amount=expected_amount,
                field="alipay.transfer.matches_request",
            ),
            wechat.check_new_sent_to(
                str(self.p.contact),
                str(self.p.reply),
                field="wechat.reply.sent",
            ),
        ]
