# Contributing to MobileGym

Thanks for considering contributing! This document is the short version of how the project accepts changes. The longer architectural rules live in [`docs/architecture.md`](docs/architecture.md) and the topical references under [`docs/platform/`](docs/platform/).

## Ways to help

| Type | What to do |
|---|---|
| 🐛 **Bug report** | Open an issue with the simulator URL, the task ID (if applicable), the full command, and a Playwright trace or screenshot. |
| 💡 **Feature idea** | Open a discussion first if it's non-trivial. We're happy to scope new directions but want to avoid one-off forks. |
| 📱 **New app** | Follow [docs/guides/add-an-app.md](docs/guides/add-an-app.md). PR title `feat(<appid>): add <DisplayName> app`. |
| 🧪 **New task / suite** | Follow [docs/guides/add-a-task.md](docs/guides/add-a-task.md). Every task must ship offline tests in `bench_env/tests/`. |
| 🤖 **New agent adapter** | Follow [docs/guides/add-an-agent.md](docs/guides/add-an-agent.md). |
| 📊 **Leaderboard submission** | See [docs/leaderboard.md](docs/leaderboard.md) — submissions are sanity-checked and trajectory-sampled before merging (we don't re-run by default). |
| 📝 **Doc improvement** | PRs welcome. Prefer fixing a specific error or filling a missing tutorial step over broad rewrites. |

## Before you start

1. **Read the README** ([English](README.md) / [中文](README.zh-CN.md)) so you understand the project's purpose.
2. **Skim the relevant reference** under [`docs/platform/`](docs/platform/) (simulator) or [`bench_env/docs/`](bench_env/docs/) (benchmark). They're the source of truth when conflicts arise.
3. **Look at an existing example** of the thing you're adding. Almost every change has prior art in a comparable app or task.
4. **Open an issue first** if the change is more than 200 lines or touches the OS layer.

## Development setup

```bash
# Front-end
npm install
npm run dev

# Lint & type-check
npm run lint
npx tsc --noEmit                   # only after large refactors

# Front-end tests
npm test

# Python (benchmark)
pip install -r bench_env/requirements.txt
playwright install chromium
python -m pytest bench_env/tests/ -q
```

After modifying any `navigation.declaration.ts`:

```bash
node scripts/build_nav_artifacts.mjs <AppName>
```

This runs the consistency check between the declaration and the source code, and regenerates the nav graph artifacts under `public/`.

## Coding conventions

The repository is strict about a few things — the lint rules enforce most of them:

- **No `new Date(...)`, no bare `Date.now()`** — go through `TimeService`. The `time-service` ESLint rule catches violations.
- **Apps must not import `BackDispatcher` directly** — that's an OS internal. Wire your back behavior through the URL/history stack.
- **Apps must not call `useNavigate()` from `react-router`** — use the app's `go()` / `back()` helpers from `navigation.ts`.
- **All discrete UI states go through the URL** — tabs, dialogs, modals, drawers. No `useState` for visibility.
- **Use OS services, not browser APIs** — `LocationService` over `navigator.geolocation`, `NetworkService` over `fetch`, `ClipboardService` over `navigator.clipboard`.
- **Pointer events only** for drag/swipe/slider — never mix `touch*` and `mouse*` handlers.
- **Status bar reserve** — every page starts with `pt-10`.

Full list: [`docs/platform/app-module-contract.md`](docs/platform/app-module-contract.md).

## Commit & PR style

- One logical change per PR. If the diff is mixed (refactor + feature + bugfix), split it.
- **Conventional commit prefixes** are encouraged but not mandatory: `feat(<app>): …`, `fix(<area>): …`, `refactor(os): …`, `docs(…)`, `test(…)`, `chore(…)`.
- Keep the PR description focused on **why** rather than **what** — the diff already shows what changed.
- Link the issue you're addressing: `Closes #123`.
- If your PR adds a new task or app, attach a screenshot or short clip of it working.

## What gets blocked at review

- New `useState`-driven dialog visibility (the back button breaks).
- Manual `register*` calls to `AppNavigatorRegistry` / `BackDispatcher` / `AppLifecycle` — use `useAppNavigationHandler`.
- Hard-coded brand strings for apps not declared in `manifest.ts`.
- Tasks without offline judge tests in `bench_env/tests/`.
- Any `Date.now()` / `new Date()` that survives the lint pass.

## Code of conduct

Be civil. Assume good faith. Disagreements are normal in research; ad-hominem isn't. Maintainers reserve the right to close threads that don't move the project forward.

## License

By submitting a contribution you agree that:

- Code is released under the project's **Apache License 2.0** ([LICENSE](LICENSE)).
- Bundled data and content are released under **CC BY-NC 4.0** ([LICENSE-DATA](LICENSE-DATA)).
- You have the right to license the contribution under these terms.

For larger contributions (e.g. an entire new app's worth of data), maintainers may ask for an explicit confirmation in the PR.

## Reporting security issues

Please **do not** open public issues for security or data-leak concerns. Email the maintainers (address listed on the project page) and we will respond promptly.

## Reporting takedown / rights claims

If you are a rights holder and want any asset removed, open an issue tagged `takedown`. See [DISCLAIMER.md](DISCLAIMER.md) for the full statement on trademarks and content provenance.

---

Thanks again. Every well-scoped contribution makes the platform more useful for the next person.
