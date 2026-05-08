# mobile-gym 与真实 Android 的功能差距及完善路径

---

## Section 1：功能差距分析（对照真实 Android 应用框架层）

### 1. Activity/Fragment 生命周期

**真实 Android：** 完整生命周期链 `onCreate → onStart → onResume → onPause → onStop → onDestroy`，以及 `onSaveInstanceState / onRestoreInstanceState`。系统在内存压力下会主动回收后台 Activity。

**mobile-gym 已有：** 所有 App 始终保持 React 组件挂载状态（`SystemShell.tsx:1102-1109`），等同于 `onPause/onStop` 但永远不执行 `onDestroy`。`useAppReady` hook 提供了类似 `onResume` 的首次激活通知。

**关键缺失：**
- 没有 `onPause` / `onResume` 的真实模拟
- 没有 `onSaveInstanceState` 语义
- 没有内存压力回收机制，`runningApps` 无 LRU 淘汰
- Fragment 生命周期完全没有对应概念

---

### 2. Intent 系统

**mobile-gym 已有（相当完整）：** 显式/隐式 Intent 解析、Intent Stack、Intent Filter、`setResult`/`CANCELED`/`OK`、`queries` 声明、`resolveActivity`

**仍缺失：**
- **BroadcastReceiver** 完全没有（无法模拟系统级广播如 `ACTION_BATTERY_LOW`）
- **PendingIntent**（用于 Notification Actions、AlarmManager 触发）
- **Intent Chooser UI**（`intentChooserEnabled` 已预留但未实现）
- Category 系统（`CATEGORY_LAUNCHER` 等）
- Deep Link / App Links
- `startService` / `bindService`

---

### 3. 通知系统

**mobile-gym 已有：** NotificationService（push/markRead/dismiss）、持久化、重要性级别、Heads-up 浮现通知、下拉通知面板

**仍缺失：**
- **通知 Channel**（Android 8+）
- **通知 Actions**（快捷按钮，如"回复"、"标记已读"）
- 进度通知、媒体通知、通知分组
- 通知锁屏显示

---

### 4. 权限系统

**mobile-gym 已有：** `AppManifest` 有 `permissions?: string[]` 字段（预留），但完全没有权限请求/拒绝逻辑。

**仍缺失：**
- 整套权限请求弹框 UI（对 Agent 训练非常重要）
- 权限状态存储（granted/denied/never_ask_again）
- Camera、Microphone、Location 权限的运行时拦截
- Settings 中的应用权限管理页面

---

### 5. ContentProvider / 跨应用数据共享

**mobile-gym 已有：** `AppStateRegistry` 的 `getAllAppStates()` 实现了粗粒度的跨 App 数据读取（只读、整个 App state、无 URI 查询）

**仍缺失：**
- 真正的 ContentProvider 抽象（URI-based 数据访问）
- 系统级联系人共享
- MediaStore 统一索引
- Calendar Provider
- 跨应用数据写入

---

### 6. 系统服务对比

| Android 服务 | mobile-gym 实现情况 |
|---|---|
| ActivityManager | `OSContext.tsx` — 对应度高 |
| WindowManager | `SystemShell.tsx` z-index 层叠 — 无动态窗口管理 |
| PackageManager | `appRegistry.tsx` + `resolveIntent()` — 有等价物 |
| AlarmManager | **缺失** — 只有状态栏图标 |
| ClipboardManager | `ClipboardService.ts` — 完整实现 |
| DownloadManager | **缺失** |
| NotificationManager | `NotificationService.ts` — 基本实现 |
| LocationManager | `LocationService.ts` — 支持模拟/真实两种模式 |
| AudioManager | `DeviceService.ts` — 有音量控制，无实际音频 |
| ConnectivityManager | `QuickSettingsService.ts` — 状态切换有，无真实拦截 |
| InputMethodManager | `KeyboardService.ts` — 有软键盘，无完整 IME 框架 |
| SensorManager | **缺失** |
| StorageManager | `FileSystemService.ts` — 有虚拟文件系统，较完整 |
| PowerManager | `DeviceService.ts` — 有电量/充电状态，无 WakeLock |
| VibratorService | **缺失** |
| MediaSessionManager | **缺失** |

---

### 7. Settings / System UI

**已有：** SystemShade（通知+快捷设置双栏）、14 项 QuickSettings、WiFi/蓝牙/通知/存储/语言设置页面

**缺失：** 分屏模式、画中画（PiP）、应用信息页、开发者选项、电量/存储细分管理

---

### 8. 文件系统

**已有（相当完整）：** 基于 IndexedDB 的虚拟文件系统，路径模拟 `/sdcard/...`，目录列表、文件读写、Seed 导入、MediaService

**缺失：** 私有存储区分、SAF、Scoped Storage 隔离、FileProvider

---

### 9. 输入法（IME）

**已有：** 中英文切换、拼音输入法（带候选词）、键盘显示/隐藏控制

**缺失：** 语音输入、手写输入、表情键盘、`EditorInfo` 精细化文本类型

---

### 10. 连接性

**已有：** QuickSettings 所有开关（纯 UI 状态）、WiFi/蓝牙模拟环境数据、Settings 页面

**本质局限：** 网络连接的真正切断无法模拟（Web 平台固有限制）

---

### 11. App 安装/更新

`AppManifest` 有 `version` 和 `versionCode` 字段，但没有安装流程。缺失 APK 安装流程、版本检查、应用商店、卸载流程。

---

### 12. Recent Apps / 多任务

**已有（相当完整）：** 水平卡片列表、上划关闭、清除全部、Intent Stack 模拟 Task Stack

**缺失：** 同一 App 多 Task、`singleTask`/`singleTop` 启动模式、切换动画

---

### 13. Widgets（桌面小组件）

**已有（有创新性实现）：** 内置 Widget（Clock/Weather）+ WMR Widget（XML 描述格式），多尺寸、可拖拽

**缺失：** 第三方 App 注册 Widget、Widget 远程更新、Widget 点击交互

---

### 14. 无障碍服务

**已有：** `fontSizePct` 和 `displaySizePct` 滑块、无障碍相关字符串资源

**缺失：** 字体缩放实际 CSS 效果、TalkBack、高对比度模式、AccessibilityNodeInfo

---

## Section 2：面向 Agent 训练的功能完善优先级与路线图

### 哪些缺失功能对新任务类型影响最大？

**A 类（阻塞大量任务类型）：**

1. **权限请求弹框** — 大量真实任务需要先授权（相机拍照、位置共享、通讯录读取）
2. **Broadcast/事件总线** — 无法模拟跨应用联动（支付成功 → 订单更新）
3. **通知 Actions** — Agent 在通知栏直接操作（回复消息、接受会议邀请）

**B 类（影响真实感和覆盖率）：**

4. **App 生命周期回调（onPause/onResume）**
5. **Intent Chooser UI**
6. **ContentProvider 联系人统一**

**C 类（对 Agent 训练有提升但非紧迫）：**

7. AlarmManager
8. 字体/显示大小生效
9. 权限管理 Settings 页面
10. App 安装/卸载流程

---

### 分阶段路线图

**Phase 1 — 基础真实性提升（对 Agent 训练影响最大）**

| 目标 | 涉及文件 | 工作量 |
|---|---|---|
| 权限请求弹框系统 | 新建 `os/PermissionService.ts` + `os/components/PermissionDialog.tsx` | 中 |
| 通知 Actions | 修改 `NotificationService.ts`、`HeadsUpNotification.tsx`、`SystemShade.tsx` | 小 |
| Intent Chooser UI | `os/components/IntentChooserDialog.tsx`，`intentChooserEnabled` 逻辑已预留 | 小 |
| App onPause/onResume 钩子 | 修改 OSContext 的 `LAUNCH_APP`/`GO_HOME` reducer | 小 |

**Phase 2 — 跨应用协作与数据一致性**

| 目标 | 涉及文件 | 工作量 |
|---|---|---|
| 系统级联系人 ContentProvider | 新建 `os/ContactsProvider.ts` | 中 |
| 事件总线（BroadcastReceiver 替代物） | 新建 `os/BroadcastBus.ts` | 小 |
| MediaSession 统一管理 | 新建 `os/MediaSessionService.ts` | 中 |
| AlarmManager | 新建 `os/AlarmService.ts` | 中 |

**Phase 3 — 增强真实感（训练数据多样性）**

| 目标 | 涉及文件 | 工作量 |
|---|---|---|
| 字体/显示大小 CSS 效果 | `SystemShell.tsx` 注入 `--sys-font-scale` CSS var | 中 |
| App 卸载流程 | `Launcher.tsx` + OSContext 新增 `uninstallApp` | 小 |
| 权限设置页面 | `apps/Settings/` 新增页面 | 中 |
| SAF（`ACTION_OPEN_DOCUMENT`） | 模拟 FileManager App 作为 SAF 提供者 | 大 |
| 锁屏界面 | 新建 `os/components/LockScreen.tsx` | 中 |

---

## Section 3：作为 Android 系统设计学习资源的潜力分析

### 架构已经很好地镜像了 Android 的概念

1. **OSContext ↔ ActivityManagerService** — `LAUNCH_APP`、`CLOSE_APP`、`START_ACTIVITY_FOR_RESULT` 完全对应 AMS 核心职责
2. **AppManifest ↔ AndroidManifest.xml** — `packageName`、`version`、`intentFilters`、`queries`、`permissions` 结构对齐
3. **SystemShell ↔ Window Manager + SystemUI** — z-order 层叠对应 Android SystemUI 层次
4. **display:none 保活 ↔ Activity.onStop()** — 完美对应 App 切后台设计
5. **FileSystemService ↔ /sdcard + MediaStore** — 虚拟文件系统路径完全对应 Android 真实路径
6. **WMR Widget ↔ Android AppWidget** — 对 RemoteViews 机制的创新式 Web 实现

### Web 范式泄漏的地方

1. **`window.__OS__`** 应是类型安全的依赖注入（对应 `Context.getSystemService()`）
2. **`react-router-dom` 路由** — 学习者可能误以为 "URL 路由 = Activity 栈"
3. **localStorage** — 对应 SharedPreferences/Room，但缺少 Room 的查询能力
4. **`useEffect`/`useMemo`** — 作为"生命周期"但学习者无法推断 `onCreate/onResume` 的具体时机
5. **CORS 代理网关** — Android 没有 CORS，`HttpURLConnection` 直接访问任何 URL
6. **CSS z-index** — 与 `SurfaceFlinger` + `WindowManager` 图层合成没有直接关联

### 可以添加的教学抽象

1. **显式 `Context` 对象（依赖注入）**
```typescript
// 对应 Android Context.getSystemService()
const { notificationManager, clipboardManager } = useAppContext();
```

2. **Bundle 类（Intent 数据载荷）**
把 `IntentPayload.data` 从 `Record<string, any>` 改为强类型 `Bundle` 类

3. **Service 组件**
添加 `os/ServiceManager.ts`，支持后台 Service（无 UI 的长期任务）

4. **BroadcastBus（事件广播，带标注）**
标注 Android 广播 Action 对照，如 `CONNECTIVITY_CHANGE`、`ACTION_BATTERY_LOW`

### 文档/注释策略建议

1. **每个 Service 文件头部加 Android 对应说明**
```
// Android 等价物：NotificationManagerService (system_server)
// 对应 API：NotificationManager, NotificationChannel, Notification.Builder
// 差距：缺少 Channel、Actions、PendingIntent
```

2. **OSContext 的 startActivityForResult 上加序列图注释**
展示调用链：`Caller → OS.startActivityForResult → Target.onResume → Target.setResult → Caller.onActivityResult`

3. **维护 `docs/ANDROID_COMPAT.md`** — 按子系统记录已实现和缺失的功能

4. **WMR Widget vs. RemoteViews 对比说明**

### 与其他教育性 OS 项目对比

| 项目 | 特点 | 与 mobile-gym 的差异 |
|---|---|---|
| xv6 (MIT) | 教学用简化 Unix，C 语言 | 底层 OS，完全不同维度 |
| Android Emulator | 完整 Android 栈，需要 x86 VM | 重量级，不适合快速 Agent 训练 |
| OS-Genesis / OSWorld | 桌面 OS 模拟，也用 screenshot+action | 桌面向 |
| **mobile-gym** | **Web 原生，React 实现，零配置运行** | **最轻量**，牺牲底层真实性 |

mobile-gym 最独特的价值：**运行在浏览器里，无需 VM 或真机，但能模拟足够真实的手机应用交互流**。从学习资源角度看，应用框架层恰好是 Android 开发者最关心的。

要把这个潜力发挥出来，最值得做的一件事是：**在每个 OS 服务文件里标注"Android 对应物"和"已知差距"**，让读者能边用边学。
