# 特殊情况备忘录：运行时导航状态（Runtime Nav State）

这份文件是**给后续继续做导航声明/图生成的人看的备忘录**，用于记录一些“看起来像 condition，但其实不是”的交互模式，避免之后设计/实现时走弯路。

## 通用原则（先写在前面，防止混淆）

- **data-mode（带 `--data`）只读取数据配置文件导出的 ConfigData 快照**。
  - 运行时状态（localStorage、React state、用户操作后的内存数据）不参与 `ref` / `dataSource` / `stateCondition` / `ui.condition` 的求值。
- 因此，data-mode 下的“是否存在/是否显示”只是在 ConfigData 上做判断，**不是对真实运行时的全量模拟**。

## Case 1：Audiobooks（有声书）底部 Tab 会“记住上次子页面”

### 现象（产品行为）
- `/audiobooks` 有两个子页：`sub=audio`（有声书）与 `sub=community`（书友）。
- 你在 `/audiobooks?sub=community` 时，底部 Tab 显示为“书友”，切到 `/me` 后再点底部“书友”，会回到 `/audiobooks?sub=community`。

### 本质（结论）
- 这是 **入口携带运行时参数（trigger params）** 的“目标选择”，不是“数据条件决定是否显示入口”。
- 用 `condition` 强行描述会把两类语义混在一起：
  - “入口是否存在/是否可用”（data-driven）
  - “入口跳到哪一个子页”（runtime-driven）

### 当前声明的表达（已足够表达 *可能性*）
- `/audiobooks` 用 `uiStates` 枚举 `sub=audio/community`
- `tab.audiobooks` / `audiobooks.tab.switch` 用 `searchParams.sub` 表示“值运行时传入”
- schema 图里会展开成多条边（指向所有可能 `uiState`）

### TODO（如果未来要表达得更精确）
- 方案 A：给图的 edge 增加一个**独立于 condition 的字段**，记录 trigger params 的“约束/示例”（例如 `{ sub: 'community' }`），让图能解释“为什么走这条边”。
- 方案 B：用 `cases` 把 `sub` 的分支显式化（得到“显式分支边”）。
- 方案 C：如果一定要 data-mode 里可判定，需要把“lastSubTab”**显式建模进 ConfigData**（接受：这是快照式抽象，不是运行时真值）。

