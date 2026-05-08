"""
GELab Agent - GELab Zero style agent implementation.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from bench_env.agent.base import AgentConfig, BaseAgent, AgentStepRecord
from bench_env.env.base import Action, ActionType, Observation
from bench_env.llm import LLMClient


class GelabAgent(BaseAgent):
    """
    GELab Zero style agent.
    
    Features:
    - 0920 summary prompt format
    - Tab-separated key-value action parsing
    - Summary-based history management
    
    Modifications vs. upstream GELab-Zero:
    - Added ANSWER action for submitting answers to query-type tasks.
      In the original, answers were embedded in COMPLETE.return.
      Here ANSWER is non-terminating to support hybrid tasks.
    """

    # ==================== 类属性 ====================
    
    SYSTEM_PROMPT = """你是一个手机 GUI-Agent 操作专家，你需要根据用户下发的任务、手机屏幕截图和交互操作的历史记录，借助既定的动作空间与手机进行交互，从而完成用户的任务。
请牢记，手机屏幕坐标系以左上角为原点，x轴向右，y轴向下，取值范围均为 0-1000。

# 行动原则：

1. 你需要明确记录自己上一次的action，如果是滑动，不能超过5次。
2. 你需要严格遵循用户的指令，如果你和用户进行过对话，需要更遵守最后一轮的指令

# Action Space:

在 Android 手机的场景下，你的动作空间包含以下9类操作，所有输出都必须遵守对应的参数要求：
1. CLICK：点击手机屏幕坐标，需包含点击的坐标位置 point。
例如：action:CLICK\tpoint:x,y
2. TYPE：在手机输入框中输入文字，需包含输入内容 value、输入框的位置 point。
例如：action:TYPE\tvalue:输入内容\tpoint:x,y
3. COMPLETE：任务完成后向用户报告结果，需包含报告的内容 value。
例如：action:COMPLETE\treturn:完成任务后向用户报告的内容
4. WAIT：等待指定时长，需包含等待时间 value（秒）。
例如：action:WAIT\tvalue:等待时间
5. AWAKE：唤醒指定应用，需包含唤醒的应用名称 value。
例如：action:AWAKE\tvalue:应用名称
6. INFO：询问用户问题或详细信息，需包含提问内容 value。
例如：action:INFO\tvalue:提问内容
7. ABORT：终止当前任务，仅在当前任务无法继续执行时使用，需包含 value 说明原因。
例如：action:ABORT\tvalue:终止任务的原因
8. SLIDE：在手机屏幕上滑动（会映射为环境动作 SWIPE），滑动的方向不限，需包含起点 point1 和终点 point2。
例如：action:SLIDE\tpoint1:x1,y1\tpoint2:x2,y2
9. LONGPRESS：长按手机屏幕坐标，需包含长按的坐标位置 point。
例如：action:LONGPRESS\tpoint:x,y
10. ANSWER：提交答案，用于回答用户的问题。需包含答案内容 value（纯答案，不要包含思考过程）。此操作不会结束任务，提交答案后请继续执行任务或使用 COMPLETE 结束任务。
例如：action:ANSWER\tvalue:答案内容

"""
    
    # GeLab-Zero 定义的 9 种动作
    ACTION_MAP = {
        "CLICK": (ActionType.CLICK, lambda p: {"point": p.get("point")}),
        "LONGPRESS": (ActionType.LONG_PRESS, lambda p: {"point": p.get("point")}),
        "TYPE": (ActionType.TYPE, lambda p: {"value": p.get("value", ""), "point": p.get("point"), "clear": p.get("clear", False)}),
        "SLIDE": (ActionType.SWIPE, lambda p: {"point1": p.get("point1"), "point2": p.get("point2")}),
        "WAIT": (ActionType.WAIT, lambda p: {"value": float(p.get("value", 1.0))}),
        "AWAKE": (ActionType.AWAKE, lambda p: {"value": p.get("value", "")}),
        "COMPLETE": (ActionType.COMPLETE, lambda p: {"return": p.get("return", "")}),
        "ABORT": (ActionType.ABORT, lambda p: {"value": p.get("value", "")}),
        "INFO": (ActionType.INFO, lambda p: {"value": p.get("value", "")}),
        "ANSWER": (ActionType.ANSWER, lambda p: {"value": str(p.get("value", ""))}),
    }

    DEFAULT_MODEL_ARGS = {
        "temperature": 0.1,
        "top_p": 0.95,
        "frequency_penalty": 0.0,
        "max_tokens": 4096,
    }
    
    _THINK_TAG_RE = re.compile(r"<\s*/?THINK\s*>", flags=re.IGNORECASE)

    # ==================== 初始化 ====================

    def __init__(self, llm: LLMClient, config: Optional[AgentConfig] = None):
        super().__init__(config)
        self.llm = llm
        self._summary_history = ""
        self._qa_history: list[tuple[str, str]] = []
        self._pending_comment = ""

        merged_args = dict(self.DEFAULT_MODEL_ARGS)
        merged_args.update(self.config.model_args or {})
        self.config.model_args = merged_args

    @property
    def name(self) -> str:
        return "GelabAgent"

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []
        self._summary_history = ""
        self._qa_history = []
        self._pending_comment = ""

    def reset_history(self) -> None:
        super().reset_history()
        self._summary_history = ""
        self._qa_history.clear()

    # ==================== 响应解析 ====================

    def _parse_llm_output(self, response_text: str) -> dict[str, Any]:
        """
        解析 LLM 输出为结构化字典。
        
        格式：
            <THINK>思考内容</THINK>
            explain:说明\taction:CLICK\tpoint:500,500\tsummary:历史总结
        """
        raw = str(response_text or "").strip()
        if not raw:
            return {"action": "ABORT", "value": "empty_response", "cot": "", "summary": ""}

        # 规范化 THINK 标签
        raw = (
            raw.replace("<TINK>", "<THINK>")
            .replace("</TINK>", "</THINK>")
            .replace("<think>", "<THINK>")
            .replace("</think>", "</THINK>")
        )
        raw = self._THINK_TAG_RE.sub(
            lambda m: "<THINK>" if "/" not in m.group(0) else "</THINK>", raw
        )

        # 提取思考部分和动作部分
        try:
            cot_part = raw.split("<THINK>")[1].split("</THINK>")[0].strip()
            kv_part = raw.split("</THINK>")[1].strip()
        except IndexError:
            cot_part = ""
            kv_part = raw

        result: dict[str, Any] = {"cot": cot_part}

        # 解析 tab 分隔的 key-value
        for kv in kv_part.split("\t"):
            kv = kv.strip()
            if ":" not in kv:
                continue
            key, value = kv.split(":", 1)
            key, value = key.strip(), value.strip()

            if key == "action":
                result["action"] = value
            elif key == "summary":
                result["summary"] = value
            elif "point" in key:
                try:
                    coords = value.replace(",", " ").split()
                    if len(coords) >= 2:
                        result[key] = [int(coords[0]), int(coords[1])]
                except (ValueError, IndexError):
                    result[key] = value
            else:
                result[key] = value

        if "action" not in result:
            result["action"] = "ABORT"

        return result

    def parse_response(self, response_text: str) -> Action:
        """解析 LLM 响应为 Action"""
        parsed = self._parse_llm_output(response_text)
        action_name = str(parsed.get("action", "ABORT")).strip().upper()
        
        return self.parse_action(
            action_name,
            parsed,
            thought=parsed.get("cot", ""),
            explain=parsed.get("explain", ""),
            summary=parsed.get("summary", ""),
            raw_response=response_text,
        )

    # ==================== 消息构建 ====================

    def _build_status_prompt(self, task: str, image_url: str, summary_history: str, qa_prompt: str) -> list[dict]:
        """构建当前步骤的状态提示"""
        history_display = summary_history if summary_history.strip() else "暂无历史操作"
        user_instruction = f"\n\n{qa_prompt}\n\n" if qa_prompt else ""
        task_text = task + user_instruction + "指令结束\n\n"

        return [
            {
                "type": "text",
                "text": f"""
已知用户指令为：{task_text}
已知已经执行过的历史动作如下：{history_display}
当前手机屏幕截图如下：
""",
            },
            {"type": "image_url", "image_url": {"url": image_url}},
            {
                "type": "text",
                "text": """

在执行操作之前，请务必回顾你的历史操作记录和限定的动作空间，先进行思考和解释然后输出动作空间和对应的参数：
1. 思考（THINK）：在 <THINK> 和 </THINK> 标签之间。
2. 解释（explain）：在动作格式中，使用 explain: 开头，简要说明当前动作的目的和执行方式。
在执行完操作后，请输出执行完当前步骤后的新历史总结。
输出格式示例：
<THINK> 思考的内容 </THINK>
explain:解释的内容\taction:动作空间和对应的参数\tsummary:执行完当前步骤后的新历史总结
""",
            },
        ]

    def build_messages(self, obs: Observation) -> list[dict]:
        """构建发送给 LLM 的消息"""
        qa_prompt = ""
        if self._qa_history:
            qa_prompt = (
                "这是你和用户的对话历史： \n"
                + "\n".join([f"你曾经提出的问题：{q}\n\n用户对你的指示：{a}" for q, a in self._qa_history])
                + "\n\n 你需要更加注意用户最后的指示。 "
            )

        conversations = [{"type": "text", "text": self.SYSTEM_PROMPT}] + self._build_status_prompt(
            self._task,
            obs.image_data_url,
            self._summary_history,
            qa_prompt,
        )
        return [{"role": "user", "content": conversations}]

    # ==================== 核心逻辑 ====================

    def act(self, obs: Observation) -> Action:
        """生成动作"""
        messages = self.build_messages(obs)

        if self.config.verbose:
            print(f"\n[GelabAgent] Step {obs.step_idx}, sending prompt...")

        response = self.llm.chat(
            messages=messages,
            args={
                **self.config.model_args,
                "stream": self.config.stream,
                "stream_print": self.config.stream,
            },
        )

        # 与 gelab-zero 保持一致：将 reasoning_content 拼接到 content 前面
        llm_output = response.content
        if response.reasoning:
            llm_output = f"<think>{response.reasoning}</think>\n{response.content}"

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

        if action.summary:
            self._summary_history = action.summary

        if action.action_type == ActionType.INFO:
            question = action.data.get("value", "")
            self._qa_history.append((question, ""))

        # 内存瘦身：build_messages 仅用 _summary_history（纯文本），保留最近 2 条完整记录
        self._evict_old_records(keep_recent=2)

        self._pending_comment = ""

        if self.config.verbose:
            print(f"[GelabAgent] Action: {action.action_type}, Data: {action.data}")

        return action

    def add_user_comment(self, comment: str) -> None:
        """添加用户回复（用于 INFO 动作）"""
        self._pending_comment = comment
        if self._qa_history and not self._qa_history[-1][1]:
            q = self._qa_history[-1][0]
            self._qa_history[-1] = (q, comment)
