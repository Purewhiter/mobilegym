"""
Alipay task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 19 tasks | L1×4  L2×5  L3×9  L4×1
#
# [L3] FindFriend                    在支付宝里找到好友'{name}'，告诉我他的电话号码
# [L2] MonthlyIncomeByCounterparty   在支付宝账单中查看{month}里来自'{name}'的收入一共有多少
# [L1] CheckDailyIncome              在支付宝查看昨日理财收益是多少
# [L1] EnableDarkMode                给支付宝开启深色模式
# [L2] CheckLatestMessageContent     在支付宝里查看'{name}'最近发来了什么
# [L2] SetPayOrderCcbYuebaoBalance   在支付宝支付设置里，把支付顺序改成建设银行储蓄卡、余额宝、账户余额
# [L3] AnalyzeSpending               在支付宝账单里看最近 5 笔记录，一共花了多少钱
# [L3] CountLargeTransferIncomes     在支付宝账单中，有多少笔转账收入超过 {amount} 元
# [L3] CheckUnreadMessageCount       我支付宝里有多少条好友发来的未读消息
# [L1] CheckBalance                  看看我理财总资产有多少钱
# [L3] DisableAllNotifications       关闭支付宝的所有新消息提醒
# [L1] ShowReceiveQRCode             打开支付宝的收钱二维码
# [L3] SearchTransferRecords         看看支付宝账单里'{keyword}'有多少条记录
# [L2] SendMessageToContact          在支付宝给'{contact}'发一条消息，'{text}'
# [L3] ConfigureLanguageAndFastPay   在支付宝中把语言切换为英文，同时开启极速付款并关闭付款彩蛋
# [L2] EnableRefreshSound            在支付宝中开启刷新音效
# [L3] SetFontSizeLevel              把支付宝字体大小调到{font_size_level}
# [L4] CalculateMonthlyExpenseTrend  在支付宝账单中对比{month1}和{month2}的总支出，哪个月花得多
# [L3] FindLargestTransferPartner    在支付宝账单里统计累计金额，告诉我总金额最大的交易对象是什么
# -- End Task Index --


from __future__ import annotations

from typing import Any

import re

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import CriteriaTask, AnswerTask, match_value
from bench_env.task.judge import JudgeInput
from bench_env.task.alipay.app import Alipay


# =============================================================================
# Simple Tasks
# =============================================================================


class FindFriend(AnswerTask):
    """支付宝通讯录查手机号"""
    templates = ["在支付宝里找到好友'{name}'，告诉我他的电话号码"]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["nav", "extract"]
    parameters = {
        "name": {
            "type": "string",
            "source": "apps.alipay.contacts[name]",
            "default": "阿明",
            "description": "好友姓名（从通讯录采样）"
        },
    }
    answer = ".contacts[name={name}].phone"
    answer_fields = [{"type": "text", "label": "电话号码", "hint": "如：15912345678 或 159******78"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        phone = str(self.get_answer(input) or "")
        answer_text = str(input.answer or "")
        # 没查到联系人 → 判定失败，避免空字符串被 match_value 当成通过
        passed = bool(phone) and bool(match_value(phone, answer_text))
        # UI 显示带星号格式 (如 151******21)，也应算通过
        if not passed and phone and len(phone) >= 5:
            masked = phone[:3] + r"[\*＊·•●×]{2,}" + re.escape(phone[-2:])
            passed = bool(re.search(masked, answer_text))
        return [{
            "field": "answer.电话号码",
            "expected": phone,
            "actual": input.answer,
            "passed": passed,
        }]


class MonthlyIncomeByCounterparty(AnswerTask):
    """支付宝账单查询月收入"""
    templates = ["在支付宝账单中查看{month}里来自'{name}'的收入一共有多少"]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract", "reasoning"]
    parameters = {
        "month": {
            "type": "string",
            "default": "2026-01",
            "description": "月份(YYYY-MM)",
            "display": "month_zh",
        },
        "name": {
            "type": "string",
            "default": "Hui",
            "description": "交易对象（仅采样存在正向收入的对手方）"
        },
        "_income": {
            "sampler": Alipay.sample_income_month_and_name,
            "fields": {"month": "month", "name": "name"},
        },
    }

    answer_fields = [{"type": "number", "label": "收入总额"}]
    expected_changes = ["billSearchHistory"]

    def get_answer(self, input: JudgeInput) -> str:
        ali = Alipay(input.apps_init["alipay"])
        total = ali.monthly_income_from(str(self.p.month), self.p.name)
        return f"{round(total, 2):g}"


class CheckDailyIncome(AnswerTask):
    """查询支付宝昨日收益"""
    templates = ["在支付宝查看昨日理财收益是多少"]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["extract"]
    answer = ".balance.dailyIncome"
    answer_fields = [{"type": "number", "label": "昨日收益"}]


# =============================================================================
# Medium Tasks
# =============================================================================




class EnableDarkMode(CriteriaTask):
    """开启支付宝深色模式"""
    templates = [
        "给支付宝开启深色模式",
        "Enable dark mode in Alipay",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["finance", "settings"]
    criteria = {"settings.general.darkMode.mode": "dark"}


class CheckLatestMessageContent(AnswerTask):
    """查看支付宝最近消息内容"""
    templates = ["在支付宝里查看'{name}'最近发来了什么"]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract"]
    parameters = {
        "name": {
            "type": "string",
            "source": "apps.alipay.conversations[name]",
            "default": "正中",
            "description": "发送人（从会话列表采样，kind=person）"
        }
    }

    expected_changes = ["conversations"]
    answer_fields = [{"type": "text", "label": "最新消息内容"}]

    def get_answer(self, input: JudgeInput) -> str:
        ali = Alipay(input.apps_init["alipay"])
        conv = ali.get_conversation_by_name(self.p.name)
        if conv is None:
            return ""
        return str(conv["lastContent"])
class SetPayOrderCcbYuebaoBalance(CriteriaTask):
    """自定义支付宝支付顺序"""
    templates = [
        "在支付宝支付设置里，把支付顺序改成建设银行储蓄卡、余额宝、账户余额",
        "调整支付宝付款顺序，先建设银行储蓄卡，再余额宝，最后账户余额",
        "In Alipay payment settings, change the payment order to CCB savings card, Yu'ebao, then Balance",
        "Adjust Alipay's payment order: CCB savings card first, then Yu'ebao, then Balance",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {}
    expected_changes = ["settings.payment.payOrder.customOrderIds._order"]
    criteria = {
        "settings.payment.payOrder.mode": "custom",
        "settings.payment.payOrder.customOrderIds[0]": "ccb",
        "settings.payment.payOrder.customOrderIds[1]": "yuebao",
        "settings.payment.payOrder.customOrderIds[2]": "balance",
    }


# =============================================================================
# Hard Tasks
# =============================================================================

class AnalyzeSpending(AnswerTask):
    """统计最近五笔总支出"""
    templates = [
        "在支付宝账单里看最近 5 笔记录，一共花了多少钱",
        "帮我算一下支付宝最近五笔账单记录的总支出",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    answer_fields = [{"type": "number", "label": "总支出金额"}]
    
    def get_answer(self, input: JudgeInput) -> str:
        ali = Alipay(input.apps_init["alipay"])
        latest = sorted(
            ali.transactions,
            key=lambda x: x["timestamp"], reverse=True,
        )[:5]
        total = sum(abs(float(t["delta"])) for t in latest if float(t["delta"]) < 0)
        return f"{round(total, 2):g}"


class CountLargeTransferIncomes(AnswerTask):
    """统计大额转账收入笔数"""
    templates = [
        "在支付宝账单中，有多少笔转账收入超过 {amount} 元",
        "帮我数一下支付宝里大于 {amount} 元的转账收入有几笔",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    answer_fields = [{"type": "number", "label": "转账收入笔数"}]
    parameters = {
        "amount": {
            "type": "enum",
            "values": [100, 200, 500, 1000, 2000, 5000],
            "default": 1000,
            "description": "金额阈值（整百/整千，自然语言友好）",
        }
    }

    def get_answer(self, input: JudgeInput) -> int:
        ali = Alipay(input.apps_init["alipay"])
        count = 0
        for t in ali.transactions:
            delta = float(t["delta"])
            name = str(t["counterpartyName"])
            if delta > self.p.amount and name.startswith("转账"):
                count += 1
        return count


class CheckUnreadMessageCount(AnswerTask):
    """统计支付宝未读消息"""
    templates = ["我支付宝里有多少条好友发来的未读消息"]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["extract"]
    answer_fields = [{"type": "number", "label": "未读消息数"}]

    def get_answer(self, input: JudgeInput) -> int:
        return Alipay(input.apps_init["alipay"]).total_unread


class CheckBalance(AnswerTask):
    """查看支付宝余额"""
    templates = ["看看我理财总资产有多少钱"]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["extract"]
    answer = ".balance.total"
    answer_fields = [{"type": "number", "label": "理财总资产"}]


class DisableAllNotifications(CriteriaTask):
    """关闭支付宝新消息通知"""
    templates = [
        "关闭支付宝的所有新消息提醒",
        "Turn off all new message notifications in Alipay",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    criteria = {
        "settings.notifications.tradeSecurity": False,
        "settings.notifications.service": False,
        "settings.notifications.activity": False,
        "settings.notifications.avCall": False,
        "settings.notifications.avCallPopup": False,
        "settings.notifications.friendReminder": False,
        "settings.notifications.friendDetail": False,
        "settings.notifications.sound": False,
        "settings.notifications.vibration": False,
        "settings.notifications.avCallRing": False,
    }



class ShowReceiveQRCode(CriteriaTask):
    """打开支付宝收钱码"""
    templates = [
        "打开支付宝的收钱二维码",
        "Open Alipay's receive-money QR code",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["nav"]
    criteria = {"route": "/pay/receive"}


class SearchTransferRecords(AnswerTask):
    """搜索支付宝账单记录数"""
    templates = ["看看支付宝账单里'{keyword}'有多少条记录"]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "extract"]
    parameters = {
        "keyword": {
            "type": "string",
            "default": "转账",
            "description": "交易对象或账单关键词",
        }
    }

    expected_changes = ["billSearchHistory"]
    answer_fields = [{"type": "number", "label": "记录条数"}]

    def get_answer(self, input: JudgeInput) -> int:
        ali = Alipay(input.apps_init["alipay"])
        return ali.count_bill_search_results(str(self.p.keyword))


class SendMessageToContact(CriteriaTask):
    """给支付宝联系人发消息"""
    templates = ["在支付宝给'{contact}'发一条消息，'{text}'"]
    apps = ["alipay"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["create"]
    parameters = {
        "contact": { "type": "string", "source": "apps.alipay.contacts[name]", "default": "老王(王建国)", "description": "联系人显示名（从通讯录采样）" },
        "text": { "type": "string", "default": "发票抬头是XX公司", "description": "短文本消息" },
    }
    criteria = {}
    expected_changes = ["conversations", "chatHistory"]

    def check_goals(self, input: JudgeInput):
        checks = self._check_criteria(input)
        ali = Alipay(input.apps["alipay"])
        sent_text = str(self.p.text)
        conv = ali.get_conversation_for_contact(self.p.contact)
        conv_id = str(conv["id"]) if conv is not None else None
        last_msg = ali.get_last_chat_message(conv_id) if conv_id is not None else None
        actual_content = last_msg["content"] if last_msg is not None else None
        checks.append({
            "field": "chat_message",
            "expected": f"'{self.p.contact}' chatHistory 最后一条消息包含 '{sent_text}'",
            "actual": actual_content,
            "passed": actual_content is not None and sent_text in str(actual_content),
        })
        preview = conv["lastContent"] if conv is not None else None
        checks.append({
            "field": "conversation_preview",
            "expected": f"会话预览更新为 '{sent_text}'",
            "actual": preview,
            "passed": preview is not None and sent_text in str(preview),
        })
        return checks

class ConfigureLanguageAndFastPay(CriteriaTask):
    """调整语言与极速付款设置"""
    templates = [
        "在支付宝中把语言切换为英文，同时开启极速付款并关闭付款彩蛋",
        "把支付宝改成英文界面，并开启极速付款、关闭付款彩蛋",
        "Switch Alipay's language to English, enable Fast Pay, and disable Payment Easter Egg",
        "Change Alipay to English, turn on Fast Pay, and turn off the Payment Easter Egg",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    parameters = {}
    criteria = {
        "language": "en",
        "settings.payment.fastPay.enabled": True,
        "settings.payment.fastPay.easterEggEnabled": False,
    }


class EnableRefreshSound(CriteriaTask):
    """开启支付宝刷新音效"""
    templates = [
        "在支付宝中开启刷新音效",
        "Enable the refresh sound effect in Alipay",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["settings"]
    criteria = {"settings.general.refreshSoundEnabled": True}


class SetFontSizeLevel(CriteriaTask):
    """调整支付宝字体大小"""
    templates = ["把支付宝字体大小调到{font_size_level}"]
    apps = ["alipay"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["settings"]
    parameters = {
        "font_size_level": {
            "type": "enum",
            "values": {"最小": 0, "标准": 1, "比标准大一档": 2, "比最大小一档": 3, "最大": 4},
            "default": 2,
            "description": "字体大小档位（0-4）",
        }
    }

    criteria = {"settings.general.fontSizeLevel": "{font_size_level}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class CalculateMonthlyExpenseTrend(AnswerTask):
    """比较两个月支出"""
    templates = [
        "在支付宝账单中对比{month1}和{month2}的总支出，哪个月花得多",
        "帮我看看支付宝在{month1}和{month2}这两个月里，哪一个月支出更高",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning"]
    sample_max = 1
    answer_fields = [
        {"type": "choice", "label": "花得更多的月份",
         "options": ["{month1}", "{month2}", "一样"]}
    ]
    parameters = {
        "month1": {
            "type": "string",
            "default": "2026-01",
            "description": "月份1",
            "display": "month_zh",
        },
        "month2": {
            "type": "string",
            "default": "2025-12",
            "description": "月份2",
            "display": "month_zh",
        }
    }

    def get_answer(self, input: JudgeInput) -> str:
        ali = Alipay(input.apps_init["alipay"])
        exp1 = ali.monthly_expense(self.p.month1)
        exp2 = ali.monthly_expense(self.p.month2)
        if exp1 > exp2:
            winner = self.p.month1
        elif exp2 > exp1:
            winner = self.p.month2
        else:
            return "一样"
        parts = str(winner).split("-")
        if len(parts) == 2:
            return f"{parts[0]}年{int(parts[1])}月"
        return str(winner)

    def get_expected_response(self, input: JudgeInput) -> list:
        ali = Alipay(input.apps_init["alipay"])
        exp1 = ali.monthly_expense(self.p.month1)
        exp2 = ali.monthly_expense(self.p.month2)
        if exp1 > exp2:
            return [self.p.month1]
        elif exp2 > exp1:
            return [self.p.month2]
        return ["一样"]


class FindLargestTransferPartner(AnswerTask):
    """找出累计金额最大的交易对象"""
    templates = [
        "在支付宝账单里统计累计金额，告诉我总金额最大的交易对象是什么",
        "帮我看看支付宝里累计金额最高的交易对象是谁",
    ]
    apps = ["alipay"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    answer_fields = [{"type": "text", "label": "交易对象", "hint": "如：王五"}]

    def get_answer(self, input: JudgeInput) -> str:
        ali = Alipay(input.apps_init["alipay"])
        totals: dict[str, float] = {}
        for t in ali.transactions:
            name = str(t["counterpartyName"])
            totals[name] = totals.get(name, 0.0) + abs(float(t["delta"]))
        return max(totals, key=totals.get)  # type: ignore[arg-type]
