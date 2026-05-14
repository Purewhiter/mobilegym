from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import day_time_ms, sim_today
from bench_env.task.wechat.app import Wechat


class CountOpenWorkOrdersFromPhotosToWechat(BaseTask):
    """从相册中的密集工单表照片里统计未闭环工单，并微信回复给陈静。"""

    templates = [
        "打开微信看看陈静让你处理的现场工单表口径，去查看相关照片，统计后微信回给陈静。"
    ]
    apps = ["wechat", "gallery"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["image", "extract", "reasoning", "handoff"]
    expected_changes = ["wechat.chats[user.name=陈静].messages"]

    photo_paths = [
        "/sdcard/DCIM/Camera/IMG_8041.jpg",
        "/sdcard/DCIM/Camera/IMG_8042.jpg",
        "/sdcard/DCIM/Camera/IMG_8043.jpg",
        "/sdcard/DCIM/Camera/IMG_8044.jpg",
        "/sdcard/DCIM/Camera/IMG_8045.jpg",
        "/sdcard/DCIM/Camera/IMG_8046.jpg",
    ]
    target_work_order_ids = [
        "WO-A-001",
        "WO-A-002",
        "WO-A-006",
        "WO-A-008",
        "WO-A-012",
        "WO-A-015",
        "WO-A-019",
        "WO-A-020",
        "WO-A-025",
        "WO-A-027",
        "WO-A-032",
        "WO-A-033",
        "WO-B-002",
        "WO-B-006",
        "WO-B-008",
        "WO-B-012",
        "WO-B-019",
        "WO-B-027",
        "WO-B-032",
        "WO-C-002",
        "WO-C-006",
        "WO-C-012",
        "WO-C-019",
        "WO-C-027",
        "WO-C-032",
        "WO-D-002",
        "WO-D-012",
    ]
    target_count = len(target_work_order_ids)
    distractor_prefixes = ["AR-X", "AD-M"]
    photographed_count = 12

    def chenjing_message_for_os(self, os_state: dict[str, Any]) -> str:
        return (
            "现场那批拍屏表我还没来得及筛，你帮我把没闭环的单号列一下。"
            "待复测的也算，别的不用。顺便统计一下所有现场确定拍过照的数量。"
        )

    def boss_message_for_os(self, os_state: dict[str, Any]) -> str:
        return "上次那批工单旧图先不用发我，等复盘会再统一看。"

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        today = sim_today(state["os"])
        wechat_state = Wechat(state["apps"]["wechat"]).prepare_state_with_incoming_text(
            "陈静",
            self.chenjing_message_for_os(state["os"]),
            message_id="chenjing_request_open_work_orders",
            timestamp=day_time_ms(today, "09:07"),
        )
        wechat_state = Wechat(wechat_state).prepare_state_with_incoming_text(
            "Boss",
            self.boss_message_for_os(state["os"]),
            message_id="boss_work_order_photo_distractor",
            timestamp=day_time_ms(today, "09:12"),
        )
        chenjing_chat = Wechat(wechat_state).ensure_chat_with_contact("陈静")
        chenjing_chat["isSticky"] = True
        await env.set_state({"apps": {"wechat": wechat_state}}, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            wechat.check_new_sent_contains_number(
                "陈静",
                self.target_count,
                field="wechat.chenjing_open_work_order_count",
            ),
            wechat.check_new_sent_norm_contains(
                "陈静",
                *self.target_work_order_ids,
                field="wechat.chenjing_open_work_order_ids",
            ),
            wechat.check_new_sent_norm_excludes(
                "陈静",
                *self.distractor_prefixes,
                field="wechat.chenjing_no_distractor_work_orders",
            ),
            wechat.check_new_sent_number_near_any_keyword(
                "陈静",
                self.photographed_count,
                ["拍过照", "拍照"],
                field="wechat.chenjing_photographed_count",
            ),
        ]
