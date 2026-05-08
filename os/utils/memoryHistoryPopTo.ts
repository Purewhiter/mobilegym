import { getTracker } from './memoryHistoryTracker';

const BANK_CARDS_PARENT_PATHS = ['/settings/payment/bank-cards', '/bank-cards'] as const;

/**
 * 自栈顶向下查找首个匹配的 pathname，并回退到该条目（不含 inclusive 语义时落点即为该页）。
 * 用于「添加银行卡」等子流程结束后回到列表页，避免 replace 后栈中仍残留 /add 导致返回错乱。
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

/** 支付宝银行卡：自「我的-银行卡」或「支付设置-银行卡」进入添卡流程时的统一回退目标顺序 */
export function memoryHistoryPopToAlipayBankCardsList(navigator: unknown): boolean {
  return memoryHistoryPopToFirstMatch(navigator, BANK_CARDS_PARENT_PATHS, { inclusive: false });
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
