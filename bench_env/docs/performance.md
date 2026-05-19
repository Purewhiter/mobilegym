# bench_env performance notes

Pitfalls and tuning notes for `python -m bench_env.run` performance — what's been characterized, what's been fixed, and what's still open. For the framework architecture itself see [`FRAMEWORK.md`](FRAMEWORK.md); for cluster-scale runbooks see [`../../docs/runbooks/`](../../docs/runbooks/).

---

## Confirmed issues and fixes

### 1. `waitForData` used to load *all* apps' data unconditionally

**Symptom.** `os/OSContext.tsx`'s `waitForData()` loaded the full RedBook (~16 MB JSON) and Bilibili (~65 MB JSON) datasets on every `reset()`, even when the current task only touched one of them.

**Numbers** (from `bench_env/diagnose_perf.py`):

| Scenario | `waitForData` wall time |
|---|---|
| Pre-fix (full preload) | 1.13 s |
| Post-fix (RedBook only) | 0.32 s |

After the fix, Bilibili's large-asset requests stop firing entirely.

**What changed.**

- `os/OSContext.tsx`: `waitForData(appIds?: string[])` accepts an optional allowlist; passing `undefined` preserves the legacy preload-everything behavior.
- `bench_env/env/mobile_gym.py`: `_wait_ready()` and `reset()` accept `app_ids: list[str] | None` and forward it to JS.
- `bench_env/task/base.py`: `setup()` derives the relevant `app_id` from the task's `app` field and calls `env.reset(app_ids=[app_id])`, skipping unrelated apps.

### 2. Playwright route interception was too wide

**Symptom.** The route handler matched `**/*`, including every Vite dev-server JS/CSS chunk (hundreds of requests in dev mode) and every CDN image (xhscdn, hdslb, etc.). Each match paid a CDP round-trip for `route.fetch()` + `route.fulfill()`.

**Why we intercept at all.** To strip `X-Frame-Options` and `Content-Security-Policy: frame-ancestors`, so:

1. The whole simulator can be iframed by an external parent page (bench harness, browser-eval UI).
2. The in-simulator Browser App's `<iframe>` can load external sites (Google, Baidu, GitHub).

Third-party CDN responses don't need these headers stripped; we can let them through untouched.

**What changed.** `bench_env/env/mobile_gym.py` `setup_context_routes()` now matches only:

1. `{env_url}/**` (i.e. `http://localhost:3000/**`).
2. `BROWSER_IFRAME_PATTERNS` — the curated external-site list used by the Browser App's bookmarks (kept in sync with `apps/Browser/BrowserApp.tsx`).

Everything else passes through Playwright without the Python detour.

### 3. Performance diagnostic script

`bench_env/diagnose_perf.py` measures load latency in phases:

1. Playwright context creation
2. `domcontentloaded`
3. `window.__SIM__` ready
4. `waitForData` complete
5. Target app open
6. First image painted

It also prints Performance API stats — request-count-by-type, mean times, slowest 10. Usage:

```bash
python -m bench_env.diagnose_perf --env-url http://localhost:3000 --app redbook
```

Caveat: `page.evaluate()` in Playwright Python does **not** accept a `timeout` kwarg (that's `wait_for_function()` only).

---

## Observed but not root-caused

### Desktop icon jank on app → home

**Symptom.** Pressing Home in Playwright produces brief desktop-icon jitter that doesn't reproduce in a real browser running the exact same code. Same React build, same OS code paths.

**What we know:** Playwright-only. No profiler trace yet.

**Status:** open. Needs a real profiler pass before drawing conclusions.

---

## Known overhead not yet addressed

### `_reset_sim` waits on `networkidle`

`bench_env/env/mobile_gym.py:_reset_sim()` awaits both `domcontentloaded` and `networkidle` after `__SIM__.reset()`. `networkidle` is "no network activity for 500 ms" — *including* in-flight CDN images.

This adds wall-clock latency on every reset. The size of the contribution is **unmeasured**; whether it's the current bottleneck is unknown. A targeted diagnostic run is the natural next step.

---

## Related runbooks

- [`docs/runbooks/bench-inotify-limit.md`](../../docs/runbooks/bench-inotify-limit.md) — first-reset stalls under high `--parallel` (root cause: inotify watch limits).
