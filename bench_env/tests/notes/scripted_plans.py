"""Scripted validation plans for Notes tasks.

Sampling compatibility (``DERIVED_PARAMS``): every plan placeholder that is
not a declared task parameter (``answer``, ``evidence_title``,
``view_mode_label``, ``todo1..3``, ``completed1..2``) is computed at
materialization time from the episode's post-setup initial state via the
*judge-homologous* ``Notes`` domain class — calculators build
``Notes(init_state["apps"]["notes"])`` exactly like judges build
``Notes(input.apps_init["notes"])``, and both read the same runner
observation, so derived values cannot drift from the judge. Explicitly
injected params would still win over these calculators; ``test_scripted.py``
deliberately injects declared parameters only, so live runs exercise this
derivation path end to end (the official ``--agent scripted`` sampling path).

Known residual hardcode: ``notes.PinNote`` long-presses a literal coordinate —
see the exemption comment on its plan entry.
"""

from __future__ import annotations

import datetime as dt
import math
from typing import Any, Callable

from bench_env.agent.scripted import (
    Step,
    assert_answer,
    assert_text,
    assert_visible,
    back,
    complete,
    grounded_answer,
    grounded_answer_repeatable,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.task.notes.app import Notes
from bench_env.task.utils import now_ms


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def hold(point: list[int], *, summary: str) -> Step:
    return {"op": "drag", "point1": point, "point2": point, "summary": summary}


def note_card(title: str) -> str:
    return f'button:has-text("{title}"):visible'


def todo_row(text: str) -> str:
    return f'xpath=//div[contains(@class,"rounded-[16px]") and .//*[normalize-space()="{text}"]]'


def todo_checkbox(text: str, *, completed: bool = False) -> str:
    label = "取消完成" if completed else "标记完成"
    return f'{todo_row(text)}//button[@aria-label="{label}"]'


def open_todo_tab() -> list[Step]:
    return [
        {"op": "click", "point": [750, 920], "summary": "open todo tab"},
        wait(0.3, summary="wait for todo tab"),
    ]


def open_note(title: str) -> list[Step]:
    return [
        click_selector(note_card(title), summary=f"open note {title}"),
        wait(0.4, summary="wait for note editor"),
    ]


def create_note(*, title: str, content: str | None = None) -> list[Step]:
    steps: list[Step] = [
        click_selector('button[aria-label="新建笔记"]:visible', summary="open new note editor"),
        wait(0.4, summary="wait for editor focus"),
        type_text(title, selector='input[placeholder="标题"]', clear=True, summary=f"type note title {title!r}"),
    ]
    if content is not None:
        steps.append(type_text(content, selector="textarea", clear=True, summary=f"type note content {content!r}"))
    steps.extend(
        [
            back(summary="dismiss note editor keyboard"),
            wait(1.2, summary="wait for note autosave"),
        ]
    )
    return steps


def add_todo(text: str) -> list[Step]:
    return [
        *open_todo_tab(),
        click_selector('button[aria-label="新建待办"]:visible', summary="tap new todo"),
        wait(0.3, summary="wait for todo input"),
        type_text(text, selector='input[placeholder="输入待办内容"]', clear=True, summary=f"type todo {text!r}"),
        back(summary="dismiss todo keyboard and commit"),
        wait(0.4, summary="wait for todo commit"),
    ]


def delete_todo(text: str, *, row_y: int = 302) -> list[Step]:
    return [
        *open_todo_tab(),
        type_text(text, selector='input[placeholder="搜索待办"]', clear=True, summary=f"search todo {text!r}"),
        back(summary="dismiss search keyboard"),
        wait(0.3, summary="wait for filtered todo"),
        {"op": "drag", "point1": [790, row_y], "point2": [340, row_y], "summary": "reveal todo delete action"},
        wait(0.2, summary="wait for delete action"),
        {"op": "click", "point": [820, row_y], "summary": "delete todo"},
        wait(0.3, summary="wait after todo delete"),
    ]


def open_settings() -> list[Step]:
    return [
        click_selector('button[aria-label="设置"]:visible', summary="open Notes settings"),
        wait(0.3, summary="wait for settings"),
    ]


def open_folders() -> list[Step]:
    return [
        click_selector('button[aria-label="文件夹"]:visible', summary="open folders"),
        wait(0.3, summary="wait for folders page"),
    ]


def create_folder(folder_name: str) -> list[Step]:
    return [
        *open_folders(),
        click_selector('button[aria-label="新建文件夹"]:visible', summary="open new folder dialog"),
        wait(0.3, summary="wait for folder dialog"),
        type_text(folder_name, selector='input[placeholder="请输入文件夹名称"]', clear=True, summary="type folder name"),
        click_selector('button:has-text("确定"):visible', summary="confirm new folder"),
        wait(0.4, summary="wait for folder creation"),
    ]


def move_open_note_to_folder(folder_name: str) -> list[Step]:
    return [
        click_selector('button[aria-label="文件夹"]:visible', summary="open editor folder picker"),
        wait(0.3, summary="wait for folder picker"),
        click_selector(f'button:has-text("{folder_name}"):visible', summary="choose target folder"),
        wait(0.3, summary="wait for folder choice"),
        back(summary="return from editor"),
        wait(0.3, summary="wait after returning to list"),
    ]


def open_editor_menu() -> list[Step]:
    return [
        click_selector('button[aria-label="更多"]:visible', summary="open editor more menu"),
        wait(0.3, summary="wait for editor menu"),
    ]


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (get_answer / check_goals in
# bench_env/task/notes/tasks.py) through the same Notes domain class over the
# same initial state, so the typed/asserted values are judge-homologous by
# construction.

def _notes(state: dict[str, Any]) -> Notes:
    """Judge-homologous accessor: ``Notes(init_state["apps"]["notes"])``."""
    return Notes(state["apps"]["notes"])


def _top_card_title(task: Any, state: dict[str, Any]) -> str:
    """Title of the home list's top card — mirrors the store sort (pinned
    first, then updatedAt desc; sortNotes in system/Notes/state.ts), so the
    asserted title is always on the first screen regardless of note count."""
    top = max(
        _notes(state).visible_notes,
        key=lambda note: (1 if note.get("pinned") else 0, int(note.get("updatedAt", 0) or 0)),
    )
    return str(top.get("title") or "")


# SettingsPage.tsx binds 双列 → notesViewMode "grid" and 单列 → "list"; the
# task's declared {mode} carries the state value, the plan taps the label.
_VIEW_MODE_LABELS = {"list": "单列", "grid": "双列"}


def _note_content_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror ReadNoteContent.get_answer: content of the first init note whose
    title equals {note_title} (exact match, raw state order)."""
    for note in _notes(state).notes:
        if str(note.get("title") or "") == str(task.p.note_title):
            return str(note.get("content") or "")
    return ""


def _incomplete_todo_text(state: dict[str, Any], index: int) -> str:
    """Mirror ReadTodoText.get_expected_response's incomplete_todos order; an
    out-of-range index (fewer todos than the plan's fixed rows) raises loudly
    at materialization."""
    return str(_notes(state).incomplete_todos[index].get("text") or "")


def _completed_todo_text(state: dict[str, Any], index: int) -> str:
    """Completed-todo text by init order — the same init set whose IDs
    check_all_completed_todos_deleted requires gone."""
    return str(_notes(state).completed_todos[index].get("text") or "")


def _default_reminder_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror the reminder dialog's default value: sim-now rounded UP to the
    5-minute step (roundUpToReminderStep in
    system/Notes/components/dateTimePickerModel.ts). The dialog actually
    computes it when opened mid-episode, so this episode-start derivation can
    lag one step behind the saved alarmAt — within the judge's match_time
    ±5 min tolerance (the judge stays authoritative via the final alarmAt)."""
    step_ms = 5 * 60 * 1000
    rounded_ms = math.ceil(now_ms(state["os"]) / step_ms) * step_ms
    local = dt.datetime.fromtimestamp(rounded_ms / 1000.0)
    return f"{local.hour:02d}:{local.minute:02d}"


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "notes.ReadNotesCount": {
        "answer": lambda task, state: str(len(_notes(state).visible_notes)),
        "evidence_title": _top_card_title,
    },
    "notes.ChangeViewMode": {
        "view_mode_label": lambda task, state: _VIEW_MODE_LABELS[str(task.p.mode)],
    },
    "notes.ReadNoteContent": {"answer": _note_content_answer},
    "notes.ReadTodoText": {
        "todo1": lambda task, state: _incomplete_todo_text(state, 0),
        "todo2": lambda task, state: _incomplete_todo_text(state, 1),
        "todo3": lambda task, state: _incomplete_todo_text(state, 2),
    },
    "notes.DeleteAllCompletedTodos": {
        "completed1": lambda task, state: _completed_todo_text(state, 0),
        "completed2": lambda task, state: _completed_todo_text(state, 1),
    },
    "notes.CreateNoteWithReminder": {"answer": _default_reminder_answer},
    "notes.PrivateNotesWorkflow": {
        # Mirror PrivateNotesWorkflow.check_goals: the _note sampler guarantees
        # the target is non-private in init, so expected = init private + 1.
        "answer": lambda task, state: str(len(_notes(state).private_notes) + 1),
    },
    "notes.TodoBatchWorkflow": {
        # Mirror TodoBatchWorkflow.check_goals: +1 new todo, -1 completed
        # existing todo — the incomplete count stays at the init value.
        "answer": lambda task, state: str(len(_notes(state).incomplete_todos)),
    },
}


PLANS: dict[str, list[Step]] = {
    "notes.ReadNotesCount": [
        # All default notes fit on the first screen; assert the derived
        # top-card title so the answer is grounded in a rendered list without
        # coupling the plan to defaults.json contents (count evidence — the
        # probe cannot count cards, the rendered list endorses {answer}).
        assert_text("{evidence_title}", summary="assert notes list rendered", endorses=["answer"]),
        *grounded_answer("{answer}", summary="answer visible notes count"),
        complete(),
    ],
    "notes.ChangeViewMode": [
        *open_settings(),
        click_selector(
            'button:has-text("{view_mode_label}"):visible',
            summary="select target view mode",
        ),
        complete(),
    ],
    "notes.CreateNewNote": [
        *create_note(title="{title}"),
        click_selector('button[aria-label="返回"]:visible', summary="leave editor"),
        complete(),
    ],
    "notes.AddNewTodo": [
        *add_todo("{text}"),
        complete(),
    ],
    "notes.PinNote": [
        # Residual hardcode (sampling exemption): entering selection mode
        # needs a press-hold, and hold() takes a literal coordinate —
        # [270, 430] is the top-left card of the default grid layout, i.e.
        # the newest note 购物清单, which is also the default {note_title}.
        # A resampled {note_title} on another card would long-press the wrong
        # note; deriving per-card coordinates would hardcode the entire grid
        # geometry instead, so the fixed-layout coupling is kept and
        # documented here (validated live with the default target only).
        hold([270, 430], summary="long press first note into selection mode"),
        wait(0.4, summary="wait for note selection mode"),
        click_selector('button:has-text("置顶"):visible', summary="pin selected note"),
        complete(),
    ],
    "notes.ReadNoteContent": [
        # Evidence: the editor keeps content inside a React-controlled
        # <textarea> value, invisible to text probes — assert the content
        # keywords on the home-list card snippet instead (full textContent,
        # only CSS-truncated).
        # The keyword pair identifies the {answer} content on the rendered
        # card; the closing assert carries the endorsement.
        assert_answer("{keyword1}", summary="assert content keyword1 on list card"),
        assert_answer("{keyword2}", summary="assert content keyword2 on list card", endorses=["answer"]),
        # Open the note so its full content is on screen; the editor skips
        # autosave when nothing changed, so notes state stays clean. No back
        # needed — grounded_answer starts with home(). {answer} is the derived
        # init content of {note_title}, so a resampled _note_target (different
        # note + keywords) stays self-consistent.
        *open_note("{note_title}"),
        *grounded_answer("{answer}", summary="answer note content"),
        complete(),
    ],
    "notes.ReadTodoText": [
        # Incomplete todos sort first and all fit on the todo tab's first screen.
        *open_todo_tab(),
        # answer_fields declares one repeatable entry, so field_index stays 0;
        # one assert per answered todo text. The plan shape fixes three
        # incomplete todos: fewer in init fails materialization loudly, more
        # fails the judge's set compare.
        assert_answer("{todo1}", summary="assert todo 1 on screen"),
        assert_answer("{todo2}", summary="assert todo 2 on screen"),
        assert_answer("{todo3}", summary="assert todo 3 on screen"),
        *grounded_answer_repeatable("{todo1}", "{todo2}", "{todo3}", summary="answer incomplete todos"),
        complete(),
    ],
    "notes.DeleteTodo": [
        *delete_todo("{todo_text}"),
        complete(),
    ],
    "notes.DeleteAllCompletedTodos": [
        # Completed texts derive from the same init set whose IDs the judge
        # requires gone. The plan shape fixes two completed todos: fewer in
        # init fails materialization loudly, more fails the judge.
        *delete_todo("{completed1}", row_y=370),
        *delete_todo("{completed2}", row_y=370),
        complete(),
    ],
    "notes.RestoreFromTrash": [
        *open_folders(),
        click_selector('button:has-text("回收站"):visible', summary="open trash"),
        wait(0.3, summary="wait for trash"),
        click_selector('button[aria-label="更多"]:visible', summary="open trash item actions"),
        wait(0.2, summary="wait for trash action sheet"),
        click_selector('button:has-text("恢复"):visible', summary="restore note from trash"),
        complete(),
    ],
    "notes.SearchNoteTitle": [
        # Home-page search filters instantly; matching card stays on screen.
        # Search query is page-local React state, so app state stays clean.
        type_text("{keyword}", selector='input[placeholder="搜索笔记"]', clear=True, summary="search notes by keyword"),
        back(summary="dismiss search keyboard"),
        wait(0.3, summary="wait for search results"),
        assert_answer("{note_title}", summary="assert matched note title in filtered list"),
        *grounded_answer("{note_title}", summary="answer search result title"),
        complete(),
    ],
    "notes.CreateFolderAndMoveNote": [
        *create_folder("{folder_name}"),
        click_selector('button:has-text("全部"):visible', summary="return to all notes"),
        wait(0.4, summary="wait for notes list"),
        *open_note("{note_title}"),
        *move_open_note_to_folder("{folder_name}"),
        complete(),
    ],
    "notes.CreateNoteWithReminder": [
        *create_note(title="{title}", content="{content}"),
        *open_editor_menu(),
        click_selector('button:has-text("设置提醒"):visible', summary="open reminder dialog"),
        wait(0.4, summary="wait for reminder dialog"),
        click_selector('button:has-text("确定"):visible', summary="confirm default reminder time"),
        wait(0.4, summary="wait for reminder save"),
        # Evidence: the editor header renders the "提醒 M月D日 h:mm" row only
        # after alarmAt is saved (the more-menu ActionSheet is unmounted by
        # now). The on-screen hour has no zero padding while the injected
        # {answer} is zero-padded ("09:15"), so assert the reminder row
        # itself (endorsing {answer}); the judge's match_time (±5 min) stays
        # authoritative for the answered value.
        assert_text("提醒", summary="assert reminder row rendered in editor header", endorses=["answer"]),
        *grounded_answer("{answer}", summary="answer reminder time"),
        complete(),
    ],
    "notes.PrivateNotesWorkflow": [
        *open_note("{note_title}"),
        *open_editor_menu(),
        click_selector('button:has-text("设为私密"):visible', summary="set note private"),
        wait(0.4, summary="wait for private route"),
        # Evidence: "set private" replaces the editor with the private-notes
        # page; the note card visible there proves the operation landed and
        # the plan is on the page the count is read from. The derived count
        # itself stays un-asserted (short digit, high mismatch risk) — this
        # page-context assert endorses it.
        assert_text("{note_title}", summary="assert note card on private-notes page", endorses=["answer"]),
        *grounded_answer("{answer}", summary="answer private notes count"),
        complete(),
    ],
    "notes.TodoBatchWorkflow": [
        *add_todo("{new_todo}"),
        # Evidence: the draft row only commits to a plain (assertable) todo
        # row when its input blurs — focusing the search box does exactly
        # that, so filter by the new text and assert the committed row.
        type_text("{new_todo}", selector='input[placeholder="搜索待办"]', clear=True, summary="search new todo"),
        back(summary="dismiss todo search keyboard"),
        wait(0.3, summary="wait for new todo filter"),
        assert_visible(todo_row("{new_todo}"), summary="assert new todo row visible"),
        type_text("{existing_todo}", selector='input[placeholder="搜索待办"]', clear=True, summary="search existing todo"),
        back(summary="dismiss todo search keyboard"),
        wait(0.3, summary="wait for existing todo"),
        click_selector(todo_checkbox("{existing_todo}"), summary="mark existing todo completed"),
        wait(0.3, summary="wait for todo completion"),
        # Evidence: after the toggle the row moves to the completed section
        # and its checkbox flips to "取消完成". The derived count stays
        # un-asserted (short digit, high mismatch risk) — the workflow's
        # closing evidence assert endorses it.
        assert_visible(
            todo_checkbox("{existing_todo}", completed=True),
            summary="assert existing todo marked completed",
            endorses=["answer"],
        ),
        *grounded_answer("{answer}", summary="answer remaining incomplete todo count"),
        complete(),
    ],
}
