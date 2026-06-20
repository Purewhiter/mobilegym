"""Scripted validation plans for Redbook (小红书) tasks.

``PLANS`` maps full ``task.id`` to GUI replay steps. ``ScriptedAgent`` renders
``{param}`` placeholders from ``task.params`` and resolves ``data-trigger`` /
``data-action`` selectors at ``env.step()`` time.
"""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    back,
    complete,
    grounded_answer,
    swipe,
    tap_action,
    tap_trigger,
    type_text,
    wait,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_param(trigger_id: str, value: str, *, param: str, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{param}":"{value}"\']:visible',
        summary=summary,
    )


def action_param(action_id: str, value: str, *, param: str, summary: str) -> Step:
    return click_selector(
        f'[data-action="{action_id}"][data-action-params*=\'"{param}":"{value}"\']:visible',
        summary=summary,
    )


def search(keyword: str) -> list[Step]:
    return [
        tap_trigger("search.open", summary="open search"),
        type_text(keyword, selector="input", clear=True, summary=f"enter search keyword {keyword}"),
        trigger_param("search.query.submit.push", keyword, param="q", summary="submit search"),
        wait(0.5, summary="wait for search results"),
    ]


def open_note(note_id: str, *, summary: str | None = None) -> Step:
    return trigger_param("note.open", note_id, param="id", summary=summary or f"open note {note_id}")


def like_note(note_id: str, *, summary: str | None = None) -> Step:
    return action_param("note.item.like.toggle", note_id, param="noteId", summary=summary or f"like note {note_id}")


def collect_note(note_id: str, *, summary: str | None = None) -> Step:
    return action_param("note.item.collect.toggle", note_id, param="noteId", summary=summary or f"collect note {note_id}")


def switch_discover_category(label: str) -> Step:
    """Home discover channels are plain onClick (no data-trigger); tap by label."""
    return click_selector(f'span:has-text("{label}"):visible', summary=f"switch discover category {label}")


def reveal_food_category() -> list[Step]:
    return [
        swipe([820, 120], [300, 120], summary="scroll discover channel bar to food"),
        wait(0.2, summary="wait after scrolling discover channels"),
    ]


def reveal_tutorial_note() -> list[Step]:
    return [
        swipe([500, 820], [500, 350], summary="scroll recommend feed to tutorial note"),
        wait(0.3, summary="wait after scrolling recommend feed"),
    ]


def send_chat_message(message: str) -> list[Step]:
    return [
        type_text(message, selector="input", clear=True, summary=f"type chat message {message!r}"),
        click_selector('button:has-text("发送"):visible', summary="send chat message"),
    ]


def publish_text_note(*, title: str, content: str) -> list[Step]:
    """Full write-text publish chain: sheet → entry → template → final → submit."""
    main = '[data-scroll-container="main"]'
    return [
        tap_trigger("home.modal.publish.open", summary="open publish sheet"),
        tap_trigger("publish.text.open.fromSheet", summary="choose write text"),
        wait(0.5, summary="wait for publish entry page"),
        click_selector(f"{main} >> text=说点什么或提个问题", summary="open publish text editor"),
        wait(0.3, summary="wait for textarea"),
        type_text(content, selector=f"{main} textarea", clear=True, summary="enter note body"),
        wait(0.3, summary="wait for enabled next button"),
        click_selector('button:has-text("下一步"):visible', summary="go to template picker"),
        wait(0.5, summary="wait for template page"),
        click_selector('button:has-text("下一步"):visible', summary="go to publish final page"),
        wait(0.5, summary="wait for final page"),
        type_text(title, selector='input[placeholder="添加标题"]', clear=True, summary=f"enter note title {title}"),
        type_text(content, selector=f"{main} textarea", clear=True, summary="confirm note body on final page"),
        back(summary="dismiss keyboard before submit"),
        wait(0.3, summary="wait for submit bar"),
        tap_action("publish.text.submit", summary="submit published note"),
        wait(1.0, summary="wait for publish navigation"),
    ]


# Stable note / user ids from apps/RedBook/data defaults (see test_tasks.py helpers).
NOTE_OOTD = "09lo9huid"
NOTE_TUTORIAL = "q5qpeylrt"
NOTE_FOOD_FIRST = "77n7xb4gc"
NOTE_READING = "ivsfhjfnd"
NOTE_TANDIAN = "yqgdara1j"
NOTE_FIRST_COLLECTED = "2kvlyjk5h"
USER_HAIBIAN = "x1dubbu13"
USER_HIYANG = "rdh0g1uqf"
COMMENT_TUTORIAL_ROOT = "3xzbdfr98"

PLANS: dict[str, list[Step]] = {
    "redbook.CheckMyProfileField": [
        *grounded_answer("3", summary="answer follower count"),
        complete(),
    ],
    "redbook.CheckSearchNoteField": [
        *grounded_answer("泡芙酱", summary="answer first OOTD search result author"),
        complete(),
    ],
    "redbook.CollectSearchNote": [
        *search("{keyword}"),
        open_note(NOTE_TUTORIAL, summary="open first 教程 search result"),
        collect_note(NOTE_TUTORIAL),
        complete(),
    ],
    "redbook.LikeFirstFeedNote": [
        *reveal_food_category(),
        switch_discover_category("美食"),
        wait(0.3, summary="wait for food feed"),
        open_note(NOTE_FOOD_FIRST, summary="open first food category note"),
        like_note(NOTE_FOOD_FIRST),
        complete(),
    ],
    "redbook.CheckSearchUserField": [
        *grounded_answer("福建", summary="answer 海边小橘子 IP location"),
        complete(),
    ],
    "redbook.UncollectFirstCollectedNote": [
        tap_trigger("tab.me", summary="open Me tab"),
        tap_trigger("me.tab.collects", summary="open collects tab"),
        open_note(NOTE_FIRST_COLLECTED, summary="open first collected note"),
        collect_note(NOTE_FIRST_COLLECTED, summary="uncollect first collected note"),
        complete(),
    ],
    "redbook.DMFollowedUser": [
        tap_trigger("tab.message", summary="open Messages tab"),
        trigger_param("chat.open", USER_HAIBIAN, param="userId", summary="open chat with followed user"),
        *send_chat_message("{message}"),
        complete(),
    ],
    "redbook.PublishNoteWithTitleAndContent": [
        *publish_text_note(title="{title}", content="{content}"),
        complete(),
    ],
    "redbook.LikeFeedNoteAndReportLikes": [
        *reveal_tutorial_note(),
        like_note(NOTE_TUTORIAL, summary="like recommend feed note containing 教程"),
        *grounded_answer("107", summary="report likes after toggle on 教程 feed note"),
        complete(),
    ],
    "redbook.CheckFollowingUserNoteCount": [
        *grounded_answer("5", summary="answer note count for followed user 西柚慢行"),
        complete(),
    ],
    "redbook.CheckFirstChatLastMessage": [
        *grounded_answer("周末要不要一起去逛逛？", summary="answer latest chat last message"),
        complete(),
    ],
    "redbook.CheckFirstCollectedAuthorField": [
        *grounded_answer("上海", summary="answer first collected note author location"),
        complete(),
    ],
    "redbook.SearchFirstNoteAuthorTopLikedTitle": [
        *grounded_answer("今日美甲分享｜冰透蓝钻杏仁甲✨", summary="answer author top-liked note title for 探店 search"),
        complete(),
    ],
    "redbook.SearchCollectAndReportAuthor": [
        *search("{keyword}"),
        open_note(NOTE_READING, summary="open first 读书 search result"),
        collect_note(NOTE_READING),
        trigger_param("user.open", "9y4u7u3e3", param="userId", summary="open note author profile"),
        *grounded_answer("36646", "671631", summary="report author followers and likes"),
        complete(),
    ],
    "redbook.CollectFeedNoteAndDMAuthor": [
        *reveal_tutorial_note(),
        open_note(NOTE_TUTORIAL, summary="open recommend note containing 教程"),
        collect_note(NOTE_TUTORIAL),
        back(summary="return to feed"),
        trigger_param("user.open", "inngljwy0", param="userId", summary="open note author profile"),
        trigger_param("chat.open", "inngljwy0", param="userId", summary="open chat with author"),
        *send_chat_message("{message}"),
        complete(),
    ],
    "redbook.PublishAndShareToFollowing": [
        *publish_text_note(title="{title}", content="脚本分享占位正文"),
        tap_trigger("tab.message", summary="open Messages tab"),
        trigger_param("chat.open", USER_HAIBIAN, param="userId", summary="open chat with share target"),
        *send_chat_message("{title}"),
        complete(),
    ],
    "redbook.ReplyToFeedNoteFirstComment": [
        *reveal_tutorial_note(),
        open_note(NOTE_TUTORIAL, summary="open replyable recommend note containing 教程"),
        wait(0.6, summary="wait for note detail page"),
        swipe([500, 820], [500, 300], summary="scroll note detail to comments"),
        wait(0.3, summary="wait after scrolling note detail"),
        action_param(
            "note.comment.reply.start",
            COMMENT_TUTORIAL_ROOT,
            param="commentId",
            summary="start reply to first root comment",
        ),
        type_text("{reply}", selector="input", clear=True, summary="type reply text"),
        tap_action("note.comment.submit", summary="submit comment reply"),
        complete(),
    ],
}
