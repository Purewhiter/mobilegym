"""Rerun failed/errored tasks from an existing run directory.

Usage (via CLI):
    python -m bench_env.run --rerun runs/20260411_043131 --env-url http://localhost:3000
    python -m bench_env.run --rerun runs/20260411_043131 --rerun-scope all --suite wechat
    python -m bench_env.run --rerun runs/20260411_043131 --task-ids wechat.TaskA,alipay.TaskB

Flow:
    1. Resolve run directory, load meta.json + results.jsonl
    2. Identify tasks to rerun (scope + suite/task-ids filters)
    3. Recover RunnerConfig from meta.json, merge CLI overrides
    4. Run to a temporary directory using existing Serial/ParallelRunner
    5. Merge new results back into the original run directory
    6. Regenerate summary.json + errors.jsonl, clean up temp
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from bench_env.config import RunnerConfig

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Run directory resolution
# ---------------------------------------------------------------------------

def resolve_run_dir(path: str | Path) -> Path:
    """解析 run 目录路径。

    支持：
    - 直接传含 meta.json 的目录
    - 传父目录（自动找最新的含 meta.json 的子目录）
    """
    p = Path(path).resolve()
    if (p / "meta.json").exists():
        return p
    subdirs = [d for d in p.iterdir() if d.is_dir() and (d / "meta.json").exists()]
    if len(subdirs) == 1:
        return subdirs[0]
    if len(subdirs) > 1:
        return max(subdirs, key=lambda d: d.name)
    raise FileNotFoundError(f"No meta.json found in {p} or its subdirectories")


# ---------------------------------------------------------------------------
# Result loading & filtering
# ---------------------------------------------------------------------------

from bench_env.metrics import (
    load_jsonl as load_results,
    result_is_error as _is_error_result,
    result_key,
)


def identify_rerun_tasks(
    results: list[dict],
    scope: str,
    suite_filter: list[str] | None = None,
    task_ids_filter: list[str] | None = None,
    split_task_ids: frozenset[str] | set[str] | None = None,
    repeat_n: int = 1,
) -> list[dict]:
    """从 results 中筛选需要重跑的条目。

    1. 先按 suite / task_ids / split 缩小范围 (AND between filters)
    2. 再按 scope 过滤状态
    3. pass@k (repeat_n > 1) 时，如果某个 task 的任意 trial 被选中，
       自动扩展为重跑该 task 的所有 trial

    Returns:
        需要重跑的 result entries。
    """
    # Step 1: scope filter on full result set
    candidates = list(results)

    # Step 2: narrow by suite / task_ids / split (all AND)
    if suite_filter:
        suite_set = set(suite_filter)
        candidates = [r for r in candidates if r.get("suite") in suite_set]
    if task_ids_filter:
        id_set = set(task_ids_filter)
        candidates = [
            r for r in candidates
            if r.get("id") in id_set
            or any(r.get("id", "").startswith(f"{tid}_i") for tid in id_set)
        ]
    if split_task_ids is not None:
        from bench_env.splits import base_task_id
        candidates = [r for r in candidates if base_task_id(r.get("id", "")) in split_task_ids]

    # Step 3: status filter
    if scope == "error":
        selected = [r for r in candidates if _is_error_result(r)]
    elif scope == "failed":
        selected = [r for r in candidates
                    if not r.get("is_success") and not _is_error_result(r)]
    elif scope == "all":
        selected = list(candidates)
    else:
        raise ValueError(f"Unknown rerun scope: {scope}")

    # Step 4: pass@k expansion — if any trial of a task is selected,
    # include ALL trials of that task
    if repeat_n > 1 and selected:
        selected_task_ids = {r.get("id") for r in selected}
        selected = [
            r for r in results
            if r.get("id") in selected_task_ids
        ]

    return selected


# ---------------------------------------------------------------------------
# Config recovery
# ---------------------------------------------------------------------------

def _collect_cli_overrides(args: argparse.Namespace) -> dict[str, Any]:
    """从 CLI args 中收集显式传入的参数（非 None 的值）作为 overrides。

    argparse 中大部分可覆盖参数 default=None，非 None 即表示用户显式传入。
    对于 store_true 的布尔 flag（默认 False），只在用户显式传入时覆盖。
    对于有非 None argparse 默认值的参数（如 --parallel 默认 1），只有值与默认值
    不同时才视为显式覆盖，避免静默覆盖 meta.json 中的原始配置。
    """
    overrides: dict[str, Any] = {}

    # 非布尔参数且 argparse default=None：非 None 即显式传入
    nullable_mappings: dict[str, str] = {
        "env_url": "env_url",
        "model_base_url": "model_base_url",
        "model_name": "model_name",
        "proxy": "proxy",
        "judge_model": "judge_model",
        "judge_base_url": "judge_base_url",
        "judge_api_key": "judge_api_key",
        "device_serial": "device_serial",
        "temperature": "temperature",
        "top_p": "top_p",
        "max_tokens": "max_tokens",
        "max_steps": "max_steps",
    }

    # 有非 None argparse 默认值的参数：只有值与默认值不同时才视为显式覆盖
    # （注意：用户显式传入与默认值相同的值无法区分，但此场景罕见且无害）
    _ARGPARSE_DEFAULTS: dict[str, tuple[str, Any]] = {
        # cli_attr -> (config_name, argparse_default)
        "model_api_key": ("model_api_key", ""),
        "parallel": ("parallel", 1),
        "processes": ("processes", 1),
        "num_browsers": ("num_browsers", 0),
        "loop_detect": ("loop_detect", 0),
        "screenshot_scale": ("screenshot_scale", 1.0),
        "infer_timeout": ("infer_timeout", 300.0),
    }
    for cli_name, config_name in nullable_mappings.items():
        val = getattr(args, cli_name, None)
        if val is not None:
            overrides[config_name] = val

    for cli_name, (config_name, default) in _ARGPARSE_DEFAULTS.items():
        val = getattr(args, cli_name, None)
        if val is not None and val != default:
            overrides[config_name] = val

    # store_true 布尔 flag：argparse 默认 False，只在 True 时覆盖
    # （用户无法通过 CLI 将 True→False，但这种 rerun 需求极罕见）
    bool_flags: dict[str, str] = {
        "headless": "headless",
        "quiet": "quiet",
        "monitor": "monitor",
        "no_stream": "no_stream",
        "no_save_trajectory": "no_save_trajectory",
    }
    for cli_name, config_name in bool_flags.items():
        if getattr(args, cli_name, False):
            overrides[config_name] = True

    # max_steps_explicit: track if user explicitly set --max-steps
    if getattr(args, "max_steps", None) is not None:
        overrides["max_steps_explicit"] = True

    # task_instructions: CLI passes a file path string; parse to dict so it
    # can be placed directly into RunnerConfig kwargs via from_meta overrides.
    ti_value = getattr(args, "task_instructions", None)
    if ti_value is not None:
        p = Path(str(ti_value))
        if not p.exists():
            raise FileNotFoundError(f"--task-instructions file not found: {p}")
        data = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError(
                f"--task-instructions {p} must be a JSON object {{task_id: instruction}}"
            )
        parsed = {str(k): str(v) for k, v in data.items()}
        overrides["task_instructions"] = parsed or None

    return overrides


def build_rerun_config(
    meta: dict,
    cli_args: argparse.Namespace,
    rerun_task_ids: list[str],
    tmp_runs_dir: Path,
) -> RunnerConfig:
    """从 meta.json 恢复 RunnerConfig，合并 CLI 覆盖。"""
    overrides = _collect_cli_overrides(cli_args)

    # 强制设置 rerun 专用字段
    overrides["task_ids"] = rerun_task_ids
    overrides["task_id"] = None
    overrides["runs_dir"] = tmp_runs_dir

    config = RunnerConfig.from_meta(meta, overrides)
    return config


# ---------------------------------------------------------------------------
# Merge logic (adapted from the legacy patch_run helper script)
# ---------------------------------------------------------------------------

def _task_dir_name(task_id: str, trial_id: int, repeat_n: int) -> str:
    """Reproduce the trajectory dir name from task_id + trial_id."""
    safe = task_id.replace(".", "_").replace("/", "_").replace(" ", "_")
    if repeat_n > 1:
        return f"{safe}_t{trial_id}"
    return safe


def _remove_path(path: Path) -> None:
    """Remove a file, symlink, or directory."""
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.exists():
        shutil.rmtree(path)


def _regenerate_summary(run_dir: Path, results: list[dict],
                        repeat_n: int, pass_k: list[int] | None) -> dict:
    """Regenerate summary.json from results."""
    meta_path = run_dir / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    from bench_env.metrics import write_summary_json

    return write_summary_json(
        run_dir,
        results,
        repeat_n=repeat_n,
        pass_k=pass_k,
        start_time=meta.get("start_time"),
    )


def _regenerate_errors(run_dir: Path, results: list[dict]) -> None:
    """Regenerate errors.jsonl from results."""
    from bench_env.metrics import write_errors_jsonl

    write_errors_jsonl(run_dir, results)


def merge_results(
    target_dir: Path,
    source_dir: Path,
    rerun_keys: set[str],
    repeat_n: int,
    pass_k: list[int] | None,
) -> dict:
    """将 source 的新结果合并回 target。

    1. 按 (task_id, trial_id) key 替换旧结果
    2. 复制新 trajectory 覆盖旧的
    3. 备份原文件为 .bak
    4. 重新生成 summary.json + errors.jsonl

    Returns:
        The regenerated summary dict.
    """
    target_results_path = target_dir / "results.jsonl"
    source_results_path = source_dir / "results.jsonl"

    old_results = load_results(target_results_path) if target_results_path.exists() else []
    new_results = load_results(source_results_path) if source_results_path.exists() else []

    # Build source lookup
    source_map: dict[str, dict] = {}
    for r in new_results:
        source_map[result_key(r)] = r

    # Merge: replace matching entries, keep the rest
    merged: list[dict] = []
    patched_keys: set[str] = set()
    for r in old_results:
        key = result_key(r)
        if key in source_map:
            merged.append(source_map[key])
            patched_keys.add(key)
        else:
            merged.append(r)

    # Add any new results not present in old (defensive)
    for key, r in source_map.items():
        if key not in patched_keys:
            merged.append(r)

    # Backup original files
    for fname in ["results.jsonl", "errors.jsonl", "summary.json"]:
        src = target_dir / fname
        if src.exists():
            # Shared run directories may allow content writes but reject metadata
            # updates (mtime/mode) for files owned by another user.
            shutil.copyfile(src, src.with_suffix(f".{fname.split('.')[-1]}.bak"))

    # Write merged results
    with open(target_results_path, "w", encoding="utf-8") as f:
        for r in merged:
            f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")

    # Patch trajectories
    target_traj = target_dir / "trajectory"
    source_traj = source_dir / "trajectory"
    traj_count = 0
    if target_traj.exists() and source_traj.exists():
        for key in rerun_keys:
            parts = key.rsplit("__t", 1)
            task_id = parts[0]
            trial_id = int(parts[1]) if len(parts) > 1 else 0
            dir_name = _task_dir_name(task_id, trial_id, repeat_n)

            src = source_traj / dir_name
            dst = target_traj / dir_name
            if src.exists():
                if dst.exists() or dst.is_symlink():
                    _remove_path(dst)
                shutil.copytree(src, dst)
                traj_count += 1

    logger.info(f"[MERGE] {len(source_map)} results replaced, {traj_count} trajectory dirs updated")

    # Regenerate summary + errors
    summary = _regenerate_summary(target_dir, merged, repeat_n, pass_k)
    _regenerate_errors(target_dir, merged)

    return summary


# ---------------------------------------------------------------------------
# Rerun orchestration
# ---------------------------------------------------------------------------

async def run_rerun(args: argparse.Namespace) -> int:
    """完整的 rerun 编排入口。"""
    from bench_env.runner import SerialRunner, ParallelRunner, MultiProcessRunner
    from bench_env.logger import configure_logging

    # 1. Resolve run directory
    try:
        run_dir = resolve_run_dir(args.rerun)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        return 2

    # 2. Load meta + results
    meta_path = run_dir / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    results_path = run_dir / "results.jsonl"
    if not results_path.exists():
        print(f"[ERROR] results.jsonl not found in {run_dir}")
        return 2
    old_results = load_results(results_path)
    if not old_results:
        print("[INFO] results.jsonl is empty, nothing to rerun")
        return 0

    # 3. Identify rerun tasks
    scope = getattr(args, "rerun_scope", "error")
    suite_filter = _parse_comma_list(getattr(args, "suite", None))
    task_ids_filter = _parse_comma_list(getattr(args, "task_ids", None))
    # Also accept --task-id (singular) as filter
    single_task_id = getattr(args, "task_id", None)
    if single_task_id and not task_ids_filter:
        task_ids_filter = [single_task_id]
    # CLI --split overrides meta; otherwise inherit from the original run.
    split_spec = getattr(args, "split", None) or meta.get("split")
    split_task_ids = None
    if split_spec:
        from bench_env.splits import resolve_split
        split_task_ids = frozenset(resolve_split(split_spec))
    repeat_n = meta.get("repeat_n", 1)

    rerun_entries = identify_rerun_tasks(
        old_results, scope,
        suite_filter=suite_filter,
        task_ids_filter=task_ids_filter,
        split_task_ids=split_task_ids,
        repeat_n=repeat_n,
    )

    if not rerun_entries:
        print(f"[INFO] No tasks to rerun (scope={scope})")
        return 0

    # Collect unique task IDs and rerun keys
    rerun_task_ids = sorted(set(r.get("id") for r in rerun_entries))
    rerun_keys = {result_key(r) for r in rerun_entries}

    # 4. Print rerun plan
    scope_label = {"error": "errored", "failed": "failed", "all": "all"}
    print(f"\n{'=' * 60}")
    print(f"  RERUN PLAN")
    print(f"{'=' * 60}")
    print(f"  Source:    {run_dir}")
    print(f"  Scope:     {scope_label.get(scope, scope)}")
    print(f"  Tasks:     {len(rerun_task_ids)} tasks, {len(rerun_entries)} episodes")
    if suite_filter:
        print(f"  Suite:     {', '.join(suite_filter)}")
    if task_ids_filter:
        print(f"  Task IDs:  {', '.join(task_ids_filter)}")
    if split_spec:
        print(f"  Split:     {split_spec} ({len(split_task_ids)} ids)")
    print(f"{'=' * 60}\n")

    for tid in rerun_task_ids:
        trials = [r for r in rerun_entries if r.get("id") == tid]
        statuses = []
        for r in trials:
            if _is_error_result(r):
                statuses.append("error")
            elif r.get("is_success"):
                statuses.append("success")
            else:
                statuses.append("failed")
        if repeat_n > 1:
            print(f"  {tid} ({len(trials)} trials: {', '.join(statuses)})")
        else:
            print(f"  {tid} [{statuses[0]}]")
    print()

    # 5. Build config (clean stale temp dir first to prevent merging old residuals)
    tmp_runs_dir = run_dir / ".rerun_tmp"
    _cleanup_tmp(tmp_runs_dir)
    config = build_rerun_config(meta, args, rerun_task_ids, tmp_runs_dir)

    # Validate env_url for sim mode
    if config.device == "sim" and not config.env_url:
        print("[ERROR] --env-url is required for simulator mode")
        return 2

    # 6. Run
    try:
        if config.processes > 1:
            runner = await MultiProcessRunner.from_config(config)
        elif config.parallel > 1:
            runner = await ParallelRunner.from_config(config)
        else:
            runner = await SerialRunner.from_config(config)
        await runner.run()
    except Exception as e:
        logger.exception(f"Rerun execution failed: {e}")
        print(f"[ERROR] Rerun execution failed: {e}")
        # Still try to merge whatever results were produced
        pass

    # 7. Find the temp run output directory
    tmp_run_dir = _find_latest_run_dir(tmp_runs_dir)
    if tmp_run_dir is None:
        print("[ERROR] No rerun results produced")
        _cleanup_tmp(tmp_runs_dir)
        return 1

    # 8. Merge results back
    pass_k = meta.get("pass_k")
    summary = merge_results(run_dir, tmp_run_dir, rerun_keys, repeat_n, pass_k)

    # 9. Update meta.json with rerun history
    _append_rerun_history(run_dir, scope, rerun_task_ids)

    # 10. Cleanup temp
    _cleanup_tmp(tmp_runs_dir)

    # 11. Print summary
    print(f"\n{'=' * 60}")
    print(f"  RERUN COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Success:  {summary.get('success', 0)}")
    print(f"  Failed:   {summary.get('failed', 0)}")
    print(f"  Error:    {summary.get('error', 0)}")
    print(f"  SR:       {summary.get('success_rate', 0):.1%}")
    print(f"  Output:   {run_dir}")
    print(f"{'=' * 60}\n")

    return 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_comma_list(value: str | None) -> list[str] | None:
    if not value:
        return None
    parts = [p.strip() for p in str(value).split(",")]
    return [p for p in parts if p] or None


def _find_latest_run_dir(tmp_runs_dir: Path) -> Path | None:
    """Find the most recent timestamped run directory under tmp_runs_dir."""
    if not tmp_runs_dir.exists():
        return None
    candidates = [
        d for d in tmp_runs_dir.iterdir()
        if d.is_dir() and (d / "results.jsonl").exists()
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda d: d.name)


def _cleanup_tmp(tmp_dir: Path) -> None:
    """Remove temporary rerun directory."""
    try:
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)
    except Exception as e:
        logger.warning(f"Failed to cleanup temp dir {tmp_dir}: {e}")


def _append_rerun_history(run_dir: Path, scope: str, task_ids: list[str]) -> None:
    """Append rerun record to meta.json."""
    meta_path = run_dir / "meta.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        history = meta.get("rerun_history", [])
        history.append({
            "timestamp": datetime.now().isoformat(),
            "scope": scope,
            "tasks": task_ids,
            "count": len(task_ids),
        })
        meta["rerun_history"] = history
        meta_path.write_text(
            json.dumps(meta, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
    except Exception as e:
        logger.warning(f"Failed to update meta.json rerun_history: {e}")


def _append_prune_history(run_dir: Path, orphan_task_ids: list[str],
                          removed_episodes: int) -> None:
    """Append prune record to meta.json."""
    meta_path = run_dir / "meta.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        history = meta.get("prune_history", [])
        history.append({
            "timestamp": datetime.now().isoformat(),
            "orphan_tasks": orphan_task_ids,
            "task_count": len(orphan_task_ids),
            "removed_episodes": removed_episodes,
        })
        meta["prune_history"] = history
        meta_path.write_text(
            json.dumps(meta, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
    except Exception as e:
        logger.warning(f"Failed to update meta.json prune_history: {e}")


def _append_resume_history(run_dir: Path, task_ids: list[str]) -> None:
    """Append resume record to meta.json."""
    meta_path = run_dir / "meta.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        history = meta.get("resume_history", [])
        history.append({
            "timestamp": datetime.now().isoformat(),
            "tasks": task_ids,
            "count": len(task_ids),
        })
        meta["resume_history"] = history
        meta_path.write_text(
            json.dumps(meta, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
    except Exception as e:
        logger.warning(f"Failed to update meta.json resume_history: {e}")


# ---------------------------------------------------------------------------
# Resume orchestration
# ---------------------------------------------------------------------------

async def run_resume(args: argparse.Namespace) -> int:
    """续跑编排入口：运行被中断时尚未执行的 pending 任务。

    与 rerun 的区别：
    - rerun：重新运行已有结果但状态为 error/failed/all 的任务（替换旧结果）
    - resume：运行从未执行过的任务（追加新结果），用于恢复被中断的 run

    逻辑：
    1. 从 meta.json 重建原始任务列表（保留相同 seed，确保 sample_n 实例一致）
    2. 对比 results.jsonl，找出完全没有任何 trial 被记录的任务
    3. 运行这些 pending 任务到临时目录
    4. 追加新结果到原目录（不覆盖已有结果）
    5. 重新生成 summary.json + errors.jsonl
    """
    from bench_env.runner import SerialRunner, ParallelRunner, MultiProcessRunner
    from bench_env import factory

    # 1. 解析 run 目录
    try:
        run_dir = resolve_run_dir(args.resume)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        return 2

    # 2. 读取 meta.json + results.jsonl
    meta_path = run_dir / "meta.json"
    if not meta_path.exists():
        print(f"[ERROR] meta.json not found in {run_dir}")
        return 2
    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    results_path = run_dir / "results.jsonl"
    existing_results: list[dict] = []
    if results_path.exists():
        existing_results = load_results(results_path)

    repeat_n = meta.get("repeat_n", 1)

    # 3. 从 meta 重建原始任务列表（相同 seed → 相同实例）
    #    特殊情形：若原 run 的 task_id / task_ids filter 指向的 task 已全部被删除，
    #    factory.load_tasks 会抛 ValueError("No tasks found")（factory.py:258）。
    #    此时没有任务可以 resume —— 不视为 error，优雅退出 0，让用户可以继续跑 prune
    #    清理 orphan。保留 filter 本身（不剥离）是为了忠实于原 run 的用户意图，
    #    避免"只想跑 1 个 task 的 run"被误扩展为"整个 suite"。
    try:
        base_config = RunnerConfig.from_meta(meta)
        all_tasks = factory.load_tasks(base_config)
    except ValueError as e:
        if "No tasks found" in str(e):
            print(
                f"[INFO] Nothing to resume: the original run's task filter "
                f"(task_id / task_ids / suite in meta.json) no longer matches "
                f"any task in current code. If the run has orphan entries, "
                f"use --prune to clean them up."
            )
            return 0
        print(f"[ERROR] Failed to reconstruct original task list from meta.json: {e}")
        return 2
    except Exception as e:
        print(f"[ERROR] Failed to reconstruct original task list from meta.json: {e}")
        return 2

    # 3b. Optional --split filter (AND with whatever meta.json already restricted).
    split_spec = getattr(args, "split", None)
    if split_spec:
        from bench_env.splits import resolve_split, base_task_id
        split_task_ids = frozenset(resolve_split(split_spec))
        all_tasks = [t for t in all_tasks if base_task_id(t.id) in split_task_ids]
        if not all_tasks:
            print(f"[INFO] Nothing to resume after --split {split_spec}")
            return 0

    # 4. 分类所有任务
    #    - pending:       所有 trial 均无记录（从未运行）
    #    - partial:       有部分 trial 记录但不完整（run 中途被中断）
    #    两类均需重跑：pending 追加，partial 全部 trial 替换（保证 pass@k 数据完整）
    recorded_keys = {result_key(r) for r in existing_results}

    pending_task_ids: list[str] = []   # 从未跑过
    partial_task_ids: list[str] = []   # 跑了一部分

    for task in all_tasks:
        trial_keys = [f"{task.id}__t{t}" for t in range(repeat_n)]
        recorded_count = sum(1 for k in trial_keys if k in recorded_keys)
        if recorded_count == 0:
            pending_task_ids.append(task.id)
        elif recorded_count < repeat_n:
            partial_task_ids.append(task.id)
        # recorded_count == repeat_n → 完整，跳过

    resume_task_ids = pending_task_ids + partial_task_ids

    if not resume_task_ids:
        total_eps = len(all_tasks) * repeat_n
        print(f"[INFO] Run appears complete — {len(existing_results)}/{total_eps} episodes recorded.")
        return 0

    # 5. 打印 resume 计划
    total_eps = len(all_tasks) * repeat_n
    print(f"\n{'=' * 60}")
    print(f"  RESUME PLAN")
    print(f"{'=' * 60}")
    print(f"  Source:     {run_dir}")
    print(f"  Total:      {len(all_tasks)} tasks × {repeat_n} trials = {total_eps} episodes")
    print(f"  Recorded:   {len(existing_results)} episodes already done")
    print(f"  Pending:    {len(pending_task_ids)} tasks (never started)")
    if partial_task_ids:
        print(f"  Partial:    {len(partial_task_ids)} tasks (incomplete trials → full rerun)")
    print(f"{'=' * 60}\n")
    for tid in pending_task_ids:
        trials_label = f" × {repeat_n} trials" if repeat_n > 1 else ""
        print(f"  {tid}{trials_label} [pending]")
    for tid in partial_task_ids:
        done = sum(1 for k in recorded_keys if k.startswith(f"{tid}__t"))
        print(f"  {tid} [{done}/{repeat_n} trials done → rerun all]")
    print()

    # 6. 构建 resume 专用 config
    tmp_runs_dir = run_dir / ".resume_tmp"
    _cleanup_tmp(tmp_runs_dir)

    overrides = _collect_cli_overrides(args)
    overrides["task_ids"] = resume_task_ids
    overrides["task_id"] = None
    overrides["runs_dir"] = tmp_runs_dir
    config = RunnerConfig.from_meta(meta, overrides)

    if config.device == "sim" and not config.env_url:
        print("[ERROR] --env-url is required for simulator mode")
        return 2

    # 7. 运行
    try:
        if config.processes > 1:
            runner = await MultiProcessRunner.from_config(config)
        elif config.parallel > 1:
            runner = await ParallelRunner.from_config(config)
        else:
            runner = await SerialRunner.from_config(config)
        await runner.run()
    except Exception as e:
        logger.exception(f"Resume execution failed: {e}")
        print(f"[ERROR] Resume execution failed: {e}")

    # 8. 找到临时目录下的输出
    tmp_run_dir = _find_latest_run_dir(tmp_runs_dir)
    if tmp_run_dir is None:
        print("[ERROR] No resume results produced")
        _cleanup_tmp(tmp_runs_dir)
        return 1

    # 9. 合并回原目录
    #    - pending 任务的结果：追加（merge_results 的 defensive add 分支）
    #    - partial 任务的旧 trial 结果：被新结果替换（merge_results 的 replace 分支）
    #    rerun_keys = 所有本次运行的 (task_id, trial_id) 组合，用于 trajectory 替换
    pass_k = meta.get("pass_k")
    rerun_keys: set[str] = set()
    for tid in resume_task_ids:
        for t in range(repeat_n):
            rerun_keys.add(f"{tid}__t{t}")

    summary = merge_results(run_dir, tmp_run_dir, rerun_keys, repeat_n, pass_k)

    # 10. 更新 meta.json resume 历史
    _append_resume_history(run_dir, resume_task_ids)

    # 11. 清理临时目录
    _cleanup_tmp(tmp_runs_dir)

    # 12. 打印最终摘要
    print(f"\n{'=' * 60}")
    print(f"  RESUME COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Resumed:  {len(pending_task_ids)} pending + {len(partial_task_ids)} partial tasks")
    print(f"  Success:  {summary.get('success', 0)}")
    print(f"  Failed:   {summary.get('failed', 0)}")
    print(f"  Error:    {summary.get('error', 0)}")
    print(f"  SR:       {summary.get('success_rate', 0):.1%}")
    print(f"  Output:   {run_dir}")
    print(f"{'=' * 60}\n")

    return 0


# ---------------------------------------------------------------------------
# Prune (registry / split orphans)
# ---------------------------------------------------------------------------

async def run_prune(args: argparse.Namespace) -> int:
    """Prune results.jsonl entries outside the current valid task set.

    Valid set = ``{task_ids produced by factory.load_tasks(meta)}``
    intersected with ``--split`` whitelist (if given).
    Anything else in results.jsonl is pruned:
      - Task classes deleted/renamed in code (classic "orphan")
      - Tasks not in the requested split (if ``--split`` passed)

    Flow:
        1. Resolve run dir, load meta.json + results.jsonl
        2. Rebuild current task_ids via factory.load_tasks (mirrors resume)
        3. If --split given, intersect current_task_ids with split base ids
        4. Compute prune entries (respecting optional --suite / --task-ids filters)
        5. Print plan; if --dry-run, stop here
        6. Backup results/errors/summary to .bak
        7. Rewrite results.jsonl without pruned entries, remove their trajectory dirs
        8. Regenerate summary.json + errors.jsonl
        9. Append prune_history to meta.json
    """
    from bench_env import factory

    # 1. Resolve run dir (accepts either --prune or the legacy --prune-orphans)
    target = getattr(args, "prune", None) or getattr(args, "prune_orphans", None)
    try:
        run_dir = resolve_run_dir(target)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        return 2

    # 2. Load meta + results
    meta_path = run_dir / "meta.json"
    if not meta_path.exists():
        print(f"[ERROR] meta.json not found in {run_dir}")
        return 2
    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    results_path = run_dir / "results.jsonl"
    if not results_path.exists():
        print(f"[INFO] results.jsonl not found in {run_dir}, nothing to prune")
        return 0
    existing_results = load_results(results_path)
    if not existing_results:
        print("[INFO] results.jsonl is empty, nothing to prune")
        return 0

    repeat_n = meta.get("repeat_n", 1)

    # 3. Rebuild current task_ids
    # Prune's job is "enumerate every task_id the current code can produce and
    # diff against results.jsonl". Any narrowing filter frozen into meta.json
    # from the original run is a liability here — if the original filter now
    # matches nothing (deleted task, deleted suite, filter_difficulty no longer
    # covered, etc.), factory.load_tasks raises and prune fails on the exact
    # case it should handle. So strip every narrowing field from a meta copy.
    # Keep sample_n / sample_seed so sampled instance ids (_iN) match
    # results.jsonl deterministically.
    # RunnerConfig.from_meta overrides only apply when value is non-None
    # (config.py:272), so mutate the copy directly.
    meta_for_enum = dict(meta)
    # All narrowing fields consumed by factory.load_tasks — mirrors the full
    # set at factory.py:167-171 (_apply_task_filters) plus factory.py:229
    # (filter_has_answer_fields) plus the early task_id/task_ids/suite filters.
    # filter_mode is the AND/OR combinator for these lists; with every list set
    # to None, _apply_task_filters short-circuits and filter_mode is moot.
    # `split` is also wiped so we get the full registry here; the split filter
    # is then applied as a single explicit layer below (CLI arg > meta default).
    for field in (
        "task_id", "task_ids", "suite",
        "filter_difficulty", "filter_objective", "filter_composition",
        "filter_scope", "filter_capabilities",
        "filter_has_answer_fields",
        "split",
    ):
        meta_for_enum[field] = None
    try:
        base_config = RunnerConfig.from_meta(meta_for_enum)
        all_tasks = factory.load_tasks(base_config)
    except Exception as e:
        print(f"[ERROR] Failed to reconstruct task list from meta.json: {e}")
        return 2
    current_task_ids = {t.id for t in all_tasks}

    # 3b. CLI --split overrides meta; otherwise inherit from the original run.
    #     Intersect valid set with the resolved whitelist — anything outside
    #     (registry ∩ split) becomes a prune candidate.
    split_spec = getattr(args, "split", None) or meta.get("split")
    split_task_ids: frozenset[str] | None = None
    if split_spec:
        from bench_env.splits import resolve_split, base_task_id
        split_task_ids = frozenset(resolve_split(split_spec))
        current_task_ids = {tid for tid in current_task_ids if base_task_id(tid) in split_task_ids}

    # 4. Compute orphan entries (with optional filters)
    suite_filter = _parse_comma_list(getattr(args, "suite", None))
    task_ids_filter = _parse_comma_list(getattr(args, "task_ids", None))
    single_task_id = getattr(args, "task_id", None)
    if single_task_id and not task_ids_filter:
        task_ids_filter = [single_task_id]

    suite_set = set(suite_filter) if suite_filter else None
    tid_filter_set = set(task_ids_filter) if task_ids_filter else None

    def _matches_user_task_filter(result_id: str) -> bool:
        """Match behavior mirrors rerun/factory: exact id OR base-id for _iN instances."""
        if tid_filter_set is None:
            return True
        if result_id in tid_filter_set:
            return True
        return any(result_id.startswith(f"{tid}_i") for tid in tid_filter_set)

    orphan_entries: list[dict] = []
    for r in existing_results:
        tid = r.get("id", "")
        if tid in current_task_ids:
            continue
        if suite_set and r.get("suite") not in suite_set:
            continue
        if not _matches_user_task_filter(tid):
            continue
        orphan_entries.append(r)

    if not orphan_entries:
        print("[INFO] No entries to prune — results.jsonl already matches the valid task set")
        return 0

    orphan_task_ids = sorted({r.get("id") for r in orphan_entries})

    # 5. Print plan
    dry_run = bool(getattr(args, "dry_run", False))
    print(f"\n{'=' * 60}")
    print(f"  PRUNE {'(DRY RUN)' if dry_run else ''}")
    print(f"{'=' * 60}")
    print(f"  Source:    {run_dir}")
    print(f"  Pruning:   {len(orphan_task_ids)} tasks, {len(orphan_entries)} episodes")
    if split_spec:
        print(f"  Split:     {split_spec} ({len(split_task_ids)} ids — valid = registry ∩ split)")
    else:
        print(f"  Valid:     registry ({len(current_task_ids)} ids)")
    if suite_filter:
        print(f"  Suite:     {', '.join(suite_filter)}")
    if task_ids_filter:
        print(f"  Task IDs:  {', '.join(task_ids_filter)}")
    print(f"{'=' * 60}")
    for tid in orphan_task_ids:
        ep_count = sum(1 for r in orphan_entries if r.get("id") == tid)
        suffix = f" × {ep_count} episodes" if ep_count > 1 else ""
        print(f"  {tid}{suffix}")
    print()

    if dry_run:
        print("[DRY RUN] No files modified. Re-run without --dry-run to apply.")
        return 0

    # 6. Backup
    for fname in ["results.jsonl", "errors.jsonl", "summary.json"]:
        src = run_dir / fname
        if src.exists():
            # Shared run directories may allow content writes but reject metadata
            # updates (mtime/mode) for files owned by another user.
            shutil.copyfile(src, src.with_suffix(f".{fname.split('.')[-1]}.bak"))

    # 7. Rewrite results.jsonl without orphans
    orphan_keys = {result_key(r) for r in orphan_entries}
    kept_results = [r for r in existing_results if result_key(r) not in orphan_keys]
    with open(results_path, "w", encoding="utf-8") as f:
        for r in kept_results:
            f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")

    # Remove orphan trajectory directories
    traj_root = run_dir / "trajectory"
    traj_removed = 0
    if traj_root.exists():
        for r in orphan_entries:
            tid = r.get("id")
            trial = int(r.get("trial_id", 0))
            dir_name = _task_dir_name(tid, trial, repeat_n)
            d = traj_root / dir_name
            if d.exists() or d.is_symlink():
                _remove_path(d)
                traj_removed += 1

    logger.info(
        f"[PRUNE] Removed {len(orphan_entries)} entries, {traj_removed} trajectory dirs"
    )

    # 8. Regenerate summary + errors
    pass_k = meta.get("pass_k")
    summary = _regenerate_summary(run_dir, kept_results, repeat_n, pass_k)
    _regenerate_errors(run_dir, kept_results)

    # 9. Record in meta.json
    _append_prune_history(run_dir, orphan_task_ids, len(orphan_entries))

    # 10. Print final summary
    print(f"\n{'=' * 60}")
    print(f"  PRUNE COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Removed:   {len(orphan_task_ids)} tasks, {len(orphan_entries)} episodes")
    print(f"  Trajectories cleaned: {traj_removed}")
    print(f"  Remaining: {summary.get('total_episodes', 0)} episodes")
    print(f"  Output:    {run_dir}")
    print(f"{'=' * 60}\n")

    return 0


# Backward-compatible alias: callers that imported run_prune_orphans still work.
run_prune_orphans = run_prune
