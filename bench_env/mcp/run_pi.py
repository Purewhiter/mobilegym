"""Run Pi through the same MobileGym MCP server and subscription model."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from bench_env.mcp.protocol import (
    MODEL_RESPONSE_LOG_KIND, OBSERVATION_FORMAT, RESPONSE_FORMAT, THOUGHT_KIND,
    build_client_prompt, get_protocol, protocol_sha256,
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-url", required=True)
    parser.add_argument("--run-dir", required=True, type=Path)
    parser.add_argument("--task-file", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--model", default="gpt-5.6-sol")
    parser.add_argument("--reasoning-effort", default="medium")
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("--limit must be positive")
    root = Path(__file__).resolve().parents[2]
    run_dir = args.run_dir.resolve()
    if run_dir.exists() and any(run_dir.iterdir()):
        parser.error("--run-dir must be new or empty")
    executable = shutil.which("pi")
    if executable is None:
        parser.error("pi is not installed")
    tasks = [line.strip() for line in args.task_file.read_text().splitlines()
             if line.strip() and not line.lstrip().startswith("#")][:args.limit]
    if not tasks or len(tasks) != len(set(tasks)):
        parser.error("task selection must be non-empty and unique")
    run_dir.mkdir(parents=True, exist_ok=True)
    server_args = [
        "-m", "bench_env.mcp", "--env-url", args.env_url, "--run-dir", str(run_dir),
        "--client-name", "pi", "--model-name", args.model,
        "--reasoning-effort", args.reasoning_effort, "--seed", str(args.seed),
        "--limit", str(len(tasks)),
    ]
    for task in tasks:
        server_args.extend(["--task-id", task])
    gateway_config = run_dir / "pi_gateway_config.json"
    gateway_config.write_text(json.dumps({
        "python": sys.executable, "repo_root": str(root), "run_dir": str(run_dir),
        "server_args": server_args,
    }, ensure_ascii=False, indent=2))
    prompt = build_client_prompt(len(tasks))
    (run_dir / "generic_v2_system_prompt.txt").write_text(get_protocol(), encoding="utf-8")
    (run_dir / "client_prompt.txt").write_text(prompt, encoding="utf-8")
    (run_dir / "task_ids.txt").write_text("\n".join(tasks) + "\n")
    command = [
        executable, "--print", "--mode", "json", "--offline",
        "--provider", "openai-codex", "--model", args.model,
        "--thinking", args.reasoning_effort,
        "--no-builtin-tools", "--tools", "mobilegym_observe,mobilegym_act",
        "--no-extensions", "--extension", str(Path(__file__).with_name("pi_extension.ts")),
        "--no-skills", "--no-context-files", "--no-prompt-templates", "--no-themes",
        "--no-approve", "--session-dir", str(run_dir / "pi_sessions"), prompt,
    ]
    environment = dict(os.environ)
    for key in ("OPENAI_API_KEY", "CODEX_API_KEY"):
        environment.pop(key, None)
    environment["MOBILEGYM_PI_CONFIG"] = str(gateway_config)
    environment["PI_TELEMETRY"] = "0"
    version = subprocess.run([executable, "--version"], capture_output=True, text=True).stdout.strip()
    (run_dir / "client_config.json").write_text(json.dumps({
        "client": "pi", "client_version": version, "provider": "openai-codex",
        "model": args.model, "reasoning_effort": args.reasoning_effort,
        "tasks": tasks, "sample_seed": args.seed, "prompt": prompt,
        "context_policy": "one_session_for_entire_batch_pi_managed",
        "response_format": RESPONSE_FORMAT, "thought_kind": THOUGHT_KIND,
        "model_response_log_kind": MODEL_RESPONSE_LOG_KIND,
        "observation_format": OBSERVATION_FORMAT,
        "generic_v2_prompt_policy": "verbatim", "generic_v2_prompt_sha256": protocol_sha256(),
        "image_policy": "Pi default processing; MCP source image bytes unchanged",
        "cache_accounting": "client_reported_only_not_subscription_billing",
    }, ensure_ascii=False, indent=2))
    with tempfile.TemporaryDirectory(prefix="mobilegym-pi-") as workspace:
        with (run_dir / "pi_events.jsonl").open("w") as events, (run_dir / "client_stderr.log").open("w") as errors:
            completed = subprocess.run(command, cwd=workspace, env=environment, stdin=subprocess.DEVNULL,
                                       stdout=events, stderr=errors)
    results_file = run_dir / "results.jsonl"
    results = [json.loads(line) for line in results_file.read_text().splitlines()] if results_file.exists() else []
    batch_complete = len(results) == len(tasks) and (run_dir / "summary.json").exists()
    (run_dir / "client_exit.json").write_text(json.dumps({
        "returncode": completed.returncode, "batch_complete": batch_complete,
        "completed_episodes": len(results), "expected_episodes": len(tasks),
    }))
    from bench_env.mcp.pi_usage import collect_usage
    collect_usage(run_dir)
    print(f"Pi exited with {completed.returncode}; completed {len(results)}/{len(tasks)}; artifacts: {run_dir}")
    raise SystemExit(completed.returncode or (0 if batch_complete else 2))


if __name__ == "__main__":
    main()
