# P1 — 架构重构方案

> 优先级：**P1（发布质量）**
> 预计工作量：2 人 × 2 周
> 涉及文件：`os/OSContext.tsx`、`os/SystemShell.tsx`、`os/types/`、`tsconfig.json`

---

## 1. `window.__OS__` Stable Proxy 重构

### 1.1 现状问题

当前 `window.__OS__` 在 `OSContext.tsx` 的 `useEffect` 中随每次 state 变更而重建整个对象：

```typescript
// 当前实现（os/OSContext.tsx:360-441）
useEffect(() => {
  window.__OS__ = {
    state: osStateForApi,           // 快照值，可能过期
    getState: () => ({...}),        // 闭包捕获 TaskManager
    launchApp,                      // useCallback 引用
    // ... 40+ 属性
  } as any;                         // 绕过类型检查
}, [osStateForApi, launchApp, ...]);  // 12 个依赖
```

问题：
1. 外部代码持有 `const os = window.__OS__` 后，引用可能随时过期
2. `window.__OS__.state` 在 effect 执行前是过期值
3. 每次 Task 操作都触发完整对象重建（不必要的开销）
4. `as any` 绕过了类型检查

### 1.2 重构方案：Stable Object + Getter

核心思路：`window.__OS__` 只创建一次（在 module scope），方法内部始终通过 `getLatest()` 获取最新状态。

#### Step 1：创建 `os/OSApiProxy.ts`

```typescript
import type { OSApi } from './types/globals';

type OSApiSetter = (api: Omit<OSApi, 'state' | 'getState'>) => void;

let _impl: Omit<OSApi, 'state' | 'getState'> | null = null;
let _getState: (() => OSApi['state']) | null = null;

function ensureReady<T>(fn: (() => T) | null, name: string): T {
  if (!fn) throw new Error(`[__OS__] Not initialized yet. Accessing ${name} too early.`);
  return fn();
}

const proxy: OSApi = {
  get state() {
    return ensureReady(_getState, 'state');
  },
  getState() {
    return ensureReady(_getState, 'getState');
  },

  // 所有方法委托到 _impl
  launchApp(id) { _impl!.launchApp(id); },
  launchTaskById(taskId) { _impl!.launchTaskById(taskId); },
  goHome() { _impl!.goHome(); },
  showRecents() { _impl!.showRecents(); },
  closeTask(taskId) { _impl!.closeTask(taskId); },
  closeApp(id) { _impl!.closeApp(id); },
  handleBack() { _impl!.handleBack(); },
  openApp(appId, initialRoute) { _impl!.openApp(appId, initialRoute); },
  startActivityForResult(a, b, c) { return _impl!.startActivityForResult(a, b, c); },
  setResult(result) { _impl!.setResult(result); },
  hasActiveIntent() { return _impl!.hasActiveIntent(); },
  getIntentPayload(appId) { return _impl!.getIntentPayload(appId); },
  resolveActivity(intent) { return _impl!.resolveActivity(intent); },
  getAppRoute(appId) { return _impl!.getAppRoute(appId); },
  setBrightness(v) { _impl!.setBrightness(v); },
  setVolume(v) { _impl!.setVolume(v); },
  getSkin() { return _impl!.getSkin(); },
  setSkin(id) { _impl!.setSkin(id); },

  // 子服务直接引用（它们本身就是 stable 单例）
  get notifications() { return _impl!.notifications; },
  get permissions() { return _impl!.permissions; },
  get clipboard() { return _impl!.clipboard; },
  get statusBar() { return _impl!.statusBar; },
  get keyboard() { return _impl!.keyboard; },
  get quickSettings() { return _impl!.quickSettings; },
  get shade() { return _impl!.shade; },
  get locale() { return _impl!.locale; },
  get device() { return _impl!.device; },
  get broadcast() { return _impl!.broadcast; },
  get content() { return _impl!.content; },
  get pendingIntent() { return _impl!.pendingIntent; },
  get sms() { return _impl!.sms; },
};

// 只创建一次
if (!window.__OS__) {
  window.__OS__ = proxy;
}

export function setOSApiImpl(
  impl: Omit<OSApi, 'state' | 'getState'>,
  getState: () => OSApi['state'],
): void {
  _impl = impl;
  _getState = getState;
}
```

#### Step 2：修改 `OSContext.tsx`

```typescript
import { setOSApiImpl } from './OSApiProxy';

// 在 OSProvider 组件中，替换原来的 useEffect：
useEffect(() => {
  setOSApiImpl(
    {
      launchApp,
      launchTaskById,
      goHome,
      showRecents,
      closeTask,
      closeApp,
      handleBack: handleSystemBack,
      openApp,
      // ... 其余方法
      notifications: NotificationService,
      permissions: PermissionService,
      // ... 子服务（都是 stable 引用）
    },
    // getState 始终返回最新快照
    () => ({
      ...TaskManager.getState(),
      activeAppId: getActiveAppId(TaskManager.getState()),
    }),
  );
}, [launchApp, goHome, /* ... 只需要 callback 依赖，不需要 state */]);
```

#### Step 3：优势

- `window.__OS__` 引用永不变化，外部代码可安全缓存
- `state` 是 getter，始终返回最新值
- 子服务（NotificationService 等）本身就是 stable 单例，不需要重建
- 移除了 `as any`

#### 迁移风险

- 需确认所有外部消费者（bench_env agent、AgentBridge）不依赖 `window.__OS__` 引用变化
- `__SIM__` 也应用相同模式

---

## 2. `window.__SIM__` 同步重构

同样创建 `os/SimApiProxy.ts`，确保 `__SIM__` 也是 stable 引用：

```typescript
let _simImpl: SimApi | null = null;

const simProxy: SimApi = {
  reset(seed) { _simImpl!.reset(seed); },
  waitForData(appIds) { return _simImpl!.waitForData(appIds); },
  getState() { return _simImpl!.getState(); },
  setState(patch, options) { _simImpl!.setState(patch, options); },
};

if (!window.__SIM__) {
  window.__SIM__ = simProxy;
}

export function setSimApiImpl(impl: SimApi): void {
  _simImpl = impl;
}
```

---

## 3. SystemShell 组件拆分

### 3.1 现状

`SystemShell.tsx` 约 1000 行，混合了：
- 桌面 Launcher 渲染
- 状态栏管理
- 底部手势栏
- Activity 容器管理
- Recents 视图
- 系统 Shade（通知栏）
- 键盘覆盖层
- 设备效果（闪屏等）
- 手势区域（边缘滑动）

### 3.2 目标架构

```
SystemShell.tsx (瘦容器，~150 行)
├── StatusBarHost.tsx           - 状态栏渲染和管理
├── GestureBarHost.tsx          - 底部手势栏（Home 键/返回手势）
├── EdgeGestureLayer.tsx        - 边缘手势区域（左/右滑返回）
├── ActivityStack.tsx           - Activity 容器栈管理
│   └── ActivityContainer.tsx   - 单个 Activity 容器（包含 ErrorBoundary）
├── LauncherHost.tsx            - 桌面 Launcher 渲染
├── RecentsView.tsx             - 最近任务视图
├── OverlayStack.tsx            - 浮层管理
│   ├── SystemShadeHost.tsx     - 通知栏/快速设置
│   ├── KeyboardOverlayHost.tsx - 键盘覆盖层
│   ├── PermissionDialogHost.tsx
│   └── DeviceEffectsHost.tsx
└── hooks/
    ├── useActivityRendering.ts - Activity 渲染逻辑
    ├── useRecentsGesture.ts    - Recents 手势处理
    └── useSystemGestures.ts    - 系统级手势
```

### 3.3 拆分步骤

#### Phase 1：提取 hooks（最小风险）

1. 将 `SystemShell.tsx` 中的手势处理逻辑（swipe detection, gesture state）提取到 `useSystemGestures.ts`
2. 将 Activity 容器渲染逻辑提取到 `useActivityRendering.ts`
3. 将 Recents 相关逻辑提取到 `useRecentsGesture.ts`

#### Phase 2：提取子组件

1. `StatusBarHost`：状态栏 JSX + 事件监听
2. `GestureBarHost`：底部手势栏 JSX + 手势处理
3. `RecentsView`：Recents JSX + 动画
4. `OverlayStack`：所有浮层组件的容器

#### Phase 3：ActivityStack 提取

1. 将 Activity 容器管理（display:none 切换、z-index 管理、transition）提取到 `ActivityStack`
2. `SystemShell` 只负责组合这些子组件

### 3.4 关键注意事项

- 拆分过程中**不改变任何功能**，纯粹的结构重构
- 每个子组件通过 props 或 Context 获取所需状态
- 手势处理中的 `ref` 需要正确传递（可能需要 `forwardRef`）
- Recents 的 swipe 动画与 Activity 容器紧密耦合，需仔细处理

---

## 4. TypeScript 严格模式渐进启用

### 4.1 现状

`tsconfig.json` 只启用了部分严格选项：

```json
{
  "noImplicitThis": true,
  "noFallthroughCasesInSwitch": true,
  "useUnknownInCatchVariables": true
}
```

缺少：`strict`、`strictNullChecks`、`strictFunctionTypes`、`strictBindCallApply`、`strictPropertyInitialization`、`noImplicitAny`、`noImplicitReturns`

### 4.2 渐进启用路线

#### Phase 1（与 P1 同步）— 低风险选项

```json
{
  "noImplicitReturns": true,
  "strictBindCallApply": true,
  "forceConsistentCasingInImports": true,
  "noUncheckedIndexedAccess": false   // 暂不启用，影响太大
}
```

#### Phase 2 — `strictNullChecks`

这是价值最高的选项，但影响也最大。建议：

1. 创建 `tsconfig.strict.json` 继承自 `tsconfig.json`：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strictNullChecks": true
  },
  "include": [
    "os/ServiceRegistry.ts",
    "os/BackDispatcher.ts",
    "os/BroadcastBus.ts",
    "os/createSystemService.ts",
    "os/TaskManager.ts"
  ]
}
```

2. 逐模块启用，修复 null 检查错误
3. 当核心 OS 模块全部通过后，合并到主 `tsconfig.json`

#### Phase 3 — 完全 strict

```json
{
  "strict": true
}
```

### 4.3 消除 `as any` 清单

以下位置需要修复：

| 文件 | 位置 | 问题 | 修复方案 |
|------|------|------|---------|
| `OSContext.tsx:426` | `window.__OS__ = {...} as any` | 绕过类型 | Stable Proxy 方案解决 |
| `createSystemService.ts:94` | `{...(state as any), ...(patch as any)}` | 泛型约束不足 | 添加 `S extends Record<string, unknown>` 约束 |
| `simInput.ts` | 多处 `(p as any)` | 坐标类型不严格 | 定义 `Point` 接口 |
| `IntentResolver.ts` | callback 类型 | 重载导致类型复杂 | 重构为 options 对象模式 |

---

## 5. IntentResolver 接口重构

### 5.1 现状

```typescript
startActivityForResult(
  appIdOrIntent: AppId | string | IntentPayload,
  intentOrCallback?: IntentPayload | ((result: ActivityResult) => void),
  callbackOrUndefined?: (result: ActivityResult) => void,
): boolean;
```

三个参数的含义取决于第一个参数的类型，可读性极差。

### 5.2 重构方案

```typescript
// 新接口定义
interface StartActivityExplicitOptions {
  target: AppId | string;
  intent: IntentPayload;
  onResult: (result: ActivityResult) => void;
}

interface StartActivityImplicitOptions {
  intent: IntentPayload;
  onResult: (result: ActivityResult) => void;
}

type StartActivityOptions = StartActivityExplicitOptions | StartActivityImplicitOptions;

// 新方法签名
startActivityForResult(options: StartActivityOptions): boolean;

// 向后兼容：保留旧签名但标记 @deprecated
/** @deprecated Use startActivityForResult(options) instead */
startActivityForResult(
  appIdOrIntent: AppId | string | IntentPayload,
  intentOrCallback?: IntentPayload | ((result: ActivityResult) => void),
  callbackOrUndefined?: (result: ActivityResult) => void,
): boolean;
```

### 5.3 迁移步骤

1. 内部实现支持新旧两种调用方式（通过参数类型检测）
2. 全局搜索所有 `startActivityForResult` 调用，逐步迁移到 options 风格
3. 一个 minor 版本后移除旧签名

---

## 6. App LRU 缓存策略

### 6.1 现状

所有曾经打开过的 App 都通过 `display:none` 保持挂载，可能导致 26 个 App 同时在 DOM 中。

### 6.2 方案

```typescript
// os/hooks/useActivityRendering.ts

const MAX_MOUNTED_APPS = 5; // 最多同时挂载 5 个 App

function useMountedApps(tasks: Task[], activeTaskId: string | null): Set<string> {
  const [mountedSet, setMountedSet] = useState<Set<string>>(new Set());
  const lruRef = useRef<string[]>([]);

  useEffect(() => {
    const activeAppId = /* 从 activeTaskId 推断 */;
    if (!activeAppId) return;

    // 更新 LRU：将 active 移到头部
    const lru = lruRef.current.filter(id => id !== activeAppId);
    lru.unshift(activeAppId);

    // 超出上限时，卸载最久未使用的
    if (lru.length > MAX_MOUNTED_APPS) {
      lru.length = MAX_MOUNTED_APPS;
    }
    lruRef.current = lru;

    setMountedSet(new Set(lru));
  }, [activeTaskId, tasks]);

  return mountedSet;
}
```

### 6.3 状态保留策略

被卸载的 App 的状态通过 Zustand store（持久化到 localStorage）自动保留。重新打开时：
1. React 组件重新挂载
2. Zustand store 从 localStorage 恢复
3. `useAppNavigationHandler` 重新注册

### 6.4 配置化

```typescript
// os/data/osConfig.ts
export const OS_CONFIG = {
  maxMountedApps: 5,       // 默认同时挂载 5 个
  alwaysMountedApps: [],   // 始终挂载的 App（如 Launcher）
};
```

---

## 7. 模块导入副作用治理

### 7.1 现状

`index.tsx` 中通过 eager glob 触发 store 注册：

```typescript
import.meta.glob('./apps/*/state.ts', { eager: true });
```

这是隐式副作用，无法控制执行顺序。

### 7.2 方案

改为显式注册：

```typescript
// index.tsx
const storeModules = import.meta.glob('./apps/*/state.ts', { eager: true });
registerAppStores(storeModules);

// os/createAppStore.ts
export function registerAppStores(
  modules: Record<string, unknown>,
): void {
  for (const [path, mod] of Object.entries(modules)) {
    const appDir = path.match(/\.\/apps\/([^/]+)\//)?.[1];
    if (appDir && mod && typeof mod === 'object') {
      // store 在 module scope 中已创建，这里只是确保注册
      console.debug(`[AppStore] Registered store from ${appDir}`);
    }
  }
}
```

同样处理 `OSContext.tsx` 中的两个 eager import：

```typescript
// 当前：隐式副作用
import '../apps/Contacts/state';
import '../apps/Gallery/state';

// 改为：在适当位置显式调用
// 或通过 glob 统一处理，不需要硬编码特定 App
```

---

## 检查清单

- [ ] 创建 `os/OSApiProxy.ts`，实现 stable proxy 模式
- [ ] 修改 `OSContext.tsx`，使用 `setOSApiImpl()`
- [ ] 创建 `os/SimApiProxy.ts`，同步重构 `__SIM__`
- [ ] 验证 bench_env agent 在新 proxy 下正常工作
- [ ] SystemShell hooks 提取（Phase 1）
- [ ] SystemShell 子组件拆分（Phase 2）
- [ ] ActivityStack 提取（Phase 3）
- [ ] `tsconfig.json` Phase 1 严格选项启用
- [ ] 创建 `tsconfig.strict.json` 用于渐进式 strictNullChecks
- [ ] 消除核心模块中的 `as any`
- [ ] IntentResolver 接口重构为 options 风格
- [ ] App LRU 缓存策略实现
- [ ] 隐式副作用导入改为显式注册
