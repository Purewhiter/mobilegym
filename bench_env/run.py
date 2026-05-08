#!/usr/bin/env python3
"""bench_env CLI (async)"""

import argparse
import asyncio
import os
import sys

from bench_env.runner import ExecRunner, SerialRunner, ParallelRunner
from bench_env.agent import list_agents
from bench_env.logger import configure_logging
from bench_env.task_listing import list_tasks


def create_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Mobile GUI Agent Benchmark")

    # Mode
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--list", action="store_true", help="List all available tasks")
    mode.add_argument("--exec", type=str, help="Execute instruction (no judging)")
    mode.add_argument("--task-id", type=str, help="Run specific task")
    mode.add_argument(
        "--task-ids",
        type=str,
        help="Run multiple tasks by comma-separated task ids (e.g. suite.ClassA,suite.ClassB).",
    )
    # Tasks
    p.add_argument(
        "--suite",
        type=str,
        help="Filter tasks by suite, comma-separated (e.g. wechat,redbook)",
    )
    p.add_argument(
        "--filter-difficulty",
        type=str,
        dest="filter_difficulty",
        help="Filter tasks by difficulty, comma-separated (e.g. L1,L2)",
    )
    p.add_argument(
        "--filter-objective",
        type=str,
        dest="filter_objective",
        help="Filter tasks by objective, comma-separated (e.g. query,operate)",
    )
    p.add_argument(
        "--filter-composition",
        type=str,
        dest="filter_composition",
        help="Filter tasks by composition, comma-separated (e.g. atomic,sequential)",
    )
    p.add_argument(
        "--filter-scope",
        type=str,
        dest="filter_scope",
        help="Filter tasks by scope, comma-separated (e.g. S1,S2)",
    )
    p.add_argument(
        "--filter-capabilities",
        type=str,
        dest="filter_capabilities",
        help="Filter tasks by capabilities (ANY match), comma-separated (e.g. query,search)",
    )
    filter_af = p.add_mutually_exclusive_group()
    filter_af.add_argument(
        "--filter-has-answer-fields",
        dest="filter_has_answer_fields",
        action="store_true",
        default=None,
        help="Only include tasks that have answer_fields defined",
    )
    filter_af.add_argument(
        "--filter-no-answer-fields",
        dest="filter_has_answer_fields",
        action="store_false",
        help="Only include tasks that do NOT have answer_fields",
    )
    p.add_argument(
        "--filter-mode",
        type=str,
        dest="filter_mode",
        choices=["and", "or"],
        default="and",
        help="Logic between filter fields: 'and' (all must match, default) or 'or' (any must match)",
    )
    p.add_argument(
        "--split",
        type=str,
        default=None,
        help=(
            "Restrict task selection to a split whitelist. "
            "Forms: '<name>' (e.g. test), "
            "'<name>+<name>' (union, e.g. test+payment), "
            "or a path to a text file with one task_id per line. "
            "Composes with other filters as AND."
        ),
    )
    # Rerun (not in mode group — --suite / --task-ids serve as filters in rerun mode)
    p.add_argument(
        "--rerun",
        type=str,
        metavar="RUN_DIR",
        help="Rerun tasks from an existing run directory and update results in-place",
    )
    p.add_argument(
        "--rerun-scope",
        choices=["error", "failed", "all"],
        default="error",
        help="Rerun scope: error (default), failed, all",
    )
    # Resume (continue an interrupted run by running tasks that have no recorded results)
    p.add_argument(
        "--resume",
        type=str,
        metavar="RUN_DIR",
        help="Resume an interrupted run: run tasks with no recorded results and append to the original run directory",
    )
    # Prune (remove results.jsonl entries outside the current valid task set).
    # Default valid set = TaskRegistry. With --split, valid = registry ∩ split,
    # which cleans up both code orphans and results that fall outside the split.
    p.add_argument(
        "--prune",
        type=str,
        metavar="RUN_DIR",
        help=(
            "Prune result entries outside the valid task set "
            "(default: tasks in current code; with --split: current ∩ split). "
            "Pairs with --resume to keep the run in sync with code/split changes."
        ),
    )
    p.add_argument(
        "--prune-orphans",
        type=str,
        metavar="RUN_DIR",
        help="DEPRECATED alias for --prune. Use --prune instead.",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what --prune would remove without touching files",
    )

    p.add_argument(
        "--sample-n",
        type=int,
        help="Sample N instances per task (tasks without parameters stay 1 instance)",
    )
    p.add_argument("--sample-seed", type=int, help="Random seed for task sampling")
    
    # Pass@k evaluation
    p.add_argument(
        "--repeat-n",
        type=int,
        default=1,
        help="Repeat each task N times for pass@k evaluation (default: 1)",
    )
    p.add_argument(
        "--pass-k",
        type=str,
        default=None,
        help="Comma-separated k values for pass@k metrics (e.g., '1,5,10')",
    )

    # Agent
    p.add_argument("--agent", choices=list_agents(), default="generic_v2")
    p.add_argument("--model-base-url", type=str)
    p.add_argument("--model-api-key", type=str, default="")
    p.add_argument("--model-name", type=str)
    p.add_argument("--temperature", type=float)
    p.add_argument("--top-p", type=float)
    p.add_argument("--max-tokens", type=int)
    p.add_argument("--no-stream", action="store_true")
    p.add_argument("--infer-timeout", type=float, default=300.0,
                   help="Total wall-clock timeout per LLM call in seconds (0=disable, default 300)")

    # Environment
    p.add_argument(
        "--device",
        choices=["sim", "real"],
        default="sim",
        help="Device type: sim (simulator) or real (ADB device). Default: sim",
    )
    p.add_argument("--env-url", type=str, help="Simulator URL (required for sim mode)")
    p.add_argument("--device-serial", type=str, help="ADB device serial (optional for real mode)")
    p.add_argument("--headless", action="store_true")
    p.add_argument("--proxy", type=str, help="Browser proxy server (e.g. http://127.0.0.1:7890)")
    p.add_argument(
        "--coord-space",
        default="norm_0_1000",
        help="Coordinate space: norm_0_1000 | norm_0_1 | physical",
    )
    p.add_argument("--delay-after-action", type=float, default=1.0)

    # Execution
    p.add_argument("--max-steps", type=int, default=None)
    p.add_argument("--quiet", "-q", action="store_true", help="Disable verbose output")
    p.add_argument(
        "--loop-detect", type=int, default=0,
        help="Terminate if agent repeats the same action N times consecutively (0=disable, default: off)",
    )

    # Output
    p.add_argument("--runs-dir", type=str)
    p.add_argument("--no-save-trajectory", action="store_true")
    p.add_argument("--screenshot-scale", type=float, default=1.0, help="Screenshot scale (default: 1.0, JPEG is compact enough)")
    p.add_argument(
        "--list-md",
        type=str,
        help="Write --list output to a Markdown file",
    )
    p.add_argument(
        "--include-generated",
        action="store_true",
        help="Include generated task suites (bench_env/generated_task/) in --list",
    )
    p.add_argument(
        "--task-instructions",
        type=str,
        default=None,
        help=(
            "Path to JSON file mapping task_id -> full instruction string "
            "(e.g. {\"wechat.ReadContactRegion\": \"...\"}). When a task matches, "
            "its template and parameter sampling are replaced by the given "
            "instruction verbatim; used for sim2real eval and pre-baked prompts. "
            "Applies to both sim and real device."
        ),
    )
    p.add_argument(
        "--list-online",
        action="store_true",
        help="Use --env-url to load __SIM__.getState() for online task listing (always headless, no browser window)",
    )

    # Parallel
    p.add_argument("--parallel", type=int, default=1)
    p.add_argument(
        "--processes",
        type=int,
        default=1,
        help=(
            "Number of Python shard processes. Default 1 keeps existing single-process behavior; "
            "with K>1, --parallel is treated as total env concurrency and split across shards."
        ),
    )
    p.add_argument("--isolation", choices=["pages", "contexts", "browsers"], default="pages")
    p.add_argument("--monitor", action="store_true",
                   help="Enable system/GPU/vLLM monitoring (saves monitor.csv to run dir)")
    p.add_argument(
        "--browsers", type=int, default=0, dest="num_browsers",
        help="Number of browser processes to distribute pages/contexts across (0=auto). "
             "In --processes mode, this is treated as a total and split across shards. "
             "E.g. --parallel=64 --isolation=contexts --browsers=8 creates "
             "8 browsers x 8 contexts each.",
    )

    # VLM Judge (for real device evaluation)
    p.add_argument(
        "--judge-mode",
        choices=["state", "vlm", "auto"],
        default="auto",
        help="Evaluation mode: state (JSON state matching), vlm (VLM visual), auto (vlm for real device). Default: auto",
    )
    p.add_argument(
        "--eval-mode",
        choices=["text", "grounded"],
        default="text",
        help="Answer evaluation mode: text (legacy match_value), grounded (answer_sheet UI). Default: text",
    )
    p.add_argument(
        "--judge-model",
        type=str,
        help="VLM model name for judge (default: same as --model-name)",
    )
    p.add_argument(
        "--judge-base-url",
        type=str,
        help="VLM API URL for judge (default: same as --model-base-url)",
    )
    p.add_argument(
        "--judge-api-key",
        type=str,
        help="VLM API key for judge (default: same as --model-api-key)",
    )

    return p


def _parse_suite(value: str | None) -> list[str] | None:
    """Parse --suite to list[str] (comma-separated)."""
    if not value:
        return None
    parts = [p.strip() for p in str(value).split(",")]
    return [p for p in parts if p] or None


async def async_main(args) -> int:
    # 默认 asyncio thread pool 是 min(32, cpu+4),256 cores 机器上是 32。
    # `await asyncio.to_thread(agent.act, obs)` 把同步 vLLM 请求扔到这个 pool,
    # 256 envs 时只有 32 能同时执行,其余 224 在 pool 排队 → infer per-step 飙到 30s。
    # agent.act 是 socket-blocked 等 vLLM,基本不吃 CPU,thread 数远超核数无副作用。
    # 可用 MOBILE_GYM_TO_THREAD_WORKERS 覆盖默认 1024。
    import concurrent.futures
    _to_thread_workers = int(os.environ.get("MOBILE_GYM_TO_THREAD_WORKERS", "1024"))
    asyncio.get_running_loop().set_default_executor(
        concurrent.futures.ThreadPoolExecutor(
            max_workers=_to_thread_workers,
            thread_name_prefix="bench-to-thread",
        )
    )
    try:
        mode_flags = [
            ("--resume", getattr(args, "resume", None)),
            ("--rerun", getattr(args, "rerun", None)),
            ("--prune", getattr(args, "prune", None)),
            ("--prune-orphans", getattr(args, "prune_orphans", None)),
        ]
        active = [name for name, val in mode_flags if val]
        if len(active) > 1:
            print(f"[ERROR] {', '.join(active)} are mutually exclusive")
            return 2

        if getattr(args, "prune_orphans", None):
            print("[DEPRECATED] --prune-orphans is an alias for --prune. Please switch to --prune.")

        if getattr(args, "prune", None) or getattr(args, "prune_orphans", None):
            from bench_env.rerun import run_prune
            return await run_prune(args)

        if getattr(args, "resume", None):
            from bench_env.rerun import run_resume
            return await run_resume(args)

        if getattr(args, "rerun", None):
            from bench_env.rerun import run_rerun
            return await run_rerun(args)

        if args.list:
            if getattr(args, "list_online", False) and not getattr(args, "env_url", None):
                print("[ERROR] --list-online requires --env-url")
                return 2
            def _parse_filter(value):
                if not value:
                    return None
                return [x.strip() for x in str(value).split(",") if x.strip()]

            from bench_env.splits import resolve_split
            split_spec = getattr(args, "split", None)
            split_ids = frozenset(resolve_split(split_spec)) if split_spec else None

            await list_tasks(
                _parse_suite(args.suite),
                include_generated=getattr(args, "include_generated", False),
                markdown_path=getattr(args, "list_md", None),
                env_url=getattr(args, "env_url", None),
                online=getattr(args, "list_online", False),
                proxy=getattr(args, "proxy", None),
                sample_n=getattr(args, "sample_n", None),
                filter_difficulty=_parse_filter(getattr(args, "filter_difficulty", None)),
                filter_objective=_parse_filter(getattr(args, "filter_objective", None)),
                filter_composition=_parse_filter(getattr(args, "filter_composition", None)),
                filter_scope=_parse_filter(getattr(args, "filter_scope", None)),
                filter_capabilities=_parse_filter(getattr(args, "filter_capabilities", None)),
                filter_mode=getattr(args, "filter_mode", "and"),
                filter_has_answer_fields=getattr(args, "filter_has_answer_fields", None),
                split_task_ids=split_ids,
            )
            return 0
        
        # Validate environment args based on device type
        device = getattr(args, "device", "sim")
        if device == "sim" and not args.env_url:
            print("[ERROR] --env-url is required for simulator mode")
            return 2
        
        if args.exec:
            runner = await ExecRunner.from_args(args)
        elif args.processes > 1:
            from bench_env.runner import MultiProcessRunner
            runner = await MultiProcessRunner.from_args(args)
        elif args.parallel > 1:
            runner = await ParallelRunner.from_args(args)
        else:
            runner = await SerialRunner.from_args(args)
        
        await runner.run()
        return 0

    except (ValueError, FileNotFoundError) as e:
        print(f"[ERROR] {e}")
        return 2


def main(argv=None) -> int:
    args = create_parser().parse_args(argv)
    
    configure_logging(quiet=args.quiet)

    try:
        return asyncio.run(async_main(args))
    except KeyboardInterrupt:
        print("\n[Interrupted]")
        return 130


if __name__ == "__main__":
    sys.exit(main())
