#!/usr/bin/env bash
# Deprecated: prefer `python -m bench_env.run --processes 8 --parallel 256 ...`.
# experiment: warm/wait_ready 是不是 in-process 256-env burst 引起?
# 跑 N 个独立 bench 进程,每个 32 env,共享同一个 vLLM。
# 跑完后用 parse_profile.py 看每个 bench 的 warm / wait_ready 中位数。
set -euo pipefail

# ---- 参数 ----
N_BENCHES=${N_BENCHES:-8}
ENVS_PER_BENCH=${ENVS_PER_BENCH:-32}
BROWSERS_PER_BENCH=${BROWSERS_PER_BENCH:-2}   # contexts iso, 16 ctx/browser
STAGGER_SEC=${STAGGER_SEC:-30}                # 启动错峰,避免 chromium init burst
EXP_NAME=${EXP_NAME:-multibench_$(date +%Y%m%d_%H%M%S)}
ROOT=/home/dingbang_wu/mobile-gym
MODEL_URL=http://127.0.0.1:8003/v1
MODEL_NAME=qwen3-vl-4b-10s
ENV_URL=https://localhost:4180
EXP_DIR=$ROOT/runs/$EXP_NAME
mkdir -p "$EXP_DIR"

# 把 profile parser 写到实验目录
PARSE_PY="$EXP_DIR/parse_profile.py"
cat > "$PARSE_PY" <<'PY'
import re, sys, statistics
from pathlib import Path

def median(xs): return statistics.median(xs) if xs else 0
def p95(xs):
    if not xs: return 0
    s = sorted(xs); return s[int(0.95*(len(s)-1))]

def parse(path):
    text = Path(path).read_text()
    profiles = re.findall(r"profile: ([^\n]+)", text)
    M = {"wait_ready": [], "warm": [], "init_obs": [],
         "infer_step1": [], "infer_steady": [],
         "queue_steady": [], "exec_steady": [],
         "ttft_steady": [], "decode_steady": [],
         "obs_step1": [], "obs_steady": [],
         "action": [], "delay": [], "screenshot_steady": []}
    for line in profiles:
        m = re.search(r"wait_ready=([\d.]+)s", line)
        if m: M["wait_ready"].append(float(m.group(1)))
        m = re.search(r"warm=([\d.]+)s", line)
        if m: M["warm"].append(float(m.group(1)))
        m = re.search(r"init_obs=([\d.]+)s", line)
        if m: M["init_obs"].append(float(m.group(1)))
        infers = re.findall(r"infer=([\d.]+)s", line)
        if infers:
            M["infer_step1"].append(float(infers[0]))
            for v in infers[1:]: M["infer_steady"].append(float(v))
        # infer's children — sw.record from runner + LLMClient
        # First step is warm-up (cold KV, longer); take steady-state from rest.
        for label in ("queue", "exec", "ttft", "decode"):
            vals = re.findall(rf"\b{label}=([\d.]+)s", line)
            for v in vals[1:]:  # skip step1
                M[f"{label}_steady"].append(float(v))
        rest = re.sub(r"init_obs=[\d.]+s\s*\{[^}]*\}", "", line)
        obs_vals = re.findall(r"\bobs=([\d.]+)s", rest)
        if obs_vals:
            M["obs_step1"].append(float(obs_vals[0]))
            for v in obs_vals[1:]: M["obs_steady"].append(float(v))
        for v in re.findall(r"action=([\d.]+)s", line): M["action"].append(float(v))
        for v in re.findall(r"delay=([\d.]+)s", line): M["delay"].append(float(v))
        for v in re.findall(r"obs=[\d.]+s\s*\{\s*screenshot=([\d.]+)s", rest):
            M["screenshot_steady"].append(float(v))
    print(f"  n_profiles={len(profiles)}")
    for k, vs in M.items():
        if vs:
            print(f"  {k:20s}: n={len(vs):4d}  median={median(vs):6.2f}s  p95={p95(vs):6.2f}s  max={max(vs):6.2f}s")

for path in sys.argv[1:]:
    parse(path)
PY

# ---- 切任务 ----
# 直接读 split 文件,每行一个 task_id
cd "$ROOT"
SPLIT_FILE=$ROOT/bench_env/splits/test.txt
TOTAL=$(wc -l < "$SPLIT_FILE")
echo "Total tasks: $TOTAL, split into $N_BENCHES shards of $ENVS_PER_BENCH"

if [ "$TOTAL" -lt $((N_BENCHES * ENVS_PER_BENCH)) ]; then
  echo "WARN: 任务数 $TOTAL < 需要 $((N_BENCHES * ENVS_PER_BENCH)),后面 shard 会更小"
fi

for shard in $(seq 0 $((N_BENCHES - 1))); do
  start=$((shard * ENVS_PER_BENCH + 1))
  end=$((start + ENVS_PER_BENCH - 1))
  sed -n "${start},${end}p" "$SPLIT_FILE" > "$EXP_DIR/shard${shard}.tasks"
  echo "shard${shard}: $(wc -l <"$EXP_DIR/shard${shard}.tasks") tasks"
done

# ---- 启动 N 个 bench ----
PIDS=()
for shard in $(seq 0 $((N_BENCHES - 1))); do
  TASK_FILE="$EXP_DIR/shard${shard}.tasks"
  TASK_IDS=$(paste -sd, "$TASK_FILE")   # comma-separated for --task-ids
  RUN_DIR="$EXP_DIR/bench${shard}"
  LOG="$EXP_DIR/bench${shard}.console"

  echo "[$(date +%T)] launching bench${shard} (envs=$ENVS_PER_BENCH, tasks=$(wc -l <"$TASK_FILE"))"
  MOBILE_GYM_POOL_BATCH_SLEEP_S=3 \
  MOBILE_GYM_TO_THREAD_WORKERS=64 \
  nohup python -m bench_env.run \
    --env-url "$ENV_URL" \
    --model-base-url "$MODEL_URL" \
    --model-name "$MODEL_NAME" \
    --agent generic_v2 \
    --eval-mode grounded \
    --loop-detect 8 \
    --task-ids "$TASK_IDS" \
    --parallel "$ENVS_PER_BENCH" \
    --browsers "$BROWSERS_PER_BENCH" \
    --isolation contexts \
    --headless \
    --runs-dir "$RUN_DIR" \
    > "$LOG" 2>&1 &
  PIDS+=($!)

  if [ "$shard" -lt $((N_BENCHES - 1)) ]; then
    sleep "$STAGGER_SEC"
  fi
done

# ---- 等所有完成 ----
echo "[$(date +%T)] all $N_BENCHES benches launched. waiting..."
for pid in "${PIDS[@]}"; do
  wait "$pid" || echo "bench pid=$pid exited non-zero"
done
echo "[$(date +%T)] all done."

# ---- 汇总每 bench 的 warm/wait_ready/infer 中位数 ----
echo
echo "=== per-bench timing ==="
for shard in $(seq 0 $((N_BENCHES - 1))); do
  RUN=$(ls -td $EXP_DIR/bench${shard}/*/ 2>/dev/null | head -1)
  [ -z "$RUN" ] && { echo "bench${shard}: no run dir"; continue; }
  echo
  echo "--- bench${shard} ($RUN) ---"
  python3 "$PARSE_PY" "$RUN/console.log" || true
  if [ -f "$RUN/summary.json" ]; then
    python3 -c "
import json,sys
s=json.load(open('$RUN/summary.json'))
import datetime as dt
t0=dt.datetime.fromisoformat(s['start_time']); t1=dt.datetime.fromisoformat(s['end_time'])
print(f'  wallclock={(t1-t0).total_seconds():.1f}s  total_ep={s[\"total_episodes\"]}  ep/min={s[\"total_episodes\"]/((t1-t0).total_seconds()/60):.2f}')
"
  fi
done
