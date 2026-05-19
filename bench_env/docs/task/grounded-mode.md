# Grounded evaluation mode

> Companion docs: implementation workflow — [`IMPLEMENTATION.md`](IMPLEMENTATION.md); naming and forbidden patterns — [`CONVENTIONS.md`](CONVENTIONS.md).

## 1. Overview

Grounded evaluation uses the `AnswerSheet` app to turn the Agent's answer submission into **a precise UI-state-based judgment**, eliminating the false positives caused by fuzzy natural-language matching in text mode.

**Two evaluation modes coexist**:

- **grounded mode** (default, `--eval-mode grounded`): the Agent fills out a form in the AnswerSheet app; the framework reads UI state to judge
- **text mode** (`--eval-mode text`): the Agent calls `ANSWER` and its text is fuzzy-matched (`match_value`)

---

## 2. Architecture: two evaluation paths

In grounded mode, the runner picks a path based on the task's shape:

```
          Task has answer_fields?
                 │
            ┌────┴────┐
            │ No      │ Yes
            │         ▼
            │    Task has custom check_goals?
            │         │
            │    ┌────┴────┐
            │    │ No      │ Yes
            │    ▼         ▼
            │  Path A    Path B
            ▼
      text-mode fallback
      (task.evaluate)
```

### Path A: structured precise match (`build_grounded_checks`)

**When**: task has no custom `check_goals` (typical case: a pure `AnswerTask`).
Task must provide `get_expected_response` (the `AnswerTask` base class derives it from `get_answer()` by default).

**Behavior**:

1. Reads each form field from `answer_sheet` state in order
2. Calls `task.get_expected_response(input)` to get the expected value per field
3. Uses `_match_grounded_field` to **match field-by-field** (exact / number / date / time)
4. **Does not call** `check_goals`

**Advantage**: per-field isolated matching — no cross-field value contamination.

### Path B: hydrate `input.answer`

**When**: task has a custom `check_goals` (whether `AnswerTask` or `BaseTask`).

**Behavior**:

1. Reads every field value from `answer_sheet` state
2. Joins values with `", "` into a single string and injects it as `input.answer`
3. Calls `task.evaluate()` → goes through the normal `check_goals` judging

**Advantage**: preserves custom judging logic (e.g., checking state changes and answer correctness together).

### Decision (runner code)

```python
# Walk the MRO to find the class that actually defined check_goals
_cg_definer = next(
    (c for c in type(task).__mro__ if "check_goals" in c.__dict__), BaseTask
)
# BaseTask (empty impl) and AnswerTask (answer-only matcher) don't count as custom
has_custom_cg = _cg_definer not in (BaseTask, AnswerTask)

if not has_custom_cg:
    # Path A: structured precise match
    build_grounded_checks(task, judge_input, sheet_state)
else:
    # Path B: hydrate input.answer (requires submitted=True)
```

> **Note**: walking the MRO ensures `check_goals` defined on intermediate base classes (e.g., `CriteriaTask`) is not skipped.
> Path B also checks the `submitted` flag — answers are not injected if the Agent never tapped Submit.

---

## 3. Adding Grounded support to a task

### 3.1 Pure-query task (AnswerTask, no custom check_goals)

Just add `answer_fields`; the framework handles the rest:

```python
class CountAlarms(AnswerTask):
    answer = (".alarms", len)
    answer_fields = [{"type": "number", "label": "Number of alarms"}]
    # → Goes via Path A; get_expected_response is auto-derived from get_answer()
```

**Multi-field task**: when `get_answer()` returns a dict, the default `get_expected_response` unpacks the values in dict order. The order of `answer_fields` **must match the dict key order**:

```python
class QueryFirstEvent(AnswerTask):
    def get_answer(self, input):
        return {"title": "周会", "time": "14:30"}  # dict with 2 keys
        # → get_expected_response auto-returns ["周会", "14:30"]

    answer_fields = [
        {"type": "text", "label": "日程标题", "hint": "e.g. 周会"},                              # ← title
        {"type": "text", "label": "开始时间", "hint": "e.g. 14:30", "matcher": "time"},  # ← time
    ]
```

**Field type that varies with a parameter**: when the task's `field` parameter has enum values that mix text and numeric fields, you can't declare both types in a class-level `answer_fields`. Make `answer_fields` a `@property` and return dynamically based on `self.p.field`:

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
        # Reverse-look-up the enum to get the human label; avoid showing internal keys ("likes" etc.)
        label = next(
            (k for k, v in self.parameters["field"]["values"].items() if v == field_val),
            field_val or "",
        )
        t = "number" if field_val in self._NUMERIC_FIELDS else "text"
        return [{"type": t, "label": label}]
```

**Notes**:
- A `@property` is fully compatible with framework access points like `getattr(task, "answer_fields", None)` — no framework changes required.
- The `label` must come from a reverse lookup on the enum `values`, not a `"{field}"` template — the `{field}` placeholder resolves to the internal value (e.g., `"likes"`), not the human label.
- `getattr(self.p, "field", None)` guards against `AttributeError` when `self.p` isn't initialized yet.
- mypy/pyright will warn about a `ClassVar` overridden by `@property` — silence with `# type: ignore[override]`.

**When you must override `get_expected_response`**: when `get_answer()` returns an `re.Pattern` (fuzzy matching), grounded mode requires exact values:

```python
class CompareCityTemp(AnswerTask):
    answer_fields = [{"type": "choice", "label": "Hotter city",
                      "options": ["{city1}", "{city2}", "Tied"]}]

    def get_answer(self, input):
        # text mode: may return re.Pattern
        return re.compile(r"一样|相同|差不多")

    def get_expected_response(self, input):
        # grounded mode: must return an exact value
        return ["Tied"]
```

**Another override case**: `get_answer()` returns a `dict` but `answer_fields` has only one field. The default implementation unpacks dict values into multiple expected values, so **the field count and value count won't match**:

```python
class CheckDetailCard(AnswerTask):
    answer_fields = [{"type": "text", "label": "Result"}]  # 1 field

    def get_answer(self, input):
        return {"dir": "东风", "scale": "3"}
        # ⚠️ default get_expected_response returns ["东风", "3"] — 2 values!

    def get_expected_response(self, input):
        answer = self.get_answer(input)
        if isinstance(answer, dict):
            return [f"{answer['dir']}{answer['scale']}级"]  # → ["东风3级"]
        return [str(answer)]
```

**Repeatable variant**: when `get_answer()` returns a dynamically-sized dict (each entry is one list element) and `answer_fields` is a single `repeatable` field, override as well. `get_expected_response` must return `[[v1, v2, ...]]` — the outer list has 1 element (matching the 1 field), and the inner list contains the repeatable values:

```python
class ReadTodoText(AnswerTask):
    answer_fields = [{"type": "text", "label": "Todos", "repeatable": True, "compare": "set"}]

    def get_answer(self, input):
        # text mode: dict for build_answer_checks to match slot-by-slot via containment
        notes = Notes(input.apps["notes"])
        return {f"todo_{i+1}": str(t.get("text") or "") for i, t in enumerate(notes.incomplete_todos)}
        # ⚠️ default get_expected_response returns ["buy groceries", "do laundry", ...] — N values, but only 1 field!

    def get_expected_response(self, input):
        # grounded mode: 1 field + repeatable → outer 1 element, inner the full list
        notes = Notes(input.apps["notes"])
        return [[str(t.get("text") or "") for t in notes.incomplete_todos]]
```

### 3.2 Task with a custom `check_goals` (AnswerTask or BaseTask)

Just add `answer_fields` (with `hint`); the existing `check_goals` reads the injected value via `input.answer`:

```python
class RailwayDestWeatherQuery(AnswerTask):
    answer_fields = [
        {"type": "text", "label": "Conditions", "hint": "e.g. Sunny"},
        {"type": "text", "label": "High temp",  "hint": "e.g. 23°"},
        {"type": "text", "label": "Low temp",   "hint": "e.g. 15°"},
    ]

    def check_goals(self, input):
        # In grounded mode, input.answer = "Sunny, 23°, 15°" (joined AnswerSheet values)
        # In text mode, it's the Agent's natural-language answer
        answer_text = str(input.answer or "")
        ...
```

> **Key point**: matching logic inside `check_goals` must accept the AnswerSheet's compact joined format.
> Use `hint` to guide the Agent toward a format `check_goals` can match.

### 3.3 Hybrid task (operate + query)

Same as 3.2. `check_goals` checks both state changes and the answer:

```python
class FavVideoAndCountTask(BaseTask):
    answer_fields = [{"type": "number", "label": "Items in favorites"}]

    def check_goals(self, input):
        app = Bilibili(input.apps["bilibili"])
        return [
            app.check_favored(title),                              # state check
            *build_answer_checks(count, input.answer),             # answer check
        ]
```

### 3.4 Custom question text

`answer_fields` can also take a dict form with a `question` field, which sets the **question text displayed at the top of the AnswerSheet**:

```python
class MakeupDayReminder(BaseTask):
    templates = ["帮我看看{holiday}需不需要补班"]
    answer_fields = {
        "question": "今年{holiday}需要补班吗？",
        "fields": [
            {"type": "choice", "label": "Need to work that day?",
             "options": ["Yes, work that day", "No"]},
        ],
    }
```

**Two pieces of text, two roles**:

| Text | Source | Audience | Purpose |
|---|---|---|---|
| Agent instruction | `task.description` (= rendered templates + AnswerSheet suffix) | Agent | Tells the Agent what to do |
| AnswerSheet question | `question` (dict form) or falls back to `task.description` | AnswerSheet UI | What the Agent sees when opening the AnswerSheet |

**Use case**: when the task description contains operational instructions ("do XX for me… and tell me…") and is not a great prompt for the AnswerSheet form, use `question` to give a cleaner restatement.

**Resolution logic** (`Controller.setup`):

```python
question = task._resolve_answer_question() or task.description
# dict form has question → use it (supports {param} templates)
# list form has no question → fall back to task.description
```

---

## 4. `answer_fields` reference

### 4.1 Field types

| `type` | Description | UI control | Default matcher |
|---|---|---|---|
| `text` | Free text | Text input | `exact` |
| `number` | Number | Numeric input | `number` |
| `choice` | Single choice (needs `options`) | Selection list | `exact` |

**How to pick a field type**:

| Answer shape | Type | Example |
|---|---|---|
| One value from a finite set | `choice` | Hotter city (A/B/tied), yes/no |
| Pure number | `number` | Alarm count, contact count, price |
| Open text | `text` | Event title, weather description, address |
| Unknown count (0..N items) | `text` + `repeatable` | List all matching cities |

**Selection priority**: `choice` > `number` > `text`. Prefer `choice` over `text` when possible — picking from buttons is less error-prone than typing, and evaluation is more precise (no format ambiguity).

**When to use `repeatable`**: when the answer is a list of variable length (e.g., "which days will it rain", "temperature for each city"), declare `text`/`number` + `repeatable: true`; the Agent can add entries one by one. Combine with `compare: "set"` to ignore order.

### 4.2 Optional attributes

**UI rendering attributes** (used by both paths; determine how the AnswerSheet renders):

| Attribute | Type | Description |
|---|---|---|
| `label` | `str` | Field label (supports `{param}` templates) |
| `hint` | `str` | Placeholder (e.g. `"e.g. 14:30"`) |
| `options` | `list[str]` | Options for `choice` (supports `{param}`) |
| `repeatable` | `bool` | Allow multiple values |

**Task-level attributes** (declared on the Task class, not per-field):

| Attribute | Type | Description |
|---|---|---|
| `answer_hint` | `str` or `None` | Global hint at the top of the AnswerSheet (shown below the question) |

**Evaluation attributes** (Path A `build_grounded_checks` only; ignored on Path B):

| Attribute | Type | Description |
|---|---|---|
| `matcher` | `str` | Matcher override: `exact` / `number` / `date` / `time` / `duration` |
| `compare` | `str` | Comparison mode for repeatable fields: `sequence` (default) / `set` (order-insensitive) |

### 4.3 Matchers in detail

All matchers are dispatched through `_match_grounded_field()` (`common_tasks.py`). When `matcher` is unspecified, the framework picks a default based on `type` (`text`/`choice` → `exact`, `number` → `number`).

| Matcher | Function / logic | Typical use |
|---|---|---|
| `exact` | `normalize_text(actual) == normalize_text(expected)` | City names, book titles, choice options |
| `number` | `math.isclose(float(actual), float(expected))` | Counts |
| `date` | `date_match_labels()` (`utils.py`) | Dates |
| `time` | `match_time()` (`common_tasks.py`) | Time of day |
| `duration` | `match_duration()` (`common_tasks.py`) | Durations |

**`exact`** — precise match (default)

Implemented inline in `_match_grounded_field`. Both sides are `strip()`+`normalize_text()` (Chinese-numeral → Arabic-numeral normalization) then compared with `==`.

```
expected = "北京"  actual = " 北京 " → normalize → "北京" == "北京" → ✓
expected = "北京"  actual = "上海"   → ✗
```

**`number`** — numeric match

Implemented inline. `math.isclose(float(actual), float(expected), rel_tol=1e-6, abs_tol=1e-9)`.

```
expected = 3       actual = "3"   → float("3") == 3.0 → ✓
expected = 3       actual = "3个" → float("3个") → ValueError → ✗
```

> ⚠️ `actual` is passed to `float()` directly; numbers are not extracted from surrounding text. The Agent must fill in a bare number.

**`date`** — date-equivalence match

Calls `bench_env.task.utils.date_match_labels(expected, os_state)` to generate every valid representation (`"4月6日"` / `"4月6号"` / `"04-06"` / `"周一"` / `"明天"` etc.); `normalize_text(actual)` hitting any of them passes. Relative dates are computed off the OS simulated time (`os_state`).

```
expected = "2026-04-06"  actual = "4月6日"  → ✓
expected = "2026-04-06"  actual = "明天"    → ✓ (when sim time is 4/5)
expected = "2026-04-06"  actual = "周一"    → ✓ (when 4/6 actually is Monday)
```

**`time`** — time-of-day match (±5 min tolerance)

Calls `match_time(expected, actual, tolerance_minutes=5)` (`common_tasks.py`). Normalizes to `(hour, minute)`; supports `HH:MM`, `H点M分`, `上午/下午/凌晨` prefixes; handles midnight wraparound.

```
expected = "14:30"  actual = "下午2点30分" → (14,30) vs (14,30) → ✓
expected = "09:54"  actual = "9:58"        → diff=4min ≤ 5 → ✓
expected = "09:54"  actual = "10:02"       → diff=8min > 5 → ✗
```

**`duration`** — duration match

Calls `match_duration(expected, actual)` (`common_tasks.py`). Normalizes to total minutes; supports `X小时Y分`, `Z分钟`, `H:MM`, etc.

```
expected = "1小时30分"  actual = "90分钟"  → 90 == 90 → ✓
expected = "0小时59分"  actual = "59分"    → 59 == 59 → ✓
expected = "2小时15分"  actual = "2:15"    → 135 == 135 → ✓
```

### 4.4 Hint convention

Each field type has a **default placeholder** (used when `hint` is not specified):

| `type` | Default placeholder |
|---|---|
| `text` | "Please enter" |
| `number` | "Please enter a number" |
| `choice` | (none — buttons are self-explanatory) |

**No custom hint needed**:

- `number` — default placeholder already requires a numeric input
- `choice` — option buttons themselves are the hint; the Agent just taps

**Custom hint needed**: for `text` when the answer format is non-obvious; the `hint` should provide a **typical example value** to guide formatting:

```python
{"hint": "e.g. Sunny"}     # weather
{"hint": "e.g. 23°"}        # temperature
{"hint": "e.g. 14:30"}      # time
{"hint": "e.g. 233 元"}     # price
{"hint": "e.g. 三体"}       # book title
```

**Cross-validating hint against the check logic**:

A hint is more than a UI prompt — it's the meeting point of **task semantics** and **evaluation logic (the check)**. When writing a hint, review both sides instead of blindly matching the check's format:

1. **Start from task semantics**: what's being asked? What format would the user (the Agent) naturally use?
2. **Look at the check**: what does `get_answer()` / `get_expected_response()` return? How does `matcher` or `check_goals` match?
3. **Cross-validate**: are they consistent? Can the hint's example value both be matched by the check and read naturally as an answer?

**If you find a mismatch, treat it as a potential check bug — don't silently bend the hint to the check's format.** Common mismatches:

| Scenario | Task semantics | Check actually does | Issue |
|---|---|---|---|
| "Meeting start time" | May include date + time | `get_answer` returns just `"14:30"` | Did the check drop the date? Depends on context — if multiple meetings of the same name happen on the same day, time alone isn't unique |
| "Price" | Includes a unit like "233 元" | `exact` matcher compares strings | Does `get_answer` return `"233"` or `"233 元"`? Mismatch causes false negatives |
| "Total duration" | Natural answer "1 hour 30 min" | `number` matcher expects a bare number | Pin the Agent to `90` by writing the label "Total duration (minutes)", or use the `duration` matcher to accept natural phrasing? |

> ⚠️ **Principle: the hint reflects the task's natural format; the check must accept that format.** If the check can't match the task's natural format, the check is the bug — not the hint. Report and fix the check logic when you find these.

---

## 5. Path B caveats

### 5.1 Hydrate joining format

Multiple AnswerSheet field values are joined with `", "` and injected as `input.answer`:

```
field 0 = "Sunny", field 1 = "23°", field 2 = "15°"
→ input.answer = "Sunny, 23°, 15°"
```

### 5.2 False-positive risk with same-typed multi-field values

When multiple fields share the same value type (e.g., two temperature fields), substring matching in `check_goals` may incorrectly accept a swapped fill.

**Example**: expected high=23° / low=15°; Agent fills high=15° / low=23°.

- `input.answer = "15°, 23°"`
- `has_close_number("15°, 23°", 23)` → matches 23 → True (false positive!)

**Recommended**: for tasks with this risk, don't write a custom `check_goals` — let the framework go via Path A for per-field precise matching.

**Not recommended**: if you must keep a custom `check_goals` (e.g., to also check state changes), read the AnswerSheet's structured values in grounded mode:

```python
def check_goals(self, input):
    checks = [self._check_state(input)]  # state check
    sheet = input.apps.get("answer_sheet", {})
    answers = sheet.get("answers", {})
    if answers:
        # grounded mode: read by field index
        high = answers.get("0", "")
        low = answers.get("1", "")
        checks.append({"field": "high", "passed": has_close_number(high, expected_high), ...})
        checks.append({"field": "low",  "passed": has_close_number(low, expected_low), ...})
    else:
        # text mode: match from the joined text
        checks.extend(self._match_from_text(input.answer))
    return checks
```

> ⚠️ This couples `check_goals` to the evaluation mode and raises maintenance cost. Only use when unavoidable.

### 5.3 `check_goals` must accept both modes

`check_goals` runs in both text mode and grounded mode (Path B). Make sure the matching logic accepts:

- **text mode**: `input.answer` is the Agent's natural-language reply
- **grounded mode**: `input.answer` is the `", "`-joined AnswerSheet values

Loose matching such as `xxx in answer_text` or `has_close_number(answer_text, expected)` usually accepts both.

### 5.4 The Submit button is a toggle

The AnswerSheet's Submit button is a submit/unsubmit toggle. The Agent can submit, edit, and submit again. Evaluation reads the **final state**:

- `submitted = True` + correct answer → pass
- `submitted = False` (even with a correct answer) → fail (both Path A and Path B check `submitted`)

> The Agent must leave the AnswerSheet in a submitted state. If it edits after submitting and forgets to re-submit, evaluation will fail.

---

## 6. Framework guarantees

### 6.1 Side-effect isolation

`BaseTask.always_ignore` includes `apps.answer_sheet` globally, so AnswerSheet state changes (field edits, submission, etc.) **are not counted as unexpected side effects**. Tasks need not declare AnswerSheet paths in `expected_changes`.

### 6.2 Automatic step budget bump

In grounded mode, `RunnerConfig.get_max_steps()` automatically adds 15 steps for tasks with `answer_fields` (for opening the AnswerSheet, filling, and submitting). Tasks don't need to tune `max_steps`.

### 6.3 Auto-appended instruction

`Controller.setup` automatically appends an AnswerSheet hint to `task.task_name`:

```python
task.task_name = task.description + " then open the AnswerSheet app, enter the answer, and submit"
```

So the Agent sees something like: `"check whether tomorrow needs make-up work then open the AnswerSheet app, enter the answer, and submit"`. **Task templates need not mention the AnswerSheet** — the framework appends it.

---

## 7. Developer checklist

- [ ] **Declare `answer_fields`**: did the query / hybrid task declare it? Types and labels accurate?
- [ ] **Hint cross-validation**: for `text` fields, did you provide a format example? Does the hint example satisfy both the **task's natural semantics** and what the **check actually accepts**? If they conflict, file it as a check bug.
- [ ] **Matcher override**: `time` for time fields, `date` for dates, `duration` for durations.
- [ ] **`get_expected_response`**: overridden when `get_answer()` returns `re.Pattern`? Overridden (with merging) when it returns a dict but `answer_fields` has fewer entries than dict keys?
- [ ] **`check_goals` mode compatibility**: for tasks with a custom `check_goals`, does the matching logic accept the AnswerSheet's compact joined format?
- [ ] **Multi-field risk**: do multiple same-typed fields risk cross-contamination? If so, are you reading `answer_sheet.answers` structured values directly?
