"""Split resolver for task-id whitelists.

A *split* is a named whitelist of **base** task_ids (no ``_iN`` sampled-instance
suffix), used for train / test / payment / high_risk partitioning. Split files
live at ``bench_env/splits/<name>.txt`` — one task_id per line, blank lines and
``#`` comments ignored.

At match time, executors call :func:`base_task_id` to strip the ``_iN`` suffix
from concrete task instances (see ``bench_env.factory.load_tasks`` and
``bench_env.rerun.identify_rerun_tasks``). So write base ids like
``wechat.SetMomentsVisibleRange`` in the files, not ``wechat.SetMomentsVisibleRange_i3``.

Usage:
    resolve_split("test")              # single named split
    resolve_split("test+payment")      # union of multiple named splits
    resolve_split("/abs/path/ids.txt") # raw file path (always absolute)
    resolve_split("./rel/ids.txt")     # relative path — normalize via normalize_spec first

Note on the ``bench_env/splits`` vs ``bench_env/splits.py`` coexistence:
CPython 3 resolves ``import bench_env.splits`` to this module file as long as
the ``splits/`` directory has no ``__init__.py``. **Do not add an __init__.py
under splits/** — that would shadow this module.
"""

from __future__ import annotations

import re
from pathlib import Path


_SPLITS_ROOT = Path(__file__).resolve().parent / "splits"


def base_task_id(task_id: str) -> str:
    """Strip the sampled-instance suffix ``_i<digits>`` from a task_id.

    Shared helper so factory/rerun/listing can't drift. Only the trailing
    ``_i\\d+`` segment is stripped — plain underscores or ``_i`` in the middle
    of a suite/task name are left alone.
    """
    m = re.match(r"^(.*?)_i\d+$", task_id)
    return m.group(1) if m else task_id


def _read_list_file(path: Path) -> set[str]:
    if not path.exists():
        raise FileNotFoundError(f"Split list file not found: {path}")
    ids: set[str] = set()
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        ids.add(line)
    return ids


def _looks_like_path(spec: str) -> bool:
    return "/" in spec or spec.endswith(".txt") or spec.startswith(".")


def normalize_spec(spec: str) -> str:
    """Normalize a split spec so later re-resolution (e.g. from meta.json) is
    cwd-independent. Named specs pass through; path specs are resolved to an
    absolute path against the current cwd at parse time.
    """
    spec = spec.strip()
    if _looks_like_path(spec):
        return str(Path(spec).resolve())
    return spec


def resolve_split(spec: str) -> set[str]:
    """Resolve a split spec into a set of task_ids.

    Accepted forms:
      - ``<name>``              — reads ``splits/<name>.txt``
      - ``<name>+<name>...``    — union of multiple named splits
      - ``<path>``              — plain file path (absolute or relative)

    Raises FileNotFoundError / ValueError on malformed specs or missing files.
    """
    if not spec or not spec.strip():
        raise ValueError("Empty split spec")
    spec = spec.strip()

    if _looks_like_path(spec):
        return _read_list_file(Path(spec))

    parts = [p.strip() for p in spec.split("+") if p.strip()]
    if not parts:
        raise ValueError(
            f"Invalid split spec {spec!r}: expected '<name>[+<name>...]' or a file path"
        )

    ids: set[str] = set()
    for part in parts:
        path = _SPLITS_ROOT / f"{part}.txt"
        if not path.exists():
            available = list_splits()
            raise FileNotFoundError(
                f"Split not found: {path}"
                + (f"  (available: {', '.join(available)})" if available
                   else f"  (no .txt files under {_SPLITS_ROOT})")
            )
        ids |= _read_list_file(path)
    return ids


def list_splits() -> list[str]:
    """Return the names of all split files under bench_env/splits/."""
    if not _SPLITS_ROOT.is_dir():
        return []
    return sorted(p.stem for p in _SPLITS_ROOT.glob("*.txt"))
