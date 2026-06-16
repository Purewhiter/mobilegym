#!/usr/bin/env bash

# Benchmark command examples. This file is a catalog: copy or run individual
# blocks as needed. The early exit below prevents accidental full execution.

exit 0

# 1. Discovery
# List every registered task.
python -m bench_env.run --list

# 2. Single-task local checks
# Manual run against the Vite dev server.
python -m bench_env.run \
  --task-id clock.CountAlarms \
  --env-url http://localhost:3000 \
  --agent human

# Scripted validation run: replay a per-task plan through the real GUI and let
# the judge grade the result. No LLM needed. Plans live under
# bench_env/tests/<suite>/scripted_plans.py (PLANS keyed by task id).
python -m bench_env.run \
  --suite spotify \
  --env-url http://localhost:3000 \
  --agent scripted

# Model run against a local OpenAI-compatible endpoint.
python -m bench_env.run \
  --task-id clock.CountAlarms \
  --env-url http://localhost:3000 \
  --model-base-url http://localhost:8001/v1 \
  --model-name your-model-name \
  --agent generic_v2 \
  --headless

# 3. Small suite smoke tests
# Low-concurrency suite run against the Vite dev server.
python -m bench_env.run \
  --suite ebay \
  --parallel 2 \
  --isolation pages \
  --env-url http://localhost:3000 \
  --model-base-url http://localhost:8001/v1 \
  --model-name your-model-name \
  --agent generic_v2 \
  --headless \
  --runs-dir runs/example_ebay

# Browser traffic proxy for Playwright-launched Chromium pages.
# Useful when app pages need browser-side network access through a local proxy,
# for example Google Maps assets or tiles. 
python -m bench_env.run \
  --suite ebay \
  --parallel 2 \
  --isolation pages \
  --env-url http://localhost:3000 \
  --model-base-url http://localhost:8001/v1 \
  --model-name your-model-name \
  --agent generic_v2 \
  --headless \
  --proxy http://127.0.0.1:7890 \
  --runs-dir runs/example_ebay_proxy

# 4. Medium-scale model runs
# Multi-browser run against the nginx gateway.
python -m bench_env.run \
  --suite redbook \
  --parallel 16 --headless --browsers 2 \
  --isolation pages \
  --env-url https://localhost:4180 \
  --model-base-url http://localhost:8006/v1 \
  --model-name qwen3-vl-4b-10s \
  --agent generic_v2 \
  --runs-dir runs/new_redbook_10s

# Remote-model run. Provide these through your shell environment.
python -m bench_env.run \
  --suite x \
  --split test \
  --parallel 8 --headless --browsers 2 \
  --isolation pages \
  --env-url https://localhost:4180 \
  --model-base-url "$YUNWU_API_URL" \
  --model-api-key "$YUNWU_API_KEY" \
  --model-name gemini-3.1-pro-preview \
  --agent generic_v2 \
  --runs-dir runs/new_x_gemini

# 5. Human validation and reruns
# Manual suite run against the nginx gateway.

# Manual redbook suite check.
python -m bench_env.run \
  --suite redbook \
  --env-url https://localhost:4180 \
  --agent human \
  --runs-dir runs/new_redbook_human

# Rerun failed episodes from a previous run directory.
python -m bench_env.run --rerun runs/new_redbook_human/20260512_215537 \
  --rerun-scope failed \
  --suite redbook \
  --env-url https://localhost:4180 \
  --agent human

# 6. Large-scale benchmark runs
# High-concurrency split run with loop detection and vLLM monitoring.
python -m bench_env.run \
  --split test \
  --parallel 128 --headless --browsers 16 \
  --isolation pages \
  --env-url https://localhost:4180 \
  --model-base-url http://localhost:8006/v1 \
  --model-name qwen3-vl-4b-10s \
  --proxy http://127.0.0.1:7890 \
  --agent generic_v2 \
  --loop-detect 10 \
  --runs-dir runs/new_qwen4b_10s \
  --monitor

# Multi-process variant
python -m bench_env.run \
  --split test \
  --parallel 64 --headless --browsers 16 --processes 16 \
  --isolation pages \
  --env-url https://localhost:4180 \
  --model-base-url http://localhost:8006/v1 \
  --model-name qwen3-vl-4b-10s \
  --proxy http://127.0.0.1:7890 \
  --agent generic_v2 \
  --loop-detect 10 \
  --runs-dir runs/new_qwen4b_10s_16procs_64envs_16browsers_pages \
  --monitor