// Executes a parsed agent action against the simulator iframe.
//
// Coordinates arrive 0–1000 normalized (generic_v2 convention) and map linearly
// to the current simulator CSS viewport. Control actions
// (ANSWER/COMPLETE/ABORT/NOOP) are not handled here — the runner interprets
// those for loop control.
import { ActionType, parseNormPoint } from './actions.js';
import { resolveAppId as defaultResolveAppId } from './app-resolver.js';

const FALLBACK_SCREEN_W = 360;
const FALLBACK_SCREEN_H = 800;
const OPEN_APP_TIMEOUT_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function firstPositive(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function viewportSize(win) {
  const doc = win?.document;
  const docEl = doc?.documentElement;
  const body = doc?.body;
  const root = doc?.getElementById?.('root');
  const rootRect = root?.getBoundingClientRect?.();
  const bodyRect = body?.getBoundingClientRect?.();

  const width = firstPositive(
    rootRect?.width,
    bodyRect?.width,
    docEl?.clientWidth,
    win?.visualViewport?.width,
    win?.innerWidth,
    FALLBACK_SCREEN_W,
  );
  const height = firstPositive(
    rootRect?.height,
    bodyRect?.height,
    docEl?.clientHeight,
    win?.visualViewport?.height,
    win?.innerHeight,
    FALLBACK_SCREEN_H,
  );
  return { width, height };
}

function toCss(win, point) {
  const [nx, ny] = parseNormPoint(point);
  const { width, height } = viewportSize(win);
  return { x: (nx / 1000) * width, y: (ny / 1000) * height };
}

function activeAppId(win) {
  try {
    return win.__OS__?.getState?.().activeAppId || win.__OS__?.state?.activeAppId || '';
  } catch {
    return '';
  }
}

async function waitForActiveApp(win, appId, timeoutMs = OPEN_APP_TIMEOUT_MS) {
  const now = () => Number(win?.performance?.now?.() ?? Date.now());
  const startedAt = now();
  while (now() - startedAt < timeoutMs) {
    if (activeAppId(win) === appId) return true;
    await sleep(80);
  }
  return activeAppId(win) === appId;
}

function requireDocument(win, actionName) {
  const doc = win?.document;
  if (!doc) {
    throw new Error(`Cannot execute ${actionName}: iframe document is not available`);
  }
  return doc;
}

function targetAt(win, x, y) {
  const doc = requireDocument(win, 'DOM input fallback');
  return doc.elementFromPoint(x, y) || doc.body || doc.documentElement;
}

function dispatchPointer(win, el, type, x, y, init = {}) {
  const EventCtor = win.PointerEvent || win.MouseEvent;
  el.dispatchEvent(new EventCtor(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    ...init,
  }));
}

function dispatchMouse(win, el, type, x, y, init = {}) {
  el.dispatchEvent(new win.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    ...init,
  }));
}

function focusIfEditable(el) {
  if (typeof el?.focus === 'function') {
    try { el.focus({ preventScroll: true }); } catch { el.focus(); }
  }
}

async function fallbackTap(win, x, y) {
  const el = targetAt(win, x, y);
  try { win.focus?.(); } catch { /* ignore */ }
  dispatchPointer(win, el, 'pointerdown', x, y, { buttons: 1 });
  dispatchMouse(win, el, 'mousedown', x, y, { buttons: 1 });
  focusIfEditable(el);
  dispatchPointer(win, el, 'pointerup', x, y, { buttons: 0 });
  dispatchMouse(win, el, 'mouseup', x, y, { buttons: 0 });
  dispatchMouse(win, el, 'click', x, y, { buttons: 0 });
  await sleep(0);
}

async function fallbackDoubleTap(win, x, y) {
  await fallbackTap(win, x, y);
  await sleep(80);
  await fallbackTap(win, x, y);
  dispatchMouse(win, targetAt(win, x, y), 'dblclick', x, y, { buttons: 0 });
}

async function fallbackLongPress(win, x, y, ms = 800) {
  const el = targetAt(win, x, y);
  dispatchPointer(win, el, 'pointerdown', x, y, { buttons: 1 });
  dispatchMouse(win, el, 'mousedown', x, y, { buttons: 1 });
  await sleep(ms);
  dispatchPointer(win, el, 'pointerup', x, y, { buttons: 0 });
  dispatchMouse(win, el, 'mouseup', x, y, { buttons: 0 });
}

function scrollableAncestor(win, el, start, end) {
  const doc = requireDocument(win, 'SWIPE fallback');
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const wantsVertical = dy >= dx;

  let cur = el;
  while (cur && cur !== doc.documentElement) {
    if (cur instanceof win.HTMLElement) {
      const style = win.getComputedStyle(cur);
      const overflow = wantsVertical ? style.overflowY : style.overflowX;
      const canScroll = wantsVertical
        ? cur.scrollHeight > cur.clientHeight + 1
        : cur.scrollWidth > cur.clientWidth + 1;
      if (canScroll && ['auto', 'scroll', 'overlay'].includes(overflow)) return cur;
    }
    cur = cur.parentElement;
  }
  return doc.scrollingElement || doc.documentElement || doc.body;
}

function applyScrollFallback(win, el, start, end) {
  const scroller = scrollableAncestor(win, el, start, end);
  const left = start.x - end.x;
  const top = start.y - end.y;
  if (typeof scroller?.scrollBy === 'function') {
    scroller.scrollBy({ left, top, behavior: 'auto' });
  } else if (scroller) {
    scroller.scrollLeft += left;
    scroller.scrollTop += top;
  }
}

async function fallbackMove(win, start, end, {
  holdMs = 0,
  ms = 300,
  steps = 10,
  scrollFallback = false,
} = {}) {
  const el = targetAt(win, start.x, start.y);
  dispatchPointer(win, el, 'pointerdown', start.x, start.y, { buttons: 1 });
  dispatchMouse(win, el, 'mousedown', start.x, start.y, { buttons: 1 });
  if (holdMs > 0) await sleep(holdMs);

  const count = Math.max(2, steps);
  for (let i = 1; i <= count; i += 1) {
    const progress = i / count;
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;
    dispatchPointer(win, el, 'pointermove', x, y, { buttons: 1 });
    dispatchMouse(win, el, 'mousemove', x, y, { buttons: 1 });
    await sleep(ms / count);
  }

  dispatchPointer(win, el, 'pointerup', end.x, end.y, { buttons: 0 });
  dispatchMouse(win, el, 'mouseup', end.x, end.y, { buttons: 0 });
  if (scrollFallback) applyScrollFallback(win, el, start, end);
}

function setNativeValue(win, el, value) {
  const proto = el instanceof win.HTMLTextAreaElement
    ? win.HTMLTextAreaElement.prototype
    : win.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

async function fallbackType(win, text, { clear = false } = {}) {
  const doc = requireDocument(win, 'TYPE fallback');
  const active = doc.activeElement;
  if (!active || active === doc.body || active === doc.documentElement) {
    throw new Error('Cannot execute TYPE: __SIM_INPUT__ is unavailable and no editable element is focused');
  }

  const dispatchInput = () => active.dispatchEvent(new win.Event('input', { bubbles: true }));
  if (active instanceof win.HTMLInputElement || active instanceof win.HTMLTextAreaElement) {
    const base = clear ? '' : String(active.value ?? '');
    setNativeValue(win, active, base + text);
    dispatchInput();
    return;
  }

  if (active instanceof win.HTMLElement && active.isContentEditable) {
    if (clear) active.textContent = '';
    try {
      doc.execCommand('insertText', false, text);
    } catch {
      active.textContent = String(active.textContent || '') + text;
    }
    dispatchInput();
    return;
  }

  throw new Error(`Cannot execute TYPE: __SIM_INPUT__ is unavailable and activeElement is not editable (${active.tagName || typeof active})`);
}

function fallbackBack(win) {
  if (typeof win.__OS__?.handleBack === 'function') {
    win.__OS__.handleBack();
    return;
  }
  win.history?.back?.();
}

function fallbackHome(win) {
  if (typeof win.__OS__?.goHome === 'function') {
    win.__OS__.goHome();
    return;
  }
  throw new Error('Cannot execute HOME: __SIM_INPUT__ and __OS__.goHome are unavailable');
}

function fallbackRecent(win) {
  if (typeof win.__OS__?.showRecents === 'function') {
    win.__OS__.showRecents();
    return;
  }
  throw new Error('Cannot execute RECENT: __SIM_INPUT__ and __OS__.showRecents are unavailable');
}

function fallbackEnter(win) {
  const doc = requireDocument(win, 'ENTER fallback');
  const active = doc.activeElement || doc.body;
  active.dispatchEvent(new win.KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
    cancelable: true,
  }));
  active.dispatchEvent(new win.KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
    cancelable: true,
  }));
}

/**
 * @param {Window} win iframe.contentWindow
 * @param {{type:string, data:object}} action
 */
export async function run(win, action, { resolveAppId = defaultResolveAppId } = {}) {
  const input = win.__SIM_INPUT__;
  const { type, data } = action;

  switch (type) {
    case ActionType.CLICK: {
      const { x, y } = toCss(win, data.point);
      if (input?.tap) input.tap(x, y);
      else await fallbackTap(win, x, y);
      return;
    }
    case ActionType.DOUBLE_TAP: {
      const { x, y } = toCss(win, data.point);
      if (input?.doubleTap) input.doubleTap(x, y);
      else await fallbackDoubleTap(win, x, y);
      return;
    }
    case ActionType.LONG_PRESS: {
      const { x, y } = toCss(win, data.point);
      if (input?.longPress) await input.longPress(x, y);
      else await fallbackLongPress(win, x, y);
      return;
    }
    case ActionType.TYPE: {
      if (Array.isArray(data.point)) {
        const { x, y } = toCss(win, data.point);
        if (input?.tap) input.tap(x, y);
        else await fallbackTap(win, x, y);
        await sleep(120);
      }
      if (input?.type) await input.type(String(data.value ?? ''), { clear: Boolean(data.clear) });
      else await fallbackType(win, String(data.value ?? ''), { clear: Boolean(data.clear) });
      return;
    }
    case ActionType.SWIPE: {
      const a = toCss(win, data.point1);
      const b = toCss(win, data.point2);
      if (input?.swipe) await input.swipe(a, b);
      else await fallbackMove(win, a, b, { ms: 300, steps: 10, scrollFallback: true });
      return;
    }
    case ActionType.DRAG: {
      const a = toCss(win, data.point1);
      const b = toCss(win, data.point2);
      if (input?.drag) await input.drag(a, b);
      else await fallbackMove(win, a, b, { holdMs: 500, ms: 400, steps: 10 });
      return;
    }
    case ActionType.BACK: input?.back ? input.back() : fallbackBack(win); return;
    case ActionType.HOME: input?.home ? input.home() : fallbackHome(win); return;
    case ActionType.RECENT: input?.recent ? input.recent() : fallbackRecent(win); return;
    case ActionType.ENTER: input?.enter ? input.enter() : fallbackEnter(win); return;
    case ActionType.WAIT: {
      const secs = Number(data.value);
      await sleep(Math.max(0, (Number.isFinite(secs) ? secs : 1) * 1000));
      return;
    }
    case ActionType.AWAKE: {
      const appId = resolveAppId(data.value);
      if (!appId) return;
      if (typeof win.__OS__?.openApp !== 'function') {
        throw new Error('__OS__.openApp is not available');
      }
      win.__OS__.openApp(appId);
      const ready = await waitForActiveApp(win, appId);
      if (!ready) {
        console.warn(`[agent-executor] openApp(${appId}) did not become active within ${OPEN_APP_TIMEOUT_MS}ms`);
      }
      return;
    }
    // Control actions are handled by the runner, not here.
    case ActionType.ANSWER:
    case ActionType.COMPLETE:
    case ActionType.ABORT:
    case ActionType.INFO:
    case ActionType.NOOP:
      return;
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}
