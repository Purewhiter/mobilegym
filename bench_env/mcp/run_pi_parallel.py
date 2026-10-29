"""Run a frozen task selection in isolated Pi processes; reuse original results."""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import signal
import sys

from bench_env.env.recorder import RunRecorder
from bench_env.runner.base import EpisodeResult, ExecutionResult


async def run(args) -> None:
    root = Path(__file__).resolve().parents[2]
    directory = args.run_dir.resolve()
    if directory.exists() and any(directory.iterdir()):
        raise ValueError("Run directory must be new or empty")
    selection = json.loads(args.selection.read_text())
    tasks = selection["tasks"]
    if not tasks or len({t["id"] for t in tasks}) != len(tasks):
        raise ValueError("Selection must contain distinct tasks")
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "selection.json").write_text(json.dumps(selection, ensure_ascii=False, indent=2))
    recorder = RunRecorder(directory.parent, fixed_run_dir=directory)
    recorder.start_run(agent="GenericAgentV2", model_name=args.model, extra_meta={
        "client": "pi", "transport": "mcp", "parallel": args.parallel,
        "reasoning_effort": args.reasoning_effort, "sample_seed": selection["parameter_seed"],
        "selection_seed": selection["selection_seed"], "selected_task_ids": [t["id"] for t in tasks],
        "context_policy": "one_fresh_pi_session_per_task",
        "isolation": "separate_python_server_browser_and_context_per_task",
        "task_max_steps": {t["id"]: t["budget"] for t in tasks},
    })
    semaphore = asyncio.Semaphore(args.parallel)
    job_records = []
    children: set[asyncio.subprocess.Process] = set()

    def save_jobs():
        (directory / "jobs.json").write_text(json.dumps(job_records, ensure_ascii=False, indent=2))

    async def worker(index: int, task: dict):
        slug = task["id"].replace(".", "_")
        child_dir = directory / "episodes" / f"{index + 1:02d}_{slug}"
        child_dir.parent.mkdir(parents=True, exist_ok=True)
        task_file = directory / f"task_{index + 1:02d}.txt"
        task_file.write_text(task["id"] + "\n")
        job = {"task_id": task["id"], "difficulty": task["difficulty"], "run_dir": str(child_dir), "status": "queued"}
        job_records.append(job)
        async with semaphore:
            job.update(status="running", started_at=datetime.now(timezone.utc).isoformat())
            save_jobs()
            log_path = directory / f"worker_{index + 1:02d}.log"
            try:
                with log_path.open("w") as output:
                    process = await asyncio.create_subprocess_exec(
                        sys.executable, "-m", "bench_env.mcp.run_pi",
                        "--env-url", args.env_url, "--run-dir", str(child_dir),
                        "--task-file", str(task_file), "--limit", "1",
                        "--seed", str(selection["parameter_seed"]),
                        "--model", args.model, "--reasoning-effort", args.reasoning_effort,
                        cwd=root, stdout=output, stderr=output, start_new_session=True,
                    )
                    children.add(process)
                    job["pid"] = process.pid
                    save_jobs()
                    job["returncode"] = await process.wait()
                    children.discard(process)
                result_path = child_dir / "results.jsonl"
                rows = [json.loads(line) for line in result_path.read_text().splitlines()] if result_path.exists() else []
                if len(rows) != 1 or rows[0]["id"] != task["id"]:
                    raise RuntimeError(f"Expected one task result; got {len(rows)} (client exit {job['returncode']})")
                result = rows[0]
                trajectory = child_dir / "trajectory" / slug
                if trajectory.exists():
                    # Reuse the original trajectory files in Run Explorer without
                    # rewriting them or making another large image copy.
                    try:
                        (directory / "trajectory" / slug).symlink_to(
                            os.path.relpath(trajectory, directory / "trajectory"), target_is_directory=True,
                        )
                    except OSError as error:
                        job["artifact_warning"] = str(error)
                recorder.record_result(dict(result))
                job.update(status="completed", success=result["is_success"], steps=result["execution"]["steps"],
                           is_error=result["is_error"])
            except Exception as error:
                job.update(status="infrastructure_error", error=str(error))
                # Use the existing result schema and error classification.
                failure = EpisodeResult(
                    task_id=task["id"], task_name=task.get("template", task["id"]),
                    suite=task["id"].split(".", 1)[0], apps=task.get("apps", []),
                    max_steps=task["budget"], difficulty=task["difficulty"],
                    execution=ExecutionResult(steps=0, trace=[], runtime_s=0, finished=False,
                                              truncated=False, stop_reason="ERROR", error=str(error)),
                    judge=None,
                )
                recorder.record_result(failure.to_dict())
            finally:
                job["ended_at"] = datetime.now(timezone.utc).isoformat()
                save_jobs()
                print(json.dumps({k: v for k, v in job.items() if k not in {"run_dir", "pid"}}, ensure_ascii=False), flush=True)

    try:
        await asyncio.gather(*(worker(i, t) for i, t in enumerate(tasks)))
    finally:
        for process in children:
            if process.returncode is None:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
        if children:
            await asyncio.gather(*(p.wait() for p in children), return_exceptions=True)
        recorder.finish_run()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-url", required=True)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--parallel", type=int, default=5)
    parser.add_argument("--model", default="gpt-5.6-sol")
    parser.add_argument("--reasoning-effort", default="medium")
    args = parser.parse_args()
    if args.parallel < 1:
        parser.error("--parallel must be positive")
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
