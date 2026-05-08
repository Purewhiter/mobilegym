# 数据源声明方案（DataSource Declaration）

> 状态：设计草案  
> 版本：v0.5（DataSourceDeclaration）/ v0.8（StateCondition）  
> 日期：2026-01-11
>
> **版本说明**：本文档的版本号（v0.5）指 `DataSourceDeclaration` 类型的演进版本。`StateCondition` 类型在 v0.8 中扩展了组合条件与参数对比能力。这些子版本号与主文档 `NAVIGATION_DECLARATION_PROPOSAL.md` 的版本号（v3.x）独立。

## 一、背景与动机

### 1.1 现状

当前导航声明中，动态参数（如 `:bookId`、`:userId`）使用占位符表示：

```typescript
{
  id: 'reader.open',
  from: '/bookshelf',
  to: '/read/:bookId',
  params: { bookId: 'string' },
}
```

生成的 UI 图中，节点表示为 `/read/:bookId`，无法展开为具体的书籍页面。

### 1.2 需求

1. **数据驱动的图展开**：根据配置数据，将 `/read/:bookId` 展开为 `/read/60`、`/read/20` 等具体节点
2. **路径可达性分析**：基于真实数据分析具体的导航路径
3. **Agent 训练支持**：生成包含真实数据的导航轨迹
4. **条件可见性分析**：理解按钮何时显示（基于数据状态）

---

## 二、设计目标

1. **声明式**：在 `navigation.declaration.ts` 中声明数据源引用
2. **可选性**：`dataSource` 和 `condition` 都是可选字段
3. **统一数据路径**：两者使用相同的 `ref` 语法引用配置数据
4. **自动推断**：参数绑定逻辑由分析器自动推断，无需显式声明
5. **支持多数据源**：同一 transition 可从不同 `from` 引用不同数据源

---

## 三、类型定义

### 3.1 DataSourceDeclaration

```typescript
/**
 * 数据源声明
 * 
 * 描述 transition 的动态参数值从哪个数据集合获取。
 * 用于静态分析时将图展开为具体节点。
 */
export interface DataSourceDeclaration {
  /**
   * 适用的来源约束
   * 
   * 复用 TransitionDeclaration.from 的单项语法。
   * 当 transition 有多个 from 时，使用此字段精确匹配。
   * 
   * 示例：
   * - '*': 适用于所有来源
   * - '/bookshelf': 仅适用于书架页
   * - { path: '/reading-list', search: { category: '*' } }: 适用于任意分类的阅读列表
   */
  from?: '*' | string | FromConstraint;
  
  /**
   * 数据引用路径（点分隔）
   * 
   * 指向配置文件中的数据集合。
   * 
   * 示例：
   * - 'shelf' → config.shelf（书架数据）
   * - 'users' → config.users（用户列表）
   * - 'user.following' → config.user.following（关注列表）
   */
  ref: string;
  
  /**
   * 参数映射
   * 
   * key: transition 的 params 中的参数名（仅限 path params）
   * value: 数据对象中的字段名，或特殊值：
   * - '$value': 数组元素本身就是值（如 ['user_508']）
   * - '$key': 当 ref 指向一个对象（Record）时，使用对象的 key 作为值（见 4.6）
   * 
   * 示例：
   * - { bookId: 'bookId' } → 从对象字段取值
   * - { bookId: 'id' } → 字段名不同时的映射
   * - { userId: '$value' } → 数组元素本身就是值（如 ['user_508']）
   * - { id: '$key' } → 对象的 key（如 { moments: {...}, scan: {...} }）
   * 
   * ⚠️ 作用域限制：
   * - 仅用于填充 `to` 的 path params（如 :bookId）
   * - 不用于填充 searchParams（由 transition.search/searchParams 显式指定）
   */
  paramMapping: Record<string, string>;
  
  /**
   * 标签字段（可选）
   * 
   * 用于在展开的图中显示有意义的标签。
   * 
   * 示例：'title' → 显示书名而非 bookId
   */
  labelField?: string;
}
```

### 3.2 StateCondition（v0.8：组合条件 + 参数对比）

```typescript
/**
 * 状态条件声明（StateCondition，v0.8）
 *
 * 描述 UI 状态/入口在什么数据条件下存在/显示。
 * 所有条件都基于配置数据（ConfigData），使用统一的 ref 语法。
 *
 * 应用位置：
 * - uiStates[].stateCondition: 状态节点是否存在
 * - ui.condition: 跳转入口是否显示
 *
 * 说明：
 * - v0.8 新增组合条件（and/or/not）以及“参数 vs ref”的对比（paramEq/paramNeq）
 * - `paramEq/paramNeq` 依赖 data-mode 的 boundParams（一般来自 path params），不建议依赖 queryParams
 */
export type StateCondition =
  // 组合
  | { op: 'always'; text?: string }
  | { op: 'and'; items: StateCondition[]; text?: string }
  | { op: 'or'; items: StateCondition[]; text?: string }
  | { op: 'not'; item: StateCondition; text?: string }
  // 基础（v0.5 起）
  | { op: 'notEmpty'; ref: string; filterFn?: string; text?: string }
  | { op: 'memberOf'; ref: string; param: string; field?: string; filterFn?: string; text?: string }
  | { op: 'eq'; ref: string; equals: boolean | string | number; text?: string }
  // 参数对比（v0.8）
  | { op: 'paramEq'; param: string; ref: string; text?: string }
  | { op: 'paramNeq'; param: string; ref: string; text?: string };

/**
 * 历史兼容（不推荐新增使用）
 *
 * 某些旧 app 曾使用 `equals/notEquals/empty` 等 op。
 * 工具链仍兼容，但新声明建议统一使用上面的 op（eq + not / notEmpty）。
 */
```

### 3.3 条件的应用位置

**v0.5 设计变更**：条件从 `TransitionDeclaration` 移动到更合适的位置。

#### 3.3.1 UIState 的状态存在条件

```typescript
// 在 RouteDeclaration 中
uiStates: Array<{
  id: string;
  search: Record<string, string | null>;
  description: string;
  /**
   * 状态存在条件（可选）
   * 
   * 描述该 UI 状态在什么数据条件下存在。
   * - Schema 模式：节点存在，标注条件
   * - Data 模式：根据条件评估决定节点是否生成
   */
  stateCondition?: StateCondition;
}>;
```

**使用场景**：动态 Tab、条件性页面状态

```typescript
// 示例：只有存在读完的书时，"读完" Tab 才存在
uiStates: [
  { id: 'myProfile.shelf', search: { tab: 'shelf' }, description: '书架' },
  { 
    id: 'myProfile.finished', 
    search: { tab: 'finished' }, 
    description: '读完',
    stateCondition: {
      op: 'notEmpty',
      // 更贴近真实微信读书：读完列表由阅读进度驱动，且主页读完会排除“在书架且私密”的读完书
      ref: 'finishedBookIds',
      filterFn: '(bookId, data) => { const shelfItem = (data.initialShelf || []).find(x => x.bookId === bookId); if (shelfItem && shelfItem.isPrivate === true) return false; const progress = data.bookProgress?.[bookId]; const book = (data.store || []).find(b => b.id === bookId); return !!(progress && book && progress.charOffset >= book.totalWords); }',
    }
  },
]
```

#### 3.3.2 UI 入口的显示条件

```typescript
// 在 TransitionDeclaration 中
ui: {
  placement: 'topbar' | 'tabbar' | 'content' | 'fab' | 'none';
  icon: string;
  gesture: GestureType;
  /**
   * 入口显示条件（可选）
   * 
   * 描述触发此跳转的 UI 入口在什么数据条件下显示。
   * - Schema 模式：边存在，标注条件
   * - Data 模式：根据条件评估决定边是否生成
   */
  condition?: StateCondition;
};
```

**使用场景**：条件性按钮、权限控制

```typescript
// 示例：只有书在书架中时，才显示"书架管理"按钮
{
  id: 'book.modal.shelf.open',
  from: '/book/:bookId',
  to: '/book/:bookId',
  search: { modal: 'shelf' },
  ui: {
    placement: 'content',
    icon: 'book_modal_shelf',
    gesture: 'tap',
    condition: {
      op: 'memberOf',
      ref: 'initialShelf',
      param: 'bookId',
      field: 'bookId',
      text: '已加入书架',
    },
  },
  dataSource: { ref: 'initialShelf', paramMapping: { bookId: 'bookId' } },
}
```

### 3.4 TransitionDeclaration（更新后）

```typescript
export interface TransitionDeclaration {
  // ... 现有字段
  
  /**
   * 数据源声明（可选）
   * 
   * 单个数据源或多个数据源（对应不同的 from 路径）。
   * 用于静态分析时展开动态参数。
   */
  dataSource?: DataSourceDeclaration | DataSourceDeclaration[];
  
  // ⚠️ v0.5 变更：stateCondition 已移至 ui.condition
  // 原因：条件描述的是"入口的显示"而非"跳转的可行性"
}
```

---

## 四、使用示例

### 4.1 集合成员检查 + 数据展开

```typescript
// 书架管理弹窗（只有书架中的书才显示）
{
  id: 'book.modal.shelf.open',
  from: '/book/:bookId',
  to: '/book/:bookId',
  search: { modal: 'shelf' },
  params: { bookId: 'string' },
  label: '书架管理',
  ui: {
    placement: 'content',
    gesture: 'tap',
    // 入口显示条件：bookId 存在于 initialShelf 集合中
    condition: {
      op: 'memberOf',
      ref: 'initialShelf',
      param: 'bookId',
      field: 'bookId',
      text: '已加入书架',
    },
  },
  
  // 数据源：用于展开
  dataSource: {
    ref: 'initialShelf',
    paramMapping: { bookId: 'bookId' },
  },
}
```

### 4.2 属性检查

```typescript
// VIP 专属功能
{
  id: 'vip.feature.open',
  from: '/me',
  to: '/vip/feature',
  label: 'VIP 专属',
  ui: {
    placement: 'content',
    gesture: 'tap',
    // 入口显示条件：user.membership === true
    condition: {
      op: 'eq',
      ref: 'user.membership',
      equals: true,
      text: '会员专属',
    },
  },
}
```

### 4.3 多来源、多数据源

```typescript
{
  id: 'reader.open',
  from: ['/', '/bookshelf', '/book/:bookId'],
  to: '/read/:bookId',
  params: { bookId: 'string' },
  label: '打开阅读器',
  
  dataSource: [
    {
      from: '/',
      ref: 'recommendations',
      paramMapping: { bookId: 'id' },
      labelField: 'title',
    },
    {
      from: '/bookshelf',
      ref: 'initialShelf',
      paramMapping: { bookId: 'bookId' },
    },
    // /book/:bookId 不需要 dataSource，参数从 URL 继承
  ],
}
```

### 4.4 精确来源匹配

```typescript
{
  id: 'book.detail.open',
  from: [
    '/',
    '/bookshelf',
    { path: '/reading-list', search: { category: '*' } },
  ],
  to: '/book/:bookId',
  params: { bookId: 'string' },
  
  dataSource: [
    {
      from: '/',
      ref: 'recommendations',
      paramMapping: { bookId: 'id' },
    },
    {
      from: '/bookshelf',
      ref: 'initialShelf',
      paramMapping: { bookId: 'bookId' },
    },
    {
      // 使用 FromConstraint 精确匹配
      from: { path: '/reading-list', search: { category: '*' } },
      ref: 'readingList',
      paramMapping: { bookId: 'bookId' },
    },
  ],
}
```

### 4.5 使用 `$value` 展开简单数组

当数据是简单值数组（如 `['user_508', 'user_123']`）而非对象数组时，使用 `$value`：

```typescript
// 数据：user.following: ['user_508', 'user_123']

{
  id: 'user.profile.open',
  from: '/following',
  to: '/user/:userId',
  params: { userId: 'string' },
  
  // 使用 $value 表示数组元素本身就是 userId
  dataSource: {
    ref: 'user.following',
    paramMapping: { userId: '$value' },
  },
  
  ui: {
    placement: 'content',
    gesture: 'tap',
    // ui.condition 使用相同的 $value 语法
    condition: {
      op: 'memberOf',
      ref: 'user.following',
      param: 'userId',
      field: '$value',
      text: '已关注',
    },
  },
}
```

**展开结果**：
```
/following → /user/user_508
/following → /user/user_123
```

### 4.6 使用 `$key` 展开对象（Record）的键

当 `ref` 指向一个对象（如 `Record<string, any>`）且你希望用对象的 key 来绑定目标 path params 时，使用 `$key`。

**典型场景**：设置页的“配置项集合”是一个对象，key 是稳定的 id，value 是配置详情：

```typescript
// 数据：user.settings.discover
// {
//   moments: { visible: true, notify: true },
//   channels: { visible: true, notify: true },
//   scan: { visible: true },
//   ...
// }

{
  id: 'settings.discover.item.open',
  from: ['/settings/general/discover'],
  to: '/settings/general/discover/:id',
  params: { id: 'string' },

  // 使用 $key 绑定对象的 key 到 :id
  dataSource: {
    ref: 'user.settings.discover',
    paramMapping: { id: '$key' },
  },
}
```

**展开结果**（示意）：
```
/settings/general/discover → /settings/general/discover/moments
/settings/general/discover → /settings/general/discover/channels
/settings/general/discover → /settings/general/discover/scan
...
```

**稳定性约定（重要）**：
- 当 `ref` 指向对象且使用 `$key` 展开时，分析器应当按 `Object.keys(obj).sort()` 的顺序展开，保证多次生成产物稳定、便于 diff。

---

## 五、参数绑定语义

### 5.1 自动推断规则

分析器在展开图时，自动确定每个参数的绑定来源：

```typescript
/**
 * 参数绑定解析（按优先级）
 * 
 * 对于 transition 的每个目标参数（params 中的 key）：
 * 
 * 重要：inherited 判断基于源节点的 boundParams，而非路径模板！
 * 只有源节点已绑定具体值时，才能继承。
 */
function resolveParamBinding(param: string, transition, sourceNode): 'dataSource' | 'inherited' | 'unbound' {
  // 1. 检查是否有匹配的 dataSource
  const ds = findMatchingDataSource(transition.dataSource, sourceNode);
  if (ds && param in ds.paramMapping) {
    return 'dataSource';  // 从数据源展开
  }
  
  // 2. 检查源节点是否已绑定该参数的具体值
  //    注意：不是检查 path.includes(':param')，而是检查 boundParams
  if (sourceNode.boundParams?.[param] !== undefined) {
    return 'inherited';   // 从源节点的具体值继承
  }
  
  // 3. 无法确定
  return 'unbound';       // 保持占位符
}
```

> ⚠️ **关键区别**：
> - `/book/:bookId`（抽象节点）→ 无 `boundParams` → `unbound`
> - `/book/60`（具体节点）→ `boundParams.bookId = '60'` → `inherited`

### 5.2 绑定来源与结构

#### 绑定类型

| 绑定来源 | 说明 | 示例 |
|----------|------|------|
| **dataSource** | 参数值从数据集合展开 | `/bookshelf` → `/read/60`, `/read/20`（来自 initialShelf） |
| **inherited** | 参数值从源节点的具体值继承 | `/book/60` → `/read/60`（继承 bookId=60） |
| **unbound** | 无法确定，保持占位符 | `/book/:bookId` → `/read/:bookId` |

#### 统一的 binding 结构

```typescript
/**
 * 参数绑定结构
 * 
 * 关键：dataSource 和 inherited 都必须带 value！
 * 这样剪枝、调试、轨迹记录都能统一处理。
 */
type ParamBinding = 
  | { source: 'dataSource'; value: string }   // 从数据源获取的具体值
  | { source: 'inherited'; value: string }    // 从源节点继承的具体值
  | { source: 'unbound' };                    // 无具体值

// Edge 中的 binding 字段
interface EdgeBinding {
  [param: string]: ParamBinding;
}
```

**示例**：
```json
{
  "edges": [
    {
      "source": "/bookshelf",
      "target": "/read/60",
      "binding": { "bookId": { "source": "dataSource", "value": "60" } }
    },
    {
      "source": "/book/60",
      "target": "/read/60",
      "binding": { "bookId": { "source": "inherited", "value": "60" } }
    },
    {
      "source": "/book/:bookId",
      "target": "/read/:bookId",
      "binding": { "bookId": { "source": "unbound" } }
    }
  ]
}
```

### 5.3 dataSource 匹配规则

当 transition 有多个 dataSource 时，需要确定性的匹配规则。

#### 5.3.1 FromConstraint 匹配语义

首先定义"是否匹配"，复用 `FromConstraint.search` 的语义：

```typescript
/**
 * FromConstraint search 匹配规则
 * 
 * - value === '*': sourceNode.search[key] 必须存在（任意值）
 * - value === null: sourceNode.search[key] 必须不存在
 * - value === 'xxx': sourceNode.search[key] 必须等于 'xxx'
 */
function matchSearch(
  constraint: Record<string, string | '*' | null> | undefined,
  actual: Record<string, string>
): boolean {
  if (!constraint) return true;  // 无约束，视为匹配
  
  for (const [key, expected] of Object.entries(constraint)) {
    const actualValue = actual[key];
    
    if (expected === '*') {
      // 必须存在（任意值）
      if (actualValue === undefined) return false;
    } else if (expected === null) {
      // 必须不存在
      if (actualValue !== undefined) return false;
    } else {
      // 必须等于指定值
      if (actualValue !== expected) return false;
    }
  }
  return true;
}

/**
 * 完整的 FromConstraint 匹配
 */
function matchFromConstraint(
  from: '*' | string | FromConstraint,
  sourceNode: Node
): boolean {
  if (from === '*') return true;
  
  if (typeof from === 'string') {
    return matchPath(from, sourceNode.routePath);
  }
  
  // FromConstraint
  if (!matchPath(from.path, sourceNode.routePath)) return false;
  return matchSearch(from.search, sourceNode.search ?? {});
}
```

#### 5.3.2 匹配优先级

在确认"匹配"的前提下，按优先级排序：

```typescript
/**
 * dataSource 匹配优先级（从高到低）
 * 
 * 1. 精确 FromConstraint 匹配（path + search 全为具体值）→ 优先级 4
 * 2. FromConstraint 带通配符匹配（search 中有 '*'）→ 优先级 3
 * 3. 纯 path string 匹配 → 优先级 2
 * 4. '*' 通配符（兜底）→ 优先级 1
 * 
 * 同级冲突时报错（静态分析阶段检测）
 */
function findMatchingDataSource(
  dataSources: DataSourceDeclaration | DataSourceDeclaration[] | undefined,
  sourceNode: Node
): DataSourceDeclaration | null {
  if (!dataSources) return null;
  
  const sources = Array.isArray(dataSources) ? dataSources : [dataSources];
  
  // 先过滤匹配项，再按优先级排序
  const matched = sources
    .filter(ds => matchFromConstraint(ds.from ?? '*', sourceNode))
    .map(ds => ({ ds, priority: getMatchPriority(ds.from, sourceNode) }))
    .sort((a, b) => b.priority - a.priority);
  
  // 检查同级冲突
  if (matched.length >= 2 && matched[0].priority === matched[1].priority) {
    throw new Error(`Ambiguous dataSource match for ${sourceNode.id}: ` +
      `${JSON.stringify(matched[0].ds.from)} vs ${JSON.stringify(matched[1].ds.from)}`);
  }
  
  return matched[0]?.ds ?? null;
}

function getMatchPriority(from: '*' | string | FromConstraint | undefined, sourceNode: Node): number {
  if (from === undefined || from === '*') return 1;  // 兜底
  if (typeof from === 'string') return 2;            // 纯 path
  
  // FromConstraint
  if (!from.search || Object.keys(from.search).length === 0) return 2;  // 无 search，等同于纯 path
  
  const hasWildcard = Object.values(from.search).some(v => v === '*');
  return hasWildcard ? 3 : 4;  // 带通配符 vs 精确匹配
}
```

### 5.4 展开示例

**输入**：
```typescript
// Transition
{
  id: 'reader.open',
  from: ['/bookshelf', '/book/:bookId'],
  to: '/read/:bookId',
  params: { bookId: 'string' },
  dataSource: {
    from: '/bookshelf',
    ref: 'initialShelf',
    paramMapping: { bookId: 'bookId' },
  }
}

// Data
initialShelf: [
  { bookId: '60', title: '红楼梦' },
  { bookId: '20', title: '活着' },
]
```

**输出（Data 模式）**：
```json
{
  "edges": [
    {
      "source": "/bookshelf",
      "target": "/read/60",
      "label": "打开阅读器 → 红楼梦",
      "binding": { "bookId": { "source": "dataSource", "value": "60" } }
    },
    {
      "source": "/bookshelf",
      "target": "/read/20",
      "label": "打开阅读器 → 活着",
      "binding": { "bookId": { "source": "dataSource", "value": "20" } }
    },
    {
      "source": "/book/:bookId",
      "target": "/read/:bookId",
      "label": "打开阅读器",
      "binding": { "bookId": { "source": "unbound" } },
      "note": "抽象边：源节点无具体值，无法展开"
    }
  ]
}
```

> 注意：`/book/:bookId` → `/read/:bookId` 现在标记为 `unbound` 而非 `inherited`，
> 因为源节点是抽象的。只有当源节点是具体节点（如 `/book/60`）时，才会 `inherited`。

---

## 六、数据文件格式

### 6.1 数据配置示例

```typescript
// apps/WechatReading/data/index.ts
export const WECHAT_READING_CONFIG = {
  // 用户信息（标量）
  user: {
    id: 'user_me',
    membership: false,      // user.membership → eq 检查
    following: ['user_508'], // user.following → memberOf 检查
  },
  
  // 书架数据（集合）
  initialShelf: [
    { bookId: '60', isPrivate: true },
    { bookId: '20', isPrivate: false },
  ],
  
  // 推荐列表（集合）
  recommendations: [
    { id: '1', title: '纳瓦尔宝典' },
    { id: '2', title: '控糖革命' },
  ],
  
  // 用户列表（集合）
  users: [
    { id: 'user_508', name: '508' },
  ],
};
```

### 6.2 数据引用路径解析

| ref 路径 | 数据类型 | 用于 |
|---------|----------|------|
| `'initialShelf'` | 数组 | memberOf、dataSource 展开 |
| `'users'` | 数组 | memberOf、dataSource 展开 |
| `'user.following'` | 数组 | memberOf |
| `'user.membership'` | 标量 | eq 检查 |
| `'recommendations'` | 数组 | dataSource 展开 |

### 6.3 跨文件数据配置

#### 设计约定

`ref` 路径是相对于**单个配置对象**的。对于有多个数据文件的 App（如 Bilibili），需要在主配置中汇聚引用：

```typescript
// apps/Bilibili/data/index.ts
import { VIDEO_DATA } from './videoData';
import { AUTHOR_DATA } from './authorData';

export const BILIBILI_CONFIG = {
    user: { ... },
    videos: VIDEO_DATA,        // 引入视频数据
    authors: AUTHOR_DATA,      // 引入 UP 主数据（对象索引形式）
    // ...
};
```

#### 引用示例

```typescript
// 引用视频数据（数组形式，使用 [field={param}] 语法）
ref: 'videos[id={bvid}].title'

// 引用 UP 主数据（对象索引形式，使用 {param} 语法）
// AUTHOR_DATA 本身是 Record<mid, UserInfo>，mid 是 key
ref: 'authors.{mid}.videos'

// 当前用户的收藏夹（数组中查找）
ref: 'user.favoritesFolders[id={folderId}].videoIds'
```

#### 不同数据结构的 ref 语法

| 数据结构 | 示例 | ref 语法 |
|---------|------|----------|
| 数组（用 id 查找） | `videos: [{id: 'BV123', ...}]` | `videos[id={bvid}].title` |
| 数组（用其他字段查找） | `contacts: [{wxid: 'wxid_xxx', ...}]` | `contacts[wxid={wxid}].name` |
| 对象索引 | `authors: {123: {...}, 456: {...}}` | `authors.{mid}.name` |
| 嵌套数组 | `user.favoritesFolders: [{id: 'fav1', videoIds: [...]}]` | `user.favoritesFolders[id={folderId}].videoIds` |

> **设计优势**：
> - **代码组织不受限**：数据可以分文件管理，在主配置中汇聚
> - **ref 语法统一**：解析器只需处理一个配置对象
> - **类型安全**：主配置的类型定义可以精确描述所有字段

### 6.4 参数化路径的数据引用

#### 问题场景

当 `from` 是参数化路径时，数据源可能依赖于源路径的参数：

```typescript
// 场景：从其他用户的书架页跳转到书籍详情
// /user/user_508/shelf → /book/:bookId
// 数据源是该用户（user_508）的书架，而非当前用户的书架
```

#### 解决方案：ref 参数化语法

在 `ref` 字符串中使用 `[field={paramName}]` 语法进行数组查找：

```typescript
{
  id: 'book.detail.open',
  from: '/user/:userId/shelf',
  to: '/book/:bookId',
  params: { bookId: 'string' },
  
  dataSource: {
    ref: 'users[id={userId}].recentBooks',  // 参数化数组查找
    paramMapping: { bookId: '$value' },
  },
}
```

#### 语法规则

| 语法 | 含义 | 返回类型 | 示例 |
|------|------|----------|------|
| `[field={paramName}]` | 参数化查找：`find(x => x.field === paramValue)` | 单个元素 | `users[id={userId}].recentBooks` |
| `[field=value]` | 静态过滤：`filter(x => x.field === value)` | 数组子集 | `initialShelf[isPrivate=false]` |
| `[field!=value]` | 静态排除：`filter(x => x.field !== value)` | 数组子集 | `initialShelf[isPrivate!=true]` |
| `{paramName}` | 对象索引（当数据是对象而非数组时） | 单个元素 | `usersById.{userId}.shelf` |
| 静态路径 | 不依赖源参数的固定路径 | 原始值 | `initialShelf`、`recommendations` |

**过滤语法详解**：

```typescript
// 参数化查找：返回单个元素
ref: 'users[id={userId}].recentBooks'
// → users.find(u => u.id === boundParams.userId).recentBooks

// 静态过滤：返回子集数组
ref: 'initialShelf[isPrivate=false]'
// → initialShelf.filter(item => item.isPrivate === false)

// 支持的值类型：布尔值(true/false)、字符串、数字
```

#### 跨 App 通用性

不同 App 可能使用不同的主键字段名，语法设计支持显式指定：

```typescript
// 微信读书：users 数组使用 id 作为主键
ref: 'users[id={userId}].recentBooks'

// 微信：contacts 数组使用 wxid 作为主键
ref: 'contacts[wxid={wxid}].name'

// 微信：chats 数组使用 id 作为主键
ref: 'chats[id={chatId}].messages'
```

#### 解析器处理流程

1. **解析 ref 语法**：识别各种 token 类型
2. **获取源节点的 boundParams**：仅适用于具体节点（如 `/user/user_508`）
3. **参数替换**：将参数占位符替换为具体值
4. **路径解析**：按语法规则逐段解析

```typescript
/**
 * 解析参数化 ref 并获取数据
 * 
 * @param ref - 数据引用路径，支持多种语法
 * @param sourceNode - 源节点，包含 boundParams
 * @param data - 配置数据根对象
 * @returns 解析后的数据，或 null（参数未绑定或数据不存在时）
 */
function resolveParameterizedData(
  ref: string,
  sourceNode: Node,
  data: Record<string, any>
): any | null {
  // 解析 ref 为 token 序列
  const tokens = parseRefTokens(ref);
  let current = data;
  
  for (const token of tokens) {
    if (current === undefined || current === null) {
      return null;
    }
    
    // 模式 1：参数化数组查找 [field={paramName}] → 返回单个元素
    const paramLookupMatch = token.match(/^\[(\w+)=\{(\w+)\}\]$/);
    if (paramLookupMatch) {
      const [, field, paramName] = paramLookupMatch;
      const paramValue = sourceNode.boundParams?.[paramName];
      
      if (paramValue === undefined) return null;
      if (!Array.isArray(current)) return null;
      
      current = current.find(item => item[field] === paramValue);
      continue;
    }
    
    // 模式 2：静态过滤 [field=value] 或 [field!=value] → 返回数组子集
    const staticFilterMatch = token.match(/^\[(\w+)(=|!=)(\w+)\]$/);
    if (staticFilterMatch) {
      const [, field, op, valueStr] = staticFilterMatch;
      if (!Array.isArray(current)) return null;
      
      // 解析值类型
      const value = parseStaticValue(valueStr);
      
      current = current.filter(item => 
        op === '=' ? item[field] === value : item[field] !== value
      );
      continue;
    }
    
    // 模式 3：对象索引 {paramName}
    const objectIndexMatch = token.match(/^\{(\w+)\}$/);
    if (objectIndexMatch) {
      const paramName = objectIndexMatch[1];
      const paramValue = sourceNode.boundParams?.[paramName];
      
      if (paramValue === undefined) return null;
      current = current[paramValue];
      continue;
    }
    
    // 模式 4：普通字段访问
    current = current[token];
  }
  
  return current;
}

/**
 * 解析静态值字符串
 */
function parseStaticValue(valueStr: string): any {
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  if (/^\d+$/.test(valueStr)) return Number(valueStr);
  return valueStr;  // 字符串
}

/**
 * 将 ref 字符串解析为 token 序列
 */
function parseRefTokens(ref: string): string[] {
  const tokens: string[] = [];
  let remaining = ref;
  
  while (remaining.length > 0) {
    // 匹配数组查找语法 [field={param}]
    const arrayMatch = remaining.match(/^\[(\w+)=\{(\w+)\}\]/);
    if (arrayMatch) {
      tokens.push(arrayMatch[0]);
      remaining = remaining.slice(arrayMatch[0].length);
      if (remaining.startsWith('.')) remaining = remaining.slice(1);
      continue;
    }
    
    // 匹配下一个 segment（到 . 或 [ 为止）
    const segmentMatch = remaining.match(/^([^.\[]+)/);
    if (segmentMatch) {
      tokens.push(segmentMatch[1]);
      remaining = remaining.slice(segmentMatch[1].length);
      if (remaining.startsWith('.')) remaining = remaining.slice(1);
      continue;
    }
    
    break;
  }
  
  return tokens;
}
```

#### 数组查找示例

```typescript
// 微信读书：users 数组使用 id 作为主键
users: [
  { id: 'user_508', recentBooks: ['61', '62'] },
  { id: 'user_123', recentBooks: ['101'] },
]

// ref: 'users[id={userId}].recentBooks'
// sourceNode.boundParams: { userId: 'user_508' }

// 解析过程：
// 1. 'users' → 得到数组 [{ id: 'user_508', ... }, ...]
// 2. '[id={userId}]' → 数组查找: users.find(u => u.id === 'user_508')
//    → 得到 { id: 'user_508', recentBooks: ['61', '62'] }
// 3. 'recentBooks' → 得到 ['61', '62']
```

```typescript
// 微信：contacts 数组使用 wxid 作为主键
contacts: [
  { wxid: 'wxid_blank_001', name: 'blank.' },
  { wxid: 'wxid_zhangwei_888', name: '张伟' },
]

// ref: 'contacts[wxid={wxid}].name'
// sourceNode.boundParams: { wxid: 'wxid_blank_001' }

// 解析过程：
// 1. 'contacts' → 得到数组
// 2. '[wxid={wxid}]' → 数组查找: contacts.find(c => c.wxid === 'wxid_blank_001')
// 3. 'name' → 得到 'blank.'
```

#### 设计优势

- **无需修改数据结构**：保持数组形式，运行时代码和声明共享同一数据
- **跨 App 通用**：显式指定查找字段，适配不同 App 的主键命名（`id`、`wxid` 等）
- **语义清晰**：`users[id={userId}].recentBooks` 明确表达"在 users 中查找 id 等于 userId 的元素的 recentBooks"
- **与对象索引兼容**：如果数据是对象形式，可使用 `{paramName}` 语法

#### 展开示例

**输入**：

```typescript
// Transition
{
  id: 'book.detail.open',
  from: '/user/:userId/shelf',
  to: '/book/:bookId',
  params: { bookId: 'string' },
  dataSource: {
    ref: 'users[id={userId}].recentBooks',  // 数组查找语法
    paramMapping: { bookId: '$value' },
  },
}

// Data（数组形式，无需修改）
users: [
  {
    id: 'user_508',
    name: '508',
    recentBooks: ['61', '62', '63'],
  },
  {
    id: 'user_123',
    name: '123',
    recentBooks: ['101'],
  },
]
```

**输出（Data 模式）**：

```json
{
  "edges": [
    {
      "source": "/user/user_508/shelf",
      "target": "/book/61",
      "binding": { "bookId": { "source": "dataSource", "value": "61" } }
    },
    {
      "source": "/user/user_508/shelf",
      "target": "/book/62",
      "binding": { "bookId": { "source": "dataSource", "value": "62" } }
    },
    {
      "source": "/user/user_123/shelf",
      "target": "/book/101",
      "binding": { "bookId": { "source": "dataSource", "value": "101" } }
    },
    {
      "source": "/user/:userId/shelf",
      "target": "/book/:bookId",
      "binding": { "bookId": { "source": "unbound" } },
      "note": "抽象边：源节点的 userId 未绑定，无法解析 ref"
    }
  ]
}
```

#### 与现有设计的关系

| 方面 | 说明 |
|------|------|
| **类型定义** | 无变化，`ref: string` 类型不变 |
| **数据结构** | 无变化，`DataSourceDeclaration` 接口不变 |
| **解析器实现** | 需要支持 `[field={param}]` 和 `{param}` 语法解析 |
| **向后兼容** | 完全兼容，不含特殊语法的 ref 按原有逻辑处理 |

> ⚠️ **实现位置**：参数化 ref 的解析完全在工具链（解析器/建图脚本）层面实现，声明的类型定义和数据结构无需任何变化。

---

## 七、工具链支持

### 7.1 建图脚本扩展

```bash
# Schema 模式（默认，使用占位符）
node scripts/navigation_declaration_analyzer.mjs WechatReading \
  -o public/wechatreading_nav_graph.json --format pretty

# Data 模式（使用真实数据展开）
node scripts/navigation_declaration_analyzer.mjs WechatReading \
  --data apps/WechatReading/data/index.ts \
  -o public/wechatreading_data_graph.json --format pretty
```

### 7.2 Viewer 支持

在 `nav_graph_viewer.html` 中添加：

- **Schema View**：显示 `/read/:bookId`（当前）
- **Data View**：显示 `/read/60`、`/read/20` 等展开节点
- **Condition Display**：显示 condition 的数据依赖

### 7.3 输出格式

**Schema 模式**（现有）：
```json
{
  "nodes": [
    { "id": "/read/:bookId", "component": "ReaderPage" }
  ],
  "edges": [
    { "source": "/bookshelf", "target": "/read/:bookId", "label": "打开阅读器" }
  ]
}
```

**Data 模式**（新增）：
```json
{
  "nodes": [
    { 
      "id": "/read/60",
      "routePath": "/read/:bookId",
      "component": "ReaderPage",
      "boundParams": { "bookId": "60" },
      "data": { "title": "红楼梦" }
    }
  ],
  "edges": [
    { 
      "source": "/bookshelf", 
      "target": "/read/60", 
      "label": "打开阅读器 → 红楼梦",
      "binding": { "bookId": { "source": "dataSource", "value": "60" } }
    }
  ]
}
```

#### 具体节点结构规范

Data 模式的节点必须同时包含：

```typescript
interface ConcreteNode {
  /** 具体路径（给人看、给轨迹用） */
  id: string;                              // '/read/60'
  
  /** 模板路径（给工具查 component/uiStates 用） */
  routePath: string;                       // '/read/:bookId'
  
  /** 绑定的参数值（给继承/条件评价用） */
  boundParams: Record<string, string>;     // { bookId: '60' }
  
  /** 组件名（从 routePath 对应的 route 声明查到） */
  component: string;                       // 'ReaderPage'
  
  /** 关联数据（从 dataSource 获取，用于显示） */
  data?: Record<string, any>;              // { title: '红楼梦' }
}
```

> ⚠️ **关键**：`routePath` 是必须的，否则无法将具体节点映射回 route 声明来查找 `component`、`uiStates` 等元信息。

---

## 八、条件与数据源的设计理念（v0.5）

### 8.1 核心设计原则

**v0.5 变更**：条件从 `TransitionDeclaration` 移动到更语义正确的位置。

| 概念 | 位置 | 语义 | 问题 |
|------|------|------|------|
| ~~TransitionDeclaration.stateCondition~~ | ❌ 已废弃 | "跳转条件" | 语义混淆 |
| `uiStates[].stateCondition` | ✅ 新增 | 状态节点是否存在 | 动态 Tab、条件页面 |
| `ui.condition` | ✅ 新增 | 跳转入口是否显示 | 条件按钮、权限控制 |

**设计理念**：

1. **状态存在 vs 入口显示**：这是两个不同层面的概念
   - 状态不存在 → 节点不存在 → 所有指向它的边自然消失
   - 入口不显示 → 该边不存在 → 但目标状态可能仍存在

2. **入口显示 ≠ 跳转条件**：如果入口能正常显示，那么自然就能跳转
   - 条件描述的是"UI 入口的显示"，而非"跳转的可行性"

### 8.2 条件类型与适用场景

| 操作符 | 适用位置 | 语义 | 典型场景 |
|--------|----------|------|----------|
| `notEmpty` | 两者皆可 | 集合非空时存在/显示（取决于挂载位置） | 动态 Tab、条件入口 |
| `eq` | 两者皆可 | 值相等时显示 | 会员专属功能 |
| `memberOf` | `ui.condition` | 参数在集合中时显示 | 条件按钮（如"书架管理"） |

### 8.3 条件与 dataSource 的关系

两者使用相同的 `ref` 语法，且常常引用相同的数据源：

```typescript
{
  ui: {
    placement: 'content',
    gesture: 'tap',
    // 入口显示条件：bookId 在书架中
    condition: {
      op: 'memberOf',
      ref: 'initialShelf',        // 引用 initialShelf 集合
      param: 'bookId',
      field: 'bookId',
    },
  },
  // 数据展开：bookId 的值来自 initialShelf
  dataSource: {
    ref: 'initialShelf',          // 相同的 ref
    paramMapping: { bookId: 'bookId' },
  },
}
```

**语义关联**：当 `ui.condition` 和 `dataSource` 的 `ref` 相同时，它们在逻辑上是一致的：
- `memberOf(initialShelf, bookId)` → 只有 initialShelf 中的书才显示入口
- `dataSource: initialShelf → bookId` → bookId 的具体值来自 initialShelf

### 8.4 图生成中的处理

#### Schema 模式（不引入具体数据）

**处理规则**：
- **节点**：所有 `uiStates` 都生成节点（因为声明中存在）
- **边**：所有 transitions 都生成边（因为声明中存在该入口/跳转）
- **条件**：`condition` 仅作为**元数据标注**，告诉你"这个入口/状态在什么数据条件下才存在"

```json
{
  "nodes": [
    {
      "id": "/my-profile?tab=finished",
      "condition": { "op": "notEmpty", "ref": "shelf[isPrivate=false]", "filterFn": "..." }
    }
  ],
  "edges": [
    {
      "source": "/book/:bookId",
      "target": "/book/:bookId?modal=shelf",
      "condition": { "op": "memberOf", "ref": "initialShelf", "param": "bookId" }
    }
  ]
}
```

#### Data 模式（引入具体数据快照，条件可被评估）

**处理规则**：
- **节点**：评估 `uiStates[].stateCondition`，决定节点是否生成
- **边**：评估 `ui.condition`，决定边是否生成

**条件评估结果与处理**：

| 评估结果 | 处理 | 说明 |
|----------|------|------|
| 满足 | ✅ 保留 | 生成该节点/边 |
| 不满足且可评价 | ❌ 剪掉 | 不生成该节点/边 |
| 无法计算/数据不足（缺参数/缺数据） | ⚠️ 保留（保守策略） | 标注 `unevaluable` + `reason` |

> 说明：这里的“无法计算/数据不足”指 **条件在 data 模式下无法求值真/假**（常见原因：缺 `boundParams` 或缺数据字段）。

**示例输出**：
```json
{
  "nodes": [
    { "id": "/my-profile?tab=shelf" }
    // /my-profile?tab=finished 不存在（条件不满足：没有读完的书）
  ],
  "edges": [
    { "source": "/book/60", "target": "/book/60?modal=shelf" },
    // /book/20 → ... 不存在（条件不满足：20 不在书架中）
    {
      "source": "/book/:bookId",
      "target": "/book/:bookId?modal=shelf",
      "conditionStatus": { "status": "unevaluable", "reason": "param bookId not bound" }
    }
  ]
}
```

### 8.5 条件评估规则

```typescript
function evaluateCondition(
  condition: StateCondition,
  context: { boundParams: Record<string, string>, data: ConfigData }
): { satisfied: boolean; evaluable: boolean; reason?: string } {
  
  // v0.8: 组合条件
  if (condition.op === 'always') {
    return { satisfied: true, evaluable: true };
  }
  if (condition.op === 'and') {
    if (!condition.items || condition.items.length === 0) {
      return { satisfied: true, evaluable: false, reason: 'and.items missing/empty' };
    }
    let hasUnevaluable = false;
    for (const item of condition.items) {
      const r = evaluateCondition(item, context);
      if (r.evaluable && !r.satisfied) return { satisfied: false, evaluable: true };
      if (!r.evaluable) hasUnevaluable = true;
    }
    return hasUnevaluable
      ? { satisfied: true, evaluable: false, reason: 'and has unevaluable items' }
      : { satisfied: true, evaluable: true };
  }
  if (condition.op === 'or') {
    if (!condition.items || condition.items.length === 0) {
      return { satisfied: true, evaluable: false, reason: 'or.items missing/empty' };
    }
    let hasUnevaluable = false;
    let anyEvaluable = false;
    for (const item of condition.items) {
      const r = evaluateCondition(item, context);
      if (r.evaluable) anyEvaluable = true;
      if (r.evaluable && r.satisfied) return { satisfied: true, evaluable: true };
      if (!r.evaluable) hasUnevaluable = true;
    }
    if (anyEvaluable && !hasUnevaluable) return { satisfied: false, evaluable: true };
    return { satisfied: true, evaluable: false, reason: 'or has unevaluable items' };
  }
  if (condition.op === 'not') {
    if (!condition.item) return { satisfied: true, evaluable: false, reason: 'not.item missing' };
    const r = evaluateCondition(condition.item, context);
    if (!r.evaluable) return { satisfied: true, evaluable: false, reason: 'not has unevaluable item' };
    return { satisfied: !r.satisfied, evaluable: true };
  }

  // v0.8: 参数 vs ref 对比（常用于“自己/他人”）
  if (condition.op === 'paramEq' || condition.op === 'paramNeq') {
    const paramValue = context.boundParams[condition.param];
    if (paramValue === undefined) {
      return { satisfied: false, evaluable: false, reason: `param ${condition.param} not bound` };
    }
    const refValue = resolveRefData(condition.ref, context.boundParams, context.data);
    if (refValue === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    if (refValue !== null && typeof refValue === 'object') {
      return { satisfied: true, evaluable: false, reason: 'ref is not primitive' };
    }
    const eq = String(paramValue) === String(refValue);
    return { satisfied: condition.op === 'paramEq' ? eq : !eq, evaluable: true };
  }

  if (condition.op === 'notEmpty') {
    let items = resolveRefData(condition.ref, context.boundParams, context.data);
    if (!Array.isArray(items)) {
      return { satisfied: false, evaluable: true, reason: 'ref is not array' };
    }
    if (condition.filterFn) {
      items = applyFilterFn(items, condition.filterFn, context.data);
    }
    return { satisfied: items.length > 0, evaluable: true };
  }
  
  if (condition.op === 'memberOf') {
    const paramValue = context.boundParams[condition.param!];
    if (paramValue === undefined) {
      return { satisfied: false, evaluable: false, reason: `param ${condition.param} not bound` };
    }
    let collection = resolveRefData(condition.ref, context.boundParams, context.data);
    if (!Array.isArray(collection)) {
      return { satisfied: false, evaluable: false, reason: 'ref is not array' };
    }
    if (condition.filterFn) {
      collection = applyFilterFn(collection, condition.filterFn, context.data);
    }
    const field = condition.field ?? '$value';
    const inSet = collection.some(item => 
      field === '$value' ? item === paramValue : item[field] === paramValue
    );
    return { satisfied: inSet, evaluable: true };
  }
  
  if (condition.op === 'eq') {
    const value = resolveRefData(condition.ref, context.boundParams, context.data);
    if (value === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    return { satisfied: value === condition.equals, evaluable: true };
  }
  
  return { satisfied: true, evaluable: false, reason: `unknown op: ${(condition as any).op}` };
}
```

### 8.6 独立使用场景

```typescript
// 只有 ui.condition，无 dataSource（入口条件，无需展开）
{
  ui: {
    condition: { op: 'eq', ref: 'user.membership', equals: true },
  },
}

// 只有 dataSource，无 ui.condition（始终显示，但参数需展开）
{
  dataSource: { ref: 'recommendations', paramMapping: { bookId: 'id' } },
}

// 只有 uiStates[].stateCondition（动态状态，无特殊入口条件）
uiStates: [{
  id: 'myProfile.finished',
  search: { tab: 'finished' },
  stateCondition: { op: 'notEmpty', ref: 'shelf[isPrivate=false]', filterFn: '...' },
}]
```

---

## 九、实现计划

### Phase 1：类型定义（本阶段）
- [x] 设计 `DataSourceDeclaration` 类型
- [x] 设计统一的 `StateCondition` 类型
- [x] 定义参数绑定语义（inherited 基于 boundParams）
- [x] 定义 dataSource 匹配规则（先匹配后优先级）
- [x] 支持 `$value` 用于简单数组展开
- [x] 支持 `$key` 用于对象（Record）keys 展开（按 key 排序，确保稳定）
- [x] 定义边剪枝规则（条件可评价时才剪枝）
- [x] 定义 FromConstraint search 匹配语义（'*'/null/'xxx'）
- [x] 定义具体节点结构（id + routePath + boundParams）
- [x] 统一 binding 结构（dataSource/inherited 都带 value）
- [x] 限定 paramMapping 作用域（仅 path params）
- [x] 定义类型校验规则（memberOf→数组，eq→标量）
- [x] 设计参数化 ref 语法（`{paramName}` 引用源路径参数）

### Phase 2：声明应用
- [x] 在 `navigation.types.ts` 中添加类型定义
- [x] 在 `navigation.declaration.ts` 中为关键 transitions 添加声明
- [ ] 重点：`reader.open`、`book.detail.open`、`book.modal.shelf.open`

### Phase 3：建图脚本
- [x] 支持 `--data` 参数加载数据文件
- [ ] 实现数据路径解析（支持点分隔路径）
- [x] 实现参数化 ref 解析（支持 `{paramName}` 语法）
- [ ] 实现参数绑定推断
- [ ] 实现图展开逻辑

### Phase 4：Viewer
- [ ] 添加 Schema/Data 视图切换
- [ ] 展开节点的样式区分
- [ ] condition 的可视化

---

## 十、设计决策记录

### 10.1 为什么使用统一的 `ref` 语法

**决策**：`condition.ref` 和 `dataSource.ref` 使用相同的数据路径语法。

**理由**：
- 减少概念数量
- 便于理解两者的关联
- 支持未来的自动推断优化

### 10.2 为什么参数绑定是自动推断的

**决策**：不要求用户显式声明 `paramBinding: 'dataSource' | 'inherited'`。

**理由**：
- 推断规则简单明确
- 减少声明冗余
- 大多数情况下推断结果符合预期

### 10.3 为什么 condition 使用 op 字段

**决策**：使用 `op: 'memberOf' | 'eq'` 而非隐式约定。

**理由**：
- 机器可处理，便于静态分析
- 语义明确，不依赖命名约定
- 扩展性好，未来可添加更多操作符

### 10.4 为什么 inherited 基于 boundParams 而非路径模板

**决策**：判断 `inherited` 时检查 `sourceNode.boundParams[param]`，而非 `path.includes(':param')`。

**理由**：
- 抽象节点 `/book/:bookId` 没有具体值可继承
- 只有具体节点 `/book/60` 才有 `boundParams.bookId = '60'`
- 避免错误地将 `unbound` 边标记为 `inherited`

### 10.5 为什么边剪枝需要条件可评价

**决策**：只有当条件可评价时才剪枝，无法计算/数据不足时保守保留。

**理由**：
- `memberOf` 需要参数的具体值才能判断
- 抽象边（参数未绑定）无法判断成员关系
- 错误剪枝会导致图不完整
- 标注 `unevaluable` 便于调试和理解

### 10.6 为什么 dataSource 匹配需要优先级规则

**决策**：定义精确 > 通配符 > 兜底的优先级，同级冲突报错。

**理由**：
- 多个 dataSource 可能都匹配同一源节点
- 无确定性规则会导致不可预测的展开结果
- 静态分析阶段报错优于运行时不确定行为

### 10.7 为什么 dataSource 匹配需要先验证再排序

**决策**：先用 `matchFromConstraint()` 过滤匹配项，再按优先级排序。

**理由**：
- 仅有优先级而无匹配验证会导致误选
- 例如 `{ path: '/list', search: { category: 'all' } }` 不应匹配 `category=reading` 的节点
- 复用 FromConstraint 的 `*`/`null`/'xxx' 语义保持一致性

### 10.8 为什么具体节点需要 routePath

**决策**：Data 模式节点必须同时包含 `id`（具体路径）和 `routePath`（模板路径）。

**理由**：
- `id = '/read/60'` 用于显示和轨迹记录
- `routePath = '/read/:bookId'` 用于查找 route 声明的 component/uiStates
- 没有 routePath，无法将具体节点映射回声明

### 10.9 为什么 binding 统一带 value

**决策**：`dataSource` 和 `inherited` 的 binding 都必须包含 `value` 字段。

**理由**：
- 剪枝逻辑需要 `edge.binding?.[param]?.value`
- 若 inherited 不带 value，即使源节点有具体值也无法剪枝
- 统一结构便于调试和轨迹记录

### 10.10 为什么 paramMapping 仅限 path params

**决策**：`paramMapping` 仅用于填充 `to` 的 path params，不用于 searchParams。

**理由**：
- 降低复杂度
- searchParams 由 `transition.search`/`searchParams` 显式指定
- 避免与现有机制产生歧义

### 10.11 为什么类型不符时返回 unevaluable 而非默认值

**决策**：`memberOf` 期望数组、`eq` 期望标量，类型不符时返回 `unevaluable` + warning。

**理由**：
- 悄悄把非数组当空数组处理会导致错误剪枝
- 明确的 warning 帮助开发者发现配置错误
- 保守保留边比错误删除边更安全

### 10.12 为什么参数化 ref 使用 `[field={paramName}]` 语法

**决策**：在 `ref` 字符串中使用 `[field={paramName}]` 语法进行数组查找，支持显式指定查找字段。

**理由**：
- **类型定义无需变化**：`ref: string` 保持不变，向后兼容
- **解析器层面实现**：参数解析逻辑完全在工具链中实现，不影响声明文件
- **跨 App 通用**：不同 App 使用不同主键字段（`id`、`wxid` 等），显式指定避免歧义
- **语法自描述**：`users[id={userId}].recentBooks` 清晰表达"在 users 中查找 id 等于 userId 的元素"
- **惰性求值**：只有源节点有具体 boundParams 时才解析，抽象节点生成抽象边

### 10.13 为什么不使用隐式 `id` 字段查找

**决策**：拒绝 `users.{userId}.field` 隐式假设用 `id` 字段查找的设计。

**理由**：
- **微信读书**：`users` 数组使用 `id` 字段作为主键
- **微信**：`contacts` 数组使用 `wxid` 字段作为主键
- **Bilibili**：可能使用 `mid`、`bvid` 等字段
- 隐式约定无法覆盖所有 App，显式 `[field={param}]` 语法更通用

### 10.14 为什么要求数据汇聚到单个配置对象

**决策**：`ref` 路径相对于单个配置对象，多文件数据需在主配置中汇聚引用。

**理由**：
- **解析器简单**：只需处理一个配置对象，无需管理多数据源
- **代码组织自由**：数据可以分文件管理（如 Bilibili 的 videoData.ts、authorData.ts）
- **ref 语法统一**：所有 App 使用相同的点分隔路径语法
- **类型安全**：主配置可以提供完整的类型定义

**示例**（Bilibili）：
```typescript
// 分文件组织
import { VIDEO_DATA } from './videoData';
import { AUTHOR_DATA } from './authorData';

// 在主配置中汇聚
export const BILIBILI_CONFIG = {
    videos: VIDEO_DATA,
    authors: AUTHOR_DATA,
};

// ref 引用
ref: 'videos[id={bvid}].title'
ref: 'authors.{mid}.videos'
```

### 10.15 为什么添加静态过滤语法 `[field=value]`

**决策**：扩展 ref 语法支持静态过滤条件 `[field=value]` 和 `[field!=value]`。

**场景**：
```typescript
// 我的主页只显示公开书籍
// 代码逻辑：shelf.filter(item => !item.isPrivate)
// 数据源需要表达这个过滤条件
ref: 'initialShelf[isPrivate=false]'
```

**理由**：
- **参数化查找 vs 静态过滤**：`[field={param}]` 返回单个元素，`[field=value]` 返回数组子集
- **语法一致**：都使用 `[...]` 括号，区别在于 `{...}` 表示参数，裸值表示静态值
- **避免生成无效边**：若不过滤，会为 `isPrivate=true` 的书籍生成不存在的导航边
- **声明式**：过滤条件在声明中明确表达，而非隐藏在解析器逻辑中

**支持的操作符**：
| 操作符 | 含义 | 示例 |
|--------|------|------|
| `=` | 等于 | `[isPrivate=false]` |
| `!=` | 不等于 | `[status!=deleted]` |

**支持的值类型**：
- 布尔值：`true`、`false`
- 数字：`1`、`42`
- 字符串：`active`、`pending`

### 10.16 为什么添加 `filterFn` 动态过滤

**决策**：支持 `filterFn` 字符串表达式，用于复杂的跨数据源过滤逻辑。

**场景**：
```typescript
// 阅读列表的 "读完" 分类需要关联多个数据源计算
// isFinished = bookProgress[bookId].charOffset >= store.find(b => b.id === bookId).totalWords
```

**语法**：
```typescript
dataSource: {
  from: { path: '/reading-list', search: { category: 'finished' } },
  ref: 'initialShelf',
  filterFn: '(item, data) => { 
    const progress = data.bookProgress[item.bookId]; 
    const book = data.store.find(b => b.id === item.bookId); 
    return progress && book && progress.charOffset >= book.totalWords; 
  }',
  paramMapping: { bookId: 'bookId' },
}
```

**理由**：
- **灵活性**：可表达任意计算逻辑，包括跨数据源关联
- **不修改数据配置**：无需在数据文件中预计算派生数据
- **声明式**：过滤逻辑在导航声明中显式表达
- **解析器支持**：使用 `new Function` 执行，安全可控

**函数签名**：
```typescript
(item: any, data: ConfigData) => boolean
```
- `item`：当前遍历的数组元素
- `data`：完整的配置数据对象

---

## 附录 A：从旧版 stateCondition 迁移

### A.1 v0.4 → v0.5 迁移

**v0.4 写法**（TransitionDeclaration 顶层）：
```typescript
{
  id: 'book.modal.shelf.open',
  // ...
  stateCondition: {
    op: 'memberOf',
    ref: 'initialShelf',
    param: 'bookId',
    field: 'bookId',
    text: '已加入书架',
  },
}
```

**v0.5 写法**（移至 ui.condition）：
```typescript
{
  id: 'book.modal.shelf.open',
  // ...
  ui: {
    placement: 'content',
    gesture: 'tap',
    condition: {
      op: 'memberOf',
      ref: 'initialShelf',
      param: 'bookId',
      field: 'bookId',
      text: '已加入书架',
    },
  },
}
```

### A.2 v0.3 → v0.5 迁移（旧版谓词函数）

**v0.3 写法**（谓词函数引用）：
```typescript
stateCondition: {
  ref: 'inShelf',      // 旧版谓词函数名
  equals: true,
  text: '已加入书架',
}
```

**v0.5 写法**：
```typescript
ui: {
  condition: {
    op: 'memberOf',      // 显式操作符
    ref: 'initialShelf', // 数据路径
    param: 'bookId',     // 参数名
    field: 'bookId',     // 字段名
    text: '已加入书架',
  },
}
```

**迁移对照**：
| 旧版 ref | 新版 ui.condition |
|----------|----------|
| `'inShelf'` | `{ op: 'memberOf', ref: 'initialShelf', param: 'bookId', field: 'bookId' }` |
| `'isFollowing'` | `{ op: 'memberOf', ref: 'user.following', param: 'userId', field: '$value' }` |
| `'isVipUser'` | `{ op: 'eq', ref: 'user.membership', equals: true }` |

> 注：`field: '$value'` 表示数组元素本身就是值（如 `['user_508']`），而非对象的字段。
