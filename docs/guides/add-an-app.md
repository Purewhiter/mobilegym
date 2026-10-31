# Add a New App

This guide walks you through adding a brand-new app to the MobileGym simulator.  Plan on an hour for a minimal app, longer for one with rich features.

> 📐 For the formal contract and edge cases, see [`../platform/app/module-contract.md`](../platform/app/module-contract.md). Layered state and snapshots are in [`../platform/state/model.md`](../platform/state/model.md). Routes and jumps are in [`../platform/navigation/routes.md`](../platform/navigation/routes.md).

## Where apps live

| Kind                | Directory          | Examples                        |
| ------------------- | ------------------ | ------------------------------- |
| Daily / third-party | `apps/<Name>/`   | WeChat, Alipay, Bilibili        |
| System              | `system/<Name>/` | Settings, Contacts, AnswerSheet |

The OS auto-discovers both with Vite glob patterns for `apps/*/manifest.ts`, `system/*/manifest.ts`, `apps/*/*App.tsx`, and `system/*/*App.tsx`. **You never edit any registry file.**

## Step 1 — Create the directory and manifest

```bash
mkdir -p apps/Habits/{pages,res,data,hooks}
```

Write `apps/Habits/manifest.ts`:

Create `apps/Habits/res/icons.tsx` first (or copy an existing app's icon file and rename the exports) so the manifest can import an app-owned launcher icon:

```tsx
import { CheckCircle2 } from 'lucide-react';

export const IcLauncher = CheckCircle2;
```

```ts
import type { AppManifest } from '@/os/types/manifest';
import { IcLauncher } from './res/icons';

export const manifest: AppManifest = {
  id: 'habits',                       // appId — must be unique, also the localStorage key
  packageName: 'com.example.habits',
  displayName: '习惯',                // user-facing zh name
  displayNameEn: 'Habits',            // user-facing en name (auto-injected into OS i18n)
  aliases: ['habit tracker'],         // searchable aliases (auto-injected into OS lookup)
  version: '1.0.0',
  versionCode: 1,
  type: 'plugin',                     // 'plugin' for daily/third-party apps, 'system' for system apps
  icon: IcLauncher,
  iconBackground: '#10b981',
  iconForeground: '#ffffff',
  designViewportWidth: 360,           // CSS zoom anchor; 360 matches a typical phone
  theme: {
    colors: {
      primary: '#10b981',
      background: '#f6f7f9',
      surface: '#ffffff',
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  intentFilters: [
    // Optional: deep-link or share-handling routes
  ],
};
```

The `id` field is your **appId** — it's the localStorage key, the URL anchor, and the only handle other code uses to refer to your app.

## Step 2 — Add the entry component

`apps/Habits/HabitsApp.tsx`:

```tsx
import { useCallback, useContext, useEffect, useRef } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useLocation, UNSAFE_NavigationContext } from 'react-router-dom';
import { useAppNavigationHandler } from '@/os/hooks/useAppNavigationHandler';
import { manifest } from './manifest';
import { useNav } from '@/os/navigation';
import { routes } from './routes';
import HomePage from './pages/HomePage';
import NewHabitPage from './pages/NewHabitPage';

function HabitsNavigationHandler() {
  const location = useLocation();
  const nav = useNav();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const memoryNavigator = navigator as { index?: number };
    if (typeof memoryNavigator.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as { index?: number };
    const currentIndex =
      typeof memoryNavigator.index === 'number'
        ? memoryNavigator.index
        : historyIndexRef.current;

    if (currentIndex > 0) {
      nav.back();
      return true;
    }

    if (location.pathname !== '/') {
      nav.replace(routes.home);
      return true;
    }

    return false;
  }, [nav, location.pathname, navigator]);

  useAppNavigationHandler(manifest.id, {
    onBack: handleBackPress,
    onNavigate: (path, navigateToPath) => {
      navigateToPath(path.startsWith('/') ? path : `/${path}`);
    },
  });

  return null;
}

function HabitsAppInner() {
  return (
    <>
      <HabitsNavigationHandler />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new" element={<NewHabitPage />} />
      </Routes>
    </>
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

> ⚠️ **The file name must match `*App.tsx`** and the component must be `export default`. That's how the OS discovers it.

> 🚫 **Business pages should never call `useNavigate()` from `react-router`.** Keep raw router access inside the app-level navigation handler; pages use `bindNav` / `nav` from your gesture hook.

## Step 3 — Write the route table

List every page and the discrete UI states it keeps in its URL. Jumps are written in the pages against this table; there is no transition table.

`apps/Habits/routes.ts`:

```ts
import { defineRoutes } from '../../os/navigation/routes';

export const routes = defineRoutes({
  home: { path: '/' },
  newHabit: { path: '/new', search: { sheet: ['icons'] } },
  habit: { path: '/habit/:habitId' },
});
```

`apps/Habits/hooks/useHabitsGestures.ts`:

```ts
import { useNavGestures } from '../../../os/navigation';

export function useHabitsGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}
```

In a page: `<button {...bindNav(routes.newHabit)}>`, `<li {...bindNav(routes.habit, { params: { habitId } })}>`, `nav.replace(routes.home)` in handlers, `<button {...bindBack()}>` for back. Route params and declared UI-state values are type-checked. See [`../platform/navigation/routes.md`](../platform/navigation/routes.md).

## Step 4 — Build the pages

Write your pages under `apps/Habits/pages/`. Three rules to keep you out of trouble:

1. **Reserve the status bar.** Every page's outermost container needs `pt-10` and (if it's not dark) a `data-status-bar-foreground="dark|light"` attribute.
2. **Drive every discrete UI state through the URL.** Tabs, modals, sheets — open them with `bindNav` / `nav.push` and a `search` value. Never use `useState` for visibility, the back key will betray you.
3. **Tag the controls.** Navigate with `bindNav` / `bindBack` and bind actions with `bindTap({ kind: 'action', id })`, so every control emits `data-trigger` / `data-action` attributes. Exploration and trajectory tools find controls through them.

## Step 5 — Add data and state

Two files:

`apps/Habits/data/defaults.json`:

```json
{
  "user": { "name": "你", "streak": 3 },
  "habits": [
    { "id": "h1", "title": "喝水", "doneToday": false },
    { "id": "h2", "title": "走 5000 步", "doneToday": true }
  ]
}
```

`apps/Habits/data/index.ts`:

```ts
import defaults from './defaults.json';
import { manifest } from '../manifest';

export const HABITS_CONFIG = {
  ...defaults,
  appId: manifest.id,
};
```

Then a Zustand store under `apps/Habits/state.ts` (auto-discovered like `manifest.ts`):

```ts
import { createAppStoreWithActions } from '@/os/createAppStore';
import { HABITS_CONFIG } from './data';

type Habit = (typeof HABITS_CONFIG.habits)[number];

interface HabitsState {
  habits: Habit[];
}

interface HabitsActions {
  toggleDay: (id: string) => void;
}

const initialState: HabitsState = {
  habits: HABITS_CONFIG.habits,
};

export const useHabitsStore = createAppStoreWithActions<HabitsState, HabitsActions>(
  'habits',
  initialState,
  (set) => ({
    toggleDay: (id: string) =>
      set((s) => ({
        habits: s.habits.map((h) =>
          h.id === id ? { ...h, doneToday: !h.doneToday } : h,
        ),
      })),
  }),
);
```

> ⚠️ **The first argument to `createAppStoreWithActions()` must equal `manifest.id`** — the OS uses it as the localStorage key, the store registry key, and the `__SIM__.getState().apps.<appId>` snapshot key.

## Step 6 — Validate

```bash
# Type check
npx tsc --noEmit

# Explore the app's navigation on a running dev server
python scripts/explore_nav_graph.py http://localhost:3000/ habits /tmp/habits.json
```

The exploration lists every tagged control, where tapping it lands, and where system back then lands. A page you expected but that is missing usually means a control navigates through a plain `onClick` instead of `bindNav`.

## Step 7 — Smoke-test in the simulator

```bash
npm run dev
```

Open `http://localhost:3000`. Your app should appear in the launcher with the icon and theme you specified. Tap through every route, then in the DevTools console:

```js
__SIM__.getState().apps.habits
// → your runtime overlay snapshot, exactly as the benchmark will see it
```

## Common pitfalls

- **`data-trigger` is dynamic.** The analyzer can't follow `data-trigger={\`habits.${kind}\`}`. Hard-code the literal.
- **You used `useNavigate()` in a business page.** Replace it with `bindNav` / `nav` so the control stays visible to exploration.
- **Dialog visibility from `useState`.** Press the back key and the dialog stays open — the OS's `BackDispatcher` doesn't know about your local state. Push a `searchParams` entry instead.
- **Imported `BackDispatcher` directly.** That's an OS-internal module. Apps interact with back through the URL/history.
- **`Date.now()` or `new Date()`.** Always go through `TimeService` (`TimeService.now()`, `TimeService.fromTimestamp(ts)`, …). The lint rule will reject the raw form.
- **Position-fixed bottom bars.** Forbidden — they break the keyboard's `adjustResize`. Use a flex layout with `flex-shrink-0`.

## Where to go next

- 🧪 Add tasks for your new app → [add-a-task.md](add-a-task.md)
- 📊 Want your app on the public leaderboard's task surface? Open a discussion issue with the proposed task set.
- 📐 Deep dives: [`app-module-contract.md`](../platform/app/module-contract.md) (file conventions, hooks, cross-cutting rules), [`state-model.md`](../platform/state/model.md) (layered state, snapshots), [`routes.md`](../platform/navigation/routes.md) (route tables, jumps, exploring the graph), [`intent-system.md`](../platform/os/intent-system.md) (cross-app calls).
