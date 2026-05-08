---
name: testing-bench-task
description: Use when adding or modifying offline judge tests for bench_env tasks — specifically entries in `OFFLINE_JUDGE_POSITIVE_CASES` / `OFFLINE_JUDGE_NEGATIVE_CASES` in `bench_env/tests/test_<suite>.py`, or writing live tests. Triggers after a new task is added, or when tightening judge coverage.
---

# Testing bench_env Task Judges

## Overview

A single positive + a single "opposite of positive" negative is **not a test** — it's a tautology. Real coverage means the negative exercises a failure mode an Agent could realistically produce. Most defects ship because tests stop at one reverse pattern.

**Authoritative ref:** `bench_env/docs/TASK_TEST_SPEC.md` §4 (read §4.3.2 through §4.3.5 before writing cases).

## Rule 1 — Positive `answer` must be natural language (§4.3.2)

AnswerTask positives with bare ground-truth values (`answer="32"`, `answer="多云"`) bypass `match_value`'s fuzzy/number-extraction logic — the test proves nothing.

```python
# ❌ bare ground truth — test passes tautologically
_make_input(state, state, answer="多云")

# ✅ natural language, as an Agent would actually respond
_make_input(state, state, answer="上海今天天气多云转晴")
```

**Format must include ground truth as substring / extractable number**, plus realistic surrounding context.

## Rule 2 — Pick negative patterns from the taxonomy (§4.3.3)

Blanket `answer="错误答案"` / `curr_state == init_state` is a single degenerate pattern. For each task, pick ≥1 pattern from the matching table:

### Query tasks

| Pattern | Example |
|---|---|
| 查错对象 | Ask Beijing temp; answer Shanghai's real temp |
| 值接近但不对 | Ground truth 32; answer "北京现在33度" |
| 同义但语义不同 | GT="多云"; answer "今天阴天" |
| 过度回答含干扰数字 | GT humidity=40; answer "气温32度，紫外线7，风力3级" (no 40) |
| 布尔翻转 (肯/否定 subset) | GT=肯定; answer "没有通过核验" |
| 空回答 | `answer=None` or `answer=""` |

### Operate tasks

| Pattern | Example |
|---|---|
| 未操作 | `curr_state == init_state` |
| 做反操作 | Target is close; state set to open |
| 操作错误目标 | Task wants tempUnit changed; `curr` changed windUnit |
| 部分完成 | 3-step sequential; only first step committed |

### Cross-app tasks

| Pattern | Example |
|---|---|
| 源完成、目标未动 | 查了天气但未发微信 |
| 信息传递错误 | 发了微信但内容与天气不匹配 |
| 全部未动 | 所有 App 状态同 init |

**Every negative case must name a pattern from the relevant table.** Complex tasks (multi-field, cross-app) need ≥2 different patterns.

## Rule 3 — hybrid tasks need ≥2 negatives (§4.3.1)

hybrid 任务同时检查状态变更和 answer，失败维度独立，**≥2 反例**：

| 组合 | 期望 | 覆盖意义 |
|---|---|---|
| 状态正确 + answer 正确 | PASS | 唯一正例 |
| 状态正确 + answer 错 | FAIL | answer 判定独立生效 |
| answer 正确 + 状态错 | FAIL | 状态判定独立生效 |

## Rule 4 — Cover `match_value` boundary cases at suite level (§4.3.4)

These are suite-level concerns; add them as extra cases (name them `"TaskName_suffix"` and put them in `HYBRID_EXTRA_NEGATIVE_CASES` or similar to avoid breaking `test_*_judge_matrix_complete`).

Pick representative tasks and cover:

- [ ] **中文数字**: at least one positive with `answer="北京现在二十度"`
- [ ] **空 answer**: at least one AnswerTask negative with `answer=None`
- [ ] **多数字干扰**: GT value in answer while other numbers are also present
- [ ] **子串包含陷阱**: for any 肯定/否定 query, negative proves "通过" ⊂ "未通过" handled
- [ ] **尾零格式**: for 小数金额 tasks, positive with `"总共278.20元"`

## Rule 5 — Multi-format positives for structured values (§4.3.5)

When `get_answer()` returns time (`"09:54"`) or duration (`"0小时59分"`), `match_value` substring fails on equivalent formats. If the task uses `match_time` / `match_duration` in `check_goals`, the test **must** parametrize positives:

```python
@pytest.mark.parametrize("answer", [
    "G7010，1小时10分，13:10",         # exact
    "G7010，70分钟，下午1点10分",       # chinese natural
    "G7010，1小时10分钟，13:10到达",    # mixed format
], ids=["exact", "chinese_natural", "mixed"])
async def test_fastest_train_flexible(self, env, answer): ...
```

## Rule 6 — Keep matrix-complete invariant intact

`test_*_judge_matrix_complete` requires exactly one main positive + one main negative per task name. Extra variants go into a separate list (e.g. `HYBRID_EXTRA_NEGATIVE_CASES`) with suffixed names (`"CheckBalance_empty_answer"`).

## Rationalization table

| Excuse | Reality |
|---|---|
| "The existing pattern already has one positive + one negative, so I'm done" | One-of-each is the MINIMUM bar. §4.3.3 says pick an intentional failure mode, not a reverse of the positive. |
| "I'll just mirror the positive" | Mirror-negatives catch no real Agent bug. Pick from the §4.3.3 table. |
| "Natural language answer just adds noise" | Bare GT bypasses `match_value`. The test becomes tautological. |
| "Boundary cases are edge cases, skip them" | §4.3.4 lists the bugs that shipped. At least sample them per suite. |
| "Time format is fine as-is, `match_value` will handle it" | §4.3.5 — it won't. Use `match_time`/`match_duration` + parametrize. |
| "Negative for hybrid with one fail axis is enough" | §4.3.1 — independent state/answer axes each need a FAIL test. |

## Checklist

- [ ] Each task has ≥1 positive with **natural-language** `answer`
- [ ] Each task has ≥1 negative; pattern named from §4.3.3 tables (not mirror-of-positive)
- [ ] hybrid tasks have ≥2 negatives covering each independent fail axis
- [ ] Suite-level: §4.3.4 boundary cases sampled (中文数字 / 空 answer / 多数字干扰 / 子串陷阱 / 尾零)
- [ ] Structured-value tasks (time / duration / date): §4.3.5 parametrized positives
- [ ] New cases don't break `test_*_judge_matrix_complete` (variants go to `*_EXTRA_*`)
- [ ] Uses `make_judge_input` from `conftest.py`; no defensive `.get()` on state
- [ ] Ran `pytest bench_env/tests/test_<suite>.py -m "not live" -v` and it passes
