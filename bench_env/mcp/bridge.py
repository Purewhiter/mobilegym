"""Replace only GenericAgentV2's chat transport, not its action semantics."""

from __future__ import annotations

import asyncio
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from bench_env.llm import ChatResult
from bench_env.mcp.protocol import serialize_response


class MCPBridgeClient:
    """Rendezvous between synchronous Generic V2 inference and async MCP tools.

    The Runner owns all environment access. MCP only sees the latest user
    message built by Generic V2 (task/step text and screenshot). A tool call
    waits for the Runner to execute its action and publish the next input.
    """

    def __init__(self, *, action_timeout: float = 300.0, action_log: Path | None = None):
        self.loop = asyncio.get_running_loop()
        self.action_timeout = action_timeout
        self.action_log = action_log
        self.condition = asyncio.Condition()
        self.pending: asyncio.Future[str] | None = None
        self.view: dict[str, Any] | None = None
        self.generation = 0
        self.closed = False
        self.close_reason = "batch_finished"
        self._act_lock = asyncio.Lock()

    def chat(self, *, messages: list[dict], args: dict | None = None) -> ChatResult:
        """Called in Controller's existing inference worker thread."""
        future = asyncio.run_coroutine_threadsafe(self._exchange(messages), self.loop)
        return ChatResult(content=future.result())

    async def _exchange(self, messages: list[dict]) -> str:
        # Explicit allowlist. Never serialize Observation, route, state, task
        # parameters, judge data, or earlier Generic V2 prompt messages.
        current = messages[-1]["content"]
        public_content = []
        for block in current:
            if block.get("type") == "text":
                public_content.append({"type": "text", "text": block["text"]})
            elif block.get("type") == "image_url":
                public_content.append({
                    "type": "image_url",
                    "image_url": {"url": block["image_url"]["url"]},
                })
        async with self.condition:
            if self.closed:
                raise ConnectionError("MCP client is disconnected")
            if self.pending is not None:
                raise RuntimeError("Concurrent inference on one bridge")
            pending = self.loop.create_future()
            self.pending = pending
            self.generation += 1
            self.view = {"content": public_content}
            self.condition.notify_all()
        try:
            return await asyncio.wait_for(pending, self.action_timeout)
        finally:
            async with self.condition:
                if self.pending is pending:
                    self.pending = None
                self.condition.notify_all()

    async def observe(self) -> dict[str, Any]:
        """Return the cached decision frame; never take another screenshot."""
        async with self.condition:
            await self.condition.wait_for(lambda: self.closed or (
                self.view is not None and self.pending is not None
                and not self.pending.done()
            ))
            return self._public_view()

    async def act(self, *, thought: str, action: dict[str, Any]) -> dict[str, Any]:
        arguments = {"thought": thought, "action": deepcopy(action)}
        response = serialize_response(**arguments)
        if self._act_lock.locked():
            raise ValueError("Only one action may be in flight")
        async with self._act_lock:
            async with self.condition:
                if self.closed:
                    return self._public_view()
                if self.pending is None or self.pending.done():
                    raise ValueError("No observation is awaiting an action; call observe")
                generation = self.generation
                # Log the actual structured model arguments separately from the
                # adapter-generated string recorded by Generic V2's recorder.
                # Write before delivery: a logging failure must not execute an
                # unrecorded action. This records submission, not execution.
                if self.action_log is not None:
                    with self.action_log.open("a", encoding="utf-8") as stream:
                        stream.write(json.dumps({
                            "decision_index": generation,
                            "arguments": arguments,
                            "adapter_response": response,
                        }, ensure_ascii=False, allow_nan=False) + "\n")
                # Generic V2 alone extracts thought, parses JSON and maps actions.
                self.pending.set_result(response)
                await self.condition.wait_for(lambda: self.closed or (
                    self.generation > generation and self.pending is not None
                    and not self.pending.done()
                ))
                return self._public_view()

    def _public_view(self) -> dict[str, Any]:
        if self.closed:
            return {"status": "closed", "reason": self.close_reason}
        return deepcopy(self.view)

    async def close(self, reason: str = "batch_finished") -> None:
        async with self.condition:
            self.closed = True
            self.close_reason = reason
            if self.pending is not None and not self.pending.done():
                self.pending.set_exception(ConnectionError(reason))
            self.condition.notify_all()
