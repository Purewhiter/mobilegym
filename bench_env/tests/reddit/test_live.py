"""
Live judge verification for Reddit tasks.

Drives real Zustand actions via ``window.__BENCH_STORES__`` (exposed in
dev mode) and asserts ``task.evaluate()`` agrees with the action result.
This catches state.ts ↔ judge desync (e.g. fence missing a side-effect
write) that offline ``test_reddit.py`` cannot.

Requires the Vite dev server running at ``--sim-url`` (default
``http://localhost:3000``). Skip with ``pytest -m 'not live'``.

Coverage: 16 Reddit tasks × {positive, negative} = 32 tests.
"""

from __future__ import annotations

import json
from typing import Awaitable, Callable

import pytest

from bench_env.env.base import Observation
from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput, JudgeResult
from bench_env.task.reddit import tasks as reddit_tasks
from bench_env.task.reddit.app import load_reddit_posts


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


Driver = Callable[[MobileGymEnv, BaseTask], Awaitable[None]]


async def _run(env: MobileGymEnv, task: BaseTask, drive: Driver) -> JudgeResult:
    init_obs = await task.setup(env)
    await drive(env, task)
    curr_state = await env.get_state(required_apps=task.apps or None)
    curr_obs = Observation(state=curr_state, route=init_obs.route, step_idx=1)
    return task.evaluate(JudgeInput(init_obs=init_obs, last_obs=curr_obs))


async def _noop(_env: MobileGymEnv, _task: BaseTask) -> None:
    pass


def _format(res: JudgeResult) -> str:
    return json.dumps(res.to_dict(), ensure_ascii=False, indent=2)


async def _read_state(env: MobileGymEnv) -> dict:
    state = await env.get_state(required_apps=["reddit"])
    return state["apps"]["reddit"]


# ── per-task drivers (positive case = the canonical "correct" action) ─

async def _drive_disable_community_themes(env, _task):
    await _dispatch(env, "reddit", "updateSettings", [{"showCommunityStyles": False}])


async def _drive_advanced_privacy_toggles(env, _task):
    # Order: enable showNSFW first to unlock blurNSFW, then flip both.
    # The store is a plain merge so a single batched updateSettings works as
    # long as the final state matches the criteria — UI ordering is not
    # what's under test here.
    await _dispatch(env, "reddit", "updateSettings", [{
        "showNSFW": True, "blurNSFW": False, "showCommunityStyles": False,
    }])


async def _drive_turn_off_mature_keep_unblurred(env, _task):
    # The judged final state: showNSFW=False AND blurNSFW=False.
    await _dispatch(env, "reddit", "updateSettings", [{
        "showNSFW": False, "blurNSFW": False,
    }])


async def _drive_open_links_outside_app(env, _task):
    await _dispatch(env, "reddit", "updateSettings", [{"openLinksInApp": False}])


async def _drive_join_community_from_feed(env, task):
    community = task.params["community"]
    target = next(
        (p for p in load_reddit_posts() if str(p.get("subreddit")) == community),
        None,
    )
    assert target, f"no fixture post in {community}"
    await _dispatch(env, "reddit", "toggleJoin", [community])
    await _dispatch(env, "reddit", "votePost", [str(target["id"]), "up"])


async def _drive_upvote_specific_feed_post(env, task):
    await _dispatch(env, "reddit", "votePost", [str(task.params["post_id"]), "up"])


async def _drive_create_post_to_community(env, task):
    post = {
        "id": "live_test_create_post_1",
        "subreddit": str(task.params["community"]),
        "author": "Embarrassed_Fee8630",
        "timeAgo": "now",
        "title": f"Live: {task.params['title']} — bench draft",
        "content": f"Body draft: {task.params['body']}",
        "upvotes": "1",
        "comments": "0",
    }
    await _dispatch(env, "reddit", "createPost", [post])


async def _drive_add_comment_to_post(env, task):
    await _dispatch(env, "reddit", "addComment", [
        str(task.params["post_id"]), str(task.params["comment"]),
    ])


async def _drive_delete_seeded_own_comment(env, _task):
    await _dispatch(env, "reddit", "deleteOwnComment", ["bench_seed_comment_delete_1"])


async def _drive_send_chat_message(env, task):
    await _dispatch(env, "reddit", "sendChatMessage", [
        str(task.params["username"]), str(task.params["message"]),
    ])


async def _drive_delete_seeded_chat_message(env, task):
    state = await _read_state(env)
    username = task.params["username"]
    seed = str(task.params["seed_message"]).strip()
    msgs = state["chatThreads"].get(username, [])
    target = next(
        (m for m in msgs if m.get("from") == "me" and str(m.get("body", "")).strip() == seed),
        None,
    )
    assert target, f"no from=me message matching {seed!r} in chatThreads[{username}]"
    await _dispatch(env, "reddit", "deleteChatMessage", [username, target["id"]])


async def _drive_upvote_any_comment(env, _task):
    # voteComment uses the composite key "postId:commentId". Pick the first
    # fixture comment we can find — the judge accepts any new upvote.
    target = next(
        ((str(p["id"]), str(p["commentsData"][0]["id"]))
         for p in load_reddit_posts()
         if isinstance(p.get("commentsData"), list) and p["commentsData"]),
        None,
    )
    assert target, "no fixture post has comments"
    post_id, comment_id = target
    await _dispatch(env, "reddit", "voteComment", [f"{post_id}:{comment_id}", "up"])


async def _drive_edit_seeded_own_comment(env, task):
    await _dispatch(env, "reddit", "editComment", [
        "bench_seed_comment_edit_1", str(task.params["new_comment"]),
    ])


async def _drive_update_profile_bio(env, task):
    state = await _read_state(env)
    user = state["user"]
    # Mirror EditProfilePage.handleSave: keep current username/avatar/banner.
    await _dispatch(env, "reddit", "saveProfile", [{
        "username": user["username"],
        "bio": str(task.params["bio"]),
        "bannerImage": user.get("bannerImage", "") or "",
        "avatarImage": user.get("avatar", "") or "",
    }])


async def _drive_delete_seeded_own_post(env, task):
    state = await _read_state(env)
    user_post_ids = state["user"]["postIds"]
    posts = state["posts"]
    seed_title = str(task.params["seed_title"])
    target_id = next(
        (pid for pid in user_post_ids
         if isinstance(posts.get(pid), dict) and posts[pid].get("title") == seed_title),
        None,
    )
    assert target_id, f"no user post titled {seed_title!r}"
    await _dispatch(env, "reddit", "deleteOwnPost", [target_id])


async def _drive_deep_thread_reply_and_delete(env, task):
    username = str(task.params["username"])
    source_id = task.params.get("thread_source_message_id")
    delete_id = task.params.get("delete_message_id")
    if not source_id or not delete_id:
        state = await _read_state(env)
        thread = state["chatThreads"].get(username, [])
        if not source_id:
            source_id = next(m["id"] for m in thread if m.get("from") == "them")
        if not delete_id:
            delete_id = next(m["id"] for m in thread if m.get("from") == "me")
    await _dispatch(env, "reddit", "sendChatReply", [
        username, str(source_id), str(task.params["reply"]),
    ])
    await _dispatch(env, "reddit", "deleteChatMessage", [username, str(delete_id)])


# ── parametrized matrix ───────────────────────────────────────────────

# (test_id, task_cls, positive_driver). Negative is always _noop.
TASKS: list[tuple[str, type[BaseTask], Driver]] = [
    ("DisableCommunityThemes", reddit_tasks.Reddit_DisableCommunityThemes, _drive_disable_community_themes),
    ("AdvancedPrivacyToggles", reddit_tasks.Reddit_AdvancedPrivacyToggles, _drive_advanced_privacy_toggles),
    ("TurnOffMatureContentButKeepUnblurred", reddit_tasks.Reddit_TurnOffMatureContentButKeepUnblurred, _drive_turn_off_mature_keep_unblurred),
    ("OpenLinksOutsideApp", reddit_tasks.Reddit_OpenLinksOutsideApp, _drive_open_links_outside_app),
    ("JoinCommunityFromFeed", reddit_tasks.Reddit_JoinCommunityFromFeed, _drive_join_community_from_feed),
    ("UpvoteSpecificFeedPost", reddit_tasks.Reddit_UpvoteSpecificFeedPost, _drive_upvote_specific_feed_post),
    ("CreatePostToCommunity", reddit_tasks.Reddit_CreatePostToCommunity, _drive_create_post_to_community),
    ("AddCommentToPost", reddit_tasks.Reddit_AddCommentToPost, _drive_add_comment_to_post),
    ("DeleteSeededOwnComment", reddit_tasks.Reddit_DeleteSeededOwnComment, _drive_delete_seeded_own_comment),
    ("SendChatMessage", reddit_tasks.Reddit_SendChatMessage, _drive_send_chat_message),
    ("DeleteSeededChatMessage", reddit_tasks.Reddit_DeleteSeededChatMessage, _drive_delete_seeded_chat_message),
    ("UpvoteAnyComment", reddit_tasks.Reddit_UpvoteAnyComment, _drive_upvote_any_comment),
    ("EditSeededOwnComment", reddit_tasks.Reddit_EditSeededOwnComment, _drive_edit_seeded_own_comment),
    ("UpdateProfileBio", reddit_tasks.Reddit_UpdateProfileBio, _drive_update_profile_bio),
    ("DeleteSeededOwnPost", reddit_tasks.Reddit_DeleteSeededOwnPost, _drive_delete_seeded_own_post),
    ("DeepThreadReplyAndDeleteSeedMessage", reddit_tasks.Reddit_DeepThreadReplyAndDeleteSeedMessage, _drive_deep_thread_reply_and_delete),
]

_TASK_IDS = [t[0] for t in TASKS]


@pytest.mark.parametrize("name,task_cls,drive", TASKS, ids=_TASK_IDS)
async def test_positive(env: MobileGymEnv, name: str, task_cls: type[BaseTask], drive: Driver):
    res = await _run(env, task_cls(), drive)
    assert res.passed, f"[{name}] positive must pass (success+clean):\n{_format(res)}"


@pytest.mark.parametrize("name,task_cls,_drive", TASKS, ids=_TASK_IDS)
async def test_negative(env: MobileGymEnv, name: str, task_cls: type[BaseTask], _drive: Driver):
    res = await _run(env, task_cls(), _noop)
    assert not res.success, f"[{name}] negative (no action) must fail check_goals:\n{_format(res)}"
