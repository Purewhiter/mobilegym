#!/usr/bin/env python3
"""Update task index comments at the top of each tasks.py file.

Reads task metadata from TaskRegistry and generates a structured comment
block at the top of each suite's tasks.py, making it easy to see all tasks
at a glance without scrolling or running external commands.

Usage:
    python scripts/bench/audit/update_task_index.py              # Update all suites
    python scripts/bench/audit/update_task_index.py wechat alipay # Update specific suites
    python scripts/bench/audit/update_task_index.py --check       # Dry-run, report stale
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from bench_env.task.registry import TaskRegistry, _SUITE_MODULES
from bench_env.task.base import BaseTask

MARKER_START = "# -- Task Index (auto-generated, do not edit) --"
MARKER_END = "# -- End Task Index --"
MARKER_PREFIX = "# -- Task Index"


def _resolve_tasks_path(suite: str) -> Path | None:
    """Return the tasks.py path for a suite, or None if it's defs/-only."""
    module_path = _SUITE_MODULES.get(suite)
    if module_path is None:
        return None
    return ROOT / Path(module_path.replace(".", "/")).with_suffix(".py")


def _get_class_order(filepath: Path) -> list[str]:
    """Get class names in source-file order via AST."""
    tree = ast.parse(filepath.read_text(encoding="utf-8"))
    return [
        node.name
        for node in ast.iter_child_nodes(tree)
        if isinstance(node, ast.ClassDef)
    ]


def _generate_index(
    tasks: dict[str, type[BaseTask]],
    source_order: list[str],
) -> str:
    """Generate the task index comment block."""
    diff_counts: dict[str, int] = {}
    for cls in tasks.values():
        d = getattr(cls, "difficulty", "?")
        diff_counts[d] = diff_counts.get(d, 0) + 1

    diff_summary = "  ".join(
        f"{d}\u00d7{diff_counts[d]}" for d in sorted(diff_counts)
    )

    order_map = {name: i for i, name in enumerate(source_order)}
    sorted_names = sorted(
        tasks.keys(),
        key=lambda n: order_map.get(n, 9999),
    )

    max_name_len = max(len(n) for n in tasks) if tasks else 0
    pad = max(max_name_len + 2, 24)

    lines = [
        MARKER_START,
        f"# {len(tasks)} tasks | {diff_summary}",
        "#",
    ]

    for name in sorted_names:
        cls = tasks[name]
        difficulty = getattr(cls, "difficulty", "?")
        templates = getattr(cls, "templates", [])
        if isinstance(templates, str):
            templates = [templates]
        tpl = templates[0].strip() if templates else ""
        tpl_commented = tpl.replace("\n", "\n#   ")
        lines.append(f"# [{difficulty}] {name:<{pad}s}{tpl_commented}")

    lines.append(MARKER_END)
    return "\n".join(lines)


def _find_insertion_point(content: str) -> int:
    """Find where to insert the index block (after module docstring)."""
    stripped = content.lstrip()
    if stripped.startswith('"""') or stripped.startswith("'''"):
        quote = stripped[:3]
        offset = content.index(quote)
        closing = content.index(quote, offset + 3) + 3
        if closing < len(content) and content[closing] == "\n":
            closing += 1
        return closing
    return 0


def _update_file(filepath: Path, index_block: str, *, check: bool = False) -> bool:
    """Insert or replace the task index in a file. Returns True if changed."""
    content = filepath.read_text(encoding="utf-8")

    marker_start = None
    if MARKER_START in content and MARKER_END in content:
        marker_start = MARKER_START
    else:
        for line in content.splitlines():
            if line.startswith(MARKER_PREFIX):
                marker_start = line
                break

    if marker_start and MARKER_END in content:
        start = content.index(marker_start)
        end = content.index(MARKER_END, start) + len(MARKER_END)
        if end < len(content) and content[end] == "\n":
            end += 1

        old_block = content[start:end].rstrip("\n")
        if old_block == index_block:
            return False

        if check:
            return True

        new_content = content[:start] + index_block + "\n" + content[end:]
    else:
        if check:
            return True

        insertion_point = _find_insertion_point(content)
        new_content = (
            content[:insertion_point]
            + index_block
            + "\n\n"
            + content[insertion_point:]
        )

    filepath.write_text(new_content, encoding="utf-8")
    return True


def main():
    check = "--check" in sys.argv
    suites = [a for a in sys.argv[1:] if not a.startswith("-")]

    registry = TaskRegistry()

    if not suites:
        suites = registry.list_suites(include_generated=False)

    changed = 0
    for suite in suites:
        tasks = registry._load_suite_tasks(suite)
        if not tasks:
            print(f"  [SKIP] {suite}: no tasks found")
            continue

        filepath = _resolve_tasks_path(suite)
        if filepath is None:
            print(f"  [SKIP] {suite}: no tasks.py (defs/-only suite)")
            continue
        if not filepath.exists():
            print(f"  [SKIP] {suite}: {filepath} not found")
            continue

        source_order = _get_class_order(filepath)
        index_block = _generate_index(tasks, source_order)

        if _update_file(filepath, index_block, check=check):
            status = "STALE" if check else "UPDATED"
            print(f"  [{status}] {suite}: {filepath.relative_to(ROOT)}")
            changed += 1
        else:
            print(f"  [OK] {suite}: up to date")

    if check and changed:
        print(
            f"\n{changed} file(s) have stale task indexes."
            " Run without --check to update."
        )
        sys.exit(1)
    elif not check:
        print(f"\n{changed} file(s) updated.")


if __name__ == "__main__":
    main()
