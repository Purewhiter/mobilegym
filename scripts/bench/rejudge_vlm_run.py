#!/usr/bin/env python3
"""Offline VLM rejudge for existing bench_env runs.

This script reuses saved trajectory screenshots and does not launch the
environment, device, or agent. It writes a new run-like directory so the
source run stays untouched.
"""

from __future__ import annotations

import argparse
import base64
import copy
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime
from math import comb
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from bench_env.env.recorder import _strip_image_data_from_messages
from bench_env.llm import LLMClient
from bench_env.task.judge import JudgeResult
from bench_env.task.vlm_judge import VLMJudge


def safe_json_dump(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2, default=str)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            records.append(json.loads(line))
    return records


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")


def task_id_to_dir_name(task_id: str, trial_id: int, repeat_n: int) -> str:
    safe = str(task_id).replace(".", "_").replace("/", "_").replace(" ", "_")
    if repeat_n > 1:
        return f"{safe}_t{trial_id}"
    return safe


def find_episode_dir(run_dir: Path, task_id: str, trial_id: int, repeat_n: int) -> Path:
    trajectory_root = run_dir / "trajectory"
    safe = str(task_id).replace(".", "_").replace("/", "_").replace(" ", "_")
    candidates = [
        trajectory_root / task_id_to_dir_name(task_id, trial_id, repeat_n),
        trajectory_root / f"{safe}_t{trial_id}",
        trajectory_root / safe,
    ]
    for candidate in candidates:
        if (candidate / "trajectory.json").exists():
            return candidate

    if trajectory_root.exists():
        for meta_path in trajectory_root.glob("*/meta.json"):
            try:
                meta = load_json(meta_path)
            except Exception:
                continue
            if meta.get("task_id") == task_id and int(meta.get("trial_id", 0)) == int(trial_id):
                episode_dir = meta_path.parent
                if (episode_dir / "trajectory.json").exists():
                    return episode_dir

    raise FileNotFoundError(
        f"trajectory not found for task={task_id!r}, trial_id={trial_id} under {trajectory_root}"
    )


def load_trajectory_for_vlm(episode_dir: Path) -> list[dict[str, Any]]:
    raw_steps = load_json(episode_dir / "trajectory.json")
    if not isinstance(raw_steps, list):
        raise ValueError(f"trajectory.json must be a list: {episode_dir}")

    trajectory: list[dict[str, Any]] = []
    for i, raw in enumerate(raw_steps):
        if not isinstance(raw, dict):
            continue
        step: dict[str, Any] = {
            "step": raw.get("step", i + 1),
            "action_type": str(raw.get("action_type", "UNKNOWN")),
            "action_data": raw.get("action_data") or {},
            "thought": raw.get("thought") or "",
        }
        screenshot = raw.get("screenshot")
        if screenshot:
            screenshot_path = episode_dir / str(screenshot)
            if screenshot_path.exists():
                step["screenshot_b64"] = base64.b64encode(screenshot_path.read_bytes()).decode("utf-8")
        trajectory.append(step)
    return trajectory


def apply_judge_result(record: dict[str, Any], judge: JudgeResult) -> dict[str, Any]:
    updated = copy.deepcopy(record)
    judge_dict = judge.to_dict()
    execution = updated.get("execution")
    if not isinstance(execution, dict):
        execution = {}
        updated["execution"] = execution

    execution_error = bool(execution.get("error"))
    judge_error = bool(judge_dict.get("judge_error"))
    is_error = execution_error or judge_error
    stop_reason = str(execution.get("stop_reason") or "")
    finished = bool(execution.get("finished")) or stop_reason == "COMPLETE"
    truncated = bool(execution.get("truncated"))
    goal_success = bool(judge.success)

    updated["judge"] = judge_dict
    updated["is_success"] = (not is_error) and stop_reason == "COMPLETE" and bool(judge.passed)
    updated["is_error"] = is_error
    updated["progress"] = float(judge.progress or 0.0)
    updated["premature_termination"] = finished and not goal_success and not is_error
    updated["overdue_termination"] = truncated and goal_success and not is_error
    return updated


def build_summary(
    records: list[dict[str, Any]],
    *,
    repeat_n: int,
    pass_k: list[int] | None,
) -> dict[str, Any]:
    total = len(records)

    def execution(record: dict[str, Any]) -> dict[str, Any]:
        ex = record.get("execution")
        return ex if isinstance(ex, dict) else {}

    def is_error(record: dict[str, Any]) -> bool:
        judge = record.get("judge")
        judge_error = isinstance(judge, dict) and bool(judge.get("judge_error"))
        return bool(record.get("is_error")) or bool(execution(record).get("error")) or judge_error

    success_list = [r.get("id") for r in records if r.get("is_success")]
    failed_list = [r.get("id") for r in records if not r.get("is_success") and not is_error(r)]
    error_list = [r.get("id") for r in records if is_error(r)]
    task_ids = {r.get("id") for r in records}
    avg_steps = sum(int(execution(r).get("steps") or 0) for r in records) / max(1, total)
    avg_runtime = sum(float(execution(r).get("runtime_s") or 0.0) for r in records) / max(1, total)

    summary: dict[str, Any] = {
        "start_time": None,
        "end_time": datetime.now().isoformat(),
        "total_tasks": len(task_ids),
        "total_episodes": total,
        "repeat_n": repeat_n,
        "success": len(success_list),
        "failed": len(failed_list),
        "error": len(error_list),
        "success_rate": len(success_list) / max(1, total - len(error_list)),
        "avg_steps": avg_steps,
        "avg_runtime_s": avg_runtime,
        "success_tasks": success_list,
        "failed_tasks": failed_list,
        "error_tasks": error_list,
    }

    if repeat_n > 1 and pass_k:
        pass_k_result = compute_pass_at_k(pass_k, records)
        summary["pass_at_k"] = pass_k_result.get("pass_at_k", {})
        summary["per_task_pass_k"] = pass_k_result.get("per_task", {})

    return summary


def compute_pass_at_k(k_values: list[int], records: list[dict[str, Any]]) -> dict[str, Any]:
    task_results: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        task_results[str(record.get("id", "unknown"))].append(record)

    per_task: dict[str, dict[str, Any]] = {}
    pass_k_sums = {k: 0.0 for k in k_values}
    valid_task_count = 0

    for task_id, trials in task_results.items():
        n = len([r for r in trials if not r.get("is_error")])
        c = len([r for r in trials if r.get("is_success")])
        task_metrics: dict[str, Any] = {"trials": n, "successes": c}
        for k in k_values:
            if n < k:
                pass_k = 1.0 if c > 0 else 0.0
            elif c == n:
                pass_k = 1.0
            elif c == 0:
                pass_k = 0.0
            else:
                pass_k = 1.0 - comb(n - c, k) / comb(n, k)
            task_metrics[f"pass@{k}"] = pass_k
            pass_k_sums[k] += pass_k
        per_task[task_id] = task_metrics
        valid_task_count += 1

    return {
        "pass_at_k": {f"pass@{k}": pass_k_sums[k] / max(1, valid_task_count) for k in k_values},
        "per_task": per_task,
    }


def write_errors(path: Path, records: list[dict[str, Any]]) -> None:
    errors: list[dict[str, Any]] = []
    for record in records:
        execution = record.get("execution") if isinstance(record.get("execution"), dict) else {}
        judge = record.get("judge") if isinstance(record.get("judge"), dict) else {}
        exec_error = execution.get("error")
        judge_error = judge.get("judge_error")
        if exec_error or judge_error or record.get("is_error"):
            errors.append(
                {
                    "id": record.get("id"),
                    "trial_id": record.get("trial_id", 0),
                    "error": exec_error or judge_error or "unknown error",
                    "error_type": "exec" if exec_error else "judge",
                }
            )
    write_jsonl(path, errors)


def save_vlm_debug(
    out_episode_dir: Path,
    prompt: list[dict[str, Any]],
    response: str,
    *,
    usage: dict[str, Any] | None = None,
) -> None:
    out_episode_dir.mkdir(parents=True, exist_ok=True)
    (out_episode_dir / "vlm_judge_prompt.json").write_text(
        safe_json_dump(_strip_image_data_from_messages(prompt)),
        encoding="utf-8",
    )
    (out_episode_dir / "vlm_judge_response.txt").write_text(str(response), encoding="utf-8")
    if usage is not None:
        (out_episode_dir / "vlm_judge_usage.json").write_text(
            safe_json_dump(usage),
            encoding="utf-8",
        )


def parse_pass_k(value: Any) -> list[int] | None:
    if value is None or value == "":
        return None
    if isinstance(value, list):
        return [int(v) for v in value]
    return [int(part.strip()) for part in str(value).split(",") if part.strip()]


def parse_task_filter(values: list[str] | None) -> set[str] | None:
    if not values:
        return None
    task_ids: set[str] = set()
    for value in values:
        task_ids.update(part.strip() for part in value.split(",") if part.strip())
    return task_ids or None


def model_slug(model: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "_", model.strip())
    return slug.strip("._-") or "judge"


def default_out_dir(run_dir: Path, out_root: Path, judge_model: str) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    source_name = f"{run_dir.parent.name}_{run_dir.name}"
    return out_root / f"{source_name}__rejudge_{model_slug(judge_model)}__{timestamp}"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Offline rejudge existing bench_env VLM runs from saved trajectories.",
    )
    parser.add_argument("run_dir", nargs="+", type=Path, help="Existing run directory/directories")
    parser.add_argument("--judge-model", required=True, help="OpenAI-compatible VLM judge model")
    parser.add_argument("--judge-base-url", help="Judge API base URL; defaults to source meta.json")
    parser.add_argument(
        "--judge-api-key",
        default=None,
        help="Judge API key; defaults to JUDGE_API_KEY, DASHSCOPE_API_KEY, then source meta.json",
    )
    parser.add_argument("--out-dir", type=Path, help="Output directory; only valid with one run_dir")
    parser.add_argument("--out-root", type=Path, default=Path("runs/rejudge"), help="Output root")
    parser.add_argument("--max-images", type=int, default=10, help="Max trajectory screenshots per judge call")
    parser.add_argument("--task-id", action="append", help="Only rejudge selected task id(s), comma-separated OK")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N selected records")
    parser.add_argument("--overwrite", action="store_true", help="Allow replacing an existing output directory")
    return parser


def rejudge_run(args: argparse.Namespace, run_dir: Path) -> Path:
    run_dir = run_dir.resolve()
    if not (run_dir / "results.jsonl").exists():
        raise FileNotFoundError(f"results.jsonl not found: {run_dir}")
    if not (run_dir / "trajectory").exists():
        raise FileNotFoundError(f"trajectory directory not found: {run_dir}")

    meta = load_json(run_dir / "meta.json") if (run_dir / "meta.json").exists() else {}
    judge_base_url = args.judge_base_url or meta.get("judge_base_url") or meta.get("model_base_url")
    judge_api_key = (
        args.judge_api_key
        if args.judge_api_key is not None
        else os.environ.get("JUDGE_API_KEY")
        or os.environ.get("DASHSCOPE_API_KEY")
        or meta.get("judge_api_key")
        or meta.get("model_api_key")
        or ""
    )
    if not judge_base_url:
        raise ValueError("--judge-base-url is required when source meta.json has no judge_base_url")

    if args.out_dir:
        out_dir = args.out_dir
    else:
        out_dir = default_out_dir(run_dir, args.out_root, args.judge_model)
    out_dir = out_dir.resolve()
    if out_dir.exists() and not args.overwrite:
        raise FileExistsError(f"output directory exists; pass --overwrite to replace files: {out_dir}")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "trajectory").mkdir(exist_ok=True)

    all_records = load_jsonl(run_dir / "results.jsonl")
    task_filter = parse_task_filter(args.task_id)
    selected_indices = [
        i for i, record in enumerate(all_records)
        if task_filter is None or str(record.get("id")) in task_filter
    ]
    if args.limit is not None:
        selected_indices = selected_indices[: args.limit]

    repeat_n = int(meta.get("repeat_n") or 1)
    pass_k = parse_pass_k(meta.get("pass_k"))
    llm = LLMClient(
        base_url=str(judge_base_url),
        api_key=str(judge_api_key or ""),
        model=args.judge_model,
    )
    judge = VLMJudge(llm=llm, max_images=args.max_images)
    updated_records = [copy.deepcopy(record) for record in all_records]

    print(f"[INFO] Source: {run_dir}")
    print(f"[INFO] Output: {out_dir}")
    print(f"[INFO] Judge:  {args.judge_model} @ {judge_base_url}")
    print(f"[INFO] Selected episodes: {len(selected_indices)}/{len(all_records)}")

    for ordinal, idx in enumerate(selected_indices, start=1):
        record = updated_records[idx]
        task_id = str(record.get("id"))
        trial_id = int(record.get("trial_id", 0))
        print(f"[{ordinal}/{len(selected_indices)}] {task_id} trial={trial_id}", flush=True)

        try:
            episode_dir = find_episode_dir(run_dir, task_id, trial_id, repeat_n)
            trajectory = load_trajectory_for_vlm(episode_dir)
            execution = record.get("execution") if isinstance(record.get("execution"), dict) else {}
            output = judge.evaluate(
                str(record.get("task_name") or task_id),
                trajectory,
                agent_answer=execution.get("agent_answer"),
                agent_message=execution.get("agent_message"),
                stop_reason=execution.get("stop_reason"),
            )
            out_episode_dir = out_dir / "trajectory" / episode_dir.name
            save_vlm_debug(out_episode_dir, output.prompt, output.response, usage=output.usage)
            (out_episode_dir / "meta.json").write_text(
                safe_json_dump(
                    {
                        "source_episode_dir": str(episode_dir),
                        "task_id": task_id,
                        "trial_id": trial_id,
                        "judge_model": args.judge_model,
                        "judge_base_url": judge_base_url,
                    }
                ),
                encoding="utf-8",
            )
            updated_records[idx] = apply_judge_result(record, output.result)
        except Exception as err:
            updated_records[idx] = apply_judge_result(
                record,
                JudgeResult.error(f"offline rejudge error: {type(err).__name__}: {err}"),
            )

    rejudge_meta = copy.deepcopy(meta)
    rejudge_meta.update(
        {
            "source_run_dir": str(run_dir),
            "judge_mode": "vlm",
            "judge_model": args.judge_model,
            "judge_base_url": judge_base_url,
            "rejudge_created_at": datetime.now().isoformat(),
            "rejudge_selected_tasks": sorted(task_filter) if task_filter else None,
            "rejudge_limit": args.limit,
            "rejudge_max_images": args.max_images,
        }
    )
    (out_dir / "meta.json").write_text(safe_json_dump(rejudge_meta), encoding="utf-8")
    write_jsonl(out_dir / "results.jsonl", updated_records)
    write_errors(out_dir / "errors.jsonl", updated_records)
    (out_dir / "summary.json").write_text(
        safe_json_dump(build_summary(updated_records, repeat_n=repeat_n, pass_k=pass_k)),
        encoding="utf-8",
    )
    return out_dir


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.out_dir and len(args.run_dir) != 1:
        parser.error("--out-dir can only be used with exactly one run_dir")

    try:
        for run_dir in args.run_dir:
            rejudge_run(args, run_dir)
    except Exception as err:
        print(f"[ERROR] {type(err).__name__}: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
