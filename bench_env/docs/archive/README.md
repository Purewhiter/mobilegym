# bench_env/docs — archive

Historical documents from earlier iterations of the bench_env framework and task-design process. The active docs ([`../FRAMEWORK.md`](../FRAMEWORK.md), [`../REFERENCE.md`](../REFERENCE.md), [`../task/`](../task/), [`../performance.md`](../performance.md)) absorb the load-bearing rules; what's here is preserved for context.

| File | Original purpose | Where the live content went |
|---|---|---|
| `TASK_DESIGN_SPEC.md` | Master task-design specification (1900+ lines) | Sharded into [`../task/CONVENTIONS.md`](../task/CONVENTIONS.md), [`../task/IMPLEMENTATION.md`](../task/IMPLEMENTATION.md), and [`../REFERENCE.md`](../REFERENCE.md). |
| `TASK_TEST_SPEC.md` | Offline test conventions | [`../task/TESTING.md`](../task/TESTING.md) |
| `JUDGE_DESIGN_PRINCIPLES.md` | CRUD → check strategy table, init/current split, app helpers | [`../task/IMPLEMENTATION.md`](../task/IMPLEMENTATION.md) §2.5–§2.6 |
| `TASK_DESIGN_GUIDE.md` | Methodology for planning a task suite | Workflow in [`../task/CONVENTIONS.md`](../task/CONVENTIONS.md); the literature-review appendix (10-paper survey) is not migrated. |
| `TASK_FLOW.md` | Episode pipeline + sampling precedence | [`../FRAMEWORK.md`](../FRAMEWORK.md) §2–§4 and [`../REFERENCE.md`](../REFERENCE.md) §6–§8. |
| `AnswerSheet_GUIDE.md` | Path A vs Path B, MRO detection, field types | [`../task/grounded-mode.md`](../task/grounded-mode.md) |
| `BENCH_ENV_PERFORMANCE.md` | bench_env performance pitfalls (waitForData, route-intercept, etc.) | [`../performance.md`](../performance.md) — content fully restored. |
| `benchmark_task_design_v2.md` | Earlier task taxonomy + literature review + per-app task inventories | Taxonomy rules in [`../REFERENCE.md`](../REFERENCE.md) §6 and [`../task/CONVENTIONS.md`](../task/CONVENTIONS.md); Part 1 literature review and Part 3 per-app task lists are not migrated (superseded by what shipped under `bench_env/task/`). |
| `gemini_grounded_task_templates.md` | One-off planning doc of proposed cross-app templates | Not migrated — pure planning artifact. |
| `tasks.md` | Original per-app task catalog with status notes | Superseded by the actual task definitions under `bench_env/task/`. |
| `PROBLEM.md` | bench_env known-issues + fix log | Kept as historical record. The fixes themselves are in git history. |

> ⚠️ Files here may reference renamed modules / removed CLI flags / earlier code shapes. Trust the active docs when they disagree.
