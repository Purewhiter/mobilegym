# State Model

How MobileGym represents, persists, snapshots, diffs, and resets the entire device's state. This is the trick that makes deterministic judging cheap and parallel RL rollouts cloneable in milliseconds.

> 🧬 **One sentence.** Every app separates a small, mutable **runtime overlay** from large, mostly-read-only **world data**. Only the overlay enters snapshots. The benchmark diffs initial vs. final overlays to judge.

## Where state lives

```
┌──────────────────────────────────────────────────────────────────┐
│ Per-app                                                          │
│   apps/<App>/state.ts             Zustand store, persisted       │
│   apps/<App>/data/defaults.json   initial runtime values         │
│   apps/<App>/data/*.json         "world data" (lazy-loaded,     │
│                                    NOT in snapshots)             │
│   apps/<App>/data/loader.ts       optional dynamic loader        │
├──────────────────────────────────────────────────────────────────┤
│ OS                                                               │
│   os/OsStateStore.ts              settings/hardware/perms/prefs  │
│   os/managers/*Manager.ts         write facades over OsStateStore│
│   os/providers/*Provider.ts       shared content (Contacts/SMS/  │
│                                    Media), each persists itself  │
│   os/data/defaults.json           initial OS values              │
├──────────────────────────────────────────────────────────────────┤
│ Services (volatile)                                              │
│   NotificationService, KeyboardService, PermissionService,       │
│   SystemShadeService, LocationService runtime, TaskManager       │
└──────────────────────────────────────────────────────────────────┘
```

## The two layers, per app

Every app's data has two **horizontal** layers. This is the most important concept in MobileGym.

### World data (read-mostly, off-snapshot)

Large public entities the app displays: posts, products, train stations, places, songs. They're shared across runs and across users.

- Lives in `apps/<App>/data/*.json` or via a `loader.ts` that fetches on demand.
- Loaded via `import data from './data/posts.json'` (Vite bundles it) or async via `loader.fetchPosts()`.
- **Not persisted to localStorage.** **Not part of snapshots.** Refreshing the browser doesn't reset it because it's not stored — it's just bundled assets.

### Runtime overlay (small, mutable, in-snapshot)

Per-environment state the agent can affect: the current user's profile and settings, drafts, likes, sent messages, edits to specific world entities, created entities.

- Lives in `apps/<App>/state.ts`, persisted to localStorage at the `<appId>` key.
- Initialized from `apps/<App>/data/defaults.json` (also small — only the seed values).
- **Persisted.** **Part of `__SIM__.getState().apps.<appId>`.** **Reset by `__SIM__.reset()`.**

### Composition at render time

The view layer combines world + overlay, with the overlay taking precedence. The typical pattern is a **resolver**:

```ts
// apps/RedNote/data/index.ts (sketch)
import basePosts from './posts.json';                       // world data
import { useRedNoteStore } from '../state';                  // overlay

export function resolvePost(id: string) {
  const overlay = useRedNoteStore.getState().postOverlays[id];   // partial mutation
  const base = basePosts.find(p => p.id === id);
  return { ...base, ...overlay };                                 // overlay wins
}
```

So **base + overlay** is what the agent sees on-screen, but only **overlay** is what the judge inspects.

### Why this matters

The benchmark snapshots an environment, runs an episode, snapshots again, diffs the two. If world data were in the snapshot, the diff would be huge and the judge would have to filter out signal from noise. By **excluding** world data from snapshots, we get:

- Sub-millisecond serialization (snapshots are tiny — kilobytes, not megabytes).
- Sub-millisecond comparison (diff a few hundred fields, not a few hundred thousand).
- A clean **side-effect** signal: any mutation outside the task's `expected_changes` was an unintended consequence, no matter how small.

## Layered entity rules

A few rules govern how world entities and runtime entities relate. Get these wrong and your judge will read the wrong source of truth.

### Entity isomorphism

World data and runtime data use the **same schema** for the same entity type. They differ in scope, not shape:

```text
basePosts[id]        public-world posts        (apps/<App>/data/*.json, off-snapshot)
state.posts[id]      runtime overlay          (in snapshot, persisted)
                       — create / scenario-injected / override / hide a base post
```

A resolver composes them with overlay-wins precedence:

```ts
function resolvePost(id: string) {
  const overlay = state.posts[id];
  if (overlay === null) return null;                  // tombstone — base hidden
  if (overlay !== undefined) return overlay;          // full overlay (covers base)
  return basePosts[id] ?? null;                       // base falls through
}
```

Overlay-completeness rule — overlays must store **complete entities** at all times:

| `state.posts[id]` | `basePosts[id]` | Meaning |
|---|---|---|
| object (full entity) | exists | Full override of the base entity |
| object (full entity) | absent | Runtime-only entity (must satisfy schema's required fields) |
| `null` | exists | Tombstone — base entity is hidden / deleted |
| absent | exists | Plain base, no runtime change — `view_post(id)` falls back to base |
| absent | absent | No such entity |

Why "complete entities only" matters: `__SIM__.setState({ ...patch }, { deep: true })` is a write command, **not** a long-term data shape. Deep-merging a partial onto an absent overlay would silently create a runtime entity that fails the schema. To inject a scenario, read the full entity through the App accessor first (`base_note("id")` or `view_note("id")`), mutate fields, then write the full entity back.

`setState` deep-merge semantics:

| Patch value | Effect |
|---|---|
| `object` | Deep merge into the existing object |
| `undefined` | No-op (preserves existing value) |
| `null` | Writes `null` explicitly — usable as tombstone |
| `array` | Whole-array replace |
| primitive | Whole-value replace |

The rule generalizes to every "public world + current-user runtime" entity: posts / notes / comments / users / videos / products / songs / playlists / places / orders. Docs may call the static side the "static data layer"; in App and bench accessors, prefer the `base_*` naming, **not** `static_*`.

### Field ownership: IDs vs. full copies

If a runtime entry **refers to** a base entity, store **only the ID** (and the relationship state), not a copy of the entity:

```jsonc
// ✅ — runtime only holds the relationship
"user": {
  "savedPostIds":      ["post_1"],
  "followedUserIds":   ["user_1"],
  "joinedCommunityIds":["com_games"]
}
```

```jsonc
// ❌ — copying full base entities into runtime
"user": {
  "likedPosts": [
    { "id": "post_1", "title": "...", "content": "..." }
  ]
}
```

Copies create sync hazards: when titles / counts / authors are edited later, two places now disagree on what's true.

If a runtime entry **is** an entity (created by the simulated user, or scenario-injected and not in base), store the **full entity** plus a user-side ID index:

```jsonc
{
  "user": {
    "postIds":    ["my_post_1"],
    "commentIds": ["my_comment_1"]
  },
  "posts": {
    "my_post_1": { "id": "my_post_1", "subreddit": "r/self", "author": "...", "title": "...", "content": "..." }
  },
  "comments": {
    "my_comment_1": { "id": "my_comment_1", "postId": "post_1", "author": "...", "body": "..." }
  }
}
```

This is the **entity-table + user-index pattern** (the preferred shape). The alternative — a `createdPosts: [{full entity}]` array — is shorter to write but leads to one-off `createdX` fields per entity type, loses base/overlay symmetry, and complicates aggregation. Use the entity-table pattern for any non-trivial app.

### User-managed content judgment

Whether an entity "belongs to the current user" cannot be inferred from "does it appear in `state.<entities>`?" alone. `state.posts` can contain runtime overlays for *other* users (scenario data, base overrides). The ownership test is **both** conditions:

1. The user-side index lists the ID — `user.postIds.includes(id)`, `user.commentIds.includes(id)`, etc.
2. The entity's author field matches the current user — `post.author === user.username`.

This means: deletion / edit / "show me my posts" judges must check both. It also means base-dataset posts are public world data — they are **not** editable or deletable as if they were the user's, even if the simulated user is their nominal author.

Implication for task design: if a task requires the user to delete or edit "their own" content, the seed data for that content must live in runtime state (`defaults.json` plus the user-side index), not in base JSON.

### Aggregated counts — derive, don't write back

Counts on public entities (`likes`, `comments`, `upvotes`, `retweets`) are public-world numbers. The current user's contribution is layered on top at render / judge time:

```text
display_likes(id)    = base_likes(id) + (id ∈ user.likedPostIds ? 1 : 0)
display_comments(id) = base_comment_count(id) + runtime_comments_for_post(id).length
```

Rules:

- **Never overwrite `base_post.likes` on user action.** Update `user.likedPostIds` instead. The view layer / accessor derives the visible total.
- **`view_*` accessors apply the derivation.** Both the App UI and `bench_env/task/<app>/app.py` must agree on the formula.
- **Operate judges read the user-side state, not the count.** "Did they like this post?" → `state.user.postVotes[post_id] == "up"`, never "did `base_post.upvotes` go up by 1?" — base aggregates may be strings / abbreviations / async.

If you want the initial UI to display N likes with the user already having liked, set the base count to N-1 and let `user.likedPostIds` contribute the final one.

### View accessors (the bench-facing surface)

`view_*` is the shared display contract between the simulator front-end and `bench_env/task/<app>/app.py`. Both sides resolve to the same view-of-the-world that the user / agent actually sees.

| Accessor | When to use |
|---|---|
| `view_<entity>(id)` | Default task-side read (queries, answers, sampling candidates). Returns the resolved view: base + overlay + tombstone semantics. |
| `state_user()` | Operate judging. Returns the runtime user record (`postIds`, `likedPostIds`, etc.). |
| `state_<entity>(id)` | Entity-level create / update / delete judging. Returns the runtime-overlay entry only (no base fallback). |
| `base_<entity>(id)` | Internal helper inside `app.py`. **Do not call from `task.py` / `defs.py`.** Use it inside the accessor to build search indexes, then return `view_<entity>(id)` to callers. |

Task-side reading rule by intent:

| Task intent | Read from |
|---|---|
| Pure query / answer task | `init.view_*` — what the user sees at task start |
| Answer after agent operates | `current.view_*` — final visible state |
| Operate judgment | `current.state_user()`, optionally compared against `init.state_user()` |
| Create / edit / delete judgment | `state_<entity>(id)` or a dedicated `check_*` helper |

Forbidden in `task.py` / `defs.py`:

- Direct `json.load(...)` of `apps/<App>/data/*.json`. Only `app.py` is allowed to read base JSON.
- Treating `state.<entities>[id]` as the resolved view (it isn't — overlays may be partial, missing, or tombstoned).
- Returning `base_<entity>` as the answer (bypasses overlay rules).

The boundary is deliberate: short-term we read JSON from disk; medium-term `apps/<App>/data/*.json` may move behind `/api/sim-data/...` or SQLite. Task code that goes through `view_*` survives that migration; task code that calls `json.load` will break.

### Multi-user state shapes

The default is a single sandboxed current user. Multi-user is **not** a separate data model — it's the same one with an extra `currentUserId` pointer and a `users[userId]` map:

```jsonc
{
  "currentUserId": "u1",
  "users": {
    "u1": { "id": "u1", "publishedNoteIds": ["note_u1_1"], "likedNoteIds": ["base_note_1"] },
    "u2": { "id": "u2", "publishedNoteIds": ["note_u2_1"], "likedNoteIds": [] }
  },
  "notes": {
    "note_u1_1": { "id": "note_u1_1", "authorId": "u1", "title": "u1 的笔记" },
    "note_u2_1": { "id": "note_u2_1", "authorId": "u2", "title": "u2 的笔记" }
  }
}
```

The entity tables (`notes`, `posts`, `comments`) remain App-level runtime overlays and may hold entities from multiple users. The ownership rule still applies: an entity is "u1's" iff `users.u1.publishedNoteIds` contains the ID **and** `note.authorId === 'u1'`. View accessors resolve relative to `currentUserId`.

## Large world data: the `loader.ts` pattern

When an app's content dataset exceeds a few thousand JSON lines (RedBook posts, Bilibili videos, Ebay products), bundling it into `defaults.json` blows up Vite's ESM transform time. Split it out and lazy-load:

```
apps/<App>/data/
├── defaults.json     # initial runtime state (users, settings, small seed entities)
├── index.ts          # exports <APP>_CONFIG — synchronous, defaults + constants only
├── loader.ts         # async fetch of large datasets, module-level cache
└── <content>.json    # bundled-but-not-imported large datasets (posts.json, videos.json…)
```

`loader.ts` shape:

```ts
let cachedData: PostData[] | null = null;

export async function loadPosts(): Promise<PostData[]> {
  if (cachedData) return cachedData;
  const url = new URL('./posts.json', import.meta.url);
  const res = await fetch(url);                    // local same-origin JSON — no NetworkService needed
  const raw = await res.json();
  cachedData = processPosts(raw.posts);
  return cachedData;
}

export function getPostsSync(): PostData[] | null {
  return cachedData;                                // null until first preload completes
}

export async function preload(): Promise<void> {
  await loadPosts();                                // called by bench_env / app boot
}
```

**Bench accessibility depends on how the app consumes the loaded data**:

| Consumer pattern | Where the data lives | Visible to `__SIM__.getState()`? |
|---|---|---|
| **Store action** (X, RedBook) | Loader runs, then a store action writes it into the Zustand store | ✅ yes |
| **Hook** (Bilibili, Ebay, Spotify) | Loader caches in module scope; component hooks read from there | ❌ no |
| **Service** (Railway12306) | Loader hands off to a service singleton | ❌ no |

If a bench task needs to read or write a large-data field, the app must use the **store-action** pattern — load it into Zustand on boot or on demand, so it appears in `apps.<appId>.x` in `__SIM__.getState()`. Hook / service patterns are valid for display-only data.

When to split — rule of thumb:

| `defaults.json` size | Action |
|---|---|
| < 100 KB (~2 000 JSON lines) | Keep everything in `defaults.json` |
| > 100 KB, or crawled/generated content | Split out, add `loader.ts` |

Hard rules:

1. `index.ts` does **not** import large datasets. It only processes `defaults.json` + `constants.ts` and stays synchronous.
2. `loader.ts` is independent of `index.ts`. Loader is called by stores / hooks, not by `<APP>_CONFIG` construction.
3. Large datasets do **not** affect the type of `<APP>_CONFIG`.
4. `bench_env` only sees what's in the store. If a large-data field must be bench-visible, route it through a store action.
5. Large JSON files use **camelCase** names (`videoComments.json`, `playlistTracks.json`) matching the loader function and the content type.

Image assets referenced inside loaded JSON are resolved via `resolveAssetsDeep()` to `/@app-assets/<AppName>/...`, served by the Vite `serveAppAssetsPlugin` from `apps/<AppName>/assets/`.

## The full snapshot shape

`window.__SIM__.getState()` returns:

```jsonc
{
  "os": {
    "settings": {
      "global":  { "wifiEnabled": true, "bluetoothEnabled": false, "locale": "zh-CN", … },
      "system":  { "brightness": 80, "volume": 60, "fontScale": 1.0, … },
      "secure":  { /* permissions-adjacent */ },
      "apps":    { "wechat": {…}, "alipay": {…}, /* per-app OS settings */ }
    },
    "hardware":   { "battery": {…}, "wifi": {…}, "cellular": {…}, "sensors": {…} },
    "permissions": { "wechat": { "LOCATION": "granted", "CAMERA": "denied" }, … },
    "preferences": {…},
    "providers":  { "contacts": {…}, "sms": {…}, "media": {…} },
    "services":   { "clipboard": {…} }
  },
  "apps": {
    "wechat":     {…},
    "alipay":     {…},
    "rednote":    {…},
    /* one entry per installed app — runtime overlay only */
  }
}
```

Two top-level keys: `os` and `apps`. Everything the benchmark cares about is in there. **Nothing else is judging-visible**, by construction.

### Bench-facing path conventions

Judges access state via path strings. The framework hands tasks a typed dict; index it directly:

```python
# Raw indexing — preferred when reading state once
init_state["apps"]["wechat"]["contacts"]
final_state["os"]["settings"]["global"]["wifiEnabled"]

# CriteriaTask — dotted paths, anchored at the App's runtime overlay root
class ToggleDarkMode(CriteriaTask):
    apps = ["alipay"]
    criteria = {
        "settings.general.darkMode.mode": "{mode}",
    }
```

`CriteriaTask` path rules:

- Paths start at the App's overlay root (no `apps.<id>.` prefix — the suite already declares its app).
- `.` separates nested levels.
- Leaf values are the actual setting / field.
- `settings.x.y.z` is the standard prefix for per-app settings.

Schema changes are load-bearing: **after modifying any settings structure inside an App's store, grep `bench_env/task/<app>/tasks.py` and `bench_env/task/<app>/defs/*.py` for matching paths and update them in the same commit.** A silent path mismatch produces a green CI run with a broken judge.

Don't write defensive `.get("wechat", {})` chains. If your task declares `apps = ["wechat"]`, the runner guarantees the key exists. If it isn't there, that's a bug in the registry, not something to paper over.

For typed access from inside `app.py` accessors, prefer **`view_*` accessors** (see [Layered entity rules](#view-accessors-the-bench-facing-surface) above) over raw `.["posts"][id]` chains.

## Read-only vs. mutable conventions

Inside an app's runtime overlay, some fields are **logically read-only** (current user identity, account creation date) and some are user-mutable (likes, drafts, settings).

The framework doesn't enforce a distinction — it's a coding convention. But two patterns make life easier:

- Keep **structural constants** (tab definitions, service grids, feature flags) in `constants.ts`, not `defaults.json`. They're the same for every user; bench_env will never write to them.
- Use a `_temp` field (or skip persistence for specific keys via Zustand `partialize`) for ephemeral UI runtime state (open dialogs, current scroll position) that you don't want in snapshots even though they happen at runtime.

```ts
persist(
  (set) => ({ ... }),
  {
    name: 'habits',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => {
      const { _temp, ...persisted } = state;
      return persisted;             // _temp never enters localStorage or snapshots
    },
  },
);
```

## Settings: structure and Action patterns

Per-app settings live inside the app's own runtime overlay (the Zustand store). Two shapes show up across apps; pick by depth.

### Flat settings — 1-level Partial spread

Use this when an app has a single settings page and all toggles sit at the same level (Calendar, WechatReading, TencentMeeting, Railway12306):

```ts
updateSettings: (patch: Partial<AppSettings>) => {
  set(state => ({ settings: { ...state.settings, ...patch } }));
}

// Caller:
updateSettings({ theme: 'dark' });
```

### Nested settings — category-scoped updaters

Use this for apps with multi-level settings pages (Map, Alipay). One updater per category, typed precisely to the sub-shape:

```ts
updatePayOrder: (patch: Partial<PayOrderSettings>) => {
  set(state => ({
    settings: {
      ...state.settings,
      payment: { ...state.settings.payment, payOrder: { ...state.settings.payment.payOrder, ...patch } },
    },
  }));
},
updateDarkMode: (patch: Partial<DarkModeSettings>) => {
  set(state => ({
    settings: {
      ...state.settings,
      general: { ...state.settings.general, darkMode: { ...state.settings.general.darkMode, ...patch } },
    },
  }));
},
```

```ts
updateDarkMode({ mode: 'dark' });
updatePayOrder({ mode: 'custom' });
```

### Tolerable but not recommended

```ts
// ⚠️ Functional updater — flexible but callers must spread manually
setSettings: (updater: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
```

### Forbidden

```ts
// ❌ One setter per leaf — fragmented; 20 setters for 20 toggles
setDarkMode: (mode: string) => void;
setFontSize: (size: number) => void;
// ...

// ❌ Whole-object replace — caller must pass the complete settings or fields are lost
setSettings: (settings: AppSettings) => void;
```

### Where settings live in snapshots

| Storage | Path | Owner |
|---|---|---|
| **OS-level** (cross-app) | `os.settings.global.*` / `os.settings.system.*` / `os.settings.secure.*` | `OsStateStore`, written via Managers |
| **OS-level** (per-app) | `os.settings.apps.<appId>.*` | OS-stored app preferences, e.g. notification policy |
| **App-internal** | `apps.<appId>.settings.*` | The app's own `state.ts` |

For `CriteriaTask` paths see "[Bench-facing path conventions](#bench-facing-path-conventions)" above.

## Store actions: no query-style getters

> ⛔ **This rule has caused multiple "UI doesn't update after interaction" bugs across apps. It is non-negotiable.**

Zustand actions are plain closures created inside `create()`. Their **reference never changes** after the store is built. When a component subscribes via `useStore(s => s.isLiked)`, Zustand's `Object.is` comparison always returns `true`, so the component **never re-renders when underlying data changes**.

```ts
// ❌ FORBIDDEN — query getters defined as store actions
interface MyActions {
  isLiked:          (postId: string) => boolean;
  isFollowing:      (userId: string) => boolean;
  getEventById:     (id: string) => Event;
  checkInteractions:(vid: string) => { liked: boolean; coined: boolean };
  toggleLike:       (postId: string) => void;   // ✅ this one is fine — it's a mutation
}
```

```tsx
// ❌ FORBIDDEN — component subscribes to a stable function reference
const isLiked = useStore(s => s.isLiked);   // same reference forever, no re-render
```

The fix — **subscribe to data, derive locally**:

```tsx
// ✅ subscribe to the array → reference changes when data changes → re-renders
const likedPostIds = useStore(s => s.likedPostIds);
const isLiked = (id: string) => likedPostIds.includes(id);

// ✅ memoSelector that returns a Set (O(1) membership for big lists)
export const selectLikedSongIds = memoSelector(
  (s: Store) => s.likedSongs,
  (songs) => new Set(songs.map(t => t.id)),
);
const likedIds = useStore(selectLikedSongIds);
const isLiked = (id: string) => likedIds.has(id);

// ✅ subscribe to events array, find locally
const events = useStore(s => s.events);
const event  = events.find(e => e.id === eventId);
```

The principle: **store `actions` contain only mutations (state-changing operations).** Queries (read-only derivations) live in the component, in a `memoSelector`, or as a standalone util. The same logic forbids `useShallow(s => s.someGetter)` wrapped in `useMemo` — the dep is still a stable reference, the memo never recomputes.

The `scripts/lint_store_getters.mjs` linter catches violations of this rule.

## The OS state model — Android four-layer mapping

`OsStateStore` mirrors the Android settings model:

| Android concept | MobileGym tree | Examples |
|---|---|---|
| `Settings.Global` | `os.settings.global` | wifi/bluetooth on-off, locale, mobile-data |
| `Settings.System` | `os.settings.system` | brightness, ringer volume, font scale |
| `Settings.Secure` | `os.settings.secure` | biometric preferences, screen lock policy |
| App-scoped settings | `os.settings.apps.<appId>` | per-app notification policy, in-app prefs |
| Hardware state | `os.hardware` | battery percent/charging, WiFi RSSI, sensors |
| Permission grants | `os.permissions` | `permissions[appId][permId] = 'granted' / 'denied'` |
| `ContentProvider` data | `os.providers` | contacts, SMS, media |

This is persisted as a single `os_state` localStorage entry plus separate per-provider stores. **`build` info and `telephony` are managed via the `managers/registry.ts` override mechanism** so the benchmark can inject scenarios (different device profiles, carriers, etc.) without rewriting the store.

## Managers — write facades

Apps **must not** write directly to `os.hardware.wifi.enabled`. They go through a Manager:

```ts
import { ConnectivityManager } from '@/os/managers/ConnectivityManager';

ConnectivityManager.setWifiEnabled(false);
// → sets os.hardware.wifi.enabled = false
// → if airplaneMode would conflict, cascades correctly
// → emits a broadcast on os/BroadcastBus
```

Why: constraint logic (airplane-mode cascade, volume clamp, brightness clamp) is centralized. If the same write happened from three apps directly, you'd hit three different broken edge cases.

Managers live in `os/managers/`. Today: `ConnectivityManager`, `BatteryManager`, `AudioManager`, `DisplayManager`. Add a manager (rather than expanding one) when the new constraint vocabulary doesn't overlap with an existing one.

## Providers — shared content

Things many apps need to read or write but no one app *owns*: contacts, SMS, media. These live in `os/providers/` and are exposed through `ContentResolver`:

```ts
import { ContentResolver } from '@/os/ContentResolver';

const contacts = ContentResolver.query('contacts', { filter: { isFavorite: true } });
ContentResolver.insert('sms', { from: '+1234567', body: 'Hi!', timestamp: TimeService.now() });
```

Each provider:

- Is its own persisted Zustand store.
- Is excluded from the `os.services` snapshot section because it's substantive content, not service runtime.
- **Appears in `os.providers.<name>`** in `__SIM__.getState()` so judges can read it.
- Is reset by `__SIM__.reset()`.

If your app needs to *share* data with others, add it as a provider. If your app needs *its own* data, put it in the app's runtime overlay.

## Snapshot, reset, inject

The four operations the benchmark performs millions of times during an RL run:

### Snapshot

```js
const snapshot = window.__SIM__.getState();
```

`AppStateRegistry.getAllAppStates()` walks the registered stores, calls each `.getState()`, and assembles the tree. No copies — Zustand stores are immutable, so the snapshot is a reference graph. For serialization use `JSON.stringify(snapshot)`; for a deep-cloned safe copy, `structuredClone(snapshot)`.

### Reset

```js
await window.__SIM__.reset();        // clears localStorage + reloads the page
await window.__SIM__.resetState();   // clears in-memory state without reloading
```

`reset()` is "factory reset": wipes every persisted localStorage key the framework knows about, then reloads. Use it between tasks in a benchmark run.

`resetState()` is the lighter version: clears in-memory stores without a page reload. Useful when the harness has already snapshotted the tab and just wants a clean slate fast.

### Inject

```js
await window.__SIM__.setState(
  { apps: { wechat: { user: { id: 'u_42' } } } },
  { deep: true },                    // merge nested objects instead of overwriting
);

await window.__SIM__.setState(snapshot, { deep: true, reload: true });
// ↑ used for "restore from snapshot": writes the patch + reloads to repaint everything
```

Inject lets tasks set up arbitrary initial conditions: pre-populate a contact list, set an account balance, mark a message as read. Without `setState`, every task would need to drive the simulator UI just to get into position. With it, tasks can teleport.

### Clone (for parallel RL)

For group-based RL like GRPO, you need many parallel instances of the same initial state. The pattern:

```js
// Once, in the master process:
await window.__SIM__.setState(initialState, { deep: true, reload: true });
const snap = JSON.parse(JSON.stringify(window.__SIM__.getState()));

// Then, in every parallel worker (each has its own browser tab):
await worker.__SIM__.setState(snap, { deep: true, reload: true });
```

The cost is ~10–50 ms per worker for a typical snapshot, dominated by JSON serialize/deserialize, not by the state shape itself. That's how MobileGym hits "256 parallel instances on a single server" — the snapshot fits in cache and `setState` is fast.

## Side-effect detection

The runtime overlay being small + structured lets the runner detect **side effects** for free:

1. Snapshot at task start (`init`).
2. Snapshot at task end (`final`).
3. Diff `init` vs. `final` at the path level.
4. Subtract the task's declared `expected_changes`.
5. Whatever remains is an **unexpected side effect**.

In the leaderboard this shows up as the `USE` (Unexpected Side Effects) column. An agent that completes the task but silently follows three users or saves an unwanted draft will look successful on the task itself but bad on USE — which is exactly what user-facing safety wants.

A task author declares `expected_changes`:

```python
class CreateNewNote(BaseTask):
    expected_changes = ["notes.notes"]   # creating a note → notes.notes mutates
```

Anything outside this list is a side effect. List too few and innocent changes flag. List too many and real bugs hide.

## Auto-discovery of state

Apps don't explicitly register their store. The OS scans both:

```ts
import.meta.glob('./apps/*/state.ts',  { eager: true });
import.meta.glob('./system/*/state.ts', { eager: true });
```

The `persist({ name: '<appId>' })` middleware tags the store with its appId. `AppStateRegistry.getAllAppStates()` collects every store keyed by `<appId>` and emits the final `apps.<appId>` slice.

Two consequences:

1. **The persist `name` must equal `manifest.id`.** Mismatch and your store doesn't appear in snapshots.
2. **`registerStateAdapter`** is the escape hatch — use it when you want a custom selector for snapshot extraction (e.g. you have several stores and want to flatten them into one app slice, or you want to exclude part of the store from snapshots).

```ts
// apps/Habits/state.ts (advanced — most apps don't need this)
import { registerStateAdapter } from '@/os/AppStateRegistry';

registerStateAdapter('habits', () => {
  const s = useHabitsStore.getState();
  return { habits: s.habits, streak: s.streak };   // omits _temp, omits secondary stores
});
```

## Where to go next

- 📱 The full app file/contract that owns the runtime overlay → [`app-module-contract.md`](app-module-contract.md)
- 🧪 How tasks consume snapshots in their judges → [`../../bench_env/docs/task/IMPLEMENTATION.md`](../../bench_env/docs/task/IMPLEMENTATION.md)
- 🔌 The `__SIM__` and `__OS__` global APIs → [`../api/runtime-api.md`](../api/runtime-api.md)
- 🤖 What about the Android equivalent? → [`android-mapping.md`](android-mapping.md)
