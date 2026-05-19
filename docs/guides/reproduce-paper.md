# Reproduce the Paper

This guide explains how to reproduce the experiments reported in the MobileGym paper. The two headline results to target:

1. **Main leaderboard** — 9-agent evaluation on the 256-task test set (Table 2 in the paper).
2. **Sim-to-Real transfer** — GRPO on Qwen3-VL-4B, +42.8 pt in simulation, +40.7 pt on a real Redmi Note 12 Turbo, 95.1 % retention (Table 3).

Detailed appendices (hyperparameters, reward shaping, bucket criteria, judge audits) live in the paper PDF. This page is the operational recipe.

## 1. Main leaderboard

Run each agent against the 256-task test split:

```bash
export MODEL_BASE_URL=http://localhost:8001/v1
export MODEL_NAME=autoglm-phone-9b      # one of the listed agents below

python -m bench_env.run \
  --split test \
  --agent autoglm \
  --env-url http://localhost:5173 \
  --model-base-url "$MODEL_BASE_URL" \
  --model-name "$MODEL_NAME" \
  --parallel 8 \
  --headless
```

For the paper, we ran:

| Agent flag | Model | Notes |
|---|---|---|
| `--agent generic` | Gemini 3.1 Pro | Single run + 1 sanity rerun (cost) |
| `--agent generic` | Doubao-Seed-2.0-Pro | Single run (cost) |
| `--agent generic` | Qwen3.6-Plus | Single run (cost) |
| `--agent autoglm` | AutoGLM-Phone-9B | 4 trials |
| `--agent uitars` | UI-TARS-1.5-8B | 4 trials |
| `--agent venus` | UI-Venus-1.5-8B | 4 trials |
| `--agent gui_owl` | GUI-Owl-1.5-8B-Think | 4 trials |
| `--agent gelab` | Step-GUI-4B | 4 trials |
| `--agent generic_v2` | Qwen3-VL-4B | 4 trials |

Step budgets follow the spec: L1 = 15, L2 = 30, L3 = 45, L4 = 60, plus an extra +15 for AnswerSheet tasks. The runner sets these automatically from each task's `difficulty` field.

## 2. Sim-to-Real

The Sim-to-Real case study runs in three stages:

### Stage A — Training environment

Bring up `N` parallel browser instances. The paper used 96 instances on a single node:

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

For higher density the runner can attach to a pool of preview servers; see [../runbooks/bench-inotify-limit.md](../runbooks/bench-inotify-limit.md) for scaling tips.

### Stage B — GRPO training

The paper trained Qwen3-VL-4B with **GRPO** for **10 steps** under these hyperparameters:

| Param | Value |
|---|---|
| Learning rate | `1e-6` |
| Group size | `8` |
| Batch size | `12` |
| KL coefficient | `0.01` |
| Clip-higher (DAPO-style) | `0.2 / 0.28` |
| Reward | PR-shaped dense, multiplicative penalties for AnswerSheet error, side effects, false completion, overdue/post-success termination |
| Training split | `train` (160 templates, strictly disjoint from `test`) |
| Eval split | `test` (256 templates) |
| GPUs | 3× RTX Pro 6000 |
| Parallel envs | 96 |

The complete reward formula, the penalty constants, and the inversion / sampling protocol are in the paper appendix.

> The training driver itself is not in this repository — bring your own RL framework. Any GRPO implementation that supports an OpenAI-compatible inference endpoint and a per-rollout reward callback can drive MobileGym. The reward callback uses `task.is_successful(JudgeInput(...))` for the binary verdict and inspects `task.check_goals(...)` for the per-subgoal breakdown that drives the PR-shaped dense reward.

### Stage C — Evaluation

After training, evaluate on the 256-task test split. For the buckets reported in Table 3 (`Uplift`, `Stable-pass`, `Mid`, `Regression`, `Stable-fail`), the partition is computed from **4 simulator rollouts per task** under both base and trained models:

```bash
# Trained checkpoint
python -m bench_env.run \
  --split test \
  --agent generic_v2 \
  --env-url http://127.0.0.1:4173 \
  --model-base-url $MODEL_BASE_URL \
  --model-name $TRAINED_CHECKPOINT \
  --parallel 16 \
  --headless \
  --runs-dir runs/trained-eval

# Base checkpoint (identical command, change --model-name)
python -m bench_env.run \
  --split test \
  --agent generic_v2 \
  --env-url http://127.0.0.1:4173 \
  --model-base-url $MODEL_BASE_URL \
  --model-name $BASE_CHECKPOINT \
  --parallel 16 \
  --headless \
  --runs-dir runs/base-eval
```

Re-run each command 4 times (or pass `--repeat-n 4` if available in your local runner build) to get the 4 trials reported in the paper.

### Stage D — Real-device transfer (optional)

The paper validates transfer on a real Redmi Note 12 Turbo (1080×2400) using the same agent adapter through ADB.

> ⚠️ Real-device transfer involves operating real apps. Use **non-personal test accounts**, avoid payment / account-deactivation tasks, and treat the operation list as if your phone were public. The paper's 59-task signal-bucket subset excludes 8 tasks that cannot be safely or equivalently reproduced on device (3 irreversible account ops, 1 real-consumption op, 4 needing preset state not available on a clean install).

We do not ship the real-device harness publicly because it requires per-user account setup. The transfer procedure is documented in the paper §5.2 and Appendix; key elements:

- Same agent adapter, same prompts, same action vocabulary.
- Screenshots captured via ADB; actions executed via ADB / Playwright bindings.
- Coordinates in the agent's `[0, 1000]` space mapped to the device's physical resolution.
- Manual audit of every trajectory (the paper reports a 10.2 % VLM-judge misjudgment rate — programmatic judging structurally avoids this).

If you build a real-device harness on top of MobileGym, we'd love a PR adding it under `bench_env/real_device/`.

## 3. Efficiency numbers (Table 1)

```bash
# Profile memory and CPU during a parallel run
python -m bench_env.diagnose_perf --env-url http://localhost:5173 --apps wechat,redbook
```

This profiles per-instance memory and cold-start across the listed apps. For the paper-reported numbers (~400 MB / instance, ~3 s cold start, ~6 minutes for the full 256-task benchmark at 256-way parallelism), the dominant bottlenecks are JavaScript engine warm-up (cold start) and tab-context creation. Tuning notes are in [../runbooks/bench-inotify-limit.md](../runbooks/bench-inotify-limit.md).

## 4. VLM-judge misjudgment audit (paper §5.2)

The paper reports that a Qwen3.6-Plus VLM judge misclassifies 10.2 % of trajectories on the signal-bucket subset, motivating the programmatic-judge design. To reproduce the audit, run the benchmark with `--judge-mode vlm`:

```bash
python -m bench_env.run \
  --split test --judge-mode vlm \
  --agent generic_v2 --model-name $BASE_CHECKPOINT \
  --env-url http://127.0.0.1:4173 \
  --model-base-url $MODEL_BASE_URL \
  --judge-base-url $JUDGE_BASE_URL \
  --judge-model qwen3.6-plus \
  --parallel 16 --headless
```

Then diff the VLM verdict against the deterministic `state` verdict (which the runner always computes in parallel). Disagreements are the misjudgment cases.

## 5. Things that may differ from the paper

- **Network seed data.** Free-tier accounts on map / search APIs return different content over time; the simulator's bundled data is a frozen snapshot.
- **Model providers' moderation.** A few high-risk Payment tasks may be refused by some proprietary models in their current versions even if they weren't at paper time. The paper's Ethics Statement discusses this explicitly.
- **Judge audit panel.** L1–L4 difficulty strata are calibrated against an 8-model reference panel; if you re-calibrate with a different panel, expect modest shifts. The paper recommends annual re-calibration.
- **Hardware.** GRPO results may vary by ±1–2 pt across GPU types. The paper used 3× RTX Pro 6000.

## Where to go next

- 🤖 Plug in a new model for evaluation → [add-an-agent.md](add-an-agent.md)
- 📊 Submit your numbers → [../leaderboard.md](../leaderboard.md)
- 🐛 Stuck on parallel scaling → [../runbooks/bench-inotify-limit.md](../runbooks/bench-inotify-limit.md)
