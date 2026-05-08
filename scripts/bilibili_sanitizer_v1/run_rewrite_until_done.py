#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

from io_utils import load_video_comments, load_videos
from rewrite_video_comments import _validate_comment_forest


DEFAULT_OUT_ROOT = Path(__file__).resolve().parent / "out" / "users_full_20260503"


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        item = json.loads(line)
        item["_line"] = line_no
        rows.append(item)
    return rows


def _healthcheck(base_url: str, timeout: float) -> tuple[bool, str]:
    url = f"{base_url.rstrip('/')}/models"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return 200 <= resp.status < 300, f"HTTP {resp.status}"
    except Exception as exc:
        return False, str(exc)


def _audit_videos(out_path: Path) -> dict[str, Any]:
    expected = {str(video["id"]) for video in load_videos()}
    rows = _load_jsonl(out_path)
    id_counts = Counter(str(row.get("id", "")) for row in rows)
    seen = {video_id for video_id, count in id_counts.items() if video_id and count > 0}
    duplicate_ids = sorted(video_id for video_id, count in id_counts.items() if video_id and count > 1)
    unknown_ids = sorted(video_id for video_id in seen if video_id not in expected)
    missing_ids = sorted(video_id for video_id in expected if video_id not in seen)
    invalid_rows = []
    for row in rows:
        tags = row.get("tags")
        if not str(row.get("title", "")).strip() or not isinstance(tags, list) or not tags:
            invalid_rows.append(str(row.get("id", "")))
    return {
        "expected_total": len(expected),
        "rows": len(rows),
        "unique_ids": len(seen),
        "remaining_missing_or_unwritten": len(missing_ids),
        "duplicates": len(duplicate_ids),
        "unknown_ids": len(unknown_ids),
        "invalid_rows": len(invalid_rows),
        "duplicate_ids_sample": duplicate_ids[:20],
        "unknown_ids_sample": unknown_ids[:20],
        "missing_ids_sample": missing_ids[:20],
        "invalid_rows_sample": invalid_rows[:20],
    }


def _audit_comments(out_path: Path) -> dict[str, Any]:
    originals = load_video_comments()
    expected = {str(video_id) for video_id in originals}
    rows = _load_jsonl(out_path)
    id_counts = Counter(str(row.get("id", "")) for row in rows)
    seen = {video_id for video_id, count in id_counts.items() if video_id and count > 0}
    duplicate_ids = sorted(video_id for video_id, count in id_counts.items() if video_id and count > 1)
    unknown_ids = sorted(video_id for video_id in seen if video_id not in expected)
    missing_ids = sorted(video_id for video_id in expected if video_id not in seen)
    invalid_rows = []
    for row in rows:
        video_id = str(row.get("id", ""))
        original = originals.get(video_id)
        if not original:
            continue
        errors = _validate_comment_forest(original.get("comments", []) or [], row.get("comments"))
        if errors:
            invalid_rows.append({"id": video_id, "error": "; ".join(errors[:3])})
    return {
        "expected_total": len(expected),
        "rows": len(rows),
        "unique_ids": len(seen),
        "remaining_missing_or_unwritten": len(missing_ids),
        "duplicates": len(duplicate_ids),
        "unknown_ids": len(unknown_ids),
        "invalid_rows": len(invalid_rows),
        "duplicate_ids_sample": duplicate_ids[:20],
        "unknown_ids_sample": unknown_ids[:20],
        "missing_ids_sample": missing_ids[:20],
        "invalid_rows_sample": invalid_rows[:20],
    }


def _is_done(audit: dict[str, Any]) -> bool:
    return (
        audit["unique_ids"] == audit["expected_total"]
        and audit["duplicates"] == 0
        and audit["unknown_ids"] == 0
        and audit["invalid_rows"] == 0
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Keep resuming Bilibili video/comment rewrites until done.")
    parser.add_argument("target", choices=["videos", "comments"])
    parser.add_argument("--out-root", type=Path, default=Path(os.environ.get("BILIBILI_OUT_ROOT", DEFAULT_OUT_ROOT)))
    parser.add_argument("--model", default=os.environ.get("BILIBILI_TEXT_MODEL", "Qwen3.6-35B-A3B"))
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL", "http://localhost:8000/v1"))
    parser.add_argument("--concurrency", type=int, default=32)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--poll-seconds", type=float, default=60)
    parser.add_argument("--health-timeout", type=float, default=10)
    parser.add_argument("--request-timeout", type=float, default=180)
    parser.add_argument("--pass-timeout", type=float, default=7200)
    parser.add_argument("--max-passes", type=int, default=200)
    args = parser.parse_args()

    out_root = args.out_root
    out_root.mkdir(parents=True, exist_ok=True)
    if args.target == "videos":
        out_path = out_root / "videos.jsonl"
        audit_fn = _audit_videos
        script = Path(__file__).with_name("rewrite_videos.py")
        extra_args = ["--users", str(out_root / "users.jsonl")]
    else:
        out_path = out_root / "video_comments.jsonl"
        audit_fn = _audit_comments
        script = Path(__file__).with_name("rewrite_video_comments.py")
        extra_args = ["--users", str(out_root / "users.jsonl"), "--videos", str(out_root / "videos.jsonl")]

    log_path = out_root / f"{args.target}.runner.log"
    audit_path = out_root / f"{args.target}.audit.json"

    def log(message: str) -> None:
        line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}"
        print(line, flush=True)
        with log_path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    for pass_index in range(1, args.max_passes + 1):
        audit = audit_fn(out_path)
        audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
        if _is_done(audit):
            log(f"DONE audit={json.dumps(audit, ensure_ascii=False)}")
            return

        ok, health = _healthcheck(args.base_url, args.health_timeout)
        if not ok:
            log(f"WAIT model unavailable: {health}; audit={json.dumps(audit, ensure_ascii=False)}")
            time.sleep(args.poll_seconds)
            continue

        failures_path = out_root / f"{args.target}.pass{pass_index}.failures.jsonl"
        env = os.environ.copy()
        env["BILIBILI_OUT_ROOT"] = str(out_root)
        env["OPENAI_BASE_URL"] = args.base_url
        env["OPENAI_TIMEOUT"] = str(args.request_timeout)
        cmd = [
            sys.executable,
            str(script),
            "--out",
            str(out_path),
            "--concurrency",
            str(args.concurrency),
            "--model",
            args.model,
            "--retries",
            str(args.retries),
            "--failures",
            str(failures_path),
            *extra_args,
        ]
        log(f"RUN pass={pass_index} cmd={' '.join(cmd)}")
        started = time.time()
        try:
            result = subprocess.run(cmd, env=env, timeout=args.pass_timeout, check=False)
            log(f"PASS pass={pass_index} returncode={result.returncode} seconds={time.time() - started:.1f}")
        except subprocess.TimeoutExpired:
            log(f"TIMEOUT pass={pass_index} seconds={args.pass_timeout}")

    audit = audit_fn(out_path)
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    raise SystemExit(f"not complete after {args.max_passes} passes: {json.dumps(audit, ensure_ascii=False)}")


if __name__ == "__main__":
    main()
