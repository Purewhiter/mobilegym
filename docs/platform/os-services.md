# OS Services

Apps don't call browser APIs directly. They go through OS-provided services that the simulator can configure, snapshot, and reset. This document is the reference for what services exist and what they expose.

The complete API surface is declared in [`os/types/globals.d.ts`](../../os/types/globals.d.ts). What follows is the human-readable version.

## Why services, not browser APIs

Three reasons the framework forbids `Date.now()`, `navigator.geolocation`, raw `fetch` to external URLs, and `navigator.clipboard`:

1. **Determinism** — the benchmark needs to replay tasks against a frozen wall clock, a fixed GPS location, a known network response. Browser-native APIs read live state.
2. **Sandboxing** — Apps shouldn't reach real services or real funds. Network calls route through a same-origin gateway with a per-session cookie jar; geolocation is a preset string; SMS is fabricated by the SMS app.
3. **Snapshots** — Services that hold state (clipboard, notifications) are part of the env snapshot. Browser APIs aren't.

The ESLint rules enforce this on every commit; this document explains what to reach for instead.

## TimeService

The simulated wall clock. Apps read **simulated** time for anything they display or persist; they read **real** time for measuring physical elapsed time (animations, debounces, cache TTLs).

```ts
import { TimeService } from '@/os/TimeService';

TimeService.now();                              // → number (ms since epoch, simulated)
TimeService.getDate();                           // → Date object (simulated)
TimeService.realNow();                           // → ms since epoch, REAL wall clock
TimeService.fromTimestamp(1747560000000);        // → Date — replaces `new Date(ms)`
TimeService.fromLocalParts(2026, 5, 18, 9, 0);   // → Date — replaces `new Date(y, m, d, …)`
TimeService.parseToTimestamp('2026-05-18');      // → ms — replaces `Date.parse(s)`
```

The benchmark drives it via `window.__SIM_TIME__`:

```ts
__SIM_TIME__.setSimulatedTime('2026-05-18 09:00');
__SIM_TIME__.setSimulatedTime(1747560000000);
__SIM_TIME__.setRealTime();              // revert to wall clock
__SIM_TIME__.getConfig();                 // { mode, ... }
```

### When to use which

| Need | Use |
|---|---|
| Display a time on screen | `TimeService.now()` / `getDate()` |
| Timestamp something stored in app state | `TimeService.now()` |
| Compare two physically-elapsed durations (animation tween, debounce, frame timing) | `TimeService.realNow()` |
| Parse a date string from the user | `TimeService.parseToTimestamp(str)` |
| Construct a Date from a known epoch | `TimeService.fromTimestamp(ms)` |

**Forbidden everywhere in `apps/` and `system/`:** `Date.now()`, `new Date()`, `Date.parse()`. The lint rule will reject them.

## LocationService

Simulated GPS, with preset cities and error simulation. Replaces `navigator.geolocation`.

```ts
import { LocationService } from '@/os/LocationService';

const coords = LocationService.getCoords();
// → { latitude: 31.23, longitude: 121.47, accuracy: 10 }
```

Benchmark control via `__SIM_LOCATION__`:

```ts
__SIM_LOCATION__.setSimulatedLocation('shanghai');             // preset by name
__SIM_LOCATION__.setSimulatedLocation({ latitude: 31.23, longitude: 121.47 });
__SIM_LOCATION__.simulateError(1);                              // 1=permission, 2=unavailable, 3=timeout
__SIM_LOCATION__.clearError();
__SIM_LOCATION__.setRealLocation();                             // revert to navigator.geolocation
__SIM_LOCATION__.getConfig();
__SIM_LOCATION__.presets;
// → { beijing: { latitude, longitude }, shanghai: {…}, tokyo: {…}, newyork: {…}, … }
```

Presets are an object map (city name → `{ latitude, longitude }`). Apps that need a real coordinate from a name look it up there.

## NetworkService

CORS-safe HTTP gateway with a per-session cookie jar. Replaces `fetch()` for external URLs.

```ts
import { netFetch, netJson, netText } from '@/os/NetworkService';

const data = await netJson('https://api.example.com/v1/users');
const html = await netText('https://example.com/page');
const resp = await netFetch('https://example.com/file', { method: 'POST', body: '...' });
```

**Rules:**

- Same-origin URLs (relative, or same host as the simulator) — call `fetch` directly. No need to go through the gateway.
- Absolute URLs to other hosts — must go through `netFetch / netJson / netText`. The gateway proxies via `/api/gw/fetch` (string bodies) or `/api/gw/proxy` (streaming/binary).
- Cookies: each browser tab has a session id stored at `localStorage.x-gw-session`. The gateway keeps a server-side cookie jar per session, so `Set-Cookie` headers persist across requests.
- The gateway filters dangerous headers (no `content-encoding` games, no upstream-controlled CORS bypass).

### Cache hints

The gateway respects upstream cache headers and adds simulator-side caching for known APIs (weather: 5 min, reverse geocode: 10 min). Apps don't configure this — it's transparent.

## ClipboardService

System clipboard, persisted to localStorage. Replaces `navigator.clipboard`.

```ts
import { ClipboardService } from '@/os/ClipboardService';

ClipboardService.write({ type: 'text', value: 'Hello' });
const item = ClipboardService.read();
// → { type: 'text', value: 'Hello' } | null

ClipboardService.clear();
```

Exposed on `__OS__.clipboard.{read,write,clear}` too.

The clipboard's content is **part of OS snapshots** (`os.services.clipboard`). Useful when a task includes "copy this string, paste it in another app."

## NotificationService

Volatile notification queue. Surface for `__OS__.notifications`.

```ts
__OS__.notifications.push({
  appId: 'wechat',
  title: 'Bob',
  body: 'Hey, are you free for lunch?',
  route: '/chat?with=bob',     // tapping this notification opens this route
  importance: 'high',
});

__OS__.notifications.getState();    // → { items: [...], unreadCount: 3 }
__OS__.notifications.markRead(id, true);
__OS__.notifications.dismiss(id);
__OS__.notifications.dismissByRoute('wechat', '/chat?with=bob');
__OS__.notifications.clearForApp('wechat');
__OS__.notifications.clearAll();
__OS__.notifications.subscribe(snapshot => { /* … */ });
__OS__.notifications.onPush(notification => { /* … */ });
```

Notifications are **volatile** — refreshing the browser clears them. The notification shade UI in `SystemShell` subscribes to the service and renders the queue.

## KeyboardService

Soft-keyboard control and IME state. Surface for `__OS__.keyboard`.

```ts
__OS__.keyboard.show();
__OS__.keyboard.hide();
__OS__.keyboard.isVisible();
__OS__.keyboard.getHeight();
__OS__.keyboard.setHeight(280);
__OS__.keyboard.setMode('chinese');   // or 'english', 'number', ...
__OS__.keyboard.toggleMode();
__OS__.keyboard.subscribe(state => { /* … */ });
```

The OS automatically:

- Detects focus on text inputs and shows the keyboard.
- Resizes the active Activity via `adjustResize` so flex layouts reflow above the keyboard.
- Hides elements tagged `data-hide-on-keyboard` so bottom TabBars don't stick above the keyboard.

Apps generally don't call these directly; they're available for advanced cases (custom inputs, programmatic dismissal).

## PermissionService

App-scoped permission state, exposed on `__OS__.permissions`.

```ts
__OS__.permissions.checkPermission('wechat', 'LOCATION');
// → 'granted' | 'denied' | 'prompt'

__OS__.permissions.checkPermissions('wechat', ['LOCATION', 'CAMERA']);
// → { LOCATION: 'granted', CAMERA: 'prompt' }

await __OS__.permissions.requestPermissions('wechat', ['LOCATION', 'CAMERA']);
// shows the OS permission dialog; resolves with the user's choice

__OS__.permissions.grantPermission('wechat', 'LOCATION');     // benchmark-side override
__OS__.permissions.revokePermission('wechat', 'LOCATION');
__OS__.permissions.revokeAll('wechat');

__OS__.permissions.getAppsWithPermissions();                  // → AppId[]
__OS__.permissions.getDeclaredPermissions('wechat');          // → PermissionId[]
```

The permission state is **persisted** in `os.permissions[appId][perm]`. Apps usually call `requestPermissions` and react to the response; the benchmark uses `grantPermission` to pre-set state before a task.

## Device preferences (`__OS__.device`)

Adjustments to device-wide hardware preferences (brightness, volume, WiFi network presets).

```ts
__OS__.device.getPreference('display.brightness');         // → number
__OS__.device.setPreference('display.brightness', 80);
__OS__.device.setNearbyWifi([{ ssid: 'Home-5G', signal: -55 }, …]);
__OS__.device.setNearbyBluetooth([…]);
__OS__.device.connectWifi('Home-5G');
__OS__.device.disconnectWifi();
__OS__.device.connectBluetooth(macAddress);
__OS__.device.disconnectBluetooth(macAddress);
```

Writes flow through the appropriate manager (`DisplayManager`, `ConnectivityManager`, etc.) so constraint logic is enforced — `connectWifi` cascades airplane mode off, etc.

## Quick settings (`__OS__.quickSettings`)

The pull-down quick settings (WiFi, Bluetooth, airplane, brightness slider, etc.).

```ts
__OS__.quickSettings.getState();
// → { wifi, bluetooth, airplane, dnd, flashlight, …, brightness, volume }

__OS__.quickSettings.set({ airplane: true });
__OS__.quickSettings.toggle('wifi');
```

Internally these delegate to the underlying manager + OsStateStore, so the effects are visible everywhere (status bar icon, settings app, etc.).

## SMS Gateway (`__SMS_GATEWAY__`)

Outside the standard `__OS__` namespace because it interacts with the SMS provider plus the SMS app's broadcast receiver. Two main entry points:

```ts
import { SmsGateway } from '@/os/SmsGateway';

// Verification codes (e.g. an OTP flow):
const { code } = await SmsGateway.sendVerificationCode({
  from: 'YourApp',
  codeLength: 6,
  template: '【{app}】验证码：{code}，5分钟内有效',   // optional; {app} and {code} substituted
});
// → triggers an SMS arrival in the SMS provider + a notification

// Inject a custom message:
SmsGateway.receiveMessage({
  from: '+1234567',
  body: 'Hi from a friend',
});
```

External / benchmark-side access:

```ts
window.__SMS_GATEWAY__.sendVerificationCode({ from: 'Bank', codeLength: 6 });
```

The SMS app's `state.ts` registers a `BroadcastReceiver` for `'SMS_RECEIVED'`; that's how arrivals propagate to a conversation thread and a notification.

> 🔌 Verification flows usually look like: in your app, call `sendVerificationCode({ from })`, switch to SMS via Intent or the user's tap on the notification, copy the code back manually (or have the user re-enter it). Pattern matches AOSP's real-world flow.

## FileSystem (`__SIM_FS__` + `FileSystemService`)

A virtual filesystem rooted at paths like `/sdcard/Documents`, `/sdcard/Pictures`. Apps read/write via the service; the benchmark can prepopulate files.

```ts
import { FileSystemService } from '@/os/FileSystemService';

await FileSystemService.write('/sdcard/Documents/report.txt', new TextEncoder().encode('hello'));
const content = await FileSystemService.read('/sdcard/Documents/report.txt');
await FileSystemService.unlink('/sdcard/Documents/report.txt');
await FileSystemService.list('/sdcard/Documents');
```

State is persisted (or volatile, depending on how the store is configured per build). External control via `window.__SIM_FS__`.

## Display scaling

Three knobs adjust how apps render:

| Knob | What it controls | Implemented today? |
|---|---|---|
| `displayScale` | DPI multiplier — affects whole UI (layout + text) via CSS `zoom` on the SystemShell root. Range 0.85–1.15. | ✅ Yes |
| `fontScale` | Affects text only (sp-equivalent units). Default 1.0, typical range 0.85–1.3. | ❌ Not yet — requires sp/dp distinction in styles |
| `designViewportWidth` | Per-app CSS-zoom anchor declared in `manifest.ts`. Each app renders as if its viewport were this wide. | ✅ Yes |

The OS computes:

```
effectiveViewportWidth = physicalViewport / displayScale
```

…and applies CSS `zoom` to the per-app container so layouts laid out for `designViewportWidth` match physical screen dimensions consistently across devices.

Apps don't usually need to think about this — they assume `designViewportWidth` (typically 360px) and the OS handles the rest. Where it matters: pixel math (`scrollTop = index * itemHeight`) must use CSS variables or pixel literals, never Tailwind rem classes, because the browser's default font size interacts with the zoom in surprising ways.

## ContentResolver

The shared content provider. Apps query/insert/update/delete against providers (contacts, SMS, media) rather than reaching into the underlying store.

```ts
import { ContentResolver } from '@/os/ContentResolver';

const favorites = ContentResolver.query('contacts', { filter: { isFavorite: true } });
const newId = ContentResolver.insert('sms', {
  from: '+1234567',
  body: 'Code: 123456',
  timestamp: TimeService.now(),
  threadId: 'thread-1',
});
ContentResolver.update('contacts', { id: 'c-42' }, { isFavorite: false });
ContentResolver.delete('sms', { id: 'sms-7' });
```

Providers — Contacts, SMS, Media — each persist their own store at `os/providers/<Provider>.ts`. They appear in snapshots under `os.providers.<name>`, not under `os.services` (because they hold content, not service runtime).

## Broadcast bus (`__OS__.broadcast`)

Pub-sub for system events.

```ts
__OS__.broadcast.sendBroadcast({
  action: 'SMS_RECEIVED',
  extras: { from: '+1234567', body: 'Hi' },
});

const unregister = __OS__.broadcast.registerReceiver({
  action: 'SMS_RECEIVED',
  handler: (intent) => { /* … */ },
});
```

Use for system events that any app might react to (SMS arrived, battery low, locale changed). Not for app-to-app direct communication — use Intents for that.

## How they fit together

A typical user flow exercises multiple services:

1. User opens Maps → `LocationService.getCoords()` returns the simulated city.
2. Maps requests `LOCATION` permission → `PermissionService.requestPermissions()` shows the OS dialog.
3. User searches a destination → Maps calls `netJson('https://maps.example.com/api/search?q=…')` through `NetworkService`.
4. User taps "send to friend" → Maps emits an Intent for `ACTION_SEND text/plain` → IntentResolver dispatches to WeChat.
5. WeChat receives the share, drops into a contact picker → uses `ContentResolver.query('contacts')`.

Every step is configurable from the benchmark, deterministic across runs, and reflected in the snapshot for judging.

## Where to go next

- 🔌 The full JS surface (`__SIM__`, `__OS__`, …) → [`../api/runtime-api.md`](../api/runtime-api.md)
- 🧠 OS internals — how managers and providers fit together → [`os-layer.md`](os-layer.md)
- 🚧 Intents and choosers → [`intent-system.md`](intent-system.md)
- 🗃️ Where service state lives in snapshots → [`state-model.md`](state-model.md)
