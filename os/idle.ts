/**
 * Idle detection: "the screen has caught up with the last input".
 *
 * Replaces fixed post-action sleeps. The page counts as idle when, all at once:
 *   - no device-server request or data refresh is in flight (DeviceClient);
 *   - no page fetch, app chunk load, or other registered busy work is pending
 *     (e.g. the single-tap timer that waits out the double-tap window);
 *   - no short `setTimeout` (≤ 1 s: debounces, deferred UI updates) is armed;
 *     longer timers and intervals are ambient (carousels, clocks) and ignored;
 *   - no finite CSS animation/transition is running (infinite ones are ambient);
 *   - every image inside the viewport has finished loading;
 *   - web fonts are ready;
 *   - the DOM has not changed for `quietMs`.
 * After that, two more frames so the final state is painted. `timeoutMs` caps
 * the wait for pages that never settle (tickers, video); the result says why.
 */

import * as TimeService from './TimeService';
import { DeviceClient } from './device/DeviceClient';

// The page's own timers are tracked below; idle bookkeeping uses the originals.
const rawSetTimeout = globalThis.setTimeout.bind(globalThis) as (handler: TimerHandler, ms?: number, ...args: unknown[]) => any;
const rawClearTimeout = globalThis.clearTimeout.bind(globalThis) as (id?: unknown) => void;

// ── Busy work ──────────────────────────────────────────────────────

let busyCount = 0;

/** Count `work` as pending input handling until it settles. */
export function holdBusy(work: Promise<unknown>): void {
  busyCount += 1;
  const done = () => {
    busyCount -= 1;
  };
  work.then(done, done);
}

/** Count the next `ms` as busy (a timer that will fire a UI change). */
export function holdBusyFor(ms: number): void {
  holdBusy(new Promise(resolve => rawSetTimeout(resolve, ms)));
}

// ── Short timers ───────────────────────────────────────────────────

const SHORT_TIMER_MS = 1000;
const shortTimers = new Set<unknown>();
let timersTracked = false;

/** Count armed page timers of ≤ 1 s (debounced searches, deferred updates). */
function trackTimers(): void {
  if (timersTracked || typeof window === 'undefined') return;
  timersTracked = true;
  window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    const ms = Number(delay) || 0;
    if (ms <= 0 || ms > SHORT_TIMER_MS || typeof handler !== 'function') {
      return rawSetTimeout(handler as any, delay, ...args);
    }
    const id = rawSetTimeout(() => {
      shortTimers.delete(id);
      (handler as (...a: unknown[]) => void)(...args);
    }, ms);
    shortTimers.add(id);
    return id;
  }) as unknown as typeof window.setTimeout;
  window.clearTimeout = ((id?: number) => {
    shortTimers.delete(id);
    rawClearTimeout(id);
  }) as unknown as typeof window.clearTimeout;
}

// ── Network ────────────────────────────────────────────────────────

let fetchTracked = false;

/** Count every in-flight page fetch (app data, JSON, assets) as busy. */
function trackFetches(): void {
  if (fetchTracked || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  fetchTracked = true;
  const original = window.fetch.bind(window);
  window.fetch = (...args: Parameters<typeof fetch>) => {
    const pending = original(...args);
    holdBusy(pending);
    return pending;
  };
}

// ── DOM quiet tracking ─────────────────────────────────────────────

let lastMutationAt = 0;
let observer: MutationObserver | null = null;

trackFetches();
trackTimers();

function ensureObserver(): void {
  if (observer || typeof MutationObserver === 'undefined' || !document.body) return;
  observer = new MutationObserver(() => {
    lastMutationAt = TimeService.realNow();
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  lastMutationAt = TimeService.realNow();
}

// ── Checks ─────────────────────────────────────────────────────────

function runningFiniteAnimations(): number {
  if (typeof document.getAnimations !== 'function') return 0;
  let count = 0;
  for (const animation of document.getAnimations()) {
    if (animation.playState !== 'running') continue;
    const end = animation.effect?.getComputedTiming().endTime;
    if (typeof end === 'number' && Number.isFinite(end)) count += 1;
  }
  return count;
}

function pendingViewportImages(): number {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let count = 0;
  for (const img of Array.from(document.images)) {
    if (img.complete || !img.src) continue;
    const r = img.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) continue;
    count += 1;
  }
  return count;
}

export interface IdleState {
  requests: number;
  busy: number;
  timers: number;
  animations: number;
  images: number;
  fonts: boolean;
  quietForMs: number;
}

export function idleState(options: { countAnimations?: boolean } = {}): IdleState {
  ensureObserver();
  return {
    requests: DeviceClient.pending(),
    busy: busyCount,
    timers: shortTimers.size,
    animations: options.countAnimations === false ? 0 : runningFiniteAnimations(),
    images: pendingViewportImages(),
    fonts: typeof document.fonts === 'undefined' || document.fonts.status === 'loaded',
    quietForMs: TimeService.realNow() - lastMutationAt,
  };
}

const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
    // Hidden pages pause rAF; don't let that stall the wait.
    rawSetTimeout(resolve, 34);
  });

export interface WaitForIdleOptions {
  /** DOM must be unchanged this long (ms). */
  quietMs?: number;
  /** Give up after this long (ms) and report the blocking reason. */
  timeoutMs?: number;
}

export interface WaitForIdleResult {
  idle: boolean;
  waitedMs: number;
  /** Which checks were still failing when the wait timed out. */
  blockedBy?: (keyof IdleState)[];
}

export async function waitForIdle(options: WaitForIdleOptions = {}): Promise<WaitForIdleResult> {
  const quietMs = options.quietMs ?? 100;
  const timeoutMs = options.timeoutMs ?? 3000;
  const start = TimeService.realNow();
  const timelineStart = document.timeline?.currentTime ?? null;
  ensureObserver();
  // Let the input's own event handlers run before the first check.
  await nextFrame();
  // Last moment anything was still happening. A finished load is usually
  // followed by a render that builds the tree in memory before touching the
  // DOM, so the quiet window restarts whenever a blocker clears, and a late
  // poll (the main thread was busy) counts as activity too.
  let activityAt = TimeService.realNow();
  for (;;) {
    // A page that produces no frames (hidden/occluded) never advances its
    // animation timeline, so its transitions never finish: don't wait on them.
    const timelineFrozen = TimeService.realNow() - start >= 100
      && (document.timeline?.currentTime ?? null) === timelineStart;
    const s = idleState({ countAnimations: !timelineFrozen });
    const now = TimeService.realNow();
    const blockedBy: (keyof IdleState)[] = [];
    if (s.requests) blockedBy.push('requests');
    if (s.busy) blockedBy.push('busy');
    if (s.timers) blockedBy.push('timers');
    if (s.animations) blockedBy.push('animations');
    if (s.images) blockedBy.push('images');
    if (!s.fonts) blockedBy.push('fonts');
    if (blockedBy.length) activityAt = now;
    if (Math.min(s.quietForMs, now - activityAt) < quietMs) blockedBy.push('quietForMs');
    const waitedMs = now - start;
    if (!blockedBy.length) {
      await nextFrame();
      await nextFrame();
      // Something may have started during those frames (an effect's request, a timer).
      const after = idleState({ countAnimations: !timelineFrozen });
      const startedLate = after.requests || after.busy || after.timers || after.images
        || (!timelineFrozen && after.animations) || after.quietForMs < 34;
      if (!startedLate) return { idle: true, waitedMs: TimeService.realNow() - start };
      activityAt = TimeService.realNow();
      continue;
    }
    if (waitedMs >= timeoutMs) return { idle: false, waitedMs, blockedBy };
    const pollAt = TimeService.realNow();
    await new Promise(resolve => rawSetTimeout(resolve, 16));
    if (TimeService.realNow() - pollAt > 50) activityAt = TimeService.realNow();
  }
}
