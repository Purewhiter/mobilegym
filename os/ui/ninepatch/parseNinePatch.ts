/*
 * @Author      : PureWhite
 * @Date        : 2026-02-22 19:43:35
 * @LastEditors : PureWhite
 * @LastEditTime: 2026-02-28 03:36:57
 * @Description : 
 */
export type NinePatchInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type DecodeResult = {
  insets: NinePatchInsets;
  trimmedBlob: Blob;
};

function isBlack(r: number, g: number, b: number, a: number): boolean {
  return a > 0 && r < 16 && g < 16 && b < 16;
}

function findMarkedRangeTopBorder(data: Uint8ClampedArray, w: number): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  for (let x = 1; x < w - 1; x++) {
    const i = (0 * w + x) * 4;
    if (isBlack(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      if (start === -1) start = x;
      end = x;
    }
  }
  if (start === -1 || end === -1) return null;
  return { start, end };
}

function findMarkedRangeLeftBorder(data: Uint8ClampedArray, w: number, h: number): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  for (let y = 1; y < h - 1; y++) {
    const i = (y * w + 0) * 4;
    if (isBlack(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      if (start === -1) start = y;
      end = y;
    }
  }
  if (start === -1 || end === -1) return null;
  return { start, end };
}

export async function decodeNinePatchFromUrl(src: string): Promise<DecodeResult | null> {
  const res = await fetch(src);
  if (!res.ok) return null;
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return null;

  const w = bitmap.width;
  const h = bitmap.height;
  if (w < 3 || h < 3) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  const xRange = findMarkedRangeTopBorder(data, w);
  const yRange = findMarkedRangeLeftBorder(data, w, h);
  if (!xRange || !yRange) return null;

  const contentW = w - 2;
  const contentH = h - 2;
  const stretchStartX = xRange.start - 1;
  const stretchEndX = xRange.end - 1;
  const stretchStartY = yRange.start - 1;
  const stretchEndY = yRange.end - 1;

  const left = Math.max(0, Math.min(contentW, stretchStartX));
  const right = Math.max(0, Math.min(contentW, contentW - (stretchEndX + 1)));
  const top = Math.max(0, Math.min(contentH, stretchStartY));
  const bottom = Math.max(0, Math.min(contentH, contentH - (stretchEndY + 1)));

  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = contentW;
  trimmedCanvas.height = contentH;
  const tctx = trimmedCanvas.getContext('2d');
  if (!tctx) return null;
  tctx.drawImage(canvas, 1, 1, contentW, contentH, 0, 0, contentW, contentH);

  const trimmedBlob: Blob | null = await new Promise((resolve) => {
    trimmedCanvas.toBlob((b) => resolve(b), 'image/png');
  });
  if (!trimmedBlob) return null;

  return { insets: { top, right, bottom, left }, trimmedBlob };
}

