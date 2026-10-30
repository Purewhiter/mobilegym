"""
Device server records vs the Python judge's view layer.

RedBook's data lives in the device server, which merges likes, collects,
follows and comments into final ``notes`` / ``users`` records. The Python
judge still re-derives the same view from ``__SIM__.getState()`` plus the base
JSON (``Redbook.view_note`` / ``view_user``). After a burst of real store
actions, both must agree on every touched record — the evidence that judges
can read device records instead of keeping their own merge code.

Requires the dev server at ``--sim-url``. Skip with ``pytest -m 'not live'``.
"""

from __future__ import annotations

import json

import pytest

from bench_env.env.device_client import DeviceClient
from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.redbook.app import Redbook


pytestmark = [pytest.mark.live, pytest.mark.asyncio(loop_scope="session")]

# Asset URLs differ by design (the device resolves CDN paths, base JSON keeps
# raw ones); every other field must match.
_URL_FIELDS = {"images", "cover", "video", "videoUrl", "avatar", "userCover"}


async def _dispatch(env: MobileGymEnv, action: str, *args) -> None:
    await env.page.evaluate(
        """async ([action, args]) => {
            await window.__BENCH_STORES__.get('redbook').getState()[action](...args);
        }""",
        [action, list(args)],
    )


def _comparable(record: dict | None) -> dict | None:
    if record is None:
        return None
    out = {k: v for k, v in record.items() if k not in _URL_FIELDS}
    if isinstance(out.get("commentList"), list):
        out["commentList"] = [
            {k: v for k, v in c.items() if k not in _URL_FIELDS} for c in out["commentList"]
        ]
    return json.loads(json.dumps(out, sort_keys=True))


async def test_device_records_match_python_view(env: MobileGymEnv):
    await env.reset(app_ids=["redbook"])
    device = await DeviceClient.for_env(env)

    feed = device.query("redbook", "feed", {"limit": 8})["items"]
    ids = [n["id"] for n in feed if n.get("category")][:4]
    authors = sorted({n["authorId"] for n in feed if n["authorId"] != "redbook_user_001"})[:2]
    commented = next(n for n in feed if n.get("commentList"))
    base_comment_id = commented["commentList"][0]["id"]

    await _dispatch(env, "toggleLike", ids[0])
    await _dispatch(env, "toggleLike", ids[1])
    await _dispatch(env, "toggleLike", ids[1])  # liked then unliked
    await _dispatch(env, "toggleCollect", ids[2])
    await _dispatch(env, "addComment", ids[3], "device consistency")
    await _dispatch(env, "toggleCommentLike", commented["id"], base_comment_id)
    for author in authors:
        await _dispatch(env, "followUser", author)
    await _dispatch(env, "addNote", {"title": "Device note", "content": "body", "images": []})

    state = (await env.get_state(required_apps=["redbook"]))["apps"]["redbook"]
    rb = Redbook(state)
    published = rb.user["publishedNoteIds"][0]

    for note_id in {*ids, commented["id"], published}:
        record = device.record("redbook", "notes", note_id)
        assert record is not None, note_id
        assert _comparable(record) == _comparable(rb.view_note(note_id)), note_id
    for user_id in [*authors, rb.user_id]:
        record = device.record("redbook", "users", user_id)
        assert record is not None, user_id
        assert _comparable(record) == _comparable(rb.view_user(user_id)), user_id

    # Spot-check that the actions really landed in the records.
    before = {n["id"]: n for n in feed}
    assert device.record("redbook", "notes", ids[0])["likes"] == before[ids[0]]["likes"] + 1
    assert device.record("redbook", "notes", ids[3])["commentList"][0]["content"] == "device consistency"

    # The page mirror and the device export are the same state.
    assert device.state("redbook") == {k: v for k, v in state.items() if k != "_temp"}
