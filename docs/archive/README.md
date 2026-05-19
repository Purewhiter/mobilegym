# Archive

This directory holds documents that are kept for reference but are no longer part of the active documentation surface.

## Layout

- **[`proposals-2026/`](proposals-2026/)** — forward-looking proposals that were drafted during 2026 development but have not yet been integrated into the platform. Useful if you're picking up one of these threads or curious about the design alternatives we considered.
- **[`internal-2026/`](internal-2026/)** — maintainer-only operational notes (APK reverse-engineering workflow, large-scale vLLM deployment tuning, theme-resource pulling from a connected device, etc.). Preserved for historical reference; not part of the public surface.

### Pre-platform-refactor specs (superseded by `docs/platform/*`)

Mirrors the pre-refactor layout, so anything that used to live at `docs/<x>/...` is now at `docs/archive/<x>/...`:

- **[`specs/`](specs/)** — earlier authoritative specs (`PROJECT_SPEC_V2`, `APP_STATE_DATA_SPEC`, `APP_DESIGN_SPEC`, `CROSS_APP_LAUNCH_SPEC`, `OS_DATA_LAYER_SPEC`, `APP_DATA_LAYERING_SPEC`) — superseded by [`../platform/`](../platform/).
- **[`navigation/`](navigation/)** — navigation / actions / data-source proposal docs — superseded by [`../platform/declarative-navigation.md`](../platform/declarative-navigation.md).
- **[`arch/`](arch/)** — earlier system-architecture overviews — superseded by [`../architecture.md`](../architecture.md) + [`../platform/`](../platform/).
- **[`os-services/`](os-services/)** — earlier per-service specs (`DISPLAY_SCALING`, `NETWORK_SERVICE`, `SMS_GATEWAY`) — superseded by [`../platform/os-services.md`](../platform/os-services.md).

### Other historical material at the root

`APP_RESOURCE_MIGRATION_GUIDE.md`, `RESOURCE_CLEANUP_SCRIPTS.md`, `Update_Logs.md`, `app-upgrade-plan.md`, `i18n-migration-guide.md`, `wechat-resource-migration-plan.md`, and the `os-plans/` / `os-problems/` / `problems/` / `todos/` / `torelease/` directories — older migration / planning / problem-tracking material from prior phases.

## Trust

Files here are not guaranteed to reflect current behavior. If something here contradicts a document elsewhere in `docs/`, trust the active doc, not the archive.

If you are looking for a specific document that used to live elsewhere in `docs/`, check `git log` for renames — most files moved to the mirrored `docs/archive/<original-subdir>/` path.
