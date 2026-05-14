from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.file_manager.app import FileSystem
from bench_env.task.judge import JudgeInput


class CreateKeepFolderAndDeleteRawLogs(BaseTask):
    templates = [
        "打开文件里的 Download/日志导出，新建一个名叫「保留-已汇总」的文件夹，然后删除 raw_ 开头的原始日志。"
    ]
    apps = ["file_manager"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["create", "delete"]
    expected_changes = ["os.fileSystem"]

    keep_folder_path = "/sdcard/Download/日志导出/保留-已汇总"
    target_paths = [
        "/sdcard/Download/日志导出/raw_login.log",
        "/sdcard/Download/日志导出/raw_payment.log",
        "/sdcard/Download/日志导出/raw_sync.log",
    ]
    preserve_paths = [
        "/sdcard/Download/日志导出/summary_2026Q1.txt",
        "/sdcard/Download/日志导出/final_report.pdf",
        "/sdcard/Download/日志导出/rawdata_sync.log",
        "/sdcard/Download/日志导出/raw-summary_2026Q1.txt",
        "/sdcard/Download/日志导出/raw_template.txt",
        "/sdcard/Download/日志导出/raw_notice.txt",
    ]
    seed_files = [
        {
            "path": "/sdcard/Download/日志导出/raw_login.log",
            "content": "2026-04-20 09:12:08 INFO login-service user=13800001234 action=login result=success\n2026-04-20 09:13:41 WARN login-service retry=2 ip=10.0.4.18\n2026-04-20 09:15:02 INFO login-service exported=true source=raw",
            "mimeType": "text/plain",
        },
        {
            "path": "/sdcard/Download/日志导出/raw_payment.log",
            "content": "2026-04-20 10:05:11 INFO payment order=P20260420001 amount=128.50 status=paid\n2026-04-20 10:07:33 ERROR payment order=P20260420002 code=TIMEOUT retry=true\n2026-04-20 10:08:10 INFO payment exported=true source=raw",
            "mimeType": "text/plain",
        },
        {
            "path": "/sdcard/Download/日志导出/raw_sync.log",
            "content": "2026-04-20 11:20:00 INFO sync module=inventory batch=17 status=start\n2026-04-20 11:23:42 INFO sync module=inventory updated=342 failed=0\n2026-04-20 11:24:01 INFO sync exported=true source=raw",
            "mimeType": "text/plain",
        },
        {"path": "/sdcard/Download/日志导出/summary_2026Q1.txt", "content": "summary", "mimeType": "text/plain"},
        {"path": "/sdcard/Download/日志导出/final_report.pdf", "content": "final report", "mimeType": "application/pdf"},
        {"path": "/sdcard/Download/日志导出/rawdata_sync.log", "content": "rawdata sync report", "mimeType": "text/plain"},
        {"path": "/sdcard/Download/日志导出/raw-summary_2026Q1.txt", "content": "raw summary", "mimeType": "text/plain"},
        {
            "path": "/sdcard/Download/日志导出/raw_template.txt",
            "content": "\n\n本文件只是给同事填写导出说明用的模板。",
            "mimeType": "text/plain",
        },
        {
            "path": "/sdcard/Download/日志导出/raw_notice.txt",
            "content": "目录说明\n\n",
            "mimeType": "text/plain",
        },
    ]

    async def _prepare(self, env: Any) -> None:
        await env.page.evaluate(
            """async ({files}) => {
                const fs = window.__SIM_FS__;
                if (!fs) return;
                if (fs.exists('/sdcard/Download/日志导出')) {
                    await fs.delete('/sdcard/Download/日志导出');
                }
                await fs.mkdir('/sdcard/Download/日志导出');
                for (const file of files) {
                    await fs.write(file.path, file.content, {mimeType: file.mimeType});
                }
            }""",
            {"files": self.seed_files},
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        fs = FileSystem(input.os["fileSystem"], init=input.os_init["fileSystem"])
        return [
            fs.check_directory_created(
                self.keep_folder_path,
                field="file_system.keep_folder_created",
            ),
            fs.check_paths_deleted(self.target_paths, field="file_system.raw_logs_deleted"),
            fs.check_paths_preserved(self.preserve_paths, field="file_system.summary_preserved"),
        ]
