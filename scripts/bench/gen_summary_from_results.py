#!/usr/bin/env python3
"""
从 results.jsonl 生成 summary.json 统计汇总。

使用方式:
    python scripts/bench/gen_summary_from_results.py <run_dir> [--output summary.json]

示例:
    python scripts/bench/gen_summary_from_results.py runs/autoglm_grounded_loop_detect_10/20260411_211551
    python scripts/bench/gen_summary_from_results.py runs/autoglm_grounded_loop_detect_10/20260411_211551 --output summary.json
"""

import argparse
import json
from pathlib import Path
from typing import Any


def load_records(run_dir: Path) -> list[dict[str, Any]]:
    """从 results.jsonl 加载所有记录。"""
    records = []
    results_file = run_dir / "results.jsonl"
    if not results_file.exists():
        raise FileNotFoundError(f"results.jsonl 不存在: {run_dir}")

    with open(results_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def compute_stats(records: list[dict[str, Any]]) -> dict[str, Any]:
    """
    从记录计算所有统计指标。

    返回包含以下字段的字典:
    - start_time/end_time: ISO 格式时间戳
    - total_tasks/total_episodes: 总任务数
    - repeat_n: 重复次数（总为 1）
    - success/failed/error: 成功/失败/错误任务计数
    - success_rate: 成功率
    - avg_steps: 平均步数
    - avg_runtime_s: 平均运行时间（秒）
    - success_tasks/failed_tasks/error_tasks: 任务 ID 列表
    """
    valid = [r for r in records if not r.get("is_error", False)]
    success_list = [r for r in valid if r.get("is_success", False)]
    error_list = [r for r in records if r.get("is_error", False)]
    failed_list = [r for r in valid if not r.get("is_success", False)]

    n = len(valid)
    success_count = len(success_list)
    error_count = len(error_list)
    failed_count = len(failed_list)

    if n == 0:
        return {
            "start_time": "",
            "end_time": "",
            "total_tasks": 0,
            "total_episodes": 0,
            "repeat_n": 1,
            "success": 0,
            "failed": 0,
            "error": 0,
            "success_rate": 0.0,
            "avg_steps": 0.0,
            "avg_runtime_s": 0.0,
            "success_tasks": [],
            "failed_tasks": [],
            "error_tasks": [],
        }

    # 提取时间戳
    start_time = ""
    end_time = ""
    if records:
        if "start_time" in records[0]:
            start_time = records[0]["start_time"]
        if "end_time" in records[-1]:
            end_time = records[-1]["end_time"]

    # 计算步数和运行时间
    steps_all = [r["execution"]["steps"] for r in valid if "execution" in r]
    runtimes = [r["execution"]["runtime_s"] for r in valid if "execution" in r and "runtime_s" in r["execution"]]

    avg_steps = sum(steps_all) / len(steps_all) if steps_all else 0.0
    avg_runtime_s = sum(runtimes) / len(runtimes) if runtimes else 0.0

    # 收集任务 ID 列表
    success_tasks = [r["id"] for r in success_list if "id" in r]
    failed_tasks = [r["id"] for r in failed_list if "id" in r]
    error_tasks = [r["id"] for r in error_list if "id" in r]

    return {
        "start_time": start_time,
        "end_time": end_time,
        "total_tasks": n + error_count,
        "total_episodes": n + error_count,
        "repeat_n": 1,
        "success": success_count,
        "failed": failed_count,
        "error": error_count,
        "success_rate": success_count / (n + error_count) if (n + error_count) > 0 else 0.0,
        "avg_steps": avg_steps,
        "avg_runtime_s": avg_runtime_s,
        "success_tasks": success_tasks,
        "failed_tasks": failed_tasks,
        "error_tasks": error_tasks,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="从 results.jsonl 生成 summary.json 统计汇总"
    )
    parser.add_argument("run_dir", type=Path, help="run 目录路径")
    parser.add_argument(
        "--output",
        type=str,
        default="summary.json",
        help="输出文件名 (默认: summary.json)",
    )
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()
    if not run_dir.is_dir():
        raise NotADirectoryError(f"不是目录: {run_dir}")

    records = load_records(run_dir)
    stats = compute_stats(records)

    output_path = run_dir / args.output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    print(f"[✓] 统计结果已保存至 {output_path}")
    print(f"\n统计摘要:")
    print(f"  时间范围       : {stats['start_time']} ~ {stats['end_time']}")
    print(f"  总任务数       : {stats['total_tasks']}")
    print(f"  成功任务数     : {stats['success']}")
    print(f"  失败任务数     : {stats['failed']}")
    print(f"  错误任务数     : {stats['error']}")
    print(f"  成功率         : {stats['success_rate']:.2%}")
    print(f"  平均步数       : {stats['avg_steps']:.2f}")
    print(f"  平均运行时间   : {stats['avg_runtime_s']:.2f}s")


if __name__ == "__main__":
    main()
