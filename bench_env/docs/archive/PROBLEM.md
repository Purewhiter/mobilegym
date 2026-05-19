# bench_env 已知问题与修复记录

## P001: Task 判定逻辑禁止使用本地时间

**状态**: 已修复  
**发现日期**: 2026-03-11  
**影响范围**: 所有依赖时间的 task judge 逻辑

### 问题描述

多个 task 文件中的 judge 逻辑直接使用 Python 本地时间（`datetime.date.today()`、`datetime.datetime.now()`、`time.time()`），而不是从模拟器 `os.time.timestamp` 获取模拟时间。

当 bench_env 设置了模拟时间（如回溯到某个特定日期来测试任务）时，judge 逻辑使用本地时间会导致判定结果错误——模拟器内显示的是模拟时间，但 judge 用真实时间去比对。

### 根因

1. 缺少统一的时间获取工具函数，各 task 文件各自实现时间获取逻辑
2. `now_ms()` 等工具函数包含 `time.time()` fallback，掩盖了 `os.time` 缺失的错误
3. 部分文件定义了局部的 `_sim_today()` 而非复用公共函数

### 修复内容

| 文件 | 问题 | 修复 |
|------|------|------|
| `task/utils.py` | `now_ms()` fallback 到 `time.time()` | 改为 `raise ValueError`，新增 `sim_today()`、`sim_datetime()` |
| `task/wechat_reading/tasks.py` | 局部定义 `_sim_today()` + fallback `date.today()` | 删除，改用 `utils.sim_today()` |
| `task/tencent_meeting/app.py` | `parse_meeting_time()` 解析失败时 `datetime.now()` | 改为 `raise ValueError` |
| `task/crossapp/tasks.py` | 6 处重复的 `time.time()` fallback 模式 | 全部改用 `now_ms()` / `sim_datetime()` |
| `task/crossapp2/tasks.py` | 1 处 `time.time()` fallback | 改用 `sim_datetime()` |

### 规则

**在 `bench_env/task/` 下的所有 Python 代码中：**

1. **禁止** `datetime.date.today()`、`datetime.datetime.now()`、`time.time()` —— 这些获取的是运行机器的本地时间，不是模拟器时间
2. **必须** 通过 `bench_env.task.utils` 中的工具函数获取时间：
   - `now_ms(os_state)` → 模拟时间戳（毫秒）
   - `sim_today(os_state)` → 模拟日期（`datetime.date`）
   - `sim_datetime(os_state)` → 模拟日期时间（`datetime.datetime`）
   - `today_ymd(os_state)` → 模拟日期字符串 `"YYYY-MM-DD"`
   - `tomorrow_ymd(os_state)` → 模拟明天字符串 `"YYYY-MM-DD"`
3. **禁止** 任何 fallback 到本地时间 —— 如果 `os_state` 中缺少 `time` 字段，应该直接报错而非静默降级
4. **禁止** 在 task 文件中局部定义通用的时间工具函数 —— 统一放在 `task/utils.py`

### 如何快速排查同类问题

```bash
# 在 bench_env/task/ 下搜索所有本地时间使用
rg 'time\.time\(\)|datetime\.today\(\)|datetime\.now\(\)|date\.today\(\)' bench_env/task/

# 搜索 import time（局部 import 是高危信号）
rg '^\s+import time$' bench_env/task/

# 搜索未经 utils 的直接时间构造
rg 'datetime\.datetime\.fromtimestamp\(.*(time\.time|real)' bench_env/task/
```

> **注意**: `bench_env/agent/` 下的 `autoglm.py` 也使用了 `datetime.today()` 构建 agent system prompt，但那是给 Agent 的提示信息而非 judge 判定逻辑，暂不处理。如果后续模拟时间与真实时间差异较大，需要一并修复。

---

## P002: CriteriaTask 滥用 `@property def criteria`

**状态**: 已修复  
**发现日期**: 2026-03-11  
**影响范围**: alipay、railway12306、spotify、wechatreading 四个 suite 的 tasks.py

### 问题描述

30 处 `CriteriaTask` 子类使用 `@property def criteria(self)` 定义 criteria，违反文档规范。README 明确指出 criteria 应使用**类变量**，参数化场景使用 `"{param}"` 模板语法（"无需 `@property`"），值映射场景使用 `display` 参数属性。

### 问题分类

| 类型 | 数量 | 错误写法 | 正确写法 |
|------|------|----------|----------|
| 纯静态值 | 19 处 | `@property` 返回固定 dict | `criteria = {...}` 类变量 |
| `self.p.xxx` 原样引用 | 6 处 | `@property` + `self.p.station` | `criteria = {"key": "{station}"}` 模板语法 |
| `_XXX_MAP` 映射转换 | 3 处 | `@property` + 手动 dict 映射 | 参数用内部值 + `values` dict 映射展示文本 |
| `not self.p.xxx` 取反 | 1 处 | `@property` + `not` 运算 | 重构参数语义使其与 store 一致 |

### 修复内容

| 文件 | 修改数 | 说明 |
|------|--------|------|
| `task/alipay/tasks.py` | 8 处 | 多个设置任务改为纯静态类变量；支付顺序与字体大小任务改为 `display` 映射 |
| `task/railway12306/tasks.py` | 18 处 | 多个导航/设置任务改为纯静态类变量或模板语法；清理未使用的 `Any` import |
| `task/spotify/tasks.py` | 4 处 | 设置任务改为模板语法；播放与隐私任务改为静态类变量或正向参数语义 |
| `task/wechatreading/tasks.py` | 2 处 | `AppSettings`/`ChangeReaderTheme` → 模板语法 |

### 附：参数语义反转与模板渲染问题

`PrivacySettings` 是一个典型的复合错误案例：

**原始写法**（三个问题叠加）：

```python
class PrivacySettings(CriteriaTask):
    templates = ["在隐私设置中关闭"向他人展示我的收听活动"{share_off}并确认状态更新"]
    parameters = {
        "share_off": {"type": "boolean", "default": True, "description": "关闭分享"}
    }
    @property
    def criteria(self):
        return {"settings.shareActivity": not self.p.share_off}
```

1. **参数语义反转**：`share_off=True` 表示"要关闭"，但 store 里存的是 `shareActivity=False`，中间需要 `not` 运算。应该让参数值直接等于 store 目标值
2. **`@property` 滥用**：仅仅为了做 `not` 运算，而 `not` 的根因是参数语义设计错误
3. **模板中参数位置不合理**：`{share_off}` 出现在模板末尾，bool 默认渲染为 "开启"，整个指令读起来是"关闭……开启并确认"，语义混乱

**修复后**：

```python
class PrivacySettings(CriteriaTask):
    templates = ["在Spotify中{share_activity}'向他人展示我的收听活动'"]
    parameters = {
        "share_activity": {
            "type": "boolean",
            "values": {"开启": True, "关闭": False},
            "default": False,
            "description": "收听活动分享开关状态",
        }
    }
    criteria = {"settings.shareActivity": "{share_activity}"}
```

- 参数 `share_activity=False` 直接对应 store 的 `shareActivity=False`
- `values` dict 自动把 `False` 渲染为 "关闭"，模板读起来是 "在Spotify中关闭'向他人展示我的收听活动'"
- 无需 `@property`，无需 `not`

### 规则

**在 `bench_env/task/` 下定义 `CriteriaTask` 子类时：**

1. **禁止** `@property def criteria(self)` —— criteria 必须是类变量
2. **参数化值**使用 `"{param}"` 模板语法，框架在运行时自动替换（`_format_value`）
3. **值映射**（展示值 ↔ 内部值）使用 `values` dict（`{展示文本: 内部值}`），参数值应为 store 内部值
4. **禁止** `_XXX_MAP` 手动映射字典 —— 这是 `values` dict 的职责
5. **参数语义必须与 store 状态一致**，禁止取反等运行时计算。如果 store 里是 `shareActivity: false`，参数就应该是 `share_activity: False`，不要设计成 `share_off: True` 再 `not`
6. **模板中 `{param}` 的位置必须在语句中语义通顺**，bool 参数配合 `display` 渲染为自然语言（如 "开启"/"关闭"）后，整句话应可读

---

## P003: `_format_value` 模板替换丢失非字符串类型

**状态**: 已修复  
**发现日期**: 2026-03-11  
**影响范围**: `task/common_tasks.py` 的 `CriteriaTask._format_value`，影响所有使用 `"{param}"` 模板语法引用 bool/int/float 参数的 criteria

### 问题描述

`_format_value` 使用 `str.format()` 做模板替换，会将所有参数值强制转为字符串：

- `"{flag}".format(flag=False)` → `"False"`（字符串），而 store 里是 `False`（布尔）
- `"{count}".format(count=30)` → `"30"`（字符串），而 store 里是 `30`（整数）

导致 `_check_criteria` 中 `actual == expected` 的比对永远失败（`False != "False"`、`30 != "30"`）。

### 根因

`str.format()` 的返回值永远是字符串。当模板是纯粹的单参数引用 `"{param}"` 时，应该直接返回参数的原始 Python 值，跳过 `str.format()`。

### 修复内容

| 文件 | 修改 |
|------|------|
| `task/common_tasks.py` | `_format_value` 新增纯引用检测：当 value 是 `"{key}"` 形式（单个大括号对、key 存在于 `self.params`）时，直接返回 `self.params[key]`，保留 bool/int/float 原始类型。混合模板（如 `"prefix-{key}"`）仍走 `str.format()` |

### 受影响的 criteria 模板

| 文件 | criteria key | 参数 | 类型 |
|------|-------------|------|------|
| `alipay/tasks.py` | `settings.general.fontSizeLevel` | `font_size_level` | int (0-4) |
| `spotify/tasks.py` | `settings.downloadCellular` | `download_cellular` | boolean |
| `spotify/tasks.py` | `settings.sleepTimer` | `minutes` | integer |
| `spotify/tasks.py` | `settings.monoAudio` | `mono_audio` | boolean |
| `spotify/tasks.py` | `settings.shareActivity` | `share_activity` | boolean |
| `wechat_reading/tasks.py` | `readerPrefs.fontSize` | `font_size` | integer |

### 规则

`"{param}"` 模板语法适用于**所有参数类型**（str、bool、int、float、enum），框架负责类型保留，任务定义无需关心。

---

## P004: Task 中手动校验应由 App 层承担

**状态**: 已修复  
**发现日期**: 2026-03-12  
**影响范围**: `task/map/tasks.py`、`task/map/app.py`

### 问题描述

`map/tasks.py` 中定义了局部函数 `_require_runtime_answer(value, detail)`，用于校验从 App 状态中获取的数据非空。几乎每个 `get_answer()` 方法都重复调用它：

```python
address = _require_runtime_answer(
    map_app.place_address(self.p.place),
    f"Map task state missing address for place={self.p.place!r}",
)
```

导致 task 定义中充斥大量数据校验样板代码，模糊了 task 本身的判定逻辑。

### 根因

**App accessor 方法在数据缺失时静默返回空值**（`""` 或 `None`），而不是主动报告错误。Task 被迫在每个调用点手动包裹校验逻辑。

这是一个职责错位问题：
- App 类最清楚数据结构、查了哪些位置、为什么找不到——它应该在取不到数据时抛出有意义的异常
- Task 层只应关心"判什么"（判定逻辑），不应关心"数据不存在怎么报错"

### 修复内容

| 文件 | 修改 |
|------|------|
| `task/map/app.py` | `place_address()`、`find_rating()` 在数据缺失时 `raise ValueError`，而非返回 `""`/`None`；新增 `route_mode_distance(mode)` 处理字段名不一致和距离/时长 fallback |
| `task/map/tasks.py` | 删除 `_require_runtime_answer`；所有 `get_answer()` 简化为直接调用 App 方法或在 task 内写简单判定逻辑 |
| `task/utils.py` | 新增 `parse_duration_to_seconds()`，从 `tasks.py` 中的内联时长解析逻辑提取为公共工具 |

### 附：App 类的封装边界

修复过程中发现的过度封装倾向，明确 App 类的职责边界：

**应该封装到 App 类的**（数据访问复杂性）：
- 跨多处查找（如 `place_address` 先查 `active_poi` 再查 `searchResults`）
- 模糊名称匹配（归一化后双向 substring 匹配）
- 字段名兼容（`formatted_address` vs `address`、`distance_meters` vs `distanceMeters`）
- 数据格式解析（距离文本 → 米、时长文本 → 秒）

**不应封装到 App 类的**（任务判定逻辑）：
- 排序/取最大最小值（`max(results, key=rating)` — task 自己写一行）
- 按索引取结果（`results[i]["name"]` — task 自己写一行）
- 值比较和判断（"哪个更长"、"是否在前 N 名" — 这是 task 的业务逻辑）

**判断标准**：如果逻辑涉及"数据在哪、怎么取、字段名叫什么"，属于 App 类；如果逻辑涉及"拿到数据后怎么用"，属于 Task。

### 规则

**在 `bench_env/task/` 下编写 task 和 app accessor 时：**

1. **App accessor 方法在数据缺失时必须 `raise ValueError`**，禁止静默返回空值让调用方猜测
2. **Task 不应包含数据校验样板代码** —— 如果发现 task 里有大量 `if xxx is None: raise ValueError(...)` 模式，说明 App 层缺少合适的 accessor
3. **App 类只封装数据访问复杂性**，禁止封装判定逻辑（排序、比较、筛选等）
4. **通用的数据解析函数**（时长解析、距离解析等）放 `task/utils.py`，禁止在 App 类或 Task 中内联定义

---

## P005: Task 指令不应描述操作步骤，应表达用户意图

**状态**: 修复中  
**发现日期**: 2026-03-12  
**影响范围**: 所有 suite 的 task templates

### 问题描述

部分 task 的 `templates` 以"操作步骤"方式描述（"搜索XXX，查看YYY"），而非以"用户意图"方式描述（"帮我找到XXX"）。这类指令存在以下问题：

1. **"查看"主语错位**：指令让 Agent "查看"某信息，但 Agent 查看后没有任何输出（非 AnswerTask），也没有对用户产生任何信息反馈，"查看"成了无意义动作
2. **过程描述而非需求表达**：指令本质上在告诉 Agent "你要做哪些 UI 操作步骤"，而不是"我需要什么"，偏离了真实用户-Agent 交互场景
3. **缺乏交互闭环**：真实场景中，用户让 Agent 做事要么是获取信息（Agent 回答），要么是帮忙完成操作（Agent 把页面准备好，用户自己看）。前者应该是 AnswerTask，后者的指令应体现"帮我把XXX调出来"的意图

### 判断标准

| 任务类型 | 指令表述方式 | 示例 |
|---------|-------------|------|
| **AnswerTask**（Agent 需要回答信息） | "查看/查询XX并告诉我" | "搜索餐馆'必胜客'，查看该餐馆的评分" ✅（隐含告诉我） |
| **BaseTask**（Agent 完成操作） | "帮我XX" / "我想XX" | "帮我在地图上找到到'红螺湖'的驾车路线" ✅ |
| ❌ 错误模式 | "搜索XX，查看YY"（Agent 查看但无输出） | "搜索地点'红螺湖'，查看从当前位置到该地点的驾车路线" ❌ |

**核心原则**：如果 Agent 完成任务后用户没有获得任何新信息（既没有 Agent 的回答，页面也不是为用户准备的），那么这个指令就需要重写。

### 已修复案例

| 文件 | 类 | 原指令 | 修复后 | 说明 |
|------|------|--------|--------|------|
| `task/map/tasks.py` | `CheckDriveRoute` | "搜索地点'{place}'，查看从当前位置到该地点的驾车路线" | "帮我在地图上找到从当前位置到'{place}'的驾车路线" | Agent 帮用户把路线调出来，用户自己看 |

### 规则

**在 `bench_env/task/` 下编写 task templates 时：**

1. **AnswerTask 的指令可以用"查看/查询"**——因为 Agent 需要把信息回答给用户，"查看"的目的是为了回答
2. **非 AnswerTask（BaseTask、CriteriaTask）的指令应表达用户意图**——"帮我XXX"、"我想XXX"、"把XXX设置为YYY"，而非描述操作步骤
3. **禁止让 Agent "查看"信息但不输出**——如果指令包含"查看"，要么改为 AnswerTask 让 Agent 回答，要么改写指令去掉"查看"，改为意图表达
4. **指令中的动词主语应合理**——"搜索"可以是 Agent 做的操作，"规划路线"应该是 App 做的事，"找到/调出"才是 Agent 能做的

---

## P006: Alipay Task 定义层多类问题

**状态**: 已修复  
**发现日期**: 2026-03-12  
**影响范围**: `task/alipay/tasks.py`、`task/alipay/app.py`

### 问题描述

对 `alipay/tasks.py` 全面审查发现以下几类问题：

### 6.1 check_goals 返回缺少 `passed` 字段

`StartChatWithContact.check_goals()` 返回的 dict 没有 `passed` 字段。框架在 `judge.py` 中对缺失 `passed` 的 check 会 fallback 到 `actual == expected` 的字符串比较，导致判定逻辑不可控。

```python
# ❌ 缺 passed，框架 fallback 比较 "/chat/123" == "startsWith /chat" → False
return [{"field": "route", "expected": "startsWith /chat", "actual": path}]
```

**修复**：显式提供 `passed` 字段。

### 6.2 任务设计错误用 `return False` 掩盖

`TransferToAlipayAccount.is_successful()` 中，联系人不存在时 `return False`。这不是 Agent 执行失败，而是任务配置/采样错误——数据中缺少对应联系人。

**修复**：改为 `raise RuntimeError("任务设计错误：...")`。

**规则**：环境数据不满足 task 前置条件 → `raise RuntimeError`；Agent 没完成操作 → `return False` / `passed=False`。

### 6.3 用 `input.answer` 校验不合理内容

`SendMessageToContact` 和 `TransferToContactWithNote` 用 `input.answer` 检查 Agent 是否回复了消息原文/备注文本。纯视觉 Agent 不会把消息/备注原样输出到 answer 中。

**修复**：
- `SendMessageToContact` → 改为 route 前缀检查 + `expected_changes`
- `TransferToContactWithNote` → 改为用 `TxMatch` + `count_matching_transfers` 验证实际转账记录

### 6.4 类名与任务内容不匹配

`BalanceThresholdCheck`（余额阈值检查）实际只是查余额，没有阈值判断。

**修复**：重命名为 `CheckBalance`。

### 6.5 `source` 指向不存在的采样池

`SearchTransferRecords.parameters["keyword"]` 的 `source` 为 `"sampled_bill_keyword_pool"`，`SendMessageToContact.parameters["text"]` 的 `source` 为 `"sampled_text_pool"`——这些 pool 不存在。

**修复**：删除无效 `source` 字段。

### 6.6 参数不可采样

`CountLargeTransferIncomes` 的 `amount` 参数是 `float` 类型且无 `min`/`max`，采样器无法产生多样化值。

**修复**：改为 `enum` 类型，提供 `[100, 200, 500, 1000, 2000, 5000]`。

### 6.7 独立采样可能采出无效组合

`CalculateMonthlyExpenseTrend` 的 `month1` 和 `month2` 独立采样，可能采到同一个月，导致任务无意义。

**修复**：因 `TaskSampler` 不支持跨参数协调约束，设 `sample_max = 1` 仅使用默认值。

### 6.8 能用 CriteriaTask 却手写 check_goals

`ShowReceiveQRCode` 继承 `BaseTask` 并手写 `check_goals` 做路由前缀匹配，但路由实际是精确值 `/pay/receive`。

**修复**：改继承 `CriteriaTask`，`criteria = {"route": "/pay/receive"}`。

### 6.9 任务类名与描述语义不清

`StartChatWithContact` 既是任务名又包含 "开始聊天"，但实际只需要导航到聊天页面，Agent 不需要发送任何消息。`objective` 错标为 `"query"`。

**修复**：重命名为 `OpenChatWithContact`，`objective` 改为 `"operate"`，`capabilities` 改为 `["nav"]`。

### 6.10 模板泄露答案

`FindFriend` 模板为 `"在通讯录中找到好友'{name}'，并记录其电话号码{phone}"`，`{phone}` 就是答案本身。`CheckDailyIncome` 模板为 `"查看昨日收益，确认收益金额为{income}元"`，`{income}` 直接出现在指令中。Agent 不需要真正去查，看指令就知道答案。

**修复**：指令不再包含答案参数——`"在支付宝里找到好友'{name}'，告诉我他的电话号码"`、`"在支付宝查看昨日收益是多少"`。`FindFriend` 改用声明式 `answer = ".contacts[name={name}].phone"`，`CheckDailyIncome` 改用 `answer = ".balance.dailyIncome"`，删除多余参数。

**规则**：AnswerTask 的 `templates` 禁止包含答案相关的参数占位符（如 `{phone}`、`{income}`、`{balance}`）。答案应通过 `get_answer()` 或声明式 `answer` 从 App 状态中取得。

### 6.11 硬编码 judge 答案

`CheckSesameCredit.get_answer()` 直接 `return "59"`，没有从 App 状态读取任何数据。数据一旦变化，判定永远错误。

**修复**：删除该任务（芝麻信用分在当前 App 实现中为静态展示，无独立状态可读，不适合作为 benchmark 任务）。

**规则**：`get_answer()` / `check_goals()` 禁止硬编码返回值——必须从 `input.apps` / `input.os` 中派生。如果 App 中该数据无状态可读，说明 App 层实现不完整或该任务不适合作为 benchmark。

### 6.12 `expected_changes` 声明缺失

`SendMessageToContact` 的 `expected_changes = []`，但该任务会修改 `conversations` 和 `chatHistory`。空的 `expected_changes` 会导致 benchmark 框架跳过状态变化检测，误以为该任务是只读操作。

**修复**：改为 `expected_changes = ["conversations", "chatHistory"]`。

**规则**：所有写操作 task 必须声明实际会变化的 state key。如果不确定，先运行一次任务观察 `apps_init` vs `apps` 的 diff。

### 修复汇总

| 问题 | 涉及类 | 修复方式 |
|------|-------|---------|
| 6.1 缺 `passed` | `StartChatWithContact` | 补上 `passed` 字段 |
| 6.2 `return False` 掩盖设计错误 | `TransferToAlipayAccount` | → `raise RuntimeError` |
| 6.3 answer 校验不合理 | `SendMessageToContact`、`TransferToContactWithNote` | 改为 route/state 校验 |
| 6.4 类名不匹配 | `BalanceThresholdCheck` | → `CheckBalance` |
| 6.5 无效 source | `SearchTransferRecords`、`SendMessageToContact` | 删除 source |
| 6.6 不可采样 | `CountLargeTransferIncomes` | `float` → `enum` |
| 6.7 无效组合 | `CalculateMonthlyExpenseTrend` | `sample_max = 1` |
| 6.8 不必要的手写 check_goals | `ShowReceiveQRCode` | → `CriteriaTask` |
| 6.9 语义不清 | `StartChatWithContact` | → `OpenChatWithContact`，修正 objective/capabilities |
| 6.10 模板泄露答案 | `FindFriend`、`CheckDailyIncome` | 删除答案参数，改用声明式 `answer` |
| 6.11 硬编码 judge 答案 | `CheckSesameCredit` | 删除任务 |
| 6.12 `expected_changes` 缺失 | `SendMessageToContact` | `[]` → `["conversations", "chatHistory"]` |

---

## P007: App 类抽象边界

**状态**: 已明确  
**发现日期**: 2026-03-12  
**影响范围**: 所有 `task/<suite>/app.py`

### 问题描述

在修复 P006 时出现了**过度抽象**倾向——把大量单 task 专用的判定逻辑（如 "统计'转账'关键字出现次数"、"BillsPage 搜索时去括号"、"最近N笔支出求和"、"累计金额最大的交易对象"）封装到 App 类中。同时引入了一个 `visible_transactions(current_ms)` 方法，其唯一作用是过滤未来交易——但数据中没有未来交易。

### 根因

缺少明确的 App 类职责边界定义，导致 "让 task 代码更短" 被误当成抽象目标。

### 规则

**App 类的职责：状态访问器**——提供类型化的属性读取、通用查找、数据结构特有的辅助方法。

**应该放 App 类的**（数据访问复杂性）：
- 属性访问：`balance`、`transactions`、`contacts`、`messages`、`total_unread`
- 通用查找：`get_contact(name)`、`find_contact_name_by_account(account)`
- 数据结构特有的辅助：`count_matching_transfers`（操作 Alipay 转账记录 schema）、`parse_amounts`
- 干净的数据聚合（无业务规则）：`monthly_expense(month)`、`monthly_income_from(month, name)`

**不应放 App 类的**（任务专用逻辑）：
- 写死业务规则的计算（如 `"转账" in counterpartyName` 判定是否为转账收入）
- 内嵌 UI 显示层逻辑的计算（如收入条目去括号后再搜索）
- 单 task 专用的分析查询（如"累计金额最大的交易对象"、"最近5笔支出总和"）
- 数据中不存在的防御性过滤（如 `visible_transactions` 过滤不存在的未来交易）

**判断标准**：
1. 逻辑是否涉及"数据在哪、怎么取、字段名叫什么" → App 类
2. 逻辑是否涉及"拿到数据后怎么判定/计算" → Task 类
3. 是否写死了特定业务规则（关键字匹配、显示格式化）→ Task 类
4. 是否只有一个 task 在用 → 大概率属于 Task 类

---

## P008: Task 定义层共性质量问题

**状态**: 修复中  
**发现日期**: 2026-03-14  
**影响范围**: 所有 suite 的 task 定义（alipay 已修复，其余 suite 待排查）

### 问题描述

在 alipay/tasks.py 全面审查中发现多类跨 suite 共性质量问题，这些问题不限于特定 App，而是 task 定义时的通用缺陷模式。

### 8.1 缺少结构化元数据

大量 task 只声明了 `difficulty`，缺少以下分类字段：

| 字段 | 用途 | 示例 |
|------|------|------|
| `scope` | 单 App / 跨 App | `"S1"` / `"S2"` |
| `objective` | 任务目标类型 | `"query"` / `"operate"` / `"hybrid"` |
| `composition` | 复合度 | `"atomic"` / `"sequential"` / `"deep_dive"` |
| `capabilities` | 需要的能力标签 | `["nav", "query"]` / `["settings"]` / `["finance"]` |
| `source`（参数级） | 参数采样来源路径 | `"apps.alipay.contacts[name]"` |
| `values` dict（参数级） | 枚举/布尔值展示映射 | `{"开启": True, "关闭": False}` |

缺少这些字段导致：
- 无法按维度筛选/分组任务
- 采样器只能用 default 值，无法从 App 数据中动态采样参数
- 枚举参数在指令中渲染为内部值（如 `"custom"`）而非自然语言（如 `"自定义模式"`）

**修复**：alipay 已补齐。其余 suite 按同样标准补充。

### 8.2 难度标定偏差

多个 task 的 `difficulty` 与实际操作复杂度不匹配：

| 偏差方向 | 典型案例 | 旧 → 新 | 原因 |
|---------|---------|---------|------|
| 偏高 | `EnableDarkMode` | L2 → L1 | 单步设置开关 |
| 偏高 | `EnableRefreshSound` | L2 → L1 | 同上 |
| 偏高 | `SetFontSizeLevel` | L2 → L1 | 同上 |
| 偏高 | 支付顺序设置任务 | L2 → L1 | 同上 |
| 偏高 | `AnalyzeSpending` | L4 → L3 | 不需要跨月推理 |
| 偏高 | `DisableAllNotifications` | L4 → L3 | 多开关但路径单一 |

**规则**：

| 难度 | 标准 |
|------|------|
| L1 | 1-2 步导航 + 单一操作（开关、点击） |
| L2 | 3-5 步导航或需要在页面中定位信息 |
| L3 | 多步操作序列、需要推理/计算、或涉及多个页面 |
| L4 | 复杂分析推理、跨多页数据汇总、或操作链条长且有判断分支 |

### 8.3 模板缺乏多样性

旧版每个 task 只有 1 个 template，导致：
- benchmark 结果可能过拟合到特定措辞
- 无法测试 Agent 对同义表达的鲁棒性

**修复**：alipay 中复杂任务已补充 2 个 templates，使用不同措辞表达相同意图。

**规则**：
1. L1 任务至少 1 个 template（简单任务措辞变化有限）
2. L2+ 任务建议 2 个以上 templates，用不同措辞表达同一意图
3. 多模板之间不应有语义差异（只是措辞不同），不应引入不同的隐含约束

### 8.4 Task 内联重复业务逻辑

多个 task 的 `get_answer()` / `check_goals()` 中内联了相同的数据处理逻辑，而非使用 App helper 方法。典型案例：

**时间过滤样板**（5 处重复）：
```python
raw_time = input.os.get("time", 0)
if isinstance(raw_time, dict):
    now_ms = int(__import__("time").time() * 1000)
else:
    now_ms = int(raw_time or __import__("time").time() * 1000)
```

**月度聚合逻辑**（2 处重复）：
```python
for t in txs:
    dt = datetime.datetime.fromtimestamp(t["timestamp"] / 1000)
    m_str = dt.strftime("%Y-%m")
    if m_str == target_month and t["delta"] < 0:
        total += abs(t["delta"])
```

**修复**：时间过滤逻辑统一到 `task/utils.py`（P001 已修）；月度聚合等数据访问逻辑下沉到 `Alipay` app helper（`monthly_expense()`、`monthly_income_from()`）。

**规则**：
1. 相同的数据访问逻辑在 2+ 个 task 中出现 → 提取到 App helper
2. 通用工具逻辑（时间解析、格式化等）→ `task/utils.py`
3. Task 层只保留"判什么"的逻辑，"怎么取数据"由 App 层负责（参见 P004、P007）

### 如何快速排查同类问题

```bash
# 搜索 templates 中可能泄露答案的参数（AnswerTask 的模板不应包含答案参数）
rg 'templates.*=.*\[.*\{(phone|income|balance|amount|price|score|count|answer)' bench_env/task/

# 搜索硬编码 return 值（get_answer 中不应有字面量 return）
rg 'def get_answer' -A5 bench_env/task/ | rg 'return ["\x27]\w+'

# 搜索空 expected_changes
rg 'expected_changes\s*=\s*\[\]' bench_env/task/

# 搜索缺少 scope/objective 的 task 类
rg 'class \w+\((BaseTask|CriteriaTask|AnswerTask)\)' bench_env/task/ --files-with-matches | \
  xargs -I {} sh -c 'rg -L "scope\s*=" {} && echo "MISSING: {}"'

# 搜索只有 1 个 template 的 task
rg 'templates\s*=\s*\["[^"]+"\]$' bench_env/task/
```

---

## P009: 防御性代码掩盖数据问题

**状态**: 已修复  
**发现日期**: 2026-03-15  
**影响范围**: `task/railway12306/tasks.py`，同类模式可能存在于其他 suite

### 问题描述

`railway12306/tasks.py` 中大量使用防御性代码模式（`or {}`、`or ""`、`or "Unknown"`、`.get("key", "")`），在数据缺失或结构不对时静默返回空值，而非让错误暴露。

### 具体模式

| 模式 | 示例 | 问题 |
|------|------|------|
| `or {}` 吞 None | `latest_order = init_rail.latest_order or {}` | 任务前提是"有最新订单"，没有就该报错，`or {}` 导致后续 `.get()` 返回空字符串，check 全部静默 pass=False，看不出是数据问题还是 Agent 失败 |
| `.get("key", "")` 代替直接访问 | `str(latest_order.get("toStation", ""))` | 如果 `toStation` 字段不存在，说明数据结构有问题，应该直接 KeyError 报错 |
| `or "Unknown"` 兜底 | `(passenger or {}).get("name", "") or "Unknown"` | 三层防御，没有默认乘车人应该直接炸 |
| `input.apps.get("railway12306", {})` | 所有 task 的 `check_goals` | `JudgeInput.apps` 已保证返回 dict，`railway12306` key 不存在说明 bench 配置有误，应直接 KeyError |
| `(input.apps_init or {}).get(...)` | 需要初始状态的 task | `JudgeInput.apps_init` 已保证返回 dict，`or {}` 完全多余 |
| `input.os or {}` | 时间相关 task | `JudgeInput.os` 已保证返回 dict |
| check dict 中 `(x or {}).get(...)` | `(target_train or {}).get("trainNo")` | `target_train` 为 None 是合法的 Agent 失败场景，但 `or {}` 不是正确的处理方式 |

### 根因

1. **对框架 API 不信任**：`JudgeInput` 的 `apps`、`apps_init`、`os` 都有明确的返回类型保证，不需要额外防御
2. **混淆"Agent 未完成任务"和"数据/配置错误"**：前者应在 check dict 中 `passed=False`，后者应直接报错
3. **复制粘贴传染**：一个 task 写了 `or {}`，后续 task 照抄

### 修复内容

| 修改 | 说明 |
|------|------|
| `input.apps.get("railway12306", {})` → `input.apps["railway12306"]` | 14 处 |
| `(input.apps_init or {}).get("railway12306", {})` → `input.apps_init["railway12306"]` | 5 处 |
| `input.os or {}` → `input.os` | 2 处 |
| `latest_order or {}` + `.get()` → 直接键访问 | 任务前提必须有最新订单 |
| `(passenger or {}).get("name", "") or "Unknown"` → 声明式 `answer` | 改为 `.passengers[isDefault=True].name` |
| `(target_train or {}).get("trainNo")` → `target_train["trainNo"] if target_train else None` | check dict 中用显式三元表达 |
| `len((order or {}).get("tickets") or [])` → `len(order["tickets"]) if order else None` | 同上 |
| `str(target_train.get("trainNo", "") or "")` → `target_train["trainNo"]` | `if target_train is not None` 守卫内，字段必须存在 |
| `QueryFastestTrainDetails` 的 `if fastest is None: return {"trainNo": "无车次"}` | 删除，`pick_train` 返回 None 说明数据有问题 |

### 规则

**在 `bench_env/task/` 下的所有 Python 代码中：**

1. **禁止 `or {}`、`or ""`、`or "Unknown"` 等防御性兜底**——数据不对就让它报错，不要静默吞掉
2. **数据/配置错误必须直接报错**（KeyError、ValueError 等），禁止 fallback 到空值再 `passed=False`
3. **Agent 未完成任务是合法失败**——在 check dict 中用 `passed=False` 报告，`expected`/`actual` 字段用显式三元表达（`x["field"] if x else None`），不要用 `(x or {}).get("field")`
4. **`JudgeInput` 属性直接使用**：`input.apps["app_name"]`、`input.apps_init["app_name"]`、`input.os`——框架已保证返回类型，不需要额外 `.get()` 或 `or {}`
5. **`.get("key", "")` 只用于真正可选的字段**——如果字段是必需的，直接 `["key"]` 访问

### 如何快速排查同类问题

```bash
# 搜索 or {} 模式
rg 'or \{\}' bench_env/task/

# 搜索 or "" / or "Unknown" 兜底
rg 'or ""|or "\w+"' bench_env/task/ --glob '*.py'

# 搜索 input.apps.get（应该直接 input.apps["xxx"]）
rg 'input\.apps\.get\(' bench_env/task/

# 搜索 input.apps_init or {}
rg 'apps_init or' bench_env/task/

# 搜索 input.os or {}
rg 'input\.os or' bench_env/task/
```

---

## P010: 数据源存储非结构化字符串

**状态**: 已修复  
**发现日期**: 2026-03-15  
**影响范围**: `apps/Railway12306/data/defaults.json`、`apps/Railway12306/state.ts`、`bench_env/task/railway12306/app.py`

### 问题描述

`defaults.json` 中 `studentVerify.route` 存储为合并字符串 `"上海 – 成都"`，`state.ts` 在运行时通过 `split(' – ')` 拆成 `from`/`to`。`app.py` 中对应有一个 `student_verify_route` 属性方法处理两种格式的兼容（先查 `route` 字段，查不到再拼 `from` + `to`）。

### 问题

1. **数据源应该存结构化数据**：`from` 和 `to` 是两个独立语义，不应该挤在一个字符串里靠分隔符拆
2. **运行时拆字符串是脆弱的**：依赖 ` – ` 这个特定分隔符，换个格式（如 `"上海→成都"`）就炸
3. **app.py 被迫写兼容逻辑**：`student_verify_route` 属性方法处理两种格式，本质是为了弥补数据结构设计缺陷

### 修复内容

| 文件 | 修改 |
|------|------|
| `apps/Railway12306/data/defaults.json` | `"route": "上海 – 成都"` → `"from": "上海", "to": "成都"` |
| `apps/Railway12306/state.ts` | 删除 `split(' – ')` 派生逻辑，直接透传 config |
| `apps/Railway12306/pages/StudentVerifyPage.tsx` | `{studentVerify.route}` → `{studentVerify.from} – {studentVerify.to}` |
| `bench_env/task/railway12306/app.py` | 删除 `student_verify_route` 属性方法（已无引用） |

### 规则

**在 `apps/*/data/defaults.json` 中定义数据时：**

1. **存结构化字段，不存拼接字符串**——如果数据有多个独立语义单元（出发地/目的地、姓/名），分别存储
2. **展示层负责拼接**——页面渲染时 `{from} – {to}` 拼接显示，数据层不管展示格式
3. **禁止在 state.ts 中做字符串拆分派生**——如果需要拆，说明数据源结构不合理，应该修数据源

---

## P011: `resolve_answer` 不支持 dict-of-paths（slot-based 声明式答案）

**状态**: 已修复  
**发现日期**: 2026-03-15  
**影响范围**: `bench_env/task/common_tasks.py`

### 问题描述

`resolve_answer` 支持单路径 `answer = ".field.path"` 和 tuple `answer = (".path", fn)`，但不支持 dict 形式的 slot-based 声明式答案。需要多 slot 匹配（如同时检查出发地和目的地是否出现在 Agent 回答中）时，必须手写 `get_answer` 方法：

```python
def get_answer(self, input: JudgeInput) -> dict[str, str]:
    sv = input.apps["railway12306"]["studentVerify"]
    return {"from": sv["from"], "to": sv["to"]}
```

### 修复内容

| 文件 | 修改 |
|------|------|
| `task/common_tasks.py` | `resolve_answer` 新增 dict 分支：遍历每个 value，如果是路径字符串（`.` 开头或含 `:`）则解析，否则当字面量 |
| `task/common_tasks.py` | 抽取 `_resolve_path` 和 `_is_path` 辅助函数，消除原有分支中的重复路径解析逻辑 |

**修复后支持：**

```python
answer = {"from": ".studentVerify.from", "to": ".studentVerify.to"}
```

`build_answer_checks` 对每个 slot 独立做 containment 匹配——Agent 回答 "上海到成都"、"上海 – 成都"、"从上海去成都" 都能通过（只要包含两个城市名）。

### `resolve_answer` 完整语法汇总

| 形式 | 示例 | 说明 |
|------|------|------|
| 路径字符串 | `".contacts[name={name}].phone"` | 从 app state 取值 |
| 路径 + 变换 | `(".passengers", len)` | 取值后应用函数 |
| dict-of-paths | `{"from": ".studentVerify.from", "to": ".studentVerify.to"}` | 多 slot 独立匹配 |
| callable | `staticmethod(lambda task, state: ...)` | 自定义逻辑 |
| 字面量 | `42` / `"固定答案"` / `re.compile(...)` | 直接比对 |

---

## P012: Task 文件职责混乱与过度抽象

**状态**: 已修复  
**发现日期**: 2026-03-15  
**影响范围**: `task/railway12306/tasks.py`、`task/railway12306/app.py`、`task/utils.py`、`task/base.py`，同类模式可能存在于其他 suite

### 问题描述

`railway12306/tasks.py` 中混入了大量不属于 task 定义的内容：自定义基类、mixin、模块级 helper 函数、App 专属常量。导致文件职责模糊，阅读时需要在 task 定义、数据常量、工具函数之间反复跳转。

### 具体问题

**1. 自定义基类 / mixin**

```python
class _RailwayBaseTask(BaseTask):
    apps = ["railway12306"]
    # 自定义 check 逻辑、参数处理...

class _RailwayMixin:
    # 通用的 check 构建方法...
```

每个 task 从 `_RailwayBaseTask` 或混入 `_RailwayMixin` 继承，引入了非标准的继承链。task 之间的耦合通过基类隐式传递，改一个 task 可能影响所有 task。

**2. 模块级 helper 函数**

```python
def _format_fixed_date(date_str: str) -> str: ...
def _format_relative_future_date(env_state, date_str): ...
def _normalize_price(value): ...
def _chk(field, expected, actual, passed=None): ...
def _build_query_checks(rail, from_s, to_s, date, ...): ...
def _find_new_pending_order(rail, from_s, to_s, date, names, ...): ...
```

这些函数散落在 tasks.py 顶部，和 task 类定义交织在一起。其中 `_chk` 只是构建 check dict 的语法糖，引入了不必要的间接层；`_build_query_checks` 和 `_find_new_pending_order` 是 App 数据查询逻辑，不属于 task 层。

**3. App 专属常量**

```python
HOT_ROUTE_CHOICES = [("上海", "南京"), ("北京", "天津"), ...]
NEW_PASSENGER_PROFILES = [{"name": "周若涵", ...}, ...]
SCHEDULE_PREF_DISPLAY = {"earliest": "最早", "latest": "最晚"}
SEAT_TYPE_DISPLAY = {"商务": "商务座", ...}
```

采样数据和值映射是 App 层的职责，不是 task 定义的一部分。

### 根因

1. **"就近放置"惯性**：写 task 时顺手把需要的 helper/常量写在同一个文件，没有考虑文件职责边界
2. **过早抽象**：为了减少 task 间的代码重复，引入自定义基类和 mixin，但实际增加了理解成本
3. **缺少明确的文件职责定义**

### 修复内容

| 原位置 | 迁移目标 | 内容 |
|--------|---------|------|
| `tasks.py` 自定义基类 | 删除 | `_RailwayBaseTask`、`_RailwayMixin` — 所有 task 直接继承 `BaseTask`/`AnswerTask`/`CriteriaTask` |
| `tasks.py` helper 函数 | 删除或迁移 | `_chk` 删除（inline dict）、`_build_query_checks` → `app.py` 的 `Railway12306.build_query_checks()`、`_find_new_pending_order` → `app.py` 的 `Railway12306.find_new_pending_order()` |
| `tasks.py` 采样常量 | `app.py` | `HOT_ROUTE_CHOICES`、`NEW_PASSENGER_PROFILES` → `app.py` 模块级常量 + `Railway12306` 静态方法采样器 |
| `tasks.py` 值映射常量 | `app.py` 共享常量 / 各 task 内联 | `SCHEDULE_PREF_DISPLAY`、`SEAT_TYPE_DISPLAY` → `app.py` 的 `SCHEDULE_PREF_PARAM`、`SEAT_TYPE_PARAM`（`values` dict 形式） |
| `tasks.py` 日期格式化 | `base.py` / `utils.py` | `_format_fixed_date` → `base.py` 内置 display `"date_hao"`、`_format_relative_future_date` 删除、`_normalize_price` → `utils.py` 的 `normalize_price()` |

### 规则

**`tasks.py` 文件职责：只包含 task 类定义。**

| 允许 | 禁止 |
|------|------|
| task 类（继承 `BaseTask`/`AnswerTask`/`CriteriaTask`） | 自定义基类、mixin、抽象中间层 |
| `expected_changes` 常量组合（纯元数据，多 task 复用） | App 专属数据常量（采样池、路线表） |
| import 语句 | 模块级 helper 函数（`_chk`、`_build_xxx`） |
| task index 注释 | 值映射常量（应 inline 或提取为 `app.py` 共享常量） |

**`app.py` 文件职责：App 状态访问器 + App 专属数据/采样逻辑。**

| 允许 | 禁止 |
|------|------|
| `BaseApp` 子类（属性、查找、聚合方法） | task 判定逻辑（排序、比较、筛选） |
| App 专属常量（采样池、路线表） | 通用工具函数（日期、价格格式化） |
| 采样方法（`sample_route_pair`、`sample_order_date`） | UI 层逻辑 |
| 数据查询方法（`build_query_checks`、`find_new_pending_order`） | |

**`utils.py` 文件职责：跨 suite 通用工具。**

| 允许 | 禁止 |
|------|------|
| 时间工具（`sim_today`、`tomorrow_ymd`） | App 专属逻辑 |
| 通用采样器（`sample_future_date`） | task 判定逻辑 |
| 通用格式化（`normalize_price`） | |

**task 编写原则：**

1. **每个 task 独立完整**——不继承其他 task，不依赖 task 文件中的共享 helper，所有 check 逻辑 inline 写完
2. **只从标准基类继承**——`BaseTask`（自定义 `check_goals`）、`AnswerTask`（声明式 `answer`）、`CriteriaTask`（声明式 `criteria`）
3. **优先声明式**——能用 `answer = ".path"` / `criteria = {"key": "value"}` 表达的，不要写方法
4. **App 数据查询下沉到 `app.py`**——task 调 `rail.build_query_checks()` 拿结果，不要在 task 里写数据遍历/查找逻辑
5. **禁止 task 间继承**——task A 不能继承 task B 然后只改一个 check；看似减少重复，实际增加耦合，改 B 会影响 A
6. **值映射复用**——多 task 共享的 `values` dict 参数提取为 `app.py` 模块级常量（如 `SCHEDULE_PREF_PARAM`），单 task 专用的直接 inline

### 重构前后对比

**重构前**（tasks.py 557 行，其中非 task 代码约 150 行）：

```
tasks.py
├── HOT_ROUTE_CHOICES (常量)
├── NEW_PASSENGER_PROFILES (常量)
├── SCHEDULE_PREF_DISPLAY (常量)
├── SEAT_TYPE_DISPLAY (常量)
├── _format_fixed_date() (函数)
├── _format_relative_future_date() (函数)
├── _normalize_price() (函数)
├── _chk() (函数)
├── _build_query_checks() (函数)
├── _find_new_pending_order() (函数)
├── _RailwayMixin (mixin)
└── 18 个 task 类（大部分混入 _RailwayMixin）
```

**重构后**（tasks.py 只有 task 定义 + expected_changes 元数据）：

```
tasks.py
├── QUERY_EXPECTED_CHANGES (元数据)
├── BOOKING_EXPECTED_CHANGES (元数据)
├── BOOKING_WITH_PASSENGER_CHANGES (元数据)
└── 18 个 task 类（全部直接继承标准基类）

app.py (新增方法)
├── HOT_ROUTE_CHOICES (常量)
├── NEW_PASSENGER_PROFILES (常量)
├── Railway12306.sample_route_pair() (采样)
├── Railway12306.sample_order_date() (采样)
├── Railway12306.sample_passenger_pair() (采样)
├── Railway12306.sample_new_passenger_profile() (采样)
├── Railway12306.build_query_checks() (数据查询)
└── Railway12306.find_new_pending_order() (数据查询)

utils.py (新增)
├── sample_future_date() (通用采样)
└── normalize_price() (通用格式化)

base.py (新增)
└── "date_hao" 内置 display formatter
```

---

## P013: 声明式能解决的问题不要绕 app.py 方法

**状态**: 已修复  
**发现日期**: 2026-03-15  
**影响范围**: `task/railway12306/tasks.py`、`task/railway12306/app.py`，同类模式可能存在于其他 suite

### 问题描述

多个 task 本可以用 `answer = ".path"` 或 `criteria = {"key": "value"}` 一行声明式搞定，却在 `app.py` 里定义了专门的方法，然后 task 的 `get_answer()` / `check_goals()` 再去调用这个方法。整个链路完全多余。

### 具体案例

**案例 1：CheckDefaultPassengerName**

```python
# ❌ app.py 定义方法
def get_default_passenger(self) -> Optional[dict]:
    for p in self.passengers:
        if p.get("isDefault"):
            return p
    return None

# ❌ tasks.py 调用方法 + 防御性代码
def get_answer(self, input: JudgeInput) -> str:
    rail = Railway12306(input.apps.get("railway12306", {}))
    passenger = rail.get_default_passenger()
    return str((passenger or {}).get("name", "") or "Unknown")

# ✅ 一行声明式
answer = ".passengers[isDefault=True].name"
```

**案例 2：OpenServicePhone**

```python
# ❌ app.py 定义方法
def get_service_phone_area_code(self, region: str) -> str:
    phone = self.get_service_phone(region)
    return str(phone.get("areaCode", "")) if phone else ""

# ❌ tasks.py 调用方法
answer = staticmethod(lambda task, state:
    Railway12306(state).get_service_phone_area_code(str(task.p.region)))

# ✅ 一行声明式
answer = ".servicePhones[region={region}].areaCode"
```

**案例 3：CheckStudentVerifyRoute**

```python
# ❌ app.py 定义属性（还要处理两种数据格式的兼容）
@property
def student_verify_route(self) -> str | None:
    sv = self.student_verify
    route = str(sv.get("route", "")).strip()
    if route: return route
    from_s = str(sv.get("from", "")).strip()
    to_s = str(sv.get("to", "")).strip()
    if from_s and to_s: return f"{from_s} – {to_s}"
    return None

# ❌ tasks.py 调用属性
answer = staticmethod(lambda task, state:
    Railway12306(state).student_verify_route or "")

# ✅ 一行声明式（修正数据结构后）
answer = {"from": ".studentVerify.from", "to": ".studentVerify.to"}
```

**案例 4：OpenInvoice**

```python
# ❌ tasks.py 手写 check_goals 遍历数据
def check_goals(self, input: JudgeInput) -> list[dict]:
    rail = Railway12306(input.apps["railway12306"])
    header = next((h for h in rail.invoice_headers if h["name"] == self.p.name), None)
    return [
        {"field": "invoiceHeaders.contains", "expected": self.p.name,
         "actual": header, "passed": header is not None},
        {"field": "invoiceHeaders.isDefault", "expected": self.p.make_default,
         "actual": header.get("isDefault") if header else None,
         "passed": header is not None and header.get("isDefault") == self.p.make_default},
        {"field": "invoiceEmail", ...},
    ]

# ✅ 声明式 criteria（扩展 CriteriaTask 支持 key 模板后）
criteria = {
    "invoiceHeaders[name={name}].name": "{name}",
    "invoiceHeaders[name={name}].isDefault": "{make_default}",
    "invoiceEmail": "{email}",
}
```

### 根因

1. **不了解框架能力**：不知道 `answer` 支持 `[field={param}]` 列表查找语法和 `{param}` 模板，以为必须写代码
2. **先写 app.py 方法再想 task**：思路是"我需要从 state 里取数据 → 写个方法"，而不是"框架能不能直接声明式表达"
3. **app.py 方法数量成为惯性**：已有的方法越多，越倾向于"再加一个方法"而非用声明式

### 规则

**写 task 时的决策顺序：**

1. **先尝试声明式** — `answer = ".path"` / `criteria = {"key": "value"}`，看框架的路径表达式能否直接达到目的
2. **检查是否需要扩展框架** — 如果声明式差一点点就能表达（如 dict-of-paths、criteria key 模板），优先扩展框架的声明式能力，让所有 task 受益
3. **最后才写 `get_answer()` / `check_goals()`** — 只在逻辑确实无法声明式表达时（如需要排序、聚合、跨字段计算）

**app.py 方法的必要性检查：**

- 如果一个 app.py 方法只是 `self.get("fieldA.fieldB")` 的直白封装 → 删掉，用声明式路径
- 如果一个 app.py 方法只是 `next(x for x in self.list if x["key"] == value)` → 删掉，用 `[key={param}]` 语法
- 只有**真正复杂的数据访问**（多步查找、模糊匹配、跨集合关联、格式兼容）才值得 app.py 方法

## P014: 布尔型 query 任务的 answer 判定问题

**状态**: 已修复  
**发现日期**: 2026-03-15  
**影响范围**: 所有需要 agent 回答"是/否"类问题的 query 任务

### 问题描述

当 query 任务的答案是布尔值（如"人证核验是否成功"），`match_value` 的 bool 分支要求 agent 整个回答恰好等于 `"是"/"否"/"true"/"false"` 才能匹配——实际 agent 会回答完整句子（"核验已通过"、"没有通过"），几乎永远无法命中。

同时，用 regex 匹配肯定/否定回答时存在子串歧义：**肯定词往往是否定词的子串**（"通过" ⊂ "未通过"、"成功" ⊂ "不成功"）。直接用 `re.compile(r"成功|通过")` 做 `.search()`，会在 agent 回答"未通过"时误匹配到"通过"，导致错判。

### 具体案例

`CheckIdVerificationStatus` 原始定义：

```python
criteria = {"route": "/id-verify", "user.realNameVerified": True}
answer = re.compile(r"(成功|通过|已通过|是)")
```

问题：
1. `"user.realNameVerified": True` 是预设数据，跟 agent 行为无关，criteria 检查形同虚设
2. `answer` 硬编码肯定 regex，无法处理 `realNameVerified=False` 的情况
3. 即便改为动态返回 regex，`通过` 仍会匹配"未通过"中的子串

### 根因

1. **`match_value` 的 bool 分支无实际用途**：全字匹配 `"是"/"否"` 对 agent 的自然语言回答不适用，已删除
2. **中文否定结构复杂**：否定前缀多样（未/没/没有/不/还没）且与肯定词间距不固定，regex lookbehind 无法处理变长前缀
3. **`.search()` 只回答"匹配了没有"**：无法区分命中的是否定词整体还是其中的肯定子串

### 正确做法

布尔型 query 任务应在 `check_goals()` 中**先检测否定、再检测肯定**，利用检测顺序而非 regex 本身来消歧：

```python
def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
    checks = self._check_criteria(input)
    expected = input.apps["railway12306"]["user"]["realNameVerified"]
    answer = re.sub(r"\s+", "", str(input.answer or ""))
    # 否定优先：否定词列表必须放在肯定词之前检测
    negative = re.search(r"未通过|没有通过|没通过|未成功|没成功|不成功|失败", answer)
    positive = re.search(r"成功|通过|已核验", answer)
    judged = False if negative else True if positive else None
    checks.append({
        "field": "answer",
        "expected": "肯定" if expected else "否定",
        "actual": input.answer,
        "passed": judged is not None and judged == expected,
    })
    return checks
```

### 规则

1. **布尔型 answer 不要用 `match_value`** — 它的 bool 分支已删除，str/regex 分支无法处理肯定词⊂否定词的歧义
2. **否定词必须先于肯定词检测** — 在 `check_goals()` 中先 `re.search` 否定模式，再搜肯定模式；否定命中则判为否定，否则看肯定
3. **否定词列表要结合具体问题语境** — "是否通过"对应"未通过/没通过/没有通过"，"是否成功"对应"未成功/没成功/不成功/失败"，不同问题的否定表达不同
4. **此问题中英文通用** — 英文同样存在肯定词⊂否定词的子串歧义："success" ⊂ "unsuccessful"、"verified" ⊂ "unverified"、"pass" ⊂ "not passed"、"valid" ⊂ "invalid"。处理方式一样：先 `re.search` 否定模式（`unsuccessful|unverified|not passed|failed`），再搜肯定模式（`success|verified|passed`）
5. **禁止把预设数据放进 `criteria`** — `criteria` 只检查 agent 行为导致的状态变化（如路由），不检查 agent 无法影响的初始数据

## P015: operate 任务不应做过程检查，check 不应抽象到 app.py

**状态**: 已修复  
**发现日期**: 2026-03-15  
**影响范围**: `bench_env/task/railway12306/tasks.py`、`bench_env/task/railway12306/app.py`

### 问题描述

`Railway12306` app 类中有一个 `build_query_checks()` 方法，被 6 个 task 调用，存在两个问题：

1. **operate 任务做了冗余的过程检查**：`BuyReturnTicketFromLatestOrder`、`BuyTicketForPassenger`、`BuyTicketForTwoPassengers`、`AddPassengerAndBuyTicket` 这些 operate 任务调用 `build_query_checks()` 检查了查询参数（出发站、到达站、日期）。但这些任务最终都通过 `find_new_pending_order()` 检查订单，而订单本身已包含 from/to/date/passenger 全部信息——订单对了，查询参数必然对了；反过来不可能查错参数却买到正确的票。这些过程检查纯属冗余
2. **`directTrains.count > 0` 检查不合理**：该 check 验证查询结果中有无直达车次，但这是数据层/模拟器的问题，跟 Agent 操作无关。如果某条线路某天恰好没有直达车，check 会 fail 并归咎于 Agent
3. **check 逻辑被抽象到 app.py 不直观**：`build_query_checks()` 把 check dict 的构建藏在 app 类里，任务类的 `check_goals()` 看不出到底检查了什么，需要跳到另一个文件才能理解判定逻辑

### 根因

1. 混淆了"过程正确性"和"结果正确性"——对 operate 任务，只有最终状态变更才是判定标准
2. 把不属于 Agent 能力范围的条件（数据层车次数量）纳入了判定
3. 过度追求代码复用，将 check 逻辑抽象到 app.py，牺牲了可读性

### 修复内容

| 任务类型 | 任务类 | 处理 |
|---------|--------|------|
| operate | `BuyReturnTicketFromLatestOrder` | 删除 `build_query_checks()` 调用，只保留订单检查 |
| operate | `BuyTicketForPassenger` | 同上 |
| operate | `BuyTicketForTwoPassengers` | 同上 |
| operate | `AddPassengerAndBuyTicket` | 同上 |
| query | `QueryAndCheckRoute` | 内联 3 项查询参数检查 + 路由检查，删除 `directTrains.count` |
| query | `QueryFastestTrainDetails` | 同上 |

`app.py` 中的 `build_query_checks()` 方法已删除。

### 规则

1. **operate 任务只检查最终状态变更** — 订单/数据的存在性和正确性就是判定标准，不检查中间过程（查询参数、页面路由等）
2. **check 不应检查 Agent 无法控制的条件** — 数据层的车次数量、网络返回结果等不是 Agent 的责任
3. **check 逻辑必须写在任务类的 `check_goals()` 中** — 不要抽象到 app.py 方法里，判定标准需要在任务定义处一眼看清
4. **app.py 只提供数据访问** — `last_query_summary`、`find_new_pending_order()`、`pick_train()` 这类数据查询方法属于 app.py；构建 check dict 列表不属于
5. **禁止把环境/数据前置条件放进 check** — 初始数据是否存在（如"最新车票是否存在"）是环境配置问题，不是 Agent 的责任。check 只判定 Agent 的行为结果，不判定环境是否正确
