const DEBOUNCE_MS = 300;

interface PendingWrite {
  timer: ReturnType<typeof setTimeout>;
  key: string;
  value: string;
}

const pending = new Map<string, PendingWrite>();

/**
 * 防抖写入 localStorage。300ms 内多次调用只执行最后一次。
 * 所有 OS 系统服务和 App store 共用同一套防抖队列。
 *
 * 注意：不使用 requestIdleCallback，因为 idle callback 无法被
 * immediateSetItem/cancelPending/flushAll 取消，会导致旧值回写覆盖新值。
 * 300ms setTimeout 本身已提供足够的主线程让步。
 */
export function debouncedSetItem(key: string, value: string): void {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pending.delete(key);
    try {
      localStorage.setItem(key, value);
    } catch { /* QuotaExceeded — silently drop */ }
  }, DEBOUNCE_MS);

  pending.set(key, { timer, key, value });
}

/**
 * 立即写入 localStorage（绕过防抖）。
 * 用于 reset / __SIM__.setState fallback 等需要立即落盘的场景。
 */
export function immediateSetItem(key: string, value: string): void {
  const existing = pending.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(key);
  }
  try {
    localStorage.setItem(key, value);
  } catch { /* QuotaExceeded — silently drop */ }
}

/**
 * 立即执行所有待写入的防抖操作。
 * 必须在 window.location.reload() 前调用，否则防抖中的数据会丢失。
 */
export function flushAll(): void {
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
    try {
      localStorage.setItem(entry.key, entry.value);
    } catch { /* QuotaExceeded — silently drop */ }
  }
  pending.clear();
}

export function cancelPending(key: string): void {
  const existing = pending.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(key);
  }
}

/**
 * 立即执行指定 key 的待写入防抖操作。
 * 用于 getState 等需要读取最新数据前，确保 debounced 的写入已落盘。
 */
export function flushKey(key: string): void {
  const existing = pending.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(key);
    try {
      localStorage.setItem(existing.key, existing.value);
    } catch { /* QuotaExceeded — silently drop */ }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushAll);
}
