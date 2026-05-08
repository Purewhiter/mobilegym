---
name: mobile-gym-feature-design
description: 面向 mobile-gym 的多文件变更设计与分步实施技能。用于新增功能、跨文件修改、导航或状态契约调整、app/OS 边界变化、bench_env 兼容性修改，或任何“先别急着改，先想清楚”的场景。只要用户提到规划、拆步骤、设计方案、影响范围、验收条件、导航调整、状态结构变化，哪怕没有明确说“做设计”，也优先使用这个 skill。
---

# Mobile Gym 变更设计

在写代码前先用这个 skill。它把公开 skill 里的 spec-first、interface-design、incremental-implementation 思路，收敛成适合 mobile-gym 的工作流。

## 0. 什么时候优先触发

出现这些信号时，默认先走本 skill：

- “先帮我看看怎么改”
- “这个改动会不会影响很多地方”
- “这个页面/状态/导航要不要重构一下”
- “帮我拆步骤”
- “先规划，不要直接写代码”
- “这个 bench_env / route / state shape 要一起改”

如果用户的核心诉求是“保行为清理脏代码”，优先改用 `mobile-gym-refactor-rescue`。如果已经在实现阶段，只是不确定代码该落在哪一层，同时启用 `mobile-gym-boundary-guard`。

## Quick Start

先完成这 4 步，再开始编辑：

1. 列出受影响区域
2. 只读与本次改动有关的规范
3. 把需求改写成验收条件
4. 选择最小可落地切片与验证方式

## 1. 先判断改动类型

动手前先列出受影响区域：

- `os/`
- `apps/<App>/` 或 `system/<App>/`
- `navigation.declaration.ts` / `navigation.ts`
- `state.ts` / `data/*` / `constants.ts`
- `res/*` / `manifest.ts`
- `bench_env/`
- `public/*nav_graph*.json` 与 action task 产物

只要同时动到多个区域，就先做设计，再做实现。

## 2. 按需回看权威规则

只读和本次改动直接相关的规范：

- 导航或 OS 生命周期：`CLAUDE.md`、`docs/specs/PROJECT_SPEC_V2.md`
- 状态、设置、数据分层：`CLAUDE.md`、`docs/specs/APP_STATE_DATA_SPEC.md`
- 资源、图标、尺寸、字符串：`CLAUDE.md`、`docs/specs/APP_DESIGN_SPEC.md`
- App 具体实现：目标 App 的 `manifest.ts`、`<AppName>App.tsx`、`navigation.declaration.ts`、`navigation.ts`、`state.ts`、`data/index.ts`、`data/defaults.json`

只要这次改动会碰契约或文件职责，就不要只靠记忆。

## 3. 先把需求改写成验收条件

编辑前先写出这四段：

```markdown
目标:
- ...

受影响边界:
- ...

不允许破坏的约束:
- ...

验证方式:
- ...
```

必须点名所有受影响的路由、状态路径，以及 bench 可见的数据契约。

## 4. 套用仓库硬约束

- 导航：所有页面与离散 UI 状态都写进 `navigation.declaration.ts`；业务页面只能用 app 自己的 `go()` / `back()`，不能直接 `useNavigate()`
- UI 状态：tab / subtab 用 replace 型路由切换；modal / drawer 用 push，靠 back 关闭
- 数据分层：静态结构进 `constants.ts`；可替换默认数据进 `data/defaults.json`；运行时逻辑与临时状态进 `state.ts`
- Store 设计：不要新增 `isLiked()`、`getXxxById()` 这类查询型 Zustand action；组件订阅数据后本地派生
- 时间、定位、网络：使用 `TimeService`、`LocationService`、`NetworkService`；不要引入被仓库禁止的浏览器 API
- 资源：`lucide-react` 只能在 `res/icons.tsx` 导入；图标统一用 `Ic*`；如果 JS 依赖精确高度，用 CSS 变量或精确 px
- 基准兼容性：把 `settings` 和状态 shape 视作外部契约；不要随意改嵌套路径，也不要把 bench 需要替换的数据移出 `defaults.json`

## 5. 选择最小可落地切片

优先按这个顺序切片：

1. 契约或声明
2. 数据与状态
3. UI 接线
4. 产物重建
5. `bench_env` 同步

不要把无关清理混进本次切片。看见相邻技术债，只记录，不顺手乱修。

## 6. 选择合适的验证深度

- 改了导航声明：运行 `node scripts/build_nav_artifacts.mjs <AppName>`
- 改动跨文件且改了类型或结构：运行 `npx tsc --noEmit`
- 改了运行时代码：运行 `npm run lint` 或更小范围的等价检查
- 小改动：至少检查 IDE 诊断并手动走通受影响流程

这个仓库里不要运行 `npm run build`。

## 7. 用“设计说明”收尾再开改

正式编辑前，先简短总结：

- 这次选的最小切片是什么
- 为什么它是最安全的切片
- 哪些内容明确不在本次范围内
- 完成后需要补哪些产物或文档
