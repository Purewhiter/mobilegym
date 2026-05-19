# Getting Started

This guide walks you from a fresh clone to a fully evaluated task in about 10 minutes. If you've already read the top-level [README](../README.md) and just want the canonical command sequence, jump to [Quick path](#quick-path).

## Prerequisites

- **Node ≥ 18** and **npm** for the simulator front-end
- **Python ≥ 3.10** (conda recommended) for the benchmark runner
- A modern Chromium-based browser for development
- An **OpenAI-compatible model endpoint** — local (vLLM, llama.cpp, ollama with the OAI shim), proprietary (OpenAI, Anthropic via gateway, Doubao, …), or anything that speaks `/v1/chat/completions`

> The simulator is browser-hosted and doesn't need an emulator, AVD, or root access. Every instance is around 400 MB of RAM, so a single laptop can comfortably host many.

## Install

```bash
git clone https://github.com/<YOUR_ORG>/mobilegym.git
cd mobilegym

# Front-end / simulator
npm install

# Benchmark / agent runtime
pip install -r bench_env/requirements.txt
playwright install chromium
```

## Boot the simulator

```bash
npm run dev
# → Vite dev server starts at http://localhost:5173
```

Open `http://localhost:5173` in any modern browser. You'll see an Android-style launcher with 28 preinstalled apps. Tap around — everything works locally, no network calls to any real service.

> 💡 If you want to inspect or script the simulator from the page, the browser developer console exposes `window.__SIM__`, `window.__OS__`, `window.__SIM_INPUT__`, and `window.__SIM_QUERY__`. See [api/runtime-api.md](api/runtime-api.md) for the full reference.

## Talk to an agent — natural language mode

The easiest way to confirm everything works together is `--exec`, which dispatches a free-text instruction to the agent without running a benchmark judge:

```bash
export MODEL_BASE_URL=http://localhost:8001/v1   # your endpoint
export MODEL_API_KEY=                              # if required
export MODEL_NAME=qwen3-vl-4b                     # your model id

python -m bench_env.run \
  --exec "Open WeChat and read my Wxid in Settings" \
  --env-url http://localhost:5173 \
  --agent autoglm \
  --model-base-url "$MODEL_BASE_URL" \
  --model-name "$MODEL_NAME"
```

A Playwright browser window will appear, the agent will start emitting actions, and the trajectory is written under `runs/<timestamp>/`.

## Evaluate a single task

Now the same thing but with deterministic state-based judging:

```bash
python -m bench_env.run \
  --task-id wechat.ReadMyWxid \
  --env-url http://localhost:5173 \
  --agent autoglm \
  --model-base-url "$MODEL_BASE_URL" \
  --model-name "$MODEL_NAME"
```

At the end you'll see something like:

```
[wechat.ReadMyWxid] result: success=True  pr=1.00  steps=7
```

The judge compared the initial and final JSON snapshots of the simulator state and confirmed the AnswerSheet was filled correctly.

## List the catalogue

```bash
# List every task template (includes auxiliary tasks beyond the released 416)
python -m bench_env.run --list

# Only one app's tasks
python -m bench_env.run --list --suite wechat

# Dump a markdown report for a suite
python -m bench_env.run --list --suite wechat --list-md docs/wechat_tasks.md
```

## Run the full benchmark

```bash
# Whole test split, 4 parallel browsers
python -m bench_env.run --split test --parallel 4 \
  --env-url http://localhost:5173 \
  --agent autoglm \
  --model-base-url "$MODEL_BASE_URL" \
  --model-name "$MODEL_NAME"
```

> 🔀 `--suite` filters tasks by suite name (`--suite wechat,alipay`) — the same name as the directory under `bench_env/task/<suite>/`. For per-app suites this is the app id; for cross-app suites it's a name like `crossapp_commerce`. `--split` selects a curated whitelist (`--split test`, `--split train`, `--split payment`, or unions like `--split test+payment`).

For the paper-reported configuration (256-way parallel, ~6 minutes wall-clock), see [guides/reproduce-paper.md](guides/reproduce-paper.md).

## Headless production runs

Pass `--headless` for unattended runs (CI, RL training, large batches). Combine with `--parallel N` and `--proxy` as needed:

```bash
python -m bench_env.run --split test \
  --headless --parallel 8 \
  --env-url http://localhost:5173 \
  --agent generic_v2 --model-name "$MODEL_NAME" \
  --model-base-url "$MODEL_BASE_URL"
```

## Quick path

If you just want every command in one block:

```bash
git clone https://github.com/<YOUR_ORG>/mobilegym.git && cd mobilegym
npm install && npm run dev &                               # http://localhost:5173
pip install -r bench_env/requirements.txt
playwright install chromium

export MODEL_BASE_URL=http://localhost:8001/v1
export MODEL_NAME=qwen3-vl-4b

python -m bench_env.run --task-id wechat.ReadMyWxid \
  --env-url http://localhost:5173 \
  --agent autoglm \
  --model-base-url "$MODEL_BASE_URL" --model-name "$MODEL_NAME"
```

## Where to go next

- 🏗️ Understand the three-layer architecture → [architecture.md](architecture.md)
- 🤖 Plug in a different agent → [guides/add-an-agent.md](guides/add-an-agent.md)
- 🧪 Author a new task → [guides/add-a-task.md](guides/add-a-task.md)
- 📱 Build a new simulated app → [guides/add-an-app.md](guides/add-an-app.md)
- 🐛 Hit an operational wall? Check [runbooks/](runbooks/) before opening an issue.
