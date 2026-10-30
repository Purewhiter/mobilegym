"""Offline tests for ReplayAgent: recorded responses come back as the same actions."""

from __future__ import annotations

import json

import pytest

from bench_env.agent.replay import REPLAY_DIR_ENV, ReplayAgent
from bench_env.env.base import ActionType, Observation


def _record(root, name: str, instruction: str, responses: list[str]) -> None:
    episode = root / "trajectory" / name
    episode.mkdir(parents=True)
    (episode / "meta.json").write_text(json.dumps({"task_name": instruction}), encoding="utf-8")
    for i, text in enumerate(responses, start=1):
        (episode / f"step_{i:03d}_response.txt").write_text(text, encoding="utf-8")


def _answer(payload: dict) -> str:
    return f"<think>t</think>\n<ANSWER>\n{json.dumps(payload)}\n</ANSWER>"


def test_replays_recorded_actions_then_aborts(tmp_path, monkeypatch):
    _record(tmp_path, "wechat_A", "打开微信", [
        _answer({"action": "CLICK", "point": [500, 300]}),
        _answer({"action": "SWIPE", "point1": [500, 700], "point2": [500, 300]}),
    ])
    monkeypatch.setenv(REPLAY_DIR_ENV, str(tmp_path))
    agent = ReplayAgent()
    agent.reset("打开微信")

    first = agent.act(Observation(step_idx=0))
    second = agent.act(Observation(step_idx=1))
    third = agent.act(Observation(step_idx=2))

    assert first.action_type == ActionType.CLICK and first.data["point"] == [500, 300]
    assert second.action_type == ActionType.SWIPE
    assert third.action_type == ActionType.ABORT


def test_unknown_instruction_is_an_error(tmp_path, monkeypatch):
    _record(tmp_path, "wechat_A", "打开微信", [_answer({"action": "BACK"})])
    monkeypatch.setenv(REPLAY_DIR_ENV, str(tmp_path / "trajectory"))
    agent = ReplayAgent()
    with pytest.raises(ValueError, match="no recording"):
        agent.reset("打开支付宝")
