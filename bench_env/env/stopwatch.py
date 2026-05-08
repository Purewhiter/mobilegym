"""Hierarchical stopwatch for profiling episode lifecycle."""

from __future__ import annotations

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
        flat: dict[str, float] = {}
        for entry in (roots or self._roots):
            self._entry_to_flat(entry, flat, prefix="")
        return flat

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
