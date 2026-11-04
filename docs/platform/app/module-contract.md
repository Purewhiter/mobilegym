# App Module Contract

The rules every app obeys to integrate with the MobileGym OS. The OS auto-discovers apps at compile time; in exchange, each app honors a small set of file conventions, runtime hooks, and stylistic constraints. This document is the formal version of [getting-started/add-an-app](../../guides/add-an-app.md) — read the tutorial first if you haven't.

## File layout

An app lives under `apps/<Name>/` (third-party / daily app) or `system/<Name>/` (system app). The OS treats both directories identically; they're separated only for organization.

```
apps/<Name>/
├── manifest.ts                   # required — identity, theme, intent filters
├── <Name>App.tsx                 # required — entry component, *App.tsx pattern, default export
├── routes.ts                     # required — route table: pages + URL UI states
├── hooks/use<Name>Gestures.ts    # required — wraps useNavGestures (bindNav / bindBack / nav)
├── state.ts                      # optional — Zustand store (auto-discovered)
├── res/                          # resources — colors, dimens, strings, icons
│   ├── icons.tsx                 # required if you use any icons by name
│   ├── colors.ts                 # optional — Tier-2 component colors
│   ├── dimens.ts                 # optional — reused layout sizes
│   ├── strings.ts                # optional — string table (zh default, .en for English)
│   └── colors.states.ts          # optional — dark-mode overrides
├── assets/                       # binary resources (imported, not URL-loaded)
├── data/
│   ├── index.ts                  # merge constants + defaults → <APPNAME>_CONFIG
│   ├── defaults.json             # replaceable initial runtime state
│   └── *.json or loader.ts       # optional — large world data (lazy-loaded)
├── types.ts                      # app-level TypeScript types
├── constants.ts                  # structural constants (tabs, feature flags)
├── context/<Name>Context.tsx     # optional — React Context provider for app state
├── hooks/
│   └── use<Name>Gestures.ts      # app-specific gesture hook wrapping useTriggerGestures
├── pages/                        # page components
└── components/                   # shared in-app components
```

Anything outside this contract is up to you. The framework only cares about the bolded "required" files plus a couple of cross-cutting conventions described below.

## `manifest.ts`

The identity card. Mirrors the Android `AndroidManifest.xml` plus theme info.

```ts
import type { AppManifest } from '@/os/types/manifest';
import { IcLauncher } from './res/icons';

export const manifest: AppManifest = {
  id: 'habits',                    // appId — unique, also the localStorage key
  packageName: 'com.example.habits',
  displayName: '习惯',
  displayNameEn: 'Habits',         // injected into OS i18n; no os/i18n/en.ts edit
  aliases: ['habit tracker'],      // injected into OS app lookup
  version: '1.0.0',
  versionCode: 1,
  type: 'plugin',                  // 'plugin' for daily apps, 'system' for system apps
  icon: IcLauncher,
  iconBackground: '#10b981',
  iconForeground: '#ffffff',
  designViewportWidth: 360,        // anchor for CSS-zoom display scaling
  theme: {
    colors: {                       // Tier-1 semantic colors → CSS variables
      primary: '#10b981',
      primaryDark: '#0e9e74',
      background: '#f6f7f9',
      surface: '#ffffff',
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
    colorsDark: { /* optional dark-mode overrides */ },
  },
  intentFilters: [                  // what this app receives
    { action: 'ACTION_SEND', type: 'text/plain', route: '/share', description: 'Receive shared text' },
  ],
  queries: [                        // what this app emits (so OS can resolve our outbound intents)
    { action: 'ACTION_VIEW', scheme: 'https' },
  ],
};
```

Rules:

- `id` is the **appId** — every cross-reference (`__OS__.openApp('habits')`, the localStorage key, `apps.habits` in `__SIM__.getState()`) uses this string. Lowercase, no spaces.
- The directory name doesn't have to equal `id` — `apps/Wechat/` has `id: 'wechat'`. OS maps directory → id via the manifest.
- `theme.colors` gets injected as CSS custom properties (`--app-primary`, `--app-text-primary`, …). Tailwind classes like `text-app-primary` are wired in `app.css` via Tailwind v4 `@theme inline`.
- `displayNameEn` is auto-merged into the OS English string table — you don't edit `os/i18n/en.ts`.
- `intentFilters` declares the intents you can receive; `queries` declares the intents you might send (so the OS can statically know your outbound surface).

## `<Name>App.tsx`

The entry component. The filename **must** end in `App.tsx` and the component **must** be the file's default export — that's how `import.meta.glob('apps/*/*App.tsx')` finds it.

```tsx
import { MemoryRouter, Route, useLocation } from 'react-router-dom';
import { ActivityRouteHost } from '@/os/components/ActivityRouteHost';
import { useAppNavigationHandler } from '@/os/hooks/useAppNavigationHandler';
import { manifest } from './manifest';
import { useNav } from '@/os/navigation';
import HomePage from './pages/HomePage';
import NewHabitPage from './pages/NewHabitPage';

function HabitsAppInner() {
  const location = useLocation();
  const { back } = useNav();

  useAppNavigationHandler(manifest.id, {
    onBack: () => {
      if (location.pathname === '/' && !location.search) return false;
      back();
      return true;
    },
  });

  return (
    <ActivityRouteHost>
      <Route path="/" element={<HomePage />} />
      <Route path="/new" element={<NewHabitPage />} />
    </ActivityRouteHost>
  );
}

export default function HabitsApp() {
  return (
    <MemoryRouter>
      <HabitsAppInner />
    </MemoryRouter>
  );
}
```

Four non-obvious rules:

1. **`useAppNavigationHandler` must be called inside the `MemoryRouter`.** It registers your app's navigator with `AppNavigatorRegistry` (so the OS can `openApp(id, '/some/path')`), wires the app-level back handler (priority 100) into `BackDispatcher`, broadcasts lifecycle events into `AppLifecycle`, and keeps a shadow `HistoryTracker` in sync so `popTo()` works.
2. **No `useNavigate()` from `react-router` in pages.** Use `bindNav` / `nav` from `os/navigation` with the app's route table, so every jump is typed and every control is tagged. See [`../navigation/routes.md`](../navigation/routes.md).
3. **Routed pages that share a layout scroller go in `<RouteScrollContainer>`, never a plain `overflow-y-auto` div** (ESLint blocks `<Outlet />` / `<Routes>` inside one). A plain div survives navigation, so the next page inherits the previous page's `scrollTop`, clamped to its own height. How far it is clamped depends on frame timing (store updates commit at once, react-router commits the route change later in a transition), so identical actions end at different scroll positions from run to run. `RouteScrollContainer` (`os/components/RouteScrollContainer.tsx`) decides the position from the navigation alone: a new page starts at the top, back (POP) returns to where that entry was left, search-only changes (URL dialogs) keep it, and paths in `rememberPaths` (main tabs rendered in the same container) reopen where they were left. It renders `data-scroll-container` (`name`, default `main`) and `data-scroll-direction="vertical"` itself.

```tsx
<RouteScrollContainer className="h-full overflow-y-auto no-scrollbar">
  <Outlet />
</RouteScrollContainer>
```

4. **Routed pages go in `<ActivityRouteHost>` (`os/components/ActivityRouteHost.tsx`), a drop-in for `<Routes>` that keeps the back stack like Fragments.** Every page instance on the Activity's back stack stays mounted; the ones below the top sit hidden in a React `<Activity>` with their state and DOM kept, and their scroll offsets are put back when they are shown again. Back returns to a page as it was left; a new push makes a new instance (A → B → A gives two A's); a run of entries with the same pathname is one instance, so URL dialogs stay in their page. Main tabs go in `persistent` (one instance each, kept across tab switches). A layout route (`<Route element={<Layout />}>`) renders once per instance, so it must render the tab page through `<Outlet />`, not keep its own copies of the tabs. Because a hidden page cleans up its effects and runs them again when shown:
   - an effect that acts (a store write, a jump, a sent message) must be safe to run again, or guard itself with a ref;
   - visible UI must not wait on a timer that an effect cleanup clears (a toast set in a handler and cleared on unmount stays up): give the timer to an effect, as `os/hooks/useTimedToast` does;
   - a throttle ref (`if (ref.current) return; ref.current = requestAnimationFrame(...)`) must be reset in the cleanup that cancels it, or the page stops reacting once shown again;
   - a page that replaces its own URL with another pathname while in use (a new note saved as `/note/<id>`) needs an `identity` that keeps it one instance.

## `routes.ts`

The route table lists every page and the discrete UI states it keeps in its URL:

```ts
// apps/Habits/routes.ts
import { defineRoutes } from '../../os/navigation/routes';

export const routes = defineRoutes({
  home: { path: '/' },
  newHabit: { path: '/new' },
  habit: { path: '/habit/:habitId', search: { sheet: ['edit', 'delete'] } },
});
```

Pages jump against it (`bindNav(routes.habit, { params: { habitId }, search: { sheet: 'edit' } })`, `nav.replace(routes.home)`); path params and declared UI-state values are type-checked. There is no transition table: which control goes where is ordinary code, and the graph of an app is explored from a running simulator. Details in [`../navigation/routes.md`](../navigation/routes.md).

## `state.ts` (optional but standard)

If your app has any in-memory state, create it through the MobileGym app-store factory so the OS can discover, snapshot, reset, and adapt it:

```ts
// apps/Habits/state.ts
import { createAppStoreWithActions } from '@/os/createAppStore';
import { HABITS_CONFIG } from './data';

type HabitsState = {
  habits: Array<{ id: string; doneToday: boolean }>;
};

type HabitsActions = {
  toggleDay: (id: string) => void;
};

export const useHabitsStore = createAppStoreWithActions<HabitsState, HabitsActions>(
  'habits',
  { habits: HABITS_CONFIG.habits },
  (set) => ({
    toggleDay: (id) =>
      set((s) => ({
        habits: s.habits.map(h => h.id === id ? { ...h, doneToday: !h.doneToday } : h),
      })),
  }),
);
```

Two contracts:

1. **The first `createAppStore*` argument is the appId** — it must equal `manifest.id`. It is also the default localStorage key.
2. **Factory registration** — `createAppStore` / `createAppStoreWithActions` registers the store in the app-store registry. The OS eagerly imports `apps/*/state.ts` and `system/*/state.ts`, but a bare Zustand store is not enough for snapshots.

If you want fine-grained control over what gets exposed to `__SIM__.getState()` and what gets reset by `__SIM__.reset()`, use `registerStateAdapter` (see [`../state/model.md`](../state/model.md)).

## `data/` — config-first conventions

The data layer separates **structural constants** (this app's *shape*) from **replaceable runtime state** (this user's *content*).

```
apps/Habits/data/
├── index.ts          # merge entry point
└── defaults.json     # replaceable initial state
```

`data/index.ts`:

```ts
import defaults from './defaults.json';
import { manifest } from '../manifest';
import { HABIT_CATEGORIES } from '../constants';

export const HABITS_CONFIG = {
  ...defaults,
  appId: manifest.id,
  categories: HABIT_CATEGORIES,
};
```

What goes where:

| Where | What |
|---|---|
| `constants.ts` | Tab definitions, service grids, feature flags — anything **the user can't change**. |
| `data/defaults.json` | The initial state for things the user *can* change: their profile, their content, their settings. |
| `apps/<Name>/data/*.json` (and `loader.ts`) | Optional **large world data** — public posts, products, stations, places. Lazily loaded; **not** part of snapshots. |

The full rules for state layering (and why "world data" lives separately) are in [`../state/model.md`](../state/model.md).

## Resources (`res/`)

Aligned with Android's `res/values/*` philosophy but smaller.

### `res/icons.tsx`

```ts
import { CreditCard, Bus } from 'lucide-react';

export const IcCard = CreditCard;
export const IcBus = Bus;

export const ICON_REGISTRY = { IcCard, IcBus };
```

Rules:

- Every exported icon is prefixed `Ic*`.
- `ICON_REGISTRY` keys match the export names exactly (also `Ic*`).
- Inside JSX with a fixed icon, write `<IcCard size={22} />`.
- Inside data files (`constants.ts`, `defaults.json`), reference by name: `"icon": "IcCard"`. Then render with `<IconRenderer name={item.icon} size={22} />`.
- **No raw Lucide names in data files.** A `"icon": "CreditCard"` is a bug — fix the data, don't patch the registry.

### Colors and dimensions

`theme.colors` in `manifest.ts` is **Tier 1** (semantic, exposed as CSS vars). For most apps that's all you need; reach for Tailwind classes (`text-app-primary`, `bg-white`) directly.

#### Tier-1 color tokens (the canonical names)

Every app declares these eight semantic colors (some are optional — listed below). The OS exposes each one as a CSS variable and wires Tailwind utility classes against it:

| `theme.colors` key | CSS var | Tailwind class | Required? | Purpose |
|---|---|---|:---:|---|
| `primary` | `--app-primary` | `text-app-primary`, `bg-app-primary`, `border-app-primary` | ✅ | Brand primary — accents, CTAs, active tabs |
| `primaryDark` | `--app-primary-dark` | `bg-app-primary-dark` | ✅ | Pressed / hover state of `primary` |
| `onPrimary` | `--app-on-primary` | `text-app-on-primary` | optional | Foreground on `primary` background (defaults to white) |
| `background` | `--app-bg` | `bg-app-bg` | ✅ | Page background (the chrome behind cards) |
| `surface` | `--app-surface` | `bg-app-surface` | ✅ | Card / sheet / list-row background |
| `textPrimary` | `--app-text` | `text-app-text` | ✅ | Default body text |
| `textSecondary` | `--app-text-muted` | `text-app-text-muted` | ✅ | Captions, hints, timestamps |
| `border` | `--app-border` | `border-app-border` | ✅ | Hairline separators, card borders |

Status / nav-bar chrome (lifted to the manifest so the OS chrome renders before the app does):

| `theme.colors` key | Values | Purpose |
|---|---|---|
| `statusBarForeground` | `'dark'` \| `'light'` | Foreground color of the OS status bar over this app's chrome |
| `navigationBarForeground` | `'dark'` \| `'light'` | Foreground color of the OS gesture bar |

Optional dark-mode overrides go in `theme.colorsDark` using the **same keys** — only declare the ones that change:

```ts
theme: {
  colors: {
    primary: '#10b981',
    primaryDark: '#0e9e74',
    background: '#f6f7f9',
    surface: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    statusBarForeground: 'dark',
    navigationBarForeground: 'dark',
  },
  colorsDark: {
    background: '#1a1a1a',
    surface: '#2a2a2a',
    textPrimary: '#e5e5e5',
  },
}
```

For one-off page-level overrides of status/nav bar foreground (different page in the same app), use the per-page `data-status-bar-foreground` / `data-navigation-bar-foreground` attributes — see [Cross-cutting rules § 5](#5-status-bar-reserve).

Add `res/colors.ts` only when you have:

- A color a CSS-var name can't express (a 3-stop gradient, a brand-specific shade reused across components).
- A color you need to swap between light/dark mode programmatically.

Add `res/dimens.ts` only when a layout dimension is **reused in 3+ places** (e.g. list item heights consumed by `react-virtual`). One-off sizes belong inline.

> ⚠️ **Pixel math must use CSS vars or `h-[Npx]`, never Tailwind rem classes.** If you compute `scrollTop = i * itemHeight` in JS, the element's height must come from a CSS variable or arbitrary pixel value — not `h-10` / `h-14`. Browsers with a non-16-px default font size break rem-to-pixel mapping, and your JS scroll offsets drift.

### Strings

`res/strings.ts` is optional. If you have user-visible strings that need i18n, drop them there with `STR.foo` and an optional `strings.en.ts` override file. App code selects the right variant with `useAppStrings(strings, stringsEn)`, which reads `OsStateStore.settings.global.language` through `useLocale()`.

## Cross-cutting rules

Some constraints apply uniformly across every app. They're worth memorizing because the lint rules and code review will reject violations.

### 1. Time, location, network — through OS services only

```ts
// ❌ blocked by lint
const t = Date.now();
const d = new Date();

// ❌ blocked by platform convention / code review
navigator.geolocation.getCurrentPosition(...);
fetch('https://external.example.com/api');

// ✅ correct
import * as TimeService from '@/os/TimeService';
import * as LocationService from '@/os/LocationService';
import { netJson } from '@/os/NetworkService';

const t = TimeService.now();
const realT = TimeService.realNow();          // when you need real elapsed time
const coords = LocationService.getSimulatedCoords(); // LocationCoords | null
const data = await netJson('https://external.example.com/api');
```

Why: the benchmark needs to replay deterministic time, override location for reproducibility, and route external HTTP through a same-origin gateway with a per-session cookie jar. Direct browser APIs defeat all three.

### 2. Discrete UI states go through the URL

Tabs, modals, sheets, drawers — anything that's "in a state, then in another state" — push or replace through `bindNav` / `nav` with a `search` value. Never use `useState` for visibility.

The back key listens to history, not React state. A `useState`-driven dialog **leaks through back press**: the user pushes back, the dialog stays open, the previous page navigates away. Push a `searchParams` entry instead; closing the dialog is just `back()`.

### 3. No direct `BackDispatcher` import

`BackDispatcher` is an OS internal. Apps interact with the back key through the URL stack and through their own `back()` helper.

### 4. Pointer events for drag / swipe / slider

```ts
// ✅
onPointerDown, onPointerMove, onPointerUp, onPointerCancel
// + setPointerCapture(e.pointerId) when continuous tracking matters

// ❌
onTouchStart + onMouseDown side-by-side
touchmove + click as desktop fallback
```

Mixing the two event families silently misroutes input on hybrid devices (touch laptops, Playwright with `--mobile`). Pointer events unify both.

### 5. Status bar reserve

Every page's outermost element needs `pt-10`. If the chrome's foreground (white text on dark, dark text on light) differs from the default, set `data-status-bar-foreground="dark|light"` on that same outer element.

### 6. Keyboard auto-resize, no fixed bottom bars

The OS implements `adjustResize`: when the keyboard is up, the active Activity container shrinks by the keyboard height. Flex layouts automatically reflow.

Don't use `position: fixed; bottom: keyboardHeight` for chat input bars — the CSS-zoom anchor (`designViewportWidth`) and the keyboard height interact badly. Use a flex layout with `flex-shrink-0` for the input bar and let `adjustResize` do its job.

If you have elements that should disappear when the keyboard is up (a bottom TabBar that doesn't make sense above the keyboard), add `data-hide-on-keyboard` and the OS hides them via global CSS.

For the full keyboard, IME, smart-scroll, and pointer-event contract, see [`../os/services/input-keyboard.md`](../os/services/input-keyboard.md).

## How discovery works (so you can debug failures)

If your app doesn't show up, walk through the checklist:

1. **Filename** — entry component must end in `App.tsx` (for example `HabitsApp.tsx`). The glob matches `*App.tsx`; lowercase prefixes are technically matched too, but use the app's PascalCase name for consistency.
2. **Default export** — the component must be `export default`. Named exports are ignored.
3. **Manifest export** — `apps/<Name>/manifest.ts` exports `export const manifest = …`. A wrong export name is silently skipped.
4. **`id` uniqueness** — duplicate `id`s across two manifests are invalid and can cause one manifest to overwrite another in package lookup maps. Search `apps/ system/ -name manifest.ts` if you suspect collision.
5. **Vite cache** — after adding a new file, restart `npm run dev`. `import.meta.glob` is resolved at build time; HMR catches edits but not new entries.

## Foreign-task isolation (advanced)

When `startActivityForResult` pushes an Activity from app B onto app A's Task (e.g. Alipay pushed onto 12306 for a payment), app B may be mounted in a foreign Task context. If app B already has its own background Task, both contexts can exist simultaneously:

- App B's "own" task (background, only if it already existed)
- App A's task with App B pushed on top

`useAppNavigationHandler` detects the foreign case (`task.rootAppId !== appId`) and **skips** the app-level navigator/back/lifecycle registration. Only the Activity-level navigator (registered separately by the activity-specific handler) is used. This keeps the background instance's registrations intact.

You usually don't need to think about this — it Just Works — but if you're debugging "why did calling `goBack()` in my app navigate the wrong app's URL," foreign-task isolation is the place to look.

## Where to go next

- 🎯 Route tables, jumps and exploring an app's graph → [`../navigation/routes.md`](../navigation/routes.md)
- 🗃️ State, snapshots, world data vs. runtime overlay → [`../state/model.md`](../state/model.md)
- 🚧 Cross-app calls (intents, launchMode, choosers) → [`../os/intent-system.md`](../os/intent-system.md)
- 🧭 Cross-app Task/back-stack traces → [`../os/cross-app-launch.md`](../os/cross-app-launch.md)
- 🛰️ The OS services your app consumes → [`../os/services/`](../os/services/)
- 📱 Tutorial walkthrough → [`../../guides/add-an-app.md`](../../guides/add-an-app.md)
