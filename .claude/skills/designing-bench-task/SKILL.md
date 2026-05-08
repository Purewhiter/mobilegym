---
name: designing-bench-task
description: Use when designing a new bench_env task suite, adding several new tasks to an existing suite, or critiquing a task-set proposal for a mobile-gym App — before any `class FooTask(...)` is written under `bench_env/task/`.
---

# Designing bench_env Tasks

## Overview

Rushing from "here's an App" to "here are 5 task classes" produces low-difficulty suites whose judge logic can't actually verify completion. Design must precede code.

**Authoritative reference:** `bench_env/docs/TASK_DESIGN_GUIDE.md` (reading it once is required; this skill enforces its gates).

## The Gate: three artifacts before any Python

Produce all three as plain text in the conversation **before** writing any task class. If you catch yourself opening `tasks.py`, stop and produce them.

### 1. Functional audit table (GUIDE §2.1)

A table with one row per distinct feature area. Columns:

| Page/feature | Source file(s) | User-visible actions | Observable state path |

You must actually read: `manifest.ts`, `navigation.declaration.ts`, `data/defaults.json`, `state.ts`, `pages/*`, and the suite's `app.py` accessor if it exists. No skipping "because the app looks simple."

### 2. Data sufficiency check (§2.3)

For every function you plan to parameterize, confirm `defaults.json` / `state.ts` provides ≥3 varied entries. If it doesn't, either propose expanding defaults, or drop parameterization for that function. **Do not silently shrink to L1-only as a workaround.**

### 3. Difficulty + objective plan (§3.1, §3.2)

Targets:
- **L1 10-15%, L2 25-30%, L3 30-35%, L4 20-30%** (L3+L4 ≥ 50%)
- operate 40-50% / query 25-35% / hybrid 15-25%

If the App's state surface truly cannot support L3+L4 ≥ 50% (tiny utility apps like Compass, Calculator2), state this explicitly:

> "App X has insufficient state surface for L3/L4. Recommend either (a) expanding mutable data in defaults.json, or (b) treating this app as non-benchable."

and stop. Do **not** ship an all-L1/L2 suite and call it done.

## Per-task: 4 judge-predict questions (§5.2)

For each proposed task, answer in 1-2 lines each **before writing code**:

1. Agent 完全做对时，最终 state / answer 长什么样？
2. Agent 最常见的 1-2 种错误是什么？会不会被误判通过？（soundness）
3. 有没有合理完成任务的替代路径？会不会被误判失败？（completeness）
4. 有无边界情况导致正确答案不唯一、或判定证据不足？

If any answer surfaces a flaw (common: initial state already equals criteria; ground truth not unique; answer requires subjective judgement), **iterate the design in text** — do not defer the fix to code review.

## Rationalization table — STOP and do the step

| Excuse | Reality |
|---|---|
| "App is tiny, audit is overkill" | Small apps breed L1-only suites. Audit surfaces the data gap so you can close it. |
| "I'll just do L1/L2 since the app is simple" | §3.1 is a gate, not a target. If you can't meet it, declare non-benchable. |
| "Judge predict is slow, I'll see issues when coding" | Design bugs (init=goal, non-unique ground truth) are 10× cheaper to fix in text. |
| "These tasks are obvious, pre-sim is busywork" | A task obvious enough to skip pre-sim is obvious enough to answer the 4 questions in 30 seconds. |
| "I'll produce both artifacts and code in one pass" | Then when code inherits a design flaw, you've wasted the coding pass. Gate is gate. |

## Checklist before producing any `class FooTask(...)`

- [ ] Functional audit table in conversation
- [ ] Data sufficiency assessed per parameterized function; gaps declared
- [ ] Difficulty plan hits L3+L4 ≥ 50% **or** declares non-benchable with reason
- [ ] Objective mix matches §3.2 targets
- [ ] For each task, 4 pre-sim questions answered
- [ ] No task has initial state == goal state (pitfall §17.3)
- [ ] Cross-checked GUIDE §10 self-check list (items #1-15)

## After design is approved

For actual code discipline: see the **writing-bench-task-judge** skill and `bench_env/docs/TASK_DESIGN_SPEC.md`. For tests: **testing-bench-task** skill + `TASK_TEST_SPEC.md`.
