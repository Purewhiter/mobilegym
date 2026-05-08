下面给出一套**以“可重置、可持久化、可枚举、可并发跑 benchmark”为第一目标**的方案。核心思路只有三条：

1. **单一可序列化状态树** ：凡是会影响截图、任务判定、刷新恢复的状态，都进同一份 canonical store。
2. **运行时模型独立于 React 组件树** ：Task / Activity / Intent / Back / Service 都是运行时概念，React 只是渲染器。
3. **App 通过 manifest 接入系统** ：系统不认识具体 App，只认识 App contract。

---

# 1) 整体架构图

<pre class="overflow-visible! px-0!" data-start="290" data-end="3435"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>┌─────────────────────────────────────────────────────────────────────┐</span><br/><span>│                    Python Benchmark + Playwright                   │</span><br/><span>│                                                                     │</span><br/><span>│  Visual path: screenshot / click / swipe / type                    │</span><br/><span>│  Control path: page.evaluate(window.__SIM__.*)                     │</span><br/><span>└──────────────────────────────┬──────────────────────────────────────┘</span><br/><span>                               │</span><br/><span>                    ┌──────────▼──────────┐</span><br/><span>                    │   Benchmark Bridge   │</span><br/><span>                    │ window.__SIM__       │</span><br/><span>                    │ window.__SIM_AGENT__ │</span><br/><span>                    └──────────┬──────────┘</span><br/><span>                               │</span><br/><span>┌──────────────────────────────▼──────────────────────────────────────┐</span><br/><span>│                         Simulator Kernel                            │</span><br/><span>│                                                                     │</span><br/><span>│  Registry Loader                                                    │</span><br/><span>│  ├─ App Registry (import.meta.glob)                                 │</span><br/><span>│  └─ Service Registry                                                │</span><br/><span>│                                                                     │</span><br/><span>│  Runtime Managers                                                   │</span><br/><span>│  ├─ ActivityManager / TaskManager                                   │</span><br/><span>│  ├─ IntentManager                                                   │</span><br/><span>│  ├─ BackDispatcher                                                  │</span><br/><span>│  ├─ NotificationManager / KeyboardManager / ClipboardManager        │</span><br/><span>│  ├─ SimClock                                                        │</span><br/><span>│  ├─ PersistenceCoordinator                                          │</span><br/><span>│  └─ ResetCoordinator                                                │</span><br/><span>│                                                                     │</span><br/><span>│  Canonical Store (single serializable snapshot)                     │</span><br/><span>│  ├─ device / env / clock                                            │</span><br/><span>│  ├─ services.*                                                      │</span><br/><span>│  ├─ system.*                                                        │</span><br/><span>│  └─ apps[appId] = { data, ui }                                      │</span><br/><span>└──────────────────────────────┬──────────────────────────────────────┘</span><br/><span>                               │</span><br/><span>                    ┌──────────▼──────────┐</span><br/><span>                    │     Render Shell     │</span><br/><span>                    │ PhoneFrame           │</span><br/><span>                    │ StatusBar            │</span><br/><span>                    │ Launcher             │</span><br/><span>                    │ Task/Window Layer    │</span><br/><span>                    │ System Overlays      │</span><br/><span>                    └──────────┬──────────┘</span><br/><span>                               │</span><br/><span>                   ┌───────────▼───────────┐</span><br/><span>                   │     Foreground App     │</span><br/><span>                   │  typed routes/screens  │</span><br/><span>                   │ semantic data-* marks  │</span><br/><span>                   └────────────────────────┘</span><br/><br/><span>数据流：</span><br/><span>用户/Agent动作 -> DOM事件 -> Runtime command -> Store -> React render</span><br/><span>Benchmark控制 -> __SIM__ -> Store/Runtime -> Persist -> Render</span><br/><span>语义采集 -> trace/log/export（仅给 benchmark，不给 Agent）</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 2) 每个问题的设计方案

## 一、系统架构

### 1. 分层设计

**方案**

分四层：

* **Kernel 层** ：store、registry、activity/task、intent、back、clock、persist、reset。
* **System UI 层** ：状态栏、桌面、导航栏、通知栏、系统弹层、输入法。
* **App Runtime 层** ：App manifest、route graph、intent handler、state slice。
* **App View 层** ：各个 screen / widget / semantic marker。

**边界**

系统负责“设备级”和“跨 App”的能力：窗口栈、返回、通知、键盘、时间、环境、Launcher、App 启动。

App 只负责自己的数据、页面、交互、可声明的 intent 输入输出。

系统 **不直接读 App 内部 React 状态** ，只读 manifest 和 app state slice。

App  **不直接改 system slice** ，只能通过 service command / intent。

**理由**

这样能把“像 Android 的部分”从“像网页组件的部分”里剥离出来，reset / getState / trace 才稳定。

**替代方案**

把系统也当成一个大 App 来做会更省事，但一旦出现跨 App 返回、通知、系统键盘、重置注入，就会很快失控。

---

### 2. App 生命周期

**方案**

显式建模：

* `TaskRecord`
* `ActivityRecord`
* `foregroundTaskId`
* `activityStack`
* `activityState = resumed | paused | stopped`

React 组件的 mount 策略采用：

* **默认：后台 Activity 组件卸载**
* **可选：`keepAlive` 覆盖**

也就是说， **生命周期和 React 挂载不是一回事** 。Activity 在运行时仍然存在，但 View 默认会被卸载，状态由 store 保存。

**理由**

默认卸载更适合 benchmark：

* 内存更低，64 tab 更稳
* 后台 effect 不会偷偷跑
* reset 更彻底
* 刷新恢复只依赖 store，不依赖隐藏组件树

**替代方案与权衡**

* **隐藏不卸载** ：恢复简单，scroll 和局部 state 自动保留；但内存高、后台副作用多、reset 难、并发差。
* **卸载** ：必须把 scroll、modal、draft 等 UI 状态显式存储；开发多写一点，但系统可控。

我的建议是： **默认卸载，少数重型页面才 keepAlive** 。

---

### 3. App 注册与发现

**方案**

每个 App 导出一个 `manifest.ts`，启动时用 Vite 的 `import.meta.glob` 自动发现：

<pre class="overflow-visible! px-0!" data-start="4789" data-end="4894"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">const</span><span></span><span class="ͼm">appModules</span><span></span><span class="ͼg">=</span><span></span><span class="ͼg">import.</span><span>meta</span><span class="ͼg">.</span><span>glob(</span><span class="ͼk">'/src/{apps,system-apps}/**/manifest.ts'</span><span>, { eager: </span><span class="ͼj">true</span><span> });</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

manifest 至少包含：

* `id`
* `kind: 'system' | 'third-party'`
* `initialState(seed)`
* `stateSchema`
* `routes`
* `intentFilters`
* `launcherEntry`
* `loadRoot()` 懒加载入口

**理由**

新增 App 不改系统层代码，系统只消费 manifest contract。

**替代方案**

* 手写 `apps/index.ts` 统一注册：更直观，但每加一个 App 都要改中心文件。
* 运行时远程加载：灵活，但单前端项目没必要，类型也更难保。

---

### 4. 返回键

**方案**

做一个统一的 `BackDispatcher`，借鉴 Android `OnBackPressedDispatcher`，但分层优先级更明确：

1. 输入法 / 系统 Overlay
2. App 内弹窗 / Bottom Sheet / Modal
3. 当前 route 自定义 back handler
4. 当前 activity 的 route stack pop
5. activity 栈 pop
6. 回到 Launcher
7. Launcher 上 no-op

API 形态：

<pre class="overflow-visible! px-0!" data-start="5479" data-end="5638"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">useBackHandler</span><span>({</span><br/><span>  scope: </span><span class="ͼk">'modal'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'route'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'activity'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'system'</span><span>,</span><br/><span>  priority: </span><span class="ͼm">number</span><span>,</span><br/><span>  enabled: </span><span class="ͼm">boolean</span><span>,</span><br/><span>  onBack: () => </span><span class="ͼk">'handled'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'bubble'</span><br/><span>});</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

同层按 **LIFO** 分发。

**理由**

多个组件都想接管返回键时，最怕“谁先注册谁赢”。必须把 back 做成显式调度器，而不是 `window.onkeydown` 到处监听。

**替代方案**

* 只靠路由 `navigate(-1)`：处理不了 modal、键盘、跨 App。
* DOM 事件冒泡：与可视层耦合太强，不适合系统级回退语义。

---

### 5. 跨 App 通信

**方案**

用 **Intent + ActivityResult** 模型，不允许 App 直接调用别的 App 的 store。

关键对象：

* `IntentRequest`
* `callerActivityId`
* `targetAppId / targetActivity`
* `requestId`
* `resultSchema`

流程：

1. App A 发 `startActivityForResult(intent)`
2. `IntentManager` 根据 manifest `intentFilters` 找 App B
3. `ActivityManager` 启动 B 的 activity，并记录 `pendingResult`
4. B 完成后 `finishActivity(result)`
5. 结果回传给 A，A reducer 处理结果并恢复 UI

**理由**

这样跨 App 依赖只通过 contract 发生，能序列化、能回放、能做轨迹校验。

**替代方案**

* 直接函数调用：写起来快，但耦合爆炸。
* 共享 store 互相读写：最省代码，但边界彻底消失。

---

## 二、状态管理与数据流

### 6. 状态分类

**方案**

用 **一个 canonical store** ，内部按语义分区，而不是多个分散 store：

<pre class="overflow-visible! px-0!" data-start="6457" data-end="6716"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">SimulatorState</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  schemaVersion: </span><span class="ͼm">number</span><span>;</span><br/><span>  device: </span><span class="ͼm">DeviceState</span><span>;</span><br/><span>  env: </span><span class="ͼm">EnvState</span><span>;</span><br/><span>  clock: </span><span class="ͼm">ClockState</span><span>;</span><br/><span>  services: </span><span class="ͼm">ServiceStateMap</span><span>;</span><br/><span>  system: </span><span class="ͼm">SystemState</span><span>;</span><br/><span>  apps: {</span><br/><span>    [appId: </span><span class="ͼm">string</span><span>]: {</span><br/><span>      data: </span><span class="ͼm">unknown</span><span>;</span><br/><span>      ui: </span><span class="ͼm">unknown</span><span>;</span><br/><span>    };</span><br/><span>  };</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

分类原则：

* **系统状态** ：`services.*`、`system.*`
* **App 业务状态** ：`apps[appId].data`
* **会影响像素或恢复的 UI 瞬态** ：`apps[appId].ui`
* **纯渲染瞬态** （hover、按压波纹中间帧）可留组件内

**理由**

外部 API 一次 `getState()`/`reset()` 就能拿到全量状态。

不会出现“系统一份、App 一份、组件里又一份”。

**替代方案**

* Context/Store 四处分散：组件写起来轻，但 reset / persist / snapshot 很痛苦。
* 完全全局化：最可控，但要约束哪些局部状态允许不进 store。

---

### 7. 持久化

**方案**

只允许**一个持久化协调器**写盘，目标存储用  **IndexedDB** ，不用 localStorage 做主存储。

规则：

* 唯一数据源：canonical store
* 唯一持久化出口：`PersistenceCoordinator`
* key 按实例隔离：`sim:${instanceId}:${schemaVersion}`
* 写入节流 + `flushPersist()` 保证 benchmark 可等待落盘
* schema version + migrator

`WiFi` 这种状态只存一份：`services.connectivity.wifi.enabled`。

状态栏、快捷设置、设置 App 都读这一个源。

**理由**

多组件各自持久化最容易造成“显示不一致”。

IndexedDB 异步、容量大，64 tab 场景比 localStorage 更稳。

**替代方案**

* 组件自己 `useEffect` 持久化：最不推荐。
* localStorage：简单，但同步阻塞、容量小、并发差。

---

### 8. 状态重置

**方案**

做 `ResetCoordinator`，重置不是“setState 一下”这么简单，而是五步：

1. 暂停 runtime side effects（通知轮询、异步队列、输入法等）
2. 用 registry 重新生成 root initial state
3. 应用 benchmark 注入 seed / patch
4. 清空非序列化 runtime cache，并递增 `sessionEpoch`
5. 重启 runtime，并重新渲染

同时根组件 key 绑定 `sessionEpoch`，强制清理残留局部 state。

**理由**

这能保证“系统服务 + 所有 App + 所有 View 残留”都被清掉。

**替代方案**

* 只替换 store：会漏掉 runtime cache 和局部组件状态。
* 整页刷新：重，但慢，而且不方便调试中间状态。

---

### 9. 默认数据管理

**方案**

每个 App 分两类文件：

* **结构性描述** ：路由、菜单、Tab、能力声明、资源 key
* **用户数据 seed** ：聊天记录、联系人、订单、余额

建议目录：

<pre class="overflow-visible! px-0!" data-start="8094" data-end="8261"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>apps/wechat/</span><br/><span>  manifest.ts</span><br/><span>  nav.graph.ts</span><br/><span>  state.schema.ts</span><br/><span>  fixtures/</span><br/><span>    default.user.json</span><br/><span>    scenario.payment.json</span><br/><span>  res/</span><br/><span>    strings.ts</span><br/><span>    icons.tsx</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

格式上：

* **结构** ：TypeScript，便于类型推断
* **可替换用户数据** ：JSON 或 JSON-compatible TS object，便于 benchmark 注入

**理由**

“功能结构”不应随着任务变化频繁替换；“用户数据”应该很容易被 benchmark 覆盖。

**替代方案**

* 全部写 TS：类型强，但 Python benchmark 不方便改。
* 全部写 JSON：灵活，但行为逻辑和 schema 约束太弱。

---

## 三、App 内部架构

### 10. 路由设计

**方案**

 **不用 React Router 做 App 内主路由** ，而是每个 activity 自带一个 **自定义 typed route stack** 。

原因很简单：浏览器 history、系统 back、Task/Activity 栈，这三套历史模型不能混。

路由记录放在 `ActivityRecord` 里：

<pre class="overflow-visible! px-0!" data-start="8700" data-end="8782"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">RouteEntry</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  name: </span><span class="ͼm">string</span><span>;</span><br/><span>  params: </span><span class="ͼm">unknown</span><span>;</span><br/><span>  key: </span><span class="ͼm">string</span><span>;</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

App 通过 `push/replace/pop` 改自己的 route stack。

**理由**

这能和系统级 Activity 栈天然协同：

先看 modal，再 pop route，再 pop activity，再回桌面。

**替代方案**

* React Router MemoryRouter：能用，但每个 activity 一套 router，和系统 back 对齐会很麻烦。
* BrowserRouter：基本不合适。

---

### 11. 导航的形式化

**方案**

给每个 App 定义一份 **声明式导航图** ，不是只描述页面，还描述：

* screen/node
* params schema
* 可触发 action
* action 的 guard
* state effect
* 导航目标
* 可枚举器 `enumerate(state)`

例如：

<pre class="overflow-visible! px-0!" data-start="9190" data-end="9308"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">chatList</span><span></span><span class="ͼg">--</span><span class="ͼm">openChat</span><span>(</span><span class="ͼm">chatId</span><span>)</span><span class="ͼg">--></span><span></span><span class="ͼm">chatThread</span><span>(</span><span class="ͼm">chatId</span><span>)</span><br/><span class="ͼm">chatThread</span><span></span><span class="ͼg">--</span><span class="ͼm">tapPay</span><span>(</span><span class="ͼm">orderId</span><span>)</span><span class="ͼg">--></span><span></span><span class="ͼm">externalIntent</span><span>(</span><span class="ͼm">alipay</span><span class="ͼg">.</span><span>pay)</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

其中 `enumerate(state)` 用于把参数化 screen 展开成具体实例，比如所有 chatId、所有订单 id。

**理由**

“可机器枚举”不能只靠 DOM 抓取，必须有一份结构化图谱。

**替代方案**

* 纯运行时录制导航：真实，但不完整，覆盖率受限。
* 手工任务脚本：可控，但无法做普适生成。

---

### 12. UI 语义标记

**方案**

用 **不可见的 DOM `data-*` 标记 + 运行时语义注册表** 。

所有可交互元素通过封装组件输出语义，例如：

* `data-sim-action="wechat.openChat"`
* `data-sim-target="chatThread"`
* `data-sim-effects="apps.wechat.ui.currentChat,apps.wechat.data.lastReadAt"`

这些属性不会出现在截图里，但 benchmark 可以读，事件系统也能记录。

**理由**

这是最简单、最稳、最低心智负担的方案。

**替代方案**

* 用注释节点 / hidden span：更脆弱。
* 完全离 DOM 的 WeakMap registry：更隐蔽，但调试不方便，导出也不方便。

我会采用 **双轨** ：DOM 上有 `data-*`，运行时也有 registry，二者互相校验。

---

### 13. App 资源组织

**方案**

借鉴 Android `res/`，但不用 XML，改成 TS-first：

<pre class="overflow-visible! px-0!" data-start="9995" data-end="10149"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>src/shared/res/</span><br/><span>  colors.ts</span><br/><span>  typography.ts</span><br/><span>  spacing.ts</span><br/><span>  icons/</span><br/><span>  strings/zh-CN.ts</span><br/><br/><span>src/apps/wechat/res/</span><br/><span>  strings.ts</span><br/><span>  icons.tsx</span><br/><span>  theme.ts</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

规则：

* 设计 token 放 shared
* App 品牌资源放 app/res
* 字符串走 key，不在组件里写死
* Tailwind theme 只接设计 token，不接业务常量

**理由**

这样既有 Android 的组织感，又保留 TS 类型能力。

**替代方案**

* 所有资源散在组件旁边：初期快，后期一致性差。
* 完全中央化：第三方 App 品牌差异难表达。

---

## 四、系统服务设计

### 14. 系统服务架构

**方案**

每个系统服务都实现统一接口，再放入 `ServiceRegistry`：

<pre class="overflow-visible! px-0!" data-start="10432" data-end="10716"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">interface</span><span></span><span class="ͼm">ServiceManifest</span><span><</span><span class="ͼm">TState</span><span>> {</span><br/><span>  id: </span><span class="ͼm">string</span><span>;</span><br/><span>  initialState(</span><span class="ͼm">seed</span><span>?: </span><span class="ͼm">unknown</span><span>): </span><span class="ͼm">TState</span><span>;</span><br/><span>  commands: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">RuntimeContext</span><span>) => </span><span class="ͼm">Record</span><span><</span><span class="ͼm">string</span><span>, (...</span><span class="ͼm">args</span><span>: </span><span class="ͼm">any</span><span>[]) => </span><span class="ͼg">void</span><span>>;</span><br/><span>  selectors: </span><span class="ͼm">Record</span><span><</span><span class="ͼm">string</span><span>, </span><span class="ͼm">Function</span><span>>;</span><br/><span>  reset?: () => </span><span class="ͼg">void</span><span>;</span><br/><span>  start?: () => </span><span class="ͼg">void</span><span>;</span><br/><span>  stop?: () => </span><span class="ͼg">void</span><span>;</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

服务状态都挂在 `services.*` 下，运行时副作用不放进 store。

**理由**

这样 WiFi、位置、通知、电池、键盘都遵守同一生命周期：注册、访问、重置、持久化。

**替代方案**

* 每个服务一个 React Context：读起来方便，但对 benchmark API 很差。
* 一个巨型 `systemService` 对象：最省事，但会越来越难维护。

---

### 15. 时间控制

**方案**

引入 `SimClock`，区分两类时间：

* **模拟墙钟时间** ：给业务和显示用
* **真实单调时间** ：给动画、防抖、节流用

状态：

<pre class="overflow-visible! px-0!" data-start="11013" data-end="11120"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼo">clock</span><span>: {</span><br/><span></span><span class="ͼo">epochMs</span><span>: </span><span class="ͼm">number</span><span>;</span><br/><span></span><span class="ͼo">timezone</span><span>: </span><span class="ͼm">string</span><span>;</span><br/><span></span><span class="ͼo">speed</span><span>: </span><span class="ͼm">number</span><span>;   </span><span class="ͼe">// 1x / frozen / accelerated</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

App 禁止直接用裸 `Date.now()`；统一走 `clock.now()` / `useNow()`。

必要时可在 simulator 内部包装 `Date`，但 **不改 setTimeout / requestAnimationFrame** 。

**理由**

“明天”“本周”“昨天 18:00”这类任务必须由 benchmark 精确控制。

同时动画和输入体验不能被冻住。

**替代方案**

* 全局 mock Date：强，但可能误伤依赖 Date 的第三方库。
* 完全不控时间：任务判定会漂。

---

### 16. 环境变量注入

**方案**

把位置、网络、SIM、设备信息统一建模到 `env` / `device` / `services.connectivity`，只允许 benchmark 通过控制 API 注入：

* `setEnv(patch)`
* `setDevice(patch)`
* `reset({ env, services, apps })`

App 一律通过 selector 读取，不读自定义副本。

**理由**

所有 App 看到的是同一份环境，不会出现天气 App 和地图 App 对当前位置理解不同。

**替代方案**

* 每个 App 自己存环境：最不一致。
* 全局常量写死：没法做 benchmark 注入。

---

## 五、与外部 benchmark 框架的接口

### 17. API 设计

**方案**

明确分成两组。

 **A. Simulator Control API** ：给 benchmark orchestration 用

挂到 `window.__SIM__`

<pre class="overflow-visible! px-0!" data-start="11873" data-end="12318"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">interface</span><span></span><span class="ͼm">SimulatorControlAPI</span><span> {</span><br/><span>  ready(): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  getState(): </span><span class="ͼm">SimulatorSnapshot</span><span>;</span><br/><span>  reset(</span><span class="ͼm">recipe</span><span>?: </span><span class="ͼm">ResetRecipe</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼm">SimulatorSnapshot</span><span>>;</span><br/><span>  setState(</span><span class="ͼm">patch</span><span>: </span><span class="ͼm">DeepPartial</span><span><</span><span class="ͼm">SimulatorSnapshot</span><span>>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  setEnv(</span><span class="ͼm">patch</span><span>: </span><span class="ͼm">DeepPartial</span><span><</span><span class="ͼm">EnvState</span><span>>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  setTime(</span><span class="ͼm">patch</span><span>: </span><span class="ͼm">Partial</span><span><</span><span class="ͼm">ClockState</span><span>>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  flushPersist(): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  getTrace(): </span><span class="ͼm">TraceEvent</span><span>[];</span><br/><span>  getVisibleSemantics(): </span><span class="ͼm">VisibleSemanticNode</span><span>[];</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

 **B. Agent Action API** ：给 oracle / 合成数据 / 调试用

挂到 `window.__SIM_AGENT__`

<pre class="overflow-visible! px-0!" data-start="12395" data-end="12657"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">interface</span><span></span><span class="ͼm">AgentActionAPI</span><span> {</span><br/><span>  tap(</span><span class="ͼm">x</span><span>: </span><span class="ͼm">number</span><span>, </span><span class="ͼm">y</span><span>: </span><span class="ͼm">number</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  swipe(</span><span class="ͼm">points</span><span>: {x: </span><span class="ͼm">number</span><span>; y: </span><span class="ͼm">number</span><span>}[], </span><span class="ͼm">durationMs</span><span>?: </span><span class="ͼm">number</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  inputText(</span><span class="ͼm">text</span><span>: </span><span class="ͼm">string</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  pressKey(</span><span class="ͼm">key</span><span>: </span><span class="ͼk">'back'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'home'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'enter'</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

正式评估时，视觉 Agent 仍然走 Playwright 的真实点击与输入；`__SIM_AGENT__` 只是辅助通道。

**理由**

控制 API 和动作 API 混在一起，很容易破坏“纯视觉评估”的边界。

---

### 18. 状态快照格式

**方案**

版本化 JSON，根结构固定，App 子树动态扩展：

<pre class="overflow-visible! px-0!" data-start="12827" data-end="13152"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">SimulatorSnapshot</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  schemaVersion: </span><span class="ͼm">number</span><span>;</span><br/><span>  instanceId: </span><span class="ͼm">string</span><span>;</span><br/><span>  clock: </span><span class="ͼm">ClockState</span><span>;</span><br/><span>  device: </span><span class="ͼm">DeviceState</span><span>;</span><br/><span>  env: </span><span class="ͼm">EnvState</span><span>;</span><br/><span>  services: </span><span class="ͼm">Record</span><span><</span><span class="ͼm">string</span><span>, </span><span class="ͼm">unknown</span><span>>;</span><br/><span>  system: </span><span class="ͼm">SystemState</span><span>;</span><br/><span>  apps: </span><span class="ͼm">Record</span><span><</span><span class="ͼm">string</span><span>, { data: </span><span class="ͼm">unknown</span><span>; ui: </span><span class="ͼm">unknown</span><span> }>;</span><br/><span>  meta: {</span><br/><span>    buildId: </span><span class="ͼm">string</span><span>;</span><br/><span>    sessionEpoch: </span><span class="ͼm">number</span><span>;</span><br/><span>  };</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

新增 App 不需要改公共 `getState` 逻辑，因为：

* App registry 在启动时把自己的 state slice 挂到 `apps[appId]`
* `getState()` 只返回 root store 的序列化快照
* App 自己负责 schema / migration / validation

**理由**

公共逻辑只关心“遍历 registry + 返回 root state”，不关心 App 细节。

**替代方案**

* `getState()` 手写拼对象：每加 App 都得改，肯定烂尾。

---

## 六、与真实 Android 的对齐

### 19. 对齐策略

**方案**

判断标准只有一个：**凡是影响用户可见行为、任务成败、轨迹合法性的 Android 机制，尽量对齐；否则简化。**

值得对齐的：

* Activity / Task 栈
* Intent / ActivityResult
* Back 行为
* 通知、状态栏、输入法、系统设置
* 前后台切换的用户可见语义

可以简化的：

* 进程模型
* Binder / Service 生命周期细节
* Fragment
* 权限细枝末节
* 真正的 Android 资源系统 / XML / PackageManager 全貌

**理由**

目标不是“做 Android”，而是“做一个训练 GUI Agent 的、足够像 Android 的环境”。

---

### 20. 数据模型对齐

**方案**

采用 **混合对齐** ：

* 名称上借用 Android 概念：`activityManager`, `notification`, `settings`, `clipboard`
* 结构上按模拟器需求分组：`device / env / services / system / apps`

**理由**

完全照 Android 内部分类会让 snapshot 很碎，不利于 benchmark。

完全自定义又会丢失开发者熟悉的语义。

**替代方案**

* 严格 Android 化：学习成本低，但实现负担大、快照不友好。
* 完全自定义：工程上简洁，但跨团队沟通成本高。

---

### 21. 系统应用 vs 第三方应用

**方案**

 **物理分离，接口统一** ：

<pre class="overflow-visible! px-0!" data-start="14182" data-end="14281"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>src/system-apps/</span><br/><span>  settings/</span><br/><span>  contacts/</span><br/><span>  sms/</span><br/><br/><span>src/apps/</span><br/><span>  wechat/</span><br/><span>  alipay/</span><br/><span>  12306/</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

两者都实现同一个 `AppManifest`，但 system app 可以声明更高权限 capability，例如：

* 访问更多系统服务
* 修改 launcher 布局
* 写系统设置

**理由**

结构上体现差异，运行时仍统一管理。

**替代方案**

* 全放一起：最省目录，但系统耦合差异会被隐藏。
* 完全两套框架：没必要，会破坏一致开发体验。

---

## 七、可扩展性与开发体验

### 22. 新增 App 的成本

**方案**

新增一个 App，理想流程是：

1. 新建 `src/apps/meituan/`
2. 写 `manifest.ts`
3. 写 `state.schema.ts`
4. 写 `nav.graph.ts`
5. 写 `fixtures/default.user.json`
6. 写 `screens/*`
7. 写 `res/*`

 **必须修改的中心文件数：0** 。

Launcher 是否显示、intent 是否可被发现，都来自 manifest。

**理由**

这是 auto-discovery 架构最直接的收益。

---

### 23. 并行运行 64 个实例

**主要瓶颈**

* 隐藏但未卸载的 React 树占内存
* 全量状态频繁持久化
* 大列表和图片资源
* 全局订阅导致无关重渲染
* localStorage 阻塞
* 开发模式额外开销

**优化方案**

* 后台 activity 默认卸载
* Zustand vanilla store + selector 订阅
* App 代码分包懒加载
* IndexedDB，按实例 key 隔离
* 只持久化 canonical state，不持久化 derived cache
* 长列表虚拟化
* 系统层少用 Context，多用精细 selector
* benchmark 运行时禁用 devtools / debug overlay
* 静态资源强缓存

**理由**

64 tab 更像服务端压测思路，不适合“一个页面里什么都挂着”。

---

### 24. 类型安全

**方案**

三层类型保障：

**A. TypeScript 编译期**

* `AppManifest<Id, State, Routes, Intents>`
* `Route params` 强类型
* `Intent payload/result` 判别联合
* `window.__SIM__` 全局声明

**B. Zod 运行时校验**

* App state schema
* reset payload schema
* snapshot schema
* intent payload/result schema

**C. 跨语言 schema 输出**

* 从 zod 生成 JSON Schema
* Python benchmark 用同一 schema 校验输入输出

**理由**

这个系统跨层通信很多，只靠 TS 不够；只靠运行时校验也太晚。

**替代方案**

* 只用 TS：Python 那边接不住。
* 只用 JSON Schema：前端开发体验差。

---

# 3) 最难的 3 个设计决策

## 决策一：后台 App 到底“隐藏”还是“卸载”

这是最关键的工程取舍。

隐藏更像网页心智，恢复也简单；卸载更像“把 UI 当作状态的函数”，对 benchmark 更友好。

我最终选“ **运行时存在，View 默认卸载** ”，因为 benchmark 真正需要的是：

* 刷新后仍能恢复
* reset 无残留
* 64 实例能跑
* 后台不偷偷执行 effect

这四条比“少写一点 UI 状态同步代码”更重要。

---

## 决策二：要不要用 React Router

React Router 对普通前端很自然，但这里有三层栈：

* 浏览器历史
* App 内页面栈
* 系统级 Activity/Task 栈

三层一旦混在一起，返回键语义会很难收敛。

所以我宁可放弃现成 router 的便利，改用 **自定义 typed route stack** 。

代价是要自己写一层轻量导航框架；收益是 back、跨 App、snapshot、枚举图都统一了。

---

## 决策三：Android 要拟真到什么程度

如果追求过度拟真，会把项目拖向“重写一套 Android”。

如果过度简化，又会让 Agent 学到不真实的交互规律。

我采用的边界是： **只拟真用户可见语义和任务判断语义** 。

也就是拟真 Activity、Intent、通知、状态栏、返回、输入法；不拟真 Binder、进程、XML 资源系统、PackageManager 全貌。

这是最能控制成本、同时保住 benchmark 价值的平衡点。

---

# 4) 一个具体 App 的骨架代码

下面用一个简化版 `wechat` 展示目录、状态、路由、语义标记如何协作。

## 目录结构

<pre class="overflow-visible! px-0!" data-start="16446" data-end="17105"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>src/</span><br/><span>  kernel/</span><br/><span>    registry/</span><br/><span>      defineApp.ts</span><br/><span>      loadRegistry.ts</span><br/><span>    runtime/</span><br/><span>      activity.ts</span><br/><span>      intent.ts</span><br/><span>      back.ts</span><br/><span>      bridge.ts</span><br/><span>      semantic.ts</span><br/><span>    store/</span><br/><span>      createStore.ts</span><br/><span>      snapshot.ts</span><br/><span>    services/</span><br/><span>      clock/</span><br/><span>      connectivity/</span><br/><span>      notification/</span><br/><span>  shared/</span><br/><span>    ui/</span><br/><span>      SemanticButton.tsx</span><br/><span>    res/</span><br/><span>      colors.ts</span><br/><span>      typography.ts</span><br/><span>  apps/</span><br/><span>    wechat/</span><br/><span>      manifest.ts</span><br/><span>      state.schema.ts</span><br/><span>      nav.graph.ts</span><br/><span>      intents.ts</span><br/><span>      fixtures/</span><br/><span>        default.user.json</span><br/><span>      res/</span><br/><span>        strings.ts</span><br/><span>        icons.tsx</span><br/><span>      screens/</span><br/><span>        ChatListScreen.tsx</span><br/><span>        ChatThreadScreen.tsx</span><br/><span>      WechatRoot.tsx</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## `apps/wechat/state.schema.ts`

<pre class="overflow-visible! px-0!" data-start="17146" data-end="18024"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">import</span><span> { </span><span class="ͼm">z</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'zod'</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">messageSchema</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>  id: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>  senderId: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>  text: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>  sentAt: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>number(),</span><br/><span>});</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">chatSchema</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>  id: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>  title: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>  participantIds: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>array(</span><span class="ͼm">z</span><span class="ͼg">.</span><span>string()),</span><br/><span>  messages: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>array(</span><span class="ͼm">messageSchema</span><span>),</span><br/><span>  unreadCount: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>number(),</span><br/><span>});</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">wechatStateSchema</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>  data: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>    contacts: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>record(</span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>      id: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>      name: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>    })),</span><br/><span>    chats: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>record(</span><span class="ͼm">chatSchema</span><span>),</span><br/><span>  }),</span><br/><span>  ui: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>    draftsByChatId: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>record(</span><span class="ͼm">z</span><span class="ͼg">.</span><span>string()),</span><br/><span>    scroll: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>      chatList: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>number()</span><span class="ͼg">.</span><span>default(</span><span class="ͼj">0</span><span>),</span><br/><span>      threadByChatId: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>record(</span><span class="ͼm">z</span><span class="ͼg">.</span><span>number()),</span><br/><span>    }),</span><br/><span>    modal: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>union([</span><br/><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span>null(),</span><br/><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({ type: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>literal(</span><span class="ͼk">'addFriend'</span><span>) }),</span><br/><span>    ]),</span><br/><span>  }),</span><br/><span>});</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">type</span><span></span><span class="ͼm">WechatState</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span class="ͼm">infer</span><span><</span><span class="ͼg">typeof</span><span></span><span class="ͼm">wechatStateSchema</span><span>>;</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## `apps/wechat/nav.graph.ts`

<pre class="overflow-visible! px-0!" data-start="18062" data-end="19312"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">import</span><span> { </span><span class="ͼm">z</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'zod'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">defineNavGraph</span><span>, </span><span class="ͼm">route</span><span>, </span><span class="ͼm">edge</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/kernel/registry/defineApp'</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">wechatNavGraph</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">defineNavGraph</span><span>({</span><br/><span>  chatList: </span><span class="ͼm">route</span><span>({</span><br/><span>    params: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({}),</span><br/><span>    enumerate: () => [{ params: {} }],</span><br/><span>    edges: [</span><br/><span></span><span class="ͼm">edge</span><span>({</span><br/><span>        id: </span><span class="ͼk">'wechat.openChat'</span><span>,</span><br/><span>        to: </span><span class="ͼk">'chatThread'</span><span>,</span><br/><span>        params: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({ chatId: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string() }),</span><br/><span>        guard: (</span><span class="ͼm">root</span><span>, </span><span class="ͼm">payload</span><span>) => </span><span class="ͼm">Boolean</span><span>(</span><span class="ͼm">root</span><span class="ͼg">.</span><span>apps</span><span class="ͼg">.</span><span>wechat</span><span class="ͼg">.</span><span>data</span><span class="ͼg">.</span><span>chats[</span><span class="ͼm">payload</span><span class="ͼg">.</span><span>chatId]),</span><br/><span>        effects: [</span><br/><span></span><span class="ͼk">'apps.wechat.ui.route'</span><span>,</span><br/><span></span><span class="ͼk">'apps.wechat.data.chats[*].unreadCount'</span><span>,</span><br/><span>        ],</span><br/><span>      }),</span><br/><span>    ],</span><br/><span>  }),</span><br/><br/><span>  chatThread: </span><span class="ͼm">route</span><span>({</span><br/><span>    params: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>      chatId: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>    }),</span><br/><span>    enumerate: (</span><span class="ͼm">root</span><span>) =></span><br/><span></span><span class="ͼm">Object</span><span class="ͼg">.</span><span>keys(</span><span class="ͼm">root</span><span class="ͼg">.</span><span>apps</span><span class="ͼg">.</span><span>wechat</span><span class="ͼg">.</span><span>data</span><span class="ͼg">.</span><span>chats)</span><span class="ͼg">.</span><span>map((</span><span class="ͼm">chatId</span><span>) => ({</span><br/><span>        params: { chatId },</span><br/><span>      })),</span><br/><span>    edges: [</span><br/><span></span><span class="ͼm">edge</span><span>({</span><br/><span>        id: </span><span class="ͼk">'wechat.sendMessage'</span><span>,</span><br/><span>        kind: </span><span class="ͼk">'state-only'</span><span>,</span><br/><span>        guard: (</span><span class="ͼm">_</span><span>, </span><span class="ͼm">payload</span><span>) => </span><span class="ͼm">payload</span><span class="ͼg">.</span><span>text</span><span class="ͼg">.</span><span>trim()</span><span class="ͼg">.</span><span>length </span><span class="ͼg">></span><span></span><span class="ͼj">0</span><span>,</span><br/><span>        effects: [</span><br/><span></span><span class="ͼk">'apps.wechat.data.chats[*].messages'</span><span>,</span><br/><span></span><span class="ͼk">'apps.wechat.ui.draftsByChatId'</span><span>,</span><br/><span>        ],</span><br/><span>      }),</span><br/><span></span><span class="ͼm">edge</span><span>({</span><br/><span>        id: </span><span class="ͼk">'wechat.backToList'</span><span>,</span><br/><span>        kind: </span><span class="ͼk">'pop'</span><span>,</span><br/><span>        effects: [</span><span class="ͼk">'system.tasks[*].activities[*].routeStack'</span><span>],</span><br/><span>      }),</span><br/><span>    ],</span><br/><span>  }),</span><br/><span>});</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## `apps/wechat/manifest.ts`

<pre class="overflow-visible! px-0!" data-start="19349" data-end="20361"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">import</span><span> { </span><span class="ͼm">defineApp</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/kernel/registry/defineApp'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">wechatStateSchema</span><span>, </span><span class="ͼg">type</span><span></span><span class="ͼm">WechatState</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'./state.schema'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">wechatNavGraph</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'./nav.graph'</span><span>;</span><br/><span class="ͼg">import</span><span></span><span class="ͼm">defaultUser</span><span></span><span class="ͼg">from</span><span></span><span class="ͼk">'./fixtures/default.user.json'</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">wechatApp</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">defineApp</span><span>({</span><br/><span>  id: </span><span class="ͼk">'wechat'</span><span>,</span><br/><span>  kind: </span><span class="ͼk">'third-party'</span><span>,</span><br/><span>  launcherEntry: {</span><br/><span>    label: </span><span class="ͼk">'微信'</span><span>,</span><br/><span>    icon: </span><span class="ͼk">'wechat'</span><span>,</span><br/><span>  },</span><br/><br/><span>  stateSchema: </span><span class="ͼm">wechatStateSchema</span><span>,</span><br/><br/><span>  initialState(</span><span class="ͼm">seed</span><span>?: </span><span class="ͼm">Partial</span><span><</span><span class="ͼm">WechatState</span><span>>): </span><span class="ͼm">WechatState</span><span> {</span><br/><span></span><span class="ͼg">return</span><span> {</span><br/><span>      data: {</span><br/><span>        contacts: </span><span class="ͼm">defaultUser</span><span class="ͼg">.</span><span>contacts,</span><br/><span>        chats: </span><span class="ͼm">defaultUser</span><span class="ͼg">.</span><span>chats,</span><br/><span>        ...</span><span class="ͼm">seed</span><span>?.data,</span><br/><span>      },</span><br/><span>      ui: {</span><br/><span>        draftsByChatId: {},</span><br/><span>        scroll: {</span><br/><span>          chatList: </span><span class="ͼj">0</span><span>,</span><br/><span>          threadByChatId: {},</span><br/><span>        },</span><br/><span>        modal: </span><span class="ͼj">null</span><span>,</span><br/><span>        ...</span><span class="ͼm">seed</span><span>?.ui,</span><br/><span>      },</span><br/><span>    };</span><br/><span>  },</span><br/><br/><span>  navGraph: </span><span class="ͼm">wechatNavGraph</span><span>,</span><br/><br/><span>  intentFilters: [</span><br/><span>    {</span><br/><span>      action: </span><span class="ͼk">'contact.pick'</span><span>,</span><br/><span>      activity: </span><span class="ͼk">'main'</span><span>,</span><br/><span>      resultSchema: {</span><br/><span>        type: </span><span class="ͼk">'object'</span><span>,</span><br/><span>      },</span><br/><span>    },</span><br/><span>  ],</span><br/><br/><span>  loadRoot: () => </span><span class="ͼg">import</span><span>(</span><span class="ͼk">'./WechatRoot'</span><span>),</span><br/><span>});</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## `shared/ui/SemanticButton.tsx`

<pre class="overflow-visible! px-0!" data-start="20403" data-end="21129"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">import</span><span></span><span class="ͼm">React</span><span></span><span class="ͼg">from</span><span></span><span class="ͼk">'react'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">useSemanticLogger</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/kernel/runtime/semantic'</span><span>;</span><br/><br/><span class="ͼg">type</span><span></span><span class="ͼm">Props</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">React</span><span class="ͼg">.</span><span class="ͼm">ButtonHTMLAttributes</span><span><</span><span class="ͼm">HTMLButtonElement</span><span>> </span><span class="ͼg">&</span><span> {</span><br/><span>  actionId: </span><span class="ͼm">string</span><span>;</span><br/><span>  targetRoute?: </span><span class="ͼm">string</span><span>;</span><br/><span>  effects?: </span><span class="ͼm">string</span><span>[];</span><br/><span>};</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">SemanticButton</span><span>({</span><br/><span>  actionId,</span><br/><span>  targetRoute,</span><br/><span>  effects </span><span class="ͼg">=</span><span> [],</span><br/><span>  onClick,</span><br/><span>  ...</span><span class="ͼm">rest</span><br/><span>}: </span><span class="ͼm">Props</span><span>) {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">log</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">useSemanticLogger</span><span>();</span><br/><br/><span></span><span class="ͼg">return</span><span> (</span><br/><span></span><span class="ͼo"><button</span><br/><span>      {...</span><span class="ͼm">rest</span><span>}</span><br/><span></span><span class="ͼn">data-sim-action</span><span class="ͼg">=</span><span>{</span><span class="ͼm">actionId</span><span>}</span><br/><span></span><span class="ͼn">data-sim-target-route</span><span class="ͼg">=</span><span>{</span><span class="ͼm">targetRoute</span><span>}</span><br/><span></span><span class="ͼn">data-sim-effects</span><span class="ͼg">=</span><span>{</span><span class="ͼm">effects</span><span class="ͼg">.</span><span>join(</span><span class="ͼk">','</span><span>)}</span><br/><span></span><span class="ͼn">onClick</span><span class="ͼg">=</span><span>{(</span><span class="ͼm">e</span><span>) => {</span><br/><span></span><span class="ͼm">log</span><span>({</span><br/><span>          actionId,</span><br/><span>          targetRoute,</span><br/><span>          effects,</span><br/><span>          ts: </span><span class="ͼm">performance</span><span class="ͼg">.</span><span>now(),</span><br/><span>        });</span><br/><span></span><span class="ͼm">onClick</span><span>?.(</span><span class="ͼm">e</span><span>);</span><br/><span>      }}</span><br/><span></span><span class="ͼo">/></span><br/><span>  );</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

这些 `data-*` 不会画到屏幕上，但 benchmark 能读，trace 系统也能采。

---

## `apps/wechat/screens/ChatListScreen.tsx`

<pre class="overflow-visible! px-0!" data-start="21230" data-end="22628"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">import</span><span> { </span><span class="ͼm">SemanticButton</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/shared/ui/SemanticButton'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">useAppSelector</span><span>, </span><span class="ͼm">useNav</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/kernel/store/createStore'</span><span>;</span><br/><br/><span class="ͼg">type</span><span></span><span class="ͼm">Props</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  activityId: </span><span class="ͼm">string</span><span>;</span><br/><span>};</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">default</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">ChatListScreen</span><span>({ activityId }: </span><span class="ͼm">Props</span><span>) {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">chats</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">useAppSelector</span><span>(</span><span class="ͼk">'wechat'</span><span>, (</span><span class="ͼm">s</span><span>) =></span><br/><span></span><span class="ͼm">Object</span><span class="ͼg">.</span><span>values(</span><span class="ͼm">s</span><span class="ͼg">.</span><span>data</span><span class="ͼg">.</span><span>chats)</span><span class="ͼg">.</span><span>sort((</span><span class="ͼm">a</span><span>, </span><span class="ͼm">b</span><span>) => {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">ta</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">a</span><span class="ͼg">.</span><span>messages</span><span class="ͼg">.</span><span>at(</span><span class="ͼg">-</span><span class="ͼj">1</span><span>)?.sentAt </span><span class="ͼg">??</span><span></span><span class="ͼj">0</span><span>;</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">tb</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">b</span><span class="ͼg">.</span><span>messages</span><span class="ͼg">.</span><span>at(</span><span class="ͼg">-</span><span class="ͼj">1</span><span>)?.sentAt </span><span class="ͼg">??</span><span></span><span class="ͼj">0</span><span>;</span><br/><span></span><span class="ͼg">return</span><span></span><span class="ͼm">tb</span><span></span><span class="ͼg">-</span><span></span><span class="ͼm">ta</span><span>;</span><br/><span>    })</span><br/><span>  );</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">nav</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">useNav</span><span>(</span><span class="ͼm">activityId</span><span>);</span><br/><br/><span></span><span class="ͼg">return</span><span> (</span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"h-full bg-white"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><header</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"px-4 py-3 text-lg font-semibold"</span><span class="ͼo">></span><span>微信</span><span class="ͼo"></header></span><br/><br/><span></span><span class="ͼo"><ul></span><br/><span>        {</span><span class="ͼm">chats</span><span class="ͼg">.</span><span>map((</span><span class="ͼm">chat</span><span>) => (</span><br/><span></span><span class="ͼo"><li</span><span></span><span class="ͼn">key</span><span class="ͼg">=</span><span>{</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>id} </span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"border-b"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><SemanticButton</span><br/><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"w-full px-4 py-3 text-left"</span><br/><span></span><span class="ͼn">actionId</span><span class="ͼg">=</span><span class="ͼk">"wechat.openChat"</span><br/><span></span><span class="ͼn">targetRoute</span><span class="ͼg">=</span><span class="ͼk">"chatThread"</span><br/><span></span><span class="ͼn">effects</span><span class="ͼg">=</span><span>{[</span><br/><span></span><span class="ͼk">'apps.wechat.ui.route'</span><span>,</span><br/><span></span><span class="ͼk">'apps.wechat.data.chats[*].unreadCount'</span><span>,</span><br/><span>              ]}</span><br/><span></span><span class="ͼn">onClick</span><span class="ͼg">=</span><span>{() => </span><span class="ͼm">nav</span><span class="ͼg">.</span><span>push(</span><span class="ͼk">'chatThread'</span><span>, { chatId: </span><span class="ͼm">chat</span><span class="ͼg">.</span><span>id })}</span><br/><span></span><span class="ͼo">></span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"font-medium"</span><span class="ͼo">></span><span>{</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>title}</span><span class="ͼo"></div></span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"truncate text-sm text-neutral-500"</span><span class="ͼo">></span><br/><span>                {</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>messages</span><span class="ͼg">.</span><span>at(</span><span class="ͼg">-</span><span class="ͼj">1</span><span>)?.text </span><span class="ͼg">??</span><span></span><span class="ͼk">''</span><span>}</span><br/><span></span><span class="ͼo"></div></span><br/><span></span><span class="ͼo"></SemanticButton></span><br/><span></span><span class="ͼo"></li></span><br/><span>        ))}</span><br/><span></span><span class="ͼo"></ul></span><br/><span></span><span class="ͼo"></div></span><br/><span>  );</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## `apps/wechat/screens/ChatThreadScreen.tsx`

<pre class="overflow-visible! px-0!" data-start="22682" data-end="24695"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">import</span><span> { </span><span class="ͼm">useAppSelector</span><span>, </span><span class="ͼm">useAppActions</span><span>, </span><span class="ͼm">useNav</span><span>, </span><span class="ͼm">useBackHandler</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/kernel/store/createStore'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">SemanticButton</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/shared/ui/SemanticButton'</span><span>;</span><br/><br/><span class="ͼg">type</span><span></span><span class="ͼm">Props</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  activityId: </span><span class="ͼm">string</span><span>;</span><br/><span>  chatId: </span><span class="ͼm">string</span><span>;</span><br/><span>};</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">default</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">ChatThreadScreen</span><span>({ activityId, chatId }: </span><span class="ͼm">Props</span><span>) {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">chat</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">useAppSelector</span><span>(</span><span class="ͼk">'wechat'</span><span>, (</span><span class="ͼm">s</span><span>) => </span><span class="ͼm">s</span><span class="ͼg">.</span><span>data</span><span class="ͼg">.</span><span>chats[</span><span class="ͼm">chatId</span><span>]);</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">draft</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">useAppSelector</span><span>(</span><span class="ͼk">'wechat'</span><span>, (</span><span class="ͼm">s</span><span>) => </span><span class="ͼm">s</span><span class="ͼg">.</span><span>ui</span><span class="ͼg">.</span><span>draftsByChatId[</span><span class="ͼm">chatId</span><span>] </span><span class="ͼg">??</span><span></span><span class="ͼk">''</span><span>);</span><br/><span></span><span class="ͼg">const</span><span> { setDraft, sendMessage } </span><span class="ͼg">=</span><span></span><span class="ͼm">useAppActions</span><span>(</span><span class="ͼk">'wechat'</span><span>);</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">nav</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">useNav</span><span>(</span><span class="ͼm">activityId</span><span>);</span><br/><br/><span></span><span class="ͼm">useBackHandler</span><span>({</span><br/><span>    scope: </span><span class="ͼk">'route'</span><span>,</span><br/><span>    priority: </span><span class="ͼj">100</span><span>,</span><br/><span>    enabled: </span><span class="ͼj">true</span><span>,</span><br/><span>    onBack: () => {</span><br/><span></span><span class="ͼm">nav</span><span class="ͼg">.</span><span>pop();</span><br/><span></span><span class="ͼg">return</span><span></span><span class="ͼk">'handled'</span><span>;</span><br/><span>    },</span><br/><span>  });</span><br/><br/><span></span><span class="ͼg">return</span><span> (</span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex h-full flex-col bg-neutral-100"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><header</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex items-center border-b bg-white px-3 py-2"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><SemanticButton</span><br/><span></span><span class="ͼn">actionId</span><span class="ͼg">=</span><span class="ͼk">"wechat.backToList"</span><br/><span></span><span class="ͼn">effects</span><span class="ͼg">=</span><span>{[</span><span class="ͼk">'system.tasks[*].activities[*].routeStack'</span><span>]}</span><br/><span></span><span class="ͼn">onClick</span><span class="ͼg">=</span><span>{() => </span><span class="ͼm">nav</span><span class="ͼg">.</span><span>pop()}</span><br/><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"mr-3"</span><br/><span></span><span class="ͼo">></span><br/><span>          返回</span><br/><span></span><span class="ͼo"></SemanticButton></span><br/><span></span><span class="ͼo"><span</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"font-medium"</span><span class="ͼo">></span><span>{</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>title}</span><span class="ͼo"></span></span><br/><span></span><span class="ͼo"></header></span><br/><br/><span></span><span class="ͼo"><main</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex-1 overflow-auto px-3 py-2"</span><span class="ͼo">></span><br/><span>        {</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>messages</span><span class="ͼg">.</span><span>map((</span><span class="ͼm">m</span><span>) => (</span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">key</span><span class="ͼg">=</span><span>{</span><span class="ͼm">m</span><span class="ͼg">.</span><span>id} </span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"mb-2 rounded-xl bg-white px-3 py-2"</span><span class="ͼo">></span><br/><span>            {</span><span class="ͼm">m</span><span class="ͼg">.</span><span>text}</span><br/><span></span><span class="ͼo"></div></span><br/><span>        ))}</span><br/><span></span><span class="ͼo"></main></span><br/><br/><span></span><span class="ͼo"><footer</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex gap-2 border-t bg-white p-3"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><input</span><br/><span></span><span class="ͼn">value</span><span class="ͼg">=</span><span>{</span><span class="ͼm">draft</span><span>}</span><br/><span></span><span class="ͼn">onChange</span><span class="ͼg">=</span><span>{(</span><span class="ͼm">e</span><span>) => </span><span class="ͼm">setDraft</span><span>(</span><span class="ͼm">chatId</span><span>, </span><span class="ͼm">e</span><span class="ͼg">.</span><span>target</span><span class="ͼg">.</span><span>value)}</span><br/><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex-1 rounded border px-3 py-2"</span><br/><span></span><span class="ͼo">/></span><br/><span></span><span class="ͼo"><SemanticButton</span><br/><span></span><span class="ͼn">actionId</span><span class="ͼg">=</span><span class="ͼk">"wechat.sendMessage"</span><br/><span></span><span class="ͼn">effects</span><span class="ͼg">=</span><span>{[</span><br/><span></span><span class="ͼk">'apps.wechat.data.chats[*].messages'</span><span>,</span><br/><span></span><span class="ͼk">'apps.wechat.ui.draftsByChatId'</span><span>,</span><br/><span>          ]}</span><br/><span></span><span class="ͼn">onClick</span><span class="ͼg">=</span><span>{() => </span><span class="ͼm">sendMessage</span><span>(</span><span class="ͼm">chatId</span><span>, </span><span class="ͼm">draft</span><span>)}</span><br/><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"rounded bg-green-600 px-4 py-2 text-white"</span><br/><span></span><span class="ͼo">></span><br/><span>          发送</span><br/><span></span><span class="ͼo"></SemanticButton></span><br/><span></span><span class="ͼo"></footer></span><br/><span></span><span class="ͼo"></div></span><br/><span>  );</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## `apps/wechat/WechatRoot.tsx`

<pre class="overflow-visible! px-0!" data-start="24735" data-end="25344"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">import</span><span></span><span class="ͼm">ChatListScreen</span><span></span><span class="ͼg">from</span><span></span><span class="ͼk">'./screens/ChatListScreen'</span><span>;</span><br/><span class="ͼg">import</span><span></span><span class="ͼm">ChatThreadScreen</span><span></span><span class="ͼg">from</span><span></span><span class="ͼk">'./screens/ChatThreadScreen'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">useCurrentRoute</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/kernel/store/createStore'</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">default</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">WechatRoot</span><span>({ activityId }: { activityId: </span><span class="ͼm">string</span><span> }) {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">route</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">useCurrentRoute</span><span>(</span><span class="ͼm">activityId</span><span>);</span><br/><br/><span></span><span class="ͼg">switch</span><span> (</span><span class="ͼm">route</span><span class="ͼg">.</span><span>name) {</span><br/><span></span><span class="ͼg">case</span><span></span><span class="ͼk">'chatList'</span><span>:</span><br/><span></span><span class="ͼg">return</span><span></span><span class="ͼo"><ChatListScreen</span><span></span><span class="ͼn">activityId</span><span class="ͼg">=</span><span>{</span><span class="ͼm">activityId</span><span>} </span><span class="ͼo">/></span><span>;</span><br/><br/><span></span><span class="ͼg">case</span><span></span><span class="ͼk">'chatThread'</span><span>:</span><br/><span></span><span class="ͼg">return</span><span> (</span><br/><span></span><span class="ͼo"><ChatThreadScreen</span><br/><span></span><span class="ͼn">activityId</span><span class="ͼg">=</span><span>{</span><span class="ͼm">activityId</span><span>}</span><br/><span></span><span class="ͼn">chatId</span><span class="ͼg">=</span><span>{</span><span class="ͼm">route</span><span class="ͼg">.</span><span>params</span><span class="ͼg">.</span><span>chatId}</span><br/><span></span><span class="ͼo">/></span><br/><span>      );</span><br/><br/><span></span><span class="ͼg">default</span><span>:</span><br/><span></span><span class="ͼg">return</span><span></span><span class="ͼj">null</span><span>;</span><br/><span>  }</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

这个骨架体现了四件事：

1. App 自己只关心自己的 state / screen / nav graph
2. route stack 在 activity 里，不在浏览器 history 里
3. semantic 标记和 UI 一起渲染，但不影响截图
4. back / send / openChat 都能被 runtime 和 benchmark 理解

---

# 5) 有意识做的简化 / 妥协

### 妥协一：不模拟 Android 进程与进程死亡

 **原因** ：对 GUI Agent 训练收益很低，实现成本很高。

 **何时该去掉** ：开始研究任务恢复、冷启动耗时、进程被系统杀死后的状态恢复时。

### 妥协二：不用 React Router / Browser History

 **原因** ：为了统一系统 back 和 activity 栈。

 **何时该去掉** ：几乎不建议去掉；除非目标从“模拟手机 OS”变成“做普通网页容器”。

### 妥协三：默认后台卸载 View

 **原因** ：为了 reset、persist、64 实例并行。

 **何时该去掉** ：如果未来要模拟复杂后台媒体播放、地图连续动画、视频通话之类场景，可对特定 activity 开 `keepAlive`。

### 妥协四：资源系统只是“像 Android”，不是 Android XML

 **原因** ：TS-first 更适合当前前端栈。

 **何时该去掉** ：如果团队有大量 Android 开发者，希望资源迁移更贴近原生项目时。

### 妥协五：时间控制通过 SimClock，不完全全局替换 JS 时间语义

 **原因** ：避免伤害动画和第三方库。

 **何时该去掉** ：如果所有 App 都完全内建、可控，可以进一步收紧到全局 `Date` 包装。

### 妥协六：导航可枚举依赖“声明式图 + 局部枚举器”，不追求自动穷举整个 DOM 状态空间

 **原因** ：全自动穷举会组合爆炸。

 **何时该去掉** ：当你要做更系统的任务生成器，且已经有足够强的状态抽象与剪枝策略时。

---

# 收束建议

如果现在就要落地，我会先实现三件核心基建，再接第一个 App：

1. **canonical store + snapshot/reset/persist**
2. **activity/task/intent/back 四件套**
3. **manifest registry + semantic marker**

这三件一旦定住，后面的 20-30 个 App 基本就是沿同一模板铺开，而不会把系统层越做越乱。
