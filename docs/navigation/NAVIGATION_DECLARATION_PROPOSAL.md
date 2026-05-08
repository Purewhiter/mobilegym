# 导航声明式状态机方案

> **版本说明**：
> - 本文档版本：v3.3（见附录 D 修订历史）
> - `StateCondition` 子版本：v0.8（组合条件 + 参数对比）
> - `DataSourceDeclaration` 子版本：v0.5
> 
> 子版本号用于追踪特定类型的演进，与主文档版本独立。

## 一、方案概述

### 1.1 背景与目标

为实现 UI 状态转移图的自动化构建及 **Agent 训练数据采集**，需要一套完整的导航声明机制。该机制将所有页面状态收敛为声明式定义，确保：

1. **完整性** — 所有导航路径可静态获取，无需运行时探索
2. **类型安全** — TypeScript 编译时检查，杜绝无效跳转
3. **可追溯** — 每个跳转元素与声明一一对应，支持自动化测试
4. **状态完备** — 包含滚动位置等连续状态，支持 Agent 训练数据采集

### 1.2 核心设计

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       navigation.declaration.ts                           │
│  ┌─────────┐    ┌──────────────┐    ┌──────────────────┐                 │
│  │ routes  │    │ transitions  │    │ scrollContainers │                 │
│  └─────────┘    └──────────────┘    └──────────────────┘                 │
└──────────────────────────────────────────────────────────────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
    页面定义         路由/状态跳转              滚动容器定义
   /chat/:id    go('chat.open')           { name, direction }
                go('modal.open')
```

### 1.3 API 设计

| API | 用途 | 是否声明 |
|-----|------|---------|
| `go(id, params)` | 路由跳转 / URL 状态变更 | ✅ 必须声明（transitions） |
| `back(steps?)` | 历史回退 | ❌ 内建动作 |
| `action` | 动作（通常不改变 URL；允许“回退型提交”） | ✅ 必须声明（actions） |

**核心约束**：
- 业务代码禁止直接调用 `navigate()`
- 所有导航必须通过 `go()` 或 `back()` 触发
- 滚动状态不写入 URL（与现有“主 Tab 常驻”策略兼容）；如需采集滚动信息，使用 `window.__getScrollMeta__`（见第 4 章）

### 1.4 Transitions vs Actions

| 概念 | 触发方式 | URL 变化 | DOM 标记 | 适用场景 |
|------|----------|----------|----------|----------|
| **Transition** | `go(id, params)` | ✅ 会改变 | `data-trigger` | 页面跳转、Tab 切换、Modal 打开 |
| **Action** | `onTrigger` 回调 | 通常 ❌；回退型提交可 `back()` | `data-action` | 开关切换、表单提交、点赞/收藏 |

- `transition`（`data-trigger`）是 **图的边**：会触发 `go()`，改变 URL/状态节点
- `action`（`data-action`）是 **节点上的注释（node annotation）**：表达"在这个节点上可执行哪些原地动作"

### 1.5 URL 状态组成

```
/video/123?modal=share&itemId=42
\________/ \___________________/
     │               │
  pathname        search
  (路由)     (离散 UI 状态)
```

> [!IMPORTANT]
> **术语澄清：在本方案里，“route/路由”指的是离散的 `pathname + search`（也就是完整 URL 的离散部分）。**
>
> - 在 `react-router-dom` 中，页面匹配通常由 **`pathname`** 决定，但 `search`（query）同样属于 location 状态的一部分。
> - 为避免歧义：本文将 `routes[].path` / `RouteDeclaration.path`（如 `/book/:bookId`）称为 **routePath（pathname 模板）**；而 **route/route-state 节点**指 `routePath + 离散 search`（如 `/book/:bookId?modal=shelf`）。
> - 本方案将 `search` 中的 **离散 UI 状态**（如 `modal/tab/menu/select/sub/...`）视为 route 的一部分：例如 `'/book/:bookId?modal=shelf'` 是一个独立 route 节点。
> - “切换页面时 URL 是否只变 pathname / 是否保留 query”并不是浏览器自动行为，而是由导航函数构造目标 URL 决定：
>   - `navigate('/me')` 会得到精确的 `/me`（没有 query）
> - 本方案要求 **目标离散 query 必须在 transition 中完整显式给出**（静态 `search` + 动态 `searchParams`），不会从当前 URL “继承/保留”任何离散 query。

---

## 二、类型定义

### 2.1 声明文件结构

```typescript
// apps/<AppName>/navigation.declaration.ts

export interface NavigationDeclaration {
  /** 应用标识 */
  app: string;
  
  /** 路由定义 */
  routes: RouteDeclaration[];
  
  /** 状态转移声明（路由跳转 + URL 状态变更） */
  transitions: TransitionDeclaration[];
  
  /** 内建能力配置（必须显式声明，不允许依赖默认值） */
  capabilities: {
    /** 是否支持历史回退（必须显式声明） */
    historyBack: boolean;
  };
}
```

### 2.2 路由声明

```typescript
export interface RouteDeclaration {
  /** 路由路径，支持动态参数，如 '/chat/:id' */
  path: string;
  
  /** 组件名称 */
  component: string;
  
  /** 路径参数类型定义（无参数时填空对象） */
  params: Record<string, 'string' | 'number'>;
  
  /**
   * 入口声明（必须显式填写）
   *
   * - 'home'：应用首页入口（用于图生成/任务生成的默认起点）
   * - 'deepLink'：允许外部链接直达（Deep Link）
   * - 'both'：既是首页入口，又允许外部链接直达
   * - 'none'：都不允许
   *
   * 说明：
   * - 首页入口节点默认取该路由 `uiStates[0]` 对应的节点（避免“同一路由多个 tab 都是入口”的歧义）
   * - deepLink 仅表达“可被外部直达”，不等价于“图搜索起点”
   */
  entryPoint: 'none' | 'home' | 'deepLink' | 'both';
  
  /** 该路由的可滚动容器（用于滚动观测/动作引用；不用则为空数组） */
  scrollContainers: ScrollContainerDeclaration[];

  /**
   * 该路由下的离散 UI 子状态（仅限有限可枚举的 UI mode）
   * 
   * ### 什么需要枚举
   * - modal/tab/menu/select 等**有限集合**的 UI 模式
   * - 例如：`{ modal: 'shelf' }`, `{ tab: 'comment' }`, `{ select: 'true' }`
   * 
   * ### 什么不需要枚举（使用 queryParams 声明）
   * - 无限集合的运行时值：`q`(搜索词), `itemId`, `page`, `mid` 等
   * - 这些在 `queryParams` 中声明类型，图节点使用变量占位符表示
   * 
   * ### 组合状态的处理
   * - 如果存在 `select + modal` 这样的组合，只需枚举实际可达的组合
   * - 例如：先进入 select 模式，再打开 confirm modal，则枚举：
   *   - `{ select: 'true' }`
   *   - `{ select: 'true', modal: 'confirm_remove' }`
   * - 无需枚举不可达的组合（如单独 `{ modal: 'confirm_remove' }` 如果必须先 select）
   */
  uiStates: Array<{
    /**
     * 状态唯一标识
     * 
     * 命名规范：
     * - 若 `search` 为 `{}`（无离散参数的 base 状态），则 `id` 必须以 `.base` 结尾
     * - 同一路由内只保留一个 base uiState
     * - 示例：`settings.autoDownload.base`、`bookshelf.base`
     */
    id: string;
    /** 静态 query 值（有限集合） */
    search: Record<string, string | null>;
    description: string;
    /**
     * 状态存在条件（可选，v0.5）
     *
     * 用于描述“该 UI 状态是否存在”（动态 Tab、条件页面等）。
     * - Schema 模式：节点存在，标注条件
     * - Data 模式：条件可评价且不满足时可剪枝（节点不生成）
     *
     * 详细条件语法见 DATA_SOURCE_PROPOSAL.md
     */
    stateCondition?: StateCondition;
    
    /**
     * 该状态下可执行的原地动作（可选）
     * 
     * Actions 是"节点上的动作清单"，描述在当前状态下有哪些可点的原地动作。
     * 详见 ActionDeclaration 类型定义。
     */
    actions?: ActionDeclaration[];

    /**
     * 本地子状态（可选，vNext）
     *
     * 用于描述“不进入 URL / 不形成导航图节点”的局部 UI 状态（如：非阻塞面板、toast、tooltip）。
     * 它不会生成新的节点，仅用于语义标注；通常与 actions.effects 关联。
     */
    localStates?: LocalStateDeclaration[];
  }>;
  
  /**
   * 该路由下的动态 query 参数声明（无限集合，不枚举）
   * - 这些参数的具体值在运行时决定
   * - 图节点中使用 `:paramName` 占位符表示
   * - 例如：`{ itemId: 'string', page: 'number' }`
   * 
   * 注意：queryParams 不会独立形成图节点，它们附加在 uiStates 节点上
   */
  queryParams: Record<string, 'string' | 'number'>;
  
  /** 路由描述 */
  description: string;
}

export interface ScrollContainerDeclaration {
  /** 容器标识，用于 URL 参数名 */
  name: string;
  
  /** 滚动方向 */
  direction: 'vertical' | 'horizontal';
  
  /** 描述 */
  description: string;
}

/**
 * 本地子状态声明（vNext）
 *
 * 描述“局部 UI 状态”（不进入 URL，不形成导航图节点）。
 * 典型场景：关注成功后出现的“你可能感兴趣”面板（可继续点击其它按钮）。
 */
export interface LocalStateDeclaration {
  /** app 内唯一标识（建议带父 uiState 前缀） */
  id: string;
  description: string;
  /** 是否阻塞底层交互：modal=true；非阻塞面板/气泡=false */
  blocking?: boolean;
  /**
   * 生命周期/记忆范围（可选，仅语义）
   * - routeEntry：绑定到 history entry（location.key），push/back 仍保留；entry 被 pop 后消失
   * - session：应用挂载期间保留
   * - none：不保留（一次性）
   */
  persistence?: 'none' | 'routeEntry' | 'session';
  /** 进入方式（纯语义，不参与路由/图生成） */
  enterBy?: Array<{ kind: 'action' | 'transition'; id: string }>;
  /** 退出方式（纯语义，不参与路由/图生成） */
  exitBy?: Array<{ kind: 'action' | 'transition'; id: string }>;
  notes?: string;
}

/**
 * Action 的可观测 UI 副作用（可选，仅语义）
 */
export type ActionEffect =
  | { kind: 'localState.open'; id: string }
  | { kind: 'localState.close'; id: string };

/**
 * 原地动作声明
 * 
 * 描述页面上不引起导航的可执行动作（如开关、表单提交、点赞等）。
 * Actions 挂在 uiStates[] 上，归属链条：actionId -> uiState.id -> route.path
 */
export interface ActionDeclaration {
  /** app 内唯一的动作标识，用于 data-action 打标 */
  id: string;

  /** 人类可读标签 */
  label: string;

  /** 可选：更详细的语义说明 */
  description?: string;

  /**
   * 动作行为类型
   * - toggle: 开关类（点击切换状态）
   * - select: 选择类（多选一，选项编码在 actionId 中）
   * - submit: 提交/确认类
   * - input: 输入类（文本框/数字框等）
   * - other: 其他
   */
  behavior: 'toggle' | 'select' | 'submit' | 'input' | 'other';

  /**
   * 动作作用范围
   * - 不声明（默认）：全局/页面级动作
   * - 'item'：作用于某个列表项/实体（必须配合 paramsSchema 声明对象标识）
   */
  scope?: 'item';

  /**
   * 参数 schema（声明 data-action-params 的结构）
   *
   * | scope    | behavior | paramsSchema 规则                                      |
   * |----------|----------|--------------------------------------------------------|
   * | (默认)   | toggle   | 可选 { to: 'boolean' }（目标态）                        |
   * | (默认)   | input    | 必须包含 { value: 'string' \| 'number' }               |
   * | 'item'   | *        | 必须包含至少一个对象标识字段（如 bookId/userId）        |
   */
  paramsSchema?: Record<string, 'string' | 'number' | 'boolean'>;

  /** 可选：入口显示条件（复用 StateCondition） */
  condition?: StateCondition;

  /**
   * 可选：动作副作用（vNext，仅语义，不改变 URL）
   *
   * 用于描述“一次点击带来的可观测 UI 变化”，例如：
   * - 点击“关注”（action）-> 打开“你可能感兴趣”面板（localState.open）
   */
  effects?: ActionEffect[];
}
```

### 2.3 状态转移声明

统一处理路由跳转和 URL 状态变更：

```typescript
export interface TransitionDeclaration {
  /** 唯一标识，格式：feature.action */
  id: string;
  
  /**
   * 允许触发的源状态
   * - '*': 任意状态均可触发（等价于"全局动作"）
   * - string: 匹配 pathname 模板，如 '/video/:id'
   * - FromConstraint: 同时匹配 pathname 和 search params
   * 
   * > [!WARNING]
   * > **不推荐使用裸通配符 `'*'`**
   * > - 使用 `'*'` 会绕过源状态约束，无法精确控制哪些页面可以触发该 transition
   * > - 这会导致静态分析无法准确构建 UI 图
   * > - 推荐做法：显式列出所有允许的源状态
   * > - 例外：`{ path: '/xxx', search: { tab: '*' } }` 中的参数通配符是允许的（表示该参数必须存在）
   */
  from: '*' | string | Array<'*' | string | FromConstraint> | FromConstraint;
  
  /**
   * 目标路由
   * - string: 跳到目标 pathname 模板
   *
   * 强约束：
   * - 为保证状态机声明一致性：**任何情况下都不得省略 `to`**
   * - 即使是"同 pathname 的离散状态切换"（tab/modal/menu/select 等），也必须显式写出目标 pathname 模板
   */
  to: string;
  
  /** 
   * 静态查询参数（目标值在声明时确定）
   * - string: 设置为该值
   * - null: 删除该参数（用于清除状态）
   * 
   * 适用于所有**有限集合的离散 UI 状态**：
   * - `tab`/`sub`: Tab 切换 (`{ tab: 'week' }`, `{ sub: 'system' }`)
   * - `modal`: 模态框 (`{ modal: 'shelf' }`, `{ modal: 'confirm_remove' }`)
   * - `select`: 选择模式 (`{ select: 'true' }`)
   * - `menu`: 菜单 (`{ menu: 'plus' }`)
   * - 其他自定义状态...
   * 
   * 使用场景：
   * - 打开模态框: `search: { modal: 'shelf' }`
   * - 进入选择模式: `search: { select: 'true' }`
   * - 清除状态: `search: { modal: null }` 或 `search: { sub: null }`
   * - 嵌套状态组合: `search: { select: 'true', modal: 'confirm_remove' }`
   * 
   * 与 searchParams 组合：search 指定静态部分，searchParams 指定动态部分
   */
  search: Record<string, string | null>;
  
  /** 
   * 动态查询参数类型声明（目标值在运行时传入）
   * 
   * 两种使用场景：
   * 
   * 1. **真正的动态参数**（无限集合）
   *    - 例如：`{ q: 'string', page: 'number' }`
   *    - 图节点使用 `:paramName` 占位符
   *    - 值来自用户输入或运行时数据
   * 
   * 2. **`.switch` 模式**（有限离散状态）
   *    - 例如：`{ tab: 'string' }` 用于 Tab 切换
   *    - 分析器会根据目标路由的 uiStates 展开为多条边
   *    - 值虽然有限，但在调用时才确定目标
   *    - 优点：单个 transition 处理多个 Tab 切换，减少冗余
   * 
   * 与 search 组合使用（嵌套 Tab 场景）：
   * - `search: { tab: 'all' }, searchParams: { sub: 'string' }` 
   *   → 保持 tab=all，动态切换 sub
   * - `search: { sub: null }, searchParams: { tab: 'string' }`
   *   → 清除 sub，动态切换 tab
   */
  searchParams: Record<string, 'string' | 'number'>;
  
  /**
   * 需要从当前 URL 保留的 query 参数
   * - 解决"修改某个参数但保留其他参数"的场景
   * - 例如：切换 tab 时保留 `q` 搜索词
   * - 默认行为：不保留任何参数（从空 query 开始构建）
   */
  preserveParams?: string[];
  
  /**
   * 条件跳转分支（可选）
   * 
   * ### 使用规则（重要！）
   * - **无条件跳转**：省略此字段或设为 `undefined`，使用顶层 `to`/`search`
   * - **有条件跳转**：提供非空数组，**必须**以 `{ when: { op: 'always' } }` 结尾作为默认分支
   * 
   * ### 静态校验
   * - CI 会检查：若 `cases` 存在且非空，最后一项必须是 `{ op: 'always' }`
   * - 若 `cases` 为空数组 `[]`，等价于省略，不会报错
   */
  cases?: CaseDeclaration[];
  
  /** 导航模式 */
  mode: 'push' | 'replace';
  
  /** 路径参数类型（用于 to 中的 :param） */
  params: Record<string, 'string' | 'number'>;
  
  /** 人类可读标签 */
  label: string;

  /**
   * 边可用性（可选，vNext，仅语义）
   *
   * 用于表达“边存在，但并非总可用”（例如依赖历史访问记忆的恢复入口）。
   * - always：总可用（默认）
   * - requires_prior_visit：依赖“此前访问记忆/曾经到达过”的恢复入口（图中保留但默认不用于首次路径）
   */
  availability?: 'always' | 'requires_prior_visit';
  /** 可用性备注（可选，仅语义） */
  availabilityNote?: string;
  
  /** UI 元信息 */
  ui: {
    placement: 'topbar' | 'tabbar' | 'content' | 'fab' | 'none';
    icon: string;
    /** 触发手势类型（可选） */
    gesture?: 'tap' | 'longPress' | 'doubleTap' | 'back';
    /**
     * 入口显示条件（可选，v0.5）
     *
     * 描述触发此跳转的 UI 入口在什么数据条件下显示（或可用）。
     * - Schema 模式：边存在，标注条件
     * - Data 模式：条件可评价且不满足时可剪枝（边不生成）
     *
     * 详细条件语法见 DATA_SOURCE_PROPOSAL.md
     */
    condition?: StateCondition;
  };
  
  /**
   * 数据源声明（可选，v0.5）
   * 
   * 用于静态分析时将动态参数展开为具体节点/边。
   * 支持单个数据源或多个数据源（对应不同的 from 路径）。
   * 
   * 详细语法见 DATA_SOURCE_PROPOSAL.md
   */
  dataSource?: DataSourceDeclaration | DataSourceDeclaration[];
}

/**
 * 解释（严格口径）：
 * - 一个"route-state 节点"的 id 是 `pathname 模板 + 离散 query + 动态 query 占位符`
 *   - 例如：`/video/:bvid`, `/video/:bvid?tab=comment`, `/list?modal=edit&itemId=:itemId`
 * - 离散 query（有限集合）：`modal`, `tab`, `menu`, `select` 等，必须枚举
 * - 动态 query（无限集合）：`itemId`, `q`, `page` 等，使用 `:paramName` 占位符
 * - 当 transition 的 `from.path` 与 `to` 相同（pathname 不变）时，仍然可能发生 **节点变化**，因为 `search/searchParams` 会改变 query
 * - 为避免歧义：当 pathname 不变但离散状态变化时，`from` 必须使用 `FromConstraint` 显式约束相关离散 key
 */

export interface CaseDeclaration {
  /** 目标 pathname 模板 */
  to: string;
  /** 静态 query 参数 */
  search: Record<string, string | null>;
  /** 动态 query 参数（可选，覆盖顶层 searchParams） */
  searchParams?: Record<string, 'string' | 'number'>;
  /** 条件表达式 */
  when: Condition;
  /** 分支边可用性（可选，vNext，仅语义） */
  availability?: 'always' | 'requires_prior_visit';
  /** 分支可用性备注（可选，仅语义） */
  availabilityNote?: string;
}

/**
 * 条件表达式（JSON DSL）
 * 设计原则：
 * - 禁止任意字符串表达式 / eval（安全 + 可静态分析）
 * - 只依赖“可观测的上下文”：当前 pathname/search、AppState（如接入）、以及 go() 传入的 runtime params
 */
export type Condition =
  | { op: 'always' }                                      // 必选兜底分支（cases 的最后一个）
  | { op: 'and'; items: Condition[] }
  | { op: 'or'; items: Condition[] }
  | { op: 'not'; item: Condition }
  | { op: 'exists'; ref: ValueRef }                          // ref != null 且 != ''
  | { op: 'eq'; left: ValueRef; right: Primitive }           // string/number/bool
  | { op: 'in'; left: ValueRef; right: Primitive[] }
  | { op: 'match'; left: ValueRef; right: string }           // 正则字符串（由实现编译为 RegExp）
  | { op: 'gt' | 'gte' | 'lt' | 'lte'; left: ValueRef; right: number };

export type Primitive = string | number | boolean | null;

/**
 * 数据条件（StateCondition，v0.8）
 *
 * 用于描述（纯数据驱动）：
 * - `uiStates[].stateCondition`：状态节点是否存在（动态 Tab、条件页面）
 * - `ui.condition`：跳转入口是否显示/可用（条件按钮、权限控制）
 *
 * 说明：
 * - `ref` 采用与 dataSource 相同的 ref 语法（支持静态过滤、参数化查找等）
 * - `filterFn` 为字符串形式函数：(item, data) => boolean，由工具链在安全上下文中执行
 * - 这是 **静态/数据模式工具链** 的条件：不要与运行时分支的 `Condition`（cases.when）混用
 * - `paramEq/paramNeq` 依赖 `boundParams`（来自 path params 的具体绑定）。因此建议把关键标识放到 path params：
 *   例如用户资料用 `/user-profile/:id`，而不是 `/user-profile?id=...`
 *
 * > **详细语法与条件评估规则**见 [DATA_SOURCE_PROPOSAL.md](./DATA_SOURCE_PROPOSAL.md) 第八节。
 */
export type StateCondition =
  // 组合条件（推荐写法：用 not + paramEq 表达"不等于"）
  | { op: 'always'; text?: string }
  | { op: 'and'; items: StateCondition[]; text?: string }
  | { op: 'or'; items: StateCondition[]; text?: string }
  | { op: 'not'; item: StateCondition; text?: string }
  // 基础条件（v0.5 起）
  | { op: 'notEmpty'; ref: string; filterFn?: string; text?: string }
  | { op: 'memberOf'; ref: string; param: string; field?: string; filterFn?: string; text?: string }
  | { op: 'eq'; ref: string; equals: Primitive; text?: string }
  // 参数 vs 数据 ref 比较（v0.8）
  | { op: 'paramEq'; param: string; ref: string; text?: string }
  | { op: 'paramNeq'; param: string; ref: string; text?: string };

/**
 * 数据源声明（v0.5）
 * 
 * 描述 transition 的动态参数值从哪个数据集合获取。
 * 用于静态分析时将图展开为具体节点。
 * 
 * 完整语法详见 DATA_SOURCE_PROPOSAL.md
 */
export interface DataSourceDeclaration {
  /** 适用的来源约束（复用 FromConstraint 语法） */
  from?: '*' | string | FromConstraint;
  
  /** 数据引用路径（点分隔，支持参数化查找） */
  ref: string;
  
  /**
   * 参数映射：key 是 params 中的参数名，value 是数据对象中的字段名或特殊值：
   * - '$value'：数组元素本身
   * - '$key'：当 ref 指向对象（Record）时，使用对象 key（按 key 排序展开，保证稳定）
   *
   * 详见 DATA_SOURCE_PROPOSAL.md
   */
  paramMapping: Record<string, string>;
  
  /** 标签字段（用于在展开图中显示有意义的标签） */
  labelField?: string;
}

/**
 * 可引用的值来源
 * - search: URLSearchParams 里的 key
 * - param: go(id, params) 传入的 runtime 参数（也用于 to 的路径替换）
 * - appState: 来自 AppStateRegistry 的当前 App 状态（如接入）
 */
export type ValueRef =
  | { ref: 'search'; key: string }
  | { ref: 'param'; key: string }
  | { ref: 'appState'; key: string }; // key 支持点路径：'user.isLoggedIn'

/**
 * 源状态约束
 * 用于精确匹配包含特定查询参数的状态
 */
export interface FromConstraint {
  /** 路由路径模板 */
  path: string;
  
  /** 
   * 查询参数约束
   * - string: 必须等于该值
   * - '*': 必须存在（任意非空值）
   * - null: 必须不存在
   */
  search: Record<string, string | '*' | null>;
}
```

---

## 三、使用规范

### 3.1 路由跳转

从聊天列表进入聊天详情：

```typescript
// 声明（cases 可省略，无条件跳转时使用顶层 to/search）
transitions: [
  {
    id: 'chat.open',
    from: '/',
    to: '/chat/:id',
    search: {},
    searchParams: {},
    mode: 'push',
    params: { id: 'string' },
    label: '打开聊天',
    ui: { placement: 'content', icon: '' },
  }
]

// 使用
const { go } = useAppNavigate();
<div 
  data-trigger="chat.open" 
  onClick={() => go('chat.open', { id: 'user_123' })}
>
  打开聊天
</div>
```

### 3.2 Tab 切换

Tab 切换使用 `mode: 'replace'` 避免历史栈堆积：

```typescript
// 声明
transitions: [
  {
    id: 'tab.home',
    from: ['/contacts', '/discover', '/me'],  // ✅ 不包含自身 '/'
    to: '/',
    search: {},
    searchParams: {},
    mode: 'replace',
    params: {},
    label: '切换到首页',
    ui: { placement: 'tabbar', icon: '', gesture: 'tap' },
  },
  {
    id: 'tab.contacts',
    from: ['/', '/discover', '/me'],  // ✅ 不包含自身 '/contacts'
    to: '/contacts',
    search: {},
    searchParams: {},
    mode: 'replace',
    params: {},
    label: '切换到通讯录',
    ui: { placement: 'tabbar', icon: '', gesture: 'tap' },
  },
]

// 使用
<TabBarItem data-trigger="tab.contacts" onClick={() => go('tab.contacts')} />
```

> [!IMPORTANT]
> **`from` 禁止包含自身路由（防止自环）**
> 
> 底部 Tab 切换不应该能从当前页面触发到自己：
> - 底部 Tab 栏的作用是在主页面间切换，而非页面内切换
> - 页面内的 Tab 切换应该使用独立的 `xxx.tab.switch` transition
> - 在 UI 图中，自环边（source === target）通常是无意义的

#### 3.2.1 使用 `.switch` 合并多个 Tab 切换（可选模式）

当页面内有多个 Tab 时，可以使用单个 `.switch` transition + `searchParams` 代替多个独立 transition：

```typescript
// ❌ 冗余：5 个 tab 需要 5 个 transition
{
  id: 'myReading.tab.week',
  from: [/* 列出其他 4 个 tab */],
  to: '/my-reading',
  search: { tab: 'week' },
  // ...
},
{
  id: 'myReading.tab.month',
  from: [/* 列出其他 4 个 tab */],
  to: '/my-reading',
  search: { tab: 'month' },
  // ...
},
// ... 还有 3 个

// ✅ 简洁：1 个 transition 处理所有 tab 切换
{
  id: 'myReading.tab.switch',
  from: { path: '/my-reading', search: { tab: '*' } },
  to: '/my-reading',
  search: {},
  searchParams: { tab: 'string' },  // 动态目标
  mode: 'replace',
  params: {},
  label: '切换阅读统计 Tab',
  ui: { placement: 'content', icon: 'my_reading_tab', gesture: 'tap' },
}
```

**使用方式**：

```tsx
const { bindTap } = useTriggerGestures();

// 使用 params 传递动态 tab 值
const tabRef = bindTap('myReading.tab.switch', { 
  params: { tab: tabKey }  // tabKey 是当前要切换到的 tab
});

return <button {...tabRef}>切换到 {tabKey}</button>;
```

**UI 图脚本会自动展开**：
- 根据目标路由的 `uiStates`，展开为多条边
- 过滤掉自环（source === target）
- Label 会自动附加目标状态描述（如 `切换阅读统计 Tab → 月视图`）

#### 3.2.2 跨页面 Tab 记忆（推荐）

当用户从某个带内部 Tab 的页面跳转到其他页面后，再通过底部 TabBar 返回时，通常希望回到**上次停留的子 Tab**，而不是回到默认 Tab。

例如：

1. 用户在 `/audiobooks?sub=community`
2. 切换到底部 Tab：`/me`
3. 再点击底部 Tab 返回有声书

期望：回到 `/audiobooks?sub=community`（而不是 `/audiobooks?sub=audio`）。

**声明层（TransitionDeclaration）**：底部 Tab 的跳转使用 `searchParams`（动态），不要在 `search` 里写死默认值：

```typescript
{
  id: 'tab.audiobooks',
  from: ['/', '/bookshelf', '/me'], // ✅ 不包含自身 /audiobooks（防自环）
  to: '/audiobooks',
  search: {}, // ✅ 不要写 { sub: 'audio' }
  searchParams: { sub: 'string' }, // ✅ 由调用方决定目标 sub tab
  mode: 'replace',
  params: {},
  label: '切换到有声书',
  ui: { placement: 'tabbar', icon: 'tab_audiobooks', gesture: 'tap' },
}
```

**组件层（TabBar）**：从应用状态（context/store）读取“上次的子 Tab”，并作为参数传入：

```tsx
// TabBar（示例）
const { bindTap } = useTriggerGestures();
const { audioSubTab } = useTabContext(); // 记忆上次 sub tab（例如 'community'）

const audiobooksRef = bindTap('tab.audiobooks', {
  params: { sub: audioSubTab || 'audio' }, // 有记忆则用记忆，否则用默认
});

return <button {...audiobooksRef}>有声书</button>;
```

**状态更新（页面内）**：在页面内部监听当前子 Tab 变化并写回（用于记忆）：

```tsx
// AudiobooksPage（示例）
useEffect(() => {
  setAudioSubTab(currentSub);
}, [currentSub]);
```

### 3.3 URL 状态变更（Modal / 菜单）

只改变离散 query（search），保持 pathname 不变：

```typescript
// 声明（当 pathname 不变但离散状态变化时，from 必须显式约束相关离散 query）
transitions: [
  {
    id: 'modal.shelf.open',
    from: { path: '/book/:id', search: { modal: null } },
    to: '/book/:id',
    search: { modal: 'shelf' },
    searchParams: {},
    mode: 'push',
    params: {},
    label: '打开书架管理',
    ui: { placement: 'content', icon: '' },
  }
]

// 使用
<button data-trigger="modal.shelf.open" onClick={() => go('modal.shelf.open')}>
  管理
</button>

// 关闭 Modal（使用内建 back）
<div className="overlay" onClick={() => back()} />
```

> [!NOTE]
> 为什么弹窗不写成独立 pathname（`routes[].path`）？
> - 这里的弹窗（`?modal=shelf`）不会挂载一个“新的页面路由组件”，它是同一个页面上的 overlay/UI 子状态。
> - 但在本方案里 **route = pathname + 离散 query**，所以它必须是一个独立 route 节点（例如 `'/book/:bookId?modal=shelf'`），这样 Agent 才能把“弹窗已打开/可关闭”当作不同状态处理（见 7.1 节点展开规则）。

### 3.4 状态枚举规则（Route State Enumeration）

> [!IMPORTANT]
> **区分三类参数，采用不同策略：**
>
> | 类型 | 特征 | 声明方式 | 示例 |
> |------|------|----------|------|
> | **路径参数** | 无限集合，标识资源 | `path: '/book/:bookId'` + `params` | `bookId`, `userId`, `bvid` |
> | **查询参数（离散）** | 有限集合，UI 模式 | `path: '/xxx'` + `uiStates` | `tab`, `modal`, `menu`, `select` |
> | **查询参数（动态）** | 无限集合，运行时数据 | `queryParams` / `searchParams` | `q`, `page`, `itemId` |

> [!WARNING]
> **Tab 状态必须使用查询参数而非路径参数**
> 
> 有限的 Tab 状态（如"周视图/月视图/年视图"）不应声明为路径参数：
> 
> ```typescript
> // ❌ 错误：将有限状态当作动态路径参数
> {
>   path: '/my-reading/:tabId',
>   params: { tabId: 'string' },
>   uiStates: [{ id: 'myReading.base', search: {}, description: '阅读统计' }],
> }
> 
> // ✅ 正确：有限状态在 uiStates 中枚举
> {
>   path: '/my-reading',
>   params: {},
>   uiStates: [
>     { id: 'myReading.week', search: { tab: 'week' }, description: '周视图' },
>     { id: 'myReading.month', search: { tab: 'month' }, description: '月视图' },
>     { id: 'myReading.year', search: { tab: 'year' }, description: '年视图' },
>   ],
> }
> ```

#### 补充：必须带参数的路由（无“裸路由”状态）

有些页面的正确渲染**依赖某个离散 query 必须存在**（例如 `?tab=xxx`），在这种场景下从状态机视角来看，`/my-reading` 这个“裸路由”状态并不存在（或应当被视为非法/不可达）。

> 典型：存在“平级 Tab”的页面。此时 `tab` 是**必填离散参数**，不得用裸路由（`search: {}` / `.base`）表达默认 Tab。

**推荐做法**：在 `routes[].uiStates` 中只枚举“带必需参数”的状态，不要额外声明一个 `search: {}` 的 base 状态：

```typescript
{
  path: '/my-reading',
  params: {},
  queryParams: {},
  uiStates: [
    // ✅ 所有状态都必须带 tab（离散有限集合）
    { id: 'myReading.week', search: { tab: 'week' }, description: '周视图' },
    { id: 'myReading.month', search: { tab: 'month' }, description: '月视图' },
    { id: 'myReading.year', search: { tab: 'year' }, description: '年视图' },
    { id: 'myReading.total', search: { tab: 'total' }, description: '总视图' },
    { id: 'myReading.history', search: { tab: 'history' }, description: '阅历视图' },
  ],
}
```

**实现建议**：

- **不要在运行时静默 normalize 非法地址**（例如把 `/my-reading` 悄悄 replace 成 `/my-reading?tab=week`）；应当让调用方显式传入合法 URL（符合“源码/声明/图”一致）。
- 任何导航到该页面的 transition/入口，都应显式传入必填离散参数（例如通过 `.switch` 或 `searchParams`）
- 需要约束“来源必须带 tab”时，使用 `{ path: '/my-reading', search: { tab: '*' } }` 而不是裸 `'/my-reading'`

#### 3.4.1 离散状态（必须枚举）

离散状态是**有限集合**，会改变 UI 的可见性或可用动作集合：

```typescript
// 在 routes[].uiStates 中枚举
uiStates: [
  { id: 'base', search: {}, description: '基础状态' },
  { id: 'modal.shelf', search: { modal: 'shelf' }, description: '书架弹窗' },
  { id: 'select', search: { select: 'true' }, description: '选择模式' },
  { id: 'select.confirm', search: { select: 'true', modal: 'confirm' }, description: '选择模式+确认弹窗' },
]
```

**图节点 ID 格式**：
- `/book/:bookId` → 基础节点
- `/book/:bookId?modal=shelf` → 弹窗打开节点
- `/bookshelf?select=true&modal=confirm` → 组合状态节点

#### 3.4.2 动态参数（声明类型，不枚举值）

动态参数是**无限集合**，具体值在运行时决定：

```typescript
// 在 routes[].queryParams 中声明类型
queryParams: { 
  itemId: 'string',  // 例如 ?itemId=42
  page: 'number',    // 例如 ?page=3
}

// 在 transitions[].searchParams 中声明
searchParams: { 
  q: 'string',       // 搜索词
  mid: 'string',     // 用户 ID
}
```

**图节点 ID 格式**（动态参数使用占位符）：
- `/list?modal=edit&itemId=:itemId` → itemId 是动态的
- `/search?q=:q` → 搜索词是动态的
- `/video/:bvid?menu=:mid` → mid 是动态的

#### 3.4.3 组合状态的处理

当存在多个独立的离散维度时（如 `select` + `modal`），只需枚举**实际可达**的组合：

```typescript
// 如果必须先进入 select 模式，再打开 confirm modal
uiStates: [
  { id: 'base', search: {}, description: '基础' },
  { id: 'select', search: { select: 'true' }, description: '选择模式' },
  { id: 'select.confirm', search: { select: 'true', modal: 'confirm' }, description: '确认删除' },
  // 不需要枚举 { modal: 'confirm' }，因为它不可独立到达
]
```

#### 3.4.4 静态校验规则

对每个 `TransitionDeclaration`（包括 `cases` 分支）：

**源状态校验（from）**：

1. **源 pathname 必须存在**：`from`（无论是字符串还是 `FromConstraint.path`）必须匹配某个 `routes[].path`
2. **源离散状态必须存在**：当 `from` 是 `FromConstraint` 且 `search` 中包含具体值（非 `null`、非 `'*'`）时：
   - 该离散状态组合必须在对应 route 的 `uiStates` 中枚举
   - 例如：`{ path: '/book/:id', search: { modal: 'shelf' } }` 要求 `/book/:id` 的 `uiStates` 包含 `{ modal: 'shelf' }`
3. **通配符约束（`'*'`）必须有匹配节点**：当 `search` 中使用 `'*'` 时，至少需要有一个 uiState 声明了该 key

**目标状态校验（to）**：

4. **目标 pathname 必须存在**：`to` 必须匹配某个 `routes[].path`
5. **离散 query 目标必须存在**：
   - 提取 `search` 中的静态离散 key（忽略 `null` 值和 `searchParams` 中的动态 key）
   - 目标节点 ID 必须能在 `routes[].uiStates` 生成的节点集合中找到
6. **动态参数必须声明**：
   - `searchParams` 中的 key 必须在目标 route 的 `queryParams` 中声明
   - 或者是路径参数（`params`）

> [!TIP]
> 核心原则：**离散状态空间是闭合有限集**（可静态枚举），**动态参数空间是开放无限集**（只声明类型）。前后状态空间必须一致，确保图的完整性和覆盖率报告准确性。

#### 3.4.5 首页带参数 Tab（入口页面必须带参数）

当首页（`/`）自身就需要 `?tab=xxx`（没有"无参数默认状态"）时，需要特殊处理：

**1. 设置 `MemoryRouter` 初始入口**（否则默认进入裸 `/`，缺少 tab 参数）：

```tsx
// <AppName>App.tsx
<MemoryRouter initialEntries={['/?tab=recommend']}>
```

**2. 不要声明 `search: {}` 的 base uiState**：工具链按 `uiStates[0]` 作为 home entry state。

**3. `from` 约束使用通配符匹配所有首页 Tab**：

```typescript
// ❌ 裸 '/' 在图中会生成无参数节点
from: ['/', '/following', '/me']
// ✅ 匹配所有带 tab 参数的首页状态
from: [{ path: '/', search: { tab: '*' } }, '/following', '/me']
```

**4. 覆盖层打开时禁用底层 Tab 入口**：若首页打开弹窗/抽屉后底层 Tab 不可点，把覆盖层约束写进 `from`，避免图/任务中出现"覆盖层打开时仍可切 Tab"的错误边：

```typescript
{
  id: 'home.tab.switch',
  from: [{ path: '/', search: { tab: '*', modal: null, menu: null } }],
  to: '/',
  search: { modal: null, menu: null },
  searchParams: { tab: 'string' },
  mode: 'replace',
  label: '切换首页 Tab',
  ui: { placement: 'topbar', icon: 'home_tab', gesture: 'tap' },
}
```

**5. `pathname` 判断不受 query 影响**：

```typescript
// URL: /?tab=recommend → pathname = '/', search = '?tab=recommend'
const { pathname } = useLocation();
const isHome = pathname === '/';  // ✅ 对于 /?tab=xxx 仍然是 true
```

底部 TabBar 判断 `isHome` 时，所有首页 Tab 都应高亮"首页"图标。

#### 3.4.6 声明 vs 路由注册（常见坑）

> [!WARNING]
> **声明 ≠ 路由可访问**：`navigation.declaration.ts` 只描述"应该如何导航"，React Router 能否匹配取决于 `<AppName>App.tsx` 中的 `<Routes>` 配置。新增 path 后若未在 `<Routes>` 中添加对应 `<Route path="...">`，运行时会报 `No routes matched location "/xxx"`。

### 3.5 条件跳转（cases）

当同一个动作在不同条件下跳转到不同目标时，使用 `cases`：

```typescript
// 场景：关注按钮在"未关注"和"已关注"状态下行为不同
transitions: [
  {
    id: 'user.follow.toggle',
    from: '/user/:mid',
    to: '/user/:mid',  // 顶层 to 作为 fallback（虽然有 cases 时不会用到）
    search: {},
    searchParams: {},
    mode: 'push',
    params: {},
    label: '关注/取关',
    ui: { placement: 'content', icon: '' },
    
    // cases 非空时，必须以 { op: 'always' } 结尾
    cases: [
      {
        // 未关注时：关注 + 打开推荐面板
        to: '/user/:mid',
        search: { suggestions: 'true' },
        when: { 
          op: 'eq', 
          left: { ref: 'appState', key: 'isFollowing' }, 
          right: false 
        },
      },
      {
        // 已关注时：打开取关菜单
        to: '/user/:mid',
        search: { menu: 'unfollow' },
        when: { op: 'always' },  // 默认分支（必须是最后一个）
      },
    ],
  },
]
```

**cases 规则**：

1. **可选字段**：`cases` 可省略或设为空数组 `[]`，此时使用顶层 `to`/`search`
2. **非空时必须有 always**：如果 `cases` 非空，最后一项必须是 `{ when: { op: 'always' } }`
3. **按顺序匹配**：运行时按数组顺序找第一个 `when` 为 true 的分支
4. **每个分支参与校验**：图生成时，每个 case 的目标都会被校验是否在 `uiStates` 中枚举

### 3.6 带动态参数的状态变更

当 search params 需要运行时数据时，使用 `searchParams` 声明：

```typescript
// 声明
transitions: [
  {
    id: 'modal.edit.open',
    from: { path: '/list', search: { modal: null } },
    to: '/list',
    search: { modal: 'edit' },       // 静态部分（离散状态）
    searchParams: { itemId: 'string' },  // 动态部分（无限集合）
    mode: 'push',
    params: {},
    label: '编辑项目',
    ui: { placement: 'content', icon: '' },
  },
  {
    id: 'search.submit',
    from: '/search',
    to: '/search',
    search: {},
    searchParams: { q: 'string', page: 'number' },  // 全部动态
    mode: 'push',
    params: {},
    label: '提交搜索',
    ui: { placement: 'content', icon: '' },
  }
]

// 使用
go('modal.edit.open', { itemId: '42' })
// 结果: /list?modal=edit&itemId=42

go('search.submit', { q: '关键词', page: 1 })
// 结果: /search?q=关键词&page=1
```

**图节点表示**：
- `/list?modal=edit&itemId=:itemId` — `itemId` 使用占位符
- `/search?q=:q&page=:page` — 搜索参数使用占位符

> [!NOTE]
> `searchParams` 在图生成时会被拆成两类语义：
> - **动态 query（无限集合）**：`key` 已在目标路由 `queryParams` 中声明（如 `q/page/itemId`），图节点只会以 `key=:key` 占位符表示，**不参与** `uiStates` 的离散结构匹配与展开。
> - **离散维度的动态目标（有限集合）**：`key` 不属于 `queryParams`（如 `tab`），表示“目标离散状态由调用方决定”。此时 analyzer 会基于目标路由 `uiStates` 的结构进行展开（生成多条边）。

### 3.7 保留现有查询参数

使用 `preserveParams` 在跳转时保留当前 URL 中的特定参数：

```typescript
// 场景：切换 tab 时保留搜索词
transitions: [
  {
    id: 'tab.users',
    from: { path: '/search', search: { tab: null } },
    to: '/search',
    search: { tab: 'users' },
    searchParams: {},
    preserveParams: ['q'],  // 保留当前的 q 参数
    mode: 'replace',
    params: {},
    label: '切换到用户',
    ui: { placement: 'content', icon: '' },
  }
]

// 使用
// 当前: /search?q=关键词
go('tab.users')
// 结果: /search?tab=users&q=关键词  (保留了 q)
```

> [!NOTE]
> `preserveParams` 不仅影响运行时 URL 结果，**也会影响图生成时目标节点的解析**：analyzer 会把 source 节点当前的 `search` 中被保留的 key 合并进目标 search，用于正确命中目标 `uiStates`（避免出现“边指向不存在节点”的问题）。

**不使用 `preserveParams` 的默认行为**：

```typescript
// 默认：从空 query 开始构建，不保留任何参数
transitions: [
  {
    id: 'item.detail',
    from: '/list',
    to: '/item/:id',
    search: {},
    searchParams: {},
    // 无 preserveParams，不会保留任何当前参数
    mode: 'push',
    params: { id: 'string' },
    label: '查看详情',
    ui: { placement: 'content', icon: '' },
  }
]

// 当前: /list?filter=active&page=2
go('item.detail', { id: '123' })
// 结果: /item/123  (没有保留任何参数)
```

### 3.8 基于查询参数的条件约束

当某个操作只在特定状态下可用时，使用 `FromConstraint`：

```typescript
// 声明
transitions: [
  // 关闭 Modal - 只有当 modal 参数存在时才可用
  {
    id: 'modal.close',
    from: { path: '/book/:id', search: { modal: '*' } },  // modal 必须存在
    to: '/book/:id',
    search: { modal: null },  // 删除 modal 参数
    searchParams: {},
    mode: 'push',
    params: {},
    label: '关闭弹窗',
    ui: { placement: 'content', icon: '' },
  },
  
  // 切换到评论 Tab - 只有当不在评论 Tab 时才可用
  {
    id: 'video.tab.comment',
    from: [
      { path: '/video/:id', search: { tab: null } },
      { path: '/video/:id', search: { tab: 'intro' } },
    ],
    to: '/video/:id',
    search: { tab: 'comment' },
    searchParams: {},
    mode: 'replace',  // Tab 切换使用 replace
    params: {},
    label: '查看评论',
    ui: { placement: 'content', icon: '' },
  },
  
  // 退出选择模式 - 只有当 select=true 时才可用
  {
    id: 'bookshelf.select.exit',
    from: { path: '/bookshelf', search: { select: 'true' } },
    to: '/bookshelf',
    search: { select: null },
    searchParams: {},
    mode: 'push',
    params: {},
    label: '退出选择',
    ui: { placement: 'content', icon: '' },
  }
]
```

### 3.9 同时改变路由和状态

```typescript
// 声明
transitions: [
  {
    id: 'video.open.at.comments',
    from: '/',
    to: '/video/:id',
    search: { tab: 'comments' },
    searchParams: {},
    mode: 'push',
    params: { id: 'string' },
    label: '打开视频并切到评论',
    ui: { placement: 'content', icon: '' },
  }
]
```

### 3.10 历史回退

```typescript
const { back } = useAppNavigate();

// 返回上一页
<button onClick={() => back()}>返回</button>

// 返回多层（如同时关闭 Modal 和退出选择模式）
<button onClick={() => back(2)}>确认并退出</button>
```

### 3.11 删除查询参数

使用 `null` 值删除参数：

```typescript
// 声明
transitions: [
  {
    id: 'filter.clear',
    from: { path: '/list', search: { filter: '*' } },
    to: '/list',
    search: { 
      filter: null,   // 删除 filter
      sort: null,     // 删除 sort
      page: null,     // 删除 page
    },
    searchParams: {},
    mode: 'push',
    params: {},
    label: '清除筛选',
    ui: { placement: 'content', icon: '' },
  }
]
```

### 3.12 条件（v0.8）：节点存在 vs 入口显示

v0.5 将“条件”放到更语义正确的位置，避免把“入口显示”误解成“跳转可行性”：

- **节点存在条件**：`uiStates[].stateCondition`（该状态节点是否存在）
- **入口显示条件**：`ui.condition`（触发此跳转的 UI 入口是否显示/可用）

> [!NOTE]
> **与 URL 状态的区别**：
> - `from` 约束基于 **URL 状态**（pathname、search params）
> - `condition/stateCondition` 基于 **数据状态**（如书架、关注列表、会员状态等）

#### 典型场景

```typescript
// 场景：书籍详情页"书架管理"入口
// - 只有书已在书架中时，才显示该入口（入口显示条件）
{
  id: 'book.modal.shelf.open',
  from: { path: '/book/:bookId', search: { modal: null } },
  to: '/book/:bookId',
  search: { modal: 'shelf' },
  searchParams: {},
  mode: 'push',
  params: { bookId: 'string' },
  label: '书架管理',
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
}
```

#### v0.8 扩展：组合条件 + 参数对比（解决“自己/他人”入口差异）

v0.8 在 `StateCondition` 上新增：
- **组合**：`always / and / or / not`
- **参数对比**：`paramEq / paramNeq`（将 boundParams 里的某个参数与 `ref` 指向的数据做对比）

**示例：用户资料页右上角“朋友设置”仅在查看他人时显示**

```typescript
{
  id: 'friendSettings.open',
  from: '/user-profile/:id',
  to: '/friend-settings/:id',
  search: {},
  searchParams: {},
  mode: 'push',
  params: { id: 'string' },
  label: '打开朋友设置',
  ui: {
    placement: 'topbar',
    icon: 'more',
    gesture: 'tap',
    // 写法 1：直接用 paramNeq
    condition: { op: 'paramNeq', param: 'id', ref: 'user.wxid', text: '仅对他人显示' },
    // 写法 2：等价写法（更通用）：not(paramEq(...))
    // condition: { op: 'not', item: { op: 'paramEq', param: 'id', ref: 'user.wxid' } },
  },
}
```

> [!NOTE]
> `paramEq/paramNeq` 依赖 data-mode 里的 `boundParams`。如果参数来自 query（如 `?id=`），通常无法绑定/求值；
> 因此这类场景建议使用 path params（如 `/user-profile/:id`）。

#### Data 模式常见坑：目标带 `:param` 但无法绑定会被跳过

当 transition 的目标包含路径参数（如 `/user/:userId/shelf`），如果既不能从来源节点继承，也没有 `dataSource` 可以绑定出具体值，那么在 **data 图**里该边会被跳过（避免输出仍是模板的边）。
这类场景通常需要为该来源添加 `dataSource`（例如 `ref: 'user.id'`）。

#### 静态分析支持

UI 图生成脚本会将：
- 节点的 `uiStates[].stateCondition` 输出到 node 的 `stateCondition`
- 边的 `ui.condition` 输出到 edge 的 `uiCondition`

```json
{
  "id": "book.modal.shelf.open",
  "source": "/book/:bookId",
  "target": "/book/:bookId?modal=shelf",
  "label": "书架管理",
  "uiCondition": { "op": "memberOf", "ref": "initialShelf", "param": "bookId", "field": "bookId" }
}
```

### 3.13 原地动作（Actions）

Actions 用于声明"页面上**可执行**的动作（通常不改变 URL）"，如开关切换、表单提交、点赞/收藏等。对于“回退型提交（完成/确定/发表）”，动作本身不声明固定 `to`，而是在 `onTrigger` 内执行副作用后再 `back()` 关闭（回退语义不强行写成 transition 边）。

#### 3.13.1 声明位置

Actions 挂在 `uiStates[]` 的 state 上：

```typescript
{
  path: '/settings/auto-download',
  component: 'AutoDownloadPage',
  uiStates: [
    {
      id: 'settings.autoDownload.base',
      search: {},
      description: '自动下载设置',
      actions: [
        {
          id: 'settings.autoDownload.toggle',
          label: '自动下载：开关',
          behavior: 'toggle',
        },
      ],
    },
  ],
}
```

#### 3.13.2 UI 打标

使用 `bindTap` 的 action 模式进行打标：

```tsx
// Action 模式：第一个参数是 { kind: 'action', id: ... }
<button
  {...bindTap(
    { kind: 'action', id: 'settings.autoDownload.toggle' },
    { onTrigger: toggleAutoDownload },
  )}
>
  允许横屏
</button>
```

产出的 DOM 属性：

```html
<button 
  data-action="settings.autoDownload.toggle" 
  data-action-type="tap"
>
  允许横屏
</button>
```

#### 3.13.3 列表项动作（带 params）

当 action 作用于列表项时，使用 `scope: 'item'` 并提供 `paramsSchema`：

```typescript
// 声明
{
  id: 'bookshelf.item.private.toggle',
  label: '书架：切换私密',
  behavior: 'toggle',
  scope: 'item',
  paramsSchema: { bookId: 'string' },
}

// 打标
{shelf.map(book => (
  <button
    key={book.bookId}
    {...bindTap(
      { kind: 'action', id: 'bookshelf.item.private.toggle' },
      { params: { bookId: book.bookId }, onTrigger: () => togglePrivate(book.bookId) },
    )}
  >
    设为私密
  </button>
))}
```

#### 3.13.4 ActionId 命名规范

ActionId **必须**满足：

- 由字母/数字/点号组成（允许驼峰）：`^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+$`
- 至少包含 3 段：`<domain>.<control>.<verb>`
- **唯一性范围**：app 内全局唯一

**verb 规则**：

| behavior | verb 后缀 | 示例 |
|----------|-----------|------|
| toggle | `.toggle` | `settings.autoDownload.toggle` |
| select | `.select.<option>` | `profile.gender.select.male` |
| input | `.input` | `search.keyword.input` |
| submit | `.submit` | `profile.edit.submit` |

**scope='item' 命名约定**：actionId 中**应**包含 `.item.`：

```
bookshelf.item.private.toggle
bookshelf.item.category.select.fiction
```

#### 3.13.5 与 `data-trigger` 的关系

- **默认规则**：同一“手势类型”下，一个入口要么是 transition（`data-trigger`），要么是 action（`data-action`）；不要在同一手势上同时标两类。
- **允许的例外（多手势复用同一节点）**：当同一 DOM 节点支持多个**不同**手势且语义不同（例如头像**单击进入主页**、**双击拍一拍**），允许同时存在 `data-trigger` 与 `data-action`，并依赖 `data-trigger-type`/`data-action-type` 区分：
  - 例：`data-trigger-type="tap"` + `data-action-type="doubleTap"`（或 `longPress`）
  - **要求**：两者手势类型必须不同；并确保运行时不会在同一次手势里同时触发 `go()` 与 action 的 `onTrigger`。
- **导航 + 副作用（同一手势）**：如果一个入口在“同一次 tap”里既导航又做副作用，仍应建模为 `data-trigger`（副作用可通过后置观测记录，或在目标页的 actions 中体现）。
- **回退型提交（完成/确定/发表）**：如果一个入口的“返回”本质是 `back()`，且回到哪里取决于历史来源，通常**不适合**写成固定 `to` 的 transition（会误导图）。此时可将“提交”建模为 `data-action`（`behavior:'submit'`），在 `onTrigger` 内部执行副作用 + `back()`；若必须在图里表达返回目标，需要把来源显式建模成离散状态或用 `cases` 让目标可判定。
- **纯回退入口（返回/取消/关闭遮罩）**：使用 `bindBack()`（`system.back`）即可，**不要**为其声明 transition，也**不要**声明 action。

---

## 四、滚动状态观测（Scroll Meta，不写入 URL）

> [!IMPORTANT]
> 本方案 **不** 将滚动位置写入 URL，也不会要求你修改现有"主 Tab 常驻（display:none）"的滚动保留策略。
>
> 滚动状态通过 `window.__getScrollMeta__()` 按需读取（自动发现滚动容器），无需事件监听。

### 4.1 设计目标

- **不影响现有 UI 语义**：Tab 常驻时，滚动由 DOM 自然保留
- **可采集**：Agent 能读取每个滚动容器的当前位置与可滚动范围
- **无性能开销**：按需读取 DOM 状态，不需要监听滚动事件
- **可回放**：轨迹回放时可用记录值执行滚动（通过脚本/控制接口实现，不依赖 URL）

### 4.2 DOM 标记

在滚动容器上添加 data 属性：

```tsx
<div 
  data-scroll-container="main" 
  data-scroll-direction="vertical"
  className="overflow-auto"
>
  {/* 内容 */}
</div>
```

### 4.3 API 使用

```javascript
// Agent 按需调用（自动发现所有带 data-scroll-container 属性的元素）
const meta = window.__getScrollMeta__();
// {
//   main: { position: 800, max: 2400, viewport: 600, total: 3000 },
// }
```

### 4.4 声明文件配置

声明文件中的 `scrollContainers` 是**必填字段**，用于静态分析和文档查阅：

```typescript
// 必填，用于静态分析
scrollContainers: [
  { name: 'main', direction: 'vertical', description: '主内容区' },
]
```

> [!NOTE]
> 运行时依靠 DOM 的 `data-scroll-container` 属性自动发现，声明中的 `name` 必须与 DOM 属性值一致。

### 4.5 返回值结构

```typescript
interface ScrollMeta {
  /** 当前滚动位置 (scrollTop 或 scrollLeft) */
  position: number;
  /** 最大可滚动距离 */
  max: number;
  /** 可视区域大小 */
  viewport: number;
  /** 内容总高度/宽度 */
  total: number;
}
```

### 4.6 实现原理

OS 层在 `SystemShell` 初始化时调用 `initScrollMeta()`，暴露 `window.__getScrollMeta__()` 函数。该函数自动查找所有带 `data-scroll-container` 属性的 DOM 元素，直接读取其滚动状态。

**优势**：
- 不需要事件监听，零运行时开销
- 自动发现，无需声明文件配置
- DOM 属性语义明确，`data-scroll-container="main"` 即可
- 自动过滤隐藏元素（`display: none`），只返回可见容器

---

## 五、导航工具实现

### 5.1 核心 Hook

```typescript
// apps/<AppName>/navigation.ts
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { NAVIGATION_DECLARATION } from './navigation.declaration';

type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];

export function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  /** 统一的状态转移函数 */
  const go = (id: TransitionId, params: Record<string, string | number> = {}) => {
    const t = NAVIGATION_DECLARATION.transitions.find(x => x.id === id);
    if (!t) throw new Error(`Transition not found: ${id}`);

    // 校验源状态（pathname + search）
    if (!matchFrom(t.from, location.pathname, searchParams)) {
      throw new Error(
        `Transition "${id}" not allowed from "${location.pathname}${location.search}"`
      );
    }

    // 选择条件分支（如存在）
    const chosen = chooseCase(t, { pathname: location.pathname, searchParams, params });
    const effectiveTo = chosen ? chosen.to : t.to;
    const effectiveSearch = chosen ? chosen.search : t.search;
    const effectiveSearchParams = chosen?.searchParams || t.searchParams;

    // 确定目标 pathname
    const targetPathname = replaceParams(effectiveTo, params);
    
    // 构建目标 search params（支持 preserveParams）
    const newParams = buildSearchParams({
      currentSearchParams: searchParams,
      preserveParams: t.preserveParams || [],
      staticSearch: effectiveSearch,
      dynamicSearchParams: effectiveSearchParams,
      runtimeParams: params,
    });
    
    // 构建完整 URL
    const searchStr = newParams.toString();
    const targetUrl = searchStr ? `${targetPathname}?${searchStr}` : targetPathname;
    
    navigate(targetUrl, t.mode === 'replace' ? { replace: true } : undefined);
  };

  /** 历史回退 */
  const back = (steps: number = 1) => {
    navigate(-steps);
  };

  return { go, back };
}

/**
 * 匹配源状态约束
 */
function matchFrom(
  from: '*' | string | Array<'*' | string | FromConstraint> | FromConstraint,
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  if (from === '*') return true;
  const constraints = Array.isArray(from) ? from : [from];
  
  return constraints.some(constraint => {
    if (constraint === '*') return true;
    if (typeof constraint === 'string') {
      // 简单字符串：只匹配 pathname
      return matchRoute(constraint, pathname);
    } else {
      // FromConstraint：同时匹配 pathname 和 search
      if (!matchRoute(constraint.path, pathname)) return false;
      
      if (constraint.search) {
        for (const [key, expected] of Object.entries(constraint.search)) {
          const actual = searchParams.get(key);
          
          if (expected === '*') {
            // 必须存在（任意非空值）
            if (!actual) return false;
          } else if (expected === null) {
            // 必须不存在
            if (actual !== null) return false;
          } else {
            // 必须等于指定值
            if (actual !== expected) return false;
          }
        }
      }
      
      return true;
    }
  });
}

/**
 * 构建目标 search params
 * 
 * 处理顺序：
 * 1. 从空 query 开始
 * 2. 保留 preserveParams 中指定的当前参数
 * 3. 应用静态 search 值（覆盖保留值）
 * 4. 应用动态 searchParams（覆盖静态值）
 */
function buildSearchParams(options: {
  currentSearchParams: URLSearchParams;
  preserveParams: string[];
  staticSearch: Record<string, string | null>;
  dynamicSearchParams: Record<string, 'string' | 'number'>;
  runtimeParams: Record<string, string | number>;
}): URLSearchParams {
  const { 
    currentSearchParams,
    preserveParams,
    staticSearch, 
    dynamicSearchParams, 
    runtimeParams,
  } = options;
  
  // 1. 从空 query 开始
  const newParams = new URLSearchParams();
  
  // 2. 保留指定的当前参数
  for (const key of preserveParams) {
    const value = currentSearchParams.get(key);
    if (value !== null) {
      newParams.set(key, value);
    }
  }
  
  // 3. 应用静态 search 值
  for (const [key, value] of Object.entries(staticSearch)) {
    if (value === null) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
  }
  
  // 4. 应用动态 searchParams
  for (const key of Object.keys(dynamicSearchParams)) {
    const value = runtimeParams[key];
    if (value !== undefined) {
      newParams.set(key, String(value));
    }
  }
  
  return newParams;
}

function replaceParams(path: string, params: Record<string, string | number>): string {
  return path.replace(/:(\w+)/g, (_, key) => String(params[key] ?? `:${key}`));
}

function matchRoute(template: string, path: string): boolean {
  // '*' 作为“任意路径”的通配符
  if (template === '*') return true;
  const regex = new RegExp('^' + template.replace(/:\w+/g, '[^/]+') + '$');
  return regex.test(path);
}

/**
 * cases 选择逻辑：
 * 
 * 规则：
 * - cases 为 undefined 或空数组：返回 null（使用顶层 to/search）
 * - cases 非空：按顺序找第一个 when 为 true 的分支
 * - 强约束：非空 cases 必须以 `{ when: { op: 'always' } }` 结尾作为兜底
 */
function chooseCase(
  t: TransitionDeclaration,
  ctx: { pathname: string; searchParams: URLSearchParams; params: Record<string, string | number> }
): CaseDeclaration | null {
  // 无 cases 或空数组：使用顶层 to/search
  if (!t.cases || t.cases.length === 0) return null;
  
  for (const c of t.cases) {
    if (evalCondition(c.when, ctx)) return c;
  }
  
  // 如果走到这里，说明没有分支匹配（缺少 always 兜底）
  throw new Error(
    `Transition "${t.id}" cases has no matching branch. ` +
    `Non-empty cases must end with { when: { op: 'always' } }.`
  );
}

function evalCondition(
  cond: Condition,
  ctx: { pathname: string; searchParams: URLSearchParams; params: Record<string, string | number> }
): boolean {
  switch (cond.op) {
    case 'always':
      return true;
    case 'and':
      return cond.items.every(x => evalCondition(x, ctx));
    case 'or':
      return cond.items.some(x => evalCondition(x, ctx));
    case 'not':
      return !evalCondition(cond.item, ctx);
    case 'exists': {
      const v = resolveValue(cond.ref, ctx);
      return v !== null && v !== undefined && String(v) !== '';
    }
    case 'eq':
      return resolveValue(cond.left, ctx) === cond.right;
    case 'in':
      return cond.right.includes(resolveValue(cond.left, ctx) as any);
    case 'match': {
      const v = resolveValue(cond.left, ctx);
      if (v === null || v === undefined) return false;
      const re = new RegExp(cond.right);
      return re.test(String(v));
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const v = resolveValue(cond.left, ctx);
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) return false;
      if (cond.op === 'gt') return n > cond.right;
      if (cond.op === 'gte') return n >= cond.right;
      if (cond.op === 'lt') return n < cond.right;
      return n <= cond.right;
    }
    default:
      return false;
  }
}

function resolveValue(
  ref: ValueRef,
  ctx: { pathname: string; searchParams: URLSearchParams; params: Record<string, string | number> }
): Primitive {
  if (ref.ref === 'search') {
    const v = ctx.searchParams.get(ref.key);
    return v === null ? null : v;
  }
  if (ref.ref === 'param') {
    const v = ctx.params[ref.key];
    return (v === undefined ? null : (typeof v === 'number' || typeof v === 'boolean' ? v : String(v))) as any;
  }
  // appState：需要你在实现里接入 AppStateRegistry / __SIM__.getState
  return null;
}
```

### 5.2 DOM 绑定约定

所有触发导航的元素必须绑定 `data-trigger` 属性：

```typescript
// ✅ 正确
<button data-trigger="chat.open" onClick={() => go('chat.open', { id })}>
  打开
</button>

// ❌ 错误
<button onClick={() => go('chat.open', { id })}>打开</button>
```

### 5.3 `data-trigger-params` 属性

当多个按钮使用同一个 `transitionId` 但参数不同时，需要添加 `data-trigger-params` 属性帮助导航图和任务生成工具区分：

```tsx
// 问题：两个按钮都是 myReading.tab.switch，如何区分？
<button data-trigger="myReading.tab.switch">周</button>
<button data-trigger="myReading.tab.switch">月</button>

// 解决方案：添加 data-trigger-params
<button 
  data-trigger="myReading.tab.switch" 
  data-trigger-params='{"tab":"week"}'
>周</button>

<button 
  data-trigger="myReading.tab.switch" 
  data-trigger-params='{"tab":"month"}'
>月</button>
```

**使用 `useTriggerGestures` hook 自动处理**：

```tsx
import { useTriggerGestures } from '@/os/hooks/useTriggerGestures';

// 传入 params 时会自动添加 data-trigger-params
const { bindTap } = useTriggerGestures();
const tabRef = bindTap('myReading.tab.switch', { 
  params: { tab: 'week' } 
});
// tabRef 包含：
// {
//   'data-trigger': 'myReading.tab.switch',
//   'data-trigger-type': 'tap',
//   'data-trigger-params': '{"tab":"week"}',
//   onClick: ...,
// }

return <button {...tabRef}>周视图</button>;
```

**适用场景**：

| 场景 | 示例 | 是否需要 data-trigger-params |
|------|------|------------------------------|
| Tab 切换 | 周/月/年/总视图 | ✅ 需要区分目标 tab |
| 列表项点击 | 点击不同书籍封面 | ✅ 需要区分目标 bookId |
| 固定按钮 | 返回按钮 | ❌ 无参数 |
| 跳转入口 | "查看全部"按钮 | ❌ 固定目标 |

---

## 六、工程约束

### 6.1 ESLint 规则

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'react-router-dom',
        importNames: ['useNavigate'],
        message: '请使用 useAppNavigate() 替代 useNavigate()'
      }]
    }]
  }
};
```

### 6.2 CI 检查脚本

```bash
#!/bin/bash
# scripts/check_navigation.sh

VIOLATIONS=$(grep -r "navigate(" apps/ \
  --include="*.tsx" --include="*.ts" \
  | grep -v "navigation.ts" \
  | grep -v "// @navigation-ignore")

if [ -n "$VIOLATIONS" ]; then
  echo "❌ 发现直接使用 navigate() 的代码："
  echo "$VIOLATIONS"
  exit 1
fi

echo "✅ 导航规范检查通过"
```

### 6.3 类型约束

```typescript
export const NAVIGATION_DECLARATION = {
  app: 'wechat',
  routes: [...],
  transitions: [...],
} as const satisfies NavigationDeclaration;
```

### 6.4 Actions 校验规则

**强制打标**：

- 所有导航入口必须有 `data-trigger`
- 所有原地动作入口必须有 `data-action`
- **共享组件/间接绑定入口**（TopBar/FAB 等）：若入口 DOM 在共享组件，但 `transitionId/actionId` 由页面通过 context/store 配置，仍必须保证共享组件最终产出 `data-trigger-*` / `data-action-*`；并要求页面侧以 object literal 传递，且入口字段名**必须写死为 `id`**，用 `id: '<...>'` **字符串字面量**传递（禁止动态拼接/变量计算），否则静态校验无法可靠发现。

**CI 必须检查的规则**：

| 校验项 | 规则 |
|--------|------|
| base state 命名 | 若 `uiState.search` 为 `{}`，则 `id` 必须以 `.base` 结尾 |
| actionId 唯一性 | `action.id` app 内全局唯一 |
| scope='item' 约束 | `paramsSchema` 必须包含至少一个对象标识字段 |
| behavior='input' 约束 | `paramsSchema` 必须包含 `value` 字段 |
| behavior='select' 格式 | actionId 必须匹配 `<prefix>.select.<option>` 格式 |

**打标层校验（可选）**：

- 若 action 声明了 `paramsSchema`，则 UI 侧必须提供 `data-action-params`
- `data-action-params` 的 key 集合必须与 `paramsSchema` 一致
- `data-action-params` 必须是合法 JSON

---

## 七、UI 图生成

> 详见：[UI_GRAPH_GENERATION.md](./UI_GRAPH_GENERATION.md)

从导航声明静态生成 UI 状态转移图：

- **节点**：`pathname模板 + 离散query + 动态query占位符`
- **边**：由 `TransitionDeclaration` 生成，包括 `navigation`（跨页面）、`state`（同页面）
- **校验**：检查目标路由/状态是否在声明中存在

---

## 八、声明文件示例

```typescript
// apps/Bilibili/navigation.declaration.ts

export const NAVIGATION_DECLARATION = {
  app: 'bilibili',

  routes: [
    {
      path: '/',
      component: 'HomePage',
      params: {},
      entryPoint: 'home',
      description: '首页',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '首页内容' }],
      queryParams: {},  // 无动态 query
      uiStates: [
        { id: 'home.base', search: {}, description: '首页' },
      ],     // 无离散子状态，只有基础状态
    },
    {
      path: '/video/:bvid',
      component: 'VideoDetailPage',
      params: { bvid: 'string' },
      entryPoint: 'deepLink',
      description: '视频详情',
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '主内容区' },
        { name: 'related', direction: 'horizontal', description: '相关推荐' },
      ],
      queryParams: { mid: 'string' },  // 动态参数：用户菜单的目标用户 ID
      // 离散状态必须枚举（有限集合）
      uiStates: [
        { id: 'video.tab.comment', search: { tab: 'comment' }, description: '评论 Tab' },
        { id: 'video.menu', search: { menu: 'true' }, description: '用户菜单打开' },
        { id: 'video.suggestions', search: { suggestions: 'true' }, description: '推荐面板' },
      ],
    },
  ],

  transitions: [
    // 主页 -> 视频详情（打开时默认简介 Tab）
    {
      id: 'video.open',
      from: '/',
      to: '/video/:bvid',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { bvid: 'string' },
      label: '打开视频',
      ui: { placement: 'content', icon: '' },
    },

    // 视频页内 tab 切换（同 pathname，不同离散 route-state）
    {
      id: 'video.tab.comment',
      from: { path: '/video/:bvid', search: { tab: null } },
      to: '/video/:bvid',
      search: { tab: 'comment' },
      searchParams: {},
      mode: 'replace',  // Tab 切换使用 replace
      params: {},
      label: '切到评论 Tab',
      ui: { placement: 'content', icon: '' },
    },
    {
      id: 'video.tab.intro',
      from: { path: '/video/:bvid', search: { tab: 'comment' } },
      to: '/video/:bvid',
      search: { tab: null },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切到简介 Tab',
      ui: { placement: 'content', icon: '' },
    },
    
    // 打开用户菜单（带动态 mid 参数）
    {
      id: 'video.menu.open',
      from: { path: '/video/:bvid', search: { menu: null } },
      to: '/video/:bvid',
      search: { menu: 'true' },
      searchParams: { mid: 'string' },  // 动态：目标用户 ID
      mode: 'push',
      params: {},
      label: '打开用户菜单',
      ui: { placement: 'content', icon: '' },
    },
  ],

  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;
```

**生成的图节点**：
- `/` — 首页
- `/video/:bvid` — 视频详情（基础）
- `/video/:bvid?tab=comment` — 评论 Tab
- `/video/:bvid?menu=true&mid=:mid` — 用户菜单（mid 是动态占位符）
- `/video/:bvid?suggestions=true` — 推荐面板

---

## 附录 A：场景覆盖清单

| 场景 | 支持方式 |
|------|---------|
| 基础路由跳转 | `transitions` + `to` 字段 |
| 动态路径参数 | `params` 字段 |
| 动态 query 参数（无限集合） | `searchParams` + `queryParams`，图节点使用 `:param` 占位符 |
| 离散 UI 状态（有限集合） | `search` + `uiStates` 枚举 |
| Tab 切换 | `mode: 'replace'` |
| Tab 合并切换 | `.switch` transition + `searchParams` |
| Replace 导航 | `mode: 'replace'` |
| 保留现有参数 | `preserveParams` 字段 |
| Modal / 菜单（静态） | `to: <same pathname template>` + `search` 字段 |
| Modal / 菜单（动态） | `search` + `searchParams` |
| 删除查询参数 | `search: { key: null }` |
| 条件可用动作 | `from: FromConstraint` |
| 同时改变路由和状态 | `to` + `search` 同时使用 |
| 历史回退 | `back(steps?)` 内建 |
| 条件跳转 | `cases` 字段 |
| 滚动观测 | `window.__getScrollMeta__` + `scrollContainers` 声明 |
| 滚动越界处理 | 自动 clamp |
| 动态参数区分（Agent） | `data-trigger-params` 属性 |
| 手势类型声明 | `ui.gesture` 字段 |
| Tab 记忆 | context 保存 + `searchParams` 传递 |
| **原地动作（Actions）** | |
| 全局开关 | `actions` + `behavior: 'toggle'` |
| 列表项动作 | `scope: 'item'` + `paramsSchema` |
| 选择类动作 | `behavior: 'select'` + actionId 包含 `.select.<option>` |
| 输入类动作 | `behavior: 'input'` + `paramsSchema: { value: ... }` |
| 提交类动作 | `behavior: 'submit'` |
| 动作打标 | `data-action` + `data-action-type` + `data-action-params` |

### 常见错误速查

| 错误类型 | 表现 | 解决方案 |
|---------|------|---------|
| Tab 用路径参数 | `/my-reading/:tabId` | 改为 `/my-reading?tab=xxx` + `uiStates` |
| 嵌套 Tab 用路径 | `/page/tab1/subtab` | 改为 `?tab=tab1&sub=subtab` 查询参数组合 |
| `from: '*'` | 任意页面可触发 | 显式列出允许的源状态 |
| `from` 包含自身 | 底部 Tab 可自环 | 从 `from` 中移除自身路由 |
| 冗余 tab transition | 每个 tab 单独声明 | 使用 `.switch` + `searchParams` |
| 裸路由状态 | 缺少必须参数的 uiState | 确保所有 uiState 都带必要参数（或拒绝非法 URL） |
| Tab 不记忆 | 跨页面后回到默认 tab | 用 context 保存 + `searchParams` 传递 |
| UI 图边重复/自环 | 展开后出现 source === target | 图生成脚本过滤 `source === target` |
| 嵌套 Tab 子切换边缺失 | 子 Tab 间无法切换 | `.switch` 的 `from` 须显式列出所有带 `sub` 的源状态 |
| 顶层 Tab 切换未清子参数 | 切顶层 Tab 后子 Tab 状态残留 | 添加 `search: { sub: null }` 清除子参数 |
| active Tab 未打标 | 试图用条件渲染省略 `bindTap` | **active tab 也必须打标**；no-op/self-loop 由分析器过滤 |
| 声明未同步 `<Routes>` | 运行时 `No routes matched location` | 新增 path 时同步在 `<Routes>` 注册 `<Route>` |
| Actions 重复 ID | 同一 actionId 在多个 uiState 声明 | 按语义拆分 actionId，确保 App 内全局唯一 |
| select actionId 格式错 | `behavior='select'` 但 id 不符合格式 | 改为 `<prefix>.select.<option>` 格式 |
| `WARN(schema): unreachable subgraph` | source/target 节点缺失或 from/search 不闭合 | 检查 `from` 是否写了裸路径（无 base），`to+search` 是否命中某个 `uiStates` 组合 |

## 附录 B：命名约定

### Transition ID
```
<feature>.<action>[.<detail>]

示例：
- chat.open
- tab.contacts
- video.tab.comment
- modal.shelf.open
- modal.edit.open
```

### Action ID
```
<domain>.<control>.<verb>
<domain>.<page>.<control>.<verb>

规则：
- 至少 3 段，点号分隔
- 末尾是 verb：toggle/select.<option>/input/submit
- scope='item' 时包含 .item.
```

示例：

| actionId | behavior | scope | 说明 |
|----------|----------|-------|------|
| `settings.autoDownload.toggle` | toggle | (默认) | 全局开关 |
| `settings.reader.allowLandscape.toggle` | toggle | (默认) | 全局开关 |
| `bookshelf.item.private.toggle` | toggle | item | 列表项开关 |
| `profile.gender.select.male` | select | (默认) | 全局选择 |
| `profile.gender.select.female` | select | (默认) | 全局选择 |
| `bookshelf.item.category.select.fiction` | select | item | 列表项选择 |
| `search.keyword.input` | input | (默认) | 全局输入 |
| `profile.edit.submit` | submit | (默认) | 全局提交 |

## 附录 C：FromConstraint 语法速查

| 约束类型 | 语法 | 含义 |
|---------|------|------|
| 仅匹配路径 | `'/video/:id'` | pathname 匹配即可 |
| 参数必须存在 | `{ path: '/video/:id', search: { modal: '*' } }` | modal 参数必须有值 |
| 参数必须等于 | `{ path: '/video/:id', search: { tab: 'comment' } }` | tab 必须等于 'comment' |
| 参数必须不存在 | `{ path: '/video/:id', search: { tab: null } }` | tab 参数不存在 |
| 组合约束 | `{ path: '/list', search: { filter: '*', modal: null } }` | filter 存在且 modal 不存在 |

---

## 附录 D：修订历史

### v3.3 (2026-04-02)

**补充实践经验（来自 APP_MIGRATION_GUIDE.md）**：

1. **新增 §3.4.5** — 首页带参数 Tab 的完整处理模式（`MemoryRouter initialEntries`、覆盖层入口不可用、`pathname` 判断）
2. **新增 §3.4.6** — "声明 ≠ 路由可访问"陷阱说明（`<Routes>` 必须同步注册）
3. **扩充附录 A 常见错误速查** — 新增嵌套 Tab、active Tab 打标、声明未同步路由、Actions ID、`WARN unreachable subgraph` 等条目

### v3.2 (2026-01-13)

**合并 Actions 声明方案**：

将 `ACTIONS_DECLARATION_PROPOSAL.md` 的核心内容合并入本文档，形成统一的导航+动作声明规范：

1. **新增 1.4 Transitions vs Actions** — 明确两者的区别与适用场景
2. **新增 ActionDeclaration 类型** — 定义原地动作的声明结构
3. **扩展 uiStates[].actions** — Actions 挂在 uiState 节点上
4. **新增 3.13 原地动作（Actions）** — 详细使用规范
5. **新增 6.4 Actions 校验规则** — CI 必须检查的规则
6. **扩展附录 A/B** — 添加 Actions 场景覆盖与命名约定

### v3.1 (2026-01-11)

**语义澄清（v0.5 兼容）**：将“条件”放到更语义正确的位置，避免把“入口显示”误解成“跳转可行性”：

- **节点存在条件**：`uiStates[].stateCondition`
- **入口显示条件**：`ui.condition`

并且在 data 图生成时：

- 条件仅在“可评价”时用于剪枝
- 无法计算（数据不足/缺参数）时保守保留并标注原因

### v3.0 (2026-01-11)

**设计规范增补**（已合并入本文）：

1. **Tab 状态必须使用查询参数** — 有限集合的 tab/modal 等状态不应使用路径参数（如 `/:tabId`），应使用 `?tab=xxx` + `uiStates` 枚举
2. **不推荐 `from: '*'`** — 全局通配符绕过源状态约束，应显式列出来源
3. **禁止 `from` 包含自身** — 底部 Tab 不应能从当前页面触发到自己（防止自环）
4. **使用 `.switch` 合并 Tab 切换** — 避免为每个 tab 创建独立 transition
5. **必须带参数的路由** — 某些页面不存在"裸路由"状态，所有 uiState 都必须带参数

**新增特性**：

6. **`data-trigger-params` 属性** — 用于导航图和任务生成工具区分相同 transitionId 但不同参数的按钮
7. **`ui.gesture` 字段** — 在 UI 元信息中声明触发手势类型（`tap`、`longPress`、`doubleTap`、`back`）
8. **`useTriggerGestures` hook** — 自动处理 `data-trigger` 和 `data-trigger-params` 的绑定
9. **Tab 记忆机制** — 跨页面跳转时记住上次的 tab 状态
10. **动态 Label 展开** — UI 图脚本自动附加目标状态描述到 label
11. **简化图生成** — 将所有 tab 合并为单一节点，便于检查页面间关系

---

### v2.0 (2026-01-10)

**核心概念修订**：

1. **区分离散状态与动态参数**
   - 离散状态（`modal`, `tab`, `menu`, `select`）：有限集合，必须在 `uiStates` 中枚举
   - 动态参数（`itemId`, `q`, `page`, `mid`）：无限集合，在 `queryParams`/`searchParams` 中声明类型，图节点使用 `:param` 占位符

2. **新增 `preserveParams` 字段**
   - 解决"修改某个参数但保留其他参数"的场景
   - 例如：切换 tab 时保留搜索词 `q`

3. **新增 `queryParams` 字段（RouteDeclaration）**
   - 声明该路由支持的动态 query 参数类型
   - 用于图节点 ID 生成和静态校验

4. **修正 `cases` 规范**
   - `cases` 改为可选字段（可省略或设为 `undefined`）
   - 空数组 `[]` 等价于省略
   - 非空时必须以 `{ when: { op: 'always' } }` 结尾

**图生成逻辑修复**：

5. **修复 `cases` 分支的目标计算**
   - 正确计算每个 case 的 `to` + `search` + `searchParams`
   - 所有分支都参与 `missing_route_state` 校验

6. **修复 `buildTargetNodeId` 函数**
   - 使用目标 `to` 的 pathname，而非源状态
   - 正确处理动态 `searchParams` 的占位符

7. **新增校验类型**
   - `invalid_from_route`: 源 pathname 不存在于 routes 中
   - `invalid_from_state`: 源离散状态未在对应 route 的 uiStates 中枚举
   - `missing_route`: 目标 pathname 不存在
   - `missing_route_state`: 目标离散状态未枚举
   - `cases_missing_always`: 非空 cases 缺少 always 分支
   - `undeclared_query_param`: 使用了未声明的动态参数

**其他修复**：

8. **修复 JSDoc 语法错误**（原第 148 行缺少 `/**`）

9. **更新 `buildSearchParams` 实现**
    - 支持 `preserveParams`
    - 支持 case 分支的 `searchParams` 覆盖

**文档结构调整**：

11. **UI 图生成拆分为独立文档**
    - 详见 [UI_GRAPH_GENERATION.md](./UI_GRAPH_GENERATION.md)

12. **移除不相关章节**
    - 移除"Agent 数据采集"（与声明规范无关）
    - 移除"实施计划"（属于项目管理范畴）
