from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.railway12306.app import Railway12306
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_SEND_CHANGES, Wechat


class RailwayMyAccountToWechat(BaseTask):
    """判定：微信消息包含 12306 账号用户名（personalInfo.username）。"""

    templates = [
        "把我的 12306 账号微信发给{contact}",
    ]
    apps = ["railway12306", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "handoff"]
    parameters = {
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps_init["railway12306"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        username = rail.account_username
        return [
            wechat.check_new_sent_contains(
                self.p.contact,
                username,
                field="railway_account_share",
            ),
        ]
