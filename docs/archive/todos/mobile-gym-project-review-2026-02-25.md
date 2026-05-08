# mobile-gym 项目问题分析与演进建议（2026-02-25）

> 目标：从 **性能**、**完善度**、**设计理念**、**系统架构** 等维度梳理当前项目问题；对比真实 Android（应用层/Framework 层）指出功能差距；给出达到“接近应用层完整 OS 模拟器”的缺口清单与可执行路线；并给出把项目提升到“学习 Android 系统设计的教科书级项目”的改造建议。

---

## 0. 项目定位（先统一评判标准）

从文档与代码来看，mobile-gym 的核心定位更接近：

- **浏览器内的 Android-like System UI + App 容器 + 统一服务层 + 面向 Agent 的可观测/可注入接口**  
  - 目标是训练/评测“手机操作 Agent”，而不是运行真实 APK 的 Android 运行时。
  - 关键设计原则：声明式导航、静态可分析、统一手势/动作打标、SIM/OS 全局 API。

参考：
- README 目标描述：`README.md:3`
- 规范文档目标/原则：`docs/PROJECT_SPEC_V2.md:10`、`docs/PROJECT_SPEC_V2.md:35`

这意味着“像 Android”与“像可评测的 UI 状态机”在很多设计点上存在天然冲突：  
本报告会区分 **“对 Agent 平台有利”** vs **“对 OS 教材更像 Android”** 的取舍点。

---

## 1. 当前实现的关键优点（值得保留/继续强化）

1) **声明式导航 + 静态分析产物**  
- `navigation.declaration.ts` 作为 source of truth，可生成 nav graph / action tasks（对 Agent 训练/评测很强）。
- 边界规则清晰：动态字符串拼接禁用、transition/action 绑定打标（`docs/PROJECT_SPEC_V2.md:37` 之后章节）。

2) **系统服务抽象雏形已经成型**  
- Time/Location/Network/FileSystem/Clipboard/Notifications 等已经具备“系统服务”的形态：  
  `os/TimeService.ts`、`os/LocationService.ts`、`os/NetworkService.ts`、`os/FileSystemService.ts` 等。

3) **面向 Agent 的统一输入注入与元素定位接口**  
- `__SIM_INPUT__`（tap/swipe/type/back/home）和 `__SIM_QUERY__` 等（`README.md` Agent API 章节，`os/simInput.ts`）。

这些优点是“教科书化”的基础：因为它们可以被组织成可解释、可测、可复现的系统模块。

---

## 2. 主要问题清单（按影响度与根因分类）

### 2.1 性能与资源占用

**P0：Recents 多任务预览的“重复渲染”与状态一致性问题**
- 现状：Recents 卡片里直接 `renderAppContent(previewAppId)` 再渲染一份 App 内容（`os/SystemShell.tsx:165-178`）。
- 风险：
  - 同一个 App 会有两棵 React 树 → 状态/副作用不一致（你们在 `TODO.md` 已明确记录）。
  - 预览渲染可能触发额外的网络请求、定时器、订阅、数据初始化等 → 性能与行为不可控。
- 证据：
  - `TODO.md:7`（明确指出重复挂载导致状态不一致）
  - `os/SystemShell.tsx:124`（Recents 预览渲染）

**P1：后台 App “永远挂载”导致内存/CPU 上限不可控**
- 现状：所有 runningApps 一直 mount，仅以 `display:none` 隐藏（`os/SystemShell.tsx:1102-1124`）。
- 与真实 Android 的差异：
  - Android 会有 lifecycle、后台限制、低内存杀进程/回收；不会让所有 App 永远活着。
- 风险：
  - 隐藏 App 仍可能运行 effect、计时器、订阅、缓存增长。
  - 当 App 数量增长，系统层性能曲线恶化（尤其对 bench_env 并行/长时运行）。

**P1：`__SIM__.getState()` 默认“全量状态观测”可能成为热点瓶颈**
- 现状：`__SIM__.getState()` 返回 `{ os, apps }`，其中 apps 取 `getAllAppStates()`，会遍历 runtimeRegistry + persistentReaders（`os/OSContext.tsx:626+`、`os/AppStateRegistry.ts:443+`）。
- 风险：
  - Agent/评测可能高频调用（每步/每帧）→ 导致主线程开销、序列化开销、localStorage/JSON.parse 开销。
  - 某些 App 状态如果变大（entities、feed、图片元数据），会拖垮观测性能。

**P2：重型数据加载与首开阻塞（局部 App）**
- RedBook 首开慢已在 `TODO.md:109` 记录；已引入 loader/缓存与 bench_env 的 `waitForData(appIds)` 优化（`docs/BENCH_ENV_PERFORMANCE.md:11`、`os/OSContext.tsx:614-625`）。
- 但这属于“点状解决”，缺少系统级策略（后台预热/分片加载/worker/虚拟化/预算控制）。

---

### 2.2 架构耦合与一致性风险（系统层“知道太多 App 细节”）

**P0：`os/AppStateRegistry.ts` 对 apps 目录的强耦合**
- 现状：`os/AppStateRegistry.ts` 直接 import 多个 App 的 `data`（`os/AppStateRegistry.ts:4` 起）。
- 风险：
  - OS 层变成“巨型依赖汇聚点”，每加/改 App 状态都需要改 OS 代码。
  - 与 Android 的“系统-应用隔离”理念相反（真实系统服务不应 import 应用业务数据）。

**P0：persistentReaders 与 runtimeRegistry 字段不一致会影响 bench_env 判定**
- 已在 `TODO.md:63` 详细描述：同一 App 的“未运行状态读取”与“运行时状态 getter”结构不一致，会在跨应用任务中被误判为副作用。
- 这属于系统架构层面的“状态 schema 未规范化/未验证”问题，应系统化解决（见路线图章节）。

**P1：App 桥接接口仍偏全局单例，易被后台 App 覆盖**
- `window.__APP_BACK_HANDLER__ / __APP_NAVIGATE__ / __APP_ROUTE__` 都是“单个全局入口”。  
  OS back 只读取一个 handler（`os/OSContext.tsx:373`）。
- Alipay 已经引入 `__APP_NAVIGATORS__[appId]`（`apps/Alipay/components/AlipayNavigationHandler.tsx:37`）用于解决“backgrounded App 覆盖 __APP_NAVIGATE__”的问题，但未形成统一规范，存在不一致。

---

### 2.3 设计理念与真实 Android 的结构性偏离（影响“教材属性”）

**声明式 URL 状态机 vs Android Activity/Fragment 模型**
- 当前项目用 MemoryRouter + URL 承载离散状态（tabs/modals/menu 等），这是为了静态建图与 Agent 可观测性（合理）。
- 但 Android 的核心教学主线是：
  - AMS/WMS 管理任务栈、窗口栈、生命周期
  - Context.getSystemService + Binder/IPC
  - 权限/UID 隔离与资源回收
- 若要教科书级，需要补“概念映射层”（见后文）。

---

### 2.4 安全与可复现性问题（教科书项目的硬门槛）

**P0：密钥/令牌进入仓库（严重）**
- `.env` 内存在真实形态的 key/token：`.env:1-5`
- `os/data/osConfig.ts` 内也硬编码了 API key：`os/data/osConfig.ts:87-94`
- `.env` 未被 `.gitignore` 忽略：`.gitignore:1-80`（没有 `.env`）

**P1：运行时从 CDN 动态注入脚本**
- `os/AgentBridge.ts` 的 screenshot 逻辑会加载 jsdelivr 的 html2canvas：`os/AgentBridge.ts:184-192`
- 风险：离线/内网不可用、供应链安全、版本不可控，影响复现。

---

## 3. 与真实 Android（应用层/Framework 层）的差距对照

> 这里只对比“应用层 OS（Framework/SystemUI/系统服务）”相关差距，不讨论 Linux kernel/驱动。

| 主题 | Android（真实） | mobile-gym（当前） | 差距影响 |
|---|---|---|---|
| 进程/UID 沙箱 | 每 App 独立进程/UID；权限与隔离强 | 所有 App 共享同一 JS 运行时 | 很难教学“跨进程边界/Binder/权限校验为何必要” |
| 权限/AppOps | 系统服务调用需权限校验，UI 引导授权 | 仅有少量服务抽象，缺少统一权限门与授权流程 | 学不到“系统 API 的治理模型” |
| AMS/WMS 任务/窗口栈 | Task/Activity 栈、生命周期、低内存回收 | `activeAppId/runningApps` + App 永远挂载；Recents 重渲染预览 | 生命周期与资源回收是 Android 设计核心，当前缺失闭环 |
| IPC/Binder | 系统服务通过 Binder 暴露；接口稳定 | module singleton + window 全局对象 | 结构不像 Android，难形成“系统服务教科书” |
| Intent/Broadcast/Provider | Intent 解析、Chooser、广播、ContentProvider | 已有 intentFilters/queries + startActivityForResult 雏形（`os/OSContext.tsx:426+`），但 Broadcast/Provider/Chooser 体系缺失 | 跨应用协作能力不足，应用层 OS 味道不够 |
| 后台任务调度 | JobScheduler/Alarm/FGS/Doze | 缺少统一调度与省电约束模拟 | 学不到 Android “后台治理”的关键经验 |
| 配置变更 | Configuration 变更触发资源重载/重建 | 有 DeviceService/Locale/Theme，但缺少“配置变更→生命周期→状态恢复”闭环 | 学不到资源系统与重建策略 |

---

## 4. 若要达到“接近应用层完整 OS 模拟器”，还缺什么（按优先级）

### 4.1 让系统更“像 OS”的核心缺口（P0/P1）

**P0：PackageManager + 动态安装/卸载/更新**
- 当前 appRegistry 静态注册：`os/data/appRegistry.tsx`
- 你们已有“拖入安装 App（.mgapp）”的完整方案分析：`INSTALL_APP_ANALYSIS.md`
- 这块落地后，系统才开始具备“操作系统”的关键特征：管理第三方包、安装生命周期、版本与签名策略（可简化）。

**P0：更真实的 Task/Activity/Lifecycle 与 Recents 预览机制**
- 需要把“永远挂载”升级为：
  - foreground/background 生命周期事件
  - 冻结/销毁策略（内存预算/后台限制）
  - SavedState / 恢复策略
  - Recents 用截图/Surface 缓存预览，而不是重复渲染（与 `TODO.md:21` 的方向一致）

**P1：统一系统服务访问入口 + 权限门（Context.getSystemService 的简化版）**
- 把 Time/Location/Files/Clipboard/Notifications/Network 等系统能力统一走一个“Service Registry”，并可插入权限/AppOps 决策。
- 让 App 通过“系统 API”而非直接 import OS module 访问能力 → 更像 Android，且更可教学。

### 4.2 跨应用生态能力（P1/P2）

**P1：Chooser/ShareSheet + 隐式 Intent 完整闭环**
- 目前 OS resolveIntent 会取第一个匹配（`os/OSContext.tsx:457`），且 chooser 预留未实现（`os/types.ts` 的 `intentChooserEnabled` 字段）。
- 引入 chooser UI + 任务栈语义 + result 回传，能显著增强“应用层 OS”的真实感。

**P2：Broadcast/ContentProvider（可简化实现）**
- Broadcast：系统事件（网络变更、语言变更、时区变更、通知点击等）统一分发。
- Provider：用“URI + 权限 + CRUD”抽象来教“数据共享与权限边界”。

### 4.3 系统级可观测与可复现（P1）

**P1：系统事件日志/trace + 回放**
- 把 lifecycle、intent、service 调用、权限决策、输入事件统一记录并可导出（配合 bench_env）。
- 这会把项目从“能跑”升级为“能解释、能证明、能教学”。

---

## 5. 把项目提升为“教科书级 Android 系统设计学习项目”的改造建议（可执行）

### 5.1 先补“概念映射层”（教材入口）

新增一份总览文档（建议放 docs/）说明下列映射关系：

- `SystemShell` ≈ SystemUI（Launcher/StatusBar/Recents/Gestures）
- `OSContext` ≈ AMS/WMS 的简化调度中枢（任务切换/返回键/intent 栈）
- `*Service.ts` ≈ Android System Services（但需补统一注册/权限门）
- `navigation.declaration.ts` ≈ “可分析的 UI 状态机声明”（Android 没有完全等价物，需要解释差异与理由）

目的：让读者先有“Android 对照物”，再读代码不会迷路。

### 5.2 把“工程约束”升级为“系统级规则”（像 Android 的 CTS）

你们已有导航一致性检查与产物生成脚本（README scripts 章节）。建议补充：

- 禁止在 apps 中直接 `fetch(http/https)`（强制走 `os/NetworkService`）  
  参考说明：`docs/NETWORK_SERVICE.md`
- 禁止在 apps 中直接 `Date.now/new Date`（强制走 `os/TimeService`）  
  现实中已有不少直接调用（例如 `apps/Weather/services/weatherService.ts` 等，可作为迁移清单）。
- AppState 的 schema 需要可验证（persistentReaders 与 runtime getter 对齐），并提供自动检查/生成文档：  
  README 已提到 `scripts/dump_app_state_schema.py`（见 README 中相关章节）。

这样项目才会具备“教材项目应有的强一致性与可回归性”。

### 5.3 建议的里程碑（按“先解决根因、再扩功能”排序）

**Milestone A（工程健康度/复现性）**
- 移除仓库内所有密钥/令牌；`.env` 加入 `.gitignore`；文档改为“如何配置 env”。
- 去掉 runtime CDN 注入（html2canvas 改为本地依赖或替换方案）。

**Milestone B（Recents 与生命周期闭环）**
- Recents 改为截图/快照；确保不会重复挂载。
- 引入 App lifecycle（foreground/background/frozen/destroyed）最小闭环。

**Milestone C（系统服务注册 + 权限门）**
- 统一服务入口（ServiceRegistry），引入权限校验与授权 UI（最小可用）。

**Milestone D（跨应用生态）**
- Chooser/ShareSheet + 隐式 Intent 完整闭环
- Broadcast/Provider（简化版本）

**Milestone E（系统 trace + 教材化课程内容）**
- 系统事件日志、回放、bench_env 任务与评测脚本固化为“章节作业”。

---

## 6. 可直接落地的 TODO（建议在 1-2 周内完成的“高 ROI”）

> 注：本列表是“工程+架构关键路径”，不是业务 App 的 UI 细节。

- [ ] **移除/外置所有密钥**：检查 `.env` 与 `os/data/osConfig.ts`，避免任何真实 key/token 进入仓库（`.env:1-5`、`os/data/osConfig.ts:87-94`）。
- [ ] **`.env` 加入 `.gitignore`**，并补充一份 `env.example` 或 README 配置说明（`.gitignore:1-80`）。
- [ ] **Recents 不再重复渲染 App**：按 `TODO.md:21` 的“截图方案/portal 方案”落地其一，并写清楚权衡。
- [ ] **统一 App 导航桥接为 per-app registry**：推广 `__APP_NAVIGATORS__[appId]` 模式，避免 background App 覆盖（对照 `apps/Alipay/components/AlipayNavigationHandler.tsx:37`）。
- [ ] **为 `__SIM__.getState()` 增加分级观测**：提供 `getState({ apps: 'activeOnly'|'running'|'all', includeHeavy?: boolean })` 之类的选项，降低默认成本（现状见 `os/OSContext.tsx:626`）。
- [ ] **AppState schema 对齐自动化**：让 persistentReaders 与 runtime getter 可自动比对（现问题见 `TODO.md:63`），并把“对齐”作为 CI/脚本硬门槛（类似导航一致性检查）。

---

## 7. 附录：本报告引用的关键文件

- 目标/规范：`README.md`、`docs/PROJECT_SPEC_V2.md`
- OS 核心：`os/OSContext.tsx`、`os/SystemShell.tsx`、`os/AppStateRegistry.ts`
- 性能记录：`docs/BENCH_ENV_PERFORMANCE.md`
- 网络服务：`docs/NETWORK_SERVICE.md`
- 安装包规划：`INSTALL_APP_ANALYSIS.md`
- 已知问题：`TODO.md`

