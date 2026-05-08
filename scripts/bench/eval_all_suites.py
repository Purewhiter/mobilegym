#!/usr/bin/env python3
"""
批量统计所有运行的 suite 和 crossapp 指标，生成汇总 markdown。

Usage:
    python scripts/bench/eval_all_suites.py runs other-runs -o report.md
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path


def load_records(run_dir: Path):
    """加载 results.jsonl"""
    results_path = run_dir / "results.jsonl"
    if not results_path.exists():
        return None

    records = []
    try:
        with open(results_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    except Exception as e:
        print(f"[WARN] Failed to load {results_path}: {e}", file=sys.stderr)
        return None

    return records if records else None


def succ_rate(group):
    """计算成功率"""
    if not group:
        return 0, 0, 0.0
    s = sum(1 for r in group if r.get("is_success", False))
    n = len(group)
    return s, n, s / n


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
    """识别 crossapp 类型"""
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


def find_all_runs(base_dirs):
    """递归查找所有包含 results.jsonl 的运行目录"""
    runs = []
    for base_dir in base_dirs:
        base_path = Path(base_dir)
        if not base_path.exists():
            print(f"[WARN] Directory not found: {base_dir}", file=sys.stderr)
            continue

        for results_file in base_path.rglob("results.jsonl"):
            run_dir = results_file.parent
            runs.append(run_dir)

    return sorted(runs)


def extract_run_name(run_dir: Path, base_dirs) -> str:
    """从路径中提取运行名称"""
    for base_dir in base_dirs:
        base_path = Path(base_dir)
        try:
            if run_dir.is_relative_to(base_path):
                rel = run_dir.relative_to(base_path)
                return str(rel)
        except ValueError:
            pass
    return str(run_dir)


def generate_markdown_report(runs_with_stats, output_file):
    """生成 markdown 报告"""
    lines = [
        "# 运行 Suite & CrossApp 统计报告\n\n",
    ]

    # 收集所有 suite 和 crossapp 类型
    all_suites = set()
    all_crossapp_types = {"crossapp_task", "crossapp_operation", "crossapp_query", "crossapp_navigation"}

    for run_name, suite_stats, crossapp_stats in runs_with_stats:
        if suite_stats:
            all_suites.update(suite_stats.keys())

    all_suites = sorted(all_suites)

    # ===== Suite 统计汇总表 =====
    lines.append("## Suite 统计汇总\n\n")
    lines.append("| 运行名称 | " + " | ".join(all_suites) + " |\n")
    lines.append("|" + "|".join(["---"] * (len(all_suites) + 1)) + "|\n")

    for run_name, suite_stats, crossapp_stats in runs_with_stats:
        if not suite_stats:
            continue
        row = f"| {run_name} |"
        for suite in all_suites:
            if suite in suite_stats:
                s = suite_stats[suite]['success']
                n = suite_stats[suite]['total']
                r = suite_stats[suite]['rate']
                row += f" {r:.1%}<br>({s}/{n}) |"
            else:
                row += " - |"
        row += "\n"
        lines.append(row)

    # ===== CrossApp 类型统计汇总表 =====
    lines.append("\n## CrossApp 类型统计汇总\n\n")
    lines.append("| 运行名称 | crossapp_task | crossapp_operation | crossapp_query | crossapp_navigation |\n")
    lines.append("|" + "|".join(["---"] * 5) + "|\n")

    for run_name, suite_stats, crossapp_stats in runs_with_stats:
        if not crossapp_stats:
            continue
        row = f"| {run_name} |"
        for ctype in ["crossapp_task", "crossapp_operation", "crossapp_query", "crossapp_navigation"]:
            stat = crossapp_stats[ctype]
            s = stat['success']
            n = stat['total']
            r = stat['rate']
            if n > 0:
                row += f" {r:.1%}<br>({s}/{n}) |"
            else:
                row += " - |"
        row += "\n"
        lines.append(row)

    # ===== 详细运行报告 =====
    lines.append("\n## 详细运行报告\n\n")

    for run_name, suite_stats, crossapp_stats in runs_with_stats:
        if not suite_stats and not crossapp_stats:
            lines.append(f"### {run_name}\n\n**无有效数据**\n\n")
            continue

        lines.append(f"### {run_name}\n\n")

        # Suite 详情
        if suite_stats:
            lines.append("**按 Suite 分布**:\n\n")
            lines.append("| Suite | 成功率 | 任务数 |\n")
            lines.append("|------|--------|--------|\n")
            for suite in sorted(suite_stats.keys()):
                s = suite_stats[suite]['success']
                n = suite_stats[suite]['total']
                r = suite_stats[suite]['rate']
                lines.append(f"| {suite} | {r:.2%} ({s}/{n}) | {n} |\n")
            lines.append("\n")

        # CrossApp 详情
        if crossapp_stats:
            lines.append("**按 CrossApp 类型分布**:\n\n")
            lines.append("| 类型 | 成功率 | 任务数 |\n")
            lines.append("|------|--------|--------|\n")
            for ctype in ["crossapp_task", "crossapp_operation", "crossapp_query", "crossapp_navigation"]:
                stat = crossapp_stats[ctype]
                s = stat['success']
                n = stat['total']
                r = stat['rate']
                if n > 0:
                    lines.append(f"| {ctype} | {r:.2%} ({s}/{n}) | {n} |\n")
                else:
                    lines.append(f"| {ctype} | - | 0 |\n")
            lines.append("\n")

    with open(output_file, "w", encoding="utf-8") as f:
        f.writelines(lines)


def main():
    parser = argparse.ArgumentParser(
        description="批量统计所有运行的 suite 和 crossapp 指标"
    )
    parser.add_argument(
        "base_dirs",
        nargs="+",
        help="运行目录（支持多个）"
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default="runs_suite_crossapp_report.md",
        help="输出 markdown 文件路径"
    )
    args = parser.parse_args()

    print(f"[*] 搜索运行目录中...")
    runs = find_all_runs(args.base_dirs)
    print(f"[✓] 找到 {len(runs)} 个运行")

    print(f"\n[*] 计算指标中...")
    runs_with_stats = []
    for i, run_dir in enumerate(runs, 1):
        run_name = extract_run_name(run_dir, args.base_dirs)
        print(f"  [{i}/{len(runs)}] {run_name}...", end=" ", flush=True)

        records = load_records(run_dir)
        if records is None:
            print("⚠️  跳过 (无法加载)")
            runs_with_stats.append((run_name, None, None))
            continue

        suite_stats = compute_by_suite(records)
        crossapp_stats = compute_crossapp_stats(records)
        print(f"✓")
        runs_with_stats.append((run_name, suite_stats, crossapp_stats))

    print(f"\n[*] 生成报告中...")
    generate_markdown_report(runs_with_stats, args.output)
    print(f"[✓] 报告已保存到: {args.output}")


if __name__ == "__main__":
    exit(main())
