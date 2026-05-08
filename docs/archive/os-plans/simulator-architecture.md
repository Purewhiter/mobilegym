# Android GUI Agent 模拟器：完整架构设计方案

> React + TypeScript + Vite + Tailwind CSS  
> 版本：1.0 | 适用于 benchmark 框架对接

---

## 一、整体架构图

```
╔══════════════════════════════════════════════════════════════════════╗
║                    BENCHMARK INTERFACE LAYER                         ║
║  window.__Simulator.reset() / getState() / setState() / dispatch()   ║
╠══════════════════════════════════════════════════════════════════════╣
║                      SYSTEM SHELL LAYER                              ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   ║
║  │  StatusBar   │  │  HomeScreen  │  │  NavigationBar (Back/Home)│   ║
║  └──────────────┘  └──────────────┘  └──────────────────────────┘   ║
║  ┌──────────────────────────────────────────────────────────────┐    ║
║  │  NotificationPanel  │  QuickSettings  │  LockScreen          │    ║
║  └──────────────────────────────────────────────────────────────┘    ║
╠══════════════════════════════════════════════════════════════════════╣
║                       APP RUNTIME LAYER                              ║
║  ActivityStack: [app_n | ... | app_2 | app_1(foreground)]            ║
║  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    ║
║  │  WeChat  │  │  Alipay  │  │ Settings │  │     Contacts     │    ║
║  │ (hidden) │  │ (hidden) │  │  (top-2) │  │   (foreground)   │    ║
║  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    ║
╠══════════════════════════════════════════════════════════════════════╣
║                     SYSTEM SERVICES LAYER                            ║
║  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐   ║
║  │  WiFi  │ │Battery │ │  Clock   │ │  Notif.  │ │ Clipboard  │   ║
║  └────────┘ └────────┘ └──────────┘ └──────────┘ └────────────┘   ║
║  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐                  ║
║  │  GPS   │ │ Phone  │ │Keyboard  │ │  Intent  │                  ║
║  └────────┘ └────────┘ └──────────┘ └──────────┘                  ║
╠══════════════════════════════════════════════════════════════════════╣
║                      STATE MANAGEMENT LAYER                          ║
║  ┌─────────────────────┐  ┌──────────────────────────────────────┐  ║
║  │   SystemStore        │  │   AppStore (per-app Zustand slices)  │  ║
║  │ (Zustand + immer)    │  │   wechat/ alipay/ settings/ ...      │  ║
║  └─────────────────────┘  └──────────────────────────────────────┘  ║
║  ┌─────────────────────────────────────────────────────────────────┐ ║
║  │   AppRegistry  (manifest map, lifecycle, back-handler stack)    │ ║
║  └─────────────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════╣
║                      PERSISTENCE LAYER                               ║
║  localStorage  (key: "sim:system", "sim:app:wechat", ...)            ║
║  Single serialize/deserialize entry point                            ║
╚══════════════════════════════════════════════════════════════════════╝
```

**数据流向**（单向）：

```
Benchmark API ──write──→ StateLayer ──read──→ React Components ──render──→ Screenshot
                                     ↑
                              SystemServices (clock, network...)
```

---

## 二、逐题设计方案

---

### Q1：分层设计

**方案：三层分离 + 明确边界协议**

```
System Shell      负责：状态栏渲染、桌面、通知面板、导航栏、锁屏
                  不负责：任何 App 内部逻辑

App Runtime       负责：Activity 栈管理、App 生命周期、跨 App 通信
                  不负责：具体 App 内的 UI 和状态

Individual Apps   负责：自己的 UI、路由、状态
                  不负责：自己的显示/隐藏（由 Runtime 决定）
```

**边界规则**：

- System → App：通过 `AppLifecycleEvent`（launch/pause/resume/destroy）通知
- App → System：通过 `SystemService` hooks（发通知、申请权限、共享内容）
- App ← → App：通过 `IntentService`（见 Q5）

**关键设计**：系统层完全不 import 具体 App 组件，只知道 `AppManifest` 接口。App 通过自注册机制让系统知道它的存在（见 Q3）。

**权衡的替代方案**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| 大型单一组件树 | 简单 | 新增 App 需改系统代码 |
| 微前端（Module Federation） | 真正隔离 | Vite 集成复杂，bundle 大 |
| **本方案：manifest + 动态注册** | 轻量、类型安全 | 需要约定规范 |

---

### Q2：App 生命周期

**方案：CSS visibility 隐藏 + 有限深度卸载策略**

```typescript
// ActivityStack 中每个 entry 的状态
type ActivityState = 'foreground' | 'background' | 'destroyed'

// 渲染策略
function AppContainer({ entry }: { entry: ActivityEntry }) {
  if (entry.state === 'destroyed') return null  // 卸载

  return (
    <div
      style={{
        display: entry.state === 'foreground' ? 'block' : 'none',
        // 关键：position absolute 叠层，不影响布局
        position: 'absolute', inset: 0,
      }}
      aria-hidden={entry.state !== 'foreground'}
    >
      <entry.manifest.component />
    </div>
  )
}
```

**策略**：

- **栈顶 3 层**：保持 mounted + CSS hidden（保留 scroll 位置、表单输入、动画状态）
- **栈深 > 3**：卸载（内存敏感，状态已持久化到 Store）
- **destroyed**：卸载且从栈中移除

**Trade-off 对比**：

| | 始终保持 mounted | 始终卸载/重挂 | **本方案（混合）** |
|-|---------|---------|---------|
| 内存 | 差（20+ App 全挂） | 优 | 良（只保活顶层） |
| 状态保留 | 自然 | 需序列化 | 顶层自然，深层走 Store |
| 截图干净度 | 差（多层叠加） | 优 | 优（display:none 不渲染） |
| 动画流畅度 | 优 | 有闪烁 | 良 |

---

### Q3：App 注册与发现

**方案：Vite `import.meta.glob` 自动扫描 + Manifest 协议**

每个 App 在自己目录的根部创建 `manifest.ts`：

```typescript
// src/apps/third-party/wechat/manifest.ts
import { AppManifest } from '@/types/app'
import WeChatApp from './WeChatApp'
import wechatIcon from './assets/icon.png'

export default {
  id: 'com.tencent.mm',
  name: '微信',
  icon: wechatIcon,
  component: WeChatApp,
  category: 'third-party',
  // 用于 benchmark reset
  defaultState: () => import('./fixtures/defaultState'),
  // 用于 benchmark getState
  getState: () => wechatStore.getState().serialize(),
  // 声明式导航图（Q11）
  navigationGraph: () => import('./navigationGraph'),
} satisfies AppManifest
```

自动注册（零手工维护）：

```typescript
// src/apps/registry.ts
const manifests = import.meta.glob('./*/manifest.ts', { eager: true })
const thirdParty = import.meta.glob('./third-party/*/manifest.ts', { eager: true })

export const appRegistry = new AppRegistry([
  ...Object.values(manifests),
  ...Object.values(thirdParty),
].map(m => m.default))
```

新增 App：只需创建目录并导出 `manifest.ts`，零改动系统代码。

---

### Q4：返回键分发机制

**方案：优先级栈（Back Handler Stack）**

```typescript
// src/system/services/BackHandlerService.ts
type BackHandler = {
  id: string
  priority: number       // 数字越大越优先处理
  handler: () => boolean // 返回 true 表示已消费，不再往下传
}

class BackHandlerService {
  private stack: BackHandler[] = []

  register(handler: BackHandler) {
    this.stack.push(handler)
    this.stack.sort((a, b) => b.priority - a.priority)
    return () => this.unregister(handler.id)  // 返回解注册函数
  }

  dispatch(): void {
    for (const h of this.stack) {
      if (h.handler()) return  // 被消费，停止
    }
    // 默认：退回桌面
    activityStack.popToHome()
  }
}

// 使用示例（弹窗组件）
function AlertDialog({ onClose }) {
  useBackHandler({
    id: 'alert-dialog',
    priority: 100,  // 弹窗优先级最高
    handler: () => { onClose(); return true }
  }, [onClose])
}

// 使用示例（App 内路由）
function AppRouter() {
  const { canGoBack, goBack } = useAppRouter()
  useBackHandler({
    id: 'app-router',
    priority: 50,
    handler: () => { if (canGoBack) { goBack(); return true } return false }
  }, [canGoBack])
}
```

优先级约定：弹窗(100) > BottomSheet(90) > App内导航(50) > 系统默认(0)

---

### Q5：跨 App 通信

**方案：模拟 Android Intent 机制**

```typescript
// src/system/services/IntentService.ts
interface Intent {
  action: string              // 'ACTION_VIEW', 'ACTION_PICK', ...
  data?: string               // URI
  extras?: Record<string, unknown>
  targetApp?: string          // 显式 Intent
}

interface PendingResult {
  resolve: (data: unknown) => void
  reject: (reason: string) => void
}

class IntentService {
  private resultStack: PendingResult[] = []

  // A 调用 B：返回 Promise
  async startActivityForResult(intent: Intent): Promise<unknown> {
    const targetApp = this.resolveIntent(intent)
    return new Promise((resolve, reject) => {
      this.resultStack.push({ resolve, reject })
      activityStack.push(targetApp, { intent })
    })
  }

  // B 完成后回调
  setResult(data: unknown) {
    const pending = this.resultStack.pop()
    pending?.resolve(data)
    activityStack.pop()  // 关闭 B，回到 A
  }
}

// 12306 调用支付宝
async function payWithAlipay(amount: number) {
  const result = await intentService.startActivityForResult({
    action: 'ACTION_PAY',
    targetApp: 'com.eg.android.AlipayGphone',
    extras: { amount, orderId: '...' }
  })
  handlePaymentResult(result)
}
```

---

### Q6：状态分类与管理

**方案：Zustand 分域 Store + 统一序列化接口**

```typescript
// 三类状态，分开管理，但都通过同一接口暴露给外部

// 1. 系统状态（单例）
const useSystemStore = create<SystemState>()(
  persist(immer((set) => ({
    wifi: { enabled: true, ssid: 'SimNet', signal: 4 },
    battery: { level: 85, charging: false },
    // ...
  })), { name: 'sim:system' })
)

// 2. App 状态（每 App 一个 store）
const useWechatStore = create<WechatState>()(
  persist(immer((set) => ({
    contacts: [],
    chats: {},
    // ...
  })), { name: 'sim:app:wechat' })
)

// 3. UI 瞬态（不持久化！）
// 直接用 React useState/useReducer，或 Zustand 但不加 persist
const useWechatUIStore = create<WechatUIState>()((set) => ({
  activeTab: 'chats',
  openedChatId: null,
}))
```

**全量状态读取**（外部 API 一次调用）：

```typescript
// src/simulator/StateSerializer.ts
export function serializeFullState(): SimulatorState {
  return {
    system: useSystemStore.getState(),
    apps: Object.fromEntries(
      appRegistry.getAll().map(app => [
        app.id,
        app.manifest.getState()  // 每个 App 自己负责序列化
      ])
    )
  }
}
```

---

### Q7：持久化设计

**方案：命名空间 localStorage + 单一入口**

```typescript
// 命名空间规则
// sim:system          → SystemStore
// sim:app:{appId}     → 对应 App Store
// sim:ui              → 不持久化（故意不 persist）

// 唯一入口：所有 store 通过 zustand/middleware 的 persist 统一管理
// 禁止组件直接读写 localStorage

// 避免重复的关键：
// - WiFi 状态只存在于 SystemStore
// - StatusBar、QuickSettings、Settings App 全部 useSystemStore() 读取
// - 任何地方都不存 WiFi 的本地副本

// 错误示范（禁止）：
// const [wifi, setWifi] = useState(localStorage.getItem('wifi'))  ← 禁止！

// 正确做法：
function StatusBarWifi() {
  const wifi = useSystemStore(s => s.wifi)  // 单一来源
  return <WifiIcon signal={wifi.signal} />
}
```

---

### Q8：状态重置机制

**方案：两阶段 Reset 协议 + 注册式清单**

```typescript
// 每个 Store 必须实现 reset(initialState?) 方法
interface Resettable<S> {
  reset: (initialState?: Partial<S>) => void
}

// Reset 流程
class SimulatorResetManager {
  async reset(config?: ResetConfig) {
    // Phase 1: 清除 UI 状态（同步）
    activityStack.reset()          // 回到桌面
    backHandlerService.clearAll()  // 清空返回栈

    // Phase 2: 重置所有 Store
    useSystemStore.getState().reset(config?.system)

    await Promise.all(
      appRegistry.getAll().map(async app => {
        const defaultState = await app.manifest.defaultState()
        app.store.getState().reset({
          ...defaultState,
          ...(config?.apps?.[app.id] ?? {})
        })
      })
    )

    // Phase 3: 清除 localStorage（防止旧数据污染）
    Object.keys(localStorage)
      .filter(k => k.startsWith('sim:'))
      .forEach(k => localStorage.removeItem(k))

    // Phase 4: 重新触发持久化写入
    useSystemStore.persist.rehydrate()
  }
}
```

关键：App 注册时同时注册 reset 处理器，不可能遗漏。

---

### Q9：默认数据管理

**方案：Fixture 分离 + 两层数据模型**

```
src/apps/third-party/wechat/
├── fixtures/
│   ├── structure.ts      ← 固有结构（底部 Tab、功能菜单）—— 不可替换
│   └── userData.ts       ← 用户数据（聊天记录、好友列表）—— benchmark 可替换
└── manifest.ts
```

```typescript
// fixtures/structure.ts（App 固有，不变）
export const BOTTOM_TABS = ['微信', '通讯录', '发现', '我'] as const
export const DISCOVER_ITEMS = ['朋友圈', '视频号', '扫一扫', ...] as const

// fixtures/userData.ts（用户数据，benchmark 可替换）
export const defaultUserData: WechatUserData = {
  selfProfile: { name: '张三', avatar: '...', wechatId: 'zhangsan' },
  contacts: [
    { id: 'c1', name: '李四', avatar: '...', isFriend: true },
  ],
  chats: {
    'c1': {
      messages: [
        { from: 'c1', text: '你好', time: '10:00' },
      ]
    }
  },
  wallet: { balance: 1234.56 }
}

// manifest.ts 中暴露替换接口
defaultState: () => ({
  ...STRUCTURE_DEFAULTS,       // 合并结构数据（不可替换）
  ...defaultUserData,          // 合并用户数据（可被 config 覆盖）
})
```

Benchmark 注入数据：

```python
# Python benchmark
simulator.reset({
    "apps": {
        "com.tencent.mm": {
            "wallet": {"balance": 500.00},
            "chats": {"c1": {"messages": []}}
        }
    }
})
```

---

### Q10：App 内路由设计

**方案：自定义栈路由（不用 React Router）**

理由：React Router 基于 URL，与多 App 并存场景冲突，且 URL 会暴露状态（影响纯视觉假设）。

```typescript
// src/core/AppRouter.tsx
interface Screen {
  id: string
  component: React.ComponentType<any>
  params?: Record<string, unknown>
}

interface AppRouterState {
  stack: Screen[]
  push: (screen: Screen) => void
  pop: () => void
  replace: (screen: Screen) => void
  reset: (screen: Screen) => void
}

// 每个 App 用自己的 RouterContext
function createAppRouter(initialScreen: Screen) {
  return create<AppRouterState>()(immer((set) => ({
    stack: [initialScreen],
    push: (screen) => set(s => { s.stack.push(screen) }),
    pop: () => set(s => { if (s.stack.length > 1) s.stack.pop() }),
    // ...
  })))
}

// WeChatApp.tsx
function WeChatApp() {
  const currentScreen = useWechatRouter(s => s.stack.at(-1))
  const Screen = currentScreen.component

  return (
    <div className="absolute inset-0 bg-white">
      <Screen {...currentScreen.params} />
    </div>
  )
}
```

与 ActivityStack 协同：App 内路由的 `canGoBack` 状态注册到 BackHandlerService（见 Q4），形成天然联动。

---

### Q11：导航的形式化（机器可枚举）

**方案：声明式导航图（Navigation Graph）**

```typescript
// src/apps/third-party/wechat/navigationGraph.ts
import { NavigationGraph } from '@/types/navigation'

export const wechatNavGraph: NavigationGraph = {
  appId: 'com.tencent.mm',
  screens: {
    'chat-list': {
      id: 'chat-list',
      description: '聊天列表页',
      component: ChatListScreen,
      edges: [
        {
          action: 'tap_chat_item',
          params: { chatId: 'string' },
          target: 'chat-detail',
          description: '点击某个聊天进入对话页',
        },
        {
          action: 'tap_new_chat',
          target: 'contact-picker',
          description: '新建聊天',
        }
      ]
    },
    'chat-detail': {
      id: 'chat-detail',
      description: '聊天详情页',
      edges: [
        { action: 'tap_back', target: 'chat-list' },
        { action: 'tap_voice_call', target: 'voice-call-screen' },
      ]
    },
    // ...
  },
  initialScreen: 'chat-list',
}
```

这个图支持：
- 自动枚举所有可达状态（BFS/DFS 遍历）
- 验证 Agent 轨迹是否合法（每步转换是否在图中）
- 自动生成任务描述（"从 chat-list 到达 chat-detail 并发送一条消息"）

---

### Q12：UI 语义标记体系

**方案：`data-sim-*` 属性 + 专用 Tailwind 变体（视觉不可见）**

```typescript
// src/core/semantic.ts
// 语义标记辅助函数
export function navAction(target: string, params?: object) {
  return {
    'data-sim-nav': target,
    'data-sim-params': params ? JSON.stringify(params) : undefined,
  }
}

export function stateMarker(key: string, value: unknown) {
  return {
    'data-sim-state-key': key,
    'data-sim-state-value': String(value),
  }
}

export function actionMarker(action: string, payload?: object) {
  return {
    'data-sim-action': action,
    'data-sim-payload': payload ? JSON.stringify(payload) : undefined,
  }
}

// 使用示例
function ChatListItem({ chat }) {
  return (
    <div
      className="flex items-center p-3 active:bg-gray-100"
      onClick={() => router.push({ id: 'chat-detail', params: { chatId: chat.id } })}
      {...navAction('chat-detail', { chatId: chat.id })}
      {...actionMarker('open_chat', { chatId: chat.id })}
    >
      <Avatar src={chat.avatar} />
      <span>{chat.name}</span>
    </div>
  )
}

// WifiToggle
function WifiToggle() {
  const wifi = useSystemStore(s => s.wifi)
  return (
    <button
      {...stateMarker('system.wifi.enabled', wifi.enabled)}
      {...actionMarker('toggle_wifi')}
    >
      <WifiIcon />
    </button>
  )
}
```

**保证不出现在截图中**：
- `data-*` 属性是 DOM 属性，不影响任何视觉渲染
- CSS 截图（canvas 方式）完全忽略 data 属性
- `aria-hidden` 仅影响无障碍树，不影响视觉

Benchmark 读取：

```python
# 读取当前页面所有语义信息
elements = page.query_selector_all('[data-sim-action]')
actions = [el.get_attribute('data-sim-action') for el in elements]
```

---

### Q13：App 资源组织

**方案：共享 Design Token + App 局部主题**

```
src/
├── design-system/
│   ├── tokens.ts          ← 全局 token（字体大小、圆角、间距）
│   ├── colors.ts          ← 系统调色板
│   └── components/        ← 共享组件（Avatar、Badge、ListItem）
│
├── apps/
│   └── third-party/wechat/
│       ├── theme.ts       ← WeChat 专属色（绑定系统 token）
│       └── assets/
│           ├── icons/     ← SVG 图标（React 组件形式）
│           └── images/    ← 图片资源
```

```typescript
// design-system/tokens.ts
export const tokens = {
  fontSize: { xs: '11px', sm: '13px', md: '15px', lg: '17px' },
  radius: { sm: '4px', md: '8px', lg: '12px' },
  spacing: { ... }
} as const

// apps/wechat/theme.ts
import { tokens } from '@/design-system/tokens'
export const wechatTheme = {
  primary: '#07C160',   // 微信绿
  background: '#EDEDED',
  chatBubbleSelf: '#95EC69',
  ...tokens             // 继承全局 token
}
```

不照搬 Android res/ 结构（太重），但借鉴其分离思路。

---

### Q14：系统服务架构

**方案：服务注册表 + 统一访问接口**

```typescript
// src/system/services/index.ts
// 每个服务是独立的 Zustand slice，统一注册

interface SystemService<S> {
  id: string
  useStore: () => S
  reset: (initial?: Partial<S>) => void
  serialize: () => Partial<S>
}

// 注册表
class SystemServiceRegistry {
  private services = new Map<string, SystemService<any>>()

  register<S>(service: SystemService<S>) {
    this.services.set(service.id, service)
  }

  get<S>(id: string): SystemService<S> {
    return this.services.get(id) as SystemService<S>
  }

  resetAll(config?: Record<string, unknown>) {
    this.services.forEach(svc => svc.reset(config?.[svc.id]))
  }

  serializeAll() {
    return Object.fromEntries(
      [...this.services.entries()].map(([id, svc]) => [id, svc.serialize()])
    )
  }
}

// 访问方式（App 中使用）
function WeatherWidget() {
  const location = useSystemService('location')  // 类型推断
  return <div>{location.city}</div>
}
```

---

### Q15：时间控制

**方案：双时钟架构（模拟时钟 + 真实时钟分离）**

```typescript
// src/system/services/ClockService.ts
interface ClockState {
  // 模拟时间（benchmark 控制）
  simulatedTime: number  // Unix timestamp（毫秒）
  timeZone: string
  autoAdvance: boolean   // 是否自动推进（基于真实时间差）
  _realTimeAtSet: number // 设置时记录的真实时间
}

// App 获取当前时间（用这个！）
export function useSimulatedNow(): Date {
  const { simulatedTime, autoAdvance, _realTimeAtSet } = useClockStore()
  if (autoAdvance) {
    const elapsed = Date.now() - _realTimeAtSet
    return new Date(simulatedTime + elapsed)
  }
  return new Date(simulatedTime)
}

// 动画、防抖、throttle 仍用真实时间
export const realNow = () => Date.now()       // 真实 Date.now()
export const realSetTimeout = setTimeout      // 真实定时器（不被模拟）

// Benchmark 注入时间
window.__Simulator.setTime('2024-03-15T09:00:00+08:00')
```

---

### Q16：环境变量注入

**方案：SimulatorConfig 对象 + React Context 分发**

```typescript
// src/simulator/SimulatorConfig.ts
interface SimulatorConfig {
  network: {
    type: 'wifi' | '5g' | '4g' | 'none'
    ssid?: string
    operator?: string
  }
  device: {
    model: 'Pixel 7' | 'Samsung S24' | string
    androidVersion: string
    imei: string
    phoneNumber: string
  }
  locale: {
    language: 'zh-CN' | 'en-US'
    region: string
    timezone: string
  }
  location: {
    latitude: number
    longitude: number
    city: string
    address: string
  }
}

// Playwright 注入（在 React 初始化前）
// page.evaluate(`window.__SimulatorInitConfig = ${JSON.stringify(config)}`)

// React 侧读取
const initialConfig: SimulatorConfig = window.__SimulatorInitConfig ?? DEFAULT_CONFIG
const SimulatorConfigContext = createContext(initialConfig)
```

---

### Q17：Benchmark API 设计

**方案：`window.__Simulator` 命名空间 + 清晰的职责边界**

```typescript
// src/simulator/BenchmarkAPI.ts
window.__Simulator = {
  // ===== 控制 API（benchmark 使用）=====

  // 重置到初始状态（支持指定初始条件）
  async reset(config?: ResetConfig): Promise<void>,

  // 获取完整状态快照（任务判定用）
  getState(): SimulatorState,

  // 写入特定状态（注入前置条件）
  async setState(partial: DeepPartial<SimulatorState>): Promise<void>,

  // 控制模拟时间
  setTime(isoString: string): void,

  // 注入通知
  pushNotification(notification: NotificationPayload): void,

  // 控制网络状态
  setNetworkState(state: NetworkState): void,

  // ===== 查询 API（任务定义/验证用）=====

  // 获取当前前台 App
  getForegroundApp(): string,

  // 获取当前屏幕的语义信息（所有 data-sim-* 属性）
  getSemanticAnnotations(): SemanticAnnotation[],

  // ===== 不暴露的 API =====
  // Agent 的点击/滑动/输入通过 Playwright 直接操作 DOM
  // 不需要 JS API，这保持了 Agent 的纯视觉特性
}
```

**重要**：Agent 动作（tap/swipe/type）不通过 JS API，而是让 Playwright 直接 dispatch 鼠标/键盘事件。这样 Agent 和真实用户交互路径完全一致。

---

### Q18：状态快照格式

**方案：自描述 JSON + App 自报告**

```typescript
interface SimulatorState {
  _meta: {
    version: '1.0'
    timestamp: number
    simulatedTime: number
  }
  system: {
    wifi: { enabled: boolean; ssid: string; signal: 0|1|2|3|4 }
    bluetooth: { enabled: boolean }
    battery: { level: number; charging: boolean }
    volume: { media: number; ring: number }
    brightness: number
    doNotDisturb: boolean
    airplane: boolean
  }
  device: {
    model: string
    androidVersion: string
    phoneNumber: string
  }
  shell: {
    foregroundApp: string | null  // appId 或 null（桌面）
    activityStack: string[]       // 从底到顶的 appId 栈
    notifications: NotificationItem[]
  }
  apps: {
    // 每个 App 自己定义其 state schema
    'com.tencent.mm': WechatStateSnapshot
    'com.eg.android.AlipayGphone': AlipayStateSnapshot
    'com.android.settings': SettingsStateSnapshot
    // 新增 App 自动出现，不需要修改此接口
    [appId: string]: unknown
  }
}

// WechatStateSnapshot 示例
interface WechatStateSnapshot {
  currentScreen: string           // 当前路由节点 ID
  unreadCount: number
  wallet: { balance: number }
  contacts: { id: string; name: string }[]
  recentChats: {
    id: string
    lastMessage: string
    unread: number
  }[]
}
```

`getState()` 实现中，`apps` 部分通过遍历注册表获取，新 App 自动包含，无需改公共代码。

---

### Q19：与真实 Android 的对齐策略

**判断标准**：「Agent 会不会因为我简化了这个机制而产生行为偏差？」

**值得忠实模拟的**：

| 机制 | 原因 |
|------|------|
| Activity 栈视觉行为 | Agent 会看到「返回」带来的页面切换 |
| 通知下拉面板 | Agent 会看到通知、与之交互 |
| 状态栏图标（WiFi、电量） | Agent 依赖这些视觉线索做决策 |
| 键盘弹出收起行为 | 影响屏幕布局，Agent 会看到 |
| 弹窗/Dialog 样式 | Agent 需要识别并交互 |

**可以大幅简化的**：

| 机制 | 简化方式 | 理由 |
|------|----------|------|
| 进程模型 | 无进程概念 | Agent 看不到，Benchmark 不关心 |
| Binder IPC | 直接 JS 函数调用 | 效果等价 |
| 权限系统 | 始终授权 | 减少复杂度，除非 benchmark 任务需要 |
| 多用户/账号 | 单用户 | 超出当前需求 |
| 动画时长 | 可配置（甚至 0ms） | Benchmark 需要快速执行 |
| OEM 定制差异 | 选定一款（Pixel 风格） | 减少维护成本 |

---

### Q20：数据模型对齐策略

**方案：功能对齐 Android，物理结构自定义**

Android 的系统数据分布在 SystemProperties、Settings.Global/System/Secure、各 Manager 中——这个分类是历史遗留的，不便于我们序列化和 API 设计。

本方案按**功能语义**分组：

```typescript
// 自定义分组（按功能，便于 benchmark 使用）
system: {
  connectivity: { wifi, bluetooth, cellular, airplane }
  display: { brightness, orientation, fontSize }
  sound: { volume, ringtone, vibration }
  power: { battery, chargingState }
  security: { screenLock, biometrics }
  time: { current, timezone, format24h }
}
```

文档层面注释 Android 对应位置（便于后续对齐真实数据）：

```typescript
// 对应 android.provider.Settings.Global.WIFI_ON
wifi: { enabled: boolean }
```

**选择理由**：Benchmark 使用者是 ML 研究员，不是 Android 工程师，功能分组比 Android 原生分组更直观。

---

### Q21：系统应用 vs 第三方应用

**方案：物理分离 + 权限分级**

```
src/apps/
├── system/
│   ├── settings/     ← 与系统服务深度耦合，可直接调用内部 API
│   ├── contacts/     ← 与 Phone/SMS 共享 ContentProvider（模拟）
│   ├── phone/
│   ├── sms/
│   ├── camera/
│   └── gallery/
├── third-party/
│   ├── wechat/       ← 只能通过公开 SystemService 接口访问系统
│   ├── alipay/
│   ├── meituan/
│   └── ...
└── _shared/          ← 跨 App 共享的组件（ContactPickerModal 等）
```

```typescript
// system/settings 可以直接修改系统状态（内部）
import { systemStore } from '@/system/stores'  // 允许

// third-party/wechat 只能通过接口（外部）
import { useSystemService } from '@/system/hooks'  // 允许
import { systemStore } from '@/system/stores'      // ESLint 规则禁止！
```

通过 ESLint 自定义规则在编译时强制执行边界。

---

### Q22：新增 App 的成本

**标准路径（必须修改的文件数：0）**

开发者只需要做：

```
mkdir src/apps/third-party/meituan
```

然后创建以下文件（全部是新建，无需修改已有文件）：

```
src/apps/third-party/meituan/
├── manifest.ts          ← 必须，遵循 AppManifest 接口
├── MeituanApp.tsx        ← 主组件
├── router.ts             ← App 内路由定义
├── store.ts              ← Zustand store
├── navigationGraph.ts    ← 声明式导航图
├── fixtures/
│   ├── structure.ts      ← 固有结构数据
│   └── userData.ts       ← 默认用户数据
├── screens/
│   ├── HomeScreen.tsx
│   └── OrderScreen.tsx
└── assets/
    └── icon.svg
```

完成后：
- `import.meta.glob` 自动扫描到 manifest.ts ✅
- AppRegistry 自动注册 ✅
- HomeScreen 自动出现图标 ✅
- `getState()` 自动包含美团状态 ✅
- `reset()` 自动包含美团重置 ✅

**改动 0 行已有文件**。

---

### Q23：64 实例并发优化

**潜在瓶颈分析**：

| 瓶颈 | 严重度 | 原因 |
|------|--------|------|
| 内存（JS Heap） | 高 | 每个 Tab 独立 V8 堆，20+ App × 状态 |
| 初始加载时间 | 中 | 所有 App bundle 一次性加载 |
| localStorage 并发 | 低 | 每个 Tab 独立，互不干扰 |
| React reconcile | 低 | 同一时间只渲染 1 个前台 App |

**优化策略**：

```typescript
// 1. 代码分割：App 按需加载（最重要）
// manifest.ts 中组件使用动态 import
component: lazy(() => import('./WeChatApp')),

// 2. 只 mount 前台 App（见 Q2 的混合策略）

// 3. 初始状态压缩：大数据（聊天记录）只存摘要
// 完整数据按需加载
const wechatStore = {
  recentChats: ChatSummary[],  // 只存摘要
  loadChatDetail: async (id: string) => { ... }  // 按需加载
}

// 4. 禁用不必要的动画（Benchmark 模式）
// window.__Simulator.setBenchmarkMode(true)
// → 所有 CSS transition 设为 0ms
:root[data-benchmark-mode] * {
  transition-duration: 0ms !important;
  animation-duration: 0ms !important;
}
```

每个 Tab 预期内存：~50-100MB（主要是 V8 + React DOM），64 个 Tab 约 3.2-6.4GB，现代服务器可以接受。

---

### Q24：类型安全设计

**方案：分层类型定义 + 泛型约束**

```typescript
// src/types/app.ts（系统层类型）
interface AppManifest {
  id: AppId                              // branded type
  name: string
  component: React.ComponentType
  defaultState: () => Promise<AppState>
  getState: () => AppStateSnapshot
  navigationGraph: () => Promise<NavigationGraph>
}

// src/types/intent.ts（Intent 类型安全）
type IntentMap = {
  'ACTION_VIEW':    { data: string }
  'ACTION_PAY':     { amount: number; orderId: string }
  'ACTION_PICK_CONTACT': never
  // 新增 action 时必须在这里注册，否则类型报错
}

function startActivityForResult<A extends keyof IntentMap>(
  action: A,
  extras: IntentMap[A]
): Promise<IntentResultMap[A]>

// src/types/state.ts（状态快照类型）
type AppStateRegistry = {
  'com.tencent.mm': WechatStateSnapshot
  'com.eg.android.AlipayGphone': AlipayStateSnapshot
}

// getState() 返回类型自动从注册表推导
type SimulatorState = {
  system: SystemStateSnapshot
  apps: AppStateRegistry
}

// Benchmark API 类型（暴露给外部）
interface SimulatorAPI {
  reset(config?: DeepPartial<SimulatorState>): Promise<void>
  getState(): SimulatorState
  setState(partial: DeepPartial<SimulatorState>): Promise<void>
}
```

跨层类型保障：共享 `types/` 包（非 monorepo，直接 import），Python benchmark 通过 Playwright 的 evaluate 调用，用 JSON Schema（从 TypeScript 类型自动生成）验证。

---

## 三、最难的 3 个设计决策

---

### 难题 1：App 生命周期 vs 内存 vs 状态一致性的三角矛盾

**问题根源**：

- 始终 mount：内存爆炸（20+ App 常驻）
- 卸载/重挂：scroll 位置、输入状态、动画全部丢失，用户体验差
- 只保活顶层：深层 App 被卸载时，它的 Store 状态和组件状态（useState）可能不同步

**核心矛盾**：React 的 useState 和 Zustand Store 是两套状态系统。卸载组件时，useState 状态丢失，但 Store 状态保留。重新 mount 时，useState 从初始值开始，而 Store 里可能有"脏状态"。

**我的解决方案**：强制规定 —— **UI 瞬态（滚动位置、输入内容）也必须存入 Store，不允许用 useState 存任何"需要保留"的状态。**

这个约束有成本（写法更冗长），但换来了一个好处：App 随时可以安全卸载和重挂，状态不丢失。Lint 规则强制执行。

---

### 难题 2：Benchmark 时间控制 vs 真实时间的精确边界

**问题根源**：

- 模拟时间：用于业务逻辑（天气显示"明天"、账单日期）
- 真实时间：用于防抖(300ms)、动画(200ms)、轮询间隔

如果把所有 `Date.now()` 都替换成 `simulatedNow()`，动画和防抖会在时间快进时瞬间触发或永远不触发。

**核心挑战**：如何在同一套代码里让两种时间和平共存？

**解决方案**：严格的编码约定 + ESLint 强制：

```
业务时间    → useSimulatedNow()  / SimulatedDate.now()
动画/IO时间 → 原生 Date.now() / setTimeout（这两个永远不替换）
```

用 ESLint 禁止在 App 业务代码中直接调用 `new Date()` 或 `Date.now()`，必须通过 hook。

---

### 难题 3：语义标记 vs 纯视觉约束的矛盾

**问题根源**：

我们需要在 DOM 上标记语义（供 benchmark 读取），但又必须保证 Agent 看到的只是纯视觉截图。

这两者本质上是矛盾的：

- DOM 属性对截图不可见 ✅（data-* 不影响渲染）
- 但如果 Agent 能访问 DOM（即使是无意的）？

**更深的矛盾**：Playwright 截图用的是 CDP 的 `Page.captureScreenshot`，确实不包含 DOM 信息。但如果未来换用 `page.evaluate` 读取内容，语义标记就会"泄漏"给 Agent。

**我的方案**：架构上明确禁止 benchmark 把语义标记传给 Agent。Agent 只能接收：
1. PNG 截图（`page.screenshot()`）
2. 允许的动作空间（tap/swipe/type，不含 DOM 查询）

这是一个**规范约束**，不是技术约束。必须在 benchmark 框架层强制执行，模拟器层无法独自保证。

---

## 四、具体 App 骨架代码

以"美团外卖"为例，展示完整目录结构和各层协作：

```
src/apps/third-party/meituan/
├── manifest.ts
├── MeituanApp.tsx
├── router.ts
├── store.ts
├── navigationGraph.ts
├── fixtures/
│   ├── structure.ts
│   └── userData.ts
└── screens/
    ├── HomeScreen.tsx
    ├── OrderListScreen.tsx
    └── OrderDetailScreen.tsx
```

```typescript
// ============================================================
// manifest.ts
// ============================================================
import { AppManifest } from '@/types/app'
import MeituanApp from './MeituanApp'
import { meituanStore } from './store'
import meituanIcon from './assets/icon.svg'

export default {
  id: 'com.sankuai.meituan',
  name: '美团',
  icon: meituanIcon,
  category: 'third-party',
  component: MeituanApp,
  defaultState: async () => {
    const { defaultUserData } = await import('./fixtures/userData')
    const { structure } = await import('./fixtures/structure')
    return { ...structure, ...defaultUserData }
  },
  getState: () => meituanStore.getState().serialize(),
  navigationGraph: () => import('./navigationGraph').then(m => m.meituanNavGraph),
} satisfies AppManifest
```

```typescript
// ============================================================
// store.ts
// ============================================================
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface MeituanState {
  // 路由状态（UI 瞬态，但存 Store 以便 App 重挂后恢复）
  currentScreenId: string
  screenParams: Record<string, unknown>

  // 用户数据（可被 benchmark 替换）
  userProfile: { name: string; phoneNumber: string }
  addresses: Address[]
  orders: Order[]
  cart: CartItem[]

  // Actions
  navigate: (screenId: string, params?: Record<string, unknown>) => void
  goBack: () => void
  addToCart: (item: MenuItem) => void
  serialize: () => MeituanStateSnapshot
  reset: (initial?: Partial<MeituanState>) => void
}

export const meituanStore = create<MeituanState>()(
  persist(
    immer((set, get) => ({
      currentScreenId: 'home',
      screenParams: {},
      userProfile: { name: '', phoneNumber: '' },
      addresses: [],
      orders: [],
      cart: [],

      navigate: (screenId, params = {}) =>
        set(s => {
          s.currentScreenId = screenId
          s.screenParams = params
        }),

      goBack: () =>
        set(s => {
          // 根据导航图回退（简化版，完整版需要维护历史栈）
          s.currentScreenId = 'home'
        }),

      addToCart: (item) =>
        set(s => {
          const existing = s.cart.find(c => c.id === item.id)
          if (existing) existing.quantity++
          else s.cart.push({ ...item, quantity: 1 })
        }),

      serialize: () => ({
        currentScreen: get().currentScreenId,
        cartItemCount: get().cart.reduce((n, c) => n + c.quantity, 0),
        orderCount: get().orders.length,
        recentOrders: get().orders.slice(0, 5).map(o => ({
          id: o.id,
          status: o.status,
          totalAmount: o.totalAmount,
        })),
      }),

      reset: (initial) =>
        set(s => {
          Object.assign(s, {
            currentScreenId: 'home',
            screenParams: {},
            cart: [],
            ...(initial ?? {}),
          })
        }),
    })),
    {
      name: 'sim:app:com.sankuai.meituan',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

```typescript
// ============================================================
// MeituanApp.tsx
// ============================================================
import React from 'react'
import { meituanStore } from './store'
import HomeScreen from './screens/HomeScreen'
import OrderListScreen from './screens/OrderListScreen'
import OrderDetailScreen from './screens/OrderDetailScreen'
import { useBackHandler } from '@/system/hooks/useBackHandler'

const SCREENS: Record<string, React.ComponentType<any>> = {
  'home': HomeScreen,
  'order-list': OrderListScreen,
  'order-detail': OrderDetailScreen,
}

export default function MeituanApp() {
  const { currentScreenId, screenParams, goBack } = meituanStore()

  // 注册返回键处理（优先级 50：App 内导航）
  useBackHandler({
    id: 'meituan-router',
    priority: 50,
    handler: () => {
      if (currentScreenId !== 'home') {
        goBack()
        return true  // 已消费
      }
      return false   // 退回桌面
    },
  }, [currentScreenId])

  const Screen = SCREENS[currentScreenId] ?? HomeScreen

  return (
    <div className="absolute inset-0 bg-[#F5F5F5] flex flex-col">
      <Screen {...screenParams} />
    </div>
  )
}
```

```typescript
// ============================================================
// screens/HomeScreen.tsx（展示语义标记）
// ============================================================
import React from 'react'
import { meituanStore } from '../store'
import { navAction, actionMarker, stateMarker } from '@/core/semantic'

export default function HomeScreen() {
  const { navigate, cart } = meituanStore()

  return (
    <div className="flex flex-col h-full">
      {/* 搜索栏 */}
      <div className="bg-[#FFD100] px-4 py-3">
        <input
          className="w-full rounded-full px-4 py-2 text-sm bg-white"
          placeholder="搜索外卖、超市、药品..."
          readOnly  // 模拟器中点击会弹键盘（系统级）
          {...actionMarker('focus_search')}
        />
      </div>

      {/* 功能入口（固有结构，来自 fixtures/structure.ts）*/}
      <div className="grid grid-cols-5 gap-2 p-4 bg-white">
        {FEATURE_ENTRIES.map(entry => (
          <button
            key={entry.id}
            className="flex flex-col items-center gap-1"
            onClick={() => navigate(entry.target)}
            {...navAction(entry.target)}
            {...actionMarker('tap_feature_entry', { entryId: entry.id })}
          >
            <img src={entry.icon} className="w-12 h-12" alt={entry.label} />
            <span className="text-xs text-gray-600">{entry.label}</span>
          </button>
        ))}
      </div>

      {/* 购物车浮层 */}
      {cart.length > 0 && (
        <div
          className="fixed bottom-16 right-4 bg-[#FFD100] rounded-full w-14 h-14
                     flex items-center justify-center shadow-lg"
          onClick={() => navigate('cart')}
          {...navAction('cart')}
          {...stateMarker('meituan.cart.itemCount', cart.length)}
        >
          <span className="text-lg font-bold">{cart.length}</span>
        </div>
      )}

      {/* 订单入口 */}
      <button
        className="..."
        onClick={() => navigate('order-list')}
        {...navAction('order-list')}
        {...actionMarker('view_orders')}
      >
        我的订单
      </button>
    </div>
  )
}
```

```typescript
// ============================================================
// navigationGraph.ts
// ============================================================
import { NavigationGraph } from '@/types/navigation'

export const meituanNavGraph: NavigationGraph = {
  appId: 'com.sankuai.meituan',
  initialScreen: 'home',
  screens: {
    'home': {
      id: 'home',
      description: '美团首页',
      edges: [
        { action: 'tap_feature_entry', params: { entryId: 'waimai' }, target: 'restaurant-list' },
        { action: 'view_orders', target: 'order-list' },
        { action: 'focus_search', target: 'search' },
      ]
    },
    'order-list': {
      id: 'order-list',
      description: '订单列表',
      edges: [
        { action: 'tap_order', params: { orderId: 'string' }, target: 'order-detail' },
        { action: 'tap_back', target: 'home' },
      ]
    },
    'order-detail': {
      id: 'order-detail',
      description: '订单详情',
      edges: [
        { action: 'tap_back', target: 'order-list' },
        { action: 'tap_reorder', target: 'cart' },
      ]
    },
  }
}
```

---

## 五、有意识的简化/妥协

| 简化项 | 具体内容 | 去掉简化的条件 |
|--------|----------|----------------|
| **动画** | Benchmark 模式下所有动画关闭（0ms） | Agent 需要观察/等待动画时开启 |
| **权限系统** | 始终授权，不弹权限对话框 | Benchmark 任务涉及权限决策时实现 |
| **后台刷新** | App 切入后台时不更新数据（无 WorkManager） | 需要模拟推送、实时数据的任务 |
| **多窗口/分屏** | 不支持，全屏单 App | 平板任务场景需要 |
| **深链（Deep Link）** | 只实现常见场景，不做通配 | 需要从通知点击进入特定页的任务 |
| **内容提供者** | 系统应用（通讯录）通过 React Context 共享，非 ContentProvider | 需要精确模拟 Android 跨 App 数据查询时实现 |
| **WebView** | 用 `<iframe>` 模拟或静态页面替代 | 需要在 H5 页面内操作的任务 |
| **输入法** | 用简单键盘组件，不模拟真实 IME 切换 | 需要测试中文输入法相关操作的任务 |
| **OEM 差异** | 只做 Pixel（原生 Android）风格 | 需要在特定厂商 UI 上测试的任务 |
| **无障碍树** | 不维护 AccessibilityNodeInfo | 如果 benchmark 需要用 a11y 做任务判定 |

---

*文档结束。总计覆盖 24 个设计问题、3 个核心难题分析、1 个完整 App 骨架、明确的简化清单。*
