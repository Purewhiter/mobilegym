# Browser Runtime API

When the simulator is running, it exposes a set of globals on `window` for debugging, scripting, and benchmark orchestration. **The agent never sees these** — they're for the human operator, task author, or benchmark runner.

The available namespaces:

| Namespace | Purpose |
|---|---|
| `window.__SIM__` | State snapshot, reset, simulator-level controls |
| `window.__OS__` | OS-level controls (open app, back, services) |
| `window.__SIM_INPUT__` | Synthesized human-style input (tap, swipe, type, …) |
| `window.__SIM_QUERY__` | Read-only DOM queries (find an element's rect by id / selector / trigger) |
| `window.__SIM_TIME__` | Simulated wall-clock control |
| `window.__SIM_LOCATION__` | Simulated geolocation control |

You can open the browser DevTools and call any of these directly. The benchmark calls them via Playwright's `evaluate()`.

## `__SIM__` — simulator state

### `__SIM__.getState()`

Returns the entire structured state of the simulator as a JSON-serializable object.

```js
const state = window.__SIM__.getState();
// → { os: {...}, apps: { wechat: {...}, alipay: {...}, ... } }
```

This is the **only** state the benchmark trusts for judging. The shape per app is documented in [../os-services/APP_STATE_API.md](../os-services/APP_STATE_API.md). Key trees:

- `state.os.settings` — `global` / `system` / `secure` / app-specific
- `state.os.hardware` — battery, wifi, cellular, sensors
- `state.os.permissions` / `preferences`
- `state.os.providers` — contacts, sms, media (shared content)
- `state.os.services` — clipboard and other persisted services
- `state.apps.<appId>` — each app's runtime overlay

### `__SIM__.reset()`

Clears all simulator state (localStorage + in-memory stores) and reloads the page.

```js
await window.__SIM__.reset();
```

There is also `__SIM__.resetState()` which clears state without reloading — useful when the harness has already snapshotted the tab.

### `__SIM__.setState(patch, options?)`

Merges a partial state into the live simulator. Use this to inject task-initial conditions.

```js
await window.__SIM__.setState({ apps: { wechat: { user: { id: 'u_42' } } } });
await window.__SIM__.setState(snapshot, { deep: true, reload: true });
```

### `__SIM__.preloadAllAppStores()` / `__SIM__.preloadAppStores(appIds)` / `__SIM__.warmUpAllApps()`

`preloadAllAppStores()` (no args) waits until *every* app's Zustand store has finished its initial async hydration. `preloadAppStores(appIds)` does the same for a specific subset. In current builds these are effectively no-ops (stores are eagerly loaded), but call them in benchmarks anyway — future builds may reintroduce lazy hydration.

`warmUpAllApps()` additionally mounts each app once so its first render cost is paid up front; this is slower and usually unnecessary.

## `__OS__` — OS controls

### App lifecycle

```js
window.__OS__.openApp('wechat');                    // open with current route
window.__OS__.openApp('wechat', '/chat?tab=hot');   // open at a specific deep link
window.__OS__.closeApp('wechat');                   // kill the task
window.__OS__.launchApp('wechat');                  // launcher-style start
window.__OS__.goHome();
window.__OS__.showRecents();
```

### Back key

```js
window.__OS__.handleBack();
// Routes through BackDispatcher according to registered priorities:
// PermissionDialog (1000) > Shade (800) > Keyboard (700) > App (100) > Launcher
```

### Reading current location

```js
window.__OS__.getAppRoute();
// → { app: 'wechat', path: '/chat?tab=hot' }
```

### Service handles

System services are accessible as sub-properties of `__OS__`. Representative calls:

```js
// Notifications
window.__OS__.notifications.push({ title: 'New message', body: 'Hi' });
window.__OS__.notifications.dismiss(id);
window.__OS__.notifications.getState();

// Keyboard
window.__OS__.keyboard.show();
window.__OS__.keyboard.hide();
window.__OS__.keyboard.isVisible();

// Permissions
window.__OS__.permissions.checkPermission('wechat', 'LOCATION');
await window.__OS__.permissions.requestPermissions('wechat', ['LOCATION', 'CAMERA']);
window.__OS__.permissions.grantPermission('wechat', 'LOCATION');

// Device preferences (battery, WiFi, brightness, …)
window.__OS__.device.getPreference('display.brightness');
window.__OS__.device.setPreference('display.brightness', 80);
window.__OS__.device.connectWifi('Home-5G');

// Quick settings
window.__OS__.quickSettings.set({ airplane: true });
```

Each service's full API surface is declared in `os/types/globals.d.ts` and documented topically under [../os-services/](../os-services/).

## `__SIM_INPUT__` — synthesized input

These are the same gestures the benchmark dispatches via Playwright when an agent emits actions. Coordinates here are **CSS pixels** (viewport coordinates), not the agent's normalized `[0, 1000]`.

| Method | Signature | Notes |
|---|---|---|
| `tap(x, y, opts?)` | `(number, number, {coords?: 'css' \| 'physical'})` | Single tap |
| `doubleTap(x, y, opts?)` | `(number, number, opts?)` | Two quick taps |
| `longPress(x, y, ms?, opts?)` | `(number, number, number = 800, opts?)` | Hold (default 800 ms) |
| `swipe(start, end, opts?)` | `({x,y}|[x,y], {x,y}|[x,y], opts)` | See below |
| `drag(start, end, opts?)` | `({x,y}|[x,y], {x,y}|[x,y], opts)` | Like swipe, but with a hold and no inertia |
| `type(text, opts?)` | `(string, {clear?: boolean, perCharMs?: number})` | Types into the focused field |
| `back()` | | Equivalent to `__OS__.handleBack()` |
| `home()` | | Equivalent to `__OS__.goHome()` |
| `recent()` | | Open the recents / multitask UI |
| `enter()` | | Synthesize an Enter / return key |

Swipe options:

```js
await __SIM_INPUT__.swipe(
  { x: 200, y: 500 }, { x: 200, y: 200 },
  {
    ms: 300,            // duration of the swipe gesture
    steps: 10,          // sample points
    inertia: true,      // continue with inertia after release
    inertiaMs: 450,
    inertiaDecay: 0.86,
  },
);
```

### Examples

```js
__SIM_INPUT__.tap(200, 400);
await __SIM_INPUT__.type('Hello', { clear: true });
await __SIM_INPUT__.swipe([200, 500], [200, 200]);
__SIM_INPUT__.back();
```

### Coordinate space

By default, `__SIM_INPUT__` expects **CSS pixels** matching the visible viewport. If you have *physical pixels* (e.g. coordinates from a 1080×2400 image), pass `{ coords: 'physical' }`:

```js
__SIM_INPUT__.tap(540, 1200, { coords: 'physical' });
```

The mapping is computed from the active device profile and the current CSS-zoom viewport. See [`os/simInput.ts`](../../os/simInput.ts) for the exact resolution logic.

## `__SIM_QUERY__` — DOM queries

Returns positions and bounding boxes for elements **without performing any action**. Useful for task authoring, smoke tests, or chaining `query → input`.

```js
__SIM_QUERY__.getRectById('submit-btn');
__SIM_QUERY__.getRectBySelector('[data-trigger="wechat.settings.open"]');
__SIM_QUERY__.getRectByTrigger('wechat.tab.switch', { tab: 'me' });
```

Each returns either `null` (not found / not visible) or:

```js
{
  rect: { x, y, width, height },          // CSS-pixel bounds
  center: { x, y },                       // CSS-pixel center
  centerPhysical: { x, y },               // physical-pixel center (accounts for DPR + zoom)
}
```

### Composition

```js
const r = __SIM_QUERY__.getRectByTrigger('wechat.tab.switch', { tab: 'me' });
if (r) __SIM_INPUT__.tap(r.center.x, r.center.y);
```

## `__SIM_TIME__` — simulated time

The simulator's `TimeService` underlies every `now()` call in app code. By default it follows the real wall clock; the benchmark overrides it for reproducibility.

```js
__SIM_TIME__.now();
__SIM_TIME__.setSimulatedTime('2026-05-18 09:00');
__SIM_TIME__.setSimulatedTime(1747560000000);
__SIM_TIME__.setRealTime();           // revert
__SIM_TIME__.getConfig();
```

> 🕐 **App code must use `TimeService`** for displayed times, data timestamps, and judge-relevant fields. `TimeService.realNow()` is the escape hatch for measuring real elapsed time (animations, debouncing, etc.).

## `__SIM_LOCATION__` — simulated location

Replaces `navigator.geolocation` and enforces consistent GPS coordinates across runs.

```js
__SIM_LOCATION__.getCoords();
__SIM_LOCATION__.setSimulatedLocation('shanghai');
__SIM_LOCATION__.setSimulatedLocation({ latitude: 31.23, longitude: 121.47 });
__SIM_LOCATION__.simulateError(1);    // 1 = permission denied, 2 = unavailable, 3 = timeout
__SIM_LOCATION__.clearError();
__SIM_LOCATION__.setRealLocation();
__SIM_LOCATION__.presets;             // → { beijing: { latitude, longitude }, shanghai: {…}, tokyo: {…}, … }
__SIM_LOCATION__.getConfig();
```

> 🌐 **App code must use `LocationService`** rather than `navigator.geolocation` directly. The lint rules will reject the latter.

## Scroll observation

```js
window.__getScrollMeta__();
// → { main: { position: 120, max: 980, viewport: 600, total: 1580 }, … }
```

Auto-discovers every visible element with `data-scroll-container="<name>"` and returns its scroll state. Useful when an agent's task requires reaching a specific scroll position.

## Cheatsheet

```js
// State surgery
__SIM__.getState();
await __SIM__.reset();

// OS control
__OS__.openApp('wechat', '/chat');
__OS__.handleBack();

// Find + tap
const r = __SIM_QUERY__.getRectBySelector('[data-trigger="settings.open"]');
__SIM_INPUT__.tap(r.center.x, r.center.y);

// Type
await __SIM_INPUT__.type('Hello MobileGym 👋', { clear: true });

// Reproducibility knobs
__SIM_TIME__.setSimulatedTime('2026-05-18 09:00');
__SIM_LOCATION__.setSimulatedLocation('shanghai');
```

## Where to go next

- 📊 The state schema per app → [../os-services/APP_STATE_API.md](../os-services/APP_STATE_API.md)
- 🧪 Use these APIs from inside a task setup → [../guides/add-a-task.md](../guides/add-a-task.md)
- 🤖 What the agent sees instead → [architecture.md](../architecture.md#benchmark-layer-bench_env)
