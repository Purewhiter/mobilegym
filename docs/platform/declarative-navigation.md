# Declarative Navigation

Every screen, transition, dialog, and discrete UI state in every MobileGym app is **declared** in a single file (`navigation.declaration.ts`) rather than encoded implicitly across React handlers. The declaration is the source of truth for:

- The runtime `go()` / `back()` helpers each app uses.
- Static analysis (consistency check between declaration and code).
- Graph generation (BFS, shortest path, trajectory enumeration).
- Task authoring (which buttons exist, what they do, what data they consume).

This document is the formal reference. For the minimal walkthrough, see [`../guides/add-an-app.md`](../guides/add-an-app.md).

> 🧱 **Why declarative.** Without static declaration, "what can the user do here" is buried across `<button onClick>` handlers and route definitions. Declarative navigation reifies it. The benchmark, the linter, the task generator, and your IDE all read the same file.

## Three layers

1. **Routes** — what URL paths exist; for each path, what discrete UI states it can be in.
2. **Transitions** — directional moves between (state, route) pairs.
3. **Actions** — in-page interactions that change app state without changing the URL.

Anything the user can do (other than scrolling) is one of these.

## Routes

```ts
routes: {
  'wechat.discover': {
    path: '/discover',                       // matches React Router's path
    entryPoint: 'home',                      // 'home' | 'deepLink' | 'both' | 'none' (default 'none')
    uiStates: [                              // every discrete state of this route
      { id: 'wechat.discover.feed',    search: {} },
      { id: 'wechat.discover.menu',    search: { menu: 'open' } },
      { id: 'wechat.discover.search',  search: { menu: 'search' } },
    ],
    queryParams: ['cursor'],                 // dynamic, unenumerated query keys
    scrollContainers: [
      { name: 'feed', direction: 'vertical' },
    ],
    stateCondition: { ref: 'appState', op: 'eq', path: 'flags.discoverEnabled', value: true },
  },
  // ...
}
```

### Rule: `uiStates` is mandatory

Every route declares `uiStates` (even if empty `[]`). The first state — by convention `{ search: {} }` — is the **base state** the user lands on when they navigate to that path with no extra parameters.

Forbidden patterns:

- ❌ Omitting `uiStates`. Even a single-state route declares `uiStates: [{ id: '...', search: {} }]`.
- ❌ Declaring a base state `{ search: {} }` on a route whose path **requires** a discrete parameter (e.g., a search route where `q` is mandatory). Either make the parameter dynamic (queryParam) or split the route.

### Tabs vs. modals vs. drawers vs. query params

Picking the right modeling matters. Quick decision table:

| Pattern | Model as | Why |
|---|---|---|
| TabBar tab (4 stable sections) | Separate pathnames: `/`, `/me`, `/contacts` | Each is its own route. Tabs use `mode: 'replace'`. |
| Tab inside one route | `uiStates` enumerated, with `searchParams` | E.g. Discover's "Featured / Following / Hot" — finite, named. |
| Dialog / modal / sheet | `uiStates` enumerated, opened via `mode: 'push'` | Closing via `back()` matches user expectation. |
| Drawer (left/right) | Same — `uiStates` + `mode: 'push'` | |
| Search box content | `queryParams: ['q']` | Unbounded user input — can't enumerate. |
| Pagination cursor | `queryParams: ['cursor']` | Same — dynamic. |
| Image-zoom inside gallery | `uiStates` with `{ photo: '<idx>' }` if finite | Or queryParam if dynamic. |

### `entryPoint`

Says how this route can be entered from "scratch":

- `home` — the launcher opens directly to this route (app's main page).
- `deepLink` — only reachable by `__OS__.openApp(id, route)` or an Intent dispatch.
- `both` — both work.
- `none` — only reachable via in-app transitions.

The default is `none`. Set `home` on exactly one route per app.

### `stateCondition`

A route can be **gated** by app state — useful for routes that only exist when a feature flag is on or when a related entity has been created.

```ts
stateCondition: { ref: 'appState', op: 'eq', path: 'flags.experimentalChat', value: true }
```

The graph generator interprets unprovable conditions (those depending on runtime state it can't evaluate statically) as creating *conditional* nodes — the route appears in the graph but flagged as conditional, not unconditionally reachable.

### `scrollContainers`

Tells the OS where the scroll surfaces are, so `window.__getScrollMeta__()` can auto-report position/extent. Required for any element with `data-scroll-container="<name>"`.

## Transitions

```ts
transitions: [
  {
    id: 'wechat.discover.openSearch',
    from: 'wechat.discover.feed',           // a uiState id, or a route id
    to:   'wechat.discover.search',         // same — explicit, never omitted
    mode: 'push',                            // 'push' | 'replace' | 'switch'
    description: 'Open the in-page search field',
  },
  {
    id: 'wechat.tab.switch',
    from: '*',                              // any uiState in the app
    to:   'wechat.discover.feed',           // dynamic target; see cases below
    mode: 'switch',                         // tab switching mode
    cases: [
      { when: { op: 'paramEq', param: 'tab', value: 'discover' },
        to:    'wechat.discover.feed' },
      { when: { op: 'paramEq', param: 'tab', value: 'me' },
        to:    'wechat.me.home' },
      { when: { op: 'always' },             // mandatory final fallback
        to:    'wechat.discover.feed' },
    ],
    preserveParams: ['locale'],             // optional: carry these query keys across
  },
],
```

### Transition fields

| Field | Required? | Notes |
|---|---|---|
| `id` | yes | Stable identifier. Format: `<appId>.<page>.<action>`. Hardcoded as a string literal — no dynamic concatenation at the bind site. |
| `from` | yes | A uiState id, a route id (matches any state on that route), or `'*'` (any state in the app). Explicit — no wildcards unless `'*'`. |
| `to` | yes | A uiState id. **Never omitted**, even for `mode: 'switch'` (where `to` is the fallback). |
| `mode` | yes | `'push'` adds to history (back closes), `'replace'` swaps current entry (no back trace), `'switch'` is the multi-target tab pattern. |
| `cases` | optional | List of `{ when, to }` for dynamic targets. Last entry must use `when: { op: 'always' }`. |
| `preserveParams` | optional | Query keys to carry forward (e.g. `locale`, `theme`). |
| `description` | optional | Free-text label for graph viewer; doesn't affect runtime. |

### Mode = `switch` (tabs)

A `switch` transition has the same `id` but routes to one of several destinations based on parameters. Use it for tab bars where one button activates one tab from the same control surface.

```ts
{
  id: 'home.tab.switch',
  from: '*',
  to: 'home.feed.list',         // fallback
  mode: 'switch',
  cases: [
    { when: { op: 'paramEq', param: 'tab', value: 'feed'  }, to: 'home.feed.list' },
    { when: { op: 'paramEq', param: 'tab', value: 'me'    }, to: 'home.me.profile' },
    { when: { op: 'paramEq', param: 'tab', value: 'inbox' }, to: 'home.inbox' },
    { when: { op: 'always' }, to: 'home.feed.list' },
  ],
}
```

In code:

```tsx
<button {...bindTap('home.tab.switch', { tab: 'me' })}>Me</button>
```

The OS resolves the `tab` parameter against `cases` and picks the right destination.

### Conditions

The condition language used in `cases[].when` and route `stateCondition`:

| Op | Example | Meaning |
|---|---|---|
| `eq` | `{ op: 'eq', ref: 'appState', path: 'flag', value: true }` | Equality against app state path |
| `neq` | same | Inequality |
| `memberOf` | `{ op: 'memberOf', ref: 'appState', path: 'list', value: 'x' }` | Path is an array containing `value` |
| `paramEq` | `{ op: 'paramEq', param: 'tab', value: 'me' }` | A transition parameter equals a value |
| `paramNeq` | same | Negation |
| `and` / `or` / `not` | `{ op: 'and', conditions: [A, B] }` | Combinators |
| `always` | `{ op: 'always' }` | Always true — required as the last `case` for a `switch` |

## Actions

Actions are interactions that change the app's state but **not the URL**: toggling a like, ticking a checkbox, typing a search query, submitting a form.

```ts
actions: [
  {
    id: 'wechat.discover.toggle-like',
    on: 'wechat.discover.feed',           // uiState (or route) where this action lives
    scope: 'item',                         // 'default' (page-scope) | 'item' (per list item) | 'form'
    behavior: 'toggle',                    // 'toggle' | 'select' | 'input' | 'submit' | 'custom'
    description: 'Toggle like on a post',
    paramsSchema: {                        // operand schema
      postId: { type: 'string', required: true },
    },
    condition: { /* ui.condition — see below */ },
  },
],
```

### Field reference

| Field | Required? | Notes |
|---|---|---|
| `id` | yes | `<appId>.<page>.<action>` for page-scope; `<appId>.<page>.item.<action>` for `scope: 'item'`. |
| `on` | yes | uiState or route id where the action exists. |
| `scope` | optional | `'default'` (one action per page), `'item'` (one per list item), `'form'` (form section). Defaults to `'default'`. |
| `behavior` | yes | Drives DOM-tagging style and graph treatment. `'toggle'` flips a bool, `'select'` picks one of several, `'input'` accepts free text, `'submit'` confirms, `'custom'` is app-defined. |
| `paramsSchema` | optional | Documentation for the operands the action takes (e.g. which list item). Doesn't enforce — it's metadata. |
| `condition` | optional | `ui.condition` filtering action visibility (the action button is only rendered when the predicate is true). |

### Binding actions to DOM

```tsx
const { bindTap } = useTriggerGestures();

// Page-scope toggle:
<button {...bindTap('wechat.discover.toggle-bgm-mute')}>🔇</button>

// Per-item action:
<button {...bindTap('wechat.discover.toggle-like', { postId: post.id })}>
  ❤
</button>
```

The hook returns an `onClick` (or `onPointerDown`/etc) handler **plus** `data-action="..."` and `data-action-params="..."` attributes. The analyzer uses those attributes to verify the code matches the declaration.

### Why `transitions` and `actions` are separate

A transition **changes the URL**; an action does not. Modeling them as one concept loses information:

- Static analysis can build a navigation graph from transitions only.
- Side-effect detection can categorize state changes by which action caused them.
- The benchmark can sample tasks that "do this action without leaving the page" (e.g. like 5 posts without scrolling away).

A button that toggles a like and a button that opens a new page should be tagged differently — they are different.

## DOM tagging

Every gesture-bound element ends up with `data-trigger` (transitions) or `data-action` (actions) attributes on the rendered DOM. The conventions:

| Attribute | Value | Set by |
|---|---|---|
| `data-trigger` | transition id (e.g. `wechat.discover.openSearch`) | `bindTap('transitionId', ...)` |
| `data-trigger-type` | gesture kind (`tap`, `longPress`, `swipe`) | same |
| `data-trigger-params` | JSON-encoded params object | same |
| `data-action` | action id (e.g. `wechat.discover.toggle-like`) | `bindTap('actionId', ...)` (the same hook, action id form) |
| `data-action-type` | gesture kind | same |
| `data-action-params` | JSON of operands (e.g. `{"postId": "abc"}`) | same |

Hard rules:

- **String literals only at the bind site.** `bindTap('foo.bar.${kind}')` defeats the static analyzer.
- **System back uses `bindBack()`**, which emits `data-trigger="system.back"`. The OS intercepts this and routes through `BackDispatcher` — apps must not handle it themselves.
- **Don't tag controls that don't do anything.** A button placeholder waiting for implementation should not carry `data-trigger`.
- **Scroll containers** need `data-scroll-container="<name>"` and `data-scroll-direction="vertical|horizontal"`, matching their `scrollContainers` declaration.

## The runtime API

Apps call into navigation via `useAppNavigate()`:

```ts
const { go, back, popTo } = useAppNavigate();

go('wechat.discover.openSearch');
go('wechat.tab.switch', { tab: 'me' });
go('wechat.search.results', { q: 'cats' }, { mode: 'push' });

back();           // one history entry
back(2);          // two entries
popTo('wechat.discover.feed');   // pop until target route, then push fresh
```

`go(id, params?, options?)`:

- `id` — transition id from the declaration. The runtime resolves it to (target route, target uiState, mode) using the declaration plus any `cases`.
- `params` — object of parameter values used by `cases` resolution + interpolated into the destination URL.
- `options` — `{ mode?: 'push' | 'replace', popTo?: string, popToInclusive?: boolean, state?: any }`. Overrides the declaration's default mode and supports "pop-then-push" patterns.

`back(n = 1)` — equivalent to `history.go(-n)` but mediated through the shadow `HistoryTracker` so popTo can target a specific route deterministically.

`popTo(routeOrUiState)` — pops history until the target appears, then optionally pushes a fresh entry. Used for "send message, then return to chat list."

> Business pages **must not** import `useNavigate` from `react-router`. The per-app `go()` is the only sanctioned entry point.

## Static analysis & graph generation

After editing `navigation.declaration.ts`:

```bash
node scripts/build_nav_artifacts.mjs <AppName>
```

That's a one-shot: consistency check + nav graph + (optionally) action tasks. Each substep can be invoked separately:

```bash
# Consistency: every data-trigger / data-action in source has a matching declaration entry
node scripts/check_navigation_declaration_consistency.mjs <AppName> --actions

# Schema-mode graph (nodes = uiStates, edges = transitions/actions)
node scripts/navigation_declaration_analyzer.mjs <AppName> -o public/<appname>_nav_graph.json

# Data-mode graph (also expands `dataSource` to concrete entity nodes)
node scripts/navigation_declaration_analyzer.mjs <AppName> --data data/index.ts \
  -o public/<appname>_data_graph.json

# Enumerate reachable action trajectories → candidate tasks (JSONL)
node scripts/generate_action_tasks_from_nav_graph.mjs \
  --graph public/<appname>_nav_graph.json \
  --out   public/<appname>_action_tasks.json \
  --app   <AppName>
```

### Graph viewer

Start the dev server and open `http://localhost:5173/nav_graph_viewer.html`. Pick a JSON file from the dropdown; the viewer is Cytoscape.js with a search-and-highlight overlay.

- `<app>_nav_graph.json` — the full graph; one node per uiState.
- `<app>_nav_graph_simplified.json` — collapses uiStates of the same route into a single node.
- `<app>_data_graph.json` — data-mode expansion; large.

Use the simplified version for understanding structure, the full version for debugging a specific transition, the data graph rarely.

### Shortest-path verification

```bash
python3 scripts/nav_path_finder.py \
  --graph public/wechat_nav_graph.json \
  --from "首页" --to "设置"
```

Useful for two things:

1. **Verifying the declaration** — if the graph says "no path home → settings", and you know one exists, your declaration has a missing transition.
2. **Auditing AI-generated trajectories** — compare a model's emitted path against the shortest known path; mismatches are either model bugs (took a detour) or declaration bugs (missing an edge).

## Data sources (parameter binding)

Some navigation features depend on data: a route is only reachable when a list has items, an action has different targets per item, a parametric task instantiates against a sample from a pool.

The declaration supports a small `dataSource` system for this. The simplest example:

```ts
// inside an action declaration
{
  id: 'rednote.feed.open-post',
  on:  'rednote.feed.home',
  scope: 'item',
  behavior: 'custom',
  paramsSchema: {
    postId: {
      type: 'string',
      required: true,
      dataSource: { ref: 'appState', path: 'posts.*.id' },
    },
  },
},
```

The `dataSource` says "this action's `postId` operand comes from the `posts.*.id` collection in app state." The graph analyzer expands this into one edge per concrete post (in data mode), and the task generator can use the same expansion to enumerate "open the post titled X" tasks for each sample.

`dataSource.ref` is `'appState'` (read from `state.ts`), `'sampler'` (random pool defined elsewhere), or `'boundParams'` (a value bound at the transition layer).

### dataSource grammar reference

The full schema of a `dataSource` entry:

```ts
interface DataSourceDeclaration {
  // Which source nodes does this dataSource apply to?
  // Used when a transition has multiple from points. Reuses FromConstraint syntax.
  from?: '*' | string | { path: string; search?: Record<string, string | '*' | null> };

  // Dotted path into the App's config object — points at the entity collection to expand.
  //   'shelf'                       → config.shelf (top-level array)
  //   'user.following'              → config.user.following
  //   'users[id={userId}].recentBooks'  → look up users where id === param userId, then field
  //   'initialShelf[isPrivate=false]'   → static filter, returns array subset
  ref: string;

  // How transition params are filled from each element of the resolved collection.
  // Key: target path-param name. Value: element field name, or a special token.
  //   { bookId: 'bookId' }          → element.bookId → params.bookId
  //   { bookId: 'id' }              → element.id    → params.bookId  (field rename)
  //   { userId: '$value' }          → the element itself is the value (e.g. ['u_1', 'u_2'])
  //   { id:     '$key' }            → use the object key when ref points at a Record
  // Scope: only path params. searchParams are set via transition.search / searchParams.
  paramMapping: Record<string, string>;

  // Optional label field for the graph viewer (e.g. 'title' → "活着" instead of "60").
  labelField?: string;

  // Optional: cross-source filter, evaluated per element after ref resolution.
  // Used when the visible subset depends on a derived computation across data files.
  filterFn?: string;                // '(item, data) => boolean' source
}
```

#### `ref` syntax

| Form | Meaning |
|---|---|
| `'collection'` | The whole collection (array or Record). |
| `'a.b.c'` | Nested-path traversal. |
| `'users[id={userId}].recentBooks'` | Array element lookup: find one where field matches a bound param, then continue path. The named key (`id`, `wxid`, `mid`, `bvid`) is explicit per app — no implicit `id`. |
| `'shelf[isPrivate=false]'` | Static filter: returns the subset matching the literal. Supported ops: `=`, `!=`. Supported value types: bool / number / string. |
| `'$value'` (in `paramMapping`) | The element itself is the value (use when the collection is `['u_1', 'u_2']`). |
| `'$key'` (in `paramMapping`) | Use the object's key when iterating a Record (`{ moments: {…}, scan: {…} }`). |

Parameterized lookups (`[field={param}]`) only resolve when the source node has a concrete `boundParams[param]` — abstract nodes keep the placeholder.

#### `from` matching — which `dataSource` wins

If a transition has multiple `dataSource` entries, the analyzer picks one per source node by priority:

| Priority | Form of `from` | Example |
|---:|---|---|
| 4 (highest) | FromConstraint with only literal `search` values | `{ path: '/x', search: { tab: 'me' } }` |
| 3 | FromConstraint with one or more `'*'` wildcards in `search` | `{ path: '/x', search: { tab: '*' } }` |
| 2 | Plain path string (or FromConstraint with empty `search`) | `'/bookshelf'` |
| 1 (fallback) | `'*'` or omitted | `'*'` |

A tie at the same priority is a **static error** (ambiguous match). FromConstraint `search` value semantics: `'*'` requires the key to exist with any value; `null` requires the key to be absent; a literal requires equality.

#### `paramBinding` resolved by the analyzer

Each transition param resolves to one of three binding kinds:

| Source | When | Edge `binding[param]` |
|---|---|---|
| `dataSource` | A matching `dataSource` provided the value | `{ source: 'dataSource', value: '<v>' }` |
| `inherited` | Source node has a concrete `boundParams[param]` | `{ source: 'inherited', value: '<v>' }` |
| `unbound` | Neither applied; the path stays a placeholder | `{ source: 'unbound' }` |

The distinction matters for graph pruning: only `dataSource` and `inherited` produce concrete data-mode nodes.

#### Condition vocabulary

Used in route `stateCondition`, `transition.cases[].when`, and action `condition`:

| Op | Shape | Meaning |
|---|---|---|
| `always` | `{ op: 'always' }` | Always true (required as last `case` in a `switch`) |
| `eq` | `{ op: 'eq', ref, equals }` | The resolved value at `ref` equals `equals` |
| `notEmpty` | `{ op: 'notEmpty', ref, filterFn? }` | Collection at `ref` is non-empty (optional `filterFn`) |
| `memberOf` | `{ op: 'memberOf', ref, param, field?, filterFn? }` | `params[param]` belongs to the collection at `ref` |
| `paramEq` | `{ op: 'paramEq', param, ref }` | `params[param]` equals the value at `ref` (commonly for `boundParams`) |
| `paramNeq` | `{ op: 'paramNeq', param, ref }` | Negation of `paramEq` |
| `and` / `or` | `{ op: 'and' \| 'or', items: Condition[] }` | Combinators |
| `not` | `{ op: 'not', item: Condition }` | Negation |

`paramEq` / `paramNeq` depend on the data-mode `boundParams` — they're meant for path params, not free query params.

Legacy ops (`equals`, `notEquals`, `empty`) are still parsed for back-compat but **new declarations should use the canonical set above**.

#### `filterFn` for derived predicates

When the visible subset of a collection depends on a calculation across several data files, declare it inline:

```ts
dataSource: {
  from: { path: '/reading-list', search: { category: 'finished' } },
  ref:  'initialShelf',
  filterFn: '(item, data) => { const p = data.bookProgress[item.bookId]; const b = data.store.find(x => x.id === item.bookId); return p && b && p.charOffset >= b.totalWords; }',
  paramMapping: { bookId: 'bookId' },
}
```

Signature: `(item: any, data: ConfigData) => boolean`. The analyzer evaluates it with `new Function` — keep it pure and self-contained.

#### Cross-file data aggregation

`ref` is always resolved against **one** config object. If your data is split across files, aggregate them in the main config and refer through that:

```ts
// data/index.ts
import { VIDEO_DATA }  from './videoData';
import { AUTHOR_DATA } from './authorData';

export const BILIBILI_CONFIG = {
  videos:  VIDEO_DATA,
  authors: AUTHOR_DATA,
};

// In navigation.declaration.ts
ref: 'videos[id={bvid}].title'
ref: 'authors.{mid}.videos'
```

This keeps the analyzer simple (one root to traverse) while allowing arbitrary file-level organization.

## Special cases worth knowing

### Tab memory

Some tabs remember where the user was when they last left them. The pattern:

- Each tab is its own pathname.
- The store remembers the user's last sub-route per tab.
- A `mode: 'switch'` transition with `cases` reads from app state via `ref: 'appState'` to compute the actual target.

### Dialog visibility = URL push

A dialog is just a UI state pushed with `mode: 'push'`. Open via `go('myapp.page.openDialog')` which transitions to a uiState with `search: { dialog: 'open' }`. Close via `back()` — history pop closes the dialog.

**Never use `useState` for dialog visibility**: the back key has no view into your React state and pops past the dialog directly, taking the user to the previous page.

### `popTo` for end-of-flow returns

When you finish a checkout flow (cart → address → payment → confirmation) and want to send the user back to the home, you don't want `back()` four times (it'd revisit each intermediate page). Use `popTo('myapp.home', { popToInclusive: true })`. The shadow `HistoryTracker` figures out the right delta.

### Foreign-task isolation

When app A pushes app B via `startActivityForResult`, B is mounted twice (its own background task + on top of A's task). The navigation handler in B detects this (`task.rootAppId !== appId`) and registers only its Activity-level navigator, leaving the background instance's app-level registration alone. Most app authors never need to think about this; if you debug "my back button is going to the wrong app," that's the place to look.

## Common pitfalls

| Mistake | Symptom | Fix |
|---|---|---|
| Dynamic transition id (`bindTap(\`x.${kind}\`, …)`) | Analyzer can't find the declaration | Hard-code the literal |
| Omitting `uiStates: []` on a one-state route | Lint failure | Add it |
| Declaring base `{ search: {} }` on a route with a mandatory query param | Lint failure | Make the param `queryParam`-dynamic, or split the route |
| Using `useNavigate()` directly | Lint failure; back doesn't behave as expected | Use the app's `go()` / `back()` |
| Importing `BackDispatcher` from `os/` | Refactor breakage; abstraction leak | Use URL-driven dialogs |
| Pushing a dialog with `useState` | Back button skips the dialog | Push as a `mode: 'push'` transition |
| Mixing `data-trigger` and `data-action` on the same element | Analyzer ambiguity | Pick one; if it changes URL it's a transition, otherwise an action |

## Where to go next

- 📱 The minimal app walkthrough → [`../guides/add-an-app.md`](../guides/add-an-app.md)
- 🧠 What the OS does with the back key and intent routing → [`os-layer.md`](os-layer.md)
- 🚧 Intent and cross-app calls → [`intent-system.md`](intent-system.md)
- 📊 How the graph powers task generation → run `build_nav_artifacts.mjs` and open the viewer
