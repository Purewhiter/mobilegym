# Versioning and release policy

A benchmark score is a claim about a specific benchmark. If the benchmark can change underneath a published number without the number changing with it, the number stops meaning anything. This doc says exactly what we version, when each part bumps, and what a release has to do.

## What gets versioned

MobileGym versions four things separately, because they break comparability in different ways.

| Axis | Covers | Where it lives | Published as |
|---|---|---|---|
| **Harness** | `bench_env/` runtime — runner, env, agent adapters, judging engine, CLI | `HARNESS_VERSION` in [`bench_env/version.py`](../bench_env/version.py) | git tag `vX.Y.Z` + GitHub release |
| **Task set** | Benchmark content — task definitions, prompt templates, parameter enums, expected answers, judging criteria, `expected_changes` whitelists | `TASKSET_VERSION` in [`bench_env/version.py`](../bench_env/version.py) | same `vX.Y.Z` release, stated explicitly in the notes |
| **Simulator** | The simulated device — `os/`, `apps/`, `system/`. App behavior, OS services, navigation | `SIM_VERSION` in [`bench_env/version.py`](../bench_env/version.py), tracking `package.json` | same `vX.Y.Z` release |
| **Data** | Companion dataset — app fixtures, media, snapshots | `DATA_VERSION` in [`bench_env/version.py`](../bench_env/version.py) | git tag `data-vX.Y.Z` + GitHub release carrying the tarball |

### Why the simulator is its own axis

It is tempting to fold `apps/` into either the harness or the data. Both are wrong, and the mistake is expensive.

The simulator is the environment the agent acts in and the judge reads state out of. Change how an app mutates its own state and you change what every task touching that app records — without editing a single task file, and without changing a byte of the dataset. A score moves and nothing in the other three axes accounts for it.

The seam between **Simulator** and **Data** is behavior versus content: how liking a song mutates state is Simulator; which songs ship is Data. The seam between **Simulator** and **Harness** is the device versus the thing driving it: `bench_env/` never runs in the browser, `os/` and `apps/` only ever run there.

### Why the task set is separate from the harness

This is the distinction that matters most, and it is the one that is easy to get wrong.

A harness fix — a crash, a timeout, a retry, a logging change — does not redefine any task. Results produced before and after stay comparable.

A task-set change does redefine a task. Rewording a prompt, widening a parameter enum, tightening a judge, adding or removing a task: any of these can move an agent's score without the agent changing at all. **A leaderboard row must cite the task-set version**, not just the harness version.

The two axes usually move together in the same release, and that is fine. They are separate numbers so that the release notes are forced to say which one moved.

## Bump rules

Semver, read against "can this change a score?".

| Change | Harness | Task set | Simulator | Data |
|---|---|---|---|---|
| Bug fix in runner/env/CLI, no behavior change to task execution | patch | — | — | — |
| Bug fix that changes how a task executes or is scored | minor | minor | — | — |
| New agent adapter, new CLI flag, new output field | minor | — | — | — |
| Prompt wording fix on an existing task | — | patch | — | — |
| Judge criteria change, expected-answer change, parameter enum change | — | minor | — | — |
| `expected_changes` whitelist corrected | — | minor | — | — |
| Tasks added or removed | — | minor | — | — |
| Task suite restructured, taxonomy changed, incompatible result schema | major | major | — | — |
| App UI change with no state-shape or behavior change | — | — | patch | — |
| App state mechanism changed (what a tap writes, how ids are assigned) | — | — | minor | — |
| OS service behavior changed (Time, Location, Clipboard, providers) | — | — | minor | — |
| New app added to the simulator | — | — | minor | — |
| App state shape changed incompatibly (judges must be rewritten) | — | major | major | — |
| App fixture content changed (can move scores) | — | — | — | minor |
| Dataset repacked, no content change | — | — | — | patch |

Anything marked "can move a score" also needs a **`[score-affecting]`** entry in [`../CHANGELOG.md`](../CHANGELOG.md).

## The rules that protect published numbers

1. **Never silently mutate a published task.** The `vX.Y.Z` tag is frozen. Fixes land on main and ship in the next task-set version. A reader who pins the tag must get exactly the benchmark that produced the published numbers.
2. **Every score-affecting change is named in the changelog, with its task IDs.** "Fixed weather tasks" is not enough; `weather.CheckCurrentWeather` is.
3. **Every run records its own provenance.** `RunRecorder` stamps all four version axes plus `git_commit`, `git_dirty`, `git_diff_sha` and `untracked_code_count` into each run's `meta.json`, and writes the uncommitted patch itself to `uncommitted.patch` when the tree is dirty. A results directory is self-describing — you never have to reconstruct which benchmark produced it from timestamps.
4. **`git_dirty: true` means the run is not reproducible** from any published version. Treat such results as local-only; never put them on a leaderboard.
5. **Leaderboard rows cite `taskset_version` + `sim_version` + `data_version`.** Rows from different task-set versions are not comparable and should not share a table without a note.
6. **Don't reuse a tag.** If a release is wrong, cut the next patch. Moving a tag invalidates everyone's pin silently.

## Release checklist

1. Land the changes on `main`.
2. Bump the relevant constants in [`bench_env/version.py`](../bench_env/version.py); keep `package.json` in step with `SIM_VERSION`.
3. Move the `## [Unreleased]` entries in [`../CHANGELOG.md`](../CHANGELOG.md) into a dated version section. Confirm every score-affecting entry names its task IDs.
4. Run the offline suite: `pytest bench_env/tests/ -m "not live"`.
5. Tag and push: `git tag -a vX.Y.Z -m "..."` then `git push origin vX.Y.Z`.
6. Cut the GitHub release. The notes must separate **harness fixes (no score impact)** from **task-set changes (may affect scores)**.
7. Update the News section in `README.md` / `README_zh.md`.
8. If the dataset changed: tag `data-vX.Y.Z`, cut its release with the tarball, and update **every** download link — currently `README.md`, `README_zh.md`, and [`getting-started.md`](getting-started.md). A dataset tag with no matching release leaves dead `curl` commands in the docs.

## Dataset tags

A `data-vX.Y.Z` tag is only meaningful with a GitHub release carrying the tarball — the docs link to the release asset, not the git ref. Do not create the tag without the release.

Current dataset release: **`data-v0.1.0`** — the only dataset release, and the only one the docs should link to.

A legacy `data-v1.0` tag was removed in v0.1.1. It predated `data-v0.1.0` despite the higher number, had no GitHub release behind it, and the `curl` commands pointing at its download URL were returning 404. It also happened to be the only remote ref keeping the repository's pre-squash history reachable, so the tag [`pre-squash-history`](https://github.com/Purewhiter/mobilegym/tree/pre-squash-history) was pushed at the same commit before removing it. That tag is a history anchor, not a release — nothing should link to it.

The full tag namespace, for reference:

| Tag | Meaning |
|---|---|
| `vX.Y.Z` | Harness + task-set release, with a GitHub release |
| `data-vX.Y.Z` | Dataset release, with a GitHub release carrying the tarball |
| `pre-squash-history` | History anchor for commits predating the repository squash. Not a release |

## Reference

- Version constants and the `version_info()` helper: [`bench_env/version.py`](../bench_env/version.py)
- Where provenance is written: `RunRecorder.start_run()` in [`bench_env/env/recorder.py`](../bench_env/env/recorder.py)
- Changelog format: [`../CHANGELOG.md`](../CHANGELOG.md)
