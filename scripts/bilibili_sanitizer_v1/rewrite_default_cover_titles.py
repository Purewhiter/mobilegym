#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    tqdm = None

from io_utils import PROJECT_ROOT, append_jsonl, read_json, read_jsonl_map, write_json
from rewrite_videos import SYSTEM, VIDEO_SCHEMA
from openai_v1 import chat_json


DATA_DIR = PROJECT_ROOT / "apps" / "Bilibili" / "data"
ARTIFACTS = PROJECT_ROOT / "mobilegym-data" / "_artifacts" / "bilibili" / "users_full_20260503"
DEFAULT_COVER = "./images/covers/default.svg"
DEFAULT_OUT = ARTIFACTS / "default_cover_video_rewrites.jsonl"


def head_json(path: str) -> Any:
    data = subprocess.check_output(
        ["git", "show", f"HEAD:{path}"],
        cwd=PROJECT_ROOT,
        text=True,
        encoding="utf-8",
    )
    return json.loads(data)


def similarity(a: Any, b: Any) -> float:
    left = " ".join(str(a or "").split())
    right = " ".join(str(b or "").split())
    if not left and not right:
        return 1.0
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def fake_to_old_video_map() -> dict[str, str]:
    raw = read_json(ARTIFACTS / "private_id_mapping.json")["videos"]
    out: dict[str, str] = {}
    for old_id, value in raw.items():
        fake_id = value if isinstance(value, str) else value["newId"]
        out[str(fake_id)] = str(old_id)
    return out


def load_targets() -> list[dict[str, Any]]:
    current_videos = read_json(DATA_DIR / "videos.json")
    old_by_fake = fake_to_old_video_map()
    original_videos = {str(video["id"]): video for video in head_json("apps/Bilibili/data/videos.json")}
    original_tags = head_json("apps/Bilibili/data/videoTags.json")

    targets: list[dict[str, Any]] = []
    for current in current_videos:
        if current.get("cover") != DEFAULT_COVER:
            continue
        fake_id = str(current["id"])
        old_id = old_by_fake.get(fake_id)
        original = original_videos.get(str(old_id))
        if not old_id or not original:
            raise RuntimeError(f"missing original video for fake id {fake_id}")
        targets.append(
            {
                "id": fake_id,
                "oldId": old_id,
                "originalTitle": original.get("title", ""),
                "originalTags": original_tags.get(str(old_id), []),
                "duration": original.get("duration", ""),
            }
        )
    return targets


def rewrite_one(target: dict[str, Any], *, model: str, retries: int) -> dict[str, Any]:
    payload = {
        "title": target["originalTitle"],
        "tags": target["originalTags"],
        "duration": target["duration"],
    }
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            extra_instruction = (
                "\n特别注意：这批标题之前改写得过于接近原文。"
                "请重新组织表达方式，不要照抄原标题里的长短句，"
                "普通账号名必须删除或泛化；保留题材即可。"
            )
            result = chat_json(
                model=model,
                system=SYSTEM,
                user_content="请改写这个 Bilibili 视频文本，输出 JSON：\n"
                + json.dumps(payload, ensure_ascii=False, indent=2)
                + extra_instruction,
                schema_name="bilibili_video_rewrite",
                schema=VIDEO_SCHEMA,
            )
            title = str(result.get("title", "")).strip()
            tags = result.get("tags")
            if not title:
                raise RuntimeError("model returned empty title")
            if not isinstance(tags, list) or not tags:
                raise RuntimeError("model returned empty tags")
            if title == str(target["originalTitle"]).strip():
                raise RuntimeError("title unchanged from original")
            if len(str(target["originalTitle"]).strip()) >= 6 and similarity(target["originalTitle"], title) >= 0.72:
                raise RuntimeError("title too close to original")
            original_tags = " ".join(str(tag) for tag in target["originalTags"] or [])
            rewritten_tags = " ".join(str(tag) for tag in tags)
            if len(original_tags.strip()) >= 6 and similarity(original_tags, rewritten_tags) >= 0.72:
                raise RuntimeError("tags too close to original")
            return {
                "id": target["id"],
                "oldId": target["oldId"],
                "title": title,
                "tags": [str(tag) for tag in tags],
            }
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(min(2**attempt, 5))
    raise RuntimeError(f"{target['id']} failed: {last_error}")


def apply_rewrites(out: Path) -> None:
    rewrites = read_jsonl_map(out, "id")
    videos = read_json(DATA_DIR / "videos.json")
    tags = read_json(DATA_DIR / "videoTags.json")

    title_by_id: dict[str, str] = {}
    for video in videos:
        rewrite = rewrites.get(str(video.get("id", "")))
        if not rewrite:
            continue
        video["title"] = rewrite["title"]
        tags[str(video["id"])] = rewrite["tags"]
        title_by_id[str(video["id"])] = rewrite["title"]

    authors = read_json(DATA_DIR / "authors.json")
    for author in authors.values():
        for item in author.get("videos") or []:
            if str(item.get("id", "")) in title_by_id:
                item["title"] = title_by_id[str(item["id"])]

    details_path = DATA_DIR / "videoDetails.jsonl"
    detail_lines: list[str] = []
    for line in details_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        video_id = str(row.get("id") or row.get("bvid") or "")
        if video_id in title_by_id:
            row["title"] = title_by_id[video_id]
            if video_id in tags:
                row["tags"] = tags[video_id]
        detail_lines.append(json.dumps(row, ensure_ascii=False, separators=(",", ":")))

    write_json(DATA_DIR / "videos.json", videos)
    write_json(DATA_DIR / "videoTags.json", tags)
    write_json(DATA_DIR / "authors.json", authors)
    details_path.write_text("\n".join(detail_lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite missing default-cover Bilibili video titles from original titles.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--model", default="Qwen3.6-35B-A3B")
    parser.add_argument("--concurrency", type=int, default=32)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.apply:
        apply_rewrites(args.out)
        return

    targets = load_targets()
    done = read_jsonl_map(args.out, "id")
    pending = [target for target in targets if target["id"] not in done]
    if args.limit is not None:
        pending = pending[: args.limit]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    failures = args.out.with_name(f"{args.out.stem}.failures.jsonl")
    write_lock = threading.Lock()
    pbar = tqdm(total=len(pending), desc="default-cover-title-rewrites", unit="video") if tqdm else None

    def run(target: dict[str, Any]) -> None:
        try:
            result = rewrite_one(target, model=args.model, retries=args.retries)
            with write_lock:
                append_jsonl(args.out, result)
                if pbar:
                    pbar.set_postfix_str(result["title"][:30])
                    pbar.update(1)
        except Exception as exc:
            with write_lock:
                append_jsonl(failures, {"id": target["id"], "oldId": target["oldId"], "error": str(exc)})
                if pbar:
                    pbar.update(1)

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [executor.submit(run, target) for target in pending]
        for future in as_completed(futures):
            future.result()

    if pbar:
        pbar.close()

    if failures.exists():
        raise SystemExit(f"rewrite failures written to {failures}")


if __name__ == "__main__":
    main()
