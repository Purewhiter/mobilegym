/**
 * 仿真输入注入（面向 Agent 的“原子手势”接口）
 *
 * 目标：
 * - 让 Agent/外部控制器只能像人一样执行：tap / doubleTap / longPress / swipe / back / home
 * - 具体事件注入细节由仿真系统统一实现，避免外部各自写一套（不可复现）
 *
 * 坐标说明：
 * - 优先使用 CSS 像素（浏览器 viewport 坐标系）
 * - physical 像素（例如 1080x2400）需要显式声明（避免在不同环境下用 devicePixelRatio 误判）
 */
import { SIMULATOR_CONFIG } from './data';
import { getScrollMeta, ScrollMetaMap } from './scrollMeta';

const { dpr: frameworkDpr } = SIMULATOR_CONFIG.framework;

export type Point = { x: number; y: number };
type PointLike = Point | [number, number];

export type SimCoordSpace = 'css' | 'physical';
export type SimCoordOptions = { coords?: SimCoordSpace; dpr?: number };

export interface SimInputAPI {
  tap: (x: number, y: number, opts?: SimCoordOptions) => void;
  doubleTap: (x: number, y: number, opts?: SimCoordOptions) => void;
  longPress: (x: number, y: number, ms?: number, opts?: SimCoordOptions) => Promise<void>;
  /**
   * 在当前聚焦元素上输入文本（人类键盘输入的等价抽象）
   * - 需要先通过 tap 让输入框获得焦点
   * - 默认不会清空原内容（可用 opts.clear）
   */
  type: (text: string, opts?: { clear?: boolean; perCharMs?: number }) => Promise<void>;
  swipe: (
    start: Point,
    end: Point,
    opts?: {
      /** 坐标空间：默认 'css'（viewport 坐标）；'physical' 需要显式声明 */
      coords?: SimCoordSpace;
      /** physical->css 的缩放系数（默认使用 SIMULATOR_CONFIG.framework.dpr） */
      dpr?: number;
      /** 手指滑动时长（ms） */
      ms?: number;
      /** 手指滑动采样步数 */
      steps?: number;
      /** 是否开启松手惯性（默认 true） */
      inertia?: boolean;
      /** 惯性持续时长（ms，默认 450） */
      inertiaMs?: number;
      /** 惯性衰减系数（0~1，越大越“滑”，默认 0.86） */
      inertiaDecay?: number;
    },
  ) => Promise<void>;
  /**
   * 拖动（长按后移动，区别于 swipe）
   * - 先在起点 pointerdown + 等待 holdMs 触发长按识别
   * - 然后沿路径缓慢 pointermove 到终点
   * - 最后 pointerup 松手，无惯性、不触发滚动
   * - 用途：拖拽排序、滑块验证码、移动图标等
   */
  drag: (
    start: Point,
    end: Point,
    opts?: {
      coords?: SimCoordSpace;
      dpr?: number;
      /** 起点长按等待时长（ms，默认 500） */
      holdMs?: number;
      /** 拖动过程时长（ms，默认 400） */
      ms?: number;
      /** 拖动采样步数（默认 10） */
      steps?: number;
    },
  ) => Promise<void>;
  back: () => void;
  home: () => void;
  /** 打开最近任务（Android RECENT 键） */
  recent: () => void;
  /** 回车键（搜索确认、换行等） */
  enter: () => void;
}

export interface SimQueryRect {
  /** CSS viewport 坐标系的矩形 */
  rect: { x: number; y: number; width: number; height: number };
  /** 元素中心点（CSS px） */
  center: { x: number; y: number };
  /** 元素中心点（physical px） */
  centerPhysical: { x: number; y: number };
  /** 便于调试：匹配到的元素标注 */
  meta?: { selector?: string; triggerId?: string; triggerParams?: any; elementId?: string };
}

export interface SimQueryAPI {
  /**
   * 通过 CSS selector 获取元素坐标（返回第一个可见元素）
   * 例：getRectBySelector('[data-trigger="discover.moments.open"]')
   */
  getRectBySelector: (selector: string) => SimQueryRect | null;
  /**
   * 通过 data-trigger + 可选 params 获取元素坐标（返回第一个可见且匹配 params 的元素）
   * 例：getRectByTrigger('faceToFace.join.open', { pin: '2345' })
   */
  getRectByTrigger: (triggerId: string, params?: Record<string, any>) => SimQueryRect | null;
  /**
   * 通过元素 id 获取坐标（等价于 getRectBySelector(`#${id}`)）
   */
  getRectById: (id: string) => SimQueryRect | null;
  /**
   * 获取当前页面的滚动状态（自动发现所有 data-scroll-container 元素）
   */
  getScrollMeta: () => ScrollMetaMap;
}

function assertFinite(n: any, label: string) {
  if (typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n)) {
    throw new TypeError(`[__SIM_INPUT__] ${label} must be a finite number, got ${String(n)}`);
  }
}

function coercePoint(p: any, label: string): Point {
  if (Array.isArray(p) && p.length >= 2) {
    const x = p[0];
    const y = p[1];
    assertFinite(x, `${label}[0] (x)`);
    assertFinite(y, `${label}[1] (y)`);
    return { x, y };
  }
  if (p && typeof p === 'object' && 'x' in p && 'y' in p) {
    const x = (p as any).x;
    const y = (p as any).y;
    assertFinite(x, `${label}.x`);
    assertFinite(y, `${label}.y`);
    return { x, y };
  }
  throw new TypeError(
    `[__SIM_INPUT__] ${label} must be {x:number,y:number} or [x,y]. Example: swipe({x:100,y:100},{x:100,y:200})`,
  );
}

function getSimDpr(): number {
  const cfg = frameworkDpr;
  if (typeof cfg === 'number' && Number.isFinite(cfg) && cfg > 0) return cfg;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

function normalizePoint(x: number, y: number, opts?: SimCoordOptions): { x: number; y: number } {
  const coords: SimCoordSpace = opts?.coords ?? 'css';
  const dprRaw = opts?.dpr ?? getSimDpr();
  const dpr = Number.isFinite(dprRaw) && dprRaw > 0 ? dprRaw : 1;

  if (coords === 'css') return { x, y };
  return { x: x / dpr, y: y / dpr };
}

function elFromPoint(x: number, y: number): Element | null {
  // elementFromPoint 在坐标正好落在 box 边界时行为不一致:
  // 浏览器有时把边界点判为"不在内",返回父容器或 null(典型场景:点坐标
  // 正好等于 rect.right / rect.bottom,或 slider/按钮贴着父边界)。
  // 两层 probe:
  //  1) 亚像素边界:原值 + floor/ceil 四角,覆盖 x/y 是小数的场景;
  //  2) 整数边界:±1 邻居,因为当 x/y 本身是整数时 floor===ceil,四角会
  //     退化成同一点。沿两轴再各探 ±1 一次,任一非空即返回。
  // 事件派发仍用原始坐标。
  try {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const cx = Math.ceil(x);
    const cy = Math.ceil(y);
    const probes: Array<[number, number]> = [
      [x, y],
      [fx, fy],
      [cx, fy],
      [fx, cy],
      [cx, cy],
      [fx - 1, fy],
      [cx + 1, cy],
      [fx, fy - 1],
      [cx, cy + 1],
    ];
    const seen = new Set<string>();
    for (const [px, py] of probes) {
      const key = `${px},${py}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const hit = document.elementFromPoint(px, py);
      if (hit) return hit;
    }
    return null;
  } catch {
    return null;
  }
}

function dispatchPointer(el: Element, type: string, x: number, y: number, opts?: { buttons?: number }) {
  assertFinite(x, `clientX for ${type}`);
  assertFinite(y, `clientY for ${type}`);
  const e = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX: x,
    clientY: y,
    buttons: opts?.buttons ?? (type === 'pointerdown' ? 1 : 0),
    pressure: type === 'pointerdown' ? 0.5 : 0,
  });
  el.dispatchEvent(e);
}

function dispatchMouse(el: Element, type: string, x: number, y: number) {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  el.dispatchEvent(e);
}

let __measureCanvas: HTMLCanvasElement | null = null;

function getTextMeasureContext(font: string): CanvasRenderingContext2D | null {
  try {
    if (!__measureCanvas) __measureCanvas = document.createElement('canvas');
    const ctx = __measureCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.font = font;
    return ctx;
  } catch {
    return null;
  }
}

function buildCanvasFont(style: CSSStyleDeclaration): string {
  // Roughly mirrors canvas font shorthand: "font-style font-variant font-weight font-size/line-height font-family"
  const fontStyle = style.fontStyle || 'normal';
  const fontVariant = style.fontVariant || 'normal';
  const fontWeight = style.fontWeight || 'normal';
  const fontSize = style.fontSize || '16px';
  const lineHeight = style.lineHeight || 'normal';
  const fontFamily = style.fontFamily || 'sans-serif';
  return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily}`;
}

function setCaretFromClientX(el: HTMLInputElement | HTMLTextAreaElement, clientX: number) {
  // NOTE: Synthetic events do not reliably move the caret like real clicks.
  // We approximate by measuring text width and placing caret near clicked x.
  try {
    // Some input types don't support selection APIs (e.g. number)
    if (typeof (el as any).setSelectionRange !== 'function') return;
    const value = String(el.value ?? '');
    if (!value) {
      el.setSelectionRange(0, 0);
      return;
    }

    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const padL = parseFloat(style.paddingLeft || '0') || 0;
    const borderL = parseFloat(style.borderLeftWidth || '0') || 0;

    // Visible text start inside the input box.
    // Account for horizontal scrolling in the input.
    const scrollLeft = typeof (el as any).scrollLeft === 'number' ? (el as any).scrollLeft : 0;
    const xIn = Math.max(0, clientX - rect.left - padL - borderL + scrollLeft);

    const font = buildCanvasFont(style);
    const ctx = getTextMeasureContext(font);
    if (!ctx) {
      // Fallback: put caret at end (common behavior for programmatic focus)
      el.setSelectionRange(value.length, value.length);
      return;
    }

    // Binary search the caret position.
    let lo = 0;
    let hi = value.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const w = ctx.measureText(value.slice(0, mid)).width;
      if (w <= xIn) lo = mid;
      else hi = mid - 1;
    }
    const pos = Math.min(value.length, Math.max(0, lo));
    el.setSelectionRange(pos, pos);
  } catch {
    // ignore
  }
}

function focusIfFocusable(el: Element, x: number, y: number) {
  if (!(el instanceof HTMLElement)) return;
  // IMPORTANT:
  // dispatchEvent(MouseEvent/PointerEvent) does NOT trigger browser default actions
  // (e.g. focusing <input>), so we explicitly focus common focusable targets.
  const isFocusable =
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el.isContentEditable;

  if (!isFocusable) return;

  try {
    // preventScroll is best-effort (some browsers may not support it)
    (el as any).focus?.({ preventScroll: true });
  } catch {
    try {
      el.focus();
    } catch {
      // ignore
    }
  }

  // Best-effort caret positioning for text inputs
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setCaretFromClientX(el, x);
  }
}

// Touch 事件分发（用于 swipe，让监听 Touch 事件的组件也能响应）
function dispatchTouch(el: Element, type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number) {
  assertFinite(x, `clientX for ${type}`);
  assertFinite(y, `clientY for ${type}`);
  const touch = new Touch({
    identifier: 1,
    target: el,
    clientX: x,
    clientY: y,
    pageX: x,
    pageY: y,
    screenX: x,
    screenY: y,
  });
  const e = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    touches: type === 'touchend' ? [] : [touch],
    targetTouches: type === 'touchend' ? [] : [touch],
    changedTouches: [touch],
  });
  el.dispatchEvent(e);
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // React 受控输入需要走原生 setter 才能触发 onChange 正常工作
  let proto: any = Object.getPrototypeOf(el);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && typeof desc.set === 'function') {
      desc.set.call(el, value);
      return;
    }
    proto = Object.getPrototypeOf(proto);
  }
  // fallback
  (el as any).value = value;
}

interface ScrollableTargetInfo {
  element: HTMLElement;
  canScrollX: boolean;
  canScrollY: boolean;
}

function getScrollInfo(el: HTMLElement): ScrollableTargetInfo | null {
  const style = getComputedStyle(el);
  const oy = style.overflowY;
  const ox = style.overflowX;
  const canScrollY = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2;
  const canScrollX = (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2;
  
  if (!canScrollX && !canScrollY) return null;
  
  return { element: el, canScrollX, canScrollY };
}

/**
 * 查找最合适的滚动容器
 * 策略：
 * 1. 先从起点元素向上查找（最精确，O(depth)）
 * 2. 如果找不到，使用 elementsFromPoint 查找滑动路径上的元素（更高效）
 */
function findScrollableTarget(
  startEl: Element | null, 
  swipeDirection: 'horizontal' | 'vertical' | 'both',
  swipeRect: { x: number; y: number; width: number; height: number }
): ScrollableTargetInfo | null {
  const matchesDirection = (info: ScrollableTargetInfo) => {
    if (swipeDirection === 'horizontal') return info.canScrollX;
    if (swipeDirection === 'vertical') return info.canScrollY;
    return info.canScrollX || info.canScrollY;
  };

  // 策略1：从起点元素向上查找（O(depth)，通常很快）
  let cur: Element | null = startEl;
  while (cur) {
    if (cur instanceof HTMLElement) {
      const info = getScrollInfo(cur);
      if (info && matchesDirection(info)) return info;
    }
    cur = cur.parentElement;
  }
  
  // 策略2：使用 elementsFromPoint 查找滑动区域内的元素
  // 比遍历整个 DOM 高效得多
  const centerX = swipeRect.x + swipeRect.width / 2;
  const centerY = swipeRect.y + swipeRect.height / 2;
  const elementsAtPoint = document.elementsFromPoint(centerX, centerY);
  
  for (const el of elementsAtPoint) {
    if (el instanceof HTMLElement) {
      const info = getScrollInfo(el);
      if (info && matchesDirection(info)) return info;
    }
  }
  
  return null;
}

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  // 简单判断：矩形至少与 viewport 有交集
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (rect.right < 0 || rect.bottom < 0 || rect.left > vw || rect.top > vh) return false;
  return true;
}

function buildRect(el: Element, meta?: SimQueryRect['meta']): SimQueryRect {
  const dpr = getSimDpr();
  const rect = (el as HTMLElement).getBoundingClientRect();
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  return {
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    center,
    centerPhysical: { x: center.x * dpr, y: center.y * dpr },
    meta,
  };
}

export function initSimInput(): void {
  if (typeof window === 'undefined') return;

  // 防止 Console/外部并发触发多次 swipe 导致主线程堆积卡顿
  let swipeQueue: Promise<void> = Promise.resolve();

  const api: SimInputAPI = {
    tap: (x, y, coordOpts) => {
      assertFinite(x, 'tap.x');
      assertFinite(y, 'tap.y');
      const p = normalizePoint(x, y, coordOpts);
      const el = elFromPoint(p.x, p.y) || document.body;

      // Best-effort: if the tab/window isn't focused (e.g. DevTools console has focus),
      // caret won't blink even if the input is focused. window.focus may be ignored by browsers.
      try {
        window.focus();
      } catch {
        // ignore
      }

      // Try to emulate a more native "tap" sequence:
      // touchstart -> pointerdown -> mousedown -> focus -> pointerup -> mouseup -> click -> touchend
      // (All are synthetic; some default browser behaviors are still not perfectly reproducible.)
      try {
        dispatchTouch(el, 'touchstart', p.x, p.y);
      } catch {
        // ignore
      }

      dispatchPointer(el, 'pointerdown', p.x, p.y, { buttons: 1 });
      dispatchMouse(el, 'mousedown', p.x, p.y);

      // Ensure focus for inputs/contenteditable so that caret + __SIM_INPUT__.type() works.
      focusIfFocusable(el, p.x, p.y);

      dispatchPointer(el, 'pointerup', p.x, p.y, { buttons: 0 });
      dispatchMouse(el, 'mouseup', p.x, p.y);
      // React 的 onClick 主要依赖 click；手动补一个 click 更稳
      dispatchMouse(el, 'click', p.x, p.y);

      try {
        dispatchTouch(el, 'touchend', p.x, p.y);
      } catch {
        // ignore
      }

      // Some browsers/UI only settle focus/caret after the current event loop.
      // Re-apply focus+caret on next frame to better match a real user tap.
      try {
        requestAnimationFrame(() => {
          focusIfFocusable(el, p.x, p.y);
        });
      } catch {
        // ignore
      }
    },

    doubleTap: (x, y, coordOpts) => {
      assertFinite(x, 'doubleTap.x');
      assertFinite(y, 'doubleTap.y');
      const p = normalizePoint(x, y, coordOpts);
      const el = elFromPoint(p.x, p.y) || document.body;
      // 两次 pointer up（useTriggerGestures 的 doubleTap 依赖 pointer 事件）
      dispatchPointer(el, 'pointerdown', p.x, p.y, { buttons: 1 });
      dispatchPointer(el, 'pointerup', p.x, p.y, { buttons: 0 });
      dispatchPointer(el, 'pointerdown', p.x, p.y, { buttons: 1 });
      dispatchPointer(el, 'pointerup', p.x, p.y, { buttons: 0 });
      dispatchMouse(el, 'dblclick', p.x, p.y);
    },

    longPress: async (x, y, ms = 800, coordOpts) => {
      assertFinite(x, 'longPress.x');
      assertFinite(y, 'longPress.y');
      assertFinite(ms, 'longPress.ms');
      const p = normalizePoint(x, y, coordOpts);
      const el = elFromPoint(p.x, p.y) || document.body;

      // Match the tap() press-start sequence so existing long-press handlers
      // that still listen to mouse/touch events can observe the gesture.
      try {
        dispatchTouch(el, 'touchstart', p.x, p.y);
      } catch {
        // ignore
      }
      dispatchPointer(el, 'pointerdown', p.x, p.y, { buttons: 1 });
      dispatchMouse(el, 'mousedown', p.x, p.y);

      await sleep(ms);

      dispatchPointer(el, 'pointerup', p.x, p.y, { buttons: 0 });
      dispatchMouse(el, 'mouseup', p.x, p.y);
      try {
        dispatchTouch(el, 'touchend', p.x, p.y);
      } catch {
        // ignore
      }
      // 注意：长按不补 click，避免误触
    },

    type: async (text: string, opts) => {
      if (typeof text !== 'string') {
        throw new TypeError(`[__SIM_INPUT__] type(text) expects string, got ${typeof text}`);
      }
      const clear = opts?.clear ?? false;
      const perCharMs = Math.max(0, opts?.perCharMs ?? 0);

      const active = document.activeElement as any;
      if (!active || active === document.body || active === document.documentElement) {
        throw new Error('[__SIM_INPUT__] no focused input element; tap an input first');
      }

      const dispatchInput = (el: HTMLElement) => {
        // InputEvent 在部分浏览器/环境可能受限，用 Event 兜底
        try {
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } catch {
          // ignore
        }
      };

      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        if (clear) {
          setNativeValue(active, '');
          dispatchInput(active);
        }
        const base = String(active.value ?? '');
        if (perCharMs > 0) {
          let cur = base;
          for (const ch of text) {
            cur += ch;
            setNativeValue(active, cur);
            dispatchInput(active);

            await sleep(perCharMs);
          }
        } else {
          setNativeValue(active, base + text);
          dispatchInput(active);
        }
        return;
      }

      // contenteditable
      if (active instanceof HTMLElement && active.isContentEditable) {
        if (clear) {
          active.textContent = '';
          dispatchInput(active);
        }
        if (perCharMs > 0) {
          for (const ch of text) {
            // 优先走 execCommand（尽管 deprecated，但兼容性更好）
            try {
              document.execCommand('insertText', false, ch);
            } catch {
              active.textContent = (active.textContent || '') + ch;
            }
            dispatchInput(active);

            await sleep(perCharMs);
          }
        } else {
          try {
            document.execCommand('insertText', false, text);
          } catch {
            active.textContent = (active.textContent || '') + text;
          }
          dispatchInput(active);
        }
        return;
      }

      throw new Error(`[__SIM_INPUT__] activeElement is not an input/textarea/contenteditable: ${active?.tagName || typeof active}`);
    },

    swipe: (start: PointLike, end: PointLike, opts) => {
      // 先验证参数（在队列外，这样错误能立即抛出且不影响队列）
      const sp = coercePoint(start, 'swipe.start');
      const ep = coercePoint(end, 'swipe.end');

      swipeQueue = swipeQueue
        .then(async () => {
          // 滑动时长和步数
          const ms = Math.max(0, opts?.ms ?? 300);
          const steps = Math.max(2, opts?.steps ?? 10);
          const inertia = opts?.inertia ?? true;
          const inertiaMs = Math.max(0, opts?.inertiaMs ?? 450);
          const inertiaDecayRaw = opts?.inertiaDecay ?? 0.86;
          const inertiaDecay = Math.min(0.98, Math.max(0.1, inertiaDecayRaw));

          // 先用原始坐标计算方向（避免 normalizePoint 不一致导致方向错误）
          const rawDx = ep.x - sp.x;
          const rawDy = ep.y - sp.y;
          
          // 判断滑动方向（基于原始坐标）
          // 真实手机上斜向滑动也能工作，所以用较宽松的阈值
          // 只有当一个方向是另一个的 1.5 倍以上时，才判断为单一方向
          const swipeDirection: 'horizontal' | 'vertical' | 'both' = 
            Math.abs(rawDx) > Math.abs(rawDy) * 1.5 ? 'horizontal' :
            Math.abs(rawDy) > Math.abs(rawDx) * 1.5 ? 'vertical' : 'both';
          
          const coords: SimCoordSpace = opts?.coords ?? 'css';
          const dprRaw = opts?.dpr ?? getSimDpr();
          const dpr = Number.isFinite(dprRaw) && dprRaw > 0 ? dprRaw : 1;

          const needsScale =
            coords === 'physical'
              ? true
              : false;

          const s = needsScale ? { x: sp.x / dpr, y: sp.y / dpr } : { x: sp.x, y: sp.y };
          const e = needsScale ? { x: ep.x / dpr, y: ep.y / dpr } : { x: ep.x, y: ep.y };

          const dx = e.x - s.x;
          const dy = e.y - s.y;
          
          // 计算滑动区域（起点和终点形成的矩形，稍微扩大一点）
          const swipeRect = {
            x: Math.min(s.x, e.x) - 10,
            y: Math.min(s.y, e.y) - 10,
            width: Math.abs(dx) + 20,
            height: Math.abs(dy) + 20,
          };

          const startEl = elFromPoint(s.x, s.y);
          const scrollInfo = findScrollableTarget(startEl, swipeDirection, swipeRect);
          const scrollTarget = scrollInfo?.element ?? null;

          const el = startEl || document.body;
          
          // ========== 统一的触摸模拟方案 ==========
          // 模拟真实触摸：发送完整的 touch 事件序列 + 手动滚动
          // （因为合成的 TouchEvent 不会触发浏览器原生滚动，必须手动处理）
          
          dispatchTouch(el, 'touchstart', s.x, s.y);
          dispatchPointer(el, 'pointerdown', s.x, s.y, { buttons: 1 });

          // 分步发送 touchmove 并同步滚动
          const dt = ms / steps;
          for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const xi = s.x + dx * progress;
            const yi = s.y + dy * progress;

            // 发送 touch/pointer move 事件
            dispatchTouch(el, 'touchmove', xi, yi);
            dispatchPointer(el, 'pointermove', xi, yi, { buttons: 1 });
            
            // 同步滚动（如果有滚动容器）
            if (scrollTarget) {
              // 计算这一步应该滚动多少（滑动距离的反方向）
              const stepScrollX = -dx / steps;
              const stepScrollY = -dy / steps;
              scrollTarget.scrollBy({ left: stepScrollX, top: stepScrollY, behavior: 'auto' });
            }


            await sleep(dt);
          }

          dispatchTouch(el, 'touchend', e.x, e.y);
          dispatchPointer(el, 'pointerup', e.x, e.y, { buttons: 0 });

          // 惯性滚动（模拟松手后的滑动）
          if (inertia && scrollTarget && inertiaMs > 0) {
            const inertiaSteps = Math.max(6, Math.round(steps * 0.8));
            const tailDt = inertiaMs / inertiaSteps;

            // 初始速度 = 最后一步的滚动速度 * 放大系数
            let vx = (-dx / steps) * 1.5;
            let vy = (-dy / steps) * 1.5;

            for (let i = 0; i < inertiaSteps; i++) {
              vx *= inertiaDecay;
              vy *= inertiaDecay;

              if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) break;

              scrollTarget.scrollBy({ left: vx, top: vy, behavior: 'auto' });
  
              await sleep(tailDt);
            }
          }
        })
        .catch(err => {
          // 捕获错误，打印日志但不向后传播，让队列能继续工作
          console.error('[__SIM_INPUT__] swipe error:', err);
        });
      return swipeQueue;
    },

    back: () => {
      const os = window.__OS__;
      if (os && typeof os.handleBack === 'function') {
        os.handleBack();
        return;
      }
      history.back();
    },

    home: () => {
      const os = window.__OS__;
      if (os && typeof os.goHome === 'function') {
        os.goHome();
        return;
      }
      // fallback：尽量不要 reload；但没有 OS 的情况下只能回到根
      location.assign(location.origin + location.pathname);
    },

    drag: async (start: PointLike, end: PointLike, opts) => {
      const sp = coercePoint(start, 'drag.start');
      const ep = coercePoint(end, 'drag.end');

      const coords: SimCoordSpace = opts?.coords ?? 'css';
      const dprRaw = opts?.dpr ?? getSimDpr();
      const dpr = Number.isFinite(dprRaw) && dprRaw > 0 ? dprRaw : 1;
      const needsScale = coords === 'physical';

      const s = needsScale ? { x: sp.x / dpr, y: sp.y / dpr } : { x: sp.x, y: sp.y };
      const e = needsScale ? { x: ep.x / dpr, y: ep.y / dpr } : { x: ep.x, y: ep.y };

      const holdMs = Math.max(0, opts?.holdMs ?? 500);
      const ms = Math.max(0, opts?.ms ?? 400);
      const steps = Math.max(2, opts?.steps ?? 10);

      const el = elFromPoint(s.x, s.y) || document.body;

      // 1. pointerdown at start
      dispatchTouch(el, 'touchstart', s.x, s.y);
      dispatchPointer(el, 'pointerdown', s.x, s.y, { buttons: 1 });

      // 2. hold to trigger long-press recognition
      await sleep(holdMs);

      // 3. move from start to end (no scrollBy, no inertia)
      const dx = e.x - s.x;
      const dy = e.y - s.y;
      const dt = ms / steps;

      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const xi = s.x + dx * progress;
        const yi = s.y + dy * progress;
        dispatchTouch(el, 'touchmove', xi, yi);
        dispatchPointer(el, 'pointermove', xi, yi, { buttons: 1 });
        await sleep(dt);
      }

      // 4. release
      dispatchTouch(el, 'touchend', e.x, e.y);
      dispatchPointer(el, 'pointerup', e.x, e.y, { buttons: 0 });
    },

    recent: () => {
      window.__OS__?.showRecents?.();
    },

    enter: () => {
      const active = document.activeElement || document.body;
      const prevented = !active.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
      );
      // 合成事件不触发浏览器默认行为，需要手动兜底
      if (!prevented) {
        if (active instanceof HTMLTextAreaElement) {
          const start = active.selectionStart ?? active.value.length;
          const end = active.selectionEnd ?? start;
          const before = active.value.slice(0, start);
          const after = active.value.slice(end);
          setNativeValue(active, before + '\n' + after);
          active.dispatchEvent(new Event('input', { bubbles: true }));
          const newPos = start + 1;
          active.setSelectionRange(newPos, newPos);
        } else if (active instanceof HTMLElement && active.isContentEditable) {
          try {
            document.execCommand('insertLineBreak', false);
          } catch {
            document.execCommand('insertText', false, '\n');
          }
          active.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      active.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
      );
    },
  };

  window.__SIM_INPUT__ = api;

  // 只读查询接口（给调试/评测/回放用；不要给 Agent 当作能力）
  const queryApi: SimQueryAPI = {
    getRectBySelector: (selector: string) => {
      try {
        // 优先用 querySelector 命中首个，避免全量遍历 DOM
        const first = document.querySelector(selector);
        if (first && isVisible(first)) {
          return buildRect(first, { selector });
        }
        const els = Array.from(document.querySelectorAll(selector));
        const el = els.find(isVisible);
        if (!el) return null;
        return buildRect(el, { selector });
      } catch {
        return null;
      }
    },
    getRectById: (id: string) => {
      if (!id) return null;
      const safe = CSS && (CSS as any).escape ? (CSS as any).escape(id) : id.replace(/"/g, '\\"');
      return queryApi.getRectBySelector(`#${safe}`);
    },
    getRectByTrigger: (triggerId: string, params?: Record<string, any>) => {
      try {
        const selector = `[data-trigger="${triggerId}"]`;
        const els = Array.from(document.querySelectorAll(selector));
        const matched = els.filter(isVisible).find(el => {
          if (!params) return true;
          const raw = (el as HTMLElement).getAttribute('data-trigger-params');
          if (!raw) return false;
          try {
            const obj = JSON.parse(raw);
            if (!obj || typeof obj !== 'object') return false;
            for (const [k, v] of Object.entries(params)) {
              if ((obj as any)[k] !== v) return false;
            }
            return true;
          } catch {
            return false;
          }
        });
        if (!matched) return null;
        const rawParams = (matched as HTMLElement).getAttribute('data-trigger-params');
        let parsed: any = undefined;
        if (rawParams) {
          try { parsed = JSON.parse(rawParams); } catch { parsed = rawParams; }
        }
        return buildRect(matched, { triggerId, triggerParams: parsed });
      } catch {
        return null;
      }
    },
    // 滚动状态观测（与 window.__getScrollMeta__ 相同，提供统一命名风格）
    getScrollMeta,
  };

  window.__SIM_QUERY__ = queryApi;
}

