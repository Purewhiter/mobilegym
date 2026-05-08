#!/usr/bin/env python3
"""Patch error/failed tasks in an existing run with results from a new run.

Usage:
    # Patch all error tasks from new_run into old_run
    python scripts/patch_run.py runs/old_run runs/new_run

    # Patch specific task IDs only
    python scripts/patch_run.py runs/old_run runs/new_run \
        --task-id clock.EditAlarmTime crossapp_life.TravelPlanToWechat

    # Dry run (preview only)
    python scripts/patch_run.py runs/old_run runs/new_run --dry-run

    # Patch all tasks from new_run (not just errors)
    python scripts/patch_run.py runs/old_run runs/new_run --all

What it does:
    1. Replaces matching lines in results.jsonl (by task_id + trial_id)
    2. Replaces matching trajectory directories
    3. Regenerates summary.json and errors.jsonl
    4. Creates a backup of original results.jsonl
"""

import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path


def _task_dir_name(task_id: str, trial_id: int, repeat_n: int) -> str:
    """Reproduce the trajectory dir name from task_id + trial_id."""
    safe = task_id.replace(".", "_").replace("/", "_").replace(" ", "_")
    if repeat_n > 1:
        return f"{safe}_t{trial_id}"
    return safe


def _is_error_result(r: dict) -> bool:
    """Check if a result is an error (exec or judge)."""
    if r.get("is_error"):
        return True
    exec_d = r.get("execution", {})
    if exec_d.get("error"):
        return True
    judge_d = r.get("judge", {}) or {}
    if judge_d.get("judge_error"):
        return True
    # Backward compat: check issues for error key
    for issue in judge_d.get("issues", []):
        if "error" in issue:
            return True
    return False


def load_results(path: Path) -> list[dict]:
    results = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                results.append(json.loads(line))
    return results


def result_key(r: dict) -> str:
    """Unique key for a result: task_id + trial_id."""
    task_id = r.get("id", "")
    trial_id = r.get("trial_id", 0)
    return f"{task_id}__t{trial_id}"


def regenerate_summary(run_dir: Path, results: list[dict],
                       repeat_n: int, pass_k: list[int] | None):
    """Regenerate summary.json from results."""
    total = len(results)

    def _exec(r):
        return r.get("execution", {})

    def _is_err(r):
        return _is_error_result(r)

    success_list = [r.get("id") for r in results if r.get("is_success")]
    failed_list = [
        r.get("id") for r in results
        if not r.get("is_success") and not _is_err(r)
    ]
    error_list = [r.get("id") for r in results if _is_err(r)]

    task_ids = set(r.get("id") for r in results)

    # Read existing meta for timestamps
    meta_path = run_dir / "meta.json"
    meta = {}
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())

    summary = {
        "start_time": meta.get("start_time"),
        "end_time": datetime.now().isoformat(),
        "total_tasks": len(task_ids),
        "total_episodes": total,
        "repeat_n": repeat_n,
        "success": len(success_list),
        "failed": len(failed_list),
        "error": len(error_list),
        "success_rate": len(success_list) / max(1, total),
        "avg_steps": sum(
            int(_exec(r).get("steps", 0)) for r in results
        ) / max(1, total),
        "avg_runtime_s": sum(
            float(_exec(r).get("runtime_s", 0)) for r in results
        ) / max(1, total),
        "success_tasks": success_list,
        "failed_tasks": failed_list,
        "error_tasks": error_list,
    }

    (run_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str)
    )
    return summary


def regenerate_errors(run_dir: Path, results: list[dict]):
    """Regenerate errors.jsonl from results."""
    with open(run_dir / "errors.jsonl", "w") as f:
        for r in results:
            if not _is_error_result(r):
                continue
            exec_d = r.get("execution", {})
            judge_d = r.get("judge", {}) or {}
            exec_err = exec_d.get("error")
            judge_err = judge_d.get("judge_error")
            err = exec_err or judge_err
            # Backward compat
            if not err:
                for issue in judge_d.get("issues", []):
                    if "error" in issue:
                        err = issue["error"]
                        break
            entry = {
                "id": r.get("id"),
                "suite": r.get("suite"),
                "task_name": r.get("task_name"),
                "trial_id": r.get("trial_id", 0),
                "error_type": "exec" if exec_err else "judge",
                "error": err,
            }
            f.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Patch error tasks in a run with results from a new run"
    )
    parser.add_argument("target_run", help="Target run directory to patch")
    parser.add_argument("source_run", help="Source run with new results")
    parser.add_argument(
        "--task-id", nargs="*",
        help="Specific task IDs to patch (default: all errors)"
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Patch all tasks from source (not just errors)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview what would be patched"
    )
    args = parser.parse_args()

    target_dir = Path(args.target_run)
    source_dir = Path(args.source_run)

    # Handle nested source (e.g., uitars has subdirs)
    source_results_path = source_dir / "results.jsonl"
    if not source_results_path.exists():
        # Try subdirectories
        candidates = sorted(source_dir.glob("*/results.jsonl"))
        if candidates:
            # Use the largest one
            best = max(candidates, key=lambda p: p.stat().st_size)
            source_dir = best.parent
            source_results_path = best
            print(f"[INFO] Using source subdirectory: {source_dir}")

    if not source_results_path.exists():
        print(f"[ERROR] Source results.jsonl not found in {source_dir}")
        return 1

    target_results_path = target_dir / "results.jsonl"
    if not target_results_path.exists():
        print(f"[ERROR] Target results.jsonl not found: {target_results_path}")
        return 1

    # Load results
    target_results = load_results(target_results_path)
    source_results = load_results(source_results_path)

    # Build source lookup
    source_map = {}
    for r in source_results:
        source_map[result_key(r)] = r

    # Determine which tasks to patch
    if args.task_id:
        # Explicit task IDs
        patch_ids = set(args.task_id)
        to_patch = {
            k: v for k, v in source_map.items()
            if any(tid in k for tid in patch_ids)
        }
    elif args.all:
        to_patch = source_map
    else:
        # Default: patch only error tasks in target
        to_patch = {}
        for r in target_results:
            if _is_error_result(r):
                key = result_key(r)
                if key in source_map:
                    to_patch[key] = source_map[key]

    if not to_patch:
        print("[INFO] No tasks to patch")
        return 0

    # Preview
    print(f"\n{'='*60}")
    print(f"  PATCH PLAN: {len(to_patch)} task(s)")
    print(f"  Target: {target_dir}")
    print(f"  Source: {source_dir}")
    print(f"{'='*60}\n")

    for key, new_r in sorted(to_patch.items()):
        old_r = next(
            (r for r in target_results if result_key(r) == key), None
        )
        old_status = "error" if old_r and _is_error_result(old_r) \
            else ("success" if old_r and old_r.get("is_success") else "failed") \
            if old_r else "MISSING"
        new_status = "error" if _is_error_result(new_r) \
            else ("success" if new_r.get("is_success") else "failed")
        print(f"  {key}: {old_status} → {new_status}")

    if args.dry_run:
        print("\n[DRY RUN] No changes made")
        return 0

    # Backup
    backup_path = target_results_path.with_suffix(".jsonl.bak")
    shutil.copy2(target_results_path, backup_path)
    print(f"\n[BACKUP] {backup_path}")

    # Patch results
    patched_results = []
    patched_keys = set()
    for r in target_results:
        key = result_key(r)
        if key in to_patch:
            patched_results.append(to_patch[key])
            patched_keys.add(key)
        else:
            patched_results.append(r)

    # Add new results not in target
    for key, r in to_patch.items():
        if key not in patched_keys:
            patched_results.append(r)

    # Write patched results
    with open(target_results_path, "w") as f:
        for r in patched_results:
            f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")
    print(f"[PATCHED] results.jsonl ({len(to_patch)} entries replaced)")

    # Patch trajectories
    target_traj = target_dir / "trajectory"
    source_traj = source_dir / "trajectory"
    meta = json.loads((target_dir / "meta.json").read_text()) \
        if (target_dir / "meta.json").exists() else {}
    repeat_n = meta.get("repeat_n", 1)
    traj_count = 0

    if target_traj.exists() and source_traj.exists():
        for key in to_patch:
            # Parse task_id and trial_id from key
            parts = key.rsplit("__t", 1)
            task_id = parts[0]
            trial_id = int(parts[1]) if len(parts) > 1 else 0
            dir_name = _task_dir_name(task_id, trial_id, repeat_n)

            src = source_traj / dir_name
            dst = target_traj / dir_name
            if src.exists():
                if dst.exists():
                    shutil.rmtree(dst)
                shutil.copytree(src, dst)
                traj_count += 1
    print(f"[PATCHED] {traj_count} trajectory dirs")

    # Regenerate summary + errors
    regenerate_summary(target_dir, patched_results, repeat_n,
                       meta.get("pass_k"))
    regenerate_errors(target_dir, patched_results)
    print(f"[REGEN] summary.json, errors.jsonl")

    # Final stats
    new_errors = sum(1 for r in patched_results if _is_error_result(r))
    new_success = sum(1 for r in patched_results if r.get("is_success"))
    print(f"\n[RESULT] {len(patched_results)} episodes: "
          f"{new_success} success, {new_errors} errors, "
          f"{len(patched_results) - new_success - new_errors} failed")

    return 0


if __name__ == "__main__":
    exit(main())
