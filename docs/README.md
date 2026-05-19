# MobileGym Documentation

Welcome. This index points you at the right doc for what you're trying to do. The repository [`README.md`](../README.md) is the project overview — these docs go deeper.

All docs here are in English. Pick a track:

## Where to start

| If you want to… | Read this |
|---|---|
| 🚀 Install and run your first task | [`getting-started.md`](getting-started.md) |
| 🏗️ Understand how the layers fit together | [`architecture.md`](architecture.md) |
| 📱 Add a new app to the simulator | [`guides/add-an-app.md`](guides/add-an-app.md) |
| 🧪 Add a new task and judge | [`guides/add-a-task.md`](guides/add-a-task.md) |
| 🤖 Plug in a new agent (model adapter) | [`guides/add-an-agent.md`](guides/add-an-agent.md) |
| 🌉 Reproduce the paper's Sim-to-Real experiment | [`guides/reproduce-paper.md`](guides/reproduce-paper.md) |
| 📊 Submit a model to the leaderboard | [`leaderboard.md`](leaderboard.md) |
| 🔌 Look up the browser-console debug API | [`api/runtime-api.md`](api/runtime-api.md) |
| 🤝 Contribute code or report a bug | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |

## Platform deep dive

For implementation-level rules and contracts — when you're extending the simulator itself, debugging unusual behavior, or building a new app whose needs aren't covered by the tutorial. See [`platform/README.md`](platform/README.md) for the orientation.

| Topic | Spec |
|---|---|
| OS internals — TaskManager, BackDispatcher, IntentResolver, lifecycle | [`platform/os-layer.md`](platform/os-layer.md) |
| App module contract — how apps integrate, file conventions, runtime hooks | [`platform/app-module-contract.md`](platform/app-module-contract.md) |
| State model — layered runtime/world data, snapshots, diffs, side effects | [`platform/state-model.md`](platform/state-model.md) |
| Declarative navigation — FSM, transitions, actions, graph generation | [`platform/declarative-navigation.md`](platform/declarative-navigation.md) |
| Intent system — cross-app calls, launchMode, choosers | [`platform/intent-system.md`](platform/intent-system.md) |
| OS services — Time, Location, Network, SMS, Display, Clipboard, etc. | [`platform/os-services.md`](platform/os-services.md) |
| Android mapping — which AOSP concepts we model, which we simplify | [`platform/android-mapping.md`](platform/android-mapping.md) |

## Benchmark / task authoring

Pair `bench_env/` and its docs when authoring tasks:

| Doc | Read for |
|---|---|
| [`../bench_env/docs/task/IMPLEMENTATION.md`](../bench_env/docs/task/IMPLEMENTATION.md) | End-to-end implementation guide — base classes, CRUD recipes, app accessors, judge patterns |
| [`../bench_env/docs/task/CONVENTIONS.md`](../bench_env/docs/task/CONVENTIONS.md) | Authoring conventions — taxonomy, capability tags, parameters, criteria, side-effect rules |
| [`../bench_env/docs/REFERENCE.md`](../bench_env/docs/REFERENCE.md) | Formal field reference — `JudgeInput`/`JudgeResult` shapes, CLI flags, metadata vocab |
| [`../bench_env/docs/task/grounded-mode.md`](../bench_env/docs/task/grounded-mode.md) | The AnswerSheet / grounded-mode protocol |
| [`../bench_env/docs/task/TESTING.md`](../bench_env/docs/task/TESTING.md) | Offline test conventions (`OFFLINE_JUDGE_POSITIVE_CASES`, `NEGATIVE_CASES`, fixtures) |
| [`../bench_env/docs/FRAMEWORK.md`](../bench_env/docs/FRAMEWORK.md) | Runner lifecycle, Episode pipeline, sampling, parallel execution |
| [`../bench_env/docs/performance.md`](../bench_env/docs/performance.md) | bench_env performance pitfalls and tuning notes |

## Operational runbooks

[`runbooks/`](runbooks/) — symptom → diagnosis → fix recipes for known operational issues (currently `inotify` limits at high `--parallel`). Public-safe; internal infrastructure tuning is archived separately.

## Archive

[`archive/`](archive/) holds historical content that's no longer authoritative. Two sub-archives:

- [`archive/proposals-2026/`](archive/proposals-2026/) — design proposals drafted during 2026 development that were not integrated.
- [`archive/internal-2026/`](archive/internal-2026/) — maintainer-only operational notes (APK reverse-engineering toolchain, large-cluster vLLM tuning, theme-resource pulling). Preserved for historical reference; not part of the public docs path.

> ⚠️ **Files in `archive/` are not guaranteed to reflect current behavior** and may reference designs that were never built. Trust the active docs above when they disagree.

## Conventions used in these docs

- **Code paths and identifiers** are real — copy-paste them into `grep` and you'll find what's referenced.
- **Tables** are the load-bearing format. We avoid prose for things that are really enumerations.
- **`(advanced)` or **`(internal)`** tags mark sections most readers don't need.
- These docs are written against the **current main branch**. If a doc disagrees with the code, file an issue — the code wins.
