from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseApp


class Launcher(BaseApp):
    """Accessor/check helpers for the OS launcher snapshot."""

    @property
    def launcher(self) -> dict[str, Any]:
        value = self.get("launcher", {})
        return value if isinstance(value, dict) else {}

    @property
    def installed_apps(self) -> list[dict[str, Any]]:
        return self.get_list("installedApps")

    def app_label(self, app_id: str) -> str:
        for app in self.installed_apps:
            if str(app.get("id") or "") == app_id:
                return str(app.get("name") or app_id)
        return app_id

    def resolve_app_id(self, value: str) -> str:
        raw = str(value or "").strip()
        if not raw:
            return raw
        known_ids = set(self.visible_app_ids())
        known_ids.update(str(app.get("id") or "") for app in self.installed_apps)
        if raw in known_ids:
            return raw
        for app in self.installed_apps:
            if str(app.get("name") or "").strip() == raw:
                return str(app.get("id") or raw)
        return raw

    def visible_app_ids(self) -> list[str]:
        ids: list[str] = []
        seen: set[str] = set()

        def add(app_id: Any) -> None:
            text = str(app_id or "")
            if text and text not in seen:
                seen.add(text)
                ids.append(text)

        launcher = self.launcher
        items_by_id = launcher.get("items") if isinstance(launcher.get("items"), dict) else {}

        screens = launcher.get("screens")
        if isinstance(screens, list):
            for screen in screens:
                if not isinstance(screen, dict):
                    continue
                summary_items = screen.get("items")
                if isinstance(summary_items, list):
                    for item in summary_items:
                        if isinstance(item, dict) and item.get("kind") == "app":
                            add(item.get("appId"))
                    continue
                for placement in screen.get("placements") or []:
                    if not isinstance(placement, dict):
                        continue
                    item = items_by_id.get(placement.get("itemId"))
                    if isinstance(item, dict) and item.get("kind") == "app":
                        add(item.get("appId"))

        hotseat = launcher.get("hotseat")
        if isinstance(hotseat, list):
            for entry in hotseat:
                if not isinstance(entry, dict):
                    continue
                if entry.get("kind") == "app":
                    add(entry.get("appId"))
                    continue
                item = items_by_id.get(entry.get("itemId"))
                if isinstance(item, dict) and item.get("kind") == "app":
                    add(item.get("appId"))

        for folder in self.folders:
            for app_id in folder.get("items") or []:
                add(app_id)
        return ids

    def standalone_app_ids(self) -> list[str]:
        ids: list[str] = []
        seen: set[str] = set()

        def add(app_id: Any) -> None:
            text = str(app_id or "")
            if text and text not in seen:
                seen.add(text)
                ids.append(text)

        launcher = self.launcher
        items_by_id = launcher.get("items") if isinstance(launcher.get("items"), dict) else {}

        for screen in launcher.get("screens") or []:
            if not isinstance(screen, dict):
                continue
            summary_items = screen.get("items")
            if isinstance(summary_items, list):
                for item in summary_items:
                    if isinstance(item, dict) and item.get("kind") == "app":
                        add(item.get("appId"))
                continue
            for placement in screen.get("placements") or []:
                if not isinstance(placement, dict):
                    continue
                item = items_by_id.get(placement.get("itemId"))
                if isinstance(item, dict) and item.get("kind") == "app":
                    add(item.get("appId"))

        for entry in launcher.get("hotseat") or []:
            if not isinstance(entry, dict):
                continue
            if entry.get("kind") == "app":
                add(entry.get("appId"))
                continue
            item = items_by_id.get(entry.get("itemId"))
            if isinstance(item, dict) and item.get("kind") == "app":
                add(item.get("appId"))
        return ids

    @property
    def folders(self) -> list[dict[str, Any]]:
        raw = self.launcher.get("folders")
        if isinstance(raw, dict):
            return [folder for folder in raw.values() if isinstance(folder, dict)]
        if isinstance(raw, list):
            return [folder for folder in raw if isinstance(folder, dict)]
        return []

    def wmr_widget_ids(self) -> list[str]:
        ids: list[str] = []
        seen: set[str] = set()

        def add(item: Any) -> None:
            if not isinstance(item, dict):
                return
            if item.get("kind") != "widget" or item.get("widgetType") != "wmr":
                return
            widget_id = str(item.get("widgetId") or "")
            if widget_id and widget_id not in seen:
                seen.add(widget_id)
                ids.append(widget_id)

        launcher = self.launcher
        items_by_id = launcher.get("items") if isinstance(launcher.get("items"), dict) else {}
        for item in items_by_id.values():
            add(item)

        for screen in launcher.get("screens") or []:
            if not isinstance(screen, dict):
                continue
            summary_items = screen.get("items")
            if isinstance(summary_items, list):
                for item in summary_items:
                    add(item)
                continue
            for placement in screen.get("placements") or []:
                if isinstance(placement, dict):
                    add(items_by_id.get(placement.get("itemId")))

        for entry in launcher.get("hotseat") or []:
            if not isinstance(entry, dict):
                continue
            if entry.get("kind") == "widget":
                add(entry)
            else:
                add(items_by_id.get(entry.get("itemId")))
        return ids

    def check_wmr_widget_added(
        self,
        widget_id: str,
        *,
        label: str | None = None,
        field: str = "wmr_widget_added",
    ) -> dict[str, Any]:
        """验证指定 WMR 小组件是本次操作新增的，而不是初始状态已有。"""
        current_ids = set(self.wmr_widget_ids())
        init_ids = set(self.init.wmr_widget_ids())
        passed = widget_id in current_ids and widget_id not in init_ids
        expected = f"{label or widget_id}小组件已添加"
        return {
            "field": field,
            "expected": expected,
            "actual": sorted(current_ids),
            "passed": passed,
        }

    def check_folder_exact_apps(
        self,
        folder_name: str,
        app_values: list[str],
        *,
        field: str = "launcher_folder",
    ) -> dict[str, Any]:
        """验证指定桌面文件夹正好包含目标 app，且目标 app 不再作为独立图标出现。"""
        target_ids = [self.resolve_app_id(value) for value in app_values]
        assert len(set(target_ids)) == len(target_ids), (
            f"Upstream bug: duplicate launcher app targets {target_ids}"
        )

        init_visible = set(self.init.visible_app_ids())
        missing = [app_id for app_id in target_ids if app_id not in init_visible]
        assert not missing, (
            "Upstream bug: launcher targets not visible in init: "
            + ", ".join(missing)
        )

        expected_ids = set(target_ids)
        expected_labels = [self.app_label(app_id) for app_id in target_ids]
        candidates = [
            folder for folder in self.folders
            if str(folder.get("name") or "").strip() == str(folder_name).strip()
        ]

        matching_folder = None
        for folder in candidates:
            items = folder.get("items")
            if isinstance(items, list) and set(str(item) for item in items) == expected_ids:
                matching_folder = folder
                break

        standalone_left = [
            app_id for app_id in self.standalone_app_ids()
            if app_id in expected_ids
        ]
        expected_standalone = set(self.init.standalone_app_ids()) - expected_ids
        actual_standalone = set(self.standalone_app_ids())
        missing_standalone = sorted(expected_standalone - actual_standalone)
        extra_standalone = sorted(actual_standalone - expected_standalone - expected_ids)
        unrelated_preserved = not missing_standalone and not extra_standalone
        passed = matching_folder is not None and not standalone_left and unrelated_preserved

        actual = [
            {
                "name": folder.get("name"),
                "items": [
                    self.app_label(str(app_id))
                    for app_id in (folder.get("items") or [])
                ],
                "size": folder.get("size"),
            }
            for folder in self.folders
        ]
        if standalone_left:
            actual.append({
                "standalone_left": [self.app_label(app_id) for app_id in standalone_left]
            })
        if not unrelated_preserved:
            actual.append({
                "standalone_expected_but_missing": [
                    self.app_label(app_id) for app_id in missing_standalone
                ],
                "standalone_unexpected": [
                    self.app_label(app_id) for app_id in extra_standalone
                ],
            })

        return {
            "field": field,
            "expected": {
                "folder_name": folder_name,
                "apps": expected_labels,
            },
            "actual": actual or "未找到桌面文件夹",
            "passed": passed,
        }
