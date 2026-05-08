# todos 文档问题汇总（GPT 整理版）

> 生成时间：2026-03-04  
> 目标：基于仓库 `todos/` 目录内**全部文档** + 根目录 `TODO.md`，把出现过的“问题/缺失/改进点”做**去重合并**，并按当前仓库代码现状标注：**已解决 / 部分解决 / 未解决 / 不再适用**。  
> 注：涉及疑似密钥/令牌的内容**只做位置引用，不在本文复述原文**（避免二次扩散）。

---

## 分析范围（已覆盖的源文档）

- `TODO.md`
- `todos/00-综合报告索引.md`
- `todos/01-系统架构分析.md`
- `todos/02-性能分析.md`
- `todos/03-代码质量与完善度.md`
- `todos/04-设计理念分析.md`
- `todos/05-基准测试环境分析.md`
- `todos/06-Android系统对比.md`
- `todos/PROJECT_ANALYSIS_REPORT.md`
- `todos/UNIFIED_ANALYSIS_REPORT.md`
- `todos/mobile-gym-project-review-2026-02-25.md`
- `todos/analysis_report1.md`
- `todos/analysis_report2.md`
- `todos/ISSUE_STATUS_REPORT.md`

---

## 快速结论（以“问题条目”为单位）

### 明确仍未解决（已做代码核验）

- **密钥/令牌泄露风险仍在**：`os/data/osConfig.ts` 仍存在硬编码 `sk-...` 形态字符串；且仓库根目录存在 `.env`，但 `.gitignore` 未忽略它（详见“P0-安全”）。
- **AutoGLM 解析失败当作完成仍在**：`bench_env/agent/autoglm.py` 仍存在返回 `{"_finish": True, ...}` 的路径。

### 已解决（2026-03-05 与代码/ todos-opus 对齐后更新）

- **AnswerTask 数值匹配假阳性**：`bench_env/task/common_tasks.py` 已改用 `_NUM_PATTERN`（数字边界）+ `_match_numeric()`（小数与浮点容差），不再使用 `re.findall(r'\d+', ...)`。本文由 ❌ 改为 ✅。

### 文档结论存在冲突，已以代码现状为准纠偏

- **Recents “重复渲染 App 两棵 React 树”**：旧文档与 `ISSUE_STATUS_REPORT.md` 中仍提到该问题，但当前 `os/SystemShell.tsx` 已改为 **Activity 容器单份渲染 + Recents 槽位重定位**（没有在 Recents 内再渲染第二棵树）。因此本文将其标为 **已解决（以代码为准）**，并在条目中说明冲突来源。
- **OSContext Provider value 未 memo**：`ISSUE_STATUS_REPORT.md` 曾标注 OSContext 仍未 `useMemo`，但当前 `os/OSContext.tsx` 已存在 `contextValue = useMemo(...)`，因此标为 **已解决（以代码为准）**。

---

## 全量索引（对齐 `todos/ISSUE_STATUS_REPORT.md` 的全部编号）

> 用途：保证“todos 文档里出现过的核心问题”**一个不漏**。  
> 备注：此处是索引表；更详细的背景/证据/冲突纠偏见下文对应章节（或直接回看 `todos/ISSUE_STATUS_REPORT.md` 的原表格）。

| 编号（原文） | 问题（简写） | 本文状态 | 备注 |
|---|---|---|---|
| 1 | Calendar 返回键 bug | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 2 | Bilibili persistentReader 结构错误 | ✅ | 旧机制移除后不再成立 |
| 3 | Context value 未 memo（全量重渲染） | ⚠️ | 主要 App 已迁移 store；剩余零散点以 `ISSUE_STATUS_REPORT.md` 为准 |
| 4 | 密钥泄露到仓库 | ❌ | 已核验：`os/data/osConfig.ts` + `.env`/`.gitignore` |
| 5 | AnswerTask 数值匹配假阳性 | ✅ | **已纠偏**（2026-03-05）：`common_tasks.py` 已用 `_NUM_PATTERN` + `_match_numeric`，支持数字边界与小数 |
| 6 | Recents 重复渲染 App | ✅ | **已纠偏**：当前实现为容器重定位，无二次渲染 |
| 7 | QQMusic runtime/persistent 嵌套 key | 🔘 | App/机制已移除或替代（以 `ISSUE_STATUS_REPORT.md` 为准） |
| 8 | OS→Apps 循环依赖 | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 9 | `__APP_NAVIGATE__` 单例覆盖 | ✅ | 已抽检：代码中基本不再出现该全局单例 |
| 10 | App 状态双路径不一致 | ✅ | 已抽检：`persistentReaders` 已不存在 |
| 11 | CDN html2canvas 安全/性能问题 | ✅ | 已抽检：代码中不再引用 `html2canvas` |
| 12 | Ebay 6.1MB JSON 静态导入 | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 13 | useNavigate 大面积违规 | ⚠️ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 14 | 大型 JSON 静态导入（Reddit 等） | ✅ | Reddit 已改为 `loader.ts` + `fetch()` 异步加载，三大文件全部修复 |
| 15 | localStorage 全量序列化 | ✅ | `apps/` 下无直接 `localStorage.setItem`，全部走 Zustand + `debouncedPersist` |
| 16 | AutoGLM 解析失败当作完成 | ❌ | 已核验：`bench_env/agent/autoglm.py` |
| 17 | 后台 App 永久挂载 | ❌ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 18 | `__SIM__.getState()` 全量读取 | ❌ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 19 | navigation.declaration 覆盖不足 | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准（现存 App 已补齐） |
| 20 | 5 个 App 零 data-trigger | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 21 | 残缺应用目录 | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 21b | 无虚拟列表 | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准（已引入并在多页面启用） |
| 22 | Date.now 绕过 TimeService | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准（剩余为合法用途） |
| 23 | safeParseJSON 重复 | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 24 | tsconfig 过宽松（strict 渐进） | ✅ | **已纠偏**（2026-03-05）：`tsconfig.json` 已 `"strict": true` |
| 25 | Toast 组件重复 | ✅ | **已纠偏**（2026-03-05）：`os/components/Toast.tsx` 已存在，多 App 已改为导入 |
| 26 | 零测试覆盖 | ⚠️ | 已引入 Vitest、4 个测试文件；覆盖范围仍偏低 |
| 27 | Spotify 直接 fetch | ❌ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 28 | navigation.types.ts 重复 | 🔘 | 随导航/类型重构后不再适用（以 `ISSUE_STATUS_REPORT.md` 为准） |
| 29 | App 生命周期缺失 | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 30 | 权限系统缺失 | ✅ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 31 | 全局 ErrorBoundary 缺失 | ✅ | **已纠偏**（2026-03-05）：appRegistry 已包裹所有 App，apps 下无冗余 ErrorBoundary |
| 32 | BroadcastReceiver 缺失 | ✅ | **已纠偏**：当前已有 `os/BroadcastBus.ts`（以代码为准） |
| 33 | ContentProvider 缺失 | ✅ | **已纠偏**：当前已有 `os/ContentProvider.ts` + providers（以代码为准） |
| 34 | 通知 Actions 缺失 | ❌ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 35 | BilibiliContext 函数未 useCallback | 🔘 | Bilibili 已迁移 store，该问题不再适用（以 `ISSUE_STATUS_REPORT.md` 为准） |
| 36 | crossapp3 依赖外部 HTTP | ❌ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 37 | crossapp3 绕过 warm_apps | ❌ | 以 `ISSUE_STATUS_REPORT.md` 为准 |
| 38 | 状态同步竞态 | ❌ | 以 `ISSUE_STATUS_REPORT.md` 为准 |

---

## 问题清单（统一口径）

> 说明  
> - **状态**：✅已解决 / ⚠️部分解决 / ❌未解决 / 🔘不再适用  
> - **来源**：首次/主要出现在哪些 `todos/*.md` 或 `TODO.md`  
> - **代码核验**：仅对“高风险/高争议/易过期”的条目做了快速核验（写明核验点）。其余条目以 `todos/ISSUE_STATUS_REPORT.md` 的“逐项验证代码现状”为主要依据。

---

## P0 — 安全与评测可信度（最高优先级）

### P0-1 密钥/令牌泄露到仓库

- **状态**：❌ 未解决（已核验）
- **来源**：`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/mobile-gym-project-review-2026-02-25.md`、`todos/PROJECT_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **代码核验**：
  - `os/data/osConfig.ts` 存在硬编码 `sk-...` 形态字符串（位置：约第 97 行）
  - 根目录存在 `.env` 文件；`.gitignore` 未包含 `.env`
- **备注**：
  - `bench_env/README.md` 也出现了 `--judge-api-key ...` 示例（同样建议删除/改为占位符）
  - 数据集文件（如 `apps/X/data/importedData.json`）中出现 `sk-...` 可能只是内容数据，但会触发扫描/误报，应酌情脱敏或替换为假值

### P0-2 AnswerTask 数值匹配假阳性（且不支持小数）

- **状态**：✅ 已解决（已核验，2026-03-05 更新）
- **来源**：`todos/05-基准测试环境分析.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **代码核验**：`bench_env/task/common_tasks.py` 已改用 `_NUM_PATTERN`（`(?<!\d)-?\d+(?:\.\d+)?(?!\d)`）与 `_match_numeric()`，支持数字边界、小数及浮点容差，不再使用 `re.findall(r'\d+', ...)`

### P0-3 AutoGLM 解析失败当作完成（假完成）

- **状态**：❌ 未解决（已核验）
- **来源**：`todos/05-基准测试环境分析.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **代码核验**：`bench_env/agent/autoglm.py` 仍存在返回 `{"_finish": True, ...}` 的路径（如 242、301 行附近）
- **影响**：严重污染 Pass@k/成功率统计

### P0-4 Recents “重复渲染 App”（两棵 React 树/状态不一致/内存翻倍）

- **状态**：✅ 已解决（已核验；与部分文档冲突）
- **来源**：
  - 仍旧提及：`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/mobile-gym-project-review-2026-02-25.md`、`todos/ISSUE_STATUS_REPORT.md`
  - 已明确解决思路/实现：`TODO.md`（Live DOM Repositioning + Recents V2 方案）
- **代码核验**：
  - `os/SystemShell.tsx` 中 `renderAppContent(activity.appId)` 仅在 Activity 容器处渲染一次；Recents 通过 `computeActivityContainerStyle({ isRecentsVisible, recentsSlot })` 将容器重定位到卡片槽位
  - 未发现 Recents 组件中再次调用 `renderAppContent(...)` 的迹象
- **备注**：如果历史文档仍写“重复渲染”，应视为旧结论未更新

---

## P1 — 架构与性能核心问题

### P1-1 OS → Apps 循环依赖 / OS 层强耦合 Apps 数据

- **状态**：✅ 已解决（以 `ISSUE_STATUS_REPORT.md` 为主；并有侧面证据）
- **来源**：`todos/01-系统架构分析.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **现状依据**（来自 `ISSUE_STATUS_REPORT.md`）：
  - `persistentReaders` 机制移除、统一为 store/registry；`AppStateRegistry.ts` 极度瘦身

### P1-2 `__APP_NAVIGATE__` / `__APP_BACK_HANDLER__` 单例覆盖（多 App 并发错乱）

- **状态**：✅ 已解决（已抽检）
- **来源**：`todos/01-系统架构分析.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **代码抽检**：仓库现代码中几乎不再出现 `__APP_NAVIGATE__` / `__APP_BACK_HANDLER__`（只在文档中出现），符合“已迁移到 Registry + hook”的结论

### P1-3 App 状态“双路径”（runtime registry vs persistent reader）结构不一致

- **状态**：✅ 已解决（已抽检）
- **来源**：`todos/01-系统架构分析.md`、`todos/04-设计理念分析.md`、`todos/05-基准测试环境分析.md`、`todos/ISSUE_STATUS_REPORT.md`
- **代码抽检**：OS 目录下未发现 `persistentReaders` 字符串（表明旧机制已移除）

### P1-4 大型 JSON 静态导入导致 bundle 膨胀（Ebay/Railway12306/Reddit 等）

- **状态**：✅ 已解决
- **来源**：`todos/02-性能分析.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **核验**（2026-03-04）：Ebay、Railway12306、Reddit 三大文件全部改为 `loader.ts` + `fetch()` 异步加载。Reddit 通过 `data/loader.ts` 的 `createLoader` + `fetch()` 异步加载，`data/index.ts` 只静态导入体积极小的 `defaults.json`

### P1-5 localStorage 同步全量序列化（主线程阻塞）

- **状态**：✅ 已解决
- **来源**：`todos/02-性能分析.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **核验**（2026-03-04）：`apps/` 目录下无任何直接 `localStorage.setItem` 调用。全部 App store 走 Zustand + `createDebouncedStorage`；OS 系统服务走 `debouncedPersist`。Wechat 订阅/支付确认页已通过 `useWechatStore` 正确持久化

### P1-6 后台 App 永久挂载（缺少 LRU 回收/内存增长）

- **状态**：❌ 未解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/02-性能分析.md`、`todos/06-Android系统对比.md`、`todos/PROJECT_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`

### P1-7 `__SIM__.getState()` 全量读取潜在瓶颈（缺少分级/脏标记）

- **状态**：❌ 未解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/02-性能分析.md`、`todos/PROJECT_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`

### P1-8 OSContext Provider value 未 memo（全量重渲染）

- **状态**：✅ 已解决（已核验；与 `ISSUE_STATUS_REPORT.md` 冲突）
- **来源**：`todos/02-性能分析.md`、`todos/ISSUE_STATUS_REPORT.md`
- **代码核验**：`os/OSContext.tsx` 已有 `const contextValue = useMemo(...);` 且 `<OSContext.Provider value={contextValue}>`

---

## P2 — 代码质量与规范执行

### P2-1 `useNavigate()` 直接调用（违反 go()/back() 规范）

- **状态**：⚠️ 部分解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/03-代码质量与完善度.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`

### P2-2 Toast 组件重复（多个 App 复制粘贴）

- **状态**：✅ 已解决（已核验，2026-03-05 更新）
- **来源**：`todos/03-代码质量与完善度.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **代码核验**：已存在 `os/components/Toast.tsx`，Contacts/Sms/Calendar/Settings/Notes/FileManager/X 等多 App 已改为从 OS 层导入

### P2-3 零测试覆盖（缺少 Vitest/Jest）

- **状态**：⚠️ 部分解决（以 `ISSUE_STATUS_REPORT.md` 为主；2026-03-05 更新）
- **来源**：`todos/03-代码质量与完善度.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **现状**：已引入 Vitest，现有 4 个测试文件（`createAppStore.test.ts`、`osReducer.test.ts`、`taskUtils.test.ts`、`ServiceRegistry.test.ts`）；覆盖范围仍偏低

### P2-4 Spotify 直接 fetch 外部 API（应走 NetworkService）

- **状态**：❌ 未解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/03-代码质量与完善度.md`、`todos/ISSUE_STATUS_REPORT.md`

### P2-5 `Date.now()` / `new Date()` 绕过 TimeService

- **状态**：✅ 已解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/03-代码质量与完善度.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **备注**：仍保留的调用被归为“合法用途”（计时/性能/防抖/TTL 等）

### P2-6 safeParseJSON 重复实现

- **状态**：✅ 已解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/03-代码质量与完善度.md`、`todos/ISSUE_STATUS_REPORT.md`

### P2-7 TypeScript strict 渐进开启

- **状态**：✅ 已解决（已核验，2026-03-05 更新）
- **来源**：`todos/03-代码质量与完善度.md`、`todos/ISSUE_STATUS_REPORT.md`
- **代码核验**：`tsconfig.json` 已启用 `"strict": true`

---

## P3 — 功能差距与长期演进（偏“更像 Android/更利于训练”）

### P3-1 权限系统（运行时授权弹窗/状态存储/拦截）

- **状态**：✅ 已解决（以 `ISSUE_STATUS_REPORT.md` 为主；且 SystemShell 已出现 `PermissionDialogHost`）
- **来源**：`todos/06-Android系统对比.md`、`todos/PROJECT_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`

### P3-2 BroadcastReceiver / 广播总线

- **状态**：✅ 已解决（已核验；与部分文档/旧结论冲突）
- **来源**：`todos/06-Android系统对比.md`、`todos/PROJECT_ANALYSIS_REPORT.md`、`todos/ISSUE_STATUS_REPORT.md`
- **代码核验**：已存在 `os/BroadcastBus.ts`，并定义了多类 action + `registerReceiver/sendBroadcast/sendOrderedBroadcast`

### P3-3 ContentProvider / 跨 App URI 数据共享（联系人/媒体库等）

- **状态**：✅ 已解决（已核验；与部分文档/旧结论冲突）
- **来源**：`todos/06-Android系统对比.md`、`todos/PROJECT_ANALYSIS_REPORT.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`
- **代码核验**：已存在 `os/ContentProvider.ts`、`os/ContentResolver.ts`（URI 解析/注册），以及 `os/providers/ContactsProvider.ts`、`os/providers/MediaProvider.ts`

### P3-4 通知 Actions（快捷回复/标记已读等）

- **状态**：❌ 未解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/06-Android系统对比.md`、`todos/ISSUE_STATUS_REPORT.md`

### P3-5 App 生命周期（foreground/background/destroy 等）

- **状态**：✅ 已解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/06-Android系统对比.md`、`todos/ISSUE_STATUS_REPORT.md`

---

## Benchmark 环境专项（除 P0 外仍未解决的关键项）

### B-1 crossapp3 评估依赖外部 HTTP（可复现性差）

- **状态**：❌ 未解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/05-基准测试环境分析.md`、`todos/ISSUE_STATUS_REPORT.md`

### B-2 crossapp3 绕过 `warm_apps` / 任务基类 setup 机制

- **状态**：❌ 未解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/05-基准测试环境分析.md`、`todos/ISSUE_STATUS_REPORT.md`

### B-3 状态同步竞态（reset / set_state 后未等待 React 恢复）

- **状态**：❌ 未解决（以 `ISSUE_STATUS_REPORT.md` 为主）
- **来源**：`todos/05-基准测试环境分析.md`、`todos/ISSUE_STATUS_REPORT.md`

---

## 其他（来自专项报告/备忘的“低优先级但仍是问题/债务”）

### O-1 Recents V2 动画与性能优化（FLIP/WAAPI、卡片关闭滑动、content-visibility）

- **状态**：⚠️ 部分解决（`TODO.md` 记录为 V2 计划/实现草案，需以实际代码落地为准）
- **来源**：`TODO.md`

### O-2 navigation.declaration 的 data-mode（dataSource 配置）暂不启用

- **状态**：🔘 暂不做 / 不适用（按当前决策）
- **来源**：`TODO.md`
- **说明**：Bilibili/RedBook 动态 params 的 dataSource 配置复杂，文档明确“暂不配置、不生成 data 图”

### O-3 小红书首开数据处理慢（首次打开 2-5s）

- **状态**：❌ 未解决（文档自评“低优先级，可接受”）
- **来源**：`TODO.md`

### O-4 小红书 entities 不持久化导致 reload 后计数不一致

- **状态**：❌ 未解决（文档自评“低优先级”）
- **来源**：`TODO.md`

### O-5 NetworkService 非字符串 body 处理不透明（可能丢弃 body）

- **状态**：❓ 未核验（文档层面提出的风险点）
- **来源**：`todos/01-系统架构分析.md`

### O-6 `DeviceConfig` “God Object”（视觉常量/行为配置混杂）

- **状态**：❓ 未核验（偏架构改造建议）
- **来源**：`todos/01-系统架构分析.md`

### O-7 window 全局 API 广泛使用 `(window as any)` 缺乏类型安全

- **状态**：❓ 未核验（偏工程债务）
- **来源**：`todos/01-系统架构分析.md`

### O-8 资源/设计一致性问题（Web 范式泄漏）

- **状态**：❓ 未核验（偏规范/一致性债务）
- **来源**：`todos/04-设计理念分析.md`
- **典型点**：
  - `colors.ts` 中出现 Tailwind 工具类命名 key（如 `tw-text-gray-400`）
  - `dimens.ts` 出现 `name_value` 反模式（如 `itemWidth_24`）
  - `data/index.ts` 在不同 App 间职责差异极大（“数据入口”演化为运行时转换管道）

### O-9 i18n 与字符串资源缺失/硬编码过多

- **状态**：❓ 未核验
- **来源**：`todos/03-代码质量与完善度.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`
- **说明**：典型如 Bilibili `strings.ts` 覆盖极少、页面中大量硬编码中文；Calculator2/Alipay 英文键缺失

### O-10 硬编码十六进制颜色过多（主题/可替换性受限）

- **状态**：❓ 未核验（问题本身在文档中以统计形式出现）
- **来源**：`todos/03-代码质量与完善度.md`、`todos/UNIFIED_ANALYSIS_REPORT.md`

### O-11 图标命名规范（`Ic*`）在数据层的违规

- **状态**：❌ 未解决（已抽检）
- **来源**：`todos/03-代码质量与完善度.md`
- **说明**：TencentMeeting/Map 的 `defaults.json` 仍可见原始 Lucide 名/小写 icon 名（如 `Home`、`Video`、`home`、`utensils`）
  - 位置提示：`apps/TencentMeeting/data/defaults.json`、`apps/Map/data/defaults.json`

### O-12 Gallery 滚动性能（onScroll 每帧 setState）

- **状态**：❓ 未核验
- **来源**：`todos/02-性能分析.md`

### O-13 `dimensToCssVars` 在渲染时的副作用/注入策略

- **状态**：❓ 未核验
- **来源**：`todos/02-性能分析.md`、`todos/04-设计理念分析.md`
- **说明**：文档认为其包含 DOM 注入副作用，且若未 memo 可能带来额外开销

### O-14 “有状态无行为”的系统开关（WiFi/飞行模式等）

- **状态**：❓ 未核验（更偏真实性差距）
- **来源**：`todos/06-Android系统对比.md`、`todos/mobile-gym-project-review-2026-02-25.md`
- **说明**：文档指出部分开关只改变 UI 状态，不影响实际网络/行为

### O-15 模拟时间“不流逝”的问题

- **状态**：✅ 已解决（已核验）
- **来源**：`todos/06-Android系统对比.md`、`todos/PROJECT_ANALYSIS_REPORT.md`
- **代码核验**：`os/TimeService.ts` 已支持 simulated time 的 `flowing`（默认流动）与 `frozen`（冻结）两种模式

### O-15b TimeScale（加速/手动推进时间）能力

- **状态**：✅ 已解决（已核验，2026-03-05 更新）
- **来源**：`todos/06-Android系统对比.md`、`todos/PROJECT_ANALYSIS_REPORT.md`
- **代码核验**：`os/TimeService.ts` 已提供 `setSpeed()`、`setFlowing()`、`useSimulatedTime()`，并暴露 `window.__SIM_TIME__`

### O-16 APP_NAME_MAP 双重维护（OS/bench_env 两处映射）

- **状态**：❌ 未解决（已抽检）
- **来源**：`todos/04-设计理念分析.md`
  - 位置提示：`os/AgentBridge.ts` 与 `bench_env/env/mobile_gym.py`

### O-17 Intent 生态完善度（Chooser/ShareSheet、filters 使用率等）

- **状态**：✅ 已解决（已核验，2026-03-05 更新；Chooser 部分）
- **来源**：`todos/06-Android系统对比.md`、`todos/mobile-gym-project-review-2026-02-25.md`
- **代码核验**：已存在 `os/components/IntentChooserSheet.tsx`，`IntentResolver` 在 `intentChooserEnabled` 时展示选择器，`SystemShell` 已挂载

---

## 附：与 todos-opus 及代码对齐说明（2026-03-05）

对本文中与 `todos/todos-opus.md` 及当前代码不一致的条目做了纠偏，统一以代码现状为准：

- **P0-2 AnswerTask**：已改为 ✅；`common_tasks.py` 已用 `_NUM_PATTERN` + `_match_numeric`，不再 `re.findall(r'\d+', ...)`。
- **全量索引 #5、#24、#25、#26、#31**：AnswerTask ✅，tsconfig strict ✅，Toast ✅，零测试 ⚠️（4 个测试文件），全局 ErrorBoundary ✅。
- **P2-2 Toast、P2-3 零测试、P2-7 TypeScript strict**：Toast ✅（`os/components/Toast.tsx` + 多 App 已导入），零测试 ⚠️，strict ✅。
- **O-15b TimeScale、O-17 Intent Chooser**：均已实现并标为 ✅。

其余未解决项（密钥、AutoGLM 假完成、后台挂载、Spotify fetch、通知 Actions、crossapp3 等）与代码一致，未改。

---

## 附：本文对“已解决/未解决”的口径

- **已解决**：当前仓库代码已不存在该问题的关键机制，或已被替代实现覆盖（并注明核验点或来源为 `ISSUE_STATUS_REPORT.md`）
- **部分解决**：主要路径已修，但仍有残留/待清理/仅覆盖部分 App 或页面
- **未解决**：代码中仍明确存在，或 `ISSUE_STATUS_REPORT.md` 明确标注未解决且无相反证据
- **不再适用**：相关模块/应用已移除，或策略调整后该问题不再成立

