# Architecture

This document is the high-level overview of how MobileGym is put together. For the formal rules and contracts behind each layer, follow the links into [`platform/`](platform/).

For the canonical figure (also shown in the [top-level README](../README.md)), see [`assets/arch.png`](../assets/arch.png).

## The three layers

MobileGym is a single Vite project — not a monorepo — with three layers stacked top to bottom:

```
┌────────────────────────────────────────────────────────────────────┐
│ 🧪 Benchmark layer    bench_env/    (Python · Playwright)          │
│    Tasks · judges · runners · agents · splits                      │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │  window.__SIM__ / __OS__
                                   │  __SIM_INPUT__ / __SIM_QUERY__
┌──────────────────────────────────┴─────────────────────────────────┐
│ 📱 Apps layer        apps/ , system/    (TS · React)               │
│    manifests · declarative navigation · per-app state stores       │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │  IntentResolver · BackDispatcher
                                   │  AppLifecycle · ContentProvider
┌──────────────────────────────────┴─────────────────────────────────┐
│ 🪟 OS layer          os/    (TS · React · Zustand)                 │
│    SystemShell · TaskManager · services · managers · providers     │
└────────────────────────────────────────────────────────────────────┘
```

Each layer talks to the one below it through a stable contract, and only the layer above. The agent never sees JavaScript — it only ever consumes screenshots and emits actions.

## OS layer (`os/`)

This is the simulated Android system. It hosts everything else.

| Module | Responsibility |
|---|---|
| `SystemShell.tsx` | Launcher, status bar, gesture handling, app rendering container. Backgrounded apps stay mounted (hidden via `display:none`) so their React state survives. |
| `TaskManager.ts` | Task & Activity stacks, modeled after AOSP. Volatile — refreshing the browser is a reboot. |
| `BackDispatcher.ts` | Priority-based back-key dispatch (PermissionDialog > Shade > Keyboard > App > Launcher). |
| `IntentResolver.ts` | Intent matching, chooser dialogs, `startActivityForResult`. |
| `AppNavigatorRegistry.ts` | Event-driven registration of app navigators so the OS can route `openApp(id, route)`. |
| `OsStateStore.ts` | Unified data model — settings (global/system/secure/app-specific), hardware (battery/wifi/sensors), permissions, preferences. Persisted to localStorage as `os_state`. |
| `managers/` | Write-side facades that wrap constraint logic (e.g. airplane-mode cascades wifi/bt/cellular off, brightness clamps to display range). |
| `providers/` | Shared content data (contacts, SMS, media). Apps read via `ContentResolver.query/insert/update/delete`. |
| Service singletons (`TimeService.ts`, `LocationService.ts`, `NetworkService.ts`, `ClipboardService.ts`, `NotificationService.ts`, …) | Sit at the top level of `os/`. Apps must use these instead of native browser APIs. |

> 📐 The OS layer guarantees that browser refresh = device reboot for *runtime* UI/session state, but persistent data (settings, providers, preferences) survives. This split is enforced via two store factories — `createOsStore` (persisted) and `createVolatileOsStore` (in-memory). See [`platform/os-layer.md`](platform/os-layer.md).

## Apps layer (`apps/`, `system/`)

Daily apps (WeChat, Alipay, etc.) live in `apps/`; system apps (Settings, Contacts, AnswerSheet, etc.) live in `system/`. They share the same module contract.

A minimal app is three files, automatically discovered by the OS via `import.meta.glob`:

```
apps/MyApp/
├── manifest.ts                 # id, displayName, icon, theme, intentFilters
├── MyAppApp.tsx                # entry component (MemoryRouter + useAppNavigationHandler)
└── navigation.declaration.ts   # routes + transitions + actions (the FSM)
```

Most apps add a few more standard files — `res/`, `data/`, `pages/`, `state.ts`, etc. The full contract is in [`platform/app-module-contract.md`](platform/app-module-contract.md), and the layered state rules are in [`platform/state-model.md`](platform/state-model.md).

### The layered app data model

This is the trick that makes deterministic judging cheap. Each app separates its data into two layers:

1. **World data** — large, mostly read-only public entities (posts, products, stations, places). Lives outside snapshots.
2. **Runtime overlay** — small, mutable per-environment state (current user, settings, drafts, likes, sent messages, per-entity overrides on world data).

App views compose the two at render time, with the runtime overlay taking precedence. **Only the runtime overlay is included in environment snapshots** that the benchmark compares for judging. This keeps snapshots tiny and stable while still capturing every agent-induced change.

See the architecture figure on the README or [`platform/state-model.md`](platform/state-model.md) for details.

### Declarative navigation

Every screen, transition, and discrete UI state is declared in `navigation.declaration.ts` as a finite-state machine. The same file drives:

- **Runtime navigation** via `navigation.ts`'s `go()` / `back()` helpers.
- **Static analysis** — consistency checks between code and declaration.
- **Graph generation** — BFS, shortest path, action enumeration via `scripts/build_nav_artifacts.mjs`.
- **Task authoring** — reachable trajectories surface candidate tasks.

See [`platform/declarative-navigation.md`](platform/declarative-navigation.md).

## Benchmark layer (`bench_env/`)

A Python framework that drives the simulator through Playwright, runs agents, and judges outcomes.

```
bench_env/
├── run.py                 # CLI entry point
├── agent/                 # Agent adapters (autoglm, uitars, venus, …)
├── task/                  # task templates, organized per-app
│   ├── base.py            # BaseTask, BaseApp
│   ├── common_tasks.py    # AnswerTask, CriteriaTask, build_answer_checks, …
│   ├── <app>/             # one directory per app
│   └── judge.py           # shared judge utilities
├── env/                   # Environment lifecycle, screenshot capture, action execution
├── runner/                # Serial / parallel / multi-process orchestration
├── splits/                # test / train / payment / high_risk lists
└── tests/                 # offline judge tests, regression suite
```

### Episode flow

```python
obs = await task.setup(env)           # reset env, open app, inject state, sample params
agent.reset(task.description)
while not done and steps < max_steps:
    action = agent.act(obs)            # → Action
    result = await env.step(action)    # Playwright executes; returns next obs
    obs, done = result.observation, result.done
judge = task.evaluate(JudgeInput(init_obs=init_obs, last_obs=last_obs))
```

### State-based programmatic judging

Each task ships a deterministic `check_goals(input) -> list[CheckResult]` method that inspects the structured `init` and `final` snapshots and returns one record per goal. AnswerSheet-typed tasks additionally provide `get_answer()` which produces the expected answer values. The base implementation in `bench_env/task/base.py` composes these into a final `JudgeResult` with success rate, progress rate, and side-effect flags.

> ⚖️ Judges are sub-millisecond and deterministic — no VLM API calls during scoring. The cost difference at RL-training scale is enormous (millions of judgments per training run).

### Agents

Agents are adapters that translate between the unified 16-action abstraction and a particular model's prompt and parsing schema. Every adapter subclasses `BaseAgent` in `bench_env/agent/base.py` and implements:

- `build_messages(obs) -> list[dict]` — prompt construction
- `parse_response(text) -> Action` — output parsing

The Playwright executor receives coordinates normalized to `[0, 1000]` so adapters don't need to know the device's physical pixel size.

For the complete agent contract, see [guides/add-an-agent.md](guides/add-an-agent.md).

## How a snapshot works

When the benchmark calls `__SIM__.getState()`, it gets back a single JSON object with this shape:

```jsonc
{
  "os": {
    "settings": { "global": {…}, "system": {…}, "secure": {…} },
    "hardware": { "battery": {…}, "wifi": {…}, … },
    "permissions": {…},
    "preferences": {…},
    "providers": { "contacts": {…}, "sms": {…}, … },
    "services": { "clipboard": {…} }
  },
  "apps": {
    "wechat":   {…},   // each app's runtime overlay
    "alipay":   {…},
    // …
  }
}
```

This is the **only** state the benchmark trusts for judging. The schema for each app is auto-generated and lives at [os-services/APP_STATE_API.md](os-services/APP_STATE_API.md).

## Where to go next

- 🚀 Run something end-to-end → [getting-started.md](getting-started.md)
- 📱 Add a new app → [guides/add-an-app.md](guides/add-an-app.md)
- 🧪 Write a new task → [guides/add-a-task.md](guides/add-a-task.md)
- 🔌 Look up the browser-side debug API → [api/runtime-api.md](api/runtime-api.md)
