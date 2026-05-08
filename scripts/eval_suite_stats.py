#!/usr/bin/env python3
"""
按 suite 和 crossapp 类型统计运行指标。

Usage:
    python scripts/eval_suite_stats.py <run_dir> [--model <name>]

Example:
    python scripts/eval_suite_stats.py runs/20260414_103617
    python scripts/eval_suite_stats.py /data2/rui.hao/runs/20260401_094147 --model generic_v2
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path


def load_records(run_dir: Path):
    """加载 results.jsonl"""
    records = []
    with open(run_dir / "results.jsonl") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def succ_rate(group):
    """计算成功率"""
    if not group:
        return 0, 0, 0.0
    s = sum(1 for r in group if r.get("is_success", False))
    n = len(group)
    return s, n, s / n


def compute_metrics(records):
    """计算整体指标"""
    valid = [r for r in records if not r.get("is_error", False)]
    if not valid:
        return None

    success = [r for r in valid if r.get("is_success", False)]
    n = len(valid)

    progress_rate = sum(r.get("progress", 0) for r in valid) / n if valid else 0
    n_premature = sum(1 for r in valid if r.get("premature_termination", False))
    n_overdue = sum(
        1 for r in valid
        if r.get("execution", {}).get("truncated", False)
        and r.get("judge", {}).get("success", False)
    )
    n_side = sum(1 for r in valid if not r.get("judge", {}).get("clean", True))
    steps_all = [r["execution"]["steps"] for r in valid if "execution" in r]
    steps_suc = [r["execution"]["steps"] for r in success if "execution" in r]

    metrics = {
        "total_episodes": n,
        "success_count": len(success),
        "success_rate": len(success) / n if n > 0 else 0,
        "progress_rate": progress_rate,
        "premature_count": n_premature,
        "premature_rate": n_premature / n if n > 0 else 0,
        "overdue_count": n_overdue,
        "overdue_rate": n_overdue / n if n > 0 else 0,
        "side_effects_count": n_side,
        "side_effects_rate": n_side / n if n > 0 else 0,
        "avg_steps_all": sum(steps_all) / len(steps_all) if steps_all else 0,
        "avg_steps_suc": sum(steps_suc) / len(steps_suc) if steps_suc else 0,
    }

    return metrics


def compute_by_suite(records):
    """按 suite 统计"""
    valid = [r for r in records if not r.get("is_error", False)]

    groups = defaultdict(list)
    for r in valid:
        suite = r.get("suite", "unknown")
        groups[suite].append(r)

    stats = {}
    for suite, group in sorted(groups.items()):
        s, n, r = succ_rate(group)
        stats[suite] = {
            "success": s,
            "total": n,
            "rate": r,
        }

    return stats


def is_crossapp_task(task_id: str) -> str | None:
    """识别 crossapp 类型：
    - 'crossapp_task'：包含 'crossapp_task' 的任务
    - 'crossapp_operation'：包含 'crossapp_operation' 的任务
    - 'crossapp_query'：包含 'crossapp_query' 的任务
    - 'crossapp_navigation'：包含 'crossapp_navigation' 的任务
    - None：不是 crossapp
    """
    if "crossapp_task" in task_id:
        return "crossapp_task"
    if "crossapp_operation" in task_id:
        return "crossapp_operation"
    if "crossapp_query" in task_id:
        return "crossapp_query"
    if "crossapp_navigation" in task_id:
        return "crossapp_navigation"
    return None


def compute_crossapp_stats(records):
    """按 crossapp 类型统计"""
    valid = [r for r in records if not r.get("is_error", False)]

    groups = defaultdict(list)
    for r in valid:
        task_id = r.get("id", "")
        crossapp_type = is_crossapp_task(task_id)
        if crossapp_type:
            groups[crossapp_type].append(r)

    stats = {}
    for ctype in ["crossapp_task", "crossapp_operation", "crossapp_query", "crossapp_navigation"]:
        if ctype in groups:
            group = groups[ctype]
            s, n, r = succ_rate(group)
            stats[ctype] = {
                "success": s,
                "total": n,
                "rate": r,
            }
        else:
            stats[ctype] = {
                "success": 0,
                "total": 0,
                "rate": 0.0,
            }

    return stats


def fmt_pct(s, n, r):
    """格式化成功率"""
    return f"{r:.2%} ({s}/{n})"


def print_overall_report(model, metrics):
    """打印总体报告"""
    if metrics is None:
        print(f"\n[ERROR] No valid data")
        return

    m = metrics
    print(f"\n{'='*70}")
    print(f"Model: {model}")
    print(f"{'='*70}")
    print(f"Success Rate              : {m['success_rate']:.2%} ({m['success_count']}/{m['total_episodes']})")
    print(f"Progress Rate             : {m['progress_rate']:.2%}")
    print(f"Premature Termination Rate: {m['premature_rate']:.2%} ({m['premature_count']}/{m['total_episodes']})")
    print(f"Overdue Termination Rate  : {m['overdue_rate']:.2%} ({m['overdue_count']}/{m['total_episodes']})")
    print(f"Unexpected Side Effects   : {m['side_effects_rate']:.2%} ({m['side_effects_count']}/{m['total_episodes']})")
    print(f"Avg Steps (all)           : {m['avg_steps_all']:.2f}")
    print(f"Avg Steps (success)       : {m['avg_steps_suc']:.2f}")


def print_suite_stats(suite_stats):
    """打印 suite 统计"""
    print(f"\n{'='*70}")
    print(f"Suite Breakdown")
    print(f"{'='*70}")
    print(f"{'Suite':<30} {'Success Rate':<20} {'Count':<15}")
    print(f"{'-'*70}")

    for suite, stat in sorted(suite_stats.items()):
        s = stat['success']
        n = stat['total']
        r = stat['rate']
        print(f"{suite:<30} {fmt_pct(s, n, r):<20} {n:>5} tasks")


def print_crossapp_stats(crossapp_stats):
    """打印 crossapp 统计"""
    print(f"\n{'='*70}")
    print(f"CrossApp Type Breakdown")
    print(f"{'='*70}")
    print(f"{'Type':<30} {'Success Rate':<20} {'Count':<15}")
    print(f"{'-'*70}")

    for ctype in ["crossapp_task", "crossapp_operation", "crossapp_query", "crossapp_navigation"]:
        stat = crossapp_stats[ctype]
        s = stat['success']
        n = stat['total']
        r = stat['rate']
        status = "✓" if n > 0 else "✗"
        print(f"{ctype:<30} {fmt_pct(s, n, r) if n > 0 else 'N/A':<20} {n:>5} tasks {status}")


def main():
    parser = argparse.ArgumentParser(
        description="按 suite 和 crossapp 类型统计运行指标"
    )
    parser.add_argument("run_dir", type=Path, help="运行目录")
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="模型名称 (默认使用父目录名)"
    )
    args = parser.parse_args()

    run_dir = args.run_dir
    if not (run_dir / "results.jsonl").exists():
        print(f"[ERROR] {run_dir}/results.jsonl not found")
        return 1

    model = args.model or run_dir.parent.name

    # 加载记录
    records = load_records(run_dir)
    print(f"[*] Loaded {len(records)} records from {run_dir}")

    # 计算指标
    metrics = compute_metrics(records)
    suite_stats = compute_by_suite(records)
    crossapp_stats = compute_crossapp_stats(records)

    # 打印报告
    print_overall_report(model, metrics)
    print_suite_stats(suite_stats)
    print_crossapp_stats(crossapp_stats)

    return 0


if __name__ == "__main__":
    exit(main())
