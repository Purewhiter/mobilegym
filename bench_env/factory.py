"""
Factory module for creating components (Agent, Environment, LLM, etc.).

This module decouples component creation from the Runner logic.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional, Any, Union, TYPE_CHECKING, cast

if TYPE_CHECKING:
    from bench_env.config import RunnerConfig

ConfigType = Union[argparse.Namespace, "RunnerConfig"]

def _as_runner_config(config: ConfigType) -> "RunnerConfig":
    """Normalize CLI args to RunnerConfig (internal-only helper)."""
    from bench_env.config import RunnerConfig
    if isinstance(config, RunnerConfig):
        return config
    # argparse.Namespace boundary → RunnerConfig
    return RunnerConfig.from_args(cast(argparse.Namespace, config))


def create_llm(config: ConfigType) -> Any:
    """Create LLM client."""
    from bench_env.llm import LLMClient
    config = _as_runner_config(config)
    
    base_url = getattr(config, "model_base_url", None)
    model = getattr(config, "model_name", None)
    api_key = getattr(config, "model_api_key", None)
    
    if not base_url or not model:
        raise ValueError("--model-base-url and --model-name required")
    infer_timeout = getattr(config, "infer_timeout", 300.0)
    return LLMClient(
        base_url=base_url, api_key=api_key or None, model=model,
        total_timeout_s=infer_timeout,
    )


def create_agent(config: ConfigType, llm: Any = None) -> Any:
    """Create agent instance."""
    from bench_env.agent import get_agent_class, AgentConfig, HumanAgent
    config = _as_runner_config(config)

    verbose = not getattr(config, "quiet", False)
    
    # Unified agent name access
    agent_name = getattr(config, "agent", "unknown")
    
    agent_cls = get_agent_class(agent_name)

    # Human agent 不需要 LLM
    if agent_cls is HumanAgent:
        return agent_cls(AgentConfig(verbose=verbose))

    if llm is None:
        raise ValueError("LLM required for AI agents")

    model_args = {}
    if getattr(config, "temperature", None) is not None:
        model_args["temperature"] = config.temperature
    if getattr(config, "top_p", None) is not None:
        model_args["top_p"] = config.top_p
    if getattr(config, "max_tokens", None) is not None:
        model_args["max_tokens"] = config.max_tokens

    no_stream = getattr(config, "no_stream", False)
    physical_size = getattr(config, "physical_size", (1080, 2400))
    agent_config = AgentConfig(
        model_args=model_args, verbose=verbose, stream=not no_stream,
        screen_size=tuple(physical_size),
    )

    return agent_cls(llm=llm, config=agent_config)


def get_agent_name(config: ConfigType) -> str:
    """Get agent class name."""
    from bench_env.agent import get_agent_class
    config = _as_runner_config(config)
    agent_name = getattr(config, "agent", "unknown")
    return get_agent_class(agent_name).__name__


async def create_env(config: ConfigType) -> Any:
    """Create environment instance based on device type."""
    config = _as_runner_config(config)
    
    device = getattr(config, "device", "sim")
    coord_space = getattr(config, "coord_space", "norm_0_1000")
    delay = getattr(config, "delay_after_action", 1.0)
    verbose = not getattr(config, "quiet", False)
    physical_size = getattr(config, "physical_size", (1080, 2400))
    
    if device == "real":
        # Real device via ADB
        from bench_env.env.real_device import RealDeviceEnv
        
        device_serial = getattr(config, "device_serial", None)
        
        env = RealDeviceEnv(
            device_serial=device_serial,
            coord_space=coord_space,
            delay_after_action=delay,
            physical_size=physical_size,
        )
        await env.start()
        return env
    else:
        # Simulator via Playwright
        from bench_env.env import MobileGymEnv
        
        env_url = getattr(config, "env_url", None)
        headless = getattr(config, "headless", False)
        proxy = getattr(config, "proxy", None)

        # Pixel 7 defaults (与 EnvPool 保持一致)
        # NOTE: physical_size = viewport_size × device_scale_factor，
        #       修改 viewport 或 scale 时须同步更新 physical_size
        env = MobileGymEnv(
            url=env_url,
            headless=headless,
            proxy=proxy,
            coord_space=coord_space,
            delay_after_action=delay,
            verbose=verbose,
            viewport_size=(360, 800),
            physical_size=physical_size,
            device_scale_factor=3,
        )
        await env.start()
        return env


def create_recorder(config: ConfigType) -> Any:
    """Create run recorder."""
    from bench_env.env import RunRecorder
    config = _as_runner_config(config)
    
    runs_dir = getattr(config, "runs_dir", None)
    runs_dir = Path(runs_dir) if runs_dir else Path("runs")
    
    no_save = getattr(config, "no_save_trajectory", False)
    coord_space = getattr(config, "coord_space", "norm_0_1000")
    scale = getattr(config, "screenshot_scale", 0.3)
    fixed_run_dir = getattr(config, "run_dir", None)
    trajectory_dir_override = getattr(config, "trajectory_dir", None)

    return RunRecorder(
        runs_dir,
        save_trajectory=not no_save,
        coord_space=coord_space,
        screenshot_scale=scale,
        fixed_run_dir=fixed_run_dir,
        trajectory_dir_override=trajectory_dir_override,
    )


def _apply_task_filters(tasks: list[Any], config: Any) -> list[Any]:
    """Apply field-level filters.

    AND mode (default): all active filters must match.
    OR mode: at least one active filter must match.
    Within each field: OR (e.g. L1,L2 means L1 or L2; capabilities = ANY match).
    """
    f_difficulty = getattr(config, "filter_difficulty", None)
    f_objective = getattr(config, "filter_objective", None)
    f_composition = getattr(config, "filter_composition", None)
    f_scope = getattr(config, "filter_scope", None)
    f_capabilities = getattr(config, "filter_capabilities", None)
    or_mode = getattr(config, "filter_mode", "and") == "or"

    if not any([f_difficulty, f_objective, f_composition, f_scope, f_capabilities]):
        return tasks

    def _checks(t: Any) -> list[bool]:
        results = []
        if f_difficulty:
            results.append(getattr(t, "difficulty", None) in f_difficulty)
        if f_objective:
            results.append(getattr(t, "objective", None) in f_objective)
        if f_composition:
            results.append(getattr(t, "composition", None) in f_composition)
        if f_scope:
            results.append(getattr(t, "scope", None) in f_scope)
        if f_capabilities:
            task_caps = set(getattr(t, "capabilities", []) or [])
            results.append(bool(task_caps.intersection(f_capabilities)))
        return results

    if or_mode:
        return [t for t in tasks if any(_checks(t))]
    else:
        return [t for t in tasks if all(_checks(t))]


def load_tasks(config: ConfigType) -> list[Any]:
    """
    Load tasks based on config.
    """
    from bench_env.task import load_tasks as _load_tasks
    config = _as_runner_config(config)

    suite = getattr(config, "suite", None)
    sample_n = getattr(config, "sample_n", None)
    sample_seed = getattr(config, "sample_seed", None)

    tasks = _load_tasks(suite=suite, sample_n=sample_n, seed=sample_seed)

    task_id = getattr(config, "task_id", None)
    task_ids = getattr(config, "task_ids", None)
    if task_ids:
        # Match any full ID or base ID (for sampled instances with _i{n} suffix)
        # e.g., base "wechat.SetMomentsVisibleRange" matches "wechat.SetMomentsVisibleRange_i0"
        id_set = set(str(x) for x in task_ids if str(x).strip())
        tasks = [
            t
            for t in tasks
            if (t.id in id_set) or any(t.id.startswith(f"{tid}_i") for tid in id_set)
        ]
    elif task_id:
        # Match exact ID or base ID (for sampled instances with _i{n} suffix)
        # e.g., "wechat.SetMomentsVisibleRange" matches "wechat.SetMomentsVisibleRange_i0"
        tasks = [t for t in tasks if t.id == task_id or t.id.startswith(f"{task_id}_i")]

    tasks = _apply_task_filters(tasks, config)

    split_task_ids = getattr(config, "split_task_ids", None)
    if split_task_ids is not None:
        # Match by base id (strip "_i{n}" sampled-instance suffix) against the
        # whitelist. Composes as AND with other filters. An empty split (valid
        # but unusual) means zero matches — keep that distinct from "no split".
        from bench_env.splits import base_task_id
        tasks = [t for t in tasks if base_task_id(t.id) in split_task_ids]

    filter_has_af = getattr(config, "filter_has_answer_fields", None)
    if filter_has_af is not None:
        tasks = [
            t for t in tasks
            if bool(getattr(t, "answer_fields", None)) == filter_has_af
        ]

    # Apply external instruction overrides (loaded from --task-instructions JSON).
    # Match full id first (e.g. "wechat.Foo_i0"), then fall back to base id
    # ("wechat.Foo") for sampled instances without a per-instance override.
    overrides = getattr(config, "task_instructions", None)
    if overrides:
        unmatched = set(overrides.keys())
        for t in tasks:
            full_id = t.id
            base_id = full_id.split("_i")[0] if "_i" in full_id else full_id
            if full_id in overrides:
                t._instruction_override = overrides[full_id]
                unmatched.discard(full_id)
            elif base_id in overrides:
                t._instruction_override = overrides[base_id]
                unmatched.discard(base_id)
        if unmatched:
            from bench_env.logger import get_logger
            get_logger(__name__).warning(
                f"--task-instructions: {len(unmatched)} task id(s) had no matching task: "
                f"{sorted(unmatched)[:5]}{'...' if len(unmatched) > 5 else ''}"
            )

    if not tasks:
        raise ValueError("No tasks found")
    return tasks


def create_task_registry() -> Any:
    """Create task registry."""
    from bench_env.task import TaskRegistry
    return TaskRegistry()


def create_evaluator(config: ConfigType, default_llm: Any = None) -> Any:
    """
    Create Evaluator for task evaluation.
    
    Args:
        config: Runner configuration
        default_llm: Default LLM to use for VLM judge if no separate config
        
    Returns:
        Evaluator instance
    """
    from bench_env.runner.base import Evaluator
    
    config = _as_runner_config(config)
    
    judge_mode = getattr(config, "judge_mode", "auto")
    device = getattr(config, "device", "sim")
    judge_model = getattr(config, "judge_model", None)
    
    # Determine if VLM judge is needed
    # - Explicit vlm mode
    # - Auto mode with real device (no state data)
    # - Auto mode with explicit judge_model specified (user wants VLM)
    needs_vlm = (
        judge_mode == "vlm" or 
        (judge_mode == "auto" and device == "real") or
        (judge_mode == "auto" and judge_model is not None)
    )
    
    if not needs_vlm:
        # State-based evaluation only
        return Evaluator(judge_mode=judge_mode, eval_mode=getattr(config, "eval_mode", "grounded"))
    
    # Create VLM judge for VLM evaluation
    from bench_env.task.vlm_judge import VLMJudge
    from bench_env.llm import LLMClient
    
    # Get VLM judge config (fallback to agent's config)
    judge_base_url = getattr(config, "judge_base_url", None) or getattr(config, "model_base_url", None)
    judge_model = getattr(config, "judge_model", None) or getattr(config, "model_name", None)
    judge_api_key = getattr(config, "judge_api_key", None) or getattr(config, "model_api_key", None)
    
    vlm_judge = None
    if judge_base_url and judge_model:
        # Create separate LLM for judge
        judge_llm = LLMClient(base_url=judge_base_url, api_key=judge_api_key or None, model=judge_model)
        vlm_judge = VLMJudge(llm=judge_llm)
    elif default_llm:
        # Use default LLM
        vlm_judge = VLMJudge(llm=default_llm)
    
    return Evaluator(judge_mode=judge_mode, vlm_judge=vlm_judge,
                     eval_mode=getattr(config, "eval_mode", "grounded"))
