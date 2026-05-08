"""
GUI-Owl 1.5 Agent - GUI-Owl 1.5 style agent implementation.
"""

from __future__ import annotations

import json
import re

from typing import Any, Optional

from bench_env.agent.base import AgentConfig, BaseAgent, AgentStepRecord
from bench_env.env.base import Action, ActionType, Observation
from bench_env.llm import LLMClient


# ---------------------------------------------------------------------------
# 官方 SYSTEM_PROMPT
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = '''# Tools

You may call one or more functions to assist with the user query.

You are provided with function signatures within <tools></tools> XML tags:
<tools>
{"type": "function", "function": {"name_for_human": "mobile_use", "name": "mobile_use", "description": "Use a touchscreen to interact with a mobile device, and take screenshots.
* This is an interface to a mobile device with touchscreen. You can perform actions like clicking, typing, swiping, etc.
* Some applications may take time to start or process actions, so you may need to wait and take successive screenshots to see the results of your actions.
* The screen's resolution is 1000x1000.
* Make sure to click any buttons, links, icons, etc with the cursor tip in the center of the element. Don't click boxes on their edges unless asked.", "parameters": {"properties": {"action": {"description": "The action to perform. The available actions are:
* `key`: Perform a key event on the mobile device.
    - This supports adb's `keyevent` syntax.
    - Examples: \"volume_up\", \"volume_down\", \"power\", \"camera\", \"clear\".
* `click`: Click the point on the screen with coordinate (x, y).
* `long_press`: Press the point on the screen with coordinate (x, y) for specified seconds.
* `swipe`: Swipe from the starting point with coordinate (x, y) to the end point with coordinates2 (x2, y2).
* `type`: Input the specified text into the activated input box.
* `system_button`: Press the system button.
* `open`: Open an app on the device.
* `wait`: Wait specified seconds for the change to happen.
* `answer`: Terminate the current task and output the answer.
* `terminate`: Terminate the current task and report its completion status.", "enum": ["key", "click", "long_press", "swipe", "type", "system_button", "open", "wait", "answer", "terminate"], "type": "string"}, "coordinate": {"description": "(x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to move the mouse to. Required only by `action=click`, `action=long_press`, and `action=swipe`.", "type": "array"}, "coordinate2": {"description": "(x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to move the mouse to. Required only by `action=swipe`.", "type": "array"}, "text": {"description": "Required only by `action=key`, `action=type`, `action=open`, `action=answer`.", "type": "string"}, "time": {"description": "The seconds to wait. Required only by `action=long_press` and `action=wait`.", "type": "number"}, "button": {"description": "Back means returning to the previous interface, Home means returning to the desktop, Menu means opening the application background menu, and Enter means pressing the enter. Required only by `action=system_button`", "enum": ["Back", "Home", "Menu", "Enter"], "type": "string"}, "status": {"description": "The status of the task. Required only by `action=terminate`.", "type": "string", "enum": ["success", "failure"]}}, "required": ["action"], "type": "object"}, "args_format": "Format the arguments as a JSON object."}}
</tools>

For each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:
<tool_call>
{"name": <function-name>, "arguments": <args-json-object>}
</tool_call>

# Response format

Response format for every step:
1) Action: a short imperative describing what to do in the UI.
2) A single <tool_call>...</tool_call> block containing only the JSON: {"name": <function-name>, "arguments": <args-json-object>}.

Rules:
- Output exactly in the order: Action, <tool_call>.
- Be brief: one for Action.
- Do not output anything else outside those two parts.
- If finishing, use action=terminate in the tool call.'''


class GUIOwl15Agent(BaseAgent):
    """
    GUI-Owl 1.5 style agent.

    严格对齐官方 utils.py + run_gui_owl_1_5_for_mobile.py：
    - SYSTEM_PROMPT：官方原文
    - 输出格式：<tool_call> JSON，name=mobile_use，arguments 含 action 字段
    - 动作名（action 字段值）：click / long_press / swipe / type /
                               system_button / open / wait / answer /
                               interact / terminate / key
    - 坐标参数：coordinate / coordinate2（官方参数名）
    - build_messages：history_n=5 滑动窗口 + 早期文字摘要（对齐官方 last_image=5）
    - 历史摘要：取 "Action:" 到 "<tool_call>" 之间的文字
    """

    SYSTEM_PROMPT = SYSTEM_PROMPT

    # ==================== 动作映射 ====================

    ACTION_MAP = {
        "click": (
            ActionType.CLICK,
            lambda p: {"point": GUIOwl15Agent._parse_coordinate(p.get("coordinate"))},
        ),
        "long_press": (
            ActionType.LONG_PRESS,
            lambda p: {"point": GUIOwl15Agent._parse_coordinate(p.get("coordinate"))},
        ),
        "swipe": (
            ActionType.SWIPE,
            lambda p: {
                "point1": GUIOwl15Agent._parse_coordinate(p.get("coordinate")),
                "point2": GUIOwl15Agent._parse_coordinate(p.get("coordinate2")),
                "duration": 800,  # 对齐官方 AdbTools.slide 默认 800ms
            },
        ),
        "type": (
            ActionType.TYPE,
            lambda p: {"value": p.get("text", "")},
        ),
        "system_button": (  # 死代码：parse_response 拦截后按 button 值分派 BACK/HOME/ENTER/RECENT
            ActionType.BACK,
            lambda p: {},
        ),
        "open": (
            ActionType.AWAKE,
            lambda p: {"value": p.get("text", "")},
        ),
        "wait": (
            ActionType.WAIT,
            lambda p: {"value": float(p.get("time", 2))},
        ),
        "answer": (
            ActionType.ANSWER,
            lambda p: {"value": p.get("text", "")},
        ),
        "interact": (
            ActionType.INFO,
            lambda p: {"value": p.get("text", "")},
        ),
        "terminate": (
            ActionType.COMPLETE,
            lambda p: {"return": p.get("status", "success")},
        ),
        "key": (
            ActionType.NOOP,
            lambda p: {"action": "key", "text": p.get("text", "")},
        ),
        # ---- 容错别名 ----
        "scroll": (  # 来自日常版 run_gui_owl_1_5_for_mobile.py L224（AndroidWorld 版无此别名）
            ActionType.SWIPE,
            lambda p: {
                "point1": GUIOwl15Agent._parse_coordinate(p.get("coordinate")),
                "point2": GUIOwl15Agent._parse_coordinate(p.get("coordinate2")),
                "duration": 800,  # 对齐官方 AdbTools.slide 默认 800ms
            },
        ),
        "open_app": (  # 来自 AndroidWorld 版 mobile_agent_utils_new.py L199
            ActionType.AWAKE,
            lambda p: {"value": p.get("text", "")},
        ),
    }

    DEFAULT_MODEL_ARGS = {
        "temperature": 0.0,
        # "top_p": 1.0,
        # "max_tokens": 4096,
    }

    HISTORY_N = 5

    # ==================== 初始化 ====================

    def __init__(self, llm: LLMClient, config: Optional[AgentConfig] = None):
        super().__init__(config)
        self.llm = llm
        self._pending_comment = ""

        merged_args = dict(self.DEFAULT_MODEL_ARGS)
        merged_args.update(self.config.model_args or {})
        self.config.model_args = merged_args

    @property
    def name(self) -> str:
        return "GUIOwl15Agent"

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []
        self._pending_comment = ""

    def add_user_comment(self, comment: str) -> None:
        """添加用户回复（用于 interact 动作）"""
        self._pending_comment = str(comment or "")

    @staticmethod
    def _parse_coordinate(raw: Any) -> Optional[list[int]]:
        """
        GUI-Owl 1.5 输出 0-1000 相对坐标（system prompt: 1000x1000）。
        环境使用 0-999 坐标空间，直接透传并 clamp。
        """
        if raw is None:
            return None
        if not isinstance(raw, (list, tuple)) or len(raw) < 2:
            return None
        try:
            x = float(raw[0])
            y = float(raw[1])
        except (TypeError, ValueError):
            return None

        x = max(0, min(999, int(round(x))))
        y = max(0, min(999, int(round(y))))
        return [x, y]

    @staticmethod
    def _extract_display_summary(output_text: str) -> str:
        """提取适合命令行展示的简短动作描述。"""
        text = str(output_text or "").strip()
        if not text:
            return ""

        match = re.search(r"Action:\s*(.+?)(?=<tool_call>|$)", text, re.DOTALL | re.IGNORECASE)
        if match:
            return " ".join(match.group(1).split())

        parsed_call = GUIOwl15Agent._parse_tool_call(text)
        arguments = parsed_call.get("arguments", {}) if isinstance(parsed_call, dict) else {}
        if not isinstance(arguments, dict):
            return ""

        action = str(arguments.get("action", "")).strip().lower()
        if not action:
            return ""
        if action in {"click", "long_press"}:
            return f"{action} {arguments.get('coordinate')}"
        if action == "swipe":
            return f"swipe {arguments.get('coordinate')} -> {arguments.get('coordinate2')}"
        if action in {"open", "type", "answer", "interact"}:
            payload = arguments.get("text")
            return f"{action} {payload!r}"
        if action == "wait":
            return f"wait {arguments.get('time', 2)}s"
        if action == "system_button":
            return f"system_button {arguments.get('button', 'Back')}"
        if action == "terminate":
            return f"terminate {arguments.get('status', 'success')}"
        return action

    # ==================== 响应解析 ====================
    @staticmethod
    def _parse_tool_call(output_text: str) -> dict[str, Any]:
        """
        从模型输出中提取 <tool_call> JSON。

        官方原始逻辑（run_gui_owl_1_5_for_mobile.py parse_action）：
            tool_call_block = output_text.split("<tool_call>\n")[1]
            json_str = tool_call_block.split("}}\n")[0] + "}}"
            return json.loads(json_str)

        官方 tool call 结构：
            {"name": "mobile_use", "arguments": {"action": "click", "coordinate": [500, 300]}}
        """
        if "<tool_call>" not in output_text:
            return {}

        try:
            tool_call_block = output_text.split("<tool_call>\n")[1]
            json_str = tool_call_block.split("}}\n")[0] + "}}"
            parsed = json.loads(json_str)
            if "name" in parsed:
                return parsed
        except (IndexError, json.JSONDecodeError):
            pass

        tag_match = re.search(
            r"<tool_call>\s*(.*?)\s*(?:</tool_call>|$)",
            output_text, re.DOTALL | re.IGNORECASE
        )
        if tag_match:
            json_str = tag_match.group(1).strip()
            if json_str.count("{") < json_str.count("}"):
                json_str = re.sub(r"}}\s*$", "}", json_str)
            try:
                parsed = json.loads(json_str)
                if "name" in parsed:
                    return parsed
            except json.JSONDecodeError:
                pass

        return {}

    def _parse_llm_output(self, response_text: str) -> dict[str, Any]:
        """
        解析 LLM 输出为结构化字典。

        官方模型输出格式：
            Action: <短描述>\n
            <tool_call>\n
            {"name": "mobile_use", "arguments": {"action": "click", "coordinate": [500, 300]}}\n
            </tool_call>

        Returns:
            {
                "action": str,     # arguments.action 字段值（小写）
                "params": dict,    # arguments 完整字典
                "raw_action": str, # 原始 JSON 字符串
            }
        """
        raw = str(response_text or "").strip()
        if not raw:
            return {
                "action": "interact",
                "params": {"action": "interact", "text": "empty_response"},
                "raw_action": "",
                "summary": "",
            }

        parsed_call = self._parse_tool_call(raw)
        action_summary = self._extract_display_summary(raw)

        if not parsed_call or "arguments" not in parsed_call:
            return {
                "action": "interact",
                "params": {"action": "interact", "text": f"无法解析模型输出: {raw[:200]}"},
                "raw_action": "",
                "summary": action_summary,
            }

        arguments = parsed_call.get("arguments", {})
        if not isinstance(arguments, dict):
            arguments = {}

        action_name = str(arguments.get("action", "")).strip().lower()
        if not action_name:
            return {
                "action": "interact",
                "params": {"action": "interact", "text": "action 字段为空"},
                "raw_action": json.dumps(parsed_call, ensure_ascii=False),
                "summary": action_summary,
            }

        return {
            "action": action_name,
            "params": arguments,
            "raw_action": json.dumps(parsed_call, ensure_ascii=False),
            "summary": action_summary,
        }

    def parse_response(self, response_text: str) -> Action:
        """解析 LLM 响应为 Action"""
        parsed = self._parse_llm_output(response_text)
        action_name = str(parsed.get("action", "interact")).strip().lower()
        # 来自 AndroidWorld 版 agents/gui_owl.py L317: tap → click 别名
        if action_name == "tap":
            action_name = "click"
        params = parsed.get("params", {})

        if action_name == "system_button":
            button = str(params.get("button", "")).strip()
            if button == "Home":
                return Action(
                    action_type=ActionType.HOME,
                    data={},
                    thought="",
                    raw_response=response_text,
                )
            elif button == "Enter":
                return Action(
                    action_type=ActionType.ENTER,
                    data={},
                    thought="",
                    raw_response=response_text,
                )
            elif button == "Menu":
                return Action(
                    action_type=ActionType.RECENT,
                    data={},
                    thought="",
                    raw_response=response_text,
                )
            else:
                # Back（默认）
                return Action(
                    action_type=ActionType.BACK,
                    data={},
                    thought="",
                    raw_response=response_text,
                )

        return self.parse_action(
            action_name,
            params,
            thought="",
            summary=parsed.get("summary", ""),
            raw_response=response_text,
        )

    # ==================== 历史摘要提取 ====================

    @staticmethod
    def _extract_action_summary(output_text: str, model_name: str = "") -> str:
        """
        从模型输出中提取动作摘要文本。

        官方逻辑（build_messages 中）：
            if model_name.endswith(".mem"):
                text = text.split("<tool_call>")[0].strip()
            else:
                if "Action:" in text and "<tool_call>" in text:
                    text = text.split("Action:")[1].split("<tool_call>")[0].strip()
        """
        text = str(output_text or "").strip()
        if model_name.endswith(".mem"):
            if "<tool_call>" in text:
                text = text.split("<tool_call>")[0].strip()
        else:
            if "Action:" in text and "<tool_call>" in text:
                text = text.split("Action:")[-1].split("<tool_call>")[0].strip()
        return text

    # ==================== 消息构建 ====================

    def build_messages(self, obs: Observation) -> list[dict[str, Any]]:
        """
        构建发送给 LLM 的消息。

        完全对齐官方 build_messages 逻辑：
        1. history_n=4：只保留最近 4 步的截图
        2. 早于 history_n 的步骤：只提取动作摘要文字（不含截图）
        3. instruction_prompt：包含日期、任务、早期动作摘要
        4. 消息结构：
           - system：官方 SYSTEM_PROMPT
           - history 窗口第一条：instruction_prompt + 该步截图
           - history 窗口后续：只有截图
           - 每条 history 后跟 assistant 消息（完整模型输出）
           - 最后：当前截图（无 instruction_prompt）
           - 若无 history：instruction_prompt + 当前截图
        5. 消息格式：OpenAI image_url 格式（base64 data URL）
        """
        n = len(self._history)
        # 官方 last_image=5 包含当前截图，历史窗口实际为 HISTORY_N - 1
        max_history_images = self.HISTORY_N - 1
        history_start_idx = max(0, n - max_history_images)
        model_name = getattr(self.llm, "model", "")

        # 窗口外步骤：只需 llm_response（observation 可能已被瘦身清空）
        previous_actions = []
        for i in range(history_start_idx):
            r = self._history[i]
            summary = self._extract_action_summary(r.llm_response, model_name)
            previous_actions.append(f"Step{i + 1}: {summary}")

        previous_actions_str = "\n".join(previous_actions) if previous_actions else "No previous action."

        instruction_prompt = (
            f"Please generate the next move according to the UI screenshot, "
            f"instruction and previous actions.\n\n"
            f"Instruction: {self._task}\n\n"
            f"Previous actions:\n{previous_actions_str}"
        )

        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": self.SYSTEM_PROMPT,
            }
        ]

        # 窗口内步骤：需要截图
        history_window = [
            {"output": r.llm_response, "image_data_url": r.observation.image_data_url}
            for r in self._history[history_start_idx:]
        ]
        history_len = len(history_window)

        if history_len > 0:
            for idx, item in enumerate(history_window):
                if idx == 0:
                    user_content: list[dict[str, Any]] = [
                        {"type": "text", "text": instruction_prompt},
                        {"type": "image_url", "image_url": {"url": item["image_data_url"]}},
                    ]
                else:
                    user_content = [
                        {"type": "image_url", "image_url": {"url": item["image_data_url"]}},
                    ]

                messages.append({"role": "user", "content": user_content})
                messages.append({
                    "role": "assistant",
                    "content": item["output"],
                })

            current_content: list[dict[str, Any]] = [
                {"type": "image_url", "image_url": {"url": obs.image_data_url}},
            ]
        else:
            current_content = [
                {"type": "text", "text": instruction_prompt},
                {"type": "image_url", "image_url": {"url": obs.image_data_url}},
            ]

        if self._pending_comment:
            current_content.append({
                "type": "text",
                "text": f"\n[User Reply] {self._pending_comment}",
            })

        messages.append({"role": "user", "content": current_content})
        return messages

    # ==================== 核心逻辑 ====================

    def act(self, obs: Observation) -> Action:
        """生成动作"""
        # # 官方行为：上一步为 answer 时，自动发 terminate(success)
        # if self._history and self._history[-1].action.action_type == ActionType.ANSWER:
        #     action = Action.complete(
        #         message="success",
        #         raw_response="[auto-terminate after answer]",
        #     )
        #     self._history.append(AgentStepRecord(
        #         step_idx=obs.step_idx,
        #         observation=obs,
        #         action=action,
        #         llm_response="[auto-terminate after answer]",
        #         llm_prompt=[],
        #         user_comment="",
        #     ))
        #     if self.config.verbose:
        #         print(f"[GUIOwl15Agent] Auto-terminate after ANSWER")
        #         print(f"[GUIOwl15Agent] Action: {action.action_type}, Data: {action.data}")
        #     return action

        messages = self.build_messages(obs)

        if self.config.verbose:
            print(f"\n[GUIOwl15Agent] Step {obs.step_idx}, sending prompt...")

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

        self._history.append(AgentStepRecord(
            step_idx=obs.step_idx,
            observation=obs,
            action=action,
            llm_response=llm_output,
            llm_prompt=messages,
            user_comment=self._pending_comment,
        ))

        # 内存瘦身：窗口外旧记录清空截图和 prompt
        self._evict_old_records(keep_recent=self.HISTORY_N + 1)

        self._pending_comment = ""

        if self.config.verbose:
            if action.summary:
                print(f"[GUIOwl15Agent] Intent: {action.summary}")
            print(f"[GUIOwl15Agent] Action: {action.action_type}, Data: {action.data}")

        return action
