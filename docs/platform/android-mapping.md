# Android Mapping

MobileGym is a **behavioral** model of Android — close enough that agents trained against it transfer to a real phone, simple enough to fit in a browser tab. This document is the translation table: which AOSP concepts we model, which we simplify, which we don't model at all.

The paper validates this with a Sim-to-Real case study: 95.1% of an in-simulator training gain transfers to a Redmi Note 12 Turbo running real apps. That number is the empirical answer to "is this close enough."

## At a glance

| AOSP concept | MobileGym | Notes |
|---|---|---|
| ActivityManager | `os/TaskManager.ts` | Task & Activity stacks; volatile |
| Activity | An MemoryRouter route (one "Activity" = one app, multiple routes inside) | We model 1 app = 1 OS Activity. Internal routing is via React Router. |
| Application | The App's exported `<Name>App.tsx` + Zustand store | No explicit `Application` class |
| AndroidManifest.xml | `apps/<App>/manifest.ts` | Same role, TS schema |
| `<intent-filter>` | `manifest.intentFilters[]` | Same matching rules (action + type + scheme) |
| `<queries>` | `manifest.queries[]` | Declares outbound intent surface |
| launchMode (Activity-level) | `intentFilters[].launchMode` at filter level | Only `'standard'` and `'singleTask'` modeled |
| Intent | `{ action, type, scheme, route, extras }` | Same shape, slightly different field names |
| IntentResolver | `os/IntentResolver.ts` | Same role; in-OS chooser sheet for multiple matches |
| Back key | `os/BackDispatcher.ts` priority chain | Frame-deduped, priority-ordered |
| Home gesture | `__OS__.goHome()` | Doesn't destroy Tasks by default |
| Recents | `__OS__.showRecents()` | Tasks persist in recents |
| Settings.Global | `os.settings.global` | WiFi, Bluetooth, language, mobile-data |
| Settings.System | `os.settings.system` | Brightness, volume, font scale |
| Settings.Secure | `os.settings.secure` | Biometric prefs, screen lock policy |
| Hardware state | `os.hardware` | Battery, WiFi RSSI, sensors |
| Permissions | `os.permissions[appId][perm]` | Granted / denied / prompt |
| ContentProvider | `os/providers/*` + `ContentResolver` | Same `query/insert/update/delete` |
| BroadcastReceiver | `__OS__.broadcast.registerReceiver` | Same fire-and-forget |
| Sticky broadcasts | Use OsStateStore directly | Not modeled |
| Notification | `__OS__.notifications.push(...)` | Volatile; reset on browser refresh |
| Clipboard | `ClipboardService` | Persisted |
| TimeService | `TimeService` + `__SIM_TIME__` | Simulated wall clock, deterministic override |
| LocationManager | `LocationService` + `__SIM_LOCATION__` | Simulated GPS, preset cities, error simulation |
| HttpClient / OkHttp | `NetworkService` (`netFetch / netJson / netText`) | CORS gateway with per-session cookie jar |
| Keyboard / IME | `KeyboardService` | adjustResize built into the OS shell |
| Display metrics | `DisplayManager` + `manifest.designViewportWidth` | CSS zoom anchor per app |
| Build / Telephony | `managers/registry.ts` overrides | Injectable for scenarios |

## Where we simplify

### 1 app = 1 OS Activity

AOSP allows multiple Activities per Application — `LoginActivity`, `MainActivity`, `SettingsActivity`. MobileGym models **one Activity per app**; navigation within an app is React Router under that single Activity.

Implication: AOSP's per-Activity `launchMode`, `taskAffinity`, and `noHistory` don't apply at the route level. We model the equivalent at the **intent filter** level: a filter can declare `launchMode: 'singleTask'`, meaning "if my app's Task already exists when this intent arrives, route to the existing instance."

Most apps don't need this. The ones that do (entry points that should be singletons — the WeChat home page, the launcher itself) declare it on their primary intent filter.

### No process isolation

Every app runs in the same JavaScript process. There's no IPC overhead; everything shares the OSContext provider tree. The cost is that one runaway app can affect others — the framework mitigates with React error boundaries, but it's still fundamentally single-process.

For benchmark purposes this is a win — snapshots are cheap, cross-app state inspection is direct.

### Foreground / background only (no explicit lifecycle granularity)

AOSP has `onCreate / onStart / onResume / onPause / onStop / onDestroy`. We collapse to `onForeground / onBackground / onPause / onResume` via `AppLifecycle`. Apps stay mounted when backgrounded (hidden via `display:none`), so `onDestroy` is just `closeApp` calling unmount.

Implication: any AOSP behavior that depends on `onCreate` running again (e.g. re-fetching data on Activity recreation) needs to listen for `onResume` instead.

### Permissions are declared, not requested per Activity

`manifest.ts` doesn't have `<uses-permission>` like AOSP — permissions are managed runtime-side by `PermissionService`. Apps that need permission call `requestPermissions(appId, [...])`; the OS shows a dialog and persists the response. There's no compile-time enforcement that you've declared the permission you're asking for — that's a fix-on-our-side roadmap item.

### Single back-key dispatch (no per-Fragment handling)

AOSP has Fragments which can register their own back handling. We don't have Fragments (the equivalent is React components mounted within an Activity's route tree). The OS-level `BackDispatcher` is the only chain; apps register one handler at priority 100 and use the URL to drive dialog/sheet state.

If you have a fragment-style nested back behavior, push a search-param entry when entering the inner state; pop it on back. The history stack does the work.

### Notification channels

We don't model AOSP's notification channel system (with importance levels per channel). Notifications take a per-call `importance` field but there's no channel registration; per-app filtering happens in the notification settings (`os.settings.apps[appId].notifications.*`), not via channel IDs.

### Sticky broadcasts

AOSP's sticky broadcasts (a broadcast that the OS retains so newly-registered receivers see the latest value) aren't supported. The simpler replacement: stash the value in `OsStateStore`, and have receivers read both the broadcast and the store. Workable for our scope.

### No file storage with permissions

`FileSystemService` is a flat virtual FS rooted at `/sdcard/...`. We don't model app-scoped storage (each app having its own private storage area inaccessible to others); files are shared across apps. For our research focus this is fine — agents don't usually need cross-app file isolation.

## Where we extend AOSP

Some MobileGym features have no direct AOSP analog. Worth knowing if you're carrying over expectations:

| MobileGym feature | What it's for |
|---|---|
| `__SIM__.setState(patch)` | Inject arbitrary state for benchmark scenarios. Real Android has no equivalent. |
| `__SIM__.getState()` | Serialize the whole device to JSON for snapshots and judging. |
| `__SIM__.reset()` | Factory reset in one call. AOSP has the same conceptually; we make it a method. |
| `__SIM_TIME__.setSimulatedTime(...)` | Override wall clock for reproducibility. AOSP requires emulator-level games. |
| `__SIM_LOCATION__.setSimulatedLocation(...)` | Override GPS deterministically. AOSP allows mock locations but they're real apps' choice. |
| Static UI graph (`scripts/build_nav_artifacts.mjs`) | Compile-time enumeration of every route, transition, action. AOSP has no equivalent. |
| Foreign-task isolation | When app B is pushed onto app A's task (cross-app result picker), B's app-level registrations are skipped to avoid clashing with B's own task. Pure MobileGym mechanism. |

## When the model matters

For most agent training work, the abstractions above are right where they need to be. The places where the difference shows up:

- **Apps that depend on Activity lifecycle granularity.** If your app expects `onCreate` to re-run on certain transitions, model it on `onResume` instead.
- **Apps that rely on Application class state.** Use the per-app Zustand store; that's our equivalent.
- **Apps that need cross-process IPC.** We're single-process; share via the OsStateStore or providers.
- **Tasks that probe Android version-specific behavior** (e.g. scoped storage, runtime permissions on Android 6+). We pick one model; AOSP version differences aren't modeled.

The paper's Sim-to-Real number (95.1% retention) is the empirical bound: most agent behavior generalizes; behavior that depends on the unmodeled distinctions above doesn't.

## Where to go next

- 🧠 The OS internals → [`os-layer.md`](os-layer.md)
- 🎯 The intent system in detail → [`intent-system.md`](intent-system.md)
- 🛰️ The OS services Apps consume → [`os-services.md`](os-services.md)
- 🗃️ Snapshot and state model → [`state-model.md`](state-model.md)
- 📄 The paper — Sim-to-Real validation, transferred capability classes → see the README's link
