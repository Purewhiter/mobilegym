/**
 * Bilibili asset-path resolution, shared by the page (data/index.ts) and the
 * device server (device/index.ts) so both rewrite `./images/...` paths the
 * same way. Pure: the CDN base is passed in.
 */

import { resolveCdnUrlWithBase } from '../../../os/utils/cdn';

const ASSET_EXT_RE = /\.(jpe?g|png|webp|gif|svg|mp4|webm|avif)(\?.*)?$/i;

export function createBilibiliAssetResolver(cdnBase: string) {
  const resolveUrl = (raw: unknown): unknown => {
    const s = typeof raw === 'string' ? raw : null;
    if (!s) return raw;
    if (s.startsWith('http') || s.startsWith('data:') || s.startsWith('blob:')) return raw;
    if (s.startsWith('/cdn/')) return resolveCdnUrlWithBase(s, cdnBase);
    if (s.startsWith('./images/') || s.startsWith('images/')) {
      return resolveCdnUrlWithBase(s, cdnBase, 'bilibili');
    }
    if (s.startsWith('/')) return raw;
    if (!ASSET_EXT_RE.test(s)) return raw;
    return resolveCdnUrlWithBase(s, cdnBase, 'bilibili');
  };

  const resolveDeep = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(resolveDeep);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        out[key] = resolveDeep(resolveUrl(child));
      }
      return out;
    }
    return resolveUrl(value);
  };

  return { resolveUrl, resolveDeep };
}
