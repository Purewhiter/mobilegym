"""
OpenAI-compatible LLM client.

Supports any OpenAI API-compatible endpoint (OpenAI, Azure, vLLM, Ollama, etc.)
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Optional

import openai

logger = logging.getLogger(__name__)


@dataclass
class ChatResult:
    """
    LLM chat result.
    
    Attributes:
        content: Generated text content
        reasoning: Optional reasoning content (DeepSeek, etc.)
        latency_s: Response latency in seconds
        raw: Raw API response
    """
    content: str
    reasoning: Optional[str] = None
    latency_s: Optional[float] = None
    raw: Optional[dict[str, Any]] = None


class LLMClient:
    """
    OpenAI-compatible chat completions client.
    
    Features:
    - Supports streaming
    - Compatible with various providers (OpenAI, Azure, vLLM, Ollama, etc.)
    - Handles reasoning_content for providers like DeepSeek
    """

    def __init__(
        self,
        *,
        base_url: str,
        api_key: Optional[str] = None,
        model: str,
        default_args: Optional[dict[str, Any]] = None,
        timeout_s: float = 600.0,
        total_timeout_s: float = 300.0,
    ):
        """
        Initialize LLM client.
        
        Args:
            base_url: API base URL
            api_key: API key (can be empty for local endpoints)
            model: Model name
            default_args: Default generation arguments
            timeout_s: Per-chunk read timeout in seconds (httpx level)
            total_timeout_s: Absolute wall-clock timeout per chat() call.
                Prevents a single request from blocking a worker indefinitely
                when vLLM queues a bad request (e.g. prompt > max_model_len).
                Set to 0 to disable.
        """
        self.base_url = str(base_url).rstrip("/")
        self.api_key = api_key or ""
        self.model = model
        self.default_args = dict(default_args or {})
        self.timeout_s = float(timeout_s)
        self.total_timeout_s = float(total_timeout_s)
        try:
            from openai import OpenAI  # lazy import (allow --list without openai installed)
        except ModuleNotFoundError as e:
            raise ModuleNotFoundError(
                "Missing dependency 'openai'. Install it to use LLM features:\n"
                "  pip install openai\n"
                "You can still run non-LLM modes (e.g. --list) without it."
            ) from e

        self._client = OpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=self.timeout_s,
        )

    def chat(
        self,
        *,
        messages: list[dict[str, Any]],
        args: Optional[dict[str, Any]] = None,
    ) -> ChatResult:
        """
        Send chat completion request.
        
        Args:
            messages: Chat messages
            args: Generation arguments (overrides defaults)
            
        Returns:
            ChatResult with generated content
        """
        payload_args = dict(self.default_args)
        if args:
            payload_args.update(args)

        from bench_env.env.stopwatch import current_stopwatch
        start = time.time()
        deadline = (start + self.total_timeout_s) if self.total_timeout_s > 0 else 0
        stream = bool(payload_args.pop("stream", False))
        stream_print = bool(payload_args.pop("stream_print", False))

        if stream:
            content_buf = ""
            reasoning_buf = ""
            create_t0 = time.monotonic()
            completion_stream = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
                **payload_args,
            )
            first_chunk_t = None  # TTFT
            try:
                for chunk in completion_stream:
                    if first_chunk_t is None:
                        first_chunk_t = time.monotonic()
                    if deadline and time.time() > deadline:
                        raise TimeoutError(
                            f"LLM streaming inference exceeded total timeout "
                            f"({self.total_timeout_s:.0f}s)"
                        )
                    if not getattr(chunk, "choices", None):
                        continue
                    delta = chunk.choices[0].delta
                    delta_content = getattr(delta, "content", None)
                    if delta_content:
                        content_buf += delta_content
                        if stream_print:
                            print(delta_content, end="", flush=True)
                    # vLLM 0.17 (--reasoning-parser qwen3) 把 thinking 推到 `reasoning`
                    # 字段;DeepSeek 等模型用 `reasoning_content`。两者都接,谁先出谁优先。
                    delta_reasoning = (
                        getattr(delta, "reasoning_content", None)
                        or getattr(delta, "reasoning", None)
                    )
                    if delta_reasoning:
                        reasoning_buf += delta_reasoning
                        if stream_print and not delta_content:
                            print(delta_reasoning, end="", flush=True)
            except TimeoutError:
                raise
            finally:
                try:
                    completion_stream.close()
                except Exception:
                    pass
            if stream_print:
                print()  # Newline after stream

            latency = time.time() - start
            # If running inside a runner-bound thread, attribute ttft/decode to the
            # owning env's stopwatch so they nest under the current "exec" parent.
            sw = current_stopwatch()
            if sw is not None and first_chunk_t is not None:
                sw.record("ttft", first_chunk_t - create_t0)
                sw.record("decode", time.monotonic() - first_chunk_t)

            # Gemini/DeepSeek thinking models may put all output in reasoning_content
            if reasoning_buf:
                content_buf = _merge_reasoning_into_content(content_buf, reasoning_buf)
                reasoning_buf = ""

            # Fallback to non-stream if still empty
            if not content_buf:
                logger.warning(
                    f"Stream response was empty for model '{self.model}', "
                    "falling back to non-stream request (this may cause duplicate API calls)"
                )
                completion = self._client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    **payload_args,
                )
                # Handle different response formats
                if hasattr(completion, 'model_dump'):
                    raw = completion.model_dump()
                elif isinstance(completion, dict):
                    raw = completion
                else:
                    raw = {"choices": [{"message": {"content": str(completion)}}]}
                content, reasoning = _extract_content_and_reasoning(raw)
                if reasoning:
                    content = _merge_reasoning_into_content(content, reasoning)
                    reasoning = None
                if stream_print and content:
                    print(content, end="" if content.endswith("\n") else "\n", flush=True)
                return ChatResult(content=content, reasoning=reasoning, latency_s=latency, raw=raw)

            return ChatResult(
                content=content_buf,
                reasoning=reasoning_buf or None,
                latency_s=latency,
                raw={"stream": True},
            )

        # Non-streaming (with retry for transient infrastructure errors)
        max_retries = 3
        req_start = start
        for attempt in range(1, max_retries + 1):
            try:
                req_start = time.time()
                completion = self._client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    **payload_args,
                )
                break
            except (openai.APIConnectionError, openai.APITimeoutError, openai.InternalServerError) as e:
                if attempt == max_retries:
                    raise
                logger.warning("[LLM] Transient error (attempt %d/%d): %s", attempt, max_retries, e)
                time.sleep(0.5 * attempt)
            except openai.BadRequestError as e:
                # Only retry "Already borrowed" (vLLM tokenizer concurrency bug)
                if "Already borrowed" in str(e):
                    if attempt == max_retries:
                        raise
                    logger.warning("[LLM] Tokenizer contention (attempt %d/%d), retrying...", attempt, max_retries)
                    time.sleep(0.5 * attempt)
                else:
                    raise
        latency = time.time() - req_start
        
        # Handle different response formats
        if hasattr(completion, 'model_dump'):
            raw = completion.model_dump()
        elif isinstance(completion, dict):
            raw = completion
        else:
            raw = {"choices": [{"message": {"content": str(completion)}}]}
        
        content, reasoning = _extract_content_and_reasoning(raw)
        if reasoning:
            content = _merge_reasoning_into_content(content, reasoning)
            reasoning = None
        return ChatResult(content=content, reasoning=reasoning, latency_s=latency, raw=raw)


def _extract_content_and_reasoning(raw: dict[str, Any]) -> tuple[str, Optional[str]]:
    """
    Extract content and optional reasoning from API response.
    
    Handles:
    - Standard content field
    - `reasoning_content` (DeepSeek-style)
    - `reasoning` (vLLM 0.17 with --reasoning-parser qwen3 / GPT thinking models)
    """
    try:
        msg = raw.get("choices", [{}])[0].get("message", {})
    except Exception:
        msg = {}
    content = str(msg.get("content") or "")
    reasoning = msg.get("reasoning_content") or msg.get("reasoning")
    if reasoning is not None:
        reasoning = str(reasoning)
    return content, reasoning


_THINK_RE = re.compile(r'<think>(.*?)</think>', re.DOTALL | re.IGNORECASE)


def _merge_reasoning_into_content(content: str, reasoning: str) -> str:
    """
    将 reasoning_content 合并进 content 的 <think> 块。

    - content 已有 <think> → 把 reasoning 插入该块开头
    - content 没有 <think> → 在 content 前加 <think>reasoning</think>
    """
    m = _THINK_RE.search(content)
    if m:
        existing = m.group(1).strip()
        merged = f"{reasoning}\n{existing}" if existing else reasoning
        return content[:m.start()] + f"<think>{merged}</think>" + content[m.end():]
    return f"<think>{reasoning}</think>\n{content}"
