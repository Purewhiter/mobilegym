# Lessons

本文件记录在 mobile-gym 项目开发过程中总结的**方法论级规则**，帮助避免重复犯错。

**写入规范**：

- 只记录可泛化的方法论，不记录特定 bug 的修复细节（除非它特别重要)
- 每条规则应足够通用，适用于未来类似场景
- 如果某条经验无法从已有规则推导出来且足够重要，才值得单独记录

---

## 1. Ground truth 来源必须独立于 Agent 行为

- Ground truth 必须来自 **Agent 操作前就确定的数据**，包括：
  - 离线文件（`places.json`、`routes.json`）→ 通常通过类方法/静态方法访问
  - App 状态快照中的预置数据（小红书帖子、联系人列表等）→ 通过实例方法访问
- **禁止**从 Agent 操作产生的状态变化中提取 ground truth（如地图的 `active_poi`、`search_results`）——Agent 没操作或操作错误时 judge 会跟着出错。
- Agent 操作产生的状态只能用于验证 **Agent 是否执行了某操作**（如 `check_searched`）。

## 2. 离线数据中同名实体可能不唯一

- `PLACE_QUERY_ALIASES` 的存在说明同一个查询可能匹配多个 POI（如"故宫"→"故宫博物院"或"故宫"，地址不同）。
- 凡是从离线数据解析地点的地方，**必须用 `Map.resolve_places()` 处理多候选**，不能假设"取第一个就行"。

## 3. 多候选判定统一用 `check_alternatives`

- `check_alternatives(*check_arrays)` 是唯一正确的多候选判定模式：
  - 单 check：`check_alternatives([check(p) for p in places])`
  - 多 check 关联：`check_alternatives([addr_check(p) for p in places], [weather_check(p) for p in places])`
- 不要手动构建 `check_sets` 列表再调辅助函数。

## 4. Judge 的 expected value 必须对齐 Agent 的观测

- Judge 比对的 ground truth 必须与 **Agent 在前端实际看到的内容** 一致，而非原始数据。原始数据可能含有前端不展示的信息（邮编、内部 ID、Plus Code 等），直接用于子串匹配会失败。
- 数据提取方法（如 `extract_*`）应**封装对齐逻辑**（格式化、清洗），作为 Judge 获取 expected value 的唯一入口，调用方不应重复处理。

## 5. 工具函数设计原则

- 优先设计**一个函数覆盖所有场景**，而非为特殊情况单独设计函数。
  - 例：`check_alternatives` 一个函数同时处理单 check 和多 check 关联，而不是拆成 `check_with_alternatives` + `check_aligned_alternatives`。
- 命名要简洁，不要把实现细节放进名字（"aligned" → 删掉）。

## 6. 任务模板必须语义单一、无歧义

- 模板是给 Agent 的指令，**一个模板只表达一种意图**。禁止在同一模板中同时覆盖互斥的分支（如"还差多少或还剩多少"）——Agent 无法确定该做什么。
- 如果业务上需要测试多个分支，用 `_post_sample` 注入状态把某些分支锁定，让模板只需表达一种自然意图。
- 模板措辞应像用户真实口语，不要刻意指导 Agent 该怎么写（"记下 X、Y 和 Z"比"记下 X 和 Y 的差值"更自然）。

## 7. 通用判定逻辑封装到 App helper，保持最小职责

- 跨任务复用的判定模式（如"余额够不够支付某金额"）属于 App 的领域概念，应封装为 App 的 `check_*` 方法，而非在每个 task 的 `check_goals` 中内联重复。
- `check_*` 方法应保持**最小职责**：只检查核心判定（如二元的"够/不够"），不要把任务特定的额外要求（如"说出差额"）糅进去。任务如果需要额外检查，在 `check_goals` 中单独追加。
