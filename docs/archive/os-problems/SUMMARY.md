# mobile-gym 模拟器代码审查综合报告

> 综合 5 份独立审查报告，按共性/独特性分类，并结合 benchmark 发布目标给出优先级判断。

> **修复状态审查**（2026-03-06）：已逐项检查代码现状，标记如下：
>
> - ✅ 已修复
> - ⚠️ 部分修复
> - ❌ 未修复

---

## 第一部分：共性问题（3 份及以上报告提出）

以下问题被多份报告独立识别，代表高度共识的核心痛点。

### 1. 架构层

#### 1.1 OSContext 职责过重 [全部 5 份] ❌ 未修复

`OSContext.tsx`（当前 505 行）仍同时承担：TaskManager/IntentResolver 订阅、BackDispatcher 注册、AppLifecycle 派发、`__OS__`/`__SIM__` 全局 API 构建与挂载、`openApp`/`finishTopActivity` 等业务逻辑、`deepMerge` 工具函数、`getState()` 的 Launcher 缓存逻辑。TaskManager/IntentResolver/BackDispatcher 已抽到独立模块，但编排和 API 构建仍在一个文件中。

#### 1.2 OS 层硬编码 import Contacts/Gallery state [全部 5 份] ✅ 已修复

~~OS 直接 import 特定 App 的 state 用于 ContentProvider 注册。~~ 已改为：`os/providers/ContactsProvider.ts` 仅 import 类型；`MediaProvider` 通过依赖注入接收 `getGalleryState`；App 自身 state 文件负责注册 Provider。OS 不再直接 import App state。

#### 1.3 `window.__OS__` 用 `as any` 暴露，丧失类型安全 [全部 5 份] ⚠️ 部分修复

`globals.d.ts` 已为 `window.__OS__` 和 `window.__SIM__` 定义了 `OSApi` / `SimApi` 类型接口，调用方有 IDE 补全。但 `OSContext.tsx` 中赋值处仍使用 `as any` 绕过类型检查。

#### 1.4 `__OS__`/`__SIM__` 频繁重建 [报告 1,2,4,5] ❌ 未修复

`window.__OS__` 在 `useEffect` 中赋值，依赖 `osStateForApi` 等——每次 TaskManager 状态变化都重建整个对象。`__SIM__` 依赖 `[state]`，每次 OS 状态变化都重建。无 `useRef` 稳定化措施。

#### 1.5 `as any` 全项目泛滥（170-220+ 处）[全部 5 份] ❌ 未修复

仍有 200+ 处 `as any`，分布在约 100 个文件中。重灾区不变：DeviceService（54 处）、Launcher（16 处）等。

### 2. 性能层

#### 2.1 OSProvider 订阅粒度过粗 [报告 1,3,4,5] ❌ 未修复

`useSyncExternalStore` 仍订阅完整 `TaskManager.getState` 和 `IntentResolver.getState`，无 selector 模式。

#### 2.2 StatusBar 颜色检测开销大 [报告 2,4,5] ❌ 未修复

`SystemShell.tsx` 仍使用 `elementFromPoint` + `MutationObserver` 检测状态栏颜色。

#### 2.3 `__SIM__.getState()` 每次重建大对象 [报告 2,3,5] ⚠️ 部分修复

Launcher 部分已加缓存（`_launcherCacheRaw`/`_launcherCacheParsed`），但其余部分（time, location, installedApps, clipboard, device, notifications 等）仍每次调用重建。

#### 2.4 超大文件难维护 [报告 2,3,4,5] ❌ 未修复

| 文件                                          | 原行数     | 当前行数 |
| --------------------------------------------- | ---------- | -------- |
| Map/pages/ExplorePage.tsx                     | ~2853      | ~2826    |
| launcher/Launcher.tsx                         | ~2400      | ~2980 ⬆ |
| TencentMeeting/ScheduleRegularMeetingPage.tsx | ~1800      | 未检查   |
| SystemShell.tsx                               | ~1000-1354 | ~1390    |
| DeviceService.ts                              | ~1296      | ~1297    |
| KeyboardOverlay.tsx                           | ~960       | 未检查   |
| simInput.ts                                   | ~764       | 未检查   |
| OSContext.tsx                                 | ~709       | ~505 ⬇  |

### 3. 与真实 Android 的差距

#### 3.1 Activity 生命周期严重简化 [全部 5 份] ❌ 未修复

仅有 `foreground`/`background`/`destroy` 三个事件，缺少：

- onPause / onResume（失去/重获焦点）
- onStop / onStart（完全不可见/重新可见）
- onSaveInstanceState / onRestoreInstanceState（进程被杀后恢复）

#### 3.2 无 launchMode [报告 1,2,3,5] ❌ 未修复

缺少 `singleTop`、`singleTask`、`singleInstance` 等启动模式。所有 Activity 均为 standard 模式，无法模拟单实例 Activity 等常见场景。

#### 3.3 通知系统简化 [报告 1,2,3,5] ❌ 未修复

无 Notification Channels、Actions（回复/标记已读）、分组折叠、富通知（BigText/BigPicture/Inbox）。仅支持简单 title + body。

#### 3.4 权限系统简化 [报告 1,2,3,5] ❌ 未修复

无权限组细分、无"仅此一次"选项、无 shouldShowRationale、不绑定 Activity 生命周期。

#### 3.5 多窗口/分屏缺失 [报告 2,3,5] ❌ 未修复

完全无实现。Settings 中有配置入口但无功能。

#### 3.6 Intent 系统能力不完整 [报告 1,2,3,5] ❌ 未修复

缺少 `FLAG_ACTIVITY_*` 标志、`categories`、完整 Data URI MIME type 匹配、`component` 显式指定、URI 权限授予、Service/Broadcast Intent。

### 4. App 层一致性

#### 4.1 Map/ExplorePage 直接用 `navigate()` [报告 2,3,4,5] ✅ 已修复

原有约 20+ 处跨路由 `navigate('/search')` 等调用已全部改为通过 `go()`/`back()`。仅剩 `replaceState` 使用 `navigate('.', { replace: true, state })` 更新当前路由的 `location.state`，这不是路由跳转而是状态传递，不影响导航图/任务生成。

#### 4.2 `position: fixed` 违规使用 [报告 2,3,5] ⚠️ 部分修复

- Alipay/AlipayApp.tsx — 底部 TabBar ✅ 已改为 `flex-shrink-0` + `data-hide-on-keyboard`
- RedBook/components/TabBar.tsx — 底部 TabBar ✅ 已改为 `flex-shrink-0` + `data-hide-on-keyboard`
- Bilibili/VideoDetailPage — 评论输入区 ✅ 已改为 `flex-shrink-0`
- Gallery/GalleryApp.tsx — ✅ 已改为 `absolute bottom-0`

OS 层新增通用机制：`data-adjust-resize` 容器在键盘弹出时自动标记 `data-keyboard-active`，全局 CSS 隐藏带 `data-hide-on-keyboard` 属性的元素。其余 App 可按需添加该属性。`apps/` 目录下仍有其他 `fixed bottom-0` 使用需逐步排查。

#### 4.3 Manifest 字段缺失 [报告 1,2,3] ❌ 未修复

- Alipay 仍缺少 `displayNameEn` 和 `aliases`
- 仅 2 个 App 声明 `aliases`（Railway12306、Contacts），大部分仍缺失

#### 4.4 NavigationHandler 模式不统一 [报告 1,4,5] ❌ 未修复

内联定义（WechatApp、MapApp、SpotifyApp、GalleryApp 等）vs 独立文件（RedBook、FileManager、Ebay、Compass、Alipay）两种方式仍并存。

#### 4.5 缺少共享组件目录 [报告 1,3,5] ❌ 未修复

无 `shared/` 或 `common/` 组件目录。多个 App 仍各自实现相似组件（TabBar 9+、Switch 5+、Header 5+ 等）。

### 5. 代码质量 & 工程

#### 5.1 createSystemService 浅拷贝隐患 [报告 2,3,4,5] ❌ 未修复

`cloneState` 仍仅做一层浅拷贝。

#### 5.2 颜色工具函数等代码重复 [报告 1,2,4,5] ✅ 已修复

`parseColor`、`shouldUseLightText`、`getLuminance` 已统一到 `SystemShell.tsx` 中，StatusBar 和 GestureBar 共享同一份实现。

#### 5.3 错误处理不充分 [报告 1,2,4] ❌ 未修复

`finishTopActivity` 和 `closeTask` 仍使用 `catch { /* ignore */ }` 静默忽略导航异常。

#### 5.4 `package.json` name 为 "wechat-replica" [报告 1,2,3,4] ❌ 未修复

`package.json` name 仍为 `"wechat-replica"`。

#### 5.5 tsconfig `experimentalDecorators` 无用 [报告 1,3,4,5] ❌ 未修复

`tsconfig.json` 仍包含 `"experimentalDecorators": true`。

#### 5.6 脚本目录冗余 [报告 1,4,5] ❌ 未修复

`scripts/` 下当前 85 个文件，含 12 个 `migrate_*` 和 4 个 `cleanup_*` 一次性脚本。

---

## 第二部分：各报告独特发现

以下问题仅被 1-2 份报告提出，代表不同审查视角的独特洞察。

### 报告 1 独有（关注组件级优化）

| 问题                                        | 说明                                                                   | 状态          |
| ------------------------------------------- | ---------------------------------------------------------------------- | ------------- |
| AppStateRegistry 与 createAppStore 职责重叠 | `getAllAppStates()` 只是 `getAllStoreStates()` 的薄封装            | ❌ 未修复     |
| useAppReady 的 `app-ready` 事件无消费者   | 可能是无效代码                                                         | ❌ 未修复     |
| osConfig 硬编码 API Key                     | `aiApiKey` 直接写在代码中，泄露风险                                  | ❌ 未修复     |
| KeyboardOverlay 内部定义子组件              | 每次父组件渲染重建组件引用                                             | ❌ 未修复     |
| Launcher 11+ 处 `backdrop-blur`           | 低端设备合成性能问题                                                   | 未检查        |
| 滚动事件无节流                              | `useScrollPosition` 每次 scroll 写 sessionStorage                    | 未检查        |
| Context value 未 memo                       | 部分已 memo（OSContext、ThemeContext），但 ActivityContext 等仍未 memo | ⚠️ 部分修复 |

### 报告 2 独有（关注 Service 耦合与 UI 真实性）

| 问题                                       | 说明                                           | 状态                  |
| ------------------------------------------ | ---------------------------------------------- | --------------------- |
| Service 间循环依赖                         | DeviceService ↔ QuickSettingsService 双向订阅 | ✅ 已修复（改为单向） |
| ServiceRegistry.get() 抛异常               | 服务未注册时直接 throw                         | ❌ 未修复             |
| DeviceService 400+ 行 switch-case 偏好映射 | 应数据驱动化                                   | 未检查                |
| `_replaceState` 暴露内部 API             | 多个 Service 绕过 `set()` 变更检测           | 未检查                |
| AgentBridge 元素查找逻辑重复 3 次          | tap/double_tap/long_press 相同 TreeWalker 逻辑 | 未检查                |
| Material Ripple 缺失                       | 无水波纹触摸反馈效果                           | ❌ 未修复             |
| i18n 覆盖不全                              | IntentChooserSheet、IntentResolver 硬编码中文  | 未检查                |
| 三键导航、锁屏、App Drawer 缺失            | 仅手势导航                                     | ❌ 未修复             |
| @types/google.maps 在 dependencies         | 应移至 devDependencies                         | ❌ 未修复             |

### 报告 3 独有（关注 benchmark 正确性与 Agent 训练）

| 问题                                          | 说明                                          | 状态                      |
| --------------------------------------------- | --------------------------------------------- | ------------------------- |
| **Launcher 缓存与 localStorage 不同步** | `flushKey` + raw 字符串缓存机制正确处理同步 | ✅ 已修复                 |
| **IntentResolver 并发风险**             | `chooserResolver` 单例互相覆盖              | ✅ 已修复（新请求被拒绝） |
| **`__SIM__.setState` 竞态**           | 完全同步实现 + JS 单线程，无实际风险          | ✅ 无实际风险             |
| **TaskManager 不持久化**                | 未配置 `storageKey`                         | ❌ 未修复                 |
| **PermissionService 无超时**            | `pendingRequests` 永久挂起                  | ✅ 已修复（60 秒超时）    |
| 通知操作按钮缺失                              | 回复、标记已读等                              | ❌ 未修复                 |
| 长按图标 Shortcuts 缺失                       | 如微信扫一扫快捷方式                          | ❌ 未修复                 |
| 核心 App 功能缺失                             | 微信缺视频号/小程序/支付等                    | 未检查                    |
| 数据量不足                                    | 联系人约 10+，聊天每会话几条                  | 未检查                    |
| 系统设置大量占位页                            | `EXTERNAL_PAGE_PREFIX` 入口非完整功能       | 未检查                    |

### 报告 4 独有（关注稳定性与健壮性）

| 问题                                                    | 说明                                                 | 状态                                             |
| ------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| **缺少系统级 ErrorBoundary**                      | SystemShell 未包裹 ErrorBoundary                     | ✅ 已修复（SystemErrorBoundary 包裹各组件）      |
| **未捕获的 Promise 拒绝**                         | 无 `unhandledrejection` 处理                       | ✅ 已修复（index.tsx 注册全局处理）              |
| Contacts/state.ts `getPreference` 查询型 getter       | 违反 §5.3 规范                                      | ✅ 已修复（改为 standalone 函数 + memoSelector） |
| TaskManager.reset() 不重置序列号                        | `taskSeq`/`activitySeq` 持续递增                 | ❌ 未修复                                        |
| `globals.d.ts` 与实现类型不一致                       | `SimApi.reset(seed?)` vs 实现无 seed               | ❌ 未修复                                        |
| vite.config.ts/vitest.config.ts 未纳入 tsconfig include | 编译配置遗漏                                         | 未检查                                           |
| 脚本工作目录假设不一致                                  | 部分用 `process.cwd()`，部分用 `import.meta.url` | 未检查                                           |
| lint_store_getters.mjs 局限性                           | 正则解析可能误判                                     | 未检查                                           |

### 报告 5 独有（关注底层模拟保真度）

| 问题                                   | 说明                                           | 状态      |
| -------------------------------------- | ---------------------------------------------- | --------- |
| 全局对象启动时序依赖                   | `__OS__` useEffect 挂载前可能被访问          | ❌ 未修复 |
| 系统服务两套实现方式不统一             | `createSystemService` 派 vs 独立实现派       | 未检查    |
| **触摸事件模拟不完整**           | 无多点触控，Touch 字段缺失                     | ❌ 未修复 |
| WindowManager / 窗口层级缺失           | 通过 CSS z-index 管理                          | ❌ 未修复 |
| 无进程隔离                             | 所有 App 共享同一 React 树和 JS 上下文         | ❌ 未修复 |
| **Store 全量预加载**             | `import.meta.glob` eager 加载                | ❌ 未修复 |
| `document.execCommand` 已废弃        | KeyboardOverlay 和 simInput 中使用             | 未检查    |
| `setNativeValue` 依赖 React 内部实现 | 原型链查找 value setter                        | 未检查    |
| `openApp` 竞态条件                   | rAF 查找时 navigator 可能未注册                | 未检查    |
| BroadcastBus extras 浅拷贝             | receiver 修改 extras 会互相影响                | 未检查    |
| GestureBar 触摸/鼠标阈值不一致         | 触摸硬编码 40px vs 配置值                      | 未检查    |
| 状态栏预留方式不一致                   | `pt-10` vs `DEVICE_CONFIG.statusBarHeight` | 未检查    |
| App 永久挂载不卸载                     | 后台 subscription/timer 仍运行                 | ❌ 未修复 |
| `public/tailwind.css` 疑似未使用     | 旧版 Tailwind 输出                             | ❌ 未修复 |

---

## 第三部分：发布前优先级判断

以 benchmark 平台发布为目标，判断标准：**benchmark 结果正确 > 运行稳定不崩 > Agent 视觉感知正确 > 其他**。

### P0：发布前必须修复

#### 直接影响 benchmark 正确性

| # | 问题                                  | 来源         | 理由                                                                                                       | 状态          |
| - | ------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- | ------------- |
| 1 | Launcher 缓存与 localStorage 不同步   | 报告 3       | `flushKey` + raw 字符串比较缓存已正确处理同步问题                                                        | ✅ 已修复     |
| 2 | `__SIM__.setState` 竞态             | 报告 3       | 函数完全同步，JS 单线程下不会真正并发；benchmark setup 阶段与 App 运行阶段不重叠                           | ✅ 无实际风险 |
| 3 | Map/ExplorePage 直接用 `navigate()` | 报告 2,3,4,5 | 跨路由 `navigate('/search')` 等已全部改为 `go()`；仅剩 `navigate('.')` 用于 state 替换，不影响导航图 | ✅ 已修复     |
| 4 | Store getter 反模式                   | 报告 4       | UI 不随状态变化重渲染 → 判定/训练数据有毒                                                                 | ✅ 已修复     |
| 5 | TimeService 使用不统一                | 报告 4       | 部分组件用 `Date.now()`，时间戳不一致                                                                    | ✅ 已修复     |

#### 影响运行稳定性

| #  | 问题                     | 来源   | 理由                                     | 状态      |
| -- | ------------------------ | ------ | ---------------------------------------- | --------- |
| 6  | 缺少系统级 ErrorBoundary | 报告 4 | StatusBar/RecentsChrome 抛错 → 整体白屏 | ✅ 已修复 |
| 7  | PendingIntent 空引用     | 报告 1 | `match.filter.route` 无保护            | ✅ 已修复 |
| 8  | IntentResolver 并发风险  | 报告 3 | 连续发 Intent 互相覆盖                   | ✅ 已修复 |
| 9  | PermissionService 无超时 | 报告 3 | pending 永久挂起                         | ✅ 已修复 |
| 10 | 未捕获的 Promise 拒绝    | 报告 4 | 无全局 `unhandledrejection` 处理       | ✅ 已修复 |

#### 影响 Agent 视觉感知正确性

| #  | 问题                                     | 来源       | 理由                                                                           | 状态          |
| -- | ---------------------------------------- | ---------- | ------------------------------------------------------------------------------ | ------------- |
| 11 | `position: fixed` 违规（键盘交互页面） | 报告 2,3,5 | Alipay/RedBook TabBar 改为 `flex-shrink-0`；OS 新增 `data-hide-on-keyboard` 通用机制（键盘弹出时自动隐藏标记元素） | ✅ 已修复 |
| 12 | OS 硬编码 import Contacts/Gallery state  | 全部 5 份  | 已改为依赖注入 + App 自注册                                                    | ✅ 已修复     |

### P1：发布后近期改进

这些问题当前能工作，但属于技术债务或长期稳定性隐患。

| 问题                            | 理由                                 |
| ------------------------------- | ------------------------------------ |
| OSContext 职责过重 / 拆分       | 纯可维护性，当前功能正常，重构风险大 |
| `__OS__`/`__SIM__` 频繁重建 | 性能优化，26 App 规模下可接受        |
| OSProvider 粗粒度订阅           | 性能优化，不影响正确性               |
| createSystemService 浅拷贝      | 潜在 bug 但目前未爆出实际问题        |
| 系统服务两套实现方式不统一      | 能工作，统一是长期目标               |
| `as any` 收紧（至少核心路径） | 逐步推进，编译时问题不影响运行       |
| 超大文件拆分                    | 维护成本，不影响功能                 |
| 公共组件抽取                    | 减少重复，渐进式推进                 |
| 颜色工具函数去重                | DRY 原则                             |
| 错误处理完善                    | 静默失败 → 可观测的降级             |
| Context value 未 memo           | App 级性能优化                       |
| TaskManager.reset() 重置序列号  | reset 后状态干净度                   |
| 图标命名统一 Ic* 前缀           | 影响任务生成一致性                   |
| Manifest 字段补全               | 影响 i18n 和 AgentBridge 映射        |

### P2：视 benchmark 覆盖范围而定

| 问题                               | 判断标准                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| 数据量不足（联系人 10+，聊天几条） | 有"长列表搜索/滚动"类任务 → 需补；否则暂不管             |
| 核心 App 功能缺失                  | 看 benchmark 任务是否涉及微信支付/支付宝扫码/12306 购票等 |
| 通知操作按钮                       | 有通知交互任务 → 需补                                    |
| 长按 App Shortcuts                 | 有快捷操作任务 → 需补                                    |
| NavigationHandler 模式不统一       | 后续需批量修改时再统一                                    |
| App 永久挂载不卸载                 | 长时间 benchmark 跑出内存问题再处理                       |

### P3：发布后长期规划，暂不考虑

| 类别                     | 问题                                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Android 保真度** | Activity 完整生命周期、launchMode、通知 Channel/分组/富通知、权限细分（仅此一次）、多窗口/分屏、Material Ripple、三键导航、锁屏、App Drawer、触摸事件完整模拟（多点触控等）、WindowManager 窗口层级、进程隔离                          |
| **架构重构**       | `window.__OS__` 完整类型定义、Service 循环依赖治理、DeviceService 偏好映射数据驱动化                                                                                                                                                 |
| **工程清理**       | `package.json` name 修正、tsconfig 遗留配置清除、脚本目录清理、`document.execCommand` 废弃 API 迁移、`setNativeValue` React 内部依赖、README 端口不一致、`public/tailwind.css` 清理、调试日志残留、BackDispatcher 魔术数字命名 |

---

## 第四部分：五份报告的审查视角对比

| 报告             | 主要视角                                     | 独特贡献                                                                                                                                      |
| ---------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **报告 1** | 全面均衡，覆盖架构到配置                     | 组件级优化（KeyboardOverlay 子组件、backdrop-blur、滚动节流、Context memo）、API Key 泄露                                                     |
| **报告 2** | Service 耦合与 UI 真实性                     | Service 间循环依赖、ServiceRegistry.get() 异常处理、偏好映射数据驱动化、Material Ripple、i18n、三键导航/锁屏                                  |
| **报告 3** | **benchmark 正确性**（最贴近核心用途） | Launcher 缓存不同步、IntentResolver 并发、setState 竞态、TaskManager 不持久化、PermissionService 超时、Agent 训练影响分析（数据量、功能缺失） |
| **报告 4** | **运行时稳定性与健壮性**               | 系统级 ErrorBoundary、Promise 拒绝处理、Store getter 反模式、TaskManager reset 序列号、类型声明一致性                                         |
| **报告 5** | **底层模拟保真度**                     | 触摸事件完整性（多点触控、字段缺失）、时序依赖、全量预加载、废弃 API、React 内部依赖、openApp 竞态、窗口层级                                  |

---

## 总结

项目的核心架构设计（OS/App 分层、App 自动发现、BackDispatcher 优先级链、ServiceRegistry、事件驱动 navigator 注册、导航声明 + 工具链）是优秀的。

**发布前的 12 个必修项**聚焦三个方面：

1. **状态判定正确性**（5 个）— Launcher 缓存、setState 竞态、Map 导航、Store getter、TimeService
2. **运行时稳定性**（5 个）— ErrorBoundary、PendingIntent 空引用、IntentResolver 并发、PermissionService 超时、Promise 拒绝
3. **Agent 视觉感知**（2 个）— 键盘相关 fixed 布局、OS 层 App 硬编码 import

其他问题均属于"正确但不紧急"的改进，可在发布后按 P1 → P2 → P3 持续迭代。

---

## 修复状态总览（2026-03-06 审查）

### P0 必修项修复进度：12/12 全部修复 ✅

| 类别                | 已修复 ✅                                                                     |
| ------------------- | ----------------------------------------------------------------------------- |
| 状态判定正确性（5） | Launcher 缓存、setState 竞态、Map 导航、Store getter、TimeService             |
| 运行稳定性（5）     | ErrorBoundary、PendingIntent、IntentResolver、PermissionService、Promise 拒绝 |
| Agent 视觉感知（2） | OS 硬编码 import、fixed 布局（Alipay/RedBook TabBar → flex + data-hide-on-keyboard） |

### 共性问题修复统计

| 类别                      | 总数         | ✅ 已修复   | ⚠️ 部分修复 | ❌ 未修复    |
| ------------------------- | ------------ | ----------- | ------------- | ------------ |
| 架构层（1.1-1.5）         | 5            | 1           | 1             | 3            |
| 性能层（2.1-2.4）         | 4            | 0           | 1             | 3            |
| Android 保真度（3.1-3.6） | 6            | 0           | 0             | 6            |
| App 层一致性（4.1-4.5）   | 5            | 1           | 1             | 3            |
| 代码质量（5.1-5.6）       | 6            | 1           | 0             | 5            |
| **合计**            | **26** | **3** | **3**   | **20** |
