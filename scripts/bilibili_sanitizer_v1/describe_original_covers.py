#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import shutil
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm

try:
    from .openai_v1 import OpenAIV1Error, post_json
except ImportError:  # pragma: no cover
    sys.path.append(str(Path(__file__).resolve().parent))
    from openai_v1 import OpenAIV1Error, post_json


DEFAULT_OUT_ROOT = Path(os.environ.get("BILIBILI_OUT_ROOT", "scripts/bilibili_sanitizer_v1/out"))
DEFAULT_SOURCE_VIDEOS = Path("apps/Bilibili/data/videos.json")

SYSTEM = """你是图像内容描述员。请客观、细致地描述用户给出的图片本身。
要求：
1. 只描述图片中真实可见的内容，不根据视频标题、作者或平台背景补充剧情。
2. 描述主体、主体位置、动作/姿态/表情、背景环境、构图、视角、光线、色彩和画风。
3. 如果图片中有明显文字、数字、图标或图形元素，只描述它们的位置和视觉形态，不需要逐字转录。
4. 不要写“这是一张封面”“这是一张截图”“适合生成图片”之类任务说明。
5. 输出一段中文，约 180-230 字，不要列表，不要 Markdown。/no_think"""


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl_ids(path: Path | None) -> set[str] | None:
    if path is None:
        return None
    ids: set[str] = set()
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            if row.get("id"):
                ids.add(str(row["id"]))
    return ids


def existing_ids(path: Path) -> set[str]:
    if not path.exists():
        return set()
    out: set[str] = set()
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("id") and row.get("description") and not row.get("error"):
                out.add(str(row["id"]))
    return out


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
        f.flush()


def load_source_videos(path: Path) -> list[dict]:
    rows = read_json(path)
    if not isinstance(rows, list):
        raise RuntimeError(f"{path} must contain a JSON array")
    return rows


def cache_path_for(video_id: str, url: str, cache_dir: Path) -> Path:
    suffix = Path(url.split("?", 1)[0]).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        suffix = ".jpg"
    return cache_dir / f"{video_id}{suffix}"


def download_cover(video: dict, cache_dir: Path, retries: int) -> Path:
    video_id = str(video["id"])
    url = str(video.get("cover") or "")
    if not url:
        raise RuntimeError("missing cover url")
    out_path = cache_path_for(video_id, url, cache_dir)
    if out_path.exists() and out_path.stat().st_size > 0:
        return out_path

    last_error = ""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 mobile-gym-bilibili-sanitizer/1.0",
                    "Referer": "https://www.bilibili.com/",
                },
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            if not data:
                raise RuntimeError("empty image response")
            out_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")
            tmp_path.write_bytes(data)
            shutil.move(str(tmp_path), str(out_path))
            return out_path
        except Exception as exc:
            last_error = str(exc)
            time.sleep(min(2.0, 0.25 * (attempt + 1)))
    raise RuntimeError(last_error)


def image_data_url(path: Path) -> str:
    mime = mimetypes.guess_type(str(path))[0] or "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def describe_cover(*, model: str, image_path: Path, retries: int) -> str:
    user_text = "请详细描述这张图片本身，约 200 字。"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": image_data_url(image_path)}},
                ],
            },
        ],
        "reasoning_effort": os.environ.get("OPENAI_REASONING_EFFORT", "none"),
        "reasoning": {"effort": os.environ.get("OPENAI_REASONING_EFFORT", "none")},
        "enable_thinking": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    response = post_json("/chat/completions", payload, retries=retries)
    choices = response.get("choices") or []
    if not choices:
        raise OpenAIV1Error("chat completion did not contain choices")
    content = choices[0].get("message", {}).get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise OpenAIV1Error("chat completion did not contain text content")
    return " ".join(content.strip().split())


def main() -> None:
    parser = argparse.ArgumentParser(description="Describe original Bilibili cover images with a VLM.")
    parser.add_argument("--source-videos", type=Path, default=DEFAULT_SOURCE_VIDEOS)
    parser.add_argument("--videos", type=Path, default=DEFAULT_OUT_ROOT / "videos.jsonl", help="Optional sanitized JSONL used only to select ids.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_ROOT / "cover_descriptions.jsonl")
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_OUT_ROOT / "images" / "original_covers")
    parser.add_argument("--model", default=os.environ.get("BILIBILI_TEXT_MODEL", "Qwen3.6-35B-A3B"))
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--retries", type=int, default=3)
    args = parser.parse_args()

    selected_ids = read_jsonl_ids(args.videos) if args.videos.exists() else None
    done = set() if args.force else existing_ids(args.out)

    rows = []
    for row in load_source_videos(args.source_videos):
        video_id = str(row.get("id") or "")
        if not video_id or not row.get("cover"):
            continue
        if selected_ids is not None and video_id not in selected_ids:
            continue
        if video_id in done:
            continue
        rows.append(row)
    if args.limit:
        rows = rows[: args.limit]

    print(f"待描述 {len(rows)} 张原始封面，并发={args.concurrency}")
    if not rows:
        return

    def work(video: dict) -> dict:
        video_id = str(video["id"])
        try:
            image_path = download_cover(video, args.cache_dir, args.retries)
            description = describe_cover(model=args.model, image_path=image_path, retries=args.retries)
            return {"id": video_id, "description": description, "sourceCover": str(video.get("cover") or "")}
        except Exception as exc:
            return {"id": video_id, "error": str(exc), "sourceCover": str(video.get("cover") or "")}

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [executor.submit(work, row) for row in rows]
        with tqdm(total=len(futures), unit="cover", desc="describe-covers", smoothing=0.1) as pbar:
            for fut in as_completed(futures):
                append_jsonl(args.out, fut.result())
                pbar.update(1)


if __name__ == "__main__":
    main()
