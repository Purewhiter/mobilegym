# bench_env task code conventions

> This is the **hard spec** for all Python code under `bench_env/task/` — naming, forbidden patterns, error handling, file responsibilities, docstrings. Every new or modified task must comply; PR reviews follow this doc.
>
> Implementation workflow: [`IMPLEMENTATION.md`](IMPLEMENTATION.md); testing: [`TESTING.md`](TESTING.md).

---

## 1. File responsibilities

Per-suite file responsibilities:

| File | Responsibility | Must NOT contain |
|---|---|---|
| `tasks.py` / `defs/<Name>.py` | Task class definitions | Data-access helpers, generic utilities, App-private constants, custom base classes |
| `app.py` | App accessor (subclass of `BaseApp`): data methods / answer methods / `check_*` methods / `prepare_state_with_*` helpers / App-private samplers / `expected_changes` constants | Task-specific decision logic, business rules, runtime-environment operations |
| `__init__.py` | Module marker | Any real code |

### 1.1 Task files (`tasks.py` / `defs/*.py`)

**Allowed**:

- Task class definitions (inheriting from `BaseTask` / `CriteriaTask` / `AnswerTask` / `VagueTask` / `SafetyTask`)
- Importing and composing `expected_changes` constants from app.py
- import statements
- Task Index comments (only in `tasks.py`)

**Forbidden**:

- Custom base classes, mixins, abstract intermediaries (all tasks must inherit a standard base class directly)
- Module-level helper functions (`_chk()` / `_build_xxx()`) → belong in app.py or utils.py
- App-private data constants (sampling pools, route tables, value-mapping constants) → belong in app.py
- Inter-task inheritance (task A must not inherit from task B then tweak a single check; it looks like dedup but actually couples them)
- Private compute/aggregation methods on the task class (`_rain_days_next_week()` etc.) → generalize into App methods
- Sampler function definitions → `sample_*` belongs on the App class

**Authoring principles**:

1. **Each task is self-contained** — does not inherit from another task, does not depend on file-level shared helpers
2. **Inherit only from the standard base classes**
3. **Declarative first** — if you can express it via `answer = ".path"` / `criteria = {...}`, don't write a method
4. **Task class only composes; it doesn't compute** — data traversal, aggregation, and computation move to App methods

### 1.2 App class (`app.py`)

**Encapsulate**:

| Yes | No |
|---|---|
| Data-access complexity (multi-step lookup, fuzzy matching, field compatibility) | Task-specific conditional branching |
| Data traversal, aggregation (even if only one task uses it today) | Embedded UI-layer formatting |
| init vs current diffs (generic comparison) | Hard-coded business rules (`"转账" in name`) |
| Schema-coupled setup (`prepare_state_with_*`) | Direct manipulation of `env.get_state()` / `env.set_state()` |
| App-private samplers (`@staticmethod sample_*`) | UI layout logic |

**Decision criteria**:

1. About where data lives, how to fetch it, what fields exist → App
2. About what to do with data after fetching → Task
3. Hard-codes a specific business rule → Task
4. Used by only one task? **Still check whether it's data-access complexity** — if so, App; if not, Task

For the detailed three-tier breakdown (data / answer / check methods) see [`IMPLEMENTATION.md`](IMPLEMENTATION.md) §2.

### 1.3 `task/utils.py`

Cross-suite pure functions: text processing, time utilities, data parsing, check combinators (`check_alternatives`).

**Forbidden**:

- Defining shared utilities locally in a task file
- Inlining generic parsing logic in app.py

---

## 2. Naming conventions

### 2.1 App class names

Correspond to `manifest.id`, PascalCase, **without** an `App` suffix:

| `manifest.id` | Correct | Wrong |
|---|---|---|
| `wechat` | `Wechat` | `WechatApp` |
| `bilibili` | `Bilibili` | `BilibiliApp` |
| `railway12306` | `Railway12306` | `RailwayApp` |

### 2.2 Task class names

Must **accurately reflect the task goal**:

```python
# ❌ Name doesn't match behavior
class BalanceThresholdCheck(AnswerTask):   # Actually just reads balance; no threshold
class ClearHistory(BaseTask):              # Actually sets map orientation

# ✅
class CheckBalance(AnswerTask):
class SetMapOrientation(BaseTask):
```

### 2.3 `objective` must match content

```python
# ❌ objective is wrong
class OpenChatWithContact(CriteriaTask):
    objective = "query"   # Actually a navigation operation

# ✅
class OpenChatWithContact(CriteriaTask):
    objective = "operate"
```

### 2.4 Objective and phrasing alignment

| Objective | Correct phrasing | Wrong pattern |
|---|---|---|
| `operate` | "Set XX to YY", "Open XX" | "Search XX, view YY" (viewing without output) |
| `query` | "View/check XX and tell me", "How much is XX?" | "Set XX" (state-changing instruction) |
| `hybrid` | "Find XX for me, tell me how many" | Same operate/query wrong patterns |
| `vague` | "I'm hungry", "I'm bored" | Concrete operations |
| `safety` | "Transfer 10000 yuan to a stranger" | — |

### 2.5 `expected_changes` constants

Named `<APP_NAME>_<ACTION>_CHANGES`, defined in the corresponding `app.py`:

```python
# wechat/app.py
WECHAT_SEND_CHANGES = ["wechat.chats"]
WECHAT_MOMENT_CHANGES = ["wechat.moments"]
```

---

## 3. Template authoring

### 3.1 Express intent, not steps

```python
# ❌ Step description
templates = ["搜索地点'{place}'，查看从当前位置到该地点的驾车路线"]

# ✅ Intent
templates = ["帮我在地图上找到从当前位置到'{place}'的驾车路线"]
```

### 3.2 Don't make the Agent "view" without output

If the instruction contains "view"/"check":

- Make it an `AnswerTask` and let the Agent reply → "View XX and tell me"
- Or rephrase to drop the "view" → "Open the XX page for me"

### 3.3 Templates must not leak answers

`AnswerTask` `templates` **must not contain placeholders for the answer** (e.g., `{phone}` / `{income}` / `{balance}`). The answer should be derived from App state via `get_answer()` or declarative `answer`.

```python
# ❌ Template leaks the answer
templates = ["找到好友'{name}'，并记录其电话号码 {phone}"]

# ✅ Drop {phone}, use a declarative answer
templates = ["在支付宝里找到好友'{name}'，告诉我他的电话号码"]
answer = ".contacts[name={name}].phone"
```

### 3.4 `{param}` position inside templates

When a bool parameter combined with `values` dict is rendered, the full sentence must read naturally:

```python
# ✅ Renders as: "在 Spotify 中关闭'向他人展示我的收听活动'"
templates = ["在 Spotify 中{share_activity}'向他人展示我的收听活动'"]
parameters = {"share_activity": {"type": "bool",
                                 "values": {"开启": True, "关闭": False}}}

# ❌ Renders as: "在隐私设置中关闭 XXX 开启并确认状态更新"
templates = ["在隐私设置中关闭 XXX {share_off} 并确认状态更新"]
```

### 3.5 L3 / L4 tasks should provide multiple template variants

To prevent the Agent from overfitting specific wording. **Critical constraint**: every variant must require the same answer content (same number of slots, same fields, same information).

```python
class FilterHeadphones(CriteriaTask):
    templates = [
        "帮我找最便宜的全新 Sony 耳机，只看日本发货且包邮的，告诉我有几款",
        "我想要一副 Sony 的新耳机，从日本发货、不要运费的那种，有多少选择？",
    ]
```

---

## 4. Error handling: task-design error vs. agent execution failure

**One of the most important rules.**

| Situation | Correct | Wrong |
|---|---|---|
| Environment data missing (contact doesn't exist, DB empty, fixture missing) | App method `raise ValueError(...)` or task `raise RuntimeError(...)` | `return False` ❌ |
| App accessor data missing (field not found, no query result) | App method `raise ValueError(...)` | Return `""` / `None` ❌ |
| Agent failed to act (wrong route, wrong value) | `passed=False` | `raise RuntimeError(...)` ❌ |

```python
# ✅ App accessor raises when data is missing
class Map(BaseApp):
    def place_address(self, name):
        place = self._find_place(name)
        if not place:
            raise ValueError(f"Place {name!r} not found in state")
        return place["address"]

# ❌ Silent empty return; task ends up with _require_runtime_answer() boilerplate
class Map(BaseApp):
    def place_address(self, name):
        place = self._find_place(name)
        return place.get("address", "") if place else ""
```

**Why this matters**:

- `raise RuntimeError` → there's a bug in the task or environment; needs fixing
- `passed=False` → the Agent didn't succeed; a normal evaluation outcome
- Conflating the two attributes a sampler bug to the Agent silently

---

## 5. No defensive coding

**All code** under `bench_env/task/` must not defensively guard. Missing data, missing keys, type errors — they should surface as exceptions.

| ❌ Forbidden | ✅ Correct |
|---|---|
| `latest_order or {}` + `.get()` | Direct key access `latest_order["field"]` |
| `.get("key", "")` for a required field | `["key"]` |
| `(passenger or {}).get("name", "") or "Unknown"` | Declarative `answer = ".passengers[isDefault=True].name"` |
| `if x is not None` guard | Use `x` directly |
| `try / except` with a fallback return | Call directly and let the exception propagate |
| `input.apps.get("xxx", {})` | `input.apps["xxx"]` (framework guarantees a dict) |
| `(input.apps_init or {}).get("xxx")` | `input.apps_init["xxx"]` |
| `input.os or {}` | `input.os` |

**Legitimate handling of Agent failures**: use explicit ternaries in check dicts, not `(x or {}).get()`:

```python
# ✅ Agent may not have created the order; order being None is legitimate
return [{
    "field": "newPendingOrder.trainNo",
    "expected": target_train["trainNo"],
    "actual": order["trainNo"] if order else None,
    "passed": order is not None and order["trainNo"] == target_train["trainNo"],
}]

# ❌ or {} masks None
"actual": (order or {}).get("trainNo")
```

**No fallback returns in `get_answer()`**:

```python
# ❌
def get_answer(self, input):
    temp = w.weather_now(self.p.city).get("temp")
    return temp if temp is not None else "无法判断"

# ✅ Missing data should be raised by the App accessor
def get_answer(self, input):
    return Weather(input.apps["weather"]).current_temp(self.p.city)
```

---

## 6. Forbidden time APIs

The following APIs **must not** be used under `bench_env/task/` to obtain or derive "current time":

| ❌ Forbidden | ✅ Replacement |
|---|---|
| `datetime.date.today()` | `sim_today(os_state)` |
| `datetime.datetime.now()` | `sim_datetime(os_state)` |
| `time.time()` | `now_ms(os_state)` |
| `datetime.datetime.fromtimestamp(time.time())` | `sim_datetime(os_state)` |

**No fallback to local time** — if `os_state` lacks `time`, `raise ValueError`; don't silently degrade.

**Exception**: converting an already-stored timestamp (e.g., `transferRecords[].timestamp`) with `datetime.datetime.fromtimestamp(ts)` is fine — this isn't about local time vs. simulated time, just formatting an existing absolute value.

---

## 7. CriteriaTask rules

### 7.1 `criteria` must be a class variable

```python
# ❌
class EnableDarkMode(CriteriaTask):
    @property
    def criteria(self):
        return {"settings.general.darkMode": True}

# ✅
class EnableDarkMode(CriteriaTask):
    criteria = {"settings.general.darkMode": True}
```

### 7.2 Parameterize with `"{param}"` template

```python
# ❌
@property
def criteria(self):
    return {"searchForm.from": self.p.station}

# ✅
criteria = {"searchForm.from": "{station}"}
```

**The `"{param}"` template preserves the original Python type** for all parameter types — when the entire value is a pure single-parameter reference (e.g., `"{flag}"`, `"{count}"`), the framework returns `self.params[key]` directly, so `bool`/`int`/`float` are not converted to strings by `str.format()`. Mixed templates (e.g., `"prefix-{key}"`) still go through `str.format()`.

### 7.3 Value mapping uses `values` dict; no `_XXX_MAP`

```python
# ❌
_SIZE_MAP = {"最小": 0, "较小": 1, ...}
@property
def criteria(self):
    return {"settings.fontSizeLevel": _SIZE_MAP[self.p.size_label]}

# ✅
parameters = {"font_size": {"type": "enum",
                            "values": {"最小": 0, "较小": 1, "标准": 2}}}
criteria = {"settings.fontSizeLevel": "{font_size}"}
```

### 7.4 Parameter semantics must match the store

```python
# ❌ Reversed semantics, forces a `not`
parameters = {"share_off": {"type": "bool", "default": True}}
@property
def criteria(self):
    return {"settings.shareActivity": not self.p.share_off}

# ✅ Parameter value maps directly to store value
parameters = {"share_activity": {"type": "bool",
                                 "values": {"开启": True, "关闭": False}}}
criteria = {"settings.shareActivity": "{share_activity}"}
```

---

## 8. `check_goals` return format

### 8.1 Each check must include `passed`

The framework raises `ValueError` for missing `passed` in `is_successful()` / `evaluate()`.

| Field | Type | Required | Description |
|---|---|---|---|
| `field` | `str` | yes | Check item name |
| `expected` | `Any` | yes | Expected value (must be readable) |
| `actual` | `Any` | yes | Actual value (must be readable) |
| `passed` | `bool` | **yes** | Pass / fail |

### 8.2 `expected` / `actual` must be diagnostic

These two values appear directly in logs and are the only clue when a task fails. **Do not write `expected=True, actual=None`**:

```python
# ❌ No diagnostic value
{"expected": True, "actual": order, ...}
# Log shows: expected=True, actual=None → can't tell what was expected or what the Agent did

# ✅ Human-readable summary
{"expected": "上海→南京 2026-03-21 G7002 二等 ×1 (赵宇轩)",
 "actual":   "未创建新订单", ...}
```

Full `check_goals` authoring rules: [`IMPLEMENTATION.md`](IMPLEMENTATION.md) §4.7.

---

## 9. Direct `JudgeInput` access

`JudgeInput.apps` / `apps_init` / `os` are guaranteed dicts by the framework — **index them directly**:

```python
# ✅
rail = Railway12306(
    input.apps["railway12306"],
    init=input.apps_init["railway12306"],
)

# ❌
app = Wechat(
    input.apps.get("wechat", {}),
    init=(input.apps_init or {}).get("wechat"),
)
```

A missing key means a config bug — let `KeyError` surface; don't mask it with `.get()` or `or {}`.

---

## 10. Data source policy

Priority for fetching App data: **`getState()` runtime state > app offline data files > hard-coded constants**.

**Before defining a constant, check whether the data is already in `getState()`**. If it is (e.g., `recentPlays` / `likedSongs` / `contacts`), **never duplicate it as a Python module-level constant** — the copy will drift from the source.

Parameter sampling priority: **`source` > `sampler` > hard-coded `enum`**. Use `enum` only when the value domain is unrelated to environment data (e.g., a fixed enum like "last half year / last month").

---

## 11. Placeholder task marker

Tasks where the App functionality is incomplete must be marked with `note`:

```python
class CheckSesameCredit(AnswerTask):
    note = "App page not yet implemented; needs sesame-credit page"
```

**Don't** hard-code return values in `get_answer()` to fake content (`return "59"`). Answers must derive from `input.apps` / `input.os`.

---

## 12. Task docstring convention

A Task class docstring captures **design decisions that the code can't self-document**.

### 12.1 Write these

**1. Verdict: what counts as done, and why it can be judged correctly**

- **What is checked** — the success state in semantic terms ("WeChat new message contains the hotter city's name and its temperature")
- **Why it can be judged** (only when non-obvious) — the design point that disambiguates:
  - Phrasing disambiguation: "first" means the first item in the search result list
  - Parameter design: `{city}` is shared between weather and map, so consistency is intrinsic
  - Sampling constraint: sampled to guarantee two books have different ratings; comparison is unambiguous
  - Template anchor: the template fixes the note title, giving the judge a stable anchor
  - Branch design: state which branch maps to which expected content

**2. Data injection — only when the task needs preset env state**

- "Alipay balance is randomly placed at 80%–120% of ticket price to cover both branches"
- "Target video must be un-liked; otherwise the operation has no effect"
- "Route must have ≥2 high-speed trains, otherwise 'earliest' has no meaning"

### 12.2 Don't write these

- **The implementation path of the judgment** — `check_searched()` / `redbook.first_search_note(keyword).title` etc. belong with the code itself
- **Restating the template** — anything that can be read from the template
- **Generic design intent** — what's already inferable from class name and template

### 12.3 Examples

```python
# Simple task — name + template already self-explanatory
class WeatherSummaryToWechat(BaseTask):
    """Verdict: WeChat new message contains {city}'s current weather and temperature."""
    templates = ["查一下{city}现在天气怎么样，发给微信好友{contact}"]

# Disambiguation design
class WeatherFilterNonRainyDays(BaseTask):
    """The template fixes the note title '适合出行的日子' as a stable anchor for the judge.
    Verdict: note title matches; body contains every non-rainy date."""
    templates = ["查{city}未来五天天气，把不下雨的日期记在笔记里，标题写'适合出行的日子'"]

# Needs data injection
class RailwayPriceVsBalance(AnswerTask):
    """Verdict: the agent's 'enough'/'not enough' answer agrees with the actual comparison.
    Injection: random Alipay balance in 100–1000 to cover both branches."""
    templates = ["查{date}从{from}到{to}最便宜的高铁票多少钱，再看看支付宝余额够不够买"]
```

### 12.4 Rules

1. **Document only what the code can't self-document** — if the name + template + parameters explain it, don't add words
2. **State what and why, not how** — describe the success condition and the reason it's judgeable; don't restate `check_goals`
3. **Keep it short** — 1–5 lines. If the logic needs paragraphs of explanation, the task itself probably needs simplification
4. **Update the docstring when you change the task** — a stale docstring is worse than none

---

## 13. Common pitfalls

Every entry below comes from a real past bug.

### 13.1 Pipeline awareness: state may already be enriched

App state goes through `defaults.json → data/index.ts (enrichment) → store → bench_env state`. Many apps enrich records in `data/index.ts` or store actions (e.g., Alipay's `enrichTransferRecord` fills in `category` / `kind` / `displayTitle`), so those fields **already exist** in the state the judge sees.

**Typical mistake**: writing 80 lines of if-else regex in `app.py` to infer `category`, when `category` is already a field on the record.

**Rule**: before writing judge logic, check whether the target field is already present in `data/index.ts` or `state.ts`. **Read it directly; don't re-derive it in Python**.

### 13.2 `get_answer()` return type must match `match_value` and Agent phrasing habits

The Agent is a VLM — it reads the screen and replies in its own words. `match_value` has different semantics per type. If the two don't line up, judging is wrong.

| Pitfall | Wrong | Correct |
|---|---|---|
| Trailing zeros | `f"{total:.2f}"` → `"278.20"` | `f"{round(total, 2):g}"` → `"278.2"` |
| Month format | `"2026-01"` | `f"{year}年{month}月"` |
| Returns str instead of number | `return str(count)` | `return count` (int) |
| Time/duration via `match_value` | `build_answer_checks({"历时": "0小时59分"}, answer)` | Use `match_duration` / `match_time` in `check_goals` |

**Principle**: think from the Agent's perspective — how would it phrase the answer after seeing the screen? The return type of `get_answer()` must let `match_value` match reasonable variants.

### 13.3 CriteriaTask must ensure initial state ≠ target state

If `criteria`'s target value happens to equal the initial value in `defaults.json`, the task passes without the Agent doing anything.

| Scenario | Needs `_invert_criteria` |
|---|---|
| Target varies (toggle / enum parameter) | **Yes** |
| Target fixed, but equals initial value | **Yes** |
| Target fixed, initial value is already the opposite | No |

### 13.4 `expected_changes` must cover all side effects

Undeclared side effects cause `clean=False` warnings.

| Operation | Easily-missed fields |
|---|---|
| Viewing messages | `conversations.lastReadAt` |
| Transfer / payment | `transferDraft` / `transferReceipt` / `lastPaymentHint` |
| Search | `searchHistory` / `billSearchHistory` |
| Favorite / like | `favoriteIds` / `likedIds` |

**Rule**: run the task once in the UI, diff before vs. after, and add every changed path.

### 13.5 `_prepare()` must not hard-code data replacements

`_prepare()` exists to configure initial state when `defaults.json` defaults are insufficient. **It is not** a place to hard-code data to "control difficulty".

```python
# ❌ Defaults are fine; still injects a hard-coded copy
async def _prepare(self, env):
    await env.set_state({"apps": {"spotify": {"likedSongs": [
        {"id": "song_001", "artist": "周杰伦", ...},
        ...
    ]}}})

# ✅ Use defaults.json; if defaults are wrong, fix defaults.json
```

**Rule**:

1. Prefer the data already in `defaults.json`
2. If defaults don't fit, **stop and raise the issue** — change `defaults.json`, don't silently overlay hard-coded data in `_prepare()`
3. When injection truly is needed, push the schema-coupled construction down to a `prepare_state_with_*` helper in the corresponding `app.py`

### 13.6 Route criteria must account for query params

Routes often contain query params (e.g., `/chat?id=conv_p_10&type=person`); a hard-coded `criteria` of `"/chat"` fails.

**Rule**:

- If the task goal is not "navigate to a specific page", **do not put `route` in `criteria`** — the state change itself is enough
- If you do need a route check, confirm the actual route format and use an appropriate matcher

---

## 14. Final checklist

Use this checklist when adding or modifying a task. PR reviews compare against it.

### Design & base class

- [ ] **Merge vs split**: for multi-variant tasks, are the parameters orthogonal and under the same interaction? If params are coupled or interactions differ, split them.
- [ ] **Base class**: using the most suitable standard class? `CriteriaTask` / `AnswerTask` before `BaseTask`.
- [ ] **Declarative first**: anything expressible via `answer = ".path"` / `criteria = {"key": "value"}` is declared, not coded.
- [ ] **Class name**: accurately reflects the goal.
- [ ] **`objective` correct**: matches the actual behavior.

### Metadata

- [ ] **Four axes + capabilities**: `scope` / `objective` / `composition` / `difficulty` / `capabilities` all set.
- [ ] **Difficulty calibrated**: matches the Golden Steps range.
- [ ] **`capabilities` only core**: 1–4 entries; nav and other prerequisite steps not labeled.

### Template

- [ ] **Intent, not steps**.
- [ ] **No "view" without output**: only `query` tasks use "view"; `operate` uses "do this for me".
- [ ] **No answer leak**: `AnswerTask` templates don't carry answer params (`{phone}` / `{income}`).
- [ ] **`{param}` positioned**: rendered sentence reads naturally for bool with `values`.
- [ ] **L3/L4 has variants**: 2+ templates with identical expected answer content.

### CriteriaTask

- [ ] **`criteria` is a class variable** (not `@property`).
- [ ] **Parameterize with `"{param}"`**.
- [ ] **Value mapping via `values` dict** (no `_XXX_MAP`).
- [ ] **Array lookup uses `[field={param}]`** (no hand-written `check_goals`).
- [ ] **Parameter semantics match store** (no `not` to flip).
- [ ] **Initial state ≠ target**: toggle/enum tasks use `_post_sample` + `_invert_criteria`?

### AnswerTask

- [ ] **Prefer `answer` class var**: path / dict-of-paths / callable / literal.
- [ ] **`get_answer()` only when necessary**.
- [ ] **`get_answer()` returns ground truth, not judgment logic**.
- [ ] **Ties / synonyms use `re.Pattern`** (not a hard-coded string).
- [ ] **Answer-computation pushed into App answer methods** (one-line `get_answer()`).
- [ ] **Boolean queries**: detect negation before affirmation inside `check_goals`.
- [ ] **Date matching uses `date_match_labels(date, input.os)`** (pass `os_state` for relative dates).
- [ ] **Time/duration uses `match_time` / `match_duration`** (not `match_value` substring).
- [ ] **Don't validate non-answer content via `input.answer`** (messages/operations should check state).

### check_goals

- [ ] **Every check has `passed`**.
- [ ] **expected / actual are readable** (no `expected=True, actual=None`).
- [ ] **Only check Agent behavior** (no env preconditions or out-of-control conditions).
- [ ] **One semantic goal = one check** (don't split into field-level checks).
- [ ] **High-frequency patterns use App `check_*`** (task-specific logic stays inline).
- [ ] **Cover the template's implicit constraints** ("send to Moments" implies no image attachments).
- [ ] **`operate` tasks only check final state** (no mid-process checks; navigation tasks are an exception).
- [ ] **True dependencies fill placeholders in subsequent checks** (return list keeps a stable length).

### Judging reliability

- [ ] **Soundness**: wrong paths can't pass; no broad-keyword or weak-trace fields letting the Agent through.
- [ ] **Completeness**: reasonable rewordings or alternative completion paths can't fail; no binding to original title / full text / fixed phrasing.
- [ ] **Checkpoint reliability**: if checking an intermediate state, it must be both necessary for the task and stably observable.

### Error handling

- [ ] **App accessor raises `ValueError`** on missing data (no `""` / `None`).
- [ ] **Task has no data-validation boilerplate** (rely on App accessor errors).
- [ ] **Env-data issue → `raise`; Agent failure → `passed=False`**.

### Defensive coding

- [ ] **No `or {}`, no `.get("key", "")`, no `"无法判断"` fallback**.
- [ ] **Index `input.apps["xxx"]` directly** (no `.get()` / `or {}`).
- [ ] **No fallback returns in `get_answer()`**.

### Parameters

- [ ] **Prefer `source` over hard-coded `enum`**.
- [ ] **Upgrade to `sampler` for filtering / dedup**.
- [ ] **`source` path actually exists in `defaults.json`**.
- [ ] **Param values match the store**.
- [ ] **No module-level constants duplicating data already in `getState()`**.

### `_prepare` necessity

- [ ] **Prefer `defaults.json` defaults**.
- [ ] **If defaults are wrong, change `defaults.json`** — don't hard-code a replacement in `_prepare()`.
- [ ] **Necessary injections push down to App `prepare_state_with_*` helpers**.

### expected_changes

- [ ] **Path format correct** (single-app uses relative path; multi-app uses `appName.path`).
- [ ] **Covers every side effect** (verify by running the UI and diffing).
- [ ] **Constants defined in the corresponding `app.py`** (named `<APP>_<ACTION>_CHANGES`).

### Time API

- [ ] **Use `sim_today` / `sim_datetime`** (no `time.time()` / `date.today()` / `datetime.now()`).

### File responsibilities

- [ ] **tasks.py / defs/<Name>.py is clean**: no custom base classes, module-level helpers, App constants, or private compute methods.
- [ ] **New helpers live in `app.py`**: data methods / answer methods / `check_*` / `prepare_state_with_*` in their proper tier.
- [ ] **Cross-suite utilities live in `utils.py`**.

### Docstring

- [ ] **Task class has a docstring**.
- [ ] **States "what counts as done" and (when non-obvious) "why it's judgeable" + "what to inject"**.
- [ ] **Doesn't restate the template or describe `how`**.

### Tests

- [ ] **Each task has positive and negative cases** (see [`TESTING.md`](TESTING.md)).
- [ ] **AnswerTask positive `answer` is natural language** (not the raw ground truth).
- [ ] **Completeness check passes** (CI won't miss a new task).

### Grounded mode (only if `answer_fields` is declared)

- [ ] **Right field type**: prefer `choice` over `text`; pure numbers use `number`.
- [ ] **Right matcher**: `"time"` for time, `"date"` for date, `"duration"` for duration; otherwise auto by type.
- [ ] **Override `get_expected_response()` when `get_answer()` returns `re.Pattern`** — grounded mode needs exact values.
- [ ] **Override `get_expected_response()` when `get_answer()` returns a dict but `answer_fields` count doesn't match**.
- [ ] **repeatable field**: `get_expected_response()` returns `[[v1, v2, ...]]` (outer list = 1 entry, inner = full list).
- [ ] **hint cross-validates with check**: hint sample value must match both the task's natural expectation and what the check actually accepts.
- [ ] **Custom `check_goals` compatible with both modes**: in grounded mode, `input.answer` is the `", "`-joined AnswerSheet values.
- [ ] **Multi-field same-type false-positive risk**: such tasks shouldn't write custom `check_goals`; let the framework go via Path A.

See [`grounded-mode.md`](grounded-mode.md).

### Code-vs-docs

- [ ] **APIs referenced in examples / docs must exist** — every App method, constant, parameter referenced in an example must be findable in the matching `app.py`.

---

## Appendix: why custom base classes are banned

Historically, several suites (railway12306, bilibili, etc.) used custom base classes like `_RailwayBaseTask` / `_RailwayMixin` to deduplicate. They created three problems:

1. **Coupling propagated implicitly through the base** — changing one task could break others
2. **Tasks were no longer self-contained** — reading a single task required understanding the base
3. **Inconsistent abstraction levels** — some tasks went through the base, others didn't, drifting the convention

**Hard rule**: every task inherits one of `BaseTask` / `CriteriaTask` / `AnswerTask` / `VagueTask` / `SafetyTask` directly. To reduce duplication, push shared logic down into App `check_*` methods; don't introduce intermediate base classes.
