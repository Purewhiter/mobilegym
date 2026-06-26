"""Train Mobilegym agents with rLLM AgentFlow.

Usage:
    python cookbooks/mobilegym/train.py rllm/backend=verl actor_rollout_ref.model.path=<vlm-model-path>
"""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("RLLM_HOME", str(_REPO_ROOT / ".rllm_local"))
_COOKBOOK_DIR = Path(__file__).resolve().parent
_pythonpath_entries = [str(_COOKBOOK_DIR)]
if os.environ.get("PYTHONPATH"):
    _pythonpath_entries.append(os.environ["PYTHONPATH"])
os.environ["PYTHONPATH"] = os.pathsep.join(_pythonpath_entries)

import hydra
from omegaconf import DictConfig

try:
    from .bootstrap import patch_verl_set_loss_fn
    from . import mobilegym_flow
    from .evaluator import mobilegym_evaluator
    from .mobilegym_flow import RuntimeConfig, load_mobilegym_dataset
except ImportError:
    from bootstrap import patch_verl_set_loss_fn
    import mobilegym_flow
    from evaluator import mobilegym_evaluator
    from mobilegym_flow import RuntimeConfig, load_mobilegym_dataset
from rllm.data import DatasetRegistry
from rllm.experimental.unified_trainer import AgentTrainer


def _slice_dataset(dataset, max_tasks: int | None):
    if max_tasks is None:
        return dataset
    max_tasks = max(0, min(int(max_tasks), len(dataset)))
    return dataset.select(range(max_tasks))


def _normalize_suite_name(suite: str | list[str] | None) -> str:
    if suite is None:
        return "all"
    if isinstance(suite, str):
        return suite.replace(",", "_")
    return "_".join(str(item) for item in suite)


def _normalize_optional_str(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if text.lower() in {"", "none", "null", "all", "*"}:
        return None
    return text


def _optional_config_value(config: DictConfig, key: str, caster):
    value = config.get(key, None)
    if value is None:
        return None
    if isinstance(value, str) and value.strip().lower() in {"", "none", "null"}:
        return None
    return caster(value)


def _build_runtime_config(config: DictConfig, pool_size: int) -> RuntimeConfig:
    defaults = RuntimeConfig()
    run_name = str(config.get("run_name", f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"))

    agent_model_args: dict[str, float | int] = {}
    agent_temperature = _optional_config_value(config, "agent_temperature", float)
    if agent_temperature is not None:
        agent_model_args["temperature"] = agent_temperature
    agent_top_p = _optional_config_value(config, "agent_top_p", float)
    if agent_top_p is not None:
        agent_model_args["top_p"] = agent_top_p
    agent_max_tokens = _optional_config_value(config, "agent_max_tokens", int)
    if agent_max_tokens is not None:
        agent_model_args["max_tokens"] = agent_max_tokens

    agent_val_model_args: dict[str, float | int] = {}
    agent_val_temperature = _optional_config_value(config, "agent_val_temperature", float)
    if agent_val_temperature is not None:
        agent_val_model_args["temperature"] = agent_val_temperature
    agent_val_top_p = _optional_config_value(config, "agent_val_top_p", float)
    if agent_val_top_p is not None:
        agent_val_model_args["top_p"] = agent_val_top_p

    return RuntimeConfig(
        env_url=str(config.get("env_url", defaults.env_url)),
        env_pool_size=pool_size,
        env_isolation=str(config.get("env_isolation", defaults.env_isolation)),
        env_num_browsers=int(config.get("env_num_browsers", defaults.env_num_browsers)),
        env_headless=bool(config.get("env_headless", defaults.env_headless)),
        env_proxy=config.get("env_proxy", defaults.env_proxy),
        coord_space=str(config.get("coord_space", defaults.coord_space)),
        delay_after_action=float(config.get("delay_after_action", defaults.delay_after_action)),
        agent_type=str(config.get("agent_type", defaults.agent_type)),
        agent_stream=bool(config.get("agent_stream", defaults.agent_stream)),
        agent_verbose=bool(config.get("agent_verbose", defaults.agent_verbose)),
        agent_model_args=agent_model_args,
        agent_val_model_args=agent_val_model_args,
        max_steps=int(config.get("max_steps", defaults.max_steps)),
        judge_mode=str(config.get("judge_mode", defaults.judge_mode)),
        eval_mode=str(config.get("eval_mode", defaults.eval_mode)),
        loop_detect=int(config.get("loop_detect", defaults.loop_detect)),
        run_name=run_name,
        runs_dir=str(
            config.get(
                "runs_dir",
                f"logs/{config.rllm.trainer.project_name}/{config.rllm.trainer.experiment_name}",
            )
        ),
        save_trajectory=bool(config.get("save_trajectory", defaults.save_trajectory)),
        screenshot_scale=float(config.get("screenshot_scale", defaults.screenshot_scale)),
        monitor=bool(config.get("monitor", defaults.monitor)),
    )


@hydra.main(config_path="pkg://rllm.experimental.config", config_name="unified", version_base=None)
def main(config: DictConfig):
    backend = str(config.rllm.get("backend", config.get("backend", "tinker")))
    pool_size = int(config.get("env_pool_size", config.rllm.workflow.n_parallel_tasks))
    config.rllm.workflow.n_parallel_tasks = pool_size

    cfg = _build_runtime_config(config, pool_size)
    cfg.to_env_vars()
    mobilegym_flow.set_config(cfg)

    suite = _normalize_optional_str(config.get("suite", None))
    task_split = _normalize_optional_str(config.get("split", "train"))
    sample_n = int(config.get("sample_n", 1))
    task_seed = int(config.get("task_seed", 42))
    train_max_tasks = config.get("max_train_tasks", None)
    val_max_tasks = config.get("max_val_tasks", None)

    train_dataset = load_mobilegym_dataset(
        suite=suite,
        task_split=task_split,
        sample_n=sample_n,
        seed=task_seed,
        max_tasks=train_max_tasks,
        name="mobilegym",
        split="train",
    )

    if bool(config.get("shared_val", True)):
        val_dataset = _slice_dataset(train_dataset, val_max_tasks)
        val_dataset.split = "val"
    else:
        val_task_split = _normalize_optional_str(config.get("val_split", "test"))
        val_dataset = load_mobilegym_dataset(
            suite=_normalize_optional_str(config.get("val_suite", suite)),
            task_split=val_task_split,
            sample_n=int(config.get("val_sample_n", sample_n)),
            seed=int(config.get("val_task_seed", task_seed + 1)),
            max_tasks=val_max_tasks,
            name="mobilegym",
            split="val",
        )

    if backend == "verl":
        patch_verl_set_loss_fn()

        dataset_name = str(
            config.get(
                "dataset_name",
                f"mobilegym_{_normalize_suite_name(suite)}_{config.rllm.trainer.experiment_name}",
            )
        )
        train_dataset = DatasetRegistry.register_dataset(
            dataset_name,
            train_dataset.get_data(),
            split="train",
        )
        val_dataset = DatasetRegistry.register_dataset(
            dataset_name,
            val_dataset.get_data(),
            split="test",
        )

    trainer = AgentTrainer(
        backend=backend,
        agent_flow=mobilegym_flow.mobilegym_flow,
        evaluator=mobilegym_evaluator,
        config=config,
        train_dataset=train_dataset,
        val_dataset=val_dataset,
    )
    trainer.train()


if __name__ == "__main__":
    main()
