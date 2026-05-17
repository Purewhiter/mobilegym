"""
Live judge verification for X tasks.

Drives real Zustand actions via ``window.__BENCH_STORES__`` (exposed in
dev mode) and asserts ``task.evaluate()`` agrees with the action result.
This catches state.ts ↔ judge desync (e.g. addPost forgot to bump
``user.postIds`` and the judge assumed it did) that offline ``test_x.py``
cannot reach because offline fixtures construct state by hand.

Requires the Vite dev server running at ``--sim-url`` (default
``http://localhost:3000``). Skip with ``pytest -m 'not live'``.

Coverage: 11 X tasks × {positive, negative} = 22 tests.
"""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable

import pytest

from bench_env.env.base import Observation
from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput, JudgeResult
from bench_env.task.x import tasks as x_tasks
from bench_env.task.x.app import _load_posts_json as load_x_posts


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


async def _read_state(env: MobileGymEnv) -> dict[str, Any]:
    state = await env.get_state(required_apps=["x"])
    return state["apps"]["x"]


def _find_post_by_keyword(keyword: str) -> dict[str, Any]:
    """Find a base post containing the keyword (case-insensitive) in content."""
    kw = keyword.lower()
    for post in load_x_posts():
        if not isinstance(post, dict):
            continue
        if kw in str(post.get("content") or "").lower():
            return post
    raise AssertionError(f"no fixture post containing keyword {keyword!r}")


def _find_post_by_author(user_id: str) -> dict[str, Any]:
    """Find first base post by the given author id."""
    for post in load_x_posts():
        if isinstance(post, dict) and str(post.get("authorId")) == user_id:
            return post
    raise AssertionError(f"no fixture post authored by {user_id!r}")


# ── per-task drivers (positive case = the canonical "correct" action) ─

async def _drive_set_audience_privacy(env, task):
    await _dispatch(env, "x", "updateSettings", [{
        "privatePosts": bool(task.params["private_posts"]),
        "protectVideos": bool(task.params["protect_videos"]),
        "photoTagging": bool(task.params["photo_tagging"]),
    }])


async def _drive_set_call_permissions(env, _task):
    await _dispatch(env, "x", "updateSettings", [{
        "enableAvCalls": True,
        "allowCallFromFollowing": True,
        "allowCallFromVerified": True,
        "allowCallFromLogs": False,
    }])


async def _drive_set_push_notification_mix(env, _task):
    # criteria 要求 prefRecommend=False; fromXRecommend 同名 ambiguous 字段进 allowlist,
    # 这里只改 criteria 必须的那个, 模拟"用户只关一个推荐"也 pass 的语义。
    await _dispatch(env, "x", "updateSettings", [{
        "prefRecommend": False,
        "fromXAlert": True,
        "proNotify": True,
    }])


async def _drive_complex_settings_chain(env, _task):
    await _dispatch(env, "x", "updateSettings", [{
        "showInteractionCounts": True,
        "showLocalContent": False,
        "onlyImportant": True,
        "pushOnlyDm": True,
        "prefRecommend": False,
    }])


async def _drive_quote_post_and_tweet(env, task):
    # addPost(content, image?, quotedPostId?) — 第 3 个参数承载引用关系。
    await _dispatch(env, "x", "addPost", [
        str(task.params["content"]),
        None,
        str(task.params["post_id"]),
    ])


async def _drive_send_dm_to_conversation(env, task):
    await _dispatch(env, "x", "sendMessage", [
        str(task.params["conversation_id"]),
        str(task.params["content"]),
    ])


async def _drive_search_and_bookmark(env, task):
    target = _find_post_by_keyword(str(task.params["keyword"]))
    await _dispatch(env, "x", "toggleBookmark", [str(target["id"])])


async def _drive_follow_user_and_like_their_post(env, task):
    # handle 形态 "@xxx"; user.id 是不带 @ 的。
    user_id = str(task.params["user_handle"]).lstrip("@")
    target = _find_post_by_author(user_id)
    await _dispatch(env, "x", "toggleFollow", [user_id])
    await _dispatch(env, "x", "toggleLike", [str(target["id"])])


async def _drive_reply_and_retweet_same_post(env, task):
    post_id = str(task.params["post_id"])
    await _dispatch(env, "x", "addReply", [post_id, str(task.params["reply_content"])])
    await _dispatch(env, "x", "toggleRetweet", [post_id])


async def _drive_search_multiple_keywords_and_interact(env, task):
    target_like = _find_post_by_keyword(str(task.params["keyword1"]))
    target_bookmark = _find_post_by_keyword(str(task.params["keyword2"]))
    await _dispatch(env, "x", "toggleLike", [str(target_like["id"])])
    await _dispatch(env, "x", "toggleBookmark", [str(target_bookmark["id"])])


async def _drive_post_with_image_and_reply(env, task):
    # 发新帖, 再取出实际生成的 new_xxx id (addPost 用 timeNow() 生成), addReply 回帖自己。
    state_before = await _read_state(env)
    before_ids = set(state_before["user"].get("postIds", []))

    await _dispatch(env, "x", "addPost", [str(task.params["content"])])

    state_after = await _read_state(env)
    after_ids = set(state_after["user"].get("postIds", []))
    new_ids = after_ids - before_ids
    assert new_ids, "addPost did not append to user.postIds"
    new_post_id = next(iter(new_ids))

    await _dispatch(env, "x", "addReply", [new_post_id, str(task.params["reply_content"])])


# ── parametrized matrix ───────────────────────────────────────────────

# (test_id, task_cls, positive_driver). Negative is always _noop.
TASKS: list[tuple[str, type[BaseTask], Driver]] = [
    ("SetAudiencePrivacyBundle", x_tasks.SetAudiencePrivacyBundle, _drive_set_audience_privacy),
    ("SetCallPermissionsBundle", x_tasks.SetCallPermissionsBundle, _drive_set_call_permissions),
    ("SetPushNotificationMix", x_tasks.SetPushNotificationMix, _drive_set_push_notification_mix),
    ("ComplexSettingsChain", x_tasks.ComplexSettingsChain, _drive_complex_settings_chain),
    ("QuotePostAndTweet", x_tasks.QuotePostAndTweet, _drive_quote_post_and_tweet),
    ("SendDmToConversation", x_tasks.SendDmToConversation, _drive_send_dm_to_conversation),
    ("SearchAndBookmark", x_tasks.SearchAndBookmark, _drive_search_and_bookmark),
    ("FollowUserAndLikeTheirPost", x_tasks.FollowUserAndLikeTheirPost, _drive_follow_user_and_like_their_post),
    ("ReplyAndRetweetSamePost", x_tasks.ReplyAndRetweetSamePost, _drive_reply_and_retweet_same_post),
    ("SearchMultipleKeywordsAndInteract", x_tasks.SearchMultipleKeywordsAndInteract, _drive_search_multiple_keywords_and_interact),
    ("PostWithImageAndReply", x_tasks.PostWithImageAndReply, _drive_post_with_image_and_reply),
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
