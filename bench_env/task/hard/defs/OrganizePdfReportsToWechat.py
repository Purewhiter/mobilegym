from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.file_manager.app import FileSystem
from bench_env.task.judge import JudgeInput
from bench_env.task.wechat.app import WECHAT_SEND_CHANGES, Wechat


class OrganizePdfReportsToWechat(BaseTask):
    templates = [
        "把 Documents 目录下的所有 PDF 报告整理到 这个目录下的final_reports 文件夹中，然后把整理过去的文件名微信发给老板。"
    ]
    apps = ["file_manager", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "reasoning", "handoff"]
    expected_changes = ["os.fileSystem"] + WECHAT_SEND_CHANGES

    target_dir = "/sdcard/Documents/final_reports"
    move_map = {
        "/sdcard/Documents/客户资料/项目进展报告.pdf": "/sdcard/Documents/final_reports/项目进展报告.pdf",
        "/sdcard/Documents/验收材料/验收报告.pdf": "/sdcard/Documents/final_reports/验收报告.pdf",
        "/sdcard/Documents/研发归档/阶段总结报告.pdf": "/sdcard/Documents/final_reports/阶段总结报告.pdf",
        "/sdcard/Documents/研发归档/二期/测试报告.pdf": "/sdcard/Documents/final_reports/测试报告.pdf",
    }
    target_names = [
        "项目进展报告.pdf",
        "验收报告.pdf",
        "阶段总结报告.pdf",
        "测试报告.pdf",
    ]
    preserve_paths = [
        "/sdcard/Documents/reports/材料通告.pdf",
        "/sdcard/Documents/客户资料/发票.pdf",
        "/sdcard/Documents/客户资料/联系人.txt",
        "/sdcard/Documents/验收材料/设备照片.pdf",
        "/sdcard/Documents/验收材料/记录表.xlsx",
        "/sdcard/Documents/研发归档/接口说明.pdf",
        "/sdcard/Documents/研发归档/二期/会议纪要.pdf",
        "/sdcard/Documents/研发归档/二期/readme.md",
    ]
    seed_dirs = [
        "/sdcard/Documents/reports",
        "/sdcard/Documents/客户资料",
        "/sdcard/Documents/验收材料",
        "/sdcard/Documents/研发归档",
        "/sdcard/Documents/研发归档/二期",
    ]
    seed_files = [
        {
            "path": "/sdcard/Documents/reports/材料通告.pdf",
            "content": "材料通告\n\n本文件是材料提交提醒，不是报告。",
            "mimeType": "application/pdf",
        },
        {
            "path": "/sdcard/Documents/reports/归档说明.txt",
            "content": "reports 是历史材料目录，final_reports 用于本次整理。",
            "mimeType": "text/plain",
        },
        {
            "path": "/sdcard/Documents/客户资料/项目进展报告.pdf",
            "content": "项目进展报告\n\n客户A项目本周进展、风险和下阶段计划。",
            "mimeType": "application/pdf",
        },
        {
            "path": "/sdcard/Documents/客户资料/发票.pdf",
            "content": "发票\n\n客户A服务费发票扫描件。",
            "mimeType": "application/pdf",
        },
        {
            "path": "/sdcard/Documents/客户资料/联系人.txt",
            "content": "客户A联系人：王经理",
            "mimeType": "text/plain",
        },
        {
            "path": "/sdcard/Documents/验收材料/验收报告.pdf",
            "content": "验收报告\n\n一期系统验收结论和遗留事项。",
            "mimeType": "application/pdf",
        },
        {
            "path": "/sdcard/Documents/验收材料/设备照片.pdf",
            "content": "设备照片\n\n现场设备照片汇总。",
            "mimeType": "application/pdf",
        },
        {
            "path": "/sdcard/Documents/验收材料/记录表.xlsx",
            "content": "验收记录表",
            "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        {
            "path": "/sdcard/Documents/研发归档/阶段总结报告.pdf",
            "content": "阶段总结报告\n\n研发阶段成果、问题复盘和后续安排。",
            "mimeType": "application/pdf",
        },
        {
            "path": "/sdcard/Documents/研发归档/接口说明.pdf",
            "content": "接口说明\n\n服务接口参数和调用示例。",
            "mimeType": "application/pdf",
        },
        {
            "path": "/sdcard/Documents/研发归档/二期/测试报告.pdf",
            "content": "测试报告\n\n二期功能测试覆盖范围和缺陷统计。",
            "mimeType": "application/pdf",
        },
        {
            "path": "/sdcard/Documents/研发归档/二期/会议纪要.pdf",
            "content": "会议纪要\n\n二期需求评审会议纪要。",
            "mimeType": "application/pdf",
        },
        {
            "path": "/sdcard/Documents/研发归档/二期/readme.md",
            "content": "# 二期归档说明",
            "mimeType": "text/markdown",
        },
    ]

    async def _prepare(self, env: Any) -> None:
        await env.page.evaluate(
            """async ({dirs, files}) => {
                const fs = window.__SIM_FS__;
                if (!fs) return;
                const cleanup = [
                    '/sdcard/Documents/final_reports',
                    '/sdcard/Documents/reports',
                    '/sdcard/Documents/客户资料',
                    '/sdcard/Documents/验收材料',
                    '/sdcard/Documents/研发归档',
                ];
                await fs.mkdir('/sdcard/Documents');
                for (const path of cleanup) {
                    if (fs.exists(path)) {
                        await fs.delete(path);
                    }
                }
                for (const path of dirs) {
                    await fs.mkdir(path);
                }
                for (const file of files) {
                    await fs.write(file.path, file.content, {mimeType: file.mimeType});
                }
            }""",
            {"dirs": self.seed_dirs, "files": self.seed_files},
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        fs = FileSystem(input.os["fileSystem"], init=input.os_init["fileSystem"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            fs.check_directory_created(
                self.target_dir,
                field="file_system.final_reports_created",
            ),
            fs.check_files_moved(self.move_map, field="file_system.pdf_reports_moved"),
            fs.check_paths_preserved(self.preserve_paths, field="file_system.distractors_preserved"),
            fs.check_directory_file_names_exact(
                self.target_dir,
                self.target_names,
                field="file_system.final_reports_exact",
            ),
            wechat.check_new_sent_norm_contains(
                "Boss",
                *self.target_names,
                field="wechat.boss_report_names",
            ),
        ]
