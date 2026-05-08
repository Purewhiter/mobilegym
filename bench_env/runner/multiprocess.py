"""MultiProcessRunner - shard benchmark runs across Python processes."""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import math
import multiprocessing as mp
import os
import queue as queue_mod
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from bench_env.config import RunnerConfig
from bench_env.env.recorder import allocate_run_dir
from bench_env.logger import add_log_file, configure_logging, get_logger
from bench_env.metrics import load_jsonl, result_key, task_trial_key
from bench_env.runner.base import BaseRunner, EpisodeResult
from bench_env.runner.parallel import ParallelRunner

logger = get_logger(__name__)


@dataclass
class ProgressEvent:
    rank: int
    task_id: str
    trial_id: int
    success: bool
    error: str | None = None
    kind: str = "episode"


@dataclass
class ShardSpec:
    rank: int
    task_ids: list[str]
    run_dir: Path
    parallel: int = 1
    num_browsers: int = 0


@dataclass
class ShardHandle:
    spec: ShardSpec
    process: mp.Process
    reported_exit: bool = False


def _split_evenly(total: int, buckets: int) -> list[int]:
    """Distribute ``total`` across ``buckets`` so the sum equals ``total``.

    Front buckets receive the +1 from ``divmod`` remainder.
    """
    if buckets <= 0:
        return []
    base, rem = divmod(total, buckets)
    return [base + (1 if i < rem else 0) for i in range(buckets)]


def _configure_default_executor() -> None:
    import concurrent.futures

    max_workers = int(os.environ.get("MOBILE_GYM_TO_THREAD_WORKERS", "1024"))
    asyncio.get_running_loop().set_default_executor(
        concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="bench-to-thread",
        )
    )


def _silence_child_stdio() -> None:
    devnull = open(os.devnull, "w", encoding="utf-8")
    sys.stdout = devnull
    sys.stderr = devnull


async def _run_shard_async(
    config: RunnerConfig,
    task_ids: list[str],
    rank: int,
    progress_queue,
    shard_run_dir: Path,
) -> None:
    _configure_default_executor()

    # shard_run_dir is runs/<run>/shards/pNN; shard_run_dir.parent.parent is runs/<run>.
    parent_run_dir = shard_run_dir.parent.parent
    child_config = dataclasses.replace(
        config,
        task_id=None,
        task_ids=task_ids,
        run_dir=shard_run_dir,
        runs_dir=shard_run_dir.parent,
        trajectory_dir=parent_run_dir / "trajectory",
        browser_log_dir=parent_run_dir / "browser_logs",
        browser_log_prefix=f"p{rank:02d}_",
    )

    def emit(result: EpisodeResult) -> None:
        progress_queue.put(
            ProgressEvent(
                rank=rank,
                task_id=result.task_id,
                trial_id=result.trial_id,
                success=result.success,
                error=result.error,
            )
        )

    runner = await ParallelRunner.from_config(child_config, progress_callback=emit)
    await runner.run()


def _shard_main(
    config: RunnerConfig,
    task_ids: list[str],
    rank: int,
    progress_queue,
    shard_run_dir: Path,
) -> None:
    _silence_child_stdio()
    shard_run_dir = Path(shard_run_dir)
    shard_run_dir.mkdir(parents=True, exist_ok=True)
    configure_logging(quiet=False)
    add_log_file(shard_run_dir / "console.log")

    try:
        asyncio.run(_run_shard_async(config, task_ids, rank, progress_queue, shard_run_dir))
    except BaseException as err:
        logger.exception(f"[p{rank:02d}] shard crashed: {type(err).__name__}: {err}")
        try:
            progress_queue.put(
                ProgressEvent(
                    rank=rank,
                    task_id="__shard__",
                    trial_id=0,
                    success=False,
                    error=f"{type(err).__name__}: {err}",
                    kind="fatal",
                )
            )
        except Exception:
            pass
        raise


class MultiProcessRunner(BaseRunner):
    """父进程编排多个 ParallelRunner shard。"""

    def __init__(self, tasks: list[Any], config: RunnerConfig):
        self.tasks = tasks
        self.config = config
        self.verbose = not config.quiet
        self.run_dir: Path | None = None
        self._start_time: datetime | None = None
        self._shards: list[ShardSpec] = []
        self._handles: list[ShardHandle] = []
        self._progress_queue = None
        self._completed_keys: set[str] = set()
        self._success_count = 0
        self._fail_count = 0
        # Top-level live aggregation: parent tails each shard's results.jsonl
        # by tracked byte offset and appends new whole lines to run_dir/results.jsonl
        # (and errors.jsonl) so external tooling can watch progress in real time.
        self._top_results_file = None
        self._top_errors_file = None
        self._shard_offsets: dict[int, int] = {}

    @classmethod
    async def from_args(cls, args: argparse.Namespace) -> "MultiProcessRunner":
        config = RunnerConfig.from_args(args)
        return await cls.from_config(config)

    @classmethod
    async def from_config(
        cls,
        config: RunnerConfig,
        progress_callback: Callable[[EpisodeResult], None] | None = None,
    ) -> "MultiProcessRunner":
        from bench_env import factory

        if config.agent == "human":
            raise ValueError("Multiprocess mode does not support human agent")
        if config.processes < 1:
            raise ValueError("--processes must be >= 1")
        if config.parallel < 1:
            raise ValueError("--parallel must be >= 1")
        if progress_callback is not None:
            raise ValueError("MultiProcessRunner does not support progress_callback")

        tasks = factory.load_tasks(config)
        return cls(tasks, config)

    async def run(self) -> list[dict[str, Any]]:
        from tqdm import tqdm
        from bench_env.logger import tqdm_logging_redirect

        self._prepare_run()
        assert self.run_dir is not None

        monitor_task = self._start_monitor(self.run_dir, self.config) if self.config.monitor else None
        total_episodes = len(self.tasks) * self.config.repeat_n
        shard_parallels = [s.parallel for s in self._shards]
        if shard_parallels and min(shard_parallels) == max(shard_parallels):
            parallel_desc = str(shard_parallels[0])
        else:
            parallel_desc = f"min={min(shard_parallels)} max={max(shard_parallels)}" if shard_parallels else "0"
        logger.info(
            f"Tasks: {len(self.tasks)}, Repeat: {self.config.repeat_n}, "
            f"Processes: {len(self._shards)}, Parallel(total): {sum(shard_parallels)}, "
            f"Parallel/shard: {parallel_desc}, Output: {self.run_dir}"
        )

        interrupted: BaseException | None = None
        try:
            self._start_children()
            with tqdm_logging_redirect():
                pbar = tqdm(
                    total=total_episodes,
                    desc="Evaluating",
                    unit="ep",
                    dynamic_ncols=True,
                    disable=not self.verbose,
                )
                try:
                    await self._monitor_children(pbar)
                finally:
                    pbar.close()
        except (KeyboardInterrupt, asyncio.CancelledError) as err:
            logger.warning("Multiprocess run interrupted, terminating child shards")
            self._terminate_children()
            interrupted = err
        finally:
            self._stop_monitor(monitor_task)

        results, summary = self._finalize()
        self._log_summary(summary)
        if interrupted is not None:
            raise interrupted
        return results

    def _effective_processes(self) -> int:
        if not self.tasks:
            return 0

        effective = max(1, min(self.config.processes, self.config.parallel, len(self.tasks)))
        isolation = str(self.config.isolation)
        browser_budget = int(self.config.num_browsers or 0)

        if (
            browser_budget > 0
            and isolation in {"pages", "contexts"}
            and effective > browser_budget
        ):
            limited = max(1, min(browser_budget, self.config.parallel, len(self.tasks)))
            logger.warning(
                f"--processes {self.config.processes} would create {effective} shards, "
                f"but --browsers {browser_budget} is a total browser budget in "
                f"{isolation} isolation. Using {limited} processes so no shard falls "
                "back to browser auto-allocation."
            )
            return limited

        return effective

    def _prepare_run(self) -> None:
        from bench_env import factory

        self._start_time = datetime.now()
        runs_root = Path(self.config.runs_dir).expanduser().resolve()
        timestamp = self._start_time.strftime("%Y%m%d_%H%M%S")
        self.run_dir = allocate_run_dir(runs_root, timestamp)
        self.run_dir.mkdir(parents=True, exist_ok=False)
        (self.run_dir / "shards").mkdir(exist_ok=True)
        # Pre-create shared dirs so child shards don't race on mkdir.
        if not self.config.no_save_trajectory:
            (self.run_dir / "trajectory").mkdir(exist_ok=True)
        (self.run_dir / "browser_logs").mkdir(exist_ok=True)

        add_log_file(self.run_dir / "console.log")
        self._open_live_files()

        self._shards = self._build_shards()

        meta = {
            "start_time": self._start_time.isoformat(),
            "agent": factory.get_agent_name(self.config),
            "model_name": self.config.model_name,
            "repeat_n": self.config.repeat_n,
            "save_trajectory": not self.config.no_save_trajectory,
            "coord_space": self.config.coord_space,
            "has_pil": True,
            **self.config.to_dict(),
            "effective_processes": len(self._shards),
            "parallel_per_shard": [s.parallel for s in self._shards],
            "browsers_per_shard": [s.num_browsers for s in self._shards],
        }
        (self.run_dir / "meta.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )

    def _open_live_files(self) -> None:
        assert self.run_dir is not None
        self._top_results_file = (self.run_dir / "results.jsonl").open("w", encoding="utf-8")
        self._top_errors_file = (self.run_dir / "errors.jsonl").open("w", encoding="utf-8")

    def _close_live_files(self) -> None:
        for attr in ("_top_results_file", "_top_errors_file"):
            f = getattr(self, attr, None)
            if f is None:
                continue
            try:
                f.close()
            finally:
                setattr(self, attr, None)

    def _tail_shard_results(self) -> None:
        # Pull newly-flushed whole lines from each shard's results.jsonl into
        # the top-level results.jsonl/errors.jsonl so `tail -f` works during the run.
        if self._top_results_file is None:
            return
        from bench_env.metrics import build_error_entry, result_is_error

        wrote = False
        for spec in self._shards:
            src = spec.run_dir / "results.jsonl"
            if not src.exists():
                continue
            offset = self._shard_offsets.get(spec.rank, 0)
            try:
                size = src.stat().st_size
            except OSError:
                continue
            if size <= offset:
                continue
            with src.open("rb") as f:
                f.seek(offset)
                chunk = f.read(size - offset)
            # Only consume up to the last newline so a partially-written final
            # line is left for the next tick.
            last_nl = chunk.rfind(b"\n")
            if last_nl < 0:
                continue
            consumed = chunk[: last_nl + 1]
            for raw_line in consumed.splitlines():
                if not raw_line.strip():
                    continue
                try:
                    line_str = raw_line.decode("utf-8")
                    row = json.loads(line_str)
                except (UnicodeDecodeError, json.JSONDecodeError) as err:
                    logger.warning(f"[p{spec.rank:02d}] tail skipped malformed line: {err}")
                    continue
                self._top_results_file.write(line_str + "\n")
                if result_is_error(row):
                    self._top_errors_file.write(
                        json.dumps(build_error_entry(row), ensure_ascii=False, default=str) + "\n"
                    )
                wrote = True
            self._shard_offsets[spec.rank] = offset + len(consumed)
        if wrote:
            self._top_results_file.flush()
            self._top_errors_file.flush()

    def _append_results_to_top_level(self, results: list[dict[str, Any]]) -> None:
        if self._top_results_file is None:
            return
        from bench_env.metrics import build_error_entry, result_is_error

        for r in results:
            self._top_results_file.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")
            if result_is_error(r):
                self._top_errors_file.write(
                    json.dumps(build_error_entry(r), ensure_ascii=False, default=str) + "\n"
                )
        self._top_results_file.flush()
        self._top_errors_file.flush()

    def _build_shards(self) -> list[ShardSpec]:
        assert self.run_dir is not None

        k = self._effective_processes()
        chunk_size = max(1, math.ceil(len(self.tasks) / k))
        chunks: list[tuple[int, list[Any]]] = []
        for rank in range(k):
            chunk = self.tasks[rank * chunk_size:(rank + 1) * chunk_size]
            if not chunk:
                continue
            chunks.append((rank, chunk))

        actual_k = len(chunks)
        # Distribute total parallel/browsers across actual shards so the sums
        # equal the user-requested totals (no over-allocation, no extra envs).
        parallel_split = _split_evenly(self.config.parallel, actual_k)
        if self.config.num_browsers > 0:
            browsers_split = _split_evenly(self.config.num_browsers, actual_k)
        else:
            browsers_split = [0] * actual_k

        shards: list[ShardSpec] = []
        for i, (rank, chunk) in enumerate(chunks):
            shards.append(
                ShardSpec(
                    rank=rank,
                    task_ids=[task.id for task in chunk],
                    run_dir=self.run_dir / "shards" / f"p{rank:02d}",
                    parallel=max(1, parallel_split[i]),
                    num_browsers=browsers_split[i],
                )
            )
        return shards

    def _shard_config(self, spec: ShardSpec) -> RunnerConfig:
        return dataclasses.replace(
            self.config,
            parallel=spec.parallel,
            num_browsers=spec.num_browsers,
            processes=1,
            monitor=False,
            quiet=True,
            run_dir=None,
        )

    def _start_children(self) -> None:
        ctx = mp.get_context("spawn")
        self._progress_queue = ctx.Queue()
        stagger_s = float(os.environ.get("MOBILE_GYM_PROCESS_STAGGER_SEC", "0"))

        for i, spec in enumerate(self._shards):
            child_config = self._shard_config(spec)
            p = ctx.Process(
                target=_shard_main,
                args=(child_config, spec.task_ids, spec.rank, self._progress_queue, spec.run_dir),
                name=f"bench-shard-p{spec.rank:02d}",
            )
            p.start()
            self._handles.append(ShardHandle(spec=spec, process=p))
            logger.info(
                f"[p{spec.rank:02d}] started pid={p.pid}, tasks={len(spec.task_ids)}, "
                f"parallel={spec.parallel}, browsers={spec.num_browsers or 'auto'}"
            )
            if stagger_s > 0 and i + 1 < len(self._shards):
                time.sleep(stagger_s)

    async def _monitor_children(self, pbar) -> None:
        while True:
            await self._drain_progress(pbar)
            self._tail_shard_results()

            all_done = True
            for handle in self._handles:
                p = handle.process
                if p.is_alive():
                    all_done = False
                    continue
                if not handle.reported_exit:
                    p.join(timeout=0)
                    handle.reported_exit = True
                    if p.exitcode:
                        logger.error(f"[p{handle.spec.rank:02d}] exited with code {p.exitcode}")
                    else:
                        logger.info(f"[p{handle.spec.rank:02d}] completed")

            if all_done:
                break
            await asyncio.sleep(0.2)

        await self._drain_progress(pbar)
        self._tail_shard_results()

    async def _drain_progress(self, pbar) -> None:
        # Bound the inner loop so a flood of events can't block the asyncio loop.
        if self._progress_queue is None:
            return

        BATCH = 64
        processed = 0
        while True:
            try:
                event = self._progress_queue.get_nowait()
            except queue_mod.Empty:
                return

            if not isinstance(event, ProgressEvent):
                continue
            if event.kind == "fatal":
                logger.error(f"[p{event.rank:02d}] fatal: {event.error}")
                continue

            key = task_trial_key(event.task_id, event.trial_id)
            if key in self._completed_keys:
                continue
            self._completed_keys.add(key)
            if event.success:
                self._success_count += 1
            else:
                self._fail_count += 1
            if pbar:
                pbar.set_postfix_str(f"✓{self._success_count} ✗{self._fail_count}")
                pbar.update(1)

            processed += 1
            if processed >= BATCH:
                await asyncio.sleep(0)
                processed = 0

    def _terminate_children(self) -> None:
        for handle in self._handles:
            p = handle.process
            if p.is_alive():
                p.terminate()
        for handle in self._handles:
            p = handle.process
            p.join(timeout=5)
            if p.is_alive() and hasattr(p, "kill"):
                p.kill()
                p.join(timeout=2)

    def _finalize(self) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        assert self.run_dir is not None
        from bench_env.metrics import write_summary_json

        # Final tail catches anything children flushed between the last poll
        # and their exit.
        self._tail_shard_results()

        streamed = load_jsonl(self.run_dir / "results.jsonl")
        existing_keys = {result_key(r) for r in streamed}
        task_by_id = {task.id: task for task in self.tasks}
        missing: list[dict[str, Any]] = []
        for spec in self._shards:
            exitcode = self._exitcode_for_rank(spec.rank)
            for task_id in spec.task_ids:
                for trial_id in range(self.config.repeat_n):
                    key = task_trial_key(task_id, trial_id)
                    if key in existing_keys:
                        continue
                    reason = (
                        f"Shard p{spec.rank:02d} exited with code {exitcode}"
                        if exitcode
                        else f"Shard p{spec.rank:02d} produced no result"
                    )
                    missing.append(self._make_missing_result(task_by_id[task_id], trial_id, reason))

        if missing:
            logger.warning(f"Adding {len(missing)} missing-result ERROR entries")
            self._append_results_to_top_level(missing)

        self._close_live_files()

        results = streamed + missing
        summary = write_summary_json(
            self.run_dir,
            results,
            repeat_n=self.config.repeat_n,
            pass_k=self.config.pass_k,
            start_time=self._start_time.isoformat() if self._start_time else None,
        )
        return results, summary

    def _exitcode_for_rank(self, rank: int) -> int | None:
        for handle in self._handles:
            if handle.spec.rank == rank:
                return handle.process.exitcode
        return None

    def _make_missing_result(self, task: Any, trial_id: int, reason: str) -> dict[str, Any]:
        now = datetime.now().isoformat()
        execution = {
            "steps": 0,
            "finished": False,
            "truncated": False,
            "stop_reason": "ERROR",
            "agent_message": None,
            "agent_answer": None,
            "runtime_s": 0.0,
            "error": reason,
            "stopwatch_total_s": 0.0,
            "stopwatch_flat": {},
            "stopwatch_tree": [],
        }
        result: dict[str, Any] = {
            "id": task.id,
            "task_name": getattr(task, "description", task.id),
            "suite": getattr(task, "suite", "unknown"),
            "apps": list(getattr(task, "apps", []) or []),
            "trial_id": trial_id,
            "execution": execution,
            "judge": None,
            "is_success": False,
            "is_error": True,
            "progress": 0.0,
            "premature_termination": False,
            "overdue_termination": False,
            "max_steps": self.config.get_max_steps(task),
            "start_time": now,
            "end_time": now,
        }
        for field in ("difficulty", "scope", "objective", "composition"):
            value = getattr(task, field, "")
            if value:
                result[field] = value
        caps = list(getattr(task, "capabilities", []) or [])
        if caps:
            result["capabilities"] = caps
        return result

    def _log_summary(self, summary: dict[str, Any]) -> None:
        total = summary.get("total_episodes", 0)
        errors = summary.get("error", 0)
        logger.info(f"\n{'=' * 60}")
        logger.info(f"  RESULTS SUMMARY ({total} episodes, {errors} errors)")
        logger.info(f"{'=' * 60}")
        logger.info(
            f"  Success Rate (SR):              "
            f"{summary.get('success', 0)}/{max(1, total - errors)} = "
            f"{summary.get('success_rate', 0):.1%}"
        )
        logger.info(f"  Failed:                         {summary.get('failed', 0)}")
        logger.info(f"  Errors:                         {errors}")
        logger.info(f"  Output:                         {self.run_dir}")
        logger.info(f"{'=' * 60}")
