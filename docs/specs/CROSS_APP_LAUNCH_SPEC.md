# 跨 App 调用与 Task 生命周期规范 v1.0

> 本文档描述模拟器的跨 App 调用 (`startActivity` / `startActivityForResult` / `openApp`) 与
> Task 生命周期模型，并给出与 Android 原生 (AOSP) 行为的对齐说明。
>
> **设计原则**：对齐 **AOSP 标准行为**。部分 OEM 厂商分支的特异行为不强制复现。
>
> AOSP 参考路径：`/Users/purew/aosp-ref/`（仅本机本地，提交时不带入仓库）。

---

## 一、设计原则与约束

### 1.1 我们与 AOSP 的根本架构差异

| 维度 | AOSP 真机 | 本模拟器 |
|---|---|---|
| App 内组件粒度 | 1 App = 多个 `Activity`，每个独立声明 launchMode/taskAffinity | 1 App = 1 OS Activity（顶层 React 组件 + MemoryRouter）|
| 内部页面切换 | Activity 间 `startActivity` / Fragment / Navigation Component | MemoryRouter 路由（路由 ≈ 真机的 Fragment 或 Sub-Activity）|
| 进程模型 | 每个 App 独立进程 | 单 JS 进程，所有 App 同实例 |
| Activity 生命周期 | onCreate/onStart/onResume/onPause/onStop/onDestroy | 简化为 `foreground/background/destroy` 三事件 |

这些差异导致**部分 AOSP 概念无法 1:1 复制**，需要做合理 abstraction（详见 §六）。

### 1.2 不模拟 OEM 特异行为

OEM 厂商在 AOSP 之上有大量自定义行为，例如：

- 不同的 task 调度时序、冷启动 splash 表现
- 后台 task 内存压力下的销毁策略
- 通知栏跳转的合成栈策略偏差
- 分屏 / 自由窗口 / 小窗

**这些不在本模拟器对齐范围内**。任何"在某品牌真机上行为不同"的反馈，需要先比对 AOSP 标准；若 AOSP 与该品牌一致，按 AOSP 修；否则记入"已知差异"。

---

## 二、Manifest 层：`AppIntentFilter`

### 2.1 字段总览

定义于 [`os/types/manifest.ts`](../../os/types/manifest.ts) 的 `AppIntentFilter`：

| 字段 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `action` | `string` | 必填 | Intent 动作（如 `'ACTION_SEND'`、`'ACTION_VIEW'`、`'ACTION_PAY'`）|
| `type` | `string?` | – | MIME 类型过滤（支持通配 `'image/*'`）|
| `scheme` | `string?` | – | URL scheme 过滤（如 `'sms'`、`'weixin'`）|
| `route` | `string` | 必填 | 接收此 intent 时落地的 App 内部路由 |
| `launchMode` | `'standard' \| 'singleTask'` | `'standard'` | 启动模式（见 §2.2）|
| `params` | `array?` | – | 路由参数说明（供文档/bench）|
| `description` | `string?` | – | 描述文本 |

### 2.2 `launchMode` 的语义

对应 AOSP `<activity android:launchMode>`，但建模在 **per-intent-filter** 而非 per-Activity（因架构差异）。每条 filter 概念上等价于真机里一个独立的接收 Activity。

#### `standard`（默认）

行为对齐 AOSP `standard`：

- 调用方传 `{ newTask: true }` → 接收方在自己的 task 中启动；caller task 创建/复用为 caller 的关系链
- 调用方未传 `newTask` → 接收方 Activity 推到 caller task 顶
- 适用于：支付、查看、选择器等"做完就回 caller"的一次性事务

#### `singleTask`

对齐 AOSP `<activity launchMode="singleTask">` + 默认 `taskAffinity`：

- **总是**进入接收方自己的 task（不论 caller 是否传 `newTask`，IntentResolver 会自动 promote）
- 若该 task 已存在：清空其中除 root 之外的所有 Activity（等价 `FLAG_ACTIVITY_CLEAR_TOP`），把新 intent 投递到 root，重置 root 的 MemoryRouter 历史到 `['/', baseRoute]`
- 若 task 不存在：创建新 task，root Activity 历史以 push 模式落到 `['/', baseRoute]`（保留 `/` 作为返回栈底）
- 适用于：分享接收（典型如 WeChat 的 `ACTION_SEND image/*`）—— 完成后用户停留在接收方 task，按返回回到接收方主页

#### 未建模的 launchMode

- `singleTop`：未实现。低频场景（通知重复点击复用栈顶 Activity 等）
- `singleInstance`：未实现。存在于系统特殊场景（如 AOSP `Settings`、`Gallery2` 内部子 Activity），当前 benchmark 任务集未覆盖

记入 §六 已知差异。

### 2.3 `intent.route` 的优先级

```ts
const baseRoute = intent.route ?? targetFilter?.route ?? '/';
```

调用方在 `intent.route` 上指定的子路由 **优先于** filter 声明的 `route`。

**为什么这么设计**：AOSP 没有"route"概念——接收 Activity 是分发单元，调用方通过 `intent.extras` 传内部状态，Activity 在 `onCreate` / `onNewIntent` 中读取并自行内部导航。

我们的模型把 route 暴露成 caller hint，相当于一次性指明目标子页，等价于 AOSP "调用方塞 extras + receiver Activity 内部导航"，但避免了 OS 先 navigate 到 baseRoute、App-side 再 dispatch 到子页带来的双跳竞态。

**实例**：Settings → FileManager 查看分类页 [system/Settings/components/StorageDashboardPage.tsx](../../system/Settings/components/StorageDashboardPage.tsx)：

```ts
__OS__.startActivity({
  action: 'ACTION_VIEW',
  type: 'inode/directory',
  route: '/category/images',  // ← caller hint，覆盖 filter 的 route='/'
});
```

---

## 三、调用方 API（caller 侧）

### 3.1 `startActivity(intent, options?)`

最常用的"发 intent"API。映射真机 `startActivity()`。

```ts
__OS__.startActivity(
  {
    action: 'ACTION_VIEW',
    scheme: 'sms',
    data: { address: '12306', body: '999' },
  },
  { newTask: true },   // 等价 FLAG_ACTIVITY_NEW_TASK
);
```

**`{ newTask: true }`**：对齐 AOSP `Intent.FLAG_ACTIVITY_NEW_TASK`。接收方进入自己的 task；不传则进入 caller 的 task（same-task push）。

**未建模的 caller flags**：`FLAG_ACTIVITY_CLEAR_TOP`、`FLAG_ACTIVITY_SINGLE_TOP`、`FLAG_ACTIVITY_NO_HISTORY`、`FLAG_ACTIVITY_MULTIPLE_TASK` 等。记入 §六。

### 3.2 `startActivityForResult(intent | appId, callback)`

需要回执的调用，对应 AOSP `startActivityForResult` + `onActivityResult`。

```ts
__OS__.startActivityForResult(
  { action: 'ACTION_PAY', scheme: 'alipays', data: {...} },
  (result) => {
    if (result.resultCode === 'OK') { /* ... */ }
  },
);
```

走 same-task push，接收方调 `__OS__.setResult({...})` 触发回调。

### 3.3 `openApp(appId, route?)`

主要用于**通知点击**与**深链导航**。

```ts
__OS__.openApp('wechat', '/chat/abc');
```

**行为**：永远 push（不 replace）：

- App 未运行：新建 App task，根 Activity 起始路由 `/`，push 上去 `route` → 历史 `['/', route]`，按返回回主页。**这部分语义近似 AOSP `TaskStackBuilder.addNextIntentWithParentStack` 合成首条 intent + parent chain 的效果**（参见 AOSP `TaskStackBuilder.java` 的 `getIntents()` 给首 intent 添加 `FLAG_ACTIVITY_NEW_TASK | CLEAR_TASK | TASK_ON_HOME`）
- App 已运行：保留用户当前位置，push `route` 到栈顶 → 历史 `[..., currentRoute, route]`，按返回回原所在页。**这部分是有意识偏离 AOSP**——`TaskStackBuilder` 在 warm 场景会给首 intent 加 `FLAG_ACTIVITY_CLEAR_TASK` 重建栈，我们选择保留用户原位置以提供更友好的体验。详见 §六

调用方：
- [os/PendingIntent.ts](../../os/PendingIntent.ts) — 通知 PendingIntent 触发
- [os/components/SystemShade.tsx](../../os/components/SystemShade.tsx) — 通知中心点击
- [os/components/HeadsUpNotification.tsx](../../os/components/HeadsUpNotification.tsx) — 横幅通知点击

> ⚠️ 跨 App 跳转去看一眼某个数据（如"Settings → 文件管理器"）应使用 `startActivity`，**不是 `openApp`**。`openApp` 的合成栈语义会导致用户多按一次返回。

---

## 四、Task 生命周期

### 4.1 字段：`launchedByTaskId`（一次性指针）

[os/TaskManager.ts](../../os/TaskManager.ts) 中 `Task.launchedByTaskId` 记录"创建本 task 时的 caller task id"。

**生效时机**：
- `LAUNCH_APP` 创建新 task 时设置为当时的 `activeTaskId`
- 已存在的 task 被 `LAUNCH_APP` 重新激活时，**不修改**（除非来自桌面且 `wasExternallyRouted=false`，则清为 `undefined`）

**用途**：用户在 launched task 中按返回到根页面后，OS 用此指针决定切回哪个 caller task。

**一次性消费语义** ([CONSUME_LAUNCHED_BY](../../os/TaskManager.ts) action)：用过一次（用户从 wechat back 回 gallery 那一次）后立即清成 `undefined`。

**为什么**：再次通过 recents 进入此 task 后按返回，应走默认回桌面行为，而不是沿原启动链跳回旧 caller——对应 AOSP 真机用 task Z-order 决定返回目标的语义（Z-order 不会"记住"用户已离开的 caller）。

### 4.2 task 持久保留（不主动销毁）

我们建模的是 AOSP **用户在 task 根页按返回 / move-to-back** 的可见行为：用户被切回前一个 task，原 task 留在 recents。

- AOSP root back 走 `ActivityClientController` 的 `moveActivityTaskToBack` 路径（不是 `finish()`），把 task 切到后台，task 仍在 recents
- AOSP 显式销毁 task 需要调 `finishAndRemoveTask()` 或用户从 recents 划掉
- 注意我们**不泛化所有 `Activity.finish()` 场景**——AOSP `finish()` 也只是移除 Activity 自身，能否销毁 task 取决于 task 内是否还有其它 Activity 等条件

对应实现：[os/OSContext.tsx](../../os/OSContext.tsx) 的 `finishActivity`、`os.returnToLauncherTask`、`os.goHomeFallback` 三处 back-out 路径**均不调用 `closeTask`**，只激活 caller task 或返回桌面。task 留在 `state.tasks` 里，用户可从 recents 重新进入。

显式销毁 task 由用户主动操作触发，对应 AOSP `finishAndRemoveTask` 等显式路径：

- 用户在 recents 上滑 / 划掉某个 task → 触发 `closeTask(taskId)`（[os/OSContext.tsx:243](../../os/OSContext.tsx)）
- App / OS API 主动销毁 → `__OS__.closeApp(appId)`（[os/OSContext.tsx:340](../../os/OSContext.tsx)），内部委托 `closeTask`
- 这些路径调 [TaskManager](../../os/TaskManager.ts) 的 `CLOSE_TASK` action，把 task 从 `state.tasks` 中移除

### 4.3 接收方进入时的内部 history 重置

[os/OSContext.tsx](../../os/OSContext.tsx) 在 back-out 至 caller 前，把目标 App 的 MemoryRouter 重置到 `/`：

```ts
const activityNav = AppNavigatorRegistry.getActivity(top.activityId)?.navigate;
try { activityNav?.('/'); } catch { /* ignore */ }
TaskManager.activateTask(launchedByTaskId);
TaskManager.consumeLaunchedBy(activeTask.taskId);
```

**为什么**：用户从 recents 重新进入此 task 时看到 App 主页（如 SMS inbox），不是上次离开时的子页（如 `/new` compose）。对齐 AOSP 真机里"transient bridge Activity (noHistory) 在用户离开时被销毁、剩下底层 main Activity"的可见行为。

---

## 五、Back 链与 BackDispatcher

### 5.1 优先级与处理顺序

[os/BackDispatcher.ts](../../os/BackDispatcher.ts) 按 priority 降序触发，handler 返回 `true` 即消费事件。核心注册项（非完整列表）：

| priority | 注册名 | 用途 |
|---:|---|---|
| 1000 | `permission.dialog` | 权限弹窗优先（[PermissionDialog.tsx:93](../../os/components/PermissionDialog.tsx)）|
| 900 | `os.intentChooser` | Intent chooser 打开时优先消费（[OSContext.tsx:366](../../os/OSContext.tsx)）|
| 800 | `shade.dismiss` | 通知中心（[SystemShadeService.ts:50](../../os/SystemShadeService.ts)）|
| 700 | `keyboard.dismiss` | 键盘（[KeyboardService.ts:77](../../os/keyboard/KeyboardService.ts)）|
| 600 | `os.mediaPicker` | MediaService 选择器活跃时优先（[OSContext.tsx:371](../../os/OSContext.tsx)）|
| 150 | 业务页（如 `wechat.share.forward`） | 页面级覆盖（关闭弹窗、退出确认等）|
| 100 | `app.back.${appId}` | App 自定义 onBack（用 `useAppNavigationHandler` 注册）|
| 100 | `os.appBack` | OS 兜底取 active app 的 back handler |
| 50 | `os.activityBack` | OS 兜底取 active task 顶层 activity 的 back |
| 25 | `os.finishTopActivity` | task 内 stack > 1 时 pop |
| 12 | `os.returnToLauncherTask` | stack=1 + launchedByTaskId 时切回 caller（**不销毁 task**）|
| 0 | `os.goHomeFallback` | 兜底回桌面（**不销毁 task**）|

### 5.2 App-level back handler 的 active-task 闸门

[os/hooks/useAppNavigationHandler.ts](../../os/hooks/useAppNavigationHandler.ts) 注册的 App-level back handler：

```ts
// BackDispatcher 注册项 + AppNavigator.back closure 都加这个 gate
if (taskId && state.activeTaskId !== taskId) return false;
```

**为什么**：当某 App 的 Activity 被 foreign-task push 到别人 task 上时（如 12306 → SMS），同一 App 在 own-task 的实例（背景）也保留了 mounted 状态，其 back handler 也已注册。如果 active app 是 SMS（同 appId），背景 own-task 实例的 handler 会错误地消费 back（操作自己的 MemoryRouter，而不是前台的 foreign-task Activity）。

active-task gate 让背景 own-task 实例 defer，把 back 让给优先级 50 的 `os.activityBack`，由前台 foreign-task Activity 自己的 back handler 处理。对齐 AOSP "只有顶层 Activity 处理 back" 语义。

---

## 六、与 AOSP 的已知差异

| 概念 | AOSP 行为 | 本模拟器 | 决策 |
|---|---|---|---|
| `launchMode: singleTop` | 同 Activity 在栈顶时复用并触发 `onNewIntent` | 未建模 | 接受差异。低频场景（通知重复点击等）|
| `launchMode: singleInstance` | Activity 独占整个 task | 未建模 | 接受差异。存在于系统特殊场景（如 AOSP `Settings`、`Gallery2` 内部子 Activity），当前 benchmark 任务集未覆盖此类入口 |
| `Intent.FLAG_ACTIVITY_CLEAR_TOP` | caller 强制清栈到目标 Activity | 未建模 | 接受差异 |
| `Intent.FLAG_ACTIVITY_NO_HISTORY` | 启动的 Activity 不进入历史 | 未建模 | 接受差异 |
| `Intent.FLAG_ACTIVITY_MULTIPLE_TASK` | 强制创建新 task 实例 | 未建模 | 接受差异 |
| `Intent.FLAG_ACTIVITY_FORWARD_RESULT` | result 跨多跳转发 | 未建模 | 接受差异 |
| `Activity.onNewIntent` 回调通知 | 复用 Activity 时触发回调，Activity 在回调中读取并响应（AOSP `ActivityStarter.deliverNewIntent`）| App 通过 `getIntentPayload(activityId)` 在 render 时读取；OS 只更新 `activityIntent` state，无生命周期回调事件 | **部分等价**。当前路由模型下：路由切换时 page 重新挂载、读取 payload；同 route 上多次接收新 intent 时 page 不会自动刷新，需手动监听 setActivityIntent（目前无此场景）|
| `taskAffinity` 跨 App 共享 | 同 affinity 的 Activity 可入同一 task | 单 App 单 affinity（隐含为 `manifest.id`），不支持跨 App 共享 | 接受差异。架构简化 |
| `TaskStackBuilder` parent chain | 通知合成 `[grandparent, parent, target]` | 仅合成 `[/, target]`（App 主页 + 目标）| 单 Activity 模型不支持任意深度祖先链。多层级 parent 场景目前不存在 |
| `intent.route` caller 优先 | AOSP 没有 route 概念，filter 决定接收 Activity，extras 决定内部导航 | caller 可在 `intent.route` 上指定子路由 | **有意识 abstraction**。等价于 caller 塞 extras + receiver 内部导航 |
| `openApp` warm task push | TaskStackBuilder 加 `CLEAR_TASK` 重建栈 | warm 时保留用户原位置，push 目标到顶 | **有意识偏离**。比 AOSP 行为更友好（保留用户进度），代价是 back 多一步 |

---

## 七、典型场景全 trace

### 7.1 12306 → SMS 验证短信（standard launchMode + newTask）

```
1. 12306 RegisterVerifyPage 调:
   __OS__.startActivity(
     { action: 'ACTION_VIEW', scheme: 'sms', data: { address: '12306', body: '999' } },
     { newTask: true },
   )
2. IntentResolver: launchMode='standard', newTask=true, !taskExisted
   → launchApp 创建 SMS task，launchedByTaskId=12306_task
   → navigateToActivity → SMS NewMessagePage 在 /new
3. 用户填写发送 / 取消，按返回
4. SMS handleBackPress: pathname=/new, mem.index=0 → false
5. BackDispatcher 级联:
   priority 100: app.back.sms 的 active-task gate 通过（SMS 是当前 active task）→ 调 onBack → 因 location.pathname='/new' 且 mem.index=0 → false
   priority 50: os.activityBack → SMS 的 activity-level back → 同样 mem.index=0 → false
   priority 25: os.finishTopActivity → stack=1, false
   priority 12: os.returnToLauncherTask → stack=1, launchedByTaskId 存在
                → activateTask(12306) + consumeLaunchedBy(SMS_task)
6. 用户回到 12306。SMS task 留 recents，launchedByTaskId 已清
7. 用户开 recents → 点 SMS → activateTask(SMS)
8. 用户按返回 → 同 5 但 launchedByTaskId 已是 undefined
   priority 12: 无指针，false
   priority 0: os.goHomeFallback → goHome → 用户回桌面
```

### 7.2 Gallery → WeChat 分享（singleTask launchMode）

WeChat 的 ACTION_SEND image/* filter 声明 `launchMode: 'singleTask'`：

```
1. Gallery 调 startActivity(ACTION_SEND image/*, { newTask: true })
2. IntentResolver: launchMode='singleTask', auto-promote 已是 newTask=true
   分两种情况:

   a) WeChat 未运行：
      launchApp 创建 wechat task, root Activity 历史从 ['/'] push 到 ['/', '/share/forward']
   b) WeChat 已在后台：
      singleTask 复用分支：popActivity 清掉 root 之上的 Activity → setActivityIntent 把 share intent 投到 root
      → launchApp 切前台 → rAF: popToRoot('/') + navigate('/share/forward', {replace:false})
      → 历史变为 ['/', '/share/forward']

3. 用户在 ShareForwardPage 选联系人 + 发送 → handleSend 调
   go('share.forward.send.toChat', { id: target.wxid })  // mode='replace'
   → 历史变为 ['/', '/chat/:wxid']

4. 用户从 /chat 按返回 → / (wechat 主页)
5. 从 / 按返回 → returnToLauncherTask → activateTask(gallery) + consume(wechat)
6. WeChat task 留 recents，可从 recents 重新进入
```

### 7.3 Bilibili → WeChat 支付（standard launchMode）

```
1. Bilibili VipPage 调 startActivity(ACTION_PAY scheme=weixin, { newTask: true })
2. IntentResolver: launchMode='standard', newTask=true, !taskExisted
   → launchApp 创建 wechat task with launchedByTaskId=bilibili
   → navigateToActivity 'pay/confirmation' replace=true → 历史 ['/pay/confirmation']

3. 用户付款/取消 → PaymentConfirmationPage 调 __OS__.finishActivity()
4. finishActivity: stack=1, launchedByTaskId 存在
   → activate(bilibili) + consume(wechat)
   → wechat task 留 recents（之前先 navigate 到 / 重置 router，所以 recents 显示 wechat 主页）
```

### 7.4 Settings → FileManager 查看分类（standard, same-task push）

```
1. StorageDashboardPage 调 startActivity:
   { action: 'ACTION_VIEW', type: 'inode/directory', route: '/category/images' }
   不传 newTask
2. IntentResolver: launchMode='standard', newTask=false
   → same-task push: 在 settings task 上 push FileManager Activity
   → navigateToActivity '/category/images' (intent.route 优先于 filter '/')
3. settings task stack = [SettingsActivity, FileManagerActivity]，FM Activity 的 MemoryRouter 直接落到
   '/category/images'（replace 模式，index=0）
4. 用户浏览完按返回:
   priority 100: FM 自身 app.back / os.appBack → handleBack 看到 mem.index=0 → false
   priority 50: os.activityBack → 同样 false
   priority 25: os.finishTopActivity → settings task stack > 1，pop 顶层 FM Activity → true
5. 用户回到 SettingsActivity（在 settings task）
6. FileManager task 不存在（始终在 settings task 借栈），无残留
```

### 7.5 通知点击（PendingIntent）

```
1. 通知触发: __OS__.openApp('wechat', '/chat/:wxid')
2. openApp 永远 push:
   a) wechat 未运行：新建 task，root Activity 历史 ['/'] push '/chat/:wxid' → ['/', '/chat/:wxid']
   b) wechat 已在后台：保留用户当前位置，push '/chat/:wxid' 到顶（历史 [..., currentRoute, '/chat/:wxid']）
3. 用户从 chat 按返回 → 上一条历史（a 是 /, b 是用户原页面）
4. 再返回（已落到 wechat 根页 / 或 case b 的原页面，mem.index=0 时 App back 返回 false）：
   - 有 launchedByTaskId（如用户从其它 App 内点了通知）→ os.returnToLauncherTask 激活 caller task + consume 指针
   - 无 launchedByTaskId（如从桌面/锁屏点通知）→ os.goHomeFallback → goHome 回桌面
5. wechat task 始终保留在 recents（不 closeTask），用户可从 recents 重新进入
```

---

## 八、关键文件索引

| 关注点 | 文件 |
|---|---|
| `AppIntentFilter` / `IntentPayload` 类型 | [os/types/manifest.ts](../../os/types/manifest.ts) |
| Intent 解析与启动 | [os/IntentResolver.ts](../../os/IntentResolver.ts) |
| OS 主控 (`finishActivity` / BackDispatcher / `openApp`) | [os/OSContext.tsx](../../os/OSContext.tsx) |
| Task / Activity 状态机 | [os/TaskManager.ts](../../os/TaskManager.ts) |
| AppNavigator 接口 | [os/AppNavigatorRegistry.ts](../../os/AppNavigatorRegistry.ts) |
| App 端导航集成 hook | [os/hooks/useAppNavigationHandler.ts](../../os/hooks/useAppNavigationHandler.ts) |
| MemoryRouter 历史工具 | [os/utils/memoryHistoryPopTo.ts](../../os/utils/memoryHistoryPopTo.ts), [memoryHistoryTracker.ts](../../os/utils/memoryHistoryTracker.ts) |

---

## 九、AOSP 参考路径（本机本地）

> 仅本机参考，不进版本控制。

| AOSP 路径 | 用途 |
|---|---|
| `/Users/purew/aosp-ref/frameworks-base-java/services/core/java/com/android/server/wm/ActivityStarter.java` | Activity 启动核心：launchMode、CLEAR_TOP、taskAffinity |
| `/Users/purew/aosp-ref/frameworks-base-java/services/core/java/com/android/server/wm/Task.java` | task 增删改查、`removeTask` 行为 |
| `/Users/purew/aosp-ref/frameworks-base-java/services/core/java/com/android/server/wm/ActivityRecord.java` | Activity 记录 |
| `/Users/purew/aosp-ref/frameworks-base-java/core/java/android/app/Activity.java` | `finish()` / `finishAndRemoveTask()` / `onNewIntent` |
| `/Users/purew/aosp-ref/frameworks-base-java/core/java/android/app/TaskStackBuilder.java` | 通知合成栈 |
| `/Users/purew/aosp-ref/frameworks-base-java/core/java/android/content/Intent.java` | Intent flags 常量 |
| `/Users/purew/aosp-ref/apps/Messaging/AndroidManifest.xml` | 系统 SMS App 的 launchMode/noHistory 声明 |
| `/Users/purew/aosp-ref/apps/Settings/AndroidManifest.xml` | Settings 各子页 launchMode + taskAffinity 声明 |

---

## 十、文档维护

修改本文档时同步关注：
- 新增 `launchMode` 模式（如未来支持 `singleTop`）→ 更新 §2.2 与 §六
- 新增 caller flag → 更新 §3 与 §六
- finishActivity / BackDispatcher 行为变更 → 更新 §四、§五、§七
- 新增已知差异 → 更新 §六

涉及 IntentResolver / OSContext.finishActivity / BackDispatcher 链的改动，建议先回到 AOSP 源码查对，再决定修改方向。
