from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from bench_env.mcp import run_pi_parallel
from bench_env.mcp.parallel import run_parallel
from bench_env.runner.base import EpisodeResult, ExecutionResult
from bench_env.task.judge import JudgeResult


@pytest.mark.asyncio
async def test_parallel_pi_aggregation_and_failed_worker_preserve_all_five_results(tmp_path, monkeypatch):
    selection = tmp_path / "selection.json"
    tasks = [{"id": f"demo.task{i}", "difficulty": "L2", "budget": 30, "apps": []} for i in range(5)]
    selection.write_text(json.dumps({"selection_seed": 7, "parameter_seed": 42, "tasks": tasks}))
    monkeypatch.setattr("bench_env.mcp.parallel.describe_tasks", lambda ids, seed: tasks)
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
            (child / "client_exit.json").write_text(json.dumps({"batch_complete": True}))
            trajectory = child / "trajectory" / task_id.replace(".", "_")
            trajectory.mkdir(parents=True)
            (trajectory / "trajectory.json").write_text("[]")
        if len(started) == 5:
            all_started.set()
        return Process(index)

    monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
    directory = tmp_path / "batch"
    code = await run_pi_parallel.run(SimpleNamespace(
        run_dir=directory, selection=selection, parallel=5, model="offline-test",
        reasoning_effort="medium", env_url="http://127.0.0.1:1",
    ))
    rows = [json.loads(line) for line in (directory / "results.jsonl").read_text().splitlines()]
    assert len(started) == len(set(started)) == len(rows) == 5
    assert code == 2
    assert sum(r["is_success"] for r in rows) == 4
    assert sum(r["is_error"] for r in rows) == 1
    assert {r["id"] for r in rows} == {t["id"] for t in tasks}
    assert len(list((directory / "trajectory").iterdir())) == 4
    assert all(p.is_symlink() and p.exists() for p in (directory / "trajectory").iterdir())
    summary = json.loads((directory / "summary.json").read_text())
    assert summary["total_episodes"] == 5 and summary["error"] == 1
    meta = json.loads((directory / "meta.json").read_text())
    assert meta["task_max_steps"] == {row["id"]: 30 for row in rows if not row["is_error"]}


@pytest.mark.asyncio
async def test_pi_rejects_manifest_budget_before_dispatch(tmp_path):
    selection = tmp_path / "selection.json"
    selection.write_text(json.dumps({"selection_seed": 7, "parameter_seed": 42, "tasks": [
        {"id": "clock.ToggleAlarm", "difficulty": "L1", "budget": 30},
    ]}))
    directory = tmp_path / "batch"
    with pytest.raises(ValueError, match="does not match the runner budget 15"):
        await run_pi_parallel.run(SimpleNamespace(run_dir=directory, selection=selection))
    assert not directory.exists()


@pytest.mark.asyncio
async def test_codex_retries_only_infrastructure_failures_in_fresh_sessions(tmp_path, monkeypatch):
    task_ids = ["demo.retry", "demo.abort", "demo.budget"]
    selection = {"parameter_seed": 42, "tasks": [
        {"id": task_id, "difficulty": "L2", "budget": 30} for task_id in task_ids
    ]}
    attempts = {task_id: 0 for task_id in task_ids}

    async def spawn(*command, **kwargs):
        assert "bench_env.mcp.run_codex" in command
        assert command[-2:] == ("--ssh-host", "6000")
        assert "--parallel" not in command
        assert kwargs["start_new_session"]
        child = Path(command[command.index("--run-dir") + 1])
        task_id = Path(command[command.index("--task-file") + 1]).read_text().strip()
        attempts[task_id] += 1
        lost_connection = task_id == "demo.retry" and attempts[task_id] == 1
        child.mkdir(parents=True)
        if not lost_connection:
            result = EpisodeResult(
                task_id=task_id, task_name="offline fixture", suite="demo",
                max_steps=45 if task_id == "demo.budget" else 30,
                execution=ExecutionResult(steps=1, trace=[], runtime_s=1, finished=True, truncated=False,
                                          stop_reason="ABORT" if task_id == "demo.abort" else "COMPLETE"),
                judge=JudgeResult.ok(),
            )
            (child / "results.jsonl").write_text(json.dumps(result.to_dict()) + "\n")
            (child / "client_exit.json").write_text(json.dumps({"batch_complete": True}))

        class Process:
            pid = 1_000_000

            async def wait(self):
                return 2 if lost_connection or task_id == "demo.abort" else 0

        return Process()

    monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
    directory = tmp_path / "batch"
    args = SimpleNamespace(run_dir=directory, parallel=3, model="offline-test", reasoning_effort="medium",
                           env_url="http://127.0.0.1:1", retry_errors=True)
    code = await run_parallel(args, selection, "codex", ["--ssh-host", "6000"])
    assert code == 2
    assert attempts == {"demo.retry": 2, "demo.abort": 1, "demo.budget": 1}
    rows = {r["id"]: r for r in map(json.loads, (directory / "results.jsonl").read_text().splitlines())}
    assert rows["demo.retry"]["is_success"]
    assert not rows["demo.abort"]["is_error"]
    jobs = {j["task_id"]: j for j in json.loads((directory / "jobs.json").read_text())}
    assert jobs["demo.abort"]["returncode"] == 2
    assert jobs["demo.abort"]["status"] == "completed"
    assert rows["demo.budget"]["is_error"] and rows["demo.budget"]["max_steps"] == 45
    meta = json.loads((directory / "meta.json").read_text())
    assert meta["task_max_steps"] == {"demo.retry": 30, "demo.abort": 30, "demo.budget": 45}
