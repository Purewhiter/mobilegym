// overlay.js — draws the agent's pointer actions onto the live phone screen:
// a gliding "ghost cursor", tap ripples, and swipe/drag trails. The marks play
// the moment the agent decides (runner emits onStep before the executor acts),
// so they "preview" where the tap is about to land.
//
// Mounted on a 360×800 layer that sits over the simulator iframe. Action points
// arrive in the 0–1000 normalized space (see actions.parseNormPoint) and are
// mapped to the layer's pixel box exactly like executor.toCss maps the real
// taps — so the on-glass mark lands where the real pointer lands.
//
// Every public method is defensive: a malformed action degrades to "no on-glass
// mark" and never throws back into the run loop.
import { ActionType } from './actions.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TAP_RIPPLE_DELAY_MS = 280;
const TAP_PREVIEW_MS = 360;
const DOUBLE_TAP_PREVIEW_MS = 520;
const MOVE_START_DELAY_MS = 30;
const MOVE_PREVIEW_MS = 520;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function prefersReducedMotion() {
  try {
    return typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

export class PhoneOverlay {
  constructor(getLayer) {
    this.getLayer = typeof getLayer === 'function' ? getLayer : () => getLayer;
    this.cursor = null;
    this.last = null;      // {x,y} px in layer space; persists across steps
    this._marks = [];      // transient ripple/trail nodes awaiting cleanup
    this._timers = [];
  }

  _layer() {
    try { return this.getLayer() || null; } catch { return null; }
  }

  // nx,ny in 0–1000 → px in the layer's box (matches executor.toCss).
  _toPx(layer, point) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const nx = Number(point[0]);
    const ny = Number(point[1]);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
    const w = layer.clientWidth || 360;
    const h = layer.clientHeight || 800;
    return {
      x: Math.max(0, Math.min(1, nx / 1000)) * w,
      y: Math.max(0, Math.min(1, ny / 1000)) * h,
    };
  }

  _defer(fn, ms) {
    const t = setTimeout(() => {
      this._timers = this._timers.filter((x) => x !== t);
      try { fn(); } catch { /* ignore */ }
    }, ms);
    this._timers.push(t);
    return t;
  }

  // Start a fresh run: clear everything; the cursor re-appears on first action.
  begin() {
    const layer = this._layer();
    if (layer) layer.dataset.active = 'true';
    this.clearMarks();
    this._clearTimers();
    this.last = null;
    if (this.cursor) { this.cursor.remove(); this.cursor = null; }
  }

  // End of run: fade the cursor out, drop transient marks.
  end() {
    const layer = this._layer();
    if (layer) layer.dataset.active = 'false';
    this.clearMarks();
    this._clearTimers();
    if (this.cursor) {
      const c = this.cursor;
      this.cursor = null;
      c.classList.add('is-gone');
      setTimeout(() => c.remove(), 420);
    }
  }

  clearMarks() {
    this._marks.forEach((n) => { try { n.remove(); } catch { /* ignore */ } });
    this._marks = [];
  }

  _clearTimers() {
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
  }

  _ensureCursor(layer) {
    if (this.cursor && this.cursor.isConnected) return this.cursor;
    const c = document.createElement('div');
    c.className = 'mg-ov-cursor';
    const start = this.last || { x: layer.clientWidth / 2, y: layer.clientHeight * 0.46 };
    c.style.transition = 'none';
    c.style.transform = `translate(${start.x}px, ${start.y}px) translate(-50%, -50%)`;
    layer.appendChild(c);
    // commit the start position before the first animated move
    // eslint-disable-next-line no-unused-expressions
    c.offsetWidth;
    c.style.transition = '';
    this.cursor = c;
    return c;
  }

  _moveCursor(layer, to, instant) {
    const c = this._ensureCursor(layer);
    if (instant || prefersReducedMotion()) {
      c.style.transition = 'none';
      c.style.transform = `translate(${to.x}px, ${to.y}px) translate(-50%, -50%)`;
      // eslint-disable-next-line no-unused-expressions
      c.offsetWidth;
      c.style.transition = '';
    } else {
      c.style.transform = `translate(${to.x}px, ${to.y}px) translate(-50%, -50%)`;
    }
    this.last = { x: to.x, y: to.y };
  }

  _ripple(layer, at, kind) {
    const r = document.createElement('div');
    r.className = 'mg-ov-ripple';
    if (kind) r.dataset.kind = kind;
    r.style.left = `${at.x}px`;
    r.style.top = `${at.y}px`;
    layer.appendChild(r);
    this._marks.push(r);
    this._defer(() => r.remove(), prefersReducedMotion() ? 320 : 760);
  }

  _trail(layer, a, b) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'mg-ov-trail');
    svg.setAttribute('viewBox', `0 0 ${layer.clientWidth || 360} ${layer.clientHeight || 800}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('class', 'mg-ov-line');
    line.setAttribute('pathLength', '1');
    line.setAttribute('d', `M ${a.x} ${a.y} L ${b.x} ${b.y}`);
    svg.appendChild(line);

    // arrowhead at the destination
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const s = 12;
    const hx1 = b.x - s * Math.cos(ang - 0.5);
    const hy1 = b.y - s * Math.sin(ang - 0.5);
    const hx2 = b.x - s * Math.cos(ang + 0.5);
    const hy2 = b.y - s * Math.sin(ang + 0.5);
    const head = document.createElementNS(SVG_NS, 'path');
    head.setAttribute('class', 'mg-ov-trail-head');
    head.setAttribute('d', `M ${hx1} ${hy1} L ${b.x} ${b.y} L ${hx2} ${hy2}`);
    svg.appendChild(head);

    layer.appendChild(svg);
    this._marks.push(svg);
    this._defer(() => svg.remove(), prefersReducedMotion() ? 420 : 960);
  }

  // Render one action's pointer geometry. Non-pointer actions (TYPE, OPEN,
  // WAIT, control verbs) have no on-glass mark — they surface in the HUD /
  // narration instead. Returns when the visual preview has had enough time to
  // register before the runner applies the real simulator action.
  play(action) {
    const layer = this._layer();
    if (!layer || !action) return Promise.resolve();
    try {
      this.clearMarks();
      const d = action.data || {};
      switch (action.type) {
        case ActionType.CLICK:
        case ActionType.DOUBLE_TAP:
        case ActionType.LONG_PRESS: {
          const at = this._toPx(layer, d.point);
          if (!at) return Promise.resolve();
          this._moveCursor(layer, at);
          const delay = prefersReducedMotion() ? 0 : TAP_RIPPLE_DELAY_MS;
          this._defer(() => {
            this._ripple(layer, at, action.type === ActionType.LONG_PRESS ? 'long' : 'tap');
            if (action.type === ActionType.DOUBLE_TAP) {
              this._defer(() => this._ripple(layer, at, 'tap'), 170);
            }
          }, delay);
          return sleep(prefersReducedMotion()
            ? 0
            : action.type === ActionType.DOUBLE_TAP ? DOUBLE_TAP_PREVIEW_MS : TAP_PREVIEW_MS);
        }
        case ActionType.SWIPE:
        case ActionType.DRAG: {
          const a = this._toPx(layer, d.point1);
          const b = this._toPx(layer, d.point2);
          if (!a || !b) return Promise.resolve();
          this._moveCursor(layer, a, true);
          this._defer(() => {
            this._trail(layer, a, b);
            this._moveCursor(layer, b);
          }, MOVE_START_DELAY_MS);
          return sleep(prefersReducedMotion() ? 0 : MOVE_PREVIEW_MS);
        }
        default:
          return Promise.resolve();
      }
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[agent-overlay]', err);
      return Promise.resolve();
    }
  }
}
