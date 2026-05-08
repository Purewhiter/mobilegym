#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm


DEFAULT_OUT_ROOT = Path(os.environ.get("BILIBILI_OUT_ROOT", "scripts/bilibili_sanitizer_v1/out"))
DEFAULT_API = os.environ.get("BILIBILI_IMAGE_API", "http://127.0.0.1:30000/v1/images/generations")
DEFAULT_MODEL = os.environ.get("BILIBILI_IMAGE_MODEL", "Z-Image-turbo")

NEGATIVE_PROMPT = (
    "水印, 二维码, UI截图, 手机界面截图, bilibili界面, 哔哩哔哩标志, "
    "播放器控件, 播放按钮, 进度条, 顶部工具栏, 底部缩略图条, 卡片列表, 拼贴, "
    "watermark, brand mark, qr code, screenshot, user interface, media player controls, progress bar, toolbar, collage"
)


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def read_prompt_map(path: Path | None) -> dict[str, str]:
    if path is None or not path.exists():
        return {}
    prompts: dict[str, str] = {}
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            description = row.get("description") or row.get("prompt")
            if row.get("id") and description and not row.get("error"):
                prompts[str(row["id"])] = str(description).strip()
    return prompts


def stable_seed(value: str) -> int:
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:8], 16)


def compose_prompt(video: dict) -> str:
    visual_prompt = (video.get("_visual_prompt") or "").strip()
    if visual_prompt:
        return (
            "根据下面的图像描述生成一张新的 16:9 横版视频封面图片。"
            "尽量保留主体、构图、场景、光线、色彩和整体风格。"
            f"图像描述：{visual_prompt}"
        )
    title = (video.get("title") or "").strip()
    tags = [str(t).strip() for t in (video.get("tags") or []) if str(t).strip()]
    tag_text = "、".join(tags[:6])
    return (
        "根据下面的视频标题和标签生成一张 16:9 横版视频封面图片。"
        f"标题：{title}。"
        f"标签：{tag_text or '综合'}。"
    )


def extract_image_bytes(item: dict, api: str) -> bytes:
    b64 = item.get("b64_json")
    if isinstance(b64, str):
        import base64

        return base64.b64decode(b64)
    file_path = item.get("file_path")
    if isinstance(file_path, str) and Path(file_path).exists():
        return Path(file_path).read_bytes()
    url = item.get("url")
    if isinstance(url, str):
        full_url = url
        if not url.startswith("http"):
            from urllib.parse import urlsplit

            parts = urlsplit(api)
            full_url = f"{parts.scheme}://{parts.netloc}{url if url.startswith('/') else '/' + url}"
        with urllib.request.urlopen(full_url, timeout=120) as r:
            return r.read()
    raise RuntimeError(f"image generation returned no usable content: {item}")


def generate_one(
    *,
    api: str,
    model: str,
    video: dict,
    out_path: Path,
    size: str,
    steps: int,
    max_retry: int,
) -> tuple[bool, str]:
    prompt = compose_prompt(video)
    seed = stable_seed(video["id"])
    last_error = ""
    for attempt in range(max_retry):
        payload = {
            "model": model,
            "prompt": prompt,
            "negative_prompt": NEGATIVE_PROMPT,
            "size": size,
            "seed": (seed + attempt * 7919) % (2**31),
        }
        if steps > 0:
            payload["num_inference_steps"] = steps
            # Keep the shorter alias for servers that accept it; sglang diffusion
            # uses num_inference_steps for the actual sampler setting.
            payload["steps"] = steps
        req = urllib.request.Request(
            api,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read())
            items = data.get("data") or []
            if not items:
                raise RuntimeError("no data")
            image_bytes = extract_image_bytes(items[0], api)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")
            tmp_path.write_bytes(image_bytes)
            shutil.move(str(tmp_path), str(out_path))
            return True, "ok"
        except Exception as exc:
            last_error = str(exc)
            time.sleep(min(2.0, 0.25 * (attempt + 1)))
    return False, last_error


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate sanitized Bilibili video covers.")
    parser.add_argument("--videos", type=Path, default=DEFAULT_OUT_ROOT / "videos.jsonl")
    parser.add_argument("--prompts", type=Path, default=None, help="Optional JSONL generated by rewrite_cover_prompts.py.")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_ROOT / "images" / "covers")
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--size", default="1024x576")
    parser.add_argument("--steps", type=int, default=0)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--ids", type=Path, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--retries", type=int, default=3)
    args = parser.parse_args()

    selected_ids: set[str] | None = None
    if args.ids:
        selected_ids = {line.strip() for line in args.ids.read_text(encoding="utf-8").splitlines() if line.strip()}

    videos = read_jsonl(args.videos)
    prompt_map = read_prompt_map(args.prompts)
    tasks: list[tuple[dict, Path]] = []
    for video in videos:
        video_id = video.get("id")
        if not video_id:
            continue
        if selected_ids is not None and video_id not in selected_ids:
            continue
        out_path = args.out_dir / f"{video_id}.jpg"
        if out_path.exists() and not args.force:
            continue
        if video_id in prompt_map:
            video = {**video, "_visual_prompt": prompt_map[video_id]}
        tasks.append((video, out_path))

    if args.limit:
        tasks = tasks[: args.limit]

    print(f"待生成 {len(tasks)} 张封面，并发={args.concurrency}, size={args.size}, api={args.api}")
    if not tasks:
        return

    ok_count = 0
    fail_count = 0
    failures: list[dict] = []
    lock = threading.Lock()

    def work(item: tuple[dict, Path]) -> tuple[str, bool, str]:
        video, out_path = item
        ok, msg = generate_one(
            api=args.api,
            model=args.model,
            video=video,
            out_path=out_path,
            size=args.size,
            steps=args.steps,
            max_retry=args.retries,
        )
        return video["id"], ok, msg

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = {executor.submit(work, item): item for item in tasks}
        with tqdm(total=len(futures), unit="cover", desc="covers", smoothing=0.1) as pbar:
            for fut in as_completed(futures):
                video_id, ok, msg = fut.result()
                with lock:
                    if ok:
                        ok_count += 1
                    else:
                        fail_count += 1
                        failures.append({"id": video_id, "error": msg})
                pbar.update(1)
                pbar.set_postfix(ok=ok_count, fail=fail_count)

    elapsed = time.time() - t0
    print(json.dumps({"ok": ok_count, "fail": fail_count, "elapsed": elapsed}, ensure_ascii=False))
    if failures:
        fail_path = args.out_dir.parent / "cover_failures.jsonl"
        fail_path.parent.mkdir(parents=True, exist_ok=True)
        with fail_path.open("a", encoding="utf-8") as f:
            for row in failures:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"失败记录已追加到 {fail_path}")


if __name__ == "__main__":
    main()
