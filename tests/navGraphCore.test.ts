/**
 * scripts/lib/nav_graph_core.mjs — 图元语义单元测试
 *
 * 锁定输出字节序相关的关键语义：
 *   - buildNodeId 的 queryParams `k=:k` 占位与排序稳定性（决定节点 ID 字面量）
 *   - serializeSearch 的键排序稳定性（决定 uiState 索引 key）
 *   - expandFromConstraint 的 '*'（键必须存在）/ null（键必须不存在）语义
 *   - resolveTargetNodeId 的 `#missing-route` 后缀
 */
import { describe, expect, it } from 'vitest';
import {
  matchFromConstraint,
  buildNodeId,
  normalizeSearch,
  serializeSearch,
  resolveTargetNodeId,
  resolveSourceNodeId,
  expandFromConstraint,
  determineEdgeType,
  applyPreserveParamsToSearch,
  normalizeEntryPointDeclaration,
  buildConcreteNodeId,
  pathHasParams,
  extractPathParams,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — 纯 JS 模块（scripts/ 不在 tsc 范围），无类型声明
} from '../scripts/lib/nav_graph_core.mjs';

describe('buildNodeId', () => {
  it('无 search/queryParams → 纯 path', () => {
    expect(buildNodeId('/home', {}, {})).toBe('/home');
  });

  it('search 按插入序、queryParams 以 k=:k 占位并按键名排序追加', () => {
    expect(buildNodeId('/search', { tab: 'all' }, { q: {}, city: {} })).toBe(
      '/search?tab=all&city=:city&q=:q',
    );
  });
});

describe('normalizeSearch / serializeSearch', () => {
  it('normalizeSearch 剔除 null/undefined 值', () => {
    expect(normalizeSearch({ a: '1', b: null, c: undefined })).toEqual({ a: '1' });
  });

  it('serializeSearch 按键名 localeCompare 排序，输出稳定', () => {
    expect(serializeSearch({ b: '2', a: '1' })).toBe('a=1&b=2');
    expect(serializeSearch({ a: '1', b: '2' })).toBe('a=1&b=2');
    expect(serializeSearch({})).toBe('');
  });
});

describe('resolveTargetNodeId', () => {
  const stateIndex = new Map([['/list', new Map([['tab=hot', '/list?tab=hot']])]]);
  const routeIndex = new Map([
    ['/list', { path: '/list' }],
    ['/search', { path: '/search', queryParams: { q: {} } }],
  ]);

  it('命中 stateIndex 时返回登记的 nodeId', () => {
    expect(resolveTargetNodeId('/list', { tab: 'hot' }, stateIndex, routeIndex)).toBe(
      '/list?tab=hot',
    );
  });

  it('路由存在但状态未登记 → 以 queryParams 构造占位 ID', () => {
    expect(resolveTargetNodeId('/search', {}, stateIndex, routeIndex)).toBe('/search?q=:q');
  });

  it('路由缺失 → 追加 #missing-route 后缀', () => {
    expect(resolveTargetNodeId('/nope', {}, stateIndex, routeIndex)).toBe('/nope#missing-route');
  });
});

describe('matchFromConstraint / expandFromConstraint', () => {
  it("'*' 匹配一切；字符串按 path 精确匹配", () => {
    expect(matchFromConstraint('*', '/a', {})).toBe(true);
    expect(matchFromConstraint('/a', '/a', {})).toBe(true);
    expect(matchFromConstraint('/a', '/b', {})).toBe(false);
  });

  it("search 约束：'*'=键必须存在、null=键必须不存在、其他=精确匹配", () => {
    const c = { path: '/p', search: { tab: '*', modal: null, sort: 'hot' } };
    expect(matchFromConstraint(c, '/p', { tab: 'x', sort: 'hot' })).toBe(true);
    expect(matchFromConstraint(c, '/p', { sort: 'hot' })).toBe(false); // tab 缺失
    expect(matchFromConstraint(c, '/p', { tab: 'x', modal: 'open', sort: 'hot' })).toBe(false); // modal 存在
    expect(matchFromConstraint(c, '/p', { tab: 'x', sort: 'new' })).toBe(false); // sort 不匹配
  });

  it('expandFromConstraint：通配 tab 按 uiStates 展开为具体约束，保 null 语义', () => {
    const routeIndex = new Map([
      [
        '/p',
        {
          path: '/p',
          uiStates: [
            { id: 'a', search: { tab: 'a' } },
            { id: 'a-modal', search: { tab: 'a', modal: 'open' } },
            { id: 'nosearch', search: {} },
          ],
        },
      ],
    ]);
    const out = expandFromConstraint(
      { path: '/p', search: { tab: '*', modal: null } },
      new Map(),
      routeIndex,
    );
    // 仅 tab=a（无 modal）命中：tab 通配要求键存在，modal:null 要求键不存在
    expect(out).toEqual([{ path: '/p', search: { tab: 'a' } }]);
  });

  it('expandFromConstraint：无通配 / 无法展开时原样返回', () => {
    expect(expandFromConstraint('/p', new Map(), new Map())).toEqual(['/p']);
    const c = { path: '/p', search: { tab: 'a' } };
    expect(expandFromConstraint(c, new Map(), new Map())).toEqual([c]);
    const wild = { path: '/unknown', search: { tab: '*' } };
    expect(expandFromConstraint(wild, new Map(), new Map())).toEqual([wild]);
  });
});

describe('resolveSourceNodeId', () => {
  const routeIndex = new Map([['/p', { path: '/p' }]]);

  it("'*' 原样返回；带通配 search 的对象返回 fromToString 形式虚拟源", () => {
    expect(resolveSourceNodeId('*', new Map(), routeIndex)).toBe('*');
    expect(
      resolveSourceNodeId({ path: '/p', search: { tab: '*' } }, new Map(), routeIndex),
    ).toBe('/p?tab=*');
  });

  it('无通配 → 走 resolveTargetNodeId 归一化', () => {
    expect(resolveSourceNodeId('/p', new Map(), routeIndex)).toBe('/p');
    expect(
      resolveSourceNodeId({ path: '/p', search: { tab: 'a' } }, new Map(), routeIndex),
    ).toBe('/p?tab=a');
  });
});

describe('杂项语义', () => {
  it('determineEdgeType：pathname 变化=navigation，仅 query 变化=state', () => {
    expect(determineEdgeType('/a', '/b')).toBe('navigation');
    expect(determineEdgeType('/a?x=1', '/a?x=2')).toBe('state');
    expect(determineEdgeType('/a', undefined)).toBe('state');
  });

  it('applyPreserveParamsToSearch：仅拷贝源上存在的键', () => {
    expect(applyPreserveParamsToSearch({ a: '1' }, ['q', 'city'], { q: 'x' })).toEqual({
      a: '1',
      q: 'x',
    });
    const base = { a: '1' };
    expect(applyPreserveParamsToSearch(base, [], { q: 'x' })).toBe(base);
  });

  it('normalizeEntryPointDeclaration：四个枚举 + 非法值 throw', () => {
    expect(normalizeEntryPointDeclaration('home')).toEqual({
      kind: 'home',
      home: true,
      deepLink: false,
    });
    expect(normalizeEntryPointDeclaration('both')).toEqual({
      kind: 'both',
      home: true,
      deepLink: true,
    });
    expect(normalizeEntryPointDeclaration('none').home).toBe(false);
    expect(() => normalizeEntryPointDeclaration(undefined)).toThrow(/Invalid route\.entryPoint/);
  });

  it('路径参数工具：pathHasParams / extractPathParams / buildConcreteNodeId', () => {
    expect(pathHasParams('/book/:bookId')).toBe(true);
    expect(pathHasParams('/book')).toBe(false);
    expect(extractPathParams('/b/:x/c/:y')).toEqual(['x', 'y']);
    expect(buildConcreteNodeId('/book/:bookId?tab=a', { bookId: 'b1' }, {})).toBe(
      '/book/b1?tab=a',
    );
  });
});
