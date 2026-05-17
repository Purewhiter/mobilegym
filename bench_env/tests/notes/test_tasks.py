"""
Notes task correctness tests.
"""

from __future__ import annotations

import copy
import datetime
import inspect
import json
import re
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.task.notes import tasks as _tasks_module
from bench_env.task.notes.app import Notes
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
DEFAULT_ROUTE = {"app": "notes", "path": "/"}


def _parse_timestamp(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    return int(datetime.datetime.fromisoformat(str(value)).timestamp() * 1000)


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "system" / "Notes" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _make_base_state() -> dict[str, Any]:
    defaults = _load_defaults()
    notes = [
        {**note, "updatedAt": _parse_timestamp(note["updatedAt"])}
        for note in defaults["sampleNotes"]
    ]
    todos = [
        {**todo, "updatedAt": _parse_timestamp(todo["updatedAt"])}
        for todo in defaults["sampleTodos"]
    ]
    return {
        "notes": notes,
        "todos": todos,
        "folders": [
            {"id": "all", "name": "全部", "system": True},
            {"id": "call", "name": "通话笔记", "system": True},
            {"id": "unfiled", "name": "未分类", "system": True},
        ],
        "selectedFolderId": "all",
        "settings": copy.deepcopy(defaults["settings"]),
    }


BASE_STATE = _make_base_state()


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
):
    return make_judge_input(
        {"apps": {"notes": init_state}, "os": TEST_OS_STATE},
        {"apps": {"notes": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _set_by_path(state: dict[str, Any], path: str, value: Any) -> None:
    current = state
    parts = path.split(".")
    for part in parts[:-1]:
        current = current[part]
    current[parts[-1]] = value


def _resolve_criteria_value(value: Any, params: dict[str, Any]) -> Any:
    if isinstance(value, str):
        match = re.fullmatch(r"\{(\w+)\}", value)
        if match:
            return params[match.group(1)]
    return value


def _natural_answer(expected: Any) -> str:
    if isinstance(expected, dict):
        return "，".join(str(value) for value in expected.values())
    if isinstance(expected, (int, float)):
        return f"答案是{expected:g}" if isinstance(expected, float) else f"答案是{expected}"
    if isinstance(expected, str):
        return f"答案是{expected}"
    return str(expected)


def _wrong_answer(expected: Any) -> str:
    if isinstance(expected, dict):
        return "答案是错误内容"
    if isinstance(expected, (int, float)):
        wrong = float(expected) + 1
        return f"答案是{wrong:g}"
    if isinstance(expected, str):
        return "答案是错误内容"
    return "错误答案"


def _require_note(state: dict[str, Any], title: str) -> dict[str, Any]:
    for note in state["notes"]:
        if str(note.get("title") or "").strip() == str(title).strip():
            return note
    raise ValueError(f"note not found: {title}")


def _require_todo(state: dict[str, Any], text: str) -> dict[str, Any]:
    for todo in state["todos"]:
        if str(todo.get("text") or "").strip() == str(text).strip():
            return todo
    raise ValueError(f"todo not found: {text}")


def _add_note(
    state: dict[str, Any],
    title: str,
    *,
    content: str = "",
    folder_id: str = "unfiled",
    pinned: bool = False,
    is_private: bool = False,
    trashed_at: int | None = None,
    alarm_at: int | None = None,
) -> dict[str, Any]:
    next_ts = max(int(note.get("updatedAt", 0) or 0) for note in state["notes"]) + 1000
    note = {
        "id": f"test_note_{len(state['notes']) + 1}",
        "title": title,
        "content": content,
        "updatedAt": next_ts,
        "folderId": folder_id,
    }
    if pinned:
        note["pinned"] = True
    if is_private:
        note["isPrivate"] = True
    if trashed_at is not None:
        note["trashedAt"] = trashed_at
    if alarm_at is not None:
        note["alarmAt"] = alarm_at
    state["notes"].insert(0, note)
    return note


def _add_folder(state: dict[str, Any], name: str) -> dict[str, Any]:
    folder = {
        "id": f"xf_test_{len(state['folders']) + 1}",
        "name": name,
        "system": False,
    }
    state["folders"].append(folder)
    state["selectedFolderId"] = folder["id"]
    return folder


def _add_todo(state: dict[str, Any], text: str, *, completed: bool = False) -> dict[str, Any]:
    next_ts = max(int(todo.get("updatedAt", 0) or 0) for todo in state["todos"]) + 1000
    todo = {
        "id": f"test_todo_{len(state['todos']) + 1}",
        "text": text,
        "completed": completed,
        "updatedAt": next_ts,
    }
    state["todos"].insert(0, todo)
    return todo


def _positive_answer_case(task: AnswerTask, *, curr_state: dict[str, Any] | None = None):
    curr = copy.deepcopy(curr_state) if curr_state is not None else copy.deepcopy(BASE_STATE)
    probe = _make_task_input(copy.deepcopy(BASE_STATE), curr)
    expected = task.get_answer(probe)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=_natural_answer(expected))


def _negative_answer_case(task: AnswerTask, *, curr_state: dict[str, Any] | None = None):
    curr = copy.deepcopy(curr_state) if curr_state is not None else copy.deepcopy(BASE_STATE)
    probe = _make_task_input(copy.deepcopy(BASE_STATE), curr)
    expected = task.get_answer(probe)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=_wrong_answer(expected))


def _positive_criteria_case(task: CriteriaTask):
    curr = copy.deepcopy(BASE_STATE)
    route = DEFAULT_ROUTE
    for path, raw_value in task.criteria.items():
        value = _resolve_criteria_value(raw_value, task.params)
        if path == "route":
            route = {"app": "notes", "path": str(value)}
            continue
        _set_by_path(curr, path, value)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)


def _negative_criteria_case(task: CriteriaTask):
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "notes" in task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": TEST_OS_STATE}
        desc = task.description
        assert desc
        assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_required_class_attrs(self, cls):
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid", "vague", "safety")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema, f"{cls.__name__}.parameters['{key}'] missing default"

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[cls.__name__ for cls in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer_or_get_answer(self, cls):
        has_answer_attr = cls.answer is not None
        has_get_answer_override = cls.get_answer is not AnswerTask.get_answer
        assert has_answer_attr or has_get_answer_override


class TestNotesAccessor:
    @pytest.fixture
    def notes_app(self) -> Notes:
        return Notes(copy.deepcopy(BASE_STATE))

    @pytest.fixture
    def notes_variant(self) -> Notes:
        state = copy.deepcopy(BASE_STATE)
        _require_note(state, "购物清单")["isPrivate"] = True
        target = _require_note(state, "客户来电记录")
        target["trashedAt"] = int(target["updatedAt"]) + 500
        _require_todo(state, "给妈妈打电话")["completed"] = True
        return Notes(state)

    def test_basic_collections(self, notes_app: Notes):
        assert len(notes_app.notes) == 5
        assert len(notes_app.todos) == 5
        assert len(notes_app.folders) == 3
        assert notes_app.settings["notesViewMode"] == "grid"
        assert notes_app.latest_note is not None
        assert notes_app.longest_note is not None

    def test_visible_private_trashed_views(self, notes_variant: Notes):
        assert len(notes_variant.visible_notes) == 3
        assert len(notes_variant.private_notes) == 1
        assert len(notes_variant.trashed_notes) == 1
        assert len(notes_variant.incomplete_todos) == 2
        assert len(notes_variant.completed_todos) == 3

    def test_note_lookup_helpers(self, notes_app: Notes):
        assert notes_app.find_note_by_title("购物清单") is not None
        assert notes_app.latest_note_by_title("购物清单") is not None
        assert notes_app.find_note_containing("灵隐寺")["title"] == "杭州旅行计划"
        assert notes_app.find_note_with_keywords(["西湖", "灵隐寺"])["title"] == "杭州旅行计划"

    def test_todo_and_folder_lookup_helpers(self, notes_app: Notes):
        assert notes_app.find_todo_by_text("给妈妈打电话") is not None
        assert notes_app.find_folder_by_name("未分类")["id"] == "unfiled"

    def test_check_latest_contains(self, notes_app: Notes):
        check = notes_app.check_latest_contains("牛奶", "鸡蛋", field="latest")
        assert check["field"] == "latest"
        assert check["passed"] is True

    def test_check_latest_contains_any_of(self, notes_app: Notes):
        check = notes_app.check_latest_contains_any_of(["不存在", "牛奶"], field="latest_any")
        assert check["field"] == "latest_any"
        assert check["passed"] is True

    def test_check_latest_norm_contains(self):
        state = copy.deepcopy(BASE_STATE)
        _add_note(state, "热门整理", content="杭州旅行| 阅读摘抄")
        notes_app = Notes(state)
        check = notes_app.check_latest_norm_contains("杭州旅行", "阅读摘抄", field="latest_norm")
        assert check["field"] == "latest_norm"
        assert check["passed"] is True

    def test_check_no_new_notes(self):
        unchanged = Notes(copy.deepcopy(BASE_STATE), init=copy.deepcopy(BASE_STATE))
        assert unchanged.check_no_new_notes()["passed"] is True

        current = copy.deepcopy(BASE_STATE)
        _add_note(current, "临时备忘", content="不应该新增")
        changed = Notes(current, init=copy.deepcopy(BASE_STATE))
        check = changed.check_no_new_notes(field="no_new_trip_note")
        assert check["field"] == "no_new_trip_note"
        assert check["passed"] is False

    def test_reminder_time_labels(self):
        labels = Notes.reminder_time_labels(1741597200000)
        assert len(labels) == 4
        assert any(":" in label for label in labels)
def _read_notes_count_positive():
    return _positive_answer_case(_tasks_module.ReadNotesCount())


def _read_notes_count_negative():
    return _negative_answer_case(_tasks_module.ReadNotesCount())


def _change_view_mode_positive():
    return _positive_criteria_case(_tasks_module.ChangeViewMode())


def _change_view_mode_negative():
    return _negative_criteria_case(_tasks_module.ChangeViewMode())


def _create_new_note_positive():
    task = _tasks_module.CreateNewNote()
    curr = copy.deepcopy(BASE_STATE)
    _add_note(curr, task.p.title)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _create_new_note_negative():
    task = _tasks_module.CreateNewNote()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _add_new_todo_positive():
    task = _tasks_module.AddNewTodo()
    curr = copy.deepcopy(BASE_STATE)
    _add_todo(curr, task.p.text)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _add_new_todo_negative():
    task = _tasks_module.AddNewTodo()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _pin_note_positive():
    task = _tasks_module.PinNote()
    curr = copy.deepcopy(BASE_STATE)
    _require_note(curr, task.p.note_title)["pinned"] = True
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _pin_note_negative():
    task = _tasks_module.PinNote()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _read_note_content_positive():
    return _positive_answer_case(_tasks_module.ReadNoteContent())


def _read_note_content_negative():
    return _negative_answer_case(_tasks_module.ReadNoteContent())


def _read_todo_text_positive():
    return _positive_answer_case(_tasks_module.ReadTodoText())


def _read_todo_text_negative():
    return _negative_answer_case(_tasks_module.ReadTodoText())
def _delete_todo_positive():
    task = _tasks_module.DeleteTodo()
    curr = copy.deepcopy(BASE_STATE)
    target = _require_todo(curr, task.p.todo_text)
    curr["todos"] = [t for t in curr["todos"] if t["id"] != target["id"]]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _delete_todo_negative():
    task = _tasks_module.DeleteTodo()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _delete_todo_negative_wrong_target():
    # 删错了目标：把另一条未完成 todo 删掉，目标 todo 仍在
    task = _tasks_module.DeleteTodo()
    curr = copy.deepcopy(BASE_STATE)
    other = next(
        t for t in curr["todos"]
        if not t.get("completed") and str(t.get("text")) != task.p.todo_text
    )
    curr["todos"] = [t for t in curr["todos"] if t["id"] != other["id"]]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _delete_todo_negative_text_cleared():
    # 把目标的 text 清空（错把"删除"理解成"清空文本"），条目依然在
    task = _tasks_module.DeleteTodo()
    curr = copy.deepcopy(BASE_STATE)
    _require_todo(curr, task.p.todo_text)["text"] = ""
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _delete_all_completed_todos_positive():
    task = _tasks_module.DeleteAllCompletedTodos()
    curr = copy.deepcopy(BASE_STATE)
    curr["todos"] = [t for t in curr["todos"] if not t.get("completed")]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _delete_all_completed_todos_negative():
    task = _tasks_module.DeleteAllCompletedTodos()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _delete_all_completed_todos_negative_partial():
    # 只删了部分 completed todo，另一条 completed 还在
    task = _tasks_module.DeleteAllCompletedTodos()
    curr = copy.deepcopy(BASE_STATE)
    first_completed = next(t for t in curr["todos"] if t.get("completed"))
    curr["todos"] = [t for t in curr["todos"] if t["id"] != first_completed["id"]]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _delete_all_completed_todos_negative_also_deleted_incomplete():
    # 完成 todo 全删了，但顺带把一条未完成 todo 也删了
    task = _tasks_module.DeleteAllCompletedTodos()
    curr = copy.deepcopy(BASE_STATE)
    curr["todos"] = [t for t in curr["todos"] if not t.get("completed")]
    victim = next(t for t in curr["todos"] if not t.get("completed"))
    curr["todos"] = [t for t in curr["todos"] if t["id"] != victim["id"]]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _restore_from_trash_positive():
    task = _tasks_module.RestoreFromTrash()
    init_state = copy.deepcopy(BASE_STATE)
    note = _require_note(init_state, task.p.note_title)
    note["trashedAt"] = int(note["updatedAt"]) + 500
    curr = copy.deepcopy(init_state)
    _require_note(curr, task.p.note_title)["trashedAt"] = None
    return task, _make_task_input(init_state, curr)


def _restore_from_trash_negative():
    task = _tasks_module.RestoreFromTrash()
    init_state = copy.deepcopy(BASE_STATE)
    note = _require_note(init_state, task.p.note_title)
    note["trashedAt"] = int(note["updatedAt"]) + 500
    return task, _make_task_input(init_state, copy.deepcopy(init_state))


def _search_note_title_positive():
    return _positive_answer_case(_tasks_module.SearchNoteTitle())


def _search_note_title_negative():
    return _negative_answer_case(_tasks_module.SearchNoteTitle())
def _create_folder_and_move_note_positive():
    task = _tasks_module.CreateFolderAndMoveNote()
    curr = copy.deepcopy(BASE_STATE)
    folder = _add_folder(curr, task.p.folder_name)
    _require_note(curr, task.p.note_title)["folderId"] = folder["id"]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _create_folder_and_move_note_negative():
    task = _tasks_module.CreateFolderAndMoveNote()
    curr = copy.deepcopy(BASE_STATE)
    _add_folder(curr, task.p.folder_name)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)
def _create_note_with_reminder_positive():
    task = _tasks_module.CreateNoteWithReminder()
    curr = copy.deepcopy(BASE_STATE)
    ts = 1741597200000
    _add_note(curr, task.p.title, content=task.p.content, alarm_at=ts)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=Notes.reminder_time_labels(ts)[0])


def _create_note_with_reminder_positive_natural_time():
    task = _tasks_module.CreateNoteWithReminder()
    curr = copy.deepcopy(BASE_STATE)
    ts = 1741597200000
    _add_note(curr, task.p.title, content=task.p.content, alarm_at=ts)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer="提醒时间是下午5点00分")


def _create_note_with_reminder_negative_wrong_answer():
    task = _tasks_module.CreateNoteWithReminder()
    curr = copy.deepcopy(BASE_STATE)
    ts = 1741597200000
    _add_note(curr, task.p.title, content=task.p.content, alarm_at=ts)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer="提醒时间是明天")


def _create_note_with_reminder_negative_wrong_state():
    task = _tasks_module.CreateNoteWithReminder()
    curr = copy.deepcopy(BASE_STATE)
    ts = 1741597200000
    _add_note(curr, task.p.title, content="错误内容", alarm_at=ts)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=Notes.reminder_time_labels(ts)[0])


def _private_notes_workflow_positive():
    task = _tasks_module.PrivateNotesWorkflow()
    curr = copy.deepcopy(BASE_STATE)
    _require_note(curr, task.p.note_title)["isPrivate"] = True
    answer = _natural_answer(len(Notes(curr).private_notes))
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=answer)


def _private_notes_workflow_negative_wrong_answer():
    task = _tasks_module.PrivateNotesWorkflow()
    curr = copy.deepcopy(BASE_STATE)
    _require_note(curr, task.p.note_title)["isPrivate"] = True
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer="答案是999")


def _private_notes_workflow_negative_wrong_state():
    task = _tasks_module.PrivateNotesWorkflow()
    curr = copy.deepcopy(BASE_STATE)
    answer = _natural_answer(len(Notes(curr).private_notes))
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=answer)


def _todo_batch_workflow_positive():
    task = _tasks_module.TodoBatchWorkflow()
    curr = copy.deepcopy(BASE_STATE)
    _add_todo(curr, task.p.new_todo)
    _require_todo(curr, task.p.existing_todo)["completed"] = True
    answer = _natural_answer(len(Notes(curr).incomplete_todos))
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=answer)


def _todo_batch_workflow_negative_wrong_answer():
    task = _tasks_module.TodoBatchWorkflow()
    curr = copy.deepcopy(BASE_STATE)
    _add_todo(curr, task.p.new_todo)
    _require_todo(curr, task.p.existing_todo)["completed"] = True
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer="答案是999")


def _todo_batch_workflow_negative_wrong_state():
    task = _tasks_module.TodoBatchWorkflow()
    curr = copy.deepcopy(BASE_STATE)
    _add_todo(curr, task.p.new_todo)
    answer = _natural_answer(len(Notes(curr).incomplete_todos))
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=answer)


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("ReadNotesCount", _read_notes_count_positive),
    ("ChangeViewMode", _change_view_mode_positive),
    ("CreateNewNote", _create_new_note_positive),
    ("AddNewTodo", _add_new_todo_positive),
    ("PinNote", _pin_note_positive),
    ("ReadNoteContent", _read_note_content_positive),
    ("ReadTodoText", _read_todo_text_positive),
    ("DeleteTodo", _delete_todo_positive),
    ("DeleteAllCompletedTodos", _delete_all_completed_todos_positive),
    ("RestoreFromTrash", _restore_from_trash_positive),
    ("SearchNoteTitle", _search_note_title_positive),
    ("CreateFolderAndMoveNote", _create_folder_and_move_note_positive),
    ("CreateNoteWithReminder", _create_note_with_reminder_positive),
    ("PrivateNotesWorkflow", _private_notes_workflow_positive),
    ("TodoBatchWorkflow", _todo_batch_workflow_positive),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("ReadNotesCount", _read_notes_count_negative),
    ("ChangeViewMode", _change_view_mode_negative),
    ("CreateNewNote", _create_new_note_negative),
    ("AddNewTodo", _add_new_todo_negative),
    ("PinNote", _pin_note_negative),
    ("ReadNoteContent", _read_note_content_negative),
    ("ReadTodoText", _read_todo_text_negative),
    ("DeleteTodo", _delete_todo_negative),
    ("DeleteTodo", _delete_todo_negative_wrong_target),
    ("DeleteTodo", _delete_todo_negative_text_cleared),
    ("DeleteAllCompletedTodos", _delete_all_completed_todos_negative),
    ("DeleteAllCompletedTodos", _delete_all_completed_todos_negative_partial),
    ("DeleteAllCompletedTodos", _delete_all_completed_todos_negative_also_deleted_incomplete),
    ("RestoreFromTrash", _restore_from_trash_negative),
    ("SearchNoteTitle", _search_note_title_negative),
    ("CreateFolderAndMoveNote", _create_folder_and_move_note_negative),
    ("CreateNoteWithReminder", _create_note_with_reminder_negative_wrong_answer),
    ("CreateNoteWithReminder", _create_note_with_reminder_negative_wrong_state),
    ("PrivateNotesWorkflow", _private_notes_workflow_negative_wrong_answer),
    ("PrivateNotesWorkflow", _private_notes_workflow_negative_wrong_state),
    ("TodoBatchWorkflow", _todo_batch_workflow_negative_wrong_answer),
    ("TodoBatchWorkflow", _todo_batch_workflow_negative_wrong_state),
]

EXTRA_POSITIVE_CASES = [
    ("CreateNoteWithReminder_natural_time", _create_note_with_reminder_positive_natural_time),
]

OFFLINE_JUDGE_TASK_NAMES = {cls.__name__ for cls in ALL_TASK_CLASSES}


class TestTaskJudgeMatrixOffline:
    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == OFFLINE_JUDGE_TASK_NAMES
        assert negative == OFFLINE_JUDGE_TASK_NAMES

        for task_name in [
            "CreateNoteWithReminder",
            "PrivateNotesWorkflow",
            "TodoBatchWorkflow",
        ]:
            hybrid_negatives = [name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES if name == task_name]
            assert len(hybrid_negatives) >= 2

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_POSITIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_NEGATIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"

    @pytest.mark.parametrize(
        "task_name,builder",
        EXTRA_POSITIVE_CASES,
        ids=[name for name, _ in EXTRA_POSITIVE_CASES],
    )
    def test_extra_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} extra positive failed: issues={result.issues}, warnings={result.warnings}"
