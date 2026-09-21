# Changelog

All notable changes to MobileGym are recorded here.

Entries that can change an agent's score on any task are marked **`[score-affecting]`** and name the affected task IDs. Everything else is safe to assume score-neutral. See [`docs/VERSIONING.md`](docs/VERSIONING.md) for what each version number covers and when it bumps.

Versions: `harness` (bench_env runtime) / `taskset` (benchmark content) / `data` (companion dataset).

## [Unreleased]

### Fixed

- **`[score-affecting]` Spotify: unlike + re-like no longer swaps the stored record.** The same song carries a different id in every catalog the app reads (seed lists, search results, album / artist pages), and `toggleLike` stored whichever record the calling screen passed. Unliking a seed song and re-liking it from another screen therefore replaced e.g. `ls_8` with `it_403037877`, which a state diff reads as one song deleted and a different one added — an unexpected-side-effect failure for an agent that changed nothing visible. `toggleLike` now restores the record it removed (falling back to the seed record, then the caller's), and `recentPlays` shares ids with `likedSongs`. Re-liking still moves the song to the top; that reorder is real and still judged. Affects any Spotify task whose `expected_changes` omits `likedSongs`, observed on `spotify` / `CollectLikedRecentAndPlay`. Guarded by `tests/spotifyRelikeIdentity.test.ts` and `tests/spotifyTrackIdentity.test.ts`.
- **`[score-affecting]` Weather: the condition shown on screen is now a function of the stored `text`, in both languages.** Judges read `text` out of state. The Chinese UI used to re-word it (stored `霾` rendered as `轻度雾霾`), making answer tasks unpassable; it now shows `text` verbatim. The English UI translates `text` by exact match against QWeather's vocabulary (`qw_*` keys in `apps/Weather/res/strings*.ts`) and consults the condition code only for wording outside that table — never to override it, because the snapshot contains entries whose code and wording disagree. The home-screen widget provider uses the same lookup, so widget and app agree. Affects `weather` / `CheckCurrentWeather`, `OpenDailyForecast`, `WarmestDayInWeek`. Guarded by `tests/weatherConditionTextFidelity.test.ts`.
- **Contacts: opening a contact card no longer writes `lastContactedAt`.** Browsing is not contacting; the field is written by the call / SMS actions on the detail page only, matching `ContactsContract.LAST_TIME_CONTACTED`. Score-neutral: the field is on the judge's side-effect ignore list.
- **Dead dataset download link in the onboarding doc.** `docs/getting-started.md` pointed `curl` at the `data-v1.0` release in two places, including the copy-paste "every command in one block" section. That release never existed — the URL returned HTTP 404, so anyone following the getting-started guide failed at the dataset step. Both links now point at `data-v0.1.0`, which is the real release. The dataset size and app list in that doc were also stale (they predated v0.1.0) and now match `README.md`.

### Added

- **Run provenance.** Every run's `meta.json` now records `harness_version`, `taskset_version`, `data_version`, `sim_version`, `git_commit`, `git_dirty`, `git_diff_sha` and `untracked_code_count`, stamped by `RunRecorder.start_run()`, and a dirty run saves its tracked changes as `uncommitted.patch` (binary-safe, independent of the user's git config, re-read on every run start — `git apply` it onto `git_commit` to get the tree that ran). Provenance can never abort a run: without git, every git field is `null`. A results directory is now self-describing: you can tell which benchmark produced a number without reconstructing it from timestamps. `git_dirty: true` marks a run that is not reproducible from any published version.
- **Version constants** in [`bench_env/version.py`](bench_env/version.py), splitting harness / task set / data into three independently-bumped axes.
- **[`docs/VERSIONING.md`](docs/VERSIONING.md)** — bump rules, the rules that protect published numbers, and the release checklist.
- This changelog.

### Removed

- **Legacy `data-v1.0` tag**, on both the local repo and the remote. It predated `data-v0.1.0` despite the higher number, had no GitHub release behind it, and was the target of the 404 links fixed above. It was also the only remote ref keeping the repository's pre-squash history reachable, so the tag `pre-squash-history` was pushed at the same commit (`ceb3dfeb`) first — that history is still on the remote, under a name that no longer reads as a dataset release.

## [0.1.0] — 2026-06-26

harness `0.1.0` / taskset `0.1.0` / data `0.1.0`

First stable release; the recommended version for running experiments.

### Added

- Online RL training code ([`mobilegym-rl/`](mobilegym-rl)).
- Companion dataset published as the `data-v0.1.0` release (~1.9 GB: synthetic Bilibili / RedNote / eBay / Spotify / Maps / themes / wallpapers).

[Unreleased]: https://github.com/Purewhiter/mobilegym/compare/v0.1.0...main
[0.1.0]: https://github.com/Purewhiter/mobilegym/releases/tag/v0.1.0
