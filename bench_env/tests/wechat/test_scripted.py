"""Live scripted-plan verification for the WeChat suite.

Run against the gateway:
    pytest bench_env/tests/wechat/test_scripted.py --sim-url https://localhost:4180
"""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.wechat import tasks as wechat_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "wechat"

# (ClassName, factory). One entry per task in the suite; the factory's params
# must match placeholders used by that task's plan in scripted_plans.py.
SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("OpenRadarAddFriend", lambda: wechat_tasks.OpenRadarAddFriend()),
    ("OpenNewFriends", lambda: wechat_tasks.OpenNewFriends()),
    ("OpenBlacklist", lambda: wechat_tasks.OpenBlacklist()),
    ("ToggleFriendConfirmation", lambda: wechat_tasks.ToggleFriendConfirmation(toggle=False)),
    ("ToggleWechatSports", lambda: wechat_tasks.ToggleWechatSports(toggle=True)),
    ("ToggleDiscoverEntry", lambda: wechat_tasks.ToggleDiscoverEntry(entry="moments", toggle=False)),
    ("ToggleMobileAutoPlayMomentsVideo", lambda: wechat_tasks.ToggleMobileAutoPlayMomentsVideo(toggle=False)),
    ("SetAddMeSearch", lambda: wechat_tasks.SetAddMeSearch()),
    ("SetMomentsVisibleRange", lambda: wechat_tasks.SetMomentsVisibleRange(range="最近半年")),
    ("ToggleStrangerViewMoments", lambda: wechat_tasks.ToggleStrangerViewMoments(toggle=False)),
    ("DisableWechatSportsLeaderboard", lambda: wechat_tasks.DisableWechatSportsLeaderboard()),
    ("EnableDarkMode", lambda: wechat_tasks.EnableDarkMode()),
    ("SetPatText", lambda: wechat_tasks.SetPatText(text="并笑了一下")),
    ("PostMomentsText", lambda: wechat_tasks.PostMomentsText(content="脚本朋友圈")),
    (
        "PostMomentsTextWithCity",
        lambda: wechat_tasks.PostMomentsTextWithCity(content="脚本定位朋友圈", location="北京市"),
    ),
    (
        "ScenicPhotoToMomentsWithPhrase",
        lambda: wechat_tasks.ScenicPhotoToMomentsWithPhrase(
            time_hint="上周",
            place_name="颐和园万寿山",
            required_phrase="春天真好",
        ),
    ),
    ("ReadMyWxid", lambda: wechat_tasks.ReadMyWxid()),
    ("SetSignature", lambda: wechat_tasks.SetSignature(text="享受每一天")),
    ("BlacklistContact", lambda: wechat_tasks.BlacklistContact(contact="刘浪")),
    ("DeauthorizeApp", lambda: wechat_tasks.DeauthorizeApp(app_name="拼多多")),
    ("ReadContactRegion", lambda: wechat_tasks.ReadContactRegion(contact="blank.")),
    ("SetFriendChatOnly", lambda: wechat_tasks.SetFriendChatOnly(contact="blank.")),
    ("ReadStepsLeaderboardTop", lambda: wechat_tasks.ReadStepsLeaderboardTop()),
    (
        "ConditionalReplyToBoss",
        lambda: wechat_tasks.ConditionalReplyToBoss(
            keyword="项目进度",
            yes_reply="上次的项目一切顺利",
            no_reply="项目进展正常",
        ),
    ),
    ("PostMomentFromChat", lambda: wechat_tasks.PostMomentFromChat(contact="张伟")),
    ("StarAndRestrictFriend", lambda: wechat_tasks.StarAndRestrictFriend(contact="blank.")),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(wechat_tasks)
    missing = declared - covered
    assert not missing, f"WeChat tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_wechat_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
