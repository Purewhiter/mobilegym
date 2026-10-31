# Route Tables (pilot)

`os/navigation/` replaces the per-app navigation declaration with a small route table and jumps written in code. **Tencent Meeting** (`apps/TencentMeeting`) is the pilot; every other app still uses [`navigation.declaration.ts`](declaration.md).

## What an app writes

A route table lists the app's destinations and the finite UI states each keeps in its URL — the same information as a declaration's `routes` and `uiStates`, without transitions:

```ts
// apps/TencentMeeting/routes.ts
export const routes = defineRoutes({
  home: { path: '/' },
  meeting: { path: '/meeting', search: { dialog: ['chat', 'exit'] } },
  historyDetail: { path: '/history/:meetingId' },
});
```

Pages jump with the shared hooks; path params and query values are type-checked against the table:

```tsx
const { nav, bindNav, bindBack, bindTap } = useNavGestures();   // apps wrap it, e.g. useMeetingGestures()

<div {...bindNav(routes.historyDetail, { params: { meetingId } })} />          // push
<div {...bindNav(routes.me, { replace: true })} />                             // tab switch
<div {...bindNav(routes.meeting, { search: { dialog: 'chat' } })} />           // URL-driven dialog
nav.replace(routes.meetingEdit);                                               // from a handler
nav.back();
```

`bindBack()` is the system back, as before. In-place actions keep using `bindTap({ kind: 'action', id }, { onTrigger })`.

## Semantics (same as the declaration runtime)

- The target query starts empty: only `search` values (and keys listed in `keep`, copied from the current URL) end up in it; `null` clears a key.
- `replace: true` replaces the current history entry; otherwise the jump pushes.
- `popTo` / `popToInclusive` rewind the history first (Android's `popUpTo`).
- Replacing the page with the identical URL (tapping the current tab) does nothing.
- A declaration's `from` constraint becomes ordinary code: bind the jump only where it applies (for example, the delete-account entry does nothing while its dialog is open).

## DOM tags

`bindNav` tags elements `data-trigger="nav.<route name>"` with the path params and query values in `data-trigger-params`; there are no hand-written transition ids. The static tools (`build_nav_artifacts.mjs`, consistency check, action-task generation) do not read route tables; use [`scripts/explore_nav_graph.py`](../../../scripts/explore_nav_graph.py) instead, which taps every tagged element on a running simulator and records where each tap and the following system back land.

## How the pilot was checked

- Every one of Tencent Meeting's 41 declared transitions resolves to the same URL and push/replace mode through `buildHref` as through the old `go()`.
- `explore_nav_graph.py` on the build before and after the migration: the same 36 states and the same tap/back outcomes. The only differences are two elements that were tagged but did nothing (a transition missing from the declaration, and an entry under an open dialog), which are no longer tagged.
