# mobile-gym 待解决问题清单

> 整理日期：2026-03-06
> 来源：`todos/` 目录下 10 份分析文档的去重整合，保留仍未解决或部分解决的条目
> 已解决的问题已移除（完整历史见 `todos-opus.md` 和 `todos-gpt.md`）

---

## 状态说明

| 符号 | 含义 |
|------|------|
| ❌ | 未解决 |
| ⚠️ | 部分解决 |
| ❓ | 未核验（文档层面提出的风险点，未确认当前代码状态） |

---

## 一、P0 — 安全与评测可信度

### 1. 密钥/令牌泄露到仓库 ❌

- `os/data/osConfig.ts` 存在硬编码 `sk-...` 形态字符串
- 根目录 `.env` 文件未被 `.gitignore` 忽略
- `bench_env/README.md` 示例中出现 `--judge-api-key ...`（建议改为占位符）
- **建议**：移除所有真实 key/token，`.env` 加入 `.gitignore`，补充 `env.example`

### 2. AutoGLM 解析失败当作完成（假完成） ❌

- `bench_env/agent/autoglm.py` 解析失败时仍 `return {"_finish": True, ...}`
- **影响**：严重污染 Pass@k/成功率统计
- **建议**：改为 `_finish: False` 或 ABORT 状态

---

## 二、P1 — 架构与性能

### 3. 后台 App 永久挂载（无 LRU 回收） ❌

- 所有 `runningApps` 始终 mount（`display:none`），无淘汰机制
- 28 个 App 全开后 DOM 节点数万、内存持续增长
- 隐藏 App 仍运行 effect、计时器、订阅
- **建议**：引入 LRU 回收策略，保留最近 N 个 App mounted，其余 unmount + 序列化状态

### 4. `__SIM__.getState()` 全量读取 ❌

- 每次调用遍历所有 App 状态（`getAllAppStates()`），Agent 高频调用时为瓶颈
- **建议**：增加分级选项（`activeOnly`/`running`/`all`）+ 脏标记机制

### 5. Recents 未使用截图方案 ❌

- 虽然不再重复渲染，但 Recents 卡片仍渲染完整 App 内容，多任务时性能开销大
- **建议**：改为截图/快照方案，在 App 进入后台时捕获缩略图

### 6. Spotify 直接 fetch 外部 API ❌

- 5 处直接调用 iTunes API（`fetch('https://itunes.apple.com/...')`），绕过 NetworkService
- 位置：`apps/Spotify/pages/PlaylistPage.tsx`、`ChooseArtistsPage.tsx`、`LibraryPage.tsx`、`ArtistPage.tsx`
- **建议**：迁移至 `NetworkService.netFetch()`

---

## 三、P2 — 代码质量与规范

### 7. useNavigate 违规遗留 ⚠️

- 业务页面（`pages/`）已全部清理。`useNavigate` 仅存在于合法基础设施代码中
- **剩余**：Map 应用 `navigateTo` 为已知遗留

### 8. 测试覆盖不足 ⚠️

- 已引入 Vitest，有 4 个测试文件（`createAppStore.test.ts`、`osReducer.test.ts`、`taskUtils.test.ts`、`ServiceRegistry.test.ts`）
- 覆盖范围仍偏低，需扩展到 Intent 解析、存储隔离、导航系统等

### 9. 硬编码颜色过多 ❌

- Railway12306(242处)、RedBook(139)、Bilibili(95)、Spotify(75) 大量 `bg-[#xxx]` 内联颜色
- **建议**：逐步迁移到 `res/colors.ts` + CSS 变量

### 10. any 类型滥用 ❌

- Spotify/Wechat/X 各约 65 处 `any` 类型
- **建议**：逐步替换为具体类型

### 11. i18n 不完整 ❌

- Calculator2 缺 20 个英文键
- Bilibili 几乎不使用 strings.ts（大量硬编码中文）
- **建议**：补全英文翻译，逐步迁移硬编码字符串到 `res/strings.ts`

### 12. 图标规范违规 ❌

- TencentMeeting `defaults.json` 使用原始 Lucide 名称（`"Home"`/`"Video"`）
- Map `defaults.json` 使用小写 icon 名称
- **建议**：统一改为 `Ic*` 前缀

---

## 四、P3 — 功能差距

### 13. 通知 Actions 缺失 ❌

- 通知只能点击跳转，不支持快捷回复/标记已读
- `OSNotification` 接口无 `actions` 字段
- **建议**：扩展 `NotificationService` 支持 `actions[]`

---

## 五、Benchmark 环境

### 14. crossapp3 依赖外部 HTTP ❌

- `bench_env/task/crossapp3/tasks.py` 中 `requests.get()` 访问外部 URL
- 网络不可用时所有依赖此函数的任务均判 False、外部网站内容随时变更
- **建议**：改为缓存数据或 mock

### 15. crossapp3 绕过 warm_apps ❌

- `_CrossApp3Task.setup()` 完全绕过 `BaseTask.setup()` 和 `warm_apps` 机制
- **建议**：统一使用父类机制

### 16. 状态同步竞态 ❌

- `set_state` 后无 React 渲染等待
- `_reset_sim` 只等 `domcontentloaded` 不等 React 恢复
- **建议**：增加 React 渲染完成等待机制

---

## 六、未核验项（低优先级 / 需确认）

### 17. APP_NAME_MAP 双重维护 ❓

- `os/AgentBridge.ts` 与 `bench_env/env/mobile_gym.py` 各自维护中文名到 appId 的映射
- 需确认是否已通过 manifest `aliases` 自动化

### 18. NetworkService 非字符串 body 处理 ❓

- `FormData`/`Blob`/`ArrayBuffer` 等非字符串 body 可能被静默丢弃

### 19. Gallery 滚动性能 ❓

- `onScroll` 每帧 setState，无 requestAnimationFrame 包裹或 throttle

### 20. "有状态无行为"的系统开关 ❓

- WiFi 关闭但 fetch 照通、飞行模式不影响网络、手电筒不亮、音量无音频
- Agent 可能学到错误认知
- **说明**：这是 Web 平台固有限制，完全模拟代价大

### 21. dimensToCssVars 副作用 ❓

- 包含 DOM 注入副作用，若未 memo 可能带来额外开销

### 22. 小红书首开数据处理慢 ❓

- 首次打开 2-5s，文档自评"低优先级，可接受"

---

## 七、结构性洞察（不是 Bug，但值得关注的设计张力）

以下不是待修复的问题，而是项目固有的架构特点，在做重大决策时应考虑：

### A. 三目标冲突

项目同时追求三个目标，它们在实现层面存在持续矛盾：
- **Agent 可观测**（data-trigger 字面量、静态分析建图）
- **开发者效率**（灵活的 React 代码）
- **bench_env 可配置**（替换 defaults.json 改变行为）

当前通过 CLAUDE.md 约定管理，执行效果参差不齐。

### B. 单进程 React SPA 模拟多进程 Android OS

| Android 概念 | React SPA 映射 | 本质矛盾 |
|---|---|---|
| 多个独立进程 | 同一 React 渲染树 | 无法真正隔离 App 内存和状态 |
| Activity 生命周期 | display: none/block | 无法触发 pause/resume/destroy 回调（已部分解决） |
| 进程优先级 + OOM killer | 所有 App 常驻内存 | 永远不会发生 low-memory killing |
| 独立 UI 线程 | 单线程 React reconciler | App 卡顿会影响整个 OS |

### C. "有状态无行为"的系统服务

部分系统开关只改变 UI 状态，不影响实际行为（WiFi/飞行模式/手电筒/音量等）。这是 Web 平台的固有限制，完全模拟需要 Service Worker 拦截等重量级方案，投入产出比低。

---

## 附：推荐优先级

### 🔴 立即处理（安全 + 评测可信度）

1. 密钥泄露（#1）
2. AutoGLM 假完成（#2）

### 🟡 近期改善（性能 + 质量）

3. 后台 App LRU 回收（#3）
4. Spotify 迁移 NetworkService（#6）
5. crossapp3 评估修复（#14、#15）
6. 状态同步竞态（#16）

### 🟢 持续改进

7. 扩展测试覆盖（#8）
8. 通知 Actions（#13）
9. Recents 截图方案（#5）
10. 图标/颜色/i18n 规范化（#9、#11、#12）

---

## 附：已解决问题概要（供参考）

以下问题在 2026-02-25 至 2026-03-05 期间已解决，完整记录见 `todos-opus.md`：

- Zustand 重构消除 OS→Apps 循环依赖、状态双路径、Context 全量重渲染
- `AppNavigatorRegistry` + `useAppNavigationHandler` 替代全局单例
- Ebay/Reddit/Railway12306 大型 JSON 改为异步加载
- localStorage 全量序列化 → debouncedPersist
- 权限系统、App 生命周期、BroadcastReceiver、ContentProvider 四大组件实现
- Intent Chooser/ShareSheet 实现
- TimeService 支持时间流动/调速
- TypeScript strict 模式启用
- Toast/safeParseJSON 统一到 OS 层
- AnswerTask 数值匹配修复
- 全局 ErrorBoundary 包裹所有 App
- 虚拟列表引入（@tanstack/react-virtual）
- 所有 App 补全 navigation.declaration + data-trigger
