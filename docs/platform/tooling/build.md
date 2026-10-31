# Build and Tooling

This page documents the platform-side build pipeline, local dev server plugins, generated artifacts, and validation commands.

MobileGym is a single Vite project, not a monorepo. Runtime code lives under `os/`, `apps/`, and `system/`; benchmark tooling lives under `bench_env/`.

## Package scripts

| Command | Current behavior |
|---|---|
| `npm run dev` | Starts Vite on port `3000`, host `0.0.0.0`. |
| `npm run build` | Runs `vite build`. |
| `npm run preview` | Runs `vite preview`. |
| `npm run test` | Runs `vitest run`. |
| `npm run test:watch` | Runs `vitest`. |
| `npm run lint` | Runs ESLint on `os/` and `apps/`, then `scripts/lint_store_getters.mjs`. |
| `npm run build:web-css` | Builds `web/tailwind.css` with the Tailwind CLI. |
| `npm run watch:web-css` | Watches the standalone web CSS entry. |

## TypeScript

`tsconfig.json` uses:

| Setting | Value |
|---|---|
| target | `ES2022` |
| module | `ESNext` |
| module resolution | `bundler` |
| JSX | `react-jsx` |
| strict | `true` |
| path alias | `@/*` maps to the repository root |

The main TS project includes `index.tsx`, `os/**/*.ts(x)`, `apps/**/*.ts(x)`, and `system/**/*.ts(x)`. It excludes generated/output-heavy directories such as `dist`, `runs`, `bench_env`, `ui_dumps`, and extracted asset folders.

For large runtime changes, run:

```bash
npx tsc --noEmit
```

Small doc/style/data changes do not require a full type check.

## ESLint

`eslint.config.js` applies to runtime code in:

- `os/**/*.{ts,tsx}`
- `apps/**/*.{ts,tsx}`
- `system/**/*.{ts,tsx}`

Rules currently enforced:

| Rule | Why |
|---|---|
| No bare `Date.now()` | Runtime code must use `TimeService.now()` or `TimeService.realNow()` depending on simulated vs wall-clock time. |
| No `new Date(...)` | Runtime code must use `TimeService.getDate()`, `fromTimestamp()`, `fromLocalParts()`, or parsing helpers. |
| React Hooks rules | Standard hook correctness. |
| React Hooks exhaustive deps | Warning-level dependency checks. |

`os/TimeService.ts` is exempt from the Date restrictions because it implements the abstraction.

`scripts/lint_store_getters.mjs` catches Zustand patterns that do not re-render correctly, especially store actions used as query getters and subscriptions to stable function references.

## Vite config

The project uses `vite.config.ts` with React and several project-specific plugins.

### Server settings

| Setting | Value |
|---|---|
| port | `3000` |
| host | `0.0.0.0` |
| allowedHosts | `true` |
| ignored watch path | `**/runs/**` |

### Resolve settings

| Setting | Value |
|---|---|
| alias | `@` → repository root |
| dedupe | `react`, `react-dom`, `lucide-react` |
| optimizeDeps exclude | `@sqlite.org/sqlite-wasm` |

`@sqlite.org/sqlite-wasm` is excluded so its own `new URL("sqlite3.wasm", import.meta.url)` path resolves beside the package assets instead of Vite's optimized dependency cache.

## Vite plugins

| Plugin | Dev | Build/preview | Purpose |
|---|---|---|---|
| `tailwindCliPlugin` | Builds `index.css`, then starts a Tailwind CLI watcher. | Builds `index.css` during `buildStart`. | Uses Tailwind CSS v4 CLI instead of the JS plugin. |
| `react()` | yes | yes | React transform and Fast Refresh. |
| `accessLogPlugin` | yes | preview | Logs method, URL, status, and timing. |
| `serveAppAssetsPlugin` | yes | build | Serves or emits app-owned assets under `/@app-assets/<AppName>/...`. |
| `serveCdnPlugin` | yes | preview | Maps `/cdn/` to repo-local `mobilegym-data/`. |
| `listPublicFilesPlugin` | yes | no | Provides `/api/list-public-files` for local viewers. |
| `fileSystemPlugin` | yes | build | Provides `/api/sdcard` in dev and emits `sdcard/manifest.json` in builds. |
| `runsExplorerPlugin` | yes | no | Provides `/api/runs` for local run exploration. |
| `apiGatewayPlugin` | yes | preview | Provides `/api/gw/<service>/...` same-origin gateway endpoints. |

## App assets

App-owned binary assets should live under:

- `apps/<AppName>/assets/`
- `system/<AppName>/assets/`

They are available through stable URLs:

```text
/@app-assets/<AppName>/<path>
```

WMR bundles owned by an app may live under:

```text
apps/<AppName>/wmr/
system/<AppName>/wmr/
```

and are served as:

```text
/@app-assets/<AppName>/wmr/<path>
```

In dev, the plugin serves files from disk. In production builds, it emits them into `dist/@app-assets/`.

Prefer Vite imports for ordinary component assets when possible. Use the stable URL path when a subsystem needs a URL string, such as WMR XML/image resources.

## CDN data

`serveCdnPlugin` maps:

```text
/cdn/<path>
```

to:

```text
mobilegym-data/<path>
```

The helper in `os/utils/cdn.ts` should be used when runtime code needs URLs for this local/production-compatible data root. The middleware answers HTTP Range requests (206 / 416) like nginx, so `<video>` seeking works in dev. What goes under this root, and who resolves references to it, is in [`../app/media-assets.md`](../app/media-assets.md).

## Virtual SD card

`fileSystemPlugin` scans `public/sdcard`.

| Endpoint/artifact | Behavior |
|---|---|
| `GET /api/sdcard` | Dev-only JSON listing of files and directories. Cached until watched files change. |
| `dist/sdcard/manifest.json` | Build artifact emitted from the same scan logic. |

The scanner intentionally keeps system-style dot directories such as `.data` and `.cache`, but skips known noise files like `.DS_Store` and `.manifest.json`.

## API gateway

`apiGatewayPlugin` is the same-origin gateway used by `NetworkService`.

| Service | Endpoint | Notes |
|---|---|---|
| `fetch` | `POST /api/gw/fetch` | JSON payload with `url`, `method`, `headers`, and string `body`. |
| `proxy` | `/api/gw/proxy?url=https://...` | Streams requests/responses for assets and non-string bodies. |

`VITE_GW_ALLOW_HOSTS` can be set to a comma-separated host allowlist. If it is empty, dev mode allows all hosts.

The gateway keeps a server-side cookie jar per `x-gw-session` and contains defensive handling for upstream compression, aborts, retries, and repeated 404 image/video fetches.

## Navigation graph

There is no static navigation graph; explore a running app instead:

```bash
python scripts/explore_nav_graph.py http://localhost:3000/ <appId> out.json
python scripts/explore_nav_graph.py --diff before.json after.json
```

See [`../navigation/routes.md`](../navigation/routes.md).

## WMR tooling

WMR is the Widget Markup Runtime used by launcher widgets and app-owned canvas widgets.

Current implementation lives under:

| Area | Files |
|---|---|
| Widget discovery | `os/wmr/WmrWidgetService.ts` |
| Bundle loading/cache | `os/wmr/WmrBundleCache.ts` |
| XML parser | `os/wmr/engine/parser.ts` |
| Expression/variable runtime | `os/wmr/engine/expression.ts`, `os/wmr/engine/variables.ts` |
| Canvas renderer | `os/wmr/engine/renderer.ts`, `os/wmr/WmrRenderer.tsx` |
| Content providers | `os/wmr/engine/contentProviders.ts` |
| Perf metrics | `os/wmr/WmrPerf.ts` via `window.__WMR_PERF__` |

Theme widgets are listed from `cdn('themes')/manifest.json`. App-owned WMR bundles can use inline sources and `/@app-assets/<AppName>/wmr/...` URLs.

## i18n tooling

OS-level i18n lives in:

| File | Role |
|---|---|
| `os/locale.ts` | Locale state, backed by `OsStateStore.settings.global.language`. |
| `os/i18n/index.ts` | `useOsT()`, `osT()`, and app-name localization helpers. |
| `os/i18n/en.ts` | English dictionary and `patchAppNames()`. |
| `os/PackageManagerService.ts` | Auto-discovers manifests and patches `displayNameEn` into the English dictionary. |

Manifest `displayNameEn` values are injected automatically; new apps should not edit `os/i18n/en.ts` just to add their app name.

## Validation checklist

| Change type | Suggested check |
|---|---|
| Routes or jumps | `npx tsc --noEmit`, then explore the app before / after (`scripts/explore_nav_graph.py --diff`) |
| Runtime TypeScript behavior across several files | `npx tsc --noEmit` |
| OS/app runtime code | `npm run lint` |
| System app runtime code | `npx eslint system/` |
| Store action/query selector changes | `node scripts/lint_store_getters.mjs [AppName...]` |
| Bench tasks | Follow `bench_env/docs/task/` guides before editing or running tasks. |

## New app checklist

Use this as the compact version of the app onboarding checklist:

| Area | Check |
|---|---|
| Manifest | `manifest.ts` exports `manifest`, has a unique `id`, `displayName`, `displayNameEn`, icon, theme, and any `intentFilters`. |
| Entry component | `<Name>App.tsx` matches `*App.tsx`, has a default export, wraps routes in `MemoryRouter`, and calls `useAppNavigationHandler` inside the router. |
| Navigation | Every page and discrete UI state is in `routes.ts`; jumps use `bindNav` / `nav`. |
| Business navigation | Pages use `bindNav` / `nav` from the gesture hook, never direct `useNavigate()` imports. |
| DOM tagging | Interactive controls use gesture hooks so they emit `data-trigger*` or `data-action*`; back/close controls bind `system.back`. |
| Data | Structural constants live in `constants.ts`; replaceable runtime defaults live in `data/defaults.json`; `data/index.ts` exports `<APPNAME>_CONFIG`. |
| Large data | Big public datasets stay out of `defaults.json`; add `loader.ts` and decide hook vs store-action vs service consumption. |
| Store | `state.ts` uses `createAppStore*` with the same appId as `manifest.id`; `_temp` is reserved for transient UI state. |
| Resources | App icons are `Ic*` aliases in `res/icons.tsx`; data-driven icon names also use `Ic*`. |
| UI chrome | Page roots reserve status bar space and declare status/navigation bar foreground when needed. |
| Keyboard | Bottom input bars use flex layout plus `data-keep-keyboard`; tab bars that should disappear use `data-hide-on-keyboard`. |
| Validation | Run `npx tsc --noEmit` and explore the app after navigation changes; run lint when the runtime change is broad. |
