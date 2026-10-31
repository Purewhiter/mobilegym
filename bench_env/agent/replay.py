"""Replay agent: re-issues the actions of a recorded GenericAgentV2 run.

Point ``MOBILE_GYM_REPLAY_DIR`` at a run's ``trajectory/`` directory (or the
run directory itself). For each episode the agent finds the recording whose
instruction matches, then returns the recorded model responses one per step,
parsed by GenericAgentV2's own parser — so the environment sees exactly the
actions the model produced, without calling a model.

Used for differential testing: record once with a real model, replay the
same trajectories against two simulator builds, and compare per-step
screenshots and final judge results. Failed trajectories are as useful as
successful ones — they still exercise real UI paths.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from bench_env.agent.base import AgentConfig, AgentStepRecord
from bench_env.agent.generic_v2 import GenericAgentV2
from bench_env.env.base import Action, ActionType, Observation

REPLAY_DIR_ENV = "MOBILE_GYM_REPLAY_DIR"


def _recorded_metas(root: Path) -> list[tuple[dict, Path]]:
    """Every recorded episode's meta.json and directory, lowest trial first."""
    trajectory_root = root / "trajectory" if (root / "trajectory").is_dir() else root
    metas = []
    for meta_path in sorted(trajectory_root.glob("*/meta.json")):
        metas.append((json.loads(meta_path.read_text(encoding="utf-8")), meta_path.parent))
    return sorted(metas, key=lambda m: int(m[0].get("trial_id") or 0))


def _index_recordings(root: Path) -> dict[str, Path]:
    """Map each recorded instruction to its trajectory directory (its lowest trial)."""
    index: dict[str, Path] = {}
    for meta, directory in _recorded_metas(root):
        index.setdefault(str(meta["task_name"]), directory)
    return index


def recorded_start_times(root: Path) -> dict[str, int | str]:
    """Map each recorded task id to the simulated time its episode booted at.

    Newer recordings store ``sim_boot_time`` (epoch ms) in each trajectory's
    meta.json; older ones ran on real time, so their episode ``start_time``
    from results.jsonl is the closest stand-in. Like the replayed actions
    (``_index_recordings``), each task uses its lowest trial.
    """
    trajectory_root = root / "trajectory" if (root / "trajectory").is_dir() else root
    run_root = trajectory_root.parent if trajectory_root.name == "trajectory" else root
    times: dict[str, int | str] = {}
    for meta, _ in _recorded_metas(root):
        if isinstance(meta.get("sim_boot_time"), int):
            times.setdefault(str(meta["task_id"]), meta["sim_boot_time"])
    results = run_root / "results.jsonl"
    if results.is_file():
        records = [json.loads(line) for line in results.read_text(encoding="utf-8").splitlines() if line.strip()]
        for record in sorted(records, key=lambda r: int(r.get("trial_id") or 0)):
            start = record.get("start_time")
            if record.get("id") and isinstance(start, str):
                times.setdefault(str(record["id"]), start.split(".")[0])
    return times


class ReplayAgent(GenericAgentV2):
    def __init__(self, llm=None, config: Optional[AgentConfig] = None):
        super().__init__(llm=llm, config=config)
        root = os.environ.get(REPLAY_DIR_ENV)
        if not root:
            raise ValueError(f"ReplayAgent needs {REPLAY_DIR_ENV} pointing at a recorded run")
        self._recordings = _index_recordings(Path(root))
        self._responses: list[str] = []
        self._cursor = 0

    @property
    def name(self) -> str:
        return "ReplayAgent"

    def reset(self, task: str) -> None:
        super().reset(task)
        recording = self._recordings.get(task)
        if recording is None:
            raise ValueError(f"no recording for instruction: {task[:80]}")
        steps = sorted(recording.glob("step_*_response.txt"))
        self._responses = [p.read_text(encoding="utf-8") for p in steps]
        self._cursor = 0

    def act(self, obs: Observation) -> Action:
        index = self._cursor
        self._cursor += 1
        if index >= len(self._responses):
            # The recording ended here (max steps or a crash); stop rather than improvise.
            action = Action(ActionType.ABORT, {"value": "replay: recording exhausted"})
            response = ""
        else:
            response = self._responses[index]
            action = self.parse_response(response)
        self._history.append(AgentStepRecord(
            step_idx=obs.step_idx, observation=obs, action=action, llm_response=response,
        ))
        self._evict_old_records(keep_recent=2)
        return action
