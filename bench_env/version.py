"""Version identifiers for MobileGym-Bench.

A benchmark number is only meaningful if you know which benchmark produced it.
MobileGym versions four things independently, because they change for
different reasons and break comparability in different ways:

- ``HARNESS_VERSION`` — the bench_env runtime: runner, env, agents, judging
  engine, CLI. A harness fix (a crash, a timeout, a retry) does not redefine
  any task, so results across harness versions stay comparable unless the
  release notes say otherwise.
- ``TASKSET_VERSION`` — the benchmark content: task definitions, prompt
  templates, sampled parameters, expected answers, judging criteria. **This is
  the number a leaderboard row must cite.** Any change that can move an
  agent's score on any task bumps it.
- ``SIM_VERSION`` — the simulated device itself: ``os/``, ``apps/``,
  ``system/``. This is the environment the agent acts in and the judge reads
  state out of, so an app behavior change moves scores as surely as a task
  change does, without touching a single task file. Tracks ``package.json``.
- ``DATA_VERSION`` — the companion dataset release the task set is calibrated
  against (the ``data-vX.Y.Z`` GitHub release). App fixtures live here, so a
  data change can move scores even with the task set untouched.

``SIM_VERSION`` and ``DATA_VERSION`` split the same app along a seam worth
naming: the simulator is app *behavior*, the dataset is app *content*. A fix to
how liking a song mutates state is SIM; changing which songs ship is DATA.

See ``docs/VERSIONING.md`` for the bump rules and the release checklist.
"""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

HARNESS_VERSION = "0.1.0"
TASKSET_VERSION = "0.1.0"
SIM_VERSION = "0.1.0"
DATA_VERSION = "0.1.0"

_REPO_ROOT = Path(__file__).resolve().parent.parent

# Nothing in this module is cached. Provenance describes the checkout *at the
# moment a run starts*, and one process can start many runs -- an MCP bridge, an
# RL trainer, a notebook -- with edits in between. Fixtures, task data and the
# Vite-served simulator are all re-read live, so the code a later run exercises
# really can differ from what the first run saw. A few git calls per run is
# nothing next to a stamp that silently describes the wrong tree.

_GIT_TIMEOUT_S = 30


def _git(*args: str) -> bytes | None:
    """Raw stdout of a git command in the repo, or None if it cannot be had.

    Bytes, not text: a diff contains whatever bytes the working tree contains,
    and decoding it with the locale codec raises on a non-UTF-8 locale (this
    repo is full of Chinese) or on a Latin-1 file. Provenance is a side
    channel; it must never be the reason a benchmark run fails to start.
    """
    try:
        out = subprocess.run(
            ["git", "-C", str(_REPO_ROOT), *args],
            capture_output=True,
            timeout=_GIT_TIMEOUT_S,
            check=True,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return out.stdout


def _git_text(*args: str) -> str | None:
    out = _git(*args)
    return None if out is None else out.decode("utf-8", errors="replace")


def git_commit() -> str | None:
    """Short commit of HEAD, or None outside a git checkout.

    Recorded alongside the versions so a run made from an unreleased main can
    still be traced back to an exact tree. On a dirty tree this alone is not
    enough -- see ``tracked_diff()``.
    """
    out = _git_text("rev-parse", "--short", "HEAD")
    if out is None:
        return None
    return out.strip() or None


#: Every option that shapes ``git diff`` output is pinned, so the patch is a
#: function of the tree and not of whoever ran it. Left to user config,
#: ``color.ui=always`` injects escape codes, ``diff.noprefix`` /
#: ``diff.mnemonicPrefix`` change the paths, ``diff.external`` and textconv
#: replace the output wholesale -- any of which makes the patch unappliable and
#: gives identical code a different ``git_diff_sha`` on two machines.
#: ``--binary`` is what lets a dirty image or font survive the round trip;
#: without it the patch just says "Binary files differ".
_DIFF_ARGS = (
    "diff",
    "HEAD",
    "--binary",
    "--full-index",
    "--no-color",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    "--diff-algorithm=myers",
    "--unified=3",
    "--src-prefix=a/",
    "--dst-prefix=b/",
)


def tracked_diff() -> bytes | None:
    """Patch of tracked changes against HEAD, staged and unstaged both.

    This is the code that actually ran but is not in any commit. ``git_commit``
    alone describes a dirty run inaccurately -- it names a tree that is not the
    one that executed -- so this diff is what closes the gap: ``git apply`` it
    onto ``git_commit`` and you have the tree that ran. ``b""`` means clean,
    ``None`` means undeterminable.

    Untracked files are deliberately excluded. A working checkout is usually
    littered with scratch output that has no bearing on a run, and letting that
    flip the dirty flag makes the flag useless. ``untracked_code_count`` covers
    the residual case where an untracked file *is* load-bearing (a new task
    module, say) without crying wolf on every stray directory.
    """
    return _git(*_DIFF_ARGS)


def diff_sha(diff: bytes | None) -> str | None:
    """Short digest of a ``tracked_diff()`` result, or None when clean/unknown.

    Gives a dirty run a stable identity: two runs sharing a commit and a
    diff sha ran identical code, which is what makes a before/after comparison
    on unreleased work meaningful.
    """
    if not diff:
        return None
    return hashlib.sha256(diff).hexdigest()[:12]


#: Paths whose contents can change what a run does. Counting untracked files
#: across the whole checkout is worthless -- a working tree carries thousands
#: of scratch artifacts -- so the signal is scoped to code the runtime imports.
_CODE_PATHS = ("bench_env", "os", "apps", "system")


def untracked_code_count() -> int | None:
    """Untracked, non-ignored files under the code paths, or None if unknown.

    Informational, and narrow on purpose. Non-zero does not mean the run was
    affected -- but if a run is clean by every other measure and still will not
    reproduce, an untracked module that shadowed a committed one is the usual
    culprit, and that module lives in one of these directories.
    """
    out = _git_text("ls-files", "--others", "--exclude-standard", "--", *_CODE_PATHS)
    if out is None:
        return None
    return len([line for line in out.splitlines() if line.strip()])


def run_provenance() -> tuple[dict[str, object], bytes | None]:
    """The version block for ``meta.json`` plus the exact patch it describes.

    Returned together, from a single ``git diff``, so that ``git_dirty``,
    ``git_diff_sha`` and the saved ``uncommitted.patch`` cannot disagree with
    each other if the tree is edited while a run is starting.

    ``git_dirty`` is True when tracked files differ from HEAD and None when
    that cannot be determined. A dirty run is not reproducible from any
    published version, so it must not go on a leaderboard.
    """
    diff = tracked_diff()
    info: dict[str, object] = {
        "harness_version": HARNESS_VERSION,
        "taskset_version": TASKSET_VERSION,
        "sim_version": SIM_VERSION,
        "data_version": DATA_VERSION,
        "git_commit": git_commit(),
        "git_dirty": None if diff is None else bool(diff),
        "git_diff_sha": diff_sha(diff),
        "untracked_code_count": untracked_code_count(),
    }
    return info, diff


def version_info() -> dict[str, object]:
    """Version block stamped into every run's ``meta.json``."""
    return run_provenance()[0]
