# Media Assets and Content Storage

Where an app's images, videos and large catalogs live, and who turns a reference into a URL. The model follows a real app: an API server returns data with URLs, a CDN serves the bytes, and the install package carries only UI resources.

## Four places

| Role | MobileGym | Holds | Served by |
|---|---|---|---|
| Install package | `apps/<App>/assets`, `res/` (git) | UI resources: icons, badges, fonts, illustrations. One copy each. | Vite `import` / `/@app-assets/` |
| CDN | `mobilegym-data/<appId>/` (not in git) | Content media: photos, avatars, covers, videos, and large read-only catalog JSON | `/cdn/` — Vite middleware in dev, nginx `alias` locally, `VITE_CDN_BASE` (R2/CF) in production |
| API server | Device server module (`apps/<App>/device/`) | Catalog queries and per-session user state; returns final URLs | `/__device` |
| Object storage | Device server session blobs | Files written during a session (uploads, downloads, edited photos) | `/__device/sessions/:sid/blobs/:id` |

The CDN stays separate from the device server. Its files are immutable and shared by every session and every parallel episode, and nginx / a real CDN serve them with sendfile, Range and long-lived caching. Streaming them through the Node device server would only make them slower.

## Rules

1. **Content media never goes into the code repo or the bundle.** Photos, avatars and videos go under `mobilegym-data/<appId>/`; do not `import` them or list them in a generated `images.ts`. Only UI resources live in `apps/<App>/assets`.
2. **One directory per app.** Everything an app reads from the CDN is under `mobilegym-data/<appId>/`, e.g. `media/` and `catalog/`. A private app ships its own data pack that extracts into the same `mobilegym-data/<appId>/`; no extra mount point is needed in dev or nginx.
3. **Name media by content hash.** `media/<sha256-prefix>@<width>.webp`. Identical images are stored once whichever entity uses them, and URLs never change meaning, so `immutable` caching is safe.
4. **Size by display size, in physical pixels.** Width ≈ dp × 3 (see [display scaling](../os/services/display-scaling.md)). Typical tiers: `@540` for list thumbnails, `@1080` for full-width and full-screen views. Screenshots are 1080 px wide and the agent only sees screenshots, so a full-width image below 1080 px looks blurry. Do not ship a single near-original size for every view.
5. **Videos:** H.264 MP4 at 540p–720p, `+faststart`, with a poster JPEG/WebP next to it. Both dev and nginx `/cdn/` support HTTP Range, which seeking and Safari need. Playback position must follow `TimeService` or the episode clock, so the same step yields the same frame across runs.
6. **Data holds typed references, not URLs or file paths.** For example `{ "cdn": "media/3fa9c1e2" }` for content media and `"icon": "IcParking"` for UI resources. Do not guess the kind from a string prefix or extension.
7. **One place resolves references.** With a device server module, the module resolves references with `resolveCdnUrlWithBase(ref, cdnBase, appId)` and queries return final URLs; pages render them as-is. Pages do not build `/cdn/...` strings themselves.
8. **Large catalogs are paged.** Split read-mostly data by entity and page, e.g. `catalog/hotels/<id>.json` and `catalog/reviews/<id>/page-<n>.json`, and load a page when it is opened. Do not load every entity at app start.

## Apps without a device server yet

Until an app has a device server module, keep the same layout and reference format, and do the resolving in one app-level module (e.g. `apps/<App>/data/media.ts`) built on `os/utils/cdn.ts`:

- Fetch catalog pages from `cdn('<appId>/catalog/...')`.
- Resolve media references in that module only, with `resolveCdnUrl(ref, '<appId>')`.

When the device server module arrives, this resolver moves into it and the catalog becomes its query handlers. The files under `mobilegym-data/<appId>/` and the data format stay the same.

## Existing apps

Spotify, Bilibili, Ebay, Map and RedBook still build some `/cdn/` URLs in page code, and `apps/Reddit/assets` bundles about 90 MB of content media. Bring them in line when they are next migrated. New apps follow these rules from the start.
