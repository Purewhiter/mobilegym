# UI 转移图构建方案

## 概述

当前仓库的主链路已经切换为：**声明式导航（NavigationDeclaration）→ UI 图生成（schema/data）**。

核心目标是让 UI 图**可静态生成、可视化、可用于 Agent/测试**，并且让“图”与“声明/源码触发点”保持一致。

## 当前方案架构（v0.6+）

```
NavigationDeclaration (+ 可选 ConfigData)
            │
            ▼
scripts/navigation_declaration_analyzer.mjs
   │                 │
   │ schema          │ data (--data)
   ▼                 ▼
nav_graph.json            data_graph.json
nav_graph_simplified.json
            │
            ▼
public/nav_graph_viewer.html（可视化/核对）
```

相关规范/细节：
- 导航声明语义：`docs/NAVIGATION_DECLARATION_PROPOSAL.md`
- dataSource/条件：`docs/DATA_SOURCE_PROPOSAL.md`
- 生成算法与输出字段：`docs/UI_GRAPH_GENERATION.md`

## 输出文件（以 WechatReading 为例）

- schema（不带数据）：
  - `public/wechatreading_nav_graph.json`
  - `public/wechatreading_nav_graph_simplified.json`
- data（带数据快照）：
  - `public/wechatreading_data_graph.json`

## 图的数据结构（与当前 analyzer 输出一致）

节点（Node）关键字段：
- **`id`**：`pathname + 离散 query`；data-mode 下也可能是具体值（如 `/book/123`）
- **`routePath`**：所属 pathname 模板（如 `/book/:bookId`）
- **`uiStateId`**：`uiStates[].id`
- **`search`**：离散 query（已归一化）
- **`boundParams`**（data-mode 可选）：具体参数绑定（如 `{ bookId: "123" }`）
- **`stateCondition`**（可选）：节点存在条件（v0.5+；v0.8 支持组合条件/参数对比）
- **`actions`**（可选）：节点上的原地动作清单（来自 `uiStates[].actions`）

> [!NOTE]
> `uiStates[].localStates` 属于“本地子状态语义”，不进入 URL，也不会生成图节点；当前仅用于文档/训练语义标注。

边（Edge）关键字段：
- **`source/target`**：节点 id
- **`id`**：transition id
- **`type`**：`navigation` / `state`
- **`fromConstraint`**：对象形式的 from（若有）
- **`expandedFrom`**：展开来源（`wildcard`/`searchParams`）
- **`uiCondition`**（可选）：入口显示条件（来自 `transition.ui.condition`；v0.8 支持组合条件/参数对比）
- **`uiMeta`**（可选）：入口 UI 元信息（placement/icon/gesture，用于 viewer 展示）
- **`when`**（可选）：`cases` 分支条件（来自 `CaseDeclaration.when`）
- **`availability` / `availabilityNote`**（可选）：边可用性语义（如 `requires_prior_visit`，用于标注“依赖访问记忆”的恢复入口；viewer 会用紫色虚线展示）

## 动态参数与 data-mode 展开

- schema 模式只表达“**可能性**”：动态参数保持模板，不枚举无限集合。
- data 模式表达“**在给定 ConfigData 快照下的实例化**”：
  - 通过 `dataSource`、参数继承与参数化 `ref` 展开出有限个具体节点/边（并产生 `boundParams`）。

## 一致性校验（推荐作为日常手段）

除生成图之外，建议在迁移/改声明时跑一次静态一致性校验：

```bash
node scripts/check_navigation_declaration_consistency.mjs <App>
```

它用于发现“声明与源码触发点不同步”（缺失 transition、from 过宽、交互手势不一致等）。

## 附录：历史方案（未作为当前主链路）

本文档旧版本描述的“静态分析（`gen_ui_graph.py`）+ Puppeteer 动态探索”属于历史探索方向：
- 可作为补充验证/未来扩展
- 但不再是当前 UI 图生成的主入口与规范来源
