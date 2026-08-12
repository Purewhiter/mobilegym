/**
 * Visibility-aware timer hooks bound to the app lifecycle.
 *
 * Why: SystemShell keeps backgrounded apps mounted (only hidden), so a plain
 * `setInterval` / `requestAnimationFrame` loop started by a page keeps running
 * after the user leaves the app. Over a long benchmark session those leaked
 * tickers accumulate linearly and waste main-thread time re-rendering
 * invisible pages.
 *
 * These hooks read the current `appId` from `ActivityContext` and subscribe to
 * `AppLifecycle` ('foreground' / 'background' / 'destroy'), keeping the timer
 * alive only while the app is in the foreground (i.e. it is the top activity
 * of the active task).
 *
 * When to use:
 * - `useAppVisibleInterval` — UI tickers / pollers that only matter while the
 *   app is visible (playback progress, countdowns, expiry polling). If the
 *   ticker must catch up after backgrounding, pass `options.onResume`.
 * - `useAppVisibleRaf` — per-frame JS animations. Prefer a pure CSS animation
 *   when possible (zero main-thread cost, no pausing needed); use this hook
 *   only when the animation genuinely needs per-frame JS.
 * - Do NOT use these for logic that must keep running while the app is
 *   backgrounded — keep such logic in the OS layer / services instead.
 *
 * Degraded mode: when rendered without an activity context (`appId` is empty,
 * e.g. in unit tests or non-OS hosts), the hooks fall back to a plain
 * always-on interval / rAF loop and `console.warn` once per hook. In SSR
 * (no `window`) they do nothing, matching plain effect-based timers.
 */
import { useEffect, useRef } from 'react';
import { useActivityContext } from '../ActivityContext';
import { AppLifecycle } from '../AppLifecycle';
import { TaskManager } from '../TaskManager';
import { getActiveAppId } from '../taskUtils';
import { realNow } from '../TimeService';

const degradedWarned = new Set<string>();

function warnDegradedOnce(hookName: string): void {
  if (degradedWarned.has(hookName)) return;
  degradedWarned.add(hookName);
  console.warn(
    `[${hookName}] No activity/lifecycle context (empty appId); falling back to an always-on timer.`,
  );
}

/**
 * Best-effort initial foreground check. `AppLifecycle` only emits transitions,
 * so on mount we read the current active app synchronously from TaskManager
 * (window.__OS__.state lags one render behind and must not be used as a
 * source of truth). In standalone hosts without an OS shell the task list is
 * empty, so we assume foreground and behavior degrades to a plain timer.
 */
function isAppForeground(appId: string): boolean {
  const activeAppId = getActiveAppId(TaskManager.getState());
  if (activeAppId === null) return true;
  return activeAppId === appId;
}

export interface UseAppVisibleIntervalOptions {
  /**
   * Invoked once when the app returns to the foreground while the interval is
   * enabled, with the real wall-clock milliseconds spent in the background
   * (`TimeService.realNow()` based). Use it to compensate for missed ticks,
   * e.g. advance a progress counter by the elapsed time or run an immediate
   * poll. Called before the regular interval restarts.
   */
  onResume?: (backgroundElapsedMs: number) => void;
}

/**
 * `setInterval` that only runs while the owning app is in the foreground.
 * Pauses automatically on 'background' / 'destroy' and resumes (restarting the
 * interval phase from zero) on 'foreground'.
 *
 * @param callback Tick handler; always reads the latest render's closure (kept
 *   in a ref), so it is safe to reference fresh props/state inside.
 * @param ms Tick period in milliseconds, or `null` to disable the interval
 *   entirely (e.g. `isPlaying ? 1000 : null`).
 * @param options See {@link UseAppVisibleIntervalOptions}.
 */
export function useAppVisibleInterval(
  callback: () => void,
  ms: number | null,
  options?: UseAppVisibleIntervalOptions,
): void {
  const { appId } = useActivityContext();
  const callbackRef = useRef(callback);
  const onResumeRef = useRef(options?.onResume);
  callbackRef.current = callback;
  onResumeRef.current = options?.onResume;

  useEffect(() => {
    if (ms == null || typeof window === 'undefined') return;

    let intervalId: number | null = null;
    const start = () => {
      if (intervalId != null) return;
      intervalId = window.setInterval(() => callbackRef.current(), ms);
    };
    const stop = () => {
      if (intervalId == null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    if (!appId) {
      warnDegradedOnce('useAppVisibleInterval');
      start();
      return stop;
    }

    let backgroundedAt: number | null = null;
    if (isAppForeground(appId)) {
      start();
    } else {
      backgroundedAt = realNow();
    }

    const unsubscribe = AppLifecycle.subscribe(appId, (event) => {
      if (event === 'foreground') {
        if (backgroundedAt != null) {
          const elapsedMs = realNow() - backgroundedAt;
          backgroundedAt = null;
          onResumeRef.current?.(elapsedMs);
        }
        start();
        return;
      }
      // 'background' | 'destroy'
      if (backgroundedAt == null) backgroundedAt = realNow();
      stop();
    });

    return () => {
      stop();
      unsubscribe();
    };
  }, [appId, ms]);
}

/**
 * `requestAnimationFrame` loop that only runs while the owning app is in the
 * foreground. Cancels the pending frame on 'background' / 'destroy' and
 * restarts the loop on 'foreground'.
 *
 * Note for consumers computing per-frame deltas from the rAF timestamp: after
 * a resume the first delta spans the whole background period, so clamp it
 * (e.g. `Math.min(50, dt)`) just as you would for a dropped-frames hiccup.
 *
 * @param callback Per-frame handler receiving the rAF timestamp; always reads
 *   the latest render's closure (kept in a ref).
 */
export function useAppVisibleRaf(callback: (time: DOMHighResTimeStamp) => void): void {
  const { appId } = useActivityContext();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;
    const loop = (time: DOMHighResTimeStamp) => {
      rafId = window.requestAnimationFrame(loop);
      callbackRef.current(time);
    };
    const start = () => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      if (rafId == null) return;
      window.cancelAnimationFrame(rafId);
      rafId = null;
    };

    if (!appId) {
      warnDegradedOnce('useAppVisibleRaf');
      start();
      return stop;
    }

    if (isAppForeground(appId)) start();

    const unsubscribe = AppLifecycle.subscribe(appId, (event) => {
      if (event === 'foreground') start();
      else stop();
    });

    return () => {
      stop();
      unsubscribe();
    };
  }, [appId]);
}
