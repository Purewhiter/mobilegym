/**
 * Image preloading and caching for WMR widgets.
 * Handles sprite sheets (srcid selects a frame from a vertically-stacked strip).
 */

import { realNow } from '../../TimeService';

const cache = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();
const failed = new Map<string, { retryAt: number; delay: number }>();
const IMAGE_RETRY_DELAY_MS = 5_000;
const MAX_IMAGE_RETRY_DELAY_MS = 300_000;
const MAX_FAILED_IMAGES = 2_000;

export type AssetUrlResolver = (src: string) => string;

export function createPrefixedAssetUrlResolver(basePath: string): AssetUrlResolver {
  return (src: string) => `${basePath}${src}`;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  if (getImageRetryAt(url) !== undefined) return Promise.resolve(new Image());

  let pending = loading.get(url);
  if (pending) return pending;

  pending = new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => { failed.delete(url); cache.set(url, img); loading.delete(url); resolve(img); };
    img.onerror = () => {
      const lastFailure = failed.get(url);
      const delay = lastFailure ? Math.min(lastFailure.delay * 2, MAX_IMAGE_RETRY_DELAY_MS) : IMAGE_RETRY_DELAY_MS;
      failed.delete(url);
      failed.set(url, { retryAt: realNow() + delay, delay });
      if (failed.size > MAX_FAILED_IMAGES) {
        const oldest = failed.keys().next();
        if (!oldest.done) failed.delete(oldest.value);
      }
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

export function getImageRetryAt(url: string): number | undefined {
  const failure = failed.get(url);
  return failure && failure.retryAt > realNow() ? failure.retryAt : undefined;
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
