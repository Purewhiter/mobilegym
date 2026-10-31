# Navigation Platform Docs

Use these docs when changing `navigation.declaration.ts`, route helpers, generated navigation graphs, or action/task generation.

| Need | Read |
|---|---|
| Route/action declaration grammar, runtime contract, tagging rules | [`declaration.md`](declaration.md) |
| Route tables + `os/navigation` hooks (pilot: Tencent Meeting), exploring a running app's graph | [`routes.md`](routes.md) |
| Action declarations, DOM action binding, action-vs-transition split | [`actions.md`](actions.md) |
| Data-mode graph expansion, `dataSource`, `StateCondition`, bound params, unevaluable conditions | [`data-sources.md`](data-sources.md) |
| Graph generation commands, generated artifacts, validation | [`graph-generation.md`](graph-generation.md) |
| Runtime `MemoryRouter`, app navigation handler, URL state, foreign-task isolation | [`runtime-state.md`](runtime-state.md) |
| How Back and cross-app routing interact with navigation | [`../os/overview.md`](../os/overview.md) and [`../os/cross-app-launch.md`](../os/cross-app-launch.md) |
| Build scripts that regenerate navigation artifacts | [`../tooling/build.md`](../tooling/build.md) |

Before navigation/action/condition changes, read [`declaration.md`](declaration.md).
