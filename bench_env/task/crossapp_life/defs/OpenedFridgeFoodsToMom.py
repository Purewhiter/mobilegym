from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import day_time_ms, sim_today
from bench_env.task.wechat.app import Wechat


class OpenedFridgeFoodsToMom(BaseTask):
    """对比相册里的冰箱照片，把还开着没吃完的食物微信发给妈妈。"""

    templates = [
        "相册里有我拍的冰箱照片，去看看现在有哪些开了还没吃完的东西，微信发消息提醒妈妈记得吃。"
    ]
    apps = ["wechat", "gallery"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["image", "reasoning", "handoff"]
    expected_changes = ["wechat.chats[user.name=母亲].messages"]

    photo_paths = [
        "/sdcard/DCIM/Camera/IMG_8051.jpg",
        "/sdcard/DCIM/Camera/IMG_8052.jpg",
    ]
    target_food_aliases = [
        ["牛奶", "开封牛奶", "纯牛奶"],
        ["豆腐", "内酯豆腐"],
        ["西瓜"],
        ["草莓"],
        ["火腿", "火腿片"],
        ["柠檬", "半个柠檬"],
    ]
    excluded_food_keywords = [
        "鸡腿",
        "酸奶",
        "芝士",
        "芝士片",
        "沙拉酱",
        "辣椒酱",
        "生抽",
        "酱油",
        "果酱",
        "水饺",
        "饺子",
        "鸡蛋",
        "青菜",
        "面条",
    ]

    def mom_message_for_os(self, os_state: dict[str, Any]) -> str:
        return "你帮我看看冰箱里还有啥开了没吃完的，发我一下，我怕又忘了。"

    def mom_followup_for_os(self, os_state: dict[str, Any]) -> str:
        return "酱料瓶那些不用管。"

    def photo_files_for_os(self, os_state: dict[str, Any]) -> list[dict[str, Any]]:
        today = sim_today(os_state)
        yesterday = today - datetime.timedelta(days=1)
        return [
            {
                "path": self.photo_paths[0],
                "createdAt": day_time_ms(yesterday, "20:30"),
                "modifiedAt": day_time_ms(yesterday, "20:30"),
            },
            {
                "path": self.photo_paths[1],
                "createdAt": day_time_ms(today, "08:20"),
                "modifiedAt": day_time_ms(today, "08:20"),
            },
        ]

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        today = sim_today(state["os"])
        wechat_state = Wechat(state["apps"]["wechat"]).prepare_state_with_contact(
            name="母亲",
            wxid="wxid_mom_home",
        )
        wechat_state = Wechat(wechat_state).prepare_state_with_incoming_text(
            "母亲",
            self.mom_message_for_os(state["os"]),
            message_id="mom_request_opened_fridge_foods",
            timestamp=day_time_ms(today, "08:36"),
        )
        wechat_state = Wechat(wechat_state).prepare_state_with_incoming_text(
            "母亲",
            self.mom_followup_for_os(state["os"]),
            message_id="mom_request_opened_fridge_foods_followup",
            timestamp=day_time_ms(today, "08:37"),
        )
        mom_chat = Wechat(wechat_state).ensure_chat_with_contact("母亲")
        mom_chat["isSticky"] = True
        await env.set_state({"apps": {"wechat": wechat_state}}, deep=True, reload=False)
        await env.page.evaluate(
            """async ({files}) => {
                const fs = window.__SIM_FS__;
                if (!fs) return;
                for (const file of files) {
                    const node = fs.stat(file.path);
                    if (!node || node.type !== 'file') continue;
                    const content = await fs.read(file.path);
                    await fs.write(file.path, content, {
                        mimeType: node.mimeType || 'image/jpeg',
                        createdAt: file.createdAt,
                        modifiedAt: file.modifiedAt,
                    });
                }
            }""",
            {"files": self.photo_files_for_os(state["os"])},
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        checks = []
        for index, aliases in enumerate(self.target_food_aliases, start=1):
            checks.append(
                wechat.check_new_sent_any_of(
                    "母亲",
                    aliases,
                    field=f"wechat.mom_opened_fridge_food_{index}",
                )
            )
        checks.append(
            wechat.check_new_sent_norm_excludes(
                "母亲",
                *self.excluded_food_keywords,
                field="wechat.mom_no_fridge_distractors",
            )
        )
        return checks
