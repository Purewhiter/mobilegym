/**
 * 统一的 CDN 资源地址解析。
 *
 * 三端约定：
 *   dev (npm run dev) / 本地 nginx / fl1 nginx → fallback `/cdn` → 由 vite 中间件或
 *      nginx alias 映射到本地仓库根的 `mobilegym-data/`
 *   生产 (GitHub Action build) → 通过 VITE_CDN_BASE 注入完整 URL，例如
 *      `https://cdn.mobilegym.dev`，运行时直接打 R2/CF CDN
 *
 * 物理目录与 R2 完全镜像：
 *   mobilegym-data/<app>/images/...   ↔   r2:mobilegym-data/<app>/images/...
 *
 * 用法：
 *   const REDBOOK_CDN = cdn('redbook/images');
 *   const url = `${REDBOOK_CDN}/avatars/foo.jpg`;
 */

export function resolveCdnBase(raw: string | undefined): string {
  return (raw?.trim() || '/cdn').replace(/\/+$/, '');
}

const CDN_BASE = resolveCdnBase(
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CDN_BASE,
);

export function cdn(subpath: string = ''): string {
  const cleaned = subpath.replace(/^\/+/, '').replace(/\/+$/, '');
  return cleaned ? `${CDN_BASE}/${cleaned}` : CDN_BASE;
}

export const CDN_ROOT = CDN_BASE;

/**
 * 把 JSON 数据 / 持久化布局里的 raw 路径解析成最终 CDN URL。所有 app 公用。
 *
 * 行为表（按检查顺序）：
 *   `http(s)://...`、`blob:...`、`data:...`  → 原样返回（外链/内联资源）
 *   `/cdn/foo`                              → cdn('foo')   （legacy 迁移期遗留前缀）
 *   `./foo`                                 → cdn('foo')   （相对路径，跟 RedBook 数据 ./images/x 一致）
 *   `/foo`（其它绝对路径）                    → 原样返回（同源静态资源 / blob URL 兜底）
 *   `foo/bar`（裸 relative）                 → cdn('foo/bar')
 *
 * 可选 `prefix` 参数：app 数据里习惯不带自己 app 名（如 RedBook 的 ./images/avatars/x.jpg），
 * 可以传 prefix='redbook' → 最终 cdn('redbook/images/avatars/x.jpg')。
 * Launcher 数据已经在路径里带 themes/、wallpapers/ 顶级 namespace，不传 prefix 即可。
 */
export function resolveCdnUrl(raw: string, prefix?: string): string {
  if (!raw) return raw;
  if (/^(https?:\/\/|blob:|data:)/.test(raw)) return raw;

  let path = raw;
  if (path.startsWith('/cdn/')) {
    path = path.slice('/cdn/'.length);
  } else if (path.startsWith('./')) {
    path = path.slice(2);
  } else if (path.startsWith('/')) {
    return raw;
  }

  return cdn(prefix ? `${prefix}/${path.replace(/^\/+/, '')}` : path);
}
