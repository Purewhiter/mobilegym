#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path

from tqdm import tqdm

from io_utils import OUTPUT_ROOT, read_jsonl_map
from openai_v1 import generate_image_b64


def _compose_prompt_from_caption(cap: dict) -> str:
    parts = [cap.get("captionZh", "").strip()]
    comp = cap.get("composition", "").strip()
    if comp:
        parts.append(comp)
    style = cap.get("style", "").strip()
    if style:
        parts.append(f"风格：{style}")
    parts.append("画面中不要出现真实品牌 logo、水印、账号、二维码、可识别真实姓名。")
    return " ".join(p for p in parts if p)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate RedBook images from prompts with /v1/images/generations.")
    parser.add_argument("--audits", type=Path, default=OUTPUT_ROOT / "image.caption_audits.jsonl")
    parser.add_argument("--captions", type=Path, default=None, help="If set, skip audit and use captionZh directly as prompt.")
    parser.add_argument("--out-root", type=Path, default=OUTPUT_ROOT / "images")
    parser.add_argument("--model", default=os.environ.get("REDBOOK_IMAGE_MODEL", "gpt-image-1.5"))
    parser.add_argument("--size", default=os.environ.get("REDBOOK_IMAGE_SIZE", "1024x1536"))
    parser.add_argument("--quality", default=os.environ.get("REDBOOK_IMAGE_QUALITY", "high"))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    pending: list[tuple[str, str, str, Path]] = []
    if args.captions:
        items = list(read_jsonl_map(args.captions, "key").values())
        for cap in items:
            if cap.get("error"):
                continue
            note_id, image_index = cap["key"].split(":", 1)
            out_path = args.out_root / "posts" / note_id / f"{image_index}.jpg"
            if out_path.exists() and not args.force:
                continue
            pending.append((_compose_prompt_from_caption(cap), note_id, image_index, out_path))
    else:
        audits = list(read_jsonl_map(args.audits, "key").values())
        for audit in audits:
            if not audit.get("pass"):
                continue
            note_id, image_index = audit["key"].split(":", 1)
            out_path = args.out_root / "posts" / note_id / f"{image_index}.jpg"
            if out_path.exists() and not args.force:
                continue
            pending.append((audit["fixedPromptZh"], note_id, image_index, out_path))
    if args.limit is not None:
        pending = pending[: args.limit]

    pbar = tqdm(pending, desc="images", unit="img", smoothing=0.1)
    try:
        for prompt, note_id, image_index, out_path in pbar:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                image_bytes = generate_image_b64(
                    model=args.model,
                    prompt=prompt,
                    size=args.size,
                    quality=args.quality,
                )
            except Exception as exc:
                tqdm.write(f"ERROR {note_id}:{image_index}: {exc}")
                continue
            out_path.write_bytes(image_bytes)
            cover_path = out_path.parent / "cover.jpg"
            if image_index == "0" and not cover_path.exists():
                cover_path.write_bytes(image_bytes)
            pbar.set_postfix_str(f"{note_id}:{image_index}")
    finally:
        pbar.close()


if __name__ == "__main__":
    main()
