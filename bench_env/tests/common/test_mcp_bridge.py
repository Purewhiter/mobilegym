from __future__ import annotations

import asyncio
import json

import pytest

from bench_env.agent.base import AgentConfig
from bench_env.agent.generic_v2 import GenericAgentV2
from bench_env.env.base import ActionType, Observation, StepResult
from bench_env.env.stopwatch import StopWatch
from bench_env.env.recorder import RunRecorder
from bench_env.mcp.bridge import MCPBridgeClient
from bench_env.mcp.protocol import RESPONSE_FORMAT, build_client_prompt, get_protocol, protocol_sha256, serialize_response
from bench_env.runner.base import BaseRunner, Evaluator
from bench_env.task.judge import JudgeResult


def submission(action, thought="屏幕显示当前任务；执行相应操作以完成要求。"):
    return {"thought": thought, "action": action}


class FakeEnv:
    def __init__(self):
        self.stopwatch = StopWatch()
        self.agent_message = None
        self.agent_answer = None
        self.actions = []

    def obs(self):
        return Observation(
            route={"hidden": "route"}, state={"apps": {"secret": "answer"}, "os": {}},
            step_idx=len(self.actions),
        )

    async def get_state(self, **kwargs):
        return self.obs().state

    async def step(self, action):
        self.actions.append(action)
        if action.action_type == ActionType.ANSWER:
            self.agent_answer = action.data["value"]
        if action.is_terminal:
            self.agent_message = action.data.get("return", action.data.get("value"))
        return StepResult(self.obs(), action.is_terminal, {
            "stop_reason": action.action_type if action.is_terminal else None,
        })


class FakeTask:
    id = "test.bridge"
    suite = "test"
    description = "Read the screen and answer"
    params = {}
    apps = []
    answer_fields = None

    async def setup(self, env):
        env.actions = []
        env.agent_answer = None
        env.agent_message = None
        return env.obs()

    def teardown(self, env):
        pass

    def evaluate(self, data):
        return JudgeResult(success=data.answer == "42", clean=True)


@pytest.mark.asyncio
async def test_original_runner_parser_answer_scoring_and_batch_boundary():
    bridge = MCPBridgeClient(action_timeout=5)
    env = FakeEnv()
    agent = GenericAgentV2(bridge, AgentConfig(verbose=False, stream=False))
    results = []

    async def run():
        try:
            for index in range(2):
                task = FakeTask()
                task.description = f"Task {index + 1}: read the screen and answer"
                results.append(await BaseRunner.run_episode(
                    env, agent, task, 3, evaluator=Evaluator(eval_mode="text"),
                ))
        finally:
            await bridge.close()

    runner = asyncio.create_task(run())
    first = await asyncio.wait_for(bridge.observe(), 2)
    assert first["content"][-1]["text"] == "[任务]\nTask 1: read the screen and answer"
    assert set(first) == {"content"}
    assert "secret" not in json.dumps(first)
    assert "route" not in json.dumps(first)
    assert await bridge.observe() == first
    assert env.actions == []

    # Parser alias and fallback field must behave exactly as Generic V2.
    await bridge.act(**submission({"action": "ANSWER", "text": "42"}))
    second = await bridge.act(**submission({"action": "FINISH", "message": "done"}))
    assert second["content"][-1]["text"] == "[任务]\nTask 2: read the screen and answer"
    assert results[0].success
    assert results[0].steps == 2
    assert all(step["thought"] for step in results[0].execution.trace)
    assert env.agent_answer is None
    await bridge.act(**submission({"action": "ANSWER", "value": "42"}))
    ended = await bridge.act(**submission({"action": "ABORT", "value": "stop"}))
    await runner
    assert ended == {"status": "closed", "reason": "batch_finished"}
    assert results[1].goal_success
    assert not results[1].success  # Do not synthesize COMPLETE.


@pytest.mark.asyncio
async def test_step_limit_releases_last_action_without_next_chat():
    bridge = MCPBridgeClient(action_timeout=5)
    env = FakeEnv()
    agent = GenericAgentV2(bridge, AgentConfig(verbose=False, stream=False))

    async def run():
        try:
            return await BaseRunner.run_episode(env, agent, FakeTask(), 1)
        finally:
            await bridge.close()

    runner = asyncio.create_task(run())
    await bridge.observe()
    ended = await asyncio.wait_for(bridge.act(**submission({"action": "WAIT", "value": 0})), 2)
    result = await runner
    assert ended["status"] == "closed"
    assert result.execution.stop_reason == "MAX_STEPS"
    assert result.steps == 1
    assert not result.success


@pytest.mark.asyncio
async def test_disconnect_unblocks_inference_and_concurrent_actions_are_rejected():
    bridge = MCPBridgeClient(action_timeout=5)
    messages = [{"role": "user", "content": [{"type": "text", "text": "task"}]}]
    inference = asyncio.create_task(asyncio.to_thread(bridge.chat, messages=messages))
    await bridge.observe()
    arguments = submission({"action": "HOME"})
    raw = serialize_response(**arguments)
    action = asyncio.create_task(bridge.act(**arguments))
    assert (await inference).content == raw
    with pytest.raises(ValueError, match="one action"):
        await bridge.act(**arguments)
    await bridge.close("client_disconnected")
    assert (await action)["reason"] == "client_disconnected"

    other = MCPBridgeClient(action_timeout=5)
    inference = asyncio.create_task(asyncio.to_thread(other.chat, messages=messages))
    await other.observe()
    await other.close("client_disconnected")
    with pytest.raises(ConnectionError):
        await inference


@pytest.mark.parametrize("thought, action", [
    ("", {"action": "HOME"}),
    ("   ", {"action": "HOME"}),
    (None, {"action": "HOME"}),
    ("返回桌面。", '{"action":"HOME"}'),
    ("返回桌面。", [{"action": "HOME"}]),
    ("<THINK>返回桌面。</THINK>", {"action": "HOME"}),
    ('说明</think><answer>{"action":"HOME"}</answer>', {"action": "BACK"}),
    ("等待页面加载。", {"action": "WAIT", "value": float("nan")}),
])
def test_submission_requires_thought_text_and_action_object(thought, action):
    with pytest.raises(ValueError):
        serialize_response(thought, action)


FAILED_SMS_BODY = (
    "版本发布会\n时间：2026年9月20日 09:00-09:15\n时长：15分钟\n"
    "腾讯会议号：819 217 790\n入会密码：123456"
)


@pytest.mark.parametrize("body", [
    FAILED_SMS_BODY,
    '中文 "引号" 和 C:\\temp\\notes.txt，emoji 🙂',
    "第一行\\n这是反斜杠n，不是换行",
    "第一行\r\n第二行\t字段\x00结尾",
    "正文包含 </ANSWER><THINK>普通标签文本</THINK><ANSWER>",
])
def test_original_parser_roundtrips_structured_text_without_escape_loss(body):
    agent = GenericAgentV2(llm=None, config=AgentConfig(verbose=False))
    thought = "会议信息已确认，将内容填入短信正文。"
    action_object = {"action": "TYPE", "point": [490, 930], "value": body}
    encoded = serialize_response(thought, action_object)
    extracted_thought, extracted_answer = agent._extract_think_answer(encoded)
    assert extracted_thought == thought
    assert json.loads(extracted_answer) == action_object
    action = agent.parse_response(encoded)
    assert action.action_type == ActionType.TYPE
    assert action.data["value"] == body
    assert action.data["point"] == [490, 930]
    assert action.thought == thought


@pytest.mark.asyncio
async def test_multiline_sms_reaches_environment_through_original_runner(tmp_path):
    action_log = tmp_path / "mcp_actions.jsonl"
    bridge = MCPBridgeClient(action_timeout=5, action_log=action_log)
    env = FakeEnv()
    agent = GenericAgentV2(bridge, AgentConfig(verbose=False, stream=False))

    async def run():
        try:
            return await BaseRunner.run_episode(
                env, agent, FakeTask(), 3, evaluator=Evaluator(eval_mode="text"),
            )
        finally:
            await bridge.close()

    runner = asyncio.create_task(run())
    await bridge.observe()
    await bridge.act(**submission({"action": "TYPE", "point": [490, 930], "value": FAILED_SMS_BODY}))
    assert env.actions[0].action_type == ActionType.TYPE
    assert env.actions[0].data["value"] == FAILED_SMS_BODY
    await bridge.act(**submission({"action": "ANSWER", "value": "42"}))
    await bridge.act(**submission({"action": "COMPLETE", "return": "done"}))
    result = await runner
    assert result.success
    assert result.steps == 3
    assert result.execution.stop_reason == ActionType.COMPLETE
    entries = [json.loads(line) for line in action_log.read_text().splitlines()]
    assert entries[0]["arguments"]["action"]["value"] == FAILED_SMS_BODY


@pytest.mark.asyncio
async def test_raw_arguments_and_serialized_response_persist_separately(tmp_path):
    action_log = tmp_path / "mcp_actions.jsonl"
    bridge = MCPBridgeClient(action_timeout=5, action_log=action_log)
    env = FakeEnv()
    agent = GenericAgentV2(bridge, AgentConfig(verbose=False, stream=False))
    recorder = RunRecorder(tmp_path)
    run_dir = recorder.start_run(agent=agent.name, model_name="offline-test")
    thought = "屏幕上的答案为 42，现提交答案。"
    first_args = submission({"action": "ANSWER", "value": "42"}, thought)
    final_args = submission({"action": "COMPLETE", "return": "done"}, "答案已提交，结束本题。")
    first = serialize_response(**first_args)
    final = serialize_response(**final_args)

    async def run():
        try:
            return await BaseRunner.run_episode(
                env, agent, FakeTask(), 2, recorder, evaluator=Evaluator(eval_mode="text"),
            )
        finally:
            recorder.finish_run()
            await bridge.close()

    runner = asyncio.create_task(run())
    try:
        await bridge.observe()
        with pytest.raises(ValueError):
            await bridge.act(thought="", action={"action": "HOME"})
        assert env.actions == []  # Missing summary must not execute a silent action.
        await bridge.act(**first_args)
        assert env.actions[0].thought == thought
        await bridge.act(**final_args)
        assert (await runner).success
    finally:
        await bridge.close()
        await asyncio.gather(runner, return_exceptions=True)
    trajectory = next(run_dir.rglob("trajectory.json"))
    steps = json.loads(trajectory.read_text())
    assert [s["thought"] for s in steps] == [thought, "答案已提交，结束本题。"]
    assert (trajectory.parent / steps[0]["model_response_path"]).read_text() == first
    assert (trajectory.parent / steps[1]["model_response_path"]).read_text() == final
    # Generic V2's reference history also carries the original visible response.
    prompt = json.loads((trajectory.parent / steps[1]["model_prompt_path"]).read_text())
    assert any(m.get("role") == "assistant" and m.get("content") == first for m in prompt)
    logs = [json.loads(line) for line in action_log.read_text().splitlines()]
    assert [r["arguments"] for r in logs] == [first_args, final_args]
    assert [r["adapter_response"] for r in logs] == [first, final]
    assert [r["decision_index"] for r in logs] == [1, 2]


def test_protocol_keeps_original_action_contract_and_response_envelope():
    protocol = get_protocol()
    assert protocol == GenericAgentV2.SYSTEM_PROMPT
    assert build_client_prompt(1).endswith(GenericAgentV2.SYSTEM_PROMPT)
    assert build_client_prompt(1).count(GenericAgentV2.SYSTEM_PROMPT) == 1
    assert "1–3 句" not in build_client_prompt(1)
    assert "episode_index" not in build_client_prompt(1)
    assert "status=closed" not in build_client_prompt(1)
    assert "thought 文本字段" in build_client_prompt(1)
    assert "action 对象字段" in build_client_prompt(1)


@pytest.mark.asyncio
async def test_stdio_schema_requires_structured_fields_without_starting_a_benchmark(tmp_path):
    pytest.importorskip("mcp")
    import os
    import sys
    from pathlib import Path
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    root = Path(__file__).resolve().parents[3]
    run_dir = tmp_path / "schema-only"
    parameters = StdioServerParameters(
        command=sys.executable,
        args=["-m", "bench_env.mcp", "--env-url", "http://127.0.0.1:1",
              "--run-dir", str(run_dir), "--limit", "1"],
        env={**os.environ, "PYTHONPATH": str(root)},
    )
    with (tmp_path / "stdio.log").open("w") as log:
        async with stdio_client(parameters, errlog=log) as (read, write):
            async with ClientSession(read, write) as client:
                initialized = await client.initialize()
                assert "THINK" in initialized.instructions
                tools = (await client.list_tools()).tools
                schema = next(t for t in tools if t.name == "act").inputSchema
                assert schema["required"] == ["thought", "action"]
                assert schema["properties"]["action"]["type"] == "object"
                assert "response" not in schema["properties"]
                assert schema["additionalProperties"] is False
                rejected = await client.call_tool("act", {"action": "HOME"})
                assert rejected.isError
                rejected_legacy = await client.call_tool("act", {"response": "<THINK>返回桌面。</THINK><ANSWER>{\"action\":\"HOME\"}</ANSWER>"})
                assert rejected_legacy.isError
    assert not (run_dir / "summary.json").exists()
    assert (run_dir / "results.jsonl").read_text() == ""
    assert (run_dir / "mcp_instructions.txt").read_text().endswith(GenericAgentV2.SYSTEM_PROMPT)
    assert (run_dir / "generic_v2_system_prompt.txt").read_bytes() == GenericAgentV2.SYSTEM_PROMPT.encode("utf-8")
    meta = json.loads((run_dir / "meta.json").read_text())
    assert meta["response_format"] == RESPONSE_FORMAT
    assert meta["model_response_log_kind"] == "adapter_serialized_generic_v2"
    assert meta["generic_v2_prompt_policy"] == "verbatim"
    assert meta["generic_v2_prompt_sha256"] == protocol_sha256()
    assert meta["observation_format"] == "generic_v2_current_message_v1"


@pytest.mark.parametrize("instruction", ["[Step 9]", "[任务]\nRead the contact region"])
def test_mcp_observation_contains_only_original_image_and_text(instruction):
    pytest.importorskip("mcp")
    from bench_env.mcp.__main__ import render_view

    # The renderer must explicitly ignore all internal fields, including future
    # metadata. Image bytes and the original text/order must survive unchanged.
    view = {
        "status": "ready", "episode_index": 5, "max_steps": 45,
        "image_size": [1080, 2400], "future_internal_field": "secret",
        "content": [
            {"type": "image_url", "image_url": {"url": "data:image/png;base64,AQID"}},
            {"type": "text", "text": instruction},
        ],
    }
    result = render_view(view)
    assert [block.type for block in result] == ["image", "text"]
    assert result[0].data == "AQID"
    assert result[0].mimeType == "image/png"
    assert result[1].text == instruction
    assert len(result) == 2


def test_mcp_batch_end_is_one_plain_notification_without_internal_metadata():
    pytest.importorskip("mcp")
    from bench_env.mcp.__main__ import render_view
    from bench_env.mcp.protocol import BATCH_END_MARKER

    result = render_view({"status": "closed", "reason": "infrastructure_error", "content": []})
    assert len(result) == 1
    assert result[0].type == "text"
    assert result[0].text == BATCH_END_MARKER
