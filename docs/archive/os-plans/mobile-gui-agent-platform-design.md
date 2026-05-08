# 面向移动端 GUI Agent 的模拟器与基准测试平台——完整技术设计文档

---

## 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Benchmark Orchestrator                        │
│  (任务调度 / 并发控制 / 结果收集 / 评分汇总)                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP REST + WebSocket
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Simulator Pod  │ │  Simulator Pod  │ │  Simulator Pod  │  × N (64+)
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │ UI Engine │  │ │  │ UI Engine │  │ │  │ UI Engine │  │
│  │(React/Web)│  │ │  │(React/Web)│  │ │  │(React/Web)│  │
│  └─────┬─────┘  │ │  └─────┬─────┘  │ │  └─────┬─────┘  │
│  ┌─────▼─────┐  │ │  ┌─────▼─────┘  │ │  ┌─────▼─────┐  │
│  │System Bus │  │ │  │System Bus │  │ │  │System Bus │  │
│  │(事件总线) │  │ │  │(事件总线) │  │ │  │(事件总线) │  │
│  └─────┬─────┘  │ │  └─────┬─────┘  │ │  └─────┬─────┘  │
│  ┌─────▼─────┐  │ │        ...      │ │        ...      │
│  │State Store│  │ │                 │ │                 │
│  │(单一数据源)│ │ │                 │ │                 │
│  └───────────┘  │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Shared Infrastructure                            │
│  App Registry | Task Registry | Trajectory Store | Eval Engine       │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据流概览

```
Agent
  │  POST /screenshot (获取截图)
  │  POST /action {type, x, y, text}
  ▼
Simulator Pod API Layer
  │  解析动作 → 发送到 UI Engine
  │  触发状态变更 → System Bus 广播
  ▼
State Store (单一数据源)
  │  App 订阅相关 slice → 重渲染
  │  Benchmark 轮询 / 订阅状态快照
  ▼
Eval Engine
  └─ 比对 state diff → 判定成功/副作用/部分得分
```

---

## 维度 1：模拟器核心架构

### 1.1 技术栈选择：浏览器渲染（React + Headless Chromium）

**选择：** 每个模拟器实例是一个运行在 Docker 容器内的 Headless Chromium 进程，渲染一个以 React 编写的「手机 UI 框架」。屏幕截图通过 Puppeteer/Playwright 的 `page.screenshot()` 获取，动作通过 `page.mouse.click()` / `page.keyboard.type()` 注入。

**理由：**

| 指标 | 浏览器渲染 | Android Emulator (QEMU) | 自研渲染引擎 |
|------|-----------|------------------------|-------------|
| 视觉真实感 | ★★★★☆（CSS 可高度模拟原生） | ★★★★★ | ★★★☆☆ |
| 并行成本 | ★★★★★（~200MB RAM/实例） | ★★☆☆☆（~2GB RAM/实例） | ★★★★☆ |
| 可编程性 | ★★★★★（DOM + JS 完全可控） | ★★★☆☆（adb 间接控制） | ★★★★★ |
| 开发成本 | ★★★★☆（Web 生态成熟） | ★★☆☆☆（Android 构建复杂） | ★☆☆☆☆（从零建设） |
| 状态可控 | ★★★★★（JS 直接操作状态） | ★★★☆☆（snapshots 有开销） | ★★★★★ |

**关键设计：** 模拟器外壳固定为 390×844 像素（iPhone 14 分辨率），模拟手机边框、状态栏、导航栏。内容区域由各 App 组件填充。Agent 只能看到这张截图，无法访问底层 DOM。

**放弃的方案：**
- **Android Emulator（QEMU）：** 单实例需要 2-4 GB RAM + KVM 硬件虚拟化，64 个并行实例需要专用物理机集群，成本过高；状态重置需要 cold boot（30s+），严重影响 benchmark 吞吐。
- **自研渲染引擎：** 工程量极大，缺少字体渲染、图片格式等生态支持，长期维护成本高。

### 1.2 高并行设计

```yaml
# 每个 Simulator Pod 的资源配额
resources:
  requests:
    memory: "256Mi"
    cpu: "0.25"
  limits:
    memory: "512Mi"
    cpu: "1.0"
```

- **容器化隔离：** 每个实例一个 Docker 容器，状态完全隔离，无需 VM 开销。
- **Headless 模式：** 不渲染到物理显示器，节省 GPU/显示资源。使用 `--disable-gpu` 纯 CPU 软渲染，或共享 GPU 虚拟化（vGPU）。
- **截图懒获取：** 截图只在 Agent 请求时按需生成，不主动推送。
- **64 实例估算：** 64 × 512MB = 32GB RAM，运行在 2-4 台标准云主机（16 核 64GB）上即可满足。

### 1.3 App 隔离与进程模型

**选择：** 所有 App 运行在**同一 Chromium 进程、同一 React 应用**内，但逻辑隔离。

```
┌─ React App (单进程) ────────────────────┐
│  Router: /wechat, /alipay, /settings    │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │ WeChat  │  │ Alipay   │  │Settings│ │
│  │Component│  │Component │  │        │ │
│  └─────────┘  └──────────┘  └────────┘ │
│  ↑ 共享 State Store（分 namespace 隔离）│
└─────────────────────────────────────────┘
```

**理由：** 同进程路由切换（< 16ms）远快于进程间通信；App 间数据共享（如联系人）可直接读 State Store 同一份数据，无需 IPC；浏览器天然的同源隔离已足够防止 App 间意外干扰。

### 1.4 模拟粒度：UI 层 + 轻量系统语义层

不模拟 Android 内核级别（无 Binder IPC、无真实 ART 虚拟机），但实现以下「系统语义」：

- **系统状态层：** WiFi、蓝牙、电量、时间、地理位置（影响 UI 的那些）
- **App 生命周期：** 前台/后台切换、「最近任务」列表
- **跨 App 调用协议：** 模拟 Intent-like 的显式跳转（见维度 7）
- **权限模型：** 静态声明式（App manifest 中声明权限，无运行时 prompt）

**放弃的内容：** Activity 返回栈的精确 backstack 管理、Service / BroadcastReceiver、真实文件系统、ContentProvider。这些对视觉 Agent 评测不产生区分度，但会带来大量工程复杂性。

---

## 维度 2：App 的设计与管理

### 2.1 App 构建策略：Schema-Driven 混合生成

**核心思想：** 每个 App 由一份 JSON Schema 驱动，React 框架根据 Schema 渲染。

```
App = Schema（静态配置）+ Data（动态数据）+ React Template（渲染逻辑）
```

```json
// apps/wechat/schema.json（静态配置）
{
  "appId": "wechat",
  "displayName": "微信",
  "icon": "wechat.png",
  "routes": [
    { "path": "/chat-list", "template": "ChatList", "requires": ["contacts", "messages"] },
    { "path": "/chat/:contactId", "template": "ChatDetail", "requires": ["messages"] },
    { "path": "/contacts", "template": "ContactList", "requires": ["contacts"] }
  ],
  "capabilities": ["send_message", "view_qrcode", "set_do_not_disturb"]
}
```

```json
// state/wechat.json（动态数据，运行时注入）
{
  "contacts": [
    { "id": "zhangsan", "name": "张三", "avatar": "...", "doNotDisturb": false }
  ],
  "messages": {
    "zhangsan": [
      { "id": "m1", "from": "zhangsan", "text": "你好", "timestamp": 1700000000 }
    ]
  }
}
```

**React Template** 是预写的通用组件（如 `ChatList`、`ChatDetail`），只负责从 State Store 读数据并渲染，不包含业务逻辑。

**效率估算：** 开发一套新 App 只需：① 写 schema.json（1h）② 准备初始 data（0.5h）③ 若已有 Template 则零开发，若需新 Template 则 1-2 天。20 个 App 约 2-3 周完成骨架。

### 2.2 路由/页面跳转管理

使用 React Router v6，路由路径格式为 `/{appId}/{page}/{...params}`：

```
/wechat/chat-list
/wechat/chat/zhangsan
/alipay/home
/alipay/transfer
/settings/wifi
```

跳转通过 `dispatch(navigate({ path: '/alipay/home', trigger: 'external', returnPath: '/wechat/chat-list' }))` 实现，State Store 记录导航历史，支持「返回」语义。

### 2.3 新增 App 零侵入

新增 App 只需：
1. 在 `apps/` 目录下创建子目录，放入 `schema.json`
2. App Registry 在启动时自动扫描 `apps/*/schema.json` 并注册路由
3. State Store 自动为新 App 创建 namespace

系统层代码完全不需修改。

### 2.4 静态配置与动态数据分层

```
Config Layer（不变）：App 的功能列表、UI 结构、路由定义
    ↕ 编译时绑定
Template Layer（可复用）：React 组件，实现通用 UI 模式
    ↕ 运行时注入
Data Layer（可变）：用户数据、业务数据，支持快照/恢复
    ↕ 状态订阅
Derived Layer（计算）：如未读消息数 = count(messages where read=false)
```

---

## 维度 3：状态可控性

### 3.1 单次 API 调用重置到任意状态

```http
POST /simulator/reset
Content-Type: application/json

{
  "snapshot_id": "task_12306_001",   // 使用预定义快照
  // 或者：
  "state": {                          // 直接指定完整状态
    "system": { "wifi": true, "time": "2024-03-15T09:00:00", "location": {...} },
    "apps": {
      "wechat": { "contacts": [...], "messages": {...} },
      "alipay": { "balance": 1000.00 }
    },
    "navigation": { "current": "/launcher" }
  }
}
```

实现：React 应用监听 `/simulator/reset` 事件，调用 `store.dispatch(resetState(newState))`，React 重渲染完成后返回 `{ ready: true, screenshot_url: "..." }`。整个过程 < 100ms。

### 3.2 状态统一管理：单一数据源

**核心原则：** 所有状态存在唯一的 State Store（Redux 或 Zustand），任何组件不得在 Store 之外维护状态。

```
State Store（完整结构）
├── system/
│   ├── wifi: boolean
│   ├── battery: number (0-100)
│   ├── time: ISO8601 string  ← 所有组件从这里读时间，不调用 Date.now()
│   ├── location: { lat, lng, city }
│   └── notifications: []
├── navigation/
│   ├── currentPath: string
│   ├── history: string[]
│   └── pendingReturn: string | null  ← 跨 App 返回用
└── apps/
    ├── wechat/
    │   ├── contacts: Contact[]
    │   └── messages: Record<contactId, Message[]>
    ├── alipay/
    │   └── balance: number
    └── settings/
        └── (mirrors system/ 的设置项，读写都通过 system/ 代理)
```

**WiFi 一致性问题的解法：** `system.wifi` 是唯一数据源。状态栏组件、快捷设置面板、系统设置页面、App 内网络状态都 `useSelector(state => state.system.wifi)` 而不是各自维护副本。修改 WiFi 状态只需 `dispatch(setWifi(false))`，所有订阅组件自动重渲染，天然一致。

### 3.3 持久化策略

```
State Store（内存，权威）
    ↕ 每次 reset 时全量覆写
Snapshot Store（文件/Redis，只读）
    ├── predefined/   ← task 定义中引用的快照，离线生成
    └── session/      ← benchmark 运行时动态保存的检查点
```

**不持久化运行时状态到数据库**：每次实验是无状态的，reset 时从 snapshot 文件恢复即可。无需数据库，避免一致性问题。

### 3.4 外部状态读取：结构化快照 API

```http
GET /simulator/state
→ 返回完整 State Store 的 JSON 序列化

GET /simulator/state?path=apps.wechat.contacts
→ 返回指定路径的值

GET /simulator/state/diff?since=<checkpoint_id>
→ 返回自检查点以来的状态变更列表（用于副作用检测）
```

---

## 维度 4：任务定义与评估

### 4.1 任务结构定义

```typescript
interface Task {
  // 元数据
  id: string;                    // "wechat_find_qrcode_001"
  template_id: string;           // 参数化模板 ID
  instruction: string;           // Agent 看到的自然语言指令
  difficulty: "easy"|"medium"|"hard"|"expert";
  tags: string[];                // ["single-app", "read-only", "navigation"]
  
  // 环境
  initial_state: StateSnapshot | SnapshotId;
  system_time: string;           // 固定时间，解决"明天"问题
  
  // 评估
  success_criteria: SuccessCriteria[];
  side_effect_checks: SideEffectCheck[];
  partial_credit_rubric: CreditRubric;
  
  // 执行控制
  max_steps: number;             // Agent 最大操作步数
  timeout_seconds: number;
}

interface SuccessCriteria {
  type: "state_check" | "vlm_judge" | "composite";
  // state_check: 直接断言 state 路径的值
  path?: string;                 // "apps.wechat.contacts[id=zhangsan].doNotDisturb"
  expected?: any;
  operator?: "eq"|"neq"|"contains"|"gt"|"lt";
  // vlm_judge: 发给 VLM 评判截图
  vlm_prompt?: string;
  // composite: 多条件组合
  children?: SuccessCriteria[];
  logic?: "AND"|"OR";
}
```

### 4.2 成功判定：分层混合策略

**优先级：**

```
Level 1（首选）：状态检查（state_check）
  ├── 速度快（< 1ms）、确定性强、可重现
  └── 适用于：数值变化、布尔切换、列表增删

Level 2（补充）：VLM 评判（vlm_judge）
  ├── 用于无法精确提取状态的情况
  └── 适用于：「截图中是否显示了张三的二维码」（视觉内容判定）

Level 3（兜底）：人工标注
  └── 用于 VLM 置信度低的边缘案例
```

**VLM 评判的使用原则：** 只在 state_check 无法覆盖的视觉内容任务中使用，避免用 VLM 做能精确计算的事（如「余额是否变为 50 元」应用 state_check，而非 VLM）。

### 4.3 参数化任务防止过拟合

```python
# tasks/templates/wechat_send_message.py
class WechatSendMessageTask(TaskTemplate):
    template_id = "wechat_send_message"
    
    def sample(self, rng: Random) -> Task:
        contact = rng.choice(self.contacts_pool)   # 从联系人池随机选
        message = rng.choice(self.message_pool)    # 从消息模板池随机选
        
        return Task(
            instruction=f"在微信中给{contact.name}发一条消息：{message}",
            initial_state=self.build_state(contact),
            success_criteria=[
                StateCheck(
                    path=f"apps.wechat.messages.{contact.id}[-1].text",
                    expected=message,
                    operator="eq"
                )
            ]
        )
```

每个 TaskTemplate 定义参数空间（联系人池、金额范围、时间范围等），可生成近乎无限的实例。Benchmark 运行时按 seed 生成，保证可重现。

### 4.4 跨 App 任务定义与判定

```json
{
  "id": "xiaohongshu_to_map_001",
  "instruction": "在小红书中找到帖子里提到的餐厅，然后在地图上搜索它",
  "initial_state": {
    "apps": {
      "xiaohongshu": {
        "feed": [{ "id": "post1", "text": "强烈推荐「外婆家」，地址在西湖区" }]
      },
      "map": { "search_history": [] }
    },
    "navigation": { "current": "/xiaohongshu/feed" }
  },
  "success_criteria": [
    {
      "type": "composite",
      "logic": "AND",
      "children": [
        { "type": "state_check", "path": "apps.map.last_search_query", "expected": "外婆家", "operator": "contains" },
        { "type": "state_check", "path": "navigation.currentPath", "expected": "/map/search", "operator": "eq" }
      ]
    }
  ]
}
```

**跨 App 任务的关键：** success_criteria 可以同时检查多个 App 的状态，天然支持跨 App 判定。

### 4.5 副作用检测

```python
def check_side_effects(task: Task, state_before: State, state_after: State) -> List[SideEffect]:
    # 计算状态 diff
    diff = deep_diff(state_before, state_after)
    
    # 过滤掉预期变更（success_criteria 中声明的路径）
    expected_paths = extract_expected_paths(task.success_criteria)
    unexpected_changes = [d for d in diff if not any_path_matches(d.path, expected_paths)]
    
    # 按严重程度分类
    return classify_side_effects(unexpected_changes, task.side_effect_whitelist)
```

**示例（微信二维码任务的副作用检测）：**

```json
"side_effect_checks": [
  {
    "description": "不应修改任何联系人的免打扰状态",
    "check": "state_diff.apps.wechat.contacts[*].doNotDisturb == []"
  },
  {
    "description": "不应删除任何消息",
    "check": "count(state_diff.remove where path matches 'apps.wechat.messages.*') == 0"
  }
]
```

### 4.6 部分得分（Partial Credit）

```python
def compute_score(task: Task, final_state: State, trajectory: Trajectory) -> Score:
    score = 0.0
    
    # 主任务得分（0 or 1）
    main_success = evaluate_criteria(task.success_criteria, final_state)
    score += 1.0 if main_success else 0.0
    
    # 部分得分（rubric 定义的中间步骤）
    for rubric_item in task.partial_credit_rubric:
        if evaluate_criteria(rubric_item.criteria, final_state):
            score += rubric_item.weight  # 如：「打开了正确的 App」= +0.2
    
    # 副作用惩罚
    side_effects = check_side_effects(task, ...)
    penalty = sum(se.penalty for se in side_effects)
    score = max(0, score - penalty)
    
    # 效率奖励（可选）
    efficiency_bonus = compute_efficiency(task.optimal_steps, len(trajectory))
    
    return Score(main=main_success, total=score, breakdown={...})
```

---

## 维度 5：导航与交互的形式化

### 5.1 UI 图（App Navigation Graph）

每个 App 的导航结构被建模为**有限状态机**，其中节点是 UI 状态（页面 + 关键参数），边是可执行操作。

```typescript
interface AppNavigationGraph {
  nodes: Record<string, UIState>;
  edges: Transition[];
}

interface UIState {
  id: string;               // "wechat/chat-list"
  route: string;
  data_dependencies: string[];  // 依赖哪些 state 路径
  interactable_elements: InteractableElement[];
}

interface InteractableElement {
  semantic_id: string;      // "contact_item_{contactId}"  ← 机器可枚举
  element_type: "tap"|"swipe"|"input"|"long_press";
  bounding_box_query: string;  // CSS selector，用于计算运行时坐标
  action_effect: StateTransition;  // 交互后的状态变化
  visible_condition?: string;  // 仅在某条件下可见/可交互
}

interface StateTransition {
  type: "navigate" | "state_update" | "both";
  target_route?: string;
  state_changes?: Record<string, any>;  // jsonpath → new value
}
```

### 5.2 可交互元素的标记与隐藏

**关键设计：** 可交互元素的元数据存储在 State Store 的 `__meta__` namespace，不渲染到 DOM 的 visible 层。

```jsx
// React 组件中的标记方式（仅数据，不渲染标记到截图）
function ContactItem({ contact }) {
  const dispatch = useDispatch();
  
  // 注册到 meta 层（不影响截图）
  useInteractable({
    semantic_id: `contact_item_${contact.id}`,
    type: "tap",
    effect: { type: "navigate", target: `/wechat/chat/${contact.id}` }
  });
  
  return (
    <div className="contact-item">  {/* 截图中只有这个 */}
      <Avatar src={contact.avatar} />
      <span>{contact.name}</span>
    </div>
  );
}
```

**验证轨迹时：** 根据 Agent 的点击坐标，通过 `document.elementFromPoint(x, y)` 反查被点击的 DOM 节点，再从 meta 层查找对应的 semantic_id，从而实现「坐标 → 语义操作」的映射。

### 5.3 形式化方法：标注有限状态机

每个 App 是一个**参数化的有限状态机（PFSM）**，状态由路由路径 + 关键数据参数共同决定：

```
State = (route, data_params)
例：(/wechat/chat/zhangsan, {messageCount: 5}) 是一个具体状态

Transition: State × Action → State × SideEffects
例：(/wechat/chat-list, _) × tap(contact_zhangsan) → (/wechat/chat/zhangsan, _)
```

这个图可以在 App 加载时**自动枚举**（通过遍历 routes × 合法参数组合），用于：
- 自动生成测试任务
- 验证 Agent 是否进入了「合法状态」
- 检测 Agent 是否卡在某个循环中

---

## 维度 6：数据合成与轨迹收集

### 6.1 合成轨迹的方法

**三种来源，按优先级：**

```
A. 自动化脚本轨迹（主力）
   ├── 基于 App Navigation Graph，做 BFS/DFS 遍历
   ├── 对每条路径生成「最短操作序列」
   └── 自动化、可大规模生成，但缺乏自然性

B. 基于 LLM 的规划轨迹（补充多样性）
   ├── 给 LLM 提供截图序列 + 任务指令
   ├── LLM 规划操作序列，模拟器执行并记录
   └── 能产生更自然的子目标分解

C. 人工标注轨迹（质量基准）
   ├── 标注工具：Web 界面，标注者直接在模拟器上操作
   └── 每个任务 5-10 条，用于质量对照
```

### 6.2 轨迹数据格式

```typescript
interface Trajectory {
  task_id: string;
  agent_id: string;
  timestamp: string;
  
  steps: Step[];
  
  outcome: {
    success: boolean;
    score: number;
    side_effects: SideEffect[];
    total_steps: number;
  }
}

interface Step {
  step_index: number;
  
  // 输入（Agent 观察到的）
  screenshot: string;          // base64 PNG
  screenshot_hash: string;     // 去重用
  
  // 动作
  action: {
    type: "tap" | "swipe" | "input" | "press_home" | "press_back";
    x?: number;
    y?: number;
    dx?: number; dy?: number;  // swipe
    text?: string;             // input
  };
  
  // 状态快照（训练用，Agent 不可见）
  state_before: StateSnapshot;
  state_after: StateSnapshot;
  state_diff: StateDiff;
  
  // 语义标签（自动从 meta 层提取）
  semantic_action?: string;    // "tap:contact_item_zhangsan"
  navigation_event?: string;   // "navigate:/wechat/chat/zhangsan"
  
  // 时间
  think_time_ms?: number;      // Agent 思考时间（用于分析）
  execute_time_ms: number;     // 动作执行到截图稳定的时间
}
```

### 6.3 多样性保证

```python
class TrajectoryDiversifier:
    def ensure_diversity(self, trajectories: List[Trajectory]) -> List[Trajectory]:
        # 1. 操作路径多样性：避免所有轨迹走同一条路
        #    用 edit distance 度量轨迹相似度，过滤相似度 > 0.9 的
        
        # 2. 错误恢复轨迹：在成功轨迹中注入随机错误操作，
        #    然后让 LLM 规划恢复路径
        
        # 3. 次优路径：除最短路径外，保留 2-3 条合理的次优路径
        
        # 4. 初始状态变体：同一任务用不同初始数据（不同联系人名字、
        #    不同余额）生成多条轨迹
```

---

## 维度 7：与 Android 系统的对齐程度

### 7.1 对齐策略：「视觉一致」而非「行为完整」

**判断标准：** 某个 Android 机制是否影响「纯视觉 Agent 在截图中观察到的内容或可执行的操作」。若是，则模拟；若否，则跳过。

### 7.2 值得模拟的机制

| 机制 | 理由 | 实现方式 |
|------|------|----------|
| 状态栏图标（WiFi、电量、时间、信号） | Agent 可能通过它们判断系统状态 | State Store → 状态栏组件 |
| 通知 | Agent 可能需要响应通知 | notifications[] → 通知栏渲染 |
| 快捷设置面板（下拉） | 常见操作入口 | system/* 开关 UI |
| 系统设置页面 | 设置类任务必须 | Settings App 读写 system/* |
| 返回键/Home 键 | 导航核心操作 | navigation history 管理 |
| 跨 App 调用（显式 Intent） | 12306→支付宝场景必须 | 见下文 |
| 键盘弹出/收起 | 影响可点击区域 | CSS 模拟 viewport 压缩 |

### 7.3 可以简化/跳过的机制

| 机制 | 简化理由 |
|------|---------|
| Android 权限弹窗 | 静态声明，无运行时 prompt |
| Binder IPC / AIDL | 同进程通信已足够 |
| ContentProvider | 用 State Store 共享数据 |
| APK 安装/卸载 | App 预装，无需动态安装 |
| 多用户 | 单用户场景足够 |
| 后台 Service | 对视觉 Agent 不可见 |
| 真实文件系统 | 用 State Store 模拟媒体库 |

### 7.4 跨 App 调用协议（12306→支付宝场景）

```typescript
// 12306 触发支付时
dispatch(launchExternalApp({
  target_app: "alipay",
  target_route: "/alipay/pay",
  params: { order_id: "G123", amount: 299.00, return_app: "12306", return_route: "/12306/order-detail" },
  trigger_app: "12306"
}));

// State Store 处理
// 1. 保存 return context: navigation.pendingReturn = { app: "12306", route: "/order-detail" }
// 2. 切换当前路由到 /alipay/pay
// 3. 支付宝完成后 dispatch(finishExternalApp({ success: true }))
// 4. 恢复到 navigation.pendingReturn 的路由
// 5. 12306 读取 state.apps.alipay.last_payment_result
```

### 7.5 时间与地理位置注入

```typescript
// 模拟器内所有时间相关代码禁止调用 Date.now() / new Date()
// 必须从 State Store 读取
const currentTime = useSelector(s => s.system.time);

// Task 初始化时设置固定时间
initial_state.system.time = "2024-03-15T09:00:00+08:00"

// 「明天」的任务
// Task 指令：「查看明天的天气」
// Task system.time 固定为某天 09:00
// 天气 App 的「明天」= system.time + 24h = 确定性日期
// 天气数据在 initial_state.apps.weather.forecast[date] 中预设
```

---

## 维度 8：Benchmark 编排与执行

### 8.1 通信协议

**选择：HTTP REST（主要）+ WebSocket（截图流）**

```
REST API（控制平面）：
  POST /simulator/reset          → 重置状态
  POST /simulator/action         → 执行操作
  GET  /simulator/screenshot     → 获取当前截图
  GET  /simulator/state          → 读取完整状态
  POST /simulator/checkpoint     → 创建检查点

WebSocket（可选，低延迟模式）：
  连接后，每次 action 立即 push 新截图
  适用于延迟敏感的实时评测场景
```

**放弃的方案：** 进程内调用虽快但使 Benchmark 框架与模拟器强耦合，难以分布式部署；gRPC 性能好但复杂度高，对本场景收益有限。

### 8.2 并行执行架构

```python
# Benchmark Orchestrator 伪代码
async def run_benchmark(tasks: List[Task], agent: Agent, parallelism: int = 64):
    semaphore = asyncio.Semaphore(parallelism)
    
    async def run_one(task: Task, pod_url: str):
        async with semaphore:
            # 1. 重置状态
            await post(f"{pod_url}/simulator/reset", task.initial_state)
            
            # 2. Agent 交互循环
            result = await run_agent_loop(task, agent, pod_url)
            
            # 3. 评分
            final_state = await get(f"{pod_url}/simulator/state")
            score = evaluate(task, final_state, result.trajectory)
            
            return TaskResult(task_id=task.id, score=score, trajectory=result.trajectory)
    
    # 从 Pod Pool 分配实例
    pod_pool = PodPool(pod_urls)  # 64 个 Pod URL
    
    async with asyncio.TaskGroup() as tg:
        for task in tasks:
            pod_url = await pod_pool.acquire()
            tg.create_task(run_one(task, pod_url).finally(pod_pool.release(pod_url)))
```

### 8.3 执行流程

```
重置状态（POST /reset）
    ↓
注入初始条件（含系统时间、地理位置）
    ↓
截图检查（确认初始状态渲染完成）
    ↓
[Agent 交互循环]
    GET /screenshot → Agent 思考 → POST /action
    ↓
    [循环直到：任务成功 | 超时 | 达到 max_steps]
    ↓
最终截图 + 状态快照
    ↓
评分（state_check + VLM judge）
    ↓
副作用检测（state diff）
    ↓
结果写入 Result Store
```

### 8.4 异常处理

```python
class SimulatorGuard:
    """包装 Simulator Pod，处理所有异常情况"""
    
    async def safe_action(self, action: Action) -> ActionResult:
        try:
            async with asyncio.timeout(5.0):  # 单步超时 5s
                result = await self.pod.execute(action)
                return result
        except asyncio.TimeoutError:
            # 模拟器无响应 → 重启 Pod
            await self.pod.restart()
            raise SimulatorUnresponsiveError()
        except Exception as e:
            # 其他错误 → 记录并标记任务失败
            logger.error(f"Simulator error: {e}")
            raise
    
    async def run_task_with_timeout(self, task: Task, agent: Agent):
        try:
            async with asyncio.timeout(task.timeout_seconds):
                return await self._run_task(task, agent)
        except asyncio.TimeoutError:
            # Agent 超时 → 用当前状态打分（通常为 0）
            final_state = await self.pod.get_state()
            return TaskResult(success=False, reason="timeout", state=final_state)
    
    def detect_loop(self, trajectory: Trajectory) -> bool:
        """检测 Agent 是否卡死在操作循环中"""
        recent = trajectory.steps[-10:]
        screenshots = [s.screenshot_hash for s in recent]
        # 如果最近 10 步的截图哈希有 5+ 重复 → 认为卡死
        return len(set(screenshots)) <= 3
```

---

## 真实场景处理

### 场景 1：WiFi 开关切换的全局一致性

如前文维度 3 所述，`system.wifi` 是唯一数据源。

- **状态栏图标：** `useSelector(s => s.system.wifi)` → 显示/隐藏 WiFi 图标
- **快捷设置面板：** 同上，`WiFiToggle` 组件 dispatch `setWifi(!current)`
- **系统设置页面：** Settings App 的 WiFi 页面同样读写 `system.wifi`
- **App 内网络状态：** 各 App 的「网络不可用」提示读 `system.wifi`

**零额外代码**：React 的响应式订阅保证任何一处改变，所有订阅者自动更新。

### 场景 2：12306 → 支付宝 → 返回 12306

已在维度 7.4 中详细描述。关键是 `navigation.pendingReturn` 机制模拟 Android 的 Activity 返回栈语义，同时 `state.apps.alipay.last_payment_result` 供 12306 读取支付结果。

### 场景 3：微信二维码 + 意外免打扰副作用

```python
# Task 定义
task = Task(
    instruction="在微信中找到张三的二维码",
    success_criteria=[
        VLMJudge("当前截图中是否显示了一个二维码，且二维码旁边有'张三'的名字")
    ],
    side_effect_checks=[
        StateCheck("apps.wechat.contacts[id=zhangsan].doNotDisturb", expected=False, description="张三免打扰不应被开启"),
        StateCheck("apps.wechat.messages", operator="unchanged", description="聊天记录不应被修改"),
    ]
)

# 评分时
state_before = task.initial_state
state_after = simulator.get_state()
diff = deep_diff(state_before, state_after)

# diff 中发现 apps.wechat.contacts[zhangsan].doNotDisturb: false → true
# → 触发副作用惩罚 -0.3 分
```

### 场景 4：「明天」的确定性

```python
# Task 定义时
task = Task(
    instruction="查看明天的天气",
    initial_state={
        "system": { "time": "2024-03-15T09:00:00+08:00" },  # 固定时间
        "apps": {
            "weather": {
                "forecast": {
                    "2024-03-15": { "temp": "15-20°C", "weather": "多云" },
                    "2024-03-16": { "temp": "18-25°C", "weather": "晴" },  # 「明天」
                }
            }
        }
    },
    success_criteria=[
        VLMJudge("当前截图中是否显示了明天（3月16日）的天气信息")
    ]
)
# 无论任务何时运行，system.time 固定为 2024-03-15，
# 「明天」永远是 2024-03-16，评判结果完全确定
```

### 场景 5：64 个并行实例

**资源规划：**

```
64 个 Simulator Pod：
  每个 Pod：0.5 CPU + 512MB RAM（Headless Chromium）
  总计：32 CPU + 32GB RAM

运行环境：
  选项 A：4 台 8核16GB 云主机（约 $2/小时）
  选项 B：1 台 32核64GB 高内存实例（更好的调度效率）

吞吐量估算：
  假设每个任务平均 30 步，每步 1 秒（截图+动作）
  单实例 = 30s/task，64 并行 = 64 tasks/30s ≈ 2 tasks/s
  1000 个任务的 benchmark 运行时间 ≈ 500s ≈ 8 分钟
```

**Pod 管理：**

```yaml
# Kubernetes Deployment（或 Docker Compose scale）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: simulator-pod
spec:
  replicas: 64
  template:
    spec:
      containers:
      - name: simulator
        image: mobile-sim:latest
        resources:
          requests: { cpu: "500m", memory: "512Mi" }
        env:
        - name: POD_ID
          valueFrom: { fieldRef: { fieldPath: metadata.name } }
```

---

## 最难的 3 个子问题及解法

### 问题 1：跨 App 状态一致性 —— 多个 App 共享状态时如何避免不一致

**难点：** 系统级状态（如 WiFi）被 5+ 个 UI 组件消费；某些 App 数据（如联系人）在多个 App 中展示（微信联系人、手机通讯录）；重置时必须原子地切换全量状态。

**解法：**
1. **单一数据源架构**（Redux / Zustand），无任何组件持有本地状态副本。
2. **Selector 强制统一**：所有数据访问必须通过 `useSelector`，禁止直接访问变量。通过 ESLint 规则强制执行。
3. **重置操作的原子性**：React 的批量更新机制（React 18 Concurrent Mode）保证一次 `dispatch(resetState(newState))` 后，所有组件在同一帧重渲染，不存在「某组件已更新、另一组件还是旧值」的中间态。
4. **跨 App 数据共享的规范化**：联系人数据存在 `global.contacts` 而非 `apps.wechat.contacts`，各 App 通过 selector 读取，避免数据冗余。

---

### 问题 2：任务成功判定的准确性与效率权衡

**难点：** 纯状态检查无法覆盖所有视觉任务；VLM 判断慢（2-5s/次）且有幻觉；人工评判无法扩展；64 并行下 VLM 成本可能高昂。

**解法：**
1. **任务设计阶段优先 state_check**：任务设计者被要求尽量将成功条件表达为 state 路径断言。70-80% 的任务可以纯靠状态检查。
2. **VLM 判定缓存与批处理**：相同截图哈希的 VLM 判定结果缓存；64 并行实例的 VLM 请求批量提交（GPT-4V 支持 batch API），降低延迟和成本。
3. **双阶段判定**：先用 state_check 做「快速否决」（状态没变 → 直接失败）；只有通过快速检查的才调用 VLM 做精细判定。
4. **VLM 提示标准化**：设计结构化的 VLM 评判提示模板（YES/NO + 置信度 + 理由），建立「评判提示测试集」评估 VLM 评判本身的准确率，并对置信度低的结果标记为「需人工复核」。

---

### 问题 3：模拟器视觉真实感 vs. 工程可维护性的长期平衡

**难点：** 基于 Web 技术的模拟器视觉效果无法完全复现原生 Android UI；随着 App 数量增加，维护成本快速上升；Agent 可能学到「模拟器特有的视觉特征」，导致在真实手机上迁移困难。

**解法：**
1. **组件化视觉资产库**：精心实现一套对齐 Material Design 3 / Android 14 设计规范的 React 组件库，统一字体（Roboto）、图标（Material Icons）、间距、动画曲线，确保各 App 视觉一致性。
2. **真实截图标定**：针对每个模拟 App，收集少量真实手机截图，计算与模拟器截图的「感知相似度」（SSIM / LPIPS），在 CI 中设置相似度阈值，自动报警。
3. **渐进式对齐策略**：先保证功能正确，再在各 App 迭代中逐步提升视觉保真度，而非一开始追求完美。
4. **真机迁移测试**：定期将同一 Agent 在模拟器和真实手机上运行相同任务，监测性能 gap，针对 gap 较大的任务反向优化模拟器的视觉效果。

---

## 有意识的简化与妥协

| 简化点 | 内容 | 可接受的理由 |
|-------|------|-------------|
| 无真实 Android 内核 | 不运行真实 APK，无 ART 虚拟机 | 视觉 Agent 评测不需要真实代码执行 |
| 静态权限模型 | 无运行时权限弹窗 | 权限弹窗增加任务复杂度但不测试核心能力 |
| 有限 App 数量 | 20-50 个仿真 App | 覆盖主要场景类型已足够，可逐步扩展 |
| 简化动画 | CSS transition 而非帧级别 Android 动画 | 动画期间截图不稳定，反而干扰评测 |
| 无真实网络请求 | 所有数据来自 State Store | 避免网络不稳定带来的评测噪声 |
| 无真实 IME | 用 HTML input 模拟键盘输入 | 对视觉 Agent 而言输入流程已足够真实 |
| 简化通知系统 | 不模拟推送通知的到达时机 | 通知触发时机难以确定性控制 |
| 固定设备分辨率 | 单一 390×844 分辨率 | 泛化能力由 Agent 架构保证，不是模拟器职责 |

---

## 总结

本方案的核心设计理念是：**「对视觉 Agent 的评测来说，正确的抽象层次不是 Android 系统的完整性，而是 UI 层行为的确定性与可观测性。」** 通过浏览器渲染 + 单一数据源状态管理，我们在工程复杂度、并行成本、状态可控性三个维度上取得了比 Android 模拟器方案优越得多的平衡，同时为未来向更高保真度迁移保留了架构空间。
