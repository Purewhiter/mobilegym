"""
Metrics computation for benchmark evaluation.

This module provides functions for computing evaluation metrics,
including pass@k for measuring success rates across multiple trials.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
import json
from math import comb
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from bench_env.runner.base import EpisodeResult


def result_key(result: Any) -> str:
    """Stable identifier for a recorded result: ``<task_id>__t<trial_id>``."""
    if isinstance(result, dict):
        task_id = result.get("id", "")
        trial_id = result.get("trial_id", 0)
    else:
        task_id = getattr(result, "task_id", "")
        trial_id = getattr(result, "trial_id", 0)
    return f"{task_id}__t{trial_id}"


def task_trial_key(task_id: str, trial_id: int) -> str:
    """Same shape as :func:`result_key`, but from raw scalars."""
    return f"{task_id}__t{trial_id}"


def load_jsonl(path: Path | str) -> list[dict[str, Any]]:
    """Read a ``.jsonl`` file into a list of dicts (empty list if missing)."""
    p = Path(path)
    if not p.exists():
        return []
    out: list[dict[str, Any]] = []
    with p.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def _result_task_id(result: Any) -> str:
    if isinstance(result, dict):
        return str(result.get("id", "unknown"))
    return str(getattr(result, "task_id", "unknown"))


def _result_suite(result: Any) -> str | None:
    if isinstance(result, dict):
        suite = result.get("suite")
    else:
        suite = getattr(result, "suite", None)
    return str(suite) if suite is not None else None


def _result_task_name(result: Any) -> str | None:
    if isinstance(result, dict):
        name = result.get("task_name")
    else:
        name = getattr(result, "task_name", None)
    return str(name) if name is not None else None


def _result_trial_id(result: Any) -> int:
    if isinstance(result, dict):
        return int(result.get("trial_id", 0) or 0)
    return int(getattr(result, "trial_id", 0) or 0)


def _result_execution_dict(result: Any) -> dict[str, Any]:
    if isinstance(result, dict):
        execution = result.get("execution")
        return execution if isinstance(execution, dict) else {}

    execution = getattr(result, "execution", None)
    if execution is None:
        return {}
    return {
        "steps": getattr(execution, "steps", 0),
        "runtime_s": getattr(execution, "runtime_s", 0.0),
        "stop_reason": getattr(execution, "stop_reason", None),
        "error": getattr(execution, "error", None),
    }


def result_is_error(result: Any) -> bool:
    """Return whether a recorded result should count as an error."""
    if isinstance(result, dict):
        if result.get("is_error"):
            return True
        exec_d = result.get("execution") if isinstance(result.get("execution"), dict) else {}
        if exec_d.get("error"):
            return True
        judge_d = result.get("judge") or {}
        if isinstance(judge_d, dict) and judge_d.get("judge_error"):
            return True
        return False

    return bool(getattr(result, "error", None))


def result_is_success(result: Any) -> bool:
    if isinstance(result, dict):
        return bool(result.get("is_success"))
    return bool(getattr(result, "success", False))


def _result_progress(result: Any) -> float:
    if isinstance(result, dict):
        return float(result.get("progress", 0.0) or 0.0)
    return float(getattr(result, "progress", 0.0) or 0.0)


def _result_overdue(result: Any) -> bool:
    if isinstance(result, dict):
        return bool(result.get("overdue_termination"))
    return bool(getattr(result, "overdue_termination", False))


def compute_pass_at_k(
    results: list[Any],
    k_values: list[int],
) -> dict[str, Any]:
    """
    Compute pass@k metrics using unbiased estimator.
    
    The pass@k metric measures the probability that at least one of k
    samples passes, estimated from n total samples where c passed.
    
    Formula: pass@k = 1 - C(n-c, k) / C(n, k)
    
    This is the unbiased estimator from the OpenAI Codex paper.
    
    Args:
        results: List of episode results (may contain multiple trials per task)
        k_values: List of k values to compute (e.g., [1, 5, 10])
        
    Returns:
        Dictionary with:
        - "pass_at_k": {k: average_pass_k for each k}
        - "per_task": {task_id: {trials, successes, pass@k values}}
    """
    # Group results by task_id
    task_results: dict[str, list[Any]] = defaultdict(list)
    for r in results:
        task_results[_result_task_id(r)].append(r)
    
    # Compute per-task metrics
    per_task: dict[str, dict[str, Any]] = {}
    pass_k_sums: dict[int, float] = {k: 0.0 for k in k_values}
    valid_task_count = 0
    
    for task_id, trials in task_results.items():
        n = len(trials) - sum(1 for r in trials if result_is_error(r))
        c = sum(1 for r in trials if result_is_success(r))
        
        task_metrics = {
            "trials": n,
            "successes": c,
        }
        
        for k in k_values:
            pass_k = _compute_single_pass_k(n, c, k)
            task_metrics[f"pass@{k}"] = pass_k
        
        per_task[task_id] = task_metrics
        if n > 0:
            valid_task_count += 1
            for k in k_values:
                pass_k_sums[k] += task_metrics[f"pass@{k}"]
    
    # Compute average pass@k across valid tasks (skip all-error tasks)
    num_tasks = valid_task_count if valid_task_count else 1
    pass_at_k = {k: pass_k_sums[k] / num_tasks for k in k_values}
    
    return {
        "pass_at_k": pass_at_k,
        "per_task": per_task,
    }


def summarize_recorded_results(
    results: list[Any],
    *,
    repeat_n: int = 1,
    pass_k: list[int] | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
) -> dict[str, Any]:
    """Generate the persisted ``summary.json`` shape used by benchmark runs."""
    total = len(results)
    end_time = end_time or datetime.now().isoformat()

    success_list = [_result_task_id(r) for r in results if result_is_success(r)]
    failed_list = [
        _result_task_id(r)
        for r in results
        if not result_is_success(r) and not result_is_error(r)
    ]
    error_list = [_result_task_id(r) for r in results if result_is_error(r)]

    task_ids = {_result_task_id(r) for r in results}

    def _steps(r: Any) -> int:
        return int(_result_execution_dict(r).get("steps", 0) or 0)

    def _runtime(r: Any) -> float:
        return float(_result_execution_dict(r).get("runtime_s", 0.0) or 0.0)

    summary: dict[str, Any] = {
        "start_time": start_time,
        "end_time": end_time,
        "total_tasks": len(task_ids),
        "total_episodes": total,
        "repeat_n": repeat_n,
        "success": len(success_list),
        "failed": len(failed_list),
        "error": len(error_list),
        "success_rate": len(success_list) / max(1, total - len(error_list)),
        "avg_steps": sum(_steps(r) for r in results) / max(1, total),
        "avg_runtime_s": sum(_runtime(r) for r in results) / max(1, total),
        "success_tasks": success_list,
        "failed_tasks": failed_list,
        "error_tasks": error_list,
    }

    if repeat_n > 1 and pass_k:
        pass_k_result = compute_pass_at_k(results, pass_k)
        summary["pass_at_k"] = pass_k_result.get("pass_at_k", {})
        summary["per_task_pass_k"] = pass_k_result.get("per_task", {})

    return summary


def write_summary_json(
    run_dir: Path,
    results: list[Any],
    *,
    repeat_n: int = 1,
    pass_k: list[int] | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
) -> dict[str, Any]:
    """Write ``summary.json`` and return the generated summary."""
    summary = summarize_recorded_results(
        results,
        repeat_n=repeat_n,
        pass_k=pass_k,
        start_time=start_time,
        end_time=end_time,
    )
    (Path(run_dir) / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    return summary


def _result_error_payload(result: Any) -> tuple[str | None, str]:
    exec_d = _result_execution_dict(result)
    exec_err = exec_d.get("error")

    judge_err = None
    if isinstance(result, dict):
        judge_d = result.get("judge") or {}
        if isinstance(judge_d, dict):
            judge_err = judge_d.get("judge_error")

    if exec_err:
        return str(exec_err), "exec"
    if judge_err:
        return str(judge_err), "judge"
    if not isinstance(result, dict):
        err = getattr(result, "error", None)
        if err:
            return str(err), "exec"
    return None, "exec"


def build_error_entry(result: Any) -> dict[str, Any]:
    """Build one ``errors.jsonl`` row from a recorded result."""
    exec_d = _result_execution_dict(result)
    err, err_type = _result_error_payload(result)
    return {
        "id": _result_task_id(result),
        "suite": _result_suite(result),
        "task_name": _result_task_name(result),
        "trial_id": _result_trial_id(result),
        "stop_reason": exec_d.get("stop_reason"),
        "error_type": err_type,
        "error": err or "unknown error",
        "start_time": result.get("start_time") if isinstance(result, dict) else None,
        "end_time": result.get("end_time") if isinstance(result, dict) else None,
    }


def write_errors_jsonl(run_dir: Path, results: list[Any]) -> None:
    """Regenerate ``errors.jsonl`` from recorded results."""
    with (Path(run_dir) / "errors.jsonl").open("w", encoding="utf-8") as f:
        for r in results:
            if not result_is_error(r):
                continue

            f.write(json.dumps(build_error_entry(r), ensure_ascii=False, default=str) + "\n")


def _compute_single_pass_k(n: int, c: int, k: int) -> float:
    """
    Compute pass@k for a single task.
    
    Args:
        n: Total number of trials
        c: Number of successful trials
        k: k value for pass@k
        
    Returns:
        pass@k probability (0.0 to 1.0)
    """
    if n < k:
        # Not enough samples for this k
        # Use simple estimate: 1 if any success, 0 otherwise
        return 1.0 if c > 0 else 0.0
    
    if c == n:
        # All trials succeeded
        return 1.0
    
    if c == 0:
        # No trials succeeded
        return 0.0
    
    # Unbiased estimator: 1 - C(n-c, k) / C(n, k)
    # Handle potential overflow for large n by using the formula directly
    try:
        return 1.0 - comb(n - c, k) / comb(n, k)
    except (ValueError, ZeroDivisionError):
        # Fallback for edge cases
        return 1.0 if c > 0 else 0.0


def _compute_multidim_metrics(results: list["EpisodeResult"]) -> dict[str, float]:
    """Compute Progress Rate, termination rates, Step Efficiency Ratio, and side-effect rate."""
    valid = [r for r in results if r]
    n = len(valid)
    if n == 0:
        return {}

    # PR — average progress across all episodes
    pr = sum(r.progress for r in valid) / n

    # FC — fraction of episodes where agent declared COMPLETE but the episode is
    # not fully successful (paper §3.5: agent issued COMPLETE but the run is
    # not a full success). Equivalent to `COMPLETE AND NOT is_success`.
    fc = sum(1 for r in valid if r.false_complete) / n

    # OT — fraction of episodes that reached the goal but never declared FINISH
    # (truncated by step budget or loop detection).
    otr = sum(1 for r in valid if r.overdue_termination) / n

    # USE — fraction of episodes that introduce non-expected state changes.
    # Paper §3.5: denominator is all episodes, independent of SR/FC/OT
    # (mean(!clean), see runs/METRICS_RECALC_NOTES.md).
    use = sum(1 for r in valid if r.judge and not r.no_unexpected_changes) / n

    # SER — step efficiency for successful episodes
    # golden_steps = min(len(p) for p in optimal_paths) if optimal_paths, else None
    # SER = golden_steps / actual_steps (capped at 1.0)
    ser_values: list[float] = []
    for r in valid:
        if not r.success:
            continue
        # task_id format: suite.ClassName[_iN] — we need the original task class
        # Since we store optimal_paths at class level and don't pass it through,
        # we skip SER if no metadata is available. In practice the runner can
        # attach golden_steps to EpisodeResult later.
        golden = getattr(r, 'golden_steps', None)
        if golden is not None and golden > 0 and r.steps > 0:
            ser_values.append(min(1.0, golden / r.steps))
    ser = sum(ser_values) / len(ser_values) if ser_values else None

    out: dict[str, float] = {
        "progress_rate": pr,
        "false_complete_rate": fc,
        "overdue_termination_rate": otr,
        "unexpected_side_effects_rate": use,
    }
    if ser is not None:
        out["step_efficiency_ratio"] = ser
    return out


def _group_by_taxonomy(
    results: list["EpisodeResult"],
    registry: Any | None = None,
) -> dict[str, dict[str, list["EpisodeResult"]]]:
    """Group results by taxonomy dimensions using the registry to look up class attrs."""
    if registry is None:
        try:
            from bench_env.task.registry import TaskRegistry

            registry = TaskRegistry()
        except Exception:
            registry = None

    axes: dict[str, dict[str, list["EpisodeResult"]]] = {
        "scope": defaultdict(list),
        "objective": defaultdict(list),
        "composition": defaultdict(list),
        "difficulty": defaultdict(list),
        "suite": defaultdict(list),
    }

    cls_cache: dict[str, type | None] = {}
    for r in results:
        if not r:
            continue
        # Look up the task class to get taxonomy
        tid = r.task_id
        if tid not in cls_cache:
            cls = None
            if registry is not None:
                try:
                    cls = registry.get_by_id(tid.split("_i")[0])
                except Exception:
                    cls = None
            cls_cache[tid] = cls
        cls = cls_cache[tid]

        axes["suite"][r.suite].append(r)
        axes["scope"][getattr(cls, "scope", "?")].append(r)
        axes["objective"][getattr(cls, "objective", "?")].append(r)
        axes["composition"][getattr(cls, "composition", "?")].append(r)
        axes["difficulty"][getattr(cls, "difficulty", "?")].append(r)

    return axes


def summarize_results(
    results: list["EpisodeResult"],
    repeat_n: int = 1,
    pass_k_values: list[int] | None = None,
    include_taxonomy: bool = False,
) -> dict[str, Any]:
    """
    Generate comprehensive summary of benchmark results.
    
    Args:
        results: List of all episode results
        repeat_n: Number of trials per task (for pass@k context)
        pass_k_values: List of k values for pass@k metrics
        include_taxonomy: If True, add per-dimension breakdowns
        
    Returns:
        Summary dictionary with success rates, multi-dim metrics, and pass@k
    """
    total = len(results)
    
    success_count = sum(1 for r in results if r and r.success)
    error_count = sum(1 for r in results if r and r.error)
    
    task_ids = set(r.task_id for r in results if r)
    num_tasks = len(task_ids)
    
    valid_count = total - error_count
    
    summary: dict[str, Any] = {
        "total_tasks": num_tasks,
        "total_episodes": total,
        "repeat_n": repeat_n,
        "success_count": success_count,
        "error_count": error_count,
        "success_rate": success_count / max(1, valid_count),
        "avg_steps": sum(r.execution.steps for r in results if r) / max(1, total),
        "avg_runtime_s": sum(r.execution.runtime_s for r in results if r) / max(1, total),
    }

    # Multi-dimensional metrics
    summary.update(_compute_multidim_metrics(results))
    
    # pass@k
    if pass_k_values and repeat_n > 1:
        pass_k_result = compute_pass_at_k(results, pass_k_values)
        summary["pass_at_k"] = pass_k_result["pass_at_k"]
        summary["per_task_pass_k"] = pass_k_result["per_task"]

    # Taxonomy breakdown
    if include_taxonomy:
        grouped = _group_by_taxonomy(results)
        taxonomy_summary: dict[str, dict[str, dict[str, Any]]] = {}
        for axis, groups in grouped.items():
            axis_summary: dict[str, dict[str, Any]] = {}
            for label, group_results in groups.items():
                n = len(group_results)
                sc = sum(1 for r in group_results if r.success)
                ec = sum(1 for r in group_results if r.error)
                valid_n = n - ec
                axis_summary[label] = {
                    "episodes": n,
                    "errors": ec,
                    "success_rate": sc / max(1, valid_n),
                    **_compute_multidim_metrics(group_results),
                }
            taxonomy_summary[axis] = axis_summary
        summary["taxonomy"] = taxonomy_summary
    
    return summary
