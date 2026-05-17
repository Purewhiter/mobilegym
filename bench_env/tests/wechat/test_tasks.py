"""
Focused WeChat task tests.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from bench_env.task.wechat import tasks as _tasks_module
from bench_env.tests.conftest import make_judge_input
from bench_env.tests.weather.test_tasks import TEST_OS_STATE


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_ROUTE = {"app": "launcher", "path": "/"}


def _load_json(*parts: str) -> dict[str, Any]:
    return json.loads(ROOT.joinpath(*parts).read_text(encoding="utf-8"))


WECHAT_BASE_STATE = _load_json("apps", "Wechat", "data", "defaults.json")


def _make_input(
    init_wechat: dict[str, Any],
    curr_wechat: dict[str, Any],
):
    os_state = {"time": copy.deepcopy(TEST_OS_STATE["time"]), "providers": {}}
    return make_judge_input(
        {"apps": {"wechat": init_wechat}, "os": os_state},
        {"apps": {"wechat": curr_wechat}, "os": os_state},
        route=DEFAULT_ROUTE,
    )


def _append_wechat_moment(state: dict[str, Any], content: str, *, images: list[str] | None = None) -> None:
    state["moments"].insert(
        0,
        {
            "id": f"mo_test_{len(state['moments']) + 1}",
            "wxid": state["user"]["wxid"],
            "userName": state["user"]["name"],
            "userAvatar": state["user"]["avatar"],
            "content": content,
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
            "images": list(images or []),
        },
    )


def test_scenic_photo_to_moments_with_phrase_positive():
    task = _tasks_module.ScenicPhotoToMomentsWithPhrase(
        time_hint="上周",
        place_name="颐和园万寿山",
        required_phrase="春天真好",
    )
    init_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_moment(
        curr_wechat,
        "上周拍的颐和园万寿山，春天真好",
        images=[task.p._photo_path],
    )
    checks = task.check_goals(_make_input(init_wechat, curr_wechat))
    assert all(check["passed"] for check in checks), checks


def test_scenic_photo_to_moments_with_phrase_negative():
    task = _tasks_module.ScenicPhotoToMomentsWithPhrase(
        time_hint="上周",
        place_name="颐和园万寿山",
        required_phrase="春天真好",
    )
    init_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    curr_wechat = copy.deepcopy(WECHAT_BASE_STATE)
    _append_wechat_moment(
        curr_wechat,
        "上周拍的颐和园万寿山，春天真好",
        images=["/sdcard/DCIM/Camera/IMG_other.jpg"],
    )
    checks = task.check_goals(_make_input(init_wechat, curr_wechat))
    assert any(check["passed"] is False for check in checks), checks
