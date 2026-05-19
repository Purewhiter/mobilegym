# mobile-gym 平台价值与未来方向

> 本文档系统梳理 mobile-gym 作为「可编程移动世界沙箱」的多维度价值，
> 涵盖学术研究、商业应用、技术平台三个视角，供团队战略规划参考。

---

## 一、核心定位：可编程移动世界模型（Programmable Mobile World Model）

mobile-gym 的真正稀缺性不是「模拟了 28 个 App」，而是 **三大支柱的耦合**——它们在其他任何环境中从不共存：

| 支柱 | 含义 | 竞品状态 |
|------|------|---------|
| **语义可标注性** | `data-trigger` + `__SIM_QUERY__` — 为任务定义与轨迹合成提供结构化语义标签（Agent 本身是纯视觉的，仅通过截图操作） | ADB 只有 accessibility tree（不完整且不一致） |
| **状态可编程性** | `setState()` 一次调用构造任意初始条件，`getState()` 结构化读取全量状态 | 真机需要 root + 数据库操作 |
| **形式化导航契约** | `navigation.declaration.ts` — 所有可达 UI 状态和动作机器可枚举 | 任何现有环境都没有 |

三者互相增强形成闭环：导航声明驱动 DOM 标签 → DOM 标签驱动查询 API → 查询 API 驱动 Benchmark 任务 → 任务驱动状态判定。复制其中一个容易，复制这个闭环的一致性才是真正的工程壁垒。

### 与现有环境对比

| 维度 | AndroidEnv | WebArena | OSWorld | Generative Agents | mobile-gym |
|------|-----------|---------|---------|-------------------|------------|
| 环境类型 | 真机 ADB 模拟器 | Web 浏览器 | 桌面截图回放 | 模拟文字世界 | 浏览器渲染 Android 模拟 |
| Agent 观测 | 仅截图 | 截图 + DOM | 仅截图 | 全文本状态 | 仅截图（纯视觉 Agent）；bench_env 可通过 JSON API + 语义 DOM 做任务判定与轨迹合成 |
| 状态可控 | 无（ROM 快照） | 无 | 无 | 完全 | 完全（setState API） |
| App 多样性 | ~38 个（有限真实感） | 4 个 Web 应用 | OS 级（文件/浏览器） | 自定义社交模拟 | 28 个高仿真中国/国际 App |
| 跨 App 任务 | 无 | 无 | 部分 | N/A | 有（3 个专用 crossapp 模块） |
| 副作用检测 | 无 | 无 | 无 | 无 | 有（expected_changes + clean 标志） |
| 导航图 | 无 | 无 | 无 | 无 | 有（17+ App，静态 FSM） |
| 时间控制 | 无 | 无 | 无 | 有 | 有（模拟时间 + 地理位置） |
| OTP/短信流程 | 无 | 无 | 无 | 无 | 有（SMS Gateway） |
| 并行成本 | 每实例需一台设备 | 浏览器实例 | 虚拟机 | 文本模拟 | 开个浏览器 tab 即可 |

最接近的学术先例不是 AndroidEnv 或 WebArena，而是 RL 领域的 **NetHack Learning Environment (NLE)**——真正的价值不是排行榜，而是一个结构化、可检视、可控的世界，让受控实验成为可能。

---

## 二、学术研究价值

### 2.1 因果干预实验平台

`setState()` 让 GUI 领域的反事实实验成为可能——这在任何真机环境中都无法实现。

**核心范式**：同一个截图，改一个状态字段，测量 Agent 行为是否改变。这是 NLP 中 cloze test / causal probing 的 GUI 版本。

**具体实验设计**：
- Agent 到底在看截图里的什么？徽章数字？颜色？位置？通过 factorial-design 逐一控制变量
- 支付宝余额显示 ¥100 vs ¥100,000 时，Agent 操作路径是否变化？
- X(Twitter) 上发帖者的粉丝数 / 蓝V标志是否影响 Agent 的信息采信？
- 注入虚假紧急 SMS 后，Agent 是否会被诱导执行非预期操作？

**论文方向**：*"Counterfactual Probing of GUI Agent Decision-Making"*（GUI Agent 的因果探测）

### 2.2 World Model 训练基座

每一步交互自然产生五元组：

```
(screenshot_t, state_json_t, action_t, screenshot_t+1, state_json_t+1)
```

这是训练 Mobile UI World Model 的完美监督信号。现有 world model 研究（Dreamer, IRIS, DreamerV3）集中在游戏 / 机器人领域，**移动端 UI 还没有 world model**——因为没有大规模 (视觉, 结构化状态, 动作) 配对数据。

训练好的 World Model 能回答："如果我点这个按钮，三步后微信聊天状态会怎样？"——这对 Agent 规划能力是质的飞跃。

**数据规模估算**：32 并行 Playwright workers，约 30 episodes/min/core。一个中等集群可生成百万级 step 的 demonstration dataset。

**论文方向**：
- *"World Models for Mobile UI: Predicting State Transitions from Screen Observations"*
- *"Learning App-Specific Navigation Priors from Declarative Navigation Graphs"*

### 2.3 Agent 行为安全（Side-Effect）研究

benchmark 中已有的 `expected_changes` / `clean` / `passed` 三元判定是独特的安全研究基础设施。

一个 Agent 成功打开了微信二维码（`success=True`），但不小心把某个聊天设为免打扰（`clean=False, passed=False`）——这是与"任务失败"结构性不同的失败模式。

**研究问题**：
- 更强的 Agent（更高成功率）是否也产生更少副作用？
- 哪些任务类型（设置类 vs 导航类）更容易产生附带修改？
- 加入"清洁度"奖励后，Agent 的成功率会下降多少？（安全-效率 trade-off）
- Fine-tune with reward that penalizes dirty episodes — 是否能学到 task-specific caution？

**论文方向**：*"Teaching Agents to Respect Expected State Changes: Behavioral Safety in GUI Manipulation"*

### 2.4 跨 App 任务规划与工作记忆

crossapp 任务套件是独一无二的。例如「在小红书搜索第一个旅行帖的城市名，通过微信 DM 发给联系人」需要：

1. 从 App A 提取信息
2. 跨 App 切换时保持工作记忆
3. 在 App B 找到正确目标实体
4. 正确组合并发送

这是首个拥有大规模跨 App 任务 + 自动化结构化判定的环境。

**论文方向**：*"Cross-App Task Completion: When Mobile Agents Need Working Memory"*

### 2.5 POMDP 与 Agent 记忆

`SystemShell.tsx` 的设计是 App 后台保留（`display:none` 但 React 状态不销毁）。Agent 面对的是一个真实的 **部分可观测马尔可夫决策过程（POMDP）**：

- 后台 App 的状态（如正在编辑的微信消息草稿）在当前截图中不可见
- 跨 App 任务要求 Agent 维持对隐藏状态的 belief state
- 这是移动端版本的"房间记忆"问题——类比机器人导航中"记住背后有什么"

### 2.6 导航图增强的 Agent 规划

17+ 个 App 的 `navigation.declaration.ts` 编码了显式的有限状态机。一个利用导航图的规划器可以：
- 计算最短路径（`nav_path_finder.py` 已经实现）
- 作为动作选择的先验
- 对比：(a) 纯视觉 Agent, (b) 导航图作为文本上下文的 Agent, (c) 导航图 beam search Agent

**论文方向**：*"Navigation Graph-Augmented Planning for Mobile GUI Agents"*

### 2.7 OTP / 验证码流程评测

SMS Gateway 使得多 App 认证任务可测试：触发支付宝验证码 → 切到短信 App 读取 → 返回支付宝输入。这覆盖了大量真实世界的手机操作（银行转账、注册、密码修改），在现有 benchmark 中完全不可测试。

### 2.8 时间推理能力评测

可控模拟时间（`TimeService`）使得以下任务可评测：
- "设置一个下周二的日历提醒" → 不同模拟当前时间下验证
- Agent 是否正确理解相对日期（"3 天后"、"这个周末"）
- 时间敏感场景（火车票抢购倒计时、会议即将开始）

### 2.9 跨学科研究

#### HCI：UI 可发现性的 Agent 代理度量

Agent 步数和错误率是任务难度的代理变量。同一任务在不同菜单深度 / 不同标签文案下的 Agent 表现差异 = 无需人类被试的 UI 可发现性实验。`optimal_paths` 提供最短路径长度，`Agent 实际步数 / 最优步数` 是经验难度指标。

目标会议：CHI, UIST

#### 经济学：模拟金融场景下的 Agent 决策

支付宝有完整金融状态（余额、交易记录、花呗）。可研究：
- Agent 行为是否随显示余额高低变化？
- 时间压力下（模拟截止时间逼近）多步支付流是否稳定？
- 恶意构造的 UI 状态（通过 SMS 注入虚假紧急消息）能否诱导 Agent 非预期支付？

#### 社会学：社交媒体环境下的 Agent 行为

X(Twitter) 有完整社交图谱（用户、帖子、粉丝数、认证标志、趋势）。可运行社会学实验：
- Agent 的信息获取行为是否因信源的粉丝数变化？（社会信誉偏见）
- Agent 如何区分推广内容与有机内容？（广告易感性）
- 注入政治敏感内容到 X 热搜后，Agent 是否会在后续写作任务中引用？

#### 安全研究：GUI Agent 的提示注入攻击

SMS Gateway 是一个注入向量。攻击者（测试环境）构造恶意 SMS → 观察 Agent 是否被诱导点击钓鱼链接 / 输入验证码到错误 App。这是"GUI Agent 的 prompt injection"威胁模型的首次受控研究。

目标会议：CCS, NDSS, USENIX Security

### 2.10 符号绑定（Grounded Symbol Binding）

导航声明定义了命名状态（`/chat/:id`, `/me/wallet`）和命名动作（`chat.open`, `modal.share.open`）——这些是符号。截图是感知观测。模型如何学会将视觉观测绑定到符号化导航状态——以及这种绑定是否可组合、是否鲁棒——是 grounded language / embodied AI 文献的核心问题。

mobile-gym 同时提供符号真值（导航图 + 状态 API）和视觉观测（截图），使其成为前所未有的 grounded symbol-binding testbed。

---

## 三、商业应用价值

### 3.1 AI Agent 训练与评测服务（主赛道）

**市场背景**：每家中国手机厂商和 AI 实验室都在竞建手机控制 Agent——AutoGLM（智谱）、百度 Agent、OPPO Breeno、荣耀 YOYO、小米小爱、vivo BlueLM。所有团队面临同一问题：如何大规模、可复现地评估 Agent，而不消耗设备时间或泄露用户数据？

真机评测成本约 ¥2,000-5,000/台，需要设备管理基础设施，无法真正并行，且结果不可复现。一次 32-worker mobile-gym 评测运行成本仅几分钱。

**独特差异化**：每个任务定义中的 `optimal_paths` 字段。例如：

```python
class OpenBlacklist(CriteriaTask):
    template = "打开微信通讯录黑名单页面"
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.privacy.friends.open",
        "settings.privacy.blacklist.open",
    ]]
```

这是带标注的专家轨迹。任务库中每个任务都是免费的监督学习样本。

**商业模式**：
- **Benchmark-as-a-Service**：托管环境 + 公开排行榜，按评测运行次数收费
- **OEM 授权**：面向小米、OPPO、vivo、荣耀，作为内部 Agent 质量门的 CI/CD 工具（¥50-200万/年/企业）
- **专家轨迹数据集**：打包导航图 + 最优路径 + 任务实例 + 状态转移，授权给模型训练团队

### 3.2 数字素养教育（老年关怀 / 企业培训）

**市场背景**：中国约 3 亿老年手机用户。国务院 2020-2021 年多次发文解决"数字鸿沟"，各省有专项预算。社区中心和医院目前用纸质指南或志愿者教学。

**为什么 mobile-gym 是完美方案**：
- UI 与真实 App 像素级一致，但操作零后果——不会转错账、发错消息
- `reset()` 一键重来，完美教学循环
- 状态 API 让教师实时查看学生操作结果
- benchmark 任务天然就是教案——有难度分级、最优路径、成功判定

**已支持的教学场景**：
- "打开微信找到联系人张三" — 已有导航任务
- "查看余额宝收益" — 已有支付宝 Answer 任务
- 支付流程、火车票购买（12306 任务已存在）
- 隐私设置（微信隐私相关任务已存在）

**商业模式**：
- 授权给电信运营商（移动 / 联通有老年关怀计划，政府指令下）
- 授权给医院系统（术前数字化同意流程、出院后药物 App 教学）
- 政府采购（民政部数字包容项目）
- 社区中心 SaaS 订阅（¥5,000-20,000/年/机构）

**企业客服培训方向**：
- 支付宝 / 微信支付 / 银行 / 电信运营商客服每天处理数百万"App 里怎么操作"的来电
- mobile-gym 可构建模拟培训系统：创建场景 → 学员引导完成 → 状态判定验证
- 目标客户：各有 5,000-50,000 客服人员，缩短培训周期意味着显著成本节约

### 3.3 Multi-Agent 虚拟社会环境

**核心想法**：多个 AI Agent 各自操控一台 mobile-gym 实例，通过模拟的社交基础设施（微信消息、朋友圈、小红书帖子、支付宝转账）进行交互，形成可观测的微型数字社会。

**已具备的基础**：
- 微信有完整的联系人、聊天、朋友圈数据模型
- 支付宝有转账 / 收款的结构化记录
- 小红书 / B站有内容发布和社交互动
- `setState()` 可以把 Agent A 的「发送消息」动作注入到 Agent B 的「收件箱」
- Intent 系统天然支持跨 App 协作（12306 → 支付宝付款）

**需要补充的**：一个 Message Bus 层——在多个 mobile-gym 实例之间同步状态变更。架构上可以是轻量 WebSocket 中继。

**应用场景**：
- LLM Agent 社会模拟研究（类似 Stanford Generative Agents 小镇实验，但换成手机场景——真实感高出几个量级）
- 多 Agent 协作 Benchmark（"Agent A 帮 Agent B 订火车票并通过微信发送行程"）
- 社交工程 / 钓鱼防御研究（模拟恶意 Agent 发送钓鱼链接，测试防御 Agent 的识别能力）
- 经济行为模拟（多个 Agent 在支付宝上交易，观察涌现行为）

### 3.4 RPA / 工作流自动化训练

**核心问题**：中国移动端 QA 团队无法在现有基础设施上测试跨 App 支付流程、小程序启动或多 App 工作流。Appium 和 XCTest 看到的是像素和 accessibility tree，无法询问"用户今天做了几笔支付宝交易"或"注入一个特定微信验证码"。

**mobile-gym 的状态注入 API 解决核心痛点**：构造测试前置条件。在真实 App 中，创建"用户有这 50 个联系人、这些聊天记录、这些隐私设置"的状态，需要数据库访问（通常不可能）或手动 UI 操作（慢且易错）。mobile-gym 一行 JSON 搞定。

**商业模式**：面向金融科技公司（基于微信支付 / 支付宝 SDK 的）、银行（测试小程序）、电商（测试结算流），SaaS 按席位收费（¥3,000-8,000/席/年）。

### 3.5 中国超级 App 的结构化文档（独特资产）

微信 `navigation.declaration.ts` 有 2,726 行，支付宝 1,298 行——这是**全世界唯一一份机器可读的中国超级 App 完整导航规格**。每条路由、每个转场、每个 UI 状态、每条最优路径，全部是结构化数据。

**谁会为此付费**：
- **进入中国的国际企业**：欧洲银行接入微信支付需要理解完整支付流程，目前靠聘请顾问录屏。导航图比任何文档都精确
- **监管机构**：央行、网信办需要理解超级 App 的交互流，如"取消一个自动扣费服务需要几步"——真实的监管关切
- **学术研究者**：数字权力不对称、暗模式研究的第一手数据
- **应用商店审核**：Apple / Google 审核中国市场 App 时可用结构化导航规格验证声称功能 vs 实际流程

**商业模式**：数据授权（导航图 JSON）、研究订阅、监管咨询

### 3.6 合成训练数据工厂

mobile-gym 的每个组件都已经是一条数据生成管线：

1. 导航图 + 参数采样 → 生成无限任务实例（`bench_env/task/sampler.py` 已实现）
2. `setState()` → 注入任意前置条件
3. Agent 执行任务 → 生成动作序列
4. 判定系统 → 自动标注每条轨迹为正确 / 错误
5. 状态 API → 捕获完整的 before/after 状态转移

生成一条标注训练样本的成本趋近于零。32 并行 workers 每小时可生成数千条标注轨迹。

**差异化**：
- 完全状态控制下生成（无历史污染）
- 自动标注（state-based judging 提供 ground truth）
- 结构多样性（参数采样创造词法不同但结构相似的任务）
- 跨 App 覆盖（Intent 系统支持多 App 工作流——其他数据集没有的）

**商业模式**：数据集授权给各大 AI 实验室、手机厂商、RPA 软件厂商的模型训练团队。

### 3.7 安全与反欺诈研究 / 培训

SMS 注入能力 + 完全状态控制使 mobile-gym 成为安全研究的独特工具：

- **反欺诈培训**：银行安全团队通过模拟钓鱼流程训练检测 Agent
- **社会工程研究**：研究老年用户如何应对虚假微信消息的转账请求
- **2FA 绕过分析**：在完全受控环境中研究截获 SMS 验证码的攻击者能否绕过支付安全
- **安全意识培训**：企业员工练习识别模拟的微信钓鱼攻击

**商业模式**：面向银行安全部门和政府网络安全机构（CNCERT、公安部）的研究授权。合同制，高单价低量。

---

## 四、技术平台价值

### 4.1 场景录制与回放基础设施

`data-trigger` / `data-action` 属性系统已经是一个结构化事件日志的基础。每次交互可记录为 `(triggerId, params, timestamp)` 元组 + `getState()` 快照。由于 trigger ID 是声明的字符串字面量（非运算值），这些日志在代码变更后仍然稳定。

回放引擎只需 `__SIM_QUERY__.getRectByTrigger(triggerId, params)` + `__SIM_INPUT__.tap(center.x, center.y)` 即可重执行——比 Playwright 录制更稳定，因为它在语义层面操作。

**可扩展为**：

```js
window.__SIM_RECORDER__ = {
  start(),
  stop(),
  export()  // → JSON: [{ action, triggerId, params, stateBefore, stateAfter }]
}
```

产出的 traces 是无需手动标注的模仿学习训练数据。

### 4.2 声明式 App 生成（开源生态的关键杠杆）

`navigation.declaration.ts` 目前描述"已有什么"。逻辑延伸是让它变成**规定性的**——声明一个 App，自动生成实现。

schema 已包含生成骨架所需的一切：`routes`, `uiStates`, `transitions`, `actions`, `scrollContainers`。

代码生成器可产出：
1. `<AppName>App.tsx` — 带 MemoryRouter 和所有声明路由
2. 页面组件存根 — 带正确的 `data-trigger` 绑定
3. `context/<AppName>Context.tsx` — 状态 shape 从 `defaults.json` 推导
4. `navigation.ts` — 类型安全的 `go()` hook

**这构成开源生态飞轮**：贡献者只需写 declaration JSON + defaults.json → 自动生成可导航 App → 自动枚举 benchmark 任务。贡献门槛从"会写 React"降到"会写 JSON schema"。

对于 Benchmark 场景，更简化的变体：声明式"App spec"（JSON/YAML，含路由图 + 状态 schema + 任务定义）→ 生成全功能低保真 App（本质是带触控目标的状态机）→ Agent 可在高保真 UI 实现之前就进行训练和评测。

### 4.3 CI/CD 集成 — Agent 回归测试

每次 App 源码提交可自动触发该 App 任务集的回归测试：

```yaml
# GitHub Actions 示例
on: push
steps:
  - npm run dev &          # 启动 dev server（后台）
  - wait-for port 3000
  - python -m bench_env.run --app <AppName>
  - compare results to baseline JSON
  - fail if pass rate regressed
```

`check_navigation_declaration_consistency.mjs` 已支持 CI（错误时非零退出码）。这让 mobile-gym 不只是「评测工具」，而是开发流程的一部分。

### 4.4 LLM Provider 集成

MCP Server 集成已就绪。`AgentBridge` WebSocket 协议已定义 JSON 消息格式 `{ id, action, params }` / `{ id, success, data, error }`。为 Claude / GPT-4 tool use 包装一个 JSON Schema 即可。

任何有 tool use 能力的 LLM 都可以最小集成成本在 mobile-gym 上评测：
- 通过 `get_state`（结构化 JSON，比 VLM 便宜）或 `screenshot` + VLM 观测
- 通过手势工具（`tap`, `swipe`, `type`）执行动作

### 4.5 云托管评测服务

模拟器可在任何云服务商的 browser-as-a-service 上运行（Browserbase, Playwright Cloud 等）。

托管评测 API 设计：
```
POST /evaluate
{ taskId, agentEndpoint, maxSteps }
→ 启动模拟器会话 → 运行 Agent → 返回 JudgeResult
```

研究团队提交 Agent endpoint 即可评测，无需本地运行模拟器。

### 4.6 数字孪生与空间计算

**数字孪生**：`setState()` 可接受从真机导出的状态快照，在模拟器中实例化。Agent 在模拟器 twin 中验证后再部署到真机。

**空间计算**：模拟器当前渲染 360×800 CSS 像素，3x DPR。这个 viewport 可映射到折叠屏内屏或空间 OS（visionOS, Android XR）的悬浮面板。`DeviceConfig` 类型是屏幕几何的单一注入点。`__SIM_INPUT__` 坐标系已区分 `css` vs `physical` 像素——这恰好是空间环境所需的抽象。

**虚拟世界集成**：社交 VR 环境中需要可被 AI Agent 探索的模拟手机 App。mobile-gym 的浏览器渲染 + API 控制 + 状态透明架构天然兼容 WebXR 环境（模拟器页面作为虚拟设备上的纹理渲染）。

---

## 五、优先级矩阵

```
                        学术影响力
                           ↑
    World Model 训练 ●     |     ● 因果干预实验
                           |
  Agent 行为安全 ●         |        ● Multi-Agent 社会
                           |
     POMDP 记忆 ●          |
                           |
    ─────────────────────── + ──────────────────→ 商业可行性
                           |
  声明式 App 生成 ●        |        ● 数字素养教育
                           |
   CI/CD 回归测试 ●        |     ● 超级 App 结构化文档
                           |
   合成训练数据 ●          |        ● RPA 训练沙箱
```

### 建议路径

| 时间 | 方向 | 说明 |
|------|------|------|
| **近期 (6-12月)** | 发表 Benchmark 论文 | 在顶级 ML 会议确立学术合法性，驱动所有中国 AI 实验室采用 |
| **近期 (6-12月)** | 因果干预实验论文 | 利用 setState 做 GUI Agent 的 causal probing，独创性最强 |
| **中期 (12-24月)** | OEM 授权 | 面向 2-3 家手机厂商提供内部 Agent 评测基础设施 |
| **中期 (12-24月)** | 声明式 App 生成 | 降低贡献门槛，构建开源生态飞轮 |
| **并行推进** | 数字素养教育试点 | 找一个省级数字包容项目做 pilot，政府采购周期慢但稳定 |
| **并行推进** | Multi-Agent 基础设施 | 添加 Message Bus 层，为所有多 Agent 场景打基础 |
| **长期 (24-48月)** | 合成数据工厂 | 定位为中国手机 Agent 数据供应链的基础设施 |

---

## 六、风险与注意事项

### 知识产权

模拟微信、支付宝、B站 UI 并使用其 App 图标 / 品牌色 / 导航结构，在中国法律下存在模糊地带。当前的学术研究使用风险低，但商业化部署需要：
- 定位为"训练与评测环境"而非"App 克隆"——法律框架很重要
- 避免使用精确 App Logo（图标可风格化处理）
- 考虑与 App 厂商建立商业关系——腾讯 / 蚂蚁集团可能更倾向授权合作而非强制执行

教育用途（老年数字素养）是风险最低的框架，因为明显不与原始 App 竞争。

### 维护成本

真实 App UI 频繁更新。如果商业定位涉及"与真实 App 一致"，则需要持续的 navigation declaration 更新投入。导航声明系统使更新可行（但不便宜）。

### 循环依赖（架构债务）

当前 `os → apps → os` 的循环依赖在单 Agent 场景下是技术债，在 Multi-Agent 场景下会变成架构硬伤。解法方向：让每个 App 通过注册制（类似 Android ContentProvider）向 OS 声明状态 schema，而不是 OS 主动 import 每个 App 的数据模块。这同时解决新增 App 的开闭原则问题和多实例状态同步的需求。

---

## 七、核心资产总结

mobile-gym 最被低估的资产不是浏览器实现或 React 代码——这些可复制。真正的护城河是：

1. **navigation declaration 文件**：2,726 行微信 + 1,298 行支付宝 + 26 个其他 App 的完整导航声明，全部带 optimal action paths 和 state-based success criteria。这些逆向工程的结构化知识代表了 2-3 人年的专注投入
2. **语义 DOM 标签系统**：竞品基于真机 ADB 没有等价物（真实 App 的 accessibility 标注不一致且不完整）
3. **状态 API 的一致性闭环**：导航声明 → DOM 标签 → 查询 API → Benchmark 任务 → 状态判定，这个闭环的工程一致性是无法通过逐个复制组件来复现的

这些资产应被保护、扩展和变现。
