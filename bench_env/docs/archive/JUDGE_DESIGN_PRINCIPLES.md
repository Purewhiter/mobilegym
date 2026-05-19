# 任务评测设计方法论

## 系统架构

本系统是一个**三阶段流水线**：

```
出题阶段（Setup）→ Agent（执行）→ Judge（评分）
```

- **出题阶段**：保证前提条件成立（`defaults.json` → `_prepare()` → sampler → `_post_sample()`）
- **Agent**：在环境中执行操作，产生 current state + 可选文本回答
- **Judge**：判定 Agent 的行为结果是否符合任务目标

**核心原则：三阶段单一职责，通过契约协作。** Sampler 保证前提，Judge 只做判定，互不越界。

---

## 核心模型：CRUD 分类

所有 state-based 任务的判定归结为四种操作之一。**每种操作有且仅有一个正确的检查策略**——不是选择，是逻辑推导的结果。

| 操作 | 判定问题 | 检查策略 | 为什么只有这一种策略 |
|------|---------|---------|-------------------|
| **增** | 是否新增了符合预期的项？ | **diff**：在 current\init 中找匹配项 | 不 diff 就无法区分"Agent 新增的"和"原来就有的" |
| **删** | 目标项是否被移除？ | **diff**：目标 ID 在 init\current 中 | 不 diff 就无法区分"Agent 删掉的"和"从未存在的" |
| **改** | 目标项当前属性是否正确？ | **lookup**：在 current 中按 ID 查找，检查属性 | 验证的是终态，不关心变化过程 |
| **查** | Agent 的回答是否正确？ | **read init**：从 init 读取期望答案 | 答案在出题时确定，不因 Agent 行为改变 |

CRUD 模型覆盖所有在 state 中留下痕迹的判定——包括最终结果和过程中的状态变化（搜索历史、浏览记录等都是 state 数据，本质上也是"增"操作）。VagueTask / SafetyTask 不走 state 比对，不在本模型范围内。

---

## 每种操作的检查模式

### 增（Create）

**策略**：diff（init vs current），在新增项中匹配预期属性。

```python
def check_created_alarm(self, h, m, **attrs):
    # Sampler 契约：目标不应已存在于 init
    assert self.init.find_alarm_by_time(h, m) is None

    # Agent 行为判定：在新增项中查找匹配
    new = self.new_alarms()  # current - init by ID
    match = next((a for a in new
                  if int(a["hour"]) == h and int(a["minute"]) == m
                  and all(str(a.get(k)) == str(v) for k, v in attrs.items())), None)
    return {"field": "alarm_created", "expected": {"h": h, "m": m, **attrs},
            "actual": match, "passed": match is not None}
```

**归因**：新增项为空 → Agent 没创建 → `passed=False`；Sampler bug（目标已存在）→ assert 失败 → `judge_error`。

### 删（Delete）

**策略**：diff（init vs current），确认目标 ID 在已删除集合中。

```python
def check_deleted_alarm(self, alarm_id):
    # Sampler 契约：目标应存在于 init
    assert self.init.find_alarm_by_id(alarm_id) is not None

    removed = self.removed_alarm_ids()  # init IDs - current IDs
    return {"field": "alarm_deleted", "expected": alarm_id,
            "actual": removed, "passed": str(alarm_id) in removed}
```

**为什么不用 `find_by_id(id) is None` 直接检查 current？** 如果 sampler 有 bug（目标从未存在），该检查也返回 None → `passed=True`，产生**假阳性**。diff 方式在此场景下返回 `passed=False`（安全的假阴性），再加上 assert 兜底为 `judge_error`。

### 改（Modify）

**策略**：用 init 解析目标身份，用 current 验证修改结果。

```python
def check_alarm_fields(self, hour, minute, **expected):
    # 用 INIT 解析目标身份（改完后内容变了，只有 init 能可靠定位）
    init_alarm = self.init.find_alarm_by_time(hour, minute)
    assert init_alarm is not None  # Sampler 契约
    alarm_id = init_alarm["id"]

    # 用 CURRENT 验证修改结果
    alarm = self.find_alarm_by_id(alarm_id)

    # Agent 行为判定：闹钟还在吗？（Agent 可能误删了它）
    if alarm is None:
        return {"field": f"alarm_{alarm_id}", "expected": expected,
                "actual": None, "passed": False}

    # Agent 行为判定：属性改对了吗？
    passed = all(str(alarm.get(k)) == str(v) for k, v in expected.items())
    return {"field": f"alarm_{alarm_id}", "expected": expected,
            "actual": {k: alarm.get(k) for k in expected}, "passed": passed}
```

**`alarm is None → passed=False` 不是防御性检查**——这是对 Agent 行为的合法判定。Agent 可能把闹钟删了而不是改它，这属于 Agent 的错（`passed=False`），不是任务设计的错（`judge_error`）。如果直接读 `alarm["hour"]` 让它自然报错，反而会把 Agent 的失败误分类为 `judge_error`。

### 查（Query）

**策略**：从 init 读取期望答案，与 Agent 回答比对。

```python
# 只需 init 状态，不传 init= 参数
def get_answer(self, input):
    return Clock(input.apps_init["clock"]).find_alarm_by_id(self.p.alarm_id)["note"]
    # 如果 alarm 不存在，TypeError 自然上抛为 judge_error ✅
```

查类**不需要显式 assert**——读取 init 数据时的解引用（如 `alarm["note"]`）会自然产生 TypeError，天然就是 `judge_error`。

---

## init vs current 的职责分工

| 用途 | 用哪个状态 | 原因 |
|------|-----------|------|
| 解析目标身份（"4:30 的闹钟是哪个"） | **init** | 改/删完后内容变了，只有 init 能可靠定位 |
| 验证操作结果（属性是否正确） | **current** | 要看 Agent 操作后的终态 |
| 比对新增/删除 | **init + current** | diff 需要两端 |
| 读取期望答案（查类） | **init** | 答案在出题时确定 |
| Sampler 契约断言 | **init** | 前提条件应在 init 中成立 |

### App 实例创建规则

```python
# 增/删/改：需要两个状态
clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
clock.alarms              # current 状态
clock.init.alarms         # init 状态
clock.find_alarm_by_id(x) # 在 current 中查找
clock.init.find_alarm_by_id(x)  # 在 init 中查找

# 查：只需要 init 状态（作为唯一参数）
clock = Clock(input.apps_init["clock"])
clock.find_alarm_by_id(x)["note"]  # 直接读；不存在则自然报错
```

方法本身不关心在哪个实例上被调用——同一个 `find_alarm_by_id()` 在 `clock` 上调就是查 current，在 `clock.init` 上调就是查 init。

---

## Sampler 契约断言

**assert 不是"重验上游保证"——它的目的是保证归因正确。**

没有 assert 时，sampler bug 会被静默归因为 Agent 失败：

| 操作 | Sampler bug | 无 assert 的后果 | 有 assert 的后果 |
|------|------------|-----------------|-----------------|
| 增 | 目标已存在于 init | diff 为空 → `passed=False`（冤枉 Agent） | `AssertionError` → `judge_error` ✅ |
| 删 | 目标不在 init 中 | 不在 removed 中 → `passed=False`（冤枉 Agent） | `AssertionError` → `judge_error` ✅ |
| 改 | 目标不在 init 中 | lookup 返回 None → `passed=False`（冤枉 Agent） | `AssertionError` → `judge_error` ✅ |
| 查 | 数据缺失 | 解引用 TypeError → `judge_error` ✅ | 无需 assert，自然报错即可 |

**assert 放在 App 的 check 方法中**，而非 task 的 `check_goals()` 中——保持 task 代码一行调用。

---

## App Helper 方法分层

方法分层从 CRUD 操作类型自然推出：

| 层级 | 方法类型 | 为哪种操作服务 | 示例 |
|------|---------|:---:|------|
| 对比层 | init vs current 差集 | 增/删 | `new_alarms()` → `list[dict]`<br>`removed_alarm_ids()` → `set[str]` |
| 检查层 | 返回 check dict | 全部 | `check_created_alarm(h, m, repeat=...)`<br>`check_deleted_alarm(id)`<br>`check_alarm_fields(h, m, hour=7)` |
| 查找层 | 单状态查找 | 改/查 | `find_alarm_by_id(id)` → `dict \| None`<br>`find_alarm_by_time(h, m)` → `dict \| None` |
| 属性层 | 结构化访问 | 全部 | `alarms` → `list[dict]`<br>`selected_cities` → `list[dict]` |
| 答案层 | 返回格式化答案 | 查 | `city_time(name, os)` → `str`<br>`city_local_diff_text(name, os)` → `re.Pattern` |

**关系**：

- 检查层内含 assert（sampler 契约）+ 对比层/查找层调用 + 归因判定
- 对比层调用属性层（对比 `self.alarms` 与 `self.init.alarms`）
- 查找层和属性层是基础层，不依赖 init
- **增/删类任务不应直接使用查找层**——应通过对比层或检查层访问

---

## 组合模式

复杂任务分解为多个 CRUD 检查的组合：

| 模式 | 示例 | 分解方式 |
|------|------|---------|
| Hybrid（增+查） | 加城市再查时间 | `[check_created_city(c), check_city_time_answer(c, os, answer)]` |
| 替换（删+增） | 删城市 A 换城市 B | `[check_deleted_city(A), check_created_city(B)]` |
| 批量改 | 打开所有闹钟 | 遍历每个 alarm 做改的判定 |
| 条件分支 | 下雨发伞提醒 | 从 init 读条件 → 选对应的 check |
| 过程+结果 | 先搜索再收藏 | `[check_created_search(kw), check_created_favorite(id)]` |

```python
# Hybrid 示例：加城市 + 查时间
def check_goals(self, input):
    clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
    return [
        clock.check_created_city(self.p.city),
        clock.check_city_time_answer(self.p.city, input.os, input.answer),
    ]
```

---

## 错误归因总结

| 场景 | 归因 | 机制 |
|------|------|------|
| Agent 没做 / 做错了 | `passed=False` | CRUD 检查逻辑 |
| Sampler bug（前提违反） | `judge_error` | check 方法中 assert 失败 |
| App 数据结构损坏 | `judge_error` | 属性层类型检查（如 `alarms` 不是 list） |
| 查类 init 数据缺失 | `judge_error` | 自然解引用 TypeError |
| Judge 代码本身有 bug | `judge_error` | 框架统一 try/except |

**铁律**：`passed=False` 只出现在 Agent 可以影响的判定中。任何非 Agent 因素导致的失败都必须走异常路径成为 `judge_error`。
