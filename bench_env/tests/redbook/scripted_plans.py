"""Scripted validation plans for Redbook (小红书) tasks.

``PLANS`` maps full ``task.id`` to GUI replay steps. ``ScriptedAgent`` renders
``{param}`` placeholders and resolves ``data-trigger`` / ``data-action``
selectors at ``env.step()`` time.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared placeholder
(``answer*``, entity ids like ``note_id`` / ``user_id`` / ``author_id`` /
``comment_id``, ``category_label``, ``last_note_title``, ``chat_user_id``) is
computed at materialization time from the episode's post-setup initial state
via the *judge-homologous* domain class — calculators build
``Redbook(init_state["apps"]["redbook"])`` exactly like judges build
``Redbook(input.apps_init["redbook"])``, so derived values cannot drift from
the judge. Answer literals ("泡芙酱" / "福建" / "3" / "107" / note titles) and
entity-id constants (first-collected note ``2kvlyjk5h`` etc.) that used to be
hardcoded are all placeholders now. ``test_scripted.py`` injects *declared*
task parameters only, exercising this derivation path end to end.

``Branch`` usage (restricted conditional form, one pure ``pick``):

- Per-``field`` arms (CheckMyProfileField / CheckSearchNoteField /
  CheckSearchUserField / CheckFirstCollectedAuthorField): each field value
  needs a different evidence assert — a different narrowed scope (short
  numbers like "3"/"326" must not be matched against the whole screen) or a
  different on-screen phrasing ("共 {answer} 条评论").
- Feed-scroll buckets (LikeFeedNoteAndReportLikes / CollectFeedNoteAndDMAuthor
  / ReplyToFeedNoteFirstComment): the target note's position in the recommend
  feed depends on the sampled keyword; ``pick`` locates the first qualifying
  candidate (judge-homologous selection) and chooses a statically-lintable
  swipe count from the layout calibration below.

Layout calibration (2026-08-13, exemption record — values depend on the FIXED
default feed order/data and the 360x800 css viewport; recalibrate when
apps/RedBook data or card layout changes):

- Scripted swipes are deterministic (``__SIM_INPUT__.swipe`` inertia defaults):
  the feed gesture [500,820]->[500,350] scrolls exactly ~612 css px per swipe;
  the long gesture [500,820]->[500,300] scrolls ~678 css px per swipe
  (measured constant across repeats; clamped at container end — over-swiping
  a fully-scrolled container is a no-op, which several plans rely on).
- Recommend feed (2-col masonry, uniform card height 355 css px, row height
  ~360): card at feed index ``i`` sits in row ``i // 2`` at top ≈ 117 + 360 *
  row. ``_FEED_ROW_SWIPES`` maps row -> swipe count that puts the card center
  comfortably inside the tappable viewport band.
- Note detail pages: first root-comment reply control offsetTop per base feed
  note is pinned in ``_DETAIL_REPLY_TOP`` (measured); <=1350 needs 1 long
  swipe, above needs 2 (short pages clamp safely).
- User profile grids: the *last* note card of a followed user is always
  reachable by scrolling to the bottom — 4 long swipes over-scroll even the
  deepest candidate grid (灵感小栈, 15 notes, maxScroll ~1870), so
  CheckFollowingUserNoteCount uses a fixed swipe count instead of a Branch.
  SearchFirstNoteAuthorTopLikedTitle's top-liked card stays visible at the
  grid bottom for every declared keyword's first-result author (美食 pos 4/9,
  探店 pos 0/2, 生活 pos 10/13 — all within the last viewport at maxScroll),
  so it also uses a fixed 3-swipe scroll.

Other exemptions / conventions:

- DM plans route through Me -> following list -> profile -> 私信 button:
  only 2 of the 7 followed users have a seeded chat thread, so the Messages
  tab cannot address an arbitrary sampled ``username``.
- PublishAndShareToFollowing's note body ("脚本分享占位正文") is scripted
  filler, not an answer literal — the task only constrains the title.
- Feed-task swipe counts assume the default feed order (no sampler currently
  shuffles it); if a feed-order sampler is ever added, the calibration tables
  above must become derived from the observed state instead.
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_answer,
    assert_text,
    back,
    complete,
    grounded_answer,
    swipe,
    tap_action,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.task.redbook.app import _CATEGORY_LABELS, Redbook


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


def swipe_feed_cards(times: int) -> list[Step]:
    """Recommend-feed swipes, ~612 css px each (see calibration docstring)."""
    return [
        swipe([500, 820], [500, 350], summary=f"scroll recommend feed {i + 1}/{times}")
        for i in range(times)
    ]


def swipe_page_down(times: int, target: str) -> list[Step]:
    """Long vertical swipes, ~678 css px each; clamps safely at container end."""
    return [
        swipe([500, 820], [500, 300], summary=f"scroll to {target} {i + 1}/{times}")
        for i in range(times)
    ]


def open_followed_user_profile(user_id: str) -> list[Step]:
    """Me tab → following list → profile — works for every followed user
    (the Messages tab only lists the 2 users with seeded chats)."""
    return [
        tap_trigger("tab.me", summary="open Me tab"),
        trigger_param("followList.open", "1", param="type", summary="open following list"),
        wait(0.3, summary="wait for following list"),
        trigger_param("user.open", user_id, param="userId", summary="open followed user profile"),
        wait(0.5, summary="wait for user profile"),
    ]


def open_chat_from_profile(user_id: str) -> list[Step]:
    return [
        trigger_param("chat.open", user_id, param="userId", summary="open chat via profile 私信 button"),
        wait(0.3, summary="wait for chat page"),
    ]


def open_first_collected_note() -> list[Step]:
    return [
        tap_trigger("tab.me", summary="open Me tab"),
        tap_trigger("me.tab.collects", summary="open collects tab"),
        open_note("{note_id}", summary="open first collected note"),
        wait(0.5, summary="wait for note detail"),
    ]


# ---------------------------------------------------------------------------
# Narrowed assert scopes (assert_answer scope is plain-CSS querySelectorAll)
# ---------------------------------------------------------------------------

# MePage stats row (fans / following cells carry the followList.open trigger;
# the likes-and-collects cell is untagged → structural child selector).
_ME_FOLLOWERS_SCOPE = '[data-trigger="followList.open"][data-trigger-params*=\'"type":"0"\']'
_ME_FOLLOWING_SCOPE = '[data-trigger="followList.open"][data-trigger-params*=\'"type":"1"\']'
_ME_LIKES_SCOPE = '.gap-6 > div.flex.flex-col.items-center:nth-child(3)'

# UserPage stats row (following / followers / likesAndCollections) — the only
# rendered ``gap-5`` container with div children while a profile is open.
_USER_FOLLOWERS_SCOPE = '.gap-5 > div.flex.flex-col.items-center:nth-child(2)'
_USER_LIKES_SCOPE = '.gap-5 > div.flex.flex-col.items-center:nth-child(3)'

# Note-detail bottom action bar counters (feed copies are display:none while
# the detail page is open, so the noteId-pinned control is unique on screen).
_NOTE_LIKE_COUNT_SCOPE = (
    '[data-action="note.item.like.toggle"][data-action-params*=\'"noteId":"{note_id}"\']'
)
_NOTE_COLLECT_COUNT_SCOPE = (
    '[data-action="note.item.collect.toggle"][data-action-params*=\'"noteId":"{note_id}"\']'
)

# HomePage discover channel-bar dropdown opener (the panel shows every channel
# in a 4-col grid — no horizontal channel-bar scrolling needed for any category).
_CHANNEL_PANEL_OPEN = '#redbook-home-scroll-discover .flex-shrink-0.w-8.cursor-pointer'


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility (judge-homologous calculators)
# ---------------------------------------------------------------------------

def _rb(state: dict[str, Any]) -> Redbook:
    """Judge-homologous accessor: ``Redbook(init_state["apps"]["redbook"])``."""
    return Redbook(state["apps"]["redbook"])


def _feed_notes(rb: Redbook) -> list[dict[str, Any]]:
    """Top-20 recommend feed — same visibility window judges and samplers use."""
    return rb.visible_discover_notes_for_category("recommend", limit=40)


def _not_liked(rb: Redbook, note: dict[str, Any]) -> bool:
    return not rb.has_liked(str(note["id"]))


def _not_collected(rb: Redbook, note: dict[str, Any]) -> bool:
    return not rb.has_collected(str(note["id"]))


def _has_root_comment(rb: Redbook, note: dict[str, Any]) -> bool:
    return any(not c.get("replyToId") for c in (note.get("commentList") or []))


def _first_matching_feed_note(
    task: Any,
    state: dict[str, Any],
    *,
    qualifies: Callable[[Redbook, dict[str, Any]], bool],
    what: str,
) -> tuple[int, dict[str, Any]]:
    """First title-matching + qualifying candidate in the recommend feed.

    Judges accept *any* qualifying candidate (existential checks); picking the
    first one minimizes scrolling and — for like/collect — guarantees the
    ``check_note_liked/collected`` init-state assertion holds.
    """
    kw = str(task.p.keyword or "")
    rb = _rb(state)
    for idx, note in enumerate(_feed_notes(rb)):
        if not kw or kw not in str(note.get("title") or ""):
            continue
        if qualifies(rb, note):
            return idx, note
    raise ValueError(f"no {what} recommend-feed note with title containing {kw!r}")


def _profile_field_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror CheckMyProfileField.get_answer (view_user derives follower/following counts)."""
    rb = _rb(state)
    user = rb.view_user(rb.user_id) or {}
    return str(user.get(task.p.field))


def _search_author_top_liked_title(task: Any, state: dict[str, Any]) -> str:
    """Mirror SearchFirstNoteAuthorTopLikedTitle.get_answer (same max over the same notes)."""
    rb = _rb(state)
    note = rb.first_search_note(task.p.keyword)
    author_id = str(note["authorId"])
    author_notes = [n for n in rb.notes_by_id.values() if str(n["authorId"]) == author_id]
    top = max(author_notes, key=lambda n: rb.count_value(n["likes"]))
    return str(top["title"])


def _liked_feed_note_answer(task: Any, state: dict[str, Any]) -> str:
    """Post-toggle count: init likes + 1 — mirrors the judge reading the liked
    note through the current-state view (view_note adds 1 for a liked note)."""
    rb = _rb(state)
    _, note = _first_matching_feed_note(task, state, qualifies=_not_liked, what="unliked")
    return str(int(rb.count_value(note.get("likes"))) + 1)


def _collect_report_author(task: Any, state: dict[str, Any]) -> dict[str, Any]:
    rb = _rb(state)
    return rb.note_author(rb.first_search_note(task.p.keyword))


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "redbook.CheckMyProfileField": {"answer": _profile_field_answer},
    "redbook.CheckSearchNoteField": {
        "note_id": lambda t, s: str(_rb(s).first_search_note(t.p.keyword)["id"]),
        "answer": lambda t, s: str(_rb(s).search_note_field(t.p.keyword, t.p.field)),
    },
    "redbook.CollectSearchNote": {
        "note_id": lambda t, s: str(_rb(s).first_search_note(t.p.keyword)["id"]),
    },
    "redbook.LikeFirstFeedNote": {
        "category_label": lambda t, s: _CATEGORY_LABELS[str(t.p.category)],
        "note_id": lambda t, s: str(
            _rb(s).visible_discover_notes_for_category(t.p.category, limit=40)[0]["id"]
        ),
    },
    "redbook.CheckSearchUserField": {
        "user_id": lambda t, s: str(_rb(s).require_user_by_name(t.p.username)["id"]),
        "answer": lambda t, s: str(_rb(s).user_field_by_name(t.p.username, t.p.field)),
    },
    "redbook.UncollectFirstCollectedNote": {
        "note_id": lambda t, s: str(_rb(s).first_collected_note()["id"]),
    },
    "redbook.DMFollowedUser": {
        "user_id": lambda t, s: str(_rb(s).require_user_by_name(t.p.username)["id"]),
    },
    "redbook.LikeFeedNoteAndReportLikes": {
        "note_id": lambda t, s: str(
            _first_matching_feed_note(t, s, qualifies=_not_liked, what="unliked")[1]["id"]
        ),
        "answer": _liked_feed_note_answer,
    },
    "redbook.CheckFollowingUserNoteCount": {
        "user_id": lambda t, s: str(_rb(s).require_user_by_name(t.p.username)["id"]),
        "answer": lambda t, s: str(_rb(s).followed_user_note_count(t.p.username)),
        "last_note_title": lambda t, s: str(_rb(s).user_notes_by_name(t.p.username)[-1]["title"]),
    },
    "redbook.CheckFirstChatLastMessage": {
        "chat_user_id": lambda t, s: str(_rb(s).first_chat()["userId"]),
        "answer": lambda t, s: str(_rb(s).first_chat_last_message()),
    },
    "redbook.CheckFirstCollectedAuthorField": {
        "note_id": lambda t, s: str(_rb(s).first_collected_note()["id"]),
        "author_id": lambda t, s: str(_rb(s).note_author(_rb(s).first_collected_note())["id"]),
        "answer": lambda t, s: str(_rb(s).first_collected_author_field(t.p.field)),
    },
    "redbook.SearchFirstNoteAuthorTopLikedTitle": {
        "author_id": lambda t, s: str(_rb(s).first_search_note(t.p.keyword)["authorId"]),
        "answer": _search_author_top_liked_title,
    },
    "redbook.SearchCollectAndReportAuthor": {
        "note_id": lambda t, s: str(_rb(s).first_search_note(t.p.keyword)["id"]),
        "author_id": lambda t, s: str(_collect_report_author(t, s)["id"]),
        "answer_followers": lambda t, s: str(_collect_report_author(t, s)["followers"]),
        "answer_likes": lambda t, s: str(_collect_report_author(t, s)["likesAndCollections"]),
    },
    "redbook.CollectFeedNoteAndDMAuthor": {
        "note_id": lambda t, s: str(
            _first_matching_feed_note(t, s, qualifies=_not_collected, what="uncollected")[1]["id"]
        ),
        "author_id": lambda t, s: str(
            _rb(s).note_author(
                _first_matching_feed_note(t, s, qualifies=_not_collected, what="uncollected")[1]
            )["id"]
        ),
    },
    "redbook.PublishAndShareToFollowing": {
        "user_id": lambda t, s: str(_rb(s).require_user_by_name(t.p.username)["id"]),
    },
    "redbook.ReplyToFeedNoteFirstComment": {
        "note_id": lambda t, s: str(
            _first_matching_feed_note(t, s, qualifies=_has_root_comment, what="replyable")[1]["id"]
        ),
        "comment_id": lambda t, s: str(
            _rb(s).first_root_comment(
                str(_first_matching_feed_note(t, s, qualifies=_has_root_comment, what="replyable")[1]["id"])
            )["id"]
        ),
    },
}


# ---------------------------------------------------------------------------
# Scroll calibration tables (see module docstring for methodology + exemption)
# ---------------------------------------------------------------------------

# Recommend feed: row (= feed index // 2) → swipe count (~612 px each) that
# centers the row's cards in the tappable band between topbar and TabBar.
_FEED_ROW_SWIPES = (0, 0, 1, 2, 2, 3, 3, 4, 5, 5)

# Note-detail first-root-comment reply control offsetTop (css px) per base
# feed note; <=1350 → 1 long swipe (~678 px, short pages clamp), else 2.
_DETAIL_REPLY_TOP = {
    "xpctqzmeh": 1068, "sf2cuy8rd": 1187, "nwzj7061a": 1072, "jenk3bhbc": 1015,
    "q5qpeylrt": 1216, "bq432lsae": 1504, "bprtset92": 1277, "oj232wjza": 1391,
    "ab5fvy5x2": 1447, "15xxgmlce": 1157, "csjm26aj7": 1097, "f3krdh2nl": 1103,
    "9aful62tg": 1303, "f32gpifh9": 1161, "r9jczedj4": 1214, "kavzebww4": 1161,
    "b6avbk45h": 1015, "ftf26l2sa": 1303, "rrszts7r1": 1043, "rc4dlc4vx": 1128,
}
_DETAIL_ONE_SWIPE_MAX_TOP = 1350


def _feed_swipe_bucket(idx: int) -> int:
    row = idx // 2
    if row >= len(_FEED_ROW_SWIPES):
        raise ValueError(
            f"feed candidate index {idx} beyond the calibrated top-20 window — "
            "recalibrate scripted_plans.py feed tables"
        )
    return _FEED_ROW_SWIPES[row]


def _detail_swipes_for_note(note_id: str) -> int:
    top = _DETAIL_REPLY_TOP.get(str(note_id))
    if top is None:
        raise ValueError(
            f"note {note_id!r} missing from _DETAIL_REPLY_TOP — "
            "recalibrate scripted_plans.py detail tables"
        )
    return 1 if top <= _DETAIL_ONE_SWIPE_MAX_TOP else 2


def _like_feed_pick(task: Any, state: dict[str, Any]) -> str:
    idx, _ = _first_matching_feed_note(task, state, qualifies=_not_liked, what="unliked")
    return f"feed{_feed_swipe_bucket(idx)}"


def _collect_dm_pick(task: Any, state: dict[str, Any]) -> str:
    idx, _ = _first_matching_feed_note(task, state, qualifies=_not_collected, what="uncollected")
    return f"feed{_feed_swipe_bucket(idx)}"


def _reply_pick(task: Any, state: dict[str, Any]) -> str:
    idx, note = _first_matching_feed_note(task, state, qualifies=_has_root_comment, what="replyable")
    return f"f{_feed_swipe_bucket(idx)}d{_detail_swipes_for_note(str(note['id']))}"


def _field_pick(task: Any, state: dict[str, Any]) -> str:
    return str(task.p.field)


# ---------------------------------------------------------------------------
# Branch arm builders
# ---------------------------------------------------------------------------

def _profile_field_arm(scope: str, label: str) -> list[Step]:
    return [
        tap_trigger("tab.me", summary="open Me tab with profile stats"),
        wait(0.3, summary="wait for profile stats"),
        # 短数字防假阳性：scope 收窄到对应统计格，格内只有数字与标签。
        assert_answer("{answer}", scope=scope, summary=f"assert {label} inside its stat cell"),
        *grounded_answer("{answer}", summary=f"answer profile {label}"),
        complete(),
    ]


def _search_note_field_arm(assert_step: Step, label: str) -> list[Step]:
    """Search → open the first result — every declared field renders on the
    detail page (title / author header / bottom-bar like·collect·comment counts)."""
    return [
        *search("{keyword}"),
        open_note("{note_id}", summary="open first search result note"),
        wait(0.6, summary="wait for note detail"),
        assert_step,
        *grounded_answer("{answer}", summary=f"answer first search note {label}"),
        complete(),
    ]


def _search_user_field_arm(assert_step: Step, label: str) -> list[Step]:
    return [
        *search("{username}"),
        trigger_param("search.tab.switch", "users", param="tab", summary="switch to users result tab"),
        wait(0.3, summary="wait for user results"),
        trigger_param("user.open", "{user_id}", param="userId", summary="open searched user profile"),
        wait(0.5, summary="wait for profile header"),
        assert_step,
        *grounded_answer("{answer}", summary=f"answer searched user {label}"),
        complete(),
    ]


def _collected_author_field_arm(assert_step: Step, label: str) -> list[Step]:
    return [
        *open_first_collected_note(),
        trigger_param("user.open", "{author_id}", param="userId", summary="open author profile from detail header"),
        wait(0.5, summary="wait for author profile"),
        assert_step,
        *grounded_answer("{answer}", summary=f"answer first collected note author {label}"),
        complete(),
    ]


def _like_feed_arm(swipes: int) -> list[Step]:
    return [
        *swipe_feed_cards(swipes),
        open_note("{note_id}", summary="open recommend feed note matching keyword"),
        wait(0.6, summary="wait for note detail"),
        like_note("{note_id}", summary="like from detail action bar"),
        wait(0.3, summary="wait for like count update"),
        # 点赞后底部栏计数就地 +1；scope 收窄到该笔记的 like 控件防短数字误中。
        assert_answer(
            "{answer}",
            scope=_NOTE_LIKE_COUNT_SCOPE,
            summary="assert post-toggle liked count inside the like control",
        ),
        *grounded_answer("{answer}", summary="report likes after toggle"),
        complete(),
    ]


def _collect_dm_arm(swipes: int) -> list[Step]:
    return [
        *swipe_feed_cards(swipes),
        open_note("{note_id}", summary="open recommend feed note matching keyword"),
        wait(0.6, summary="wait for note detail"),
        collect_note("{note_id}", summary="collect from detail action bar"),
        trigger_param("user.open", "{author_id}", param="userId", summary="open author profile from detail header"),
        wait(0.5, summary="wait for author profile"),
        *open_chat_from_profile("{author_id}"),
        *send_chat_message("{message}"),
        complete(),
    ]


def _reply_arm(feed_swipes: int, detail_swipes: int) -> list[Step]:
    return [
        *swipe_feed_cards(feed_swipes),
        open_note("{note_id}", summary="open replyable recommend note matching keyword"),
        wait(0.6, summary="wait for note detail page"),
        *swipe_page_down(detail_swipes, "note comments"),
        wait(0.3, summary="wait after scrolling note detail"),
        action_param(
            "note.comment.reply.start",
            "{comment_id}",
            param="commentId",
            summary="start reply to first root comment",
        ),
        type_text("{reply}", selector="input", clear=True, summary="type reply text"),
        tap_action("note.comment.submit", summary="submit comment reply"),
        complete(),
    ]


PLANS: dict[str, list[Step] | Branch] = {
    "redbook.CheckMyProfileField": Branch(
        pick=_field_pick,
        branches={
            "followers": _profile_field_arm(_ME_FOLLOWERS_SCOPE, "follower count"),
            "following": _profile_field_arm(_ME_FOLLOWING_SCOPE, "following count"),
            "likesAndCollections": _profile_field_arm(_ME_LIKES_SCOPE, "likes-and-collects count"),
        },
    ),
    "redbook.CheckSearchNoteField": Branch(
        pick=_field_pick,
        branches={
            "title": _search_note_field_arm(
                assert_answer("{answer}", summary="assert note title on detail page"), "title"
            ),
            "authorName": _search_note_field_arm(
                assert_answer("{answer}", summary="assert author name on detail header"), "author name"
            ),
            "likes": _search_note_field_arm(
                assert_answer(
                    "{answer}",
                    scope=_NOTE_LIKE_COUNT_SCOPE,
                    summary="assert likes count inside the like control",
                ),
                "likes",
            ),
            "collections": _search_note_field_arm(
                assert_answer(
                    "{answer}",
                    scope=_NOTE_COLLECT_COUNT_SCOPE,
                    summary="assert collections count inside the collect control",
                ),
                "collections",
            ),
            "comments": _search_note_field_arm(
                assert_text("共 {answer} 条评论", summary="assert comment count header on detail page"),
                "comments",
            ),
        },
    ),
    "redbook.CollectSearchNote": [
        *search("{keyword}"),
        open_note("{note_id}", summary="open first search result note"),
        wait(0.5, summary="wait for note detail"),
        collect_note("{note_id}", summary="collect from detail action bar"),
        complete(),
    ],
    # 频道下拉面板一次展示全部分类（4 列网格）——任意采样分类都无需横向滚动频道栏。
    "redbook.LikeFirstFeedNote": [
        click_selector(_CHANNEL_PANEL_OPEN, summary="open channel dropdown panel"),
        wait(0.3, summary="wait for channel panel"),
        click_selector('div:text-is("{category_label}"):visible', summary="select category from panel"),
        wait(0.5, summary="wait for category feed"),
        open_note("{note_id}", summary="open first note of the category feed"),
        wait(0.6, summary="wait for note detail"),
        like_note("{note_id}", summary="like from detail action bar"),
        complete(),
    ],
    "redbook.CheckSearchUserField": Branch(
        pick=_field_pick,
        branches={
            "location": _search_user_field_arm(
                assert_answer("{answer}", summary="assert profile IP location on-screen"), "IP location"
            ),
            "followers": _search_user_field_arm(
                assert_answer(
                    "{answer}",
                    scope=_USER_FOLLOWERS_SCOPE,
                    summary="assert followers count inside its stat cell",
                ),
                "followers",
            ),
            "likesAndCollections": _search_user_field_arm(
                assert_answer(
                    "{answer}",
                    scope=_USER_LIKES_SCOPE,
                    summary="assert likes-and-collects count inside its stat cell",
                ),
                "likes and collects",
            ),
        },
    ),
    "redbook.UncollectFirstCollectedNote": [
        *open_first_collected_note(),
        collect_note("{note_id}", summary="uncollect first collected note"),
        complete(),
    ],
    "redbook.DMFollowedUser": [
        *open_followed_user_profile("{user_id}"),
        *open_chat_from_profile("{user_id}"),
        *send_chat_message("{message}"),
        complete(),
    ],
    "redbook.PublishNoteWithTitleAndContent": [
        *publish_text_note(title="{title}", content="{content}"),
        complete(),
    ],
    "redbook.LikeFeedNoteAndReportLikes": Branch(
        pick=_like_feed_pick,
        branches={f"feed{n}": _like_feed_arm(n) for n in range(6)},
    ),
    "redbook.CheckFollowingUserNoteCount": [
        *open_followed_user_profile("{user_id}"),
        # 计数类答案不断数字（短数字极易误中）：改断浏览终点证据——滚到网格底部后
        # 该用户 feed 序最后一篇笔记的卡片标题可见，证明网格已数到底。
        # 4 次长滑对最深候选网格（15 篇笔记）也足以滚到底（滚到底后多余滑动无害）。
        *swipe_page_down(4, "user notes grid bottom"),
        wait(0.3, summary="wait after scrolling notes grid"),
        assert_text("{last_note_title}", summary="assert last note card of the user visible"),
        *grounded_answer("{answer}", summary="answer note count for followed user"),
        complete(),
    ],
    "redbook.CheckFirstChatLastMessage": [
        tap_trigger("tab.message", summary="open Messages tab with chat previews"),
        wait(0.3, summary="wait for chat list"),
        trigger_param("chat.open", "{chat_user_id}", param="userId", summary="open latest chat"),
        wait(0.5, summary="wait for chat messages"),
        assert_answer("{answer}", summary="assert last chat message bubble on-screen"),
        *grounded_answer("{answer}", summary="answer latest chat last message"),
        complete(),
    ],
    "redbook.CheckFirstCollectedAuthorField": Branch(
        pick=_field_pick,
        branches={
            "location": _collected_author_field_arm(
                assert_answer("{answer}", summary="assert author IP location on-screen"), "IP location"
            ),
            "followers": _collected_author_field_arm(
                assert_answer(
                    "{answer}",
                    scope=_USER_FOLLOWERS_SCOPE,
                    summary="assert author followers inside its stat cell",
                ),
                "followers",
            ),
            "likesAndCollections": _collected_author_field_arm(
                assert_answer(
                    "{answer}",
                    scope=_USER_LIKES_SCOPE,
                    summary="assert author likes-and-collects inside its stat cell",
                ),
                "likes and collects",
            ),
        },
    ),
    "redbook.SearchFirstNoteAuthorTopLikedTitle": [
        *search("{keyword}"),
        trigger_param("user.open", "{author_id}", param="userId", summary="open first result author profile"),
        wait(0.5, summary="wait for author profile"),
        # 3 次长滑滚到网格底部；对每个声明关键词的第一作者，其获赞最多笔记的卡片
        # 在底部视口内可见（标定见模块 docstring）。
        *swipe_page_down(3, "author notes grid"),
        wait(0.3, summary="wait after scrolling notes grid"),
        assert_answer("{answer}", summary="assert top-liked note title on author notes grid"),
        *grounded_answer("{answer}", summary="answer author top-liked note title"),
        complete(),
    ],
    "redbook.SearchCollectAndReportAuthor": [
        *search("{keyword}"),
        open_note("{note_id}", summary="open first search result note"),
        wait(0.5, summary="wait for note detail"),
        collect_note("{note_id}", summary="collect from detail action bar"),
        trigger_param("user.open", "{author_id}", param="userId", summary="open author profile from detail header"),
        wait(0.5, summary="wait for author profile header"),
        # 主页头部原样渲染两个统计数（无"万"缩写）；scope 收窄到各自统计格。
        assert_answer(
            "{answer_followers}",
            field_index=0,
            scope=_USER_FOLLOWERS_SCOPE,
            summary="assert author followers inside its stat cell",
        ),
        assert_answer(
            "{answer_likes}",
            field_index=1,
            scope=_USER_LIKES_SCOPE,
            summary="assert author likes-and-collections inside its stat cell",
        ),
        *grounded_answer("{answer_followers}", "{answer_likes}", summary="report author followers and likes"),
        complete(),
    ],
    "redbook.CollectFeedNoteAndDMAuthor": Branch(
        pick=_collect_dm_pick,
        branches={f"feed{n}": _collect_dm_arm(n) for n in range(6)},
    ),
    "redbook.PublishAndShareToFollowing": [
        # 正文是脚本占位（任务只约束标题）；分享路径走关注列表 → 主页私信，
        # 兼容任意采样的关注用户（消息 tab 只有 2 个预置会话）。
        *publish_text_note(title="{title}", content="脚本分享占位正文"),
        *open_followed_user_profile("{user_id}"),
        *open_chat_from_profile("{user_id}"),
        *send_chat_message("{title}"),
        complete(),
    ],
    "redbook.ReplyToFeedNoteFirstComment": Branch(
        pick=_reply_pick,
        branches={
            f"f{f}d{d}": _reply_arm(f, d)
            for f in range(6)
            for d in (1, 2)
        },
    ),
}
