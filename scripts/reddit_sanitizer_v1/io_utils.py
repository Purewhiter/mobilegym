#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[2]
REDDIT_DATA = PROJECT_ROOT / "apps" / "Reddit" / "data"
OUTPUT_ROOT = Path(os.environ.get("REDDIT_OUT_ROOT", "/tmp/reddit_sanitize_v1"))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


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


def load_posts() -> list[dict[str, Any]]:
    payload = read_json(REDDIT_DATA / "posts.json")
    posts = payload.get("posts", [])
    if not isinstance(posts, list):
        raise ValueError("apps/Reddit/data/posts.json must contain a posts array")
    return posts
