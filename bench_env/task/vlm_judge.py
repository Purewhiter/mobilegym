"""
VLM-based task evaluation for real devices.

Uses a Vision-Language Model to evaluate task completion
based on the agent's execution trajectory (screenshots + actions).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional

from bench_env.logger import get_logger
from bench_env.task.judge import JudgeResult

if TYPE_CHECKING:
    from bench_env.llm.openai_chat import OpenAIChat

logger = get_logger(__name__)


def _extract_usage(raw: Any) -> Optional[dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    usage = raw.get("usage")
    if isinstance(usage, dict):
        out = dict(usage)
        for key in ("usageMetadata", "usage_metadata"):
            if isinstance(raw.get(key), dict):
                out[key] = raw[key]
        return out
    for key in ("usageMetadata", "usage_metadata"):
        if isinstance(raw.get(key), dict):
            return {key: raw[key]}
    return None


def _extract_last_json_object(text: str) -> Optional[str]:
    """Return the last balanced `{...}` substring in `text`, or None.

    Scans from the end so stray `{...}` fragments earlier in the text (e.g.
    echoed action coordinates) are ignored. Brace counting is naive — it does
    not parse string literals — which is adequate for well-formed JSON output
    but can fail if a `{` or `}` appears inside a string before the final
    object. For VLM judge output this has proven sufficient.
    """
    depth = 0
    end = -1
    for i in range(len(text) - 1, -1, -1):
        c = text[i]
        if c == '}':
            if depth == 0:
                end = i
            depth += 1
        elif c == '{':
            if depth == 0:
                continue
            depth -= 1
            if depth == 0 and end != -1:
                return text[i:end + 1]
    return None


SYSTEM_PROMPT = """你是一个移动端 GUI 任务评估专家。

根据 Agent 的执行轨迹（截图序列和动作），判断任务是否成功完成。

评估标准：
1. success: 任务目标是否达成（Agent 是否完成了用户要求的操作）
2. clean: 执行过程是否有非预期的副作用（如误删数据、修改了无关设置、发送了错误消息等）

请以 JSON 格式输出，并用 ```json 代码块包裹最终结果：

```json
{
    "success": true/false,
    "clean": true/false,
    "issues": [
        {"field": "目标检查项", "expected": "期望结果", "actual": "实际结果", "reason": "失败原因"}
    ],
    "warnings": [
        {"field": "副作用类型", "description": "副作用描述"}
    ],
    "reasoning": "你的推理过程"
}
```

注意：
- issues: 任务未完成的原因（success=false 时必须填写）
- warnings: 检测到的副作用（clean=false 时必须填写）
- 如果任务成功且无副作用，issues 和 warnings 留空数组 []
- reasoning: 简要说明你的判断依据
- 最终答案必须放在 ```json ... ``` 代码块内，代码块外不要再输出其它 JSON 对象
"""


@dataclass
class VLMJudgeOutput:
    """VLM 评估输出，包含完整的 prompt/response 用于保存和调试"""
    result: JudgeResult
    prompt: list[dict]  # 完整的 messages（图片数据会在保存时移除）
    response: str       # VLM 原始响应文本
    usage: Optional[dict[str, Any]] = None  # Provider token usage if exposed


class VLMJudge:
    """VLM-based task evaluator."""
    
    def __init__(self, llm: "OpenAIChat", max_images: int = 10):
        """
        Args:
            llm: LLM client for VLM evaluation
            max_images: Maximum number of trajectory images to include (to control token cost)
        """
        self.llm = llm
        self.max_images = max_images
    
    def evaluate(
        self,
        task_description: str,
        trajectory: list[dict[str, Any]],
        agent_answer: Optional[str] = None,
        agent_message: Optional[str] = None,
        stop_reason: Optional[str] = None,
    ) -> VLMJudgeOutput:
        """
        Evaluate task completion using VLM.
        
        Args:
            task_description: Task description
            trajectory: List of trajectory steps, each containing:
                - step: int
                - screenshot_b64: str (base64 encoded image)
                - action_type: str
                - action_data: dict
                - thought: str (optional)
            agent_answer: Agent's latest explicit answer (from ANSWER action)
            agent_message: Agent's terminal message (from COMPLETE/ABORT)
            stop_reason: Episode stop reason
            
        Returns:
            VLMJudgeOutput with result, prompt, and response
        """
        # Build messages for VLM
        messages = self._build_messages(
            task_description,
            trajectory,
            agent_answer=agent_answer,
            agent_message=agent_message,
            stop_reason=stop_reason,
        )
        
        try:
            # Call VLM
            response = self.llm.chat(messages=messages)
            content = response.content if hasattr(response, 'content') else str(response)
            raw = getattr(response, "raw", None)
            usage = _extract_usage(raw)
            
            # Parse response
            result = self._parse_response(content)
            
            return VLMJudgeOutput(
                result=result,
                prompt=messages,
                response=content,
                usage=usage,
            )
            
        except Exception as e:
            logger.error(f"VLM evaluation failed: {e}")
            return VLMJudgeOutput(
                result=JudgeResult.error(f"VLM evaluation error: {e}"),
                prompt=messages,
                response=f"ERROR: {e}",
                usage=None,
            )
    
    def _build_messages(
        self,
        task_description: str,
        trajectory: list[dict[str, Any]],
        agent_answer: Optional[str],
        agent_message: Optional[str],
        stop_reason: Optional[str],
    ) -> list[dict]:
        """Build VLM messages with trajectory images."""
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # Build user message with trajectory
        content = []
        
        # Task description
        content.append({
            "type": "text",
            "text": f"## 任务描述\n{task_description}\n\n## 执行轨迹\n"
        })
        
        # Sample trajectory if too long
        steps = trajectory
        if len(steps) > self.max_images:
            # Keep first, last, and evenly sampled middle steps
            indices = [0]
            step_size = (len(steps) - 1) / (self.max_images - 1)
            for i in range(1, self.max_images - 1):
                indices.append(int(i * step_size))
            indices.append(len(steps) - 1)
            steps = [trajectory[i] for i in sorted(set(indices))]
            logger.debug(f"Sampled {len(steps)} steps from {len(trajectory)} for VLM judge")
        
        # Add each step
        for i, step in enumerate(steps):
            step_idx = step.get("step", i + 1)
            action_type = step.get("action_type", "UNKNOWN")
            action_data = step.get("action_data", {})
            thought = step.get("thought", "")
            screenshot_b64 = step.get("screenshot_b64", "")
            
            # Step description
            action_desc = f"**动作**: {action_type}"
            if action_data:
                # Format action data nicely
                data_str = json.dumps(action_data, ensure_ascii=False)
                if len(data_str) > 100:
                    data_str = data_str[:100] + "..."
                action_desc += f" `{data_str}`"
            if thought:
                thought_short = thought[:200] + "..." if len(thought) > 200 else thought
                action_desc += f"\n**思考**: {thought_short}"
            
            content.append({
                "type": "text",
                "text": f"\n### 步骤 {step_idx}\n{action_desc}\n**截图**:"
            })
            
            # Screenshot
            if screenshot_b64:
                mime = "image/jpeg" if screenshot_b64.startswith("/9j") else "image/png"
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{screenshot_b64}"}
                })
            else:
                content.append({
                    "type": "text",
                    "text": "[截图缺失]"
                })
        
        # Agent answer / message metadata
        if agent_answer is not None:
            content.append({
                "type": "text",
                "text": f"\n## Agent 提交的答案\n{agent_answer}\n",
            })

        if agent_message:
            content.append({
                "type": "text",
                "text": f"\n## Agent 终止说明\n{agent_message}\n"
            })

        if stop_reason:
            content.append({
                "type": "text",
                "text": f"\n## 终止原因\n{stop_reason}\n",
            })
        
        content.append({
            "type": "text",
            "text": (
                "\n---\n请根据以上执行轨迹，判断任务是否成功完成。"
                "其中 `agent_answer` 是显式提交的答案，`agent_message` 是终止说明；"
                "两者冲突时以 `agent_answer` 为准。若 `stop_reason=ABORT`，应视为失败信号。"
                "输出 JSON 格式的评估结果。"
            )
        })
        
        messages.append({"role": "user", "content": content})
        return messages
    
    def _parse_response(self, response: str) -> JudgeResult:
        """Parse VLM response to JudgeResult."""
        try:
            # Strip reasoning-model <think>...</think> blocks, which may contain
            # stray `{...}` fragments (e.g. echoed action coordinates) that would
            # otherwise trip up the JSON extractor.
            cleaned = re.sub(r'<think>[\s\S]*?</think>', '', response, flags=re.IGNORECASE)

            # Extract JSON from response (handle markdown code blocks)
            # Try to find JSON in code block first
            code_block_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', cleaned)
            if code_block_match:
                json_str = code_block_match.group(1)
            else:
                # Fallback: search for the last balanced {...} object in the cleaned text.
                json_str = _extract_last_json_object(cleaned)
                if json_str is None:
                    logger.warning(f"No JSON found in VLM response: {response[:300]}")
                    return JudgeResult.error("Failed to parse VLM response: no JSON found")
            
            data = json.loads(json_str)
            
            success = bool(data.get("success", False))
            clean = bool(data.get("clean", True))
            issues = data.get("issues", [])
            warnings = data.get("warnings", [])
            
            # Ensure issues/warnings are lists
            if not isinstance(issues, list):
                issues = [{"reason": str(issues)}] if issues else []
            if not isinstance(warnings, list):
                warnings = [{"description": str(warnings)}] if warnings else []
            
            # Add reasoning to issues if present and task failed
            reasoning = data.get("reasoning", "")
            if not success and reasoning and not issues:
                issues = [{"reason": reasoning}]
            
            return JudgeResult(
                success=success,
                clean=clean,
                issues=issues,
                warnings=warnings,
            )
            
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error: {e}, response: {response[:300]}")
            return JudgeResult.error(f"Failed to parse VLM response: {e}")
        except Exception as e:
            logger.warning(f"Unexpected error parsing VLM response: {e}")
            return JudgeResult.error(f"VLM response parse error: {e}")
