# Add a New Task

This guide shows you how to author a new benchmark task, define its judge, and ship it with offline tests. We assume the app you're targeting already exists in the simulator — if not, read [add-an-app.md](add-an-app.md) first.

> 📐 The authoritative rules (file layout, parameter sampling, capability tags, difficulty bands) are in [`../../bench_env/docs/task/CONVENTIONS.md`](../../bench_env/docs/task/CONVENTIONS.md) + [`../../bench_env/docs/task/IMPLEMENTATION.md`](../../bench_env/docs/task/IMPLEMENTATION.md), and the testing spec in [`../../bench_env/docs/task/TESTING.md`](../../bench_env/docs/task/TESTING.md).

## Where tasks live

```
bench_env/task/
├── base.py                # BaseTask + BaseApp utilities
├── common_tasks.py        # AnswerTask, CriteriaTask, build_answer_checks, …
├── judge.py               # shared judge helpers
└── <app>/                 # one directory per simulator app
    ├── __init__.py
    ├── app.py             # state accessor + slot value lists
    └── tasks.py           # task definitions (or tasks/ split by difficulty)
```

For larger app suites, `tasks.py` may be split into `tasks/L1.py`, `tasks/L2.py`, etc. The Notes app keeps everything in one file because it's small.

## Anatomy of a task

Every task is a Python class. It declares its metadata, parameter slots, expected state changes, and a judge. The three primary base classes:

| Base | Use when… | Judge |
|---|---|---|
| `BaseTask` | The agent must change state and the goal is fully encoded in that change | You write `check_goals()` returning a list of `{field, passed, expected, actual, …}` dicts |
| `CriteriaTask` | The goal is a small dict of field-value criteria | You declare `criteria = {"path.to.field": "{slot}"}`; the base class builds the check list for you |
| `AnswerTask` | The agent must produce an answer via AnswerSheet | You write `get_answer()` returning the ground-truth value; the base class compares it against the agent's filled AnswerSheet |

Hybrid tasks subclass `BaseTask` and combine both: state changes plus an AnswerSheet read-back. Look at `bench_env/task/notes/tasks.py` for representative examples of all three.

## Walkthrough — an `AnswerTask`

The simplest possible task is one where the agent looks at the simulator and reports a fact. Here's `ReadNotesCount` from `bench_env/task/notes/tasks.py`:

```python
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import Notes

class ReadNotesCount(AnswerTask):
    templates = ["看看笔记里有几条便签"]
    apps = ["notes"]
    scope = "S1"            # single-app
    objective = "query"     # information retrieval
    composition = "atomic"  # one action
    difficulty = "L1"
    capabilities = ["extract"]
    answer_fields = [{"type": "number", "label": "便签数量"}]

    def get_answer(self, input: JudgeInput) -> int:
        return len(Notes(input.apps_init["notes"]).visible_notes)
```

What's happening:

- **`templates`** — natural-language phrasings of the goal. Multiple variants are encouraged; the runner samples one per rollout.
- **`apps`** — which apps' snapshots the judge will read (powers state-diff metrics).
- **`scope` / `objective` / `composition` / `difficulty` / `capabilities`** — the four-axis taxonomy plus capability tags. See [`CONVENTIONS.md`](../../bench_env/docs/task/CONVENTIONS.md) for the controlled vocabulary.
- **`answer_fields`** — the AnswerSheet schema the agent must fill. Field types (`number`, `text`, `enum`, `time`, …) drive the comparison rules.
- **`get_answer()`** — derives the *ground-truth* answer from the initial app state. The judge compares it against what the agent wrote.

That's the whole task. No setup needed — the default `BaseTask.setup()` resets the env and opens the target app.

## Walkthrough — a `CriteriaTask`

When the goal is "change state X to value Y," `CriteriaTask` is the shortest path:

```python
class ChangeViewMode(CriteriaTask):
    templates = ["把笔记的视图模式改成{mode}"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["settings", "nav"]
    parameters = {
        "mode": {
            "type": "enum",
            "values": {"列表": "list", "宫格": "grid"},
            "default": "list",
        },
    }
    criteria = {"settings.notesViewMode": "{mode}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)
```

Highlights:

- **`parameters`** — slot schema. Each rollout samples one value (here `mode ∈ {列表, 宫格}` mapped to internal `list` / `grid`). Slots interpolate into both `templates` and `criteria`.
- **`criteria`** — dotted paths into the final app snapshot, compared exactly against the resolved slot value. Wildcards and tolerance helpers exist; see the spec.
- **`_post_sample(env)`** — runs after parameter sampling, before the agent starts. Here `_invert_criteria` flips the initial value to the *opposite* of the goal so the task is never a no-op.

## Walkthrough — a `BaseTask`

When the change is complex (creating an entity, updating one of many list items), inherit `BaseTask` and write the goals yourself:

```python
class CreateNewNote(BaseTask):
    templates = ["在笔记里新建一条便签，标题写「{title}」"]
    apps = ["notes"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["write"]
    parameters = {
        "title": {
            "type": "enum",
            "values": NOTES_CREATE_TITLES,  # from app.py
            "description": "笔记标题",
        },
    }
    expected_changes = ["notes.notes"]      # which sub-trees the judge expects to mutate

    def check_goals(self, input: JudgeInput):
        title = self.p.title
        notes = Notes(input.apps["notes"]).visible_notes
        passed = any(n.get("title") == title for n in notes)
        return [{
            "field": "note-created",
            "passed": passed,
            "expected": f"a note titled {title}",
            "actual": [n.get("title") for n in notes],
        }]
```

`expected_changes` is what powers the **Unexpected Side Effects** metric: any *other* tree that mutated counts as a side effect.

## State accessor helpers

Most apps have an `app.py` that wraps the raw JSON snapshot in a typed accessor (e.g. `Notes(input.apps["notes"])` above). It keeps the judges short and makes refactoring the data shape safe. When you add a new task, look first at the existing accessor — chances are it already has the helper you need.

## Authoring checklist

1. **Choose the base class** — `AnswerTask` for queries, `CriteriaTask` for atomic state changes, `BaseTask` for everything else.
2. **Pick the taxonomy** — `scope` / `objective` / `composition` / `difficulty` / `capabilities`. Difficulty is calibrated post-hoc, so start with your honest guess.
3. **Write the templates** — at least one phrasing, more if natural.
4. **Define parameters** — slot types, value sources, optional `display` for nicely-rendered prompts.
5. **Implement the judge** — `check_goals()` and/or `get_answer()`.
6. **Set `expected_changes`** — the sub-trees you legitimately touch. Anything outside is a side effect.
7. **(Optional) `_post_sample`** — adjust initial state so the task is non-trivial.

## Test it offline

Every task must have an offline test before merge. Tests live in `bench_env/tests/<suite>/test_tasks.py` and use the two canonical lists `OFFLINE_JUDGE_POSITIVE_CASES` and `OFFLINE_JUDGE_NEGATIVE_CASES`. The full convention is in [`TESTING.md`](../../bench_env/docs/task/TESTING.md).

Run them:

```bash
python -m pytest bench_env/tests/notes/test_tasks.py -q
```

## Run it live

Once the offline test passes, run the task end-to-end against the simulator:

```bash
python -m bench_env.run \
  --task-id notes.CreateNewNote \
  --env-url http://localhost:5173 \
  --agent autoglm \
  --model-base-url $MODEL_BASE_URL --model-name $MODEL_NAME
```

The runner will reset the env, sample your parameters, dispatch the prompt to the agent, run the trajectory, and print the verdict plus saved trajectory path under `runs/`.

## Generating task candidates from the nav graph

After you write your app's `navigation.declaration.ts`, the analyzer can enumerate reachable trajectories and suggest candidate tasks:

```bash
node scripts/build_nav_artifacts.mjs <AppName>
# → public/<appname>_action_tasks.json
```

This is a starting point, not a substitute for thinking — you still need to write the judge.

## Common pitfalls

- **`templates` interpolation matches `parameters` keys.** If you reference `{title}` in a template but call the slot `note_title`, sampling fails silently in older code paths and loudly in new ones.
- **AnswerSheet field types matter.** A `number` field will reject `"7 notes"`; a `text` field accepts it. Use `enum` to constrain to a choice set.
- **`check_goals()` must be deterministic.** No timestamps, no `random`. Use values derivable from `input.apps_init` (initial-state snapshot) / `input.apps` (final-state snapshot) only.
- **`expected_changes` should be the minimal accurate set.** Listing too few causes false side-effect flags; listing too many lets real bugs hide.
- **The agent only sees screenshots.** Don't write a task whose only way to succeed is reading the JSON state.

## Where to go next

- 🤖 The agent your task targets → [add-an-agent.md](add-an-agent.md)
- 🌉 Want your task in the Sim-to-Real training pool? → [reproduce-paper.md](reproduce-paper.md)
- 📐 Deep dive — task taxonomy, capability tags, parameter sampler: [`CONVENTIONS.md`](../../bench_env/docs/task/CONVENTIONS.md) + [`REFERENCE.md`](../../bench_env/docs/REFERENCE.md)
- ✅ Deep dive — offline test conventions: [`TESTING.md`](../../bench_env/docs/task/TESTING.md)
- ⚖️ Judge philosophy and CRUD recipes: [`IMPLEMENTATION.md`](../../bench_env/docs/task/IMPLEMENTATION.md)
- 📝 AnswerSheet / grounded-mode protocol: [`grounded-mode.md`](../../bench_env/docs/task/grounded-mode.md)
