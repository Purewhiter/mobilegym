# State Platform Docs

Use these docs when changing simulator snapshots, app state layering, providers, settings, or benchmark-facing state.

| Need | Read |
|---|---|
| Layered state model, app runtime overlays, world data, snapshots, bench diffs | [`model.md`](model.md) |
| OS settings, hardware, providers, managers | [`os-state.md`](os-state.md) |
| App runtime overlay and store rules | [`app-state.md`](app-state.md) |
| Device server: where app state lives, store kinds, migration rules | [`device-server.md`](device-server.md) |
| Bench-facing snapshots, reset/inject/clone, diff rules | [`bench-snapshots.md`](bench-snapshots.md) |
| Generated live `__SIM__.getState()` schema | [`../../api/app-state-schema.md`](../../api/app-state-schema.md) |
| OS managers and providers overview | [`../os/overview.md`](../os/overview.md) |

For task authoring, pair this with `bench_env/docs/task/TASK_AUTHORING_GUIDE.md` and `bench_env/docs/task/TASK_CODE_SPEC.md`.
