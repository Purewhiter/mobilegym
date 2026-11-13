"""Extract client-reported usage without copying private rollout contents."""

from __future__ import annotations

import json
import os
from pathlib import Path


def collect_usage(run_dir: Path) -> dict:
    thread_id = None
    final_usage = None
    tool_calls = []
    events = run_dir / "client_events.jsonl"
    for line in events.read_text().splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue  # Allow inspecting a running client with a partial last line.
        if event.get("type") == "thread.started":
            thread_id = event.get("thread_id")
        if event.get("type") == "turn.completed":
            final_usage = event.get("usage")
        item = event.get("item", {})
        if event.get("type") == "item.completed" and item.get("type") == "mcp_tool_call":
            tool_calls.append({"server": item.get("server"), "tool": item.get("tool"),
                               "status": item.get("status")})
    report = {
        "thread_id": thread_id, "final_usage": final_usage,
        "tool_calls": tool_calls, "contexts": [], "token_snapshots": [],
        "compaction_events": [], "rollout_usage_available": False,
        "note": "Client-reported token accounting, not subscription quota or billing. Input totals sum requests; they are not context size.",
    }
    if thread_id:
        codex_root = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
        # Only read the exact session launched for this run. Copy no message,
        # credential, image, memory, rate-limit, or unrelated session content.
        paths = list((codex_root / "sessions").rglob(f"*{thread_id}*.jsonl"))
        for path in paths:
            report["rollout_usage_available"] = True
            for line in path.open():
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                payload = event.get("payload", {})
                timestamp = event.get("timestamp")
                if event.get("type") == "turn_context":
                    report["contexts"].append({"timestamp": timestamp,
                                               "model": payload.get("model"), "effort": payload.get("effort")})
                if event.get("type") == "event_msg" and payload.get("type") == "token_count":
                    report["token_snapshots"].append({"timestamp": timestamp, "info": payload.get("info")})
                if event.get("type") == "compacted" or (
                    event.get("type") == "event_msg" and payload.get("type") == "context_compacted"
                ):
                    report["compaction_events"].append({"timestamp": timestamp, "type": event.get("type")})
    (run_dir / "client_usage.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    return report


if __name__ == "__main__":
    import sys
    report = collect_usage(Path(sys.argv[1]))
    print(json.dumps({k: v for k, v in report.items() if k not in {"token_snapshots", "tool_calls"}}, ensure_ascii=False))
