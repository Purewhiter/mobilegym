"""
Notes app state accessor.
"""

from __future__ import annotations

import datetime
import re
from typing import Any

from bench_env.task.base import BaseApp
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.task.utils import extract_numbers, integer_labels, norm, subsequence_contains_numbers

NOTES_CREATE_TITLES = ["下周计划", "读书笔记", "备忘"]
NOTES_NEW_TODO_TEXTS = ["买菜", "交水电费", "预约体检", "回复邮件"]
NOTES_NEW_FOLDER_NAMES = ["工作", "学习", "生活", "旅行"]
NOTES_MOVE_FOLDER_NAMES = ["重要", "归档", "项目"]
NOTES_PRIVATE_CREATE_TITLES = ["密码备忘", "私人日记", "账号记录"]
NOTES_PRIVATE_CREATE_CONTENTS = ["这是私密内容", "仅自己可见"]
NOTES_REMINDER_CREATE_TITLES = ["明天开会", "周末聚餐", "还书"]
NOTES_REMINDER_CREATE_CONTENTS = ["记得带文件", "订餐厅", "去图书馆"]

NOTES_CREATE_CHANGES = ["notes.notes"]


def _is_trashed(note: dict[str, Any]) -> bool:
    value = note.get("trashedAt")
    return isinstance(value, (int, float)) and value > 0


def _is_private(note: dict[str, Any]) -> bool:
    return bool(note.get("isPrivate"))


_BANK_MARKER_PARENS_TAIL = re.compile(r"（\s*\d{3,6}\s*）")


def _note_content_matches_marker_group(content: str, marker: str) -> bool:
    """备忘录里银行名写法较随意：允许不写尾号、不写「中国」前缀等，仍视为提到该卡。"""
    m = str(marker).strip()
    c = str(content)
    if not m or not c:
        return False
    if m in c:
        return True
    core = _BANK_MARKER_PARENS_TAIL.sub("", m).strip()
    if core and core in c:
        return True
    if core.startswith("中国") and len(core) > 2:
        without_prefix = core[2:].strip()
        if without_prefix and without_prefix in c:
            return True
    return False


def _note_text(note: dict[str, Any]) -> str:
    title = str(note.get("title", "") or "").strip()
    content = str(note.get("content", "") or "").strip()
    return f"{title}\n{content}".strip()


def _pick_keywords_from_note(note: dict[str, Any]) -> list[str]:
    lines = [
        line.strip()
        for line in str(note.get("content", "") or "").splitlines()
        if line.strip()
    ]
    keywords = lines[:2]
    title = str(note.get("title", "") or "").strip()
    if len(keywords) < 2 and title:
        keywords.append(title[:2] if len(title) >= 2 else title)
    if len(keywords) < 2:
        keywords.append("便签")
    return keywords[:2]


class Notes(BaseApp):
    """
    Notes state accessor.

    Usage:
        notes = Notes(input.apps["notes"])
        notes.latest_note
        notes.check_latest_contains("天气", "北京")
    """

    @staticmethod
    def _sample_visible_note(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        notes = Notes(env_state["apps"]["notes"])
        candidates = notes.visible_notes
        if not candidates:
            raise ValueError("No visible note found in notes state")
        chosen = rng.choice(candidates)
        return {"note_title": str(chosen.get("title") or "")}

    @staticmethod
    def _sample_note_with_content_target(
        env_state: dict[str, Any], rng: Any
    ) -> dict[str, str]:
        notes = Notes(env_state["apps"]["notes"])
        candidates = [
            note
            for note in notes.visible_notes
            if str(note.get("content", "") or "").strip()
        ]
        if not candidates:
            raise ValueError("No visible note with content found")
        chosen = rng.choice(candidates)
        keyword1, keyword2 = _pick_keywords_from_note(chosen)
        return {
            "note_title": str(chosen.get("title") or ""),
            "keyword1": keyword1,
            "keyword2": keyword2,
        }

    @staticmethod
    def _sample_search_target(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        notes = Notes(env_state["apps"]["notes"])
        candidates = notes.visible_notes
        if not candidates:
            raise ValueError("No visible note found for search target")
        chosen = rng.choice(candidates)
        title = str(chosen.get("title") or "").strip()
        keyword = title[:2] if len(title) >= 2 else _pick_keywords_from_note(chosen)[0]
        return {"keyword": keyword, "note_title": title}

    @staticmethod
    def _sample_incomplete_todo(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        notes = Notes(env_state["apps"]["notes"])
        candidates = notes.incomplete_todos
        if not candidates:
            raise ValueError("No incomplete todo found in notes state")
        chosen = rng.choice(candidates)
        return {"todo_text": str(chosen.get("text") or "")}

    @staticmethod
    def reminder_time_labels(timestamp: int | float) -> list[str]:
        dt = datetime.datetime.fromtimestamp(float(timestamp) / 1000.0)
        month = dt.month
        day = dt.day
        hour = dt.hour
        minute = dt.minute
        hh = f"{hour:02d}"
        mm = f"{minute:02d}"
        return [
            f"{month}月{day}日 {hour}:{mm}",
            f"{month}月{day}日 {hh}:{mm}",
            f"{hour}:{mm}",
            f"{hh}:{mm}",
        ]

    @property
    def notes(self) -> list[dict[str, Any]]:
        return self.get_list("notes")

    @property
    def todos(self) -> list[dict[str, Any]]:
        return self.get_list("todos")

    @property
    def folders(self) -> list[dict[str, Any]]:
        return self.get_list("folders")

    @property
    def settings(self) -> dict[str, Any]:
        return self.get("settings", {})

    @property
    def visible_notes(self) -> list[dict[str, Any]]:
        return [
            note for note in self.notes if not _is_trashed(note) and not _is_private(note)
        ]

    @property
    def private_notes(self) -> list[dict[str, Any]]:
        return [
            note for note in self.notes if not _is_trashed(note) and _is_private(note)
        ]

    @property
    def trashed_notes(self) -> list[dict[str, Any]]:
        return [note for note in self.notes if _is_trashed(note)]

    @property
    def incomplete_todos(self) -> list[dict[str, Any]]:
        return [todo for todo in self.todos if not bool(todo.get("completed"))]

    @property
    def completed_todos(self) -> list[dict[str, Any]]:
        return [todo for todo in self.todos if bool(todo.get("completed"))]

    @property
    def latest_note(self) -> dict[str, Any] | None:
        if not self.notes:
            return None
        return max(self.notes, key=lambda note: int(note.get("updatedAt", 0) or 0))

    @property
    def latest_note_text(self) -> str:
        note = self.latest_note
        return _note_text(note) if note else ""

    @property
    def longest_note(self) -> dict[str, Any] | None:
        if not self.notes:
            return None
        return max(self.notes, key=lambda note: len(str(note.get("content", "") or "")))

    def latest_n_notes(self, n: int) -> list[dict[str, Any]]:
        if n <= 0:
            return []
        sorted_notes = sorted(
            self.notes, key=lambda note: int(note.get("updatedAt", 0) or 0), reverse=True
        )
        return sorted_notes[:n]

    def find_note_containing(self, text: str) -> dict[str, Any] | None:
        target = str(text or "").strip().lower()
        if not target:
            return None
        for note in self.notes:
            if target in _note_text(note).lower():
                return note
        return None

    def find_note_by_title(self, title: str) -> dict[str, Any] | None:
        target = str(title or "").strip()
        if not target:
            return None
        for note in self.notes:
            if str(note.get("title") or "").strip() == target:
                return note
        for note in self.notes:
            if target in str(note.get("title") or ""):
                return note
        return None

    def latest_note_by_title(self, title: str) -> dict[str, Any] | None:
        target = str(title or "").strip()
        if not target:
            return None
        matched = [
            note
            for note in self.notes
            if str((note or {}).get("title", "")).strip() == target
        ]
        if not matched:
            return None
        return max(matched, key=lambda note: int((note or {}).get("updatedAt", 0) or 0))

    def note_text_by_title(self, title: str) -> str:
        note = self.latest_note_by_title(title)
        return _note_text(note) if note else ""

    def find_note_with_keywords(self, keywords: list[str]) -> dict[str, Any] | None:
        if not keywords:
            return None
        lowered = [str(keyword or "").lower() for keyword in keywords if str(keyword or "").strip()]
        if not lowered:
            return None
        for note in self.notes:
            full = _note_text(note).lower()
            if all(keyword in full for keyword in lowered):
                return note
        return None

    def find_todo_by_text(self, text: str) -> dict[str, Any] | None:
        target = str(text or "").strip()
        if not target:
            return None
        for todo in self.todos:
            if str(todo.get("text") or "").strip() == target:
                return todo
        for todo in self.todos:
            if target in str(todo.get("text") or ""):
                return todo
        return None

    def find_folder_by_name(self, name: str) -> dict[str, Any] | None:
        target = str(name or "").strip()
        if not target:
            return None
        for folder in self.folders:
            if str(folder.get("name") or "").strip() == target:
                return folder
        for folder in self.folders:
            if target in str(folder.get("name") or ""):
                return folder
        return None

    # ---- 对比层（需要 init）----

    def new_todos(self) -> list[dict[str, Any]]:
        """init 后新增的 todo（按 ID 差集）"""
        init_ids = {str(t.get("id") or "") for t in self.init.todos}
        return [t for t in self.todos if str(t.get("id") or "") not in init_ids]

    def find_new_todo_by_text(self, text: str) -> dict[str, Any] | None:
        """在新增的 todo 中按文本查找"""
        target = str(text or "").strip()
        if not target:
            return None
        for todo in self.new_todos():
            if str(todo.get("text") or "").strip() == target:
                return todo
        return None

    def removed_todo_ids(self) -> set[str]:
        """init 中存在但 current 中已不存在的 todo id 集合（按 ID 差集，避免文本清空造成的误判）"""
        init_ids = {str(t.get("id") or "") for t in self.init.todos}
        curr_ids = {str(t.get("id") or "") for t in self.todos}
        return init_ids - curr_ids

    def check_todo_deleted(
        self, text: str, *, field: str = "todos.todo_deleted"
    ) -> dict[str, Any]:
        """检查 init 中文本为 text 的 todo 是否已按 ID 从 current 中消失"""
        init_todo = self.init.find_todo_by_text(text)
        init_id = str((init_todo or {}).get("id") or "")
        removed = bool(init_id) and init_id in self.removed_todo_ids()
        return {
            "field": field,
            "expected": text,
            "actual": None if removed else text,
            "passed": removed,
        }

    def check_other_init_todos_preserved(
        self,
        *,
        exclude_text: str | None = None,
        field: str = "todos.other_todos_preserved",
    ) -> dict[str, Any]:
        """检查 init 中除 exclude_text 之外的 todo 全部仍在 current（防止误删其他项）"""
        exclude_id = ""
        if exclude_text:
            init_target = self.init.find_todo_by_text(exclude_text)
            if init_target is not None:
                exclude_id = str(init_target.get("id") or "")
        curr_ids = {str(t.get("id") or "") for t in self.todos}
        missing_texts = [
            str(t.get("text") or "")
            for t in self.init.todos
            if str(t.get("id") or "") != exclude_id
            and str(t.get("id") or "") not in curr_ids
        ]
        return {
            "field": field,
            "expected": [],
            "actual": missing_texts,
            "passed": not missing_texts,
        }

    def check_all_completed_todos_deleted(
        self, *, field: str = "todos.completed_all_deleted"
    ) -> dict[str, Any]:
        """检查 init 中所有 completed todo 均已按 ID 从 current 中消失（defaults 保证至少有 1 条）"""
        init_completed_ids = {str(t.get("id") or "") for t in self.init.completed_todos}
        curr_ids = {str(t.get("id") or "") for t in self.todos}
        remaining = len(init_completed_ids & curr_ids)
        return {
            "field": field,
            "expected": 0,
            "actual": remaining,
            "passed": bool(init_completed_ids) and remaining == 0,
        }

    def check_incomplete_todos_preserved(
        self, *, field: str = "todos.incomplete_preserved"
    ) -> dict[str, Any]:
        """检查 init 中所有 incomplete todo 仍在 current（防止误删未完成项）"""
        curr_ids = {str(t.get("id") or "") for t in self.todos}
        missing_texts = [
            str(t.get("text") or "")
            for t in self.init.incomplete_todos
            if str(t.get("id") or "") not in curr_ids
        ]
        return {
            "field": field,
            "expected": [],
            "actual": missing_texts,
            "passed": not missing_texts,
        }

    def check_note_with_title_contains(
        self, title: str, *keywords: str, field: str | None = None
    ) -> dict[str, Any]:
        if field is None:
            field = f"note_{title}"
        note = self.find_note_by_title(title)
        init_note = self.init.find_note_by_title(title) if self.has_init else None
        content = _note_text(note) if note else ""
        init_content = _note_text(init_note) if init_note else ""
        missing = [keyword for keyword in keywords if keyword not in content]
        changed = note is not None and content != init_content
        return {
            "field": field,
            "expected": {"title": title, "contains": list(keywords)},
            "actual": {
                "title": note.get("title") if note else None,
                "content": content[:200] if content else "",
                "changed": changed,
                "missing": missing,
            },
            "passed": note is not None and changed and not missing,
        }

    def new_notes(self) -> list[dict[str, Any]]:
        """init 后新增的笔记（按 ID 差集）。"""
        init_ids = {str(note.get("id") or "") for note in self.init.notes}
        return [
            note for note in self.notes
            if str(note.get("id") or "") not in init_ids
        ]

    def check_no_new_notes(
        self, *, field: str = "no_new_notes"
    ) -> dict[str, Any]:
        """确认本次任务没有新增任何笔记。"""
        new = self.new_notes()
        preview = [
            {
                "id": note.get("id"),
                "title": str(note.get("title") or ""),
            }
            for note in new[:5]
        ]
        return {
            "field": field,
            "expected": "不新增任何笔记",
            "actual": {"addedCount": len(new), "addedPreview": preview},
            "passed": len(new) == 0,
        }

    def check_note_title_exists(
        self, title: str, *, field: str = "notes.note.title"
    ) -> dict[str, Any]:
        note = self.latest_note_by_title(title)
        return {
            "field": field,
            "expected": str(title),
            "actual": note.get("title") if note else None,
            "passed": note is not None,
        }

    def check_latest_contains(
        self, *keywords: str, field: str = "latest_note"
    ) -> dict[str, Any]:
        """检查最新笔记是否包含所有关键词。"""
        note = self.latest_note
        if not note:
            return {
                "field": field,
                "expected": f"contains {list(keywords)}",
                "actual": "no notes",
                "passed": False,
            }
        content = _note_text(note)
        missing = [keyword for keyword in keywords if keyword not in content]
        return {
            "field": field,
            "expected": f"contains {list(keywords)}",
            "actual": content[:120] + (f" (missing: {missing})" if missing else ""),
            "passed": not missing,
        }

    def check_latest_contains_meeting_id_and_password(
        self,
        meeting_id: str,
        password: str,
        *,
        field: str = "latest_note_meeting",
    ) -> dict[str, Any]:
        """检查最新笔记包含会议号（忽略数字间空格）和密码。"""
        note = self.latest_note
        content = _note_text(note) if note else ""
        mid = re.sub(r"\s+", "", str(meeting_id))
        if not mid:
            passed = False
        else:
            passed = (
                bool(content)
                and bool(TencentMeeting.meeting_id_pattern(mid).search(content))
                and str(password) in content
            )
        return {
            "field": field,
            "expected": f"会议号 {mid} + 密码 {password}",
            "actual": content[:200] or "(none)",
            "passed": passed,
        }

    def check_latest_contains_any_of(
        self,
        keywords: list[str] | tuple[str, ...],
        *,
        field: str = "latest_note_any_of",
    ) -> dict[str, Any]:
        note = self.latest_note
        if not note:
            return {
                "field": field,
                "expected": {"any_of": list(keywords)},
                "actual": "no notes",
                "passed": False,
            }
        content = _note_text(note)
        matched = next((keyword for keyword in keywords if keyword and keyword in content), None)
        return {
            "field": field,
            "expected": {"any_of": list(keywords)},
            "actual": content[:120],
            "passed": matched is not None,
        }

    def check_latest_norm_contains(
        self,
        *keywords: str,
        field: str = "latest_note_norm",
    ) -> dict[str, Any]:
        """按 norm 且去空格后检查最新笔记，兼容中文标题里的空格/符号差异。"""
        note = self.latest_note
        if not note:
            return {
                "field": field,
                "expected": f"norm contains {list(keywords)}",
                "actual": "no notes",
                "passed": False,
            }
        content = norm(_note_text(note)).replace(" ", "")
        missing = [
            keyword
            for keyword in keywords
            if norm(keyword).replace(" ", "") not in content
        ]
        return {
            "field": field,
            "expected": f"norm contains {list(keywords)}",
            "actual": content[:120] + (f" (missing: {missing})" if missing else ""),
            "passed": not missing,
        }

    def check_latest_contains_number(
        self,
        expected: float,
        *,
        tolerance: float = 0.01,
        field: str = "latest_note_number",
    ) -> dict[str, Any]:
        content = self.latest_note_text
        if not content:
            return {
                "field": field,
                "expected": expected,
                "actual": "no notes",
                "passed": False,
            }
        numbers = extract_numbers(content)
        exp = float(expected)
        passed = any(
            abs(num - exp) <= tolerance or abs(abs(num) - abs(exp)) <= tolerance
            for num in numbers
        )
        return {
            "field": field,
            "expected": {"number": expected, "tolerance": tolerance},
            "actual": numbers[:20],
            "passed": passed,
        }

    def check_latest_contains_all_numbers(
        self,
        expected_numbers: list[float],
        *,
        tolerance: float = 0.01,
        field: str = "latest_note_numbers",
    ) -> dict[str, Any]:
        content = self.latest_note_text
        if not content:
            return {
                "field": field,
                "expected": expected_numbers,
                "actual": "no notes",
                "passed": False,
            }
        numbers = extract_numbers(content)
        missing = [
            exp
            for exp in expected_numbers
            if not any(
                abs(num - float(exp)) <= tolerance
                or abs(abs(num) - abs(float(exp))) <= tolerance
                for num in numbers
            )
        ]
        return {
            "field": field,
            "expected": {"numbers": expected_numbers, "tolerance": tolerance},
            "actual": {"numbers": numbers[:20], "missing": missing},
            "passed": not missing,
        }

    def check_latest_contains_number_lines(
        self,
        expected_numbers: list[float],
        *,
        tolerance: float = 0.01,
        field: str = "latest_note_number_lines",
    ) -> dict[str, Any]:
        """检查最新笔记的正文按分行顺序包含指定数字。"""
        note = self.latest_note
        content = str((note or {}).get("content") or "")
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        matched: list[dict[str, Any]] = []
        line_idx = 0
        for expected in expected_numbers:
            found = None
            while line_idx < len(lines):
                line = lines[line_idx]
                numbers = extract_numbers(lines[line_idx])
                number_ok = any(abs(num - float(expected)) <= tolerance for num in numbers)
                if float(expected).is_integer():
                    number_ok = number_ok or any(
                        label in line for label in integer_labels(int(expected))
                    )
                if number_ok:
                    found = {"line": line, "number": float(expected)}
                    line_idx += 1
                    break
                line_idx += 1
            if found is None:
                break
            matched.append(found)
        return {
            "field": field,
            "expected": {"line_numbers": expected_numbers, "tolerance": tolerance},
            "actual": {"lines": lines[:20], "matched": matched},
            "passed": len(matched) == len(expected_numbers),
        }

    def check_note_with_title_has_lines(
        self, title: str, expected_lines: list[str], *, field: str | None = None
    ) -> dict[str, Any]:
        if field is None:
            field = f"note_{title}_lines"
        note = self.latest_note_by_title(title)
        actual_lines = (
            [line.strip() for line in str(note.get("content") or "").splitlines() if line.strip()]
            if note
            else []
        )
        missing = [
            expected
            for expected in expected_lines
            if not any(expected in line for line in actual_lines)
        ]
        return {
            "field": field,
            "expected": {"title": title, "lines": expected_lines},
            "actual": {"title": note.get("title") if note else None, "lines": actual_lines[:20]},
            "passed": note is not None and not missing,
        }

    def check_note_with_title_has_number_sequence(
        self,
        title: str,
        expected_numbers: list[float],
        *,
        tolerance: float = 0.02,
        field: str = "notes.sequence",
    ) -> dict[str, Any]:
        content = self.note_text_by_title(title)
        numbers = extract_numbers(content)
        return {
            "field": field,
            "expected": expected_numbers,
            "actual": numbers[:30],
            "passed": bool(content)
            and subsequence_contains_numbers(numbers, expected_numbers, tol=tolerance),
        }

    def check_note_with_title_mentions_groups(
        self,
        title: str,
        marker_groups: list[list[str]],
        *,
        field: str = "notes.markers",
    ) -> dict[str, Any]:
        content = self.note_text_by_title(title)
        missing_groups = [
            group
            for group in marker_groups
            if not any(
                str(marker).strip() and _note_content_matches_marker_group(content, str(marker))
                for marker in group
            )
        ]
        return {
            "field": field,
            "expected": {"title": title, "marker_groups": marker_groups},
            "actual": content[:200] or "(none)",
            "passed": bool(content) and not missing_groups,
        }
