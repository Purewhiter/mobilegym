#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BILIBILI_DATA = PROJECT_ROOT / "apps" / "Bilibili" / "data"
OUTPUT_ROOT = Path(os.environ.get("BILIBILI_OUT_ROOT", "/tmp/bilibili_sanitize_v1"))


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


def chunked(items: list[Any], size: int) -> Iterable[list[Any]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def load_authors() -> dict[str, dict[str, Any]]:
    return {str(k): v for k, v in read_json(BILIBILI_DATA / "authors.json").items()}


def load_commenters() -> dict[str, dict[str, Any]]:
    return {str(k): v for k, v in read_json(BILIBILI_DATA / "commenters.json").items()}


def load_videos() -> list[dict[str, Any]]:
    return read_json(BILIBILI_DATA / "videos.json")


def load_video_comments() -> dict[str, dict[str, Any]]:
    return read_json(BILIBILI_DATA / "videoComments.json")


def load_video_tags() -> dict[str, list[str]]:
    return read_json(BILIBILI_DATA / "videoTags.json")
