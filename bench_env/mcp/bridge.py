"""Replace only GenericAgentV2's chat transport, not its action semantics."""

from __future__ import annotations

import asyncio
import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from bench_env.llm import ChatResult
from bench_env.mcp.protocol import BATCH_FINISHED, serialize_response


@dataclass
class ActionSubmission:
    request_id: str | None
    payload: str | None
    result: asyncio.Future[dict[str, Any]]


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
        self.close_reason = BATCH_FINISHED
        self._submission: ActionSubmission | None = None
        self._request_ids: set[str] = set()

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
            self._resolve_submission()
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

    async def act(self, *, thought: str, action: dict[str, Any],
                  request_id: str | None = None) -> dict[str, Any]:
        arguments = {"thought": thought, "action": deepcopy(action)}
        response = serialize_response(**arguments)
        payload = None
        if request_id is not None:
            if not isinstance(request_id, str) or not request_id.strip():
                raise ValueError("request_id must be non-empty text")
            arguments["request_id"] = request_id
            payload = json.dumps(arguments, sort_keys=True, ensure_ascii=False, allow_nan=False)

        async with self.condition:
            previous = self._submission
            if request_id is not None and request_id in self._request_ids:
                if previous is None or request_id != previous.request_id:
                    raise ValueError("request_id was already used and its response was superseded. Call observe.")
                if payload != previous.payload:
                    raise ValueError("request_id was already used with different arguments")
                submission = previous
            else:
                if previous is not None and not previous.result.done():
                    raise ValueError("Only one action may be in flight")
                if self.closed:
                    return self._public_view()
                if self.pending is None or self.pending.done():
                    raise ValueError("No observation is awaiting an action; call observe")
                # Log the actual structured model arguments separately from the
                # adapter-generated string recorded by Generic V2's recorder.
                # Write before delivery: a logging failure must not execute an
                # unrecorded action. This records submission, not execution.
                if self.action_log is not None:
                    with self.action_log.open("a", encoding="utf-8") as stream:
                        stream.write(json.dumps({
                            "decision_index": self.generation,
                            "arguments": arguments,
                            "adapter_response": response,
                        }, ensure_ascii=False, allow_nan=False) + "\n")
                submission = ActionSubmission(request_id, payload, self.loop.create_future())
                self._submission = submission
                if request_id is not None:
                    self._request_ids.add(request_id)
                self.pending.set_result(response)

        # A tool request can time out after delivery. Keep its result available
        # for a retry on this connection, even when the original waiter cancels.
        return deepcopy(await asyncio.shield(submission.result))

    def _resolve_submission(self) -> None:
        if self._submission is not None and not self._submission.result.done():
            self._submission.result.set_result(self._public_view())

    def _public_view(self) -> dict[str, Any]:
        if self.closed:
            return {"status": "closed", "reason": self.close_reason}
        return deepcopy(self.view)

    async def close(self, reason: str = BATCH_FINISHED) -> None:
        async with self.condition:
            if self.closed:
                return
            self.closed = True
            self.close_reason = reason
            if self.pending is not None and not self.pending.done():
                self.pending.set_exception(ConnectionError(reason))
            self._resolve_submission()
            self.condition.notify_all()
