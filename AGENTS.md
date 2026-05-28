# AGENTS.md

This file provides guidance to Code Agents when working with code in this repository. Respond in whatever language the user writes to you in — if they ask in Chinese, reply in Chinese; if they ask in English, reply in English.

## Project Overview

mobile-gym is a **simulated Mobile environment (Android-like)** built with React + Vite + TypeScript + Tailwind CSS v4. It serves as a training and benchmarking platform for mobile GUI Agents. The simulator runs in a browser and exposes JavaScript APIs (`__SIM__`, `__OS__`, `__SIM_INPUT__`, `__SIM_QUERY__`, `__SIM_TIME__`, `__SIM_LOCATION__`, `__SIM_FS__`) for **task management, trajectory data synthesis, and benchmark orchestration**. The Agent only sees screenshots.

User-facing documentation under `docs/` and `bench_env/docs/` is in **English**. New user-visible App text must also follow the i18n resource contract: keep it in `res/strings.ts` with localized overrides such as `res/strings.en.ts`, and consume it through `useAppStrings` / `resolveAppStrings` instead of scattering Chinese or English literals through JSX. See `docs/platform/tooling/i18n.md` and `docs/platform/app/resources.md`.

### Type-checking strategy

- **Small changes** (touching a few files, styling tweaks, data updates) — **no need** to run `tsc --noEmit`; rely on the IDE's live checker
- **Large changes** — run `npx tsc --noEmit` once on completion to confirm there are no type errors

### ESLint

```bash
npm run lint          # Lint runtime code under os/ and apps/
```

Current rule: bare `Date.now()` and any form of `new Date(...)` (including parameterised forms — they must go through `TimeService`) are forbidden. Config lives in `eslint.config.js`.

### Navigation Artifact Generation (run after modifying navigation declarations)

```bash
# One-shot: consistency check + schema nav graph + action tasks
node scripts/build_nav_artifacts.mjs <AppName>

# With data graph generation
node scripts/build_nav_artifacts.mjs <AppName> --data data/index.ts

# Skip tasks, only update graphs
node scripts/build_nav_artifacts.mjs <AppName> --skip-tasks
```

### Consistency Checking

```bash
node scripts/check_navigation_declaration_consistency.mjs <AppName> --actions
```

### Benchmark Environment (Python)

To run Python, prefer the conda environment — it should already be installed on this machine. For everything else about the benchmark (installing dependencies, CLI usage, supported agent types, task running), see [`bench_env/README.md`](bench_env/README.md).

## When docs and code disagree

When you're unsure about what a doc says, or you suspect it's wrong, **read the source code**. Docs are a convenience; the code is what actually runs. But before deciding which side to trust in a conflict, identify which kind of doc you're looking at:

- **Descriptive docs** describe what the code currently does. If they disagree with the code, **the code wins** — the doc is stale, fix the doc.
- **Prescriptive docs** define what the code is *supposed* to do. If they disagree with the code, **the doc usually wins** — the code may be a bug. Surface the discrepancy to the user rather than silently rewriting either side.

Heuristic for telling them apart: "X does Y" → descriptive. "X must Y" / "X is forbidden to Y" / "Rule: X" → prescriptive. A single file (or even a single section) can mix both — judge each statement by its phrasing.

## Architecture

The project has three main layers plus dev tooling. It is a single Vite project (not a monorepo). Path alias: `@/*` maps to the project root.

### OS Layer (`os/`)

The simulated Android system:

- **`OSContext.tsx`** — Thin React Context Provider; delegates to TaskManager, BackDispatcher, IntentResolver; exposes `window.__OS__` and `window.__SIM__` global APIs
- **`TaskManager.ts`** — Task/Activity stack management (volatile — refresh = restart; state is readable via `__SIM__.getState()`). Each Task has `stack: ActivityInstance[]` to support multiple Activities. `finishActivity()`: when stack>1 it pops the top Activity; when stack=1 it **never destroys the Task** — if `launchedByTaskId` is set it activates the caller and consumes the marker, otherwise it calls `goHome()` and the Task stays in Recents (destruction requires an explicit `__OS__.closeApp` or a Recents swipe). The `wasExternallyRouted` flag currently only affects whether `LAUNCH_APP` clears `launchedByTaskId` when reactivating from the desktop (details in `docs/platform/os/task-lifecycle.md`)
- **`BackDispatcher.ts`** — Priority-based back key handler. Components register with priority (e.g., PermissionDialog:1000, Shade:800, Keyboard:700, App:100). Includes frame-level deduplication to prevent double-back when edge-swipe gesture and backdrop click fire in the same frame
- **`IntentResolver.ts`** — Intent matching, chooser state management, startActivityForResult
- **`AppNavigatorRegistry.ts`** — Event-driven app/activity navigator registration. Uses CustomEvent + Promise pattern (replaces polling). Navigator `navigate(path, options?)` accepts optional `{ replace?: boolean }` — OS uses this to control push (existing tasks) vs replace (new tasks) when routing via `openApp`
- **`SystemShell.tsx`** — Desktop, status bar, gesture handling, app rendering container. Apps stay mounted when backgrounded (hidden via `display:none`), preserving React state. Implements **adjustResize**: wraps each Activity in a `data-adjust-resize` div that shrinks by keyboard height when keyboard is visible, so App flex layouts auto-adapt. When keyboard is active, the container gets `data-keyboard-active` attribute — elements with `data-hide-on-keyboard` are automatically hidden via global CSS
- **`AppStateRegistry.ts`** — Dual-layer state: runtime registry (from mounted apps) + persistent readers (localStorage fallback). External access via `getAllAppStates()`
- **`types.ts`** — Core type definitions (`AppId = string`). `AppId` is a plain string alias — apps are auto-discovered, no manual type union needed
- **`types/manifest.ts`** — `AppManifest` type definition (id, packageName, displayName, displayNameEn, aliases, version, icon, theme, etc.)
- **`data/appRegistry.tsx`** — App registry: auto-discovers manifests (`apps/*/manifest.ts`, `system/*/manifest.ts`) and entry components (`apps/*/*App.tsx`, `system/*/*App.tsx`) via `import.meta.glob`. **New apps do NOT need to register here**
- **`hooks/useTriggerGestures.ts`** — Unified gesture hook producing `data-trigger-*` / `data-action-*` DOM attributes for task definition, trajectory synthesis, and navigation graph generation (NOT for Agent observation — Agent is pure-vision, screenshot only). **Globally intercepts `system.back`** triggers and routes them to `window.__OS__?.handleBack()` — individual app gesture hooks must NOT handle `system.back` themselves
- **`hooks/useAppNavigationHandler.ts`** — Unified App navigation registration hook. Registers with `AppNavigatorRegistry` / `BackDispatcher` / `AppLifecycle`; keeps a shadow `HistoryTracker` in sync to support `popTo`. `openApp`: passes `replace=true` for a new Task, `replace=false` for an existing Task (MemoryRouter push). `startActivity({newTask:true})` pushes a new Activity at the OS layer (with its own `activityId`, finishable independently via `finishActivity()`). **Foreign Task isolation**: when `task.rootAppId !== appId`, app-level registration is skipped and only the activity-level navigator is used
- **`utils/memoryHistory{Tracker,PopTo}.ts`** — Shadow history stack (react-router-dom@7 MemoryHistory does not expose entries). `HistoryTracker` mirrors MemoryRouter location changes; `findPopToDelta()` returns the `go(-delta)` step count; `popTo()` calls `navigator.go(-delta)` to rewind, then the caller invokes `navigate(url)` to finish the push/replace (mirroring Android's `popUpTo`)
- **`createOsStore.ts`** — OS-layer Zustand store factory. Provides `createOsStore` (persistent) and `createVolatileOsStore` (non-persistent), with a built-in store registry (`resetAllOsStores()` / `snapshotOsStores()`) used by `__SIM__.reset()` and `__SIM__.getState()`. Pass `registerToServiceRegistry: false` to opt out of registration (e.g. OsStateStore, Providers)
- **`OsStateStore.ts`** — Unified Android data-model store, holding `settings` (global / system / secure / app-specific), `hardware` (battery / wifi / cellular / sensors), `permissions`, `preferences`. Persisted under the `os_state` localStorage key. `build` and `telephony` info are managed via overrides in `managers/registry.ts` (which also supports bench_env scenario injection)
- **Managers (`os/managers/`)** — `ConnectivityManager`, `BatteryManager`, `AudioManager`, `DisplayManager` are write facades over OsStateStore-specific domains; they encapsulate constraint logic (e.g., airplane mode cascade-disables Wi-Fi / BT / cellular, volume clamping, brightness range) and side effects (broadcast notifications). `managers/registry.ts` handles preference-key → Manager routing and build/telephony overrides
- **System Services** — **Persistence rule: data persists, UI / runtime state does not (refresh = restart)**. Apps must use OS services in place of native APIs: `Date.now()` → `TimeService`; `navigator.geolocation` → `LocationService`; `fetch` → `NetworkService` (`netJson` / `netFetch`). Services are accessed as sub-properties of `window.__OS__` (e.g. `__OS__.notifications`, `__OS__.keyboard`). `ClipboardService` is persistent; `NotificationService` / `KeyboardService` / `PermissionService` etc. are volatile
- **System Providers** — Shared data such as contacts / SMS / media lives in `os/providers/*Provider.ts`, persisted independently via `createOsStore` (`registerToServiceRegistry: false`, not part of the `os.services` snapshot); Apps access them through `ContentResolver.query / insert / update / delete`. `__SIM__.getState()` exposes Provider snapshots explicitly under `os.providers.*`

### Apps Layer (`apps/<AppName>/`, `system/<AppName>/`)

Each app follows a standard structure:

- **`manifest.ts`** — App identity (AndroidManifest-like): id, displayName, displayNameEn, aliases, icon, theme Tier-1 colors, `intentFilters` (deep links). **This is the only file needed to register an app with the OS**
- **`<AppName>App.tsx`** — Entry point with `MemoryRouter`, `useAppNavigationHandler` hook (registers navigator, back handler, and lifecycle events with the OS via `AppNavigatorRegistry` + `BackDispatcher` + `AppLifecycle`), and the "main tabs persistent + subpages exclusive" layout. **Must have `export default` — the OS discovers it via `import.meta.glob(['apps/*/*App.tsx', 'system/*/*App.tsx'])`**
- **`navigation.declaration.ts`** — Declarative navigation: all routes, transitions, actions, UI states. **Source of truth** for static analysis, graph generation, and task generation
- **`navigation.ts`** — Navigation hook (`useAppNavigate` with `go`/`back`). Supports `go(id, params, { mode, popTo, popToInclusive, state })`. **Business pages must NOT use `useNavigate()` directly**
- **`hooks/use<AppName>Gestures.ts`** — App-specific gesture hook wrapping `useTriggerGestures`
- **`context/<AppName>Context.tsx`** — State management via React Context; registers with `AppStateRegistry` on mount
- **`res/`** — App resources aligned with Android `res/values/*`:
  - `colors.ts`, `strings.ts`, `dimens.ts` (and optional `colors.states.ts`, `icons.tsx`)
- **`assets/`** — App-owned binary assets (images/icons/raw/fonts, etc.) loaded via Vite `import` (avoid `public/<appName>/...` URLs)
- **`types.ts`** — App-level types (standard location)
- **`constants.ts`** — Structural constants only (tabs, service grids, config flags). Resource-like constants should live in `res/`
- **`data/index.ts`** — Data entry point: merges constants + `defaults.json`, exports `<APPNAME>_CONFIG`
- **`data/defaults.json`** — Default data (users, content, history) as replaceable JSON
- **`pages/`** — Page components

### Benchmark Layer (`bench_env/`)

Python-based evaluation framework using Playwright. Tasks are organized into suites under `bench_env/task/<suite>/`, where a suite is a single App (`wechat/`, `alipay/`), a cross-app workflow (`crossapp_commerce/`, `crossapp_life/` ...), or a functional category (`payment/`, `launcher/`, `account/`). See `TASK_AUTHORING_GUIDE.md` §1.4 for the single-app vs cross-app suite distinction. The framework provides state-based judging, VLM evaluation, parameter sampling, and Pass@k statistics.

**Before authoring or modifying a task, you must read `bench_env/docs/task/TASK_AUTHORING_GUIDE.md` (authoring workflow), `bench_env/docs/task/TASK_CODE_SPEC.md` (hard code spec / CRUD judging rules), `bench_env/docs/task/TASK_TESTING_GUIDE.md` (offline testing spec), `bench_env/docs/task/GROUNDED_MODE.md` (grounded-mode answer sheet), and `bench_env/README.md`. `bench_env/docs/REFERENCE.md` is the canonical lookup table for CLI flags and `JudgeInput` / `JudgeResult` fields.**

### Scripts (`scripts/`)

- **`build_nav_artifacts.mjs`** — One-shot: consistency check + nav graph + action tasks
- **`check_navigation_declaration_consistency.mjs`** — Validates declaration-to-source-code consistency
- **`navigation_declaration_analyzer.mjs`** — Generates nav graph JSON (schema and data modes)
- **`generate_action_tasks_from_nav_graph.mjs`** — Enumerates action trajectories from nav graphs
- **`nav_path_finder.py`** — Shortest path search on nav graphs for verification
- **`ime/build_pinyin_dict.mjs`** — Generates IME pinyin dictionary from Rime dict sources
- **`lint_store_getters.mjs`** — Detects query getter functions in store actions and consumer subscriptions to them (violating the "Query-style getters in actions" rule in `docs/platform/state/model.md`). Usage: `node scripts/lint_store_getters.mjs [AppName...]`

## Key Development Rules

**The authoritative platform references live under `docs/platform/`** (`app/module-contract.md`, `state/model.md`, `navigation/declaration.md`, `os/overview.md`, `os/intent-system.md`, `os/cross-app-launch.md`, `os/services/README.md`, `android-mapping.md`). When conflicts arise, flag them rather than silently overriding. Before navigation/actions/condition changes, review `docs/platform/navigation/declaration.md`.

### Navigation

- Every app maintains `navigation.declaration.ts` with routes (including `uiStates`, `queryParams`, `scrollContainers`) and transitions
- All discrete UI state changes (tabs, modals, menus) must go through `go()` + URL update — never purely via React setState
- Main TabBar tabs use separate pathname routes (`/`, `/contacts`, `/me`), not query params
- Tab/subtab switching uses `mode: 'replace'`; modals/drawers use `mode: 'push'` (closed via `back()`)
- **Dialogs / popups are URL-driven by default** (matching Android's DialogFragment / Navigation dialog destination), unless the user explicitly asks otherwise:
  - Push them into the history stack via `searchParams` (e.g. `setSearchParams(p => { p.set('myDialog', 'open'); return p; })`), and derive dialog visibility from `searchParams.get('myDialog') === 'open'`
  - Close dialogs uniformly with `navigate(-1)` to pop the history entry; the system back key automatically pops the top of the stack to close the dialog — no extra handling needed
  - **Never control dialog visibility with `useState`** — the back key cannot see React local state and will pass through the dialog straight to the previous page
  - **Do not import `BackDispatcher` directly in the App layer** — it's an OS-internal module; Apps gain back-key support indirectly via the URL + navigation stack
- Business pages must never use `useNavigate()`/`navigate()` directly — only the app's `go()`/`back()`
- New route paths must be registered in the app's `<Routes>` in `<AppName>App.tsx`

### Adding a New App

Adding an App **requires no changes to any OS-layer file**. The OS auto-discovers via `import.meta.glob`. Third-party Apps go under `apps/`, system apps under `system/`. You only need:

1. **`apps/<AppDir>/manifest.ts`** or **`system/<AppDir>/manifest.ts`** — must `export const manifest: AppManifest`, declaring `id`, `displayName`, `displayNameEn`, icon, theme, etc.
2. **`apps/<AppDir>/<Name>App.tsx`** or **`system/<AppDir>/<Name>App.tsx`** — entry component; filename must match `*App.tsx`, and **must `export default`**
3. **`apps/<AppDir>/state.ts`** / **`system/<AppDir>/state.ts`** (optional) — Zustand store, auto-registered via `import.meta.glob(['./apps/*/state.ts', './system/*/state.ts'])`

Convention details:

- `manifest.id` is the `appId` (e.g. `'wechat'`) and also the localStorage key
- `displayNameEn` is auto-injected into the OS i18n dictionary (`patchAppNames`); no need to edit `os/i18n/en.ts`
- The `aliases` array is auto-injected into the system-app alias map (e.g. `['通讯录', '联系人']`); no need to edit OS-layer files
- The directory name (e.g. `Wechat`) does not have to match the `appId` (e.g. `'wechat'`) — the OS builds the mapping automatically from the manifest path

### DOM Tagging

- All navigation triggers must produce `data-trigger` + `data-trigger-type` attributes via gesture hooks
- All action triggers must produce `data-action` + `data-action-type` attributes
- Transition/Action IDs must be **string literals** at bind sites (no dynamic concatenation/variables)
- Return/close buttons must use `bindBack()` (`system.back`), not custom transitions
- Only tag controls that actually do something — no tags on unimplemented placeholders
- Scrollable containers need `data-scroll-container` + `data-scroll-direction` attributes matching `scrollContainers` declarations

### State and Data

> **The full state-and-data-layer spec lives in [`docs/platform/state/model.md`](docs/platform/state/model.md)** (settings naming, nested structure, data-layering criteria, store action patterns, and bench_env path conventions are all there).

- Config-first: constants in `constants.ts`, default data in `data/defaults.json`, unified export via `data/index.ts` as `<APPNAME>_CONFIG`
- localStorage key must exactly match `manifest.id` (i.e. `appId`)
- **No form of `new Date(...)` or bare `Date.now()` is allowed** — go through `TimeService`:
  - `TimeService.now()` / `TimeService.getDate()` — **simulated time**: on-screen clocks, data timestamps, benchmark state checks
  - `TimeService.realNow()` — **real wall-clock time**: debouncing, animations, gesture detection, cache TTLs, and anywhere you're measuring real physical elapsed time
  - `TimeService.fromTimestamp(ts)` — replaces `new Date(timestamp)`
  - `TimeService.fromLocalParts(year, month, day, ...)` — replaces `new Date(year, month, day, ...)`
  - `TimeService.parseToTimestamp(str)` — parses a date string into a timestamp (pair it with `fromTimestamp` to replace `new Date(dateString)`)
- Use `LocationService` instead of `navigator.geolocation`
- Use `NetworkService` (`netJson`/`netFetch`) for HTTP requests to avoid CORS
- **Do not define query-style getters inside store actions** (`isLiked`, `isFollowing`, `getXxxById`, etc.), and **do not have components subscribe to store function references** — Zustand function references are stable after creation, `Object.is` is always true, so the component never re-renders. The right approach: **subscribe to data directly** in the component (`s.likedPostIds`) and derive booleans via `.includes()` / `Set.has()`; or use `memoSelector` to build a derived selector (e.g. `selectLikedSongIds` returning a `Set`). Wrapping a getter in `useShallow` + `useMemo` does not work either.

### UI

- Every page must reserve status bar space at top with `pt-10`
- Pages should explicitly declare `data-status-bar-foreground="dark|light"` on the outermost page container when the chrome foreground is not the default dark text; the OS no longer does DOM-based auto-detection fallback
- When bottom gesture bar foreground differs from the status bar, explicitly declare `data-navigation-bar-foreground="dark|light"`; GestureBar reads declarative/manifest signals only
- Keyboard-attached UI (chat input bars, send buttons) needs `data-keep-keyboard="true"`
- OS implements `adjustResize`: keyboard shrinks the Activity container automatically. Form pages need no extra handling
- **Drag / swipe / slider / any follow-the-finger continuous interaction must use `PointerEvent`** (`onPointerDown / onPointerMove / onPointerUp / onPointerCancel`, with `setPointerCapture` where needed); **do not** maintain parallel `touch*` and `mouse*` logic, and **do not** use `touchmove + click` as a fallback for mouse dragging
- **Chat pages and bottom action bars must not use `position: fixed`** — use a flex layout (`flex-shrink-0`) and let adjustResize handle it. `position: fixed + bottom: keyboardHeight` causes the keyboard to cover the input box in Apps that use `designViewportWidth` (CSS zoom), because zoom scales CSS pixels and offsets fixed positioning
- **Hide elements when the keyboard is open**: add the `data-hide-on-keyboard` attribute to the element; the OS hides it automatically (via `data-keyboard-active` on the `data-adjust-resize` container plus a global CSS `display:none` rule). Typical case: a bottom TabBar should not be pushed up by the keyboard — adding this attribute hides it automatically

### Validation

After modifying navigation declarations or adding pages, always run:

```bash
node scripts/build_nav_artifacts.mjs <AppName>
```

If the output has `ERROR` or `WARN`, include the specific IDs and file locations — not just summary counts.

---

## App File Architecture — Strict Boundaries

Each file has one responsibility. Violating boundaries makes maintenance painful and the codebase progressively messier. The rules below are **enforced**.

### `constants.ts` — Structural configuration

Constants of the following kinds belong here:

- Tab definitions (id, route, label, icon component ref)
- Service / feature catalogs (id, name, icon, color) — fixed app structure, not user-editable
- Layout parameters (grid columns count, visible item count)
- Feature flags

**Do not include:**

- User data (account info, messages, bill records) → `data/defaults.json`
- **Raw Lucide icon names** (e.g. `"CreditCard"`, `"Bus"`) → must use the `Ic*` alias (`"IcCard"`, `"IcBus"`)

### `data/defaults.json` — Replaceable initial state

**Must contain:**

- User info (name, avatar, phone, balance)
- Content data (chat history, bill stream, posts, history)
- User-configurable layout (service-ID list shown on the home page, ordering)
- User settings (language, theme, notification prefs)

**Must not contain:**

- Static attributes of services / features (icon, color, label) → these are fixed; they belong in `constants.ts`
- Raw icon-name strings — if they must appear (data-driven rendering), use the `Ic*` prefix

### `res/colors.ts` — Special colors (optional)

`colors.ts` is only needed in these cases:

- Special colors that Tailwind cannot express (brand colors, gradients, etc.)
- Component colors that need dark-mode awareness

**Don't bother extracting:**

- Standard Tailwind colors → just use `text-gray-800 bg-white`
- One-off colors → just inline `bg-[#FF7D00]`

### `res/dimens.ts` — Key dimensions (optional)

**Only dimensions reused in multiple places** (e.g. list-item height, avatar size) should be extracted into `dimens.ts`.

**Don't bother extracting:**

- One-off sizes → inline a Tailwind class or `style`
- Icon size → hard-code `size={22}`
- Spacing / radii / font sizes → use Tailwind classes like `p-4 rounded-lg text-sm`

#### ⚠️ JS pixel calculations must use CSS vars, not Tailwind `rem` classes

When JS does pixel math against an element's height (e.g. `scrollTop = index * itemHeight`), that element's height **must** use a CSS var (`h-(--app-xxx)`) or an arbitrary pixel value (`h-[Npx]`). **Do not** use rem-based classes like `h-10 / h-14` — the browser default font size is not 16px in this environment, so rem-derived heights and JS-hardcoded pixel values accumulate drift.

### `res/icons.tsx` — Icon definitions

**Rules:**

1. All icon aliases start with the `Ic` prefix (`IcCard`, `IcBus`, `IcNavBack`)
2. `ICON_REGISTRY` keys must match the export names exactly (all `Ic`-prefixed)
3. **Do not** add raw Lucide names to `ICON_REGISTRY` as a workaround — fix the data layer instead (change the strings in `constants.ts` / `defaults.json`)
4. Only import the icons the app actually uses

### Icon usage

| Scenario                     | Correct usage                                   |
| ---------------------------- | ----------------------------------------------- |
| Fixed icon in JSX            | `<IcCard size={22} />`                        |
| Data-driven (from map/JSON)  | `<IconRenderer name={item.icon} size={22} />` |
| Icon name inside a data file | `"IcCard"` (must use the `Ic*` prefix)      |

> **The full App module contract (resource spec, icons, theming, cross-cutting rules) is in [`docs/platform/app/module-contract.md`](docs/platform/app/module-contract.md).**

---

## Screenshot-driven development workflow

**This section applies only when the user supplies a screenshot and asks you to replicate it or to build a new App page** — e.g. "implement this page from the screenshot", "replicate page X from app Y", or just a screenshot with "build this". For everything else, follow the general rules above; do not force this workflow onto unrelated tasks.

### 0. Missing-information handling (do this first)

If the screenshot / requirements are insufficient to infer any of the following, **ask before writing code** — do not extrapolate or invent requirements:

- Target `AppName` and `routePath` (pathname template)
- Whether there are discrete UI states like tab / modal / menu / select (must land in `uiStates`)
- Entries that need parameter differentiation (Tab target value, list-item id, etc.; determines `data-trigger-params` / `data-action-params`)
- Whether the entry is a **transition** (changes URL) or an **action** (does not change URL)
- pathname naming must align with existing repo conventions ("我" / "Me" is always `/me`, "探索" / "Explore" is `/explore`, etc.); when the screenshot only has Chinese copy, agree on the English token with the user before writing

### 1. Reading the screenshot (before touching code)

After receiving a screenshot, the first step is to **describe its contents in detail in words** to confirm you understand it correctly — only then start implementing:

- Describe the layout structure (top bar / body / bottom TabBar / FAB, etc.)
- Describe what each region does (list, form, chat, settings, …)
- Describe the interactive controls (buttons / inputs / switches / list items) and their expected behaviour (navigate, open modal, change state)
- Identify elements that need parameterising (each list item's id, each tab's target)

When there are multiple screenshots, first describe how they relate (different states of the same page? adjacent pages? a popup?), then decide the `uiStates` / subroute split.

The implemented page should match the screenshot (layout, styling, visual hierarchy); business data (contacts, message contents, orders) does not need word-for-word fidelity, but the **presentation logic must match**.

### 2. Implementation order

Land code in this order to avoid declaration / source drift:

1. `navigation.declaration.ts` — declare the new routes, `uiStates`, transitions, actions
2. `<Routes>` in `<AppName>App.tsx` — register the route components
3. `data/defaults.json` / `state.ts` — prepare the replaceable default data / runtime state
4. `pages/` — implement the UI; use the app's own `go()` / `back()` and the gesture hooks
5. Run `node scripts/build_nav_artifacts.mjs <AppName>` once and confirm no ERROR / WARN
6. If you modified an existing App, confirm that the state paths referenced by `bench_env` are not broken

For the syntactic rules (`uiStates` required, `transitions[].to` required, `from:'*'` constraints, `.switch` + `cases`, ID literal binding, the `{ id: '...' }` configuration constraints for shared components, when `data-trigger-params` is required, etc.) see [`docs/platform/navigation/declaration.md`](docs/platform/navigation/declaration.md) and [`docs/platform/navigation/actions.md`](docs/platform/navigation/actions.md).

### 3. Required output format

Your reply to the user must include:

- **Change summary** — which elements and interactions from the screenshot you implemented
- **Files touched** — one sentence per file describing what changed
- **New / modified IDs** — the list of transitionId / actionId
- **Self-check verdict** — whether `build_nav_artifacts.mjs` passed; if there are WARN / ERROR, list specific IDs + file:line (the top 5–10 is enough) and explain how to fix them

Do not just paste summary counts; ERROR / WARN must come with details.
