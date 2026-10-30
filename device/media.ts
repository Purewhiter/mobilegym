/**
 * Mirrored content media (docs/platform/app/media-assets.md).
 *
 * An app's `data/media.json` maps an original external URL to the content
 * hash of its copy under `mobilegym-data/<appId>/media/<hash>@<width>.webp`
 * (written by the media fetch script; `null` = could not be fetched). Catalog
 * loaders swap mirrored URLs for CDN URLs here, so the page never depends on
 * the original host. The original URLs stay in the data files.
 */

import { existsSync, readFileSync } from 'node:fs';

/** `(url, width?) => CDN URL` for mirrored URLs, the URL itself otherwise. */
export function mediaResolver(mapFile: string, mediaBase: string) {
  const map: Record<string, string | null> = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, 'utf8')) : {};
  return (url: string | undefined, width = 1080): string | undefined => {
    const hash = url ? map[url] : undefined;
    return hash ? `${mediaBase}/${hash}@${width}.webp` : url;
  };
}

/** Copy of `value` with every string leaf passed through `fn` (with its property name). */
export function mapStrings<T>(value: T, fn: (s: string, key: string | undefined) => string, key?: string): T {
  if (typeof value === 'string') return fn(value, key) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn, key)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn, k);
    return out as T;
  }
  return value;
}
