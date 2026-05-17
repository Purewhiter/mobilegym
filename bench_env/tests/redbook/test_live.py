"""
Live judge verification for RedBook (小红书) tasks.

Drives real Zustand actions via ``window.__BENCH_STORES__`` (exposed in
dev mode) and asserts ``task.evaluate()`` agrees with the action result.
This catches state.ts ↔ judge desync (e.g. view-layer count derivation
disagreeing with what the judge expects) that the offline
``test_redbook.py`` can't.

Requires the Vite dev server running at ``--sim-url`` (default
``http://localhost:3000``). Skip with ``pytest -m 'not live'``.

Coverage: 17 RedBook tasks × {positive, negative} = 34 tests.

Per-task design:
- ``positive`` runs the canonical correct action(s) for the task and (for
  AnswerTask / hybrid) provides the ground-truth answer derived from state.
  The full judge — check_goals + expected_changes — must accept.
- ``negative`` does nothing and provides no answer; check_goals must reject.

For hybrid tasks (LikeFeedNoteAndReportLikes, SearchCollectAndReportAuthor)
the expected answer depends on post-action state (e.g. the like count after
the toggle), so they get a dedicated ``answer_fn`` that reads ``curr_obs``.
"""

from __future__ import annotations

import json
from typing import Awaitable, Callable

import pytest
from flaky import flaky

from bench_env.env.base import Observation
from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.judge import JudgeInput, JudgeResult
from bench_env.task.redbook import tasks as rb_tasks
from bench_env.task.redbook.app import Redbook


pytestmark = [pytest.mark.live, pytest.mark.asyncio(loop_scope="session")]


# ── helpers ────────────────────────────────────────────────────────────

async def _dispatch(env: MobileGymEnv, app_id: str, action: str, args: list | None = None) -> None:
    """
    Invoke ``window.__BENCH_STORES__.get(app_id).getState()[action](...args)``
    in the browser. Raises if the registry, store, or action is missing — those
    are setup bugs (e.g. dev export not loaded), not Agent failures.
    """
    args = args or []
    payload = json.dumps({"appId": app_id, "action": action, "args": args})
    js = """
    async (raw) => {
        const { appId, action, args } = JSON.parse(raw);
        const reg = window.__BENCH_STORES__;
        if (!reg) throw new Error('__BENCH_STORES__ not exposed (dev build only)');
        const store = reg.get(appId);
        if (!store) throw new Error('store not registered: ' + appId);
        const fn = store.getState()[action];
        if (typeof fn !== 'function') {
            throw new Error('not an action on ' + appId + ': ' + action);
        }
        const ret = fn(...args);
        if (ret && typeof ret.then === 'function') await ret;
    }
    """
    await env.page.evaluate(js, payload)


async def _read_state(env: MobileGymEnv) -> dict:
    state = await env.get_state(required_apps=["redbook"])
    return state["apps"]["redbook"]


Driver = Callable[[MobileGymEnv, BaseTask], Awaitable[None]]
AnswerFn = Callable[[BaseTask, Observation, Observation], "str | None"]


async def _noop(_env: MobileGymEnv, _task: BaseTask) -> None:
    pass


def _default_answer(task: BaseTask, init_obs: Observation, curr_obs: Observation) -> str | None:
    """Default answer extractor.

    For ``AnswerTask`` we compute the ground truth via ``task.get_answer()``
    against the init-state JudgeInput. Operate-only tasks return ``None``.
    Dict answers are flattened to a single space-joined string so the
    judge's per-slot substring matchers in ``build_answer_checks`` find
    every slot value.
    """
    if not isinstance(task, AnswerTask):
        return None
    proxy = JudgeInput(init_obs=init_obs, last_obs=curr_obs)
    val = task.get_answer(proxy)
    if val is None:
        return ""
    if isinstance(val, dict):
        return " ".join(str(v) for v in val.values())
    return str(val)


def _empty_answer(*_: object) -> str | None:
    """Negative-case answer: None forces every answer check to fail."""
    return None


async def _run(
    env: MobileGymEnv,
    task: BaseTask,
    drive: Driver,
    answer_fn: AnswerFn = _default_answer,
) -> JudgeResult:
    init_obs = await task.setup(env)
    await drive(env, task)
    curr_state = await env.get_state(required_apps=task.apps or None)
    curr_obs = Observation(state=curr_state, route=init_obs.route, step_idx=1)
    answer = answer_fn(task, init_obs, curr_obs)
    return task.evaluate(JudgeInput(init_obs=init_obs, last_obs=curr_obs, answer=answer))


def _format(res: JudgeResult) -> str:
    return json.dumps(res.to_dict(), ensure_ascii=False, indent=2)


# ── operate / hybrid drivers ───────────────────────────────────────────

async def _drive_collect_search_note(env, task):
    rb = Redbook(await _read_state(env))
    note_id = str(rb.first_search_note(task.p.keyword)["id"])
    # Mirror the full UI flow: search → open detail → collect. This exercises
    # the `addSearchHistory` / `addToHistory` store actions (covered by the
    # task's expected_changes whitelist), so a missing-side-effect bug surfaces.
    await _dispatch(env, "redbook", "addSearchHistory", [task.p.keyword])
    await _dispatch(env, "redbook", "addToHistory", [note_id])
    await _dispatch(env, "redbook", "toggleCollect", [note_id])


async def _drive_like_first_feed_note(env, task):
    rb = Redbook(await _read_state(env))
    notes = rb.visible_discover_notes_for_category(task.p.category, limit=40)
    assert notes, f"no notes in category {task.p.category!r}"
    note_id = str(notes[0]["id"])
    # UI flow: switch tab → open detail → like.
    await _dispatch(env, "redbook", "updateHomeState", [{"activeCategory": task.p.category}])
    await _dispatch(env, "redbook", "addToHistory", [note_id])
    await _dispatch(env, "redbook", "toggleLike", [note_id])


async def _drive_uncollect_first_collected(env, _task):
    rb = Redbook(await _read_state(env))
    note_id = str(rb.first_collected_note()["id"])
    # UI flow: open detail → uncollect.
    await _dispatch(env, "redbook", "addToHistory", [note_id])
    await _dispatch(env, "redbook", "toggleCollect", [note_id])


async def _drive_dm_followed_user(env, task):
    rb = Redbook(await _read_state(env))
    user_id = str(rb.require_user_by_name(task.p.username)["id"])
    await _dispatch(env, "redbook", "sendMessage", [user_id, task.p.message])


async def _drive_publish_note(env, task):
    await _dispatch(env, "redbook", "addNote", [{
        "title": task.p.title,
        "content": task.p.content,
        "images": [],
    }])


async def _drive_like_feed_report(env, task):
    rb = Redbook(await _read_state(env))
    kw = task.p.keyword
    candidates = [
        n for n in rb.visible_discover_notes_for_category("recommend", limit=40)
        if kw and kw in str(n.get("title") or "")
    ]
    assert candidates, f"no feed note with keyword {kw!r}"
    note_id = str(candidates[0]["id"])
    await _dispatch(env, "redbook", "addToHistory", [note_id])
    await _dispatch(env, "redbook", "toggleLike", [note_id])


async def _drive_search_collect_author(env, task):
    rb = Redbook(await _read_state(env))
    note_id = str(rb.first_search_note(task.p.keyword)["id"])
    await _dispatch(env, "redbook", "addSearchHistory", [task.p.keyword])
    await _dispatch(env, "redbook", "addToHistory", [note_id])
    await _dispatch(env, "redbook", "toggleCollect", [note_id])


async def _drive_collect_feed_and_dm_author(env, task):
    rb = Redbook(await _read_state(env))
    kw = task.p.keyword
    candidates = [
        n for n in rb.visible_discover_notes_for_category("recommend", limit=40)
        if kw and kw in str(n.get("title") or "")
    ]
    assert candidates, f"no feed note with keyword {kw!r}"
    note = candidates[0]
    note_id = str(note["id"])
    author_id = str(rb.note_author(note)["id"])
    await _dispatch(env, "redbook", "addToHistory", [note_id])
    await _dispatch(env, "redbook", "toggleCollect", [note_id])
    await _dispatch(env, "redbook", "sendMessage", [author_id, task.p.message])


async def _drive_publish_and_share(env, task):
    rb = Redbook(await _read_state(env))
    user_id = str(rb.require_user_by_name(task.p.username)["id"])
    title = task.p.title
    # Mirror the UI flow: title typed into publishDraft (judge asserts this),
    # the note submitted via addNote, then the title DM'd to the target user.
    await _dispatch(env, "redbook", "updatePublishDraft", [{"title": title}])
    await _dispatch(env, "redbook", "addNote", [{"title": title, "content": "", "images": []}])
    await _dispatch(env, "redbook", "sendMessage", [user_id, title])


async def _drive_reply_first_feed_comment(env, task):
    rb = Redbook(await _read_state(env))
    kw = task.p.keyword
    candidates = [
        n for n in rb.visible_discover_replyable_notes("recommend", limit=40)
        if kw and kw in str(n.get("title") or "")
    ]
    assert candidates, f"no replyable feed note with keyword {kw!r}"
    note = candidates[0]
    note_id = str(note["id"])
    first_root_id = str(rb.first_root_comment(note_id)["id"])
    await _dispatch(env, "redbook", "addToHistory", [note_id])
    await _dispatch(env, "redbook", "addComment", [note_id, task.p.reply, first_root_id])


# ── hybrid answer fns (need post-action state) ──────────────────────────

def _answer_like_feed_report(task, init_obs, _curr_obs):
    # Derive the expected post-action likes count from INIT state plus the
    # known +1 from the driver's toggleLike — NOT from `curr.view_note()`.
    # If we derived from curr we'd be reading through the very `view_note`
    # likes derivation the judge also goes through, so a bug in that
    # derivation (e.g. forgetting the user-liked +1) would produce the same
    # wrong number on both sides and the test would pass spuriously.
    # Reading raw init `likes` instead means driver answer = "raw +1" while
    # the judge computes via view; any view-derivation bug now surfaces as a
    # real mismatch.
    rb_init = Redbook(init_obs.state["apps"]["redbook"])
    kw = task.p.keyword
    candidates = [
        n for n in rb_init.visible_discover_notes_for_category("recommend", limit=40)
        if kw and kw in str(n.get("title") or "")
    ]
    if not candidates:
        return ""
    note_id = str(candidates[0]["id"])
    # Read raw base/state count (bypass view-layer derivation). If the user
    # already liked this note in init, toggleLike un-likes it (count - 1);
    # otherwise it adds the like (count + 1).
    base_note = rb_init.base_notes_by_id.get(note_id) or rb_init.state_notes.get(note_id) or {}
    raw_likes_value = base_note.get("likes") if isinstance(base_note, dict) else None
    try:
        raw_likes = int(float(raw_likes_value)) if raw_likes_value is not None else 0
    except (TypeError, ValueError):
        # Fallback: use the view value (still better than nothing). This path
        # is the same as before the fix; only triggered when raw isn't numeric.
        raw_likes = int(rb_init.count_value(candidates[0].get("likes")))
    was_liked = note_id in {str(x) for x in rb_init.liked_notes}
    return str(raw_likes - 1 if was_liked else raw_likes + 1)


def _answer_search_collect_author(task, init_obs, _curr_obs):
    # Author followers/likes are stable across the agent's action (the agent
    # only collects the note — author's profile doesn't change), so derive
    # from init state.
    rb = Redbook(init_obs.state["apps"]["redbook"])
    note = rb.first_search_note(task.p.keyword)
    author = rb.note_author(note)
    return f"{author.get('followers')} {author.get('likesAndCollections')}"


# ── parametrized matrix ────────────────────────────────────────────────

# (test_id, task_cls, positive_driver, positive_answer_fn).
# Negative case always uses _noop + _empty_answer.
TASKS: list[tuple[str, type[BaseTask], Driver, AnswerFn]] = [
    # --- AnswerTask: nothing to drive, answer derived from init state ---
    ("CheckMyProfileField", rb_tasks.CheckMyProfileField, _noop, _default_answer),
    ("CheckSearchNoteField", rb_tasks.CheckSearchNoteField, _noop, _default_answer),
    ("CheckSearchUserField", rb_tasks.CheckSearchUserField, _noop, _default_answer),
    ("CheckFollowingUserNoteCount", rb_tasks.CheckFollowingUserNoteCount, _noop, _default_answer),
    ("CheckFirstChatLastMessage", rb_tasks.CheckFirstChatLastMessage, _noop, _default_answer),
    ("CheckFirstCollectedAuthorField", rb_tasks.CheckFirstCollectedAuthorField, _noop, _default_answer),
    ("SearchFirstNoteAuthorTopLikedTitle", rb_tasks.SearchFirstNoteAuthorTopLikedTitle, _noop, _default_answer),

    # --- Operate tasks ---
    ("CollectSearchNote", rb_tasks.CollectSearchNote, _drive_collect_search_note, _default_answer),
    ("LikeFirstFeedNote", rb_tasks.LikeFirstFeedNote, _drive_like_first_feed_note, _default_answer),
    ("UncollectFirstCollectedNote", rb_tasks.UncollectFirstCollectedNote, _drive_uncollect_first_collected, _default_answer),
    ("DMFollowedUser", rb_tasks.DMFollowedUser, _drive_dm_followed_user, _default_answer),
    ("PublishNoteWithTitleAndContent", rb_tasks.PublishNoteWithTitleAndContent, _drive_publish_note, _default_answer),
    ("CollectFeedNoteAndDMAuthor", rb_tasks.CollectFeedNoteAndDMAuthor, _drive_collect_feed_and_dm_author, _default_answer),
    ("PublishAndShareToFollowing", rb_tasks.PublishAndShareToFollowing, _drive_publish_and_share, _default_answer),
    ("ReplyToFeedNoteFirstComment", rb_tasks.ReplyToFeedNoteFirstComment, _drive_reply_first_feed_comment, _default_answer),

    # --- Hybrid (operate + answer; answer depends on action) ---
    ("LikeFeedNoteAndReportLikes", rb_tasks.LikeFeedNoteAndReportLikes, _drive_like_feed_report, _answer_like_feed_report),
    ("SearchCollectAndReportAuthor", rb_tasks.SearchCollectAndReportAuthor, _drive_search_collect_author, _answer_search_collect_author),
]

_TASK_IDS = [t[0] for t in TASKS]


# With pytest-xdist running multiple workers in parallel against a single
# shared dev server, `task.setup() → env.reset()` occasionally races a
# concurrent navigation triggered by another worker's `_prepare` (e.g.
# `CheckFirstChatLastMessage` injects chats via `set_state`), producing
# "Execution context was destroyed" from Playwright. The action itself is
# idempotent and a retry recovers — `@flaky` lets us tolerate that without
# masking real regressions (a deterministic bug still fails all 3 runs).

@flaky(max_runs=3, min_passes=1)
@pytest.mark.parametrize("name,task_cls,drive,answer_fn", TASKS, ids=_TASK_IDS)
async def test_positive(env: MobileGymEnv, name: str, task_cls: type[BaseTask], drive: Driver, answer_fn: AnswerFn):
    res = await _run(env, task_cls(), drive, answer_fn)
    assert res.passed, f"[{name}] positive must pass (success + clean diff):\n{_format(res)}"


@flaky(max_runs=3, min_passes=1)
@pytest.mark.parametrize("name,task_cls,_drive,_answer_fn", TASKS, ids=_TASK_IDS)
async def test_negative(env: MobileGymEnv, name: str, task_cls: type[BaseTask], _drive: Driver, _answer_fn: AnswerFn):
    res = await _run(env, task_cls(), _noop, _empty_answer)
    assert not res.success, f"[{name}] negative (no action) must fail check_goals:\n{_format(res)}"
