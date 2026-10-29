"""Run a batch in one Codex CLI context using existing ChatGPT login."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from bench_env.mcp.protocol import MODEL_RESPONSE_LOG_KIND, OBSERVATION_FORMAT, RESPONSE_FORMAT, THOUGHT_KIND, build_client_prompt, get_protocol, protocol_sha256


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-url", required=True)
    parser.add_argument("--run-dir", required=True, type=Path)
    parser.add_argument("--task-file", type=Path, default=Path(__file__).with_name("pilot_tasks.txt"))
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--model", default="gpt-5.6-sol")
    parser.add_argument("--reasoning-effort", default="medium")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    run_dir = args.run_dir.resolve()
    # RunRecorder overwrites results.jsonl. Never silently destroy a prior run.
    if run_dir.exists() and any(run_dir.iterdir()):
        parser.error("--run-dir must be new or empty")
    run_dir.mkdir(parents=True, exist_ok=True)
    codex = shutil.which("codex")
    if codex is None:
        parser.error("codex is not installed")
    tasks = [line.strip() for line in args.task_file.read_text().splitlines()
             if line.strip() and not line.lstrip().startswith("#")][:args.limit]
    if not tasks or len(tasks) != len(set(tasks)):
        parser.error("task selection must be non-empty and unique")
    server_args = [
        "-m", "bench_env.mcp", "--env-url", args.env_url,
        "--run-dir", str(run_dir), "--model-name", args.model,
        "--reasoning-effort", args.reasoning_effort, "--seed", str(args.seed),
        "--limit", str(len(tasks)),
    ]
    for task in tasks:
        server_args.extend(["--task-id", task])
    overrides = {
        "model_reasoning_effort": args.reasoning_effort,
        "web_search": "disabled", "project_doc_max_bytes": 0,
        "mcp_servers.mobilegym.command": sys.executable,
        "mcp_servers.mobilegym.args": server_args,
        "mcp_servers.mobilegym.cwd": str(root),
        "mcp_servers.mobilegym.required": True,
        "mcp_servers.mobilegym.startup_timeout_sec": 30,
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
    (run_dir / "client_config.json").write_text(json.dumps({
        "client_version": version, "model": args.model, "reasoning_effort": args.reasoning_effort,
        "tasks": tasks, "sample_seed": args.seed, "overrides": overrides,
        "prompt": prompt, "context_policy": "one_session_for_entire_batch",
        "response_format": RESPONSE_FORMAT, "thought_kind": THOUGHT_KIND,
        "model_response_log_kind": MODEL_RESPONSE_LOG_KIND,
        "observation_format": OBSERVATION_FORMAT,
        "generic_v2_prompt_policy": "verbatim", "generic_v2_prompt_sha256": protocol_sha256(),
        "cache_accounting": "client_reported_only_not_subscription_billing",
    }, ensure_ascii=False, indent=2))
    (run_dir / "generic_v2_system_prompt.txt").write_text(get_protocol(), encoding="utf-8")
    (run_dir / "client_prompt.txt").write_text(prompt, encoding="utf-8")
    with tempfile.TemporaryDirectory(prefix="mobilegym-codex-") as workspace:
        with (run_dir / "client_events.jsonl").open("w") as events, (run_dir / "client_stderr.log").open("w") as errors:
            completed = subprocess.run(command, cwd=workspace, env=environment, stdin=subprocess.DEVNULL,
                                       stdout=events, stderr=errors)
    results_file = run_dir / "results.jsonl"
    results = [json.loads(line) for line in results_file.read_text().splitlines()] if results_file.exists() else []
    batch_complete = len(results) == len(tasks) and (run_dir / "summary.json").exists()
    (run_dir / "client_exit.json").write_text(json.dumps({
        "returncode": completed.returncode, "batch_complete": batch_complete,
        "completed_episodes": len(results), "expected_episodes": len(tasks),
    }))
    from bench_env.mcp.usage import collect_usage
    collect_usage(run_dir)
    print(f"Codex exited with {completed.returncode}; completed {len(results)}/{len(tasks)}; artifacts: {run_dir}")
    raise SystemExit(completed.returncode or (0 if batch_complete else 2))


if __name__ == "__main__":
    main()
