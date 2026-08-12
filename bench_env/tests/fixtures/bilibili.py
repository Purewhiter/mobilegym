"""Shared Bilibili base-state fixtures (extracted from tests/bilibili/test_tasks.py)."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from bench_env.task.bilibili.app import Bilibili


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "apps" / "Bilibili" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _make_base_state() -> dict[str, Any]:
    state = copy.deepcopy(_load_defaults())
    state["recommendedUp"] = [
        {"id": "800000064982", "name": "_拾光记录者_"},
        {"id": "800000001054", "name": "流光视界"},
    ]
    state["activeVideoId"] = None
    return state


BASE_STATE = _make_base_state()


def _sanlian_video(state: dict[str, Any], title: str) -> None:
    video_id = Bilibili.bvid_from_title(title)
    state["activeVideoId"] = video_id
    liked = state["user"]["likedVideoIds"]
    disliked = state["user"]["dislikedVideoIds"]
    coined_coins = state["user"].setdefault("coinedVideoCoins", {})
    if video_id not in liked:
        liked.append(video_id)
    state["user"]["dislikedVideoIds"] = [item for item in disliked if item != video_id]
    existing = coined_coins.get(video_id, 0)
    if existing < 2:
        coined_coins[video_id] = existing + 1
        state["user"]["coins"] -= 1
    for folder in state["user"]["favoritesFolders"]:
        if folder["id"] == "fav_default" and video_id not in folder["videoIds"]:
            folder["videoIds"].append(video_id)
