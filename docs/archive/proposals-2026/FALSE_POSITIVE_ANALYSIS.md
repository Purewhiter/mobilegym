# 假阳性问题分析与解决方案

> 基于 `runs/20260402_094239` 跑批数据（511 任务，autoglm agent，45% 通过率）的系统性分析。

## 1. 问题背景

当前 benchmark 的判定体系分两类：

- **State-based**（状态 diff）：比较执行前后的 app JSON state，判定操作是否正确完成
- **Text-based**（文本匹配）：用 `match_value()` 检查 agent 的自然语言回答或写入的消息/笔记/帖子内容

State-based 判定可靠度高。**假阳性集中发生在依赖文本匹配的任务中**——agent 没有正确完成任务，但输出碰巧命中了判定条件。

### 涉及范围

| 判定类型 | 任务数 | 占比 |
|----------|--------|------|
| 纯状态判定（state_only） | ~290 | 56% |
| 文本匹配（answer_text） | ~116 | 22% |
| 混合（hybrid） | ~5 | 1% |
| crossapp 中名义 state、实际检查文本内容 | ~80 | 15% |
| **依赖文本匹配的任务总计** | **~196** | **~38%** |

完整任务分类清单见同目录 `all_tasks_judge_analysis.csv`（字段：suite, class_name, parent_class, objective, judge_type, convertible, template）。

---

## 2. 从轨迹数据中确认的假阳性模式

### 模式 A：「真空通过」— 空 expected 恒为真

**实例**：`crossapp_life.WeatherFilterNonRainyDays`

任务：查广州未来五天天气，把不下雨的日期记在笔记里，标题写"适合出行的日子"。

广州未来 5 天**全是雨天**，所以 expected dates = `[]`（空列表）。

判定逻辑（`bench_env/task/crossapp_life/tasks.py:384`）：

```python
"passed": note is not None and content != init_content and not missing_dates
```

- `missing_dates` = 从 expected_dates（空列表）找没写进笔记的日期 → 空列表
- `not []` → `True`
- Agent 只要创建了**任意内容**的笔记就通过

**结果**：Agent 错误地写入了 4/1、4/2、4/4 为"适合出行"日期，判定仍通过。

**根因**：只检查"expected 中有没有遗漏"，不检查"不该写入的也没有写入"。

---

### 模式 B：「两头下注」— Agent 发送两个分支的消息

**实例**：`crossapp_life.WeatherRainBranchNotify`

任务：深圳明天下雨就提醒带伞，不下雨就说"明天天气不错"。

实际轨迹（12 步）：

```
Step  1: AWAKE  (home)
Step  2: CLICK  → wechat/chat/Boss     ← 没有打开天气 app！
Step  8: TYPE   → "明天天气不错"
Step 10: TYPE   → "提醒带伞"
Step 12: COMPLETE
```

Agent **根本没查天气**，直接给 Boss 发了两条消息——两个分支都覆盖了。

判定只检查 `['天气不错'] in messages`，命中通过。

**根因**：条件分支任务只验证正确分支的消息存在，不检查错误分支是否也被发送，也不检查 agent 是否访问过信息源 app。

---

### 模式 C：「列举碰撞」— 输出大量数字，小值 expected 被偶然命中

`_match_numeric()` 有 `(?<!\d)(?!\d)` 边界保护，`2` 不会匹配 `12`。但 agent 输出包含**多个独立数字**时，小数值 expected（1-10）仍有碰撞风险。

例：expected = `3`，agent 回答"4月2日有5场会议，其中3场已结束" → `3` 命中通过，但 agent 根本没数对日期。

本次跑批中未找到此模式的确凿实例，但机制上风险真实存在，尤其是 crossapp 任务输出冗长时。

---

## 3. 核心函数分析

`bench_env/task/common_tasks.py:444 match_value()`：

```python
def match_value(expected, actual):
    if isinstance(expected, Pattern):  # regex → search
    if isinstance(expected, (int, float)):  # → _match_numeric（有边界保护）
    # string → containment：exp_str in act_str
```

**弱点**：string 类型是纯 containment 匹配，只要 expected 是 actual 的子串就通过，对长文本过于宽松。

---

## 4. 116 个 AnswerTask 的转换分类

### A 类：最值/比较查询 → 对最X的执行操作（~40 个，可完全消除文本匹配）

| 原任务 | 转换后 | 判定方式 |
|--------|--------|----------|
| 世界时钟里哪个城市时间最晚 | 删掉时间最晚的城市 | cities diff |
| 历史会议里开最久的是哪场 | 删除开最久的那场 | meetings diff |
| 未来五天哪天最暖 | 在最暖那天建日程 | events diff |
| 评分最高的餐厅是哪家 | 收藏评分最高的 | favorites diff |
| 最便宜的商品多少钱 | 加入购物车 | cart diff |
| {city1}和{city2}哪个更热 | 删掉更冷的那个 | cities diff |
| 哪天安排更多 | 删掉安排少那天的全部日程 | events diff |
| 推荐值最高的书 | 加入书架 | shelf diff |

涉及：weather 比较(6)、map 查找(5)、tencent_meeting 最值(4)、ebay 最便宜(2)、calendar 比较(2)、clock 最晚(1)、wechat_reading 最高(2)、bilibili 排行(1)、spotify(1)

### B 类：计数查询 → 批量操作后验证（~20 个，可完全消除文本匹配）

| 原任务 | 转换后 | 判定方式 |
|--------|--------|----------|
| 时钟里一共有几个闹钟 | 删掉所有只响一次的闹钟 | alarms diff |
| 笔记里有几条便签 | 全部移到回收站 | notes diff |
| 几个未读会话 | 全部标为已读 | unread count = 0 |
| 几个乘车人 | 删掉所有非默认乘车人 | passengers diff |
| 几条已完成待办 | 删掉已完成的 | todos diff |
| 那天有几个日程 | 全部删掉 | events diff |

### C 类：条件分支查询 → 条件操作（~25 个 crossapp，可完全消除文本匹配）

| 原任务 | 转换后 | 判定方式 |
|--------|--------|----------|
| 下雨提醒带伞/不下雨说天气不错 | 下雨就设闹钟，不下雨就建日程 | alarm/event diff |
| 余额够不够买票 | 够就下单，不够就在日历建提醒 | order/event diff |
| 低于预算记笔记 | 低于预算就加购物车 | cart diff |
| 不下雨的日期记笔记 | 在不下雨的日期各建日程 | events diff |

### D 类：信息转发 crossapp — 无法消除文本检查（~60 个）

原始形式："查 X 信息发给微信好友 / 记到笔记 / 发朋友圈"

消息/笔记的文本内容本身就是任务目标，无法转为纯状态 diff。

**改善方向（不改任务结构）**：
1. 确保检查的 keyword 足够唯一（车次号、完整歌名，而非常见词）
2. 要求**多个独立关键词**同时命中（而非单一值）
3. 增加 `required_app_visits` 验证 agent 访问过信息源

### E 类：纯信息查询 — 没有操作等价物（~50 个，风险相对低）

"微信号是多少" / "闹钟备注写的什么" / "现在几度" 等。

特征：单 app 内、agent 在目标 app 上启动、expected 值唯一性较高。本次跑批中未发现明显假阳性。**暂不需要处理。**

---

## 5. 汇总与优先级

| 类别 | 数量 | 能否消除文本匹配 | 优先级 |
|------|------|-----------------|--------|
| A 最值/比较→操作 | ~40 | **完全消除** | P1 |
| B 计数→批量操作 | ~20 | **完全消除** | P1 |
| C 条件查询→条件操作 | ~25 | **完全消除** | P1 |
| D 信息转发（crossapp） | ~60 | 不能消除，可强化 keyword | P2 |
| E 纯信息查询 | ~50 | 不能消除，风险低 | 暂不处理 |

**A+B+C ≈ 85 个任务可以转为纯状态判定，约占全部文本匹配任务的 43%。**

---

## 6. 推荐方案（混合策略）

**短期（立即可做）**：
1. 修复 `WeatherFilterNonRainyDays` 的空集 bug（当 expected_dates 为空时，还要检查笔记里没有写入任何具体日期）
2. 条件分支任务（C 类）增加互斥检查：两个分支的关键词不能同时出现在输出中
3. 跨 app 任务增加 `required_app_visits` 验证：从 trajectory route 数据中提取 visited apps，确保 agent 访问过必要 app

**长期（系统性改造）**：
4. 将 A 类（40 个）任务逐步改写为操作型——优先改已知有假阳性风险的，如天气/时钟/日历系列
5. 将 B 类（20 个）计数任务改写为批量操作型
6. D 类 crossapp 任务逐步强化 keyword 唯一性

**不推荐**：
- 限制 agent 输出格式：改变了任务自然度，且不能根本解决 hedging 问题
- 全量 VLM 轨迹复核：成本过高，VLM 本身也会误判

---

## 7. 关键代码位置

| 文件 | 位置 | 作用 |
|------|------|------|
| `bench_env/task/common_tasks.py` | L444 | `match_value()` 文本匹配核心 |
| `bench_env/task/common_tasks.py` | L126 | `_match_numeric()` 数字匹配 |
| `bench_env/task/crossapp_life/tasks.py` | L384 | WeatherFilterNonRainyDays 空集 bug |
| `bench_env/task/base.py` | — | `Task.evaluate()` 主流程 |
| `bench_env/task/judge.py` | — | `StateComparator` / `JudgeResult` |
| `bench_env/runner/base.py` | — | `Evaluator` / `Controller` 主循环 |

## 8. 附件

- `docs/pending/all_tasks_judge_analysis.csv`：全部 518 个任务的分类（suite, class_name, parent_class, objective, judge_type, convertible, template）
- `runs/20260402_094239/`：本次分析使用的跑批数据（511 episodes，trajectory 目录含完整轨迹）
