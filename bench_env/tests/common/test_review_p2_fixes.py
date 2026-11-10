"""Regression coverage for the four P2 findings on PR #34 (2026-11-09 review)."""

from __future__ import annotations

import os
import stat
import subprocess
import textwrap
from pathlib import Path

import pytest

from bench_env.agent.base import AgentConfig
from bench_env.agent.human import HumanAgent
from bench_env.agent.uitars import UITarsAgent
from bench_env.config import RunnerConfig
from bench_env.env.base import ActionType
from bench_env.factory import create_agent


ROOT = Path(__file__).resolve().parents[3]
SERVE_DIST = ROOT / "scripts" / "server" / "serve_dist.sh"


def _write_executable(path: Path, body: str) -> None:
    path.write_text(body)
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def test_serve_dist_file_mtime_uses_gnu_stat_without_pollution(tmp_path: Path) -> None:
    """GNU `stat -f %m FILE` must not leak into the mtime fallback path."""
    dist = tmp_path / "dist"
    dist.mkdir()
    index = dist / "index.html"
    index.write_text("ok")
    # Make dist clearly older than a fake HEAD commit time of 2000000000.
    os.utime(index, (1_577_836_800, 1_577_836_800))  # 2020-01-01

    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "scripts" / "server").mkdir(parents=True)
    script = repo / "scripts" / "server" / "serve_dist.sh"
    script.write_text(SERVE_DIST.read_text())
    script.chmod(script.stat().st_mode | stat.S_IXUSR)

    # Minimal git metadata so `git log -1 --format=%ct` works.
    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "t@example.com"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=repo, check=True, capture_output=True)
    (repo / "README").write_text("x")
    subprocess.run(["git", "add", "README"], cwd=repo, check=True, capture_output=True)
    env = os.environ.copy()
    env["GIT_AUTHOR_DATE"] = "2033-05-18T00:00:00"
    env["GIT_COMMITTER_DATE"] = "2033-05-18T00:00:00"
    subprocess.run(
        ["git", "commit", "-m", "head"],
        cwd=repo,
        check=True,
        capture_output=True,
        env=env,
    )

    # Point DIST_INDEX at our stale file by placing dist under repo and
    # stubbing npx so we can observe whether build ran.
    (repo / "dist").mkdir()
    stale = repo / "dist" / "index.html"
    stale.write_text("old")
    os.utime(stale, (1_577_836_800, 1_577_836_800))

    npx_log = tmp_path / "npx.log"
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_npx = fake_bin / "npx"
    _write_executable(
        fake_npx,
        textwrap.dedent(
            f"""\
            #!/bin/bash
            echo "$@" >> "{npx_log}"
            if [ "$1" = "vite" ] && [ "$2" = "build" ]; then
              mkdir -p "{repo}/dist"
              echo rebuilt > "{repo}/dist/index.html"
              exit 0
            fi
            if [ "$1" = "vite" ] && [ "$2" = "preview" ]; then
              exit 0
            fi
            exit 0
            """
        ),
    )

    run_env = os.environ.copy()
    run_env["PATH"] = f"{fake_bin}:{run_env.get('PATH', '')}"
    result = subprocess.run(
        ["bash", str(script), "4173"],
        cwd=repo,
        env=run_env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    assert "integer expression expected" not in result.stderr
    assert "integer expression expected" not in result.stdout
    logged = npx_log.read_text() if npx_log.exists() else ""
    assert "vite build" in logged
    assert "vite preview" in logged


def test_human_pixel_tap_converts_to_norm_center() -> None:
    action = HumanAgent._parse_action_command(
        "t 540 1200",
        screen_size=(1080, 2400),
    )
    assert action is not None
    assert action.action_type == ActionType.CLICK
    assert action.data["point"] == [500, 500]


def test_human_pixel_swipe_converts_both_ends() -> None:
    action = HumanAgent._parse_action_command(
        "s 0 0 1080 2400",
        screen_size=(1080, 2400),
    )
    assert action is not None
    assert action.data["point1"] == [0, 0]
    assert action.data["point2"] == [999, 999]


def test_create_agent_css_wire_scale_sets_uitars_screen_size() -> None:
    config = RunnerConfig(
        agent="uitars",
        model_name="dummy",
        physical_size=(1080, 2400),
        screenshot_wire_scale="css",
        quiet=True,
    )

    class _DummyLLM:
        pass

    agent = create_agent(config, llm=_DummyLLM())
    assert isinstance(agent, UITarsAgent)
    assert agent.config.screen_size == (360, 800)


def test_create_agent_device_wire_scale_keeps_physical_screen_size() -> None:
    config = RunnerConfig(
        agent="uitars",
        model_name="dummy",
        physical_size=(1080, 2400),
        screenshot_wire_scale="device",
        quiet=True,
    )

    class _DummyLLM:
        pass

    agent = create_agent(config, llm=_DummyLLM())
    assert agent.config.screen_size == (1080, 2400)


def test_create_human_agent_gets_screen_size() -> None:
    config = RunnerConfig(
        agent="human",
        model_name="dummy",
        physical_size=(1080, 2400),
        screenshot_wire_scale="css",
        quiet=True,
    )
    agent = create_agent(config)
    assert isinstance(agent, HumanAgent)
    assert agent.config.screen_size == (360, 800)
