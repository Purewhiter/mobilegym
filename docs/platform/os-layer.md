# OS Layer

The `os/` directory is the simulated Android operating system that hosts every app. It owns the launcher, the task and activity stacks, the back key, the keyboard, intent routing, notifications, content providers, and the system services apps consume in place of native browser APIs.

> 🪐 **Mental model.** The OS is the substrate. Apps don't talk to each other directly — they post Intents, register receivers, read from providers. Refresh the browser and you reboot the device: persisted data survives, runtime state resets.

## Top-level layout

```
os/
├── OSContext.tsx                # Thin React Provider — exposes window.__SIM__ / __OS__
├── SystemShell.tsx              # Launcher, status bar, recents, gesture surface, app container
├── TaskManager.ts               # Task and Activity stacks (volatile)
├── BackDispatcher.ts            # Priority-based back-key dispatch
├── IntentResolver.ts            # Intent matching, choosers, startActivityForResult
├── AppNavigatorRegistry.ts      # Where each running app's navigator registers itself
├── AppLifecycle.ts              # onResume / onPause / onForeground / onBackground hooks
├── AppStateRegistry.ts          # Snapshot collector for __SIM__.getState()
├── AgentBridge.ts               # Maps natural-language app names to appIds
├── ContentProvider.ts           # ContentResolver-style query/insert/update/delete framework
├── ContentResolver.ts
├── BroadcastBus.ts              # Inter-app broadcast bus
├── OsStateStore.ts              # Unified Android-style data model (settings/hardware/perms/…)
├── createOsStore.ts             # Zustand factory: persisted + volatile + registry hook
├── managers/                    # Write facades: Connectivity, Battery, Audio, Display
├── providers/                   # Shared content data: Contacts, SMS, Media
├── keyboard/                    # KeyboardService + IME
├── i18n/                        # Locale & string-table machinery
├── data/                        # OS defaults (settings, hardware, contacts, etc.)
├── types/globals.d.ts           # The full window.__SIM__ / __OS__ TypeScript surface
└── (top-level service files)    # TimeService.ts, LocationService.ts, NetworkService.ts,
                                 #   ClipboardService.ts, NotificationService.ts,
                                 #   FileSystemService.ts, MediaService.ts, AIService.ts, …
```

Everything else (`apps/`, `system/`, `bench_env/`) talks to the OS through these modules. Apps never reach into `os/` internals beyond the documented hooks and globals.

## The big picture

```
                      Browser (one Vite bundle)
┌─────────────────────────────────────────────────────────────────────┐
│ window.__SIM__  /  window.__OS__  /  window.__SIM_INPUT__  /  …     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────┐
│ OSContext  ─►  SystemShell (launcher · status bar · recents)        │
│      │                                                              │
│      ├── TaskManager       (task + activity stacks · volatile)      │
│      ├── BackDispatcher    (priority chain · frame-deduped)         │
│      ├── IntentResolver    (action + scheme + type → app/route)     │
│      ├── AppLifecycle      (onResume / onPause broadcast)           │
│      ├── AppNavigatorRegistry (per-app navigate handle)             │
│      ├── OsStateStore + managers   (persisted Android data model)   │
│      ├── providers/        (contacts · sms · media — shared data)   │
│      └── services/         (Time · Location · Network · Clipboard · │
│                             Notification · Keyboard · FileSystem)   │
└─────────────────────────────────────────────────────────────────────┘
```

The OS layer is **not Android byte-for-byte**. It's a behavioral model: realistic enough that an agent trained against it transfers to a real phone (the paper validates this), small enough to fit in a browser tab.

## Tasks and Activities

A **Task** is a chain of one or more Activities the user backed into in order — same concept as AOSP. A **launcher tap** creates a Task. Tapping again on a backgrounded app reactivates its existing Task. The recents surface shows one entry per Task.

```ts
type Task = {
  taskId: string;
  rootAppId: AppId;
  stack: ActivityInstance[];          // top = currently visible Activity
  launchedByTaskId?: string;          // who started us via startActivity (1-shot pointer)
  wasExternallyRouted?: boolean;      // openApp(id, route) flagged this Task at creation
};

type ActivityInstance = {
  activityId: string;
  appId: AppId;
  route: string;                      // MemoryRouter location at last sync
};
```

Key TaskManager actions:

| Operation | What happens |
|---|---|
| `LAUNCH_APP` | Create a new Task (or reactivate one) and push its root Activity. Tracks `launchedByTaskId` when the caller was not the launcher. |
| `PUSH_ACTIVITY` | Push a new Activity onto the **current** Task's stack — used by `startActivity({ newTask: false })` and by the OS when `openApp` pushes onto an existing Task. |
| `POP_ACTIVITY` | Pop the top Activity. If `stack.length > 1`, pops within the Task; if `1`, closes the Task and activates `launchedByTaskId` (caller-return). |
| `MARK_EXTERNAL_ROUTE` | Set `wasExternallyRouted` so the back chain knows the Task didn't originate at the launcher. |
| `consumeLaunchedBy` | One-shot clear of `launchedByTaskId` after a caller-return back. |

The store is **volatile**: `createVolatileOsStore` keeps it in memory only, so refreshing the browser is a full reboot. Persistent data lives in `OsStateStore` and the providers, both of which use `createOsStore` (persisted to localStorage).

### Lifecycle

Apps stay **mounted while backgrounded** — the SystemShell hides them with `display:none` so React state survives. `AppLifecycle` fires `onResume` / `onPause` / `onForeground` / `onBackground` events so apps can pause timers, refresh data on resume, etc.

## Back-key dispatch

`BackDispatcher.handleBack()` walks a priority chain. The first handler to return `true` consumes the event; otherwise the chain falls through to the launcher fallback.

```
priority (high → low):
  PermissionDialog (1000)
  SystemShade      (800)
  Keyboard         (700)
  IntentChooser    (900)        ← context-conditional, not always above 700
  MediaPicker      (600)
  App back         (100)        ← app's own go() / back() handler
  Activity back     (50)        ← OS pops one Activity if stack > 1
  finishTopActivity (25)
  os.returnToLauncherTask (12)  ← caller-return: reactivate launchedByTaskId, reset app to /
  os.goHomeFallback   (0)       ← last resort: just go home, keep Task alive
```

Registration is via `BackDispatcher.register(id, handler, priority)`. Frame-level deduplication (`_backLock`) prevents an edge-swipe and a backdrop click from double-firing in the same frame.

> 🚫 **Apps must not import `BackDispatcher` directly.** Use the URL/history stack instead — push search params for dialogs, call your app's `go()` for navigation. The hook `useAppNavigationHandler` (which every app uses for routing) registers an app-level back handler at priority `100` on your behalf.

### Returning vs. destroying

Two priority-low handlers explicitly **do not** destroy the Task — they match Android's default of keeping Tasks in recents:

- `os.returnToLauncherTask` (priority 12) — when the current Task has only one Activity and was launched-by another Task, reset the app's MemoryRouter to `/`, reactivate the caller Task, and consume the one-shot pointer.
- `os.goHomeFallback` (priority 0) — reset the current app to `/` and `goHome()`, leaving the Task on the recents.

Task destruction is opt-in (e.g. `__OS__.closeApp(id)`).

## Intent system

`IntentResolver` matches a posted intent (`action`, `scheme`, `type`, optional explicit `appId`) against each app's manifest filters. Multiple matches yield an in-OS chooser sheet; single matches dispatch directly.

`startActivityForResult(intent)` returns a `Promise<Result>` resolved when the callee finishes — used for media-picker flows, payment confirmation, contact selection, etc.

Full reference: [`intent-system.md`](intent-system.md).

## OsStateStore + managers + providers

A unified Android-style data model lives in `OsStateStore.ts`. The shape:

```ts
type OsState = {
  settings: {
    global:   {…};   // affects all apps — wifi, bluetooth, language
    system:   {…};   // device-wide UI — brightness, volume, font size
    secure:   {…};   // permissions-adjacent — biometric prefs
    apps:     {…};   // app-scoped settings keyed by appId
  };
  hardware: {
    battery:   {…};
    wifi:      {…};
    cellular:  {…};
    sensors:   {…};
  };
  permissions: { [appId: string]: { [perm: string]: 'granted' | 'denied' } };
  preferences: {…};
};
```

This is persisted at the `os_state` localStorage key.

**Managers** (`os/managers/*Manager.ts`) are write facades. `setPreference('display.brightness', 80)` flows through `DisplayManager` which clamps to the valid range and pushes a broadcast notification. Turning on airplane mode cascades wifi/bluetooth/cellular off via `ConnectivityManager`. The point of going through managers (rather than calling `setState` directly) is that the constraint logic is centralized.

**Providers** (`os/providers/*Provider.ts`) hold **shared content data** — the things that an Android `ContentResolver` would query: contacts, SMS, media. Each provider is its own persisted store. Apps consume them via `ContentResolver.query / insert / update / delete` rather than reaching into the store directly. Providers are deliberately **not** part of the OS `services` snapshot — they're surfaced under `state.os.providers.*` in `__SIM__.getState()`.

## OS-level services

Service singletons live at the top of `os/` (not in a subdirectory). They give apps a deterministic, persistable replacement for native browser APIs:

| Service file | Purpose | App-visible API surface |
|---|---|---|
| `TimeService.ts` | Simulated wall clock; benchmark control over "now" | `TimeService.now()` / `.realNow()` / `.fromTimestamp(ms)` |
| `LocationService.ts` | Simulated GPS, with preset cities + error simulation | `LocationService.getCoords()` |
| `NetworkService.ts` | CORS-safe HTTP gateway with per-session cookie jar | `netFetch(url)` / `netJson(url)` / `netText(url)` |
| `ClipboardService.ts` | Persisted clipboard | `read()` / `write(item)` |
| `NotificationService.ts` | Volatile notification queue | `push({title, body, …})` / `dismiss(id)` |
| `FileSystemService.ts` | Virtual filesystem with paths under `/sdcard/…` | `read(path)` / `write(path, blob)` |
| `MediaService.ts` | Audio/video playback, intent integration | `play(uri)` / `pause()` |
| `AIService.ts` | Optional AI features (summarization, etc.) | feature-specific |

A non-exhaustive set is documented in detail in [`os-services.md`](os-services.md). The full `__OS__.<name>` surface lives in `os/types/globals.d.ts`.

> ⚠️ Apps **must** use these services rather than calling browser APIs. The ESLint rules reject raw `Date.now()`, `new Date()`, `navigator.geolocation`, and `navigator.clipboard`. `fetch` is allowed only for same-origin URLs; absolute URLs go through `NetworkService` to dodge CORS and have their cookies survive resets.

## Globals: what apps and the benchmark see

The OSContext Provider attaches these to `window` at startup:

| Global | Lives in | Purpose |
|---|---|---|
| `window.__SIM__` | `os/types/globals.d.ts` | Simulator-level: `getState()`, `setState(patch)`, `reset()`, `resetState()`, `preloadAllAppStores()`, `preloadAppStores(appIds)`, `warmUpAllApps()` |
| `window.__OS__` | same | Per-feature OS handles: `openApp / closeApp / launchApp / handleBack / goHome / showRecents / getAppRoute` plus the services (`notifications`, `permissions`, `keyboard`, `device`, `clipboard`, `broadcast`, …) |
| `window.__SIM_INPUT__` | `os/simInput.ts` | Synthetic gestures used by the benchmark and human debugging — tap, doubleTap, longPress, swipe, type, back, home. |
| `window.__SIM_QUERY__` | `os/simInput.ts` (alongside `__SIM_INPUT__`) | Read-only DOM queries: `getRectById / getRectBySelector / getRectByTrigger` |
| `window.__SIM_TIME__` | `os/TimeService.ts` | Wall-clock override for reproducible runs |
| `window.__SIM_LOCATION__` | `os/LocationService.ts` | GPS override with preset cities |
| `window.__SIM_FS__` | `os/FileSystemService.ts` | Virtual filesystem control |
| `window.__getScrollMeta__` | `os/SystemShell.tsx` | Auto-detect scrollable containers and read their position/extent |

These are **debug / orchestration** APIs, not part of the agent's observation. The agent sees screenshots; everything above is for you, the human operator (or the benchmark).

Full reference with method signatures: [`../api/runtime-api.md`](../api/runtime-api.md).

## Auto-discovery

The OS finds installed apps at **compile time** via `import.meta.glob`:

```ts
// os/data/appRegistry.tsx
const manifests = import.meta.glob('../../apps/*/manifest.ts',  { eager: true });
const entries   = import.meta.glob('../../apps/*/*App.tsx',     { eager: true });
// (same for system/* )
```

That's why adding an app needs no edits anywhere in `os/`. The conventions every app must satisfy are in [`app-module-contract.md`](app-module-contract.md).

## Persistence model

```
localStorage key                   Contents                              Persisted?
─────────────────────────────────  ─────────────────────────────────     ──────────
os_state                           OsStateStore (settings/hardware/…)    yes
<appId>                            app's Zustand store (per-app)         yes (via persist)
contacts, sms, media               per-provider stores                   yes (via persist)
clipboard                          ClipboardService                       yes
(in-memory only)                   TaskManager, NotificationService,     no — reboot
                                    KeyboardService, PermissionService,
                                    SystemShadeService, LocationService
```

The rule of thumb: **content data is persisted, runtime/UI/session is volatile**. Browser refresh = device reboot. This is what makes `__SIM__.reset()` cheap and deterministic.

## Adding new OS plumbing (briefly)

You'll rarely need to. If you do:

- **New service** — drop a TS file in `os/` (top level), expose its API on `window.__OS__.<service>` via the OSContext provider, and add the TypeScript surface to `os/types/globals.d.ts`. Use `createOsStore` if it needs persistence, `createVolatileOsStore` otherwise.
- **New manager** — file in `os/managers/`, wire it into `OsStateStore` writes and `managers/registry.ts` for preference routing.
- **New provider** — file in `os/providers/`, persist its own store, expose via `ContentResolver` queries. Add a `state.os.providers.<name>` entry to `AppStateRegistry`.

For all three, follow what the existing examples do — the framework is small, and copying patterns is faster than reading more docs.

## Where to go next

- 📱 How an app integrates with all of this → [`app-module-contract.md`](app-module-contract.md)
- 🗃️ How state is layered and snapshotted → [`state-model.md`](state-model.md)
- 🎯 Cross-app calls and Intent matching → [`intent-system.md`](intent-system.md)
- 🛰️ What each service actually does → [`os-services.md`](os-services.md)
- 🤖 The view from Android — which AOSP concepts we model, which we don't → [`android-mapping.md`](android-mapping.md)
