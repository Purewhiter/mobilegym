# 2026 Design Proposals

Forward-looking design documents drafted during 2026 development. **None of these have been fully implemented in the released platform.** They are kept here because they capture motivation, alternatives considered, and edge cases that may be useful when revisiting these areas.

If a proposal here conflicts with the current behavior described in [`../../specs/`](../../specs/) or [`../../arch/`](../../arch/), trust the current docs — those are what shipped.

## Index

| File | Topic |
| :--- | :--- |
| `IDB_SNAPSHOT_RESTORE.md` | IndexedDB-based snapshot/restore for faster bench resets |
| `CONTENT_DATA_SEPARATION_PROPOSAL.md` | Decoupling large content payloads from per-environment runtime state |
| `FALSE_POSITIVE_ANALYSIS.md` | Audit of false-positive patterns in judges across the task suite |
| `INSTALL_APP_ANALYSIS.md` | Analysis of supporting in-simulator app installation |
| `SIM2REAL_METHODOLOGY.md` / `SIM2REAL_METHODOLOGY_TEST1.md` | Detailed Sim-to-Real task-selection methodology |
| `UI_Replication_Guide_CN.md` | An earlier Chinese-language UI replication guide (largely superseded by `docs/app-dev/agent_replication_workflow.md`) |
| `bench-multiprocess-runner.md` | Proposed redesign of the multi-process bench runner |
| `bench-reset-via-page-lifecycle.md` | Alternative reset strategy using the page lifecycle API |
| `bottom-chrome-unified-protocol.md` | Unification of bottom-chrome (keyboard / gesture bar) behavior |
| `navigation-codegen-plan.md` | Code generation from navigation declarations |
| `redbook-entities-reload-consistency.md` | Cross-entity consistency on RedBook reload |
| `store_auto_crud_v2.md` | Auto-generated CRUD for app stores (v2) |
| `timeservice_device_timezone.md` | Device timezone semantics for `TimeService` |
| `unified-pager-gesture-protocol.md` | Unified pager / swipe gesture protocol |
| `window-soft-input-mode.md` | Android `windowSoftInputMode` semantics for the keyboard |

If you want to revisit any of these, please open an issue first so we can scope it and decide whether the proposal still matches the current architecture.
