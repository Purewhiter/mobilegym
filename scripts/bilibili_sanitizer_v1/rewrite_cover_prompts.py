#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm

try:
    from .openai_v1 import OpenAIV1Error, chat_text
except ImportError:  # pragma: no cover
    sys.path.append(str(Path(__file__).resolve().parent))
    from openai_v1 import OpenAIV1Error, chat_text


DEFAULT_OUT_ROOT = Path(os.environ.get("BILIBILI_OUT_ROOT", "scripts/bilibili_sanitizer_v1/out"))

SYSTEM = """根据视频标题和标签，描述这个视频封面可能长什么样。
每条 60-120 个中文字符，只写画面内容，不解释。
不主动设计封面文字、字样、emoji、贴纸或界面元素；标题和标签里明确要求时才提。
输出协议：每行 `BV号<TAB>封面画面描述`，行数和输入一致。"""

FORBIDDEN_TERMS = ("文字", "字样", "emoji", "贴纸", "界面", "页面", "UI")

def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
        f.flush()


def existing_ids(path: Path) -> set[str]:
    if not path.exists():
        return set()
    out: set[str] = set()
    with path.open(encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("id") and not row.get("error"):
                out.add(str(row["id"]))
    return out


def read_id_set(path: Path | None) -> set[str] | None:
    if path is None:
        return None
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


def parse_tsv(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or "\t" not in line:
            continue
        video_id, prompt = line.split("\t", 1)
        video_id = video_id.strip()
        prompt = prompt.strip()
        if video_id and prompt:
            out[video_id] = prompt
    return out


def clean_single_text(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
    for prefix in ("封面画面描述：", "画面描述：", "描述："):
        if text.startswith(prefix):
            text = text[len(prefix):].strip()
    return text


def validate_prompt(prompt: str) -> str | None:
    prompt = prompt.strip()
    if len(prompt) < 20:
        return "too short"
    if len(prompt) > 180:
        return "too long"
    hits = [term for term in FORBIDDEN_TERMS if term in prompt]
    if hits:
        return "forbidden terms: " + ",".join(hits)
    return None


def rewrite_batch(model: str, rows: list[dict], retries: int) -> list[dict]:
    lines: list[str] = []
    for row in rows:
        tags = "、".join(str(t) for t in (row.get("tags") or [])[:8])
        lines.append(f"{row['id']}\t标题：{row.get('title','')}\t标签：{tags}")
    user_content = "\n".join(lines)
    last_error = ""
    for _ in range(retries):
        try:
            text = chat_text(model=model, system=SYSTEM, user_content=user_content)
            parsed = parse_tsv(text)
            if len(rows) == 1 and rows[0]["id"] not in parsed:
                parsed[rows[0]["id"]] = clean_single_text(text)
            missing = [row["id"] for row in rows if row["id"] not in parsed]
            if missing:
                raise OpenAIV1Error(f"model missed ids {missing[:8]}")
            invalid = [
                (row["id"], validate_prompt(parsed[row["id"]]))
                for row in rows
                if validate_prompt(parsed[row["id"]])
            ]
            if invalid:
                raise OpenAIV1Error(f"invalid prompts {invalid[:8]}")
            return [{"id": row["id"], "description": parsed[row["id"]]} for row in rows]
        except Exception as exc:
            last_error = str(exc)
    return [{"id": row["id"], "error": last_error} for row in rows]


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite Bilibili title/tags into visual prompts for cover generation.")
    parser.add_argument("--videos", type=Path, default=DEFAULT_OUT_ROOT / "videos.jsonl")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_ROOT / "cover_prompts.jsonl")
    parser.add_argument("--model", default=os.environ.get("BILIBILI_TEXT_MODEL", "local-model"))
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--concurrency", type=int, default=16)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--ids", type=Path, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--retries", type=int, default=4)
    args = parser.parse_args()

    done = set() if args.force else existing_ids(args.out)
    selected_ids = read_id_set(args.ids)
    rows = [
        row
        for row in read_jsonl(args.videos)
        if row.get("id")
        and row.get("id") not in done
        and (selected_ids is None or str(row.get("id")) in selected_ids)
    ]
    if args.limit:
        rows = rows[: args.limit]

    batches = [rows[i : i + args.batch_size] for i in range(0, len(rows), args.batch_size)]
    print(f"待生成 {len(rows)} 条画面 prompt，batch={args.batch_size}, 并发={args.concurrency}")
    if not batches:
        return

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [executor.submit(rewrite_batch, args.model, batch, args.retries) for batch in batches]
        with tqdm(total=len(rows), unit="prompt", desc="cover-prompts", smoothing=0.1) as pbar:
            for fut in as_completed(futures):
                result = fut.result()
                for row in result:
                    append_jsonl(args.out, row)
                pbar.update(len(result))


if __name__ == "__main__":
    main()
