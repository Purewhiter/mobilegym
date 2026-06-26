import { resolveCdnUrl } from '../../../os/utils/cdn';

const ASSET_EXT_RE = /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i;

export function resolveSpotifyAssetUrl(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return raw;
  if (/^(https?:\/\/|data:|blob:)/.test(raw)) return raw;
  if (raw.startsWith('/spotify-assets/')) {
    return resolveCdnUrl(raw.slice('/spotify-assets/'.length), 'spotify/images');
  }
  if (raw.startsWith('/cdn/')) return resolveCdnUrl(raw);
  if (raw.startsWith('./images/') || raw.startsWith('images/')) {
    return resolveCdnUrl(raw, 'spotify');
  }
  if (raw.startsWith('/')) return raw;
  if (!ASSET_EXT_RE.test(raw)) return raw;
  return resolveCdnUrl(raw, 'spotify');
}

export function resolveSpotifyAssetsDeep<T>(value: T): T {
  const resolved = resolveSpotifyAssetUrl(value);
  if (resolved !== value) return resolved as T;

  if (Array.isArray(value)) {
    return value.map(item => resolveSpotifyAssetsDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = resolveSpotifyAssetsDeep(child);
    }
    return out as T;
  }

  return value;
}
