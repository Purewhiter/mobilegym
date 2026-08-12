import { describe, expect, it, vi } from 'vitest';
import {
  HistoryTracker,
  getTracker,
  syncTracker,
} from '../os/utils/memoryHistoryTracker';
import {
  memoryHistoryPopTo,
  memoryHistoryPopToFirstMatch,
} from '../os/utils/memoryHistoryPopTo';

/**
 * 影子历史栈（HistoryTracker）与 popTo 计算的行为契约测试。
 *
 * tracker 全局表是以 navigator 对象为 key 的 WeakMap，
 * 每个用例新建独立的 navigator 对象即可天然隔离，无需清理。
 */

const entry = (pathname: string, search = '') => ({ pathname, search });
const PLACEHOLDER = { pathname: '', search: '' };

/** 模拟 MemoryRouter 逐条 push 后的 navigator + 已同步的影子栈 */
function makeSyncedNav(paths: Array<{ pathname: string; search?: string }>) {
  const nav = { index: 0, go: vi.fn() };
  paths.forEach((p, i) => {
    nav.index = i;
    syncTracker(nav, { pathname: p.pathname, search: p.search ?? '' });
  });
  return nav;
}

describe('HistoryTracker — 构造', () => {
  it('initialIndex=0 时栈只含初始条目', () => {
    const t = new HistoryTracker(entry('/'), 0);
    expect(t.stack).toEqual([entry('/')]);
    expect(t.index).toBe(0);
  });

  it('initialIndex>0 时前面的未知条目用空占位填充', () => {
    const t = new HistoryTracker(entry('/detail'), 2);
    expect(t.stack).toEqual([PLACEHOLDER, PLACEHOLDER, entry('/detail')]);
    expect(t.index).toBe(2);
  });
});

describe('HistoryTracker — sync PUSH', () => {
  it('连续 push 使栈增长且 index 跟随', () => {
    const t = new HistoryTracker(entry('/a'), 0);
    t.sync(entry('/b'), 1);
    t.sync(entry('/c'), 2);
    expect(t.stack).toEqual([entry('/a'), entry('/b'), entry('/c')]);
    expect(t.index).toBe(2);
  });

  it('pop 之后再 push 会裁掉 forward 条目', () => {
    const t = new HistoryTracker(entry('/a'), 0);
    t.sync(entry('/b'), 1);
    t.sync(entry('/c'), 2);
    t.sync(entry('/b'), 1); // go(-1)
    t.sync(entry('/d'), 2); // push 新分支
    expect(t.stack).toEqual([entry('/a'), entry('/b'), entry('/d')]);
    expect(t.index).toBe(2);
  });

  it('index 跳跃式 push 时中间空缺用占位填充', () => {
    const t = new HistoryTracker(entry('/a'), 0);
    t.sync(entry('/z'), 3);
    expect(t.stack).toEqual([entry('/a'), PLACEHOLDER, PLACEHOLDER, entry('/z')]);
    expect(t.index).toBe(3);
  });
});

describe('HistoryTracker — sync REPLACE', () => {
  it('同 index 同步会原位替换当前条目', () => {
    const t = new HistoryTracker(entry('/a'), 0);
    t.sync(entry('/a', '?tab=2'), 0);
    expect(t.stack).toEqual([entry('/a', '?tab=2')]);
    expect(t.index).toBe(0);
  });

  it('连续多次 replace 栈长度不变，保留最后一次的值', () => {
    const t = new HistoryTracker(entry('/a'), 0);
    t.sync(entry('/b'), 0);
    t.sync(entry('/c'), 0);
    t.sync(entry('/d'), 0);
    expect(t.stack).toEqual([entry('/d')]);
    expect(t.index).toBe(0);
  });

  it('replace 只改当前条目，不影响相邻条目', () => {
    const t = new HistoryTracker(entry('/a'), 0);
    t.sync(entry('/b'), 1);
    t.sync(entry('/c'), 2);
    t.sync(entry('/c2'), 2);
    expect(t.stack).toEqual([entry('/a'), entry('/b'), entry('/c2')]);
  });
});

describe('HistoryTracker — sync POP', () => {
  it('pop 回退 index，并用权威 location 覆盖该位置（自愈），forward 条目保留', () => {
    const t = new HistoryTracker(entry('/a'), 0);
    t.sync(entry('/b'), 1);
    t.sync(entry('/c'), 2);
    t.sync(entry('/b', '?healed=1'), 1);
    expect(t.index).toBe(1);
    expect(t.stack[1]).toEqual(entry('/b', '?healed=1'));
    // pop 本身不裁栈，forward 条目等下一次 push 才被裁掉
    expect(t.stack).toHaveLength(3);
    expect(t.stack[2]).toEqual(entry('/c'));
  });

  it('pop 进入占位槽位时用真实 location 补齐', () => {
    const t = new HistoryTracker(entry('/detail'), 2);
    t.sync(entry('/list'), 1); // go(-1) 落入占位槽
    expect(t.stack[1]).toEqual(entry('/list'));
    expect(t.findPopToDelta('/list', false)).toBe(0);
  });
});

describe('HistoryTracker — findPopToDelta', () => {
  function stackABC() {
    const t = new HistoryTracker(entry('/a'), 0);
    t.sync(entry('/b'), 1);
    t.sync(entry('/c'), 2);
    return t;
  }

  it('目标是当前条目时返回 0', () => {
    expect(stackABC().findPopToDelta('/c', false)).toBe(0);
  });

  it('目标在栈下方时返回对应步数', () => {
    const t = stackABC();
    expect(t.findPopToDelta('/b', false)).toBe(1);
    expect(t.findPopToDelta('/a', false)).toBe(2);
  });

  it('目标不存在时返回 -1', () => {
    expect(stackABC().findPopToDelta('/nowhere', false)).toBe(-1);
  });

  it('目标重复出现时命中离当前最近的一个', () => {
    const t = new HistoryTracker(entry('/a'), 0);
    t.sync(entry('/b'), 1);
    t.sync(entry('/a'), 2);
    t.sync(entry('/c'), 3);
    expect(t.findPopToDelta('/a', false)).toBe(1);
  });

  it('inclusive=true 时落点在目标条目下方一条', () => {
    expect(stackABC().findPopToDelta('/b', true)).toBe(2);
  });

  it('inclusive=true 命中栈底条目时钳制到栈底（不会越界）', () => {
    // baseIndex = max(0, -1) = 0，与非 inclusive 相同
    expect(stackABC().findPopToDelta('/a', true)).toBe(2);
  });

  it('单条目栈上 inclusive=true 返回 0', () => {
    const t = new HistoryTracker(entry('/'), 0);
    expect(t.findPopToDelta('/', true)).toBe(0);
  });

  it('目标带 ? 时按 pathname+search 全量匹配', () => {
    const t = new HistoryTracker(entry('/list', '?tab=1'), 0);
    t.sync(entry('/list', '?tab=2'), 1);
    t.sync(entry('/detail'), 2);
    expect(t.findPopToDelta('/list?tab=2', false)).toBe(1);
    expect(t.findPopToDelta('/list?tab=1', false)).toBe(2);
    expect(t.findPopToDelta('/list?tab=9', false)).toBe(-1);
  });

  it('目标不带 ? 时只匹配 pathname，忽略条目的 search', () => {
    const t = new HistoryTracker(entry('/list', '?tab=1'), 0);
    t.sync(entry('/list', '?tab=2'), 1);
    t.sync(entry('/detail'), 2);
    expect(t.findPopToDelta('/list', false)).toBe(1);
  });

  it('占位条目被跳过，空字符串目标也不会命中占位', () => {
    const t = new HistoryTracker(entry('/c'), 2);
    expect(t.findPopToDelta('/c', false)).toBe(0);
    expect(t.findPopToDelta('', false)).toBe(-1);
    expect(t.findPopToDelta('/unknown', false)).toBe(-1);
  });
});

describe('syncTracker / getTracker', () => {
  it('未同步过的 navigator 没有 tracker', () => {
    expect(getTracker({})).toBeUndefined();
  });

  it('navigator.index 不是数字时不创建 tracker', () => {
    const nav = {};
    syncTracker(nav, { pathname: '/a', search: '' });
    expect(getTracker(nav)).toBeUndefined();
  });

  it('首次同步创建 tracker，以当时的 location 和 index 为种子', () => {
    const nav = { index: 0 };
    syncTracker(nav, { pathname: '/a', search: '' });
    const t = getTracker(nav)!;
    expect(t.stack).toEqual([entry('/a')]);
    expect(t.index).toBe(0);
  });

  it('首次同步发生在 index>0 时会补占位', () => {
    const nav = { index: 2 };
    syncTracker(nav, { pathname: '/deep', search: '' });
    expect(getTracker(nav)!.stack).toEqual([PLACEHOLDER, PLACEHOLDER, entry('/deep')]);
  });

  it('后续同步走 push/replace/pop 逻辑更新同一个 tracker', () => {
    const nav = { index: 0 };
    syncTracker(nav, { pathname: '/a', search: '' });
    const t = getTracker(nav)!;

    nav.index = 1;
    syncTracker(nav, { pathname: '/b', search: '' });
    expect(getTracker(nav)).toBe(t);
    expect(t.stack).toEqual([entry('/a'), entry('/b')]);
    expect(t.index).toBe(1);
  });

  it('location.search 缺失时归一化为空字符串', () => {
    const nav = { index: 0 };
    syncTracker(nav, { pathname: '/a' } as { pathname: string; search: string });
    expect(getTracker(nav)!.stack[0]).toEqual(entry('/a'));
  });

  it('不同 navigator 对象各自持有独立 tracker', () => {
    const nav1 = { index: 0 };
    const nav2 = { index: 0 };
    syncTracker(nav1, { pathname: '/one', search: '' });
    syncTracker(nav2, { pathname: '/two', search: '' });
    expect(getTracker(nav1)!.stack[0].pathname).toBe('/one');
    expect(getTracker(nav2)!.stack[0].pathname).toBe('/two');
  });
});

describe('memoryHistoryPopTo', () => {
  it('目标在栈下方时调用 go(-delta) 并立即收缩影子栈', () => {
    const nav = makeSyncedNav([entry('/a'), entry('/b'), entry('/c')]);
    memoryHistoryPopTo(nav, '/a');
    expect(nav.go).toHaveBeenCalledTimes(1);
    expect(nav.go).toHaveBeenCalledWith(-2);
    const t = getTracker(nav)!;
    expect(t.index).toBe(0);
    expect(t.stack).toEqual([entry('/a')]);
  });

  it('inclusive=true 时连目标条目一起 pop', () => {
    const nav = makeSyncedNav([entry('/a'), entry('/b'), entry('/c')]);
    memoryHistoryPopTo(nav, '/b', { inclusive: true });
    expect(nav.go).toHaveBeenCalledWith(-2);
    expect(getTracker(nav)!.stack).toEqual([entry('/a')]);
  });

  it('目标带 ? 时按全路径匹配后 pop', () => {
    const nav = makeSyncedNav([
      entry('/list', '?tab=1'),
      entry('/list', '?tab=2'),
      entry('/detail'),
    ]);
    memoryHistoryPopTo(nav, '/list?tab=1');
    expect(nav.go).toHaveBeenCalledWith(-2);
  });

  it('目标就是当前条目（delta=0）时不调用 go，栈不变', () => {
    const nav = makeSyncedNav([entry('/a'), entry('/b'), entry('/c')]);
    memoryHistoryPopTo(nav, '/c');
    expect(nav.go).not.toHaveBeenCalled();
    const t = getTracker(nav)!;
    expect(t.index).toBe(2);
    expect(t.stack).toHaveLength(3);
  });

  it('目标不存在时不调用 go', () => {
    const nav = makeSyncedNav([entry('/a'), entry('/b')]);
    memoryHistoryPopTo(nav, '/nowhere');
    expect(nav.go).not.toHaveBeenCalled();
  });

  it('navigator 从未同步过（无 tracker）时不调用 go', () => {
    const go = vi.fn();
    memoryHistoryPopTo({ index: 0, go }, '/a');
    expect(go).not.toHaveBeenCalled();
  });

  it('navigator 缺少 go 方法时静默返回不抛错', () => {
    const nav = { index: 0 };
    syncTracker(nav, { pathname: '/a', search: '' });
    expect(() => memoryHistoryPopTo(nav, '/a')).not.toThrow();
    expect(() => memoryHistoryPopTo(null, '/a')).not.toThrow();
  });
});

describe('memoryHistoryPopToFirstMatch', () => {
  it('按候选顺序返回第一个命中的目标并 pop', () => {
    const nav = makeSyncedNav([entry('/a'), entry('/b'), entry('/c')]);
    const ok = memoryHistoryPopToFirstMatch(nav, ['/missing', '/b']);
    expect(ok).toBe(true);
    expect(nav.go).toHaveBeenCalledTimes(1);
    expect(nav.go).toHaveBeenCalledWith(-1);
  });

  it('候选顺序优先于栈内距离：排前面的候选即使更深也先命中', () => {
    const nav = makeSyncedNav([entry('/a'), entry('/b'), entry('/c')]);
    memoryHistoryPopToFirstMatch(nav, ['/a', '/b']);
    expect(nav.go).toHaveBeenCalledWith(-2);
  });

  it('当前条目（delta=0）不算命中，继续尝试后面的候选', () => {
    const nav = makeSyncedNav([entry('/a'), entry('/b'), entry('/c')]);
    const ok = memoryHistoryPopToFirstMatch(nav, ['/c', '/a']);
    expect(ok).toBe(true);
    expect(nav.go).toHaveBeenCalledWith(-2);
  });

  it('inclusive 选项透传到实际的 pop', () => {
    const nav = makeSyncedNav([entry('/a'), entry('/b'), entry('/c')]);
    memoryHistoryPopToFirstMatch(nav, ['/b'], { inclusive: true });
    expect(nav.go).toHaveBeenCalledWith(-2);
  });

  it('所有候选都未命中时返回 false 且不调用 go', () => {
    const nav = makeSyncedNav([entry('/a'), entry('/b')]);
    expect(memoryHistoryPopToFirstMatch(nav, ['/x', '/y'])).toBe(false);
    expect(nav.go).not.toHaveBeenCalled();
  });

  it('候选列表为空时返回 false', () => {
    const nav = makeSyncedNav([entry('/a')]);
    expect(memoryHistoryPopToFirstMatch(nav, [])).toBe(false);
  });

  it('无 tracker 或 navigator 不可用时返回 false', () => {
    expect(memoryHistoryPopToFirstMatch({ index: 0, go: vi.fn() }, ['/a'])).toBe(false);
    expect(memoryHistoryPopToFirstMatch(null, ['/a'])).toBe(false);
    const navWithoutGo = { index: 0 };
    syncTracker(navWithoutGo, { pathname: '/a', search: '' });
    expect(memoryHistoryPopToFirstMatch(navWithoutGo, ['/a'])).toBe(false);
  });
});
