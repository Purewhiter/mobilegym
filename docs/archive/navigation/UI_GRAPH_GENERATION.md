# UI 图生成

> 本文档描述如何从导航声明（`NavigationDeclaration`）静态生成 UI 状态转移图。
> 
> 前置依赖：[NAVIGATION_DECLARATION_PROPOSAL.md](./NAVIGATION_DECLARATION_PROPOSAL.md)

---

## 一、概述

UI 图是一个有向图，描述应用中所有可达的 UI 状态及其之间的转移关系：

- **节点（Node）**：UI 状态，由 `pathname模板 + 离散query` 唯一标识
- **边（Edge）**：状态转移，由 `TransitionDeclaration` 生成

### 1.1 节点 ID 格式

| 类型 | 格式 | 示例 |
|------|------|------|
| 基础节点 | `routePath` | `/`, `/video/:bvid` |
| 离散状态 | `routePath?key=value` | `/my-reading?tab=week` |
| 多参数状态 | `routePath?key1=v1&key2=v2` | `/bookshelf?select=true&modal=confirm` |

> [!NOTE]
> - **Schema 模式**下动态参数（如 `:bookId`, `:itemId`）在节点 ID 中保留为占位符，不展开为具体值。
> - **Data 模式**下如果提供了 `--data` 且声明了可展开的 `dataSource`，脚本会基于 ConfigData 生成**有限个**具体节点（例如带 `boundParams` 的 `/book/123`），用于验证“在给定数据快照下哪些边/节点真实存在”。

### 1.2 边类型

| 类型 | 说明 |
|------|------|
| `navigation` | 跨页面跳转（routePath 变化） |
| `state` | 同页面状态变更（routePath 不变，仅离散 query 变化） |

### 1.3 图生成模式

脚本支持两种输出模式：

| 模式 | 说明 | 用途 |
|------|------|------|
| **完整图** | 每个 uiState 作为独立节点 | 详细分析、Agent 训练 |
| **简化图** | 合并同一路由的所有 uiState | 快速检查页面间关系 |

---

## 二、类型定义

```typescript
type Mode = 'schema' | 'data';

/** analyzer 输出（schema/data） */
interface UIGraphOutput {
  app: string;
  appDir: string;
  mode: Mode;
  dataFile: string | null;
  /**
   * data 模式：可达性分析结果（从首页入口节点出发）
   * schema 模式：不输出（为 null），但会在控制台 WARN 不可达子图用于排查声明问题
   */
  reachability?: ReachabilityInfo | null;

  /**
   * 节点数（= `nodes.length`；历史字段名 `routeCount`，保留兼容）
   *
   * - schema 模式：`uiStates` 展开后的离散状态节点数
   * - data 模式：dataSource/condition 展开与剪枝后的节点数
   */
  routeCount: number;

  /** 声明中的 transitions 条数（未展开） */
  transitionCount: number;

  nodes: Node[];
  edges: Edge[];
}

/** 可达性分析输出（仅 data 模式会写入 JSON） */
interface ReachabilityInfo {
  /** 首页入口节点（nodes[].entryPoint=true） */
  entryNodes: string[];
  reachableNodeCount: number;
  reachableEdgeCount: number;
  unreachableNodeCount: number;
  unreachableEdgeCount: number;
  /** 不可达节点示例列表（完整列表，按字典序） */
  unreachableNodeIds: string[];
}

/** 图节点（routePath + 离散 query） */
interface Node {
  id: string; // routePath + 离散 query；data-mode 下也可能是具体值（如 /book/123）
  routePath: string; // 所属 pathname 模板（如 /book/:bookId）
  uiStateId: string; // uiStates[].id
  component: string;
  /** 是否为“首页入口”起点节点（由 route.entryPoint='home'|'both' 推导，且默认取 uiStates[0]） */
  entryPoint: boolean;
  /** v1.1：路由级入口语义（用于区分 home vs deepLink；不参与可达性起点） */
  entry?: { kind: 'none' | 'home' | 'deepLink' | 'both'; home: boolean; deepLink: boolean };
  params: Record<string, 'string' | 'number'>;
  queryParams: Record<string, 'string' | 'number'>;
  scrollContainers?: ScrollContainerDeclaration[];
  description?: string;
  search: Record<string, string>;

  /** v0.5+：节点存在条件（可选；v0.8 支持组合条件/参数对比） */
  stateCondition?: StateCondition;
  /** data-mode：节点绑定的具体参数（可选） */
  boundParams?: Record<string, string>;
}

/** 图边（由 TransitionDeclaration 展开得到） */
interface Edge {
  source: string;
  sourceNodeId?: string;
  target: string;
  targetNodeId?: string;
  id: string; // transition id
  label?: string;
  type: 'navigation' | 'state';
  mode?: 'push' | 'replace';
  when?: Condition; // 条件分支的条件（cases）
  search?: Record<string, string | null>;
  searchParams?: Record<string, 'string' | 'number'>;
  params?: Record<string, 'string' | 'number'>;
  preserveParams?: string[];
  fromConstraint?: FromConstraint;
  expandedFrom?: 'searchParams' | 'wildcard';

  /** v0.5+：入口显示条件（可选，来自 transition.ui.condition；v0.8 支持组合条件/参数对比） */
  uiCondition?: StateCondition;
  /** v0.6：入口 UI 元信息（用于 viewer 展示） */
  uiMeta?: { placement: string; icon: string; gesture: string };
  
  /**
   * v0.5：参数绑定信息（data 模式）
   * 
   * 记录每个动态参数的绑定来源：
   * - dataSource: 从数据源展开获取
   * - inherited: 从源节点继承
   * - unbound: 无法确定（保持占位符）
   */
  binding?: Record<string, ParamBinding>;
}

/** 参数绑定结构 */
type ParamBinding = 
  | { source: 'dataSource'; value: string }   // 从数据源获取的具体值
  | { source: 'inherited'; value: string }    // 从源节点继承的具体值
  | { source: 'unbound' };                    // 无具体值
```

> [!NOTE]
> 当前 analyzer **不再输出 `issues` 数组**。除非遇到致命错误（文件缺失、TS 转译失败、`entryPoint` 非法、data 文件不存在等），否则会继续输出 JSON，并通过控制台 `WARN(schema)` / `WARN` 提示不可达子图或边指向缺失节点等问题。

---

## 三、生成算法

### 3.1 节点生成

```typescript
function generateNodes(decl: NavigationDeclaration): Node[] {
  const nodes: Node[] = [];

  for (const route of decl.routes) {
    // 入口语义（RouteDeclaration.entryPoint）：
    // - 'home'|'both'：该路由可作为“首页入口”
    // - 'deepLink'：仅表示可外部直达（不等价于首页入口）
    const entry = normalizeEntryPoint(route.entryPoint); // { kind, home, deepLink }
    const uiStates = (route.uiStates && route.uiStates.length > 0)
      ? route.uiStates
      : [{ id: 'base', search: {}, description: route.description ?? '' }];

    // 为每个 uiState 生成节点；首页入口节点默认取 uiStates[0]
    uiStates.forEach((st, idx) => {
      const search = normalizeSearch(st.search ?? {});
      const nodeId = buildNodeId(route.path, search, route.queryParams ?? {});
      nodes.push({
        id: nodeId,
        routePath: route.path,
        uiStateId: st.id ?? 'base',
        component: route.component,
        description: st.description ?? route.description ?? '',
        search,
        queryParams: route.queryParams ?? {},
        params: route.params ?? {},
        entryPoint: Boolean(entry.home) && idx === 0,
        entry,
        scrollContainers: route.scrollContainers ?? [],
        stateCondition: st.stateCondition ?? undefined,
      });
    });
  }

  return nodes;
}
```

### 3.2 边生成（核心算法）

边生成需要处理以下展开逻辑：

1. **通配符 `from` 展开**：`{ path: '/xxx', search: { tab: '*' } }` 展开为匹配的所有源节点
2. **`searchParams` 目标展开**：根据目标路由的 `uiStates` 展开为多条边
3. **自环过滤**：过滤 `source === target` 的边

> 重要规则（避免重复边/错误边）：
>
> - 当某个 `searchParams` key 在当前分支（transition 顶层或 `cases[]` 分支）的 **静态 `search` 中已经被固定为具体值**（例如 `search: { sub: 'audio' }`），
>   则该 key **不再作为“动态离散参数”参与目标 `uiStates` 的展开**。
>   否则会出现“分支明明固定 sub=audio，却又展开出 sub=community”的错误边，甚至产生重复边。
> - 换句话说：**静态 `search` 对同 key 的展开具有优先级**；`searchParams` 只展开那些“没有被静态 search 固定”的离散 key。

```typescript
function generateEdges(decl: NavigationDeclaration, nodes: Node[]): Edge[] {
  const edges: Edge[] = [];
  const nodeIdSet = new Set(nodes.map(n => n.id));
  
  // 构建路由到 uiStates 的映射
  const routeToStates = new Map<string, Array<{ id: string; search: Record<string, string>; description?: string }>>();
  const routeToQueryParams = new Map<string, Record<string, 'string' | 'number'>>();
  for (const route of decl.routes) {
    routeToStates.set(route.path, route.uiStates || []);
    routeToQueryParams.set(route.path, route.queryParams || {});
  }

  for (const t of decl.transitions) {
    const froms = normalizeFrom(t.from);

    for (const from of froms) {
      // 展开通配符 from
      const expandedSources = expandWildcardFrom(from, nodes);

      for (const sourceId of expandedSources) {
        const targetQueryParams = routeToQueryParams.get(t.to) || {};
        const targetQueryParamKeys = new Set(Object.keys(targetQueryParams));
        // 只有“离散 key”（不在 queryParams 中）才参与 searchParams 的 uiState 结构匹配与展开
        const discreteSearchParamKeys = Object.keys(t.searchParams || {}).filter(k => {
          if (targetQueryParamKeys.has(k)) return false;
          // 若静态 search 已经固定该 key，则不把它当“动态离散参数”去展开
          const fixed = (t.search || {})[k];
          return fixed === undefined || fixed === null;
        });

        // 检查是否需要展开 searchParams（仅离散部分）
        if (discreteSearchParamKeys.length > 0) {
          // 展开到目标路由的所有匹配 uiStates
          const targetStates = routeToStates.get(t.to) || [];
          
          for (const targetState of targetStates) {
            // 检查 searchParams 中的 key 是否匹配 targetState.search
            const matches = discreteSearchParamKeys.every(key => key in targetState.search);
            
            if (matches) {
              const sourceSearch = parseSearchFromNodeId(sourceId);
              const baseSearch = applyPreserveParams(normalizeSearch(t.search), t.preserveParams, sourceSearch);
              const targetSearch = normalizeSearch({ ...baseSearch, ...targetState.search });
              const targetNodeId = buildNodeId(t.to, targetSearch, targetQueryParams);
              
              // 过滤自环
              if (sourceId === targetNodeId) continue;
              
              // 构建动态 label
              const baseLabel = t.label || '';
              const stateDesc = targetState.description || '';
              const expandedLabel = stateDesc ? `${baseLabel} → ${stateDesc}` : baseLabel;
              
              edges.push({
                source: sourceId,
                sourceNodeId: nodeIdSet.has(sourceId) ? sourceId : undefined,
                target: targetNodeId,
                targetNodeId,
                id: t.id,
                label: expandedLabel,
                type: determineEdgeType(sourceId, targetNodeId),
                mode: t.mode || 'push',
                search: targetState.search,
                searchParams: {},
                params: t.params || {},
                preserveParams: t.preserveParams || [],
                fromConstraint: typeof from === 'object' ? from : undefined,
                expandedFrom: 'searchParams',
              });
            }
          }
        } else {
          // 无 searchParams，直接生成边
          const sourceSearch = parseSearchFromNodeId(sourceId);
          const targetSearch = applyPreserveParams(normalizeSearch(t.search), t.preserveParams, sourceSearch);
          const targetNodeId = buildNodeId(t.to, normalizeSearch(targetSearch), targetQueryParams);
          
          // 过滤自环（仅同页面 transition）
          if (sourceId === targetNodeId && t.to === getPathFromNodeId(sourceId)) continue;
          
          edges.push({
            source: sourceId,
            sourceNodeId: nodeIdSet.has(sourceId) ? sourceId : undefined,
            target: targetNodeId,
            targetNodeId,
            id: t.id,
            label: t.label,
            type: determineEdgeType(sourceId, targetNodeId),
            mode: t.mode || 'push',
            search: t.search,
            searchParams: t.searchParams,
            params: t.params || {},
            preserveParams: t.preserveParams || [],
            fromConstraint: typeof from === 'object' ? from : undefined,
          });
        }
      }
    }
  }

  return edges;
}

/**
 * 将 source 节点上指定的 query 参数合并到目标 search（用于 preserveParams）
 *
 * - preserveParams 只影响“目标节点如何被解析/命中 uiState”，不会修改 TransitionDeclaration 本身
 */
function applyPreserveParams(
  baseSearch: Record<string, string | null | undefined>,
  preserveParams: string[] | undefined,
  sourceSearch: Record<string, string>,
): Record<string, string | null | undefined> {
  if (!preserveParams || preserveParams.length === 0) return baseSearch;
  const out = { ...(baseSearch || {}) };
  for (const key of preserveParams) {
    if (sourceSearch[key] !== undefined) {
      out[key] = sourceSearch[key];
    }
  }
  return out;
}

/**
 * 展开通配符 from 约束
 * 
 * 例如：{ path: '/my-reading', search: { tab: '*' } }
 * 会展开为所有匹配的节点：
 * - /my-reading?tab=week
 * - /my-reading?tab=month
 * - /my-reading?tab=year
 * - ...
 */
function expandWildcardFrom(from: string | FromConstraint, nodes: Node[]): string[] {
  if (typeof from === 'string') {
    return [from];
  }

  // 检查是否有通配符
  const wildcardKeys = Object.entries(from.search || {})
    .filter(([_, v]) => v === '*')
    .map(([k]) => k);

  if (wildcardKeys.length === 0) {
    // 无通配符，构建精确节点 ID
    return [buildNodeId(from.path, from.search as Record<string, string>)];
  }

  // 有通配符，找出所有匹配的节点
  const matchingNodes = nodes.filter(node => {
    // 检查路径是否匹配
    if (!matchRoute(from.path, getPathFromNodeId(node.id))) return false;
    
    // 检查每个约束
    const nodeSearch = parseSearchFromNodeId(node.id);
    for (const [key, expected] of Object.entries(from.search || {})) {
      const actual = nodeSearch[key];
      if (expected === '*') {
        // 通配符：参数必须存在
        if (!actual) return false;
      } else if (expected === null) {
        // null：参数必须不存在
        if (actual) return false;
      } else {
        // 精确匹配
        if (actual !== expected) return false;
      }
    }
    return true;
  });

  return matchingNodes.map(n => n.id);
}
```

### 3.3 简化图生成

```typescript
function generateSimplifiedGraph(graph: UIGraphOutput) {
  // 1) 合并节点：每个 routePath 一个节点
  const routeNodes = new Map();

  for (const node of graph.nodes) {
    const routePath = node.routePath;
    if (!routeNodes.has(routePath)) {
      routeNodes.set(routePath, {
        id: routePath,
        routePath,
        component: node.component,
        entryPoint: Boolean(node.entryPoint),
        entry: node.entry,
        description: node.description || routePath,
        stateCount: 0,
        states: [],
        // 可选：汇总 actions（viewer / task generator 会用到）
        actionCount: 0,
        actionIds: [],
        actions: [],
      });
    }

    const routeNode = routeNodes.get(routePath);
    if (node.entryPoint) routeNode.entryPoint = true;
    if (!routeNode.entry && node.entry) routeNode.entry = node.entry;
    routeNode.stateCount += 1;
    routeNode.states.push(node.id);

    // 汇总 actions（按 id 去重）
    for (const a of (node.actions || [])) {
      if (!a?.id) continue;
      if (!routeNode.__actionIdSet) routeNode.__actionIdSet = new Set();
      if (routeNode.__actionIdSet.has(a.id)) continue;
      routeNode.__actionIdSet.add(a.id);
      routeNode.actionIds.push(a.id);
      routeNode.actions.push(a);
    }
    routeNode.actionCount = routeNode.actionIds.length;
  }

  // 2) 合并边：去重 + 只保留跨路由边（sourceRoute -> targetRoute）
  const edgeMap = new Map();

  for (const edge of graph.edges) {
    const sourceRoute = extractRoutePath(edge.source);
    const targetRoute = extractRoutePath(edge.target);
    if (sourceRoute === targetRoute) continue;

    const key = `${sourceRoute}|${targetRoute}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        source: sourceRoute,
        target: targetRoute,
        transitions: [],
        type: edge.type || 'navigation',
        label: edge.id,
        id: edge.id,
      });
    }
    const e = edgeMap.get(key);
    if (!e.transitions.includes(edge.id)) e.transitions.push(edge.id);
  }

  // 清理内部字段
  const simplifiedNodes = Array.from(routeNodes.values()).map(n => {
    const { __actionIdSet, ...rest } = n;
    return rest;
  });

  return { nodes: simplifiedNodes, edges: Array.from(edgeMap.values()) };
}
```

### 3.4 辅助函数

```typescript
/**
 * 规范化 search：移除 null/undefined
 */
function normalizeSearch(search: Record<string, string | null | undefined> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(search)) {
    if (v === null || v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

/**
 * 构建节点 ID
 *
 * - nodeId = routePath + 离散 search（有限集合） + queryParams 占位符（无限集合）
 * - queryParams 会以 `key=:key` 的形式出现在 nodeId 上（用于表达“该节点依赖某个动态 query”）
 */
function buildNodeId(
  routePath: string,
  search: Record<string, string>,
  queryParams: Record<string, 'string' | 'number'> = {},
): string {
  const parts: string[] = [];
  
  for (const [k, v] of Object.entries(search)) {
    parts.push(`${k}=${v}`);
  }
  for (const key of Object.keys(queryParams)) {
    parts.push(`${key}=:${key}`);
  }
  
  return parts.length > 0 ? `${routePath}?${parts.join('&')}` : routePath;
}

/**
 * 从节点 ID 中提取 routePath（去掉离散 query 与缺失标记）
 */
function extractRoutePath(nodeId: string): string {
  return nodeId.split('?')[0].split('#')[0];
}

// 兼容旧文档命名：getPathFromNodeId = extractRoutePath
function getPathFromNodeId(nodeId: string): string {
  return extractRoutePath(nodeId);
}

/**
 * 从节点 ID 中解析 search 参数
 */
function parseSearchFromNodeId(nodeId: string): Record<string, string> {
  const result: Record<string, string> = {};
  const queryIndex = nodeId.indexOf('?');
  if (queryIndex === -1) return result;
  
  const queryString = nodeId.slice(queryIndex + 1);
  for (const part of queryString.split('&')) {
    const [key, value] = part.split('=');
    if (key && value) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 判断边类型
 */
function determineEdgeType(sourceId: string, targetId: string): 'navigation' | 'state' {
  return extractRoutePath(sourceId) === extractRoutePath(targetId) ? 'state' : 'navigation';
}

/**
 * 路由模板匹配
 */
function matchRoute(template: string, path: string): boolean {
  if (template === '*') return true;
  const regex = new RegExp('^' + template.replace(/:\w+/g, '[^/]+') + '$');
  return regex.test(path);
}
```

---

## 四、DOM 属性与 Agent 交互

### 4.1 `data-trigger` 属性

所有触发导航的元素必须绑定 `data-trigger` 属性：

```html
<button data-trigger="book.open" data-trigger-type="tap">
  打开书籍
</button>
```

### 4.2 `data-trigger-params` 属性

当多个元素使用相同的 `transitionId` 但参数不同时，使用 `data-trigger-params` 区分：

```html
<!-- Tab 切换按钮 -->
<button 
  data-trigger="myReading.tab.switch" 
  data-trigger-type="tap"
  data-trigger-params='{"tab":"week"}'
>周</button>

<button 
  data-trigger="myReading.tab.switch" 
  data-trigger-type="tap"
  data-trigger-params='{"tab":"month"}'
>月</button>

<!-- 书籍列表 -->
<div 
  data-trigger="book.detail.open" 
  data-trigger-type="tap"
  data-trigger-params='{"bookId":"123"}'
>
  《三体》
</div>
```

**实现方式**：

```typescript
// useTriggerGestures hook 自动处理
const tabRef = bindTap('myReading.tab.switch', { 
  params: { tab: 'week' } 
});

// 返回：
// {
//   'data-trigger': 'myReading.tab.switch',
//   'data-trigger-type': 'tap',
//   'data-trigger-params': '{"tab":"week"}',
//   onClick: ...,
// }
```

### 4.3 Agent 定位策略

Agent 可以通过以下方式定位元素：

1. **精确匹配**：`[data-trigger="book.open"]`
2. **带参数匹配**：`[data-trigger="myReading.tab.switch"][data-trigger-params*="week"]`
3. **结合文本**：`[data-trigger="myReading.tab.switch"]:contains("周")`

---

## 五、获取当前状态可用动作

```typescript
export function getActionsForRoute(
  pathname: string,
  searchParams: URLSearchParams,
  decl: NavigationDeclaration
): ActionItem[] {
  const actions: ActionItem[] = [];

  for (const t of decl.transitions) {
    if (matchFrom(t.from, pathname, searchParams)) {
      actions.push({
        id: t.id,
        type: matchRoute(t.to, pathname) ? 'state' : 'navigation',
        label: t.label,
        placement: t.ui.placement,
        selector: `[data-trigger="${t.id}"]`,
        params: t.params,
        searchParams: t.searchParams,
      });
    }
  }

  // 滚动操作
  const routeDecl = decl.routes.find(r => matchRoute(r.path, pathname));
  if (routeDecl && routeDecl.scrollContainers.length > 0) {
    for (const sc of routeDecl.scrollContainers) {
      const paramName = sc.direction === 'horizontal' ? `${sc.name}X` : sc.name;
      actions.push({
        id: `scroll.${paramName}.up`,
        type: 'scroll',
        label: `${sc.description} 向上滚动`,
        scrollContainer: paramName,
        scrollDelta: -200,
      });
      actions.push({
        id: `scroll.${paramName}.down`,
        type: 'scroll',
        label: `${sc.description} 向下滚动`,
        scrollContainer: paramName,
        scrollDelta: 200,
      });
    }
  }

  return actions;
}
```

---

## 六、告警与排查（不会生成 issues）

生成图时不会输出 `issues` 数组；工具会用控制台告警帮助你发现“不可达/缺失节点引用”等问题：

- **Schema 模式**：如果存在不可达子图或边指向缺失节点，会输出 `WARN(schema)`（并附带 `target_missing/source_missing/target_unreachable/source_unreachable` 等原因）。
- **Data 模式**：会在输出 JSON 中写入 `reachability`，并可能输出 `WARN`；可用 `--prune-unreachable` 剪掉不可达孤岛。

更严格的“声明 ↔ 源码触发点/手势/基础结构规则（如 base uiState 命名、from 裸路径）”请运行：

```bash
node scripts/check_navigation_declaration_consistency.mjs <App> --actions
```

---

## 七、输出示例

### 7.1 完整图（schema 输出结构示例）

**输入**：

```typescript
const decl: NavigationDeclaration = {
  app: 'example',
  routes: [
    {
      path: '/',
      component: 'Home',
      params: {},
      entryPoint: 'home',
      description: '首页',
      scrollContainers: [],
      queryParams: {},
      uiStates: [{ id: 'home.base', search: {}, description: '首页' }],
    },
    {
      path: '/my-reading',
      component: 'MyReadingPage',
      params: {},
      entryPoint: 'none',
      description: '阅读统计',
      scrollContainers: [],
      queryParams: {},
      uiStates: [
        { id: 'myReading.week', search: { tab: 'week' }, description: '周视图' },
        { id: 'myReading.month', search: { tab: 'month' }, description: '月视图' },
      ],
    },
  ],
  transitions: [
    {
      id: 'myReading.open.week',
      from: '/',
      to: '/my-reading',
      search: { tab: 'week' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开阅读统计（周）',
      ui: { placement: 'content', icon: '', gesture: 'tap' },
    },
    {
      id: 'myReading.tab.switch',
      from: { path: '/my-reading', search: { tab: '*' } },
      to: '/my-reading',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换阅读统计 Tab',
      ui: { placement: 'content', icon: '', gesture: 'tap' },
    },
  ],
};
```

**输出**：

```json
{
  "app": "example",
  "appDir": "apps/Example",
  "mode": "schema",
  "dataFile": null,
  "reachability": null,
  "routeCount": 3,
  "transitionCount": 2,
  "nodes": [
    {
      "id": "/",
      "routePath": "/",
      "uiStateId": "home.base",
      "component": "Home",
      "entryPoint": true,
      "entry": { "kind": "home", "home": true, "deepLink": false },
      "params": {},
      "scrollContainers": [],
      "description": "首页",
      "search": {},
      "queryParams": {},
      "actions": []
    },
    {
      "id": "/my-reading?tab=week",
      "routePath": "/my-reading",
      "uiStateId": "myReading.week",
      "component": "MyReadingPage",
      "entryPoint": false,
      "entry": { "kind": "none", "home": false, "deepLink": false },
      "params": {},
      "scrollContainers": [],
      "description": "周视图",
      "search": { "tab": "week" },
      "queryParams": {},
      "actions": []
    },
    {
      "id": "/my-reading?tab=month",
      "routePath": "/my-reading",
      "uiStateId": "myReading.month",
      "component": "MyReadingPage",
      "entryPoint": false,
      "entry": { "kind": "none", "home": false, "deepLink": false },
      "params": {},
      "scrollContainers": [],
      "description": "月视图",
      "search": { "tab": "month" },
      "queryParams": {},
      "actions": []
    }
  ],
  "edges": [
    {
      "source": "/",
      "target": "/my-reading?tab=week",
      "id": "myReading.open.week",
      "label": "打开阅读统计（周）",
      "type": "navigation",
      "mode": "push",
      "search": { "tab": "week" },
      "searchParams": {},
      "params": {},
      "preserveParams": [],
      "uiMeta": { "placement": "content", "icon": "", "gesture": "tap" }
    },
    {
      "source": "/my-reading?tab=week",
      "target": "/my-reading?tab=month",
      "id": "myReading.tab.switch",
      "label": "切换阅读统计 Tab → 月视图",
      "type": "state",
      "mode": "replace",
      "search": { "tab": "month" },
      "searchParams": {},
      "params": {},
      "preserveParams": [],
      "expandedFrom": "searchParams",
      "uiMeta": { "placement": "content", "icon": "", "gesture": "tap" }
    }
  ]
}
```

### 7.2 简化图

```json
{
  "app": "example",
  "appDir": "apps/Example",
  "mode": "schema",
  "routeCount": 2,
  "edgeCount": 1,
  "nodes": [
    {
      "id": "/",
      "routePath": "/",
      "component": "Home",
      "entryPoint": true,
      "entry": { "kind": "home", "home": true, "deepLink": false },
      "description": "首页",
      "stateCount": 1,
      "states": ["/"],
      "actionCount": 0,
      "actionIds": [],
      "actions": []
    },
    {
      "id": "/my-reading",
      "routePath": "/my-reading",
      "component": "MyReadingPage",
      "entryPoint": false,
      "entry": { "kind": "none", "home": false, "deepLink": false },
      "description": "周视图",
      "stateCount": 2,
      "states": ["/my-reading?tab=week", "/my-reading?tab=month"],
      "actionCount": 0,
      "actionIds": [],
      "actions": []
    }
  ],
  "edges": [
    { 
      "source": "/", 
      "target": "/my-reading", 
      "id": "myReading.open.week",
      "label": "myReading.open.week",
      "type": "navigation",
      "transitions": ["myReading.open.week"]
    }
  ]
}
```

> [!NOTE]
> 简化图中省略了 `/my-reading` 内部的 tab 切换边，只保留跨页面跳转。

---

## 八、可视化

生成的图可以使用 Cytoscape.js 进行可视化。项目提供了 `public/nav_graph_viewer.html` 工具：

```bash
# 1. 生成图 JSON
node scripts/navigation_declaration_analyzer.mjs WechatReading -o public/wechatreading_nav_graph.json

# 2. 启动本地服务器
npx serve public

# 3. 访问 http://localhost:3000/nav_graph_viewer.html
```

### 8.1 可视化功能

- **节点布局**：自动 dagre 布局
- **边标签**：显示 transition label
- **节点高亮**：hover 显示详情
- **图切换**：支持完整图 / 简化图切换
- **入口节点**：`nodes[].entryPoint=true` 的节点会高亮（红色）
- **条件边（uiCondition）**：绿色虚线；若条件“无法计算/数据不足”（data 模式），会用灰色点线强调不确定性
- **条件节点（stateCondition）**：节点高亮（绿色），用于提示“该状态是否存在依赖数据条件”
- **可用性（availability）**：`availability=requires_prior_visit` 使用紫色虚线显示，并在详情中展示 `availabilityNote`

---

## 九、脚本使用

```bash
# 生成完整图 + 简化图
node scripts/navigation_declaration_analyzer.mjs <AppName> -o <output.json> --format pretty

# Data 模式（展开 dataSource + 评估 condition + 输出 reachability）
node scripts/navigation_declaration_analyzer.mjs <AppName> --data <dataFile.ts> -o <output_data.json> --format pretty

# 可选：指定 data 导出名（默认自动识别 *_CONFIG）
node scripts/navigation_declaration_analyzer.mjs <AppName> --data <dataFile.ts> --data-export WECHAT_CONFIG -o <output_data.json> --format pretty

# 可选：限制 data 模式展开的数据量（默认推荐 10；0=不限制）
# 说明：用于避免大数据集在 data-mode 下展开导致图/任务爆炸（例如 Bilibili/RedBook）。
node scripts/navigation_declaration_analyzer.mjs <AppName> --data <dataFile.ts> --data-limit 10 -o <output_data.json> --format pretty
node scripts/navigation_declaration_analyzer.mjs <AppName> --data <dataFile.ts> --data-limit 0 -o <output_data.json> --format pretty

# 可选：Data 模式剪枝不可达孤岛（默认仅 WARN，不剪枝）
node scripts/navigation_declaration_analyzer.mjs <AppName> --data <dataFile.ts> --prune-unreachable -o <output_data.json> --format pretty

# 示例
node scripts/navigation_declaration_analyzer.mjs WechatReading -o public/wechatreading_nav_graph.json --format pretty
# 输出：
# - public/wechatreading_nav_graph.json（完整图）
# - public/wechatreading_nav_graph_simplified.json（简化图）
```

> [!TIP]
> 实践上更推荐使用一键脚本 `build_nav_artifacts.mjs` 统一产出：一致性检查 + schema 图 +（可选）data 图 +（默认）tasks（最短路径集合）：
>
> ```bash
> node scripts/build_nav_artifacts.mjs <AppName> --data data/index.ts --data-limit 10 --format pretty
> # 只更新图不生成 tasks：
> node scripts/build_nav_artifacts.mjs <AppName> --data data/index.ts --skip-tasks --format pretty
> # 枚举非最短路径（会显著增大 tasks）：
> node scripts/build_nav_artifacts.mjs <AppName> --data data/index.ts --tasks-all-paths --format pretty
> ```

> [!NOTE]
> - **Schema 模式**不会剪枝，但会在控制台输出 `WARN(schema)` 提示不可达子图（用于排查声明问题）。
> - **Data 模式**会在输出 JSON 中写入 `reachability`；`--prune-unreachable` 仅影响 data 模式。

---

## 十、修订历史

### v2.1 (2026-01-15)

**边生成语义增强**：

1. **条件边（availability）透传** — `transition.availability/availabilityNote`（或 `cases[]` 分支上的同名字段）会写入输出 edge，供工具链区分“首次可达”与“依赖访问记忆的恢复入口”
2. **cases 分支一致展开** — `cases[]` 分支也会执行 `from` 通配符展开与 `searchParams` 目标展开，并在 edge 上输出 `when`
3. **自环保留规则** — 默认过滤 `source === target`，但保留 `mode='push'` 且 `to` 含路径参数（如 `/video/:bvid`）的自环边，用于表达“同页面打开另一个实体实例”

**可视化增强**：

4. **条件边样式** — `requires_prior_visit` 使用紫色虚线展示，详情面板展示备注

### v2.2 (2026-01-17)

**边生成规则修正**：

1. **避免重复/错误的 `searchParams` 展开** — 当某个 `searchParams` key 在当前分支（transition 顶层或 `cases[]` 分支）的静态 `search` 中已固定为具体值时，该 key 不再作为“动态离散参数”参与目标 `uiStates` 的展开。
2. **重复边告警** — 若同一个 `(source, target, transitionId)` 被生成多次，建图器会输出 `WARN` 并列出重复边示例（最多 20 条），便于定位声明/展开逻辑问题。

### v2.0 (2026-01-11)

**边生成增强**：

1. **通配符 `from` 展开** — `{ path: '/xxx', search: { tab: '*' } }` 自动展开为所有匹配的源节点
2. **`searchParams` 目标展开** — 根据目标路由的 `uiStates` 展开为多条边
3. **自环过滤** — 自动过滤 `source === target` 的同页面边
4. **动态 Label 展开** — 展开后的边自动附加目标状态描述（如 `切换阅读统计 Tab → 月视图`）

**新增功能**：

5. **简化图生成** — 合并同一路由的所有 uiState 为单节点，只保留跨路由边
6. **`data-trigger-params` 支持** — 用于导航图和任务生成工具区分相同 transitionId 但不同参数的元素

**Edge 结构增强**：

7. `sourceNodeId` — 精确的源节点 ID（用于图匹配）
8. `targetNodeId` — 精确的目标节点 ID
9. `expandedFrom` — 标记边是否由 `searchParams` 或 `wildcard` 展开生成

**校验规则增强**：

10. `invalid_from_route` — 检查 `from` 中的 pathname 是否存在
11. `invalid_from_state` — 检查 `from` 中的离散状态是否在 uiStates 中枚举
