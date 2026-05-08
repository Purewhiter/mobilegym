---
name: mobile-gym-review-gate
description: 审查 mobile-gym 变更的正确性、架构、导航一致性、状态/数据边界、benchmark 兼容性与验证证据。用于合并前、自查重构后，或用户明确要求 review / audit / 检查风险 / 挑问题 / 看看有没有坑 的场景。哪怕用户只说“帮我过一遍”或“你看看这改动行不行”，也优先使用这个 skill。
---

# Mobile Gym 评审闸门

实现后或 review 时使用。先给问题，再给总结。目标不是夸代码“差不多能用”，而是抓住这个仓库里最容易漏掉的 bug、契约破坏和结构性回归。

## Quick Start

评审时按这个顺序：

1. 先还原改动意图
2. 先找阻断问题，再看重要问题
3. 重点查导航、state shape、数据分层、验证证据
4. 最后才写摘要，不要先下“看起来没问题”的结论

## 优先级说明

- `阻断`：会导致行为错误、契约破坏、产物失真、bench 失效、导航不一致
- `重要`：短期可运行，但结构、边界或验证不足，不能放心继续叠功能
- `建议`：明确非阻塞，但能降低复杂度或后续维护成本

## 1. 先还原本次改动意图

评审前先回答：

- 这次行为上到底想改什么
- 触碰了哪些 App、OS 或 benchmark 契约
- 是否影响导航、设置/state shape、资源层或生成产物

如果意图本身不清楚，就明确写出不确定点，不要假装 review 已经完成。

## 2. 用仓库特化维度来审查

按下面几个维度检查所有受影响区域：

### 正确性

- 行为是否真的符合任务目标
- 边界条件、回退路径、异常路径是否处理了
- 如果是修 bug，是否有防回归的证据

### 导航与手势一致性

- 新路由是否同时声明在 `navigation.declaration.ts` 并注册到 `<AppName>App.tsx`
- tab、modal、drawer、subpage 是否用了正确的导航模式
- 返回与关闭是否统一走 `system.back`
- 必要的 `data-trigger`、`data-action`、scroll container 声明是否齐全

### 状态、数据与 benchmark 契约

- 用户可编辑或 bench 可替换的默认值是否仍在 `data/defaults.json`
- `settings` 或 state 嵌套是否被改坏，导致 `bench_env` 路径失效
- 是否引入了被禁止的 Zustand getter action 或函数订阅模式
- localStorage key 是否仍与 `manifest.id` 一致

### 架构与简洁性

- 是否沿用了现有模式，而不是无必要地发明新模式
- 是否混入了不相关清理、额外抽象或 scope creep
- 代码是否被放到了正确层，而不是“能跑就塞进去”

### 平台与 UI 约束

- 是否避开了禁用 API，如 `Date.now`、`new Date`、原始 geolocation、不合规网络调用
- 键盘场景是否仍符合 `adjustResize` 与非 fixed 底栏约束
- 图标与资源规则是否仍然正确，如 `Ic*`、`res/icons.tsx`、仅在必要时抽 `dimens`

### 验证证据

- 这类改动是否执行了对应层级的验证
- 如果改了导航，是否运行 `node scripts/build_nav_artifacts.mjs <AppName>`
- 如果改动很广，是否考虑 `npx tsc --noEmit`
- 运行时代码的 lint、手动验证是否足够

## 3. 用明确等级给出发现

使用这套严重级别：

1. `阻断`：用户可见 bug、契约破坏、缺失必需产物重建、外部状态路径失效、会造成回归的规则违规
2. `重要`：应在信任这次改动前修掉的边界、可维护性或验证缺口
3. `建议`：明确非阻塞的简化建议或清理建议

不要把纯样式 nitpick 塞进主要结论。

## 4. 遵循仓库的 review 输出方式

对用户汇报时：

1. 先列发现，按严重级别排序
2. 引用具体文件或符号
3. 发现之后再写开放问题或前提假设
4. 变更总结保持简短，放在次要位置

如果没有发现，也要明确写“未发现阻断问题”，并补充残余风险或测试缺口。

## 5. 特别警惕这些隐藏回归

重点搜这些问题：

- 代码里有 route，但 `navigation.declaration.ts` 没有，或反过来
- 应该进 URL 的 UI 状态还留在组件本地 state
- 默认值被从 `defaults.json` 搬进了 TS 文件
- 结构性数据误塞进 `defaults.json`
- 新增 store getter action，导致订阅冻结
- 原始时间 API
- `position: fixed` 造成键盘遮挡
- 真正可交互控件缺少手势标签
- benchmark 可见路径变化，但 `bench_env` 没同步更新

## 6. 最后给出信任结论

结尾只给一个清晰结论：

- 可以信任
- 修完再信任
- 缺少上下文，暂时无法信任
