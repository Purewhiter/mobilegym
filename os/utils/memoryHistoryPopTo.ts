import { getTracker } from './memoryHistoryTracker';

/**
 * 按候选顺序在历史栈里查找第一个匹配的 pathname，并 popTo 到它。
 * 常用于"Up 导航"语义——一个子页可能从多个父页进入，按声明顺序尝试落到最合适的父页。
 *
 * inclusive=false（默认）：保留目标条目，落点即为该条目；
 * inclusive=true：连同目标条目一起 pop，落点为其下方一条。
 *
 * 返回是否成功 popTo 了某个候选；返回 false 时调用方通常 fallback 到单步 `back()`。
 */
export function memoryHistoryPopToFirstMatch(
  navigator: unknown,
  pathnames: readonly string[],
  options?: { inclusive?: boolean },
): boolean {
  for (const pathname of pathnames) {
    const mem = navigator as { go?: (delta: number) => void } | null;
    if (!mem || typeof mem.go !== 'function') return false;
    const tracker = getTracker(mem as object);
    if (!tracker) return false;
    const delta = tracker.findPopToDelta(pathname, options?.inclusive ?? false);
    if (delta > 0) {
      memoryHistoryPopTo(navigator, pathname, options);
      return true;
    }
  }
  return false;
}

/**
 * Pop back through the MemoryRouter history to a target pathname.
 *
 * Uses the shadow HistoryTracker (synced via useEffect in useAppNavigationHandler)
 * to search backwards through the stack, then calls `navigator.go(-delta)`.
 *
 * The caller is expected to call `navigate(targetUrl)` AFTER this function returns,
 * which will push/replace at the new position. MemoryHistory's `push()` automatically
 * trims forward entries, so stale entries are cleaned up on the next push.
 *
 * - `popTo` containing '?' matches full path+search
 * - otherwise matches pathname only
 */
export function memoryHistoryPopTo(
  navigator: unknown,
  popTo: string,
  options?: { inclusive?: boolean },
): void {
  const mem = navigator as { go?: (delta: number) => void } | null;
  if (!mem || typeof mem.go !== 'function') return;

  const tracker = getTracker(mem as object);
  if (!tracker) return;

  const delta = tracker.findPopToDelta(popTo, options?.inclusive ?? false);
  if (delta <= 0) return;

  mem.go(-delta);
  // Keep the shadow tracker in sync immediately — the React-level sync
  // will also fire after re-render, but the caller may call navigate()
  // (which triggers findPopToDelta again) before the next render cycle.
  tracker.index = Math.max(0, tracker.index - delta);
  tracker.stack.length = tracker.index + 1;
}
