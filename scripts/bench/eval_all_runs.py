#!/usr/bin/env python3
"""
统计多个运行目录的指标，生成汇总 markdown 报告。

Usage:
    python scripts/bench/eval_all_runs.py runs other-runs
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path
import sys


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
    if not group:
        return 0, 0, 0.0
    s = sum(1 for r in group if r.get("is_success", False))
    n = len(group)
    return s, n, s / n


def compute_metrics(records):
    """计算指标"""
    valid = [r for r in records if not r.get("is_error", False)]
    if not valid:
        return None

    success = [r for r in valid if r.get("is_success", False)]
    n = len(valid)

    progress_rate = sum(r.get("progress", 0) for r in valid) / n if valid else 0
    n_premature = sum(1 for r in valid if r.get("premature_termination", False))
    # 从原始字段重算，避免历史 run 用旧定义（旧定义 = 只要 truncated）导致数据不可比
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

    # 按维度统计
    dims = {}
    for dim in ["difficulty", "scope", "objective", "composition"]:
        groups = defaultdict(list)
        for r in valid:
            groups[r.get(dim, "?")].append(r)
        dims[dim] = {k: succ_rate(v) for k, v in groups.items()}

    return metrics, dims


def find_all_runs(base_dirs):
    """递归查找所有包含 results.jsonl 的运行目录"""
    runs = []

    for base_dir in base_dirs:
        base_path = Path(base_dir)
        if not base_path.exists():
            print(f"[WARN] Directory not found: {base_dir}", file=sys.stderr)
            continue

        # 查找所有包含 results.jsonl 的目录
        for results_file in base_path.rglob("results.jsonl"):
            run_dir = results_file.parent
            runs.append(run_dir)

    return sorted(runs)


def extract_run_name(run_dir: Path, base_dirs) -> str:
    """从路径中提取运行名称"""
    for base_dir in base_dirs:
        base_path = Path(base_dir)
        if run_dir.is_relative_to(base_path):
            # 返回相对路径
            rel = run_dir.relative_to(base_path)
            return str(rel)
    return str(run_dir)


def generate_markdown_report(runs_with_metrics, output_file):
    """生成 markdown 报告"""
    lines = [
        "# 运行指标汇总报告\n",
        f"生成时间: {Path(output_file).resolve()}\n\n",
        "## 运行列表\n\n",
        "| 运行名称 | 成功率 | 进度率 | 平均步数 | 总任务数 | 成功数 | 提前终止 | 超时 | 副作用 |\n",
        "|--------|--------|--------|---------|---------|--------|---------|------|--------|\n",
    ]

    for run_name, metrics, dims in runs_with_metrics:
        if metrics is None:
            lines.append(f"| {run_name} | ❌ 无有效数据 | - | - | - | - | - | - | - |\n")
            continue

        m = metrics
        success_fmt = f"{m['success_count']}/{m['total_episodes']}"

        lines.append(
            f"| {run_name} "
            f"| {m['success_rate']:.1%} ({success_fmt}) "
            f"| {m['progress_rate']:.1%} "
            f"| {m['avg_steps_all']:.2f} "
            f"| {m['total_episodes']} "
            f"| {m['success_count']} "
            f"| {m['premature_count']} "
            f"| {m['overdue_count']} "
            f"| {m['side_effects_count']} |\n"
        )

    lines.append("\n## 详细指标\n\n")

    for run_name, metrics, dims in runs_with_metrics:
        if metrics is None:
            continue

        m = metrics
        lines.append(f"### {run_name}\n\n")
        lines.append(f"- **成功率**: {m['success_rate']:.2%} ({m['success_count']}/{m['total_episodes']})\n")
        lines.append(f"- **进度率**: {m['progress_rate']:.2%}\n")
        lines.append(f"- **平均步数 (所有)**: {m['avg_steps_all']:.2f}\n")
        lines.append(f"- **平均步数 (成功)**: {m['avg_steps_suc']:.2f}\n")
        lines.append(f"- **提前终止**: {m['premature_count']}/{m['total_episodes']} ({m['premature_rate']:.1%})\n")
        lines.append(f"- **超时终止**: {m['overdue_count']}/{m['total_episodes']} ({m['overdue_rate']:.1%})\n")
        lines.append(f"- **副作用**: {m['side_effects_count']}/{m['total_episodes']} ({m['side_effects_rate']:.1%})\n")

        # 按难度统计
        lines.append("\n**按难度分布**:\n")
        for key in sorted(["L1", "L2", "L3", "L4"]):
            if key in dims["difficulty"]:
                s, n, r = dims["difficulty"][key]
                lines.append(f"- {key}: {r:.1%} ({s}/{n})\n")

        # 按范围统计
        lines.append("\n**按范围分布**:\n")
        for key in sorted(["S1", "S2", "S3"]):
            if key in dims["scope"]:
                s, n, r = dims["scope"][key]
                lines.append(f"- {key}: {r:.1%} ({s}/{n})\n")

        # 按目标分布
        lines.append("\n**按目标分布**:\n")
        for key in sorted(["operate", "query", "hybrid"]):
            if key in dims["objective"]:
                s, n, r = dims["objective"][key]
                lines.append(f"- {key}: {r:.1%} ({s}/{n})\n")

        # 按组成分布
        lines.append("\n**按组成分布**:\n")
        for key in sorted(["atomic", "sequential", "deep_dive", "transfer"]):
            if key in dims["composition"]:
                s, n, r = dims["composition"][key]
                lines.append(f"- {key}: {r:.1%} ({s}/{n})\n")

        lines.append("\n")

    with open(output_file, "w", encoding="utf-8") as f:
        f.writelines(lines)


def main():
    parser = argparse.ArgumentParser(
        description="统计多个运行目录的指标，生成汇总 markdown 报告"
    )
    parser.add_argument(
        "base_dirs",
        nargs="+",
        help="运行目录（支持多个）"
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default="runs_metrics_report.md",
        help="输出 markdown 文件路径"
    )
    args = parser.parse_args()

    print(f"[*] 搜索运行目录中...")
    runs = find_all_runs(args.base_dirs)
    print(f"[✓] 找到 {len(runs)} 个运行")

    print(f"\n[*] 计算指标中...")
    runs_with_metrics = []
    for i, run_dir in enumerate(runs, 1):
        run_name = extract_run_name(run_dir, args.base_dirs)
        print(f"  [{i}/{len(runs)}] {run_name}...", end=" ", flush=True)

        records = load_records(run_dir)
        if records is None:
            print("⚠️  跳过 (无法加载)")
            runs_with_metrics.append((run_name, None, None))
            continue

        result = compute_metrics(records)
        if result is None:
            print("⚠️  跳过 (无有效数据)")
            runs_with_metrics.append((run_name, None, None))
            continue

        metrics, dims = result
        print(f"✓ ({metrics['success_rate']:.1%})")
        runs_with_metrics.append((run_name, metrics, dims))

    print(f"\n[*] 生成报告中...")
    generate_markdown_report(runs_with_metrics, args.output)
    print(f"[✓] 报告已保存到: {args.output}")


if __name__ == "__main__":
    main()
