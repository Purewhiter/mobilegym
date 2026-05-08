/**
 * Shadow history tracker for MemoryRouter.
 *
 * react-router-dom v7 的 MemoryHistory 不再暴露 `entries` 数组（只有 `index` getter），
 * 导致无法从 navigator 上直接读取历史栈。本模块维护一份与 MemoryHistory 同步的影子栈，
 * 供 `memoryHistoryPopTo` 在栈中搜索目标路径并计算 go(-delta)。
 *
 * 同步方式：通过 useEffect 监听 location 变化，利用 navigator.index（可靠可用）
 * 判断 push / replace / pop，更新影子栈。
 */

interface StackEntry {
  pathname: string;
  search: string;
}

export class HistoryTracker {
  stack: StackEntry[];
  index: number;

  constructor(initial: StackEntry, initialIndex: number) {
    // If the tracker is created when navigator.index > 0 (e.g. App mounts
    // after several routes have been pushed), entries before initialIndex
    // are unknown — they're filled with empty placeholders that findPopToDelta
    // will skip. These slots get populated if the user navigates back through
    // them (the POP branch in sync() overwrites with real location data).
    this.stack = [];
    for (let i = 0; i < initialIndex; i++) {
      this.stack.push({ pathname: '', search: '' });
    }
    this.stack.push(initial);
    this.index = initialIndex;
  }

  sync(location: StackEntry, navIndex: number) {
    if (navIndex > this.index) {
      // PUSH — trim forward entries, append new
      this.stack.length = this.index + 1;
      while (this.stack.length < navIndex) {
        this.stack.push({ pathname: '', search: '' });
      }
      this.stack.push(location);
      this.index = navIndex;
    } else if (navIndex === this.index) {
      // REPLACE — update entry at current index
      this.stack[this.index] = location;
    } else {
      // POP / go(-n). Overwrite with current location as a self-healing
      // measure: normally the value matches the original entry, but if the
      // tracker drifted (e.g. timing edge case or placeholder slot), this
      // corrects it with the authoritative location from React Router.
      this.index = navIndex;
      if (this.index >= 0 && this.index < this.stack.length) {
        this.stack[this.index] = location;
      }
    }
  }

  /**
   * Search backwards from current index for a matching pathname (or full path+search).
   * Returns the number of steps to go() back; 0 = already there, -1 = not found.
   */
  findPopToDelta(target: string, inclusive: boolean): number {
    const wantFull = target.includes('?');
    for (let i = this.index; i >= 0; i--) {
      const entry = this.stack[i];
      if (!entry || (!entry.pathname && !entry.search)) continue;
      const full = entry.search
        ? `${entry.pathname}${entry.search}`
        : entry.pathname;
      const match = wantFull ? full === target : entry.pathname === target;
      if (match) {
        const baseIndex = inclusive ? Math.max(0, i - 1) : i;
        return this.index - baseIndex;
      }
    }
    return -1;
  }
}

const trackers = new WeakMap<object, HistoryTracker>();

/**
 * Sync the shadow tracker with the actual MemoryHistory state.
 * Call this in a useEffect that depends on [navigator, location.key].
 */
export function syncTracker(
  navigator: object,
  location: { pathname: string; search: string },
): void {
  const navIndex = (navigator as any).index;
  if (typeof navIndex !== 'number') return;

  let tracker = trackers.get(navigator);
  if (!tracker) {
    tracker = new HistoryTracker(
      { pathname: location.pathname, search: location.search || '' },
      navIndex,
    );
    trackers.set(navigator, tracker);
    return;
  }

  tracker.sync(
    { pathname: location.pathname, search: location.search || '' },
    navIndex,
  );
}

export function getTracker(navigator: object): HistoryTracker | undefined {
  return trackers.get(navigator);
}
