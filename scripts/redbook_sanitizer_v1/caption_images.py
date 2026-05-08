#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from tqdm import tqdm

from io_utils import OUTPUT_ROOT, SOURCE_ROOT, append_jsonl, batched, load_crawled_ts_notes, load_redbook_notes, load_redbook_users, read_jsonl_map
from openai_v1 import image_data_url, responses_json
from risk_utils import note_risk_context


CAPTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "noteId": {"type": "string"},
        "imageIndex": {"type": "integer"},
        "imageType": {
            "type": "string",
            "enum": [
                "text_card",
                "screenshot",
                "selfie",
                "outfit",
                "food",
                "product",
                "landscape",
                "lifestyle",
                "document",
                "other",
            ],
        },
        "captionZh": {"type": "string"},
        "mainSubject": {"type": "string"},
        "composition": {"type": "string"},
        "style": {"type": "string"},
        "scene": {"type": "string"},
        "objectsAndClothing": {"type": "array", "items": {"type": "string"}},
        "regionDetails": {"type": "array", "items": {"type": "string"}},
        "visibleText": {"type": "array", "items": {"type": "string"}},
        "qualityNotes": {"type": "string"},
    },
    "required": [
        "noteId",
        "imageIndex",
        "imageType",
        "captionZh",
        "mainSubject",
        "composition",
        "style",
        "scene",
        "objectsAndClothing",
        "regionDetails",
        "visibleText",
        "qualityNotes",
    ],
    "additionalProperties": False,
}


SYSTEM = """你是小红书图片数据集的视觉标注员。
任务：只做忠实、细致、客观的原图 caption，不写生图 prompt，不做脱敏改写。
要求：
1. 不要猜测真人身份、品牌归属、地点名称或图片背后的故事；只描述看得见的内容。
2. 记录图片类型，尤其区分文字卡片、截图、自拍、穿搭、食物、商品图、文档。
3. captionZh 是一段自然中文总述，要包含主体、场景、构图和关键视觉元素。
4. mainSubject 用一句话说明画面主体。
5. composition 描述布局、视角、裁切、拼图结构、横竖比例、主体位置。
6. scene 描述环境和背景。
7. objectsAndClothing 列出重要物体、服饰、食物、界面元素或道具。
8. regionDetails 对拼图/截图/文字卡片尤其重要：按上/下/左/右/每个宫格描述具体内容。
9. visibleText 逐条记录图片中可读或半可读文字；看不清就写“不可读文字/模糊标识”，不要改写。
10. qualityNotes 描述照片质感、清晰度、光线、滤镜、是否有运动模糊/截图压缩/拼接痕迹。"""


def local_image_path(root: Path, rel: str) -> Path:
    rel = rel[2:] if rel.startswith("./") else rel
    direct = root / rel
    if direct.exists():
        return direct
    parts = Path(rel).parts
    if len(parts) >= 3 and parts[0] == "images" and parts[1] != "posts":
        with_posts = root / "images" / "posts" / Path(*parts[1:])
        if with_posts.exists():
            return with_posts
    if len(parts) >= 2 and parts[0] != "posts":
        posts_under_root = root / "posts" / Path(*parts[1:])
        if posts_under_root.exists():
            return posts_under_root
    return direct


def main() -> None:
    parser = argparse.ArgumentParser(description="Caption RedBook images with the OpenAI /v1 Responses API.")
    parser.add_argument("--source-images-root", type=Path, default=SOURCE_ROOT, help="Root containing localized original images.")
    parser.add_argument("--source-ts", type=Path, default=SOURCE_ROOT / "crawledData_localized.ts", help="crawledData_localized.ts with local ./images paths.")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "image.captions.jsonl", help="JSONL output path.")
    parser.add_argument("--model", default=os.environ.get("REDBOOK_VLM_MODEL", "gpt-5-mini"))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--concurrency", type=int, default=1, help="Parallel images in flight; 1 = serial.")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    done = {} if args.force else read_jsonl_map(args.out, "key")
    notes = load_crawled_ts_notes(args.source_ts) if args.source_ts else load_redbook_notes()
    original_notes = {str(note["id"]): note for note in load_redbook_notes()}
    original_users = {str(user["id"]): user for user in load_redbook_users()}
    items: list[tuple[dict[str, Any], int, str]] = []
    for note in notes:
        for index, url in enumerate(note.get("images") or []):
            if not isinstance(url, str) or not url.startswith("./"):
                continue
            key = f"{note['id']}:{index}"
            if key not in done:
                items.append((note, index, url))

    iterable = list(batched(items, args.limit))
    pbar = tqdm(total=len(iterable), desc="captions", unit="img", smoothing=0.1)
    write_lock = threading.Lock()

    def process(note: dict[str, Any], index: int, rel: str) -> None:
        key = f"{note['id']}:{index}"
        img_path = local_image_path(args.source_images_root, rel)
        if not img_path.exists():
            with write_lock:
                append_jsonl(args.out, {"key": key, "noteId": note["id"], "imageIndex": index, "error": f"missing file: {img_path}"})
                pbar.update(1)
                pbar.set_postfix_str(f"missing {key}")
            return
        user_text = (
            f"noteId={note['id']}\n"
            f"imageIndex={index}\n"
            f"title={note.get('title', '')}\n"
            f"content={note.get('content', '')[:800]}\n"
            f"category={note.get('category', '')}\n"
            "请输出 JSON。"
        )
        try:
            result = responses_json(
                model=args.model,
                system=SYSTEM,
                user_content=[
                    {"type": "input_text", "text": user_text},
                    {"type": "input_image", "image_url": image_data_url(img_path)},
                ],
                schema_name="redbook_image_caption",
                schema=CAPTION_SCHEMA,
            )
        except Exception as exc:
            with write_lock:
                tqdm.write(f"ERROR {key}: {exc}")
                pbar.update(1)
            return
        result["key"] = key
        result["sourcePath"] = str(img_path)
        original_note = original_notes.get(str(note["id"]), note)
        result["auditContext"] = note_risk_context(original_note, original_users)
        with write_lock:
            append_jsonl(args.out, result)
            pbar.update(1)
            pbar.set_postfix_str(f"{result.get('imageType','')} {key}")

    try:
        if args.concurrency <= 1:
            for note, index, rel in iterable:
                process(note, index, rel)
        else:
            with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
                futures = [ex.submit(process, n, i, r) for n, i, r in iterable]
                for f in as_completed(futures):
                    f.result()
    finally:
        pbar.close()


if __name__ == "__main__":
    main()
