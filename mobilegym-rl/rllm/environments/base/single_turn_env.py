import warnings
from typing import Any

from rllm.environments.base.multi_turn_env import MultiTurnEnvironment
from rllm.rewards.reward_fn import RewardFunction, zero_reward


class SingleTurnEnvironment(MultiTurnEnvironment):
    """
    A simple environment for single-turn interactions with LLMs.
    This is a special case of MultiTurnEnvironment where max_turns=1.
    The environment provides a question/prompt and evaluates the response using a custom reward function.
    """

    def __init__(self, task: dict | None = None, reward_fn: RewardFunction | None = None, **kwargs):
        """
        Initialize the single turn environment.

        Args:
            task: Dictionary containing the task information, including at least a "question" field
        """
        super().__init__(task=task, max_turns=1, **kwargs)
        if reward_fn is None:
            warnings.warn("No reward function provided, using zero reward", stacklevel=2)
        self.reward_fn = reward_fn or zero_reward

    def get_reward_and_next_obs(self, task: dict, action: Any) -> tuple[float, dict]:
        """
        Compute the reward based on the task and action.

        Args:
            task: The task dictionary containing relevant information
            action: The action taken by the agent

        Returns:
            Tuple of (reward: float, next_observation: Dict)
        """
        reward_output = self.reward_fn(task_info=task, action=action)

        return reward_output.reward, {}

    @staticmethod
    def from_dict(env_args: dict) -> "SingleTurnEnvironment":
        reward_fn = env_args.pop("reward_fn", None)
        if "task" in env_args:
            task = env_args["task"]
        else:
            task = env_args
        return SingleTurnEnvironment(task=task, reward_fn=reward_fn)
