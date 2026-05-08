#!/usr/bin/env python3
"""Per-browser-instance memory micro-benchmark.

Launches N MobileGym env instances under a chosen isolation mode, warms them
up for a fixed period, then reads PSS (Proportional Set Size) from
/proc/<pid>/smaps_rollup for every chromium process descended from our
playwright-launched parents. PSS apportions shared pages, so summing PSS
across processes gives true physical memory used — no double counting.

Usage:
  python scripts/bench/perf/mem_microbench.py --url http://localhost:3000 --n 4 --isolation pages
  python scripts/bench/perf/mem_microbench.py --url http://localhost:3000 --sweep
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

import psutil

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))

from bench_env.env.pool import EnvPool, Isolation


def read_pss_kb(pid: int) -> int | None:
    """Sum Pss from /proc/<pid>/smaps_rollup (kB). Returns None if unreadable."""
    try:
        with open(f"/proc/{pid}/smaps_rollup") as f:
            for line in f:
                if line.startswith("Pss:"):
                    return int(line.split()[1])
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        return None
    return None


def classify_process(name: str) -> str | None:
    """Return 'env' for Chromium, 'runner' for python/node, else None."""
    n = name.lower()
    if any(s in n for s in ("chrom", "headless")):
        return "env"
    if any(s in n for s in ("python", "node")):
        return "runner"
    return None


def collect_classified_descendants(parent_pids: list[int]) -> dict[str, list[psutil.Process]]:
    """All descendants split into 'env' (Chromium) vs 'runner' (python+node).

    The Python bench process and Playwright's node shim are charged to
    'runner'; only Chromium processes are charged to 'env'. This is what the
    paper should report as per-instance environment memory — bench-side
    Agent context, trajectory buffers, etc. are runner-side cost.
    """
    seen: set[int] = set()
    out: dict[str, list[psutil.Process]] = {"env": [], "runner": []}
    me = psutil.Process()
    out["runner"].append(me)
    seen.add(me.pid)

    for ppid in parent_pids + [me.pid]:
        try:
            root = psutil.Process(ppid)
        except psutil.NoSuchProcess:
            continue
        for p in [root, *root.children(recursive=True)]:
            if p.pid in seen:
                continue
            seen.add(p.pid)
            try:
                name = p.name()
            except psutil.Error:
                continue
            kind = classify_process(name)
            if kind:
                out[kind].append(p)
    return out


def aggregate_memory(procs: list[psutil.Process]) -> dict:
    pss_total_kb = 0
    rss_total_kb = 0
    n_procs = 0
    n_pss_ok = 0
    for p in procs:
        try:
            rss_total_kb += p.memory_info().rss // 1024
            n_procs += 1
        except psutil.Error:
            continue
        pss = read_pss_kb(p.pid)
        if pss is not None:
            pss_total_kb += pss
            n_pss_ok += 1
    return {
        "n_procs": n_procs,
        "n_pss_ok": n_pss_ok,
        "pss_total_mb": pss_total_kb / 1024,
        "rss_total_mb": rss_total_kb / 1024,
    }


async def time_resetstate_in_page(page) -> float:
    """Time JS-only __SIM__.resetState() inside the browser via performance.now()."""
    return await page.evaluate(
        """async () => {
            if (!window.__SIM__?.resetState) return -1;
            const t0 = performance.now();
            await window.__SIM__.resetState();
            return performance.now() - t0;
        }"""
    )


async def time_snapshot_restore_in_page(page, n_iter: int) -> list[float]:
    """Snapshot the current 'seeded clean' state once, then time N restore cycles.

    Each cycle: localStorage.clear() + resetState() (clears stores) +
    setState(snapshot, {deep:false, reload:false}) (re-seeds from snapshot).
    No page reload, no waitForData — pure JS in-memory restore.
    """
    times = await page.evaluate(
        """async (n) => {
            const sim = window.__SIM__;
            if (!sim?.getState || !sim?.setState || !sim?.resetState) return null;

            // Capture once: include ALL settable os keys (per applyOsStatePatch)
            // — build, telephony, settings, hardware, permissions, preferences, providers.
            // Plus apps (raw store states).
            const full = sim.getState();
            const patch = {
                apps: full.apps,
                os: {
                    build:       full.os.build,
                    telephony:   full.os.telephony,
                    settings:    full.os.settings,
                    hardware:    full.os.hardware,
                    permissions: full.os.permissions,
                    preferences: full.os.preferences,
                    providers:   full.os.providers,
                },
            };
            // Stringify to ensure deep clone (avoid live reference back to stores)
            const snap = JSON.parse(JSON.stringify(patch));

            const out = [];
            for (let i = 0; i < n; i++) {
                const t0 = performance.now();
                localStorage.clear();
                await sim.resetState();
                sim.setState(snap, { deep: false, reload: false });
                out.push(performance.now() - t0);
            }
            return out;
        }""",
        n_iter,
    )
    return times or []


async def measure_reset_timings(env, n_iterations: int = 5) -> dict:
    """Measure four reset paths on a single env:
      (a) __SIM__.resetState()         — JS state clear, no reload (current fast path)
      (b) page.goto(url) only           — Chromium re-load only (no reset, no wait)
      (c) snapshot_restore (PROTOTYPE)  — resetState + setState(snap), pure JS
      (d) full env.reset()              — what bench currently does (resetState + goto + waitForData)
    """
    page = env._page
    url = env.url
    js_only_ms: list[float] = []
    goto_only_ms: list[float] = []
    full_ms: list[float] = []

    # (c) Snapshot-restore: take snapshot once, run all iters in-page
    snapshot_restore_ms = await time_snapshot_restore_in_page(page, n_iterations)

    # IMPORTANT: snapshot_restore left state populated; bring page back to clean
    # baseline before timing other paths (so they all start from the same state).
    await env.reset()

    for _ in range(n_iterations):
        # (a) JS-only resetState — browser-side performance.now()
        ms = await time_resetstate_in_page(page)
        if ms >= 0:
            js_only_ms.append(ms)
        # (b) goto only — measures Chromium re-load cost
        t = time.time()
        await page.goto(url, wait_until="domcontentloaded")
        goto_only_ms.append((time.time() - t) * 1000)
        # (d) full env.reset() pipeline
        t = time.time()
        await env.reset()
        full_ms.append((time.time() - t) * 1000)

    import statistics as st

    def stats(xs: list[float]) -> dict:
        if not xs:
            return {"n": 0, "median_ms": 0, "mean_ms": 0, "min_ms": 0, "max_ms": 0}
        return {
            "n": len(xs),
            "median_ms": st.median(xs),
            "mean_ms": st.mean(xs),
            "min_ms": min(xs),
            "max_ms": max(xs),
        }

    return {
        "resetState_js_only": stats(js_only_ms),
        "page_goto_only": stats(goto_only_ms),
        "snapshot_restore": stats(snapshot_restore_ms),
        "env_reset_full": stats(full_ms),
    }


async def measure_one(
    url: str, n: int, isolation: str, warmup_s: float, num_browsers: int,
    measure_reset: bool = True, reset_iterations: int = 5,
) -> dict:
    """Run a single (n, isolation) configuration and return memory + reset stats."""
    print(f"\n=== n={n} isolation={isolation} num_browsers={num_browsers or 'auto'} ===")
    t0 = time.time()
    async with EnvPool(
        url=url,
        n=n,
        isolation=Isolation(isolation),
        num_browsers=num_browsers,
        headless=True,
    ) as pool:
        # Reset all envs so each loads a real homepage (mirrors eval setup)
        await asyncio.gather(*(env.reset() for env in pool._envs))
        t_setup = time.time() - t0
        print(f"  setup+reset: {t_setup:.1f}s — warming up {warmup_s:.0f}s")
        await asyncio.sleep(warmup_s)

        # ── MEMORY MEASUREMENT FIRST (before reset benchmark perturbs heap) ──
        # Identify the playwright-launched chromium parents.
        # EnvPool stores them on self._browsers; each Browser has a .process()
        # in newer playwright; if not, fall back to walking psutil for parents.
        parent_pids: list[int] = []
        for browser in pool._browsers:
            proc = getattr(browser, "_process", None) or getattr(browser, "process", None)
            if callable(proc):
                try:
                    proc = proc()
                except Exception:
                    proc = None
            pid = getattr(proc, "pid", None)
            if isinstance(pid, int):
                parent_pids.append(pid)

        if not parent_pids:
            # Fallback: find chromium parents whose ppid is our python process
            me = psutil.Process()
            for p in psutil.process_iter(["pid", "ppid", "name"]):
                try:
                    if "chrom" in (p.info["name"] or "").lower():
                        # walk up to see if we're an ancestor
                        cur = p
                        for _ in range(8):
                            if cur.ppid() == me.pid:
                                parent_pids.append(p.pid)
                                break
                            cur = psutil.Process(cur.ppid())
                except psutil.Error:
                    continue

        classified = collect_classified_descendants(parent_pids)
        env_mem = aggregate_memory(classified["env"])
        runner_mem = aggregate_memory(classified["runner"])

        # ── RESET TIMINGS LAST (perturbs heap; do after PSS captured) ──
        reset_stats = None
        if measure_reset and pool._envs:
            print(f"  measuring reset timings ({reset_iterations} iterations)...")
            reset_stats = await measure_reset_timings(pool._envs[0], reset_iterations)
            for label, s in reset_stats.items():
                if s["n"]:
                    print(f"    {label:25s} median={s['median_ms']:6.1f}ms  mean={s['mean_ms']:6.1f}ms  "
                          f"min={s['min_ms']:6.1f}  max={s['max_ms']:6.1f}  (n={s['n']})")

        return {
            "n_envs": n,
            "isolation": isolation,
            "num_browsers": num_browsers or 0,
            "warmup_s": warmup_s,
            # env (Chromium-only): what we charge per browser instance
            "env_n_procs": env_mem["n_procs"],
            "env_pss_total_mb": env_mem["pss_total_mb"],
            "env_rss_total_mb": env_mem["rss_total_mb"],
            "env_pss_per_env_mb": env_mem["pss_total_mb"] / n if n else 0,
            # runner (Python+node): bench-side cost, separately reported
            "runner_n_procs": runner_mem["n_procs"],
            "runner_pss_total_mb": runner_mem["pss_total_mb"],
            "runner_rss_total_mb": runner_mem["rss_total_mb"],
            # reset timings (browser-side performance.now() + e2e)
            "reset": reset_stats,
        }


def fmt_row(r: dict) -> str:
    return (
        f"  n={r['n_envs']:>3d} iso={r['isolation']:<8s}  "
        f"env: {r['env_n_procs']:>3d} procs / PSS {r['env_pss_total_mb']:>6.0f} MB "
        f"({r['env_pss_per_env_mb']:>5.0f} MB/env)  |  "
        f"runner: {r['runner_n_procs']:>2d} procs / PSS {r['runner_pss_total_mb']:>5.0f} MB"
    )


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://localhost:4183")
    ap.add_argument("--n", type=int, default=4)
    ap.add_argument("--isolation", choices=["pages", "contexts", "browsers"], default="pages")
    ap.add_argument("--num-browsers", type=int, default=0)
    ap.add_argument("--warmup", type=float, default=30.0)
    ap.add_argument(
        "--sweep",
        action="store_true",
        help="Run a full sweep: n=1,4,16 across pages/browsers (skip 64 unless --big).",
    )
    ap.add_argument("--big", action="store_true", help="Include n=64 in sweep.")
    args = ap.parse_args()

    if args.sweep:
        configs: list[tuple[int, str]] = []
        for n in [1, 4, 16] + ([64] if args.big else []):
            for iso in ["pages", "browsers"]:
                configs.append((n, iso))
        results: list[dict] = []
        for n, iso in configs:
            try:
                r = await measure_one(args.url, n, iso, args.warmup, args.num_browsers)
                results.append(r)
                print(fmt_row(r))
            except Exception as e:
                print(f"  config n={n} iso={iso} FAILED: {e}")
            # Short cool-down between configs to let RAM settle
            await asyncio.sleep(5)

        print("\n=== summary ===")
        print(f"  warmup={args.warmup}s per config; PSS = true physical memory (no double-count)")
        for r in results:
            print(fmt_row(r))
    else:
        r = await measure_one(args.url, args.n, args.isolation, args.warmup, args.num_browsers)
        print(fmt_row(r))


if __name__ == "__main__":
    asyncio.run(main())
