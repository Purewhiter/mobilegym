"""
Cross-app Commerce & Finance (crossapp_commerce) task definitions.

覆盖商品比价、余额核实、账单分析、预算记录等消费决策场景。
核心信息流：eBay / Alipay → Notes / WeChat。
"""
# -- Task Index (auto-generated, do not edit) --
# 15 tasks | L2×1  L3×8  L4×6
#
# [L2] AlipayBalanceToWechat            查一下我支付宝余额，发微信告诉{contact}
# [L3] AlipayMonthlySpendToWechat       看看我支付宝这个月花了多少钱，发微信告诉{contact}
# [L3] AlipayRecentTransactionsToNotes  查看我支付宝最近5笔交易，在笔记里记录每笔的金额和交易内容
# [L3] EbayLowestPriceToNotes           在eBay搜{query}，找到最便宜的那个，把标题和价格记到笔记里
# [L3] EbayProductShareToWechat         帮我在eBay找最便宜的全新{query}，把商品名称和价格(包含运费)微信发给{contact}，问问他觉得怎么样
# [L3] AlipayLargestExpenseToNotes      查查支付宝交易记录里支出金额最大的一笔是什么、花了多少钱，在笔记里记录下来，提醒自己控制开支
# [L4] EbayDualItemCompareToNotes       分别在eBay搜{item1}和{item2}的最低价，在笔记里记下哪个更便宜、便宜多少
# [L3] AlipayLargestExpenseToMoments    翻翻支付宝账单，找到花钱最多的那笔，发条朋友圈吐槽一下
# [L3] AlipayMonthlyToNotesAndWechat    查支付宝这个月总支出，在笔记新建一条记录，再发微信告诉{contact}花了多少
# [L4] EbayBalanceDiffToNotes           在eBay查一下最便宜的全新{query}，看看我用支付宝余额买的话还剩多少钱，在笔记把这个商品、价格和剩余余额写下来
# [L4] EbayDualItemBalanceToNotes       分别在eBay搜{item1}和{item2}最便宜的，看看都买的话支付宝还剩多少钱，在笔记里记下两个商品名、各自价格和剩余余额
# [L4] FullShoppingDecisionFlow         帮我在eBay找最便宜的全新{query}，看购买后支付宝余额还剩下多少，在笔记记录下商品和余额，然后给微信{contact}发消息看他要不要一起买这款商品
# [L3] AlipayShareBillDetail            在支付宝看最近一笔支出账单，把交易标题和交易金额微信发给{contact}
# [L4] FinancialReportToNotes           帮我查一下支付宝的余额和最近一笔消费，记到笔记里。
# [L4] EbayPriceBelowBudgetToNotes      帮我在Ebay看看{product}现在最便宜要多少钱，如果低于我的预算{price_limit}元就记到备忘录里。
# -- End Task Index --


from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.alipay.app import Alipay
from bench_env.task.base import BaseTask
from bench_env.task.ebay.app import EBAY_SEARCH_QUERY_PARAM, Ebay, expect_top
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import NOTES_CREATE_CHANGES, Notes
from bench_env.task.utils import amount_labels
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_MOMENT_CHANGES, WECHAT_SEND_CHANGES, Wechat

# ══════════════════════════════════════════════════════════════════════════
# L2 — 基础余额搬运
# ══════════════════════════════════════════════════════════════════════════


class AlipayBalanceToWechat(BaseTask):
    """判定：给 {contact} 的微信新消息包含支付宝余额。"""

    templates = [
        "查一下我支付宝余额，发微信告诉{contact}",
        "帮我看看支付宝还有多少钱，发微信告诉{contact}",
    ]
    apps = ["alipay", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L2"
    capabilities = ["query", "transfer"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps_init["alipay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        balance = round(float(ali.total_balance), 2)
        return [
            wechat.check_new_sent_contains_number(
                self.p.contact,
                balance,
                field="wechat_balance",
            )
        ]


# ══════════════════════════════════════════════════════════════════════════
# L3 — 2-APP transfer / sequential
# ══════════════════════════════════════════════════════════════════════════


class AlipayMonthlySpendToWechat(BaseTask):
    """判定：给 {contact} 的微信新消息包含支付宝本月总支出金额。"""

    templates = [
        "看看我支付宝这个月花了多少钱，发微信告诉{contact}",
    ]
    apps = ["alipay", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["query", "transfer"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps_init["alipay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        month = datetime.datetime.fromtimestamp(
            int(input.os_init["time"]["timestamp"]) / 1000.0
        ).strftime("%Y-%m")
        amount = round(ali.monthly_expense(month), 2)
        return [
            wechat.check_new_sent_contains_number(
                self.p.contact,
                amount,
                field="wechat_monthly_spend",
            )
        ]


class AlipayRecentTransactionsToNotes(BaseTask):
    """模板里的“最近 5 笔”以初始状态中按时间倒序的前 5 笔交易为准。"""

    templates = [
        "查看我支付宝最近5笔交易，在笔记里记录每笔的金额和交易内容",
        "Check my last 5 transactions on Alipay and record the amount and description of each one in Notes",
    ]
    apps = ["alipay", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["query", "create", "transfer"]
    expected_changes = NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps_init["alipay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        txs = ali.latest_n_transactions(5)
        checks: list[dict[str, Any]] = []
        for idx, tx in enumerate(txs, start=1):
            labels = ali.transaction_labels(tx)
            amount = round(abs(float(tx["delta"])), 2)
            checks.append(notes.check_latest_contains_any_of(labels[:3], field=f"tx_{idx}_label"))
            checks.append(notes.check_latest_contains_number(amount, field=f"tx_{idx}_amount"))
        return checks


class EbayLowestPriceToNotes(BaseTask):
    """判定：最新笔记包含 {query} 搜索结果中最低总价商品的标题和价格。"""

    templates = [
        "在eBay搜{query}，找到最便宜的那个，把标题和价格记到笔记里",
    ]
    apps = ["ebay", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "create", "transfer"]
    parameters = {"query": EBAY_SEARCH_QUERY_PARAM}
    expected_changes = [
        "ebay.search.current", "ebay.search.history", "ebay.recentSearches",
        "ebay.search.lastCompare",
    ] + NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        top = ebay.cheapest_product(query=self.p.query)
        return [
            ebay.check_search_snapshot(self.p.query, field="ebay_search"),
            notes.check_latest_contains(top.title, field="note_title"),
            notes.check_latest_contains_number(round(top.total_cost, 2), field="note_price"),
        ]


class EbayProductShareToWechat(BaseTask):
    """模板里的“全新”是筛选条件。"""

    templates = [
        "帮我在eBay找最便宜的全新{query}，把商品名称和价格(包含运费)微信发给{contact}，问问他觉得怎么样",
    ]
    apps = ["ebay", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "query", "transfer"]
    parameters = {
        "query": EBAY_SEARCH_QUERY_PARAM,
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = [
        "ebay.search.current", "ebay.search.history", "ebay.recentSearches",
        "ebay.search.lastCompare",
    ] + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        top = ebay.cheapest_product(query=self.p.query, condition="全新")
        return [
            ebay.check_search_snapshot(self.p.query, condition="全新", field="ebay_search"),
            wechat.check_new_sent_contains(self.p.contact, top.title, field="wechat_title"),
            wechat.check_new_sent_contains_number(
                self.p.contact,
                round(top.total_cost, 2),
                field="wechat_price",
            ),
        ]


# ══════════════════════════════════════════════════════════════════════════
# L3 — 2-APP deep_dive
# ══════════════════════════════════════════════════════════════════════════


class AlipayLargestExpenseToNotes(BaseTask):
    """判定：最新笔记包含历史单笔最大支出的交易对象和金额。"""

    templates = [
        "查查支付宝交易记录里支出金额最大的一笔是什么、花了多少钱，在笔记里记录下来，提醒自己控制开支",
        "Check my Alipay transaction history, find the single largest expense, and record what it was and how much it cost in Notes as a reminder to control spending",
    ]
    apps = ["alipay", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["query", "reasoning", "create"]
    expected_changes = NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps_init["alipay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        tx = ali.largest_expense()
        return [
            notes.check_latest_contains(ali.transaction_primary_label(tx), field="largest_expense_target"),
            notes.check_latest_contains_number(
                round(abs(float(tx["delta"])), 2),
                field="largest_expense_amount",
            ),
        ]


# ══════════════════════════════════════════════════════════════════════════
# L4 — 2-APP deep_dive
# ══════════════════════════════════════════════════════════════════════════



class EbayDualItemCompareToNotes(BaseTask):
    """判定：最新笔记包含两次搜索后更便宜的商品和差价。"""

    templates = [
        "分别在eBay搜{item1}和{item2}的最低价，在笔记里记下哪个更便宜、便宜多少",
        "Search eBay for the lowest price of {item1} and {item2} separately, and write in Notes which one is cheaper and by how much",
    ]
    apps = ["ebay", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "reasoning", "create"]
    parameters = {
        "item1": {"type": "string", "default": "电脑", "description": "第一个搜索商品"},
        "item2": {"type": "string", "default": "电视", "description": "第二个搜索商品"},
        "_items": {
            "sampler": Ebay.sample_two_items,
            "fields": {"item1": "item1", "item2": "item2"},
        },
    }
    expected_changes = [
        "ebay.search.current", "ebay.search.history", "ebay.recentSearches",
        "ebay.search.lastCompare",
    ] + NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        # 正确答案从产品数据库计算，不依赖 Agent 搜索页面展示的顺序
        winner, _first, _second, diff = ebay.compare_cheapest_products(
            query1=self.p.item1, query2=self.p.item2,
        )
        return [
            ebay.check_search_snapshot(self.p.item1, sort_option="priceLow", field="item1_search"),
            ebay.check_search_snapshot(self.p.item2, sort_option="priceLow", field="item2_search"),
            notes.check_latest_contains(winner, field="cheaper_item")
            if winner == "相同"
            else notes.check_latest_contains_any_of([winner], field="cheaper_item"),
            notes.check_latest_contains_number(diff, field="price_diff"),
        ]


class AlipayLargestExpenseToMoments(BaseTask):
    """判定：新发朋友圈包含支付宝单笔最大支出的交易标题和金额。"""

    templates = [
        "翻翻支付宝账单，找到花钱最多的那笔，发条朋友圈吐槽一下",
        "Look through my Alipay bills, find the biggest expense, and post a Moments complaint about it",
    ]
    apps = ["alipay", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["query", "social"]
    expected_changes = WECHAT_MOMENT_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps_init["alipay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        tx = ali.largest_expense()
        labels = ali.transaction_labels(tx)
        amount = round(abs(float(tx["delta"])), 2)
        return [
            wechat.check_new_moment_contains_labels_and_number(
                labels,
                amount,
                field="moment_tx",
            )
        ]


# ══════════════════════════════════════════════════════════════════════════
# L3 — 3-APP transfer
# ══════════════════════════════════════════════════════════════════════════


class AlipayMonthlyToNotesAndWechat(BaseTask):
    """判定：最新笔记和给 {contact} 的微信新消息都包含支付宝本月总支出金额。"""

    templates = [
        "查支付宝这个月总支出，在笔记新建一条记录，再发微信告诉{contact}花了多少",
    ]
    apps = ["alipay", "notes", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["query", "create", "transfer"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ali = Alipay(input.apps_init["alipay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        month = datetime.datetime.fromtimestamp(
            int(input.os_init["time"]["timestamp"]) / 1000.0
        ).strftime("%Y-%m")
        amount = round(ali.monthly_expense(month), 2)
        return [
            notes.check_latest_contains_number(amount, field="note_monthly_spend"),
            wechat.check_new_sent_contains_number(
                self.p.contact,
                amount,
                field="wechat_monthly_spend",
            ),
        ]


# ══════════════════════════════════════════════════════════════════════════
# L4 — 3-APP deep_dive
# ══════════════════════════════════════════════════════════════════════════


class EbayBalanceDiffToNotes(BaseTask):
    """判定：最新笔记包含全新 {query} 的最低总价商品名、价格，以及购买后剩余余额。
    注入：随机设置支付宝余额在 5000-10000 之间，确保足够购买。
    """

    templates = [
        "在eBay查一下最便宜的全新{query}，看看我用支付宝余额买的话还剩多少钱，在笔记把这个商品、价格和剩余余额写下来",
    ]
    apps = ["ebay", "alipay", "notes"]
    scope = "S3"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "query", "reasoning", "create"]
    parameters = {"query": EBAY_SEARCH_QUERY_PARAM}
    expected_changes = [
        "ebay.search.current", "ebay.search.history", "ebay.recentSearches",
        "ebay.search.lastCompare",
    ] + NOTES_CREATE_CHANGES

    async def _post_sample(self, env: Any) -> None:
        """注入足够购买的支付宝余额。"""
        balance = round(self.sampler.rng.uniform(5000, 10000), 2)
        await env.set_state(
            {"apps": {"alipay": {"balance": {"total": balance}}}},
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        # 搜索快照和注入后的余额都属于当前执行结果，应读取 last_obs 中的状态。
        ebay = Ebay(input.apps["ebay"])
        ali = Alipay(input.apps["alipay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        top = ebay.cheapest_product(query=self.p.query, condition="全新")
        remain = round(float(ali.total_balance) - top.total_cost, 2)
        return [
            ebay.check_search_snapshot(self.p.query, condition="全新", field="ebay_search"),
            notes.check_latest_contains(top.title, field="note_title"),
            notes.check_latest_contains_number(top.total_cost, field="note_price"),
            notes.check_latest_contains_number(remain, field="note_remain"),
        ]


class EbayDualItemBalanceToNotes(BaseTask):
    """判定：笔记记录两个商品价格以及购买后的余额。"""

    templates = [
        "分别在eBay搜{item1}和{item2}最便宜的，看看都买的话支付宝还剩多少钱，在笔记里记下两个商品名、各自价格和剩余余额",
        "Search eBay for the cheapest {item1} and {item2}, check how much Alipay balance I'd have left if I buy both, and record both product names, prices, and remaining balance in Notes",
    ]
    apps = ["ebay", "alipay", "notes"]
    scope = "S3"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "query", "reasoning", "create"]
    parameters = {
        "item1": {"type": "string", "default": "电脑", "description": "第一个搜索商品"},
        "item2": {"type": "string", "default": "电视", "description": "第二个搜索商品"},
        "_items": {
            "sampler": Ebay.sample_two_items,
            "fields": {"item1": "item1", "item2": "item2"},
        },
    }
    expected_changes = [
        "ebay.search.current", "ebay.search.history", "ebay.recentSearches",
        "ebay.search.lastCompare",
    ] + NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps_init["ebay"])
        ali = Alipay(input.apps_init["alipay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        first = ebay.cheapest_product(query=self.p.item1)
        second = ebay.cheapest_product(query=self.p.item2)
        remain = round(float(ali.total_balance) - first.total_cost - second.total_cost, 2)
        return [
            notes.check_latest_contains(first.title, field="item1_title"),
            notes.check_latest_contains(second.title, field="item2_title"),
            notes.check_latest_contains_all_numbers(
                [round(first.total_cost, 2), round(second.total_cost, 2), remain],
                field="prices_and_balance",
            ),
        ]


# ══════════════════════════════════════════════════════════════════════════
# L4 — 4 APP 完整链路
# ══════════════════════════════════════════════════════════════════════════


class FullShoppingDecisionFlow(BaseTask):
    """判定：最新笔记包含购买后余额，给 {contact} 的微信新消息包含同一商品信息。"""

    templates = [
        "帮我在eBay找最便宜的全新{query}，看购买后支付宝余额还剩下多少，在笔记记录下商品和余额，然后给微信{contact}发消息看他要不要一起买这款商品",
    ]
    apps = ["ebay", "alipay", "notes", "wechat"]
    scope = "S3"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "query", "reasoning", "create", "transfer"]
    parameters = {
        "query": EBAY_SEARCH_QUERY_PARAM,
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = [
        "ebay.search.current",
        "ebay.search.history",
        "ebay.recentSearches",
        "ebay.search.lastCompare",
    ] + NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        # eBay 搜索行为发生在当前状态，搜索快照校验应读取 last_obs 中的最新搜索结果。
        ebay = Ebay(input.apps["ebay"])
        ali = Alipay(input.apps_init["alipay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        top = ebay.cheapest_product(query=self.p.query, condition="全新")
        remain = round(float(ali.total_balance) - top.total_cost, 2)
        return [
            ebay.check_search_snapshot(self.p.query, condition="全新", field="ebay_search"),
            notes.check_latest_contains(top.title, field="note_title"),
            notes.check_latest_contains_number(remain, field="note_balance_after_buy"),
            wechat.check_new_sent_contains(self.p.contact, top.title, field="wechat_title"),
        ]


class AlipayShareBillDetail(BaseTask):
    """判定：把最近一笔支出的商家名和金额发给联系人。"""

    templates = ["在支付宝看最近一笔支出账单，把交易标题和交易金额微信发给{contact}"]
    apps = ["alipay", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L2"
    capabilities = ["query", "transfer"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        alipay = Alipay(input.apps_init["alipay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        merchant = alipay.latest_expense_merchant()
        labels = amount_labels(alipay.last_expense_amount())
        return [
            wechat.check_new_sent_any_of(self.p.contact, labels, merchant, field="sent_bill_detail")
        ]


class FinancialReportToNotes(BaseTask):
    """判定：备忘录包含余额和最近一笔消费。"""

    templates = [
        "帮我查一下支付宝的余额和最近一笔消费，记到笔记里。",
        "Check my Alipay balance and most recent expense, and record them in Notes.",
    ]
    apps = ["alipay", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["query", "finance", "create", "transfer"]
    parameters = {}
    expected_changes = NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        alipay = Alipay(input.apps_init["alipay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        balance = float(alipay.total_balance)
        last_expense = alipay.last_expense_amount()
        return [
            notes.check_latest_contains_all_numbers(
                [balance, last_expense],
                field="finance_note",
            )
        ]


class EbayPriceBelowBudgetToNotes(BaseTask):
    """判定：最低价低于预算时把结果记到备忘录。"""

    templates = [
        "帮我在Ebay看看{product}现在最便宜要多少钱，如果低于我的预算{price_limit}元就记到备忘录里。",
        "Check the cheapest {product} on eBay for me. If the price is below my budget of {price_limit} yuan, write it down in Notes.",
    ]
    apps = ["ebay", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "reasoning", "create"]
    parameters = {
        "product": {"type": "string", "default": "相机"},
        "price_limit": {"type": "float", "default": 1000.0},
    }
    expected_changes = [
        "ebay.search.current", "ebay.search.history", "ebay.recentSearches",
        "ebay.search.lastCompare",
    ] + NOTES_CREATE_CHANGES

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        # eBay search will always update search history / recent searches / compare snapshot.
        expected = [
            "ebay.search.current",
            "ebay.search.history",
            "ebay.recentSearches",
            "ebay.search.lastCompare",
        ]
        top1 = expect_top(query=str(self.p.product), sort_id="priceLow", n=1)[0]
        if top1.total_cost <= float(self.p.price_limit):
            expected.extend(NOTES_CREATE_CHANGES)
        return expected

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        expected = expect_top(query=str(self.p.product), sort_id="priceLow", n=1)[0]
        expected_total_cents = int(round(float(expected.total_cost) * 100))
        # 校验当前搜索页（search.current），不扫历史——避免"先搜对再切走"的误判
        search_check = ebay.check_current_search(
            str(self.p.product),
            sort_option="priceLow",
            first_total_cents=expected_total_cents,
            field="ebay_cheapest",
        )
        cheapest_ok = search_check["passed"]
        price_ok = cheapest_ok and expected.total_cost <= float(self.p.price_limit)
        if price_ok:
            return [
                ebay.check_current_search(str(self.p.product), field="ebay_query"),
                search_check,
                notes.check_latest_contains(expected.title, field="note_product"),
                notes.check_latest_contains_number(
                    round(expected.total_cost, 2), field="note_price"
                ),
            ]
        return [
            ebay.check_current_search(str(self.p.product), field="ebay_query"),
            search_check,
            {
                "field": "notes_not_required",
                "expected": f"最便宜价格 > 预算 {self.p.price_limit}，无需写入",
                "actual": "跳过笔记检查",
                "passed": True,
            },
        ]
