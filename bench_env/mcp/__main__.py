"""Serve a serial benchmark batch over MCP stdio.

    python -m bench_env.mcp --env-url http://localhost:3000 --run-dir runs/mcp --limit 10

The coding client launches this process as its MCP server. One connection is
one batch; Generic V2 and SerialRunner perform the actual evaluation.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import random
import sys
from pathlib import Path

import anyio
from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.stdio import stdio_server

from bench_env import factory
from bench_env.agent.base import AgentConfig
from bench_env.agent.generic_v2 import GenericAgentV2
from bench_env.config import RunnerConfig
from bench_env.logger import add_log_file, configure_logging
from bench_env.mcp.bridge import MCPBridgeClient
from bench_env.mcp.launch import read_results
from bench_env.mcp.protocol import (
    BATCH_END_MARKER, BATCH_FINISHED, BATCH_STATUS_FILE,
    MODEL_RESPONSE_LOG_KIND, OBSERVATION_FORMAT, RESPONSE_FORMAT, THOUGHT_KIND,
    get_protocol, protocol_sha256,
)
from bench_env.metrics import result_is_error
from bench_env.runner.serial import SerialRunner


def render_view(view: dict) -> list[types.TextContent | types.ImageContent]:
    """Only translate Generic V2 content blocks to MCP, preserving their order."""
    if view.get("status") == "closed":
        if view["reason"] != BATCH_FINISHED:
            raise RuntimeError("MobileGym evaluation stopped due to an infrastructure failure. End this session.")
        return [types.TextContent(type="text", text=BATCH_END_MARKER)]
    result: list[types.TextContent | types.ImageContent] = []
    for block in view.get("content", []):
        if block["type"] == "text":
            result.append(types.TextContent(type="text", text=block["text"]))
        elif block["type"] == "image_url":
            url = block["image_url"]["url"]
            header, data = url.split(",", 1)
            mime = header.split(":", 1)[1].split(";", 1)[0]
            result.append(types.ImageContent(type="image", data=data, mimeType=mime))
    return result


async def serve(args, protocol_stdout) -> None:
    configure_logging(level=logging.INFO)
    config = RunnerConfig(
        agent="generic_v2", model_name=args.model_name,
        env_url=args.env_url, headless=True, quiet=True,
        split=args.split, sample_seed=args.seed, sample_seed_source="cli",
        task_ids=args.task_id, judge_mode="state", eval_mode=args.eval_mode,
        run_dir=args.run_dir, coord_space="norm_0_1000",
    )
    tasks = factory.load_tasks(config)
    if args.task_id:
        requested = set(args.task_id)
        missing = requested - {t.id for t in tasks}
        if missing:
            raise ValueError(f"Unknown or filtered tasks: {sorted(missing)}")
        order = {name: i for i, name in enumerate(args.task_id)}
        tasks.sort(key=lambda t: order[t.id])
    else:
        random.Random(args.seed).shuffle(tasks)
    tasks = tasks[:args.limit]
    if not tasks:
        raise ValueError("No tasks match the selected split")
    args.run_dir.mkdir(parents=True, exist_ok=True)
    # Claim the directory before RunRecorder opens files in write mode.
    # Exclusive creation also covers simultaneous launches with the same path.
    try:
        with (args.run_dir / "results.jsonl").open("x", encoding="utf-8"):
            pass
    except FileExistsError:
        raise ValueError("Refusing to overwrite an existing benchmark run") from None
    bridge = MCPBridgeClient(action_timeout=args.action_timeout, action_log=args.run_dir / "mcp_actions.jsonl")
    recorder = factory.create_recorder(config)
    recorder.start_run(
        agent="GenericAgentV2", model_name=config.model_name,
        extra_meta={
            **SerialRunner.build_run_meta(config, tasks),
            "transport": "mcp", "client": args.client_name, "reasoning_effort": args.reasoning_effort,
            "context_policy": "client_managed_shared_batch",
            "tasks_per_session": len(tasks),
            "prompt_log_kind": "generic_v2_reference_not_actual_client_context",
            "response_format": RESPONSE_FORMAT,
            "model_response_log_kind": MODEL_RESPONSE_LOG_KIND,
            "observation_format": OBSERVATION_FORMAT,
            "thought_kind": THOUGHT_KIND,
            "generic_v2_prompt_policy": "verbatim",
            "generic_v2_prompt_sha256": protocol_sha256(),
            "selected_task_ids": [t.id for t in tasks],
        }, repeat_n=1,
    )
    if recorder.run_dir:
        add_log_file(recorder.run_dir / "console.log")
    runner_task: asyncio.Task | None = None
    env = None

    def write_batch_status(status, completed_episodes):
        path = args.run_dir / BATCH_STATUS_FILE
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps({
            "status": status,
            "completed_episodes": completed_episodes,
            "expected_episodes": len(tasks),
        }), encoding="utf-8")
        temporary.replace(path)

    async def finish_batch(status):
        try:
            if recorder.run_dir is not None:
                recorder.finish_run()
            rows = read_results(args.run_dir)
            completed = sum(not result_is_error(row) for row in rows)
            if status == BATCH_FINISHED and (completed != len(tasks) or [row["id"] for row in rows] != [t.id for t in tasks]):
                status = "infrastructure_error"
            write_batch_status(status, completed)
        except Exception:
            logging.getLogger("bench_env").exception("Could not finalize MCP batch")
            status = "infrastructure_error"
        await bridge.close(status)

    async def run_batch():
        nonlocal env
        status = BATCH_FINISHED
        try:
            agent = GenericAgentV2(bridge, AgentConfig(verbose=False, stream=False))
            evaluator = factory.create_evaluator(config)
            env = await factory.create_env(config)
            runner = SerialRunner(env, agent, tasks, config, recorder, evaluator)
            await runner.run()
        except Exception:
            logging.getLogger("bench_env").exception("MCP batch failed")
            status = "infrastructure_error"
        if bridge.closed:
            return
        await finish_batch(status)

    protocol = get_protocol()
    instructions = (
        "Use observe once, then act once per decision. In MCP, supply the original prompt's THINK "
        "content as the thought text field and its ANSWER content as the action object field. "
        "Do not add XML tags or stringify action. The server handles JSON escaping and builds "
        "the original response format. Use a fresh request_id per action. If a response is lost "
        "on the same connection, repeat the original request_id and arguments. End the session on "
        "disconnect or a tool error reporting an infrastructure failure. "
        "act returns the next screenshot. Do not call tools concurrently. COMPLETE/ABORT end only "
        "the current task; a new [任务] instruction means a new task with a reset phone. Continue "
        f"until the tool returns {BATCH_END_MARKER}. No task scores are returned. Grounded tasks require completing the "
        "AnswerSheet app when their instruction asks for it. Do not use other tools. "
        "The original Generic V2 prompt below is unchanged; only the MCP transport fields replace its text envelope.\n\n" + protocol
    )
    if recorder.run_dir:
        (recorder.run_dir / "mcp_instructions.txt").write_text(instructions, encoding="utf-8")
        (recorder.run_dir / "generic_v2_system_prompt.txt").write_text(protocol, encoding="utf-8")
    server = Server("mobilegym", instructions=instructions)

    @server.list_tools()
    async def list_tools():
        return [
            types.Tool(name="observe", description="Get the current task and cached screenshot. Does not act or advance the environment.",
                       inputSchema={"type": "object", "properties": {}, "additionalProperties": False}),
            types.Tool(name="act", description="Submit thought text and ONE Generic V2 action object as separate fields. Do not add XML tags or stringify the action. The server serializes the fields for the original parser. Returns the next decision screenshot, possibly for the next task.\n" + protocol,
                       inputSchema={"type": "object", "properties": {
                           "thought": {"type": "string", "minLength": 1, "description": "Text for the original prompt's THINK section, without XML tags."},
                           "action": {"type": "object", "additionalProperties": True, "description": "One Generic V2 action object, e.g. {action: TYPE, value: text}. Use normal string values, including newlines; do not JSON-encode this object yourself."},
                           "request_id": {"type": "string", "minLength": 1, "description": "Unique per action in this session. Reuse the same ID and arguments to recover a lost response on this connection."},
                       }, "required": ["thought", "action"], "additionalProperties": False}),
        ]

    if recorder.run_dir:
        (recorder.run_dir / "mcp_tools.json").write_text(
            json.dumps([tool.model_dump(by_alias=True, exclude_none=True) for tool in await list_tools()],
                       ensure_ascii=False, indent=2), encoding="utf-8",
        )

    @server.call_tool()
    async def call_tool(name, arguments):
        nonlocal runner_task
        if name not in {"observe", "act"}:
            raise ValueError("Unknown tool")
        if runner_task is None:
            runner_task = asyncio.create_task(run_batch())
        if name == "observe":
            view = await bridge.observe()
        else:
            view = await bridge.act(**arguments)
        return render_view(view)

    try:
        async with stdio_server(stdout=anyio.wrap_file(protocol_stdout)) as (read, write):
            await server.run(read, write, server.create_initialization_options())
    finally:
        await bridge.close("client_disconnected")
        if bridge.close_reason == "client_disconnected":
            if runner_task is None:
                write_batch_status("client_disconnected", 0)
            else:
                if not runner_task.done():
                    runner_task.cancel()
                    await asyncio.gather(runner_task, return_exceptions=True)
                if env is not None:
                    await env.close()
                await finish_batch("client_disconnected")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-url", required=True)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--model-name", default="gpt-5.6-sol")
    parser.add_argument("--client-name", default="codex")
    parser.add_argument("--reasoning-effort", default="medium")
    parser.add_argument("--split", default="test")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--task-id", action="append")
    parser.add_argument("--eval-mode", choices=["grounded", "text"], default="grounded")
    parser.add_argument("--action-timeout", type=float, default=300.0)
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("--limit must be positive")
    # Preserve stdout exclusively for MCP framing, including Runner's prints.
    protocol_stdout = sys.stdout
    sys.stdout = sys.stderr
    asyncio.run(serve(args, protocol_stdout))


if __name__ == "__main__":
    main()
