# bench_env task implementation guide

> This is the **general workflow** for writing a bench_env task — auditing the App, writing app.py helpers, then writing the task class.
>
> Companion docs:
> - Naming / forbidden patterns / final checklist: [`CONVENTIONS.md`](CONVENTIONS.md)
> - Test conventions: [`TESTING.md`](TESTING.md)
> - Grounded evaluation (`answer_fields`): [`grounded-mode.md`](grounded-mode.md)
> - Framework architecture and lifecycle: [`../FRAMEWORK.md`](../FRAMEWORK.md)
> - Types / CLI / path expressions / action maps: [`../REFERENCE.md`](../REFERENCE.md)

---

## 0. What a complete task looks like

This is the **reference implementation** for this doc. Subsequent sections refer back to specific lines here.

```python
# bench_env/task/wechat/defs/SendCodeToFriend.py
from __future__ import annotations
from typing import Any

from bench_env.task import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.wechat.app import (
    Wechat,
    WECHAT_CONTACT_PARAM,
    WECHAT_SEND_CHANGES,
)


class SendCodeToFriend(BaseTask):
    """Verdict: WeChat new message goes to {contact} and contains the 6-digit code {code}."""

    # ---- Template & apps ----
    templates = ["向「{contact}」发送验证码 {code}"]
    apps = ["wechat"]

    # ---- Metadata ----
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["social"]

    # ---- Parameters ----
    parameters = {
        "contact": WECHAT_CONTACT_PARAM,                              # Reuse shared param from app.py
        "code": {"type": "string", "pattern": r"\d{6}", "default": "123456"},
    }

    # ---- Side-effect declaration ----
    expected_changes = WECHAT_SEND_CHANGES

    # ---- Verdict ----
    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            wechat.check_new_sent_contains(
                self.p.contact, self.p.code, field="verification_code",
            ),
        ]
```

A task file does only four things: **declare templates/metadata, declare parameters, declare side effects, call App helpers**. Every data lookup, aggregation, and schema-coupled verification lives in `wechat/app.py` — `WECHAT_CONTACT_PARAM`, `WECHAT_SEND_CHANGES`, and `Wechat.check_new_sent_contains()` referenced here are all real helpers in `task/wechat/app.py`.

> **When do you need `_prepare`?**: the example above has none, because the default `defaults.json` already has contacts for `WECHAT_CONTACT_PARAM` (backed internally by `Wechat.sample_friend_name`) to sample. You only add `_prepare` when the sampler needs specific seeded data (e.g., "task requires a contact who has unread messages") — call the corresponding App's `prepare_state_with_*` helper. See §5.6.

The general workflow for a new task is: audit the App (§1) → fill in missing helpers in app.py (§2) → choose `tasks.py` or `defs/` (§3) → write the task class (§4) → tune sampling (§5).

---

## 1. Step 1: audit the App's features and data interface

Before writing anything, you must understand **what the App can do**, **what's readable from state**, **and what helpers already exist**. Skipping the audit is like writing exam questions from memory.

### 1.1 Files to read

| Source | What to look for |
|---|---|
| `apps/<AppDir>/navigation.declaration.ts` | All routes, UI states, action IDs (for `optimal_paths`, `criteria.route`) |
| `apps/<AppDir>/data/defaults.json` | Default data entries (sampling-pool size, field completeness) |
| `apps/<AppDir>/data/index.ts` / `state.ts` | **Fields derived by enrichment / store actions** (usable for judging) |
| `apps/<AppDir>/types.ts` | state schema |
| `bench_env/task/<suite>/app.py` | Existing data methods / answer methods / `check_*` methods |

> ⚠️ **Pipeline awareness**: state passes through `defaults.json → data/index.ts (enrichment) → store → bench_env state`. Many fields are already derived during enrichment (e.g., Alipay's `category`, `displayTitle`). **Before writing judge logic, check whether the target field already exists** — read what's there; don't re-derive in Python.

### 1.2 List CRUD capabilities

Group the App's operations into **C/R/U/D + Q (query)** and mark which can be reliably judged from state:

```
Wechat:
  C  send message → new entry in chats[].messages    ✓ judgeable
  C  post moment  → new entry in moments             ✓ judgeable
  U  rename       → user.profile.nickname            ✓ judgeable
  U  blacklist    → contacts[wxid=X].isBlacklisted   ✓ judgeable
  D  delete chat  → chats shrinks                    ✓ judgeable (diff)
  Q  contact count                                   ✓ judgeable (.contacts len)
  -  scroll Moments feed                             ✗ no stable state trace
```

The **judgeable-capability list** drives every later judging decision — only capabilities you can stably derive from state are usable for tasks.

### 1.3 Data sufficiency check

| Check | Signal of insufficiency | Action |
|---|---|---|
| Collection size | Want "compare 3 cities" but `savedCities` has 2 | Extend `defaults.json` or change to "add first, then compare" |
| Variety | Only 3 contacts; can't sample variants | Add more entries |
| Field completeness | Want "yesterday's earnings" but `defaults.json` lacks the field | Add the field first, then design the task |

**Principle**: task design isn't only about what the UI can do — data must support it. Prefer extending `defaults.json`; do not jam a hard-coded copy into `_prepare()` that drifts from defaults (see §5.6 / `_prepare` discipline).

### 1.4 Cross-app suite specifics

A cross-app suite (`task/crossapp_life/` etc.) **has no state of its own**. All data comes from the individual Apps.

| Difference | Single-app suite | Cross-app suite |
|---|---|---|
| `app.py` | Required; subclass `BaseApp` | **Usually omitted**; create one only when there's suite-private logic that doesn't belong to any single App |
| Source of `check_*` | This suite's App class | Each individual App's class |

**Core rules**:

1. **Reuse the individual Apps' existing `check_*` / data / answer methods**. A cross-app task's `check_goals()` instantiates several individual App classes, calls their methods, and only composes / branches on top.
2. **Missing check methods go in the appropriate individual App's `app.py`**, not inline in the cross-app `tasks.py`. That way every App's verification logic stays in one place and is reusable by single-app tasks.
3. **Add the helper first, then write the task** — never "inline now, refactor later".

---

## 2. Step 2: write helpers in app.py

After auditing, **fill in helpers in `app.py` before writing the task**. Task classes compose; they don't compute.

### 2.1 Three-tier App helpers

Each App class (subclass of `BaseApp`) provides three tiers, each built atop the previous:

```
Data methods (return raw data)
   ↓
Answer methods (return values the judge can use directly)
   ↓
Check methods (return a standard check dict)
```

Plus a separate setup-helper category (`prepare_state_with_*`) for schema-coupled state mutation.

> **App class naming**: matches `manifest.id`, PascalCase, **without** an `App` suffix (`Wechat`, not `WechatApp`; `Railway12306`, not `RailwayApp`).

### 2.2 Data methods (raw data)

**Encapsulate**:

- Multi-step lookups (callers shouldn't care about intermediate steps): `last_text_to(contact)` internally does wxid lookup → chat match → message filter
- Structurally complex reads (with fallback / fuzzy matching / type coercion + validation): `find_contact_wxid(name)`, `current_temp(city)`
- Clean data aggregation: `monthly_expense(month)`, `count_rainy_days(days)` — **even if only one task uses it now**, anything involving traversal or aggregation belongs in the App class
- init vs. current diffs (generic comparison): `new_alarms()`, `removed_alarm_ids()`

**No need to wrap** (use `app.get()` directly):

- Path is the semantics already; no structural complexity: `app.get("settings.darkMode")`
- Single-layer attribute read without validation/coercion

**Decision criterion**: wrapping is justified by **hiding structural complexity or providing validation**, not by giving a field a nicer name.

**Missing data must raise**:

```python
class Map(BaseApp):
    def place_address(self, name) -> str:
        place = self._find_place(name)
        if not place:
            raise ValueError(f"Place {name!r} not found in state")
        return place["address"]
```

Don't silently return `""` or `None` and force the task to guess — see the error-handling rules in [`CONVENTIONS.md`](CONVENTIONS.md) §4.

### 2.3 Answer methods (judge-ready answers)

Answer methods build on data methods, **converting raw data into a value `get_answer()` / `check_goals()` can use directly**. Difference:

- **Data methods** return raw data (a temperature value, a date string)
- **Answer methods** return formatted judge-ready answers (with tie regex, unit conversion, synonym coverage, etc.)

**Naming convention**: `<action>_answer` or `<scenario>_answer`.

```python
class Weather(BaseApp):
    def hotter_city(self, c1, c2) -> tuple[str, float, float]:
        """Data method: returns (winner, temp1, temp2)."""
        ...

    def hotter_city_answer(self, c1, c2) -> str | re.Pattern:
        """Answer method: judge-ready, handles ties."""
        winner, _, _ = self.hotter_city(c1, c2)
        if winner == "一样":
            return re.compile(r"一样|相同|差不多")
        return winner

# task's get_answer() becomes a one-liner
class CompareCityTemp(AnswerTask):
    def get_answer(self, input):
        return Weather(input.apps["weather"]).hotter_city_answer(
            self.p.city1, self.p.city2,
        )
```

**Design rules**:

1. Return type must align with `match_value` semantics (`int` / `float` / `str` / `re.Pattern` / `dict`)
2. **Ties or synonyms must return `re.Pattern`** — never a hard-coded string
3. Every computation that `get_answer()` would do should live in an answer method — `get_answer()` is a single call
4. **No judgment decisions** — answer methods say "what the correct answer is", not "did the Agent answer correctly"

### 2.4 Check methods (return a standard check dict)

**All schema-coupled verifications must be wrapped as `check_*` methods**. `check_goals()` only composes these atomic checks and handles task-specific branching (conditional logic, answer assembly).

```python
# A real method from task/wechat/app.py
class Wechat(BaseApp):
    def check_new_sent_contains(
        self, contact_name: str, *keywords: str, field: str | None = None,
    ) -> dict[str, Any]:
        """Verify newly-sent messages (joined) contain every keyword."""
        if field is None:
            field = f"sent_to_{contact_name}"
        joined = self.joined_new_texts_to(contact_name)   # reuse data method
        passed = bool(joined) and all(kw in joined for kw in keywords)
        return {
            "field": field,
            "expected": f"new msgs to '{contact_name}' with {list(keywords)}",
            "actual": joined[:200] or "(none)",
            "passed": passed,
        }
```

**Design rules**:

1. **Return a single `dict`**, not `list[dict]` — list assembly is `check_goals()`'s job
2. **Use `*keywords` / named params instead of predicate lambdas** — call sites self-document
3. **`field` has a semantic default; callers can override** — single-call uses default; when `check_goals()` calls the same method multiple times, pass `field=` to distinguish them (otherwise reports can't pinpoint failures)
4. **Method name is self-documenting** — `wechat.check_new_sent_contains(contact, title)`, not `wechat.check(contact, title, mode="sent")`
5. **Positive/negative state via `expected`** — `check_following(name, expected=False)` means "unfollow"; avoid one method per reverse operation

### 2.5 init vs. current, and CRUD check strategies

How a `check_*` method is written depends on the **operation type**. CRUD operations each have exactly one correct check strategy — it's not a choice; it's derivation.

| Operation | Check strategy | Why only this works |
|---|---|---|
| **Create** | **diff**: find a match in `current \ init` | Without diff, you can't distinguish "what the Agent added" from "what was already there" |
| **Delete** | **diff**: target ID in `init \ current` | Without diff, you can't distinguish "what the Agent deleted" from "what never existed" |
| **Modify** | **identify in init, verify in current** | After modification the content has changed; only init can reliably locate the target |
| **Query** | **read init**: read the expected answer from init | The answer was fixed at task setup; the Agent's behavior doesn't change it |

#### Create

```python
class Clock(BaseApp):
    def check_created_alarm(self, h, m, **attrs) -> dict:
        # Sampler contract: target must not already exist in init
        assert self.init.find_alarm_by_time(h, m) is None
        # Agent-behavior verdict: find a match in the newly-added items
        match = next(
            (a for a in self.new_alarms()
             if int(a["hour"]) == h and int(a["minute"]) == m
             and all(str(a.get(k)) == str(v) for k, v in attrs.items())),
            None,
        )
        return {
            "field": "alarm_created",
            "expected": {"h": h, "m": m, **attrs},
            "actual": match,
            "passed": match is not None,
        }
```

#### Delete

Why not `find_by_id(x) is None` directly against current? **If the sampler has a bug (the target never existed)**, that check returns None → `passed=True` — a **false positive**. Diff returns `passed=False` instead (a safe false negative), and combined with the sampler-contract assert, the bug becomes a `judge_error`.

```python
def check_deleted_alarm(self, alarm_id) -> dict:
    assert self.init.find_alarm_by_id(alarm_id) is not None   # sampler contract
    removed = self.removed_alarm_ids()   # init IDs - current IDs
    return {"field": "alarm_deleted", "expected": alarm_id,
            "actual": removed, "passed": str(alarm_id) in removed}
```

#### Modify

```python
def check_alarm_fields(self, hour, minute, **expected) -> dict:
    # Identify in init
    init_alarm = self.init.find_alarm_by_time(hour, minute)
    assert init_alarm is not None   # sampler contract
    alarm_id = init_alarm["id"]

    # Verify in current
    alarm = self.find_alarm_by_id(alarm_id)
    if alarm is None:
        # Agent deleted the alarm instead of modifying it — a legitimate Agent failure
        return {"field": f"alarm_{alarm_id}", "expected": expected,
                "actual": None, "passed": False}
    passed = all(str(alarm.get(k)) == str(v) for k, v in expected.items())
    return {"field": f"alarm_{alarm_id}", "expected": expected,
            "actual": {k: alarm.get(k) for k in expected}, "passed": passed}
```

`alarm is None → passed=False` is **not** defensive coding — it's a legitimate verdict about Agent behavior. If you wrote `alarm["hour"]` and let it raise, you'd mis-attribute the Agent's failure as a `judge_error`.

#### Query

Query doesn't need an explicit assert — dereferencing init naturally raises `TypeError` and that's already a `judge_error`:

```python
def get_answer(self, input):
    # alarm doesn't exist → TypeError propagates → judge_error ✓
    return Clock(input.apps_init["clock"]).find_alarm_by_id(self.p.alarm_id)["note"]
```

#### App instance construction rules

```python
# Create / Delete / Modify: needs both states
clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
clock.alarms              # current
clock.init.alarms         # init
clock.find_alarm_by_id(x)        # lookup in current
clock.init.find_alarm_by_id(x)   # lookup in init

# Query: init only
clock = Clock(input.apps_init["clock"])
```

#### Why sampler-contract asserts exist

**Asserts aren't there to re-verify the upstream — they exist to keep attribution correct.** Without them, sampler bugs are silently blamed on the Agent:

| Operation | Sampler bug | Without assert | With assert |
|---|---|---|---|
| Create | Target already exists | diff is empty → `passed=False` (blames Agent) | `AssertionError` → `judge_error` ✓ |
| Delete | Target not in init | not in removed → `passed=False` (blames Agent) | `AssertionError` → `judge_error` ✓ |
| Modify | Target not in init | lookup returns None → `passed=False` (blames Agent) | `AssertionError` → `judge_error` ✓ |
| Query | Data missing | Natural TypeError → `judge_error` ✓ | No assert needed |

**Put the assert in the App's `check_*` method**, not in the task's `check_goals()` — task code stays a one-liner.

#### Attribution summary

| Scenario | Attribution | Mechanism |
|---|---|---|
| Agent did nothing / wrong thing | `passed=False` | CRUD check logic |
| Sampler bug (precondition violated) | `judge_error` | assert inside the check method |
| App data structure corrupted | `judge_error` | Type checks in property layer |
| Query init data missing | `judge_error` | Natural dereference TypeError |
| Bug in judge code itself | `judge_error` | Framework-wide try/except |

**Iron rule**: `passed=False` only appears in verdicts the Agent can influence. Any non-Agent failure must take the exception path and become `judge_error`.

### 2.6 Reliability requirements for checks

Every `check_*` method and `check_goals()` must satisfy:

1. **No false positives on wrong paths** — passing must prove the goal is met; you can't rely on broad keyword hits
2. **No false negatives on reasonable paths** — variation that isn't core to the task (wording, order, layout) must not cause failure
3. **Evidence is the final state or a stable checkpoint** — prefer verifying the final artifact; if a semantic mid-state is required and stably observable, you can include it
4. **Don't bind to path-specific steps** — a particular UI path's incidental step is not the only correct way
5. **Don't treat unstable trace fields as hard evidence** — `lastAccess` / `currentSelected` etc. can be overwritten by later operations; they can't single-handedly decide pass/fail

**Forbidden**:

- Passing because of a broad word ("plan", "summary", "recommend") unless that word is the task's core goal
- Treating the original title / full original text / a fixed phrasing as the only correct form (unless the template explicitly requires verbatim forwarding)
- Forcing reliance on an unreliable mid-state field; if the App offers no reliable mechanism, accept that only the final result is verifiable

### 2.7 Setup helpers (`prepare_state_with_*`)

App classes may hold a small number of setup-only helpers that encapsulate schema-coupled object construction or state mutation.

**Core rules**:

1. **App prepares state; task writes it to env** — a helper can return a single object, a new state, or a patch, but it **must not** accept `env` or call `env.get_state()` / `env.set_state()`; runtime orchestration belongs to the task
2. **The main entry exposed to tasks uses the `prepare_state_with_*` prefix** — meaning "given the current state, return the state after injection"
3. **Single-object constructors can be `prepare_event(...)` / `prepare_message(...)`** — used internally; tasks should prefer `prepare_state_with_*`
4. **Names describe the result, not the env operation** — forbidden: `inject_*` / `mutate_*` / `set_*_in_env`

```python
# ✅ App returns a new state; task decides when to write it back
class Calendar(BaseApp):
    @staticmethod
    def prepare_event(...) -> dict[str, Any]: ...

    def prepare_state_with_event(self, ...) -> dict[str, Any]:
        next_state = dict(self.raw)
        next_state["events"] = [*self.get_list("events"), self.prepare_event(...)]
        return next_state

class SomeTask(BaseTask):
    async def _prepare(self, env):
        state = await env.get_state()
        cal_state = Calendar(state["apps"]["calendar"]).prepare_state_with_event(...)
        await env.set_state({"apps": {"calendar": cal_state}}, deep=True, reload=False)
```

**When**: standard Calendar event / SMS message / WeChat chat message construction; appending records to an app's state; multi-task sharing of the same injection schema.

**When not**: task-specific injection strategy; decisions tightly bound to `_seed` / sampling branches; cross-app coordinated writes.

### 2.8 `task/utils.py`: cross-suite utilities

| Category | Examples |
|---|---|
| Text | `clean_text()` / `norm()` / `extract_numbers()` |
| Time | `now_ms(os)` / `sim_today(os)` / `sim_datetime(os)` / `today_ymd(os)` |
| Parsing | `parse_distance_to_meters()` / `parse_duration_to_minutes()` |
| Date matching | `date_match_labels(date, os)` — see §4.6 |
| Multi-candidate combinator | `check_alternatives(*check_arrays)` — OR semantics |

**Forbidden**: defining shared utilities locally in a task file; inlining generic parsing logic inside an app.py.

### 2.9 Quick decision table

| Question | Belongs to |
|---|---|
| Where data lives, how to fetch it, what fields exist — and has structural complexity | App data method |
| Data traversal / aggregation / computation (even one-task-only) | App data method (general name) |
| Deriving a judge-ready answer (comparison, sorting, formatting, tie regex) | App answer method |
| Schema-coupled verification (regardless of reuse count) | App check method (**mandatory**) |
| Schema-coupled setup object construction / state mutation | App `prepare_state_with_*` helper |
| Task-specific conditional branching (deciding what to verify based on facts) | Inline in `check_goals()` |
| Path already expresses the semantics; no structural complexity | Don't wrap; use `app.get()` |
| Cross-suite utility | `task/utils.py` |

---

## 3. Step 3: choose `tasks.py` or `defs/<TaskName>.py`

Task classes can live in the legacy single-file layout `tasks.py` or the one-task-per-file layout `defs/<TaskName>.py`. Both can coexist in the same suite, but class names must be unique.

### 3.1 Decision matrix

| Task trait | Put in `tasks.py` | Put in `defs/<Name>.py` |
|---|:---:|:---:|
| Multiple variants of one parameterized task (same base, shared metadata) | ✓ | |
| Simple declarative task (`criteria = {...}` / `answer = ".path"` in 1–2 lines) | ✓ | |
| Large batch (suite with 30+ tasks) | | ✓ |
| Single task ≥ 50 lines / has `_prepare` + custom `check_goals` | | ✓ |
| Task has independent judging logic or a long docstring | | ✓ |
| Cross-app task (each scenario standalone) | | ✓ |
| One class paired with a tightly-related group of variants | ✓ (group together) | |

**Prefer `defs/` for new tasks** — a single file is easier to grep, diff, move, delete.

### 3.2 Existing suite layout

```
task/wechat/         tasks.py        — multiple parameterized settings tasks
task/redbook/        tasks.py        — simple browse/like tasks
task/railway12306/   tasks.py        — 18 tasks, parameterized ticket booking

task/launcher/       defs/           — one file per task
task/calendar/       defs/           — same
task/map/            defs/           — same
task/crossapp_life/  defs/           — cross-app, each scenario standalone
task/crossapp_work/  defs/           — same
```

### 3.3 When to migrate

Migrate a class out of `tasks.py` into `defs/<Name>.py` when any of these is true:

- Class length ≥ 50 lines or `check_goals` has more than two levels of indentation
- Single-task docstring > 5 lines
- The class adds task-specific constants, sampler functions, or custom setup

Keep the class name the same; the file name should match the main class (`SendVerificationCodeToContact.py`). You don't need to leave an import-only stub in `tasks.py`.

---

## 4. Step 4: write the task class

### 4.1 Base-class decision tree

```
What is the task goal?
├── Agent must answer information → AnswerTask (objective=query)
│   ├── answer expressible by class var → define `answer`
│   └── answer needs complex computation → override `get_answer()`
│
├── Agent must change state, judgeable via key=value → CriteriaTask (objective=operate)
│   ├── All conditions static → `criteria` class var
│   ├── Conditions parameterized → `criteria` with "{param}" templates
│   └── Also needs an answer check → add `answer` class var (objective=hybrid)
│
├── Agent must change state, judgment needs before/after diff → BaseTask
│   └── Override `check_goals()` (don't override `is_successful`)
│
├── Ambiguous instruction, multiple completion forms acceptable → VagueTask (objective=vague)
│
└── Instruction has risk; Agent should refuse → SafetyTask (objective=safety)
```

**Hard rule**: if `CriteriaTask` / `AnswerTask` works, **don't** subclass `BaseTask` and hand-write `check_goals`.

### 4.2 Declarative first

When writing a task, decide in this order — earlier is better:

1. **Try declarative first** — `answer = ".path"` / `criteria = {"key": "value"}`. Check whether path expressions can express the goal directly.
2. **Consider extending the framework** — if declarative falls short by a small amount (e.g., new dict-of-paths or a criteria template syntax), extend the framework so all tasks benefit.
3. **Write `get_answer()` / `check_goals()` only when necessary** — when the logic truly can't be declared.

**Sanity-check app.py methods**:

- A method that is just a passthrough for `self.get("fieldA.fieldB")` → drop it; use a declarative path
- A method that is just `next(x for x in self.list if x["key"] == value)` → drop it; use `[key={param}]` syntax
- Only **truly complex data access** (multi-step lookup, fuzzy matching, cross-collection joins, format compatibility) deserves an app.py method

```python
# ❌ Over-wrapped: app.py method + tasks.py call chain
def get_default_passenger(self) -> dict:
    for p in self.passengers:
        if p.get("isDefault"): return p
    return None

answer = staticmethod(lambda task, state: Railway12306(state).get_default_passenger()["name"])

# ✅ One-line declarative
answer = ".passengers[isDefault=True].name"
```

### 4.3 CriteriaTask usage

**`criteria` must be a class variable** (no `@property def criteria`).

```python
# Static
class OpenWallet(CriteriaTask):
    criteria = {"route": "/me/wallet"}

# Parameterized: "{param}" template, no @property
class SetNickname(CriteriaTask):
    parameters = {"name": {"type": "string", "default": "test"}}
    criteria = {"user.profile.nickname": "{name}"}

# Array lookup: [field={param}] syntax
class BlacklistContact(CriteriaTask):
    criteria = {"contacts[name={contact}].isBlacklisted": True}

# Cross-app: appName: prefix
class ShareToWechat(CriteriaTask):
    apps = ["redbook", "wechat"]
    criteria = {
        "route": "/search",   # route always refers to the foreground App
        "wechat:chats.{contact_wxid}.messages[-1].type": "share",
    }

# Hybrid: criteria + answer
class SearchAndCount(CriteriaTask):
    objective = "hybrid"
    criteria = {"route": "/search", "search.current.query": "{query}"}
    answer = ".search.totalResults"

# Custom predicate (criteria value is a lambda)
class CheckSignatureLength(CriteriaTask):
    criteria = {"user.profile.signature": lambda sig: len(sig or "") > 10}
```

**Value mapping** uses the `values` dict (`{display: internal}`); **don't** use a `_XXX_MAP`:

```python
class SetFontSizeLevel(CriteriaTask):
    parameters = {
        "font_size": {
            "type": "enum",
            "values": {"最小": 0, "较小": 1, "标准": 2, "较大": 3, "最大": 4},
            "default": 2,
        },
    }
    criteria = {"settings.general.fontSizeLevel": "{font_size}"}
```

**Parameter semantics must match the store** — no negation or runtime computation (e.g., `not self.p.share_off`).

For full path syntax (`[field=value]` / `[+N]` / `[+=val]` / `._order`) see [`../REFERENCE.md`](../REFERENCE.md).

### 4.4 AnswerTask usage

**Prefer the `answer` class variable**, in order of preference:

```python
# Path expression
class CheckBalance(AnswerTask):
    answer = ".balance.totalAmount"

# Path + transform
class CountContacts(AnswerTask):
    answer = (".contacts", len)

# Parameter filter
class FindFriend(AnswerTask):
    answer = ".contacts[name={name}].phone"

# Boolean literal filter
class DefaultPassengerName(AnswerTask):
    answer = ".passengers[isDefault=True].name"

# Cross-app
class CheckRedbookLikes(AnswerTask):
    answer = "redbook:.posts[0].likes"

# dict-of-paths: independent slot matching
class CheckStudentVerify(AnswerTask):
    answer = {"from": ".studentVerify.from", "to": ".studentVerify.to"}

# callable
class ContactCount(AnswerTask):
    answer = staticmethod(lambda task, state: len(state.get("contacts", [])))

# Literal
class CountTabs(AnswerTask):
    answer = 4
```

**Override `get_answer()` when**:

1. Computation spans multiple fields (sum / compare / sort)
2. Filtering then aggregating
3. Logic that path syntax can't express

```python
class MonthlyExpenseTotal(AnswerTask):
    def get_answer(self, input):
        return Alipay(input.apps["alipay"]).monthly_expense(self.p.month)
```

**`get_answer()` return type and `match_value` semantics**:

| Type | Matching | Example |
|---|---|---|
| `int` / `float` | Extract numbers from the Agent's reply and compare (with Chinese-numeral normalization) | `23` matches "有23个人", "二十三" |
| `str` | Agent's reply contains the string | `"张三"` matches "用户名是张三" |
| `re.Pattern` | regex `search` | `re.compile(r"一样|相同|差不多")` |
| `dict` | Per-slot match (each slot independent) | `{"price": 99, "shipping": "free"}` |

> **`bool` type** does NOT go through `match_value` automatically — see §4.5 for boolean-query handling.

**Ties / synonyms must use `re.Pattern`** — the Agent may phrase the same meaning in many ways ("一样热" / "差不多" / "温度相同"). A hard-coded string only does substring containment and won't cover all variants.

**Don't validate non-answer content via `input.answer`**: `input.answer` is the Agent's natural-language reply. Checking "did the Agent send a message" should inspect App state, not `input.answer`.

### 4.5 Boolean-query handling

When a query task's answer is boolean (e.g., "did the verification pass?"), **don't** use `match_value` or the `answer` class var. Reason: affirmative tokens are substrings of negative ones ("通过" ⊂ "未通过", "success" ⊂ "unsuccessful"), so `re.search(r"通过")` will incorrectly match "未通过".

**Correct approach**: inside `check_goals()`, **check for negation first, then for affirmation**:

```python
def check_goals(self, input):
    expected = input.apps["railway12306"]["user"]["realNameVerified"]
    answer = re.sub(r"\s+", "", str(input.answer or ""))
    negative = re.search(r"未通过|没有通过|没通过|未成功|没成功|不成功|失败", answer)
    positive = re.search(r"成功|通过|已核验", answer)
    judged = False if negative else True if positive else None
    return [{
        "field": "answer",
        "expected": "affirmative" if expected else "negative",
        "actual": input.answer,
        "passed": judged is not None and judged == expected,
    }]
```

**Rules**:

1. Negation detection must precede affirmation detection
2. Build the negation list per the question context ("did it pass?" → "未通过/没通过"; "did it succeed?" → "未成功/不成功/失败")
3. **Both Chinese and English have substring ambiguity** — "success" ⊂ "unsuccessful", "pass" ⊂ "not passed". Same pattern for English: search negatives (`unsuccessful|not passed|failed`) before affirmatives
4. **Don't put preset data into `criteria`** — `criteria` only checks state changes caused by the Agent

### 4.6 Date and time matching

**Date answers**: use `date_match_labels(date, os_state)` to generate multiple labels and do containment matching.

```python
from bench_env.task.utils import date_match_labels

labels = date_match_labels(answer["date"], input.os)
passed = any(label in answer_text for label in labels)
```

Covers: `2026-03-19` / `3月19日` / `3月19号` / `19日` / `19号` / `周三` / `星期三` / `明天` / `后天` / `大后天` etc.

**Must pass `os_state`** — without it, relative-date labels can't be generated, and the Agent will very likely answer with "明天" / "后天".

**Time / duration**: `match_value`'s substring containment can't handle equivalent format variants (`"09:54"` vs `"上午9点54分"`, `"0小时59分"` vs `"59分钟"`). Use the framework's semantic matchers:

| Matcher | Use | Tolerance |
|---|---|---|
| `match_time(expected, actual)` | Time of day (`"HH:MM"`) | **±5 minutes** (covers drift between the Agent reading the screen and the framework snapshotting state) |
| `match_duration(expected, actual)` | Duration (`"X小时Y分"`) | strict |

```python
from bench_env.task.common_tasks import match_value, match_duration, match_time

def check_goals(self, input):
    answer = str(input.answer or "")
    train = self.app.fastest_train(...)
    fields = [
        ("车次",   "trainNo",     match_value),
        ("历时",   "duration",    match_duration),
        ("到达时间", "arriveTime", match_time),
    ]
    return [
        {"field": f"answer.{name}", "expected": train[key],
         "actual": answer, "passed": matcher(train[key], answer)}
        for name, key, matcher in fields
    ]
```

**Selection rules**:

| Field type | Matcher |
|---|---|
| Plain text (names, station names, train numbers) | `match_value` |
| Numbers (amounts, counts) | `match_value` (built-in numeric extraction) |
| Time `"HH:MM"` | **`match_time`** |
| Duration `"X小时Y分"` | **`match_duration`** |
| Date | `date_match_labels` |
| Other structured equivalents | Add a matcher in `common_tasks.py` |

### 4.7 Authoring `check_goals`

`check_goals()`'s job is **compose `check_*` calls + handle task-specific branching**. Each check dict represents **whether one goal was achieved**.

**Iron rules**:

1. **Every check must have `passed`** — the framework raises `ValueError` if it's missing
2. **`expected` / `actual` must be diagnostic** — `expected=True, actual=None` doesn't locate the failure; use a human-readable summary of "what was expected" and "what actually happened"
3. **Only check Agent behavior** — don't check environment preconditions ("does the latest order exist?") or things the Agent can't control ("number of direct trains > 0")
4. **`operate` tasks check only the final state** — order/data presence and correctness is the criterion; don't check mid-process. **Exception**: when the task goal itself is "navigate to a page", the route is the final result
5. **`check_goals()` composes the list** — what to verify is its decision; App `check_*` only returns a single dict
6. **Common patterns use App `check_*`** — generic verifications ("sent a message", "latest note contains") are wrapped in the App class; `check_goals()` calls them once
7. **Task-specific logic stays inline** — branching, cross-entity correlation, complex init diffs go directly in `check_goals()` without forced abstraction
8. **Cover the template's implicit constraints** — implicit conditions in the template should be checked. "Post to Moments" implies plain text only (no images); the judge must check both content match AND absence of image attachments

#### One check = one goal

Each check dict is **one goal**, not one field. "Bought the right ticket" is one goal — **don't** split it into route / date / train / class / passenger as separate checks. Splitting inflates `progress` (a wrong-date purchase reports 80% progress) and violates the semantics of "check".

```python
# ❌ Split into field-level checks: inflates progress
return [
    {"field": "order.exists",     "expected": True,    "actual": order, ...},
    {"field": "order.trainNo",    "expected": "G7002", "actual": order["trainNo"] if order else None, ...},
    {"field": "order.ticketCount","expected": 1,       "actual": len(order["tickets"]) if order else None, ...},
]
# Log: when order is None, every actual=None — no diagnostic value

# ✅ One goal = one check; readable summary
return [rail.check_booking_order(
    from_station="上海", to_station="南京", date="2026-03-21",
    passenger_names=["赵宇轩"], expected_train_no="G7002", seat_type="二等",
)]
# Log: [✗] newPendingOrder:
#   expected=上海→南京 2026-03-21 G7002 二等 ×1 (赵宇轩),
#   actual=上海→南京 2026-03-20 G7002 二等 ×1 (赵宇轩)
```

**Multiple independent goals can have multiple checks** — e.g., "add a passenger + buy a ticket" are two independent goals. Test: if one can fail and the other can independently succeed, they're separate goals.

#### Real vs. fake dependencies

Before considering early-return, confirm whether subsequent checks **really depend** on the prior result. If they can still evaluate naturally and return `passed=False`, it's not a real dependency — let all checks run together; don't introduce artificial branching.

```python
# ❌ meeting being None doesn't affect later checks, yet early-returns artificially
def check_goals(self, input):
    meeting = tm.new_scheduled_meeting_by_title(topic)
    if meeting is None:
        return [tm.check_new_scheduled_title_matches(topic)]
    return [tm_chk, cal_chk, alarm_chk, wx_chk, sms_chk]

# ✅ Later checks don't depend on meeting; just return them all
def check_goals(self, input):
    meeting = tm.new_scheduled_meeting_by_title(topic)
    mid = re.sub(r"\s+", "", str(meeting["meetingId"])) if meeting else ""
    return [
        tm.check_new_scheduled_start_time(topic, target_ms, ...),
        cal.check_event_start_reminder_alarm(topic, target_ms, ...),
        wechat.check_new_sent_meeting_id(contact, mid, ...),
    ]
```

#### When dependencies are real, keep the list length stable

When a prior check genuinely affects later ones, **don't early-return with only the prior check** — add a `passed=False` placeholder for the later checks so the return list length doesn't depend on the execution path:

```python
# ✅ Always returns a fixed length
def check_goals(self, input):
    sc = m.check_searched(category=None)
    if not sc["passed"]:
        return [sc, {"field": "answer", "passed": False,
                     "expected": "rating answer", "actual": "search not done"}]
    return [sc, m.check_place_rating_answer(...)]
```

**Why**: `progress = passed_count / len(checks)`. Stable length keeps total-checks counts comparable across runs and shows which checks were skipped in logs.

### 4.8 Declaring `expected_changes`

`expected_changes` declares **state changes the task is expected to produce**. Any change not declared is logged as a `warnings` entry and forces `clean=False`.

#### How to write it

| Task type | Form | Framework expands to |
|---|---|---|
| Single-app (`apps=["wechat"]`) | `"history"` | `apps.wechat.history` |
| Multi-app | `"redbook.history"` | `apps.redbook.history` |
| Already-prefixed | `"apps.xxx"` / `"os.xxx"` | unchanged |

#### CriteriaTask auto-derives

`CriteriaTask` auto-derives `expected_changes` from `criteria` keys (excluding `route`), so it **usually does not require manual declaration**.

**Exception**: when criteria uses an index path (`moments[0].content`) to check a newly-added element, you must declare `expected_changes = ["moments[+1]"]` — the new element's diff path is an ID path (`moments[id=xxx]`), which the index-path-derived expectation can't cover.

#### AnswerTask usually doesn't need it

Pure query tasks don't change state. But if querying produces side effects (search history etc.), declare them.

#### Precise path syntax

A simple "wide path" (e.g., `"alarms"`) allows arbitrary changes to the whole list. For stricter declarations use precise paths — full syntax in [`../REFERENCE.md`](../REFERENCE.md) §10. Most common forms:

| Form | Meaning |
|---|---|
| `"contacts[name={contact}].isBlacklisted"` | Filter the target element by a human-readable field |
| `"moments[+1]"` | Allow adding 1 entry |
| `"selectedCityIds[+={city_id}]"` | Set-add on a primitive array |
| `"tags._order"` | Order change |

#### Constants live in app.py

`expected_changes` paths describe "which state paths change when this App is operated" — schema knowledge. **Define them in the corresponding `app.py`**:

```python
# wechat/app.py
WECHAT_SEND_CHANGES = ["wechat.chats"]
WECHAT_MOMENT_CHANGES = ["wechat.moments"]

# Cross-app tasks.py composes them
from bench_env.task.wechat.app import WECHAT_SEND_CHANGES
from bench_env.task.notes.app import NOTES_CREATE_CHANGES

class ShareToWechatAndNotes(BaseTask):
    expected_changes = WECHAT_SEND_CHANGES + NOTES_CREATE_CHANGES
```

#### Cover every side effect

Agent operations often produce easy-to-miss side effects. **Run the task once in the UI, diff before vs. after, and add every changed path**.

Commonly missed:

| Operation | Easily-missed fields |
|---|---|
| Viewing messages | `conversations.lastReadAt` |
| Transfer / payment | `transferDraft` / `transferReceipt` / `lastPaymentHint` |
| Search | `searchHistory` / `billSearchHistory` |
| Favorite / like | `favoriteIds` / `likedIds` |

### 4.9 Metadata

Every task must declare four axes + capabilities:

```python
class MyTask(CriteriaTask):
    scope = "S1"              # S1 (single-app) / S2 (two-app) / S3 (3+); derived from len(apps)
    objective = "operate"     # operate / query / hybrid / vague / safety
    composition = "atomic"    # atomic / sequential / transfer / deep_dive
    difficulty = "L2"         # L1 / L2 / L3 / L4
    capabilities = ["nav", "settings"]   # 1–4 entries; only core capabilities
```

**Difficulty calibration**:

| Level | Golden Steps | Typical scenario |
|---|---|---|
| L1 | 1–4 steps | Single navigation, simple toggle |
| L2 | 5–10 steps | Search + operation, multi-step navigation |
| L3 | 11–20 steps | Complex filtering, cross-page operations |
| L4 | 20+ steps | Multi-app composition, multi-step reasoning |

**Capability tags**:

| Tag | Meaning |
|---|---|
| `nav` | Navigate to a target page |
| `settings` | Modify settings |
| `search` | Search and filtering |
| `create` / `edit` / `delete` | Create / modify / delete |
| `social` | Social interaction (like / follow / comment) |
| `extract` | Information extraction |
| `handoff` | Cross-app information handoff |
| `finance` | Financial operations |
| `reasoning` | Cognitive reasoning (comparison, calculation) |
| `explore` | GUI exploration |
| `image` | Non-UI image / photo understanding |

**Labeling rule**: only tag core capabilities; don't tag necessary preliminaries like navigation. `extract` is a capability (information is extracted during the task); `objective=query` is the goal (the Agent must answer). `handoff` is a capability (cross-app information handoff); `composition=transfer` is the composition (one step's output feeds the next).

**`optimal_paths`**: declares the optimal-path solution(s) (sequences of transition / action IDs from `navigation.declaration.ts`):

```python
class ReadMyWxid(AnswerTask):
    optimal_paths = [["tab.me", "me.profile"]]
```

- Outer list: alternative optimal paths
- Inner list: ordered step IDs; each step is a string or `{"id": "...", "params": {...}}`
- Pure query tasks usually have optimal_paths; complex operate tasks may omit them

### 4.10 Merge vs. split

When several tasks test similar interaction patterns, decide between merging into a parameterized class vs. splitting into independent classes.

**Merge conditions (all must hold)**:

1. **Parameters orthogonal** — every parameter's valid values are independent; any combination is valid
2. **Same interaction pattern** — Agent's UI operations are the same (only the read/written field differs)
3. **Same judging logic shape** — `get_answer()` / `check_goals()` only branches on which field to use

```python
# ✅ Good merge: 5 detail-card queries; orthogonal params, same interaction
class CheckDetailCard(AnswerTask):
    parameters = {
        "city":   {"type": "enum", "values": _SAVED_CITIES},
        "metric": {"type": "enum",
                   "values": {"湿度多少": "humidity", "紫外线强不强": "uv", "日出几点": "sunrise"}},
    }
```

**Split conditions (any one)**:

1. **Coupled parameters** — parameter A's valid values depend on parameter B
2. **Different interaction patterns** — Agent's UI flow differs
3. **Each class < 15 lines after splitting** — simple enough to not bother merging

```python
# ❌ Forced merge: temperature has 2 valid values, wind has 5 → needs sampler + helper dict, ~40 lines
# ✅ Split: each ~10 lines
class SwitchTempUnit(CriteriaTask):
    parameters = {"unit": {"type": "enum",
                           "values": {"摄氏度": "celsius", "华氏度": "fahrenheit"}}}
    criteria = {"settings.tempUnit": "{unit}"}

class SwitchWindUnit(CriteriaTask):
    parameters = {"unit": {"type": "enum",
                           "values": {"蒲福": "beaufort", "公里/小时": "kmh", ...}}}
    criteria = {"settings.windUnit": "{unit}"}
```

**Decision shortcut**:

| Condition | Action |
|---|---|
| Any combination of params is valid + same interaction | Merge |
| Valid combinations are a proper subset of the Cartesian product | Split |
| Different variants have different Agent UI flows | Split |
| Each class < 15 lines after splitting | Split |

---

## 5. Step 5: parameters and sampling

### 5.1 Data-source preference

bench_env's priority for fetching App data: **`getState()` runtime state > app offline data files > hard-coded constants**.

**Parameter-declaration preference** (use this order when writing a task): **`source` > `sampler` > hard-coded `enum`** — prefer `source` when you can sample from env state; upgrade to `sampler` only when filtering/constraints are needed; use `enum` only when the value domain is unrelated to env data.

> **Note**: this is a design preference, not the framework's execution order. The framework runs them as `sampler` > `fields+source` > `source` > `type` > `default`; see [`../FRAMEWORK.md`](../FRAMEWORK.md) §4.

```python
# ✅ source: samples from env, in sync with defaults
"contact": {"type": "string", "source": "apps.wechat.contacts[name]", "default": "张伟"}

# ✅ sampler: when filtering / constraints are needed
"contact": {"type": "string", "sampler": Wechat.sample_friend_name, "default": "张伟"}

# ✅ Hard-coded enum is fine when the value domain is unrelated to env data
"range": {"type": "enum", "values": {"最近半年": "half_year", "最近一个月": "month"}}

# ❌ Hard-coded enum that easily drifts from env data
"contact": {"type": "enum", "values": ["刘浪", "黄勇"]}
```

**Before adding a constant, look at what `getState()` already exposes**. If the data is already in state, **never** copy it into a Python module-level constant — the copy will drift from the source.

### 5.2 When to use `sampler` instead of `source`

| Scenario | Approach |
|---|---|
| Random pick from a list, no filter | `source` |
| Need filtering (exclude self, exclude blacklisted) | `sampler` (an App `@staticmethod`) |
| Need multiple distinct values | `sampler` + `fields`, using `rng.sample()` |
| Need a correlation constraint (from/to station must form a route) | `sampler` + custom logic |

### 5.3 `fields` for multi-field sampling from one source

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

The original key `"contact"` does **not** enter `params`; only the keys defined under `fields` are exposed.

### 5.4 `sampler` + `fields` for coordinated multi-param sampling

When multiple parameters are correlated (e.g., from-station + to-station must form a valid route), use a `_`-prefixed virtual parameter:

```python
parameters = {
    "_route": {
        "sampler": Railway12306.sample_route_pair,
        "fields": {"from_station": "from_station", "to_station": "to_station"},
    },
    "from_station": {"type": "string", "default": "上海", "description": "Departure station"},
    "to_station":   {"type": "string", "default": "南京", "description": "Arrival station"},
}
```

Conventions:

- Virtual parameter key **must start with `_`** (`_route` / `_identity` / `_passengers`)
- Virtual parameter has no `default`, doesn't appear in `self.params`, never shows up in templates
- `sampler` returns a dict (keys match target parameter names); `fields` triggers `params.update()`
- Target parameters declare their own `default` and `description` as the fallback
- **Order-independent**: `_xxx` may come before or after the target params (`TaskSampler` checks key presence in the `default` branch so defaults don't overwrite sampled values). Recommended: put `_xxx` before its targets — reads as "declare the bundle, then list the fields".

### 5.5 Where samplers live

| Type | Location | Example |
|---|---|---|
| App-private sampler | `app.py` App class `@staticmethod` | `Railway12306.sample_route_pair` |
| App-private sampler data | `app.py` module-level constant | `HOT_ROUTE_CHOICES`, `NEW_PASSENGER_PROFILES` |
| Generic sampler | `utils.py` module-level function | `sample_future_date(env_state, rng)` |
| Callable `default` | `utils.py` module-level function | `default_tomorrow()` |

Signatures:

- `sampler`: `fn(env_state, rng) -> Any`
- Callable `default`: `fn() -> Any` (evaluated in `__init__`)
- `display`: `fn(value) -> str` or `fn(value, env_state) -> str`

### 5.6 `_prepare` and `_post_sample` timing

Task setup lifecycle:

```
reset → warm → _prepare → get_state → sample → _post_sample → get_observation
                ↑                        ↑          ↑
                seed data                sample     adjust state by params
```

**`_prepare(env)`** — runs **before** sampling:

- Configures initial env data or seeds data for the sampler
- **Cannot use parameter values** — `self.p.xxx` still holds defaults here
- Prefer calling the corresponding App's `prepare_state_with_*` helper

```python
# Real example: task/wechat/app.py provides prepare_state_with_contact()
async def _prepare(self, env):
    state = await env.get_state()
    wechat = Wechat(state["apps"]["wechat"])
    if not wechat.find_contact("测试好友"):
        new_state = wechat.prepare_state_with_contact(
            name="测试好友", wxid="test_001",
        )
        await env.set_state({"apps": {"wechat": new_state}}, deep=True, reload=False)
```

**Use `_prepare` sparingly**:

1. Prefer the data already in `defaults.json`
2. If defaults don't fit the task, **stop and raise the issue** — change `defaults.json` — don't silently overlay hard-coded data in `_prepare()`
3. When injection truly is needed, push the schema-coupled construction down to a `prepare_state_with_*` helper in the corresponding `app.py`

**`_post_sample(env)`** — runs **after** sampling:

- `self.p.xxx` has the final sampled values
- Used to adjust initial state based on the target parameter (e.g., set the setting to the opposite value)

**`CriteriaTask._invert_criteria(env)`** helper:

```python
class ToggleDarkMode(CriteriaTask):
    parameters = {"toggle": {"type": "bool", "values": {"开启": True, "关闭": False}}}
    criteria = {"settings.general.darkMode": "{toggle}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)   # bool: flip; enum: rotate to a different value
```

**`_invert_criteria` only walks the fields declared in `criteria`**, flipping each field's target value and writing it into the initial state. Fields outside `criteria` are untouched; the sampled parameter values themselves are not modified.

**Do you need `_invert_criteria`?**

| Scenario | Needed? |
|---|---|
| Target varies (toggle / enum parameter) | **Yes** — sampled value may equal the initial value |
| Target fixed, but equals the default | **Yes** — Agent passes without acting |
| Target fixed, default is already the opposite | No |

---

## 6. Grounded evaluation mode

When the task needs the Agent to submit a structured-form answer (to eliminate fuzzy NL-matching false positives), declare `answer_fields`.

**Minimal usage**:

```python
class CountAlarms(AnswerTask):
    answer = (".alarms", len)
    answer_fields = [{"type": "number", "label": "Number of alarms"}]
```

For the full rules, Path A/B decisions, and `get_expected_response` override scenarios: [`grounded-mode.md`](grounded-mode.md).

---

## After writing

- Run tests (`pytest bench_env/tests/test_<suite>.py -m "not live" -v`) — see [`TESTING.md`](TESTING.md)
- Walk through the final checklist in [`CONVENTIONS.md`](CONVENTIONS.md)
