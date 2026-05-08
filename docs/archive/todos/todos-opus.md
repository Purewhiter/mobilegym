# mobile-gym 问题全面追踪报告

> 生成日期：2026-03-04
> 基于 `todos/` 目录下 13 份分析文档的交叉整合，并逐项验证代码现状
> 原始分析日期：2026-02-25；上次状态检查：2026-03-03

---

## 总览

| 分类 | 已解决 | 部分解决 | 未解决 | 不再适用 |
|------|--------|---------|--------|---------|
| P0 紧急问题 | 5 | 0 | 2 | 1 |
| P1 架构与性能 | 9 | 1 | 4 | 0 |
| P2 代码质量与规范 | 9 | 1 | 4 | 1 |
| P3 功能差距与长期演进 | 7 | 0 | 1 | 1 |
| Benchmark 环境 | 0 | 0 | 5 | 0 |
| **合计** | **30** | **2** | **16** | **3** |

---

## 一、P0 — 紧急问题

### ✅ 已解决

| # | 问题 | 原状 | 现状 | 来源 |
|---|------|------|------|------|
| 1 | Calendar `__APP_STAY_BACK_HANDLER__` bug | 使用错误 key 名，系统返回键完全失效 | 已迁移至 `useAppNavigationHandler('calendar', { onBack })`，返回键正常 | 00/01/03/UNIFIED |
| 2 | Bilibili persistentReader 结构错误 | `user: data ?? BILIBILI_CONFIG.user` 导致状态结构错误 | `persistentReaders` 机制已移除，改用 Zustand store，bug 不再存在 | 00/01/05/UNIFIED |
| 3 | Context value 未 memo（全量重渲染） | 所有 App Context Provider value 每次渲染创建新对象 | 主要 App 已迁移至 Zustand store；`OSContext.tsx` 的 Provider value 已用 `useMemo` 包裹 | 00/02/UNIFIED/PROJECT |
| 4 | Recents 重复渲染 App | 同一 App 有两棵 React 树，内存翻倍 + 状态不一致 | 重构为每个 activity 只渲染一次，Recents 可见时复用同一实例。但仍非截图方案，多任务时仍有性能开销 | UNIFIED/mobile-gym-review |
| 6 | AnswerTask 数值匹配假阳性 | 原使用 `re.findall(r'\d+', ...)` 导致期望值 5 被 25 命中、不支持小数 | 已改用 `_NUM_PATTERN`（数字边界）+ `_match_numeric()`（小数与浮点容差），见 `bench_env/task/common_tasks.py` | 00/05/UNIFIED |

### ❌ 未解决

| # | 问题 | 说明 | 建议 | 来源 |
|---|------|------|------|------|
| 5 | **密钥泄露到仓库** | `.env` 未加入 `.gitignore`，包含 Google Maps/彩云/和风/高德 API Key；`os/data/osConfig.ts:97` 硬编码 `sk-5ecfea8fb2ad4da585ec489762443936` | 立即移除密钥、`.env` 加入 `.gitignore`、补充 `env.example` | UNIFIED/mobile-gym-review |
| 7 | **AutoGLM 解析失败当作完成** | `bench_env/agent/autoglm.py:299-300` 解析失败时仍 `return {"_finish": True}`，产生大量假完成 | 改为 `_finish: False` 或 ABORT 状态 | 05/UNIFIED |

### 🔘 不再适用

| # | 问题 | 说明 |
|---|------|------|
| 8 | QQMusic registerAppState 嵌套 key | QQMusic App 已从仓库移除，且 `registerAppState/persistentReaders` 机制已被 Zustand store 替代 |

---

## 二、P1 — 架构与性能核心问题

### ✅ 已解决

| # | 问题 | 原状 | 现状 | 来源 |
|---|------|------|------|------|
| 9 | OS→Apps 循环依赖 | `AppStateRegistry.ts` 直接 import 18 个 App 数据模块，形成 os→apps→os 循环 | 重构为 Zustand store registry，`AppStateRegistry.ts` 仅 19 行 | 01/04/UNIFIED |
| 10 | `__APP_NAVIGATE__` 单例覆盖 | 21 个 App 共用 `window.__APP_NAVIGATE__` 全局变量 | 引入 `AppNavigatorRegistry.ts` + `useAppNavigationHandler` hook，所有 App 已迁移 | 01/UNIFIED/mobile-gym-review |
| 11 | App 状态双路径不一致 | `persistentReaders` 与 `runtimeRegistry` 返回结构不统一 | 统一为 Zustand store 单路径读写，`persistentReaders` 已移除 | 01/04/05/UNIFIED |
| 12 | CDN html2canvas 安全/性能问题 | AgentBridge 从 jsdelivr CDN 动态加载 html2canvas | 已移除 CDN 依赖，截图逻辑重构 | UNIFIED/mobile-gym-review |
| 13 | Ebay 6.1MB JSON 静态导入 | `SearchPage.tsx` 直接 `import` 6.1MB JSON | 改为 `loader.ts` + `fetch()` 异步加载 | 00/02/UNIFIED |
| 14 | Reddit 1MB JSON 静态导入 | `data/index.ts` 直接 `import redditData from './reddit_data.json'` | 改为 `loader.ts` + `fetch()` 异步加载 | 02/UNIFIED |
| 15 | OSContext value 未 useMemo | Provider value 每次渲染创建新对象 | 已用 `useMemo` 包裹 | ISSUE_STATUS |
| 17 | localStorage 全量序列化 | 24 个文件每次 state 变更同步 `JSON.stringify + setItem` | 主 App 已无直接 `localStorage.setItem`；仅 OS 层 `debouncedPersist.ts` 统一写入，符合设计 | 02/UNIFIED |
| 18 | 大型 JSON 静态导入 | Ebay 6.1MB + Railway12306 860KB + Reddit 1MB 均为静态 import | Ebay、Railway12306、Reddit 均已改为 fetch 异步加载 | 02/UNIFIED |

### ⚠️ 部分解决

| # | 问题 | 原状 | 现状 | 剩余工作 | 来源 |
|---|------|------|------|---------|------|
| 16 | useNavigate 大面积违规 | 59 个页面文件直接使用 `useNavigate()` | 业务页面（`pages/`）已全部清理完毕。`useNavigate` 仅存在于合法的基础设施代码（`navigation.ts`、`*App.tsx`、`*NavigationHandler.tsx`）中。**Map 的 `navigateTo` 暴露为已知遗留**（地图应用特殊场景） | Map 应用 `navigateTo` 重构 | 03/UNIFIED |

### ❌ 未解决

| # | 问题 | 说明 | 建议 | 来源 |
|---|------|------|------|------|
| 19 | **后台 App 永久挂载** | 所有 `runningApps` 始终 mount（`display:none`），无 LRU 淘汰。28 个 App 全开后 DOM 节点数万、内存持续增长 | 引入 LRU 回收策略，保留最近 N 个 App mounted，其余 unmount + 序列化状态 | 02/UNIFIED/PROJECT/mobile-gym-review |
| 20 | **`__SIM__.getState()` 全量读取** | 每次调用遍历所有 App 状态（`getAllAppStates()`），Agent 高频调用时为瓶颈 | 增加分级选项（`activeOnly`/`running`/`all`）+ 脏标记机制 | UNIFIED/mobile-gym-review |
| 21 | **Spotify 直接 fetch 外部 API** | 5 处直接调用 iTunes API（`fetch('https://itunes.apple.com/...')`），绕过 NetworkService | 迁移至 `NetworkService.netFetch()` | 03/ISSUE_STATUS |
| 22 | **Recents 未使用截图方案** | 虽然不再重复渲染，但 Recents 卡片仍渲染完整 App 内容，多任务时性能开销大 | 改为截图/快照方案，在 App 进入后台时捕获缩略图 | UNIFIED/mobile-gym-review |

---

## 三、P2 — 代码质量与规范执行

### ✅ 已解决

| # | 问题 | 原状 | 现状 | 来源 |
|---|------|------|------|------|
| 23 | navigation.declaration.ts 覆盖不足 | 仅 17/31 个 App 有声明文件 | 26/26 个现存 App 全部覆盖 | 03/04/UNIFIED |
| 24 | 5 个 App 零 data-trigger 属性 | Calendar/Notes/Sms/Weather/QQMusic 完全没有 Agent 可观测标签 | Calendar/Notes/Sms/Weather 均已添加手势钩子和 `data-trigger`；QQMusic 已移除 | 00/03/UNIFIED |
| 25 | 残缺应用目录 | apps/12306、apps/Douban、apps/XiaomiWeather 无有效代码 | 12306 已加入 `.gitignore`，Douban 和 XiaomiWeather 目录已不存在 | 03 |
| 26 | 无虚拟列表 | 项目未使用任何虚拟滚动 | `@tanstack/react-virtual` 已引入并封装为 `os/hooks/useVirtualList.ts`，已在 X/WechatReading/Spotify/Bilibili 等 5 个页面使用 | 02/UNIFIED |
| 27 | Date.now() 绕过 TimeService | 176 处 `Date.now()` 直接调用 | ID 生成/用户时间戳已全部迁移至 `TimeService.now()`。剩余调用均为合法用途（秒表/计时器/手势检测/性能日志/防抖等） | 03/04/UNIFIED |
| 28 | safeParseJSON 重复 | 5 个 App + 4 个 OS 文件各自实现 | 已提取为 `os/utils/safeParseJSON.ts`，OS 文件已改为导入共享函数 | 03/UNIFIED |
| 29 | Toast 组件重复 | 6 个 App 逐字复制同一实现 | 已提取为 `os/components/Toast.tsx`，多个 App 已改为导入共享组件 | 03/UNIFIED |
| 30 | navigation.types.ts 16 个 App 重复 | 16 个 App 维护同一文件 | 随导航系统重构，已统一为 OS 层共享类型 | 01/03 |
| 31 | TypeScript 宽松 | tsconfig 无 strict 模式 | 已启用完整 `"strict": true`，修复 ~130 处类型错误 | 03/UNIFIED |

### ⚠️ 部分解决

| # | 问题 | 原状 | 现状 | 剩余工作 | 来源 |
|---|------|------|------|---------|------|
| 32 | 零测试覆盖 | 无任何测试文件，package.json 无 Vitest/Jest | 已引入 Vitest，有 4 个测试文件（`createAppStore.test.ts`、`osReducer.test.ts`、`taskUtils.test.ts`、`ServiceRegistry.test.ts`） | 覆盖范围仍偏低，需扩展到 Intent 解析、存储隔离、导航系统等 | 03/UNIFIED/PROJECT |

### ❌ 未解决

| # | 问题 | 说明 | 建议 | 来源 |
|---|------|------|------|------|
| 33 | **硬编码颜色** | Railway12306(242处)、RedBook(139)、Bilibili(95)、Spotify(75) 大量 `bg-[#xxx]` 内联颜色 | 逐步迁移到 `res/colors.ts` + CSS 变量 | 03/UNIFIED |
| 34 | **any 类型滥用** | Spotify/Wechat/X 各有 65 处 `any` 类型 | 逐步替换为具体类型 | 03 |
| 35 | **i18n 不完整** | Calculator2 缺 20 个英文键；Bilibili 几乎不使用 strings.ts（884 处硬编码中文） | 补全英文翻译，逐步迁移硬编码字符串到 `res/strings.ts` | 03 |
| 36 | **图标规范违规** | TencentMeeting defaults.json 使用原始 Lucide 名称（`"Home"`/`"Video"`）；Map defaults.json 使用小写 icon 名称 | 统一改为 `Ic*` 前缀 | 03 |

### 🔘 不再适用

| # | 问题 | 说明 |
|---|------|------|
| 37 | BilibiliContext 函数未 useCallback | Bilibili 已迁移至 Zustand store，Context 不再使用 |

---

## 四、P3 — 功能差距与长期演进

### ✅ 已解决

| # | 问题 | 原状 | 现状 | 来源 |
|---|------|------|------|------|
| 38 | App 生命周期缺失 | 完全没有 onPause/onResume 回调 | 已实现 `os/AppLifecycle.ts`，支持 `foreground`/`background`/`destroy` 三种事件 | 01/06/UNIFIED/PROJECT |
| 39 | 权限系统缺失 | `manifest.permissions` 字段声明但不执行 | 已实现完整方案：`PermissionService.ts` + `PermissionDialog.tsx` + `permissions.ts` | 06/UNIFIED/PROJECT |
| 40 | BroadcastReceiver 缺失 | 无法模拟跨 App 事件通知 | 已实现 `os/BroadcastBus.ts`，支持 `sendBroadcast`/`sendOrderedBroadcast`/`registerReceiver` | 06/UNIFIED |
| 41 | ContentProvider 缺失 | 联系人/媒体库等无法跨 App 共享查询 | 已实现 `os/ContentProvider.ts` + `os/ContentResolver.ts`，有 `MediaProvider`/`ContactsProvider` 实现 | 06/UNIFIED |
| 44 | Intent Chooser / ShareSheet 缺失 | 原预留 `intentChooserEnabled` 但多匹配时直接取第一个 | 已实现 `os/components/IntentChooserSheet.tsx`，IntentResolver 在配置开启时显示选择器，SystemShell 已挂载 | 06/UNIFIED/mobile-gym-review |
| 45 | 动态时间推进缺失 | 原为静态 simulatedTime、设定后不再走动 | 已实现 `TimeService.setSpeed()`/`setFlowing()`/`useSimulatedTime()`，时间可流动可调速，暴露 `window.__SIM_TIME__` | PROJECT/mobile-gym-review |
| 42 | 全局 ErrorBoundary 缺失 | 仅 Notes 有 ErrorBoundary | `os/components/AppErrorBoundary.tsx` 已在 `appRegistry.tsx` 中包裹所有 App；apps 下无冗余自有 ErrorBoundary | UNIFIED |

### ❌ 未解决

| # | 问题 | 说明 | 建议 | 来源 |
|---|------|------|------|------|
| 43 | **通知 Actions 缺失** | 通知只能点击跳转，不支持快捷回复/标记已读。`OSNotification` 接口无 `actions` 字段 | 扩展 `NotificationService` 支持 `actions[]` | 06/UNIFIED |

### 🔘 不再适用

| # | 问题 | 说明 |
|---|------|------|
| 46 | AppId 包含 `phone` 但无 manifest | 随类型系统重构，`AppId` 已改为 `string` 别名，通过 manifest 自动发现 |

---

## 五、Benchmark 环境专项

### ❌ 未解决

| # | 问题 | 文件 | 建议 | 来源 |
|---|------|------|------|------|
| 47 | **crossapp3 依赖外部 HTTP** | `bench_env/task/crossapp3/tasks.py:629,863` 仍 `requests.get()` 外部 URL | 改为缓存数据或 mock | 05/UNIFIED |
| 48 | **crossapp3 绕过 `warm_apps`** | `_CrossApp3Task.setup()` 完全绕过 `BaseTask.setup()` 和 `warm_apps` | 统一使用父类机制 | 05/UNIFIED |
| 49 | **状态同步竞态** | `set_state` 后无 React 渲染等待；`_reset_sim` 只等 `domcontentloaded` 不等 React 恢复 | 增加 React 渲染完成等待机制 | 05/UNIFIED |
| 50 | **AnswerTask 假阳性**（同 #6） | `bench_env/task/common_tasks.py` | ✅ 已随 P0 #6 修复（`_NUM_PATTERN` + `_match_numeric`） | 05/UNIFIED |
| 51 | **AutoGLM 假完成**（同 #7） | `bench_env/agent/autoglm.py:299` | 见 P0 #7 | 05/UNIFIED |

---

## 六、设计理念与架构张力（跨报告共识）

以下问题不是 bug，而是项目设计中的结构性张力，多份报告一致指出：

| # | 张力 | 说明 | 来源 |
|---|------|------|------|
| 52 | **三目标冲突** | Agent 可观测（data-trigger 字面量）↔ 开发者效率（灵活 React）↔ bench_env 可配置（替换 defaults.json）。当前通过 CLAUDE.md 约定管理，执行效果参差不齐 | 04/UNIFIED/analysis_report1 |
| 53 | **单进程 React SPA 模拟多进程 Android OS** | 无法真正隔离 App 内存和状态；一个 App 卡顿影响整个 OS；无 OOM killer | PROJECT/mobile-gym-review |
| 54 | **AOSP 仿真层形式与实质脱节** | `dimens.ts` 出现 `itemWidth_24` 反模式；`colors.ts` 出现 `tw-text-gray-400` Tailwind 命名泄漏；`data/index.ts` 复杂度分化极大 | 04/UNIFIED/analysis_report1 |
| 55 | **"有状态无行为"的系统服务** | WiFi 关闭但 fetch 照通、飞行模式不影响网络、手电筒不亮、音量无音频——Agent 可能学到错误认知 | 06/mobile-gym-review |

---

## 七、教学价值相关建议（多份报告一致）

| # | 建议 | 当前状态 | 来源 |
|---|------|---------|------|
| 56 | Android 概念映射文档（`docs/ANDROID_COMPAT.md`） | ✅ 已实现（文档名为 `docs/SIMULATOR_ARCHITECTURE_AND_ANDROID_MAPPING.md`，内容为模拟器架构与 Android 对应关系） | PROJECT/mobile-gym-review/06 |
| 57 | 每个 OS Service 文件头部标注 Android 等价物 + 已知差距 | ❌ 未实现 | 06/mobile-gym-review |
| 58 | 系统级干扰引擎（来电/低电量/WiFi 断连等） | ❌ 未实现 | PROJECT/mobile-gym-review |
| 59 | 系统事件日志/trace + 回放 | ❌ 未实现 | mobile-gym-review |

---

## 八、推荐下一步优先级

### 🔴 立即处理（安全 + 评测可信度）

1. **密钥泄露**（#5）：移除 `osConfig.ts` 中的 API key，`.env` 加入 `.gitignore`
2. ~~**AnswerTask 假阳性**（#6）~~：✅ 已修复（数字边界 + 小数支持）
3. **AutoGLM 假完成**（#7）：解析失败改为 `_finish: False`

### 🟡 近期改善（性能 + 架构）

4. **Recents 截图方案**（#22）：消除完整 App 渲染开销
5. **后台 App LRU 回收**（#19）：控制内存增长
6. **Spotify 迁移 NetworkService**（#21）：消除直接外部 fetch
7. **清理剩余 useNavigate 违规**（#16）：仅剩 Map 应用的 `navigateTo` 遗留

### 🟢 持续改进（质量 + 功能）

8. 扩展测试覆盖（#32）
9. ~~启用 strict（#31）~~ ✅ 已启用完整 `strict: true`
10. 通知 Actions（#43）
11. ~~Intent Chooser/ShareSheet（#44）~~ ✅ 已实现
12. crossapp3 评估逻辑修复（#47/#48）
13. ~~动态时间推进（#45）~~ ✅ 已实现

---

## 九、综合评估

### 解决进展评分

对比 2026-02-25 的原始分析，截至 2026-03-04 的改进情况：

| 维度 | 原评分 | 现评分 | 变化 | 关键改进 |
|------|--------|--------|------|---------|
| **架构设计** | ★★★★☆ | ★★★★☆+ | ↑ | Zustand 重构消除循环依赖；统一导航桥接；BroadcastBus + ContentProvider 已实现 |
| **功能完整度** | ★★★☆☆ | ★★★★☆ | ↑↑ | 权限系统 + App 生命周期 + BroadcastReceiver + ContentProvider 四大组件均已实现 |
| **App 生态** | ★★★☆☆ | ★★★★☆ | ↑↑ | 所有 App 补全 declaration + data-trigger |
| **代码质量** | ★★☆☆☆ | ★★★☆☆ | ↑↑ | Zustand 迁移、导航统一、Date.now 清理、Toast/safeParseJSON 统一、引入 Vitest |
| **性能** | ★★☆☆☆ | ★★★☆☆+ | ↑↑ | Context 重渲染消除、JSON 异步化、localStorage 防抖、虚拟列表引入、OSContext useMemo |
| **安全** | ★★☆☆☆ | ★★☆☆☆ | → | 密钥仍在仓库（CDN 注入已修） |
| **Benchmark** | ★★★☆☆ | ★★★☆☆ | → | 核心评估逻辑缺陷（AnswerTask/AutoGLM/crossapp3）均未修 |
| **教学价值** | ★★★☆☆ | ★★★☆☆ | → | 缺少 Android 概念映射文档 |
| **真实度** | ★★★☆☆ | ★★★☆☆+ | ↑ | 权限弹窗 + 生命周期 + 广播 + ContentProvider 提升了系统行为真实度 |

### 核心结论

项目在 2026-02-25 至 2026-03-04 期间取得了显著进展，**30 个问题已解决、2 个部分解决**（含 2026-03-05 核查：原「未解决」的 #6/#44/#45/#56 已实现；原「部分解决」的 #17 localStorage、#18 大型 JSON、#31 TypeScript strict、#42 ErrorBoundary 已全部解决并并入已解决）。最大的架构改进包括：

1. **Zustand 重构**：彻底消除了 OS→Apps 循环依赖、状态双路径不一致、Context 全量重渲染三大问题
2. **Android 四大组件补全**：Activity(生命周期) ✅ → Service ⚠️ → BroadcastReceiver ✅ → ContentProvider ✅
3. **导航系统统一**：`AppNavigatorRegistry` + `useAppNavigationHandler` 替代了全局单例

**仍需紧急处理的问题**：密钥泄露（安全）、AnswerTask/AutoGLM 评估缺陷（Benchmark 可信度）。

**最大的技术债务**：后台 App 永久挂载（性能）、Recents 非截图方案（性能）、Map 应用 navigateTo 遗留（规范）。

---

## 附录 A：未实现项核查记录（2026-03-05）

对文档中标注「未解决/未实现」的条目做了代码验证，以下**已实现**并已并入上文「已解决」或状态更新：

| 原编号 | 条目 | 验证结论 |
|--------|------|----------|
| #6 | AnswerTask 数值匹配假阳性 | `bench_env/task/common_tasks.py` 已使用 `_NUM_PATTERN`（`(?<!\d)-?\d+(?:\.\d+)?(?!\d)`）与 `_match_numeric()`，支持数字边界、小数与浮点容差 |
| #44 | Intent Chooser / ShareSheet | `os/components/IntentChooserSheet.tsx` 存在，`IntentResolver` 在 `intentChooserEnabled` 时展示选择器，`SystemShell` 已挂载 |
| #45 | 动态时间推进 | `os/TimeService.ts` 已提供 `setSpeed()`、`setFlowing()`、`useSimulatedTime()`，并暴露 `window.__SIM_TIME__` |
| #50 | AnswerTask 假阳性（Benchmark） | 与 P0 #6 同一逻辑，已随 #6 修复 |
| #56 | Android 概念映射文档 | 已有 `docs/SIMULATOR_ARCHITECTURE_AND_ANDROID_MAPPING.md`，内容为模拟器架构与 Android 对应关系（与 ANDROID_COMPAT 等价） |

**部分解决 → 已全部解决的**（2026-03-05 核查）：#17 localStorage（apps 下无直接 setItem，仅 os/debouncedPersist 统一写入）；#18 大型 JSON（Ebay/Railway12306/Reddit 均已 fetch 异步加载）；#31 TypeScript（tsconfig 已 `"strict": true`）；#42 全局 ErrorBoundary（appRegistry 已包裹所有 App，apps 下无冗余 ErrorBoundary）。以上已移入「已解决」。

**仍为部分解决**：#16 Map 的 `navigateTo`/`useNavigate` 遗留；#32 测试覆盖仍仅 4 个文件、范围未扩展。

以下经核查**仍未实现**：密钥泄露（#5）、AutoGLM 解析失败当作完成（#7）、Spotify 直接 fetch（#21）、通知 Actions（#43）、crossapp3 外部 HTTP/绕过 warm_apps（#47/#48）等，与文档描述一致。

---

## 附录 B：文档来源索引

| 简称 | 文件 | 说明 |
|------|------|------|
| 00 | `00-综合报告索引.md` | 综合优先级矩阵 |
| 01 | `01-系统架构分析.md` | 模块组织、依赖关系、全局 API、类型系统 |
| 02 | `02-性能分析.md` | React 渲染、内存、Bundle、滚动、启动 |
| 03 | `03-代码质量与完善度.md` | App 完整性、规范违规、代码重复、类型安全 |
| 04 | `04-设计理念分析.md` | AOSP 仿真、Agent 可观测性、CSS 变量、可扩展性 |
| 05 | `05-基准测试环境分析.md` | 任务质量、Agent 类型、前后端协议、可复现性 |
| 06 | `06-Android系统对比.md` | 功能差距、完善路线图、学习资源潜力 |
| UNIFIED | `UNIFIED_ANALYSIS_REPORT.md` | 4 份报告的去重整合 |
| PROJECT | `PROJECT_ANALYSIS_REPORT.md` | 全面分析报告 |
| analysis_report1 | `analysis_report1.md` | 6 代理并行分析结果 |
| analysis_report2 | `analysis_report2.md` | 架构深度分析 |
| ISSUE_STATUS | `ISSUE_STATUS_REPORT.md` | 2026-03-03 状态追踪 |
| mobile-gym-review | `mobile-gym-project-review-2026-02-25.md` | 项目问题分析与演进建议 |
