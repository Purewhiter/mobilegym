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

    Action commands (drive the device from the terminal / a piped stdin,
    coordinates in screenshot pixel space, same convention as LLM agents):
    - 't x y'            CLICK at (x, y)
    - 'dt x y'           DOUBLE_TAP at (x, y)
    - 'lp x y'           LONG_PRESS at (x, y)
    - 's x1 y1 x2 y2'    SWIPE from (x1, y1) to (x2, y2)
    - 'd x1 y1 x2 y2'    DRAG from (x1, y1) to (x2, y2)
    - 'i <text>'         TYPE text into the focused field
    - 'b' / 'h' / 'r' / 'e'  BACK / HOME / RECENT / ENTER
    - 'w [seconds]'      WAIT (default 1s)
    - 'o <appId>'        AWAKE (launch app by id)
    - 'done [text]'      Mark task as COMPLETE (same as pressing Enter)
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

        parsed = self._parse_action_command(raw_input)
        if parsed is not None:
            print(f"[Human] {parsed.action_type.value}: {parsed.data}")
            return parsed

        # Default: mark as complete
        print(f"[Human] Marking task as complete. Return value: {raw_input}")
        return_val = raw_input if raw_input else "Human completed the task"
        return Action(
            action_type=ActionType.COMPLETE,
            data={"return": return_val},
            summary=f"Human completed the task with return value: {return_val}",
        )

    @staticmethod
    def _parse_action_command(raw: str) -> Action | None:
        """Parse a terminal action command into an Action, or None if it is
        not an action command (falls through to the COMPLETE default)."""
        parts = raw.split()
        if not parts:
            return None
        cmd, args = parts[0].lower(), parts[1:]

        def ints(n: int) -> list[int] | None:
            if len(args) < n:
                return None
            try:
                return [int(float(a)) for a in args[:n]]
            except ValueError:
                return None

        if cmd == 't' and (p := ints(2)):
            return Action(ActionType.CLICK, {"point": p}, summary=f"Human tap {p}")
        if cmd == 'dt' and (p := ints(2)):
            return Action(ActionType.DOUBLE_TAP, {"point": p}, summary=f"Human double-tap {p}")
        if cmd == 'lp' and (p := ints(2)):
            return Action(ActionType.LONG_PRESS, {"point": p}, summary=f"Human long-press {p}")
        if cmd == 's' and (p := ints(4)):
            return Action(ActionType.SWIPE, {"point1": p[:2], "point2": p[2:]},
                          summary=f"Human swipe {p[:2]} -> {p[2:]}")
        if cmd == 'd' and (p := ints(4)):
            return Action(ActionType.DRAG, {"point1": p[:2], "point2": p[2:]},
                          summary=f"Human drag {p[:2]} -> {p[2:]}")
        if cmd == 'i':
            text = raw[len(parts[0]):].strip()
            return Action(ActionType.TYPE, {"value": text}, summary=f"Human type: {text}")
        if cmd == 'b':
            return Action(ActionType.BACK, {}, summary="Human back")
        if cmd == 'h':
            return Action(ActionType.HOME, {}, summary="Human home")
        if cmd == 'r':
            return Action(ActionType.RECENT, {}, summary="Human recent")
        if cmd == 'e':
            return Action(ActionType.ENTER, {}, summary="Human enter")
        if cmd == 'w':
            try:
                secs = float(args[0]) if args else 1.0
            except ValueError:
                secs = 1.0
            return Action(ActionType.WAIT, {"value": secs}, summary=f"Human wait {secs}s")
        if cmd == 'o' and args:
            return Action(ActionType.AWAKE, {"value": args[0]}, summary=f"Human open app {args[0]}")
        if cmd == 'done':
            text = raw[len(parts[0]):].strip() or "Human completed the task"
            return Action(ActionType.COMPLETE, {"return": text},
                          summary=f"Human completed the task with return value: {text}")
        return None
