# Navigation Runtime State

Runtime navigation uses React Router `MemoryRouter` plus MobileGym's app navigation hooks.

## App Contract

Business pages navigate with `bindNav` / `nav` from `os/navigation` (see [routes.md](routes.md)), not `useNavigate()` directly.

The entry component calls `useAppNavigationHandler` inside `MemoryRouter`. The hook registers:

| Registration | Purpose |
|---|---|
| App navigator | Lets OS route `openApp(id, route)`. |
| Activity navigator | Lets OS control borrowed/foreign Activity instances. |
| Back handler | Connects app history to BackDispatcher. |
| History tracker | Maintains shadow entries for `popTo` and generated path logic. |

## URL as UI State

Dialogs, drawers, tabs, filters, and finite UI states should be represented in route/search state so Back can close them correctly.

React local state is fine for visual-only details that Back does not need to understand.

## Foreign Task Isolation

When app B is pushed onto app A's Task, app B may already have a background own-Task instance. The foreign instance skips app-level registration and uses only Activity-level navigation to avoid clobbering the background instance.

## Related Docs

- Route tables and jumps → [routes.md](routes.md)
- OS Task lifecycle → [../os/task-lifecycle.md](../os/task-lifecycle.md)
- Cross-app launch → [../os/cross-app-launch.md](../os/cross-app-launch.md)
