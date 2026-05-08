from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.file_manager.app import FileSystem
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import day_time_ms, sim_today
from bench_env.task.wechat.app import Wechat


class SubmitRequestedAttachmentsToBoss(BaseTask):
    """根据微信里的补交要求，从待提交目录找对应附件并回报文件名。"""

    templates = [
        "在微信看看老板最近让我补交的材料，然后在 Download/待提交 里找到对应文件，移动到 Documents/submission，并把文件名微信回复给老板。"
    ]
    apps = ["wechat", "file_manager"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["file_search", "metadata_reasoning", "transfer"]
    expected_changes = ["os.fileSystem", "wechat.chats[user.name=Boss].messages"]

    source_dir = "/sdcard/Download/待提交"
    target_dir = "/sdcard/Documents/submission"
    target_files = ["供应商盖章确认.pdf", "流水截图_A.png"]
    move_map = {
        f"{source_dir}/供应商盖章确认.pdf": f"{target_dir}/供应商盖章确认.pdf",
        f"{source_dir}/流水截图_A.png": f"{target_dir}/流水截图_A.png",
    }
    preserve_paths = [
        f"{source_dir}/供应商草稿确认.pdf",
        f"{source_dir}/流水截图_B.png",
        f"{source_dir}/流水截图_C.png",
        f"{source_dir}/报销汇总表.xlsx",
        f"{source_dir}/合同扫描件.pdf",
        f"{source_dir}/行政材料清单.txt",
        f"{source_dir}/archive/供应商盖章确认.pdf",
    ]

    @staticmethod
    def previous_week_bounds(os_state: dict[str, Any]) -> tuple[datetime.date, datetime.date]:
        today = sim_today(os_state)
        this_monday = today - datetime.timedelta(days=today.weekday())
        prev_monday = this_monday - datetime.timedelta(days=7)
        prev_sunday = this_monday - datetime.timedelta(days=1)
        return prev_monday, prev_sunday

    def seed_files_for_os(self, os_state: dict[str, Any]) -> list[dict[str, Any]]:
        prev_monday, prev_sunday = self.previous_week_bounds(os_state)
        target_day = prev_monday + datetime.timedelta(days=2)
        current_week_day = prev_sunday + datetime.timedelta(days=2)
        old_day = prev_monday - datetime.timedelta(days=9)
        return [
            {
                "path": f"{self.source_dir}/供应商盖章确认.pdf",
                "content": "合同补充材料：供应商盖章确认页。",
                "mimeType": "application/pdf",
                "createdAt": day_time_ms(prev_monday, "11:20"),
                "modifiedAt": day_time_ms(prev_monday, "11:20"),
            },
            {
                "path": f"{self.source_dir}/供应商草稿确认.pdf",
                "content": "合同补充材料草稿，缺少盖章。",
                "mimeType": "application/pdf",
                "createdAt": day_time_ms(prev_monday, "09:10"),
                "modifiedAt": day_time_ms(prev_monday, "09:10"),
            },
            {
                "path": f"{self.source_dir}/流水截图_A.png",
                "content": "payment statement screenshot for requested week",
                "mimeType": "image/png",
                "createdAt": day_time_ms(target_day, "18:05"),
                "modifiedAt": day_time_ms(target_day, "18:05"),
            },
            {
                "path": f"{self.source_dir}/流水截图_B.png",
                "content": "payment statement screenshot for current week",
                "mimeType": "image/png",
                "createdAt": day_time_ms(current_week_day, "18:05"),
                "modifiedAt": day_time_ms(current_week_day, "18:05"),
            },
            {
                "path": f"{self.source_dir}/流水截图_C.png",
                "content": "payment statement screenshot for older week",
                "mimeType": "image/png",
                "createdAt": day_time_ms(old_day, "18:05"),
                "modifiedAt": day_time_ms(old_day, "18:05"),
            },
            {
                "path": f"{self.source_dir}/行政材料清单.txt",
                "content": (
                    "行政材料清单\n\n"
                    "报销汇总表：待复核\n"
                    "合同扫描件：待补页码\n"
                    "考勤确认：已完成\n"
                ),
                "mimeType": "text/plain",
                "createdAt": day_time_ms(prev_monday, "08:30"),
                "modifiedAt": day_time_ms(prev_monday, "08:30"),
            },
            {
                "path": f"{self.source_dir}/报销汇总表.xlsx",
                "content": "行政报销汇总，陈静待补交材料。",
                "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "createdAt": day_time_ms(current_week_day, "10:00"),
                "modifiedAt": day_time_ms(current_week_day, "10:00"),
            },
            {
                "path": f"{self.source_dir}/合同扫描件.pdf",
                "content": "行政合同扫描件，陈静待补交材料。",
                "mimeType": "application/pdf",
                "createdAt": day_time_ms(current_week_day, "10:15"),
                "modifiedAt": day_time_ms(current_week_day, "10:15"),
            },
            {
                "path": f"{self.source_dir}/archive/供应商盖章确认.pdf",
                "content": "旧批次盖章确认页，已归档。",
                "mimeType": "application/pdf",
                "createdAt": day_time_ms(old_day, "10:20"),
                "modifiedAt": day_time_ms(old_day, "10:20"),
            },
        ]

    def boss_message_for_os(self, os_state: dict[str, Any]) -> str:
        prev_monday, _ = self.previous_week_bounds(os_state)
        return (
            "上周审计那边还缺两份材料：供应商盖章确认页，"
            f"还有 {prev_monday.month} 月这批的上周付款流水截图。"
            "我下午要一起发给财务。"
        )

    def colleague_message_for_os(self, os_state: dict[str, Any]) -> str:
        today = sim_today(os_state)
        return (
            f"{today.month} 月行政这边要补交材料，麻烦你有空把报销汇总表.xlsx "
            "和合同扫描件.pdf 发我一下。"
        )

    def boss_wife_message_for_os(self, os_state: dict[str, Any]) -> str:
        today = sim_today(os_state)
        return (
            f"{today.month} 月的报销材料老板问起过，"
            "你晚点把报销汇总表和合同扫描件也帮我找一下。"
        )

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        files = self.seed_files_for_os(state["os"])
        wechat_state = Wechat(state["apps"]["wechat"]).prepare_state_with_incoming_text(
            "Boss",
            self.boss_message_for_os(state["os"]),
            message_id="boss_request_missing_attachments",
            timestamp=day_time_ms(sim_today(state["os"]), "09:12"),
        )
        wechat_state = Wechat(wechat_state).prepare_state_with_incoming_text(
            "陈静",
            self.colleague_message_for_os(state["os"]),
            message_id="chenjing_request_admin_attachments",
            timestamp=day_time_ms(sim_today(state["os"]), "09:18"),
        )
        chenjing_chat = Wechat(wechat_state).ensure_chat_with_contact("陈静")
        chenjing_chat["isSticky"] = True
        wechat_state = Wechat(wechat_state).prepare_state_with_contact(
            name="老板娘",
            wxid="wxid_boss_wife_009",
            avatar="avatars/avatar_51.jpg",
        )
        wechat_state = Wechat(wechat_state).prepare_state_with_incoming_text(
            "老板娘",
            self.boss_wife_message_for_os(state["os"]),
            message_id="boss_wife_request_admin_attachments",
            timestamp=day_time_ms(sim_today(state["os"]), "09:24"),
        )
        await env.set_state({"apps": {"wechat": wechat_state}}, deep=True, reload=False)
        await env.page.evaluate(
            """async ({sourceDir, targetDir, files}) => {
                const fs = window.__SIM_FS__;
                if (!fs) return;
                if (fs.exists(sourceDir)) await fs.delete(sourceDir);
                if (fs.exists(targetDir)) await fs.delete(targetDir);
                if (!fs.exists('/sdcard/Documents')) await fs.mkdir('/sdcard/Documents');
                await fs.mkdir(sourceDir);
                await fs.mkdir(`${sourceDir}/archive`);
                for (const file of files) {
                    await fs.write(file.path, file.content, {
                        mimeType: file.mimeType,
                        createdAt: file.createdAt,
                        modifiedAt: file.modifiedAt,
                    });
                }
            }""",
            {"sourceDir": self.source_dir, "targetDir": self.target_dir, "files": files},
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        fs = FileSystem(input.os["fileSystem"], init=input.os_init["fileSystem"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            fs.check_directory_created(
                self.target_dir,
                field="file_system.submission_created",
            ),
            fs.check_files_moved(
                self.move_map,
                field="file_system.requested_files_moved",
            ),
            fs.check_directory_file_names_exact(
                self.target_dir,
                self.target_files,
                field="file_system.submission_exact_files",
            ),
            fs.check_paths_preserved(
                self.preserve_paths,
                field="file_system.distractors_preserved",
            ),
            wechat.check_new_sent_contains(
                "Boss",
                *self.target_files,
                field="wechat.boss_file_names",
            ),
        ]
