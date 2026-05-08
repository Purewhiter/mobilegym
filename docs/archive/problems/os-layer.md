# OS 层问题

## 1. 架构问题

### 1.1 跨层依赖 [高]

**问题**: OSContext.tsx 直接导入具体 app 的 state 模块，违反"新增 App 无需修改 OS 层"原则。

**位置**: `os/OSContext.tsx:34-35`
```typescript
import '../apps/Contacts/state';
import '../apps/Gallery/state';
```

**影响**: OS 层依赖特定 app，若这些 state 模块变更会影响 OS。

---

### 1.2 God Component [中]

**问题**: OSContext.tsx 643 行，混合了：
- TaskManager 状态订阅
- IntentResolver 订阅
- App 生命周期发射
- 导航到 Activity 逻辑
- startActivityForResult / setResult / finishTopActivity
- 所有 OS API 注册（window.__OS__, window.__SIM__）

**位置**: `os/OSContext.tsx`

**建议**: 拆分为 TaskManagerProvider, LifecycleEmitter, OSApiRegistry 等。

---

### 1.3 运行时循环依赖 [高]

**问题**: DeviceService 通过 `window.__OS__` 回调 OSContext，若在 OSContext 挂载前调用会静默失败。

**位置**: `os/DeviceService.ts:744-748`
```typescript
const callOS = (method: 'setBrightness' | 'setVolume', v: number) => {
  const os = window.__OS__;
  if (!os || typeof os[method] !== 'function') return;
  os[method](v);
};
```

**同样模式出现在**:
- `os/PendingIntent.ts:65`
- `os/ContentResolver.ts:41`
- `os/SystemShade.tsx:375`
- `os/HeadsUpNotification.tsx:122`
- `os/AppNavigatorRegistry.ts:49`
- `os/simInput.ts:685,694`

---

### 1.4 window.__OS__.state 过期 [中]

**问题**: `window.__OS__.state` 在 useEffect 中赋值，状态变化后到下次 effect 刷新前返回旧值。

**位置**: `os/OSContext.tsx:360-441`

**对比**: `window.__OS__.getState()` 调用 `TaskManager.getState()` 始终返回最新值。

**影响**: Agent 在状态转换后立即读取 `window.__OS__.state` 可能得到旧值。

---

### 1.5 SystemShell.tsx 过大 [中]

**问题**: 1312 行单文件，包含：
- StatusBar (含 DOM walking 检测逻辑)
- GestureBar
- EdgeGestures
- RecentsBlur
- RecentsChrome
- SystemShell
- computeActivityContainerStyle 等辅助函数

**位置**: `os/SystemShell.tsx`

**建议**: 拆分为独立组件文件。

---

## 2. 设计反模式

### 2.1 BackDispatcher 用 Map 而非栈 [中]

**问题**: 同 id 注册会静默覆盖，两个组件用同一 id 时第二个替换第一个。

**位置**: `os/BackDispatcher.ts:7`
```typescript
const handlers = new Map<string, BackHandler>();
```

**建议**: 改为 priority-ordered list per id，匹配 Android addCallback 语义。

---

### 2.2 doubleTapStates 模块作用域共享 [中]

**问题**: Map 在模块作用域，多组件用同一 id 会共享状态导致 tap 碰撞。

**位置**: `os/hooks/useTriggerGestures.ts:68`
```typescript
const doubleTapStates = new Map<string, DoubleTapState>();
```

---

### 2.3 bindLongPress 渲染时 mutation [低]

**问题**: 在渲染期间向 `longPressStatesRef.current` 添加 key，若 id 变化旧 key 保留直到卸载。

**位置**: `os/hooks/useTriggerGestures.ts:226-234`

---

### 2.4 DOM walking + MutationObserver 检测状态栏颜色 [中]

**问题**: 每次 DOM 变化触发 `getComputedStyle`，强制样式重计算。

**位置**: `os/SystemShell.tsx:432-540`

**建议**: 仅依赖声明式 `data-status-bar-foreground` 属性，移除 DOM walking fallback。

---

### 2.5 重复检测逻辑 [低]

**问题**: GestureBar 和 StatusBar 各自实现独立的 DOM 属性检测 + MutationObserver。

**位置**: `os/SystemShell.tsx:808-880`

**建议**: 集中到 StatusBarService。

---

### 2.6 AppStateRegistry 已退化 [低]

**问题**: 文件仅 18 行，是 `getAllStoreStates()` 的 facade，但 CLAUDE.md 文档描述过时。

**位置**: `os/AppStateRegistry.ts`

---

## 3. 内存泄漏风险

### 3.1 BroadcastBus receiver 未清理 [高]

**问题**: 未调用 unsubscribe 的 receiver 永久存在，ACTION_TIME_TICK 每分钟触发。

**位置**: `os/BroadcastBus.ts:89-91`
```typescript
for (const item of snapshot) {
  Promise.resolve().then(() => safeInvoke(item.receiver, cloned));
}
```

---

### 3.2 AppNavigatorRegistry 按 appId 注册 [高]

**问题**: 同 app 多任务时后者覆盖前者，导航只能到达第二个实例。

**位置**: `os/AppNavigatorRegistry.ts:30-33`

---

### 3.3 TaskManager.reset() 不完整 [中]

**问题**: 不重置 pendingCallbacks, requestCode, taskSeq, activitySeq, mruCounter。

**位置**: `os/TaskManager.ts:198-206, 302`

**影响**: 跨 reset ID 不确定，影响 benchmark 可复现性。

---

### 3.4 DeviceService 模块加载时副作用 [低]

**问题**: 模块导入时立即执行 `DeviceService.init()`，订阅其他服务。

**位置**: `os/DeviceService.ts:1303-1305`

---

## 4. 性能瓶颈

### 4.1 allActivities 每次状态变化重计算 [中]

**问题**: `state.tasks` 每次 dispatch 变化引用，所有 activity 容器重新计算样式。

**位置**: `os/SystemShell.tsx:1210-1217`
```typescript
const allActivities = useMemo(() => (
  state.tasks.flatMap(task => task.stack.map(...))
), [state.tasks]);
```

---

### 4.2 window.__OS__ 每次状态变化重建 [中]

**问题**: useEffect 依赖 osStateForApi，每次状态变化重构整个 API 对象。

**位置**: `os/OSContext.tsx:360-441`

---

## 5. 错误处理缺陷

### 5.1 navigateToActivity 超时无回滚 [中]

**问题**: 导航超时后 activity 在 task stack 但路由不正确，无恢复机制。

**位置**: `os/OSContext.tsx:130-157`

---

### 5.2 localStorage 满时静默丢弃 [中]

**问题**: QuotaExceededError 被静默 catch，下次加载丢失状态。

**位置**: `os/createAppStore.ts:28-29`

---

### 5.3 startActivityForResult callback 非空断言 [低]

**问题**: `callback!` 断言可能为 undefined，运行时 check 兜底但类型不安全。

**位置**: `os/IntentResolver.ts:186-191`

---

## 6. 类型安全

### 6.1 AppId 是 string 别名 [低]

**问题**: `AppId = string` 无品牌类型保护，任意字符串可传入。

**位置**: `os/types.ts:6`

---

### 6.2 window.__OS__ 用 as any 赋值 [中]

**问题**: 绕过 OSApi 类型检查，实现与声明不匹配不会报错。

**位置**: `os/OSContext.tsx:426`

---

### 6.3 setState 绕过 Zustand middleware [中]

**问题**: `store.setState(appPatch as any)` 绕过 persist middleware。

**位置**: `os/OSContext.tsx:559-606`

---

## 7. 与真实 Android 差距

| 缺失/差异 | 说明 |
|-----------|------|
| 无进程/线程模型 | 所有代码单线程，无 Binder IPC |
| LocationService.watchPosition 模拟模式只触发一次 | `os/LocationService.ts:285-289` |
| Activity back-stack 语义缺失 | OS 只跟踪跨 app push，app 内导航不透明 |
| Launcher 每次切换重新挂载 | `os/SystemShell.tsx:1240-1242` |
| 权限请求不校验 manifest 声明 | `os/PermissionService.ts` |
| Intent data 无结构化 URI | `os/types/manifest.ts:113` |
| BroadcastReceiver 无生命周期绑定 | 需手动清理 |
| PendingIntent 自编码 token | `os/PendingIntent.ts:11-20` |
| 无 AudioManager | 音量只改数字 |
| BroadcastBus 语义反转 | sendBroadcast 用 microtask，ordered 同步 |
