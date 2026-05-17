from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.calendar.app import Calendar
from bench_env.task.file_manager.app import FileSystem
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import day_time_ms, sim_today
from bench_env.task.wechat.app import Wechat


class OrganizeMeetingMaterialsToWechat(BaseTask):
    """根据日历里的会后要求，整理对应会议资料并把文件名发给老板。"""

    templates = [
        "打开日历看看最近需要补资料的会议，然后在 Download/会议资料 里找到相关材料，整理到 Documents/meeting_pack，并把整理过去的文件名微信发给老板。"
    ]
    apps = ["calendar", "file_manager", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "search", "reasoning", "handoff"]
    expected_changes = [
        "os.fileSystem",
        "calendar.selectedDateTs",
        "wechat.chats[user.name=Boss].messages",
    ]

    source_dir = "/sdcard/Download/会议资料"
    target_dir = "/sdcard/Documents/meeting_pack"
    target_files = ["会议附件_03.xlsx", "会议附件_04.png", "会议附件_05.txt"]
    move_map = {
        f"{source_dir}/会议附件_03.xlsx": f"{target_dir}/会议附件_03.xlsx",
        f"{source_dir}/会议附件_04.png": f"{target_dir}/会议附件_04.png",
        f"{source_dir}/会议附件_05.txt": f"{target_dir}/会议附件_05.txt",
    }
    preserve_paths = [
        f"{source_dir}/会议附件_01.txt",
        f"{source_dir}/会议附件_02.xlsx",
        f"{source_dir}/会议附件_06.xlsx",
        f"{source_dir}/会议附件_07.png",
        f"{source_dir}/archive/会议附件_04.png",
    ]

    def seed_files_for_os(self, os_state: dict[str, Any]) -> list[dict[str, Any]]:
        today = sim_today(os_state)
        recent_day = today - datetime.timedelta(days=1)
        old_day = today - datetime.timedelta(days=21)
        return [
            {
                "path": f"{self.source_dir}/会议附件_01.txt",
                "content": "会议记录摘录：更新联系人和交接事项。",
                "mimeType": "text/plain",
                "createdAt": day_time_ms(recent_day, "10:30"),
                "modifiedAt": day_time_ms(recent_day, "10:30"),
            },
            {
                "path": f"{self.source_dir}/会议附件_02.xlsx",
                "content": "表格数据：人员、日期、班次、备注、确认状态。",
                "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "createdAt": day_time_ms(recent_day, "10:35"),
                "modifiedAt": day_time_ms(recent_day, "10:35"),
            },
            {
                "path": f"{self.source_dir}/会议附件_03.xlsx",
                "content": "表格数据：编号、类型、值守联系人、确认状态、备注。",
                "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "createdAt": day_time_ms(recent_day, "17:10"),
                "modifiedAt": day_time_ms(recent_day, "17:10"),
            },
            {
                "path": f"{self.source_dir}/会议附件_04.png",
                "content": "流程图导出图片：节点、连线、班次标记和说明框。",
                "mimeType": "image/png",
                "createdAt": day_time_ms(recent_day, "17:15"),
                "modifiedAt": day_time_ms(recent_day, "17:15"),
            },
            {
                "path": f"{self.source_dir}/会议附件_05.txt",
                "content": "会议记录摘录：补充背景、交接事项、后续动作和负责人。",
                "mimeType": "text/plain",
                "createdAt": day_time_ms(recent_day, "17:20"),
                "modifiedAt": day_time_ms(recent_day, "17:20"),
            },
            {
                "path": f"{self.source_dir}/会议附件_06.xlsx",
                "content": "登录链路超时排查清单",
                "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "createdAt": day_time_ms(today - datetime.timedelta(days=2), "11:20"),
                "modifiedAt": day_time_ms(today - datetime.timedelta(days=2), "11:20"),
            },
            {
                "path": f"{self.source_dir}/会议附件_07.png",
                "content": "old payment chain diagram",
                "mimeType": "image/png",
                "createdAt": day_time_ms(old_day, "15:10"),
                "modifiedAt": day_time_ms(old_day, "15:10"),
            },
            {
                "path": f"{self.source_dir}/archive/会议附件_04.png",
                "content": "archived callback diagram",
                "mimeType": "image/png",
                "createdAt": day_time_ms(old_day, "13:20"),
                "modifiedAt": day_time_ms(old_day, "13:20"),
            },
        ]

    def seed_calendar_events_for_os(self, os_state: dict[str, Any]) -> list[dict[str, Any]]:
        today = sim_today(os_state)
        created_at = day_time_ms(today - datetime.timedelta(days=4), "18:00")
        return [
            Calendar.prepare_event(
                event_id="hard_recent_login_review",
                title="登录体验复盘",
                date_text=(today - datetime.timedelta(days=2)).isoformat(),
                start_time="10:00",
                end_time="11:00",
                created_at=created_at,
                description="只记录行动项，资料由产品侧单独归档。",
            ),
            Calendar.prepare_event(
                event_id="hard_payment_callback_retro",
                title="支付回调复盘会",
                date_text=(today - datetime.timedelta(days=1)).isoformat(),
                start_time="15:00",
                end_time="16:30",
                created_at=created_at,
                description="会后导出的会议资料需要补给老板。",
            ),
            Calendar.prepare_event(
                event_id="hard_customer_shift_sync",
                title="客服排班同步",
                date_text=(today - datetime.timedelta(days=1)).isoformat(),
                start_time="09:30",
                end_time="10:00",
                created_at=created_at,
                description="会后导出了两份附件，发给陈静确认",
            ),
        ]

    def colleague_message_for_os(self, os_state: dict[str, Any]) -> str:
        recent_day = sim_today(os_state) - datetime.timedelta(days=1)
        return f"{recent_day.month} 月客服排班同步的两份会议附件，整理好以后发我一下。"

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        files = self.seed_files_for_os(state["os"])
        calendar_state = {
            **state["apps"]["calendar"],
            "events": self.seed_calendar_events_for_os(state["os"]),
        }
        wechat_state = Wechat(state["apps"]["wechat"]).prepare_state_with_incoming_text(
            "Boss",
            "会后资料整理好以后把文件名发我，别漏了。",
            message_id="boss_request_meeting_pack",
            timestamp=day_time_ms(sim_today(state["os"]), "09:05"),
        )
        wechat_state = Wechat(wechat_state).prepare_state_with_incoming_text(
            "陈静",
            self.colleague_message_for_os(state["os"]),
            message_id="chenjing_request_meeting_pack",
            timestamp=day_time_ms(sim_today(state["os"]), "09:16"),
        )
        chenjing_chat = Wechat(wechat_state).ensure_chat_with_contact("陈静")
        chenjing_chat["isSticky"] = True
        await env.set_state(
            {"apps": {"calendar": calendar_state, "wechat": wechat_state}},
            deep=True,
            reload=False,
        )
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
                field="file_system.meeting_pack_created",
            ),
            fs.check_files_moved(
                self.move_map,
                field="file_system.meeting_materials_moved",
            ),
            fs.check_directory_file_names_exact(
                self.target_dir,
                self.target_files,
                field="file_system.meeting_pack_exact_files",
            ),
            fs.check_paths_preserved(
                self.preserve_paths,
                field="file_system.distractors_preserved",
            ),
            wechat.check_new_sent_contains(
                "Boss",
                *self.target_files,
                field="wechat.boss_meeting_file_names",
            ),
        ]
