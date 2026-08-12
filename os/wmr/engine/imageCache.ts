/**
 * Image preloading and caching for WMR widgets.
 * Handles sprite sheets (srcid selects a frame from a vertically-stacked strip).
 */
import { realNow } from '../../TimeService';

const cache = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();
const failed = new Set<string>();

// ── 失败 URL 的跨页面加载记忆（sessionStorage） ──────────────────────────
// 主题包（mobilegym-data）里带 srcid 的图片如 "ources/result.png" 只存在
// result_0.png / result_1.png 等索引变体，基础文件本就不存在；帧序列探测
// （WmrBundleCache.warmIndexedVariantSequence）也天然以连续 miss 收尾。
// 这些注定 404 的请求原先只记在内存 Set，每次整页 reload（bench 每个
// episode reset 一次）都会全量重发（实测每次 ~80 个 404）。
// 记入 sessionStorage：同 tab 跨 reload 存活；__SIM__.reset() 只 clear
// localStorage，不波及；关浏览器/新开 tab 自动失效，数据包更新最迟一个
// TTL 周期后恢复探测。
const FAILED_STORE_KEY = '__WMR_IMG_FAILED_V1__';
const FAILED_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const FAILED_MAX = 2000;

const failedExpiry = new Map<string, number>(); // url -> expiresAt

function restorePersistedFailures(): void {
  try {
    const raw = window.sessionStorage.getItem(FAILED_STORE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    const now = realNow();
    for (const [url, expiresAt] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof expiresAt === 'number' && expiresAt > now) {
        failed.add(url);
        failedExpiry.set(url, expiresAt);
      }
    }
  } catch {
    // sessionStorage 不可用/数据损坏 → 静默退化为纯内存记忆
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function flushFailuresToStorage(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    const now = realNow();
    let entries = [...failedExpiry].filter(([, exp]) => exp > now);
    if (entries.length > FAILED_MAX) entries = entries.slice(entries.length - FAILED_MAX);
    window.sessionStorage.setItem(FAILED_STORE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // quota / privacy mode → 忽略，退化为纯内存记忆
  }
}

function rememberFailure(url: string): void {
  failedExpiry.set(url, realNow() + FAILED_TTL_MS);
  if (persistTimer === null) {
    persistTimer = setTimeout(flushFailuresToStorage, 1000);
  }
}

if (typeof window !== 'undefined') {
  restorePersistedFailures();
  // 探测常在页面生命周期尾部仍在进行，pagehide 时同步落盘防丢尾
  window.addEventListener('pagehide', flushFailuresToStorage);
}

export type AssetUrlResolver = (src: string) => string;

export function createPrefixedAssetUrlResolver(basePath: string): AssetUrlResolver {
  return (src: string) => `${basePath}${src}`;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  if (failed.has(url)) return Promise.resolve(cache.get(url) ?? new Image());

  let pending = loading.get(url);
  if (pending) return pending;

  pending = new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => { cache.set(url, img); loading.delete(url); resolve(img); };
    img.onerror = () => {
      cache.set(url, img);
      failed.add(url);
      rememberFailure(url);
      loading.delete(url);
      resolve(img);
    };
    img.src = url;
  });
  loading.set(url, pending);
  return pending;
}

export function getImage(url: string): HTMLImageElement | null {
  return cache.get(url) ?? null;
}

export function isImageLoadFailed(url: string): boolean {
  return failed.has(url);
}

// 供 WMR 引擎其他 fetch 型加载器（如 resourceStrings 的 locale XML 探测）
// 复用同一份失败记忆：确定性 404 只探测一次，跨 reload 不重发。
export function isKnownFailedUrl(url: string): boolean {
  return failed.has(url);
}

export function rememberFailedUrl(url: string): void {
  failed.add(url);
  rememberFailure(url);
}

/**
 * Derive per-character image URLs from a Time element's src path.
 * E.g. "time/0/t.png" → ["time/0/t_0.png", ..., "time/0/t_9.png", "time/0/t_dot.png"]
 */
export function timeDigitSrcs(srcBase: string): string[] {
  const dot = srcBase.lastIndexOf('.');
  const stem = dot >= 0 ? srcBase.slice(0, dot) : srcBase;
  const ext = dot >= 0 ? srcBase.slice(dot) : '.png';
  const srcs: string[] = [];
  for (let d = 0; d <= 9; d++) srcs.push(`${stem}_${d}${ext}`);
  srcs.push(`${stem}_dot${ext}`);
  return srcs;
}

/**
 * Collect all image src references from an AST node tree.
 */
export function collectImageSrcs(nodes: import('./types').WmrNode[]): string[] {
  const srcs = new Set<string>();
  function walk(ns: import('./types').WmrNode[]) {
    for (const n of ns) {
      if (n.tag === 'Image' && n.src) srcs.add(n.src);
      if (n.tag === 'ImageNumber' && n.src) srcs.add(n.src);
      if (n.tag === 'Time' && n.src) {
        for (const s of timeDigitSrcs(n.src)) srcs.add(s);
      }
      if ('children' in n && Array.isArray((n as any).children)) {
        walk((n as any).children);
      }
      if ('normalChildren' in n && Array.isArray((n as any).normalChildren)) {
        walk((n as any).normalChildren);
      }
      if ('pressedChildren' in n && Array.isArray((n as any).pressedChildren)) {
        walk((n as any).pressedChildren);
      }
    }
  }
  walk(nodes);
  return [...srcs];
}

/**
 * Preload all images from a WMR widget.
 * @param basePath  URL prefix, e.g. "/themes/<themeId>/clock_2x4/"
 * @param srcs      Relative src paths from collectImageSrcs
 */
export async function preloadAll(
  basePathOrResolver: string | AssetUrlResolver,
  srcs: string[],
): Promise<void> {
  const resolveUrl = typeof basePathOrResolver === 'string'
    ? createPrefixedAssetUrlResolver(basePathOrResolver)
    : basePathOrResolver;
  await Promise.all(srcs.map(s => loadImage(resolveUrl(s))));
}

/**
 * Draw a sprite frame from a vertically-stacked sprite strip.
 * WMR sprite images are stacked vertically: frame 0 at top, frame 1 below, etc.
 * Each frame has width = img.naturalWidth, height = img.naturalHeight / frameCount.
 * frameCount is inferred from aspect ratio (assumes square-ish frames).
 */
export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frameIndex: number,
  dx: number, dy: number, dw: number, dh: number,
): void {
  if (!img.naturalWidth || !img.naturalHeight) return;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  // Estimate frame count: height/width gives approximate count
  const frameCount = Math.max(1, Math.round(ih / iw));
  const frameH = ih / frameCount;
  const fi = Math.max(0, Math.min(Math.floor(frameIndex), frameCount - 1));

  ctx.drawImage(img, 0, fi * frameH, iw, frameH, dx, dy, dw, dh);
}
