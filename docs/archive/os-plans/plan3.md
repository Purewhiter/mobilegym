**我不会把平台做成“真 Android 模拟器的壳”，而会做成“Android 语义对齐 + 可编程渲染内核”的移动 GUI 世界模型。**

原因是，现有 AndroidEnv / AndroidWorld 这条“真 Android / 真模拟器 + 视觉交互”路线已经证明了视觉评测和可重复 benchmark 是可行的；但 AndroidEnv 明确说明它运行在实时 Android 设备模拟之上，环境不会等 Agent 思考，也不能简单加速，而 AVD snapshot 虽然能保存整机状态，却是内存密集型操作，并且会因 emulator / system image / AVD 配置变化而失效。对于“64～100+ 实例并行、任意状态一键重置、结构化验收”这一目标，这条路成本太高。

---

# 0. 总体设计结论

## 一句话架构

做一个**“视觉上像 Android、语义上对齐 Android、实现上不是 Android”**的仿真平台：

* **渲染层** ：自研 headless mobile UI renderer，输出截图给 Agent。
* **系统层** ：只模拟与任务相关、用户可感知的 Android 语义：task/back stack、Intent、权限、通知、状态栏、快捷设置、键盘、时间/位置/网络等。
* **App 层** ：每个 App 不是 APK，而是一个声明式插件包：`manifest + navigation graph + view tree + reducer/effects + data schema + verifier hooks`。
* **状态层** ：全局单一真相源（single source of truth）管理系统状态与各 App 数据。
* **评估层** ：以 **结构化状态验证为主** ，VLM 只做补充，而不是主判官。
* **编排层** ：benchmark runner 通过 gRPC/HTTP 控制实例，支持批量 reset、并行执行、故障恢复。

---

# 1. 整体架构图

<pre class="overflow-visible! px-0!" data-start="957" data-end="4072"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>+------------------------------------------------------------------------------------+</span><br/><span>|                                Benchmark Orchestrator                              |</span><br/><span>|  - task scheduler   - seed sampler   - timeout/retry   - result collector          |</span><br/><span>+-------------------------------+-------------------------+--------------------------+</span><br/><span>                                | gRPC / HTTP</span><br/><span>                                v</span><br/><span>+------------------------------------------------------------------------------------+</span><br/><span>|                              Simulator Control Plane                               |</span><br/><span>|  CreateInstance / Reset / Step / Observe / GetState / Evaluate / Destroy           |</span><br/><span>+-----------------------------------+------------------------------------------------+</span><br/><span>                                    |</span><br/><span>                                    v</span><br/><span>+------------------------------------------------------------------------------------+</span><br/><span>|                                 Worker Node (N)                                    |</span><br/><span>|                                                                                    |</span><br/><span>|  +--------------------+   +--------------------+   +--------------------+          |</span><br/><span>|  | Instance Actor #1  |   | Instance Actor #2  |   | Instance Actor #K  |  ...     |</span><br/><span>|  |--------------------|   |--------------------|   |--------------------|          |</span><br/><span>|  | World State Store  |   | World State Store  |   | World State Store  |          |</span><br/><span>|  | Task/App Stack     |   | Task/App Stack     |   | Task/App Stack     |          |</span><br/><span>|  | Intent Broker      |   | Intent Broker      |   | Intent Broker      |          |</span><br/><span>|  | Permission Manager |   | Permission Manager |   | Permission Manager |          |</span><br/><span>|  | Event Bus          |   | Event Bus          |   | Event Bus          |          |</span><br/><span>|  | Renderer           |   | Renderer           |   | Renderer           |          |</span><br/><span>|  +---------+----------+   +---------+----------+   +---------+----------+          |</span><br/><span>|            |                        |                        |                     |</span><br/><span>|            v                        v                        v                     |</span><br/><span>|       Screenshot API           Screenshot API           Screenshot API              |</span><br/><span>|       Action Sink              Action Sink              Action Sink                 |</span><br/><span>|       State Export             State Export             State Export                |</span><br/><span>|                                                                                    |</span><br/><span>+------------------------------------------------------------------------------------+</span><br/><span>                                    |</span><br/><span>                                    v</span><br/><span>+------------------------------------------------------------------------------------+</span><br/><span>|                             App / System Plugin Registry                           |</span><br/><span>|  System UI: launcher, status bar, quick settings, settings, keyboard, share sheet |</span><br/><span>|  Apps: WeChat, 12306, Alipay, Map, Weather, Notes, Gallery, etc.                  |</span><br/><span>+------------------------------------------------------------------------------------+</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 2. 维度 1：模拟器核心架构

## 设计选择

### 1.1 技术栈： **自研渲染引擎 + 声明式 App DSL** ，而不是直接用浏览器 DOM 或真 Android 模拟器

我会采用三层实现：

1. **App authoring 层** ：TypeScript/JSON DSL

   开发者用类似 React/Flutter 的声明式方式写页面与交互逻辑。

1. **布局层** ：Flexbox 风格布局引擎

   例如 Yoga/Taffy 这一类布局模型。

1. **渲染层** ：Headless 2D renderer

   输出固定分辨率 screenshot；支持文本、图片、圆角、阴影、滚动容器、列表复用、系统过渡动画。

### 1.2 并行与成本：**实例是轻量 actor，不是 VM**

一个 simulator instance 不是一个 Android VM，也不是一个完整浏览器 tab，而是：

* 一份世界状态
* 一棵当前 UI 树
* 一套任务栈 / App 栈
* 一个事件循环
* 一个按需渲染器

 **只在需要 observation 时渲染** ，而不是 60fps 常开。

### 1.3 App 隔离与交互：**逻辑隔离、物理同进程**

* 每个 App 拥有独立 namespace、权限、数据 schema、导航图。
* 运行时仍放在同一个 worker 进程中，由 isolate / sandbox 执行。
* 跨 App 通过系统层 `Intent Broker` 交互，不允许直接互相读写内存。

### 1.4 模拟粒度：**对齐 Android 的“用户可见语义”，不模拟完整系统**

保留这些系统机制：

* Activity / task / back stack
* Intent / deep link / implicit action
* 权限授予与拒绝
* 通知、状态栏、快捷设置
* 系统设置、软键盘、分享面板
* 时间、定位、网络、电量等环境变量

不做这些：

* 真 Linux kernel / Binder / APK 安装执行
* 完整 service lifecycle
* content provider 的真实实现
* package manager 全语义
* ART / Dalvik / JNI

## 理由

Android 的多 App 跳转，本质上依赖 task/back stack 与 Intent 语义；官方文档也明确说明，Android 以任务栈管理 Activity，Back 会弹栈返回上一个 Activity，而 Intent 是跨组件/跨 App 启动行为的核心消息对象。权限同样是系统级 gating 机制。对一个移动 GUI Agent 来说，这些是“视觉可感知且决定行为后果”的系统语义，值得保留。

## 放弃的备选方案

### 备选 A：真 Android 模拟器（AVD/QEMU）

 **优点** ：真实性最高。

 **放弃原因** ：

* 并行成本高
* 启动和重置慢
* snapshot 虽可恢复整机状态，但内存与镜像管理重，且对环境变更敏感。

### 备选 B：浏览器 DOM/CSS 直接模拟手机 UI

 **优点** ：开发快，生态成熟。

 **放弃原因** ：

* 每实例资源占用仍偏高
* CSS/DOM 会引入大量“不是手机 UI 的实现细节”
* 很容易在内部不小心暴露结构树，污染“纯视觉”设定
* 截图确定性与跨环境一致性不如自控 renderer

### 备选 C：完全纯图片世界

 **优点** ：最快。

 **放弃原因** ：

只能做录播式任务，不支持真实可组合交互、任意状态 reset、自动验证与任务参数化。

---

# 3. 维度 2：App 的设计与管理

## 设计选择

## 2.1 20–50 个 App 的构建方式：**混合方案**

我会把 App 分三部分做：

### 一层：通用 App 骨架库

预制 10～15 类高频模式：

* Feed / 列表 / 详情
* 搜索 / 筛选 / 排序
* 聊天 / 联系人 / 群聊
* 表单 / 支付 / 确认页
* 日历 / 待办 / 设置
* 地图 / POI / 导航
* 订单 / 票务 / 账单
* 图库 / 文件 / 二维码

### 二层：App manifest + 页面 schema

每个 App 只声明：

* 功能模块
* 支持的 Intent
* 权限需求
* 路由图
* 数据模型
* 页面视图树
* 页面动作处理器

### 三层：内容生成器

用模板 + 合成数据填充真实内容：

* 聊天记录
* 订单、账单、余额
* 餐厅、地点、天气
* 动态 feed、评论、收藏
* 车票、航班、日程

## 2.2 页面跳转管理：**层次化导航图（Hierarchical Navigation Graph）**

每个 App 都有自己的导航图，节点可分为：

* 页面节点
* Modal / Dialog 节点
* Bottom tab 子栈
* 临时系统页入口
* 外部跳转边

边带有：

* guard 条件
* 触发动作
* 状态更新
* 返回策略
* side effect 描述

## 2.3 新增 App 时系统层零改动：**插件化协议**

新增一个 App 只需要提交一个包：

<pre class="overflow-visible! px-0!" data-start="6462" data-end="6581"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>/app</span><br/><span>  manifest.yaml</span><br/><span>  routes.graph.json</span><br/><span>  views/</span><br/><span>  reducers/</span><br/><span>  effects/</span><br/><span>  schema/</span><br/><span>  fixtures/</span><br/><span>  verifiers/</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

系统只认标准接口，不认 App 名字。

## 2.4 静态配置与动态数据分层

### 静态层

* 功能列表
* 页面结构
* 视觉主题
* 路由图
* 权限声明
* Intent 声明
* verifier 定义
* 文案模板

### 动态层

* 用户实体数据
* 聊天/票务/余额/设置
* 运行时 session 状态
* 当前草稿内容
* 最近搜索
* 通知队列

## 理由

20–50 个 App 如果全手写，成本太高；如果全自动生成，语义一致性和跨 App 流程会很脆。

所以最现实的路径是：

* **交互骨架模板化**
* **业务语义人工约束**
* **内容数据自动合成**

这会让“视觉像真 App、逻辑可控、后续扩容快”三者同时成立。

## 放弃的备选方案

### 备选 A：全部手工逐屏开发

质量高，但扩展到 50 App 会非常慢。

### 备选 B：把真实 APK 反编译/录制后自动转成模拟 App

维护复杂，而且真实 App 的很多逻辑并不适合 benchmark：网络波动、灰度、AB test、服务端依赖太强。

### 备选 C：完全 LLM 自动生成 App

能出 demo，难出 benchmark。因为验证条件、数据一致性、跨 App 合约会很脆弱。

---

# 4. 维度 3：状态可控性

## 设计选择

## 3.1 一次 API 调用重置到任意状态：**世界状态快照 + patch 恢复**

定义统一的 `WorldState`：

<pre class="overflow-visible! px-0!" data-start="7242" data-end="7458"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>{</span><br/><span>  "system": { ... },</span><br/><span>  "apps": {</span><br/><span>    "wechat": { ... },</span><br/><span>    "alipay": { ... },</span><br/><span>    "railway12306": { ... }</span><br/><span>  },</span><br/><span>  "relations": { ... },</span><br/><span>  "clock": { ... },</span><br/><span>  "rng_seed": </span><span class="ͼj">12345</span><span>,</span><br/><span>  "ui_session": { ... }</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Reset 流程：

1. 加载基准 snapshot
2. 应用 task patch
3. 重建 materialized view
4. 生成首屏 UI
5. 返回 observation 和 state hash

## 3.2 系统状态与 App 状态统一管理：**单一真相源**

所有组件都只读写同一份 canonical state：

* `system.connectivity.wifi_enabled`
* `system.clock.now`
* `system.location`
* `apps.wechat.chats`
* `apps.alipay.balance`
* `apps.railway12306.orders`

状态栏、设置页、快捷设置、App 网络状态都从这一份状态派生。

## 3.3 持久化策略：**事件日志 + 周期性快照**

* 高频恢复：二进制快照
* 审计与重放：事件日志
* 调试：结构化 state diff

原则是：

* **只有 canonical store 持久化**
* UI cache 不持久化
* 派生数据随时可重算

## 3.4 外部结构化读取全量状态：**只读 state export API**

提供：

* `/state/full`
* `/state/diff?since=...`
* `/state/projection?scope=system|app|task`
* `/trace/events`

benchmark 框架可直接基于状态做成功判定和副作用检测。

## 理由

真实 Android 上，snapshot 可以保存整机状态，但对于 benchmark，我们需要的不是“保存一台机器”，而是“保存一个世界”。前者太重，后者才适合参数化任务、快速 reset 和结构化验证。AVD snapshot 的确能保存 OS 设置、应用状态和用户数据，但操作本身内存重，而且对版本/配置变化敏感。

## 放弃的备选方案

### 备选 A：每个组件自己存自己的状态

最容易产生不一致：WiFi 图标和设置页显示可能不同步。

### 备选 B：只保存 UI 树，不保存底层数据

无法做精确成功判定，也无法检测副作用。

---

# 5. 维度 4：任务定义与评估

## 设计选择

## 4.1 benchmark 任务结构

一个任务定义为：

<pre class="overflow-visible! px-0!" data-start="8537" data-end="9174"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>task_id: weather_tomorrow_city_lookup</span><br/><span>instruction_template: </span><span class="ͼk">"查看明天{city}的天气"</span><br/><span>seed: 84721</span><br/><span>initial_state_ref: base_world_v3</span><br/><span>state_patch: ...</span><br/><span>parameter_sampler: ...</span><br/><span>allowed_apps: [weather]</span><br/><span>success_predicates:</span><br/><span>  - type: state</span><br/><span>    expr: apps.weather.last_view.city == params.city</span><br/><span>  - type: state</span><br/><span>    expr: apps.weather.last_view.date == clock.now + 1 day</span><br/><span>side_effect_constraints:</span><br/><span>  - expr: no_forbidden_mutation()</span><br/><span>partial_credit:</span><br/><span>  - milestone: opened_weather_app</span><br/><span>    weight: 0.2</span><br/><span>  - milestone: searched_city</span><br/><span>    weight: 0.3</span><br/><span>  - milestone: viewed_target_day</span><br/><span>    weight: 0.5</span><br/><span>difficulty_tags: [single_app, temporal_reference, search]</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

## 4.2 成功判定：**以状态检查为主，VLM 为辅的混合方案**

优先级：

1. **结构化状态谓词**

   最稳定、最可重复。
2. **轨迹约束**

   要求经过某些关键节点，或至少发生过某类动作。
3. **VLM 评判**

   只用于无法结构化定义的感知类开放任务。

默认 benchmark 主榜只用 1+2，不把 3 作为主要计分依据。

## 4.3 参数化任务：**模板 + 随机参数 + 状态生成器**

比如“在微信里找到张三二维码”：

* 联系人名随机采样
* 关系链随机采样
* 聊天列表位置随机
* 是否置顶、是否有未读、是否群聊同名人随机
* instruction 文本表述随机改写

这样一个模板可生成无限实例。

AndroidWorld 之所以有价值，正是因为它把 hand-crafted task 做成了 **动态参数化** ，从而能生成大量独特变体，而不是死的测试集。

## 4.4 跨 App 任务：**目标图（Goal Graph）**

例子：

“在小红书看到一家餐厅，然后在地图上搜索它的位置。”

定义成多阶段目标：

* G1：在小红书页面中查看目标餐厅信息
* G2：提取餐厅实体
* G3：地图 App 打开并搜索该实体
* G4：地图定位到正确 POI

成功条件是终态满足 G4，且 G1 必须先发生。

MobileWorld 的动机之一就是现有移动 benchmark 需要更多长时程、多 App 工作流；它报告的多 App 任务占比和平均步长都明显高于 AndroidWorld。这个趋势判断是对的，所以平台设计必须从一开始把跨 App 当一等公民。

## 4.5 副作用检测：**允许写集 + 禁止写集 + 终态 diff**

任务除了 success predicate，还必须声明：

* **Allowed Write Set** ：哪些字段允许变
* **Forbidden Predicate** ：哪些状态绝不能改变
* **Soft Penalty** ：哪些改动扣分但不致命

例子：

任务：在微信中找到张三二维码

允许变化：

* `ui_session.*`
* `apps.wechat.last_opened_contact == 张三`
* `apps.wechat.qr_viewer.opened == true`

禁止变化：

* `apps.wechat.contacts["张三"].mute`
* `apps.wechat.contacts["张三"].pinned`
* `apps.wechat.contacts["张三"].remark`
* 任何消息发送状态

Agent 找到了二维码，但把“免打扰”打开了，终态 diff 一比对就能抓到。

## 4.6 Partial credit：**里程碑 DAG + 负向约束**

给分公式：

<pre class="overflow-visible! px-0!" data-start="10502" data-end="10567"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>score = Σ(达成里程碑权重)</span><br/><span>      - Σ(副作用惩罚)</span><br/><span>      - Σ(越界动作惩罚)</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

这样不是 0/1，而是：

* 找到目标 App：0.1
* 到达正确联系人：0.4
* 打开二维码页：0.5
* 误开免打扰：-0.3

## 放弃的备选方案

### 备选 A：完全人工录像回放比对

很难参数化，也无法检测副作用。

### 备选 B：完全让 VLM 看图打分

不稳定、成本高、复现差。

---

# 6. 维度 5：导航与交互的形式化

## 设计选择

## 5.1 可达 UI 状态与动作的机器可枚举性：**隐藏语义树 + 转移系统**

每一帧屏幕背后都有一棵 **不可见的语义树** ：

<pre class="overflow-visible! px-0!" data-start="10828" data-end="11133"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>{</span><br/><span>  "node_id": </span><span class="ͼk">"wechat.chat.item.14"</span><span>,</span><br/><span>  "role": </span><span class="ͼk">"button"</span><span>,</span><br/><span>  "bbox": [x</span><span class="ͼj">1</span><span>, y</span><span class="ͼj">1</span><span>, x</span><span class="ͼj">2</span><span>, y</span><span class="ͼj">2</span><span>],</span><br/><span>  "enabled": </span><span class="ͼj">true</span><span>,</span><br/><span>  "visible": </span><span class="ͼj">true</span><span>,</span><br/><span>  "text_semantics": </span><span class="ͼk">"张三"</span><span>,</span><br/><span>  "actions": [</span><span class="ͼk">"tap"</span><span>],</span><br/><span>  "transitions": [</span><br/><span>    {</span><br/><span>      "guard": </span><span class="ͼk">"..."</span><span>,</span><br/><span>      "effect": </span><span class="ͼk">"..."</span><span>,</span><br/><span>      "target": </span><span class="ͼk">"wechat.contact_detail"</span><br/><span>    }</span><br/><span>  ]</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

这棵树：

* 给 verifier、任务生成器、专家策略使用
* **绝不通过 agent observation API 暴露**

Agent 永远只看到 screenshot。

## 5.2 不让纯视觉 Agent 看到内部标记

技术上隔离为两条平面：

* **Pixel plane** ：Agent 唯一可见
* **Semantic plane** ：平台内部使用

任何 debug overlay、node id、bbox 都不进 screenshot buffer。

## 5.3 形式化描述：**层次化标签转移系统（Hierarchical Labeled Transition System）**

我不会用简单 FSM，而会用 **层次化状态图** ，因为手机 UI 不是平面状态机：

* 有 modal
* 有 nested navigation
* 有 bottom tabs 各自保持栈
* 有跨 App 调用返回
* 有系统 UI 插层

全局状态记为：

<pre class="overflow-visible! px-0!" data-start="11582" data-end="11665"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>S = (WorldData, SystemUIState, AppStacks, ForegroundTask, SessionState)</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

动作分两层：

* 外层：Agent 动作

  `tap(x,y)`, `swipe(...)`, `type(text)`, `back`, `home`
* 内层：平台语义动作

  `tap(node_id)`, `scroll(view_id, delta)`, `dispatch_intent(...)`

这允许：

* 自动生成任务
* 自动验证轨迹
* 自动求专家最短路径
* 做 reachable-state 分析

## 放弃的备选方案

### 备选 A：只存屏幕截图，不存语义结构

无法自动验收，也无法生成专家轨迹。

### 备选 B：把 accessibility tree 直接暴露给 Agent

违背题设“纯视觉”前提。

---

# 7. 维度 6：数据合成与轨迹收集

## 设计选择

## 6.1 人类示范轨迹：**teleoperation + 自动专家混合**

### 人类数据

提供一个远程操作台，人类通过浏览器远控 simulator：

* 看实时屏幕
* 点击/滑动/输入
* 平台自动录 trace

### 自动专家数据

由于平台有隐藏语义图，可以构造专家策略：

* 图搜索最短路径
* 带噪声的近人类策略
* 多策略混合采样

最终训练集来自：

* 人类示范
* 自动专家
* 人类修正自动轨迹
* self-play / policy improvement

## 6.2 轨迹字段

每一步记录：

* task_id / seed / instruction
* step_idx
* screenshot_before / after
* action_low_level（坐标、文本）
* action_semantic（node_id、动作类型）
* pre_state_hash / post_state_hash
* state_diff
* visible_node_set_hash
* 当前前台 App / 页面
* milestone label
* success / side effect flags
* latency / timeout / retry info

## 6.3 多样性与真实性

通过 6 个来源制造多样性：

1. 文案 paraphrase
2. 动态数据内容变化
3. 页面元素布局轻微扰动
4. 主题 / 深色模式 / 字体大小变化
5. 人类点击噪声与路径差异
6. 多条合法完成路径

## 放弃的备选方案

### 备选 A：只采最短路径专家

会严重失真，人类不会总是最短。

### 备选 B：只用众包人类数据

成本太高，而且覆盖率难做满。

---

# 8. 维度 7：与 Android 系统的对齐程度

## 设计选择

## 7.1 应该对齐到什么程度

我的原则是：

**只对齐“用户可见且会改变任务成败”的 Android 机制。**

值得模拟的：

* task / back stack
* Intent 分发
* 权限弹窗与授权状态
* App 沙箱语义
* 通知、状态栏、系统设置
* 分享、文件选择、图片选择
* 时间、定位、网络、电量
* 前后台切换、最近任务

不值得完整模拟的：

* Binder 细节
* 真实 Linux UID / SELinux
* service / broadcast 的全生命周期
* JobScheduler / AlarmManager 全功能
* 包管理器、安装升级
* 真实 WebView / 浏览器内核

Android 真机上，App 之间的隔离基于 UID 与进程边界；这是安全模型的基础。我们的 simulator 不需要复制其内核实现，但需要复制它的 **语义后果** ：默认 App 不能随便互相读状态，跨 App 行为必须经过系统 broker。

## 7.2 判断标准

一个 Android 机制是否值得做，看三条：

1. **用户是否能看见**
2. **是否影响多 App 任务成败**
3. **是否影响 benchmark 的可验证性**

满足 2 条以上就做。

## 7.3 时间、地理位置等环境变量的注入

环境变量全部从 `system.env` 注入：

<pre class="overflow-visible! px-0!" data-start="13527" data-end="13831"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>{</span><br/><span>  "clock": {</span><br/><span>    "now": </span><span class="ͼk">"2026-03-07T09:00:00+09:00"</span><span>,</span><br/><span>    "timezone": </span><span class="ͼk">"Asia/Tokyo"</span><br/><span>  },</span><br/><span>  "location": {</span><br/><span>    "lat": </span><span class="ͼj">31.2304</span><span>,</span><br/><span>    "lng": </span><span class="ͼj">121.4737</span><br/><span>  },</span><br/><span>  "connectivity": {</span><br/><span>    "wifi_enabled": </span><span class="ͼj">true</span><span>,</span><br/><span>    "cellular_enabled": </span><span class="ͼj">false</span><br/><span>  },</span><br/><span>  "battery": {</span><br/><span>    "level": </span><span class="ͼj">0.42</span><span>,</span><br/><span>    "charging": </span><span class="ͼj">false</span><br/><span>  }</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

所有 App 与系统 UI 只能从这里读取。

## 放弃的备选方案

### 备选 A：尽量完全模仿 AOSP

研发成本会被系统细节吞掉，反而无助于 benchmark。

### 备选 B：完全不对齐 Android 语义

看起来像手机，但一到跨 App、返回、权限、系统设置就会失真。

---

# 9. 维度 8：benchmark 编排与执行

## 设计选择

## 8.1 benchmark 与模拟器通信：**gRPC 主协议 + HTTP 网关**

* **gRPC** ：高性能、类型化、双向流，适合 runner
* **HTTP/JSON** ：方便调试和接第三方 Agent
* **WebSocket** ：给人工遥操作和可视化控制台

核心 API：

* `CreateInstance`
* `ResetInstance`
* `GetObservation`
* `Step`
* `GetState`
* `Evaluate`
* `DestroyInstance`

## 8.2 支持并行执行：**worker 池 + snapshot cache + actor 调度**

每个 worker 跑很多 instance actor。

实例启动流程：

* 从基础 world snapshot 克隆
* 应用任务 patch
* 渲染首帧
* 等待 Agent actions

没有 VM，没有 emulator boot，所以并发密度高得多。

## 8.3 执行流程

<pre class="overflow-visible! px-0!" data-start="14495" data-end="14782"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>1. benchmark 选择 task template + seed</span><br/><span>2. simulator reset 到初始世界</span><br/><span>3. 注入 instruction 与 task metadata</span><br/><span>4. Agent 循环：</span><br/><span>   screenshot -> policy -> action -> env step</span><br/><span>5. 达到 success / fail / timeout / crash</span><br/><span>6. evaluator 计算成功、partial credit、副作用、效率指标</span><br/><span>7. 存储 trace、state diff、日志</span><br/><span>8. 实例销毁或回收到池中</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

## 8.4 异常处理

### Agent 超时

* wall clock timeout
* max step timeout
* no-progress timeout

### Agent 卡死

* 连续 N 步屏幕 hash 几乎不变
* 连续重复动作模式检测

### 模拟器崩溃

* worker heartbeat
* 实例级 checkpoint
* crash 后自动重建
* 结果标记为 infra failure，而非 task failure

## 放弃的备选方案

### 备选 A：只做进程内调用

最快，但不利于分布式 benchmark。

### 备选 B：只做 HTTP

易用，但流式交互和高频 step 成本偏高。

---

# 10. 额外真实场景处理

## 场景 1：WiFi 开关切换如何保持所有组件一致

### 方案

WiFi 只允许通过一处 canonical state 更新：

<pre class="overflow-visible! px-0!" data-start="15204" data-end="15248"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>system.connectivity.wifi_enabled</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

当它变化时，事件总线发出：

<pre class="overflow-visible! px-0!" data-start="15265" data-end="15316"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>ConnectivityChanged(wifi_enabled=false)</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

订阅者包括：

* 状态栏图标投影器
* 快捷设置面板
* 系统设置页面
* App 网络能力判断
* 可能的 toast / banner / retry UI

这样四处显示天然一致。

### 关键点

任何 UI 页面都不直接持有“自己的 WiFi 状态副本”。

---

## 场景 2：12306 订票 → 跳转支付宝付款 → 返回 12306 看结果

### 方案

系统层实现 `Intent Broker + Call/Return Frame`：

1. 12306 发起 `PAYMENT_INTENT`
2. broker 解析到支付宝
3. 当前 12306 页面压入 suspended frame
4. 支付宝前台处理支付
5. 支付宝返回 `PaymentResult(success, order_id, txn_id)`
6. broker 恢复 12306 frame
7. 12306 根据返回结果更新订单页

### 为什么这样做

Android 的跨组件/跨 App 启动本来就是 Intent 驱动，而 Back/栈恢复也是系统负责。我们不复刻 Android 内部实现，但复刻其对用户可见的行为语义。

---

## 场景 3：找到张三二维码了，但不小心设成免打扰

### 方案

任务定义中显式声明：

* allowed writes
* forbidden writes
* soft penalties

终态比较：

<pre class="overflow-visible! px-0!" data-start="15994" data-end="16055"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>diff(final_state, initial_state) - allowed_writes</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

若包含：

`apps.wechat.contacts["张三"].mute = true`

则：

* success predicate 可能满足
* side effect predicate 失败
* 最终结果记为 fail 或扣分 fail，取决于 benchmark 规则

---

## 场景 4：任务要求“查看明天的天气”，如何保证一致

### 方案

任务永远绑定一个 **逻辑时钟锚点** ，例如：

<pre class="overflow-visible! px-0!" data-start="16266" data-end="16315"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>clock.now = 2026-03-07T09:00:00+09:00</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

“明天”在任务编译时解析为：

<pre class="overflow-visible! px-0!" data-start="16333" data-end="16369"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>target_date = 2026-03-08</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

因此不管真实世界今天是哪天，这个任务含义始终一致。

---

## 场景 5：同时运行 64 个实例

### 方案

靠三点：

1. **不跑 Android VM**
2. **不常驻 60fps 渲染**
3. **实例是 actor + snapshot clone**

为 64 并行做的专门优化：

* 页面资源共享缓存
* 字体与 icon atlas 共享
* 图片 lazy decode
* observation 请求时才 rasterize
* state patch 克隆而不是全量深拷贝
* trace 异步落盘

我的预期是：

64 并行不应依赖 GPU 虚拟化，也不应依赖每实例独立 browser。真正的容量上限取决于截图分辨率、App 复杂度和 Agent step 频率，但这个架构从原理上就是为 64～100+ 设计的。

---

# 11. 我认为最难的 3 个子问题

## 难题 1：如何既让 Agent 只看像素，又让平台内部可枚举、可验证

这是最难的，因为：

* benchmark 需要结构化语义
* 纯视觉 Agent 又不能拿到语义

### 解法

双平面设计：

* 对 Agent：只暴露 screenshot
* 对平台：维护隐藏语义树与转移图

并在工程上严格保证：

* screenshot buffer 中不绘制任何调试层
* 语义树只存在 control plane / verifier 内部
* 训练和评测默认不开放辅助 API

---

## 难题 2：跨 App 流程的一致性与可重置性

例如：

* 12306 发起支付
* 支付宝变更余额
* 订单状态回流到 12306
* 状态栏/通知也可能变化

如果各 App 自己存状态，必然不一致。

### 解法

单一世界状态 + broker：

* 所有业务实体在 canonical store 中
* App 只看自己授权可见的 projection
* 跨 App 必经 intent / callback 合约
* reset 永远基于世界快照，而不是 UI 回放

---

## 难题 3：副作用与 partial credit 的统一计分

0/1 很简单，但现实任务不是这样的。

Agent 可能“完成主目标，但污染状态”。

### 解法

把任务评估拆成三层：

1. 主目标是否达成
2. 过程里程碑是否达成
3. 是否违反 side-effect invariants

于是任务结果不是单一布尔值，而是：

<pre class="overflow-visible! px-0!" data-start="17463" data-end="17570"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>{</span><br/><span>  "success": </span><span class="ͼj">false</span><span>,</span><br/><span>  "goal_score": </span><span class="ͼj">1.0</span><span>,</span><br/><span>  "side_effect_penalty": </span><span class="ͼj">0.6</span><span>,</span><br/><span>  "final_score": </span><span class="ͼj">0.4</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 12. 我有意识做的简化与妥协

## 妥协 1：不支持真实 APK 直接运行

这是最大妥协。

代价是真实度不如真机。

收益是：

* 可编程
* 可重置
* 可验证
* 可高并行

我认为这是值得的。

## 妥协 2：只模拟与任务相关的 Android 机制

不做完整 AOSP。

否则系统工程会压倒 benchmark 工程。

## 妥协 3：默认不追求像素级复刻所有动画

保留关键转场、滚动、按钮反馈、加载态即可。

没必要复刻所有 OEM 级细节。

## 妥协 4：评测主轴放在结构化状态，不追求纯视觉评分

这会让 benchmark 更可重复，也更适合长期做 leaderboard。

## 妥协 5：App 内容高度合成化

数据是“足够像真”，不是“真实互联网世界镜像”。

这是为了可控与无限参数化。

---

# 13. 最终建议：一个实际可执行的分阶段落地路线

## Phase 1：内核与系统壳

先做：

* renderer
* state store
* task/back stack
* intent broker
* status bar / settings / quick settings / keyboard

## Phase 2：10 个高价值 App

优先做：

* 微信
* 支付宝
* 12306
* 地图
* 天气
* 相册
* 文件
* 日历
* 备忘录
* 小红书/点评类内容 App

## Phase 3：benchmark v1

发布：

* 100～200 个任务模板
* 单 App + 多 App 混合
* deterministic verifier
* side-effect checker
* partial credit

## Phase 4：训练生态

补齐：

* 人类遥操作采集
* 自动专家轨迹
* 难例挖掘
* curriculum

---

# 14. 一句话总结

**最优解不是“把 Android 搬进数据中心”，而是“把 Android 中决定 GUI Agent 成败的那部分语义抽出来，做成一个可渲染、可重置、可验证、可并行的仿真世界”。**

这套方案的核心优势是四个词：

**像真、可控、可验、可扩。**

如果你愿意，我下一步可以把这份设计继续细化成两种版本之一：

 **“系统设计 RFC”** ，或者  **“可直接开工的模块拆解与接口定义”** 。
