# Device Server

App state lives in a per-page **device session** on the device server (`device/`), not in `localStorage`. The page store is a mirror of that session, so components and `__SIM__.getState().apps.<appId>` keep reading plain store fields. One server process holds every session; read-only catalogs are loaded once per process and shared by all sessions.

Served at `/__device` by the Vite plugin in dev and preview, and by `device/main.ts` behind the nginx gateway (`scripts/server/start_nginx_gateway.sh`).

## Pieces

| Piece | Where | Role |
|---|---|---|
| Engine | `device/engine.ts` | Sessions, per-app state, catalog overlay, commands, queries |
| App module | `apps/<App>/device/index.ts`, or `device/stateOnly.ts` | Catalog loader, commands, queries for one app; registered in `device/server.ts` |
| Page store | `createDeviceAppStore` in `os/device/deviceStore.ts` | Mirror of the session; actions call commands |
| Client | `os/device/DeviceClient.ts` | One request queue per page; a reset bumps the generation and abandons queued work |
| Preload | `apps/<App>/data/loader.ts` `preload()` | Called by the OS `waitForData` hook: `await useXStore.ensureSynced()`, plus `prefetchDeviceQuery(...)` for catalog data the first screen needs |
| Python views | `bench_env/env/device_view.py` | `DeviceView(app_id, state)`: imports a state snapshot (initial or final) into a scratch session and answers the module's queries, so judges and samplers read catalog-plus-state records without merging in Python |

## Choosing how an app uses it

| App shape | Use | Examples |
|---|---|---|
| Large read-only catalog, user state on top | App module with `loadCatalog` + queries; store actions call `command(...)` | RedBook, Bilibili, Railway12306, Reddit, X, Ebay |
| Taps that must see the previous tap at once (toggles, players) | `optimistic(apply, name, ...args)`; put the transition in a pure module shared by page and server | Spotify (`apps/Spotify/logic.ts`), settings toggles |
| State logic that stays on the page, small data | `createStateOnlyModule(appId)` + `createDeviceAppStore(..., { syncSetState: true })` | Weather, WeChat, Alipay, system apps |

With `syncSetState` the page is the authority: every write (`setState`, or `set` inside an action) applies at once and schedules a save of the server fields as they are when the save runs. Actions stay synchronous; migrating such an app only swaps `createAppStoreWithActions` for `createDeviceAppStore`. Keys the app used to leave out of persistence (`partialize`) become `localKeys`.

## Rules

- **Never write app state to `localStorage`.** Session state is reset per episode; `localStorage` leaks across episodes.
- **The session never sees page-only state.** UI scratch state (`_temp`, drafts, open sheets) goes in `localKeys`.
- **State shape is a contract.** Judges read `__SIM__.getState().apps.<appId>`; a migration keeps every field and its meaning.
- **New ids, display labels and random values are made on the page** (TimeService / RandomService) and passed to commands, so they follow the page's clock, locale and episode seed.
- **A command that toggles derives the new value on the server** (or through `optimistic`); never send `!currentValue` read from the mirror without `optimistic`, or two quick taps send the same value.
- **Submits that navigate away await the command** and go through `os/hooks/useSubmitOnce`, so a second tap does not submit twice and a late answer does not navigate after the user left.
- **Catalog and state are merged in one place: the app's device module.** Judges and samplers read merged records through `DeviceView` (RedBook, X and Reddit expose `view*` / `feed*` queries for this); they never load catalog JSON and re-derive the merge in Python. When the page merges too, it calls the same pure functions as the module (`apps/X/utils/runtimePostResolver.ts`, `apps/Reddit/utils/view.ts`).
- **Catalog URLs the server returns are final** (CDN and `/@app-assets/` bases are module options); see [`../app/media-assets.md`](../app/media-assets.md).
- After changing a device module, restart the dev server: the module is loaded once per server process.

## Validating a migration

1. `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, offline and live `bench_env` tests for the app.
2. Store tests can run real module commands in memory with `tests/support/memoryDevice.ts`.
3. Replay diff: record every task once on `main` with a model agent, then for each migrated app replay its tasks on `main` twice and on the branch, and compare judges, steps and screenshots. Branch-vs-main differences should match main-vs-main noise.
