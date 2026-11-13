from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys

import pytest

from bench_env.mcp.pi_usage import collect_usage


def test_pi_usage_counts_only_final_messages_and_restores_cached_inputs(tmp_path):
    (tmp_path / "pi_runtime.json").write_text(json.dumps({"model": "gpt-5.6-sol", "thinking": "medium", "contextWindow": 272000}))
    events = [
        {"type": "session", "id": "test-session"},
        {"type": "message_update", "usage": {"input": 99999}},
        {"type": "message_end", "message": {"role": "user"}},
        {"type": "message_end", "message": {"role": "assistant", "timestamp": 1, "usage": {
            "input": 2, "cacheRead": 3, "cacheWrite": 4, "output": 5, "reasoning": 1,
            "cost": {"total": 100},
        }}},
        {"type": "message_end", "message": {"role": "assistant", "timestamp": 2, "usage": {"input": 1, "output": 2}}},
        {"type": "agent_end", "messages": [{"role": "assistant", "usage": {"input": 99999}}]},
        {"type": "compaction_start", "reason": "threshold"},
        {"type": "compaction_end", "aborted": False},
        {"type": "compaction_end", "aborted": True},
        {"type": "tool_execution_end", "toolName": "mobilegym_act", "isError": False},
    ]
    (tmp_path / "pi_events.jsonl").write_text("\n".join(json.dumps(e, separators=(",", ":")) for e in events) + '\n{"type":"message_end"')
    report = collect_usage(tmp_path)
    assert report["final_usage"] == {
        "input_tokens": 10, "cached_input_tokens": 3, "cache_write_input_tokens": 4,
        "output_tokens": 7, "reasoning_output_tokens": 1,
    }
    assert len(report["token_snapshots"]) == 2
    assert report["completed_compactions"] == 1
    assert report["session_id"] == "test-session"
    assert '"cost":' not in json.dumps(report)


@pytest.mark.asyncio
async def test_pi_gateway_negotiates_real_mcp_schema_without_model_or_environment(tmp_path):
    pytest.importorskip("mcp")
    root = Path(__file__).resolve().parents[3]
    run_dir = tmp_path / "run"
    config = tmp_path / "config.json"
    config.write_text(json.dumps({"python": sys.executable, "server_args": [
        "-m", "bench_env.mcp", "--env-url", "http://127.0.0.1:1", "--run-dir", str(run_dir),
        "--client-name", "pi", "--task-id", "wechat.ReadContactRegion", "--limit", "1",
    ]}))
    with (tmp_path / "stderr.log").open("w") as errors:
        process = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "bench_env.mcp.pi_gateway", "--config", str(config),
            cwd=root, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=errors,
        )
        try:
            hello = json.loads(await asyncio.wait_for(process.stdout.readline(), 60))
            assert hello["id"] == 0
            tools = hello["result"]["tools"]
            assert {t["name"] for t in tools} == {"observe", "act"}
            act = next(t for t in tools if t["name"] == "act")
            assert act["inputSchema"]["required"] == ["thought", "action"]
            request = {"id": 1, "name": "act", "arguments": {"thought": "测试\n🙂", "action": "not an object"}}
            process.stdin.write((json.dumps(request, ensure_ascii=False) + "\n").encode())
            await process.stdin.drain()
            reply = json.loads(await asyncio.wait_for(process.stdout.readline(), 10))
            assert reply["id"] == 1
            assert reply["result"]["isError"] is True
        finally:
            process.stdin.close()
            try:
                await asyncio.wait_for(process.wait(), 10)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
    assert (run_dir / "results.jsonl").read_text() == ""
    assert not (run_dir / "summary.json").exists()
    assert json.loads((run_dir / "meta.json").read_text())["client"] == "pi"
