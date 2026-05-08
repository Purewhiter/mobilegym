下面给出一套以**可重置、可判定、可扩展、对纯视觉 Agent 严格隔离**为目标的架构方案。整体上，我建议把它做成一个“ **Android 概念对齐，但实现上显式可控** ”的前端运行时，而不是把 React 应用直接拼成一个大页面。

---

# 1. 整体架构图

## 1.1 分层图

<pre class="overflow-visible! px-0!" data-start="148" data-end="3445"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>┌──────────────────── Browser Tab / 一个模拟器实例 ────────────────────┐</span><br/><span>│                                                                    │</span><br/><span>│  Playwright / Python Benchmark                                     │</span><br/><span>│      │  截图 / 点击 / 滑动 / 输入                                  │</span><br/><span>│      ▼                                                             │</span><br/><span>│  ┌──────────────── External Bridge ────────────────┐               │</span><br/><span>│  │ window.__SIM__.control                          │               │</span><br/><span>│  │ - reset / getState / setState / setEnv         │               │</span><br/><span>│  │ - setSimTime / advanceSimTime / waitForIdle    │               │</span><br/><span>│  │ window.__SIM__.input (仅低层手势，可选)         │               │</span><br/><span>│  └─────────────────────────────────────────────────┘               │</span><br/><span>│                     │                                              │</span><br/><span>│                     ▼                                              │</span><br/><span>│  ┌──────────────── Simulator Kernel ───────────────┐               │</span><br/><span>│  │ ActivityTaskManager                             │               │</span><br/><span>│  │ IntentRouter / ActivityResult                   │               │</span><br/><span>│  │ BackDispatcher                                  │               │</span><br/><span>│  │ ServiceRegistry                                 │               │</span><br/><span>│  │ ResetEngine / PersistenceEngine                 │               │</span><br/><span>│  │ SimClock / Environment                          │               │</span><br/><span>│  └─────────────────────────────────────────────────┘               │</span><br/><span>│                     │ 读写唯一 canonical store                     │</span><br/><span>│                     ▼                                              │</span><br/><span>│  ┌──────────────── Serializable Snapshot Store ────┐               │</span><br/><span>│  │ meta                                            │               │</span><br/><span>│  │ system    (桌面/状态栏/通知/系统 UI)            │               │</span><br/><span>│  │ services  (wifi/电池/位置/时间/剪贴板/IME...)   │               │</span><br/><span>│  │ runtime   (task/activity/back/overlay/focus)    │               │</span><br/><span>│  │ apps      ({[appId]: {data, ui, version}})      │               │</span><br/><span>│  └─────────────────────────────────────────────────┘               │</span><br/><span>│                     ▲                                              │</span><br/><span>│                     │ selectors / actions                          │</span><br/><span>│                     ▼                                              │</span><br/><span>│  ┌───────────────── System Shell ─────────────────┐                │</span><br/><span>│  │ PhoneFrame / StatusBar / Launcher / NavBar     │                │</span><br/><span>│  │ NotificationShade / Keyboard / Global Overlays │                │</span><br/><span>│  └────────────────────────────────────────────────┘                │</span><br/><span>│                     ▲                                              │</span><br/><span>│                     │ host foreground activity                     │</span><br/><span>│                     ▼                                              │</span><br/><span>│  ┌──────────────── App Runtime / Registry ────────┐                │</span><br/><span>│  │ import.meta.glob() 自动发现 AppDefinition      │                │</span><br/><span>│  │ 每个 App: manifest / routes / state / intents  │                │</span><br/><span>│  │          semantics / resources / screens       │                │</span><br/><span>│  └────────────────────────────────────────────────┘                │</span><br/><span>│                                                                    │</span><br/><span>└────────────────────────────────────────────────────────────────────┘</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

## 1.2 数据流

<pre class="overflow-visible! px-0!" data-start="3459" data-end="3859"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>用户手势 / Playwright动作</span><br/><span>  → Shell命中测试</span><br/><span>  → BackDispatcher / GestureDispatcher</span><br/><span>  → App route action / Service command / Intent</span><br/><span>  → Store更新</span><br/><span>  → React重渲染</span><br/><span>  → PersistenceEngine异步落盘</span><br/><br/><span>Benchmark reset</span><br/><span>  → ResetEngine 组合默认快照 + 场景覆盖</span><br/><span>  → 校验 schema</span><br/><span>  → 原子替换整个 store</span><br/><span>  → bump resetEpoch 强制 remount</span><br/><span>  → UI进入指定初始态</span><br/><br/><span>Benchmark getState</span><br/><span>  → Registry 遍历 services/apps</span><br/><span>  → serialize()</span><br/><span>  → 返回统一 versioned snapshot</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

## 1.3 核心原则

1. **所有任务相关状态必须可序列化** ，只有很小的渲染微状态允许留在组件本地。
2. **系统运行时与 App UI 解耦** ，路由、返回栈、跨 App 调用不依赖 React Router 隐式历史。
3. **App 不直接读写别的 App 状态** ，只能走 Intent / Service。
4. **Benchmark 控制 API 与 Agent 动作通道分离** ，不暴露“语义捷径”给 Agent。
5. **默认前台渲染、后台保状态但不保 DOM** ，为 64 实例并发留预算。

---

# 2. 每个问题的设计方案

---

## 一、系统架构

## 1）分层设计

**方案**

分成五层：

* **System Shell** ：手机外壳、状态栏、导航栏、通知栏、桌面、系统弹层、键盘。
* **Kernel/Runtime** ：Activity/Task 管理、Back 分发、Intent 路由、Service 注册、重置、持久化、时钟、环境注入。
* **Serializable Store** ：唯一状态源。
* **App Runtime/Registry** ：App 注册、发现、挂载、生命周期策略。
* **App Package** ：每个 App 自己的页面、资源、状态 schema、导航定义、语义标记。

**边界**

系统层负责“ **设备级行为和跨 App 行为** ”；App 层负责“ **本 App 的领域数据和页面逻辑** ”。

例如：

* 状态栏显示 WiFi：属于系统层 UI。
* WiFi 开关值：属于 ConnectivityService。
* 设置 App 改 WiFi：它只能调 service command，不能持有第二份 WiFi 状态。
* 支付宝付款页：属于 App。
* 12306 调起支付宝付款：属于 Kernel 的 Intent/Result。

**理由**

这样能保证“视觉 UI”、“系统语义”、“任务判定状态”三者一致，但不互相缠绕。

**替代方案**

把系统和 App 全部做成一个 React 路由树最省事，但返回键、跨 App、重置、状态快照都会很乱，后面一定反噬。

---

## 2）App 生命周期

**方案**

在运行时显式建模 Android 风格对象：

<pre class="overflow-visible! px-0!" data-start="4878" data-end="5233"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">TaskRecord</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  id: </span><span class="ͼm">TaskId</span><span>;</span><br/><span>  activityIds: </span><span class="ͼm">ActivityId</span><span>[];</span><br/><span>};</span><br/><br/><span class="ͼg">type</span><span></span><span class="ͼm">ActivityRecord</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  id: </span><span class="ͼm">ActivityId</span><span>;</span><br/><span>  appId: </span><span class="ͼm">AppId</span><span>;</span><br/><span>  activityType: </span><span class="ͼm">string</span><span>;</span><br/><span>  screenStack: </span><span class="ͼm">ScreenInstance</span><span>[];</span><br/><span>  state: </span><span class="ͼk">'foreground'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'background'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'destroyed'</span><span>;</span><br/><span>  resultTo?: { callerActivityId: </span><span class="ͼm">ActivityId</span><span>; requestId: </span><span class="ͼm">string</span><span> };</span><br/><span>  resumePolicy: </span><span class="ͼk">'recreate'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'keep-alive'</span><span>;</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

**挂载策略**

采用 **混合策略** ：

* 默认： **后台 Activity 组件卸载** ，但导航栈、草稿、滚动位置等可恢复状态存入 store。
* 少数复杂页面：可声明 `resumePolicy: 'keep-alive'`，后台只隐藏不卸载。

**理由**

这最适合 64 实例并发。

Android 本身也不是“后台永不销毁”，所以“逻辑状态保留、DOM 默认释放”反而更接近真实资源压力。

**替代方案与权衡**

* **全部隐藏不卸载** ：恢复体验最简单，但内存最差，64 tab 很容易爆。
* **全部卸载** ：性能最好，但开发者必须非常严格地把 UI 瞬态全部序列化，心智负担偏大。

  所以混合策略更稳。

---

## 3）App 注册与发现

**方案**

用 Vite 的 `import.meta.glob()` 自动发现 App 模块。每个 App 目录只需导出一个 `AppDefinition`。

<pre class="overflow-visible! px-0!" data-start="5668" data-end="5863"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">const</span><span></span><span class="ͼm">modules</span><span></span><span class="ͼg">=</span><span></span><span class="ͼg">import.</span><span>meta</span><span class="ͼg">.</span><span>glob(</span><span class="ͼk">'/src/apps/**/index.ts'</span><span>, { eager: </span><span class="ͼj">true</span><span> });</span><br/><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">appRegistry</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">Object</span><span class="ͼg">.</span><span>values(</span><span class="ͼm">modules</span><span>)</span><span class="ͼg">.</span><span>map(</span><br/><span></span><span class="ͼm">m</span><span> => (</span><span class="ͼm">m</span><span></span><span class="ͼg">as</span><span> { default: </span><span class="ͼm">AnyAppDefinition</span><span> })</span><span class="ͼg">.</span><span>default</span><br/><span>);</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

`AppDefinition` 至少包含：

* `id`
* `manifest`
* `stateSchema`
* `createDefaultState`
* `screens / navigation graph`
* `intentHandlers`
* `resources`

**理由**

新增 App 不需要改系统代码；系统只依赖注册表，不依赖具体 App 名字。

**替代方案**

* 手写 `apps/index.ts` 汇总表：简单，但每加一个 App 都要改核心文件。
* 后端拉配置：这个项目是单前端，不值得引入额外复杂度。

---

## 4）返回键

**方案**

做一个统一的  **BackDispatcher** ，类似 Android 的 `OnBackPressedDispatcher`。

任何需要拦截返回的实体都注册 handler，带优先级和作用域。

优先级建议：

1. 系统级模态层（IME、全局弹窗、通知下拉）
2. 前台 App 的顶层 overlay（Drawer、BottomSheet、Dialog）
3. 当前 screen 自己的 back handler
4. 当前 Activity 的 screen stack pop
5. TaskManager 决定 finish activity / 回到桌面

接口示意：

<pre class="overflow-visible! px-0!" data-start="6470" data-end="6654"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">BackHandler</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  id: </span><span class="ͼm">string</span><span>;</span><br/><span>  priority: </span><span class="ͼm">number</span><span>;</span><br/><span>  scope: </span><span class="ͼk">'system'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'overlay'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'screen'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'activity'</span><span>;</span><br/><span>  canHandle: () => </span><span class="ͼm">boolean</span><span>;</span><br/><span>  handle: () => </span><span class="ͼm">boolean</span><span>; </span><span class="ͼe">// 是否已消费</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

React hook：

<pre class="overflow-visible! px-0!" data-start="6669" data-end="6732"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">useBackHandler</span><span>({ priority: </span><span class="ͼj">300</span><span>, canHandle, handle });</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

**理由**

返回键本质是 **系统级控制流** ，不能依赖 DOM 冒泡或随意 `navigate(-1)`。

**替代方案**

* 用 React Router history back：只能覆盖“页面栈返回”，覆盖不了弹窗、键盘、跨 App 结果返回。
* 用全局事件总线广播：顺序和作用域不好控。

---

## 5）跨 App 通信

**方案**

做一个简化版 **Intent + ActivityResult** 模型。

<pre class="overflow-visible! px-0!" data-start="6960" data-end="7248"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">Intent</span><span></span><span class="ͼg">=</span><br/><span></span><span class="ͼg">|</span><span> {</span><br/><span>      action: </span><span class="ͼk">'PAY'</span><span>;</span><br/><span>      targetApp: </span><span class="ͼk">'alipay'</span><span>;</span><br/><span>      payload: { amount: </span><span class="ͼm">number</span><span>; orderId: </span><span class="ͼm">string</span><span> };</span><br/><span>      expectResult: </span><span class="ͼk">'payment'</span><span>;</span><br/><span>    }</span><br/><span></span><span class="ͼg">|</span><span> {</span><br/><span>      action: </span><span class="ͼk">'PICK_CONTACT'</span><span>;</span><br/><span>      targetApp: </span><span class="ͼk">'contacts'</span><span>;</span><br/><span>      payload: {};</span><br/><span>      expectResult: </span><span class="ͼk">'contact'</span><span>;</span><br/><span>    };</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

调用方式：

<pre class="overflow-visible! px-0!" data-start="7257" data-end="7332"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">kernel</span><span class="ͼg">.</span><span>startActivityForResult({</span><br/><span>  callerActivityId,</span><br/><span>  intent,</span><br/><span>});</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

结果返回：

<pre class="overflow-visible! px-0!" data-start="7341" data-end="7443"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">kernel</span><span class="ͼg">.</span><span>finishActivity(</span><span class="ͼm">activityId</span><span>, {</span><br/><span>  status: </span><span class="ͼk">'success'</span><span>,</span><br/><span>  data: { paymentId: </span><span class="ͼk">'p_001'</span><span> },</span><br/><span>});</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Kernel 负责：

* 新建目标 Activity
* 建立 `resultTo`
* 目标 Activity 完成时，把结果回填到调用者
* 调用者恢复到前台后消费结果

**理由**

这样才能表达“12306 → 支付宝 → 返回 12306”的调用链，而不是两个 App 直接共享状态。

**替代方案**

* App A 直接改 App B 状态：耦合过高。
* Promise 直接挂 JS 闭包：页面刷新或 reset 后不可靠。

  所以**持久化在 runtime state 里的 continuation token**更稳。

---

## 二、状态管理与数据流

## 6）状态分类

**方案**

用 **一个全局 store 作为唯一 canonical source** ，但按模块分层组织。

我会选  **Zustand vanilla + Immer + Zod** ：

<pre class="overflow-visible! px-0!" data-start="7856" data-end="8101"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">SimulatorSnapshot</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  meta: </span><span class="ͼm">MetaState</span><span>;</span><br/><span>  system: </span><span class="ͼm">SystemUiState</span><span>;</span><br/><span>  services: </span><span class="ͼm">ServiceStateMap</span><span>;</span><br/><span>  runtime: </span><span class="ͼm">RuntimeState</span><span>;</span><br/><span>  apps: {</span><br/><span>    [appId: </span><span class="ͼm">string</span><span>]: {</span><br/><span>      version: </span><span class="ͼm">number</span><span>;</span><br/><span>      data: </span><span class="ͼm">unknown</span><span>;</span><br/><span>      ui: </span><span class="ͼm">unknown</span><span>;</span><br/><span>    };</span><br/><span>  };</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

分类：

* `system`：桌面页、通知 shade 是否展开、状态栏样式、导航栏态
* `services`：wifi、电量、时间、位置、剪贴板、键盘、网络、SIM
* `runtime`：task/activity 栈、overlay 栈、焦点、输入法宿主、pending results
* `apps[appId].data`：用户/业务数据
* `apps[appId].ui`：可恢复 UI 瞬态（草稿、选中 tab、滚动位置、筛选器）

**理由**

外部 API 需要一次性读写全量状态，这天然要求单一 snapshot。

**替代方案**

* Redux Toolkit 也能做，但动态注册 App slice 和泛型推导会更重。
* 多 store / 多 context：组件开发舒服，但 reset/getState/setState 很难做到全局一致。

---

## 7）持久化

**方案**

只允许**PersistenceEngine** 一个地方落盘，存的是 **整个 snapshot** ，而不是组件各自持久化。

推荐  **IndexedDB** ，key 按实例隔离：

<pre class="overflow-visible! px-0!" data-start="8619" data-end="8662"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>simulator:<instanceId>:snapshot</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

策略：

* 启动时先 hydrate，再首屏渲染
* 普通更新：debounce 落盘
* `reset()` 后：立即落盘
* schema version + migration
* 支持 `persistenceMode: 'indexeddb' | 'memory'`

**理由**

WiFi、电量、位置这种状态只能有一份真值源，所有界面都从它读取。

不能让状态栏、快捷设置、设置 App 各自存一份。

**替代方案**

* `localStorage`：实现简单，但同步阻塞、容量小、64 tab 争用差。
* 每个 App 自己持久化：必然不一致。

---

## 8）状态重置

**方案**

`reset()` 不走“一堆 action 逐个派发”，而是：

1. 从 registry 收集所有 service/app 的默认状态
2. 与 benchmark 提供的 scenario override 深合并
3. 运行 schema 校验与 migration
4. **原子替换整个 store**
5. 清空异步任务、event log、pending continuation、通知调度
6. `resetEpoch++`，用 React `key` 强制 remount 全局宿主

<pre class="overflow-visible! px-0!" data-start="9234" data-end="9385"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">window</span><span class="ͼg">.</span><span>__SIM__</span><span class="ͼg">.</span><span>control</span><span class="ͼg">.</span><span>reset({</span><br/><span>  services: { clock: { now: </span><span class="ͼk">'2026-03-08T09:00:00+09:00'</span><span> } },</span><br/><span>  apps: { wechat: { data: </span><span class="ͼm">wechatFixtureA</span><span> } },</span><br/><span>});</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

**理由**

全量替换才能保证“不遗漏”。

只靠组件自己响应 reset 事件，很容易留下隐藏 local state。

**替代方案**

* 广播 `RESET` action 让各模块自清理：实现看似自然，但最容易漏边角。

---

## 9）默认数据管理

**方案**

把**App 固有结构**和**可替换用户数据**彻底分开：

* **固有结构** ：放 TS 代码里

  例如页面结构、Tab 定义、功能菜单、静态文案 key、导航图。

* **用户数据** ：放 JSON/TS fixture

  例如聊天记录、联系人、订单、余额、收货地址。

每个 App 导出：

* `stateSchema`
* `createDefaultData()`
* `fixtures/*.json`
* `scenarioPatchSchema`

目录示意：

<pre class="overflow-visible! px-0!" data-start="9786" data-end="9897"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>wechat/</span><br/><span>  manifest.ts</span><br/><span>  routes.ts</span><br/><span>  state.ts</span><br/><span>  fixtures/</span><br/><span>    default.json</span><br/><span>    benchmark-case-a.json</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

**理由**

任务生成和 benchmark 更关心“替换数据”，而不是改 App 的结构代码。

**替代方案**

把所有东西都塞进一个大 JSON。

这样虽然“配置化”很强，但页面行为、条件分支、复杂交互很快会退化成难维护的低配 DSL。

---

## 三、App 内部架构

## 10）路由设计

**方案**

 **不用 React Router 作为 App 内 canonical 导航** ，而是用 **自定义栈式 navigator** 。

每个 Activity 持有自己的 `screenStack`：

<pre class="overflow-visible! px-0!" data-start="10171" data-end="10275"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">ScreenInstance</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  screen: </span><span class="ͼm">string</span><span>;</span><br/><span>  params: </span><span class="ͼm">Record</span><span><</span><span class="ͼm">string</span><span>, </span><span class="ͼm">unknown</span><span>>;</span><br/><span>  key: </span><span class="ͼm">string</span><span>;</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

App 定义 `push / replace / pop / popTo` 等。

**理由**

因为系统层已经有 Activity/Task 栈，再叠一层 React Router 隐式 history，会出现两套历史系统并存。

而 benchmark 还需要枚举 screen 和 action，自定义 navigator 更可控。

**替代方案**

* React Router：开发体验熟，但更像 Web，不像 App。
* 每个 App 自己发明一套局部路由：系统难以统一 back/result 管理。

---

## 11）导航的形式化

**方案**

每个 App 用声明式 DSL 描述“screen + action + transition + effect summary”。

<pre class="overflow-visible! px-0!" data-start="10639" data-end="11062"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">ActionSpec</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  id: </span><span class="ͼm">string</span><span>;</span><br/><span>  kind: </span><span class="ͼk">'navigate'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'mutate'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'intent'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'submit'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'back'</span><span>;</span><br/><span>  target?: { screen: </span><span class="ͼm">string</span><span>; params?: </span><span class="ͼm">unknown</span><span> };</span><br/><span>  precondition?: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">AppCtx</span><span>) => </span><span class="ͼm">boolean</span><span>;</span><br/><span>  effectKeys?: </span><span class="ͼm">string</span><span>[]; </span><span class="ͼe">// 可能影响的 state 路径</span><br/><span>};</span><br/><br/><span class="ͼg">type</span><span></span><span class="ͼm">ScreenSpec</span><span><</span><span class="ͼm">P</span><span>> </span><span class="ͼg">=</span><span> {</span><br/><span>  id: </span><span class="ͼm">string</span><span>;</span><br/><span>  paramsSchema: </span><span class="ͼm">ZodSchema</span><span><</span><span class="ͼm">P</span><span>>;</span><br/><span>  enumerateActions: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">ScreenCtx</span><span><</span><span class="ͼm">P</span><span>>) => </span><span class="ͼm">ActionSpec</span><span>[];</span><br/><span>  stateFingerprint?: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">ScreenCtx</span><span><</span><span class="ͼm">P</span><span>>) => </span><span class="ͼm">string</span><span>;</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

其中：

* **静态层** ：有哪些 screen、有哪些 action 类型
* **动态层** ：在当前 state 下，能枚举出哪些具体 action

  例如聊天列表页会枚举出 `openChat(chat_1)`、`openChat(chat_2)` …

**理由**

这套定义能直接服务于：

* 自动任务生成
* 路径可达性分析
* 轨迹合理性校验
* 语义日志合成

**替代方案**

运行时扫 DOM 推断导航关系。

这对动态列表、条件按钮、虚拟滚动都很脆弱。

---

## 12）UI 语义标记

**方案**

在 DOM 上加 **不可见的 data attributes** ，只标识稳定 ID，不直接塞长语义文本。

详细语义在 JS registry 里查。

示例：

<pre class="overflow-visible! px-0!" data-start="11425" data-end="11551"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼo"><button</span><br/><span></span><span class="ͼn">data-sim-screen</span><span class="ͼg">=</span><span class="ͼk">"wechat/chatList"</span><br/><span></span><span class="ͼn">data-sim-action-id</span><span class="ͼg">=</span><span class="ͼk">"wechat.openChat"</span><br/><span></span><span class="ͼn">data-sim-node-key</span><span class="ͼg">=</span><span>{</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>id}</span><br/><span class="ͼo">/></span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

配套的 registry 中记录：

<pre class="overflow-visible! px-0!" data-start="11572" data-end="11671"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>{</span><br/><span></span><span class="ͼo">actionId</span><span>: </span><span class="ͼk">'wechat.openChat'</span><span>,</span><br/><span></span><span class="ͼm">kind</span><span>: </span><span class="ͼk">'navigate'</span><span>,</span><br/><span></span><span class="ͼm">target</span><span>: </span><span class="ͼk">'chat'</span><span>,</span><br/><span></span><span class="ͼm">effectKeys</span><span>: []</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

同时记录语义事件日志：

<pre class="overflow-visible! px-0!" data-start="11686" data-end="11763"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>{</span><br/><span></span><span class="ͼm">ts</span><span>,</span><br/><span></span><span class="ͼm">appId</span><span>,</span><br/><span></span><span class="ͼm">activityId</span><span>,</span><br/><span></span><span class="ͼm">screenId</span><span>,</span><br/><span></span><span class="ͼm">actionId</span><span>,</span><br/><span></span><span class="ͼm">nodeKey</span><span>,</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

**为什么不会出现在截图里**

DOM attribute 不会渲染为像素，因此纯视觉 Agent 看不到。

**理由**

这是最轻量、稳定、与 UI 绑定最紧的方案。

**替代方案**

* 用 aria-label：会污染无障碍语义，而且可能影响真实界面设计。
* 额外盖一个隐藏 overlay 树：维护两份结构，极易漂移。

---

## 13）App 资源组织

**方案**

借鉴 Android `res/` 的思想，但不照抄整个系统。

建议：

<pre class="overflow-visible! px-0!" data-start="12008" data-end="12071"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>res/</span><br/><span>  strings.ts</span><br/><span>  icons.tsx</span><br/><span>  images/</span><br/><span>  tokens.ts</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

再配一个全局共享的设计令牌层：

<pre class="overflow-visible! px-0!" data-start="12090" data-end="12170"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>src/theme/</span><br/><span>  colorTokens.ts</span><br/><span>  spacingTokens.ts</span><br/><span>  typographyTokens.ts</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

约定：

* **系统壳层**颜色、状态栏、导航栏尺寸走全局 token
* **App 品牌色和局部样式**走 app token
* 文案用 key 管理，便于后续做多语言

**理由**

多个 App 要有“都在同一台手机里”的统一感，但又不能做成一个公司风格的后台系统。

**替代方案**

* 全部共享一套组件/配色：一致性强，但 App 会失真。
* 完全自由发挥：后期维护和 UI 品质会散。

---

## 四、系统服务设计

## 14）系统服务架构

**方案**

每个系统能力是一个 **模块化 service** ，但它们的 state 统一挂在 `services` 下面。

不要做多个 React Context 作为 canonical source。

接口示意：

<pre class="overflow-visible! px-0!" data-start="12529" data-end="12816"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">interface</span><span></span><span class="ͼm">ServiceModule</span><span><</span><span class="ͼm">S</span><span>> {</span><br/><span>  id: </span><span class="ͼm">string</span><span>;</span><br/><span>  createDefaultState(): </span><span class="ͼm">S</span><span>;</span><br/><span>  actions: </span><span class="ͼm">Record</span><span><</span><span class="ͼm">string</span><span>, (...</span><span class="ͼm">args</span><span>: </span><span class="ͼm">any</span><span>[]) => </span><span class="ͼg">void</span><span>>;</span><br/><span>  selectors: </span><span class="ͼm">Record</span><span><</span><span class="ͼm">string</span><span>, (</span><span class="ͼm">root</span><span>: </span><span class="ͼm">SimulatorSnapshot</span><span>) => </span><span class="ͼm">any</span><span>>;</span><br/><span>  serialize?: (</span><span class="ͼm">s</span><span>: </span><span class="ͼm">S</span><span>) => </span><span class="ͼm">unknown</span><span>;</span><br/><span>  hydrate?: (</span><span class="ͼm">raw</span><span>: </span><span class="ͼm">unknown</span><span>) => </span><span class="ͼm">S</span><span>;</span><br/><span>  onReset?: () => </span><span class="ͼg">void</span><span>;</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

服务例子：

* `clock`
* `connectivity`
* `battery`
* `location`
* `clipboard`
* `ime`
* `notifications`
* `device`
* `telephony`

**理由**

“实现模块化、状态统一化”是最平衡的做法。

这样注册、访问、重置、快照都统一。

**替代方案**

* 一个超级大 `systemService` 对象：实现简单，但会变成巨型文件。
* 每个服务一个 Context：读取方便，但全量 reset/getState 很差。

---

## 15）时间控制

**方案**

引入 **双时钟** ：

1. **SimClock** ：任务语义时间

   给 App 显示日期、天气“今天/明天”、消息时间戳、闹钟、日历、通知调度使用。

1. **RealClock** ：真实运行时间

   给 CSS 动画、`requestAnimationFrame`、输入防抖、微交互过渡使用。

App 代码禁止直接 `Date.now()`，改用：

<pre class="overflow-visible! px-0!" data-start="13307" data-end="13347"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">useSimNow</span><span>()</span><br/><span class="ͼm">clockService</span><span class="ͼg">.</span><span>now()</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

对“未来发生的模拟事件”提供：

<pre class="overflow-visible! px-0!" data-start="13366" data-end="13417"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">scheduleAtSimTime</span><span>(...)</span><br/><span class="ͼm">advanceSimTime</span><span>(</span><span class="ͼm">ms</span><span>)</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

**理由**

用户看到的“今天/明天”必须可控；但动画和交互不该跟着冻结。

**替代方案**

* 全局 monkey patch `Date` 和 timer：看起来省事，但第三方库和渲染节奏很容易出问题。

---

## 16）环境变量注入

**方案**

做一个统一的 `EnvironmentService`，包含：

* 位置（经纬度、城市、时区）
* 网络（wifi/4g/无网）
* SIM 信息
* Locale/语言
* 设备参数
* 权限开关
* 深色模式等系统偏好

Benchmark 通过：

<pre class="overflow-visible! px-0!" data-start="13686" data-end="13812"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">window</span><span class="ͼg">.</span><span>__SIM__</span><span class="ͼg">.</span><span>control</span><span class="ͼg">.</span><span>setEnv({</span><br/><span>  location: { lat, lng, city: </span><span class="ͼk">'北京'</span><span> },</span><br/><span>  network: { online: </span><span class="ͼj">true</span><span>, type: </span><span class="ͼk">'wifi'</span><span> },</span><br/><span>});</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

或在 `reset()` 一次性注入。

**理由**

所有 App 都应从同一来源读取环境值，否则天气、地图、设置页会互相打架。

**替代方案**

prop drilling 或 App 自己读 URL/query 参数。

这只适合玩具项目。

---

## 五、与外部 benchmark 框架的接口

## 17）API 设计

**方案**

挂一个 versioned 的全局对象：

<pre class="overflow-visible! px-0!" data-start="14021" data-end="14984"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">interface</span><span></span><span class="ͼm">SimulatorApi</span><span> {</span><br/><span>  version: </span><span class="ͼm">string</span><span>;</span><br/><span>  control: {</span><br/><span>    reset(</span><span class="ͼm">input</span><span>?: </span><span class="ͼm">Partial</span><span><</span><span class="ͼm">SimulatorSnapshot</span><span>>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    getState(): </span><span class="ͼm">SimulatorSnapshot</span><span>;</span><br/><span>    replaceState(</span><span class="ͼm">next</span><span>: </span><span class="ͼm">SimulatorSnapshot</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    patchState(</span><span class="ͼm">patch</span><span>: </span><span class="ͼm">DeepPartial</span><span><</span><span class="ͼm">SimulatorSnapshot</span><span>>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    setEnv(</span><span class="ͼm">patch</span><span>: </span><span class="ͼm">DeepPartial</span><span><</span><span class="ͼm">EnvironmentState</span><span>>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    setSimTime(</span><span class="ͼm">iso</span><span>: </span><span class="ͼm">string</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    advanceSimTime(</span><span class="ͼm">ms</span><span>: </span><span class="ͼm">number</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    waitForIdle(): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    getRegistry(): </span><span class="ͼm">RegistryDescriptor</span><span>;</span><br/><span>  };</span><br/><span>  input?: {</span><br/><span>    tap(</span><span class="ͼm">x</span><span>: </span><span class="ͼm">number</span><span>, </span><span class="ͼm">y</span><span>: </span><span class="ͼm">number</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    longPress(</span><span class="ͼm">x</span><span>: </span><span class="ͼm">number</span><span>, </span><span class="ͼm">y</span><span>: </span><span class="ͼm">number</span><span>, </span><span class="ͼm">ms</span><span>?: </span><span class="ͼm">number</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    swipe(</span><span class="ͼm">points</span><span>: { x: </span><span class="ͼm">number</span><span>; y: </span><span class="ͼm">number</span><span> }[], </span><span class="ͼm">durationMs</span><span>?: </span><span class="ͼm">number</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    typeText(</span><span class="ͼm">text</span><span>: </span><span class="ͼm">string</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>    pressKey(</span><span class="ͼm">key</span><span>: </span><span class="ͼk">'back'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'home'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'enter'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'power'</span><span>): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  };</span><br/><span>  debug?: {</span><br/><span>    getNavigationGraph(</span><span class="ͼm">appId</span><span>?: </span><span class="ͼm">string</span><span>): </span><span class="ͼm">NavGraph</span><span>;</span><br/><span>    getSemanticEventLog(): </span><span class="ͼm">SemanticEvent</span><span>[];</span><br/><span>  };</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

**划分原则**

* **control API** ：只给 benchmark 做重置、注入、判定、等待稳定态。
* **input API** ：只提供低层手势，不提供 `openApp('wechat')` 这种捷径。
* 真正的评测动作仍建议走 Playwright 的点击/触摸与截图。

**理由**

要防止 benchmark 在动作层作弊，绕过视觉交互。

**替代方案**

只暴露 `reset/getState`，动作全靠 Playwright。

这也成立，而且更纯。`input API` 可以作为内部回放工具而不是必须接口。

---

## 18）状态快照格式

**方案**

用 **版本化、注册表驱动的 JSON** ：

<pre class="overflow-visible! px-0!" data-start="15318" data-end="16170"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">SimulatorSnapshot</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  meta: {</span><br/><span>    schemaVersion: </span><span class="ͼm">number</span><span>;</span><br/><span>    appRegistryVersion: </span><span class="ͼm">string</span><span>;</span><br/><span>    instanceId: </span><span class="ͼm">string</span><span>;</span><br/><span>    resetEpoch: </span><span class="ͼm">number</span><span>;</span><br/><span>  };</span><br/><span>  system: {</span><br/><span>    launcher: </span><span class="ͼm">LauncherState</span><span>;</span><br/><span>    statusBar: </span><span class="ͼm">StatusBarState</span><span>;</span><br/><span>    navBar: </span><span class="ͼm">NavBarState</span><span>;</span><br/><span>    notificationsUi: </span><span class="ͼm">NotificationShadeUiState</span><span>;</span><br/><span>  };</span><br/><span>  services: {</span><br/><span>    clock: </span><span class="ͼm">ClockState</span><span>;</span><br/><span>    connectivity: </span><span class="ͼm">ConnectivityState</span><span>;</span><br/><span>    battery: </span><span class="ͼm">BatteryState</span><span>;</span><br/><span>    location: </span><span class="ͼm">LocationState</span><span>;</span><br/><span>    clipboard: </span><span class="ͼm">ClipboardState</span><span>;</span><br/><span>    ime: </span><span class="ͼm">ImeState</span><span>;</span><br/><span>    device: </span><span class="ͼm">DeviceState</span><span>;</span><br/><span>  };</span><br/><span>  runtime: {</span><br/><span>    tasks: </span><span class="ͼm">TaskRecord</span><span>[];</span><br/><span>    activities: </span><span class="ͼm">Record</span><span><</span><span class="ͼm">ActivityId</span><span>, </span><span class="ͼm">ActivityRecord</span><span>>;</span><br/><span>    foregroundTaskId: </span><span class="ͼm">TaskId</span><span></span><span class="ͼg">|</span><span></span><span class="ͼj">null</span><span>;</span><br/><span>    overlays: </span><span class="ͼm">OverlayRecord</span><span>[];</span><br/><span>    focus: </span><span class="ͼm">FocusState</span><span>;</span><br/><span>    pendingResults: </span><span class="ͼm">PendingResultMap</span><span>;</span><br/><span>  };</span><br/><span>  apps: {</span><br/><span>    [appId: </span><span class="ͼm">string</span><span>]: {</span><br/><span>      version: </span><span class="ͼm">number</span><span>;</span><br/><span>      data: </span><span class="ͼm">unknown</span><span>;</span><br/><span>      ui: </span><span class="ͼm">unknown</span><span>;</span><br/><span>    };</span><br/><span>  };</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

`getState()` 的实现不写死 App 名字，而是：

* 系统部分固定序列化
* 服务部分遍历 `serviceRegistry`
* App 部分遍历 `appRegistry`

**理由**

新增 App 时，不应该改公共的 `getState` 逻辑。

**替代方案**

把所有 App state 平铺到根对象。

短期看方便，长期命名冲突和迁移都很糟。

---

## 六、与真实 Android 的对齐

## 19）对齐策略

**方案**

采用“ **用户可见行为对齐，内部机制只模拟必要子集** ”的策略。

值得忠实模拟的：

* Activity / Task / Back
* Intent / ActivityResult
* 通知、状态栏、系统设置
* 系统环境（时间、网络、位置、设备）
* 前后台切换语义

可以简化的：

* 真实进程/线程模型
* Binder / BroadcastReceiver 全套机制
* Fragment
* 权限子系统的所有细节
* 多窗口/分屏
* 资源限定符全家桶
* 真实 OEM ROM 差异

**判断标准**

只要满足任一条件，就值得模拟：

1. Agent 在屏幕上能感知
2. 会影响任务可达性/判定
3. 会显著影响返回栈/跨 App 逻辑
4. 对 benchmark 的确定性很关键

---

## 20）数据模型对齐

**方案**

我建议做成 **Android-inspired，而不是 Android-cloned** 。

也就是命名和概念向 Android 靠拢，但 snapshot 结构按模拟器可维护性来组织。

例如：

* 用 `tasks / activities / intents` 这些术语
* 但不必真的分散成 `SettingsProvider`、`BuildProperties`、`TelephonyManager` 那种真实 Android 分布方式

**理由**

benchmark 和前端开发更关心“如何 reset / 判定 / 注入”，不是复刻 AOSP 内部实现。

**替代方案**

完全按 Android 数据分类去建。

优点是 Android 工程师上手快；缺点是前端实现会被过度历史包袱拖住。

---

## 21）系统应用 vs 第三方应用

**方案**

接口统一，物理目录分离，依赖权限不同。

<pre class="overflow-visible! px-0!" data-start="17224" data-end="17337"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>src/apps/system/</span><br/><span>  settings/</span><br/><span>  contacts/</span><br/><span>  sms/</span><br/><br/><span>src/apps/third-party/</span><br/><span>  wechat/</span><br/><span>  alipay/</span><br/><span>  meituan/</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

统一都实现 `AppDefinition`，但约束：

* **system apps** 可以直接依赖 service adapters 和系统数据 provider
* **third-party apps** 只能通过公开 intent / public SDK facade 访问系统能力

**理由**

这样系统应用和第三方应用在运行时是同构的，便于 launcher/task 管理统一；但在开发上仍能体现耦合度差异。

**替代方案**

全部混在一个 `apps/` 目录。

能做，但几个月后依赖边界会失控。

---

## 七、可扩展性与开发体验

## 22）新增 App 的成本

**方案**

新增一个 App，理想流程是：

1. 新建目录 `src/apps/third-party/meituan/`
2. 写 `index.ts` 导出 `AppDefinition`
3. 写 `state.ts`、`routes.ts`、`screens/`、`res/`
4. 放默认 fixture
5. 完成

**不需要改的文件**

* 系统层注册表
* launcher 逻辑
* getState 逻辑
* reset 逻辑
* back dispatcher
* benchmark bridge

**必须修改的文件数**

 **核心架构目标是 0 个 core 文件** 。

只新增 App 自己目录内的文件。

只有当 App 引入一个全新系统能力时，才新增一个 service 模块。

---

## 23）并行运行

**瓶颈**

1. 后台 App 全挂载导致内存爆炸
2. 全局 context 级联渲染导致 CPU 浪费
3. 持久化频繁写盘
4. 大图片/大列表造成内存压力
5. 多实例共享同一个持久化 key 互相污染

**优化方案**

* 后台 Activity 默认卸载
* Zustand selector 精准订阅，避免全树重渲染
* App 屏幕组件按需懒加载；manifest 可 eager，screen renderer 可 lazy
* IndexedDB debounce 落盘
* 每个 tab 有独立 `instanceId`
* 列表虚拟化
* benchmark 模式可关闭 debug log 和 devtools
* 尽量不保留完整 screenshot history
* `persistenceMode = memory` 可用于不要求跨刷新恢复的批量跑分

**理由**

64 tab 的限制首先不是“功能不足”，而是“每实例是否足够轻”。

---

## 24）类型安全

**方案**

类型安全分四层做：

### A. 注册层

`defineApp()` 和 `defineService()` 用泛型推断 app id、route map、intent map、state shape。

### B. 快照层

所有持久化/外部注入的 JSON 都用 Zod 校验。

<pre class="overflow-visible! px-0!" data-start="18647" data-end="18707"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">const</span><span></span><span class="ͼm">simulatorSnapshotSchema</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({ ... });</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

### C. 跨 App 通信层

用 discriminated union 描述 intent 和 result：

<pre class="overflow-visible! px-0!" data-start="18769" data-end="18928"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">IntentMap</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  PAY: {</span><br/><span>    payload: { amount: </span><span class="ͼm">number</span><span>; orderId: </span><span class="ͼm">string</span><span> };</span><br/><span>    result: { status: </span><span class="ͼk">'success'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'fail'</span><span>; paymentId?: </span><span class="ͼm">string</span><span> };</span><br/><span>  };</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

### D. 外部 API 层

扩展 `window` 类型，并对所有入参做 runtime validation。

<pre class="overflow-visible! px-0!" data-start="18990" data-end="19070"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">declare</span><span></span><span class="ͼg">global</span><span> {</span><br/><span></span><span class="ͼg">interface</span><span></span><span class="ͼm">Window</span><span> {</span><br/><span>    __SIM__: </span><span class="ͼm">SimulatorApi</span><span>;</span><br/><span>  }</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

再加两类约束：

* branded id：`TaskId` / `ActivityId` / `NotificationId`
* ESLint 规则：禁止 App 代码直接 `Date.now()`、禁止跨 App 直接 import state slice

**理由**

这个系统的复杂度不在单个组件，而在跨层接口。

TS 最该保护的是边界，而不是 JSX 细节。

---

# 3. 最难的 3 个设计决策

## 决策一：一个全局 store，还是每个 App/系统模块各自 store？

**我最终选：一个全局 canonical store，模块化 slice。**

**为什么难**

前端开发天然偏好“就近状态”，但 benchmark 要求：

* 全量 `getState()`
* 精确 `reset()`
* 刷新后恢复
* 跨 App / 系统统一判定

这四件事本质上都在逼你收敛成单一快照。

**放弃的方案**

多个 store + 汇总序列化器。

看起来解耦，实则会把 reset/hydrate 变成灾难。

**代价**

需要很严格地规定哪些状态允许留在组件本地。

这是架构纪律问题，不是技术魔法。

---

## 决策二：App 内路由要不要用 React Router？

**我最终选：不用它做 canonical 导航，只保留自定义 navigator。**

**为什么难**

React Router 开发体验成熟，页面切换很顺手。

但这个项目不是“网页站点”，而是“Android 概念模拟器”。

一旦系统层已有 Task/Activity 栈，再叠一个 history 系统，返回键和跨 App 结果就会变成双重控制流。

**放弃的方案**

React Router + 外面再包一层系统栈。

短期能跑，长期会出现“看上去返回正常，但 getState 里的导航语义不一致”。

**代价**

要自己写一层小型 navigator DSL。

但这层 DSL 正好又能服务导航枚举和轨迹校验，所以是值得的。

---

## 决策三：后台 App 到底卸载还是隐藏？

**我最终选：默认卸载，必要时 keep-alive。**

**为什么难**

隐藏不卸载最省心，开发者几乎不用关心 UI 恢复；

但 64 实例并发时，这是最先炸掉的点。

**放弃的方案**

全部 keep-alive。

这只适合 demo，不适合 benchmark 基础设施。

**代价**

必须把任务相关 UI 瞬态序列化，例如：

* 滚动位置
* 输入框草稿
* 当前筛选条件
* 选中 tab

但这恰恰会提升 reset 和恢复的一致性。

---

# 4. 一个具体 App 的骨架代码

下面给一个简化版 `wechat` 骨架，重点展示：

* 目录结构
* 自动注册
* 状态 schema
* 自定义路由
* 语义标记

---

## 4.1 目录结构

<pre class="overflow-visible! px-0!" data-start="20372" data-end="21051"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>src/</span><br/><span>  core/</span><br/><span>    app/</span><br/><span>      defineApp.ts</span><br/><span>      registry.ts</span><br/><span>      navigator.ts</span><br/><span>      intents.ts</span><br/><span>    runtime/</span><br/><span>      backDispatcher.ts</span><br/><span>      reset.ts</span><br/><span>      persistence.ts</span><br/><span>    semantics/</span><br/><span>      SemButton.tsx</span><br/><span>      semanticLog.ts</span><br/><span>    store/</span><br/><span>      simStore.ts</span><br/><span>      types.ts</span><br/><br/><span>  system/</span><br/><span>    shell/</span><br/><span>      PhoneFrame.tsx</span><br/><span>      Launcher.tsx</span><br/><span>      StatusBar.tsx</span><br/><span>      NavBar.tsx</span><br/><span>    services/</span><br/><span>      clock.ts</span><br/><span>      connectivity.ts</span><br/><span>      ime.ts</span><br/><br/><span>  apps/</span><br/><span>    third-party/</span><br/><span>      wechat/</span><br/><span>        index.ts</span><br/><span>        manifest.ts</span><br/><span>        state.ts</span><br/><span>        routes.ts</span><br/><span>        res/</span><br/><span>          strings.ts</span><br/><span>          icons.tsx</span><br/><span>        screens/</span><br/><span>          ChatListScreen.tsx</span><br/><span>          ChatScreen.tsx</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 4.2 自动注册

<pre class="overflow-visible! px-0!" data-start="21071" data-end="21506"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼe">// src/core/app/registry.ts</span><br/><span class="ͼg">import</span><span></span><span class="ͼg">type</span><span> { </span><span class="ͼm">AnyAppDefinition</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'./defineApp'</span><span>;</span><br/><br/><span class="ͼg">const</span><span></span><span class="ͼm">modules</span><span></span><span class="ͼg">=</span><span></span><span class="ͼg">import.</span><span>meta</span><span class="ͼg">.</span><span>glob(</span><span class="ͼk">'/src/apps/**/index.ts'</span><span>, { eager: </span><span class="ͼj">true</span><span> });</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">appRegistry</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">Object</span><span class="ͼg">.</span><span>values(</span><span class="ͼm">modules</span><span>)</span><span class="ͼg">.</span><span>map(</span><br/><span></span><span class="ͼm">m</span><span> => (</span><span class="ͼm">m</span><span></span><span class="ͼg">as</span><span> { default: </span><span class="ͼm">AnyAppDefinition</span><span> })</span><span class="ͼg">.</span><span>default</span><br/><span>);</span><br/><br/><span class="ͼg">const</span><span></span><span class="ͼm">ids</span><span></span><span class="ͼg">=</span><span></span><span class="ͼg">new</span><span></span><span class="ͼm">Set</span><span><</span><span class="ͼm">string</span><span>>();</span><br/><span class="ͼg">for</span><span> (</span><span class="ͼg">const</span><span></span><span class="ͼm">app</span><span></span><span class="ͼg">of</span><span></span><span class="ͼm">appRegistry</span><span>) {</span><br/><span></span><span class="ͼg">if</span><span> (</span><span class="ͼm">ids</span><span class="ͼg">.</span><span>has(</span><span class="ͼm">app</span><span class="ͼg">.</span><span>id)) </span><span class="ͼg">throw</span><span></span><span class="ͼg">new</span><span></span><span class="ͼm">Error</span><span>(</span><span class="ͼk">`Duplicate app id: </span><span>${</span><span class="ͼm">app</span><span class="ͼg">.</span><span>id}</span><span class="ͼk">`</span><span>);</span><br/><span></span><span class="ͼm">ids</span><span class="ͼg">.</span><span>add(</span><span class="ͼm">app</span><span class="ͼg">.</span><span>id);</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 4.3 App 定义类型

<pre class="overflow-visible! px-0!" data-start="21530" data-end="22099"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼe">// src/core/app/defineApp.ts</span><br/><span class="ͼg">import</span><span></span><span class="ͼg">type</span><span> { </span><span class="ͼm">ZodTypeAny</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'zod'</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">type</span><span></span><span class="ͼm">ActionSpec</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  id: </span><span class="ͼm">string</span><span>;</span><br/><span>  kind: </span><span class="ͼk">'navigate'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'mutate'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'intent'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'submit'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'back'</span><span>;</span><br/><span>  target?: { screen: </span><span class="ͼm">string</span><span>; params?: </span><span class="ͼm">unknown</span><span> };</span><br/><span>  effectKeys?: </span><span class="ͼm">string</span><span>[];</span><br/><span>};</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">type</span><span></span><span class="ͼm">ScreenSpec</span><span><</span><span class="ͼm">P</span><span>> </span><span class="ͼg">=</span><span> {</span><br/><span>  id: </span><span class="ͼm">string</span><span>;</span><br/><span>  paramsSchema: </span><span class="ͼm">ZodTypeAny</span><span>;</span><br/><span>  enumerateActions: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">any</span><span>, </span><span class="ͼm">params</span><span>: </span><span class="ͼm">P</span><span>) => </span><span class="ͼm">ActionSpec</span><span>[];</span><br/><span>  render: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">any</span><span>, </span><span class="ͼm">params</span><span>: </span><span class="ͼm">P</span><span>) => </span><span class="ͼm">React</span><span class="ͼg">.</span><span class="ͼm">ReactNode</span><span>;</span><br/><span>};</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">type</span><span></span><span class="ͼm">AnyAppDefinition</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">ReturnType</span><span><</span><span class="ͼg">typeof</span><span></span><span class="ͼm">defineApp</span><span>>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">defineApp</span><span><</span><span class="ͼg">const</span><span></span><span class="ͼm">T</span><span>>(</span><span class="ͼm">app</span><span>: </span><span class="ͼm">T</span><span>) {</span><br/><span></span><span class="ͼg">return</span><span></span><span class="ͼm">app</span><span>;</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 4.4 WeChat 状态

<pre class="overflow-visible! px-0!" data-start="22124" data-end="23300"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼe">// src/apps/third-party/wechat/state.ts</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">z</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'zod'</span><span>;</span><br/><br/><span class="ͼg">const</span><span></span><span class="ͼm">MessageSchema</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>  id: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>  sender: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>enum([</span><span class="ͼk">'me'</span><span>, </span><span class="ͼk">'other'</span><span>]),</span><br/><span>  text: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>  ts: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>});</span><br/><br/><span class="ͼg">const</span><span></span><span class="ͼm">ChatSchema</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>  id: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>  title: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>  unread: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>number(),</span><br/><span>  messages: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>array(</span><span class="ͼm">MessageSchema</span><span>),</span><br/><span>});</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">WechatStateSchema</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>  data: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>    chats: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>record(</span><span class="ͼm">ChatSchema</span><span>),</span><br/><span>    chatOrder: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>array(</span><span class="ͼm">z</span><span class="ͼg">.</span><span>string()),</span><br/><span>  }),</span><br/><span>  ui: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>    draftByChatId: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>record(</span><span class="ͼm">z</span><span class="ͼg">.</span><span>string()),</span><br/><span>    scrollOffsetByScreen: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>record(</span><span class="ͼm">z</span><span class="ͼg">.</span><span>number()),</span><br/><span>  }),</span><br/><span>});</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">type</span><span></span><span class="ͼm">WechatState</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">z</span><span class="ͼg">.</span><span class="ͼm">infer</span><span><</span><span class="ͼg">typeof</span><span></span><span class="ͼm">WechatStateSchema</span><span>>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">createDefaultWechatState</span><span>(): </span><span class="ͼm">WechatState</span><span> {</span><br/><span></span><span class="ͼg">return</span><span> {</span><br/><span>    data: {</span><br/><span>      chats: {</span><br/><span>        c_1: {</span><br/><span>          id: </span><span class="ͼk">'c_1'</span><span>,</span><br/><span>          title: </span><span class="ͼk">'张三'</span><span>,</span><br/><span>          unread: </span><span class="ͼj">2</span><span>,</span><br/><span>          messages: [</span><br/><span>            { id: </span><span class="ͼk">'m_1'</span><span>, sender: </span><span class="ͼk">'other'</span><span>, text: </span><span class="ͼk">'晚上吃饭吗'</span><span>, ts: </span><span class="ͼk">'2026-03-07T18:30:00+08:00'</span><span> },</span><br/><span>            { id: </span><span class="ͼk">'m_2'</span><span>, sender: </span><span class="ͼk">'me'</span><span>, text: </span><span class="ͼk">'可以'</span><span>, ts: </span><span class="ͼk">'2026-03-07T18:31:00+08:00'</span><span> },</span><br/><span>          ],</span><br/><span>        },</span><br/><span>      },</span><br/><span>      chatOrder: [</span><span class="ͼk">'c_1'</span><span>],</span><br/><span>    },</span><br/><span>    ui: {</span><br/><span>      draftByChatId: {},</span><br/><span>      scrollOffsetByScreen: {},</span><br/><span>    },</span><br/><span>  };</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 4.5 WeChat 路由声明

<pre class="overflow-visible! px-0!" data-start="23327" data-end="24515"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼe">// src/apps/third-party/wechat/routes.ts</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">z</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'zod'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">ChatListScreen</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'./screens/ChatListScreen'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">ChatScreen</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'./screens/ChatScreen'</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">wechatScreens</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  chatList: {</span><br/><span>    id: </span><span class="ͼk">'chatList'</span><span>,</span><br/><span>    paramsSchema: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({}),</span><br/><span>    enumerateActions: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">any</span><span>) =></span><br/><span></span><span class="ͼm">ctx</span><span class="ͼg">.</span><span>appState</span><span class="ͼg">.</span><span>data</span><span class="ͼg">.</span><span>chatOrder</span><span class="ͼg">.</span><span>map((</span><span class="ͼm">chatId</span><span>: </span><span class="ͼm">string</span><span>) => ({</span><br/><span>        id: </span><span class="ͼk">'wechat.openChat'</span><span>,</span><br/><span>        kind: </span><span class="ͼk">'navigate'</span><span></span><span class="ͼg">as</span><span></span><span class="ͼg">const</span><span>,</span><br/><span>        target: { screen: </span><span class="ͼk">'chat'</span><span>, params: { chatId } },</span><br/><span>        effectKeys: [],</span><br/><span>      })),</span><br/><span>    render: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">any</span><span>) => </span><span class="ͼo"><ChatListScreen</span><span></span><span class="ͼn">ctx</span><span class="ͼg">=</span><span>{</span><span class="ͼm">ctx</span><span>} </span><span class="ͼo">/></span><span>,</span><br/><span>  },</span><br/><br/><span>  chat: {</span><br/><span>    id: </span><span class="ͼk">'chat'</span><span>,</span><br/><span>    paramsSchema: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>object({</span><br/><span>      chatId: </span><span class="ͼm">z</span><span class="ͼg">.</span><span>string(),</span><br/><span>    }),</span><br/><span>    enumerateActions: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">any</span><span>, </span><span class="ͼm">params</span><span>: { chatId: </span><span class="ͼm">string</span><span> }) => [</span><br/><span>      {</span><br/><span>        id: </span><span class="ͼk">'wechat.typeDraft'</span><span>,</span><br/><span>        kind: </span><span class="ͼk">'mutate'</span><span>,</span><br/><span>        effectKeys: [</span><span class="ͼk">`apps.wechat.ui.draftByChatId.</span><span>${</span><span class="ͼm">params</span><span class="ͼg">.</span><span>chatId}</span><span class="ͼk">`</span><span>],</span><br/><span>      },</span><br/><span>      {</span><br/><span>        id: </span><span class="ͼk">'wechat.sendMessage'</span><span>,</span><br/><span>        kind: </span><span class="ͼk">'submit'</span><span>,</span><br/><span>        effectKeys: [</span><span class="ͼk">`apps.wechat.data.chats.</span><span>${</span><span class="ͼm">params</span><span class="ͼg">.</span><span>chatId}</span><span class="ͼk">.messages`</span><span>],</span><br/><span>      },</span><br/><span>    ],</span><br/><span>    render: (</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">any</span><span>, </span><span class="ͼm">params</span><span>: { chatId: </span><span class="ͼm">string</span><span> }) => (</span><br/><span></span><span class="ͼo"><ChatScreen</span><span></span><span class="ͼn">ctx</span><span class="ͼg">=</span><span>{</span><span class="ͼm">ctx</span><span>} </span><span class="ͼn">chatId</span><span class="ͼg">=</span><span>{</span><span class="ͼm">params</span><span class="ͼg">.</span><span>chatId} </span><span class="ͼo">/></span><br/><span>    ),</span><br/><span>  },</span><br/><span>} </span><span class="ͼg">as</span><span></span><span class="ͼg">const</span><span>;</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 4.6 WeChat AppDefinition

<pre class="overflow-visible! px-0!" data-start="24551" data-end="25341"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼe">// src/apps/third-party/wechat/index.ts</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">defineApp</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/core/app/defineApp'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">WechatStateSchema</span><span>, </span><span class="ͼm">createDefaultWechatState</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'./state'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">wechatScreens</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'./routes'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">WechatIcon</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'./res/icons'</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">default</span><span></span><span class="ͼm">defineApp</span><span>({</span><br/><span>  id: </span><span class="ͼk">'wechat'</span><span>,</span><br/><span>  manifest: {</span><br/><span>    displayName: </span><span class="ͼk">'微信'</span><span>,</span><br/><span>    category: </span><span class="ͼk">'third-party'</span><span>,</span><br/><span>    launcherIcon: </span><span class="ͼm">WechatIcon</span><span>,</span><br/><span>    resumePolicy: </span><span class="ͼk">'recreate'</span><span>,</span><br/><span>  },</span><br/><span>  state: {</span><br/><span>    schema: </span><span class="ͼm">WechatStateSchema</span><span>,</span><br/><span>    createDefaultState: </span><span class="ͼm">createDefaultWechatState</span><span>,</span><br/><span>  },</span><br/><span>  screens: </span><span class="ͼm">wechatScreens</span><span>,</span><br/><span>  intents: {</span><br/><span>    SHARE_TEXT: ({ payload, kernel, activityId }: </span><span class="ͼm">any</span><span>) => {</span><br/><span></span><span class="ͼm">kernel</span><span class="ͼg">.</span><span>startActivity(</span><span class="ͼm">activityId</span><span>, {</span><br/><span>        screen: </span><span class="ͼk">'chatList'</span><span>,</span><br/><span>        params: {},</span><br/><span>      });</span><br/><span></span><span class="ͼe">// 真实项目中可把 payload.text 预填到某个 compose state</span><br/><span>    },</span><br/><span>  },</span><br/><span>});</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 4.7 语义按钮组件

<pre class="overflow-visible! px-0!" data-start="25363" data-end="26101"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼe">// src/core/semantics/SemButton.tsx</span><br/><span class="ͼg">import</span><span></span><span class="ͼm">clsx</span><span></span><span class="ͼg">from</span><span></span><span class="ͼk">'clsx'</span><span>;</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">useSemanticLog</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'./semanticLog'</span><span>;</span><br/><br/><span class="ͼg">type</span><span></span><span class="ͼm">Props</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  actionId: </span><span class="ͼm">string</span><span>;</span><br/><span>  screenId: </span><span class="ͼm">string</span><span>;</span><br/><span>  nodeKey?: </span><span class="ͼm">string</span><span>;</span><br/><span>  className?: </span><span class="ͼm">string</span><span>;</span><br/><span>  onPress: () => </span><span class="ͼg">void</span><span>;</span><br/><span>  children: </span><span class="ͼm">React</span><span class="ͼg">.</span><span class="ͼm">ReactNode</span><span>;</span><br/><span>};</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">SemButton</span><span>({</span><br/><span>  actionId,</span><br/><span>  screenId,</span><br/><span>  nodeKey,</span><br/><span>  className,</span><br/><span>  onPress,</span><br/><span>  children,</span><br/><span>}: </span><span class="ͼm">Props</span><span>) {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">log</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">useSemanticLog</span><span>();</span><br/><br/><span></span><span class="ͼg">return</span><span> (</span><br/><span></span><span class="ͼo"><button</span><br/><span></span><span class="ͼn">type</span><span class="ͼg">=</span><span class="ͼk">"button"</span><br/><span></span><span class="ͼn">data-sim-screen</span><span class="ͼg">=</span><span>{</span><span class="ͼm">screenId</span><span>}</span><br/><span></span><span class="ͼn">data-sim-action-id</span><span class="ͼg">=</span><span>{</span><span class="ͼm">actionId</span><span>}</span><br/><span></span><span class="ͼn">data-sim-node-key</span><span class="ͼg">=</span><span>{</span><span class="ͼm">nodeKey</span><span>}</span><br/><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span>{</span><span class="ͼm">clsx</span><span>(</span><span class="ͼm">className</span><span>)}</span><br/><span></span><span class="ͼn">onClick</span><span class="ͼg">=</span><span>{() => {</span><br/><span></span><span class="ͼm">log</span><span>({ actionId, screenId, nodeKey });</span><br/><span></span><span class="ͼm">onPress</span><span>();</span><br/><span>      }}</span><br/><span></span><span class="ͼo">></span><br/><span>      {</span><span class="ͼm">children</span><span>}</span><br/><span></span><span class="ͼo"></button></span><br/><span>  );</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 4.8 聊天列表页

<pre class="overflow-visible! px-0!" data-start="26122" data-end="27540"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼe">// src/apps/third-party/wechat/screens/ChatListScreen.tsx</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">SemButton</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/core/semantics/SemButton'</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">ChatListScreen</span><span>({ ctx }: { ctx: </span><span class="ͼm">any</span><span> }) {</span><br/><span></span><span class="ͼg">const</span><span> { appState, nav } </span><span class="ͼg">=</span><span></span><span class="ͼm">ctx</span><span>;</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">chats</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">appState</span><span class="ͼg">.</span><span>data</span><span class="ͼg">.</span><span>chatOrder</span><span class="ͼg">.</span><span>map((</span><span class="ͼm">id</span><span>: </span><span class="ͼm">string</span><span>) => </span><span class="ͼm">appState</span><span class="ͼg">.</span><span>data</span><span class="ͼg">.</span><span>chats[</span><span class="ͼm">id</span><span>]);</span><br/><br/><span></span><span class="ͼg">return</span><span> (</span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex h-full flex-col bg-white"</span><span></span><span class="ͼn">data-sim-screen</span><span class="ͼg">=</span><span class="ͼk">"wechat/chatList"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><header</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"border-b px-4 py-3 text-center text-base font-medium"</span><span class="ͼo">></span><span>微信</span><span class="ͼo"></header></span><br/><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex-1 overflow-y-auto"</span><span class="ͼo">></span><br/><span>        {</span><span class="ͼm">chats</span><span class="ͼg">.</span><span>map((</span><span class="ͼm">chat</span><span>: </span><span class="ͼm">any</span><span>) => (</span><br/><span></span><span class="ͼo"><SemButton</span><br/><span></span><span class="ͼn">key</span><span class="ͼg">=</span><span>{</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>id}</span><br/><span></span><span class="ͼn">screenId</span><span class="ͼg">=</span><span class="ͼk">"wechat/chatList"</span><br/><span></span><span class="ͼn">actionId</span><span class="ͼg">=</span><span class="ͼk">"wechat.openChat"</span><br/><span></span><span class="ͼn">nodeKey</span><span class="ͼg">=</span><span>{</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>id}</span><br/><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex w-full items-center justify-between border-b px-4 py-3 text-left"</span><br/><span></span><span class="ͼn">onPress</span><span class="ͼg">=</span><span>{() => </span><span class="ͼm">nav</span><span class="ͼg">.</span><span>push(</span><span class="ͼk">'chat'</span><span>, { chatId: </span><span class="ͼm">chat</span><span class="ͼg">.</span><span>id })}</span><br/><span></span><span class="ͼo">></span><br/><span></span><span class="ͼo"><div></span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"text-sm font-medium"</span><span class="ͼo">></span><span>{</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>title}</span><span class="ͼo"></div></span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"mt-1 text-xs text-neutral-500"</span><span class="ͼo">></span><br/><span>                {</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>messages[</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>messages</span><span class="ͼg">.</span><span>length </span><span class="ͼg">-</span><span></span><span class="ͼj">1</span><span>]?.text}</span><br/><span></span><span class="ͼo"></div></span><br/><span></span><span class="ͼo"></div></span><br/><br/><span>            {</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>unread </span><span class="ͼg">></span><span></span><span class="ͼj">0</span><span></span><span class="ͼg">?</span><span> (</span><br/><span></span><span class="ͼo"><span</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"rounded-full bg-green-500 px-2 py-0.5 text-xs text-white"</span><span class="ͼo">></span><br/><span>                {</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>unread}</span><br/><span></span><span class="ͼo"></span></span><br/><span>            ) </span><span class="ͼg">:</span><span></span><span class="ͼj">null</span><span>}</span><br/><span></span><span class="ͼo"></SemButton></span><br/><span>        ))}</span><br/><span></span><span class="ͼo"></div></span><br/><span></span><span class="ͼo"></div></span><br/><span>  );</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 4.9 聊天页

<pre class="overflow-visible! px-0!" data-start="27559" data-end="29841"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼe">// src/apps/third-party/wechat/screens/ChatScreen.tsx</span><br/><span class="ͼg">import</span><span> { </span><span class="ͼm">SemButton</span><span> } </span><span class="ͼg">from</span><span></span><span class="ͼk">'@/core/semantics/SemButton'</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">ChatScreen</span><span>({</span><br/><span>  ctx,</span><br/><span>  chatId,</span><br/><span>}: {</span><br/><span>  ctx: </span><span class="ͼm">any</span><span>;</span><br/><span>  chatId: </span><span class="ͼm">string</span><span>;</span><br/><span>}) {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">chat</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">ctx</span><span class="ͼg">.</span><span>appState</span><span class="ͼg">.</span><span>data</span><span class="ͼg">.</span><span>chats[</span><span class="ͼm">chatId</span><span>];</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">draft</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">ctx</span><span class="ͼg">.</span><span>appState</span><span class="ͼg">.</span><span>ui</span><span class="ͼg">.</span><span>draftByChatId[</span><span class="ͼm">chatId</span><span>] </span><span class="ͼg">??</span><span></span><span class="ͼk">''</span><span>;</span><br/><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">setDraft</span><span></span><span class="ͼg">=</span><span> (</span><span class="ͼm">value</span><span>: </span><span class="ͼm">string</span><span>) => {</span><br/><span></span><span class="ͼm">ctx</span><span class="ͼg">.</span><span>actions</span><span class="ͼg">.</span><span>patchAppUi(</span><span class="ͼk">'wechat'</span><span>, {</span><br/><span>      draftByChatId: {</span><br/><span>        ...</span><span class="ͼm">ctx</span><span class="ͼg">.</span><span>appState</span><span class="ͼg">.</span><span>ui</span><span class="ͼg">.</span><span>draftByChatId,</span><br/><span>        [</span><span class="ͼm">chatId</span><span>]: </span><span class="ͼm">value</span><span>,</span><br/><span>      },</span><br/><span>    });</span><br/><span>  };</span><br/><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">send</span><span></span><span class="ͼg">=</span><span> () => {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">text</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">draft</span><span class="ͼg">.</span><span>trim();</span><br/><span></span><span class="ͼg">if</span><span> (</span><span class="ͼg">!</span><span class="ͼm">text</span><span>) </span><span class="ͼg">return</span><span>;</span><br/><br/><span></span><span class="ͼm">ctx</span><span class="ͼg">.</span><span>actions</span><span class="ͼg">.</span><span>appendChatMessage(</span><span class="ͼk">'wechat'</span><span>, </span><span class="ͼm">chatId</span><span>, {</span><br/><span>      id: </span><span class="ͼk">`m_</span><span>${</span><span class="ͼm">crypto</span><span class="ͼg">.</span><span>randomUUID()}</span><span class="ͼk">`</span><span>,</span><br/><span>      sender: </span><span class="ͼk">'me'</span><span>,</span><br/><span>      text,</span><br/><span>      ts: </span><span class="ͼm">ctx</span><span class="ͼg">.</span><span>services</span><span class="ͼg">.</span><span>clock</span><span class="ͼg">.</span><span>now(),</span><br/><span>    });</span><br/><br/><span></span><span class="ͼm">setDraft</span><span>(</span><span class="ͼk">''</span><span>);</span><br/><span>  };</span><br/><br/><span></span><span class="ͼg">return</span><span> (</span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex h-full flex-col bg-[#f5f5f5]"</span><span></span><span class="ͼn">data-sim-screen</span><span class="ͼg">=</span><span class="ͼk">"wechat/chat"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><header</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex items-center border-b bg-white px-3 py-2"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><button</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"mr-3"</span><span></span><span class="ͼn">onClick</span><span class="ͼg">=</span><span>{() => </span><span class="ͼm">ctx</span><span class="ͼg">.</span><span>nav</span><span class="ͼg">.</span><span>pop()}</span><span class="ͼo">></span><span>返回</span><span class="ͼo"></button></span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"text-sm font-medium"</span><span class="ͼo">></span><span>{</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>title}</span><span class="ͼo"></div></span><br/><span></span><span class="ͼo"></header></span><br/><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex-1 overflow-y-auto p-3"</span><span class="ͼo">></span><br/><span>        {</span><span class="ͼm">chat</span><span class="ͼg">.</span><span>messages</span><span class="ͼg">.</span><span>map((</span><span class="ͼm">m</span><span>: </span><span class="ͼm">any</span><span>) => (</span><br/><span></span><span class="ͼo"><div</span><br/><span></span><span class="ͼn">key</span><span class="ͼg">=</span><span>{</span><span class="ͼm">m</span><span class="ͼg">.</span><span>id}</span><br/><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span>{</span><span class="ͼk">`mb-2 flex </span><span>${</span><span class="ͼm">m</span><span class="ͼg">.</span><span>sender </span><span class="ͼg">===</span><span></span><span class="ͼk">'me'</span><span></span><span class="ͼg">?</span><span></span><span class="ͼk">'justify-end'</span><span></span><span class="ͼg">:</span><span></span><span class="ͼk">'justify-start'</span><span>}</span><span class="ͼk">`</span><span>}</span><br/><span></span><span class="ͼo">></span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"max-w-[72%] rounded-lg bg-white px-3 py-2 text-sm shadow-sm"</span><span class="ͼo">></span><br/><span>              {</span><span class="ͼm">m</span><span class="ͼg">.</span><span>text}</span><br/><span></span><span class="ͼo"></div></span><br/><span></span><span class="ͼo"></div></span><br/><span>        ))}</span><br/><span></span><span class="ͼo"></div></span><br/><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"border-t bg-white p-2"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><div</span><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"flex items-end gap-2"</span><span class="ͼo">></span><br/><span></span><span class="ͼo"><textarea</span><br/><span></span><span class="ͼn">value</span><span class="ͼg">=</span><span>{</span><span class="ͼm">draft</span><span>}</span><br/><span></span><span class="ͼn">data-sim-screen</span><span class="ͼg">=</span><span class="ͼk">"wechat/chat"</span><br/><span></span><span class="ͼn">data-sim-action-id</span><span class="ͼg">=</span><span class="ͼk">"wechat.typeDraft"</span><br/><span></span><span class="ͼn">data-sim-node-key</span><span class="ͼg">=</span><span>{</span><span class="ͼm">chatId</span><span>}</span><br/><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"min-h-[40px] flex-1 resize-none rounded-md border px-2 py-2 text-sm outline-none"</span><br/><span></span><span class="ͼn">onChange</span><span class="ͼg">=</span><span>{</span><span class="ͼm">e</span><span> => </span><span class="ͼm">setDraft</span><span>(</span><span class="ͼm">e</span><span class="ͼg">.</span><span>target</span><span class="ͼg">.</span><span>value)}</span><br/><span></span><span class="ͼo">/></span><br/><span></span><span class="ͼo"><SemButton</span><br/><span></span><span class="ͼn">screenId</span><span class="ͼg">=</span><span class="ͼk">"wechat/chat"</span><br/><span></span><span class="ͼn">actionId</span><span class="ͼg">=</span><span class="ͼk">"wechat.sendMessage"</span><br/><span></span><span class="ͼn">nodeKey</span><span class="ͼg">=</span><span>{</span><span class="ͼm">chatId</span><span>}</span><br/><span></span><span class="ͼn">className</span><span class="ͼg">=</span><span class="ͼk">"rounded-md bg-green-500 px-3 py-2 text-sm text-white"</span><br/><span></span><span class="ͼn">onPress</span><span class="ͼg">=</span><span>{</span><span class="ͼm">send</span><span>}</span><br/><span></span><span class="ͼo">></span><br/><span>            发送</span><br/><span></span><span class="ͼo"></SemButton></span><br/><span></span><span class="ͼo"></div></span><br/><span></span><span class="ͼo"></div></span><br/><span></span><span class="ͼo"></div></span><br/><span>  );</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

这个骨架里最关键的不是 JSX，而是三件事：

1. **语义 action 是显式的**
2. **可恢复 UI 状态在 store 里**
3. **导航不是浏览器 history，而是 runtime 管理的 screen stack**

---

# 5. 有意识做的简化 / 妥协

## 妥协一：不模拟真实 Android 进程/线程/Binder

 **原因** ：对纯视觉 Agent 几乎没有直接价值。

 **何时应该去掉** ：当你要评估后台服务、广播、复杂进程恢复时。

## 妥协二：默认单窗口、竖屏手机

 **原因** ：大多数移动 Agent 任务在这个范畴内。

 **何时应该去掉** ：要做分屏、多窗口、平板任务时。

## 妥协三：权限系统做成可注入状态，不做完整系统交互栈

 **原因** ：很多 benchmark 只需要“已授权/未授权”的确定状态。

 **何时应该去掉** ：当任务明确要求从权限弹窗一路操作。

## 妥协四：资源系统只借鉴 `res/` 思路，不实现 Android 全部 qualifier

 **原因** ：前端项目里完整 `dpi/night/locale/swNNNdp` 体系成本太高。

 **何时应该去掉** ：当你要覆盖大量机型/语言/深色模式矩阵。

## 妥协五：后台页面默认卸载

 **原因** ：并发性能优先。

 **何时应该去掉** ：当某些任务强依赖真实 DOM/输入法状态连续保留，而且可恢复成本高于内存成本。

## 妥协六：语义标记放在 DOM attribute，而不是完全外部映射

 **原因** ：实现最直接，和 UI 对齐最好。

 **何时应该去掉** ：当你需要更强隔离，防止页面内脚本读取这些标记时；那时可以改成宿主侧 shadow map 或 iframe 隔离。

---

# 6. 收束成一句工程建议

如果只保留一个架构判断，我会坚持这一条：

**把“系统运行时”当成一层独立内核来做，所有 App 只是注册到内核里的声明式插件；所有可判定状态都收束到一个 versioned snapshot。**

这样才能同时满足：

* Agent 纯视觉
* benchmark 可重置、可注入、可判定
* 新增 App 不改核心
* 64 实例并发可承受
* 后续能逐步向真实 Android 语义靠拢，而不是推倒重来

我可以继续把这份方案进一步落成两样东西之一：一份更偏工程实现的 `src/` 目录与核心类型定义清单，或者一份 benchmark 侧的 `window.__SIM__` API 详细协议草案。
