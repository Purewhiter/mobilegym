"""
UI-TARS Agent - UI-TARS style agent implementation.

Reference: https://github.com/bytedance-seed/UI-TARS
Prompt source: prompt.py -> MOBILE_USE_DOUBAO
"""

from __future__ import annotations

import math
import re
from typing import Any, Optional

from bench_env.agent.base import AgentConfig, BaseAgent, AgentStepRecord
from bench_env.env.base import Action, ActionType, Observation
from bench_env.llm import LLMClient


class UITarsAgent(BaseAgent):
    """
    UI-TARS mobile agent.
    """

    SYSTEM_PROMPT = """You are a GUI agent. You are given a task and your action history, with screenshots. You need to perform the next action to complete the task. 
## Output Format
```
Thought: ...
Action: ...
```
## Action Space

click(point='<point>x1 y1</point>')
long_press(point='<point>x1 y1</point>')
type(content='') #If you want to submit your input, use "\\n" at the end of `content`.
scroll(point='<point>x1 y1</point>', direction='down or up or right or left')
open_app(app_name='')
drag(start_point='<point>x1 y1</point>', end_point='<point>x2 y2</point>')
press_home()
press_back()
finished(content='xxx') # Use escape characters \\', \\", and \\n in content part to ensure we can parse the content in normal python string format.


## Note
- Use {language} in `Thought` part.
- Write a small plan and finally summarize your next action (with its target element) in one sentence in `Thought` part.

## User Instruction
{instruction}
"""

    # ACTION_MAP 在 __init__ 中构建（需绑定实例的 smart_resize 尺寸）

    DEFAULT_MODEL_ARGS = {
        "temperature": 0.0,
        # "top_p": 1.0,
        # "max_tokens": 400,
    }

    # 论文 §4.1 公式(3): 保留最近 N 步截图，更早步骤仅保留文本
    # "We set the N in Eq. 3 to 5 throughout this section." (§5)
    HISTORY_WINDOW_SIZE = 5

    @staticmethod
    def _parse_point(raw: Any) -> Optional[list]:
        """
        解析官方 <point>x y</point> 格式坐标为 [x, y]。

        官方格式：point='<point>500 300</point>'（空格分隔）
        也兼容其他格式：
          - "<point>500 300</point>"
          - "(500, 300)" / "[500, 300]"
          - [500, 300]（已是列表）
        """
        if raw is None:
            return None
        if isinstance(raw, (list, tuple)) and len(raw) >= 2:
            return [int(raw[0]), int(raw[1])]
        s = str(raw).strip()
        point_match = re.search(r"<point>\s*([\d.]+)\s+([\d.]+)\s*</point>", s)
        if point_match:
            return [int(float(point_match.group(1))), int(float(point_match.group(2)))]
        s = s.strip("<>point/").strip("[]").strip("()")
        parts = re.split(r"[,\s]+", s.strip())
        try:
            return [int(float(parts[0])), int(float(parts[1]))]
        except (ValueError, IndexError):
            return None

    @staticmethod
    def _smart_resize(height: int, width: int, factor: int = 28) -> tuple[int, int]:
        """Qwen2.5-VL smart_resize: dims divisible by factor, pixels in range."""
        min_pixels = 100 * factor * factor
        max_pixels = 16384 * factor * factor
        h_bar = max(factor, round(height / factor) * factor)
        w_bar = max(factor, round(width / factor) * factor)
        if h_bar * w_bar > max_pixels:
            beta = math.sqrt((height * width) / max_pixels)
            h_bar = math.floor(height / beta / factor) * factor
            w_bar = math.floor(width / beta / factor) * factor
        elif h_bar * w_bar < min_pixels:
            beta = math.sqrt(min_pixels / (height * width))
            h_bar = math.ceil(height * beta / factor) * factor
            w_bar = math.ceil(width * beta / factor) * factor
        return h_bar, w_bar

    @staticmethod
    def _to_norm(raw: Any, smart_w: int, smart_h: int) -> Optional[list]:
        """
        Parse coordinate and convert from smart_resize space to 0-999 norm.

        V1.5 (Qwen2.5-VL) outputs absolute pixel coords in smart_resize space.
        Formula: norm = coord / smart_resize_dim * 1000, clamped to [0, 999].
        """
        point = UITarsAgent._parse_point(raw)
        if point is None:
            return None
        x = max(0, min(999, round(point[0] / smart_w * 1000)))
        y = max(0, min(999, round(point[1] / smart_h * 1000)))
        return [x, y]

    @staticmethod
    def _make_scroll_parser(smart_w: int, smart_h: int):
        """Create scroll parser bound to specific smart_resize dims.

        UI-TARS direction semantics (from official prompt.py):
          "Show more information on the `direction` side."
        i.e. direction = content scroll direction, NOT finger swipe direction.
          - direction='down' → show content below → finger swipes UP
          - direction='up'   → show content above → finger swipes DOWN
        Swipe is expressed as point1 (start) → point2 (end) in finger movement.
        So the swipe vector must be OPPOSITE to the declared direction.

        Ref: official action_parser.py maps direction='down' → pyautogui.scroll(-5)
        (negative = scroll down = finger up on touchscreen).
        """
        def _parse_scroll(params: dict) -> dict:
            center = UITarsAgent._to_norm(params.get("point"), smart_w, smart_h)
            if center is None:
                center = [500, 500]
            x, y = center
            direction = str(params.get("direction", "down")).lower().strip()
            dist = 300
            # direction = 内容滚动方向，swipe finger = 反方向
            if direction == "up":        # 看上方内容 → 手指向下滑
                end = [x, min(999, y + dist)]
            elif direction == "down":    # 看下方内容 → 手指向上滑
                end = [x, max(0, y - dist)]
            elif direction == "left":    # 看左方内容 → 手指向右滑
                end = [min(999, x + dist), y]
            elif direction == "right":   # 看右方内容 → 手指向左滑
                end = [max(0, x - dist), y]
            else:
                end = [x, max(0, y - dist)]  # 默认同 down
            return {"point1": center, "point2": end}
        return _parse_scroll

    # ==================== 初始化 ====================

    def __init__(self, llm: LLMClient, config: Optional[AgentConfig] = None,
                 *, language: str = "Chinese"):
        super().__init__(config)
        self.llm = llm
        self.language = language
        self._pending_comment = ""

        # Compute smart_resize dims for coordinate conversion
        w, h = self.config.screen_size
        self._smart_h, self._smart_w = self._smart_resize(h, w)

        # Build ACTION_MAP bound to this instance's smart_resize dims
        sw, sh = self._smart_w, self._smart_h
        to_norm = lambda raw: UITarsAgent._to_norm(raw, sw, sh)
        self.ACTION_MAP = {
            "click": (ActionType.CLICK,
                      lambda p: {"point": to_norm(
                          p.get("point") or p.get("start_box") or p.get("box"))}),
            "long_press": (ActionType.LONG_PRESS,
                           lambda p: {"point": to_norm(
                               p.get("point") or p.get("start_box") or p.get("box"))}),
            "type": (ActionType.TYPE,
                     lambda p: {"value": p.get("content", "")}),
            "scroll": (ActionType.SWIPE,
                       self._make_scroll_parser(sw, sh)),
            "open_app": (ActionType.AWAKE,
                         lambda p: {"value": p.get("app_name", "")}),
            "drag": (ActionType.DRAG,
                     lambda p: {"point1": to_norm(p.get("start_point")),
                                "point2": to_norm(p.get("end_point"))}),
            "press_home": (ActionType.HOME, lambda p: {}),
            "press_back": (ActionType.BACK, lambda p: {}),
            "finished": (ActionType.COMPLETE,
                         lambda p: {"return": p.get("content", "")}),
            "call_user": (ActionType.INFO,
                          lambda p: {"value": p.get("content", "")}),
        }

        merged_args = dict(self.DEFAULT_MODEL_ARGS)
        merged_args.update(self.config.model_args or {})
        self.config.model_args = merged_args

    @property
    def name(self) -> str:
        return "UITarsAgent"

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []
        self._pending_comment = ""

    def add_user_comment(self, comment: str) -> None:
        self._pending_comment = str(comment or "")

    # ==================== 响应解析 ====================
    @staticmethod
    def _parse_params(params_str: str) -> dict[str, Any]:
        """
        解析函数调用参数字符串为字典。

        支持：
          point='<point>500 300</point>'
          content='text'
          direction='up'
          app_name='WeChat'
          start_point='<point>100 200</point>'
        """
        params: dict[str, Any] = {}
        if not params_str.strip():
            return params

        pattern = re.compile(
            r"(\w+)\s*=\s*"
            r"(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"|([^,)]+))"
        )
        for m in pattern.finditer(params_str):
            key = m.group(1)
            if m.group(2) is not None:
                params[key] = m.group(2)
            elif m.group(3) is not None:
                params[key] = m.group(3)
            else:
                val = m.group(4).strip()
                try:
                    params[key] = float(val) if '.' in val else int(val)
                except ValueError:
                    params[key] = val
        return params

    def _parse_llm_output(self, response_text: str) -> dict[str, Any]:
        """
        解析 LLM 输出

        Returns:
            {
                "action": str,      # 动作名称（小写）
                "params": dict,     # 动作参数
                "think": str,       # Thought 内容
                "raw_action": str,  # 原始 Action 字符串
            }
        """
        raw = str(response_text or "").strip()
        if not raw:
            return {
                "action": "call_user",
                "params": {"content": "empty_response"},
                "think": "",
                "raw_action": "",
            }

        think = ""
        thought_match = re.search(r"Thought:\s*(.+?)(?=\nAction:|$)", raw, re.DOTALL)
        if thought_match:
            think = thought_match.group(1).strip()

        action_str = ""
        action_match = re.search(r"Action:\s*(.+?)(?:\n|$)", raw, re.DOTALL)
        if action_match:
            action_str = action_match.group(1).strip().split("\n")[0].strip()
            action_str = action_str.strip("`")

        if not action_str:
            func_match = re.search(
                r"(click|long_press|type|scroll|open_app|drag"
                r"|press_home|press_back|finished|call_user)\s*\(",
                raw, re.IGNORECASE,
            )
            if func_match:
                action_str = raw[func_match.start():].strip().split("\n")[0].strip()

        if not action_str:
            return {
                "action": "call_user",
                "params": {"content": f"无法解析模型输出: {raw[:200]}"},
                "think": think,
                "raw_action": "",
            }

        paren_start = action_str.find("(")
        if paren_start == -1:
            func_name = action_str.strip().lower()
            params_str = ""
        else:
            func_name = action_str[:paren_start].strip().lower()
            paren_end = action_str.rfind(")")
            params_str = (
                action_str[paren_start + 1:paren_end]
                if paren_end > paren_start
                else action_str[paren_start + 1:]
            )

        params = self._parse_params(params_str)

        return {
            "action": func_name,
            "params": params,
            "think": think,
            "raw_action": action_str,
        }

    def parse_response(self, response_text: str) -> Action:
        """解析 LLM 响应为 Action"""
        parsed = self._parse_llm_output(response_text)
        action_name = str(parsed.get("action", "call_user")).strip().lower()

        return self.parse_action(
            action_name,
            parsed.get("params", {}),
            thought=parsed.get("think", ""),
            raw_response=response_text,
        )

    # ==================== 消息构建 ====================

    def build_messages(self, obs: Observation) -> list[dict]:
        """
        构建多轮对话消息，对齐论文 §4.1 公式 (3)。

        - 最近 N 步保留截图，以 user(screenshot)/assistant(response) 交替
        - 更早的步骤仅保留 thought+action 文本
        - prompt 放在首条 user 消息中（与官方 README 一致，无 system role）
        """
        prompt = (self.SYSTEM_PROMPT
                  .replace("{language}", self.language)
                  .replace("{instruction}", self._task))
        N = self.HISTORY_WINDOW_SIZE
        n = len(self._history)
        win = max(0, n - N)

        # 窗口前的纯文本历史（无截图）
        old_lines = []
        for i in range(win):
            r = self._history[i]
            old_lines.append(f"Step {r.step_idx}:\n{r.llm_response.strip()}")
        old_text = ("\n\nPrevious actions (screenshots omitted):\n"
                    + "\n".join(old_lines)) if old_lines else ""

        msgs: list[dict] = []

        # 窗口内步骤：多轮 user(screenshot) / assistant(response)
        for idx in range(win, n):
            rec = self._history[idx]
            user_parts: list[dict] = []
            if idx == win:  # 第一条 user 消息带 prompt + 文本历史
                user_parts.append({"type": "text", "text": prompt + old_text})
            user_parts.append({"type": "image_url",
                               "image_url": {"url": rec.observation.image_data_url}})
            msgs.append({"role": "user", "content": user_parts})
            msgs.append({"role": "assistant", "content": rec.llm_response})

        # 当前观测
        cur: list[dict] = []
        if not msgs:  # 第一步，无历史
            cur.append({"type": "text", "text": prompt})
        if self._pending_comment:
            cur.append({"type": "text", "text": f"[User Reply] {self._pending_comment}"})
        cur.append({"type": "image_url", "image_url": {"url": obs.image_data_url}})
        msgs.append({"role": "user", "content": cur})

        return msgs

    # ==================== 核心逻辑 ====================

    def act(self, obs: Observation) -> Action:
        """生成动作"""
        messages = self.build_messages(obs)

        if self.config.verbose:
            print(f"\n[UITarsAgent] Step {obs.step_idx}, "
                  f"sending {len(messages)} messages "
                  f"({sum(1 for m in messages if m['role'] == 'user')} turns)...")

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

        # 内存瘦身：清空窗口外旧记录的截图和 prompt（它们已被 Recorder 落盘）
        self._evict_old_records(keep_recent=self.HISTORY_WINDOW_SIZE + 1)

        self._pending_comment = ""

        if self.config.verbose:
            print(f"[UITarsAgent] Action: {action.action_type}, Data: {action.data}")

        return action
