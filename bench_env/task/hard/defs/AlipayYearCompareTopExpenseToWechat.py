from __future__ import annotations

from typing import Any

from bench_env.task.alipay.app import Alipay
from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import sim_today
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_SEND_CHANGES, Wechat


class AlipayYearCompareTopExpenseToWechat(BaseTask):
    """判定：比较今年 vs 去年各自最大单笔支出，将金额更大的那笔的金额和交易对象微信发给联系人。

    "今年"=sim_today.year, "去年"=sim_today.year - 1。
    采样契约：两年各自的单笔最大支出存在且金额不同，胜者唯一。
    """

    templates = [
        "比较我支付宝去年支出最高的一笔和今年支出最高的一笔，哪个金额更大，把较大的金额和交易对象名称微信发给“{contact}”。",
    ]
    apps = ["alipay", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning", "transfer"]
    parameters = {
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        alipay = Alipay(input.apps_init["alipay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        this_year = sim_today(input.os_init).year
        last_year = this_year - 1
        this_top = alipay.yearly_largest_expense(this_year)
        last_top = alipay.yearly_largest_expense(last_year)
        this_amt = abs(float(this_top["delta"]))
        last_amt = abs(float(last_top["delta"]))
        assert this_amt != last_amt, (
            f"Upstream bug: two years have identical top-expense amount {this_amt}"
        )
        winner = this_top if this_amt > last_amt else last_top
        winner_amount = max(this_amt, last_amt)
        # 使用剥掉"转账-"前缀后的对方标签（与支付宝账单详情页展示一致），
        # 避免 Agent 按 UI 显示回复时错过 "转账-xxx" 这样的冗长前缀。
        counterparty_name = Alipay.transfer_counterparty_label(winner)
        return [
            wechat.check_new_sent_contains_number(
                self.p.contact,
                winner_amount,
                tolerance=0.02,
                field="year_compare_top_expense_amount",
            ),
            wechat.check_new_sent_norm_contains(
                self.p.contact,
                counterparty_name,
                field="year_compare_top_expense_counterparty",
            ),
        ]
