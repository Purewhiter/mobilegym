"""
Human agent - waits for human to complete task manually.

Used for:
- Verifying judge functions work correctly
- Human baseline testing
- Task feasibility validation
"""

from __future__ import annotations

from bench_env.agent.base import BaseAgent, AgentConfig
from bench_env.env.base import Action, ActionType, Observation


class HumanAgent(BaseAgent):
    """
    Human agent that waits for user input.
    
    This agent doesn't use any LLM. It simply:
    1. Shows the current observation to the user
    2. Waits for user to manually operate the device
    3. User presses Enter when done (or types action commands)
    
    Input options:
    - Press Enter: Mark task as COMPLETE
    - Type 'q' or 'quit': ABORT the task
    - Type 'c' or 'continue': Continue to next step (for step-by-step mode)
    - Type 'a <text>' or 'answer <text>': Submit ANSWER without ending task
    """

    def __init__(self, config: AgentConfig | None = None):
        super().__init__(config)
        self._step_count = 0

    @property
    def name(self) -> str:
        return "human"

    def reset(self, task: str) -> None:
        """Reset for new task."""
        self._task = task
        self._history = []
        self._step_count = 0
        print(f"\n{'='*60}")
        print(f"[Human Mode] Task: {task}")
        print(f"{'='*60}")
        print("Operate the device manually, then press Enter when done.")
        print("Commands: Enter=COMPLETE, q=ABORT, c=CONTINUE, a <text>=ANSWER")
        print(f"{'='*60}\n")

    def build_messages(self, obs: Observation) -> list[dict]:
        """Not used for HumanAgent."""
        return []

    def parse_response(self, response_text: str) -> Action:
        """Not used for HumanAgent."""
        return Action(action_type=ActionType.COMPLETE, summary="Human action")

    def act(self, obs: Observation) -> Action:
        """
        Wait for human input and return corresponding action.
        
        Args:
            obs: Current observation (displayed to user for reference)
            
        Returns:
            Action based on user input
        """
        self._step_count += 1
        
        # Show step info
        print(f"\n[Step {self._step_count}] Waiting for human input...")
        
        # Wait for user input
        raw_input = input(">>> ").strip()
        user_input = raw_input.lower()
        
        if user_input in ('q', 'quit', 'abort'):
            print("[Human] Aborting task")
            return Action(
                action_type=ActionType.ABORT,
                summary="User aborted the task",
            )
        elif user_input == "a" or user_input == "answer" or user_input.startswith("a ") or user_input.startswith("answer "):
            # 提取答案文本：去掉命令前缀
            prefix = "answer " if user_input.startswith("answer") else "a "
            answer_text = raw_input[len(prefix):].strip() if raw_input.lower() not in ("a", "answer") else ""
            print(f"[Human] Submitting answer: {answer_text}")
            return Action(
                action_type=ActionType.ANSWER,
                data={"value": answer_text},
                summary=f"Human submitted answer: {answer_text}",
            )
        elif user_input in ('c', 'continue', 'next'):
            print("[Human] Continuing to next step...")
            # Return a WAIT action to continue without doing anything
            return Action(
                action_type=ActionType.WAIT,
                data={"value": 0.1},
            )
        else:
            # Default: mark as complete
            print(f"[Human] Marking task as complete. Return value: {raw_input}")
            return_val = raw_input if raw_input else "Human completed the task"
            return Action(
                action_type=ActionType.COMPLETE,
                data={"return": return_val},
                summary=f"Human completed the task with return value: {return_val}",
            )
