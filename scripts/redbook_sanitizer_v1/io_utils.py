#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[2]
REDBOOK_DATA = PROJECT_ROOT / "apps" / "RedBook" / "data"
SOURCE_ROOT = Path(os.environ.get("REDBOOK_SOURCE_ROOT", "/home/dingbang.wu/output"))
OUTPUT_ROOT = Path(os.environ.get("REDBOOK_OUT_ROOT", "/home/dingbang.wu/output_sanitized_v1"))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")


def read_jsonl_map(path: Path, key: str) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    rows: dict[str, dict[str, Any]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        rows[str(item[key])] = item
    return rows


def batched(items: list[Any], limit: int | None) -> Iterable[Any]:
    if limit is None:
        yield from items
    else:
        yield from items[:limit]


def load_redbook_notes() -> list[dict[str, Any]]:
    return read_json(REDBOOK_DATA / "notes.json")


def load_redbook_users() -> list[dict[str, Any]]:
    return read_json(REDBOOK_DATA / "users.json")


def load_redbook_defaults() -> dict[str, Any]:
    return read_json(REDBOOK_DATA / "defaults.json")


def load_crawled_ts_notes(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"export const CRAWLED_NOTES = (\[.*?\]);\s*$", text, re.S)
    if not match:
        raise ValueError(f"Cannot find CRAWLED_NOTES in {path}")
    return json.loads(match.group(1))
