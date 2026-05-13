import defaults from './defaults.json';
import { REDNOTE_CONSTANTS } from '../constants';
import { resolveDataTimestamp } from '../../../os/TimeService';
import { resolveCdnUrl } from '../../../os/utils/cdn';
import type { RedNoteConfig } from '../types';

const ASSET_EXT_RE = /\.(jpe?g|png|webp|gif|svg|mp4|webm|avif)(\?.*)?$/i;

// RedNote 数据有两种资源源：
//   1) './images/...' / 'images/...' → 外部媒体镜像（与 RedBook 共享 CDN bucket
//      `mobilegym-data/redbook/...`：rednote 内容与 redbook 同源以保证性能基准的可比性）
//   2) 其它带 asset 扩展名的裸路径 → 仓库内 bundle 资源（/@app-assets/RedNote/...）
//
// 同时导出 single-value 版本，loader.ts 在 SQL→dict 物化时 inline 应用，
// 避免再做一次 resolveAssetsDeep 全树递归 walk。
export const resolveAssetUrl = (raw: unknown): unknown => {
  const s = typeof raw === 'string' ? raw : null;
  if (!s) return raw;
  if (s.startsWith('http') || s.startsWith('/')) return raw;
  if (s.startsWith('./images/') || s.startsWith('images/')) {
    return resolveCdnUrl(s, 'redbook');
  }
  if (!ASSET_EXT_RE.test(s)) return raw;
  return `/@app-assets/RedNote/${s}`;
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
    notes: Object.fromEntries(Object.entries((data as any).notes || {}).map(([id, note]) => [
      id,
      {
        ...(note as any),
        createdAt: ts((note as any).createdAt),
        commentList: (note as any).commentList?.map((c: any) => ({ ...c, time: ts(c.time) })),
      },
    ])),
    comments: Object.fromEntries(Object.entries((data as any).comments || {}).map(([id, comment]) => [
      id,
      { ...(comment as any), time: ts((comment as any).time) },
    ])),
    notifications: ((data as any).notifications || []).map((notification: any) => ({
      ...notification,
      timestamp: ts(notification.timestamp),
    })),
    chats: ((data as any).chats || []).map((chat: any) => ({
      ...chat,
      lastTime: ts(chat.lastTime),
      messages: (chat.messages || []).map((m: any) => ({ ...m, timestamp: ts(m.timestamp) })),
    })),
  };
}

const resolvedDefaults = resolveAllTimestamps(resolveAssetsDeep(defaults) as typeof defaults);

export const REDNOTE_CONFIG: RedNoteConfig & typeof REDNOTE_CONSTANTS = {
  ...REDNOTE_CONSTANTS,
  ...resolvedDefaults,
} as unknown as RedNoteConfig & typeof REDNOTE_CONSTANTS;
