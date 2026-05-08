# mobile-gym 系统架构全景分析

> 版本：2026-03-08 | 基于当前 `dev` 分支代码库生成

---

## 目录

- [一、项目定位与设计哲学](#一项目定位与设计哲学)
- [二、总体架构](#二总体架构)
- [三、OS 层深度解析](#三os-层深度解析)
- [四、Apps 层架构](#四apps-层架构)
- [五、Benchmark 层](#五benchmark-层)
- [六、脚本与工具链](#六脚本与工具链)
- [七、数据流全景](#七数据流全景)
- [八、关键设计模式](#八关键设计模式)
- [九、与 Android 的对应与差异](#九与-android-的对应与差异)
- [十、构建与运行时基础设施](#十构建与运行时基础设施)
- [十一、架构评估与未来方向](#十一架构评估与未来方向)

---

## 一、项目定位与设计哲学

### 1.1 项目目标

mobile-gym 是一个**浏览器端模拟 Android OS 环境**，服务于纯视觉（pure-vision）手机操作 Agent 的**训练、评测与数据合成**。核心特征：

- **Agent 只看截图**：Agent 的唯一观测是屏幕截图，不访问 DOM、API 或状态
- **JS API 仅供编排**：`__SIM__`、`__OS__` 等全局 API 用于任务管理、状态注入和评测判定，不属于 Agent 观测空间
- **Android 语义对齐**：尽可能复刻 Android 的任务栈、Intent、权限、设置、ContentProvider 等语义
- **高保真 UI**：App UI 力求还原真实应用的视觉与交互，保证 Agent 在模拟器上训练的能力能迁移到真机

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **浏览器刷新 = 设备重启** | 数据持久化（localStorage），UI/会话/运行态不持久化（volatile store） |
| **`__SIM__.reset()` = 恢复出厂** | 清空所有 localStorage，重置所有 store，供 bench_env 任务间隔离 |
| **App 零注册** | 只需 `manifest.ts` + `*App.tsx`，OS 通过 `import.meta.glob` 自动发现 |
| **声明式导航** | `navigation.declaration.ts` 作为路由/转场/动作的单一事实来源，支持静态分析与任务生成 |
| **时间可控** | 禁止裸 `Date.now()`，一切时间走 `TimeService`，支持模拟时间 |
| **Config-first 数据** | 常量在 `constants.ts`，默认数据在 `defaults.json`，统一导出为 `<APP>_CONFIG` |

---

## 二、总体架构

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Benchmark 层 (bench_env/, Python)                       │
│  Playwright 驱动 │ Task 定义 │ 参数采样 │ 状态判定 │ VLM 评测 │ Pass@k     │
│  通过 page.evaluate() 调用 __SIM__ / __SIM_INPUT__ / __SIM_QUERY__         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ Playwright / WebSocket
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OS 层 (os/, TypeScript/React)                      │
│                                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │OSContext  │  │ TaskManager  │  │BackDispatcher│  │ IntentResolver     │  │
│  │(Provider) │  │ (Task Stack) │  │(Priority Chn)│  │ (Intent Matching)  │  │
│  └──────────┘  └──────────────┘  └──────────────┘  └────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ SystemShell — 桌面(Launcher) │ 状态栏 │ 手势栏 │ App 渲染容器       │   │
│  │              Recents │ SystemShade │ 键盘 │ 权限弹窗               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ OsStateStore │  │  Managers    │  │  Services    │  │  Providers    │  │
│  │(Settings/HW/ │  │(Connectivity │  │(Notification │  │(Contacts/SMS/ │  │
│  │ Permissions) │  │ Battery/     │  │ Clipboard/   │  │ Media +       │  │
│  │              │  │ Audio/       │  │ Location/    │  │ ContentResolver│  │
│  │              │  │ Display)     │  │ Time/KB...)  │  │               │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ createOsStore│  │AppNavigator  │  │ AppLifecycle │  │ BroadcastBus  │  │
│  │ (Store工厂)  │  │Registry      │  │              │  │               │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ import.meta.glob 自动发现
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Apps 层 (apps/, system/, TypeScript/React)                │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ apps/Wechat/     apps/Alipay/     apps/Spotify/     apps/Bilibili/  │   │
│  │ apps/RedBook/    apps/Ebay/       apps/Map/         apps/Weather/   │   │
│  │ apps/Railway12306/  apps/TencentMeeting/  apps/WechatReading/  ... │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ system/Settings/ system/Calendar/ system/Contacts/ system/Sms/      │   │
│  │ system/Browser/  system/Clock/    system/Notes/    system/Gallery/  │   │
│  │ system/Calculator/ system/Calculator2/ system/FileManager/  ...    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  每个 App 标准结构：                                                         │
│  manifest.ts │ *App.tsx │ navigation.declaration.ts │ navigation.ts         │
│  state.ts │ data/ │ res/ │ pages/ │ hooks/ │ components/                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 应用清单

**第三方应用（apps/，13 个）**：Wechat、Alipay、Bilibili、Ebay、Map、Railway12306、RedBook、Reddit、Spotify、TencentMeeting、Weather、WechatReading、X

**系统应用（system/，13 个）**：Browser、Calculator、Calculator2、Calendar、Clock、Compass、Contacts、FileManager、Gallery、Notes、Settings、Sms、ThemeStore

### 2.3 技术栈

| 层 | 技术 |
|-----|------|
| 前端框架 | React 19 + TypeScript 5.8 |
| 构建工具 | Vite 6.2 |
| CSS | Tailwind CSS v4（CLI 模式，Rust 编译） |
| 状态管理 | Zustand 5 + Immer |
| 路由 | react-router-dom 7（MemoryRouter） |
| 虚拟列表 | @tanstack/react-virtual |
| 评测框架 | Python + Playwright |

---

## 三、OS 层深度解析

OS 层模拟 Android 系统内核功能，位于 `os/` 目录，是整个模拟器的基础设施。

### 3.1 核心入口与启动流程

**`index.tsx`** 是项目入口，启动顺序：

```
1. storageIsolationBootstrap()      ─── localStorage 隔离初始化
2. 注册 ContentProviders             ─── Contacts, Media, Sms
3. import.meta.glob 预加载 state.ts  ─── 自动发现 App stores
4. ReactDOM.createRoot               ─── 挂载 React 应用
   └── OSProvider                    ─── OS Context + 全局 API
       └── ThemeProvider             ─── 主题（仅暴露 ready，不再 gate UI）
           └── BootGate              ─── 启动开屏 gate（等 ThemeService.init，
               │                         ready 后 200ms cross-fade 出 BootSplash）
               └── SystemShell       ─── 桌面 + 状态栏 + App 容器
5. TimeService.initTimeService()     ─── 时间服务
6. LocationService.initLocationService()
7. SkinService.initFromUrl()
8. AgentBridge                       ─── MCP 控制桥接
```

**`OSContext.tsx`** 是 OS 的 React 入口：

- 组装 `TaskManager`、`BackDispatcher`、`IntentResolver`
- 通过 `useSyncExternalStore` 订阅状态
- 向 `window.__OS__` 注入系统 API（任务管理、Intent、broadcast、content 等）
- 向 `window.__SIM__` 注入模拟器控制 API（reset、getState、setState）

### 3.2 任务栈管理（TaskManager）

对标 Android 的 ActivityTaskManager，管理所有 Task 和 Activity 的生命周期。

```
┌─ TaskManager ──────────────────────────────────────────────┐
│                                                             │
│  tasks: Map<taskId, Task>                                  │
│  ┌─ Task ──────────────────────────────────────────────┐   │
│  │  taskId: number                                     │   │
│  │  rootAppId: AppId                                   │   │
│  │  stack: ActivityInstance[]   ← Activity 栈          │   │
│  │  launchedByTaskId?: number                          │   │
│  │  wasExternallyRouted: boolean                       │   │
│  │  ┌─ ActivityInstance ───────────────────────────┐   │   │
│  │  │  activityId: number                          │   │   │
│  │  │  appId: AppId                                │   │   │
│  │  │  initialRoute?: string                       │   │   │
│  │  │  intent?: IntentPayload                      │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  activeTaskId: number | null                               │
│  isLauncherVisible: boolean                                │
│  isRecentsVisible: boolean                                 │
│                                                             │
│  Reducer Actions:                                          │
│  LAUNCH_APP │ ACTIVATE_TASK │ GO_HOME │ SHOW_RECENTS       │
│  CLOSE_TASK │ PUSH_ACTIVITY │ POP_ACTIVITY                 │
│  MARK_EXTERNAL_ROUTE │ RESET                               │
└─────────────────────────────────────────────────────────────┘
```

**关键行为**：

- 使用 `createVolatileOsStore`（不持久化），刷新 = 重启，任务栈清空
- `LAUNCH_APP` 时如果已有该 App 的 Task，则激活复用（不创建新 Task）
- `startActivity({ newTask: true })` 对已有 Task 通过 `PUSH_ACTIVITY` 压入新 Activity（带 `launchedByTaskId`），而非仅做 MemoryRouter 导航
- `finishActivity()` 弹出栈顶 Activity（stack > 1）或销毁 Task（stack = 1），自动通过 `launchedByTaskId` 返回调用方
- 后台 App/Activity 通过 `display: none` 隐藏而非卸载，保留 React 状态
- `launchedByTaskId` 在 Task 级和 Activity 级均有追踪，支持 `startActivityForResult` 和跨 Task `finishActivity` 返回

### 3.3 返回键调度（BackDispatcher）

**优先级链模式**，模拟 Android 的返回键分发：

```
优先级（高→低）：
  intentChooser(900) → mediaPicker(600) → appBack(100)
  → activityBack(50) → finishTopActivity(25)
  → returnToLauncherTask(12) → goHomeFallback(0)
```

- 各组件通过 `register(id, handler, priority)` 注册
- `handleBack()` 从最高优先级开始，首个返回 `true` 的处理器消费事件
- 帧级去重（`_backLock`）防止侧边手势和背景点击同帧双触发

### 3.4 Intent 系统（IntentResolver）

对标 Android Intent 解析机制：

```
Intent 派发流程：
  startActivity(intent) → queryIntentActivities(intent)
  │
  ├─ 匹配 0 个 → 无响应
  ├─ 匹配 1 个 → 直接跳转 (pushActivity + navigate)
  └─ 匹配多个 → 弹出 Chooser → 用户选择 → 跳转
```

- 通过 `PackageManagerService.queryIntentActivities` 扫描所有 manifest 的 `intentFilters`
- 支持 `startActivityForResult` + `pendingCallbacks` 回调
- Chooser 状态管理（open、intent、matches）通过 subscribe 通知 UI

### 3.5 导航注册（AppNavigatorRegistry）

**事件驱动的 App navigator 注册**：

- App 挂载后通过 `register(appId, navigator)` 注册（app 级）；支持 `registerActivity(activityId, navigator)` 注册 activity 级 Navigator
- OS 通过 `waitForNavigator({ activityId, appId })` 等待（CustomEvent + Promise，带超时）
- navigator 提供 `navigate(path, { replace })` 接口
- OS 控制 push/replace 语义：新 Task 用 `replace`（替换初始 `/`），已有 Task 用 `push`
- **外部任务隔离**：当 App 实例渲染在其他 App 的 Task 内（`task.rootAppId !== appId`，如 `startActivityForResult` 将支付宝压入 12306 的 Task），`useAppNavigationHandler` 跳过 app 级 Navigator / BackDispatcher / AppLifecycle 注册，避免覆盖后台同 App 实例的注册。`navigateToActivity` 对外部任务中的 Activity 仅等待 activity 级 Navigator，不回退到 app 级。`finishActivity` / `finishTopActivity` 弹出外部任务中的 Activity 时，仅重置 activity 级 Navigator 路由，不影响后台实例。此机制确保同一 App 同时在自身 Task 和外部 Task 中运行时互不干扰

### 3.6 统一数据模型（OsStateStore）

对齐 Android 四层数据架构的统一 store：

```
OsStateStore (os_state localStorage key)
├── settings
│   ├── system    ─── 亮度、音量、字体大小、屏幕超时（Settings.System）
│   ├── global    ─── WiFi/蓝牙/飞行模式/深色模式（Settings.Global）
│   └── secure    ─── 位置模式、辅助功能（Settings.Secure）
├── hardware
│   ├── battery   ─── 电量、充电状态（BatteryManager）
│   ├── wifi      ─── SSID、信号强度（WifiManager）
│   ├── cellular  ─── 运营商、信号（TelephonyManager）
│   └── sensors   ─── 传感器数据
├── permissions   ─── 各 App 权限授予状态
└── preferences   ─── App 偏好设置
```

### 3.7 Manager 层

Manager 是 OsStateStore 特定域的**写入 facade**，封装约束逻辑和副作用：

| Manager | 域 | 约束逻辑示例 |
|---------|-----|------------|
| **ConnectivityManager** | WiFi/蓝牙/蜂窝/VPN/热点 | 飞行模式级联关闭 WiFi/BT/蜂窝 |
| **BatteryManager** | 电量/充电 | 电量 clamp 0-100 |
| **AudioManager** | 媒体/铃声音量/DND | 音量范围约束 |
| **DisplayManager** | 亮度/字体缩放/护眼 | 亮度范围约束 |

`managers/registry.ts` 提供 preference key → Manager 路由，支持 `routeGetPreference`/`routeSetPreference`，以及 build/telephony overrides（bench_env 场景注入）。

### 3.8 服务层

| 服务 | 持久化 | 职责 |
|------|--------|------|
| **TimeService** | — | 模拟时间 `now()`/`getDate()`；真实时间 `realNow()`（动画、防抖） |
| **NotificationService** | 否 | 通知队列、未读数、push/dismiss |
| **ClipboardService** | 是 | 剪贴板项、历史 |
| **StatusBarService** | — | OsStateStore 只读 facade（信号、电池、时间等派生） |
| **QuickSettingsService** | — | OsStateStore 只读 facade（快捷开关） |
| **SystemShadeService** | 否 | 下拉 shade 开/关状态 |
| **PermissionService** | 否 | 权限请求弹窗流程、授予/撤销 |
| **LocationService** | 否 | 定位模式、模拟坐标、错误注入 |
| **KeyboardService** | 否 | 键盘显示/隐藏、高度、输入模式 |
| **TextSelectionService** | 否 | 文本选择、剪贴板菜单 |
| **PackageManagerService** | 是 | 已安装 App、manifest、Intent 匹配 |
| **NetworkService** | — | `netJson`/`netFetch` HTTP 代理（避免 CORS） |
| **AIService** | — | LLM 调用接口（`__SIM_AI__`） |
| **FileSystemService** | — | 虚拟文件系统（`__SIM_FS__`） |
| **MediaService** | — | 媒体选择器、pick/save |
| **ThemeService** | — | 主题资源、状态栏图标颜色 |
| **SkinService** | — | 皮肤/图片滤镜 |
| **MamlWidgetService** | — | MAML 小部件元数据 |

**持久化原则**：数据类 store 用 `createOsStore`（持久化），UI/会话/运行态用 `createVolatileOsStore`（不持久化）。

### 3.9 Provider 层（ContentProvider 模式）

模拟 Android `content://` URI 访问模式：

```
App → ContentResolver.query("content://contacts", projection, selection)
      → ContactsProvider.query(uri, projection, selection)
      → 返回 Cursor<Contact>

App → ContentResolver.insert("content://sms", values)
      → SmsProvider.insert(uri, values)
```

| Provider | URI 前缀 | 数据 |
|----------|---------|------|
| **ContactsProvider** | `content://contacts` | 联系人 CRUD |
| **MediaProvider** | `content://media` | 照片、视频、相册 |
| **SmsProvider** | `content://sms` | 短信会话 |

每个 Provider 使用独立 `createOsStore`（持久化，但不进入 `os.services` 快照），通过 `registerToServiceRegistry: false` 选退。

### 3.10 Store 工厂体系

```
createOsStore(name, config)
├── 持久化到 localStorage（debounced）
├── 自动注册到 store registry
├── 支持 immer 模式
└── 供 resetAllOsStores() / snapshotOsStores() 使用

createVolatileOsStore(name, config)
├── 不持久化（刷新即重置）
├── 自动注册到 store registry
└── 同样供 reset/snapshot 使用

createAppStore(appId, config)
├── 持久化到 localStorage（key = appId）
├── 注册到 app store registry
└── 供 getAllAppStates() / getStore(appId) 使用
```

### 3.11 SystemShell（系统 UI 容器）

SystemShell 是整个模拟器的视觉容器，负责渲染所有系统级 UI：

```
┌─ SystemShell ──────────────────────────────────────────┐
│  ┌─ StatusBar ─────────────────────────────────────┐   │
│  │ 时间 │ 信号 │ WiFi │ 电池 │ VPN │ ...           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ App Container ─────────────────────────────────┐   │
│  │  每个 Activity 一个 <div>                        │   │
│  │  ├── AdjustResizeContainer（键盘弹出时缩小）     │   │
│  │  │   └── MemoizedActivityContent                │   │
│  │  │       └── renderAppContent(appId)            │   │
│  │  │           └── React.lazy → *App.tsx          │   │
│  │  │                                              │   │
│  │  前台 Activity: visible                          │   │
│  │  后台 Activity: display:none（保留状态）          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Launcher ──────────────────────────────────────┐   │
│  │ 桌面图标 │ 文件夹 │ 小部件 │ 壁纸 │ 热区        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Overlay Layers ────────────────────────────────┐   │
│  │ SystemShade │ KeyboardOverlay │ PermissionDialog │   │
│  │ IntentChooser │ MediaPicker │ Toast │ HUD通知    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ GestureBar + EdgeGestures ─────────────────────┐   │
│  │ 上滑回家/多任务 │ 侧边返回                       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**关键机制**：

- **adjustResize**：`AdjustResizeContainer` 在键盘弹出时减去键盘高度，App flex 布局自动适应
- **`data-keyboard-active`**：键盘弹出时容器添加此属性，带 `data-hide-on-keyboard` 的元素自动隐藏
- **`designViewportWidth`**：App 可声明设计稿宽度，SystemShell 通过 CSS zoom 缩放
- **Recents**：卡片化显示所有 Task，支持滑动关闭

### 3.12 MAML 引擎

MAML（Mobile Application Markup Language）是桌面小部件的渲染引擎：

```
XML 描述 → parser.ts → MamlDocument
                          ↓
             variables.ts + expression.ts （变量/表达式求值）
                          ↓
             renderer.ts → Canvas 绘制
                          ↓
             contentProviders.ts （数据注入）
             intentResolver.ts  （Intent 处理）
             imageCache.ts      （图片缓存）
```

### 3.13 键盘与输入法

```
KeyboardService (Zustand volatile store)
├── 显示/隐藏状态、高度
├── 输入模式（text/number/email/...）
└── subscribe 机制

pinyinIme.ts
├── 拼音输入法逻辑
├── 拼音分词、候选词
└── pinyinData.ts / pinyinLargeDict.ts 词库
```

### 3.14 i18n 系统

```
os/i18n/index.ts
├── useOsT() — React Hook
├── osT(key) — 纯函数
├── localizedAppName(appId) — 从 manifest.displayNameEn 自动获取
└── 自动 patch App 名称（manifest.displayNameEn → i18n 字典）

os/i18n/locale.ts
├── getLocale() / setLocale()
├── useLocale() — React Hook
└── locale 持久化
```

### 3.15 全局 API 一览

| API | 注入位置 | 使用者 | 职责 |
|-----|---------|--------|------|
| `__OS__` | OSContext | Apps + 系统组件 | 任务管理、Intent、broadcast、content、permissions |
| `__SIM__` | OSContext | bench_env | `reset()`、`getState()`、`setState()`、`waitForData()` |
| `__SIM_INPUT__` | simInput.ts | bench_env / Agent | `tap`、`swipe`、`type`、`back`、`home` |
| `__SIM_QUERY__` | simInput.ts | bench_env | `getRectBySelector`、`getRectByTrigger`、`getScrollMeta` |
| `__SIM_TIME__` | TimeService | bench_env | 时间控制、模拟时间注入 |
| `__SIM_LOCATION__` | LocationService | bench_env | 定位控制、坐标注入 |
| `__SIM_AI__` | AIService | Apps | LLM 调用 |
| `__SIM_FS__` | FileSystemService | Apps | 虚拟文件系统 |
| `__SIM_MEDIA__` | MediaService | Apps | 媒体选择 |

---

## 四、Apps 层架构

### 4.1 App 标准目录结构

```
apps/Wechat/                    (或 system/Calendar/)
├── manifest.ts                 ← 身份声明（必须）
├── WechatApp.tsx               ← 入口组件（必须，export default）
├── navigation.declaration.ts   ← 声明式导航（路由/转场/动作）
├── navigation.ts               ← 导航 Hook（go/back）
├── navigation.types.ts         ← 导航类型
├── state.ts                    ← Zustand store（可选）
├── types.ts                    ← App 类型
├── constants.ts                ← 静态结构配置
├── data/
│   ├── defaults.json           ← 默认数据（可替换）
│   └── index.ts                ← 合并导出 <APP>_CONFIG
├── res/
│   ├── colors.ts               ← 组件颜色（Tier-2）
│   ├── colors.states.ts        ← 状态色
│   ├── strings.ts              ← 字符串资源（中文）
│   ├── strings.en.ts           ← 字符串资源（英文）
│   ├── dimens.ts               ← 关键尺寸
│   ├── anim.ts                 ← 动画参数
│   └── icons.tsx               ← 图标（Ic* 别名 + ICON_REGISTRY）
├── hooks/
│   └── useWechatGestures.ts    ← 手势 Hook
├── pages/
│   ├── chat/
│   ├── me/
│   └── settings/
├── components/                  ← 共享组件
└── assets/                      ← 二进制资源
```

### 4.2 manifest.ts — App 身份

```typescript
export const manifest: AppManifest = {
  id: 'wechat',                     // AppId，= localStorage key
  packageName: 'com.tencent.mm',    // Android 包名
  displayName: '微信',              // 中文名
  displayNameEn: 'WeChat',          // 英文名（自动注入 i18n）
  aliases: ['通讯录', '联系人'],    // AgentBridge 名称映射
  version: '1.0.0',
  type: 'plugin',                   // 'plugin' | 'system'
  icon: IcLauncher,                 // 图标组件
  designViewportWidth: 412,         // 设计稿宽度（CSS zoom）
  theme: {
    colors: {                       // Tier-1 主题色
      primary: '#07c160',
      background: '#ededed',
      surface: '#ffffff',
      textPrimary: '#191919',
      textSecondary: '#999999',
      border: '#e0e0e0',
      statusBarForeground: 'light',
    },
  },
  intentFilters: [                  // 可响应的 Intent
    { action: 'ACTION_SEND', type: 'text/plain', route: '/share' },
    { action: 'ACTION_VIEW', scheme: 'weixin', route: '/deeplink' },
  ],
};
```

### 4.3 *App.tsx — 入口组件模式

```typescript
export default function WechatApp() {
  return (
    <MemoryRouter>
      <WechatContextProvider>
        <div style={themeToCssVars(manifest.theme)}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<ChatList />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/me" element={<Me />} />
              <Route path="/chat/:id" element={<ChatDetail />} />
              {/* ... */}
            </Route>
          </Routes>
        </div>
      </WechatContextProvider>
    </MemoryRouter>
  );
}
```

**关键特征**：

- 每个 App 使用独立 `MemoryRouter`（不污染浏览器 URL）
- `useAppNavigationHandler` 注册 navigator、back handler、lifecycle，并同步 `HistoryTracker` 影子栈（支持 `popTo`）
- 主 Tab 常驻挂载（`display: block/none`），子页面通过 `<Outlet />` 渲染
- CSS 变量注入主题色和尺寸

### 4.4 声明式导航系统

```
navigation.declaration.ts
├── routes[]          ─── 路由声明（path、component、uiStates、queryParams、scrollContainers）
├── transitions[]     ─── 转场声明（from、to、mode、params、label、ui）
└── capabilities      ─── 能力声明（historyBack 等）

     ↓ 静态分析

build_nav_artifacts.mjs
├── 一致性检查（declaration ↔ 源码）
├── 生成 nav_graph.json（节点 = uiState、边 = transition）
└── 枚举 action tasks（BFS 路径搜索）

     ↓ bench_env 使用

task definition → optimal_paths → 评测
```

**路由声明**：

```typescript
routes: [
  {
    path: '/',
    component: 'ChatList',
    entryPoint: 'home',
    scrollContainers: [{ id: 'chat-list', direction: 'vertical' }],
    uiStates: [
      {
        id: 'home.base',
        search: {},
        description: '微信首页 - 聊天列表',
        actions: [
          { id: 'home.search', label: '搜索', ui: { ... } },
        ],
      },
    ],
  },
],
```

**转场声明**：

```typescript
transitions: [
  {
    id: 'tab.home',
    from: '*',
    to: '/',
    mode: 'replace',           // Tab 切换用 replace
    label: '聊天 Tab',
    ui: { placement: 'tab-bar', icon: 'IcChat' },
  },
  {
    id: 'chat.open',
    from: ['/'],
    to: '/chat/:id',
    mode: 'push',              // 页面跳转用 push
    params: { id: 'string' },
    dataSource: [{ from: 'store', path: 'chats', idField: 'id' }],
  },
],
```

### 4.5 导航 Hook（navigation.ts）

```typescript
function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();

  const go = useCallback((id: string, params?: Record<string, any>, options?) => {
    const transition = findTransition(id);
    if (!matchFrom(transition.from, location)) return;
    const targetPath = buildPath(transition.to, params);
    navigate(targetPath, { replace: options?.mode === 'replace' });
  }, [navigate, location]);

  const back = useCallback((steps = 1) => {
    navigate(-steps);
  }, [navigate]);

  return { go, back };
}
```

#### popTo 实现（HistoryTracker 影子栈）

`react-router-dom@7` 的 `MemoryHistory` 不再暴露 `entries` 数组，`go()` 的 `popTo` 选项通过影子栈实现：

- **`os/utils/memoryHistoryTracker.ts`** — `HistoryTracker` class 维护一份与 MemoryHistory 同步的 `stack[]` + `index`。`useAppNavigationHandler` 在每次 location 变化时调用 `syncTracker(navigator, location)` 保持同步
- **`os/utils/memoryHistoryPopTo.ts`** — `memoryHistoryPopTo()` 调用 `tracker.findPopToDelta(target, inclusive)` 从当前位置向前搜索目标路径，计算出需要回退的步数 `delta`，然后调用 `navigator.go(-delta)`。调用方紧接着执行 `navigate(targetUrl)` 完成 push/replace

### 4.6 state.ts — App Store 模式

```typescript
export const useWechatStore = createAppStore<WechatState>('wechat', (set, get) => ({
  ...WECHAT_CONFIG,

  sendMessage: (chatId, content) => set(state => {
    const chat = state.chats.find(c => c.id === chatId);
    chat.messages.push({
      id: generateId(),
      content,
      timestamp: TimeService.now(),  // 使用模拟时间
      sender: 'me',
    });
  }),

  // 禁止定义查询型 getter
  // ✗ isLiked: (postId) => get().likedIds.includes(postId)
  // ✓ 组件中直接订阅 s.likedIds，用 .includes() 派生
}));
```

### 4.7 手势 Hook（hooks/use*Gestures.ts）

```typescript
function useWechatGestures() {
  const { go, back } = useAppNavigate();

  const { bindTap, bindLongPress, bindBack } = useTriggerGestures<GestureId>({
    execute: (id, params) => {
      if (id === 'system.back') return; // OS 统一处理
      go(id, params);
    },
  });

  return { bindTap, bindLongPress, bindBack, go, back };
}
```

产出 DOM 属性供 bench_env 和 nav graph 使用：
- `data-trigger="chat.open"` + `data-trigger-type="tap"`
- `data-action="home.search"` + `data-action-type="tap"`
- `data-scroll-container="chat-list"` + `data-scroll-direction="vertical"`

### 4.8 App 自动发现机制

```
PackageManagerService:
  import.meta.glob(['../apps/*/manifest.ts', '../system/*/manifest.ts'], { eager: true })
  → 扫描所有 manifest → 建立 appId 映射

appRegistry.tsx:
  import.meta.glob(['../../apps/*/*App.tsx', '../../system/*/*App.tsx'])
  → 懒加载入口组件 → renderAppContent(appId) 触发加载

state.ts 自动发现:
  import.meta.glob(['./apps/*/state.ts', './system/*/state.ts'])
  → 自动注册 App store
```

**新增 App 不需要修改 OS 层任何文件。**

---

## 五、Benchmark 层

### 5.1 总体架构

```
bench_env/
├── run.py                 ← CLI 入口
├── factory.py             ← 组件工厂
├── config.py              ← RunnerConfig
├── metrics.py             ← Pass@k 统计
├── env/
│   ├── base.py            ← Observation, Action, BaseMobileEnv
│   ├── mobile_gym.py      ← MobileGymEnv (Playwright)
│   ├── real_device.py     ← ADB 真机环境
│   ├── pool.py            ← 环境池（并行评测）
│   └── recorder.py        ← 轨迹记录
├── agent/
│   ├── generic_v2.py      ← 通用 VLM Agent
│   ├── generic.py         ← 旧版 Agent
│   ├── gelab.py           ← Gelab Agent
│   ├── autoglm.py         ← AutoGLM Agent
│   └── human.py           ← 人工操作
├── runner/
│   ├── base.py            ← BaseRunner, Evaluator, Controller
│   ├── serial.py          ← 串行执行
│   ├── parallel.py        ← 并行执行
│   └── exec.py            ← 仅执行不评测
└── task/
    ├── base.py            ← BaseTask, BaseApp
    ├── registry.py        ← TaskRegistry 自动发现
    ├── judge.py           ← StateComparator
    ├── vlm_judge.py       ← VLM 视觉评测
    ├── common_tasks.py    ← CriteriaTask, AnswerTask, VagueTask, SafetyTask
    ├── sampler.py         ← 参数采样
    ├── utils.py           ← 工具函数
    ├── os_helpers.py      ← OS 状态辅助
    ├── wechat/            ← 微信任务
    │   ├── app.py         ← Wechat(BaseApp)
    │   └── tasks.py 或 defs/*.py ← 任务类
    ├── weather/
    ├── spotify/
    └── ...                ← 每个 App 一个目录
```

### 5.2 评测循环

```
Runner 主循环：
  1. __SIM__.reset()              ← 重置模拟器
  2. __SIM__.setState(task.setup)  ← 注入任务初始状态
  3. __SIM__.waitForData()        ← 等待数据加载
  4. screenshot → Agent.act()     ← Agent 观察截图，输出动作
  5. __SIM_INPUT__.tap/swipe/...  ← 执行动作
  6. 重复 4-5 直到 Agent 认为完成或超时
  7. __SIM__.getState()           ← 获取最终状态
  8. task.evaluate(init, final)   ← 判定任务是否成功
```

### 5.3 任务类型层级

```
BaseTask
├── CriteriaTask    ← 路由/状态/条件匹配
│   例: OpenMyQRCode → criteria = {"route": "/me/qrcode"}
│
├── AnswerTask      ← 问答任务（Agent 需回答问题）
│   例: CheckOutdoorActivity → answer 从 state 计算
│
├── VagueTask       ← 模糊目标任务
│
├── SafetyTask      ← 安全任务（Agent 应拒绝执行）
│
└── 自定义 is_successful
    例: CheckSongInfo → 自定义复杂判断逻辑
```

### 5.4 评测机制

**State-based（默认）**：

```python
class JudgeInput:
    init_obs: dict       # 初始状态
    last_obs: dict       # 最终状态
    answer: str          # Agent 回答

class JudgeResult:
    success: bool        # 目标是否达成
    clean: bool          # 是否有意外副作用
    progress: float      # 进度 0-1
    issues: list         # 问题描述
    warnings: list       # 警告
```

- `StateComparator.diff_states()` 比较初始/最终状态
- `filter_unexpected_changes()` 过滤预期变更
- 验证 App route、store 数据、OS 设置等

**VLM-based**：

- 无法获取状态时（如真机），使用轨迹截图 + VLM 判断
- `VLMJudge.evaluate()` 将截图序列和动作描述发给 VLM
- 输出结构化 JSON 结果

### 5.5 Playwright 交互层

`MobileGymEnv` 通过 `page.evaluate()` 调用浏览器端 API：

```python
# 获取状态
state = await page.evaluate("() => window.__SIM__?.getState()")

# 执行点击
await page.evaluate("({x,y}) => window.__SIM_INPUT__?.tap(x,y)", {"x": cx, "y": cy})

# 重置
await page.evaluate("() => window.__SIM__?.reset()")

# 注入状态
await page.evaluate(
    "({patch, deep, reload}) => window.__SIM__?.setState(patch, {deep, reload})",
    {"patch": setup_data, "deep": True, "reload": False}
)
```

---

## 六、脚本与工具链

### 6.1 导航系统工具链

```
navigation.declaration.ts   ←── 开发者编写
         │
         ▼
check_navigation_declaration_consistency.mjs   ←── 一致性检查
  验证: declaration 中的 transition/action ID
        是否在源码中有对应的 bindTap/bindAction 调用
         │
         ▼
navigation_declaration_analyzer.mjs   ←── 导航图生成
  输入: declaration
  输出: nav_graph.json
    节点 = uiState (route + search + conditions)
    边   = transition / action
  模式: schema (仅结构) / data (含数据实例展开)
         │
         ▼
generate_action_tasks_from_nav_graph.mjs   ←── 任务枚举
  输入: nav_graph.json
  输出: action_tasks.json
  算法: BFS 从入口遍历所有可达 action
         │
         ▼
bench_env/task/*/tasks.py 或 defs/*.py ←── 人工精调/编写任务
```

**一键命令**：`node scripts/build_nav_artifacts.mjs <AppName>`

### 6.2 其他工具脚本

| 脚本 | 用途 |
|------|------|
| `build_pinyin_dict.mjs` | 从 Rime 词典生成拼音 IME 词库 |
| `lint_store_getters.mjs` | 检测 store 中的查询型 getter 违规 |
| `verify_task_judges.py` | 验证任务 judge 逻辑正确性 |
| `fix_strings_i18n.mjs` | 字符串 i18n 修复 |
| `migrate_strings.mjs` | 字符串迁移 |
| `build_settings_i18n.mjs` | 设置项 i18n 构建 |

---

## 七、数据流全景

### 7.1 状态快照（`__SIM__.getState()`）

```
{
  os: {
    taskManager: { tasks, activeTaskId, isLauncherVisible, isRecentsVisible },
    state: { settings, hardware, permissions, preferences },
    services: {
      notifications: [...],
      clipboard: { current, history },
      keyboard: { visible, height },
      location: { mode, mockCoord },
      ...
    },
    providers: {
      contacts: [...],
      sms: [...],
      media: [...],
    },
  },
  apps: {
    wechat: { chats, contacts, moments, ... },
    alipay: { balance, bills, ... },
    calendar: { events, settings, ... },
    ...
  },
}
```

### 7.2 状态注入（`__SIM__.setState(patch)`）

```python
# bench_env 中的 task setup
__SIM__.setState({
    "apps": {
        "wechat": {
            "chats": [{"id": "test", "messages": [...]}],
        },
    },
    "os": {
        "state": {
            "settings": {"global": {"wifi_on": True}},
        },
    },
}, deep=True)
```

### 7.3 输入注入流程

```
bench_env (Python)
  │ page.evaluate("__SIM_INPUT__.tap(x, y)")
  ▼
simInput.ts
  │ 坐标转换 (css/physical/auto)
  │ 创建 PointerEvent / TouchEvent
  │ dispatchEvent 到目标 DOM 元素
  ▼
React 事件系统
  │ onClick / onTouchStart 等
  ▼
App 业务逻辑
  │ useTriggerGestures → go(transitionId)
  ▼
navigation.ts → react-router navigate()
```

---

## 八、关键设计模式

### 8.1 Store 工厂模式

所有 Zustand store 通过统一工厂创建，自动注册到 registry，支持全局 reset/snapshot。

```
createOsStore       ──→ 持久化 + registry
createVolatileOsStore ──→ 非持久化 + registry
createAppStore      ──→ 持久化 + app registry
```

### 8.2 优先级链模式（BackDispatcher）

返回键分发通过优先级链实现，高优先级组件优先消费事件。避免了复杂的订阅/取消订阅逻辑。

### 8.3 事件驱动注册（AppNavigatorRegistry）

App navigator 注册使用 CustomEvent + Promise 模式，解决 App 异步加载时 OS 需要同步获取 navigator 的时序问题。

### 8.4 Facade 模式（Services & Managers）

- `StatusBarService` / `QuickSettingsService` 是 `OsStateStore` 的只读 facade
- `ConnectivityManager` 等是 `OsStateStore` 的写入 facade（封装约束和副作用）

### 8.5 ContentProvider 模式

完整复刻 Android `content://` URI 抽象：注册 authority → ContentResolver 路由 → Provider 处理 → 返回 Cursor。

### 8.6 自动发现（import.meta.glob）

App manifest、入口组件、state store 全部通过 `import.meta.glob` 自动发现，新增 App 零配置。

### 8.7 声明式导航

`navigation.declaration.ts` 作为单一事实来源，同时服务于：运行时导航、一致性检查、图生成、任务生成。

---

## 九、与 Android 的对应与差异

### 9.1 对应关系

| Android 概念 | mobile-gym 实现 |
|-------------|----------------|
| ActivityTaskManager | `TaskManager.ts` — osReducer + Task/Activity 栈 |
| Activity | `ActivityInstance` — appId + initialRoute + intent |
| AndroidManifest.xml | `manifest.ts` — id, intentFilters, permissions |
| Intent / IntentFilter | `IntentResolver.ts` + `PackageManagerService` |
| Back Stack | `BackDispatcher.ts` — 优先级链 |
| Settings.System/Global/Secure | `OsStateStore.settings.*` |
| BatteryManager/ConnectivityManager | `os/managers/*.ts` |
| ContentProvider | `os/providers/*.ts` + `ContentResolver.ts` |
| PackageManager | `PackageManagerService.ts` |
| NotificationManager | `NotificationService.ts` |
| ClipboardManager | `ClipboardService.ts` |
| InputMethodService | `KeyboardService.ts` + `pinyinIme.ts` |
| LocationManager | `LocationService.ts` |
| BroadcastReceiver | `BroadcastBus` + `os/types/broadcast.ts` |
| SharedPreferences | `OsStateStore.preferences` |
| res/values/ | `res/colors.ts`, `res/strings.ts`, `res/dimens.ts` |
| Launcher | `os/launcher/Launcher.tsx` |

### 9.2 主要差异

| 领域 | Android | mobile-gym | 原因 |
|------|---------|------------|------|
| 进程模型 | 每个 App 独立进程 | 单 JS 线程，共享内存 | 浏览器限制 |
| App 安装 | APK 安装/卸载 | 编译时静态发现 | 简化 |
| Fragment | Activity 内嵌 Fragment | React 组件 + MemoryRouter | Web 栈 |
| 真实网络 | 系统网络栈 | Vite dev server proxy | 跨域限制 |
| 文件系统 | ext4/f2fs | 虚拟文件系统（内存/public） | 浏览器沙箱 |
| 权限 | 运行时危险权限 | 模拟弹窗 + OsStateStore | 简化 |
| Service/WorkManager | 后台服务 | 未实现 | 优先级不高 |
| 多窗口/分屏 | 支持 | 未实现 | 复杂度 |

---

## 十、构建与运行时基础设施

### 10.1 Vite 配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 端口 | 3000, host 0.0.0.0 | 支持远程访问 |
| 路径别名 | `@/*` → 项目根 | 简化 import |
| CSS | Tailwind CLI (Rust) | 构建时间从 ~40s 降到 ~1s |

**自定义 Vite 插件**：

| 插件 | 职责 |
|------|------|
| `tailwindCliPlugin` | 调用 Tailwind CLI (Rust) 替代 JS 插件 |
| `serveAppAssetsPlugin` | `/@app-assets/<App>/<path>` 访问 App 资源 |
| `apiGatewayPlugin` | `/api/gw/*` 统一 HTTP 代理网关 |
| `fileSystemPlugin` | `/api/sdcard` 扫描虚拟 SD 卡 |
| `runsExplorerPlugin` | `/api/runs` 访问评测记录 |
| `accessLogPlugin` | HTTP 访问日志 |

### 10.2 TypeScript 配置

- `strict: true`，`target: ES2022`，`module: ESNext`
- `noEmit: true`（仅类型检查，不产出 JS）
- 路径别名：`@/*` → `./*`

### 10.3 ESLint

- 作用域：`os/`、`apps/`、`system/`
- 核心规则：禁止任何形式的 `new Date(...)` 和裸 `Date.now()`（必须用 `TimeService`：`getDate()`、`now()`、`fromTimestamp()`、`fromLocalParts()`）
- 例外：`os/TimeService.ts` 本身

### 10.4 测试

- Vitest 4.0 + Puppeteer 24
- `npm run test` / `npm run test:watch`

---

## 十一、架构评估与未来方向

### 11.1 架构优势

| 优势 | 说明 |
|------|------|
| **高保真模拟** | 任务栈、Intent、ContentProvider、Settings 等核心 Android 语义完整复刻 |
| **零注册发现** | `import.meta.glob` 实现 App 自动发现，极低的新增成本 |
| **声明式导航** | 一份声明服务于运行时、静态分析、图生成、任务生成 |
| **可控时间** | TimeService 统一管理，benchmark 可精确控制时间 |
| **状态可观测** | `__SIM__.getState()` 随时获取完整状态快照，支持自动化评测 |
| **状态可注入** | `__SIM__.setState()` 支持任意状态注入，任务间完全隔离 |
| **分层持久化** | 数据持久化 + 运行态不持久化，精确模拟"重启"语义 |
| **Manager Facade** | 约束逻辑集中，避免各 App 重复实现硬件状态管理 |

### 11.2 已知局限

| 局限 | 影响 | 缓解方案 |
|------|------|---------|
| 单线程 | 无法模拟 App 进程隔离 | 通过 store 隔离 + 命名空间模拟 |
| 无后台 Service | 无法模拟后台任务 | 可通过 Timer + BroadcastBus 近似 |
| 内存不足 | 无法执行 production build | 使用 dev server + `tsc --noEmit` 类型检查 |
| 网络代理 | 所有 HTTP 走 Vite server proxy | 足够支持演示数据 |

### 11.3 文档体系

| 文档 | 定位 |
|------|------|
| `CLAUDE.md` / `AGENTS.md` | AI 编码助手指南 |
| `PROJECT_SPEC_V2.md` | 权威项目规范 |
| `SIMULATOR_ARCHITECTURE_AND_ANDROID_MAPPING.md` | 架构与 Android 对应 |
| `OS_DATA_LAYER_SPEC.md` | OS 数据层设计 |
| `APP_STATE_DATA_SPEC.md` | App 状态与数据规范 |
| `APP_DESIGN_SPEC.md` | App 设计规范 |
| `NAVIGATION_DECLARATION_PROPOSAL.md` | 导航声明方案 |
| `ACTIONS_DECLARATION_PROPOSAL.md` | 动作声明方案 |
| `DATA_SOURCE_PROPOSAL.md` | 数据源声明方案 |
| `UI_GRAPH_GENERATION.md` / `UI_GRAPH_SOLUTION.md` | UI 图生成方案 |
| 本文档 (`SYSTEM_ARCHITECTURE_FULL.md`) | 系统架构全景 |

---

> **本文档基于代码库自动分析生成，反映 2026-03-08 `dev` 分支的实际状态。**
