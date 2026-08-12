"""Scripted validation plans for Notes tasks."""

from __future__ import annotations

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


PLANS: dict[str, list[Step]] = {
    "notes.ReadNotesCount": [
        # All 5 default notes fit on the first screen; assert one known title so
        # the answer is grounded in a rendered list (plan already couples to
        # defaults via the literal "5").
        assert_text("购物清单", summary="assert notes list rendered"),
        *grounded_answer("5", summary="answer visible notes count"),
        complete(),
    ],
    "notes.ChangeViewMode": [
        *open_settings(),
        click_selector('button:has-text("单列"):visible', summary="select list view mode"),
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
        assert_answer("{keyword1}", summary="assert content keyword1 on list card"),
        assert_answer("{keyword2}", summary="assert content keyword2 on list card"),
        # Open the note so its full content is on screen; the editor skips
        # autosave when nothing changed, so notes state stays clean. No back
        # needed — grounded_answer starts with home().
        *open_note("{note_title}"),
        *grounded_answer("牛奶\n鸡蛋\n洗衣液", summary="answer note content"),
        complete(),
    ],
    "notes.ReadTodoText": [
        # Incomplete todos sort first and all fit on the todo tab's first screen.
        *open_todo_tab(),
        # answer_fields declares one repeatable entry, so field_index stays 0;
        # one assert per answered todo text.
        assert_answer("明天去车站", summary="assert todo 1 on screen"),
        assert_answer("给妈妈打电话", summary="assert todo 2 on screen"),
        assert_answer("预约牙医", summary="assert todo 3 on screen"),
        *grounded_answer_repeatable("明天去车站", "给妈妈打电话", "预约牙医", summary="answer incomplete todos"),
        complete(),
    ],
    "notes.DeleteTodo": [
        *delete_todo("{todo_text}"),
        complete(),
    ],
    "notes.DeleteAllCompletedTodos": [
        *delete_todo("提交周报", row_y=370),
        *delete_todo("整理会议纪要", row_y=370),
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
        # itself; the judge's match_time (±5 min) stays authoritative for
        # the answered value.
        assert_text("提醒", summary="assert reminder row rendered in editor header"),
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
        # the plan is on the page the count is read from. The count "1"
        # itself stays un-asserted (short digit, high mismatch risk).
        assert_text("{note_title}", summary="assert note card on private-notes page"),
        *grounded_answer("1", summary="answer private notes count"),
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
        # and its checkbox flips to "取消完成". The count "3" stays
        # un-asserted (short digit, high mismatch risk).
        assert_visible(
            todo_checkbox("{existing_todo}", completed=True),
            summary="assert existing todo marked completed",
        ),
        *grounded_answer("3", summary="answer remaining incomplete todo count"),
        complete(),
    ],
}
