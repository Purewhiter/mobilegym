from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.launcher.app import Launcher
from bench_env.task.judge import JudgeInput


ENTERTAINMENT_CONTENT_APPS = [
    "bilibili",
    "redbook",
    "reddit",
    "spotify",
    "wechat_reading",
    "x",
]
ENTERTAINMENT_FOLDER_NAME = "摸鱼专区"


class DesktopAppsToFolder(BaseTask):
    templates = [
        "帮我把桌面上主要用来刷内容、看视频、听音乐或阅读的娱乐内容类应用整理到同一个文件夹里，命名为 摸鱼专区。"
    ]
    apps= []
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["nav", "create", "edit"]
    expected_changes = ["os.launcher"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        launcher = Launcher(input.os, init=input.os_init)
        return [
            launcher.check_folder_exact_apps(
                ENTERTAINMENT_FOLDER_NAME,
                ENTERTAINMENT_CONTENT_APPS,
            )
        ]
