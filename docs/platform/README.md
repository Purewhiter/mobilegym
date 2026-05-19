# Platform Reference

Deep-dive reference for the MobileGym platform itself — useful when you're extending the simulator, adding a new system service, or debugging behavior that the [tutorials](../guides/) leave unexplained. Most casual users won't need any of this.

If you just want to run a benchmark or train an agent, start with [getting-started.md](../getting-started.md) and [architecture.md](../architecture.md). Come here when those say "see `platform/<X>` for details."

## What's in this directory

| Topic | Read |
|---|---|
| The simulated Android OS — TaskManager, BackDispatcher, IntentResolver, lifecycle | [`os-layer.md`](os-layer.md) |
| How an app integrates with the OS — manifest, entry component, registration, conventions | [`app-module-contract.md`](app-module-contract.md) |
| The layered state model that powers JSON snapshots and deterministic judging | [`state-model.md`](state-model.md) |
| Declarative navigation: routes, transitions, actions, conditions, graph generation | [`declarative-navigation.md`](declarative-navigation.md) |
| Cross-app calls — Intent filters, launch modes, returning results | [`intent-system.md`](intent-system.md) |
| OS services apps consume — NetworkService, SMS, Time, Location, display scaling | [`os-services.md`](os-services.md) |
| How simulator concepts map to AOSP / a real Android device | [`android-mapping.md`](android-mapping.md) |

## Companion reference

- 🔌 Browser-side debug & automation APIs (`__SIM__`, `__OS__`, …) → [`../api/runtime-api.md`](../api/runtime-api.md)
- 🧪 Tasks, judging, and runner internals → [`../../bench_env/docs/`](../../bench_env/docs/)

## Conventions used in these docs

- **Code fences** show real, in-repo file paths and identifiers — what you see is what `grep` will find.
- **Tables** are the load-bearing format. We avoid prose for things that are really just enumerations.
- **`(internal)` tags** mark behavior used only by the framework itself; you shouldn't need it when building apps.
- These docs are written against the **current** main branch. If something here disagrees with the code, file an issue — the code wins.
