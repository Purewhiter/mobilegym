# Device Server

App state lives in a per-page **device session** on the device server (`device/`). The page store mirrors that session, so components and `__SIM__.getState().apps.<appId>` keep reading plain store fields. Each server process owns its sessions and loads one copy of the read-only catalogs for them to share.

Served at `/__device` by the Vite plugin in dev and preview, and by `device/main.ts` behind the nginx gateway (`scripts/server/start_nginx_gateway.sh`).

## Pieces

| Piece | Where | Role |
|---|---|---|
| Engine | `device/engine.ts` | Sessions, per-app state, catalog overlay, commands, queries |
| App module | `apps/<App>/device/index.ts`, or `device/stateOnly.ts` | Catalog loader, commands, queries for one app. Modules with a catalog or commands are registered in `device/server.ts`; any other app id gets the state-only module on its first request |
| Page store | `createDeviceAppStore` in `os/device/deviceStore.ts` | Mirror of the session; actions call commands |
| Client | `os/device/DeviceClient.ts` | One write queue per session generation; queries wait for the writes queued before them, then run side by side. A reset aborts in-flight requests and starts a fresh queue. |
| Preload | `apps/<App>/data/loader.ts` `preload()` | Called by the OS `waitForData` hook: `await useXStore.ensureSynced()`, plus `prefetchDeviceQuery(...)` for catalog data the first screen needs |
| Python views | `bench_env/env/device_view.py` | `DeviceView(app_id, state)`: imports a state snapshot (initial or final) into a scratch session and answers the module's queries, so judges and samplers read catalog-plus-state records without merging in Python |

## Content providers

Contacts, SMS and media (`os/providers/*Provider.ts`) keep their data in the same session, under `provider_contacts`, `provider_sms` and `provider_media`, through `createProviderStore` (`os/providers/providerStore.ts`). The page is the authority, as with `syncSetState` apps: a provider reads and writes its store synchronously and every write is saved. The session's data is adopted once per session; app launch and `__SIM__.waitForData()` wait for that, and the provider's content observers are told when it lands, after an `os.providers` patch, and on reset. `__SIM__.setState({ os: { providers } })` resolves once the session holds the patch.

The providers and Map migrate existing browser state on their first sync. The old localStorage entry is removed after the device server acknowledges the write.

## Choosing how an app uses it

| App shape | Use | Examples |
|---|---|---|
| Large read-only catalog, user state on top | App module with `loadCatalog` + queries; store actions call `command(...)` | RedBook, Bilibili, Railway12306, Reddit, X, Ebay |
| Taps that must see the previous tap at once (toggles, players) | `optimistic(apply, name, ...args)`; put the transition in a pure module shared by page and server | Spotify (`apps/Spotify/logic.ts`), settings toggles |
| State logic that stays on the page, small data | `createDeviceAppStore(..., { syncSetState: true })`; nothing to register on the server | Weather, WeChat, Alipay, Map, system apps |

With `syncSetState` the page is the authority: every write (`setState`, or `set` inside an action) applies at once and schedules a save of the server fields as they are when the save runs. A write that changes only `localKeys` is not saved. Actions stay synchronous; migrating such an app only swaps `createAppStoreWithActions` for `createDeviceAppStore`. Keys the app used to leave out of persistence (`partialize`) become `localKeys`.

The benchmark waits for `__SIM__.waitForStateCommit()` before capturing the final snapshot. The API waits for pending commands and retries unsaved page writes once. If a save still fails, the episode reports an environment error instead of judging uncommitted state. The same goes for a device query that failed for good at any step of the episode, and for an app that opened before the shared data it reads on its first render (contacts / SMS / media providers, the file system) arrived within the launch wait, or after the file system fell back to its preset tree (`__SIM__.deviceQueryFailures()` lists them all): a page went without its data, so what the agent saw was not the app.

## Rules

- **Never write app state to `localStorage`.** Session state is reset per episode; `localStorage` leaks across episodes.
- **The session never sees page-only state.** UI scratch state (`_temp`, drafts, open sheets) goes in `localKeys`.
- **State shape is a contract.** Judges read `__SIM__.getState().apps.<appId>`; a migration keeps every field and its meaning.
- **New ids, display labels and random values are made on the page** (TimeService / RandomService) and passed to commands, so they follow the page's clock, locale and episode seed.
- **A command that toggles derives the new value on the server** (or through `optimistic`); never send `!currentValue` read from the mirror without `optimistic`, or two quick taps send the same value.
- **Submits that navigate away await the command** and go through `os/hooks/useSubmitOnce`, so a second tap does not submit twice and a late answer does not navigate after the user left.
- **Pages fetch what they show, not the catalog.** A list page asks for one page of results (`feed`, `feedPage`), a detail page for one record, a search for its hits; the module assembles them (X: `apps/X/device/views.ts`, one query per hook in `apps/X/data/view.ts`). Values that depend on the page's clock or locale (X display times) are passed in as query arguments or filled in on the page.
- **Catalog and state are merged in one place: the app's device module.** Judges and samplers read merged records through `DeviceView` (RedBook, X and Reddit expose `view*` / `feed*` queries for this); they never load catalog JSON and re-derive the merge in Python. When the page merges too, it calls the same pure functions as the module (`apps/X/utils/runtimePostResolver.ts`, `apps/Reddit/utils/view.ts`).
- **Catalog URLs the server returns are final** (CDN and `/@app-assets/` bases are module options); see [`../app/media-assets.md`](../app/media-assets.md).
- **A command replaces state and records, never changes them in place** (`ctx.state = { ...ctx.state, ... }`, `ctx.put(...)` with a new record). A command that throws leaves the session as it was, which works by keeping the old state object.
- **Commands carry the page's clock.** `POST .../commands/:name` without a numeric `now` is refused (400); the server never stamps a command with its own time.
- **Pages show a failed query.** `useDeviceQuery` returns `error` and `retry` next to `data` and `loading`: a fetch is tried three times, then `loading` turns false and `error` is set, so a page can say so instead of loading forever. The failure also fails the episode (see above), whether or not the page shows it.
- After changing a device module, restart the dev server: the module is loaded once per server process.

## Validating a migration

1. `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, offline and live `bench_env` tests for the app.
2. Store tests can run real module commands in memory with `tests/support/memoryDevice.ts`.
3. Replay diff: record every task once on `main` with a model agent, then for each migrated app replay its tasks on `main` twice and on the branch, and compare judges, steps and screenshots. Branch-vs-main differences should match main-vs-main noise.
