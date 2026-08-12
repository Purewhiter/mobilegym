/**
 * scripts/lib/nav_condition_eval.mjs — 12-op 条件求值三态语义测试
 *
 * 每个 op 覆盖 satisfied / unevaluable 两侧；重点锁定：
 *   - and 短路（出现可判定的 false 立即返回，不被后续 unevaluable 污染）
 *   - or 全可判定且全不满足 → false；含 unevaluable 且无真 → unevaluable
 *   - not 的 unevaluable 透传（satisfied 保守为 true）
 *   - memberOf 的 $value / field 两种集合语义
 *   - paramEq 的 "ref 是对象 → 不可判定" 分支
 *   - unevaluable 时 satisfied 的保守取向（除 memberOf/eq 等入参缺失场景外为 true）
 */
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — 纯 JS 模块（scripts/ 不在 tsc 范围），无类型声明
import { evaluateCondition } from '../scripts/lib/nav_condition_eval.mjs';

const data = {
  flags: { darkMode: true, level: 5 },
  favorites: ['b1', 'b2'],
  users: [
    { id: 'u1', vip: true },
    { id: 'u2', vip: false },
  ],
  emptyList: [],
  profile: { nested: { deep: 1 } },
};

const ctx = (boundParams: Record<string, string> = {}) => ({ boundParams, data });

const TRUE_COND = { op: 'always' } as const;
const FALSE_COND = { op: 'notEmpty', ref: 'emptyList' } as const;
const UNEVALUABLE_COND = { op: 'unknownOp' } as const;

describe('缺 condition / 缺 data', () => {
  it('→ unevaluable 且保守 satisfied=true', () => {
    expect(evaluateCondition(null, ctx())).toMatchObject({ satisfied: true, evaluable: false });
    expect(evaluateCondition(TRUE_COND, { boundParams: {}, data: undefined })).toMatchObject({
      satisfied: true,
      evaluable: false,
    });
  });
});

describe('always', () => {
  it('恒真且可判定', () => {
    expect(evaluateCondition(TRUE_COND, ctx())).toEqual({ satisfied: true, evaluable: true });
  });
});

describe('and', () => {
  it('短路：可判定的 false 立即返回 false，即使后面还有 unevaluable 项', () => {
    expect(
      evaluateCondition({ op: 'and', items: [FALSE_COND, UNEVALUABLE_COND] }, ctx()),
    ).toEqual({ satisfied: false, evaluable: true });
  });

  it('全部可判定为真 → true', () => {
    expect(evaluateCondition({ op: 'and', items: [TRUE_COND, TRUE_COND] }, ctx())).toEqual({
      satisfied: true,
      evaluable: true,
    });
  });

  it('有 unevaluable 且没有可判定的 false → unevaluable（保守 true）', () => {
    expect(
      evaluateCondition({ op: 'and', items: [TRUE_COND, UNEVALUABLE_COND] }, ctx()),
    ).toMatchObject({ satisfied: true, evaluable: false });
  });

  it('items 缺失/空 → unevaluable', () => {
    expect(evaluateCondition({ op: 'and' }, ctx())).toMatchObject({ evaluable: false });
    expect(evaluateCondition({ op: 'and', items: [] }, ctx())).toMatchObject({ evaluable: false });
  });
});

describe('or', () => {
  it('任一可判定为真 → 立即 true', () => {
    expect(
      evaluateCondition({ op: 'or', items: [FALSE_COND, TRUE_COND] }, ctx()),
    ).toEqual({ satisfied: true, evaluable: true });
  });

  it('全部可判定且全不满足 → false', () => {
    expect(
      evaluateCondition({ op: 'or', items: [FALSE_COND, FALSE_COND] }, ctx()),
    ).toEqual({ satisfied: false, evaluable: true });
  });

  it('含 unevaluable 且没有真 → unevaluable（保守 true）', () => {
    expect(
      evaluateCondition({ op: 'or', items: [FALSE_COND, UNEVALUABLE_COND] }, ctx()),
    ).toMatchObject({ satisfied: true, evaluable: false });
  });
});

describe('not', () => {
  it('可判定项取反', () => {
    expect(evaluateCondition({ op: 'not', item: FALSE_COND }, ctx())).toEqual({
      satisfied: true,
      evaluable: true,
    });
    expect(evaluateCondition({ op: 'not', item: TRUE_COND }, ctx())).toEqual({
      satisfied: false,
      evaluable: true,
    });
  });

  it('item 不可判定 → unevaluable（不做取反，保守 true）', () => {
    expect(evaluateCondition({ op: 'not', item: UNEVALUABLE_COND }, ctx())).toMatchObject({
      satisfied: true,
      evaluable: false,
    });
  });

  it('item 缺失 → unevaluable', () => {
    expect(evaluateCondition({ op: 'not' }, ctx())).toMatchObject({ evaluable: false });
  });
});

describe('notEmpty / empty', () => {
  it('notEmpty：非空数组 true、空数组 false、非数组可判定 false', () => {
    expect(evaluateCondition({ op: 'notEmpty', ref: 'favorites' }, ctx())).toEqual({
      satisfied: true,
      evaluable: true,
    });
    expect(evaluateCondition({ op: 'notEmpty', ref: 'emptyList' }, ctx())).toEqual({
      satisfied: false,
      evaluable: true,
    });
    expect(evaluateCondition({ op: 'notEmpty', ref: 'flags' }, ctx())).toMatchObject({
      satisfied: false,
      evaluable: true,
    });
  });

  it('notEmpty + filterFn：过滤后为空 → false', () => {
    expect(
      evaluateCondition(
        { op: 'notEmpty', ref: 'users', filterFn: '(item) => item.id === "nope"' },
        ctx(),
      ),
    ).toEqual({ satisfied: false, evaluable: true });
  });

  it('empty：空数组 true、非空 false、非数组可判定 false', () => {
    expect(evaluateCondition({ op: 'empty', ref: 'emptyList' }, ctx())).toEqual({
      satisfied: true,
      evaluable: true,
    });
    expect(evaluateCondition({ op: 'empty', ref: 'favorites' }, ctx())).toEqual({
      satisfied: false,
      evaluable: true,
    });
    expect(evaluateCondition({ op: 'empty', ref: 'flags' }, ctx())).toMatchObject({
      satisfied: false,
      evaluable: true,
    });
  });
});

describe('memberOf', () => {
  it('$value 集合语义（默认 field）', () => {
    expect(
      evaluateCondition({ op: 'memberOf', param: 'bookId', ref: 'favorites' }, ctx({ bookId: 'b1' })),
    ).toEqual({ satisfied: true, evaluable: true });
    expect(
      evaluateCondition({ op: 'memberOf', param: 'bookId', ref: 'favorites' }, ctx({ bookId: 'zz' })),
    ).toEqual({ satisfied: false, evaluable: true });
  });

  it('field 集合语义', () => {
    expect(
      evaluateCondition(
        { op: 'memberOf', param: 'userId', ref: 'users', field: 'id' },
        ctx({ userId: 'u2' }),
      ),
    ).toEqual({ satisfied: true, evaluable: true });
  });

  it('param 声明缺失 / 未 bound / ref 非数组 → unevaluable', () => {
    expect(evaluateCondition({ op: 'memberOf', ref: 'favorites' }, ctx())).toMatchObject({
      evaluable: false,
    });
    expect(
      evaluateCondition({ op: 'memberOf', param: 'bookId', ref: 'favorites' }, ctx()),
    ).toMatchObject({ evaluable: false, reason: 'param bookId not bound' });
    expect(
      evaluateCondition({ op: 'memberOf', param: 'bookId', ref: 'flags' }, ctx({ bookId: 'b1' })),
    ).toMatchObject({ evaluable: false });
  });
});

describe('eq / equals / notEquals（legacy）', () => {
  it('eq：严格 === 比较；缺 equals / ref 不存在 → unevaluable', () => {
    expect(evaluateCondition({ op: 'eq', ref: 'flags.level', equals: 5 }, ctx())).toEqual({
      satisfied: true,
      evaluable: true,
    });
    expect(evaluateCondition({ op: 'eq', ref: 'flags.level', equals: '5' }, ctx())).toEqual({
      satisfied: false,
      evaluable: true,
    });
    expect(evaluateCondition({ op: 'eq', ref: 'flags.level' }, ctx())).toMatchObject({
      evaluable: false,
    });
    expect(evaluateCondition({ op: 'eq', ref: 'flags.nope', equals: 1 }, ctx())).toMatchObject({
      evaluable: false,
      reason: 'ref not found',
    });
  });

  it('equals / notEquals：value 字段版本的严格比较与取反', () => {
    expect(evaluateCondition({ op: 'equals', ref: 'flags.darkMode', value: true }, ctx())).toEqual({
      satisfied: true,
      evaluable: true,
    });
    expect(evaluateCondition({ op: 'equals', ref: 'flags.darkMode' }, ctx())).toMatchObject({
      evaluable: false,
    });
    expect(
      evaluateCondition({ op: 'notEquals', ref: 'flags.darkMode', value: false }, ctx()),
    ).toEqual({ satisfied: true, evaluable: true });
    expect(evaluateCondition({ op: 'notEquals', ref: 'flags.nope', value: 1 }, ctx())).toMatchObject(
      { evaluable: false },
    );
  });
});

describe('paramEq / paramNeq', () => {
  it('String 化比较与取反', () => {
    expect(
      evaluateCondition({ op: 'paramEq', param: 'level', ref: 'flags.level' }, ctx({ level: '5' })),
    ).toEqual({ satisfied: true, evaluable: true });
    expect(
      evaluateCondition({ op: 'paramNeq', param: 'level', ref: 'flags.level' }, ctx({ level: '5' })),
    ).toEqual({ satisfied: false, evaluable: true });
  });

  it('param 缺失 / 未 bound / ref 不存在 → unevaluable', () => {
    expect(evaluateCondition({ op: 'paramEq', ref: 'flags.level' }, ctx())).toMatchObject({
      evaluable: false,
    });
    expect(
      evaluateCondition({ op: 'paramEq', param: 'level', ref: 'flags.level' }, ctx()),
    ).toMatchObject({ evaluable: false });
    expect(
      evaluateCondition({ op: 'paramEq', param: 'level', ref: 'flags.nope' }, ctx({ level: '5' })),
    ).toMatchObject({ evaluable: false, reason: 'ref not found' });
  });

  it('ref 解析为对象（非原始值）→ unevaluable 且保守 satisfied=true', () => {
    expect(
      evaluateCondition({ op: 'paramEq', param: 'x', ref: 'profile.nested' }, ctx({ x: '1' })),
    ).toEqual({ satisfied: true, evaluable: false, reason: 'ref is not primitive' });
  });
});

describe('unknown op', () => {
  it('→ unevaluable 且保守 satisfied=true，reason 带 op 名', () => {
    expect(evaluateCondition({ op: 'nope' }, ctx())).toEqual({
      satisfied: true,
      evaluable: false,
      reason: 'unknown op: nope',
    });
  });
});
