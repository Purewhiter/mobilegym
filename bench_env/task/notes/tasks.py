"""
Notes app task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 24 tasks | L1×3  L2×6  L3×10  L4×5
#
# [L1] SwitchToTodoTab          打开笔记的待办页面
# [L1] ToggleWordCount          {toggle}笔记的字数统计显示
# [L1] ReadNotesCount           看看笔记里有几条便签
# [L2] ChangeViewMode           把笔记的视图模式改成{mode}
# [L2] CreateNewNote            在笔记里新建一条便签，标题写「{title}」
# [L2] AddNewTodo               在笔记的待办里添加一条「{text}」
# [L2] PinNote                  把笔记里标题为「{note_title}」的便签置顶
# [L2] ReadNoteContent          看看笔记里标题为「{note_title}」的便签写了什么内容
# [L2] ReadTodoText             看看笔记里的待办事项有哪些
# [L3] DeleteNoteToTrash        把笔记里「{note_title}」这条便签删掉
# [L3] SetNotePrivate           把「{note_title}」这条便签设为私密
# [L3] CreateNewFolder          在笔记里新建一个名叫「{folder_name}」的文件夹
# [L3] SetNoteReminder          给笔记里「{note_title}」这条便签设个提醒
# [L3] CompleteTodo             把笔记待办里的「{todo_text}」标记为已完成
# [L3] DeleteTodo               把笔记待办里的「{todo_text}」删掉
# [L3] DeleteAllCompletedTodos  把笔记待办里已完成的事项全部删掉
# [L3] RestoreFromTrash         把笔记回收站里的「{note_title}」恢复回来
# [L3] SearchNoteTitle          在笔记里搜索「{keyword}」，告诉我搜到的便签标题
# [L3] CountTodosCompleted      看看笔记待办里有几条已完成的事项
# [L4] CreateFolderAndMoveNote  在笔记里新建一个「{folder_name}」文件夹，然后把「{note_title}」移到这个文件夹里
# [L4] CreateNoteAndSetPrivate  在笔记里新建一条标题为「{title}」的便签，写上「{content}」，然后设为私密
# [L4] CreateNoteWithReminder   在笔记里新建一条标题为「{title}」的便签，写上「{content}」，设一个提醒，然后告诉我提醒时间
# [L4] PrivateNotesWorkflow     把笔记里「{note_title}」设为私密，然后告诉我现在私密便签里总共有几条
# [L4] TodoBatchWorkflow        在笔记待办里加一条「{new_todo}」，然后把「{existing_todo}」标为已完成，最后告诉我还有几条没完成的待办
# -- End Task Index --

from __future__ import annotations

import copy
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import (
    AnswerTask,
    CriteriaTask,
    build_answer_checks,
    match_time,
)
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import (
    NOTES_CREATE_TITLES,
    NOTES_MOVE_FOLDER_NAMES,
    NOTES_NEW_FOLDER_NAMES,
    NOTES_NEW_TODO_TEXTS,
    NOTES_PRIVATE_CREATE_CONTENTS,
    NOTES_PRIVATE_CREATE_TITLES,
    NOTES_REMINDER_CREATE_CONTENTS,
    NOTES_REMINDER_CREATE_TITLES,
    Notes,
)

NOTES_ONLY_CHANGES = ["notes"]
TODOS_ONLY_CHANGES = ["todos"]
FOLDER_ONLY_CHANGES = ["folders", "selectedFolderId"]
FOLDER_AND_NOTES_CHANGES = ["folders", "selectedFolderId", "notes"]


# =============================================================================
# L1 — Atomic operations & simple queries
# =============================================================================


class SwitchToTodoTab(CriteriaTask):
    templates = [
        "打开笔记的待办页面",
        "Open the to-do page in Notes",
    ]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["nav"]
    criteria = {"route": "/todo"}


class ToggleWordCount(CriteriaTask):
    templates = ["{toggle}笔记的字数统计显示"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["settings"]
    parameters = {
        "toggle": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": False,
            "description": "目标开关状态",
        },
    }
    criteria = {"settings.showWordCount": "{toggle}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ReadNotesCount(AnswerTask):
    templates = ["看看笔记里有几条便签"]
    apps = ["notes"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["query"]
    answer_fields = [{"type": "number", "label": "便签数量"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return len(Notes(input.apps_init["notes"]).visible_notes)


# =============================================================================
# L2 — Multi-step operations & simple queries
# =============================================================================


class ChangeViewMode(CriteriaTask):
    templates = ["把笔记的视图模式改成{mode}"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["settings", "nav"]
    parameters = {
        "mode": {
            "type": "enum",
            "values": {"列表": "list", "宫格": "grid"},
            "default": "list",
            "description": "目标视图模式",
        },
    }
    criteria = {"settings.notesViewMode": "{mode}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class CreateNewNote(BaseTask):
    templates = ["在笔记里新建一条便签，标题写「{title}」"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["create"]
    parameters = {
        "title": {
            "type": "enum",
            "values": NOTES_CREATE_TITLES,
            "default": "下周计划",
            "description": "新建便签标题",
        },
    }
    expected_changes = NOTES_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        note = notes.find_note_by_title(self.p.title)
        return [
            {
                "field": "notes.note_created",
                "expected": self.p.title,
                "actual": note.get("title") if note else None,
                "passed": note is not None,
            }
        ]


class AddNewTodo(BaseTask):
    templates = ["在笔记的待办里添加一条「{text}」"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["create"]
    parameters = {
        "text": {
            "type": "enum",
            "values": NOTES_NEW_TODO_TEXTS,
            "default": "买菜",
            "description": "新增待办内容",
        },
    }
    expected_changes = TODOS_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        todo = notes.find_todo_by_text(self.p.text)
        return [
            {
                "field": "todos.todo_created",
                "expected": self.p.text,
                "actual": todo.get("text") if todo else None,
                "passed": todo is not None,
            }
        ]


class PinNote(BaseTask):
    templates = ["把笔记里标题为「{note_title}」的便签置顶"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["manage"]
    parameters = {
        "note_title": {
            "type": "string",
            "default": "购物清单",
            "description": "目标便签标题",
        },
        "_note": {
            "sampler": Notes._sample_visible_note,
            "fields": {"note_title": "note_title"},
        },
    }
    expected_changes = NOTES_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        note = notes.find_note_by_title(self.p.note_title)
        actual = bool((note or {}).get("pinned"))
        return [
            {
                "field": "notes.note_pinned",
                "expected": True,
                "actual": actual,
                "passed": note is not None and actual,
            }
        ]


class ReadNoteContent(AnswerTask):
    templates = [
        "看看笔记里标题为「{note_title}」的便签写了什么内容",
        "帮我查一下「{note_title}」这条便签里面的内容",
    ]
    apps = ["notes"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["query"]
    parameters = {
        "note_title": {
            "type": "string",
            "default": "购物清单",
            "description": "目标便签标题",
        },
        "keyword1": {
            "type": "string",
            "default": "牛奶",
            "description": "内容关键词1（内容第一行）",
        },
        "keyword2": {
            "type": "string",
            "default": "鸡蛋",
            "description": "内容关键词2（内容第二行）",
        },
        "_note_target": {
            "sampler": Notes._sample_note_with_content_target,
            "fields": {
                "note_title": "note_title",
                "keyword1": "keyword1",
                "keyword2": "keyword2",
            },
        },
    }

    answer_fields=[{"type": "text", "label": "便签内容", "hint": "请输入内容全文"}]

    def get_answer(self, input: JudgeInput) -> str:
        notes_state = input.apps_init["notes"]
        for note in notes_state.get("notes") or []:
            if str(note.get("title") or "") == str(self.p.note_title):
                return str(note.get("content") or "")
        return ""

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        answer_text = str(input.answer or "")
        return [
            {
                "field": "answer.keyword1",
                "expected": self.p.keyword1,
                "actual": answer_text,
                "passed": self.p.keyword1 in answer_text,
            },
            {
                "field": "answer.keyword2",
                "expected": self.p.keyword2,
                "actual": answer_text,
                "passed": self.p.keyword2 in answer_text,
            },
        ]


class ReadTodoText(AnswerTask):
    templates = ["看看笔记里的待办事项有哪些"]
    apps = ["notes"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["query", "nav"]
    answer_fields = [{"type": "text", "label": "待办事项", "hint": "如：开会", "repeatable": True, "compare": "set"}]

    def get_answer(self, input: JudgeInput) -> Any:
        notes = Notes(input.apps_init["notes"])
        return {
            f"todo_{index + 1}": str(todo.get("text") or "")
            for index, todo in enumerate(notes.incomplete_todos)
        }

    def get_expected_response(self, input: JudgeInput) -> list:
        notes = Notes(input.apps_init["notes"])
        return [[str(todo.get("text") or "") for todo in notes.incomplete_todos]]


# =============================================================================
# L3 — Multi-step operations & queries
# =============================================================================


class DeleteNoteToTrash(BaseTask):
    templates = ["把笔记里「{note_title}」这条便签删掉"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["manage"]
    parameters = {
        "note_title": {
            "type": "string",
            "default": "购物清单",
            "description": "目标便签标题",
        },
        "_note": {
            "sampler": Notes._sample_visible_note,
            "fields": {"note_title": "note_title"},
        },
    }
    expected_changes = NOTES_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        note = notes.find_note_by_title(self.p.note_title)
        trashed_at = (note or {}).get("trashedAt")
        passed = isinstance(trashed_at, (int, float)) and trashed_at > 0
        return [
            {
                "field": "notes.note_trashed",
                "expected": "trashedAt > 0",
                "actual": trashed_at,
                "passed": note is not None and passed,
            }
        ]


class SetNotePrivate(BaseTask):
    templates = ["把「{note_title}」这条便签设为私密"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["manage", "nav"]
    parameters = {
        "note_title": {
            "type": "string",
            "default": "购物清单",
            "description": "目标便签标题",
        },
        "_note": {
            "sampler": Notes._sample_visible_note,
            "fields": {"note_title": "note_title"},
        },
    }
    expected_changes = NOTES_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        note = notes.find_note_by_title(self.p.note_title)
        actual = bool((note or {}).get("isPrivate"))
        return [
            {
                "field": "notes.note_private",
                "expected": True,
                "actual": actual,
                "passed": note is not None and actual,
            }
        ]


class CreateNewFolder(BaseTask):
    templates = ["在笔记里新建一个名叫「{folder_name}」的文件夹"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["create", "nav"]
    parameters = {
        "folder_name": {
            "type": "enum",
            "values": NOTES_NEW_FOLDER_NAMES,
            "default": "工作",
            "description": "新建文件夹名称",
        },
    }
    expected_changes = FOLDER_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        folder = notes.find_folder_by_name(self.p.folder_name)
        return [
            {
                "field": "folders.folder_created",
                "expected": self.p.folder_name,
                "actual": folder.get("name") if folder else None,
                "passed": folder is not None,
            }
        ]


class SetNoteReminder(BaseTask):
    templates = ["给笔记里「{note_title}」这条便签设个提醒"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["manage"]
    parameters = {
        "note_title": {
            "type": "string",
            "default": "购物清单",
            "description": "目标便签标题",
        },
        "_note": {
            "sampler": Notes._sample_visible_note,
            "fields": {"note_title": "note_title"},
        },
    }
    expected_changes = NOTES_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        note = notes.find_note_by_title(self.p.note_title)
        alarm_at = (note or {}).get("alarmAt")
        passed = isinstance(alarm_at, (int, float)) and alarm_at > 0
        return [
            {
                "field": "notes.note_reminder",
                "expected": "alarmAt > 0",
                "actual": alarm_at,
                "passed": note is not None and passed,
            }
        ]


class CompleteTodo(BaseTask):
    templates = ["把笔记待办里的「{todo_text}」标记为已完成"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["manage", "nav"]
    parameters = {
        "todo_text": {
            "type": "string",
            "default": "明天去车站",
            "description": "目标待办文本",
        },
        "_todo": {
            "sampler": Notes._sample_incomplete_todo,
            "fields": {"todo_text": "todo_text"},
        },
    }
    expected_changes = TODOS_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        todo = notes.find_todo_by_text(self.p.todo_text)
        actual = bool((todo or {}).get("completed"))
        return [
            {
                "field": "todos.todo_completed",
                "expected": True,
                "actual": actual,
                "passed": todo is not None and actual,
            }
        ]


class DeleteTodo(BaseTask):
    templates = ["把笔记待办里的「{todo_text}」删掉"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["manage", "nav"]
    parameters = {
        "todo_text": {
            "type": "string",
            "default": "预约牙医",
            "description": "目标待办文本",
        },
        "_todo": {
            "sampler": Notes._sample_incomplete_todo,
            "fields": {"todo_text": "todo_text"},
        },
    }
    expected_changes = TODOS_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        return [
            notes.check_todo_deleted(self.p.todo_text),
            notes.check_other_init_todos_preserved(exclude_text=self.p.todo_text),
        ]


class DeleteAllCompletedTodos(BaseTask):
    templates = ["把笔记待办里已完成的事项全部删掉"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["manage", "nav"]
    expected_changes = TODOS_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        return [
            notes.check_all_completed_todos_deleted(),
            notes.check_incomplete_todos_preserved(),
        ]


class RestoreFromTrash(BaseTask):
    templates = ["把笔记回收站里的「{note_title}」恢复回来"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["manage", "nav"]
    parameters = {
        "note_title": {
            "type": "string",
            "default": "购物清单",
            "description": "回收站目标便签标题",
        },
        "_note": {
            "sampler": Notes._sample_visible_note,
            "fields": {"note_title": "note_title"},
        },
    }
    expected_changes = NOTES_ONLY_CHANGES

    async def _post_sample(self, env):
        state = await env.get_state()
        notes_state = copy.deepcopy((state.get("apps") or {}).get("notes") or {})
        notes_list = copy.deepcopy(notes_state.get("notes") or [])
        now = int((((state.get("os") or {}).get("time") or {}).get("timestamp") or 0) or 0)
        patched = False
        for note in notes_list:
            if str(note.get("title") or "").strip() != str(self.p.note_title):
                continue
            note["trashedAt"] = now or int(note.get("updatedAt", 0) or 1)
            note["updatedAt"] = now or int(note.get("updatedAt", 0) or 1)
            patched = True
            break
        if not patched:
            raise ValueError(f"RestoreFromTrash target note not found: {self.p.note_title}")
        await env.set_state(
            {"apps": {"notes": {"notes": notes_list}}},
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        note = notes.find_note_by_title(self.p.note_title)
        trashed_at = (note or {}).get("trashedAt")
        return [
            {
                "field": "notes.note_restored",
                "expected": None,
                "actual": trashed_at,
                "passed": note is not None and trashed_at is None,
            }
        ]


class SearchNoteTitle(AnswerTask):
    templates = [
        "在笔记里搜索「{keyword}」，告诉我搜到的便签标题",
        "帮我在笔记里搜一下「{keyword}」，看看有哪条便签",
    ]
    apps = ["notes"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "query"]
    parameters = {
        "keyword": {
            "type": "string",
            "default": "购物",
            "description": "搜索关键词",
        },
        "note_title": {
            "type": "string",
            "default": "购物清单",
            "description": "匹配到的便签标题",
        },
        "_search_target": {
            "sampler": Notes._sample_search_target,
            "fields": {"keyword": "keyword", "note_title": "note_title"},
        },
    }
    answer_fields = [{"type": "text", "label": "便签标题", "hint": "如：工作计划"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return self.p.note_title


class CountTodosCompleted(AnswerTask):
    templates = ["看看笔记待办里有几条已完成的事项"]
    apps = ["notes"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["query", "nav"]
    answer_fields = [{"type": "number", "label": "已完成事项数"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return len(Notes(input.apps_init["notes"]).completed_todos)


# =============================================================================
# L4 — Deep multi-step & hybrid tasks
# =============================================================================


class CreateFolderAndMoveNote(BaseTask):
    templates = ["在笔记里新建一个「{folder_name}」文件夹，然后把「{note_title}」移到这个文件夹里"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["create", "manage", "nav"]
    parameters = {
        "folder_name": {
            "type": "enum",
            "values": NOTES_MOVE_FOLDER_NAMES,
            "default": "重要",
            "description": "新建文件夹名称",
        },
        "note_title": {
            "type": "string",
            "default": "购物清单",
            "description": "目标便签标题",
        },
        "_note": {
            "sampler": Notes._sample_visible_note,
            "fields": {"note_title": "note_title"},
        },
    }
    expected_changes = FOLDER_AND_NOTES_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        folder = notes.find_folder_by_name(self.p.folder_name)
        note = notes.find_note_by_title(self.p.note_title)
        target_folder_id = str((folder or {}).get("id") or "")
        actual_folder_id = str((note or {}).get("folderId") or "")
        return [
            {
                "field": "folders.folder_created",
                "expected": self.p.folder_name,
                "actual": folder.get("name") if folder else None,
                "passed": folder is not None,
            },
            {
                "field": "notes.note_folder",
                "expected": target_folder_id,
                "actual": actual_folder_id,
                "passed": bool(folder and note and actual_folder_id == target_folder_id),
            },
        ]


class CreateNoteAndSetPrivate(BaseTask):
    templates = ["在笔记里新建一条标题为「{title}」的便签，写上「{content}」，然后设为私密"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["create", "manage"]
    parameters = {
        "title": {
            "type": "enum",
            "values": NOTES_PRIVATE_CREATE_TITLES,
            "default": "密码备忘",
            "description": "新建便签标题",
        },
        "content": {
            "type": "enum",
            "values": NOTES_PRIVATE_CREATE_CONTENTS,
            "default": "这是私密内容",
            "description": "新建便签内容",
        },
    }
    expected_changes = NOTES_ONLY_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        note = notes.latest_note_by_title(self.p.title)
        content = str((note or {}).get("content") or "")
        actual_private = bool((note or {}).get("isPrivate"))
        return [
            {
                "field": "notes.note_created",
                "expected": self.p.title,
                "actual": note.get("title") if note else None,
                "passed": note is not None,
            },
            {
                "field": "notes.note_content",
                "expected": self.p.content,
                "actual": content,
                "passed": note is not None and self.p.content in content,
            },
            {
                "field": "notes.note_private",
                "expected": True,
                "actual": actual_private,
                "passed": note is not None and actual_private,
            },
        ]


class CreateNoteWithReminder(BaseTask):
    templates = ["在笔记里新建一条标题为「{title}」的便签，写上「{content}」，设一个提醒，然后告诉我提醒时间"]
    apps = ["notes"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["create", "manage", "query"]
    parameters = {
        "title": {
            "type": "enum",
            "values": NOTES_REMINDER_CREATE_TITLES,
            "default": "明天开会",
            "description": "新建便签标题",
        },
        "content": {
            "type": "enum",
            "values": NOTES_REMINDER_CREATE_CONTENTS,
            "default": "记得带文件",
            "description": "新建便签内容",
        },
    }
    expected_changes = NOTES_ONLY_CHANGES
    answer_fields = [{"type": "text", "label": "提醒时间", "hint": "如：09:15"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        note = notes.latest_note_by_title(self.p.title)
        content = str((note or {}).get("content") or "")
        alarm_at = (note or {}).get("alarmAt")
        answer_text = str(input.answer or "")
        labels = (
            Notes.reminder_time_labels(int(alarm_at))
            if isinstance(alarm_at, (int, float)) and alarm_at > 0
            else []
        )
        expected_time = labels[-1] if labels else None
        return [
            {
                "field": "notes.note_created",
                "expected": self.p.title,
                "actual": note.get("title") if note else None,
                "passed": note is not None,
            },
            {
                "field": "notes.note_content",
                "expected": self.p.content,
                "actual": content,
                "passed": note is not None and self.p.content in content,
            },
            {
                "field": "notes.note_reminder",
                "expected": "alarmAt > 0",
                "actual": alarm_at,
                "passed": isinstance(alarm_at, (int, float)) and alarm_at > 0,
            },
            {
                "field": "answer.reminder_time",
                "expected": expected_time,
                "actual": input.answer,
                "passed": match_time(str(expected_time), answer_text) if expected_time is not None else False,
            },
        ]


class PrivateNotesWorkflow(BaseTask):
    templates = [
        "把笔记里「{note_title}」设为私密，然后告诉我现在私密便签里总共有几条",
        "把「{note_title}」这条便签设成私密的，看看私密区域一共有多少条便签",
    ]
    apps = ["notes"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["manage", "nav", "query"]
    parameters = {
        "note_title": {
            "type": "string",
            "default": "购物清单",
            "description": "目标便签标题",
        },
        "_note": {
            "sampler": Notes._sample_visible_note,
            "fields": {"note_title": "note_title"},
        },
    }
    expected_changes = NOTES_ONLY_CHANGES
    answer_fields = [{"type": "number", "label": "私密便签总数"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        note = notes.find_note_by_title(self.p.note_title)
        actual_private = bool((note or {}).get("isPrivate"))
        # sampler 保证 init 中该笔记非私密，期望私密数 = init 私密数 + 1
        expected_count = len(notes.init.private_notes) + 1
        answer_checks = build_answer_checks(expected_count, input.answer)
        return [
            {
                "field": "notes.note_private",
                "expected": True,
                "actual": actual_private,
                "passed": note is not None and actual_private,
            },
            *answer_checks,
        ]


class TodoBatchWorkflow(BaseTask):
    templates = ["在笔记待办里加一条「{new_todo}」，然后把「{existing_todo}」标为已完成，最后告诉我还有几条没完成的待办"]
    apps = ["notes"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["create", "manage", "query"]
    parameters = {
        "new_todo": {
            "type": "enum",
            "values": ["整理衣柜", "打扫房间", "洗车"],
            "default": "整理衣柜",
            "description": "新增待办内容",
        },
        "existing_todo": {
            "type": "string",
            "default": "明天去车站",
            "description": "原有未完成待办",
        },
        "_todo": {
            "sampler": Notes._sample_incomplete_todo,
            "fields": {"existing_todo": "todo_text"},
        },
    }
    expected_changes = TODOS_ONLY_CHANGES
    answer_fields = [{"type": "number", "label": "未完成待办数"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        new_todo = notes.find_new_todo_by_text(self.p.new_todo)
        existing_todo = notes.find_todo_by_text(self.p.existing_todo)
        # init incomplete count +1 (new_todo added) -1 (existing_todo completed) = unchanged
        expected_count = len(notes.init.incomplete_todos)
        answer_checks = build_answer_checks(expected_count, input.answer)
        return [
            {
                "field": "todos.todo_created",
                "expected": self.p.new_todo,
                "actual": new_todo.get("text") if new_todo else None,
                "passed": new_todo is not None,
            },
            {
                "field": "todos.todo_completed",
                "expected": True,
                "actual": bool((existing_todo or {}).get("completed")),
                "passed": existing_todo is not None and bool(existing_todo.get("completed")),
            },
            *answer_checks,
        ]
