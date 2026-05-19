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
  --eval-mode grounded \
  --proxy http://127.0.0.1:7890 \
  --runs-dir runs/example_ebay_proxy


python -m bench_env.run \
  --suite reddit \
  --parallel 1 --headless \
  --isolation pages \
  --env-url http://localhost:4173 \
  --model-base-url https://open.bigmodel.cn/api/paas/v4 \
  --model-api-key 1964d4018cbb41adba7fae458fe8f820.MNiozAo5YJCQ6iVq \
  --model-name autoglm-phone \
  --agent autoglm \
  --eval-mode grounded \
  --runs-dir runs/new_reddit

python -m bench_env.run \
  --suite rednote \
  --parallel 16 --headless --browsers 2 \
  --isolation pages \
  --env-url https://localhost:4180 \
  --model-base-url http://localhost:8006/v1 \
  --model-name qwen3-vl-4b-10s \
  --agent generic_v2 \
  --eval-mode grounded \
  --runs-dir runs/new_rednote_10s


python -m bench_env.run \
  --suite x  --split test \
  --parallel 8 --headless --browsers 2 \
  --isolation pages \
  --env-url https://localhost:4180 \
  --model-base-url $YUNWU_API_URL \
  --model-api-key $YUNWU_API_KEY \
  --model-name gemini-3.1-pro-preview \
  --agent generic_v2 \
  --eval-mode grounded \
  --runs-dir runs/new_x_gemini

python -m bench_env.run \
  --suite x \
  --env-url https://localhost:4180 \
  --agent human \
  --eval-mode grounded \
  --runs-dir runs/new_x_human

python -m bench_env.run \
  --task-id reddit.Reddit_DisableCommunityThemes \
  --env-url https://localhost:4180 \
  --agent human \
  --eval-mode grounded

python -m bench_env.run \
  --suite redbook \
  --env-url https://localhost:4180 \
  --agent human \
  --eval-mode grounded \
  --runs-dir runs/new_redbook_human

python -m bench_env.run --rerun runs/new_redbook_human/20260512_215537 \
  --rerun-scope failed \
  --suite redbook \
  --env-url https://localhost:4180 \
  --agent human \
  --eval-mode grounded

python -m bench_env.run \
  --split test \
  --parallel 16 --headless --browsers 2 \
  --isolation pages \
  --env-url https://localhost:4180 \
  --model-base-url http://localhost:8006/v1 \
  --model-name qwen3-vl-4b-10s \
  --agent generic_v2 \
  --eval-mode grounded \
  --loop-detect 8 \
  --runs-dir runs/new_qwen4b_10s

python -m bench_env.run \
  --suite rednote \
  --parallel 16 --headless --browsers 2 \
  --isolation pages \
  --env-url https://localhost:4180 \
  --model-base-url http://localhost:8006/v1 \
  --model-name qwen3-vl-4b-10s \
  --agent generic_v2 \
  --eval-mode grounded \
  --loop-detect 8 \
  --runs-dir runs/new_rednote_10s

python -m bench_env.run \
    --env-url https://localhost:4180 \
    --model-base-url http://127.0.0.1:8000/v1 \
    --model-name Qwen3.6-35B-A3B --split test \
    --agent generic_v2 \
    --eval-mode grounded \
    --loop-detect 8 \
    --parallel 128 --processes 32 --browsers 32 \
    --isolation pages \
    --headless --proxy http://127.0.0.1:7890 \
    --runs-dir runs/qwen3.6-35BA3B_grounded_loop_detect_8_1gpus_128envs_pages_mp_think \
    --monitor
