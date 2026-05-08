"""
Usage:
    python scripts/bench/eval_run.py <run_dir> [--model <name>]

Example:
    python scripts/bench/eval_run.py runs/qwen3-vl-4b_grounded_loop_detect_8/20260411_223017
    python scripts/bench/eval_run.py runs/qwen3-vl-4b_grounded_loop_detect_8/20260411_223017 --model qwen3-vl-4b
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path


def load_records(run_dir: Path):
    records = []
    with open(run_dir / "results.jsonl") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def succ_rate(group):
    if not group:
        return 0, 0, 0.0
    s = sum(1 for r in group if r.get("is_success", False))
    n = len(group)
    return s, n, s / n


def compute(records):
    valid = [r for r in records if not r.get("is_error", False)]
    success = [r for r in valid if r.get("is_success", False)]
    n = len(valid)

    progress_rate = sum(r.get("progress", 0) for r in valid) / n
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

    main = {
        "success_rate": (len(success), n, len(success) / n),
        "progress_rate": progress_rate,
        "premature_rate": (n_premature, n, n_premature / n),
        "overdue_rate": (n_overdue, n, n_overdue / n),
        "side_effects_rate": (n_side, n, n_side / n),
        "avg_steps_all": sum(steps_all) / len(steps_all) if steps_all else 0,
        "avg_steps_suc": sum(steps_suc) / len(steps_suc) if steps_suc else 0,
    }

    dims = {}
    for dim in ["difficulty", "scope", "objective", "composition"]:
        groups = defaultdict(list)
        for r in valid:
            groups[r.get(dim, "?")].append(r)
        dims[dim] = {k: succ_rate(v) for k, v in groups.items()}

    return main, dims, valid


def fmt_pct(s, n, r):
    return f"{r:.2%} ({s}/{n})"


def print_report(model, main, dims):
    m = main
    s, n, r = m["success_rate"]
    print(f"\nModel: {model}")
    print(f"  Success Rate              : {fmt_pct(s, n, r)}")
    print(f"  Progress Rate             : {m['progress_rate']:.2%}")
    s, n, r = m["premature_rate"]
    print(f"  Premature Termination Rate: {fmt_pct(s, n, r)}")
    s, n, r = m["overdue_rate"]
    print(f"  Overdue Termination Rate  : {fmt_pct(s, n, r)}")
    s, n, r = m["side_effects_rate"]
    print(f"  Unexpected Side Effects   : {fmt_pct(s, n, r)}")
    print(f"  Avg Steps (all)           : {m['avg_steps_all']:.2f}")
    print(f"  Avg Steps (success)       : {m['avg_steps_suc']:.2f}")

    for dim, groups in dims.items():
        parts = "  ".join(f"{k}: {r:.1%} ({s}/{n})" for k, (s, n, r) in sorted(groups.items()))
        print(f"  {dim:<14}: {parts}")


def make_table1_row(model, main):
    s, n, r = main["success_rate"]
    sp, np_, rp = main["premature_rate"]
    so, no, ro = main["overdue_rate"]
    ss, ns, rs = main["side_effects_rate"]
    return (
        f"      <td>{model}</td>\n"
        f"      <td>{r:.2%} ({s}/{n})</td>\n"
        f"      <td>{main['progress_rate']:.2%}</td>\n"
        f"      <td>{rp:.2%} ({sp}/{np_})</td>\n"
        f"      <td>{ro:.2%} ({so}/{no})</td>\n"
        f"      <td>{rs:.2%} ({ss}/{ns})</td>\n"
        f"      <td>{main['avg_steps_all']:.2f}</td>\n"
        f"      <td>{main['avg_steps_suc']:.2f}</td>"
    )


def make_table2_row(model, main, dims):
    s, n, r = main["success_rate"]
    overall = f"{r:.1%} ({s}/{n})"

    def cell(dim, key):
        s, n, r = dims[dim].get(key, (0, 0, 0.0))
        return f"{r:.1%} ({s}/{n})"

    return (
        f"      <td>{model}</td>\n"
        f"      <td>{overall}</td>\n"
        f"      <td>{cell('difficulty','L1')}</td>"
        f"<td>{cell('difficulty','L2')}</td>"
        f"<td>{cell('difficulty','L3')}</td>"
        f"<td>{cell('difficulty','L4')}</td>\n"
        f"      <td>{cell('scope','S1')}</td>"
        f"<td>{cell('scope','S2')}</td>"
        f"<td>{cell('scope','S3')}</td>\n"
        f"      <td>{cell('objective','operate')}</td>"
        f"<td>{cell('objective','query')}</td>"
        f"<td>{cell('objective','hybrid')}</td>\n"
        f"      <td>{cell('composition','atomic')}</td>"
        f"<td>{cell('composition','sequential')}</td>"
        f"<td>{cell('composition','deep_dive')}</td>"
        f"<td>{cell('composition','transfer')}</td>"
    )


def update_comparison_md(md_path: Path, model, main, dims):
    content = md_path.read_text()

    row1 = f"    <tr>\n{make_table1_row(model, main)}\n    </tr>"
    row2 = f"    <tr>\n{make_table2_row(model, main, dims)}\n    </tr>"

    # Check if model already exists
    if f"<td>{model}</td>" in content:
        print(f"\n[!] '{model}' already exists in {md_path}, skipping update.")
        return

    content = content.replace("  </tbody>\n</table>\n\n## Table 2", f"  {row1}\n  </tbody>\n</table>\n\n## Table 2", 1)
    content = content.replace("  </tbody>\n</table>\n", f"  {row2}\n  </tbody>\n</table>\n", 1)

    md_path.write_text(content)
    print(f"\n[✓] Appended '{model}' to {md_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("run_dir", type=Path)
    parser.add_argument("--model", type=str, default=None, help="Model name (defaults to parent dir name)")
    parser.add_argument("--update-md", type=Path, default=None, help="Path to comparison.md to append row")
    args = parser.parse_args()

    run_dir = args.run_dir
    model = args.model or run_dir.parent.name

    records = load_records(run_dir)
    main_metrics, dims, valid = compute(records)

    print_report(model, main_metrics, dims)

    md_path = args.update_md or (Path(__file__).resolve().parents[2] / "runs" / "comparison.md")
    if md_path.exists():
        update_comparison_md(md_path, model, main_metrics, dims)
    else:
        print(f"\n[!] {md_path} not found, skipping markdown update.")


if __name__ == "__main__":
    main()
