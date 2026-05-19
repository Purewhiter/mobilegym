# Simulated Android OS - 项目规范文档 v2.2

> 本项目是为训练和评测（benchmark）手机操作 Agent 而构建的虚拟 Android 环境。
> 本文档整合了声明式导航、统一手势体系等最新规范，是开发新 App 和迁移旧 App 的权威参考。

---

## 一、项目概述

### 1.1 目标

- 提供一个浏览器内运行的模拟 Android 系统
- 通过 JavaScript 接口（`__SIM__`/`__OS__` 等）支持任务编排、状态判定与轨迹数据合成（这些接口不属于 Agent 观测空间——Agent 是纯视觉的，仅通过截图观测）
- 允许通过配置文件设置不同的初始状态，用于多样化训练场景
- **支持静态分析生成 UI 状态转移图**，用于 Agent 训练数据采集

### 1.2 核心能力

| 能力 | 接口 | 说明 |
|------|------|------|
| 状态读取（bench_env 用） | `__SIM__.getState()` | 获取 OS 状态 + 所有 App 状态（用于任务判定与轨迹合成，非 Agent 观测） |
| 状态设置 | `__SIM__.setState(patch, options?)` | 合并写入 App 状态到 localStorage |
| 环境重置 | `__SIM__.reset()` | 清空 localStorage + 刷新页面 |
| 返回操作 | `__OS__.handleBack()` | 触发系统返回（App 内返回或回桌面） |
| 回到桌面 | `__OS__.goHome()` | 强制回到桌面 |
| 多任务视图 | `__OS__.showRecents()` | 显示最近任务 |
| 获取系统时间 | `__SIM_TIME__.now()` | 获取当前时间戳（支持模拟时间） |
| 设置模拟时间 | `__SIM_TIME__.setSimulatedTime(ts)` | 设置模拟时间（用于测试） |
| 获取当前位置 | `__SIM_LOCATION__.getCoords()` | 获取当前坐标（支持模拟定位） |
| 设置模拟位置 | `__SIM_LOCATION__.setSimulatedLocation(loc)` | 设置模拟位置（城市名或坐标） |
| 模拟定位错误 | `__SIM_LOCATION__.simulateError(code)` | 模拟定位失败（1=权限拒绝,2=不可用,3=超时） |
| 滚动状态读取（bench_env 用） | `__getScrollMeta__()` | 获取当前滚动容器的位置信息（用于轨迹合成，非 Agent 观测） |
| 当前路由信息 | `__OS__.getAppRoute()` | 获取当前 App 的 route（`{ app, path }`） |

### 1.3 设计原则

1. **声明式优先**：所有路由、跳转、UI 状态都写入 `navigation.declaration.ts`
2. **数据分层**：常量 / 默认数据 / 运行时状态三层分离（`constants.ts` + `data/defaults.json` + `localStorage`）
3. **静态可分析**：禁止动态字符串拼接路由，确保图生成工具可静态提取
4. **类型安全**：TypeScript 编译时检查，杜绝无效跳转

---

## 二、目录结构规范

```
mobile-gym/
├── os/                              # 操作系统核心
│   ├── OSContext.tsx                # OS 状态管理 + 暴露 __OS__ 和 __SIM__ 接口
│   ├── SystemShell.tsx              # 系统壳（桌面、状态栏、手势、App 渲染）
│   ├── AppStateRegistry.ts          # App 状态注册表（聚合所有 App 状态）
│   ├── TimeService.ts               # 系统时间服务（支持真实/模拟时间）
│   ├── LocationService.ts           # 系统定位 + 反地理编码服务（支持真实/模拟定位）
│   ├── NetworkService.ts            # 系统网络服务（统一走网关规避 CORS + cookie jar）
│   ├── useSystemTime.ts             # 时间服务的 React Hook
│   ├── types.ts                     # 系统类型定义
│   ├── hooks/
│   │   ├── useTriggerGestures.ts    # ⭐ 统一手势 Hook
│   │   └── useAppReady.ts           # App 就绪通知 Hook
│   ├── components/                  # OS 级 UI 组件
│   │   ├── HomeClockWidget.tsx      # 桌面时钟小部件
│   │   └── HomeWeatherWidget.tsx    # 桌面天气小部件
│   └── data/
│       ├── defaults.json            # OS 默认数据（Android 四层数据模型）
│       ├── index.ts                 # OS 数据入口（导出 OS_DEFAULTS）
│       └── appRegistry.tsx          # ⭐ App 注册表（组件、图标、元数据）
│
├── apps/                            # 第三方应用目录
│   └── <AppName>/                   # 每个 App 一个文件夹
│       ├── manifest.ts
│       ├── <AppName>App.tsx
│       └── ...
│
├── system/                          # 系统应用目录
│   └── <AppName>/                   # 结构与 apps/ 相同
│       ├── manifest.ts              # App 身份/图标/主题 Tier-1 色 + intentFilters（对齐 AndroidManifest.xml）
│       ├── <AppName>App.tsx         # App 主入口组件
│       ├── navigation.declaration.ts # ⭐ 导航声明（必须）
│       ├── navigation.ts            # ⭐ 导航 Hook 实现（go/back，支持 popTo）
│       ├── navigation.types.ts      # ⭐ 导航类型定义（可选）
│       ├── res/                     # 资源层（对齐 Android res/values/*：colors/strings/dimens 等）
│       ├── assets/                  # 二进制资产（图片/音效/字体等；Vite import，自包含于 App 内）
│       ├── context/                 # 状态管理
│       │   └── <AppName>Context.tsx
│       ├── hooks/                   # 自定义 Hooks
│       │   └── use<AppName>Gestures.ts  # App 封装的手势 Hook
│       ├── types.ts                 # App 类型定义（位置标准化）
│       ├── pages/                   # 页面组件
│       │   ├── HomePage.tsx
│       │   └── DetailPage.tsx
│       ├── components/              # 可复用组件
│       ├── constants.ts             # 结构性常量（tabs/配置等；资源类常量迁到 res/）
│       └── data/                    # 默认数据（JSON，可替换）+ 入口（合并 constants + defaults）
│           ├── index.ts             # 唯一 TS 入口：合并 constants + defaults
│           └── defaults.json
│
├── scripts/                         # 开发工具脚本
│   ├── navigation_declaration_analyzer.mjs  # 导航声明分析器
│   ├── dump_trigger_gestures.mjs    # 手势绑定扫描器
│   └── static_ui_analyzer.py        # 静态 UI 分析器
│
└── docs/                            # 文档
    ├── specs/                       # 核心开发规范
    ├── navigation/                  # 导航声明 + UI 图子系统
    ├── os-services/                 # OS 服务 API 参考
    ├── arch/                        # 架构背景理解
    ├── app-dev/                     # App 开发工具与流程
    ├── pending/                     # 待实施提案
    └── archive/                     # 已完成的一次性文档
```

### 2.1 App 资源与资产规范（对齐 Android res/ 思路）

- **资源（`res/`）**：把“用户可见字符串 / 组件级颜色 / 尺寸”等可替换资源集中到 `apps/<AppName>/res/`，推荐最小集合：
  - `res/colors.ts`（Tier-2 组件级颜色；Tier-1 语义色在 `manifest.ts theme.colors`）
  - `res/strings.ts`（默认中文；可选 `strings.en.ts` 作为覆盖）
  - `res/dimens.ts`（标配；用于 bench_env 环境变体调参）
- **静态资产（`assets/`）**：App 自有的图片/音效/字体等二进制资源放在 `apps/<AppName>/assets/`，通过 Vite `import` 引用，避免使用 `public/<appName>/...` 这种裸 URL 字符串（不自包含、不参与打包 hash）。
- **`public/` 保留**：仅保留 OS 级共享资源与工具生成产物（如主题包、虚拟 SD 卡、输入法词典、导航图/任务 JSON 等），不要再放 App 专属资源。

---

## 三、导航声明规范（核心）

> [!IMPORTANT]
> 这是 v2.0 最重要的新增规范。所有 App 必须遵循声明式导航架构。

### 3.1 声明文件结构

每个 App 必须在根目录创建 `navigation.declaration.ts`：

```typescript
// apps/<AppName>/navigation.declaration.ts

import type { NavigationDeclaration } from './navigation.types';

export const NAVIGATION_DECLARATION = {
  app: 'myapp',
  
  routes: [...],          // 路由定义
  transitions: [...],     // 状态转移声明
  
  capabilities: {
    historyBack: true,    // 是否支持历史回退
  },
} as const satisfies NavigationDeclaration;
```

### 3.2 路由声明（RouteDeclaration）

```typescript
{
  path: '/video/:bvid',           // 路由路径，支持动态参数
  component: 'VideoDetailPage',   // 组件名称
  params: { bvid: 'string' },     // 路径参数类型
  entryPoint: 'deepLink',         // 入口语义（外部链接直达）
  description: '视频详情',
  
  // 滚动容器声明（用于观测，不影响 URL）
  scrollContainers: [
    { name: 'main', direction: 'vertical', description: '主内容区' },
  ],
  
  // 动态 query 参数（无限集合，不枚举值）
  queryParams: { mid: 'string' },
  
  // 离散 UI 状态（有限集合，必须枚举）
  uiStates: [
    // ✅ 平级 Tab：tab 视为必填离散参数（不允许用裸路由表达默认 Tab）
    { id: 'video.tab.recommend', search: { tab: 'recommend' }, description: '推荐 Tab' },
    { id: 'video.tab.comment', search: { tab: 'comment' }, description: '评论 Tab' },
    // ✅ 组合状态：仅枚举实际可达的组合（例：评论 Tab 内打开分享弹窗）
    { id: 'video.tab.comment.modal.share', search: { tab: 'comment', modal: 'share' }, description: '评论 Tab-分享弹窗' },
  ],
}
```

**rules**：
- `uiStates` 是必选字段：每个 `routes[]` 都必须显式提供 `uiStates` 数组
- **平级 Tab（推荐写法）**：若该路由存在“平级 Tab”（即 `tab` 用于区分同一页面主体内容的有限集合状态），则 `tab` 视为**必填离散参数**：
  - **不得**声明 `search: {}` 的 base `uiState`（裸路由视为非法/不可达）
  - 必须枚举每个 Tab 的 `uiState.search`（每个状态都包含 `tab: '...'`）
- **无 Tab 的裸路由**：若页面存在“裸路由”状态（不要求任何离散 query，例如没有 `tab` 这种必填离散参数），则必须声明且仅声明一个 base `uiState`：`search: {}` 且 `id` 以 `.base` 结尾
- **必须带离散 query 才合法**：若页面依赖某个离散 query 必须存在（典型：平级 Tab 的 `tab`/嵌套 Tab 的 `tab/sub`），则不声明 base `uiState`，只枚举实际可达的离散状态
- `queryParams` 也是必选字段：没有动态 query 参数时写 `{}`（不要省略）

**entryPoint**：
- 取值：`'home' | 'deepLink' | 'both' | 'none'`（向后兼容：`true => 'deepLink'`，`false => 'none'`）
- UI 图生成的“入口节点”来自 `entryPoint='home'|'both'` 的路由（默认取 `uiStates[0]` 作为入口态）

### 3.3 状态转移声明（TransitionDeclaration）

```typescript
{
  id: 'video.tab.comment',                      // 唯一标识
  from: { path: '/video/:bvid', search: { tab: '*' } },   // 源状态约束（tab 必填）
  to: '/video/:bvid',                           // 目标 pathname
  search: { tab: 'comment' },                   // 静态离散 query
  searchParams: {},                             // 动态 query 参数
  preserveParams: [],                           // 需保留的现有参数
  mode: 'replace',                              // push 或 replace
  params: {},                                   // 路径参数类型
  label: '切到评论 Tab',
  ui: { 
    placement: 'content',                       // 位置
    icon: '',                                   // 图标
    gesture: 'tap',                             // 手势类型
  },
}
```

**rules**：
- `to` 必填：即使是“同 pathname 的离散状态切换”（Tab/Modal/Menu 等），也必须显式写出目标 pathname 模板
- 不推荐使用 `from: '*'`（会绕过源状态约束，降低静态可分析性）；推荐显式列出允许的来源
- 当 `to` 与 `from.path` 相同但离散状态变化时，`from` 应使用 `FromConstraint` 显式约束相关离散 key（避免歧义）
- 底部 Tab 切换等场景，避免 `from` 包含自身（防止自环）
- **无 base 状态时禁止裸路径 `from`（强约束）**：若某 route **不声明** `search:{}` 的 base `uiState`（例如必须带 `tab/menu/modal` 等离散参数才合法），则 `transition.from` **不得**写成 `'/route'` 这种裸路径字符串；必须使用 `{ path: '/route', search: { ... } }` 或枚举可达 `uiStates`，否则会在图里制造误导的“裸路径节点”。

### 3.4 离散状态 vs 动态参数

| 类型 | 特征 | 处理方式 | 示例 |
|------|------|----------|------|
| **离散状态** | 有限集合，影响 UI 可见性/可用动作 | 必须在 `uiStates` 中枚举 | `modal`, `tab`, `menu`, `select` |
| **动态参数** | 无限集合，运行时传入的数据 | 在 `queryParams`/`searchParams` 中声明类型 | `itemId`, `q`, `page`, `mid` |

> [!NOTE]
> **易混淆点（规范语义 vs 工具输出）**：
>
> - **节点语义**：route-state 节点的“可枚举状态”只由 `uiStates[].search` 的离散 key 决定（例如 `tab/modal/menu`）。
> - **动态 queryParams 的展示**：如果某 route 声明了 `queryParams`（动态无限集合），建图输出的 `nodeId` 可能会包含占位符（如 `q=:q`）用于提示该页 URL 可能携带该动态参数；它不属于离散状态，不会被枚举展开，也不应被当作 tab/modal 这类状态理解。
> - **参数三分法**：
>   - `uiStates.search`：离散、可枚举、影响 UI 模式（进入图节点）
>   - `queryParams`：动态、不可枚举（可在节点/边中作为占位提示）
>   - `searchParams`：用于 `.switch`/分支把“目标离散 key”映射到 `uiStates`（不表示无限集合）
>
> 当你在图里看到 `q=:q` 这种占位时，优先回到声明确认：该页是否真的应当拥有该动态 query（例如 Map 首页不该有 `q`，那应删掉 `routes[].queryParams.q`，而不是改分析器）。

### 3.5 导航 API

```typescript
const { go, back } = useAppNavigate();

// 路由跳转
go('video.open', { bvid: 'BV1xx411c7mD' });

// 状态变更（Tab/Modal）
go('modal.shelf.open');

// 出栈到指定页面（对应 Android popUpTo）
go('transfer.success.done', {}, { popTo: '/pay/transfer', popToInclusive: false });

// 历史回退
back();      // 返回 1 步
back(2);     // 返回 2 步
```

`go(id, params?, options?)` 的 `options` 支持：
- `mode?: 'push' | 'replace'`：覆盖声明中的 `mode`
- `popTo?: string`：先把 MemoryRouter 栈弹到指定路径（默认保留目标路径）。内部通过 `HistoryTracker` 影子栈（`os/utils/memoryHistoryTracker.ts`）搜索历史并调用 `navigator.go(-delta)` 回退，因 `react-router-dom@7` 的 MemoryHistory 不暴露 `entries`
- `popToInclusive?: boolean`：是否连目标路径也弹掉（等价 Android `popUpToInclusive`）
- `state?: unknown`：透传给 React Router 的 `navigate()` state，用于传递不适合放在 URL 中的运行时数据（如表单数据、滚动位置）。声明层不感知此字段

> [!WARNING]
> **业务页面禁止直接使用 `useNavigate()/navigate()`**。除 `navigation.ts`（实现 `go/back`）与少量系统桥接代码外，所有导航必须通过 `go()` / `back()` 触发。

### 3.6 条件跳转（cases）

当同一个动作在不同条件下跳转到不同目标时，使用 `cases`：

```typescript
{
  id: 'user.follow.toggle',
  from: '/user/:mid',
  to: '/user/:mid',
  search: {},
  searchParams: {},
  mode: 'push',
  params: {},
  label: '关注/取关',
  ui: { placement: 'content', icon: '', gesture: 'tap' },
  
  cases: [
    {
      to: '/user/:mid',
      search: { suggestions: 'true' },
      when: { op: 'eq', left: { ref: 'appState', key: 'isFollowing' }, right: false },
    },
    {
      to: '/user/:mid',
      search: { menu: 'unfollow' },
      when: { op: 'always' },  // 默认分支（必须是最后一个）
    },
  ],
}
```

**rules**：
- `cases` 可省略（无条件跳转时使用顶层 `to`/`search`）
- 非空 `cases` **必须**以 `{ when: { op: 'always' } }` 结尾

### 3.7 保留查询参数（preserveParams）

使用 `preserveParams` 在跳转时保留当前 URL 中的特定参数：

```typescript
{
  id: 'tab.users',
  from: { path: '/search', search: { tab: '*' } },
  to: '/search',
  search: { tab: 'users' },
  searchParams: {},
  preserveParams: ['q'],  // 保留当前的 q 参数
  mode: 'replace',
  params: {},
  label: '切换到用户',
  ui: { placement: 'content', icon: '', gesture: 'tap' },
}

// 当前: /search?tab=posts&q=关键词
// go('tab.users')
// 结果: /search?tab=users&q=关键词
```

### 3.8 Tab 合并切换（.switch 模式）

当页面内有多个 Tab 时，使用单个 `.switch` transition + `searchParams` 代替多个独立 transition：

```typescript
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

使用方式：

```tsx
const { bindTap } = useTriggerGestures();
const tabRef = bindTap('myReading.tab.switch', { params: { tab: tabKey } });
return <button {...tabRef}>切换到 {tabKey}</button>;
```

### 3.9 条件声明（v0.8）

条件用于描述节点/入口在什么数据条件下存在或显示：

| 条件位置 | 语义 | 示例场景 |
|---------|------|----------|
| `uiStates[].stateCondition` | 状态节点是否存在 | 动态 Tab、条件页面 |
| `ui.condition` | 跳转入口是否显示 | 条件按钮、权限控制 |

```typescript
// 示例：书架管理入口仅在书已加入书架时显示
{
  id: 'book.modal.shelf.open',
  from: '/book/:bookId',
  to: '/book/:bookId',
  search: { modal: 'shelf' },
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

v0.8 在 `StateCondition` 上新增：
- **组合条件**：`always / and / or / not`
- **参数对比**：`paramEq / paramNeq`（对比 boundParams 中的参数与 `ref` 指向的数据）

```ts
// 示例：用户资料页“朋友设置”入口仅对他人显示（id != user.wxid）
{
  ui: {
    condition: { op: 'paramNeq', param: 'id', ref: 'user.wxid', text: '仅对他人显示' },
    // 等价写法：condition: { op: 'not', item: { op: 'paramEq', param: 'id', ref: 'user.wxid' } },
  },
}
```

> 详细的 `StateCondition` 类型和数据源声明见 [DATA_SOURCE_PROPOSAL.md](../navigation/DATA_SOURCE_PROPOSAL.md)（注意：`paramEq/paramNeq` 依赖 data-mode 的 `boundParams`，通常来自 path params）。

### 3.10 数据源声明（dataSource，用于 data-mode 展开动态参数）

当 `to` 含路径参数（如 `/read/:bookId`）且希望在 **data 模式**下把“动态参数”展开成有限个具体节点/边时，在 `TransitionDeclaration` 上声明 `dataSource`：

```ts
{
  id: 'reader.open',
  from: ['/', '/bookshelf'],
  to: '/read/:bookId',
  search: {},
  searchParams: {},
  mode: 'push',
  params: { bookId: 'string' },
  label: '打开阅读器',
  ui: { placement: 'content', icon: 'reader_open', gesture: 'tap' },

  // 用数据集合展开 :bookId
  dataSource: [
    { from: '/', ref: 'recommendations', paramMapping: { bookId: 'id' }, labelField: 'title' },
    { from: '/bookshelf', ref: 'initialShelf', paramMapping: { bookId: 'bookId' } },
  ],
}
```

**rules**：
- `dataSource` 仅用于建图（data-mode）展开/可达性分析，**不影响运行时**
- `paramMapping` 仅允许映射 **path params**（不要试图用它展开无限集合的 queryParams）
- transition 存在多个 `from` 时，建议为每个来源显式配置 `dataSource.from`（避免“隐式继承”导致 data-mode 下边被跳过）

> [!NOTE]
> data-mode 只读取配置文件导出的 **ConfigData 快照**，不会读取运行时状态（localStorage/React state/用户操作后的内存数据）。一些“记忆型入口”（例如 Tab 记住上次子页面）不应该用 data 条件强行表达。

### 3.11 边可用性（availability，仅语义）

用于表达“边存在，但并非总可用”（例如依赖历史访问记忆的恢复入口）：

- `availability: 'always' | 'requires_prior_visit'`（默认 `always`）
- `availabilityNote?: string`（备注）

该字段会透传到建图输出的 `edges[]`（viewer 会用紫色虚线展示 `requires_prior_visit`），但**不参与运行时判断**。

---

## 四、原地动作（Actions）

### 4.1 Actions vs Transitions

| 概念 | 触发方式 | URL 变化 | DOM 标记 | 适用场景 |
|------|----------|----------|----------|----------|
| **Transition** | `go(id, params)` | ✅ 会改变 | `data-trigger` | 页面跳转、Tab 切换、Modal 打开 |
| **Action** | `onTrigger` 回调 | 通常 ❌；回退型提交可 `back()` | `data-action` | 开关切换、表单提交、点赞/收藏 |

> 说明：对于“完成/确定/发表”等回退型提交，常见实现是“先提交副作用，再 `back()` 关闭”，回到哪里取决于历史来源；此类入口建议建模为 `behavior:'submit'` 的 action，而不是写成固定 `to` 的 transition（避免图里出现误导的返回边）。纯回退（返回/取消/遮罩关闭）仍只用 `bindBack(system.back)`，不声明 transition/action。

> 补充：若入口 DOM 在共享组件中渲染（如 TopBar 右侧按钮/FAB），但 `transitionId/actionId` 由页面通过 context/store 配置，仍必须保证共享组件最终产出 `data-trigger-*`/`data-action-*`；并要求页面侧以 object literal 传递，且入口字段名**必须写死为 `id`**，用 `id: '<...>'` **字符串字面量**传递（禁止动态拼接/变量计算），以便静态工具可靠发现该入口。

> [!NOTE]
> **共享组件复用（推荐模板）**：共享组件负责“最终 bind 并产出 DOM 打标”，页面负责“配置语义 id + onTrigger”。页面侧配置必须是 object literal，且字段名必须叫 `id`：
>
> ```tsx
> // Page.tsx（页面侧配置；id 必须是字符串字面量）
> setHeaderRightAction({
>   id: 'compose.post.submit',
>   kind: 'action',
>   onTrigger: () => { submit(); back(); },
> });
>
> // TopBar.tsx（共享组件最终绑定并产出 data-action-*）
> const a = useHeaderRightAction();
> return a
>   ? <button {...bindTap({ kind: 'action', id: a.id }, { onTrigger: a.onTrigger })}>完成</button>
>   : null;
> ```
>
> 注意：**不要**在多个 `uiState.actions[]` 里重复声明同一个 actionId 来表达复用；推荐按页面域/场景语义拆分不同 id。

### 4.2 ActionDeclaration

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

### 4.3 Action 类型

```typescript
type ActionEffect =
  | { kind: 'localState.open'; id: string }
  | { kind: 'localState.close'; id: string };

interface ActionDeclaration {
  id: string;                    // app 内唯一标识
  label: string;                 // 人类可读标签
  description?: string;          // 详细说明
  behavior: 'toggle' | 'select' | 'submit' | 'input' | 'other';
  scope?: 'item';                // 作用于列表项时声明
  paramsSchema?: Record<string, 'string' | 'number' | 'boolean'>;
  condition?: StateCondition;    // 入口显示条件
  effects?: ActionEffect[];      // 可选：动作副作用（仅语义，不改变 URL）
}
```

> [!NOTE]
> 可选：在 `routes[].uiStates[].localStates` 中声明“不进入 URL / 不形成图节点”的本地子状态（如非阻塞面板、toast）。它可被 `ActionDeclaration.effects` 引用，用于文档/训练语义标注。

### 4.4 Action 打标

使用 `bindTap` 的 action 模式：

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

产出 DOM 属性：`data-action`、`data-action-type`、`data-action-params`

### 4.5 ActionId 命名规范

```
<domain>.<control>.<verb>

示例：
- settings.autoDownload.toggle       // 全局开关
- bookshelf.item.private.toggle      // 列表项开关（scope='item'）
- profile.gender.select.male         // 全局选择
- search.keyword.input               // 全局输入
- profile.edit.submit                // 全局提交
```

| behavior | verb 后缀 |
|----------|-----------|
| toggle | `.toggle` |
| select | `.select.<option>` |
| input | `.input` |
| submit | `.submit` |

> [!IMPORTANT]
> **ActionId 全局唯一（强约束）**：`actionId` 在**同一个 App 内必须全局唯一**，禁止在多个 `uiState.actions[]` 中重复声明同一个 `actionId`（即使它们看起来“是同一个按钮/同一个输入框语义”）。
>
> **推荐策略（按语义拆分）**：当“相似控件”在不同页面/不同 uiState 中出现时，优先按页面域/场景语义拆成不同 id（避免 duplicate 且更利于任务/回放理解），例如：
>
> - `/search/input` 的输入框：`searchInput.query.input`
> - `/search` 页的关键词输入框：`search.query.input`
> - `/compose` 页的正文输入框：`compose.content.input`
>
> 备注：共享组件（TopBar/FAB 等）可以复用“绑定点”，但页面侧配置的 `id: '...'` 仍需字面量且满足全局唯一；不要指望“在不同 uiState 重复声明同一个 id”来表达复用。

> 详细的 Actions 规范见 [ACTIONS_DECLARATION_PROPOSAL.md](../navigation/ACTIONS_DECLARATION_PROPOSAL.md)

---

## 五、手势交互规范

### 5.1 统一手势 Hook

使用系统层 `useTriggerGestures` 或 App 封装的手势 Hook：

```typescript
// 方式 1: 使用 App 封装的 Hook（推荐）
import { useAppGestures } from '../hooks/useAppGestures';

function MyComponent() {
  const { bindTap, bindLongPress, bindBack } = useAppGestures();
  
  return (
    <button {...bindTap('chat.open', { id: 'user_123' })}>
      打开聊天
    </button>
  );
}
```

### 5.2 手势类型

| 方法 | 手势类型 | 用途 |
|------|----------|------|
| `bindTap(id, params?)` | `tap` | 点击触发 |
| `bindLongPress(id, params?)` | `longPress` | 长按触发 |
| `bindDoubleTap(id, params?)` | `doubleTap` | 双击触发 |
| `bindBack()` | `back` | 返回操作 |

### 5.2.1 Pointer 事件统一（强制）

对于**拖拽、滑动、跟手拖动、按下后连续移动**等连续交互，运行时代码必须统一使用 `PointerEvent` 作为**唯一输入源**：

- 必须使用 `onPointerDown / onPointerMove / onPointerUp / onPointerCancel`
- 拖拽中一旦需要“指针离开元素后仍持续跟手”，必须配合 `setPointerCapture()` / `releasePointerCapture()`
- **禁止**同时维护 `touch*` 与 `mouse*` 两套并行逻辑
- **禁止**使用“`touchmove` 连续更新 + `click` 兜底鼠标”这类拼接方案；这会导致 DevTools 模拟触摸、真实触摸、真实鼠标三者行为不一致
- `bindTap / bindLongPress / bindDoubleTap / bindBack` 仍用于**声明式触发打标**；但它们不能替代拖拽类控件自身的 Pointer 事件实现

典型适用场景：

- 阅读器/播放器/设置页中的 slider、scrubber、拖动条
- Bottom Sheet、抽屉、可拖动浮层
- 需要根据移动距离判定翻页、开关、排序、拖拽重排的交互

> [!NOTE]
> `bindBack()` 是系统内建触发（`system.back`）的语法糖，用于 DOM 上绑定返回手势；它不属于业务 `transitionId`，因此不进入 `navigation.declaration.ts` 的 transitions 声明（可直接理解为触发 `back()`）。

### 5.3 DOM 属性

手势 Hook 会自动在 DOM 元素上添加：

**Trigger 模式**（导航跳转）：
- `data-trigger`: transition ID
- `data-trigger-type`: 手势类型
- `data-trigger-params`: 参数 JSON（可选）

**Action 模式**（原地动作）：
- `data-action`: action ID
- `data-action-type`: 手势类型
- `data-action-params`: 参数 JSON（可选）

```tsx
// Trigger 模式
<button {...bindTap('chat.open')}>打开</button>
// 生成: <button data-trigger="chat.open" data-trigger-type="tap">打开</button>

// Action 模式
<button {...bindTap({ kind: 'action', id: 'settings.toggle' }, { onTrigger: toggle })}>
  开关
</button>
// 生成: <button data-action="settings.toggle" data-action-type="tap">开关</button>
```

### 5.4 data-trigger-params（区分同一 transitionId 的不同参数）

当多个按钮使用同一个 `transitionId` 但参数不同时，使用 `data-trigger-params`：

```tsx
// 传入 params 时会自动添加 data-trigger-params
const tabRef = bindTap('myReading.tab.switch', { params: { tab: 'week' } });
// 产出：
// {
//   'data-trigger': 'myReading.tab.switch',
//   'data-trigger-type': 'tap',
//   'data-trigger-params': '{"tab":"week"}',
// }
```

| 场景 | 是否需要 data-trigger-params |
|------|------------------------------|
| Tab 切换（周/月/年）| ✅ 需要区分目标 tab |
| 列表项点击 | ✅ 需要区分目标 bookId |
| 固定按钮（返回）| ❌ 无参数 |

> [!IMPORTANT]
> **Tab 入口必须始终打标**：即使当前已处于 active tab，该 tab 按钮也应保持 `bindTap(...)`（产出 `data-trigger-*`）。  
> “点了但 URL/状态不变化”的 no-op/self-loop 边应由分析器过滤，而不是通过 UI 层“不给 active tab 打标 / 条件渲染”来规避（否则静态扫描/回放会缺入口语义）。

### 5.5 系统手势

| 手势 | 触发区域 | 效果 |
|------|----------|------|
| 侧滑返回 | 屏幕左/右边缘向内滑动 | 触发 `__OS__.handleBack()` |
| 底部上滑 | 屏幕底部向上滑动 | 回到桌面 |
| 底部上滑暂停 | 底部向上滑动后暂停 | 进入多任务视图 |

---

## 六、滚动状态观测

> [!NOTE]
> 滚动位置**不写入 URL**，仅通过 `window.__getScrollMeta__()` 按需读取供 Agent 采集。

### 6.1 声明滚动容器

在 `RouteDeclaration.scrollContainers` 中声明：

```typescript
scrollContainers: [
  { name: 'main', direction: 'vertical', description: '主内容区' },
  { name: 'related', direction: 'horizontal', description: '相关推荐' },
]
```

> [!IMPORTANT]
> **滚动容器命名建议（推荐与 Wechat 对齐）**：
>
> - **仅一个主滚动容器时**：统一使用 `name: 'main'`（DOM 也使用 `data-scroll-container="main"`）即可，声明里只写这一项。
> - **同一时刻存在多个“可见”的滚动容器时**（例如：横向 carousel + 纵向列表、左右分栏各自可滚动、弹层与底层同时可滚动）：必须使用**不同的 name**，并在声明的 `scrollContainers` 中完整列出。
>
> 说明：运行时 `window.__getScrollMeta__()` 返回的是 `Record<name, meta>`，key 来自 `data-scroll-container`；**同名会覆盖**。
> 因此可以像 Wechat 那样在 main tab/outlet 上都写 `main`，前提是通过 `display:none` 等方式保证**同一时刻只有一个可见的 main 滚动容器**（不可见容器会被过滤掉）。

### 6.2 滚动状态读取

Agent 按需调用 `window.__getScrollMeta__()` 读取滚动状态：

```javascript
const meta = window.__getScrollMeta__();
// {
//   main: { position: 800, max: 2400, viewport: 600, total: 3000 },
//   related: { position: 150, max: 800, viewport: 400, total: 1200 },
// }
```

---

## 七、App 开发规范

### 7.1 配置优先（Config-first）

每个 App 的初始配置必须导出统一命名的 `<APPNAME>_CONFIG`，并将**常量 / 默认数据 / 运行时状态**分离：

```typescript
// apps/Notes/data/index.ts
import defaults from './defaults.json';
import { NOTES_CONSTANTS } from '../constants';

export const NOTES_CONFIG = {
  ...NOTES_CONSTANTS, // 主题色/分页大小等常量
  ...defaults,        // sampleNotes 等默认数据（JSON，可替换）
};
```

### 7.2 使用系统时间服务

**禁止任何形式的 `new Date(...)` 和裸 `Date.now()`**（ESLint `no-restricted-syntax` 已全面拦截，含带参形式；须通过 TimeService 以保持 benchmark 时间一致性）：

```typescript
// ❌ 错误写法
const now = new Date();
const timestamp = Date.now();
const d = new Date(someTimestamp);          // ← 也禁止
const d2 = new Date(2026, 2, 9);           // ← 也禁止
const d3 = new Date(existingDate);          // ← 也禁止（克隆）
const d4 = new Date('2026-03-09T10:00:00'); // ← 也禁止

// ✅ 模拟时间（显示时钟、数据时间戳、benchmark 状态判定）
import * as TimeService from '@/os/TimeService';
const now = TimeService.getDate();          // 替代 new Date()
const timestamp = TimeService.now();        // 替代 Date.now()

// ✅ 时间戳转 Date
const d = TimeService.fromTimestamp(someTimestamp);           // 替代 new Date(ts)

// ✅ 从年月日构造 Date（month 为 0-based）
const d2 = TimeService.fromLocalParts(2026, 2, 9);           // 替代 new Date(2026, 2, 9)

// ✅ 克隆 Date
const d3 = TimeService.fromTimestamp(existingDate.getTime()); // 替代 new Date(existingDate)

// ✅ 解析日期字符串
const d4 = TimeService.fromTimestamp(TimeService.parseToTimestamp('2026-03-09T10:00:00'));

// ✅ 真实挂钟时间（防抖、动画、手势检测、缓存 TTL）
const start = TimeService.realNow();

// ✅ React Hook 方式（推荐）
import { useSystemTime } from '@/os/useSystemTime';

function MyComponent() {
  const { now, getDate, formatTime } = useSystemTime();
  const timestamp = now();
  const displayTime = formatTime(); // "21:30"
}
```

### 7.2.1 使用系统定位服务

**禁止直接使用 `navigator.geolocation`**：

```typescript
// ❌ 错误写法
navigator.geolocation.getCurrentPosition(
  (position) => { /* ... */ },
  (error) => { /* ... */ }
);

// ✅ 正确写法 - 使用 LocationService
import * as LocationService from '../../../os/LocationService';

LocationService.getCurrentPosition(
  (position) => {
    const { latitude, longitude } = position.coords;
    // ...
  },
  (error) => {
    console.warn('定位失败:', error.message);
  },
  { timeout: 10000, enableHighAccuracy: true }
);
```

**系统配置**（`os/data/defaults.json` + `os/simulatorConfig.ts`）：

```typescript
// 模拟模式（默认）- 不触发浏览器权限弹窗
locationMode: 'simulated',
simulatedLocation: 'beijing',  // 或 'shanghai', 'tokyo' 等预设城市

// 真实模式 - 使用浏览器原生 geolocation API
locationMode: 'real',
```

**Agent API**：

```javascript
// 切换到上海
__SIM_LOCATION__.setSimulatedLocation('shanghai')

// 使用自定义坐标
__SIM_LOCATION__.setSimulatedLocation({ latitude: 30.0, longitude: 120.0 })

// 模拟权限被拒绝
__SIM_LOCATION__.simulateError(1)

// 清除模拟错误
__SIM_LOCATION__.clearError()

// 切换到真实定位
__SIM_LOCATION__.setRealLocation()

// 查看当前配置
__SIM_LOCATION__.getConfig()

// 查看可用预设城市
__SIM_LOCATION__.presets
// => { beijing, shanghai, guangzhou, shenzhen, hangzhou, tokyo, newyork, ... }
```

### 7.2.2 使用系统反地理编码服务（详细地址）

天气、地图等 App 常需要把经纬度转换为“区/街道/道路/门牌号”等 **详细地址**。**禁止在业务 App 内直接拼第三方反地理编码 URL**，请统一使用系统服务：

```typescript
import { reverseGeocode } from '../../../os/LocationService';

const addr = await reverseGeocode(latitude, longitude, { radius: 1000, extensions: 'base' });
console.log(addr.formattedAddress); // 例如 “北京市怀柔区……”
```

说明：

- 反地理编码服务内部通过 `NetworkService` 走系统网关，规避浏览器 CORS。
- 服务自带缓存（内存 + localStorage，默认 10 分钟 TTL），避免频繁请求第三方。

### 7.2.3 使用系统网络服务（统一规避 CORS + 兼容 cookie）

本项目运行在浏览器中，直接请求第三方域名很容易遭遇 **CORS**。所有 App 的对外 HTTP(S) 请求，建议统一使用系统网络服务：

```typescript
import { netJson, netFetch } from '../../../os/NetworkService';

// JSON API
const data = await netJson('https://example.com/api/foo', {
  headers: { 'x-foo': 'bar' },
});

// 上传/大响应（FormData/Blob/流会自动走网关的 streaming proxy）
const resp = await netFetch('https://example.com/upload', {
  method: 'POST',
  body: new FormData(),
});
```

说明：

- `NetworkService` 会把跨域请求自动转发到同源网关，从根上规避 CORS。
- 网关实现了 **会话级 cookie jar**（按 `x-gw-session` 隔离），更接近真实手机原生网络栈的 cookie 行为。
- 更详细的用法与规范见：`docs/NETWORK_SERVICE.md`

### 7.3 状态管理 + 全局注册

使用 React Context 管理状态，并注册到 `AppStateRegistry`：

```typescript
// apps/Notes/context/NotesContext.tsx
import { registerAppState, unregisterAppState } from '../../../os/AppStateRegistry';

useEffect(() => {
  registerAppState('notes', () => ({ notes }));
  return () => unregisterAppState('notes');
}, [notes]);
```

### 7.4 导航处理器

使用 `useAppNavigationHandler` hook 统一注册导航、返回、路由观测和生命周期事件：

```typescript
import { useAppNavigationHandler } from '@/os/hooks/useAppNavigationHandler';

// 在 <MemoryRouter> 内调用
useAppNavigationHandler('my_app', {
  onBack: (): boolean => {
    // App 内返回逻辑：能处理返回 true，否则返回 false 交给系统
    const index = (navigator as any).index || 0;
    if (index > 0) {
      navigate(-1);
      return true;
    }
    return false;
  },
  onNavigate: (path, navigateTo) => {
    // 可选：拦截外部导航指令（来自 __OS__.openApp(appId, path)）
    // navigateTo 已由 OS 设置 push/replace 模式（新 Task 用 replace，已有 Task 用 push）
    // 推荐对"非法地址"直接拒绝而非静默 normalize
    navigateTo(path);
  },
  onForeground: () => { /* App 切到前台 */ },
  onBackground: () => { /* App 切到后台 */ },
});
```

该 hook 内部自动完成：
- **路由观测**：通过 `AppNavigatorRegistry` 实时注册 `{ app, path }` 路由信息，可通过 `window.__OS__.getAppRoute()` 读取
- **返回处理**：通过 `BackDispatcher` 注册返回 handler（优先级 100），系统返回手势会按优先级分发
- **外部导航**：通过 `AppNavigatorRegistry` 注册 navigate 方法，`__OS__.openApp(appId, initialRoute)` 可直达某页。OS 根据 Task 是否已存在自动选择 push（保留 back 历史）或 replace（替换初始路由），App 不需要自行判断
- **生命周期**：通过 `AppLifecycle` 接收 foreground/background/destroy 事件
- **就绪通知**：内部调用 `useAppReady(appId)` 通知系统 App 已准备好
- **历史栈同步**：通过 `syncTracker(navigator, location)` 在每次 location 变化时同步 `HistoryTracker` 影子栈，使 `go()` 的 `popTo` 选项能正确搜索历史并回退

> [!IMPORTANT]
> **不要静默 normalize 非法地址**：如果某 routePath 必须带离散 query 才合法（如首页必须 `?tab=...`），`onNavigate` 应 **拒绝/报错并 no-op**，让调用方显式传入合法 URL（避免在图/任务/调试中制造"裸路径可达"的错觉）。

### 7.5 数据配置与状态管理规范

#### 7.5.1 配置文件命名

每个 App 的初始数据必须由 `apps/<App>/data/index.ts` 导出，并保持统一命名的配置对象：

```typescript
// ✅ 正确：使用 <APPNAME>_CONFIG 命名
export const BILIBILI_CONFIG = { ... };
export const WECHAT_CONFIG = { ... };
export const X_CONFIG = { ... };

// ❌ 错误：其他命名方式
export const APP_INITIAL_DATA = { ... };     // 不符合规范
export const xData = { ... };                  // 不符合规范
```

**数据入口结构**：

`apps/<App>/data/index.ts` 是唯一 TS 入口，负责合并常量与默认数据，并导出 `<APPNAME>_CONFIG`（对外接口保持不变）：

```typescript
// apps/Bilibili/data/index.ts
import defaults from './defaults.json';
import { BILIBILI_CONSTANTS } from '../constants';

export const BILIBILI_CONFIG = {
  ...BILIBILI_CONSTANTS, // 主题色/Tab/i18n 等常量
  ...defaults,           // user 等默认数据（JSON，可替换）
};
```

**目录结构示例**：

```
apps/Bilibili/
├── constants.ts
└── data/
    ├── index.ts        # 唯一 TS 入口：合并常量 + JSON
    ├── defaults.json   # 小默认数据（可替换）
    ├── loader.ts       # 大文件异步 loader（fetch + 缓存）
    └── videos.json     # 大文件（保持在 data/ 下）
```

系统应用示例：

```text
system/Settings/
├── SettingsApp.tsx
├── manifest.ts
└── data/
    ├── index.ts
    └── defaults.json
```

#### 7.5.2 localStorage 键名规范

**强制要求**：`localStorage` 的键名必须与 manifest 中的 `appId` 完全一致。App 清单由 `PackageManagerService` 通过 `import.meta.glob(['../apps/*/manifest.ts', '../system/*/manifest.ts'])` 自动发现。

```typescript
// manifest.id 即 appId；无需手写注册表
export const manifest = {
  id: 'wechat',
  displayName: '微信',
  // ...
};
```

```typescript
// ✅ 正确：localStorage 键名与 appId 一致
localStorage.getItem('wechat');
localStorage.setItem('bilibili', JSON.stringify(state));
localStorage.getItem('tencent_meeting');

// ❌ 错误：使用其他键名
localStorage.getItem('sim_wechat_v4');      // 带前缀/版本号
localStorage.getItem('wechat_replica_data'); // 非标准命名
localStorage.getItem('bili_search_history'); // 单列子状态
```

**禁止**为单个 App 的不同状态片段使用多个 localStorage 键。所有状态应合并存储在同一个键下。

#### 7.5.3 AppStateRegistry 读取规范

`os/AppStateRegistry.ts` 的 `persistentReaders` 必须遵循以下模式：

```typescript
// os/AppStateRegistry.ts
import { WECHAT_CONFIG } from '../apps/Wechat/data';

const persistentReaders: Record<string, () => any> = {
  wechat: () => {
    const raw = localStorage.getItem('wechat');  // 键名 = appId
    let data: any = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch (e) { data = null; }
    }
    // 每个字段都从 localStorage 读取，fallback 到 CONFIG 默认值
    return {
      user: data?.user ?? WECHAT_CONFIG.user,
      contacts: data?.contacts ?? WECHAT_CONFIG.contacts,
      chats: data?.chats ?? WECHAT_CONFIG.chats,
      moments: data?.moments ?? WECHAT_CONFIG.moments,
      // ...其他字段
    };
  },
};
```

**读取逻辑要点**：

1. **键名一致**：`localStorage.getItem('<appId>')`
2. **try-catch 保护**：`JSON.parse` 必须包裹在 try-catch 中
3. **字段级 fallback**：每个字段独立 fallback 到 `*_CONFIG` 的默认值（即使 localStorage 中只有部分字段，缺失的字段仍能恢复默认值）
4. **不硬编码默认值**：所有默认值必须来自 `*_CONFIG`，不得在 reader 中硬编码
5. **不导出 persistentReaders**：外部通过 `getAllAppStates()` 统一访问

#### 7.5.4 系统服务数据

以下数据属于**系统级服务**，不应作为 App 的可配置状态：

| 数据类型 | 系统服务 | 获取方式 |
|---------|---------|---------|
| 当前位置 | `LocationService` | `LocationService.getCurrentPosition()` |
| 当前时间 | `TimeService` | `TimeService.now()` / `TimeService.getDate()` / `TimeService.realNow()` |

```typescript
// ❌ 错误：在 App Config 中配置位置
export const MAP_CONFIG = {
  currentLocation: { latitude: 39.9, longitude: 116.4 },  // 不合理
};

// ✅ 正确：App 从系统服务获取位置
import * as LocationService from '../../../os/LocationService';
LocationService.getCurrentPosition((pos) => {
  setLocation(pos.coords);
});
```

#### 7.5.5 Context 状态注册

App Context 必须在 mount 时注册状态，unmount 时注销：

```typescript
// apps/Wechat/context/WechatContext.tsx
import { registerAppState, unregisterAppState } from '../../../os/AppStateRegistry';

useEffect(() => {
  registerAppState('wechat', () => ({
    user: state.user,
    contacts: state.contacts,
    chats: state.chats,
    moments: state.moments,
    // 暴露状态供 bench_env 任务判定与轨迹合成使用
  }));
  return () => unregisterAppState('wechat');
}, [state]);
```

同时，Context 需要在状态变更时持久化到 localStorage：

```typescript
useEffect(() => {
  localStorage.setItem('bilibili', JSON.stringify({
    user: state.user,
    videos: state.videos,
    followedUsers: state.followedUsers,
  }));
}, [state]);
```

---

## 八、UI 与布局规范

### 8.1 状态栏规范

> [!CAUTION]
> **这是最常见的错误！** 每个页面的顶部必须预留状态栏空间。

系统状态栏由 `SystemShell.tsx` 统一渲染，App 需预留约 40px（`pt-10`）：

```typescript
// ✅ 正确写法
<div className="pt-10 ...">
  <h1>页面标题</h1>
</div>

// ❌ 错误写法
<div className="pt-2 ...">
  <h1>页面标题</h1>  {/* 会被状态栏遮挡 */}
</div>
```

#### 8.1.1 状态栏文字颜色（沉浸式）

状态栏是**沉浸式**的（透明背景，悬浮在内容上方）。状态栏前景**不再通过 DOM 自动采样背景色**；页面应优先使用**声明式属性**直接声明前景色。未声明时，系统只回退到 App manifest 的 `theme.colors.statusBarForeground`，若仍未指定则默认使用深色前景：

```tsx
// ✅ 推荐：声明式（高性能）
<div 
  data-status-bar-foreground="light"   // light = 浅色前景（白色文字/图标）
  className="bg-black pt-10 ..."
>
  ...
</div>

<div 
  data-status-bar-foreground="dark"  // dark = 深色前景（黑色文字/图标）
  className="bg-white pt-10 ..."
>
  ...
</div>

// 未声明时：回退到 manifest；若 manifest 也未指定，则默认深色前景
<div className="bg-gray-100 pt-10 ...">
  ...
</div>
```

| 属性值 | 含义 | 状态栏文字 |
|--------|------|-----------|
| `light` | 状态栏使用浅色前景（白色） | 白色 |
| `dark` | 状态栏使用深色前景（黑色） | 黑色 |
| 不设置 | 回退到 manifest；若仍未指定则默认深色前景 | 默认黑色（或 manifest 指定值） |

> [!NOTE]
> 声明式属性应添加在**页面最外层容器**上。桌面和多任务视图已内置为浅色前景，无需额外声明。需要浅色前景的页面不要依赖系统自动取色。

#### 8.1.2 手势条 / 导航栏前景

底部手势条（GestureBar）与顶部状态栏是**两套独立信号**。当页面顶部和底部区域颜色不一致时，应优先单独声明底部前景：

```tsx
<div
  data-status-bar-foreground="light"
  data-navigation-bar-foreground="dark"
  className="min-h-full"
>
  ...
</div>
```

| 属性值 | 含义 | 手势条颜色 |
|--------|------|-----------|
| `light` | 导航栏使用浅色前景 | 白色 |
| `dark` | 导航栏使用深色前景 | 黑色 |

手势区域是透明的，直接显示 App 页面背景（Activity container 全屏 `inset: 0`）。GestureBar 优先消费 `data-navigation-bar-foreground` 控制指示条颜色；若缺失，则先回退到 manifest 中的 `navigationBarForeground`，再回退到 `data-status-bar-foreground`，最后回退到 manifest 中的 `statusBarForeground`。它不做 DOM 自动取色，也不渲染背景。

### 8.2 混合路由模式

采用 **"主 Tab 常驻 + 子页互斥"** 的混合渲染模式：

```tsx
const Layout = () => {
  const { pathname } = useLocation();
  const isMainTab = ['/', '/contacts', '/me'].includes(pathname);

  return (
    <div className="flex h-full flex-col">
       {/* 主 Tab 常驻，保留滚动状态 */}
       <div style={{ display: pathname === '/' ? 'block' : 'none' }}><Home /></div>
       <div style={{ display: pathname === '/contacts' ? 'block' : 'none' }}><Contacts /></div>

       {/* 子页面互斥，离开即销毁 */}
       {!isMainTab && <Outlet />}
       
       {isMainTab && <TabBar />}
    </div>
  );
};
```

### 8.3 多页面文件结构

当 App 包含多个页面时，必须将页面拆分为独立文件：

```
apps/<AppName>/
├── <AppName>App.tsx           # 主入口
├── navigation.declaration.ts  # 导航声明
├── navigation.ts              # 导航 Hook
├── pages/
│   ├── HomePage.tsx
│   ├── DetailPage.tsx
│   └── SettingsPage.tsx
├── components/
│   └── Header.tsx
├── constants.ts
└── data/
    ├── index.ts
    └── defaults.json
```

### 8.4 键盘与输入法（Keyboard/IME）规范

> [!IMPORTANT]
> **键盘弹出/收起由“输入框焦点”驱动**。业务页面一般不需要也不应该直接调用 `KeyboardService.show()/hide()`。

#### 8.4.1 弹出/收起规则（开发者应依赖）

- **输入框获得焦点（用户点击或代码 `.focus()`）**：键盘自动弹出
- **输入框失焦**：键盘自动收起（OS 侧有 100ms 容错，用于焦点在输入框间切换）
- **点击输入框但未触发 `focusin` 的边缘场景**：系统会在 `click(capture)` 中兜底弹出（避免“已聚焦但键盘没显示”的状态）

> [!NOTE]
> 不同 App（如微信/小红书）“返回后键盘是否还在”的差异，本质上取决于页面是否 **保持输入框焦点**。规范上不在 OS 里做“自动回焦”，由 App 自己控制 `focus()/blur()`。

#### 8.4.2 键盘高度与 adjustResize 容器缩放

键盘高度为**固定值**，由系统配置 `os/simulatorConfig.ts` 中的 `SIMULATOR_CONFIG.framework.keyboardHeight`（如 320px）决定，与聊天加号面板等底部扩展区域共用同一高度，便于「键盘 ↔ 加号面板」切换时输入栏不跳动。

系统将该高度写入 `KeyboardServiceState.height`，并提供 Hook：

- `import { useKeyboard } from '../../../os/keyboard'`
- `useKeyboard()` 返回 `{ visible, mode, height }`（隐藏时 `height=0`）

**OS 级 adjustResize 机制**（模拟 Android `windowSoftInputMode="adjustResize"`）：

`SystemShell.tsx` 在每个 Activity 容器外包裹了一层 `data-adjust-resize` div，当键盘可见时自动缩小该 div 的高度（`height: calc(100% - ${kbHeight}px)`）。这意味着：

- App 的 `flex-1 overflow-y-auto` 容器会**自动跟随缩小**，无需 App 手动计算
- **表单页**无需额外处理，输入框的自动滚动（见 8.4.3）基于缩小后的可见区域计算

**聊天页布局模式**（WeChat/RedBook 私信等）：

> ⚠️ **禁止使用 `position: fixed + bottom: keyboardHeight`**。此模式在设置了 `designViewportWidth`（触发 CSS `zoom`）的 App 中会导致键盘遮挡输入框——`zoom` 缩放 CSS 像素值但键盘高度以物理像素定位，造成 `bottom` 偏移不足（约 40px 缺口）。此 bug 曾影响 RedBook ChatPage、WeChat ChatDetail、TencentMeeting JoinMeetingPage。

聊天页应使用 **flex 布局**，完全依赖 adjustResize 自动处理键盘偏移：

- **外层容器**：`flex flex-col h-full`
- **消息列表**：`flex-1 overflow-y-auto`（自动占满剩余空间，无需手动 `paddingBottom`）
- **底部输入栏**：`flex-shrink-0` + `data-keep-keyboard="true"`（作为 flex 子项，adjustResize 缩小容器时自动上移）
- **加号面板**（非键盘）：同样使用 `flex-shrink-0`，设置固定 `height: bottomPanelHeight`
- **键盘弹出滚到底部**：通过 `KeyboardService.subscribe()` 监听键盘可见性变化，而非 `useKeyboard()` hook（避免不必要的 React 重渲染）

```tsx
// ✅ 正确：flex 布局
<div className="flex flex-col h-full">
  <div className="flex-1 overflow-y-auto">...</div>
  <div className="flex-shrink-0" data-keep-keyboard="true">输入栏</div>
</div>

// ❌ 错误：fixed 定位（zoom 下会偏移）
<div className="fixed bottom-0" style={{ bottom: keyboardHeight }}>输入栏</div>
```

> 参考实现：`apps/Wechat/pages/chat/ChatDetail.tsx`、`apps/RedBook/pages/ChatPage.tsx`、`apps/X/pages/ChatPage.tsx`

#### 8.4.3 键盘弹出时的智能滚动（表单页必读）

当键盘弹出时，系统会自动检测输入框是否会被键盘遮挡，模拟 Android `ScrollView.requestChildRectangleOnScreen()` 的行为：

- **会被遮挡**：最小滚动量，使输入框刚好在可见区域底部露出（10px 间距）
- **不会遮挡**：不做任何滚动

**可见区域的计算**依赖 adjustResize 机制（见 8.4.2）：
- 优先取 `data-adjust-resize` wrapper 的 `getBoundingClientRect().bottom`（准确反映键盘弹出后缩小的容器底边）
- 回退到 `window.innerHeight - keyboardHeight`

智能滚动在键盘弹出后**延迟两帧**（`requestAnimationFrame` × 2）执行，确保 adjustResize wrapper 完成布局更新。

**两种键盘处理模式对比：**

| 模式 | 适用场景 | 系统行为 | 开发者需要做的 |
|------|---------|---------|--------------|
| 滚动模式 | 表单、设置页 | adjustResize 缩小容器 + 最小滚动让输入框可见 | 无需任何代码 |
| 布局模式 | 聊天、搜索栏 | adjustResize 缩小容器 + 跳过自动滚动 | 使用 `flex-shrink-0` 布局 + `data-keep-keyboard`（见 8.4.2 聊天页布局模式） |

**滚动模式（默认）** - 无需任何配置：

```tsx
// 系统自动处理，开发者无需关心
<input type="text" placeholder="用户名" />
<input type="password" placeholder="密码" />
```

**布局模式** - 需要 flex 布局控制的场景（如聊天），参见 8.4.2。

**显式禁用滚动**（特殊场景）：

```tsx
// 如果不想使用任何自动滚动，可以添加 data-keyboard-scroll="none"
<div data-keyboard-scroll="none">
  <input />
</div>
```

> [!NOTE]
> `data-keep-keyboard` 同时具有两个作用：
> 1. 点击该区域时不收起键盘（见 8.4.4）
> 2. 跳过自动滚动（使用布局模式的元素不需要滚动）

#### 8.4.4 防止"点击外部收起键盘"的误判（键盘附件区）

OS 键盘 overlay 有全局 `pointerdown(capture)` 用于"点击键盘外部收起键盘"。  
当 App 需要把某块 UI 视作"键盘附件区"（例如聊天输入栏、发送按钮、表情按钮）并且 **点击时不应收起键盘**，请在对应 DOM 上添加：

- `data-keep-keyboard="true"`

系统会跳过该区域的点击，避免键盘误收起导致 click 丢失/布局跳动。

**页面整体保持键盘**（如加入会议页）：

```tsx
// 点击页面任何地方都不会关闭键盘，用户需主动关闭
<div className="..." data-keep-keyboard>
  <input placeholder="会议号" />
  <input placeholder="姓名" />
</div>
```

**系统自动处理路由切换**：

当页面切换时（聚焦的输入框从 DOM 中移除），系统会自动关闭键盘，无需开发者处理。这是通过 `MutationObserver` 监听 DOM 变化实现的，与 iOS/Android 原生行为一致。

> [!NOTE]
> `data-keep-keyboard` 只阻止**同一页面内**的点击关闭键盘。路由切换时，系统会检测到输入框被移除并自动关闭键盘。

#### 8.4.5 发送按钮保持键盘（WeChat/RedBook 行为）

为了实现“点发送 → 发送成功且键盘不收起”，建议遵循以下模式：

- 发送按钮 `onMouseDown/onPointerDown`：`e.preventDefault()`（防止按钮抢焦点导致输入框 blur）
- 真正发送放到 `onClick`，发送后 `inputRef.focus()`（双保险）
- 仅“发送按钮”需要 `data-keep-keyboard="true"`；例如小红书：输入为空时右侧是“加号/更多”，点击可按默认逻辑收起键盘；输入有内容时右侧变为“发送”，点击才 keep keyboard。

#### 8.4.6 中文拼音 IME（维护规范）

IME 位于 `os/keyboard/`：

- `pinyinIme.ts`：拼音分词/候选生成（支持：完整拼音、简拼、半截音节联想、分词符 `'` 强制断词）
- `pinyinData.ts`：内置小词库（**自动生成，禁止手改**）
- `public/ime/pinyin_dict.json`：大词库（异步加载）
- `scripts/ime/build_pinyin_dict.mjs`：从 `all_dicts/`（Rime `.dict.yaml`）生成 `pinyinData.ts` 和 `pinyin_dict.json`

维护规则：
- 词库更新请改 `all_dicts/` 或脚本逻辑，然后运行 `node scripts/ime/build_pinyin_dict.mjs`
- 不要手写/手改巨型映射（会引入重复 key、体积膨胀、难以审查）

#### 8.4.7 调试注意（DevTools 触摸模拟）

Chrome DevTools 的“模拟触摸设备”可能产生 **touch → 合成 mouse/click** 的“幽灵事件”，导致新出现的键盘被误触（如空格出现按压态）。  
因此：

- DevTools 模拟触摸只可用于粗看布局/大致手感，**不能**作为连续交互的验收依据
- 关键交互必须以“真实鼠标 + 真实触摸 / 非模拟触摸”共同验证
- 连续交互的实现应默认采用 `PointerEvent`，避免依赖浏览器合成的 mouse/click 行为

---

## 九、App 生命周期

### 9.1 核心机制：懒加载 + CSS 隐藏

`os/data/appRegistry.tsx` 使用 **React.lazy** 懒加载所有 App 组件，组件文件通过 `import.meta.glob(['../../apps/*/*App.tsx', '../../system/*/*App.tsx'])` 自动发现。只有在首次打开某个 App 时才会加载其代码和数据。这大幅提升了首屏加载速度（避免一次性加载所有 App 的大型数据文件）。

对于已打开的 App，使用 CSS `display: none/block` 控制可见性，而非卸载组件：

```tsx
const appModules = import.meta.glob([
  '../../apps/*/*App.tsx',
  '../../system/*/*App.tsx',
]);
```

> [!NOTE]
> 首次打开 App 时会有短暂的 loading 状态（chunk 加载），由 `os/components/AppLaunchSplash.tsx` 渲染——
> 复刻 Android 12 SplashScreen API：以 `manifest.theme.colors.background` 铺底、居中渲染
> `<AppIcon>`，并做 ~220ms 的 scale-in。冷启动 (~50–300ms) 看到色块闪现；热启动 chunk 已缓存
> 直接跳过 fallback，无任何停留。
>
> **扩展点**：manifest 可选 `splash?: AppSplashConfig` 字段切换开屏形态：
> - 不设 = 系统级默认（上述行为，覆盖所有系统 App）
> - `{ kind: 'branded', tagline?, minDurationMs? }` = 系统 splash + 图标下方加 tagline，
>   `minDurationMs` 强制最短停留（不管 chunk 多快），匹配商业 App 的"图标 + 标语"开屏页
> - `{ kind: 'custom', render }` = 完全自定义渲染（开屏广告 / 特殊动画 / 视频帧的逃生口）
>
> 默认无 `minDurationMs` → 加载多久就显示多久，bench_env 不会被拖慢。

### 9.2 生命周期对照表

| 用户操作 | `runningApps` | 组件状态 | React 状态 | localStorage |
|---------|---------------|---------|-----------|--------------|
| 回到桌面 → 再进入 | 保留 | 保持挂载（隐藏） | ✅ 保留 | 不变 |
| 从多任务滑掉关闭 | 移除 | 卸载 | ❌ 丢失 | 不变 |
| 页面刷新 | 清空 | 重新创建 | ❌ 丢失 | 从 localStorage 恢复 |

### 9.3 持久化策略

| 状态类型 | 是否需要 localStorage | 说明 |
|---------|---------------------|------|
| MemoryRouter 路由 | ❌ 不需要 | 组件保持挂载，路由自然保留 |
| useState 状态 | ❌ 不需要 | 组件保持挂载，状态自然保留 |
| `activeTab` 等导航状态 | ❌ 不需要 | 组件保持挂载时保留，卸载时自然重置 |
| 用户数据、设置信息 | ✅ 需要 | 页面刷新后需恢复 |

---

## 十、Agent API 参考

### 10.1 `window.__SIM__`

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getState()` | `{ os: {...}, apps: {...} }` | 获取完整系统状态 |
| `setState(patch, options?)` | `void` | 合并写入 App 状态（见下方详细说明） |
| `reset(seed?)` | `void` | 重置环境（清空 localStorage + 刷新） |

#### `setState` 详细说明

```javascript
// 基本用法：合并写入 apps 状态
__SIM__.setState({
  apps: {
    wechat: { user: { name: "新用户名" } },
    notes: { notes: [...] }
  }
});

// 带选项
__SIM__.setState(
  { apps: { wechat: { ... } } },
  { 
    deep: true,    // 深度合并（默认 true）
    reload: true   // 写入后刷新页面（默认 false）
  }
);
```

**合并规则**：
- 键不存在 → 新增
- 键已存在 → 替换（`deep: true` 时递归合并嵌套对象）
- 未涉及的键 → 保持不变

> **注意**：写入后 localStorage 立即更新，但已挂载的 React 组件不会自动刷新。如需立即生效，设置 `reload: true` 或手动刷新页面。

### 10.2 `window.__OS__`

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `handleBack()` | `void` | 触发返回（App 内返回或回桌面） |
| `goHome()` | `void` | 强制回到桌面 |
| `showRecents()` | `void` | 显示多任务视图 |
| `closeApp(appId)` | `void` | 关闭指定 App |
| `launchApp(appId)` | `void` | 启动指定 App |
| `openApp(appId, initialRoute?)` | `void` | 启动 App 并导航到指定路由 |
| `getState()` | `OSState` | 获取 OS 状态 |

#### `openApp` 详细说明

```javascript
// 仅启动 App
__OS__.openApp('wechat');

// 启动并导航到指定路由
__OS__.openApp('wechat', '/chat/user_123');
```

**实现机制**：
- 使用事件驱动 + 轮询兜底，确保可靠导航
- App 需调用 `useAppReady(appId)` 通知系统就绪
- 最大等待 5 秒，超时会输出警告日志
- **导航模式**：新建 Task 时用 replace（替换初始 `/` 路由），已有 Task 时用 push（保留 back 历史），与 Android 行为一致
- **Task 跟踪**：新建 Task 时记录 `launchedByTaskId`（发起方 Task），并标记 `wasExternallyRouted`。Back 到底时：有 `launchedByTaskId` 则返回发起方；有 `wasExternallyRouted` 则销毁 Task 而非保活

#### __OS__.notifications（通知服务）

App 通过 `NotificationService`（暴露为 `__OS__.notifications`）推送通知，并与桌面角标、通知中心联动（对齐 Android NotificationManager）：

| 方法 | 说明 |
|------|------|
| `push(input)` | 推送一条通知。`input` 需含 `title`；可选 `appId`、`body`、`route`、`importance`、`autoCancel`（默认 `true`）等。带 `route` 时，用户点击通知会执行 `openApp(appId, route)`。 |
| `dismiss(id)` | 按通知 `id` 移除一条通知。 |
| `dismissByRoute(appId, route)` | 按 `appId` + `route` 精确移除匹配的通知（如某会话已读时移除该条通知），与桌面角标同步。 |
| `clearForApp(appId)` | 移除该 App 的全部通知（如「全部标为已读」时使用）。 |
| `markRead(id, read?)` | 标记一条通知已读（仅影响角标计数，不移除条目；若需移除请用 `dismiss`）。 |
| `getState()` / `subscribe()` | 读取/订阅通知列表与未读数。 |

**行为约定**：

- **autoCancel**（默认 `true`）：用户点击悬浮通知或通知中心条目时，系统会**移除**该条通知（等价 Android `setAutoCancel(true)`）；设为 `false` 时仅标记已读，通知仍保留在列表中。
- **与 App 内已读联动**：当用户在 App 内标记某内容已读（如打开某会话）时，应调用 `dismissByRoute(appId, route)`，其中 `route` 与推送时一致（如 `/conversation/${conversationId}`），这样桌面角标与通知中心会与 App 内状态一致。

### 10.3 `window.__getScrollMeta__()` / `window.__SIM_QUERY__.getScrollMeta()`

```javascript
// 读取当前滚动状态（两种方式等价）
const meta = window.__getScrollMeta__();
const meta = window.__SIM_QUERY__.getScrollMeta();
// {
//   main: { position: 800, max: 2400, viewport: 600, total: 3000 },
//   related: { position: 150, max: 800, viewport: 400, total: 1200 }
// }
```

> `__SIM_QUERY__.getScrollMeta` 是 `__getScrollMeta__` 的别名，提供统一的命名风格。

### 10.4 `window.__OS__.getAppRoute()`

```javascript
// 读取当前 App 路由
window.__OS__.getAppRoute()
// { app: 'wechat', path: '/chat/user_123?modal=share' }
```

### 10.5 状态结构示例

```javascript
__SIM__.getState()
// 返回：
{
  os: {
    activeAppId: "wechat",
    runningApps: ["wechat", "notes"],
    isLauncherVisible: false,
    isRecentsVisible: false,
  },
  apps: {
    notes: {
      notes: [
        { id: "note_1", title: "...", content: "...", updatedAt: 1703412000000 }
      ]
    },
    wechat: {
      user: { wxid: "...", name: "..." },
      contacts: [...],
      chats: [...],
    }
  }
}
```

---

## 十一、开发工具

### 11.1 导航声明分析器

生成 UI 状态转移图：

```bash
# schema 模式（不带数据；会额外写出 *_simplified.json）
node scripts/navigation_declaration_analyzer.mjs <AppName> -o public/<app>_nav_graph.json --format pretty

# data 模式（展开 dataSource + 评估 condition；输出 reachability）
node scripts/navigation_declaration_analyzer.mjs <AppName> --data data/index.ts -o public/<app>_data_graph.json --format pretty

# 可选：指定 data 导出名（默认自动识别 *_CONFIG）
node scripts/navigation_declaration_analyzer.mjs <AppName> --data data/index.ts --data-export WECHAT_CONFIG -o public/<app>_data_graph.json --format pretty

# 可选：限制 data 模式展开的数据量（默认推荐 10；0=不限制）
# 说明：用于避免 Bilibili/RedBook 等大数据集在 data-mode 下展开导致图/任务爆炸。
node scripts/navigation_declaration_analyzer.mjs <AppName> --data data/index.ts --data-limit 10 -o public/<app>_data_graph.json --format pretty
node scripts/navigation_declaration_analyzer.mjs <AppName> --data data/index.ts --data-limit 0 -o public/<app>_data_graph.json --format pretty

# 可选：data 模式剪枝不可达孤岛（默认仅 WARN，不剪枝）
node scripts/navigation_declaration_analyzer.mjs <AppName> --data data/index.ts --prune-unreachable -o public/<app>_data_graph.json --format pretty
```

> [!NOTE]
> - schema 模式会自动额外生成简化图：把输出文件名的 `.json` 替换为 `_simplified.json`
> - data 模式不会生成简化图（仅输出 data 图 + reachability）

### 11.1.1 一键生成产物（推荐）

推荐使用 `build_nav_artifacts.mjs` 保持 **一致性检查 + 图 + data 图 + tasks** 同步：

```bash
node scripts/build_nav_artifacts.mjs <AppName> --data data/index.ts --data-limit 10 --format pretty

# 可选：只更新图，不生成 tasks
node scripts/build_nav_artifacts.mjs <AppName> --data data/index.ts --skip-tasks --format pretty

# 可选：tasks 仅生成最短路径集合（默认）；如需枚举非最短路径
node scripts/build_nav_artifacts.mjs <AppName> --data data/index.ts --tasks-all-paths --format pretty

# 可选：调整 tasks 搜索上限（深度/同长度最短路径条数上限）
node scripts/build_nav_artifacts.mjs <AppName> --data data/index.ts --tasks-max-depth 30 --tasks-max-paths 20 --format pretty
```

> [!NOTE]
> - tasks 默认生成 **最短路径集合**（若存在多条同长度最短路径，会一并保留，但受 `--tasks-max-paths` 上限约束），用于控制任务体积。
> - data-mode 建议保留 `--data-limit 10`，避免大数据集展开导致图/任务爆炸（需要全量时显式 `--data-limit 0`）。

### 11.2 手势绑定扫描器

扫描 App 内所有 `bind*` 用法，生成 `transitionId -> gesture` 的 JSON：

```bash
node scripts/dump_trigger_gestures.mjs <AppName|AppPath>
```

### 11.3 静态 UI 分析器

查看现有路由/交互：

```bash
python scripts/static_ui_analyzer.py <App>
```

### 11.4 调试工具

```javascript
// 查看当前 App 路由状态
console.log(window.__OS__.getAppRoute());

// 查看系统状态
console.log(window.__OS__.state);

// 查看滚动状态
console.log(window.__getScrollMeta__());

// 手动触发返回
window.__OS__.handleBack();
```

**图可视化（viewer）**：

```bash
npx serve public
```

然后访问 `http://localhost:3000/nav_graph_viewer.html`（或 `ui_graph_viewer.html`），在页面里选择对应的图 JSON（如 `public/<app>_nav_graph.json` / `public/<app>_nav_graph_simplified.json`）。

---

## 十二、Checklist：新增 App 必做事项

### 文件结构

- [ ] 创建 `apps/<AppName>/` 或 `system/<AppName>/` 目录结构
- [ ] 创建 `manifest.ts`（App 身份/图标/主题 Tier-1 色 + intentFilters）
- [ ] 创建 `res/`（推荐：`colors.ts`/`strings.ts`/`dimens.ts`）
- [ ] 创建 `assets/`（可选：图片/音效/字体等二进制资源，使用 Vite import）
- [ ] 创建 `types.ts`（App 类型定义，位置标准化）
- [ ] 创建 `constants.ts`（结构性常量：tabs/配置等；资源类常量迁到 `res/`）
- [ ] 创建 `data/defaults.json`（默认数据：用户/内容/历史记录等，可替换）
- [ ] 创建 `data/index.ts`（唯一 TS 入口：合并常量 + 默认数据并导出 `<APPNAME>_CONFIG`）
- [ ] 创建 `navigation.declaration.ts` 导航声明文件
- [ ] 创建 `navigation.ts` 导航 Hook 实现
- [ ] 创建 `hooks/use<AppName>Gestures.ts` 手势 Hook 封装

### 导航声明

- [ ] 声明所有 `routes`（含 `uiStates`、`queryParams`、`scrollContainers`）
- [ ] 声明所有 `transitions`（含 `from`、`to`、`search`、`searchParams`）
- [ ] 声明原地动作 `actions`（挂在 `uiStates[]` 上）
- [ ] 设置 `capabilities.historyBack`

### 状态管理

- [ ] 创建 `context/<AppName>Context.tsx`，并注册到 `AppStateRegistry`
- [ ] 在 `os/AppStateRegistry.ts` 添加 `persistentReaders` 条目

### 主入口

- [ ] 创建 `<AppName>App.tsx` 主组件，包含：
  - [ ] `MemoryRouter` 和 `NavigationHandler`
  - [ ] 主 Tab 常驻挂载 + 子页面互斥渲染的混合布局
  - [ ] 使用 `useAppNavigate()` 替代 `useNavigate()`

### UI 规范

- [ ] 每个页面顶部添加 `pt-10` 预留状态栏空间
- [ ] 所有导航触发点使用 `bind*` 手势绑定（`data-trigger`）
- [ ] 所有原地动作触发点使用 action 模式绑定（`data-action`）
- [ ] 确保 `data-trigger` / `data-action` 与声明 ID 一致

### 系统集成

- [ ] 创建 `apps/NewApp/manifest.ts` 或 `system/NewApp/manifest.ts`，声明 App 身份、图标和主题：
  ```typescript
  import { SomeIcon } from 'lucide-react';
  import type { AppManifest } from '@/os/types/manifest';

  export const manifest: AppManifest = {
    id: 'new_app',
    packageName: 'com.example.newapp',
    displayName: '新应用',
    version: '1.0.0',
    versionCode: 1,
    type: 'plugin',
    icon: SomeIcon,              // lucide-react 图标或自定义 SVG 组件
    iconBackground: '#4a90d9',   // 图标背景色
    iconForeground: '#ffffff',   // 图标前景色
    theme: {
      colors: {
        primary: '#4a90d9',
        onPrimary: '#ffffff',
        background: '#ffffff',
        surface: '#ffffff',
        onSurface: '#000000',
        textPrimary: '#000000',
        textSecondary: '#666666',
        statusBarForeground: 'light',
      },
    },
    intentFilters: [{ route: '/', description: '首页' }],
  };
  ```

- [ ] 确保 `manifest.ts`、`*App.tsx`、可选 `state.ts` 位于自动发现路径下：
  - `apps/*` 供第三方 App 使用
  - `system/*` 供系统 App 使用
- [ ] 若 App 暴露共享数据，放到 `os/providers/*Provider.ts`，由 `ContentResolver` 统一访问；App 自己不要重复持有联系人/短信/媒体等 shared dataset

  > **注意**：APP_REGISTRY 中的 App 如果没有对应的 AppComponents 条目，点击时会显示"正在开发中"的 fallback UI。

- [ ] 在 App 主组件中使用 `useAppNavigationHandler` hook 注册导航/返回/生命周期：
  ```tsx
  import { useAppNavigationHandler } from '@/os/hooks/useAppNavigationHandler';

  // 在 <MemoryRouter> 内调用（hook 内部自动调用 useAppReady）
  useAppNavigationHandler('new_app', {
    onBack: () => { /* ... */ return false; },
    onNavigate: (path, directNavigate) => { directNavigate(path); },
  });
  ```

### 验证

- [ ] 运行 `navigation_declaration_analyzer.mjs` 生成图并关注控制台 `WARN(schema)` / `WARN`（不可达子图、边指向缺失节点等）
- [ ] 运行 `check_navigation_declaration_consistency.mjs` 确保无 `ERROR`（可加 `--actions` 一并检查 Actions）
- [ ] 测试 `__SIM__.getState()` 能正确返回 App 状态
- [ ] 测试 `__OS__.getAppRoute()` 能正确反映当前路由
- [ ] 测试所有手势交互是否正常

---

## 十三、常见一致性问题（以工具输出为准）

> [!NOTE]
> 当前 `navigation_declaration_analyzer.mjs` 主要负责“建图 +（data 模式）展开/剪枝 + 可达性统计/告警”，不会输出 `issues` 数组。更严格的“声明-源码触发点一致性 / 手势一致性 / 基础结构规则”请使用 `check_navigation_declaration_consistency.mjs`。

### 13.1 `check_navigation_declaration_consistency.mjs`（建议日常跑）

```bash
node scripts/check_navigation_declaration_consistency.mjs <AppName>

# 可选：一并检查 Actions（data-action）
node scripts/check_navigation_declaration_consistency.mjs <AppName> --actions

# 可选：仅输出 JSON / 将 WARN 也视为失败
node scripts/check_navigation_declaration_consistency.mjs <AppName> --json --fail-on-warn
```

- **ERROR：源码使用但声明缺失**：源码里出现了 `go('...')` / `bindTap('...')`，但 `navigation.declaration.ts` 的 `transitions[]` 不存在该 ID。
- **ERROR：触发点页面不在 `from`**：触发点所在页面（按 `routes[].component` 反推）不在该 transition 的 `from`（路径级检查）。
- **WARN：`from` 裸路径但无 base uiState**：`from: '/xxx'` 但该路由没有 `search:{}` 的 base 状态，可能在图里生成无入度“占位节点”。
- **ERROR：base uiState 命名不合法**：`uiState.search` 为 `{}` 但 `uiState.id` 不以 `.base` 结尾。
- **WARN：`ui.gesture` 与实际不一致**：声明的 `ui.gesture` 与实际 `bindTap/bindLongPress/bindDoubleTap` 使用不一致。

### 13.2 `navigation_declaration_analyzer.mjs`（生成图时关注告警）

- **`WARN(schema): unreachable subgraph detected ...`**：声明图存在不可达子图，或边指向缺失节点（会附带 `target_missing/source_missing/...` 的原因）。
- **data 模式**：输出 JSON 中会包含 `reachability`（可达性统计与 `unreachableNodeIds`）。

---

## 十四、附录

### 附录 A：FromConstraint 语法速查

| 约束类型 | 语法 | 含义 |
|---------|------|------|
| 仅匹配路径 | `'/video/:id'` | pathname 匹配即可 |
| 参数必须存在 | `{ path: '/video/:id', search: { modal: '*' } }` | modal 参数必须有值 |
| 参数必须等于 | `{ path: '/video/:id', search: { tab: 'comment' } }` | tab 必须等于 'comment' |
| 参数必须不存在 | `{ path: '/video/:id', search: { modal: null } }` | modal 参数不存在 |
| 组合约束 | `{ path: '/list', search: { filter: '*', modal: null } }` | filter 存在且 modal 不存在 |

### 附录 B：ID 命名约定

**Transition ID**：
```
<feature>.<action>[.<detail>]

示例：
- chat.open
- tab.contacts
- video.tab.comment
- modal.shelf.open
- bookshelf.select.enter
```

**Action ID**：
```
<domain>.<control>.<verb>

示例：
- settings.autoDownload.toggle       // 全局开关
- bookshelf.item.private.toggle      // 列表项开关
- profile.gender.select.male         // 全局选择
- search.keyword.input               // 全局输入
- profile.edit.submit                // 全局提交
```

### 附录 C：场景覆盖清单

| 场景 | 支持方式 |
|------|---------|
| 基础路由跳转 | `transitions` + `to` 字段 |
| 动态路径参数 | `params` 字段 |
| 动态 query 参数 | `searchParams` + `queryParams`，图节点使用 `:param` 占位符 |
| 离散 UI 状态 | `search` + `uiStates` 枚举 |
| Tab 切换 | `mode: 'replace'` |
| Tab 合并切换 | `.switch` transition + `searchParams` |
| 保留现有参数 | `preserveParams` 字段 |
| Modal / 菜单 | `to: <same pathname>` + `search` |
| 删除查询参数 | `search: { key: null }` |
| 条件可用动作 | `from: FromConstraint` |
| 历史回退 | `back(steps?)` 内建 |
| 条件跳转 | `cases` 字段 |
| 滚动观测 | `window.__getScrollMeta__()` + `scrollContainers` 声明 |
| 动态参数区分 | `data-trigger-params` 属性 |
| **原地动作** | |
| 全局开关 | `actions` + `behavior: 'toggle'` |
| 列表项动作 | `scope: 'item'` + `paramsSchema` |
| 选择类动作 | `behavior: 'select'` + actionId `.select.<option>` |
| 输入类动作 | `behavior: 'input'` + `paramsSchema: { value: ... }` |
| 提交类动作 | `behavior: 'submit'` |

---

## 十五、相关文档

- [NAVIGATION_DECLARATION_PROPOSAL.md](../navigation/NAVIGATION_DECLARATION_PROPOSAL.md) - 导航声明详细规范
- [DATA_SOURCE_PROPOSAL.md](../navigation/DATA_SOURCE_PROPOSAL.md) - 数据源声明与条件评估
- [ACTIONS_DECLARATION_PROPOSAL.md](../navigation/ACTIONS_DECLARATION_PROPOSAL.md) - 原地动作声明规范
- [UI_GRAPH_GENERATION.md](../navigation/UI_GRAPH_GENERATION.md) - UI 图生成算法

---

## 十六、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2024-12-24 | 初始版本 |
| 2.0 | 2026-01-10 | 整合声明式导航规范、统一手势体系、滚动状态观测 |
| 2.1 | 2026-01-13 | 新增：原地动作（Actions）、条件跳转、preserveParams、Tab 合并切换、data-trigger-params、条件声明（v0.5~v0.8） |
| 2.2 | 2026-01-16 | 补齐：dataSource/data-mode、availability、localStates/effects、viewer 使用与若干一致性修复 |
| 2.3 | 2026-01-18 | 新增 7.5 节：数据配置与状态管理规范（配置命名、localStorage 键名、AppStateRegistry 读取、系统服务数据分离） |
| 2.4 | 2026-01-22 | 新增 8.4 节：键盘与输入法规范（键盘高度、聊天页顶起、keep-keyboard、IME 词库生成） |
| 2.5 | 2026-01-28 | 新增 `__SIM__.setState()` 接口；移除冗余的 `__WECHAT_STATE__` 和 `__AGENT_API__`；在 `__SIM_QUERY__` 中添加 `getScrollMeta` 别名 |
| 2.6 | 2026-02-03 | 新增 8.4.3 节：键盘弹出时的智能滚动（滚动模式 vs 布局模式、`data-keyboard-scroll` 属性） |
| 2.7 | 2026-02-03 | 补充 8.4.4 节：页面整体保持键盘、系统自动处理路由切换时关闭键盘 |
| 2.8 | 2026-02-05 | 8.4.2：键盘高度改为固定值，由 `SIMULATOR_CONFIG.framework.keyboardHeight` 配置，与加号面板等底部区域共用 |
| 2.9 | 2026-02-19 | 数据架构重构：各 App 的 `xxxConfig.ts` 拆分为 `constants.ts` + `data/defaults.json` + `data/index.ts` 三层；`--data` 参数统一为 `data/index.ts` |
| 2.10 | 2026-03-03 | 8.4.2–8.4.3：新增 OS 级 adjustResize 机制说明（SystemShell 容器缩放）；更新聊天页 paddingBottom 指导；智能滚动改为基于 `data-adjust-resize` wrapper bounds 计算 |
| 2.11 | 2026-03-05 | **8.4.2 Breaking**：聊天页底部输入栏从 `position: fixed + bottom: keyboardHeight` 改为 `flex-shrink-0` 布局。修复 `designViewportWidth`（CSS zoom）下键盘遮挡输入框的严重 bug（影响 RedBook/WeChat/TencentMeeting）；OS 层 KeyboardOverlay `setHeight` 从 `useEffect` 改为 `useLayoutEffect`，消除键盘弹出时的 1 帧闪烁 |
