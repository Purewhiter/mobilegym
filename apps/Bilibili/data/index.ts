import defaults from './defaults.json';
import { BILIBILI_CONSTANTS } from '../constants';
import type { BilibiliUser, BilibiliSettings } from '../types';
import { resolveCdnUrl } from '../../../os/utils/cdn';

export type { BilibiliUser, BilibiliVideo, RankingVideo, University } from '../types';

const ASSET_EXT_RE = /\.(jpe?g|png|webp|gif|svg|mp4|webm|avif)(\?.*)?$/i;

export const resolveBilibiliAssetUrl = (raw: unknown): unknown => {
  const s = typeof raw === 'string' ? raw : null;
  if (!s) return raw;
  if (s.startsWith('http') || s.startsWith('data:') || s.startsWith('blob:')) return raw;
  if (s.startsWith('/cdn/')) return resolveCdnUrl(s);
  if (s.startsWith('./images/') || s.startsWith('images/')) {
    return resolveCdnUrl(s, 'bilibili');
  }
  if (s.startsWith('/')) return raw;
  if (!ASSET_EXT_RE.test(s)) return raw;
  return resolveCdnUrl(s, 'bilibili');
};

export const resolveBilibiliAssetsDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(resolveBilibiliAssetsDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = resolveBilibiliAssetsDeep(resolveBilibiliAssetUrl(child));
    }
    return out;
  }
  return resolveBilibiliAssetUrl(value);
};

const resolvedDefaults = resolveBilibiliAssetsDeep(defaults) as typeof defaults;
const user = resolvedDefaults.user as BilibiliUser;

export const BILIBILI_CONFIG = {
  ...BILIBILI_CONSTANTS,
  ...resolvedDefaults,
  settings: resolvedDefaults.settings as BilibiliSettings,
  user,
};
