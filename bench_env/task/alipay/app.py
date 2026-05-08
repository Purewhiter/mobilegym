"""
Alipay app state accessor.
"""

from __future__ import annotations

import datetime
import re
from dataclasses import dataclass
from typing import Any, List, Optional
from bench_env.task.base import BaseApp


# ---------------------------------------------------------------------------
# Bill search — mirrors apps/Alipay/utils/bills.ts recordMatchesBillFilters
#
# Runtime records are enriched by data/index.ts, while offline tests may feed
# raw defaults. Keep the Python matcher aligned with the TS inference logic.
# ---------------------------------------------------------------------------

_BILL_CATEGORY_NAMES: dict[str, str] = {
    "dining": "餐饮美食", "apparel": "服饰装扮", "department": "日用百货",
    "home": "家居家装", "digital": "数码电器", "sports": "运动户外",
    "beauty": "美容美发", "parentChild": "母婴亲子", "pets": "宠物",
    "transport": "交通出行", "auto": "爱车养车", "housing": "住房物业",
    "travel": "酒店旅游", "leisure": "文化休闲", "education": "教育培训",
    "medical": "医疗健康", "lifeService": "生活服务", "publicService": "公共服务",
    "businessService": "商业服务", "charity": "公益捐赠", "mutualAid": "互助保障",
    "investment": "投资理财", "insurance": "保险", "creditRepayment": "信用借还",
    "topUp": "充值缴费", "income": "收入", "transferRedPacket": "转账红包",
    "friendPayment": "亲友代付", "accountDepositWithdraw": "账户存取",
    "refund": "退款", "other": "其他",
}

_BILL_SEARCH_FIELDS = (
    "displayTitle", "counterpartyName", "description", "transferNote",
    "targetAccount", "rechargeDescription", "productDescription",
    "phoneNumber", "transactionTarget", "acquiringInstitution",
    "clearingInstitution", "payeeFullName", "serviceDetail",
    "transactionDetail", "orderId", "merchantOrderId",
)

_BILL_QUICK_FILTER_LABELS: dict[str, str] = {
    "支出": "expense",
    "转账": "transfer",
    "退款": "refund",
    "订单": "order",
    "线下消费": "offline",
    "充值缴费": "topUp",
    "网购": "shopping",
    "二维码收款": "merchantCollection",
    "理财": "wealth",
    "提现": "withdrawal",
    "红包": "redPacket",
    "还款": "repayment",
    "生活缴费": "utility",
    "手机充值": "phoneRecharge",
    "冻结": "freeze",
}

_BILL_QUICK_FILTER_IDS = set(_BILL_QUICK_FILTER_LABELS.values())


def _bill_matches(record: dict[str, Any], keyword: str) -> bool:
    """Match keyword against the same haystack as the Alipay UI search."""
    parts = [record.get(f, "") for f in _BILL_SEARCH_FIELDS]
    parts.append(_BILL_CATEGORY_NAMES.get(record.get("category", ""), "其他"))
    haystack = " ".join(str(p) for p in parts if p).lower()
    return keyword in haystack


def _infer_transfer_kind(record: dict[str, Any]) -> str:
    if record.get("kind"):
        return str(record["kind"])
    name = str(record.get("counterpartyName") or "")
    if re.search("退款", name):
        return "refund"
    if re.search("提现|账户存取", name):
        return "withdrawal"
    if re.search("手机充值|话费|充值", name):
        return "recharge"
    if re.search("红包", name):
        return "redPacket"
    if re.search("转账", name):
        return "transfer"
    if re.search("工资|年终奖|薪资|奖金|收益", name):
        return "salary"
    if re.search("缴费|水费|电费|燃气费", name):
        return "utility"
    return "payment"


def _infer_bill_category(record: dict[str, Any]) -> str:
    if record.get("category"):
        return str(record["category"])
    name = str(record.get("counterpartyName") or "")
    kind = _infer_transfer_kind(record)
    delta = float(record.get("delta") or 0)

    if kind in {"transfer", "redPacket"} or re.search("转账|红包", name):
        return "transferRedPacket"
    if kind == "withdrawal" or re.search("提现|账户存取", name):
        return "accountDepositWithdraw"
    if re.search("工资|年终奖|薪资|奖金", name):
        return "income"
    if re.search("余额宝|理财|基金|收益", name):
        return "investment"
    if re.search("保险|保障", name):
        return "insurance"
    if re.search("花呗|信用卡|还款", name):
        return "creditRepayment"
    if re.search("生活缴费|水费|电费|燃气费", name):
        return "publicService"
    if re.search("话费|手机充值|充值缴费", name):
        return "topUp"
    if re.search("滴滴|公交|地铁|打车|出行", name):
        return "transport"
    if re.search("火车票|高铁|机票|动车|酒店|旅游", name):
        return "travel"
    if re.search("美团|饿了么|外卖|午餐|火锅|早餐|奶茶|咖啡", name):
        return "dining"
    if re.search("淘宝|京东|百货|日用品|购物", name):
        return "department"
    if re.search("数码|电器|电脑|手机|API", name):
        return "digital"
    if re.search("服饰|鞋|衣", name):
        return "apparel"
    if re.search("母婴|亲子", name):
        return "parentChild"
    if re.search("宠物", name):
        return "pets"
    if re.search("教育|培训|课程", name):
        return "education"
    if re.search("医疗|健康|药", name):
        return "medical"
    if re.search("物业|房租|住房", name):
        return "housing"
    if re.search("公益|捐赠", name):
        return "charity"
    if re.search("代付", name):
        return "friendPayment"
    if re.search("会员|订阅", name):
        return "businessService"
    if kind == "refund":
        return "refund"
    if delta > 0:
        return "income"
    return "other"


def _matches_order_quick_filter(record: dict[str, Any], kind: str, category: str) -> bool:
    if record.get("merchantOrderId"):
        return True
    if not record.get("orderId"):
        return False
    if kind in {"transfer", "redPacket", "salary", "withdrawal", "refund"}:
        return False
    if category in {"transferRedPacket", "income", "investment", "accountDepositWithdraw", "refund"}:
        return False
    return True


def _matches_bill_quick_filter(record: dict[str, Any], quick_filter: str) -> bool:
    """Mirror apps/Alipay/utils/bills.ts matchesBillQuickFilter()."""
    name = str(record.get("counterpartyName") or "")
    kind = _infer_transfer_kind(record)
    category = _infer_bill_category(record)
    delta = float(record.get("delta") or 0)

    if quick_filter == "expense":
        return delta < 0
    if quick_filter == "shopping":
        return category in {"apparel", "department", "digital"}
    if quick_filter == "offline":
        return category in {"dining", "transport", "auto", "lifeService"}
    if quick_filter == "wealth":
        return category in {"investment", "insurance", "mutualAid"}
    if quick_filter == "transfer":
        return kind == "transfer"
    if quick_filter == "withdrawal":
        return kind == "withdrawal" or bool(re.search("提现", name))
    if quick_filter == "redPacket":
        return kind == "redPacket"
    if quick_filter == "repayment":
        return category == "creditRepayment" or bool(re.search("还款", name))
    if quick_filter == "utility":
        return category == "publicService" or bool(re.search("缴费|水费|电费|燃气费", name))
    if quick_filter == "phoneRecharge":
        return category == "topUp" or bool(re.search("话费|充值", name))
    if quick_filter == "merchantCollection":
        return bool(re.search("收款|二维码", name))
    if quick_filter == "freeze":
        return bool(re.search("冻结|解冻", name))
    if quick_filter == "order":
        return _matches_order_quick_filter(record, kind, category)
    if quick_filter == "refund":
        return kind == "refund"
    if quick_filter == "topUp":
        return category in {"topUp", "publicService"}
    return False


# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TxMatch:
    """Criteria for matching a single transfer record."""
    counterparty: str
    amount: float
    note: str | None = None


class Alipay(BaseApp):
    """Typed read-only accessor for the Alipay app state dict."""

    # -- Balance & Assets ---------------------------------------------------

    @property
    def total_balance(self) -> float:
        return float(self.get("balance.total"))

    @property
    def payment_password(self) -> str:
        return str(self.get("userInfo.paymentPassword"))

    # -- Transactions -------------------------------------------------------

    @property
    def transactions(self) -> List[dict[str, Any]]:
        records = self.get("transferRecords")
        if not isinstance(records, list):
            raise ValueError("transferRecords not found or is not a list")
        return records

    @property
    def bank_cards(self) -> List[dict[str, Any]]:
        cards = self.get("bankCards")
        if not isinstance(cards, list):
            raise ValueError("bankCards not found or is not a list")
        return cards

    def monthly_expense(self, month_str: str) -> float:
        """Total absolute spending (delta < 0) in *month_str* (YYYY-MM)."""
        total = 0.0
        for t in self.transactions:
            ts = int(t["timestamp"])
            dt = datetime.datetime.fromtimestamp(ts / 1000)
            delta = float(t["delta"])
            if dt.strftime("%Y-%m") == month_str and delta < 0:
                total += abs(delta)
        return total

    def monthly_income_from(self, month_str: str, counterparty: str) -> float:
        """Total income (delta > 0) from *counterparty* in *month_str*."""
        total = 0.0
        for t in self.transactions:
            ts = int(t["timestamp"])
            dt = datetime.datetime.fromtimestamp(ts / 1000)
            if dt.strftime("%Y-%m") != month_str:
                continue
            delta = float(t["delta"])
            if delta > 0 and counterparty in str(t["counterpartyName"]):
                total += delta
        return total

    def last_expense_amount(self) -> float:
        return abs(float(self.latest_expense()["delta"]))

    def latest_expense_merchant(self) -> str:
        """最近一笔支出的商家名（优先 displayTitle，fallback counterpartyName）。"""
        expense = self.latest_expense()
        return str(expense.get("displayTitle") or expense["counterpartyName"])

    def latest_expense(self) -> dict[str, Any]:
        """按时间倒序找第一条支出记录（delta < 0），返回完整 record。"""
        sorted_tx = sorted(
            self.transactions, key=lambda tx: int(tx["timestamp"]), reverse=True
        )
        for tx in sorted_tx:
            if float(tx["delta"]) < 0:
                return tx
        raise ValueError("No expense found in transactions")

    def latest_n_transactions(self, n: int) -> list[dict[str, Any]]:
        """按时间倒序返回最近 n 笔交易。"""
        return sorted(
            self.transactions,
            key=lambda tx: int(tx["timestamp"]),
            reverse=True,
        )[: max(0, int(n))]

    def count_bound_cards(self) -> int:
        return sum(1 for card in self.bank_cards if bool(card["bound"]))

    def bank_card_by_id(self, card_id: str) -> dict[str, Any]:
        for card in self.bank_cards:
            if str(card["id"]) == str(card_id):
                return card
        raise ValueError(f"Bank card '{card_id}' not found")

    def bank_card_by_last4(self, last4: str) -> dict[str, Any]:
        for card in self.bank_cards:
            if str(card["last4"]) == str(last4):
                return card
        raise ValueError(f"Bank card with last4 '{last4}' not found")

    def card_token(self, card_id: str) -> str:
        card = self.bank_card_by_id(card_id)
        bank = str(card["bankName"]).strip()
        last4 = str(card["last4"]).strip()
        return f"{bank}（{last4}）" if bank and last4 else bank or last4 or str(card["id"])

    def new_transactions(self) -> list[dict[str, Any]]:
        init_ids = {str(record["id"]) for record in self.init.transactions}
        return [record for record in self.transactions if str(record["id"]) not in init_ids]

    def new_negative_transactions_since(self, since_ms: int) -> list[dict[str, Any]]:
        return [
            record
            for record in self.new_transactions()
            if int(record["timestamp"]) >= since_ms and float(record["delta"]) < 0
        ]

    def new_recharge_records(self) -> list[dict[str, Any]]:
        return [
            record
            for record in self.new_transactions()
            if str(record["kind"]) == "recharge" and float(record["delta"]) > 0
        ]

    def new_transfer_attempts_to_target(
        self, target_account: str, *, since_ms: int
    ) -> list[dict[str, Any]]:
        target = str(target_account).strip()
        return [
            record
            for record in self.new_transactions()
            if str(record.get("kind") or "") == "transfer"
            and int(record["timestamp"]) >= since_ms
            and self._transfer_record_matches_target(record, target)
        ]

    @staticmethod
    def _transfer_record_matches_target(record: dict[str, Any], target: str) -> bool:
        """收款侧与任务 targetAccount（多为手机号）对齐：账单里曾只存联系人姓名会导致匹配失败。"""
        if not target:
            return False
        if target in str(record.get("targetAccount") or ""):
            return True
        if target in str(record.get("phoneNumber") or ""):
            return True
        blob = " ".join(Alipay.transaction_labels(record))
        return target in blob

    def successful_transfer_attempts_to_target(
        self, target_account: str, *, since_ms: int
    ) -> list[dict[str, Any]]:
        return [
            record
            for record in self.new_transfer_attempts_to_target(target_account, since_ms=since_ms)
            if float(record["delta"]) < 0
        ]

    def attempted_transfer_card_method_ids_to_target(
        self, target_account: str, *, since_ms: int
    ) -> set[str]:
        return {
            str(record["methodId"]).strip()
            for record in self.new_transfer_attempts_to_target(target_account, since_ms=since_ms)
            if str(record.get("methodId") or "").strip() and str(record.get("methodId") or "").strip() != "balance"
        }

    def successful_transfer_card_marker_groups_to_target(
        self, target_account: str, *, since_ms: int
    ) -> list[list[str]]:
        groups: list[list[str]] = []
        for record in self.successful_transfer_attempts_to_target(target_account, since_ms=since_ms):
            method_id = str(record.get("methodId") or "").strip()
            if not method_id or method_id == "balance":
                groups.append(["balance"])
                continue
            card = self.bank_card_by_id(method_id)
            bank_name = str(card.get("bankName") or "").strip()
            markers = [
                method_id,
                bank_name,
                self.card_token(method_id),
                str(card.get("last4") or "").strip(),
            ]
            groups.append([marker for marker in markers if marker])
        return groups

    def check_matching_transfers(
        self, matches: list[TxMatch], *, since_ms: int, field: str = "alipay.payments.matched"
    ) -> dict[str, Any]:
        matched_n, details = self.count_matching_transfers(self.transactions, matches, since_ms=since_ms)
        return {
            "field": field,
            "expected": len(matches),
            "actual": matched_n,
            "passed": matched_n == len(matches),
            "details": details,
        }

    def check_total_balance(
        self,
        expected: float,
        *,
        tolerance: float = 0.02,
        field: str = "alipay.balance.total",
    ) -> dict[str, Any]:
        actual = self.total_balance
        return {
            "field": field,
            "expected": float(expected),
            "actual": actual,
            "passed": abs(actual - float(expected)) <= tolerance,
        }

    def check_balance_afford_answer(
        self,
        price: float,
        answer_text: str,
        *,
        field: str = "balance_afford",
    ) -> dict[str, Any]:
        """验证 answer_text 是否正确陈述了余额够不够支付 price。

        够 → 文本含肯定表述且无否定表述；
        不够 → 文本含否定表述。
        """
        balance = self.total_balance
        enough = balance >= price
        negative = re.search(r"不够|买不起|付不起|没钱|不足|不可以", answer_text)
        positive = re.search(r"够|足够|有余|可以买|能买|买得起|可以购买", answer_text)
        if enough:
            passed = negative is None and positive is not None
            expected_desc = f"余额 {balance:.2f} 足够支付 {price:.2f}"
        else:
            diff = round(price - balance, 2)
            passed = negative is not None
            expected_desc = f"余额不足，还差 {diff:.2f}"
        return {
            "field": field,
            "expected": expected_desc,
            "actual": answer_text,
            "passed": passed,
        }

    def check_bound_card_count_at_least(
        self, expected_count: int, *, field: str = "alipay.bankCards.bound.count"
    ) -> dict[str, Any]:
        init_bound = self.init.count_bound_cards() if self.has_init else None
        curr_bound = self.count_bound_cards()
        return {
            "field": field,
            "expected": f"至少绑定{int(expected_count)}张银行卡",
            "actual": {"init": init_bound, "curr": curr_bound},
            "passed": curr_bound >= int(expected_count),
        }

    def check_successful_transfer_count_to_target(
        self,
        target_account: str,
        *,
        since_ms: int,
        min_count: int,
        max_count: int,
        field: str = "alipay.transfer.success.count",
    ) -> dict[str, Any]:
        success_records = self.successful_transfer_attempts_to_target(target_account, since_ms=since_ms)
        count = len(success_records)
        return {
            "field": field,
            "expected": f"至少{int(min_count)}笔且不超过{int(max_count)}笔成功转账",
            "actual": count,
            "passed": int(min_count) <= count <= int(max_count),
        }

    def check_successful_transfer_amounts_to_target(
        self,
        target_account: str,
        expected_amounts: list[float],
        *,
        since_ms: int,
        tolerance: float = 0.02,
        field: str = "alipay.transfer.success.amounts.match",
    ) -> dict[str, Any]:
        success_records = self.successful_transfer_attempts_to_target(target_account, since_ms=since_ms)
        actual_amounts = [abs(float(record["delta"])) for record in success_records]
        passed = bool(actual_amounts) and all(
            any(abs(float(actual) - float(expected)) <= tolerance for expected in expected_amounts)
            for actual in actual_amounts
        )
        return {
            "field": field,
            "expected": expected_amounts,
            "actual": [float(record["delta"]) for record in success_records[:10]],
            "passed": passed,
        }

    def check_transfer_attempted_card_count_to_target(
        self,
        target_account: str,
        *,
        since_ms: int,
        expected_count: int,
        field: str = "alipay.transfer.three_cards.attempted",
    ) -> dict[str, Any]:
        method_ids = self.attempted_transfer_card_method_ids_to_target(target_account, since_ms=since_ms)
        return {
            "field": field,
            "expected": f"{int(expected_count)}张银行卡都被用于尝试转账",
            "actual": list(method_ids),
            "passed": len(method_ids) >= int(expected_count),
        }

    def check_new_negative_transaction_amount(
        self, amount: float, *, tolerance: float = 0.02, field: str = "alipay.payment.recorded"
    ) -> dict[str, Any]:
        expected = float(amount)
        matches = [
            record
            for record in self.new_transactions()
            if float(record.get("delta", 0)) < 0
            and abs(float(record.get("delta", 0)) + expected) <= tolerance
        ]
        return {
            "field": field,
            "expected": expected,
            "actual": matches[0] if matches else None,
            "passed": bool(matches),
        }

    def check_new_transfer_to_counterparty(
        self,
        counterparty: str,
        *,
        amount: float,
        note: str | None = None,
        tolerance: float = 0.02,
        field: str = "alipay.transfer.recorded",
    ) -> dict[str, Any]:
        target = str(counterparty)
        expected = float(amount)
        match = next(
            (
                record
                for record in self.new_transactions()
                if str(record.get("kind") or "") == "transfer"
                and float(record.get("delta", 0)) < 0
                and abs(float(record.get("delta", 0)) + expected) <= tolerance
                and target in " ".join(self.transaction_labels(record))
                and (note is None or str(record.get("transferNote") or "") == str(note))
            ),
            None,
        )
        return {
            "field": field,
            "expected": {"counterparty": target, "amount": expected, "note": note},
            "actual": match,
            "passed": match is not None,
        }

    def check_password_changed(
        self,
        new_password: str,
        old_password: str,
        *,
        field: str = "alipay.userInfo.paymentPassword",
    ) -> dict[str, Any]:
        """验证支付密码已从 old_password 改为 new_password。"""
        curr = self.payment_password
        return {
            "field": field,
            "expected": str(new_password),
            "actual": curr,
            "passed": curr == str(new_password) and str(new_password) != str(old_password),
        }

    def records_for_order(self, order_id: str) -> list[dict[str, Any]]:
        return [
            record
            for record in self.transactions
            if str(record["orderId"]) == str(order_id)
        ]

    @staticmethod
    def transaction_primary_label(record: dict[str, Any]) -> str:
        """交易的主显示名，优先使用 displayTitle。"""
        return str(record.get("displayTitle") or record.get("counterpartyName") or "").strip()

    @staticmethod
    def transaction_labels(record: dict[str, Any]) -> list[str]:
        """交易可接受的名称标签，供跨 App 判定做宽松匹配。"""
        labels: list[str] = []
        for raw in (
            record.get("displayTitle"),
            record.get("counterpartyName"),
            record.get("targetAccount"),
            record.get("productDescription"),
        ):
            text = str(raw or "").strip()
            if text and text not in labels:
                labels.append(text)
        return labels

    def largest_expense(self) -> dict[str, Any]:
        """返回历史单笔最大支出记录。"""
        expenses = [tx for tx in self.transactions if float(tx["delta"]) < 0]
        if not expenses:
            raise ValueError("No expense found in transactions")
        return max(expenses, key=lambda tx: abs(float(tx["delta"])))

    def incoming_transfers(self) -> list[dict[str, Any]]:
        """返回所有收到的"转账"记录（kind=='transfer' 且 delta>0）。"""
        return [
            tx
            for tx in self.transactions
            if float(tx["delta"]) > 0 and _infer_transfer_kind(tx) == "transfer"
        ]

    def incoming_transfer_count(self) -> int:
        return len(self.incoming_transfers())

    def largest_incoming_transfer(self) -> dict[str, Any]:
        """返回历史收到的金额最大的单笔转账。"""
        transfers = self.incoming_transfers()
        if not transfers:
            raise ValueError("No incoming transfer found in transactions")
        return max(transfers, key=lambda tx: float(tx["delta"]))

    def yearly_expenses(self, year: int) -> list[dict[str, Any]]:
        """按自然年返回所有支出记录（delta < 0）。"""
        year_i = int(year)
        result: list[dict[str, Any]] = []
        for tx in self.transactions:
            if float(tx["delta"]) >= 0:
                continue
            dt = datetime.datetime.fromtimestamp(int(tx["timestamp"]) / 1000)
            if dt.year == year_i:
                result.append(tx)
        return result

    def yearly_largest_expense(self, year: int) -> dict[str, Any]:
        """指定自然年单笔最大支出记录。"""
        expenses = self.yearly_expenses(year)
        if not expenses:
            raise ValueError(f"No expense found in year {year}")
        return max(expenses, key=lambda tx: abs(float(tx["delta"])))

    def yearly_incoming_transfers(self, year: int) -> list[dict[str, Any]]:
        """指定自然年收到的"转账"记录（kind=='transfer' 且 delta>0）。

        `kind` 字段由 `enrichTransferRecord`（TS 侧 data/index.ts）在运行时注入，
        但若上游数据直接是原始 defaults.json（缺字段），用 `_infer_transfer_kind`
        按 counterpartyName 再推断一次，保持与 TS 侧的 inferTransferKind 一致。
        """
        year_i = int(year)
        result: list[dict[str, Any]] = []
        for tx in self.incoming_transfers():
            dt = datetime.datetime.fromtimestamp(int(tx["timestamp"]) / 1000)
            if dt.year == year_i:
                result.append(tx)
        return result

    def yearly_incoming_transfer_count(self, year: int) -> int:
        return len(self.yearly_incoming_transfers(year))

    def yearly_largest_incoming_transfer(self, year: int) -> dict[str, Any]:
        """指定自然年收到的金额最大的单笔转账。"""
        transfers = self.yearly_incoming_transfers(year)
        if not transfers:
            raise ValueError(f"No incoming transfer found in year {year}")
        return max(transfers, key=lambda tx: float(tx["delta"]))

    @staticmethod
    def transfer_counterparty_label(record: dict[str, Any]) -> str:
        """从转账记录中提取用于 judge 匹配的对方标签。

        转账记录常见字段：
          - targetAccount="Hui(林若溪)"      → 带括号真名的完整对方标识
          - counterpartyName="转账-Hui(林若溪)" / "转账-阿明(张明)" / "转账-Hui"
          - displayTitle="转账-Hui" / "阿明"
        返回规则：优先返回 `targetAccount`（与支付宝"转账详情"页显示一致，且常含真名），
        其次剥掉 counterpartyName 的"转账-"前缀，最后 fallback displayTitle。
        """
        target = str(record.get("targetAccount") or "").strip()
        if target:
            return target
        name = str(record.get("counterpartyName") or "").strip()
        if name.startswith("转账-"):
            stripped = name[len("转账-"):].strip()
            if stripped:
                return stripped
        display = str(record.get("displayTitle") or "").strip()
        if display.startswith("转账-"):
            display = display[len("转账-"):].strip()
        return display or name or "未知对方"

    def top_spend_counterparty(self) -> tuple[str, float]:
        """返回累计支出最多的交易对象与累计金额。"""
        totals: dict[str, float] = {}
        for tx in self.transactions:
            delta = float(tx["delta"])
            if delta >= 0:
                continue
            name = str(tx.get("counterpartyName") or "")
            totals[name] = totals.get(name, 0.0) + abs(delta)
        if not totals:
            raise ValueError("No spend counterparty found in transactions")
        winner = max(totals, key=totals.get)
        return winner, totals[winner]

    @staticmethod
    def count_matching_transfers(
        records: list[dict[str, Any]], matches: list[TxMatch], since_ms: int,
    ) -> tuple[int, list[dict[str, Any]]]:
        """Match *records* against *matches*, returning (hit_count, per-match details)."""
        recent = [
            r for r in records
            if int(r["timestamp"]) >= since_ms
        ]
        used: set[str] = set()
        passed = 0
        details: list[dict[str, Any]] = []
        for match in matches:
            found = None
            for record in recent:
                rid = str(record["id"])
                if rid and rid in used:
                    continue
                name = str(record["counterpartyName"])
                delta = float(record["delta"])
                note = (
                    record["transferNote"]
                    if "transferNote" in record
                    else record.get("note")
                )
                ok = (match.counterparty in name) and abs(delta + match.amount) < 0.01
                if ok and match.note is not None:
                    ok = str(note) == str(match.note)
                if ok:
                    found = record
                    if rid:
                        used.add(rid)
                    break
            details.append({
                "expected": {
                    "counterparty": match.counterparty,
                    "amount": match.amount,
                    "note": match.note,
                },
                "actual": found,
                "passed": found is not None,
            })
            if found is not None:
                passed += 1
        return passed, details

    # -- Samplers ------------------------------------------------------------

    @staticmethod
    def sample_income_month_and_name(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        """Pick a (month, counterparty) pair that has positive transfer income."""
        ali = Alipay(env_state["apps"]["alipay"])
        bucket: dict[tuple[str, str], float] = {}
        for t in ali.transactions:
            delta = float(t["delta"])
            raw = str(t["counterpartyName"])
            if delta <= 0 or not raw.startswith("转账-"):
                continue
            ts = int(t["timestamp"])
            dt = datetime.datetime.fromtimestamp(ts / 1000)
            month = dt.strftime("%Y-%m")
            core = re.sub(r"\([^)]*\)$", "", raw.split("-", 1)[1]).strip()
            if not core:
                continue
            key = (month, core)
            bucket[key] = bucket.get(key, 0) + delta
        candidates = list(bucket.keys())
        if not candidates:
            return {"month": "2026-01", "name": "Hui"}
        month, name = rng.choice(candidates)
        return {"month": month, "name": name}

    # -- Bill Search ---------------------------------------------------------

    def count_bill_search_results(self, keyword: str) -> int:
        """Count records matching *keyword* (mirrors UI ``recordMatchesBillFilters``)."""
        kw = keyword.strip().lower()
        if not kw:
            return len(self.transactions)
        return sum(1 for t in self.transactions if _bill_matches(t, kw))

    @staticmethod
    def normalize_bill_quick_filter(value: str) -> str:
        target = str(value).strip()
        quick_filter = _BILL_QUICK_FILTER_LABELS.get(target, target)
        if quick_filter not in _BILL_QUICK_FILTER_IDS:
            raise ValueError(f"Unsupported bill quick filter: {value!r}")
        return quick_filter

    def count_bill_quick_filter_results(self, bill_type: str, *, until_ms: int | None = None) -> int:
        """Count records matching a bill tab/filter label such as ``订单``."""
        quick_filter = self.normalize_bill_quick_filter(bill_type)
        return sum(
            1
            for t in self.transactions
            if (until_ms is None or int(t["timestamp"]) <= until_ms)
            and _matches_bill_quick_filter(t, quick_filter)
        )

    def bill_type_year_summary(
        self,
        bill_type: str,
        year: int,
        *,
        until_ms: int | None = None,
    ) -> tuple[int, float]:
        """Return (record count, absolute spending) for a bill tab/filter in a year."""
        quick_filter = self.normalize_bill_quick_filter(bill_type)
        count = 0
        spending = 0.0
        for record in self.transactions:
            ts = int(record["timestamp"])
            if until_ms is not None and ts > until_ms:
                continue
            dt = datetime.datetime.fromtimestamp(ts / 1000)
            if dt.year != int(year):
                continue
            if not _matches_bill_quick_filter(record, quick_filter):
                continue
            count += 1
            delta = float(record["delta"])
            if delta < 0:
                spending += abs(delta)
        return count, round(spending, 2)

    # -- Contacts & Conversations -------------------------------------------

    @property
    def contacts(self) -> List[dict[str, Any]]:
        contacts = self.get("contacts")
        if not isinstance(contacts, list):
            raise ValueError("contacts not found or is not a list")
        return contacts

    @property
    def conversations(self) -> List[dict[str, Any]]:
        conversations = self.get("conversations")
        if not isinstance(conversations, list):
            raise ValueError("conversations not found or is not a list")
        return conversations

    @property
    def chat_history(self) -> dict[str, list[dict[str, Any]]]:
        history = self.get("chatHistory")
        if not isinstance(history, dict):
            raise ValueError("chatHistory not found or is not a dict")
        return history

    @property
    def total_unread(self) -> int:
        total = 0
        for conv in self.conversations:
            if conv["kind"] == "person":
                last_read = conv["lastReadAt"]
                msgs = self.chat_history.get(conv["id"], [])
                total += sum(
                    1
                    for m in msgs
                    if m["senderId"] != "self"
                    and m["timestamp"] > last_read
                )
            else:
                total += int(conv.get("unread", 0))
        return total

    def find_contact_name_by_account(self, account: str) -> str:
        """Resolve an account/phone string to a contact display name."""
        account = account.strip()
        for c in self.contacts:
            if str(c["account"]) == account or str(c["phone"]) == account:
                return str(c["name"])
        raise ValueError(f"Contact account '{account}' not found in state")

    def get_conversation_by_name(self, name: str) -> Optional[dict[str, Any]]:
        """Find conversation whose name contains *name*."""
        for c in self.conversations:
            if name in str(c["name"]):
                return c
        raise ValueError(f"Conversation '{name}' not found in state")

    def get_conversation_for_contact(self, contact_name: str) -> Optional[dict[str, Any]]:
        """Find conversation by matching contact name (supports partial match)."""
        for conv in self.conversations:
            if conv["kind"] != "person":
                continue
            cid = conv.get("contactId")
            if cid:
                contact = next((c for c in self.contacts if str(c["id"]) == str(cid)), None)
                if contact is not None and contact_name in str(contact["name"]):
                    return conv
            if contact_name in str(conv["name"]):
                return conv
        return None

    def get_last_chat_message(self, conversation_id: str) -> Optional[dict[str, Any]]:
        msgs = self.chat_history.get(conversation_id)
        if msgs is None:
            return None
        return msgs[-1] if msgs else None

    # -- Phone masking --------------------------------------------------------

    @staticmethod
    def mask_phone(phone: str) -> str:
        """11 位手机号 → 前 3 位 + ****** + 后 2 位"""
        if len(phone) == 11 and phone.startswith('1') and phone.isdigit():
            return phone[:3] + '******' + phone[-2:]
        return phone
