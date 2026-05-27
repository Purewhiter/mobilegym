/**
 * Side-effect-only module: eagerly loads every app-owned ContentProvider
 * and ambient-adapter registration module under
 * `apps/<app>/providers/*.ts` and `system/<app>/providers/*.ts`.
 *
 * Why this file exists separately from `os/ContentResolver.ts`
 * -----------------------------------------------------------
 * `import.meta.glob(..., { eager: true })` causes Vite to transform the glob
 * into static top-level imports of every matched module. ES modules evaluate
 * imports depth-first, so if this glob lived inside ContentResolver.ts, the
 * matched provider modules would run BEFORE ContentResolver.ts had a chance
 * to bind its `export const ContentResolver = {...}` — every
 * `ContentResolver.registerProvider(...)` at provider module body would
 * throw `Cannot access 'ContentResolver' before initialization`.
 *
 * Placing the glob in a separate file imported AFTER ContactsProvider/
 * MediaProvider/etc. inside `os/providers/bootstrap.ts` guarantees that
 * ContentResolver has finished initializing (it's already a transitive
 * dependency of the earlier OS providers) by the time this module runs.
 *
 * Discovery mirrors the existing `apps/* /*App.tsx` glob pattern used by
 * `os/data/appRegistry.tsx` — one-way OS scans a known file-name convention.
 */
import.meta.glob(['../../apps/*/providers/*.ts', '../../system/*/providers/*.ts'], { eager: true });
