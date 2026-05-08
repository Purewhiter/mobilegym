"""
GenericAgent - 通用 JSON 格式 Agent，支持任意 VLM 模型。

输出格式为标准 JSON，适配大多数视觉语言模型。
"""

from __future__ import annotations

import json
from typing import Any, ClassVar, Optional

from bench_env.agent.base import BaseAgent, AgentConfig, ActionMapping, AgentStepRecord
from bench_env.env.base import Action, ActionType, Observation
from bench_env.llm import LLMClient


class GenericAgent(BaseAgent):
    """
    通用 JSON 格式 Agent。
    
    适用于任意支持视觉的 LLM 模型（如 GPT-4o、Gemini、Qwen-VL 等）。
    模型输出标准 JSON 格式，易于解析和调试。
    """

    SYSTEM_PROMPT: ClassVar[str] = """你是一个手机 GUI-Agent 操作专家。你需要根据用户下发的任务、手机屏幕截图以及历史操作记录，输出一个动作来与手机交互，从而完成任务。

坐标系：左上角为原点，x 向右，y 向下，取值范围均为 0-1000（归一化坐标）。

你必须**只输出一个 JSON 对象**（不要输出任何额外文本/Markdown/代码块），schema 如下：

{
  "action": "CLICK|TYPE|SWIPE|LONGPRESS|BACK|AWAKE|WAIT|INFO|COMPLETE|ABORT",
  "thought": "你的思考过程（可选）",
  "explain": "简短解释（可选）",
  "point": [x, y],                 // CLICK/LONGPRESS 需要
  "point1": [x1, y1], "point2": [x2, y2], // SWIPE/SLIDE 需要（SLIDE 会被映射到 SWIPE）
  "value": "..." ,                 // TYPE/WAIT/AWAKE/INFO/ABORT 需要
  "clear": true,                   // TYPE 可选：先清空输入框再输入（默认 false，追加到已有文本后面）
  "return": "..."                  // COMPLETE 需要
}

要求：
- 坐标必须为数字，范围 0-1000
- 如果 action=WAIT，value 为秒数（数字）
- 如果 action=AWAKE，value 为应用名称
- 如果 action=COMPLETE，return 为任务完成的说明
- 如果 action=INFO，value 为要询问用户的问题
"""

    ACTION_MAP: ActionMapping = {
        "CLICK": (ActionType.CLICK, lambda p: {"point": p.get("point")}),
        "TAP": (ActionType.CLICK, lambda p: {"point": p.get("point")}),
        "LONGPRESS": (ActionType.LONG_PRESS, lambda p: {"point": p.get("point")}),
        "LONG_PRESS": (ActionType.LONG_PRESS, lambda p: {"point": p.get("point")}),
        "TYPE": (ActionType.TYPE, lambda p: {"value": p.get("value", p.get("text", "")), "clear": p.get("clear", False)}),
        "SLIDE": (ActionType.SWIPE, lambda p: {"point1": p.get("point1", p.get("start")), "point2": p.get("point2", p.get("end"))}),
        "SWIPE": (ActionType.SWIPE, lambda p: {"point1": p.get("point1", p.get("start")), "point2": p.get("point2", p.get("end"))}),
        "DRAG": (ActionType.DRAG, lambda p: {"point1": p.get("point1", p.get("start")), "point2": p.get("point2", p.get("end"))}),
        "BACK": (ActionType.BACK, lambda p: {}),
        "HOME": (ActionType.HOME, lambda p: {}),
        "RECENT": (ActionType.RECENT, lambda p: {}),
        "ENTER": (ActionType.ENTER, lambda p: {}),
        "WAIT": (ActionType.WAIT, lambda p: {"value": float(p.get("value", p.get("duration", 1.0)))}),
        "AWAKE": (ActionType.AWAKE, lambda p: {"value": p.get("value", p.get("app", ""))}),
        "LAUNCH": (ActionType.AWAKE, lambda p: {"value": p.get("value", p.get("app", ""))}),
        "INFO": (ActionType.INFO, lambda p: {"value": p.get("value", p.get("question", ""))}),
        "COMPLETE": (ActionType.COMPLETE, lambda p: {"return": p.get("return", p.get("message", ""))}),
        "FINISH": (ActionType.COMPLETE, lambda p: {"return": p.get("return", p.get("message", ""))}),
        "ABORT": (ActionType.ABORT, lambda p: {"value": p.get("value", p.get("reason", ""))}),
    }

    DEFAULT_MODEL_ARGS: ClassVar[dict[str, Any]] = {
        "temperature": 0.1,
        "top_p": 0.95,
        "frequency_penalty": 0.0,
        "max_tokens": 4096,
    }

    # ==================== 初始化 ====================

    def __init__(self, llm: LLMClient, config: Optional[AgentConfig] = None):
        super().__init__(config)
        self.llm = llm
        self._pending_comment: str = ""

        merged_args = dict(self.DEFAULT_MODEL_ARGS)
        merged_args.update(self.config.model_args or {})
        self.config.model_args = merged_args

    @property
    def name(self) -> str:
        return "GenericAgent"

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []
        self._pending_comment = ""

    def add_user_comment(self, comment: str) -> None:
        """添加用户回复（用于 INFO 动作）"""
        self._pending_comment = str(comment or "")

    # ==================== 响应解析 ====================

    @staticmethod
    def _extract_first_json(text: str) -> Optional[str]:
        """从文本中提取第一个 JSON 对象"""
        s = text
        start = s.find("{")
        if start < 0:
            return None
        in_str = False
        esc = False
        depth = 0
        for i in range(start, len(s)):
            ch = s[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return s[start : i + 1]
        return None

    def _parse_llm_output(self, response_text: str) -> dict[str, Any]:
        """解析 LLM 输出为 dict"""
        raw = str(response_text or "").strip()
        if not raw:
            return {"_error": "empty_response"}

        parsed: Any = None
        try:
            parsed = json.loads(raw)
        except Exception:
            extracted = self._extract_first_json(raw)
            if extracted:
                try:
                    parsed = json.loads(extracted)
                except Exception:
                    pass

        if not isinstance(parsed, dict):
            return {"_error": "invalid_json", "raw": raw}

        return parsed

    def parse_response(self, response_text: str) -> Action:
        """解析 LLM 响应为 Action"""
        parsed = self._parse_llm_output(response_text)
        
        if "_error" in parsed:
            return Action(
                action_type=ActionType.ABORT,
                data={"value": parsed.get("_error", "parse_error")},
                raw_response=response_text,
            )

        action_name = str(parsed.get("action") or parsed.get("action_type") or "").strip().upper()
        thought = str(parsed.get("thought", parsed.get("cot", "")) or "")
        explain = str(parsed.get("explain", "") or "")
        
        return self.parse_action(
            action_name,
            parsed,
            thought=thought,
            explain=explain,
            raw_response=response_text,
        )

    # ==================== 消息构建 ====================

    def _format_history(self, max_items: int = 6) -> str:
        """格式化历史操作"""
        if not self._history:
            return "[]"
        items = self._history[-max_items:]
        out = []
        for s in items:
            out.append({
                "step": s.step_idx,
                "action": s.action.action_type,
                "data": s.action.data,
            })
        return json.dumps(out, ensure_ascii=False)

    def build_messages(self, obs: Observation) -> list[dict]:
        """构建发送给 LLM 的消息"""
        route_app = obs.current_app or ""
        route_path = obs.route.get("path", "") if obs.route else ""

        user_comment = ""
        if self._pending_comment:
            user_comment = f"\n\n[用户补充信息]\n{self._pending_comment}\n"

        text = f"""[任务]
{self._task}{user_comment}

[当前路由]
app={route_app}  path={route_path}

[历史操作]
{self._format_history()}

[当前截图]
"""

        return [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": text},
                    {"type": "image_url", "image_url": {"url": obs.image_data_url}},
                    {"type": "text", "text": "\n请只输出 JSON。"},
                ],
            },
        ]

    # ==================== 核心逻辑 ====================

    def act(self, obs: Observation) -> Action:
        """生成动作"""
        messages = self.build_messages(obs)

        if self.config.verbose:
            print(f"\n[GenericAgent] Step {obs.step_idx}, sending prompt...")

        response = self.llm.chat(
            messages=messages,
            args={
                **self.config.model_args,
                "stream": self.config.stream,
                "stream_print": self.config.stream and self.config.verbose,
            },
        )

        if self.config.verbose and not self.config.stream:
            print(f"\n[LLM Response]\n{response.content}\n")

        action = self.parse_response(response.content)

        self._history.append(AgentStepRecord(
            step_idx=obs.step_idx,
            observation=obs,
            action=action,
            llm_response=response.content,
            llm_prompt=messages,
            user_comment=self._pending_comment,
        ))

        # 内存瘦身：历史仅用文本，保留最近 2 条完整记录
        self._evict_old_records(keep_recent=2)

        self._pending_comment = ""

        if self.config.verbose:
            print(f"[GenericAgent] Action: {action.action_type}, Data: {action.data}")

        return action
