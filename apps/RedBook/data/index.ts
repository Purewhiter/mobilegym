import defaults from './defaults.json';
import { REDBOOK_CONSTANTS } from '../constants';
import { resolveDataTimestamp } from '../../../os/TimeService';
import { resolveCdnUrl } from '../../../os/utils/cdn';
import type { Note, User } from '../types';

const ASSET_EXT_RE = /\.(jpe?g|png|webp|gif|svg|mp4|webm|avif)(\?.*)?$/i;

// RedBook 数据有两种资源源：
//   1) './images/...' / 'images/...' → 外部媒体镜像（CDN, mobilegym-data/redbook/...）
//   2) 其它带 asset 扩展名的裸路径 → 仓库内 bundle 资源（/@app-assets/RedBook/...）
const resolveAssetUrl = (raw: unknown): unknown => {
  const s = typeof raw === 'string' ? raw : null;
  if (!s) return raw;
  if (s.startsWith('http') || s.startsWith('/')) return raw;
  if (s.startsWith('./images/') || s.startsWith('images/')) {
    return resolveCdnUrl(s, 'redbook');
  }
  if (!ASSET_EXT_RE.test(s)) return raw;
  return `/@app-assets/RedBook/${s}`;
};

export const resolveAssetsDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(resolveAssetsDeep);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = resolveAssetsDeep(resolveAssetUrl(v));
    }
    return out;
  }
  return resolveAssetUrl(value);
};

const ts = (v: unknown) => resolveDataTimestamp(v as string | number);

function resolveAllTimestamps(data: typeof defaults) {
  return {
    ...data,
    sampleNotes: data.sampleNotes.map(note => ({
      ...note,
      createdAt: ts(note.createdAt),
      commentList: note.commentList?.map(c => ({ ...c, time: ts(c.time) })),
    })),
  };
}

const resolvedDefaults = resolveAllTimestamps(resolveAssetsDeep(defaults) as typeof defaults);

const users = resolvedDefaults.users as User[];
const sampleNotes = resolvedDefaults.sampleNotes as Note[];

export const REDBOOK_CONFIG = {
  ...REDBOOK_CONSTANTS,
  ...resolvedDefaults,
  users,
  sampleNotes,
};
