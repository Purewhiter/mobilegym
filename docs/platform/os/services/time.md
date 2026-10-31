# Time Service

Use `TimeService` for all app-visible and judge-relevant time.

| Need | API |
|---|---|
| Display current simulated time | `TimeService.now()` / `TimeService.getDate()` |
| Persist a judge-relevant timestamp | `TimeService.now()` |
| Measure real elapsed time for animation/debounce/cache TTL | `TimeService.realNow()` |
| Replace `new Date(timestamp)` | `TimeService.fromTimestamp(ts)` |
| Replace `new Date(year, monthIndex, day, ...)` | `TimeService.fromLocalParts(...)` — `monthIndex` is 0-based, matching JS `Date` |
| Parse date text | `TimeService.parseToTimestamp(str)` |

Do not use bare `Date.now()` or `new Date(...)` in runtime code. ESLint enforces this for `os/`, `apps/`, and `system/`.

Benchmarks can control simulated time through `__SIM_TIME__`; app code should not bypass it.

## Boot time

The page boots on `SIMULATOR_CONFIG.time` unless its URL carries `?simTime=` (epoch ms, or local time such as `2026-10-30 21:31:02`; add `simTimeFlowing=0` to freeze it). The time is set before any store or data file reads the clock, so relative data timestamps (`resolveDataTimestamp`) are anchored to it too. `__SIM_TIME__.getBootTime()` returns that anchor.

`bench_env` sets it per episode with `--sim-time`:

| `--sim-time` | Each episode boots at |
|---|---|
| `real` (default, except for replays) | the host clock |
| a time, e.g. `2026-01-04 20:00` | that time; the clock then runs at real speed |
| `replay` (default for `--agent replay`) | the time its recording booted at: `sim_boot_time` in the trajectory's `meta.json`, else the episode `start_time` in `results.jsonl` for recordings made before it was stored |

Samplers and judges read the simulated time from `os_state` (`bench_env/task/utils.py`: `now_ms`, `sim_today`), so date-dependent instructions follow the same clock.

See the service index for broader context: [README.md](README.md).
