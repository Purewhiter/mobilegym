# Declarative Navigation

Every screen, transition, dialog, and discrete UI state in every MobileGym app is **declared** in a single file (`navigation.declaration.ts`) rather than encoded implicitly across React handlers. The declaration is the source of truth for:

- The runtime `go()` / `back()` helpers each app uses.
- Static analysis (consistency check between declaration and code).
- Graph generation (BFS, shortest path, trajectory enumeration).
- Task authoring (which buttons exist, what they do, what data they consume).

Tencent Meeting is migrating to a route table instead (pilot): see [`routes.md`](routes.md).

This document is the formal reference. For the minimal walkthrough, see [`../../guides/add-an-app.md`](../../guides/add-an-app.md).

> 🧱 **Why declarative.** Without static declaration, "what can the user do here" is buried across `<button onClick>` handlers and route definitions. Declarative navigation reifies it. The benchmark, the linter, the task generator, and your IDE all read the same file.

## Three layers

1. **Routes** — what URL paths exist; for each path, what discrete UI states it can be in.
2. **Transitions** — directional moves between (state, route) pairs.
3. **Actions** — in-page interactions that change app state without changing the URL.

Anything the user can do (other than scrolling) is one of these.

## Routes

```ts
routes: [
  {
    path: '/discover',                       // matches React Router's path
    component: 'DiscoverPage',
    params: {},
    entryPoint: 'home',                      // 'home' | 'deepLink' | 'both' | 'none' (default 'none')
    uiStates: [                              // every discrete state of this route
      { id: 'wechat.discover.feed',    search: {}, description: 'Feed' },
      { id: 'wechat.discover.menu',    search: { menu: 'open' }, description: 'Menu open' },
      { id: 'wechat.discover.search',  search: { menu: 'search' }, description: 'Search open' },
    ],
    queryParams: { cursor: 'string' },       // dynamic, unenumerated query keys
    scrollContainers: [
      { name: 'feed', direction: 'vertical', description: 'Feed list' },
    ],
    description: 'Discover feed',
  },
  // ...
]
```

### Rule: `uiStates` is mandatory

Every route declares `uiStates` with **at minimum one base state** (`search: {}`). Empty `uiStates: []` is forbidden — even a single-state route must list the base entry. The first state in the array is treated as the **base state** the user lands on when they navigate to that path with no extra parameters.

CI-enforced rules on base states (categories `invalidBaseStateIds` and `multipleBaseStates`):

- **Base state id must end with `.base`** — if `uiState.search` is `{}`, its `id` must end with `.base` (e.g. `wechat.discover.base`). The consistency checker rejects ids that violate this.
- **At most one base state per route** — only one entry per route may have `search: {}`. Declaring two equally-bare states (`{ search: {} }` twice) is rejected.

Forbidden patterns:

- ❌ Omitting `uiStates`, or declaring `uiStates: []`. The minimum is one base state with `search: {}` and an id ending in `.base`.
- ❌ Declaring a base state on a route whose path **requires** a discrete parameter (e.g. a search route where `q` is mandatory). Either make the parameter dynamic (`queryParam`) or split the route.
- ❌ Declaring two base states for the same route.

### Home routes that require a mandatory query param

If your home tab can only be rendered with a specific discrete query (e.g. `/?tab=recommend`), additional rules apply:

1. **Set `MemoryRouter initialEntries`** to the canonical entry — otherwise React Router lands on `/` with no query and the first paint is broken: `<MemoryRouter initialEntries={['/?tab=recommend']}>`.
2. **Do not declare a `search: {}` base state** — toolchains take `uiStates[0]` as the home entry; a bare base would mislead them.
3. **In `from` for tab switches, use a parameter-level wildcard**: `from: [{ path: '/', search: { tab: '*' } }, '/following', '/me']`.
4. **When an overlay is open over the home tab**, gate the tab-switch transitions in `from` so the graph doesn't claim tab switching is reachable mid-overlay.
5. **`pathname` checks ignore query** — the bottom TabBar's "is current tab home" highlight is driven by pathname, so all home-tab variants light up the home icon.

### `localStates` (documentation only)

`uiStates[].localStates` is purely semantic annotation — items here do **not** map to URL state and do **not** produce graph nodes. Use it to document panels / sub-overlays the agent should know about for training, without inflating the navigation graph.

### Tabs vs. modals vs. drawers vs. query params

Picking the right modeling matters. Quick decision table:

| Pattern | Model as | Why |
|---|---|---|
| TabBar tab (4 stable sections) | Separate pathnames: `/`, `/me`, `/contacts` | Each is its own route. Tabs use `mode: 'replace'`. |
| Tab inside one route | `uiStates` enumerated, with `searchParams` | E.g. Discover's "Featured / Following / Hot" — finite, named. |
| Dialog / modal / sheet | `uiStates` enumerated, opened via `mode: 'push'` | Closing via `back()` matches user expectation. |
| Drawer (left/right) | Same — `uiStates` + `mode: 'push'` | |
| Search box content | `queryParams: { q: 'string' }` | Unbounded user input — can't enumerate. |
| Pagination cursor | `queryParams: { cursor: 'string' }` | Same — dynamic. |
| Image-zoom inside gallery | `uiStates` with `{ photo: '<idx>' }` if finite | Or queryParam if dynamic. |

### `entryPoint`

Says how this route can be entered from "scratch":

- `home` — the launcher opens directly to this route (app's main page).
- `deepLink` — only reachable by `__OS__.openApp(id, route)` or an Intent dispatch.
- `both` — both work.
- `none` — only reachable via in-app transitions.

The default is `none`. Set `home` on exactly one route per app.

### `stateCondition`

A UI state or transition entry can be **gated** by app/config data — useful for states that only exist when a feature flag is on or when a related entity has been created.

```ts
stateCondition: { op: 'eq', ref: 'flags.experimentalChat', equals: true }
```

The graph generator interprets unprovable conditions (those depending on runtime state it can't evaluate statically) as creating *conditional* nodes or edges — they appear in the graph but are flagged as conditional, not unconditionally reachable.

### `scrollContainers`

Tells the OS where the scroll surfaces are, so `window.__getScrollMeta__()` can auto-report position/extent. Required for any element with `data-scroll-container="<name>"`.

Naming rules:

- **Single primary scroller**: use `name: 'main'`. This is the most common case and aligns with what the OS treats as the "page scroll" for things like keyboard adjust and edge-swipe gestures.
- **Multiple concurrent scrollers**: every visible one must have a **distinct** name. `__getScrollMeta__()` returns `Record<name, meta>` — same name silently overwrites.
- **Tab routes that each have their own primary scroller** may all use `name: 'main'`, **provided that only one tab is visible at a time** (tabs hide each other via `display:none`). The override semantic is harmless when only one is mounted-visible.

## Transitions

```ts
transitions: [
  {
    id: 'wechat.discover.openSearch',
    from: 'wechat.discover.feed',           // a uiState id, or a route id
    to:   '/discover',                      // route path, with params like /book/:bookId if needed
    search: { menu: 'search' },             // static query changes; null removes a key
    searchParams: {},
    params: {},
    mode: 'push',                            // 'push' | 'replace'
    label: 'Open the in-page search field',
    ui: { placement: 'topbar', icon: 'search', gesture: 'tap' },
  },
  {
    id: 'wechat.tab.switch',
    from: '*',                              // any uiState in the app
    to:   '/',                              // fallback route path
    search: {},
    searchParams: {},
    params: {},
    mode: 'replace',                        // tab switching uses replace
    label: 'Switch main tab',
    ui: { placement: 'tabbar', icon: 'tab', gesture: 'tap' },
    cases: [
      { when: { op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'discover' },
        to: '/discover', search: {} },
      { when: { op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'me' },
        to: '/me', search: {} },
      { when: { op: 'always' },             // mandatory final fallback
        to: '/', search: {} },
    ],
    preserveParams: ['locale'],             // optional: carry these query keys across
  },
],
```

### Transition fields

| Field | Required? | Notes |
|---|---|---|
| `id` | yes | Stable identifier. Format: `<appId>.<page>.<action>`. Hardcoded as a string literal — no dynamic concatenation at the bind site. |
| `from` | yes | A uiState id, a route id, `'*'`, a `FromConstraint`, or **an array of any of the above**. See "`from` syntax" below. |
| `to` | yes | Target route path, with `:param` placeholders if needed. **Never omitted**; it is the fallback when `cases` are present. |
| `search` | yes | Static search-param changes for the target; `null` removes a key. Has precedence over `searchParams` for the same key (see "Two semantics of `searchParams`"). |
| `searchParams` | yes | Dynamic query keys filled from runtime params. Two semantics — see below. |
| `params` | yes | Path params required by `to`. |
| `mode` | yes | `'push'` adds to history (back closes), `'replace'` swaps current entry (no back trace). |
| `cases` | optional | List of `{ when, to, search, searchParams? }` for dynamic targets. **Non-empty `cases` must end with `when: { op: 'always' }`** — CI-enforced. Empty `cases: []` is equivalent to omitting the field. |
| `preserveParams` | optional | Query keys to carry forward (e.g. `locale`, `theme`). Also affects static graph expansion — see "`preserveParams` graph effect". |
| `availability` | optional | `'requires_prior_visit'` marks edges whose existence depends on runtime memory (e.g. "resume to the tab you last saw"). The viewer renders them as purple dashed lines; pathfinders avoid them on first reach. May also appear on individual `cases[]` branches. |
| `availabilityNote` | optional | Human-readable note explaining the availability constraint. |
| `label` | yes | Free-text label for graph viewer; doesn't affect runtime. |
| `ui` | yes | Trigger placement, icon, and gesture metadata. `ui.gesture` is one of `'tap' | 'longPress' | 'doubleTap' | 'back'`. |

### `from` syntax

`from` can take any of these shapes:

| Form | Meaning |
|---|---|
| `'wechat.discover.base'` | A specific `uiState` id. |
| `'/discover'` | A route path — matches any `uiState` on that route. **Forbidden** if the route has no base state (must use `FromConstraint` to specify which discrete state). |
| `'*'` | Any state in the app. **Antipattern** for transition declarations — the analyzer can't reason about which entries reach this transition. The only legitimate use is a parameter-level wildcard inside a `FromConstraint` (`{ path: '/x', search: { tab: '*' } }`), which means "tab must exist but value is unconstrained". |
| `{ path: '/x', search: { tab: 'feed' } }` | A `FromConstraint`: path plus required search literals. |
| `['/', '/me', { path: '/discover', search: { tab: 'recommend' } }]` | Array of any of the above — common for tab switches and TabBar-level transitions. |

**Rule: same-pathname discrete moves require `FromConstraint`.** When a transition's source pathname equals its target pathname but `search` / `searchParams` changes (e.g. switching tabs within a page), `from` must use `FromConstraint` to explicitly pin the source's discrete state. A bare path string is ambiguous and rejected.

**Antipattern: bare `from: '*'` outside parameter wildcards.** Explicitly enumerate the source routes / states the transition is reachable from. The analyzer needs concrete edges; `'*'` produces an opaque cloud.

**Antipattern: tab-switch `from` containing the target route.** Bottom TabBar tab switches must not list their own destination in `from` — that produces a self-loop edge with no semantic value (the user clicks "Home" while already on Home). Within-page tab switching belongs to its own transition with a different `id`.

### Two semantics of `searchParams`

`searchParams` is a list of query keys whose values are supplied at runtime. The analyzer treats each key in one of two ways depending on the target route's declaration:

- **Dynamic query (unbounded)**: the key is declared in the target route's `queryParams`. The graph keeps `:key` as a placeholder; the key does **not** participate in `uiStates` discrete-structure matching.
- **`.switch`-style discrete dimension (bounded)**: the key is **not** in the target route's `queryParams` — it must be a discrete dimension enumerated in `uiStates`. The analyzer expands the transition into multiple edges, one per matching `uiState`.

**Static `search` has precedence over `searchParams` for the same key.** If a transition (or one of its `cases[]` branches) fixes `search: { sub: 'audio' }`, the analyzer does **not** also expand `sub` via `searchParams` — the static value wins.

### `preserveParams` graph effect

Beyond the runtime "carry these query keys forward" behavior, `preserveParams` affects **static graph generation**: the analyzer merges the preserved keys' values from the source node's search into the resolved target's search, so the destination correctly resolves to an existing `uiState`. Without this, transitions can point to non-existent nodes when the target's `uiState` depends on a query key the transition itself doesn't restate.

### Tab switching with `cases`

A tab transition can keep one `id` and route to one of several destinations based on parameters. Use `mode: 'replace'` so tab switches do not add back-stack entries.

```ts
{
  id: 'home.tab.switch',
  from: '*',
  to: '/',
  search: {},
  searchParams: {},
  params: {},
  mode: 'replace',
  label: 'Switch main tab',
  ui: { placement: 'tabbar', icon: 'tab', gesture: 'tap' },
  cases: [
    { when: { op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'feed' }, to: '/', search: {} },
    { when: { op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'me' }, to: '/me', search: {} },
    { when: { op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'inbox' }, to: '/inbox', search: {} },
    { when: { op: 'always' }, to: '/', search: {} },
  ],
}
```

In code:

```tsx
<button {...bindTap('home.tab.switch', { tab: 'me' })}>Me</button>
```

The app's `go()` helper resolves the `tab` parameter against `cases` and picks the right destination.

### Conditions

There are two condition shapes in current declarations:

- `cases[].when` uses the runtime `Condition` shape, which compares route params/search values.
- `ui.condition` and `uiStates[].stateCondition` use the data-mode `StateCondition` shape, which reads refs from the app config/state used by the analyzer.

`cases[].when`:

| Op | Example | Meaning |
|---|---|---|
| `exists` | `{ op: 'exists', ref: { ref: 'search', key: 'q' } }` | Ref is present and non-empty |
| `eq` | `{ op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'me' }` | Ref equals a primitive |
| `in` | `{ op: 'in', left: { ref: 'param', key: 'type' }, right: ['a', 'b'] }` | Ref is one of the listed values |
| `match` | `{ op: 'match', left: { ref: 'search', key: 'q' }, right: '^book' }` | Ref matches a regex |
| `gt` / `gte` / `lt` / `lte` | `{ op: 'gt', left: { ref: 'param', key: 'count' }, right: 0 }` | Numeric comparison |
| `and` / `or` / `not` | `{ op: 'and', items: [A, B] }` | Combinators |
| `always` | `{ op: 'always' }` | Always true — use as the final fallback `case` |

## Actions

Actions are interactions that change the app's state but **not the URL**: toggling a like, ticking a checkbox, typing a search query, submitting a form. In current declarations, actions live on the `uiStates[]` entry where the control is visible.

```ts
uiStates: [
  {
    id: 'wechat.discover.feed',
    search: {},
    description: 'Discover feed',
    actions: [
      {
        id: 'wechat.discover.like.toggle',
        label: 'Toggle like on a post',
        scope: 'item',                       // omit for page-scope actions
        behavior: 'toggle',                  // 'toggle' | 'select' | 'input' | 'submit' | 'other'
        paramsSchema: { postId: 'string' },  // operand schema
      },
    ],
  },
]
```

### Field reference

| Field | Required? | Notes |
|---|---|---|
| `id` | yes | `<appId>.<page>.<action>` for page-scope; `<appId>.<page>.item.<action>` for `scope: 'item'`. |
| `label` | yes | Human-readable label for graph viewers and task generation. |
| `scope` | optional | `'item'` for per-list-item actions. Omit for page-scope actions. |
| `behavior` | yes | Drives DOM-tagging style, graph treatment, and CI validation. `'toggle'` flips a bool, `'select'` picks one of several, `'input'` accepts free text, `'submit'` confirms, `'other'` is app-defined. |
| `paramsSchema` | conditional | `Record<string, 'string' | 'number' | 'boolean'>`. **CI-enforced** for `behavior='input'` (must include `value`) and `scope='item'` (must include at least one object-identifier field of `'string'` or `'number'`). |
| `effects` | optional | `ActionEffect[]` annotating local-state side effects: `{ kind: 'localState.open' \| 'localState.close', id: string }`. Used for documentation and Agent-training metadata; does not produce graph edges. |
| `condition` | optional | Data-mode `StateCondition` filtering action visibility. |

Action id grammar (regex `^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+$`, minimum 3 segments, no `-` / `_`, app-internal unique) and the verb-suffix table (`.toggle` / `.select.<option>` / `.input` / `.submit`) are documented in [actions.md](actions.md#actionid-grammar-hard-rules). The full validation rules (`paramsSchema` constraints, `data-action-params` consistency, `select` shared-prefix mutex, toggle is one-id) also live there.

### Binding actions to DOM

```tsx
const { bindTap } = useTriggerGestures();

// Page-scope toggle:
<button {...bindTap('wechat.discover.bgmMute.toggle')}>🔇</button>

// Per-item action:
<button {...bindTap('wechat.discover.like.toggle', { postId: post.id })}>
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
| `data-trigger-type` | gesture kind (`tap`, `longPress`, `doubleTap`) | same |
| `data-trigger-params` | JSON-encoded params object | same |
| `data-action` | action id (e.g. `wechat.discover.like.toggle`) | `bindTap('actionId', ...)` (the same hook, action id form) |
| `data-action-type` | gesture kind | same |
| `data-action-params` | JSON of operands (e.g. `{"postId": "abc"}`) | same |

Hard rules:

- **String literals only at the bind site.** `bindTap('foo.bar.${kind}')` defeats the static analyzer. So does `bindTap(props.triggerId)`. The first argument to `go()` / `bindTap()` / `bindLongPress()` / `bindDoubleTap()` and the `id` field in `bindTap({ kind: 'action', id: '...' })` must all be **string literals** at the bind site. **Business pages must not import `useNavigate` from `react-router`** — ESLint and a CI grep enforce this; only the per-app `go()` helper is sanctioned.
- **System back uses `bindBack()`**, which emits `data-trigger="system.back"`. The OS intercepts this and routes through `BackDispatcher` — apps must not handle it themselves.
- **Pure back / cancel / close-overlay buttons must not be tagged as actions or transitions.** Use `bindBack()` only. A button whose entire job is "close this dialog" should not have an actionId or a transition declaration — `system.back` covers it.
- **Submit-then-back ("确定 / 完成 / 发表")** is modeled as an `action` with `behavior: 'submit'`, not as a transition. The `onTrigger` performs the side effect and then calls `back()` to close. **Do not** model it as a transition with a hardcoded `to` — that pollutes the graph with a misleading return target.
- **Navigation with side effect on the same tap is still a transition.** If a single tap both changes the URL and updates state, declare it as a `transition`; the side effect is observed downstream.
- **Don't tag controls that don't do anything.** A button placeholder waiting for implementation should not carry `data-trigger`.
- **Tab entries are tagged unconditionally.** Even when the user is already on the active tab, the tab button keeps its `bindTap(...)` — `data-trigger-*` must be present. The "tap to switch to the tab you're already on" no-op self-loop is filtered by the graph analyzer, not by stripping the binding from the UI. Conditionally removing `bindTap` for active tabs hides the entry from static scans and breaks replay.
- **Scroll containers** need `data-scroll-container="<name>"` and `data-scroll-direction="vertical|horizontal"`, matching their `scrollContainers` declaration. A layout scroller that wraps routed pages (`<Outlet />` / `<Routes>`) must be `<RouteScrollContainer>`, which sets both attributes and resets or restores the position per navigation (see [`../app/module-contract.md`](../app/module-contract.md#nameapptsx)).
- **When `data-trigger-params` / `data-action-params` is required**: when multiple controls share one `transitionId`/`actionId` but target different parameter values (Tab switch, list item open/delete), the params attribute must be present so the analyzer can distinguish entries. Single-target transitions without operands need no params.

### Mixing `data-trigger` and `data-action` on one DOM node

- **Default**: a given gesture type on a given node is **either** a transition (`data-trigger`) **or** an action (`data-action`), never both. The analyzer can't disambiguate two registrations for the same gesture.
- **Exception**: the same DOM node may carry **different gestures** with different semantics — e.g. an avatar that opens a profile on single-tap and triggers `cheer` on double-tap. In that case both `data-trigger` and `data-action` may coexist, distinguished by `data-trigger-type` vs `data-action-type`. The runtime must ensure a single gesture event never fires both `go()` and `onTrigger`.

### Reusable list items / generic components

When a list item or generic component represents many entries (e.g. a `<ContactRow>` rendered for every contact), do **not** pass `triggerId` / `actionId` as a string prop and re-bind inside the child — that hides the literal from the static analyzer. Instead, bind at the call site and pass the **already-bound props** down:

```tsx
// ✅ literal at the call site, child just spreads props
<ContactRow tapProps={bindTap('contacts.row.open', { id })} />
<ContactRow actionProps={bindTap({ kind: 'action', id: 'contacts.row.delete' }, { id })} />

// ❌ ID becomes a runtime string the analyzer can't trace
<ContactRow triggerId="contacts.row.open" id={id} />
```

### Shared chrome components (TopBar, FAB, global dialog)

When a clickable entry's **DOM element lives in a shared component** (TopBar right button, global FAB, unified dialog container) but the actual `transitionId` / `actionId` is configured by the current page via context / store, follow these rules:

1. **The shared component still binds with the gesture hook** — it must emit `data-trigger-*` / `data-action-*` like any other entry. A bare `onClick` defeats the toolchain.
2. **The configuration object's field name must be `id`** — not `actionId`, `transitionId`, or `key`. The analyzer scans every `{ id: '...' }` literal across the codebase; using an alias hides the entry.
3. **The page-side configuration must use a string literal in an object literal**:
   ```tsx
   // ✅ literal id, analyzer can discover
   setHeaderAction({ id: 'profile.name.submit', onTrigger });

   // ❌ variable / template — invisible to the analyzer
   setHeaderAction({ id: someId, onTrigger });
   setHeaderAction({ id: `profile.${field}.submit`, onTrigger });
   ```
4. **Exception**: the shared component's *internal* `bind*` call can read the id from context / store (that's the whole point of the indirection). The literal rule applies to the **page-side config**, not the shared component's internal forwarding.

## The runtime API

Apps call into navigation via `useAppNavigate()`:

```ts
const { go, back } = useAppNavigate();

go('wechat.discover.openSearch');
go('wechat.tab.switch', { tab: 'me' });
go('wechat.search.results', { q: 'cats' }, { mode: 'push' });

back();           // one history entry
back(2);          // two entries
```

`go(id, params?, options?)`:

- `id` — transition id from the declaration. The runtime resolves it to (target route, target uiState, mode) using the declaration plus any `cases`.
- `params` — object of parameter values used by `cases` resolution + interpolated into the destination URL.
- `options` — at minimum `{ mode?: 'push' | 'replace', popTo?: string, popToInclusive?: boolean }` in the standard helper. Some apps extend this locally, but business pages should still call their app's wrapper rather than importing React Router directly.

`back(n = 1)` — equivalent to `history.go(-n)` but mediated through the shadow `HistoryTracker` so popTo can target a specific route deterministically.

`popTo` behavior is implemented by the shared shadow `HistoryTracker` and exposed through each app's local navigation helper where needed.

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

# Enumerate reachable action trajectories → candidate tasks (JSON for .json, JSONL for .jsonl)
node scripts/generate_action_tasks_from_nav_graph.mjs \
  --graph public/<appname>_nav_graph.json \
  --out   public/<appname>_action_tasks.json \
  --app   <AppName>
```

### Graph viewer

Start the dev server and open `http://localhost:3000/nav_graph_viewer.html`. Pick a JSON file from the dropdown; the viewer is Cytoscape.js with a search-and-highlight overlay.

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

Transition declarations support a small `dataSource` system for this. The simplest example:

```ts
{
  id: 'redbook.feed.open-post',
  from: 'redbook.feed.base',
  to: '/note/:noteId',
  search: {},
  searchParams: {},
  params: { noteId: 'string' },
  mode: 'push',
  label: 'Open note',
  ui: { placement: 'content', icon: 'note', gesture: 'tap' },
  dataSource: {
    ref: 'notes',
    paramMapping: { noteId: 'id' },
    labelField: 'title',
  },
},
```

The `dataSource` says "this transition's `noteId` path param comes from the `notes` collection in the app config/state." The graph analyzer expands this into one edge per concrete note (in data mode), and the task generator can use the same expansion to enumerate "open the note titled X" tasks for each sample.

`dataSource.ref` is a dotted path into the app config object loaded for analyzer data mode.

For the full analyzer algorithm, unevaluable condition behavior, and debugging checklist, see [`data-sources.md`](data-sources.md).

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
| `'shelf[isPrivate=false]'` | Static filter: returns the subset matching the literal. Supported ops: `=`, `!=`. Supported value types: bool / non-negative integer / bare `\w+` string. |
| `'$value'` (in `paramMapping`) | The element itself is the value (use when the collection is `['u_1', 'u_2']`). |
| `'$key'` (in `paramMapping`) | Use the object's key when iterating a Record (`{ moments: {…}, scan: {…} }`). |

Parameterized lookups (`[field={param}]`) only resolve when the source node has a concrete `boundParams[param]` — abstract nodes keep the placeholder.

#### `from` matching — which `dataSource` wins

If a transition has multiple `dataSource` entries, the current analyzer checks the array in declaration order and uses the first entry whose `from` constraint matches the source node. Put specific entries before fallback entries.

| Form of `from` | Example | Meaning |
|---|---|---|
| FromConstraint with literal `search` values | `{ path: '/x', search: { tab: 'me' } }` | Path must match and `tab` must equal `'me'`. |
| FromConstraint with `'*'` wildcard search values | `{ path: '/x', search: { tab: '*' } }` | Path must match and `tab` must exist with any value. |
| FromConstraint with `null` search values | `{ path: '/x', search: { dialog: null } }` | Path must match and `dialog` must be absent. |
| Plain path string | `'/bookshelf'` | Path must match. |
| `'*'` or omitted | `'*'` | Fallback; matches any source. |

The analyzer does not currently sort by specificity and does not raise ambiguity errors. Declaration order is part of the behavior.

#### `paramBinding` resolved by the analyzer

Each transition param resolves to one of three binding kinds:

| Source | When | Edge `binding[param]` |
|---|---|---|
| `dataSource` | A matching `dataSource` provided the value | `{ source: 'dataSource', value: '<v>' }` |
| `inherited` | Source node has a concrete `boundParams[param]` | `{ source: 'inherited', value: '<v>' }` |
| `unbound` | Neither applied; the path stays a placeholder | `{ source: 'unbound' }` |

The distinction matters for graph pruning: only `dataSource` and `inherited` produce concrete data-mode nodes.

#### Data-mode `StateCondition` vocabulary

Used in `uiStates[].stateCondition`, `transition.ui.condition`, and action `condition`:

| Op | Shape | Meaning |
|---|---|---|
| `always` | `{ op: 'always' }` | Always true; use as the final fallback case |
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
- A `mode: 'replace'` transition with `cases` computes the actual tab target from runtime params or data-mode refs.

### Dialog visibility = URL push

A dialog is just a UI state pushed with `mode: 'push'`. Open via `go('myapp.page.openDialog')` which transitions to a uiState with `search: { dialog: 'open' }`. Close via `back()` — history pop closes the dialog.

**Never use `useState` for dialog visibility**: the back key has no view into your React state and pops past the dialog directly, taking the user to the previous page.

### `popTo` for end-of-flow returns

When you finish a checkout flow (cart → address → payment → confirmation) and want to send the user back to the home, you don't want `back()` four times (it'd revisit each intermediate page). Use `popTo('myapp.home', { popToInclusive: true })`. The shadow `HistoryTracker` figures out the right delta.

### Foreign-task isolation

When app A pushes app B via `startActivityForResult`, B is mounted on top of A's task. If B already had its own background task, B can now exist in two contexts. The navigation handler in the foreign-task instance detects this (`task.rootAppId !== appId`) and registers only its Activity-level navigator, leaving any own-task app-level registration alone. Most app authors never need to think about this; if you debug "my back button is going to the wrong app," that's the place to look.

## Declaration file shape

```ts
// apps/<App>/navigation.declaration.ts
import type { NavigationDeclaration } from './navigation.types';

export const NAVIGATION_DECLARATION = {
  routes: [ /* ... */ ],
  transitions: [ /* ... */ ],
  capabilities: {
    historyBack: true,  // must be declared explicitly — no default
  },
} as const satisfies NavigationDeclaration;
```

The `as const satisfies NavigationDeclaration` pattern is required: it gives the analyzer literal types (so route ids, transition ids, etc. are statically discoverable) while still enforcing the declaration shape.

### `capabilities`

A required top-level field. Currently has one key:

- `historyBack: boolean` — whether this app honors the system back gesture in the usual way. Must be set explicitly (no default fallback).

**Rule: every new path must also be registered in `<AppName>App.tsx`'s `<Routes>`.** Declaring a route here is not enough — React Router only matches paths in its `<Routes>` config. Forgetting to register raises `No routes matched location "/xxx"` at runtime.

## Common pitfalls

| Mistake | Symptom | Fix |
|---|---|---|
| Dynamic transition id (`bindTap(\`x.${kind}\`, …)`) | Analyzer can't find the declaration | Hard-code the literal |
| Empty `uiStates: []` | Lint failure | Add a base state with `search: {}` and id ending `.base` |
| Two `search: {}` states on the same route | Lint failure (`multipleBaseStates`) | Only one base per route |
| Base state id not ending with `.base` | Lint failure (`invalidBaseStateIds`) | Rename, e.g. `wechat.discover.base` |
| Declaring base `{ search: {} }` on a route with a mandatory query param | Lint failure | Make the param `queryParam`-dynamic, or split the route |
| Bare `from: '*'` on a transition | Graph is opaque, task generator misroutes | Enumerate concrete source routes / states |
| Path-only `from: '/x'` on a route without a `.base` state | Lint failure | Use `FromConstraint` to pin the discrete state |
| Tab-switch transition lists its own target route in `from` | Self-loop edge | Use a different transition id for within-page tab switching |
| Same-pathname discrete move with bare path string in `from` | Ambiguous edge in graph | Use `FromConstraint` with the source's `search` |
| `cases` non-empty but missing final `{ when: { op: 'always' } }` | Runtime throws | Add the always fallback (required) |
| New route added to declaration but not to `<Routes>` in `<AppName>App.tsx` | `No routes matched location "/xxx"` at runtime | Register the route |
| Tagging a cancel/close button as an action | Spurious node in graph; task generation tries to "submit" cancel | Use `bindBack()` instead |
| Using `useNavigate()` directly | Lint failure; back doesn't behave as expected | Use the app's `go()` / `back()` |
| Importing `BackDispatcher` from `os/` | Refactor breakage; abstraction leak | Use URL-driven dialogs |
| Pushing a dialog with `useState` | Back button skips the dialog | Push as a `mode: 'push'` transition |
| Mixing `data-trigger` and `data-action` on the same element with the same gesture type | Analyzer ambiguity | Pick one; different gestures on the same node are allowed (see DOM tagging exception) |

## Where to go next

- 📱 The minimal app walkthrough → [`../../guides/add-an-app.md`](../../guides/add-an-app.md)
- 🧠 What the OS does with the back key and intent routing → [`../os/overview.md`](../os/overview.md)
- 🚧 Intent and cross-app calls → [`../os/intent-system.md`](../os/intent-system.md)
- 📊 How the graph powers task generation → run `build_nav_artifacts.mjs` and open the viewer
