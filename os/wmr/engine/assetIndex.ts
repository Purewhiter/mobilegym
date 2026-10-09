/**
 * WMR bundle asset index — build-time file inventory for theme bundles.
 *
 * MAML has no file index: frame counts of `srcid` variants and the presence
 * of locale strings files are unknowable from manifest.xml alone, so the
 * engine historically discovered them by probing (guaranteed 404s on every
 * fresh page load). scripts/gen_theme_asset_index.mjs scans each bundle
 * directory at build time and emits assets-index.json; this module loads it
 * and registers it with the imageCache so every image request that the index
 * proves missing is short-circuited without touching the network.
 *
 * Missing/unreadable index (older data packs, inline bundles) → null, and all
 * call sites fall back to the legacy probing behavior unchanged.
 */
import {
  assetIndexVariantFrames,
  isKnownFailedUrl,
  registerAssetIndexFiles,
  rememberFailedUrl,
} from './imageCache';

export interface WmrAssetIndex {
  baseUrl: string;
  /** relPath 存在于 bundle 目录中（相对路径，不含 query）。 */
  has(relPath: string): boolean;
  /** 枚举 `stem_N.ext` 索引变体的全部实际存在帧号（升序）。 */
  variantFrames(src: string): number[];
}

const INDEX_NAME = 'assets-index.json';

export async function loadAssetIndex(baseUrl: string): Promise<WmrAssetIndex | null> {
  const url = `${baseUrl}${INDEX_NAME}`;
  // 旧数据包没有清单：404 结果记入跨 reload 失败记忆，
  // 避免"清单请求本身"变成每个 episode 重发的 404。
  if (isKnownFailedUrl(url)) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 404) rememberFailedUrl(url);
      return null;
    }
    const parsed: unknown = await resp.json();
    const files = (parsed as { files?: unknown })?.files;
    if (!Array.isArray(files) || !files.every((f) => typeof f === 'string')) return null;
    const set = new Set(files as string[]);
    registerAssetIndexFiles(baseUrl, files as string[]);
    return {
      baseUrl,
      has: (relPath: string) => set.has(relPath),
      variantFrames: (src: string) => assetIndexVariantFrames(baseUrl, src) ?? [],
    };
  } catch {
    return null;
  }
}
