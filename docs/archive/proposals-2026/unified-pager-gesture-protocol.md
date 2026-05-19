# 手势归属与横向切页协议

> 状态：设计稿，待实施  
> 原标题：横向分页手势协议（Pager Gesture Protocol，方案 A）  
> 新定位：**Gesture Ownership + PageSwitch 首个落地场景**  
> 核心目标：解决 mobile-gym 中 pointer / wheel / `__SIM_INPUT__` 被多个组件重复解释、互相抢手势、运行态行为不可控的问题。横向切页只是第一批接入能力，不是协议本身。

---

## 一、问题重述

mobile-gym 当前的问题，表面上看是“横向分页实现分散”：

| 场景 | 当前实现 | 症状 |
|---|---|---|
| Launcher 桌面页 | scroll-snap + mouseDragRef + 长按拖动 | 鼠标 / 触摸 / `__SIM_INPUT__` 路径不一致，touchpad 横滑可能触发浏览器返回 |
| SystemShade 通知 / 控制中心 | 自写 pointer + wheel + 上滑关闭 | 横切、纵向关闭、slider 阻断混在一个状态机里 |
| App 顶部 Tab Feed | 大多没做横滑 | 真机可横滑，模拟器不可横滑 |
| 相册 / 阅读器 / 媒体预览 | 各自手写或缺失 | 方向判断、click suppress、边界交接重复踩坑 |

但本质问题不是缺一个 `usePagerGesture`。

真正的问题是：

> **同一次 pointer / wheel 序列，会被多个组件同时解释；系统没有统一的“谁拥有这次手势”的协议。**

这会导致：

1. 父级 pager、子级 carousel、slider、drag、scroll container 同时响应。
2. 横向 wheel 在浏览器层触发 history back。
3. `__SIM_INPUT__.swipe` 一边发 pointer/touch，一边手动 `scrollBy`，和组件自写逻辑叠加。
4. 手势行为缺少稳定的 owner / role / 测试标记，bench_env 难以稳定复现和诊断。
5. 每个组件都重复实现 slop、velocity、pointercancel、blur、click suppress、cleanup。

所以新方案不再把“Pager”当成根抽象，而是拆成两层：

```text
Gesture Ownership  决定一次输入序列归谁
PageSwitch         横向切页，是 ownership 上的第一个 recognizer
```

---

## 二、真实系统与成熟 Web App 的参考模型

### 2.1 Android 的做法

Android 不用一个统一 pager 控制所有横滑，而是通过事件分发与拦截决定归属：

```text
MotionEvent: ACTION_DOWN → ACTION_MOVE* → ACTION_UP / ACTION_CANCEL
ViewGroup.dispatchTouchEvent()
ViewGroup.onInterceptTouchEvent()
child.requestDisallowInterceptTouchEvent(true)
NestedScrolling child/parent handoff
```

关键思想：

- `DOWN` 后先观察，不急着抢。
- 超过 `touchSlop` 后，父容器可 `intercept`。
- 一旦父容器接管，子 view 收到 `ACTION_CANCEL`。
- nested scroll 不是静态 block，而是 child 消费自己能消费的 delta，剩余交给 parent。
- 系统手势（返回、通知栏、Home）在更高层有优先级。

### 2.2 复杂跨平台 Web App 的做法

成熟移动 Web App 通常分层处理：

1. **原生滚动优先**：普通列表、简单横滚尽量用 `overflow` / `scroll-snap` / `touch-action` / `overscroll-behavior`。
2. **输入归一**：需要自定义手势时，用 Pointer Events 处理 touch / mouse / pen，wheel 单独处理。
3. **手势归属**：DOWN 时观察，MOVE 过 slop 后 claim，claim 后其他 recognizer yield/cancel。
4. **嵌套边界交接**：child 能滚先 child，child 到边界后 parent 才接管。
5. **业务语义**：手势结果变成 switch tab、close sheet、open drawer、back 等语义动作。

mobile-gym 比普通 Web App 多一个约束：**动作必须可复现、可测试、可诊断**。  
因此手势归属需要暴露稳定 owner / role / DOM 标记，但第一阶段不把 PageSwitch 接入 navigation declaration。

---

## 三、设计目标

### 3.1 必须满足

1. **统一手势归属**：同一 pointer / wheel 序列最多只有一个 owner。
2. **横向切页复用**：Launcher、SystemShade、App Tab Feed 等共享 page switch 模型。
3. **保留场景语义**：SystemShade 的上滑关闭、Launcher 的长按拖动、slider 调节不被通用 pager 吞掉。
4. **支持 nested handoff**：内层横向 scroll / carousel 未到边界时优先消费，到边界后允许父级接管。
5. **兼容 `__SIM_INPUT__`**：现有 `tap/swipe/drag` 不需要改脚本即可驱动迁移后的场景。
6. **防浏览器副作用**：横向 wheel 必须阻止浏览器 history back；不做全局滥用 `preventDefault`。
7. **运行态可诊断**：手势 owner、role、claim / release 行为必须能被测试和调试工具观察。
8. **高性能**：move/wheel 高频路径不触发 React 高频重渲染。
9. **可测试**：模型、归属、DOM guard、simInput 兼容均可单测。

### 3.2 不做

- 不做完整 OS 级 gesture arbitrator 框架。
- 不统一实现所有手势。
- 不替代普通纵向滚动。
- 不强制所有横向场景第一阶段迁移。
- 不新增 `__SIM_INPUT__.wheel` 作为第一阶段要求。
- 不在第一阶段改写所有 Slider / Drag / Sheet，只提供接入协议。

---

## 四、核心原则

1. **归属优先于行为**  
   先决定这次输入序列归谁，再执行 pager / slider / drag / sheet close。

2. **场景保留语义**  
   PageSwitch 不知道 SystemShade 怎么关闭，也不知道 Launcher 怎么拖图标。它只提供横向切页能力。

3. **DOM 声明 + 运行时判断结合**  
   `data-gesture-role` 负责静态意图，nested scroll 边界、方向、delta 必须运行时判断。

4. **原生滚动仍然是默认能力**  
   只有需要业务语义、跨输入一致性、bench 可观测的场景才进入手势归属层。

5. **App 自己决定页面状态事实源**  
   App Tab Feed 可以用 URL、受控 state 或 service state 表达当前页。若现有页面本来由路由驱动，横滑切页应复用 app `go()`；但 PageSwitch 不要求新增 navigation declaration schema。

6. **高频路径 imperative，低频状态 React**  
   跟手 transform 直接写 DOM；claim / release / page change 才触发 React 状态。

---

## 五、模块结构

第一阶段新增：

```text
os/gestures/
├── gestureSession.ts          # pointer/wheel 序列归属：claim/release/cancel/click suppress
├── gestureGuards.ts           # DOM 协议与 nested scroll 边界判断
├── pageSwitchModel.ts         # 横向切页纯函数：阈值、速度、目标页、rubber band
├── usePageSwitchGesture.ts    # 横向切页 recognizer，不包含具体 UI 语义
├── PagerTrack.tsx             # 普通 App Tab Feed 的可选 DOM 包装
└── adapters/
    ├── useShadePanelSwitch.ts       # SystemShade 横向切换适配
    └── useLauncherWorkspacePager.ts # Launcher 工作区适配
```

后续如确实需要，再扩展：

```text
os/gestures/
├── useVerticalSheetGesture.ts
├── useDragGesture.ts
└── gestureArbitrator.ts
```

第一阶段不做这些后续模块。

---

## 六、Gesture Ownership 协议

### 6.1 基本模型

```typescript
export type GestureIntent =
  | 'page-switch'
  | 'slider'
  | 'drag'
  | 'sheet-close'
  | 'scroll'
  | 'system-back'
  | 'shade-pull';

export interface GestureClaim {
  owner: string;
  intent: GestureIntent;
  pointerId?: number;
  preventDefault?: boolean;
  suppressClick?: boolean;
}

export interface GestureSession {
  pointerId?: number;
  startX: number;
  startY: number;
  latestX: number;
  latestY: number;
  owner: GestureClaim | null;
  startedAt: number;
}
```

### 6.2 生命周期

```text
pointerdown / wheel start
  ↓
create session，owner = null
  ↓
各 recognizer 观察 delta
  ↓
某 recognizer 超过 slop 且满足条件 → claim
  ↓
其他 recognizer yield / cancel
  ↓
owner 处理 move / wheel
  ↓
pointerup / pointercancel / blur / wheel settle
  ↓
release session，必要时 suppress click
```

### 6.3 设计边界

这不是完整 arbitrator。第一阶段只需要一个轻量 session 工具：

- 每个 hook 可查询当前是否已有 owner。
- 每个 hook 可尝试 claim。
- claim 成功后设置 `preventDefault` / `suppressClick` 策略。
- pointer end / cancel / blur 后清理。
- click capture 根据 session 标记吞掉 click。

不要求：

- recognizer 注册中心。
- 多 recognizer 自动排序。
- 复杂优先级图。
- 全局遥测。

### 6.4 第一阶段接入硬约束

为了避免 Ownership 退化成“PageSwitch 自律层”，第一阶段所有仍会与 PageSwitch 共存的 OS 级 recognizer 必须接入 `gestureSession`：

| 现有 recognizer | 第一阶段要求 |
|---|---|
| SystemShell edge back / recents 手势 | claim 前查询 session；claim 成功后写入 `owner: 'system.edge-back'` 或对应 owner |
| TopEdgeShadeGestureCatcher / shade pull | claim 前查询 session；claim 成功后写入 `owner: 'system.shade-pull'` |
| SystemShade 横向切换 / 纵向关闭 | 横向切换走 `useShadePanelSwitch`；纵向关闭 claim 前也查询 session |
| SystemShade slider | 起手即声明 `data-gesture-role="slider"`，必要时 claim `owner: 'system.shade-slider'` |
| Launcher workspace page switch | 通过 `useLauncherWorkspacePager` claim |
| Launcher 图标 / 文件夹 drag | 长按触发 drag 前查询 session；进入 drag 后 claim `owner: 'launcher.drag'` |

不要求第一阶段改写所有 recognizer 的内部实现，但必须满足：

1. claim 前检查是否已有其他 owner。
2. claim 成功后写入 owner。
3. pointerup / pointercancel / blur / unmount 释放 owner。
4. claim 后需要吞 click 的场景统一走 session suppress，而不是各自永久挂 ref。

如果某个既有 recognizer 暂时无法接入，它不能与 PageSwitch 同时覆盖同一块起手区域；必须通过 `data-gesture-block` 或更高层区域划分隔离。

### 6.5 与 Android 的对应关系

| Android | mobile-gym |
|---|---|
| `ACTION_DOWN` | `pointerdown` / wheel start |
| `touchSlop` | `claimSlopPx` |
| `onInterceptTouchEvent` | `shouldClaimGesture()` |
| `ACTION_CANCEL` | `onGestureCancel()` / yield |
| `requestDisallowInterceptTouchEvent` | `data-gesture-block` / runtime nested scroll yield |
| NestedScrolling | child scroll boundary handoff |
| VelocityTracker | release velocity / wheel accumulator |

---

## 七、DOM 协议

### 7.1 新属性

| 属性 | 作用 |
|---|---|
| `data-gesture-role="page-switch"` | 当前区域可横向切页 |
| `data-gesture-role="slider"` | 连续调节控件，默认优先于父级 page-switch |
| `data-gesture-role="drag"` | 长按拖动 / 拖拽排序区域 |
| `data-gesture-role="scroll-h"` | 内部横向滚动 / carousel |
| `data-gesture-role="scroll-v"` | 内部纵向滚动 |
| `data-gesture-block` | 阻断所有父级自定义手势 |
| `data-gesture-block="page-switch"` | 仅阻断父级横向切页 |
| `data-page-switch` | 横向切页根容器 |
| `data-page-switch-track` | 跟手 transform 轨道 |
| `data-page-switch-page` | 单个 page |

兼容期识别旧属性：

| 旧属性 | 新含义 |
|---|---|
| `data-shade-slider="true"` | `data-gesture-role="slider"` |
| `data-shade-scroll="true"` | `data-gesture-role="scroll-v"` |
| `data-scroll-container` + `data-scroll-direction="horizontal"` | `data-gesture-role="scroll-h"` |
| `data-scroll-container` + `data-scroll-direction="vertical"` | `data-gesture-role="scroll-v"` |

### 7.2 Guard API

原方案的 `isPagerBlocked(target)` 信息不足。  
新 guard 必须区分“起手阻断”和“移动中交接”。

```typescript
export function shouldBlockGestureStart(target: EventTarget | null, intent: GestureIntent): boolean;

export function getGestureRole(target: EventTarget | null): GestureIntent | null;

export function shouldYieldToNestedScroll(args: {
  target: EventTarget | null;
  axis: 'x' | 'y';
  deltaPx: number;
}): boolean;

export function shouldSuppressClickAfterGesture(target: EventTarget | null): boolean;
```

### 7.3 起手阻断规则

命中以下任一即阻断父级 page-switch：

- `input`
- `textarea`
- `select`
- `[contenteditable=true]`
- `[data-gesture-block]`
- `[data-gesture-block="page-switch"]`
- `[data-gesture-role="slider"]`
- `[data-gesture-role="drag"]`
- 系统保留区域，如 edge back / shade pull catcher

`button` / `[role="button"]` 默认不阻断。  
原因：真机上从 tab、卡片、图标起手横滑也应能切页。未过 slop 时仍派发 click，过 slop 后由 owner suppress click。

注意：这是 **page-switch 横向切页** 的默认规则，不是所有手势的通用规则。  
例如 SystemShade 纵向上滑关闭不应从 button / `[role="button"]` 起手触发；这类场景需要自己的 `shouldIgnoreSwipeClose` 语义判断，不能直接复用 page-switch 的 button 规则。

### 7.4 Nested Scroll 交接

`scroll-h` 不能永远阻断父级。必须看方向和边界。

约定：`deltaPx > 0` 表示手指 / 鼠标向右拖。

```text
内层横向滚动容器：
  手指向右拖 → 期望 scrollLeft 减小，若未到左边界则 child 消费
  手指向左拖 → 期望 scrollLeft 增大，若未到右边界则 child 消费
  child 还能消费 → parent yield
  child 到边界 → parent 可 claim
```

实现时不要把方向写死在文档里，必须由函数统一封装并测试：

```typescript
export function canNestedScrollConsumeX(el: HTMLElement, dragDeltaPx: number): boolean;
```

wheel 路径也必须经过同一套方向转换：

```typescript
export function wheelDeltaXToDragDelta(deltaX: number): number;
```

---

## 八、PageSwitch 模型

### 8.1 纯函数 API

```typescript
export interface PageSwitchDecisionOptions {
  thresholdRatio?: number;       // 默认 0.18
  velocityThreshold?: number;    // 默认 0.35 px/ms
  rubberBandRatio?: number;      // 默认 0.35
}

export function clampPage(page: number, pageCount: number): number;

export function getPageSwitchOffset(args: {
  page: number;
  pageCount: number;
  pageSize: number;
  dragDeltaPx: number;           // > 0：手指 / 鼠标向右拖
  rubberBandRatio?: number;
}): number;

export function decidePageSwitchTarget(args: {
  page: number;
  pageCount: number;
  pageSize: number;
  dragDeltaPx: number;
  velocityPxPerMs: number;
  thresholdRatio?: number;
  velocityThreshold?: number;
}): number;

export function wheelDeltaXToDragDelta(deltaX: number): number;
```

### 8.2 方向约定

- `dragDeltaPx > 0`：手指 / 鼠标往右拖，通常目标是上一页。
- `dragDeltaPx < 0`：手指 / 鼠标往左拖，通常目标是下一页。
- `wheel deltaX > 0`：触摸板内容向左滚，通常目标是下一页，因此转成 `dragDeltaPx < 0`。

所有方向转换集中在 `pageSwitchModel.ts`，业务侧不得自行判断 wheel 正负。

---

## 九、`usePageSwitchGesture`

### 9.1 Hook API

```typescript
export interface UsePageSwitchGestureOptions {
  page: number;
  pageCount: number;
  enabled?: boolean;
  owner: string;
  thresholdRatio?: number;
  velocityThreshold?: number;
  wheelSettleMs?: number;
  onPageChange: (page: number, reason: 'pointer' | 'wheel' | 'programmatic') => void;
  onClaimChange?: (claimed: boolean) => void;
}

export interface UsePageSwitchGestureResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  bind: Record<string, unknown>;
  isClaimed: boolean;
  pageSize: number;
}
```

### 9.2 实现约束

1. **DOWN 不立即 claim**  
   起手只创建 session。超过 slop 且横向占优后才 claim。

2. **claim 前检查 guard**  
   起手命中 input / slider / drag / block 时，page-switch 不参与。

3. **claim 前检查 nested scroll**  
   内层横向 scroll 仍可消费时，page-switch yield。

4. **claim 后才 preventDefault / suppress click**  
   未过 slop 的点击不受影响。

5. **跟手 transform 不走 React 高频重渲染**  
   `track.style.transform = translate3d(...)`。

6. **page 是受控输入**  
   Hook 不持久保存 page。调用方通过 URL、service state 或 React state 提供当前页。

7. **wheel 走原生 capture 监听**  
   横向 wheel 需要 `{ passive: false, capture: true }`，防浏览器 history back。

8. **latest ref 防 stale closure**  
   wheel handler 必须读最新的 page、pageCount、options、onPageChange。

9. **清理完整**  
   pointercancel、lostpointercapture、blur、unmount 都必须 release session。

### 9.3 关于 `@use-gesture/react`

第一阶段默认不强制引入 `@use-gesture/react`。  
优先用原生 Pointer Events + session 层实现最小闭环，减少依赖和调试变量。

如果后续实测发现原生实现重复处理成本过高，可以再引入 `@use-gesture/react`，但不能把协议正确性绑定在库的隐式行为上。

如果使用该库：

- 需要先把依赖加入 `package.json`，并记录引入理由。
- `pageSwitchModel` 与 `gestureGuards` 必须保持纯函数、无库依赖。
- click suppress 需要在 mobile-gym 自己的 session 层有兜底。
- velocity 方向必须通过测试确认，不可只依赖文档印象。
- wheel 仍然自接原生 listener。

若后续发现库行为和 `__SIM_INPUT__` 或浏览器环境不匹配，可只替换 `usePageSwitchGesture` 内部实现。

---

## 十、运行态可观测与导航边界

PageSwitch 第一阶段不进入 navigation declaration。

原因：

- 当前 navigation declaration 已经承担路由、UI state、action task 生成等职责。
- 横滑切页往往是 tab / pager 的另一种输入方式，强行加 schema 会显著增加脚本复杂度。
- 现阶段主要目标是解决输入归属、默认行为和跨输入一致性，不扩大导航声明边界。

PageSwitch 需要提供的是运行态可观测信息：

```html
<div
  data-page-switch
  data-gesture-role="page-switch"
  data-gesture-owner="x.home.feed-tabs"
>
  ...
</div>
```

这些标记用于：

- 组件测试定位 page-switch 区域。
- `__SIM_INPUT__` 兼容测试选择起手区域。
- 调试时确认当前 owner / role。
- 后续如有需要，再由专门工具读取运行态状态。

当横滑对应 App 内页面切换时，调用方自己决定状态更新方式：

示例：

```typescript
const { bind, trackRef } = usePageSwitchGesture({
  owner: 'x.home.feed-tabs',
  page,
  pageCount: 2,
  onPageChange: (next) => {
    go(next === 0 ? 'home.feed.forYou' : 'home.feed.following', {}, { mode: 'replace' });
  },
});
```

如果某个 App 的 tab 本来只是本地受控状态，也可以直接更新 state：

```typescript
const { bind, trackRef } = usePageSwitchGesture({
  owner: 'media.preview',
  page,
  pageCount: mediaItems.length,
  onPageChange: setPage,
});
```

注意：

- PageSwitch 不生成 `data-trigger` / `data-action`。
- PageSwitch 不修改 nav graph 生成脚本。
- PageSwitch 不要求 `build_nav_artifacts.mjs` 识别横滑边。
- 需要 bench_env 验证的横滑能力，优先通过 live / component 测试覆盖，而不是 action task 自动生成。

---

## 十一、场景接入策略

### 11.1 SystemShade

SystemShade 不能整体替换成通用 pager。

当前 SystemShade 同时承担：

- 横向切通知 / 控制中心
- 纵向上滑关闭
- slider 阻断
- 通知列表 scrollTop 判断
- click suppress
- wheel 横切

迁移策略：

1. 抽出横向切换到 `useShadePanelSwitch`。
2. `useShadePanelSwitch` 内部使用 `usePageSwitchGesture` 或 `pageSwitchModel`。
3. 上滑关闭继续保留独立纵向 recognizer，第一阶段不由 PageSwitch 接管。
4. 纵向关闭 recognizer claim 前也要查询 `gestureSession`，claim 后写入 `owner: 'system.shade-close'`。
5. 横向 wheel 必须走原生 capture listener，`{ passive: false, capture: true }`。
6. 横向 wheel 即使当前没有相邻面板，也要 `preventDefault()`，避免浏览器 history back。
7. `[data-shade-slider="true"]` 同时加 `data-gesture-role="slider"`。
8. 通知列表继续声明 `data-gesture-role="scroll-v"`。

验收：

- 左右滑仍切通知 / 控制中心。
- 上滑关闭仍可用。
- slider 正常拖动。
- 通知列表滚动时不误关闭。
- 横向 wheel 在有相邻面板和无相邻面板时都不触发浏览器 history back。
- 从 button / `[role="button"]` 起手不会触发纵向关闭；横向切页是否允许由 page-switch guard 决定。
- `__SIM_INPUT__.swipe` 可切换面板。

### 11.2 Launcher

Launcher 也不能直接套 `PagerTrack`。

Launcher 的工作区有：

- app icon tap
- 图标长按拖动
- 文件夹拖出
- 拖到边缘自动翻页
- 背景长按菜单
- 当前页记忆

迁移策略：

1. 新建 `useLauncherWorkspacePager`，内部使用 `pageSwitchModel` 和 gesture session。
2. 移除 workspace 的 `overflow-x-auto` + `scroll-snap-type`，改为 `overflow: hidden` + transform 轨道。
3. 移除以 `scrollLeft / scrollTo / onScroll` 作为分页事实源的逻辑，避免 scroll 与 transform 双路径并存。
4. 当前页只来自受控 `currentPage`；track transform 由 `currentPage` 和 `pageSize` 推导。
5. 保留 Launcher 自己的 drag handler，但 drag claim 前必须查询 `gestureSession`。
6. 图标长按拖动区域声明 `data-gesture-role="drag"`；进入拖动后 claim `owner: 'launcher.drag'`。
7. 拖动到边缘自动翻页仍由 drag handler 调 `setCurrentPage`，不得再调用 workspace `scrollTo`。
8. 拖拽命中计算需要确认在 transform 轨道下仍使用正确的屏幕坐标。
9. PageSwitch 通过受控 `page` 更新 transform。

验收：

- 鼠标 / 触摸 / `__SIM_INPUT__.swipe` 翻页路径一致。
- 图标 tap 正常打开 app。
- 图标长按拖动不触发分页。
- 图标拖到边缘自动翻页后，ghost、drop target、preview 仍与视觉位置一致。
- 背景长按菜单不被横滑逻辑吞掉。
- touchpad 横滑不触发浏览器 history back。

### 11.3 App Tab Feed

典型场景：X For you / Following、小红书顶部 Feed、视频 Tab。

接入策略：

1. 页面状态可以来自 URL、App navigation state 或局部受控 state。
2. 如果当前 tab 已经由路由表达，`onPageChange` 调 app `go()`，不直接 `useNavigate()`。
3. 如果当前 tab 是局部 UI 状态，`onPageChange` 可以直接更新受控 state。
4. 不要求 navigation declaration 增加 page-switch transition。
5. 内部横向 carousel 声明 `data-gesture-role="scroll-h"`。
6. 输入框、slider、地图、canvas 等子树明确 block 或 role。

普通 DOM 可使用 `PagerTrack`：

```tsx
<PagerTrack
  page={page}
  pageCount={pages.length}
  onPageChange={handlePageChange}
>
  {pages.map(page => <section key={page.id}>{page.node}</section>)}
</PagerTrack>
```

### 11.4 相册 / 阅读器 / 媒体预览

这些场景先不强制迁移。

接入前需要逐个判断：

- 是否已有 pinch zoom / double tap zoom。
- 是否有内层横向缩略图。
- 是否有垂直评论区。
- 当前页状态应放在 URL、service state 还是局部 state。

如果存在 pinch zoom + pager + vertical scroll 同时竞争，才考虑升级到更完整 arbitrator。

---

## 十二、`__SIM_INPUT__` 兼容

### 12.1 当前行为

`os/simInput.ts` 当前行为：

- `tap`：`touchstart → pointerdown → mousedown → focus → pointerup → mouseup → click → touchend`
- `swipe`：分步 `touchmove + pointermove`，并对发现的 scroll container 手动 `scrollBy`
- `drag`：`pointerdown` 后等待 `holdMs`，再分步移动
- 合成 pointer：`pointerType: 'touch'`，`isTrusted: false`

### 12.2 新协议要求

1. PageSwitch 必须接受非 trusted pointer 事件。
2. PageSwitch 容器迁移后不应再是横向 scroll container，避免 `simInput.swipe` 的 manual `scrollBy` 和 transform 双路径叠加。
3. 普通纵向列表仍保留原生 / manual scroll 行为。
4. `drag` 起手于 `data-gesture-role="drag"` 时，page-switch 必须 yield。
5. `tap` 未超过 slop 时不能被 suppress。

### 12.3 测试基线

每个迁移场景至少覆盖：

- `__SIM_INPUT__.tap` 点击 page-switch 内 button 正常触发。
- `__SIM_INPUT__.swipe` 从 button / 卡片 / 图标上横滑可切页。
- `__SIM_INPUT__.swipe` 纵向滑动仍滚动纵向列表。
- `__SIM_INPUT__.drag` 起手于 drag 区域不切页。
- 完整 swipe 后无残留 pointer/wheel/session 状态。

---

## 十三、浏览器默认行为控制

### 13.1 touch-action

建议：

| 场景 | touch-action |
|---|---|
| 普通纵向列表 | `pan-y` |
| 自定义横向 page-switch 容器 | 视场景用 `pan-y` 或 `none` |
| slider / drag 控件 | `none` |
| 地图 / canvas | 由组件自己声明 |

`touch-action` 不能随手写。它决定浏览器是否可能提前接管滚动并发 `pointercancel`。

### 13.2 overscroll-behavior

横向 page-switch 容器和外层 simulator 容器应考虑：

```css
overscroll-behavior-x: contain;
```

但它不是完整替代。touchpad history back 在部分浏览器仍需要 wheel `preventDefault`。

### 13.3 wheel

横向 wheel 处理规则：

1. capture 阶段监听。
2. 判断横向占优。
3. 若 nested scroll 可消费，则 yield。
4. 否则 `preventDefault()`。
5. 累计 delta，settle 后决定目标页。
6. 即使当前没有相邻页，也要阻止浏览器 history back。

---

## 十四、测试策略

### 14.1 单元测试

`pageSwitchModel`：

- 阈值翻页
- 速度翻页
- 短拖回弹
- 首页 / 末页 rubber band
- wheel 方向转换

`gestureGuards`：

- input / textarea / select / contenteditable 阻断
- slider / drag / block 阻断
- button 默认不阻断
- nested horizontal scroll 边界交接
- 旧属性兼容

`gestureSession`：

- claim 成功 / 失败
- 已有 owner 时其他 recognizer yield
- pointerup / cancel / blur 释放
- suppress click 只吞一次

### 14.2 Hook 测试

当前 `vitest.config.ts` 只包含 `tests/**/*.test.ts`，且环境是 `node`。  
因此涉及 DOM、PointerEvent、TouchEvent、ResizeObserver、elementFromPoint、scrollBy 的测试不能直接按 `.test.tsx` 写完就算完成。

第一阶段测试分两类：

1. **Node 单元测试**：纯函数和不依赖 DOM 的 session 行为，继续使用 `tests/**/*.test.ts`。
2. **DOM / browser 测试**：Hook、`__SIM_INPUT__`、真实 pointer/wheel 交互，必须新增独立配置或放到 browser/live 测试。

建议新增一种命名与配置：

```text
tests/**/*.dom.test.tsx
```

并为它配置 jsdom / happy-dom，或直接使用 Playwright 在浏览器中跑关键兼容测试。  
在配置落地前，文档中的 `.dom.test.tsx` 只能算计划项，不能算已被 `npm test` 覆盖。

`usePageSwitchGesture`：

- pointer 横滑触发 onPageChange
- 纵向占优不 claim
- 起手于 slider / drag 不 claim
- nested scroll 可消费时不 claim
- wheel 横向触发 preventDefault
- wheel settle 后切页
- edge back 区域起手时，App PageSwitch 不 claim；非边缘区域起手时，edge back 不 claim。
- pageSize 随 ResizeObserver 更新
- unmount 清理 listener/session

注意：不要把“React commit ≤ 2 次”作为硬单测。  
它可以作为手动性能验收或 profiler 指标，但不适合在 Vitest 中稳定断言。

### 14.3 simInput 兼容测试

新增：

```text
tests/simInputPageSwitchCompatibility.dom.test.tsx
```

覆盖：

- `__SIM_INPUT__.swipe` 风格 pointer 序列能驱动 page-switch。
- `__SIM_INPUT__.tap` 不被误吞。
- `__SIM_INPUT__.drag` 不误触发 page-switch。
- 纵向 swipe 不切页。
- edge back 区域横滑优先归系统手势，普通 page-switch 区域横滑归 PageSwitch。

### 14.4 手动验收

每迁移一个场景，必须手动验证：

- 触摸
- 鼠标
- 触摸板
- `__SIM_INPUT__`
- 浏览器 history back 不误触
- 既有 bench_env 任务不回归

---

## 十五、实施路线

### S0：冻结新增手写横向分页

- 新业务不要再手写横向 pointer/wheel 状态机。
- 已有实现暂不迁移，等基础设施就绪后逐个替换。

### S1：纯模型

新增：

```text
os/gestures/pageSwitchModel.ts
tests/pageSwitchModel.test.ts
```

### S2：DOM guard

新增：

```text
os/gestures/gestureGuards.ts
tests/gestureGuards.test.ts
```

### S3：Gesture session

新增：

```text
os/gestures/gestureSession.ts
tests/gestureSession.test.ts
```

### S4：usePageSwitchGesture + PagerTrack

新增：

```text
os/gestures/usePageSwitchGesture.ts
os/gestures/PagerTrack.tsx
tests/usePageSwitchGesture.dom.test.tsx
```

同时需要新增 DOM 测试配置；否则 `.dom.test.tsx` 不会被当前 `vitest.config.ts` 覆盖。

### S5：simInput 兼容基线

新增：

```text
tests/simInputPageSwitchCompatibility.dom.test.tsx
```

如果 DOM 测试配置不足以可靠模拟 `TouchEvent` / `PointerEvent` / `elementFromPoint`，该基线改放 Playwright/browser live 测试。

### S6：迁移 SystemShade 横向切换

修改：

```text
os/components/SystemShade.tsx
os/gestures/adapters/useShadePanelSwitch.ts
```

只迁移横向切通知 / 控制中心。  
上滑关闭第一阶段继续保留独立逻辑。

### S7：迁移 Launcher 工作区横向翻页

修改：

```text
os/launcher/Launcher.tsx
os/gestures/adapters/useLauncherWorkspacePager.ts
```

移除 workspace 横向 scroll-snap。  
保留 Launcher drag / folder / background long press 语义。

### S8：接入一个典型 App Tab Feed

建议优先 X 首页 For you / Following 或小红书首页 Tab Feed。

要求：

- 根据现有页面状态来源选择 URL / app navigation state / 局部 state。
- 若页面本来由路由驱动，通过 app `go()` 更新 URL / app navigation state。
- 不要求修改 navigation declaration 或 nav artifact 生成脚本。
- 增加最小 live / component 覆盖，验证 `__SIM_INPUT__.swipe` 可切页。

---

## 十六、风险与取舍

### 16.1 比原 Pager 方案更复杂

新增了 `gestureSession`，概念上比单个 hook 多一层。

取舍理由：

- 原方案会把 SystemShade / Launcher 的复杂语义压进 pager，后续补丁更多。
- session 层很薄，只管 owner，不管业务行为。

### 16.2 不做完整 arbitrator 可能仍有边界

如果后续出现：

- pager + long press drag + pinch zoom 同时竞争
- system edge back 必须和 App pager 在同一 pointer 序列内切换
- 需要全局手势遥测

则需要升级 `gestureArbitrator.ts`。

第一阶段不做，是为了避免过早抽象。

### 16.3 原生 scroll-snap 被替换后手感变化

Launcher 去掉 scroll-snap 后，需要调阈值和动画曲线。

缓解：

- `thresholdRatio` / `velocityThreshold` 暴露给 adapter。
- 先迁移 SystemShade，再迁移 Launcher。
- 保留手动验收。

### 16.4 `@use-gesture/react` 可选依赖风险

第一阶段默认不引入。若后续决定引入，不能让协议依赖它。

缓解：

- 引入前必须说明原生 Pointer Events 实现无法覆盖的具体问题。
- 纯模型和 guard 与库无关。
- click suppress 和 session cleanup 自己兜底。
- 后续可替换 hook 内部实现。

---

## 十七、成功标准

完成后应满足：

1. 同一 pointer / wheel 序列最多只有一个 owner。
2. PageSwitch 可复用于 SystemShade、Launcher、至少一个 App Tab Feed。
3. SystemShade 上滑关闭、slider、通知列表滚动不回归。
4. Launcher app tap、长按拖动、边缘翻页、背景长按不回归。
5. touchpad 横滑不触发浏览器 history back。
6. `__SIM_INPUT__.tap/swipe/drag` 与迁移后的页面兼容。
7. App 级横滑切 tab 有稳定 owner / role 标记，并有测试覆盖。
8. 高频 move / wheel 不触发 React 高频重渲染。
9. 新增横向切页场景时，不再复制 pointer/wheel 状态机。

---

## 十八、与原方案的差异

| 维度 | 原 Pager 方案 | 新 Gesture Ownership + PageSwitch 方案 |
|---|---|---|
| 根抽象 | Pager hook | Gesture owner/session |
| PageSwitch | 根能力 | 第一个 recognizer |
| SystemShade | 用 pager 替换横纵混合状态机 | 只迁移横向切换，保留纵向关闭 |
| Launcher | 直接接 pager | 单独 adapter，保留桌面语义 |
| nested scroll | 静态 block 为主 | 方向 + 边界动态 handoff |
| click suppress | 依赖 hook / 库 | session 层兜底 |
| navigation declaration | 尝试闭环 | 第一阶段不接入，避免扩大导航声明复杂度 |
| 未来升级 | 加 arbitrator | session 可平滑升级 arbitrator |

---

## 十九、推荐结论

不要实施原来的“统一 Pager Gesture Protocol”。

推荐实施：

```text
Gesture Ownership 协议
  + PageSwitch 横向切页模型
  + SystemShade / Launcher 场景 adapter
  + 运行态 owner / role / 测试标记
```

这样解决的是根问题：**输入序列归属、默认行为控制、嵌套交接、运行态可诊断**。  
横向分页只是第一个收益场景，而不是把所有复杂手势都塞进 pager。
