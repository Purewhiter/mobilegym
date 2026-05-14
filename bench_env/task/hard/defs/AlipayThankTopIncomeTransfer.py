from __future__ import annotations

from typing import Any

from bench_env.task.alipay.app import Alipay
from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import NOTES_CREATE_CHANGES, Notes
from bench_env.task.wechat.app import WECHAT_SEND_CHANGES, Wechat


# 微信联系人里默认没有"林若溪"，需要 _prepare 注入一条，昵称写 "若溪"。
_INJECTED_CONTACT_NAME = "若溪"
_INJECTED_CONTACT_ALIAS = "林若溪"


class AlipayThankTopIncomeTransfer(BaseTask):
    """判定：笔记按行含全量收款转账笔数与最高金额 + 微信给"若溪"发了新消息（谢他）。

    数据契约：支付宝全量最大一笔转账收入在 Alipay 默认数据里为
    "转账-Hui"（targetAccount="Hui(林若溪)"）2500 元，微信对应联系人昵称"若溪"。
    """

    templates = [
        "在支付宝看看我一共收到过多少笔转账，其中最高的一笔是谁转给我的，转了多少钱，把转账笔数和最高金额依次分行记到笔记里，然后去微信谢谢他。",
    ]
    apps = ["alipay", "notes", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "create", "handoff"]
    parameters = {}
    expected_changes = NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        wechat_state = Wechat(state["apps"]["wechat"]).prepare_state_with_contact(
            name=_INJECTED_CONTACT_NAME,
            alias=_INJECTED_CONTACT_ALIAS,
        )
        await env.set_state(
            {"apps": {"wechat": wechat_state}},
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        alipay = Alipay(input.apps_init["alipay"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        count = alipay.incoming_transfer_count()
        top = alipay.largest_incoming_transfer()
        amount = float(top["delta"])
        return [
            notes.check_latest_contains_number_lines(
                [float(count), amount],
                tolerance=0.01,
                field="top_income_transfer_note",
            ),
            # 模板要求"谢谢他"——不绑定具体措辞，但至少要命中感谢语气的任一候选。
            wechat.check_new_sent_any_of(
                _INJECTED_CONTACT_NAME,
                ["谢谢", "感谢", "Thanks", "thanks", "thank you", "thank"],
                field="thank_note",
            ),
        ]
