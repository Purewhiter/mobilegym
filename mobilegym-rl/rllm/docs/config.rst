Config:
------
This document extends the `Verl configuration documentation <https://verl.readthedocs.io/en/latest/examples/config.html>`_ and describes configs introduced in RLLM for async/partial rollout/env-agent APIs.

``actor_rollout_ref.rollout.mode``
    ``sync`` or ``async``. Selects between synchronous and asynchronous rollout engine. Currently applicable only to AgentPPOTrainer.

``agent.max_steps``
    Set this to specify the maximum number of steps per agent trajectory in the environment.

``agent.use_stepwise_advantage``
    Enables per-step reward and advantage computation. Affects padding and broadcast logic.

``agent.stepwise_advantage_mode``
    Strategy for assigning advantage across steps. Supported: ``broadcast``, ``mc_return``.

``agent.n_parallel_agents``
    Used to control degree of parallel rollout agents in async rollout engine.

``agent.trajectory_timeout``
    Optional timeout for agent rollout execution.

``agent.normalize_step_advantage``
    Normalize advantage values across number of steps in trajectory. Used during advantage broadcast.

``agent.engine_args``
    Dictionary of engine-level args for rollout executor (e.g., vLLM async server flags).

``agent.agent_args``
    Dict of kwargs passed to agent class constructor during rollout execution.

``env.env_args``
    Dict of kwargs passed to env class constructor during rollout execution.

``algorithm.mask_truncated_samples``
    Whether to zero gradients for truncated trajectories.

``algorithm.clip_advantages``
    Whether to clamp advantages to stabilize updates.

``trainer.rejection_sample``
    Whether to apply rejection sampling based on rewards (filter all pass/fail samples).

``trainer.total_training_steps``
    Total steps before training stops.
