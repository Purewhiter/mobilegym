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

from io_utils import OUTPUT_ROOT, load_authors, load_commenters
from rewrite_users import FORBIDDEN_OUTPUT_TERMS, _name_too_close
from risk_utils import EMAIL_RE, HANDLE_RE, PHONE_RE, URL_RE


DEFAULT_OUT_ROOT = Path(__file__).resolve().parent / "out" / "users_full_20260503"


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        item = json.loads(line)
        item["_line"] = line_no
        rows.append(item)
    return rows


def _expected_users() -> dict[str, dict[str, Any]]:
    users: dict[str, dict[str, Any]] = {}
    for mid, user in load_authors().items():
        users[f"author:{mid}"] = user
    for mid, user in load_commenters().items():
        users[f"commenter:{mid}"] = user
    return users


def _healthcheck(base_url: str, timeout: float) -> tuple[bool, str]:
    url = f"{base_url.rstrip('/')}/models"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return 200 <= resp.status < 300, f"HTTP {resp.status}"
    except Exception as exc:
        return False, str(exc)


def _audit(out_path: Path) -> dict[str, Any]:
    expected = _expected_users()
    rows = _load_jsonl(out_path)
    key_counts = Counter(str(row.get("key", "")) for row in rows)
    seen = {key for key, count in key_counts.items() if key}
    duplicate_keys = [key for key, count in key_counts.items() if key and count > 1]
    unknown_keys = sorted(key for key in seen if key not in expected)
    missing_keys = sorted(key for key in expected if key not in seen)
    exact_name_kept = []
    high_similarity_name = []
    risk_term_rows = []
    regex_hit_rows = []

    for row in rows:
        key = str(row.get("key", ""))
        original = expected.get(key)
        if not original:
            continue
        old_name = str(original.get("name", "") or "")
        name = str(row.get("name", "") or "")
        sign = str(row.get("sign", "") or "")
        text = f"{name}\n{sign}"
        if name == old_name:
            exact_name_kept.append(key)
        elif _name_too_close(old_name, name):
            high_similarity_name.append(key)
        terms = [term for term in FORBIDDEN_OUTPUT_TERMS if term in text]
        if terms:
            risk_term_rows.append({"key": key, "terms": terms, "name": name, "sign": sign})
        labels = []
        for regex, label in ((EMAIL_RE, "email"), (URL_RE, "url"), (PHONE_RE, "phone"), (HANDLE_RE, "handle")):
            if regex.search(text):
                labels.append(label)
        if labels:
            regex_hit_rows.append({"key": key, "labels": labels, "name": name, "sign": sign})

    return {
        "expected_total": len(expected),
        "rows": len(rows),
        "unique_keys": len(seen),
        "remaining_missing_or_unwritten": len(missing_keys),
        "duplicates": len(duplicate_keys),
        "unknown_keys": len(unknown_keys),
        "exact_name_kept": len(exact_name_kept),
        "high_similarity_name": len(high_similarity_name),
        "risk_term_rows": len(risk_term_rows),
        "regex_hit_rows": len(regex_hit_rows),
        "duplicate_keys_sample": duplicate_keys[:20],
        "unknown_keys_sample": unknown_keys[:20],
        "missing_keys_sample": missing_keys[:20],
        "exact_name_kept_sample": exact_name_kept[:20],
        "high_similarity_name_sample": high_similarity_name[:20],
        "risk_term_rows_sample": risk_term_rows[:20],
        "regex_hit_rows_sample": regex_hit_rows[:20],
    }


def _write_audit(out_root: Path, audit: dict[str, Any]) -> None:
    audit_path = out_root / "users.audit.json"
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Keep resuming Bilibili user rewrites until every user is done.")
    parser.add_argument("--out-root", type=Path, default=Path(os.environ.get("BILIBILI_OUT_ROOT", DEFAULT_OUT_ROOT)))
    parser.add_argument("--model", default=os.environ.get("BILIBILI_TEXT_MODEL", "Qwen3.6-35B-A3B"))
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL", "http://localhost:8000/v1"))
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--concurrency", type=int, default=32)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--poll-seconds", type=float, default=60)
    parser.add_argument("--health-timeout", type=float, default=10)
    parser.add_argument("--request-timeout", type=float, default=120)
    parser.add_argument("--pass-timeout", type=float, default=3600)
    parser.add_argument("--max-passes", type=int, default=200)
    args = parser.parse_args()

    out_root = args.out_root
    out_root.mkdir(parents=True, exist_ok=True)
    out_path = out_root / "users.jsonl"
    log_path = out_root / "users.runner.log"
    expected_total = len(_expected_users())

    def log(message: str) -> None:
        line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}"
        print(line, flush=True)
        with log_path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    for pass_index in range(1, args.max_passes + 1):
        audit = _audit(out_path)
        _write_audit(out_root, audit)
        if (
            audit["unique_keys"] == expected_total
            and audit["duplicates"] == 0
            and audit["unknown_keys"] == 0
            and audit["exact_name_kept"] == 0
            and audit["high_similarity_name"] == 0
            and audit["risk_term_rows"] == 0
            and audit["regex_hit_rows"] == 0
        ):
            log(f"DONE audit={json.dumps(audit, ensure_ascii=False)}")
            return

        ok, health = _healthcheck(args.base_url, args.health_timeout)
        if not ok:
            log(f"WAIT model unavailable: {health}; audit={json.dumps(audit, ensure_ascii=False)}")
            time.sleep(args.poll_seconds)
            continue

        failures_path = out_root / f"users.pass{pass_index}.failures.jsonl"
        env = os.environ.copy()
        env["BILIBILI_OUT_ROOT"] = str(out_root)
        env["OPENAI_BASE_URL"] = args.base_url
        env["OPENAI_TIMEOUT"] = str(args.request_timeout)
        cmd = [
            sys.executable,
            str(Path(__file__).with_name("rewrite_users.py")),
            "--source",
            "all",
            "--batch-size",
            str(args.batch_size),
            "--concurrency",
            str(args.concurrency),
            "--model",
            args.model,
            "--retries",
            str(args.retries),
            "--failures",
            str(failures_path),
        ]
        log(f"RUN pass={pass_index} cmd={' '.join(cmd)}")
        started = time.time()
        try:
            result = subprocess.run(cmd, env=env, timeout=args.pass_timeout, check=False)
            log(f"PASS pass={pass_index} returncode={result.returncode} seconds={time.time() - started:.1f}")
        except subprocess.TimeoutExpired:
            log(f"TIMEOUT pass={pass_index} seconds={args.pass_timeout}")

    audit = _audit(out_path)
    _write_audit(out_root, audit)
    raise SystemExit(f"not complete after {args.max_passes} passes: {json.dumps(audit, ensure_ascii=False)}")


if __name__ == "__main__":
    main()
