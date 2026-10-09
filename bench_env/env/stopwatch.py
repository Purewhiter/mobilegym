"""Hierarchical stopwatch for profiling episode lifecycle."""

from __future__ import annotations

import math
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class _Entry:
    name: str
    elapsed: float
    children: list[_Entry] = field(default_factory=list)


class StopWatch:
    """Nestable stopwatch for async episode profiling.

    Usage::

        sw = StopWatch()
        with sw.phase("setup"):
            with sw.phase("reset"):
                ...
            with sw.phase("warm"):
                ...
        print(sw.summary())
        # setup=3.21s { reset=2.10s warm=1.05s } | run=25.3s
    """

    def __init__(self) -> None:
        self._stack: list[_Entry] = []
        self._roots: list[_Entry] = []

    @contextmanager
    def phase(self, name: str):
        t0 = time.monotonic()
        entry = _Entry(name=name, elapsed=0.0)
        if self._stack:
            self._stack[-1].children.append(entry)
        else:
            self._roots.append(entry)
        self._stack.append(entry)
        try:
            yield
        finally:
            entry.elapsed = time.monotonic() - t0
            self._stack.pop()

    def record(self, name: str, elapsed: float) -> None:
        """Insert a pre-measured phase entry under the current stack top.

        Use when the duration was measured outside ``phase()`` — e.g. across an
        ``asyncio.to_thread`` boundary, where the sync call is dispatched to a
        worker thread and the queue/exec split is captured by the wrapper.
        Appends as a child of the currently-open phase (or as a root entry if
        none is open). Append-only: thread-safe under CPython GIL.
        """
        entry = _Entry(name=name, elapsed=elapsed)
        if self._stack:
            self._stack[-1].children.append(entry)
        else:
            self._roots.append(entry)

    def summary(self, roots: list[_Entry] | None = None, depth: int = 0) -> str:
        parts: list[str] = []
        for e in (roots or self._roots):
            s = f"{e.name}={e.elapsed:.2f}s"
            if e.children:
                child_s = " ".join(
                    self.summary([c], depth + 1) for c in e.children
                )
                s += f" {{ {child_s} }}"
            parts.append(s)
        return " | ".join(parts)

    def to_tree(self, roots: list[_Entry] | None = None) -> list[dict[str, Any]]:
        return [self._entry_to_tree(entry) for entry in (roots or self._roots)]

    def to_flat(self, roots: list[_Entry] | None = None) -> dict[str, float]:
        """Flatten the tree into ``{"a.b.c": elapsed}``.

        已知缺陷：同名 phase 互相覆盖 — dict key 冲突时只保留**最后一次**的
        elapsed（例如每步都有的 ``infer`` / ``obs`` 只剩最后一步的耗时，
        既不是求和也不是平均）。跨步聚合请用 :meth:`to_step_summary`；
        此字段仅为兼容既有消费方保留。
        """
        flat: dict[str, float] = {}
        for entry in (roots or self._roots):
            self._entry_to_flat(entry, flat, prefix="")
        return flat

    def to_step_summary(self, roots: list[_Entry] | None = None) -> dict[str, dict[str, float]]:
        """Aggregate repeated root phases into per-phase distribution stats.

        Episode 的 stopwatch tree 里，root phase（``infer`` / ``record`` /
        ``action`` / ``obs`` …）每步重复出现一次；``to_flat`` 只保留最后
        一次（见其 docstring），本方法按 root phase 名聚合为::

            {"infer": {"n": 30, "sum_s": 45.2, "p50_s": 1.4,
                       "p95_s": 3.1, "max_s": 5.0}, ...}

        p50/p95 采用 nearest-rank（对小样本稳定、无插值）。只聚合 root
        层级；子 phase 的明细仍在 ``to_tree()``。
        """
        by_name: dict[str, list[float]] = {}
        for entry in (roots if roots is not None else self._roots):
            by_name.setdefault(entry.name, []).append(entry.elapsed)

        def _nearest_rank(sorted_vals: list[float], q: float) -> float:
            idx = max(0, min(len(sorted_vals) - 1, math.ceil(q * len(sorted_vals)) - 1))
            return sorted_vals[idx]

        summary: dict[str, dict[str, float]] = {}
        for name, values in by_name.items():
            vals = sorted(values)
            summary[name] = {
                "n": len(vals),
                "sum_s": sum(vals),
                "p50_s": _nearest_rank(vals, 0.50),
                "p95_s": _nearest_rank(vals, 0.95),
                "max_s": vals[-1],
            }
        return summary

    def _entry_to_tree(self, entry: _Entry) -> dict[str, Any]:
        return {
            "name": entry.name,
            "elapsed_s": entry.elapsed,
            "children": [self._entry_to_tree(child) for child in entry.children],
        }

    def _entry_to_flat(self, entry: _Entry, flat: dict[str, float], prefix: str) -> None:
        key = f"{prefix}.{entry.name}" if prefix else entry.name
        flat[key] = entry.elapsed
        for child in entry.children:
            self._entry_to_flat(child, flat, prefix=key)

    @property
    def total(self) -> float:
        return sum(e.elapsed for e in self._roots)

    def reset(self) -> None:
        self._stack.clear()
        self._roots.clear()


# Thread-local "current stopwatch" so sync code dispatched into a worker thread
# (typically via ``asyncio.to_thread(agent.act, ...)``) can locate the env's
# stopwatch without threading it through every API. The runner sets this for
# the duration of one ``to_thread`` call; LLMClient and other thread-side code
# call ``current_stopwatch()`` and ``StopWatch.record()`` to attribute their
# internal timings to the same tree.
_thread_local = threading.local()


def set_current_stopwatch(sw: Optional["StopWatch"]) -> None:
    """Bind ``sw`` (or unbind with ``None``) to the calling thread."""
    _thread_local.sw = sw


def current_stopwatch() -> Optional["StopWatch"]:
    """Return the calling thread's bound StopWatch, or ``None`` if unset."""
    return getattr(_thread_local, "sw", None)
