import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackDispatcher } from '../os/BackDispatcher';

/**
 * BackDispatcher 行为契约测试。
 *
 * 两个环境事实决定了本文件的脚手架：
 * 1. handlers Map 与帧锁 _backLock 是模块级单例 —— 每个用例注册的 handler
 *    必须在 afterEach 注销，避免污染后续用例。
 * 2. 源码在 handler 消费事件后调用全局 requestAnimationFrame 释放帧锁，
 *    而 vitest node 环境没有 rAF —— 这里用可控的假 rAF 队列代替，
 *    flushFrame() 模拟"进入下一帧"，让帧级去重可以确定性断言。
 */

let frameQueue: Array<() => void> = [];

function flushFrame(): void {
  const callbacks = frameQueue;
  frameQueue = [];
  for (const cb of callbacks) cb();
}

const cleanups: Array<() => void> = [];

function reg(id: string, handler: () => boolean, priority?: number): () => void {
  const unregister = BackDispatcher.register(id, handler, priority);
  cleanups.push(unregister);
  return unregister;
}

beforeEach(() => {
  frameQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    frameQueue.push(cb);
    return frameQueue.length;
  });
});

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!();
  // 若用例消费了 back 但未手动进帧，这里释放帧锁，避免泄漏到下一个用例
  flushFrame();
  vi.unstubAllGlobals();
});

describe('BackDispatcher — 注册与注销', () => {
  it('注销后 handler 不再收到 back 事件', () => {
    const handler = vi.fn(() => true);
    const unregister = reg('page', handler);

    expect(BackDispatcher.handleBack()).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);

    flushFrame();
    unregister();

    expect(BackDispatcher.handleBack()).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('id 为空字符串时注册无效，返回的注销函数可安全调用', () => {
    const handler = vi.fn(() => true);
    const unregister = reg('', handler);

    expect(BackDispatcher.handleBack()).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(() => unregister()).not.toThrow();
  });

  it('handler 不是函数时注册无效', () => {
    const unregister = BackDispatcher.register(
      'bogus',
      'not-a-function' as unknown as () => boolean,
    );
    cleanups.push(unregister);

    expect(BackDispatcher.handleBack()).toBe(false);
  });

  it('用相同 id 重复注册会替换旧 handler', () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    reg('dialog', first);
    reg('dialog', second);

    expect(BackDispatcher.handleBack()).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('过期的注销函数不会误删同 id 的新 handler', () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    const unregisterFirst = reg('dialog', first);
    reg('dialog', second);

    unregisterFirst(); // first 已被 second 替换，这次注销应当是 no-op

    expect(BackDispatcher.handleBack()).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('BackDispatcher — 优先级分发', () => {
  it('高优先级 handler 先收到事件，消费后低优先级不再收到', () => {
    const low = vi.fn(() => true);
    const high = vi.fn(() => true);
    reg('app', low, 100);
    reg('shade', high, 800);

    expect(BackDispatcher.handleBack()).toBe(true);
    expect(high).toHaveBeenCalledTimes(1);
    expect(low).not.toHaveBeenCalled();
  });

  it('handler 返回 false 时事件按优先级降序继续传播', () => {
    const order: string[] = [];
    reg('app', () => { order.push('app'); return false; }, 100);
    reg('dialog', () => { order.push('dialog'); return false; }, 1000);
    reg('shade', () => { order.push('shade'); return false; }, 800);

    expect(BackDispatcher.handleBack()).toBe(false);
    expect(order).toEqual(['dialog', 'shade', 'app']);
  });

  it('中间优先级消费事件后，更低优先级的 handler 不被调用', () => {
    const called: string[] = [];
    reg('dialog', () => { called.push('dialog'); return false; }, 1000);
    reg('shade', () => { called.push('shade'); return true; }, 800);
    reg('app', () => { called.push('app'); return false; }, 100);

    expect(BackDispatcher.handleBack()).toBe(true);
    expect(called).toEqual(['dialog', 'shade']);
  });

  it('同优先级按注册顺序分发', () => {
    const order: string[] = [];
    reg('first', () => { order.push('first'); return false; }, 500);
    reg('second', () => { order.push('second'); return false; }, 500);

    expect(BackDispatcher.handleBack()).toBe(false);
    expect(order).toEqual(['first', 'second']);
  });

  it('同优先级下先注册者消费事件，后注册者不被调用', () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    reg('first', first, 500);
    reg('second', second, 500);

    expect(BackDispatcher.handleBack()).toBe(true);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('未显式指定优先级时默认为 0，低于显式正优先级', () => {
    const order: string[] = [];
    reg('default-priority', () => { order.push('default'); return false; });
    reg('explicit-10', () => { order.push('explicit'); return false; }, 10);

    BackDispatcher.handleBack();
    expect(order).toEqual(['explicit', 'default']);
  });
});

describe('BackDispatcher — 返回值语义', () => {
  it('无任何 handler 时 handleBack 返回 false', () => {
    expect(BackDispatcher.handleBack()).toBe(false);
  });

  it('所有 handler 都拒绝时返回 false，且不进入帧锁（可立即再次分发）', () => {
    const handler = vi.fn(() => false);
    reg('app', handler, 100);

    expect(BackDispatcher.handleBack()).toBe(false);
    // 未消费 → 不加锁 → 第二次调用 handler 仍会收到事件
    expect(BackDispatcher.handleBack()).toBe(false);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe('BackDispatcher — 异常隔离', () => {
  it('某个 handler 抛异常时记录错误并继续向低优先级传播', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const low = vi.fn(() => true);
    reg('broken', () => { throw new Error('boom'); }, 1000);
    reg('app', low, 100);

    expect(BackDispatcher.handleBack()).toBe(true);
    expect(low).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('broken'),
      expect.any(Error),
    );

    consoleError.mockRestore();
  });
});

describe('BackDispatcher — 帧级去重', () => {
  it('消费 back 后同一帧内的第二次 handleBack 被锁跳过', () => {
    const handler = vi.fn(() => true);
    reg('shade', handler, 800);

    expect(BackDispatcher.handleBack()).toBe(true);
    // 同一帧内（rAF 回调尚未执行）：被锁拦下，handler 不会再次收到
    expect(BackDispatcher.handleBack()).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('下一帧释放锁后 handleBack 恢复正常分发', () => {
    const handler = vi.fn(() => true);
    reg('shade', handler, 800);

    expect(BackDispatcher.handleBack()).toBe(true);
    expect(BackDispatcher.handleBack()).toBe(false);

    flushFrame(); // 进入下一帧，rAF 回调释放锁

    expect(BackDispatcher.handleBack()).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('锁生效期间低优先级 handler 也不会收到事件', () => {
    const high = vi.fn(() => true);
    const low = vi.fn(() => true);
    reg('shade', high, 800);
    reg('app', low, 100);

    BackDispatcher.handleBack();
    BackDispatcher.handleBack(); // 帧内第二次：整条链都不应被调用

    expect(high).toHaveBeenCalledTimes(1);
    expect(low).not.toHaveBeenCalled();
  });
});
