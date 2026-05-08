"""
MAI-UI Agent – faithful MAI-UI (Alibaba) navigation agent integration.

Replicates MAIUINaivigationAgent from MAI-UI/src/mai_naivigation_agent.py:
- System prompt, <thinking>/<tool_call> output format
- 0-999 coordinate space (SCALE_FACTOR = 999)
- Sliding-window history (history_n = 3)
- Message structure: system → instruction → [history images + responses] → current image
- History reconstruction via coordinate denormalization (matching mem2response)
- LLM params: temperature=0, top_p=1.0, seed=42, repetition_penalty=1.0, top_k=-1
"""

from __future__ import annotations

import copy
import json
import re
from dataclasses import dataclass
from typing import Any, Optional

from bench_env.agent.base import AgentConfig, BaseAgent, AgentStepRecord
from bench_env.env.base import Action, ActionType, Observation
from bench_env.llm import LLMClient

# ── Constants (matching MAI-UI) ───────────────────────────────────────────────
SCALE_FACTOR = 999
SWIPE_DELTA = 400  # 0-999 空间中的滑动距离

# ── System prompt (based on MAI-UI src/prompt.py MAI_MOBILE_SYS_PROMPT,
#    with double_click added from ASK_USER_MCP variant, and Available Apps
#    updated to match this simulator's installed apps) ─────────────────────────
SYSTEM_PROMPT = """You are a GUI agent. You are given a task and your action history, with screenshots. You need to perform the next action to complete the task.

## Output Format
For each function call, return the thinking process in <thinking> </thinking> tags, and a json object with function name and arguments within <tool_call></tool_call> XML tags:
```
<thinking>
...
</thinking>
<tool_call>
{"name": "mobile_use", "arguments": <args-json-object>}
</tool_call>
```

## Action Space

{"action": "click", "coordinate": [x, y]}
{"action": "long_press", "coordinate": [x, y]}
{"action": "double_click", "coordinate": [x, y]}
{"action": "type", "text": ""}
{"action": "swipe", "direction": "up or down or left or right", "coordinate": [x, y]} # "coordinate" is optional. Use the "coordinate" if you want to swipe a specific UI element.
{"action": "open", "text": "app_name"}
{"action": "drag", "start_coordinate": [x1, y1], "end_coordinate": [x2, y2]}
{"action": "system_button", "button": "button_name"} # Options: back, home, menu, enter
{"action": "wait"}
{"action": "terminate", "status": "success or fail"}
{"action": "answer", "text": "xxx"} # Use escape characters \\', \\", and \\n in text part to ensure we can parse the text in normal python string format.


## Note
- Write a small plan and finally summarize your next action (with its target element) in one sentence in <thinking></thinking> part.
- Available Apps: `["WeChat", "Alipay", "Maps", "Calendar", "Clock", "Notes", "Settings", "Phone", "Messages", "Gallery", "Files", "Browser", "Calculator", "Weather", "Compass", "Bilibili", "RedNote", "WeRead", "Tencent Meeting", "Railway 12306", "Spotify", "Reddit", "X", "eBay"]`.
You should use the `open` action to open the app as possible as you can, because it is the fast way to open the app.
- You must follow the Action Space strictly, and return the correct json object within <thinking> </thinking> and <tool_call></tool_call> XML tags.""".strip()


# ── Parsing helpers (exact replicas of MAI-UI src/mai_naivigation_agent.py) ───

def _parse_tagged_text(text: str) -> dict[str, Any]:
    """Parse <thinking> and <tool_call> tags (matches MAI-UI parse_tagged_text)."""
    # Handle thinking-model output: </think> instead of </thinking>
    if "</think>" in text and "</thinking>" not in text:
        text = text.replace("</think>", "</thinking>")
        text = "<thinking>" + text

    pattern = r"<thinking>(.*?)</thinking>.*?<tool_call>(.*?)</tool_call>"
    result: dict[str, Any] = {"thinking": None, "tool_call": None}

    match = re.search(pattern, text, re.DOTALL)
    if match:
        result = {
            "thinking": match.group(1).strip().strip('"'),
            "tool_call": match.group(2).strip().strip('"'),
        }

    if result["tool_call"]:
        try:
            result["tool_call"] = json.loads(result["tool_call"])
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in tool_call: {e}")

    return result


def _normalize_coordinate(coordinates: list) -> tuple[float, float]:
    """Normalize from SCALE_FACTOR range to [0, 1] (matches MAI-UI logic)."""
    if len(coordinates) == 2:
        px, py = coordinates
    elif len(coordinates) == 4:
        x1, y1, x2, y2 = coordinates
        px = (x1 + x2) / 2
        py = (y1 + y2) / 2
    else:
        raise ValueError(
            f"Invalid coordinate format: expected 2 or 4 values, got {len(coordinates)}"
        )
    return px / SCALE_FACTOR, py / SCALE_FACTOR


def _parse_action_to_structure_output(text: str) -> dict[str, Any]:
    """Parse model output → {thinking, action_json} (matches MAI-UI exactly)."""
    text = text.strip()
    results = _parse_tagged_text(text)
    thinking = results["thinking"]
    tool_call = results["tool_call"]
    action = tool_call["arguments"]

    for key in ("coordinate", "start_coordinate", "end_coordinate"):
        if key in action:
            px, py = _normalize_coordinate(action[key])
            action[key] = [px, py]

    return {"thinking": thinking, "action_json": action}


def _denormalize_coordinate(coord: list[float]) -> list[int]:
    """Convert [0,1] back to 0-999 integer (matches MAI-UI mem2response)."""
    if len(coord) >= 2:
        return [int(coord[0] * SCALE_FACTOR), int(coord[1] * SCALE_FACTOR)]
    return coord  # type: ignore[return-value]


def _reconstruct_response(thinking: str, action_json: dict) -> str:
    """Reconstruct assistant response for history (matches MAI-UI mem2response).

    Format:
        <thinking>
        {thinking}
        </thinking>
        <tool_call>
        {"name":"mobile_use","arguments":{...}}
        </tool_call>
    """
    aj = copy.deepcopy(action_json)
    # 原始 MAI-UI mem2response 只反归一化 coordinate，不处理 start/end_coordinate
    if "coordinate" in aj:
        aj["coordinate"] = _denormalize_coordinate(aj["coordinate"])

    tool_call_dict = {"name": "mobile_use", "arguments": aj}
    tool_call_json = json.dumps(tool_call_dict, separators=(",", ":"))
    return (
        f"<thinking>\n{thinking}\n</thinking>\n"
        f"<tool_call>\n{tool_call_json}\n</tool_call>"
    )


# ── Coordinate conversion helpers ────────────────────────────────────────────

def _coord_to_env(normalized: list[float]) -> list[int]:
    """[0,1] normalized → bench_env 0-999 clamped."""
    x = max(0, min(999, int(round(normalized[0] * SCALE_FACTOR))))
    y = max(0, min(999, int(round(normalized[1] * SCALE_FACTOR))))
    return [x, y]


def _direction_to_points(
    direction: str, coordinate: Optional[list[float]] = None,
) -> tuple[list[int], list[int]]:
    """MAI-UI direction-based swipe → bench_env (point1, point2)."""
    if coordinate:
        cx, cy = _coord_to_env(coordinate)
    else:
        cx, cy = 500, 500

    if direction == "up":
        return [cx, cy], [cx, max(0, cy - SWIPE_DELTA)]
    elif direction == "down":
        return [cx, cy], [cx, min(999, cy + SWIPE_DELTA)]
    elif direction == "left":
        return [cx, cy], [max(0, cx - SWIPE_DELTA), cy]
    elif direction == "right":
        return [cx, cy], [min(999, cx + SWIPE_DELTA), cy]
    # fallback: treat as up
    return [cx, cy], [cx, max(0, cy - SWIPE_DELTA)]


# ── MAI-UI trajectory step (for faithful history reconstruction) ─────────────

@dataclass
class _MAIUIStep:
    """Per-step MAI-UI data retained for history message reconstruction."""
    thinking: str
    action_json: dict
    image_data_url: str
    ask_user_response: str = ""
    mcp_response: str = ""


# ── Agent ─────────────────────────────────────────────────────────────────────

class MAIUIAgent(BaseAgent):
    """
    MAI-UI style agent (faithful replica of MAIUINaivigationAgent).

    Message structure (per MAI-UI _build_messages):
        [system] system_prompt
        [user]   instruction text
        ── for each history step ──
        [user]   screenshot (only for last history_n-1 steps)
        [asst]   <thinking>…</thinking><tool_call>…</tool_call>
        [user]   ask_user reply (if present)
        ── end loop ──
        [user]   current screenshot
    """

    SYSTEM_PROMPT = SYSTEM_PROMPT

    ACTION_MAP = {
        "click": (
            ActionType.CLICK,
            lambda p: {"point": _coord_to_env(p["coordinate"])},
        ),
        "long_press": (
            ActionType.LONG_PRESS,
            lambda p: {"point": _coord_to_env(p["coordinate"])},
        ),
        "double_click": (
            ActionType.DOUBLE_TAP,
            lambda p: {"point": _coord_to_env(p["coordinate"])},
        ),
        "type": (
            ActionType.TYPE,
            lambda p: {"value": p.get("text", "")},
        ),
        "swipe": (
            ActionType.SWIPE,
            lambda p: (lambda pts: {"point1": pts[0], "point2": pts[1]})(
                _direction_to_points(p.get("direction", "up"), p.get("coordinate"))
            ),
        ),
        "drag": (
            ActionType.SWIPE,
            lambda p: {
                "point1": _coord_to_env(p["start_coordinate"]),
                "point2": _coord_to_env(p["end_coordinate"]),
            },
        ),
        "open": (
            ActionType.AWAKE,
            lambda p: {"value": p.get("text", "")},
        ),
        "system_button": (  # 死代码: parse_response 拦截后按 button 值分派
            ActionType.BACK,
            lambda p: {},
        ),
        "wait": (
            ActionType.WAIT,
            lambda p: {},
        ),
        "terminate": (
            ActionType.COMPLETE,
            lambda p: {"return": p.get("status", "success")},
        ),
        "answer": (
            ActionType.ANSWER,
            lambda p: {"value": p.get("text", "")},
        ),
        "ask_user": (
            ActionType.INFO,
            lambda p: {"value": p.get("text", "")},
        ),
    }

    DEFAULT_MODEL_ARGS = {
        "temperature": 0.0,
        "top_p": 1.0,
        "max_tokens": 2048,
        "frequency_penalty": 0.0,
        "presence_penalty": 0.0,
        "seed": 42,
        "extra_body": {"repetition_penalty": 1.0, "top_k": -1},
    }

    HISTORY_N = 3  # MAI-UI default history_n

    # ==================== Init / lifecycle ====================

    def __init__(self, llm: LLMClient, config: Optional[AgentConfig] = None):
        super().__init__(config)
        self.llm = llm
        self._mai_steps: list[_MAIUIStep] = []

        merged_args = dict(self.DEFAULT_MODEL_ARGS)
        merged_args.update(self.config.model_args or {})
        self.config.model_args = merged_args

    @property
    def name(self) -> str:
        return "MAIUIAgent"

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []
        self._mai_steps = []

    def add_user_comment(self, comment: str) -> None:
        """Attach user reply to the last step (matches MAI-UI ask_user flow)."""
        if self._mai_steps:
            self._mai_steps[-1].ask_user_response = str(comment or "")

    # ==================== Message building ====================

    def build_messages(self, obs: Observation) -> list[dict[str, Any]]:
        """Build messages exactly as MAI-UI _build_messages does.

        1. system  → system_prompt (content as list)
        2. user    → instruction text (content as list)
        3. per history step:
              [user image]  (only for last HISTORY_N-1 steps)
              [assistant]   reconstructed response
              [user text]   ask_user reply (if any)
        4. user    → current screenshot
        """
        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": [{"type": "text", "text": self.SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [{"type": "text", "text": self._task}],
            },
        ]

        n = len(self._mai_steps)

        if n > 0:
            start_image_idx = max(0, n - (self.HISTORY_N - 1))

            for idx, step in enumerate(self._mai_steps):
                # Only last HISTORY_N-1 steps get images
                if idx >= start_image_idx:
                    messages.append({
                        "role": "user",
                        "content": [{
                            "type": "image_url",
                            "image_url": {"url": step.image_data_url},
                        }],
                    })

                # Always add assistant response
                history_response = _reconstruct_response(
                    step.thinking, step.action_json,
                )
                messages.append({
                    "role": "assistant",
                    "content": [{"type": "text", "text": history_response}],
                })

                # ask_user reply (matches MAI-UI mem2ask_user_response)
                if step.ask_user_response:
                    messages.append({
                        "role": "user",
                        "content": [{"type": "text", "text": step.ask_user_response}],
                    })
                # mcp_response (matches MAI-UI mem2mcp_response)
                if step.mcp_response:
                    messages.append({
                        "role": "user",
                        "content": [{"type": "text", "text": step.mcp_response}],
                    })

            # Current screenshot
            messages.append({
                "role": "user",
                "content": [{
                    "type": "image_url",
                    "image_url": {"url": obs.image_data_url},
                }],
            })
        else:
            # No history – just current screenshot
            messages.append({
                "role": "user",
                "content": [{
                    "type": "image_url",
                    "image_url": {"url": obs.image_data_url},
                }],
            })

        return messages

    # ==================== Response parsing ====================

    def parse_response(self, response_text: str) -> Action:
        """Parse LLM response using MAI-UI parsing logic."""
        raw = str(response_text or "").strip()
        if not raw:
            return Action(
                action_type=ActionType.NOOP,
                data={"error": "empty_response"},
                raw_response=raw,
            )

        try:
            parsed = _parse_action_to_structure_output(raw)
        except Exception:
            return Action(
                action_type=ActionType.NOOP,
                data={"error": f"parse_failed: {raw[:200]}"},
                raw_response=raw,
            )

        thinking = parsed["thinking"] or ""
        action_json = parsed["action_json"]
        action_name = str(action_json.get("action", "")).strip().lower()

        if not action_name:
            return Action(
                action_type=ActionType.NOOP,
                data={"error": "no_action_field"},
                thought=thinking,
                raw_response=raw,
            )

        # system_button: dispatch by button value (same as gui_owl)
        if action_name == "system_button":
            button = str(action_json.get("button", "")).strip().lower()
            type_map = {
                "home": ActionType.HOME,
                "enter": ActionType.ENTER,
                "menu": ActionType.RECENT,
            }
            return Action(
                action_type=type_map.get(button, ActionType.BACK),
                data={},
                thought=thinking,
                raw_response=raw,
            )

        return self.parse_action(
            action_name,
            action_json,
            thought=thinking,
            raw_response=raw,
        )

    # ==================== Core act ====================

    def act(self, obs: Observation) -> Action:
        """Generate action from observation."""
        messages = self.build_messages(obs)

        if self.config.verbose:
            print(f"\n[MAIUIAgent] Step {obs.step_idx}, sending prompt...")

        response = self.llm.chat(
            messages=messages,
            args={
                **self.config.model_args,
                "stream": self.config.stream,
                "stream_print": self.config.stream,
            },
        )
        llm_output = response.content

        if self.config.verbose and not self.config.stream:
            print(f"\n[LLM Response]\n{llm_output}\n")

        action = self.parse_response(llm_output)

        try:
            parsed_data = _parse_action_to_structure_output(llm_output)
            thinking = parsed_data["thinking"] or ""
            action_json = parsed_data["action_json"]
        except Exception:
            thinking = ""
            action_json = {"action": action.action_type.name.lower()}

        # Record MAI-UI step (for faithful history reconstruction)
        self._mai_steps.append(_MAIUIStep(
            thinking=thinking,
            action_json=action_json,
            image_data_url=obs.image_data_url,
        ))

        self._history.append(AgentStepRecord(
            step_idx=obs.step_idx,
            observation=obs,
            action=action,
            llm_response=llm_output,
            llm_prompt=messages,
        ))

        # Memory: evict old Observation/prompt heavy data
        self._evict_old_records(keep_recent=self.HISTORY_N + 1)
        # Memory: clear image URLs outside history window
        window_start = max(0, len(self._mai_steps) - self.HISTORY_N)
        for i in range(window_start):
            self._mai_steps[i].image_data_url = ""

        if self.config.verbose:
            print(f"[MAIUIAgent] Action: {action.action_type}, Data: {action.data}")

        return action
