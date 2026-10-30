# App State

App state is the benchmark-visible runtime overlay under `__SIM__.getState().apps.<appId>`.

## What Belongs Here

| Include | Avoid |
|---|---|
| Current user, settings, drafts, messages created during the run. | Large static catalogs, posts, products, map places, song libraries. |
| Per-entity user overlays such as liked IDs, follow state, read progress. | Duplicated display strings that can be derived from semantic fields. |
| Task-relevant mutable state used by judges. | UI-only ephemeral state unless it is intentionally exposed as `_temp`. |

Large world data should stay outside snapshots and be composed with runtime overlay at render time.

## Store Rules

- App state lives in the device session ([`device-server.md`](device-server.md)); the store's appId matches `manifest.id`.
- Store semantic fields, not display strings.
- Do not define query-style getters in Zustand store actions (`getXById`, `isLiked`, etc.).
- Components should subscribe to data and derive booleans locally or via memoized selectors.

## Bench Access

If tasks need to judge a derived view, app code and bench code should share a stable view accessor or equivalent helper so both sides see the same resolved state.

## Related Docs

- Full state model → [model.md](model.md)
- App data layering → [../app/data-layering.md](../app/data-layering.md)
- Generated live schema → [../../api/app-state-schema.md](../../api/app-state-schema.md)
