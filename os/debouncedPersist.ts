const DEBOUNCE_MS = 300;

/** 直接传字符串，或传惰性序列化回调（在真正写盘时才执行，被防抖覆盖的写入不付序列化成本） */
type PersistValue = string | (() => string);

interface PendingWrite {
  timer: ReturnType<typeof setTimeout>;
  key: string;
  value: PersistValue;
}

const pending = new Map<string, PendingWrite>();

// 写盘失败（典型为 QuotaExceeded）不再静默吞掉：
// - console.warn 一次（模块级去重标志，避免每次 setState 都刷屏）
// - 在 window 上暴露 __STORAGE_QUOTA_EXCEEDED__ = true 供 bench / 外部脚本检测
let persistWriteErrorWarned = false;

function writeItem(key: string, value: PersistValue): void {
  try {
    localStorage.setItem(key, typeof value === 'function' ? value() : value);
  } catch (err) {
    if (typeof window !== 'undefined') {
      window.__STORAGE_QUOTA_EXCEEDED__ = true;
    }
    if (!persistWriteErrorWarned) {
      persistWriteErrorWarned = true;
      console.warn(
        `[debouncedPersist] localStorage write failed (key=${key}), likely QuotaExceeded; `
        + 'further write failures will be silent. window.__STORAGE_QUOTA_EXCEEDED__ is set.',
        err,
      );
    }
  }
}

// Reset gate: 一旦 OSContext._resetStateCore 进入, 设为 true。
// 之后任何路径的 flushAll (含 beforeunload 触发的) 都跳过 setItem, 防止 reset 期间
// 异步 effect 排进 pending 的写入被 page.goto 触发的 beforeunload 落到 localStorage。
// 模块级别 — page reload 后新文档重新加载本模块, flag 自动回到 false。
let resetInProgress = false;

export function beginPersistReset(): void {
  resetInProgress = true;
}

export function endPersistReset(): void {
  resetInProgress = false;
}

/**
 * 防抖写入 localStorage。300ms 内多次调用只执行最后一次。
 * 所有 OS 系统服务和 App store 共用同一套防抖队列。
 *
 * 注意：不使用 requestIdleCallback，因为 idle callback 无法被
 * immediateSetItem/cancelPending/flushAll 取消，会导致旧值回写覆盖新值。
 * 300ms setTimeout 本身已提供足够的主线程让步。
 */
export function debouncedSetItem(key: string, value: PersistValue): void {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pending.delete(key);
    if (resetInProgress) return;  // gate 开启时, 异步 fire 的 timer 也丢弃写入
    writeItem(key, value);
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
  if (resetInProgress) return;  // gate 期间不写盘, 跟 debouncedSetItem / flushAll 同步
  writeItem(key, value);
}

/**
 * 立即执行所有待写入的防抖操作。
 * 必须在 window.location.reload() 前调用，否则防抖中的数据会丢失。
 *
 * 例外: 处于 resetInProgress (reset gate 开启) 时, 把 pending 全清掉但**不写**
 * localStorage — 防止 reset 期间 effect 排进的 stale state 通过 beforeunload
 * flushAll 落盘污染下个 page 的 hydrate。
 */
export function flushAll(): void {
  if (resetInProgress) {
    for (const [, entry] of pending) clearTimeout(entry.timer);
    pending.clear();
    return;
  }
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
    writeItem(entry.key, entry.value);
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
 * 丢弃所有待写入的 debounce 写操作（不落盘）。
 * 用于 reset / __SIM__.resetState：必须在 localStorage.clear() 前调用，
 * 否则 300ms 内未落盘的脏数据会在 clear 之后 fire 写回，
 * 之后 page reload rehydrate 会读到脏值。
 */
export function cancelAllPending(): void {
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
  }
  pending.clear();
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
    if (resetInProgress) return;  // gate 期间不写盘, 跟其他四条路径同步
    writeItem(existing.key, existing.value);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushAll);
}
