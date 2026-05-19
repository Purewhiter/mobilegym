# AnswerSheet Grounded 评测指南

## 1. 概述

Grounded 评测通过 `AnswerSheet` APP，将 Agent 的答案提交转化为**基于 UI 状态的精确判定**，消除 text 模式下自然语言模糊匹配导致的 false positive。

**两种评测模式并行**：

- **grounded 模式**（默认，`--eval-mode grounded`）：Agent 在 AnswerSheet 表单中填写答案，框架读取 UI 状态进行判定
- **text 模式**（`--eval-mode text`）：Agent 通过 `ANSWER` action 的文本进行模糊匹配（`match_value`）

---

## 2. 核心架构：两条评测路径

Runner 在 grounded 模式下根据任务特征选择不同路径：

```
          任务有 answer_fields？
                 │
            ┌────┴────┐
            │ No      │ Yes
            │         ▼
            │    任务有自定义 check_goals？
            │         │
            │    ┌────┴────┐
            │    │ No      │ Yes
            │    ▼         ▼
            │  路径 A    路径 B
            ▼
      text 模式 fallback
      (task.evaluate)
```

### 路径 A：结构化精确匹配（`build_grounded_checks`）

**适用**：无自定义 `check_goals` 的任务（典型：纯 AnswerTask）。
需要任务提供 `get_expected_response` 方法（AnswerTask 基类默认从 `get_answer()` 自动推导）

**行为**：

1. 从 `answer_sheet` state 逐字段读取 Agent 的表单值
2. 调用 `task.get_expected_response(input)` 获取每个字段的期望值
3. 用 `_match_grounded_field` **逐字段**精确匹配（exact / number / date / time）
4. **不调用** `check_goals`

**优势**：逐字段隔离匹配，不存在多字段值交叉污染的风险

### 路径 B：注入 `input.answer`（hydrate）

**适用**：有自定义 `check_goals` 的任务（无论 AnswerTask 还是 BaseTask）

**行为**：

1. 从 `answer_sheet` state 读取所有字段值
2. 将值用 `", "` 拼接为字符串，注入 `input.answer`
3. 调用 `task.evaluate()` → 走正常的 `check_goals` 判定

**优势**：保留自定义判定逻辑（如同时检查 state 变更 + 答案正确性）

### 判定条件（Runner 代码）

```python
# 遍历 MRO 找到真正定义 check_goals 的类
_cg_definer = next(
    (c for c in type(task).__mro__ if "check_goals" in c.__dict__), BaseTask
)
# BaseTask（空实现）和 AnswerTask（纯答案匹配）不算自定义
has_custom_cg = _cg_definer not in (BaseTask, AnswerTask)

if not has_custom_cg:
    # 路径 A：结构化精确匹配
    build_grounded_checks(task, judge_input, sheet_state)
else:
    # 路径 B：hydrate input.answer（需 submitted=True）
```

> **注**：遍历 MRO 确保中间基类（如 `CriteriaTask`）的 `check_goals` 不会被跳过。
> 路径 B 同样检查 `submitted` 标志，Agent 未点击提交按钮时不会注入答案。

---

## 3. 如何为任务添加 Grounded 支持

### 3.1 纯 Query 任务（AnswerTask，无自定义 check_goals）

只需加 `answer_fields`，框架自动处理：

```python
class CountAlarms(AnswerTask):
    answer = (".alarms", len)
    answer_fields = [{"type": "number", "label": "闹钟数量"}]
    # → 走路径 A，get_expected_response 从 get_answer() 自动推导
```

**多字段任务**：`get_answer()` 返回 dict 时，默认 `get_expected_response` 自动按 value 顺序展开。`answer_fields` 的字段顺序**必须与 dict key 顺序一致**：

```python
class QueryFirstEvent(AnswerTask):
    def get_answer(self, input):
        return {"title": "周会", "time": "14:30"}  # dict，2 个 key
        # → get_expected_response 自动返回 ["周会", "14:30"]

    answer_fields = [
        {"type": "text", "label": "日程标题", "hint": "如：周会"},          # ← 对应 title
        {"type": "text", "label": "开始时间", "hint": "如：14:30", "matcher": "time"},  # ← 对应 time
    ]
```

**参数化任务中字段类型随参数变化**：当任务的 `field` 参数枚举值中同时包含文本型和数字型字段时，无法用类级 `answer_fields` 同时声明两种类型。此时将 `answer_fields` 改为 `@property`，在运行时根据 `self.p.field` 动态返回：

```python
class CheckSearchNoteField(AnswerTask):
    parameters = {
        "field": {
            "type": "enum",
            "values": {
                "标题": "title",       # text
                "点赞数": "likes",     # number
                "收藏数": "collections",  # number
                "作者名": "authorName",  # text
            },
        },
    }
    _NUMERIC_FIELDS = {"likes", "collections"}

    @property
    def answer_fields(self):  # type: ignore[override]
        field_val = getattr(self.p, "field", None)
        # 反查 enum 取中文 label，避免显示内部 key（"likes" 等）
        label = next(
            (k for k, v in self.parameters["field"]["values"].items() if v == field_val),
            field_val or "",
        )
        t = "number" if field_val in self._NUMERIC_FIELDS else "text"
        return [{"type": t, "label": label}]
```

**注意**：
- `@property` 在运行时与 `getattr(task, "answer_fields", None)` 等框架访问点完全兼容，不需要改框架代码
- label 必须通过反查 enum `values` 取中文 key，不能写 `"{field}"` 模板——`{field}` 经框架解析后得到内部值（如 `"likes"`），不是汉字
- `getattr(self.p, "field", None)` 防止在 `self.p` 未初始化时抛出 `AttributeError`
- mypy/pyright 会对 `ClassVar` 被 `@property` 覆写发出警告，用 `# type: ignore[override]` 压制

**何时必须覆写 `get_expected_response`**：当 `get_answer()` 返回 `re.Pattern`（模糊匹配）时，grounded 模式需要精确值：

```python
class CompareCityTemp(AnswerTask):
    answer_fields = [{"type": "choice", "label": "更热的城市",
                      "options": ["{city1}", "{city2}", "一样热"]}]

    def get_answer(self, input):
        # text 模式：可能返回 re.Pattern
        return re.compile(r"一样|相同|差不多")

    def get_expected_response(self, input):
        # grounded 模式：必须返回精确值
        return ["一样热"]
```

**另一种必须覆写的场景**：`get_answer()` 返回 `dict` 但 `answer_fields` 只有单个字段时。默认实现会按 dict values 展开为多个值，导致**字段数与值数不匹配**：

```python
class CheckDetailCard(AnswerTask):
    answer_fields = [{"type": "text", "label": "查询结果"}]  # 1 个字段

    def get_answer(self, input):
        return {"dir": "东风", "scale": "3"}
        # ⚠️ 默认 get_expected_response 会返回 ["东风", "3"] — 2 个值！

    def get_expected_response(self, input):
        answer = self.get_answer(input)
        if isinstance(answer, dict):
            return [f"{answer['dir']}{answer['scale']}级"]  # → ["东风3级"]
        return [str(answer)]
```

**repeatable 字段的变体**：`get_answer()` 返回动态长度 dict（每项对应一个列表元素）且 `answer_fields` 是单个 `repeatable` 字段时，同样需要覆写。`get_expected_response` 必须返回 `[[v1, v2, ...]]`——外层列表 1 个元素（对应 1 个字段），内层列表是 repeatable 字段的多个期望值：

```python
class ReadTodoText(AnswerTask):
    answer_fields = [{"type": "text", "label": "待办事项", "repeatable": True, "compare": "set"}]

    def get_answer(self, input):
        # text 模式：dict 供 build_answer_checks 逐 slot containment 匹配
        notes = Notes(input.apps["notes"])
        return {f"todo_{i+1}": str(t.get("text") or "") for i, t in enumerate(notes.incomplete_todos)}
        # ⚠️ 默认 get_expected_response 会返回 ["买菜", "洗衣服", ...] — N 个值，但只有 1 个字段！

    def get_expected_response(self, input):
        # grounded 模式：1 个字段 + repeatable → 外层 1 元素，内层为完整列表
        notes = Notes(input.apps["notes"])
        return [[str(t.get("text") or "") for t in notes.incomplete_todos]]  # → [["买菜", "洗衣服", ...]]
```

### 3.2 有自定义 check_goals 的任务（AnswerTask 或 BaseTask）

只需加 `answer_fields`（带 hint），现有 `check_goals` 通过 `input.answer` 读取注入的值：

```python
class RailwayDestWeatherQuery(AnswerTask):
    answer_fields = [
        {"type": "text", "label": "天气状况", "hint": "如：晴"},
        {"type": "text", "label": "最高温度", "hint": "如：23°"},
        {"type": "text", "label": "最低温度", "hint": "如：15°"},
    ]

    def check_goals(self, input):
        # input.answer 在 grounded 模式下 = "晴, 23°, 15°"（AnswerSheet 值拼接）
        # 在 text 模式下 = Agent 的自然语言回答
        answer_text = str(input.answer or "")
        ...
```

> **关键**：`check_goals` 中的匹配逻辑必须兼容 AnswerSheet 注入的简洁格式。
> 使用 `hint` 引导 Agent 填写 `check_goals` 能匹配的格式。

### 3.3 Hybrid 任务（操作 + 查询）

同 3.2。`check_goals` 中既检查 state 变更又检查答案：

```python
class FavVideoAndCountTask(BaseTask):
    answer_fields = [{"type": "number", "label": "收藏夹内容数"}]

    def check_goals(self, input):
        app = Bilibili(input.apps["bilibili"])
        return [
            app.check_favored(title),                              # state check
            *build_answer_checks(count, input.answer),             # answer check
        ]
```

### 3.4 带自定义问题的任务

`answer_fields` 可以用 dict 格式，通过 `question` 字段指定 AnswerSheet 顶部**显示的问题文本**：

```python
class MakeupDayReminder(BaseTask):
    templates = ["帮我看看{holiday}需不需要补班"]
    answer_fields = {
        "question": "今年{holiday}需要补班吗？",
        "fields": [
            {"type": "choice", "label": "是否需要补班",
             "options": ["需要补班", "不用补班"]},
        ],
    }
```

**两个文本的区别**：

| 文本             | 来源                                                         | 接收方         | 作用                         |
| ---------------- | ------------------------------------------------------------ | -------------- | ---------------------------- |
| Agent 指令       | `task.description`（= templates 渲染结果 + 答题卡后缀）    | Agent          | 告诉 Agent 做什么            |
| AnswerSheet 问题 | `question`（dict 格式）或 fallback 到 `task.description` | AnswerSheet UI | Agent 打开答题卡后看到的题面 |

**使用场景**：当 task description 包含操作指令（如"帮我做xxx…告诉我"），不适合直接作为答题卡题面时，用 `question` 提供一个更简洁的问题。

**解析逻辑**（`Controller.setup`）：

```python
question = task._resolve_answer_question() or task.description
# dict 格式有 question → 用它（支持 {param} 模板）
# list 格式无 question → fallback 到 task.description
```

---

## 4. answer_fields 参考

### 4.1 字段类型

| `type`   | 说明               | UI 控件  | 默认 matcher |
| ---------- | ------------------ | -------- | ------------ |
| `text`   | 自由文本           | 文本输入 | `exact`    |
| `number` | 数字               | 数字输入 | `number`   |
| `choice` | 单选（需 options） | 选择列表 | `exact`    |

**如何选择字段类型**：

| 答案特征 | 类型 | 示例 |
|---|---|---|
| 答案是有限集合中的一个 | `choice` | 更热的城市（A/B/一样热）、是/否 |
| 答案是纯数字 | `number` | 闹钟数量、联系人个数、价格 |
| 答案是开放文本 | `text` | 日程标题、天气描述、地址 |
| 答案数量不确定（0~N 个） | `text` + `repeatable` | 列出所有符合条件的城市 |

**选择优先级**：`choice` > `number` > `text`。能用 `choice` 就不用 `text`——选择比填空更不易出错，Agent 点选按钮比输入文本可靠，评测也更精确（消除格式差异）。

**`repeatable` 使用场景**：当答案是一个列表且长度不固定时（如"哪些天有雨"、"每个城市的温度"），声明 `text`/`number` + `repeatable: true`，Agent 可通过"添加"按钮逐个填入。配合 `compare: "set"` 可忽略顺序。

### 4.2 可选属性

**UI 渲染属性**（两条路径都使用，决定 AnswerSheet 的表单呈现）：

| 属性           | 类型          | 说明                                               |
| -------------- | ------------- | -------------------------------------------------- |
| `label`      | `str`       | 字段标签，支持 `{param}` 模板                    |
| `hint`       | `str`       | 输入提示（placeholder），如 `"如：14:30"`        |
| `options`    | `list[str]` | 选项列表（`choice` 必填），支持 `{param}` 模板 |
| `repeatable` | `bool`      | 是否允许 Agent 添加多项                            |

**任务级属性**（声明在 Task 类上，非字段级）：

| 属性            | 类型                | 说明                                             |
| --------------- | ------------------- | ------------------------------------------------ |
| `answer_hint` | `str` or `None` | AnswerSheet 顶部的全局提示文案（显示在问题下方） |

**评测属性**（仅路径 A `build_grounded_checks` 使用，路径 B 忽略）：

| 属性        | 类型    | 说明                                                                    |
| ----------- | ------- | ----------------------------------------------------------------------- |
| `matcher` | `str` | 匹配器覆写：`exact` / `number` / `date` / `time` / `duration` |
| `compare` | `str` | 可重复字段比较模式：`sequence`（默认）/ `set`（顺序无关）           |

### 4.3 matcher 匹配器详解

所有 matcher 由 `_match_grounded_field()` 统一分派（`common_tasks.py`）。不指定 `matcher` 时，框架根据 `type` 自动选择默认匹配器（`text`/`choice` → `exact`，`number` → `number`）。

| matcher      | 调用函数 / 逻辑                                        | 典型场景           |
| ------------ | ------------------------------------------------------ | ------------------ |
| `exact`    | `normalize_text(actual) == normalize_text(expected)` | 城市名、书名、选项 |
| `number`   | `math.isclose(float(actual), float(expected))`       | 数量、计数         |
| `date`     | `date_match_labels()` (`utils.py`)                 | 日期               |
| `time`     | `match_time()` (`common_tasks.py`)                 | 时刻               |
| `duration` | `match_duration()` (`common_tasks.py`)             | 时长               |

**`exact`** — 精确匹配（默认）

直接在 `_match_grounded_field` 内联实现。两端 `strip()` + `normalize_text()`（中文数字→阿拉伯数字归一化）后做 `==` 比较。

```
expected = "北京"  actual = " 北京 " → normalize → "北京" == "北京" → ✓
expected = "北京"  actual = "上海"   → ✗
```

**`number`** — 数值匹配

直接在 `_match_grounded_field` 内联实现。`math.isclose(float(actual), float(expected), rel_tol=1e-6, abs_tol=1e-9)`。

```
expected = 3       actual = "3"   → float("3") == 3.0 → ✓
expected = 3       actual = "3个" → float("3个") → ValueError → ✗
```

> ⚠️ 对 actual 直接做 `float()` 转换，不提取数字。Agent 必须填写纯数字。

**`date`** — 日期等价匹配

调用 `bench_env.task.utils.date_match_labels(expected, os_state)` 生成所有合法表示（如 `"4月6日"` / `"4月6号"` / `"04-06"` / `"周一"` / `"明天"` 等），`normalize_text(actual)` 命中集合中任一即通过。相对日期基于 OS 模拟时间 (`os_state`) 计算。

```
expected = "2026-04-06"  actual = "4月6日"  → ✓
expected = "2026-04-06"  actual = "明天"    → ✓（如果模拟时间为 4 月 5 日）
expected = "2026-04-06"  actual = "周一"    → ✓（如果 4.6 确实是周一）
```

**`time`** — 时刻匹配（±5 分钟容差）

调用 `match_time(expected, actual, tolerance_minutes=5)`（`common_tasks.py`）。归一化为 `(hour, minute)`，支持 `HH:MM`、`H点M分`、`上午/下午/凌晨` 前缀，午夜绕回处理。

```
expected = "14:30"  actual = "下午2点30分" → (14,30) vs (14,30) → ✓
expected = "09:54"  actual = "9:58"        → diff=4min ≤ 5 → ✓
expected = "09:54"  actual = "10:02"       → diff=8min > 5 → ✗
```

**`duration`** — 时长匹配

调用 `match_duration(expected, actual)`（`common_tasks.py`）。归一化为总分钟数，支持 `X小时Y分` / `Z分钟` / `H:MM` 等写法。

```
expected = "1小时30分"  actual = "90分钟"       → 90 == 90 → ✓
expected = "0小时59分"  actual = "59分"          → 59 == 59 → ✓
expected = "2小时15分"  actual = "2:15"          → 135 == 135 → ✓
```

### 4.4 hint 编写规范

每种字段类型有**默认 placeholder**（不指定 `hint` 时显示）：

| `type`   | 默认 placeholder   |
| -------- | ------------------ |
| `text`   | 「请输入」         |
| `number` | 「请输入数字」     |
| `choice` | （无，选项按钮自解释） |

**不需要自定义 hint 的场景**：

- `number` 类型 — 默认 placeholder 已经明确要求输入数字
- `choice` 类型 — 选项按钮本身就是提示，Agent 直接点选

**需要自定义 hint 的场景**：`text` 类型且答案格式不明显时，用 `hint` 提供**典型示例值**引导格式：

```python
{"hint": "如：晴"}        # 天气
{"hint": "如：23°"}       # 温度
{"hint": "如：14:30"}     # 时间
{"hint": "如：233元"}     # 价格
{"hint": "如：三体"}      # 书名
```

**hint 与评测逻辑的交叉验证**：

hint 不仅是 UI 提示——它是**任务语义**和**评测逻辑（check）**的交汇点。编写 hint 时必须同时审视两端，而非机械地适配 check 格式：

1. **从任务语义出发**：任务问的是什么？用户（Agent）自然会给出什么格式的答案？
2. **查 check 逻辑**：`get_answer()` / `get_expected_response()` 返回什么格式？`matcher` 或 `check_goals` 怎么匹配？
3. **交叉验证**：两端是否一致？hint 示例值能否同时被 check 正确匹配、且符合任务的自然语义？

**如果发现不一致，应视为潜在 bug 报告，而非默默用 hint 去适配 check**。常见不一致：

| 场景 | 任务语义 | check 实际行为 | 问题 |
|---|---|---|---|
| 问"会议开始时间" | 可能含日期+时间 | `get_answer` 只返回 `"14:30"` | check 是否丢了日期？取决于上下文——同一天有多场同名会议时纯时间不够唯一 |
| 问"价格" | 含单位如"233元" | `exact` matcher 比较 | `get_answer` 返回 `"233"` 还是 `"233元"`？不一致就会 false negative |
| 问"总时长" | 自然回答"1小时30分" | `number` matcher 期望纯数字 | label 写"总时长（分钟）"约束 Agent 填 `90`，还是用 `duration` matcher 接受自然表达？ |

> ⚠️ **原则：hint 反映任务的自然预期格式，check 必须能正确匹配这个格式。** 如果 check 匹配不了任务自然预期的格式，那是 check 的问题，不是 hint 该去迁就的。发现此类不一致时应报告并修正 check 逻辑。

---

## 5. 路径 B 的注意事项

### 5.1 hydrate 拼接格式

AnswerSheet 的多个字段值用 `", "` 拼接注入 `input.answer`：

```
字段 0 = "晴", 字段 1 = "23°", 字段 2 = "15°"
→ input.answer = "晴, 23°, 15°"
```

### 5.2 多字段同类型值的 false positive 风险

当多个字段的值类型相同（如两个温度字段），hydrate 拼接后 `check_goals` 的子串匹配可能将填反的值误判为正确。

**示例**：期望 高温=23°/低温=15°，Agent 填成 高温=15°/低温=23°

- `input.answer = "15°, 23°"`
- `has_close_number("15°, 23°", 23)` → 匹配到 23 → True（false positive！）

**推荐**：对有此风险的任务，不要写自定义 `check_goals`，让框架走路径 A 的逐字段精确匹配。

**不推荐**：如果确实需要自定义 `check_goals`（如同时检查 state 变更），可在 `check_goals` 中对 grounded 模式走结构化取值：

```python
def check_goals(self, input):
    checks = [self._check_state(input)]  # state 检查
    sheet = input.apps.get("answer_sheet", {})
    answers = sheet.get("answers", {})
    if answers:
        # grounded 模式：按字段索引取值
        high = answers.get("0", "")
        low = answers.get("1", "")
        checks.append({"field": "高温", "passed": has_close_number(high, expected_high), ...})
        checks.append({"field": "低温", "passed": has_close_number(low, expected_low), ...})
    else:
        # text 模式：从拼接文本匹配
        checks.extend(self._match_from_text(input.answer))
    return checks
```

> ⚠️ 此模式将 `check_goals` 耦合到评测模式，增加维护成本，仅在不可避免时使用。

### 5.3 check_goals 必须兼容两种模式

`check_goals` 会在 text 模式和 grounded 模式下都被调用（路径 B）。编写匹配逻辑时需确保：

- **text 模式**：`input.answer` 是 Agent 的自然语言回答
- **grounded 模式**：`input.answer` 是 AnswerSheet 值的 `", "` 拼接

通常使用 `xxx in answer_text` 或 `has_close_number(answer_text, expected)` 等宽松匹配即可兼容两种格式。

### 5.4 提交按钮为 toggle 模式

AnswerSheet 的提交按钮是 submit/unsubmit 切换式的。Agent 可以先提交、再修改、再提交。评测只读取**最终状态**：

- `submitted = True` + 答案正确 -> 通过
- `submitted = False`（即使答案正确）-> 不通过（路径 A 和路径 B 都检查 `submitted`）

> Agent 必须确保最终状态为已提交。如果修改后忘记再次提交，评测会判定失败。

---

## 6. 框架保障

### 6.1 副作用隔离

`BaseTask.always_ignore` 全局列表包含 `apps.answer_sheet`，因此 AnswerSheet 的所有状态变更（字段填写、提交等）**不会被算作非预期副作用**。任务开发者无需在 `expected_changes` 中声明答题卡路径。

### 6.2 步数自动补偿

Grounded 模式下，`RunnerConfig.get_max_steps()` 会自动为有 `answer_fields` 的任务增加 15 步（用于打开答题卡、填写字段、提交）。开发者无需手动调整 `max_steps`。

### 6.3 指令自动注入

`Controller.setup` 会自动在 `task.task_name` 后追加答题卡使用提示：

```python
task.task_name = task.description + " 然后打开 答题卡 APP 输入答案并提交"
```

Agent 收到的指令变为：`"帮我看看明天需不需要补班 然后打开 答题卡 APP 输入答案并提交"`。**任务的 templates 不需要包含答题卡相关文案**——框架自动追加。

---

## 7. 开发 Checklist

- [ ] **声明 `answer_fields`**：query / hybrid 任务是否声明了？类型和 label 是否准确？
- [ ] **hint 交叉验证**：text 类型是否提供了格式示例？hint 示例值是否同时符合**任务语义**（用户自然期望的格式）和 **check 逻辑**（matcher / check_goals 实际能匹配的格式）？如发现两端不一致，应报告为 check 逻辑 bug
- [ ] **matcher 覆写**：时间字段用 `time`，日期字段用 `date`，时长用 `duration`
- [ ] **`get_expected_response`**：`get_answer()` 返回 `re.Pattern` 时是否覆写了此方法提供精确值？返回 `dict` 但字段数少于 dict key 数时是否覆写做了合并？
- [ ] **check_goals 兼容性**：有自定义 `check_goals` 的任务，匹配逻辑是否兼容 AnswerSheet 注入的简洁格式？
- [ ] **多字段风险**：多个同类型字段是否存在值交叉污染风险？如有，是否直接读取 `answer_sheet.answers` 结构化值？
