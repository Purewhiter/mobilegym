# Platform Reference

Deep-dive reference for the MobileGym platform itself — useful when you're extending the simulator, adding a new system service, or debugging behavior that the [tutorials](../guides/) leave unexplained. Most casual users won't need any of this.

If you just want to run a benchmark or train an agent, start with [getting-started.md](../getting-started.md) and [architecture.md](architecture.md). Come here when those say "see `platform/<X>` for details."

## What's in this directory

| Directory | Owns |
|---|---|
| [`app/`](app/) | App module contract, resources, UI shell, data layering. |
| [`navigation/`](navigation/) | Declarations, actions, data sources, graph generation, runtime state. |
| [`os/`](os/) | Simulated Android host, Task lifecycle, Intents, cross-app launch, services. |
| [`state/`](state/) | Snapshot model, OS state, app state, benchmark snapshots. |
| [`tooling/`](tooling/) | Build flow, Vite plugins, i18n, WMR, generated artifacts. |

### Core platform

| Topic | Read |
|---|---|
| The simulated Android OS — TaskManager, BackDispatcher, lifecycle | [`os/overview.md`](os/overview.md) |
| Architecture overview — how OS, apps, and bench_env fit together | [`architecture.md`](architecture.md) |
| How an app integrates with the OS — manifest, entry component, registration, conventions | [`app/module-contract.md`](app/module-contract.md) |
| App resources — icons, colors, strings, dimensions | [`app/resources.md`](app/resources.md) |
| App UI shell — status/nav bars, keyboard resize, pointer events | [`app/ui-shell.md`](app/ui-shell.md) |
| App data layering — constants, defaults, world data, runtime overlay | [`app/data-layering.md`](app/data-layering.md) |
| The layered state model that powers JSON snapshots and deterministic judging | [`state/model.md`](state/model.md) |
| OS state — settings, hardware, providers, managers | [`state/os-state.md`](state/os-state.md) |
| App state — runtime overlay and store rules | [`state/app-state.md`](state/app-state.md) |
| Bench snapshots — reset, inject, clone, diff rules | [`state/bench-snapshots.md`](state/bench-snapshots.md) |
| OS services apps consume — NetworkService, SMS, Time, Location, Clipboard, etc. | [`os/services/`](os/services/) |
| Cross-app calls — Intent filters, launch modes, returning results | [`os/intent-system.md`](os/intent-system.md) |
| Cross-app Task/back-stack traces — `newTask`, `openApp`, `launchedByTaskId` | [`os/cross-app-launch.md`](os/cross-app-launch.md) |
| Task lifecycle — Activity stack, Back fallback, Recents persistence | [`os/task-lifecycle.md`](os/task-lifecycle.md) |

### Navigation and tasks

| Topic | Read |
|---|---|
| Navigation: route tables, jumps, URL UI states, DOM tags, exploring an app's graph | [`navigation/routes.md`](navigation/routes.md) |
| Actions: action ids and DOM action binding | [`navigation/actions.md`](navigation/actions.md) |
| Navigation runtime state: MemoryRouter, URL state, foreign-task isolation | [`navigation/runtime-state.md`](navigation/runtime-state.md) |

### Input, tooling, and mapping

| Topic | Read |
|---|---|
| Keyboard, IME, pointer events, and `adjustResize` layout behavior | [`os/services/input-keyboard.md`](os/services/input-keyboard.md) |
| Display and font scaling — system zoom, `fontSizePct`, `designViewportWidth` | [`os/services/display-scaling.md`](os/services/display-scaling.md) |
| Vite plugins, app assets, CDN, WMR, i18n, generated artifacts, validation commands | [`tooling/build.md`](tooling/build.md) |
| Generated artifacts — nav graphs, action tasks, app state schema, IME dictionary | [`tooling/generated-artifacts.md`](tooling/generated-artifacts.md) |
| Vite plugin/discovery lookup | [`tooling/vite-plugins.md`](tooling/vite-plugins.md) |
| i18n tooling | [`tooling/i18n.md`](tooling/i18n.md) |
| WMR tooling | [`tooling/wmr.md`](tooling/wmr.md) |
| How simulator concepts map to AOSP / a real Android device | [`android-mapping.md`](android-mapping.md) |

## Companion reference

- 🔌 Browser-side debug & automation APIs (`__SIM__`, `__OS__`, …) → [`../api/runtime-api.md`](../api/runtime-api.md)
- 🧪 Tasks, judging, and runner internals → [`../../bench_env/docs/`](../../bench_env/docs/)

## Conventions used in these docs

- **Code fences** show real, in-repo file paths and identifiers — what you see is what `grep` will find.
- **Tables** are the load-bearing format. We avoid prose for things that are really just enumerations.
- **`(internal)` tags** mark behavior used only by the framework itself; you shouldn't need it when building apps.
- These docs are written against the **current** main branch. If something here disagrees with the code, file an issue — the code wins.
