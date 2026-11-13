"""Shared task selection and completion checks for MCP launchers."""

from __future__ import annotations

import json
from pathlib import Path

from bench_env import factory
from bench_env.config import RunnerConfig
from bench_env.mcp.protocol import BATCH_FINISHED, BATCH_STATUS_FILE
from bench_env.metrics import result_is_error


def read_task_ids(path: Path, limit: int | None) -> list[str]:
    if limit is not None and limit < 1:
        raise ValueError("--limit must be positive")
    task_ids = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")][:limit]
    if not task_ids or len(task_ids) != len(set(task_ids)):
        raise ValueError("Task selection must be non-empty and unique")
    return task_ids


def describe_tasks(task_ids: list[str], seed: int) -> list[dict]:
    if not task_ids or any(not isinstance(task_id, str) or not task_id for task_id in task_ids):
        raise ValueError("Task selection must contain task IDs")
    if len(task_ids) != len(set(task_ids)):
        raise ValueError("Task selection must contain distinct tasks")
    config = RunnerConfig(agent="generic_v2", model_name=None, split="test", task_ids=task_ids,
                          sample_seed=seed, eval_mode="grounded")
    tasks = {task.id: task for task in factory.load_tasks(config)}
    unknown = set(task_ids) - tasks.keys()
    if unknown:
        raise ValueError(f"Unknown or filtered tasks: {sorted(unknown)}")
    return [{"id": task_id, "difficulty": tasks[task_id].difficulty,
             "budget": config.get_max_steps(tasks[task_id]), "apps": list(tasks[task_id].apps)}
            for task_id in task_ids]


def read_results(run_dir: Path) -> list[dict]:
    path = run_dir / "results.jsonl"
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def record_client_exit(run_dir: Path, task_ids: list[str], returncode: int,
                       *, collection_error: str | None = None, remote_run_dir: str | None = None) -> dict:
    completed = 0
    status = "incomplete"
    error = collection_error
    try:
        rows = read_results(run_dir)
        completed = sum(not result_is_error(row) for row in rows)
        status_file = run_dir / BATCH_STATUS_FILE
        if status_file.is_file():
            status = json.loads(status_file.read_text(encoding="utf-8"))["status"]
        complete = (error is None and status == BATCH_FINISHED
                    and [row["id"] for row in rows] == task_ids and completed == len(task_ids)
                    and (run_dir / "summary.json").is_file())
    except (KeyError, TypeError, ValueError, OSError) as exc:
        complete = False
        error = error or f"Could not read benchmark results: {exc}"
    report = {
        "returncode": returncode, "batch_complete": complete, "batch_status": status,
        "completed_episodes": completed, "expected_episodes": len(task_ids),
    }
    if error is not None:
        report["error"] = error
    if remote_run_dir is not None:
        report["remote_run_dir"] = remote_run_dir
    (run_dir / "client_exit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report
