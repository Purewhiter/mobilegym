# 模拟器系统架构与 Android 对应关系

> 本文档描述 mobile-gym 模拟器（不含 bench_env）的整体架构，以及与真实 Android 的对应和差距。

---

## 一、整体架构概览

模拟器是**单 Vite 项目**，在浏览器中运行，分为 **OS 层** 和 **Apps 层**。全局 API（`__OS__`、`__SIM__` 等）用于**任务管理、状态重置与轨迹数据合成**，不属于 Agent 的观测空间——本项目面向纯视觉 Agent，Agent 唯一的观测是屏幕截图。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    bench_env / 任务编排 / 轨迹合成                         │
│  __SIM__.getState() / setState() / reset()   __OS__.handleBack() / ...   │
│  （Agent 不使用这些 API——Agent 仅通过截图观测）                             │
└─────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────┐
│                           OS 层 (os/)                                    │
│  OSContext ──► TaskManager, BackDispatcher, IntentResolver               │
│  SystemShell ──► 桌面(Launcher)、状态栏、手势、App 渲染容器               │
│  Zustand stores (createOsStore) + Managers ──► 各系统服务                 │
│  AppNavigatorRegistry, AppStateRegistry, PackageManagerService, ...     │
└─────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────┐
│                          Apps 层 (apps/<AppName>/)                       │
│  manifest.ts │ *App.tsx │ navigation.declaration.ts │ pages/ │ res/ ...  │
└─────────────────────────────────────────────────────────────────────────┘
```

- **OS 层**：模拟「系统」，管理任务栈、返回键、Intent、系统服务、桌面、状态栏等。
- **Apps 层**：每个 App 独立目录，通过 `manifest.ts` + `*App.tsx` 被 OS 自动发现（`import.meta.glob`），**无需在 OS 中手写注册**。

---

## 二、OS 层核心组件

### 2.1 状态与入口

| 组件 | 职责 |
|------|------|
| **OSContext.tsx** | 薄 React Context；组装 TaskManager / BackDispatcher / IntentResolver；向 `window.__OS__`、`window.__SIM__` 注入 API；挂载 SystemShell。 |
| **TaskManager.ts** | 维护 `OSState`（tasks、activeTaskId、isLauncherVisible、isRecentsVisible）；使用 `createVolatileOsStore`（**不持久化**，浏览器刷新 = 设备重启，任务栈重置为空）；运行时状态始终可通过 `__SIM__.getState()` 读取。brightness/volume 已迁移到 `OsStateStore`（通过 `DisplayManager`/`AudioManager` 管理）。`__SIM__.reset()` 调用 `OsStateStore.reset()` + `resetAllOsStores()` + `TaskManager.reset()`。 |
| **types.ts** | 定义 `AppId`、`DeviceConfig`、`ActivityInstance`、`Task`、`OSState` 等核心类型。 |

### 2.2 任务与 Activity 栈

| 概念 | 实现 |
|------|------|
| **Task** | 一个 `Task` = `taskId` + `rootAppId` + `stack: ActivityInstance[]` + `lastActiveAt` + 可选 `launchedByTaskId` + 可选 `wasExternallyRouted`。多个 Task 组成 `OSState.tasks`，`activeTaskId` 指向当前前台任务。`launchedByTaskId` 记录创建此 Task 的前台 Task（仅新建时设置），用于 Task 间返回栈。`wasExternallyRouted` 标记 Task 的初始路由是否由外部 `openApp(appId, route)` 设置，决定 Back 到底时是销毁 Task（`finish`）还是保活（`moveTaskToBack`）。 |
| **ActivityInstance** | 栈上的一层：`activityId`、`appId`、`initialRoute`、可选 `launchedByTaskId`（Activity 级调用方追踪）、`intent`/`requestCode`/`callerActivityId`（用于 startActivityForResult）。 |
| **启动/切换** | `LAUNCH_APP` 新建或激活已有 Task。新建时设 `launchedByTaskId` = 调用方 Task；激活已有 Task 时，从 Launcher（无调用方且非 `wasExternallyRouted`）清除 `launchedByTaskId`，从其他 App（有调用方）不修改。`openApp(appId, route)` 对新 Task 用 replace 替换初始路由，对已有 Task 用 push 保留历史。`startActivity({ newTask: true })` 对新 Task 用 replace + `markExternalRoute`，**对已有 Task 通过 `pushActivity` 压入新 Activity**（该 Activity 带自身 `launchedByTaskId` 指向调用方）。`ACTIVATE_TASK` 切到已有 Task；`PUSH_ACTIVITY`/`POP_ACTIVITY` 管理 Activity 栈。`finishActivity()` 弹出栈顶 Activity（stack > 1）或销毁 Task（stack = 1），并通过 `launchedByTaskId` 自动返回调用方。 |

### 2.3 返回与导航

| 组件 | 职责 |
|------|------|
| **BackDispatcher** | 按优先级执行返回：组件通过 `register(id, handler, priority)` 注册；`handleBack()` 从高到低调用，某 handler 返回 `true` 即消费。内置帧级去重（rAF lock），防止同一帧内 edge-swipe 和遮罩 click 双触发。典型优先级：PermissionDialog 1000、Shade 800、Keyboard 700、App 100、os.returnToLauncherTask 12、os.goHomeFallback 0。 |
| **os.returnToLauncherTask** | 优先级 12。当前 Task 栈仅剩 1 个 Activity 且有 `launchedByTaskId` 时，销毁当前 Task 并激活发起方 Task（如短信发完后返回 12306）。 |
| **os.goHomeFallback** | 优先级 0（兜底）。若当前 Task 的 `wasExternallyRouted` 为 true（由外部 openApp 带路由创建），销毁 Task；否则 `goHome()` 保活 Task。 |
| **AppNavigatorRegistry** | 每个 App 通过 `useAppNavigationHandler` 注册 `navigate(path, options?)`、`back()`、`route()`；OS 据此驱动「当前 App 内返回」或「当前 Activity 返回」；支持按 `activityId` 注册 Activity 级 Navigator。`navigate` 接受 `{ replace?: boolean }` 选项，OS 对新建 Task 用 replace（替换初始路由）、对已有 Task 用 push（保留 back 历史）。**外部任务隔离**：当一个 App 实例渲染在其他 App 的 Task 内（如 `startActivityForResult` 将支付宝压入 12306 的 Task），`useAppNavigationHandler` 检测到 `task.rootAppId !== appId` 后跳过 app 级注册，仅通过 activity 级 Navigator 导航，避免覆盖后台实例的 Navigator。`navigateToActivity` 也会做同样的检测：对外部任务中的 Activity 仅等待 activity 级 Navigator，不回退到 app 级（否则会导航到错误的后台实例）。 |

### 2.4 Intent 与跨应用

| 组件 | 职责 |
|------|------|
| **IntentResolver** | 根据 `IntentPayload`（action/scheme/type）解析匹配的 App（`intentFilters`）；支持 `startActivityForResult`、requestCode 分配、结果回传；多匹配时可选显示 IntentChooserSheet。 |
| **manifest intentFilters / queries** | 在 `types/manifest.ts` 中定义；每个 App 的 `manifest.ts` 声明 `intentFilters`（能接收的 Intent）和 `queries`（能发出的 Intent），与 AndroidManifest 的 `<intent-filter>` / `<queries>` 对应。 |

#### 两种跨应用通信模式

模拟器支持两种与 Android 对应的跨应用 Intent 通信模式：

**模式 A：同 Task — `startActivityForResult` + `setResult`（对应 Android 支付宝 SDK 风格）**

调用方使用 `__OS__.startActivityForResult(appId, intent, callback)`，目标 Activity 被 push 到调用方的 Task 栈。OS 为该 Activity 渲染一个独立的目标 App 实例（独立 MemoryRouter），并通过 **activity 级 Navigator** 导航到 intent 指定的路由（如 `/pay/cashier`）。该实例的 `useAppNavigationHandler` 检测到自身位于外部任务（`task.rootAppId !== appId`）后，跳过 app 级 Navigator 注册，确保后台运行的目标 App 实例不受影响。目标完成后调用 `__OS__.setResult(result)`，OS 自动执行 `finishTopActivity`（弹出目标 Activity）并触发 callback，调用方 Activity 自动恢复焦点。弹出时 `finishTopActivity` 同样检测外部任务，仅重置 activity 级 Navigator，不影响后台实例的路由状态。

- 典型场景：12306 → 支付宝收银台（`CashierPage`）
- Android 对应：`startActivityForResult()` → 目标 `setResult()` + `finish()` → 调用方 `onActivityResult()`

**模式 B：跨 Task — `startActivity({ newTask: true })` + broadcast（对应 Android 微信支付 SDK 风格）**

调用方使用 `__OS__.startActivity(intent, { newTask: true })`，目标 App 在其自身 Task 中运行。如果目标 App 的 Task **不存在**，OS 创建新 Task 并用 replace 设置初始路由，新 Task 带 `launchedByTaskId` 指向调用方、`wasExternallyRouted = true`。如果目标 App 的 Task **已存在**，OS 向该 Task 顶部 **push 一个新 Activity**（`pushActivity`），该 Activity 的 `launchedByTaskId` 指向调用方 Task。结果通过 `broadcast.sendBroadcast()` 回传（对应 Android AIDL/Binder IPC 回调）。目标完成后调用 `__OS__.finishActivity()`，OS 自动弹出顶部 Activity 并通过 `launchedByTaskId` 激活调用方 Task。

- 典型场景：Bilibili → 微信支付（`PaymentConfirmationPage`）
- Android 对应：`WXApi.sendReq()` → 微信 `WXPayEntryActivity.finish()` → 调用方收到 AIDL 回调
- `finishActivity()` 行为：若 Task 栈有多个 Activity（已有 Task 场景），仅弹出顶部 Activity，保留原有 Task 状态；若 Task 栈仅 1 个 Activity（新建 Task 场景），销毁整个 Task 并返回调用方

**选择依据**：目标 App 是否需要独立 Task 上下文（自己的登录态、安全沙箱、完整 UI 栈）。需要则用模式 B，否则优先用模式 A（生命周期更简洁）。

### 2.5 系统服务

| 服务 | 说明 |
|------|------|
| **createOsStore / Zustand** | OS 层统一使用 Zustand store（通过 `createOsStore`/`createVolatileOsStore` 工厂）管理状态，支持 selector 订阅、immer middleware、自动持久化。工厂内置 store registry（`resetAllOsStores()` / `snapshotOsStores()`），取代了原 `ServiceRegistry.ts`（已删除）。`createSystemService` 已废弃并删除。 |
| **OsStateStore + Managers** | OsStateStore 持有统一的 settings/hardware/permissions/preferences（持久化到 `os_state`）；`ConnectivityManager`、`BatteryManager`、`AudioManager`、`DisplayManager` 作为域写入 facade 封装约束逻辑与副作用（取代已删除的 `DeviceService`）；`managers/registry.ts` 管理 preference key 路由和 build/telephony overrides。 |
| **Facade / 独立运行时 Service** | StatusBarService、QuickSettingsService（OsStateStore 只读 facade）；ClipboardService（`createOsStore`，持久化）；NotificationService、KeyboardService、SystemShadeService、PermissionService、LocationService（`createVolatileOsStore`，不持久化，刷新后重置）；TimeService、NetworkService、FileSystemService、MediaService 等独立服务。**持久化原则：数据持久化，UI/会话/运行态不持久化（浏览器刷新 = 设备重启）。** 部分在 `__OS__` 上以子对象暴露（如 `__OS__.notifications`、`__OS__.device`）。 |

### 2.6 桌面与壳

| 组件 | 职责 |
|------|------|
| **SystemShell.tsx** | 系统壳：状态栏、桌面（Launcher）、多任务（Recents）、手势（返回/Home/Recents）、App 渲染容器；根据 `activeTaskId`/`isRecentsVisible` 决定当前显示的 Task，**后台 App 不卸载，仅 `display:none`**，保留 React 状态。 |
| **Launcher** | 桌面：应用网格、Dock、壁纸、文件夹等；状态存 localStorage（如 `LAUNCHER_STORAGE_KEY`），通过 `__SIM__.getState()` 暴露 launcher 摘要。 |

### 2.7 其它 OS 设施

| 组件 | 职责 |
|------|------|
| **AppStateRegistry** | 双源：运行时由各 App 的 Context 注册；持久化从 localStorage 读取；`getAllAppStates()` 供 `__SIM__.getState().apps` 使用。 |
| **PackageManagerService** | 通过 `import.meta.glob(['../apps/*/manifest.ts', '../system/*/manifest.ts'])` 收集所有 manifest，提供 `getInstalledPackages()`、`getPackageInfo(appId)`、Intent 查询等。 |
| **ContentResolver / ContentProvider** | 按 authority 注册 Provider，提供 content URI 的 query/insert/update/delete，与 Android ContentResolver 概念对齐。 |
| **BroadcastBus** | 发送/接收广播（如 `ACTION_BOOT_COMPLETED`、`ACTION_NOTIFICATION_POSTED`），Action 名与 Android 风格一致。 |
| **PendingIntent** | 封装「稍后执行」的 Intent，用于通知点击等场景。 |

---

## 三、Apps 层约定

- **manifest.ts**：必选；声明 id、packageName、displayName、icon、theme、intentFilters、queries 等；**唯一需要在「系统」侧生效的注册**，OS 通过 glob 发现。
- ***App.tsx**：入口组件；`MemoryRouter` + `useAppNavigationHandler`（向 AppNavigatorRegistry / BackDispatcher / AppLifecycle 注册）；主 Tab + 子页面的路由与布局。
- **navigation.declaration.ts**：声明式路由与转移；静态分析、导航图、任务生成均依赖此文件。
- **navigation.ts**：业务侧使用 `go()`/`back()`，禁止直接使用 React Router 的 `useNavigate()`。
- **res/**：资源（colors、strings、dimens、icons），对齐 Android res/values 思路。
- **data/defaults.json + data/index.ts**：默认数据与配置入口，与 `constants.ts` 结构常量分离。

---

## 四、与真实 Android 的对应关系

| Android 概念 | 模拟器对应 | 说明 |
|--------------|------------|------|
| **Activity** | `ActivityInstance` + App 内 Route | 栈上一「层」由 activityId + appId + initialRoute 表示；具体 UI 由 App 的 React 路由渲染。 |
| **Task / 任务栈** | `Task`（stack: ActivityInstance[]） | 多 Task、单 activeTaskId；LAUNCH_APP 建新 Task 或带到前台。`launchedByTaskId` 支持 Task 间返回栈（类 Android 的 task affinity 返回行为）。 |
| **AndroidManifest** | `manifest.ts`（AppManifest） | id、packageName、intentFilters、queries、theme 等。 |
| **Intent** | `IntentPayload` + IntentResolver | action/scheme/type + data；显式/隐式解析；startActivityForResult 有 requestCode 与 setResult。 |
| **ActivityResult** | `ActivityResult`（resultCode + data） | 通过 callback 回传，无真实 Binder。 |
| **startActivityForResult (同 Task)** | `__OS__.startActivityForResult` + `__OS__.setResult` | 目标 Activity push 到调用方 Task 栈；setResult 触发 finishTopActivity + callback。对应支付宝 SDK 风格。示例：12306 → Alipay CashierPage。 |
| **startActivity + IPC 回调 (跨 Task)** | `__OS__.startActivity({ newTask })` + `broadcast` | 目标 App 在自身 Task 中运行（新建或已有）；已有 Task 时向栈顶 push 新 Activity（带 `launchedByTaskId`）；结果通过 BroadcastBus 回传（对应 AIDL/Binder）；完成后调用 `finishActivity()` 弹出 Activity 并自动返回调用方 Task。对应微信支付 SDK 风格。示例：Bilibili → Wechat PaymentConfirmationPage。 |
| **返回键 / 返回手势** | BackDispatcher + useTriggerGestures 统一路由 | 所有 `system.back`（UI 按钮 bindBack、侧滑手势）均经 `BackDispatcher` 优先级链消费，与 Android 统一返回链一致。 |
| **windowSoftInputMode (adjustResize)** | SystemShell `data-adjust-resize` wrapper | 键盘可见时活动容器高度减去键盘高度（`calc(100% - kbHeight)`），App 的 flex 布局自动适应；智能滚动（`doSmartScroll`）基于缩小后的 wrapper bounds 计算可见区域。 |
| **系统服务** | Zustand stores (createOsStore) + Managers | 无 Binder；OsStateStore 统一持久化，Managers 提供 API facade。 |
| **ContentProvider** | ContentResolver + ContentProvider | authority + content URI CRUD。 |
| **Broadcast** | BroadcastBus | sendBroadcast / registerReceiver，Action 名兼容 Android。 |
| **PackageManager** | PackageManagerService | 基于 manifest 的 glob，无真实安装/卸载。 |
| **桌面** | Launcher | 网格、Dock、壁纸、文件夹，状态持久化。 |
| **多任务界面** | Recents（SystemShell） | 显示各 Task 卡片，切换/关闭 Task。 |
| **状态栏 / 下拉** | StatusBarService、SystemShade、QuickSettings | 时间、图标、通知、快捷设置。 |
| **通知（NotificationManager）** | NotificationService | push / dismiss / dismissByRoute / clearForApp；`autoCancel` 控制点击后是否自动移除（默认 true，对齐 setAutoCancel）；桌面角标由未读通知数推导；App 内标记已读可调 `dismissByRoute(appId, route)` 与 OS 通知联动。 |

---

## 五、与真实 Android 的主要差距

1. **无真实进程/Binder**  
   App 均为同一页面内 React 组件树；「多任务」通过隐藏/显示容器和 Task 状态实现，无独立进程或 IPC。

2. **无真实窗口/Surface**  
   无 WindowManager/SurfaceFlinger；所有 UI 为 DOM + CSS，无原生控件。

3. **生命周期简化**  
   无完整 Activity 生命周期（onCreate/onStart/onResume/onPause/onStop/onDestroy）；仅有「前台/后台」与 App 内路由切换，通过 AppLifecycle 等做简单通知。

4. **权限模型简化**  
   PermissionService 存在，但无真实系统级权限弹窗与用户确认流程；部分仅做声明与 warn。

5. **无真实安装/卸载**  
   应用列表由 manifest 的 glob 决定，无 APK、无安装器、无版本升级流程。

6. **输入与可观测性**  
   触摸/按键通过 DOM 事件与 `simInput` 等转成 `__OS__.handleBack()` 等。本项目面向**纯视觉 Agent**——Agent 的唯一观测是屏幕截图（screenshot），不使用 accessibility tree 或任何结构化 DOM 信息。`__SIM__.getState()`、`data-trigger-*`/`data-action-*` 等是**任务定义与轨迹数据合成**的内部机制，不属于 Agent 的观测空间。

7. **时间/定位/网络**  
   由 TimeService、LocationService、NetworkService 提供，支持「模拟」模式（固定时间、固定坐标、网关代理），便于 bench 与复现。

8. **文件系统**  
   FileSystemService 提供虚拟目录与文件（含 preset/indexeddb/memory），无真实 Linux 文件系统与存储权限模型。

整体上，模拟器**在概念和 API 设计上对齐 Android**（Task/Activity/Intent/Manifest/ContentProvider/Broadcast），**在实现上采用单页 React + 内存/本地存储**。项目面向**纯视觉 Agent**的训练与评测——Agent 仅通过截图观测屏幕并输出坐标操作；`__SIM__`/`__OS__` 等全局 API 服务于 bench_env 任务编排、状态判定与轨迹数据合成，不暴露给 Agent。
