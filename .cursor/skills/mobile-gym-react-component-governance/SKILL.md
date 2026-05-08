---
name: mobile-gym-react-component-governance
description: 治理 mobile-gym 中 React 组件、页面、hooks、provider 与 component API 的结构质量。用于编写、评审或重构 `apps/`、`system/`、`os/` 下的 React 代码，尤其适合组件 boolean prop 过多、页面过大、派生 state 到处复制、内联子组件、事件与副作用纠缠、状态提升混乱，或需要拆组件但保持行为的场景。只要用户说“拆这个组件”“整理这个页面”“让这段 React 代码别这么乱”，也应优先使用这个 skill。
---

# Mobile Gym React 组件治理

这个 skill 把 Vercel 的 React best practices 和 composition patterns，改写成适合 mobile-gym 的 React + Vite + TypeScript 工作流。重点不是“写得更花”，而是让组件 API、状态归属、渲染逻辑和交互边界都更稳定。

## Quick Start

先判断本次问题属于哪一类：

1. 组件 API 设计问题
2. state source of truth 不清
3. effect / event 边界错乱
4. 列表或复杂 UI 渲染成本过高
5. 页面职责和仓库边界混在一起

如果同时涉及路由、state shape、bench_env 或数据分层，联动使用：

- `mobile-gym-feature-design`
- `mobile-gym-boundary-guard`
- `mobile-gym-refactor-rescue`
- `mobile-gym-review-gate`

## 按优先级治理

| 优先级 | 类别 | 关注点 |
|---|---|---|
| P0 | 状态归属与派生 | source of truth、派生 state、URL 状态 |
| P1 | 组件 API 与组合方式 | boolean props、variant、compound components |
| P2 | 事件与副作用卫生 | effect 滥用、函数稳定性、临时值 |
| P3 | 渲染与列表成本 | 大列表、重复计算、无意义 memo |
| P4 | 仓库特有 UI 契约 | 导航、键盘、手势、布局约束 |

## 1. 状态归属与派生

优先级最高，先修这个。

- 一个业务事实只保留一个 source of truth
- 能在 render 中直接派生的值，不要为了“同步”写进 local state
- 不要为了跟 props 保持一致而镜像一份本地 state，除非明确需要脱钩编辑态
- 如果状态应该可回退、可观察、可被导航图理解，就放进路由或 `navigation.declaration.ts`
- 不要在 Zustand actions 里增加 `isLiked`、`getXxxById`、`hasUnread` 这类查询型 getter
- provider / store 负责状态实现细节，组件消费稳定接口，不反向知道太多存储细节

## 2. 组件 API 与组合方式

组件一乱，后面所有页面都会跟着乱。

- 避免 boolean prop 膨胀；多个模式优先拆成显式 variant 组件
- 复杂组件优先用组合而不是继续往单组件上堆开关
- 多个子部件共享状态时，优先考虑 compound components 或 provider
- 能用 `children` 组合表达的，不要先发明 `renderXxx` 或一组定制 prop
- 页面壳层、区块组件、叶子组件分层清楚，不要一个页面同时承担所有职责

## 3. 事件与副作用卫生

- 交互逻辑能放事件处理函数里，就不要绕到 `useEffect`
- 依赖旧 state 的更新，优先使用函数式 `setState`
- 高频但不驱动渲染的临时值，放 `ref`，不要硬塞 state
- 不要在组件内部定义内联子组件
- 不要重复注册全局 listener；确实需要时，收敛到单一位置并明确清理

## 4. 渲染与列表成本

- 重复 membership lookup、ID 匹配、过滤逻辑，优先改成 `Set` / `Map`
- 静态结构、映射表、常量配置尽量移出 render
- 大列表里避免每次 render 都重新做昂贵 `map/filter/format`
- 不要为了简单表达式滥用 `useMemo`
- 真正昂贵且 props 稳定的子树才考虑 memo 化
- 当 JS 依赖元素高度做像素计算时，使用精确 px 或 CSS 变量，不要混用会漂移的 rem 高度

## 5. 仓库特有 UI 契约

这些规则和普通 React 项目不一样，必须单独记住：

- 顶层页面预留 `pt-10`
- 业务页面使用 app 自己的 `go()` / `back()`，不要直接 `useNavigate()`
- 键盘贴底 UI 不要用 `position: fixed`
- 键盘弹出时应隐藏的元素使用 `data-hide-on-keyboard`
- 真正可交互控件才绑定 gesture tags
- UI state、route、modal、tab 切换要和 `navigation.declaration.ts` 对齐

## 常见救援配方

### 巨型页面拆分

优先拆成：

1. route shell
2. section 级展示组件
3. domain helpers
4. interaction hook 或 handlers 区

先拆纯展示和纯逻辑，再动状态归属。

### Boolean Props 救援

当组件开始出现 `isCompact`、`isDense`、`isEditable`、`isModal`、`showHeader` 一串开关时：

1. 先确认是否其实是多个 variant
2. 能拆显式组件就拆
3. 共享逻辑抽 helpers，不要继续堆条件分支

### 派生 State 救援

当出现 “先从 store/props 算出一个值，再塞进 state 供渲染使用” 时：

1. 确认是否能直接 render 时派生
2. 确认是否只是为了 effect 同步而复制状态
3. 只保留真正需要被用户编辑或延迟提交的本地 state

### 数据层混乱救援

当组件里开始出现默认值、结构配置和运行时逻辑混在一起时：

1. 静态结构移回 `constants.ts`
2. 可替换默认数据移回 `data/defaults.json`
3. 运行时逻辑和临时状态移回 `state.ts`

## 红旗信号

- 一个组件有太多 boolean props
- `useEffect` 只是为了同步派生值
- 页面里直接定义多个内联子组件
- 一个组件既拿数据、又定义结构、又做大量格式化、又管所有交互
- 同一规则在多个按钮 / 分支中重复判断
- 组件为了解决局部问题，开始新增第二份 state source of truth

## 验证

- 触及导航、tab、modal、UI state：运行 `node scripts/build_nav_artifacts.mjs <AppName>`
- 大型跨文件 props / 类型 / state 结构改动：运行 `npx tsc --noEmit`
- 运行时代码改动：运行 `npm run lint` 或等价范围检查
- 小范围组件治理：至少手动走通受影响交互并检查 IDE 诊断

不要在这个仓库里运行 `npm run build`。
