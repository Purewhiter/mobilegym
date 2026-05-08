#!/usr/bin/env bash

TASK_IDS=$(python3 -c "import json; print(','.join(json.load(open('bench_env/splits/sim2real_instructions.json')).keys()))")

python3 -m bench_env.run --device real \
  --task-ids "$TASK_IDS" \
  --task-instructions bench_env/splits/sim2real_instructions.json \
  --agent generic_v2 \
  --model-name qwen3-vl-4b \
  --model-base-url http://127.0.0.1:8002/v1 \
  --judge-mode vlm \
  --judge-model qwen3.6-plus --judge-base-url https://dashscope.aliyuncs.com/compatible-mode/v1 --judge-api-key YOUR_API_KEY \
  --runs-dir runs/qwen3-vl-4b-real
