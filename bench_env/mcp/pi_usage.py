"""Normalize Pi's reported token usage without treating estimates as billing."""

from __future__ import annotations

import json
from pathlib import Path


def collect_usage(run_dir: Path) -> dict:
    runtime_path = run_dir / "pi_runtime.json"
    runtime = json.loads(runtime_path.read_text()) if runtime_path.exists() else {}
    totals = {key: 0 for key in ["input_tokens", "cached_input_tokens", "cache_write_input_tokens",
                               "output_tokens", "reasoning_output_tokens"]}
    snapshots, compactions, tools = [], [], []
    session_id = None
    # Ignore token deltas and final agent_end history copies: message_end is the
    # authoritative usage event and must be counted only once per response.
    prefixes = tuple('{"type":"' + kind + '"' for kind in [
        "session", "message_end", "compaction_start", "compaction_end", "tool_execution_end",
    ])
    with (run_dir / "pi_events.jsonl").open() as events:
        for line in events:
            if not line.startswith(prefixes):
                continue
            try:
                event = json.loads(line)
            except ValueError:
                continue  # An active client's last line may still be incomplete.
            kind = event.get("type")
            if kind == "session":
                session_id = event.get("id")
            elif kind == "message_end" and event.get("message", {}).get("role") == "assistant":
                message = event["message"]
                usage = message.get("usage") or {}
                if not usage:
                    continue
                # pi-ai subtracts cache reads/writes from OpenAI input_tokens.
                # Add them back to compare with Codex's total input reporting.
                last = {
                    "input_tokens": usage.get("input", 0) + usage.get("cacheRead", 0) + usage.get("cacheWrite", 0),
                    "cached_input_tokens": usage.get("cacheRead", 0),
                    "cache_write_input_tokens": usage.get("cacheWrite", 0),
                    "output_tokens": usage.get("output", 0),
                    "reasoning_output_tokens": usage.get("reasoning", 0),
                }
                for key, value in last.items():
                    totals[key] += value
                snapshots.append({"timestamp_ms": message.get("timestamp"), "stop_reason": message.get("stopReason"),
                                  "info": {"last_token_usage": last, "total_token_usage": dict(totals),
                                           "model_context_window": runtime.get("contextWindow")}})
            elif kind in {"compaction_start", "compaction_end"}:
                compactions.append({key: event[key] for key in ["type", "reason", "aborted", "errorMessage"] if key in event})
            elif kind == "tool_execution_end":
                tools.append({"tool": event.get("toolName"), "is_error": event.get("isError", False)})
    report = {
        "client": "pi", "session_id": session_id, "runtime": runtime,
        "final_usage": totals, "token_snapshots": snapshots, "compaction_events": compactions,
        "completed_compactions": sum(e["type"] == "compaction_end" and not e.get("aborted") and not e.get("errorMessage") for e in compactions),
        "tool_calls": tools,
        "note": "Input = Pi input + cacheRead + cacheWrite. Counts are client-reported usage; cost estimates are not subscription billing.",
    }
    (run_dir / "client_usage.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    return report


if __name__ == "__main__":
    import sys
    report = collect_usage(Path(sys.argv[1]))
    print(json.dumps({"usage": report["final_usage"], "completed_compactions": report["completed_compactions"],
                      "responses": len(report["token_snapshots"])}, ensure_ascii=False))
