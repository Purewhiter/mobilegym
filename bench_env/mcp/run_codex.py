"""Evaluate using the local Codex CLI and its existing ChatGPT login."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
from uuid import uuid4

from bench_env.mcp.launch import describe_tasks, read_task_ids, record_client_exit
from bench_env.mcp.protocol import (
    MODEL_RESPONSE_LOG_KIND, OBSERVATION_FORMAT, RESPONSE_FORMAT, THOUGHT_KIND,
    build_client_prompt, get_protocol, protocol_sha256,
)
from bench_env.mcp.parallel import DEFAULT_EPISODE_TIMEOUT, episode_timeout, run_parallel


def remote_path(path: str) -> str:
    if path.startswith("~/"):
        return '"$HOME"/' + shlex.quote(path[2:])
    return shlex.quote(path)


def ssh_args(host: str) -> list[str]:
    return ["-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15",
            "-o", "ServerAliveCountMax=3", "--", host]


def collect_remote_run(ssh: str, ssh_options: list[str], remote_cwd: str,
                       remote_run_dir: str, run_dir: Path) -> None:
    command = f"{remote_cwd} && " + shlex.join(["tar", "-C", remote_run_dir, "-czf", "-", "."])
    with tempfile.TemporaryDirectory(prefix="collect-", dir=run_dir) as scratch:
        archive_path = Path(scratch) / "run.tar.gz"
        with archive_path.open("wb") as archive, (run_dir / "ssh_collect.log").open("w") as errors:
            subprocess.run([ssh, *ssh_options, command], stdin=subprocess.DEVNULL,
                           stdout=archive, stderr=errors, check=True)
        extracted = Path(scratch) / "artifacts"
        extracted.mkdir()
        with tarfile.open(archive_path, "r:gz") as archive:
            archive.extractall(extracted, filter="data")
        for path in extracted.iterdir():
            destination = run_dir / path.name
            if not destination.exists():
                path.rename(destination)


def run_batch(args, tasks: list[str], codex: str, ssh: str | None) -> int:
    root = Path(__file__).resolve().parents[2]
    run_dir = args.run_dir.resolve()
    if run_dir.exists() and any(run_dir.iterdir()):
        raise ValueError("--run-dir must be new or empty")
    run_dir.mkdir(parents=True, exist_ok=True)
    remote_run_dir = f"runs/codex-ssh/{uuid4().hex}" if ssh else None
    server_args = [
        "-m", "bench_env.mcp", "--env-url", args.env_url,
        "--run-dir", remote_run_dir or str(run_dir), "--model-name", args.model,
        "--reasoning-effort", args.reasoning_effort, "--seed", str(args.seed),
        "--limit", str(len(tasks)),
    ]
    for task in tasks:
        server_args.extend(["--task-id", task])
    if ssh:
        options = ssh_args(args.ssh_host)
        remote_cwd = f"cd -- {remote_path(args.ssh_repo)}"
        remote_server = f"{remote_cwd} && exec {remote_path(args.ssh_python)} {shlex.join(server_args)}"
        server_args = [*options, remote_server]
    overrides = {
        "model_reasoning_effort": args.reasoning_effort,
        "web_search": "disabled", "project_doc_max_bytes": 0,
        "mcp_servers.mobilegym.command": ssh or sys.executable,
        "mcp_servers.mobilegym.args": server_args,
        "mcp_servers.mobilegym.cwd": str(root),
        "mcp_servers.mobilegym.required": True,
        "mcp_servers.mobilegym.startup_timeout_sec": 60 if ssh else 30,
        "mcp_servers.mobilegym.tool_timeout_sec": 180,
        # The user explicitly authorized these two local simulator tools.
        # Preapprove only this server's tools; retain all other client policies.
        "mcp_servers.mobilegym.tools.observe.approval_mode": "approve",
        "mcp_servers.mobilegym.tools.act.approval_mode": "approve",
    }
    for feature in ["shell_tool", "unified_exec", "apps", "plugins", "memories",
                    "multi_agent", "browser_use", "computer_use", "image_generation",
                    "view_image", "goals", "workspace_dependencies", "sleep_tool", "hooks"]:
        overrides[f"features.{feature}"] = False
    overrides["features.skip_host_skill_discovery"] = True
    prompt = build_client_prompt(len(tasks))
    command = [codex, "exec", "--ignore-user-config", "--skip-git-repo-check",
               "--sandbox", "read-only", "--json", "-m", args.model]
    for key, value in overrides.items():
        command.extend(["-c", f"{key}={json.dumps(value, ensure_ascii=False)}"])
    command.extend(["-o", str(run_dir / "client_final.txt"), prompt])
    environment = dict(os.environ)
    # Force use of the saved subscription login, not an ambient API credential.
    for key in ("OPENAI_API_KEY", "CODEX_API_KEY"):
        environment.pop(key, None)
    version = subprocess.run([codex, "--version"], capture_output=True, text=True).stdout.strip()
    with (run_dir / "client_config.json").open("x", encoding="utf-8") as config_file:
        json.dump({
            "client_version": version, "model": args.model, "reasoning_effort": args.reasoning_effort,
            "tasks": tasks, "sample_seed": args.seed, "overrides": overrides,
            "prompt": prompt, "context_policy": "one_session_for_entire_batch",
            "response_format": RESPONSE_FORMAT, "thought_kind": THOUGHT_KIND,
            "model_response_log_kind": MODEL_RESPONSE_LOG_KIND,
            "observation_format": OBSERVATION_FORMAT,
            "generic_v2_prompt_policy": "verbatim", "generic_v2_prompt_sha256": protocol_sha256(),
            "cache_accounting": "client_reported_only_not_subscription_billing",
            "ssh_host": args.ssh_host, "remote_run_dir": remote_run_dir,
        }, config_file, ensure_ascii=False, indent=2)
    (run_dir / "generic_v2_system_prompt.txt").write_text(get_protocol(), encoding="utf-8")
    (run_dir / "client_prompt.txt").write_text(prompt, encoding="utf-8")
    with tempfile.TemporaryDirectory(prefix="mobilegym-codex-") as workspace:
        with (run_dir / "client_events.jsonl").open("w") as events, (run_dir / "client_stderr.log").open("w") as errors:
            completed = subprocess.run(command, cwd=workspace, env=environment, stdin=subprocess.DEVNULL,
                                       stdout=events, stderr=errors)
    collection_error = None
    if ssh:
        try:
            collect_remote_run(ssh, options, remote_cwd, remote_run_dir, run_dir)
        except (OSError, subprocess.CalledProcessError, tarfile.TarError, EOFError) as error:
            collection_error = f"Could not collect artifacts from {args.ssh_host}:{remote_run_dir}: {error}"
            print(collection_error, file=sys.stderr)
    report = record_client_exit(run_dir, tasks, completed.returncode, collection_error=collection_error,
                                remote_run_dir=remote_run_dir)
    from bench_env.mcp.usage import collect_usage
    collect_usage(run_dir)
    print(f"Codex exited with {completed.returncode}; completed {report['completed_episodes']}/{len(tasks)}; artifacts: {run_dir}")
    return completed.returncode or (0 if report["batch_complete"] else 2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-url", required=True)
    parser.add_argument("--run-dir", required=True, type=Path)
    parser.add_argument("--task-file", type=Path)
    parser.add_argument("--limit", type=int, help="Maximum selected tasks (default: all tasks in the file)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--model", default="gpt-5.6-sol")
    parser.add_argument("--reasoning-effort", default="medium")
    parser.add_argument("--parallel", type=int, help="Run each task in a fresh session with this concurrency")
    parser.add_argument("--episode-timeout", type=episode_timeout, default=DEFAULT_EPISODE_TIMEOUT,
                        help="Seconds allowed per parallel worker attempt (default: %(default)g)")
    parser.add_argument("--retry-errors", action="store_true", help="Retry infrastructure failures once in parallel mode")
    parser.add_argument("--ssh-host", help="Run the MCP server on this SSH host")
    parser.add_argument("--ssh-repo", default="mobilegym-mcp", help="Path to the MCP checkout on the SSH host")
    parser.add_argument("--ssh-python", default="python3", help="Benchmark Python executable on the SSH host")
    args = parser.parse_args()
    if args.parallel is not None and args.parallel < 1:
        parser.error("--parallel must be positive")
    if args.retry_errors and args.parallel is None:
        parser.error("--retry-errors requires --parallel")
    try:
        tasks = read_task_ids(args.task_file or Path(__file__).with_name("pilot_tasks.txt"), args.limit)
        codex = shutil.which("codex")
        if not codex:
            parser.error("codex is not installed")
        ssh = shutil.which("ssh") if args.ssh_host else None
        if args.ssh_host and not ssh:
            parser.error("ssh is not installed")
        if args.parallel is None:
            code = run_batch(args, tasks, codex, ssh)
        else:
            selection = {"parameter_seed": args.seed, "tasks": describe_tasks(tasks, args.seed)}
            ssh_worker_args = ["--ssh-host", args.ssh_host, "--ssh-repo", args.ssh_repo,
                               "--ssh-python", args.ssh_python] if ssh else []
            code = asyncio.run(run_parallel(args, selection, "codex", ssh_worker_args))
    except (OSError, ValueError) as error:
        parser.error(str(error))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
