"""Scripted validation plans for FileManager tasks."""

from __future__ import annotations

from bench_env.agent.scripted import Step, complete, long_press_at, swipe, tap_at, type_text, wait


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def drag_hold(point: list[int], *, summary: str) -> Step:
    return {"op": "drag", "point1": point, "point2": point, "summary": summary}


def path_row(path: str) -> str:
    return f'[data-trigger-params*=\'"path":"{path}"\']:visible'


def folder_path(path: str) -> str:
    return f'[data-trigger="folder.open"][data-trigger-params*=\'"path":"{path}"\']:visible'


def open_download_subfolder(path: str) -> list[Step]:
    return [
        wait(0.5, summary="wait for FileManager home"),
        swipe([500, 820], [500, 260], summary="scroll storage list to Download folder"),
        wait(0.3, summary="wait after scrolling storage list"),
        click_selector('button:has-text("Download"):visible', summary="open Download folder"),
        wait(0.4, summary="wait for Download folder"),
        click_selector(folder_path(path), summary=f"open {path}"),
        wait(0.4, summary="wait for target folder"),
    ]


def enter_select_mode(anchor_path: str) -> list[Step]:
    # Long-press the anchor file's OWN row (not a fixed coordinate) so the row we
    # then deselect is exactly the one selection-mode selected — otherwise a
    # mis-targeted anchor leaves a should-be-preserved file selected and deleted.
    return [
        long_press_at(path_row(anchor_path), summary="long-press anchor file row to enter selection mode"),
        wait(0.8, summary="wait for selection mode"),
        click_selector(path_row(anchor_path), summary="deselect anchor row (preserve file)"),
    ]


def select_rows(*paths: str) -> list[Step]:
    return [
        click_selector(path_row(path), summary=f"select {path}")
        for path in paths
    ]


def delete_selected() -> list[Step]:
    return [
        click_selector('div.absolute.bottom-0 button:has-text("删除"):visible', summary="open delete confirmation"),
        wait(0.3, summary="wait for delete dialog"),
        click_selector('div.fixed.inset-0 button:has-text("删除"):visible', summary="confirm deletion"),
        wait(0.6, summary="wait for deletion to finish"),
    ]


def create_folder(name: str) -> list[Step]:
    return [
        tap_at('button[aria-label="新建文件夹"]:visible', summary="open new folder dialog"),
        wait(0.3, summary="wait for new folder dialog"),
        type_text(name, selector="input:visible", clear=True, summary=f"type folder name {name}"),
        {"op": "back", "summary": "dismiss keyboard"},
        click_selector('div.fixed.inset-0 button:has-text("创建"):visible', summary="create folder"),
        wait(0.5, summary="wait for folder creation"),
    ]


def rename_file(target_path: str, new_name: str) -> list[Step]:
    anchor_path = "/sdcard/Download/事故证据/camara_20260202_side.txt"
    return [
        *enter_select_mode(anchor_path),
        click_selector(path_row(target_path), summary=f"select file to rename {target_path}"),
        click_selector('div.absolute.bottom-0 button:has-text("更多"):visible', summary="open selection more menu"),
        wait(0.3, summary="wait for more menu"),
        click_selector('div.fixed.inset-0 button:has-text("重命名"):visible', summary="open rename dialog"),
        wait(0.5, summary="wait for rename dialog"),
        type_text(new_name, selector="input:visible", clear=True, summary=f"type new file name {new_name}"),
        {"op": "back", "summary": "dismiss keyboard"},
        click_selector('div.fixed.inset-0 button:has-text("确定"):visible', summary="confirm rename"),
        wait(0.8, summary="wait for rename to finish"),
    ]


PLANS: dict[str, list[Step]] = {
    "file_manager.CreateKeepFolderAndDeleteRawLogs": [
        *open_download_subfolder("/sdcard/Download/日志导出"),
        *create_folder("保留-已汇总"),
        *enter_select_mode("/sdcard/Download/日志导出/final_report.pdf"),
        *select_rows(
            "/sdcard/Download/日志导出/raw_login.log",
            "/sdcard/Download/日志导出/raw_payment.log",
            "/sdcard/Download/日志导出/raw_sync.log",
        ),
        *delete_selected(),
        complete(),
    ],
    "file_manager.CleanObsoleteHandoffFiles": [
        *open_download_subfolder("/sdcard/Download/项目交接"),
        *enter_select_mode("/sdcard/Download/项目交接/budget_draft_0.txt"),
        # Select the two obsolete files visible at the top first, then scroll to
        # reveal the .bak backup (which sorts below the pdf/txt rows).
        *select_rows("/sdcard/Download/项目交接/budget_draft_1.txt"),
        click_selector('button:has-text("design_backup_1.bak"):visible', summary="select obsolete design backup v1"),
        swipe([500, 790], [500, 340], summary="scroll project handoff files toward quote and backup"),
        wait(0.3, summary="wait after scrolling project handoff folder"),
        *select_rows("/sdcard/Download/项目交接/vendor_quote_1.pdf"),
        *delete_selected(),
        complete(),
    ],
    "file_manager.RenameEvidenceFilesByDate": [
        *open_download_subfolder("/sdcard/Download/事故证据"),
        *rename_file("/sdcard/Download/事故证据/camera_20260203_scene.txt", "evidence_1.txt"),
        *rename_file("/sdcard/Download/事故证据/camera_20260130_gate.txt", "evidence_2.txt"),
        *rename_file("/sdcard/Download/事故证据/camera_20260201_lobby.txt", "evidence_3.txt"),
        complete(),
    ],
}
