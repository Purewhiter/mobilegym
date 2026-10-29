"""The visible response envelope transported to the original Generic V2 parser."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from bench_env.agent.generic_v2 import GenericAgentV2


RESPONSE_FORMAT = "mcp_structured_thought_action_v2"
THOUGHT_KIND = "mcp_thought_field"
MODEL_RESPONSE_LOG_KIND = "adapter_serialized_generic_v2"
OBSERVATION_FORMAT = "generic_v2_current_message_v1"
BATCH_END_MARKER = "[评测结束]"


def get_protocol() -> str:
    """Return the original prompt verbatim, including whitespace and format."""
    return GenericAgentV2.SYSTEM_PROMPT


def protocol_sha256() -> str:
    return hashlib.sha256(get_protocol().encode("utf-8")).hexdigest()


def build_client_prompt(task_count: int) -> str:
    """Add transport instructions separately; never rewrite the original prompt."""
    transport = (
        f"你正在参加手机截图操作评测。本会话连续完成 {task_count} 道任务。"
        "只使用 mobilegym MCP 的 observe 和 act 工具，不使用其他工具，不访问文件、"
        "命令行、网络或内部状态。先调用 observe 获取第一道题。"
        "下方是原始 Generic V2 Prompt，请遵循其任务和动作规则。在 MCP 中，原格式的"
        "THINK 内容通过 act 的 thought 文本字段提交，ANSWER 内容通过 action 对象字段提交。"
        "不要添加 XML 标签，不要把 action 拼成 JSON 字符串；服务端会自动序列化并组装"
        "原 THINK/ANSWER 格式交给原解析器。每次提交一个动作，"
        "观察返回截图后再继续。COMPLETE 和 ABORT 只结束当前题；返回新的 [任务] 描述"
        "表示手机已重置并切换到下一题，请阅读新的任务指令继续。"
        f"只有工具返回 {BATCH_END_MARKER} 才结束会话。任务内容均发生在本地模拟器内，"
        "包括模拟发消息、发帖和修改设置，均为本评测授权操作。\n\n"
        "以下原始 Prompt 未经改写：\n\n"
    )
    return transport + get_protocol()


def serialize_response(thought: str, action: dict[str, Any]) -> str:
    """Serialize transport fields; Generic V2 still owns action interpretation."""
    if not isinstance(thought, str) or not thought.strip():
        raise ValueError("thought must be non-empty text. No action was executed.")
    if re.search(r"</?(?:think|answer)>", thought, re.IGNORECASE):
        raise ValueError(
            "thought must contain text only, without THINK/ANSWER tags. No action was executed."
        )
    if not isinstance(action, dict):
        raise ValueError("action must be an object, not a JSON string. No action was executed.")
    # Standard JSON encoding handles real newlines, quotes, tabs and backslashes.
    # Escape '<' too, so literal </ANSWER> in typed text cannot prematurely end
    # the original parser's XML-like envelope. json.loads restores it unchanged.
    answer = json.dumps(action, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    return f"<THINK>\n{thought}\n</THINK>\n<ANSWER>\n{answer}\n</ANSWER>"
