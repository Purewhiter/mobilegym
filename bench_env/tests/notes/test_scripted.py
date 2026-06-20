"""Live scripted-plan verification for the Notes suite."""

from __future__ import annotations

import datetime as dt
import math
from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.notes import tasks as notes_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "notes"


def _next_reminder_answer() -> str:
    now = dt.datetime.now()
    total_minutes = now.hour * 60 + now.minute + (1 if now.second or now.microsecond else 0)
    rounded = int(math.ceil(total_minutes / 5) * 5) % (24 * 60)
    return f"{rounded // 60:02d}:{rounded % 60:02d}"


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("ReadNotesCount", lambda: notes_tasks.ReadNotesCount()),
    ("ChangeViewMode", lambda: notes_tasks.ChangeViewMode(mode="list")),
    ("CreateNewNote", lambda: notes_tasks.CreateNewNote(title="下周计划")),
    ("AddNewTodo", lambda: notes_tasks.AddNewTodo(text="买菜")),
    ("PinNote", lambda: notes_tasks.PinNote(note_title="购物清单")),
    (
        "ReadNoteContent",
        lambda: notes_tasks.ReadNoteContent(note_title="购物清单", keyword1="牛奶", keyword2="鸡蛋"),
    ),
    ("ReadTodoText", lambda: notes_tasks.ReadTodoText()),
    ("DeleteTodo", lambda: notes_tasks.DeleteTodo(todo_text="预约牙医")),
    ("DeleteAllCompletedTodos", lambda: notes_tasks.DeleteAllCompletedTodos()),
    ("RestoreFromTrash", lambda: notes_tasks.RestoreFromTrash(note_title="购物清单")),
    ("SearchNoteTitle", lambda: notes_tasks.SearchNoteTitle(keyword="购物", note_title="购物清单")),
    (
        "CreateFolderAndMoveNote",
        lambda: notes_tasks.CreateFolderAndMoveNote(folder_name="重要", note_title="购物清单"),
    ),
    (
        "CreateNoteWithReminder",
        lambda: notes_tasks.CreateNoteWithReminder(
            title="明天开会",
            content="记得带文件",
            answer=_next_reminder_answer(),
        ),
    ),
    ("PrivateNotesWorkflow", lambda: notes_tasks.PrivateNotesWorkflow(note_title="购物清单")),
    (
        "TodoBatchWorkflow",
        lambda: notes_tasks.TodoBatchWorkflow(new_todo="整理衣柜", existing_todo="明天去车站"),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(notes_tasks)
    missing = declared - covered
    assert not missing, f"Notes tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_notes_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
