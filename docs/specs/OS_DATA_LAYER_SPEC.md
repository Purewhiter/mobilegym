# OS 数据层设计规范

> 本文档描述模拟器 OS 层的数据架构：数据模型、状态管理、持久化策略、读写 API、以及与 bench_env 的交互契约。
>
> **核心语义**：浏览器刷新 = 设备重启（保留用户数据，清空运行态）。`__SIM__.reset()` = 重置模拟器到初始基线状态（清空所有改动，供 bench_env 任务间隔离）。

---

## 一、设计原则

### 1.1 持久化原则

**数据持久化，UI/会话/运行态不持久化。**

| 分类                | 持久化 | 刷新后行为 | 示例                                   |
| ------------------- | ------ | ---------- | -------------------------------------- |
| 设备数据 / 系统设置 | 是     | 保留       | WiFi 开关、亮度、语言、权限            |
| 用户长期数据        | 是     | 保留       | 联系人、短信、剪贴板历史、App 业务数据 |
| 桌面布局            | 是     | 保留       | Launcher 图标排列、文件夹              |
| 任务栈 / 前台应用   | 否     | 回到桌面   | TaskManager                            |
| 通知队列            | 否     | 清空       | NotificationService                    |
| UI 面板状态         | 否     | 关闭       | 通知面板、键盘、文本选择菜单           |

### 1.2 可观测性原则

**runtime observable ≠ reload persistent。**

所有运行时状态（包括不持久化的）都可通过 `__SIM__.getState()` 实时读取。bench_env 的 judge 函数可以观察任务栈、通知队列、键盘状态等，但这些状态不会跨刷新保留。

### 1.3 Android 数据模型对齐

`OS_DEFAULTS`（`os/data/defaults.json`）的内部结构对齐 Android 四层数据架构，而非按变更频率或其他维度自定义分组。查 Android 文档就知道某个属性属于 Build、Settings.System、Settings.Global 还是某个 Manager。

---

## 二、数据模型

### 2.1 Android 四层数据架构

```
Layer 1: Build Properties (ro.product.*)
  └── 出厂写死，运行时不可变（品牌、型号、RAM、屏幕、IMEI 等）

Layer 2: Settings Database
  ├── Settings.System  → 亮度、音量、字体大小、屏幕超时
  ├── Settings.Global  → WiFi 开关、蓝牙开关、飞行模式、深色模式
  └── 多个写入者，单一真相源

Layer 3: Hardware/Sensor State (System Services)
  ├── BatteryManager   → 电量、充电状态
  ├── WifiManager      → 连接 AP、信号强度
  ├── TelephonyManager → SIM 信息、运营商
  └── StorageManager   → 已用存储

Layer 4: Per-App Data
  └── 每个 App 独立的私有数据（对应 localStorage 各 appId key）
```

### 2.2 模拟器数据分层

| Android 层        | 模拟器对应                                                 | 存储位置                                |
| ----------------- | ---------------------------------------------------------- | --------------------------------------- |
| Build Properties  | `OS_DEFAULTS.build` + `managers/registry.ts` overrides | 代码常量 +`__os_scenario_overrides__` |
| Telephony         | `OS_DEFAULTS.telephony` + overrides                      | 同上                                    |
| Settings Database | `OsStateStore.settings` (system + global)                | `os_state` localStorage key           |
| Hardware State    | `OsStateStore.hardware`                                  | `os_state` localStorage key           |
| Permissions       | `OsStateStore.permissions`                               | `os_state` localStorage key           |
| Preferences       | `OsStateStore.preferences`                               | `os_state` localStorage key           |
| Per-App Data      | 各 App 的 Zustand store                                    | 各 `appId` localStorage key           |

---

## 三、OS 默认数据

### 3.1 文件结构

```
os/data/
├── defaults.json        ← Android 数据模型默认值
├── simulatorConfig.ts   ← 模拟器行为配置（非 Android 数据）
├── types.ts             ← 类型定义
├── index.ts             ← 统一导出 OS_DEFAULTS + SIMULATOR_CONFIG
├── themeConfig.ts       ← 主题 URL/key
├── fileSystemConfig.ts  ← 文件系统预设
└── appRegistry.tsx      ← App 自动发现
```

### 3.2 `OS_DEFAULTS`（`defaults.json`）

只包含 Android 数据模型。结构对齐 §2.1 四层架构：

```
OS_DEFAULTS
├── build                          ← Layer 1: 设备硬件信息（不可变）
│   ├── brand, marketName, model, manufacturer
│   ├── processor, cpuCores, cpuMaxFreq, gpu
│   ├── ramTotal, storageTotal
│   ├── screenSize, screenResolution, screenDensity, refreshRate
│   ├── rearCamera, frontCamera, batteryCapacity, chargingSpeed
│   ├── androidVersion, hyperOSVersion, securityPatch, buildNumber
│   ├── imei1, imei2, serialNumber, macAddress, bluetoothMac
│   └── kernelVersion, basebandVersion, hdrSupport
│
├── telephony                      ← Layer 1 扩展: SIM 信息
│   ├── sims[]                     ← slot, carrier, phoneNumber, iccid, networkType, ...
│   └── defaultDataSim
│
├── settings                       ← Layer 2: Settings Database
│   ├── system                     ← Settings.System
│   │   ├── brightness, mediaVolume
│   │   ├── fontSizePct, displaySizePct
│   │   └── eyeComfortLevel
│   └── global                     ← Settings.Global
│       ├── wifiEnabled, mobileDataEnabled, bluetoothEnabled
│       ├── airplaneModeEnabled, doNotDisturbEnabled, silentMode
│       ├── flashlightEnabled, batterySaverEnabled, rotationLocked
│       ├── locationEnabled, nfcEnabled, screenCastEnabled
│       ├── autoBrightnessEnabled, eyeComfortEnabled, darkModeEnabled
│       └── language
│
└── hardware                       ← Layer 3: 硬件/传感器状态
    ├── battery                    ← percent, charging, fastCharging, temperature, ...
    ├── cellular                   ← signalLevel, mobileDataType, noSim
    ├── wifi                       ← level, connectedSsid, ipAddress, ...
    ├── bluetooth                  ← name
    ├── storage                    ← used
    ├── hotspot                    ← enabled, ssid, password
    ├── vpnEnabled, headsetConnected, alarmSet
    ├── nearbyWifi[]               ← ssid, bssid, security, signalLevel, ...
    └── nearbyBluetooth[]          ← name, mac, type, paired, connected, ...
```

### 3.3 `SIMULATOR_CONFIG`（`simulatorConfig.ts`）

模拟器行为配置，在真实 Android 中没有对应物。与 `defaults.json` 分离，保持 Android 对齐的纯净性：

```
SIMULATOR_CONFIG
├── framework                      ← 渲染引擎参数
│   ├── screenHeight, screenWidth, dpr, viewportWidth, viewportHeight
│   ├── statusBarHeight, bottomGestureHeight, keyboardHeight
│   ├── edgeGestureWidth, swipeThreshold, gestureBarWidth/Height
│   ├── launcherPaddingTop, clockFontSize, appGridColumns, appIconSize
│   ├── recentsCardWidth/Height, recentsScrollContainerHeight
│   ├── zIndex* (StatusBar, Recents, Keyboard, ...)
│   └── transitionDuration, pageTransitionDuration
│
├── time                           ← 时间注入
│   ├── mode, simulatedTime, flowing, speed
│
├── location                       ← 位置注入
│   ├── mode, simulatedLocation
│
├── ai                             ← AI 后端
│   ├── enabled, baseUrl, model, apiKey, temperature, ...
│
├── display                        ← 显示缩放
│   ├── scale, themeColor
│
└── intent                         ← Intent 行为
    └── chooserEnabled
```

---

## 四、状态管理架构

### 4.1 Store 工厂

OS 层提供两个 Zustand store 工厂（`os/createOsStore.ts`）：

| 工厂函数                                                | 持久化             | 典型用途                |
| ------------------------------------------------------- | ------------------ | ----------------------- |
| `createOsStore(name, defaultState, options?)`         | 是（localStorage） | 设备数据、用户长期数据  |
| `createVolatileOsStore(name, defaultState, options?)` | 否（纯内存）       | UI 状态、会话态、运行态 |

两者都支持：

- `subscribeWithSelector`：selector 级精准订阅
- `immer` middleware（默认开启）：深层嵌套直接赋值
- 内置 store registry：`snapshotOsStores()` / `resetAllOsStores()`

### 4.2 Store 注册机制

- `registerToServiceRegistry`（默认 `true`）：决定是否注册到内部 registry
- 注册后的 store 可被 `snapshotOsStores()` 快照、`resetAllOsStores()` 重置
- `OsStateStore` 和 Provider store 设为 `false`，有独立的 reset/snapshot 路径

### 4.3 OS 层 Store 清单

#### 持久化 Store

| Store 名              | 文件                              | localStorage key      | registry | 数据内容                                     |
| --------------------- | --------------------------------- | --------------------- | -------- | -------------------------------------------- |
| `osState`           | `OsStateStore.ts`               | `os_state`          | false    | settings, hardware, permissions, preferences |
| `clipboard`         | `ClipboardService.ts`           | `os_clipboard_v1`   | true     | 剪贴板当前内容 + 历史                        |
| `provider.contacts` | `providers/ContactsProvider.ts` | `provider_contacts` | false    | 联系人列表                                   |
| `provider.media`    | `providers/MediaProvider.ts`    | `provider_media`    | false    | 收藏列表                                     |
| `provider.sms`      | `providers/SmsProvider.ts`      | `provider_sms`      | false    | 短信会话 + 消息                              |

#### 非持久化 Store（volatile）

| Store 名          | 文件                            | registry | 数据内容                                | 刷新后状态                 |
| ----------------- | ------------------------------- | -------- | --------------------------------------- | -------------------------- |
| `taskManager`   | `TaskManager.ts`              | true     | 任务栈, activeTaskId, isLauncherVisible | 空任务栈，显示桌面         |
| `notifications` | `NotificationService.ts`      | true     | 通知列表, unreadCount                   | 空列表                     |
| `shade`         | `SystemShadeService.ts`       | true     | 面板开关, kind                          | 关闭                       |
| `keyboard`      | `keyboard/KeyboardService.ts` | true     | visible, mode, height                   | 隐藏                       |
| `textSelection` | `TextSelectionService.ts`     | true     | 选择菜单, 选中文本                      | 隐藏                       |
| `location`      | `LocationService.ts`          | true     | 定位模式, 模拟坐标                      | 从 SIMULATOR_CONFIG 初始化 |

### 4.4 OsStateStore

统一的 Android 数据模型 store。从 `OS_DEFAULTS` 初始化，持久化到 `os_state`：

```ts
interface OsState {
  settings: {
    system: OsSystemSettings;   // 亮度、音量、字体大小等
    global: OsGlobalSettings;   // WiFi、蓝牙、飞行模式等开关
  };
  hardware: OsHardwareState;    // 电池、蜂窝、WiFi、蓝牙、存储
  permissions: Record<string, Record<string, PermissionStatus>>;
  preferences: Record<string, string | number | boolean | null>;
}
```

**注意**：`build` 和 `telephony` 不在 OsStateStore 中。它们是出厂不可变数据，由 `OS_DEFAULTS` 常量 + `managers/registry.ts` 的 override 机制管理（支持 bench_env 场景注入）。

### 4.5 Managers（写入 Facade）

Manager 是 OsStateStore 特定域的写入 facade，封装约束逻辑和副作用：

| Manager                 | 负责域                           | 约束逻辑示例                          |
| ----------------------- | -------------------------------- | ------------------------------------- |
| `ConnectivityManager` | WiFi/蓝牙/蜂窝/飞行模式/热点/VPN | 飞行模式级联关闭 WiFi/BT/蜂窝         |
| `BatteryManager`      | 电量/充电状态                    | percent clamp 0-100                   |
| `AudioManager`        | 音量/静音/勿扰                   | 音量 clamp 0-100, DND 同步 silentMode |
| `DisplayManager`      | 亮度/字体/显示大小/护眼          | 亮度 clamp 0-100                      |

### 4.6 Preference 路由（`managers/registry.ts`）

统一的 preference 读写入口，将 key 路由到对应 Manager：

```
routeSetPreference(key, value)
  → normalizePreferenceKey(key)     // 统一 key 别名
  → keyToManager.get(normalized)    // 查注册的 Manager
  → manager.setPreference(key, value)  // 有 Manager: 走约束逻辑
  → genericSetPreference(key, value)   // 无 Manager: 直接写 OsStateStore
```

各 Manager 在模块加载时通过 `registerManager(keys, manager)` 注册自己负责的 key。

---

## 五、App 层数据

### 5.1 Store 工厂

App 层使用独立的 store 工厂（`os/createAppStore.ts`）：

| 工厂函数                                                          | 持久化 | 说明                              |
| ----------------------------------------------------------------- | ------ | --------------------------------- |
| `createAppStore(appId, initialState)`                           | 是     | 简单 store                        |
| `createAppStoreWithActions(appId, initialState, actionCreator)` | 是     | 带 actions 的 store，自动排除函数 |
| `createVolatileAppStore(appId, initialState)`                   | 否     | 纯内存 store                      |

### 5.2 自动发现与注册

```
index.tsx
  └── import.meta.glob(['./apps/*/state.ts', './system/*/state.ts'], { eager: true })
      └── 启动时加载所有 state.ts → 创建 store → 注册到 storeRegistry
```

### 5.3 持久化规则

- localStorage key 默认等于 `manifest.id`（即 `appId`）
- `createAppStoreWithActions` 的 `defaultPartialize` 自动排除函数字段和 `_temp`
- App 可自定义 `partialize` 排除不需要持久化的字段（如搜索关键词、临时 UI 状态）

### 5.4 与 `getState().apps` 的关系

`__SIM__.getState().apps` = `getAllAppStates()` = `getAllStoreStates()`：遍历 storeRegistry，去掉函数字段后返回。

---

## 六、Provider 系统

Provider 是 OS 层的共享数据存储，对应 Android ContentProvider：

| Provider | 文件                              | localStorage key      | 数据内容        |
| -------- | --------------------------------- | --------------------- | --------------- |
| Contacts | `providers/ContactsProvider.ts` | `provider_contacts` | 联系人列表      |
| Media    | `providers/MediaProvider.ts`    | `provider_media`    | 收藏列表        |
| SMS      | `providers/SmsProvider.ts`      | `provider_sms`      | 短信会话 + 消息 |

- 使用 `createOsStore`（持久化），`registerToServiceRegistry: false`
- App 通过 `ContentResolver.query/insert/update/delete` 访问
- `__SIM__.getState().os.providers.*` 显式暴露快照

---

## 七、`__SIM__` API 契约

### 7.1 `getState()`

返回 `{ os, apps }` 结构。聚合逻辑在 `os/simState.ts` 的 `buildSimState()` 中：

```
__SIM__.getState()
├── os
│   ├── tasks, activeTaskId, isLauncherVisible, isRecentsVisible  ← TaskManager (volatile)
│   ├── runningApps, activeAppId                                   ← 从 tasks 派生
│   ├── intentStack, activeIntent                                  ← 从 tasks 派生
│   ├── locale                                                     ← localeApi
│   ├── time                                                       ← TimeService
│   ├── location                                                   ← LocationService
│   ├── installedApps                                              ← PackageManagerService
│   ├── clipboard                                                  ← ClipboardService (persisted)
│   ├── notifications                                              ← NotificationService (volatile)
│   ├── shade                                                      ← SystemShadeService (volatile)
│   ├── launcher                                                   ← localStorage 'launcher'
│   ├── settings                                                   ← OsStateStore (persisted)
│   ├── hardware                                                   ← OsStateStore (persisted)
│   ├── permissions                                                ← OsStateStore (persisted)
│   ├── preferences                                                ← OsStateStore (persisted)
│   ├── build                                                      ← OS_DEFAULTS + overrides
│   ├── telephony                                                  ← OS_DEFAULTS + overrides
│   ├── services                                                   ← snapshotOsStores() 去掉 notifications/clipboard
│   └── providers
│       ├── contacts                                               ← ContactsProvider (persisted)
│       ├── media                                                  ← MediaProvider (persisted)
│       └── sms                                                    ← SmsProvider (persisted)
│
└── apps                                                           ← getAllAppStates()
    ├── wechat: { ... }
    ├── alipay: { ... }
    └── ...
```

### 7.2 `setState(patch, options?)`

写入数据到 OS 和 App store。支持 deep merge（默认）：

```ts
__SIM__.setState({
  os: {
    settings: { global: { wifiEnabled: false } },
    hardware: { battery: { percent: 50 } },
    build: { model: 'Test Phone' },
    permissions: { wechat: { camera: 'granted' } },
  },
  apps: {
    wechat: { unreadCount: 5 },
  },
});
```

OS 部分通过 `applyOsStatePatch()`（`os/simState.ts`）处理，自动路由到对应 Manager（走约束逻辑）。

### 7.3 `reset()`

重置模拟器到初始基线状态（清空所有 localStorage + 重置所有 store + 刷新页面），用于 bench_env 任务间隔离：

```
1. localStorage.clear()            ← 清空所有 localStorage（含 App 数据）
2. OsStateStore.reset()            ← 重置为 OS_DEFAULTS
3. resetAllOsStores()              ← 重置 registry 中所有 store（volatile 和 persisted）
4. TaskManager.reset()             ← 清空任务栈
5. window.location.reload()        ← 整页刷新
```

Provider store 通过 `localStorage.clear()` 间接重置（持久化数据被清除，刷新后从默认状态恢复）。

---

## 八、localStorage Key 清单

### OS 层

| Key                           | 拥有者            | 持久化 | 内容                                            |
| ----------------------------- | ----------------- | ------ | ----------------------------------------------- |
| `os_state`                  | OsStateStore      | 是     | settings + hardware + permissions + preferences |
| `os_clipboard_v1`           | ClipboardService  | 是     | 剪贴板当前 + 历史                               |
| `provider_contacts`         | ContactsProvider  | 是     | 联系人列表                                      |
| `provider_media`            | MediaProvider     | 是     | 收藏列表                                        |
| `provider_sms`              | SmsProvider       | 是     | 短信会话 + 消息                                 |
| `launcher`                  | Launcher          | 是     | 桌面布局、图标、文件夹                          |
| `__os_scenario_overrides__` | managers/registry | 是     | build/telephony bench_env 覆盖                  |

### App 层

| Key         | 拥有者             | 说明                   |
| ----------- | ------------------ | ---------------------- |
| `{appId}` | 各 App 的 state.ts | 默认 key = manifest.id |

### 已废弃（启动时自动清理）

| Key                      | 清理位置               |
| ------------------------ | ---------------------- |
| `os_quick_settings_v2` | OsStateStore.ts        |
| `os_status_bar_v2`     | OsStateStore.ts        |
| `os_device_v1`         | OsStateStore.ts        |
| `os_permissions_v1`    | OsStateStore.ts        |
| `os_task_manager`      | TaskManager.ts         |
| `os_notifications_v1`  | NotificationService.ts |

---

## 九、bench_env 集成

### 9.1 任务前准备

```python
# 典型 bench_env 任务流程
await page.evaluate("__SIM__.reset()")          # 恢复出厂
await page.evaluate("__SIM__.setState({...})")  # 注入场景数据
await page.evaluate("__SIM__.warmUpAllApps()")  # 预热所有 App
```

### 9.2 Judge 读取状态

```python
state = await page.evaluate("__SIM__.getState()")
assert state['os']['settings']['global']['wifiEnabled'] == True
assert state['os']['hardware']['battery']['percent'] == 78
assert state['apps']['wechat']['unreadCount'] == 0
```

### 9.3 数据路径参照

| 常用 judge 路径                         | 说明             |
| --------------------------------------- | ---------------- |
| `os.settings.global.wifiEnabled`      | WiFi 开关        |
| `os.settings.global.bluetoothEnabled` | 蓝牙开关         |
| `os.settings.global.darkModeEnabled`  | 深色模式         |
| `os.settings.global.language`         | 系统语言         |
| `os.settings.system.brightness`       | 亮度 (0-100)     |
| `os.settings.system.mediaVolume`      | 媒体音量 (0-100) |
| `os.hardware.battery.percent`         | 电量             |
| `os.hardware.battery.charging`        | 是否充电         |
| `os.hardware.cellular.signalLevel`    | 蜂窝信号         |
| `os.hardware.wifi.connectedSsid`      | 当前 WiFi SSID   |
| `os.permissions.{appId}.{permission}` | 权限状态         |
| `os.build.model`                      | 设备型号         |
| `os.telephony.sims[0].phoneNumber`    | 电话号码         |
| `os.notifications.items`              | 通知列表         |
| `os.notifications.unreadCount`        | 未读通知数       |
| `os.activeAppId`                      | 当前前台 App     |
| `os.tasks`                            | 当前任务栈       |
| `os.providers.contacts.contacts`      | 联系人           |
| `os.providers.sms.conversations`      | 短信会话         |
| `apps.{appId}.*`                      | App 业务数据     |
