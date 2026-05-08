# 任务测试规范

> 从 `TASK_DESIGN_SPEC.md` §16 拆分而来。任务编码规范见 `TASK_DESIGN_SPEC.md`；任务设计思路见 `TASK_DESIGN_GUIDE.md`。

> 每个 suite 的 task 必须有对应的测试。测试不是可选项 — **没有测试的 task 等于没有验证的 judge，上线即赌博。**

## 1. 测试分层

测试分为两层，职责明确：

| 层级                | 依赖                      | 标记                  | 覆盖内容                                         |
| ------------------- | ------------------------- | --------------------- | ------------------------------------------------ |
| **离线测试**  | 仅 `defaults.json`      | 默认（无标记）        | 任务定义验证 + Accessor 测试 + Judge 正负例矩阵  |
| **Live 测试** | 模拟器 `localhost:3000` | `@pytest.mark.live` | Judge 依赖模拟器运行时状态的任务（如查询后判定） |

**绝大多数任务应为离线测试**。只有 judge 逻辑需要模拟器 setup 产生的运行时数据（如 `queryState.directTrains` 在 App 内通过搜索动态生成，无法静态构造）才需要 Live 测试。

## 2. 文件结构

```
bench_env/tests/
├── conftest.py              # 共享 fixtures 和 helpers
├── pytest.ini               # pytest 配置
├── __init__.py
├── test_railway12306.py     # Railway12306 suite 测试
├── test_weather.py          # Weather suite 测试
├── test_wechat.py           # WeChat suite 测试
└── ...                      # 每个 suite 一个文件
```

**命名约定**：

- 文件名：`test_<suite_name>.py`（与 `task/<suite_name>/` 目录名一致）
- 测试类：按功能分组（`TestTaskDefinitions`、`Test<App>Accessor`、`TestTaskJudgeMatrixOffline`、`TestLiveQueryTasks`）

## 3. 共享基础设施 (`conftest.py`)

`conftest.py` 提供所有 suite 测试共用的 fixtures 和 helpers：

```python
# fixture: session 级 MobileGymEnv（Live 测试用）
@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def env(request) -> MobileGymEnv: ...

# helper: 从原始 state dict 构建 JudgeInput
def make_judge_input(init_state, curr_state, *, route=None, init_route=None, answer=None) -> JudgeInput: ...
```

**使用 `make_judge_input`**：

- `route` — Agent 操作后的**当前**路由（赋给 `last_obs.route`）
- `init_route` — Agent 操作前的**初始**路由（赋给 `init_obs.route`，默认 `{}`）
- 两个路由独立设置，不会互相覆盖

```python
from bench_env.tests.conftest import make_judge_input

# 基本用法：只关心当前路由
inp = make_judge_input(
    {"apps": {"weather": init_data}, "os": os_state},
    {"apps": {"weather": curr_data}, "os": os_state},
    route={"app": "weather", "path": "/settings"},
    answer="25°C",
)

# 需要区分初始/当前路由时：
inp = make_judge_input(
    {"apps": {"weather": init_data}, "os": os_state},
    {"apps": {"weather": curr_data}, "os": os_state},
    init_route={"app": "weather", "path": "/"},
    route={"app": "weather", "path": "/settings"},
)
```

## 4. 必须覆盖的四类测试

### 4.1 任务定义验证 (`TestTaskDefinitions`)

**参数化**遍历 suite 中所有 task 类，自动检查。通过 `TaskRegistry` 收集类，避免只导入
`tasks.py` 而漏掉 `defs/` 布局：

```python
from bench_env.task.registry import TaskRegistry

ALL_TASK_CLASSES = list(TaskRegistry()._load_suite_tasks("<suite>").values())
```

| 检查项                                        | 验证内容                                             |
| --------------------------------------------- | ---------------------------------------------------- |
| `test_instantiation`                        | 默认参数可实例化，有 templates，apps 包含本 suite    |
| `test_description_renders`                  | 模板渲染无未解析的 `{placeholder}`                 |
| `test_required_class_attrs`                 | scope/objective/composition/difficulty 合法          |
| `test_parameter_defaults_present`           | 非 `_` 前缀参数都有 `default`                    |
| `test_answer_task_has_answer_or_get_answer` | AnswerTask 子类有 `answer` 或重写 `get_answer()` |

这些测试**模板化程度高**，新增 suite 时直接复用结构，只改导入路径和 app 名。

### 4.2 Accessor 测试 (`Test<App>Accessor`)

验证 `app.py` 中 App 类的属性和方法，使用 `defaults.json` 作为数据源：

```python
class TestWeatherAccessor:
    @pytest.fixture
    def w(self) -> Weather:
        return Weather(copy.deepcopy(DEFAULTS))

    def test_saved_cities(self, w: Weather):
        assert len(w.saved_cities) >= 1

    def test_current_temp(self, w: Weather):
        temp = w.current_temp("北京")
        assert isinstance(temp, (int, float))
```

**规则**：

- 每个 public 属性/方法至少一个 test
- 需要 `init` 参数的方法（如 `new_orders()`）单独测试 `TestAccessorWithInit`
- 数据缺失的 raise 行为也需验证（`pytest.raises`）

### 4.3 Judge 正负例矩阵 (`TestTaskJudgeMatrixOffline`)

**核心规则：每个离线任务必须有一个正例和一个反例。**

正负例通过工厂函数构造，返回 `(task, JudgeInput)` 元组：

```python
def _check_balance_positive_case():
    task = _tasks_module.CheckBalance()
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="500.00")

def _check_balance_negative_case():
    task = _tasks_module.CheckBalance()
    return task, _make_task_input(DEFAULTS, DEFAULTS, answer="999")
```

**收集为列表**，使用 `@pytest.mark.parametrize` 批量运行：

```python
OFFLINE_JUDGE_POSITIVE_CASES = [
    ("CheckBalance", _check_balance_positive_case),
    ("SetTempUnit", _set_temp_unit_positive_case),
    # ... 每个离线任务一条
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("CheckBalance", _check_balance_negative_case),
    ("SetTempUnit", _set_temp_unit_negative_case),
    # ...
]
```

**完整性校验**（防止遗漏）：

```python
def test_offline_judge_matrix_complete(self):
    positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
    negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
    assert positive == OFFLINE_JUDGE_TASK_NAMES
    assert negative == OFFLINE_JUDGE_TASK_NAMES
```

此测试确保**新增的任务如果没有对应的正负例，CI 会失败**。

#### 4.3.1 正负例构造原则

|                        | 正例                                         | 反例                                                           |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| **operate 任务** | 构造 Agent 操作后的正确状态（新增/修改数据） | 保持初始状态不变，或构造错误操作结果                           |
| **query 任务**   | `answer` 包含正确答案                      | `answer` 包含错误答案                                        |
| **hybrid 任务**  | 状态正确 + answer 正确（1 正例）             | 至少 2 反例：状态对/answer 错 + 状态错/answer 对（见下方说明） |
| **CriteriaTask** | 修改 curr_state 中对应字段为期望值           | 保持字段为初始值                                               |

**hybrid 任务反例矩阵**：

hybrid 任务同时检查状态变更和 Agent 回答，因此失败模式比 operate/query 更多。**至少需要 2 个反例**，覆盖两种独立失败路径：

| 组合                       | 预期结果 | 测试意义                                           |
| -------------------------- | -------- | -------------------------------------------------- |
| 状态正确 + answer 正确     | PASS     | 唯一的正例                                         |
| 状态正确 + answer 错误     | FAIL     | Agent 做对了操作但答错了问题（验证 answer 判定独立生效）  |
| 状态错误 + answer 正确     | FAIL     | Agent 答对了但没做操作（验证状态判定独立生效）     |
| 状态错误 + answer 错误     | FAIL     | 可选第 3 反例，覆盖全错场景                        |

```python
# ✅ hybrid 任务反例示例（ColdestDayIn15：需要导航到 forecast 页 + 回答最冷天）

# 反例 1：状态正确（route 在 forecast 页）但 answer 错误
("ColdestDayIn15_wrong_answer", lambda: (
    _tasks_module.ColdestDayIn15(city="成都"),
    _make_input(BASE_STATE, BASE_STATE, route=FORECAST_ROUTE, answer="错误答案"),
))

# 反例 2：answer 正确但状态错误（route 不在 forecast 页）
("ColdestDayIn15_wrong_route", lambda: (
    task := _tasks_module.ColdestDayIn15(city="成都"),
    _make_input(BASE_STATE, BASE_STATE, route=DEFAULT_ROUTE,
                answer=_realistic_answer(task, task.get_answer(...))),
))
```

**禁止**：

- 正例中使用与 `defaults.json` 无关的随意数据 — 状态必须合理可信
- 反例中只改 answer 拼写 — 应测试**语义层面**的错误（如查错人、查错值）
- 正负例共用同一个 builder 函数 — 每个例子独立构造，逻辑清晰

#### 4.3.2 AnswerTask 正例的 answer 必须是自然语言

**禁止**用裸 ground truth 值作为正例的 `answer`。Agent 不会只回答 `"多云"` 或 `"32"` — 它会说 `"上海今天天气多云"` 或 `"现在32度"`。裸值做 answer 会使 `match_value` 的模糊匹配（子串包含、数值提取）被旁路，等于没测。

```python
# ❌ answer 就是 ground truth 本身，match_value 子串匹配必然通过，测了个寂寞
return task, _make_input(state, state, answer="多云")

# ✅ answer 模拟真实 Agent 回答，验证 match_value 能从自然语言中正确提取
return task, _make_input(state, state, answer="上海今天天气多云")
```

**构造自然语言 answer 的原则**：

1. **包含 ground truth 关键信息** — 确保 `match_value` 能匹配（数字完整出现、关键词作为子串存在）
2. **加入合理的上下文** — 城市名、时间描述、单位、语气词等 Agent 会自然添加的信息
3. **不要过度复杂** — 目的是验证匹配逻辑，不是模拟所有可能的 Agent 风格

推荐使用 helper 函数（如 `_realistic_answer(task, expected)`）统一生成，避免在每个用例中手写。

**`match_value` 各类型匹配行为参考**（写正负例时必须了解）：

| expected 类型 | 匹配方式 | 正例 answer 示例 | 会匹配失败的 answer |
| ------------- | -------- | ---------------- | ------------------- |
| `int/float` | 从文本提取所有独立数字，逐个比较 | `"现在32度"` → 提取 `32` ✓ | `"三十二度"` ✓（中文数字归一化） |
| `str` | `expected in normalize_text(actual)` | `"天气多云转晴"` 含 `"多云"` ✓ | `"阴天"` 不含 `"多云"` ✗ |
| `re.Pattern` | `expected.search(normalize_text(actual))` | `"温度差不多"` 匹配 `r"一样\|相同\|差不多"` ✓ | `"温度接近"` ✗ |

#### 4.3.3 反例构造模式清单

**反例的目标是模拟真实 Agent 犯错**，而不是构造一个显然不可能出现的输入。Agent 是 VLM，它看到截图后做出决策——它的错误是有规律的。以下按任务类型列出常见错误模式，**每种反例必须选自下表中的一种模式**，禁止无脑使用 `answer="错误答案"`。

##### query 任务反例模式

| 错误模式 | 说明 | 反例构造 |
| --- | --- | --- |
| **查错对象** | Agent 看错了行/卡片/城市，回答了其他实体的值 | answer 填另一个同类实体的正确值（如问北京温度，answer 填上海温度） |
| **值接近但不对** | Agent 看到了正确位置但读数不准 | answer 填 ground truth ±1 或相近值（如正确 32，answer 填 "北京现在33度"） |
| **同义但语义不同** | Agent 用了近义词但含义不同 | answer 用同义替换但不匹配 ground truth（如 ground truth="多云"，answer 填 "今天阴天"） |
| **过度回答含干扰数字** | Agent 把页面上多个数值都说了一遍 | answer 包含多个数字，其中**不包含** ground truth（如正确是 40%，answer 填 "气温32度，风力3级，紫外线指数7"） |
| **中文数字变体** | Agent 用中文数字回答（这是正例还是反例取决于是否正确） | 正例可补一个中文数字变体（如 answer="北京现在二十度"）；反例用错误的中文数字 |
| **布尔判断翻转** | Agent 判断是非时说反了（"通过" ⊂ "未通过"） | 若 ground truth 为肯定，answer 填否定句（"没有通过核验"） |
| **空回答** | Agent 没有给出答案就 COMPLETE 了 | `answer=None` 或 `answer=""` |

```python
# ✅ 查错对象：问北京温度 20°C，Agent 回答了上海的 28°C
("CheckCurrentTemp_wrong_city", lambda: (
    _tasks_module.CheckCurrentTemp(city="北京"),
    _make_input(BASE_STATE, BASE_STATE, answer="上海现在28度"),
))

# ✅ 值接近：正确 20°C，Agent 答 21°C
("CheckCurrentTemp_off_by_one", lambda: (
    _tasks_module.CheckCurrentTemp(city="北京"),
    _make_input(BASE_STATE, BASE_STATE, answer="北京现在21度"),
))

# ✅ 过度回答含干扰数字：正确是湿度 40，Agent 说了一堆其他数字但没说 40
("CheckDetailCard_noise", lambda: (
    _tasks_module.CheckDetailCard(city="北京", metric="humidity"),
    _make_input(BASE_STATE, BASE_STATE, answer="北京气温20度，风力3级，紫外线指数7"),
))
```

##### operate 任务反例模式

| 错误模式 | 说明 | 反例构造 |
| --- | --- | --- |
| **未操作** | Agent 什么都没做 | curr_state 保持与 init_state 相同 |
| **做反操作** | Agent 理解反了指令（如关闭→开启） | 将目标字段设为与期望相反的值 |
| **操作错误目标** | Agent 操作了，但操作了错误的对象 | 修改了另一个同类字段（如改了风速单位而非温度单位）|
| **部分完成** | sequential/deep_dive 任务只做了第一步 | 只修改第一个 criteria 字段，其余保持初始值 |

```python
# ✅ 做反操作：让开启夜间免打扰，Agent 反而关闭了
("EnableNightDnd_inverted", lambda: (
    _tasks_module.EnableNightDnd(),
    _make_input(BASE_STATE, _with_settings(nightDnd=False)),
))

# ✅ 操作错误目标：让切温度单位，Agent 切了风速单位
("SwitchTempUnit_wrong_field", lambda: (
    _tasks_module.SwitchTempUnit(unit="fahrenheit"),
    _make_input(BASE_STATE, _with_settings(windUnit="ms")),  # 改错了字段
))

# ✅ 部分完成：SwitchUnitAndReport 要改单位并回答，只改了单位
("SwitchUnitAndReport_partial", lambda: (
    _tasks_module.SwitchUnitAndReport(city="上海"),
    _make_input(BASE_STATE, _with_settings(tempUnit="celsius")),  # 只改了温度单位
))
```

##### crossapp 任务反例模式

| 错误模式 | 说明 | 反例构造 |
| --- | --- | --- |
| **源 App 完成、目标 App 未动** | Agent 只在源 App 操作，忘了切到目标 App | 源 App 状态正确，目标 App 保持初始 |
| **信息传递错误** | Agent 从源 App 读了信息，但传到目标 App 时内容不对 | 目标 App 有新数据，但内容与源 App 不匹配 |
| **两个 App 都未操作** | Agent 迷失在导航中 | 所有 App 状态均保持初始 |

```python
# ✅ 源 App 完成但目标 App 未动：天气分享到微信，只查了天气没发消息
("WeatherShareForecast_no_send", lambda: (
    _tasks_module.WeatherShareForecast(),
    _make_input(
        {"weather": init_weather, "wechat": init_wechat},
        {"weather": init_weather, "wechat": init_wechat},  # 微信没变
    ),
))
```

**规则**：每个任务的反例**至少选用一种与任务类型匹配的模式**。当任务判定逻辑复杂（如涉及多字段检查、跨 App 验证），应覆盖**多种**反例模式。禁止所有反例都用 `answer="错误答案"` 或 `curr_state=init_state` 一种手法。

#### 4.3.4 match_value 边界条件测试要求

`match_value` 是 judge 匹配 Agent 回答的核心函数。以下边界条件**每个 suite 至少覆盖一个**（通过额外的正例或反例）：

| 边界条件 | 风险 | 测试要求 |
| --- | --- | --- |
| **多数字干扰** | Agent 回答 "今天32度，明天28度"，ground truth=28 时 32 也在文本中 | 正例：answer 含多个数字但包含 ground truth，验证匹配通过；反例：answer 含多个数字但**不含** ground truth |
| **中文数字** | Agent 用 "二十三" 而非 "23" 回答 | 至少 1 个正例用中文数字形式的 answer（如 `answer="北京现在二十度"`） |
| **空 answer** | Agent 未给出任何回答 | 至少 1 个 AnswerTask 反例用 `answer=None`，确认判定为 FAIL 而非报错 |
| **子串包含陷阱** | str 匹配时 `"通过" in "未通过"` 为 True | 涉及肯定/否定判断的 query 任务，反例必须测试否定词包含肯定词的场景（§4.5 逻辑必须用反例验证） |
| **尾零格式** | ground truth=278.2，Agent 答 "278.20元" | 涉及小数金额的 AnswerTask，正例 answer 应包含尾零变体（如 `"总共278.20元"`） |

```python
# ✅ 中文数字正例
("CheckCurrentTemp_chinese_num", lambda: (
    _tasks_module.CheckCurrentTemp(city="北京"),
    _make_input(BASE_STATE, BASE_STATE, answer="北京现在二十度"),
))

# ✅ 空 answer 反例
("CheckBalance_empty_answer", lambda: (
    _tasks_module.CheckBalance(),
    _make_input(BASE_STATE, BASE_STATE, answer=None),
))

# ✅ 多数字干扰正例（ground truth=40，answer 含 20 和 40）
("CheckDetailCard_multi_number", lambda: (
    _tasks_module.CheckDetailCard(city="北京", metric="humidity"),
    _make_input(BASE_STATE, BASE_STATE, answer="北京气温20度，湿度40%"),
))
```

**规则**：这些边界 case 可以作为额外的正/反例加入 `OFFLINE_JUDGE_POSITIVE_CASES` / `OFFLINE_JUDGE_NEGATIVE_CASES`（使用 `"TaskName_suffix"` 命名以与主 case 区分），不需要每个任务都覆盖——同一 suite 中选取有代表性的任务覆盖即可。完整性校验（`test_offline_judge_matrix_complete`）仍只检查每个任务至少有一个主正例和主反例。

#### 4.3.5 结构化值的多格式测试（时间、时长等）

Agent 是纯视觉模型，看到屏幕信息后会用**自然语言**回答。同一个结构化值（时间、时长等），Agent 可能用多种**语义等价但格式不同**的方式表达。`match_value` 的子串包含无法匹配这些等价变体，必须使用框架提供的语义匹配函数，并在测试中覆盖多种格式。

**Agent 常见的等价表达**：

| 系统内部格式 | Agent 可能的回答变体 | `match_value` 能否匹配 |
| --- | --- | --- |
| `"09:54"` | "9点54分"、"上午9点54分"、"上午9:54" | ✗（全部失败） |
| `"13:10"` | "下午1点10分"、"1点10分"、"13:10" | 仅精确匹配 ✓ |
| `"0小时59分"` | "59分钟"、"59分"、"不到1小时" | ✗（全部失败） |
| `"1小时10分"` | "70分钟"、"1小时10分钟"、"1:10" | 仅精确匹配 ✓ |

**框架提供的语义匹配函数**：

| 匹配器 | 用途 | 匹配原理 |
| --- | --- | --- |
| `match_duration(expected, actual)` | 时长匹配 | 双方归一化为总分钟数比较 |
| `match_time(expected, actual)` | 时间匹配 | 双方归一化为 (时, 分)，支持 12/24 小时制和上午/下午前缀 |

**测试要求**：当任务使用了 `match_duration` / `match_time`（或类似的语义匹配器），**必须添加多格式正例测试**，验证匹配器确实能覆盖 Agent 的各种回答变体。

**构造多格式 answer 的思维框架**（站在 Agent 角度）：

1. **Agent 看到了什么** — 屏幕上显示的是 "09:54"、"0小时59分" 还是其他格式？
2. **Agent 会怎么转述** — 人类看到 "09:54" 会自然地说"上午9点54分"或"9:54"，不会原样复述 "09:54"
3. **列出所有等价表达** — 同一个值有几种自然的中文/数字表达方式？每种至少一个正例
4. **反例必须是语义错误** — 反例应是真正错误的值（如 "10:30" 不等于 "09:54"），**不是**同一值的不同格式

**推荐模式**：在 Live/Offline test class 中使用独立的 `@pytest.mark.parametrize` 测试多格式正例：

```python
@pytest.mark.parametrize(
    "answer",
    [
        "G7010，1小时10分，上海虹桥，13:10",                       # 精确格式
        "最快的车是G7010, 70分钟, 始发站上海虹桥, 下午1点10分到达",  # 自然语言
        "G7010，70分钟，上海虹桥，下午1:10",                       # 混合格式
        "G7010，1小时10分钟，上海虹桥，13:10到",                   # 后缀变体
    ],
    ids=["exact", "chinese_natural", "mixed_format", "suffix_variant"],
)
async def test_fastest_train_flexible_answer_formats(self, env, answer):
    """Agent 以各种自然语言格式回答均应通过。"""
    task = _tasks_module.QueryFastestTrainDetails(
        from_station="上海", to_station="南京", date="2026-03-20",
    )
    inp = await self._setup_query_task(env, task)
    result = task.evaluate(
        JudgeInput(init_obs=inp.init_obs, last_obs=inp.last_obs, answer=answer)
    )
    assert result.success, f"Flexible format failed: {result.issues}"
```

**规则**：

- 涉及时间/时长回答的 AnswerTask，对应测试**必须**包含至少 2 种格式变体的正例
- 多格式正例测试独立于主正负例矩阵（不影响 `test_*_judge_matrix_complete` 的完整性校验）
- 如果未来遇到新的结构化值类型（如距离带单位、温度带单位等），应在 `common_tasks.py` 中新增对应的语义匹配函数，并同步添加多格式测试

### 4.4 Live 测试 (`TestLiveQueryTasks`)

仅用于 judge 依赖模拟器运行时状态的任务：

```python
@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
class TestLiveQueryTasks:
    async def _setup_query_task(self, env, task: BaseTask) -> JudgeInput:
        task._suite = "<suite_name>"
        init_obs = await task.setup(env)
        await self._inject_data(env)  # 注入测试数据
        last_obs = await env.get_observation()
        return JudgeInput(init_obs=init_obs, last_obs=last_obs)

    @pytest.mark.parametrize("task_name,task_factory,answer", LIVE_POSITIVE_CASES)
    async def test_positive_case(self, env, task_name, task_factory, answer):
        task = task_factory()
        inp = await self._setup_query_task(env, task)
        result = task.evaluate(JudgeInput(
            init_obs=inp.init_obs, last_obs=inp.last_obs, answer=answer,
        ))
        assert result.success
```

**Live 测试同样需要完整性校验**，确保 `LIVE_JUDGE_TASK_NAMES` 集合完整覆盖。

## 5. 状态构造 Helper 的编写规则

每个 suite 的测试文件通常需要局部 helper 函数来构造测试状态：

```python
# 模块级常量
DEFAULT_ROUTE = {"app": "<suite>", "path": "/"}
TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}

# 封装 make_judge_input，简化重复的 apps/os 包装
def _make_task_input(init_state, curr_state, *, route=None, answer=None) -> JudgeInput:
    return make_judge_input(
        {"apps": {"<suite>": init_state}, "os": TEST_OS_STATE},
        {"apps": {"<suite>": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )
```

**规则**：

- Helper 函数以 `_` 前缀标记为私有
- 状态构造 helper（如 `_booking_order()`）用于复杂的 operate 任务，避免正负例中重复构造大段 dict
- **禁止在 helper 中写判定逻辑** — helper 只构造数据，判定交给 `task.evaluate()`

## 6. 运行命令

```bash
# 仅离线测试（不需要模拟器）
pytest bench_env/tests/ -m "not live" -v

# 单个 suite 的离线测试
pytest bench_env/tests/test_weather.py -m "not live" -v

# 全量测试（需要模拟器在 localhost:3000 运行）
pytest bench_env/tests/ -v

# 指定模拟器地址
pytest bench_env/tests/ --sim-url http://localhost:3001

# 只跑 Live 测试
pytest bench_env/tests/ -m live -v
```

## 7. 新增 suite 测试的流程

1. 创建 `bench_env/tests/test_<suite>.py`
2. 复制任务发现代码（`TaskRegistry()._load_suite_tasks("<suite>")` + `ALL_TASK_CLASSES`）
3. 加载 `defaults.json`
4. 实现 `TestTaskDefinitions`（直接复用模板，改导入和 app 名）
5. 实现 `Test<App>Accessor`（覆盖 `app.py` 的 public 属性/方法）
6. 为每个离线任务编写 `_xxx_positive_case()` / `_xxx_negative_case()`
7. 收集为 `OFFLINE_JUDGE_POSITIVE_CASES` / `OFFLINE_JUDGE_NEGATIVE_CASES`
8. 实现 `TestTaskJudgeMatrixOffline`（含完整性校验）
9. 如有 Live 任务，实现 `TestLiveQueryTasks`（含完整性校验）
10. 运行 `pytest bench_env/tests/test_<suite>.py -m "not live" -v` 验证通过

## 8. 配置要求

`bench_env/tests/pytest.ini`：

```ini
[pytest]
asyncio_mode = auto
addopts = -n 3
required_plugins = pytest-xdist
```

依赖（`pip install`）：

- `pytest`
- `pytest-asyncio`
- `pytest-xdist`（并行运行，`-n 3`）
