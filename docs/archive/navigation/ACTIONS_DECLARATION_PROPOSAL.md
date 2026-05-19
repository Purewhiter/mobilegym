# Actions 声明式方案（原地动作 / Node Annotations）

> 目标：在现有 `navigation.declaration.ts`（routes/uiStates/transitions + `data-trigger`）体系之上，引入 **Actions（原地动作）** 的声明与打标规范，使"页面上可执行的原地动作"具备：
>
> - **可声明**：每个页面状态下有哪些 actions
> - **可定位**：能从 actionId 反查到 UI 上对应的控件（DOM 元素）
> - **可区分实例**：同一 actionId 在列表等场景下可区分具体对象（例如 bookId）

---

## 1. 背景：为什么需要 Actions

现有的 `transitions` 只能描述 **导航/URL 状态变更**（通过 `go(id, params)` 触发），适用于：

- 切换页面（pathname 变化）
- Tab/Modal 等离散 UI 状态写入 query（search 变化）

但真实 App 中大量"可操作点"不会引起跳转，例如：

- 设置页开关（开/关）
- 表单提交
- 点赞/关注/收藏
- 列表项的"加入书架/设为私密"

这些动作的共同点：

- **通常不改变 route（不需要 `go()`）**；少数“回退型提交（完成/确定/发表）”会在副作用后 `back()` 关闭当前页面/弹窗（回到哪里取决于历史来源，因此仍建模为 action，而不是写成固定 `to` 的 transition）
- **会改变页面状态与/或后台数据状态**

因此需要引入 Actions：把"页面当前有哪些可点的原地动作"声明出来，并在 UI 上打标，保证可自动发现与可回放。

---

## 2. 核心原则（本方案的边界与选择）

### 2.1 Actions 不是边（不是 transition）

- `transition`（`data-trigger`）是 **图的边**：会触发 `go()`，改变 URL/状态节点。
- `action`（`data-action`）是 **节点上的注释（node annotation）**：表达"在这个节点上可执行哪些原地动作"。
- 对“回退型提交（完成/确定/发表）”，入口仍使用 `data-action` 表达“提交”语义；回退通过 `back()` 完成，但不写成 `transitions` 的固定边（避免把“历史依赖的返回目标”误建模为确定的 `to`）。

### 2.2 `data-action-params`：动作输入（operands），不用于导航

本方案明确区分两类 params：

- **`data-trigger-params`**：会被执行器消费，影响实际跳转（例如 `tab=week`）。
- **`data-action-params`**：用于描述 action 的**输入/操作数（operands）**，例如：
  - 作用对象（实例定位）：`bookId/userId/...`
  - 输入值：`value`
  - 可选目标态（toggle）：`to`
  
  `data-action-params` **不得**影响导航（不得改变 URL/route），但它可以被采集系统用于区分实例、生成任务描述、以及在回放时提供输入值。

典型场景：书架列表每本书都有一个"设为私密"按钮（需要 bookId 作为操作对象）：

- `data-action="bookshelf.item.private.toggle"`
- `data-action-params='{"bookId":"b_123"}'`

这能让采集系统知道"点的是哪一本书"。至于点击后到底变成私密还是取消私密，属于结果观测（after-state），不要求由 params 推导。

---

## 3. `uiStates` 规范（统一规则）

### 3.1 基本概念

- **RoutePath（pathname 模板）**：`routes[].path`，对应一个页面组件（`routes[].component`）。
- **Route-State 节点（Node）**：表示一个"可观测的页面离散状态"，由：
  - `routePath`（pathname 模板）
  - + 离散 query 组合（tab/modal/menu/select...）
  共同决定。

> 注：这里用 `routePath`/“RoutePath” 来指代 `routes[].path`，以避免与 `NAVIGATION_DECLARATION_PROPOSAL.md` 中“route=pathname+search（离散 URL）”的术语口径混淆。

### 3.2 `uiStates` 必选（每个 RouteDeclaration/routePath 都必须显式声明）

本仓库的类型定义中，`routes[].uiStates` 是必选字段；为保持一致性，本方案规定：

- **每个 `routes[]` 都必须显式提供 `uiStates` 数组**。
- `uiStates` 的作用是：枚举该 routePath（RouteDeclaration.path）下的"离散状态节点"（包括 base state）。

对于没有 tab/modal/menu/select 等离散子状态的页面：

- **必须**提供一个 base `uiState`（`search: {}`），表示该页面的唯一节点。

### 3.3 显式 base state 的命名规范

当你显式写 base 状态时：

- **必须**满足：
  - `search: {}`
  - `id` 以 `.base` 结尾

示例：

```ts
{
  path: '/settings/auto-download',
  component: 'AutoDownloadPage',
  // ...
  uiStates: [
    { id: 'settings.autoDownload.base', search: {}, description: '自动下载设置' }
  ],
}
```

### 3.4 "必须带离散 query 才合法"的页面（无 base）

有些页面要求某个离散 key 必须存在（例如必须带 `tab` 或 `sub`），那么：

- 不应该声明 `search: {}` 的 base state
- 只枚举实际可达的离散状态

示例（有声书中心必须有 sub）：

```ts
{
  path: '/audiobooks',
  component: 'AudiobooksPage',
  uiStates: [
    { id: 'audiobooks.sub.audio', search: { sub: 'audio' }, description: '有声书-推荐' },
    { id: 'audiobooks.sub.community', search: { sub: 'community' }, description: '有声书-社区' },
  ],
}
```

---

## 4. Actions 声明：放在哪里、长什么样

### 4.1 放置位置：挂在 `uiStates[]` 上

Actions 是"节点上的动作清单"，本方案规定把 actions 放在 `uiStates[]` 的 state 上：

- `routes[].uiStates[].actions?: ActionDeclaration[]`（可选字段；但一旦声明则必须遵守下文的打标规范）

这样 action 的归属链条是确定的：

`actionId -> uiState.id -> route.path -> route.component`

### 4.2 ActionDeclaration 字段定义

> 重点：本方案不要求 action 携带"跳转目标"；但允许可选的 `effects`（仅语义）来描述与 **localStates（本地子状态）** 相关的可观测副作用（例如打开/关闭一个非阻塞面板）。

```ts
export type ActionEffect =
  | { kind: 'localState.open'; id: string }
  | { kind: 'localState.close'; id: string };

export interface ActionDeclaration {
  /** app 内唯一的动作标识，用于 data-action 打标 */
  id: string;

  /** 人类可读标签 */
  label: string;

  /** 可选：更详细的语义说明 */
  description?: string;

  /**
   * 动作行为类型（描述"做什么"）
   * - toggle: 开关类（点击切换状态）
   * - select: 选择类（多选一，选项编码在 actionId 中）
   * - submit: 提交/确认类
   * - input: 输入类（文本框/数字框等）
   * - other: 其他
   */
  behavior: 'toggle' | 'select' | 'submit' | 'input' | 'other';

  /**
   * 动作作用范围（描述"作用于谁"）
   * - 不声明（默认）：全局/页面级动作
   * - 'item'：作用于某个列表项/实体（必须配合 paramsSchema 声明对象标识）
   */
  scope?: 'item';

  /**
   * 参数 schema（声明 data-action-params 的结构）
   *
   * 根据 behavior 和 scope 决定必选/可选：
   *
   * | scope    | behavior | paramsSchema 规则                                      |
   * |----------|----------|--------------------------------------------------------|
   * | (默认)   | toggle   | 可选 { to: 'boolean' }（目标态）                        |
   * | (默认)   | select   | 通常不需要（选项编码在 actionId 中）                    |
   * | (默认)   | input    | 必须包含 { value: 'string' | 'number' }                |
   * | (默认)   | submit   | 按需声明表单字段                                        |
   * | (默认)   | other    | 按需声明                                                |
   * | 'item'   | *        | 必须包含至少一个对象标识字段（如 bookId/userId）        |
   *
   * 注意：scope='item' 时的对象标识字段可与 behavior 所需字段叠加。
   * 例如 scope='item' + behavior='toggle' 可以是 { bookId: 'string', to: 'boolean' }
   */
  paramsSchema?: Record<string, 'string' | 'number' | 'boolean'>;

  /** 可选：入口显示条件（复用 StateCondition，见 docs/NAVIGATION_DECLARATION_PROPOSAL.md；v0.8 支持 and/or/not、paramEq/paramNeq） */
  condition?: StateCondition;

  /**
   * 可选：动作副作用（vNext，仅语义）
   *
   * - 不改变 URL / 不参与导航图边构建
   * - 目前仅用于描述 localStates 的打开/关闭（比如“关注后出现推荐面板”）
   */
  effects?: ActionEffect[];
}
```

### 4.3 典型 behavior + scope 组合示例

#### 4.3.1 全局 toggle（scope 默认）

```ts
{
  id: 'settings.autoDownload.toggle',
  label: '自动下载：开关',
  behavior: 'toggle',
  // scope 不声明，默认为全局
  // paramsSchema 可选，可声明 { to: 'boolean' } 表达目标态
}
```

#### 4.3.2 列表项 toggle（scope='item'）

```ts
{
  id: 'bookshelf.item.private.toggle',
  label: '书架：切换私密',
  behavior: 'toggle',
  scope: 'item',
  paramsSchema: { bookId: 'string' },  // scope='item' 时必须声明对象标识
}
```

#### 4.3.3 全局 select（多选一）

```ts
// 性别选择：两个 action，actionId 前缀相同表示互斥
{
  id: 'profile.gender.select.male',
  label: '选择性别：男',
  behavior: 'select',
}
{
  id: 'profile.gender.select.female',
  label: '选择性别：女',
  behavior: 'select',
}
```

#### 4.3.4 列表项 select（scope='item'）

```ts
// 给某本书选择分类
{
  id: 'bookshelf.item.category.select.fiction',
  label: '分类：小说',
  behavior: 'select',
  scope: 'item',
  paramsSchema: { bookId: 'string' },
}
```

#### 4.3.5 全局 input

```ts
{
  id: 'search.keyword.input',
  label: '搜索：输入关键词',
  behavior: 'input',
  paramsSchema: { value: 'string' },  // behavior='input' 时必须声明 value
}
```

#### 4.3.6 全局 submit

```ts
{
  id: 'profile.edit.submit',
  label: '保存个人资料',
  behavior: 'submit',
  paramsSchema: { name: 'string', bio: 'string' },  // 按需声明表单字段
}
```

> 规则：toggle 是"一个控件一个 actionId"，不拆 enable/disable；enable/disable 可由（可选）`params.to` 或点击前后状态观测表达。

---

## 5. UI 打标规范：如何从 action 声明定位到控件

### 5.1 统一手势绑定 API

本仓库采用统一的手势绑定模式（tap/longPress/doubleTap），通过 `bindTap/bindLongPress/bindDoubleTap` 系列函数产出可追溯的 `data-*` 标记。

#### 5.1.1 设计约束

- **必须**只用一套手势绑定 API（对外仍叫 `bindTap/bindLongPress/...`）。
- **必须**保持现有 trigger 用法完全兼容（不改现有代码即可继续工作）。
- **必须**通过"入参形态"区分语义，并产出不同的 DOM 标记：
  - trigger：产出 `data-trigger-*`
  - action：产出 `data-action-*`

#### 5.1.2 API 形状

**Trigger（现有用法，保持不变）：**

```ts
bindTap('myReading.tab.switch', { params: { tab: 'week' } })
// 产出：data-trigger / data-trigger-type / data-trigger-params
// 行为：触发 go/back（由现有 execute 机制决定）
```

**Action（新增用法）：**

```ts
bindTap({ kind: 'action', id: 'settings.autoDownload.toggle' }, {
  // params 是 action 的输入（对象标识/输入值/可选目标态）
  params: { /* e.g. bookId / value / to */ },
  // action 的业务逻辑必须由调用方提供（手势层不自动 go/back；如需“回退型提交”，可在 onTrigger 内显式调用 back()）
  onTrigger: () => { /* toggle handler */ },
})
// 产出：data-action / data-action-type / data-action-params
// 行为：只调用 onTrigger（不走 execute 的 go/back；允许 onTrigger 内显式 back() 做回退型提交）
```

#### 5.1.4 共享组件/间接绑定入口（TopBar/FAB 等）

当 action 的点击入口 DOM 在共享组件中渲染（如 TopBar 右侧按钮），但 actionId 由页面通过 context/store 配置时：

- 共享组件内部仍应使用 action 模式绑定，最终产出 `data-action-*`（不要只写 `onClick`）。
- 为了让静态工具可靠发现该入口，页面侧配置时要求入口字段名**必须写死为 `id`**，并以 object literal 的 `id: '<actionId>'` **字符串字面量**传递，禁止动态拼接/变量计算。

#### 5.1.3 类型定义建议

```ts
// === 类型定义 ===

// 第一个参数的类型：string（trigger）或 ActionSpec（action）
type TriggerOrAction = string | { kind: 'action'; id: string };

// 产出的 DOM 属性类型（根据 kind 不同产出不同属性）
type TriggerGestureProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  'data-trigger': string;
  'data-trigger-type': string;
  'data-trigger-params'?: string;
};

type ActionGestureProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  'data-action': string;
  'data-action-type': string;
  'data-action-params'?: string;
};

type GestureProps<T extends HTMLElement> = TriggerGestureProps<T> | ActionGestureProps<T>;

// === 函数签名 ===

interface BaseGestureOptions<T extends HTMLElement> {
  params?: Record<string, string | number | boolean>;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  beforeTrigger?: (event: React.SyntheticEvent<T>) => void;
  onTrigger?: () => void;  // action 模式必须提供
}

function bindTap<T extends HTMLElement>(
  spec: TriggerOrAction,
  options?: BaseGestureOptions<T>,
): GestureProps<T>;

// === 实现要点 ===

// 在 useTriggerGestures 中，根据 spec 类型判断产出不同属性：
const bindTap = <T extends HTMLElement>(
  spec: TriggerOrAction,
  options?: BaseGestureOptions<T>,
): GestureProps<T> => {
  const isAction = typeof spec === 'object' && spec.kind === 'action';
  const id = isAction ? spec.id : spec;
  const prefix = isAction ? 'data-action' : 'data-trigger';

  const attrs: any = {
    [prefix]: id,
    [`${prefix}-type`]: 'tap',
  };
  if (options?.params && Object.keys(options.params).length > 0) {
    attrs[`${prefix}-params`] = JSON.stringify(options.params);
  }

  return {
    ...attrs,
    onClick: (event) => {
      if (options?.preventDefault) event.preventDefault();
      if (options?.stopPropagation) event.stopPropagation();
      options?.beforeTrigger?.(event);
      
      if (isAction) {
        // action 模式：只调用 onTrigger（不走 execute 的 go/back；允许在 onTrigger 内显式 back() 做回退型提交）
        options?.onTrigger?.();
      } else {
        // trigger 模式：调用 execute（现有逻辑）
        if (options?.onTrigger) {
          options.onTrigger();
        } else if (execute) {
          execute(id, options?.params);
        }
      }
    },
  };
};
```

> bindLongPress / bindDoubleTap 同理改造，根据 `spec.kind` 产出 `data-action-*` 或 `data-trigger-*`。

### 5.2 基础属性

所有可触发原地动作的控件必须打标：

- `data-action="<actionId>"`
- `data-action-type="<gestureType>"`（tap/longPress/doubleTap）
- `data-action-params="<json>"`（若有 params）

示例：

```tsx
<button
  {...bindTap(
    { kind: 'action', id: 'settings.reader.allowLandscape.toggle' },
    { onTrigger: toggleAllowLandscape },
  )}
>
  允许横屏
</button>
```

### 5.3 `data-action-params` 与 `paramsSchema`

当 action 需要输入（对象标识/输入值/可选目标态）时，必须提供 `data-action-params`。

**规则：**

- 若声明了 `paramsSchema`，则 `data-action-params` 的 key 集合必须与 paramsSchema 一致（不允许缺失/多余 key）
- 值类型必须与 schema 声明一致

**示例（列表项动作）：**

```tsx
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

### 5.4 input 类型的打标方式

对于输入框，使用 `bindInput` 辅助函数（或扩展 bindTap 支持 input 事件）：

```tsx
// 方案 A：专用 bindInput 函数
<input
  {...bindInput(
    { kind: 'action', id: 'search.keyword.input' },
    {
      value: searchValue,
      onChange: (e) => setSearchValue(e.target.value),
      onSubmit: () => doSearch(searchValue),  // 可选：回车提交时的回调
    },
  )}
/>
// 产出：data-action="search.keyword.input" data-action-type="input"
// 注意：data-action-params 在输入完成时（blur/submit）才更新为当前 value

// 方案 B：在 blur/submit 时通过普通 bindTap 触发
<input
  value={searchValue}
  onChange={(e) => setSearchValue(e.target.value)}
  onBlur={() => {
    // 此时可以记录 action 完成
  }}
  data-action="search.keyword.input"
  data-action-type="input"
/>
```

> 说明：input 类型的精确打标方式可根据实际采集需求选择。核心要求是：
> - 必须有 `data-action` 标识（用于声明和定位）
> - `data-action-params` 是可选的（本方案的目标是"声明 + 定位 + 实例区分"，不强制捕获输入值）

### 5.5 与 `data-trigger` 的关系

#### 默认规则：同一手势下二选一

同一“手势类型”下，一个入口要么是 transition（`data-trigger`），要么是 action（`data-action`）；不要在**同一手势**上同时标两类，否则语义/回放会产生歧义。

#### 允许例外：同一节点承载多种手势（典型：头像）

当同一 DOM 节点支持多个**不同**手势且语义不同（例如头像**单击进入主页**、**双击拍一拍**），允许同时存在 `data-trigger` 与 `data-action`，并依赖 `data-trigger-type` / `data-action-type` 区分：

- 例：`data-trigger="userProfile.open" data-trigger-type="tap"`
- 例：`data-action="chat.pat.send" data-action-type="doubleTap"`

> 说明：`useTriggerGestures` 的单次 `bind*` 调用只会生成一类打标；多手势复用同一节点时，可以通过合并 props 或封装组件实现，但必须保证运行时不会在同一次手势里同时触发 `go()` 与 `onTrigger`。

#### 导航 + 副作用（同一手势）

如果某个 UI 入口在“同一次 tap”里既会导航又会产生副作用，仍应建模为 `data-trigger`（因为它会改变节点/路径）；副作用可在采集层做后置观测记录。

#### 回退型提交（完成/确定/发表）

对于“完成/确定/发表”等按钮，很多实现的本质是：先执行一次提交/保存副作用，然后调用 `back()` 关闭当前页面/弹窗；**回到哪里取决于历史来源**，并不总能用一个固定 `to` 表达。

此类入口建议：

- **建模为 action（`behavior:'submit'`）并打标 `data-action`**（让 Agent 能识别“提交”语义）
- `onTrigger` 内部可以执行副作用后再 `back()` 关闭（回退行为不强行写成 transition 边，避免图里出现误导性的固定返回目标）
- 如果你确实需要在图里表达“回到哪个节点”，需要把“来源”显式建模成离散状态（例如 `search` 中加入 `entry`）或用 `cases` 让目标可判定
- **回退/返回/取消/关闭遮罩**等“纯回退”按钮本身不属于 action：请使用 `bindBack()`（`system.back`），不要为它们分配 actionId，也不要写进声明。

---

## 6. ActionId 命名规范（硬规则）

### 6.1 结构

ActionId **必须**满足：

- 由字母/数字/点号组成（允许驼峰）：`^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+$`
- 至少包含 3 段：`<domain>.<control>.<verb>`
- 如需更精确定位，**应**使用 4 段或更多：`<domain>.<page>.<control>.<verb>`
- **唯一性范围**：app 内全局唯一

> 说明：本仓库允许使用驼峰（如 `profilePrivacy`、`allowLandscape`）来提升可读性；但必须保持“点号分段 + 末尾动词段”的结构，不允许使用 `-` / `_`。

### 6.2 命名规则

- **domain/page/control**：表达"这个动作属于哪个区域/页面/控件"
- **verb**：表达"这是一个什么动作"
  - behavior=toggle 固定使用 `.toggle`
  - behavior=select 固定使用 `.select.<option>`（**互斥关系通过前缀推断**：同一 `<prefix>.select` 下的 actions 互斥）
  - behavior=input 固定使用 `.input`
  - behavior=submit 固定使用 `.submit`

### 6.3 scope='item' 的命名约定

当 action 的 `scope='item'` 时，actionId 中**应**包含 `.item.` 以表明这是一个作用于列表项的动作：

```
<domain>.item.<control>.<verb>
```

示例：
- `bookshelf.item.private.toggle`（书架列表项-私密-切换）
- `bookshelf.item.category.select.fiction`（书架列表项-分类-选择-小说）

### 6.4 示例

以下都是合法的命名：

| actionId | behavior | scope | 说明 |
|----------|----------|-------|------|
| `settings.autoDownload.toggle` | toggle | (默认) | 全局开关 |
| `settings.reader.allowLandscape.toggle` | toggle | (默认) | 全局开关 |
| `settings.profilePrivacy.visibility.select.self` | select | (默认) | 驼峰命名示例（页面/模块名更贴近组件语义） |
| `bookshelf.item.private.toggle` | toggle | item | 列表项开关 |
| `profile.gender.select.male` | select | (默认) | 全局选择 |
| `profile.gender.select.female` | select | (默认) | 全局选择 |
| `bookshelf.item.category.select.fiction` | select | item | 列表项选择 |
| `search.keyword.input` | input | (默认) | 全局输入 |
| `profile.edit.submit` | submit | (默认) | 全局提交 |

---

## 7. 典型页面示例

### 7.1 设置页开关（全局 toggle）

**声明（挂在 base state 上）：**

```ts
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
          description: '控制是否自动下载章节',
          behavior: 'toggle',
        },
      ],
    },
  ],
}
```

**UI 打标：**

```tsx
<div
  role="switch"
  {...bindTap(
    { kind: 'action', id: 'settings.autoDownload.toggle' },
    { onTrigger: toggleAutoDownload },
  )}
/>
```

### 7.2 性别选择页（全局 select）

**声明：**

```ts
{
  path: '/gender-selection',
  component: 'GenderSelectionPage',
  uiStates: [
    {
      id: 'profile.genderSelection.base',
      search: {},
      description: '性别选择',
      actions: [
        // 同一 profile.gender.select 前缀下的 actions 互斥
        {
          id: 'profile.gender.select.male',
          label: '选择性别：男',
          behavior: 'select',
        },
        {
          id: 'profile.gender.select.female',
          label: '选择性别：女',
          behavior: 'select',
        },
      ],
    },
  ],
}
```

**UI 打标：**

```tsx
<button
  {...bindTap(
    { kind: 'action', id: 'profile.gender.select.male' },
    { onTrigger: () => setGender('male') },
  )}
>
  男
</button>
<button
  {...bindTap(
    { kind: 'action', id: 'profile.gender.select.female' },
    { onTrigger: () => setGender('female') },
  )}
>
  女
</button>
```

### 7.3 书架列表（列表项 toggle）

**声明：**

```ts
{
  path: '/bookshelf',
  component: 'BookshelfPage',
  uiStates: [
    {
      id: 'bookshelf.base',
      search: {},
      description: '书架默认视图',
      actions: [
        {
          id: 'bookshelf.item.private.toggle',
          label: '书架：切换私密',
          behavior: 'toggle',
          scope: 'item',
          paramsSchema: { bookId: 'string' },
        },
        {
          id: 'bookshelf.item.remove.submit',
          label: '书架：移出',
          behavior: 'submit',
          scope: 'item',
          paramsSchema: { bookId: 'string' },
        },
      ],
    },
  ],
}
```

**UI 打标：**

```tsx
{shelf.map(book => (
  <div key={book.bookId}>
    <span>{book.title}</span>
    <button
      {...bindTap(
        { kind: 'action', id: 'bookshelf.item.private.toggle' },
        { params: { bookId: book.bookId }, onTrigger: () => togglePrivate(book.bookId) },
      )}
    >
      {book.isPrivate ? '取消私密' : '设为私密'}
    </button>
    <button
      {...bindTap(
        { kind: 'action', id: 'bookshelf.item.remove.submit' },
        { params: { bookId: book.bookId }, onTrigger: () => removeFromShelf(book.bookId) },
      )}
    >
      移出书架
    </button>
  </div>
))}
```

### 7.4 搜索页（全局 input）

**声明：**

```ts
{
  path: '/search',
  component: 'SearchPage',
  uiStates: [
    {
      id: 'search.base',
      search: {},
      description: '搜索页',
      actions: [
        {
          id: 'search.keyword.input',
          label: '搜索：输入关键词',
          behavior: 'input',
          paramsSchema: { value: 'string' },
        },
        {
          id: 'search.submit',
          label: '搜索：提交',
          behavior: 'submit',
        },
      ],
    },
  ],
}
```

**UI 打标：**

```tsx
<input
  value={keyword}
  onChange={(e) => setKeyword(e.target.value)}
  data-action="search.keyword.input"
  data-action-type="input"
/>
<button
  {...bindTap(
    { kind: 'action', id: 'search.submit' },
    { onTrigger: () => doSearch(keyword) },
  )}
>
  搜索
</button>
```

---

## 8. 工程约束（必选规则）

### 8.1 强制打标

- 所有导航入口必须有 `data-trigger`（现有规则）
- 所有原地动作入口必须有 `data-action`

### 8.2 CI 必须检查的规则

**声明层校验：**

- 若某 `uiState` 的 `search` 为 `{}`，则其 `id` 必须以 `.base` 结尾
- `action.id` app 内唯一
- `scope='item'` 时，`paramsSchema` 必须包含至少一个对象标识字段
- `behavior='input'` 时，`paramsSchema` 必须包含 `value` 字段
- `behavior='select'` 时，actionId 必须匹配 `<prefix>.select.<option>` 格式

**打标层校验（可选，需静态分析或运行时检查）：**

- 若 action 声明了 `paramsSchema`，则 UI 侧必须提供 `data-action-params`
- `data-action-params` 的 key 集合必须与 `paramsSchema` 一致（不允许缺失/多余 key）
- `data-action-params` 必须是合法 JSON

### 8.3 TypeScript 类型辅助

可在 `navigation.types.ts` 中定义辅助类型，在编译期检查 paramsSchema 规则：

```ts
// 辅助类型：根据 behavior 和 scope 约束 paramsSchema
type ActionDeclarationStrict =
  | { behavior: 'toggle'; scope?: never; paramsSchema?: { to?: 'boolean' } }
  | { behavior: 'toggle'; scope: 'item'; paramsSchema: Record<string, 'string' | 'number'> & { to?: 'boolean' } }
  | { behavior: 'select'; scope?: never; paramsSchema?: never }
  | { behavior: 'select'; scope: 'item'; paramsSchema: Record<string, 'string' | 'number'> }
  | { behavior: 'input'; scope?: never; paramsSchema: { value: 'string' | 'number' } }
  | { behavior: 'input'; scope: 'item'; paramsSchema: Record<string, 'string' | 'number'> & { value: 'string' | 'number' } }
  | { behavior: 'submit'; scope?: never; paramsSchema?: Record<string, 'string' | 'number' | 'boolean'> }
  | { behavior: 'submit'; scope: 'item'; paramsSchema: Record<string, 'string' | 'number'> }
  | { behavior: 'other'; scope?: 'item'; paramsSchema?: Record<string, 'string' | 'number' | 'boolean'> };
```

> 注：scope='item' 时，paramsSchema 的对象标识字段（如 bookId）只允许 `'string' | 'number'`，不允许 `'boolean'`。

---

## 9. 兼容性与迁移

为了最小化改动，本方案：

- 不改变现有 `transitions`/`data-trigger` 行为与语义
- Actions 仅作为"节点注释"新增字段
- 允许逐页面迁移：先从 Settings/开关类页面开始补 `data-action`

### 9.1 迁移步骤建议

1. **Phase 1**：在 `navigation.types.ts` 中新增 `ActionDeclaration` 类型
2. **Phase 2**：扩展 `useTriggerGestures` 支持 action 模式的 `bindTap`
3. **Phase 3**：从简单页面开始声明 actions 并打标（Settings 页面的 toggle）
4. **Phase 4**：迁移列表页（BookshelfPage 的 item actions）
5. **Phase 5**：添加 CI 校验规则

---

## 10. 附录：完整类型定义

> 注：以下类型应添加到现有的 `navigation.types.ts` 中，在现有 `uiStates` 数组元素类型上新增 `actions` 字段。

```ts
import { StateCondition } from './navigation.types'; // 复用现有类型（v0.8 支持 and/or/not、paramEq/paramNeq）

/**
 * 原地动作声明
 * 
 * 描述页面上不引起导航的可执行动作。
 * actionId 在 app 内全局唯一。
 */
export interface ActionDeclaration {
  /** app 内唯一的动作标识 */
  id: string;

  /** 人类可读标签 */
  label: string;

  /** 可选：更详细的语义说明 */
  description?: string;

  /** 动作行为类型 */
  behavior: 'toggle' | 'select' | 'submit' | 'input' | 'other';

  /** 动作作用范围（不声明则为全局/页面级） */
  scope?: 'item';

  /** 参数 schema（scope='item' 时对象标识字段只允许 'string' | 'number'） */
  paramsSchema?: Record<string, 'string' | 'number' | 'boolean'>;

  /** 可选：入口显示条件（StateCondition；见 docs/NAVIGATION_DECLARATION_PROPOSAL.md） */
  condition?: StateCondition;
}

// 在现有 RouteDeclaration.uiStates 数组元素类型上新增 actions 字段：
// 
// uiStates: Array<{
//   id: string;
//   search: Record<string, string | null>;
//   description: string;
//   stateCondition?: StateCondition;
//   actions?: ActionDeclaration[];  // <-- 新增
// }>;
```
