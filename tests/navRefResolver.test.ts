/**
 * scripts/lib/nav_ref_resolver.mjs — ref 路径 DSL 单元测试
 *
 * 覆盖四种 token 取数模式（[field={param}] / [field=value]、[field!=value] /
 * {param} / 字段访问）、bound param 缺失的 null 语义，以及 applyFilterFn 的
 * "出错保守保留" 语义（filterFn 抛错 → item 保留；非法 filterFn → 原数组）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseRefTokens,
  parseStaticValue,
  resolveRefData,
  refNeedsParams,
  applyFilterFn,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — 纯 JS 模块（scripts/ 不在 tsc 范围），无类型声明
} from '../scripts/lib/nav_ref_resolver.mjs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseRefTokens', () => {
  it('拆分字段访问与方括号 token（方括号内的点不分段）', () => {
    expect(parseRefTokens('users[id={userId}].recentBooks')).toEqual([
      'users',
      '[id={userId}]',
      'recentBooks',
    ]);
    expect(parseRefTokens('a.b.c')).toEqual(['a', 'b', 'c']);
  });
});

describe('parseStaticValue', () => {
  it('true/false/数字/字符串的类型化', () => {
    expect(parseStaticValue('true')).toBe(true);
    expect(parseStaticValue('false')).toBe(false);
    expect(parseStaticValue('42')).toBe(42);
    expect(parseStaticValue('abc')).toBe('abc');
  });
});

describe('resolveRefData', () => {
  const data = {
    users: [
      { id: 'u1', name: 'Alice', vip: true, recentBooks: ['b1', 'b2'] },
      { id: 'u2', name: 'Bob', vip: false, recentBooks: [] },
    ],
    booksById: {
      b1: { title: 'One' },
    },
    counts: [
      { kind: 'a', n: 1 },
      { kind: 'b', n: 2 },
      { kind: 'a', n: 3 },
    ],
  };

  it('Pattern 1: [field={param}] 参数化查找单元素（String 化比较）', () => {
    expect(resolveRefData('users[id={userId}].name', { userId: 'u1' }, data)).toBe('Alice');
  });

  it('Pattern 1: bound param 缺失 → null', () => {
    expect(resolveRefData('users[id={userId}].name', {}, data)).toBeNull();
    expect(resolveRefData('users[id={userId}].name', undefined as never, data)).toBeNull();
  });

  it('Pattern 1: 作用对象非数组 → null', () => {
    expect(resolveRefData('booksById[id={bookId}]', { bookId: 'b1' }, data)).toBeNull();
  });

  it('Pattern 2: [field=value] / [field!=value] 静态过滤子集（含类型化值）', () => {
    expect(resolveRefData('counts[kind=a]', {}, data)).toEqual([
      { kind: 'a', n: 1 },
      { kind: 'a', n: 3 },
    ]);
    expect(resolveRefData('counts[kind!=a]', {}, data)).toEqual([{ kind: 'b', n: 2 }]);
    expect(resolveRefData('users[vip=true]', {}, data)).toHaveLength(1);
    expect(resolveRefData('counts[n=2]', {}, data)).toEqual([{ kind: 'b', n: 2 }]);
  });

  it('Pattern 3: {param} 对象索引；param 缺失 → null', () => {
    expect(resolveRefData('booksById.{bookId}.title', { bookId: 'b1' }, data)).toBe('One');
    expect(resolveRefData('booksById.{bookId}.title', {}, data)).toBeNull();
  });

  it('Pattern 4: 链式字段访问；中间缺失 → null', () => {
    expect(resolveRefData('booksById.b1.title', {}, data)).toBe('One');
    expect(resolveRefData('booksById.nope.title', {}, data)).toBeNull();
  });
});

describe('refNeedsParams', () => {
  it('含 {param} 的 ref 需要 bound params，静态 ref 不需要', () => {
    expect(refNeedsParams('users[id={userId}].recentBooks')).toBe(true);
    expect(refNeedsParams('users[vip=true]')).toBe(false);
  });
});

describe('applyFilterFn', () => {
  const data = { threshold: 2 };
  const items = [{ n: 1 }, { n: 2 }, { n: 3 }];

  it('正常过滤：(item, data) => 表达式，可引用根 data', () => {
    expect(applyFilterFn(items, '(item, data) => item.n >= data.threshold', data)).toEqual([
      { n: 2 },
      { n: 3 },
    ]);
  });

  it('filterFn 运行时抛错 → 该 item 保守保留（并走 console.warn 通道）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = applyFilterFn(items, '(item, data) => item.nested.missing > 0', data);
    expect(result).toEqual(items);
    expect(warn).toHaveBeenCalled();
  });

  it('非法 filterFn 字符串（语法错误）→ 返回原数组', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = applyFilterFn(items, '(item, data) => {{{', data);
    expect(result).toEqual(items);
    expect(warn).toHaveBeenCalled();
  });

  it('items 非数组或 filterFn 为空 → 原样返回', () => {
    expect(applyFilterFn(null as never, '(item) => true', data)).toBeNull();
    expect(applyFilterFn(items, '', data)).toBe(items);
  });
});
