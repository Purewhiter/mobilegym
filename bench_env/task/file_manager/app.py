"""
FileManager / FileSystem state accessors.
"""

from __future__ import annotations

import posixpath
from typing import Any

from bench_env.task.base import BaseApp


def _sort_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        nodes,
        key=lambda node: (
            0 if node["type"] == "directory" else 1,
            str(node["name"]),
            str(node["path"]),
        ),
    )


class FileSystem:
    """OS-level file system state accessor."""

    def __init__(self, fs_state: dict[str, Any], init: dict[str, Any] | None = None):
        self._nodes: list[dict[str, Any]] = list(fs_state["nodes"])
        self._by_path: dict[str, dict[str, Any]] = {
            str(node["path"]): node for node in self._nodes
        }
        self._children_by_parent_id: dict[str | None, list[dict[str, Any]]] = {}
        for node in self._nodes:
            self._children_by_parent_id.setdefault(node["parentId"], []).append(node)

        self._init_nodes: list[dict[str, Any]] | None = None
        self._init_by_path: dict[str, dict[str, Any]] | None = None
        if init is not None:
            self._init_nodes = list(init["nodes"])
            self._init_by_path = {
                str(node["path"]): node for node in self._init_nodes
            }

    @property
    def nodes(self) -> list[dict[str, Any]]:
        return self._nodes

    @property
    def init_nodes(self) -> list[dict[str, Any]]:
        if self._init_nodes is None:
            raise ValueError("No init file system state provided")
        return self._init_nodes

    @property
    def has_init(self) -> bool:
        return self._init_nodes is not None

    def find_by_path(self, path: str) -> dict[str, Any] | None:
        return self._by_path.get(path)

    def exists(self, path: str) -> bool:
        return path in self._by_path

    def list_dir(self, dir_path: str) -> list[dict[str, Any]]:
        directory = self.find_by_path(dir_path)
        if not directory or directory["type"] != "directory":
            return []
        return _sort_nodes(
            list(self._children_by_parent_id.get(directory["id"], []))
        )

    def files_in_dir(self, dir_path: str) -> list[dict[str, Any]]:
        return [node for node in self.list_dir(dir_path) if node["type"] == "file"]

    def find_by_name(self, name: str) -> list[dict[str, Any]]:
        return _sort_nodes(
            [node for node in self._nodes if str(node["name"]) == name]
        )

    def find_by_mime(self, mime_prefix: str) -> list[dict[str, Any]]:
        return _sort_nodes(
            [
                node
                for node in self._nodes
                if node["type"] == "file"
                and str(node.get("mimeType") or "").startswith(mime_prefix)
            ]
        )

    def check_path_exists(self, path: str, *, field: str) -> dict[str, Any]:
        node = self.find_by_path(path)
        return {
            "field": field,
            "expected": {"exists": True, "path": path},
            "actual": node,
            "passed": node is not None,
        }

    def check_path_not_exists(self, path: str, *, field: str) -> dict[str, Any]:
        node = self.find_by_path(path)
        return {
            "field": field,
            "expected": {"exists": False, "path": path},
            "actual": node,
            "passed": node is None,
        }

    def check_directory_created(
        self,
        path: str,
        *,
        field: str = "file_system.directory_created",
    ) -> dict[str, Any]:
        """验证目录是本次操作新增的，而不是初始状态已有。"""
        init_node = self._init_by_path.get(path)
        curr_node = self.find_by_path(path)
        passed = (
            init_node is None
            and curr_node is not None
            and curr_node.get("type") == "directory"
        )
        return {
            "field": field,
            "expected": {"created_directory": path},
            "actual": curr_node,
            "passed": passed,
        }

    def check_paths_deleted(
        self,
        paths: list[str],
        *,
        field: str = "file_system.paths_deleted",
    ) -> dict[str, Any]:
        """检查 init 中指定路径均已从 current 中消失。"""
        assert self._init_by_path is not None, "check_paths_deleted requires init state"
        missing_from_init = [
            path for path in paths if self._init_by_path.get(path) is None
        ]
        assert not missing_from_init, (
            "Upstream bug: delete targets not in init: "
            + ", ".join(missing_from_init)
        )

        remaining = [path for path in paths if self.find_by_path(path) is not None]
        return {
            "field": field,
            "expected": {"deleted": paths},
            "actual": {"remaining": remaining},
            "passed": not remaining,
        }

    def check_paths_preserved(
        self,
        paths: list[str],
        *,
        field: str = "file_system.paths_preserved",
    ) -> dict[str, Any]:
        """检查 init 中指定路径仍在 current 中，防止误删/误移动。"""
        assert self._init_by_path is not None, "check_paths_preserved requires init state"
        missing_from_init = [
            path for path in paths if self._init_by_path.get(path) is None
        ]
        assert not missing_from_init, (
            "Upstream bug: preserve targets not in init: "
            + ", ".join(missing_from_init)
        )

        missing = [path for path in paths if self.find_by_path(path) is None]
        return {
            "field": field,
            "expected": {"preserved": paths},
            "actual": {"missing": missing},
            "passed": not missing,
        }

    def check_files_renamed(
        self,
        rename_map: dict[str, str],
        *,
        field: str = "file_system.files_renamed",
    ) -> dict[str, Any]:
        """验证一组文件按路径改名；目标节点必须继承源文件 id。"""
        assert self._init_by_path is not None, "check_files_renamed requires init state"
        missing_from_init = [
            src for src in rename_map if self._init_by_path.get(src) is None
        ]
        assert not missing_from_init, (
            "Upstream bug: rename sources not in init: "
            + ", ".join(missing_from_init)
        )

        failures: list[dict[str, Any]] = []
        for src, dst in rename_map.items():
            init_node = self._init_by_path[src]
            curr_src = self.find_by_path(src)
            curr_dst = self.find_by_path(dst)
            ok = (
                curr_src is None
                and curr_dst is not None
                and str(curr_dst.get("id") or "") == str(init_node.get("id") or "")
            )
            if not ok:
                failures.append(
                    {
                        "from": src,
                        "to": dst,
                        "srcStillExists": curr_src is not None,
                        "dst": curr_dst,
                    }
                )

        return {
            "field": field,
            "expected": rename_map,
            "actual": failures,
            "passed": not failures,
        }

    def check_file_moved(self, src: str, dst: str, *, field: str) -> dict[str, Any]:
        src_init = self._init_by_path.get(src)
        src_curr = self.find_by_path(src)
        dst_curr = self.find_by_path(dst)
        return {
            "field": field,
            "expected": {"moved_from": src, "moved_to": dst},
            "actual": {
                "src_init": src_init,
                "src_curr": src_curr,
                "dst_curr": dst_curr,
            },
            "passed": (
                src_init is not None
                and src_curr is None
                and dst_curr is not None
            ),
        }

    def check_files_moved(
        self,
        move_map: dict[str, str],
        *,
        field: str = "file_system.files_moved",
    ) -> dict[str, Any]:
        """验证一组文件被移动到新路径；目标节点必须继承源文件 id。"""
        assert self._init_by_path is not None, "check_files_moved requires init state"
        missing_from_init = [
            src for src in move_map if self._init_by_path.get(src) is None
        ]
        assert not missing_from_init, (
            "Upstream bug: move sources not in init: "
            + ", ".join(missing_from_init)
        )

        failures: list[dict[str, Any]] = []
        for src, dst in move_map.items():
            init_node = self._init_by_path[src]
            curr_src = self.find_by_path(src)
            curr_dst = self.find_by_path(dst)
            ok = (
                curr_src is None
                and curr_dst is not None
                and str(curr_dst.get("id") or "") == str(init_node.get("id") or "")
            )
            if not ok:
                failures.append(
                    {
                        "from": src,
                        "to": dst,
                        "srcStillExists": curr_src is not None,
                        "dst": curr_dst,
                    }
                )

        return {
            "field": field,
            "expected": move_map,
            "actual": failures,
            "passed": not failures,
        }

    def check_directory_file_names_exact(
        self,
        dir_path: str,
        expected_names: list[str],
        *,
        field: str = "file_system.directory_files",
    ) -> dict[str, Any]:
        """验证目录内文件名集合与期望完全一致。"""
        actual_names = [str(node["name"]) for node in self.files_in_dir(dir_path)]
        return {
            "field": field,
            "expected": sorted(expected_names),
            "actual": sorted(actual_names),
            "passed": sorted(actual_names) == sorted(expected_names),
        }

    def check_file_renamed(
        self,
        old_name: str,
        new_name: str,
        dir_path: str,
        *,
        field: str,
    ) -> dict[str, Any]:
        old_path = posixpath.join(dir_path, old_name)
        new_path = posixpath.join(dir_path, new_name)
        return self.check_file_moved(old_path, new_path, field=field)


class FileManager(BaseApp):
    """FileManager app state accessor (clipboard only)."""

    @property
    def clipboard_items(self) -> list[dict[str, Any]]:
        return self.get_list("clipboardItems")

    @property
    def clipboard_operation(self) -> str | None:
        value = self.get("clipboardOperation")
        return str(value) if value is not None else None
