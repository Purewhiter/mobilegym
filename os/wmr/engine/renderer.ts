/**
 * WMR Canvas renderer.
 * Traverses the WmrNode AST and draws onto a CanvasRenderingContext2D.
 */
import type {
  WmrNode, WmrGroup, WmrImage, WmrText, WmrDateTime,
  WmrRectangle, WmrArc, WmrButton, WmrBaseAttrs,
  WmrImageNumber, WmrMask, WmrArray, WmrTime, WmrMusicControl, WmrTrigger,
  WmrLine, WmrCircle,
} from './types';
import { evalNum, evalStr, evalExprStr, toNum, compileExpr, evalExpr } from './expression';
import { VarContext, formatDateTime } from './variables';
import {
  getImage,
  isImageLoadFailed,
  loadImage,
  drawSpriteFrame,
  type AssetUrlResolver,
} from './imageCache';
import * as TimeService from '../../TimeService';

const FONT_MAP: Record<string, string> = {
  'mitype-clock': '"SF Pro Display", "Helvetica Neue", "PingFang SC", sans-serif',
  'mitype-normal': '"SF Pro Display", "Helvetica Neue", "PingFang SC", sans-serif',
  'mitype-regular': '"SF Pro Display", "Helvetica Neue", "PingFang SC", sans-serif',
  'mitype-semibold': '"SF Pro Display", "Helvetica Neue", "PingFang SC", sans-serif',
  'mitype-bold': '"SF Pro Display", "Helvetica Neue", "PingFang SC", sans-serif',
  'mitype-mono-bold': '"SF Mono", "Menlo", "Monaco", monospace',
  'mitype-mono-semibold': '"SF Mono", "Menlo", "Monaco", monospace',
  'miui-thin': '"PingFang SC", "Helvetica Neue", sans-serif',
  'miui-bold': '"PingFang SC", "Helvetica Neue", sans-serif',
  'mipro-regular': '"PingFang SC", "Helvetica Neue", sans-serif',
  'mipro-normal': '"PingFang SC", "Helvetica Neue", sans-serif',
  'mipro-normol': '"PingFang SC", "Helvetica Neue", sans-serif',
  'mipro-medium': '"PingFang SC", "Helvetica Neue", sans-serif',
  'mipro-semibold': '"PingFang SC", "Helvetica Neue", sans-serif',
  'mipro-demibold': '"PingFang SC", "Helvetica Neue", sans-serif',
  'mipro-bold': '"PingFang SC", "Helvetica Neue", sans-serif',
};

// ---------------------------------------------------------------------------
// Offscreen canvas pool — avoids per-frame allocation & GC pressure
// ---------------------------------------------------------------------------
const canvasPool: HTMLCanvasElement[] = [];

function acquireCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = canvasPool.pop() ?? document.createElement('canvas');
  const pw = Math.max(1, Math.round(w));
  const ph = Math.max(1, Math.round(h));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  } else {
    canvas.getContext('2d')?.clearRect(0, 0, pw, ph);
  }
  return canvas;
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  if (canvasPool.length < 16) canvasPool.push(canvas);
}

function mapFont(family: string | undefined): string {
  if (!family) return '"SF Pro Display", "PingFang SC", sans-serif';
  if (FONT_MAP[family]) return FONT_MAP[family];
  if (family.startsWith('mipro-')) return '"PingFang SC", "Helvetica Neue", sans-serif';
  if (family.startsWith('mitype-mono')) return '"SF Mono", "Menlo", "Monaco", monospace';
  if (family.startsWith('mitype-')) return '"SF Pro Display", "Helvetica Neue", "PingFang SC", sans-serif';
  return FONT_MAP[family] ?? `"${family}", sans-serif`;
}

const XFERMODE_NUM_MAP: Record<number, GlobalCompositeOperation> = {
  0: 'destination-out',
  1: 'copy',
  3: 'source-over',
  4: 'destination-over',
  5: 'source-in',
  6: 'destination-in',
  7: 'source-out',
  8: 'destination-out',
  9: 'source-atop',
  10: 'destination-atop',
  11: 'xor',
  12: 'darken',
  13: 'lighten',
  14: 'multiply',
  15: 'screen',
};

function parseColor(c: string | undefined): string {
  if (!c) return '#ffffff';
  if (c.startsWith('#') && c.length === 9) {
    const a = parseInt(c.slice(1, 3), 16);
    const rgb = c.slice(3);
    return `rgba(${parseInt(rgb.slice(0, 2), 16)},${parseInt(rgb.slice(2, 4), 16)},${parseInt(rgb.slice(4, 6), 16)},${(a / 255).toFixed(3)})`;
  }
  if (c.startsWith('#') && c.length === 7) return c;
  return c;
}

function isLiteralColor(src: string | undefined): boolean {
  return !!src && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(src.trim());
}

type NinePatchInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const ninePatchInsetCache = new WeakMap<HTMLImageElement, NinePatchInsets>();

export interface RenderOptions {
  basePath: string;
  assetUrlResolver?: AssetUrlResolver;
  onIntent?: (pkg: string, cls?: string) => boolean | void;
  enableHitRegions?: boolean;
  enableMeasurePass?: boolean;
}

interface HitRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  button?: WmrButton;
  triggers?: WmrTrigger[];
}

interface CachedTextLayout {
  key: string;
  lines: string[];
  metrics: TextMetrics[];
  measuredWidth: number;
  lineHeight: number;
  blockHeight: number;
}

export class WmrCanvasRenderer {
  private ctx!: CanvasRenderingContext2D;
  private vars: VarContext;
  private opts: RenderOptions;
  private hitRegions: HitRegion[] = [];
  private designWidth: number;
  private designHeight: number;
  private preserveAspect: boolean;
  private scale = 1;
  private scaleX = 1;
  private scaleY = 1;
  private rootRenderScaleX = 1;
  private rootRenderScaleY = 1;
  private offsetX = 0;
  private offsetY = 0;
  private measureOnly = false;
  private activeRegion: HitRegion | null = null;
  private activeButton: WmrButton | null = null;
  private lastResolvedImageByNode = new WeakMap<WmrImage, { src: string; frameIndex?: number }>();
  private enableHitRegions: boolean;
  private enableMeasurePass: boolean;
  private lastCanvasWidth = 0;
  private lastCanvasHeight = 0;
  private lastCanvasDpr = 0;
  private textLayoutCache = new WeakMap<object, CachedTextLayout>();

  constructor(vars: VarContext, opts: RenderOptions, designWidth: number, designHeight: number, preserveAspect = true) {
    this.vars = vars;
    this.opts = opts;
    this.designWidth = designWidth;
    this.designHeight = designHeight;
    this.preserveAspect = preserveAspect;
    this.enableHitRegions = opts.enableHitRegions ?? true;
    this.enableMeasurePass = opts.enableMeasurePass ?? true;
  }

  setViewport(designWidth: number, designHeight: number, preserveAspect = this.preserveAspect): void {
    this.designWidth = designWidth;
    this.designHeight = designHeight;
    this.preserveAspect = preserveAspect;
  }

  private resolveAssetUrl(src: string): string {
    return this.opts.assetUrlResolver ? this.opts.assetUrlResolver(src) : this.opts.basePath + src;
  }

  render(canvas: HTMLCanvasElement, nodes: WmrNode[]): void {
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    const pixelWidth = Math.max(1, Math.round(displayW * dpr));
    const pixelHeight = Math.max(1, Math.round(displayH * dpr));
    if (
      canvas.width !== pixelWidth
      || canvas.height !== pixelHeight
      || this.lastCanvasDpr !== dpr
      || this.lastCanvasWidth !== displayW
      || this.lastCanvasHeight !== displayH
    ) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      this.lastCanvasWidth = displayW;
      this.lastCanvasHeight = displayH;
      this.lastCanvasDpr = dpr;
    }
    const nextScaleX = displayW / Math.max(1, this.designWidth);
    const nextScaleY = displayH / Math.max(1, this.designHeight);
    if (this.preserveAspect) {
      this.scale = Math.max(1e-6, Math.min(nextScaleX, nextScaleY));
      this.scaleX = this.scale;
      this.scaleY = this.scale;
      this.offsetX = Math.max(0, (displayW / this.scale - this.designWidth) / 2);
      this.offsetY = Math.max(0, (displayH / this.scale - this.designHeight) / 2);
    } else {
      this.scaleX = Math.max(1e-6, nextScaleX);
      this.scaleY = Math.max(1e-6, nextScaleY);
      this.scale = Math.min(this.scaleX, this.scaleY);
      this.offsetX = 0;
      this.offsetY = 0;
    }
    this.rootRenderScaleX = Math.max(1e-6, dpr * this.scaleX);
    this.rootRenderScaleY = Math.max(1e-6, dpr * this.scaleY);

    const c = canvas.getContext('2d');
    if (!c) return;
    this.ctx = c;
    this.vars.setScreenSize(this.designWidth, this.designHeight);

    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.scale(dpr * this.scaleX, dpr * this.scaleY);
    if (this.offsetX || this.offsetY) c.translate(this.offsetX, this.offsetY);

    if (this.enableMeasurePass) {
      this.measureOnly = true;
      this.renderNodes(nodes);
      this.measureOnly = false;
    }

    this.hitRegions = [];
    this.renderNodes(nodes);

    c.restore();
  }

  handleClick(canvas: HTMLCanvasElement, clientX: number, clientY: number): boolean {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / this.scaleX - this.offsetX;
    const y = (clientY - rect.top) / this.scaleY - this.offsetY;
    const region = this.findHitRegion(x, y);
    return region ? this.triggerRegion(region, 'up') : false;
  }

  handlePointerEvent(
    canvas: HTMLCanvasElement,
    action: 'down' | 'move' | 'up' | 'cancel',
    clientX: number,
    clientY: number,
  ): boolean {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / this.scaleX - this.offsetX;
    const y = (clientY - rect.top) / this.scaleY - this.offsetY;

    if (action !== 'cancel') {
      if (action === 'down') {
        this.vars.set('touch_begin_x', x);
        this.vars.set('touch_begin_y', y);
      }
      this.vars.set('touch_x', x);
      this.vars.set('touch_y', y);
    }

    if (action === 'down') {
      const region = this.findHitRegion(x, y);
      this.activeRegion = region;
      this.activeButton = region?.button ?? null;
      return region ? (this.triggerRegion(region, 'down') || this.hasPressedState(region)) : false;
    }

    if (action === 'move') {
      if (!this.activeRegion) return false;
      const inside = this.isPointInsideRegion(this.activeRegion, x, y);
      this.activeButton = inside ? (this.activeRegion.button ?? null) : null;
      return this.triggerRegion(this.activeRegion, 'move')
        || (inside && this.hasPressedState(this.activeRegion));
    }

    if (action === 'cancel') {
      const region = this.activeRegion;
      this.activeRegion = null;
      this.activeButton = null;
      return region ? this.triggerRegion(region, 'cancel') : false;
    }

    const region = this.activeRegion;
    this.activeRegion = null;
    this.activeButton = null;
    if (!region) return false;
    if (!this.isPointInsideRegion(region, x, y)) {
      return this.triggerRegion(region, 'cancel');
    }
    return this.triggerRegion(region, 'up');
  }

  private renderNodes(nodes: WmrNode[]): void {
    for (const node of nodes) {
      this.renderNode(node);
    }
  }

  private renderNode(node: WmrNode): void {
    switch (node.tag) {
      case 'Group': this.renderGroup(node); break;
      case 'Image': this.renderImage(node); break;
      case 'Text': this.renderText(node); break;
      case 'DateTime': this.renderDateTime(node); break;
      case 'Rectangle': this.renderRectangle(node); break;
      case 'Arc': this.renderArc(node); break;
      case 'Circle': this.renderCircle(node); break;
      case 'Line': this.renderLine(node); break;
      case 'Button': this.renderButton(node); break;
      case 'ImageNumber': this.renderImageNumber(node); break;
      case 'Time': this.renderTime(node); break;
      case 'Mask': this.renderMask(node); break;
      case 'Array': this.renderArray(node); break;
      case 'MusicControl': this.renderMusicControl(node); break;
      default:
        break;
    }
  }

  private evalCondition(condition: string | undefined): boolean {
    if (!condition) return true;
    try {
      return toNum(evalExpr(compileExpr(condition), this.vars)) !== 0;
    } catch {
      return false;
    }
  }

  private evalColor(src: string | undefined): string {
    if (!src) return '#ffffff';
    if (isLiteralColor(src)) return parseColor(src);
    return parseColor(evalStr(src, this.vars) || src);
  }

  private applyCompositeMode(node: { xfermode?: string; xfermodeNum?: string }): void {
    const c = this.ctx;
    if (node.xfermodeNum) {
      const num = parseInt(node.xfermodeNum, 10);
      c.globalCompositeOperation = XFERMODE_NUM_MAP[num] ?? 'source-over';
      return;
    }
    if (!node.xfermode) return;
    const mode = node.xfermode.trim().toLowerCase();
    const modes: Record<string, GlobalCompositeOperation> = {
      clear: 'destination-out',
      dst_in: 'destination-in',
      src_in: 'source-in',
      src_over: 'source-over',
      dst_over: 'destination-over',
      src_atop: 'source-atop',
      dst_atop: 'destination-atop',
      src_out: 'source-out',
      dst_out: 'destination-out',
      xor: 'xor',
      screen: 'screen',
      multiply: 'multiply',
      lighten: 'lighten',
      darken: 'darken',
      add: 'lighter',
    };
    c.globalCompositeOperation = modes[mode] ?? 'source-over';
  }

  private matchesAction(triggerAction: string, action: string): boolean {
    return triggerAction.split(',').map((part) => part.trim()).includes(action);
  }

  private registerTriggerHitRegion(
    node: { triggers?: WmrTrigger[] },
    x: number,
    y: number,
    w: number,
    h: number,
    button?: WmrButton,
  ): void {
    if (!this.enableHitRegions || this.measureOnly || !w || !h) return;
    if (!node.triggers?.length && !button) return;
    const bounds = this.getTransformedBounds(x, y, w, h);
    this.hitRegions.push({ ...bounds, button, triggers: node.triggers });
  }

  private hasPressedState(region: HitRegion): boolean {
    return !!region.button?.pressedChildren?.length;
  }

  private getTransformedBounds(x: number, y: number, w: number, h: number): Pick<HitRegion, 'x' | 'y' | 'w' | 'h'> {
    const transform = this.ctx.getTransform();
    const points = [
      new DOMPoint(x, y),
      new DOMPoint(x + w, y),
      new DOMPoint(x, y + h),
      new DOMPoint(x + w, y + h),
    ].map((point) => point.matrixTransform(transform));
    const xs = points.map((point) => point.x / this.rootRenderScaleX);
    const ys = points.map((point) => point.y / this.rootRenderScaleY);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: minX,
      y: minY,
      w: Math.max(0, maxX - minX),
      h: Math.max(0, maxY - minY),
    };
  }

  private isVisible(node: WmrBaseAttrs): boolean {
    if (node.visibility === undefined) return true;
    const v = evalNum(node.visibility, this.vars);
    return v !== 0;
  }

  private getAlpha(node: WmrBaseAttrs): number {
    if (node.name && this.vars.has(`${node.name}.alpha`)) {
      return Math.max(0, Math.min(1, this.vars.getNum(`${node.name}.alpha`) / 255));
    }
    if (node.alpha === undefined) return 1;
    const a = evalNum(node.alpha, this.vars);
    return Math.max(0, Math.min(1, a / 255));
  }

  private getX(node: WmrBaseAttrs): number {
    if (node.name && this.vars.has(`${node.name}.x`)) return this.vars.getNum(`${node.name}.x`);
    let base: number;
    if (node.x !== undefined) base = evalNum(node.x, this.vars);
    else base = evalNum(node.centerX, this.vars);
    if (node.name) {
      const offset = this.vars.getElementProp(node.name, 'posAnimOffsetX');
      if (offset) base += offset;
    }
    return base;
  }
  private getY(node: WmrBaseAttrs): number {
    if (node.name && this.vars.has(`${node.name}.y`)) return this.vars.getNum(`${node.name}.y`);
    let base: number;
    if (node.y !== undefined) base = evalNum(node.y, this.vars);
    else base = evalNum(node.centerY, this.vars);
    if (node.name) {
      const offset = this.vars.getElementProp(node.name, 'posAnimOffsetY');
      if (offset) base += offset;
    }
    return base;
  }
  private getW(node: WmrBaseAttrs): number { return evalNum(node.w ?? node.width, this.vars); }
  private getH(node: WmrBaseAttrs): number { return evalNum(node.h ?? node.height, this.vars); }
  private getScaleX(node: WmrBaseAttrs): number {
    if (node.name && this.vars.has(`${node.name}.scaleX`)) return this.vars.getNum(`${node.name}.scaleX`);
    if (node.scaleX !== undefined) return evalNum(node.scaleX, this.vars);
    if (node.scale !== undefined) return evalNum(node.scale, this.vars);
    return 1;
  }
  private getScaleY(node: WmrBaseAttrs): number {
    if (node.name && this.vars.has(`${node.name}.scaleY`)) return this.vars.getNum(`${node.name}.scaleY`);
    if (node.scaleY !== undefined) return evalNum(node.scaleY, this.vars);
    if (node.scale !== undefined) return evalNum(node.scale, this.vars);
    return 1;
  }

  private getRotation(node: WmrBaseAttrs): number {
    if (node.name && this.vars.has(`${node.name}.rotation`)) return this.vars.getNum(`${node.name}.rotation`);
    return node.rotation ? evalNum(node.rotation, this.vars) : 0;
  }

  private usesCenterXAlignment(node: WmrBaseAttrs): boolean {
    return node.x === undefined && node.centerX !== undefined;
  }

  private usesCenterYAlignment(node: WmrBaseAttrs): boolean {
    return node.y === undefined && node.centerY !== undefined;
  }

  private getPivotX(node: WmrBaseAttrs): number {
    if (node.pivotX !== undefined) return evalNum(node.pivotX, this.vars);
    if (node.x !== undefined && node.centerX !== undefined) return evalNum(node.centerX, this.vars);
    return 0;
  }

  private getPivotY(node: WmrBaseAttrs): number {
    if (node.pivotY !== undefined) return evalNum(node.pivotY, this.vars);
    if (node.y !== undefined && node.centerY !== undefined) return evalNum(node.centerY, this.vars);
    return 0;
  }

  private applyAlign(node: WmrBaseAttrs, x: number, w: number): number {
    const align = node.align ?? (this.usesCenterXAlignment(node) ? 'center' : undefined);
    if (align === 'center') return x - w / 2;
    if (align === 'right') return x - w;
    return x;
  }

  private applyAlignV(node: WmrBaseAttrs, y: number, h: number): number {
    const alignV = node.alignV ?? (this.usesCenterYAlignment(node) ? 'center' : undefined);
    if (alignV === 'center') return y - h / 2;
    if (alignV === 'bottom') return y - h;
    return y;
  }

  private getTextAlign(node: WmrBaseAttrs): CanvasTextAlign {
    const align = node.align ?? (this.usesCenterXAlignment(node) ? 'center' : undefined);
    if (align === 'center') return 'center';
    if (align === 'right') return 'right';
    return 'left';
  }

  private getTextBaseline(node: WmrBaseAttrs): CanvasTextBaseline {
    const alignV = node.alignV ?? (this.usesCenterYAlignment(node) ? 'center' : undefined);
    if (alignV === 'center') return 'middle';
    if (alignV === 'bottom') return 'bottom';
    return 'top';
  }

  private getTextHeight(metrics: TextMetrics, fallback: number): number {
    const ascent = metrics.actualBoundingBoxAscent ?? 0;
    const descent = metrics.actualBoundingBoxDescent ?? 0;
    const measured = ascent + descent;
    return measured > 0 ? measured : fallback;
  }

  private getTextClipPadding(size: number): number {
    // 真机字体和浏览器字体度量会有少量差异，给文本裁切留一点余量，
    // 避免像“路”这类末字被吃掉半个像素。
    return Math.max(2, size * 0.12);
  }

  private getTextBlockTop(node: WmrBaseAttrs, y: number, blockHeight: number): number {
    const baseline = this.getTextBaseline(node);
    if (baseline === 'middle') return y - blockHeight / 2;
    if (baseline === 'bottom') return y - blockHeight;
    return y;
  }

  private clipTextBlock(
    x: number,
    topY: number,
    maxWidth: number,
    blockHeight: number,
    align: CanvasTextAlign,
    padding: number,
  ): void {
    const c = this.ctx;
    const clipX = align === 'center'
      ? x - maxWidth / 2 - padding
      : align === 'right'
        ? x - maxWidth - padding
        : x - padding;
    const clipY = topY - padding;
    c.beginPath();
    c.rect(clipX, clipY, maxWidth + padding * 2, blockHeight + padding * 2);
    c.clip();
  }

  private getMarqueeOffset(enabled: boolean, measuredWidth: number, gap: number, speed: number): number {
    if (!enabled || measuredWidth <= 0 || speed <= 0) return 0;
    const distance = measuredWidth + gap;
    return (TimeService.now() / 1000 * speed) % distance;
  }

  private getCachedTextLayout(cacheNode: object, key: string, factory: () => Omit<CachedTextLayout, 'key'>): CachedTextLayout {
    const cached = this.textLayoutCache.get(cacheNode);
    if (cached?.key === key) return cached;
    const next = { key, ...factory() };
    this.textLayoutCache.set(cacheNode, next);
    return next;
  }

  private wrapText(text: string, maxWidth: number): string[] {
    if (!text) return [''];
    const lines: string[] = [];
    for (const rawLine of text.split('\n')) {
      if (maxWidth <= 0) {
        lines.push(rawLine);
        continue;
      }
      let current = '';
      const tokens = rawLine.includes(' ') ? rawLine.split(/(\s+)/).filter(Boolean) : Array.from(rawLine);
      for (const token of tokens) {
        const next = current ? `${current}${token}` : token;
        if (this.ctx.measureText(next).width <= maxWidth || !current) {
          current = next;
          continue;
        }
        lines.push(current.trimEnd());
        current = token.trimStart();
      }
      lines.push(current || '');
    }
    return lines.length > 0 ? lines : [''];
  }

  private renderGroup(node: WmrGroup): void {
    if (!this.isVisible(node)) return;

    if (node.layered) {
      if (this.measureOnly) {
        this.renderNodes(node.children);
      } else {
        this.renderLayeredGroup(node);
      }
      return;
    }

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    const w = this.getW(node);
    const h = this.getH(node);
    let x = this.getX(node);
    let y = this.getY(node);
    x = this.applyAlign(node, x, w);
    y = this.applyAlignV(node, y, h);
    if (x || y) c.translate(x, y);

    const pivotX = this.getPivotX(node);
    const pivotY = this.getPivotY(node);
    if (pivotX || pivotY) c.translate(pivotX, pivotY);
    const sx = this.getScaleX(node);
    const sy = this.getScaleY(node);
    if (sx !== 1 || sy !== 1) c.scale(sx, sy);

    const rot = this.getRotation(node);
    if (rot) c.rotate(rot * Math.PI / 180);
    if (pivotX || pivotY) c.translate(-pivotX, -pivotY);

    if (node.clip) {
      const w = this.getW(node);
      const h = this.getH(node);
      if (w && h) {
        c.beginPath();
        c.rect(0, 0, w, h);
        c.clip();
      }
    }

    this.renderNodes(node.children);
    c.restore();
  }

  private renderLayeredGroup(node: WmrGroup): void {
    const w = node.w ? this.getW(node) : this.designWidth;
    const h = node.h ? this.getH(node) : this.designHeight;
    if (!w || !h) return;

    const dpr = window.devicePixelRatio || 1;
    const offscreen = acquireCanvas(w * dpr, h * dpr);
    const oc = offscreen.getContext('2d');
    if (!oc) { releaseCanvas(offscreen); return; }
    oc.save();
    oc.scale(dpr, dpr);

    const prevCtx = this.ctx;
    const prevScale = this.scale;
    const prevRootScaleX = this.rootRenderScaleX;
    const prevRootScaleY = this.rootRenderScaleY;
    this.ctx = oc;
    this.scale = 1;
    this.rootRenderScaleX = dpr;
    this.rootRenderScaleY = dpr;
    this.renderNodes(node.children);
    this.ctx = prevCtx;
    this.scale = prevScale;
    this.rootRenderScaleX = prevRootScaleX;
    this.rootRenderScaleY = prevRootScaleY;
    oc.restore();

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;
    let x = this.getX(node);
    let y = this.getY(node);
    x = this.applyAlign(node, x, w);
    y = this.applyAlignV(node, y, h);
    c.drawImage(offscreen, x, y, w, h);
    c.restore();
    releaseCanvas(offscreen);
  }

  private renderImage(node: WmrImage): void {
    if (!this.isVisible(node)) return;
    const resolvedSrc = this.resolveImageSource(node);
    if (!resolvedSrc) return;
    const url = this.resolveAssetUrl(resolvedSrc);
    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    this.applyCompositeMode(node);

    let w = (node.w ?? node.width) ? evalNum(node.w ?? node.width, this.vars) : 0;
    let h = (node.h ?? node.height) ? evalNum(node.h ?? node.height, this.vars) : 0;

    if (node.srcid) {
      const frameIdx = Math.floor(toNum(evalExprStr(node.srcid, this.vars)));
      let indexedImage = this.getIndexedImage(resolvedSrc, frameIdx);
      if (!indexedImage) {
        const fallback = this.lastResolvedImageByNode.get(node);
        if (fallback) {
          indexedImage = this.getIndexedImage(fallback.src, fallback.frameIndex ?? frameIdx);
        }
      }
      if (!indexedImage) {
        c.restore();
        return;
      }
      if (!w) w = indexedImage.width;
      if (!h) h = indexedImage.height;

      let dx = this.getX(node);
      let dy = this.getY(node);
      dx = this.applyAlign(node, dx, w);
      dy = this.applyAlignV(node, dy, h);

      const pivotX = this.getPivotX(node);
      const pivotY = this.getPivotY(node);
      const sx = this.getScaleX(node);
      const sy = this.getScaleY(node);
      const rotation = this.getRotation(node);
      if (!this.measureOnly && (pivotX || pivotY || sx !== 1 || sy !== 1 || rotation !== 0)) {
        c.translate(dx + pivotX, dy + pivotY);
        if (sx !== 1 || sy !== 1) c.scale(sx, sy);
        if (rotation !== 0) c.rotate(rotation * Math.PI / 180);
        c.translate(-(dx + pivotX), -(dy + pivotY));
      }

      if (!this.measureOnly) {
        const tint = node.tint ? this.evalColor(node.tint) : undefined;
        if (indexedImage.kind === 'sheet') {
          if (tint) this.drawTintedSprite(c, indexedImage.img, indexedImage.frameIndex, dx, dy, w, h, tint);
          else drawSpriteFrame(c, indexedImage.img, indexedImage.frameIndex, dx, dy, w, h);
        } else {
          if (tint) this.drawTintedImage(c, indexedImage.img, dx, dy, w, h, tint);
          else c.drawImage(indexedImage.img, dx, dy, w, h);
        }
        this.lastResolvedImageByNode.set(node, { src: resolvedSrc, frameIndex: indexedImage.frameIndex });
      }

      if (node.name) {
        this.vars.setElementProp(node.name, 'bmp_width', w);
        this.vars.setElementProp(node.name, 'bmp_height', h);
      }
    } else {
      const img = getImage(url);
      let resolvedImg = img;
      let resolvedImgSrc = resolvedSrc;
      if ((!resolvedImg || !resolvedImg.naturalWidth) && this.lastResolvedImageByNode.has(node)) {
        const fallback = this.lastResolvedImageByNode.get(node)!;
        resolvedImg = getImage(this.resolveAssetUrl(fallback.src));
        resolvedImgSrc = fallback.src;
      }
      if (!resolvedImg || !resolvedImg.naturalWidth) {
        if (!isImageLoadFailed(url)) loadImage(url);
        c.restore();
        return;
      }
      if (!w) w = resolvedImg.naturalWidth;
      if (!h) h = resolvedImg.naturalHeight;

      let dx = this.getX(node);
      let dy = this.getY(node);
      dx = this.applyAlign(node, dx, w);
      dy = this.applyAlignV(node, dy, h);

      const pivotX = this.getPivotX(node);
      const pivotY = this.getPivotY(node);
      const sx = this.getScaleX(node);
      const sy = this.getScaleY(node);
      const rotation = this.getRotation(node);
      if (!this.measureOnly && (pivotX || pivotY || sx !== 1 || sy !== 1 || rotation !== 0)) {
        c.translate(dx + pivotX, dy + pivotY);
        if (sx !== 1 || sy !== 1) c.scale(sx, sy);
        if (rotation !== 0) c.rotate(rotation * Math.PI / 180);
        c.translate(-(dx + pivotX), -(dy + pivotY));
      }

      if (!this.measureOnly) {
        const tint = node.tint ? this.evalColor(node.tint) : undefined;
        if (this.isNinePatch(resolvedImgSrc)) this.drawNinePatch(c, resolvedImg, dx, dy, w, h, tint);
        else if (tint) this.drawTintedImage(c, resolvedImg, dx, dy, w, h, tint);
        else c.drawImage(resolvedImg, dx, dy, w, h);
        if (img?.naturalWidth) {
          this.lastResolvedImageByNode.set(node, { src: resolvedSrc });
        }
      }

      if (node.name) {
        this.vars.setElementProp(node.name, 'bmp_width', w);
        this.vars.setElementProp(node.name, 'bmp_height', h);
      }
    }

    c.restore();
  }

  private resolveImageSource(node: WmrImage): string {
    if (node.srcExp) return String(evalExprStr(node.srcExp, this.vars));
    if (!node.src) return '';
    if (node.src.startsWith('@') || node.src.startsWith('#')) {
      return String(evalExprStr(node.src, this.vars));
    }
    return node.src;
  }

  private getIndexedImage(src: string, frameIndex: number): {
    kind: 'sheet';
    img: HTMLImageElement;
    frameIndex: number;
    width: number;
    height: number;
  } | {
    kind: 'variant';
    img: HTMLImageElement;
    frameIndex: number;
    width: number;
    height: number;
  } | null {
    const clampedIndex = Math.max(0, Math.floor(frameIndex));
    const directUrl = this.resolveAssetUrl(src);
    const direct = getImage(directUrl);
    if (direct && direct.naturalWidth) {
      const iw = direct.naturalWidth;
      const ih = direct.naturalHeight;
      const frameCount = Math.max(1, Math.round(ih / iw));
      const frameH = ih / frameCount;
      return {
        kind: 'sheet',
        img: direct,
        frameIndex: Math.max(0, Math.min(clampedIndex, frameCount - 1)),
        width: iw,
        height: frameH,
      };
    }

    if (!isImageLoadFailed(directUrl)) loadImage(directUrl);
    const variantSrc = this.getIndexedVariantSrc(src, clampedIndex);
    const variantUrl = this.resolveAssetUrl(variantSrc);
    const variant = getImage(variantUrl);
    if (variant && variant.naturalWidth) {
      return {
        kind: 'variant',
        img: variant,
        frameIndex: clampedIndex,
        width: variant.naturalWidth,
        height: variant.naturalHeight,
      };
    }

    if (!isImageLoadFailed(variantUrl)) loadImage(variantUrl);
    return null;
  }

  private getIndexedVariantSrc(src: string, frameIndex: number): string {
    const dot = src.lastIndexOf('.');
    const stem = dot >= 0 ? src.slice(0, dot) : src;
    const ext = dot >= 0 ? src.slice(dot) : '';
    return `${stem}_${frameIndex}${ext}`;
  }

  private renderText(node: WmrText): void {
    if (!this.isVisible(node)) return;

    let text: string;
    if (node.textExp) text = String(evalExprStr(node.textExp, this.vars));
    else if (node.text && (node.text.startsWith('@') || node.text.startsWith('#'))) text = String(evalExprStr(node.text, this.vars));
    else if (node.format && node.paras) text = this.formatText(node.format, node.paras);
    else if (node.text) text = node.text;
    else return;
    if (!text) return;

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    const size = evalNum(node.size, this.vars) || 40;
    const font = mapFont(node.fontFamily);
    const bold = node.bold ? 'bold ' : '';
    c.font = `${bold}${size}px ${font}`;
    c.fillStyle = this.evalColor(node.color);

    const x = this.getX(node);
    const y = this.getY(node);
    const textWidth = this.getW(node);
    const layout = this.getCachedTextLayout(
      node,
      `${text}\u0000${c.font}\u0000${textWidth}\u0000${node.multiLine ? 1 : 0}`,
      () => {
        const lines = node.multiLine && textWidth > 0 ? this.wrapText(text, textWidth) : [text];
        const metrics = lines.map((line) => c.measureText(line));
        const measuredWidth = metrics.reduce((max, metric) => Math.max(max, metric.width), 0);
        const lineHeight = Math.max(size * 1.1, ...metrics.map((metric) => this.getTextHeight(metric, size)));
        return {
          lines,
          metrics,
          measuredWidth,
          lineHeight,
          blockHeight: lineHeight * lines.length,
        };
      },
    );
    const { lines, metrics, measuredWidth, lineHeight, blockHeight } = layout;

    c.textAlign = this.getTextAlign(node);
    c.textBaseline = lines.length > 1 ? 'top' : this.getTextBaseline(node);

    let drawY = y;
    if (lines.length > 1) {
      const baseline = this.getTextBaseline(node);
      if (baseline === 'middle') drawY = y - blockHeight / 2;
      else if (baseline === 'bottom') drawY = y - blockHeight;
    }
    const blockTop = lines.length > 1 ? drawY : this.getTextBlockTop(node, y, blockHeight);

    if (!this.measureOnly && textWidth > 0) {
      const clipPadding = this.getTextClipPadding(size);
      this.clipTextBlock(x, blockTop, textWidth, blockHeight, c.textAlign, clipPadding);
    }

    if (!this.measureOnly) {
      const marqueeSpeed = node.marqueeSpeed ? Math.max(0, evalNum(node.marqueeSpeed, this.vars)) : 0;
      const canMarquee = lines.length === 1
        && textWidth > 0
        && c.textAlign === 'left'
        && measuredWidth > textWidth
        && marqueeSpeed > 0;
      const marqueeGap = Math.max(size, 24);
      const marqueeOffset = this.getMarqueeOffset(canMarquee, measuredWidth, marqueeGap, marqueeSpeed);
      for (let i = 0; i < lines.length; i++) {
        const lineY = drawY + i * lineHeight;
        if (canMarquee && i === 0) {
          c.fillText(lines[i], x - marqueeOffset, lineY);
          c.fillText(lines[i], x - marqueeOffset + measuredWidth + marqueeGap, lineY);
        } else {
          c.fillText(lines[i], x, lineY);
        }
      }
    }

    if (node.name) {
      this.vars.setElementProp(node.name, 'text_width', measuredWidth);
      this.vars.setElementProp(node.name, 'text_height', blockHeight);
    }

    c.restore();
  }

  private renderDateTime(node: WmrDateTime): void {
    if (!this.isVisible(node)) return;

    const fmt = node.formatExp ? String(evalExprStr(node.formatExp, this.vars)) : (node.format ?? 'HH:mm');
    const date = node.value ? TimeService.fromTimestamp(evalNum(node.value, this.vars)) : TimeService.getDate();
    const text = formatDateTime(fmt, date);

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    const size = evalNum(node.size, this.vars) || 40;
    const font = mapFont(node.fontFamily);
    const dtBold = node.bold ? 'bold ' : '';
    c.font = `${dtBold}${size}px ${font}`;
    c.fillStyle = this.evalColor(node.color);

    const x = this.getX(node);
    const y = this.getY(node);
    const layout = this.getCachedTextLayout(
      node,
      `${text}\u0000${c.font}`,
      () => {
        const metrics = c.measureText(text);
        const textHeight = this.getTextHeight(metrics, size);
        return {
          lines: [text],
          metrics: [metrics],
          measuredWidth: metrics.width,
          lineHeight: textHeight,
          blockHeight: textHeight,
        };
      },
    );
    const metrics = layout.metrics[0];
    const textHeight = layout.blockHeight;
    const blockTop = this.getTextBlockTop(node, y, textHeight);

    c.textAlign = this.getTextAlign(node);
    c.textBaseline = this.getTextBaseline(node);

    const textWidth = this.getW(node);
    if (!this.measureOnly && textWidth > 0) {
      const clipPadding = this.getTextClipPadding(size);
      this.clipTextBlock(x, blockTop, textWidth, textHeight, c.textAlign, clipPadding);
    }

    if (!this.measureOnly) c.fillText(text, x, y);

    if (node.name) {
      this.vars.setElementProp(node.name, 'text_width', layout.measuredWidth);
      this.vars.setElementProp(node.name, 'text_height', textHeight);
    }

    c.restore();
  }

  private renderRectangle(node: WmrRectangle): void {
    if (!this.isVisible(node)) return;

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    const w = this.getW(node);
    const h = this.getH(node);
    if (!w || !h) {
      c.restore();
      return;
    }

    let x = this.getX(node);
    let y = this.getY(node);
    x = this.applyAlign(node, x, w);
    y = this.applyAlignV(node, y, h);

    let radii: number | number[] = 0;
    if (node.cornerRadius) {
      const parts = node.cornerRadius.split(',').map((s) => evalNum(s.trim(), this.vars));
      radii = parts.length > 1 ? parts : (parts[0] || 0);
    }

    this.applyCompositeMode(node);

    c.beginPath();
    if ((typeof radii === 'number' ? radii : Math.max(...radii)) > 0) c.roundRect(x, y, w, h, radii);
    else c.rect(x, y, w, h);

    if (!this.measureOnly) {
      const fillStyle = this.getRectangleFillStyle(node);
      if (fillStyle) {
        c.fillStyle = fillStyle;
        c.fill();
      }
      if (node.strokeColor) {
        c.strokeStyle = this.evalColor(node.strokeColor);
        const lineWidth = evalNum(node.strokeWidth ?? node.weight, this.vars) || 1;
        c.lineWidth = lineWidth;
        if (node.strokeAlign === 'inner') {
          const inset = lineWidth / 2;
          const strokeX = x + inset;
          const strokeY = y + inset;
          const strokeW = Math.max(0, w - lineWidth);
          const strokeH = Math.max(0, h - lineWidth);
          const strokeRadii = typeof radii === 'number'
            ? Math.max(0, radii - inset)
            : radii.map((radius) => Math.max(0, radius - inset));
          c.beginPath();
          if ((typeof strokeRadii === 'number' ? strokeRadii : Math.max(...strokeRadii)) > 0) {
            c.roundRect(strokeX, strokeY, strokeW, strokeH, strokeRadii);
          } else {
            c.rect(strokeX, strokeY, strokeW, strokeH);
          }
        }
        c.stroke();
      }
    }

    this.registerTriggerHitRegion(node, x, y, w, h);
    c.restore();
  }

  private getRectangleFillStyle(node: WmrRectangle): string | CanvasGradient | null {
    if (node.fillShader?.type === 'linearGradient') {
      const gradient = this.ctx.createLinearGradient(
        evalNum(node.fillShader.x, this.vars),
        evalNum(node.fillShader.y, this.vars),
        evalNum(node.fillShader.x1, this.vars),
        evalNum(node.fillShader.y1, this.vars),
      );
      for (const stop of node.fillShader.stops) {
        const position = Math.max(0, Math.min(1, evalNum(stop.position, this.vars)));
        gradient.addColorStop(position, this.evalColor(stop.color));
      }
      return gradient;
    }
    if (node.fillColor) {
      return this.evalColor(node.fillColor);
    }
    return null;
  }

  private renderArc(node: WmrArc): void {
    if (!this.isVisible(node)) return;

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    const w = this.getW(node);
    const h = this.getH(node);
    if (!w || !h) {
      c.restore();
      return;
    }

    let cx = this.getX(node);
    let cy = this.getY(node);
    cx = this.applyAlign(node, cx, w) + w / 2;
    cy = this.applyAlignV(node, cy, h) + h / 2;

    const startAngle = (evalNum(node.startAngle, this.vars) || 0) * Math.PI / 180;
    const sweep = (evalNum(node.sweep, this.vars) || 360) * Math.PI / 180;
    const weight = evalNum(node.weight, this.vars) || 2;
    const strokeInset = node.strokeAlign === 'inner' ? weight / 2 : 0;
    const rx = Math.max(0, w / 2 - strokeInset);
    const ry = Math.max(0, h / 2 - strokeInset);
    this.applyCompositeMode(node);

    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, startAngle, startAngle + sweep);

    if (!this.measureOnly) {
      if (node.fillColor) {
        c.fillStyle = this.evalColor(node.fillColor);
        c.fill();
      }
      if (node.strokeColor) {
        c.strokeStyle = this.evalColor(node.strokeColor);
        c.lineWidth = weight;
        if (node.cap === 'round') c.lineCap = 'round';
        else if (node.cap && node.cap.toLowerCase().startsWith('squ')) c.lineCap = 'square';
        c.stroke();
      }
    }

    c.restore();
  }

  private renderCircle(node: WmrCircle): void {
    if (!this.isVisible(node)) return;

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    const radius = evalNum(node.r, this.vars);
    if (!radius) {
      c.restore();
      return;
    }
    const cx = this.getX(node);
    const cy = this.getY(node);
    this.applyCompositeMode(node);

    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    if (!this.measureOnly && node.fillColor) {
      c.fillStyle = this.evalColor(node.fillColor);
      c.fill();
    }
    if (!this.measureOnly && node.strokeColor) {
      c.strokeStyle = this.evalColor(node.strokeColor);
      c.lineWidth = evalNum(node.weight, this.vars) || 1;
      c.stroke();
    }
    c.restore();
  }

  private renderLine(node: WmrLine): void {
    if (!this.isVisible(node)) return;

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    const x = this.getX(node);
    const y = this.getY(node);
    const x1 = evalNum(node.x1, this.vars);
    const y1 = evalNum(node.y1, this.vars);
    const weight = evalNum(node.weight, this.vars) || 1;

    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x1, y1);
    c.strokeStyle = this.evalColor(node.strokeColor);
    c.lineWidth = weight;
    if (node.cap === 'round') c.lineCap = 'round';
    if (!this.measureOnly) c.stroke();
    c.restore();
  }

  private renderButton(node: WmrButton): void {
    if (!this.isVisible(node)) return;

    const w = this.getW(node);
    const h = this.getH(node);
    let x = this.getX(node);
    let y = this.getY(node);
    x = this.applyAlign(node, x, w);
    y = this.applyAlignV(node, y, h);

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    if (x || y) c.translate(x, y);
    const pivotX = this.getPivotX(node);
    const pivotY = this.getPivotY(node);
    if (pivotX || pivotY) c.translate(pivotX, pivotY);
    const sx = this.getScaleX(node);
    const sy = this.getScaleY(node);
    if (sx !== 1 || sy !== 1) c.scale(sx, sy);

    const rotation = this.getRotation(node);
    if (rotation) c.rotate(rotation * Math.PI / 180);
    if (pivotX || pivotY) c.translate(-pivotX, -pivotY);

    this.registerTriggerHitRegion(node, 0, 0, w, h, node);
    const visualChildren = this.activeButton === node && node.pressedChildren && node.pressedChildren.length > 0
      ? node.pressedChildren
      : (node.normalChildren && node.normalChildren.length > 0 ? node.normalChildren : node.children);
    this.renderNodes(visualChildren);
    c.restore();
  }

  private renderImageNumber(node: WmrImageNumber): void {
    if (!this.isVisible(node) || !node.src || !node.textExp) return;

    const text = String(evalExprStr(node.textExp, this.vars));
    const url = this.resolveAssetUrl(node.src);
    const img = getImage(url);
    if (!img || !img.naturalWidth) return;

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const frameCount = Math.max(1, Math.round(ih / iw));
    const frameH = ih / frameCount;
    const charW = node.w ? evalNum(node.w, this.vars) / Math.max(1, text.length) : iw;
    const charH = node.h ? evalNum(node.h, this.vars) : frameH;
    let x = this.getX(node);
    const y = this.getY(node);

    for (const ch of text) {
      let idx: number;
      if (ch >= '0' && ch <= '9') idx = parseInt(ch, 10);
      else if (ch === ':' || ch === '.') idx = 10;
      else if (ch === '-') idx = 11;
      else {
        x += charW;
        continue;
      }
      if (!this.measureOnly) drawSpriteFrame(c, img, idx, x, y, charW, charH);
      x += charW;
    }

    c.restore();
  }

  private renderTime(node: WmrTime): void {
    if (!this.isVisible(node)) return;

    const srcPath = node.srcExp ? String(evalExprStr(node.srcExp, this.vars)) : node.src;
    if (!srcPath) return;

    const dotIdx = srcPath.lastIndexOf('.');
    const stem = dotIdx >= 0 ? srcPath.slice(0, dotIdx) : srcPath;
    const ext = dotIdx >= 0 ? srcPath.slice(dotIdx) : '.png';
    const fmt = node.formatExp ? String(evalExprStr(node.formatExp, this.vars)) : (node.format ?? 'HH:mm');
    const text = formatDateTime(fmt, TimeService.getDate());

    const c = this.ctx;
    c.save();
    const alpha = this.getAlpha(node);
    if (alpha < 1) c.globalAlpha *= alpha;

    const space = evalNum(node.space, this.vars) || 0;
    let totalW = 0;
    let maxH = 0;
    const charImgs: (HTMLImageElement | null)[] = [];

    for (const ch of text) {
      let suffix: string;
      if (ch >= '0' && ch <= '9') suffix = `_${ch}`;
      else if (ch === ':' || ch === '.') suffix = '_dot';
      else {
        charImgs.push(null);
        continue;
      }
      const url = this.resolveAssetUrl(stem + suffix + ext);
      const img = getImage(url);
      if (!img || !img.naturalWidth) {
        if (!isImageLoadFailed(url)) loadImage(url);
        charImgs.push(null);
        continue;
      }
      charImgs.push(img);
      totalW += img.naturalWidth + space;
      maxH = Math.max(maxH, img.naturalHeight);
    }
    if (totalW > 0) totalW -= space;

    let x = this.getX(node);
    const y = this.getY(node);
    if (node.align === 'center') x -= totalW / 2;
    else if (node.align === 'right') x -= totalW;

    let idx = 0;
    for (const ch of text) {
      if (!'0123456789:.'.includes(ch)) {
        idx++;
        continue;
      }
      const img = charImgs[idx];
      idx++;
      if (!img || !img.naturalWidth) continue;
      let dy = y;
      if (node.alignV === 'center') dy -= img.naturalHeight / 2;
      else if (node.alignV === 'bottom') dy -= img.naturalHeight;
      if (!this.measureOnly) c.drawImage(img, x, dy, img.naturalWidth, img.naturalHeight);
      x += img.naturalWidth + space;
    }

    if (node.name) {
      this.vars.setElementProp(node.name, 'bmp_width', totalW);
      this.vars.setElementProp(node.name, 'bmp_height', maxH);
    }

    c.restore();
  }

  private renderMask(node: WmrMask): void {
    if (!this.isVisible(node)) return;
    this.renderNodes(node.children);
  }

  private renderArray(node: WmrArray): void {
    if (!this.isVisible(node)) return;
    const count = evalNum(node.count, this.vars) || 0;
    const indexName = node.indexName ?? '__index';
    for (let i = 0; i < count; i++) {
      this.vars.set(indexName, i);
      this.renderNodes(node.children);
    }
  }

  private renderMusicControl(node: WmrMusicControl): void {
    this.renderNodes(node.children);
  }

  private formatText(fmt: string, paras: string): string {
    const args = paras.split(',').map((part) => evalExpr(compileExpr(part.trim()), this.vars));
    let argIndex = 0;
    return fmt.replace(/%0?(\d*)d/g, (_match, widthText: string) => {
      const value = Math.floor(toNum(args[argIndex++] ?? 0));
      const width = widthText ? parseInt(widthText, 10) : 0;
      return width > 0 ? String(value).padStart(width, '0') : String(value);
    });
  }

  private drawTintedImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    tint: string,
  ): void {
    const offscreen = acquireCanvas(w, h);
    const oc = offscreen.getContext('2d');
    if (!oc) {
      ctx.drawImage(img, x, y, w, h);
      releaseCanvas(offscreen);
      return;
    }
    oc.drawImage(img, 0, 0, w, h);
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = parseColor(tint);
    oc.fillRect(0, 0, w, h);
    ctx.drawImage(offscreen, x, y, w, h);
    releaseCanvas(offscreen);
  }

  private isNinePatch(src: string | undefined): boolean {
    return !!src && src.endsWith('.9.png');
  }

  private drawNinePatch(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    tint?: string,
  ): void {
    const inset = this.getNinePatchInsets(img);
    const sourceW = img.naturalWidth;
    const sourceH = img.naturalHeight;
    const left = Math.min(inset.left, sourceW / 2);
    const right = Math.min(inset.right, sourceW / 2);
    const top = Math.min(inset.top, sourceH / 2);
    const bottom = Math.min(inset.bottom, sourceH / 2);
    const centerSrcW = Math.max(1, sourceW - left - right);
    const centerSrcH = Math.max(1, sourceH - top - bottom);

    const scale = Math.min(
      1,
      w / Math.max(1, left + right),
      h / Math.max(1, top + bottom),
    );
    const drawLeft = left * scale;
    const drawRight = right * scale;
    const drawTop = top * scale;
    const drawBottom = bottom * scale;
    const x0 = this.snapToDevicePixel(x);
    const x1 = this.snapToDevicePixel(x + drawLeft);
    const x2 = this.snapToDevicePixel(x + w - drawRight);
    const x3 = this.snapToDevicePixel(x + w);
    const y0 = this.snapToDevicePixel(y);
    const y1 = this.snapToDevicePixel(y + drawTop);
    const y2 = this.snapToDevicePixel(y + h - drawBottom);
    const y3 = this.snapToDevicePixel(y + h);
    const centerDstW = Math.max(0, x2 - x1);
    const centerDstH = Math.max(0, y2 - y1);
    const dstLeft = Math.max(0, x1 - x0);
    const dstRight = Math.max(0, x3 - x2);
    const dstTop = Math.max(0, y1 - y0);
    const dstBottom = Math.max(0, y3 - y2);
    const seam = this.devicePixelSize();

    const target = tint
      ? this.createTintedCanvas(img, sourceW, sourceH, tint)
      : img;

    const drawPatch = (
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ) => {
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
      ctx.drawImage(target, sx, sy, sw, sh, dx, dy, dw, dh);
    };

    const overlapPatch = (
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
      expandLeft: boolean,
      expandTop: boolean,
      expandRight: boolean,
      expandBottom: boolean,
    ) => {
      const extraL = expandLeft ? seam : 0;
      const extraT = expandTop ? seam : 0;
      const extraR = expandRight ? seam : 0;
      const extraB = expandBottom ? seam : 0;
      drawPatch(
        sx,
        sy,
        sw,
        sh,
        dx - extraL,
        dy - extraT,
        dw + extraL + extraR,
        dh + extraT + extraB,
      );
    };

    overlapPatch(0, 0, left, top, x0, y0, dstLeft, dstTop, false, false, true, true);
    overlapPatch(left, 0, centerSrcW, top, x1, y0, centerDstW, dstTop, true, false, true, true);
    overlapPatch(sourceW - right, 0, right, top, x2, y0, dstRight, dstTop, true, false, false, true);

    overlapPatch(0, top, left, centerSrcH, x0, y1, dstLeft, centerDstH, false, true, true, true);
    overlapPatch(left, top, centerSrcW, centerSrcH, x1, y1, centerDstW, centerDstH, true, true, true, true);
    overlapPatch(sourceW - right, top, right, centerSrcH, x2, y1, dstRight, centerDstH, true, true, false, true);

    overlapPatch(0, sourceH - bottom, left, bottom, x0, y2, dstLeft, dstBottom, false, true, true, false);
    overlapPatch(left, sourceH - bottom, centerSrcW, bottom, x1, y2, centerDstW, dstBottom, true, true, true, false);
    overlapPatch(sourceW - right, sourceH - bottom, right, bottom, x2, y2, dstRight, dstBottom, true, true, false, false);

    if (tint && target instanceof HTMLCanvasElement) releaseCanvas(target);
  }

  private createTintedCanvas(
    img: HTMLImageElement,
    w: number,
    h: number,
    tint: string,
  ): HTMLCanvasElement {
    const offscreen = acquireCanvas(w, h);
    const oc = offscreen.getContext('2d');
    if (!oc) return offscreen;
    oc.drawImage(img, 0, 0, w, h);
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = parseColor(tint);
    oc.fillRect(0, 0, w, h);
    return offscreen;
  }

  private getNinePatchInsets(img: HTMLImageElement): NinePatchInsets {
    const cached = ninePatchInsetCache.get(img);
    if (cached) return cached;

    const probe = document.createElement('canvas');
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    probe.width = w;
    probe.height = h;
    const ctx = probe.getContext('2d');
    if (!ctx) {
      const fallback = { left: Math.round(w * 0.3), right: Math.round(w * 0.3), top: Math.round(h * 0.3), bottom: Math.round(h * 0.3) };
      ninePatchInsetCache.set(img, fallback);
      return fallback;
    }

    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const alphaAt = (x: number, y: number) => data[(y * w + x) * 4 + 3];

    const fullOpaqueRow = (() => {
      for (let y = 0; y < h; y++) {
        let allOpaque = true;
        for (let x = 0; x < w; x++) {
          if (alphaAt(x, y) === 0) {
            allOpaque = false;
            break;
          }
        }
        if (allOpaque) return y;
      }
      return Math.round(h * 0.3);
    })();

    const fullOpaqueCol = (() => {
      for (let x = 0; x < w; x++) {
        let allOpaque = true;
        for (let y = 0; y < h; y++) {
          if (alphaAt(x, y) === 0) {
            allOpaque = false;
            break;
          }
        }
        if (allOpaque) return x;
      }
      return Math.round(w * 0.3);
    })();

    const inset = {
      left: fullOpaqueCol,
      right: Math.max(1, w - fullOpaqueCol - 1),
      top: fullOpaqueRow,
      bottom: Math.max(1, h - fullOpaqueRow - 1),
    };
    ninePatchInsetCache.set(img, inset);
    return inset;
  }

  private snapToDevicePixel(value: number): number {
    const pixelRatio = (window.devicePixelRatio || 1) * this.scale;
    if (!pixelRatio) return value;
    return Math.round(value * pixelRatio) / pixelRatio;
  }

  private devicePixelSize(): number {
    const pixelRatio = (window.devicePixelRatio || 1) * this.scale;
    if (!pixelRatio) return 1;
    return 1 / pixelRatio;
  }

  private drawTintedSprite(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    frameIndex: number,
    x: number,
    y: number,
    w: number,
    h: number,
    tint: string,
  ): void {
    const offscreen = acquireCanvas(w, h);
    const oc = offscreen.getContext('2d');
    if (!oc) {
      drawSpriteFrame(ctx, img, frameIndex, x, y, w, h);
      releaseCanvas(offscreen);
      return;
    }
    drawSpriteFrame(oc, img, frameIndex, 0, 0, w, h);
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = parseColor(tint);
    oc.fillRect(0, 0, w, h);
    ctx.drawImage(offscreen, x, y, w, h);
    releaseCanvas(offscreen);
  }

  private findHitRegion(x: number, y: number): HitRegion | null {
    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const region = this.hitRegions[i];
      if (this.isPointInsideRegion(region, x, y)) return region;
    }
    return null;
  }

  private isPointInsideRegion(region: HitRegion, x: number, y: number): boolean {
    return x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h;
  }

  private triggerRegion(region: HitRegion, action: 'down' | 'move' | 'up' | 'cancel' | 'double'): boolean {
    let handled = false;
    for (const trigger of region.triggers ?? []) {
      if (!this.matchesAction(trigger.action, action)) continue;
      if (!this.evalCondition(trigger.condition)) continue;
      for (const cmd of trigger.commands) {
        if ('condition' in cmd && !this.evalCondition(cmd.condition)) continue;
        handled = this.executeCommand(cmd) || handled;
      }
    }
    return handled;
  }

  private executeCommand(cmd: WmrTrigger['commands'][number]): boolean {
    if (cmd.type === 'intent' && this.opts.onIntent) {
      const pkg = cmd.packageExp ? String(evalExprStr(cmd.packageExp, this.vars)) : cmd.package;
      const cls = cmd.classExp ? String(evalExprStr(cmd.classExp, this.vars)) : cmd.class;
      if (pkg) {
        const handled = this.opts.onIntent(pkg, cls);
        if (handled !== false) return true;
      }
      const fallback = cmd.fallback ?? [];
      if (fallback.length > 0) {
        this.vars.executeCommands(fallback);
        return true;
      }
    }
    if (cmd.type === 'animation') {
      this.vars.playAnimation(cmd.target, cmd.command);
      return true;
    }
    this.vars.executeCommands([cmd]);
    return true;
  }
}
