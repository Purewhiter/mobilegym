---
name: mobile-gym-boundary-guard
description: 保护 mobile-gym 的文件职责与跨层契约。用于修改 app 架构、导航、状态、数据、资源、OS 服务调用或 bench 可见结构时，尤其适合“这段代码/这份数据到底该放哪”“这个状态该不该进路由”“默认值为什么越写越乱”这类场景。只要任务包含归位、拆层、职责澄清、state/data/constants 划分，就优先使用这个 skill。
---

# Mobile Gym 边界守卫

实现或评审时，只要一个值、一个状态字段、一个 UI 行为可能被放进多个文件，就启用这个 skill。目标是阻止“先能跑再说”的改法持续腐蚀仓库结构。

## Quick Start

先回答这 3 个问题：

1. 这是结构、默认数据，还是运行时状态
2. 这是可回退的导航/UI 状态，还是纯渲染细节
3. 这次修改会不会影响 `bench_env`、localStorage 或导航产物

如果答案不明确，不要先写代码，先做边界决策。

## 高优先级红线

看到这些情况，优先修正，不要继续叠逻辑：

- 默认值硬编码进 `state.ts`、`types.ts`、`data/index.ts`
- 可导航的 UI 状态只存在于 React 本地 state
- `defaults.json` 和 `constants.ts` 职责互相侵蚀
- 查询型 Zustand getter action 开始蔓延
- 禁用 API 混入运行时代码
- 改了 state shape 或 settings 路径，却没想到 `bench_env`

## 1. 写代码前先决定归属

使用这张文件职责表：

- `manifest.ts`：App 身份、别名、Tier-1 主题色、intent filters
- `<AppName>App.tsx`：路由注册、App 壳层组合、`useAppNavigationHandler`
- `navigation.declaration.ts`：路由清单、状态转移、UI states、scroll containers、静态分析真源
- `navigation.ts`：类型化的 `go()` / `back()` 与路由辅助函数
- `constants.ts`：tabs、服务目录、布局配置、feature flags 等不可变结构
- `data/defaults.json`：可替换初始用户数据、设置默认值、历史记录、余额、帖子、聊天、账单
- `data/index.ts`：合并并导出配置，但不要把用户默认数据偷偷塞进这里
- `state.ts`：运行时 store、actions、派生运行时状态、临时 UI 状态
- `res/icons.tsx`：App 内唯一允许从 `lucide-react` 导入的文件
- `res/colors.ts` / `res/dimens.ts` / `res/strings.ts`：真正需要复用的资源
- `pages/` 与 `components/`：渲染行为，不拥有数据契约
- `bench_env/`：任务定义、判定逻辑、外部状态路径消费者

## 2. 按顺序做边界判断

按下面顺序提问：

1. 用户能改，或者 `bench_env` 需要替换吗？放 `data/defaults.json`
2. 这是用户不能改的 App 固有结构吗？放 `constants.ts`
3. 这是运行时或派生逻辑吗？放 `state.ts`
4. 这是 route、modal state、tab state、transition 吗？放 `navigation.declaration.ts`
5. 这是可复用视觉资源吗？放 `res/*`
6. 只是页面渲染逻辑吗？留在 `pages/` 或 `components/`

如果仍然模糊，先写一段简短的“边界决策说明”，把规则说清楚再改。

## 3. 守住仓库最常见的坏味道

- 不要把可替换默认值硬编码进 `state.ts`、`types.ts`、`data/index.ts`
- 不要把带 `icon` / `color` / `label` 的结构性目录塞进 `defaults.json`
- 不要在 JSON 或配置里写原始 Lucide 图标名；统一用 `Ic*`
- 不要往 Zustand actions 里加 `isFollowing`、`getXxxById`、`hasUnread` 这类查询型 getter
- 不要使用 `Date.now()` 或任何 `new Date(...)`；统一走 `TimeService`
- 不要使用 `navigator.geolocation`；统一走 `LocationService`
- 不要在该用 `NetworkService` 的地方直接发原始网络请求
- 不要把“应该可回退/可观测”的 UI 状态只放在 React 本地 state 里
- 不要在绑定点使用动态拼接的 transition ID 或 route ID

## 4. 执行导航与 UI 契约

- 每个新路径都同时注册到 `navigation.declaration.ts` 和 `<AppName>App.tsx` 的 `<Routes>`
- 业务页面使用 `navigation.ts` 里的 `go()` / `back()`，不要直接调 router
- 返回和关闭操作统一绑定 `system.back`
- 只给真正可交互控件打 `data-trigger` / `data-action`
- 页面真的可滚动时，才声明 scroll container
- 页面顶部预留 `pt-10`
- 聊天页和键盘贴底页避免 `position: fixed` 底栏，优先 flex + `adjustResize`
- 键盘弹出时应隐藏的元素，使用 `data-hide-on-keyboard`

## 5. 保护 bench 可见契约

- 把 `state.ts` 的 shape 和 `settings` 的嵌套层级视为 `bench_env` 外部 API
- 保持 `defaults.json` 结构与设置页路由层级一致
- 保持 localStorage key 与 `manifest.id` 一致
- 如果必须改契约，就在同一任务里同步更新 `bench_env` 逻辑与验证产物

## 6. 最后做边界完整性检查

- 改了导航：运行 `node scripts/build_nav_artifacts.mjs <AppName>`
- 大型共享类型或状态结构改动：运行 `npx tsc --noEmit`
- 改了运行时代码：跑 lint 或更小范围诊断
- 结束前逐项确认：每个新增或修改的值是否真的落在了正确层
