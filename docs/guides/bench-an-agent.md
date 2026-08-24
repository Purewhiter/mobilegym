# Bench an Agent

How to evaluate an agent — yours or one of the reference panel — on MobileGym-Bench.

## 1. Pick an agent adapter

The repository ships adapters for every agent reported in the paper. Match the `--agent` flag to the schema your model expects:

| Agent flag             | Built-in for                                                     | When to pick it                                                                                                                |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--agent generic_v2` | Any general-purpose VLM emitting `<think>` + `<answer>` JSON | All non-GUI-specialist models — proprietary (Gemini 3.1 Pro, Doubao-Seed-2.0-Pro, Qwen3.6-Plus) and open-source (Qwen3-VL-4B) |
| `--agent generic`    | Plain JSON action objects                                        | Quick integration for models that can emit one JSON action per step                                                            |
| `--agent autoglm`    | AutoGLM-Phone family                                             | AutoGLM-Phone-9B                                                                                                               |
| `--agent uitars`     | UI-TARS family                                                   | UI-TARS-1.5-7B                                                                                                                 |
| `--agent venus`      | UI-Venus family                                                  | UI-Venus-1.5-8B                                                                                                                |
| `--agent gui_owl`    | GUI-Owl family                                                   | GUI-Owl-1.5-8B-Think                                                                                                           |
| `--agent gelab`      | Step-GUI family                                                  | Step-GUI-4B                                                                                                                    |
| `--agent mai_ui`     | MAI-UI style                                                     | MAI-UI / multimodal-action-interface checkpoints                                                                               |
| `--agent human`      | Manual driver (Playwright Inspector)                             | Sanity checks, task authoring                                                                                                  |

Writing your own adapter? See [add-an-agent.md](add-an-agent.md).

## 2. Run the benchmark

The canonical configuration mirrors the paper's leaderboard run on the 256-task test split:

```bash
export MODEL_BASE_URL=http://localhost:8001/v1
export MODEL_API_KEY=your-api-key
export MODEL_NAME=your-model-name

python -m bench_env.run \
  --split test \
  --agent <flag> \
  --env-url http://localhost:4173 \
  --model-base-url "$MODEL_BASE_URL" \
  --model-api-key "$MODEL_API_KEY" \
  --model-name "$MODEL_NAME" \
  --parallel 8 --isolation pages \
  --headless
```

Step budgets are derived automatically from each task's `difficulty` field: L1 = 15, L2 = 30, L3 = 45, L4 = 60, plus an extra +15 for AnswerSheet tasks.

For higher concurrency layouts (multi-process sharding, browser sizing), see [`bench_env/README.md`](../../bench_env/README.md#-scaling-up-parallel--sharding); the kernel-limit and isolation rules you must respect at scale are in [`bench_env/docs/KNOWN_ISSUES.md`](../../bench_env/docs/KNOWN_ISSUES.md).

## 3. Trials and pass@k

Leaderboard convention from the paper:

- **Open-source models** — 4 trials each, pass@1 / pass@4 reported.
- **Proprietary / closed-source models** — 1 trial (cost), occasionally a single sanity rerun.

Run 4 trials and compute pass@k in one shot:

```bash
python -m bench_env.run \
  --split test --repeat-n 4 --pass-k 1,4 \
  --agent <flag> --model-name "$MODEL_NAME" \
  --env-url http://localhost:4173 \
  --model-base-url "$MODEL_BASE_URL" \
  --model-api-key "$MODEL_API_KEY" \
  --parallel 32 --isolation browsers --headless
```

Details on the flags: [`bench_env/README.md` §Sampling &amp; Pass@k](../../bench_env/README.md#-sampling--pass-k).

## Where to go next

- 🤖 Write your own adapter → [add-an-agent.md](add-an-agent.md)
- 📊 Submit your numbers → open a PR adding a row to the leaderboard table in [`../../README.md`](../../README.md)
- 🐛 Scaling issues at high `--parallel` → [`../../bench_env/docs/KNOWN_ISSUES.md`](../../bench_env/docs/KNOWN_ISSUES.md)
