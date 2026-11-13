"""Run a frozen task selection in isolated Pi processes."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from bench_env.mcp.parallel import DEFAULT_EPISODE_TIMEOUT, episode_timeout, run_parallel, validate_selection


async def run(args) -> int:
    selection = validate_selection(json.loads(args.selection.read_text(encoding="utf-8")))
    return await run_parallel(args, selection, "pi")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-url", required=True)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--parallel", type=int, default=5)
    parser.add_argument("--episode-timeout", type=episode_timeout, default=DEFAULT_EPISODE_TIMEOUT,
                        help="Seconds allowed per worker attempt (default: %(default)g)")
    parser.add_argument("--model", default="gpt-5.6-sol")
    parser.add_argument("--reasoning-effort", default="medium")
    parser.add_argument("--retry-errors", action="store_true", help="Retry infrastructure failures once")
    args = parser.parse_args()
    if args.parallel < 1:
        parser.error("--parallel must be positive")
    try:
        code = asyncio.run(run(args))
    except (OSError, ValueError) as error:
        parser.error(str(error))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
