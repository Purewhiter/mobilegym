# Getting Started

This guide walks you from a fresh clone to a fully evaluated task in about 10 minutes. If you've already read the top-level [README](../README.md) and just want the canonical command sequence, jump to [Quick path](#quick-path).

## Prerequisites

- **Node ≥ 22** and **npm** for the simulator front-end
- **Python ≥ 3.11** (conda recommended) for the benchmark runner
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

# Companion dataset (~1.9 GB: synthetic Bilibili / RedNote / eBay / Spotify / Maps / themes / wallpapers; CC BY-NC 4.0)
curl -L -o mobilegym-data.tar.gz \
  https://github.com/Purewhiter/mobilegym/releases/download/data-v0.1.0/mobilegym-data-v0.1.0.tar.gz
tar -xzf mobilegym-data.tar.gz && rm mobilegym-data.tar.gz
```

> Without the dataset, most simulated apps (Bilibili, RedNote, eBay, Spotify, Map, ThemeStore) will render empty. Alternatively set `VITE_CDN_BASE` to a URL that serves these files (the deployed demo uses a CDN mirror).

## Configure simulator keys (optional)

Simulator keys are recommended for the best local fidelity, but optional for the canonical MobileGym-Bench tasks. The shipped tasks are designed around bundled offline snapshots; without live keys they should still be runnable, although apps may fall back to cached or synthetic data and some visual details can be less complete. Configure keys when you want richer live behavior:

- **`VITE_GOOGLE_MAPS_API_KEY`** — recommended for the best Map rendering and live Google fallback. Without it, Map uses bundled places/routes snapshots first and loads captured Maps JS/resources from the local Service Worker cache; benchmark tasks are expected to remain usable, but uncached places, details, tiles, or online fallbacks may be missing. The common failure case is the nginx gateway at `https://localhost:4180`: if Chromium rejects nginx's self-signed localhost certificate, `/map-sw.js` cannot register, the placeholder SDK load is no longer intercepted by the cache, and Google reports `InvalidKeyMapError`. Set a real key when you want better visual fidelity, live Google fallback beyond the offline cache, fresh online map resources, or to regenerate Map snapshots.
- **`VITE_GOOGLE_MAP_ID`** — custom vector-map style ID. Falls back to a demo Map ID if empty.
- **`VITE_AMAP_API_KEY`** — AMap reverse geocoding (coordinates → address) for the Weather app. Offline city names cover the common cases when empty.
- **`VITE_QWEATHER_API_KEY`** (+ `VITE_QWEATHER_HOST`) — live weather/forecast in the Weather app. Major cities have offline data; the key is needed for other coordinates or to regenerate snapshots.
- **`VITE_AI_BASE_URL`** / **`VITE_AI_MODEL`** / **`VITE_AI_API_KEY`** — OpenAI-compatible endpoint for the built-in OS LLM. Empty → mock/random replies.
- **`VITE_CDN_BASE`** — CDN prefix for large media (wallpapers, ringtones, app icons). Empty → uses the local `/cdn` mirror from the companion dataset.

See [`.env.example`](../.env.example) for the full list (including advanced flags like `VITE_GW_ALLOW_HOSTS` and `VITE_STORAGE_ISOLATION_MODE`). To use any of these:

```bash
cp .env.example .env.local
# edit .env.local, then restart the dev server (or rebuild for preview/nginx —
# VITE_* values are baked into the frontend bundle at build time).
```

## Boot the simulator

```bash
npm run dev
# → Vite dev server starts at http://localhost:3000
```

Open `http://localhost:3000` in any modern browser. You'll see an Android-style launcher. Tap around — everything works locally, no network calls to any real service.

> 💡 If you want to inspect or script the simulator from the page, the browser developer console exposes `window.__SIM__`, `window.__OS__`, `window.__SIM_INPUT__`, and `window.__SIM_QUERY__`. See [api/runtime-api.md](api/runtime-api.md) for the full reference.

> 🚀 **For benchmark / RL workloads, prefer the nginx gateway.** The Vite dev server is single-process and bottlenecks past ~8 parallel rollouts. The repo ships a one-shot script:
>
> ```bash
> conda install -c conda-forge nginx                # one-time, if not already installed
> npm run build
> ./scripts/server/start_nginx_gateway.sh           # → https://localhost:4180  (HTTP/2 + TLS, 8 workers)
> # stop: ./scripts/server/start_nginx_gateway.sh stop
> ```
>
> Then pass `--env-url https://localhost:4180`. This nginx HTTPS endpoint is the specific case where the local certificate issue can appear: the gateway uses a self-signed localhost certificate, and Chromium may reject the Service Worker script fetch for `/map-sw.js` even when the page itself loaded. `bench_env` sets Playwright `ignore_https_errors=True` and launches Chromium with `--ignore-certificate-errors`; both are intentional because the context-level flag alone is not enough for this Service Worker registration path.
>
> This matters most when `VITE_GOOGLE_MAPS_API_KEY` is empty: the Map app intentionally uses a placeholder key plus the local Service Worker cache to replay captured Maps JS/resources. If the Service Worker fails to register, the placeholder load can go online and report `InvalidKeyMapError`. With a valid Google key, live map loading can work even without the Service Worker, assuming the key is valid for `localhost`, the required Google APIs are enabled, and network access is available. The key is still optional for benchmark use, but it gives the Map app a better display and a real online fallback when the cache does not cover a place.

## Talk to an agent — natural language mode

The easiest way to confirm everything works together is `--exec`, which dispatches a free-text instruction to the agent without running a benchmark judge:

```bash
export MODEL_BASE_URL=http://localhost:8001/v1   # your endpoint
export MODEL_API_KEY=                              # if required
export MODEL_NAME=qwen3-vl-4b                     # your model id

python -m bench_env.run \
  --exec "Open WeChat and read my Wxid in Settings" \
  --env-url http://localhost:3000 \
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
  --env-url http://localhost:3000 \
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
  --env-url http://localhost:3000 \
  --agent autoglm \
  --model-base-url "$MODEL_BASE_URL" \
  --model-name "$MODEL_NAME"
```

> 🔀 `--suite` filters tasks by suite name (`--suite wechat,alipay`) — the same name as the directory under `bench_env/task/<suite>/`. For per-app suites this is the app id; for cross-app suites it's a name like `crossapp_commerce`. `--split` selects a curated whitelist (`--split test`, `--split train`, `--split payment`, or unions like `--split test+payment`).

For trial / pass@k conventions and the canonical leaderboard configuration, see [guides/bench-an-agent.md](guides/bench-an-agent.md); for scaling beyond a single process see [`../bench_env/docs/KNOWN_ISSUES.md`](../bench_env/docs/KNOWN_ISSUES.md).

## Headless production runs

Pass `--headless` for unattended runs (CI, RL training, large batches). Combine with `--parallel N` as needed:

```bash
python -m bench_env.run --split test \
  --headless --parallel 8 \
  --env-url http://localhost:3000 \
  --agent generic_v2 --model-name "$MODEL_NAME" \
  --model-base-url "$MODEL_BASE_URL"
```

## Routing the simulator browser through a proxy

If the simulator URL or its in-app fetches need to go through a proxy, pass `--proxy` to `bench_env.run`:

```bash
python -m bench_env.run --task-id wechat.ReadMyWxid \
  --proxy http://127.0.0.1:7890 \
  --env-url https://mobilegym.your-org.internal \
  --agent autoglm --model-name autoglm-phone-9b
```

This flag only affects the Playwright browser's outbound requests; the agent process and model API calls take their proxy settings from your shell as usual.

## Quick path

If you just want every command in one block:

```bash
git clone https://github.com/<YOUR_ORG>/mobilegym.git && cd mobilegym
npm install
pip install -r bench_env/requirements.txt && playwright install chromium

curl -L -o mobilegym-data.tar.gz \
  https://github.com/Purewhiter/mobilegym/releases/download/data-v0.1.0/mobilegym-data-v0.1.0.tar.gz
tar -xzf mobilegym-data.tar.gz && rm mobilegym-data.tar.gz

npm run dev &                                              # http://localhost:3000

export MODEL_BASE_URL=http://localhost:8001/v1
export MODEL_NAME=qwen3-vl-4b

python -m bench_env.run --task-id wechat.ReadMyWxid \
  --env-url http://localhost:3000 \
  --agent autoglm \
  --model-base-url "$MODEL_BASE_URL" --model-name "$MODEL_NAME"
```

## Where to go next

- 🏗️ Understand the three-layer architecture → [platform/architecture.md](platform/architecture.md)
- 🤖 Plug in a different agent → [guides/add-an-agent.md](guides/add-an-agent.md)
- 🧪 Author a new task → [guides/add-a-task.md](guides/add-a-task.md)
- 📱 Build a new simulated app → [guides/add-an-app.md](guides/add-an-app.md)
- 🐛 Hit an operational wall? Check [bench_env/README.md](../bench_env/README.md) and [platform/tooling/build.md](platform/tooling/build.md) before opening an issue.
