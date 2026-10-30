# OS Services

Apps don't call browser APIs directly. They go through OS-provided services that the simulator can configure, snapshot, and reset. This document is the reference for what services exist and what they expose.

The complete API surface is declared in [`os/types/globals.d.ts`](../../../../os/types/globals.d.ts). What follows is the human-readable version.

## Per-Service Pages

| Service area | Read |
|---|---|
| Time and clock determinism | [`time.md`](time.md) |
| Seeded randomness (seat numbers, codes, ids) | [`random.md`](random.md) |
| Location and GPS simulation | [`location.md`](location.md) |
| External HTTP and gateway behavior | [`network.md`](network.md) |
| Verification SMS and SMS broadcasts | [`sms.md`](sms.md) |
| Virtual `/sdcard` filesystem | [`filesystem.md`](filesystem.md) |
| Display/font scaling | [`display-scaling.md`](display-scaling.md) |
| Keyboard, IME, pointer events, `adjustResize` | [`input-keyboard.md`](input-keyboard.md) |

## Why services, not browser APIs

Three reasons the framework forbids `Date.now()`, `navigator.geolocation`, raw `fetch` to external URLs, and `navigator.clipboard`:

1. **Determinism** — the benchmark needs to replay tasks against a frozen wall clock, a fixed GPS location, a known network response. Browser-native APIs read live state.
2. **Sandboxing** — Apps shouldn't reach real services or real funds. Network calls route through a same-origin gateway with a per-session cookie jar; geolocation is a preset string; SMS is fabricated by the SMS app.
3. **Snapshots** — Services that hold state (clipboard, notifications) are part of the env snapshot. Browser APIs aren't.

ESLint enforces the time rules (`Date.now()` and `new Date(...)`) and the randomness rule (`Math.random()`, `crypto.randomUUID()`, `crypto.getRandomValues()` → [`RandomService`](random.md)). The location, external-network, and clipboard rules are platform conventions enforced by code review and app-module review.

## TimeService

The simulated wall clock. Apps read **simulated** time for anything they display or persist; they read **real** time for measuring physical elapsed time (animations, debounces, cache TTLs).

```ts
import * as TimeService from '@/os/TimeService';

TimeService.now();                              // → number (ms since epoch, simulated)
TimeService.getDate();                           // → Date object (simulated)
TimeService.realNow();                           // → ms since epoch, REAL wall clock
TimeService.fromTimestamp(1747560000000);        // → Date — replaces `new Date(ms)`
TimeService.fromLocalParts(2026, 4, 18, 9, 0);   // → Date for May 18; monthIndex is 0-based
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

**Forbidden everywhere in `os/`, `apps/`, and `system/`:** `Date.now()` and `new Date()`. The lint rule rejects those two forms; prefer `TimeService.parseToTimestamp()` over `Date.parse()` for deterministic parsing.

## LocationService

Simulated GPS, with preset cities and error simulation. Replaces `navigator.geolocation`.

```ts
import * as LocationService from '@/os/LocationService';

const coords = LocationService.getSimulatedCoords();
// → { latitude: 31.23, longitude: 121.47, accuracy: 10 } | null
```

`getSimulatedCoords()` returns `null` in real-location mode or while a simulated location error is active. Use `getCurrentPosition(...)` when code must handle both real and simulated modes through the browser-compatible callback shape.

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
- Cookies: each browser tab has a session id stored at `localStorage['mobile-gym:gw:session']` and sent as the `x-gw-session` header. The gateway keeps a server-side cookie jar per session, so `Set-Cookie` headers persist across requests.
- The gateway filters dangerous headers (no `content-encoding` games, no upstream-controlled CORS bypass).

### Cache hints

The gateway respects upstream cache headers and adds simulator-side caching for known APIs (weather: 5 min, reverse geocode: 10 min). Apps don't configure this — it's transparent.

## ClipboardService

System clipboard, persisted to localStorage. Replaces `navigator.clipboard`.

```ts
import { ClipboardService } from '@/os/ClipboardService';

ClipboardService.write({ type: 'text', content: 'Hello' });
const item = ClipboardService.read();
// → { type: 'text', content: 'Hello', timestamp: ... } | null

ClipboardService.clear();
```

Exposed on `__OS__.clipboard.{read,write,clear}` too.

The clipboard's content is **part of OS snapshots** (`os.clipboard`). Useful when a task includes "copy this string, paste it in another app."

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
__OS__.keyboard.setMode('zh');        // or 'en'
__OS__.keyboard.toggleMode();
__OS__.keyboard.subscribe(state => { /* … */ });
```

The OS automatically:

- Detects focus on text inputs and shows the keyboard.
- Resizes the active Activity via `adjustResize` so flex layouts reflow above the keyboard.
- Hides elements tagged `data-hide-on-keyboard` so bottom TabBars don't stick above the keyboard.

Apps generally don't call these directly; they're available for advanced cases (custom inputs, programmatic dismissal). See [`input-keyboard.md`](input-keyboard.md) for the layout and IME contract.

## PermissionService

App-scoped permission state, exposed on `__OS__.permissions`.

```ts
__OS__.permissions.checkPermission('wechat', 'android.permission.ACCESS_FINE_LOCATION');
// → 'not_requested' | 'granted' | 'denied' | 'denied_forever'

__OS__.permissions.checkPermissions('wechat', [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.CAMERA',
]);
// → { 'android.permission.ACCESS_FINE_LOCATION': 'granted', 'android.permission.CAMERA': 'not_requested' }

await __OS__.permissions.requestPermissions('wechat', [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.CAMERA',
]);
// shows the OS permission dialog; resolves with the user's choice

__OS__.permissions.grantPermission('wechat', 'android.permission.ACCESS_FINE_LOCATION');     // benchmark-side override
__OS__.permissions.revokePermission('wechat', 'android.permission.ACCESS_FINE_LOCATION');
__OS__.permissions.revokeAll('wechat');

__OS__.permissions.getAppsWithPermissions();                  // → AppId[]
__OS__.permissions.getDeclaredPermissions('wechat');          // → PermissionId[]
```

The permission state is **persisted** in `os.permissions[appId][perm]`. Apps usually call `requestPermissions` and react to the response; the benchmark uses `grantPermission` to pre-set state before a task.

## Device preferences (`__OS__.device`)

Adjustments to device-wide hardware preferences (brightness, volume, WiFi network presets).

```ts
__OS__.device.getPreference('brightness');         // → number
__OS__.device.setPreference('brightness', 80);
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

## SMS Gateway (`__OS__.sms` + `SmsGateway`)

The SMS gateway interacts with the SMS provider plus the SMS receiver bootstrap. Two main entry points:

```ts
import { SmsGateway } from '@/os/SmsGateway';

// Verification codes (e.g. an OTP flow):
const { code } = SmsGateway.sendVerificationCode({
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
window.__OS__.sms.sendVerificationCode({ from: 'Bank', codeLength: 6 });
```

The SMS provider bootstrap registers a `BroadcastReceiver` for `'android.provider.Telephony.SMS_RECEIVED'`; that's how arrivals propagate even before the SMS app UI has mounted.

> 🔌 Verification flows usually look like: in your app, call `sendVerificationCode({ from })`, switch to SMS via Intent or the user's tap on the notification, copy the code back manually (or have the user re-enter it). Pattern matches AOSP's real-world flow.

## FileSystem (`__SIM_FS__` + `FileSystemService`)

A virtual filesystem rooted at paths like `/sdcard/Documents`, `/sdcard/Pictures`. Apps read/write via the service; the benchmark can prepopulate files.

```ts
import * as FileSystem from '@/os/FileSystemService';

await FileSystem.writeFile('/sdcard/Documents/report.txt', 'hello', { mimeType: 'text/plain' });
const content = await FileSystem.readFile('/sdcard/Documents/report.txt');
await FileSystem.deleteNode('/sdcard/Documents/report.txt');
FileSystem.listDirectory('/sdcard/Documents');
```

State is persisted (or volatile, depending on how the store is configured per build). External control via `window.__SIM_FS__`.

## Display scaling

Display settings are managed through `DisplayManager`, `OsStateStore`, and shell-level CSS effects. There are three separate concerns:

| Concern | Current behavior |
|---|---|
| Static display scale | `SIMULATOR_CONFIG.display.scale` applies CSS `zoom` to the SystemShell root. |
| Runtime font size | `settings.system.fontSizePct` changes the root font size through `DeviceEffects`; this is an approximation, not a strict Android `sp`/`dp` split. |
| Per-app design width | `manifest.designViewportWidth` applies CSS `zoom` around the app Activity content. |

For the full model, current limitations, and styling rules, see [display-scaling.md](display-scaling.md).

## ContentResolver

The shared content provider. Apps query/insert/update/delete against providers (contacts, SMS, media) rather than reaching into the underlying store.

```ts
import { ContentResolver } from '@/os/ContentResolver';

const favorites = ContentResolver.query('content://contacts/contacts');
const newUri = ContentResolver.insert('content://sms/messages?conversationId=thread-1', {
  content: 'Code: 123456',
  isOutgoing: false,
});
ContentResolver.update('content://contacts/contacts/c-42', { isFavorite: false });
ContentResolver.delete('content://sms/messages/sms-7');
```

Providers — Contacts, SMS, Media — each persist their own store at `os/providers/<Provider>.ts`. They appear in snapshots under `os.providers.<name>`, not under `os.services` (because they hold content, not service runtime).

## Broadcast bus (`__OS__.broadcast`)

Pub-sub for system events.

```ts
__OS__.broadcast.sendBroadcast({
  action: 'SMS_RECEIVED',
  extras: { from: '+1234567', body: 'Hi' },
});

const unregister = __OS__.broadcast.registerReceiver(
  'SMS_RECEIVED',
  (intent) => { /* … */ },
);
```

Use for system events that any app might react to (SMS arrived, battery low, locale changed). Not for app-to-app direct communication — use Intents for that.

## How they fit together

A typical user flow exercises multiple services:

1. User opens Maps → `LocationService.getSimulatedCoords()` returns the simulated city when location is in simulated mode.
2. Maps requests `android.permission.ACCESS_FINE_LOCATION` → `PermissionService.requestPermissions()` shows the OS dialog.
3. User searches a destination → Maps calls `netJson('https://maps.example.com/api/search?q=…')` through `NetworkService`.
4. User taps "send to friend" → Maps emits an Intent for `ACTION_SEND text/plain` → IntentResolver dispatches to WeChat.
5. WeChat receives the share, drops into a contact picker → uses `ContentResolver.query('content://contacts/contacts')`.

Every step is configurable from the benchmark, deterministic across runs, and reflected in the snapshot for judging.

## Where to go next

- 🔌 The full JS surface (`__SIM__`, `__OS__`, …) → [`../../../api/runtime-api.md`](../../../api/runtime-api.md)
- 🧠 OS internals — how managers and providers fit together → [`../overview.md`](../overview.md)
- 🚧 Intents and choosers → [`../intent-system.md`](../intent-system.md)
- 🗃️ Where service state lives in snapshots → [`../../state/model.md`](../../state/model.md)
