"""
GenericAgentV2 - 使用 <think></think> <answer></answer> 格式的纯视觉 GUI Agent。

特点：
- 输出格式为 <think>思考过程</think> <answer>JSON动作</answer>
- 不包含当前路由信息（模拟真实的纯视觉手机 GUI Agent）
- 支持环境的完整动作空间（除 NOOP 外）
"""

from __future__ import annotations

import json
import re
from typing import Any, ClassVar, Optional

from bench_env.agent.base import BaseAgent, AgentConfig, ActionMapping, AgentStepRecord
from bench_env.env.base import Action, ActionType, Observation
from bench_env.llm import LLMClient


class GenericAgentV2(BaseAgent):
    """
    纯视觉 GUI Agent，使用 think/answer 格式。
    
    特点：
    - 输出格式：<THINK>思考过程</THINK> <ANSWER>JSON动作</ANSWER>
    - 适用于评估模型的纯视觉 GUI 操作能力
    """

    SYSTEM_PROMPT: ClassVar[str] = """你是一个手机 GUI-Agent 操作专家。你需要根据用户下发的任务、手机屏幕截图以及历史操作记录，分析当前界面并输出一个动作来与手机交互，从而完成任务。

坐标系：左上角为原点，x 向右，y 向下，取值范围均为 0-1000（归一化坐标）。

可用动作（JSON 格式）：

1. 点击：{"action": "CLICK", "point": [x, y]}
2. 双击：{"action": "DOUBLE_TAP", "point": [x, y]}
3. 长按：{"action": "LONGPRESS", "point": [x, y]}
4. 输入：{"action": "TYPE", "value": "文本内容"}  // 可选 "point": [x, y] 指定输入位置；可选 "clear": true 先清空输入框再输入（默认追加到已有文本后面）
5. 滑动：{"action": "SWIPE", "point1": [x1, y1], "point2": [x2, y2]}
6. 拖拽：{"action": "DRAG", "point1": [x1, y1], "point2": [x2, y2]}  // 按住起点拖动到终点
7. 返回：{"action": "BACK"}
8. 回到桌面：{"action": "HOME"}
9. 打开最近任务：{"action": "RECENT"}
10. 输入回车：{"action": "ENTER"}
11. 等待：{"action": "WAIT", "value": 秒数}
12. 打开应用：{"action": "AWAKE", "value": "应用名称"}
13. 提交答案：{"action": "ANSWER", "value": "纯答案文本"}
14. 任务完成：{"action": "COMPLETE", "return": "完成说明"} // 所有任务完成后使用，给出简短的说明
15. 中止任务：{"action": "ABORT", "value": "中止原因"}  // 任务无法完成时使用，需要说明原因


你必须按以下格式输出：

<THINK>
在这里描述你对当前屏幕的理解、分析和决策过程。
包括：
1. 当前屏幕显示的内容是什么
2. 为了完成任务，下一步应该做什么
3. 具体要点击/操作哪个元素
</THINK>
<ANSWER>
{
  "action": "动作类型",
  // 根据动作类型填写相应参数
}
</ANSWER>


要求：
- 坐标必须为数字，范围 0-1000
- JSON 必须是有效格式
- 仔细观察屏幕截图，根据视觉信息做出判断
- 需要回答问题时，必须使用 ANSWER 提交答案
- COMPLETE 只用于结束任务，需要在执行完任务后使用
"""

    ACTION_MAP: ActionMapping = {
        "CLICK": (ActionType.CLICK, lambda p: {"point": p.get("point")}),
        "TAP": (ActionType.CLICK, lambda p: {"point": p.get("point")}),
        "DOUBLE_TAP": (ActionType.DOUBLE_TAP, lambda p: {"point": p.get("point")}),
        "DOUBLETAP": (ActionType.DOUBLE_TAP, lambda p: {"point": p.get("point")}),
        "LONGPRESS": (ActionType.LONG_PRESS, lambda p: {"point": p.get("point")}),
        "LONG_PRESS": (ActionType.LONG_PRESS, lambda p: {"point": p.get("point")}),
        "TYPE": (ActionType.TYPE, lambda p: {"value": p.get("value", p.get("text", "")), "point": p.get("point"), "clear": p.get("clear", False)}),
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
        "ANSWER": (ActionType.ANSWER, lambda p: {"value": p.get("value", p.get("text", ""))}),
        "COMPLETE": (ActionType.COMPLETE, lambda p: {"return": p.get("return", p.get("message", ""))}),
        "FINISH": (ActionType.COMPLETE, lambda p: {"return": p.get("return", p.get("message", ""))}),
        "ABORT": (ActionType.ABORT, lambda p: {"value": p.get("value", p.get("reason", ""))}),
    }

    DEFAULT_MODEL_ARGS: ClassVar[dict[str, Any]] = {
        "temperature": 0.1,
        "top_p": 0.95,
        "frequency_penalty": 0.0,
        "max_tokens": 16384,
        # "reasoning_effort": "none",
        # "extra_body": {
            # "chat_template_kwargs": {"enable_thinking": True},  # Qwen3.x via chat template ✓
            # "enable_thinking": False,           # 旧版 vLLM 扁平参数,对 Qwen3.6-35B-A3B 无效
            # "reasoning_effort": "none",         # OpenAI o1/o3 系
            # "reasoning": {"effort": "none"},    # OpenAI GPT-5 系
        # },
    }

    # ==================== 初始化 ====================

    def __init__(self, llm: LLMClient, config: Optional[AgentConfig] = None):
        super().__init__(config)
        self.llm = llm

        merged_args = dict(self.DEFAULT_MODEL_ARGS)
        merged_args.update(self.config.model_args or {})
        self.config.model_args = merged_args

    @property
    def name(self) -> str:
        return "GenericAgentV2"

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []

    # ==================== 响应解析 ====================

    @staticmethod
    def _extract_think_answer(text: str) -> tuple[str, str]:
        """
        从文本中提取 <think> 和 <answer> 内容。
        
        Returns:
            (think_content, answer_content)
        """
        think_content = ""
        answer_content = ""
        
        # 提取 <think>...</think>（不区分大小写，兼容 <THINK>/<think>）
        think_match = re.search(r'<think>(.*?)</think>', text, re.DOTALL | re.IGNORECASE)
        if think_match:
            think_content = think_match.group(1).strip()
        
        # 提取 <answer>...</answer>（不区分大小写，兼容 <ANSWER>/<answer>）
        answer_match = re.search(r'<answer>(.*?)</answer>', text, re.DOTALL | re.IGNORECASE)
        if answer_match:
            answer_content = answer_match.group(1).strip()
        
        return think_content, answer_content

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

    def _parse_llm_output(self, response_text: str) -> tuple[str, dict[str, Any]]:
        """
        解析 LLM 输出为 (thought, action_dict)。
        
        Returns:
            (thought, action_dict)
        """
        raw = str(response_text or "").strip()
        if not raw:
            return "", {"_error": "empty_response"}

        # 提取 think 和 answer 部分
        think_content, answer_content = self._extract_think_answer(raw)
        
        # 如果没有找到 <answer> 标签，尝试直接解析整个文本
        if not answer_content:
            answer_content = raw
        
        # 解析 answer 中的 JSON
        parsed: Any = None
        try:
            parsed = json.loads(answer_content)
        except Exception:
            extracted = self._extract_first_json(answer_content)
            if extracted:
                try:
                    parsed = json.loads(extracted)
                except Exception:
                    pass

        if not isinstance(parsed, dict):
            return think_content, {"_error": "invalid_json", "raw": raw}

        return think_content, parsed

    def parse_response(self, response_text: str) -> Action:
        """解析 LLM 响应为 Action"""
        thought, parsed = self._parse_llm_output(response_text)
        
        if "_error" in parsed:
            return Action(
                action_type=ActionType.ABORT,
                data={"value": parsed.get("_error", "parse_error")},
                raw_response=response_text,
            )

        action_name = str(parsed.get("action") or parsed.get("action_type") or "").strip().upper()
        explain = str(parsed.get("explain", "") or "")
        
        return self.parse_action(
            action_name,
            parsed,
            thought=thought,
            explain=explain,
            raw_response=response_text,
        )

    # ==================== 消息构建 ====================

    def build_messages(self, obs: Observation) -> list[dict]:
        """
        构建发送给 LLM 的消息。
        
        使用完整多轮对话历史（类似 AutoGLMAgent）：
        - 历史步骤：user（任务/步骤标记） + assistant（模型响应）
        - 当前步骤：user（截图+提示）
        
        注意：不包含当前路由信息，作为纯视觉 GUI Agent。
        """
        messages: list[dict] = [
            {"role": "system", "content": self.SYSTEM_PROMPT}
        ]

        # 构建历史对话
        for i, record in enumerate(self._history):
            # 历史 user 消息（不含截图）
            if i == 0:
                user_text = f"[任务]\n{self._task}"
            else:
                user_text = f"[Step {i + 1}]"
            
            messages.append({
                "role": "user",
                "content": [{"type": "text", "text": user_text}],
            })
            
            # 历史 assistant 响应
            messages.append({
                "role": "assistant",
                "content": record.llm_response,
            })

        # 当前步骤（带截图）
        step_num = len(self._history) + 1
        if len(self._history) == 0:
            user_text = f"[任务]\n{self._task}"
        else:
            user_text = f"[Step {step_num}]"

        messages.append({
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": obs.image_data_url}},
                {"type": "text", "text": user_text},
            ],
        })

        return messages

    # ==================== 核心逻辑 ====================

    def act(self, obs: Observation) -> Action:
        """生成动作"""
        messages = self.build_messages(obs)

        if self.config.verbose:
            print(f"\n[GenericAgentV2] Step {obs.step_idx}, sending prompt...")

        response = self.llm.chat(
            messages=messages,
            args={
                **self.config.model_args,
                "stream": self.config.stream,
                "stream_print": self.config.stream,
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
        ))

        # 内存瘦身：历史仅用文本，保留最近 2 条完整记录
        self._evict_old_records(keep_recent=2)

        if self.config.verbose:
            print(f"[GenericAgentV2] Action: {action.action_type}, Data: {action.data}")

        return action
