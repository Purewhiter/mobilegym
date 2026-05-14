from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.file_manager.app import FileSystem
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import day_time_ms, sim_today
from bench_env.task.wechat.app import Wechat


class OrganizeReimbursementPhotosToWechat(BaseTask):
    """识别老板要的报销凭证照片，移动到指定目录并把金额和照片发给老板。"""

    templates = [
        "把老板要补的报销凭证整理到 Documents/reimburse_photos，处理好后微信回给老板。"
    ]
    apps = ["wechat", "gallery", "file_manager"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["image", "search", "reasoning", "handoff"]
    expected_changes = ["os.fileSystem", "wechat.chats[user.name=Boss].messages"]

    source_dir = "/sdcard/DCIM/Camera"
    target_dir = "/sdcard/Documents/reimburse_photos"
    target_files = ["IMG_20260417_184226.jpg", "IMG_20260418_093000.jpg"]
    target_total = 359.70
    move_map = {
        f"{source_dir}/IMG_20260417_184226.jpg": f"{target_dir}/IMG_20260417_184226.jpg",
        f"{source_dir}/IMG_20260418_093000.jpg": f"{target_dir}/IMG_20260418_093000.jpg",
    }
    target_paths = list(move_map.values())
    preserve_paths = [
        f"{source_dir}/IMG_20260417_181500.jpg",
        f"{source_dir}/IMG_20260417_181200.jpg",
        f"{source_dir}/IMG_20260418_091544.jpg",
        f"{source_dir}/IMG_20260423_191032.jpg",
    ]

    def boss_message_for_os(self, os_state: dict[str, Any]) -> str:
        return (
            "之前那批接待报销还差附件，吃饭那张和打车那张都补一下，把照片发我。"
            "金额也帮我顺手合个数。"
        )

    def colleague_message_for_os(self, os_state: dict[str, Any]) -> str:
        return (
            "行政报销我还差两张图，咖啡小票和停车的那张，"
            "你方便时发我一下。"
        )

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        today = sim_today(state["os"])
        wechat_state = Wechat(state["apps"]["wechat"]).prepare_state_with_incoming_text(
            "Boss",
            self.boss_message_for_os(state["os"]),
            message_id="boss_request_reimbursement_photos",
            timestamp=day_time_ms(today, "09:11"),
        )
        wechat_state = Wechat(wechat_state).prepare_state_with_incoming_text(
            "陈静",
            self.colleague_message_for_os(state["os"]),
            message_id="chenjing_request_reimbursement_photos",
            timestamp=day_time_ms(today, "09:18"),
        )
        chenjing_chat = Wechat(wechat_state).ensure_chat_with_contact("陈静")
        chenjing_chat["isSticky"] = True
        await env.set_state({"apps": {"wechat": wechat_state}}, deep=True, reload=False)
        await env.page.evaluate(
            """async ({targetDir}) => {
                const fs = window.__SIM_FS__;
                if (!fs) return;
                if (fs.exists(targetDir)) await fs.delete(targetDir);
                if (!fs.exists('/sdcard/Documents')) await fs.mkdir('/sdcard/Documents');
            }""",
            {"targetDir": self.target_dir},
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        fs = FileSystem(input.os["fileSystem"], init=input.os_init["fileSystem"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            fs.check_directory_created(
                self.target_dir,
                field="file_system.reimburse_photos_created",
            ),
            fs.check_files_moved(
                self.move_map,
                field="file_system.reimbursement_photos_moved",
            ),
            fs.check_directory_file_names_exact(
                self.target_dir,
                self.target_files,
                field="file_system.reimburse_photos_exact_files",
            ),
            fs.check_paths_preserved(
                self.preserve_paths,
                field="file_system.distractors_preserved",
            ),
            wechat.check_new_sent_contains_number(
                "Boss",
                self.target_total,
                field="wechat.boss_reimbursement_total",
            ),
            wechat.check_new_sent_images_exact(
                "Boss",
                self.target_paths,
                field="wechat.boss_reimbursement_images",
            ),
        ]
