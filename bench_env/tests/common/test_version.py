"""Run provenance must be trustworthy, and must never be why a run fails.

Each test builds a throwaway git repo and points ``bench_env.version`` at it,
with the kind of user config that silently corrupts a naive ``git diff``.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from bench_env import version
from bench_env.env.recorder import RunRecorder


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True, encoding="utf-8"
    ).stdout


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "repo"
    root.mkdir()
    _git(root, "init", "-q")
    _git(root, "config", "user.email", "t@example.com")
    _git(root, "config", "user.name", "t")
    _git(root, "config", "commit.gpgsign", "false")
    # Config that changes what a bare `git diff` prints.
    _git(root, "config", "color.ui", "always")
    _git(root, "config", "diff.noprefix", "true")
    _git(root, "config", "diff.mnemonicPrefix", "true")
    _git(root, "config", "diff.external", "false")  # any external tool would replace the output

    (root / "task.py").write_text("name = '收藏精选'\n", encoding="utf-8")
    (root / "latin1.txt").write_bytes("caf\xe9\n".encode("latin-1"))
    (root / "icon.bin").write_bytes(bytes(range(256)))
    _git(root, "add", "-A")
    _git(root, "commit", "-q", "-m", "init")

    monkeypatch.setattr(version, "_REPO_ROOT", root)
    return root


def _dirty(repo: Path) -> None:
    (repo / "task.py").write_text("name = '我的最爱'\n", encoding="utf-8")
    (repo / "latin1.txt").write_bytes("caf\xe9 cr\xe8me\n".encode("latin-1"))
    (repo / "icon.bin").write_bytes(bytes(reversed(range(256))))


def test_clean_tree(repo: Path) -> None:
    info, diff = version.run_provenance()
    assert diff == b""
    assert info["git_dirty"] is False
    assert info["git_diff_sha"] is None
    assert info["git_commit"]


def test_patch_reproduces_the_dirty_tree_despite_user_config(repo: Path, tmp_path: Path) -> None:
    _dirty(repo)
    expected = {p.name: p.read_bytes() for p in repo.iterdir() if p.is_file()}
    info, diff = version.run_provenance()

    assert info["git_dirty"] is True
    assert diff and b"\x1b[" not in diff, "colour codes leaked into the patch"

    # HEAD + patch == the tree that ran, including non-UTF-8 text and binaries.
    clone = tmp_path / "clone"
    subprocess.run(["git", "clone", "-q", str(repo), str(clone)], check=True)
    patch = tmp_path / "uncommitted.patch"
    patch.write_bytes(diff)
    subprocess.run(["git", "-C", str(clone), "apply", str(patch)], check=True)
    assert {p.name: p.read_bytes() for p in clone.iterdir() if p.is_file()} == expected


def test_diff_sha_ignores_user_config(repo: Path) -> None:
    _dirty(repo)
    with_config = version.run_provenance()[0]["git_diff_sha"]
    for key in ("color.ui", "diff.noprefix", "diff.mnemonicPrefix", "diff.external"):
        _git(repo, "config", "--unset", key)
    assert version.run_provenance()[0]["git_diff_sha"] == with_config


def test_state_is_not_cached_across_runs(repo: Path) -> None:
    assert version.run_provenance()[0]["git_dirty"] is False
    _dirty(repo)
    first = version.run_provenance()[0]
    assert first["git_dirty"] is True
    (repo / "task.py").write_text("name = 'third'\n", encoding="utf-8")
    assert version.run_provenance()[0]["git_diff_sha"] != first["git_diff_sha"]


def test_outside_a_checkout_nothing_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(version, "_REPO_ROOT", tmp_path)
    monkeypatch.setenv("GIT_CEILING_DIRECTORIES", str(tmp_path.parent))
    info, diff = version.run_provenance()
    assert diff is None
    assert info["git_commit"] is None and info["git_dirty"] is None and info["git_diff_sha"] is None
    assert info["taskset_version"] == version.TASKSET_VERSION


def test_missing_git_binary_does_not_break_a_run(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    def boom(*_a, **_k):
        raise FileNotFoundError("git")

    monkeypatch.setattr(version.subprocess, "run", boom)
    run_dir = tmp_path / "run"
    RunRecorder(tmp_path, fixed_run_dir=run_dir, save_trajectory=False).start_run(agent="a")
    meta = json.loads((run_dir / "meta.json").read_text(encoding="utf-8"))
    assert meta["git_dirty"] is None
    assert not (run_dir / "uncommitted.patch").exists()


def test_reused_run_dir_does_not_keep_a_stale_patch(repo: Path, tmp_path: Path) -> None:
    run_dir = tmp_path / "run"
    _dirty(repo)
    RunRecorder(tmp_path, fixed_run_dir=run_dir, save_trajectory=False).start_run(agent="a")
    meta = json.loads((run_dir / "meta.json").read_text(encoding="utf-8"))
    patch = run_dir / "uncommitted.patch"
    assert meta["git_dirty"] is True
    assert version.diff_sha(patch.read_bytes()) == meta["git_diff_sha"]

    _git(repo, "commit", "-qam", "land it")
    RunRecorder(tmp_path, fixed_run_dir=run_dir, save_trajectory=False).start_run(agent="a")
    meta = json.loads((run_dir / "meta.json").read_text(encoding="utf-8"))
    assert meta["git_dirty"] is False
    assert not patch.exists()
