"""Dispatch one fresh MCP client per task and aggregate benchmark artifacts."""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import signal
import sys

from bench_env.env.recorder import RunRecorder
from bench_env.mcp.launch import describe_tasks, read_results
from bench_env.mcp.protocol import RESPONSE_FORMAT
from bench_env.metrics import result_is_error
from bench_env.runner.base import EpisodeResult, ExecutionResult


class BudgetMismatch(ValueError):
    """The worker's configuration differs from the validated selection."""

DEFAULT_EPISODE_TIMEOUT = 1800.0


def episode_timeout(value: str) -> float:
    seconds = float(value)
    if not math.isfinite(seconds) or seconds <= 0:
        raise ValueError("episode timeout must be finite and positive")
    return seconds


async def stop_workers(processes: set[asyncio.subprocess.Process]) -> None:
    if not processes:
        return

    groups = {process.pid for process in processes}
    def signal_workers(sig: signal.Signals | int) -> None:
        for pid in tuple(groups):
            try:
                os.killpg(pid, sig)
            except ProcessLookupError:
                groups.discard(pid)

    signal_workers(signal.SIGTERM)
    deadline = asyncio.get_running_loop().time() + 5
    while groups and asyncio.get_running_loop().time() < deadline:
        signal_workers(0)
        if groups:
            await asyncio.sleep(0.05)
    signal_workers(signal.SIGKILL)
    await asyncio.gather(*(p.wait() for p in processes))

def validate_selection(selection: dict) -> dict:
    if not isinstance(selection, dict):
        raise ValueError("Selection must be an object")
    seed = selection.get("parameter_seed")
    if type(seed) is not int or type(selection.get("selection_seed")) is not int:
        raise ValueError("Selection must contain integer parameter_seed and selection_seed")
    tasks = selection.get("tasks")
    if not isinstance(tasks, list) or any(not isinstance(task, dict) for task in tasks):
        raise ValueError("Selection must contain a tasks array")
    resolved = describe_tasks([task.get("id") for task in tasks], seed)
    for requested, actual in zip(tasks, resolved):
        if type(requested.get("budget")) is not int or requested["budget"] != actual["budget"]:
            raise ValueError(f"{actual['id']} budget {requested.get('budget')!r} does not match the runner budget {actual['budget']}")
        if requested.get("difficulty") != actual["difficulty"]:
            raise ValueError(f"{actual['id']} difficulty must be {actual['difficulty']}")
    return {**selection, "tasks": [{**requested, **actual} for requested, actual in zip(tasks, resolved)]}


async def run_parallel(args, selection: dict, client: str, extra_worker_args: Sequence[str] = ()) -> int:
    root = Path(__file__).resolve().parents[2]
    directory = args.run_dir.resolve()
    if directory.exists() and any(directory.iterdir()):
        raise ValueError("--run-dir must be new or empty")
    directory.mkdir(parents=True, exist_ok=True)
    tasks = selection["tasks"]
    timeout_seconds = getattr(args, "episode_timeout", DEFAULT_EPISODE_TIMEOUT)
    with (directory / "selection.json").open("x", encoding="utf-8") as stream:
        json.dump(selection, stream, ensure_ascii=False, indent=2)
    recorder = RunRecorder(directory.parent, fixed_run_dir=directory)
    recorder.start_run(agent="GenericAgentV2", model_name=args.model, extra_meta={
        "client": client, "transport": "mcp", "response_format": RESPONSE_FORMAT,
        "parallel": args.parallel, "env_url": args.env_url, "ssh_host": getattr(args, "ssh_host", None),
        "episode_timeout": timeout_seconds,
        "reasoning_effort": args.reasoning_effort, "sample_seed": selection["parameter_seed"],
        "selection_seed": selection.get("selection_seed"), "selected_task_ids": [t["id"] for t in tasks],
        "context_policy": f"one_fresh_{client}_session_per_task",
        "isolation": "separate_python_server_browser_and_context_per_task",
        "task_max_steps": {},
    })
    semaphore = asyncio.Semaphore(args.parallel)
    attempts_allowed = 2 if getattr(args, "retry_errors", False) else 1
    jobs = [{"task_id": task["id"], "difficulty": task["difficulty"], "status": "queued", "attempts": []}
            for task in tasks]
    children: set[asyncio.subprocess.Process] = set()
    actual_budgets = {}

    def save_jobs():
        temporary = directory / ".jobs.json.tmp"
        temporary.write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(directory / "jobs.json")

    async def worker(index: int, task: dict, job: dict):
        task_id = task["id"]
        slug = task_id.replace(".", "_")
        worker_dir = directory / "episodes" / f"{index:02d}_{slug}"
        worker_dir.parent.mkdir(parents=True, exist_ok=True)
        task_file = directory / f"task_{index:02d}.txt"
        task_file.write_text(task_id + "\n", encoding="utf-8")
        row = None
        error = None
        async with semaphore:
            job.update(status="running", started_at=datetime.now(timezone.utc).isoformat())
            for attempt in range(1, attempts_allowed + 1):
                child_dir = worker_dir if attempt == 1 else worker_dir.with_name(f"{worker_dir.name}_retry{attempt - 1}")
                suffix = "" if attempt == 1 else f"_retry{attempt - 1}"
                log_path = directory / f"worker_{index:02d}{suffix}.log"
                attempt_log = {"run_dir": str(child_dir)}
                job["attempts"].append(attempt_log)
                job["run_dir"] = str(child_dir)
                save_jobs()
                row = None
                try:
                    with log_path.open("w", encoding="utf-8") as output:
                        process = await asyncio.create_subprocess_exec(
                            sys.executable, "-m", f"bench_env.mcp.run_{client}",
                            "--env-url", args.env_url, "--run-dir", str(child_dir),
                            "--task-file", str(task_file), "--limit", "1",
                            "--seed", str(selection["parameter_seed"]), "--model", args.model,
                            "--reasoning-effort", args.reasoning_effort, *extra_worker_args,
                            cwd=root, stdout=output, stderr=output, start_new_session=True,
                        )
                        children.add(process)
                        attempt_log["pid"] = process.pid
                        job["pid"] = process.pid
                        save_jobs()
                        try:
                            returncode = await asyncio.wait_for(process.wait(), timeout_seconds)
                        except TimeoutError:
                            await stop_workers({process})
                            children.discard(process)
                            attempt_log["timed_out"] = True
                            returncode = process.returncode
                        job["returncode"] = attempt_log["returncode"] = returncode
                        children.discard(process)
                    exit_path = child_dir / "client_exit.json"
                    client_exit = json.loads(exit_path.read_text(encoding="utf-8")) if exit_path.is_file() else {}
                    rows = read_results(child_dir)
                    if attempt_log.get("timed_out") and not client_exit.get("batch_complete"):
                        raise RuntimeError(f"Episode exceeded {timeout_seconds:g}s")
                    if len(rows) != 1 or rows[0].get("id") != task_id:
                        status = client_exit.get("batch_status", "incomplete")
                        raise ValueError(client_exit.get("error") or
                                         f"Expected one result for {task_id}, got {len(rows)} "
                                         f"(batch status {status}, client exit {job['returncode']})")
                    result = rows[0]
                    budget = result["max_steps"]
                    if type(budget) is not int or budget <= 0:
                        raise ValueError(f"Invalid recorded max_steps: {budget!r}")
                    attempt_log["max_steps"] = budget
                    if budget != task["budget"]:
                        raise BudgetMismatch(f"Worker used {budget} steps, expected {task['budget']}. Check the checkout and evaluation mode.")
                    if result_is_error(result):
                        row = result
                        raise RuntimeError(result["execution"].get("error") or "Episode evaluation failed")
                    if not client_exit.get("batch_complete"):
                        status = client_exit.get("batch_status", "incomplete")
                        raise RuntimeError(client_exit.get("error") or
                                           f"Batch ended with status {status} (client exit {job['returncode']})")
                    row = result
                    error = None
                    break
                except (OSError, RuntimeError, ValueError, TypeError, KeyError) as exc:
                    error = str(exc)
                    attempt_log["error"] = error
                    save_jobs()
                    if isinstance(exc, BudgetMismatch):
                        break

            if error is None:
                job.update(status="completed", success=row["is_success"], steps=row["execution"]["steps"], is_error=False)
            else:
                job.update(status="infrastructure_error", error=error, is_error=True)
                if row is None:
                    row = EpisodeResult(
                        task_id=task_id, task_name=task.get("template", task_id), suite=task_id.split(".", 1)[0],
                        apps=task.get("apps", []), max_steps=attempt_log.get("max_steps", 0),
                        difficulty=task["difficulty"],
                        execution=ExecutionResult(steps=0, trace=[], runtime_s=0, finished=False,
                                                  truncated=False, stop_reason="ERROR", error=error),
                    ).to_dict()
            if "max_steps" in attempt_log:
                actual_budgets[task_id] = attempt_log["max_steps"]
            trajectory = child_dir / "trajectory" / slug
            if trajectory.is_dir():
                try:
                    link = directory / "trajectory" / slug
                    link.symlink_to(os.path.relpath(trajectory, link.parent), target_is_directory=True)
                except OSError as exc:
                    job["artifact_warning"] = str(exc)
            recorder.record_result(row)
            job["ended_at"] = datetime.now(timezone.utc).isoformat()
            save_jobs()
            print(f"{task_id}: {job['status']}" + (f" ({error})" if error else ""), flush=True)

    save_jobs()
    try:
        async with asyncio.TaskGroup() as group:
            for index, (task, job) in enumerate(zip(tasks, jobs), start=1):
                group.create_task(worker(index, task, job))
    finally:
        await stop_workers(children)
        recorder.finish_run()
        meta_path = directory / "meta.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["task_max_steps"] = actual_budgets
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        save_jobs()
    return 2 if any(job["status"] != "completed" for job in jobs) else 0
