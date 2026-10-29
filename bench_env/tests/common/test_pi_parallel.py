from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from bench_env.mcp import run_pi_parallel
from bench_env.runner.base import EpisodeResult, ExecutionResult
from bench_env.task.judge import JudgeResult


@pytest.mark.asyncio
async def test_parallel_pi_aggregation_and_failed_worker_preserve_all_five_results(tmp_path, monkeypatch):
    selection = tmp_path / "selection.json"
    tasks = [{"id": f"demo.task{i}", "difficulty": "L2", "budget": 30, "apps": []} for i in range(5)]
    selection.write_text(json.dumps({"selection_seed": 7, "parameter_seed": 42, "tasks": tasks}))
    started = []
    all_started = asyncio.Event()

    class Process:
        returncode = None

        def __init__(self, index):
            self.pid = 1_000_000 + index
            self.index = index

        async def wait(self):
            # None can finish until all five workers have been dispatched.
            await asyncio.wait_for(all_started.wait(), 5)
            self.returncode = 2 if self.index == 2 else 0
            return self.returncode

    async def spawn(*command, **kwargs):
        index = len(started)
        child = Path(command[command.index("--run-dir") + 1])
        task_file = Path(command[command.index("--task-file") + 1])
        task_id = task_file.read_text().strip()
        assert kwargs["start_new_session"] is True
        started.append(child)
        if index != 2:
            child.mkdir(parents=True)
            result = EpisodeResult(
                task_id=task_id, task_name="offline fixture", suite="demo", max_steps=30,
                execution=ExecutionResult(steps=1, trace=[], runtime_s=1, finished=True,
                                          truncated=False, stop_reason="COMPLETE"),
                judge=JudgeResult.ok(),
            )
            (child / "results.jsonl").write_text(json.dumps(result.to_dict()) + "\n")
            trajectory = child / "trajectory" / task_id.replace(".", "_")
            trajectory.mkdir(parents=True)
            (trajectory / "trajectory.json").write_text("[]")
        if len(started) == 5:
            all_started.set()
        return Process(index)

    monkeypatch.setattr(run_pi_parallel.asyncio, "create_subprocess_exec", spawn)
    monkeypatch.setattr(run_pi_parallel.os, "killpg", lambda *_args: None)
    directory = tmp_path / "batch"
    await run_pi_parallel.run(SimpleNamespace(
        run_dir=directory, selection=selection, parallel=5, model="offline-test",
        reasoning_effort="medium", env_url="http://127.0.0.1:1",
    ))
    rows = [json.loads(line) for line in (directory / "results.jsonl").read_text().splitlines()]
    assert len(started) == len(set(started)) == len(rows) == 5
    assert sum(r["is_success"] for r in rows) == 4
    assert sum(r["is_error"] for r in rows) == 1
    assert {r["id"] for r in rows} == {t["id"] for t in tasks}
    assert len(list((directory / "trajectory").iterdir())) == 4
    assert all(p.is_symlink() and p.exists() for p in (directory / "trajectory").iterdir())
    summary = json.loads((directory / "summary.json").read_text())
    assert summary["total_episodes"] == 5 and summary["error"] == 1
