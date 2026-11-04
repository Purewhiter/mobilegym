# Architecture

This document is the high-level overview of how MobileGym is put together. For the formal rules and contracts behind each layer, follow the links in this `platform/` directory.

The [README figure](../../assets/arch.png) shows the simulator's capabilities and how its data composes. The diagram below shows where the components run and how they communicate.

## Runtime components

MobileGym uses one Vite project for the browser simulator and a Node device server. The Python benchmark harness drives the browser and can query the device server during setup and judging.

```
bench_env/ (Python)
  ├─ Playwright ──> Browser simulator
  │                 ├─ apps/ and system/   React pages, routes, store mirrors
  │                 ├─ os/                tasks, intents, settings, providers
  │                 └─ os/device/ ── HTTP /__device ──┐
  └─ DeviceView ────── HTTP /__device ─────────────────┤
                                                       v
                                               device/ (Node)
                                               shared catalogs, per-device
                                               state, filesystem and blobs
```

The harness uses `__SIM__` and the browser's other runtime APIs for setup, input, and snapshots. Model agents consume screenshots and emit actions.

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

> 📐 The OS layer guarantees that browser refresh = device reboot for *runtime* UI/session state, but persistent data (settings, providers, preferences) survives. This split is enforced via two store factories — `createOsStore` (persisted) and `createVolatileOsStore` (in-memory). See [`os/overview.md`](os/overview.md).

## Apps layer (`apps/`, `system/`)

Daily apps (WeChat, Alipay, etc.) live in `apps/`; system apps (Settings, Contacts, AnswerSheet, etc.) live in `system/`. They share the same module contract.

A minimal app is three files, automatically discovered by the OS via `import.meta.glob`:

```
apps/MyApp/
├── manifest.ts                 # id, displayName, icon, theme, intentFilters
├── MyAppApp.tsx                # entry component (MemoryRouter + useAppNavigationHandler)
└── routes.ts                   # route table: pages + URL UI states
```

Most apps add a few more standard files — `res/`, `data/`, `pages/`, `state.ts`, etc. The full contract is in [`app/module-contract.md`](app/module-contract.md), and the layered state rules are in [`state/model.md`](state/model.md).

### The layered app data model

This is the trick that makes deterministic judging cheap. Each app separates its data into two layers:

1. **World data** — large, mostly read-only public entities (posts, products, stations, places). Lives outside snapshots.
2. **Runtime overlay** — small, mutable per-environment state (current user, settings, drafts, likes, sent messages, per-entity overrides on world data).

Catalog-backed app modules merge the two on the device server, with runtime changes taking precedence. Snapshots carry the app's runtime state and the OS state. Shared catalog records stay outside the snapshot.

See the architecture figure on the README or [`state/model.md`](state/model.md) for details.

### Navigation

Each app keeps a route table (`routes.ts`): its pages and the discrete UI states each keeps in its URL. Jumps are typed code against it (`bindNav(routes.x, ...)`, `nav.push / replace / back` from `os/navigation`), and every bound control is tagged in the DOM. There is no static transition graph: `scripts/explore_nav_graph.py` builds the graph from a running simulator by tapping every tagged control.

See [`navigation/routes.md`](navigation/routes.md).

## Device server (`device/`)

The server holds each simulated phone's app state and filesystem in a device session. Catalogs are loaded once per Node process and shared across sessions. Catalog-backed apps issue commands and queries through `DeviceClient`. Apps using `syncSetState` update their browser stores synchronously and save the changed state to the session.

The browser keeps its session across reloads in the same tab. An episode reset starts a fresh session and detaches requests from the previous one. Vite mounts `/__device` in dev and preview. The nginx gateway routes a session's requests to the Node shard that owns it. See [`state/device-server.md`](state/device-server.md).

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

State-mode judges can query merged catalog and runtime records through `DeviceView`. It imports the initial or final app snapshot into a scratch session on the selected device server and uses the same queries as the app. State scoring uses no VLM API calls. VLM judging is available for real-device runs, explicit `--judge-mode vlm`, or auto mode with a configured judge model.

### Agents

Agents are adapters that translate between the standard `Action` abstraction and a particular model's prompt and parsing schema. Every adapter subclasses `BaseAgent` in `bench_env/agent/base.py` and implements:

- `build_messages(obs) -> list[dict]` — prompt construction
- `parse_response(text) -> Action` — output parsing

The Playwright executor receives coordinates normalized to `[0, 1000]` so adapters don't need to know the device's physical pixel size.

For the complete agent contract, see [../guides/add-an-agent.md](../guides/add-an-agent.md).

## How a snapshot works

Before taking the final snapshot, the benchmark waits for device writes to be acknowledged. `__SIM__.getState()` reads the browser's state mirrors and returns a JSON object with the following shape.

```jsonc
{
  "os": {
    "settings": { "global": {…}, "system": {…}, "secure": {…} },
    "hardware": { "battery": {…}, "wifi": {…}, … },
    "permissions": {…},
    "preferences": {…},
    "build": {…},
    "telephony": {…},
    "providers": { "contacts": {…}, "sms": {…}, … },
    "clipboard": {…},
    "notifications": {…},
    "shade": {…},
    "services": {…},
    "fileSystem": {…}
  },
  "apps": {
    "wechat":   {…},   // each app's runtime overlay
    "alipay":   {…},
    // …
  }
}
```

The snapshot is the source of runtime state for the judge. Catalog-backed judges combine it with shared catalog data through the device server. The full `__SIM__.getState()` schema is in [../api/app-state-schema.md](../api/app-state-schema.md).

## Where to go next

- 🚀 Run something end-to-end → [../getting-started.md](../getting-started.md)
- 📱 Add a new app → [../guides/add-an-app.md](../guides/add-an-app.md)
- 🧪 Write a new task → [../guides/add-a-task.md](../guides/add-a-task.md)
- 🔌 Look up the browser-side debug API → [../api/runtime-api.md](../api/runtime-api.md)
