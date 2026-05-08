#!/usr/bin/env bash

# Benchmark command examples. Copy or run individual blocks as needed.

exit 0

python -m bench_env.run --list

python -m bench_env.run \
  --task-id clock.CountAlarms \
  --env-url http://localhost:3000 \
  --agent human \
  --eval-mode grounded

python -m bench_env.run \
  --task-id clock.CountAlarms \
  --env-url http://localhost:3000 \
  --model-base-url http://localhost:8001/v1 \
  --model-api-key your-api-key \
  --model-name your-model-name \
  --agent generic_v2 \
  --eval-mode grounded \
  --headless

python -m bench_env.run \
  --suite ebay \
  --parallel 2 \
  --isolation pages \
  --env-url http://localhost:3000 \
  --model-base-url http://localhost:8001/v1 \
  --model-api-key your-api-key \
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
  --model-api-key your-api-key \
  --model-name your-model-name \
  --agent generic_v2 \
  --headless \
  --proxy http://127.0.0.1:7890 \
  --runs-dir runs/example_ebay_proxy
