"""
Lightweight system/GPU/vLLM monitor for bench_env runs.

All collection functions are synchronous (read /proc, call nvidia-smi, HTTP GET).
The async ``monitor_loop`` coroutine runs them periodically and writes CSV.

Usage from a runner::

    task = asyncio.create_task(monitor_loop(run_dir, vllm_port=8001))
    # ... run episodes ...
    task.cancel()
"""

from __future__ import annotations

import asyncio
import csv
import glob
import os
import re
import subprocess
import time as _time
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from bench_env.logger import get_logger

logger = get_logger(__name__)

# ────────────────────── System ──────────────────────


def _load_avg() -> tuple[float, float, float]:
    with open("/proc/loadavg") as f:
        p = f.read().split()
    return float(p[0]), float(p[1]), float(p[2])


def _memory() -> dict[str, float]:
    """Memory in GB."""
    info: dict[str, float] = {}
    with open("/proc/meminfo") as f:
        for line in f:
            if line.startswith(("MemTotal:", "MemAvailable:")):
                k, v = line.split(":")
                info[k.strip()] = int(v.strip().split()[0]) / 1024 / 1024
    total = info.get("MemTotal", 0)
    avail = info.get("MemAvailable", 0)
    used = total - avail
    return {"total": total, "used": used, "pct": used / total * 100 if total else 0}


# ────────────────────── Processes ──────────────────────

_PROCESS_GROUPS = {
    "nginx": ["nginx"],
    "chromium": ["chromium", "chrome"],
    "vllm": ["vllm", "vllm_envs"],
    "bench": ["bench_env"],
    "api_gateway": ["api_gateway"],
}


def _process_groups() -> dict[str, dict[str, Any]]:
    groups: dict[str, list[float]] = defaultdict(list)
    page_size = os.sysconf("SC_PAGE_SIZE")
    for pid_dir in glob.glob("/proc/[0-9]*"):
        try:
            with open(f"{pid_dir}/cmdline", "rb") as f:
                cmd = f.read().replace(b"\x00", b" ").decode("utf-8", errors="replace").lower()
            if not cmd:
                continue
            with open(f"{pid_dir}/stat") as f:
                rss_mb = int(f.read().split(")")[-1].split()[21]) * page_size / 1024 / 1024
            for name, keys in _PROCESS_GROUPS.items():
                if any(k in cmd for k in keys):
                    groups[name].append(rss_mb)
                    break
        except (OSError, ValueError, IndexError):
            continue
    return {name: {"count": len(rss), "rss_mb": sum(rss)} for name, rss in groups.items()}


# ────────────────────── TCP ──────────────────────

_TCP_STATES = {
    "01": "ESTABLISHED", "06": "TIME_WAIT", "08": "CLOSE_WAIT",
}


def _tcp_stats() -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for path in ("/proc/net/tcp", "/proc/net/tcp6"):
        try:
            with open(path) as f:
                next(f)
                for line in f:
                    parts = line.split()
                    if len(parts) >= 4:
                        name = _TCP_STATES.get(parts[3])
                        if name:
                            counts[name] += 1
        except OSError:
            pass
    return dict(counts)


# ────────────────────── GPU ──────────────────────


def _gpu_stats() -> list[dict[str, Any]] | None:
    try:
        r = subprocess.run(
            ["nvidia-smi",
             "--query-gpu=index,utilization.gpu,memory.used,memory.total,temperature.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode != 0:
            return None
        gpus = []
        for line in r.stdout.strip().split("\n"):
            p = [x.strip() for x in line.split(",")]
            if len(p) >= 5:
                gpus.append({
                    "idx": int(p[0]),
                    "util": float(p[1]) if p[1] != "[N/A]" else 0,
                    "mem_used_mb": float(p[2]) if p[2] != "[N/A]" else 0,
                    "mem_total_mb": float(p[3]) if p[3] != "[N/A]" else 0,
                    "temp_c": float(p[4]) if p[4] != "[N/A]" else 0,
                })
        return gpus or None
    except Exception:
        return None


def _gpu_processes() -> dict[int, str]:
    """Return a mapping of GPU index → process summary string.

    Each value is a semicolon-separated list like::

        ray::WorkerDict.actor_rollout_ref_update_actor(70942MB);VLLM::Worker(5424MB)
    """
    try:
        # GPU UUID → index mapping
        r1 = subprocess.run(
            ["nvidia-smi", "--query-gpu=index,gpu_uuid", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5,
        )
        if r1.returncode != 0:
            return {}
        uuid_to_idx: dict[str, int] = {}
        for line in r1.stdout.strip().split("\n"):
            parts = [x.strip() for x in line.split(",")]
            if len(parts) >= 2:
                uuid_to_idx[parts[1]] = int(parts[0])

        # Processes per GPU
        r2 = subprocess.run(
            ["nvidia-smi",
             "--query-compute-apps=gpu_uuid,pid,process_name,used_memory",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if r2.returncode != 0:
            return {}
        per_gpu: dict[int, list[str]] = defaultdict(list)
        for line in r2.stdout.strip().split("\n"):
            parts = [x.strip() for x in line.split(",")]
            if len(parts) >= 4:
                idx = uuid_to_idx.get(parts[0])
                if idx is not None:
                    name = parts[2].rsplit("/", 1)[-1]  # keep only basename
                    mem = parts[3]
                    per_gpu[idx].append(f"{name}({mem}MB)")
        return {idx: ";".join(procs) for idx, procs in per_gpu.items()}
    except Exception:
        return {}


# ────────────────────── vLLM ──────────────────────


def _get_vllm_host() -> str:
    """Return the host address to probe for vLLM metrics.

    Verl starts vLLM with ``host=ray.util.get_node_ip_address()``, which is
    the machine's external/cluster IP (e.g. 172.18.x.x), **not** 127.0.0.1.
    Probing 127.0.0.1 therefore always fails.  We ask Ray for the same IP it
    would give to the vLLM process so the two agree.
    """
    try:
        import ray
        ip = ray.util.get_node_ip_address()
        if ip:
            return ip.strip("[]")
    except Exception:
        pass
    return "127.0.0.1"


def _vllm_raw_metrics(port: int, host: str = "127.0.0.1", timeout: float = 2.0) -> dict[str, float] | None:
    """Fetch raw Prometheus metrics from a local vLLM instance.

    Metrics with multiple label variants (e.g. ``request_success_total``
    with different ``finished_reason``) are summed into a single value.
    """
    try:
        with urllib.request.urlopen(f"http://{host}:{port}/metrics", timeout=timeout) as resp:
            text = resp.read().decode("utf-8")
    except Exception:
        return None
    m: dict[str, float] = {}
    for line in text.split("\n"):
        if line.startswith("#") or not line.strip():
            continue
        match = re.match(r'^(\S+?)(?:\{[^}]*\})?\s+(\S+)', line)
        if match:
            key = match.group(1)
            try:
                val = float(match.group(2))
            except ValueError:
                continue
            m[key] = m.get(key, 0) + val
    return m or None


_VLLM_CSV_COLUMNS = [
    "running", "waiting", "kv_cache_pct",
    "prompt_tps", "gen_tps", "req_per_s",
    "avg_e2e_s", "avg_ttft_s", "avg_queue_s",
    "prefix_hit_pct",
    "prompt_tokens_total", "gen_tokens_total", "requests_total",
]


def _vllm_computed(
    raw: dict[str, float],
    prev: dict[str, float] | None,
    dt: float,
) -> dict[str, float]:
    """Derive CSV-ready vLLM metrics from raw Prometheus counters/gauges.

    Gauges are used directly; counters are differenced against *prev* over *dt*
    seconds to produce per-second rates or interval averages.
    """
    def _rate(key: str) -> float:
        if not prev or dt <= 0:
            return 0.0
        return max(0.0, (raw.get(key, 0) - prev.get(key, 0)) / dt)

    def _interval_avg(sum_key: str, count_key: str) -> float:
        if not prev or dt <= 0:
            return 0.0
        ds = raw.get(sum_key, 0) - prev.get(sum_key, 0)
        dc = raw.get(count_key, 0) - prev.get(count_key, 0)
        return ds / dc if dc > 0 else 0.0

    dh = (raw.get("vllm:prefix_cache_hits_total", 0) -
          prev.get("vllm:prefix_cache_hits_total", 0)) if prev else 0
    dq = (raw.get("vllm:prefix_cache_queries_total", 0) -
          prev.get("vllm:prefix_cache_queries_total", 0)) if prev else 0

    return {
        "running":         raw.get("vllm:num_requests_running", 0),
        "waiting":         raw.get("vllm:num_requests_waiting", 0),
        "kv_cache_pct":    raw.get("vllm:kv_cache_usage_perc", 0) * 100,
        "prompt_tps":      _rate("vllm:prompt_tokens_total"),
        "gen_tps":         _rate("vllm:generation_tokens_total"),
        "req_per_s":       _rate("vllm:request_success_total"),
        "avg_e2e_s":       _interval_avg("vllm:e2e_request_latency_seconds_sum",
                                         "vllm:e2e_request_latency_seconds_count"),
        "avg_ttft_s":      _interval_avg("vllm:time_to_first_token_seconds_sum",
                                         "vllm:time_to_first_token_seconds_count"),
        "avg_queue_s":     _interval_avg("vllm:request_queue_time_seconds_sum",
                                         "vllm:request_queue_time_seconds_count"),
        "prefix_hit_pct":  (dh / dq * 100) if dq > 0 else 0.0,
        "prompt_tokens_total": raw.get("vllm:prompt_tokens_total", 0),
        "gen_tokens_total":    raw.get("vllm:generation_tokens_total", 0),
        "requests_total":      raw.get("vllm:request_success_total", 0),
    }


# ────────────────────── vLLM port discovery ──────────────────────


def _listening_ports() -> set[int]:
    """Return all TCP ports in LISTEN state from /proc/net/tcp{,6}."""
    ports: set[int] = set()
    for path in ("/proc/net/tcp", "/proc/net/tcp6"):
        try:
            with open(path) as f:
                next(f)  # skip header
                for line in f:
                    parts = line.split()
                    if len(parts) >= 4 and parts[3] == "0A":  # LISTEN
                        hex_port = parts[1].split(":")[1]
                        ports.add(int(hex_port, 16))
        except OSError:
            pass
    return ports


def _discover_vllm_ports(host: str = "127.0.0.1", timeout: float = 0.5) -> list[int]:
    """Auto-discover local vLLM server ports by probing /metrics endpoints."""
    from concurrent.futures import ThreadPoolExecutor

    candidates = sorted(p for p in _listening_ports() if p > 10000)
    if not candidates:
        return []

    def _probe(port: int) -> int | None:
        raw = _vllm_raw_metrics(port, host=host, timeout=timeout)
        return port if raw and "vllm:num_requests_running" in raw else None

    found: list[int] = []
    with ThreadPoolExecutor(max_workers=min(32, len(candidates))) as pool:
        for result in pool.map(_probe, candidates):
            if result is not None:
                found.append(result)
    return sorted(found)


def _fetch_all_vllm(ports: list[int], host: str = "127.0.0.1", timeout: float = 2.0) -> dict[int, dict[str, float]]:
    """Fetch raw Prometheus metrics from each vLLM server. Returns {port: raw}."""
    result: dict[int, dict[str, float]] = {}
    for port in ports:
        raw = _vllm_raw_metrics(port, host=host, timeout=timeout)
        if raw:
            result[port] = raw
    return result


def _aggregate_vllm_raw(per_server: dict[int, dict[str, float]]) -> dict[str, float] | None:
    """Aggregate raw metrics from multiple vLLM servers."""
    raws = list(per_server.values())
    if not raws:
        return None
    if len(raws) == 1:
        return raws[0].copy()
    merged: dict[str, float] = {}
    for raw in raws:
        for k, v in raw.items():
            merged[k] = merged.get(k, 0) + v
    n = len(raws)
    for k in merged:
        if "usage_perc" in k or "cache_usage" in k:
            merged[k] /= n
    return merged


# ────────────────────── Bench progress ──────────────────────


def _bench_episodes(run_dir: Path) -> int:
    p = run_dir / "results.jsonl"
    if not p.exists():
        return 0
    try:
        with open(p) as f:
            return sum(1 for _ in f)
    except OSError:
        return 0


# ────────────────────── Collect row ──────────────────────


def collect_row(
    *,
    vllm_data: Optional[dict[str, float]] = None,
    has_vllm: bool = False,
    run_dir: Optional[Path] = None,
    gpu_count: int = 0,
) -> dict[str, Any]:
    """Collect a single flat dict of all metrics.

    All columns are always present (defaulting to 0) so the CSV header
    established on the first sample is never missing later-arriving fields.

    vLLM metrics are passed in pre-computed via *vllm_data* (produced by
    ``_vllm_computed``).  The *has_vllm* flag ensures columns appear even
    when the first fetch fails.
    """
    row: dict[str, Any] = {"timestamp": datetime.now().isoformat()}

    mem = _memory()
    load1, load5, _ = _load_avg()
    row.update(load1=load1, load5=load5, mem_used_gb=round(mem["used"], 2), mem_pct=round(mem["pct"], 1))

    groups = _process_groups()
    for name in _PROCESS_GROUPS:
        g = groups.get(name, {"count": 0, "rss_mb": 0})
        row[f"proc_{name}_count"] = g["count"]
        row[f"proc_{name}_rss_mb"] = round(g["rss_mb"], 1)

    tcp = _tcp_stats()
    row["tcp_established"] = tcp.get("ESTABLISHED", 0)
    row["tcp_time_wait"] = tcp.get("TIME_WAIT", 0)
    row["tcp_close_wait"] = tcp.get("CLOSE_WAIT", 0)

    for i in range(gpu_count):
        row[f"gpu{i}_util"] = 0.0
        row[f"gpu{i}_mem_used_mb"] = 0.0
        row[f"gpu{i}_temp"] = 0.0
        row[f"gpu{i}_procs"] = ""
    gpus = _gpu_stats()
    if gpus:
        for g in gpus:
            i = g["idx"]
            row[f"gpu{i}_util"] = g["util"]
            row[f"gpu{i}_mem_used_mb"] = g["mem_used_mb"]
            row[f"gpu{i}_temp"] = g["temp_c"]
    gpu_procs = _gpu_processes()
    for i, procs in gpu_procs.items():
        row[f"gpu{i}_procs"] = procs

    if has_vllm:
        for col in _VLLM_CSV_COLUMNS:
            row[f"vllm_{col}"] = 0.0
        if vllm_data:
            for k, v in vllm_data.items():
                row[f"vllm_{k}"] = round(v, 2) if isinstance(v, float) else v

    if run_dir is not None:
        row["bench_episodes"] = _bench_episodes(run_dir)

    return row


# ────────────────────── vLLM summary ──────────────────────

_VLLM_SUMMARY_COUNTERS = [
    ("vllm:prompt_tokens_total",                  "Prompt tokens"),
    ("vllm:generation_tokens_total",              "Generation tokens"),
    ("vllm:request_success_total",                "Requests completed"),
    ("vllm:prefix_cache_hits_total",              "Prefix cache hits (tokens)"),
    ("vllm:prefix_cache_queries_total",           "Prefix cache queries (tokens)"),
    ("vllm:e2e_request_latency_seconds_sum",      "Total e2e latency (s)"),
    ("vllm:time_to_first_token_seconds_sum",      "Total TTFT (s)"),
    ("vllm:request_queue_time_seconds_sum",       "Total queue time (s)"),
]


def _log_vllm_summary(
    first: dict[str, float] | None,
    last: dict[str, float] | None,
) -> None:
    """Log a human-readable summary of vLLM usage during this run."""
    if not first or not last:
        return
    lines = ["vLLM usage during this run:"]
    for key, label in _VLLM_SUMMARY_COUNTERS:
        delta = last.get(key, 0) - first.get(key, 0)
        if delta >= 1_000_000:
            lines.append(f"  {label}: {delta:,.0f} ({delta/1e6:.2f}M)")
        elif delta >= 1000:
            lines.append(f"  {label}: {delta:,.0f} ({delta/1e3:.1f}K)")
        else:
            lines.append(f"  {label}: {delta:,.1f}")

    d_reqs = last.get("vllm:request_success_total", 0) - first.get("vllm:request_success_total", 0)
    d_prompt = last.get("vllm:prompt_tokens_total", 0) - first.get("vllm:prompt_tokens_total", 0)
    d_gen = last.get("vllm:generation_tokens_total", 0) - first.get("vllm:generation_tokens_total", 0)
    d_e2e_sum = last.get("vllm:e2e_request_latency_seconds_sum", 0) - first.get("vllm:e2e_request_latency_seconds_sum", 0)
    d_ttft_sum = last.get("vllm:time_to_first_token_seconds_sum", 0) - first.get("vllm:time_to_first_token_seconds_sum", 0)
    d_hits = last.get("vllm:prefix_cache_hits_total", 0) - first.get("vllm:prefix_cache_hits_total", 0)
    d_queries = last.get("vllm:prefix_cache_queries_total", 0) - first.get("vllm:prefix_cache_queries_total", 0)

    if d_reqs > 0:
        lines.append(f"  Avg prompt tokens/req: {d_prompt / d_reqs:,.0f}")
        lines.append(f"  Avg gen tokens/req: {d_gen / d_reqs:,.0f}")
        lines.append(f"  Avg e2e latency: {d_e2e_sum / d_reqs:.2f}s")
        lines.append(f"  Avg TTFT: {d_ttft_sum / d_reqs:.3f}s")
    if d_queries > 0:
        lines.append(f"  Prefix cache hit rate: {d_hits / d_queries * 100:.1f}%")

    logger.info("\n".join(lines))


# ────────────────────── Async loop ──────────────────────


async def monitor_loop(
    *,
    run_dir: Optional[Path] = None,
    vllm_port: Optional[int] = None,
    vllm_host: Optional[str] = None,
    auto_discover_vllm: bool = False,
    interval: float = 10.0,
) -> None:
    """Periodic monitor coroutine. Writes CSV to ``run_dir/monitor.csv``.

    Designed to be run via ``asyncio.create_task`` and cancelled when done.

    For vLLM counter-based metrics (token throughput, latency averages),
    the loop maintains previous-sample state and computes per-interval rates.

    When *auto_discover_vllm* is True, vLLM server ports are discovered
    automatically by probing ``/metrics`` endpoints on all listening TCP ports.

    *vllm_host* sets the host to probe for vLLM metrics.  Defaults to ``None``,
    which resolves to ``ray.util.get_node_ip_address()`` if Ray is available,
    falling back to ``127.0.0.1``.  Pass an explicit IP when Ray is not running
    in the same process, or to override the auto-detected value.
    """
    csv_path = run_dir / "monitor.csv" if run_dir else Path("monitor.csv")
    writer: csv.DictWriter | None = None

    gpus = _gpu_stats()
    gpu_count = len(gpus) if gpus else 0

    # Resolve the host once — verl binds vLLM to the Ray node IP, not 127.0.0.1
    host: str = vllm_host if vllm_host is not None else _get_vllm_host()

    vllm_ports: list[int] = [vllm_port] if vllm_port else []
    has_vllm = bool(vllm_ports) or auto_discover_vllm
    _last_discover: float = 0.0
    _REDISCOVER_INTERVAL = 300.0  # re-scan every 5 minutes

    logger.info(f"Monitor: writing to {csv_path} (interval={interval}s, gpus={gpu_count}"
                f"{f', vllm=:{vllm_port}' if vllm_port else ''}"
                f"{', vllm=auto-discover' if auto_discover_vllm else ''}"
                f", vllm_host={host})")

    first_vllm_raw: dict[str, float] | None = None
    prev_vllm_raw: dict[str, float] | None = None
    prev_vllm_ts: float | None = None
    prev_per_server: dict[int, dict[str, float]] = {}
    prev_per_server_ts: dict[int, float] = {}

    try:
        with open(csv_path, "w", newline="") as f:
            while True:
                # Auto-discover vLLM ports when needed
                if auto_discover_vllm:
                    now_mono = _time.monotonic()
                    # Retry every tick when no ports found yet; otherwise use the long interval
                    need_discover = (
                        not vllm_ports
                        or now_mono - _last_discover > _REDISCOVER_INTERVAL
                    )
                    if need_discover:
                        discovered = await asyncio.to_thread(_discover_vllm_ports, host)
                        if discovered:
                            _last_discover = now_mono
                            if discovered != vllm_ports:
                                vllm_ports = discovered
                                has_vllm = True
                                logger.info(f"Monitor: discovered vLLM on ports {vllm_ports} (host={host})")
                        # If discovery failed but we already have ports, keep them
                        # (servers may be sleeping — ports don't change)

                vllm_data: dict[str, float] | None = None
                per_server_data: dict[int, dict[str, float]] = {}
                if vllm_ports:
                    now = _time.monotonic()
                    per_server_raw = await asyncio.to_thread(_fetch_all_vllm, vllm_ports, host)
                    # Aggregate across all servers
                    raw = _aggregate_vllm_raw(per_server_raw)
                    if raw:
                        dt = (now - prev_vllm_ts) if prev_vllm_ts is not None else 0.0
                        vllm_data = _vllm_computed(raw, prev_vllm_raw, dt)
                        if first_vllm_raw is None:
                            first_vllm_raw = raw
                        prev_vllm_raw = raw
                        prev_vllm_ts = now
                    # Per-server derived metrics
                    for port, srv_raw in per_server_raw.items():
                        prev_s = prev_per_server.get(port)
                        prev_s_ts = prev_per_server_ts.get(port)
                        dt_s = (now - prev_s_ts) if prev_s_ts is not None else 0.0
                        per_server_data[port] = _vllm_computed(srv_raw, prev_s, dt_s)
                        prev_per_server[port] = srv_raw
                        prev_per_server_ts[port] = now

                row = await asyncio.to_thread(
                    collect_row,
                    vllm_data=vllm_data,
                    has_vllm=has_vllm,
                    run_dir=run_dir,
                    gpu_count=gpu_count,
                )
                if has_vllm:
                    row["vllm_n_servers"] = len(per_server_data)
                # Per-server columns: vllm_s0_running, vllm_s1_kv_cache_pct, ...
                for idx, port in enumerate(vllm_ports):
                    data = per_server_data.get(port)
                    for col in _VLLM_CSV_COLUMNS:
                        key = f"vllm_s{idx}_{col}"
                        row[key] = round(data[col], 2) if data and col in data else 0.0
                if writer is None:
                    writer = csv.DictWriter(f, fieldnames=list(row.keys()), extrasaction="ignore")
                    writer.writeheader()
                writer.writerow(row)
                f.flush()
                await asyncio.sleep(interval)
    except asyncio.CancelledError:
        _log_vllm_summary(first_vllm_raw, prev_vllm_raw)
        logger.info(f"Monitor stopped ({csv_path})")
    except Exception as e:
        logger.warning(f"Monitor error: {e}")
