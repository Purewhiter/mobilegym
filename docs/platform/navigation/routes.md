# Routes and Navigation

Every app keeps a **route table** (`routes.ts`): its pages and the finite UI states each keeps in its URL, like the destinations of an Android nav graph. Jumps are written in code with the shared hooks in `os/navigation/`; there is no per-button transition table to keep in sync.

## The route table

```ts
// apps/TencentMeeting/routes.ts
import { defineRoutes } from '../../os/navigation/routes';

export const routes = defineRoutes({
  home: { path: '/', description: '会议主页' },
  meeting: {
    path: '/meeting',
    search: { dialog: ['chat', 'exit'] },
    description: '会议进行中',
    states: { 'dialog=chat': '会议聊天弹窗', 'dialog=exit': '退出会议弹窗' },
  },
  historyDetail: { path: '/history/:meetingId', description: '历史会议详情' },
});
```

- `path` uses react-router syntax; `:param` segments are typed and required when jumping there.
- `search` lists the values a query key can take for discrete UI states (tabs, dialogs, sheets). Keys left out of `search` (a search keyword, an item id) accept any value.
- `description` and `states` (optional) say what the page and each of its UI states show; they name the nodes of the explored graph. When `states` is given it is the list of states the page really has (`tab=all&sub=system`), otherwise every declared value of each key is one.
- Every path must also be registered in the app's `<Routes>`.

## Jumping

```tsx
const { nav, bindNav, bindBack, bindTap } = useMeetingGestures();   // wraps useNavGestures()

<div {...bindNav(routes.historyDetail, { params: { meetingId } })} />          // push
<div {...bindNav(routes.me, { replace: true })} />                             // tab switch
<div {...bindNav(routes.meeting, { search: { dialog: 'chat' } })} />           // URL-driven dialog
<div {...bindNav(routes.home, { replace: true, beforeTrigger: cancelMeeting })} />
nav.replace(routes.meetingEdit);                                               // from a handler
nav.push(routes.search, {}, { state: { viewportCenter } });
nav.back();
nav.toPath(intentRoute, { replace: true });                                    // a path that arrived at runtime
```

Semantics:

- The target query **starts empty**: only `search` values, and keys listed in `keep` (copied from the current URL first), end up in it. `null` / `undefined` clears a key. Keys keep the order `keep`, then `search`.
- `replace: true` replaces the current history entry; otherwise the jump pushes. Replacing the page with the identical URL (tapping the current tab) does nothing.
- `popTo` (a path, or several tried in order) rewinds the history first, like Android's `popUpTo`; `popToInclusive` pops the match too.
- `state` becomes the new entry's `location.state`.

## Rules

- **Tabs** are separate pathnames (`/`, `/contacts`, `/me`) and switch with `replace: true`.
- **Dialogs, sheets, menus are URL-driven**: open them with a jump that adds a query value (`search: { dialog: 'chat' }`), derive visibility from the URL, close them with back. Never control dialog visibility with `useState` — the back key cannot see it.
- **Conditions are code**: a jump that only applies in some states (only while a dialog is closed, only after a choice) is bound only where it applies.
- **Business pages do not call `useNavigate()`**; a path string from an intent or deep link goes through `nav.toPath`.
- **Back / close / cancel** use `bindBack()` (`system.back`), which runs the OS back chain.
- Do not import `BackDispatcher` in app code.

## DOM tags

`bindNav` tags elements `data-trigger="nav.<route name>"` with path params and query values in `data-trigger-params`; `bindBack` tags `data-trigger="system.back"`; actions are tagged as described in [actions.md](actions.md). Ids come from the route table, so nothing is hand-written. A control that navigates through a plain `onClick` is invisible to the tools below — use `bindNav`.

## Exploring an app's graph

There is no hand-written graph. [`scripts/explore_nav_graph.py`](../../../scripts/explore_nav_graph.py) builds one from a running simulator:

```bash
python scripts/explore_nav_graph.py http://localhost:3000/ tencent_meeting out.json
python scripts/explore_nav_graph.py --diff before.json after.json
```

- **Nodes are pages, not URLs.** Each URL is matched to the route table the way react-router matches it (`__SIM__.matchRoute`); a node is a route plus the UI state its query declares (`/meeting?dialog=chat`). A photo page is one node however many photos there are.
- **Edges** merge the controls with one tag on a page: source, target, tag id, gesture, push / replace (whether the app's history grew; `activity` when a new activity opened on top), where system back then lands, the controls' text (or their row's, for a switch or icon), and how many were tapped, found COVERED by an overlay, or not tested because the page could not be reached again.
- **What is explored is bounded and set in `scripts/explore_config/<appId>.json`**: `instancesPerRoute` (instances visited per node, default 2; an instance is a URL plus the controls it shows and their text, so a meeting page reached as host (with “结束会议”) and as guest counts twice), `tapsPerGroup` (controls of one tag tapped per page, default 2), `skip` (ids never tapped), `prefer` (params tapped first, for controls only some items show: a meeting the user hosted) and `inputs` (text typed on a page before tapping, such as a meeting number).
- Every tap starts from a reset simulator with frozen simulated time (`--sim-time`), reaching its page again by the recorded taps, and every input waits for `__SIM__.waitForIdle`, so two runs on the same build give the same graph.
- The output also lists routes or declared states never reached (`unreached`: states in `states` must be reached exactly, otherwise each declared value must appear in some reached node), URLs no route matches (`unmatched`), controls that could not be tested, the actions on each node, and for each action the shortest tap path from the start page (`tasks`, the old declarations' action tasks).

Use the diff before and after any navigation change, and read `unreached`: a state missing there usually means a control without a tag, a dialog kept in `useState`, or a page that needs a config entry.

## How the migration was checked

The per-app navigation declarations were removed in one change (the Tencent Meeting pilot first). For every app:

- Each declared transition used in code was resolved through the old `go()` semantics of that app and through `buildHref` with the new call; URLs and push/replace matched for all of them. The two conditional (`cases`) transitions, Bilibili's following tab and WechatReading's audiobooks tab, were rewritten by hand.
- `explore_nav_graph.py` on the build before and after: identical graphs for X (602 edges), WechatReading (437), Alipay (237), Weather (140), Settings (136), Railway12306 (89), eBay (41), FileManager (36) and the smaller system apps; the differences found in Tencent Meeting, WeChat, Reddit and Contacts were taps the old declaration's `from` forbade (re-tapping the current tab, a control under an open menu), now guarded in code the same way. Calendar, Notes, SMS, Gallery, ThemeStore and Browser navigated mostly through untagged `onClick` and relied on the per-transition check; a follow-up change bound those controls with `bindNav` (and tagged submit-then-leave buttons as actions) without changing where they go.
- Three controls changed on purpose: they were dead before because the declaration's `from` list was too narrow — Spotify's Timer in a queue sheet opened outside the player, Spotify's "New playlist" in the save sheet on `/library`, and SMS's MMS / SIM rows under advanced settings. They now open their pages.

Behaviour was kept even where the old code differed from its declaration: eBay always pushes (tabs included) and its back pops history directly; FileManager's taps stop propagation and its back pops history directly; Bilibili's jumps within the same page now pass the path params they used to inherit from the current URL.
