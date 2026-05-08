---
name: bench-live-task-validation
description: Validate `mobile-gym` / `bench_env` tasks with real online agent runs, inspect trajectories and screenshots, classify failures across agent/task/judge/app/runtime layers, and decide whether to fix immediately or report. Use when offline tests pass but online behavior still needs verification, when a live task fails and root cause is unclear, when representative tasks from suites such as `crossapp_work`, `crossapp_content`, `crossapp_commerce`, or `crossapp_life` need to be exercised, or when pass results may still hide GUI flaws, missing features, or looping behavior.
---

# Bench Live Task Validation

Validate representative `bench_env` tasks with real agent execution instead of relying on offline judge tests alone.

Treat the goal as root-cause analysis, not pass-rate maximization. Always determine whether a problem comes from the agent, task design, judge/accessor logic, App or GUI behavior, or runtime infrastructure, then choose between direct repair and explicit reporting.

## Read Context First

Read the repository and task context before running anything:

- `/Users/purew/Desktop/mobile-gym/CLAUDE.md`
- `/Users/purew/Desktop/mobile-gym/bench_env/docs/TASK_DESIGN_GUIDE.md`
- `/Users/purew/Desktop/mobile-gym/bench_env/docs/TASK_DESIGN_SPEC.md`
- `/Users/purew/Desktop/mobile-gym/bench_env/docs/TASK_TEST_SPEC.md`
- The target suite file, usually `bench_env/task/<suite>/tasks.py`
- Any existing `runs/<timestamp>/results.jsonl` or trajectory folders relevant to the current investigation

Use the repo's conventions:

- Use Simplified Chinese in user-facing responses inside this repository.
- Prefer `conda run -n agent python -m bench_env.run ...` for live runs.
- Avoid reading or quoting local scripts that embed API keys or secrets. Prefer environment variables or user-provided safe command templates.
- Do not assume generic env var names such as `MODEL_BASE_URL` / `MODEL_API_KEY` unless the repo or user explicitly says so.
- Do not assume a failure is the model's fault until trajectory and screenshots confirm it.
- Fix deterministic issues directly when the cause is clear; only defer items that are genuinely ambiguous.

## Model and Endpoint Selection

Do not guess the model, API URL, or env var names.

Follow this order:

1. If the user explicitly specifies model / base URL / key source, use that.
2. Otherwise, check whether the repository already contains a safe, checked-in run template that documents the intended defaults without exposing secrets.
3. If the repo does not provide a clear default, or the env var names are ambiguous, ask the user before running anything.

For this repository, the checked-in safe template currently points to:

- agent: `generic_v2`
- model: `gemini-3-pro-preview`
- base URL: `${YUNWU_BASE_URL:-https://yunwu.ai/v1}`
- API key env var: `$YUNWU_API_KEY`

This template is a recommended default for this repo, not a universal assumption. If the user has not specified a model setup, explicitly confirm before using it.

## Choose Representative Tasks

Do not start with a full-suite blind run unless the user explicitly wants breadth over diagnosis. Pick a small but representative batch first.

Cover these dimensions when sampling:

- `operate`, `query`, and `hybrid`
- Easy navigation and deep navigation
- Cross-App routing and data handoff
- Reading values from UI and writing new content/state
- Tasks likely to expose GUI ambiguity, missing implementation, or flaky routing

Prefer 3-5 tasks per suite for the first pass. If the user already identified target suites such as `crossapp_work`, `crossapp_content`, `crossapp_commerce`, or `crossapp_life`, stay within that scope.

## Preflight

Before executing live tasks:

1. Confirm the simulator server is already running, usually at `http://localhost:3000`.
2. Confirm the model, agent type, and environment match the current validation request.
3. Confirm the concrete env var names that the command will use. Do not silently substitute other names.
4. Do not insert an unrelated probe task. Start directly with the user-requested target task, or with a small representative batch inside the requested suite/scope.
5. In Codex, request approval and run live validation outside the sandbox from the start. Do not do an in-sandbox Playwright / Chromium trial run first.
6. Start with small parallelism such as `--parallel 2` to `--parallel 4`. Increase only after basic stability is confirmed.
7. If judge, accessor, or runtime code changed, run targeted offline tests first.
8. Avoid mixing unrelated code changes into the same validation round.
9. Do not assume repeated `--task-id` flags will build a multi-task batch here. Prefer one task per invocation for diagnosis, or use `--suite` for a suite-scale run.
10. Do not add extra existence or process checks before every rerun. If the task id is already known and there is no evidence of stale processes interfering, run the target command directly.

Use command templates like:

```bash
conda run -n agent python -m bench_env.run \
  --task-id crossapp_content.EbayCheapToRedbook \
  --env-url http://localhost:3000 \
  --model-base-url "${YUNWU_BASE_URL:-https://yunwu.ai/v1}" \
  --model-api-key "$YUNWU_API_KEY" \
  --model-name gemini-3-pro-preview \
  --headless \
  --agent generic_v2
```

```bash
conda run -n agent python -m bench_env.run \
  --suite crossapp_content \
  --parallel 4 \
  --isolation pages \
  --env-url http://localhost:3000 \
  --model-base-url "${YUNWU_BASE_URL:-https://yunwu.ai/v1}" \
  --model-api-key "$YUNWU_API_KEY" \
  --model-name gemini-3-pro-preview \
  --headless \
  --agent generic_v2
```

If the user did not specify the model setup, ask a short question before using this repo default. Example:

- “当前仓库默认模板是 `generic_v2 + gemini-3-pro-preview + ${YUNWU_BASE_URL:-https://yunwu.ai/v1}`，key 用 `$YUNWU_API_KEY`。是否按这套配置跑 live validation？”

## Codex Outside-Sandbox Flow

When running inside Codex, treat Playwright / Chromium launch as an outside-sandbox operation by default.

Correct flow:

1. Verify simulator availability and model config.
2. If the user did not specify the model setup, confirm the repo default before running.
3. Request approval before any live run that launches Playwright / Chromium.
4. Run the actual target task, or the requested representative batch, outside the sandbox with `conda run -n agent python -m bench_env.run ...`.
5. Only after one real target run succeeds should you expand to suite-scale validation or parallel subagents.

Do not start with an unrelated probe task, and do not burn one failed in-sandbox launch before requesting approval.

## Inspect Results in Two Layers

Never stop at `pass` or `fail`.

Always inspect these artifacts first:

- `runs/<timestamp>/results.jsonl`
- `runs/<timestamp>/trajectory/<task_id>/trajectory.json`
- `runs/<timestamp>/trajectory/<task_id>/meta.json`
- `step_XXX_prompt.json`
- `step_XXX_response.txt`

Then inspect screenshots whenever the text trace is insufficient or suspicious.

Use the screenshot pair intentionally:

- `step_XXX.png` for the raw UI state
- `step_XXX_annot.png` for the action target and click/drag location

## Read Screenshots When Needed

Treat screenshot review as mandatory, not optional, in these cases:

- The agent repeats the same or similar action at least twice
- The text response claims a value was read or an action succeeded, but the final state disagrees
- A click, type, scroll, or navigation action appears to have no effect
- The App may be missing implementation, blocked by modal/keyboard, or visually misleading
- The task passes but the trajectory looks fragile, wasteful, or obviously lucky
- Cross-App jumps produce unexpected intermediate screens

Prefer this review order:

1. The first step that reaches the key page
2. The first step where behavior starts repeating
3. The last few steps before `COMPLETE`, timeout, or failure

If the environment supports local image viewing, open the relevant PNG files directly. Use raw screenshots to read UI meaning and annotated screenshots to verify where the agent acted.

## Classify Root Cause

Assign each issue to one primary bucket. Add a secondary bucket only when the evidence truly spans multiple layers.

### Agent Problem

Use this when the environment and task are valid, but the model makes a wrong decision:

- Read the wrong row, card, song, product, or message
- Stop after reading only currently visible items
- Ignore a scrollable region
- Complete early with an incomplete answer
- Loop because of poor planning, despite the UI exposing a viable path

### Task Design Problem

Use this when the task specification or expected answer is misaligned with what the UI stably exposes:

- The instruction is ambiguous enough to support multiple plausible interpretations
- The judge expects information that the UI does not reliably surface
- The task depends on brittle visual assumptions or hidden knowledge
- The intended user goal is reasonable, but the benchmark encoding is not

### Judge or Accessor Problem

Use this when live behavior is fine but validation is wrong:

- Number extraction, normalization, or synonym matching fails
- The accessor reads the wrong state path
- Runtime fields are falsely treated as side effects
- The check logic is inconsistent with the actual state schema

### App or GUI Problem

Use this when the simulator product itself is deficient, even if the task technically passes:

- A visible control does nothing
- A required feature or route is unimplemented
- Navigation, back handling, modal behavior, keyboard behavior, or scrolling is broken
- The UI repeatedly funnels the agent into dead ends
- A page communicates affordances poorly enough that failure is a product issue, not only a model issue

### Runtime or Infrastructure Problem

Use this when execution, isolation, or recorder infrastructure is the real cause:

- Run directory collisions
- State leakage across parallel runs
- Server-side instability
- Recorder/trajectory corruption
- Environment reset or route synchronization problems

## Decide Whether To Fix or Report

### Fix Immediately

Fix the issue directly when all of these are true:

- The cause is deterministic and localizable
- The expected behavior is clear
- The change does not require product or benchmark policy approval

Typical direct fixes:

- Judge/accessor bugs
- Runtime recorder bugs
- Missing alias mapping
- Incorrect side-effect ignore lists
- Clearly broken or unimplemented App behavior

When fixing:

1. Patch the smallest correct scope
2. Add or update offline tests
3. Re-run the targeted offline tests
4. Re-run at least one original failing live task
5. Re-run one same-class representative task to catch regressions

### Report Without Directly Fixing

Report and defer when any of these are true:

- The intended product behavior is ambiguous
- The task design needs benchmark-owner judgment
- The issue is mainly model capability, not environment correctness
- Evidence is incomplete or not yet reproducible

Do not invent certainty. Mark the remaining ambiguity explicitly.

## Record Findings at the Right Level

Always keep raw evidence in the existing `runs/` artifacts. Do not rewrite screenshots or trajectories into a permanent document unless the finding is confirmed and reusable.

Use this default recording policy:

- For a single validation round, summarize findings in the final response with evidence paths
- For confirmed, reusable patterns or cross-suite issues, create or update a persistent repo document only when the user asks for a file or when the issue will clearly matter again
- Suggested persistent location: `bench_env/docs/live_validation/YYYY-MM-DD-<scope>.md`

Record every confirmed issue with:

- Task ID and suite
- Pass/fail outcome
- Root-cause bucket
- Whether the issue is fixed, deferred, or only observed
- Minimal reproduction note
- Evidence paths to `results.jsonl`, trajectory folder, and key screenshot / response steps

Also record warnings for abnormal passes:

- Repeated dead-end actions
- Controls with delayed or missing feedback
- Suspiciously lucky completions
- GUI behavior that would likely break on another model

## Final Report Template

Structure the final report in this order:

1. Scope: what suites and tasks were tested
2. Outcomes: pass/fail summary
3. Fixed issues: what was repaired immediately
4. Deferred issues: what still needs judgment or follow-up
5. Warnings: abnormal passes or flaky-looking behavior
6. Evidence: absolute paths to the most important run artifacts

Keep the summary concise, but include enough evidence for another engineer to reproduce the diagnosis quickly.
