# bench_env

Benchmark environment for mobile GUI agents. Agent-Environment-Runner architecture; supports both simulator and real-device; dual judging via state diff + VLM; single-process parallel + multi-process sharding.

## Documentation map

| Doc | Content |
|---|---|
| [`docs/FRAMEWORK.md`](docs/FRAMEWORK.md) | Framework architecture, Episode lifecycle, sampling, judging pipeline, parallel execution |
| [`docs/REFERENCE.md`](docs/REFERENCE.md) | Quick reference: CLI / type fields / action maps / path syntax |
| [`docs/task/IMPLEMENTATION.md`](docs/task/IMPLEMENTATION.md) | Task implementation workflow (**start here when writing a new task**) |
| [`docs/task/CONVENTIONS.md`](docs/task/CONVENTIONS.md) | Code conventions + PR review checklist |
| [`docs/task/TESTING.md`](docs/task/TESTING.md) | Test conventions |
| [`docs/task/grounded-mode.md`](docs/task/grounded-mode.md) | Grounded evaluation (`answer_fields`) |

---

## Install

```bash
pip install -r bench_env/requirements.txt
playwright install chromium
```

Model service is configured via environment variables:

```bash
export MODEL_BASE_URL=http://localhost:8001/v1
export MODEL_API_KEY=
export JUDGE_MODEL=vlm-judge-model
export JUDGE_BASE_URL="$MODEL_BASE_URL"
export JUDGE_API_KEY="$MODEL_API_KEY"
```

---

## Common commands

### List tasks

```bash
python -m bench_env.run --list
python -m bench_env.run --list --suite wechat
python -m bench_env.run --list --suite wechat --list-md docs/wechat_tasks.md

# Render task descriptions online (reads __SIM__.getState(); always headless)
python -m bench_env.run --list --suite railway12306 --list-online \
    --env-url http://localhost:3000 \
    --list-md docs/railway12306_tasks.md
```

### Single task

```bash
python -m bench_env.run \
    --task-id wechat.ReadMyWxid \
    --env-url http://localhost:3000 \
    --model-base-url "$MODEL_BASE_URL" \
    --model-api-key "$MODEL_API_KEY" \
    --model-name autoglm \
    --agent autoglm
```

### Whole suite

```bash
python -m bench_env.run \
    --suite wechat \
    --env-url http://localhost:3000 \
    --model-base-url "$MODEL_BASE_URL" \
    --model-api-key "$MODEL_API_KEY" \
    --model-name gelab-zero \
    --agent gelab
```

### Parallel

```bash
# 8 workers, single process
python -m bench_env.run \
    --suite wechat \
    --parallel 8 --isolation pages \
    --env-url http://localhost:3000 \
    --model-base-url "$MODEL_BASE_URL" \
    --model-api-key "$MODEL_API_KEY" \
    --model-name autoglm \
    --headless --agent autoglm

# Multi-process sharding: total concurrency 256, 8 shards, 32 envs per shard
python -m bench_env.run \
    --suite wechat \
    --processes 8 --parallel 256 --browsers 16 --isolation contexts \
    --env-url http://localhost:4173 \
    --model-base-url "$MODEL_BASE_URL" \
    --model-api-key "$MODEL_API_KEY" \
    --model-name autoglm \
    --headless --agent autoglm
```

Above 24-way parallelism, `pages` / `contexts` isolation can be unstable — use `browsers`. See [`docs/FRAMEWORK.md`](docs/FRAMEWORK.md) §6 for details.

### Sampling / Pass@k

```bash
# Sample 3 distinct parameter instances per task, fixed seed
python -m bench_env.run \
    --suite wechat --sample-n 3 --sample-seed 42 \
    --parallel 8 --env-url http://localhost:4173 \
    --agent autoglm --model-name autoglm \
    --model-base-url "$MODEL_BASE_URL" --model-api-key "$MODEL_API_KEY" \
    --headless

# Pass@k: run each task 8 times, compute pass@1 / pass@8
python -m bench_env.run \
    --suite wechat --repeat-n 8 --pass-k 1,8 \
    --parallel 32 --isolation browsers \
    --env-url http://localhost:4173 \
    --agent autoglm --model-name autoglm \
    --model-base-url "$MODEL_BASE_URL" --model-api-key "$MODEL_API_KEY" \
    --headless
```

`--sample-n` vs `--repeat-n`:

- `--sample-n` generates N instances with **different parameters** (tests generalization)
- `--repeat-n` runs the same instance N times (tests stability / pass@k)
- Combinable: `--sample-n 3 --repeat-n 8` = 3 parameter instances × 8 repeats each

### Human Agent / Free execution

```bash
# Manual operation
python -m bench_env.run --task-id wechat.ReadMyWxid --agent human --env-url http://localhost:3000

# Free execution (no judging)
python -m bench_env.run \
    --exec "Open RedNote and tell me my nickname" \
    --env-url http://localhost:3000 \
    --model-base-url "$MODEL_BASE_URL" --model-api-key "$MODEL_API_KEY" \
    --model-name autoglm --agent autoglm
```

### Real Device

```bash
python -m bench_env.run \
    --task-id wechat.ReadMyWxid \
    --device real \
    --model-base-url "$MODEL_BASE_URL" --model-api-key "$MODEL_API_KEY" \
    --model-name autoglm --agent autoglm
```

Real-device runs auto-enable VLM evaluation (no JSON state available). To force VLM on the simulator: `--judge-mode vlm`. See [`docs/FRAMEWORK.md`](docs/FRAMEWORK.md) §8 for full VLM configuration.

---

## Task filtering: split / rerun / resume / prune

Files under `bench_env/splits/` are task-id whitelists. Built-in splits: `train` / `test` / `payment` / `high_risk`.

```bash
# List a split
python -m bench_env.run --list --split test

# Run only the test split
python -m bench_env.run --split test --env-url http://... --agent autoglm

# Union of splits (joined with +)
python -m bench_env.run --split test+payment ...

# External whitelist file
python -m bench_env.run --split /path/to/my_ids.txt ...
```

For how `--rerun` / `--resume` / `--prune` each treat `--split`, see [`docs/REFERENCE.md`](docs/REFERENCE.md) §12.

### Cleaning old results

```bash
# Drop orphan entries for deleted tasks
python -m bench_env.run --prune runs/xxx --dry-run
python -m bench_env.run --prune runs/xxx

# Narrow results to a split
python -m bench_env.run --prune runs/xxx --split test
```

---

## Programmatic usage

```python
import asyncio
from bench_env import SerialRunner
from bench_env.config import RunnerConfig
from bench_env import factory

config = RunnerConfig(
    agent="generic_v2",
    model_name="gpt-4o",
    model_base_url="http://api.example.com/v1",
    env_url="http://localhost:4173",
    max_steps=10,
    suite=["wechat"],
)

async def run():
    tasks = factory.load_tasks(config)
    env = await factory.create_env(config)
    agent = factory.create_agent(config, factory.create_llm(config))
    runner = SerialRunner(env, agent, tasks, config)
    return await runner.run()

asyncio.run(run())
```

Full `RunnerConfig` field reference: [`docs/REFERENCE.md`](docs/REFERENCE.md) §1.

---

## Output

```
runs/20260125_143052/
├── meta.json                          # Run metadata (incl. repeat_n, split)
├── results.jsonl                      # One row per task × trial
├── summary.json                       # Aggregate stats (incl. pass@k)
├── errors.jsonl                       # Failure details
├── shards/p00/...                     # Per-shard output in multi-process mode
└── trajectory/<task>/                 # Trajectories
    ├── trajectory.json
    ├── step_001.png
    ├── step_001_prompt.json           # Images replaced with placeholders
    ├── step_001_response.txt
    └── step_001_annot.png             # Action visualization
```

Summary metrics: `SR` (success rate) / `PR` (mean progress) / `FC` (false complete) / `OT` (overdue termination) / `USE` (unexpected side effects) / average steps / per-suite SR-PR table.

---

## What do I want → Where to look

| Goal | Entry |
|---|---|
| Run existing tasks | This file → §Common commands |
| Write a new task | [`docs/task/IMPLEMENTATION.md`](docs/task/IMPLEMENTATION.md) |
| Run PR review on a task | [`docs/task/CONVENTIONS.md`](docs/task/CONVENTIONS.md) — checklist at the end |
| Add tests | [`docs/task/TESTING.md`](docs/task/TESTING.md) |
| Add a new Agent / Env / Runner | [`docs/FRAMEWORK.md`](docs/FRAMEWORK.md) |
| Look up CLI / type fields / action map | [`docs/REFERENCE.md`](docs/REFERENCE.md) |
| Enable Grounded evaluation | [`docs/task/grounded-mode.md`](docs/task/grounded-mode.md) |

## Feedback / Issues

`docs/archive/PROBLEM.md` keeps the historical incident log (P001–P015); every entry has been abstracted into the rules. For new issues, check the checklist in [`docs/task/CONVENTIONS.md`](docs/task/CONVENTIONS.md) first, then open a GitHub issue.
