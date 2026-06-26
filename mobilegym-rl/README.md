<div align="center">

`mobilegym-rl` trains vision-language GUI agents with reinforcement learning against the
[MobileGym](../README.md) simulated Android environment. Agents run as browser rollouts in
`bench_env`, the runner records each episode, the state-based judge produces a reward, and
[verl](./verl) performs the policy update (GRPO by default). The orchestration is built on
[rLLM](https://github.com/rllm-org/rllm) — this tree vendors a pinned copy of rLLM, `verl`, and
the model gateway so the whole stack is reproducible.

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  VLM agent   │──▶│  bench_env    │──▶│ state judge  │──▶│  verl/GRPO   │
│ (policy)     │   │ browser env   │   │ (reward)     │   │ policy update│
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
        ▲                                                        │
        └──────────────── updated weights ◀──────────────────────┘
```
</div>

## Repository layout

| Path                                                                                              | What it is                                                                 |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`cookbooks/mobilegym/`](./cookbooks/mobilegym)                                                    | The training entry point — flow, evaluator, dataset loader, launch script |
| [`cookbooks/mobilegym/train.py`](./cookbooks/mobilegym/train.py)                                   | Hydra entry; builds datasets +`AgentTrainer`                             |
| [`cookbooks/mobilegym/train_qwen3_vl_4b_verl.sh`](./cookbooks/mobilegym/train_qwen3_vl_4b_verl.sh) | Canonical Qwen3-VL-4B GRPO launch config                                   |
| [`cookbooks/mobilegym/mobilegym_flow.py`](./cookbooks/mobilegym/mobilegym_flow.py)                 | Rollout logic +`bench_env` env pool wiring                               |
| [`cookbooks/mobilegym/serve_explorer.py`](./cookbooks/mobilegym/serve_explorer.py)                 | Local viewer for recorded training trajectories                            |
| [`verl/`](./verl)                                                                                  | Vendored verl`0.7.1` (training backend)                                  |
| [`rllm-model-gateway/`](./rllm-model-gateway)                                                      | Vendored token-capturing model gateway                                     |
| [`install.sh`](./install.sh)                                                                       | One-shot install for the training environment                              |

`bench_env` itself lives in the parent MobileGym checkout (`../bench_env`) and is imported via
`sys.path` injection by [`bootstrap.py`](./cookbooks/mobilegym/bootstrap.py) — it is **not** a
pip-installed package, so its dependencies must be installed explicitly (handled by `install.sh`).

## Prerequisites

- A CUDA GPU machine. Reference setup: **8 × RTX PRO 6000 Blackwell (sm_120, 96 GB)**; the canonical script uses 2 GPUs.
- The MobileGym frontend built and served (see [Start the environment](#1-start-the-environment)).
- A clean Python 3.12 environment (conda recommended).

This stack is version-sensitive. The reference, verified-working combination is:

| Package      | Version                    |
| ------------ | -------------------------- |
| python       | 3.12                       |
| torch        | 2.10.0+cu128               |
| vllm         | 0.17.0                     |
| verl         | 0.7.1 (vendored, editable) |
| flash-attn   | 2.8.1 (prebuilt wheel)     |
| transformers | >=4.55,<5                  |

> ⚠️ Pin vllm — some versions (incl. but not limited to `0.22.1`) have bugs that make Qwen3-VL
> grounding inaccurate. `0.17.0` is verified-good.

## Installation

```bash
conda create -n mobilegym python=3.12 -y
conda activate mobilegym

cd mobilegym-rl
bash install.sh
```

## Usage

### 1. Start the environment

Training rollouts hit the simulator at `env_url` (default `https://localhost:4180`). From the MobileGym root:

> The env may fetch some external resources at runtime. Training works without them; if you need them on a machine without direct
> internet access, set `env_proxy` in the training config (e.g. `http://127.0.0.1:7890`).

```bash
cd ..                       # mobilegym root
npm run build
./scripts/server/start_nginx_gateway.sh        # → https://localhost:4180
curl -skI https://localhost:4180 | head -1     # expect 200
# stop with: ./scripts/server/start_nginx_gateway.sh stop
```

### 2. Launch training

```bash
conda activate mobilegym
cd mobilegym-rl
bash cookbooks/mobilegym/train_qwen3_vl_4b_verl.sh
```

The model defaults to the HF repo id `Qwen/Qwen3-VL-4B-Instruct` (auto-downloaded). Override with a
local checkout to skip the download:

```bash
MODEL_PATH=/path/to/Qwen3-VL-4B-Instruct \
bash cookbooks/mobilegym/train_qwen3_vl_4b_verl.sh
```

Other env-var overrides: `CUDA_VISIBLE_DEVICES`, `EXPERIMENT_NAME`, `RUN_NAME`, `SPLIT`. The script
logs to `[console,swanlab]`; set `SWANLAB_MODE=offline` for a first run if you don't have a swanlab
account. Outputs:

- Terminal log → `logs/mobilegym/<EXPERIMENT_NAME>/<RUN_NAME>/terminal.log`
- Checkpoints → `checkpoints/mobilegym/<EXPERIMENT_NAME>/<RUN_NAME>/`
- Trajectories → under the run's `logs/.../` tree

#### Data sampling knobs

`+sample_n=N` (script arg) controls **dataset diversity** — how many distinct parameter instances
are generated per task class. `+task_seed=42` makes the sampling reproducible (same seed → same
instances/params, identical every epoch), and `+sample_templates=true` varies the instruction
wording per instance.

> Because each epoch replays the exact same instances, raising `total_epochs` alone re-trains on identical params — use `sample_n` for more data variety instead if need.

### 3. Inspect trajectories

```bash
python cookbooks/mobilegym/serve_explorer.py --port 8765 --logs-dir logs/mobilegym/<EXPERIMENT_NAME>
# then open http://localhost:8765
```

### 4. Export a checkpoint to HuggingFace format

Training saves FSDP-sharded checkpoints (`actor/model_world_size_*_rank_*.pt`), not loadable HF
weights. Use verl's model merger to consolidate the shards into a standard `from_pretrained`-ready
directory. The merger reads the model config + tokenizer/processor from `actor/huggingface/`
automatically.

```bash
conda activate mobilegym
cd mobilegym-rl

CKPT=checkpoints/mobilegym/<EXPERIMENT_NAME>/<RUN_NAME>/global_step_<N>/actor
OUT=checkpoints/mobilegym/<EXPERIMENT_NAME>/<RUN_NAME>/global_step_<N>/hf

PYTHONPATH=verl:$PYTHONPATH python -m verl.model_merger merge \
  --backend fsdp \
  --local_dir "$CKPT" \
  --target_dir "$OUT"
```

Notes:

- Run from the repo root with `PYTHONPATH=verl` so `verl` resolves to the vendored editable copy
  (otherwise `import verl` may hit an empty namespace package).
- `--local_dir` must point at the `actor/` directory of a `global_step_<N>` checkpoint.
- `$OUT` ends up with `model-*.safetensors` + `model.safetensors.index.json`, `config.json`,
  `generation_config.json`, and the full tokenizer/processor files — load it with
  `AutoModelForImageTextToText.from_pretrained("$OUT")`.

## Acknowledgements

Built on [rLLM](https://github.com/rllm-org/rllm) and [verl](https://github.com/volcengine/verl).
