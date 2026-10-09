# Development-health overhaul review — 2026-10-10

Status: **draft for human review; not approved for merge**.

The candidate contains current main `5fbd3f34be0e9780ae4b1e9d5089963ddbd05d38` and the original maintenance work from `fix/dev-health-overhaul` (`ec1acffe`). The original branch remains unchanged. The working branch is `codex/dev-health-main-sync`.

## Scope and disposition

Retain the OS composition split, app correctness/localization fixes, navigation tooling, deterministic reset/injection changes, heavy-data loading, asynchronous recorder/state-decode work, and deployment/resource-index improvements. Keep current main's clock broadcasts, Spotify identity restoration, contact-browsing behavior, Weather prompt/condition fixes, provenance and four version axes.

Exclude all **116 binary image recompression changes** from the aggregate diff. Their visual/agent impact is not established. They remain recoverable from the original branch. Also remove the coroutine-only episode timeout: cancelling an await cannot terminate synchronous inference in its worker thread. Existing provider request and browser-operation timeouts remain.

## Review passes

| Pass | Focus | Findings and disposition |
|---|---|---|
| 1 | Behavioral correctness and data safety | Removed cross-tab namespace deletion; fixed same-page negative-cache expiration and short transient image errors; restored thumbnail filtering; supplied tracked navigation fixtures instead of ignored local outputs. |
| 2 | Main compatibility and activity ownership | Merged main with two conflicts resolved; migrated main's clock receiver into the extracted StatusBar; restored a Hook import missed by automatic merge; made timers follow the visible activity rather than app identity. |
| 3 | Declaration/runtime contract and reproducibility | Persisted Bilibili search-menu targets in URL history; removed RedBook's dead `home.follow.userFollow.toggle` declaration; compared 16 apps with one checker; restricted the new HTTP evaluation listener to loopback; aligned CI/data setup and deployment documentation. |

These are three passes by the same agent, not independent reviewer approvals. Commit messages' historical reviewer/performance claims are not treated as fresh evidence.

## Corrections made during review

- Storage: opening another tab must preserve existing live tabs' namespaced data. Automatic namespace garbage collection is deferred until ownership/liveness can be proven.
- WMR: confirmed HTTP 404s expire after six hours; generic `Image.onerror` errors use a five-second in-memory retry window and are not persisted. A refreshed inventory invalidates negative results in its scope.
- Snapshots: filesystem metadata excludes `thumbnailUri` again.
- Timers: home, Recents, removed tasks, and lower activities of the same app pause timers. Resume compensation remains real-time based.
- Bilibili: `search.user.menu.open` includes the clicked `mid` in trigger parameters and URL query state. Returning to a history entry restores its own target.
- RedBook: removed action `home.follow.userFollow.toggle`, whose only bind site was an unused component removed by the original cleanup. No visible control was removed by this follow-up.
- CI: main/dev PR triggers, Node 22, cached pinned `data-v0.1.0`, tracked golden fixtures, bounded Vitest workers.
- Deployment: the new HTTP listener binds `127.0.0.1`; HTTPS behavior remains available for remote access. Shell syntax was checked, but nginx deployment has not been exercised.

## Validation evidence

- Complete Vitest suite: **348 passed across 67 files**.
- Python offline suite: **2754 passed, 2 skipped**.
- `tsc --noEmit`: passed after main integration and timer fixes.
- Production Vite build: passed. Existing large-chunk warnings remain.
- Lint: **0 errors, 954 ESLint warnings**, plus **17 non-blocking whole-store subscription diagnostics**; the full recommended-rule scope still has substantial existing warning debt. Temporary migration allowances remain visible in `eslint.config.js`.
- `git diff --check`: passed after scoped whitespace cleanup.
- `bash -n scripts/server/start_nginx_gateway.sh scripts/server/serve_dist.sh`: passed.
- Navigation consistency, same candidate checker on both trees: **34 → 0 errors; 132 → 119 warnings** across 16 changed apps. See [machine-readable comparison](dev-health-navigation-comparison.json).

No model benchmark, success-rate comparison, latency comparison, or per-page visual certification is claimed. A live-test attempt before the user paused running stopped at browser setup because the Playwright Chromium binary was absent; it produced no task metrics. The browser dependency was subsequently installed, but live/model runs were not resumed after that instruction.

## Remaining review items

1. Agent success/progress/false-complete/side-effect metrics and throughput must be compared with pinned main before merge. The user explicitly deferred these runs.
2. Navigation warnings are not all cleared. Some describe implicit/shared binds; graph-unreachable and missing-route diagnostics still need owner assessment. The table below gives concrete examples rather than only a count.
3. App/dialog/keyboard/swipe behavior and all theme packs require visual/runtime review. Node tests do not establish complete screenshot equivalence.
4. Lint warning debt and temporary migration overrides remain. This PR does not claim zero technical debt.
5. Existing repository guidance says cold `openApp` replaces history, while current main and `docs/platform/os/cross-app-launch.md` specify/preserve a push. This candidate preserves main's runtime behavior; the documentation discrepancy needs reconciliation separately.

### Concrete navigation diagnostics

| ID | Location | Remaining diagnostic |
| `transferAmount.note.select.borrow` | [apps/Alipay/navigation.declaration.ts:765](../../apps/Alipay/navigation.declaration.ts#L765) | Declared action without a recognized bind site (also on main). |
| `transferPassword.keypad.press` | [apps/Alipay/navigation.declaration.ts:779](../../apps/Alipay/navigation.declaration.ts#L779) | Declared action without a recognized bind site (also on main). |
| `bankCards.add.verify.done` | [apps/Alipay/navigation.declaration.ts:1153](../../apps/Alipay/navigation.declaration.ts#L1153) | Graph target contains duplicate toast query expansion. |
| `settings.payment.password.open` | [apps/Alipay/navigation.declaration.ts:1186](../../apps/Alipay/navigation.declaration.ts#L1186) | Graph target references a missing route. |
| `ranking.open` | [apps/Bilibili/navigation.declaration.ts:1064](../../apps/Bilibili/navigation.declaration.ts#L1064) | Extra source pathname without a mapped trigger (also on main). |
| `home.dateSelect` | [apps/Railway12306/navigation.declaration.ts:225](../../apps/Railway12306/navigation.declaration.ts#L225) | Graph source missing for the /query-result variant. |
| `search.filter.open` | [apps/RedBook/navigation.declaration.ts:978](../../apps/RedBook/navigation.declaration.ts#L978) | Graph target mismatch in query expansion. |
| `search.sort.switch` | [apps/RedBook/navigation.declaration.ts:990](../../apps/RedBook/navigation.declaration.ts#L990) | Graph target mismatch in query expansion. |
| `photo.intent.modal.more.open` | [system/Gallery/navigation.declaration.ts:158](../../system/Gallery/navigation.declaration.ts#L158) | Intent-entry subgraph reported unreachable by the analyzer. |

## Reproduction

```sh
npm ci
npm test
npx tsc --noEmit
npm run lint
npm run build
python -m pytest bench_env/tests -m 'not live' -q
node scripts/build_nav_artifacts.mjs Bilibili
node scripts/build_nav_artifacts.mjs RedBook
```

Use the pinned companion data release for fresh checkout/CI; never treat local ignored `public/*_nav_graph*.json` files as golden inputs. Tests read versioned files under `tests/fixtures/navigation`.

## Original commit ledger

Each original commit is kept in history. Disposition below refers to the **net candidate diff**, not permission to merge that commit individually.

| Commit | Change | Disposition |
| `507e2cc9` | perf(assets): batch-compress bitmap assets (resize to <=720w, re-encode) | Excluded: original main images restored; visual/metric review deferred. |
| `80300401` | fix(bench): runtime reliability, judge strictness and test organization | Retained with correction: unsafe coroutine-only episode timeout removed; main repeat-worker fix retained. |
| `4e39ac29` | fix(os): platform-layer correctness and persistence fixes | Retained with corrections: namespace deletion removed; activity timer ownership fixed. |
| `f6355772` | fix(apps): crash fix, URL-driven dialogs, PointerEvent, perf and nav-declaration sync | Retained with follow-up menu target and declaration fixes; visual review outstanding. |
| `eceb3822` | feat(tooling): nav toolchain overhaul, CI pipeline, full lint scope | Retained with CI triggers/data setup fixes; navigation warnings documented. |
| `d35d1207` | test: add os-core suites; rewrite brittle string-hook test behaviorally | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `4b29e99c` | docs: hygiene - gitignore gaps, pending-doc dead links, README_zh catch-up | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `67d555c9` | feat(bench): human agent action commands for terminal-driven episodes | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `a54af9c7` | fix(sms): back no longer exits the app while a URL-driven overlay is open | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `43e92cf6` | fix(launcher): drag-to-merge no longer silently deletes the dragged app | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `5c0bb068` | fix(scripts): expose structuredClone inside the declaration loader vm sandbox | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `f5e05197` | test(scripts): add golden CLI gate for navigation_declaration_analyzer | Retained with tracked golden fixtures; no dependency on ignored public graphs. |
| `5478e726` | refactor(scripts): extract nav_ref_resolver and nav_condition_eval libs from analyzer | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `b2bac52f` | refactor(scripts): extract nav_graph_core lib from analyzer | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `3df62ccf` | perf(data): serve book texts and Map places as fetched static assets | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `1ed4317b` | refactor(scripts): extract nav_graph_prune lib from analyzer | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `e00875c6` | chore(lint): adopt typescript-eslint recommended; clear all errors; first any-debt batch | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `175ec7e9` | feat(bilibili): migrate all user-facing copy to the i18n string contract | Retained: string contract migration; locale-specific visual review pending. |
| `fdcea1fe` | refactor(scripts): extract nav_schema_graph lib from analyzer | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `ecc2e1d8` | refactor(os): export SystemShell pure helpers and lock behavior with tests | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `7ce997b2` | refactor(scripts): extract nav_data_expand lib from analyzer | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `709af22b` | refactor(os): extract useTaskManagerSelector hook from SystemShell | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `89556513` | docs(scripts): document the nav toolchain shared libs in scripts/README | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `5f39368d` | refactor(os): extract chromeForeground probing helpers from SystemShell | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `7f4f88db` | chore(gitignore): ignore all runs*/ benchmark output directories | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `34dd3709` | refactor(os): extract StatusBar component from SystemShell | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `fcb32118` | refactor(os): extract GestureBar and EdgeGestures components from SystemShell | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `2fc2936a` | refactor(os): extract RecentsOverlay (blur + chrome + swipe sync) from SystemShell | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `6367f149` | refactor(os): extract ActivityHost performance boundary from SystemShell | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `c2073433` | refactor(os): extract launcher snapshot summary from OSContext into os/sim/launcherSnapshot | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `9f1823cf` | refactor(os): lift lastNavError module state from OSContext into os/osNavError | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `8dd86b51` | refactor(os): extract resetStateCore orchestration from OSContext into os/sim/simResetCore | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `e7d7eee6` | refactor(os): lift 9 stateless OS action callbacks from OSContext into os/osActions | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `eaabb071` | refactor(os): lift navigation and finish/close action callbacks from OSContext into os/osActions | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `3978392e` | refactor(os): lift intent trio and openApp callbacks from OSContext into os/osActions | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `a076e817` | refactor(os): extract OS back handlers and app lifecycle sync into dedicated hooks | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `2d0b0fc4` | refactor(os): extract buildOsApi/buildSimApi factories, shrink OSContext to composition root | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `459106b9` | refactor(os): sync AGENTS.md OSContext description with module split | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `8258ee1f` | chore(review): address best-of-N review findings on the splits | Historical review claims not counted as current approvals. |
| `e2430518` | perf(bench): fix waitForData([]) semantics, off-loop decode/IO, topology guard, wire-scale knob | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `8e0c3e18` | perf(serving): plain-HTTP eval channel, gzip_static, gateway fix, 404 memory | Retained with loopback HTTP binding and corrected WMR error caching; deployment/metrics pending. |
| `45d6cc2f` | fix(wmr): eliminate theme widget probing 404s at the source via asset index | Retained with transient/TTL/inventory invalidation corrections. |
| `3535f7c6` | refactor(wmr): serve theme asset index dynamically — no pre-generation step | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `08775d66` | feat(themes): emit asset index at data-pack generation time | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
| `ec1acffe` | refactor(wmr): dev/preview always serve asset index dynamically (disk is truth) | Retained in draft; covered by module/contract review and relevant static/offline gates, pending human/runtime review. |
