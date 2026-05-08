# bench_env Task 设计规范

> 本文档是 `bench_env/task/` 下所有 Task、App、工具函数的**编码规范**。所有新增和修改任务必须遵守。
>
> **范围**：本文档只约束**任务代码怎么写**——基类选择、文件职责、参数设计、判定逻辑、错误处理、命名、元数据等编码层面的规则。测试规范见 `TASK_TEST_SPEC.md`；框架 API 的完整参考（路径表达式语法、`match_value` 行为、`build_answer_checks` 用法等）见框架源码，bench_env/README.md及其 docstring；任务设计思路见 `TASK_DESIGN_GUIDE.md`。
>
> 动机：现有任务缺乏统一约束，导致基类选择随意、文件职责模糊、抽象层级不一致、命名混乱、元数据缺失等问题。本规范从**已暴露的真实问题**（见 `PROBLEM.md`）出发，逐条制定可执行的规则。

---

## 1. 文件结构与职责边界

每个 suite 目录（如 `task/wechat/`）的职责边界如下。Task 类可以使用 legacy
单文件布局 `tasks.py`，也可以使用一任务一文件布局 `defs/<TaskName>.py`；两者可在同
suite 内共存用于迁移，但新增批量任务优先使用 `defs/`，且类名不能重复。

| 文件/目录                  | 职责                                                                                                            | 禁止包含                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `tasks.py`                 | Task 类定义（legacy 多类单文件布局）                                                                            | 数据访问的封装逻辑、通用工具函数、App 状态属性 |
| `defs/<TaskName>.py`       | Task 类定义（一任务一文件布局；文件名与主类名保持一致）                                                         | 数据访问的封装逻辑、通用工具函数、App 状态属性 |
| `app.py`                   | App 状态访问器（继承 `BaseApp`），提供数据方法（类型化属性读取、通用查找）和 `check_*` 方法（高频验证模式） | 任务特有的判定决策、业务规则、单任务专用计算   |
| `__init__.py`              | 模块标识（通常为空）                                                                                            | 任何实质代码                                   |

### 1.0 跨 App suite 的文件结构

跨 App suite（如 `task/crossapp_life/`）的所有数据都来自各单 App 的 state，**没有"自己的 state"**。文件结构与单 App suite 有两处差异：

| 差异             | 单 App suite             | 跨 App suite                                                                     |
| ---------------- | ------------------------ | -------------------------------------------------------------------------------- |
| `app.py`       | 必须有，继承 `BaseApp` | **通常不建**；仅当确实存在无法归属于任何单一 App 的本 suite 专用逻辑时才建 |
| `check_*` 来源 | 本 suite 的 App 类       | 各单 App 的 App 类                                                               |

**核心规则**：

1. **优先复用单 App 已有的 `check_*` / 数据方法 / answer 方法**。跨 App 任务的 `check_goals()` 实例化多个单 App 的 App 类，调用它们各自的方法，只做组装和决策逻辑
2. **缺失的 check 方法在对应单 App 的 `app.py` 中新增**，而非在跨 App 的 `tasks.py` 里内联构建与该 App 数据结构耦合的 check dict。这样同一个 App 的验证逻辑只维护一份，单 App 任务也能复用
3. **先补方法，再写 task** — 写跨 App task 的 `check_goals()` 时，如果需要的 app.py 方法不存在，必须**先在对应 app.py 中补好方法并测试**，再回到 task 中调用。禁止"先在 tasks.py 内联写逻辑，以后再重构到 app.py"。具体流程：
   1. 确认是否已有可用方法
   2. 若没有，在对应 app.py 中新增方法（遵循 §1.2 的数据方法/answer 方法/check 方法分层）
   3. 为新方法补测试
   4. 回到 task 中调用新方法
4. 如果确实需要本 suite 专用的、无法归属于任何单一 App 的辅助逻辑，才在本 suite 的 `app.py` 中放置；能归属于某个 App 的一律放那个 App 的 `app.py`，跨 suite 通用的纯函数放 `utils.py`

### 1.1 Task 定义文件（`tasks.py` / `defs/*.py`）的职责

**允许包含**：

- Task 类定义（继承 `BaseTask` / `CriteriaTask` / `AnswerTask` / `VagueTask` / `SafetyTask`）
- 从各 app.py 导入并**组合** `expected_changes` 常量（如 `WECHAT_SEND_CHANGES + NOTES_CREATE_CHANGES`），但**定义**必须放在对应 app.py 中
- import 语句
- Task Index 注释（仅 `tasks.py` 使用；`defs/` 单文件无需生成 index）

**禁止包含**：

- 自定义基类、mixin、抽象中间层（所有 task 必须直接继承标准基类）
- 模块级 helper 函数（如 `_chk()`、`_build_xxx()`）→ 属于 app.py 或 utils.py
- App 专属数据常量（采样池、路线表、值映射常量、`expected_changes` 路径常量）→ 属于 app.py
- Task 间继承（task A 不能继承 task B 再改一个 check；看似减少重复，实际增加耦合）
- Task 类上的私有计算/聚合方法（如 `_rain_days_next_week()`、`_weekend_temp_range()`）→ 泛化后移至 App 类
- 采样函数定义 → `sample_*` 统一定义在 App 类中，task 只通过 `parameters` 声明引用

**编写原则**：

1. 每个 task 独立完整 — 不继承其他 task，不依赖 task 文件中的共享 helper
2. 只从标准基类继承 — `BaseTask` / `AnswerTask` / `CriteriaTask` / `VagueTask` / `SafetyTask`
3. 优先声明式 — 能用 `answer = ".path"` / `criteria = {"key": "value"}` 表达的，不写方法
4. **Task 类只做组装，不做计算** — 数据遍历、聚合、计算逻辑泛化后放入 App 类；`get_answer()` / `check_goals()` 只负责调用 App 方法（如 `rail.find_new_pending_order()` 拿数据、`wechat.check_sent_to(contact, title)` 做通用验证）、做最终比较和组装 check dict
5. 值映射复用 — 多 task 共享的 `values` dict 参数提取为 app.py 模块级常量（如 `SCHEDULE_PREF_PARAM`），单 task 专用的直接 inline

### 1.2 `app.py` 的职责

App 类提供三层封装：**数据方法**（返回原始数据）、**answer 方法**（返回 judge 可直接使用的格式化答案）和 **check 方法**（返回标准 check dict）。每层建立在前一层之上，逐级提供更高层的复用。

#### 1.2.1 数据方法（返回原始数据）

**应该封装为数据方法/属性的**：

- 多步查找（调用者不应关心中间步骤）：`last_text_to(contact_name)` 内部做 wxid 查找 → 聊天匹配 → 消息过滤 → 取内容
- 结构复杂的取值（含 fallback、模糊匹配、类型转换+校验）：`find_contact_wxid(name)` 做名字/别名归一化匹配；`current_temp(city)` 含城市解析 → bundle 查找 → 字段提取 → 类型转换
- 数据结构特有的辅助（schema 相关的解析和匹配）：`count_matching_transfers`
- 干净的数据聚合（无业务规则）：`monthly_expense(month)`、`count_rainy_days(days)`、`temp_range_of_days(days)` — 即使当前只有一个 task 使用，只要涉及数据遍历或聚合，也应泛化后放入 App 类
- init vs current 差集（通用数据对比）：`field_added_items(path)`、`new_ids(path)`

**不需要封装的**（直接用 `app.get()` 路径访问）：

- 路径本身就是语义，无结构复杂度：`app.get("settings.darkMode")`、`app.get("user.name")`
- 单层简单属性读取，无校验/转换需求

**判断标准：封装的价值来自隐藏结构复杂度或提供校验**，不是为了"给字段取个好听的名字"。如果 `app.get("x.y.z")` 已经清晰表达语义，就不需要再包一层 `app.xyz` 属性。

#### 1.2.2 answer 方法（返回 judge 可用的格式化答案）

answer 方法建立在数据方法之上，将原始数据**转换为 `get_answer()` / `check_goals()` 可直接使用的答案值**。与数据方法的区别：数据方法返回原始数据（温度数值、日期字符串），answer 方法返回经过格式化的 judge 答案（含平局正则、同义覆盖、单位换算等）。

**应该封装为 answer 方法的**：

- 比较类答案（两城市哪个更热/更潮/温差更大）：数据方法返回原始数据元组，answer 方法处理平局 → `re.Pattern`、赢家 → 城市名
- 聚合类答案（未来几天最暖的一天、最不容易下雨的城市）：数据方法返回日期列表，answer 方法做排序 + 选取 + 格式化
- 需要跨字段组装的答案（城市当前温度+天气+AQI 的完整报告）：数据方法各取各的，answer 方法组装为 dict

**命名约定**：`<动作>_answer` 或 `<场景>_answer`，如 `hotter_city_answer(city1, city2)`、`warmest_day_answer(city, days)`。

**设计规则**：

1. **返回值类型必须适配 `match_value` 语义**（`int`/`float`/`str`/`re.Pattern`/`dict`），与 §4.3 一致
2. **平局/同义表达必须用 `re.Pattern`** — 不返回硬编码字符串（§4.3 规则同样适用）
3. **所有 `get_answer()` 中的答案计算都必须封装为 answer 方法** — `get_answer()` 应当只剩一行调用
4. **不做判定决策** — answer 方法只回答"正确答案是什么"，不回答"Agent 是否答对了"（后者是 check 方法的职责）

```python
# ✅ answer 方法示例 — 建立在数据方法 hotter_city() 之上
class Weather(BaseApp):
    def hotter_city(self, city1, city2) -> tuple[str, float, float]:
        """数据方法：返回 (winner, temp1, temp2)"""
        ...

    def hotter_city_answer(self, city1, city2) -> str | re.Pattern:
        """answer 方法：返回 judge 可直接使用的答案。"""
        winner, _, _ = self.hotter_city(city1, city2)
        if winner == "一样":
            return re.compile(r"一样|相同|差不多")
        return winner

# ✅ task 的 get_answer() 变成一行调用
class CompareCityTemp(AnswerTask):
    def get_answer(self, input):
        return Weather(input.apps["weather"]).hotter_city_answer(
            self.p.city1, self.p.city2)

# ✅ 跨 APP 任务也能复用同一个 answer 方法
class SomeCrossAppTask(BaseTask):
    def check_goals(self, input):
        answer = Weather(input.apps["weather"]).hotter_city_answer(
            self.p.city1, self.p.city2)
        # ... 用 answer 做进一步验证
```

#### 1.2.3 check 方法（返回标准 check dict）

**所有与 App 数据结构耦合的验证都必须封装为 `check_*` 方法**。`check_goals()` 只负责组合这些原子 check，加上任务特有的决策逻辑（条件分支、answer 组装）。禁止在 `check_goals()` 中内联构建与 App 数据耦合的 check dict。

**设计规则**：

1. **返回单个 `dict`**（`{"field":..., "expected":..., "actual":..., "passed":...}`），不返回 `list[dict]` — 列表组装是 `check_goals()` 的权力
2. **用 `*keywords` / 具名参数代替 predicate lambda** — 调用侧自文档化
3. **`field` 参数提供语义化默认值，推荐覆盖** — `field` 标识这项 check 的语义（出现在测试报告中）。默认值由方法根据参数自动生成（如 `check_sent_to("张三", ...)` 默认 `field="sent_to_张三"`），单次调用时无需手动指定。当同一 `check_goals()` 中多次调用同一方法、或需要表达更具体的业务语义时，用 `field=` 覆盖（如 `field="meeting_password"`）
4. **方法名必须自文档化** — 调用侧一看就知道在验证什么：`wechat.check_sent_to(contact, title, field="share")` 而非 `wechat.check(contact, title, mode="sent")`
5. **正反状态用 `expected` 参数** — 如 `check_following(name, expected=False)` 表示"取关"，`check_on_shelf(title, expected=False)` 表示"移出书架"，避免为每个反向操作创建单独方法

```python
# ✅ check 方法示例 — field 默认 None，方法内部生成语义化默认值，调用侧可覆盖
class Wechat(BaseApp):
    def check_sent_to(self, contact: str, *keywords: str, field: str | None = None) -> dict:
        """验证是否给联系人发了包含所有关键词的消息。"""
        if field is None:
            field = f"sent_to_{contact}"
        text = self.last_text_to(contact)  # 复用数据方法
        passed = bool(text and all(kw in text for kw in keywords))
        return {"field": field,
                "expected": f"msg to '{contact}' with {list(keywords)}",
                "actual": text or "(none)", "passed": passed}

    def check_moment_with(self, *keywords: str, field: str = "moment") -> dict:
        """验证是否发了包含所有关键词的朋友圈。"""
        ...

class Notes(BaseApp):
    def check_latest_contains(self, *keywords: str, field: str = "latest_note") -> dict:
        """验证最新笔记是否包含所有关键词。"""
        text = self.latest_note_text  # 复用数据属性
        passed = bool(text and all(kw in text for kw in keywords))
        return {"field": field,
                "expected": f"note with {list(keywords)}",
                "actual": (text or "(none)")[:200], "passed": passed}
```

**`field` 命名约定**：

| 场景                                  | 默认值（方法自动生成） | 推荐覆盖                                             |
| ------------------------------------- | ---------------------- | ---------------------------------------------------- |
| `check_sent_to("张三", temp)`       | `"sent_to_张三"`     | `field="weather_share"`                            |
| `check_sent_to("张三", meeting_id)` | `"sent_to_张三"`     | `field="meeting_id"`（同联系人多次调用时必须覆盖） |
| `check_moment_with(title, mood)`    | `"moment"`           | `field="mood_post"`                                |
| `check_latest_contains(city, temp)` | `"latest_note"`      | `field="weather_report"`                           |

**规则**：同一 `check_goals()` 中对同一方法的多次调用，`field` 必须各不相同（否则报告无法区分哪项失败）。

#### 1.2.3a check 设计的可靠性要求

所有 `check_*` 方法与 `check_goals()` 的设计，都必须满足以下约束：

1. **不误判错误路径** — 通过条件必须足以证明任务目标已完成，不能只依赖宽泛关键词命中
2. **不漏判合理路径** — 非任务本质的表述差异（标题、措辞、顺序、排版）不应导致失败
3. **证据来自可观测最终状态或稳定 checkpoint** — 优先验证最终产物、最终字段、最终发布内容；如果存在任务成立所必需的中间语义状态（checkpoint），且该状态在 state 中可稳定验证，也可以纳入检查
4. **不绑定路径性步骤** — 不要把某条具体 UI 操作路径上的偶然步骤，当作唯一正确方式
5. **不把不稳定痕迹字段当硬判据** — 仅记录"最后一次访问"、"当前选中项"、"最近查看对象"之类可被后续操作覆盖、不能保留完整历史的字段，默认不能单独作为 pass/fail 证据；除非该字段的语义已被设计为稳定、充分且与任务目标强绑定

**允许检查中间 checkpoint 的条件**：

- 该 checkpoint 对任务目标成立是**语义上必需**的，而非某条具体路径上的偶然副产物
- 该 checkpoint 能从 state 中**稳定观测**，不会被后续合理操作轻易覆盖或歧义解释
- 缺少该 checkpoint 时，仅凭最终结果不足以区分"真的做对"与"碰巧命中"

**禁止**：

- 仅因出现某个宽泛词（如"计划"、"总结"、"推荐"）就判定通过，除非该词本身就是任务核心目标
- 将原标题、原文全文、固定句式等某种特定表述，当作唯一正确形式，除非模板明确要求原文转发
- 为了验证过程，强行依赖不可靠的中间状态字段；若 App/模拟器未提供可靠机制，则应承认当前只能验证结果，或先增强 state 再升级 judge

#### 1.2.4 setup helper（`prepare_*`）规范

除了数据方法 / answer 方法 / check 方法外，**允许**在 App 类中放置少量
专供任务 setup（`_prepare()` / `_post_sample()`）使用的 helper，用于收口
与 App state schema 强耦合的对象构造或 state 变换逻辑。

**核心规则**：

1. **App 负责准备 state，Task 负责写回 env** — App helper 可以返回单对象、
   新 state 或 patch，但**不能**接收 `env`、调用 `env.get_state()` /
   `env.set_state()`；运行时环境编排仍属于 task
2. **对 Task 暴露的主入口统一使用 `prepare_state_with_*` 前缀** —
   表示“给定当前 app state，返回注入后的新 state”，例如
   `prepare_state_with_event(...)`、
   `prepare_state_with_incoming_text(...)`
3. **单对象 helper 仅作为 App 内部基础构造器** — 若某类 schema 值得单独封装，
   可用 `prepare_event(...)`、`prepare_message(...)` 等命名，但 task 调用侧
   优先使用 `prepare_state_with_*`
4. **命名描述变换结果，不描述 env 操作** — 禁止使用 `inject_*`、
   `mutate_*`、`set_*_in_env` 一类名字，避免误导调用方以为 helper 会直接
   修改运行环境

```python
# ✅ 推荐：App helper 返回新的 app state，task 决定何时写回 env
class Calendar(BaseApp):
    @staticmethod
    def prepare_event(...)-> dict[str, Any]:
        ...

    def prepare_state_with_event(...)-> dict[str, Any]:
        next_state = dict(self.raw)
        next_state["events"] = [*self.get_list("events"), self.prepare_event(...)]
        return next_state

class SomeTask(BaseTask):
    async def _prepare(self, env):
        state = await env.get_state()
        calendar_state = Calendar(state["apps"]["calendar"]).prepare_state_with_event(...)
        await env.set_state({"apps": {"calendar": calendar_state}}, deep=True, reload=False)
```

```python
# ❌ 不推荐：App helper 直接操作 env，混淆 accessor 与运行时编排
class Calendar(BaseApp):
    async def prepare_tomorrow_event(self, env, ...):
        state = await env.get_state()
        ...
        await env.set_state(...)
```

**适用场景**：

- 构造标准 Calendar event / SMS message / WeChat chat message
- 给某个 app state 追加一条记录、一个事件、一条消息
- 多个 task / 测试共享同一类注入 schema

**不适用场景**：

- 任务特有的注入策略（为什么注入、何时注入、注入几个、是否走某分支）
- 与 `_seed`、采样分支、业务条件强绑定的决策
- 需要跨多个 App 协调写入的 setup

#### 1.2.5 禁止放在 App 类的

- 直接操作运行环境的逻辑（`env.get_state()`、`env.set_state()`、等待页面状态等）
- 写死业务规则的计算（如 `"转账" in name` 判断是否为转账）
- 嵌入 UI 显示层逻辑的计算
- **任务特有的条件分支判定**（如"天气下雨则期望内容 A，否则期望内容 B"）— 这是 `check_goals()` 的职责。注意区分：从数据派生事实答案（"哪个城市更热"→ answer 方法）vs 根据事实决定验证策略（"下雨则检查伞提醒，否则检查出行建议"→ `check_goals()`）

#### 1.2.6 判断标准

| 问题                                                        | 归属                             |
| ----------------------------------------------------------- | -------------------------------- |
| 涉及"数据在哪、怎么取、字段名叫什么"，且有结构复杂度        | App 数据方法                     |
| 涉及数据遍历、聚合、计算（即使当前只一个 task 用）          | App 数据方法（泛化命名）         |
| 从数据派生 judge 可用的答案（比较、排序、格式化、平局正则） | App answer 方法                  |
| 与 App 数据结构耦合的验证（无论是否多任务复用）             | App check 方法（**强制**） |
| 与 App schema 强耦合的 setup 对象构造 / state 变换          | App `prepare_*` helper         |
| 任务特有的条件分支判定（根据事实决定验证策略）              | `check_goals()` 内联           |
| 路径访问已经清晰表达语义，无结构复杂度                      | 不封装，直接 `app.get()`       |

### 1.3 `task/utils.py` 的职责

通用工具函数，**跨 suite 复用**的纯函数：

- 文本处理：`clean_text()`、`norm()`、`extract_numbers()`
- 时间工具：`now_ms()`、`sim_today()`、`sim_datetime()`
- 数据解析：`parse_distance_to_meters()`、`parse_duration_to_minutes()`
- 判定组合：`check_alternatives(*check_arrays)` — 多候选 OR 语义，在 N 组按位置对应的 check 结果中返回第一组全通过的；都不过返回第一组。两种典型用法：
  - **多候选实体**：地图搜索返回多个同名 POI 候选，任一候选的检查全通过即判定成功
  - **单维度 any_of**：某个 check 需要接受多种等价值（如天气描述接受中文归类或英文原文），用 `*check_alternatives([check(label) for label in labels])` 展开到返回列表中，替代为每个 App 新增 `check_*_any_of` 方法

**禁止**：

- 在 task 文件中局部定义通用工具函数 — 统一放 `utils.py`
- 在 app.py 中内联通用解析逻辑 — 提取到 `utils.py`

### 1.4 任务变体：合并 vs 拆分

当多个任务测试相似的交互模式时，需要决定合并为一个参数化类还是保持多个独立类。

**合并条件（必须同时满足）：**

1. **参数正交** — 所有参数的合法值互不依赖，任意组合都有效
2. **交互模式相同** — Agent 在 UI 上的操作路径相同（只是读取/操作的数据字段不同）
3. **判定逻辑结构一致** — `get_answer()` / `check_goals()` 只是分支选不同字段，不是完全不同的逻辑

```python
# ✅ 适合合并：5个详情卡片查询
#    参数正交（city × metric 任意组合有效）+ 同交互（都是滚到详情区读一个值）
class CheckDetailCard(AnswerTask):
    parameters = {
        "city": {"type": "enum", "values": _SAVED_CITIES, "default": "北京"},
        "metric": {
            "type": "enum",
            "values": {"湿度多少": "humidity", "紫外线强不强": "uv", "日出几点": "sunrise", ...},
        },
    }
```

**拆分条件（满足任一即拆分）：**

1. **参数耦合** — 参数 A 的合法值取决于参数 B（条件枚举）

```python
# 温度只能选 摄氏/华氏，风速可选 蒲福/km·h⁻¹/m·s⁻¹/mph/kn — unit 合法值取决于 unit_type
# ❌ 强行合并：需要 _linked sampler + helper dict，~40 行
class SwitchUnit(CriteriaTask): ...

# ✅ 拆分：每个 ~10 行，参数声明式可读
class SwitchTempUnit(CriteriaTask):
    parameters = {"unit": {"type": "enum", "values": {"摄氏度": "celsius", "华氏度": "fahrenheit"}}}
    criteria = {"settings.tempUnit": "{unit}"}

class SwitchWindUnit(CriteriaTask):
    parameters = {"unit": {"type": "enum", "values": {"蒲福": "beaufort", "公里/小时": "kmh", ...}}}
    criteria = {"settings.windUnit": "{unit}"}
```

2. **交互模式不同** — 虽然概念上是"同类任务"，但 Agent 的操作路径明显不同

```python
# CompareTempRange：不需滚动，读 4 值算 2 个差值再比较
# CompareHumidity：需滚动到详情区，读 2 值直接比较
# ❌ 合并为 CompareCityMetric — 交互路径和计算逻辑完全不同
# ✅ 保持两个独立类
```

**为什么不用 `_linked` sampler 强行合并耦合参数？**

虽然 §8.6 的 `sampler` + `fields` 机制技术上可以协同采样耦合参数，但**为了合并而写 sampler** 通常得不偿失：

- 拆分后每个类 ~10 行，合并后 ~40 行 + helper dict
- 拆分后参数声明式可读，合并后需要阅读 sampler 代码才能理解有效组合
- 拆分后 `criteria` / `answer` 直接声明，合并后大概率需要重写 `check_goals`

`_linked` sampler 的正确使用场景：参数本身需要协同采样（如出发站 + 到达站必须是有效线路对），不是为了合并本该独立的任务。

**判断快速公式：**

| 条件                                       | 做法                     |
| ------------------------------------------ | ------------------------ |
| 任意参数组合都有效 + 同交互模式            | 合并                     |
| 合法组合是参数笛卡尔积的真子集（条件枚举） | 拆分                     |
| 不同变体的 Agent 操作路径不同              | 拆分                     |
| 拆分后每个类 < 15 行                       | 拆分（简单到不值得合并） |

### 1.5 App 类命名规范

App 类名应与 `manifest.id` 对应，使用 PascalCase，**不带 `App` 后缀**：

| manifest.id      | 正确类名         | 错误类名        |
| ---------------- | ---------------- | --------------- |
| `wechat`       | `Wechat`       | `WechatApp`   |
| `bilibili`     | `Bilibili`     | `BilibiliApp` |
| `railway12306` | `Railway12306` | `RailwayApp`  |

---

## 2. 基类选择决策树

选择 Task 基类时，按以下顺序判断：

```
任务目标是什么？
├── Agent 需要回答信息 → AnswerTask（objective=query）
│   ├── 答案可用 answer 类变量表达 → 定义 answer
│   └── 答案需要复杂计算 → 重写 get_answer()
│
├── Agent 需要改变状态，且判定可用 key=value 表达 → CriteriaTask（objective=operate）
│   ├── 所有条件都是静态的 → criteria 类变量
│   ├── 条件包含参数 → criteria 用 "{param}" 模板
│   └── 同时需要检查回答 → 加 answer 类变量（objective=hybrid）
│
├── Agent 需要改变状态，且判定需要前后对比或复杂逻辑 → BaseTask
│   └── 重写 check_goals()（统一使用，禁止 override is_successful）
│
├── 指令模糊，多种完成方式均可 → VagueTask（objective=vague）
│
└── 指令涉及风险，Agent 应拒绝 → SafetyTask（objective=safety）
```

### 2.1 优先使用通用基类

**强制规则**：能用 `CriteriaTask` / `AnswerTask` 解决的，**禁止**继承 `BaseTask` 手写 `check_goals`。需要自定义判定时统一重写 `check_goals()`，**禁止** override `is_successful()`。

**反面案例**（已修复）：

```python
# ❌ 手写 check_goals 只是为了检查 route
class ShowReceiveQRCode(BaseTask):
    def check_goals(self, input):
        return [{"field": "route", "expected": "/pay/receive",
                 "actual": input.route.get("path"), "passed": ...}]

# ✅ 用 CriteriaTask 一行搞定
class ShowReceiveQRCode(CriteriaTask):
    criteria = {"route": "/pay/receive"}
```

### 2.2 查询类任务必须用 AnswerTask

**当前问题**：`bilibili/tasks.py` 中所有查询类任务（`ViewMyUidTask`、`VideoCommentContainsAnswerUidTask` 等）均继承 `BaseTask` 手写 answer 检查逻辑。

**规则**：任务要求 Agent 回答问题 → 继承 `AnswerTask`，利用框架的模糊匹配、中文数字归一化、slot 评估等能力。

```python
# ❌ 手写 answer 检查
class ViewMyUidTask(BaseTask):
    def check_goals(self, input):
        uid = BilibiliApp(input.apps.get("bilibili", {})).user_uid
        return [{
            "field": "answer", "expected": uid,
            "actual": input.answer,
            "passed": str(uid) in str(input.answer or ""),
        }]

# ✅ 使用 AnswerTask
class ViewMyUidTask(AnswerTask):
    answer = ".user.uid"
```

### 2.3 CriteriaTask 中重写 check_goals 的边界

继承 `CriteriaTask` 但重写 `check_goals()` 是**允许的**，前提是：

1. 基础 criteria 检查仍然需要（调用 `super()._check_criteria(input)`）
2. 额外增加了 criteria 无法表达的检查（如前后状态对比、列表包含检查）

**禁止**：继承 `CriteriaTask` 但完全不用 `criteria`、完全替换 `check_goals()` — 说明基类选择错误，应改为 `BaseTask`。

### 2.4 声明式优先：写 task 的决策顺序

写 task 时，按以下顺序决策，**越靠前越好**：

1. **先尝试声明式** — `answer = ".path"` / `criteria = {"key": "value"}`，看框架的路径表达式能否直接达到目的
2. **检查是否需要扩展框架** — 如果声明式差一点点就能表达（如 dict-of-paths、criteria key 模板），优先扩展框架的声明式能力，让所有 task 受益
3. **最后才写 `get_answer()` / `check_goals()`** — 只在逻辑确实无法声明式表达时（如需要排序、聚合、跨字段计算）

**app.py 方法的必要性检查**：

- 如果一个 app.py 方法只是 `self.get("fieldA.fieldB")` 的直白封装 → 删掉，用声明式路径
- 如果一个 app.py 方法只是 `next(x for x in self.list if x["key"] == value)` → 删掉，用 `[key={param}]` 语法
- 只有**真正复杂的数据访问**（多步查找、模糊匹配、跨集合关联、格式兼容）才值得 app.py 方法

```python
# ❌ 过度封装：app.py 方法 + tasks.py 调用链
# app.py
def get_default_passenger(self) -> dict:
    for p in self.passengers:
        if p.get("isDefault"): return p
    return None
# tasks.py
answer = staticmethod(lambda task, state:
    Railway12306(state).get_default_passenger()["name"])

# ✅ 一行声明式
answer = ".passengers[isDefault=True].name"
```

---

## 3. CriteriaTask 规则

### 3.1 criteria 必须是类变量

```python
# ✅ 正确
class EnableDarkMode(CriteriaTask):
    criteria = {"settings.general.darkMode": True}

# ❌ 禁止
class EnableDarkMode(CriteriaTask):
    @property
    def criteria(self):
        return {"settings.general.darkMode": True}
```

### 3.2 参数化使用 `"{param}"` 模板语法

```python
# ✅ 正确
class SetDepartureStation(CriteriaTask):
    criteria = {"searchForm.from": "{station}"}

# ❌ 禁止
class SetDepartureStation(CriteriaTask):
    @property
    def criteria(self):
        return {"searchForm.from": self.p.station}
```

### 3.3 值映射使用 `values` dict，禁止 `_XXX_MAP`

```python
# ✅ 正确：values dict {展示文本: 内部值}，自动生成展示映射
class SetFontSize(CriteriaTask):
    parameters = {
        "font_size": {
            "type": "enum",
            "values": {"最小": 0, "较小": 1, "标准": 2, "较大": 3, "最大": 4},
            "default": 2,
        }
    }
    criteria = {"settings.general.fontSizeLevel": "{font_size}"}

# ❌ 禁止：手动映射字典
_SIZE_MAP = {"最小": 0, "较小": 1, ...}
class SetFontSize(CriteriaTask):
    @property
    def criteria(self):
        return {"settings.general.fontSizeLevel": _SIZE_MAP[self.p.size_label]}
```

### 3.4 criteria key 支持数组查找和高级路径

criteria key 支持 `get_by_path` 的完整路径语法，包括 `[field=value]` 数组查找。**能用 criteria 声明式表达的数组字段检查，不要手写 `check_goals`。**

```python
# ✅ 数组查找：在 contacts 中找 name={contact} 的条目，检查其 isBlacklisted
criteria = {"contacts[name={contact}].isBlacklisted": True}

# ✅ 多字段检查：同一条目的多个字段
criteria = {
    "contacts[name={contact}].isStarred": True,
    "contacts[name={contact}].permissionMode": "chatOnly",
    "contacts[name={contact}].hideMyMoments": True,
}

# ✅ 值为 None 表示"条目不存在"（用于检查删除操作）
#    get_by_path 找不到匹配项时返回 None，None == None 判定通过
criteria = {"authorizedApps[name={app_name}]": None}

# ❌ 手写 check_goals 只是为了做数组查找
def check_goals(self, input):
    wechat = Wechat(input.apps["wechat"])
    contact = wechat.contact_by_name(self.p.contact)
    return [{"field": "blacklisted", "expected": True,
             "actual": contact["isBlacklisted"],
             "passed": contact["isBlacklisted"] is True}]
```

> **注意**：`_invert_criteria` 会跳过包含 `[` 的路径（无法自动取反数组内字段）。如果目标固定且 defaults 已是反面（如 `isBlacklisted` 默认 `false`），这不影响——不需要 `_invert_criteria`。如果目标可变且需要取反，则需手写 `_post_sample`。

### 3.5 参数语义必须与 store 一致

```python
# ✅ 正确：share_activity=False 对应 store 的 shareActivity=False
parameters = {"share_activity": {"type": "bool", "values": {"开启": True, "关闭": False}, "default": False}}
criteria = {"settings.shareActivity": "{share_activity}"}

# ❌ 禁止：参数语义反转，需要 not 运算
parameters = {"share_off": {"type": "bool", "default": True}}
@property
def criteria(self):
    return {"settings.shareActivity": not self.p.share_off}
```

---

## 4. AnswerTask 规则

### 4.1 优先使用 `answer` 类变量

`answer` 类变量支持多种形式，按优先级排列：

**路径表达式**（最常用）：

```python
# ✅ 简单路径
class CheckBalance(AnswerTask):
    answer = ".balance.totalAmount"

# ✅ 路径 + 转换函数
class CountContacts(AnswerTask):
    answer = (".contacts", len)

# ✅ 带参数过滤
class FindFriend(AnswerTask):
    answer = ".contacts[name={name}].phone"

# ✅ 布尔字面量过滤（True/False 直接写在 [] 内）
class DefaultPassengerName(AnswerTask):
    answer = ".passengers[isDefault=True].name"

# ✅ 跨 App 路径（appId:path）
class CheckRedbookLikes(AnswerTask):
    answer = "redbook:.posts[0].likes"

# ✅ dict-of-paths：多 slot 独立匹配（返回 dict，每个 slot 单独判定）
class CheckStudentVerify(AnswerTask):
    answer = {"from": ".studentVerify.from", "to": ".studentVerify.to"}
```

**字面量**（答案固定不变时）：

```python
# ✅ 数字字面量
class CountTabs(AnswerTask):
    answer = 4

# ✅ 字符串字面量
class AppDefaultLanguage(AnswerTask):
    answer = "中文"
```

**callable**（答案需要简单计算但不值得写 `get_answer()` 时）：

```python
# ✅ callable：(task, app_state) -> Any
class ContactCount(AnswerTask):
    answer = staticmethod(lambda task, state: len(state.get("contacts", [])))
```

### 4.2 重写 `get_answer()` 的场景

仅在以下情况重写：

1. 需要跨多个字段计算（求和、比较、排序）
2. 需要条件筛选后聚合
3. 路径语法无法表达的复杂逻辑

```python
class MonthlyExpenseTotal(AnswerTask):
    def get_answer(self, input):
        alipay = Alipay(input.apps["alipay"])
        return alipay.monthly_expense(self.p.month)
```

### 4.3 `get_answer()` 返回值类型

| 返回类型            | 匹配方式                                    | 示例                                  |
| ------------------- | ------------------------------------------- | ------------------------------------- |
| `int` / `float` | 从 Agent 回答中提取数字比较（支持中文数字） | `23` 匹配 "有23个人"、"二十三"      |
| `str`             | Agent 回答包含该字符串                      | `"张三"` 匹配 "用户名是张三"        |
| `re.Pattern`      | 正则 search                                 | `re.compile(r"xxx")`                |
| `dict`            | 分槽匹配（每个 slot 独立判定）              | `{"price": 99, "shipping": "free"}` |

> **注意**：`bool` 类型不走 `match_value` 自动匹配。是非判断需结合具体问题语境（肯定词⊂否定词的歧义），必须在 `check_goals()` 中自行处理。详见 §4.5。

**平局/同义表达场景必须用 `re.Pattern`**：当 `get_answer()` 的返回值是 Agent 可能用多种措辞表达的语义（如"一样热"/"差不多"/"温度相同"），**禁止**返回硬编码字符串 — `str` 类型走子串包含，无法覆盖同义变体。应返回 `re.compile()` 覆盖常见表达：

```python
# ❌ Agent 说"差不多"或"温度相同"都会匹配失败
return "一样热"

# ✅ 覆盖常见同义表达
return re.compile(r"一样|相同|差不多")
```

典型场景：比较类任务的平局返回、模糊语义判定。

### 4.4 禁止用 `input.answer` 验证非回答内容

`input.answer` 是 Agent 的自然语言回答（`ANSWER.value`）。**禁止**用它检查 Agent 是否发送了特定消息或执行了特定操作。

```python
# ❌ 用 answer 检查 Agent 是否发送了消息（Agent 不会把消息内容放 answer）
def check_goals(self, input):
    return [{"field": "answer", "expected": self.p.text,
             "actual": input.answer, "passed": self.p.text in (input.answer or "")}]

# ✅ 检查消息是否发送到了 App 状态中
def check_goals(self, input):
    wechat = Wechat(input.apps["wechat"])
    sent = wechat.has_sent_text_to(self.p.contact, self.p.text)
    return [{"field": "sent_message", "expected": self.p.text,
             "actual": sent, "passed": sent}]
```

### 4.5 布尔型 query 的 answer 判定

当 query 任务的答案是布尔值（如"是否通过核验"），**禁止**用 `match_value` 或 `answer` 类变量做自动匹配。原因：中文（和英文）中肯定词往往是否定词的子串（"通过" ⊂ "未通过"、"success" ⊂ "unsuccessful"），用 `re.search(r"通过")` 会在 Agent 回答"未通过"时误匹配。

**正确做法**：在 `check_goals()` 中**先检测否定、再检测肯定**：

```python
def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
    checks = self._check_criteria(input)
    expected = input.apps["railway12306"]["user"]["realNameVerified"]
    answer = re.sub(r"\s+", "", str(input.answer or ""))
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

**规则**：

1. 否定词必须先于肯定词检测 — 否定命中则判为否定，否则看肯定
2. 否定词列表要结合具体问题语境 — "是否通过"对应"未通过/没通过"，不同问题的否定表达不同
3. 禁止把预设数据放进 `criteria` — `criteria` 只检查 Agent 行为导致的状态变化（如路由），不检查 Agent 无法影响的初始数据

### 4.6 日期匹配：`date_match_labels`

当 `check_goals()` 需要验证 Agent 回答中的日期，使用 `bench_env.task.utils.date_match_labels()` 生成多标签列表，然后检查 Agent 回答是否包含任一标签：

```python
from bench_env.task.utils import date_match_labels

labels = date_match_labels(answer["date"], input.os)
passed = any(label in answer_text for label in labels)
```

`date_match_labels(date_value, os_state=None)` 生成的标签覆盖：

| 标签类型 | 示例（2026-03-19 周三）          | 说明              |
| -------- | -------------------------------- | ----------------- |
| ISO      | `2026-03-19`                   | 精确日期          |
| X月X日   | `3月19日`                      | 全称带"日"        |
| X月X号   | `3月19号`                      | 全称带"号"        |
| X日      | `19日`                         | 省略月份          |
| X号      | `19号`                         | 省略月份          |
| 周X      | `周三`                         | 星期简称          |
| 星期X    | `星期三`                       | 星期全称          |
| 相对日期 | `明天` / `后天` / `大后天` | 需传 `os_state` |

**规则**：

1. **必须传 `os_state`** — 不传则无法生成相对日期标签（"明天"/"后天"），Agent 非常可能用相对日期回答
2. **这是通用工具函数** — 不限于 weather，任何涉及日期回答的任务都应使用（App accessor 可封装为薄代理）
3. 在 `check_goals()` 中用 `any(label in text for label in labels)` 做多标签子串匹配，**不要**只匹配单一格式

### 4.7 结构化值的语义匹配：`match_duration` / `match_time`

当 `check_goals()` 需要验证 Agent 回答中的**时间**或**时长**时，`match_value` 的子串包含无法处理等价格式变体（如 `"09:54"` vs `"上午9点54分"`、`"0小时59分"` vs `"59分钟"`）。此时必须使用框架提供的语义匹配函数：

| 匹配器                               | 适用场景                       | 匹配原理                                         | 覆盖的格式变体                                       |
| ------------------------------------ | ------------------------------ | ------------------------------------------------ | ---------------------------------------------------- |
| `match_duration(expected, actual)` | 时长字段（如 `"0小时59分"`） | 双方归一化为总分钟数比较                         | `"59分钟"` `"59分"` `"0:59"` `"0小时59分钟"` |
| `match_time(expected, actual)`     | 时间字段（如 `"09:54"`）     | 双方归一化为总分钟数，**容忍 ±5 分钟**漂移 | `"9点54分"` `"上午9:54"` `"下午1点10分"`       |

> **`match_time` 容忍度说明**：默认 `tolerance_minutes=5`。原因：Agent 阅读屏幕时间（如 18:07）与 Runner 最终抓取状态的时间（如 18:08）之间存在不可避免的漂移。容忍窗口覆盖此场景。支持午夜零点跨越边界（如 23:58 vs 00:02，差 4 分钟 → 通过）。如需精确匹配，可传 `tolerance_minutes=0`。

**用法**：在 `check_goals()` 中按字段选择匹配器，替代 `build_answer_checks` 的默认 `match_value`：

```python
from bench_env.task.common_tasks import match_value, match_duration, match_time

def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
    answer_text = str(input.answer or "")

    _fields = [
        ("车次", "trainNo", match_value),
        ("历时", "duration", match_duration),
        ("始发站", "fromStation", match_value),
        ("到达时间", "arriveTime", match_time),
    ]

    return [
        {"field": f"answer.{name}", "expected": train[key],
         "actual": answer_text, "passed": matcher(train[key], answer_text)}
        for name, key, matcher in _fields
    ]
```

**何时使用语义匹配器**（判断标准）：

| 场景                                  | 做法                                             |
| ------------------------------------- | ------------------------------------------------ |
| slot 值是纯文本（人名、站名、车次号） | `match_value`（子串包含已足够）                |
| slot 值是数字（金额、数量）           | `match_value`（内置数字提取 + 中文数字归一化） |
| slot 值是时间格式（`"HH:MM"`）      | **必须用 `match_time`**                  |
| slot 值是时长格式（`"X小时Y分"`）   | **必须用 `match_duration`**              |
| slot 值是日期                         | 用 `date_match_labels`（§4.6）                |
| slot 值是其他结构化格式，存在等价变体 | 在 `common_tasks.py` 中新增对应匹配器          |

**禁止**：在 `check_goals()` 中对含时间/时长字段的 dict 直接用 `build_answer_checks` — 会因格式差异导致误判。

### 4.8 Grounded 评测模式：`answer_fields` / `answer_hint` / `get_expected_response`

> **完整文档见 [`AnswerSheet_GUIDE.md`](AnswerSheet_GUIDE.md)**（架构、字段类型、matcher 详解、路径判定、开发 checklist 等）。此处仅列与任务编写直接相关的规则。

**核心机制**：Grounded 模式通过 `AnswerSheet` 系统应用，将答案提交转化为基于 UI 状态的精确判定。框架自动完成以下工作（任务无需关心）：

- 向 `task.task_name` 追加 `" 然后打开 答题卡 APP 输入答案并提交"` 后缀，引导 Agent 使用答题卡
- 注入 AnswerSheet 表单状态到环境
- 自动增加 15 步 `max_steps` 预算
- 将 `apps.answer_sheet` 加入 `always_ignore`（不计为副作用）

**任务编写规则**：

1. **声明 `answer_fields`** — query / hybrid 任务声明表单字段（list 或含 `question` 的 dict 格式）
2. **`get_answer()` 返回 dict** — 默认 `get_expected_response` 按 dict value 顺序展开，`answer_fields` 字段顺序必须与 dict key 顺序一致
3. **`get_answer()` 返回 `re.Pattern`** — 必须覆写 `get_expected_response()` 提供精确值
4. **hint** — `number`/`choice` 类型通常不需要（有默认 placeholder）；`text` 类型建议提供格式示例（如 `"如：14:30"`）
5. **matcher** — 时间字段用 `"time"`，日期字段用 `"date"`，时长用 `"duration"`；不指定时按 `type` 自动选择

---

## 5. check_goals 返回格式

### 5.1 必须包含 `passed` 字段

框架在 `is_successful()` 和 `evaluate()` 中会对缺失 `passed` 的 check dict 直接抛出 `ValueError`。

```python
# ✅ 正确：显式提供 passed
return [{"field": "route", "expected": "/chat", "actual": path,
         "passed": path.startswith("/chat/")}]

# ❌ 错误：缺少 passed，框架会 raise ValueError
return [{"field": "route", "expected": "startsWith /chat", "actual": path}]
```

### 5.2 每个检查项的标准字段

| 字段         | 类型     | 必需         | 说明                                                      |
| ------------ | -------- | ------------ | --------------------------------------------------------- |
| `field`    | `str`  | 是           | 检查项名称（如 `"route"`、`"user.name"`、`"answer"` |
| `expected` | `Any`  | 是           | 期望值                                                    |
| `actual`   | `Any`  | 是           | 实际值                                                    |
| `passed`   | `bool` | **是** | 是否通过（禁止省略）                                      |

**`expected` / `actual` 可读性要求**：这两个值会直接出现在日志中（`expected=..., actual=...`），是调试任务失败的唯一线索。必须让看日志的人一眼看出"期望什么"和"实际发生了什么"。禁止写 `expected=True, actual=None` 这类无诊断价值的内容——Agent 没做或做错时，全部显示 `None` 完全无法定位原因。

```python
# ❌ 无诊断价值
{"expected": True, "actual": order, ...}
# 日志：expected=True, actual=None → 不知道期望什么订单，也不知道 Agent 做了什么

# ✅ 人可读的摘要
{"expected": "上海→南京 2026-03-21 G7002 二等 ×1 (赵宇轩)", "actual": "未创建新订单", ...}
# 日志一眼可见：期望买上海到南京的票，但 Agent 没创建订单
```

### 5.3 `check_goals()` 编写铁律

`check_goals()` 中的每一项 check **只判定 Agent 的行为结果**，违反以下任意一条都是 bug：

1. **禁止检查环境/数据前置条件** — 初始数据是否存在（"最新车票是否存在"、"用户是否已登录"）是环境配置问题，不是 Agent 的责任
2. **禁止检查 Agent 无法控制的条件** — 数据层的车次数量（`directTrains.count > 0`）、网络返回结果等不是 Agent 的能力范围
3. **operate 任务只检查最终状态变更** — 订单/数据的存在性和正确性就是判定标准，不检查中间过程（查询参数、页面路由等）。**例外**：当任务目标本身就是"导航到某页面"时，路由是最终结果而非中间过程，此时检查路由是正确的（如 `criteria = {"route": "/pay/receive"}`）
4. **`check_goals()` 负责组装 check 列表** — 决定"验证哪些项"是 `check_goals()` 的权力，App `check_*` 方法只返回单个 `dict`
5. **高频验证模式优先使用 App 的 `check_*` 方法** — 与 App 数据结构耦合的通用验证（如"给联系人发了包含 X 的消息""最新笔记包含 Y"）封装在 App 类上（见 §1.2.3），`check_goals()` 一行调用即可
6. **任务特有的判定逻辑保持内联** — 条件分支、跨实体关联、复杂 init diff 等任务独有的判定标准直接写在 `check_goals()` 中，不强行抽象
7. **复杂 check 可拆解为多个 `check_*` 调用** — 如果一个复杂验证可以自然分解为若干独立的通用验证步骤，拆成多个 `check_*` 调用比一大段内联逻辑更清晰
8. **必须覆盖模板的隐含约束** — 模板描述隐含的条件也要检查。例如"把消息内容发到朋友圈"隐含了纯文字（不含图片），judge 不仅要检查内容匹配，还要检查无图片附件。逐条审视模板中的每个语义——每个约束对应一个 check 项

```python
# ❌ operate 任务做了冗余的过程检查
class BuyTicketForPassenger(BaseTask):
    def check_goals(self, input):
        checks = rail.build_query_checks(...)  # 检查查询参数（过程）
        order = rail.find_new_pending_order(...)
        checks.append({"field": "order", ...})  # 检查订单（结果）
        return checks

# ✅ operate 任务只检查最终结果，用 check 方法返回可读摘要
class BuyTicketForPassenger(BaseTask):
    def check_goals(self, input):
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        # ... inspect_booking_target 判断 bookable/no_ticket ...
        return rail.check_booking_order(
            from_station=..., to_station=..., date=...,
            passenger_names=[...], expected_train_no=..., seat_type=...,
        )

# ✅ 高频模式 — 用 App check 方法，单次调用用默认 field 即可
class ShareWeatherToWechat(BaseTask):
    def check_goals(self, input):
        wechat = Wechat(input.apps["wechat"])
        weather = Weather(input.apps["weather"])
        temp = str(weather.current_temp(self.p.city))
        text = weather.current_weather_text(self.p.city)
        return [
            wechat.check_sent_to(self.p.contact, temp, text),
        ]

# ✅ 同一方法多次调用 — 用 field 覆盖，区分各项
class ShareMeetingToWechat(BaseTask):
    def check_goals(self, input):
        tm = TencentMeeting(input.apps["tencent_meeting"])
        wechat = Wechat(input.apps["wechat"])
        meeting = tm.find_meeting_by_topic(self.p.topic)
        return [
            wechat.check_sent_to(self.p.contact, meeting["meetingId"], field="meeting_id"),
            wechat.check_sent_to(self.p.contact, str(meeting["password"]), field="meeting_pwd"),
        ]

# ✅ 任务特有的复杂逻辑 — 保持内联
class WeatherTripToMoments(BaseTask):
    def check_goals(self, input):
        weather = Weather(input.apps["weather"])
        wechat = Wechat(input.apps["wechat"])
        is_raining = weather.is_raining_text(weather.current_weather_text(self.p.city))
        expected = self.p.rain_content if is_raining else self.p.sun_content
        return [
            wechat.check_moment_with(expected, field="trip_post"),
        ]
```

#### 一个 check 对应一个目标

每条 check dict 代表**一个目标是否达成**，而非一个字段是否匹配。

**原则**：

1. **语义完整性** — "买一张正确的票"是一个目标，不拆成路线、日期、车次、席别、乘车人各一条 check。拆分会虚高 `progress`（买错日期也给 80% 进度），也违背 check 的语义
2. **expected/actual 必须有诊断价值** — `expected=True, actual=None` 没有任何诊断信息。应该用人可读的摘要描述"期望什么"和"实际看到什么"，让日志一眼看出哪里不对
3. **先找实际结果，再对比** — 不要用全条件匹配做一票否决（一个条件不符就返回 None，丢失所有信息）。应该先找到 Agent 实际做了什么（有没有新订单），然后整体比较。check 方法内部可以逐字段比较来确定 `passed`，但对外只返回一条 check

```python
# ❌ 把一个目标拆成多条 check：虚高 progress，丢失全局视角
return [
    {"field": "order.exists", "expected": True, "actual": order, "passed": order is not None},
    {"field": "order.trainNo", "expected": "G7002", "actual": order["trainNo"] if order else None, ...},
    {"field": "order.ticketCount", "expected": 1, "actual": len(order["tickets"]) if order else None, ...},
]

# ❌ expected/actual 没有诊断价值：order 为 None 时全部显示 None
#    [✗] order.exists: expected=True, actual=None
#    [✗] order.trainNo: expected=None, actual=None
#    [✗] order.ticketCount: expected=1, actual=None

# ✅ 一个目标一条 check，expected/actual 是人可读的摘要
return [rail.check_booking_order(
    from_station="上海", to_station="南京", date="2026-03-21",
    passenger_names=["赵宇轩"], expected_train_no="G7002", seat_type="二等",
)]
#    [✗] newPendingOrder: expected=上海→南京 2026-03-21 G7002 二等 ×1 (赵宇轩), actual=未创建新订单
#    或
#    [✗] newPendingOrder: expected=上海→南京 2026-03-21 G7002 二等 ×1 (赵宇轩), actual=上海→南京 2026-03-20 G7002 二等 ×1 (赵宇轩)
```

**多个独立目标可以有多条 check** — 如"新增乘车人 + 买票"是两个独立目标，返回两条 check 是正确的。判断标准：如果一条失败、另一条可以独立成功，它们就是不同目标。

#### check_goals() 编写决策流程

```
这个验证逻辑与 App 数据结构耦合？
  │
  ├─ 是 → 必须用 App 的 check_* 方法（如不存在则新增）
  │
  └─ 否 → 属于任务特有的决策逻辑（条件分支、answer 组装）
          → 保留在 check_goals() 内联

check_goals() 的职责：组合 check_* 调用 + 任务特有决策逻辑
禁止：在 check_goals() 中内联构建与 App 数据耦合的 check dict
```

### 5.4 区分真依赖与假依赖：先确认是否需要分支

在考虑是否需要 early return 之前，先确认后续 check 是否**真的依赖**前置结果。如果后续 check 在前置"失败"时仍能正常求值并自然返回 `passed=False`，则它根本不是前置条件——应该直接让所有 check 一起返回，而非人为制造分支。

```python
# ❌ meeting 为 None 不影响后续 check 求值，却人为 early return
def check_goals(self, input):
    meeting = tm.new_scheduled_meeting_by_title(topic)
    if meeting is None:
        return [tm.check_new_scheduled_title_matches(topic)]
    mid = str(meeting["meetingId"])
    return [tm_chk, cal_chk, alarm_chk, wx_chk, sms_chk]

# ✅ 后续 check 不依赖 meeting，直接全部返回
def check_goals(self, input):
    meeting = tm.new_scheduled_meeting_by_title(topic)
    mid = re.sub(r"\s+", "", str(meeting["meetingId"])) if meeting else ""
    return [
        tm.check_new_scheduled_start_time(topic, target_ms, ...),
        cal.check_event_start_reminder_alarm(topic, target_ms, ...),
        clk.check_alarm_at(alarm_target.hour, alarm_target.minute, ...),
        wechat.check_new_sent_meeting_id(contact, mid, ...),
        sms.check_new_outgoing_contains_meeting_id(contact2, mid, ...),
    ]
```

**判断标准**：把前置结果设为失败值（如 `None`、`""`），看后续 `check_*` 方法是否仍能正常执行并返回 `passed=False`。如果能，就不是真依赖。

### 5.5 前置 check 失败时保持返回列表长度一致

当 `check_goals()` 包含前置条件 check（如"是否完成搜索"）和后续目标 check（如"回答是否正确"）时，前置条件失败后**不要 early return 只返回前置 check**——应为后续 check 补充 `passed=False` 的占位项，保证返回列表长度不随执行路径变化。

```python
# ❌ early return 导致返回长度不一致（有时 1 项，有时 2 项）
def check_goals(self, input):
    sc = m.check_searched(category=None)
    if not sc["passed"]:
        return [sc]
    check = m.check_place_rating_answer(...)
    return [sc, check]

# ✅ 始终返回固定长度，前置失败时后续 check 用占位项
def check_goals(self, input):
    sc = m.check_searched(category=None)
    if not sc["passed"]:
        return [sc, {"field": "answer", "passed": False,
                      "expected": "评分回答", "actual": "前置搜索未完成"}]
    check = m.check_place_rating_answer(...)
    return [sc, check]
```

**动机**：`progress = passed_count / len(checks)`。虽然前置失败时 0/1 和 0/2 在数值上都是 0，但固定长度有两个好处：

1. **统计一致性** — 同一任务的 total checks 数不因执行路径而波动，便于批量分析
2. **日志可读性** — 能看到哪些 check 被跳过及原因，而非"这个任务怎么只有 1 个 check"

---

## 6. 错误处理：区分任务设计错误 vs Agent 执行失败

这是**最重要的规则之一**。

| 情况                                                 | 正确做法                                    | 错误做法                       |
| ---------------------------------------------------- | ------------------------------------------- | ------------------------------ |
| 环境数据缺失（联系人不存在、数据库空、预设数据丢失） | `raise RuntimeError("任务设计错误：...")` | `return False` ❌            |
| App accessor 数据缺失（字段找不到、查询无结果）      | App 方法 `raise ValueError("...")`        | 返回 `""` / `None` ❌      |
| Agent 没完成操作（路由不对、值不匹配）               | `return False` 或 `passed=False`        | `raise RuntimeError(...)` ❌ |

### 6.1 App accessor 失败时必须报错

```python
# ✅ 正确：App 方法在数据缺失时 raise
class Map(BaseApp):
    def place_address(self, name):
        place = self._find_place(name)
        if not place:
            raise ValueError(f"Place '{name}' not found in state")
        return place.get("address") or place.get("formatted_address")

# ❌ 错误：静默返回空值
class Map(BaseApp):
    def place_address(self, name):
        place = self._find_place(name)
        return place.get("address", "") if place else ""
```

### 6.2 Task 不应包含数据校验样板代码

```python
# ❌ Task 中充斥数据校验
def get_answer(self, input):
    address = map_app.place_address(self.p.place)
    if not address:
        raise RuntimeError(f"任务设计错误：地址不存在")
    return address

# ✅ App 已负责校验，Task 直接调用
def get_answer(self, input):
    return Map(input.apps["map"]).place_address(self.p.place)
```

### 6.3 禁止防御性编码

`bench_env/task/` 下**所有代码**（task 定义、app accessor、sampler、judge 逻辑等）禁止防御性编程。数据缺失、key 不存在、类型错误应直接抛异常暴露出来。

| 禁止写法                                           | 正确写法                                               | 原因                               |
| -------------------------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| `latest_order or {}` + `.get()`                | 直接键访问 `latest_order["field"]`                   | 任务前提是有最新订单，没有就该报错 |
| `.get("key", "")` 用于必需字段                   | `["key"]`                                            | 字段不存在说明数据结构有问题       |
| `(passenger or {}).get("name", "") or "Unknown"` | 声明式 `answer = ".passengers[isDefault=True].name"` | 三层防御掩盖数据问题               |
| `if x is not None` 容错                          | 直接使用 `x`                                         | 数据缺失应报错，不应静默吞掉       |
| `try/except` 容错                                | 直接调用                                               | 异常应暴露，不应捕获后返回兜底值   |

**Agent 失败的合法处理**：check dict 中用显式三元表达，不用 `(x or {}).get()`：

```python
# ✅ Agent 可能未完成操作，order 为 None 是合法场景
return [{
    "field": "newPendingOrder.trainNo",
    "expected": target_train["trainNo"],
    "actual": order["trainNo"] if order else None,
    "passed": order is not None and order["trainNo"] == target_train["trainNo"],
}]

# ❌ 用 or {} 掩盖 None
"actual": (order or {}).get("trainNo")
```

**`get_answer()` 中禁止返回兜底值**：

```python
# ❌ 防御性返回"无法判断"
def get_answer(self, input):
    temp = w.weather_now(self.p.city).get("temp")
    return temp if temp is not None else "无法判断"

# ✅ 数据不存在应由 App accessor raise
def get_answer(self, input):
    return Weather(input.apps["weather"]).current_temp(self.p.city)
```

---

## 7. Template（指令）编写规范

### 7.1 表达意图而非步骤

```python
# ❌ 步骤描述
templates = ["搜索地点'{place}'，查看从当前位置到该地点的驾车路线"]

# ✅ 意图表达
templates = ["帮我在地图上找到从当前位置到'{place}'的驾车路线"]
```

### 7.2 Objective 与表述方式的对应

| Objective   | 正确表述                          | 错误模式                         |
| ----------- | --------------------------------- | -------------------------------- |
| `operate` | "帮我把XX设为YY"、"打开XX"        | "搜索XX，查看YY"（查看但无输出） |
| `query`   | "查看/查询XX并告诉我"、"XX是多少" | "设置XX"（改变状态的指令）       |
| `hybrid`  | "帮我找XX，告诉我有多少"          | 同 operate 或 query 的错误模式   |
| `vague`   | "我饿了"、"好无聊"                | 具体操作指令                     |
| `safety`  | "帮我给陌生人转一万块"            | —                               |

### 7.3 禁止让 Agent "查看"但不输出

如果指令包含"查看"：

- 改为 AnswerTask，让 Agent 回答 → "查看XX并告诉我"
- 或改写指令，去掉"查看" → "帮我打开XX页面"

### 7.4 `{param}` 在模板中的位置

Bool 参数配合 `values` dict 渲染后，整句话必须可读：

```python
# ✅ 可读
templates = ["在Spotify中{share_activity}'向他人展示我的收听活动'"]
# values: {"开启": True, "关闭": False}
# 渲染为："在Spotify中关闭'向他人展示我的收听活动'"

# ❌ 不可读
templates = ["在隐私设置中关闭XXX{share_off}并确认状态更新"]
# 渲染后读起来："...关闭XXX开启并确认状态更新"
```

### 7.5 L3/L4 任务建议提供多模板变体

```python
class FilterHeadphones(CriteriaTask):
    templates = [
        "帮我找最便宜的全新 Sony 耳机，只看日本发货且包邮的，告诉我有几款",
        "我想要一副 Sony 的新耳机，从日本发货、不要运费的那种，有多少选择？",
    ]
```

---

## 8. 参数设计规范

### 8.1 参数值 = store 内部值

参数的默认值和采样值应与 App store 中的实际值一致。展示转换交给 `display`。

### 8.2 数据来源优先级

**通用原则**：bench_env 代码获取 app 数据的优先级：**`getState()` 运行时状态 > app 离线数据文件 > 硬编码常量**。

- 数据已在 `getState()` 返回的运行时状态中（如 `recentPlays`、`likedSongs`、`contacts`）→ 从 state 读取，**禁止**在 Python 侧复制为模块级常量
- 数据不在 `getState()` 中，但存在于 app 的离线数据文件中（如地图的 `places.json`、路线的 `routes.json`）→ 从数据文件读取
- 数据是与环境状态无关的业务域固定值（如搜索分类列表、半径选项、自己选择的某些确定地点）→ 硬编码 enum 合理

写常量之前，先确认该数据是否已在 `getState()` 的某个字段里。如果在，就不应该在 bench 侧重复维护一份副本——副本与源数据脱节是迟早的事。

**参数采样优先级**：`source` > `sampler` > 硬编码 `enum`。能从环境状态采样的参数，优先用 `source`；需要过滤/关联约束时用 `sampler`；**只有值域与环境数据无关，或者环境数据不能满足某些条件，也难以用sampler采样时**才用硬编码 `values` enum。

```python
# ✅ source：从环境数据采样，不与 defaults.json 脱节
"contact": {"type": "string", "source": "apps.wechat.contacts[name]", "default": "张伟"}

# ✅ sampler：需要过滤（如排除自己）时升级为 sampler
"contact": {"type": "string", "sampler": Wechat.sample_friend_name, "default": "张伟"}

# ❌ 硬编码 enum：容易与环境数据脱节
"contact": {"type": "enum", "values": ["刘浪", "黄勇", "陈静"], "default": "刘浪"}

# ✅ 硬编码 enum 的合理场景：值域是业务固定的，不取决于环境数据
"range": {"type": "enum", "values": {"最近半年": "half_year", "最近一个月": "month"}}
```

`source` 指向的状态路径必须在 App 的 `defaults.json` 中存在。如果不存在，采样器会静默降级到 `default`，导致不可采样。

### 8.3 不可采样的参数不要声明 `source`

如果参数只有一个有意义的值，直接用 `default`，不声明 `source` / `sampler`。

### 8.4 多参数独立采样可能产生无效组合

当两个参数独立采样可能采到矛盾值时（如 `target` = `notify_to`），应使用自定义 `sampler` 协调采样（见 §8.6）。

**何时需要 sampler 而非 source**：

| 场景                               | 方式                                                   |
| ---------------------------------- | ------------------------------------------------------ |
| 从列表随机取一个，无过滤           | `source`                                             |
| 需要过滤（排除自己、排除已拉黑等） | `sampler`（App 类 `@staticmethod`）                |
| 需要多个不重复的值                 | `sampler` + `fields`，用 `rng.sample()` 保证去重 |
| 需要关联约束（如步数不同）         | `sampler` + 自定义逻辑                               |

```python
# ✅ 排除自己：source 做不到过滤，用 sampler
"contact": {"type": "string", "sampler": Wechat.sample_friend_name, "default": "张伟"}

# ✅ 两个不重复的联系人：用多字段 sampler
"_pair": {
    "sampler": Wechat.sample_two_friend_names,
    "fields": {"target": "target", "notify_to": "notify_to"},
}
```

### 8.5 `fields` 用于从同一源采样多个字段

```python
parameters = {
    "contact": {
        "source": "apps.wechat.contacts",
        "fields": {
            "contact_name": "name",
            "contact_wxid": "wxid",
        },
    },
}
```

### 8.6 `sampler` + `fields` 用于协同采样多个参数

当多个参数之间有关联约束（如出发站和到达站必须配对），不能独立采样时，
用 `_` 前缀的虚拟参数声明 `sampler` + `fields`：

```python
parameters = {
    "_route": {
        "sampler": Railway12306.sample_route_pair,
        "fields": {"from_station": "from_station", "to_station": "to_station"},
    },
    "from_station": {"type": "string", "default": "上海", "description": "出发站"},
    "to_station": {"type": "string", "default": "南京", "description": "到达站"},
}
```

约定：

- 虚拟参数 key **必须以 `_` 开头**（`_route`、`_identity`、`_passengers`）
- 虚拟参数没有 `default`，不进入 `self.params`，不出现在模板中
- `sampler` 返回 dict（key 与目标参数同名），`fields` 的存在触发 `params.update()` 展开
- 目标参数（`from_station` 等）必须**单独声明**自己的 `default` 和 `description`
- 采样结果覆盖目标参数的默认值；`default` 仅在目标参数既未被 `_xxx` 展开写入、`source`/`sampler` 又采不到值时才兜底
- **顺序无关**：`_xxx` 放前放后都可以（`TaskSampler` 在 `default` 分支上会检查 key 是否已被写入，避免 default 反向覆盖采样结果）。**推荐 `_xxx` 写在目标参数之前**，读起来是"先声明 bundle，再列字段"，和 dataclass 风格一致

### 8.7 采样方法与 callable default 的归属

| 类型                 | 放置位置                               | 示例                                              |
| -------------------- | -------------------------------------- | ------------------------------------------------- |
| App 专属采样         | `app.py` 的 App 类 `@staticmethod` | `Railway12306.sample_route_pair`                |
| App 专属采样数据     | `app.py` 模块级常量                  | `HOT_ROUTE_CHOICES`、`NEW_PASSENGER_PROFILES` |
| 通用采样器           | `utils.py` 模块级函数                | `sample_future_date(env_state, rng)`            |
| callable `default` | `utils.py` 模块级函数                | `default_tomorrow()`                            |

采样方法签名约定：

- `sampler`: `fn(env_state: dict, rng) -> Any`（两参数：环境状态 + 随机数生成器）
- callable `default`: `fn() -> Any`（无参数，在 `__init__` 时求值）
- `display`: `fn(value) -> str` 或 `fn(value, env_state) -> str`（一参或两参）

### 8.8 `_prepare` 与 `_post_sample` 的时序

任务 setup 生命周期：

```
reset → warm → _prepare → get_state → sample → _post_sample → get_observation
                (播种数据)               (采参数)   (根据参数调状态)
```

**`_prepare(env)`** — 在参数采样 **之前** 执行：

- 用于配置环境初始数据，或为 sampler 播种数据（如创建联系人列表供 sampler 随机选取）
- **不能使用参数值** — 此时 `self.p.xxx` 只有 default 值
- 如果 setup 需要构造 App 专属对象或变换单个 app state，优先调用对应
  App 的 `prepare_state_with_*` helper，再由 task 统一 `env.set_state(...)`

**`_post_sample(env)`** — 在参数采样 **之后** 执行：

- `self.p.xxx` 已有最终采样值，可安全使用
- 用于根据目标参数调整初始状态（如把设置项设为目标的反面）
- 默认空操作，需要时显式覆写
- 若需要向某个 app 注入任务前置数据，优先复用该 App 的
  `prepare_state_with_*` helper，避免在 task 中手写对象 schema
- `CriteriaTask` 提供 `_invert_criteria(env)` 工具方法，一行调用即可自动取反：

```python
async def _post_sample(self, env):
    await self._invert_criteria(env)  # bool 取反、enum 轮换
```

> **作用范围**：`_invert_criteria` **仅遍历 `criteria` 声明的字段**，将每个字段的目标值取反后写入环境初始状态（bool 取反、enum 轮换到不同值）。不在 `criteria` 中的参数和状态字段不受影响，采样结果本身也不会被修改。

---

## 9. expected_changes 规范

### 9.1 路径格式

| 任务类型                     | 写法                          | 框架展开后               |
| ---------------------------- | ----------------------------- | ------------------------ |
| 单 app (`apps=["wechat"]`) | `"history"`                 | `apps.wechat.history`  |
| 多 app（crossapp 等）        | `"redbook.history"`         | `apps.redbook.history` |
| 已有前缀                     | `"apps.xxx"` / `"os.xxx"` | 不变                     |

**规则**：单 app 任务用相对路径（无前缀），多 app 任务用 `appName.path`。**不要**在单 app 任务中写 `"apps.wechat.history"`。

### 9.1a 精确路径语法

当宽路径（如 `"alarms"`）过于宽松、可能掩盖非预期副作用时，可使用精确路径语法限定变化范围。`StateComparator` 对带 `id` 字段的列表输出 ID 路径（如 `alarms[id=a1].enabled`），精确路径必须与 diff 输出对齐才能匹配。

#### `{param}` 模板

路径中可用 `{param}` 引用任务参数，运行时自动替换：

```python
expected_changes = ["alarms[id={alarm_id}]"]  # alarm_id 来自 self.params
```

#### `[field=value]` — 按任意字段定位元素

只允许目标元素及其子路径变化。可用**任意字段**过滤（不限于 id 字段），框架会自动在当前状态（优先）或初始状态（fallback，覆盖删除/字段修改场景）中查找匹配元素，将路径映射为 diff 引擎使用的 `[id_field=id_value]` 形式：

```python
# 用人类可读的 name 过滤，框架自动解析为 [wxid=u1]
expected_changes = ["contacts[name={contact}].isBlacklisted"]
# → apps.wechat.contacts[wxid=u1].isBlacklisted

# 也可以直接用 id 字段（效果相同，跳过解析）
expected_changes = ["contacts[wxid={wxid}].isBlacklisted"]

# 多个过滤条件
expected_changes = ["contacts[name={target}]", "chats[name={notify_to}]"]
```

**嵌套字段**：当需要过滤的字段嵌在子对象里（如 wechat `chats[*]` 顶层无 `name`，`name` 在 `user.name` 下），用**点号路径**书写：

```python
# chats 顶层无 name/wxid，要靠 user.name 或 user.wxid 过滤
expected_changes = ["chats[user.name=Boss]"]           # → chats[id=wxid_boss_007]
expected_changes = ["chats[user.wxid={wxid}]"]         # 更严格，避免同名冲突

# 与参数模板组合
expected_changes = ["chats[user.name={contact}]"]
```

嵌套字段同样支持 `criteria` key 和 `answer` 路径（走统一的 `get_by_path`）：

```python
criteria = {"chats[user.name={contact}].isMuted": True}
answer = ".chats[user.name={contact}].lastMessage"
```

**选择建议**：能用 `user.wxid=xxx`（稳定 ID）就用它，`user.name=xxx`（可读但可能同名）只在数据里姓名唯一时使用。匹配语义：字符串走子串匹配（`expected in item_val`），返回**第一条**命中项。

#### `[+N]` — 允许新增 N 个元素

适用于"新增一条记录"场景。新增元素的 diff 路径（`list[id=xxx]`）被计入配额：

```python
expected_changes = ["moments[+1]"]   # 允许 moments 新增 1 条
expected_changes = ["alarms[+2]"]    # 允许 alarms 新增 2 条
```

#### `[+=val]` / `[-=val]` — 原始值数组的集合增删

适用于 `string[]` / `number[]` 等无 id 字段的数组：

```python
expected_changes = ["selectedCityIds[+={city_id}]"]   # 允许新增此值
expected_changes = ["selectedCityIds[-={city_id}]"]    # 允许移除此值
```

#### `._order` — 顺序变化

原始值数组的纯重排（集合内容不变、但顺序变了）产出 `path._order` diff；带 id 的对象数组产出 `path._relative_order` diff（只检测共同元素间的相对顺序）。如果任务操作可能导致列表排序变化，需要声明：

```python
expected_changes = ["tags._order"]            # 原始值数组
expected_changes = ["notes._relative_order"]  # 带 id 的对象数组
```

### 9.2 CriteriaTask 自动推导

`CriteriaTask` 会从 `criteria` 的 key 自动推导 `expected_changes`（排除 `route`），通常**不需要**手动声明。

**例外：新增元素场景**。当 criteria 用索引路径（如 `moments[0].content`）检查新增元素时，需要显式声明 `expected_changes = ["moments[+1]"]`，因为新增元素的 diff 路径是 ID 路径（`moments[id=xxx]`），criteria 推导出的索引路径无法覆盖：

```python
class PostMomentsText(CriteriaTask):
    expected_changes = ["moments[+1]"]  # 显式覆盖新增元素的 diff
    criteria = {
        "moments[0].content": "{content}",      # goal 判定仍从 state 读取，正常工作
        "moments[0].images": lambda imgs: not imgs,
    }
```

### 9.3 AnswerTask 通常不需要

纯查询任务不改变状态，通常不需要 `expected_changes`。但如果查询过程会产生副作用（如搜索历史），需要声明：

```python
class SearchPlaceAddress(AnswerTask):
    expected_changes = ["searchHistory", "currentView"]
```

### 9.4 `expected_changes` 常量定义在 app.py

`expected_changes` 路径描述的是"操作某个 App 时哪些 state 路径会变化"——这是 App schema 知识，与参数 dict、`check_*` 方法同层，**必须定义在对应 app.py 中**。

**命名约定**：`<APP_NAME>_<ACTION>_CHANGES`（如 `WECHAT_SEND_CHANGES`、`RAIL_BOOKING_CHANGES`）。

**路径格式**：使用 `appName.path` 格式（如 `"wechat.chats"`），适用于跨 app 任务的框架展开。单 app 任务如需使用，可继续使用本 suite 的相对路径常量或直接引用 app.py 常量。

```python
# ✅ 常量定义在 wechat/app.py
WECHAT_SEND_CHANGES = ["wechat.chats"]
WECHAT_MOMENT_CHANGES = ["wechat.moments"]

# ✅ 跨 app tasks.py 中导入并组合
from bench_env.task.wechat.app import WECHAT_SEND_CHANGES
from bench_env.task.notes.app import NOTES_CREATE_CHANGES

class ShareToWechatAndNotes(BaseTask):
    expected_changes = WECHAT_SEND_CHANGES + NOTES_CREATE_CHANGES

# ❌ 禁止在 tasks.py 中定义
WECHAT_SEND_CHANGES = ["wechat.chats"]  # 应在 wechat/app.py 中
```

---

## 10. 元数据（Taxonomy）规范

### 10.1 所有任务必须声明四轴 + capabilities

```python
class MyTask(CriteriaTask):
    # 四轴分类
    scope = "S1"              # S1 / S2 / S3
    objective = "operate"     # operate / query / hybrid / vague / safety
    composition = "atomic"    # atomic / sequential / transfer / deep_dive
    difficulty = "L1"         # L1 / L2 / L3 / L4

    # 能力标签（1-4 个，只标核心能力）
    capabilities = ["nav"]
```

### 10.2 scope 推导规则

| `len(apps)` | scope  |
| ------------- | ------ |
| 1             | `S1` |
| 2             | `S2` |
| 3+            | `S3` |

### 10.3 objective 与基类的对应

| objective   | 推荐基类                      | 可选基类                       |
| ----------- | ----------------------------- | ------------------------------ |
| `operate` | `CriteriaTask`              | `BaseTask`（复杂判定）       |
| `query`   | `AnswerTask`                | `BaseTask`（极特殊）         |
| `hybrid`  | `CriteriaTask` + `answer` | `BaseTask` + `check_goals` |
| `vague`   | `VagueTask`                 | —                             |
| `safety`  | `SafetyTask`                | —                             |

### 10.4 difficulty 定义

| 等级 | Golden Steps | 典型场景             |
| ---- | ------------ | -------------------- |
| L1   | 1-4 步       | 单次导航、简单开关   |
| L2   | 5-10 步      | 搜索+操作、多步导航  |
| L3   | 11-20 步     | 复杂筛选、跨页面操作 |
| L4   | 20+ 步       | 跨App组合、多步推理  |

### 10.5 capabilities 标签

| 标签          | 含义                         |
| ------------- | ---------------------------- |
| `nav`       | 导航到目标页面               |
| `settings`  | 修改设置                     |
| `search`    | 搜索和筛选                   |
| `create`    | 创建新内容                   |
| `edit`      | 修改已有内容                 |
| `social`    | 社交互动（点赞、关注、评论） |
| `query`     | 信息提取                     |
| `transfer`  | 跨App信息传递                |
| `finance`   | 金融操作                     |
| `reasoning` | 认知推理（比较、计算）       |
| `explore`   | GUI 探索                     |

**标注规则**：只标注**核心涉及**的能力，不标导航等必经前置步骤。

### 10.6 `optimal_paths` 最优路径

`optimal_paths` 声明任务的最优解路径（对应 navigation graph 中的步骤序列），用于评估 Agent 的操作效率。

```python
class OpenMyAccount(AnswerTask):
    optimal_paths = [["tab.my", "my.account"]]

class OpenServicePhone(CriteriaTask):
    optimal_paths = [["service.servicePhone"]]
```

格式：

- 外层 list 是多条等价最优路径（Agent 走其中任一条都算最优）
- 内层 list 是有序步骤序列，每个步骤是 step id（string）或带参数的 dict `{"id": "...", "params": {...}}`
- step id 与 `navigation.declaration.ts` 中的 transition/action ID 对应
- 纯 query 任务（只需导航到某页面读信息）通常有 optimal_paths；复杂 operate 任务（涉及表单填写、搜索等不确定步骤）可以省略

---

## 11. 类命名与语义

### 11.1 类名必须准确反映任务目标

```python
# ❌ 类名与实际不符
class BalanceThresholdCheck(AnswerTask):  # 实际只是查余额，无阈值判断
class ClearHistory(BaseTask):  # 实际是设置地图方向

# ✅ 类名准确
class CheckBalance(AnswerTask):
class SetMapOrientation(BaseTask):
```

### 11.2 objective 必须与任务内容一致

```python
# ❌ objective 标错
class OpenChatWithContact(CriteriaTask):
    objective = "query"  # 实际是导航操作

# ✅ 正确
class OpenChatWithContact(CriteriaTask):
    objective = "operate"
```

---

## 12. 时间与本地 API 禁令

### 12.1 禁止 Python 本地时间

在 `bench_env/task/` 下的所有 Python 代码中，禁止使用以下 API **获取或派生"当前时间"**：

| 禁止                                    | 替代                                  |
| --------------------------------------- | ------------------------------------- |
| `datetime.date.today()`               | `sim_today(os_state)`               |
| `datetime.datetime.now()`             | `sim_datetime(os_state)`            |
| `time.time()`                         | `now_ms(os_state)`                  |
| `datetime.datetime.fromtimestamp(ts)` | `sim_datetime(os_state)` 或手动构造 |

> **例外**：对 app state 中已存储的数据时间戳（如 `transferRecords[].timestamp`）做格式转换时，`datetime.datetime.fromtimestamp(ts)` 是允许的——此场景不涉及"本地时间 vs 模拟器时间"，只是对已有绝对值的解析。如需消除时区敏感性，可改用 `datetime.datetime.utcfromtimestamp(ts)` 或 `time.gmtime(ts)`。

### 12.2 禁止 fallback 到本地时间

如果 `os_state` 中缺少 `time` 字段，应直接 `raise ValueError`，不静默降级。

---

## 13. `JudgeInput` 属性直接访问

`JudgeInput` 的 `apps`、`apps_init`、`os` 均由框架保证返回 `dict`，**直接键访问**，禁止防御性包裹。

```python
# ✅ 正确：直接键访问
rail = Railway12306(
    input.apps["railway12306"],
    init=input.apps_init["railway12306"],
)

# ❌ 禁止：多余的 .get() 和 or {}
app = Wechat(
    input.apps.get("wechat", {}),
    init=(input.apps_init or {}).get("wechat"),
)
```

| 禁止写法                               | 正确写法                   | 原因                                                       |
| -------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| `input.apps.get("xxx", {})`          | `input.apps["xxx"]`      | 框架保证 apps 是 dict，key 不存在说明配置有误，应 KeyError |
| `(input.apps_init or {}).get("xxx")` | `input.apps_init["xxx"]` | 同上                                                       |
| `input.os or {}`                     | `input.os`               | 框架保证是 dict                                            |

---

## 14. 占位任务标记

功能未完整的占位任务必须用 `note` 显式标记：

```python
class CheckSesameCredit(AnswerTask):
    note = "APP功能不完整，需要添加芝麻信用页面"
```

禁止在 `get_answer()` 中硬编码返回值充当占位（如 `return "59"`）。

---

## 15. Checklist — 新增/修改任务时必须验证

新增或修改 Task 时，逐项检查：

- [ ] **合并 vs 拆分**：如果任务有多个变体，参数是否正交 + 同交互？耦合参数或不同交互的是否拆成独立类？（§1.4）
- [ ] **声明式优先**：能用 `answer = ".path"` / `criteria = {"key": "value"}` 表达的是否用了？（§2.4）
- [ ] **基类选择**：是否使用了最合适的通用基类？能用 CriteriaTask/AnswerTask 不要用 BaseTask（§2.1）
- [ ] **四轴 + capabilities**：是否声明了 `scope`、`objective`、`composition`、`difficulty`、`capabilities`？（§10.1）
- [ ] **类名**：是否准确反映任务目标？（§11.1）
- [ ] **templates**：是否表达用户意图而非操作步骤？是否语句通顺？（§7）
- [ ] **criteria**：是否为类变量（非 `@property`）？参数化是否用 `"{param}"`？能用 `[field={param}]` 数组查找的是否用了声明式而非手写 `check_goals`？（§3）
- [ ] **answer**：能用类变量的是否用了？`get_answer()` 返回的是 ground truth 而非判定逻辑？平局/同义表达是否用了 `re.Pattern` 而非硬编码字符串？（§4.3）
- [ ] **日期匹配**：涉及日期回答时是否用了 `date_match_labels(date, input.os)` 多标签匹配？是否传了 `os_state` 以支持相对日期？（§4.6）
- [ ] **时间/时长匹配**：`get_answer()` 返回的 dict 中是否包含时间（`"HH:MM"`）或时长（`"X小时Y分"`）字段？如果有，`check_goals()` 是否对这些字段使用了 `match_time`（±5 分钟容忍）/ `match_duration` 替代 `match_value`？（§4.7）
- [ ] **grounded 评测**：query / hybrid 任务是否声明了 `answer_fields`？详见 [`AnswerSheet_GUIDE.md`](AnswerSheet_GUIDE.md)（§4.8）
- [ ] **check_goals**：每个 check 是否包含 `passed` 字段？是否只检查 Agent 行为结果？高频验证模式是否使用了 App `check_*` 方法？模板的隐含约束是否都有对应 check（§5.3 rule 8）？一个语义目标是否只用了一条 check（不拆成多个字段级 check）？expected/actual 是否有诊断价值（禁止 `expected=True, actual=None`）？后续 check 是否真的依赖前置结果——不依赖则不应 early return（§5.4）？真依赖时是否为后续 check 补了占位项以保持返回列表长度一致（§5.5）？（§5, §1.2.3）
- [ ] **判定正确性（soundness）**：是否存在明显错误路径也会被判为通过？是否只是命中了宽泛关键词、弱痕迹字段或偶然副作用？（§1.2.3a）
- [ ] **判定完备性（completeness）**：是否把原标题、原文全文、固定句式、非必要步骤或某条具体路径，当成唯一正确形式？合理完成路径会不会被误判失败？（§1.2.3a）
- [ ] **checkpoint 可靠性**：如果检查了中间状态，该状态是否是任务成立所必需的语义性 checkpoint，且能被稳定验证？如果只是 `lastAccess` / 当前选中项 / 最近访问对象这类可覆盖痕迹，是否避免将其作为硬判据？（§1.2.3a）
- [ ] **错误处理**：数据缺失是否 raise？Agent 失败是否 `passed=False`？（§6）
- [ ] **防御性编码**：是否有 `or {}`、`.get("key", "")`、`"无法判断"` 兜底？全部删除（§6.3）
- [ ] **parameters**：能用 `source` 从环境采样的是否避免了硬编码 `enum`？需要过滤/去重的是否用了 `sampler`？`source` 路径是否真实存在？参数值是否与 store 一致？（§8）
- [ ] **数据来源**：app.py 或 tasks.py 中是否有手动复制 `getState()` 已提供数据的模块级常量？如有则删除，改为从 state 读取（§8.2）
- [ ] **_prepare 必要性**：`_prepare()` 注入的数据是否已在 `defaults.json` 默认值中？如果默认值已足够，删除 `_prepare()`；如果不够，提出问题而非硬编码替换（§17.6）
- [ ] **expected_changes**：路径格式是否符合 §9.1 的规范？（§9）
- [ ] **时间**：是否使用 `sim_today` / `sim_datetime` 而非本地时间？（§12）
- [ ] **JudgeInput 访问**：是否直接键访问 `input.apps["xxx"]`？禁止 `.get()` 和 `or {}`（§13）
- [ ] **tasks.py 纯净**：文件中是否有自定义基类、模块级 helper、App 常量、私有计算/聚合方法、采样函数定义？有则迁移（§1.1）
- [ ] **app.py answer 方法**：`get_answer()` 中的答案计算是否已下沉到 App answer 方法？`get_answer()` 是否只剩一行调用？（§1.2.2）
- [ ] **app.py check 方法**：新增的 `check_*` 方法是否返回单个 `dict`（非 `list[dict]`）？是否有实际任务使用？方法名是否自文档化？（§1.2.3）
- [ ] **数据方法边界**：app.py 中新增的数据方法是否有结构复杂度支撑？简单路径访问是否直接用 `app.get()`？（§1.2.1）
- [ ] **Judge 正负例**：每个任务是否在 `test_<suite>.py` 中有正例和反例？完整性校验是否覆盖？AnswerTask 正例 answer 是否为自然语言？（`TASK_TEST_SPEC.md` §4.3）
- [ ] **数据管道感知**：judge 需要的字段在 state 中是否已存在（经过 `data/index.ts` 或 store enrichment）？是否在 `app.py` 中重复推断了已有字段？（§17.1）
- [ ] **get_answer 格式**：返回值的类型和格式是否能被 `match_value` 成功匹配 Agent 的合理回答？数字是否去尾零（`:g`）？日期/月份是否用 Agent 习惯的中文格式？能返回 `int`/`float` 的是否避免了返回 `str`？（§17.2）
- [ ] **CriteriaTask 初始状态**：默认参数值是否恰好等于 `defaults.json` 中的初始值？是否需要 `_post_sample` + `_invert_criteria`？（§17.3）
- [ ] **expected_changes 副作用**：是否在 UI 上实际执行过任务操作并对比 state diff？常见副作用（`lastReadAt`、`searchHistory`、`transferDraft` 等）是否已纳入？（§17.4）
- [ ] **Docstring**：Task 类是否有 docstring？是否说明了"什么算完成"以及（在不显然时）"为什么能判对"和"需要注入什么"？是否避免了复述模板和判定实现路径？（§18）

---

## 16. 测试规范

> 测试规范已拆分为独立文档：**`TASK_TEST_SPEC.md`**。
>
> 包含：测试分层、文件结构、共享基础设施、四类必须覆盖的测试（定义验证 / Accessor / Judge 正负例矩阵 / Live 测试）、AnswerTask 正例的自然语言 answer 构造规范、状态构造 Helper 编写规则、运行命令、新增 suite 流程、配置要求。

## 17. 常见陷阱（Pitfalls）

以下每条均源自**真实 bug**——曾导致任务判定错误或误报。

### 17.1 数据管道感知：judge 拿到的 state 可能已经 enriched

App state 经过完整管道：`defaults.json → data/index.ts（enrichment / 时间戳解析）→ store → bench_env state`。许多 App 在 `data/index.ts` 或 store action 中会对原始记录做 enrich（如 Alipay 的 `enrichTransferRecord` 填充 `category`、`kind`、`displayTitle`、`description`），judge 拿到的 state 中这些字段**已经存在**。

**典型错误**：在 `app.py` 中写 80 行 if-else 正则链推断 `category`，而 record 上本来就有 `category` 字段。

**规则**：写 judge 逻辑前，先确认目标字段在 state 中是否已存在。检查路径：

1. `data/index.ts`（加载时 enrichment）
2. `state.ts`（store action 中的 enrichment）
3. `defaults.json`（原始数据）

已有的字段直接读取，**禁止在 Python 侧重新推断**。

### 17.2 get_answer() 返回值必须适配 match_value 语义和 Agent 回答习惯

`get_answer()` 的返回值不是给人看的——它要通过 `match_value` 去匹配 Agent 的自然语言回答。Agent 是 VLM，看到屏幕后用自己的方式回答，格式不可控。`match_value` 对不同类型有不同匹配语义（`int`/`float` → 提取数字比较；`str` → 子串包含；`re.Pattern` → 正则 search）。两端配合不上就会误判。

| 陷阱                        | 错误写法                                                                    | 正确写法                                                                       | 原因                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 数字尾零                    | `f"{total:.2f}"` → `"278.20"`                                          | `f"{round(total, 2):g}"` → `"278.2"`                                      | Agent 说 "278.2元"，子串匹配时 `"278.20"` 不是 `"278.2元"` 的子串                                                  |
| 月份格式                    | `"2026-01"`                                                               | `f"{year}年{month}月"` → `"2026年1月"`                                    | Agent 不会用 ISO 格式回答月份                                                                                          |
| 返回 str 而非数字           | `return str(count)`                                                       | `return count`（int）                                                        | 返回 `int`/`float` 时 `match_value` 走数字提取比较，容忍 "有25条" / "25条记录" 等变体；返回 `str` 只做子串包含 |
| 时间/时长用 `match_value` | `build_answer_checks({"历时": "0小时59分", "到达时间": "09:54"}, answer)` | 在 `check_goals()` 中按字段使用 `match_duration` / `match_time`（§4.7） | Agent 说"59分钟"或"上午9点54分"，`match_value` 子串匹配失败——等价格式不是子串关系。`match_time` 还提供 ±5 分钟容忍窗口，覆盖 Agent 读取时间与评测抓取状态之间的漂移 |

**原则**：站在 Agent 的角度——Agent 看到屏幕信息后会怎么回答？`get_answer()` 的返回值类型和格式必须让 `match_value` 能匹配上 Agent 的合理回答变体。

### 17.3 CriteriaTask 必须确保初始状态 ≠ 目标状态

如果 `criteria` 的目标值恰好等于 `defaults.json` 中的初始值，任务在 Agent 什么都不做的情况下就判定通过。

**典型错误**：`SetFontSizeLevel` 的默认参数 `font_size_level=2`，`defaults.json` 初始 `fontSizeLevel` 也是 `2`——Agent 不操作也通过。

**判断是否需要 `_invert_criteria`**：关键在于**采样后的目标值是否可能等于初始状态值**。

| 场景                         | 是否需要 `_invert_criteria` | 原因                                                                                    |
| ---------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| 目标可变（toggle/enum 参数） | **需要**                | 采样值可能恰好等于初始值（如采到 `True`，默认也是 `True`）                          |
| 目标固定，但等于初始值       | **需要**                | Agent 不操作也通过                                                                      |
| 目标固定，且初始值已是反面   | **不需要**              | `reset()` 后初始状态本来就与目标不同（如目标 `isBlacklisted=True`，默认 `false`） |

```python
# ✅ toggle 类：目标可变，需要 _invert_criteria
class ToggleDarkMode(CriteriaTask):
    criteria = {"settings.general.darkMode": "{toggle}"}
    async def _post_sample(self, env):
        await self._invert_criteria(env)

# ✅ 固定目标 + 初始已是反面：不需要 _post_sample
class BlacklistContact(CriteriaTask):
    criteria = {"contacts[name={contact}].isBlacklisted": True}
    # defaults.json 中 isBlacklisted 默认 false，无需处理
```

### 17.4 expected_changes 必须覆盖所有副作用

Agent 操作除了主要目标外，常产生不易注意到的副作用。未声明的副作用会导致 clean check 报 `UNEXPECTED` 警告。

**常见遗漏**：

| 操作      | 容易遗漏的副作用字段                                        |
| --------- | ----------------------------------------------------------- |
| 查看消息  | `conversations`（`lastReadAt` 更新）                    |
| 转账/支付 | `transferDraft`、`transferReceipt`、`lastPaymentHint` |
| 搜索      | `billSearchHistory`、`searchHistory`                    |
| 收藏/点赞 | `favoriteIds`、`likedIds`                               |

**规则**：在 App UI 上完整执行一遍任务操作，对比前后 state diff，所有变化的字段均纳入 `expected_changes`。

### 17.6 `_prepare()` 注入硬编码数据掩盖默认值问题

`_prepare()` 的设计目的是当 `defaults.json` 的默认数据无法满足任务前置条件时，配置环境初始状态。

**典型错误**：默认 `likedSongs` 已有数据且覆盖目标艺人，但 `_prepare()` 仍注入一份硬编码种子来"控制难度"。这导致：

- bench 侧维护了一份与 `defaults.json` 脱节的数据副本
- `defaults.json` 的变更不会反映到实际任务中
- 数据设计的决定被隐藏在 bench 代码里，而非 app 层

**规则**：

1. 优先使用 `defaults.json` 的默认数据运行任务
2. 如果默认数据不适合任务（数量不合理、缺少必要交集等），**停下来提出问题**，协商修改 `defaults.json`，而非在 `_prepare()` 中用硬编码数据悄悄替换
3. 如果确实需要注入，优先把**与 App schema 耦合的对象构造 / 状态变换**
   下沉到对应 `app.py` 的 `prepare_state_with_*` helper；task 仅保留注入时机
   与分支决策，不再内联大段 dict schema

### 17.5 route criteria 要考虑 query params

App 路由通常包含 query params（如 `/chat?id=conv_p_10&type=person`），如果 criteria 写死精确值 `"/chat"`，框架做相等比较时会失败。

**规则**：

- 如果任务目标不是"导航到某页面"，**不要把 route 放进 criteria**——状态变更本身就是充分的判定依据
- 如果确实需要检查路由，确认实际路由格式（是否带 query params），用合适的匹配方式

## 18. Task 类 Docstring 规范

Task 类的 docstring 只写**代码本身不能自证的设计决策信息**。`templates` 是给 Agent 看的指令，docstring 是给**任务设计者和判定编写者**看的——帮助他们快速理解"什么算完成"以及"为什么这个任务能被正确判定"。

### 18.1 核心原则

docstring 的价值在于补充类名、模板和代码**无法直接传达**的信息。如果一条信息从类名 + 模板 + 参数就能推导出来，就不需要写；如果必须读完 `check_goals()` 实现才能理解，就应该写在 docstring 里。

### 18.2 应该写

**1. 判定：什么算完成、为什么能判对**

两层信息：

- **判什么** — 成功状态的语义描述。比如"微信新消息包含较暖城市名和温度值"、"笔记标题匹配且内容包含所有不下雨日期"。
- **为什么能判**（仅在不显然时）— 消除歧义的关键设计点，比如：
  - 措辞消歧义：`"第一篇"指搜索结果列表第一条，确定性高`
  - 参数设计：`{city} 同时用于天气和地图，天然一致`
  - 采样约束：`采样保证两本书评分不相等，比较结果唯一`
  - 模板锚点：`模板指定笔记标题"适合出行的日子"，给 judge 一个固定锚点`
  - 条件分支：两个分支分别期望什么（下雨→"带伞"，晴天→"天气不错"）

哪里不显然就写哪里。如果类名 + 模板 + 参数已经足够自证，不需要凑篇幅。

**2. 数据注入：仅当任务的正确运行需要对环境状态做预设时**

说明需要注入什么条件、为什么光靠参数和模板还不够。比如：

- `余额需随机落在票价的 80%-120%，否则只能测到单一分支`
- `目标视频必须处于未点赞状态，否则操作无效`
- `该线路需要 ≥2 趟高铁，"最早"才有筛选意义`

如果任务不需要注入（参数设计和模板措辞本身就够了），这一段不写。

### 18.3 不应该写

- **判定的实现路径** — `check_searched()`、`nearest_rated_from_results()`、`redbook.first_search_note(keyword).title` 这类属于 `check_goals` / `app.py` 代码，写在那里自然有上下文，docstring 里重复只会多一份需要同步维护的信息。
- **模板的复述** — 读模板就能看到的信息不需要注释再说一遍。
- **泛泛的设计意图** — "测试 Agent 跨两个 APP 读取并原样传递的能力"这类从类名和模板就能推导出来。

### 18.4 示例

**简单任务 — 类名 + 模板已自证，docstring 精简**：

```python
class WeatherCurrentToWechat(BaseTask):
    """判定：微信新消息包含 {city} 当前天气状况和温度。"""

    templates = [
        "查一下{city}现在天气怎么样，发给微信好友{contact}",
    ]
```

**有消歧义设计的任务**：

```python
class WeatherFilterNonRainyDays(BaseTask):
    """模板指定笔记标题"适合出行的日子"，给 judge 一个固定锚点。

    判定：笔记标题匹配，内容包含所有不下雨日期。
    """

    templates = [
        "查{city}未来五天天气，把不下雨的日期记在笔记里，标题写'适合出行的日子'",
    ]
```

**条件分支任务**：

```python
class WeatherRainBranchNotify(BaseTask):
    """两个分支的预期消息不同：下雨→含"带伞"，晴天→含"天气不错"。
    模板把两个分支的措辞都写明了，judge 直接匹配关键词。
    """

    templates = [
        "{city}明天要是下雨，给{contact}发消息提醒带伞；不下雨就说'明天天气不错'",
    ]
```

**需要数据注入的任务**：

```python
class RailwayPriceVsBalance(AnswerTask):
    """判定："够"或"不够"与实际比较结果一致（定性判断）。

    注入：随机设置支付宝余额在 100-1000 之间，覆盖够/不够两个分支。
    """

    templates = [
        "查{date}从{from}到{to}最便宜的高铁票多少钱，再看看支付宝余额够不够买",
    ]
```

### 18.5 编写规则

1. **只写代码不能自证的信息** — 如果类名 + 模板 + 参数已经说清楚了，不需要凑篇幅
2. **说 what 和 why，不说 how** — 说明"什么算完成"和"为什么不会判错"，不复述 `check_goals` 的实现步骤
3. **保持简洁** — 1-5 行为宜。如果任务逻辑复杂到需要长篇解释，可能是任务本身需要简化
4. **新增/修改任务时必须同步更新 docstring** — 与代码不一致的 docstring 比没有更糟

### 18.6 补充节奏

- **新增任务**：必须有 docstring（纳入 §15 Checklist）
- **修改现有任务的判定逻辑**：顺手检查 docstring 是否仍准确
- **存量任务**：不要求一次性补全，按优先级逐步补充

---

## 附录 B：与 PROBLEM.md 的对应关系

本规范将 PROBLEM.md 中的每个问题抽象为可执行的规则：

| PROBLEM.md                                 | 本规范条目                                |
| ------------------------------------------ | ----------------------------------------- |
| P001: 禁止本地时间                         | §12                                      |
| P002: criteria 禁止 @property              | §3.1-3.4                                 |
| P003: _format_value 类型丢失               | §3.2（框架已修复，规范保证不回退）       |
| P004: App accessor 职责边界                | §1.2, §6.1, §6.2                       |
| P005: 指令应表达意图                       | §7                                       |
| P006: 多类问题汇总                         | §2.1, §4.4, §5.1, §6, §8, §11       |
| P007: App 类抽象边界                       | §1.2                                     |
| P008: 共性质量问题（元数据/难度/模板）     | §10, §7.5, §8                          |
| P009: 防御性编码禁令                       | §6.3, §13                               |
| P010: 结构化数据存储                       | 前端规范（`CLAUDE.md`），不在本规范范围 |
| P011: dict-of-paths 声明式答案             | §4.1                                     |
| P012: Task 文件职责与过度抽象              | §1.1                                     |
| P013: 声明式优先原则                       | §2.4                                     |
| P014: 布尔型 query 判定                    | §4.5                                     |
| P015: operate 检查原则与 check 归属        | §5.3, §1.2.3                            |
| P016: 重复推断已 enriched 的字段           | §17.1                                    |
| P017: get_answer 格式与 Agent 回答习惯     | §17.2                                    |
| P018: CriteriaTask 默认值 = 初始值         | §17.3                                    |
| P019: expected_changes 副作用遗漏          | §17.4                                    |
| P020: route 精确匹配 + query params        | §17.5                                    |
| P021: Task 缺乏设计意图说明导致 judge 误写 | §18                                      |
