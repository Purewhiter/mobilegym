# OS State

OS state is the Android-like device model owned by `OsStateStore`, managers, providers, and volatile services.

## Buckets

| Bucket | Persisted? | Examples |
|---|---|---|
| `os.settings.global` | yes (`os_state`) | WiFi, Bluetooth, mobile data, airplane mode, language. |
| `os.settings.system` | yes (`os_state`) | Brightness, volume, font/display size, eye comfort. |
| `os.hardware` | yes (`os_state`) | Battery, connectivity, sensors, storage, device flags. |
| `os.permissions` | yes (`os_state`) | Per-app permission states. Persistent like real Android — runtime permissions survive app restart and "device reboot" (simulator refresh) until the user revokes them. `PermissionService` is a thin facade over `OsStateStore.permissions`, not a separate store. |
| `os.preferences` | yes (`os_state`) | Generic preference bucket reachable through `routeSetPreference()` when no Manager owns the key. |
| `os.build` / `os.telephony` | yes, but **separately** under `__os_scenario_overrides__` | Factory-immutable data; managed by `os/managers/registry.ts` override mechanism so bench scenarios can inject device model / IMEI / carrier without touching the regular state path. Not part of `OsStateStore`. |
| `os.providers` | yes, in the device session (`provider_sms`, `provider_contacts`, `provider_media`), not in localStorage | Contacts, SMS, media and other shared content providers. See [`device-server.md`](device-server.md#content-providers). |
| `os.clipboard` | yes (`os_clipboard_v1`) | Clipboard contents — persisted so paste survives across sessions. |
| `os.notifications` | no (volatile) | Active notifications. Cleared on reload. |
| `os.services` runtime | no (volatile) | Shade, keyboard, text-selection menu. Cleared on reload. |
| Location | no (volatile, **seeded from `SIMULATOR_CONFIG.location`**) | The only volatile service that isn't a blank reset — it re-initializes from the simulator-config preset on each reload. |

Writes should flow through Managers or service APIs rather than direct store mutation so constraints and side effects stay centralized.

## Managers

Managers are write facades under `os/managers/`. They register the preference keys they own at module load via `registerManager(keys, manager)`. When a write comes in through `routeSetPreference(key, value)`, the lookup table picks the right one:

```text
routeSetPreference(key, value)
  → normalizePreferenceKey(key)          # canonical alias resolution
  → state.preferences[normalized] = value  # raw write into the preferences bucket
  → keyToManager.get(normalized)?
      → manager.setPreference(key, value)   # Manager-owned: enforce constraints + side effects
      → genericSetPreference(key, value)    # No owner: just settle the value into OsStateStore
```

The same Managers receive direct calls from `applyOsStatePatch()` when a bench inject targets `os.*`, so the constraints below are enforced **regardless of entry point** (UI, preference API, or `__SIM__.setState`).

| Manager | Owns | Enforced constraints |
|---|---|---|
| `AudioManager` | Volume, ringer mode, DND, silent mode. | Volume clamp 0–100. **DND ⇄ silentMode sync**: enabling DND forces silentMode true (and records the pre-DND value); disabling DND restores it. |
| `DisplayManager` | Brightness, font size, display size, dark mode, eye comfort. | Brightness clamp 0–100. |
| `BatteryManager` | Battery percent, charging state. | Percent clamp 0–100. |
| `ConnectivityManager` | WiFi, mobile data, Bluetooth, airplane mode. | **Airplane-mode cascade**: enabling airplane forces wifi / bluetooth / cellular `enabled=false`, zeroes signal level fields. Disabling it does **not** automatically re-enable them; that's a user action. |

## Providers vs. services

`os/createOsStore.ts` exposes two factories with a `registerToServiceRegistry` flag (default `true`):

- `createOsStore(...)` — persistent store.
- `createVolatileOsStore(...)` — in-memory store, reset on reload.

Stores registered with the flag set to `true` are tracked in `_registry` and walked by `snapshotOsStores()` / `resetAllOsStores()`. The two exceptions opt out:

- **`OsStateStore`** sets `registerToServiceRegistry: false` — it has its own snapshot and reset paths because it's the canonical settings bucket.
- **Provider stores** (`SmsProvider`, `ContactsProvider`, `MediaProvider`) also opt out of `_registry`, but opt **into** `_providerRegistry` instead. They surface in the snapshot under `os.providers.*` rather than `os.services.*`.

The snapshot under `os.services.*` deliberately **excludes notifications and clipboard** even though they're service-registered stores, because they're already surfaced at the top level under `os.notifications` and `os.clipboard`.

### Apps must go through ContentResolver

Apps **must not** import provider stores directly (`os/providers/SmsProvider.ts` etc.). The only public API is `ContentResolver.query / insert / update / delete`, which mirrors Android's URI-addressed content access and lets the OS enforce permissions and observability. Direct imports break the abstraction and the bench can't intercept them.

## localStorage layout

Keys actually used by the current code:

| Key | Owner | Notes |
|---|---|---|
| `os_state` | OsStateStore | Settings, hardware, permissions, preferences. |
| `__os_scenario_overrides__` | `os/managers/registry.ts` | Build + telephony overrides for bench scenarios. Separate from `os_state` so scenario injects don't pollute user-facing state. |
| `os_clipboard_v1` | ClipboardService | Persisted clipboard contents. |
| `launcher` | Launcher | Pinned apps, layout. |
| `<manifest.id>` | App stores | One key per installed app, named exactly `manifest.id` (no suffix). |

There is currently **no boot-time cleanup** of historical keys — if you find `os_quick_settings_v2` etc. in a localStorage dump, it's stale browser data; the simulator no longer creates those keys but doesn't actively purge them either.

## SIMULATOR_CONFIG

`os/data/simulatorConfig.ts` exports `SIMULATOR_CONFIG`, the simulator-only configuration layer that has no Android counterpart. It is intentionally kept separate from `OS_DEFAULTS` (which mirrors `defaults.json`) so the Android-aligned state stays "pure".

| Section | Examples |
|---|---|
| `framework` | Chooser enabled, intent dispatch flags. |
| `time` | Default simulated time, time-zone preset. |
| `location` | `mode`, `simulatedLocation` preset, `PRESET_LOCATIONS` lookup. Consumed by `LocationService` at boot. |
| `ai` | AI feature toggles. |
| `display` | `scale`, theme color overrides. |
| `intent` | Intent filter behaviors specific to the simulator. |

Scenario inject paths that target `SIMULATOR_CONFIG` go through the same `__os_scenario_overrides__` mechanism as `build` / `telephony`.

## Related Docs

- Full state model → [model.md](model.md)
- Service APIs → [../os/services/](../os/services/)
- Live schema → [../../api/app-state-schema.md](../../api/app-state-schema.md)
