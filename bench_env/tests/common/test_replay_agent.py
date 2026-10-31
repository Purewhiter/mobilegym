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


def test_recorded_start_times_prefer_boot_time(tmp_path):
    from bench_env.agent.replay import recorded_start_times

    for name, task_id, meta_extra in (
        ("a_New", "a.New", {"sim_boot_time": 1793367062000}),
        ("a_Old", "a.Old", {}),
    ):
        episode = tmp_path / "trajectory" / name
        episode.mkdir(parents=True)
        (episode / "meta.json").write_text(
            json.dumps({"task_id": task_id, "task_name": name, **meta_extra}), encoding="utf-8"
        )
    (tmp_path / "results.jsonl").write_text(
        json.dumps({"id": "a.New", "start_time": "2026-10-30T21:31:05.1"}) + "\n"
        + json.dumps({"id": "a.Old", "start_time": "2026-10-30T21:38:41.649764"}) + "\n",
        encoding="utf-8",
    )

    assert recorded_start_times(tmp_path) == {"a.New": 1793367062000, "a.Old": "2026-10-30T21:38:41"}
    assert recorded_start_times(tmp_path / "trajectory") == recorded_start_times(tmp_path)


def test_sim_time_defaults_and_episode_url(tmp_path, monkeypatch):
    from types import SimpleNamespace

    from bench_env.env.mobile_gym import MobileGymEnv
    from bench_env.factory import resolve_sim_time

    assert resolve_sim_time(SimpleNamespace(agent="generic_v2", sim_time=None)) is None
    assert resolve_sim_time(SimpleNamespace(agent="generic_v2", sim_time="2026-01-04 20:00")) == "2026-01-04 20:00"
    with pytest.raises(ValueError):
        resolve_sim_time(SimpleNamespace(agent="generic_v2", sim_time="tomorrow"))
    monkeypatch.delenv(REPLAY_DIR_ENV, raising=False)
    with pytest.raises(ValueError, match=REPLAY_DIR_ENV):
        resolve_sim_time(SimpleNamespace(agent="replay", sim_time=None))

    env = MobileGymEnv(url="http://127.0.0.1:9", sim_time={"a.New": 1793367062000})
    env.begin_episode("a.New")
    assert env._page_url() == "http://127.0.0.1:9?simTime=1793367062000"
    env.begin_episode("a.Missing")
    assert env._page_url() == "http://127.0.0.1:9"
